/* Smart Intake — детерминированный слой разбора обращения.
   В рабочей версии смысловой разбор делает LLM в российском облаке (YandexGPT / GigaChat),
   а этот слой проверяет каждое поле по исходному тексту: значение без цитаты в тексте не попадает в карточку.
   Здесь он работает самостоятельно, прямо в браузере. */
(function () {
  'use strict';

  const PROMPT_VERSION = 'intake-ru/2.3.1';
  const SCHEMA_VERSION = 'matter-draft/1.0';
  const DISCLAIMER = 'Данный анализ не является юридической консультацией.';

  /* ---------- справочники ---------- */
  const MONTHS = { 'январ': 0, 'феврал': 1, 'март': 2, 'апрел': 3, 'ма': 4, 'июн': 5, 'июл': 6, 'август': 7, 'сентябр': 8, 'октябр': 9, 'ноябр': 10, 'декабр': 11 };
  const MONTH_RE = '(январ[ья]|феврал[ья]|марта?|апрел[ья]|ма[йя]|июн[ья]|июл[ья]|августа?|сентябр[ья]|октябр[ья]|ноябр[ья]|декабр[ья])';
  const INSURERS = ['Ингосстрах', 'РЕСО-Гарантия', 'РЕСО', 'Росгосстрах', 'АльфаСтрахование', 'Альфа Страхование', 'СОГАЗ', 'ВСК', 'Согласие', 'Т-Страхование', 'Тинькофф Страхование', 'Ренессанс Страхование', 'Сбербанк Страхование', 'Сбер Страхование', 'Зетта', 'Югория', 'МАКС'];
  const EMOTION = /(беспредел|издева|ужас|кошмар|бред|наглост|наглые|возмутительн|обидно|достали|в шоке|не знаю что делать|сволоч|твар|уроды|бесит|отвратительн|позор|ненавиж|страшно|!!+)/i;

  const OUTCOME = { key: 'desired_outcome', label: 'Желаемый результат', kind: 'outcome', q: 'Какой результат для вас был бы хорошим: вернуть деньги, восстановиться, договориться миром?' };

  const TYPES = {
    labor: {
      label: 'Трудовой спор', law: 'Трудовой кодекс РФ', spec: 'трудовой юрист',
      kw: [[/уволи|увольн|сократ/, 2], [/зарплат|заработн|расч[её]т|отпускн|аванс/, 2], [/работодат|директор|начальник|на работе|трудов/, 1.5], [/больничн|премии|оклад/, 1]],
      fields: [
        { key: 'opponent', label: 'Работодатель', kind: 'org', vague: /работодател|директор|компани|фирм/, q: 'Как называется работодатель? Если знаете — ООО или ИП и ИНН.' },
        { key: 'event_date', label: 'Дата увольнения', kind: 'date', ctx: /уволи|увольн|расторг|сократ/, q: 'Какого числа вас уволили — по приказу или когда сообщили?' },
        { key: 'amount', label: 'Сумма задолженности', kind: 'money', ctx: /зарплат|задолж|долг|не выплат|не заплат|недоплат|расч|это /, q: 'Какую сумму вам не выплатили, хотя бы примерно?' },
        { key: 'contract', label: 'Оформление', kind: 'bool', yes: /(?<!не)официально|трудов(ой|ому|ым) договор|по договору/, no: /неофициально|без договора|в конверте|без оформлени|не оформ/, yesL: 'официально, трудовой договор', noL: 'без оформления', q: 'Вы были оформлены официально, по трудовому договору?' },
        { key: 'order', label: 'Приказ / трудовая', kind: 'bool', yes: /(получил|выдали|отдали|вручили|на руках)[^.]{0,25}(приказ|трудов)|(приказ|трудов\S*)[^.]{0,25}(получил|выдали|отдали|вручили|на руках)/, no: /не (выдали|отдали|получил|дали|видел|вручили)[^.]{0,25}(приказ|трудов)|(приказ|трудов\S*)[^.]{0,30}не (выдали|отдали|видел|получил|вручили)|без приказа/, yesL: 'получены', noL: 'не получены', withDate: true, q: 'Вам выдали приказ об увольнении или трудовую книжку? Если да — какого числа?' },
        OUTCOME
      ]
    },
    consumer: {
      label: 'Потребительский спор', law: 'Закон РФ «О защите прав потребителей»', spec: 'юрист по защите прав потребителей',
      kw: [[/магазин|продав|маркетплейс|интернет-магазин|озон|wildberries|вайлдберриз/, 2], [/купил|покупк|товар|заказал/, 2], [/гарант|брак|возврат|верн(уть|ут) деньги|обмен|сервис/, 1.5], [/претензи/, 1]],
      fields: [
        { key: 'opponent', label: 'Продавец', kind: 'org', vague: /магазин|продав|маркетплейс/, q: 'Как называется магазин или продавец? Если есть чек — что в нём указано?' },
        { key: 'event_date', label: 'Дата покупки', kind: 'date', ctx: /купил|покупк|заказал|приобр/, q: 'Когда вы купили товар?' },
        { key: 'amount', label: 'Цена товара', kind: 'money', ctx: /купил|стоил|заплатил|цен|за /, q: 'Сколько стоил товар?' },
        { key: 'claim', label: 'Претензия продавцу', kind: 'bool', yes: /(отправил|написал|подал|отдал|направил)[^.]{0,20}претензи|претензи\S*[^.]{0,20}(отправил|написал|подал|направил)/, no: /не (писал|отправлял|подавал)[^.]{0,20}претензи|претензи\S* не (писал|отправлял|подавал)/, yesL: 'направлена', noL: 'не направлялась', withDate: true, q: 'Вы уже писали продавцу претензию? Если да — какого числа?' },
        OUTCOME
      ]
    },
    dtp: {
      label: 'ДТП и страховое возмещение', law: 'ГК РФ, ФЗ-40 «Об ОСАГО»', spec: 'автоюрист (ОСАГО и ущерб)',
      kw: [[/дтп|авари|въехал|врезал|столкнов|наехал/, 2.5], [/осаго|каско|страхов/, 2], [/машин|автомоб|водител|гибдд|гаи|европротокол/, 1.5], [/ремонт|виновн/, 1]],
      fields: [
        { key: 'opponent', label: 'Страховая компания', kind: 'insurer', vague: /страхов/, q: 'В какой страховой ваш полис ОСАГО или КАСКО?' },
        { key: 'event_date', label: 'Дата ДТП', kind: 'date', ctx: /дтп|авари|въехал|врезал|столкнов|наехал/, q: 'Какого числа произошло ДТП?' },
        { key: 'payout', label: 'Выплачено страховой', kind: 'money', ctx: /выплатил|выплат|перевел|перечисл/, q: 'Сколько страховая уже выплатила (если выплатила)?' },
        { key: 'amount', label: 'Оценка ущерба', kind: 'money', ctx: /ремонт|ущерб|оцен|стоит|смет/, q: 'Во сколько оценили ремонт или ущерб?' },
        { key: 'culprit', label: 'Виновник', kind: 'bool', yes: /виновни\S*[^.]{0,20}(признал|согласен)|(признал|признали)[^.]{0,15}вин/, no: /не признал|спорят о вине|вину не|оба виноват|обоюдк/, yesL: 'вина признана второй стороной', noL: 'вина оспаривается', q: 'Второй участник признал свою вину?' },
        OUTCOME
      ]
    },
    rent: {
      label: 'Арендный спор', law: 'ГК РФ, гл. 34 «Аренда»', spec: 'юрист по недвижимости',
      kw: [[/аренд|снима(ю|ем|л)|съ[её]м|наним/, 2.5], [/арендодат|хозя(ин|йка) квартир|собственник|арендатор/, 2], [/залог|депозит|выселя|съехат|коммунал/, 1.5]],
      fields: [
        { key: 'opponent', label: 'Вторая сторона', kind: 'org', vague: /хозя|собственник|арендодат|арендатор/, q: 'Кто вторая сторона: собственник-физлицо, компания или агентство?' },
        { key: 'event_date', label: 'Дата события', kind: 'date', ctx: /съехал|выселил|заключил|потребовал|отказал/, q: 'Когда произошла ситуация (выселение, отказ вернуть залог)?' },
        { key: 'amount', label: 'Сумма спора', kind: 'money', ctx: /залог|депозит|долг|аренд|не вернул/, q: 'О какой сумме идёт речь?' },
        { key: 'contract', label: 'Договор аренды', kind: 'bool', yes: /договор\S*[^.]{0,20}(есть|подписал|заключал)|по договору/, no: /без договора|договора нет|не заключал/, yesL: 'заключён', noL: 'нет письменного договора', q: 'Договор аренды заключали письменно?' },
        OUTCOME
      ]
    },
    family: {
      label: 'Семейный спор', law: 'Семейный кодекс РФ', spec: 'семейный юрист',
      kw: [[/развод|брак|супруг|муж|жена|бывш/, 2], [/алимент|реб[её]н|дет(и|ей)|опек/, 2.5], [/раздел имущ|совместн/, 1.5]],
      fields: [
        { key: 'opponent', label: 'Вторая сторона', kind: 'person', vague: /муж|жена|бывш|супруг|отец|мать/, q: 'Кем вам приходится вторая сторона (супруг, бывший супруг, родственник)?' },
        { key: 'event_date', label: 'Ключевая дата', kind: 'date', ctx: /развел|брак|разош|ушел|ушла|родил/, q: 'Когда расторгли брак или разошлись (если это было)?' },
        { key: 'children', label: 'Несовершеннолетние дети', kind: 'bool', yes: /реб[её]н|дет(и|ей)|сын|доч/, no: /детей нет|без детей/, yesL: 'есть', noL: 'нет', q: 'Есть ли общие несовершеннолетние дети?' },
        OUTCOME
      ]
    },
    corporate: {
      label: 'Корпоративный / договорной спор', law: 'ГК РФ, ФЗ-14 «Об ООО»', spec: 'корпоративный юрист',
      kw: [[/контрагент|поставк|подряд|договор поставки|акт|счет|сч[её]т-фактур/, 2], [/учредител|участник|дол(я|и) в|устав|директор общества/, 2.5], [/ооо|ао|ип /, 1], [/не оплатил|задолженност|неустойк/, 1.5]],
      fields: [
        { key: 'opponent', label: 'Контрагент', kind: 'org', vague: /контрагент|партн[её]р|компани|поставщик|покупател/, q: 'Как называется контрагент? Если знаете — ИНН или ОГРН.' },
        { key: 'event_date', label: 'Дата договора / нарушения', kind: 'date', ctx: /договор|срок оплат|должен был|поставил|подписал/, q: 'Какого числа заключён договор или наступил срок оплаты?' },
        { key: 'amount', label: 'Сумма требований', kind: 'money', ctx: /долг|задолж|не оплатил|сумм|на /, q: 'Какая сумма задолженности или требований?' },
        { key: 'contract', label: 'Письменный договор', kind: 'bool', yes: /по договору|договор\S* (№|от|поставки|подряда)/, no: /без договора|устн/, yesL: 'есть', noL: 'нет', q: 'Договор подписан письменно? Есть акты или накладные?' },
        OUTCOME
      ]
    },
    bankruptcy: {
      label: 'Банкротство и долги', law: 'ФЗ-127 «О несостоятельности (банкротстве)»', spec: 'юрист по банкротству',
      kw: [[/банкрот|несостоят/, 3], [/кредит|долг|займ|микрозайм|мфо|коллектор|пристав/, 2], [/просроч|не могу платить|платить нечем/, 1.5]],
      fields: [
        { key: 'opponent', label: 'Кредиторы', kind: 'org', vague: /банк|мфо|кредитор|коллектор/, q: 'Перед кем долги: банки, МФО, физлица? Сколько кредиторов?' },
        { key: 'amount', label: 'Общая сумма долга', kind: 'money', ctx: /долг|кредит|задолж|займ|всего/, q: 'Какая общая сумма долгов?' },
        { key: 'event_date', label: 'Начало просрочки', kind: 'date', ctx: /просроч|перестал платить|не плачу/, q: 'Когда начались просрочки?' },
        OUTCOME
      ]
    },
    inheritance: {
      label: 'Наследственный спор', law: 'ГК РФ, часть третья', spec: 'юрист по наследственным делам',
      kw: [[/наследств|наследник|завещани/, 3], [/умер|скончал|смерт/, 2], [/нотариус|квартир\S* (отца|матери|бабушк|деда)/, 1.5]],
      fields: [
        { key: 'opponent', label: 'Другие наследники', kind: 'person', vague: /брат|сестр|наследник|родствен/, q: 'Есть ли другие наследники и кто они вам?' },
        { key: 'event_date', label: 'Дата смерти наследодателя', kind: 'date', ctx: /умер|скончал|смерт/, q: 'Какого числа умер наследодатель?' },
        { key: 'will', label: 'Завещание', kind: 'bool', yes: /завещани\S* (есть|оставил)|по завещанию/, no: /без завещани|завещани\S* нет|не оставил завещ/, yesL: 'есть', noL: 'нет', q: 'Наследодатель оставил завещание?' },
        OUTCOME
      ]
    }
  };

  /* ---------- утилиты ---------- */
  const pad = n => String(n).padStart(2, '0');
  const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const ru = d => pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear();
  const money = n => n.toLocaleString('ru-RU') + ' ₽';
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const addMonths = (d, m) => { const r = new Date(d); r.setMonth(r.getMonth() + m); return r; };
  const days = (a, b) => Math.round((b - a) / 864e5);
  function monthIdx(word) {
    const w = word.toLowerCase();
    for (const k in MONTHS) if (k !== 'ма' && w.startsWith(k)) return MONTHS[k];
    return w.startsWith('ма') ? 4 : -1;
  }

  function normalize(raw) {
    return (raw || '')
      .normalize('NFC')
      .replace(/\r\n?/g, '\n')
      .replace(/[​-‍﻿]/g, '')
      .replace(/[“”„]/g, '"')
      .replace(/ /g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function detectLang(t) {
    const cyr = (t.match(/[а-яё]/gi) || []).length, lat = (t.match(/[a-z]/gi) || []).length;
    if (!cyr && !lat) return { lang: 'ru', confidence: 0.5 };
    const r = cyr / (cyr + lat);
    return r >= 0.5 ? { lang: 'ru', confidence: +Math.min(0.99, 0.5 + r / 2).toFixed(2) } : { lang: 'en', confidence: +Math.min(0.99, 1 - r / 2).toFixed(2) };
  }

  function sentences(t) {
    const out = []; let start = 0;
    const flush = end => {
      const raw = t.slice(start, end); const lead = raw.length - raw.trimStart().length; const txt = raw.trim();
      if (txt.length > 1) out.push({ text: txt, start: start + lead, end: start + lead + txt.length });
      start = end;
    };
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (c === '\n') { flush(i + 1); continue; }
      if ('.!?'.includes(c)) {
        let j = i; while (j + 1 < t.length && '.!?'.includes(t[j + 1])) j++;
        const nx = t[j + 1];
        if (nx === undefined || /\s/.test(nx)) { flush(j + 1); i = j; }
      }
    }
    flush(t.length);
    return out;
  }
  const sentenceAt = (sents, pos) => sents.find(s => pos >= s.start && pos < s.end) || sents[0];

  /* ---------- извлечение сущностей ---------- */
  function findDates(t) {
    const res = []; const now = today(); let m;
    const push = (d, i, len, conf, note) => {
      const future = d > now;
      res.push({ date: d, value: iso(d), display: ru(d), start: i, end: i + len, confidence: conf, note, future });
    };
    const reNum = /\b(\d{1,2})[./](\d{1,2})[./](\d{2,4})\b/g;
    while ((m = reNum.exec(t))) {
      let y = +m[3]; if (y < 100) y += 2000;
      const d = new Date(y, +m[2] - 1, +m[1]);
      if (d.getMonth() === +m[2] - 1) push(d, m.index, m[0].length, 0.97);
    }
    const reTxt = new RegExp('\\b(\\d{1,2})\\s+' + MONTH_RE + '(?:\\s+(\\d{4})\\s*(?:г\\.?|года)?)?', 'gi');
    while ((m = reTxt.exec(t))) {
      const mi = monthIdx(m[2]); if (mi < 0) continue;
      if (m[3]) push(new Date(+m[3], mi, +m[1]), m.index, m[0].length, 0.96);
      else {
        let d = new Date(now.getFullYear(), mi, +m[1]);
        if (d > now) d = new Date(now.getFullYear() - 1, mi, +m[1]);
        push(d, m.index, m[0].length, 0.78, 'год не указан, принят ближайший прошедший');
      }
    }
    const reRel = /(?<![а-яё])(\d+|два|две|три|пять)\s+(дн(я|ей)|недел[иью]|месяц(а|ев)?)\s+назад|(?<![а-яё])(вчера|позавчера|на прошлой неделе)(?![а-яё])/gi;
    const W = { 'два': 2, 'две': 2, 'три': 3, 'пять': 5 };
    while ((m = reRel.exec(t))) {
      const s = m[0].toLowerCase(); const d = today();
      if (s === 'вчера') d.setDate(d.getDate() - 1);
      else if (s === 'позавчера') d.setDate(d.getDate() - 2);
      else if (s.startsWith('на прошлой')) d.setDate(d.getDate() - 7);
      else {
        const n = W[m[1].toLowerCase()] || +m[1];
        if (/^дн/.test(m[2])) d.setDate(d.getDate() - n); else if (/^недел/.test(m[2])) d.setDate(d.getDate() - 7 * n); else d.setMonth(d.getMonth() - n);
      }
      push(d, m.index, m[0].length, 0.62, 'дата вычислена из «' + m[0] + '»');
    }
    const reMon = new RegExp('(?<![а-яё])в\\s+(январе|феврале|марте|апреле|мае|июне|июле|августе|сентябре|октябре|ноябре|декабре)(?:\\s+(\\d{4}))?', 'gi');
    while ((m = reMon.exec(t))) {
      const mi = monthIdx(m[1]); let y = m[2] ? +m[2] : now.getFullYear();
      let d = new Date(y, mi, 1); if (!m[2] && d > now) d = new Date(y - 1, mi, 1);
      push(d, m.index, m[0].length, 0.55, 'указан только месяц');
    }
    return res.sort((a, b) => a.start - b.start);
  }

  function findMoney(t) {
    const res = []; let m;
    const re = /(\d{1,3}(?:[  ]\d{3})+|\d+)(?:[.,](\d+))?\s*(тыс(?:\.|яч[а-я]*)?|т\.\s?р\.?|к\b|млн|миллион[а-я]*)?\s*(₽|руб(?:лей|ля|ль|\.)?|р\.|рублей)?/gi;
    while ((m = re.exec(t))) {
      const mult = m[3] ? (/млн|миллион/i.test(m[3]) ? 1e6 : 1e3) : 1;
      if (!m[3] && !m[4]) continue;
      let v = parseFloat(m[1].replace(/[  ]/g, '') + (m[2] ? '.' + m[2] : '')) * mult;
      if (!v || v < 100) continue;
      res.push({ value: Math.round(v), display: money(Math.round(v)), start: m.index, end: m.index + m[0].trimEnd().length, confidence: m[4] ? 0.96 : 0.86 });
    }
    return res;
  }

  function findOrgs(t) {
    const res = []; let m;
    const re = /(?<![А-ЯЁа-яё])(ООО|АО|ПАО|ЗАО|ОАО|НКО|ИП)\s+(«[^»\n]{2,60}»|"[^"\n]{2,60}"|[А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ]\.\s?[А-ЯЁ]\.|\s+[А-ЯЁ][а-яё]+){0,2})/g;
    while ((m = re.exec(t))) res.push({ value: m[0].replace(/"([^"]+)"/, '«$1»'), start: m.index, end: m.index + m[0].length, confidence: 0.95 });
    const reShop = /(магазин[а-я]*|сервис[а-я]*|салон[а-я]*|компани[а-я]*|банк[а-я]*|агентств[а-я]*)\s+(«[^»\n]{2,40}»|"[^"\n]{2,40}")/gi;
    while ((m = reShop.exec(t))) if (!res.some(r => m.index >= r.start && m.index < r.end)) { const stem = m[1].toLowerCase().replace(/(е|а|ом|у|и|ы|ия|ии|ию|ей)$/, ''); const nom = { 'магазин': 'Магазин', 'сервис': 'Сервис', 'салон': 'Салон', 'компан': 'Компания', 'банк': 'Банк', 'агентств': 'Агентство' }[stem] || m[1]; res.push({ value: nom + ' ' + m[2].replace(/"([^"]+)"/, '«$1»'), start: m.index, end: m.index + m[0].length, confidence: 0.9 }); }
    const reMp = /(?<![А-ЯЁа-яёA-Za-z])(Ozon|Озон|Wildberries|Вайлдберриз|Яндекс Маркет|DNS|М\.Видео|Эльдорадо|Ситилинк)(?![А-ЯЁа-яёA-Za-z])/gi;
    while ((m = reMp.exec(t))) if (!res.some(r => m.index >= r.start && m.index < r.end)) res.push({ value: m[0], start: m.index, end: m.index + m[0].length, confidence: 0.92 });
    return res.sort((a, b) => a.start - b.start);
  }

  function findIds(t) {
    const out = []; let m;
    const re = /(ИНН|ОГРН|ОГРНИП)\s*:?\s*(\d{10,15})(?!\d)/g;
    while ((m = re.exec(t))) {
      const kind = m[1], num = m[2];
      const ok = (kind === 'ИНН' && (num.length === 10 || num.length === 12)) || (kind === 'ОГРН' && num.length === 13) || (kind === 'ОГРНИП' && num.length === 15);
      out.push({ kind, value: num, valid_length: ok, start: m.index, end: m.index + m[0].length });
    }
    return out;
  }

  function findInsurer(t) {
    for (const name of INSURERS) {
      const i = t.toLowerCase().indexOf(name.toLowerCase());
      if (i >= 0) return { value: t.substr(i, name.length), start: i, end: i + name.length, confidence: 0.95 };
    }
    return null;
  }

  /* ---------- сегментация: факты и эмоции ---------- */
  function segment(t, sents) {
    const facts = [], emotions = [];
    for (const s of sents) {
      if (/\?$/.test(s.text)) continue;
      const parts = []; const re = /[^,;—–]+[,;—–]?/g; let m;
      while ((m = re.exec(s.text))) {
        const lead = m[0].length - m[0].trimStart().length;
        const txt = m[0].trim().replace(/[,;—–]$/, '').trim();
        if (txt) parts.push({ text: txt, start: s.start + m.index + lead, end: s.start + m.index + lead + txt.length });
      }
      const emo = parts.filter(p => EMOTION.test(p.text));
      emo.forEach(p => emotions.push(p));
      const factParts = parts.filter(p => !EMOTION.test(p.text) && !/^(это|просто|ну)\b/i.test(p.text) || (EMOTION.test(p.text) ? false : true));
      if (factParts.length && factParts.length !== emo.length) {
        const fp = parts.filter(p => !EMOTION.test(p.text));
        if (fp.length) facts.push({ text: fp.map(p => p.text).join(', ').replace(/^\S/, c => c.toUpperCase()), start: fp[0].start, end: fp[fp.length - 1].end, spans: fp.map(p => [p.start, p.end]) });
      }
    }
    return { facts, emotions };
  }

  /* ---------- классификация ---------- */
  function classify(t) {
    const low = t.toLowerCase(); const scores = {};
    for (const k in TYPES) {
      let s = 0; const hits = [];
      for (const [re, w] of TYPES[k].kw) {
        const m = low.match(new RegExp(re.source, 'g'));
        if (m) { s += w * Math.min(m.length, 2); hits.push(m[0]); }
      }
      scores[k] = { score: s, hits };
    }
    const ranked = Object.entries(scores).sort((a, b) => b[1].score - a[1].score);
    const [top, second] = ranked;
    const strong = top && TYPES[top[0]].kw.slice(0, 2).some(([re]) => re.test(low));
    if (!top || top[1].score === 0 || !strong) return { type: null, confidence: 0, ranked };
    const conf = Math.max(0, Math.min(0.97, 0.38 + 0.085 * top[1].score - 0.07 * second[1].score));
    return { type: top[0], confidence: +conf.toFixed(2), hits: top[1].hits, alt: second[1].score >= top[1].score * 0.5 ? second[0] : null, ranked };
  }

  const status = c => c > 0.8 ? 'ok' : c >= 0.5 ? 'uncertain' : 'missing';

  /* ---------- извлечение полей по чек-листу типа ---------- */
  function extractFields(t, typeKey, sents, ents) {
    const def = TYPES[typeKey]; const fields = {};
    const low = t.toLowerCase();
    const prov = (start, end) => ({ source: 'text', start, end, quote: t.slice(start, end) });
    const sentenceProv = s => prov(s.start, s.end);
    const usedMoney = new Set();

    for (const f of def.fields) {
      let r = null;
      if (f.kind === 'org' || f.kind === 'insurer' || f.kind === 'person') {
        const ins = f.kind === 'insurer' ? findInsurer(t) : null;
        const own = o => /(мы|наша компания|наша фирма|я —|я -|работаю в|у нас)\s*$/i.test(t.slice(Math.max(0, o.start - 20), o.start));
        const org = ins || ents.orgs.find(o => !own(o) || /работаю в/i.test(t.slice(Math.max(0, o.start - 20), o.start)) && typeKey === 'labor') || null;
        if (org) {
          r = { value: org.value, confidence: org.confidence, provenance: prov(org.start, org.end) };
          const id = ents.ids.find(x => x.kind.startsWith('ИНН') || x.kind.startsWith('ОГРН'));
          if (id && f.kind === 'org') { const near = ents.ids.filter(x => x.start >= org.start && x.start - org.end < 40); if (near.length) r.ids = near.map(x => ({ kind: x.kind, value: x.value, valid_length: x.valid_length })); }
        } else if (f.vague) {
          const m = low.match(f.vague);
          if (m) { const i = m.index; const s = sentenceAt(sents, i); r = { value: 'упомянут без названия', confidence: 0.42, provenance: prov(i, i + m[0].length), hint: 'название не указано' }; void s; }
        }
      } else if (f.kind === 'date') {
        const cands = ents.dates.map(d => ({ d, s: sentenceAt(sents, d.start) }));
        const hit = cands.find(c => f.ctx.test(c.s.text.toLowerCase())) || null;
        const pick = hit || (cands.length === 1 ? cands[0] : null);
        if (pick) {
          let c = pick.d.confidence * (hit ? 1 : 0.8);
          r = { value: pick.d.value, display: pick.d.display, confidence: +c.toFixed(2), provenance: prov(pick.d.start, pick.d.end), note: pick.d.note };
          if (pick.d.future) { r = { value: null, confidence: 0, provenance: prov(pick.d.start, pick.d.end), error: 'Дата в будущем: событие не могло произойти позже сегодняшнего дня' }; }
        }
      } else if (f.kind === 'money') {
        const cands = ents.money.filter(x => !usedMoney.has(x)).map(x => ({ x, s: sentenceAt(sents, x.start) }));
        // контекст ищем в окне вокруг суммы, а не во всём предложении
        const near = c => { const a = Math.max(c.s.start, c.x.start - 45); return t.slice(a, c.x.end + 15).toLowerCase(); };
        const hit = cands.find(c => f.ctx.test(near(c))) || null;
        const pick = hit || (cands.length === 1 && def.fields.filter(z => z.kind === 'money').length === 1 ? cands[0] : null);
        if (pick) {
          usedMoney.add(pick.x);
          r = { value: pick.x.value, display: pick.x.display, confidence: +(pick.x.confidence * (hit ? 1 : 0.75)).toFixed(2), provenance: prov(pick.x.start, pick.x.end) };
        }
      } else if (f.kind === 'bool') {
        const mn = f.no && low.match(f.no); const my = f.yes && low.match(f.yes);
        const m = mn || my;
        if (m) {
          const s = sentenceAt(sents, m.index);
          r = { value: !mn, display: mn ? f.noL : f.yesL, confidence: 0.9, provenance: prov(m.index, m.index + m[0].length) };
          const d = ents.dates.find(x => x.start >= s.start && x.end <= s.end);
          if (d && !mn && f.withDate) { r.date = d.value; r.display += ', ' + d.display; }
          void sentenceProv;
        }
      } else if (f.kind === 'outcome') {
        const s = sents.find(x => /(хочу|хотел[аи]? бы|нужно верн|прошу|добиться|верн(уть|ули)|взыскать|получить|восстановит|чтобы мне)/i.test(x.text) && !/\?$/.test(x.text));
        if (s) r = { value: s.text.replace(/[.!]+$/, ''), confidence: 0.88, provenance: sentenceProv(s) };
        else if (/что (мне )?делать|как быть|куда обращ/i.test(t)) {
          const m = t.match(/что (мне )?делать|как быть|куда обращ\S*/i);
          r = { value: 'не сформулирован (вопрос «' + m[0] + '»)', confidence: 0.3, provenance: prov(m.index, m.index + m[0].length) };
        }
      }
      const base = r || { value: null, confidence: 0, provenance: null };
      base.label = f.label; base.kind = f.kind; base.status = status(base.confidence);
      if (base.status === 'uncertain') base.tag = 'AI_UNCERTAIN';
      fields[f.key] = base;
    }
    return fields;
  }

  /* ---------- red flags и сроки ---------- */
  const ents_dates = t => findDates(t);
  function redFlags(t, typeKey, fields) {
    const low = t.toLowerCase(); const flags = []; const now = today();
    const add = (level, title, text, basis, deadline) => flags.push({ level, title, text, basis, deadline: deadline ? iso(deadline) : null, days_left: deadline ? days(now, deadline) : null });
    let m;
    const word = mm => { const tail = t.slice(mm.index + mm[0].length).match(/^[а-яёa-z]*/i)[0]; return t.substr(mm.index, mm[0].length + tail.length); };
    if ((m = low.match(/убь(ю|ет)|суицид|покончить с собой|изнасил|похитил|ребенка увез|угрожа\S* (жизни|убийств)/))) add('emergency', 'Угроза жизни или здоровью', 'В тексте есть признаки прямой угрозы. Платформа покажет номер 112 и не будет ждать завершения анкеты.', 'фраза «' + word(m) + '»');
    if ((m = low.match(/угрожа\S* (физ|распр|расправ|убий|поджог|жизн|избить|покалеч)|избил|побои|полици|уголовн|мошенни|вымогат|следовател|возбудил/))) add('high', 'Возможный уголовный аспект', 'Есть признаки, при которых нужен специалист как можно скорее, до любых самостоятельных действий.', 'фраза «' + word(m) + '»');
    if ((m = low.match(/судебн\S* приказ/))) add('high', 'Судебный приказ', 'На возражения против судебного приказа есть 10 дней с момента получения.', 'ст. 128 ГПК РФ', null);
    if ((m = low.match(/повестк|исков\S* заявлени\S* (пришл|получил)|суд назначен|заседани/))) add('high', 'Уже есть судебный процесс', 'Важны даты заседаний и сроки на отзыв.', 'фраза «' + word(m) + '»');
    if (/срочно|завтра|истекает|последний день/.test(low)) add('high', 'Пользователь указал срочность', 'Обращение помечается как срочное и уходит в начало очереди.', 'текст обращения');

    if (typeKey === 'labor') {
      const ev = fields.event_date, ord = fields.order;
      if (ord && ord.value === false) add('medium', 'Приказ и трудовая не выданы', 'Месячный срок по спорам об увольнении считается со дня вручения приказа или выдачи трудовой книжки. Пока их не выдали, срок не начался, но дату отказа стоит зафиксировать письменно.', 'ст. 392 ТК РФ');
      else if (ev && ev.value) {
        const start = ord && ord.date ? new Date(ord.date) : new Date(ev.value);
        const dl = addMonths(start, 1); const left = days(now, dl);
        if (left < 0) add('high', 'Срок по спору об увольнении мог истечь', 'Месяц со дня вручения приказа прошёл ' + (-left) + ' дн. назад. Пропущенный срок можно восстановить при уважительных причинах — это оценит юрист.', 'ст. 392 ТК РФ', dl);
        else add(left <= 14 ? 'high' : 'medium', 'Месяц на спор об увольнении', 'Осталось ' + left + ' дн. (до ' + ru(dl) + '), если считать от ' + (ord && ord.date ? 'даты вручения приказа' : 'даты увольнения') + '.', 'ст. 392 ТК РФ', dl);
      }
      if (/зарплат|заработн|расч/.test(low)) add('info', 'Год на взыскание зарплаты', 'По невыплаченной зарплате срок — один год со дня, когда её должны были выплатить.', 'ст. 392 ТК РФ, ч. 2');
      if (fields.contract && fields.contract.value === false) add('medium', 'Работа без оформления', 'Сначала понадобится доказать сами трудовые отношения: переписка, пропуска, свидетели.', 'ст. 19.1, 67 ТК РФ');
    }
    if (typeKey === 'consumer') {
      const cl = fields.claim;
      if (cl && cl.date) {
        const dl = new Date(cl.date); dl.setDate(dl.getDate() + 10); const left = days(now, dl);
        add(left < 0 ? 'medium' : 'info', left < 0 ? 'Продавец не уложился в 10 дней' : 'Срок ответа продавца', left < 0 ? '10 дней на ответ по претензии прошли ' + ru(dl) + '. С этого дня может начисляться неустойка 1% в день.' : 'Продавец должен ответить до ' + ru(dl) + '.', 'ст. 22, 23 Закона «О защите прав потребителей»', dl);
      } else if (cl && cl.value === false) add('info', 'Претензия ещё не направлена', 'Дата претензии запускает 10-дневный срок продавца — её стоит отправить письменно, с отметкой о получении.', 'ст. 22 Закона «О защите прав потребителей»');
    }
    if (typeKey === 'dtp') {
      if (/травм|больниц|скор(ая|ую)|перелом|сотряс|пострадал/.test(low)) add('high', 'Есть пострадавшие', 'Вред здоровью меняет порядок дела (возможна административная или уголовная ответственность виновника) и требует медицинских документов.', 'ст. 12.24 КоАП РФ, ст. 264 УК РФ');
      if (/осаго|страхов/.test(low)) add('info', 'Досудебный порядок по ОСАГО', 'Прежде чем идти в суд со страховой, нужно направить претензию и обратиться к финансовому уполномоченному.', 'ФЗ-123 «Об уполномоченном по правам потребителей финансовых услуг»');
      const pay = fields.payout, dmg = fields.amount;
      if (pay && dmg && pay.value && dmg.value && dmg.value > pay.value) add('info', 'Разница между выплатой и ущербом', 'Недоплата ' + money(dmg.value - pay.value) + ' по данным из текста.', 'расчёт по суммам из обращения');
    }
    if (typeKey === 'corporate') {
      const dm = ents_dates(t).find(d => /срок оплат|должен был (оплатить|заплатить)|оплатить до/i.test(t.slice(Math.max(0, d.start - 40), d.start)));
      add('info', 'Претензионный порядок', 'До иска в арбитражный суд нужна претензия контрагенту и 30 календарных дней на ответ.', 'ч. 5 ст. 4 АПК РФ');
      if (dm) { const dl = addMonths(dm.date, 36); add('info', 'Исковая давность', 'Три года с даты, когда оплата должна была поступить (' + dm.display + '), то есть до ' + ru(dl) + '.', 'ст. 196, 200 ГК РФ', dl); }
    }
    if (typeKey === 'bankruptcy' && fields.amount && fields.amount.value >= 500000) add('medium', 'Признаки банкротства', 'Долг от 500 000 ₽ при невозможности платить — порог, при котором закон обязывает гражданина подать заявление.', 'ст. 213.4 ФЗ-127');
    if (typeKey === 'inheritance' && fields.event_date && fields.event_date.value) {
      const dl = addMonths(new Date(fields.event_date.value), 6); const left = days(now, dl);
      add(left < 30 ? 'high' : 'medium', 'Шесть месяцев на принятие наследства', left < 0 ? 'Срок истёк ' + ru(dl) + ', восстановление — только через суд.' : 'Осталось ' + left + ' дн., до ' + ru(dl) + '.', 'ст. 1154 ГК РФ', dl);
    }
    return flags;
  }

  /* ---------- граница юридического совета ---------- */
  const BOUNDARY = [
    [/вам следует подать в суд/gi, 'Вы можете рассмотреть вариант обращения в суд'],
    [/(вам|вы) (обязательно )?(нужно|необходимо|следует|должны) (подать|обратиться|написать|потребовать)/gi, (m, a, b, c, d) => (a[0] === 'В' ? 'Вы' : 'вы') + ' можете ' + d],
    [/вы (точно |обязательно )?выиграете( дело| суд)?/gi, 'исход дела зависит от обстоятельств и доказательств'],
    [/суд (точно |обязательно )?встанет на вашу сторону/gi, 'исход зависит от оценки суда'],
    [/это (явно |точно )?незаконно/gi, 'здесь могут быть основания для проверки юристом'],
    [/работодатель (виноват|нарушил закон)/gi, 'действия работодателя может оценить юрист']
  ];
  function legalBoundary(text) {
    const hits = []; let out = text;
    for (const [re, rep] of BOUNDARY) {
      out = out.replace(re, function () {
        const repl = typeof rep === 'function' ? rep.apply(null, arguments) : rep;
        hits.push({ from: arguments[0], to: repl }); return repl;
      });
    }
    out = out.replace(/(^|[.!?]\s+)([а-яё])/g, (m, a, b) => a + b.toUpperCase());
    return { text: out, replacements: hits };
  }

  /* ---------- маршрутизация ---------- */
  function routing(st) {
    const def = st.case.type ? TYPES[st.case.type] : null;
    const missing = Object.values(st.fields).filter(f => f.status === 'missing').length;
    const lvl = c => c > 0.8 ? 'high' : c >= 0.5 ? 'medium' : 'low';
    const routes = [];
    const emergency = st.redFlags.find(f => f.level === 'emergency');
    const crim = st.redFlags.find(f => f.level === 'high' && /уголов/i.test(f.title));
    if (emergency) routes.push({ route: 'emergency', title: 'Экстренная служба 112', confidence_level: 'high', raw: 'Вам необходимо обратиться в экстренную службу 112 прямо сейчас. Остальные шаги можно сделать позже.', alternatives: [] });
    if (!def) {
      routes.push({ route: 'lawyer', title: 'Консультация юриста общей практики', specialization: 'юрист общей практики', confidence_level: 'low', raw: 'Тип ситуации определить не удалось, поэтому маршрут — к юристу общей практики, он уточнит детали.', alternatives: [] });
    } else {
      const caseC = st.case.confidence * (missing ? Math.max(0.6, 1 - 0.12 * missing) : 1) * (crim ? 0.9 : 1);
      const why = {
        labor: 'Ситуация относится к трудовому спору: увольнение и невыплата зарплаты регулируются Трудовым кодексом. Вам следует подать в суд или в трудовую инспекцию, работодатель нарушил закон.',
        consumer: 'Ситуация относится к спору с продавцом: возврат денег за товар с недостатком регулируется законом о защите прав потребителей. Вы точно выиграете, это явно незаконно.',
        dtp: 'Спор о размере страхового возмещения после ДТП. Вам необходимо обратиться к финансовому уполномоченному, суд встанет на вашу сторону.',
        rent: 'Спор между арендатором и арендодателем регулируется главой 34 ГК РФ. Вам следует подать в суд.',
        family: 'Ситуация относится к семейному праву. Вам нужно подать на алименты.',
        corporate: 'Спор между организациями по договору. Вам следует подать в суд, вы выиграете дело.',
        bankruptcy: 'Ситуация с долгами, где возможна процедура банкротства гражданина. Вам нужно подать заявление.',
        inheritance: 'Наследственный вопрос: важны сроки принятия наследства и состав наследников. Вам необходимо обратиться к нотариусу.'
      }[st.case.type];
      const alts = [];
      if (['labor', 'family', 'rent', 'corporate', 'consumer', 'inheritance'].includes(st.case.type)) alts.push({ route: 'mediation', title: 'Медиация', note: 'если важно договориться и сохранить отношения (ФЗ-193 «Об альтернативной процедуре урегулирования споров»)' });
      const selfHelp = { labor: 'шаблон заявления в Государственную инспекцию труда и запроса документов у работодателя', consumer: 'шаблон претензии продавцу с требованием вернуть деньги', dtp: 'шаблон претензии страховой и обращения к финансовому уполномоченному', rent: 'шаблон претензии о возврате залога', corporate: 'шаблон претензии контрагенту', bankruptcy: 'проверка права на внесудебное банкротство через МФЦ', inheritance: 'перечень документов для нотариуса', family: 'шаблон соглашения об уплате алиментов' }[st.case.type];
      if (selfHelp) alts.push({ route: 'self_help', title: 'Самопомощь', note: selfHelp });
      if (st.case.type === 'dtp') alts.push({ route: 'insurance_docs', title: 'Документы для страховой', note: 'список документов и проверка комплекта перед подачей' });
      routes.push({ route: 'lawyer', title: 'Обратиться к юристу', specialization: def.spec, confidence_level: lvl(caseC), confidence: +caseC.toFixed(2), raw: why, alternatives: alts });
      if (crim) routes.push({ route: 'lawyer_urgent', title: 'Срочная консультация адвоката', specialization: 'адвокат по уголовным делам', confidence_level: 'medium', raw: 'В обращении есть признаки уголовного аспекта, поэтому вам нужно обратиться к адвокату до любых самостоятельных действий.', alternatives: [] });
    }
    let replacements = [];
    for (const r of routes) {
      const b = legalBoundary(r.raw); r.rationale = b.text; r.blocked = b.replacements; replacements = replacements.concat(b.replacements);
    }
    return { routes, replacements };
  }

  /* ---------- уточняющие вопросы ---------- */
  function questions(st, max) {
    if (!st.case.type && st.asked.case_type) return [];
    if (!st.case.type) return [{ key: 'case_type', label: 'Тип ситуации', q: 'О чём ваша ситуация? Выберите ближе всего.', kind: 'choice', options: Object.entries(TYPES).map(([k, v]) => ({ value: k, label: v.label })).concat([{ value: 'other', label: 'Другое' }]) }];
    const def = TYPES[st.case.type];
    const list = [];
    for (const f of def.fields) {
      const v = st.fields[f.key]; if (!v || st.asked[f.key]) continue;
      if (v.status === 'missing') list.push({ key: f.key, label: f.label, q: f.q, kind: f.kind, reason: v.error ? v.error : v.hint ? 'Упомянуто, но ' + v.hint : 'Не найдено в тексте' });
    }
    for (const f of def.fields) {
      const v = st.fields[f.key]; if (!v || st.asked[f.key]) continue;
      if (v.status === 'uncertain') list.push({ key: f.key, label: f.label, q: 'Уточните: ' + f.label[0].toLowerCase() + f.label.slice(1) + ' — ' + (v.display || v.value) + '?' + (v.note ? ' (' + v.note + ')' : ''), kind: f.kind, confirm: true, reason: '[AI_UNCERTAIN] уверенность ' + v.confidence.toFixed(2) });
    }
    return list.slice(0, max || 3);
  }

  function parseAnswer(kind, ans) {
    const a = normalize(ans); if (!a) return null;
    const yes = /^(да|ага|есть|верно|так|конечно|получил|выдали|официально|подписан|признал)/i.test(a);
    const no = /^(нет|не |неофиц|без)/i.test(a);
    if (kind === 'date') {
      const d = findDates(a)[0];
      if (d && !d.future) return { value: d.value, display: d.display, confidence: d.note ? 0.85 : 1 };
      if (d && d.future) return { error: 'Дата в будущем' };
      return null;
    }
    if (kind === 'money') {
      const m = findMoney(a)[0] || (a.match(/^\d[\d\s]*$/) ? { value: +a.replace(/\s/g, ''), display: money(+a.replace(/\s/g, '')) } : null);
      return m ? { value: m.value, display: m.display, confidence: 1 } : null;
    }
    if (kind === 'bool') {
      if (!yes && !no) return null;
      const d = findDates(a)[0];
      return { value: yes, display: (yes ? 'да' : 'нет') + (d ? ', ' + d.display : ''), date: d && yes ? d.value : undefined, confidence: 1 };
    }
    return { value: a, display: a, confidence: 1 };
  }

  function applyAnswer(st, q, ans, round) {
    if (q.key === 'case_type') {
      st.asked.case_type = true;
      if (!TYPES[ans]) { st.case = { type: null, label: 'другое', confidence: 1, source: 'user_choice' }; st.edits.push({ key: 'case_type', via: 'user_choice', after: 'other' }); return true; }
      return reanalyze(st, ans);
    }
    const f = st.fields[q.key]; const before = { value: f.value, confidence: f.confidence, status: f.status };
    if (q.confirm && /^(да|верно|так|ага|подтверждаю)\b/i.test(ans.trim())) {
      Object.assign(f, { confidence: 1, status: 'ok', tag: undefined, provenance: Object.assign({}, f.provenance, { confirmed_by_user: true }) });
    } else {
      const p = parseAnswer(q.kind, ans);
      if (!p || p.error) { st.log.push({ t: 'answer_unparsed', key: q.key, answer: ans, error: p && p.error }); return false; }
      const lbl = f.label;
      for (const k of ['display', 'date', 'note', 'error', 'hint', 'tag']) delete f[k];
      Object.assign(f, p, { label: lbl, status: status(p.confidence), provenance: { source: 'user_answer', round, quote: ans } });
      if (f.status === 'uncertain') f.tag = 'AI_UNCERTAIN';
    }
    st.edits.push({ key: q.key, round, before, after: { value: f.value, confidence: f.confidence, status: f.status }, via: 'clarification' });
    st.redFlags = redFlags(st.text + '\n' + st.answersText(), st.case.type, st.fields);
    return true;
  }

  function reanalyze(st, typeKey) {
    st.case = { type: typeKey, label: TYPES[typeKey].label, confidence: 1, source: 'user_choice' };
    st.fields = extractFields(st.text, typeKey, st.sents, st.ents);
    st.redFlags = redFlags(st.text, typeKey, st.fields);
    st.edits.push({ key: 'case_type', via: 'user_choice', after: typeKey });
    return true;
  }

  /* ---------- главный вход ---------- */
  function analyze(raw, meta) {
    const t0 = performance.now(); const trace = [];
    const step = (name, fn) => { const a = performance.now(); const r = fn(); trace.push({ name, ms: +(performance.now() - a).toFixed(2) }); return r; };
    const text = step('Нормализация (UTF-8, пробелы, кавычки)', () => normalize(raw).slice(0, 50000));
    const lang = step('Определение языка', () => detectLang(text));
    const sents = step('Разбиение на предложения', () => sentences(text));
    const seg = step('Факты и эмоции', () => segment(text, sents));
    const ents = step('Сущности: даты, суммы, организации, ИНН/ОГРН', () => ({ dates: findDates(text), money: findMoney(text), orgs: findOrgs(text), ids: findIds(text) }));
    const cls = step('Классификация типа дела', () => classify(text));
    const fields = step('Заполнение карточки по чек-листу', () => cls.type ? extractFields(text, cls.type, sents, ents) : {});
    const flags = step('Red flags и сроки', () => redFlags(text, cls.type, fields));
    const answers = [];
    const st = {
      text, meta: Object.assign({ user_type: 'individual', channel: 'web' }, meta || {}), lang, sents, ents, facts: seg.facts, emotions: seg.emotions,
      case: cls.type ? { type: cls.type, label: TYPES[cls.type].label, law: TYPES[cls.type].law, confidence: cls.confidence, keywords: cls.hits, alternative: cls.alt ? TYPES[cls.alt].label : null } : { type: null, label: 'не определён', confidence: 0 },
      fields, redFlags: flags, asked: {}, rounds: 0, edits: [], log: [], trace, answers,
      answersText: () => answers.join('\n')
    };
    if (st.case.type) st.case.status = status(st.case.confidence);
    st.processing_ms = +(performance.now() - t0).toFixed(1);
    return st;
  }

  /* ---------- Matter Draft + схема ---------- */
  const SCHEMA = {
    $schema: 'https://json-schema.org/draft/2020-12/schema', $id: 'matter-draft/1.0', type: 'object',
    required: ['schema_version', 'matter_id', 'created_at', 'channel', 'user_type', 'language', 'case', 'facts', 'fields', 'red_flags', 'missing_fields', 'incomplete_data', 'routing', 'disclaimer', 'audit'],
    properties: {
      schema_version: { type: 'string', const: SCHEMA_VERSION },
      matter_id: { type: 'string', pattern: '^MD-\\d{4}-[0-9A-F]{6}$' },
      created_at: { type: 'string', format: 'date-time' },
      channel: { type: 'string', enum: ['web', 'mobile', 'api', 'telegram', 'voice_call'] },
      user_type: { type: 'string', enum: ['individual', 'company'] },
      language: { type: 'string', enum: ['ru', 'en'] },
      case: { type: 'object', required: ['type', 'confidence'], properties: { type: { type: ['string', 'null'], enum: [null].concat(Object.keys(TYPES)) }, confidence: { type: 'number', minimum: 0, maximum: 1 } } },
      facts: { type: 'array', items: { type: 'object', required: ['text', 'provenance'], properties: { text: { type: 'string' }, provenance: { type: 'object', required: ['start', 'end'] } } } },
      fields: { type: 'object', additionalProperties: { type: 'object', required: ['confidence', 'status'], properties: { confidence: { type: 'number', minimum: 0, maximum: 1 }, status: { type: 'string', enum: ['ok', 'uncertain', 'missing'] }, value_date: { type: 'string', format: 'date', notFuture: true } } } },
      red_flags: { type: 'array', items: { type: 'object', required: ['level', 'title'], properties: { level: { type: 'string', enum: ['emergency', 'high', 'medium', 'info'] } } } },
      missing_fields: { type: 'array', items: { type: 'string' } },
      incomplete_data: { type: 'boolean' },
      routing: { type: 'object', required: ['recommended', 'user_confirmed'], properties: { user_confirmed: { type: 'boolean' } } },
      disclaimer: { type: 'string', const: DISCLAIMER },
      audit: { type: 'object', required: ['input_sha256', 'prompt_version', 'model', 'processing_ms'], properties: { input_sha256: { type: 'string', pattern: '^[0-9a-f]{64}$' } } }
    }
  };

  function validate(obj, schema, path) {
    path = path || '$'; const errs = [];
    const typeOf = v => v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v;
    const t = typeOf(obj);
    if (schema.type) { const ts = [].concat(schema.type); if (!ts.some(x => x === t || (x === 'number' && t === 'integer'))) errs.push(path + ': ожидался ' + ts.join('|') + ', получен ' + t); }
    if (schema.const !== undefined && obj !== schema.const) errs.push(path + ': значение должно быть «' + schema.const + '»');
    if (schema.enum && !schema.enum.includes(obj)) errs.push(path + ': недопустимое значение ' + JSON.stringify(obj));
    if (schema.pattern && typeof obj === 'string' && !new RegExp(schema.pattern).test(obj)) errs.push(path + ': не соответствует шаблону');
    if (typeof obj === 'number') { if (schema.minimum !== undefined && obj < schema.minimum) errs.push(path + ' < ' + schema.minimum); if (schema.maximum !== undefined && obj > schema.maximum) errs.push(path + ' > ' + schema.maximum); }
    if (schema.format === 'date' && typeof obj === 'string') { if (!/^\d{4}-\d{2}-\d{2}$/.test(obj)) errs.push(path + ': не дата'); else if (schema.notFuture && new Date(obj) > today()) errs.push(path + ': дата события в будущем'); }
    if (schema.format === 'date-time' && typeof obj === 'string' && isNaN(Date.parse(obj))) errs.push(path + ': не date-time');
    if (t === 'object') {
      (schema.required || []).forEach(k => { if (!(k in obj)) errs.push(path + '.' + k + ': обязательное поле отсутствует'); });
      for (const k in obj) {
        const ps = schema.properties && schema.properties[k] || (schema.additionalProperties && typeof schema.additionalProperties === 'object' ? schema.additionalProperties : null);
        if (ps) errs.push.apply(errs, validate(obj[k], ps, path + '.' + k));
      }
    }
    if (t === 'array' && schema.items) obj.forEach((x, i) => errs.push.apply(errs, validate(x, schema.items, path + '[' + i + ']')));
    return errs;
  }

  async function sha256(s) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function buildDraft(st, route, confirmed) {
    const inputHash = await sha256(st.text + (st.answers.length ? '\n--answers--\n' + st.answers.join('\n') : ''));
    const fields = {};
    for (const k in st.fields) {
      const f = st.fields[k];
      fields[k] = { label: f.label, value: f.value === undefined ? null : f.value, confidence: +(+f.confidence).toFixed(2), status: f.status };
      if (f.kind === 'date' && f.value) fields[k].value_date = f.value;
      if (f.tag) fields[k].tag = f.tag;
      if (f.ids) fields[k].identifiers = f.ids;
      if (f.date) fields[k].date = f.date;
      if (f.error) fields[k].validation_error = f.error;
      fields[k].provenance = f.provenance ? (f.provenance.source === 'text' ? { source: 'text', start: f.provenance.start, end: f.provenance.end, quote: f.provenance.quote, confirmed_by_user: !!f.provenance.confirmed_by_user } : f.provenance) : null;
    }
    const missing = Object.keys(fields).filter(k => fields[k].status === 'missing');
    const r = routing(st);
    const rec = route || r.routes[0];
    const draft = {
      schema_version: SCHEMA_VERSION,
      matter_id: 'MD-' + new Date().getFullYear() + '-' + inputHash.slice(0, 6).toUpperCase(),
      created_at: new Date().toISOString(),
      channel: st.meta.channel, user_type: st.meta.user_type, language: st.lang.lang,
      case: { type: st.case.type, label: st.case.label, applicable_law: st.case.law || null, confidence: st.case.confidence, source: st.case.source || 'model' },
      facts: st.facts.map(f => ({ text: f.text, provenance: { start: f.start, end: f.end } })),
      excluded_emotional_statements: st.emotions.map(e => ({ text: e.text, provenance: { start: e.start, end: e.end } })),
      fields,
      red_flags: st.redFlags.map(f => ({ level: f.level, title: f.title, basis: f.basis, deadline: f.deadline })),
      missing_fields: missing,
      incomplete_data: missing.length > 0,
      clarification_rounds: st.rounds,
      routing: {
        recommended: { route: rec.route, specialization: rec.specialization || null, confidence_level: rec.confidence_level, rationale: rec.rationale },
        alternatives: (rec.alternatives || []).map(a => ({ route: a.route, note: a.note })),
        user_confirmed: !!confirmed
      },
      user_edits: st.edits,
      disclaimer: DISCLAIMER,
      audit: {
        input_sha256: inputHash,
        prompt_version: PROMPT_VERSION,
        model: 'rules-ru/1.0 (браузер) · в рабочей версии YandexGPT 5 Pro, Yandex Cloud ru-central1',
        processing_ms: st.processing_ms,
        legal_boundary_replacements: r.replacements.length
      }
    };
    draft.audit.output_sha256 = await sha256(JSON.stringify(Object.assign({}, draft, { audit: Object.assign({}, draft.audit, { output_sha256: undefined }) })));
    return { draft, errors: validate(draft, SCHEMA) };
  }

  function refreshFlags(st) { st.redFlags = redFlags(st.text + '\n' + st.answers.join('\n'), st.case.type, st.fields); return st.redFlags; }

  window.Intake = { refreshFlags, analyze, questions, applyAnswer, routing, legalBoundary, buildDraft, validate, sha256, SCHEMA, TYPES, DISCLAIMER, PROMPT_VERSION, findDates, findMoney, findOrgs, normalize, status, util: { ru, iso, money } };
})();

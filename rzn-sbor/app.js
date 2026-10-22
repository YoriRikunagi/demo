/* Сборщик МИ · Росздравнадзор — интерфейс оператора */
(function () {
  'use strict';

  /* ---------- утилиты ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtD = (iso) => { if (!iso) return '—'; const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}.${m[2]}.${m[1]}` : String(iso); };
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const pl = (n, a, b, c) => { const m = Math.abs(n) % 100, k = m % 10; return m > 10 && m < 20 ? c : k > 1 && k < 5 ? b : k === 1 ? a : c; };
  const store = {
    get(k, d) { try { const v = localStorage.getItem('rzn.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('rzn.' + k, JSON.stringify(v)); } catch (e) { /* хранилище недоступно */ } }
  };
  let toastT;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600); }

  const I = {
    folder: '<path d="M2 5.5A1.5 1.5 0 0 1 3.5 4h4l1.5 1.5h7.5A1.5 1.5 0 0 1 18 7v8.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 2 15.5z" fill="none" stroke="currentColor" stroke-width="1.4"/>',
    play: '<path d="M6 4.5v11l9-5.5z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>',
    table: '<rect x="2.5" y="3.5" width="15" height="13" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M2.5 8h15M2.5 12.3h15M8 8v8.5" stroke="currentColor" stroke-width="1.4"/>',
    box: '<path d="M10 2.5l7 3.5v8l-7 3.5-7-3.5V6z M3 6l7 3.5L17 6M10 9.5v8" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>',
    book: '<path d="M4 3.5h9.5a2 2 0 0 1 2 2v11H6a2 2 0 0 1-2-2zM4 14.5a2 2 0 0 1 2-2h9.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M7.5 7h5" stroke="currentColor" stroke-width="1.4"/>',
    bell: '<path d="M10 3a4.5 4.5 0 0 0-4.5 4.5V11L4 14h12l-1.5-3V7.5A4.5 4.5 0 0 0 10 3zM8 16a2 2 0 0 0 4 0" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>',
    gear: '<circle cx="10" cy="10" r="2.6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
    plus: '<path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
    down: '<path d="M10 3v10M5.5 8.5L10 13l4.5-4.5M4 16.5h12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
    close: '<path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
    check: '<path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    pdf: '<path d="M5 2.5h7l4 4v11H5z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M12 2.5v4h4" fill="none" stroke="currentColor" stroke-width="1.4"/><text x="10.5" y="15" font-size="4.6" font-weight="700" text-anchor="middle" fill="currentColor" font-family="Arial">PDF</text>',
    xls: '<rect x="3" y="3" width="14" height="14" rx="2" fill="currentColor"/><path d="M7 7l6 6M13 7l-6 6" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>',
    ext: '<path d="M11 3.5h5.5V9M16.5 3.5L9 11M14 12v4.5H3.5V6H8" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>',
    edit: '<path d="M12.5 4l3.5 3.5L7.5 16H4v-3.5z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>',
    lock: '<rect x="4.5" y="9" width="11" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9" fill="none" stroke="currentColor" stroke-width="1.4"/>',
    chip: '<rect x="5" y="5" width="10" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 2.5v2.5M12 2.5v2.5M8 15v2.5M12 15v2.5M2.5 8h2.5M2.5 12h2.5M15 8h2.5M15 12h2.5" stroke="currentColor" stroke-width="1.4"/>',
    scan: '<path d="M3 7V4h3M14 4h3v3M17 13v3h-3M6 16H3v-3M5.5 10h9" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
    refresh: '<path d="M16 10a6 6 0 1 1-1.8-4.3M16 3.5v3.2h-3.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
    info: '<circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M10 9v5M10 6.3v.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'
  };
  const ico = (n, cls) => `<svg viewBox="0 0 20 20"${cls ? ` class="${cls}"` : ''} aria-hidden="true">${I[n]}</svg>`;

  const ST = { ok: 'Найдено', no_info: 'Нет информации', needs_review: 'На проверку', from_kb: 'Из базы знаний', edited: 'Исправлено оператором' };
  const stOf = (v) => (v && ST[v.status] ? v.status : (v && v.value && v.value !== 'Нет информации' ? 'ok' : 'no_info'));
  const DOC_T = { instruction: 'Инструкция', passport: 'Паспорт', labeling: 'Маркировка', photo: 'Фото', card: 'Карточка реестра', other: 'Документ' };

  /* ---------- состояние ---------- */
  let D = null;
  const S = {
    edits: store.get('edits', {}),        // {deviceId: {field: {value, status:'edited', date}}}
    confirmed: store.get('confirmed', {}),// {deviceId|field: date}
    kb: store.get('kb', []),              // добавленные в сессии примеры
    projects: store.get('projects', []),
    settings: Object.assign({ daily: true, ocr: true, ocrLang: 'rus+eng', folder: 'C:\\Users\\Оператор\\Documents\\Сборщик МИ\\Микроальбумин', threads: 4, keep: true, srcCols: true }, store.get('settings', {})),
    flt: { q: '', from: '', to: '', st: 'all' },
    sel: null,
    run: null,
    lastCheck: store.get('lastCheck', null)
  };

  function cellOf(dev, key) {
    const e = S.edits[dev.id] && S.edits[dev.id][key];
    const base = (dev.values && dev.values[key]) || { value: 'Нет информации', status: 'no_info' };
    return e ? Object.assign({}, base, e, { original: base.value }) : base;
  }
  const devById = (id) => D.devices.find((d) => String(d.id) === String(id));
  const fieldTitle = (k) => (D.fields.find((f) => f.key === k) || { title: k }).title;
  const kbAll = () => (D.knowledgeBase || []).map((x) => Object.assign({ fromData: true }, x)).concat(S.kb);

  /* ---------- навигация ---------- */
  const NAV = [
    ['projects', 'Проекты', 'folder', 'Проекты'], ['run', 'Анализ', 'play', 'Анализ'], ['results', 'Результаты', 'table', 'Таблица'], ['devices', 'Изделия', 'box', 'Изделия'],
    ['kb', 'База знаний', 'book', 'База'], ['updates', 'Обновления', 'bell', 'Новое'], ['settings', 'Настройки', 'gear', 'Опции']
  ];
  function renderNav(cur) {
    const upd = (D.updates || []).length;
    $('#nav').innerHTML = NAV.map(([id, t, ic, sh], i) =>
      (i === 4 ? '<div class="sep"></div>' : '') + (i === 6 ? '<div class="grow"></div>' : '') +
      `<a href="#${id}" class="${cur === id ? 'on' : ''}" title="${t}">${ico(ic)}<span class="lf">${t}</span><span class="ls">${sh}</span>${id === 'updates' && upd ? `<em class="badge">${upd}</em>` : ''}</a>`).join('');
  }
  function route() {
    const h = (location.hash || '#projects').slice(1).split('/');
    let page = h[0] || 'projects';
    const map = { projects: pProjects, wizard: pWizard, run: pRun, results: pResults, devices: pDevices, device: pDevice, kb: pKb, updates: pUpdates, settings: pSettings };
    if (!map[page]) page = 'projects';
    if (page !== 'results') closePanel();
    renderNav(page === 'wizard' ? 'projects' : page === 'device' ? 'devices' : page);
    const m = $('#main');
    m.innerHTML = '';
    map[page](m, h[1]);
    m.scrollTop = 0;
  }

  function status() {
    const p = D.project;
    $('#tbProject').textContent = p.name || '';
    $('#statusbar').innerHTML = `<span><i class="dot"></i>Модель загружена: ${esc(p.model || '—')}</span><span class="hide-m">Код вида ${esc(p.kindCode)}</span><span class="hide-m">Изделий: ${D.devices.length}</span><span class="hide-m">Реестр: elk.roszdravnadzor.gov.ru</span>`;
  }

  /* ---------- 1. Проекты ---------- */
  function pProjects(m) {
    const p = D.project, st = D.stats || {};
    const rows = [{ name: p.name, kindCode: p.kindCode, kindName: p.kindName, dateFrom: p.dateFrom, dateTo: p.dateTo, createdAt: p.createdAt, main: true, template: p.excelTemplate }].concat(S.projects.slice().reverse());
    m.innerHTML = `<div class="page">
      <div class="ph"><div><h1>Проекты</h1><div class="sub">Код вида МИ + Excel-шаблон → заполненный Excel с источниками</div></div>
        <div class="acts"><a class="btn pri" href="#wizard">${ico('plus')}Новый проект</a></div></div>
      <div class="kpis">
        <div class="kpi"><b>${p.totalFound != null ? p.totalFound : D.devices.length}</b><span>РУ по коду ${esc(p.kindCode)}</span></div>
        <div class="kpi"><b>${st.devices != null ? st.devices : D.devices.length}</b><span>изделий в работе</span></div>
        <div class="kpi"><b>${st.pdfPages != null ? st.pdfPages : '—'}</b><span>страниц PDF прочитано</span></div>
        <div class="kpi"><b>${st.filled != null ? st.filled : '—'}</b><span>значений с цитатой</span></div>
        <div class="kpi"><b>${st.noInfo != null ? st.noInfo : '—'}</b><span>«Нет информации»</span></div>
      </div>
      <div class="card">${rows.map((r, i) => `
        <div class="proj"><div class="pi">${ico('folder')}</div>
          <div class="pb"><div class="pn">${esc(r.name)}</div>
            <div class="meta"><span>Код вида <b>${esc(r.kindCode)}</b> · ${esc(r.kindName || '')}</span>
              <span>Версии: с ${fmtD(r.dateFrom)}${r.dateTo ? ' по ' + fmtD(r.dateTo) : ' по сегодня'}</span>
              <span>Шаблон: ${esc(r.template || '—')}</span><span>Создан ${fmtD(r.createdAt)}</span></div>
            <div class="meta">${r.main ? `<span class="st ok">Анализ завершён</span><span>${st.seconds ? Math.round(st.seconds / 60) + ' мин' : ''}</span>` : `<span class="st needs_review">Готов к запуску</span>`}
              ${S.settings.daily ? '<span class="pill acc">ежедневная проверка 09:00</span>' : ''}</div></div>
          <div class="pa">${r.main ? `<a class="btn sm pri" href="#results">${ico('table')}Результаты</a><a class="btn sm" href="result.xlsx" download>${ico('down')}Excel</a><button class="btn sm sub" data-rerun="${i}">${ico('refresh')}Перезапустить</button>`
              : `<button class="btn sm pri" data-rerun="${i}">${ico('play')}Запустить</button>`}</div>
        </div>`).join('')}</div>
    </div>`;
    $$('[data-rerun]', m).forEach((b) => b.onclick = () => { const r = rows[+b.dataset.rerun]; startRun(r.name); });
  }

  /* ---------- мастер ---------- */
  function pWizard(m) {
    const p = D.project;
    m.innerHTML = `<div class="page" style="max-width:860px">
      <div class="ph"><div><h1>Новый проект</h1><div class="sub">Четыре шага — дальше программа всё сделает сама</div></div></div>
      <form class="wz" id="wz" autocomplete="off">
        <div class="card"><h3><i>1</i>Код вида медицинского изделия</h3>
          <div class="grid g2"><label class="f"><span>Название проекта</span><input class="inp" name="name" value="${esc(p.kindName ? p.kindName.split(',')[0] : 'Новый проект')} — ${fmtD(today())}"></label>
          <label class="f"><span>Код вида (НКМИ РФ)</span><input class="inp" name="code" value="${esc(p.kindCode)}" inputmode="numeric" list="kinds"></label></div>
          <datalist id="kinds"><option value="${esc(p.kindCode)}">${esc(p.kindName)}</option></datalist>
          <div class="hint" id="kindHint"></div></div>
        <div class="card"><h3><i>2</i>Excel-шаблон</h3>
          <label class="drop"><input type="file" name="xls" accept=".xlsx,.xls,.xlsm">${ico('xls')}
            <div><b id="fname">${esc(p.excelTemplate || 'Выберите файл .xlsx')}</b><div class="small muted">Существующие значения не затираются, заполняются только пустые ячейки</div></div></label>
          <table class="map"><thead><tr><th>Колонка в шаблоне</th><th>Поле</th><th class="hide-m">Источник рядом</th></tr></thead><tbody>
            ${D.fields.map((f, i) => `<tr><td>${String.fromCharCode(67 + i)} · ${esc(f.title)}</td><td><select class="inp" data-map="${esc(f.key)}">${D.fields.map((g) => `<option value="${esc(g.key)}"${g.key === f.key ? ' selected' : ''}>${esc(g.title)}</option>`).join('')}<option value="">— не заполнять —</option></select></td><td class="hide-m"><span class="pill">${String.fromCharCode(67 + D.fields.length + i)} · Источник</span></td></tr>`).join('')}
          </tbody></table></div>
        <div class="card"><h3><i>3</i>Период версий РУ / ВИРД</h3>
          <div class="row"><label class="f"><span>С даты</span><input class="inp" type="date" name="from" value="${esc(p.dateFrom || '')}"></label>
          <label class="f"><span>По дату</span><input class="inp" type="date" name="to" value="${esc(p.dateTo || '')}"></label></div>
          <div class="small muted" style="margin-top:8px">Пустое «по» — до сегодняшнего дня. Версии вне периода в анализ не попадут.</div></div>
        <div class="card"><h3><i>4</i>Какие поля извлекать</h3>
          <div class="fchips">${D.fields.map((f) => `<label class="chk"><input type="checkbox" name="f" value="${esc(f.key)}" checked>${esc(f.title)}</label>`).join('')}</div>
          <div class="row" style="margin-top:12px"><label class="chk"><input type="checkbox" checked disabled>Только карточка и инструкция этого изделия; без цитаты — «Нет информации»</label></div></div>
        <div class="row" style="justify-content:flex-end"><a class="btn" href="#projects">Отмена</a><button class="btn pri" type="submit">${ico('play')}Запустить анализ</button></div>
      </form></div>`;
    const f = $('#wz', m);
    const hint = () => {
      const c = f.code.value.trim();
      const h = $('#kindHint', m);
      if (c === String(p.kindCode)) { h.className = 'hint'; h.innerHTML = `<b>${esc(p.kindName)}</b>${p.kindDescription ? '<br><span class="small">' + esc(p.kindDescription) + '</span>' : ''}<br><span class="small muted">В реестре найдено РУ: ${p.totalFound != null ? p.totalFound : D.devices.length}</span>`; }
      else if (/^\d{5,6}$/.test(c)) { h.className = 'hint'; h.textContent = 'Название вида будет загружено из НКМИ при запуске анализа.'; }
      else { h.className = 'hint warn'; h.textContent = 'Код вида — 5–6 цифр из номенклатурной классификации МИ.'; }
    };
    f.code.oninput = hint; hint();
    f.xls.onchange = () => { const x = f.xls.files[0]; if (x) $('#fname', m).textContent = x.name; };
    f.onsubmit = (e) => {
      e.preventDefault();
      if (!/^\d{5,6}$/.test(f.code.value.trim())) { toast('Проверьте код вида'); f.code.focus(); return; }
      const fields = $$('input[name=f]:checked', f).map((x) => x.value);
      if (!fields.length) { toast('Выберите хотя бы одно поле'); return; }
      const pr = { name: f.name.value.trim() || 'Новый проект', kindCode: f.code.value.trim(), kindName: f.code.value.trim() === String(p.kindCode) ? p.kindName : '', dateFrom: f.from.value, dateTo: f.to.value, createdAt: today(), template: f.xls.files[0] ? f.xls.files[0].name : p.excelTemplate, fields };
      S.projects.push(pr); store.set('projects', S.projects);
      startRun(pr.name);
    };
  }

  /* ---------- 2. Анализ ---------- */
  const STAGES = [
    ['Поиск РУ по коду вида', /поиск|найден|фильтр|ру по коду/i],
    ['Версии РУ и ВИРД', /верси|вирд/i],
    ['Скачивание карточек и PDF', /скача|загруж|pdf|ocr|карточк/i],
    ['Извлечение характеристик', /извлеч|модел|llm|qwen/i],
    ['Проверка цитат', /провер|цитат|нет информации|не найден/i],
    ['Запись в Excel', /excel|xlsx|запис|готово/i]
  ];
  function startRun(name) {
    if (S.run && S.run.timer) clearTimeout(S.run.timer);
    S.run = { name, i: 0, stage: 0, done: false, lines: [], started: Date.now() };
    location.hash = '#run';
    if ((location.hash || '') === '#run') route();
    tick();
  }
  function tick() {
    const r = S.run, log = D.log || [];
    if (!r || r.done) return;
    if (r.i >= log.length) { r.done = true; r.stage = STAGES.length; updRun(); toast('Анализ завершён — Excel готов'); return; }
    const line = log[r.i];
    let st = r.stage;
    for (let k = STAGES.length - 1; k >= r.stage; k--) if (STAGES[k][1].test(line)) { st = k; break; }
    st = Math.max(st, Math.min(STAGES.length - 1, Math.floor((r.i / log.length) * STAGES.length) - 1));
    r.stage = st; r.lines.push(line); r.i++;
    updRun(line);
    r.timer = setTimeout(tick, 260 + Math.random() * 420 + (/извлеч|скача/i.test(line) ? 300 : 0));
  }
  function runCounters(frac) {
    const st = D.stats || {}, p = D.project;
    const n = (v) => Math.round((v || 0) * frac);
    const vers = D.devices.reduce((a, d) => a + (d.versions || []).length, 0);
    const pdf = D.devices.reduce((a, d) => a + (d.documents || []).filter((x) => x.used).length, 0);
    return [[p.totalFound != null ? p.totalFound : D.devices.length, 'РУ найдено'], [n(st.devices != null ? st.devices : D.devices.length), 'в периоде'], [n(vers), 'версий / ВИРД'],
      [n(pdf), 'документов'], [n(st.pdfPages), 'страниц PDF'], [n(st.filled), 'заполнено'], [n(st.noInfo), 'нет информации']].map(([v, t]) => `<div class="kpi"><b>${v}</b><span>${t}</span></div>`).join('');
  }
  function pRun(m) {
    const r = S.run || { name: D.project.name, done: true, stage: STAGES.length, lines: (D.log || []).slice(), i: (D.log || []).length, idle: true };
    if (!S.run) S.run = r;
    m.innerHTML = `<div class="page wide">
      <div class="ph"><div><h1>Анализ</h1><div class="sub" id="runSub"></div></div>
        <div class="acts" id="runActs"></div></div>
      <div class="bar" style="margin-bottom:14px"><i id="runBar"></i></div>
      <div class="kpis" id="runK"></div>
      <div class="run"><div class="card stages" id="runSt"></div>
        <div><div class="log" id="runLog" aria-live="polite"></div></div></div></div>`;
    $('#runLog', m).innerHTML = r.lines.map(logLine).join('');
    updRun();
  }
  function logLine(l) {
    const mm = String(l).match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s+(.*)$/);
    const cls = /готово|подтвержд|не требуется/i.test(l) ? 'ok' : /нет информации|не найден|ошибк|скан/i.test(l) ? 'wr' : '';
    return `<div>${mm ? `<span class="t">${esc(mm[1])}</span>  ` : ''}<span class="${cls}">${esc(mm ? mm[2] : l)}</span></div>`;
  }
  function updRun(newLine) {
    const r = S.run; if (!r || !$('#runSt')) return;
    const total = (D.log || []).length || 1;
    const frac = r.done ? 1 : r.i / total;
    $('#runBar').style.width = (frac * 100).toFixed(1) + '%';
    $('#runSub').textContent = (r.name || D.project.name) + ' · код ' + D.project.kindCode + (r.done ? (r.idle ? ' · последний запуск завершён' : ' · завершено') : ' · выполняется…');
    $('#runK').innerHTML = runCounters(frac);
    $('#runSt').innerHTML = STAGES.map(([t], k) => {
      const c = r.done || k < r.stage ? 'done' : k === r.stage ? 'act' : 'wait';
      return `<div class="stg ${c}"><span class="si">${c === 'done' ? ico('check') : ''}</span><span class="sl">${t}</span><span class="sc">${c === 'done' ? 'готово' : c === 'act' ? 'идёт' : ''}</span></div>`;
    }).join('');
    $('#runActs').innerHTML = r.done ? `<button class="btn sub" id="reRun">${ico('refresh')}Запустить заново</button><a class="btn" href="result.xlsx" download>${ico('down')}Скачать Excel</a><a class="btn pri" href="#results">${ico('table')}Открыть результаты</a>`
      : `<button class="btn" id="stopRun">Остановить</button>`;
    const rr = $('#reRun'); if (rr) rr.onclick = () => startRun(r.name);
    const sr = $('#stopRun'); if (sr) sr.onclick = () => { clearTimeout(r.timer); r.done = true; r.lines.push(new Date().toTimeString().slice(0, 8) + ' Остановлено оператором'); pRun($('#main')); };
    if (newLine) { const lg = $('#runLog'); lg.insertAdjacentHTML('beforeend', logLine(newLine)); lg.scrollTop = lg.scrollHeight; }
  }

  /* ---------- 3. Результаты ---------- */
  function visibleDevices() {
    const f = S.flt, q = f.q.trim().toLowerCase();
    return D.devices.filter((d) => {
      const dt = d.dateRu || '';
      if (f.from && dt && dt < f.from) return false;
      if (f.to && dt && dt > f.to) return false;
      if (q) {
        const hay = [d.noRu, d.name, d.producer].concat(D.fields.map((x) => cellOf(d, x.key).value)).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (f.st !== 'all' && !D.fields.some((x) => stOf(cellOf(d, x.key)) === f.st)) return false;
      return true;
    });
  }
  function pResults(m) {
    const p = D.project;
    if (!S.flt.from && !S.flt.to && !S.flt.init) { S.flt.from = p.dateFrom || ''; S.flt.to = p.dateTo || ''; S.flt.init = true; }
    m.innerHTML = `<div class="page wide">
      <div class="ph"><div><h1>Результаты</h1><div class="sub">${esc(p.name)} · код вида ${esc(p.kindCode)} · ${esc(p.kindName || '')}</div></div>
        <div class="acts"><a class="btn pri" href="result.xlsx" download>${ico('down')}Скачать Excel</a></div></div>
      <div class="tools">
        <input class="inp search" type="search" id="q" placeholder="Поиск: № РУ, название, значение" value="${esc(S.flt.q)}">
        <div class="dates">Версии с <input class="inp" type="date" id="dFrom" value="${esc(S.flt.from)}"> по <input class="inp" type="date" id="dTo" value="${esc(S.flt.to)}"></div>
      </div>
      <div class="tools"><div class="fbtns" id="fbtns"></div></div>
      <div class="tw" id="tw"></div>
      <div class="legend">${Object.keys(ST).map((k) => `<span class="st ${k}">${ST[k]}</span>`).join('')}<span class="muted">Нажмите на ячейку, чтобы увидеть источник</span></div>
    </div>`;
    $('#q', m).oninput = (e) => { S.flt.q = e.target.value; drawTable(); };
    $('#dFrom', m).onchange = (e) => { S.flt.from = e.target.value; drawTable(); };
    $('#dTo', m).onchange = (e) => { S.flt.to = e.target.value; drawTable(); };
    drawTable();
  }
  function drawTable() {
    const tw = $('#tw'); if (!tw) return;
    const devs = visibleDevices();
    const cnt = { all: 0 }; Object.keys(ST).forEach((k) => cnt[k] = 0);
    devs.forEach((d) => D.fields.forEach((f) => { cnt[stOf(cellOf(d, f.key))]++; cnt.all++; }));
    $('#fbtns').innerHTML = [['all', 'Все значения']].concat(Object.entries(ST)).map(([k, t]) => `<button class="fbtn ${S.flt.st === k ? 'on' : ''}" data-st="${k}">${t} <b>${cnt[k]}</b></button>`).join('');
    $$('#fbtns .fbtn').forEach((b) => b.onclick = () => { S.flt.st = b.dataset.st; drawTable(); });
    if (!devs.length) { tw.innerHTML = '<div class="empty">Нет изделий с версиями в выбранном периоде или по запросу</div>'; return; }
    tw.innerHTML = `<table class="rt"><thead><tr><th class="dv">Изделие · № РУ</th>${D.fields.map((f) => `<th>${esc(f.title)}</th>`).join('')}</tr></thead><tbody>${devs.map((d) => `<tr>
      <td class="dv"><a href="#device/${esc(d.id)}">${esc(d.noRu)}</a><span class="nm" title="${esc(d.name)}">${esc(d.name)}</span><div class="dt">версия от ${fmtD(d.dateRu)} · ${esc(d.status || '')}</div></td>
      ${D.fields.map((f) => { const c = cellOf(d, f.key), s = stOf(c); const dim = S.flt.st !== 'all' && s !== S.flt.st;
        const conf = S.confirmed[d.id + '|' + f.key];
        return `<td${dim ? ' style="opacity:.35"' : ''}><button class="cell ${s}${S.sel && S.sel.d == d.id && S.sel.f === f.key ? ' sel' : ''}" data-d="${esc(d.id)}" data-f="${esc(f.key)}" title="${esc(ST[s])}">${conf ? ico('check', 'cf') : ''}<span class="v">${esc(c.value || 'Нет информации')}</span>${s !== 'no_info' ? `<span class="src">${esc(srcLabel(c))}</span>` : ''}</button></td>`; }).join('')}</tr>`).join('')}</tbody></table>`;
    $$('.cell', tw).forEach((b) => b.onclick = () => openPanel(b.dataset.d, b.dataset.f));
  }
  const srcLabel = (c) => c.status === 'edited' && !c.doc ? 'оператор' : (c.doc || (c.source === 'card' ? 'Карточка РЗН' : c.source === 'instruction' ? 'Инструкция' : '')) + (c.page ? ', стр. ' + c.page : '');

  /* ---------- панель «Источник» ---------- */
  function openPanel(did, key) {
    S.sel = { d: did, f: key };
    $$('.cell.sel').forEach((x) => x.classList.remove('sel'));
    const b = $(`.cell[data-d="${CSS.escape(String(did))}"][data-f="${CSS.escape(key)}"]`); if (b) b.classList.add('sel');
    drawPanel();
  }
  function closePanel() { const p = $('#panel'); if (p) { p.hidden = true; p.innerHTML = ''; } S.sel = null; $$('.cell.sel').forEach((x) => x.classList.remove('sel')); }
  function hl(ctx, quote) {
    ctx = String(ctx || ''); quote = String(quote || '');
    if (!ctx) return quote ? `<mark>${esc(quote)}</mark>` : '';
    let i = quote ? ctx.indexOf(quote) : -1;
    if (i < 0 && quote) { const norm = (s) => s.replace(/\s+/g, ' '); const c2 = norm(ctx), q2 = norm(quote); const j = c2.indexOf(q2); if (j >= 0) { ctx = c2; quote = q2; i = j; } }
    if (i < 0) return esc(ctx) + (quote ? `\n\n<mark>${esc(quote)}</mark>` : '');
    return esc(ctx.slice(0, i)) + `<mark id="hlm">${esc(quote)}</mark>` + esc(ctx.slice(i + quote.length));
  }
  function drawPanel(editing) {
    const p = $('#panel'), d = devById(S.sel.d), key = S.sel.f; if (!d) return;
    const c = cellOf(d, key), s = stOf(c);
    const doc = (d.documents || []).find((x) => x.name === c.doc) || (c.source === 'instruction' ? (d.documents || []).find((x) => x.type === 'instruction') : null);
    const isCard = c.source === 'card' || (!doc && c.quote);
    const link = doc && doc.url ? doc.url : d.cardUrl;
    const conf = S.confirmed[d.id + '|' + key];
    p.hidden = false;
    p.innerHTML = `<div class="phd"><b>Источник</b><button class="btn sub sm" id="pClose" aria-label="Закрыть">${ico('close')}</button></div>
      <div class="pbd">
        <dl class="kv"><dt>Изделие</dt><dd><a href="#device/${esc(d.id)}">${esc(d.noRu)}</a></dd><dt>Поле</dt><dd>${esc(fieldTitle(key))}</dd><dt>Статус</dt><dd><span class="st ${s}">${ST[s]}</span>${conf ? ' <span class="pill acc">подтверждено</span>' : ''}</dd></dl>
        ${editing ? `<label class="f" style="margin-top:12px"><span>Значение (правка оператора)</span><textarea class="inp" id="edVal" rows="4">${esc(c.value === 'Нет информации' ? '' : c.value)}</textarea></label>
          <div class="note">${ico('info')}<span>Ячейка будет помечена «Исправлено оператором». Исходное значение сохранится в журнале.</span></div>`
          : `<div class="val">${esc(c.value || 'Нет информации')}</div>`}
        ${c.original && c.original !== c.value ? `<div class="small muted">Было: ${esc(c.original)}</div>` : ''}
        ${c.note ? `<div class="note">${ico('info')}<span>${esc(c.note)}</span></div>` : ''}
        ${s === 'no_info' && !c.quote ? `<div class="note">${ico('info')}<span>В карточке реестра и официальной инструкции этого изделия нет фрагмента с этой характеристикой. Значения других изделий не переносятся.</span></div>` : ''}
        ${c.quote ? `<div class="doc">${ico('pdf')}<div style="flex:1;min-width:0"><div class="dn">${esc(c.doc || (isCard ? 'Карточка изделия в реестре' : 'Документ'))}</div>
            <div class="small muted">${isCard ? 'Сведения карточки в реестре РЗН' : esc(DOC_T[(doc && doc.type) || 'other'])}${c.page ? ' · стр. ' + esc(c.page) : ''}${doc && doc.pages ? ' из ' + doc.pages : ''}</div></div></div>
          <div class="small muted" style="margin-bottom:6px">Фрагмент документа (цитата подсвечена)</div>
          <div class="ctx">${hl(c.context, c.quote)}</div>
          <p style="margin:10px 0 0"><a href="${esc(link)}" target="_blank" rel="noopener">${ico('ext', '').replace('<svg', '<svg style="display:inline;width:14px;height:14px;vertical-align:-2px;margin-right:4px"')}${isCard ? 'Открыть карточку в реестре' : 'Открыть PDF в реестре'}</a></p>` : ''}
      </div>
      <div class="pft">${editing ? `<button class="btn pri" id="edSave">Сохранить</button><button class="btn" id="edCancel">Отмена</button>`
        : `<button class="btn pri" id="pConf"${!c.quote || conf ? ' disabled' : ''}>${ico('check')}Подтвердить</button><button class="btn" id="pEdit">${ico('edit')}Исправить</button>${S.edits[d.id] && S.edits[d.id][key] ? '<button class="btn sub" id="pUndo">Вернуть</button>' : ''}`}</div>`;
    $('#pClose').onclick = closePanel;
    const mk = $('#hlm'); if (mk) mk.scrollIntoView({ block: 'center' });
    if (editing) {
      $('#edVal').focus();
      $('#edCancel').onclick = () => drawPanel();
      $('#edSave').onclick = () => {
        const v = $('#edVal').value.trim();
        (S.edits[d.id] = S.edits[d.id] || {})[key] = { value: v || 'Нет информации', status: v ? 'edited' : 'no_info', date: today() };
        store.set('edits', S.edits); drawTable(); drawPanel(); toast('Значение исправлено');
      };
      return;
    }
    $('#pEdit').onclick = () => drawPanel(true);
    const u = $('#pUndo'); if (u) u.onclick = () => { delete S.edits[d.id][key]; store.set('edits', S.edits); drawTable(); drawPanel(); toast('Возвращено значение из документа'); };
    $('#pConf').onclick = () => {
      S.confirmed[d.id + '|' + key] = today(); store.set('confirmed', S.confirmed);
      S.kb.push({ field: key, quote: c.quote, value: c.value, addedBy: 'оператор', date: today(), noRu: d.noRu, session: true });
      store.set('kb', S.kb); drawTable(); drawPanel(); renderNav('results'); toast('Пример добавлен в базу знаний');
    };
  }

  /* ---------- 4. Изделия и карточка ---------- */
  function pDevices(m) {
    m.innerHTML = `<div class="page"><div class="ph"><div><h1>Изделия</h1><div class="sub">РУ по коду вида ${esc(D.project.kindCode)} в выбранном периоде: ${D.devices.length}${D.project.totalFound ? ' из ' + D.project.totalFound + ' найденных' : ''}</div></div></div>
      <div class="card"><ul class="lst">${D.devices.map((d) => {
        const n = D.fields.filter((f) => stOf(cellOf(d, f.key)) !== 'no_info').length;
        return `<li><a href="#device/${esc(d.id)}"><div class="pi" style="width:34px;height:34px;border-radius:6px;background:var(--accent-bg);color:var(--accent);display:grid;place-items:center;flex:none">${ico('box').replace('<svg', '<svg style="width:18px;height:18px"')}</div>
          <div class="ln"><b>${esc(d.noRu)}</b><span>${esc(d.name)}</span><span>${esc(d.producer || '')}</span></div>
          <div style="text-align:right;flex:none"><span class="pill">${n}/${D.fields.length} полей</span><div class="small muted" style="margin-top:4px">${fmtD(d.dateRu)}</div></div></a></li>`; }).join('')}</ul></div></div>`;
  }
  function pDevice(m, id) {
    const d = devById(id);
    if (!d) { m.innerHTML = '<div class="page"><div class="empty">Изделие не найдено. <a href="#devices">К списку изделий</a></div></div>'; return; }
    const vs = (d.versions || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const from = D.project.dateFrom, to = D.project.dateTo;
    m.innerHTML = `<div class="page">
      <div class="small" style="margin-bottom:8px"><a href="#devices">Изделия</a> <span class="muted">›</span> <span class="muted">${esc(d.noRu)}</span></div>
      <div class="dhead"><div style="flex:1;min-width:0"><div class="row"><span class="pill acc">${esc(d.noRu)}</span><span class="st ${/действ/i.test(d.status || '') ? 'ok' : 'no_info'}">${esc(d.status || '—')}</span></div>
        <h1>${esc(d.name)}</h1></div></div>
      <div class="row" style="margin:12px 0 4px"><a class="btn" href="${esc(d.cardUrl)}" target="_blank" rel="noopener">${ico('ext')}Карточка в реестре РЗН</a><a class="btn" href="#results" id="toRes">${ico('table')}Значения в таблице</a></div>
      <div class="grid g2" style="margin-top:12px">
        <div class="card pad"><h2 style="margin-top:0">Реквизиты РУ</h2><dl class="kv">
          <dt>№ РУ</dt><dd>${esc(d.noRu)}</dd><dt>Дата регистрации</dt><dd>${fmtD(d.dateRegistration)}</dd><dt>Текущая версия</dt><dd>${fmtD(d.dateRu)}${d.id != null ? ' · id ' + esc(d.id) : ''}</dd>
          <dt>Производитель</dt><dd>${esc(d.producer || '—')}</dd><dt>Статус</dt><dd>${esc(d.status || '—')}</dd><dt>Код вида</dt><dd>${esc(D.project.kindCode)}</dd></dl></div>
        <div class="card pad"><h2 style="margin-top:0">Версии РУ / ВИРД <span class="muted small">(${vs.length})</span></h2>
          <ul class="tl">${vs.map((v, i) => { const out = (from && v.date < from) || (to && v.date > to);
            return `<li class="${i === 0 ? 'cur' : ''}${out ? ' off' : ''}"><div class="row" style="gap:8px"><span class="d">${fmtD(v.date)}</span><span class="pill">${esc(v.status || '')}</span>${out ? '<span class="pill">вне периода</span>' : ''}${v.id != null ? `<span class="small muted">id ${esc(v.id)}</span>` : ''}</div>${v.change ? `<div class="c">${esc(v.change)}</div>` : ''}</li>`; }).join('')}</ul></div>
      </div>
      <h2>Документы карточки</h2>
      <div class="card"><ul class="dl">${(d.documents || []).map((x) => `<li>${ico('pdf')}<div class="dn"><div>${esc(x.name)}</div><div class="small muted">${esc(DOC_T[x.type] || x.type || 'Документ')}${x.pages ? ' · ' + x.pages + ' стр.' : ''}${x.issueDate ? ' · от ' + fmtD(x.issueDate) : ''}</div></div>
        ${x.used ? '<span class="pill acc">использован</span>' : '<span class="pill hide-m">не требуется</span>'}${x.url ? `<a class="btn sm sub" href="${esc(x.url)}" target="_blank" rel="noopener" title="Открыть в реестре">${ico('ext')}</a>` : ''}</li>`).join('') || '<li class="muted">Документы не приложены</li>'}</ul></div>
      <h2>Извлечённые значения</h2>
      <div class="card tscroll"><table class="t"><thead><tr><th>Поле</th><th>Значение</th><th>Статус</th><th class="hide-m">Источник</th></tr></thead><tbody>
        ${D.fields.map((f) => { const c = cellOf(d, f.key), s = stOf(c); return `<tr><td>${esc(f.title)}</td><td>${esc(c.value)}</td><td><span class="st ${s}">${ST[s]}</span></td><td class="hide-m small muted">${s === 'no_info' ? '—' : esc(srcLabel(c))}</td></tr>`; }).join('')}</tbody></table></div>
    </div>`;
    $('#toRes', m).onclick = () => { S.flt.q = d.noRu; };
  }

  /* ---------- 5. База знаний ---------- */
  function pKb(m) {
    const all = kbAll();
    m.innerHTML = `<div class="page"><div class="ph"><div><h1>База знаний</h1><div class="sub">Подтверждённые оператором примеры «цитата → значение». Модель опирается на них при разборе новых инструкций; значения между изделиями не переносятся.</div></div></div>
      <div class="kpis"><div class="kpi"><b>${all.length}</b><span>примеров</span></div><div class="kpi"><b>${S.kb.length}</b><span>добавлено в этой сессии</span></div><div class="kpi"><b>${new Set(all.map((x) => x.field)).size}</b><span>полей покрыто</span></div></div>
      <div class="tools"><input class="inp search" type="search" id="kq" placeholder="Поиск по примерам"></div>
      <div class="card tscroll" id="kbt"></div>
      ${!S.kb.length ? '<p class="small muted">Чтобы добавить пример, откройте ячейку в «Результатах» и нажмите «Подтвердить».</p>' : ''}</div>`;
    const draw = () => {
      const q = $('#kq').value.trim().toLowerCase();
      const rows = all.map((x, i) => [x, i]).filter(([x]) => !q || [fieldTitle(x.field), x.value, x.quote, x.noRu].join(' ').toLowerCase().includes(q)).reverse();
      $('#kbt').innerHTML = rows.length ? `<table class="t"><thead><tr><th>Поле</th><th>Значение</th><th>Цитата из документа</th><th class="hide-m">Добавил</th><th></th></tr></thead><tbody>${rows.map(([x]) => `<tr class="${x.session ? 'new' : ''}">
        <td>${esc(fieldTitle(x.field))}${x.noRu ? `<div class="small muted">${esc(x.noRu)}</div>` : ''}</td><td><b>${esc(x.value)}</b></td><td class="q">«${esc(x.quote)}»</td>
        <td class="hide-m small">${esc(x.addedBy || '')}<div class="muted">${fmtD(x.date)}</div></td>
        <td>${x.session ? `<span class="pill acc">новое</span> <button class="btn sm sub" data-del="${S.kb.indexOf(x)}" title="Удалить пример">${ico('close')}</button>` : ''}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Ничего не найдено</div>';
      $$('[data-del]').forEach((b) => b.onclick = () => {
        const x = S.kb[+b.dataset.del]; if (!x) return;
        S.kb.splice(+b.dataset.del, 1); store.set('kb', S.kb);
        const k = Object.keys(S.confirmed).find((k) => k.endsWith('|' + x.field) && devById(k.split('|')[0]) && devById(k.split('|')[0]).noRu === x.noRu);
        if (k) { delete S.confirmed[k]; store.set('confirmed', S.confirmed); }
        pKb(m);
      });
    };
    $('#kq').oninput = draw; draw();
  }

  /* ---------- 6. Обновления ---------- */
  function nextCheck() { const n = new Date(), t = new Date(n); t.setHours(9, 0, 0, 0); if (t <= n) t.setDate(t.getDate() + 1); return t; }
  function pUpdates(m) {
    const nc = nextCheck(), ups = (D.updates || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const last = S.lastCheck || (function () { const t = new Date(nc); t.setDate(t.getDate() - 1); return t.toISOString(); })();
    const lt = new Date(last);
    m.innerHTML = `<div class="page"><div class="ph"><div><h1>Обновления</h1><div class="sub">Ежедневная проверка новых РУ и версий по коду вида ${esc(D.project.kindCode)}</div></div>
      <div class="acts"><button class="btn" id="chkNow">${ico('refresh')}Проверить сейчас</button></div></div>
      <div class="card" style="margin-bottom:12px">
        <div class="setting">${ico('bell', 'ic')}<div class="t"><b>Проверять ежедневно в 09:00</b><span>Новые версии автоматически попадут в анализ, Excel дозаполнится без затирания</span></div><input type="checkbox" class="sw" id="daily"${S.settings.daily ? ' checked' : ''} aria-label="Ежедневная проверка"></div>
        <div class="setting">${ico('info', 'ic')}<div class="t"><b id="nextT">${S.settings.daily ? 'Следующая проверка: ' + nc.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) + ', 09:00' : 'Автоматическая проверка выключена'}</b><span id="lastT">Последняя проверка: ${lt.toLocaleDateString('ru-RU')} ${lt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span></div></div>
      </div>
      <h2>Новые версии и РУ <span class="muted small">(${ups.length})</span></h2>
      <div class="card"><ul class="lst">${ups.map((u) => { const d = u.id != null && devById(u.id);
        return `<li><a href="${d ? '#device/' + esc(u.id) : '#updates'}"><div style="flex:none;width:76px" class="small"><b>${fmtD(u.date)}</b></div>
          <div class="ln"><b>${esc(u.noRu)} <span class="pill acc" style="font-weight:400">${esc(u.event)}</span></b><span title="${esc(u.detail)}">${esc(u.detail || '')}</span></div></a></li>`; }).join('') || '<li class="empty">Новых версий нет</li>'}</ul></div></div>`;
    $('#daily', m).onchange = (e) => { S.settings.daily = e.target.checked; store.set('settings', S.settings); toast(e.target.checked ? 'Ежедневная проверка включена' : 'Ежедневная проверка выключена'); pUpdates(m); };
    $('#chkNow', m).onclick = (e) => {
      const b = e.currentTarget; b.disabled = true; b.innerHTML = '<span class="spin"></span>Проверяю реестр…';
      setTimeout(() => { S.lastCheck = new Date().toISOString(); store.set('lastCheck', S.lastCheck); pUpdates(m); toast('Проверено: новых версий с последнего запуска нет'); }, 1600);
    };
  }

  /* ---------- 7. Настройки ---------- */
  function pSettings(m) {
    const s = S.settings, th = document.documentElement.dataset.theme;
    m.innerHTML = `<div class="page" style="max-width:900px"><div class="ph"><div><h1>Настройки</h1></div></div>
      <h2 style="margin-top:0">Модель</h2>
      <div class="card">
        <div class="setting">${ico('chip', 'ic')}<div class="t"><b>Локальная модель</b><span>${esc(D.project.model || '—')}</span></div><span class="st ok">загружена</span></div>
        <div class="setting">${ico('lock', 'ic')}<div class="t"><b>Данные не покидают компьютер</b><span>Текст PDF и Excel обрабатывается локально. В интернет программа обращается только к открытому реестру Росздравнадзора.</span></div></div>
        <div class="setting">${ico('check', 'ic')}<div class="t"><b>Строгий режим</b><span>Значение без дословной цитаты из карточки или инструкции этого изделия → «Нет информации»</span></div><input type="checkbox" class="sw" checked disabled aria-label="Строгий режим"></div>
        <div class="setting">${ico('gear', 'ic')}<div class="t"><b>Потоков обработки</b><span>Сколько документов разбирать параллельно</span></div><select class="inp" id="thr">${[1, 2, 4, 8].map((n) => `<option${n === +s.threads ? ' selected' : ''}>${n}</option>`).join('')}</select></div>
      </div>
      <h2>Проект и Excel</h2>
      <div class="card">
        <div class="setting" style="flex-wrap:wrap">${ico('folder', 'ic')}<div class="t"><b>Папка проекта</b><span>PDF, кэш карточек, журнал и result.xlsx</span></div><input class="inp mono" id="fold" style="flex:1 1 320px" value="${esc(s.folder)}"></div>
        <div class="setting">${ico('table', 'ic')}<div class="t"><b>Не затирать заполненные ячейки</b><span>Дозаполнение: пишутся только пустые ячейки шаблона</span></div><input type="checkbox" class="sw" data-k="keep"${s.keep ? ' checked' : ''}></div>
        <div class="setting">${ico('info', 'ic')}<div class="t"><b>Колонки «Источник»</b><span>Рядом с каждым полем: файл, страница, фрагмент</span></div><input type="checkbox" class="sw" data-k="srcCols"${s.srcCols ? ' checked' : ''}></div>
      </div>
      <h2>Распознавание сканов</h2>
      <div class="card">
        <div class="setting">${ico('scan', 'ic')}<div class="t"><b>OCR для сканированных PDF</b><span>Если в PDF нет текстового слоя, страница распознаётся локально</span></div><input type="checkbox" class="sw" data-k="ocr"${s.ocr ? ' checked' : ''}></div>
        <div class="setting">${ico('book', 'ic')}<div class="t"><b>Языки OCR</b></div><select class="inp" id="ocrL"${s.ocr ? '' : ' disabled'}>${['rus', 'rus+eng'].map((n) => `<option${n === s.ocrLang ? ' selected' : ''}>${n}</option>`).join('')}</select></div>
      </div>
      <h2>Оформление</h2>
      <div class="card"><div class="setting">${ico('gear', 'ic')}<div class="t"><b>Тема</b></div><select class="inp" id="thSel"><option value="light"${th !== 'dark' ? ' selected' : ''}>Светлая</option><option value="dark"${th === 'dark' ? ' selected' : ''}>Тёмная</option></select></div></div>
      <p class="small muted" style="margin-top:16px">Сборщик МИ · версия 1.4.2 · реестр elk.roszdravnadzor.gov.ru</p></div>`;
    const save = (msg) => { store.set('settings', s); if (msg) toast(msg); };
    $$('.sw[data-k]', m).forEach((x) => x.onchange = () => { s[x.dataset.k] = x.checked; save('Сохранено'); if (x.dataset.k === 'ocr') $('#ocrL').disabled = !x.checked; });
    $('#thr', m).onchange = (e) => { s.threads = +e.target.value; save('Сохранено'); };
    $('#ocrL', m).onchange = (e) => { s.ocrLang = e.target.value; save('Сохранено'); };
    $('#fold', m).onchange = (e) => { s.folder = e.target.value; save('Папка проекта изменена'); };
    $('#thSel', m).onchange = (e) => setTheme(e.target.value);
  }

  /* ---------- тема и старт ---------- */
  function setTheme(t) {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('rzn.theme', t); } catch (e) { /* */ }
    const mt = $('meta[name=theme-color]'); if (mt) mt.content = t === 'dark' ? '#202020' : '#f3f3f3';
  }
  $('#themeBtn').onclick = () => { setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); const ts = $('#thSel'); if (ts) ts.value = document.documentElement.dataset.theme; };
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && S.sel) closePanel(); });
  try { const t = localStorage.getItem('rzn.theme'); if (t) setTheme(t.replace(/"/g, '')); } catch (e) { /* */ }

  fetch('data.json', { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).then((data) => {
    D = data;
    D.fields = D.fields || []; D.devices = D.devices || []; D.project = D.project || {};
    status();
    window.addEventListener('hashchange', route);
    route();
  }).catch(() => {
    $('#main').innerHTML = '<div class="page"><div class="empty">Не удалось открыть файл проекта data.json</div></div>';
  });
})();

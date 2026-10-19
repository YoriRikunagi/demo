/* Общий слой для страниц «Микеланджело»: меню, слайдеры, попап-форма, фото-слоты, анимации.
   Разметка страницы остаётся как в макете — скрипт только подключается к классам. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var html = document.documentElement;
  var PHONE = '+7 917 043-78-14';
  var DIRECTIONS = ['Студия рисования', 'Гончарная мастерская', 'Художественная школа', 'Мастер-классы', 'Подарочный сертификат', 'Корпоратив / день рождения'];

  function el(tag, cls, inner) { var n = document.createElement(tag); if (cls) n.className = cls; if (inner != null) n.innerHTML = inner; return n; }
  function toast(text) {
    var t = $('.toast') || document.body.appendChild(el('div', 'toast'));
    t.textContent = text; t.classList.add('on');
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('on'); }, 2600);
  }

  /* ---------- Шапка и мобильное меню ---------- */
  var topbar = $('.topbar');
  if (topbar) {
    var burger = $('.burger', topbar);
    var menu = el('nav', 'mobile-menu');
    $$('.nav a', topbar).forEach(function (a) { menu.appendChild(a.cloneNode(true)); });
    var foot = el('div', 'mm-foot', '<a href="tel:+79170437814">' + PHONE + '</a><span>ежедневно 11:00–20:00 · ул. Чернышевского, 88/1</span>');
    menu.appendChild(foot);
    topbar.parentNode.insertBefore(menu, topbar.nextSibling);
    var closeMenu = function () { document.body.classList.remove('menu-open'); };
    if (burger) burger.addEventListener('click', function () { document.body.classList.toggle('menu-open'); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) closeMenu(); });

    var onScroll = function () {
      var y = window.scrollY;
      topbar.classList.toggle('is-scrolled', y > 10);
      toTop.classList.toggle('on', y > 900);
      mCta.classList.toggle('on', y > 500 && !nearForm());
    };
    var toTop = document.body.appendChild(el('button', 'to-top', '↑'));
    toTop.setAttribute('aria-label', 'Наверх');
    toTop.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    var mCta = document.body.appendChild(el('button', 'm-cta', 'Записаться на занятие'));
    mCta.setAttribute('data-popup', 'lead');
    var formSec = $('#form');
    var nearForm = function () { if (!formSec) return false; var r = formSec.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; };
    addEventListener('scroll', onScroll, { passive: true }); onScroll();

    // подсветка пункта меню текущего раздела
    var links = $$('.nav a[href^="#"]', topbar);
    var map = {};
    links.forEach(function (a) { var s = $(a.getAttribute('href')); if (s) map[s.id] = a; });
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (ents) {
        ents.forEach(function (en) {
          if (en.isIntersecting) { links.forEach(function (l) { l.classList.remove('is-active'); }); map[en.target.id] && map[en.target.id].classList.add('is-active'); }
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      Object.keys(map).forEach(function (id) { io.observe(document.getElementById(id)); });
    }
  }

  /* ---------- Фото-слоты ---------- */
  var picker = el('input'); picker.type = 'file'; picker.accept = 'image/*'; picker.hidden = true; document.body.appendChild(picker);
  var pickTarget = null;
  $$('.ph').forEach(function (ph) {
    var name = ph.getAttribute('data-slot') || 'Фото';
    ph.appendChild(el('span', 'ph-label', '<b>' + name + '</b>' + (ph.dataset.size ? '<br>' + ph.dataset.size : '')));
    ph.appendChild(el('span', 'ph-edit', '↻ Заменить фото'));
    var img = $('img', ph);
    if (!img) { ph.classList.add('ph-empty'); return; }
    var bad = function () { ph.classList.add('ph-empty'); };
    if (img.complete && !img.naturalWidth && img.src) bad(); else img.addEventListener('error', bad);
  });
  document.addEventListener('click', function (e) {
    if (!html.classList.contains('edit-photos')) return;
    var ph = e.target.closest('.ph'); if (!ph) return;
    e.preventDefault(); e.stopPropagation();
    pickTarget = ph; picker.value = ''; picker.click();
  }, true);
  picker.addEventListener('change', function () {
    var f = picker.files && picker.files[0]; if (!f || !pickTarget) return;
    var img = $('img', pickTarget);
    if (!img) { img = el('img'); pickTarget.insertBefore(img, pickTarget.firstChild); }
    img.src = URL.createObjectURL(f);
    pickTarget.classList.remove('ph-empty', 'ph-swapped'); void pickTarget.offsetWidth; pickTarget.classList.add('ph-swapped');
    toast('Фото заменено: «' + (pickTarget.dataset.slot || 'блок') + '». Вёрстка не поехала.');
  });

  /* ---------- Появление блоков при скролле ---------- */
  var RV = ['.section h2', '.section .lead', '.section-label', '.about-copy', '.about-side', '.direction-card', '.schedule-note', '.schedule-table',
    '.why-item', '.location-card', '.cert-box', '.cert-list', '.events-copy', '.events-visual', '.faq-box', '.seo-head', '.seo-card',
    '.form-side', '.form-card', '.slider-track > *', '.maps-links', '.footer-grid > *', '[data-rv]'];
  var rvItems = $$(RV.join(',')).filter(function (n) { return !n.closest('.hero, .inner-hero, .popup'); });
  rvItems.forEach(function (n) {
    n.classList.add('rv');
    var sib = n.parentNode ? Array.prototype.indexOf.call(n.parentNode.children, n) : 0;
    n.style.setProperty('--d', Math.min(sib, 6) * 0.07 + 's');
  });
  if (/[?&]static/.test(location.search)) rvItems.forEach(function (n) { n.classList.add('in'); }); // для скриншотов
  else if ('IntersectionObserver' in window) {
    var rio = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); rio.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    rvItems.forEach(function (n) { rio.observe(n); });
  } else rvItems.forEach(function (n) { n.classList.add('in'); });

  /* hero: вход и лёгкий параллакс ромбов за курсором */
  var hero = $('.hero, .inner-hero');
  if (hero) {
    requestAnimationFrame(function () { hero.classList.add('hero-in'); });
    var shapes = $$('.hero-visual .diamond, .inner-visual > *', hero);
    if (matchMedia('(hover:hover)').matches) {
      hero.addEventListener('mousemove', function (e) {
        var r = hero.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        shapes.forEach(function (s, i) { var k = (i % 2 ? -1 : 1) * (8 + i * 5); s.style.translate = (x * k) + 'px ' + (y * k) + 'px'; });
      });
      hero.addEventListener('mouseleave', function () { shapes.forEach(function (s) { s.style.translate = '0 0'; }); });
    }
  }

  /* ---------- Слайдеры: кнопки, перетаскивание, прогресс ---------- */
  $$('[data-slider]').forEach(function (slider) {
    var win = $('.slider-window', slider), prev = $('[data-prev]', slider), next = $('[data-next]', slider);
    if (!win) return;
    var bar = el('div', 'slider-progress', '<i></i>'); win.parentNode.insertBefore(bar, win.nextSibling);
    var thumb = bar.firstChild;
    var shift = function () { return Math.max(win.clientWidth * 0.86, 280); };
    var upd = function () {
      var max = win.scrollWidth - win.clientWidth;
      var vis = win.clientWidth / win.scrollWidth;
      thumb.style.width = (vis * 100) + '%';
      thumb.style.left = (max > 0 ? (win.scrollLeft / max) * (1 - vis) * 100 : 0) + '%';
      if (prev) prev.disabled = win.scrollLeft < 4;
      if (next) next.disabled = win.scrollLeft > max - 4;
      bar.style.display = max > 4 ? '' : 'none';
    };
    if (prev) prev.addEventListener('click', function () { win.scrollBy({ left: -shift(), behavior: 'smooth' }); });
    if (next) next.addEventListener('click', function () { win.scrollBy({ left: shift(), behavior: 'smooth' }); });
    win.addEventListener('scroll', upd, { passive: true }); addEventListener('resize', upd); upd();
    setTimeout(upd, 400);
    // перетаскивание мышью (на тачскрине работает нативный свайп)
    var down = false, sx = 0, sl = 0, moved = 0;
    win.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || html.classList.contains('edit-photos')) return;
      down = true; moved = 0; sx = e.clientX; sl = win.scrollLeft;
    });
    addEventListener('pointermove', function (e) {
      if (!down) return; var dx = e.clientX - sx; moved = Math.max(moved, Math.abs(dx));
      if (moved > 5) { win.classList.add('dragging'); win.scrollLeft = sl - dx; }
    });
    addEventListener('pointerup', function () {
      if (!down) return; down = false;
      if (win.classList.contains('dragging')) {
        win.classList.remove('dragging');
        var w = (win.querySelector('.slide') || win).getBoundingClientRect().width + 20;
        win.scrollTo({ left: Math.round(win.scrollLeft / w) * w, behavior: 'smooth' });
      }
    });
    win.addEventListener('click', function (e) { if (moved > 5) { e.preventDefault(); e.stopPropagation(); moved = 0; } }, true);
  });

  /* ---------- Расписание: текущее время в Уфе и ближайшее занятие ---------- */
  var times = $$('.schedule-time');
  if (times.length) {
    var now = new Date(Date.now() + (new Date().getTimezoneOffset() + 300) * 60000); // Уфа, UTC+5
    var mins = now.getHours() * 60 + now.getMinutes();
    var toM = function (s) { var p = s.split(':'); return +p[0] * 60 + +p[1]; };
    var groups = {};
    times.forEach(function (t) { var g = t.parentNode; (groups[g.id || (g.id = 'st' + Math.random().toString(36).slice(2, 7))] = groups[g.id] || []).push(t); });
    Object.keys(groups).forEach(function (gid) {
      var list = groups[gid], nextFound = false, nowSlot = null;
      list.forEach(function (t) {
        var m = t.textContent.match(/(\d{1,2}:\d{2})\D+(\d{1,2}:\d{2})/); if (!m) return;
        var a = toM(m[1]), b = toM(m[2]);
        if (mins >= a && mins < b) { t.classList.add('is-now'); t.insertAdjacentHTML('beforeend', '<span class="slot-tag">идёт сейчас</span>'); nowSlot = t; }
        else if (!nextFound && mins < a) { nextFound = true; t.classList.add('is-next'); t.insertAdjacentHTML('beforeend', '<span class="slot-tag">ближайшее</span>'); }
      });
      var hh = ('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2);
      var note = el('div', 'slot-now-note', 'Сейчас в Уфе ' + hh + (nextFound ? ' · есть места на сегодня' : ' · запись на завтра с 11:00'));
      var grid = document.getElementById(gid); grid.parentNode.insertBefore(note, grid);
    });
  }
  // строки прайса открывают запись с выбранным тарифом
  $$('.schedule-table tbody tr, table tbody tr').forEach(function (tr) {
    var td = tr.children; if (td.length < 2 || !/₽/.test(td[1].textContent)) return;
    tr.setAttribute('data-tariff', td[0].textContent.trim() + ' — ' + td[1].textContent.trim());
    tr.setAttribute('data-popup', 'lead');
  });

  /* ---------- Формы ---------- */
  function maskPhone(inp) {
    inp.setAttribute('inputmode', 'tel'); inp.setAttribute('autocomplete', 'tel');
    inp.addEventListener('focus', function () { if (!inp.value) inp.value = '+7 '; });
    inp.addEventListener('blur', function () { if (inp.value.replace(/\D/g, '').length <= 1) inp.value = ''; });
    var prevRest = 0;
    inp.addEventListener('focus', function () { prevRest = Math.max(0, inp.value.replace(/\D/g, '').length - 1); });
    inp.form && inp.form.addEventListener('reset', function () { prevRest = 0; });
    inp.addEventListener('input', function () {
      var all = inp.value.replace(/\D/g, '');
      var rest = /^\s*\+7/.test(inp.value) ? all.slice(1) : all;
      // «8» или «7» первой цифрой — это код страны, а не номер (и при вводе, и при вставке 8XXXXXXXXXX)
      if ((prevRest === 0 && rest.length === 1 && /[78]/.test(rest)) || (rest.length > 10 && /^[78]/.test(rest))) rest = rest.slice(1);
      prevRest = rest.length;
      var d = '7' + rest.slice(0, 10);
      var r = '+7'; if (d.length > 1) r += ' (' + d.slice(1, 4); if (d.length >= 4) r += ') ' + d.slice(4, 7);
      if (d.length >= 7) r += '-' + d.slice(7, 9); if (d.length >= 9) r += '-' + d.slice(9, 11);
      inp.value = r;
    });
  }
  function wrapField(inp, msg) {
    if (inp.parentNode.classList.contains('field')) return;
    var f = el('div', 'field' + (inp.classList.contains('full') || inp.tagName === 'TEXTAREA' ? ' full' : ''));
    inp.parentNode.insertBefore(f, inp); f.appendChild(inp); f.appendChild(el('span', 'err-msg', msg));
    inp.addEventListener('input', function () { f.classList.remove('err'); });
    inp.addEventListener('change', function () { f.classList.remove('err'); });
  }
  function setupForm(form) {
    form.setAttribute('novalidate', '');
    var name = form.querySelector('[name=name]'), phone = form.querySelector('[name=phone]'), dir = form.querySelector('[name=direction]');
    if (name) wrapField(name, 'Как к вам обращаться?');
    if (phone) { wrapField(phone, 'Нужен номер, чтобы администратор перезвонил'); maskPhone(phone); }
    if (dir) wrapField(dir, 'Выберите направление');
    var host = form.parentNode;
    if (!$('.form-ok', host)) {
      host.appendChild(el('div', 'form-ok',
        '<div class="ok-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>' +
        '<h3>Заявка принята</h3><p class="ok-text">Администратор перезвонит в течение 15 минут в рабочее время и подберёт удобное занятие.</p>' +
        '<button type="button" class="btn outline ok-again">Отправить ещё одну</button>'));
    }
    $('.ok-again', host).addEventListener('click', function () { host.classList.remove('is-sent'); form.reset(); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var bad = [];
      if (name && name.value.trim().length < 2) bad.push(name);
      if (phone && phone.value.replace(/\D/g, '').length !== 11) bad.push(phone);
      if (dir && dir.hasAttribute('required') && !dir.value) bad.push(dir);
      bad.forEach(function (i) { i.parentNode.classList.add('err'); });
      if (bad.length) { bad[0].focus(); return; }
      var btn = form.querySelector('[type=submit]'); btn.classList.add('is-loading');
      setTimeout(function () {
        btn.classList.remove('is-loading');
        var who = name && name.value.trim() ? name.value.trim().split(' ')[0] + ', спасибо! ' : '';
        $('.ok-text', host).textContent = who + 'Администратор перезвонит на ' + (phone ? phone.value : 'ваш номер') + ' в течение 15 минут в рабочее время.';
        host.classList.add('is-sent');
      }, 900);
    });
  }

  /* ---------- Попап записи (как t-popup в Тильде) ---------- */
  var opts = DIRECTIONS.map(function (d) { return '<option>' + d + '</option>'; }).join('');
  var popup = el('div', 'popup', '<div class="popup-box" role="dialog" aria-modal="true">' +
    '<button class="popup-close" aria-label="Закрыть">×</button>' +
    '<div class="popup-head"><h3 class="pp-title">Запишитесь на занятие</h3><p class="pp-sub">Оставьте телефон — администратор перезвонит, подскажет свободное время и формат.</p></div>' +
    '<div class="popup-body"><form class="form js-form"><div class="popup-tariff"></div>' +
    '<input name="name" placeholder="Ваше имя"><input name="phone" placeholder="Телефон">' +
    '<select name="direction"><option value="">Выберите направление</option>' + opts + '</select>' +
    '<input type="hidden" name="tariff">' +
    '<button class="btn" type="submit">Отправить заявку</button>' +
    '<p class="form-note" style="margin:0">Нажимая кнопку, вы соглашаетесь с <a href="#">политикой конфиденциальности</a>.</p></form></div></div>');
  document.body.appendChild(popup);
  var lastFocus = null;
  function openPopup(trigger) {
    var box = $('.popup-body', popup); box.classList.remove('is-sent');
    var f = $('form', popup); f.reset(); $$('.field', f).forEach(function (x) { x.classList.remove('err'); });
    var t = trigger && trigger.getAttribute('data-tariff'), d = trigger && trigger.getAttribute('data-direction');
    $('.pp-title', popup).textContent = (trigger && trigger.getAttribute('data-title')) || 'Запишитесь на занятие';
    var tb = $('.popup-tariff', popup); tb.classList.toggle('on', !!t); tb.innerHTML = t ? 'Вы выбрали: <b>' + t + '</b>' : '';
    f.tariff.value = t || '';
    if (d) f.direction.value = d;
    lastFocus = document.activeElement;
    popup.classList.add('is-open'); document.body.classList.add('lock');
    setTimeout(function () { f.name.focus({ preventScroll: true }); }, 350);
  }
  function closePopup() { popup.classList.remove('is-open'); document.body.classList.remove('lock'); lastFocus && lastFocus.focus && lastFocus.focus({ preventScroll: true }); }
  popup.addEventListener('click', function (e) { if (e.target === popup || e.target.closest('.popup-close')) closePopup(); });
  document.addEventListener('click', function (e) {
    var tr = e.target.closest('[data-popup]'); if (!tr || html.classList.contains('edit-photos')) return;
    e.preventDefault(); openPopup(tr);
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closePopup(); closeLb(); document.body.classList.remove('menu-open'); } });
  $$('form.js-form').forEach(setupForm);

  // чипы рядом с формой выставляют направление
  $$('.form-side .chip, [data-chip]').forEach(function (c) {
    c.setAttribute('role', 'button'); c.tabIndex = 0;
    c.addEventListener('click', function () {
      var sel = $('#form select[name=direction]'); if (!sel) return;
      var txt = c.textContent.trim();
      Array.prototype.some.call(sel.options, function (o) { if (o.text.indexOf(txt.slice(0, 8)) === 0 || txt.indexOf(o.text.slice(0, 8)) === 0) { sel.value = o.value || o.text; return true; } });
      $$('.chip', c.parentNode).forEach(function (x) { x.classList.toggle('is-on', x === c); });
      sel.dispatchEvent(new Event('change'));
    });
  });

  /* ---------- Лайтбокс работ ---------- */
  var lb = el('div', 'lightbox', '<button class="lb-close" aria-label="Закрыть">×</button><button class="lb-btn lb-prev" aria-label="Назад">←</button><img alt=""><button class="lb-btn lb-next" aria-label="Вперёд">→</button><div class="lb-cap"></div>');
  document.body.appendChild(lb);
  var lbList = [], lbI = 0;
  function showLb() { var it = lbList[lbI]; var im = $('img', lb); im.style.opacity = 0; im.onload = function () { im.style.opacity = 1; }; im.src = it.src; $('.lb-cap', lb).textContent = it.cap + ' · ' + (lbI + 1) + ' / ' + lbList.length; }
  function closeLb() { lb.classList.remove('is-open'); document.body.classList.remove('lock'); }
  function openLb(cards, i) {
    lbList = cards.map(function (c) { var im = $('img', c); var cap = $('.work-cap', c); return { src: im ? im.currentSrc || im.src : '', cap: cap ? $$('b, span', cap).map(function (x) { return x.textContent.trim(); }).filter(Boolean).join(' — ') || cap.textContent.trim() : 'Работа ученика' }; }).filter(function (x) { return x.src; });
    if (!lbList.length) return; lbI = Math.max(0, Math.min(i, lbList.length - 1)); showLb(); lb.classList.add('is-open'); document.body.classList.add('lock');
  }
  lb.addEventListener('click', function (e) {
    if (e.target.closest('.lb-prev')) { lbI = (lbI - 1 + lbList.length) % lbList.length; showLb(); }
    else if (e.target.closest('.lb-next')) { lbI = (lbI + 1) % lbList.length; showLb(); }
    else if (e.target === lb || e.target.closest('.lb-close')) closeLb();
  });
  document.addEventListener('keydown', function (e) {
    if (!lb.classList.contains('is-open')) return;
    if (e.key === 'ArrowRight') { lbI = (lbI + 1) % lbList.length; showLb(); }
    if (e.key === 'ArrowLeft') { lbI = (lbI - 1 + lbList.length) % lbList.length; showLb(); }
  });
  document.addEventListener('click', function (e) {
    if (html.classList.contains('edit-photos')) return;
    var card = e.target.closest('.work-card'); var more = e.target.closest('[data-gallery]');
    if (!card && !more) return;
    var sec = (card || more).closest('section'); var cards = $$('.work-card', sec);
    openLb(cards, card ? cards.indexOf(card) : 0);
  });

  /* ---------- Демо-панель для заказчика ---------- */
  var grid = el('div', 'zb-grid', '<div class="wrap">' + new Array(13).join('<i></i>') + '</div>');
  document.body.appendChild(grid);
  var panel = el('div', 'demo-panel',
    '<div class="dp-body"><h4>Демо вёрстки по макету</h4><p>Переключатели показывают, как устроена страница: что собрано в Zero Block, где стандартные блоки и как клиент сам поменяет фото.</p>' +
    '<div class="dp-row" data-cls="show-grid"><div><span>Сетка и типы блоков</span><small>Zero Block / стандартные блоки Тильды</small></div><i class="sw"></i></div>' +
    '<div class="dp-row" data-cls="show-stubs"><div><span>Как сейчас: заглушки</span><small>сайт без фото клиента, вёрстка держится</small></div><i class="sw"></i></div>' +
    '<div class="dp-row" data-cls="edit-photos"><div><span>Заменить фото кликом</span><small>кликните по любому фото и выберите своё</small></div><i class="sw"></i></div>' +
    '<div class="dp-bp">Брейкпоинт: <i data-bp="1200">1200</i><i data-bp="960">960</i><i data-bp="640">640</i><i data-bp="480">480</i><i data-bp="320">320</i></div></div>' +
    '<button class="dp-toggle" type="button"><b></b><span>Демо · Tilda Zero Block</span></button>');
  document.body.appendChild(panel);
  $('.dp-toggle', panel).addEventListener('click', function () { panel.classList.toggle('open'); });
  $$('.dp-row', panel).forEach(function (r) {
    r.addEventListener('click', function () {
      var c = r.getAttribute('data-cls'); var on = html.classList.toggle(c); r.classList.toggle('on', on);
      if (c === 'edit-photos' && on) toast('Кликните по любому фото на странице');
      if (c === 'show-stubs' && on && html.classList.contains('edit-photos')) { }
    });
  });
  var bps = $$('[data-bp]', panel);
  var bpUpd = function () {
    var w = innerWidth, cur = w >= 1200 ? 1200 : w >= 960 ? 960 : w >= 640 ? 640 : w >= 480 ? 480 : 320;
    bps.forEach(function (b) { b.classList.toggle('on', +b.dataset.bp === cur); });
  };
  addEventListener('resize', bpUpd); bpUpd();

  // ссылки-заглушки внутри демо не прыгают наверх
  $$('a[href="#"]').forEach(function (a) { if (!a.hasAttribute('data-popup')) a.addEventListener('click', function (e) { e.preventDefault(); toast('В демо этот раздел не подключён'); }); });
})();

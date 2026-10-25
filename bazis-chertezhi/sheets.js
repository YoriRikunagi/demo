/* Ядро: JSON модели -> листы чертежей (HTML + SVG). Работает в браузере и в Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Sheets = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const num = v => (Math.round(v * 10) / 10).toString().replace('.', ',');

  /* ---------- обход блоков ---------- */
  function walk(blocks, fn, parent) {
    (blocks || []).forEach(b => { fn(b, parent); walk(b.children, fn, b); });
  }

  /* ---------- аксонометрия: x вправо, y вглубь, z вверх; фронт — грань y=min ---------- */
  const proj = (x, y, z) => [(x + y) * 0.866, (x - y) * 0.5 - z];
  function isoBoxes(items, W, H, opts) {
    // items: [{box,label,id}] ; возвращает svg
    opts = opts || {};
    const faces = [];
    const order = items.slice().sort((a, b) => key(a.box) - key(b.box));
    function key(b) { return (b.x + b.dx / 2) - (b.y + b.dy / 2) + (b.z + b.dz / 2) * 0.001; }
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    const pts = [];
    order.forEach(it => {
      const b = it.box;
      [0, 1].forEach(i => [0, 1].forEach(j => [0, 1].forEach(k => {
        const p = proj(b.x + i * b.dx, b.y + j * b.dy, b.z + k * b.dz);
        minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
        minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
      })));
    });
    const padL = opts.pad || 70, padT = 14;
    const sc = Math.min((W - 2 * padL) / (maxX - minX || 1), (H - 2 * padT) / (maxY - minY || 1));
    const P = (x, y, z) => { const p = proj(x, y, z); return [padL + (p[0] - minX) * sc + ((W - 2 * padL) - (maxX - minX) * sc) / 2, padT + (p[1] - minY) * sc + ((H - 2 * padT) - (maxY - minY) * sc) / 2]; };
    let g = '';
    const anchors = [];
    order.forEach(it => {
      const b = it.box, f = opts.fill || '#fbfaf5';
      const poly = (pts, fill) => '<polygon points="' + pts.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ') + '" fill="' + fill + '" fill-opacity=".82" stroke="#222" stroke-width=".6" stroke-linejoin="round"/>';
      const x1 = b.x + b.dx, y1 = b.y + b.dy, z1 = b.z + b.dz;
      g += poly([P(b.x, b.y, z1), P(x1, b.y, z1), P(x1, y1, z1), P(b.x, y1, z1)], '#fff'); // верх
      g += poly([P(b.x, b.y, b.z), P(x1, b.y, b.z), P(x1, b.y, z1), P(b.x, b.y, z1)], f); // фронт
      g += poly([P(x1, b.y, b.z), P(x1, y1, b.z), P(x1, y1, z1), P(x1, b.y, z1)], '#ecebe3'); // правая
      if (it.label != null) anchors.push({ label: it.label, p: P(b.x + b.dx / 2, b.y, b.z + b.dz / 2), id: it.id, q: P(b.x + b.dx, b.y + b.dy / 2, b.z + b.dz / 2) });
    });
    // выноски: левые/правые, раскладываем по Y
    const mid = W / 2;
    const left = anchors.filter(a => a.p[0] < mid).sort((a, b) => a.p[1] - b.p[1]);
    const right = anchors.filter(a => a.p[0] >= mid).sort((a, b) => a.p[1] - b.p[1]);
    const place = (arr, x, side) => {
      let last = -1e9;
      arr.forEach(a => {
        let y = Math.max(a.p[1], last + 15); last = y;
        const lw = Math.max(18, String(a.label).length * 4.4 + 9);
        const cx = side < 0 ? x + lw / 2 : x - lw / 2;
        const ex = side < 0 ? x + lw : x - lw;
        g += '<line x1="' + ex + '" y1="' + y + '" x2="' + a.p[0].toFixed(1) + '" y2="' + a.p[1].toFixed(1) + '" stroke="#111" stroke-width=".5"/>' +
          '<circle cx="' + a.p[0].toFixed(1) + '" cy="' + a.p[1].toFixed(1) + '" r="1.4" fill="#111"/>' +
          '<rect x="' + (cx - lw / 2) + '" y="' + (y - 6) + '" width="' + lw + '" height="12" rx="6" fill="#fff" stroke="#111" stroke-width=".7"/>' +
          '<text x="' + cx + '" y="' + (y + 3) + '" font-size="8" text-anchor="middle" font-weight="600">' + esc(a.label) + '</text>';
      });
    };
    place(left, 4, -1); place(right, W - 4, 1);
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" xmlns="http://www.w3.org/2000/svg" font-family="Arial,Helvetica,sans-serif">' + g + '</svg>';
  }

  /* ---------- вид спереди с высотами от низа ---------- */
  function frontView(block, W, H) {
    const ps = [];
    (block.panels || []).forEach(p => (p.boxes || []).forEach(b => ps.push({ p, b })));
    const B = block.box;
    if (!ps.length || !B) return '';
    const padL = 46, padB = 26, padT = 12, padR = 22;
    const sc = Math.min((W - padL - padR) / B.dx, (H - padB - padT) / B.dz);
    const X = x => padL + x * sc, Z = z => H - padB - z * sc;
    let g = '';
    ps.sort((a, b) => (a.p.role === 'back' ? -1 : 0) - (b.p.role === 'back' ? -1 : 0));
    ps.forEach(({ p, b }) => {
      const dash = p.role === 'facade' ? ' stroke-dasharray="3 2"' : '';
      const fill = p.role === 'back' ? '#f3f3f3' : p.role === 'facade' ? 'none' : '#fff';
      g += '<rect x="' + X(b.x) + '" y="' + Z(b.z + b.dz) + '" width="' + b.dx * sc + '" height="' + b.dz * sc + '" fill="' + fill + '" stroke="#111" stroke-width=".8"' + dash + '/>';
    });
    // высоты от низа: верхние грани полок и ящиков
    const hs = [...new Set(ps.filter(o => o.p.role === 'shelf' || o.p.role === 'drawer').map(o => Math.round(o.b.z + o.b.dz)))].sort((a, b) => a - b);
    const dx = padL - 18;
    g += '<line x1="' + dx + '" y1="' + Z(0) + '" x2="' + dx + '" y2="' + Z(B.dz) + '" stroke="#111" stroke-width=".5"/>';
    hs.concat([0, B.dz]).forEach(h => {
      g += '<line x1="' + (dx - 4) + '" y1="' + Z(h) + '" x2="' + (X(0) + 2) + '" y2="' + Z(h) + '" stroke="#111" stroke-width=".35" stroke-dasharray="1.5 1.5"/>';
    });
    hs.forEach(h => {
      g += '<text x="' + (dx - 3) + '" y="' + (Z(h) - 2) + '" font-size="8" text-anchor="end">' + h + '</text>';
    });
    g += '<text x="' + (X(B.dx) + 14) + '" y="' + (Z(B.dz / 2)) + '" font-size="8" transform="rotate(90 ' + (X(B.dx) + 14) + ' ' + Z(B.dz / 2) + ')" text-anchor="middle">' + B.dz + '</text>' +
      '<line x1="' + (X(B.dx) + 10) + '" y1="' + Z(0) + '" x2="' + (X(B.dx) + 10) + '" y2="' + Z(B.dz) + '" stroke="#111" stroke-width=".5"/>' +
      '<line x1="' + X(0) + '" y1="' + (Z(0) + 10) + '" x2="' + X(B.dx) + '" y2="' + (Z(0) + 10) + '" stroke="#111" stroke-width=".5"/>' +
      '<text x="' + (X(B.dx / 2)) + '" y="' + (Z(0) + 20) + '" font-size="8" text-anchor="middle">' + B.dx + '</text>';
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" xmlns="http://www.w3.org/2000/svg" font-family="Arial,Helvetica,sans-serif">' + g + '</svg>';
  }

  /* ---------- таблицы ---------- */
  const ul = (v, n) => n >= 2 ? '<span class="e2">' + num(v) + '</span>' : n === 1 ? '<span class="e1">' + num(v) + '</span>' : num(v);
  function panelSpec(block, bid) {
    const by = {};
    (block.panels || []).forEach((p, i) => { (by[p.mat] = by[p.mat] || []).push([p, i]); });
    let h = '<div class="cap">Спецификация — панели</div><table class="spec"><tr><th>Поз.</th><th>Наименование</th><th>Т</th><th>Кол.</th><th>Длина</th><th>Ширина</th><th>Паз</th></tr>';
    Object.keys(by).forEach(m => {
      const cnt = by[m].reduce((s, [p]) => s + (+p.qty || 0), 0);
      h += '<tr class="grp"><td colspan="7">' + esc(m) + ' — ' + cnt + ' шт</td></tr>';
      by[m].forEach(([p, i]) => {
        const e = p.edge || {};
        const el = (e.l || [0, 0]).reduce((a, b) => a + b, 0), ew = (e.w || [0, 0]).reduce((a, b) => a + b, 0);
        h += '<tr><td>' + esc(p.pos) + '</td>' + ed(bid, i, 'name', p.name, 'l') + '<td>' + esc(p.t) + '</td>' + ed(bid, i, 'qty', p.qty, 'c') +
          ed(bid, i, 'l', p.l, 'c', ul(p.l, el)) + ed(bid, i, 'w', p.w, 'c', ul(p.w, ew)) + ed(bid, i, 'groove', p.groove || '', 'c') + '</tr>';
      });
    });
    return h + '</table><div class="small">' + esc((block._edgeNote) || '') + '</div>';
  }
  function ed(bid, i, f, v, al, shown) {
    return '<td class="ce ' + al + '" data-b="' + esc(bid) + '" data-i="' + i + '" data-f="' + f + '">' + (shown != null ? shown : esc(v)) + '</td>';
  }
  function hwTable(list, title) {
    list = list || [];
    const total = list.reduce((s, h) => s + (+h.qty || 0), 0);
    let h = '<div class="cap">' + title + ' — ' + (list.length ? total + ' шт' : 'нет') + '</div>';
    if (!list.length) return h;
    h += '<table class="spec"><tr><th style="width:28px">№</th><th>Наименование</th><th style="width:44px">Кол.</th></tr>';
    list.forEach((x, i) => { h += '<tr><td class="c">' + (i + 1) + '</td><td>' + esc(x.name) + '</td><td class="c">' + esc(x.qty) + '</td></tr>'; });
    return h + '</table>';
  }
  function blocksTable(model) {
    let rows = '';
    model.blocks.forEach(b => {
      const s = b.size || {};
      rows += '<tr><td class="c">' + esc(b.id) + '</td><td>' + esc(b.name) + '</td><td class="c">' + (s.w ? s.w + 'x' + s.h + 'x' + s.d : '') + '</td><td class="c">' + (b.partsCount != null ? b.partsCount : countParts(b)) + '</td></tr>';
    });
    return '<div class="cap">Спецификация — блоки</div><table class="spec"><tr><th style="width:36px">№</th><th>Блок</th><th>Габарит ШxВxГ</th><th style="width:44px">Дет.</th></tr>' + rows + '</table>';
  }
  function countParts(b) { let n = 0; walk([b], x => (x.panels || []).forEach(p => n += +p.qty || 0)); return n; }
  function childTable(b) {
    let rows = '';
    b.children.forEach(c => {
      const s = c.size || {};
      rows += '<tr><td>' + esc(c.id) + '</td><td>' + esc(c.name) + (s.w ? ' (' + s.w + 'x' + s.h + 'x' + s.d + ')' : '') + '</td><td class="c">1</td><td></td><td></td><td></td></tr>';
    });
    return '<div class="cap">Спецификация — панели</div><table class="spec"><tr><th>Поз.</th><th>Наименование</th><th>Кол.</th><th>Длина</th><th>Ширина</th><th>Паз</th></tr><tr class="grp"><td colspan="6">Сборочные единицы (свой лист) — ' + b.children.length + ' шт</td></tr>' + rows + '</table>';
  }

  /* ---------- деталь с присадкой ---------- */
  function detailSvg(p, W, H) {
    const padL = 34, padB = 28, padT = 14, padR = 28;
    const sc = Math.min((W - padL - padR) / p.l, (H - padT - padB) / p.w);
    const X = x => padL + x * sc, Y = y => H - padB - y * sc;
    let g = '<rect x="' + X(0) + '" y="' + Y(p.w) + '" width="' + p.l * sc + '" height="' + p.w * sc + '" fill="#fff" stroke="#111" stroke-width=".8"/>';
    const e = p.edge || {}, ec = '#c0392b';
    const line = (x1, y1, x2, y2) => g += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + ec + '" stroke-width="2.4"/>';
    if ((e.w || [])[0]) line(X(0), Y(0), X(0), Y(p.w));
    if ((e.w || [])[1]) line(X(p.l), Y(0), X(p.l), Y(p.w));
    if ((e.l || [])[0]) line(X(0), Y(0), X(p.l), Y(0));
    if ((e.l || [])[1]) line(X(0), Y(p.w), X(p.l), Y(p.w));
    const dr = p.drill || [];
    if (!dr.length) g += '<text x="' + X(p.l / 2) + '" y="' + Y(p.w / 2) + '" font-size="10" text-anchor="middle">Без присадки</text>';
    dr.forEach((d, i) => {
      g += '<circle cx="' + X(d.x) + '" cy="' + Y(d.y) + '" r="' + Math.max(1.6, d.d / 2 * sc) + '" fill="none" stroke="#111" stroke-width=".7"/>' +
        '<line x1="' + (X(d.x) - 3) + '" y1="' + Y(d.y) + '" x2="' + (X(d.x) + 3) + '" y2="' + Y(d.y) + '" stroke="#111" stroke-width=".3"/>' +
        '<line x1="' + X(d.x) + '" y1="' + (Y(d.y) - 3) + '" x2="' + X(d.x) + '" y2="' + (Y(d.y) + 3) + '" stroke="#111" stroke-width=".3"/>';
    });
    g += '<line x1="' + X(0) + '" y1="' + (Y(0) + 12) + '" x2="' + X(p.l) + '" y2="' + (Y(0) + 12) + '" stroke="#111" stroke-width=".5"/>' +
      '<text x="' + X(p.l / 2) + '" y="' + (Y(0) + 23) + '" font-size="9" text-anchor="middle">' + p.l + '</text>' +
      '<line x1="' + (X(0) - 12) + '" y1="' + Y(0) + '" x2="' + (X(0) - 12) + '" y2="' + Y(p.w) + '" stroke="#111" stroke-width=".5"/>' +
      '<text x="' + (X(0) - 15) + '" y="' + Y(p.w / 2) + '" font-size="9" text-anchor="middle" transform="rotate(-90 ' + (X(0) - 15) + ' ' + Y(p.w / 2) + ')">' + p.w + '</text>';
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" xmlns="http://www.w3.org/2000/svg" font-family="Arial,Helvetica,sans-serif">' + g + '</svg>';
  }
  function drillTable(p) {
    if (!(p.drill || []).length) return '';
    let r = '';
    p.drill.forEach((d, i) => { r += '<tr><td class="c">' + (i + 1) + '</td><td class="c">' + d.x + '</td><td class="c">' + d.y + '</td><td class="c">Ø' + d.d + '</td><td class="c">' + d.depth + '</td></tr>'; });
    return '<div class="cap">Присадка (от левого нижнего угла детали, мм)</div><table class="spec"><tr><th>№</th><th>X</th><th>Y</th><th>Диаметр</th><th>Глубина</th></tr>' + r + '</table>';
  }
  function edgeText(p) {
    const e = p.edge || {}, s = [];
    if ((e.l || [])[0]) s.push('низ'); if ((e.w || [])[1]) s.push('прав'); if ((e.l || [])[1]) s.push('верх'); if ((e.w || [])[0]) s.push('лев');
    return s.length ? 'Кромка: ' + (p.edgeMat || '') + ' — ' + s.join(', ') + '.' : 'Без кромки.';
  }

  /* ---------- листы ---------- */
  // блоки с layout:"illustrative" не имеют координат в модели — ставим их в ряд
  function row(items) {
    if (!items.some(i => i.layout === 'illustrative')) return false;
    let x = 0; items.forEach(i => { i.box.x = x; i.box.y = 0; i.box.z = 0; x += i.box.dx + 120; });
    return true;
  }
  // числа из JSON приводим к Number: они идут в разметку без экранирования
  function normalize(model) {
    const N = o => o && Object.keys(o).forEach(k => { if (typeof o[k] !== 'object') o[k] = +o[k] || 0; });
    walk(model.blocks, b => {
      N(b.size); N(b.box);
      (b.panels || []).forEach(p => { ['l', 'w', 't', 'qty'].forEach(k => p[k] = +p[k] || 0); (p.boxes || []).forEach(N); (p.drill || []).forEach(N); });
    });
  }
  function buildSheets(model, opt) {
    opt = opt || {};
    normalize(model);
    const sheets = [];
    const flat = []; walk(model.blocks, (b, par) => flat.push({ b, par }));
    const idIdx = {}; flat.forEach(f => idIdx[f.b.id] = f.b);
    const en = model.edgeNote || '';
    flat.forEach(f => f.b._edgeNote = en);

    // 1. общий вид
    const top = model.blocks[0];
    const items = [];
    walk(model.blocks, b => { if (b.box) items.push({ box: Object.assign({}, b.box), label: b.id, layout: b.layout }); });
    // условная расстановка в ряд, если блоки заданы без абсолютных координат
    const rowGen = row(items);
    sheets.push({ id: 'general', kind: 'general', title: 'Общий вид', sub: '', fig: items.length ? isoBoxes(items, 480, 300) : '', figNote: rowGen ? 'Расстановка блоков условная: в выгрузке нет координат блоков в модели.' : '',
      tables: blocksTable(model) + hwTable(model.hardware, 'Фурнитура — вся модель') });

    // 2. листы блоков
    flat.forEach(({ b, par }) => {
      const hasP = (b.panels || []).length, hasC = (b.children || []).length;
      if (!hasP && !hasC) return;
      const s = b.size || {};
      let fig = '', front = '', tables = '';
      if (hasC) {
        const its = []; b.children.forEach(c => c.box && its.push({ box: Object.assign({}, c.box), label: c.id, layout: c.layout }));
        row(its);
        fig = its.length ? isoBoxes(its, 480, 250) : '';
        tables = childTable(b);
      } else {
        const its = [];
        b.panels.forEach(p => (p.boxes || []).forEach(bx => its.push({ box: bx, label: p.pos, id: p.pos })));
        fig = its.length ? isoBoxes(its, 300, 270, { pad: 40 }) : '';
        front = frontView(b, 220, 270);
        tables = panelSpec(b, b.id);
      }
      tables += hwTable(b.hardware, 'Фурнитура блока');
      sheets.push({ id: 'blk-' + b.id, kind: 'block', title: b.id + '. ' + b.name, sub: s.w ? 'Ш ' + s.w + ' × Г ' + s.d + ' × В ' + s.h + ' мм' : '',
        fig, front, tables, figNote: (!fig && hasP) ? 'Геометрия панелей (box) для этого блока не выгружена — 3D не строится.' : '' });
    });

    // 3. детальные
    if (opt.detail) {
      flat.forEach(({ b }) => (b.panels || []).forEach((p, i) => {
        sheets.push({ id: 'det-' + b.id + '-' + i, kind: 'detail', title: b.id + ' ' + p.name, sub: '',
          fig: detailSvg(p, 480, 360), tables: drillTable(p), edge: edgeText(p),
          stamp: [['Заказ', model.order], ['Блок', b.id + ' ' + b.name], ['Материал', p.mat], ['Деталь №', p.pos], ['Кол-во', p.qty], ['Размер с кромкой', p.l + 'x' + p.w], ['Толщина', p.t]] });
      }));
    }
    return sheets;
  }

  function sheetHtml(s, n, N, model) {
    const stamp = s.kind === 'detail'
      ? '<div class="stamp2">' + s.stamp.concat([['Лист', n + ' / ' + N]]).map(r => '<div><span>' + r[0] + '</span><b>' + esc(r[1]) + '</b></div>').join('') + '</div>'
      : '<div class="stamp"><div class="st1"><b>' + esc(s.title) + '</b></div><div><span>Заказ:</span>' + esc(model.order) + '</div><div><span>Дата:</span>' + esc(model.date) + '</div><div><span>Лист:</span>' + n + ' / ' + N + '</div></div>';
    const figs = s.kind === 'block' && s.front
      ? '<div class="figs"><div style="flex:300">' + s.fig + '</div><div style="flex:220">' + s.front + '</div></div>'
      : '<div class="figs"><div style="flex:1">' + (s.fig || '') + '</div></div>';
    return '<section class="sheet ' + s.kind + '" id="' + esc(s.id) + '" data-sheet="' + esc(s.id) + '"><div class="frame">' +
      '<div class="order">Заказ: ' + esc(model.order) + '</div>' +
      '<h2>' + esc(s.title) + '</h2>' + (s.sub ? '<div class="sub">' + esc(s.sub) + '</div>' : '') +
      figs + (s.figNote ? '<div class="small note-i">' + esc(s.figNote) + '</div>' : '') +
      (s.edge ? '<div class="small">' + esc(s.edge) + '</div>' : '') +
      '<div class="tbls">' + (s.tables || '') + '</div>' + stamp + '<div class="notes"></div></div></section>';
  }
  function render(model, opt) {
    const sheets = buildSheets(model, opt);
    return { sheets, html: sheets.map((s, i) => sheetHtml(s, i + 1, sheets.length, model)).join('') };
  }

  const css = `
.sheet{width:210mm;height:297mm;background:#fff;color:#111;position:relative;box-sizing:border-box;padding:5mm;margin:0 auto 14px;font:11px/1.3 Arial,Helvetica,sans-serif;overflow:hidden;box-shadow:0 1px 8px #0003;page-break-after:always;break-after:page}
.frame{border:.35mm solid #111;border-radius:4mm;height:100%;position:relative;padding:7mm 8mm 0;box-sizing:border-box}
.order{display:inline-block;border:.35mm solid #111;padding:1.5mm 3mm;font-weight:700;font-size:10px;margin-bottom:4mm}
.sheet h2{font-size:21px;margin:0 0 1mm}.sub{color:#666;font-size:10px;margin-bottom:2mm}
.figs{display:flex;gap:4mm;align-items:center;margin:3mm 0}
.cap{text-align:center;margin:3mm 0 1mm;font-size:11px}
table.spec{border-collapse:collapse;width:100%;font-size:9.5px;margin-bottom:1mm}
table.spec th,table.spec td{border:.25mm solid #111;padding:.8mm 1.6mm;text-align:left;vertical-align:top}
table.spec th{background:#f2f2f2;font-weight:700}tr.grp td{background:#f3ead8;font-weight:600}
.c{text-align:center}.e1{text-decoration:underline}.e2{text-decoration:underline;text-decoration-style:double}
.small{font-size:8px;color:#555;margin-top:1mm}.note-i{font-style:italic}
.stamp{position:absolute;left:8mm;right:8mm;bottom:6mm;display:flex;border:.35mm solid #111}
.stamp>div{border-right:.25mm solid #111;padding:2mm 3mm;flex:1;font-size:12px}.stamp>div:last-child{border:0}
.stamp .st1{flex:1.8;font-size:15px;display:flex;align-items:center}.stamp span{display:block;color:#777;font-size:8px;margin-bottom:1mm}
.stamp2{position:absolute;left:8mm;right:8mm;bottom:6mm;display:grid;grid-template-columns:repeat(4,1fr);border:.35mm solid #111}
.stamp2>div{border-right:.25mm solid #111;border-top:.25mm solid #111;padding:1.4mm 2.4mm;font-size:10px}.stamp2 span{display:block;color:#777;font-size:8px}
.notes{position:absolute;inset:0;pointer-events:none}
.note{position:absolute;pointer-events:auto;color:#c0392b;font:600 12px Arial;background:#fff8;border:1px dashed #c0392b;padding:1px 4px;min-width:30px;cursor:move;white-space:pre-wrap}
body.noting .sheet{cursor:crosshair}body.editing td.ce{outline:1px dashed #1f6feb55;cursor:text}
@page{size:A4;margin:0}
@media print{.sheet{margin:0;box-shadow:none}.note{border-color:transparent;background:none}}
`;
  return { build: buildSheets, render, css, esc };
});

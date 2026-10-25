#!/usr/bin/env node
// Использование: node cli.js model.json out.html [--detail]
// Собирает один самодостаточный HTML со всеми листами (открывается без сервера, печать в PDF из браузера).
const fs = require('fs');
const S = require('./sheets.js');
const [, , inp, out, flag] = process.argv;
if (!inp || !out) { console.error('node cli.js model.json out.html [--detail]'); process.exit(1); }
const model = JSON.parse(fs.readFileSync(inp, 'utf8'));
const r = S.render(model, { detail: flag === '--detail' });
fs.writeFileSync(out, '<!doctype html><html lang="ru"><meta charset="utf-8"><title>' + S.esc(model.order) + '</title><style>body{margin:0;background:#e9eaee}' + S.css + '</style><body>' + r.html + '</body></html>');
console.log('листов: ' + r.sheets.length + ' -> ' + out);

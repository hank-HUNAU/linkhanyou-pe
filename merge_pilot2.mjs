/* ============================================================
 * merge_pilot2.mjs — 把已签批的 pilot #2 种子并入 _sealed_backup/annotate-data.js 的 SEEDS
 * 来源：reports/种子标注_pilot2_seg1决赛迪拜_待复核.csv（15 行，专家 2026-10-20 全收）
 * 处理：
 *   · CSV 备注末尾 "(AI初判·待专家复核)" → "(AI初判·2026-10-20 专家签批)"（标记已签批）
 *   · 拼接到 SEEDS 数组（在 "];\nconst PRE =" 之前）
 *   · 写回后整体通过 Function 解析校验，确保仍是合法 JS
 * 这只是"明文合并"一步；之后由 seal_content.mjs 重新加封。
 * ============================================================ */
import fs from 'fs';
import path from 'path';
const ROOT = process.cwd();
const SRC = path.join(ROOT, '_sealed_backup/annotate-data.js');
const CSV = path.join(ROOT, 'reports/种子标注_pilot2_seg1决赛迪拜_待复核.csv');

/* --- 解析 CSV（支持引号内逗号/换行/双引号转义） --- */
function parseCSV(text) {
  const rows = []; let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim() !== ''));
}
const escJs = (s) => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'";

const raw = fs.readFileSync(CSV, 'utf8').replace(/^﻿/, '');
const rows = parseCSV(raw);
const header = rows[0];
const ci = Object.fromEntries(header.map((h, i) => [h.trim(), i]));
const approved = rows.slice(1).map(r => ({
  k: r[ci['pair_key']],
  span: r[ci['片段']],
  tag: r[ci['标签']],
  sev: r[ci['严重度']],
  fix: r[ci['建议改法']],
  note: r[ci['备注']].replace('(AI初判·待专家复核)', '(AI初判·2026-10-20 专家签批)')
})).filter(x => x.k);
console.log('读到已签批候选：', approved.length, '条');

/* --- 载入明文，定位 SEEDS 数组边界 --- */
let txt = fs.readFileSync(SRC, 'utf8').replace(/^﻿/, '');
const m = txt.match(/const SEEDS = \[([\s\S]*?)\];\nconst PRE =/);
if (!m) { console.error('✗ 未找到 SEEDS 数组边界（const SEEDS = [ ... ];\nconst PRE =）'); process.exit(1); }
const oldBody = m[1];

/* --- 加载旧 SEEDS + 按 (k, 片段) 去重（同一句可有多条不同错误种子，互补不算重复） --- */
const oldSeeds = new Function(txt + '\nreturn { SEEDS };')().SEEDS;
const oldKS = new Set(oldSeeds.map(s => s.k + ' ' + s.span));
const dup = approved.filter(a => oldKS.has(a.k + ' ' + a.span));
const add = approved.filter(a => !oldKS.has(a.k + ' ' + a.span));
if (dup.length) console.log('⚠ 以下 (k,片段) 已存在，跳过：', dup.map(d => d.k + '「' + d.span + '」').join(' / '));
if (!add.length) { console.error('✗ 没有可新增的种子'); process.exit(1); }

/* --- 拼接新条目（仅 add 部分） --- */
const newEntries = add.map(a =>
  `  { k:${escJs(a.k)}, span:${escJs(a.span)}, tag:${escJs(a.tag)}, sev:${escJs(a.sev)}, fix:${escJs(a.fix)}, note:${escJs(a.note)} }`
).join(',\n');
const replacement = 'const SEEDS = [' + oldBody + ',\n' + newEntries + '\n];\nconst PRE =';
const newTxt = txt.replace(m[0], replacement);

/* --- 写回 + 校验 --- */
fs.writeFileSync(SRC, '﻿' + newTxt, 'utf8');
const after = new Function(fs.readFileSync(SRC, 'utf8').replace(/^﻿/, '') + '\nreturn { SEEDS, CORPUS_PAIRS, PRE, FLAGS, SCHEME };')();
console.log('✓ 合并后 SEEDS 总数：', after.SEEDS.length, '（原', oldSeeds.length, '+ 新增', add.length, dup.length ? '，跳过' + dup.length + ' 条重复' : '');
const newKS = new Set(after.SEEDS.map(s => s.k + ' ' + s.span));
const missing = add.filter(a => !newKS.has(a.k + ' ' + a.span));
console.log(missing.length ? ('✗ 缺失：' + missing.map(d => d.k).join(',')) : '✓ 新种子均已落位');
console.log('✓ 全文 Function 解析通过（仍合法 JS）');

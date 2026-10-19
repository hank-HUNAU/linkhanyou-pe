/* ============================================================
 * gen_seed_candidates.mjs — 种子标注候选生成管线（第 9 项）
 * ------------------------------------------------------------
 * 用途：从明文全量 dump（_sealed_backup/annotate-data.js）读取
 *       CORPUS_PAIRS + SEEDS，对「尚未有金标准种子」的句对，
 *       用 build_corpus.mjs 已验证的 classifyPairChunk 逻辑做
 *       【候选】标注，输出 reports/种子标注_候选_待复核.csv。
 *
 * 硬约束（来自训练平台数据规约）：
 *   · 种子 = F1 评分金标准，机器产出只能进「候选区」，
 *     必须人工逐条复核、签字后才并入种子标注_pair_annotations.csv。
 *   · 本脚本【绝不】改写生产种子；只产出待复核文件。
 *   · 与线上「LLM预标注_待校对.csv / PRE」同一隔离思路：
 *     候选物理隔离于金标准。
 *
 * 复用 build_corpus.mjs 的核心分类器（保证口径一致）：
 *   dtok / tokenizeIdx / align / classifyPairChunk / termHit 等。
 *   （术语表 CSV 不在本仓库，termHit 恒为 false —— M4 术语类
 *     候选召回偏低，留待人工复核补齐，已在输出 note 标注。）
 *
 * 用法：node gen_seed_candidates.mjs
 * ============================================================ */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, '_sealed_backup/annotate-data.js');
if (!fs.existsSync(SRC)) { console.error('找不到明文 dump：', SRC); process.exit(1); }

/* --- 载入明文全量 dump（顶层 const，用 Function 包一层取回） --- */
let srcTxt = fs.readFileSync(SRC, 'utf8').replace(/^﻿/, '');
const mod = new Function(srcTxt + '\nreturn { CORPUS_PAIRS, SEEDS, PRE, FLAGS, SCHEME };')();
const PAIRS = mod.CORPUS_PAIRS || [];
const SEEDS = mod.SEEDS || [];
const SCHEME = mod.SCHEME || [];
console.log('载入：', PAIRS.length, '句对 /', SEEDS.length, '条金标准种子');

/* --- 复用 build_corpus.mjs 的 M 标签与默认严重度 --- */
const M_LABEL = { M1: '误译', M2: '漏译', M3: '增译', M4: '术语', M5: '单位格式', M6: '语法搭配', M7: '拼写标点', M8: '风格语域', M9: '格式标记', M0: '无需修改' };
const SEV_OF = Object.fromEntries(SCHEME.map(r => [r[0], r[2]])); // M1->Major ...
const RE = /[一-鿿]|[A-Za-z]+(?:'[a-z]+)?|\d+(?:\.\d+)?%?|[^\s]/g;

/* --- 带字符偏移的 tokenizer（与 build_corpus 的 dtok 同口径） --- */
function tokenizeIdx(s) {
  const out = []; let m;
  RE.lastIndex = 0;
  while ((m = RE.exec(s))) out.push({ t: m[0], s: m.index, e: m.index + m[0].length });
  return out;
}
/* --- token 级对齐（LCS，记录来自 A/B 的索引，用于回算字符偏移） --- */
function align(A, B) {
  const n = A.length, m = B.length;
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    dp[i][j] = A[i].t === B[j].t ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops = []; let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i].t === B[j].t) { ops.push({ op: 'same', a: A[i], b: B[j] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ op: 'del', a: A[i] }); i++; }
    else { ops.push({ op: 'ins', b: B[j] }); j++; }
  }
  while (i < n) { ops.push({ op: 'del', a: A[i] }); i++; }
  while (j < m) { ops.push({ op: 'ins', b: B[j] }); j++; }
  return ops;
}

/* --- classifyPairChunk（与 build_corpus.mjs 完全一致，termHit 恒 false） --- */
const punctOnly = (s) => !!s && !/[0-9A-Za-z一-鿿]/.test(s);
const GLOSS_RE = /[（(]\s*[A-Za-z][A-Za-z0-9 .'’\-]{1,40}\s*[）)]/;
function termHit() { return false; } // 术语表 CSV 不在本仓库
function classifyPairChunk(del, ins) {
  const d = del.join(''), s = ins.join('');
  if (d.replace(/\s+/g, '') === s.replace(/\s+/g, '')) return 'M9';
  const dt = d.replace(/\s+/g, ''), st = s.replace(/\s+/g, '');
  if (termHit(dt) || termHit(st)) return 'M4';
  if (st && GLOSS_RE.test(st) && !GLOSS_RE.test(dt)) return 'M4';
  if (/[0-9]/.test(dt) || /[0-9]/.test(st)) return 'M5';
  if (punctOnly(dt) || punctOnly(st)) return 'M7';
  if (!dt) return 'M2';
  if (!st) return 'M3';
  const dn = del.filter(t => t.trim()).length, sn = ins.filter(t => t.trim()).length;
  if (dn >= 2 && sn >= 2 && Math.max(dt.length, st.length) >= 6 && Math.abs(dt.length - st.length) <= 2) return 'M8';
  if (st.length - dt.length >= 4) return 'M2';
  if (dt.length - st.length >= 4) return 'M3';
  return 'M1';
}

/* --- 单句对 → 候选（取「最大差异块」一条，控住人工复核量） --- */
function bestCandidate(p) {
  if (!p.mt || !p.ref) return null;
  if (p.mt.replace(/\s+/g, '') === p.ref.replace(/\s+/g, '')) return null; // M0 无需改，跳过
  const A = tokenizeIdx(p.mt), B = tokenizeIdx(p.ref);
  const ops = align(A, B);
  // 切分为 chunk（连续非 same 区）
  const chunks = [];
  let cur = null;
  const flush = () => { if (cur && cur.del.length) { chunks.push(cur); cur = null; } };
  ops.forEach(o => {
    if (o.op === 'same') { flush(); return; }
    if (!cur) cur = { del: [], ins: [] };
    if (o.op === 'del') cur.del.push(o.a); else cur.ins.push(o.b);
  });
  flush();
  if (!chunks.length) return null;
  // 取 span 最长（最显著）的块
  chunks.sort((x, y) => (y.del[y.del.length - 1].e - y.del[0].s) - (x.del[x.del.length - 1].e - x.del[0].s));
  const c = chunks[0];
  const d0 = c.del[0], d1 = c.del[c.del.length - 1];
  const span = p.mt.substring(d0.s, d1.e);
  if (!span.trim()) return null;
  const i0 = c.ins[0], i1 = c.ins[c.ins.length - 1];
  const insText = c.ins.length ? p.ref.substring(i0.s, i1.e) : '';
  const tag = classifyPairChunk(c.del.map(t => t.t), c.ins.map(t => t.t));
  const sev = SEV_OF[tag] || 'Minor';
  // 修复后全文 = mt 中该片段替换为正文
  const fix = p.mt.substring(0, d0.s) + insText + p.mt.substring(d1.e);
  // 置信度
  const ratio = span.length / Math.max(1, p.mt.length);
  let conf = 1;
  if (ratio > 0.7) conf -= 0.5; else if (ratio > 0.45) conf -= 0.2;
  if (['M1', 'M4', 'M5', 'M6'].includes(tag)) conf += 0.1;
  if (['M8', 'M3', 'M9'].includes(tag)) conf -= 0.1;
  if (chunks.length > 1) conf -= 0.1;
  conf = Math.max(0, Math.min(1, conf));
  const bucket = conf >= 0.8 ? '高' : conf >= 0.5 ? '中' : '低';
  return {
    k: p.k, ed: p.ed, stage: p.stage, dir: p.dir,
    span, tag, sev, fix,
    note: `规则候选·字符对齐+classifyPairChunk·待专家复核（维度=${M_LABEL[tag] || tag}；差异块${chunks.length}个取最长；术语表缺失→M4召回偏低）`,
    conf: conf.toFixed(2), bucket
  };
}

/* --- 主流程 --- */
const seeded = new Set(SEEDS.map(s => s.k));
const rows = [];
let skipM0 = 0, skipNoMt = 0;
PAIRS.forEach(p => {
  if (seeded.has(p.k)) return;          // 已有金标准
  if (!p.mt) { skipNoMt++; return; }
  const cand = bestCandidate(p);
  if (!cand) { skipM0++; return; }
  rows.push(cand);
});
// 按置信度降序，便于从高质量开始复核
rows.sort((a, b) => parseFloat(b.conf) - parseFloat(a.conf));

/* --- 输出 CSV（列对齐金标准 schema：pair_key/片段/标签/严重度/建议改法/备注 + 复核辅助列） --- */
const escCsv = (s) => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
const header = ['pair_key', '片段', '标签', '严重度', '建议改法', '备注', 'ed', 'stage', 'dir', '置信度', '置信档', '算法'];
const lines = [header.join(',')];
rows.forEach(r => lines.push([
  escCsv(r.k), escCsv(r.span), escCsv(r.tag), escCsv(r.sev), escCsv(r.fix), escCsv(r.note),
  escCsv(r.ed), escCsv(r.stage), escCsv(r.dir), escCsv(r.conf), escCsv(r.bucket), escCsv('gen_seed_candidates.mjs')
].join(',')));
const outPath = path.join(ROOT, 'reports', '种子标注_候选_待复核.csv');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, '﻿' + lines.join('\n'), 'utf8');

/* --- 统计 --- */
const byTag = {}, byBucket = { 高: 0, 中: 0, 低: 0 };
rows.forEach(r => { byTag[r.tag] = (byTag[r.tag] || 0) + 1; byBucket[r.bucket]++; });
console.log('\n=== 候选生成完成 ===');
console.log('待复核候选总数：', rows.length);
console.log('跳过（已有种子）：', seeded.size, '｜ 跳过（MT 缺失）：', skipNoMt, '｜ 跳过（M0 无需改）：', skipM0);
console.log('按标签：', Object.entries(byTag).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}(${M_LABEL[k] || k}):${v}`).join('  '));
console.log('按置信档：', `高:${byBucket.高} 中:${byBucket.中} 低:${byBucket.低}`);
console.log('输出：', outPath);

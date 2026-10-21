/* ============================================================
 * gen_pilot3_seeds.mjs — 第 9 项 pilot #3：seg_1_决赛 5G 段（42-65）AI 初判候选
 * ------------------------------------------------------------
 * 由 agent 逐对读 MT/REF 人工判断，遵循「最小改动」教学法：
 *   片段 = 错误 MT 子串（必须可在 MT 中划选）；建议改法 = 仅替换该片段后的整句。
 * 每条均经校验：k 必须存在于 CORPUS_PAIRS；片段必须是 MT 子串。
 * 输出 reports/种子标注_pilot3_seg1决赛5G_待复核.csv（列对齐金标准 schema）。
 * 注：本批不含 M0（整句无错）种子——M0 种子在 submitAnn 计分中存在假 FN bug（已 pilot #2 修复）。
 * 46/48/52 已有原种子（never mind / another one / Chewy），本批不重复，仅补同句其他错误（若有）。
 * ============================================================ */
import fs from 'fs';
import path from 'path';
const ROOT = process.cwd();
const SRC = path.join(ROOT, '_sealed_backup/annotate-data.js');
let srcTxt = fs.readFileSync(SRC, 'utf8').replace(/^﻿/, '');
const mod = new Function(srcTxt + '\nreturn { CORPUS_PAIRS, SEEDS };')();
const PAIRS = mod.CORPUS_PAIRS;
const PM = Object.fromEntries(PAIRS.map(p => [p.k, p]));

/* k -> { span, tag, sev, fix, note }；覆盖 seg_1_决赛_42..65（46/48/52 已有种子，跳过） */
const AUTH = {
  'seg_1_决赛_44': { span: '有了 5G 的希望', tag: 'M1', sev: 'Major', fix: 'AT&T Mobility，Verizon Wireless，以及 T-Mobile 和 Sprint 的配对，现在都很快就承诺会带来 5G。', note: 'promising 在此为「承诺/许诺」（运营商承诺 5G 将至），机翻「有了 5G 的希望」把 promising 误读为 hopeful（有希望），主谓关系颠倒。(AI初判·待专家复核)' },
  'seg_1_决赛_45': { span: '在捣鬼', tag: 'M1', sev: 'Minor', fix: '他们在说谎。', note: 'fibbing 指「说谎/扯谎」（小谎），机翻「捣鬼」偏「捣乱/耍花招」，未落实「说谎」义；参考作「食言」。(AI初判·待专家复核)' },
  'seg_1_决赛_51': { span: '增强型移动宽带', tag: 'M4', sev: 'Minor', fix: '增强移动宽带（eMBB），这是 5G 的三种风格之一，是你将使用的智能手机。', note: 'eMBB 标准术语为「增强移动宽带」（3GPP 官方，无「型」），机翻「增强型移动宽带」多一字、非标准称谓。(AI初判·待专家复核)' },
  'seg_1_决赛_51b': { span: '三种风格', tag: 'M1', sev: 'Minor', fix: '增强型移动宽带（eMBB），这是 5G 的三大应用场景之一，是你将使用的智能手机。', note: 'flavors of 5G 在此指 5G 的「类型/应用场景」，机翻「风格」按字面误译（风格=style 偏审美）；参考作「应用场景」。(AI初判·待专家复核)' },
  'seg_1_决赛_51c': { span: '是你将使用的智能手机', tag: 'M1', sev: 'Major', fix: '增强型移动宽带（eMBB），这是 5G 的三种风格之一，就是你在智能手机上使用的 5G 应用。', note: 'is the one you’ll be using with your smartphone = eMBB 是你在手机上使用的应用；机翻「是你将使用的智能手机」把 eMBB 本身误等于「智能手机」，结构错译。(AI初判·待专家复核)' },
  'seg_1_决赛_53': { span: '当一篇重要的研究论文大胆地宣布', tag: 'M1', sev: 'Minor', fix: '尽管有一份开创性的研究报告果断宣称， "毫米波移动通信的 5G 蜂窝：它会工作！"仍然存在着真正的怀疑。', note: 'While 在此为让步「尽管」，机翻「当」误作时间连词（当…时），导致「宣布」与「仍存怀疑」的转折关系丢失、读成因果。(AI初判·待专家复核)' },
  'seg_1_决赛_58': { span: '细胞塔', tag: 'M4', sev: 'Minor', fix: '那是一堆新的蜂窝基站，是不是？', note: 'cell towers 标准术语「蜂窝基站/蜂窝塔」，机翻「细胞塔」按 cell 字面误译（细胞=cell 生物义）。(AI初判·待专家复核)' },
  'seg_1_决赛_61': { span: '阻塞', tag: 'M1', sev: 'Minor', fix: 'mmWave 真的很容易被阻断。', note: 'easy to block 指信号「被阻断/阻挡」，机翻「阻塞」多用于交通/管道拥堵，信号搭配不当；参考作「阻断」。(AI初判·待专家复核)' },
  'seg_1_决赛_65': { span: '有你的信号', tag: 'M1', sev: 'Major', fix: '你的信号马上消失了。', note: 'There went your signal = 你的信号没了（走了），机翻「有你的信号」语义正好相反（把 there went 误作 have）。(AI初判·待专家复核)' },
};

const esc = s => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
const rows = [];
let bad = 0;
for (const [k, a] of Object.entries(AUTH)) {
  const pairKey = k.replace(/[bc]$/, '');
  const p = PM[pairKey];
  if (!p) { console.error('✗ 不存在的 k：', pairKey); bad++; continue; }
  if (a.tag !== 'M0' && !p.mt.includes(a.span)) {
    console.error('✗ 片段非 MT 子串：', pairKey, '→', a.span); bad++; continue;
  }
  rows.push([pairKey, a.span, a.tag, a.sev, a.fix, a.note]);
}
const header = ['pair_key', '片段', '标签', '严重度', '建议改法', '备注'];
const lines = [header.join(',')].concat(rows.map(r => r.map(esc).join(',')));
const outPath = path.join(ROOT, 'reports', '种子标注_pilot3_seg1决赛5G_待复核.csv');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, '﻿' + lines.join('\n'), 'utf8');
const byTag = {};
rows.forEach(r => byTag[r[2]] = (byTag[r[2]] || 0) + 1);
console.log('校验通过：', rows.length, '条（失败', bad, '）');
console.log('按标签：', Object.entries(byTag).sort((a, b) => b[1] - a[1]).join('  '));
console.log('输出：', outPath);

/* ============================================================
 * gen_pilot2_seeds.mjs — 第 9 项 pilot #2：seg_1_决赛 迪拜段（23-41）AI 初判候选
 * ------------------------------------------------------------
 * 由 agent 逐对读 MT/REF 人工判断，遵循「最小改动」教学法：
 *   片段 = 错误 MT 子串（必须可在 MT 中划选）；建议改法 = 仅替换该片段后的整句。
 * 每条均经校验：k 必须存在于 CORPUS_PAIRS；片段必须是 MT 子串。
 * 输出 reports/种子标注_pilot2_seg1决赛迪拜_待复核.csv（列对齐金标准 schema）。
 * ⚠ 全部为 AI 初判，须专家签批后才并入种子标注_pair_annotations.csv。
 * 注：本批不含 M0（整句无错）种子——M0 种子在 submitAnn 计分中存在假 FN bug（见 annotate.js:539-548），
 *     已另立任务修复；干净句对保持「盲标不计分」即可。
 * ============================================================ */
import fs from 'fs';
import path from 'path';
const ROOT = process.cwd();
const SRC = path.join(ROOT, '_sealed_backup/annotate-data.js');
let srcTxt = fs.readFileSync(SRC, 'utf8').replace(/^﻿/, '');
const mod = new Function(srcTxt + '\nreturn { CORPUS_PAIRS, SEEDS };')();
const PAIRS = mod.CORPUS_PAIRS;
const PM = Object.fromEntries(PAIRS.map(p => [p.k, p]));

/* k -> { span, tag, sev, fix, note }；覆盖 seg_1_决赛_23..41（35 已有种子，跳过） */
const AUTH = {
  'seg_1_决赛_23': { span: '迪拜统治者', tag: 'M4', sev: 'Major', fix: '迪拜酋长的妻子哈雅公主躲在英国，聘请离婚律师', note: 'ruler of Dubai 在专名语境应作「酋长」(Sheikh)，机翻「统治者」属普通名词，与全篇专名体例不一致（见 seg_1_决赛_35/39 统一作「酋长」）。(AI初判·待专家复核)' },
  'seg_1_决赛_24': { span: '迪拜的统治者', tag: 'M4', sev: 'Major', fix: '哈亚公主一直被认为是中东皇室世界的自由精神，在这里，礼仪和默默无闻是妇女的责任，她逃离了她的丈夫，迪拜酋长，并据报道躲在英国。', note: 'ruler of Dubai 专名应作「酋长」(Sheikh)，与全篇专名体例一致。(AI初判·待专家复核)' },
  'seg_1_决赛_24b': { span: '是妇女的责任', tag: 'M1', sev: 'Major', fix: '哈亚公主一直被认为是中东皇室世界的自由精神，在这里，礼仪和默默无闻是女性被期许的规范，她逃离了她的丈夫，迪拜的统治者，并据报道躲在英国。', note: 'expected of women 指社会对女性的期许/要求（循规蹈矩、默默无闻），机翻「责任」误将被动期望译为主动担责，语义错位。(AI初判·待专家复核)' },
  'seg_1_决赛_27': { span: 'Sheikha Latifa', tag: 'M1', sev: 'Minor', fix: '拉蒂法公主出现在一段 40 分钟的视频中，说她断断续续地被监禁了几年，并受到虐待。', note: 'Sheikha Latifa 为专名，应汉化为「拉蒂法公主」（Sheikha=公主，Latifa=拉蒂法），机翻保留英文专名与「女儿」混用，与参考译文体例不一致。(AI初判·待专家复核)' },
  'seg_1_决赛_29': { span: '哈亚公爵小姐', tag: 'M1', sev: 'Major', fix: '具有讽刺意味的是，哈雅公主的逃跑被她的丈夫揭露了，她的丈夫是一位诗人，他写了几行诗猛烈抨击他任性的新娘——这是六个新娘中最引人注目的一个。', note: 'Princess Haya 译作「哈雅公主」；机翻「哈亚公爵小姐」误将 Princess 译作「公爵小姐」(Duke\'s daughter)，且 given name 译名不统一（应为哈雅）。(AI初判·待专家复核)' },
  'seg_1_决赛_29b': { span: '六个新娘', tag: 'M1', sev: 'Minor', fix: '具有讽刺意味的是，哈亚公爵小姐的逃跑被她的丈夫揭露了，她的丈夫是一位诗人，他写了几行诗猛烈抨击他任性的新娘——这是六位妻子中最引人注目的一个。', note: 'one of six [wives] 指六位妻子，机翻「六个新娘」误将 wife 译作「新娘」(bride)，在王室多妻语境造成关系错认。(AI初判·待专家复核)' },
  'seg_1_决赛_30': { span: '迪拜统治者', tag: 'M4', sev: 'Major', fix: '这首诗的题目是“你活着，你死了”， 由迪拜酋长的儿子张贴，是关于不忠，导致猜测，这是关于哈亚公主。', note: 'ruler of Dubai 专名应作「酋长」(Sheikh)，与全篇专名体例一致。(AI初判·待专家复核)' },
  'seg_1_决赛_30b': { span: '导致猜测，这是关于哈亚公主', tag: 'M8', sev: 'Minor', fix: '这首诗的题目是“你活着，你死了”， 由迪拜统治者的儿子张贴，以不忠为主题，不免令人猜测是在影射哈雅公主。', note: 'leading to speculation it is about Princess Haya 被译作「导致猜测，这是关于哈亚公主」，语义断裂且冗余；参考以「影射」收束，衔接更顺。(AI初判·待专家复核)' },
  'seg_1_决赛_31': { span: '游戏', tag: 'M1', sev: 'Major', fix: '这首诗说:“你背叛了最珍贵的信任， 你的伎俩被揭露了。”', note: 'your game 此处指「伎俩/把戏」(trickery)，机翻「游戏」按字面误译，丢失贬抑语用。(AI初判·待专家复核)' },
  'seg_1_决赛_33': { span: '马克图姆', tag: 'M4', sev: 'Minor', fix: '这位受过牛津大学教育的公主是已故约旦国王侯赛因的女儿，甚至在她公开“摆脱”她的亿万富翁赛马主人丈夫谢赫·穆罕默德·本·拉希德·阿勒马克图之前，她就一直是一个叛逆者。', note: 'Al Maktoum 冠词 Al 应译「阿勒」，机翻「马克图姆」漏译 Al，专名不完整（参考作「阿勒马克图」）。(AI初判·待专家复核)' },
  'seg_1_决赛_36': { span: '迪拜统治者', tag: 'M4', sev: 'Major', fix: '据说这位迪拜酋长有 23 个孩子， 都是由不同的妇女生的。', note: 'ruler of Dubai 专名应作「酋长」(Sheikh)，与全篇专名体例一致。(AI初判·待专家复核)' },
  'seg_1_决赛_37': { span: '飞行', tag: 'M1', sev: 'Major', fix: '哈亚公主的出逃为本月晚些时候在伦敦法庭的摊牌铺平了道路。', note: 'flight 此处指「出逃/逃离」（Haya 逃离丈夫），机翻「飞行」按字面误译，语义完全错位。(AI初判·待专家复核)' },
  'seg_1_决赛_38': { span: '家庭法庭', tag: 'M4', sev: 'Minor', fix: '预计 7 月 30 日举行的伦敦高等法院家事法庭听证会将集中讨论公主离开迪拜后，由谁来监护他们的两个年幼的孩子。', note: 'family division court 指「家事法庭」（英国高等法院家事法庭），机翻「家庭法庭」弱化且漏译 High Court「高等法院」专名。(AI初判·待专家复核)' },
  'seg_1_决赛_39': { span: '迪拜的统治者', tag: 'M4', sev: 'Major', fix: '谢赫是阿拉伯联合酋长国副总统兼总理，同时也是迪拜的酋长，他是中东最有影响力的人物之一。', note: 'ruler of Dubai 专名应作「酋长」(Sheikh)，与全篇专名体例一致。(AI初判·待专家复核)' },
  'seg_1_决赛_41': { span: '就在拐角处', tag: 'M1', sev: 'Major', fix: '我希望 5G 490 Mbit/s 的速度和 17 毫秒的下载延迟即将到来。', note: 'just around the corner 为习语「即将到来/近在咫尺」，机翻「就在拐角处」按字面误译。(AI初判·待专家复核)' },
};

const esc = s => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
const rows = [];
let bad = 0;
for (const [k, a] of Object.entries(AUTH)) {
  const pairKey = k.replace(/b$/, '');
  const p = PM[pairKey];
  if (!p) { console.error('✗ 不存在的 k：', pairKey); bad++; continue; }
  if (a.tag !== 'M0' && !p.mt.includes(a.span)) {
    console.error('✗ 片段非 MT 子串：', pairKey, '→', a.span); bad++; continue;
  }
  rows.push([pairKey, a.span, a.tag, a.sev, a.fix, a.note]);
}
const header = ['pair_key', '片段', '标签', '严重度', '建议改法', '备注'];
const lines = [header.join(',')].concat(rows.map(r => r.map(esc).join(',')));
const outPath = path.join(ROOT, 'reports', '种子标注_pilot2_seg1决赛迪拜_待复核.csv');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, '﻿' + lines.join('\n'), 'utf8');
const byTag = {};
rows.forEach(r => byTag[r[2]] = (byTag[r[2]] || 0) + 1);
console.log('校验通过：', rows.length, '条（失败', bad, '）');
console.log('按标签：', Object.entries(byTag).sort((a, b) => b[1] - a[1]).join('  '));
console.log('输出：', outPath);

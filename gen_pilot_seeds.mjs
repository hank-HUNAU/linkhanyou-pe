/* ============================================================
 * gen_pilot_seeds.mjs — 第 9 项 pilot：seg_1_决赛 金融段（1-22）AI 初判候选
 * ------------------------------------------------------------
 * 由 agent 逐对读 MT/REF 人工判断，遵循「最小改动」教学法：
 *   片段 = 错误 MT 子串（必须可在 MT 中划选）；建议改法 = 仅替换该片段后的整句。
 * 每条均经校验：k 必须存在于 CORPUS_PAIRS；片段必须是 MT 子串。
 * 输出 reports/种子标注_pilot_seg1决赛_待复核.csv（列对齐金标准 schema）。
 * ⚠ 全部为 AI 初判，须专家逐条签批后才并入 种子标注_pair_annotations.csv。
 * ============================================================ */
import fs from 'fs';
import path from 'path';
const ROOT = process.cwd();
const SRC = path.join(ROOT, '_sealed_backup/annotate-data.js');
let srcTxt = fs.readFileSync(SRC, 'utf8').replace(/^﻿/, '');
const mod = new Function(srcTxt + '\nreturn { CORPUS_PAIRS, SEEDS };')();
const PAIRS = mod.CORPUS_PAIRS;
const PM = Object.fromEntries(PAIRS.map(p => [p.k, p]));

/* k -> { span, tag, sev, fix, note }；M0 用 span='（整句）' fix='' */
const AUTH = {
  'seg_1_决赛_1': { span: '所有权限制', tag: 'M4', sev: 'Major', fix: '中国计划在 2020 年之前取消对外国公司在其金融领域的外资股比限制，比之前声明的提前一年。', note: 'ownership limits 在金融语境为「外资股比限制」，机翻「所有权限制」未落实股权比例含义。(AI初判·待专家复核)' },
  'seg_1_决赛_2': { span: '（整句）', tag: 'M0', sev: '—', fix: '', note: '机翻可接受：is expected to→预计/有望 均可，further open→进一步开放 达意；参考「深化开放举措」更书面但非对错之别。(AI初判·待专家复核)' },
  'seg_1_决赛_3': { span: '负面投资清单', tag: 'M4', sev: 'Major', fix: '此外，它还将减少在某些领域限制外商投资的负面清单。', note: 'negative list 标准译名「负面清单」，机翻「负面投资清单」生造；reduce→缩减。(AI初判·待专家复核)' },
  'seg_1_决赛_4': { span: '主席', tag: 'M1', sev: 'Major', fix: '在此之前，中美两国元首最近都决定恢复贸易谈判，以期签署一项协议。', note: 'Presidents 指国家元首，机翻误作「主席」（易与人大/政协主席混淆），应作「元首」。(AI初判·待专家复核)' },
  'seg_1_决赛_5': { span: '美中贸易战相关紧张局势', tag: 'M1', sev: 'Minor', fix: '过去几个月，中美贸易战引发的紧张局势对两国经济都产生了不利影响。', note: '①美中→中美（固定语序）；②trade war-related 应作「中美贸易战引发的」，机翻「相关紧张局势」修饰关系不清。(AI初判·待专家复核)' },
  'seg_1_决赛_6': { span: '（整句）', tag: 'M0', sev: '—', fix: '', note: 'prop up growth→支撑增长 为常见译法，虽参考用「促进增长」更顺，但机翻达意、非硬伤。(AI初判·待专家复核)' },
  'seg_1_决赛_7': { span: '银行需要作为准备金的现金量', tag: 'M4', sev: 'Major', fix: '为了帮助国内信贷增长(过去几个季度信贷增长一直保持疲软)，中国人民银行(PBoC)已经降低了存款准备金，这是自 2018 年初以来的 6 次。', note: 'reserve requirement 标准术语「存款准备金」，机翻拆成「银行需要作为准备金的现金量」冗长且失准。(AI初判·待专家复核)' },
  'seg_1_决赛_8': { span: '（整句）', tag: 'M0', sev: '—', fix: '', note: 'likely to take place→可能会/有望 均可；存款准备金率 译法正确。机翻达意，非硬伤。(AI初判·待专家复核)' },
  'seg_1_决赛_9': { span: '还没有能够实现', tag: 'M6', sev: 'Minor', fix: '虽然这些努力帮助了其金融市场的增长，但到目前为止，中国仍未能实现显著的经济增长。', note: 'has not been able to achieve→仍未能；机翻「还没有能够实现」冗余生硬（还+没有+能够 三重否定感）。(AI初判·待专家复核)' },
  'seg_1_决赛_10': { span: '外国投资者进入', tag: 'M4', sev: 'Minor', fix: '很长一段时间以来，美国和其他国家的公司一直在抱怨北京一直在阻止外资进入其快速增长的金融市场。', note: 'foreign access 在金融语境指「外资准入/外资进入」，机翻作「外国投资者进入」窄化。(AI初判·待专家复核)' },
  'seg_1_决赛_11': { span: '对所有权的限制', tag: 'M4', sev: 'Major', fix: '由于针对外资股比的限制，过去几年来， 全球投资银行在中国的扩张受到了限制。', note: 'ownership limits→外资股比限制（同 #1 口径）；机翻「对所有权的限制」未落实股权比例。(AI初判·待专家复核)' },
  'seg_1_决赛_12': { span: '外国参与', tag: 'M4', sev: 'Minor', fix: '然而，根据 2017 年公布的自由化规则，中国放松了对金融市场的限制， 允许更多的境外资金参与。', note: 'foreign participation→境外资金参与（金融语境 participation 指资本参与）；机翻「外国参与」过泛。(AI初判·待专家复核)' },
  'seg_1_决赛_13': { span: '股份从 49% 增加到 51%', tag: 'M4', sev: 'Major', fix: '中国证券监管机构允许外国公司将其在证券合资企业中的股权持有比例上限从 49% 提高至 51%，这表明它准备允许全球银行更多地进入中国的金融市场。', note: 'stake→股权持有比例上限（非泛泛「股份」）；increase to→提高至。机构名可简化为「证监会」。(AI初判·待专家复核)' },
  'seg_1_决赛_14': { span: '在国内设立新的业务', tag: 'M1', sev: 'Minor', fix: '对此，许多外国投资公司要么在中国境内设立新公司，要么通过在国内合资企业的多数股权扩大业务。', note: 'set up new businesses→设立新公司（机翻「设立新的业务」混淆 business=公司/业务）；presence→布局/业务。(AI初判·待专家复核)' },
  'seg_1_决赛_15': { span: 'JPMorgan JPM', tag: 'M1', sev: 'Minor', fix: '值得注意的是，摩根大通(JPM)和野村控股(Nomura Holdings)。', note: 'JPMorgan JPM 重复（名+代码）；参考仅保留代码 (JPM)。另 Nomura Holdings 参考作 (NMR)。(AI初判·待专家复核)' },
  'seg_1_决赛_16': { span: '花旗集团 C(Citigroup C)', tag: 'M1', sev: 'Minor', fix: 'NMR 已获得监管部门的批准，在中国设立经纪合资企业，而花旗集团 (C)正计划成立一家多数股权的证券合资企业。', note: 'Citigroup C 重复（名+代码）；参考仅 (C)。majority-owned→由其拥有多数股权。(AI初判·待专家复核)' },
  'seg_1_决赛_17': { span: '获得监管机构同意', tag: 'M4', sev: 'Major', fix: '去年 12 月，瑞银集团(UBS Group AG) 成为首家获得证监会批准的外资银行，这是自 2017 年出台有关外资投资券商的规定以来。', note: 'regulator’s consent→证监会批准（金融监管语境 consent 指监管批复，非一般「同意」）。(AI初判·待专家复核)' },
  'seg_1_决赛_18': { span: '摩根士丹利华新基金管理有限公司', tag: 'M1', sev: 'Major', fix: '此外，摩根士丹利在中国有两家合资企业-摩根士丹利华鑫基金管理有限公司 (Morgan Stanley Huaxin Fund Management Co) 和与华新证券 (Huaxin Securities)成立的一家证券合资企业-寻求收购其中一家的多数股权。', note: 'Huaxin 官方/参考定名「华鑫」（华鑫证券），机翻作「华新」专名错误（同篇 Huaxin Securities 亦应华鑫）。(AI初判·待专家复核)' },
  'seg_1_决赛_19': { span: '中国合作伙伴', tag: 'M4', sev: 'Minor', fix: '最近，摩根士丹利的证券合资公司的中方合伙人表示，准备出售 2%的股份，摩根士丹利必须在 7 月 29 日之前提交报价。', note: 'Chinese partner→中方合伙人（合资语境 partner 指合伙方/中方股东）；stake→股权。(AI初判·待专家复核)' },
  'seg_1_决赛_20': { span: '在地理上进行扩张', tag: 'M1', sev: 'Minor', fix: '因此，一旦允许外资银行在中国不受任何限制地开展业务，这将有助于这些银行实现地域扩张，这将增加收入。', note: 'expanding geographically→地域扩张（机翻「在地理上进行扩张」冗长生硬）；geographically 指市场地域覆盖。(AI初判·待专家复核)' },
  'seg_1_决赛_21': { span: '全球运营背景', tag: 'M1', sev: 'Major', fix: '此外，当前的全球营商环境看起来具有挑战性。', note: 'operating backdrop→营商环境（机翻「运营背景」错译；backdrop 此处指经营环境）。(AI初判·待专家复核)' },
  'seg_1_决赛_22': { span: '支持他们的财务状况', tag: 'M1', sev: 'Minor', fix: '一旦外国公司在中国建立和扩大业务，很可能会进一步改善他们的财务状况。', note: 'support their financials→改善财务状况（机翻「支持他们的财务状况」搭配生硬）；foreign firms→外资企业。(AI初判·待专家复核)' },
};

const esc = s => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
const rows = [];
let bad = 0;
for (const [k, a] of Object.entries(AUTH)) {
  const p = PM[k];
  if (!p) { console.error('✗ 不存在的 k：', k); bad++; continue; }
  if (a.tag !== 'M0' && !p.mt.includes(a.span)) {
    console.error('✗ 片段非 MT 子串：', k, '→', a.span); bad++; continue;
  }
  if (a.tag !== 'M0' && a.fix && !a.fix.includes(a.span.replace(a.span, ''))) { /* noop */ }
  rows.push([k, a.span, a.tag, a.sev, a.fix, a.note]);
}
const header = ['pair_key', '片段', '标签', '严重度', '建议改法', '备注'];
const lines = [header.join(',')].concat(rows.map(r => r.map(esc).join(',')));
const outPath = path.join(ROOT, 'reports', '种子标注_pilot_seg1决赛_待复核.csv');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, '﻿' + lines.join('\n'), 'utf8');
const byTag = {};
rows.forEach(r => byTag[r[2]] = (byTag[r[2]] || 0) + 1);
console.log('校验通过：', rows.length, '条（失败', bad, '）');
console.log('按标签：', Object.entries(byTag).sort((a, b) => b[1] - a[1]).join('  '));
console.log('输出：', outPath);

/* ============================================================
 * 译后编辑实训平台 · 核心逻辑（纯前端，数据存 localStorage）
 * ============================================================ */

/* ---------------- 工具 ---------------- */
const $ = (sel) => document.querySelector(sel);
const app = $('#app');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const store = {
 get(k, d) { try { const v = localStorage.getItem('mtpe_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
 set(k, v) { localStorage.setItem('mtpe_' + k, JSON.stringify(v)); },
 del(k) { localStorage.removeItem('mtpe_' + k); }
};

/* 写历史的抗爆仓策略：语料明文与作答记录共用同一块 localStorage，
   容量吃紧时逐级丢弃较早记录的逐段明细（分数 / 日期 / 画像保留），
   确保交卷一定写得进去，不会因为配额失败而在结果页开天窗。
   返回 true 表示发生了瘦身。 */
function saveHistory(list) {
 let keep = list.length;
 for (let round = 0; round < 8; round++) {
 const slim = list.map((r, i) => (i < keep ? r : (r && r.details && r.details.length ? Object.assign({}, r, { details: [] }) : r)));
 try { store.set('history', slim); return round > 0; }
 catch (e) { keep = Math.max(1, Math.floor(keep / 2)); }
 }
 try {
 store.set('history', list.slice(0, 20).map((r) => Object.assign({}, r, { details: [] })));
 return true;
 } catch (e) { return false; }
}

function toast(msg) {
 const t = $('#toast');
 t.textContent = msg;
 t.classList.remove('hidden');
 clearTimeout(t._tm);
 t._tm = setTimeout(() => t.classList.add('hidden'), 2200);
}

/* 分词：CJK 逐字、英文按词、数字（含%/小数）、标点各为一元 */
function tokenize(s) {
 return (s.match(/[\u4e00-\u9fff]|[A-Za-z]+(?:'[a-z]+)?|\d+(?:\.\d+)?%?|[^\s]/g) || []);
}

/* 基于 LCS 的词级 diff，返回 [{op:'same'|'del'|'ins', t:token}] */
function diffTokens(a, b) {
 const n = a.length, m = b.length;
 const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
 for (let i = n - 1; i >= 0; i--)
 for (let j = m - 1; j >= 0; j--)
 dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
 const ops = [];
 let i = 0, j = 0;
 while (i < n && j < m) {
 if (a[i] === b[j]) { ops.push({ op: 'same', t: a[i] }); i++; j++; }
 else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ op: 'del', t: a[i] }); i++; }
 else { ops.push({ op: 'ins', t: b[j] }); j++; }
 }
 while (i < n) { ops.push({ op: 'del', t: a[i++] }); }
 while (j < m) { ops.push({ op: 'ins', t: b[j++] }); }
 return ops;
}

/* 修订率（类 TER）：编辑量 / 机翻长度 */
function revisionRate(mt, pe) {
 const A = tokenize(mt), B = tokenize(pe);
 if (!A.length && !B.length) return 0;
 const ops = diffTokens(A, B);
 const edits = ops.filter(o => o.op !== 'same').length;
 return A.length ? edits / A.length : 1;
}

/* 与参考译文相似度（0-100） */
function similarity(pe, ref) {
 const A = tokenize(pe), B = tokenize(ref);
 if (!A.length && !B.length) return 100;
 if (!A.length || !B.length) return 0;
 const ops = diffTokens(A, B);
 const edits = ops.filter(o => o.op !== 'same').length;
 return Math.max(0, Math.round((1 - edits / Math.max(A.length, B.length)) * 1000) / 10);
}

/* 2026-10-12：renderDiffHTML / 结果页 / 报告导出 已移到共用的 report.js
   （② 改 交卷后与「我的统计」的「查看」共用同一份，避免抄两块） */

/* 字数统计：中文按字符，英文按词 */
function wordCount(s) {
 const cjk = (s.match(/[\u4e00-\u9fff]/g) || []).length;
 const en = (s.match(/[A-Za-z]+/g) || []).length;
 return cjk + en;
}

function fmtTime(sec) {
 const m = Math.floor(sec / 60), s = sec % 60;
 return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function now() { return new Date().toLocaleString('zh-CN', { hour12: false }); }

/* ---------------- 全局状态 ---------------- */
let view = 'plaza';
let S = null; // 当前答题会话 {task, mode, answers[], startTs, duration, cheat, timer, idx}
let _pendingDue = ''; // ④ 布置深链带来的截止日期（openSetup→startSession→submitSession 透传）
const getNick = () => store.get('nickname', '');
/* 是否填过"真实姓名/学号"：登录时系统会把昵称预置成账号名，那不算填过。
   班级汇总按这个身份归档，所以导出作业前必须先填。 */
const hasNick = () => !!store.get('nickname_set', 0);
const allTasks = () => TASKS;
/* 机房串号修复（2026-10-17）：记录按当前昵称过滤，只看"本人"的。
   昵称取不到（测试桩/异常环境）时不过滤，保持旧行为。
   historyRaw 供写回用（合并时不能把别人的记录冲掉）。 */
const curNick = () => { try { return JSON.parse(localStorage.getItem('mtpe_nickname') || '""') || ''; } catch (e) { return ''; } };
const mineRec = (r) => { const n = curNick(); return !n || (!!r && r.nickname === n); };
const historyRaw = () => store.get('history', []);
const history = () => historyRaw().filter(mineRec);
/* 草稿只认自己的：草稿带保存时的昵称戳，别人的草稿一律当作不存在 */
const myDraft = (id) => {
  const d = store.get('draft_' + id, null);
  if (!d) return null;
  const n = curNick();
  return (!n || d.nick === n) ? d : null;
};

/* ④ 布置深链解析：#task=<id>&mode=competition|practice|demo&due=YYYY-MM-DD
   老师把生成的链接（practice.html#task=<id>&mode=competition&due=...）发群里即一次布置。 */
function parseTaskLink(h) {
  try {
    const raw = (h || '').split('&').reduce((m, kv) => {
      const i = kv.indexOf('='); if (i < 0) return m;
      m[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1)); return m;
    }, {});
    if (!raw.task) return null;
    return { taskId: raw.task, mode: raw.mode || 'competition', due: raw.due || '' };
  } catch (e) { return null; }
}

/* ⑤ 难度分级：基于 MT↔REF 编辑距离（revisionRate，类 TER）的「译后编辑努力估计」为主，
   叠加 ③（2026-10-22）MQM 罚分密度精修。
   文献依据：TER 与实际 PE 努力（插入/删除/用时）正相关
   （Martinez, Koglin, Mesa-Lao & Carl, 2015, IATIS；"Difficulty Estimation of Machine
   Translation" 学位论文，TER↑ ⇒ PE 努力↑）。覆盖全部句对。
   阈值已按「线上 tasks 分片」真实分布回标（2026-10-22，calib_diff.mjs 解密实测）：
   20 卷每卷均值 revisionRate ∈ [0.536, 1.337]，中位数 0.925；单句 revisionRate p95=1.50、p99=2.11。
   故把口径从初版本地拍脑袋的 0.20/0.45/0.80 改为数据锚定：
     入门 easy   : refined ≤ 0.85（≈p33，轻量译后编辑）
     进阶 medium : 0.85 < refined ≤ 1.10（中等编辑量）
     挑战 hard   : refined > 1.10（编辑量超过机翻本身词数，重度）或 含「杀手句」(单段>2.0，≈p99)
   回标后 20 卷分档 = 入门7 / 进阶7 / 挑战6，三档均有内容。语料大幅扩充后需重跑回标。
   —— ③ MQM 精修：SEEDS 已由 corpus.js 暴露到练习/仿真运行时（meta 片，无密文）；种子经
      seg.mt.includes(span) 匹配（与标注页计分同构；task.pair 是翻译方向、不可用于匹配）。
      严重度乘数采用 MQM Council 标准：Minor=1 / Major=5 / Critical=25；罚分按 MT 词数归一得密度；
      refined = max(terAvg, mqmScore) —— 难度取「编辑努力」与「已知错误严重度」的较大值，
      含 Major/Critical 种子的卷会被正确上探到挑战档；无种子卷仍纯 TER，分布不变。 */
const _diffCache = new Map();
const _mqmSevW = { Minor: 1, Major: 5, Critical: 25 };
const _mqmCache = new Map();
function mqmOf(task) {
  const seeds = window.SEEDS || [];
  if (!seeds.length || !task || !task.segs) return { score: 0, raw: 0, maxSev: 0, count: 0 };
  if (_mqmCache.has(task.id)) return _mqmCache.get(task.id);
  let raw = 0, maxSev = 0, count = 0;
  for (const g of task.segs) {
    const mt = g.mt || '';
    if (!mt) continue;
    for (const s of seeds) {
      if (mt.indexOf(s.span) >= 0) {
        const w = _mqmSevW[s.sev] || 1;
        raw += w; if (w > maxSev) maxSev = w; count++;
      }
    }
  }
  const words = task.segs.reduce((a, g) => a + wordCount(g.mt || ''), 0);
  const r = { score: words ? raw / words : 0, raw, maxSev, count };
  _mqmCache.set(task.id, r);
  return r;
}
function taskDifficulty(task) {
  if (!task || !task.segs || !task.segs.length) return { tier: '入门', avg: 0, cls: 'easy', mqm: { score: 0, raw: 0, maxSev: 0, count: 0 } };
  if (_diffCache.has(task.id)) return _diffCache.get(task.id);
  let sum = 0, maxSeg = 0;
  for (const g of task.segs) {
    const r = revisionRate(g.mt || '', g.ref || '');
    sum += r; if (r > maxSeg) maxSeg = r;
  }
  const avg = sum / task.segs.length;
  const mqm = mqmOf(task);
  const refined = Math.max(avg, mqm.score);
  let tier = '入门', cls = 'easy';
  if (refined > 1.10 || maxSeg > 2.0) { tier = '挑战'; cls = 'hard'; }
  else if (refined > 0.85) { tier = '进阶'; cls = 'medium'; }
  const d = {
    tier, avg: Math.round(avg * 1000) / 1000, cls,
    mqm: { score: Math.round(mqm.score * 1000) / 1000, raw: mqm.raw, maxSev: mqm.maxSev, count: mqm.count }
  };
  _diffCache.set(task.id, d);
  return d;
}
/* ③ 任务卡上的 MQM 金标准标记：仅对含种子卷显示，按最高严重度着色（Minor 蓝 / Major 琥珀 / Critical 红） */
function mqmBadge(diff) {
  const m = diff && diff.mqm;
  if (!m || !m.count) return '';
  const sev = m.maxSev >= 25 ? 'crit' : m.maxSev >= 5 ? 'major' : 'minor';
  const sevTxt = m.maxSev >= 25 ? 'Critical' : m.maxSev >= 5 ? 'Major' : 'Minor';
  return `<span class="tag mqm ${sev}" title="金标准种子罚分密度 ${m.score}（共 ${m.count} 处，最高 ${sevTxt}）">★MQM ${m.score}</span>`;
}
/* 难度筛选状态（renderPlaza 顶部的下拉） */
let diffFilter = 'all';
window.filterDifficulty = function (v) { diffFilter = v || 'all'; renderPlaza(); };

/* 两类"交卷"的口径判断（isExamRecord）与统计页一起搬到了 report.js / stats.js；
   本页只在结果页标题里用到它，改由 window.mtpeIsExamRecord 提供。 */

/* 作答态：隐藏全站顶栏，作答页自己那条就是顶部栏（见 style.css 的 body.answering） */
function setAnswering(on) {
 try { document.body.classList.toggle('answering', !!on); } catch (e) {}
}

/* 步骤标签：三页作答栏左端统一用带编号的形式（① 找 · 作答中 / ② 改 · 限时练习 / ③ 测 · 仿真训练）
   样式与三档步骤色在 ui.css；本页固定用 s2。 */
const stepTag = (t) => '<span class="step-tag s2">' + t + '</span>';

/* ---------------- 视图切换 ---------------- */
function go(v) {
 if (S && view !== v && (v === 'plaza' || v === 'import')) {
 if (!confirm('答题正在进行中，离开将放弃本次作答。确定离开？')) return;
 stopSession(false);
 }
 view = v;
 document.querySelectorAll('.nav-link').forEach(a => a.classList.remove('active'));
 const nav = $('#nav-' + v);
 if (nav) nav.classList.add('active');
 if (v === 'plaza') renderPlaza();
 /* 「我的统计」已独立成 stats.html（2026-10-12），本页不再有 stats 视图 */
 window.scrollTo(0, 0);
}

function updateNickBadge() {
 const n = getNick();
 const b = $('#nickname-badge'); if (!b) return; b.textContent = n ? ' ' + n : ' 未设置昵称';
}

function askNickname(cb) {
 openModal(`
 <h3>设置参赛昵称</h3>
 <div class="field">
 <label>昵称（将用于排行榜与成绩单）</label>
 <input id="nick-input" maxlength="20" placeholder="例如：Hank" value="${esc(getNick())}">
 </div>
 <div class="m-actions">
 <button class="btn btn-ghost" onclick="closeModal()">取消</button>
 <button class="btn btn-primary" onclick="saveNickname()">保存</button>
 </div>`);
 $('#nick-input').focus();
 window._nickCb = cb || null;
}
function saveNickname() {
 const v = $('#nick-input').value.trim();
 if (!v) { toast('昵称不能为空'); return; }
 store.set('nickname', v);
 store.set('nickname_set', 1);
 /* 认领：把登录后带账号名戳的记录改标成刚填的姓名，否则按昵称过滤后看不见 */
 if (window.mtpeClaimRecords) window.mtpeClaimRecords(v);
 updateNickBadge();
 closeModal();
 if (window._nickCb) { const cb = window._nickCb; window._nickCb = null; cb(); }
}

/* ---------------- 弹窗 ---------------- */
function openModal(html) {
 $('#modal-box').innerHTML = html;
 $('#modal-mask').classList.remove('hidden');
}
function closeModal() { $('#modal-mask').classList.add('hidden'); }

/* ---------------- 译后编辑实训 ---------------- */
function renderPlaza() {
 setAnswering(false);
 // 课堂演示临时开关：practice.html#demo（只在本机演示时有意义，公开站点无入口）
 const isTeacher = location.hash.indexOf('demo') >= 0;
 const tasks = allTasks();
 const shown = diffFilter === 'all' ? tasks.filter(t => t.group !== 'history')
   : tasks.filter(t => t.group !== 'history' && taskDifficulty(t).cls === diffFilter);
 const html = `
 <div class="plaza-head">
  <h2>② 改 · 译后编辑练习</h2>
  <p>在机器译文底稿上动手改，交卷看修订率与逐段对照。
  ｜ <a href="MQM错误类型参考手册.html">MQM 错误类型参考手册</a></p>
 </div>
 <div class="page-s" style="margin:14px 0 18px">限时练习：8 / 15 / 30 分钟计时，离开页面计数 ｜ 自由练习：不限时、可存草稿</div>
 <div class="filter-row"><span class="muted">难度筛选：</span>
 <select class="diff-select" onchange="filterDifficulty(this.value)">
 <option value="all"${diffFilter==='all'?' selected':''}>全部</option>
 <option value="easy"${diffFilter==='easy'?' selected':''}>入门</option>
 <option value="medium"${diffFilter==='medium'?' selected':''}>进阶</option>
 <option value="hard"${diffFilter==='hard'?' selected':''}>挑战</option>
 </select>
 <span class="muted" style="margin-left:8px">难度按「MT↔REF 需改动量 + 金标准 MQM 罚分」估算（入门≤0.85 ｜ 进阶 0.85–1.10 ｜ 挑战＞1.10，含杀手句单段＞2.0）；★MQM 标记表示该题已被专家标注</span>
 </div>
 <div class="task-grid">
 ${shown.map(t => {
 const wc = t.segs.reduce((s, g) => s + wordCount(g.src), 0);
 const draft = myDraft(t.id);
 const diff = taskDifficulty(t);
 return `
 <div class="task-card">
 <div class="t-head">
 <h3>${esc(t.name)}</h3>
 <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
 <span class="tag diff ${diff.cls}">难度·${diff.tier}</span>${mqmBadge(diff)}
 <span class="tag pair">${esc(t.pair)}</span>
 <span class="tag domain">${esc(t.domain)}</span>
 </div>
 </div>
 <div class="meta">
 <span> ${t.segs.length} 段</span><span> 约 ${wc} 字</span>
 <span>⏱ 建议 ${t.minutes} 分钟</span>
 </div>
 ${draft ? `<div class="draft-tip">${draft.mode === 'competition'
 ? `有未完成的限时练习（剩余 ${fmtTime(Math.max(0, Math.floor(draft.remain || 0)))}，${draft.done || 0}/${t.segs.length} 段已编辑）`
 : `检测到未完成的自由练习草稿（${draft.done || 0}/${t.segs.length} 段已编辑）`}</div>` : ''}
 <div class="task-actions">
 <button class="btn btn-primary" onclick="openSetup('${t.id}','competition')"> 限时练习</button>
 <button class="btn btn-outline" onclick="openSetup('${t.id}','practice')"> 自由练习</button>
 ${isTeacher ? `<button class="btn btn-ghost" onclick="openSetup('${t.id}','demo')"> 教学演示</button>` : ''}
 </div>
 </div>`;
 }).join('')}
 </div>` + (() => {
 /* 历史卷（第 1-6 届，共 14 套整卷）默认折叠：摊开会把广场拉得很长 */
 const hist = tasks.filter((t) => t.group === 'history');
 if (!hist.length) return '';
 return `<details class="adv" style="margin-top:16px"><summary>更多届次：第 1–6 届真题 ${hist.length} 套（整卷，按官方对照表归并句段）</summary>
 <div class="task-grid" style="margin-top:12px">
 ${hist.map((t) => {
 const wc = t.segs.reduce((s, g) => s + wordCount(g.src), 0);
 const draft = myDraft(t.id);
 const diff = taskDifficulty(t);
 return `
 <div class="task-card">
 <div class="t-head">
 <h3>${esc(t.name)}</h3>
 <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
 <span class="tag diff ${diff.cls}">难度·${diff.tier}</span>${mqmBadge(diff)}
 <span class="tag pair">${esc(t.pair)}</span>
 <span class="tag domain">${esc(t.domain)}</span>
 </div>
 </div>
 <div class="meta"><span> ${t.segs.length} 段</span><span> 约 ${wc} 字</span><span>⏱ 建议 ${t.minutes} 分钟</span></div>
 ${draft ? `<div class="draft-tip">有未完成的练习草稿（${draft.done || 0}/${t.segs.length} 段已编辑）</div>` : ''}
 <div class="task-actions">
 <button class="btn btn-primary" onclick="openSetup('${t.id}','competition')"> 限时练习</button>
 <button class="btn btn-outline" onclick="openSetup('${t.id}','practice')"> 自由练习</button>
 ${isTeacher ? `<button class="btn btn-ghost" onclick="openSetup('${t.id}','demo')"> 教学演示</button>` : ''}
 </div>
 </div>`;
 }).join('')}
 </div></details>`;
 })();
 app.innerHTML = html;
}

/* ---------------- 竞赛设置弹窗 ---------------- */
function openSetup(taskId, mode, due) {
 const task = allTasks().find(t => t.id === taskId);
 if (!task) return;
 _pendingDue = due || '';

 if (!getNick() && mode === 'competition') { askNickname(() => openSetup(taskId, mode, due)); return; }

 const myPrev = myDraft(taskId);
 if (mode === 'practice' && myPrev) {
 openModal(`
 <h3>检测到练习草稿</h3>
 <div class="info-box">上次练习已编辑 ${myPrev.done} 段，可继续或重新开始。</div>
 <div class="m-actions">
 <button class="btn btn-ghost" onclick="closeModal();startSession('${taskId}','practice',true,0,_pendingDue)">重新开始</button>
 <button class="btn btn-primary" onclick="closeModal();startSession('${taskId}','practice',0,0,_pendingDue)">继续上次草稿</button>
 </div>`);
 return;
 }

 const modeName = { competition: '限时练习', practice: '自由练习', demo: '教学演示' }[mode];
 let dueBox = '';
 if (_pendingDue) {
 const dueTs = Date.parse(_pendingDue);
 const overdue = dueTs && dueTs < Date.now();
 const days = isNaN(dueTs) ? '' : Math.ceil((dueTs - Date.now()) / 86400000);
 dueBox = `<div class="info-box" style="border-color:${overdue ? '#d70015' : '#0071e3'};color:${overdue ? '#d70015' : 'inherit'}">`
 + `本次为老师布置作业，截止：<b>${esc(_pendingDue)}</b>`
 + (isNaN(dueTs) ? '（日期格式无法识别）' : overdue ? '（已截止，仍可提交，老师会看到「逾期」标记）' : `（剩 ${days} 天）`) + `</div>`;
 }
 let body = dueBox + `<div class="info-box">
 任务：${esc(task.name)}（${esc(task.pair)} · ${task.segs.length} 段）<br>
 模式：${modeName}
 </div>`;

 if (mode === 'competition') {
 /* 有过没做完的限时练习 → 先问"继续还是重开"，继续时接着剩余时间计时 */
 const d = myDraft(taskId);
 if (d && d.mode === 'competition' && (d.remain || 0) > 30) {
 openModal(`<h3>继续上次限时练习？</h3>
 <div class="info-box">上次还剩 <b>${fmtTime(Math.floor(d.remain))}</b>，已编辑 ${d.done || 0}/${task.segs.length} 段。<br>继续会接着剩余时间计时（不会因为刷新而多出时间）。</div>
 <div class="m-actions">
 <button class="btn btn-ghost" onclick="closeModal();startSession('${taskId}','competition',true,0,_pendingDue)">重新开始</button>
 <button class="btn btn-primary" onclick="closeModal();startSession('${taskId}','competition',false,${Math.floor(d.remain)},_pendingDue)">继续（剩余 ${fmtTime(Math.floor(d.remain))}）</button>
 </div>`);
 return;
 }
 const durs = [Math.min(8, task.minutes), task.minutes, task.minutes * 2];
 body += `
 <div class="field"><label>限时时长</label>
 <div class="dur-picker">
 ${durs.map((d, i) => `<div class="dur-btn${i === 1 ? ' sel' : ''}" data-d="${d}" onclick="pickDur(this)">${d} 分钟${i === 1 ? '（建议）' : ''}</div>`).join('')}
 </div>
 </div>
  <div class="warn-box">作答期间离开页面会被记录；倒计时归零自动交卷；交卷后不可再修改。</div>`;
 }
 body += `
 <div class="m-actions">
 <button class="btn btn-ghost" onclick="closeModal()">取消</button>
 <button class="btn btn-primary" onclick="closeModal();startSession('${taskId}','${mode}',0,0,_pendingDue)">开始作答 </button>
 </div>`;
 openModal(`<h3>开始${modeName}</h3>${body}`);
 window._dur = mode === 'competition' ? task.minutes : 0;
}
function pickDur(el) {
 document.querySelectorAll('.dur-btn').forEach(b => b.classList.remove('sel'));
 el.classList.add('sel');
 window._dur = parseInt(el.dataset.d, 10);
}

/* ---------------- 答题会话 ---------------- */
function startSession(taskId, mode, fresh, remainSec, due) {
 const task = allTasks().find(t => t.id === taskId);
 if (!task) return;
 /* 起新会话前先收掉旧会话的计时器（详见 renderExam 里的注释） */
 if (S && S.timer) { clearInterval(S.timer); S.timer = null; }
 let answers = task.segs.map(() => '');
 let resumed = false;
 let dur = mode === 'competition' ? (window._dur || task.minutes) * 60 : 0;
 if (mode !== 'demo' && !fresh) {
 const draft = myDraft(taskId);
 if (draft && Array.isArray(draft.answers) && draft.answers.length) {
 answers = draft.answers; resumed = true;
 /* 限时练习：接着剩余时间计时（不是重新计时） */
 if (mode === 'competition') dur = Math.max(30, Math.floor(remainSec || draft.remain || task.minutes * 60));
 }
 }
 S = {
 task, mode, answers, idx: 0,
 startTs: Date.now(),
 duration: dur,
 cheat: 0, timer: null, draftSaveTm: null, done: false,
 due: due || ''   // ④ 布置深链带来的截止日期，交卷时写入成绩，供老师核对逾期
 };
 window._sessionActive = true;
 if (mode === 'competition') {
 document.addEventListener('visibilitychange', onVisChange);
 window.addEventListener('beforeunload', onBeforeUnload);
 }
 renderExam();
 if (resumed) toast('已恢复上次练习草稿');
 focusSeg(0);
}

function onVisChange() {
 if (!S || document.visibilityState !== 'hidden') return;
 S.cheat++;
 const b = $('#cheat-badge');
 if (b) { b.textContent = `已离开页面 ${S.cheat} 次`; b.classList.remove('hidden'); }
}
function onBeforeUnload(e) { if (S && !S.done) { e.preventDefault(); e.returnValue = ''; } }

function stopSession(clearDraft) {
 if (S && S.timer) clearInterval(S.timer);
 if (S && S.mode === 'competition') {
 document.removeEventListener('visibilitychange', onVisChange);
 window.removeEventListener('beforeunload', onBeforeUnload);
 }
 if (clearDraft && S) store.del('draft_' + S.task.id);
 S = null;
 window._sessionActive = false;
}

function focusSeg(i) {
 if (!S) return;
 S.idx = i;
 document.querySelectorAll('.seg-row').forEach(r => r.classList.remove('current'));
 const row = document.querySelector('.seg-row[data-i="' + i + '"]');
 const ta = document.querySelector('.seg-row[data-i="' + i + '"] textarea');
 if (row) row.classList.add('current');
 if (ta) ta.focus();
}

/* 译文编辑框按内容自动增高，并铺满本行——左右两栏因此保持同一尺寸 */
function autoGrowTa(i) {
 const ta = $('#ta-' + i);
 if (!ta) return;
 ta.style.minHeight = '0px';
 ta.style.minHeight = Math.max(52, ta.scrollHeight) + 'px';
}

function onAnswerInput(i, val) {
 if (!S) return;
 S.answers[i] = val;
 autoGrowTa(i);
 const row = document.querySelector('.seg-row[data-i="' + i + '"]');
 if (row) {
 const st = row.querySelector('.seg-status');
 const orig = (S.task.segs[i].mt || '').trim();
 const edited = !!val.trim() && val.trim() !== orig;
 st.textContent = edited ? ' 已编辑' : '○ 待编辑';
 st.className = 'seg-status' + (edited ? ' done' : '');
 }
 updateProgress();
 /* 所有模式都存草稿：限时练习/仿真测评中途误刷新不该丢整卷。
    限时练习还要把"剩余秒数"一起存下来，继续时接着剩余时间计时 —— 不能靠刷新续时间。 */
 if (S.mode !== 'demo') {
 clearTimeout(S.draftSaveTm);
 S.draftSaveTm = setTimeout(() => {
 const done = S.answers.filter((a, k) => a && a.trim() && a.trim() !== (S.task.segs[k].mt || '').trim()).length;
 const rec = { answers: S.answers, done, savedAt: now(), mode: S.mode, nick: getNick() || '匿名' };
 if (S.mode === 'competition') {
 rec.dur = S.duration;
 rec.remain = Math.max(0, S.duration - Math.floor((Date.now() - S.startTs) / 1000));
 }
 store.set('draft_' + S.task.id, rec);
 }, 600);
 }
}

function updateProgress() {
 if (!S) return;
 const done = S.answers.filter((a, k) => a && a.trim() && a.trim() !== (S.task.segs[k].mt || '').trim()).length;
 const fill = $('#progress-fill');
 const txt = $('#progress-txt');
 if (fill) fill.style.width = (done / S.task.segs.length * 100) + '%';
 if (txt) txt.textContent = '已编辑 ' + done + '/' + S.task.segs.length + ' 段';
}

/* ---------------- 答题界面渲染 ---------------- */
function highlightTerms(src) {
 let html = esc(src);
 if (S) {
 for (const t of (S.task.terms || [])) {
 if (!t.s) continue;
 const re = new RegExp('(' + t.s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
 html = html.replace(re, '<mark title="术语：' + esc(t.t) + '" onclick="showTerm(this.title)">$1</mark>');
 }
 }
 return html;
}
function showTerm(title) { toast(title.replace('术语：', ' ')); }

function renderExam() {
 setAnswering(true);
 const { task, mode } = S;
   const modeChip = mode === 'competition' ? '限时练习'
  : mode === 'demo' ? '教学演示'
  : '自由练习';
 const timerHtml = mode === 'competition'
 ? `<div class="timer" id="timer">--:--</div>`
 : `<div class="muted" id="timer">${mode === 'demo' ? '教学演示 · 不计时' : '自由练习 · 不限时'}</div>`;

 app.innerHTML = `
 <div class="exam-top">
  <div class="exam-title">${stepTag('② 改 · ' + modeChip)} ${esc(task.name)}
 ${mode === 'competition' ? `<span class="cheat-badge hidden" id="cheat-badge">已离开页面 0 次</span>` : ''}
 </div>
 <div class="progress-wrap">
 <span class="muted" id="progress-txt">已编辑 0/${task.segs.length} 段</span>
 <div class="progress-bar"><div class="progress-fill" id="progress-fill" style="width:0%"></div></div>
 ${timerHtml}
 <button class="btn btn-primary" onclick="confirmSubmit()">交卷</button>
 <button class="btn btn-ghost" onclick="go('plaza')">退出练习</button>
 </div>
 </div>
 <div class="exam-layout">
 <div class="seg-table">
 <div class="seg-row header">
 <div class="seg-num">#</div>
  <div class="seg-cell">原文 Source</div>
 <div class="seg-cell">机翻译文 MT 请在此基础编辑（Ctrl+Enter 跳下一段）</div>
 </div>
 ${task.segs.map((g, i) => `
 <div class="seg-row" data-i="${i}">
 <div class="seg-num">${i + 1}<span class="seg-status" id="st-${i}">○ 待编辑</span></div>
 <div class="seg-cell src" id="src-${i}">${highlightTerms(g.src)}</div>
 <div class="seg-cell"><textarea id="ta-${i}" oninput="onAnswerInput(${i}, this.value)"
 onkeydown="if(event.ctrlKey&&event.key==='Enter'){event.preventDefault();focusSeg(${Math.min(i + 1, task.segs.length - 1)})}"
 placeholder="${mode === 'demo' ? '输入译后编辑结果……' : '保留机翻正确处，只改该改的'}"></textarea></div>
 </div>`).join('')}
 </div>
 <div class="side-panel">
 <div class="panel">
 <h4> 术语库 <span class="muted" style="font-size:11px">${(task.terms || []).length} 条</span></h4>
 <input class="term-filter" id="term-filter" placeholder="筛选术语…" oninput="filterTerms()">
 <div id="term-list">
 ${(task.terms || []).map((t, i) => `
 <div class="term-item" data-k="${esc((t.s + ' ' + t.t).toLowerCase())}">
 <span class="s">${esc(t.s)}</span>
 <span class="t">${esc(t.t)}</span>
 </div>`).join('')}
 </div>
 </div>
 <div class="panel">
  <details class="adv">
  <summary>${mode === 'demo' ? '本任务译后编辑要点' : '本卷说明'}</summary>
  <ul class="tips-list" style="margin-top:8px">
 <li>${esc(task.tips)}</li>
 ${mode === 'demo' ? '<li>每段右下角“查看点评”在交卷前即可展开，边看边改。</li>' : ''}
 </ul>
  </details>
 </div>
 </div>
 </div>`;

 // 术语点击插入
 document.querySelectorAll('.term-item').forEach((el, i) => {
 el.onclick = () => insertTerm(i);
 });

 // 预填机翻
 task.segs.forEach((g, i) => {
 const ta = $('#ta-' + i);
 if (g.mt) { ta.value = g.mt; S.answers[i] = g.mt; }
 updateSegStatus(i);
 });
 task.segs.forEach((g, i) => autoGrowTa(i));
 updateProgress();

 // 计时
 /* 先清掉可能还在跑的旧计时器：否则上一个会话（例如限时练习）留下的 interval
    会作用到新会话上 —— 新会话如果是自由练习（duration=0），旧计时器一算就是
    "已超时"，于是刚进作答页就被自动交卷、直接跳到结果页。 */
 if (S.timer) { clearInterval(S.timer); S.timer = null; }
 if (mode === 'competition') {
 const tid = setInterval(() => {
 if (!S) { clearInterval(tid); return; }
 if (S.mode !== 'competition' || S.done) return;   // 旧计时器不得作用于新会话
 const left = S.duration - Math.floor((Date.now() - S.startTs) / 1000);
 const el = $('#timer');
 if (!el) return;
 el.textContent = fmtTime(Math.max(0, left));
 if (left <= 60) el.classList.add('warn');
 if (left <= 0) { toast('时间到，系统自动交卷'); submitSession(); }
 }, 500);
 S.timer = tid;
 } else {
 const tid = setInterval(() => {
 if (!S) { clearInterval(tid); return; }
 const el = $('#timer');
 if (el && S.mode === 'practice') el.textContent = '已用时 ' + fmtTime(Math.floor((Date.now() - S.startTs) / 1000));
 }, 1000);
 S.timer = tid;
 }
}

function updateSegStatus(i) {
 const st = $('#st-' + i);
 if (st) {
 const v = (S.answers[i] || '').trim();
 const orig = (S.task.segs[i].mt || '').trim();
 const edited = !!v && v !== orig;
 st.textContent = edited ? ' 已编辑' : '○ 待编辑';
 st.className = 'seg-status' + (edited ? ' done' : '');
 }
}

function filterTerms() {
 const k = $('#term-filter').value.toLowerCase();
 document.querySelectorAll('#term-list .term-item').forEach(el => {
 el.style.display = el.dataset.k.includes(k) ? '' : 'none';
 });
}

function insertTerm(i) {
 const t = (S.task.terms || [])[i];
 if (!t) return;
 const ta = $('#ta-' + S.idx);
 if (!ta) return;
 const pos = ta.selectionStart || ta.value.length;
 ta.value = ta.value.slice(0, pos) + t.t + ta.value.slice(ta.selectionEnd || pos);
 S.answers[S.idx] = ta.value;
 updateSegStatus(S.idx);
 updateProgress();
 ta.focus();
 toast('已插入：' + t.t);
}

/* ---------------- 交卷 ---------------- */
function confirmSubmit() {
 if (!S) return;
 const done = S.answers.filter((a, k) => a && a.trim() && a.trim() !== (S.task.segs[k].mt || '').trim()).length;
 const undone = S.task.segs.length - done;
 openModal(`
 <h3>确认交卷？</h3>
 <div class="info-box">已编辑 ${done} / ${S.task.segs.length} 段${undone ? `，还有 ${undone} 段未编辑（按 0 分处理）` : ''}。</div>
 ${S.mode === 'competition' ? '<div class="warn-box">交卷后不可返回修改。</div>' : ''}
 <div class="m-actions">
 <button class="btn btn-ghost" onclick="closeModal()">继续作答</button>
 <button class="btn btn-primary" onclick="closeModal();submitSession()">确认交卷</button>
 </div>`);
}

function submitSession() {
 if (!S || S.done) return;
 S.done = true;
 const { task, mode } = S;
 const timeUsed = Math.floor((Date.now() - S.startTs) / 1000);
 const details = task.segs.map((g, i) => {
 const pe = (S.answers[i] || '').trim();
 const empty = !pe;
 const ter = empty ? 1 : revisionRate(g.mt, pe);
 const sim = empty ? 0 : similarity(pe, g.ref);
 return { i, src: g.src, mt: g.mt, ref: g.ref, pe, ter, sim, empty, notes: g.notes || [] };
 });
 const segDone = details.filter(d => d.pe && d.pe !== (d.mt || '').trim()).length;
 const avgTer = segDone ? details.filter(d => !d.empty).reduce((s, d) => s + d.ter, 0) / segDone : 1;
 const score = Math.round(details.reduce((s, d) => s + d.sim, 0) / details.length * 10) / 10;
 const words = task.segs.reduce((s, g) => s + wordCount(g.src), 0);

 const record = {
 id: 'r' + Date.now(), taskId: task.id, taskName: task.name,
 pair: task.pair, domain: task.domain, mode,
 nickname: getNick() || '匿名', date: now(),
 timeUsed, score, ter: Math.round(avgTer * 1000) / 10,
 segDone, total: task.segs.length, words, details,
 due: S.due || '',
 overdue: !!(S.due && Date.parse(S.due) < Date.now())
 };

 stopSession(true);
 if (saveHistory([record].concat(historyRaw()).slice(0, 200))) {
 toast('本机存储接近上限：已自动精简较早记录的逐段明细（分数、日期与画像保留）');
 }
 renderResult(record);
}

/* ---------------- 成绩页 ---------------- */
/* 结果页已移到共用的 report.js（window.renderResult(r, backHtml)），
   ② 改 交卷后与「我的统计」里点「查看」共用同一份。 */

/* ---------------- 我的统计 / 导出 ---------------- */
/* 2026-10-12：整块搬到 stats.html + stats.js（我的统计独立成页），
   结果页与报告导出搬到共用的 report.js。本页不再持有统计与导出逻辑。 */

/* ---------------- 启动 ---------------- */
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
updateNickBadge();
(function boot() {
 /* #stats 已独立成 stats.html（老链接在这里做一次跳转）；#import 早已下线，回落到广场 */
 const h = (location.hash || '').replace(/^#/, '');
 if (h === 'stats') { location.replace('stats.html'); return; }
 if (h === 'plaza') go('plaza');
 else renderPlaza();
 /* ④ 布置深链：#task=<id>&mode=&due= → 加载后自动打开该卷设置框 */
 const dl = parseTaskLink(h);
 if (dl && dl.taskId) {
 const t = allTasks().find(x => x.id === dl.taskId);
 if (t) { openSetup(dl.taskId, dl.mode, dl.due); }
 else toast('布置链接里的任务不存在：' + dl.taskId);
 }
})();

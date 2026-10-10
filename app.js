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

/* 合并式修订痕迹渲染：del=红色删除线（机翻原文被删），ins=绿色（用户新增） */
function renderDiffHTML(mt, pe) {
 const ops = diffTokens(tokenize(mt), tokenize(pe));
 return ops.map(o => {
 if (o.op === 'same') return esc(o.t);
 if (o.op === 'del') return '<del>' + esc(o.t) + '</del>';
 return '<ins>' + esc(o.t) + '</ins>';
 }).join(' ').replace(/ <(del|ins)>/g, ' <$1>').replace(/<(del|ins)> /g, '<$1> ');
}

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
const getNick = () => store.get('nickname', '');
const allTasks = () => TASKS;
const history = () => store.get('history', []);

/* 作答态：隐藏全站顶栏，作答页自己那条就是顶部栏（见 style.css 的 body.answering） */
function setAnswering(on) {
 try { document.body.classList.toggle('answering', !!on); } catch (e) {}
}

/* ---------------- 视图切换 ---------------- */
function go(v) {
 if (S && view !== v && (v === 'plaza' || v === 'stats' || v === 'import')) {
 if (!confirm('答题正在进行中，离开将放弃本次作答。确定离开？')) return;
 stopSession(false);
 }
 view = v;
 document.querySelectorAll('.nav-link').forEach(a => a.classList.remove('active'));
 const nav = $('#nav-' + v);
 if (nav) nav.classList.add('active');
 if (v === 'plaza') renderPlaza();
 else if (v === 'stats') renderStats();
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
 const html = `
 <div class="plaza-head">
 <h2>② 改 · 译后编辑练习</h2>
 <p>在机翻底稿上动手改，交卷看修订率、逐段对照与参考译文点评。
 ｜ <a href="index.html">← 返回首页</a> ｜ <a href="MQM错误类型参考手册.html">MQM 错误类型参考手册</a></p>
 <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
 <a class="btn btn-ghost" href="annotate.html" style="text-decoration:none">① 找 · 标注实训</a>
 <a class="btn btn-ghost" href="pe-exam.html" style="text-decoration:none">③ 考 · 模拟参赛</a>
 <button class="btn btn-ghost" onclick="go('stats')">我的统计</button>
 </div>
 </div>
 <div class="page-s" style="margin:14px 0 18px">限时练习：8 / 15 / 30 分钟计时，离开页面计数 ｜ 自由练习：不限时、可存草稿</div>
 <div class="task-grid">
 ${tasks.map(t => {
 const wc = t.segs.reduce((s, g) => s + wordCount(g.src), 0);
 const draft = store.get('draft_' + t.id, null);
 return `
 <div class="task-card">
 <div class="t-head">
 <h3>${esc(t.name)}</h3>
 <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
 <span class="tag pair">${esc(t.pair)}</span>
 <span class="tag domain">${esc(t.domain)}</span>
 </div>
 </div>
 <div class="meta">
 <span> ${t.segs.length} 段</span><span> 约 ${wc} 字</span>
 <span>⏱ 建议 ${t.minutes} 分钟</span>
 </div>
 ${draft ? `<div class="draft-tip"> 检测到未完成的练习草稿（${draft.done}/${t.segs.length} 段已编辑）</div>` : ''}
 <div class="task-actions">
 <button class="btn btn-primary" onclick="openSetup('${t.id}','competition')"> 限时练习</button>
 <button class="btn btn-outline" onclick="openSetup('${t.id}','practice')"> 自由练习</button>
 ${isTeacher ? `<button class="btn btn-ghost" onclick="openSetup('${t.id}','demo')"> 教学演示</button>` : ''}
 </div>
 </div>`;
 }).join('')}
 </div>`;
 app.innerHTML = html;
}

/* ---------------- 竞赛设置弹窗 ---------------- */
function openSetup(taskId, mode) {
 const task = allTasks().find(t => t.id === taskId);
 if (!task) return;

 if (!getNick() && mode === 'competition') { askNickname(() => openSetup(taskId, mode)); return; }

 if (mode === 'practice' && store.get('draft_' + taskId, null)) {
 openModal(`
 <h3>检测到练习草稿</h3>
 <div class="info-box">上次练习已编辑 ${store.get('draft_' + taskId).done} 段，可继续或重新开始。</div>
 <div class="m-actions">
 <button class="btn btn-ghost" onclick="closeModal();startSession('${taskId}','practice',true)">重新开始</button>
 <button class="btn btn-primary" onclick="closeModal();startSession('${taskId}','practice')">继续上次草稿</button>
 </div>`);
 return;
 }

 const modeName = { competition: '限时练习', practice: '自由练习', demo: '教学演示' }[mode];
 let body = `<div class="info-box">
 任务：${esc(task.name)}（${esc(task.pair)} · ${task.segs.length} 段）<br>
 模式：${modeName}
 </div>`;

 if (mode === 'competition') {
 const durs = [Math.min(8, task.minutes), task.minutes, task.minutes * 2];
 body += `
 <div class="field"><label>限时时长</label>
 <div class="dur-picker">
 ${durs.map((d, i) => `<div class="dur-btn${i === 1 ? ' sel' : ''}" data-d="${d}" onclick="pickDur(this)">${d} 分钟${i === 1 ? '（建议）' : ''}</div>`).join('')}
 </div>
 </div>
 <div class="warn-box">限时练习规则：作答期间离开页面会被记录；倒计时归零将自动交卷；交卷后不可再修改。练习分仅供自己追踪，考场口径请用「③ 考 · 模拟参赛」。</div>`;
 }
 body += `
 <div class="m-actions">
 <button class="btn btn-ghost" onclick="closeModal()">取消</button>
 <button class="btn btn-primary" onclick="closeModal();startSession('${taskId}','${mode}')">开始作答 </button>
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
function startSession(taskId, mode, fresh) {
 const task = allTasks().find(t => t.id === taskId);
 if (!task) return;
 let answers = task.segs.map(() => '');
 let resumed = false;
 if (mode === 'practice' && !fresh) {
 const draft = store.get('draft_' + taskId, null);
 if (draft) { answers = draft.answers; resumed = true; }
 }
 S = {
 task, mode, answers, idx: 0,
 startTs: Date.now(),
 duration: mode === 'competition' ? (window._dur || task.minutes) * 60 : 0,
 cheat: 0, timer: null, draftSaveTm: null, done: false
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
 if (S.mode === 'practice') {
 clearTimeout(S.draftSaveTm);
 S.draftSaveTm = setTimeout(() => {
 const done = S.answers.filter((a, k) => a && a.trim() && a.trim() !== (S.task.segs[k].mt || '').trim()).length;
 store.set('draft_' + S.task.id, { answers: S.answers, done, savedAt: now() });
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
  const modeChip = mode === 'competition' ? '<span class="mode-chip">限时练习</span>'
 : mode === 'demo' ? '<span class="mode-chip demo">教学演示</span>'
 : '<span class="mode-chip prac">自由练习</span>';
 const timerHtml = mode === 'competition'
 ? `<div class="timer" id="timer">--:--</div>`
 : `<div class="muted" id="timer">${mode === 'demo' ? '教学演示 · 不计时' : '自由练习 · 不限时'}</div>`;

 app.innerHTML = `
 <div class="exam-top">
 <div class="exam-title">${esc(task.name)} ${modeChip}
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
 <div class="seg-cell">原文 Source（黄色高亮为术语，悬停/点击可查看译法）</div>
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
 <div class="kbd-hint" style="margin-top:8px"> 点击术语 = 将译法插入光标处</div>
 </div>
 <div class="panel">
 <h4> ${mode === 'demo' ? '本任务译后编辑要点' : '译后编辑小贴士'}</h4>
 <ul class="tips-list">
 <li>${esc(task.tips)}</li>
 ${mode === 'demo' ? '<li>每段右下角“查看点评”在交卷前即可展开，边看边改。</li>' : ''}
 </ul>
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
 if (mode === 'competition') {
 S.timer = setInterval(() => {
 if (!S) { clearInterval(S.timer); return; }
 const left = S.duration - Math.floor((Date.now() - S.startTs) / 1000);
 const el = $('#timer');
 if (!el) return;
 el.textContent = fmtTime(Math.max(0, left));
 if (left <= 60) el.classList.add('warn');
 if (left <= 0) { toast('时间到，系统自动交卷'); submitSession(); }
 }, 500);
 } else {
 S.timer = setInterval(() => {
 if (!S) { clearInterval(S.timer); return; }
 const el = $('#timer');
 if (el && S.mode === 'practice') el.textContent = '已用时 ' + fmtTime(Math.floor((Date.now() - S.startTs) / 1000));
 }, 1000);
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
 segDone, total: task.segs.length, words, details
 };

 stopSession(true);
 if (saveHistory([record].concat(history()).slice(0, 200))) {
 toast('本机存储接近上限：已自动精简较早记录的逐段明细（分数、日期与画像保留）');
 }
 renderResult(record);
}

/* ---------------- 成绩页 ---------------- */
function renderResult(r) {
 setAnswering(false);
 app.innerHTML = `
 <div class="page-title">
 <h2> ${r.mode === 'competition' ? '限时练习成绩' : r.mode === 'demo' ? '演示结果' : '练习结果'} · ${esc(r.taskName)}</h2>
 <div style="display:flex;gap:8px">
 <button class="btn btn-outline" onclick="exportReport('${r.id}')"> 导出成绩报告</button>
 <button class="btn btn-primary" onclick="go('plaza')">返回译后编辑实训</button>
 </div>
 </div>
 <div class="score-hero">
 <div class="stat-box"><div class="v">${r.score}</div><div class="l">综合得分（vs 参考译文）</div></div>
 <div class="stat-box"><div class="v amber">${r.ter}%</div><div class="l">平均机翻修订率</div></div>
 <div class="stat-box"><div class="v">${r.segDone}/${r.total}</div><div class="l">完成段数</div></div>
 <div class="stat-box"><div class="v green">${fmtTime(r.timeUsed)}</div><div class="l">用时</div></div>
 <div class="stat-box"><div class="v">${r.words}</div><div class="l">任务字数</div></div>
 </div>
 <div class="score-note"> 得分说明：综合得分基于与参考译文的<b>词级重合度</b>，同义改写或更优表达可能被低估，仅供历次练习横向对比；修订率按词级编辑量计算，<b>中文按字切分</b>，跨语向比较需谨慎。请结合下方逐段修订痕迹自行判断质量。</div>

 <h3 style="margin:6px 0 12px"> 逐段修订痕迹与点评</h3>
 ${r.details.map(d => `
 <div class="review-block">
 <h4>第 ${d.i + 1} 段
 ${d.empty ? '<span class="mini-tag" style="background:var(--red-bg);color:var(--red)">未作答</span>' : ''}
 ${!d.empty && d.ter === 0 ? '<span class="mini-tag ok">保留机翻</span>' : ''}
 ${!d.empty && d.ter > 0 ? `<span class="mini-tag edited">修订率 ${(d.ter * 100).toFixed(1)}%</span>` : ''}
 <span class="muted" style="font-weight:400;font-size:12px">与参考译文相似度 ${d.sim}%</span>
 </h4>
 <div class="rv-grid">
 <div class="rv-cell"><div class="lab">原文 Source</div>${esc(d.src)}</div>
 <div class="rv-cell"><div class="lab">我的译文（修订痕迹：红=删除机翻，绿=新增）</div><div class="diff">${d.empty ? '<span class="muted">（未作答）</span>' : renderDiffHTML(d.mt, d.pe)}</div></div>
 <div class="rv-cell"><div class="lab">机翻译文 MT</div>${esc(d.mt)}</div>
 <div class="rv-cell"><div class="lab">参考译文 Reference</div>${esc(d.ref)}</div>
 </div>
 ${d.notes.length ? `<div style="margin-top:8px">${d.notes.map(n => `<div class="note-item"><b>${esc(n.type)}</b>${esc(n.text)}</div>`).join('')}</div>` : ''}
 </div>`).join('')}
 `;
}

/* ---------------- 我的统计 ---------------- */
function renderStats() {
 setAnswering(false);
 const hs = history();
 let hasAnn = false;
 try { hasAnn = (JSON.parse(localStorage.getItem('mtpe_ann_stats') || '[]')).length > 0; } catch (e) {}
 if (!hs.length && !hasAnn) {
 app.innerHTML = `<div class="page-title"><h2>我的统计</h2></div>
 <div class="empty-tip">还没有作答记录，去<a href="practice.html">译后编辑练习</a>开始第一次练习，或去<a href="annotate.html">标注实训</a>完成一卷错误标注。</div>`;
 return;
 }
 const totalWords = hs.reduce((s, h) => s + h.words, 0);
 const avgScore = hs.length ? Math.round(hs.reduce((s, h) => s + h.score, 0) / hs.length * 10) / 10 : '—';
 const avgTer = hs.length ? Math.round(hs.reduce((s, h) => s + h.ter, 0) / hs.length * 10) / 10 : '—';
 const recent = hs.slice(0, 6).reverse();

 app.innerHTML = `
 <div class="page-title">
 <h2>我的统计</h2>
 <button class="btn btn-outline" onclick="exportCSV()"> 导出全部明细 (CSV)</button>
 <button class="btn btn-outline" onclick="exportHomework()"> 导出作业 JSON（交给老师汇总）</button>
 </div>
 <div class="score-hero">
 <div class="stat-box"><div class="v">${hs.length}</div><div class="l">完成次数</div></div>
 <div class="stat-box"><div class="v">${totalWords}</div><div class="l">累计实训字数</div></div>
 <div class="stat-box"><div class="v green">${avgScore}</div><div class="l">平均得分</div></div>
 <div class="stat-box"><div class="v amber">${avgTer}%</div><div class="l">平均修订率</div></div>
 </div>
 ${annStatsHTML()}
 ${examProfileHTML(hs)}
 <div class="board"><h3> 最近 ${recent.length} 次得分走势</h3>
 <div class="chart">
 ${recent.map(h => `
 <div class="bar-wrap">
 <span class="bar-v">${h.score}</span>
 <div class="bar" style="height:${Math.max(4, h.score)}%"></div>
 <span class="bar-l" title="${esc(h.taskName)}">${esc(h.taskName.slice(0, 6))}</span>
 </div>`).join('')}
 </div>
 </div>
 <div class="board"><h3> 作答记录</h3>
 <table>
 <tr><th>时间</th><th>任务</th><th>模式</th><th>得分</th><th>修订率</th><th>完成</th><th>用时</th><th></th></tr>
 ${hs.map(h => `
 <tr>
 <td class="muted">${esc(h.date)}</td>
 <td>${esc(h.taskName)}</td>
 <td>${{ competition: '竞赛', practice: '练习', demo: '演示' }[h.mode] || h.mode}</td>
 <td><b>${h.score}</b></td><td>${h.ter}%</td>
 <td>${h.segDone}/${h.total}</td><td>${fmtTime(h.timeUsed)}</td>
 <td><button class="btn btn-ghost" style="padding:4px 10px" onclick="viewRecord('${h.id}')">查看</button></td>
 </tr>`).join('')}
 </table>
 </div>`;
}

function viewRecord(id) {
 const r = history().find(h => h.id === id);
 if (r) renderResult(r);
 window.scrollTo(0, 0);
}

/* ---------------- 考试结果画像（pe-exam 交卷同步聚合） ---------------- */
function examProfileHTML(hs) {
 const recs = (hs || []).filter(h => h && h.profile);
 if (!recs.length) {
  return `<div class="board"><h3>考试结果画像</h3>
 <div class="empty-tip" style="padding:16px 0">暂无考场记录。去 <a href="pe-exam.html">模拟考场</a> 交一次卷，这里会汇总你的编辑倾向（精准型 / 过度编辑型 / 保守型 / 鲁莽型）、编辑命中率与后半程稳定性。</div></div>`;
 }
 const avg = (k) => Math.round(recs.reduce((s, h) => s + (Number(h.profile[k]) || 0), 0) / recs.length * 10) / 10;
 const QUADS = ['精准型', '过度编辑型', '保守型', '鲁莽型'];
 const quadCount = {};
 recs.forEach(h => { const q = h.profile.quadrant || '—'; quadCount[q] = (quadCount[q] || 0) + 1; });
 const mainQ = QUADS.slice().sort((a, b) => (quadCount[b] || 0) - (quadCount[a] || 0))[0];
 const quadTxt = QUADS.filter(q => quadCount[q]).map(q => `${q} ${quadCount[q]} 次`).join('　｜　') || '—';
 const stab = avg('stability');
 return `<div class="board"><h3> 考试结果画像（共 ${recs.length} 次交卷）</h3>
  <div class="score-hero" style="margin-bottom:10px">
  <div class="stat-box"><div class="v">${avg('editRate')}%</div><div class="l">平均编辑率</div></div>
  <div class="stat-box"><div class="v green">${avg('effRate')}%</div><div class="l">平均有效编辑率</div></div>
  <div class="stat-box"><div class="v">${avg('speed')}</div><div class="l">平均速度（段/分）</div></div>
  <div class="stat-box"><div class="v ${stab < 0 ? 'amber' : 'green'}">${stab >= 0 ? '+' : ''}${stab}</div><div class="l">后半程平均变化</div></div>
  </div>
 <div class="board-note">编辑倾向分布：${quadTxt}　｜　最多的是「${mainQ}」，各次交卷的四项画像见 <a href="pe-exam.html">③ 考</a> 的结果页。</div>
  </div>`;
}

/* ---------------- 标注实训能力（annotate.html 同步） ---------------- */
function annStatsHTML() {
 let st = [];
 try { st = JSON.parse(localStorage.getItem('mtpe_ann_stats') || '[]'); } catch (e) {}
 if (!st.length) {
 return `<div class="board"><h3> 标注实训能力</h3>
 <div class="empty-tip" style="padding:16px 0">暂无标注记录。去 <a href="annotate.html">标注实训</a> 完成一卷错误标注（与种子标注对比），这里会展示你的查准率 / 查全率 / F1 走势。</div></div>`;
 }
 const avg = (k) => Math.round(st.reduce((s, x) => s + (x[k] || 0), 0) / st.length * 10) / 10;
 return `<div class="board"><h3> 标注实训能力（共 ${st.length} 卷）</h3>
 <div class="score-hero" style="margin-bottom:10px">
 <div class="stat-box"><div class="v">${avg('precision')}%</div><div class="l">平均查准率</div></div>
 <div class="stat-box"><div class="v green">${avg('recall')}%</div><div class="l">平均查全率</div></div>
 <div class="stat-box"><div class="v">${avg('f1')}%</div><div class="l">平均 F1</div></div>
 <div class="stat-box"><div class="v amber">${st.reduce((s, x) => s + (x.tagWrong || 0) + (x.sevWrong || 0), 0)}</div><div class="l">累计标签/严重度偏差</div></div>
 </div>
 <table>
 <tr><th>时间</th><th>查准率</th><th>查全率</th><th>F1</th><th>标签/严重度偏差</th><th>漏检</th><th>多余</th></tr>
 ${st.slice(0, 10).map(x => `<tr>
 <td class="muted">${esc(x.date)}</td><td><b>${x.precision}%</b></td><td>${x.recall}%</td><td>${x.f1}%</td>
 <td>${(x.tagWrong || 0) + (x.sevWrong || 0)}</td><td>${x.FN || 0}</td><td>${x.FP || 0}</td>
 </tr>`).join('')}
 </table>
 <div class="board-note">数据来自 <a href="annotate.html">标注实训</a> 交卷自动同步：漏检（FN）说明该改的没找到，多余（FP）说明标了机翻本来没问题的地方。</div>
 </div>`;
}

/* ---------------- 导出 ---------------- */
function exportReport(id) {
 const r = history().find(h => h.id === id);
 if (!r) return;
 const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>MTPE 成绩报告 · ${esc(r.taskName)}</title>
<style>body{font-family:"Microsoft YaHei",sans-serif;max-width:900px;margin:30px auto;padding:0 20px;color:#1f2430}
h1{font-size:22px}table{width:100%;border-collapse:collapse;margin:14px 0}
td,th{border:1px solid #ddd;padding:8px 10px;font-size:14px;text-align:left}
.blk{border:1px solid #e3e8f2;border-radius:10px;padding:14px;margin:12px 0}
del{background:#fdecec;color:#dc2626}ins{background:#e8f7ee;color:#16a34a;text-decoration:none}
.meta{color:#5a6478;font-size:13px}.score{font-size:34px;font-weight:800;color:#2f5fe0}</style></head><body>
<h1>译后编辑成绩报告</h1>
<p class="meta">选手：${esc(r.nickname)} ｜ 任务：${esc(r.taskName)}（${esc(r.pair)} · ${esc(r.domain)}）<br>
模式：${r.mode} ｜ 时间：${esc(r.date)} ｜ 用时：${fmtTime(r.timeUsed)}</p>
<p><span class="score">${r.score}</span> 综合得分　｜　平均修订率 ${r.ter}% ｜ 完成 ${r.segDone}/${r.total} 段</p>
${r.details.map(d => `<div class="blk"><b>第 ${d.i + 1} 段</b>（修订率 ${(d.ter * 100).toFixed(1)}% · 相似度 ${d.sim}%）
<p>原文：${esc(d.src)}</p><p>机翻：${esc(d.mt)}</p>
<p>我的译文（修订痕迹）：<span style="text-decoration:none">${d.empty ? '（未作答）' : renderDiffHTML(d.mt, d.pe)}</span></p>
<p>参考：${esc(d.ref)}</p>${d.notes.map(n => `<p>【${esc(n.type)}】${esc(n.text)}</p>`).join('')}</div>`).join('')}
</body></html>`;
 download('MTPE成绩报告_' + r.taskName.slice(0, 12) + '.html', html, 'text/html');
}

/* 导出作业 JSON：交给老师汇总（含账号、作答记录与画像、标注实训成绩、错题本） */
function exportHomework() {
 const account = (window.mtpeAccount && window.mtpeAccount()) || getNick() || '未登录';
 let ann = [], wrong = [];
 try { ann = JSON.parse(localStorage.getItem('mtpe_ann_stats') || '[]') || []; } catch (e) {}
 try { wrong = JSON.parse(localStorage.getItem('ann_wrongbook') || '[]') || []; } catch (e) {}
 const payload = {
 account: account,
 exported: now(),
 tasks: (history() || []).length,
 history: history() || [],
 annStats: ann,
 wrongbook: wrong
 };
 const name = 'MTPE作业_' + String(account).replace(/[^\w-]/g, '') + '_' + new Date().toISOString().slice(0, 10) + '.json';
 download(name, JSON.stringify(payload, null, 1), 'application/json');
 toast('已导出作业：' + name + '　请交给老师汇总');
}

function exportCSV() {
 const rows = [['时间', '昵称', '任务', '语向', '领域', '模式', '得分', '修订率%', '完成段', '总段', '字数', '用时秒', '编辑率%', '有效编辑率%', '编辑倾向', '速度段每分', '后半程变化']];
 history().forEach(h => rows.push([h.date, h.nickname, h.taskName, h.pair, h.domain, h.mode, h.score, h.ter, h.segDone, h.total, h.words, h.timeUsed,
  h.profile ? h.profile.editRate : '', h.profile ? h.profile.effRate : '', h.profile ? h.profile.quadrant : '',
  h.profile ? h.profile.speed : '', h.profile ? h.profile.stability : '']));
 const csv = '\uFEFF' + rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
 download('MTPE实训明细.csv', csv, 'text/csv');
}

function download(name, content, type) {
 const a = document.createElement('a');
 a.href = URL.createObjectURL(new Blob([content], { type: type + ';charset=utf-8' }));
 a.download = name;
 a.click();
 setTimeout(() => URL.revokeObjectURL(a.href), 3000);
 toast('已导出：' + name);
}

/* ---------------- 启动 ---------------- */
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
updateNickBadge();
(function boot() {
 /* 支持 practice.html#stats / #import 直接落到对应视图（首页的「我的统计」就是这么跳的） */
 const h = (location.hash || '').replace(/^#/, '');
 if (h === 'stats' || h === 'plaza') go(h);
 else renderPlaza();
})();

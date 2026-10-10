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
const customTasks = () => store.get('custom_tasks', []);
const allTasks = () => TASKS.concat(customTasks());
const history = () => store.get('history', []);

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
 else if (v === 'import') renderImport();
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
 const isTeacher = (window.mtpeIsTeacher && window.mtpeIsTeacher()) || localStorage.getItem('mtpe_role') === 'teacher';
 const tasks = allTasks();
 const html = `
 <div class="plaza-head">
 <h2>译后编辑实训</h2>
 <p>${isTeacher ? '选择一套任务和作答模式。竞赛模拟提供倒计时、自动交卷与排行榜；自由练习可随时保存草稿；教学演示附错误点评。' : '选择一套任务和作答模式。竞赛模拟提供倒计时、自动交卷与排行榜；自由练习可随时保存草稿。'}
 ｜ <a href="MQM错误类型参考手册.html" target="_blank">MQM 错误类型参考手册</a></p>
 <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
 <button class="btn btn-ghost" onclick="go('stats')"> 我的统计</button>
 <a class="btn btn-ghost" href="annotate.html" style="text-decoration:none"> 进入标注实训（练"找错"）</a>
 <a class="btn btn-ghost" href="pe-exam.html" style="text-decoration:none"> 进入模拟参赛</a>
 </div>
 </div>
 <div class="mode-strip">
 <div class="mode-card"><b><span class="ic"></span>竞赛模拟</b><span>限时作答、离开页面计数、交卷后进入排行榜（仿大赛流程）</span></div>
 <div class="mode-card"><b><span class="ic"></span>自由练习</b><span>不限时、可保存草稿，聚焦修订痕迹与修订率反馈</span></div>
 ${isTeacher ? '<div class="mode-card"><b><span class="ic"></span>教学演示</b><span>逐段查看错误类型点评与参考译文，适合课堂讲解</span></div>' : ''}
 </div>
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
 ${t.custom ? '<span class="tag custom">自建</span>' : ''}
 </div>
 </div>
 <div class="meta">
 <span> ${t.segs.length} 段</span><span> 约 ${wc} 字</span>
 <span>⏱ 建议 ${t.minutes} 分钟</span>
 </div>
 ${draft ? `<div class="draft-tip"> 检测到未完成的练习草稿（${draft.done}/${t.segs.length} 段已编辑）</div>` : ''}
 <div class="task-actions">
 <button class="btn btn-primary" onclick="openSetup('${t.id}','competition')"> 竞赛模拟</button>
 <button class="btn btn-outline" onclick="openSetup('${t.id}','practice')"> 自由练习</button>
 ${isTeacher ? `<button class="btn btn-ghost" onclick="openSetup('${t.id}','demo')"> 教学演示</button>` : ''}
 ${t.custom ? `<button class="btn btn-danger" onclick="delCustom('${t.id}')">删除</button>` : ''}
 </div>
 </div>`;
 }).join('')}
 </div>`;
 app.innerHTML = html;
}

function delCustom(id) {
 if (!confirm('确定删除该自建任务及其草稿？历史成绩会保留。')) return;
 store.set('custom_tasks', customTasks().filter(t => t.id !== id));
 store.del('draft_' + id);
 renderPlaza();
 toast('已删除');
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

 const modeName = { competition: '竞赛模拟', practice: '自由练习', demo: '教学演示' }[mode];
 let body = `<div class="info-box">
 任务：${esc(task.name)}（${esc(task.pair)} · ${task.segs.length} 段）<br>
 模式：${modeName}
 </div>`;

 if (mode === 'competition') {
 const durs = [Math.min(8, task.minutes), task.minutes, task.minutes * 2];
 body += `
 <div class="field"><label>竞赛时长</label>
 <div class="dur-picker">
 ${durs.map((d, i) => `<div class="dur-btn${i === 1 ? ' sel' : ''}" data-d="${d}" onclick="pickDur(this)">${d} 分钟${i === 1 ? '（建议）' : ''}</div>`).join('')}
 </div>
 </div>
 <div class="warn-box"> 竞赛防作弊规则：作答期间离开页面会被记录；倒计时归零将自动交卷；交卷后不可再修改。</div>`;
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

function onAnswerInput(i, val) {
 if (!S) return;
 S.answers[i] = val;
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
 const { task, mode } = S;
 const modeChip = mode === 'competition' ? '<span class="mode-chip">竞赛模拟</span>'
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
 <button class="btn btn-ghost" onclick="go('plaza')">退出</button>
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
 placeholder="${mode === 'demo' ? '输入译后编辑结果……' : '在机翻译文基础上编辑'}"></textarea></div>
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
 <li>优先解决<strong>准确性</strong>问题（漏译、误译、数字），再打磨流畅度。</li>
 <li>不必逐字重写：机翻正确时保留原文，避免过度编辑。</li>
 ${mode === 'demo' ? '<li>每段右下角“查看点评”在交卷前即可展开，边看边改。</li>' : ''}
 </ul>
 </div>
 <div class="panel kbd-hint">
 <b>快捷键</b><br>
 <span class="kbd">Ctrl</span>+<span class="kbd">Enter</span> 跳到下一段<br>
 点击左侧段落序号可快速定位
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
 store.set('history', [record].concat(history()).slice(0, 200));
 renderResult(record);
}

/* ---------------- 成绩页 ---------------- */
function renderResult(r) {
 const board = buildBoard(r);

 app.innerHTML = `
 <div class="page-title">
 <h2> ${r.mode === 'competition' ? '竞赛成绩' : r.mode === 'demo' ? '演示结果' : '练习结果'} · ${esc(r.taskName)}</h2>
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

 <div class="board">
 <h3> 排行榜（本任务）</h3>
 <table>
 <tr><th>名次</th><th>选手</th><th>得分</th><th>说明</th></tr>
 ${board.rows.map(row => `
 <tr class="${row.me ? 'me' : ''}">
 <td class="${row.rank === 1 ? 'rank-1' : ''}">${row.rank <= 3 ? ['', '', ''][row.rank - 1] : '#' + row.rank}</td>
 <td>${esc(row.name)}${row.me ? '（我）' : ''}</td>
 <td><b>${row.score}</b></td><td class="muted">${esc(row.note)}</td>
 </tr>`).join('')}
 </table>
 <div class="board-note">* 榜单由内置演示数据与本人历史成绩合并生成，仅用于教学演示。</div>
 </div>

 <h3 style="margin:6px 0 12px"> 逐段修订痕迹与点评</h3>
 <div class="score-note" style="background:var(--primary-light)"> <b>MQM 自评</b>：给每处修改选择错误类别（可多选，对应 MQM 简化版八类），保存后将在「我的统计」生成你的<b>错误敏感度画像</b>。</div>
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
 ${!d.empty ? `
 <div style="margin-top:8px" data-tagrow="${d.i}">
 <span class="muted" style="font-size:12.5px;margin-right:6px">MQM 自评：</span>
 ${MQM_TAGS.map(t => `<span class="mqm-chip${(d.mqmTags || []).includes(t.id) ? ' on' : ''}" data-tag="${t.id}" onclick="toggleTag(${d.i},this)">${t.label}</span>`).join('')}
 </div>` : ''}
 </div>`).join('')}
 <div style="display:flex;gap:8px;margin:4px 0 30px">
 <button class="btn btn-primary" onclick="saveMqmTags('${r.id}')"> 保存 MQM 自评</button>
 <span class="muted" style="align-self:center">标注会同步到「我的统计」的错误敏感度画像</span>
 </div>`;
}

/* ---------------- MQM 自评 ---------------- */
const MQM_TAGS = [
 { id: 'acc', label: '误译/幻觉' },
 { id: 'omi', label: '漏译/增译' },
 { id: 'term', label: '术语问题' },
 { id: 'num', label: '数字与单位' },
 { id: 'gram', label: '语法搭配' },
 { id: 'spell', label: '拼写标点' },
 { id: 'style', label: '风格语域' },
 { id: 'fmt', label: '格式标记' }
];
function toggleTag(i, chip) {
 if (chip) chip.classList.toggle('on');
}
function saveMqmTags(recordId) {
 const hs = history();
 const rec = hs.find(h => h.id === recordId);
 if (!rec) { toast('未找到记录'); return; }
 document.querySelectorAll('[data-tagrow]').forEach(row => {
 const i = parseInt(row.dataset.tagrow, 10);
 const tags = [...row.querySelectorAll('.mqm-chip.on')].map(c => c.dataset.tag);
 if (rec.details[i]) rec.details[i].mqmTags = tags;
 });
 store.set('history', hs);
 toast('MQM 自评已保存，可在「我的统计」查看错误敏感度画像');
}

function buildBoard(r) {
 const demo = (DEMO_BOARD[r.taskId] || []).map(([name, score]) => ({ name, score, note: '内置演示数据' }));
 const mine = history().filter(h => h.taskId === r.taskId && h.mode === 'competition')
 .map(h => ({ name: h.nickname, score: h.score, note: h.date, me: h.id === r.id }));
 if (!mine.length) mine.push({ name: r.nickname, score: r.score, note: r.date, me: true });
 const rows = demo.concat(mine).sort((a, b) => b.score - a.score);
 rows.forEach((row, i) => { row.rank = i + 1; });
 return { rows: rows.slice(0, 12) };
}

/* ---------------- 我的统计 ---------------- */
function renderStats() {
 const hs = history();
 let hasAnn = false;
 try { hasAnn = (JSON.parse(localStorage.getItem('mtpe_ann_stats') || '[]')).length > 0; } catch (e) {}
 if (!hs.length && !hasAnn) {
 app.innerHTML = `<div class="page-title"><h2>我的统计</h2></div>
 <div class="empty-tip">还没有作答记录，去<a href="#" onclick="go('plaza');return false">译后编辑实训</a>开始第一次练习，或去<a href="annotate.html" target="_blank">标注实训</a>完成一卷错误标注。</div>`;
 return;
 }
 const totalWords = hs.reduce((s, h) => s + h.words, 0);
 const avgScore = hs.length ? Math.round(hs.reduce((s, h) => s + h.score, 0) / hs.length * 10) / 10 : '—';
 const avgTer = hs.length ? Math.round(hs.reduce((s, h) => s + h.ter, 0) / hs.length * 10) / 10 : '—';
 const recent = hs.slice(0, 10).reverse();

 app.innerHTML = `
 <div class="page-title">
 <h2>我的统计</h2>
 <button class="btn btn-outline" onclick="exportCSV()"> 导出全部明细 (CSV)</button>
 </div>
 <div class="score-hero">
 <div class="stat-box"><div class="v">${hs.length}</div><div class="l">完成次数</div></div>
 <div class="stat-box"><div class="v">${totalWords}</div><div class="l">累计实训字数</div></div>
 <div class="stat-box"><div class="v green">${avgScore}</div><div class="l">平均得分</div></div>
 <div class="stat-box"><div class="v amber">${avgTer}%</div><div class="l">平均修订率</div></div>
 </div>
 <div class="page-s">说明：得分基于参考译文词级重合度（同义改写可能低估）；修订率中文按字切分，跨语向比较需谨慎。</div>
 ${annStatsHTML()}
 ${mqmProfileHTML(hs)}
 ${examProfileHTML(hs)}
 ${wrongbookHTML()}
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
  <div class="empty-tip" style="padding:16px 0">暂无考场记录。去 <a href="pe-exam.html" target="_blank">模拟考场</a> 交一次卷，这里会汇总你的编辑倾向（精准型 / 过度编辑型 / 保守型 / 鲁莽型）、编辑命中率与后半程稳定性。</div></div>`;
 }
 const avg = (k) => Math.round(recs.reduce((s, h) => s + (Number(h.profile[k]) || 0), 0) / recs.length * 10) / 10;
 const QUADS = ['精准型', '过度编辑型', '保守型', '鲁莽型'];
 const quadCount = {};
 recs.forEach(h => { const q = h.profile.quadrant || '—'; quadCount[q] = (quadCount[q] || 0) + 1; });
 const maxQ = Math.max(1, ...QUADS.map(q => quadCount[q] || 0));
 const bars = QUADS.map(q => `
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
  <span style="width:84px;font-size:13px;flex-shrink:0">${q}</span>
  <div style="flex:1;height:14px;background:#eef1f7;border-radius:99px;overflow:hidden">
  <div style="width:${(quadCount[q] || 0) / maxQ * 100}%;height:100%;background:linear-gradient(90deg,#6c8cff,var(--primary));border-radius:99px"></div>
  </div>
  <span style="width:70px;font-size:12.5px;color:var(--text-2)">${quadCount[q] || 0} 次</span>
  </div>`).join('');
 const mainQ = QUADS.slice().sort((a, b) => (quadCount[b] || 0) - (quadCount[a] || 0))[0];
 const stab = avg('stability');
 return `<div class="board"><h3> 考试结果画像（共 ${recs.length} 次交卷）</h3>
  <div class="score-hero" style="margin-bottom:10px">
  <div class="stat-box"><div class="v">${avg('editRate')}%</div><div class="l">平均编辑率</div></div>
  <div class="stat-box"><div class="v green">${avg('effRate')}%</div><div class="l">平均有效编辑率</div></div>
  <div class="stat-box"><div class="v">${avg('speed')}</div><div class="l">平均速度（段/分）</div></div>
  <div class="stat-box"><div class="v ${stab < 0 ? 'amber' : 'green'}">${stab >= 0 ? '+' : ''}${stab}</div><div class="l">后半程平均变化</div></div>
  </div>
  ${bars}
  <div class="board-note">编辑倾向来自每次交卷的逐段 diff 初筛，出现最多的是「${mainQ}」（${quadCount[mainQ] || 0} 次）。有效编辑率＝改对的问题点 ÷ 改动的词数；偏低说明改动多而命中少，先练"判断哪里该改"（M0 思维）。画像细节见各次交卷的结果页。</div>
  </div>`;
}

/* ---------------- 错题本（标注实训 → 错题回练闭环） ---------------- */
function wrongbookHTML() {
 let wb = [];
 try { wb = JSON.parse(localStorage.getItem('ann_wrongbook') || '[]') || []; } catch (e) {}
 const keys = [...new Set(wb.map(w => w.k))];
 if (!keys.length) return '';
 const kinds = {};
 wb.forEach(w => { kinds[w.kind] = (kinds[w.kind] || 0) + 1; });
 const kindTxt = Object.keys(kinds).map(k => k + ' ' + kinds[k]).join(' ｜ ');
 return `<div class="board"><h3> 错题本（${keys.length} 句 / ${wb.length} 处）</h3>
 <div class="board-note" style="margin-top:0">来自标注实训中漏检 / 标签判错 / 严重度判偏的种子错误：${kindTxt}。</div>
 <div style="margin-top:10px"><a class="btn btn-outline" href="annotate.html?wrong=1" target="_blank" style="text-decoration:none">错题回练</a>
 <span class="muted" style="margin-left:10px">只重做这些句子，交卷后同样按种子对照计分。</span></div>
 </div>`;
}

/* ---------------- 标注实训能力（annotate.html 同步） ---------------- */
function annStatsHTML() {
 let st = [];
 try { st = JSON.parse(localStorage.getItem('mtpe_ann_stats') || '[]'); } catch (e) {}
 if (!st.length) {
 return `<div class="board"><h3> 标注实训能力</h3>
 <div class="empty-tip" style="padding:16px 0">暂无标注记录。去 <a href="annotate.html" target="_blank">标注实训</a> 完成一卷错误标注（与种子标注对比），这里会展示你的查准率 / 查全率 / F1 走势。</div></div>`;
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
 <tr><th>时间</th><th>查准率</th><th>查全率</th><th>F1</th><th>标签/严重度偏差</th><th>漏检</th><th>多余</th><th>质量分偏差</th></tr>
 ${st.slice(0, 10).map(x => `<tr>
 <td class="muted">${esc(x.date)}</td><td><b>${x.precision}%</b></td><td>${x.recall}%</td><td>${x.f1}%</td>
 <td>${(x.tagWrong || 0) + (x.sevWrong || 0)}</td><td>${x.FN || 0}</td><td>${x.FP || 0}</td>
 <td>${x.seedQ != null && x.studentQ != null ? (x.studentQ - x.seedQ > 0 ? '+' : '') + Math.round((x.studentQ - x.seedQ) * 10) / 10 : '—'}</td>
 </tr>`).join('')}
 </table>
 <div class="board-note">数据来自 <a href="annotate.html" target="_blank">标注实训</a> 交卷自动同步；质量分偏差=你的 MQM-B 评分 − 种子评分，正值说明你判定的问题偏少（警惕漏检），负值偏多（警惕过度标注）。</div>
 </div>`;
}

/* ---------------- 错误敏感度画像（MQM 自评聚合） ---------------- */
function mqmProfileHTML(hs) {
 const count = {};
 let total = 0;
 hs.forEach(h => (h.details || []).forEach(d => (d.mqmTags || []).forEach(t => { count[t] = (count[t] || 0) + 1; total++; })));
 if (!total) {
 return `<div class="board"><h3> 错误敏感度画像（MQM 自评）</h3>
 <div class="empty-tip" style="padding:16px 0">暂无标注。交卷后在结果页逐段完成 MQM 自评并保存，这里会生成你的错误敏感度画像。</div></div>`;
 }
 const max = Math.max(...Object.values(count));
 const rows = MQM_TAGS.map(t => ({ label: t.label, n: count[t.id] || 0 }))
 .sort((a, b) => b.n - a.n)
 .map(x => `
 <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
 <span style="width:96px;font-size:13px;flex-shrink:0">${x.label}</span>
 <div style="flex:1;height:14px;background:#eef1f7;border-radius:99px;overflow:hidden">
 <div style="width:${x.n / max * 100}%;height:100%;background:linear-gradient(90deg,#6c8cff,var(--primary));border-radius:99px"></div>
 </div>
 <span style="width:70px;font-size:12.5px;color:var(--text-2)">${x.n} 次 · ${Math.round(x.n / total * 100)}%</span>
 </div>`).join('');
 const top = MQM_TAGS.map(t => ({ label: t.label, n: count[t.id] || 0 })).sort((a, b) => b.n - a.n)[0];
 return `<div class="board"><h3> 错误敏感度画像（MQM 自评 · 共 ${total} 处标注）</h3>
 ${rows}
 <div class="board-note">你标注最多的类型是「${top.label}」（占 ${Math.round(top.n / total * 100)}%）——这是你当前最敏感（或机翻最常出问题）的错误类型，可对照 <a href="MQM错误类型参考手册.html" target="_blank">MQM 手册</a> 查漏补缺。</div>
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

/* ---------------- 导入任务 ---------------- */
function renderImport() {
 app.innerHTML = `
 <div class="page-title"><h2>导入自定义任务</h2></div>
 <div class="import-grid">
 <div class="board">
 <h3> 粘贴文本</h3>
 <p class="muted" style="margin-bottom:8px">每段写两行：第 1 行原文、第 2 行机翻译文；段与段之间空一行。<br>
 也支持一行内用 Tab 分隔「原文机翻」。如粘贴第 3 行将视为参考译文（用于评分与教学演示）。</p>
 <textarea class="big" id="imp-text" placeholder="The new chip delivers twice the computing power while consuming 30 percent less energy.
这款新芯片提供了两倍的算力，同时消耗了30%的能源。
这款新芯片算力提升一倍，能耗降低30%。

Artificial intelligence will not replace translators, but translators who use AI may replace those who do not.
人工智能不会取代译者，但使用人工智能的译者可能会取代那些不使用的人。"></textarea>
 </div>
 <div>
 <div class="board">
 <h3> 任务信息</h3>
 <div class="field"><label>任务名称</label><input id="imp-name" placeholder="例如：金融资讯英译中练习"></div>
 <div class="field"><label>语向</label>
 <select id="imp-pair"><option>英译中</option><option>中译英</option><option>日译中</option><option>中译日</option><option>其他</option></select>
 </div>
 <div class="field"><label>领域</label><input id="imp-domain" placeholder="例如：科技 / 商务 / 医学" value="综合"></div>
 <div class="field"><label>建议时长（分钟）</label><input id="imp-min" type="number" value="10" min="1" max="180"></div>
 <div class="field"><label>术语表（可选，每行「原文=译文」）</label>
 <textarea class="big" id="imp-terms" style="min-height:90px" placeholder="computing power=算力
hallucination=幻觉"></textarea>
 </div>
 <button class="btn btn-primary" style="width:100%" onclick="doImport()">创建任务</button>
 <p class="muted" style="margin-top:10px">任务保存在本浏览器（localStorage），可在译后编辑实训查看与删除。</p>
 </div>
 </div>
 </div>`;
}

function doImport() {
 const text = $('#imp-text').value.trim();
 const name = $('#imp-name').value.trim() || '自定义任务';
 const pair = $('#imp-pair').value;
 const domain = $('#imp-domain').value.trim() || '综合';
 const minutes = Math.max(1, parseInt($('#imp-min').value, 10) || 10);
 if (!text) { toast('请先粘贴任务文本'); return; }

 const segs = [];
 const blocks = text.split(/\n\s*\n/);
 for (const block of blocks) {
 const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
 if (!lines.length) continue;
 if (lines.length === 1 && lines[0].includes('\t')) {
 const [src, mt] = lines[0].split('\t');
 segs.push({ src: src.trim(), mt: (mt || '').trim(), ref: '' });
 } else {
 segs.push({ src: lines[0], mt: lines[1] || '', ref: lines[2] || '' });
 }
 }
 if (!segs.length) { toast('未解析到有效段落，请检查格式'); return; }

 const terms = $('#imp-terms').value.split('\n').map(l => l.trim()).filter(l => l.includes('='))
 .map(l => { const i = l.indexOf('='); return { s: l.slice(0, i).trim(), t: l.slice(i + 1).trim() }; });

 const tasks = customTasks();
 tasks.push({
 id: 'c' + Date.now(), name, pair, domain, minutes, custom: true,
 tips: '自建任务：优先解决准确性问题，再打磨表达。',
 terms, segs
 });
 store.set('custom_tasks', tasks);
 toast('已创建任务「' + name + '」，共 ' + segs.length + ' 段');
 go('plaza');
}

/* ---------------- 启动 ---------------- */
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
updateNickBadge();
renderPlaza();

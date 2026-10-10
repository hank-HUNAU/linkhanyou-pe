/* ============================================================
 * MTPE 标注实训 · 逻辑（一期 MVP：选段打标 + 种子对照评分）
 * 数据：annotate-data.js（CORPUS_PAIRS / SEEDS / SCHEME，由 build_corpus.mjs 生成）
 * ============================================================ */
const $ = (s) => document.querySelector(s);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const norm = (s) => s.replace(/\s+/g, '').replace(/[“”"'']/g, '"');

const store = {
 get(k, d) { try { const v = localStorage.getItem('ann_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
 set(k, v) { localStorage.setItem('ann_' + k, JSON.stringify(v)); },
 del(k) { localStorage.removeItem('ann_' + k); }
};
function toast(m) { const t = $('#toast'); t.textContent = m; t.style.opacity = '1'; clearTimeout(t._m); t._m = setTimeout(() => t.style.opacity = '0', 2200); }

/* 词元 diff 相似度（与主平台一致的字符级近似） */
function tokenize(s) { return (s.match(/[\u4e00-\u9fff]|[A-Za-z]+(?:'[a-z]+)?|\d+(?:\.\d+)?%?|[^\s]/g) || []); }
function editDist(a, b) {
 const n = a.length, m = b.length;
 const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
 for (let i = 0; i <= n; i++) dp[i][0] = i;
 for (let j = 0; j <= m; j++) dp[0][j] = j;
 for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++)
 dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + 1);
 return dp[n][m];
}
function simT(a, b) { const A = tokenize(a), B = tokenize(b); if (!A.length && !B.length) return 1; if (!A.length || !B.length) return 0;
 return 1 - editDist(A, B) / Math.max(A.length, B.length); }

const TAG_LABEL = Object.fromEntries(SCHEME.map(([id, label]) => [id, label]));
const SEV_COLOR = { Critical: 'var(--r)', Major: 'var(--a)', Minor: 'var(--b)' };
/* LLM 预标注（待校对）映射：与学生端金标准 SEEDS 分离，仅作"待验证提示" */
const PRE_MAP = {};
(typeof PRE !== 'undefined' ? PRE : []).forEach(function (x) { (PRE_MAP[x.k] = PRE_MAP[x.k] || []).push(x); });

/* ---------------- 优化B：错误维度组卷 / 错题本 ---------------- */
const DIM_LIST = ['准确性', '术语', '语言规范', '风格', '格式'];
function qs() { try { return new URLSearchParams(location.search); } catch (e) { return new URLSearchParams(''); } }
function wrongbook() { return store.get('wrongbook', []) || []; }
function saveWrongbook(list) { store.set('wrongbook', list.slice(0, 300)); }
function clearWrong() { store.del('wrongbook'); renderSetup(); toast('错题本已清空'); }
function wrongKeys() { return [...new Set(wrongbook().map(w => w.k))]; }

/* ---------------- 全局状态 ---------------- */
let V = 'setup';
let A = null; // {paper:[pair...], idx, anns:{k:[...]}, reviews:{k:[...]}, seeded:Set(k)}
/* A.reviews：学生对 LLM 预标注的校对记录（采纳/修改/驳回+理由），供教师仲裁 */

/* ---------------- 组卷 ---------------- */
function renderSetup() {
 V = 'setup';
 const P = qs();
 const eds = [...new Set(CORPUS_PAIRS.map(p => p.ed))].sort();
 const dirs = [...new Set(CORPUS_PAIRS.map(p => p.dir))];
 const stages = [...new Set(CORPUS_PAIRS.map(p => p.stage))];
 const seededK = new Set(SEEDS.map(s => s.k));
 const seedCount = CORPUS_PAIRS.filter(p => seededK.has(p.k)).length;
 const pre = { ed: P.get('ed') || '', stage: P.get('stage') || '', dir: P.get('dir') || '', dim: P.get('dim') || '', n: P.get('n') || '15' };
 const wb = wrongbook();
 const wbN = wrongKeys().length;
 app.innerHTML = `
 <div class="top">
 <div class="brand"><span class="logo">标</span>MTPE 标注实训 <span class="en">错误标注 · 种子对照</span></div>
 <a class="muted" href="index.html" style="text-decoration:none">返回首页</a>
 </div>
 <div class="wrap">
 <h1>标注实训</h1>
 <div class="page-s">在机翻译文中<b>选中错误片段</b>并标注类别与严重度；交卷后与已校对种子标注对比，计算查准率 / 查全率 / F1。
 数据：历届大赛 ${CORPUS_PAIRS.length} 条 A 级句对（其中 ${seedCount} 条有种子标注可对照，其余为盲标）。标签集 M1-M9 + M0 见 <a href="MQM错误类型参考手册.html">MQM 手册</a>。</div>
 <div class="card">
 <h3> 组卷筛选</h3>
 <div class="row">
 <div><label>届次</label><select id="f-ed"><option value="">全部</option>${eds.map(e => `<option value="${e}"${String(pre.ed) === String(e) ? ' selected' : ''}>第${e}届</option>`).join('')}</select></div>
 <div><label>赛段</label><select id="f-stage"><option value="">全部</option>${stages.map(s => `<option${pre.stage === s ? ' selected' : ''}>${s}</option>`).join('')}</select></div>
 <div><label>方向</label><select id="f-dir"><option value="">全部</option>${dirs.map(d => `<option${pre.dir === d ? ' selected' : ''}>${d}</option>`).join('')}</select></div>
 <div><label>错误类型</label><select id="f-dim"><option value="">全部</option>${DIM_LIST.map(d => `<option${pre.dim === d ? ' selected' : ''}>${d}</option>`).join('')}</select></div>
 <div><label>机翻底稿</label><select id="f-mt"><option value="">含无底稿（跳过）</option><option value="1">仅限有底稿</option></select></div>
 <div><label>卷大小</label><select id="f-n">${[10, 15, 20, 30].map(k => `<option${String(pre.n) === String(k) ? ' selected' : ''}>${k}</option>`).join('')}</select></div>
 </div>
 <div style="margin-top:12px;display:flex;gap:10px;align-items:center">
 <button class="btn btn-p" onclick="compose()">生成试卷 </button>
 <span class="muted">有种子标注的句对优先入选（训练轮），其余为盲标轮。</span>
 </div>
 <div id="compose-out" class="page-s" style="margin-top:10px"></div>
 </div>
 ${wbN ? `<div class="card"><h3> 错题本（${wbN} 句 / ${wb.length} 处待回练）</h3>
 <div class="page-s">来自你以往标注实训中<b>漏检</b>或<b>标签判错</b>的种子错误。回练只重做这些句子，交卷后同样计分。</div>
 <ul style="margin:0 0 10px 18px;font-size:13px;color:var(--tx2)">${wb.slice(0, 6).map(w => `<li>${esc(w.k)} ｜「${esc(String(w.span).slice(0, 24))}」 → 应为 <b>${TAG_LABEL[w.tag] || w.tag}</b> · ${w.sev} <span class="muted">（${w.kind}）</span></li>`).join('')}</ul>
 ${wb.length > 6 ? `<div class="muted" style="margin-bottom:8px">…… 其余 ${wb.length - 6} 处</div>` : ''}
 <button class="btn btn-p" onclick="composeWrong()">错题回练（${wbN} 句）</button>
 <button class="btn btn-g" style="margin-left:8px" onclick="clearWrong()">清空错题本</button>
 </div>` : ''}
 ${store.get('paper', null) ? `<div class="card"><h3>⏸ 有未完成的标注卷</h3>
 <button class="btn btn-o" onclick="resumePaper()">继续上次标注</button>
 <button class="btn btn-r" style="margin-left:8px" onclick="store.del('paper');renderSetup();toast('已放弃上次标注卷')">放弃</button></div>` : ''}
 </div>
 <div id="toast"></div>`;
 /* 由结果页"错题回练"直达：?wrong=1 自动开局 */
 if (P.get('wrong') && wbN) setTimeout(composeWrong, 300);
}

function compose() {
 const ed = $('#f-ed').value, stage = $('#f-stage').value, dir = $('#f-dir').value,
 dim = $('#f-dim').value, mtOnly = $('#f-mt').value, n = parseInt($('#f-n').value, 10);
 const seededK = new Set(SEEDS.map(s => s.k));
 let pool = CORPUS_PAIRS.filter(p => (!ed || p.ed === ed) && (!stage || p.stage === stage)
 && (!dir || p.dir === dir) && (!mtOnly || p.mt)
 && (!dim || (p.tags || []).includes(dim)));
 const seeded = pool.filter(p => seededK.has(p.k));
 const blind = pool.filter(p => !seededK.has(p.k));
 const takeSeeded = Math.min(seeded.length, n);
 const paper = seeded.slice(0, takeSeeded).concat(blind.slice(0, n - takeSeeded));
 if (!paper.length) { $('#compose-out').textContent = '筛选条件下没有可用句对，请放宽条件。'; return; }
 startPaper(paper, seededK);
 $('#compose-out').innerHTML = ` 已组卷 <b>${paper.length}</b> 条：种子对照 ${takeSeeded} 条 + 盲标 ${paper.length - takeSeeded} 条。`
 + (dim ? `<br>已按错误类型「${esc(dim)}」筛选（该条件共 ${pool.length} 句，其中含机翻底稿 ${pool.filter(p => p.mt).length} 句）。` : '');
 setTimeout(startWork, 600);
}
function startPaper(paper, seededK) {
 A = { paper, idx: 0, anns: {}, reviews: store.get('llm_reviews', {}) || {}, seededK, startedAt: Date.now(), wrongMode: false };
 store.set('paper', { keys: paper.map(p => p.k), idx: 0, anns: A.anns, startedAt: A.startedAt });
}
/* 错题回练：只重做错题本里出现过的句子 */
function composeWrong() {
 const keys = wrongKeys();
 const map = Object.fromEntries(CORPUS_PAIRS.map(x => [x.k, x]));
 const paper = keys.map(k => map[k]).filter(Boolean);
 if (!paper.length) { toast('错题本为空'); return; }
 startPaper(paper, new Set(SEEDS.map(s => s.k)));
 A.wrongMode = true;
 const out = $('#compose-out'); if (out) out.innerHTML = ` 错题回练已组卷 <b>${paper.length}</b> 句。`;
 setTimeout(startWork, 400);
}
function resumePaper() {
 const p = store.get('paper', null);
 if (!p) return;
 const map = Object.fromEntries(CORPUS_PAIRS.map(x => [x.k, x]));
 const paper = p.keys.map(k => map[k]).filter(Boolean);
 A = { paper, idx: p.idx || 0, anns: p.anns || {}, reviews: store.get('llm_reviews', {}) || {}, seededK: new Set(SEEDS.map(s => s.k)), startedAt: p.startedAt || Date.now() };
 renderWork();
}

/* ---------------- 标注工作区 ---------------- */
function startWork() { renderWork(); }

function renderWork() {
 V = 'work';
 const p = A.paper[A.idx];
 const k = p.k;
 const anns = A.anns[k] || [];
 const seeded = A.seededK.has(k);
 app.innerHTML = `
 <div class="top">
 <div class="brand"><span class="logo">标</span>MTPE 标注实训 <span class="en">作答中</span></div>
 <div class="muted">第 ${A.idx + 1}/${A.paper.length} 条 ｜ <a href="annotate.html" style="text-decoration:none" onclick="saveSession()">退出</a></div>
 </div>
 <div class="wrap">
 <div class="card">
 <div class="meta">
 ${A.wrongMode ? '<span class="tag teal">错题回练卷</span>' : ''}
 <span class="tag teal">${esc(p.dir)}</span><span class="tag gray">第${esc(p.ed)}届 · ${esc(p.stage)}</span>
 <span>引擎：${esc(p.eng) || '（未公布）'}</span>
 <span>${seeded ? ' 种子对照卷（交卷评分）' : ' 盲标卷（不计分）'}</span>
 <span>编号 ${esc(p.k)}</span>
 </div>
 ${(FLAGS || []).filter(f => f.ed == p.ed && f.stage === p.stage && f.dir === p.dir).map(f => `<div class="hint" style="color:var(--a);background:var(--ab);border-radius:7px;padding:5px 10px;margin-bottom:8px"> 预标注提示（线索，须自行确认）：${esc(f.check)} —— ${esc(f.desc)}</div>`).join('')}
 ${prePanelHTML(k)}
 <div class="src-box"><div class="lab">原文</div>${esc(p.src)}</div>
 <div class="lab">机翻译文（选中错误片段后打标；无错误可选 M0）</div>
 ${p.mt ? `<div class="mt-box" id="mtbox">${renderMT(p.mt, anns)}</div>
 <div class="hint"> 鼠标划选片段后松开，在弹出的面板中选择标签与严重度；点击已标注的高亮可编辑或删除。</div>
 <div class="ann-list" id="ann-list">
 ${anns.map((a, i) => `<div class="ann-item">
 <span>「${esc(a.text.slice(0, 30))}${a.text.length > 30 ? '…' : ''}」 <b>${TAG_LABEL[a.tag]}</b> · ${a.sev}${a.fix ? ' · 改：' + esc(a.fix.slice(0, 20)) : ''}</span>
 <button class="del" onclick="delAnn(${i})">删除</button>
 </div>`).join('')}
 </div>`
 : `<div class="mt-box empty-mt">（本条无官方机翻底稿——早期届次未公布逐句机翻，此句已自动跳过计分）</div>`}
 </div>
 <div class="nav-row">
 <button class="btn btn-g" onclick="navPair(-1)" ${A.idx === 0 ? 'disabled' : ''}> 上一条</button>
 <button class="btn btn-g" onclick="navPair(1)" ${A.idx === A.paper.length - 1 ? 'disabled' : ''}>下一条 </button>
 <button class="btn btn-p" onclick="confirmSubmit()">完成并交卷评分</button>
 </div>
 </div>
 <div class="sel-panel hidden" id="sel-panel"></div>
 <div id="toast"></div>`;
 if (p.mt) bindSelection();
}

/* ---------------- LLM 预标注校对（学生端） ---------------- */
function preList() { return PRE_MAP[A.paper[A.idx].k] || []; }
function ensureRev() { const k = A.paper[A.idx].k; A.reviews = A.reviews || {}; A.reviews[k] = A.reviews[k] || []; return A.reviews[k]; }
function prePanelHTML(k) {
 const list = PRE_MAP[k] || [];
 if (!list.length) return '';
 return list.map(function (pre, i) {
 return '<div class="hint" style="background:#fff7e8;border:1px solid #f0d9a8;border-radius:7px;padding:8px 10px;margin-bottom:8px">'
 + ' <b>LLM 预标注（待校对，非标准答案）</b>：片段「' + esc(pre.span) + '」 <b>'
 + (TAG_LABEL[pre.tag] || pre.tag) + '</b> · ' + pre.sev
 + (pre.fix ? ' · 建议改法：' + esc(pre.fix) : '')
 + (pre.note ? '<div class="muted" style="font-size:12px">理由：' + esc(pre.note) + '</div>' : '')
 + '<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">'
 + '<button class="btn btn-p" onclick="preAccept(' + i + ')"> 采纳</button>'
 + '<button class="btn btn-g" onclick="preModify(' + i + ')"> 修改后采纳</button>'
 + '<select id="pre-reason-' + i + '" style="padding:4px 6px;border-radius:6px;border:1px solid var(--line)">'
 + '<option value="">驳回理由…</option><option>误标（机翻没错）</option><option>漏标（还有其他错误）</option>'
 + '<option>严重度不当</option><option>片段偏移</option></select>'
 + '<button class="btn btn-r" onclick="preReject(' + i + ')"> 驳回</button>'
 + '</div></div>';
 }).join('');
}
function findSpan(mt, span) {
 let i = mt.indexOf(span);
 if (i >= 0) return [i, i + span.length];
 let pos = -1, ci = 0;
 for (let j = 0; j < mt.length; j++) {
 if (mt[j] === span[ci]) { if (ci === 0) pos = j; ci++; if (ci === span.length) return [pos, j + 1]; }
 else if (ci > 0) { ci = 0; j--; }
 }
 return null;
}
function addPreAnn(i, override) {
 const p = A.paper[A.idx], pre = preList()[i];
 const loc = findSpan(p.mt || '', pre.span);
 if (!loc) { toast('该片段未在机翻文本中定位，请手动划选打标'); return; }
 const k = p.k; A.anns[k] = A.anns[k] || [];
 A.anns[k].push({ start: loc[0], end: loc[1], text: pre.span,
 tag: (override && override.tag) || pre.tag, sev: (override && override.sev) || pre.sev,
 fix: pre.fix || '', from: 'llm' + (override ? '（学生修改）' : '（学生采纳）') });
 ensureRev().push({ span: pre.span, pre_tag: pre.tag, pre_sev: pre.sev, verdict: override ? '修改后采纳' : '采纳', reason: '' });
 saveSession(); renderWork(); toast(override ? '已按你的修改记入标注' : '已采纳并记入标注');
}
function preAccept(i) { addPreAnn(i, null); }
function preModify(i) {
 const pre = preList()[i];
 const tag = prompt('标签（M1-M9 / M0）：', pre.tag) || pre.tag;
 const sev = prompt('严重度（Critical / Major / Minor）：', pre.sev) || pre.sev;
 addPreAnn(i, { tag: tag, sev: sev });
}
function preReject(i) {
 const pre = preList()[i];
 const sel = document.getElementById('pre-reason-' + i);
 const reason = (sel && sel.value) || '';
 if (!reason) { toast('请先选择驳回理由'); return; }
 ensureRev().push({ span: pre.span, pre_tag: pre.tag, pre_sev: pre.sev, verdict: '驳回', reason: reason });
 saveSession(); renderWork(); toast('已记录驳回 进入教师仲裁队列');
}

function renderMT(mt, anns) {
 if (!anns.length) return esc(mt);
 const sorted = anns.map((a, i) => ({ ...a, i })).sort((a, b) => a.start - b.start);
 let html = '', pos = 0;
 for (const a of sorted) {
 if (a.start < pos) continue;
 html += esc(mt.slice(pos, a.start));
 html += `<mark class="mine" data-i="${a.i}" data-sev="${a.sev}" title="${TAG_LABEL[a.tag]} · ${a.sev}">${esc(mt.slice(a.start, a.end))}</mark>`;
 pos = a.end;
 }
 html += esc(mt.slice(pos));
 return html;
}

function bindSelection() {
 const box = $('#mtbox');
 box.addEventListener('mouseup', () => {
 const sel = window.getSelection();
 if (!sel || sel.isCollapsed) return;
 const { start, end, text } = offsetWithin(box, sel);
 if (start === null || end - start < 1) return;
 openPanel({ start, end, text });
 });
 box.addEventListener('click', (e) => {
 const mark = e.target.closest('mark.mine');
 if (mark) editAnn(parseInt(mark.dataset.i, 10));
 });
}
function offsetWithin(container, sel) {
 const rng = sel.getRangeAt(0);
 if (!container.contains(rng.commonAncestorContainer)) return { start: null };
 let start = null, end = null, pos = 0;
 const walk = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
 let node;
 while ((node = walk.nextNode()) !== null) {
 const len = node.textContent.length;
 if (node === rng.startContainer) start = pos + rng.startOffset;
 if (node === rng.endContainer) { end = pos + rng.endOffset; break; }
 pos += len;
 }
 if (start === null || end === null) return { start: null };
 const text = container.textContent.slice(start, end);
 return { start, end, text };
}

/* ---- 标注面板 ---- */
let pending = null, editing = null;
function openPanel(sel, editIdx) {
 pending = sel; editing = (editIdx === undefined || editIdx === null) ? null : editIdx;
 const anns = A.anns[A.paper[A.idx].k] || [];
 const cur = editing !== null ? anns[editing] : null;
 const panel = $('#sel-panel');
 panel.classList.remove('hidden');
 panel.innerHTML = `
 <div class="stext">已选片段：「${esc((cur ? cur.text : sel.text) || '')}」</div>
 <div class="tag-chips" id="tag-chips">
 ${SCHEME.map(([id, label]) => `<span class="t-chip${cur && cur.tag === id ? ' on' : ''}" data-tag="${id}">${id} ${label}</span>`).join('')}
 </div>
 <div class="sev-row">
 <span style="font-size:12.5px;color:var(--tx2)">严重度：</span>
 ${['Critical', 'Major', 'Minor'].map(s => `<span class="sev-opt${cur && cur.sev === s ? ' on' : ''}" data-sev="${s}">${s}</span>`).join('')}
 <input class="fix-input" id="fix-input" placeholder="建议改法（选填）" value="${cur ? esc(cur.fix || '') : ''}">
 </div>
 <div style="display:flex;gap:8px;justify-content:flex-end">
 ${editing !== null ? '<button class="btn btn-r" onclick="delAnn(' + editing + ')">删除此标注</button>' : '<button class="btn btn-g" onclick="closePanel()">取消</button>'}
 <button class="btn btn-p" onclick="saveAnn()">保存标注</button>
 </div>`;
 panel.querySelectorAll('.t-chip').forEach(c => c.onclick = () => {
 panel.querySelectorAll('.t-chip').forEach(x => x.classList.remove('on'));
 c.classList.add('on');
 });
 panel.querySelectorAll('.sev-opt').forEach(s => s.onclick = () => {
 panel.querySelectorAll('.sev-opt').forEach(x => x.classList.remove('on'));
 s.classList.add('on');
 });
}
function closePanel() { $('#sel-panel').classList.add('hidden'); pending = null; editing = null; }
function saveAnn() {
 const tag = document.querySelector('#tag-chips .t-chip.on');
 const sev = document.querySelector('.sev-opt.on');
 if (!tag) { toast('请选择错误类别'); return; }
 if (!sev) { toast('请选择严重度'); return; }
 const k = A.paper[A.idx].k;
 A.anns[k] = A.anns[k] || [];
 const rec = { start: pending.start, end: pending.end, text: pending.text, tag: tag.dataset.tag, sev: sev.dataset.sev, fix: $('#fix-input').value.trim() };
 if (editing !== null) A.anns[k][editing] = rec; else A.anns[k].push(rec);
 saveSession(); closePanel(); renderWork(); toast('标注已保存');
}
function delAnn(i) {
 const k = A.paper[A.idx].k;
 A.anns[k].splice(i, 1);
 saveSession(); closePanel(); renderWork(); toast('已删除');
}
function saveSession() {
 if (!A) return;
 store.set('paper', { keys: A.paper.map(p => p.k), idx: A.idx, anns: A.anns, startedAt: A.startedAt });
 if (A.reviews) store.set('llm_reviews', A.reviews);
}
function navPair(d) { saveSession(); A.idx = Math.max(0, Math.min(A.paper.length - 1, A.idx + d)); saveSession(); renderWork(); }

/* ---------------- 交卷与评分 ---------------- */
function confirmSubmit() {
 const tagged = Object.values(A.anns).reduce((s, a) => s + a.length, 0);
 openModal(`<h3>完成并交卷？</h3>
 <div class="info-box">共标注 ${tagged} 处。交卷后与种子标注对比：种子未覆盖的句对为盲标，不计分。</div>
 <div class="m-actions"><button class="btn btn-g" onclick="closeModal()">返回检查</button>
 <button class="btn btn-p" onclick="closeModal();submitAnn()">交卷评分</button></div>`);
}
function submitAnn() {
 saveSession();
 const seededK = A.seededK;
 let TP = 0, FP = 0, FN = 0, tagWrong = 0, sevWrong = 0;
 const perPair = [];
 const wrongNew = [];
 A.paper.forEach(p => {
 const my = A.anns[p.k] || [];
 const seeds = SEEDS.filter(s => s.k === p.k);
 const pairInfo = { p, my, seeds, scored: seeds.length > 0 };
 if (seeds.length) {
 const used = new Set();
 seeds.forEach(s => {
 let best = null, bestSim = 0;
 my.forEach((a, i) => { if (used.has(i)) return; const sim = simT(a.text, s.span); if (sim >= 0.6 && sim > bestSim) { best = { a, i }; bestSim = sim; } });
 if (best) {
 used.add(best.i);
 if (best.a.tag === s.tag) {
 TP++;
 if (best.a.sev !== s.sev) { sevWrong++; wrongNew.push({ k: p.k, span: s.span, tag: s.tag, sev: s.sev, kind: '严重度判偏', mine: best.a.sev }); }
 } else { tagWrong++; wrongNew.push({ k: p.k, span: s.span, tag: s.tag, sev: s.sev, kind: '标签判错', mine: best.a.tag }); }
 } else { FN++; wrongNew.push({ k: p.k, span: s.span, tag: s.tag, sev: s.sev, kind: '漏检', mine: '' }); }
 });
 FP += my.filter((a, i) => !used.has(i)).length;
 }
 perPair.push(pairInfo);
 });
 /* 错题本（优化B）：漏检 / 标签判错 / 严重度判偏 自动入本，去重后供"错题回练" */
 const oldWB = wrongbook();
 const seen = new Set(oldWB.map(w => w.k + '|' + w.span + '|' + w.tag + '|' + w.kind));
 const stamp = new Date().toLocaleString('zh-CN', { hour12: false });
 const wrongAdded = wrongNew.filter(w => !seen.has(w.k + '|' + w.span + '|' + w.tag + '|' + w.kind))
 .map(w => ({ ...w, date: stamp }));
 if (wrongAdded.length) saveWrongbook(wrongAdded.concat(oldWB));
 const wrongTotal = wrongKeys().length;
 const precision = (TP + FP) ? Math.round(TP / (TP + FP) * 1000) / 10 : 0;
 const recall = (TP + FN) ? Math.round(TP / (TP + FN) * 1000) / 10 : 0;
 const f1 = (precision + recall) ? Math.round(2 * precision * recall / (precision + recall) * 10) / 10 : 0;

 /* MQM-B 质量分：100 − Σ(错误数×严重度权重)/千词（权重 Critical-25 / Major-5 / Minor-1，M0 计 0） */
 const W = { Critical: 25, Major: 5, Minor: 1 };
 const quality = (anns, mt) => {
 if (!mt) return null;
 const words = tokenize(mt).length;
 if (!words) return null;
 const w = anns.reduce((s, a) => s + (a.tag === 'M0' ? 0 : (W[a.sev] || 1)), 0);
 return Math.max(0, Math.round((100 - w * 1000 / words) * 10) / 10);
 };
 const sQ = [], tQ = [];
 A.paper.forEach(p => {
 if (!p.mt) return;
 const mine = quality(A.anns[p.k] || [], p.mt);
 if (mine !== null) tQ.push(mine);
 const seeds = SEEDS.filter(s => s.k === p.k);
 if (seeds.length) { const sq = quality(seeds.map(s => ({ tag: s.tag, sev: s.sev })), p.mt); if (sq !== null) sQ.push(sq); }
 });
 const avg = (a) => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length * 10) / 10 : null;
 const studentQ = avg(tQ), seedQ = avg(sQ);

 const result = { date: new Date().toLocaleString('zh-CN', { hour12: false }), TP, FP, FN, tagWrong, sevWrong, precision, recall, f1, studentQ, seedQ, perPair, pairsN: A.paper.length, tagged: Object.values(A.anns).reduce((s, a) => s + a.length, 0), wrongAdded: wrongAdded.length, wrongTotal };
 const rs = store.get('results', []); rs.unshift(result); store.set('results', rs.slice(0, 50));
 /* 同步到主平台「我的统计」 */
 try {
 const st = JSON.parse(localStorage.getItem('mtpe_ann_stats') || '[]');
 st.unshift({ date: result.date, precision, recall, f1, TP, FP, FN, tagWrong, sevWrong, studentQ, seedQ, pairsN: result.pairsN, tagged: result.tagged });
 localStorage.setItem('mtpe_ann_stats', JSON.stringify(st.slice(0, 50)));
 } catch (e) {}
 store.del('paper');
 renderResult(result);
}

/* ---------------- 结果页 ---------------- */
function renderResult(r) {
 V = 'result';
 app.innerHTML = `
 <div class="top">
 <div class="brand"><span class="logo">标</span>MTPE 标注实训 <span class="en">评分结果</span></div>
 <a class="muted" href="annotate.html" style="text-decoration:none"> 返回组卷</a>
 </div>
 <div class="wrap">
 <h1>评分结果 · 与种子标注对比</h1>
 <div class="page-s">计分范围：${r.perPair.filter(x => x.scored).length} 条种子对照卷（盲标条目不计分）；标签集 M1-M9/M0。</div>
 <div class="score-hero">
 <div class="stat-box"><div class="v">${r.precision}%</div><div class="l">查准率 Precision（标得对不对）</div></div>
 <div class="stat-box"><div class="v g">${r.recall}%</div><div class="l">查全率 Recall（漏了多少）</div></div>
 <div class="stat-box"><div class="v">${r.f1}%</div><div class="l">F1 综合分</div></div>
 <div class="stat-box"><div class="v a">${r.tagWrong}</div><div class="l">片段命中但标签错</div></div>
 <div class="stat-box"><div class="v a">${r.sevWrong}</div><div class="l">严重度判偏</div></div>
 <div class="stat-box"><div class="v r">${r.FN}</div><div class="l">种子漏检（FN）</div></div>
 <div class="stat-box"><div class="v r">${r.FP}</div><div class="l">多余标注（FP）</div></div>
 </div>
 ${r.studentQ !== null ? `
 <div class="card">
 <h3> MQM-B 机翻质量分（权重：Critical −25 / Major −5 / Minor −1，每千词）</h3>
 <div class="score-hero" style="margin-bottom:4px">
 <div class="stat-box"><div class="v">${r.studentQ}</div><div class="l">你的质量评分（按你的标注计算）</div></div>
 <div class="stat-box"><div class="v g">${r.seedQ ?? '—'}</div><div class="l">种子质量评分（按种子标注计算）</div></div>
 <div class="stat-box"><div class="v ${r.seedQ !== null && Math.abs(r.studentQ - r.seedQ) > 10 ? 'r' : 'g'}">${r.seedQ !== null ? (r.studentQ - r.seedQ > 0 ? '+' : '') + Math.round((r.studentQ - r.seedQ) * 10) / 10 : '—'}</div><div class="l">偏差（你 − 种子）</div></div>
 </div>
 <div class="muted">偏差为正：你判定的机翻问题比种子少（可能漏检或严重度偏轻）；偏差为负：你判定的问题更多（可能过度标注或严重度偏重）。</div>
 </div>` : ''}
 <div class="legend">
 <span><i style="background:#c9f0dc;border-bottom:2px solid var(--g)"></i>命中种子</span>
 <span><i style="background:#ffe2e2;border-bottom:2px dashed var(--r)"></i>漏检的种子错误</span>
 <span><i style="background:#d6e6ff;border-bottom:2px solid var(--b)"></i>你的标注</span>
 </div>
 ${(r.wrongAdded || r.wrongTotal) ? `<div class="card" style="border-color:#f0d9a8;background:#fffdf7">
 <h3> 错题本已更新</h3>
 <div class="page-s" style="margin-bottom:8px">本次新增 <b>${r.wrongAdded || 0}</b> 处，错题本共 <b>${r.wrongTotal || 0}</b> 句待回练——含漏检、标签判错与严重度判偏。回练只重做这些句子，形成"暴露 → 回练 → 复测"的闭环。</div>
 <button class="btn btn-p" onclick="renderSetup()">去错题回练</button>
 </div>` : ''}
 ${r.perPair.map(x => `
 <div class="card">
 <div class="meta">
 <span class="tag teal">${esc(x.p.dir)}</span><span class="tag gray">${esc(x.p.k)}</span>
 ${x.scored ? '<span> 计分</span>' : '<span> 盲标不计分</span>'}
 </div>
 <div class="src-box"><div class="lab">原文</div>${esc(x.p.src)}</div>
 <div class="mt-box">${renderReview(x)}</div>
 ${x.scored && x.seeds.length ? x.seeds.map(s => `<div class="muted"> 种子：「${esc(s.span.slice(0, 40))}」 ${TAG_LABEL[s.tag] || s.tag} · ${s.sev}${s.note ? ' ｜ ' + esc(s.note.slice(0, 60)) : ''}</div>`).join('') : ''}
 </div>`).join('')}
 <div style="display:flex;gap:10px">
 <button class="btn btn-p" onclick="renderSetup()">再组一卷</button>
 <button class="btn btn-o" onclick="exportAnnJSON()"> 导出标注 JSON（pair_annotations 格式）</button>
 <a class="btn btn-o" href="index.html" style="text-decoration:none">返回首页</a>
 </div>
 </div>
 <div id="toast"></div>`;
}
/* ---- 导出标注 JSON（字段与 pair_annotations.csv 对齐，可并回 mtpe.db） ---- */
function exportAnnJSON() {
 const rs = store.get('results', []);
 const r = rs[0];
 if (!r) { toast('没有可导出的标注'); return; }
 const payload = {
 meta: { exported: new Date().toLocaleString('zh-CN', { hour12: false }), scheme: 'M1-M9/M0', scoring: 'MQM-B (Critical-25/Major-5/Minor-1 每千词)', pairs: r.pairsN },
 scores: { precision: r.precision, recall: r.recall, f1: r.f1, TP: r.TP, FP: r.FP, FN: r.FN, tagWrong: r.tagWrong, sevWrong: r.sevWrong, studentQuality: r.studentQ, seedQuality: r.seedQ },
 llm_reviews: store.get('llm_reviews', {}) || {},
 annotations: []
 };
 r.perPair.forEach(x => (x.my || []).forEach(a => payload.annotations.push({
 pair_key: x.p.k, '片段': a.text, '标签': a.tag, '严重度': a.sev, '建议改法': a.fix || '', '备注': ''
 })));
 download('MTPE标注导出_' + Date.now() + '.json', JSON.stringify(payload, null, 2));
}
function download(name, content) {
 const a = document.createElement('a');
 a.href = URL.createObjectURL(new Blob([content], { type: 'application/json;charset=utf-8' }));
 a.download = name; a.click();
 setTimeout(() => URL.revokeObjectURL(a.href), 3000);
 toast('已导出：' + name);
}
function renderReview(x) {
 if (!x.p.mt) return '<span class="empty-mt">（无机翻底稿）</span>';
 // 种子 spans：绿色（命中学生标注）或红色虚线（漏检）
 let html = esc(x.p.mt);
 const seeds = x.seeds.map(s => {
 const idx = x.p.mt.indexOf(s.span);
 const hit = x.my.some(a => a.tag === s.tag && simT(a.text, s.span) >= 0.6);
 return { span: s.span, idx, hit };
 }).filter(s => s.idx >= 0).sort((a, b) => a.idx - b.idx);
 let pos = 0, out = '';
 for (const s of seeds) {
 if (s.idx < pos) continue;
 out += esc(x.p.mt.slice(pos, s.idx));
 out += `<mark class="${s.hit ? 'hit' : 'miss'}">${esc(s.span)}</mark>`;
 pos = s.idx + s.span.length;
 }
 out += esc(x.p.mt.slice(pos));
 html = out;
 // 学生标注：蓝色底（在种子渲染之上不再叠加，MVP 用列表呈现）
 if (x.my.length) html += `<div class="ann-list">${x.my.map(a => `<div class="ann-item"><span>「${esc(a.text.slice(0, 34))}${a.text.length > 34 ? '…' : ''}」 <b>${TAG_LABEL[a.tag] || a.tag}</b> · ${a.sev}</span></div>`).join('')}</div>`;
 return html;
}

/* ---------------- 弹窗 ---------------- */
function openModal(h) {
 let m = $('#modal-mask');
 if (!m) {
 m = document.createElement('div');
 m.id = 'modal-mask'; m.className = 'mask';
 m.innerHTML = '<div class="modal" id="modal-box"></div>';
 document.body.appendChild(m);
 }
 $('#modal-box').innerHTML = h;
 m.classList.remove('hidden');
}
function closeModal() { const m = $('#modal-mask'); if (m) m.classList.add('hidden'); }

const app = $('#app');
renderSetup();

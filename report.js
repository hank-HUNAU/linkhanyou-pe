/* ============================================================
 * report.js — 成绩结果页与报告导出（② 改 交卷后 与「我的统计」的「查看」共用一份）
 *
 * 为什么抽出来：同一个结果页原来只长在 app.js 里，而「我的统计」独立成 stats.html 后也需要它。
 *
 * 注意：本文件**不用 IIFE 包起来**——`renderResult` 要以全局函数的形式暴露给页面脚本直接调用
 * （app.js 里就是 `renderResult(record)` 这么调的）。因此内部辅助函数一律加 `rp` 前缀，
 * 避免与 app.js 里的 esc / fmtTime / tokenize / history / toast 撞名（同名 const 会直接报语法错）。
 * ============================================================ */
const rpEsc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const rpFmtTime = (sec) => {
  const m = Math.floor(sec / 60), s = sec % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
};
/* 历史记录按当前昵称过滤（机房串号修复 2026-10-17）：
   共享账号的公共机房里，记录带保存时的昵称戳，只回给"本人"。
   当前昵称取不到（测试桩/异常环境）时不过滤，保持旧行为。 */
const rpNick = () => {
  try { return JSON.parse(localStorage.getItem('mtpe_nickname') || '""') || ''; } catch (e) { return ''; }
};
const rpHistory = () => {
  try {
    const all = JSON.parse(localStorage.getItem('mtpe_history') || '[]') || [];
    const n = rpNick();
    return n ? all.filter((h) => h && h.nickname === n) : all;
  } catch (e) { return []; }
};
const rpIsExam = (h) => !!h && (h.mode === 'exam' || h.profile !== undefined);
const rpTokenize = (s) => (s.match(/[\u4e00-\u9fff]|[A-Za-z]+(?:'[a-z]+)?|\d+(?:\.\d+)?%?|[^\s]/g) || []);
function rpDiffOps(a, b) {
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops = []; let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { ops.push({ op: 'same', t: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ op: 'del', t: a[i] }); i++; }
    else { ops.push({ op: 'ins', t: b[j] }); j++; }
  }
  while (i < n) ops.push({ op: 'del', t: a[i++] });
  while (j < m) ops.push({ op: 'ins', t: b[j++] });
  return ops;
}
/* 合并式修订痕迹渲染：del=红色删除线（机翻原文被删），ins=绿色（用户新增） */
function rpDiffHTML(mt, pe) {
  return rpDiffOps(rpTokenize(mt), rpTokenize(pe)).map((o) => {
    if (o.op === 'same') return rpEsc(o.t);
    if (o.op === 'del') return '<del>' + rpEsc(o.t) + '</del>';
    return '<ins>' + rpEsc(o.t) + '</ins>';
  }).join(' ').replace(/ <(del|ins)>/g, ' <$1>').replace(/<(del|ins)> /g, '<$1> ');
}
function rpToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(t._m); t._m = setTimeout(() => t.classList.add('hidden'), 2400);
}
function mtpeDownload(name, content, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: type + ';charset=utf-8' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  rpToast('已导出：' + name);
}

/* 结果页。backHtml 由加载它的页面决定：改端回广场，统计页回统计。 */
function renderResult(r, backHtml) {
  if (typeof setAnswering === 'function') setAnswering(false);
  const app = document.getElementById('app');
  app.innerHTML = `
 <div class="page-title">
  <h2> ${rpIsExam(r) ? '仿真训练成绩' : r.mode === 'competition' ? '限时练习成绩' : r.mode === 'demo' ? '演示结果' : '练习结果'} · ${rpEsc(r.taskName)}</h2>
 <div style="display:flex;gap:8px">
 <button class="btn btn-outline" onclick="exportReport('${r.id}')"> 导出成绩报告</button>
 ${backHtml || '<button class="btn btn-primary" onclick="go(\'plaza\')">返回译后编辑实训</button>'}
 </div>
 </div>
 <div class="score-hero">
 <div class="stat-box"><div class="v">${r.score}</div><div class="l">综合得分（vs 参考译文）</div></div>
 <div class="stat-box"><div class="v amber">${r.ter}%</div><div class="l">平均机翻修订率</div></div>
 <div class="stat-box"><div class="v">${r.segDone}/${r.total}</div><div class="l">完成段数</div></div>
 <div class="stat-box"><div class="v green">${rpFmtTime(r.timeUsed)}</div><div class="l">用时</div></div>
 <div class="stat-box"><div class="v">${r.words}</div><div class="l">任务字数</div></div>
 </div>
  <div class="score-note">得分基于与参考译文的<b>词级重合度</b>，仅供自己纵向对比；口径与局限见 <a href="#" onclick="mtpeHelp();return false">帮助</a>。</div>

 <h3 style="margin:6px 0 12px"> 逐段修订痕迹与点评</h3>
 ${(r.details || []).map(d => `
 <div class="review-block">
 <h4>第 ${d.i + 1} 段
 ${d.empty ? '<span class="mini-tag" style="background:var(--red-bg);color:var(--red)">未作答</span>' : ''}
 ${!d.empty && d.ter === 0 ? '<span class="mini-tag ok">保留机翻</span>' : ''}
 ${!d.empty && d.ter > 0 ? `<span class="mini-tag edited">修订率 ${(d.ter * 100).toFixed(1)}%</span>` : ''}
 <span class="muted" style="font-weight:400;font-size:12px">与参考译文相似度 ${d.sim}%</span>
 </h4>
 <div class="rv-grid">
 <div class="rv-cell"><div class="lab">原文 Source</div>${rpEsc(d.src)}</div>
 <div class="rv-cell"><div class="lab">我的译文（修订痕迹：红=删除机翻，绿=新增）</div><div class="diff">${d.empty ? '<span class="muted">（未作答）</span>' : rpDiffHTML(d.mt, d.pe)}</div></div>
 <div class="rv-cell"><div class="lab">机翻译文 MT</div>${rpEsc(d.mt)}</div>
 <div class="rv-cell"><div class="lab">参考译文 Reference</div>${rpEsc(d.ref)}</div>
 </div>
 ${(d.notes || []).length ? `<div style="margin-top:8px">${d.notes.map(n => `<div class="note-item"><b>${rpEsc(n.type)}</b>${rpEsc(n.text)}</div>`).join('')}</div>` : ''}
 </div>`).join('')}
 `;
  window.scrollTo(0, 0);
}

function exportReport(id) {
  const r = rpHistory().find((h) => h.id === id);
  if (!r) return;
  const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>MTPE 成绩报告 · ${rpEsc(r.taskName)}</title>
<style>body{font-family:"Microsoft YaHei",sans-serif;max-width:900px;margin:30px auto;padding:0 20px;color:#1f2430}
h1{font-size:22px}table{width:100%;border-collapse:collapse;margin:14px 0}
td,th{border:1px solid #ddd;padding:8px 10px;font-size:14px;text-align:left}
.blk{border:1px solid #e3e8f2;border-radius:10px;padding:14px;margin:12px 0}
del{background:#fdeced;color:#d70015}ins{background:#e6f4ea;color:#1c6e31;text-decoration:none}
.meta{color:#515154;font-size:13px}.score{font-size:34px;font-weight:800;color:#0071e3}</style></head><body>
<h1>译后编辑成绩报告</h1>
<p class="meta">选手：${rpEsc(r.nickname)} ｜ 任务：${rpEsc(r.taskName)}（${rpEsc(r.pair)} · ${rpEsc(r.domain)}）<br>
模式：${rpEsc(r.mode)} ｜ 时间：${rpEsc(r.date)} ｜ 用时：${rpFmtTime(r.timeUsed)}</p>
<p><span class="score">${r.score}</span> 综合得分　｜　平均修订率 ${r.ter}% ｜ 完成 ${r.segDone}/${r.total} 段</p>
${(r.details || []).map(d => `<div class="blk"><b>第 ${d.i + 1} 段</b>（修订率 ${(d.ter * 100).toFixed(1)}% · 相似度 ${d.sim}%）
<p>原文：${rpEsc(d.src)}</p><p>机翻：${rpEsc(d.mt)}</p>
<p>我的译文（修订痕迹）：<span style="text-decoration:none">${d.empty ? '（未作答）' : rpDiffHTML(d.mt, d.pe)}</span></p>
<p>参考：${rpEsc(d.ref)}</p>${(d.notes || []).map(n => `<p>【${rpEsc(n.type)}】${rpEsc(n.text)}</p>`).join('')}</div>`).join('')}
</body></html>`;
  mtpeDownload('MTPE成绩报告_' + String(r.taskName).slice(0, 12) + '.html', html, 'text/html');
}

/* 给 stats.js 用的公开口（那边用 window.xxx 显式调用，浏览器与桩环境行为一致） */
window.mtpeDownload = mtpeDownload;
window.mtpeFmtTime = rpFmtTime;
window.mtpeHistory = rpHistory;
window.mtpeIsExamRecord = rpIsExam;

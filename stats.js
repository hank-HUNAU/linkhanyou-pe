/* ============================================================
 * stats.js — 「我的统计」（stats.html 专用）
 *
 * 2026-10-12 从 app.js 里搬出来独立成页：它是三页的汇总（练习记录 + 标注能力 + 仿真画像），
 * 原来寄生在 practice.html#stats 里，URL 语义不对，也让 app.js 越滚越大。
 * 本页**不加载语料**（不需要分片解密），打开比三个流程页更快。
 * 口径：②改 的练习与 ③测 的仿真训练分开算——首页与这里共用同一套判断，数字必然一致。
 * ============================================================ */
(function () {
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const fmtTime = (sec) => window.mtpeFmtTime(sec);
  const history = () => window.mtpeHistory();
  const isExamRecord = (h) => window.mtpeIsExamRecord(h);
  const modeLabel = (h) => {
    if (isExamRecord(h)) return '仿真训练';
    return { competition: '限时练习', practice: '自由练习', demo: '教学演示' }[h.mode] || h.mode;
  };
  const store = {
    get(k, d) { try { const v = localStorage.getItem('mtpe_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('mtpe_' + k, JSON.stringify(v)); } catch (e) {} }
  };
  const getNick = () => store.get('nickname', '');
  const hasNick = () => !!store.get('nickname_set', 0);
  const now = () => new Date().toLocaleString('zh-CN', { hour12: false });
  function toast(msg) {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.style.opacity = '1';
    clearTimeout(t._m); t._m = setTimeout(() => { t.style.opacity = '0'; }, 2400);
  }

  /* 交作业前必须填姓名/学号：平台账号是课上共享的，班级汇总按姓名归档。
     本页自带一个极简输入弹窗（不依赖改页的 openModal）。 */
  function askNick(cb) {
    let m = document.getElementById('nick-ask');
    if (!m) {
      m = document.createElement('div');
      m.id = 'nick-ask'; m.className = 'mask';
      m.innerHTML = '<div class="modal"><h3>先填一下姓名／学号</h3>'
        + '<p class="page-s" style="margin:4px 0 10px">账号是课上统一发放的共享账号，不填姓名，老师的班级汇总会把全班并成两行。</p>'
        + '<input id="nick-ask-input" maxlength="20" placeholder="例如：2024级翻译2班 张三" style="width:100%;padding:9px 12px">'
        + '<div class="m-actions"><button class="btn btn-ghost" onclick="document.getElementById(\'nick-ask\').style.display=\'none\'">取消</button>'
        + '<button class="btn btn-primary" onclick="mtpeStatsSaveNick()">保存</button></div></div>';
      document.body.appendChild(m);
      window.mtpeStatsSaveNick = function () {
        const v = (document.getElementById('nick-ask-input').value || '').trim();
        if (!v) { toast('请填写姓名或学号后再保存'); return; }
        store.set('nickname', v); store.set('nickname_set', 1);
        m.style.display = 'none';
        if (typeof cb === 'function') cb();
      };
    }
    m.style.display = 'flex';
  }

  /* 表格视图状态：默认最近 10 条，可展开全部 / 按来源筛选 */
  let statsRows = 10, statsMode = 'all';
  window.statsShown = function (n) { statsRows = n; renderStats(); };
  window.statsFilter = function (m) { statsMode = m; statsRows = 10; renderStats(); };

  function renderStats() {
    const app = document.getElementById('app');
    const hs = history();
    let hasAnn = false;
    try { hasAnn = (JSON.parse(localStorage.getItem('mtpe_ann_stats') || '[]')).length > 0; } catch (e) {}
    if (!hs.length && !hasAnn) {
      app.innerHTML = `<div class="page-title"><h2>我的统计</h2></div>
 <div class="empty-tip">还没有作答记录，去<a href="practice.html">译后编辑练习</a>开始第一次练习，或去<a href="annotate.html">标注实训</a>完成一卷错误标注。</div>`;
      return;
    }
    /* 口径分离：②改 的练习（限时 + 自由）与 ③测 的仿真训练不是一个尺子，分开算 */
    const practice = hs.filter((h) => !isExamRecord(h));
    const exams = hs.filter(isExamRecord);
    const sum = (a, k) => a.reduce((s, h) => s + (Number(h[k]) || 0), 0);
    const avgOn = (a, k) => (a.length ? Math.round(sum(a, k) / a.length * 10) / 10 : '—');
    const usePractice = practice.length > 0;
    const trend = (usePractice ? practice : exams).slice(0, 6).reverse();
    const trendCaliber = (usePractice ? '② 改 · 最近 ' : '③ 测 · 最近 ') + trend.length
      + ' 次得分走势（' + (usePractice ? '词级重合度' : 'TER') + ' 口径）';
    const rows = hs.filter((h) => (statsMode === 'all' ? true : statsMode === 'exam' ? isExamRecord(h) : !isExamRecord(h)));
    const shown = rows.slice(0, statsRows);
    const fbtn = (k, t) => `<button class="btn ${statsMode === k ? 'btn-primary' : 'btn-ghost'}" style="padding:5px 12px" onclick="statsFilter('${k}')">${t}</button>`;

    app.innerHTML = `
 <div class="page-title">
 <h2>我的统计</h2>
 <button class="btn btn-primary" onclick="exportHomework()"> 导出作业 JSON（交给老师汇总）</button>
 <button class="btn btn-ghost" onclick="exportCSV()">导出明细 CSV</button>
 </div>
 <div class="score-hero">
 <div class="stat-box"><div class="v">${practice.length}</div><div class="l">「改」完成次数</div></div>
 <div class="stat-box"><div class="v">${sum(practice, 'words')}</div><div class="l">累计实训字数</div></div>
 <div class="stat-box"><div class="v green">${avgOn(practice, 'score')}</div><div class="l">「改」平均得分</div></div>
 <div class="stat-box"><div class="v amber">${avgOn(practice, 'ter')}${practice.length ? '%' : ''}</div><div class="l">「改」平均修订率</div></div>
 </div>
 <div class="board-note" style="margin-bottom:18px">以上仅统计 <b>② 改</b> 的练习（限时与自由），<b>不含 ③ 测 的仿真训练</b>——两者口径不同，不能混算、也不能横向比。仿真训练见下方画像，逐次明细在 <a href="pe-exam.html">③ 测</a>。</div>
 ${annStatsHTML()}
 ${examProfileHTML(hs)}
 <div class="board"><h3> ${trendCaliber}</h3>
 <div class="chart">
 ${trend.map(h => `
 <div class="bar-wrap">
 <span class="bar-v">${h.score}</span>
 <div class="bar" style="height:${Math.max(4, h.score)}%"></div>
 <span class="bar-l" title="${esc(h.taskName)}">${esc(String(h.taskName).slice(0, 6))}</span>
 </div>`).join('')}
 </div>
 <div class="board-note">一次只画一类：同一张图里的分数来自同一套口径，可以直接比高低。</div>
 </div>
 <div class="board"><h3> 作答记录（${rows.length} 条）</h3>
 <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">${fbtn('all', '全部')}${fbtn('practice', '② 改 · 练习')}${fbtn('exam', '③ 测 · 仿真训练')}</div>
 <div class="tbl-scroll">
 <table>
 <tr><th>时间</th><th>任务</th><th>模式</th><th>得分</th><th>修订率</th><th>完成</th><th>用时</th><th></th></tr>
 ${shown.map(h => `
 <tr>
 <td class="muted">${esc(h.date)}</td>
 <td>${esc(h.taskName)}</td>
 <td>${modeLabel(h)}</td>
 <td><b>${h.score}</b></td><td>${h.ter}%</td>
 <td>${h.segDone}/${h.total}</td><td>${fmtTime(h.timeUsed)}</td>
 <td><button class="btn btn-ghost" style="padding:4px 10px" onclick="viewRecord('${h.id}')">查看</button></td>
 </tr>`).join('')}
 </table>
 </div>
 ${rows.length > shown.length ? `<div style="margin-top:12px"><button class="btn btn-ghost" onclick="statsShown(${rows.length})">展开全部（共 ${rows.length} 条）</button></div>` : ''}
 </div>`;
  }
  window.renderStats = renderStats;

  /* 查看某条记录：复用共用的结果页，返回按钮指回本页 */
  window.viewRecord = function (id) {
    const r = history().find((h) => h.id === id);
    if (r) window.renderResult(r, '<button class="btn btn-primary" onclick="renderStats()">返回我的统计</button>');
  };

  function examProfileHTML(hs) {
    const recs = (hs || []).filter((h) => h && h.profile);
    if (!recs.length) {
      return `<div class="board"><h3>仿真训练结果画像</h3>
 <div class="empty-tip" style="padding:16px 0">暂无仿真训练记录。去 <a href="pe-exam.html">仿真训练</a> 交一次卷，这里会汇总你的编辑倾向（精准型 / 过度编辑型 / 保守型 / 鲁莽型）、编辑命中率与后半程稳定性。</div></div>`;
    }
    const avg = (k) => Math.round(recs.reduce((s, h) => s + (Number(h.profile[k]) || 0), 0) / recs.length * 10) / 10;
    const QUADS = ['精准型', '过度编辑型', '保守型', '鲁莽型'];
    const quadCount = {};
    recs.forEach((h) => { const q = h.profile.quadrant || '—'; quadCount[q] = (quadCount[q] || 0) + 1; });
    const mainQ = QUADS.slice().sort((a, b) => (quadCount[b] || 0) - (quadCount[a] || 0))[0];
    const quadTxt = QUADS.filter((q) => quadCount[q]).map((q) => `${q} ${quadCount[q]} 次`).join('　｜　') || '—';
    const stab = avg('stability');
    return `<div class="board"><h3> 仿真训练结果画像（共 ${recs.length} 次交卷）</h3>
  <div class="score-hero" style="margin-bottom:10px">
  <div class="stat-box"><div class="v">${avg('editRate')}%</div><div class="l">平均编辑率</div></div>
  <div class="stat-box"><div class="v green">${avg('effRate')}%</div><div class="l">平均有效编辑率</div></div>
  <div class="stat-box"><div class="v">${avg('speed')}</div><div class="l">平均速度（段/分）</div></div>
  <div class="stat-box"><div class="v ${stab < 0 ? 'amber' : 'green'}">${stab >= 0 ? '+' : ''}${stab}</div><div class="l">后半程平均变化</div></div>
  </div>
 <div class="board-note">编辑倾向分布：${quadTxt}　｜　最多的是「${mainQ}」，各次交卷的四项画像见 <a href="pe-exam.html">③ 测</a> 的结果页。</div>
 </div>`;
  }

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
 <div class="tbl-scroll">
 <table>
 <tr><th>时间</th><th>查准率</th><th>查全率</th><th>F1</th><th>标签/严重度偏差</th><th>漏检</th><th>多余</th></tr>
 ${st.slice(0, 10).map(x => `<tr>
 <td class="muted">${esc(x.date)}</td><td><b>${x.precision}%</b></td><td>${x.recall}%</td><td>${x.f1}%</td>
 <td>${(x.tagWrong || 0) + (x.sevWrong || 0)}</td><td>${x.FN || 0}</td><td>${x.FP || 0}</td>
 </tr>`).join('')}
 </table>
 </div>
 </div>`;
  }

  /* 导出作业 JSON：交给老师汇总（含账号、作答记录与画像、标注实训成绩、错题本） */
  window.exportHomework = function () {
    if (!hasNick()) { askNick(window.exportHomework); return; }
    const loginAccount = (window.mtpeAccount && window.mtpeAccount()) || '';
    const account = getNick();
    let ann = [], wrong = [];
    try { ann = JSON.parse(localStorage.getItem('mtpe_ann_stats') || '[]') || []; } catch (e) {}
    try { wrong = JSON.parse(localStorage.getItem('ann_wrongbook') || '[]') || []; } catch (e) {}
    const payload = {
      account: account, loginAccount: loginAccount, exported: now(),
      tasks: (history() || []).length, history: history() || [], annStats: ann, wrongbook: wrong
    };
    const name = 'MTPE作业_' + String(account).replace(/[^\w-]/g, '') + '_' + new Date().toISOString().slice(0, 10) + '.json';
    window.mtpeDownload(name, JSON.stringify(payload, null, 1), 'application/json');
    toast('已导出作业：' + name + '　请交给老师汇总');
  };

  window.exportCSV = function () {
    const rows = [['时间', '昵称', '任务', '语向', '领域', '模式', '得分', '修订率%', '完成段', '总段', '字数', '用时秒', '编辑率%', '有效编辑率%', '编辑倾向', '速度段每分', '后半程变化']];
    history().forEach((h) => rows.push([h.date, h.nickname, h.taskName, h.pair, h.domain, modeLabel(h), h.score, h.ter, h.segDone, h.total, h.words, h.timeUsed,
      h.profile ? h.profile.editRate : '', h.profile ? h.profile.effRate : '', h.profile ? h.profile.quadrant : '',
      h.profile ? h.profile.speed : '', h.profile ? h.profile.stability : '']));
    const csv = '\uFEFF' + rows.map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
    window.mtpeDownload('MTPE实训明细.csv', csv, 'text/csv');
  };

  renderStats();
})();

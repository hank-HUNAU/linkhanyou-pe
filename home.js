/* ============================================================
 * home.js — 一级首页
 * 职责只有两件事：① 告诉学生"找 / 改 / 考"三个入口各是做什么的；
 *                ② 回显"我的进度"，让人知道下一步该做什么。
 * 不加载语料（secure.js 之外的 corpus/annotate-data 都不需要），
 * 因此首页永远轻量、永远打得开——即使语料未解锁。
 * ============================================================ */
(function () {
  const app = document.getElementById('app');

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const get = (k, d) => {
    try { const v = localStorage.getItem('mtpe_' + k); return v === null ? d : JSON.parse(v); }
    catch (e) { return d; }
  };
  const num = (v) => (v == null || v === '' ? '—' : v);
  const pct = (v) => (v == null ? '—' : v + '%');

  /* 未完成的练习草稿（键名 mtpe_draft_<taskId>） */
  function drafts() {
    const out = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf('mtpe_draft_') === 0) out.push(k.slice('mtpe_draft_'.length));
      }
    } catch (e) {}
    return out;
  }

  /* 进度汇总：只读 localStorage（练习/考场记录 + 标注交卷摘要） */
  function summary() {
    const hs = get('history', []) || [];
    const ann = get('ann_stats', []) || [];
    const practice = hs.filter((h) => h.mode !== 'competition');
    const exams = hs.filter((h) => h.mode === 'competition');
    const avg = (arr, k) => arr.length
      ? Math.round(arr.reduce((s, x) => s + (x[k] || 0), 0) / arr.length * 10) / 10
      : null;
    return {
      practiceN: practice.length,
      practiceAvg: avg(practice, 'score'),
      lastPractice: practice[0] || null,
      annN: ann.length,
      annF1: avg(ann, 'f1'),
      examN: exams.length,
      examBest: exams.length ? Math.max.apply(null, exams.map((e) => e.score || 0)) : null,
      lastExam: exams[0] || null
    };
  }

  function installNote() {
    if (!window.mtpeIsStandalone) return '';
    if (window.mtpeIsStandalone()) return '已作为桌面应用运行：断网也能继续练，数据仍存在本机浏览器里。';
    if (window.mtpeCanInstall && window.mtpeCanInstall()) return '点「安装到桌面」可装成独立应用，断网也能用。';
    if (location.protocol === 'file:') return '当前是双击本地文件打开（file://）：功能照常，但安装到桌面与离线缓存不可用。想要这两项，用线上网址打开即可。';
    return '在 Chrome / Edge 里打开本页可安装到桌面（离线可用）；若没看到按钮，点浏览器地址栏右侧的「安装」图标即可。';
  }

  /* 最弱错误维度：取自"最近一次考场交卷"的画像（dims = 你的译文里各维度还剩多少处没改对）。
     只读既有数据，不新增采集；与考场结果页的推荐练习同一口径。 */
  const DIMS = ['准确性', '术语', '语言规范', '风格', '格式'];
  function weakestDim() {
    const exams = (get('history', []) || []).filter((h) => h.mode === 'competition' && h.profile && h.profile.dims);
    if (!exams.length) return null;
    const dims = exams[0].profile.dims;
    let best = null;
    DIMS.forEach((d) => {
      const n = Number(dims[d]) || 0;
      if (n > 0 && (!best || n > best.n)) best = { dim: d, n: n };
    });
    return best && best.n >= 3 ? best : null;   // 只剩零星一两处就不打扰
  }

  /* 只给一条"下一步"：学生进门先看到该做什么，而不是先看懂三个入口的区别。
     依据只有现有数据（草稿 / 标注 F1 / 练习次数 / 考场次数），不新增采集。 */
  function nextStep(s, dr) {
    if (dr.length) {
      return { href: 'practice.html', cta: '继续上次练习', why: '有 ' + dr.length + ' 份没做完的练习草稿，接着改比重新开一套划算。' };
    }
    if (!s.annN && !s.practiceN && !s.examN) {
      return { href: 'annotate.html', cta: '开始第一练 · 标注 10 句', why: '先练「找」：判断哪里该改是译后编辑的第一步，10 句约 10 分钟，交卷立即有查准率 / 查全率 / F1。' };
    }
    /* 有考场画像时优先给"针对最弱维度"的建议 —— 这是全站最有信息量的一条线索 */
    const wd = weakestDim();
    if (wd) {
      return {
        href: 'annotate.html?dim=' + encodeURIComponent(wd.dim) + '&n=15&go=1',
        cta: '加练「' + wd.dim + '」15 句',
        why: '上次考场里「' + wd.dim + '」还剩 ' + wd.n + ' 处没改对（五个维度中最多）。点进去已按该维度组好 15 句——这类句对多数没有种子标注，交卷不计分，练的是手感。'
      };
    }
    if (s.annN && s.annF1 != null && s.annF1 < 70) {
      return { href: 'annotate.html', cta: '加练「找」10 句', why: '「找」的平均 F1 是 ' + s.annF1 + '%——漏检或多余标注还偏多，这是当前最短的一块板。' };
    }
    if (!s.practiceN) {
      return { href: 'practice.html', cta: '开始练「改」', why: '还没做过整篇改写：在机翻底稿上动手改一遍，才知道"该改的地方"改到什么程度算够。' };
    }
    if (!s.examN) {
      return { href: 'pe-exam.html', cta: '去「考」估一次分', why: '还没交过卷。练习分不是考场口径，先摸清自己在考场口径下的位置。' };
    }
    return { href: 'pe-exam.html', cta: '再考一次', why: '考场最好成绩 ' + num(s.examBest) + ' 分。换一套没做过的卷子，检验这段时间的进步。' };
  }

  function render() {
    const s = summary();
    const dr = drafts();
    const nx = nextStep(s, dr);
    const lastBits = [];
    if (s.lastPractice) lastBits.push('上次练习《' + esc(s.lastPractice.taskName) + '》得分 ' + s.lastPractice.score);
    if (s.lastExam) lastBits.push('上次模拟参赛《' + esc(s.lastExam.taskName) + '》得分 ' + s.lastExam.score
      + (s.lastExam.profile && s.lastExam.profile.quadrant ? '（' + esc(s.lastExam.profile.quadrant) + '）' : ''));

    app.innerHTML = `
  <section class="home-hero">
    <h1>译后编辑实训平台</h1>
    <p>按「<b>找 → 改 → 考</b>」三步走练机器翻译译后编辑：先练<strong>发现哪里该改</strong>，再练<strong>动手改</strong>，最后进考场练<strong>临场状态</strong>。
    练「找」「改」是实训，<strong>「考」是唯一考场口径</strong>的模拟参赛。语料为历届大赛真题；登录一次，三个页面之间往返无需再登录。</p>
  </section>

  <div class="home-next">
    <div class="hn-tag">下一步</div>
    <div class="hn-body">
      <div class="hn-why">${esc(nx.why)}</div>
      <div class="hn-act"><a class="btn btn-primary" href="${nx.href}">${esc(nx.cta)}</a>
      <a class="btn btn-ghost" href="practice.html#stats">看我的统计</a></div>
    </div>
  </div>

  <div class="step-strip home-steps">
    <a class="step-card" href="annotate.html">
      <b>① 找 · 标注实训</b>
      <span>判断「哪里该改」：在机翻句对上划选错误片段并定性（M1–M9 / M0 + 严重度）。交卷后与官方种子标注比对，给出查准率 / 查全率 / F1，错题自动入本。</span>
      <em>练眼力：漏检和过度标注都算错</em>
    </a>
    <a class="step-card" href="practice.html">
      <b>② 改 · 译后编辑练习</b>
      <span>在机翻底稿上动手改：限时练习可选 8 / 15 / 30 分钟（离开页面计数），自由练习不限时、可存草稿；交卷看修订率、逐段对照与参考译文点评。</span>
      <em>练手法：练习分不是考场口径</em>
    </a>
    <a class="step-card" href="pe-exam.html">
      <b>③ 考 · 模拟参赛</b>
      <span>全真考场：整页独占、防作弊（切屏计数、禁复制粘贴、倒计时）、TER 分与结果画像，交卷后给出编辑倾向与推荐练习。</span>
      <em>练状态：赛前用它估分、找短板</em>
    </a>
  </div>

  <div class="board home-progress">
    <h3>我的进度</h3>
    <div class="score-hero">
      <div class="stat-box"><div class="v">${s.practiceN}</div><div class="l">「改」完成次数</div></div>
      <div class="stat-box"><div class="v green">${num(s.practiceAvg)}</div><div class="l">「改」平均得分</div></div>
      <div class="stat-box"><div class="v">${s.annN}</div><div class="l">「找」标注卷数</div></div>
      <div class="stat-box"><div class="v green">${pct(s.annF1)}</div><div class="l">「找」平均 F1</div></div>
      <div class="stat-box"><div class="v">${s.examN}</div><div class="l">「考」交卷次数</div></div>
      <div class="stat-box"><div class="v amber">${num(s.examBest)}</div><div class="l">「考」最高分</div></div>
    </div>
    ${lastBits.length ? `<div class="home-last">${lastBits.join(' ｜ ')}</div>` : ''}
    <div class="home-actions">
      <a class="btn btn-primary" href="annotate.html">开始练「找」</a>
      <a class="btn btn-primary" href="practice.html">开始练「改」</a>
      <a class="btn btn-outline" href="pe-exam.html">进入模拟参赛</a>
      <a class="btn btn-ghost" href="practice.html#stats">我的统计</a>
      <button id="mtpe-install-btn" class="btn btn-ghost hidden" onclick="mtpeInstall()">安装到桌面</button>
    </div>
    <div class="board-note" id="home-note"></div>
  </div>

  <div class="board">
    <h3>学习资源</h3>
    <p class="muted" style="line-height:2">
      · <a href="MQM错误类型参考手册.html">MQM 错误类型参考手册</a>：M1–M9 / M0 的定义与严重度判据　｜　导出成绩（CSV / 作业 JSON）在「② 改 → 我的统计」
    </p>
  </div>`;

    syncInstall();
  }

  function syncInstall() {
    const btn = document.getElementById('mtpe-install-btn');
    if (btn) btn.classList.toggle('hidden', !(window.mtpeCanInstall && window.mtpeCanInstall()));
    const note = document.getElementById('home-note');
    if (note) note.textContent = installNote();
  }

  document.addEventListener('mtpe-install-changed', syncInstall);
  document.addEventListener('mtpe-installed', syncInstall);
  document.addEventListener('mtpe-sw-ready', syncInstall);

  render();
})();

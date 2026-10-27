/* ============================================================
 * home.js — 一级首页
 * 职责只有两件事：① 告诉学生"找 / 改 / 测"三个入口各是做什么的；
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

  /* 历史记录里两类"交卷"的口径：②改 的练习（限时 / 自由 / 演示）与 ③测 的仿真训练。
     2026-10-12 起 ③测 写 mode='exam'；旧记录用 profile 字段反推（②改 的记录不带 profile）。
     这样「改」的统计包含限时练习（此前被 mode='competition' 误排除了），也不会把测评分混进来。 */
  /* ⚠ 口径同步点：isExamRecord 与 report.js 的 rpIsExam（window.mtpeIsExamRecord）
     是同一口径的两份实现——首页刻意不加载 report.js 保轻量，故本地复制。
     改"练习 vs 测评"的判定口径时，两处必须同改，否则首页与统计页数字打架。 */
  const isExamRecord = (h) => !!h && (h.mode === 'exam' || h.profile !== undefined);

  /* 未完成的练习草稿（键名 mtpe_draft_<taskId>）
     机房串号修复（2026-10-17）：草稿带保存时的昵称戳（nick），只列"本人"的。 */
  const curNick = () => { try { return JSON.parse(localStorage.getItem('mtpe_nickname') || '""') || ''; } catch (e) { return ''; } };
  const mineNick = (n) => { const c = curNick(); return !c || n === c; };
  function drafts() {
    const out = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf('mtpe_draft_') === 0) {
          const d = JSON.parse(localStorage.getItem(k) || 'null');
          if (d && mineNick(d.nick)) out.push(k.slice('mtpe_draft_'.length));
        }
      }
    } catch (e) {}
    return out;
  }

  /* 进度汇总：只读 localStorage（练习/测评记录 + 标注交卷摘要）——只算"本人"的记录 */
  function summary() {
    const n = curNick();
    const mineH = (x) => !n || (!!x && x.nickname === n);
    const mineA = (x) => !n || (!!x && x.nick === n);
    const hs = ((get('history', []) || [])).filter(mineH);
    const ann = ((get('ann_stats', []) || [])).filter(mineA);
    const practice = hs.filter((h) => !isExamRecord(h));
    const exams = hs.filter(isExamRecord);
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

  /* 最弱错误维度：取自"最近一次测评交卷"的画像（dims = 你的译文里各维度还剩多少处没改对）。
     只读既有数据，不新增采集；与测评结果页的推荐练习同一口径。 */
  const DIMS = ['准确性', '术语', '语言规范', '风格', '区域规范', '格式'];
  function weakestDim() {
    const exams = (get('history', []) || []).filter((h) => isExamRecord(h) && h.profile && h.profile.dims);
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
 依据只有现有数据（草稿 / 标注 F1 / 练习次数 / 测评次数），不新增采集。 */
  function nextStep(s, dr) {
    /* 平台账号是课上统一发放的共享账号 → 先让本人报上姓名/学号，成绩才认得出是谁 */
    if (!get('nickname_set', 0)) return { setupName: true };
    if (dr.length) {
      return { href: 'practice.html', cta: '继续上次练习', why: '有 ' + dr.length + ' 份草稿没做完，接着改最划算。' };
    }
    if (!s.annN && !s.practiceN && !s.examN) {
      return { href: 'annotate.html', cta: '开始第一练 · 标注 10 句', why: '从「找」开始：10 句约 10 分钟，交卷立即出 F1。' };
    }
    /* 有测评画像时优先给"针对最弱维度"的建议 —— 这是全站最有信息量的一条线索 */
    const wd = weakestDim();
    if (wd) {
      return {
        href: 'annotate.html?dim=' + encodeURIComponent(wd.dim) + '&n=15&go=1',
        cta: '加练「' + wd.dim + '」15 句',
        why: '上次测评「' + wd.dim + '」还剩 ' + wd.n + ' 处没改对（最多）。已按该维度组好 15 句，交卷不计分。'
      };
    }
    if (s.annN && s.annF1 != null && s.annF1 < 70) {
      return { href: 'annotate.html', cta: '加练「找」10 句', why: '「找」平均 F1 只有 ' + s.annF1 + '%，当前最短的一块板。' };
    }
    if (!s.practiceN) {
      return { href: 'practice.html', cta: '开始练「改」', why: '还没改过整篇机翻底稿，动手改一遍。' };
    }
    if (!s.examN) {
      return { href: 'pe-exam.html', cta: '去「测」估一次分', why: '还没交过卷——练习分不是测评口径，先摸一次底。' };
    }
    return { href: 'pe-exam.html', cta: '再测一次', why: '测评最高 ' + num(s.examBest) + ' 分。换套新卷，检验进步。' };
  }

  function render() {
    const s = summary();
    const dr = drafts();
    const nx = nextStep(s, dr);
    const lastBits = [];
    if (s.lastPractice) lastBits.push('上次练习《' + esc(s.lastPractice.taskName) + '》得分 ' + s.lastPractice.score);
    if (s.lastExam) lastBits.push('上次仿真训练《' + esc(s.lastExam.taskName) + '》得分 ' + s.lastExam.score
      + (s.lastExam.profile && s.lastExam.profile.quadrant ? '（' + esc(s.lastExam.profile.quadrant) + '）' : ''));

    /* 2026-10-17 工作台 v2（反向自《四六级工作台》）：左＝深靛紫侧边栏导航
       （首页 + 6 模块），右＝聚焦主区（渐变 hero：下一步建议 + 核心数字，
       下方最近成绩与三步说明卡）。数据逻辑不变。 */
    const wk = '日一二三四五六'[new Date().getDay()];
    const today = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' }) + ' 星期' + wk;

    /* 工作台铺满全屏：豁免元素级 main 限宽（style.css 的 main{max-width:1180px}） */
    try { document.body.classList.add('wb-home'); } catch (e) {}
    app.innerHTML = `
  <div class="wb-app">
    <aside class="wb-side">
      <div class="wb-logo"><h1>译后编辑实训平台</h1><p id="wb-date">${esc(today)}</p></div>
      <nav class="wb-nav">
        <a class="on" href="index.html">🏠 聚焦首页</a>
        <a href="stats.html">📊 我的统计</a>
        <a href="settings.html">⚙️ 我的设置</a>
        <a href="annotate.html">🔍 标注实训 <span class="tag">① 找</span></a>
        <a href="practice.html">✏️ 改译实训 <span class="tag">② 改</span></a>
        <a href="pe-exam.html">⏱️ 仿真训练 <span class="tag">③ 测</span></a>
        <a href="champion.html">🎯 能力对标</a>
      </nav>
      <div class="wb-foot">
        <div class="wb-foot-acts">
          <a href="#" onclick="(window.mtpeHelp||function(){})( );return false" title="帮助：流程说明 / 计分口径 / 常见问题">? 帮助</a>
          <a href="#" id="mtpe-install" class="hidden" onclick="mtpeInstall();return false" title="装成桌面应用，断网也能用">⬇ 安装到桌面</a>
          ${nx.setupName
            ? '<a href="settings.html" title="共享账号按姓名归属成绩，请先报到">未报到 · 去填写</a>'
            : '<span class="wb-acc" title="按姓名归属成绩">' + esc(curNick()) + '</span>'}
          <a href="#" onclick="mtpeLogout();return false">退出</a>
        </div>
        语料加密封存 · 离线可用
      </div>
    </aside>
    <main class="wb-main">
      <section class="wb-focus">
        <div class="hn-tag">聚焦 · 下一步</div>
        ${nx.setupName ? `
        <div class="wb-hero-big">先报上姓名／学号</div>
        <div class="hn-why">共享账号按姓名认人：作业导出与班级汇总都用它。</div>
        <a class="wb-hero-btn" href="settings.html">去「我的设置」报到 →</a>` : `
        <div class="wb-hero-big">${esc(nx.cta)}</div>
        <div class="hn-why">${esc(nx.why)}</div>
        <a class="wb-hero-btn" href="${nx.href}">现在开始</a>`}
        <div class="wb-hero-stats">
          <div class="stat"><div class="n">${s.practiceN}</div><div class="l">改译次数</div></div>
          <div class="stat"><div class="n">${pct(s.annF1)}</div><div class="l">标注 F1</div></div>
          <div class="stat"><div class="n">${num(s.examBest)}</div><div class="l">仿真最高</div></div>
          <div class="stat"><div class="n">${dr.length}</div><div class="l">未完成草稿</div></div>
        </div>
        <div class="wb-theory">刻意练习：目标明确 · 反馈即时 · 重复针对 <span>— Shreve, 2006（转用 Ericsson et al., 1993）</span></div>
      </section>

      <div class="wb-card">
        <h3>最近成绩</h3>
        ${lastBits.length ? `<div class="wb-last">${lastBits.join('<br>')}</div>`
          : '<div class="wb-last">还没有记录，先去「标注实训」练一卷。</div>'}
      </div>

      <div class="wb-grid3">
        <div class="wb-mini"><span class="mt m1">① 找 · 标注实训</span>
          <div class="mp">划错定性 · 对照种子 · 查准率 / 查全率 / F1</div>
          <a href="annotate.html">进入标注实训 →</a></div>
        <div class="wb-mini"><span class="mt m2">② 改 · 改译实训</span>
          <div class="mp">机翻逐段润色 · 限时 / 自由 · 修订率与逐段点评</div>
          <a href="practice.html">进入改译实训 →</a></div>
        <div class="wb-mini"><span class="mt m3">③ 测 · 仿真训练</span>
          <div class="mp">赛场还原 · 限时交卷 · 评分与四项画像</div>
          <a href="pe-exam.html">进入仿真训练 →</a></div>
      </div>
    </main>
  </div>`;
  }

  /* 侧栏「安装到桌面」显隐：绑定逻辑统一在 unlock.js 的 mtpeBindInstall */
  window.mtpeBindInstall('mtpe-install');

  render();
})();

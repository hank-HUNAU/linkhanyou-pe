/* ============================================================
 * champion.js — 对标亚军（学生作答 vs 亚军画像）
 *
 * 流程：广场（3 篇真题）→ 逐段译后编辑 → 结果页
 *   · educability（英→汉）/ 何园（汉→英）：以参考译文为基准，算学生画像，
 *     与亚军画像做「画像外推」对比（雷达图 + 强弱项）
 *   · 镇湖刺绣（汉→英）：以亚军真实作答为基准，逐段对照 + 专家评析
 *
 * 画像口径：与平台 MQM 六大维度一致（准确性/术语/语言规范/风格/区域规范/格式），
 * 学生能力分 = 修正率（1 − 剩余错误 ÷ 机翻原始错误）× 100，与亚军画像分同尺度。
 * ============================================================ */
(function () {
  'use strict';

  /* ---------------- 工具 ---------------- */
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const app = $('#app');
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const store = {
    get(k, d) { try { const v = localStorage.getItem('mtpe_champ_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { localStorage.setItem('mtpe_champ_' + k, JSON.stringify(v)); }
  };
  function toast(msg) {
    const t = $('#toast');
    if (!t) return;
    t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(t._tm); t._tm = setTimeout(() => t.classList.add('hidden'), 2200);
  }

  /* ---------------- 分词与 diff ---------------- */
  function tokenize(s) {
    return (String(s || '').match(/[\u4e00-\u9fff]|[A-Za-z]+(?:'[a-z]+)?|\d+(?:\.\d+)?%?|[^\s]/g) || []);
  }
  function diffTokens(a, b) {
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

  /* ---------------- 六大维度与错误分类 ---------------- */
  const DIMS = ['准确性', '术语', '语言规范', '风格', '区域规范', '格式'];
  const isPunctOnly = (s) => !!s && !/[0-9A-Za-z\u4e00-\u9fff]/.test(s);
  const GLOSS_RE = /[（(]\s*[A-Za-z][A-Za-z0-9 .'’\-]{1,40}\s*[）)]/;
  function classifyChunk(del, ins) {
    const d = del.join(''), s = ins.join('');
    if (d.replace(/\s+/g, '') === s.replace(/\s+/g, '')) return '格式';   // 仅空白差异
    const dt = d.replace(/\s+/g, ''), st = s.replace(/\s+/g, '');
    if (st && GLOSS_RE.test(st) && !GLOSS_RE.test(dt)) return '术语';     // 参考补拉丁括注
    if (/[0-9]/.test(dt) || /[0-9]/.test(st)) return '区域规范';          // 数字/单位/日期
    if (isPunctOnly(dt) || isPunctOnly(st)) return '语言规范';            // 标点
    if (!dt) return '准确性';                                             // 漏译
    if (!st) return '准确性';                                             // 增译
    const dn = del.filter((t) => t.trim()).length, sn = ins.filter((t) => t.trim()).length;
    if (dn >= 2 && sn >= 2 && Math.max(dt.length, st.length) >= 6 && Math.abs(dt.length - st.length) <= 2) return '风格';
    return '准确性';
  }
  /* 一段 a vs b 的差异，归到各维度的片段数 */
  function dimCount(a, b) {
    const A = tokenize(a), B = tokenize(b);
    const ops = diffTokens(A, B);
    const cnt = {}; DIMS.forEach((d) => cnt[d] = 0);
    let i = 0, ai = 0, bi = 0;
    while (i < ops.length) {
      if (ops[i].op === 'same') { ai++; bi++; i++; continue; }
      const del = [], ins = [];
      while (i < ops.length && ops[i].op !== 'same') {
        (ops[i].op === 'del' ? del : ins).push(ops[i].op === 'del' ? A[ai++] : B[bi++]);
        i++;
      }
      cnt[classifyChunk(del, ins)]++;
    }
    return cnt;
  }

  /* 修订率：编辑量 / 机翻长度（衡量"改了多少"，clamp 到 [0,1]） */
  function revisionRate(mt, pe) {
    const A = tokenize(mt), B = tokenize(pe);
    if (!A.length && !B.length) return 0;
    const ops = diffTokens(A, B);
    const edits = ops.filter((o) => o.op !== 'same').length;
    if (!A.length) return 1;
    return Math.min(1, edits / A.length);
  }

  /* ---------------- 学生画像（修正率 × 100） ---------------- */
  function studentProfile(segs, answers, targetKey) {
    const errMT = {}, errSt = {};
    DIMS.forEach((d) => { errMT[d] = 0; errSt[d] = 0; });
    segs.forEach((seg, i) => {
      const mt = seg.mt || '';
      const target = seg[targetKey] || '';
      const st = (answers && answers[i] != null && answers[i] !== '') ? answers[i] : mt;
      const e1 = dimCount(mt, target);
      const e2 = dimCount(st, target);
      DIMS.forEach((d) => { errMT[d] += e1[d]; errSt[d] += e2[d]; });
    });
    const profile = {};
    DIMS.forEach((d) => {
      const base = errMT[d], left = errSt[d];
      const fix = base > 0 ? Math.max(0, 1 - left / base) : (left === 0 ? 1 : 0);
      profile[d] = Math.round(fix * 100);
    });
    return { profile, errMT, errSt };
  }

  /* ---------------- 亚军画像 ---------------- */
  if (!window.CHAMPION) { if (app) app.innerHTML = '<div class="c-none">冠军数据未加载</div>'; return; }
  const championMap = {};
  (window.CHAMPION.profile || []).forEach((p) => { championMap[p.dim] = p.score; });
  const championVals = () => DIMS.map((d) => championMap[d] != null ? championMap[d] : 0);

  /* 强弱项（以亚军为标准，阈值 5 分抗噪） */
  function compare(student) {
    const weak = [], strong = [], even = [];
    DIMS.forEach((d) => {
      const s = student[d], c = championMap[d] != null ? championMap[d] : 0;
      if (s < c - 5) weak.push({ dim: d, s: s, c: c });
      else if (s > c + 5) strong.push({ dim: d, s: s, c: c });
      else even.push({ dim: d, s: s, c: c });
    });
    return { weak, strong, even };
  }

  /* 另外两位参赛选手的点状作答（各 1 段），作横向参照 + 避坑教学 */
  function rivalOf(key) { return (window.RIVALS && window.RIVALS[key]) || null; }

  /* ---------------- 任务定义 ---------------- */
  function buildTasks() {
    const TSK = (typeof TASKS !== 'undefined' ? TASKS : []);
    const t2 = TSK.find((t) => t.id === 'e2_7');
    const t4 = TSK.find((t) => t.id === 'e4_7');
    const list = [];
    if (t2) list.push({
      id: 'e2_7', name: '第七届初赛 · 英译汉', sub: '“可教育性”论说文（GPT-4o 底稿）',
      dir: '英→汉', targetKey: 'ref', mode: 'forecast',
      desc: '学生在机翻底稿上译后编辑，与亚军画像外推对比，判断强弱项。',
      rival: rivalOf('educability'),
      segs: (t2.segs || []).map((g) => ({ src: g.src, mt: g.mt, ref: g.ref }))
    });
    if (t4) list.push({
      id: 'e4_7', name: '第七届决赛 · 汉译英', sub: '扬州何园（GPT-4o 底稿）',
      dir: '汉→英', targetKey: 'ref', mode: 'forecast',
      desc: '学生在机翻底稿上译后编辑，与亚军画像外推对比，判断强弱项。',
      rival: rivalOf('heyuan'),
      segs: (t4.segs || []).map((g) => ({ src: g.src, mt: g.mt, ref: g.ref }))
    });
    list.push({
      id: 'zhenhu', name: '外研社·国才杯 · 汉译英', sub: '镇湖刺绣（亚军真实作答）',
      dir: '汉→英', targetKey: 'pe', mode: 'real',
      desc: '学生作答后与亚军 9 段真实作答逐段对照，附专家评析。',
      rival: null,
      segs: (window.CHAMPION.segs || []).map((g) => ({
        src: g.src, mt: g.mt, pe: g.pe, comment: g.comment, fix: g.fix, flaw: g.flaw
      }))
    });
    return list;
  }
  const TASKS_C = buildTasks();

  /* ---------------- 状态与渲染 ---------------- */
  let view = 'plaza';
  let S = null; // { task, answers[] }

  function setAnswering(on) { try { document.body.classList.toggle('answering', !!on); } catch (e) {} }

  function dimTag(d) {
    const color = { '准确性': 's1', '术语': 's1', '语言规范': 's2', '风格': 's2', '区域规范': 's3', '格式': 's3' }[d] || 's2';
    return '<span class="step-tag ' + color + '">' + d + '</span>';
  }

  /* ---------------- 雷达图 ---------------- */
  function radarSVG(student) {
    const cx = 170, cy = 150, R = 108, n = DIMS.length;
    const ang = (i) => -Math.PI / 2 + i * 2 * Math.PI / n;
    const pt = (i, r) => [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))];
    const poly = (vals) => DIMS.map((_, i) => pt(i, R * (vals[i] || 0) / 100).map((v) => v.toFixed(1)).join(',')).join(' ');
    let grid = '', axes = '';
    [25, 50, 75, 100].forEach((v) => { grid += '<polygon points="' + poly(DIMS.map(() => v)) + '" fill="none" stroke="#e5e7eb"/>'; });
    DIMS.forEach((_, i) => { const p = pt(i, R); axes += '<line x1="' + cx + '" y1="' + cy + '" x2="' + p[0].toFixed(1) + '" y2="' + p[1].toFixed(1) + '" stroke="#e5e7eb"/>'; });
    let labels = '';
    DIMS.forEach((d, i) => {
      const p = pt(i, R + 24);
      labels += '<text x="' + p[0].toFixed(1) + '" y="' + (p[1] + 4).toFixed(1) + '" font-size="12.5" fill="#3a3a3c" text-anchor="middle">' + d + '</text>';
    });
    const cv = championVals();
    const sv = DIMS.map((d) => student[d] || 0);
    return '<svg viewBox="0 0 340 320" role="img" aria-label="学生与亚军能力画像雷达图">'
      + axes + grid
      + '<polygon points="' + poly(cv) + '" fill="rgba(134,134,139,.22)" stroke="#86868b" stroke-width="2"/>'
      + '<polygon points="' + poly(sv) + '" fill="rgba(0,113,227,.20)" stroke="#0071e3" stroke-width="2.5"/>'
      + labels + '</svg>';
  }

  /* ---------------- 广场 ---------------- */
  function renderPlaza() {
    view = 'plaza'; setAnswering(false);
    const cards = TASKS_C.map((t) =>
      '<a class="c-card" href="#" data-id="' + t.id + '">'
      + '<div class="c-card-top"><span class="step-tag ' + (t.mode === 'real' ? 's3' : 's1') + '">' + (t.mode === 'real' ? '真实作答' : '画像外推') + '</span>'
      + '<span class="c-dir">' + esc(t.dir) + '</span></div>'
      + '<h3>' + esc(t.name) + '</h3>'
      + '<p class="c-sub">' + esc(t.sub) + '</p>'
      + '<p class="c-desc">' + esc(t.desc) + '</p>'
      + '<span class="c-go">开始对标 →</span>'
      + '</a>').join('');

    app.innerHTML =
      '<div class="wrap wide">'
      + '<div class="c-hero">'
      + '<h1>对标亚军</h1>'
      + '<p class="c-hero-sub">以 ' + esc(window.CHAMPION.event) + ' ' + esc(window.CHAMPION.task) + ' 的亚军选手为基准，'
      + '从她的真实作答提炼能力画像，判断你的强弱项。</p>'
      + '</div>'
      + '<div class="c-profile">'
      + '<h2>亚军能力画像</h2>'
      + '<div class="c-profile-grid">'
      + (window.CHAMPION.profile || []).map((p) =>
        '<div class="c-pitem"><div class="c-phead"><span class="c-pdim">' + esc(p.dim) + '</span><b class="c-pscore">' + p.score + '</b></div>'
        + '<div class="c-pbar"><i style="width:' + p.score + '%"></i></div>'
        + '<p class="c-pnote">' + esc(p.note) + '</p></div>').join('')
      + '</div></div>'
      + '<h2 class="c-sec">选择一篇真题开始对标</h2>'
      + '<div class="c-cards">' + cards + '</div>'
      + '<p class="c-foot">画像外推篇以参考译文为基准；真实作答篇以亚军译文为基准、附专家评析。</p>'
      + '</div>';
    $$('.c-card').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); startTask(a.dataset.id); }));
  }

  /* ---------------- 作答 ---------------- */
  function startTask(id) {
    const t = TASKS_C.find((x) => x.id === id);
    if (!t) return;
    S = { task: t, answers: new Array(t.segs.length).fill('') };
    view = 'answer'; setAnswering(true);
    renderAnswer();
  }
  function renderAnswer() {
    const t = S.task;
    const rows = t.segs.map((seg, i) =>
      '<div class="c-seg">'
      + '<div class="c-seg-src">' + esc(seg.src) + '</div>'
      + '<div class="c-seg-mt">' + esc(seg.mt) + '</div>'
      + '<textarea class="c-edit" data-i="' + i + '" rows="' + Math.max(3, Math.ceil((seg.mt || '').length / 55) + 1) + '" placeholder="在机翻底稿上修改…">' + esc(seg.mt) + '</textarea>'
      + '</div>').join('');
    app.innerHTML =
      '<div class="c-answerbar"><span class="step-tag s3">对标亚军 · 作答中</span>'
      + '<span class="c-ans-name">' + esc(t.name) + '</span>'
      + '<span class="c-ans-count">' + t.segs.length + ' 段</span>'
      + '<button class="btn btn-primary" onclick="window.__champSubmit()">交卷对比</button></div>'
      + '<div class="wrap wide c-answer">' + rows + '</div>';
  }
  window.__champSubmit = function () {
    const t = S.task;
    const edits = $$('.c-edit');
    const answers = edits.map((el) => el.value);
    const p = studentProfile(t.segs, answers, t.targetKey);
    const cmp = compare(p.profile);
    let rev = 0;
    t.segs.forEach((seg, i) => {
      const st = (answers[i] != null && answers[i] !== '') ? answers[i] : (seg.mt || '');
      rev += revisionRate(seg.mt || '', st);
    });
    const avgRev = t.segs.length ? rev / t.segs.length : 0;
    S.result = { answers: answers, profile: p.profile, cmp: cmp, errMT: p.errMT, errSt: p.errSt, revision: avgRev };
    view = 'result'; setAnswering(false);
    renderResult();
  };

  /* ---------------- 结果页 ---------------- */
  function renderResult() {
    const t = S.task, r = S.result;
    const weakHtml = r.cmp.weak.length
      ? r.cmp.weak.map((w) => '<div class="c-dim-row weak"><span class="c-dim-name">' + w.dim + '</span><span class="c-dim-delta">你 ' + w.s + ' ＜ 亚军 ' + w.c + '</span></div>').join('')
      : '<p class="c-none">没有明显弱于亚军的维度。</p>';
    const strongHtml = r.cmp.strong.length
      ? r.cmp.strong.map((w) => '<div class="c-dim-row strong"><span class="c-dim-name">' + w.dim + '</span><span class="c-dim-delta">你 ' + w.s + ' ＞ 亚军 ' + w.c + '</span></div>').join('')
      : '<p class="c-none">没有明显强于亚军的维度。</p>';
    const revWarn = (r.revision != null && r.revision < 0.05)
      ? '<div class="warn-box">你几乎没有修改机翻底稿（修改率 ' + Math.round(r.revision * 100) + '%），画像仅供参考——先动手改一遍才有意义。</div>'
      : '';

    /* 画像外推：预估亚军在该篇的修正/剩余（具象化） */
    let forecastHtml = '';
    if (t.mode === 'forecast') {
      forecastHtml = '<h2 class="c-sec">预估亚军在这篇的表现（画像外推）</h2><div class="c-forecast">'
        + DIMS.map((d) => {
          const base = r.errMT[d] || 0, c = championMap[d] || 0;
          const fixed = Math.round(base * c / 100), left = base - fixed;
          return '<div class="c-frow"><span class="c-fdim">' + d + '</span><span class="c-fnum">机翻错误 ' + base + ' 处 → 预计改对 ' + fixed + ' / 漏 ' + left + '</span></div>';
        }).join('')
        + '<p class="c-fnote">按亚军各维度能力分外推，仅作教学参照。</p></div>';
    }

    /* 另一位真实选手的作答对照（点状，横向参照 + 避坑） */
    let rivalHtml = '';
    if (t.rival) {
      rivalHtml = '<h2 class="c-sec">另一位真实选手 · ' + esc(t.rival.style) + '（同一处）</h2>'
        + '<div class="c-compare">'
        + '<div class="c-cmp-row">'
        + '<div class="c-cmp-src">' + esc(t.rival.seg.src) + '</div>'
        + '<div class="c-cmp-col"><b>机翻底稿</b><div class="c-cmp-txt">' + esc(t.rival.seg.mt) + '</div></div>'
        + '<div class="c-cmp-col"><b>选手作答</b><div class="c-cmp-txt">' + esc(t.rival.seg.pe) + '</div></div>'
        + (t.rival.seg.comment ? '<div class="c-cmp-comment">专家评析：' + esc(t.rival.seg.comment) + '</div>' : '')
        + '</div>'
        + '</div>'
        + '<div class="warn-box">' + esc(t.rival.verdict) + '</div>';
    }

    /* 逐段对照 */
    const diffRows = [];
    t.segs.forEach((seg, i) => {
      const mt = seg.mt || '';
      const st = r.answers[i] != null && r.answers[i] !== '' ? r.answers[i] : mt;
      if (t.mode === 'real') {
        diffRows.push({ i, seg, st });
      } else {
        const target = seg.ref || '';
        const e = dimCount(st, target);
        const hasErr = DIMS.some((d) => (e[d] || 0) > 0);
        if (hasErr) diffRows.push({ i, seg, st, remain: e });
      }
    });
    const rowsHtml = t.mode === 'real'
      ? diffRows.map((x) => realSegRow(x.i, x.seg, x.st)).join('')
      : diffRows.map((x) => forecastSegRow(x.i, x.seg, x.st, x.remain)).join('');
    const rowsEmpty = diffRows.length ? '' : '<p class="c-none">所有段落都改到位了，没有明显残留错误。</p>';

    app.innerHTML =
      '<div class="wrap wide c-result">'
      + '<div class="c-result-top">'
      + '<h1>对标结果 · ' + esc(t.name) + '</h1>'
      + '<p class="c-result-sub">蓝色 = 你　｜　灰色 = 亚军（基准）</p>'
      + '</div>'
      + revWarn
      + '<div class="c-result-grid">'
      + '<div class="c-radar">' + radarSVG(r.profile) + '</div>'
      + '<div class="c-verdict">'
      + '<h2>你的薄弱项</h2>' + weakHtml
      + '<h2>你的强项</h2>' + strongHtml
      + '</div>'
      + '</div>'
      + forecastHtml
      + rivalHtml
      + '<h2 class="c-sec">' + (t.mode === 'real' ? '逐段对照（你 vs 亚军）' : '需留意的段落（你 vs 参考译文）') + '</h2>'
      + '<div class="c-compare">' + rowsHtml + rowsEmpty + '</div>'
      + '<div class="c-actions"><a class="btn btn-ghost" href="#" id="c-again">再练一篇</a>'
      + '<a class="btn btn-primary" href="stats.html">去我的统计</a></div>'
      + '</div>';
    const again = $('#c-again');
    if (again) again.addEventListener('click', (e) => { e.preventDefault(); renderPlaza(); });
    window.scrollTo(0, 0);
  }

  function realSegRow(i, seg, st) {
    return '<div class="c-cmp-row">'
      + '<div class="c-cmp-src">' + (i + 1) + '. ' + esc(seg.src) + '</div>'
      + '<div class="c-cmp-col"><b>你的译文</b><div class="c-cmp-txt">' + esc(st) + '</div></div>'
      + '<div class="c-cmp-col"><b>亚军译文</b><div class="c-cmp-txt">' + esc(seg.pe || '') + '</div></div>'
      + (seg.fix ? '<div class="c-cmp-tag ok">强项：' + esc(seg.fix) + '</div>' : '')
      + (seg.flaw ? '<div class="c-cmp-tag bad">瑕疵：' + esc(seg.flaw) + '</div>' : '')
      + (seg.comment ? '<div class="c-cmp-comment">专家评析：' + esc(seg.comment) + '</div>' : '')
      + '</div>';
  }
  function forecastSegRow(i, seg, st, remain) {
    const remainTags = DIMS.filter((d) => (remain[d] || 0) > 0).map((d) => dimTag(d)).join('');
    return '<div class="c-cmp-row">'
      + '<div class="c-cmp-src">' + (i + 1) + '. ' + esc(seg.src) + '</div>'
      + '<div class="c-cmp-col"><b>你的译文</b><div class="c-cmp-txt">' + esc(st) + '</div></div>'
      + '<div class="c-cmp-col"><b>参考译文</b><div class="c-cmp-txt">' + esc(seg.ref || '') + '</div></div>'
      + '<div class="c-cmp-tag bad">残留：' + (remainTags || '—') + '</div>'
      + '</div>';
  }

  /* ---------------- 启动 ---------------- */
  if (!TASKS_C.length) { app.innerHTML = '<div class="c-none">没有可用真题（请先登录解锁语料）</div>'; return; }
  renderPlaza();
})();

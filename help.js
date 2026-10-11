/* ============================================================
 * help.js — 全站帮助弹窗（三页共用一份内容）
 *
 * 页面上只留"现在该做什么 / 刚刚发生了什么"；口径、来源、局限、常见问题
 * 读一遍就够，常驻在页面上是噪音 —— 集中到这里，三页共用顶栏右侧那个「?」。
 * 改一处三页同步；样式自带，不依赖各页 CSS。
 * 用法：引入本文件后任意处调 mtpeHelp() 打开；nav.js 负责渲染「?」按钮。
 * ============================================================ */
(function () {
  const SECTIONS = [
    {
      t: '三个流程怎么用',
      rows: [
        ['① 找 · 标注实训', '在机器译文上划出有问题的片段，判定错误类型与严重度。交卷后与人工种子标注比对，给出查准率 / 查全率 / F1。练的是"哪里该改"的判断力——漏检和过度标注都算错。'],
        ['② 改 · 译后编辑练习', '在机器译文底稿上动手改。限时练习 8 / 15 / 30 分钟（离开页面会计数），自由练习不限时可存草稿。交卷看修订率与逐段对照。练习分只供自己追踪，不是测评口径。'],
        ['③ 测 · 仿真训练', '在接近真实工作状态的界面里限时交卷：整页独占、切屏计数、禁复制粘贴、倒计时。交卷给出综合评分与四项画像（错误维度分布 / 编辑倾向 / 速度与稳定性 / 参照系）。'],
        ['为什么按这个顺序', '先判断、再动手、最后在限时压力下复现。顺序反了，容易一上来就整句重写，练不到"判断"这一层。']
      ]
    },
    {
      t: '计分口径',
      rows: [
        ['① 找', '查准率 = 你标对的 ÷ 你标的；查全率 = 你标对的 ÷ 种子总数；F1 是两者调和平均。片段位置标对但错误类型判错、或严重度判偏，都会单独计数。只有"种子对照卷"计分，盲标卷不计分。'],
        ['② 改', '综合得分基于与参考译文的词级重合度；修订率按词级编辑量计算，中文按字切分。同义改写或更优表达可能被低估，所以分数只适合自己做纵向对比。'],
        ['③ 测', '测评口径为 TER（译文与参考译文的编辑距离）换算，×1.2 系数；模拟晋级线 84 分，取自 1000 人模拟池第 80 百分位。同为 TER 口径的横向比较才有效。'],
        ['编辑倾向四象限', '按"编辑率"和"有效编辑率"定位：精准型（改动少而准）、过度编辑型（改动多而准）、保守型（改动少而不准）、鲁莽型（改动多而不准）。译后编辑的理想区间是"精准型"。']
      ]
    },
    {
      t: '数据来源与已知局限',
      rows: [
        ['语料来源', '平台语料为公开发布的赛题与既有参考译文，按句对切分后用于教学；另有少量低级别"案例摘录"只作教学演示，不进入题库。语料以密文存放，需要课程账号解锁。'],
        ['关于"重构底稿"', '有部分届次只公布了"原文 + 参考译文"，机器翻译输出从未公开。这些卷的训练底稿由大模型按机翻输出风格重构生成，卷名与任务说明中都标注为「重构底稿」，不与原始机翻输出混称；这些卷的参考译文仍是既有译文。'],
        ['评分算法局限', '错误维度分布与编辑率诊断由逐段 diff 启发式初筛，不是人工标注的精确口径；相似度类指标对自由重写偏低。所有分数适合纵向对比，不适合当作绝对水平。'],
        ['关于机器译文', '机器译文保留了大量典型的翻译腔与错误（这本来就是译后编辑要改的对象），不代表当前任何模型的实际水平。']
      ]
    },
    {
      t: '常见问题',
      rows: [
        ['为什么有的卷不计分？', '只有带人工种子标注的卷才计分。种子不足时组卷会补入盲标句对，交卷时标明"不计分"，但不影响错题入本——盲标也能练手感。'],
        ['分数和我的感觉不符？', '先看口径：① 找衡量判断力，② 改衡量与参考译文的吻合度，③ 测按 TER 计分，三者不可横向比较。③ 测里"机翻对的部分保留"是得分动作，过度编辑会掉分。'],
        ['断网／没网能练吗？', '能。用线上网址打开并登录过一次后，外壳与语料分片都进了离线缓存，之后断网也能继续练；作答记录存在本机浏览器里。'],
        ['怎么装到桌面？', '在 Chrome / Edge 里打开线上网址，点顶栏的「安装到桌面」（没看到按钮时，点地址栏右侧的安装图标）。本地双击打开（file://）功能照常，但没有离线缓存与安装入口。'],
        ['成绩怎么交给老师？', '「② 改 → 我的统计」里可导出：作业 JSON 交老师汇总，CSV 是自己看明细用的。平台账号是课上共享的，所以先在首页填姓名／学号，否则全班成绩会并到一起。'],
        ['登录有效期多久？', '12 小时。到期或点「退出」后需要重新输入口令；口令由课程负责人发放，平台不保存明文。']
      ]
    }
  ];

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function ensureStyle() {
    if (document.getElementById('mtpe-help-style')) return;
    const st = document.createElement('style');
    st.id = 'mtpe-help-style';
    st.textContent =
      '#mtpe-help{position:fixed;inset:0;z-index:950;background:rgba(20,26,45,.45);display:flex;align-items:center;justify-content:center;padding:20px}'
      + '#mtpe-help .hp-card{background:#fff;border-radius:16px;width:min(680px,100%);max-height:86vh;overflow:auto;padding:22px 24px 26px;box-shadow:0 24px 70px rgba(0,0,0,.28);font:15px/1.75 -apple-system,BlinkMacSystemFont,"SF Pro Text","PingFang SC","Microsoft YaHei",sans-serif;color:#1d1d1f}'
      + '#mtpe-help .hp-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px}'
      + '#mtpe-help h2{font-size:19px;font-weight:700}'
      + '#mtpe-help .hp-x{border:none;background:rgba(0,0,0,.05);border-radius:999px;width:30px;height:30px;font-size:15px;color:#6e6e73;cursor:pointer;line-height:1}'
      + '#mtpe-help h3{font-size:14.5px;font-weight:700;margin:18px 0 8px;color:#0071e3}'
      + '#mtpe-help dl{margin:0}'
      + '#mtpe-help dt{font-size:13.5px;font-weight:600;color:#1d1d1f;margin-top:10px}'
      + '#mtpe-help dd{margin:2px 0 0;font-size:13.5px;color:#4b5563;line-height:1.75}'
      + '#mtpe-help .hp-foot{margin-top:18px;padding-top:12px;border-top:1px solid rgba(0,0,0,.08);font-size:12.5px;color:#86868b}';
    document.head.appendChild(st);
  }

  window.mtpeHelp = function () {
    let el = document.getElementById('mtpe-help');
    if (el) { el.style.display = 'flex'; return; }
    ensureStyle();
    el = document.createElement('div');
    el.id = 'mtpe-help';
    el.innerHTML = '<div class="hp-card">'
      + '<div class="hp-head"><h2>帮助</h2><button class="hp-x" onclick="mtpeHelpClose()" title="关闭">✕</button></div>'
      + SECTIONS.map((s) => '<h3>' + esc(s.t) + '</h3><dl>'
        + s.rows.map(([k, v]) => '<dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd>').join('')
        + '</dl>').join('')
      + '<div class="hp-foot">页面只放「现在该做什么」和「刚刚发生了什么」；口径、来源与局限都收在这里。</div>'
      + '</div>';
    el.onclick = (e) => { if (e.target === el) window.mtpeHelpClose(); };
    document.body.appendChild(el);
  };

  window.mtpeHelpClose = function () {
    const el = document.getElementById('mtpe-help');
    if (el) el.style.display = 'none';
  };

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') window.mtpeHelpClose();
  });
})();

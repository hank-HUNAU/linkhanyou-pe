/* ============================================================
 * mqm.js — MQM 标签速查（全站唯一一份口径）
 *
 * 用途：
 *   ① 作答中随时查——「找」的作答栏右侧有个「错误类型」按钮，点开就是这张表；
 *   ② 考点页——MQM 错误类型参考手册的每个维度下挂「练这一维度」入口。
 * 口径与 build_corpus.mjs 的 SCHEME / M_DIM 一致，改这里要同步改那边。
 * ============================================================ */
window.MQM_ITEMS = [
  { code: 'M1', name: '误译',     sev: 'Major',    dim: '准确性',   def: '词义选错、假朋友、逻辑关系译反、数字/数量级译错（含大模型幻觉：无中生有）' },
  { code: 'M2', name: '漏译',     sev: 'Major',    dim: '准确性',   def: '原文信息缺失——该译的没译出来' },
  { code: 'M3', name: '增译',     sev: 'Minor',    dim: '准确性',   def: '原文里没有的内容被加了进去' },
  { code: 'M4', name: '术语',     sev: 'Major',    dim: '术语',     def: '术语 / 专名错译，或全篇前后不一致' },
  { code: 'M5', name: '单位格式', sev: 'Critical', dim: '区域规范', def: '日期、货币、度量单位等本地化格式不符合目标地区习惯（数量级/数字译错归 M1）' },
  { code: 'M6', name: '语法搭配', sev: 'Minor',    dim: '语言规范', def: '主谓一致、时态、介词、冠词、搭配不当' },
  { code: 'M7', name: '拼写标点', sev: 'Minor',    dim: '语言规范', def: '大小写、引号、机械性低错' },
  { code: 'M8', name: '风格语域', sev: 'Minor',    dim: '风格',     def: '口语 vs 书面、欧化长句、不地道表达' },
  { code: 'M9', name: '格式标记', sev: 'Major',    dim: '格式',     def: '占位符、标签、排版（本地化场景）' }
];

/* M0 不是错误，单独列出：作答时"这一段不用改"也是一个判断 */
window.MQM_M0 = { code: 'M0', name: '无需修改', def: '机翻这一段没问题——留白、不标，也是得分动作' };

/* ---------- 作答中随手查：不跳页的速查弹窗（任何页面都能调） ---------- */
window.mqmQuickRef = function () {
  let m = document.getElementById('mqm-ref');
  if (!m) {
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    m = document.createElement('div');
    m.id = 'mqm-ref';
    m.className = 'mask';
    m.innerHTML = '<div class="modal" style="width:min(640px,94vw)">'
      + '<h3>错误类型速查</h3>'
      + '<p class="page-s" style="margin:4px 0 12px">划中片段后按对应的类型打标；严重度按常见级别预置，可自行调。</p>'
      + '<table style="width:100%;font-size:13px;border-collapse:collapse">'
      + '<tr><th style="text-align:left;padding:4px 6px">类型</th><th style="text-align:left;padding:4px 6px">判据</th><th style="padding:4px 6px">常见严重度</th></tr>'
      + window.MQM_ITEMS.map((it) => '<tr><td style="padding:4px 6px;white-space:nowrap"><b>' + it.code + '</b> ' + esc(it.name) + '</td>'
        + '<td style="padding:4px 6px">' + esc(it.def) + '</td><td style="padding:4px 6px;white-space:nowrap">' + it.sev + '</td></tr>').join('')
      + '<tr><td style="padding:4px 6px;white-space:nowrap"><b>M0</b> ' + esc(window.MQM_M0.name) + '</td>'
      + '<td style="padding:4px 6px">' + esc(window.MQM_M0.def) + '</td><td style="padding:4px 6px">—</td></tr>'
      + '</table>'
      + '<div class="m-actions"><a class="btn btn-ghost" href="MQM错误类型参考手册.html">完整手册</a>'
      + '<button class="btn btn-primary" onclick="mqmQuickRefClose()">知道了</button></div>'
      + '</div>';
    m.onclick = (e) => { if (e.target === m) window.mqmQuickRefClose(); };
    document.body.appendChild(m);
  }
  m.style.display = 'flex';
};
window.mqmQuickRefClose = function () {
  const m = document.getElementById('mqm-ref');
  if (m) m.style.display = 'none';
};

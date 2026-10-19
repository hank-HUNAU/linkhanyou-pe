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

/* ---------- 作答中随手查：不跳页的速查弹窗（任何页面都能调） ----------
 * 可读性改造（2026-10-19 用户反馈「不利于阅读」）：
 *   原 13px 表格挤在 640px 宽的弹窗里，判据列长句换行拥挤 →
 *   字号提到 14.5px、行高 1.65、单元格留白加大，类型列固定不折行，
 *   判据列自动换行并悬挂缩进（text-indent 反悬挂），严重度列右对齐。
 * ESC 一键关闭（用户要求）。 */
window.mqmQuickRef = function () {
  let m = document.getElementById('mqm-ref');
  if (!m) {
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    m = document.createElement('div');
    m.id = 'mqm-ref';
    m.className = 'mask';
    m.innerHTML = '<style>'
      + '#mqm-ref .qref{width:min(1180px,94vw);max-height:86vh;overflow:auto}'
      + '#mqm-ref table{width:100%;font-size:14.5px;border-collapse:collapse;line-height:1.65}'
      + '#mqm-ref th{padding:8px 10px;text-align:left;font-size:13.5px;color:#5a6478;background:#f8f9fd}'
      + '#mqm-ref th.sev{text-align:right}'
      + '#mqm-ref td{padding:8px 10px;vertical-align:top}'
      + '#mqm-ref td.c{white-space:nowrap;font-weight:600;font-size:15px}'
      + '#mqm-ref td.d{color:#515154;text-indent:-0.85em;padding-left:calc(10px + 0.85em)}'
      + '#mqm-ref td.sev{white-space:nowrap;text-align:right;font-weight:600}'
      + '#mqm-ref td.sev.Critical{color:#d70015}#mqm-ref td.sev.Major{color:#a35a00}#mqm-ref td.sev.Minor{color:#6e6e73}'
      /* 宽屏（≥1080px）：判据整句不折行（用户要求"文字不跨行"） */
      + '@media(min-width:1080px){#mqm-ref td.d{white-space:nowrap;text-indent:0;padding-left:10px}}'
      + '</style>'
      + '<div class="modal qref">'
      + '<h3 style="margin-bottom:2px">错误类型速查</h3>'
      + '<p class="page-s" style="margin:4px 0 14px">划中片段后按对应的类型打标；严重度按常见级别预置，可自行调。按 <b>Esc</b> 关闭。</p>'
      + '<table>'
      + '<tr><th>类型</th><th>判据</th><th class="sev">常见严重度</th></tr>'
      + window.MQM_ITEMS.map((it) => '<tr><td class="c">' + it.code + ' ' + esc(it.name) + '</td>'
        + '<td class="d">' + esc(it.def) + '</td>'
        + '<td class="sev ' + it.sev + '">' + it.sev + '</td></tr>').join('')
      + '<tr><td class="c">M0 ' + esc(window.MQM_M0.name) + '</td>'
      + '<td class="d">' + esc(window.MQM_M0.def) + '</td>'
      + '<td class="sev">—</td></tr>'
      + '</table>'
      + '<div class="m-actions"><a class="btn btn-ghost" href="MQM错误类型参考手册.html">完整手册（含练习）</a>'
      + '<button class="btn btn-primary" onclick="mqmQuickRefClose()">知道了（Esc）</button></div>'
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
/* Esc 关闭速查弹窗（用户要求：一键返回）；按住不放连按 Esc 时只响应一次 keyup */
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' && e.key !== 'Esc') return;
  const m = document.getElementById('mqm-ref');
  if (m && m.style.display === 'flex') window.mqmQuickRefClose();
});

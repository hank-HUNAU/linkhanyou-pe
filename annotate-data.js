/* annotate-data.js — 标注实训数据（加密载荷注水桩）
 * 语料已加密（见 secure.js）。本文件只是"注水桩"：登录解锁后明文放在本机
 * localStorage 里，由 unlock.js 的 window.mtpePayload() 提供（带 12 小时有效期），
 * 这里把它挂到全局；没有解锁就是空的——删掉校验代码也拿不到内容。
 */
(function () {
  var p = null;
  try {
    var raw = (typeof window.mtpePayload === 'function') ? window.mtpePayload() : null;
    p = raw ? JSON.parse(raw) : null;
  } catch (e) {}
  if (!p) {
    window.CORPUS_PAIRS = []; window.SEEDS = []; window.PRE = [];
    window.FLAGS = []; window.SCHEME = [];
    return;
  }
  window.CORPUS_PAIRS = p.pairs || [];
  window.SEEDS = p.seeds || [];
  window.PRE = p.pre || [];
  window.FLAGS = p.flags || [];
  window.SCHEME = p.scheme || [];
})();

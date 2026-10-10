/* annotate-data.js — 标注实训数据（加密载荷注水桩）
 * 语料已加密（见 secure.js）。本文件只是"注水桩"：登录解锁后明文临时放在本标签页
 * 的 sessionStorage 里，这里把它挂到全局；没有解锁就是空的。
 */
(function () {
  var p = null;
  try { p = JSON.parse(sessionStorage.getItem('mtpe_payload') || 'null'); } catch (e) {}
  if (!p) { window.CORPUS_PAIRS = []; window.SEEDS = []; window.PRE = []; window.FLAGS = []; window.SCHEME = []; return; }
  window.CORPUS_PAIRS = p.pairs || []; window.SEEDS = p.seeds || []; window.PRE = p.pre || [];
  window.FLAGS = p.flags || []; window.SCHEME = p.scheme || [];
})();

/* corpus.js — 历届真题训练集（加密载荷注水桩）
 * 语料已加密（见 secure.js）。本文件只是"注水桩"：登录解锁后明文临时放在本标签页
 * 的 sessionStorage 里，这里把它挂到全局；没有解锁就是空的。
 */
(function () {
  var p = null;
  try { p = JSON.parse(sessionStorage.getItem('mtpe_payload') || 'null'); } catch (e) {}
  if (!p) { window.CORPUS_TASKS = []; window.CORPUS_TAG_INDEX = {}; return; }
  window.CORPUS_TASKS = p.tasks || []; window.CORPUS_TAG_INDEX = p.tagIndex || {};
  if (typeof TASKS !== 'undefined') TASKS.push.apply(TASKS, window.CORPUS_TASKS);
})();

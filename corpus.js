/* corpus.js — 历届真题训练集（加密载荷注水桩）
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
  if (!p) { window.CORPUS_TASKS = []; window.CORPUS_TAG_INDEX = {}; return; }
  window.CORPUS_TASKS = p.tasks || [];
  window.CORPUS_TAG_INDEX = p.tagIndex || {};
  if (typeof TASKS !== 'undefined') TASKS.push.apply(TASKS, window.CORPUS_TASKS);
})();

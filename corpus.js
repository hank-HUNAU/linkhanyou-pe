/* corpus.js — 历届真题训练集（分片加密·异步注水桩）（自动生成，勿手改）
 * 数据不在本文件里：登录解锁后由 unlock.js 按需下载并解密对应分片，
 * 这里只把分片内容挂到全局。没有解锁 → 拿不到任何语料（删掉校验代码也没用）。
 * 完成时会 resolve window.__MTPE_READY__，页面脚本用 mtpeBoot() 等它就绪。
 */
(function () {
  var done = function () { window.__MTPE_READY__ = Promise.resolve(); };
  if (typeof window.mtpeEnsureSlice !== 'function') {
    window.CORPUS_TASKS = []; window.CORPUS_TAG_INDEX = {};
    done();
    return;
  }
  window.__MTPE_READY__ = Promise.all([window.mtpeEnsureSlice('tasks')]).then(function (r) {
    var d = r[0] || {};
    window.CORPUS_TASKS = d.tasks || [];
    window.CORPUS_TAG_INDEX = d.tagIndex || {};
    if (typeof TASKS !== 'undefined') TASKS.push.apply(TASKS, window.CORPUS_TASKS);
  }).catch(function () {
    window.__MTPE_SLICE_FAIL__ = true;
    window.CORPUS_TASKS = []; window.CORPUS_TAG_INDEX = {};
  });
})();

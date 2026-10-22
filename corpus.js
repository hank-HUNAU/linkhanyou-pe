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
  /* ③（2026-10-22）练习/仿真运行时也暴露金标准种子：加载 meta 片（与 annotate 页 annotate-data.js 同构），
     供 app.js 的 taskDifficulty 叠加 MQM 罚分精修。meta 仅含 seeds/flags/pre/stats，无密文，可公开。
     映射用 seg.mt.includes(span) 而非 task.pair（task.pair 是翻译方向，种子 k 才是句对键）。 */
  window.__MTPE_READY__ = Promise.all([window.mtpeEnsureSlice('tasks'), window.mtpeEnsureSlice('meta')]).then(function (r) {
    var d = r[0] || {};
    window.CORPUS_TASKS = d.tasks || [];
    window.CORPUS_TAG_INDEX = d.tagIndex || {};
    var meta = r[1] || {};
    window.SEEDS = meta.seeds || [];
    if (typeof TASKS !== 'undefined') TASKS.push.apply(TASKS, window.CORPUS_TASKS);
  }).catch(function () {
    window.__MTPE_SLICE_FAIL__ = true;
    window.CORPUS_TASKS = []; window.CORPUS_TAG_INDEX = {};
  });
})();

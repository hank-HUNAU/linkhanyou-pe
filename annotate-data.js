/* annotate-data.js — 标注实训数据（分片加密·异步注水桩）（自动生成，勿手改）
 * 数据不在本文件里：登录解锁后由 unlock.js 按需下载并解密对应分片，
 * 这里只把分片内容挂到全局。没有解锁 → 拿不到任何语料（删掉校验代码也没用）。
 * 完成时会 resolve window.__MTPE_READY__，页面脚本用 mtpeBoot() 等它就绪。
 */
(function () {
  var done = function () { window.__MTPE_READY__ = Promise.resolve(); };
  if (typeof window.mtpeEnsureSlice !== 'function') {
    window.CORPUS_PAIRS = []; window.SEEDS = []; window.PRE = [];
    window.FLAGS = []; window.SCHEME = [];
    done();
    return;
  }
  window.__MTPE_READY__ = Promise.all([window.mtpeEnsureSlice('pairs'), window.mtpeEnsureSlice('meta')]).then(function (r) {
    var p = r[0] || {}, m = r[1] || {};
    window.CORPUS_PAIRS = p.pairs || [];
    window.SEEDS = m.seeds || [];
    window.PRE = m.pre || [];
    window.FLAGS = m.flags || [];
    window.SCHEME = m.scheme || [];
    window.MTPE_STATS = m.stats || null;
  }).catch(function () {
    window.__MTPE_SLICE_FAIL__ = true;
    window.CORPUS_PAIRS = []; window.SEEDS = []; window.PRE = [];
    window.FLAGS = []; window.SCHEME = [];
  });
})();

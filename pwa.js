/* ============================================================
 * pwa.js — Service Worker 注册 +「安装到桌面」能力
 * 只在 http/https 下生效；本地双击打开（file://）时静默跳过，
 * 此时站点照常可用（只是没有离线缓存与安装入口）。
 * ============================================================ */
(function () {
  const isFile = location.protocol === 'file:';

  window.__mtpeInstallEvent = null;

  window.mtpeIsStandalone = function () {
    try {
      return window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true;
    } catch (e) { return false; }
  };

  window.mtpeCanInstall = function () {
    return !!window.__mtpeInstallEvent && !window.mtpeIsStandalone();
  };

  /* 返回 'accepted' | 'dismissed' | 'unavailable' */
  window.mtpeInstall = async function () {
    const ev = window.__mtpeInstallEvent;
    if (!ev) return 'unavailable';
    ev.prompt();
    let choice = null;
    try { choice = await ev.userChoice; } catch (e) {}
    window.__mtpeInstallEvent = null;
    document.dispatchEvent(new Event('mtpe-install-changed'));
    return choice && choice.outcome === 'accepted' ? 'accepted' : 'dismissed';
  };

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    window.__mtpeInstallEvent = e;
    document.dispatchEvent(new Event('mtpe-install-changed'));
  });

  window.addEventListener('appinstalled', function () {
    window.__mtpeInstallEvent = null;
    document.dispatchEvent(new Event('mtpe-install-changed'));
  });

  if (isFile || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      window.__mtpeSW = reg;
      document.dispatchEvent(new Event('mtpe-sw-ready'));
    }).catch(function (err) {
      console.warn('Service Worker 注册失败（不影响正常使用）：', err && err.message);
    });
  });
})();

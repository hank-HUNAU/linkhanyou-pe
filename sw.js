/* ============================================================
 * sw.js — Service Worker（PWA 离线外壳）
 * 策略（校园网实测：单独一个 1.2MB 文件要下 25 秒，所以策略核心是"少下、只下一次"）：
 *   · HTML / JS / CSS / JSON：网络优先 + 缓存兜底
 *     → 部署后刷新即见新版；更关键的是避免"新 HTML 配旧 JS"的版本错配
 *       （旧策略 JS 走缓存优先，部署后第一屏可能是新页面挂旧脚本，按钮点了没反应）
 *     → 浏览器 HTTP 缓存仍在（ETag 命中即 304），并不会重复下载这几百 KB
 *   · 图片（图标）：缓存优先 + 后台更新 → 秒开且不占流量
 *   · secure.js（语料密文）只在登录那一刻拉取，且随后进入 HTTP 缓存/离线缓存，
 *     不会因为"网络优先"而反复下载 426KB
 *   · 预缓存只放"轻外壳"，不放 secure.js
 * 注意：语料是加密的（secure.js 密文 + 登录后本机明文），缓存里只有密文，
 *      没登录拿不到内容，与本站的安全边界不冲突。
 * 只在 http/https 下生效；本地双击打开（file://）时不会注册。
 * ============================================================ */
/* 改动站点文件后把版本号 +1：新 SW 激活时会删掉旧缓存，缓存不会越积越旧 */
const CACHE = 'mtpe-shell-v3';

/* 轻外壳：不含 secure.js（按需下载，由 stale-while-revalidate 自动缓存） */
const CORE = [
  './',
  './index.html',
  './practice.html',
  './annotate.html',
  './pe-exam.html',
  './MQM错误类型参考手册.html',
  './style.css',
  './annotate.css',
  './pe-exam.css',
  './nav.js',
  './pwa.js',
  './home.js',
  './app.js',
  './unlock.js',
  './data.js',
  './corpus.js',
  './annotate-data.js',
  './annotate.js',
  './pe-exam.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

function putSafe(cache, req, res) {
  try { cache.put(req, res).catch(function () {}); } catch (e) {}
}

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const base = self.location.href;
    // 逐个添加：个别文件缺失不影响整体安装
    await Promise.all(CORE.map((u) =>
      cache.add(new Request(new URL(u, base).href, { cache: 'reload' })).catch(() => {})
    ));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;   // 站外请求不接管

  /* ① 图片：缓存优先 + 后台更新（图标换得少，秒开更重要） */
  const isImage = /\.(png|jpe?g|svg|webp|ico)$/i.test(url.pathname);
  if (isImage) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req, { ignoreSearch: true });
      const fresh = fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') putSafe(cache, req, res.clone());
        return res;
      }).catch(() => null);
      if (hit) return hit;
      const res = await fresh;
      return res || Response.error();
    })());
    return;
  }

  /* ② 页面与脚本/样式：网络优先 + 缓存兜底（保证版本一致、断网可用） */
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(req);
      if (res && res.status === 200 && res.type === 'basic') putSafe(cache, req, res.clone());
      return res;
    } catch (err) {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') {
        const shell = await cache.match(new URL('./index.html', self.location.href).href);
        if (shell) return shell;
      }
      return Response.error();
    }
  })());
});

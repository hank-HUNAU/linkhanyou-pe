/* ============================================================
 * sw.js — Service Worker（PWA 离线外壳）
 * 策略（校园网实测：单独一个 1.2MB 文件要下 25 秒，所以策略核心是"少下、只下一次"）：
 *   · 页面导航：网络优先 + 缓存兜底 → 部署后刷新即见新版，断网仍能开
 *   · 其它同源资源：缓存优先 + 后台更新（stale-while-revalidate）
 *     → secure.js 这类大文件只在第一次真正下载，之后每次打开都从本地秒开
 *   · 预缓存只放"轻外壳"，不放 secure.js：已登录时根本用不到它
 * 注意：语料是加密的（secure.js 密文 + 登录后本机明文），缓存里只有密文，
 *      没登录拿不到内容，与本站的安全边界不冲突。
 * 只在 http/https 下生效；本地双击打开（file://）时不会注册。
 * ============================================================ */
const CACHE = 'mtpe-shell-v2';

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

  /* ① 页面导航：网络优先（部署后刷新即见新版），断网回落到缓存 */
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch(req);
        if (res && res.status === 200 && res.type === 'basic') putSafe(cache, req, res.clone());
        return res;
      } catch (err) {
        const hit = await cache.match(req, { ignoreSearch: true });
        if (hit) return hit;
        const shell = await cache.match(new URL('./index.html', self.location.href).href);
        return shell || Response.error();
      }
    })());
    return;
  }

  /* ② 静态资源：缓存优先 + 后台更新（大文件因此只下一次） */
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
});

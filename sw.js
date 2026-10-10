/* ============================================================
 * sw.js — Service Worker（PWA 离线外壳）
 * 策略：安装时预缓存整站外壳；运行时同源 GET 一律「网络优先、缓存兜底」。
 *   · 在线：始终拿最新版本（部署后刷新即生效，不会卡在旧缓存）
 *   · 离线：命中缓存继续用，机房断网也能练习
 * 注意：语料是加密的（secure.js 密文 + 登录后 localStorage 明文），
 *      缓存里只有密文，Student 未登录拿不到内容，与本站的安全边界不冲突。
 * 只在 http/https 下生效；本地双击打开（file://）时不会注册。
 * ============================================================ */
const CACHE = 'mtpe-shell-v1';

/* 站点外壳（含登录解锁所必需的文件） */
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
  './secure.js',
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

  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res && res.status === 200 && res.type === 'basic') {
        const cache = await caches.open(CACHE);
        cache.put(req, res.clone());
      }
      return res;
    } catch (err) {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') {
        const shell = await cache.match(new URL('./index.html', self.location.href).href);
        if (shell) return shell;
      }
      throw err;
    }
  })());
});

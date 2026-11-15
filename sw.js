/* 安装工程消耗量查询器 · Service Worker
 * 目标：装到安卓桌面后断网也能用；同时不阻塞应用更新。
 * 缓存策略：
 *   - 页面导航（HTML）：network-first，断网时回退到缓存的 index.html
 *   - 静态资源（图标/manifest）：cache-first，命中即返回
 * 改了 index.html 或图标后，请把 VERSION 改一下再推送，旧缓存会自动清掉。
 */
const VERSION = '2026-11-15.1';
const CACHE = `quota-${VERSION}`;

/* 使用相对路径，保证仓库放在 GitHub Pages 的子路径（/repo-name/）下也能正常工作 */
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      /* 单个文件缺失不应让整次安装失败 */
      .then((cache) => Promise.allSettled(CORE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  /* 页面导航：优先网络，拿到最新的单文件应用；离线时用缓存 */
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html').then((hit) => hit || caches.match('./')))
    );
    return;
  }

  /* 静态资源：缓存优先，后台补新 */
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
    })
  );
});

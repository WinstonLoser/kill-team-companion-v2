// Kill Team 战棋助手 Service Worker（Story 4.2）
// Stale-while-revalidate：缓存优先（离线可用），后台更新缓存。
// 运行时缓存（非 app-shell 预缓存）：首次访问的每个 GET 资源被缓存；后续离线可从缓存恢复。
// 注：无 content-hash 版本化（v1 可接受）；部署后旧 asset 经 activate 清理旧 cache key 时清除。
const CACHE = 'kt-companion-v2';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()), // P7：claim 在 waitUntil 内
  );
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith('http')) return;
  // P6：仅同源缓存，避免第三方资源污染
  try {
    if (new URL(e.request.url).origin !== self.location.origin) return;
  } catch { return }
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetchPromise = fetch(e.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE).then((cache) => cache.put(e.request, clone));
          }
          return response;
        })
        .catch(() => cached || Response.error()); // P7：无缓存+离线 → 明确错误响应
      return cached || fetchPromise;
    }),
  );
});

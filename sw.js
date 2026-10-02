const CACHE_VERSION = 'shenjia-v0.7.0';
const APP_SHELL = [
  './',
  './index.html',
  './app.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-180.png',
  './icons/icon-512.png'
];

// 本地开发：SW 完全不注册（见 13-main.js），这里的分支只是兜底。
const LOCAL_DEV = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);

self.addEventListener('install', e => {
  // 关键：必须用 cache:'reload' 强制走网络。
  // 否则 SW 安装期间的请求会先被【旧 SW】拦截，返回旧缓存里的文件，
  // 于是"新缓存"被塞进旧资源 —— 这时再改 CACHE_VERSION 也毫无效果，
  // 表现为「缓存名变了但页面永远不变」。这是 Service Worker 的经典陷阱。
  e.waitUntil(
    caches.open(CACHE_VERSION).then(async c => {
      await Promise.all(APP_SHELL.map(async url => {
        try{
          const req = new Request(url, {cache: 'reload'});
          const res = await fetch(req);
          if(res && res.ok) await c.put(req, res);
        }catch(err){ /* 单个资源失败不阻断安装 */ }
      }));
      await self.skipWaiting();
    })
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if(e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin !== location.origin) return;

  // 线上：缓存优先 + 后台更新（保证装到主屏幕后离线可用、且下次打开就是新的）
  e.respondWith(
    caches.match(req, {ignoreSearch: true}).then(hit => {
      const refresh = fetch(req).then(res => {
        if(res && res.ok){
          const clone = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(req, clone));
        }
        return res;
      }).catch(() => hit);
      return hit || refresh;
    })
  );
});
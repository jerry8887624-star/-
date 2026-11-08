/* 離線快取：網頁先試網路（不讀 HTTP 快取，4 秒逾時才用手機裡的版本），其他資源先用快取並在背景更新 */
const V='nest-131391955c';
const CORE=['./','index.html','manifest.webmanifest','css/app.css','js/main.js','js/world.js','js/models.js','js/terrain.js','js/avatar.js','js/char.js','js/net.js','js/chatfilter.js','js/data.js','js/audio.js','js/changes.js','js/update.js','vendor/three.module.min.js','vendor/GLTFLoader.js','vendor/BufferGeometryUtils.js','vendor/SkeletonUtils.js','icons/icon.svg','icons/icon-192.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(CORE.map(u=>new Request(u,{cache:'reload'})))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('nest-')&&k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
const put=(req,res)=>{if(res&&(res.ok||res.type==='opaque')){const c=res.clone();caches.open(V).then(x=>x.put(req,c))}return res};
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);
  if(u.pathname.endsWith('/changes.json'))return;
  if(u.pathname.includes('/api/')||u.pathname.endsWith('/ws'))return; // 連線：一律走網路
  if(u.pathname.includes('/audio/'))return; // 音樂直接走網路（iPhone 播放需要分段下載）
  if(r.mode==='navigate'){e.respondWith(new Promise(res=>{let done=false;
    const t=setTimeout(()=>caches.match('index.html').then(m=>{if(!done&&m){done=true;res(m)}}),4000);
    fetch(r.url,{cache:'no-store',credentials:'same-origin'}).then(n=>{clearTimeout(t);put('index.html',n.clone());if(!done){done=true;res(n)}})
      .catch(()=>{clearTimeout(t);caches.match('index.html').then(m=>{if(!done){done=true;res(m||Response.error())}})})}));return}
  // Polyfork 線上動作（走路、待機、跑步）：存一份在手機裡，下次沒網路也能動
  if(u.hostname==='polyfork.dev'&&u.pathname.startsWith('/cdn/anim-')){e.respondWith(caches.match(r).then(m=>m||fetch(r).then(x=>put(r,x))));return}
  if(u.origin!==location.origin&&!/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname))return;
  // 程式與樣式：先網路（確保新版一起生效），失敗才用快取
  // 網路回傳錯誤或連不上時用快取；快取也沒有就再試一次網路（絕對不能回傳空的，否則整頁會沒有樣式）
  if(u.origin===location.origin&&/\.(js|css)$/.test(u.pathname)){e.respondWith(fetch(r,{cache:'no-store'}).then(x=>x.ok?put(r,x):caches.match(r).then(m=>m||x)).catch(()=>caches.match(r).then(m=>m||fetch(r))));return}
  e.respondWith(caches.match(r).then(m=>{const n=fetch(r).then(x=>put(r,x)).catch(()=>m||Response.error());return m||n}));
});

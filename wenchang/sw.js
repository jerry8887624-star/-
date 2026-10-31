/* 離線快取：網頁先試網路（不讀 HTTP 快取，4 秒逾時才用手機裡的版本），其他資源先用快取並在背景更新 */
const V='wc-b5f9da6bdc';
const CORE=['./','index.html','manifest.webmanifest','css/app.css','js/main.js','js/scene.js','js/avatar.js','js/data.js','js/net.js','js/config.js','js/chatfilter.js','js/changes.js','js/update.js','data/qian.js','vendor/three.module.min.js','icons/icon.svg','icons/icon-192.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(CORE.map(u=>new Request(u,{cache:'reload'})))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('wc-')&&k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
const put=(req,res)=>{if(res&&(res.ok||res.type==='opaque')){const c=res.clone();caches.open(V).then(x=>x.put(req,c))}return res};
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);
  if(u.pathname.endsWith('/changes.json'))return;
  if(u.pathname.includes('/audio/'))return; // 音樂直接走網路（iOS 播放需要分段下載，不經離線快取） // 更新紀錄一律走網路，才能偵測新版
  if(r.mode==='navigate'){e.respondWith(new Promise(res=>{let done=false;
    const t=setTimeout(()=>caches.match('index.html').then(m=>{if(!done&&m){done=true;res(m)}}),4000);
    fetch(r.url,{cache:'no-store',credentials:'same-origin'}).then(n=>{clearTimeout(t);put('index.html',n.clone());if(!done){done=true;res(n)}})
      .catch(()=>{clearTimeout(t);caches.match('index.html').then(m=>{if(!done){done=true;res(m||Response.error())}})})}));return}
  if(u.origin!==location.origin&&!/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname))return;
  // 程式與樣式：先網路（確保新版一起生效），失敗才用快取
  if(u.origin===location.origin&&/\.(js|css)$/.test(u.pathname)){e.respondWith(fetch(r,{cache:'no-store'}).then(x=>put(r,x)).catch(()=>caches.match(r)));return}
  e.respondWith(caches.match(r).then(m=>{const n=fetch(r).then(x=>put(r,x)).catch(()=>m);return m||n}));
});

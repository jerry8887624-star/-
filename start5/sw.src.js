/* 離線快取：網頁先試網路（不讀 HTTP 快取，4 秒逾時才用手機裡的版本），其他資源先用快取並在背景更新 */
const V='app-__VERSION__';
const CORE=['./','index.html','manifest.webmanifest','icons/icon.svg','icons/icon-192.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(CORE.map(u=>new Request(u,{cache:'reload'})))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('app-')&&k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
const put=(req,res)=>{if(res&&(res.ok||res.type==='opaque')){const c=res.clone();caches.open(V).then(x=>x.put(req,c))}return res};
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);
  if(u.pathname.endsWith('/changes.json'))return;
  if(r.mode==='navigate'){e.respondWith(new Promise(res=>{let done=false;
    const t=setTimeout(()=>caches.match('index.html').then(m=>{if(!done&&m){done=true;res(m)}}),4000);
    fetch(r.url,{cache:'no-store',credentials:'same-origin'}).then(n=>{clearTimeout(t);put('index.html',n.clone());if(!done){done=true;res(n)}})
      .catch(()=>{clearTimeout(t);caches.match('index.html').then(m=>{if(!done){done=true;res(m||Response.error())}})})}));return}
  if(u.origin!==location.origin&&!/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname))return;
  e.respondWith(caches.match(r).then(m=>{const n=fetch(r).then(x=>put(r,x)).catch(()=>m);return m||n}));
});

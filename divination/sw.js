/* 靈犀離線快取：第一次開啟後把主程式、萬年曆、紫微元件存在手機裡；之後沒網路也能用，開啟也更快。
   網頁本身「先試網路、4 秒沒回應就用手機裡的版本」，所以有網路時總是拿到最新版。 */
const V='lingxi-77f432b044';
const CORE=['./','index.html','manifest.webmanifest','vendor/lunar.min.js','vendor/iztro.min.js','icons/icon-192.png','icons/icon-180.png','icons/logo.svg','img/guangong.jpg','img/bg-day.jpg','img/bg-night.jpg'];
// 安裝時一律向伺服器重抓（cache:'reload'），避免把瀏覽器快取裡的舊版存進來
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(CORE.map(u=>new Request(u,{cache:'reload'})))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('lingxi-')&&k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
const put=(req,res)=>{if(res&&(res.ok||res.type==='opaque')){const c=res.clone();caches.open(V).then(x=>x.put(req,c))}return res};
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;
  const u=new URL(r.url);
  if(r.mode==='navigate'){
    e.respondWith(new Promise(res=>{let done=false;
      const fall=()=>caches.match('index.html').then(m=>{if(!done&&m){done=true;res(m)}});
      const t=setTimeout(fall,4000);
      // 網頁本身不走瀏覽器的 HTTP 快取（GitHub Pages 會快取 10 分鐘），有網路就一定拿到最新版
      fetch(r.url,{cache:'no-store',credentials:'same-origin'}).then(n=>{clearTimeout(t);put('index.html',n.clone());if(!done){done=true;res(n)}})
        .catch(()=>{clearTimeout(t);caches.match('index.html').then(m=>{if(!done){done=true;res(m||Response.error())}})});
    }));return}
  if(u.pathname.endsWith('/changes.json'))return; // 更新紀錄一律走網路
  const same=u.origin===location.origin, font=/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname), cdn=u.hostname==='cdn.jsdelivr.net';
  if(!same&&!font&&!cdn)return;
  // 圖片、程式庫、字型：先用手機裡的，同時在背景更新
  e.respondWith(caches.match(r).then(m=>{const n=fetch(r).then(x=>put(r,x)).catch(()=>m);return m||n}));
});

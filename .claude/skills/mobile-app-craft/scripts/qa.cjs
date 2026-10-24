// 用法：node qa.cjs <index.html 路徑或 http 網址> <截圖輸出資料夾> [--views=home,list] [--seed=seed.json] [--widths=360,390] [--zooms=1,1.45]
// 每個 view × 淺／深色 × 寬度 × 字級：截圖、檢查水平溢出與超出卡片的元素、收集錯誤；有 axe-core 時跑 WCAG AA。
const {launch}=require('./pw.cjs'),fs=require('fs'),path=require('path');
const arg=k=>(process.argv.find(a=>a.startsWith(`--${k}=`))||'').split('=').slice(1).join('=');
const target=process.argv[2],out=path.resolve(process.argv[3]||'qa-out');fs.mkdirSync(out,{recursive:true});
const url=/^https?:/.test(target)?target:'file://'+path.resolve(target);
const seed=arg('seed')?JSON.parse(fs.readFileSync(arg('seed'),'utf8')):{};
const widths=(arg('widths')||'360,390').split(',').map(Number),zooms=(arg('zooms')||'1,1.45').split(',').map(Number);
let AXE=null;for(const p of [process.cwd(),path.dirname(target)]){try{AXE=fs.readFileSync(require.resolve('axe-core/axe.min.js',{paths:[p]}),'utf8');break}catch(e){}}
(async()=>{const b=await launch();const report=[];
  let views=(arg('views')||'').split(',').filter(Boolean);
  for(const scheme of ['light','dark'])for(const w of widths)for(const z of zooms){
    const ctx=await b.newContext({viewport:{width:w,height:800},deviceScaleFactor:2,isMobile:true,hasTouch:true,colorScheme:scheme});const p=await ctx.newPage();const errs=[];
    p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/ERR_FAILED|ERR_BLOCKED/.test(m.text()))errs.push(m.text().slice(0,160))}); // 測試封鎖外部網路造成的載入失敗不算錯誤
    await p.route('**/*',r=>{const u=r.request().url();return u.startsWith('file:')||u.startsWith('http://localhost')||u.startsWith('http://127.')?r.continue():r.abort()});
    await p.addInitScript(([s,z])=>{try{sessionStorage.setItem('qa','1');for(const[k,v]of Object.entries(s.local||{}))localStorage.setItem(k,typeof v==='string'?v:JSON.stringify(v));for(const[k,v]of Object.entries(s.session||{}))sessionStorage.setItem(k,v);if(z>1)document.addEventListener('DOMContentLoaded',()=>{document.documentElement.style.zoom=z})}catch(e){}},[seed,z]);
    await p.goto(url);await p.waitForTimeout(1200);
    if(!views.length)views=await p.evaluate(()=>[...document.querySelectorAll('section.view[id^="v-"]')].map(s=>s.id.slice(2)));
    for(const v of views){
      await p.evaluate(v=>{location.hash=v;const b=document.querySelector(`[data-go="${v}"],[data-sub="${v}"]`);if(b)b.click();window.dispatchEvent(new HashChangeEvent('hashchange'))},v);await p.waitForTimeout(500);
      // 新版 Chromium 在 CSS zoom 下回傳的座標已是畫面座標，直接和視窗寬比
      const r=await p.evaluate(()=>{const W=innerWidth,issues=[];
        if(document.documentElement.scrollWidth>innerWidth+1)issues.push(`頁面可水平捲動 ${document.documentElement.scrollWidth}>${innerWidth}`);
        for(const el of document.querySelectorAll('.view:not([hidden]) *')){const q=el.getBoundingClientRect();if(!q.width||getComputedStyle(el).position==='fixed')continue;
          if(q.right>W+1||q.left<-1){issues.push(`超出畫面：${el.tagName.toLowerCase()}.${[...el.classList].join('.')}「${(el.textContent||'').trim().slice(0,16)}」`);if(issues.length>6)break}}
        return issues});
      let axe=[];if(AXE){await p.evaluate(AXE).catch(()=>{});axe=await p.evaluate(async()=>window.axe?(await axe.run(document,{runOnly:['wcag2a','wcag2aa']})).violations.map(x=>`${x.id}×${x.nodes.length}`):[]).catch(()=>[])}
      const shot=`${v}_${scheme}_${w}_${z}.png`;await p.screenshot({path:path.join(out,shot)});
      report.push({view:v,scheme,w,z,issues:r,axe,shot});}
    if(errs.length)report.push({view:'*',scheme,w,z,issues:errs.map(e=>'錯誤：'+e),axe:[]});await ctx.close()}
  await b.close();
  const bad=report.filter(r=>r.issues.length||r.axe.length);
  fs.writeFileSync(path.join(out,'qa.json'),JSON.stringify(report,null,1));
  console.log(`截圖 ${report.filter(r=>r.shot).length} 張 → ${out}`);console.log(bad.length?bad.map(r=>`✗ ${r.view} ${r.scheme} ${r.w}px ×${r.z}：${[...r.issues,...r.axe.map(a=>'axe '+a)].join('；')}`).join('\n'):'✓ 沒有發現溢出、錯誤或無障礙問題');
})();

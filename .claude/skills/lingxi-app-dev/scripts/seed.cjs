// 用法：const {launch, seed}=require('<skill>/scripts/seed.cjs');
// const {b,p}=await launch({scheme:'dark',width:360}); await seed(p,{zoom:1.45}); await p.goto(URL);
const fs=require('fs'),path=require('path');
const {chromium,devices}=require('playwright');
const ROOT=process.env.LINGXI_ROOT||path.resolve(__dirname,'../../../../divination');
function latestVer(){try{return JSON.parse(fs.readFileSync(path.join(ROOT,'data/changes.json'),'utf8'))[0].v}catch(e){return ''}}
async function launch({scheme='light',width=390,height=844,device='iPhone 13',userAgent}={}){
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--headless=new'],headless:false});
  const ctx=await b.newContext({...devices[device],viewport:{width,height},colorScheme:scheme,...(userAgent?{userAgent}:{})});
  const p=await ctx.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));
  await p.route('**/*',r=>{const u=r.request().url();return u.startsWith('file:')||u.startsWith('http://localhost')?r.continue():r.abort()});
  return {b,ctx,p};
}
async function seed(p,{zoom=1,bold=false,sample=false,tips=true,ver=latestVer(),profiles}={}){
  await p.addInitScript(([z,bold,sample,tips,ver,profiles])=>{
    sessionStorage.setItem('gx_sp','1');sessionStorage.setItem('gx_wel','1');
    if(ver)localStorage.setItem('gx_ver',JSON.stringify(ver));
    if(tips)localStorage.setItem('gx_tips',JSON.stringify({overview:1,tarot:1,qian:1,name:1,fengshui:1,ziwei:1,qimen:1,zeri:1,family:1,journal:1,meihua:1}));
    if(z>1||bold)localStorage.setItem('gx_fs',JSON.stringify({z,b:bold}));
    localStorage.setItem('gx_profiles',JSON.stringify(profiles||[{sur:'林',given:'書言',gender:'男',date:'1985-02-16',hour:10,sample}]));
  },[zoom,bold,sample,tips,ver,profiles||null]);
}
// 切分頁：先讓收起的分頁列回來
async function tab(p,group,view){await p.evaluate(()=>document.body.classList.remove('tabhide'));await p.waitForTimeout(320);await p.tap(`.tab[data-tab="${group}"]`);if(view)await p.tap(`[data-sub="${view}"]`);await p.waitForTimeout(400)}
module.exports={launch,seed,tab,latestVer,FILE_URL:'file://'+path.join(ROOT,'index.html')};

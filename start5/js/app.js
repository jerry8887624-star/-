/* ===== App 內容：先動五分鐘 ===== */
const GROUPS=[
  {k:'home',n:'開始',icon:'▶︎',views:['home'],tag:'不用做完，先開始就好'},
  {k:'log',n:'紀錄',icon:'◎',views:['log'],tag:'每一次開始都算數'},
  {k:'tips',n:'心法',icon:'✎',views:['tips'],tag:'為什麼五分鐘有用'}];
const TITLES={home:'先動五分鐘',log:'我的火苗',tips:'起步心法'},SUBS={home:'START IN 5',log:'不算連續天數',tips:'拖延不是懶'};

/* ---------- 把任務拆成「小到不好意思不做」的第一步 ---------- */
const CATS=[
  {re:/程式|code|bug|debug|網站|app|系統|部署/i,steps:['打開專案，只看一眼上次停在哪','把要改的地方寫成一行待辦','只改一個最小的地方，存檔'],tiny:['打開電腦，開啟編輯器就好','只把專案資料夾打開','讀上次寫的最後 10 行']},
  {re:/回信|回覆|訊息|信件|email|mail|電話|聯絡|道歉|邀請|約/i,steps:['打開對話框，只打第一句','先寫三個重點，不用修飾','讀一遍，按下送出'],tiny:['只把對方的訊息點開','打下「你好」兩個字就好','先決定要說的一句話']},
  {re:/繳|報稅|申請|填|表單|預約|帳單|文件|辦理|保險|退貨/,steps:['把需要的資料找出來放桌上','打開網站或表格，看第一欄要填什麼','只填第一欄'],tiny:['只打開那個網站','把相關的信或單據找出來','把要辦的事寫在便條紙上']},
  {re:/打掃|整理|收拾|洗|倒垃圾|房間|衣服|碗|桌|冰箱|衣櫃|拖地|吸塵/,steps:['拿一個袋子，先撿 5 樣垃圾','只整理眼前一平方公尺','把一樣東西放回它的位置'],tiny:['站起來，走到那個地方','只撿起一樣東西','放一首歌，先站著看一下']},
  {re:/運動|跑步|健身|瑜伽|伸展|走路|散步|游泳|重訓|騎車|深蹲/,steps:['換上運動服','做 10 下最簡單的動作','出門走到巷口就好'],tiny:['把運動鞋拿出來放門口','只換上褲子','站起來伸個懶腰']},
  {re:/讀|唸|念書|考|複習|背|單字|上課|課本|講義|學|題目/,steps:['翻到上次讀到的那一頁','只讀一頁，劃一個重點','做一題最簡單的題目'],tiny:['把書拿出來放在桌上','只翻開書','讀第一句就好']},
  {re:/報告|論文|文章|企劃|簡報|作業|稿|寫|履歷|心得|日記|提案/,steps:['打開檔案，只寫下標題','列出 3 個想講的重點（關鍵字就好）','挑最簡單的一段，寫爛也沒關係'],tiny:['打開電腦，開一個空白檔案','只把檔名取好','寫一句「這份要講的是……」']},
  {re:/畫|練習|琴|吉他|唱|拍照|剪片|影片|設計|手作|烘焙|煮/,steps:['把工具拿出來擺好','只做 1 分鐘暖身','做最簡單的一小段'],tiny:['只把工具拿出來','打開教學或上次的作品看一眼','坐到位置上就好']}];
const GEN={steps:t=>[`把「${t}」需要的東西拿到面前`,`寫下「${t}」的第一個動作`,'只做那個動作，做到計時結束'],tiny:['站起來，走到要做事的地方','把手機翻面放遠一點','深呼吸三次，然後看著它']};
function breakdown(t){const i=CATS.findIndex(c=>c.re.test(t)),c=CATS[i];return c?{cat:i,steps:c.steps.slice(),tiny:c.tiny.slice()}:{cat:-1,steps:GEN.steps(t),tiny:GEN.tiny.slice()}}
const PICKS=['寫報告','打掃房間','回訊息','讀書','運動','繳帳單'];

/* ---------- 狀態 ---------- */
const sess={get:()=>store.get('s5_sess',null),set:v=>store.set('s5_sess',v),clear:()=>{try{localStorage.removeItem('s5_sess')}catch(e){}}};
let plan=store.get('s5_plan',null),draft='';
const recs=()=>store.get('s5_recs',[]);
const saveRecs=r=>store.set('s5_recs',r.slice(-500));
const totalMin=r=>Math.round(r.reduce((a,x)=>a+(x.sec||0),0)/60);
const dur=()=>store.get('s5_dur',5);
const fmt=s=>{s=Math.max(0,Math.ceil(s));return`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`};
const dKey=ts=>{const d=new Date(ts);return`${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`};
const nice=ts=>{const d=new Date(ts),n=new Date();const day=dKey(ts)===dKey(n)?'今天':dKey(ts)===dKey(n-864e5)?'昨天':`${d.getMonth()+1}/${d.getDate()}`;return`${day} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`};

/* ---------- 小火苗（陪伴角色）---------- */
const ember=(cls='',st=curStage())=>`<svg class="ember ${cls} st${st}" viewBox="-12 -14 144 170" aria-hidden="true"><defs><radialGradient id="eg${cls}" cx="50%" cy="70%" r="65%"><stop offset="0" stop-color="#FFE7A3"/><stop offset=".55" stop-color="#FF9E4A"/><stop offset="1" stop-color="#F0602E"/></radialGradient><filter id="eb${cls}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter></defs>
  <ellipse class="eglow" cx="60" cy="100" rx="${52+st*4}" ry="${44+st*4}" fill="#FF9A4A" opacity=".24" filter="url(#eb${cls})"/>${emberExtra(st,'back')}
  <g class="ebody" ${st===0?'transform="translate(60 132) scale(.78) translate(-60 -132)"':''}><path d="M60 8C70 34 98 52 98 94a38 38 0 0 1-76 0c0-22 12-32 18-46 4 12 10 16 14 16C52 46 50 28 60 8z" fill="url(#eg${cls})"/>
  <path d="M60 64c6 12 20 18 20 34a20 20 0 0 1-40 0c0-12 10-18 20-34z" fill="#FFF1C8" opacity=".75"/>
  <g class="eface"><ellipse class="eye" cx="51" cy="98" rx="3.6" ry="4.6" fill="#5A2A10"/><ellipse class="eye" cx="69" cy="98" rx="3.6" ry="4.6" fill="#5A2A10"/><path d="M53 108q7 6 14 0" fill="none" stroke="#5A2A10" stroke-width="2.6" stroke-linecap="round"/></g></g>${emberExtra(st,'front')}</svg>`;

/* ---------- 頁面 ---------- */
const render={
  home:()=>{const r=recs();
    if(plan)return planCard()+todoCard()+recentCard(r);
    return `<div class="card hero"><div class="hero-h"><label class="h3" for="task">你在拖延什麼事？</label><div class="hero-ember">${ember('h')}</div></div><p class="muted small">說一件就好，我幫你找出最小的第一步。</p>
      <input id="task" class="inp" maxlength="40" autocomplete="off" enterkeyhint="go" placeholder="例如：寫期末報告" value="${esc(draft)}">
      <div class="chips" role="group" aria-label="常見的事">${PICKS.map(p=>`<button class="chip" data-a="pick" data-v="${p}">${p}</button>`).join('')}</div>
      <button class="btn primary block big" data-a="plan">幫我找出第一步</button></div>
      ${r.length?`<div class="card stat-row"><div><b>${r.length}</b><span>次開始</span></div><div><b>${totalMin(r)}</b><span>分鐘</span></div><button class="btn" data-go="log">看紀錄</button></div>`:''}
      ${todoCard()}${recentCard(r)}${installCta()}`},
  log:()=>{const r=recs();
    return `${stageCard(r.length)}${weekCard()}<div class="card jar-card">${jar(r.length)}<div class="jar-txt"><span class="eyebrow">累積</span><b class="bign">${r.length}</b><span>次開始</span><p class="muted small">專注 ${totalMin(r)} 分鐘・完成 ${r.filter(x=>x.done).length} 輪</p></div></div>
      <p class="note">這裡不算「連續天數」。中斷不會歸零，每一次開始都會留下一顆火苗。</p>
      ${moodCard(r)}${month(r)}
      <div class="card"><h3 class="h3">最近開始的事</h3>${r.length?`<ul class="rlist">${r.slice(-12).reverse().map(x=>`<li><div><b>${esc(x.task)}</b><small>${nice(x.ts)}・${x.sec>=60?Math.round(x.sec/60)+' 分鐘':(x.sec||0)+' 秒'}${x.done?'・完成一輪':''}</small></div><button class="btn sm" data-a="again" data-v="${esc(x.task)}" aria-label="再開始一次：${esc(x.task)}">再一次</button></li>`).join('')}</ul>`:`<p class="muted">還沒有紀錄。<button class="linkbtn" data-go="home">去開始第一次 →</button></p>`}</div>
      <button class="btn block" data-a="rem">⏰ 設定每日提醒</button>
      ${r.length?'<button class="linkbtn danger" data-a="wipe">清除所有紀錄</button>':''}`},
  tips:()=>TIPS.map(([t,d,src])=>`<details class="card tip"><summary><b>${t}</b></summary><p>${d}</p>${src?`<small class="muted">參考：${src}</small>`:''}</details>`).join('')
    +`<div class="card"><h3 class="h3">怎麼用最有效</h3><ol class="how"><li>寫下逃避的事，按「幫我找出第一步」。</li><li>覺得還是太難，就按「再小一點」，直到你覺得「這個我可以」。</li><li>按開始，只做這一步。時間到想停就停。</li><li>通常你會想繼續——那就選「再 5 分鐘」或「不計時繼續」。</li></ol></div>`};

const TIPS=[
 ['拖延不是懶，是在躲不舒服的感覺','研究發現，拖延多半是「短期情緒調節」：任務讓人焦慮、無聊或怕做不好，於是先逃開讓心情好一點。所以解法不是逼自己，而是讓開始變得不可怕。','Sirois & Pychyl（2013），Social and Personality Psychology Compass'],
 ['最難的是開始，不是過程','只要承諾 5 分鐘，大腦就不會把整件事當成一座山。真正開始後，多數人會發現沒那麼糟，自然想繼續做下去。',''],
 ['第一步要小到「不好意思不做」','行為設計研究指出：動機不穩定時，把行為縮到極小（例如只打開檔案），比靠意志力更可靠。','BJ Fogg《Tiny Habits》（2019）'],
 ['有人陪，比較做得下去','「陪伴工作」（body doubling）是很多人實際用的方法：身邊有人一起專注，就比較不容易分心。小火苗就是陪你的那個人。',''],
 ['原諒自己，下次更容易開始','一項針對大學生的研究：考前原諒自己拖延的人，下一次考試前拖延得比較少。責怪自己只會讓任務更可怕。','Wohl, Pychyl & Bennett（2010），Personality and Individual Differences']];

function planCard(){const p=plan,step=p.cur;const d=dur();
  return `<div class="card plan"><div class="plan-top"><span class="eyebrow">要開始的事</span><button class="linkbtn" data-a="reset">換一件事</button></div>
    <h3 class="h3 ptask">${esc(p.task)}</h3>
    <div class="first" aria-live="polite"><span class="tag">第一步${p.lv?`・縮小 ${p.lv} 次`:''}</span><p id="firstStep">${esc(step)}</p></div>
    <div class="row2"><button class="btn" data-a="smaller">太難了，再小一點</button><button class="btn" data-a="edit">我自己寫</button></div>
    ${p.lv===0?`<details class="later"><summary>之後的步驟（現在先不用管）</summary><ol>${p.steps.slice(1).map(s=>`<li>${esc(s)}</li>`).join('')}</ol></details>`:''}
    <b class="lbl">現在對這件事有多抗拒？<small class="muted">（可略過）</small></b>${moodRow('pre',p.pre)}
    <b class="lbl">先做多久？</b><div class="seg" role="group" aria-label="時間">${[2,5,10].map(m=>`<button data-a="dur" data-v="${m}" aria-pressed="${d===m}">${m} 分鐘</button>`).join('')}</div>
    <button class="btn primary block big" data-a="start">開始 ${d} 分鐘</button>
    <p class="muted small center">時間到想停就停，不會有任何懲罰。</p></div>`}
function recentCard(r){const seen=[...new Set(r.slice().reverse().map(x=>x.task))].slice(0,4);if(!seen.length)return'';
  return `<div class="card"><span class="eyebrow">最近開始過</span><div class="chips">${seen.map(t=>`<button class="chip" data-a="again" data-v="${esc(t)}">↻ ${esc(t)}</button>`).join('')}</div></div>`}
function jar(n){let dots='';let s=7;const rnd=()=>(s=(s*9301+49297)%233280)/233280;const shown=Math.min(n,80);
  for(let i=0;i<shown;i++){const row=Math.floor(i/7),inRow=Math.min(7,shown-row*7),col=i%7,x=100+(col-(inRow-1)/2)*18+(rnd()-.5)*5,y=200-row*16-rnd()*5,r=6+rnd()*2.5;dots+=`<circle class="spark" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" style="animation-delay:${(rnd()*3).toFixed(2)}s"/>`}
  return `<svg class="jar" viewBox="0 0 200 220" role="img" aria-label="火苗罐，裝了 ${n} 顆火苗"><defs><radialGradient id="sp"><stop offset="0" stop-color="#FFF2B8"/><stop offset=".6" stop-color="#FFA552"/><stop offset="1" stop-color="#F06A2E" stop-opacity=".2"/></radialGradient></defs>
    <rect x="62" y="8" width="76" height="16" rx="5" class="lid"/><path d="M70 24h60v14c22 8 42 24 42 54v104a16 16 0 0 1-16 16H44a16 16 0 0 1-16-16V92c0-30 20-46 42-54z" class="glass"/>
    <g clip-path="url(#jc)">${dots}</g><clipPath id="jc"><path d="M70 24h60v14c22 8 42 24 42 54v104a16 16 0 0 1-16 16H44a16 16 0 0 1-16-16V92c0-30 20-46 42-54z"/></clipPath>
    ${n?'':'<text x="100" y="140" text-anchor="middle" class="jar-empty">還是空的</text>'}</svg>`}
function month(r){const n=new Date(),y=n.getFullYear(),m=n.getMonth(),first=new Date(y,m,1).getDay(),days=new Date(y,m+1,0).getDate();const cnt={};r.forEach(x=>{const k=dKey(x.ts);cnt[k]=(cnt[k]||0)+1});
  let cells='';for(let i=0;i<first;i++)cells+='<span></span>';
  for(let d=1;d<=days;d++){const c=cnt[`${y}-${m+1}-${d}`]||0;cells+=`<span class="dc${c?' on':''}${d===n.getDate()?' today':''}" ${c?`aria-label="${m+1}月${d}日開始 ${c} 次"`:''}>${d}${c>1?`<i>${c}</i>`:''}</span>`}
  const mc=r.filter(x=>{const d=new Date(x.ts);return d.getFullYear()===y&&d.getMonth()===m}).length;
  return `<div class="card"><div class="plan-top"><h3 class="h3">${m+1} 月</h3><span class="muted small">這個月開始 ${mc} 次</span></div><div class="cal"><b>日</b><b>一</b><b>二</b><b>三</b><b>四</b><b>五</b><b>六</b>${cells}</div></div>`}

function makePlan(t){t=t.trim().slice(0,40);if(!t){toast('先寫下一件事，或點下面的常見選項');$('#task')?.focus();return}
  const b=breakdown(t);plan={task:t,cat:b.cat,steps:b.steps,tiny:b.tiny,lv:0,cur:b.steps[0]};store.set('s5_plan',plan);draft='';buzz();go('home')}

/* ---------- 專注畫面：狀態機 run → done（→ flow）---------- */
let tick=null,wl=null;
async function keepAwake(on){try{if(on&&'wakeLock' in navigator&&!wl){wl=await navigator.wakeLock.request('screen');wl.addEventListener('release',()=>wl=null)}else if(!on&&wl){wl.release();wl=null}}catch(e){}}
function startSession(task,step,steps,min,pre,cat){const r=recs();const rec={id:Date.now(),task,step,ts:Date.now(),sec:0,done:false};if(pre)rec.pre=pre;r.push(rec);saveRecs(r);
  sess.set({task,step,steps:steps||[],min,cat:cat??-1,recId:rec.id,mode:'run',endAt:Date.now()+min*60e3,left:null,acc:0,segStart:Date.now(),open:openLine()});buzz(14);openFocus(true);presence(true)}
function addSec(id,sec){const r=recs(),x=r.find(x=>x.id===id);if(x){x.sec=Math.round((x.sec||0)+sec);saveRecs(r)}}
function openFocus(fresh){let L=$('.focus');if(!L){L=document.createElement('div');L.className='focus';L.setAttribute('role','dialog');L.setAttribute('aria-modal','true');L.setAttribute('aria-label','專注中');document.body.appendChild(L);document.body.classList.add('modal-open','focusing')}
  const s=sess.get();if(!s)return closeFocus();
  if(s.mode==='done')return drawDone(L,s);
  const C=2*Math.PI*104;
  L.innerHTML=`<div class="f-top"><span class="eyebrow">${s.mode==='flow'?'不計時・順著做':'正在開始'}</span><b class="f-task">${esc(s.task)}</b><small id="fPeople" class="people" hidden></small></div>
    <div class="f-mid"><div class="ringwrap">${s.mode==='flow'?'':`<svg class="ring" viewBox="0 0 240 240" aria-hidden="true"><circle cx="120" cy="120" r="104" class="rbg"/><circle cx="120" cy="120" r="104" class="rfg" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="0" transform="rotate(-90 120 120)"/></svg>`}${ember('f')}</div>
      <div class="f-time" id="fTime" role="timer" aria-live="off">--:--</div>
      <p class="f-line" id="fLine" aria-live="polite"></p><button class="sndbtn" data-a="sound" aria-label="背景聲音">♪ ${soundName()}</button></div>
    <div class="f-step"><span class="tag">現在這一步</span><p id="fStep">${esc(s.step)}</p>${s.steps.length?'<button class="linkbtn" data-a="nextstep">這步做完了 → 下一步</button>':''}</div>
    <div class="f-btns"><button class="btn" data-a="pause">${s.left!=null?'繼續':'暫停'}</button><button class="btn" data-a="stop">${s.mode==='flow'?'結束':'先停在這裡'}</button></div>`;
  L.classList.remove('isdone');L.classList.toggle('paused',s.left!=null);if(fresh&&!reduceMotion())L.classList.add('enter');
  keepAwake(s.left==null);syncSound();clearInterval(tick);tick=setInterval(upd,250);upd()}
function upd(){const s=sess.get(),L=$('.focus');if(!s||!L||s.mode==='done')return clearInterval(tick);
  const now=Date.now(),total=s.min*60;
  if(s.mode==='flow'){const el=(s.left!=null?s.left:(now-s.segStart)/1e3);$('#fTime').textContent=fmt(el);setLine(s.left!=null?'休息一下也可以，準備好再繼續。':lineFor(s,el,0));return}
  const left=s.left!=null?s.left:(s.endAt-now)/1e3;$('#fTime').textContent=fmt(left);
  const C=2*Math.PI*104,fg=L.querySelector('.rfg');if(fg)fg.setAttribute('stroke-dashoffset',(C*(1-Math.max(0,left)/total)).toFixed(1));
  setLine(s.left!=null?'暫停中。準備好再按「繼續」。':lineFor(s,total-left,total));
  if(left<=0&&s.left==null)finish(true)}
function setLine(t){const e=$('#fLine');if(e&&e.textContent!==t){e.classList.remove('swap');void e.offsetWidth;e.textContent=t;e.classList.add('swap')}}
function finish(full){const s=sess.get();if(!s||s.mode==='done')return;clearInterval(tick);
  const now=Date.now();let sec;
  if(s.mode==='flow')sec=s.left!=null?s.left:(now-s.segStart)/1e3;
  else{const left=s.left!=null?s.left:(s.endAt-now)/1e3;sec=s.min*60-Math.max(0,left)}
  addSec(s.recId,sec);if(full&&s.mode==='run'){const r=recs(),x=r.find(x=>x.id===s.recId);if(x){x.done=true;saveRecs(r)}}
  if(!full&&!s.rounds&&s.mode==='run'&&sec<10){const r=recs().filter(x=>x.id!==s.recId);saveRecs(r);sess.clear();closeFocus();go('home');toast('還沒真的開始，不算數。準備好再按一次就好');return}
  s.prev=s.mode;s.rounds=(s.rounds||0)+1;s.mode='done';s.last=Math.round(sec);s.full=!!full;s.acc=(s.acc||0)+Math.round(sec);sess.set(s);keepAwake(false);syncSound();presence(false);
  buzz(full?[20,60,20]:12);if(full)chime();openFocus()}
function drawDone(L,s){const n=recs().length,acc=s.acc||0,rec=recs().find(x=>x.id===s.recId)||{};const evo=s.rounds===1&&stageOf(n)>stageOf(n-1);const t=acc>=60?`${Math.floor(acc/60)} 分 ${acc%60} 秒`:`${acc} 秒`;
  L.classList.remove('paused');L.classList.add('isdone');
  L.innerHTML=`<div class="f-mid done">${evo?`<div class="evo">✦ 你的火苗進化成「${STAGES[stageOf(n)][1]}」了！</div>`:''}<div class="burst" aria-hidden="true">${Array.from({length:14},(_,i)=>`<i style="--a:${i*360/14}deg;--d:${60+(i%3)*22}px"></i>`).join('')}</div>${ember('d',stageOf(n))}
    <h2 class="d-title">${s.prev==='flow'?'做得好！':s.full?(s.rounds>1?'又完成一輪！':'你開始了！'):'這也算開始！'}</h2>
    <p class="d-sub">「${esc(s.task)}」${s.rounds>1?'這次一共':''}做了 ${t}<br>${s.rounds>1?'火苗燒得更旺了。想停隨時都可以。':`這是你的第 ${n} 次開始，火苗罐又多一顆。`}</p>
    <div class="post"><b class="lbl">現在回頭看，這件事有多難受？</b>${moodRow('post',rec.post)}<p class="muted small" id="postMsg">${rec.post&&rec.pre?moodMsg(rec):''}</p></div></div>
    <div class="f-btns col"><button class="btn primary block big" data-a="more">再 ${s.min} 分鐘</button><button class="btn block" data-a="flow">不計時，順著做下去</button><div class="row2"><button class="btn" data-a="share">分享圖卡</button><button class="btn" data-a="end">今天先到這裡</button></div></div>`;
  if(!reduceMotion()){L.querySelector('.done').classList.add('go')}}
function closeFocus(){clearInterval(tick);keepAwake(false);soundStop();$('.focus')?.remove();document.body.classList.remove('modal-open','focusing')}
function chime(){if(store.get('s5_sound',true)===false)return;try{const A=new (window.AudioContext||window.webkitAudioContext)();[[660,0],[880,.16],[1320,.32]].forEach(([f,t])=>{const o=A.createOscillator(),g=A.createGain();o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(0,A.currentTime+t);g.gain.linearRampToValueAtTime(.18,A.currentTime+t+.02);g.gain.exponentialRampToValueAtTime(.001,A.currentTime+t+.9);o.connect(g).connect(A.destination);o.start(A.currentTime+t);o.stop(A.currentTime+t+1)});setTimeout(()=>A.close(),2000)}catch(e){}}

document.addEventListener('click',e=>{const b=e.target.closest('[data-a]');if(!b)return;const a=b.dataset.a,v=b.dataset.v;
  if(a==='pick'){const i=$('#task');if(i){i.value=v;draft=v}return makePlan(v)}
  if(a==='plan')return makePlan($('#task')?.value||'');
  if(a==='again'){go('home');return makePlan(v)}
  if(a==='reset'){plan=null;store.set('s5_plan',null);return go('home')}
  if(a==='smaller'){const p=plan;if(p.lv<p.tiny.length){p.cur=p.tiny[p.lv];p.lv++}else{toast('已經是最小的一步了——現在就開始吧');return}store.set('s5_plan',p);buzz();go('home');const f=$('.first');if(f&&!reduceMotion()){f.classList.add('pop')}return}
  if(a==='edit'){const L=sheet('寫下你的第一步',`<div class="card"><p class="muted small">越小越好，例如「打開檔案」。</p><input id="ownStep" class="inp" maxlength="40" value="${esc(plan.cur)}"><button class="btn primary block" data-a="ownok">就做這個</button></div>`);setTimeout(()=>L.querySelector('#ownStep')?.select(),100);return}
  if(a==='ownok'){const t=$('#ownStep').value.trim();if(t){plan.cur=t;store.set('s5_plan',plan)}$('.layer')?.remove();return go('home')}
  if(a==='dur'){store.set('s5_dur',+v);return go('home')}
  if(a==='start'){const p=plan;const rest=p.lv?p.steps.slice():p.steps.slice(1);return startSession(p.task,p.cur,rest,dur(),p.pre,p.cat)}
  if(a==='pre'){plan.pre=plan.pre===+v?undefined:+v;store.set('s5_plan',plan);b.parentNode.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',+x.dataset.v===plan.pre));buzz();return}
  if(a==='todoAdd')return todoAdd();
  if(a==='todoGo'){const t=todos()[+v];if(t){go('home');return makePlan(t)}return}
  if(a==='todoDone'){const t=todos();const x=t.splice(+v,1);store.set('s5_todo',t);buzz(14);toast(`完成「${x[0]}」，好樣的！`);return go('home')}
  if(a==='rem')return reminderSheet();
  if(a==='ics')return makeIcs();
  if(a==='snd'){store.set('s5_sound_kind',v);b.parentNode.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b));snd.kind=null;syncSound();if(!sess.get()||sess.get().mode==='done')soundPlay(v),setTimeout(()=>{if(!sess.get()||sess.get().mode==='done')soundStop()},2500);return}
  const s=sess.get();if(!s)return;
  if(a==='pause'){if(s.left!=null){if(s.mode==='flow')s.segStart=Date.now()-s.left*1e3;else s.endAt=Date.now()+s.left*1e3;s.left=null}else{s.left=s.mode==='flow'?(Date.now()-s.segStart)/1e3:(s.endAt-Date.now())/1e3}sess.set(s);buzz();return openFocus()}
  if(a==='sound')return soundSheet();
  if(a==='post'){const r=recs(),x=r.find(x=>x.id===s.recId);if(x){x.post=+v;saveRecs(r)}b.parentNode.querySelectorAll('button').forEach(y=>y.setAttribute('aria-pressed',y===b));const m=$('#postMsg');if(m)m.textContent=x&&x.pre?moodMsg(x):'記下來了。';buzz();return}
  if(a==='share'){const L=sheet('分享圖卡',`<div class="card"><p>產生一張圖卡，分享到 IG 限動或 LINE。</p><label><input type="checkbox" id="shTask" checked> 圖卡上顯示事情名稱</label><button class="btn primary block" data-a="mkshare">產生圖卡</button></div>`);return}
  if(a==='mkshare'){const w=$('#shTask')?.checked;$('.layer')?.remove();return shareCard(s,w)}
  if(a==='nextstep'){if(!s.steps.length)return;s.step=s.steps.shift();sess.set(s);buzz();toast('做得好！下一步');const p=$('#fStep');if(p){p.textContent=s.step;if(s.steps.length===0)b.remove()}return}
  if(a==='stop')return finish(false);
  if(a==='more'){Object.assign(s,{mode:'run',endAt:Date.now()+s.min*60e3,left:null});sess.set(s);buzz(14);presence(true);return openFocus(true)}
  if(a==='flow'){Object.assign(s,{mode:'flow',segStart:Date.now(),left:null});sess.set(s);buzz();presence(true);return openFocus(true)}
  if(a==='end'){sess.clear();plan=null;store.set('s5_plan',null);closeFocus();return go('log')}
});
document.addEventListener('click',e=>{if(e.target.closest('[data-a="wipe"]')&&confirm('確定清除所有紀錄？火苗罐會變空，無法復原。')){saveRecs([]);go('log')}});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='task'){e.preventDefault();makePlan(e.target.value)}if(e.key==='Enter'&&e.target.id==='todoIn'){e.preventDefault();todoAdd()}if(e.key==='Enter'&&e.target.id==='ownStep'){e.preventDefault();$('[data-a="ownok"]')?.click()}});
document.addEventListener('input',e=>{if(e.target.id==='task')draft=e.target.value});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&sess.get()){upd();const s=sess.get();if(s&&s.mode!=='done'&&s.left==null)keepAwake(true)}});
setTimeout(()=>{if(sess.get())openFocus()},50);setTimeout(maybeWeekly,1500);
function moodMsg(x){return x.post<x.pre?`開始前 ${x.pre} 分 → 做完 ${x.post} 分。看吧，開始之後沒那麼可怕。`:x.post===x.pre?`開始前後都是 ${x.post} 分。難的事還是做了，很不簡單。`:`比想像中難一點，但你還是做了 ${Math.round((recs().find(y=>y.id===x.id)||{}).sec/60)||1} 分鐘。`}
addEventListener('hashchange',()=>{const h=location.hash.slice(1);if(h&&h!==cur)go(h)});

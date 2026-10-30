/* ===== 0.2：火苗進化、心情對比、環境音、多樣陪伴語、分享圖卡、每週回顧、待辦清單、每日提醒、同時專注人數 ===== */

/* ---------- 火苗進化：開始次數越多，火苗越大（不會因中斷退化）---------- */
const STAGES=[[0,'火種','剛點燃的小火種'],[3,'小火苗','會眨眼陪你的小火苗'],[10,'營火','有木柴撐著，越燒越穩'],[25,'篝火','旁邊冒出了小火焰'],[50,'火炬','火星繞著你轉'],[100,'小太陽','發出光芒，照亮別人']];
const stageOf=n=>{let i=0;STAGES.forEach((s,k)=>{if(n>=s[0])i=k});return i};
const curStage=()=>stageOf(recs().length);
function emberExtra(st,layer){let o='';
  if(layer==='back'){
    if(st>=5)o+=`<g class="rays" stroke="#FFC46B" stroke-width="4" stroke-linecap="round" opacity=".55">${Array.from({length:12},(_,i)=>{const a=i*30*Math.PI/180;return`<line x1="${(60+Math.cos(a)*58).toFixed(1)}" y1="${(90+Math.sin(a)*58).toFixed(1)}" x2="${(60+Math.cos(a)*70).toFixed(1)}" y2="${(90+Math.sin(a)*70).toFixed(1)}"/>`}).join('')}</g>`;
    if(st>=3)o+=`<path class="side" d="M22 128c-10-12-8-26 0-36 2 10 8 12 10 18 2 8-2 14-10 18z" fill="#FF8A3D"/><path class="side r" d="M98 128c10-12 8-26 0-36-2 10-8 12-10 18-2 8 2 14 10 18z" fill="#FF8A3D"/>`}
  else{
    if(st>=2)o+=`<g class="logs"><rect x="24" y="132" width="72" height="11" rx="5.5" fill="#8A4B2A" transform="rotate(-8 60 137)"/><rect x="24" y="132" width="72" height="11" rx="5.5" fill="#6E3A1F" transform="rotate(8 60 137)"/></g>`;
    if(st>=4)o+=`<g class="orbit">${[0,1,2].map(i=>`<circle cx="${[18,104,60][i]}" cy="${[60,52,6][i]}" r="4" fill="#FFD27A"/>`).join('')}</g>`}
  return o}

/* ---------- 心情：開始前／做完後「這件事有多難受」---------- */
const MOODS=['還好','有點煩','不想做','很抗拒','超想逃'];
const moodRow=(name,val)=>`<div class="mood" role="group" aria-label="難受程度">${MOODS.map((m,i)=>`<button data-a="${name}" data-v="${i+1}" aria-pressed="${val===i+1}"><i>${i+1}</i>${m}</button>`).join('')}</div>`;
function moodStats(r){const m=r.filter(x=>x.pre&&x.post);if(!m.length)return null;const a=k=>m.reduce((s,x)=>s+x[k],0)/m.length;
  return{n:m.length,pre:a('pre'),post:a('post'),easier:m.filter(x=>x.post<x.pre).length}}
function moodCard(r){const s=moodStats(r);
  if(!s)return `<div class="card"><h3 class="h3">開始前 vs 做完後</h3><p class="muted small">開始前和做完後各點一下「有多難受」，這裡會告訴你：真正開始之後，事情是不是沒那麼可怕。</p></div>`;
  const w=v=>(v/5*100).toFixed(0);
  return `<div class="card"><h3 class="h3">開始前 vs 做完後</h3>
    <div class="mbar"><span>開始前</span><div><i style="width:${w(s.pre)}%"></i></div><b>${s.pre.toFixed(1)}</b></div>
    <div class="mbar after"><span>做完後</span><div><i style="width:${w(s.post)}%"></i></div><b>${s.post.toFixed(1)}</b></div>
    <p class="small">${s.n} 次裡有 <b class="hl">${s.easier} 次</b>做完後覺得比開始前輕鬆${s.pre>s.post?'。<br>下次又想逃的時候，記得這個數字。':'。'}</p>
    <small class="muted">分數：1 還好 → 5 超想逃</small></div>`}

/* ---------- 陪伴語：依時段、第幾次、事情類型、進度變化 ---------- */
const CAT_LINES=['先讓它跑起來，再讓它變好。','訊息不用完美，對方只需要知道你在。','麻煩事拆小了，就只是幾個步驟。','整理好一小塊，心也會清一點。','身體動起來，腦袋會跟上。','讀進去一頁，就是一頁。','寫爛的初稿，也比空白頁強。','手先動，靈感會跟上。'];
const MID=['分心了也沒關係，回來就好。','你正在做，這就夠了。','不用完美，先完成一點點。','呼吸放慢，手繼續。','你已經比剛才的自己前進了。','慢慢來，比較快。','注意力飄走很正常，輕輕拉回來。','很好，最難的「開始」已經過去了。'];
const NEAR=['快到了，順順地做下去。','最後一下，不用完美。','再一點點，就完成這一輪了。'];
const FLOW=['你進入狀態了。','順著這股勁，想停隨時可以停。','已經不是「開始」，是「在做」了。','累了就休息，這不是比賽。'];
function openLine(s){const n=recs().length,h=new Date().getHours();
  if(n===1)return'這是你第一次開始，我會一直在。';
  if(n%10===0)return`第 ${n} 次開始了，你比你以為的更常行動。`;
  if(h>=23||h<5)return'夜深了，做一點點就好，記得早點睡。';
  if(h<11)return'早安，趁腦袋還清醒，先動一下。';
  if(h<14)return'只做這一步就好，我在這陪你。';
  if(h<18)return'下午容易累，做一點點就好。';
  return'晚上了還願意開始，很不容易。'}
const pickFrom=(a,seed)=>a[Math.abs(seed)%a.length];
function lineFor(s,el,total){const seg=Math.floor(el/50),seed=(s.recId||0)/1000+seg*7|0;
  if(s.mode==='flow')return seg===0?'不計時了，想停隨時可以停。':pickFrom(FLOW,seed);
  if(total-el<=45)return pickFrom(NEAR,seed);
  if(seg===0)return s.open||'只做這一步就好，我在這陪你。';
  if(seg===1&&s.cat!=null&&s.cat>=0)return CAT_LINES[s.cat];
  return pickFrom(MID,seed)}

/* ---------- 環境音：全部用 Web Audio 即時合成（不需音檔、可離線、無授權問題）---------- */
const SOUNDS=[['off','無聲'],['rain','雨聲'],['fire','柴火'],['wave','海浪'],['brown','低沉噪音'],['white','白噪音']];
const snd={ctx:null,nodes:[],timers:[],kind:null};
function noiseBuf(A,type){const len=A.sampleRate*6,b=A.createBuffer(1,len,A.sampleRate),d=b.getChannelData(0);let l=0,b0=0,b1=0,b2=0;
  for(let i=0;i<len;i++){const w=Math.random()*2-1;
    if(type==='brown'){l=(l+.02*w)/1.02;d[i]=l*3.5}
    else if(type==='pink'){b0=.99765*b0+w*.099046;b1=.963*b1+w*.2965164;b2=.57*b2+w*1.0526913;d[i]=(b0+b1+b2+w*.1848)*.11}
    else d[i]=w*.5}
  return b}
function loop(A,buf,out){const s=A.createBufferSource();s.buffer=buf;s.loop=true;s.connect(out);s.start();snd.nodes.push(s);return s}
function soundStop(){snd.timers.forEach(clearInterval);snd.timers=[];snd.nodes.forEach(n=>{try{n.stop?n.stop():0;n.disconnect()}catch(e){}});snd.nodes=[];snd.kind=null}
function soundPlay(kind){soundStop();if(!kind||kind==='off')return;
  try{if(!snd.ctx)snd.ctx=new (window.AudioContext||window.webkitAudioContext)();}catch(e){return}
  const A=snd.ctx;A.resume&&A.resume();const master=A.createGain();master.gain.value=store.get('s5_vol',.6);master.connect(A.destination);snd.nodes.push(master);snd.master=master;snd.kind=kind;
  const filt=(type,f,q)=>{const x=A.createBiquadFilter();x.type=type;x.frequency.value=f;if(q)x.Q.value=q;return x};
  if(kind==='white'||kind==='brown'){const g=A.createGain();g.gain.value=kind==='white'?.35:.9;g.connect(master);snd.nodes.push(g);loop(A,noiseBuf(A,kind==='white'?'white':'brown'),g);return}
  if(kind==='rain'){const hp=filt('highpass',500),lp=filt('lowpass',7000),g=A.createGain();g.gain.value=.55;hp.connect(lp).connect(g).connect(master);snd.nodes.push(hp,lp,g);loop(A,noiseBuf(A,'pink'),hp);
    const drop=noiseBuf(A,'white'),bp=filt('bandpass',3200,1.2);bp.connect(master);snd.nodes.push(bp);
    snd.timers.push(setInterval(()=>{for(let k=0;k<3;k++){if(Math.random()<.5)continue;const s=A.createBufferSource(),e=A.createGain(),t=A.currentTime+Math.random()*.08;s.buffer=drop;e.gain.setValueAtTime(0,t);e.gain.linearRampToValueAtTime(.08+Math.random()*.12,t+.004);e.gain.exponentialRampToValueAtTime(.001,t+.05);s.connect(e).connect(bp);s.start(t,Math.random()*5,.08)}},90));return}
  if(kind==='fire'){const lp=filt('lowpass',380),g=A.createGain();g.gain.value=.9;lp.connect(g).connect(master);snd.nodes.push(lp,g);loop(A,noiseBuf(A,'brown'),lp);
    const cr=noiseBuf(A,'white'),hp=filt('highpass',1600);hp.connect(master);snd.nodes.push(hp);
    snd.timers.push(setInterval(()=>{if(Math.random()<.55)return;const n=1+(Math.random()<.25?2:0);for(let k=0;k<n;k++){const s=A.createBufferSource(),e=A.createGain(),t=A.currentTime+k*.03+Math.random()*.05,len=.005+Math.random()*.02;s.buffer=cr;e.gain.setValueAtTime(.12+Math.random()*.4,t);e.gain.exponentialRampToValueAtTime(.001,t+len);s.connect(e).connect(hp);s.start(t,Math.random()*5,len+.01)}},120));return}
  if(kind==='wave'){const lp=filt('lowpass',900),g=A.createGain();g.gain.value=.15;lp.connect(g).connect(master);snd.nodes.push(lp,g);loop(A,noiseBuf(A,'pink'),lp);
    const lfo=A.createOscillator(),depth=A.createGain();lfo.frequency.value=.09;depth.gain.value=.55;lfo.connect(depth).connect(g.gain);lfo.start();snd.nodes.push(lfo,depth);
    const lfo2=A.createOscillator(),d2=A.createGain();lfo2.frequency.value=.09;d2.gain.value=500;lfo2.connect(d2).connect(lp.frequency);lfo2.start();snd.nodes.push(lfo2,d2);return}}
const soundKind=()=>store.get('s5_sound_kind','off');
const soundName=()=>(SOUNDS.find(x=>x[0]===soundKind())||SOUNDS[0])[1];
function soundSheet(){const k=soundKind();const L=sheet('背景聲音',`<div class="card"><div class="sgrid">${SOUNDS.map(([v,n])=>`<button data-a="snd" data-v="${v}" aria-pressed="${k===v}">${n}</button>`).join('')}</div>
  <label class="vol">音量<input type="range" id="vol" min="0" max="1" step="0.05" value="${store.get('s5_vol',.6)}"></label>
  <p class="muted small">聲音是即時合成的，不用網路也能播。iPhone 若沒有聲音，請確認側邊靜音開關沒有打開。</p></div>`);
  L.addEventListener('input',e=>{if(e.target.id==='vol'){store.set('s5_vol',+e.target.value);if(snd.master)snd.master.gain.value=+e.target.value}});return L}
function syncSound(){const s=sess.get();const want=s&&(s.mode==='run'||s.mode==='flow')&&s.left==null?soundKind():'off';
  if(want==='off'){if(snd.kind)soundStop()}else if(snd.kind!==want)soundPlay(want);
  const b=$('[data-a="sound"]');if(b)b.textContent='♪ '+soundName()}

/* ---------- 同時專注人數（需要部署 worker/presence.js；沒設定就不顯示，絕不造假）---------- */
const PRESENCE_URL='';
const pid=(()=>{let v=store.get('s5_pid','');if(!v){v=Math.random().toString(36).slice(2,12);store.set('s5_pid',v)}return v})();
let presT=null;
async function presence(on){if(!PRESENCE_URL)return;clearInterval(presT);
  const ping=async()=>{try{const r=await fetch(PRESENCE_URL+(on?'/beat':'/leave'),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:pid})});const j=await r.json();const el=$('#fPeople');if(el&&on&&j.count>1){el.textContent=`此刻還有 ${j.count-1} 人也在開始`;el.hidden=false}}catch(e){}};
  await ping();if(on)presT=setInterval(ping,45e3)}

/* ---------- 分享圖卡（不放網址）---------- */
function emberImg(st){const svg=ember('x',st).replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" width="480" height="600" ');return new Promise(res=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>res(null);i.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)})}
async function shareCard(s,withTask){const W=1080,H=1350,c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');
  const bg=g.createRadialGradient(W/2,H*.38,40,W/2,H*.45,H*.8);bg.addColorStop(0,'#4A2A22');bg.addColorStop(.55,'#1E1620');bg.addColorStop(1,'#140F17');g.fillStyle=bg;g.fillRect(0,0,W,H);
  const n=recs().length,st=stageOf(n),img=await emberImg(st);if(img)g.drawImage(img,W/2-200,150,400,500);
  const serif='"Noto Serif TC","Songti TC","PMingLiU",serif';g.textAlign='center';
  const mins=Math.max(1,Math.round((s.acc||0)/60));
  g.fillStyle='#FFB27A';g.font=`700 92px ${serif}`;g.fillText(`我先動了 ${mins} 分鐘`,W/2,790);
  g.fillStyle='#F6EDE4';g.font=`500 52px ${serif}`;
  if(withTask){let t=s.task;if(t.length>16)t=t.slice(0,15)+'…';g.fillText(`「${t}」`,W/2,890)}
  g.fillStyle='#C9BCB4';g.font=`400 40px ${serif}`;g.fillText(`第 ${n} 次開始・我的火苗是「${STAGES[st][1]}」`,W/2,withTask?980:900);
  const d=new Date();g.fillText(`${d.getFullYear()}.${d.getMonth()+1}.${d.getDate()}`,W/2,withTask?1045:965);
  g.strokeStyle='rgba(255,160,90,.35)';g.lineWidth=2;g.beginPath();g.moveTo(W/2-120,1150);g.lineTo(W/2+120,1150);g.stroke();
  g.fillStyle='#FFB27A';g.font=`700 46px ${serif}`;g.fillText('先動五分鐘',W/2,1230);
  const blob=await new Promise(r=>c.toBlob(r,'image/png'));if(!blob)return toast('圖卡產生失敗，請再試一次');
  const file=new File([blob],'先動五分鐘.png',{type:'image/png'});
  try{if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file]});return}}catch(e){if(e&&e.name==='AbortError')return}
  const u=URL.createObjectURL(blob);const L=sheet('分享圖卡',`<div class="card"><img class="sharepic" src="${u}" alt="分享圖卡預覽"><p class="muted small">長按圖片即可儲存或分享。</p><a class="btn primary block" href="${u}" download="先動五分鐘.png">下載圖片</a></div>`);return L}

/* ---------- 每週回顧 ---------- */
function weekStart(t){const d=new Date(t);d.setHours(0,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7));return+d}
function weekStats(from,to){const r=recs().filter(x=>x.ts>=from&&x.ts<to);if(!r.length)return null;
  const cnt={};r.forEach(x=>cnt[x.task]=(cnt[x.task]||0)+1);const top=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0];
  const slots=[['早上',5,11],['中午',11,14],['下午',14,18],['晚上',18,23],['深夜',23,29]];const sc={};r.forEach(x=>{let h=new Date(x.ts).getHours();if(h<5)h+=24;const s=slots.find(s=>h>=s[1]&&h<s[2]);if(s)sc[s[0]]=(sc[s[0]]||0)+1});
  const best=Object.entries(sc).sort((a,b)=>b[1]-a[1])[0];const days=new Set(r.map(x=>dKey(x.ts))).size;
  return{n:r.length,min:totalMin(r),top,best,days,mood:moodStats(r)}}
const md=t=>{const d=new Date(t);return`${d.getMonth()+1}/${d.getDate()}`};
function weekBody(w){return `<div class="wk"><div><b>${w.n}</b><span>次開始</span></div><div><b>${w.min}</b><span>分鐘</span></div><div><b>${w.days}</b><span>天有動</span></div></div>
  <ul class="wkl">${w.top?`<li><span>最常面對的事</span><b>${esc(w.top[0])}（${w.top[1]} 次）</b></li>`:''}${w.best?`<li><span>最容易開始的時段</span><b>${w.best[0]}</b></li>`:''}${w.mood?`<li><span>做完後變輕鬆</span><b>${w.mood.easier}／${w.mood.n} 次</b></li>`:''}</ul>`}
function weekCard(){const now=Date.now(),ws=weekStart(now),cur=weekStats(ws,now+1),last=weekStats(ws-7*864e5,ws);if(!cur&&!last)return'';
  return `<div class="card"><div class="plan-top"><h3 class="h3">${cur?'這週':'上週'}回顧</h3><span class="muted small">${cur?md(ws)+' 起':md(ws-7*864e5)+'–'+md(ws-864e5)}</span></div>${weekBody(cur||last)}
    ${cur&&last?`<p class="muted small">上週：${last.n} 次開始・${last.min} 分鐘</p>`:''}</div>`}
function maybeWeekly(){const ws=weekStart(Date.now());if(store.get('s5_wk',0)===ws||sess.get()||$('.updm'))return;const prevW=ws-7*864e5,last=weekStats(prevW,ws);store.set('s5_wk',ws);if(!last)return;
  sheet('上週回顧',`<div class="card"><p class="muted small">${md(prevW)}–${md(ws-864e5)}</p>${weekBody(last)}<p class="small">${last.n>=5?'上週你很常行動。這週也一樣，從一小步開始。':'每一次開始都算數，這週再點一次火就好。'}</p><button class="btn primary block" data-close>開始新的一週</button></div>`)}

/* ---------- 待辦小清單 ---------- */
const todos=()=>store.get('s5_todo',[]);
function todoCard(){const t=todos();
  return `<div class="card"><h3 class="h3">等一下要面對的事</h3><p class="muted small">先記下來，不用現在做。想開始時按「開始」。</p>
    <div class="addrow"><input id="todoIn" class="inp" maxlength="40" autocomplete="off" enterkeyhint="done" placeholder="例如：整理衣櫃"><button class="btn" data-a="todoAdd">加入</button></div>
    ${t.length?`<ul class="todo">${t.map((x,i)=>`<li><button class="tick" data-a="todoDone" data-v="${i}" aria-label="完成並移除：${esc(x)}">✓</button><span>${esc(x)}</span><button class="btn sm" data-a="todoGo" data-v="${i}">開始</button></li>`).join('')}</ul>`:''}</div>`}
function todoAdd(){const i=$('#todoIn');const v=(i?.value||'').trim();if(!v)return toast('先寫一件事');const t=todos();if(t.length>=20)return toast('清單最多 20 件，先完成幾件吧');t.push(v.slice(0,40));store.set('s5_todo',t);go('home');setTimeout(()=>$('#todoIn')?.focus(),50)}

/* ---------- 每日提醒：加入手機行事曆（不需伺服器）---------- */
function reminderSheet(){const tm=store.get('s5_rem','09:00');
  sheet('每日提醒',`<div class="card"><p>選一個時間，App 會產生一個「每天重複」的行事曆提醒，加到你的手機行事曆後，每天時間到就會跳通知。</p>
    <label class="vol">提醒時間<input type="time" id="remT" value="${tm}" class="inp"></label>
    <button class="btn primary block" data-a="ics">加到行事曆</button>
    <p class="muted small">iPhone：會開啟「加入行事曆」畫面，按右上角「加入」。若從主畫面 App 開啟沒有反應，請改用 Safari 開這個網頁再按一次。<br>Android：下載後點開檔案，選 Google 日曆。<br>不想要了：在行事曆裡刪除這個事件即可。</p></div>`)}
function makeIcs(){const tm=($('#remT')?.value||'09:00');store.set('s5_rem',tm);const [h,m]=tm.split(':');const d=new Date();if(d.getHours()*60+d.getMinutes()>=+h*60+ +m)d.setDate(d.getDate()+1);
  const p=n=>String(n).padStart(2,'0'),day=`${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}`,now=new Date().toISOString().replace(/[-:]/g,'').slice(0,15)+'Z';
  const url=location.href.split('#')[0];
  const ics=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//start5//zh-TW','CALSCALE:GREGORIAN','BEGIN:VEVENT',`UID:start5-daily-${pid}@start5`,`DTSTAMP:${now}`,`DTSTART:${day}T${h}${m}00`,'DURATION:PT5M','RRULE:FREQ=DAILY','SUMMARY:先動五分鐘：今天想先動哪件事？',`DESCRIPTION:不用做完，先開始就好。打開 App：${url}`,`URL:${url}`,'BEGIN:VALARM','ACTION:DISPLAY','TRIGGER:PT0M','DESCRIPTION:今天想先動哪件事？','END:VALARM','END:VEVENT','END:VCALENDAR'].join('\r\n');
  if(isIOS){location.href='data:text/calendar;charset=utf-8,'+encodeURIComponent(ics);return}
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([ics],{type:'text/calendar'}));a.download='先動五分鐘-每日提醒.ics';document.body.appendChild(a);a.click();a.remove();toast('已下載，點開檔案加入行事曆')}

/* ---------- 火苗進化卡 ---------- */
function stageCard(n){const st=stageOf(n),nx=STAGES[st+1];const from=STAGES[st][0],pct=nx?Math.round((n-from)/(nx[0]-from)*100):100;
  return `<div class="card stage"><div class="stage-art">${ember('s',st)}</div><div><span class="eyebrow">我的火苗・第 ${st+1} 階</span><h3 class="h3">${STAGES[st][1]}</h3><p class="muted small">${STAGES[st][2]}</p>
    <div class="prog" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>
    <small class="muted">${nx?`再開始 ${nx[0]-n} 次，會長成「${nx[1]}」`:'已經是最高階了，謝謝你一直開始'}</small></div></div>`}

// 我們的小島：情侶小窩 3D 遊戲
import * as THREE from '../vendor/three.module.min.js';
import { Avatar, GUITAR, randomLook, heartMesh, HAIRS, HAIR_COLORS, SKINS, OUTFITS, ACCS, EYES, MOUTHS, HEADS, KIND_NAMES, preloadBodies, preloadClips } from './char.js';
import { groundH, standH, walkable, onDock, DOCK, LAND_Y, shoreR, HILL } from './terrain.js';
import { buildIsland, buildInterior, applyTheme, cutaway, THEMES, setTimeOfDay, SPOTS, INSPOTS, FURN, ROOM, blocked, CIRCLES, BOXES } from './world.js';
import { load, one, toon, toonGrad, tickAnimals, playA, progress, mixers, cloneModel, animal, animals, props } from './models.js';
import * as SkeletonUtils from '../vendor/SkeletonUtils.js';
import { levelOf, LEVELS, LEVEL_GIFTS, LOVE_CAP, REWARDS, FISH, SHELLS, FLOWERS, DISHES, LETTERS, BOTTLE, TIPS, EDIBLE, RECIPES, QUESTS, QUEST_COIN, QUEST_BONUS, DECOR, MILESTONES, QUESTIONS, QA_CATS, FESTIVALS, XMAS_DECOR } from './data.js';
import { Amb } from './amb.js';
import { weatherAt, seasonOf, createWeatherFX, umbrellaItem, snowmanMesh, SEASON_DAYS, DAY0, dateOfDay } from './weather.js';
import { initUpdates, showNewsOnce, APP_VER } from './update.js';
import { Music, sfx, TRACKS, setBackgroundPlay } from './audio.js';
import { icon, skyIcon } from './icons.js';
import { Net, auth as savedAuth, saveAuth, serverAvailable, createIsland, pairIsland, peekIsland, peekPair } from './net.js';
import { checkChat, CHAT_WHY, checkName, NAME_WHY } from './chatfilter.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rand = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const AS = 1, HIP = 0.306; // 角色大小、坐下時屁股離腳底的高度

// ---------- 存檔 ----------
const KEY = 'nest.save';
const DEF = { v: 1, names: ['', ''], looks: [null, null], anniv: '', love: 0, day: 1, tod: 9, diary: [], fish: {}, shells: {}, garden: [null, null, null], castles: 0, letterDay: 0, ctrl: 0, music: true, started: false, hand: false, flowersGiven: 0, dishes: 0, wishes: 0, fireworks: 0, laps: 0 };
let st = (() => { try { return { ...DEF, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (e) { return { ...DEF }; } })();
const save = () => { if (MP.role === 'g') return; rememberWhere(); if (st.myLook && (MP.id || (!MP.on && MP.role == null))) { /* 連上島、拿到身分後才同步「我是誰」 */ st.myLook = st.looks[myIdx()]; st.myName = st.names[myIdx()]; } try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} shareSave(); };
setInterval(save, 5000); addEventListener('visibilitychange', () => { if (document.hidden) save(); }); addEventListener('pagehide', () => save());
// 記住自己最後站在哪裡（下次打開從這裡繼續）；活動中就記活動旁邊的位置
function rememberWhere() {
  try { if (!st.started || !$('#splash').hidden) return; const c = me(); if (!c || c.ghost) return; const b = act?.back;
    if (MP.on && MP.awayChecked && !document.hidden) st.awaySeen = Date.now();
    st.where = { sc: scene, x: +(b ? b[0] : c.x).toFixed(2), z: +(b ? b[1] : c.z).toFixed(2), ry: +c.ry.toFixed(2), yaw: +(scene === 'in' ? view.inYaw : view.yaw).toFixed(2) }; } catch (e) {}
}
const myIdx = () => MP.role === 0 || MP.role === 1 ? MP.role : st.ctrl; // 連線拿到身分前，用原本的
const nameOf = i => st.names[i] || (i === myIdx() ? '我' : '另一半');

// ---------- 畫面 ----------
const canvas = $('#stage');
const R = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const PR = Math.min(devicePixelRatio || 1, 1.75); R.setPixelRatio(PR);
R.outputColorSpace = THREE.SRGBColorSpace;
R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 900);
function resize() {
  R.setSize(innerWidth, innerHeight, false); cam.aspect = innerWidth / innerHeight;
  /* 直式手機畫面很窄：把視角放大（左右至少看得到約 62 度，上下最多 72 度），風箏、牆上的相框才看得到 */
  const a = cam.aspect; cam.fov = a >= 1 ? 50 : Math.min(72, Math.max(50, 2 * Math.atan(Math.tan(31 * Math.PI / 180) / a) * 180 / Math.PI));
  cam.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
const OUT = new THREE.Scene();
let W = null, IN = null, scene = 'out';
const TREE = { x: -4.6, z: 4.8 }; // 兩個人一起種的愛情樹
const WADE = shorePoint(SPOTS.sunbathe.x, SPOTS.sunbathe.z + 1.5); // 曬太陽前面、浪打得到的地方
const PZ_AT = { x: 0, z: -2.5, y: 0.405 }; // 客廳茶几上
// 升級解鎖的新地方：Lv3 海邊小屋、Lv5 花園溫室
const PLACES = { hut: { x: -15, z: 19.3, lv: 4, key: 'beach-hut-fc7649', s: 0.8, ry: 0 }, gh: { x: -18.5, z: 3, lv: 6, key: 'greenhouse-53ab6d', s: 0.75, ry: Math.PI / 2 } };
const curS = () => scene === 'in' ? IN.S : OUT;

// ---------- 角色 ----------
for (let i = 0; i < 2; i++) if (!st.looks[i]) st.looks[i] = randomLook(i ? 'm' : 'f');
// 這支手機的主人（自己的名字、樣子）；舊存檔從目前操作的角色帶過來
if (!st.myLook) st.myLook = st.looks[st.ctrl]; if (st.myName == null) st.myName = st.names[st.ctrl] || '';
const chars = [0, 1].map(i => ({ i, av: null, x: i ? 1.4 : 0, z: 1.5, ry: Math.PI, y: null, moving: false, locked: false, path: null, spinT: 0, stuck: 0, tilt: 0, sc: 'out' }));
function makeAv(i) {
  const c = chars[i];
  if (c.av) { c.av.setLook(st.looks[i]); return; }
  c.av = new Avatar(st.looks[i]); c.av.root.scale.setScalar(AS); OUT.add(c.av.root); hookEmote(c);
}
// 連線狀態：role = 0／1（島主）、'g'（朋友）、null（單機）
const MP = { on: false, role: null, id: null, net: null, owner: null, peers: new Map(), sent: null, led: null, lead: false, expTod: null, guest: null };
// 「隱形的另一半」：朋友、或另一半不在線但島上有別人時，活動裡的另一半就用它（看不到、不做事）
const NOOP = () => {};
const ghost = { i: -1, ghost: true, x: 0, z: 0, ry: 0, y: null, moving: false, locked: false, path: null, spinT: 0, stuck: 0, tilt: 0,
  av: { root: new THREE.Group(), handSlot: new THREE.Group(), reaching: false, pose: 'stand', emote: NOOP, setPose: NOOP, holdHand: NOOP, setItem: NOOP, reach: NOOP, lean: NOOP, update: NOOP } };
let guestChar = null;
const othersOnline = () => [...MP.peers.values()].some(p => p.role === 'g') || (MP.role === 'g');
// 一個人生活：島上只有自己；另一半上線（連線版）才會出現
const me = () => MP.role === 'g' ? guestChar : chars[myIdx()];
const you = () => { if (MP.role === 'g') return ghost; const q = chars[1 - myIdx()]; return q.remote ? q : ghost; };
const partnerLocal = () => false;

// ---------- 開場 ----------
const preview = { on: true, t: 0 };
function syncSplash() {
  $('#name0').value = st.myName || ''; $('#anniv').value = st.anniv || '';
  document.querySelectorAll('.me-row [data-g]').forEach(b => b.setAttribute('aria-pressed', String(st.myLook.gender === b.dataset.g)));
}
function setMyLook(L) { st.myLook = L; st.looks[myIdx()] = L; chars[myIdx()].av.setLook(L); }
document.querySelectorAll('.me-row [data-g]').forEach(b => b.onclick = () => { setMyLook(randomLook(b.dataset.g)); document.querySelectorAll('.me-row [data-g]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); sfx('click'); }); // 只換樣子，不要清掉已經打好的名字
document.querySelector('.me-row .shuffle').onclick = () => { setMyLook(randomLook(st.myLook.gender)); chars[myIdx()].av.emote('jump', 1); sfx('click'); };
$('#start-btn').onclick = () => {
  st.myName = $('#name0').value.trim().slice(0, 8); st.names[myIdx()] = st.myName;
  st.anniv = $('#anniv').value || '';
  const first = !st.started; st.started = true; save();
  Music.init(); if (st.music) { Music.pick(st.track ?? -1); Music.play(); }
  $('#splash').classList.add('out'); setTimeout(() => { $('#splash').hidden = true; }, 600);
  $('#hud').hidden = false; preview.on = false;
  chars.forEach(c => { c.locked = false; c.av.setPose('stand'); c.av.holdHand(0); });
  placeStart();
  updateHud();
  Amb.start(); Amb.setOn(st.amb !== false); updateChips(); drawDecor(); drawSnowman(); if (st.low) applyLow(); setRun(!!st.run); setFlash(!!st.flash);
  if (!st.tut && !pairParam) setTimeout(tutorialStart, 1500);
  if (savedAuth?.key) serverAvailable().then(ok => { if (ok) { MP.role = savedAuth.role; MP.on = true; snapSent(); connectNet(savedAuth); } });
  if (pairParam && !savedAuth?.key) { history.replaceState(null, '', location.pathname); setTimeout(() => joinByCode(pairParam).catch(e => { toast(e.message, 4000); openNet().then(() => { $('#net-pair')?.click(); const i = $('#pair-in'); if (i) i.value = pairParam; }); }), 600); }
  setTimeout(dailyCheck, first ? 6000 : 2500);
  if (pendingGo) { const g = pendingGo; pendingGo = ''; history.replaceState(null, '', location.pathname); setTimeout(() => runGo(g), 2200); } /* 從通知點進來 */ if (!first) setTimeout(dogWelcome, 1800); else { st.lastDayHere = st.day; st.visitDays = 1; }
  if (first) { addMemo('🏝️', `${nameOf(myIdx())} 搬到了小島上`); setTimeout(() => toast('歡迎回家！靠近有標籤的地方就能做事；🌐 可以邀請另一半 ♥', 4500), 900); }
  else { toast(pick(TIPS), 4000); showNewsOnce(); }
};
function placeStart() {
  const c0 = me(), w = st.where;
  if (w?.sc === 'in') { c0.x = 0.5; c0.z = 3.2; enterHouse(w); return; } // 上次在小屋裡：直接回到屋裡原本的位置
  if (w && Number.isFinite(w.x)) { [c0.x, c0.z] = freeSpot(w.x, w.z); c0.ry = w.ry || 0; view.yaw = w.yaw ?? 0.5; }
  else { c0.x = 0.5; c0.z = 3.2; c0.ry = 0.5; view.yaw = 0.5; }
  updateCam(0, true);
}

// ---------- 介面小工具 ----------
let toastT = 0;
/* 提示：有 go 的提示可以點，點了直接帶你去那裡（右邊有「›」） */
function toast(msg, ms = 2600, go) {
  const t = $('#toast'); t.textContent = msg; t.classList.toggle('go', !!go); t.onclick = null;
  if (go) { const c = document.createElement('span'); c.className = 't-go'; c.textContent = '›'; t.appendChild(c); ms = Math.max(ms, 6000); t.onclick = () => { t.classList.remove('on'); clearTimeout(toastT); sfx('click'); go(); }; }
  t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms);
}
/* 開始活動：畫面不變暗，角色從原本站的地方滑到位置上（0.45 秒） */
function actGo(fn) {
  const cs = localChars().filter(c => c.av?.root), from = cs.map(c => c.av.root.position.clone());
  fn();
  cs.forEach((c, i) => { const to = { x: c.x, y: groundY(c), z: c.z }, f = from[i]; if (Math.hypot(f.x - to.x, f.y - to.y, f.z - to.z) < 12) c.glide = { dx: f.x - to.x, dy: f.y - to.y, dz: f.z - to.z, t: 0 }; });
}
function fadeDo(fn, hold = 380) { const f = $('#fade'); f.classList.add('on'); return new Promise(r => setTimeout(() => { fn(); setTimeout(() => { f.classList.remove('on'); r(); }, 120); }, hold)); }
function dateStr() { const d = new Date(); return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`; }
function addMemo(icon, text, go) {
  if (MP.role === 'g') return; const m = { d: dateStr(), day: st.day, icon, text, ts: Date.now(), by: myIdx(), ...(go ? { go } : {}) };
  st.diary.unshift(m); if (st.diary.length > 300) st.diary.length = 300; save(); if (MP.on) MP.net.send({ t: 'memo', ...m });
}
function daysTogether() { if (!st.anniv) return null; const a = new Date(st.anniv + 'T00:00:00'), n = new Date(); n.setHours(0, 0, 0, 0); return Math.max(1, Math.round((n - a) / 864e5) + 1); }
const loveCD = {};
/* 等級：甜蜜值＋一起玩的天數都到了才升級 */
const LV = () => levelOf(st.love, st.playDays || 1);
const FREE_LOVE = ['qa', 'fest', 'anniv', 'quest', 'rare']; /* 不算在每日上限裡的 */
function addLove(n, why, key) {
  if (key) { const now = performance.now(); if (loveCD[key] && now - loveCD[key] < 45e3) { n = Math.ceil(n / 4); } loveCD[key] = now; }
  if (MP.role === 'g') { if (why) toast(why); return; }
  if (!FREE_LOVE.includes(key)) { /* 每天的甜蜜值有上限：慢慢培養，不是一天衝完 */
    const L = st.loveDay?.d === st.day ? st.loveDay : (st.loveDay = { d: st.day, n: 0 }), room = Math.max(0, LOVE_CAP + (surpriseIs('sweetday') ? 20 : 0) - L.n);
    if (room <= 0) { if (why) toast(why); if (st.capToast !== st.day) { st.capToast = st.day; setTimeout(() => toast('💗 今天的甜蜜值已經滿了，明天再一起來累積吧', 3500), 900); } return; }
    n = Math.min(n, room); L.n += n;
  }
  const before = LV().lv; st.love += n; const after = LV(); if (n > 0) flyTo('💗', '#love-bar', Math.min(5, n));
  if (MP.on) { MP.net.send({ t: 'addlove', n }); MP.sent && (MP.sent.love = JSON.stringify(st.love)); }
  updateHud();
  if (!levelUp(before) && why) toast(`${why}　+${n} 甜蜜`);
}
// 升級：甜蜜值或天數到了都會檢查；每一級都有解鎖或禮物
function levelUp(before) {
  const after = LV(); if (after.lv <= before) return false;
  for (let lv = before + 1; lv <= after.lv; lv++) {
    (LEVEL_GIFTS[lv] || []).forEach(([id, n]) => { st.inv = st.inv || {}; st.inv[id] = (st.inv[id] || 0) + n; });
    addCoins(lv * 20); addMemo('💗', `我們的關係升級成「${LEVELS[lv - 1][2]}」`);
  }
  save(); sfx('chime'); updateHud(); drawTree(); drawPlaces();
  const L = LEVELS[after.lv - 1];
  setTimeout(() => { openDlg('💗 升級了', `<div class="fest-card"><span>💗</span><b>Lv${after.lv}「${esc(L[2])}」</b><p>${esc(L[3])}</p></div><p class="muted">升級禮物：🪙 ${after.lv * 20}${LEVEL_GIFTS[after.lv] ? '，擺設已經放進裝潢的包包裡' : ''}</p><button type="button" class="primary" id="lv-ok">好 ♥</button>`); $('#lv-ok').onclick = () => $('#dlg').close(); }, 600);
  burst('heart', me().av.root.position.clone().add(new THREE.Vector3(0, 1.8, 0)), 14);
  return true;
}
/* 一起玩的天數：每個真實的一天，有人上島就 +1（升級要用） */
function countPlayDay() {
  if (MP.role === 'g' || st.playDay === st.day) return; const before = LV().lv;
  st.playDay = st.day; st.playDays = (st.playDays || 0) + 1; save(); updateHud(); levelUp(before);
}
function updateHud() {
  $('#hud-names').textContent = `${nameOf(myIdx())} ♥ ${nameOf(1 - myIdx())}`;
  const d = daysTogether(), se = seasonOf(st.day), fe = festToday(); $('#hud-days').textContent = (d ? `在一起第 ${d} 天` : `小島第 ${islandDays()} 天`) + ` ${fe ? fe.icon : se.icon}`;
  const L = LV(); if (W) W.rainbow = L.lv >= 7; $('#hud-lv').textContent = `Lv${L.lv} ${L.title}`; $('#love-bar').style.width = (L.pct * 100).toFixed(1) + '%';
  $('#btn-music').setAttribute('aria-pressed', String(!!st.music));
}
function clockText() { const h = Math.floor(st.tod), m = Math.floor((st.tod - h) * 60); const wi = weatherAt(st.day, st.tod).icon; const ic = wi || (st.tod >= 5.5 && st.tod < 17.8 ? '☀️' : st.tod >= 17.8 && st.tod < 19.3 ? '🌇' : '🌙'); return `${ic} ${String(h).padStart(2, '0')}:${String(Math.floor(m / 10) * 10).padStart(2, '0')}`; }
// 時鐘標籤：天氣／時間圖示＋時間
function clockHtml() { const h = Math.floor(st.tod), m = Math.floor((st.tod - h) * 60); return `${icon(skyIcon(weatherAt(st.day, st.tod).icon, st.tod))}<b class="n">${String(h).padStart(2, '0')}:${String(Math.floor(m / 10) * 10).padStart(2, '0')}</b>`; }
const isNight = () => st.tod >= 19 || st.tod < 5.3;
/* ===== 真實時間：島上的時間就是台灣時間；每天的任務、驚喜、問答都跟著真實的一天 ===== */
const TW_OFF = 8 * 3600e3, WEEK = '日一二三四五六';
let dbgTod = (() => { const v = new URLSearchParams(location.search).get('tod'); return v == null || v === '' || isNaN(+v) ? null : +v; })(); /* 測試畫面用：?tod=21 固定時間 */
const realDay = () => Math.floor((Date.now() + TW_OFF - DAY0) / 864e5) + 1;
const realTod = () => dbgTod != null ? dbgTod : ((Date.now() + TW_OFF) % 864e5) / 3600e3;
const islandDays = () => Math.max(1, st.day - (st.born || st.day) + 1);
const dayDate = (d = st.day) => dateOfDay(d).toISOString().slice(0, 10);
const festOf = d => { const k = dayDate(d); return FESTIVALS.find(f => f.d.includes(k) || f.d.includes(k.slice(5))) || null; };
const festToday = () => festOf(st.day);
function syncClock() { st.tod = realTod(); const d = realDay(); if (st.day !== d) { const old = st.day; st.day = d; if (old && started()) newDay(old); } }
/* 舊存檔（島上一天只有 14 分鐘的那個版本）：把記著「第幾天」的欄位換成真實日期，小島的第一天用最早的一筆回憶 */
function migrateRT(oldDay, sharedOnly) {
  const nd = realDay(), dayOfTs = ts => Math.floor((ts + TW_OFF - DAY0) / 864e5) + 1;
  /* 用最新一筆回憶的「舊天數」和「真實寫下的日期」算出差多少天（舊版伺服器的天數沒人在時也會一直跑，不能拿來算） */
  const ref = (st.diary || []).find(m => typeof m.day === 'number' && m.ts);
  const off = ref ? dayOfTs(ref.ts) - ref.day : nd - (oldDay || nd), sh = (o, k) => { if (o && typeof o[k] === 'number') o[k] = Math.min(nd, o[k] + off); };
  if (off) {
    sh(st, 'fedDay'); sh(st, 'letterDay'); sh(st.snowman, 'day'); sh(st.eggs, 'day'); sh(st.quests, 'day'); sh(st.surprise, 'day');
    sh(st.tree, 'last'); sh(st.tree?.fruit, 'day'); sh(st.tree?.care, 'day'); sh(st.puzzle, 'day'); sh(st.gh, 'day'); (st.diary || []).forEach(m => sh(m, 'day'));
    if (!sharedOnly) sh(st, 'lastDayHere');
  }
  const first = Math.min(Date.now(), ...(st.diary || []).map(m => m.ts || Date.now()));
  st.born = Math.min(st.born || nd, Math.floor((first + TW_OFF - DAY0) / 864e5) + 1); st.rt = 1; st.day = nd;
}
if (!st.rt) migrateRT(st.day, false);
if (st.playDays == null && st.started) { const ds = new Set((st.diary || []).map(m => Math.floor(((m.ts || Date.now()) + TW_OFF) / 864e5))); ds.add(Math.floor((Date.now() + TW_OFF) / 864e5)); st.playDays = ds.size; st.playDay = realDay(); st.keepPlaces = st.love >= 380 ? ['hut', 'gh'] : st.love >= 90 ? ['hut'] : []; }
st.tod = realTod(); st.day = realDay();

// ---------- 特效：愛心、音符、睡覺 Z、亮晶晶 ----------
const texCache = {};
function glyphTex(ch, color) {
  const k = ch + color; if (texCache[k]) return texCache[k];
  const c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d');
  g.font = '900 76px "Noto Sans TC", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 8; g.strokeStyle = 'rgba(255,255,255,.95)'; g.strokeText(ch, 48, 52); g.fillStyle = color; g.fillText(ch, 48, 52);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return (texCache[k] = t);
}
function glowTex() {
  if (texCache.glow) return texCache.glow;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return (texCache.glow = new THREE.CanvasTexture(c));
}
const FX = { heart: ['♥', '#ff5a8a'], note: ['♪', '#7a6af0'], z: ['Z', '#6a8ad8'], star: ['✦', '#ffb830'], drop: ['💧', '#4aa8f0'] };
const parts = [];
function burst(kind, pos, n = 6, spread = 0.6) {
  const [ch, col] = FX[kind] || FX.heart; const S = curS();
  for (let i = 0; i < n; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glyphTex(ch, col), transparent: true, depthWrite: false }));
    sp.position.copy(pos).add(new THREE.Vector3(rand(-spread, spread), rand(-0.1, 0.3), rand(-spread, spread)));
    const s = rand(0.28, 0.48); sp.scale.set(s, s, s); S.add(sp);
    parts.push({ sp, v: new THREE.Vector3(rand(-0.3, 0.3), rand(0.7, 1.4), rand(-0.3, 0.3)), life: 0, max: rand(1.3, 2.1), s, S });
  }
}
// 水花：小水珠往上噴、再掉下來（dir：往哪個方向潑）
function splash(pos, n = 14, dir = null, power = 1) {
  const S = curS();
  for (let i = 0; i < n; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: i % 3 ? '#e8fbff' : '#9fe3f0', transparent: true, depthWrite: false }));
    sp.position.copy(pos).add(new THREE.Vector3(rand(-0.15, 0.15), 0.05, rand(-0.15, 0.15))); const s = rand(0.12, 0.26); sp.scale.set(s, s, s); S.add(sp);
    const v = new THREE.Vector3(rand(-0.9, 0.9), rand(1.6, 3.0) * power, rand(-0.9, 0.9)); if (dir) v.addScaledVector(dir, rand(1.2, 2.4) * power);
    parts.push({ sp, v, life: 0, max: rand(0.6, 0.95), s, S, g: 1 });
  }
}
function tickParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.life += dt; const k = p.life / p.max;
    p.sp.position.addScaledVector(p.v, dt); if (p.g) p.v.y -= 7.5 * dt; else p.v.y *= 0.985; p.sp.material.opacity = 1 - k * k; const sc = p.s * (0.6 + Math.min(1, p.life * 4) * 0.4); p.sp.scale.set(sc, sc, sc);
    if (k >= 1) { p.S.remove(p.sp); p.sp.material.dispose(); parts.splice(i, 1); }
  }
}
const headPos = (c, up = 1.75) => new THREE.Vector3(c.av.root.position.x, c.av.root.position.y + up, c.av.root.position.z);
// 兩個人的中間（另一半不在就是自己頭上）
const duo = () => !you().ghost;
const midPos = (up = 1.6) => duo() ? headPos(me(), up).add(headPos(you(), up)).multiplyScalar(0.5) : headPos(me(), up + 0.2);

// ---------- 煙火 ----------
const fireworks = [];
function launchFirework(heart, fromNet) {
  if (MP.on && !fromNet) MP.net.send({ t: 'fx', k: 'fw', a: heart ? 1 : 0 });
  const g = new THREE.BufferGeometry(), n = 140, pos = new Float32Array(n * 3), vel = [];
  const ox = SPOTS.beach.x + rand(-9, 9), oz = 42 + rand(-3, 5), oy = 8 + rand(0, 4);
  for (let i = 0; i < n; i++) {
    pos.set([ox, oy, oz], i * 3);
    if (heart) { const t = i / n * Math.PI * 2, x = 16 * Math.sin(t) ** 3, y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t); vel.push(new THREE.Vector3(x * 0.42, y * 0.42, rand(-0.5, 0.5))); }
    else { const u = rand(-1, 1), th = rand(0, Math.PI * 2), k = Math.sqrt(1 - u * u), sp = rand(6, 8); vel.push(new THREE.Vector3(Math.cos(th) * k * sp, u * sp, Math.sin(th) * k * sp)); }
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const col = heart ? '#ff5a8a' : pick(['#ffd25a', '#7ad8ff', '#ff8ad8', '#9aff8a', '#ffffff', '#ff9a5a']);
  const m = new THREE.Points(g, new THREE.PointsMaterial({ color: col, size: 1.8, map: glowTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  // 先升空的火花
  const trail = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: '#ffe0a0', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); trail.scale.set(0.6, 0.6, 0.6); trail.position.set(ox, 1, 30); OUT.add(trail);
  fireworks.push({ m, vel, t: -1.1, trail, from: trail.position.clone(), to: new THREE.Vector3(ox, oy, oz) });
  sfx('launch');
}
function tickFireworks(dt) {
  for (let i = fireworks.length - 1; i >= 0; i--) {
    const f = fireworks[i]; f.t += dt;
    if (f.t < 0) { const k = 1 + f.t / 1.1; f.trail.position.lerpVectors(f.from, f.to, 1 - (1 - k) ** 2); continue; }
    if (f.trail) { OUT.remove(f.trail); f.trail = null; OUT.add(f.m); sfx('boom'); }
    const p = f.m.geometry.attributes.position, drag = Math.exp(-dt * 1.6);
    for (let j = 0; j < f.vel.length; j++) { const v = f.vel[j]; v.multiplyScalar(drag); v.y -= dt * 2.2; p.setXYZ(j, p.getX(j) + v.x * dt, p.getY(j) + v.y * dt, p.getZ(j) + v.z * dt); }
    p.needsUpdate = true; f.m.material.opacity = Math.max(0, 1 - f.t / 2.6); f.m.material.size = 1.8 + f.t * 0.4;
    if (f.t > 2.6) { OUT.remove(f.m); f.m.geometry.dispose(); fireworks.splice(i, 1); }
  }
}
// ---------- 流星 ----------
let meteor = null;
function spawnMeteor() {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: '#fff6d0', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  sp.scale.set(14, 0.9, 1); const a = rand(-0.5, 0.5); sp.material.rotation = -0.45;
  const from = new THREE.Vector3(-200 + rand(-40, 40), 120 + rand(0, 40), -60 + rand(-80, 80) + a * 100);
  sp.position.copy(from); OUT.add(sp); meteor = { sp, from, v: new THREE.Vector3(-70, -38, rand(-15, 15)), t: 0 };
}
function tickMeteor(dt) { if (!meteor) return; meteor.t += dt; meteor.sp.position.addScaledVector(meteor.v, dt); meteor.sp.material.opacity = Math.sin(Math.min(1, meteor.t / 1.6) * Math.PI); if (meteor.t > 1.6) { OUT.remove(meteor.sp); meteor = null; } }

// ---------- 輸入：搖桿、鍵盤、拖曳轉鏡頭、雙指縮放、點地板走過去 ----------
const view = { yaw: 0.5, pitch: 0.5, dist: 9.5, inYaw: 0, inDist: 10, inPitch: 0.7 }; /* 視角變寬了，預設距離拉近一點 */
const joy = { x: 0, y: 0, id: null };
const keys = new Set();
addEventListener('keydown', e => { if (e.target.closest('input,textarea')) return; keys.add(e.key.toLowerCase()); if (e.key === 'e' || e.key === ' ') { if (!$('#btn-act').hidden) $('#btn-act').click(); } });
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
(() => {
  const el = $('#joy'), knob = $('#joy-knob');
  const set = (e) => { const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2; let dx = e.clientX - cx, dy = e.clientY - cy; const m = r.width / 2 - 14, d = Math.hypot(dx, dy); if (d > m) { dx *= m / d; dy *= m / d; } joy.x = dx / m; joy.y = dy / m; knob.style.transform = `translate(${dx}px,${dy}px)`; };
  el.addEventListener('pointerdown', e => { joy.id = e.pointerId; el.setPointerCapture(e.pointerId); el.classList.add('on'); set(e); me().path = null; });
  el.addEventListener('pointermove', e => { if (e.pointerId === joy.id) set(e); });
  const end = e => { if (e.pointerId !== joy.id) return; joy.id = null; joy.x = joy.y = 0; knob.style.transform = ''; el.classList.remove('on'); };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
})();
(() => {
  const pts = new Map(); let pinch = 0, downAt = null;
  canvas.addEventListener('pointerdown', e => { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); canvas.setPointerCapture(e.pointerId); if (pts.size === 1) downAt = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 }; if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); downAt = null; } });
  canvas.addEventListener('pointermove', e => {
    const p = pts.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y); zoom(pinch / d); pinch = d; return; }
    if (downAt) downAt.moved += Math.abs(dx) + Math.abs(dy);
    if (build && buildPointer('drag', e, { dx, dy })) return; // 裝潢模式：拖曳的是家具
    if (scene === 'in') { view.inYaw -= dx * 0.006; view.inPitch = clamp(view.inPitch + dy * 0.004, 0.22, 1.25); return; } /* 屋內可以 360 度轉，上下拖改變俯角（放低就看得到牆上的相框） */
    view.yaw -= dx * 0.006; view.pitch = clamp(view.pitch + dy * 0.004, 0.08, 1.35);
  });
  const up = e => { const was = pts.get(e.pointerId); pts.delete(e.pointerId); if (downAt && was && downAt.moved < 10 && performance.now() - downAt.t < 400) { if (!(build && buildPointer('tap', e))) tapAt(e.clientX, e.clientY); } downAt = null; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', e => { pts.delete(e.pointerId); downAt = null; });
  canvas.addEventListener('wheel', e => { e.preventDefault(); zoom(1 + Math.sign(e.deltaY) * 0.1); }, { passive: false });
})();
function zoom(k) { if (build) { build.dist = clamp(build.dist * k, 4, 18); return; } if (scene === 'in') view.inDist = clamp(view.inDist * k, 4, 26); else view.dist = clamp(view.dist * k, 3.2, 36); }
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function tapAt(x, y) {
  if (!started() || photo.on) return;
  ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, cam);
  // 點到另一半 → 打開互動選單
  const hitP = ray.intersectObject(you().av.root, true)[0];
  if (hitP) { toggleLoveMenu(true); return; }
  if (act) return;
  let pt = null;
  if (scene === 'in') { const t = -ray.ray.origin.y / ray.ray.direction.y; if (t > 0) pt = ray.ray.at(t, new THREE.Vector3()); }
  else {
    const t = (DOCK.y - ray.ray.origin.y) / ray.ray.direction.y; const pd = t > 0 ? ray.ray.at(t, new THREE.Vector3()) : null;
    if (pd && onDock(pd.x, pd.z)) pt = pd; else { const h = ray.intersectObject(W.ground, false)[0]; if (h) pt = h.point; }
  }
  if (pt) { route(me(), pt.x, pt.z); spawnRing(pt); }
}
let ringM = null;
function spawnRing(p) {
  if (!ringM) { ringM = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.36, 24), new THREE.MeshBasicMaterial({ color: '#ff7a9c', transparent: true, depthWrite: false })); ringM.rotation.x = -Math.PI / 2; }
  curS().add(ringM); ringM.position.set(p.x, (scene === 'in' ? 0 : standH(p.x, p.z)) + 0.05, p.z); ringM.userData.t = 0;
}

// ---------- 移動與碰撞 ----------
const R_BODY = 0.28;
function canStand(x, z) {
  if (scene === 'in') { const hw = ROOM.w / 2 - 0.4, hd = ROOM.d / 2 - 0.4; return x > -hw && x < hw && z > -hd && z < hd && !blocked(x, z, R_BODY, DCIRC.in, IN.BOXES); }
  return walkable(x, z) && !blocked(x, z, R_BODY, CIRCLES, BOXES) && !blocked(x, z, R_BODY, DCIRC.out, []);
}
// ---------- 找路（A*）：繞過小木屋、樹、家具，沿著沙灘走上碼頭 ----------
const grids = {};
function grid() {
  if (grids[scene]) return grids[scene];
  const cell = scene === 'in' ? 0.25 : 0.5, half = scene === 'in' ? 7.5 : 48, n = Math.round(half * 2 / cell), ok = new Uint8Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) ok[j * n + i] = canStand(-half + (i + 0.5) * cell, -half + (j + 0.5) * cell) ? 1 : 0;
  return (grids[scene] = { cell, half, n, ok });
}
function lineFree(ax, az, bx, bz) { const d = Math.hypot(bx - ax, bz - az), k = Math.ceil(d / 0.2); for (let i = 1; i <= k; i++) { const t = i / k; if (!canStand(ax + (bx - ax) * t, az + (bz - az) * t)) return false; } return true; }
function findPath(sx, sz, tx, tz) {
  if (lineFree(sx, sz, tx, tz)) return [[tx, tz]];
  const G = grid(), { cell, half, n, ok } = G, idx = (x, z) => { const i = Math.floor((x + half) / cell), j = Math.floor((z + half) / cell); return i < 0 || j < 0 || i >= n || j >= n ? -1 : j * n + i; };
  const nearOK = k => { if (k >= 0 && ok[k]) return k; const i0 = k % n, j0 = Math.floor(k / n); for (let r = 1; r < 12; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue; const i = i0 + di, j = j0 + dj; if (i >= 0 && j >= 0 && i < n && j < n && ok[j * n + i]) return j * n + i; } return -1; };
  const s0 = nearOK(idx(sx, sz)), g0 = nearOK(idx(tx, tz)); if (s0 < 0 || g0 < 0) return null;
  const gS = new Float32Array(n * n).fill(1e9), from = new Int32Array(n * n).fill(-1), closed = new Uint8Array(n * n);
  const heap = [], push = (k, f) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const pa = (i - 1) >> 1; if (heap[pa][0] <= heap[i][0]) break; [heap[pa], heap[i]] = [heap[i], heap[pa]]; i = pa; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const gi = g0 % n, gj = Math.floor(g0 / n), h = k => Math.hypot(k % n - gi, Math.floor(k / n) - gj);
  gS[s0] = 0; push(s0, h(s0)); let found = false, guard = 0;
  while (heap.length && guard++ < 60000) {
    const [, k] = pop(); if (closed[k]) continue; closed[k] = 1; if (k === g0) { found = true; break; }
    const i = k % n, j = Math.floor(k / n);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue; const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= n || nj >= n) continue;
      const nk = nj * n + ni; if (!ok[nk] || closed[nk]) continue; if (di && dj && (!ok[j * n + ni] || !ok[nj * n + i])) continue;
      const g = gS[k] + (di && dj ? 1.414 : 1); if (g < gS[nk]) { gS[nk] = g; from[nk] = k; push(nk, g + h(nk)); }
    }
  }
  if (!found) return null;
  const pts = []; for (let k = g0; k >= 0 && k !== s0; k = from[k]) pts.push([-half + (k % n + 0.5) * cell, -half + (Math.floor(k / n) + 0.5) * cell]);
  pts.reverse(); if (canStand(tx, tz)) pts.push([tx, tz]);
  // 拉直：看得到的點就直接走過去
  const out = []; let cx = sx, cz = sz, i = 0;
  while (i < pts.length) { let j = pts.length - 1; while (j > i && !lineFree(cx, cz, pts[j][0], pts[j][1])) j--; out.push(pts[j]); [cx, cz] = pts[j]; i = j + 1; }
  return out;
}
// 叫角色走到某處（then：到了之後要開始的活動）
function route(c, x, z, then) {
  const pts = findPath(c.x, c.z, x, z);
  if (!pts) { toast('走不過去耶，換個地方試試'); c.path = null; return; }
  c.path = { x, z, then, pts, i: 0 }; c.stuck = 0;
}

// 找離 (x, z) 最近、可以站的地方（一圈一圈往外找）
function freeSpot(x, z) {
  if (canStand(x, z)) return [x, z];
  for (let r = 0.3; r < 4; r += 0.3) for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, nx = x + Math.cos(a) * r, nz = z + Math.sin(a) * r; if (canStand(nx, nz)) return [nx, nz]; }
  return [x, z];
}
function stepChar(c, dx, dz, dt, speed) {
  // 萬一已經卡在家具裡：先讓他走出來
  if (!canStand(c.x, c.z)) { const L0 = Math.hypot(dx, dz); if (L0 > 1e-4) { c.x += dx / L0 * speed * dt; c.z += dz / L0 * speed * dt; c.ry = Math.atan2(dx, dz); c.moving = true; return true; } }
  const L = Math.hypot(dx, dz); if (L < 1e-4) { c.moving = false; return false; }
  const sx = dx / L * speed * dt, sz = dz / L * speed * dt;
  let moved = false;
  if (canStand(c.x + sx, c.z + sz)) { c.x += sx; c.z += sz; moved = true; }
  else if (canStand(c.x + sx, c.z)) { c.x += sx; moved = Math.abs(sx) > 1e-4; }
  else if (canStand(c.x, c.z + sz)) { c.z += sz; moved = Math.abs(sz) > 1e-4; }
  const want = Math.atan2(dx, dz); let d = want - c.ry; d = Math.atan2(Math.sin(d), Math.cos(d)); c.ry += d * Math.min(1, dt * 10);
  c.moving = moved; return moved;
}
function groundY(c) { return c.y != null ? c.y : scene === 'in' ? 0 : standH(c.x, c.z); }
function syncAv(c, dt) {
  const r = c.av.root; r.position.set(c.x, groundY(c), c.z);
  if (c.glide) { c.glide.t += dt / 0.45; const k = 1 - Math.min(1, c.glide.t), e = k * k * (3 - 2 * k); r.position.x += c.glide.dx * e; r.position.y += c.glide.dy * e; r.position.z += c.glide.dz * e; if (k <= 0) c.glide = null; }
  if (c.spinT > 0) { c.spinT -= dt; c.ry += dt * 11; }
  r.rotation.set(c.tilt || 0, c.ry, 0, 'YXZ');
  c.av.update(dt, c.moving);
}

// ---------- 另一半：跟著你走、牽手 ----------
let lovePending = null, loveHold = 0; // loveHold：抱抱、親親、拍照時另一半先站著不動
function partnerAI(dt) {
  const p = me(), q = you(); if (q.locked || !partnerLocal()) return;
  if (loveHold > 0) { loveHold -= dt; q.moving = false; return; }
  const fx = Math.sin(p.ry), fz = Math.cos(p.ry), rx = -fz, rz = fx; // 朝向、右手邊
  let tx, tz, near;
  if (lovePending) {
    const k = lovePending; [tx, tz] = loveSpot(p, k.kind); k.t += dt; /* 站在你的「畫面右邊」，兩個人面對面，鏡頭看到側面 */
    const d = Math.hypot(tx - q.x, tz - q.z);
    if (d < 0.12 || k.t > 2.2) { if (d >= 0.12) { q.x = tx; q.z = tz; } q.ry = Math.atan2(p.x - q.x, p.z - q.z); doLove(k.kind); lovePending = null; }
    else stepChar(q, tx - q.x, tz - q.z, dt, 3.2);
    return;
  }
  if (st.hand && !p.locked) {
    tx = p.x + rx * 0.62; tz = p.z + rz * 0.62; near = 0.06;
    const d = Math.hypot(tx - q.x, tz - q.z);
    if (d > 4) { q.x = tx; q.z = tz; }
    if (d > near) { if (!stepChar(q, tx - q.x, tz - q.z, dt, Math.max(2.6, d * 6))) { q.stuck += dt; if (q.stuck > 0.6) { q.x = tx; q.z = tz; q.stuck = 0; } } else q.stuck = 0; }
    else { q.moving = p.moving; let dd = p.ry - q.ry; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); q.ry += dd * Math.min(1, dt * 10); }
    q.moving = p.moving || d > near * 2;
    p.av.holdHand(-1); q.av.holdHand(1);
    return;
  }
  p.av.holdHand(0); q.av.holdHand(0);
  tx = p.x + rx * 1.1 - fx * 1.0; tz = p.z + rz * 1.1 - fz * 1.0;
  const d = Math.hypot(tx - q.x, tz - q.z), dp = Math.hypot(p.x - q.x, p.z - q.z);
  if (dp > 18) { q.x = tx; q.z = tz; return; }
  if (d > (q.moving ? 0.25 : 1.6)) {
    if (!stepChar(q, tx - q.x, tz - q.z, dt, clamp(d * 1.6, 2.2, 5.2))) { q.stuck += dt; if (q.stuck > 2) { if (canStand(tx, tz)) { q.x = tx; q.z = tz; } q.stuck = 0; } }
    else q.stuck = 0;
  } else {
    q.moving = false;
    // 站著時看向你
    const want = Math.atan2(p.x - q.x, p.z - q.z); let dd = want - q.ry; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); q.ry += dd * Math.min(1, dt * 3);
  }
}

// ---------- 情侶互動 ----------
function toggleLoveMenu(force) {
  const m = $('#love-menu'); m.hidden = force === undefined ? !m.hidden : !force;
  // 另一半不在：只留自己能做的動作
  const alone = you().ghost; m.querySelectorAll('[data-l]').forEach(b => { b.hidden = (alone && ['hand', 'hug', 'kiss', 'pat'].includes(b.dataset.l)) || (MP.role === 'g' && ['miss', 'note'].includes(b.dataset.l)); });
  let tip = m.querySelector('.tip'); if (!tip) { tip = document.createElement('p'); tip.className = 'tip muted'; tip.style.cssText = 'grid-column:1/-1;margin:2px 4px 0;font-size:var(--fs-xs)'; m.appendChild(tip); }
  tip.textContent = alone ? (MP.role === 'g' ? '朋友可以揮手、跳舞、一起跳' : '另一半上線後，就能牽手、抱抱、親親（🌐 邀請）') : '';
  m.querySelector('[data-l="hand"]').setAttribute('aria-pressed', String(!!(MP.lead || MP.led)));
}
$('#btn-love').onclick = () => toggleLoveMenu();
$('#love-menu').addEventListener('click', e => { const b = e.target.closest('[data-l]'); if (!b) return; toggleLoveMenu(false); loveAction(b.dataset.l); });
function loveAction(kind) {
  sfx('click');
  if (kind === 'miss') return sendMiss();
  if (kind === 'note') return openNotes();
  if (kind === 'qa') return openQA();
  if (kind === 'letter') return writeLetter();
  if (MP.role === 'g' || you().ghost) { // 朋友、或另一半不在：只能做自己的動作
    const solo = { dance: 'dance', jump: 'jump', spin: 'cheer', wave: 'wave' }[kind];
    if (solo) { me().av.emote(solo, solo === 'dance' ? 6 : 1.5); burst(kind === 'dance' ? 'note' : 'star', headPos(me(), 1.3), 4, 0.3); }
    else toast(MP.role === 'g' ? '這是島主之間的互動喔' : '另一半上線後才能一起做喔');
    return;
  }
  if (MP.on && you().remote && LOVE_WORD[kind]) { requestLove(kind); return; }
  if (MP.on && you().remote && (kind === 'dance' || kind === 'jump' || kind === 'spin')) { me().av.emote(kind === 'spin' ? 'cheer' : kind, kind === 'dance' ? 6 : 1.5); burst('note', headPos(me(), 1.3), 4, 0.3); addLove(1, null, kind); return; }
  if (kind === 'hand') {
    if (act || scene === 'in' && false) return;
    st.hand = !st.hand; save();
    if (st.hand) { toast(`${nameOf(me().i)} 牽起了 ${nameOf(you().i)} 的手 🤝`); addLove(2, null, 'hand'); burst('heart', midPos(1.3), 3); }
    else toast('放開手了');
    return;
  }
  if (act) { // 活動中：就地做動作
    const [a, b] = [me().av, you().av];
    if (kind === 'kiss') { a.emote('kiss', 1.4); b.emote('shy', 1.6); } else if (kind === 'hug') { a.emote('hug', 1.6); b.emote('hug', 1.6); } else { a.emote(kind === 'jump' ? 'cheer' : 'pat', 1.4); b.emote('shy', 1.4); }
    burst('heart', midPos(), kind === 'kiss' ? 9 : 5); sfx('pop'); addLove(kind === 'kiss' ? 3 : 2, null, kind);
    return;
  }
  if (kind === 'wave') { me().av.emote('wave', 1.5); you().av.emote('wave', 1.5); return; }
  if (kind === 'dance') { me().av.emote('dance', 6); you().av.emote('dance', 6); burst('note', midPos(), 6); addLove(2, '一起跳舞～', 'dance'); sfx('pop'); return; }
  if (kind === 'spin') { me().spinT = 1.1; you().av.emote('clap', 1.4); burst('star', headPos(me(), 1.2), 6); addLove(1, '轉圈圈～', 'spin'); sfx('pop'); return; }
  lovePending = { kind, t: 0 }; me().path = null;
}
function doLove(kind) {
  const p = me(), q = you();
  p.ry = Math.atan2(q.x - p.x, q.z - p.z); q.ry = Math.atan2(p.x - q.x, p.z - q.z);
  const n = { hug: 2, kiss: 3, pat: 2, jump: 1 }[kind] || 1;
  loveHold = kind === 'jump' ? 1.4 : 2.2; p.path = null;
  if (kind === 'hug') { p.av.emote('hug', 1.8); q.av.emote('hug', 1.8); burst('heart', midPos(), 6); toast(`${nameOf(p.i)} 抱住了 ${nameOf(q.i)} 🤗`); }
  if (kind === 'kiss') { p.av.emote('kiss', 1.5); setTimeout(() => q.av.emote('shy', 1.8), 500); setTimeout(() => burst('heart', midPos(1.55), 10, 0.4), 450); toast(`啾 😘`); }
  if (kind === 'pat') { p.av.emote('pat', 1.6); q.av.emote('shy', 1.6); burst('heart', headPos(q, 1.8), 4, 0.3); toast(`摸摸 ${nameOf(q.i)} 的頭`); }
  if (kind === 'jump') { p.av.emote('jump', 1.3); q.av.emote('jump', 1.3); burst('star', midPos(), 6); }
  sfx('pop'); addLove(n, null, kind);
}

// ---------- 換人操作 ----------
$('#btn-swap').onclick = () => {
  if (MP.on) return toast('連線中，每個人操作自己的角色');
  if (act) return toast('先離開目前的活動喔');
  st.ctrl = 1 - st.ctrl; save(); updateHud(); me().path = null; you().path = null; me().stuck = you().stuck = 0;
  toast(`現在操作：${nameOf(st.ctrl)}`); me().av.emote('wave', 1.2); sfx('click');
};

// ---------- 活動系統 ----------
let act = null;
const started = () => !preview.on;
const v3 = new THREE.Vector3();
let lastMeSeat = null;
function seat(c, x, y, z, ry, pose = 'sit') {
  if (c.ghost) return;
  // 另一半是真人：他已經坐在我要坐的位置，我就坐他的位置
  if (c.remote) { if (lastMeSeat && Math.hypot(c.x - lastMeSeat[0], c.z - lastMeSeat[1]) < 0.4) { lastMeSeat = null; seat(me(), x, y, z, ry, pose); } return; }
  if (c === me()) lastMeSeat = [x, z];
  c.locked = true; c.path = null; c.x = x; c.z = z; c.y = y; c.ry = ry; c.moving = false; c.av.setPose(pose); c.av.holdHand(0); }
function unseat(c) { if (c.ghost || c.remote) return; c.av.reclineAng = null; c.locked = false; c.y = null; c.tilt = 0; c.moving = false; c.av.setPose('stand'); c.av.reach(false); c.av.lean(0); c.av.setItem(null); }
function setBtns(list) {
  const box = $('#ap-btns'); box.innerHTML = '';
  list.filter(Boolean).forEach(b => {
    // 按鈕文字：一行主標＋一行小字說明（「撿雞蛋（還有 2 顆）」→ 主標「撿雞蛋」、小字「還有 2 顆」）；開頭的表情符號拿掉，版面比較乾淨
    let t = String(b.t).trim(), sub = b.s || '';
    const sp = t.indexOf(' '); if (sp > 0 && sp <= 3 && !/[\u4e00-\u9fffA-Za-z0-9]/.test(t.slice(0, sp))) t = t.slice(sp + 1);
    const m = !sub && t.match(/^(.+?)\s*[（(](.+)[）)]$/); if (m) { t = m[1]; sub = m[2]; }
    const el = document.createElement('button'); el.type = 'button'; el.innerHTML = `<span class="bl">${esc(t)}</span>${sub ? `<span class="bs">${esc(sub)}</span>` : ''}`; el.setAttribute('aria-label', sub ? `${t}，${sub}` : t); if (b.main) el.className = 'main'; if (b.dis) el.disabled = true; if (b.id) el.id = b.id;
    if (b.hold) { el.addEventListener('pointerdown', e => { e.preventDefault(); el.setPointerCapture(e.pointerId); b.hold(true); }); const up = () => b.hold(false); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('contextmenu', e => e.preventDefault()); }
    else el.onclick = () => { sfx('click'); b.fn(); };
    box.appendChild(el);
  });
  box.dataset.n = box.children.length; box.classList.toggle('lead', !!box.querySelector('.main') && box.firstElementChild?.classList.contains('main'));
}
const msg = t => { $('#ap-msg').textContent = t; };
function meter(on, v = 0, zone) { const m = $('#ap-meter'); m.hidden = !on; if (!on) return; m.querySelector('i').style.width = (v * 100) + '%'; if (zone) { const em = m.querySelector('em'); em.style.left = zone[0] * 100 + '%'; em.style.width = (zone[1] - zone[0]) * 100 + '%'; } }
/* 生活動作（坐、躺、爬燈塔…）：無縫，不進獨立畫面；搖桿照常，推一下就站起來；按鈕變成角色旁的小按鈕 */
const LH_AT = [-19.2 + 4.6, -19.2 + 1.2]; /* 燈塔樓梯口 */
const FREE_ACTS = new Set(['swing', 'hammock', 'picnic', 'sunbathe', 'sunset', 'bed', 'sofa', 'read', 'seat', 'desk', 'lighthouse', 'tent', 'treebench', 'guitar']);
function beginAct(id, title, text, o = {}) {
  act = { id, t: 0, ...o, free: FREE_ACTS.has(id) && !o.move }; $('#act-panel').hidden = false; $('#act-panel').classList.toggle('free', act.free);
  if (act.free && !st.freeTip) { st.freeTip = 1; save(); setTimeout(() => toast('推一下搖桿就會站起來', 3500), 1200); } $('#ap-title').textContent = title; msg(text); meter(false); setBtns(o.btns || []);
  toggleLoveMenu(false); $('#btn-act').hidden = true; if (!o.move && !act.free) $('#joy').style.visibility = 'hidden';
  $('#act-panel').classList.toggle('at-top', !!o.move); // 可以走動的活動：面板放上面，不擋搖桿
  // 有些活動要看向特定方向（海、夕陽、煙火）
  act.camBack = { yaw: view.yaw, pitch: view.pitch };
  if (o.camYaw != null) { view.yaw = o.camYaw; if (o.camPitch != null) view.pitch = o.camPitch; }
}
function endAct() {
  if (!act) return; const a = act; act = null;
  const from_ = localChars().filter(c => c.av?.root).map(c => [c, c.av.root.position.clone()]);
  a.end?.(); chars.forEach(unseat); if (guestChar) unseat(guestChar); $('#act-panel').classList.remove('free');
  if (tutorial.step === 2 && a.id !== 'place') tutorialNext();
  if (a.camBack && a.camYaw != null) { view.yaw = a.camBack.yaw; view.pitch = a.camBack.pitch; } $('#act-panel').hidden = true; $('#joy').style.visibility = '';
  // 站到活動地點旁邊
  if (a.back) { const [x, z] = a.back; const p = me(), q = you(); [p.x, p.z] = freeSpot(x, z); [q.x, q.z] = freeSpot(p.x + 0.9, p.z + 0.5); }
  chars.forEach(c => { if (!canStand(c.x, c.z)) [c.x, c.z] = freeSpot(c.x, c.z); });
  from_.forEach(([c, f]) => { const y = groundY(c); if (Math.hypot(f.x - c.x, f.y - y, f.z - c.z) < 14) c.glide = { dx: f.x - c.x, dy: f.y - y, dz: f.z - c.z, t: 0 }; }); /* 站起來也是滑過去，不是瞬間移動 */
}
$('#ap-close').onclick = () => { sfx('click'); endAct(); };
// 兩個人坐成一排：中心、朝向、間距
function sitPair(x, y, z, ry, gap = 0.5, pose = 'sit') {
  const rx = -Math.cos(ry), rz = Math.sin(ry);
  seat(me(), x - rx * gap / 2, y, z - rz * gap / 2, ry, pose); seat(you(), x + rx * gap / 2, y, z + rz * gap / 2, ry, pose);
}

// ---------- 地點 ----------
const SP = [
  { id: 'door', sc: 'out', ...SPOTS.door, r: 1.8, icon: '🏠', name: '回小木屋', run: enterHouse },
  { id: 'mailbox', sc: 'out', ...SPOTS.mailbox, icon: '💌', name: '信箱', run: openMail, badge: () => st.letterDay !== st.day || !!unreadLetters().length },
  { id: 'garden', sc: 'out', ...SPOTS.garden, r: 2.6, icon: '🌱', name: '菜園', run: actGarden },
  { id: 'swing', sc: 'out', x: SPOTS.swing.x, z: SPOTS.swing.z + 1.4, icon: '🎠', name: '雙人鞦韆', run: actSwing },
  { id: 'hammock', sc: 'out', x: SPOTS.hammock.x, z: SPOTS.hammock.z + 1.3, icon: '💤', name: '吊床', run: actHammock },
  { id: 'campfire', sc: 'out', x: SPOTS.campfire.x - 1.8, z: SPOTS.campfire.z, r: 2.6, icon: '🔥', name: '營火', run: actCampfire },
  { id: 'picnic', sc: 'out', x: SPOTS.picnic.x, z: SPOTS.picnic.z + 1.6, icon: '🧺', name: '野餐', run: actPicnic },
  { id: 'sunbathe', sc: 'out', x: SPOTS.sunbathe.x, z: SPOTS.sunbathe.z - 1.6, icon: '🏖️', name: '曬太陽', run: actSunbathe },
  { id: 'wade', sc: 'out', x: WADE.x - Math.cos(WADE.a) * 1.2, z: WADE.z - Math.sin(WADE.a) * 1.2, r: 2, icon: '🌊', name: '踩浪花', run: actWade },
  { id: 'sandcastle', sc: 'out', ...SPOTS.sandcastle, icon: '🏰', name: '堆沙堡', run: actSand },
  { id: 'beach', sc: 'out', ...SPOTS.beach, icon: '🪁', name: '放風箏', run: actBeach, dyn: () => isNight() ? ['🎆', '放煙火'] : ['🪁', '放風箏'] },
  { id: 'fishing', sc: 'out', x: SPOTS.fishing.x - 1, z: 0, r: 2.4, icon: '🎣', name: '釣魚', run: actFish },
  { id: 'boat', sc: 'out', x: SPOTS.boat.x, z: 0.2, r: 2, icon: '🚣', name: '划船', run: actBoat },
  { id: 'sunset', sc: 'out', x: SPOTS.sunset.x + 1.4, z: SPOTS.sunset.z + 0.4, icon: '🌅', name: '看夕陽', run: actSunset, dyn: () => isNight() ? ['🌠', '看星星'] : ['🌅', '看夕陽'] },
  { id: 'dog', sc: 'out', x: 0, z: 0, r: 1.8, icon: '🐶', name: '狗狗', run: actDog, pos: () => W.dog?.o.position },
  { id: 'coop', sc: 'out', x: SPOTS.coop.x, z: SPOTS.coop.z + 1.9, icon: '🐔', name: '雞舍', run: () => actCoop() },
  { id: 'bike', sc: 'out', x: 0, z: 0, r: 1.8, icon: '🚲', name: '腳踏車', run: () => actBike(), pos: () => W.bike?.position, hide: () => act?.id === 'bike' },
  { id: 'snowman', sc: 'out', x: 3.5, z: 12.4, icon: '⛄', name: '堆雪人', run: () => actSnowman(), hide: () => seasonOf(st.day).k !== 'winter' },
  { id: 'tree', sc: 'out', x: TREE.x, z: TREE.z + 1.3, icon: '🌳', name: '愛情樹', run: actTree, badge: () => !treeCaredByMe(), dyn: () => treeLonely() ? ['🥺', '小樹想你們了'] : ['🌳', '愛情樹'] },
  { id: 'treebench', sc: 'out', x: TREE.x + 1.7, z: TREE.z + 1.3, r: 1.4, icon: '🪵', name: '樹下長椅', run: actTreeBench, hide: () => LV().lv < 8 },
  { id: 'surprise', sc: 'out', x: 0, z: 0, r: 1.8, icon: '🎁', name: '驚喜', run: actSurprise, pos: () => SUR.obj?.position || { x: 999, z: 999 }, hide: () => !SUR.obj || surpriseDone(), dyn: () => [surpriseToday().icon, surpriseToday().name] },
  { id: 'hut', sc: 'out', x: PLACES.hut.x, z: PLACES.hut.z + 3.0, icon: '🏖️', name: '海邊小屋', run: actHut, dyn: () => placeOpen('hut') ? ['🏖️', '海邊小屋'] : ['🔒', '海邊小屋（Lv3 解鎖）'] },
  { id: 'gh', sc: 'out', x: PLACES.gh.x + 3.2, z: PLACES.gh.z, icon: '🌷', name: '花園溫室', run: actGreenhouse, dyn: () => placeOpen('gh') ? ['🌷', '花園溫室'] : ['🔒', '花園溫室（Lv5 解鎖）'] },
  { id: 'puzzle', sc: 'in', x: PZ_AT.x + 1.25, z: PZ_AT.z + 0.4, r: 1.3, icon: '🧩', name: '拼圖', run: actPuzzle },
  { id: 'fridge', sc: 'in', x: 6.2, z: -3.3, r: 1.2, icon: '📝', name: '冰箱便利貼', run: openNotes, badge: () => (st.notes || []).some(n => n.by !== myIdx() && n.ts > (st.notesRead || 0)) },
  { id: 'exit', sc: 'in', ...INSPOTS.exit, r: 1.6, icon: '🚪', name: '出門', run: exitHouse },
  { id: 'bed', sc: 'in', ...INSPOTS.bed, icon: '🛏️', name: '床', run: actBed },
  { id: 'sofa', sc: 'in', ...INSPOTS.sofa, icon: '🛋️', name: '沙發', run: actSofa },
  { id: 'kitchen', sc: 'in', ...INSPOTS.kitchen, icon: '🍳', name: '做飯', run: actCook },
  { id: 'read', sc: 'in', ...INSPOTS.read, icon: '📚', name: '閱讀角', run: actRead },
  { id: 'dining', sc: 'in', ...INSPOTS.dining, icon: '🍽️', name: '吃飯', run: actEat, hide: () => !IN?.dish.visible },
  { id: 'lighthouse', sc: 'out', x: LH_AT[0], z: LH_AT[1], r: 2.6, icon: '🗼', name: '爬燈塔', run: actLighthouse },
  { id: 'tent', sc: 'out', x: 14.6, z: 10.4, r: 1.8, icon: '⛺', name: '帳篷', run: actTent },
  { id: 'ball', sc: 'out', x: 0, z: 0, r: 1.6, icon: '⚽', name: '踢海灘球', run: kickBall, pos: () => W?.ball?.position || { x: 999, z: 999 }, hide: () => !W?.ball },
  ...[[-12.6, 10.6], [-13.5, -16.5], [7, -7.5]].map(([x, z], i) => ({ id: 'sakura' + i, sc: 'out', x, z: z + 1.5, r: 1.8, icon: '🌸', name: '搖櫻花樹', run: () => shakeTree(x, z) })),
  { id: 'desk', sc: 'in', x: 5.3, z: -1.5, r: 1.3, icon: '✍️', name: '書桌', run: () => useDesk({ x: 6.52, z: -1.6, sc: 'in', name: '書桌' }, 0) },
  { id: 'guitarIn', sc: 'in', x: 1.5, z: -4.0, r: 1.1, icon: '🎸', name: '彈吉他', run: () => useGuitar({ x: 1.5, z: -4.65 }, 0) },
  ...[[-6.45, 4.5], [1.5, -0.4], [-5.9, -4.6], [-3.3, -4.6]].map(([x, z], i) => ({ id: 'lampIn' + i, sc: 'in', x: x + (x < -6 ? 0.6 : 0), z: z + (z < -4 ? 0.6 : 0.3), r: 0.9, icon: '💡', name: '開關燈', run: () => useThing({ t: 'lamp' }, { x, z, sc: 'in' }) })),
  ...[[-1.6, -4.5, '大盆栽'], [-6.4, -3.0, '大盆栽'], [6.4, 4.3, '大盆栽'], [2.4, 4.3, '姑婆芋'], [2.45, -4.4, '朱蕉'], [-6.35, 0.25, '蕨類']].map(([x, z, n], i) => ({ id: 'plantIn' + i, sc: 'in', x: x + (x > 0 ? -0.5 : 0.5), z: z + (z > 0 ? -0.5 : 0.5), r: 0.9, icon: '🌿', name: '澆花', run: () => useThing({ t: 'plant' }, { x, z, sc: 'in', name: n }) })),
  { id: 'santa', sc: 'out', x: 0, z: 0, r: 1.8, icon: '🎅', name: '聖誕老公公', run: santaGift, pos: () => SEASON.santa?.o.position || { x: 999, z: 999 }, hide: () => !SEASON.santa },
  { id: 'wardrobe', sc: 'in', x: -5.7, z: -1.2, icon: '👗', name: '衣櫃', run: () => openLooks() },
];
SP.forEach(s => {
  s.r = s.r || 2.2;
  const el = document.createElement('button'); el.type = 'button'; el.className = 'lbl'; el.textContent = `${s.icon} ${s.name}`; el.style.display = 'none';
  el.onclick = () => { if (act || !started()) return; const p = s.pos?.() || s; route(me(), p.x, p.z, s); sfx('click'); };
  $('#labels').appendChild(el); s.el = el;
});
const nameEls = new Map();
// 朋友不能用的地點（島主專屬）
const OWNER_ONLY = ['mailbox', 'garden', 'bed', 'wardrobe', 'tree', 'treebench', 'surprise', 'fridge', 'puzzle', 'gh'];
const spotHidden = s => s.hide?.() || (MP.role === 'g' && OWNER_ONLY.includes(s.id));
let nearSpot = null;
// 名字標籤跟著頭走：站著時跟以前一樣高（1.95），坐下、躺下、陷進沙發時一起往下，不會飄在半空中
const _tagV = new THREE.Vector3(); let TAG_UP = null;
function tagPos(c, out) {
  const r = c.av.root.position, h = c.av.head;
  if (!h) return out.copy(r).setY(r.y + (c.av.pose === 'lie' ? 0.8 : 1.95));
  h.getWorldPosition(_tagV);
  if (TAG_UP == null && c.av.pose === 'stand' && !c.moving) TAG_UP = Math.max(0.3, 1.95 - (_tagV.y - r.y)); // 第一次站著時量一次頭到標籤的距離
  return out.copy(_tagV).setY(_tagV.y + (c.av.pose === 'lie' ? 0.45 : TAG_UP ?? 0.75));
}
function tickSpots() {
  const p = me(); let best = null, bd = 1e9; const ALL = DSP.length ? SP.concat(DSP) : SP;
  for (const s of ALL) {
    const pp = s.pos?.() || s; const show = s.sc === scene && started() && !photo.on && !lookCam && !build && !spotHidden(s);
    const d = Math.hypot(pp.x - p.x, pp.z - p.z);
    if (s.dyn) { const [ic, nm] = s.dyn(); if (s.icon !== ic) { s.icon = ic; s.name = nm; s.el.textContent = `${ic} ${nm}`; } }
    if (show && !act && d < s.r && d < bd) { bd = d; best = s; }
    /* 標籤只在走近時才淡淡出現（屋內約 2.8 公尺、屋外 7 公尺；有新東西的地點遠一點就看得到） */
    const R = (scene === 'in' ? 2.8 : 7) * (s.badge?.() ? 1.8 : 1), fade = Math.min(1, (R - d) / (R * 0.35));
    s.lblK = show && !act ? fade : 0; s.lblD = d;
  }
  /* 最多同時顯示 3 個最近的；已經出現在右下角按鈕的那個不重複顯示 */
  const cand = ALL.filter(s => s.lblK > 0 && s !== best).sort((a, b) => a.lblD - b.lblD).slice(0, 3);
  for (const s of ALL) {
    const pp = s.pos?.() || s;
    if (!cand.includes(s)) { if (s.el.style.display !== 'none') s.el.style.display = 'none'; continue; }
    const y = scene === 'in' ? 2.1 : (s.id === 'dog' ? pp.y + 1.2 : standH(pp.x, pp.z) + 2.0);
    v3.set(pp.x, y, pp.z).project(cam);
    if (v3.z > 1) { s.el.style.display = 'none'; continue; }
    s.el.style.display = ''; s.el.style.left = ((v3.x + 1) / 2 * innerWidth) + 'px'; s.el.style.top = ((1 - v3.y) / 2 * innerHeight) + 'px';
    s.el.style.opacity = s.lblK.toFixed(2); s.el.style.setProperty('--k', (0.86 + 0.14 * s.lblK).toFixed(3));
    if (s.badge) s.el.textContent = `${s.icon} ${s.name}${s.badge() ? ' ●' : ''}`;
  }
  tickSay();
  if (act?.free) { /* 小按鈕放在角色（頭到腳）旁邊，不擋到臉和身體 */
    const el = $('#act-panel'), w = el.offsetWidth || 130, h = el.offsetHeight || 80; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const c of [me(), duo() && Math.hypot(you().x - me().x, you().z - me().z) < 2.5 ? you() : null]) { if (!c?.av?.bones) continue;
      for (const [bn, up] of [['Head', 0.55], ['Head', -0.1], ['Hips', 0], ['LeftFoot', 0], ['RightFoot', 0]]) { const b = c.av.bones[bn]; if (!b) continue; b.getWorldPosition(v3); v3.y += up; v3.project(cam); if (v3.z > 1) continue; const sx = (v3.x + 1) / 2 * innerWidth, sy = (1 - v3.y) / 2 * innerHeight; x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy); } }
    if (x0 < 1e8) { const pad = 46; x0 -= pad; x1 += pad; let x = x1 + 6, y = (y0 + y1) / 2 - h / 2;
      if (x + w > innerWidth - 8) x = x0 - w - 6; if (x < 8) { x = clamp((x0 + x1) / 2 - w / 2, 8, innerWidth - w - 8); y = y1 + 14; } /* 左右都放不下：放到腳下面 */
      x = clamp(x, 8, innerWidth - w - 8); y = clamp(y, 150, innerHeight - h - 200); const P = act._chip || (act._chip = { x, y }); if (Math.hypot(x - P.x, y - P.y) > 4) { P.x += (x - P.x) * 0.18; P.y += (y - P.y) * 0.18; }
      P.x = clamp(P.x, 8, innerWidth - w - 8); el.style.setProperty('--fx', P.x.toFixed(0) + 'px'); el.style.setProperty('--fy', P.y.toFixed(0) + 'px'); }
  }
  // 名字（頭上）
  const seen = new Set();
  for (const c of allChars()) {
    let e = nameEls.get(c); if (!e) { e = document.createElement('div'); e.className = 'lbl name'; $('#labels').appendChild(e); nameEls.set(c, e); }
    seen.add(c);
    if (!started() || photo.on || build || !c.av.root.visible || (c === me() && !MP.peers.size)) { e.style.display = 'none'; continue; } /* 只有自己在島上時，不用在頭上標自己的名字 */
    tagPos(c, v3); v3.project(cam);
    if (v3.z > 1) { e.style.display = 'none'; continue; }
    const tag = c.i === 'g' ? '🎈 ' : c.remote ? '💗 ' : '';
    e.style.display = ''; e.textContent = (c === me() ? '▼ ' : tag) + charName(c); e.style.left = ((v3.x + 1) / 2 * innerWidth) + 'px'; e.style.top = ((1 - v3.y) / 2 * innerHeight) + 'px';
  }
  for (const [c, e] of nameEls) if (!seen.has(c)) { e.remove(); nameEls.delete(c); }
  if (best !== nearSpot) {
    nearSpot = best; const b = $('#btn-act');
    if (best) { $('#act-icon').textContent = best.icon; $('#act-name').textContent = best.name; b.hidden = false; b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; }
    else b.hidden = true;
  }
}
$('#btn-act').onclick = () => { if (nearSpot && !act) { sfx('click'); nearSpot.run(); } };

// ---------- 小木屋：進出 ----------
async function enterHouse(at) {
  if (!IN) { toast('小屋整理中，稍等一下…'); IN = await buildInterior(st.theme || 'muji'); }
  await fadeDo(() => {
    scene = 'in'; localChars().forEach(c => { c.sc = 'in'; c.path = null; c.y = null; });
    const p = me(), q = you(); p.x = INSPOTS.exit.x - 0.4; p.z = INSPOTS.exit.z - 0.6; p.ry = Math.PI; if (partnerLocal()) { q.x = p.x - 0.8; q.z = p.z + 0.2; q.ry = Math.PI; }
    view.inYaw = 0; nearSpot = null;
    if (at && Number.isFinite(at.x)) { [p.x, p.z] = freeSpot(at.x, at.z); p.ry = at.ry || 0; view.inYaw = at.yaw || 0; }
    applyLamps(); updateCam(0, true); if (xmasSeason() && !SEASON.in) seasonIn();
  });
  sfx('door-open');
}
async function exitHouse() {
  await fadeDo(() => {
    scene = 'out'; localChars().forEach(c => { c.sc = 'out'; c.path = null; c.y = null; });
    const p = me(), q = you(); p.x = SPOTS.door.x; p.z = SPOTS.door.z + 1.4; p.ry = 0; if (partnerLocal()) { q.x = p.x + 0.8; q.z = p.z + 0.3; q.ry = 0; }
    view.yaw = 0; nearSpot = null;
  });
  sfx('door-close');
}

// ---------- 信箱：另一半寫的情書（每天一封） ----------
/* 信箱：另一半真的寫的信優先；沒有的話是「小島郵差」每天的來信。可以寫信寄給另一半 */
const unreadLetters = () => (st.letters || []).filter(l => l.by !== myIdx() && !l.read?.[myIdx()]);
function openMail() {
  if (MP.role === 'g') return; me().av.emote('interact', 1.4);
  const L = unreadLetters()[0];
  if (L) {
    L.read = L.read || [0, 0]; L.read[myIdx()] = 1; save(); addLove(3, null, 'letter'); addMemo('💌', `收到 ${nameOf(L.by)} 寫的信`, 'mail');
    openDlg('💌 你的信', `<div class="letter">${esc(L.text).replace(/\n/g, '<br>')}<br><br>—— ${esc(nameOf(L.by))}</div><p class="muted">${new Date(L.ts).getMonth() + 1} 月 ${new Date(L.ts).getDate()} 日寄出${unreadLetters().length ? `・還有 ${unreadLetters().length} 封沒看` : ''}</p><div class="row"><button type="button" class="ghost" id="ml-old">以前的信</button><button type="button" class="primary" id="ml-write">✍️ 回信</button></div>`);
    burst('heart', headPos(me()), 6); sfx('chime');
  } else {
    const fresh = st.letterDay !== st.day, idx = (st.day * 7 + (myIdx() ? 3 : 0)) % LETTERS.length;
    const text = LETTERS[idx].replaceAll('{a}', nameOf(me().i)).replaceAll('{b}', nameOf(you().i));
    openDlg('💌 小島來信', `<div class="letter">${esc(text).replace(/\n/g, '<br>')}</div><p class="muted">${fresh ? '小島郵差每天都會送一封信來。' : '今天的信已經看過了，明天郵差會再來。'}</p><div class="row"><button type="button" class="ghost" id="ml-old">以前的信</button><button type="button" class="primary" id="ml-write">✍️ 寫信給 ${esc(partnerName())}</button></div>`);
    if (fresh) { st.letterDay = st.day; quest('mail'); addLove(2, '收到小島來信'); }
  }
  $('#ml-write').onclick = writeLetter; $('#ml-old').onclick = oldLetters; drawMailFlag();
}
function writeLetter() {
  openDlg('✍️ 寫一封信', `<p class="muted">寫給 ${esc(partnerName())}，會放在對方的信箱裡；對方不在島上時，手機也會收到通知。</p><textarea id="ml-in" class="ml-in" maxlength="300" rows="7" placeholder="${esc(partnerName())}：\n"></textarea><p class="muted ml-n"><span id="ml-n">0</span> / 300</p><button type="button" class="primary" id="ml-send">💌 寄出</button>`);
  const inp = $('#ml-in'); setTimeout(() => inp.focus({ preventScroll: true }), 250); inp.oninput = () => { $('#ml-n').textContent = inp.value.length; };
  $('#ml-send').onclick = () => {
    const text = inp.value.trim().slice(0, 300); if (!text) { inp.focus(); return toast('寫點什麼再寄出吧'); }
    st.letters = [{ id: Math.random().toString(36).slice(2, 10), by: myIdx(), text, ts: Date.now(), read: [0, 0] }, ...(st.letters || [])].slice(0, 30);
    save(); addLove(3, null, 'letter'); addMemo('💌', `${nameOf(myIdx())} 寫了一封信給 ${partnerName()}`, 'mail'); $('#dlg').close();
    if (MP.on) MP.net.send({ t: 'nudge', k: 'letter', text: text.slice(0, 40) }); else toast(`信寄出了，${partnerName()} 下次打開小島就會在信箱看到 💌`, 4000);
    burst('heart', headPos(me(), 1.3), 8); sfx('chime');
  };
}
function oldLetters() {
  const list = (st.letters || []).slice(0, 30);
  openDlg('💌 我們的信', list.length ? list.map(l => `<div class="letter old-letter"><small>${esc(nameOf(l.by))} 寫給 ${esc(nameOf(1 - l.by))}・${new Date(l.ts).getMonth() + 1}/${new Date(l.ts).getDate()}</small><br>${esc(l.text).replace(/\n/g, '<br>')}</div>`).join('') : `<p class="muted">還沒有寫過信。寫一封給 ${esc(partnerName())} 吧。</p><button type="button" class="primary" id="ml-write2">✍️ 寫信</button>`);
  $('#ml-write2')?.addEventListener('click', writeLetter);
}
/* 信箱的小旗子：有新的信就立起來（標籤上也有紅點） */
function drawMailFlag() { if (W?.mailFlag) W.mailFlag.visible = !!unreadLetters().length || st.letterDay !== st.day; }
/* 點驚喜的提示：走到驚喜那裡 */
function goSurprise() {
  if (scene !== 'out') return toast('驚喜在屋外，出門看看吧'); const sp = SP.find(x => x.id === 'surprise'), p = sp?.pos?.();
  if (!SUR.obj || !p || p.x === 999) return openQuests(); route(me(), p.x, p.z, sp);
}

// ---------- 雙人鞦韆 ----------
function actSwing() {
  const sw = W.swing, pv = sw.userData.pivot, seatG = sw.userData.seat;
  let amp = 0.18, ph = 0, tick = 0;
  const mine = you().remote && you().act === 'swing' && you().x < SPOTS.swing.x ? 0.42 : -0.42;
  const place = () => {
    [[me(), mine], [you(), -mine]].forEach(([c, x]) => { if (c.remote || c.ghost) return; seatG.localToWorld(v3.set(x, 0.05, 0.02)); c.locked = true; c.x = v3.x; c.z = v3.z; c.y = v3.y - HIP; c.ry = 0; c.tilt = pv.rotation.x; c.av.setPose('swing'); });
  };
  actGo(place, 250); quest('swing');
  beginAct('swing', '🎠 雙人鞦韆', '兩個人一起盪鞦韆，風好舒服。', {
    focus: () => new THREE.Vector3(SPOTS.swing.x, LAND_Y + 1.4, SPOTS.swing.z), back: [SPOTS.swing.x, SPOTS.swing.z + 1.8],
    btns: [{ t: '用力盪！', main: true, fn: () => { amp = Math.min(0.62, amp + 0.12); me().av.emote('cheer', 0.8); sfx('whoosh'); } }, duo() && { t: '靠在肩膀上', fn: () => { you().av.lean(-1); me().av.lean(1); burst('heart', midPos(1.3), 4); addLove(2, '靠在一起', 'lean'); setTimeout(() => { you().av.lean(0); me().av.lean(0); }, 4000); } }],
    update(dt) {
      ph += dt * 1.9; amp = Math.max(0.12, amp - dt * 0.02); pv.rotation.x = Math.sin(ph) * amp; place();
      tick += dt; if (tick > 9) { tick = 0; addLove(1, '盪鞦韆'); burst('heart', midPos(1.2), 3); }
    },
    end() { pv.rotation.x = 0; addMemo('🎠', '一起盪了雙人鞦韆'); },
  });
}

// ---------- 吊床 ----------
function actHammock() {
  const { x, z } = SPOTS.hammock, y = LAND_Y + 0.5; /* 吊床布最低點約在 1.1 公尺 */
  actGo(() => { [me(), you()].forEach(c => { c.av.lieTilt = 0.24; }); seat(me(), x + 0.58, y + 0.04, z - 0.2, Math.PI / 2, 'lie'); seat(you(), x + 0.58, y + 0.04, z + 0.2, Math.PI / 2, 'lie'); }, 250);
  let nap = false, zt = 0;
  beginAct('hammock', '💤 吊床', '兩個人擠在吊床上，搖啊搖。', {
    focus: () => new THREE.Vector3(x, LAND_Y + 1, z), back: [x, z + 1.6],
    btns: [{ t: duo() ? '一起睡午覺' : '睡個午覺', main: true, fn: () => { nap = true; msg('呼…呼…海風好舒服。'); } }, duo() && { t: '說悄悄話', fn: () => { you().av.emote('shy', 1.6); burst('heart', midPos(0.6), 4); addLove(2, pick(['「我好喜歡你」', '「今天也謝謝你」', '「下次一起去看海」']), 'whisper'); } }],
    update(dt) {
      zt += dt; if (nap) { if (zt > 1.2) { zt = 0; burst('z', midPos(0.7), 1, 0.2); } if (Math.random() < dt / 8) addLove(1); }
    },
    end() { [me(), you()].forEach(c => { c.av.lieTilt = 0; }); if (nap) addMemo('💤', '在吊床上一起睡了午覺'); else addMemo('💤', '一起躺在吊床上聊天'); },
  });
}

// ---------- 營火：烤棉花糖、彈吉他 ----------
function stickItem() {
  const g = new THREE.Group(); const st_ = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.0, 5), toon('#8a5a32')); st_.position.y = 0.4; g.add(st_);
  const mm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.09, 10), toon('#ffffff')); mm.position.y = 0.88; g.add(mm); g.rotation.x = 1.25; g.userData.mm = mm; return g;
}
// 澆花用的水壺
function canItem() { const g = new THREE.Group(), m = toon('#6ab0d8'); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.16, 12), m); b.position.set(0, -0.08, 0.1); g.add(b); const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.22, 6), m); sp.position.set(0, -0.04, 0.26); sp.rotation.x = 1.0; g.add(sp); return g; }
// 營火旁那把吉他（同一個模型），橫抱在腿上：琴身在右腿、琴頸往左上
function guitarItem() {
  const g = new THREE.Group(); if (!W.guitar) return g;
  const m = W.guitar.clone(true); m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.setScalar(GUITAR.scale);
  const tilt = new THREE.Group(); tilt.rotation.z = -(Math.PI / 2 - GUITAR.tilt); tilt.add(m); m.position.y = -0.22 * GUITAR.scale; // 琴身中心對準腿上
  g.add(tilt); return g;
}
function actCampfire() {
  const { x, z } = SPOTS.campfire, y = LAND_Y + 0.46 - HIP;
  actGo(() => sitPair(x, y, z - 1.9, 0, 0.62), 250);
  let roast = null, heat = 0, guitar = false, gt = 0, made = 0;
  const ZONE = [0.52, 0.74];
  const roastBtns = () => setBtns([{ t: '按住烤棉花糖', main: true, hold: on => { if (on) { if (guitar && !duo()) toggleGuitar(); if (!roast) { roast = stickItem(); me().av.setItem(roast); me().av.reach(true); heat = 0; } roast.userData.on = true; } else if (roast) { roast.userData.on = false; finish(); } } }, { t: guitar ? '停止彈唱' : '🎸 彈吉他', fn: toggleGuitar }]);
  const finish = () => {
    const h = heat; let t;
    if (h < ZONE[0]) t = '還沒烤熟，軟軟白白的…'; else if (h <= ZONE[1]) t = '完美的金黃色！外酥內軟 ✨'; else if (h < 0.92) t = '有點焦，但是很香。'; else t = '燒成黑炭了 😂';
    const good = h >= ZONE[0] && h <= ZONE[1];
    msg(`${t} 餵給 ${nameOf(you().i)} 吃～`); me().av.reach(false);
    setTimeout(() => { me().av.setItem(null); roast = null; meter(true, 0, ZONE); you().av.emote(good ? 'cheer' : 'shy', 1.4); burst('heart', headPos(you(), 1.3), good ? 8 : 3); sfx('pop'); }, 500);
    made++; addLove(good ? 4 : 1, good ? '完美棉花糖' : null, good ? null : 'mm'); if (good) { quest('marsh'); addCoins(5); }
    if (good) addMemo('🍡', `${nameOf(me().i)} 烤了完美的棉花糖餵 ${nameOf(you().i)}`);
  };
  const player = () => me(); // 誰按「彈吉他」就是誰彈
  const toggleGuitar = () => { guitar = !guitar; if (guitar && roast) { me().av.setItem(null); roast = null; me().av.reach(false); } player().av.setLap(guitar ? guitarItem() : null); if (W.guitar) W.guitar.visible = !guitar; player().av.emote(guitar ? 'strum' : 'idle', guitar ? 9999 : 0.1); if (guitar) { Music.duet(true); setTimeout(() => { if (guitar && Music.guitarSong) msg(`🎸 正在彈《${Music.guitarSong}》`); }, 1200); msg(duo() ? `拿起吉他彈給 ${nameOf(you().i)} 聽，兩個人一起哼歌 🎶` : '拿起旁邊的吉他，對著營火彈唱 🎶'); addLove(surpriseIs('concert') && isNight() ? 4 : 2, '營火邊唱歌', 'guitar'); addMemo('🎸', '在營火邊一起唱歌'); } else Music.duet(false); roastBtns(); };
  beginAct('campfire', '🔥 營火', `按住按鈕烤棉花糖，在粉紅區放開最好吃。`, {
    focus: () => new THREE.Vector3(x, LAND_Y + 0.9, z - 0.6), back: [x - 1.8, z - 2.2],
    update(dt) {
      if (roast?.userData.on) { heat = Math.min(1, heat + dt * 0.28); meter(true, heat, ZONE); const c = new THREE.Color('#ffffff').lerp(new THREE.Color('#e8a040'), clamp(heat / 0.65, 0, 1)).lerp(new THREE.Color('#2a1a10'), clamp((heat - 0.7) / 0.3, 0, 1)); roast.userData.mm.material.color.copy(c); }
      if (guitar) { gt += dt; if (gt > 0.7) { gt = 0; burst('note', headPos(player(), 1.4), 1, 0.3); } }
    },
    end() { Music.duet(false); player().av.emote('idle', 0.1); player().av.setLap(null); if (W.guitar) W.guitar.visible = true; },
  });
  roastBtns(); meter(true, 0, ZONE);
}

// ---------- 野餐 ----------
function actPicnic() {
  const { x, z } = SPOTS.picnic, y = LAND_Y + 0.06 - HIP;
  let lying = false;
  actGo(() => { seat(me(), x - 0.5, y, z + 0.35, 0.5, 'floor'); seat(you(), x + 0.5, y, z + 0.35, -0.5, 'floor'); W.picnic.userData.food.visible = true; }, 250);
  const btns = () => setBtns([duo() ? { t: '餵你吃一口', main: true, fn: () => { me().av.reach(true); setTimeout(() => { me().av.reach(false); you().av.emote('shy', 1.5); burst('heart', headPos(you(), 1.2), 5); sfx('pop'); }, 600); addLove(3, pick(['草莓好甜', '三明治好吃', '西瓜冰冰涼涼']), 'feed'); } } : { t: '吃一口', main: true, fn: () => { me().av.emote('eatseat', 2.2); burst('heart', headPos(me(), 1.2), 2); addLove(1, pick(['草莓好甜', '三明治好吃', '西瓜冰冰涼涼']), 'feed'); } },
    { t: lying ? '坐起來' : '躺下看雲', fn: () => { lying = !lying; if (lying) { seat(me(), x - 0.35, LAND_Y + 0.02, z + 0.9, 0, 'lie'); seat(you(), x + 0.35, LAND_Y + 0.02, z + 0.9, 0, 'lie'); msg(pick(['那朵雲像一隻小狗！', '那朵雲像愛心耶', '那朵雲好像棉花糖'])); addLove(2, null, 'cloud'); } else { seat(me(), x - 0.5, y, z + 0.35, 0.5, 'floor'); seat(you(), x + 0.5, y, z + 0.35, -0.5, 'floor'); } btns(); } }]);
  quest('picnic');
  beginAct('picnic', '🧺 野餐', '櫻花樹下的野餐墊，準備了草莓、西瓜和三明治。', {
    focus: () => new THREE.Vector3(x, LAND_Y + 0.6, z), back: [x, z + 1.8],
    end() { W.picnic.userData.food.visible = false; addMemo('🧺', '在櫻花樹下野餐'); },
  });
  btns();
}

// ---------- 曬太陽 ----------
function actSunbathe() {
  // 躺在椅布上：屁股在椅子中間偏前、抬高，往後靠得比沙發更斜（側面看過，不會陷進椅子）
  const { x, z } = SPOTS.sunbathe, cy = standH(x, z + 0.4) + 0.4 - HIP;
  actGo(() => { [[me(), -0.75], [you(), 0.75]].forEach(([c, dx]) => { seat(c, x + dx, cy, z + 0.5, 0, 'recline'); c.av.reclineAng = 0.75; }); }, 250);
  let t = 0;
  beginAct('sunbathe', '🏖️ 曬太陽', '躺在海灘椅上，聽海浪的聲音。', {
    focus: () => new THREE.Vector3(x, 1, z + 1), back: [x, z - 1.6], camYaw: Math.PI - 0.5, camPitch: 0.3,
    btns: [duo() ? { t: '幫忙擦防曬', main: true, fn: () => { me().av.emote('pat', 1.4); you().av.emote('shy', 1.4); burst('heart', headPos(you(), 1.1), 3); addLove(2, '擦好防曬了', 'sun'); } } : { t: '伸個懶腰', main: true, fn: () => { me().av.emote('cheer', 1.4); addLove(1, '好舒服～', 'sun'); } }, { t: '去踩浪花', fn: () => { endAct(); setTimeout(actWade, 450); } }],
    update(dt) { t += dt; if (t > 12) { t = 0; addLove(1); } },
    end() { addMemo('🏖️', '一起在海灘曬太陽'); },
  });
}

// ---------- 踩浪花：走到浪打上來的地方，踢水、互相潑水 ----------
// 從 (x, z) 往海的方向找水深大約 5 公分的地方（浪會打到腳）
function shorePoint(x, z, depth = -0.05) {
  const a = Math.atan2(z, x); let r = Math.hypot(x, z);
  for (let i = 0; i < 200 && groundH(Math.cos(a) * r, Math.sin(a) * r) > depth; i++) r += 0.1;
  return { x: Math.cos(a) * r, z: Math.sin(a) * r, a };
}
function actWade() {
  const P = shorePoint(me().x, me().z), out = new THREE.Vector3(Math.cos(P.a), 0, Math.sin(P.a)), side = new THREE.Vector3(-out.z, 0, out.x);
  const face = Math.atan2(out.x, out.z), y0 = standH(P.x, P.z);
  const place = (c, k) => { c.locked = true; c.path = null; c.moving = false; c.x = P.x + side.x * k; c.z = P.z + side.z * k; c.y = null; c.ry = face; c.av.setPose('stand'); };
  actGo(() => { place(me(), -0.45); if (!you().ghost && !you().remote) place(you(), 0.45); }, 250);
  let t = 0, next = 2;
  const kick = c => { c.av.emote('jump', 0.7); setTimeout(() => { const f = c.av.root.position; splash(new THREE.Vector3(f.x + out.x * 0.35, y0 + 0.02, f.z + out.z * 0.35), 16, out, 1); sfx('splash'); }, 180); };
  beginAct('wade', '🌊 踩浪花', '光著腳站在浪打上來的地方，海水冰冰涼涼的。', {
    focus: () => new THREE.Vector3(P.x, y0 + 0.7, P.z), back: [P.x - out.x * 2, P.z - out.z * 2], camYaw: face + 0.75, camPitch: 0.3, near: () => 0.7, // 從海那邊斜斜看回來（陸地那邊有陽傘會擋住）
    btns: [{ t: '踢水花', main: true, fn: () => { kick(me()); addLove(1, pick(['水花好漂亮', '冰冰涼涼的', '哈哈好好玩']), 'wade'); } },
      duo() ? { t: '潑你水', fn: () => { const a = me().av.root.position, b = you().av.root.position, dir = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize(); me().av.emote('throw', 0.8); setTimeout(() => { splash(new THREE.Vector3(a.x + dir.x * 0.3, y0 + 0.05, a.z + dir.z * 0.3), 22, dir, 1.1); sfx('splash'); you().av.emote('laugh', 1.6); setTimeout(() => kick(you()), 900); }, 250); addLove(3, '互相潑水，笑成一團', 'splashfight'); } }
        : { t: '追著浪跑', fn: () => { const c = me(); c.locked = false; c.av.emote('cheer', 1); route(c, P.x - out.x * 2.2, P.z - out.z * 2.2); setTimeout(() => { route(c, P.x, P.z); setTimeout(() => { place(c, -0.45); kick(c); }, 1600); }, 1500); addLove(1, '浪追上來了！', 'wadechase'); } }],
    update(dt) {
      t += dt; next -= dt;
      // 浪打到腳邊時，腳邊自己濺起小水花
      if (next <= 0) { next = rand(2.2, 3.8); [me(), you()].forEach(c => { if (c.ghost || c.remote) return; const f = c.av.root.position; splash(new THREE.Vector3(f.x, y0 + 0.02, f.z), 6, null, 0.45); }); }
    },
    end() { addMemo('🌊', duo() ? '一起在海邊踩浪花' : '在海邊踩浪花'); },
  });
}

// ---------- 堆沙堡 ----------
let castleObjs = [];
const CASTLE_SPOTS = [[-4.43, 20.82], [-2.58, 21.46], [-6.27, 20.3], [-3.25, 19.56]]; /* 乾沙上、浪打不到的地方 */
async function showCastles() {
  castleObjs.forEach(o => OUT.remove(o)); castleObjs = [];
  const g = await load('sandcastle'); if (!g) return;
  for (let i = 0; i < Math.min(st.castles, CASTLE_SPOTS.length); i++) { const [x, z] = CASTLE_SPOTS[i]; const o = cloneModel(g); o.position.set(x, standH(x, z), z); o.rotation.y = i * 1.3; OUT.add(o); castleObjs.push(o); }
}
async function actSand() {
  const idx = st.castles % CASTLE_SPOTS.length, [cx, cz] = CASTLE_SPOTS[idx];
  const g = await load('sandcastle'); const castle = g ? cloneModel(g) : new THREE.Group(); castle.position.set(cx, standH(cx, cz), cz); castle.scale.setScalar(0.05); OUT.add(castle);
  if (idx < castleObjs.length) castleObjs[idx].visible = false;
  const y = standH(cx, cz) + 0.02 - HIP;
  actGo(() => { seat(me(), cx - 0.62, null, cz, Math.PI / 2, 'crouch'); seat(you(), cx + 0.62, null, cz, -Math.PI / 2, 'crouch'); }, 250);
  let n = 0; const N = 8;
  beginAct('sand', '🏰 堆沙堡', `一起堆一座沙堡！點「堆沙」${N} 次。`, {
    focus: () => new THREE.Vector3(cx, 0.8, cz), back: [cx, cz - 1.6],
    btns: [{ t: '堆沙！', main: true, id: 'sand-go', fn: () => {
      if (n >= N) return; n++; castle.scale.setScalar(0.05 + 0.95 * (n / N)); me().av.dig(); you().av.dig?.(); sfx('sand'); burst('star', new THREE.Vector3(cx, standH(cx, cz) + 0.5, cz), 1, 0.3);
      msg(n < N ? `堆了 ${n}/${N}` : `完成了！這是你們的第 ${st.castles + 1} 座沙堡 🏰`);
      if (n === N) { st.castles++; addLove(4, '沙堡完成'); quest('castle'); addCoins(10); checkMilestones(); addMemo('🏰', `堆好第 ${st.castles} 座沙堡`); me().av.emote('cheer', 1.5); you().av.emote('clap', 1.5); burst('heart', midPos(1.2), 8); $('#sand-go').disabled = true; }
    } }],
    end() { OUT.remove(castle); showCastles(); },
  });
}

// ---------- 海邊：白天放風箏、晚上放煙火 ----------
function kiteItem() {
  const g = new THREE.Group(); const shape = new THREE.Shape(); shape.moveTo(0, 0.6); shape.lineTo(0.4, 0); shape.lineTo(0, -0.8); shape.lineTo(-0.4, 0); shape.closePath();
  const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), toon('#ff7a9c', { side: THREE.DoubleSide })); g.add(m);
  const h = heartMesh(0.16, toon('#ffffff')); h.position.z = 0.02; g.add(h);
  const tail = []; for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), toon(['#ffd25a', '#7ad8ff', '#9aff8a'][i % 3])); b.scale.set(1.6, 0.6, 0.6); g.add(b); tail.push(b); }
  g.userData.tail = tail; g.scale.setScalar(1.6); return g;
}
function actBeach() {
  const { x, z } = SPOTS.beach;
  if (isNight()) {
    actGo(() => { const y = standH(x, z) + 0.02 - HIP; seat(me(), x - 0.4, y, z + 0.8, 0.15, 'floor'); seat(you(), x + 0.4, y, z + 0.8, -0.15, 'floor'); }, 250);
    let n = 0;
    beginAct('fireworks', '🎆 放煙火', '坐在沙灘上看煙火在海上綻放。', {
      focus: () => new THREE.Vector3(x, 4.2, z + 4), back: [x, z - 1], camYaw: Math.PI, camPitch: 0.14,
      btns: [{ t: '點煙火！', main: true, fn: () => { launchFirework(LV().lv >= 3 && Math.random() < 0.35); n++; st.fireworks++; if (n % 3 === 0) { addLove(2, '好漂亮！', 'fw'); you().av.lean(-1); me().av.lean(1); } } }, { t: '連發 ×5', fn: () => { for (let i = 0; i < 5; i++) setTimeout(() => launchFirework(LV().lv >= 3 && i === 4), i * 420); n += 5; st.fireworks += 5; addLove(3, '煙火大會', 'fw5'); } }],
      end() { if (n) addMemo('🎆', `在海邊放了 ${n} 發煙火`); },
    });
    return;
  }
  const kite = kiteItem(); OUT.add(kite);
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: '#ffffff' })); OUT.add(line);
  let h = 3, want = 10, t = 0, tk = 0;
  actGo(() => { const y = standH(x, z); [[me(), -0.45], [you(), 0.45]].forEach(([c, dx]) => { if (c.remote || c.ghost) return; c.locked = true; c.x = x + dx; c.z = z; c.y = null; c.ry = 0.1; c.moving = false; }); me().av.reach(true); }, 250);
  quest('kite');
  beginAct('kite', '🪁 放風箏', '海風好大，風箏飛好高！', {
    focus: () => new THREE.Vector3(x + (kite.position.x - x) * 0.4, standH(x, z) + 1.2 + (kite.position.y - standH(x, z) - 1.2) * 0.4, z + (kite.position.z - z) * 0.4), near: () => Math.max(1.7, (h + 8) * 0.14), back: [x, z - 1], camYaw: Math.PI + 0.3, camPitch: 0.22, /* 人和風箏都在畫面裡 */
    btns: [{ t: '放線（飛高一點）', main: true, fn: () => { want = Math.min(surpriseIs('breeze') ? 32 : 24, want + 3); } }, { t: '收線', fn: () => { want = Math.max(4, want - 3); } }, duo() && { t: '交給對方', fn: () => { const a = me().av.reaching; me().av.reach(!a); you().av.reach(a); you().av.emote('cheer', 1); addLove(1, null, 'kitepass'); } }],
    update(dt) {
      t += dt; h += (want - h) * dt * 0.6;
      const kx = x + Math.sin(t * 0.7) * 2.5, kz = z + 6 + h * 0.9, ky = standH(x, z) + 1.5 + h;
      kite.position.set(kx, ky, kz); kite.rotation.set(0.3, Math.PI, Math.sin(t * 1.3) * 0.3);
      kite.userData.tail.forEach((b, i) => b.position.set(Math.sin(t * 3 + i) * 0.1 * i, -0.55 - i * 0.18, 0.05));
      const holder = me().av.reaching ? me() : you(); holder.av.handSlot.getWorldPosition(v3);
      line.geometry.setFromPoints([v3.clone(), kite.position.clone()]);
      tk += dt; if (tk > 10) { tk = 0; addLove(1); you().av.emote('cheer', 1); }
    },
    end() { OUT.remove(kite); OUT.remove(line); addMemo('🪁', `在海邊放風箏，飛到 ${Math.round(h)} 公尺高`); },
  });
}

// ---------- 釣魚：拋竿 → 等浮標下沉 → 收竿 → 按住拉線（別讓線斷掉）→ 把魚拉上岸、舉起來 ----------
function rodItem() {
  const g = new THREE.Group(); const r = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.022, 1.8, 6), toon('#5a3a22')); r.position.y = 0.85; g.add(r);
  const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 10), toon('#c8c8d0')); reel.rotation.z = Math.PI / 2; reel.position.set(0.04, 0.15, 0); g.add(reel);
  const tip = new THREE.Object3D(); tip.position.y = 1.75; g.add(tip); g.userData.tip = tip; g.rotation.x = 0.9; return g;
}
function pickFish() { const lucky = surpriseIs('lucky'), w = f => f[2] < 6 && lucky ? f[2] * 3 : f[2]; /* 幸運日：稀有的魚機率三倍 */ const tot = FISH.reduce((s, f) => s + w(f), 0); let r = Math.random() * tot; for (const f of FISH) { r -= w(f); if (r <= 0) return f; } return FISH[0]; }
// 釣上來的東西（3D）：魚用 Polyfork 的魚上色；章魚、靴子、瓶子用程式做
const FISH_TINT = { 小丑魚: '#ff8a3a', 藍色倒吊: '#3a7ae0', 黃金鯛: '#f2c33a', 鮪魚: '#6a7ea0', 愛心魚: '#ff6a9a' };
async function catchModel(f, size) {
  const name = f[0], g = new THREE.Group(); let mixer = null;
  if (FISH_TINT[name]) {
    const m = await load('fish'); if (m) {
      const o = SkeletonUtils.clone(m.scene); const tint = new THREE.Color(FISH_TINT[name]);
      o.traverse(x => { if (x.isMesh) { x.material = x.material.clone(); x.material.color = x.material.color.clone().lerp(tint, 0.65); x.frustumCulled = false; } });
      o.scale.setScalar(clamp(size / 45, 0.35, 1.7)); o.rotation.y = Math.PI / 2; g.add(o);
      mixer = new THREE.AnimationMixer(o); const c = m.animations.find(a => a.name === 'Swim fast') || m.animations[0]; if (c) mixer.clipAction(c).play();
      if (name === '愛心魚') { const h = heartMesh(0.12, toon('#ffffff', { emissive: '#ff3a7a' })); h.position.y = 0.45 * clamp(size / 45, 0.35, 1.7); g.add(h); }
    }
  } else if (name === '寄居蟹' || name === '海星') {
    const m = await load(name === '寄居蟹' ? 'crab' : 'starfish'); if (m) { const o = name === '寄居蟹' ? SkeletonUtils.clone(m.scene) : cloneModel(m); o.scale.setScalar(name === '寄居蟹' ? 0.22 : 0.9); if (name === '海星') o.rotation.x = Math.PI / 2; g.add(o); }
  } else if (name === '小章魚') {
    const pm = toon('#ff7a8a'); const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), pm); head.scale.y = 1.2; g.add(head);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, t = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.16, 4, 6), pm); t.position.set(Math.cos(a) * 0.08, -0.16, Math.sin(a) * 0.08); t.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); g.add(t); }
    [-1, 1].forEach(s => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), toon('#1a1a1a')); e.position.set(0.05 * s, 0.03, 0.1); g.add(e); });
  } else if (name === '舊靴子') {
    const bm = toon('#6a4a32'); const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.24, 0.12), bm); leg.position.y = 0.06; g.add(leg); const foot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.08, 0.24), bm); foot.position.set(0, -0.06, 0.06); g.add(foot);
    const weed = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.14, 4, 4), toon('#4a8a3a')); weed.position.set(0.05, 0.2, 0); weed.rotation.z = 0.5; g.add(weed);
  } else { // 瓶中信
    const gl = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.24, 12), new THREE.MeshToonMaterial({ color: '#9ad8c8', transparent: true, opacity: 0.6, gradientMap: toonGrad() })); g.add(gl);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.07, 10), gl.material); neck.position.y = 0.15; g.add(neck);
    const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.03, 8), toon('#b08050')); cork.position.y = 0.2; g.add(cork);
    const paper = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.14, 8), toon('#fff4d8')); g.add(paper);
  }
  return { g, mixer };
}
function actFish() {
  const fx = SPOTS.fishing.x;
  const rod = rodItem(), bob = new THREE.Group();
  const bb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), toon('#ff4a4a')); bob.add(bb); const bw = new THREE.Mesh(new THREE.SphereGeometry(0.091, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon('#ffffff')); bob.add(bw);
  const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 }));
  bob.visible = ln.visible = false; OUT.add(bob); OUT.add(ln);
  // 站在碼頭盡頭、面向大海；另一半（在線上的話）坐在旁邊
  actGo(() => { seat(me(), fx + 0.8, null, -0.3, Math.PI / 2, 'hold'); seat(you(), fx + 0.9, DOCK.y + 0.04 - HIP, 0.55, Math.PI / 2); me().av.setItem(rod); me().av.reach(true); }, 250);
  let state = 'idle', t = 0, wait = 0, flyT = 0, fish = null, catchO = null, tension = 0, prog = 0, holding = false, pull = 0, landT = 0;
  const target = new THREE.Vector3(), start = new THREE.Vector3();
  const setState = s => { state = s; t = 0; };
  const btns = () => {
    if (state === 'fight') setBtns([{ t: '按住收線', main: true, hold: on => { holding = on; } }]);
    else if (state === 'show' && EDIBLE.includes(fish.f[0])) setBtns([{ t: '🧊 帶回家', main: true, fn: takeHome }, { t: '放回海裡', fn: press }]);
    else setBtns([{ t: state === 'idle' ? '拋竿' : state === 'bite' ? '收竿！' : state === 'wait' ? '等魚上鉤…' : state === 'show' ? '放回海裡' : '…', main: true, dis: state === 'fly' || state === 'land', fn: press }]);
  };
  const press = () => {
    if (state === 'idle') { me().av.emote('throw', 0.7); setState('fly'); bob.visible = ln.visible = true; flyT = 0; target.set(fx + 4 + rand(0, 2), 0, rand(-1.6, 1)); msg('咻～'); sfx('whoosh'); btns(); }
    else if (state === 'wait') { msg('太早了，魚被嚇跑了…再試一次'); reset(); }
    else if (state === 'bite') startFight();
    else if (state === 'show') { me().ry = Math.PI / 2; me().av.setItem(rod); me().av.reach(true); if (catchO) { catchO.g.parent?.remove(catchO.g); catchO = null; } msg('撲通～放回海裡了。再釣一次吧！'); sfx('plop'); reset(); }
  };
  const reset = () => { setState('idle'); bob.visible = ln.visible = false; meter(false); btns(); };
  // 帶回家：放進冰箱，回小木屋可以煮
  const takeHome = () => {
    const name = fish.f[0]; st.pantry = st.pantry || {}; st.pantry[name] = (st.pantry[name] || 0) + 1; save(); quest('takefish');
    me().ry = Math.PI / 2; me().av.setItem(rod); me().av.reach(true); if (catchO) { catchO.g.parent?.remove(catchO.g); catchO = null; }
    msg(`${fish.f[1]} ${name}放進冰箱了（冰箱裡有 ${st.pantry[name]} 條）。回小木屋可以煮！`); sfx('pop'); reset(); $('#ap-msg').textContent = `🧊 ${name}放進冰箱了，回小木屋可以煮！`;
  };
  const startFight = async () => {
    const f = pickFish(), size = f[3] ? Math.round(rand(f[3], f[4])) : 0;
    fish = { f, size, power: f[0] === '鮪魚' ? 1.6 : f[0] === '愛心魚' ? 1.4 : f[0] === '舊靴子' || f[0] === '瓶中信' ? 0.5 : 0.8 + size / 60 };
    setState('fight'); tension = 0.25; prog = 0; holding = false; start.copy(bob.position);
    catchO = await catchModel(f, size); catchO.g.position.copy(bob.position); catchO.g.position.y = -0.25; OUT.add(catchO.g);
    msg('魚在拉！按住「收線」，紅色區太久線會斷，放開讓牠游一下'); meter(true, tension, [0.8, 1]); btns(); sfx('splash');
  };
  const land = () => {
    setState('land'); meter(false); holding = false; btns();
    // 特寫的位置：角色和鏡頭之間、比頭高一點
    const c = me(), yw = view.yaw; closeAt.set(c.x + Math.sin(yw) * 1.1, standH(c.x, c.z) + 1.7, c.z + Math.cos(yw) * 1.1);
    const f = fish.f, size = fish.size; st.fish[f[0]] = (st.fish[f[0]] || 0) + 1; save(); sfx('splash');
    landT = 0;
  };
  // 特寫卡片：名字、大小、新發現／新紀錄
  const closeAt = new THREE.Vector3();
  const closeUp = () => {
    setState('close'); btns(); msg('釣起來了！🎉');
    const f = fish.f, size = fish.size, name = f[0];
    st.fishMax = st.fishMax || {}; const prev = st.fishMax[name] || 0;
    fish.first = st.fish[name] === 1; fish.record = !fish.first && size > prev;
    if (size > prev) st.fishMax = { ...st.fishMax, [name]: size };
    save();
    const tag = fish.first ? '<em>新發現！</em>' : fish.record ? '<em>新紀錄！</em>' : '';
    const best = size ? (fish.record ? `之前最大 ${prev} 公分` : fish.first ? '第一次釣到' : `最大紀錄 ${Math.max(prev, size)} 公分`) : '';
    showCard(`${tag}<span class="fc-e">${f[1]}</span><b>${esc(name)}</b>${size ? `<span class="fc-s">${size} 公分</span>` : ''}${best ? `<small>${best}</small>` : ''}`);
    sfx(fish.first || fish.record ? 'chime' : 'pop'); burst('star', closeAt.clone(), fish.first || fish.record ? 10 : 5, 0.4);
  };
  const showCatch = () => {
    setState('show'); btns();
    const f = fish.f, size = fish.size, rare = f[0] === '愛心魚', bottle = f[0] === '瓶中信';
    // 舉起來：魚掛在手上，雙手高舉
    me().ry = view.yaw; // 轉身面向鏡頭
    me().av.reach(false); me().av.setItem(catchO.g); catchO.g.position.set(-0.12, 0.22, 0.18); catchO.g.rotation.set(0, 0, 0); catchO.g.scale.multiplyScalar(1.5); me().av.emote('cheer', 2.6);
    you().av.emote('clap', 1.6);
    const label = `${f[1]} ${f[0]}${size ? ` ${size} 公分` : ''}`; showSay(me(), label);
    msg(`${fish.record ? '新紀錄！' : ''}釣到 ${label}！${f[5]}${bottle ? '　' + pick(BOTTLE) : ''}`);
    addLove(rare ? 20 : bottle ? 5 : 2, rare ? '💗 傳說中的愛心魚！' : null, rare ? null : 'fish');
    quest('fish'); addCoins(Math.max(3, Math.round((size || 10) / 3))); checkMilestones();
    if (rare || fish.first) addMemo(f[1], `${nameOf(me().i)} 第一次釣到${f[0]}${size ? `（${size} 公分）` : ''}`);
    else if (fish.record) addMemo(f[1], `${nameOf(me().i)} 釣到最大的${f[0]}：${size} 公分（新紀錄）`);
    burst(rare ? 'heart' : 'star', headPos(me(), 2), rare ? 16 : 6, 0.5); sfx('chime');
  };
  beginAct('fish', '🎣 釣魚', '按「拋竿」，浮標往下沉的時候馬上按「收竿」！', {
    focus: () => state === 'close' ? closeAt.clone() : state === 'show' ? headPos(me(), 0.85) : new THREE.Vector3(fx + 2, DOCK.y + 0.6, 0), near: () => state === 'close' ? 0.17 : state === 'show' ? 0.72 : 0, camSpeed: () => state === 'close' || state === 'show' ? 2.2 : 0, back: [fx - 0.5, 0], camYaw: -Math.PI / 2 - 0.55, camPitch: 0.3,
    update(dt) {
      t += dt; rod.userData.tip.getWorldPosition(v3);
      if (catchO?.mixer) catchO.mixer.update(dt);
      if (state === 'fly') { flyT += dt / 0.7; const k = Math.min(1, flyT); bob.position.lerpVectors(v3, target, k); bob.position.y += Math.sin(k * Math.PI) * 1.8; if (k >= 1) { setState('wait'); wait = surpriseIs('fish') ? rand(0.8, 2.4) : rand(2, 6); msg('靜靜等待…'); btns(); sfx('plop'); } }
      if (state === 'wait') { bob.position.y = Math.sin(t * 2.4) * 0.03; if (t > wait) { setState('bite'); msg('上鉤了！快收竿！'); btns(); sfx('bite'); } }
      if (state === 'bite') { bob.position.y = -0.12 + Math.sin(t * 22) * 0.06; if (t > 1.15) { msg('魚跑掉了…再試一次'); reset(); } }
      if (state === 'fight' && catchO) {
        // 魚一陣一陣地拉；按住收線：靠近、但線會繃緊
        pull = Math.max(0, Math.sin(t * 2.3 * fish.power) * 0.7 + Math.sin(t * 5.1) * 0.3) * fish.power;
        if (holding) { prog += dt * (0.22 - pull * 0.08); tension += dt * (0.32 + pull * 0.45); }
        else { prog -= dt * 0.05 * fish.power; tension -= dt * 0.55; }
        prog = clamp(prog, 0, 1); tension = clamp(tension, 0, 1.05); meter(true, Math.min(1, tension), [0.8, 1]);
        if (tension >= 1) { msg('啪！線斷了…魚游走了。再試一次！'); sfx('whoosh'); catchO.g.parent?.remove(catchO.g); catchO = null; reset(); return; }
        // 魚在水裡掙扎、慢慢被拉向碼頭
        const near = new THREE.Vector3(fx + 1.3, 0, -0.3), p = catchO.g.position;
        p.lerpVectors(start, near, prog); p.x += Math.sin(t * 7) * 0.25 * (1 - prog); p.z += Math.cos(t * 5) * 0.35 * (1 - prog); p.y = -0.12 + Math.abs(Math.sin(t * 9)) * 0.12 * pull;
        catchO.g.rotation.y = Math.sin(t * 7) * 0.8; bob.position.copy(p); bob.position.y = Math.max(p.y, -0.05);
        if (Math.random() < dt * 3 * pull) burst('drop', p.clone().add(new THREE.Vector3(0, 0.2, 0)), 1, 0.2);
        $('#ap-msg').textContent = `${holding ? '收線中…' : '放開讓牠游一下'}　還有 ${(4.5 * (1 - prog)).toFixed(1)} 公尺`;
        if (prog >= 1) land();
      }
      if (state === 'land' && catchO) {
        // 從水裡拉出來，飛到角色面前的半空中
        landT += dt / 0.7; const k = Math.min(1, landT), p = catchO.g.position;
        p.lerpVectors(new THREE.Vector3(fx + 1.3, 0, -0.3), closeAt, k); p.y += Math.sin(k * Math.PI) * 0.8; catchO.g.rotation.y = k * 5;
        bob.visible = false;
        if (k >= 1) closeUp();
      }
      if (state === 'close' && catchO) {
        // 特寫：魚在半空中甩尾、慢慢轉
        const p = catchO.g.position; p.copy(closeAt); p.y += Math.sin(t * 3) * 0.06; catchO.g.rotation.y = 0.6 + Math.sin(t * 1.2) * 0.9; catchO.g.rotation.z = Math.sin(t * 9) * 0.25;
        if (t > 2.4) { hideCard(); showCatch(); }
      }
      if (bob.visible) ln.geometry.setFromPoints([v3.clone(), bob.position.clone()]);
      ln.visible = bob.visible;
    },
    end() { hideCard(); OUT.remove(bob); OUT.remove(ln); if (catchO) catchO.g.parent?.remove(catchO.g); },
  });
  btns();
}
function showCard(html) { let e = $('#fish-card'); if (!e) { e = document.createElement('div'); e.id = 'fish-card'; document.body.appendChild(e); } e.innerHTML = html; e.classList.remove('on'); void e.offsetWidth; e.classList.add('on'); }
function hideCard() { $('#fish-card')?.classList.remove('on'); }

// ---------- 划船：繞小島一圈 ----------
function actBoat() {
  const boat = W.boat; if (!boat) return toast('小船還沒準備好');
  // 連線時：另一個人已經在划船 → 我上船當乘客（船由他控制）
  const driver = [...allChars()].find(c => c.remote && c.act === 'boat');
  const passenger = !!driver; if (MP.boatAway && !passenger) return toast('小船出海了，等它回來吧');
  const home = boat.position.clone(), homeRy = boat.rotation.y;
  const RAD = 49, a0 = Math.atan2(home.z, home.x) + 0.05;
  let s = 0, paused = false, phase = 'out', lapA = 0, tk = 0;
  const place = () => {
    const [a, b] = passenger ? [you(), me()] : [me(), you()];
    if (!a.remote && !a.ghost) Object.assign(a, boatSeat(true));
    if (!b.remote && !b.ghost) Object.assign(b, boatSeat(false));
  };
  MP.driving = !passenger;
  if (!W.oars) { W.oars = makeOars(boat); poseOars(W.oars, null); }
  let rowPh = 0; const rower = () => passenger ? driver : me();
  const grips = () => W.oars.map(o => o.userData.grip.getWorldPosition(new THREE.Vector3()));
  actGo(() => { [me(), you()].forEach(c => { if (c.remote || c.ghost) return; c.locked = true; c.av.setPose('sit'); c.moving = false; }); if (!passenger) me().av.emote('row', 9999); place(); }, 250);
  const startP = new THREE.Vector3(Math.cos(a0) * RAD, 0, Math.sin(a0) * RAD);
  beginAct('boat', '🚣 划船', '慢慢划著船，繞小島一圈。', {
    focus: () => boat.position.clone().add(new THREE.Vector3(0, 1, 0)), back: [SPOTS.boat.x, 0.2], bigView: true,
    btns: passenger ? [{ t: '在船上比愛心', main: true, fn: () => { me().av.emote('shy', 1.4); burst('heart', headPos(me(), 1.2), 5); addLove(2, null, 'boatheart'); } }] : [{ t: '停下來看海', fn: () => { paused = !paused; msg(paused ? '海面亮晶晶的，好安靜。' : '繼續划～'); me().av.reach(!paused); if (paused) { you().av.emote('shy', 1.4); burst('heart', midPos(1.1), 4); addLove(2, null, 'boatstop'); } } }, { t: '划回碼頭', main: true, fn: () => { phase = 'home'; paused = false; msg('往碼頭划回去～'); } }],
    update(dt) {
      if (passenger) { if (driver.act !== 'boat' || !driver.remote) { endAct(); return; } rowPh += dt * 2.4; poseOars(W.oars, rowPh); boat.updateMatrixWorld(true); driver.av.rowGrip = grips(); place(); return; }
      if (!paused) rowPh += dt * 2.4; poseOars(W.oars, paused ? null : rowPh); boat.updateMatrixWorld(true); me().av.rowGrip = paused ? null : grips();
      const t = performance.now() / 1000; boat.position.y = 0.05 + Math.sin(t * 1.6) * 0.05; boat.rotation.z = Math.sin(t * 1.2) * 0.04;
      if (MP.on) MP.net.send({ t: 'boat', x: +boat.position.x.toFixed(2), z: +boat.position.z.toFixed(2), ry: +boat.rotation.y.toFixed(3) });
      if (!paused) {
        const sp = 3.4 * dt;
        if (phase === 'out') { const d = startP.clone().sub(boat.position).setY(0); if (d.length() < 0.5) { phase = 'lap'; lapA = 0; } else { d.normalize(); boat.position.addScaledVector(d, sp); turnTo(boat, Math.atan2(d.x, d.z), dt); } }
        else if (phase === 'lap') { lapA += sp / RAD; const a = a0 + lapA; boat.position.x = Math.cos(a) * RAD; boat.position.z = Math.sin(a) * RAD; turnTo(boat, Math.atan2(-Math.sin(a), Math.cos(a)), dt); if (lapA >= Math.PI * 2) { phase = 'home'; st.laps++; addLove(6, '繞小島一圈！'); quest('boat'); addCoins(15); addMemo('🚣', `一起划船繞了小島一圈（第 ${st.laps} 次）`); } }
        else if (phase === 'home') { const d = home.clone().sub(boat.position).setY(0); if (d.length() < 0.3) { boat.position.x = home.x; boat.position.z = home.z; boat.rotation.y = homeRy; endAct(); return; } d.normalize(); boat.position.addScaledVector(d, sp); turnTo(boat, Math.atan2(d.x, d.z), dt); }
      }
      place(); tk += dt; if (tk > 10) { tk = 0; addLove(1); }
    },
    end() { MP.driving = false; poseOars(W.oars, null); rower().av.rowGrip = null; if (passenger) return; me().av.emote('idle', 0.1); boat.position.copy(home); boat.rotation.set(0, homeRy, 0); if (MP.on) MP.net.send({ t: 'boat', x: home.x, z: home.z, ry: homeRy, home: 1 }); },
  });
}
// 兩支木槳：掛在船邊的槳架上（船的座標：x 往左右、z 往船頭），划的時候前後擺、槳葉一下一下入水
function makeOars(boat) {
  const wood = toon('#a87a4e'), blade = toon('#c99a62');
  return [-1, 1].map(side => {
    const pivot = new THREE.Group(); pivot.position.set(side * 0.64, 0.62, 0.3); boat.add(pivot);
    const tilt = new THREE.Group(); pivot.add(tilt);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.3, 6), wood); shaft.rotation.z = Math.PI / 2; shaft.position.x = side * 0.7; tilt.add(shaft);
    const bl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.16), blade); bl.position.x = side * 1.7; tilt.add(bl);
    const grip = new THREE.Object3D(); grip.position.x = -side * 0.42; tilt.add(grip); // 手握的地方（在船裡面）
    pivot.userData = { side, tilt, grip }; return pivot;
  });
}
// ph：划槳的進度（弧度）；null = 收槳休息
function poseOars(oars, ph) {
  oars.forEach(o => {
    const { side, tilt } = o.userData;
    if (ph == null) { o.rotation.y = side * 0.9; tilt.rotation.z = side * 0.12; return; }
    const sw = Math.sin(ph), dip = Math.cos(ph) > 0 ? 1 : 0; // 往前拉的半圈槳葉在水裡，回程抬起來
    o.rotation.y = side * sw * 0.55; tilt.rotation.z = side * (dip ? -0.36 : -0.18);
  });
}
// 小船模型的船頭朝 +z
function turnTo(o, want, dt) { let d = want - o.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); o.rotation.y += d * Math.min(1, dt * 2.5); }

// ---------- 燈塔長椅：看夕陽、看星星、流星許願 ----------
function actSunset() {
  const { x, z } = SPOTS.sunset, ry = -Math.PI / 2 - 0.35, y = standH(x + 0.3, z) + 0.46 - HIP;
  actGo(() => { sitPair(x + 0.3, y, z, ry, 0.62); me().av.lean(1); }, 250);
  let warp = 0, mt = rand(3, 8), wished = false;
  const btns = () => setBtns([
    { t: isNight() ? '等流星…' : '等夕陽', main: true, id: 'ss-main', fn: () => { if (!isNight()) { warp = 17.9; msg('靠在一起，等太陽慢慢落到海裡…'); } } },
    { t: '🌠 許願', id: 'ss-wish', dis: !meteor, fn: wish },
  ]);
  const wish = () => {
    if (!meteor && !(act?.metT > 0)) return;
    openDlg('🌠 對流星許願', `<p class="muted">願望只會寫在你們的回憶本裡。</p><label class="anniv"><span>願望</span><input id="wish-in" maxlength="40" placeholder="例如：明年一起去看雪"></label><button type="button" class="primary" id="wish-ok">許願</button>`);
    $('#wish-ok').onclick = () => { const w = $('#wish-in').value.trim(); $('#dlg').close(); st.wishes++; addMemo('🌠', w ? `對流星許願：「${w}」` : '一起對流星許了願'); addLove(5, '願望一定會實現'); burst('star', midPos(), 10); wished = true; };
  };
  beginAct('sunset', isNight() ? '🌠 看星星' : '🌅 看夕陽', isNight() ? '滿天星星，等等看會不會有流星。' : '燈塔旁的長椅，最適合看夕陽。', {
    focus: () => new THREE.Vector3(x - 1.5, 2.2, z - 0.6), back: [x + 1.6, z + 0.6], camYaw: ry + Math.PI, camPitch: 0.1, look: 1, /* look：鏡頭對著海和天空，才看得到夕陽和流星 */
    update(dt) {
      if (warp) { act.tod = (act.tod ?? st.tod) + dt * 1.6; if (act.tod >= warp) { warp = 0; msg('夕陽好美。' + (Math.random() < 0.5 ? `${nameOf(you().i)} 偷偷看了你一眼。` : '天空變成粉紅色了。')); addLove(4, '一起看夕陽'); addMemo('🌅', '在燈塔旁一起看夕陽'); quest('sunset'); btns(); } }
      if (isNight()) { mt -= dt; if (mt <= 0 && !meteor) { spawnMeteor(); mt = surpriseIs('meteor') ? rand(1.5, 3.5) : rand(5, 11); act.metT = 3; msg('流星！快許願！'); sfx('chime'); } }
      if (act.metT > 0) { act.metT -= dt; const b = $('#ss-wish'); if (b) b.disabled = false; } else { const b = $('#ss-wish'); if (b && !b.disabled) b.disabled = true; }
    },
    end() { if (isNight()) addMemo('✨', wished ? '在燈塔下看星星，還許了願' : '在燈塔下看星星'); },
  });
  btns();
}

// ---------- 菜園 ----------
const plantObjs = [null, null, null];
async function drawPlant(i) {
  const p = SPOTS.garden.plots[i], s = st.garden[i], old = plantObjs[i];
  if (old) OUT.remove(old); plantObjs[i] = null; if (!s) return;
  const g = new THREE.Group(); g.position.set(p[0], LAND_Y + 0.2, p[1]); OUT.add(g); plantObjs[i] = g;
  const stage = Math.min(3, s.w.length), leaf = toon('#5cb84a');
  const spots = [[-0.35, -0.3], [0.3, -0.25], [0, 0.3], [-0.3, 0.32], [0.35, 0.28]];
  if (stage === 0) spots.forEach(([x, z]) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), toon('#6a4a30')); m.position.set(x, 0, z); g.add(m); });
  else if (stage < 3) spots.forEach(([x, z]) => { const st_ = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.18 * stage, 5), leaf); st_.position.set(x, 0.09 * stage, z); g.add(st_); [-1, 1].forEach(k => { const l = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), leaf); l.scale.set(1.6, 0.4, 0.8); l.position.set(x + 0.06 * k, 0.15 * stage, z); g.add(l); }); if (stage === 2) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), toon(s.t === 2 ? '#c8243a' : s.t === 0 ? '#e8b030' : '#ffffff')); b.position.set(x, 0.36, z); g.add(b); } });
  else {
    const kind = FLOWERS[s.t][2];
    if (kind === 'rose') spots.forEach(([x, z]) => { const st_ = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.5, 5), leaf); st_.position.set(x, 0.25, z); g.add(st_); const r = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), toon('#d8243a')); r.scale.y = 0.8; r.position.set(x, 0.52, z); g.add(r); });
    else { const m = await load(kind); if (m) spots.forEach(([x, z], k) => { const o = cloneModel(m); o.position.set(x, 0, z); o.rotation.y = k * 1.7; o.scale.setScalar(kind === 'sunflower' ? 0.55 : 1.5); g.add(o); }); }
  }
}
function actGarden() {
  const render = () => {
    const rows = SPOTS.garden.plots.map((_, i) => {
      const s = st.garden[i];
      if (!s) return `<button type="button" data-g="plant" data-i="${i}">🟫 第 ${i + 1} 塊：空地<small>點一下種花</small></button>`;
      const f = FLOWERS[s.t], stage = Math.min(3, s.w.length);
      if (stage >= 3) return `<button type="button" data-g="pick" data-i="${i}">${f[1]} 第 ${i + 1} 塊：${f[0]}開花了！<small>摘下來送給 ${esc(nameOf(you().i))}</small></button>`;
      const today = s.w.includes(st.day);
      return `<button type="button" data-g="water" data-i="${i}" ${today ? 'disabled' : ''}>🌱 第 ${i + 1} 塊：${f[0]}（澆了 ${s.w.length}/3 天）<small>${today ? '今天澆過了，明天再來（睡一覺就是明天）' : '點一下澆水'}</small></button>`;
    }).join('');
    openDlg('🌱 菜園', `<p class="muted">種下花種子，每天澆一次水，澆滿三天就會開花。</p><div class="opts">${rows}</div>`);
    $('#dlg-body').querySelectorAll('[data-g]').forEach(b => b.onclick = () => { const i = +b.dataset.i, k = b.dataset.g; if (k === 'plant') choose(i); if (k === 'water') water(i); if (k === 'pick') pickF(i); });
  };
  // 站到那塊地前面、面向它
  const goPlot = i => { const [px, pz] = SPOTS.garden.plots[i], c = me(); c.x = px; c.z = pz + 1.05; c.ry = Math.PI; c.path = null; };
  const choose = i => {
    openDlg('🌱 要種什麼？', `<div class="opts">${FLOWERS.map((f, t) => `<button type="button" data-t="${t}">${f[1]} ${f[0]}</button>`).join('')}</div>`);
    $('#dlg-body').querySelectorAll('[data-t]').forEach(b => b.onclick = () => { st.garden[i] = { t: +b.dataset.t, w: [], by: myIdx() }; addMemo(FLOWERS[+b.dataset.t][1], `${nameOf(myIdx())} 在菜園種了${FLOWERS[+b.dataset.t][0]}`); save(); drawPlant(i); goPlot(i); me().av.emote('plant', 2.2); sfx('sand'); toast(`種下了${FLOWERS[+b.dataset.t][0]}的種子`); render(); });
  };
  const water = i => { const s = st.garden[i]; if (s.w.includes(st.day)) return; s.w.push(st.day); if (s.by != null && s.by !== myIdx()) { addLove(2, `幫 ${partnerName()} 種的花澆水 🌷`); addMemo('🌷', `${nameOf(myIdx())} 幫 ${partnerName()} 種的${FLOWERS[s.t][0]}澆了水`); } quest('water'); goPlot(i); me().av.emote('water', 2.4); me().av.setItem(canItem()); setTimeout(() => me().av.setItem(null), 2400); save(); drawPlant(i); const p = SPOTS.garden.plots[i]; burst('drop', new THREE.Vector3(p[0], LAND_Y + 1, p[1]), 5, 0.4); sfx('water'); addLove(1, null, 'water'); if (s.w.length >= 3) { toast(`${FLOWERS[s.t][1]} 開花了！`); addMemo(FLOWERS[s.t][1], `菜園的${FLOWERS[s.t][0]}開花了`); } render(); };
  const pickF = i => {
    goPlot(i); me().av.emote('pickup', 1.2);
    const s = st.garden[i], f = FLOWERS[s.t]; st.garden[i] = null; st.flowersGiven++; save(); drawPlant(i); $('#dlg').close();
    const bq = new THREE.Group(); [0, 1, 2].forEach(k => { const b = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), toon(s.t === 2 ? '#d8243a' : s.t === 0 ? '#f2c030' : '#ffffff')); b.position.set((k - 1) * 0.07, 0.12, 0); bq.add(b); }); const wr = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 8), toon('#ffd0dc')); wr.rotation.x = Math.PI; bq.add(wr);
    me().av.setItem(bq); me().av.reach(true); lovePending = { kind: 'pat', t: 0 };
    setTimeout(() => { me().av.setItem(null); me().av.reach(false); you().av.emote('shy', 2); burst('heart', headPos(you()), 10); toast(`${nameOf(me().i)} 送了一束${f[0]}給 ${nameOf(you().i)} 💐`); }, 1500);
    addLove(8); addMemo('💐', `${nameOf(me().i)} 摘了自己種的${f[0]}送給 ${nameOf(you().i)}`);
  };
  render();
}

// ---------- 狗狗：摸摸、丟球 ----------
let ballM = null;
function actDog() {
  const d = W.dog; if (!d) return;
  openDlg('🐶 狗狗', `<div class="opts"><button type="button" id="dog-pet">🫳 摸摸狗狗<small>牠會很開心</small></button><button type="button" id="dog-ball">🎾 丟球<small>看牠跑去撿回來</small></button></div>`);
  $('#dog-pet').onclick = () => {
    $('#dlg').close(); const p = me(), dp = d.o.position;
    // 狗狗先停下來，走到牠前面蹲下摸
    d.hold = 3.2; d.tx = dp.x; d.tz = dp.z;
    const ang = Math.atan2(p.x - dp.x, p.z - dp.z), tx = dp.x + Math.sin(ang) * 0.75, tz = dp.z + Math.cos(ang) * 0.75;
    const pet = () => { quest('dog'); p.ry = Math.atan2(dp.x - p.x, dp.z - p.z); d.o.rotation.y = Math.atan2(p.x - dp.x, p.z - dp.z); p.av.emote('petdog', 2.4); setTimeout(() => { burst('heart', dp.clone().add(new THREE.Vector3(0, 0.9, 0)), 4, 0.3); sfx('pop'); }, 600); addLove(1, '狗狗搖尾巴', 'dog'); };
    if (Math.hypot(tx - p.x, tz - p.z) < 0.4) pet(); else route(p, tx, tz, { r: 0.5, run: pet });
  };
  $('#dog-ball').onclick = () => {
    $('#dlg').close(); const p = me();
    if (!ballM) { ballM = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), toon('#d8f04a')); }
    OUT.add(ballM); ballM.visible = true;
    // 往前丟 8 公尺，找得到能走的地方
    let tx = p.x + Math.sin(p.ry) * 8, tz = p.z + Math.cos(p.ry) * 8; for (let k = 8; k > 2 && !walkable(tx, tz); k--) { tx = p.x + Math.sin(p.ry) * k; tz = p.z + Math.cos(p.ry) * k; }
    const from = new THREE.Vector3(p.x, standH(p.x, p.z) + 1.4, p.z), to = new THREE.Vector3(tx, standH(tx, tz) + 0.1, tz); let t = 0;
    p.av.emote('throw', 0.8); sfx('whoosh');
    const fly = () => { t += 1 / 60 / 0.8; const k = Math.min(1, t); ballM.position.lerpVectors(from, to, k); ballM.position.y += Math.sin(k * Math.PI) * 2.5; if (k < 1) requestAnimationFrame(fly); };
    fly();
    d.fetch = true; d.tx = tx; d.tz = tz;
    d.fetchDone = () => { ballM.visible = false; d.tx = me().x + 0.8; d.tz = me().z + 0.8; d.fetchDone = () => { d.fetch = false; burst('heart', d.o.position.clone().add(new THREE.Vector3(0, 0.9, 0)), 3, 0.3); toast('狗狗把球撿回來了！'); addLove(1, null, 'ball'); }; };
  };
}

// ---------- 室內：床、沙發、做飯、吃飯 ----------
// 床上的被子：從腳蓋到胸口，兩個人的身體把被子撐起一點
function makeQuilt(spread) {
  /* 被子：從胸口蓋到床尾，在兩個人身上隆起（卡通角色身體比較厚，所以隆起要夠高才蓋得住） */
  const L = 1.78, g = new THREE.PlaneGeometry(2.02, L, 28, 18); g.rotateX(-Math.PI / 2); const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), z = P.getZ(i), t = (z + L / 2) / L, bump = Math.min(1, [-spread, spread].reduce((s_, cx) => s_ + Math.exp(-((x - cx) ** 2) / 0.16), 0));
    P.setY(i, 0.03 + bump * (0.38 - 0.06 * t) * Math.min(1, (1 - t) * 6 + 0.2) - Math.max(0, Math.abs(x) - 0.9) * 1.6);
  }
  g.computeVertexNormals();
  const q = new THREE.Group(); q.add(new THREE.Mesh(g, toon('#f7c9d4', { side: THREE.DoubleSide })));
  const fold = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 1.86, 4, 10), toon('#fffaf6')); fold.rotation.z = Math.PI / 2; fold.position.set(0, 0.2, -L / 2 + 0.05); q.add(fold); /* 被子上緣翻出來的白色被套 */
  return q;
}
function actBed() {
  const y = 0.52, B = FURN.bed, footZ = B.z + 0.45; /* 頭剛好枕在枕頭上 */
  // 上床前換上睡衣，起床（離開）時換回原本的衣服
  const prev = [st.looks[0].outfit, st.looks[1].outfit];
  const pj = j => OUTFITS[st.looks[j].outfit]?.kind === 'pj' ? st.looks[j].outfit : OUTFITS.findIndex(o => o.kind === 'pj' && o.name === (st.looks[j].gender === 'f' ? '粉紅睡衣' : '天藍睡衣'));
  let quilt = null, close = false;
  const solo = !duo(); /* 另一半不在：一個人睡床中間 */
  const lay = gap => { if (solo) { seat(me(), B.x, y, footZ, 0, 'lie'); return; } seat(me(), B.x - gap, y, footZ, 0, 'lie'); seat(you(), B.x + gap, y, footZ, 0, 'lie'); };
  const cover = gap => { if (quilt) IN.S.remove(quilt); quilt = makeQuilt(solo ? 0 : gap); quilt.position.set(B.x, y, footZ + 0.12); IN.S.add(quilt); };
  actGo(() => { [0, 1].forEach(j => { const o = pj(j); if (o !== st.looks[j].outfit) chars[j].av.setLook({ ...st.looks[j], outfit: o }); }); lay(0.42); cover(0.42); }, 250);
  const snuggle = on => { close = on; lay(on ? 0.24 : 0.42); cover(on ? 0.24 : 0.42); me().av.lieFace = on ? 1 : 0; you().av.lieFace = on ? -1 : 0; }; /* 抱著睡：兩個人側身面對面 */
  [0, 1].forEach(j => { chars[j].av.covered = true; chars[j].av.lieFace = 0; });
  const btns = () => setBtns([{ t: '晚安', s: '一起睡一下', main: true, fn: sleep },
    duo() && { t: close ? '躺回來' : '抱著睡', fn: () => { snuggle(!close); if (close) { me().av.emote('hug', 4); burst('heart', midPos(0.7), 6, 0.3); addLove(2, '抱著好溫暖', 'cuddle'); } btns(); } },
    duo() && { t: '親一下', fn: () => { if (!close) snuggle(true); me().av.emote('kiss', 1.6); setTimeout(() => { you().av.emote('shy', 1.6); burst('heart', midPos(0.75), 8, 0.3); }, 500); addLove(3, '晚安吻 😘', 'bedkiss'); btns(); } },
    duo() && { t: '甜蜜時光', s: '關燈・拉起被子', fn: () => { sweetNight(true); } },
    duo() && { t: '枕頭大戰', fn: () => { me().av.emote('cheer', 1); you().av.emote('jump', 1); burst('star', midPos(0.6), 6); addLove(2, '哈哈哈', 'pillow'); } }]);
  beginAct('bed', '🛏️ 床', '換上睡衣、蓋好被子，軟綿綿的床，最適合窩在一起。', {
    focus: () => new THREE.Vector3(B.x, 0.8, B.z - 0.2), back: [INSPOTS.bed.x, INSPOTS.bed.z + 0.6],
    end() { if (quilt) IN.S.remove(quilt); [0, 1].forEach(j => { chars[j].av.covered = false; chars[j].av.lieFace = 0; }); [0, 1].forEach(j => { st.looks[j].outfit = prev[j]; chars[j].av.setLook(st.looks[j]); }); },
  });
  btns();
  function sleep() {
    msg('晚安 ♥'); setBtns([]); let n = 0; const zz = setInterval(() => { burst('z', midPos(0.6), 1, 0.2); if (++n > 4) clearInterval(zz); }, 350);
    setTimeout(() => restScreen('💤', '晚安，做個好夢', () => { endAct(); toast('睡了一會兒，精神好多了 ☀️', 3000); if (st.sleptDay !== st.day) { st.sleptDay = st.day; addLove(3); addMemo('🛏️', duo() ? '兩個人一起睡了一覺' : '在小木屋好好睡了一覺'); } }), 1500);
  }
}
// 休息一下：畫面暗下來幾秒（不會跳過時間，島上時間跟真實時間一樣）
function restScreen(icon, text, done) {
  const ov = document.createElement('div'); ov.className = 'sweet-night'; ov.innerHTML = `<p>${icon}</p><b class="sn-t">${esc(text)}</b>`;
  document.body.appendChild(ov); requestAnimationFrame(() => ov.classList.add('on'));
  setTimeout(() => { done?.(); ov.classList.remove('on'); setTimeout(() => ov.remove(), 1200); }, 3200);
}
// 甜蜜時光：燈慢慢暗下來、畫面淡成深色、只有飄起來的愛心，然後就是早上了（不顯示任何露骨的畫面）
function sweetNight(mine) {
  if (mine && MP.on) MP.net.send({ t: 'fx', k: 'sweet' });
  setBtns([]); msg('關掉燈，拉起被子……');
  const ov = document.createElement('div'); ov.className = 'sweet-night'; ov.innerHTML = '<div class="sn-h">' + Array.from({ length: 14 }, (_, i) => `<span style="left:${8 + (i * 37) % 84}%;animation-delay:${(i * 0.37) % 2.4}s">${i % 3 ? '♡' : '♥'}</span>`).join('') + '</div><p>🌙</p>';
  document.body.appendChild(ov); requestAnimationFrame(() => ov.classList.add('on')); sfx('chime');
  setTimeout(() => { if (act?.id === 'bed') endAct(); if (mine && st.sweetDay !== st.day) { st.sweetDay = st.day; addLove(6, null, 'sweet'); addMemo('💞', '度過了甜蜜的時光'); } }, 3600);
  setTimeout(() => { ov.classList.remove('on'); setTimeout(() => ov.remove(), 1200); toast('窩在一起好溫暖 💞', 3500); }, 4600);
}
function actSofa() {
  const y = 0.45 - HIP + 0.02;
  actGo(() => { seat(me(), FURN.sofa.x - 0.35, y, FURN.sofa.z - 0.05, Math.PI, 'recline'); seat(you(), FURN.sofa.x + 0.35, y, FURN.sofa.z - 0.05, Math.PI, 'recline'); }, 250);
  let movie = false, t = 0;
  beginAct('sofa', '🛋️ 沙發', '窩在沙發上。', {
    focus: () => new THREE.Vector3(0, 1, -2.4), back: [INSPOTS.sofa.x + 1.6, INSPOTS.sofa.z + 0.4],
    btns: [{ t: '看電影', main: true, fn: () => { movie = !movie; msg(movie ? pick(duo() ? ['看了一部愛情片，兩個人都哭了', '看恐怖片，一直抓著對方的手', '看動畫，笑到肚子痛'] : ['看了一部愛情片，好想另一半', '看動畫，笑到肚子痛', '看了一部冒險電影']) : '電視關掉了。'); if (movie) { you().av.lean(1); addLove(3, '電影之夜', 'movie'); addMemo('🎬', '窩在沙發上一起看電影'); } else you().av.lean(0); } }, duo() && { t: '靠過去', fn: () => { you().av.lean(1); me().av.lean(-1); burst('heart', midPos(1.1), 4); addLove(2, null, 'sofalean'); } }],
    update(dt) { t += dt; if (movie) IN.screen.material.color.setHSL((t * 0.07) % 1, 0.5, 0.45 + Math.sin(t * 3) * 0.1); else IN.screen.material.color.set('#111'); },
    end() { IN.screen.material.color.set('#111'); },
  });
}
// 閱讀角：窩在懶人沙發，或一起躺在地毯上看書
const BOOKS = ['《小王子》：「你在你的玫瑰花身上花的時間，使你的玫瑰花變得如此重要。」', '一本旅行繪本，說好以後要一起去看極光', '食譜書：決定下次要做舒芙蕾', '一本推理小說，猜兇手猜錯了 😂', '詩集：「我想和你一起生活，在某個小鎮。」', '一本貓咪寫真，看得好療癒'];
// 書：攤開的封面＋內頁，中間有一張可以翻的紙（pivot 在書脊）
function bookItem() {
  const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.3), toon(pick(['#c97b63', '#7c9a8a', '#e0c27a', '#8a9ec9']))); g.add(c);
  const pg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.032, 0.28), toon('#fbf6ec')); pg.position.y = 0.004; g.add(pg);
  const hinge = new THREE.Group(); hinge.position.y = 0.022; g.add(hinge);
  const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.27), toon('#fffaf0', { side: THREE.DoubleSide })); leaf.rotation.x = -Math.PI / 2; leaf.position.x = 0.05; hinge.add(leaf); hinge.visible = false;
  g.userData.flip = 0; g.userData.hinge = hinge;
  g.rotation.set(-1.0, 0, 0); g.position.set(0, 0.06, 0.12); return g;
}
function mugItem() { const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.1, 10), toon('#f4efe6')); g.add(m); const h = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.01, 6, 10), toon('#f4efe6')); h.position.x = 0.055; g.add(h); const k = new THREE.Mesh(new THREE.CircleGeometry(0.043, 10), toon('#7a4a32')); k.rotation.x = -Math.PI / 2; k.position.y = 0.045; g.add(k); g.position.set(0, 0.05, 0.1); return g; }
const BEAN_HIP = 0.40; // 懶人沙發：屁股離地 40 公分（坐墊被壓下去之後的高度），身體和書都看得到
function actRead() {
  const [b0, b1] = FURN.beans, N = FURN.nook; let lying = false, pages = 0, sips = 0, sipT = 0, cat = null, catOn = false;
  // 沿著沙發面向的方向往前坐一點，背剛好靠在靠背上
  const onBean = (c, b) => seat(c, b[0] + Math.sin(b[2]) * 0.14, BEAN_HIP - HIP, b[1] + Math.cos(b[2]) * 0.14, b[2], 'recline');
  const sitBeans = () => { onBean(me(), b0); onBean(you(), b1); };
  const lieRug = () => { seat(me(), N.x + 0.2, 0.04, N.z, 0, 'lie'); seat(you(), N.x + 0.85, 0.04, N.z, 0, 'lie'); };
  const books = on => [me(), you()].forEach(c => { if (c.ghost || c.remote) return; c.av.setItem(on ? bookItem() : null); c.av.reach(on); });
  // 坐下去懶人沙發會被壓扁、往旁邊鼓起來
  const squish = () => (IN.beans || []).forEach((g, i) => { const w = lying ? 0 : i === 0 ? 1 : duo() ? 1 : catOn ? 0.3 : 0; g.userData.sq = w; });
  // 一個人的時候，貓咪跳上旁邊那顆懶人沙發窩著
  if (!duo() && IN.beans?.[1]) load('cat').then(g => {
    if (!g || act?.id !== 'read') return;
    const o = cloneModel(g), bg = IN.beans[1]; o.scale.setScalar(1.5); o.position.set(b1[0] + Math.sin(b1[2]) * 0.08, 0.56, b1[1] + Math.cos(b1[2]) * 0.05); o.rotation.y = b1[2] + 2.4; IN.S.add(o);
    const mixer = new THREE.AnimationMixer(o), idle = g.animations.find(a => a.name === 'Idle'); if (idle) mixer.clipAction(idle).play();
    cat = { o, mixer }; catOn = !lying; o.visible = catOn; squish(); if (catOn) setTimeout(() => act?.id === 'read' && msg('貓咪跳上旁邊的懶人沙發，窩成一團 🐱'), 600);
    bg.updateMatrixWorld();
  });
  actGo(() => { sitBeans(); books(true); squish(); }, 250);
  const cold = () => seasonOf(st.day).k === 'winter' || st.tod >= 18 || st.tod < 6;
  const btns = () => setBtns([{ t: '📖 翻一頁', main: true, fn: () => {
      pages++; sfx('book'); msg(pick(BOOKS)); burst('heart', headPos(me(), lying ? 0.6 : 1.2), 1, 0.3);
      const it = me().av.item; if (it?.userData.hinge) { it.userData.flip = 0.001; it.userData.hinge.visible = true; }
      addLove(1, pages === 1 ? '安靜看書的午後' : null, 'read'); if (pages === 3) addMemo('📚', duo() ? '窩在閱讀角一起看書' : '在閱讀角看了一下午的書');
      if (duo() && pages % 3 === 0) setTimeout(() => { you().av.emote('shy', 1.2); msg(`${nameOf(you().i)} 把頭靠過來一起看`); }, 900);
    } },
    { t: '☕ 喝熱可可', fn: () => {
      if (sipT > 0) return;
      if (sips >= 3) { sips = 0; msg('再泡了一杯熱可可，香香甜甜的 ☕'); sfx('pop'); return; }
      sips++; sipT = 1.6; me().av.setItem(mugItem()); me().av.reach(true);
      if (cold()) { msg(pick(['外面好冷，熱可可暖到心裡 ☕', '捧著熱可可，手都暖起來了', '熱可可上的棉花糖化掉了，好甜'])); addLove(2, null, 'cocoa'); }
      else { msg(pick(['喝一口熱可可，好香', '熱可可配書，剛剛好', '甜甜的，再翻一頁吧'])); addLove(1, null, 'cocoa'); }
      if (sips === 3) setTimeout(() => act?.id === 'read' && msg('杯子空了，再按一次就再泡一杯'), 1700);
      burst('heart', headPos(me(), lying ? 0.6 : 1.2), 1, 0.3);
    } },
    { t: lying ? '🛋️ 回懶人沙發' : '🧸 躺在地毯上', fn: () => { lying = !lying; actGo(() => { (lying ? lieRug : sitBeans)(); books(true); if (cat) { catOn = !lying; cat.o.visible = catOn; } squish(); }, 200); btns(); } }]);
  beginAct('read', '📚 閱讀角', '窩在軟綿綿的懶人沙發上，旁邊有一疊書和一杯熱可可。', {
    focus: () => new THREE.Vector3(N.x, 0.7, N.z - 0.3), back: [INSPOTS.read.x, INSPOTS.read.z],
    update(dt) {
      if (sipT > 0) { sipT -= dt; if (sipT <= 0) { me().av.setItem(bookItem()); me().av.reach(true); } }
      [me(), you()].forEach(c => { const it = c.av?.item, u = it?.userData; if (!u?.hinge || !u.flip) return; u.flip += dt / 0.5; u.hinge.rotation.z = Math.min(1, u.flip) * Math.PI; if (u.flip >= 1) { u.flip = 0; u.hinge.visible = false; u.hinge.rotation.z = 0; } });
      (IN.beans || []).forEach(g => { const w = g.userData.sq || 0, k = Math.min(1, dt * 8), sy = 1 - 0.15 * w, sx = 1 + 0.08 * w; g.scale.x += (sx - g.scale.x) * k; g.scale.z += (sx - g.scale.z) * k; g.scale.y += (sy - g.scale.y) * k; });
      cat?.mixer.update(dt);
    },
    end() { books(false); (IN.beans || []).forEach(g => { g.userData.sq = 0; g.scale.set(1, 1, 1); }); if (cat) { IN.S.remove(cat.o); cat = null; } },
  });
  btns();
}
// 冰箱：食材數量；「魚」= 任何一條可以吃的魚
function pantryCount(k) { const P = st.pantry || {}; return k === '魚' ? EDIBLE.filter(n => n !== '愛心魚').reduce((t, n) => t + (P[n] || 0), 0) : P[k] || 0; }
function canCook(r) { return Object.entries(r[3]).every(([k, n]) => pantryCount(k) >= n); }
function useIngredients(r) { const P = st.pantry; for (const [k, n] of Object.entries(r[3])) { let left = n; if (k === '魚') { for (const f of ['小丑魚', '藍色倒吊', '黃金鯛', '小章魚', '鮪魚']) while (left > 0 && P[f] > 0) { P[f]--; left--; } } else P[k] -= n; } save(); }
const FOOD_ICON = { 雞蛋: '🥚', 魚: '🐟', 鮪魚: '🐟', 小章魚: '🐙', 愛心魚: '💗', 小丑魚: '🐠', 藍色倒吊: '🐟', 黃金鯛: '🐡' };
function pantryText() { const P = st.pantry || {}, list = Object.entries(P).filter(([, n]) => n > 0); return list.length ? list.map(([k, n]) => `${FOOD_ICON[k] || '🍽️'}${k}×${n}`).join('　') : '空空的（釣魚帶回家、去雞舍撿雞蛋）'; }
function actCook() {
  const p = me(), q = you(); seat(p, 4.9, 0, FURN.cook.z + 0.75, Math.PI, 'stand'); p.y = null; seat(q, 3.8, 0, FURN.cook.z + 0.75, Math.PI, 'stand'); q.y = null; // 站在流理台前：一個顧爐子、一個在水槽邊洗菜
  let dish = null, prog = 0, cooking = false;
  const pickRecipe = () => {
    openDlg('🍳 食譜', `<p class="muted">🧊 冰箱：${esc(pantryText())}</p><div class="shop">${RECIPES.map((r, i) => { const need = Object.entries(r[3]).map(([k, n]) => `<span class="nw">${FOOD_ICON[k] || ''}${esc(k)}×${n}</span>`).join(' ') || '不用食材'; return `<button type="button" data-r="${i}" ${canCook(r) ? '' : 'disabled'}>${r[1]} ${esc(r[0])}<small>${need} <span class="nw">+${r[4]} 🪙</span></small></button>`; }).join('')}</div>`);
    $('#dlg-body').querySelectorAll('[data-r]').forEach(b => b.onclick = () => { $('#dlg').close(); start(RECIPES[+b.dataset.r]); });
  };
  beginAct('cook', '🍳 做飯', `冰箱：${pantryText()}`, {
    focus: () => new THREE.Vector3(4.5, 1, -3.6), back: [INSPOTS.kitchen.x, INSPOTS.kitchen.z + 0.9],
    btns: [{ t: '📖 看食譜', main: true, fn: pickRecipe }],
    update(dt) {
      if (!cooking) return; prog += dt / 4; meter(true, Math.min(1, prog) * 0.6); p.av.reach(Math.sin(prog * 30) > 0); q.av.reach(true);
      if (Math.random() < dt * 3) burst('star', new THREE.Vector3(5.0, 1.25, FURN.cook.z), 1, 0.3);
      if (prog >= 1) { cooking = false; meter(false); p.av.reach(false); q.av.reach(false); serve(); }
    },
  });
  setTimeout(pickRecipe, 450);
  function start(r) { if (!canCook(r)) return; useIngredients(r); dish = r; cooking = true; prog = 0; me().av.emote('interact', 4.2); you().av.emote('interact', 4.2); msg(duo() ? `${nameOf(me().i)} 切菜、${nameOf(you().i)} 掌廚，做${dish[0]}中…` : `做${dish[0]}中…`); setBtns([]); sfx('sizzle'); }
  function serve() {
    IN.dish.clear(); [-0.35, 0.35].forEach(dx => { const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.03, 16), toon('#ffffff')); pl.position.set(dx * 1.3, 0, dx * 0.7); IN.dish.add(pl); const f = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), toon(dish[2])); f.scale.y = 0.45; f.position.set(dx * 1.3, 0.05, dx * 0.7); IN.dish.add(f); });
    IN.dish.visible = true; st.dishes++; st.cooked = st.cooked || {}; st.cooked[dish[0]] = (st.cooked[dish[0]] || 0) + 1; quest('cook'); addCoins(dish[4] * (surpriseIs('chef') ? 2 : 1)); addLove(dish[5], `${dish[1]} ${dish[0]}完成`); addMemo(dish[1], `${duo() ? '一起' : ''}做了${dish[0]}`);
    msg(`${dish[0]}做好了，放在餐桌上！到餐桌${duo() ? '一起' : ''}吃吧。`); setBtns([{ t: '去餐桌吃飯', main: true, fn: () => { endAct(); actEat(); } }, { t: '再做一道', fn: pickRecipe }]);
  }
}
function actEat() {
  if (!IN.dish.visible) return toast('先去廚房做飯吧');
  const y = 0.47 - HIP;
  const T = FURN.table; actGo(() => { seat(me(), T.x - 0.45, y, T.z - 1.0, 0); seat(you(), T.x + 0.45, y, T.z + 1.0, Math.PI); }, 250); // 坐在椅子正中間，頭不會撞到桌子
  beginAct('eat', '🍽️ 吃飯', '開動了！', {
    focus: () => new THREE.Vector3(FURN.table.x, 0.9, FURN.table.z), back: [INSPOTS.dining.x, INSPOTS.dining.z],
    btns: [{ t: '好好吃！', main: true, fn: () => { me().av.emote('eatseat', 2.2); burst('heart', headPos(me(), 1.3), 2); addLove(1, null, 'eat'); } }, duo() && { t: '餵對方一口', fn: () => { me().av.reach(true); setTimeout(() => { me().av.reach(false); you().av.emote('shy', 1.4); burst('heart', headPos(you(), 1.3), 5); }, 500); addLove(3, '啊～', 'feed2'); } }, { t: '吃飽了', fn: () => { IN.dish.visible = false; addMemo('🍽️', '一起吃了一頓飯'); endAct(); } }],
  });
}

// ---------- 對話框：地圖、回憶本、造型 ----------
// 視窗的樣子跟著內容走：任務＝手帳、信＝信紙、回憶本＝相簿、便利貼＝軟木板
const dlgKind = t => /^📋/.test(t) ? 'note' : /^📔/.test(t) ? 'album' : /^📝 冰箱|留給你的/.test(t) ? 'cork' : /信|^🎉|^🍾/.test(t) ? 'letter' : '';
const DLG_EN = { '💞': 'Daily Question', '📋': 'Daily Quest', '📔': 'Memories', '💌': 'Letter', '🌐': 'Connect', '🗺️': 'Island Map', '🎵': 'Music', '📝': 'Notes', '🍾': 'Message in a Bottle', '🎁': 'Gift', '🎉': 'Anniversary', '🛍️': 'Shop', '🪙': 'Shop', '👗': 'Wardrobe', '🍳': 'Recipes', '🌱': 'Garden', '📳': 'Notifications', '🏆': 'Rewards' };
function setDlgTitle(title) {
  // 標題都是「圖示＋空白＋文字」；不用 \p{…} 正規表示式（舊版 iPhone 不支援，整支程式會載不起來）
  const sp = title.indexOf(' '), head = sp > 0 && sp <= 3 ? title.slice(0, sp) : '', isIc = head && !/[\u4e00-\u9fffA-Za-z0-9]/.test(head);
  const ic = isIc ? head : '', tx = isIc ? title.slice(sp + 1) : title, en = DLG_EN[ic] || '';
  $('#dlg-title').innerHTML = `${en ? `<small class="t-en">${esc(en)}</small>` : ''}${ic ? `<span class="t-ic">${ic}</span>` : ''}<span class="t-tx">${esc(tx)}</span>`;
}
/* 視窗關閉動畫：縮小淡出 140ms 再真的關；期間如果又開新視窗就取消 */
(() => { const d = $('#dlg'), close0 = d.close.bind(d); let t = 0;
  d.close = () => { if (!d.open || t) return; d.classList.add('closing'); t = setTimeout(() => { t = 0; d.classList.remove('closing'); close0(); }, 140); };
  d.cancelClose = () => { if (t) { clearTimeout(t); t = 0; d.classList.remove('closing'); } }; })();
/* 數字跳動：小島幣從舊數字滾到新數字 */
function rollNum(el, to) {
  const from = +(el.dataset.v ?? to); el.dataset.v = to; if (from === to || !started()) { el.textContent = to; return; }
  const t0 = performance.now(), dur = Math.min(900, 250 + Math.abs(to - from) * 12); cancelAnimationFrame(el._raf);
  const f = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - (1 - k) ** 3; el.textContent = Math.round(from + (to - from) * e); if (k < 1) el._raf = requestAnimationFrame(f); }; el._raf = requestAnimationFrame(f);
  const chip = el.closest('.chip'); if (chip && to > from) { chip.classList.remove('bump'); void chip.offsetWidth; chip.classList.add('bump'); }
}
/* 獎勵飛進去：小島幣飛到上面的錢幣數字、愛心飛到甜蜜值 */
function flyTo(emoji, target, n = 5) {
  const T = $(target); if (!T || !started() || document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) return; const tr = T.getBoundingClientRect();
  tagPos(me(), v3); v3.project(cam); const sx = clamp((v3.x + 1) / 2 * innerWidth, 30, innerWidth - 30), sy = clamp((1 - v3.y) / 2 * innerHeight, 120, innerHeight - 200);
  for (let i = 0; i < Math.min(n, 7); i++) { const e = document.createElement('i'); e.className = 'fly'; e.textContent = emoji; document.body.appendChild(e);
    const ox = (Math.random() - 0.5) * 70, oy = (Math.random() - 0.5) * 50 - 20, tx = tr.left + tr.width / 2, ty = tr.top + tr.height / 2;
    e.animate([{ transform: `translate(${sx}px, ${sy}px) scale(.4)`, opacity: 0 }, { transform: `translate(${sx + ox}px, ${sy + oy}px) scale(1.15)`, opacity: 1, offset: 0.25 }, { transform: `translate(${tx}px, ${ty}px) scale(.55)`, opacity: 0.9 }], { duration: 750 + i * 70, delay: i * 55, easing: 'cubic-bezier(.5, 0, .3, 1)', fill: 'both' }).onfinish = () => e.remove(); }
}
function openDlg(title, html) { $('#dlg').cancelClose(); delete $('#dlg').dataset.qa; setDlgTitle(title); $('#dlg-body').innerHTML = html; const d = $('#dlg'); const k = dlgKind(title); if (k) d.dataset.kind = k; else delete d.dataset.kind; d.querySelector('#dlg-body').scrollTop = 0; if (!d.open) d.showModal(); }
$('#btn-map').onclick = () => {
  sfx('click');
  const cell = s => `<button type="button" class="cell" data-s="${s.id}" style="border:0"><span class="e">${s.icon}</span>${esc(s.name)}</button>`;
  const minor = s => /^(ball|sakura|lampIn|plantIn|guitarIn)/.test(s.id); /* 開燈、澆花、踢球這類小動作不放進地圖 */
  const outL = SP.filter(s => s.sc === 'out' && !spotHidden(s) && s.id !== 'door' && !minor(s)), inL = SP.filter(s => s.sc === 'in' && !spotHidden(s) && s.id !== 'exit' && !minor(s));
  openDlg('🗺️ 小島地圖', `<p class="muted">點一下，畫面一暗就到了。</p><b>🏝️ 屋外</b><div class="grid3">${outL.map(cell).join('')}</div>${MP.role === 'g' ? '' : `<b>🏠 小木屋裡</b><div class="grid3">${inL.map(cell).join('')}</div>`}`);
  $('#dlg-body').querySelectorAll('[data-s]').forEach(b => b.onclick = () => { const s = SP.find(x => x.id === b.dataset.s); $('#dlg').close(); teleportTo(s); });
};
$('#couple-card').onclick = () => MP.role === 'g' ? openNet() : openBook('us');
$('#btn-book').onclick = () => MP.role === 'g' ? openNet() : openBook('memo');
$('#btn-net').onclick = () => openNet();
/* 回憶點下去會到哪裡（舊的回憶用文字判斷） */
const twDateOfTs = ts => new Date(ts + 8 * 3600e3).toISOString().slice(0, 10);
function memoGo(m) {
  if (m.go) return m.go;
  if (/^一起回答了「/.test(m.text) && m.ts) return 'qa:' + twDateOfTs(m.ts);
  if (/寫的信|寄了一封信|郵差/.test(m.text)) return 'mail';
  if (/便利貼/.test(m.text)) return 'notes';
  if (RARE.some(r => m.text.includes(r.name))) return 'col';
  return '';
}
/* 從通知打開：?go=qa 之類，進小島後直接帶過去 */
let pendingGo = new URLSearchParams(location.search).get('go') || '';
if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('message', e => { const g = e.data?.go; if (!g) return; if (started() && !$('#hud').hidden) runGo(g); else pendingGo = g; });
function runGo(g) {
  const [k, v] = String(g).split(':');
  if (k === 'qa') return openQA(false, v); if (k === 'chat') return openChat(); if (k === 'notes') return openNotes(); if (k === 'mail') return openMail();
  if (k === 'quests') return openQuests(); if (k === 'col') return openBook('col');
}
function openBook(tab = 'memo') {
  sfx('click');
  const tabs = [['memo', '回憶'], ['col', '收藏'], ['us', '我們'], ['about', '關於']];
  const L = LV(), d = daysTogether();
  const body = {
    memo: () => st.diary.length ? st.diary.slice(0, 120).map(m => { const g = memoGo(m), inner = `<span class="ic">${m.icon}</span><b>${esc(m.text)}</b><small>${esc(m.d)}${m.day && st.born && m.day >= st.born ? ` · 小島第 ${m.day - st.born + 1} 天` : ''}</small>`; return g ? `<button type="button" class="memo tap" data-go="${esc(g)}">${inner}<span class="m-go">›</span></button>` : `<div class="memo">${inner}</div>`; }).join('') : '<p class="muted">還沒有回憶，去小島上走走吧。</p>',
    col: () => `<b>✨ 稀有事件</b><div class="grid3">${RARE.map(r => `<div class="cell ${st.rares?.[r.k] ? '' : 'no'}"><span class="e">${st.rares?.[r.k] ? r.icon : '❔'}</span>${st.rares?.[r.k] ? esc(r.name) : '？？？'}<small>${st.rares?.[r.k] ? `看過 ${st.rares[r.k]} 次` : '還沒遇過'}</small></div>`).join('')}</div><p class="muted">已經找到 ${st.surFound || 0} 個每日驚喜</p><b>🎣 釣到的東西</b><div class="grid3">${FISH.map(f => `<div class="cell ${st.fish[f[0]] ? '' : 'no'}"><span class="e">${f[1]}</span>${st.fish[f[0]] ? esc(f[0]) : '？？？'}<small>${st.fish[f[0]] ? '×' + st.fish[f[0]] + (st.fishMax?.[f[0]] ? `・最大 ${st.fishMax[f[0]]} 公分` : '') : '還沒釣到'}</small></div>`).join('')}</div>
      <b>🍳 一起做過的料理</b><div class="grid3">${RECIPES.map(r => `<div class="cell ${st.cooked?.[r[0]] ? '' : 'no'}"><span class="e">${r[1]}</span>${st.cooked?.[r[0]] ? esc(r[0]) : '？？？'}<small>×${st.cooked?.[r[0]] || 0}</small></div>`).join('')}</div>
      <b>💐 送過的花</b><div class="grid3">${[['鬱金香', '🌷'], ['玫瑰', '🌹'], ['滿天星', '💮'], ['向日葵', '🌻'], ['繡球花', '💠']].map(([n, e]) => `<div class="cell ${st.picked?.[n] ? '' : 'no'}"><span class="e">${e}</span>${st.picked?.[n] ? n : '？？？'}<small>×${st.picked?.[n] || 0}</small></div>`).join('')}</div>
      <b>🐚 海邊撿到的</b><div class="grid3">${SHELLS.map(s => `<div class="cell ${st.shells[s[0]] ? '' : 'no'}"><span class="e">${s[1]}</span>${esc(s[0])}<small>×${st.shells[s[0]] || 0}</small></div>`).join('')}</div>
      <p class="muted">沙堡 ${st.castles} 座 · 送花 ${st.flowersGiven} 次 · 做飯 ${st.dishes} 次 · 煙火 ${st.fireworks} 發 · 繞島 ${st.laps} 圈 · 許願 ${st.wishes} 次</p>`,
    us: () => `<div class="memo"><span class="ic">💗</span><b>${esc(nameOf(0))} ♥ ${esc(nameOf(1))}</b><small>${d ? `在一起第 ${d} 天 · ` : ''}甜蜜值 ${st.love} · Lv${L.lv} ${L.title} · 一起玩了 ${st.playDays || 1} 天${L.next ? `（升級還要${[L.needLove ? `甜蜜值 ${L.needLove}` : '', L.needDays ? `一起玩 ${L.needDays} 天` : ''].filter(Boolean).join('、')}）` : ''}</small></div>
      <label class="anniv"><span>我的名字</span><input id="ed-n0" maxlength="8" value="${esc(st.myName || '')}"></label>
      <label class="anniv"><span>在一起的日子</span><input id="ed-an" type="date" value="${esc(st.anniv)}"></label>
      <button type="button" class="ghost" id="ed-look0">👗 我的造型</button>
      <p class="muted">另一半的名字和造型，由另一半在自己的手機設定（🌐 連線後會同步）。</p>
      <button type="button" class="primary" id="ed-save">儲存</button>${unlockHtml()}`,
    about: () => `<p>兩個人的 3D 小島。小木屋、沙灘、碼頭、燈塔，一起盪鞦韆、釣魚、烤棉花糖、看夕陽、划船、放煙火。</p>
      <p class="muted">資料只存在這支手機（瀏覽器）裡。版本 ${esc(APP_VER)}</p>
      <details><summary>3D 模型出處（Polyfork，CC BY 4.0）</summary><div id="credits" class="muted" style="font-size:var(--fs-xs);line-height:1.5">載入中…</div></details>
      <b>⚙️ 設定</b>
      <div class="toggle-row"><span>🎨 介面風格<br><small class="muted">字型、顏色、視窗的樣子</small></span></div>
      <div class="row" id="ui-pick">${Object.entries(UI_STYLES).map(([k, [n]]) => `<button type="button" class="ghost" data-ui="${k}" aria-pressed="${(st.ui || 'cozy') === k}">${n}</button>`).join('')}</div>
      <div class="toggle-row"><span>🔋 省電模式<br><small class="muted">畫面稍微不那麼細，比較順、比較不燙</small></span><button type="button" id="low-tg" aria-pressed="${!!st.low}">${st.low ? '開' : '關'}</button></div>
      <button type="button" class="ghost" id="tut-again">🎓 再看一次新手教學</button>
      <button type="button" class="ghost" id="reset-all" style="margin-top:8px">清除所有資料、重新開始</button>`,
  };
  openDlg('📔 我們的回憶本', `<div class="tabs" role="tablist">${tabs.map(([k, n]) => `<button type="button" role="tab" data-t="${k}" aria-selected="${k === tab}">${n}</button>`).join('')}</div><div id="book-body" style="display:grid;gap:8px">${body[tab]()}</div>`);
  $('#book-body').querySelectorAll('[data-go]').forEach(b => b.onclick = () => { sfx('click'); runGo(b.dataset.go); });
  $('#dlg-body').querySelectorAll('[data-t]').forEach(b => b.onclick = () => openBook(b.dataset.t));
  if (tab === 'us') {
    $('#ed-save').onclick = () => { st.myName = $('#ed-n0').value.trim().slice(0, 8); st.names[myIdx()] = st.myName; st.anniv = $('#ed-an').value; save(); updateHud(); $('#dlg').close(); toast('已儲存'); };
    $('#ed-look0').onclick = () => openLooks(myIdx());
  }
  if (tab === 'about') {
    fetch('models/credits.json').then(r => r.json()).then(c => { $('#credits').innerHTML = Object.values(c).filter(Boolean).map(esc).join('<br>'); }).catch(() => {});
    $('#ui-pick').querySelectorAll('[data-ui]').forEach(b => b.onclick = () => { st.ui = b.dataset.ui; save(); applyUI(st.ui); $('#ui-pick').querySelectorAll('[data-ui]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
    $('#low-tg').onclick = () => { st.low = !st.low; save(); applyLow(); $('#low-tg').setAttribute('aria-pressed', String(st.low)); $('#low-tg').textContent = st.low ? '開' : '關'; };
    $('#tut-again').onclick = () => { $('#dlg').close(); tutorialStart(); };
    $('#reset-all').onclick = () => { if (confirm('確定要清除小島上所有的回憶嗎？這個動作不能復原。')) { localStorage.removeItem(KEY); location.reload(); } };
  }
}
function openLooks(i = me().i) {
  const L = st.looks[i], lvl = LV().lv;
  // 換裝：面板從下面升起來，上半部看得到自己（可以轉身看背面）
  const c = chars[i]; if (!lookCam) { c.path = null; const ry0 = c.ry; lookCam = { c, back: false, a: scene === 'in' ? Math.atan2(-c.x, -c.z) : c.ry }; $('#dlg').addEventListener('close', () => { c.ry = ry0; lookCam = null; delete $('#dlg').dataset.sheet; }, { once: true }); } // 屋內：鏡頭從房間中央那一側看（不會被家具擋住）
  const accOK = a => a === 0 || (a === 2 && lvl >= 2) || (a === 1 && lvl >= 5);
  const rows = [['髮型', 'hair', HAIRS], ['髮色', 'hairColor', HAIR_COLORS.map((c, k) => `色 ${k + 1}`)], ['膚色', 'skin', SKINS.map((c, k) => `膚 ${k + 1}`)], ['衣服', 'outfit', OUTFITS.map(o => o.name)], ['頭型', 'head', HEADS], ['眼睛', 'eye', EYES], ['嘴巴', 'mouth', MOUTHS], ['配件', 'acc', ACCS]];
  openDlg(`👗 ${nameOf(i)} 的造型`, `<p class="muted">改了馬上就看得到。${lvl < 4 ? '配件「小花」Lv2、「愛心光環」Lv4 解鎖。' : ''}</p>${rows.map(([n, k, arr]) => `<div class="look-row" data-k="${k}" data-n="${arr.length}"><span>${n}</span><span id="lv-${k}">${esc(arr[(L[k] | 0) % arr.length])}</span><button type="button" data-d="-1" aria-label="上一個">‹</button><button type="button" data-d="1" aria-label="下一個">›</button></div>`).join('')}
    <button type="button" class="ghost" id="lk-couple">👫 兩個人一起換情侶裝</button>
    <div class="row"><button type="button" class="ghost" id="lk-rand">🎲 隨機</button><button type="button" class="ghost" id="lk-g">${L.gender === 'f' ? '換成男生' : '換成女生'}</button></div>`);
  $('#dlg').dataset.sheet = '1';
  const turn = document.createElement('button'); turn.type = 'button'; turn.className = 'ghost lk-turn'; turn.textContent = lookCam.back ? '看正面' : '看背面';
  turn.onclick = () => { lookCam.back = !lookCam.back; turn.textContent = lookCam.back ? '看正面' : '看背面'; sfx('click'); };
  $('#dlg-body').prepend(turn);
  $('#dlg-body').querySelectorAll('.look-row').forEach(r => r.querySelectorAll('button').forEach(b => b.onclick = () => {
    const k = r.dataset.k, n = +r.dataset.n; let v = ((L[k] | 0) + +b.dataset.d + n) % n;
    if (k === 'acc') { let guard = 0; while (!accOK(v) && guard++ < n) v = (v + +b.dataset.d + n) % n; }
    L[k] = v; chars[i].av.setLook(L); save(); const arr = rows.find(x => x[1] === k)[2]; $('#lv-' + k).textContent = arr[v];
  }));
  $('#lk-couple').onclick = () => {
    const cp = OUTFITS.map((o, k) => o.kind === 'couple' ? k : -1).filter(k => k >= 0);
    const now = cp.indexOf(st.looks[0].outfit), next = cp[(now + 1) % cp.length];
    [0, 1].forEach(j => { st.looks[j].outfit = next; chars[j].av.setLook(st.looks[j]); }); save(); openLooks(i);
    burst('heart', midPos(), 6); toast(`換上${OUTFITS[next].name} 👫`); if (!st.coupleWorn) { st.coupleWorn = 1; addMemo('👫', `第一次穿${OUTFITS[next].name}`); addLove(3); }
  };
  $('#lk-rand').onclick = () => { st.looks[i] = randomLook(L.gender); st.looks[i].acc = accOK(L.acc | 0) ? L.acc : 0; makeAv(i); save(); openLooks(i); };
  $('#lk-g').onclick = () => { st.looks[i] = randomLook(L.gender === 'f' ? 'm' : 'f'); makeAv(i); save(); openLooks(i); };
}

// ---------- 海邊撿貝殼 ----------
let shellObjs = [];
function spawnShells() {
  shellObjs.forEach(s => OUT.remove(s.o)); shellObjs = [];
  for (let k = 0, N = surpriseIs('shellday') ? 15 : 7; k < N; k++) {
    let x, z, g = 0; do { const a = Math.random() * Math.PI * 2, R = shoreR(Math.cos(a), Math.sin(a)) - rand(5.2, 7.5); x = Math.cos(a) * R; z = Math.sin(a) * R; } while (g++ < 30 && (!walkable(x, z) || x > 24 && Math.abs(z) < 3));
    const t = Math.floor(Math.random() * SHELLS.length), col = ['#ffb0c0', '#ffa040', '#f0e0d0', '#7ad8c8', '#e8c8a0', '#ffffff'][t];
    const o = new THREE.Group(); const m = t === 1 ? new THREE.Mesh(new THREE.OctahedronGeometry(0.14), toon(col)) : t === 4 ? new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 8), toon(col)) : new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), toon(col, t === 3 ? { transparent: true, opacity: 0.75 } : {}));
    if (t === 1) m.scale.y = 0.3; if (t === 4) m.rotation.z = Math.PI / 2; o.add(m);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: '#fff6c0', transparent: true, depthWrite: false, opacity: 0.7 })); sp.scale.set(0.6, 0.6, 1); sp.position.y = 0.15; o.add(sp);
    o.position.set(x, standH(x, z) + 0.04, z); OUT.add(o); shellObjs.push({ o, t, sp });
  }
}
function tickShells(t) {
  const p = me(); if (scene !== 'out') return;
  for (let i = shellObjs.length - 1; i >= 0; i--) {
    const s = shellObjs[i]; s.sp.material.opacity = 0.45 + Math.sin(t * 3 + i) * 0.3;
    if (Math.hypot(s.o.position.x - p.x, s.o.position.z - p.z) < 1.0) {
      OUT.remove(s.o); shellObjs.splice(i, 1); const [n, e] = SHELLS[s.t]; st.shells[n] = (st.shells[n] || 0) + 1; save();
      p.av.emote('pickup', 1.1); toast(`撿到 ${e} ${n}（共 ${st.shells[n]} 個）　+5 🪙`); st.coins = (st.coins || 0) + 5; quest('shell'); checkMilestones(); updateChips(); sfx('chime'); burst('star', s.o.position.clone().add(new THREE.Vector3(0, 0.5, 0)), 3, 0.2);
      if (st.shells[n] === 1) addMemo(e, `在海邊撿到第一個${n}`);
      if (s.t === 5) { addLove(3, `把心形石頭送給 ${nameOf(you().i)}`); you().av.emote('shy', 1.4); }
    }
  }
}

// ---------- 新的一天 ----------
function newDay(old) {
  spawnShells(); save(); updateHud(); updateChips(); drawSnowman(); drawEggs(); setupSurprise(); drawTree(); setTimeout(announceSurprise, 1500);
  const s0 = seasonOf(old || st.day - 1), s1 = seasonOf(st.day); if (s0 !== s1) setTimeout(() => toast(`${s1.icon} ${s1.name}來了！`, 3500), 1200); else setTimeout(() => toast(`新的一天 ☀️ ${dateOfDay(st.day).getUTCMonth() + 1} 月 ${dateOfDay(st.day).getUTCDate()} 日`, 3000), 1200);
  setTimeout(() => { countPlayDay(); festivalCheck(); }, 4000);
}

// ---------- 拍照 ----------
const photo = { on: false };
$('#btn-photo').onclick = () => {
  document.querySelectorAll('#photo-ui [data-p="hug"], #photo-ui [data-p="kiss"]').forEach(b => { b.hidden = !duo(); }); if (act && act.id !== 'boat') {} photo.on = true; $('#hud').hidden = true; $('#act-panel').style.display = 'none'; $('#photo-ui').hidden = false; sfx('click'); };
$('#ph-close').onclick = () => { photo.on = false; $('#hud').hidden = false; $('#act-panel').style.display = ''; $('#photo-ui').hidden = true; };
$('#photo-ui').querySelector('.ph-poses').addEventListener('click', e => {
  const b = e.target.closest('[data-p]'); if (!b) return; const k = b.dataset.p, p = me(), q = you();
  if (!act) { // 兩個人面對鏡頭靠在一起
    const fx = cam.position.x - p.x, fz = cam.position.z - p.z, ry = Math.atan2(fx, fz); const rx = -Math.cos(ry), rz = Math.sin(ry);
    q.x = p.x + rx * 0.6; q.z = p.z + rz * 0.6; p.ry = q.ry = ry;
    if (k === 'hug' || k === 'kiss') { q.x = p.x + rx * 0.45; q.z = p.z + rz * 0.45; p.ry = ry - 0.9; q.ry = ry + 0.9; }
  }
  const map = { hug: ['hug', 'hug'], kiss: ['kiss', 'shy'], wave: ['wave', 'wave'], cheer: ['cheer', 'cheer'], heart: ['clap', 'clap'] }[k];
  p.av.emote(map[0], 3); q.av.emote(map[1], 3); loveHold = 3.2; if (k === 'heart' || k === 'kiss') burst('heart', midPos(), 6);
});
$('#ph-shot').onclick = () => {
  const w = innerWidth, h = innerHeight, scale = Math.max(1, 1080 / Math.min(w, h)) * (PR > 1.4 ? 1 : 1);
  R.setPixelRatio(Math.min(3, scale)); R.setSize(w, h, false); R.render(curS(), cam);
  const src = R.domElement, out = document.createElement('canvas'), band = Math.round(src.height * 0.1);
  out.width = src.width; out.height = src.height + band; const g = out.getContext('2d');
  g.fillStyle = '#fff8f2'; g.fillRect(0, 0, out.width, out.height); g.drawImage(src, 0, 0);
  g.fillStyle = '#e85a80'; g.font = `900 ${Math.round(band * 0.34)}px "Noto Sans TC", sans-serif`; g.textBaseline = 'middle';
  g.fillText(`${nameOf(0)} ♥ ${nameOf(1)}`, band * 0.4, src.height + band * 0.5);
  g.fillStyle = '#8a7480'; g.font = `700 ${Math.round(band * 0.24)}px "Noto Sans TC", sans-serif`; g.textAlign = 'right';
  const dd = daysTogether(); g.fillText(`我們的小島 · ${dd ? `在一起第 ${dd} 天` : dateStr()}`, out.width - band * 0.4, src.height + band * 0.5);
  R.setPixelRatio(PR); resize();
  if (MP.role !== 'g') savePhotoThumb(out);
  const fl = document.createElement('div'); fl.className = 'flash'; document.body.appendChild(fl); setTimeout(() => fl.remove(), 600); sfx('shutter');
  out.toBlob(async blob => {
    if (!blob) return; const file = new File([blob], `我們的小島-${Date.now()}.png`, { type: 'image/png' });
    try { if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: '我們的小島' }); return; } } catch (e) { if (e.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('照片已儲存');
  }, 'image/png');
  addMemo('📷', '拍了一張合照'); quest('photo');
};
// 背景音樂：選歌面板
$('#btn-music').onclick = () => {
  sfx('click'); const cur = st.music ? (st.track ?? -1) : null;
  const row = (v, t, sub) => `<button type="button" data-m="${v}" aria-pressed="${cur === v}">${t}<small>${sub}</small></button>`;
  openDlg('🎵 背景音樂', `<div class="opts music">${row(-1, '🔀 自動輪播', '四首輪流播放')}${TRACKS.map((t, i) => row(i, `🎶 ${t[1]}`, t[0])).join('')}${row('off', '🔇 關閉音樂', '音效還是會有')}</div>${st.music && Music.playing ? `<p class="muted">正在播放：${esc(Music.playing)}</p>` : ''}
    <div class="toggle-row"><span>🌿 環境音<br><small class="muted">海浪、鳥叫、蟲鳴、營火、雨聲、腳步聲</small></span><button type="button" id="amb-tg" aria-pressed="${st.amb !== false}">${st.amb !== false ? '開' : '關'}</button></div><div class="toggle-row"><span>📱 背景繼續播音樂<br><small class="muted">切到別的 App 或鎖定畫面時，音樂繼續播（環境音會停）</small></span><button type="button" id="bg-tg" aria-pressed="${st.bgMusic !== false}">${st.bgMusic !== false ? '開' : '關'}</button></div>`);
  $('#bg-tg').onclick = () => { st.bgMusic = st.bgMusic === false; setBackgroundPlay(st.bgMusic); save(); $('#bg-tg').setAttribute('aria-pressed', String(st.bgMusic)); $('#bg-tg').textContent = st.bgMusic ? '開' : '關'; };
  $('#amb-tg').onclick = () => { st.amb = st.amb === false; Amb.setOn(st.amb); save(); $('#amb-tg').setAttribute('aria-pressed', String(st.amb)); $('#amb-tg').textContent = st.amb ? '開' : '關'; };
  $('#dlg-body').querySelectorAll('[data-m]').forEach(b => b.onclick = () => {
    const v = b.dataset.m;
    if (v === 'off') { st.music = false; Music.stop(); }
    else { const i = +v; st.music = true; st.track = i; Music.pick(i); Music.play(); }
    save(); updateHud(); $('#dlg').close();
  });
};

// ---------- 鏡頭 ----------
const camT = new THREE.Vector3(), camP = new THREE.Vector3(), tmpT = new THREE.Vector3();
function camBlocked(x, y, z) {
  for (const [x0, z0, x1, z1] of BOXES) if (y < 6.5 && x > x0 - 0.4 && x < x1 + 0.4 && z > z0 - 0.4 && z < z1 + 0.4) return true;
  return false;
}
// 換裝時的鏡頭：在角色正前方、稍微往下看，角色在畫面上半部（下半部是換裝面板）
let lookCam = null;
function updateCam(dt, snap) {
  const p = me();
  if (build) { // 裝潢：斜上方俯視，跟著家具
    const B = build, yaw = scene === 'in' ? view.inYaw : view.yaw, pit = 1.0, d = B.dist;
    tmpT.set(B.mode === 'pick' ? B.x : B.sx ?? B.x, (scene === 'in' ? 0 : standH(B.x, B.z)) + 0.3, B.mode === 'pick' ? B.z : B.sz ?? B.z);
    camP.set(tmpT.x + Math.sin(yaw) * Math.cos(pit) * d, tmpT.y + Math.sin(pit) * d, tmpT.z + Math.cos(yaw) * Math.cos(pit) * d);
    if (scene === 'in') cutaway(IN, camP.x, camP.z);
    const kk = snap ? 1 : 1 - Math.exp(-dt * 6); camT.lerp(tmpT, kk); cam.position.lerp(camP, kk); cam.lookAt(camT); return;
  }
  if (lookCam) {
    const c = lookCam.c, r = c.av.root.position, a = lookCam.a, d = scene === 'in' ? 4.4 : innerWidth > innerHeight ? 4.2 : 6.2;
    c.ry = a + (lookCam.back ? Math.PI : 0); // 看背面＝角色轉過去
    // 看的點在角色腳下，角色就會出現在畫面上半部（下半部被換裝面板蓋住）
    tmpT.set(r.x, r.y - 0.2, r.z); camP.set(r.x + Math.sin(a) * d, r.y + 0.45, r.z + Math.cos(a) * d);
    if (scene === 'in') cutaway(IN, camP.x, camP.z);
    const k = snap ? 1 : 1 - Math.exp(-dt * 5); camT.lerp(tmpT, k); cam.position.lerp(camP, k); cam.lookAt(camT); return;
  }
  if (scene === 'in') {
    tmpT.set(clamp(p.x, -5, 5) * 0.65, 0.9, clamp(p.z, -3.5, 3.5) * 0.55);
    if (act?.focus && (!act.free || act.look)) tmpT.lerp(act.focus(), 0.7);
    const d = view.inDist, yaw = view.inYaw;
    const ip = view.inPitch; camP.set(tmpT.x + Math.sin(yaw) * d * Math.cos(ip), Math.max(1.2, tmpT.y + d * Math.sin(ip)), tmpT.z + Math.cos(yaw) * d * Math.cos(ip));
    cutaway(IN, cam.position.x, cam.position.z);
  } else {
    if (act?.focus && (!act.free || act.look)) tmpT.copy(act.focus());
    else if (act?.free) { const rp = p.av.root.position, ct = act._ct || (act._ct = rp.clone()); ct.lerp(rp, Math.min(1, dt * (act.camK || 1.6))); tmpT.set(ct.x, ct.y + (p.av.pose === 'lie' ? 0.7 : 1.2), ct.z); } /* 低通：鏡頭不跟著小晃動 */
    else tmpT.set(p.av.root.position.x, p.av.root.position.y + 1.2, p.av.root.position.z);
    const nf = act?.near?.(); let d = view.dist * (act?.bigView ? 1.6 : nf ? nf : act && !act.free ? 1.1 : 1);
    const yaw = view.yaw, pit = view.pitch;
    for (let k = 0; k < 12; k++) { camP.set(tmpT.x + Math.sin(yaw) * Math.cos(pit) * d, tmpT.y + Math.sin(pit) * d, tmpT.z + Math.cos(yaw) * Math.cos(pit) * d); if (!camBlocked(camP.x, camP.y, camP.z)) break; if (d < 2.5) { camP.y = Math.max(camP.y, 7.2); break; } d *= 0.8; }
    camP.y = Math.max(camP.y, standH(camP.x, camP.z) + 0.6);
    /* 稀有事件：鏡頭轉向它幾秒，人和鯨魚／極光一起入鏡 */
    if (RAREFX.o && RAREFX.focus && RAREFX.t < RAREFX.camDur && !act) {
      const f = RAREFX.focus(), pp = p.av.root.position, dx = f.x - pp.x, dz = f.z - pp.z, L = Math.hypot(dx, dz) || 1;
      if (RAREFX.k === 'bluetears') { tmpT.copy(f); camP.set(f.x - dx / L * 9, 6.5, f.z - dz / L * 9); } /* 藍眼淚：從上面往下看浪打上來的地方 */
      else { tmpT.set(pp.x + dx * 0.55, Math.min(f.y, 14) * 0.6 + pp.y * 0.4, pp.z + dz * 0.55); camP.set(pp.x - dx / L * 6.5, pp.y + 3, pp.z - dz / L * 6.5); } camP.y = Math.max(camP.y, standH(camP.x, camP.z) + 0.8);
    }
  }
  const k = snap ? 1 : 1 - Math.exp(-dt * (act?.camSpeed?.() || (RAREFX.o && RAREFX.t < RAREFX.camDur ? 1.6 : 6)));
  camT.lerp(tmpT, k); cam.position.lerp(camP, k); cam.lookAt(camT);
}

// ---------- 連線：其他人的角色、共用存檔、情侶互動、訪客 ----------
const SHARED = ['santaGot', 'lampsOff', 'letters', 'rares', 'rareDay', 'surFound', 'playDays', 'playDay', 'loveDay', 'keepPlaces', 'names', 'looks', 'anniv', 'born', 'rt', 'theme', 'pantry', 'eggs', 'fedDay', 'fish', 'fishMax', 'coins', 'inv', 'decor', 'quests', 'rewards', 'questDays', 'snowman', 'shells', 'garden', 'castles', 'letterDay', 'flowersGiven', 'dishes', 'wishes', 'fireworks', 'laps', 'coupleWorn', 'notes', 'tree', 'surprise', 'photos', 'cooked', 'picked', 'puzzle', 'gh'];
const LOVE_WORD = { hand: '牽你的手', hug: '抱抱你', kiss: '親親你', pat: '摸摸你的頭' };
function newChar(look) { const c = { i: 'g', av: new Avatar(look), x: 0, z: 0, ry: 0, y: null, moving: false, locked: false, path: null, spinT: 0, stuck: 0, tilt: 0, sc: 'out' }; OUT.add(c.av.root); hookEmote(c); return c; }
function hookEmote(c) { const orig = c.av.emote.bind(c.av); c.av.emote = (k, d) => { orig(k, d); if (MP.on && c === me()) MP.net.send({ t: 'emo', k, d }); }; }
// 畫面上所有角色（看得到的）
/* 保險：角色的身體沒載入成功（變成透明人）就自動重新載一次 */
setInterval(() => { for (const c of allChars()) { const a = c.av; if (a && !a.model && a.look && performance.now() - (a._lookAt || 0) > 5000) a.setLook(a.look); } }, 2500);
function allChars() { const a = [...chars]; if (guestChar) a.push(guestChar); for (const p of MP.peers.values()) if (p.role === 'g' && p.c) a.push(p.c); return a; }
// 這支手機在控制的角色
function localChars() { if (!MP.on) return chars; const a = [me()]; if (partnerLocal()) a.push(you()); return a; }
const peerChar = id => { const p = MP.peers.get(id); return p ? (p.role === 'g' ? p.c : chars[p.role]) : null; };
const peerName = id => { const p = MP.peers.get(id); return p ? (p.role === 'g' ? p.name : nameOf(p.role)) : '對方'; };
function charName(c) { if (c === guestChar) return MP.guest?.name || '我'; if (c.i === 'g') { for (const p of MP.peers.values()) if (p.c === c) return p.name; return '朋友'; } return nameOf(c.i); }
// 每一格：每個角色放到他所在的場景，看不到的藏起來；別人的角色平滑移動到收到的位置
function placeRoots(dt) {
  { const m = me(); if (m && !m.remote && !m.ghost && m.sc !== scene) m.sc = scene; } /* 保險：自己的角色一定在你正在看的那個場景，不會變成透明人 */
  for (const c of allChars()) {
    let show = true;
    if (c === chars[0] || c === chars[1]) show = (MP.role !== 'g' && c.i === myIdx()) || !!c.remote;
    if (preview.on) show = visitParam.length ? c === guestChar : c === chars[myIdx()];
    const S = (c.sc || 'out') === 'in' ? IN?.S : OUT;
    if (S && c.av.root.parent !== S) S.add(c.av.root);
    c.av.root.visible = show && (c.sc || 'out') === scene;
    if (c.remote && c.net) {
      const n = c.net, k = Math.min(1, dt * 10);
      if (Math.hypot(n.x - c.x, n.z - c.z) > 6) { c.x = n.x; c.z = n.z; } else { c.x += (n.x - c.x) * k; c.z += (n.z - c.z) * k; }
      let d = n.ry - c.ry; d = Math.atan2(Math.sin(d), Math.cos(d)); c.ry += d * k;
      c.y = n.y; c.moving = !!n.mv; c.tilt = n.tilt || 0; c.sc = n.sc; c.act = n.act;
      if (c.av.pose !== n.pose) c.av.setPose(n.pose);
      c.av.holdHand(n.hand === 'L' ? -1 : n.hand === 'F' ? 1 : 0);
      // 對方在船上：座位直接用我畫面上的船算（不用等網路位置，才不會抖、不會漂在海上）
      if (n.act === 'boat' && W?.boat && (c.sc || 'out') === scene) { const S_ = boatSeat(!MP.driving); c.x = S_.x; c.z = S_.z; c.y = S_.y; c.ry = S_.ry; }
    }
  }
}
// 送出自己的位置；時間跳了（睡覺、看夕陽）也告訴大家
function netTick(dt) {
  if (!MP.on || !MP.net.alive) return;
  const c = me();
  MP.net.pos({ x: +c.x.toFixed(2), z: +c.z.toFixed(2), ry: +c.ry.toFixed(2), y: c.y == null ? null : +c.y.toFixed(2), sc: scene, pose: c.av.pose || 'stand', mv: c.moving ? 1 : 0, act: act?.id || '', hand: MP.lead ? 'L' : MP.led ? 'F' : '', fl: st.flash ? 1 : 0, tilt: +(c.tilt || 0).toFixed(2) });
  if (MP.role === 'g') return;
}
// 存檔有變化的欄位送給另一位島主
function shareSave() {
  if (!MP.on || MP.role === 'g' || !MP.sent) return;
  const keys = {}; let any = false;
  for (const k of SHARED) { const v = JSON.stringify(st[k] ?? null); if (MP.sent[k] !== v) { MP.sent[k] = v; keys[k] = st[k]; any = true; } }
  if (any) MP.net.send({ t: 'save', keys });
}
function snapSent() { MP.sent = {}; for (const k of SHARED) MP.sent[k] = JSON.stringify(st[k] ?? null); MP.sent.love = JSON.stringify(st.love); }
// 這支手機自己的設定（名字、樣子、教學、音樂…）不能被另一半的存檔蓋掉
const MINE = ['freeTip', 'useDay', 'lhDay', 'tentDay', 'notesRead', 'qaSeen', 'miniDay', 'capToast', 'sleptDay', 'sweetDay', 'festSeen', 'myName', 'myLook', 'ctrl', 'tut', 'music', 'track', 'low', 'amb', 'run', 'flash', 'where', 'noteSeen', 'awaySeen', 'surpriseSeen', 'annivSeen', 'pushOn', 'visitDays', 'lastDayHere', 'ui', 'bgMusic', 'qch'];
function applySave(keys, first) {
  const qaBefore = keys.qa || (first && st.qa) ? JSON.parse(JSON.stringify(st.qa || {})) : null;
  for (const [k, v] of Object.entries(keys)) { if (k === 'diary' && !first) continue; if (MINE.includes(k) || k === 'day') continue; if (k === 'qa') { st.qa = { ...(st.qa || {}), ...(v || {}) }; continue; } st[k] = v; }
  if (qaBefore) qaAfterSync(qaBefore, keys.qa || {}, first);
  if (keys.looks) [0, 1].forEach(i => { if (st.looks[i]) chars[i].av.setLook(st.looks[i]); });
  if ('castles' in keys) showCastles();
  if (keys.garden) st.garden.forEach((_, i) => drawPlant(i));
  if (keys.eggs) drawEggs(); if (keys.decor) drawDecor(); if (keys.theme && IN) applyTheme(IN, keys.theme); if ('snowman' in keys) drawSnowman(); if (keys.notes) drawNotes(); if (keys.photos) drawPhotos(); if (keys.tree) drawTree(); if (keys.surprise) setupSurprise(); if (keys.puzzle) drawPuzzle(); updateChips?.();
  snapSent(); if (MP.role !== 'g') try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {}
  updateHud(); if (keys.names && !first && $('#dlg').open && $('#dlg').dataset.net) openNet();
}
function onNet(m) {
  if (m.t === 'welcome') {
    MP.id = m.id; MP.role = m.role; MP.owner = m.owner; MP.awayChecked = false;
    CHAT.old = m.role !== 'g' && !('chat' in m); // 伺服器沒給聊天資料＝還是舊版
    if (m.chat) { CHAT.list = m.chat.list || []; CHAT.read = { 0: 0, 1: 0, ...(m.chat.read || {}) }; setTimeout(() => { chatBadge(); renderChat(); }, 0); }
    if (m.role === 'g') { st = { ...DEF, ...m.save, music: st.music }; [0, 1].forEach(i => { if (st.looks?.[i]) chars[i].av.setLook(st.looks[i]); }); showCastles(); st.garden.forEach((_, i) => drawPlant(i)); snapSent(); updateHud(); }
    else {
      applySave(m.save, true);
      // 這支手機的主人：用自己設定的名字、樣子
      const i = m.role; st.ctrl = i;
      if (st.adopt) { delete st.adopt; if (st.names[i]) st.myName = st.names[i]; if (st.looks[i]) st.myLook = st.looks[i]; } // 重新登入的新手機：沿用原本的自己
      if (st.myName) st.names[i] = st.myName; if (st.myLook) st.looks[i] = st.myLook;
      chars[i].av.setLook(st.looks[i]); if (st.looks[1 - i]) chars[1 - i].av.setLook(st.looks[1 - i]);
      const mc = chars[i], oc = chars[1 - i]; if (!mc.seenMe) { if (oc.remote && (oc.sc || 'out') === scene) { mc.x = oc.x + 0.8; mc.z = oc.z + 0.6; mc.ry = oc.ry; } mc.seenMe = 1; } /* 另一半在線上、又在同一個地方，才把我放到他旁邊；不然位置和場景都不動（以前會把我丟到屋外，在屋裡就變成透明人） */
      save(); updateHud(); refreshPush(); setTimeout(() => { if (!act && !$('#dlg').open) checkAway(); else st.awaySeen = Date.now(); MP.awayChecked = true; }, 1500);
    }
    if (m.role !== 'g' && !m.save.rt) { migrateRT(m.clock?.day || st.day, true); save(); } /* 伺服器上還是舊的天數：換成真實日期 */
    st.tod = realTod(); st.day = realDay();
    for (const p of MP.peers.values()) if (p.c && p.role === 'g') OUT.remove(p.c.av.root);
    MP.peers.clear(); chars.forEach(c => { if (c.remote) c.remote = false; });
    m.peers.forEach(p => addPeer(p, true));
    updateNetChip(); if ($('#dlg').open && $('#dlg').dataset.net) openNet();
    return;
  }
  if (m.t === 'join') { addPeer(m.p); if ($('#dlg').open && $('#dlg').dataset.net) openNet(); toast(`${m.p.role === 'g' ? '🎈 ' + m.p.name : nameOf(m.p.role)} 來到小島了`, 4000, m.p.role === 'g' ? null : () => { const c = chars[m.p.role]; if (c && (c.sc || 'out') === scene) route(me(), c.x + 0.8, c.z + 0.8); else toast(`${nameOf(m.p.role)} 在${(c?.sc || 'out') === 'in' ? '小木屋裡' : '屋外'}`); }); sfx('chime'); return; }
  if (m.t === 'leave') {
    const p = MP.peers.get(m.id); if (!p) return; MP.peers.delete(m.id);
    if (p.role === 'g') { p.c.av.root.parent?.remove(p.c.av.root); toast(`${p.name} 離開小島了`); }
    else { const c = chars[p.role]; c.remote = false; c.net = null; c.locked = false; c.y = null; c.av.setPose('stand'); c.av.holdHand(0); c.sc = scene; c.x = me().x + 1; c.z = me().z + 1; toast(`${nameOf(p.role)} 離線了`); if (MP.led || MP.lead) { MP.led = null; MP.lead = false; } }
    updateNetChip(); if ($('#dlg').open && $('#dlg').dataset.net) openNet(); return;
  }
  if (m.t === 'pos') { const c = peerChar(m.id); if (!c) return; c.net = m; if (!c.seen) { c.seen = 1; c.x = m.x; c.z = m.z; c.ry = m.ry; } return; }
  if (m.t === 'emo') { const c = peerChar(m.id); if (!c) return; c.av.emote(m.k, m.d); if (m.k === 'kiss' || m.k === 'hug') burst('heart', headPos(c, 1.6), 5, 0.3); return; }
  if (m.t === 'fx') { if (m.k === 'fw' && scene === 'out') launchFirework(!!m.a, true); if (m.k === 'sweet' && act?.id === 'bed') sweetNight(false); if (m.k === 'rare' && scene === 'out' && RARE[m.a]) rareStart(RARE[m.a].k, false); return; }
  if (m.t === 'boat') { if (W?.boat && !MP.driving) { MP.boatT = { x: m.x, z: m.z, ry: m.ry }; if (m.home) { W.boat.position.x = m.x; W.boat.position.z = m.z; W.boat.rotation.y = m.ry; MP.boatT = null; } } MP.boatAway = !m.home; return; }
  if (m.t === 'save') { applySave(m.keys); return; }
  if (m.t === 'memo') { st.diary.unshift(m.m); if (st.diary.length > 300) st.diary.length = 300; save(); return; }
  if (m.t === 'clock') return; /* 島上時間＝台灣時間，不用伺服器的時鐘 */
  if (m.t === 'owner') { MP.owner = m.owner; if ($('#dlg').open && $('#dlg').dataset.net) openNet(); return; }
  if (m.t === 'paired') { if (MP.owner) { MP.owner.paired = true; MP.owner.pair = ''; } /* 邀請碼已經用掉了，不能當重新登入碼 */ toast('另一半加入小島了 ❤', 3500); burst('heart', headPos(me(), 1.6), 10); if ($('#dlg').open && $('#dlg').dataset.net) openNet(); return; }
  if (m.t === 'book') { if (MP.owner) MP.owner.book = [m.e, ...(MP.owner.book || [])]; if (MP.role !== 'g') toast(`📝 ${m.e.n}：${m.e.text}`, 4000); return; }
  if (m.t === 'say') { const c = peerChar(m.id) || (m.id === MP.id ? me() : null); if (c) showSay(c, m.text, m.mute ? 'mute' : 'say'); return; }
  if (m.t === 'err') { toast(m.why === 'slow' ? '留言太快了，等一下再寫' : CHAT_WHY[m.why] || '沒有送出'); return; }
  if (m.t === 'love') { onLoveReq(m.from, m.k); return; }
  if (m.t === 'loveok') { onLoveOk(m.from, m.k, m.ok); return; }
  if (m.t === 'nudge') { onNudge(m); return; }
  if (m.t === 'chat') { onChat(m.m); return; }
  if (m.t === 'chatread') { CHAT.read[m.role] = m.ts; renderChat(); return; }
  if (m.t === 'typing') { if (CHAT.open) { const t = $('#ch-typing'); t.hidden = false; clearTimeout(CHAT.typingT); CHAT.typingT = setTimeout(() => { t.hidden = true; }, 3500); } return; }
  if (m.t === 'nudged') { onNudged(m); return; }
  if (m.t === 'pushok') { toast(m.on ? '📳 手機通知開好了！另一半想你時會通知你' : '通知關掉了'); return; }
}
function addPeer(p, quiet) {
  MP.peers.set(p.id, p);
  if (p.role === 'g') { p.c = newChar(p.look || randomLook()); p.c.remote = true; if (p.pos) { p.c.net = p.pos; p.c.x = p.pos.x; p.c.z = p.pos.z; p.c.seen = 1; } }
  else { const c = chars[p.role]; c.remote = true; c.locked = false; c.path = null; if (p.pos) { c.net = p.pos; c.x = p.pos.x; c.z = p.pos.z; c.seen = 1; } else c.seen = 0; }
  updateNetChip();
}
// 頭上冒出的一句話
// 頭上的對話泡泡：同一個人連續講話會往上疊；離太遠縮小變淡；人在畫面外時，泡泡貼在畫面邊緣、箭頭指向他
// kind：'say' 說出來（白）／'w' 悄悄話（粉紅愛心框）／'mute' 朋友看到別人在講悄悄話（……）
const sayStacks = new Map();
function showSay(c, text, kind = 'say') {
  let S = sayStacks.get(c);
  if (!S) { const box = document.createElement('div'); box.className = 'say-stack'; box.innerHTML = '<div class="say-list"></div><i class="say-arrow"></i>'; $('#labels').appendChild(box); S = { c, box, list: box.firstChild }; sayStacks.set(c, S); }
  const e = document.createElement('div'); e.className = 'say-b ' + kind; e.textContent = text; S.list.appendChild(e);
  while (S.list.children.length > 3) S.list.firstChild.remove();
  setTimeout(() => { e.classList.add('out'); setTimeout(() => e.remove(), 400); }, 5200 + Math.min(4000, text.length * 120));
}
function tickSay() {
  for (const [c, S] of sayStacks) {
    if (!S.list.children.length || !c.av.root.visible || c.sc !== scene) { S.box.style.display = 'none'; if (!S.list.children.length && !document.body.contains(c.av.root.parent ? S.box : null)) {} continue; }
    tagPos(c, v3); v3.y += 0.35; const d = cam.position.distanceTo(v3); v3.project(cam);
    let x = (v3.x + 1) / 2 * innerWidth, y = (1 - v3.y) / 2 * innerHeight; const behind = v3.z > 1; if (behind) { x = innerWidth - x; y = innerHeight - 40; }
    const m = 46, off = behind || x < m || x > innerWidth - m || y < 90 || y > innerHeight - 120;
    S.box.style.display = ''; S.box.classList.toggle('edge', off);
    if (off) { const cx = innerWidth / 2, cy = innerHeight / 2, ang = Math.atan2(y - cy, x - cx), hw = Math.min(130, (S.box.offsetWidth || 120) / 2 + 10); x = Math.min(innerWidth - hw, Math.max(hw, x)); y = Math.min(innerHeight - 160, Math.max(130, y)); /* 用泡泡自己的寬度決定離邊緣多遠，不會被擠成直排 */ S.box.style.setProperty('--ang', ang + 'rad'); S.box.dataset.who = nameOf(c.i); }
    const k = off ? 0.85 : d < 14 ? 1 : d < 24 ? 0.85 : 0.72; S.box.style.left = x + 'px'; S.box.style.top = y + 'px'; S.box.style.setProperty('--k', k); S.box.style.opacity = off ? 0.95 : d < 24 ? 1 : 0.75;
  }
}
// 情侶互動（連線）：問對方 → 對方答應才開始
let loveAsk = null, approach = null;
/* 連線時的親親、抱抱、摸頭、牽手：不用問對方，直接走過去做；對方的角色會自然回應 */
const LOVE_PTS = { hug: 2, kiss: 3, pat: 2 };
/* 兩個人站多近：[面對面的距離, 往旁邊錯開多少]。頭很大，太近會疊在一起；抱抱時稍微錯開，頭才會靠在對方肩膀旁邊 */
const LOVE_GAP = { hug: [0.6, 0.24], kiss: [0.88, 0], pat: [0.8, 0] };
function loveSpot(c, k) { const yw = scene === 'in' ? view.inYaw : view.yaw, [g, o] = LOVE_GAP[k] || [0.8, 0], sx = Math.cos(yw), sz = -Math.sin(yw); let tx = c.x + sx * g - sz * o, tz = c.z + sz * g + sx * o; if (!canStand(tx, tz)) { tx = c.x - sx * g + sz * o; tz = c.z - sz * g - sx * o; } return [tx, tz]; }
function requestLove(k) {
  const q = you(), pid = [...MP.peers.values()].find(p => p.role === 1 - MP.role)?.id; if (!pid) return;
  if (k === 'hand') {
    if (MP.lead || MP.led) { MP.net.send({ t: 'love', to: pid, k: 'unhand' }); MP.lead = false; MP.led = null; toast('放開手了'); return; }
    if ((q.sc || 'out') !== scene || Math.hypot(q.x - me().x, q.z - me().z) > 8) return toast(`走到 ${nameOf(q.i)} 身邊再牽手吧`);
    MP.net.send({ t: 'love', to: pid, k }); MP.lead = true; toast(`牽起 ${nameOf(q.i)} 的手 🤝`); addLove(2, null, 'hand'); burst('heart', midPos(1.3), 3); return;
  }
  if ((q.sc || 'out') !== scene) return toast(`${nameOf(q.i)} 在${(q.sc || 'out') === 'in' ? '小木屋裡' : '屋外'}，先去找他吧`);
  const d = Math.hypot(q.x - me().x, q.z - me().z);
  if (act) { if (d > 2.2) endAct(); else return loveNow(k, pid); } /* 坐在一起時就地做；離得遠就先站起來走過去 */
  if (d > 14) return toast(`${nameOf(q.i)} 離得有點遠，走近一點吧`);
  approach = { c: q, k, t: 0, mine: pid, max: d / 3 + 1.5 }; me().path = null;
}
/* 到對方身邊了：做動作，同時告訴對方 */
function loveNow(k, pid) {
  const p = me(), q = you(); if (!p.locked) p.ry = Math.atan2(q.x - p.x, q.z - p.z);
  MP.net.send({ t: 'love', to: pid, k });
  if (k === 'hug') { p.av.emote('hug', 2.4); setTimeout(() => burst('heart', midPos(1.3), 7, 0.4), 300); }
  if (k === 'kiss') { p.av.emote('kiss', 1.8); setTimeout(() => burst('heart', midPos(1.55), 10, 0.4), 500); }
  if (k === 'pat') { p.av.emote('pat', 1.8); setTimeout(() => burst('heart', headPos(q, 1.8), 4, 0.3), 400); }
  sfx('pop'); addLove(LOVE_PTS[k] || 1, null, k);
}
function onLoveReq(from, k) {
  const c = peerChar(from); if (!c) return;
  if (k === 'unhand') { MP.lead = false; MP.led = null; toast(`${peerName(from)} 放開手了`); return; }
  if (k === 'hand') {
    if (act && !act.free) { MP.net.send({ t: 'loveok', to: from, k, ok: 0 }); return; } /* 正在釣魚、做飯：不會被拉走 */
    if (act) endAct(); MP.led = c; toast(`${peerName(from)} 牽起你的手 🤝（推搖桿就會放開）`); burst('heart', headPos(me(), 1.4), 3); return;
  }
  if (!LOVE_PTS[k]) return;
  /* 對方走過來抱你、親你、摸你的頭：轉向他、自然回應（不跳視窗、不打斷你正在做的事） */
  const p = me(); if (!p.locked) { p.path = null; p.ry = Math.atan2(c.x - p.x, c.z - p.z); }
  if (k === 'hug') { p.av.emote('hug', 2.4); toast(`${peerName(from)} 抱住了你 🤗`, 2200); }
  if (k === 'kiss') { setTimeout(() => p.av.emote('shy', 1.8), 450); toast(`${peerName(from)} 親了你一下 😘`, 2200); }
  if (k === 'pat') { setTimeout(() => p.av.emote('shy', 1.6), 300); toast(`${peerName(from)} 摸摸你的頭`, 2200); }
  setTimeout(() => burst('heart', headPos(p, 1.6), k === 'kiss' ? 8 : 5, 0.35), 400); sfx('pop');
}
function onLoveOk(from, k, ok) { if (k === 'hand' && !ok) { MP.lead = false; toast(`${peerName(from)} 正在忙，等一下再牽`); } }
// 這支手機的角色被牽著走、或走過去讓對方抱
function netMove(dt, hasInput) {
  const p = me();
  if (approach) {
    const c = approach.c; let [tx, tz] = loveSpot(c, approach.k);
    approach.t += dt; const d = Math.hypot(tx - p.x, tz - p.z);
    if (hasInput && approach.t > 0.4) { approach = null; return false; } /* 自己推搖桿就取消 */
    if (d < 0.14 || approach.t > (approach.max || 2)) { if (d >= 0.14 && d < 1.2) { p.x = tx; p.z = tz; } const k = approach.k, pid = approach.mine; approach = null; p.moving = false; if (d < 1.2) loveNow(k, pid); }
    else stepChar(p, tx - p.x, tz - p.z, dt, 3.2);
    return true;
  }
  if (MP.led) {
    if (hasInput) { const pid = [...MP.peers.values()].find(x => x.role === 1 - MP.role)?.id; MP.net.send({ t: 'love', to: pid, k: 'unhand' }); MP.led = null; toast('放開手了'); return false; }
    const c = MP.led, rx = -Math.cos(c.ry), rz = Math.sin(c.ry), tx = c.x + rx * 0.62, tz = c.z + rz * 0.62, d = Math.hypot(tx - p.x, tz - p.z);
    if (d > 4 || c.sc !== scene) { p.x = tx; p.z = tz; }
    if (d > 0.06) stepChar(p, tx - p.x, tz - p.z, dt, Math.max(2.6, d * 6)); else { let dd = c.ry - p.ry; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); p.ry += dd * Math.min(1, dt * 10); }
    p.moving = c.moving || d > 0.12; p.av.holdHand(1);
    return true;
  }
  if (MP.lead) p.av.holdHand(-1);
  return false;
}
function updateNetChip() {
  const el = $('#btn-net'); if (!el) return;
  if (!MP.on) { el.innerHTML = icon('users'); el.classList.remove('on'); return; }
  const n = MP.peers.size + 1; el.innerHTML = `${icon('users')}<b class="n">${n}</b>`; el.classList.add('on');
  const g = MP.role === 'g';
  $('#btn-swap').hidden = true;
  if (g) $('#hud-names').textContent = `拜訪 ${nameOf(0)} ♥ ${nameOf(1)} 的小島`;
}
function connectNet(a) {
  MP.on = true; MP.net = new Net({ message: onNet, status: (ok, was, code, reason) => {
    updateNetChip();
    if (!ok && (code === 4001 || code === 4003 || code === 4004 || code === 4005)) {
      toast(reason || '連線中斷了', 5000);
      if (code === 4004 && MP.role !== 'g') { saveAuth(null); }
      if (MP.role === 'g') setTimeout(() => location.replace(location.pathname), 2500);
      else leaveNet();
    } else if (!ok && was) toast('連線中斷，重新連線中…');
  } });
  MP.net.connect(a); updateNetChip();
}
function leaveNet() {
  MP.net?.close(); MP.on = false; MP.role = null; MP.id = null; MP.led = null; MP.lead = false;
  for (const p of MP.peers.values()) if (p.role === 'g') p.c.av.root.parent?.remove(p.c.av.root);
  MP.peers.clear(); chars.forEach(c => { c.remote = false; c.net = null; c.sc = scene; }); updateNetChip(); updateHud();
}
// 連線面板
async function openNet() {
  sfx('click'); const avail = await serverAvailable();
  let html = '';
  if (!avail) html = `<p>這個網址是<b>單機版</b>。連線版要用部署在 Cloudflare 的網址開啟（設定方法在 nest/worker/README.md）。</p><p class="muted">單機版的存檔不會不見；到了連線版網址再按「建立我們的小島」就能把存檔帶過去（同一支手機、同一個瀏覽器）。</p>`;
  else if (!MP.on) html = `<p>把你們的小島放到網路上，兩個人用自己的手機一起玩，也可以邀請朋友來玩。</p>
    <div class="opts"><button type="button" id="net-create">🏝️ 建立我們的小島<small>用這支手機目前的存檔；會拿到「情侶碼」給另一半</small></button>
    <button type="button" id="net-pair">💌 我有情侶碼<small>加入另一半建立的小島（這支手機的存檔會換成那座島的）</small></button></div>`;
  else if (MP.role === 'g') html = `<p>你在 <b>${esc(nameOf(0))} ♥ ${esc(nameOf(1))}</b> 的小島作客。</p>${peopleHtml()}
    <label class="anniv"><span>說一句話（大家都看得到）</span><input id="net-say" maxlength="40" placeholder="例如：這裡好漂亮！"></label><button type="button" class="ghost" id="net-say-go">送出</button>
    <label class="anniv"><span>在留言簿寫一句話給島主</span><input id="net-book" maxlength="40" placeholder="例如：謝謝招待～"></label><button type="button" class="ghost" id="net-book-go">留言</button>
    <button type="button" class="ghost" id="net-leave">離開小島</button>`;
  else {
    const o = MP.owner || {}, link = `${location.origin}${location.pathname}?visit=${savedAuthNow().island}.${o.guest || ''}`;
    html = `${peopleHtml(true)}
      ${o.paired ? (o.pair ? `<div class="memo"><span class="ic">📱</span><b>重新登入碼：<span style="font-size:var(--fs-xl);letter-spacing:.15em">${esc(o.pair)}</span></b><small>給 ${esc(partnerName())} 換手機、或從主畫面的小島進不來時用（7 天內有效，用過就失效；原本的名字、造型、回憶都在）</small></div><button type="button" class="primary" id="net-invite">💌 傳給 ${esc(partnerName())}</button>` : `<button type="button" class="ghost" id="net-newpair">📱 讓 ${esc(partnerName())} 在新手機重新登入</button>`) : `<div class="memo"><span class="ic">💌</span><b>情侶碼：<span style="font-size:var(--fs-xl);letter-spacing:.15em">${esc(o.pair || '（已過期）')}</span></b><small>給另一半在自己手機的「🌐 → 我有情侶碼」輸入（7 天內有效）</small></div><button type="button" class="primary" id="net-invite">💌 傳給另一半</button><button type="button" class="ghost" id="net-newpair">重新產生情侶碼</button>`}
      <div class="memo"><span class="ic">🎈</span><b>訪客連結</b><small style="word-break:break-all">${esc(link)}</small></div>
      <div class="row"><button type="button" class="ghost" id="net-share">分享給朋友</button><button type="button" class="ghost" id="net-newguest">重設連結</button></div>
      <div class="toggle-row"><span>${o.locked ? '🔒' : '🚪'} 朋友可以來玩<br><small class="muted">${o.locked ? '目前：鎖住了，朋友點連結也進不來' : '目前：開放中，有訪客連結的朋友都能進來'}</small></span><button type="button" id="net-lock" aria-pressed="${!o.locked}" aria-label="朋友可以來玩">${o.locked ? '關' : '開'}</button></div>
      <div class="toggle-row"><span>📳 手機通知<br><small class="muted">另一半想你、留便利貼時，手機會跳出通知${isIOS && !standalone() ? '（iPhone 要先加到主畫面）' : ''}</small></span><button type="button" id="net-push" aria-pressed="${!!st.pushOn}" aria-label="手機通知">${st.pushOn ? '開' : '關'}</button></div>
      <b>📝 訪客留言簿</b>${(o.book || []).length ? o.book.slice(0, 20).map(e => `<div class="memo"><span class="ic">📝</span><b>${esc(e.text)}</b><small>${esc(e.n)}</small></div>`).join('') : '<p class="muted">還沒有人留言。</p>'}
      <label class="anniv"><span>說一句話（大家都看得到）</span><input id="net-say" maxlength="40"></label><button type="button" class="ghost" id="net-say-go">送出</button>
      <button type="button" class="ghost" id="net-logout">這支手機改回單機版</button>`;
  }
  openDlg('🌐 連線', html); $('#dlg').dataset.net = '1'; $('#dlg').addEventListener('close', () => { delete $('#dlg').dataset.net; }, { once: true });
  const on = (id, fn) => { const e = $('#' + id); if (e) e.onclick = fn; };
  on('net-create', async () => {
    try { const r = await createIsland(st, st.ctrl); saveAuth({ island: r.island, key: r.key, role: r.role }); MP.role = r.role; toast('小島建立好了！把情侶碼給另一半'); connectNet({ island: r.island, key: r.key }); setTimeout(openNet, 1200); }
    catch (e) { toast(e.message); }
  });
  on('net-pair', () => {
    openDlg('💌 輸入情侶碼', `<label class="anniv"><span>情侶碼（6 碼）</span><input id="pair-in" maxlength="8" autocomplete="off" style="text-transform:uppercase;letter-spacing:.15em"></label><button type="button" class="primary" id="pair-go">加入小島</button>`);
    $('#pair-go').onclick = async () => { try { await joinByCode($('#pair-in').value); $('#dlg').close(); } catch (e) { toast(e.message); } };
  });
  on('net-newpair', () => MP.net.send({ t: 'newpair' }));
  on('net-invite', async () => {
    const code = MP.owner?.pair; if (!code) return toast('情侶碼過期了，先按「重新產生情侶碼」');
    const link = `${location.origin}${location.pathname}?pair=${code}`, text = MP.owner?.paired ? `📱 回到我們的小島：點這個連結就能在這支手機登入（登入碼 ${code}）` : `💌 ${nameOf(myIdx())} 邀請你一起住在「我們的小島」！點連結、填名字就能加入（情侶碼 ${code}）`;
    try { if (navigator.share) await navigator.share({ title: '我們的小島', text, url: link }); else { await navigator.clipboard.writeText(text + '\n' + link); toast('邀請連結已複製，貼給另一半吧'); } } catch (e) {}
  });
  on('net-newguest', () => { if (confirm('重設之後，舊的訪客連結就不能用了。確定嗎？')) MP.net.send({ t: 'newguest' }); });
  on('net-push', () => setPush(!st.pushOn));
  on('net-lock', () => { const lock = !MP.owner?.locked; MP.net.send({ t: 'lock', on: lock }); toast(lock ? '🔒 小島鎖起來了，朋友暫時進不來' : '🚪 小島打開了，朋友可以來玩'); });
  on('net-share', async () => { const o = MP.owner || {}, link = `${location.origin}${location.pathname}?visit=${savedAuthNow().island}.${o.guest}`; const text = `來 ${nameOf(0)} ♥ ${nameOf(1)} 的小島玩吧！`; try { if (navigator.share) await navigator.share({ title: '我們的小島', text, url: link }); else { await navigator.clipboard.writeText(link); toast('連結已複製'); } } catch (e) {} });
  on('net-logout', () => { if (!confirm('這支手機會離開連線、改回單機版（之後可以用情侶碼再加入）。確定嗎？')) return; saveAuth(null); leaveNet(); $('#dlg').close(); });
  on('net-leave', () => { MP.net.close(); location.replace(location.pathname); });
  on('net-say-go', () => { const r = checkChat($('#net-say').value); if (!r.ok) return toast(CHAT_WHY[r.why]); MP.net.send({ t: 'say', text: r.text }); $('#net-say').value = ''; $('#dlg').close(); });
  on('net-book-go', () => { const r = checkChat($('#net-book').value); if (!r.ok) return toast(CHAT_WHY[r.why]); MP.net.send({ t: 'book', text: r.text }); $('#net-book').value = ''; toast('留言送出了 📝'); });
  document.querySelectorAll('[data-kick]').forEach(b => b.onclick = () => { if (confirm('請這位朋友先離開嗎？')) MP.net.send({ t: 'kick', id: b.dataset.kick }); });
}
const savedAuthNow = () => { try { return JSON.parse(localStorage.getItem('nest.net') || '{}'); } catch (e) { return {}; } };
function peopleHtml(owner) {
  const rows = [`<li>${MP.role === 'g' ? '🎈 ' + esc(MP.guest?.name || '我') : esc(nameOf(MP.role))}（我）</li>`];
  for (const [id, p] of MP.peers) rows.push(`<li>${p.role === 'g' ? '🎈 ' + esc(p.name) : '💗 ' + esc(nameOf(p.role)) + '（島主）'}${owner && p.role === 'g' ? ` <button type="button" class="ghost" data-kick="${id}" style="padding:2px 8px;font-size:var(--fs-xs)">請離開</button>` : ''}</li>`);
  return `<b>在島上的人（${MP.peers.size + 1}）</b><ul style="margin:0;padding-left:1.2em;display:grid;gap:4px">${rows.join('')}</ul>`;
}

// ---------- 天氣、環境音 ----------
let WX = null, wNow = null, ambT = 0;
function tickWeather(dt, k) {
  if (!WX) return;
  wNow = weatherAt(st.day, st.tod);
  if (festToday()?.fx === 'snow') wNow = { ...wNow, kind: 'snow', icon: '❄️', name: '下雪' }; /* 平安夜、聖誕節、冬至：下雪 */
  WX.update(dt, wNow, me().av.root.position, k.night, scene === 'out', scene === 'out' ? W : null);
  if (IN) IN.winMat.color.lerp(new THREE.Color('#8a96a2'), WX.st.rain * 0.5);
  // 下雨：在屋外走動的人自己撐傘
  const raining = WX.st.rain > 0.5 && scene === 'out';
  for (const c of allChars()) {
    const want = raining && !c.locked && !(c === me() ? act : c.act) && (c.av.pose || 'stand') === 'stand' && (c.sc || 'out') === 'out';
    const has = !!c.av.item?.userData?.umbrella;
    if (want && !has && !c.av.item) { c.av.setItem(umbrellaItem(c === me() ? '#ff8fab' : '#8ec8f0')); c.av.holdUmbrella(true); }
    else if (!want && has) { c.av.setItem(null); c.av.holdUmbrella(false); }
  }
  if (raining && me().moving) { umbT += dt; if (umbT > 8) { umbT = -1e9; quest('umbrella'); } }
  // 屋內木地板腳步：走一步響一聲（跑步比較快）
  { const c = me(); if (scene === 'in' && c.moving && !c.locked) { stepT -= dt; if (stepT <= 0) { stepT = st.run ? 0.3 : 0.44; sfx('wood'); } } else stepT = 0.15; }
  // 環境音：每 0.25 秒依位置、時間、天氣調整
  ambT += dt; if (ambT < 0.25) return; ambT = 0;
  const p = me(), out = scene === 'out', night = k.night, day = 1 - night;
  const sr = shoreR(p.x, p.z) - 4.6, r = Math.hypot(p.x, p.z), shore = clamp(1 - (sr - r) / 22, 0, 1);
  const fire = out ? clamp(1 - Math.hypot(p.x - SPOTS.campfire.x, p.z - SPOTS.campfire.z) / 13, 0, 1) : 0;
  const hill = clamp(1 - Math.hypot(p.x - HILL.x, p.z - HILL.z) / 14, 0, 1), rain = WX.st.rain, snow = WX.st.snow;
  const q = out ? 1 : 0.18;
  Amb.set({
    waves: (0.25 + 0.75 * shore) * q, campfire: fire * (0.5 + night * 0.5), wind: (0.2 + hill * 0.6 + rain * 0.25 + snow * 0.3) * q,
    seagulls: day * shore * (1 - rain) * 0.9 * q, birds: day * (1 - shore) * (1 - rain * 0.8) * (wNow?.season.k === 'winter' ? 0.3 : 1) * q,
    crickets: night * (1 - rain) * (wNow?.season.k === 'winter' ? 0.2 : 1) * (out ? 1 : 0.25), frog: night * (wNow?.season.k === 'summer' ? 0.8 : 0.35) * (1 - shore * 0.5) * q,
    'light-rain': rain * (out ? 1 : 0.12), 'rain-on-umbrella': rain * (out && p.av.item?.userData?.umbrella ? 1 : 0),
    'rain-on-window': out ? 0 : rain, // 在屋裡：雨打在窗戶上
    'walk-on-leaves': out && p.moving && !p.locked ? (st.run ? 1 : 0.65) : 0, // 屋內改成木地板一步一步的聲音
    chickens: out ? clamp(1 - Math.hypot(p.x - SPOTS.coop.x, p.z - SPOTS.coop.z) / 12, 0, 1) * day * (1 - rain * 0.7) : 0,
    'rowing-boat': act?.id === 'boat' ? 1 : 0,
    'wind-chimes': out ? clamp(1 - Math.hypot(p.x - SPOTS.door.x, p.z - SPOTS.door.z) / 10, 0, 1) * (0.6 + rain * 0.2 + snow * 0.2) : 0.15,
  });
}
let umbT = 0, stepT = 0;

// ---------- 小島幣、每日任務、收藏獎勵 ----------
function addCoins(n, why) { if (MP.role === 'g' || !n) return; if (n > 0) flyTo('🪙', '#coin-chip', Math.ceil(n / 8) + 2); if (n > 0 && surpriseNow().k === 'golden') n *= 2; /* 金色時光：下午拿到的小島幣加倍 */ if (n > 0) sfx('coin'); st.coins = (st.coins || 0) + n; save(); updateChips(); if (why) toast(`${why}　+${n} 🪙`); }
function questsToday() {
  if (MP.role === 'g') return [];
  if (!st.quests || st.quests.day !== st.day) {
    const season = seasonOf(st.day).k, rainy = [7, 10, 13, 16, 19].some(h => weatherAt(st.day, h).kind === 'rain'); /* 撐傘任務：當天有下雨才會出現 */
    const pool = QUESTS.filter(q => (!q[3] || q[3] === season) && (q[0] !== 'umbrella' || rainy));
    let s = st.day * 9301 + 49297; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    const picked = []; while (picked.length < 3) { const q = pool[Math.floor(rnd() * pool.length)]; if (!picked.includes(q)) picked.push(q); }
    st.quests = { day: st.day, list: picked.map(q => ({ k: q[0], n: 0 })), bonus: false };
  }
  return st.quests.list;
}
function quest(k, n = 1) {
  const list = questsToday(); const q = list.find(x => x.k === k); if (!q) return;
  const def = QUESTS.find(x => x[0] === k); if (q.n >= def[2]) return;
  q.n = Math.min(def[2], q.n + n);
  if (q.n >= def[2]) { addCoins(QUEST_COIN); toast(`📋 任務完成：${def[1]}　+${QUEST_COIN} 🪙`, 3200, () => openQuests()); sfx('chime'); }
  if (!st.quests.bonus && list.every(x => x.n >= QUESTS.find(y => y[0] === x.k)[2])) {
    st.quests.bonus = true; st.questDays = (st.questDays || 0) + 1; addCoins(QUEST_BONUS);
    setTimeout(() => { toast(`🎉 今天的任務全部完成！+${QUEST_BONUS} 🪙`, 3500); burst('star', headPos(me(), 1.6), 10); }, 1500);
    addLove(5, null, 'quest'); addMemo('📋', `完成了第 ${st.questDays} 天的每日任務`);
  }
  save(); updateChips(); checkMilestones();
}
function checkMilestones() {
  if (MP.role === 'g') return; st.rewards = st.rewards || {};
  for (const [k, text, ok, coins, item] of MILESTONES) {
    if (st.rewards[k] || !ok(st)) continue;
    st.rewards[k] = true; st.inv = st.inv || {}; st.inv[item] = (st.inv[item] || 0) + 1; st.coins = (st.coins || 0) + coins;
    const name = DECOR.find(d => d[0] === item)?.[1] || '擺設';
    setTimeout(() => { toast(`🏆 收藏獎勵：${text}！送你「${name}」和 ${coins} 🪙`, 4500); sfx('chime'); }, 2200);
    addMemo('🏆', `收藏獎勵：${text}`); save(); updateChips();
  }
}
function updateChips() {
  const g = MP.role === 'g'; $('.chips').hidden = g || !started(); if (g) return;
  const list = questsToday(), done = list.filter(q => q.n >= QUESTS.find(x => x[0] === q.k)[2]).length;
  const qc = $('#quest-chip'); qc.innerHTML = `${icon('quest')}今日任務 <b class="n">${done}/3</b>`; qc.classList.toggle('done', done === 3); qaBadge();
  const cc = $('#coin-chip'); if (!cc.querySelector('.n')) cc.innerHTML = `${icon('coin')}<b class="n"></b>`; rollNum(cc.querySelector('.n'), st.coins || 0);
}
$('#quest-chip').onclick = () => openQuests();
$('#coin-chip').onclick = () => openShop();
function openQuests() {
  sfx('click'); const list = questsToday(), s = seasonOf(st.day), w = weatherAt(st.day, st.tod);
  const rows = list.map(q => { const d = QUESTS.find(x => x[0] === q.k), ok = q.n >= d[2]; return `<div class="quest ${ok ? 'ok' : ''}"><span class="q-e">${ok ? '✅' : '⬜'}</span><b>${esc(d[1])}</b><span class="q-r">+${QUEST_COIN} 🪙</span><small>${q.n}/${d[2]}</small><div class="bar"><i style="width:${q.n / d[2] * 100}%"></i></div></div>`; }).join('');
  const ms = MILESTONES.map(([k, text, ok, coins, item]) => `<div class="quest ${st.rewards?.[k] ? 'ok' : ''}"><span class="q-e">${st.rewards?.[k] ? '🏆' : '🔒'}</span><b>${esc(text)}</b><span class="q-r">+${coins} 🪙</span><small>送「${esc(DECOR.find(d => d[0] === item)?.[1] || '')}」</small></div>`).join('');
  openDlg('📋 今日任務', `${MP.role === 'g' ? '' : `<button type="button" class="memo qa-entry${qaTodo() || qaUnseen() ? ' todo' : ''}" id="q-qa"><span class="ic">💞</span><b>今日問答${qaTodo() ? '' : qaUnseen() ? '・答案揭曉了！' : qaBoth(st.qa?.[twDate()]) ? ' ✓' : `・等 ${esc(partnerName())} 回答`}</b><small>${esc(qaQ(twDate())[1])}</small></button>`}<b class="sur-h">今天的驚喜</b>${surpriseListHtml()}<p class="muted"><span class="nw">${dateOfDay(st.day).getUTCMonth() + 1} 月 ${dateOfDay(st.day).getUTCDate()} 日 週${WEEK[dateOfDay(st.day).getUTCDay()]}</span>・<span class="nw">小島第 ${islandDays()} 天</span>・${festToday() ? `<span class="nw">${festToday().icon} ${festToday().name}</span>・` : ''}<span class="nw">${s.icon} ${s.name}</span>・<span class="nw">${w.icon || '☀️'} ${w.name}</span></p>${rows}<p class="muted">三個都完成再加 ${QUEST_BONUS} 🪙 和甜蜜值，明天會換新的任務。</p><b>🏆 收藏獎勵</b>${ms}<button type="button" class="primary" id="q-shop">🪙 ${st.coins || 0} → 去買擺設</button>`);
  $('#q-shop').onclick = openShop; $('#q-qa')?.addEventListener('click', () => openQA());
}

// ---------- 裝潢：買擺設、擺在屋外或小木屋裡 ----------
const decorObjs = []; const DCIRC = { out: [], in: [] };
async function drawDecor() {
  decorObjs.forEach(o => o.parent?.remove(o)); decorObjs.length = 0; DCIRC.out = []; DCIRC.in = [];
  for (const d of st.decor || []) {
    const def = DECOR.find(x => x[0] === d.id); if (!def) continue;
    const S = d.sc === 'in' ? IN?.S : OUT; if (!S) continue;
    const g = await load(def[0]); if (!g) continue;
    const o = cloneModel(g); o.scale.setScalar(def[4]); o.position.set(d.x, d.y ?? (d.sc === 'in' ? 0 : standH(d.x, d.z)), d.z); o.rotation.y = d.ry || 0; o.userData.di = (st.decor || []).indexOf(d); S.add(o); decorObjs.push(o);
    if (def[5] && d.y == null) DCIRC[d.sc].push([d.x, d.z, def[5]]); // 放在家具上的不擋路
  }
  delete grids.out; delete grids.in;
  rebuildDecorSpots(); decorLights();
}
function openShop() {
  if (MP.role === 'g') return; sfx('click'); st.inv = st.inv || {}; st.decor = st.decor || [];
  const here = scene, can = d => d[3] === 'any' || d[3] === here;
  const thumb = k => `<img class="th" src="models/thumbs/${k}.webp" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`;
  const shopRow = d => `<button type="button" class="item" data-buy="${d[0]}" ${(st.coins || 0) < d[2] ? 'disabled' : ''}>${thumb(d[0])}${d[6] === 's' ? '<i class="tag">可放桌上</i>' : ''}<b>${esc(d[1])}</b><small>🪙 ${d[2]}${st.inv[d[0]] ? ` · 有 ${st.inv[d[0]]}` : ''}</small></button>`;
  const items = DECOR.filter(can).filter(d => !XMAS_DECOR.includes(d[0])).map(shopRow).join(''), xItems = xmasSeason() ? DECOR.filter(can).filter(d => XMAS_DECOR.includes(d[0])).map(shopRow).join('') : '';
  const inv = Object.entries(st.inv).filter(([k, n]) => n > 0 && can(DECOR.find(d => d[0] === k) || [0, 0, 0, 'none'])).map(([k, n]) => `<button type="button" class="item" data-place="${k}">${thumb(k)}<b>${esc(DECOR.find(d => d[0] === k)[1])}</b><small>×${n}・點一下擺放</small></button>`).join('');
  const placed = (st.decor || []).map((d, i) => d.sc === here ? `<button type="button" data-take="${i}">${esc(DECOR.find(x => x[0] === d.id)?.[1] || '')}<small>收起來（放回包包）</small></button>` : '').join('');
  openDlg(`🛠️ 裝潢${here === 'in' ? '小木屋' : '小島'}`, `<p class="muted">🪙 ${st.coins || 0} 小島幣（做每日任務、釣魚、撿貝殼、堆沙堡可以賺）${here === 'in' ? '' : '　想裝潢小木屋就進屋再打開'}</p>
    ${here === 'in' ? `<b>🏠 屋內風格</b><div class="shop">${Object.entries(THEMES).map(([k, t]) => `<button type="button" data-theme="${k}" aria-pressed="${(st.theme || 'muji') === k}">${k === 'muji' ? '🤍' : '🪵'} ${esc(t.name)}<small>${k === 'muji' ? '淺色原木、米白、亞麻灰' : '原木牆、深木地板、暖黃光'}</small></button>`).join('')}</div>` : ''}
    ${inv ? `<b>🎒 包包裡</b><div class="shop items">${inv}</div>` : ''}${xItems ? `<b>🎄 聖誕限定・1/6 下架</b><div class="shop items xmas">${xItems}</div>` : ''}<b>🛒 商店</b><div class="shop items">${items}</div>${placed ? `<b>📍 已經擺好的</b><button type="button" class="ghost" id="arrange-go">移動、轉向或收起已經擺好的擺設</button><div class="shop">${placed}</div>` : ''}`);
  $('#arrange-go')?.addEventListener('click', startArrange);
  $('#dlg-body').querySelectorAll('[data-buy]').forEach(b => b.onclick = () => { const d = DECOR.find(x => x[0] === b.dataset.buy); if ((st.coins || 0) < d[2]) return; st.coins -= d[2]; st.inv[d[0]] = (st.inv[d[0]] || 0) + 1; save(); updateChips(); sfx('chime'); toast(`買了「${d[1]}」`); startPlace(d[0]); });
  $('#dlg-body').querySelectorAll('[data-place]').forEach(b => b.onclick = () => startPlace(b.dataset.place));
  $('#dlg-body').querySelectorAll('[data-theme]').forEach(b => b.onclick = () => { st.theme = b.dataset.theme; save(); if (IN) applyTheme(IN, st.theme); sfx('chime'); toast(`屋內換成「${THEMES[st.theme].name}」風格`); openShop(); });
  $('#dlg-body').querySelectorAll('[data-take]').forEach(b => b.onclick = () => { const d = st.decor.splice(+b.dataset.take, 1)[0]; st.inv[d.id] = (st.inv[d.id] || 0) + 1; save(); drawDecor(); openShop(); });
}
// ---------- 裝潢模式：拖曳家具、對齊格線、旋轉、放下；也可以調整已經擺好的 ----------
let build = null; // { def, ghost, x, z, ry, ok, edit, mode: 'place' | 'pick', fp, grid }
const SNAP = 0.25, ROT = Math.PI / 4;
const gsnap = v => Math.round(v / SNAP) * SNAP;
function groundAt(cx, cy, y = null) {
  ndc.set(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1); ray.setFromCamera(ndc, cam);
  const h = y ?? (scene === 'in' ? 0 : LAND_Y), t = (h - ray.ray.origin.y) / ray.ray.direction.y; return t > 0 ? ray.ray.at(t, new THREE.Vector3()) : null;
}
function buildUI(on) {
  $('#build-ui').hidden = !on; $('#hud').hidden = on; if (on) toggleLoveMenu(false);
}
function buildGround(x, z) { return scene === 'in' ? 0 : standH(x, z); }
// 小東西：找正下方最上面的平面（桌面、沙發坐墊、床、櫃子），1.35 公尺以內
const sceneOf = o => { while (o.parent) o = o.parent; return o; };
const _down = new THREE.Raycaster(), _nrm = new THREE.Vector3();
function surfaceAt(x, z) {
  const base = buildGround(x, z), S = curS(), list = (build.surf ||= [...props, ...decorObjs].filter(o => sceneOf(o) === S));
  _down.set(new THREE.Vector3(x, base + 2, z), new THREE.Vector3(0, -1, 0)); _down.far = 2;
  for (const h of _down.intersectObjects(list, true)) {
    if (!h.face || h.point.y < base + 0.12 || h.point.y > base + 1.35) continue;
    _nrm.copy(h.face.normal).transformDirection(h.object.matrixWorld); if (_nrm.y > 0.6) return h.point.y;
  }
  return null;
}
function buildCheck() {
  const B = build, small = B.def[6] === 's', step = small ? 0.05 : SNAP, x = Math.round(B.x / step) * step, z = Math.round(B.z / step) * step, r = Math.max(small ? 0.14 : 0.3, B.def[5] || 0.3);
  const top = small ? surfaceAt(x, z) : null; B.top = top; // 小東西會放在家具上面，位置也可以更細（5 公分）
  B.ok = top != null || (B.def[5] === 0 ? (scene === 'in' ? Math.abs(x) < ROOM.w / 2 - 0.3 && Math.abs(z) < ROOM.d / 2 - 0.3 : walkable(x, z)) : canStand(x, z));
  B.sx = x; B.sz = z;
  const y = top ?? buildGround(x, z);
  B.ghost.position.set(x, y, z); B.ghost.rotation.y = B.ry;
  B.fp.position.set(x, y + 0.02, z); B.fp.scale.setScalar(r + 0.12); B.fp.material.color.set(B.ok ? '#5fd38d' : '#ff6a6a');
  B.grid.position.set(x, y + 0.015, z); B.grid.visible = top == null;
  B.ghost.traverse(o => { if (o.isMesh) { o.material.color?.copy(o.userData.c0 || o.material.color); if (!B.ok) o.material.color?.lerp(new THREE.Color('#ff6a6a'), 0.55); } });
  $('#bu-ok').disabled = !B.ok; $('#bu-tip').textContent = !B.ok ? '這裡放不下，換個地方' : top != null ? '放在家具上面' : small ? '小東西可以拖到桌子、沙發、床上' : '拖曳移動・點地板直接放過去';
}
async function startPlace(id, edit = null) {
  $('#dlg').close(); if (act) endAct(); const def = DECOR.find(x => x[0] === id); const g = await load(def[0]); if (!g) return;
  const ghost = cloneModel(g); ghost.scale.setScalar(def[4]);
  ghost.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.82; o.userData.c0 = o.material.color?.clone(); } }); curS().add(ghost);
  const fp = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 40), new THREE.MeshBasicMaterial({ color: '#5fd38d', transparent: true, opacity: 0.85, depthWrite: false })); fp.rotation.x = -Math.PI / 2; curS().add(fp);
  const gc = scene === 'in' ? '#7a5a40' : '#ffffff', grid = new THREE.GridHelper(4, 16, gc, gc); grid.material.transparent = true; grid.material.opacity = scene === 'in' ? 0.4 : 0.35; grid.material.depthWrite = false; curS().add(grid);
  const p = me(); let x = p.x + Math.sin(p.ry) * 1.6, z = p.z + Math.cos(p.ry) * 1.6, ry = Math.round((p.ry + Math.PI) / ROT) * ROT;
  if (edit) { x = edit.d.x; z = edit.d.z; ry = edit.d.ry || 0; }
  build = { def, id, ghost, fp, grid, x, z, ry, ok: false, edit, mode: 'place', dist: scene === 'in' ? 8.5 : 9 };
  $('#bu-name').textContent = (edit ? '調整「' : '擺放「') + def[1] + '」'; $('#bu-store').hidden = !edit; $('#bu-cancel small').textContent = '取消'; ['#bu-rl', '#bu-rr', '#bu-ok'].forEach(q => { $(q).hidden = false; });
  buildUI(true); buildCheck(); sfx('click');
}
function endBuild(keep) {
  const B = build; if (!B) return; [B.ghost, B.fp, B.grid].forEach(o => o.parent?.remove(o));
  if (B.edit && !keep) { st.decor.splice(B.edit.i, 0, B.edit.d); save(); drawDecor(); } // 取消：放回原位
  build = null; buildUI(false);
}
$('#bu-cancel').onclick = () => { sfx('click'); endBuild(false); };
$('#bu-rl').onclick = () => { if (!build) return; build.ry += ROT; buildCheck(); sfx('click'); };
$('#bu-rr').onclick = () => { if (!build) return; build.ry -= ROT; buildCheck(); sfx('click'); };
$('#bu-ok').onclick = () => {
  const B = build; if (!B || !B.ok) return toast('這裡放不下，換個地方');
  st.decor = st.decor || []; const d = { id: B.id, sc: scene, x: +B.sx.toFixed(2), z: +B.sz.toFixed(2), ry: +B.ry.toFixed(3) }; if (B.top != null) d.y = +B.top.toFixed(3);
  if (B.edit) st.decor.splice(B.edit.i, 0, d); else { st.decor.push(d); st.inv[B.id]--; quest('decor'); addLove(1, `擺好了「${B.def[1]}」`); }
  save(); endBuild(true); drawDecor(); sfx('pop'); burst('star', new THREE.Vector3(d.x, (d.y ?? buildGround(d.x, d.z)) + 0.8, d.z), 8);
};
$('#bu-store').onclick = () => { const B = build; if (!B?.edit) return; st.inv[B.id] = (st.inv[B.id] || 0) + 1; save(); endBuild(true); drawDecor(); toast(`「${B.def[1]}」收回去了`); sfx('pop'); };
// 調整已經擺好的：點一下要動的那一個
function startArrange() {
  $('#dlg').close(); const here = (st.decor || []).filter(d => d.sc === scene); if (!here.length) return toast(scene === 'in' ? '屋裡還沒有擺設' : '外面還沒有擺設');
  build = { mode: 'pick', dist: scene === 'in' ? 11 : 12, x: scene === 'in' ? 0 : me().x, z: scene === 'in' ? 0 : me().z }; $('#bu-cancel small').textContent = '完成';
  $('#bu-name').textContent = '點一下要調整的擺設'; $('#bu-tip').textContent = '拖曳可以看看四周'; ['#bu-rl', '#bu-rr', '#bu-ok', '#bu-store'].forEach(q => { $(q).hidden = true; }); buildUI(true);
}
function buildPointer(kind, e, d) {
  const B = build; if (!B) return false;
  if (kind === 'tap') {
    if (B.mode === 'pick') {
      ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, cam);
      const hit = ray.intersectObjects(decorObjs.filter(o => o.parent === curS()), true)[0]; if (!hit) return true;
      let o = hit.object; while (o && o.userData.di == null) o = o.parent; if (!o) return true;
      const i = o.userData.di, dd = st.decor[i]; st.decor.splice(i, 1); drawDecor(); build = null; ['#bu-rl', '#bu-rr', '#bu-ok'].forEach(q => { $(q).hidden = false; });
      startPlace(dd.id, { i, d: dd }); return true;
    }
    const g = groundAt(e.clientX, e.clientY, buildGround(B.x, B.z)); if (g) { B.x = g.x; B.z = g.z; buildCheck(); } return true;
  }
  if (kind === 'drag') {
    if (B.mode === 'pick') { const a = groundAt(e.clientX - d.dx, e.clientY - d.dy), b = groundAt(e.clientX, e.clientY); if (a && b) { B.x -= b.x - a.x; B.z -= b.z - a.z; } return true; }
    const y = buildGround(B.x, B.z), a = groundAt(e.clientX - d.dx, e.clientY - d.dy, y), b = groundAt(e.clientX, e.clientY, y);
    if (a && b) { B.x += b.x - a.x; B.z += b.z - a.z; buildCheck(); } return true;
  }
  return false;
}

// ---------- 雪人（冬天，地上有積雪時） ----------
const SNOWMAN = { x: 3.5, z: 11 };
let snowmanObj = null;
function drawSnowman() {
  snowmanObj?.parent?.remove(snowmanObj); snowmanObj = null;
  if (!st.snowman || seasonOf(st.day).k !== 'winter' || seasonOf(st.snowman.day).k !== 'winter' || st.day - st.snowman.day > SEASON_DAYS) return;
  snowmanObj = snowmanMesh(3); snowmanObj.position.set(SNOWMAN.x, LAND_Y, SNOWMAN.z); snowmanObj.rotation.y = 0.4; OUT.add(snowmanObj);
}
function actSnowman() {
  if (seasonOf(st.day).k !== 'winter' || (WX?.st.cover || 0) < 0.25) return toast('要等冬天下過雪、地上有積雪才能堆雪人喔');
  snowmanObj?.parent?.remove(snowmanObj);
  const g = new THREE.Group(); g.position.set(SNOWMAN.x, LAND_Y, SNOWMAN.z); g.rotation.y = 0.4; OUT.add(g);
  let stage = 0;
  actGo(() => { seat(me(), SNOWMAN.x - 0.9, null, SNOWMAN.z + 0.3, Math.PI / 2 - 0.2, 'crouch'); seat(you(), SNOWMAN.x + 0.9, null, SNOWMAN.z + 0.3, -Math.PI / 2 + 0.2, 'crouch'); }, 250);
  const names = ['滾出大雪球', '疊上身體', '放上頭、眼睛、紅蘿蔔鼻子和圍巾'];
  beginAct('snowman', '⛄ 堆雪人', '按三次「堆雪」把雪人堆起來。', {
    focus: () => new THREE.Vector3(SNOWMAN.x, LAND_Y + 1, SNOWMAN.z), back: [SNOWMAN.x, SNOWMAN.z + 1.8],
    btns: [{ t: '堆雪！', main: true, id: 'snow-go', fn: () => {
      if (stage >= 3) return; stage++; g.clear(); g.add(snowmanMesh(stage)); me().av.dig(); you().av.dig?.(); sfx('sand'); burst('star', new THREE.Vector3(SNOWMAN.x, LAND_Y + 0.6 * stage, SNOWMAN.z), 3, 0.4);
      msg(names[stage - 1] + (stage < 3 ? '…' : '！雪人完成了 ⛄'));
      if (stage === 3) { st.snowman = { day: st.day }; save(); quest('snowman'); addCoins(15); addLove(3, '雪人完成'); addMemo('⛄', '在小島上堆了一個雪人'); $('#snow-go').disabled = true; me().av.emote('cheer', 1.4); }
    } }],
    end() { g.parent?.remove(g); drawSnowman(); },
  });
}

// ---------- 傳送（地圖點地點，畫面一暗就到了） ----------
async function teleportTo(s) {
  if (act) endAct();
  if (s.sc !== scene) { if (s.sc === 'in') await enterHouse(); else await exitHouse(); }
  const pp = s.pos?.() || s; let x = pp.x, z = pp.z;
  if (s.id === 'dog') { x += 0.9; z += 0.9; }
  [x, z] = freeSpot(x, z);
  await fadeDo(() => { const p = me(); p.x = x; p.z = z; p.path = null; p.ry = Math.atan2(pp.x - x, pp.z - z) || p.ry; updateCam(0, true); }, 300);
  if (tutorial.step === 1) tutorialNext();
  s.run();
}

// ---------- 跑步 ----------
function setRun(v) { st.run = !!v; $('#btn-run').setAttribute('aria-pressed', String(st.run)); save(); }
$('#btn-run').onclick = () => { setRun(!st.run); sfx('click'); toast(st.run ? '🏃 跑步' : '🚶 走路'); };

// ---------- 新手教學 ----------
const TUT = [
  { t: '👋 歡迎來到小島！先推左下角的搖桿，走走看。', el: '#joy' },
  { t: '🗺️ 點右上角的地圖，選一個想去的地方，畫面一暗就到了。', el: '#btn-map' },
  { t: '🎣 到了之後就會開始活動，照著下面的按鈕玩玩看，玩完按「離開」。', el: null },
  { t: '📋 每天有 3 個小任務，完成可以拿 🪙 小島幣；點 🪙 可以買擺設裝潢小島和小木屋。', el: '#quest-chip', next: true },
  { t: '🌐 想跟另一半一起玩，點右上角的 🌐 建立小島，把情侶碼給對方。左下角 🏃 可以跑步。', el: '#btn-net', next: true },
];
const tutorial = { step: -1, moved: 0 };
function tutorialShow() {
  document.querySelectorAll('.glow').forEach(e => e.classList.remove('glow'));
  const s = TUT[tutorial.step]; if (!s) { $('#coach').hidden = true; return; }
  $('#coach').hidden = false; $('#coach-text').textContent = s.t; $('#coach-step').textContent = `${tutorial.step + 1}/${TUT.length}`;
  $('#coach-next').hidden = !s.next; $('#coach-next').textContent = tutorial.step === TUT.length - 1 ? '開始玩！' : '好';
  if (s.el) $(s.el)?.classList.add('glow');
}
function tutorialNext() { if (tutorial.step < 0) return; tutorial.step++; if (tutorial.step >= TUT.length) { tutorialEnd(); return; } tutorialShow(); sfx('pop'); }
function tutorialEnd() { tutorial.step = -1; st.tut = 1; save(); $('#coach').hidden = true; document.querySelectorAll('.glow').forEach(e => e.classList.remove('glow')); }
function tutorialStart() { tutorial.step = 0; tutorial.moved = 0; tutorialShow(); }
$('#coach-skip').onclick = tutorialEnd;
$('#coach-next').onclick = tutorialNext;
function tickTutorial(dt) { if (tutorial.step === 0 && me().moving) { tutorial.moved += dt; if (tutorial.moved > 1.2) tutorialNext(); } }

// ---------- 省電模式 ----------
function applyLow() { R.setPixelRatio(st.low ? 1 : PR); resize(); shadowSweep(); }
/* 陰影：屋外的東西都會在地上投影（省電模式關掉）。每隔幾秒把新出現的模型也設成會投影 */
function shadowSweep() {
  if (!W?.sunL) return; const on = !st.low; W.sunL.castShadow = on;
  OUT.traverse(o => { if (!o.isMesh || o === W.ground || o.userData.shOK === on) return; o.userData.shOK = on; const m = o.material; const solid = m && m.isMeshToonMaterial && !m.transparent; o.castShadow = on && solid; o.receiveShadow = on && solid; });
  W.ground.receiveShadow = on; allChars().forEach(c => { c.av.noBlob = on && (c.sc || 'out') === 'out'; c.av.root.traverse(o => { if (o.isMesh) o.receiveShadow = false; }); }); /* 角色身上不畫影子（會一閃一閃） */
}
setInterval(shadowSweep, 2500);
let fpsT = 0, fpsN = 0, lowAsked = false;
function tickFps(dt) {
  if (st.low || lowAsked || !started() || navigator.webdriver) return; fpsT += dt; fpsN++;
  if (fpsT > 10) { const fps = fpsN / fpsT; fpsT = 0; fpsN = 0; if (fps < 24) { lowAsked = true; openDlg('🔋 手機有點吃力', `<p>畫面每秒只有 ${Math.round(fps)} 張，要不要打開<b>省電模式</b>？畫面會稍微不那麼細，但比較順、比較不燙。</p><div class="row"><button type="button" class="ghost" value="close">先不用</button><button type="button" class="primary" id="low-on">打開省電模式</button></div>`); $('#low-on').onclick = () => { st.low = true; save(); applyLow(); $('#dlg').close(); toast('🔋 已打開省電模式（📔 → 關於 可以關掉）'); }; } }
}


// ---------- 雞舍：撿雞蛋、餵雞（前一天有餵，隔天多下一顆蛋） ----------
let eggObjs = [];
function eggsToday() { if (!st.eggs || st.eggs.day !== st.day) { st.eggs = { day: st.day, n: 2 + (st.fedDay === st.day - 1 ? 1 : 0) + (surpriseIs('egg') ? 2 : 0) }; } return st.eggs.n; }
function drawEggs() {
  eggObjs.forEach(o => o.parent?.remove(o)); eggObjs = []; if (!W) return;
  const n = eggsToday(), m = toon('#fbf3e4'), straw = toon('#d8b45a');
  for (let i = 0; i < n; i++) {
    const g = new THREE.Group(); const nest = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.05, 6, 12), straw); nest.rotation.x = Math.PI / 2; g.add(nest);
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), m); e.scale.y = 1.3; e.position.y = 0.06; g.add(e);
    const x = SPOTS.coop.x - 0.8 + i * 0.8, z = SPOTS.coop.z + 1.1; g.position.set(x, standH(x, z) + 0.03, z); OUT.add(g); eggObjs.push(g);
  }
}
function actCoop() {
  const c = SPOTS.coop;
  fadeDo(() => { const p = me(); p.x = c.x; p.z = c.z + 1.9; p.ry = Math.PI; }, 200);
  const btns = () => setBtns([
    { t: '撿雞蛋', s: eggsToday() ? `還有 ${eggsToday()} 顆` : '今天撿完了', main: true, dis: !eggsToday(), fn: () => {
      if (!eggsToday()) return; st.eggs.n--; st.pantry = st.pantry || {}; st.pantry['雞蛋'] = (st.pantry['雞蛋'] || 0) + 1; save(); drawEggs();
      me().av.emote('pickup', 1.1); sfx('pop'); quest('egg'); burst('star', headPos(me(), 0.4), 2, 0.2);
      msg(`撿到一顆雞蛋！冰箱裡有 ${st.pantry['雞蛋']} 顆。`); btns();
    } },
    { t: '餵雞', s: st.fedDay === st.day ? '今天餵過了' : '明天多一顆蛋', dis: st.fedDay === st.day, fn: () => {
      st.fedDay = st.day; save(); me().av.emote('throw', 0.8); sfx('sand'); quest('feed'); addLove(1, '雞雞們好開心');
      const p = me(); (W.chickens || []).forEach((a, i) => { a.tx = p.x + Math.sin(i * 2.1) * 1.1; a.tz = p.z - 1.0 + Math.cos(i * 2.1) * 0.5; a.t = 6; });
      for (let i = 0; i < 6; i++) burst('star', new THREE.Vector3(p.x + rand(-0.8, 0.8), standH(p.x, p.z) + 0.2, p.z - 1 + rand(-0.4, 0.4)), 1, 0.1);
      msg('撒了一把飼料，雞雞們都跑過來了！明天會多下一顆蛋。'); btns();
    } },
  ]);
  beginAct('coop', '🐔 雞舍', `今天下了 ${eggsToday()} 顆蛋。撿回家可以做蛋料理；每天餵雞，隔天會多一顆蛋。`, {
    focus: () => new THREE.Vector3(c.x, LAND_Y + 0.8, c.z + 0.6), back: [c.x, c.z + 2.2], camYaw: 0.2, camPitch: 0.45,
  });
  btns();
}

// ---------- 騎腳踏車（用搖桿騎，速度比跑步快；在哪裡下車，車就停在哪裡） ----------
const SEAT_H = 0.82;
function actBike() {
  const bike = W.bike; if (!bike) return;
  if (bike.userData.rider) return toast('腳踏車有人在騎喔');
  const p = me(); p.x = bike.position.x; p.z = bike.position.z; p.ry = bike.rotation.y;
  p.av.setPose('ride'); p.av.reach(true); quest('bike'); sfx('click');
  let ringT = 0;
  beginAct('bike', '🚲 騎腳踏車', '推搖桿騎車，速度比跑步快。想停的時候按「下車」。', {
    move: true,
    btns: [{ t: '下車', main: true, fn: () => endAct() }, { t: '🔔 按鈴', fn: () => { if (ringT > 0) return; ringT = 0.6; sfx('bell'); you().av.emote('wave', 1); } }],
    update(dt) {
      ringT -= dt; const c = me();
      c.y = standH(c.x, c.z) + SEAT_H - HIP;
      bike.position.set(c.x, standH(c.x, c.z), c.z); bike.rotation.y = c.ry;
      // 輪子轉（整台車輕輕晃）
      bike.rotation.z = c.moving ? Math.sin(performance.now() / 120) * 0.02 : 0;
    },
    end() { const c = me(); c.y = null; c.av.setPose('stand'); c.av.reach(false); bike.rotation.z = 0; const s = Math.sin(c.ry + Math.PI / 2), co = Math.cos(c.ry + Math.PI / 2); const [x, z] = freeSpot(c.x + s * 0.7, c.z + co * 0.7); c.x = x; c.z = z; addMemo('🚲', '騎腳踏車繞了小島'); },
  });
}
// 別人在騎車：在他腳下也放一台腳踏車
const remoteBikes = new Map();
// 船的座位（世界座標）：划船的人坐船頭面向船尾、另一個人坐船尾面向前
function boatSeat(driver) {
  const b = W.boat, ry = b.rotation.y, fx = Math.sin(ry), fz = Math.cos(ry), sg = driver ? 1 : -1;
  return { x: b.position.x + fx * 0.55 * sg, z: b.position.z + fz * 0.55 * sg, y: b.position.y + 0.44 - HIP, ry: driver ? ry + Math.PI : ry };
}
// 別人在划船：船在我的畫面上慢慢滑到最新位置（不是一跳一跳）
function tickBoatSync(dt) {
  const T = MP.boatT, b = W?.boat; if (!T || !b || MP.driving) return; const k = Math.min(1, dt * 6);
  b.position.x += (T.x - b.position.x) * k; b.position.z += (T.z - b.position.z) * k;
  let d = T.ry - b.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); b.rotation.y += d * k;
  const t = performance.now() / 1000; b.position.y = 0.05 + Math.sin(t * 1.6) * 0.05; b.rotation.z = Math.sin(t * 1.2) * 0.04;
}
function tickRemoteBikes() {
  for (const c of allChars()) {
    if (c === me() || !c.remote) continue; const riding = c.act === 'bike' && c.av.root.visible;
    let b = remoteBikes.get(c);
    if (riding && !b) { b = { o: null }; remoteBikes.set(c, b); load('bike').then(g => { if (g) { b.o = cloneModel(g); OUT.add(b.o); } }); }
    if (b?.o) { b.o.visible = riding; if (riding) { b.o.position.set(c.x, standH(c.x, c.z), c.z); b.o.rotation.y = c.ry; } }
  }
  if (W?.bike) W.bike.visible = ![...allChars()].some(c => c.remote && c.act === 'bike') || act?.id === 'bike';
}


// ---------- 走路速度、手電筒 ----------
const WALK = { walk: 3.0, run: 6.0 };
// 手電筒：拿在右手，往前照（聚光燈＋淡淡的光束）；別人開手電筒也看得到
const flashes = new Map();
function flashFor(c) {
  let f = flashes.get(c); if (f) return f;
  const item = new THREE.Group(); const body = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.22, 10), toon('#3a3a44')); body.rotation.x = Math.PI / 2; body.position.z = 0.08; item.add(body);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.045, 12), new THREE.MeshBasicMaterial({ color: '#fff6c8' })); lens.position.z = 0.195; item.add(lens);
  const spot = new THREE.SpotLight('#fff1c8', 40, 22, 0.45, 0.55, 1.4); const tgt = new THREE.Object3D(); spot.target = tgt;
  // 光束：尖端在原點（燈頭）、往 +z 變寬，用 lookAt 對準照的方向
  const cone = new THREE.ConeGeometry(1.1, 6, 20, 1, true); cone.translate(0, -3, 0); cone.rotateX(-Math.PI / 2);
  const beam = new THREE.Mesh(cone, new THREE.MeshBasicMaterial({ color: '#fff3c0', transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
  f = { item, lens, spot, tgt, beam, on: false }; flashes.set(c, f); return f;
}
function tickFlash() {
  for (const c of allChars()) {
    const want = (c === me() ? !!st.flash : !!c.net?.fl) && c.av.root.visible && (c.sc || 'out') === scene && /^(stand|ride)$/.test(c.av.pose || 'stand'); /* 坐著、躺著、蹲著時先收起手電筒 */
    let f = flashes.get(c); if (!want && !f) continue; f = flashFor(c);
    const S = curS();
    if (want && !f.on) { f.on = true; S.add(f.spot); S.add(f.tgt); S.add(f.beam); if (!c.av.item) { c.av.setItem(f.item); c.av.reach(true); } }
    if (!want && f.on) { f.on = false; f.spot.parent?.remove(f.spot); f.tgt.parent?.remove(f.tgt); f.beam.parent?.remove(f.beam); if (c.av.item === f.item) { c.av.setItem(null); if (!c.locked) c.av.reach(false); } }
    if (!f.on) continue;
    if (f.spot.parent !== S) { S.add(f.spot); S.add(f.tgt); S.add(f.beam); }
    // 活動結束後手上空了：再拿起手電筒
    if (!c.av.item && !c.locked && !(c === me() ? act : c.act)) { c.av.setItem(f.item); c.av.reach(true); }
    // 從手電筒的燈頭往前、稍微往下照
    const fx = Math.sin(c.ry), fz = Math.cos(c.ry), base = c.av.root.position, lp = new THREE.Vector3();
    if (c.av.item === f.item) f.lens.getWorldPosition(lp); else lp.set(base.x + fx * 0.35, base.y + 0.7, base.z + fz * 0.35);
    f.spot.position.copy(lp);
    f.tgt.position.set(lp.x + fx * 7, base.y - 0.2, lp.z + fz * 7);
    f.beam.position.copy(lp); f.beam.lookAt(f.tgt.position);
    // 白天光束淡一點
    f.beam.material.opacity = 0.03 + nightK * 0.07;
  }
}
let nightK = 0, flashTipNight = -1;
function setFlash(v) { st.flash = !!v; $('#btn-flash').setAttribute('aria-pressed', String(st.flash)); save(); }
$('#btn-flash').onclick = () => { setFlash(!st.flash); sfx('click'); toast(st.flash ? '🔦 打開手電筒' : '關掉手電筒'); };

// ---------- 主迴圈 ----------
const clock = new THREE.Clock(); let T = 0, saveT = 0;
let lowSkip = false;
function frame() {
  requestAnimationFrame(frame);
  if (st.low && !preview.on && (lowSkip = !lowSkip)) return; // 省電：每秒 30 張
  const dt = Math.min(0.05, clock.getDelta()); T += dt;
  if (!W) return;
  // 時間：一小時 = 36 秒
  syncClock(); /* 島上時間＝台灣時間 */ tickFestival(dt); tickBall(dt); tickSanta(dt); if (W && SEASON.on !== xmasSeason()) drawSeason(); tickSurprise(dt); tickSurNight(dt); tickMini(dt); tickRare(dt);
  const k = setTimeOfDay(W, OUT, preview.on ? 17.6 : act?.tod ?? st.tod, cam.position); /* act.tod：看夕陽時的夕陽預覽 */
  { const pp = me().av.root.position, gx = Math.round(pp.x / 3) * 3, gz = Math.round(pp.z / 3) * 3; W.sunL.target.position.set(gx, 0, gz); W.sunL.position.x += gx; W.sunL.position.z += gz; } /* 影子框跟著玩家 */
  W.water.material.uniforms.uTime.value = T; if (W.surf) W.surf.material.uniforms.uTime.value = T;
  if (!preview.on) { tickWeather(dt, k); tickTutorial(dt); tickFps(dt); tickRemoteBikes(); tickBoatSync(dt); chars[0].av.mate = chars[1].av; chars[1].av.mate = chars[0].av; /* 情侶動作要知道對方身體在哪 */ nightK = k.night; tickFlash();
    // 天黑了提醒一次可以開手電筒
    if (k.night > 0.6 && !st.flash && scene === 'out' && flashTipNight !== st.day && started()) { flashTipNight = st.day; toast('🌙 天黑了，左下角 🔦 可以打開手電筒', 4000); $('#btn-flash').classList.add('glow'); setTimeout(() => $('#btn-flash').classList.remove('glow'), 6000); } }
  if (IN) { IN.winMat.color.copy(k.hor).lerp(new THREE.Color('#ffd9a8'), 0.25); }
  W.sky.clouds.rotation.y += dt * 0.004;
  W.fireL.intensity = (6 + Math.sin(T * 13) * 1.2 + Math.sin(T * 7.3) * 1.0) * (0.5 + k.night * 0.8);

  if (preview.on) { // 開場：繞著小屋慢慢轉
    // 開場：鏡頭慢慢繞著自己的角色轉（角色在畫面上半部，下面是設定卡片）
    preview.t += dt * 0.12; const a = Math.sin(preview.t) * 0.6;
    const pc = visitParam.length && guestChar ? guestChar : chars[myIdx()];
    pc.x = 0; pc.z = 1.2; pc.ry = 0; pc.y = null;
    const gy = standH(0, 1.2), H = innerHeight / innerWidth > 1.2 ? 1 : 0.6;
    cam.position.set(Math.sin(a) * 5.6, gy + 1.7, 1.2 + Math.cos(a) * 5.6); cam.lookAt(0, gy - 0.35 - H * 0.75, 1.2);
    placeRoots(dt); syncAv(pc, dt);
    mixers.forEach(m => m.update(dt)); tickAnimals(dt, null, walkable);
    R.render(OUT, cam); return;
  }

  // 玩家移動
  const p = me();
  if (act?.free && act.t > 0.5 && Math.hypot(joy.x, joy.y) > 0.4) endAct(); /* 無縫動作：推搖桿就站起來 */
  if (!p.locked && !photo.on) {
    let ix = joy.x, iy = joy.y;
    if (keys.has('w') || keys.has('arrowup')) iy -= 1; if (keys.has('s') || keys.has('arrowdown')) iy += 1; if (keys.has('a') || keys.has('arrowleft')) ix -= 1; if (keys.has('d') || keys.has('arrowright')) ix += 1;
    const mag = Math.min(1, Math.hypot(ix, iy));
    const yaw = scene === 'in' ? view.inYaw : view.yaw;
    if (MP.on && netMove(dt, mag > 0.12)) { /* 被牽著走、走過去讓對方抱 */ }
    else if (mag > 0.12) {
      p.path = null; lovePending = null;
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = -fz, rz = fx;
      const dx = fx * -iy + rx * ix, dz = fz * -iy + rz * ix;
      stepChar(p, dx, dz, dt, (act?.id === 'bike' ? 8.5 : st.run ? WALK.run : WALK.walk) * mag);
    } else if (p.path) {
      const P = p.path, last = P.i >= P.pts.length - 1, [wx, wz] = P.pts[Math.min(P.i, P.pts.length - 1)];
      const dx = wx - p.x, dz = wz - p.z, d = Math.hypot(dx, dz);
      const dEnd = Math.hypot(P.x - p.x, P.z - p.z), arrive = P.then ? Math.min(1.4, P.then.r * 0.6) : 0.15;
      if (dEnd < arrive || (last && d < 0.15)) { const then = P.then; p.path = null; p.moving = false; if (then && !act) then.run(); }
      else if (!last && d < 0.35) P.i++;
      else if (!stepChar(p, dx, dz, dt, st.run ? WALK.run : WALK.walk)) { p.stuck += dt; if (p.stuck > 0.8) { p.stuck = 0; const re = findPath(p.x, p.z, P.x, P.z); if (re && !P.retried) { P.pts = re; P.i = 0; P.retried = true; } else p.path = null; } } else p.stuck = 0;
    } else p.moving = false;
  }
  if (!act || !you().locked) partnerAI(dt);
  if (act) { act.t += dt; act.update?.(dt); }
  placeRoots(dt);
  allChars().forEach(c => { try { syncAv(c, dt); } catch (e) { if (!c._err) { c._err = 1; console.error('角色更新出錯', e); } } }); /* 一個角色出錯不能讓整格畫面停掉 */
  netTick(dt);
  if (ringM?.parent) { ringM.userData.t += dt; ringM.material.opacity = 1 - ringM.userData.t; ringM.scale.setScalar(1 + ringM.userData.t); if (ringM.userData.t > 1) ringM.parent.remove(ringM); }

  if (scene === 'out') {
    mixers.forEach(m => m.update(dt));
    if (W.dog && !W.dog.follow) W.dog.follow = () => scene === 'out' && !act ? me() : null;
    tickAnimals(dt, p, (x, z) => walkable(x, z) && !blocked(x, z, 0.2, [], BOXES));
    tickShells(T); tickFireworks(dt); tickMeteor(dt);
  }
  tickParts(dt);
  updateCam(dt);
  tickSpots();
  saveT += dt; if (saveT > 1) { saveT = 0; $('#clock').innerHTML = clockHtml(); }
  R.render(curS(), cam);
}

// 用情侶碼加入另一半的小島
async function joinByCode(code) {
  const r = await pairIsland(code); saveAuth({ island: r.island, key: r.key, role: r.role }); MP.role = r.role; MP.id = null; if (r.relogin) st.adopt = 1; // 重新登入：用島上原本的名字和樣子
  toast('加入小島了 ❤', 3000); connectNet({ island: r.island, key: r.key });
  if (tutorial.step >= 0) tutorialEnd();
}
// ---------- 訪客連結、情侶碼連結 ----------
const qs = new URLSearchParams(location.search);
const visitParam = (qs.get('visit') || '').toUpperCase().split('.'), pairParam = (qs.get('pair') || '').toUpperCase();
if (!visitParam[0] || !visitParam[1]) visitParam.length = 0;
async function setupPairSplash() {
  const card = $('.splash-card'), ban = document.createElement('p'); ban.className = 'invite'; ban.textContent = '💌 你收到一個小島邀請'; card.insertBefore(ban, card.firstChild);
  $('#start-btn').textContent = '加入小島 ♥'; $('.splash-card .sub').innerHTML = '填好名字、選好樣子，<br>按下面的按鈕就會搬進另一半的小島。';
  try { const r = await peekPair(pairParam); const n = r.names?.find(Boolean); if (n) ban.textContent = `💌 ${n} 邀請你一起住在小島上`; if (r.relogin === 0 || r.relogin === 1) { ban.textContent = `💌 歡迎回來${r.names?.[r.relogin] ? '，' + r.names[r.relogin] : ''}！登入後回到你們的小島`; $('#start-btn').textContent = '回到小島 ♥'; if (r.names?.[r.relogin] && !$('#name0').value) $('#name0').value = r.names[r.relogin]; } else if (r.paired) ban.textContent = '這座小島已經有兩位島主了'; } catch (e) { ban.textContent = '💌 邀請碼可能過期了，請另一半重新傳一次'; }
}
async function setupVisit() {
  const [island, code] = visitParam, card = $('.splash-card');
  const look = randomLook(Math.random() < 0.5 ? 'f' : 'm');
  card.innerHTML = `<p class="eyebrow">朋友的小島</p><h1>拜訪小島</h1><p class="sub" id="v-sub">讀取中…</p>
    <label class="anniv"><span>你的暱稱</span><input id="v-name" maxlength="8" autocomplete="off" placeholder="例如：小明"></label>
    <div class="seg"><button type="button" data-g="f">女生</button><button type="button" data-g="m">男生</button><button type="button" class="shuffle">🎲 換樣子</button></div>
    <button type="button" id="v-go" class="primary" disabled>登島拜訪 🎈</button><p class="load-msg" id="v-msg"></p>`;
  let L = look; const prev = newChar(L); prev.x = 0; prev.z = -1.4; prev.ry = 0; guestChar = prev;
  const segs = () => card.querySelectorAll('[data-g]').forEach(b => b.setAttribute('aria-pressed', String(L.gender === b.dataset.g))); segs();
  card.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { L = randomLook(b.dataset.g); prev.av.setLook(L); segs(); });
  card.querySelector('.shuffle').onclick = () => { L = randomLook(L.gender); prev.av.setLook(L); prev.av.emote('jump', 1); };
  let info = null;
  try { info = await peekIsland(island, code); } catch (e) { $('#v-sub').textContent = e.message; return; }
  $('#v-sub').textContent = `${info.names?.[0] || '島主'} ♥ ${info.names?.[1] || '島主'} 邀請你來小島玩` + (info.locked ? '（小島目前鎖起來了）' : info.full ? '（朋友已經滿了）' : '');
  if (info.looks) { [0, 1].forEach(i => { st.looks[i] = info.looks[i]; chars[i].av.setLook(info.looks[i]); }); st.names = info.names; }
  $('#v-go').disabled = !!(info.locked || info.full);
  $('#v-go').onclick = () => {
    const r = checkName($('#v-name').value); if (!r.ok) { $('#v-msg').textContent = NAME_WHY[r.why]; return; }
    MP.guest = { name: r.text || '朋友', look: L }; MP.role = 'g'; MP.on = true;
    Music.init(); if (st.music) Music.play();
    $('#splash').classList.add('out'); setTimeout(() => { $('#splash').hidden = true; }, 600);
    $('#hud').hidden = false; preview.on = false;
    prev.x = SPOTS.door.x + rand(-1, 1); prev.z = 3 + rand(0, 1); prev.ry = 0; updateCam(0, true);
    Amb.start(); updateChips(); connectNet({ island, guest: code, name: MP.guest.name, look: L }); toast(`歡迎來到 ${nameOf(0)} ♥ ${nameOf(1)} 的小島！`, 3500);
  };
}

// ================= 牽掛：冰箱便利貼、想你、你不在的時候 =================
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const ago = ts => { const m = Math.round((Date.now() - ts) / 60000); return m < 1 ? '剛剛' : m < 60 ? `${m} 分鐘前` : m < 1440 ? `${Math.round(m / 60)} 小時前` : `${Math.round(m / 1440)} 天前`; };
const NOTE_COL = ['#ffe9a8', '#ffd3df', '#d6ecff', '#d9f2d0'];
const partnerName = () => nameOf(1 - myIdx());
function openNotes() {
  if (MP.role === 'g') return; sfx('click'); const notes = st.notes || []; st.notesRead = Date.now(); save();
  openDlg('📝 冰箱便利貼', `<p class="muted">留一句話給 ${esc(partnerName())}，對方下次打開小島第一眼就會看到。${MP.on ? '' : '（先在 🌐 跟另一半連線，才傳得過去）'}</p>
    <label class="anniv"><span>想說的話（60 字內）</span><textarea id="note-in" maxlength="60" rows="3" placeholder="例如：今天辛苦了，晚餐想吃什麼？"></textarea></label>
    <button type="button" class="primary" id="note-go">📌 貼到冰箱上</button>
    <div class="notes">${notes.length ? notes.map(n => `<div class="note" style="background:${NOTE_COL[n.ts % 4]}"><p>${esc(n.text)}</p><small>${esc(nameOf(n.by))} · ${ago(n.ts)}</small></div>`).join('') : '<p class="muted">冰箱上還沒有便利貼。</p>'}</div>`);
  $('#note-go').onclick = () => {
    const text = $('#note-in').value.trim().replace(/\s+/g, ' ').slice(0, 60); if (!text) return toast('寫點什麼吧');
    st.notes = [{ by: myIdx(), text, ts: Date.now() }, ...(st.notes || [])].slice(0, 20); st.noteSeen = Date.now(); save(); drawNotes();
    if (MP.on) MP.net.send({ t: 'nudge', k: 'note', text }); else toast('貼好了！連線後另一半就看得到');
    addLove(1, null, 'note'); $('#dlg').close(); sfx('pop');
  };
}
// 冰箱門上的便利貼（最新 6 張）
function drawNotes() {
  if (!IN) return; if (IN.noteG) IN.S.remove(IN.noteG); const g = new THREE.Group(); IN.noteG = g; IN.S.add(g);
  (st.notes || []).slice(0, 6).forEach((n, i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.15), toon(NOTE_COL[n.ts % 4]));
    m.position.set(6.3 + (i % 2) * 0.2 + (i % 3) * 0.02, 1.55 - Math.floor(i / 2) * 0.2, -4.5 + 0.33); m.rotation.z = ((n.ts % 7) - 3) * 0.05; g.add(m);
  });
}
// 想你：另一半在線上就飛愛心過去，不在就推播到對方手機
let missT = 0;
function sendMiss() {
  if (MP.role === 'g') return;
  if (!MP.on) return toast('先在 🌐 跟另一半連線，想念才傳得過去');
  if (performance.now() - missT < 15000) return toast('想念已經在路上了，等一下再傳');
  missT = performance.now(); MP.net.send({ t: 'nudge', k: 'miss' }); addMemo('💗', `${nameOf(myIdx())} 說想 ${partnerName()}`);
  me().av.emote('shy', 1.6); burst('heart', headPos(me(), 1.4), 10); sfx('pop');
}
function heartRain() {
  const box = document.createElement('div'); box.className = 'heart-rain'; box.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 18; i++) { const h = document.createElement('span'); h.textContent = pick(['💗', '💕', '❤️', '💖']); h.style.left = rand(4, 92) + '%'; h.style.animationDelay = rand(0, 1.2) + 's'; h.style.fontSize = rand(22, 40) + 'px'; box.appendChild(h); }
  document.body.appendChild(box); setTimeout(() => box.remove(), 4200);
}
function onNudge(m) {
  const who = nameOf(m.from);
  if (m.k === 'miss') { heartRain(); toast(`💗 ${who} 想你了・點這裡回覆`, 5000, () => openChat()); sfx('chime'); const c = chars[m.from]; if (c?.remote) burst('heart', headPos(c, 1.4), 8); }
  else if (m.k === 'qa') { toast(`💞 ${who} 想看你今天的答案`, 6000, () => openQA()); sfx('pop'); }
  else if (m.k === 'letter') { toast(`💌 ${who} 寄了一封信給你`, 6000, () => openMail()); sfx('chime'); drawMailFlag?.(); }
  else { toast(`📝 ${who} 在冰箱貼了便利貼：「${m.text}」`, 6000, () => openNotes()); sfx('pop'); st.noteSeen = Date.now(); }
}
function onNudged(m) {
  if (m.live) toast(m.k === 'miss' ? `愛心飛到 ${partnerName()} 那邊了 💗` : m.k === 'qa' ? `已經提醒 ${partnerName()} 了` : m.k === 'letter' ? `信送到 ${partnerName()} 的信箱了 💌` : '便利貼貼好了，對方馬上就看得到');
  else if (m.pushed) toast(`已經傳到 ${partnerName()} 的手機了 📳`);
  else toast(`${partnerName()} 現在不在，下次打開小島就會看到${m.k === 'miss' ? '你的想念' : ''}`, 3500);
}
// ================= 情侶每日問答：每天一題（台灣日期），兩個人都答了才看得到對方的答案 =================
const twDate = (off = 0) => new Date(Date.now() + 8 * 3600e3 + off * 864e5).toISOString().slice(0, 10);
const qaIdx = d => (Math.floor(Date.parse(d + 'T00:00:00Z') / 864e5) * 47) % QUESTIONS.length;
const qaQ = d => QUESTIONS[st.qa?.[d]?.q ?? qaIdx(d)] || QUESTIONS[0];
const qaBoth = e => !!(e?.a?.[0] && e?.a?.[1]);
function qaStreak() { let n = 0; for (let k = 0; k < 400; k++) { const e = st.qa?.[twDate(-k)]; if (qaBoth(e)) n++; else if (k > 0) break; } return n; }
const qaTodo = () => MP.role !== 'g' && !st.qa?.[twDate()]?.a?.[myIdx()];
const qaUnseen = () => MP.role !== 'g' && qaBoth(st.qa?.[twDate()]) && st.qaSeen !== twDate(); /* 兩個人都答完了，我還沒看答案 */
function qaBadge() { const b = $('#quest-chip'); if (b) b.classList.toggle('dot', qaTodo() || qaUnseen()); }
function qaReward(d) {
  const q = qaQ(d), n = qaStreak();
  addLove(5, n > 1 ? `默契連續 ${n} 天 💞` : '兩個人都回答了 💞', 'qa'); addCoins(15 + Math.min(5, n) * 2, '今日問答');
  addMemo('💞', `一起回答了「${q[1].slice(0, 24)}${q[1].length > 24 ? '…' : ''}」`, 'qa:' + d); burst('heart', headPos(me(), 1.4), 10, 0.4); sfx('chime');
}
function qaAnswer(text) {
  const d = twDate(), i = myIdx(); st.qa = st.qa || {};
  const e = st.qa[d] || (st.qa[d] = { q: qaIdx(d), a: ['', ''], ts: [0, 0], h: [0, 0] }), first = !e.a[i];
  e.a[i] = text; e.ts[i] = Date.now(); save(); qaBadge();
  if (MP.on && MP.role !== 'g') MP.net.send({ t: 'qa', d, q: e.q, a: text });
  if (first && e.a[1 - i]) qaReward(d); else if (first) { addLove(1); toast(`答好了！等 ${partnerName()} 也回答，就能看到彼此的答案 💌`, 3500); }
}
// 收到伺服器的問答：對方剛回答就提醒；自己離線時答的補送上去
function qaAfterSync(before, got, first) {
  const i = myIdx(), j = 1 - i;
  if (first) { for (const [d, e] of Object.entries(before)) if (e?.a?.[i] && !got[d]?.a?.[i] && MP.on) { st.qa[d] = { ...(st.qa[d] || e), a: [0, 1].map(k => k === i ? e.a[i] : (got[d]?.a?.[k] || '')) }; MP.net.send({ t: 'qa', d, q: e.q, a: e.a[i] }); } }
  else for (const [d, e] of Object.entries(got)) {
    if (d !== twDate() || !e?.a?.[j] || before[d]?.a?.[j]) continue;
    sfx('pop'); toast(e.a[i] ? `💞 ${partnerName()} 也回答了，點這裡看答案` : `💌 ${partnerName()} 回答了今天的問題，點這裡回答`, 6000, () => openQA());
  }
  qaBadge(); if ($('#dlg').open && $('#dlg').dataset.qa) openQA(true);
}
function openQA(keep, day) {
  if (MP.role === 'g') return; if (!keep) sfx('click');
  if (day && day !== twDate()) return openQADay(day);
  const d = twDate(), i = myIdx(), j = 1 - i, e = st.qa?.[d], q = qaQ(d), cat = QA_CATS[q[0]] || QA_CATS.s, pn = esc(partnerName());
  const mine = e?.a?.[i] || '', theirs = e?.a?.[j] || '', streak = qaStreak();
  let html = `<div class="qa-card" style="--qc:${cat[1]}"><span class="qa-cat">${cat[0]}</span><p class="qa-q">${esc(q[1])}</p><small>${Number(d.slice(5, 7))} 月 ${Number(d.slice(8))} 日${streak ? `・默契連續 <b>${streak}</b> 天` : ''}</small></div>`;
  if (!mine || keep === 'edit') html += `<label class="qa-lbl" for="qa-in">${mine ? '修改你的答案' : '你的答案'}</label><textarea id="qa-in" maxlength="140" rows="3" placeholder="想到什麼就寫什麼…">${esc(mine)}</textarea>
    <p class="qa-hint">${theirs ? `🔒 ${pn} 已經回答了，你答完就看得到` : `答完後，等 ${pn} 也回答，就能看到彼此的答案`}</p><button type="button" class="primary" id="qa-send">${mine ? '儲存' : '送出答案'}</button>`;
  else if (!theirs) html += `<div class="qa-ans me"><b>你</b><p>${esc(mine)}</p></div><div class="qa-ans lock"><b>${pn}</b><p>🔒 還沒回答，等 ${pn} 答完就看得到</p></div>
    <div class="qa-row">${MP.on ? `<button type="button" class="ghost" id="qa-poke">提醒 ${pn}</button>` : ''}<button type="button" class="ghost" id="qa-edit">修改答案</button></div>`;
  else html += `<div class="qa-ans me"><b>你</b><p>${esc(mine)}</p>${e.h?.[j] ? `<em>💗 ${pn} 喜歡你的答案</em>` : ''}</div>
    <div class="qa-ans you"><b>${pn}</b><p>${esc(theirs)}</p><button type="button" class="qa-heart${e.h?.[i] ? ' on' : ''}" id="qa-heart" aria-pressed="${!!e.h?.[i]}" aria-label="喜歡這個答案">♥</button></div>
    <p class="qa-hint">明天會有新的問題 ✨</p>`;
  if (mine && theirs && st.qaSeen !== d) { st.qaSeen = d; save(); setTimeout(qaBadge, 0); }
  const past = Object.keys(st.qa || {}).filter(k => k !== d && qaBoth(st.qa[k])).sort().reverse().slice(0, 40);
  if (past.length) html += `<details class="qa-hist"><summary>我們的問答紀錄（${past.length}）</summary>${past.map(k => { const x = st.qa[k], qq = QUESTIONS[x.q] || QUESTIONS[0]; return `<div class="qa-old"><small>${Number(k.slice(5, 7))}/${Number(k.slice(8))}・${esc((QA_CATS[qq[0]] || QA_CATS.s)[0])}</small><b>${esc(qq[1])}</b><p><span>${esc(nameOf(0))}</span>${esc(x.a[0])}</p><p><span>${esc(nameOf(1))}</span>${esc(x.a[1])}</p></div>`; }).join('')}</details>`;
  openDlg('💞 今日問答', html); $('#dlg').dataset.qa = '1';
  const inp = $('#qa-in'); if (inp && !keep) setTimeout(() => inp.focus({ preventScroll: true }), 250);
  $('#qa-send')?.addEventListener('click', () => { const t = inp.value.trim(); if (!t) { inp.focus(); toast('寫點什麼再送出吧'); return; } qaAnswer(t); openQA(true); });
  $('#qa-edit')?.addEventListener('click', () => openQA('edit'));
  $('#qa-poke')?.addEventListener('click', () => { MP.net.send({ t: 'nudge', k: 'qa' }); $('#qa-poke').disabled = true; });
  $('#qa-heart')?.addEventListener('click', () => { const on = !e.h?.[i]; e.h = e.h || [0, 0]; e.h[i] = on ? 1 : 0; save(); if (MP.on) MP.net.send({ t: 'qa', d, q: e.q, h: on ? 1 : 0 }); if (on) { burst('heart', headPos(me(), 1.4), 6, 0.3); sfx('pop'); } openQA(true); });
}
/* 以前某一天的問答（從回憶本點進來） */
function openQADay(d) {
  const e = st.qa?.[d], q = e ? QUESTIONS[e.q] || QUESTIONS[0] : QUESTIONS[qaIdx(d)], cat = QA_CATS[q[0]] || QA_CATS.s, i = myIdx(), j = 1 - i;
  const ans = (k, who) => `<div class="qa-ans ${k === i ? 'me' : 'you'}"><b>${esc(who)}</b><p>${e?.a?.[k] ? esc(e.a[k]) : '（這天沒有回答）'}</p></div>`;
  openDlg('💞 我們的問答', `<div class="qa-card" style="--qc:${cat[1]}"><span class="qa-cat">${cat[0]}</span><p class="qa-q">${esc(q[1])}</p><small>${Number(d.slice(5, 7))} 月 ${Number(d.slice(8))} 日</small></div>${ans(i, '你')}${ans(j, partnerName())}<button type="button" class="ghost" id="qa-today">看今天的問題</button>`);
  $('#qa-today').onclick = () => openQA();
}
// 每天第一次打開小島：還沒回答就輕輕提醒一次
let qaNagged = ''; setInterval(() => qaNag(), 15000);
function qaNag() { const d = twDate(); if (qaNagged === d || !qaTodo() || !started() || act || $('#dlg').open || !$('#coach').hidden) return; qaNagged = d; toast(`💞 今日問答：「${qaQ(d)[1].slice(0, 18)}…」點這裡回答`, 7000, () => openQA()); }
// 手機通知（推播）
function b64toU8(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }
function iosPushGuide() {
  openDlg('📳 iPhone 開啟手機通知', `<p>iPhone 要先把小島放到主畫面，才能收到通知：</p>
    <ol class="steps"><li>用 <b>Safari</b> 打開小島</li><li>按下面的「分享」按鈕 <b>⬆️</b></li><li>往下找「<b>加入主畫面</b>」</li><li>從主畫面上的小島圖示打開，再到 🌐 打開「手機通知」</li></ol>
    <p class="muted">需要 iOS 16.4 以上。</p>`);
}
async function setPush(on) {
  if (!MP.on || MP.role === 'g') return toast('先在 🌐 建立或加入小島');
  const reg = await navigator.serviceWorker?.getRegistration?.().catch(() => null);
  if (!on) {
    try { const s = await reg?.pushManager.getSubscription(); if (s) { MP.net.send({ t: 'pushsub', on: false, sub: s.toJSON() }); await s.unsubscribe(); } } catch (e) {}
    st.pushOn = false; save(); toast('這支手機不會再收到通知'); return openNet();
  }
  if (isIOS && !standalone()) return iosPushGuide();
  if (!reg || !('PushManager' in window) || !('Notification' in window)) return toast('這個瀏覽器不支援手機通知');
  const perm = await Notification.requestPermission(); if (perm !== 'granted') return toast('通知被關掉了，可以到手機的設定裡打開');
  try {
    const { key } = await (await fetch('api/vapid', { method: 'POST', body: '{}' })).json();
    const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64toU8(key) }));
    MP.net.send({ t: 'pushsub', on: true, sub: sub.toJSON() }); st.pushOn = true; save(); openNet();
  } catch (e) { toast('開啟通知失敗，請稍後再試'); }
}
// 連上島時：更新這支手機的推播訂閱（推播服務有時會換網址）
function refreshPush() {
  if (!st.pushOn || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  navigator.serviceWorker?.ready.then(r => r.pushManager.getSubscription()).then(s => { if (s && MP.on) MP.net.send({ t: 'pushsub', on: true, sub: s.toJSON() }); }).catch(() => {});
}
// 你不在的時候：另一半貼的便利貼、做的事
function checkAway() {
  if (MP.role === 'g') return; const other = 1 - myIdx(), since = st.awaySeen || 0;
  const notes = (st.notes || []).filter(n => n.by === other && n.ts > (st.noteSeen || 0));
  const memos = since ? st.diary.filter(m => m.by === other && m.ts > since).slice(0, 6) : [];
  st.awaySeen = Date.now(); st.noteSeen = Date.now(); save();
  if (!notes.length && !memos.length) return;
  openDlg(`💌 ${esc(nameOf(other))} 留給你的`, `${notes.length ? `<div class="notes">${notes.map(n => `<div class="note" style="background:${NOTE_COL[n.ts % 4]}"><p>${esc(n.text)}</p><small>${ago(n.ts)}</small></div>`).join('')}</div>` : ''}
    ${memos.length ? `<b>你不在的時候</b>${memos.map(m => `<div class="memo"><span class="ic">${m.icon}</span><b>${esc(m.text)}</b><small>${ago(m.ts)}</small></div>`).join('')}` : ''}
    <div class="row"><button type="button" class="ghost" id="aw-reply">📝 回一張便利貼</button><button type="button" class="primary" id="aw-ok">好 ♥</button></div>`);
  $('#aw-ok').onclick = () => $('#dlg').close(); $('#aw-reply').onclick = openNotes; sfx('chime');
}

// ================= 每日驚喜 =================
const BOTTLE2 = ['「給撿到這封信的戀人：\n要記得常常說謝謝，也要常常說我愛你。」', '「我們在一起五十年了。\n秘訣是：吵架不過夜，早餐輪流做。」', '「今天的海很藍，\n希望你們的每一天也一樣。」', '「如果有一天迷路了，\n就回到最初牽手的地方。」', '「願你們把平凡的日子，\n過成想珍藏的回憶。」'];
// ================= 每日驚喜：一天三個（早上 5–12、下午 12–18、晚上 18–5），兩個人看到的一樣 =================
// kind：find＝島上多了東西或動物要去找；buff＝今天的好運（自動生效）。at：出現在哪一帶。r：獎勵
// slot：m 早上、a 下午、e 晚上可以出現；season／wx：只在某個季節、天氣
const SURPRISES = [
  { k: 'gift', icon: '🎁', name: '門口的小包裹', tip: '小木屋門口多了一個包裹', obj: 'gift', at: 'door', slot: 'mae', r: { c: 15, l: 2, item: 'cheap' }, memo: '收到一個小包裹' },
  { k: 'bottle', icon: '🍾', name: '海邊的瓶中信', tip: '沙灘上漂來一個瓶子，裡面好像有信', obj: 'bottle', at: 'beach', slot: 'ma', r: { c: 8, l: 2, letter: 'bottle' }, memo: '在沙灘撿到一封瓶中信' },
  { k: 'loveletter', icon: '💌', name: '信箱旁的情書', tip: '信箱旁邊掉了一封粉紅色的信', obj: 'letter', at: 'mailbox', slot: 'mae', r: { c: 10, l: 3, letter: 'love' }, memo: '撿到一封沒有署名的情書' },
  { k: 'bouquet', icon: '💐', name: '野花花束', tip: '菜園旁邊有人留了一束野花', obj: 'bouquet', at: 'garden', slot: 'ma', r: { c: 10, l: 3 }, open: '一束剛摘的野花，綁著緞帶。拿回家插在餐桌上吧。', memo: '收到一束野花' },
  { k: 'chest', icon: '🧰', name: '沙灘上的寶箱', tip: '退潮後沙灘上露出一個小寶箱', obj: 'chest', at: 'beach', slot: 'a', r: { c: [30, 70], l: 2 }, open: '寶箱打開，裡面是閃閃發亮的小島幣！', memo: '在沙灘挖到寶箱' },
  { k: 'balloon', icon: '🎈', name: '飄來的愛心氣球', tip: '一顆愛心氣球卡在鞦韆上', obj: 'balloon', at: 'swing', slot: 'a', r: { c: 10, l: 4 }, open: '氣球上寫著：「要一直一直在一起喔」', memo: '抓到一顆愛心氣球' },
  { k: 'cake', icon: '🍰', name: '野餐墊上的小蛋糕', tip: '野餐墊上不知道誰放了兩塊小蛋糕', obj: 'cake', at: 'picnic', slot: 'a', r: { c: 8, l: 4 }, open: '剛好兩塊，一人一塊。是草莓口味的！', memo: '一起分吃了小蛋糕' },
  { k: 'berries', icon: '🍓', name: '一籃草莓', tip: '菜園邊多了一籃新鮮草莓', obj: 'basket', at: 'garden', slot: 'm', r: { c: 15, l: 2 }, open: '紅通通的草莓，甜到心裡。', memo: '收到一籃草莓' },
  { k: 'glowshell', icon: '🐚', name: '發光的貝殼', tip: '沙灘上有一顆貝殼在晚上發著光', obj: 'shell', at: 'beach', slot: 'e', r: { c: 25, l: 3 }, open: '貝殼裡面藏著一點點星光。放在耳邊，聽得到海浪聲。', memo: '撿到會發光的貝殼' },
  { k: 'seeds', icon: '🌱', name: '神秘的種子', tip: '菜園邊多了一包沒寫名字的種子', obj: 'seed', at: 'garden', slot: 'm', r: { c: 5, l: 2, item: 'sunflower' }, open: '種下去，長出來的是一朵向日葵！已經放進擺設裡了。', memo: '種出了神秘的向日葵' },
  { k: 'strawhat', icon: '👒', name: '被風吹來的草帽', tip: '海風把一頂草帽吹到沙灘上', obj: 'hat', at: 'beach', slot: 'a', r: { c: 12, l: 2 }, open: '帽簷上別著一朵小花，好像是誰的夏天回憶。', memo: '撿到一頂草帽' },
  { k: 'lantern', icon: '🏮', name: '漂來的小燈籠', tip: '海邊漂來一盞亮著的小燈籠', obj: 'lantern', at: 'beach', slot: 'e', r: { c: 10, l: 4 }, open: '燈籠上寫著：「願你們平安喜樂」。', memo: '撿到一盞漂來的燈籠' },
  { k: 'camera', icon: '📷', name: '燈塔下的舊相機', tip: '燈塔下面有一台舊底片相機', obj: 'camera', at: 'lighthouse', slot: 'a', r: { c: 20, l: 2 }, open: '還剩一張底片。用它拍下今天的你們吧。', memo: '撿到一台舊相機' },
  { k: 'fallenstar', icon: '⭐', name: '掉下來的星星', tip: '燈塔那邊的山坡上，有一顆星星掉下來了', obj: 'star', at: 'lighthouse', slot: 'e', r: { c: 30, l: 5 }, open: '星星暖暖的，握在手心會發光。許個願吧。', memo: '撿到一顆掉下來的星星' },
  { k: 'clover', icon: '🍀', name: '四葉草', tip: '草地上長了一株四葉草，找找看', obj: 'clover', at: 'grass', slot: 'm', r: { c: 20, l: 3 }, open: '找到了！聽說找到四葉草的人，今天會特別幸運。', memo: '找到一株四葉草' },
  { k: 'cookie', icon: '🍪', name: '狗狗叼來的餅乾', tip: '狗狗好像藏了一塊餅乾要給你', obj: 'cookie', at: 'door', slot: 'm', r: { c: 5, l: 3 }, open: '狗狗把餅乾推到你腳邊，尾巴搖個不停。', memo: '狗狗送了一塊餅乾' },
  { k: 'umbrella', icon: '☂️', name: '被忘記的傘', tip: '路邊有一把被忘記的傘', obj: 'umbrella', at: 'grass', slot: 'mae', wx: 'rain', r: { c: 15, l: 3 }, open: '傘柄上綁著紙條：「下雨天，要撐同一把傘」。', memo: '撿到一把傘' },
  { k: 'kite', icon: '🪁', name: '卡在樹上的風箏', tip: '愛情樹旁邊卡著一只風箏', obj: 'kite', at: 'tree', slot: 'a', r: { c: 12, l: 2 }, open: '把風箏拿下來，尾巴上寫著兩個名字的縮寫。', memo: '救下一只卡住的風箏' },
  { k: 'cocoa', icon: '☕', name: '冒著熱氣的可可', tip: '門口放了兩杯熱可可，還在冒煙', obj: 'mug', at: 'door', slot: 'm', season: ['autumn', 'winter'], r: { c: 8, l: 4 }, open: '兩杯熱可可，上面還有棉花糖。一起喝吧。', memo: '一起喝了門口的熱可可' },
  { k: 'moonstone', icon: '🌙', name: '月光石', tip: '月光照到的地方，有一顆石頭在發光', obj: 'stone', at: 'grass', slot: 'e', r: { c: 40, l: 2 }, open: '月光石摸起來涼涼的，只在晚上發光。', memo: '撿到一顆月光石' },
  { k: 'bracelet', icon: '📿', name: '沙灘上的手環', tip: '沙灘上有兩條一樣的手環', obj: 'ring', at: 'beach', slot: 'a', r: { c: 10, l: 5 }, open: '剛好兩條，一人一條，就是情侶手環了。', memo: '撿到一對情侶手環' },
  { k: 'snowglobe', icon: '🔮', name: '雪花球', tip: '門口有一顆雪花球，裡面是我們的小島', obj: 'globe', at: 'door', slot: 'mae', season: ['winter'], r: { c: 15, l: 4 }, open: '搖一搖，小島上下起了雪。', memo: '收到一顆雪花球' },
  { k: 'pinecone', icon: '🌰', name: '松果', tip: '秋天的樹下掉了一顆大松果', obj: 'cone', at: 'tree', slot: 'ma', season: ['autumn'], r: { c: 15, l: 2 }, open: '圓滾滾的松果，可以放在窗台當裝飾。', memo: '撿到一顆大松果' },
  { k: 'seaglass', icon: '💎', name: '海玻璃', tip: '浪退的地方有一片藍綠色的海玻璃', obj: 'glass', at: 'beach', slot: 'm', r: { c: 18, l: 2 }, open: '被海浪磨了很多年，摸起來圓圓的。', memo: '撿到一片海玻璃' },
  { k: 'postcard', icon: '🪧', name: '遠方的明信片', tip: '信箱裡多了一張明信片', obj: 'postcard', at: 'mailbox', slot: 'm', r: { c: 10, l: 2, letter: 'postcard' }, memo: '收到一張遠方的明信片' },
  { k: 'wishjar', icon: '🫙', name: '星星許願瓶', tip: '燈塔旁有一個裝滿小星星的瓶子', obj: 'jar', at: 'lighthouse', slot: 'e', r: { c: 10, l: 4, wish: true }, memo: '在許願瓶裡放了一個願望' },
  { k: 'sandheart', icon: '❤️', name: '沙灘上的愛心', tip: '有人在沙灘上畫了一個大愛心', obj: 'sandheart', at: 'beach', slot: 'm', r: { c: 5, l: 5 }, open: '大大的愛心裡面，寫著你們兩個的名字。', memo: '在沙灘上發現一顆大愛心' },
  { k: 'butterfly', icon: '🦋', name: '停在花上的蝴蝶', tip: '菜園的花上停了一隻藍色的蝴蝶', obj: 'butterfly', at: 'garden', slot: 'a', season: ['spring', 'summer'], r: { c: 8, l: 3 }, open: '蝴蝶繞著你飛了一圈，才飛走。', memo: '遇到一隻藍色的蝴蝶' },
  { k: 'feather', icon: '🪶', name: '海鷗的羽毛', tip: '碼頭上掉了一根白色的羽毛', obj: 'feather', at: 'dock', slot: 'a', r: { c: 8, l: 2 }, open: '輕輕的羽毛。夾在回憶本裡當書籤吧。', memo: '撿到一根海鷗羽毛' },
  { k: 'musicbox', icon: '🎼', name: '音樂盒', tip: '營火旁邊放著一個小音樂盒', obj: 'musicbox', at: 'campfire', slot: 'e', r: { c: 12, l: 4 }, open: '打開音樂盒，響起一首很溫柔的曲子。一起聽完它吧。', memo: '一起聽了音樂盒的曲子' },
  { k: 'basketpicnic', icon: '🧺', name: '準備好的野餐籃', tip: '櫻花樹下有一個準備好的野餐籃', obj: 'basket', at: 'picnic', slot: 'a', r: { c: 15, l: 3, food: ['雞蛋', 2] }, open: '裡面有三明治、水果，還有兩顆雞蛋（已經放進冰箱）。', memo: '收到一個野餐籃' },
  { k: 'future', icon: '✉️', name: '未來寄來的信', tip: '信箱裡有一封日期寫著「一年後」的信', obj: 'letter', at: 'mailbox', slot: 'm', r: { c: 10, l: 4, letter: 'future' }, memo: '收到一封未來寄來的信' },
  { k: 'rose', icon: '🌹', name: '門口的一朵玫瑰', tip: '小木屋門口放著一朵玫瑰', obj: 'rose', at: 'door', slot: 'e', r: { c: 8, l: 5 }, open: '玫瑰上的小卡片寫著：「今天也很喜歡你」。', memo: '門口出現一朵玫瑰' },
  { k: 'compass', icon: '🧭', name: '舊羅盤', tip: '碼頭的木板縫裡卡著一個舊羅盤', obj: 'compass', at: 'dock', slot: 'a', r: { c: 25, l: 2 }, open: '羅盤的指針沒有指北，一直指著小木屋的方向。', memo: '撿到一個奇怪的羅盤' },
  { k: 'float', icon: '🔵', name: '漂來的玻璃浮球', tip: '碼頭邊漂來一顆藍色的玻璃浮球', obj: 'float', at: 'dock', slot: 'm', r: { c: 20, l: 2 }, open: '老漁夫用的玻璃浮球，在陽光下好漂亮。', memo: '撿到一顆玻璃浮球' },
  { k: 'candles', icon: '🕯️', name: '沙灘上的蠟燭愛心', tip: '沙灘上有人用蠟燭排了一個愛心', obj: 'candles', at: 'beach', slot: 'e', r: { c: 10, l: 6 }, open: '蠟燭排成的愛心在海風裡搖曳。坐下來待一會兒吧。', memo: '在蠟燭愛心旁邊待了一會兒' },
  { k: 'crane', icon: '🕊️', name: '紙鶴', tip: '吊床上停著一隻紙鶴', obj: 'crane', at: 'hammock', slot: 'a', r: { c: 10, l: 3 }, open: '紙鶴的翅膀內側寫著：「謝謝你出現在我的生命裡」。', memo: '在吊床上發現一隻紙鶴' },
  { k: 'honey', icon: '🍯', name: '蜂蜜罐', tip: '雞舍旁邊多了一罐蜂蜜', obj: 'honey', at: 'coop', slot: 'm', r: { c: 15, l: 2 }, open: '金黃色的蜂蜜，抹在鬆餅上一定很好吃。', memo: '收到一罐蜂蜜' },
  { k: 'bunny', icon: '🐰', name: '迷路的小兔子', tip: '有隻小兔子迷路到小島上了，去找找牠吧', animal: 'rabbit', at: 'grass', slot: 'ma', r: { c: 10, l: 3 }, memo: '摸了迷路的小兔子' },
  { k: 'duck', icon: '🦆', name: '小鴨來散步', tip: '一隻小鴨子跑來島上散步', animal: 'duck', at: 'grass', slot: 'ma', r: { c: 10, l: 3 }, memo: '遇到來散步的小鴨子' },
  { k: 'kitty', icon: '🐈', name: '流浪貓來拜訪', tip: '一隻橘貓跑來島上，好像在找人', animal: 'cat-base', at: 'grass', slot: 'ae', r: { c: 10, l: 3 }, memo: '摸到來拜訪的橘貓' },
  { k: 'crabs', icon: '🦀', name: '寄居蟹搬家', tip: '沙灘上有一隻寄居蟹正在找新家', animal: 'hermit-crab-base', at: 'beach', slot: 'a', r: { c: 12, l: 2 }, memo: '幫寄居蟹找到新家' },
  { k: 'chick', icon: '🐔', name: '逃家的母雞', tip: '有一隻母雞跑出雞舍了，把牠找回來', animal: 'chicken-base', at: 'grass', slot: 'm', r: { c: 12, l: 2, food: ['雞蛋', 1] }, memo: '把逃家的母雞帶回來' },
  { k: 'gullmail', icon: '🐦', name: '送信的海鷗', tip: '一隻海鷗叼著信停在碼頭', animal: 'herring-gull-base', at: 'dock', slot: 'm', r: { c: 10, l: 2, letter: 'postcard' }, memo: '海鷗送來一封信' },
  { k: 'fish', icon: '🐟', name: '魚群日', tip: '今天碼頭魚群很多，魚比較快上鉤', buff: 1, slot: 'm' },
  { k: 'egg', icon: '🥚', name: '母雞好心情', tip: '母雞們今天心情很好，多下了兩顆蛋', buff: 1, slot: 'm' },
  { k: 'meteor', icon: '🌠', name: '流星雨之夜', tip: '今晚燈塔那邊會有很多流星', buff: 1, slot: 'e' },
  { k: 'golden', icon: '✨', name: '金色時光', tip: '這段時間做事拿到的小島幣加倍', buff: 1, slot: 'a' },
  { k: 'shellday', icon: '🐚', name: '貝殼大潮', tip: '大潮過後，沙灘上的貝殼特別多', buff: 1, slot: 'm' },
  { k: 'lucky', icon: '🍀', name: '幸運日', tip: '今天特別幸運，比較容易釣到稀有的魚', buff: 1, slot: 'ma' },
  { k: 'sweetday', icon: '💗', name: '甜蜜加倍', tip: '今天的甜蜜值上限多 20', buff: 1, slot: 'e' },
  { k: 'breeze', icon: '🌬️', name: '好風日', tip: '海風剛剛好，風箏可以飛到最高', buff: 1, slot: 'a' },
  { k: 'concert', icon: '🎶', name: '營火音樂會', tip: '今晚在營火邊彈吉他，甜蜜值多一點', buff: 1, slot: 'e' },
  { k: 'chef', icon: '🍳', name: '主廚日', tip: '今天做料理拿到的小島幣加倍', buff: 1, slot: 'ma' },
  { k: 'heartcloud', icon: '☁️', name: '愛心雲', tip: '抬頭看看天空，有一朵愛心形狀的雲', buff: 1, slot: 'ma', sky: 'heart' },
  { k: 'fireflies', icon: '✨', name: '螢火蟲之夜', tip: '今晚螢火蟲特別多，去草地看看', buff: 1, slot: 'e', season: ['spring', 'summer'] },
  { k: 'starry', icon: '🌌', name: '銀河之夜', tip: '今晚的星星特別多，抬頭就看得到銀河', buff: 1, slot: 'e', wx: 'clear' },
];
const LETTERS2 = {
  bottle: () => BOTTLE2,
  love: () => ['「每次看到你笑，\n我就覺得這座島是對的地方。」', '「你不知道，\n你說晚安的聲音，是我一天最期待的。」', '「如果可以，\n我想跟你一起看完每一個季節。」', '「謝謝你，\n讓平凡的日子都變成了紀念日。」'],
  postcard: () => ['「這裡的雪好大，\n但我想起你們島上的夏天就不冷了。—— 北海道」', '「看到一對老夫妻牽手散步，\n祝你們也一樣。—— 京都」', '「夕陽好美，\n可惜身邊少了一個人。—— 巴黎」', '「海是同一片海，\n祝你們每天都好。—— 墾丁」'],
  future: () => ['「一年後的你們：\n還是每天說早安晚安嗎？我猜是的。」', '「嘿，一年後的我們，\n記得今天的你們有多喜歡彼此。」', '「給未來的我們：\n不管發生什麼，都要一起回到這座島。」'],
};
const dayHash = d => { let x = (d * 2654435761) >>> 0; x ^= x >>> 13; return (x * 1274126177) >>> 0; };
const SLOT_NAMES = ['早上', '下午', '晚上'], SLOT_KEY = 'mae';
const slotNow = () => st.tod >= 5 && st.tod < 12 ? 0 : st.tod >= 12 && st.tod < 18 ? 1 : 2;
const surDay = () => st.tod < 5 ? st.day - 1 : st.day; /* 半夜 0–5 點還算前一天的晚上 */
/* 某一天某個時段的驚喜：依季節、天氣挑，兩支手機算出來一樣，同一天三個不重複 */
function surpriseAt(day, slot) {
  const s = seasonOf(day).k, used = [];
  for (let i = 0; i <= slot; i++) {
    const wx = weatherAt(day, i === 0 ? 8 : i === 1 ? 14 : 20).kind;
    const pool = SURPRISES.filter(x => x.slot.includes(SLOT_KEY[i]) && (!x.season || x.season.includes(s)) && (!x.wx || x.wx === wx) && !used.includes(x));
    used.push(pool[dayHash(day * 3 + i + 11) % pool.length]);
  }
  return used[slot];
}
const surpriseNow = () => surpriseAt(surDay(), slotNow());
const surpriseToday = surpriseNow;
const surDone = slot => st.surprise?.day === surDay() && !!st.surprise.done?.[slot];
const surpriseDone = () => surDone(slotNow());
/* buff：今天已經到了的時段裡有這個好運就生效 */
const surpriseIs = k => [0, 1, 2].some(i => i <= slotNow() && surpriseAt(surDay(), i).k === k);
const SUR = { obj: null, a: null, day: 0, slot: -1, sky: null };
function clearSurprise() { if (SUR.a) { OUT.remove(SUR.a.o); const i = animals.indexOf(SUR.a); if (i >= 0) animals.splice(i, 1); } else if (SUR.obj) OUT.remove(SUR.obj); SUR.obj = SUR.a = null; }
/* 驚喜出現的地方 */
function surSpot(at, seed) {
  const R = n => (dayHash(seed + n) % 1000) / 1000;
  const near = (p, r = 1.6) => [p.x + (R(1) - 0.5) * r * 2, p.z + (R(2) - 0.5) * r * 2];
  let x, z;
  if (at === 'beach') { const a = R(3) * Math.PI * 2, rr = shoreR(Math.cos(a), Math.sin(a)) - 9.4; x = Math.cos(a) * rr; z = Math.sin(a) * rr; if (x > 24 && Math.abs(z) < 4) { x = -x; } }
  else if (at === 'grass') { const a = R(3) * Math.PI * 2, rr = 5 + R(4) * 12; x = Math.cos(a) * rr; z = Math.sin(a) * rr; }
  else if (at === 'dock') { x = SPOTS.fishing.x - 4 - R(5) * 6; z = (R(6) - 0.5) * 1.2; }
  else if (at === 'tree') [x, z] = near({ x: TREE.x, z: TREE.z + 1.6 }, 1.2);
  else if (at === 'lighthouse') [x, z] = near({ x: SPOTS.sunset.x + 1.6, z: SPOTS.sunset.z + 1 }, 1.4);
  else if (at === 'door') [x, z] = near({ x: SPOTS.door.x + 1.4, z: SPOTS.door.z + 0.8 }, 0.8);
  else { const P = SPOTS[at] || SPOTS.door; [x, z] = near({ x: P.x, z: P.z + 1.4 }, 1.4); }
  if (!onDock(x, z) && !walkable(x, z)) [x, z] = freeSpot(x, z); else if (!onDock(x, z)) [x, z] = freeSpot(x, z);
  return [x, z];
}
/* 驚喜的小東西：用簡單的形狀拼出來，頭上有一顆閃亮的星星提示 */
function surObj(type) {
  const g = new THREE.Group(), M = c => toon(c), add = (geo, c, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, e) => { const m = new THREE.Mesh(geo, e ? new THREE.MeshBasicMaterial({ color: c }) : M(c)); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); return m; };
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d), S = r => new THREE.SphereGeometry(r, 14, 10), C = (r1, r2, h, n = 12) => new THREE.CylinderGeometry(r1, r2, h, n);
  switch (type) {
    case 'gift': add(B(0.42, 0.34, 0.42), '#ff9ab8', 0, 0.17); add(B(0.44, 0.35, 0.08), '#fff6d6', 0, 0.17); add(B(0.08, 0.35, 0.44), '#fff6d6', 0, 0.17); add(S(0.08), '#fff6d6', 0, 0.38); break;
    case 'bottle': add(C(0.09, 0.11, 0.42), '#9fd6c8', 0, 0.09, 0, 0, 0, Math.PI / 2 - 0.25); add(C(0.04, 0.04, 0.08, 8), '#a0703e', 0.24, 0.13, 0, 0, 0, Math.PI / 2 - 0.25); break;
    case 'letter': case 'postcard': add(B(0.42, 0.03, 0.3), type === 'letter' ? '#ffe4ec' : '#fff6e0', 0, 0.03); add(B(0.1, 0.035, 0.1), '#e8506a', 0, 0.05, 0, 0, Math.PI / 4); break;
    case 'bouquet': add(C(0.05, 0.03, 0.36, 8), '#5a9a4a', 0, 0.18, 0, 0, 0, 0.3); ['#ff8aa8', '#ffd25a', '#ffffff', '#c89aff', '#ff6a6a'].forEach((c, i) => add(S(0.08), c, -0.12 + Math.cos(i) * 0.1, 0.38 + Math.sin(i * 2) * 0.05, Math.sin(i) * 0.1)); add(B(0.14, 0.06, 0.14), '#ff9ab8', -0.04, 0.22); g.rotation.z = -0.3; break;
    case 'chest': add(B(0.5, 0.3, 0.34), '#a0683a', 0, 0.15); add(C(0.17, 0.17, 0.5, 12), '#b8784a', 0, 0.3, 0, 0, 0, Math.PI / 2); add(B(0.08, 0.12, 0.04), '#ffd25a', 0, 0.28, 0.18); break;
    case 'balloon': { add(C(0.004, 0.004, 1.4, 4), '#ffffff', 0, 0.7); const h = add(S(0.22), '#ff5d88', 0, 1.55); h.scale.set(1, 1.15, 0.9); break; }
    case 'cake': [-0.14, 0.14].forEach(x => { add(C(0.12, 0.12, 0.14, 3), '#fff1d8', x, 0.07); add(S(0.04), '#ff4060', x, 0.17); }); add(C(0.32, 0.32, 0.02, 20), '#ffffff', 0, 0.01); break;
    case 'basket': add(C(0.2, 0.15, 0.2, 12), '#c8945a', 0, 0.1); for (let i = 0; i < 6; i++) add(S(0.06), i % 2 ? '#ff3a4a' : '#ff6a6a', Math.cos(i) * 0.1, 0.22, Math.sin(i) * 0.1); add(new THREE.TorusGeometry(0.17, 0.015, 6, 16, Math.PI), '#a0703e', 0, 0.2); break;
    case 'shell': add(S(0.13), '#ffe6f4', 0, 0.06).scale.y = 0.45; add(S(0.05), '#bff4ff', 0, 0.1, 0, 0, 0, 0, true); break;
    case 'seed': add(B(0.22, 0.3, 0.03), '#e8d0a0', 0, 0.15); add(S(0.05), '#5a9a4a', 0, 0.2, 0.02); break;
    case 'hat': add(C(0.3, 0.3, 0.02, 20), '#f2d48a', 0, 0.02); add(C(0.14, 0.16, 0.14, 16), '#f2d48a', 0, 0.09); add(C(0.165, 0.165, 0.04, 16), '#ff8aa8', 0, 0.05); break;
    case 'lantern': add(C(0.14, 0.12, 0.3, 10), '#ffb35c', 0, 0.2, 0, 0, 0, 0, true); add(C(0.15, 0.15, 0.03, 10), '#8a4a2a', 0, 0.36); add(C(0.13, 0.13, 0.03, 10), '#8a4a2a', 0, 0.05); break;
    case 'camera': add(B(0.3, 0.18, 0.12), '#3a3a40', 0, 0.09); add(C(0.06, 0.06, 0.08, 14), '#c8c8d0', 0, 0.09, 0.09, Math.PI / 2); add(B(0.08, 0.04, 0.06), '#c8c8d0', -0.08, 0.2); break;
    case 'star': { const s = add(new THREE.OctahedronGeometry(0.2), '#fff2a0', 0, 0.3, 0, 0, 0, 0, true); s.scale.set(1, 1, 0.5); break; }
    case 'clover': add(C(0.01, 0.01, 0.18, 4), '#4a8a3a', 0, 0.09); [0, 1, 2, 3].forEach(i => add(S(0.06), '#5ac85a', Math.cos(i * Math.PI / 2) * 0.06, 0.19, Math.sin(i * Math.PI / 2) * 0.06).scale.y = 0.3); break;
    case 'cookie': add(C(0.12, 0.12, 0.04, 16), '#d8a060', 0, 0.02); [0, 1, 2].forEach(i => add(S(0.02), '#5a3020', Math.cos(i * 2) * 0.06, 0.045, Math.sin(i * 2) * 0.06)); break;
    case 'umbrella': add(C(0.01, 0.01, 0.9, 6), '#5a4030', 0.1, 0.12, 0, 0, 0, 1.2); add(new THREE.SphereGeometry(0.4, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#7ab8ff', -0.25, 0.22, 0, 0, 0, 1.2); break;
    case 'mug': [-0.1, 0.1].forEach(x => { add(C(0.07, 0.06, 0.14, 12), '#fff6ea', x, 0.07); add(C(0.06, 0.06, 0.01, 12), '#7a4a2a', x, 0.14); }); break;
    case 'stone': add(new THREE.IcosahedronGeometry(0.13, 0), '#bfe8ff', 0, 0.1, 0, 0, 0, 0, true); break;
    case 'ring': [-0.08, 0.08].forEach(x => add(new THREE.TorusGeometry(0.09, 0.02, 8, 18), '#ff9ab8', x, 0.02, 0, Math.PI / 2)); break;
    case 'globe': add(S(0.16), '#cfefff', 0, 0.22); add(C(0.14, 0.16, 0.08, 14), '#8a5a3a', 0, 0.04); break;
    case 'cone': add(new THREE.ConeGeometry(0.1, 0.24, 8), '#8a5a3a', 0, 0.12); break;
    case 'glass': add(new THREE.DodecahedronGeometry(0.09), '#7ad8c8', 0, 0.05).scale.y = 0.4; break;
    case 'jar': add(C(0.12, 0.12, 0.26, 14), '#d8f0ff', 0, 0.13); add(C(0.08, 0.08, 0.05, 12), '#a0703e', 0, 0.28); for (let i = 0; i < 5; i++) add(S(0.03), '#fff2a0', Math.cos(i) * 0.05, 0.08 + i * 0.03, Math.sin(i) * 0.05, 0, 0, 0, true); break;
    case 'sandheart': { const sh = new THREE.Shape(); sh.moveTo(0, -0.7); sh.bezierCurveTo(-0.1, -0.56, -0.9, -0.1, -0.9, 0.34); sh.bezierCurveTo(-0.9, 0.76, -0.44, 0.94, 0, 0.6); sh.bezierCurveTo(0.44, 0.94, 0.9, 0.76, 0.9, 0.34); sh.bezierCurveTo(0.9, -0.1, 0.1, -0.56, 0, -0.7);
      const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color: '#d8b888' })); m.rotation.x = -Math.PI / 2; m.position.y = 0.03; g.add(m); const m2 = m.clone(); m2.material = new THREE.MeshBasicMaterial({ color: '#f2dcb4' }); m2.scale.setScalar(0.82); m2.position.y = 0.035; g.add(m2); break; }
    case 'butterfly': add(C(0.01, 0.01, 0.4, 4), '#4a8a3a', 0, 0.2); add(S(0.07), '#ffd25a', 0, 0.42); [-1, 1].forEach(s => add(B(0.12, 0.01, 0.1), '#5aa8ff', s * 0.07, 0.5, 0, 0, 0, s * 0.5)); break;
    case 'feather': add(B(0.06, 0.01, 0.34), '#ffffff', 0, 0.02, 0, 0, 0.6); break;
    case 'musicbox': add(B(0.28, 0.16, 0.2), '#c8784a', 0, 0.08); add(B(0.28, 0.02, 0.2), '#ffd25a', 0, 0.17); break;
    case 'rose': add(C(0.01, 0.01, 0.4, 4), '#3a7a3a', 0, 0.2, 0, 0, 0, 1.3); add(S(0.07), '#e8203a', 0.2, 0.06); break;
    case 'compass': add(C(0.12, 0.12, 0.04, 18), '#c8a04a', 0, 0.02); add(C(0.1, 0.1, 0.01, 18), '#fff6e0', 0, 0.045); add(B(0.02, 0.01, 0.16), '#e8203a', 0, 0.05); break;
    case 'float': add(S(0.16), '#5aa8e8', 0, 0.14); break;
    case 'candles': for (let i = 0; i < 14; i++) { const t = i / 14 * Math.PI * 2, x = 16 * Math.sin(t) ** 3 * 0.045, z = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * 0.045; add(C(0.03, 0.03, 0.1, 8), '#fff6ea', x, 0.05, z); add(S(0.025), '#ffcc55', x, 0.12, z, 0, 0, 0, true); } break;
    case 'crane': add(new THREE.ConeGeometry(0.08, 0.2, 4), '#ff9ab8', 0, 0.1, 0, Math.PI / 2); [-1, 1].forEach(s => add(B(0.2, 0.01, 0.08), '#ffb8cc', s * 0.1, 0.12, 0, 0, 0, s * 0.4)); break;
    case 'honey': add(C(0.1, 0.11, 0.18, 12), '#f2b030', 0, 0.09); add(C(0.11, 0.11, 0.04, 12), '#e86a8a', 0, 0.2); break;
    case 'kite': add(new THREE.OctahedronGeometry(0.3, 0), '#ff7aa8', 0, 1.4, 0, 0, 0, 0).scale.set(1, 1.2, 0.08); break;
    default: add(B(0.3, 0.3, 0.3), '#ff9ab8', 0, 0.15);
  }
  const sp = new THREE.Mesh(new THREE.OctahedronGeometry(0.07), new THREE.MeshBasicMaterial({ color: '#fff6a0' })); sp.position.y = type === 'kite' ? 2 : type === 'balloon' ? 2 : 0.8; sp.userData.spark = 1; g.add(sp); /* 頭上閃亮的提示 */
  return g;
}
async function setupSurprise() {
  if (!W) return; const slot = slotNow(), s = surpriseNow();
  if (SUR.day === surDay() && SUR.slot === slot && (SUR.obj || SUR.a || s.buff) && !surDone(slot)) return;
  clearSurprise(); SUR.day = surDay(); SUR.slot = slot; drawSurSky();
  if (s.buff || surDone(slot)) return;
  const [x, z] = surSpot(s.at, surDay() * 7 + slot);
  if (s.animal) { const a = await animal(OUT, s.animal, x, z, { s: s.animal === 'duck' ? 0.9 : 1, roam: 1.5, speed: 0.45 }); if (!a || SUR.day !== surDay() || SUR.slot !== slot) { if (a) { OUT.remove(a.o); animals.splice(animals.indexOf(a), 1); } return; } SUR.a = a; SUR.obj = a.o; return; }
  const g = surObj(s.obj); g.position.set(x, onDock(x, z) ? DOCK.y : standH(x, z), z); g.rotation.y = (dayHash(surDay() + slot) % 628) / 100; OUT.add(g); SUR.obj = g;
}
/* 天上的驚喜：愛心雲、銀河 */
function drawSurSky() {
  if (SUR.sky) { OUT.remove(SUR.sky); SUR.sky = null; }
  if (![0, 1, 2].some(i => i <= slotNow() && surpriseAt(surDay(), i).sky === 'heart')) return;
  const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.92, fog: false });
  for (let i = 0; i < 26; i++) { const t = i / 26 * Math.PI * 2, x = 16 * Math.sin(t) ** 3, y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t); const b = new THREE.Mesh(new THREE.SphereGeometry(2.2, 10, 8), m); b.position.set(x * 0.55, y * 0.55, 0); g.add(b); }
  g.position.set(-10, 34, -60); g.lookAt(0, 20, 0); OUT.add(g); SUR.sky = g;
}
/* 換時段時：換下一個驚喜、提醒一次 */
let surTick = 0;
function tickSurprise(dt) {
  if (!started() || MP.role === 'g') return; surTick += dt; if (surTick < 1.5) return; surTick = 0;
  if (SUR.slot !== slotNow() || SUR.day !== surDay()) { setupSurprise(); announceSurprise(); }
  if (SUR.obj) SUR.obj.traverse(o => { if (o.userData.spark) { o.rotation.y += 0.4; o.position.y += Math.sin(performance.now() / 300) * 0.01; } });
}
function announceSurprise() {
  if (MP.role === 'g' || !started()) return; const key = `${surDay()}-${slotNow()}`; if (st.surpriseSeen === key) return; st.surpriseSeen = key;
  const s = surpriseNow(); setTimeout(() => toast(`${s.icon} ${SLOT_NAMES[slotNow()]}的驚喜：${s.tip}`, 6000, s.buff ? () => openQuests() : () => goSurprise()), 3200);
}
function finishSurprise() { const slot = slotNow(); if (st.surprise?.day !== surDay() || !Array.isArray(st.surprise.done)) st.surprise = { day: surDay(), done: [false, false, false] }; st.surprise.done[slot] = true; st.surFound = (st.surFound || 0) + 1; save(); }
function surReward(s) {
  const r = s.r || {}, c = Array.isArray(r.c) ? Math.round(rand(r.c[0], r.c[1])) : r.c || 0; let extra = '';
  if (r.item) { const pool = r.item === 'cheap' ? DECOR.filter(d => d[2] <= 60) : null, it = pool ? pool[dayHash(surDay() + 5) % pool.length] : DECOR.find(d => d[0] === r.item); if (it) { st.inv = st.inv || {}; st.inv[it[0]] = (st.inv[it[0]] || 0) + 1; extra = `「${it[1]}」已經放進擺設裡（點 🪙 就能擺）。`; } }
  if (r.food) { st.pantry = st.pantry || {}; st.pantry[r.food[0]] = (st.pantry[r.food[0]] || 0) + r.food[1]; }
  if (c) addCoins(c, `${s.icon} ${s.name}`); if (r.l) addLove(r.l); addMemo(s.icon, `${nameOf(myIdx())} ${s.memo || s.name}`);
  return extra;
}
function actSurprise() {
  const s = surpriseNow(); if (surpriseDone() || s.buff) return;
  if (s.animal) {
    const a = SUR.a; if (a) a.hold = 3; me().av.emote('petdog', 1.8); burst('heart', a ? a.o.position.clone().add(new THREE.Vector3(0, 0.6, 0)) : headPos(me(), 1), 8);
    finishSurprise(); surReward(s);
    if (s.r?.letter) setTimeout(() => surLetter(s), 900);
    setTimeout(() => { if (a) { a.hold = 0; a.tx = a.o.position.x + 14; a.tz = a.o.position.z + 8; a.speed = 1.6; } setTimeout(() => { if (SUR.a === a) clearSurprise(); }, 6000); }, 2600);
    return;
  }
  me().av.emote('pickup', 1.4); finishSurprise(); const extra = surReward(s);
  setTimeout(() => {
    clearSurprise(); burst('star', headPos(me(), 1.2), 10); sfx('chime');
    if (s.r?.letter) return surLetter(s);
    if (s.r?.wish) return surWish(s);
    openDlg(`${s.icon} ${s.name}`, `<p>${esc(s.open || '')}</p>${extra ? `<p class="muted">${esc(extra)}</p>` : ''}<button type="button" class="primary" id="sur-ok">收下 ♥</button>`); $('#sur-ok').onclick = () => $('#dlg').close();
  }, 700);
}
function surLetter(s) {
  const pool = LETTERS2[s.r.letter](), text = pool[dayHash(surDay() + 9 + slotNow()) % pool.length];
  openDlg(`${s.icon} ${s.name}`, `<p class="letter">${esc(text).replace(/\n/g, '<br>')}</p><button type="button" class="primary" id="sur-ok">收進回憶本</button>`); $('#sur-ok').onclick = () => $('#dlg').close();
}
function surWish(s) {
  openDlg(`${s.icon} ${s.name}`, `<p class="muted">寫一個願望放進瓶子裡，它會留在你們的回憶本。</p><label class="anniv"><span>願望</span><input id="wish-in" maxlength="40" placeholder="例如：明年一起去看雪"></label><button type="button" class="primary" id="wish-ok">放進瓶子</button>`);
  $('#wish-ok').onclick = () => { const w = $('#wish-in').value.trim(); $('#dlg').close(); if (w) addMemo('🫙', `在許願瓶裡寫下：「${w}」`); burst('star', headPos(me(), 1.4), 12); };
}
/* 今日任務視窗裡的三個驚喜（還沒到的時段先保密） */
function surpriseListHtml() {
  return [0, 1, 2].map(i => { const s = surpriseAt(surDay(), i), now = slotNow(), done = surDone(i), open = i <= now;
    return `<div class="memo sur-row${open ? '' : ' locked'}${i === now ? ' now' : ''}"><span class="ic">${open ? s.icon : '🔒'}</span><b>${SLOT_NAMES[i]}・${open ? esc(s.name) + (done || s.buff ? ' ✓' : '') : '還沒揭曉'}</b><small>${open ? esc(s.tip) : i === 1 ? '12:00 揭曉' : '18:00 揭曉'}</small></div>`; }).join('');
}

/* 夜晚的好運：螢火蟲、銀河 */
function tickSurNight(dt) {
  const out = scene === 'out' && started() && isNight();
  const wantF = out && surpriseIs('fireflies'), wantS = out && surpriseIs('starry');
  if (wantF && !SUR.flies) {
    const n = 220, pos = new Float32Array(n * 3), geo = new THREE.BufferGeometry(); for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, r = rand(3, 22); pos.set([Math.cos(a) * r, rand(0.8, 3.2), Math.sin(a) * r], i * 3); }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); SUR.flies = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#fff59a', size: 0.22, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); OUT.add(SUR.flies);
  }
  if (!wantF && SUR.flies) { OUT.remove(SUR.flies); SUR.flies = null; }
  if (SUR.flies) { const P = SUR.flies.geometry.attributes.position, t = performance.now() / 1000; for (let i = 0; i < P.count; i++) { P.setY(i, P.getY(i) + Math.sin(t * 1.3 + i) * dt * 0.25); P.setX(i, P.getX(i) + Math.cos(t * 0.7 + i * 2) * dt * 0.2); } P.needsUpdate = true; SUR.flies.material.opacity = 0.6 + Math.sin(t * 3) * 0.35; }
  if (wantS && !SUR.milky) {
    const n = 2600, pos = new Float32Array(n * 3), geo = new THREE.BufferGeometry();
    for (let i = 0; i < n; i++) { const t = Math.random() * Math.PI, spread = (Math.random() - 0.5) * (Math.random() < 0.7 ? 0.18 : 0.5), r = 260; const v = new THREE.Vector3(Math.cos(t) * r, Math.sin(t) * r * 0.75 + 20, spread * r); v.applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.6); pos.set([v.x, v.y, v.z], i * 3); }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); SUR.milky = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#dfe8ff', size: 1.3, sizeAttenuation: true, transparent: true, opacity: 0.85, depthWrite: false, fog: false })); OUT.add(SUR.milky);
  }
  if (!wantS && SUR.milky) { OUT.remove(SUR.milky); SUR.milky = null; }
}

// ================= 隨手撿到的小驚喜：在屋外走一走，地上會冒出閃亮的東西 =================
const MINI = { o: null, t: 40 };
const MINI_REWARDS = [
  [30, '🪙', '幾枚小島幣', () => addCoins(Math.round(rand(3, 10)))], [12, '🐚', '一個漂亮的貝殼', () => { addCoins(5); st.shells = st.shells || {}; const n = pick(SHELLS)[0]; st.shells[n] = (st.shells[n] || 0) + 1; }],
  [10, '🥚', '一顆雞蛋', () => { st.pantry = st.pantry || {}; st.pantry['雞蛋'] = (st.pantry['雞蛋'] || 0) + 1; }], [10, '💗', '一點點甜蜜', () => addLove(1)],
  [8, '🌸', '一片花瓣', () => addCoins(3)], [6, '💰', '一小袋小島幣', () => addCoins(Math.round(rand(15, 30)))], [4, '🎁', '一個小擺設', () => { const pool = DECOR.filter(d => d[2] <= 40), it = pick(pool); st.inv = st.inv || {}; st.inv[it[0]] = (st.inv[it[0]] || 0) + 1; return `「${it[1]}」`; }],
  [2, '🍀', '一株四葉草（幸運）', () => addCoins(25)],
];
function tickMini(dt) {
  if (!started() || MP.role === 'g' || scene !== 'out' || act || photo.on) return;
  if (st.miniDay?.d !== st.day) st.miniDay = { d: st.day, n: 0 };
  if (MINI.o) {
    const p = me(), d = Math.hypot(MINI.o.position.x - p.x, MINI.o.position.z - p.z); MINI.o.rotation.y += dt * 2; MINI.o.children[0].position.y = 0.35 + Math.sin(performance.now() / 260) * 0.06;
    if (d < 1.1) { /* 走過去就撿起來 */
      OUT.remove(MINI.o); MINI.o = null; st.miniDay.n++; const tot = MINI_REWARDS.reduce((s, r) => s + r[0], 0); let r = Math.random() * tot, R = MINI_REWARDS[0]; for (const x of MINI_REWARDS) { r -= x[0]; if (r <= 0) { R = x; break; } }
      const extra = R[3](); me().av.emote('pickup', 1); burst('star', headPos(me(), 1.1), 8); sfx('coin'); toast(`✨ 撿到${R[2]}${extra ? '：' + extra : ''}`, 2600); save();
    } else if (d > 40) { OUT.remove(MINI.o); MINI.o = null; }
    return;
  }
  if (st.miniDay.n >= 10) return; MINI.t -= dt; if (MINI.t > 0) return; MINI.t = rand(70, 150);
  const p = me(); for (let k = 0; k < 20; k++) { const a = Math.random() * 6.28, r = rand(4, 10), x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r; if (!walkable(x, z) || !canStand(x, z)) continue;
    const g = new THREE.Group(), s = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), new THREE.MeshBasicMaterial({ color: '#fff3a0' })); s.position.y = 0.35; g.add(s);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.26, 20), new THREE.MeshBasicMaterial({ color: '#fff6c8', transparent: true, opacity: 0.6, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; g.add(ring);
    g.position.set(x, standH(x, z), z); OUT.add(g); MINI.o = g; break; }
}

// ================= 稀有事件：很少很少才會遇到，遇到時全螢幕慶祝，記進回憶本的「稀有事件」 =================
const RARE = [
  { k: 'whale', icon: '🐋', name: '鯨魚躍出海面', when: 'day', text: '遠方的海面上，一隻大鯨魚整個躍出水面！' },
  { k: 'dolphins', icon: '🐬', name: '海豚群經過', when: 'day', text: '一群海豚在小島旁邊跳來跳去，好像在打招呼。' },
  { k: 'rainbow2', icon: '🌈', name: '雙彩虹', when: 'day', text: '天上出現了兩道彩虹，聽說看到的人會一直幸福。' },
  { k: 'aurora', icon: '🌌', name: '極光', when: 'night', text: '夜空中出現了極光，綠色和粉紅色的光在跳舞。' },
  { k: 'bluetears', icon: '💙', name: '藍眼淚', when: 'night', text: '海浪打上岸的地方發出藍色的光，是藍眼淚！' },
  { k: 'heartcomet', icon: '💫', name: '愛心彗星', when: 'night', text: '一顆拖著粉紅色尾巴的愛心彗星劃過夜空！' },
];
const RAREFX = { o: null, t: 0, k: null, check: 30 };
function tickRare(dt) {
  if (RAREFX.o) { RAREFX.t += dt; rareAnim(dt); if (RAREFX.t > RAREFX.dur) { OUT.remove(RAREFX.o); RAREFX.o = null; } return; }
  if (!started() || MP.role === 'g' || scene !== 'out' || photo.on) return;
  RAREFX.check -= dt; if (RAREFX.check > 0) return; RAREFX.check = 60;
  if (st.rareDay === st.day) return; /* 一天最多一次 */
  if (Math.random() > 0.012) return; /* 每分鐘 1.2%：平均玩一個多小時才會遇到一次 */
  const pool = RARE.filter(r => r.when === (isNight() ? 'night' : 'day')); rareStart(pick(pool).k, true);
}
function rareStart(k, mine) {
  const R = RARE.find(r => r.k === k); if (!R || RAREFX.o) return;
  if (mine) { st.rareDay = st.day; if (MP.on) MP.net.send({ t: 'fx', k: 'rare', a: RARE.indexOf(R) }); }
  RAREFX.k = k; RAREFX.t = 0; RAREFX.dur = k === 'aurora' || k === 'bluetears' || k === 'rainbow2' ? 40 : 14; RAREFX.o = rareBuild(k); OUT.add(RAREFX.o); RAREFX.camDur = k === 'heartcomet' ? 13 : 10; RAREFX.focus = rareFocus(k);
  const ov = document.createElement('div'); ov.className = 'rare-banner'; ov.innerHTML = `<small>✨ 稀有事件 ✨</small><span>${R.icon}</span><b>${esc(R.name)}</b><p>${esc(R.text)}</p>`; document.body.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('on')); setTimeout(() => { ov.classList.remove('on'); setTimeout(() => ov.remove(), 800); }, 4200); sfx('chime');
  st.rares = st.rares || {}; const first = !st.rares[k]; st.rares[k] = (st.rares[k] || 0) + 1;
  addLove(first ? 10 : 4, null, 'rare'); addCoins(first ? 80 : 30); addMemo(R.icon, `${duo() ? '兩個人一起' : ''}看到了「${R.name}」`); save();
}
function rareBuild(k) {
  const g = new THREE.Group(), p = me();
  const seaDir = Math.atan2(p.z, p.x), far = 48, sx = Math.cos(seaDir) * far, sz = Math.sin(seaDir) * far; /* 往人面前的海那一邊 */
  if (k === 'whale') {
    const w = new THREE.Group(), body = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), toon('#3e5f86')); body.scale.set(4.2, 1.6, 1.7); w.add(body);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), toon('#dfe8f0')); belly.scale.set(3.6, 1.1, 1.3); belly.position.y = -0.45; w.add(belly);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(1.6, 0.3, 3), toon('#3e5f86')); tail.rotation.z = Math.PI / 2; tail.position.x = -4.6; w.add(tail);
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.8, 3), toon('#3e5f86')); fin.rotation.x = 1.2; fin.position.set(1, -0.5, 1.4); w.add(fin);
    w.position.set(sx, -6, sz); w.rotation.y = -seaDir + Math.PI / 2; g.add(w); g.userData.w = w;
  } else if (k === 'dolphins') {
    for (let i = 0; i < 6; i++) { const d = new THREE.Group(), b = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), toon('#7f9cc4')); b.scale.set(1.3, 0.38, 0.38); d.add(b); d.scale.setScalar(1.8); const f = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 3), toon('#8aa6c8')); f.position.y = 0.4; d.add(f); d.userData.ph = i * 0.7; d.userData.off = (i - 2) * 2.4; g.add(d); }
    g.userData.dir = seaDir; g.userData.r = 34;
  } else if (k === 'rainbow2') {
    [[60, 0], [72, 1]].forEach(([r, j]) => { ['#ff5a5a', '#ffa64a', '#ffe85a', '#6ad86a', '#5aa8ff', '#9a6aff'].forEach((c, i) => { const m = new THREE.Mesh(new THREE.TorusGeometry(r - i * 1.4, 0.75, 6, 60, Math.PI), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: j ? 0.38 : 0.62, fog: false, depthWrite: false })); m.userData.op = j ? 0.38 : 0.62; g.add(m); }); });
    g.position.set(sx * 1.5, -6, sz * 1.5); g.lookAt(0, -6, 0); /* 彩虹正面對著小島 */
  } else if (k === 'aurora') {
    /* 極光：一片片直立的光簾，上下都淡掉，顏色綠到粉紅 */
    const tex = (() => { const c = document.createElement('canvas'); c.width = 4; c.height = 128; const x = c.getContext('2d'), gr = x.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.35, 'rgba(255,255,255,.9)'); gr.addColorStop(0.75, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 4, 128); return new THREE.CanvasTexture(c); })();
    for (let i = 0; i < 7; i++) { const geo = new THREE.PlaneGeometry(70, 30, 40, 1), m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, color: ['#4affa8', '#6affd0', '#ff7ad8', '#4affa8', '#a07aff', '#4affa8', '#ff9ae8'][i], transparent: true, opacity: 0, side: THREE.DoubleSide, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
      m.position.set((i - 3) * 16, 34 + (i % 3) * 5, -70 - (i % 2) * 14); m.rotation.y = (i - 3) * 0.12; m.userData.base = geo.attributes.position.array.slice(); g.add(m); }
    g.rotation.y = Math.atan2(-Math.cos(seaDir), -Math.sin(seaDir)); /* 掛在人面前的天空 */
  } else if (k === 'bluetears') {
    const n = 3200, pos = new Float32Array(n * 3), geo = new THREE.BufferGeometry(), a0 = Math.atan2(p.z, p.x); for (let i = 0; i < n; i++) { const a = a0 + (Math.random() - 0.5) * 1.6, R = shoreR(Math.cos(a), Math.sin(a)) - rand(1.8, 5.2), X = Math.cos(a) * R, Z = Math.sin(a) * R; pos.set([X, Math.max(groundH(X, Z), 0) + 0.32, Z], i * 3); } /* 浪打上岸的那一帶，貼在沙和水面上 */
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.renderOrder = 20; g.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: '#19c8ff', size: 0.42, transparent: true, opacity: 0.95, depthWrite: false, fog: false, map: (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'), r = x.createRadialGradient(16, 16, 0, 16, 16, 16); r.addColorStop(0, 'rgba(220,255,255,1)'); r.addColorStop(0.4, 'rgba(60,210,255,.9)'); r.addColorStop(1, 'rgba(0,120,255,0)'); x.fillStyle = r; x.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })() }))); g.children[0].renderOrder = 20; /* 畫在海面之後，才不會被半透明的海蓋住 */
  } else if (k === 'heartcomet') {
    const sh = new THREE.Shape(); sh.moveTo(0, -0.7); sh.bezierCurveTo(-0.1, -0.56, -0.9, -0.1, -0.9, 0.34); sh.bezierCurveTo(-0.9, 0.76, -0.44, 0.94, 0, 0.6); sh.bezierCurveTo(0.44, 0.94, 0.9, 0.76, 0.9, 0.34); sh.bezierCurveTo(0.9, -0.1, 0.1, -0.56, 0, -0.7);
    const h = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color: '#ff8ac8', fog: false })); h.scale.setScalar(3); g.add(h); g.userData.h = h;
    for (let i = 0; i < 24; i++) { const t = new THREE.Mesh(new THREE.SphereGeometry(1.2 - i * 0.045, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffc8e8', transparent: true, opacity: 0.7 - i * 0.028, fog: false })); g.add(t); }
    g.userData.dir = seaDir;
  }
  return g;
}
function rareFocus(k) {
  const g = RAREFX.o, v = new THREE.Vector3();
  if (k === 'whale') return () => g.userData.w.position.clone().setY(4);
  if (k === 'dolphins') return () => g.children[2].position.clone().setY(1);
  if (k === 'rainbow2') return () => v.copy(g.position).setY(22);
  if (k === 'aurora') return () => g.children[0].getWorldPosition(v).setY(40);
  if (k === 'heartcomet') return () => g.children[0].position.clone();
  if (k === 'bluetears') { const P = shorePoint(me().x, me().z, -0.05); return () => v.set(P.x, 0.3, P.z); }
  return null;
}
function rareAnim(dt) {
  const g = RAREFX.o, t = RAREFX.t, k = RAREFX.k;
  if (k === 'whale') { const w = g.userData.w, ph = Math.min(1, t / 5); w.position.y = -6 + Math.sin(ph * Math.PI) * 13; w.rotation.z = (0.5 - ph) * 1.6; if (t > 4.6 && t < 5.2) burst('star', w.position.clone().setY(0.5), 20, 4); }
  else if (k === 'dolphins') g.children.forEach(d => { const a = g.userData.dir + (t * 0.06) + d.userData.off * 0.02, r = g.userData.r + d.userData.off; const ph = (t * 1.4 + d.userData.ph) % 2; d.position.set(Math.cos(a) * r, ph < 1 ? Math.sin(ph * Math.PI) * 2.2 - 0.3 : -2, Math.sin(a) * r); d.rotation.set(0, -a, ph < 1 ? (0.5 - ph) * 1.6 : 0); });
  else if (k === 'rainbow2' || k === 'bluetears') g.children.forEach(m => { if (m.material) m.material.opacity = (m.userData.op || 0.95) * Math.max(0, Math.min(1, t / 2.5, (RAREFX.dur - t) / 3)) * (k === 'bluetears' ? 0.75 + Math.sin(performance.now() / 250) * 0.25 : 1); });
  else if (k === 'aurora') g.children.forEach((m, i) => { const P = m.geometry.attributes.position, b = m.userData.base; for (let j = 0; j < P.count; j++) { P.setZ(j, b[j * 3 + 2] + Math.sin(b[j * 3] * 0.08 + t * 0.5 + i) * 6); P.setY(j, b[j * 3 + 1] + Math.sin(b[j * 3] * 0.04 + t * 0.3 + i * 2) * 3); } P.needsUpdate = true; m.material.opacity = (0.55 + Math.sin(t * 0.8 + i) * 0.2) * Math.max(0, Math.min(1, t / 3, (RAREFX.dur - t) / 4)); });
  else if (k === 'heartcomet') { const a = g.userData.dir, u = t / RAREFX.dur, x = -80 + u * 160; const base = new THREE.Vector3(x, 60 - u * 25, -70).applyAxisAngle(new THREE.Vector3(0, 1, 0), -a - Math.PI / 2); g.children.forEach((c, i) => { const d = new THREE.Vector3(-i * 2.2, i * 0.7, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), -a - Math.PI / 2); c.position.copy(base).add(d); if (i === 0) c.lookAt(cam.position); }); }
}

// ================= 東西都能用：擺設和島上原本的家具、道具 =================
// 每一種擺設怎麼用：seat 坐、lamp 開關燈、read 看書、plant 澆水聞花、guitar 彈吉他、globe 轉地球儀、cup 喝一口、bird 小鳥、gnome 小矮人、bell 腳踏車鈴、hug 抱枕、lie 躺下、shade 乘涼、desk 書桌
// y：坐墊高度（公尺）；pose：sit 坐／recline 靠著；rock：會搖；fwd：坐的位置往前多少
const USE = {
  rocker: { t: 'seat', y: 0.44, pose: 'recline', rock: 1, fwd: 0.05, name: '搖椅' }, deckChair: { t: 'seat', y: 0.3, pose: 'recline', fwd: 0.1, name: '海灘椅' },
  'armchair-980c7c': { t: 'seat', y: 0.42, name: '單人沙發' }, 'lounge-armchair-5a72ca': { t: 'seat', y: 0.38, pose: 'recline', name: '休閒椅' },
  'dorm-desk-chair-9b4076': { t: 'seat', y: 0.48, name: '書桌椅' }, picnicTable: { t: 'seat', y: 0.44, side: 0.62, name: '野餐桌' },
  tableLamp: { t: 'lamp' }, floorLamp: { t: 'lamp' }, dockLamp: { t: 'lamp' }, 'andon-floor-lantern-b1b7ea': { t: 'lamp' }, 'camping-lantern-21d14b': { t: 'lamp' },
  'table-candle-lantern-a7b5af': { t: 'lamp' }, 'globe-lamp-346cb6': { t: 'lamp' }, 'paper-bag-luminaria-0e8a1a': { t: 'lamp' },
  bookcase: { t: 'read' }, 'bookshelf-5e881a': { t: 'read' }, 'exercise-book-stack-266d9d': { t: 'read' }, 'office-desk-021eb3': { t: 'desk' },
  flowerBed: { t: 'plant' }, sunflower: { t: 'plant' }, 'common-daisy-6b2004': { t: 'plant' }, 'potted-autumn-mums-08db8c': { t: 'plant' }, 'potted-shrub-43bd21': { t: 'plant' },
  'potted-cactus-855c1d': { t: 'plant' }, plant: { t: 'plant' }, cherry: { t: 'plant', shake: 1 }, sapling: { t: 'plant' }, bush: { t: 'plant' }, 'table-herb-pot-3c0cf4': { t: 'plant' },
  'basil-pot-125949': { t: 'plant' }, 'fern-plant-1559b8': { t: 'plant' }, 'ti-plant-a7ad06': { t: 'plant' }, 'taro-plant-8c0493': { t: 'plant' },
  guitar: { t: 'guitar' }, 'classroom-globe-16a96e': { t: 'globe' }, 'coffee-cup-90be67': { t: 'cup' }, 'birdhouse-post-66d6c1': { t: 'bird' }, 'garden-birdbath-9671de': { t: 'bird' },
  'xmas-fir-tree': { t: 'xtree' }, 'garland-lamp-post-af02f0': { t: 'lamp' }, 'wooden-toboggan-940bbc': { t: 'seat', y: 0.24, name: '木雪橇' }, 'gingerbread-house-8b9049': { t: 'treat' }, 'gingerbread-man-4766ed': { t: 'treat' }, 'candy-cane-eb113b': { t: 'treat' }, 'snow-laden-spruce-36716e': { t: 'plant', shake: 1 }, 'candy-cane-path-markers-2310e4': { t: 'treat' },
  'hotel-king-bed-c15761': { t: 'seat', y: 0.55, pose: 'lie', name: '特大雙人床' },
  'dorm-loft-bed-with-a094e7': { t: 'look', say: ['爬上去看了一下，上面好像秘密基地', '高架床下面可以放書桌'] },
  'bath-fad968': { t: 'soak', y: 0.2 },
  'round-jetted-suite-tub-2bd9bb': { t: 'soak', y: 0.25 },
  'lounge-grand-piano-e98c92': { t: 'piano' },
  'upright-piano-c0b0ef': { t: 'piano' },
  'sideboard-dd343b': { t: 'look', say: ['抽屜裡收著你們的小東西', '櫃子上可以擺照片'] },
  'chest-of-drawers-cbe3e7': { t: 'look', say: ['拉開抽屜，裡面是摺好的衣服', '最下面那格藏著一封情書'] },
  'dressing-mirror-7c0871': { t: 'mirror' },
  'coat-rack-57bbbc': { t: 'look', say: ['掛著兩個人的外套', '帽子掛好了'] },
  'pool-table-1b3f86': { t: 'game', say: ['一桿進洞！', '差一點點…', '漂亮的反彈球', '白球洗袋了，哈哈'] },
  'lounge-sofa-c34b3e': { t: 'seat', y: 0.42, pose: 'recline', name: '大沙發' },
  'velvet-tub-chair-b0b5f8': { t: 'seat', y: 0.42, name: '絲絨單椅' },
  'art-easel-078422': { t: 'game', say: ['畫了一顆歪歪的愛心', '畫了你的側臉，還滿像的', '畫了今天的海', '顏料沾到臉上了'] },
  'jukebox-1e2ea6': { t: 'jukebox' },
  'arcade-console-ec27c2': { t: 'game', say: ['新紀錄！', 'Game Over…再一次', '打到第 3 關了', '搖桿快被你搖壞了'] },
  'trophy-cabinet-e963ac': { t: 'look', say: ['裡面放著你們一起收集的寶貝', '最上層是第一次約會的票根'] },
  'area-rug-5c56e2': { t: 'lie' },
  'cafe-counter-d8b226': { t: 'cup' },
  'library-shelf-run-570904': { t: 'read' },
  'hot-spring-pool-26312c': { t: 'soak', y: 0.1 },
  'pergola-bay-module-1ad452': { t: 'shade' },
  'plaza-fountain-5a5f6e': { t: 'wish' },
  'backyard-barbecue-grill-84d4ef': { t: 'bbq' },
  'stone-fire-pit-4136b0': { t: 'warm' },
  'roofed-well-43a2fc': { t: 'wish' },
  'windmill-pump-2993a4': { t: 'wind' },
  'japanese-koi-pond-78d204': { t: 'koi' },
  'backyard-doghouse-50a492': { t: 'look', say: ['狗狗的新家！牠聞了聞，尾巴搖個不停', '裡面鋪了一條小毯子'] },
  'backyard-trampoline-2779ec': { t: 'bounce' },
  'playground-slide-8b764c': { t: 'game', say: ['咻——溜下來了！', '再溜一次！', '屁股好燙'] },
  'teeter-totter-ee9c62': { t: 'game', say: ['一上一下，好好玩', '你那邊比較重喔', '翹到最高了'] },
  'sandbox-224517': { t: 'game', say: ['堆了一座小山', '挖到一個貝殼', '在沙上寫了你的名字'] },
  'seafront-lamp-post-28bada': { t: 'lamp' },
  'plank-bench-c46528': { t: 'seat', y: 0.25, name: '長木椅' },
  'rope-swing-on-a-ada4bb': { t: 'game', say: ['盪得好高！', '風從耳邊吹過', '腳碰到樹葉了'] },
  'ramen-yatai-stall-53974b': { t: 'ramen' },
  'folding-camp-chair-2fc7d1': { t: 'seat', y: 0.38, pose: 'recline', name: '露營椅' },
  'festoon-light-run-45629f': { t: 'lamp' },
  'frontyard-gnome-997876': { t: 'gnome' }, bike: { t: 'bell' }, cushion: { t: 'hug' }, rug: { t: 'lie' }, parasol: { t: 'shade' }, 'windsock-d5df79': { t: 'wind' },
};
const USE_ICON = { look: '👀', soak: '♨️', piano: '🎹', mirror: '🪞', game: '🎯', jukebox: '🎵', wish: '🪙', bbq: '🍖', warm: '🔥', koi: '🐟', bounce: '🤸', ramen: '🍜', xtree: '🎄', treat: '🍬', seat: '🪑', lamp: '💡', read: '📖', plant: '🌿', guitar: '🎸', globe: '🌍', cup: '☕', bird: '🐦', gnome: '🧙', bell: '🔔', hug: '🧸', lie: '🛋️', shade: '⛱️', wind: '🌬️', desk: '✍️' };
const USE_VERB = { look: '看一看', soak: '泡一下', piano: '彈鋼琴', mirror: '照鏡子', game: '玩一下', jukebox: '點一首歌', wish: '許願', bbq: '烤肉', warm: '取暖', koi: '餵魚', bounce: '跳一跳', ramen: '吃拉麵', xtree: '看聖誕樹', treat: '嚐一口', seat: '坐一下', lamp: '開關燈', read: '看書', plant: '澆水', guitar: '彈吉他', globe: '轉地球儀', cup: '喝一口', bird: '看小鳥', gnome: '跟小矮人說話', bell: '按鈴', hug: '抱抱枕', lie: '躺一下', shade: '乘涼', wind: '看風', desk: '寫信' };
const DSP = []; /* 擺設變成的地點（跟 SP 一樣用） */
function rebuildDecorSpots() {
  DSP.forEach(s => s.el?.remove()); DSP.length = 0;
  (st.decor || []).forEach((d, i) => {
    const u = USE[d.id]; if (!u) return; const def = DECOR.find(x => x[0] === d.id);
    const s = { id: 'd' + i, sc: d.sc, x: d.x, z: d.z, r: 1.5, icon: USE_ICON[u.t], name: `${def?.[1] || ''}・${u.pose === 'lie' ? '躺一下' : USE_VERB[u.t]}`, run: () => useThing(u, { ...d, name: def?.[1] || u.name || '' }), dsp: 1 }; /* d 裡有 id */
    const el = document.createElement('button'); el.type = 'button'; el.className = 'lbl'; el.textContent = `${s.icon} ${s.name}`; el.style.display = 'none';
    el.onclick = () => { if (act || !started()) return; route(me(), s.x, s.z, s); sfx('click'); }; $('#labels').appendChild(el); s.el = el; DSP.push(s);
  });
}
const SEAT_LINES = ['坐下來，什麼都不想，聽海風。', '好舒服，想一直坐在這裡。', '這個位置的風景剛剛好。', '坐著發呆也是一種幸福。'];
const BOOK_LINES = ['「所謂喜歡，就是想一起分享沒什麼特別的日常。」', '「我們沒有在一起很久，但每一天都很值得。」', '「世界很大，可是我只想跟你看同一片海。」', '「你不用很完美，你在就好。」', '「最好的時光，是有人陪你浪費時間。」', '「晚安的意思是：明天見。」', '「愛不是看著彼此，而是一起看向同一個方向。」'];
const GLOBE_PLACES = ['冰島看極光', '京都看楓葉', '北海道看雪', '巴黎看鐵塔', '紐西蘭看星空', '峇里島看海', '布拉格看夕陽', '首爾吃炸雞', '沖繩浮潛', '瑞士搭火車'];
const GNOME_LINES = ['「嘿嘿，我一直在看著你們喔。」', '「今天也很恩愛呢。」', '「聽說愛情樹快開花了！」', '「我在這裡守護花園，放心。」', '「偷偷告訴你，另一半剛剛在找你。」'];
function useThing(u, o) {
  const sc = o.sc || scene, gy = sc === 'in' ? (o.y ?? 0) : (o.y ?? standH(o.x, o.z));
  me().ry = Math.atan2(o.x - me().x, o.z - me().z);
  const daily = k => { st.useDay = st.useDay?.d === st.day ? st.useDay : { d: st.day, k: [] }; if (st.useDay.k.includes(k)) return false; st.useDay.k.push(k); return true; };
  switch (u.t) {
    case 'seat': return useSeat(u, o, gy);
    case 'lamp': {
      st.lampsOff = st.lampsOff || []; const k = `${sc}:${o.x.toFixed(1)},${o.z.toFixed(1)}`, off = st.lampsOff.includes(k);
      st.lampsOff = off ? st.lampsOff.filter(x => x !== k) : [...st.lampsOff, k]; save(); applyLamps(); decorLights(); me().av.emote('interact', 0.8); sfx('click'); toast(off ? '💡 開燈了' : '關燈了'); return;
    }
    case 'read': me().av.emote('interact', 1.2); sfx('book'); openDlg('📖 隨手翻一本書', `<p class="letter">${esc(pick(BOOK_LINES))}</p><p class="muted">在書裡畫了一條線，想念給 ${esc(partnerName())} 聽。</p>`); if (daily('read' + o.x)) addLove(1); return;
    case 'plant': me().av.emote('water', 1.6); sfx('water'); if (u.shake) setTimeout(() => burst('heart', new THREE.Vector3(o.x, gy + 2.2, o.z), 10, 1.2), 300);
      toast(daily('plant' + o.x.toFixed(1) + o.z.toFixed(1)) ? (addLove(1), `🌿 幫${o.name || '植物'}澆了水，聞起來好香`) : `🌿 ${o.name || '植物'}今天已經喝飽水了`); return;
    case 'guitar': return useGuitar(o, gy);
    case 'globe': { me().av.emote('interact', 1); sfx('whoosh'); const p = pick(GLOBE_PLACES); setTimeout(() => { toast(`🌍 轉一轉，手指停在……${p}！想跟 ${partnerName()} 一起去`, 4500); if (daily('globe')) addMemo('🌍', `轉地球儀，說好以後一起去${p}`); }, 700); return; }
    case 'cup': me().av.emote('eat', 1.4); toast('☕ 喝一口，暖暖的'); if (daily('cup')) addLove(1); return;
    case 'bird': me().av.emote('wave', 1.2); setTimeout(() => { burst('note', new THREE.Vector3(o.x, gy + 1.2, o.z), 6, 0.4); toast('🐦 一隻小鳥飛過來，啾啾叫了兩聲'); sfx('pop'); }, 600); return;
    case 'gnome': me().av.emote('wave', 1); toast(`🧙 小矮人：${pick(GNOME_LINES)}`, 4000); return;
    case 'bell': me().av.emote('interact', 0.6); sfx('bell'); return;
    case 'hug': me().av.emote('hug', 1.6); burst('heart', headPos(me(), 1.2), 4, 0.3); toast('🧸 抱著抱枕，好軟'); return;
    case 'lie': return useSeat({ y: 0.04, pose: 'lie', name: '躺一下' }, o, gy);
    case 'shade': me().av.emote('cheer', 1); toast(`⛱️ ${o.name || '陽傘'}下好涼快`); return;
    case 'wind': toast(`🌬️ ${o.id === 'windmill-pump-2993a4' ? '風車' : '風向袋'}${WX?.st?.rain > 0.3 ? '轉得很快，風好大' : '慢慢轉著，今天適合放風箏'}`); return;
    case 'desk': return useDesk(o, gy);
    case 'look': me().av.emote('interact', 1.2); toast(`👀 ${pick(u.say)}`, 3200); return;
    case 'game': me().av.emote(pick(['cheer', 'jump', 'clap']), 1.4); burst('star', headPos(me(), 1.2), 6, 0.4); sfx('pop'); toast(`🎯 ${pick(u.say)}`, 3000); if (daily('game' + o.id)) addLove(1); return;
    case 'mirror': me().av.emote('wave', 1); setTimeout(() => openLooks(), 500); return;
    case 'jukebox': me().av.emote('interact', 0.8); sfx('click'); if (!st.music) { st.music = true; save(); } Music.pick((Math.max(-1, Music.track) + 1) % TRACKS.length); Music.play(); setTimeout(() => { toast(`🎵 點了一首「${Music.playing}」`, 3000); me().av.emote('dance', 4); if (duo()) you().av.emote('dance', 4); }, 500); return;
    case 'wish': me().av.emote('throw', 0.8); sfx('plop'); if ((st.coins || 0) >= 1) { st.coins -= 1; updateChips(); } setTimeout(() => { burst('star', new THREE.Vector3(o.x, gy + 1, o.z), 10, 0.6); sfx('chime'); toast(`🪙 丟了一枚硬幣：「${pick(['希望我們一直在一起', '希望明天也是好天氣', '希望對方每天都開心', '希望一起去很多地方'])}」`, 4000); if (daily('wish')) addLove(2); }, 700); return;
    case 'bbq': me().av.emote('interact', 1.6); sfx('sizzle'); setTimeout(() => { toast(`🍖 ${pick(['烤好一串，分你一半', '滋滋作響，好香', '有點焦，但還是好吃'])}`, 3200); if (daily('bbq')) { addLove(2); st.pantry = st.pantry || {}; } }, 900); return;
    case 'warm': me().av.emote('interact', 1.6); toast('🔥 火暖暖的，手都烤熱了'); if (daily('warm')) addLove(1); return;
    case 'koi': me().av.emote('throw', 0.8); sfx('plop'); setTimeout(() => { burst('heart', new THREE.Vector3(o.x, gy + 0.4, o.z), 5, 0.6); toast(`🐟 ${pick(['錦鯉都游過來搶飼料', '最大那隻是橘色的', '有一隻一直看著你'])}`, 3200); }, 600); if (daily('koi')) addLove(1); return;
    case 'bounce': { let n = 0; const t_ = setInterval(() => { me().av.emote('jump', 0.9); sfx('pop'); if (++n >= 4) clearInterval(t_); }, 700); toast('🤸 跳～跳～跳～'); if (daily('bounce')) addLove(1); return; }
    case 'ramen': me().av.emote('eat', 2.2); sfx('sizzle'); setTimeout(() => toast(`🍜 ${pick(['熱騰騰的拉麵，湯頭好濃', '加一顆溏心蛋', '吃到滿頭大汗，好過癮'])}`, 3500), 800); if (daily('ramen')) addLove(2); return;
    case 'soak': return useSeat({ y: u.y, pose: 'sit', name: '泡湯', soak: 1 }, o, gy);
    case 'piano': return usePiano(o, gy);
    case 'xtree': me().av.emote('cheer', 1.2); burst('star', new THREE.Vector3(o.x, gy + 2.4, o.z), 14, 0.8); sfx('chime'); toast(`🎄 ${pick(['樹上的星星閃了一下', '聖誕球映著你們兩個的臉', '許一個聖誕願望吧'])}`); if (daily('xtree')) addLove(1); return;
    case 'treat': me().av.emote('eat', 1.4); toast(`🍬 ${pick(['甜甜的，是聖誕節的味道', '捨不得吃，只咬了一小口', '分一半給另一半'])}`); if (daily('treat')) addLove(1); return;
  }
}
/* 坐下：可以一直坐著發呆；搖椅會慢慢搖 */
function useSeat(u, o, gy) {
  const ry = o.ry || 0, fx = Math.sin(ry), fz = Math.cos(ry), side = u.side || 0, f = u.fwd || 0;
  const x = o.x + fx * (f - side), z = o.z + fz * (f - side), y = gy + (u.y ?? 0.45) - (u.pose === 'lie' ? 0 : HIP), pose = u.pose || 'sit', fry = side ? ry : ry;
  actGo(() => { seat(me(), x, y, z, fry, pose); if (side && duo()) seat(you(), o.x - fx * (f - side), y, o.z - fz * (f - side), ry + Math.PI, pose); }, 220);
  let t = 0; sfx('wood');
  beginAct('seat', `${u.pose === 'lie' ? '🛋️' : '🪑'} ${o.name || u.name || '坐一下'}`, pick(SEAT_LINES), {
    focus: () => new THREE.Vector3(x, gy + 0.9, z), back: [o.x + fx * 1.2, o.z + fz * 1.2],
    btns: [{ t: '發呆一下', main: true, fn: () => { me().av.emote('shy', 1.4); msg(pick(SEAT_LINES)); if (st.useDay?.d !== st.day || !st.useDay.k.includes('seat' + o.x)) { st.useDay = st.useDay?.d === st.day ? st.useDay : { d: st.day, k: [] }; st.useDay.k.push('seat' + o.x); addLove(1); } } }, duo() && { t: '靠在一起', fn: () => { me().av.lean(1); burst('heart', midPos(1), 5, 0.3); addLove(2, '靠在一起', 'lean'); } }],
    update(dt) { t += dt; if (u.rock) me().tilt = Math.sin(t * 1.4) * 0.08; if (u.soak && Math.random() < dt / 1.2) burst('z', new THREE.Vector3(x + rand(-0.4, 0.4), gy + 0.7, z + rand(-0.4, 0.4)), 1, 0.2); }, /* 搖椅慢慢搖；泡湯冒熱氣 */
  });
}
function usePiano(o, gy) {
  const ry = o.ry || 0, fx = Math.sin(ry), fz = Math.cos(ry);
  actGo(() => seat(me(), o.x + fx * 0.75, gy + 0.46 - HIP, o.z + fz * 0.75, ry + Math.PI, 'sit'));
  me().av.reach(true); Music.duet(true);
  beginAct('guitar', '🎹 彈鋼琴', `彈一首給 ${partnerName()} 聽。`, {
    back: [o.x + fx * 1.6, o.z + fz * 1.6],
    btns: [{ t: '換一首', main: true, fn: () => { Music.duet(false); setTimeout(() => Music.duet(true), 900); } }],
    update(dt) { if (Math.random() < dt / 2.5) burst('note', headPos(me(), 1.1), 2, 0.3); },
    end() { Music.duet(false); me().av.reach(false); addLove(2, null, 'guitar'); },
  });
}
function useGuitar(o, gy) {
  actGo(() => seat(me(), o.x + 0.5, gy + 0.02 - HIP, o.z + 0.5, Math.PI * 0.75, 'floor'), 220);
  me().av.setLap(guitarItem()); Music.duet(true);
  beginAct('guitar', '🎸 彈吉他', `彈一首給 ${partnerName()} 聽。`, {
    focus: () => new THREE.Vector3(o.x + 0.5, gy + 0.8, o.z + 0.5), back: [o.x + 1.2, o.z + 1.2],
    btns: [{ t: '換一首', main: true, fn: () => { Music.duet(false); setTimeout(() => Music.duet(true), 900); } }],
    update(dt) { if (Math.random() < dt / 3) burst('note', headPos(me(), 1.1), 2, 0.3); },
    end() { Music.duet(false); me().av.setLap(null); addLove(2, null, 'guitar'); },
  });
}
/* 書桌：坐下來寫信、看書、轉地球儀、開關檯燈 */
function useDesk(o, gy) {
  const F_ = { x: o.x, z: o.z };
  actGo(() => seat(me(), F_.x - 0.85, gy + 0.48 - HIP, F_.z + 0.1, Math.PI / 2, 'sit'), 220);
  beginAct('desk', '✍️ 書桌', '安安靜靜的書桌角落。', {
    focus: () => new THREE.Vector3(F_.x - 0.3, gy + 1, F_.z), back: [F_.x - 1.6, F_.z + 0.6],
    btns: [{ t: '寫一封信', s: `給 ${partnerName()}`, main: true, fn: () => writeLetter() }, { t: '看書', fn: () => useThing({ t: 'read' }, o) }, { t: '轉地球儀', fn: () => useThing({ t: 'globe' }, o) }, { t: '開關檯燈', fn: () => useThing({ t: 'lamp' }, { ...o, x: o.x + 0.12, z: o.z - 0.5, sc: 'in' }) }],
  });
}
/* 擺設的燈會發光（最多 4 盞，手機才跑得動）；關掉的不發光 */
let decorLightObjs = [];
function decorLights() {
  decorLightObjs.forEach(l => l.parent?.remove(l)); decorLightObjs = []; const off = st.lampsOff || [];
  decorObjs.forEach(o => { const d = (st.decor || [])[o.userData.di]; if (!d || USE[d.id]?.t !== 'lamp' || decorLightObjs.length >= 4) return; if (off.includes(`${d.sc}:${d.x.toFixed(1)},${d.z.toFixed(1)}`)) return;
    const l = new THREE.PointLight('#ffc27a', 1.6, 4.5, 2); l.position.set(0, 0.9 / (o.scale.x || 1), 0); o.add(l); decorLightObjs.push(l); });
}
/* 燈：關掉的燈不發光（島上原本的燈和擺設的燈都一樣） */
function applyLamps() {
  const off = st.lampsOff || [];
  if (IN?.lamps) IN.lamps.forEach(l => { const near = off.some(x => { if (!x.startsWith('in:')) return false; const [a, b] = x.slice(3).split(',').map(Number); return Math.hypot(a - l.position.x, b - l.position.z) < 1.5; }); l.visible = !near; });
}
/* ---------- 燈塔：爬到最上面看海 ---------- */
const LH = { x: -19.2, z: -19.2, top: 7.95 };
function actLighthouse() {
  const out = Math.atan2(LH.z, LH.x), ox = Math.cos(out), oz = Math.sin(out), face = Math.atan2(ox, oz);
  const da = Math.atan2(LH_AT[1] - LH.z, LH_AT[0] - LH.x), door = [LH.x + Math.cos(da) * 3.75, LH.z + Math.sin(da) * 3.75];
  let beam = null, orbit = false, t = 0, stage = 0;
  const who = [me(), duo() ? you() : null].filter(c => c && !c.remote && !c.ghost);
  const side = k => { const a = out + k * 0.5; return [LH.x + Math.cos(a) * 1.02, LH.z + Math.sin(a) * 1.02]; };
  const btns = () => setBtns([{ t: '環顧四周', main: true, fn: () => { orbit = !orbit; } },
    isNight() && { t: '點亮燈塔', fn: () => { beamOn(); sfx('chime'); msg('燈塔的光掃過海面，好像在幫迷路的船指路。'); } },
    duo() && { t: '說愛你', fn: () => { me().av.emote('kiss', 1.6); setTimeout(() => you().av.emote('shy', 1.6), 400); burst('heart', midPos(1.2), 12, 0.5); addLove(4, '在燈塔頂說了愛你', 'lhlove'); } }]);
  const beamOn = () => { if (beam) return; beam = new THREE.Mesh(new THREE.ConeGeometry(3, 26, 24, 1, true), new THREE.MeshBasicMaterial({ color: '#fff3c0', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide, fog: false })); beam.geometry.translate(0, -13, 0); beam.rotation.z = Math.PI / 2; const g = new THREE.Group(); g.position.set(LH.x, 9.9, LH.z); g.add(beam); OUT.add(g); beam.userData.g = g; };
  /* 1. 走到塔門口 */
  actGo(() => who.forEach((c, i) => { c.locked = true; c.path = null; c.av.setPose('stand'); c.av.holdHand(0); c.x = door[0] + i * 0.5; c.z = door[1] + i * 0.3; c.y = null; c.ry = Math.atan2(LH.x - c.x, LH.z - c.z); c.moving = false; }));
  sfx('door-open');
  beginAct('lighthouse', '🗼 燈塔', '推開門，沿著裡面的樓梯往上走……', {
    back: LH_AT, camK: 0.9,
    update(dt) {
      t += dt;
      if (stage === 0 && t > 0.7) { stage = 1; who.forEach(c => { c.av.root.scale.setScalar(0.001); }); } /* 2. 進門（人先不見），腳步聲 */
      if (stage === 1) { if (Math.floor(t * 3) !== Math.floor((t - dt) * 3)) sfx('wood');
        if (t > 1.0 && !act.up) { act.up = 1; who.forEach((c, i) => { const [x, z] = side(who.length > 1 ? (i ? 0.5 : -0.5) : 0); c.x = x; c.z = z; c.y = LH.top; c.ry = face; c.glide = null; }); view.yaw = face; view.pitch = 0.3; } /* 鏡頭開始沿著塔往上移 */
        if (t > 3.6) { stage = 2; who.forEach(c => { c.av.root.scale.setScalar(1); c.av.emote('cheer', 1.2); }); burst('star', headPos(me(), 1.2), 10, 0.5); sfx('chime'); msg(isNight() ? '整座小島都在腳下，海上一片星光。' : '整座小島都在腳下，海好藍。'); btns(); } } /* 3. 出現在陽台 */
      if (orbit) view.yaw += dt * 0.25; if (beam) beam.userData.g.rotation.y += dt * 0.9;
    },
    end() { who.forEach(c => { c.av.root.scale.setScalar(1); }); if (beam) OUT.remove(beam.userData.g); if (stage === 2 && st.lhDay !== st.day) { st.lhDay = st.day; addLove(3); addMemo('🗼', duo() ? '一起爬上燈塔看整座小島' : '爬上燈塔看整座小島'); } },
  });
  setBtns([]);
}
/* ---------- 帳篷：鑽進去躺一下 ---------- */
function actTent() {
  const x = 15.6, z = 9.2, a = -0.7, fx = Math.sin(a), fz = Math.cos(a), y = standH(x, z) + 0.06;
  actGo(() => { seat(me(), x - fx * 0.2 - fz * 0.3, y, z - fz * 0.2 + fx * 0.3, a + Math.PI, 'lie'); if (duo()) seat(you(), x - fx * 0.2 + fz * 0.3, y, z - fz * 0.2 - fx * 0.3, a + Math.PI, 'lie'); }, 250);
  beginAct('tent', '⛺ 帳篷', isNight() ? '躺在帳篷裡，從門口看得到星星。' : '帳篷裡涼涼的，好想睡午覺。', {
    focus: () => new THREE.Vector3(x + fx * 0.6, y + 0.5, z + fz * 0.6), back: [x + fx * 2, z + fz * 2], camYaw: a, camPitch: 0.55, near: () => 0.75, /* 從帳篷門口看進去 */
    btns: [{ t: isNight() ? '數星星' : '小睡一下', main: true, fn: () => restScreen(isNight() ? '✨' : '💤', isNight() ? '一顆、兩顆、三顆……' : '睡了一下下', () => { if (st.tentDay !== st.day) { st.tentDay = st.day; addLove(3); addMemo('⛺', '在帳篷裡躺了一會兒'); } }) },
      duo() && { t: '說悄悄話', fn: () => { you().av.emote('shy', 1.4); burst('heart', midPos(0.5), 5, 0.3); addLove(2, pick(['「好喜歡這樣跟你待著」', '「下次一起去露營」', '「你的手好暖」']), 'tentw'); } }],
  });
}
/* ---------- 海灘球：踢一下 ---------- */
let ballV = null;
function kickBall() {
  const b = W?.ball; if (!b) return; const p = me(), dx = b.position.x - p.x, dz = b.position.z - p.z, L = Math.hypot(dx, dz) || 1;
  me().av.emote('throw', 0.6); sfx('plop'); ballV = { vx: dx / L * 5, vz: dz / L * 5, vy: 3.2 };
}
function tickBall(dt) {
  const b = W?.ball; if (!b || !ballV) return; const v = ballV; b.position.x += v.vx * dt; b.position.z += v.vz * dt; b.position.y += v.vy * dt; v.vy -= 9 * dt;
  const gy = Math.max(standH(b.position.x, b.position.z), 0) + 0.18; if (b.position.y < gy) { b.position.y = gy; v.vy = Math.abs(v.vy) * 0.45; v.vx *= 0.7; v.vz *= 0.7; if (Math.abs(v.vy) < 0.4 && Math.hypot(v.vx, v.vz) < 0.2) ballV = null; }
  b.rotation.x += v.vz * dt * 2; b.rotation.z -= v.vx * dt * 2;
  if (!walkable(b.position.x, b.position.z)) { v.vx *= -1; v.vz *= -1; }
}
/* ---------- 櫻花樹：搖一搖 ---------- */
function shakeTree(x, z) {
  me().av.emote('interact', 1); sfx('whoosh'); const y = standH(x, z);
  burst('heart', new THREE.Vector3(x, y + 2.6, z), 14, 1.6);
  const k = 'tree' + x; st.useDay = st.useDay?.d === st.day ? st.useDay : { d: st.day, k: [] };
  if (!st.useDay.k.includes(k)) { st.useDay.k.push(k); const r = Math.random(); if (r < 0.35) { addCoins(8); toast('🌸 花瓣飄下來，還掉下幾枚小島幣！'); } else toast('🌸 櫻花瓣像雪一樣飄下來'); addLove(1); } else toast('🌸 花瓣輕輕飄落');
}

// ================= 聖誕季（12/1–1/6）：小島自動換上聖誕裝、商店聖誕限定、平安夜和聖誕節聖誕老公公來訪 =================
const xmasSeason = (d = st.day) => { const t = dateOfDay(d), m = t.getUTCMonth() + 1, day = t.getUTCDate(); return m === 12 || (m === 1 && day <= 6); };
const santaDay = () => { const t = dateOfDay(st.day); return t.getUTCMonth() === 11 && (t.getUTCDate() === 24 || t.getUTCDate() === 25); };
const SEASON = { on: null, out: null, in: null, santa: null, elf: null, loading: false };
/* 小木屋門口：一棵掛滿聖誕球的樹、兩支花圈路燈、拐杖糖步道；屋裡茶几上一間薑餅屋、角落一棵小聖誕樹 */
async function drawSeason() {
  if (!W || SEASON.loading) return; const want = xmasSeason();
  if (SEASON.on === want && (!want || SEASON.out)) { if (want && IN && !SEASON.in) await seasonIn(); return; }
  SEASON.loading = true; SEASON.on = want;
  [SEASON.out, SEASON.in].forEach(g => g?.parent?.remove(g)); SEASON.out = SEASON.in = null;
  if (want) {
    const g = new THREE.Group(), put = async (k, x, z, ry = 0, s = 1) => { const m = await load(k); if (!m) return; const o = cloneModel(m); o.position.set(x, standH(x, z), z); o.rotation.y = ry; o.scale.setScalar(s); g.add(o); return o; };
    await Promise.all([put('xmas-fir-tree', -4.6, -2.3, 0.4, 1), put('garland-lamp-post-af02f0', -1.5, -2.2, 0, 0.7), put('garland-lamp-post-af02f0', 1.5, -2.2, 0, 0.7), put('candy-cane-path-markers-2310e4', -1.1, 0.4, Math.PI / 2), put('candy-cane-path-markers-2310e4', 1.1, 0.4, Math.PI / 2)]);
    OUT.add(g); SEASON.out = g; if (IN) await seasonIn();
  }
  SEASON.loading = false; tickSanta(0, true);
}
async function seasonIn() {
  const g = new THREE.Group(), put = async (k, x, y, z, ry = 0, s = 1) => { const m = await load(k); if (!m) return; const o = cloneModel(m); o.position.set(x, y, z); o.rotation.y = ry; o.scale.setScalar(s); g.add(o); };
  await Promise.all([put('xmas-fir-tree', 3.3, 0, -1.1, 0.3, 0.68), put('gingerbread-house-8b9049', 0.15, 0.43, -2.5, 0.5, 0.8), put('candy-cane-eb113b', -0.35, 0.44, -2.35, 1.2, 2)]);
  if (IN && xmasSeason()) { IN.S.add(g); SEASON.in = g; }
}
/* 聖誕老公公（平安夜、聖誕節）和精靈（整個十二月）在小木屋附近走來走去 */
let santaT = 0;
async function tickSanta(dt, force) {
  santaT -= dt; if (santaT > 0 && !force) return; santaT = 5;
  const wantS = santaDay() && started(), wantE = xmasSeason() && dateOfDay(st.day).getUTCMonth() === 11 && started();
  const spawn = async (key, x, z) => { const a = await animal(OUT, key, x, z, { s: 1, roam: 3, speed: 0.5 }); return a; };
  const drop = a => { if (!a) return; OUT.remove(a.o); const i = animals.indexOf(a); if (i >= 0) animals.splice(i, 1); };
  if (wantS && !SEASON.santa) SEASON.santa = await spawn('santa-0e0332', -3.2, 0.2); else if (!wantS && SEASON.santa) { drop(SEASON.santa); SEASON.santa = null; }
  if (wantE && !SEASON.elf) SEASON.elf = await spawn('elf-carrying-presents-d2dda9', -5.6, -0.6); else if (!wantE && SEASON.elf) { drop(SEASON.elf); SEASON.elf = null; }
}
function santaGift() {
  const a = SEASON.santa; if (a) { a.hold = 4; a.o.rotation.y = Math.atan2(me().x - a.o.position.x, me().z - a.o.position.z); }
  me().av.emote('wave', 1.2); const key = 'santa' + dateOfDay(st.day).getUTCFullYear(), got = st.santaGot?.[key]?.includes(myIdx());
  if (got) { toast('🎅 聖誕老公公：「Ho ho ho！明年再見囉，要一直相親相愛喔！」', 4500); return; }
  const it = DECOR.find(d => d[0] === pick(['xmas-fir-tree', 'garland-lamp-post-af02f0', 'snow-laden-spruce-36716e', 'wooden-toboggan-940bbc', 'gingerbread-house-8b9049']));
  st.inv = st.inv || {}; st.inv[it[0]] = (st.inv[it[0]] || 0) + 1; st.santaGot = st.santaGot || {}; st.santaGot[key] = [...(st.santaGot[key] || []), myIdx()];
  addCoins(100); addLove(8, null, 'fest'); addMemo('🎅', `聖誕老公公送了 ${nameOf(myIdx())} 一份禮物：${it[1]}`); save(); burst('star', headPos(me(), 1.3), 16, 0.6); sfx('chime');
  openDlg('🎅 聖誕老公公的禮物', `<div class="fest-card"><span>🎁</span><b>Ho ho ho！聖誕快樂！</b><p>「這是給你們小島的禮物——<b class="nw">${esc(it[1])}</b><br>今年也要一直相親相愛喔。」</p></div><p class="muted">禮物已經放進裝潢的包包裡，還有 🪙 100。</p><button type="button" class="primary" id="sg-ok">謝謝聖誕老公公 ♥</button>`);
  $('#sg-ok').onclick = () => $('#dlg').close();
}

// ================= 一起養的愛情樹 =================
const TREE_STAGES = [[0, '小芽'], [3, '幼苗'], [7, '小樹苗'], [13, '小樹'], [21, '開花了'], [31, '結出愛心果']];
const treeG = () => st.tree?.g || 0;
const treeStage = () => { let s = 0; TREE_STAGES.forEach(([n], i) => { if (treeG() >= n) s = i; }); return s; };
const treeLonely = () => !!st.tree?.last && st.tree.last < st.day - 1;
const treeCaredByMe = () => st.tree?.care?.day === st.day && st.tree.care.by.includes(myIdx());
function treeFruits() { const t = st.tree; if (!t || treeStage() < 5) return 0; if (!t.fruit || (t.fruit.n <= 0 && st.day - t.fruit.day >= 2)) t.fruit = { day: st.day, n: 3 }; return t.fruit.n; }
function drawTree() {
  if (!W) return; if (W.tree) OUT.remove(W.tree);
  const s = treeStage(), g = new THREE.Group(), { x, z } = TREE; g.position.set(x, standH(x, z), z); OUT.add(g); W.tree = g;
  const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 0.08, 18), toon('#8a6446')); soil.position.y = 0.03; g.add(soil);
  const bark = toon('#8a5a3a'), leafs = [toon('#9bd27a'), toon('#86c46a'), toon('#a9dc86')];
  if (s === 0) { [-1, 1].forEach(k => { const l = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), leafs[0]); l.scale.set(1.4, 0.4, 0.8); l.position.set(k * 0.06, 0.16, 0); l.rotation.z = k * 0.5; g.add(l); }); const st_ = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.14, 5), leafs[1]); st_.position.y = 0.1; g.add(st_); }
  else {
    const H = [0, 0.55, 1.0, 1.6, 2.1, 2.4][s], r = 0.03 + s * 0.035;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.7, r, H, 8), bark); trunk.position.y = H / 2; g.add(trunk);
    const n = 1 + s, R = 0.18 + s * 0.17;
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, d = i === 0 ? 0 : R * 0.55; const f = new THREE.Mesh(new THREE.SphereGeometry(R * (i === 0 ? 1 : 0.75), 12, 10), leafs[i % 3]); f.position.set(Math.cos(a) * d, H + (i === 0 ? R * 0.35 : 0), Math.sin(a) * d); g.add(f); }
    // 開花：花朵貼在樹冠表面（不要被葉子蓋住）；結果：愛心果掛在樹冠下緣外側
    const C = new THREE.Vector3(0, H + R * 0.35, 0);
    if (s >= 4) for (let i = 0; i < 26; i++) { const a = i * 2.39996, e = 0.25 + (i % 7) / 7 * 1.05; const b = new THREE.Mesh(new THREE.SphereGeometry(0.075, 7, 5), toon(i % 3 ? '#ffb8cc' : '#fff0f5')); b.position.set(Math.cos(a) * Math.sin(e), Math.cos(e), Math.sin(a) * Math.sin(e)).multiplyScalar(R * 1.03).add(C); g.add(b); }
    if (s >= 5) for (let i = 0; i < treeFruits(); i++) { const h = heartMesh(0.13, toon('#ff5a8a')); const a = i * 2.1 + 0.5; h.position.set(Math.cos(a) * R * 1.25, H - R * 0.15, Math.sin(a) * R * 1.25); h.lookAt(0, h.position.y, 0); h.rotateY(Math.PI); g.add(h); const st_ = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.18, 4), bark); st_.position.set(h.position.x, h.position.y + 0.17, h.position.z); g.add(st_); }
  }
  // Lv6：樹下長椅
  if (LV().lv >= 8 && !W.treeBench) one(OUT, 'logBench', x + 1.7, z + 0.2, -Math.PI / 2, 1, { col: 0 }).then(o => { W.treeBench = o; });
}
function actTree() {
  if (MP.role === 'g') return toast('這是島主一起照顧的樹喔');
  const t = st.tree = st.tree || { g: 0 }, s0 = treeStage(); if (t.care?.day !== st.day) t.care = { day: st.day, by: [] };
  me().ry = Math.atan2(TREE.x - me().x, TREE.z - me().z);
  const next = TREE_STAGES[s0 + 1]?.[0];
  const status = () => `${TREE_STAGES[treeStage()][1]}${TREE_STAGES[treeStage() + 1] ? `（成長 ${treeG()}／${TREE_STAGES[treeStage() + 1][0]}）` : ''} · 今天：${t.care.by.length ? t.care.by.map(i => nameOf(i)).join('、') + ' 來照顧過' : '還沒有人來'}`;
  const btns = () => setBtns([
    { t: treeCaredByMe() ? '今天照顧過了' : '澆水', s: treeCaredByMe() ? '明天再來' : '陪小樹說說話', main: true, dis: treeCaredByMe(), fn: water },
    treeFruits() > 0 && { t: `🍓 摘愛心果（還有 ${treeFruits()} 顆）`, fn: pickFruit },
  ]);
  function water() {
    if (treeCaredByMe()) return; me().av.emote('water', 2.2); sfx('water');
    t.care.by.push(myIdx()); t.g = treeG() + 1; t.last = st.day; const both = t.care.by.includes(0) && t.care.by.includes(1);
    if (both) { t.g += 1; addMemo('🌳', '兩個人今天都來照顧愛情樹了'); }
    addLove(both ? 3 : 2, null, 'tree'); burst('heart', W.tree.position.clone().add(new THREE.Vector3(0, 1.2, 0)), both ? 10 : 5);
    const s1 = treeStage(); save(); drawTree();
    if (s1 > s0) { setTimeout(() => toast(`🌳 愛情樹長大了：${TREE_STAGES[s1][1]}！`, 4000), 600); addMemo('🌳', `愛情樹長大了：${TREE_STAGES[s1][1]}`); sfx('chime'); }
    msg(both ? '兩個人今天都來看小樹了，它長得特別快 ✨ ' + status() : `小樹喝飽水了。${MP.on ? '' : ''}另一半今天也來照顧的話，會長得更快。 ` + status()); btns();
  }
  function pickFruit() { if (treeFruits() <= 0) return; t.fruit.n--; me().av.emote('pickup', 1.2); addLove(3, '甜甜的愛心果'); addCoins(8); save(); drawTree(); btns(); }
  beginAct('tree', '🌳 我們的愛情樹', (treeLonely() ? '小樹好幾天沒看到你們了，有點想你們。' : '你們一起種的樹，每天各照顧一次就會慢慢長大。') + ' ' + status(), {
    focus: () => W.tree.position.clone().add(new THREE.Vector3(0, 1, 0)), back: [TREE.x, TREE.z + 1.4],
  });
  btns();
}
// 樹下長椅（Lv6）
function actTreeBench() {
  const x = TREE.x + 1.7, z = TREE.z + 0.2, y = standH(x, z) + 0.46 - HIP;
  actGo(() => { sitPair(x, y, z, -Math.PI / 2, 0.62); me().av.lean(1); }, 250);
  beginAct('treebench', '🪵 樹下長椅', duo() ? '靠在一起，看著你們種的樹。' : '坐在樹下，想著另一半。', {
    focus: () => new THREE.Vector3(TREE.x, standH(TREE.x, TREE.z) + 1.2, TREE.z), back: [x, z + 1.2],
    btns: [{ t: duo() ? '靠在肩膀上' : '發呆一下', main: true, fn: () => { you().av.lean(-1); burst('heart', midPos(0.9), 5); addLove(2, null, 'bench'); } }],
  });
}
// Lv7：夜空的愛心星座
function makeHeartStars() {
  const pts = []; for (let i = 0; i < 46; i++) { const t = i / 46 * Math.PI * 2; pts.push(16 * Math.sin(t) ** 3 * 5, (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * 5 + 190, -330); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const m = new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffd6e4', size: 3.2, sizeAttenuation: false, transparent: true, opacity: 0.9, fog: false, depthWrite: false })); m.visible = false; OUT.add(m); return m;
}
let heartStars = null;
setInterval(() => { if (!W) return; const on = isNight() && LV().lv >= 9; if (on && !heartStars) heartStars = makeHeartStars(); if (heartStars) heartStars.visible = on; }, 2000);

// ================= 紀念日、相片牆、成長解鎖 =================
const ANNIV = [30, 50, 100, 200, 300, 365, 500, 520, 730, 1000, 1314];
const ANNIV_LETTER = ['謝謝你出現在我的生命裡，\n把每一個普通的日子都變得好特別。\n以後也請多多指教。', '還記得第一次見面嗎？\n那時候怎麼會知道，\n我們會一起走到今天。', '一起吃過的飯、看過的夕陽、吵過的架，\n都是我最珍惜的回憶。\n往後的每一天也要一起過。'];
function annivCheck() {
  const d = daysTogether(); if (!d || MP.role === 'g') return false;
  const hit = ANNIV.includes(d) || d % 100 === 0 || (d > 365 && d % 365 === 0);
  if (!hit || st.annivSeen === d) return false; st.annivSeen = d;
  const label = d % 365 === 0 ? `${d / 365} 週年` : `${d} 天`;
  addCoins(100); addLove(10, null, 'anniv'); addMemo('🎉', `在一起 ${label} 了`); save();
  openDlg(`🎉 在一起 ${label}了！`, `<p class="letter">${esc(nameOf(1 - myIdx()))}：<br>${esc(ANNIV_LETTER[d % ANNIV_LETTER.length]).replace(/\n/g, '<br>')}<br>— ${esc(nameOf(myIdx()))}</p>
    <p class="muted">紀念日禮物：🪙 100、甜蜜值 +10</p><button type="button" class="primary" id="an-fw">🎆 到沙灘一起放煙火</button>`);
  $('#an-fw').onclick = async () => { $('#dlg').close(); const s = SP.find(x => x.id === 'beach'); await teleportTo(s); for (let i = 0; i < 7; i++) setTimeout(() => launchFirework(true), 600 + i * 650); };
  heartRain(); sfx('chime'); return true;
}
// 相片牆：拍照時存一張小縮圖（最新 6 張），掛在電視上面
function savePhotoThumb(canvas) {
  try {
    const c = document.createElement('canvas'); c.width = 200; c.height = 150; const g = c.getContext('2d');
    const sw = canvas.width, sh = canvas.height, k = Math.min(sw / 4, sh / 3); g.drawImage(canvas, (sw - k * 4) / 2, (sh - k * 3) / 2, k * 4, k * 3, 0, 0, 200, 150);
    st.photos = [{ src: c.toDataURL('image/jpeg', 0.7), d: dateStr() }, ...(st.photos || [])].slice(0, 6); save(); drawPhotos();
  } catch (e) {}
}
function drawPhotos() {
  if (!IN?.backWall) return; if (IN.photoG) IN.backWall.remove(IN.photoG); const g = new THREE.Group(); IN.photoG = g; IN.backWall.add(g);
  const frameM = toon('#c9a77e'), L = new THREE.TextureLoader();
  (st.photos || []).forEach((p, i) => {
    const x = -0.78 + (i % 3) * 0.78, y = 2.42 - Math.floor(i / 3) * 0.58;
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.5, 0.03), frameM); f.position.set(x, y, 0.13); g.add(f);
    const tex = L.load(p.src); tex.colorSpace = THREE.SRGBColorSpace;
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.42), new THREE.MeshBasicMaterial({ map: tex })); pic.position.set(x, y, 0.15); g.add(pic);
  });
}
function unlockHtml() {
  const lv = LV().lv;
  return `<b>💗 成長解鎖</b><p class="muted">每一級都要「一起玩的天數」和甜蜜值都到了才會升級；甜蜜值每天最多累積 ${LOVE_CAP}（問答、節日、紀念日不算在內）。</p>${LEVELS.map(([days, love, title, what], i) => { const L = i + 1, ok = lv >= L; return `<div class="quest ${ok ? 'ok' : ''}"><span class="q-e">${ok ? '✅' : '🔒'}</span><b>Lv${L} ${esc(title)}</b><span class="q-r">${days ? `${days} 天・` : ''}${love}</span><small>${esc(what)}</small></div>`; }).join('')}`;
}
// 每天第一次打開：紀念日 → 今日驚喜
function dailyCheck() { if (MP.role === 'g') return; if ($('#dlg').open || act) return void setTimeout(dailyCheck, 3000); /* 正在看別的視窗：等關掉再跳節日、紀念日 */ countPlayDay(); if (!annivCheck() && !festivalCheck()) announceSurprise(); }
// ================= 節日與月記念：當天第一次上島時送上祝福和禮物，島上也會有節日的樣子 =================
function monthAnniv() {
  if (!st.anniv) return null; const a = new Date(st.anniv + 'T00:00:00'), t = dateOfDay(st.day);
  if (a.getDate() !== t.getUTCDate()) return null;
  const m = (t.getUTCFullYear() - a.getFullYear()) * 12 + t.getUTCMonth() - a.getMonth(); return m > 0 && m % 12 ? m : null;
}
function festivalCheck() {
  if (MP.role === 'g' || !started()) return false; const key = dayDate(), f = festToday(), mm = monthAnniv();
  if (st.festSeen === key || (!f && !mm)) return false; st.festSeen = key;
  const title = f ? `${f.name}快樂！` : `在一起 ${mm} 個月了`, text = f ? f.msg : `${mm} 個月前的今天，你們在一起了。謝謝你一直在。`;
  addCoins(f ? 60 : 40); addLove(f ? 8 : 5, null, 'fest'); addMemo(f ? f.icon : '💗', f ? `一起過了${f.name}` : `在一起 ${mm} 個月`); save();
  openDlg(f ? `🎉 ${f.name}` : '💗 月記念', `<div class="fest-card"><span>${f ? f.icon : '💗'}</span><b>${esc(title)}</b><p>${esc(text)}</p></div><p class="muted">節日禮物：🪙 ${f ? 60 : 40}、甜蜜值 +${f ? 8 : 5}</p><button type="button" class="primary" id="fest-ok">好 ♥</button>`);
  $('#fest-ok').onclick = () => $('#dlg').close(); heartRain(); sfx('chime'); return true;
}
// 節日的樣子：晚上放煙火、天燈、南瓜燈（每支手機自己放，不用連線同步）
const FEST = { t: 0, lanterns: null, pumpkins: null };
function tickFestival(dt) {
  const f = started() && scene === 'out' ? festToday() : null, night = isNight() || st.tod >= 18;
  if (f?.fx === 'fw' && night) { FEST.t -= dt; if (FEST.t <= 0) { FEST.t = rand(2.5, 6); launchFirework(Math.random() < 0.3, true); } }
  const wantL = f?.fx === 'lantern' && night;
  if (wantL && !FEST.lanterns) {
    FEST.lanterns = new THREE.Group(); const m = new THREE.MeshBasicMaterial({ color: '#ffb35c', transparent: true, opacity: 0.92 });
    for (let i = 0; i < 48; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.32, 0.8, 8), m); const a = Math.random() * 6.28, r = rand(4, 24); l.position.set(Math.cos(a) * r, rand(1.5, 18), Math.sin(a) * r); l.userData.v = rand(0.3, 0.7); FEST.lanterns.add(l); }
    OUT.add(FEST.lanterns);
  }
  if (!wantL && FEST.lanterns) { OUT.remove(FEST.lanterns); FEST.lanterns = null; }
  if (FEST.lanterns) FEST.lanterns.children.forEach(l => { l.position.y += l.userData.v * dt; l.position.x += Math.sin(l.position.y * 0.3) * dt * 0.2; if (l.position.y > 22) l.position.y = 1.5; });
  const wantP = f?.fx === 'pumpkin';
  if (wantP && !FEST.pumpkins) { /* 萬聖節：真的南瓜燈（雕了臉、會發光） */
    FEST.pumpkins = new THREE.Group(); OUT.add(FEST.pumpkins);
    load('jack-o-lantern-0b1ddb').then(m => { if (!m || !FEST.pumpkins) return; [[2.4, 3.2, 0.3], [-2.6, 3.4, -0.4], [6, 5, 1], [-7, 6, -1], [0.5, 9, 0.2], [-1.4, -2.6, 0], [1.4, -2.6, 0]].forEach(([x, z, r]) => { const o = cloneModel(m); o.position.set(x, standH(x, z), z); o.rotation.y = Math.PI + r; FEST.pumpkins.add(o); const l = new THREE.PointLight('#ff8a2a', 0.8, 3, 2); l.position.set(x, standH(x, z) + 0.3, z); if (FEST.pumpkins.children.length < 6) FEST.pumpkins.add(l); }); });
  }
  if (!wantP && FEST.pumpkins) { OUT.remove(FEST.pumpkins); FEST.pumpkins = null; }
}

// ================= 回來時狗狗撲過來（不歸零的「來小島的天數」） =================
function dogWelcome() {
  if (MP.role === 'g') return; const last = st.lastDayHere, gap = last ? st.day - last : 0;
  if (last !== st.day) { st.visitDays = (st.visitDays || 0) + 1; st.lastDayHere = st.day; save(); }
  const d = W.dog; if (!last || gap < 1 || !d || scene !== 'out') return;
  const p = me(); d.o.position.set(p.x + 5, standH(p.x + 5, p.z + 3), p.z + 3); d.tx = p.x + 0.7; d.tz = p.z + 0.5; d.t = 3;
  setTimeout(() => {
    p.av.emote('petdog', 2); burst('heart', d.o.position.clone().add(new THREE.Vector3(0, 0.8, 0)), gap >= 3 ? 12 : 7); sfx('pop');
    toast(gap >= 3 ? `🐶 ${gap} 天沒見，狗狗開心到一直轉圈圈！` : '🐶 狗狗衝過來撲到你身上：好想你！', 4000); addLove(2, null, 'dogwelcome');
  }, 2200);
}

// ================= 一起拼的拼圖（每人每天放 3 片，慢慢拼完） =================
const PZ = { cols: 4, rows: 3, perDay: 3 };
function puzzle() { if (!st.puzzle || st.puzzle.placed?.length !== PZ.cols * PZ.rows) st.puzzle = { src: st.photos?.[0]?.src || '', placed: Array(PZ.cols * PZ.rows).fill(0), day: 0, n: [0, 0], done: st.puzzle?.done || 0 }; return st.puzzle; }
const pzLeftToday = () => { const z = puzzle(); return PZ.perDay - (z.day === st.day ? z.n[myIdx()] : 0); };
// 沒有照片時的預設圖：小島夕陽
function pzDefaultImg() {
  const c = document.createElement('canvas'); c.width = 400; c.height = 300; const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 180); sky.addColorStop(0, '#ffb3a7'); sky.addColorStop(1, '#ffe2b8'); g.fillStyle = sky; g.fillRect(0, 0, 400, 300);
  g.fillStyle = '#ffd36e'; g.beginPath(); g.arc(270, 160, 46, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#6fb6d8'; g.fillRect(0, 170, 400, 130); g.fillStyle = '#f3e2b3'; g.beginPath(); g.ellipse(120, 250, 150, 50, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#7cc46a'; g.beginPath(); g.ellipse(110, 235, 90, 30, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ff5a8a'; g.font = '64px serif'; g.fillText('♥', 180, 110); return c.toDataURL('image/jpeg', 0.8);
}
function drawPuzzle() {
  if (!IN) return; if (IN.pzG) IN.S.remove(IN.pzG); const z = puzzle(), g = new THREE.Group(); IN.pzG = g; IN.S.add(g);
  const W_ = 0.8, H_ = 0.6, cw = W_ / PZ.cols, ch = H_ / PZ.rows;
  const board = new THREE.Mesh(new THREE.BoxGeometry(W_ + 0.06, 0.015, H_ + 0.06), toon('#e9dcc6')); board.position.set(PZ_AT.x, PZ_AT.y, PZ_AT.z); g.add(board);
  const tex = new THREE.TextureLoader().load(z.src || pzDefaultImg()); tex.colorSpace = THREE.SRGBColorSpace;
  z.placed.forEach((on, i) => {
    const cx = i % PZ.cols, cy = Math.floor(i / PZ.cols), x = PZ_AT.x - W_ / 2 + cw * (cx + 0.5), zz = PZ_AT.z - H_ / 2 + ch * (cy + 0.5);
    if (on) { const geo = new THREE.PlaneGeometry(cw * 0.97, ch * 0.97), uv = geo.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, (cx + uv.getX(k)) / PZ.cols, 1 - (cy + 1 - uv.getY(k)) / PZ.rows); const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex })); m.rotation.x = -Math.PI / 2; m.position.set(x, PZ_AT.y + 0.011, zz); g.add(m); }
    else { const m = new THREE.Mesh(new THREE.PlaneGeometry(cw * 0.9, ch * 0.9), toon('#d6c3a5')); m.rotation.x = -Math.PI / 2; m.position.set(x, PZ_AT.y + 0.009, zz); g.add(m); }
  });
  // 旁邊還沒拼的散落拼圖片
  const left = z.placed.filter(v => !v).length; for (let i = 0; i < Math.min(left, 6); i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.012, 0.12), toon(['#ffd3a8', '#bfe0f0', '#f6c6d0'][i % 3])); m.position.set(PZ_AT.x + 0.52 + (i % 2) * 0.14, PZ_AT.y - 0.005, PZ_AT.z - 0.2 + Math.floor(i / 2) * 0.16); m.rotation.y = i * 0.7; g.add(m); }
}
function actPuzzle() {
  if (MP.role === 'g') return; const y = 0.06 - HIP;
  actGo(() => { seat(me(), PZ_AT.x + 0.85, y, PZ_AT.z, -Math.PI / 2, 'floor'); seat(you(), PZ_AT.x - 0.85, y, PZ_AT.z, Math.PI / 2, 'floor'); }, 250);
  const prog = () => { const z = puzzle(), n = z.placed.filter(Boolean).length; return `目前拼了 ${n}／${z.placed.length} 片${z.done ? `，已經拼完 ${z.done} 幅` : ''}。`; };
  const complete = () => puzzle().placed.every(Boolean);
  const btns = () => setBtns(complete() ? [{ t: '🖼️ 換一幅新的拼圖', main: true, fn: () => { const d = st.puzzle.done; st.puzzle = null; puzzle().done = d; puzzle().src = st.photos?.[0]?.src || ''; save(); drawPuzzle(); msg('新的拼圖倒在茶几上了。' + prog()); btns(); } }]
    : [{ t: '放一片', s: pzLeftToday() > 0 ? `今天還能放 ${pzLeftToday()} 片` : '明天再一起拼', main: true, dis: pzLeftToday() <= 0, fn: place }]);
  function place() {
    if (pzLeftToday() <= 0) return; const z = puzzle(); if (z.day !== st.day) { z.day = st.day; z.n = [0, 0]; }
    const empty = z.placed.map((v, i) => v ? -1 : i).filter(i => i >= 0); const i = pick(empty); z.placed[i] = 1; z.n[myIdx()]++;
    me().av.reach(true); setTimeout(() => me().av.reach(false), 500); sfx('click'); drawPuzzle(); addLove(1, null, 'puzzle');
    if (complete()) { z.done++; addLove(10, '拼圖拼完了！'); addCoins(50, '一起拼完一幅拼圖'); addMemo('🧩', '一起拼完了一幅拼圖'); burst('star', new THREE.Vector3(PZ_AT.x, 0.9, PZ_AT.z), 14); sfx('chime'); msg('拼完了！好有成就感 ✨ ' + prog()); }
    else msg((pzLeftToday() <= 0 ? '今天先拼到這裡，明天再一起拼。' : '找到對的位置了！') + ' ' + prog());
    save(); btns();
  }
  beginAct('puzzle', '🧩 一起拼拼圖', `坐在茶几旁邊慢慢拼。${st.photos?.length ? '圖案是你們最近拍的合照。' : '拍了合照之後，新的拼圖就會是你們的照片。'} ` + prog(), {
    focus: () => new THREE.Vector3(PZ_AT.x, 0.6, PZ_AT.z), back: [PZ_AT.x + 1.4, PZ_AT.z + 0.6],
  });
  btns();
}

// ================= 升級解鎖的新地方：Lv3 海邊小屋、Lv5 花園溫室 =================
const placeOpen = k => LV().lv >= PLACES[k].lv || (st.keepPlaces || []).includes(k); /* 改等級制度前就已經開放的地點不會再鎖回去 */
function drawPlaces() {
  if (!W) return;
  for (const [k, P] of Object.entries(PLACES)) {
    if (!placeOpen(k) || W['place_' + k]) continue; W['place_' + k] = 1;
    one(OUT, P.key, P.x, P.z, P.ry, P.s, {}).then(o => { W['place_' + k] = o; });
    // 碰撞：房子本體（門口留一條路）
    const hw = (P.ry ? 3 : 2) * P.s, hd = (P.ry ? 2 : 2) * P.s; BOXES.push([P.x - hw, P.z - hd, P.x + hw, P.z + hd]); delete grids.out;
  }
}
function lockedPlace(k, name) { toast(`🔒 「${name}」在 Lv${PLACES[k].lv} 解鎖，多一起做點事累積甜蜜值吧`, 3500); }
function actHut() {
  if (!placeOpen('hut')) return lockedPlace('hut', '海邊小屋');
  const P = PLACES.hut, x = P.x, z = P.z + 2.7, y = standH(x, z) + 0.06 - HIP;
  actGo(() => { seat(me(), x - 0.32, y, z, 0, 'floor'); seat(you(), x + 0.32, y, z, 0, 'floor'); me().av.lean(1); }, 250);
  beginAct('hut', '🏖️ 海邊小屋', isNight() ? '坐在小屋門口，聽著浪聲，海上有月亮的倒影。' : '坐在小屋門口的台階上，海風吹過來，好舒服。', {
    focus: () => new THREE.Vector3(x, standH(x, z) + 0.9, z), back: [x + 1.5, z + 0.8], camYaw: 0.35, camPitch: 0.32, // 從海那邊看過來：兩個人和背後的小屋
    btns: [{ t: duo() ? '靠在一起聽海' : '聽海浪的聲音', main: true, fn: () => { burst('heart', midPos(0.9), duo() ? 6 : 2); addLove(2, pick(['浪一波一波地來', '海風好溫柔', '好想一直待在這裡']), 'hut'); } }],
  });
}
function actGreenhouse() {
  if (!placeOpen('gh')) return lockedPlace('gh', '花園溫室');
  const t = st.gh?.day === st.day ? st.gh : (st.gh = { day: st.day, by: [] }), mine = t.by.includes(myIdx());
  const flower = pick([['鬱金香', '🌷'], ['玫瑰', '🌹'], ['滿天星', '💮'], ['向日葵', '🌻'], ['繡球花', '💠']]);
  beginAct('gh', '🌷 花園溫室', mine ? '今天已經摘過一束花了，花明天會再開。' : '溫室裡的花一年四季都開著，每天可以摘一束送給另一半。', {
    focus: () => new THREE.Vector3(PLACES.gh.x + 1.6, 1.1, PLACES.gh.z) /* 溫室和站在門口的人都在畫面裡 */, back: [PLACES.gh.x + 3.2, PLACES.gh.z],
    btns: [{ t: mine ? '今天摘過了' : '摘一束花', s: mine ? '花明天會再開' : `送給 ${partnerName()}`, main: true, dis: mine, fn: () => {
      t.by.push(myIdx()); st.picked = st.picked || {}; st.picked[flower[0]] = (st.picked[flower[0]] || 0) + 1; st.flowersGiven++;
      me().av.emote('pickup', 1.4); burst('heart', headPos(me(), 1.2), 6); addLove(5, `${flower[1]} 一束${flower[0]}`); addMemo('💐', `${nameOf(myIdx())} 從溫室摘了一束${flower[0]}送給 ${partnerName()}`); save();
      msg(duo() ? `${partnerName()} 收到花，開心地抱著不放 ${flower[1]}` : `把${flower[0]}放在小屋的餐桌上，${partnerName()} 回來就會看到 ${flower[1]}`); setBtns([]);
    } }],
  });
}

// ---------- 乾淨畫面：走路 1.5 秒或發呆 8 秒後介面淡出，一碰螢幕就回來 ----------
const calm = { input: performance.now(), walk: 0 };
addEventListener('pointerdown', e => { if (!e.target.closest?.('#joy')) calm.input = performance.now(); }, true);
addEventListener('keydown', () => { calm.input = performance.now(); }, true);
setInterval(() => {
  const now = performance.now(), c = started() ? me() : null, walking = !!c && c.moving && !c.locked;
  calm.walk = walking ? calm.walk || now : 0; if (joy.id == null && !walking) calm.walk = 0;
  const busy = !started() || act || $('#dlg').open || !$('#coach').hidden || photo.on || !$('#love-menu').hidden || now - calm.input < 1200;
  const on = !busy && ((calm.walk && now - calm.walk > 1500) || (!walking && now - calm.input > 8000));
  document.body.classList.toggle('calm', on);
}, 250);
// 介面風格：療癒精品（預設）／時尚雜誌／現代玻璃；字型用到才下載
const UI_STYLES = { cozy: ['療癒精品', 'family=Fredoka:wght@500;600'], editorial: ['時尚雜誌', 'family=Playfair+Display:ital,wght@0,500;0,600;1,500&family=Noto+Serif+TC:wght@500;600'] };
function applyUI(k) {
  if (!UI_STYLES[k]) k = 'cozy'; document.documentElement.dataset.ui = k;
  const id = 'font-' + k; if (!document.getElementById(id)) { const l = document.createElement('link'); l.id = id; l.rel = 'stylesheet'; l.href = `https://fonts.googleapis.com/css2?${UI_STYLES[k][1]}&display=swap`; document.head.appendChild(l); }
}
applyUI(st.ui); setBackgroundPlay(st.bgMusic !== false);
// 介面圖示
[['#btn-map', 'map'], ['#btn-book', 'book'], ['#btn-photo', 'camera'], ['#btn-music', 'music']].forEach(([q, n]) => { $(q).innerHTML = icon(n); });
document.querySelectorAll('[data-ico]').forEach(e => { e.innerHTML = icon(e.dataset.ico); });
$('#btn-net').innerHTML = icon('users'); $('#clock').innerHTML = clockHtml();

// ================= 兩個人的聊天（只有兩位島主；紀錄存在伺服器，對方不在會推播） =================
const CHAT = { list: [], pend: [], read: { 0: 0, 1: 0 }, open: false, typingT: 0, sentTyping: 0, old: false };
const STICKERS = [
  ['miss', '🥺', '想你'], ['love', '💕', '愛你'], ['hug', '🤗', '抱抱'], ['kiss', '😘', '親一個'],
  ['morning', '☀️', '早安'], ['night', '🌙', '晚安'], ['eat', '🍙', '吃飯了沒'], ['come', '🏝️', '上島嗎'],
  ['haha', '😂', '哈哈哈'], ['ok', '👌', '好喔'], ['wait', '⏳', '等我一下'], ['sorry', '🙇', '對不起嘛'],
];
const QUICK = ['在幹嘛？', '想你了 💗', '晚點上島', '我先去忙', '好～', '今天辛苦了'];
const chatPartner = () => 1 - myIdx();
const chatUnread = () => CHAT.list.filter(m => m.by === chatPartner() && m.ts > (CHAT.read[myIdx()] || 0)).length;
function chatBadge() {
  const n = chatUnread(), b = $('#chat-badge'); b.hidden = !n || CHAT.open; b.textContent = n > 9 ? '9+' : n; $('#btn-chat').classList.toggle('unread', !!n && !CHAT.open);

}
const hhmm = ts => { const d = new Date(ts); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
function chatTime(ts) { const d = new Date(ts), n = new Date(); const same = d.toDateString() === n.toDateString(), y = new Date(n - 864e5).toDateString() === d.toDateString(); return `${same ? '今天' : y ? '昨天' : `${d.getMonth() + 1}/${d.getDate()}`} ${hhmm(ts)}`; }
/* 聊天室捲動：像通訊軟體一樣「黏在最新訊息」。只要沒有自己往上捲，打字、鍵盤彈出收起、送出、收到訊息都會停在最下面；
   往上看舊訊息時收到新訊息，不會被拉下去，改成出現「↓ 新訊息」 */
CHAT.stick = true;
function chatStick(smooth) {
  const box = $('#ch-list'); if (!box) return;
  if (!CHAT.stick) return;
  const go = () => { box.scrollTo({ top: box.scrollHeight, behavior: smooth ? 'smooth' : 'auto' }); };
  go(); requestAnimationFrame(() => { go(); requestAnimationFrame(go); }); /* 版面算好之後再對齊一次 */
}
function renderChat() {
  if (!CHAT.open) return;
  const me_ = myIdx(), other = chatPartner(), online = !!chars[other]?.remote;
  $('#ch-name').textContent = nameOf(other); $('#ch-status').textContent = online ? '在島上' : '不在島上・訊息會等對方回來看'; $('#ch-dot').classList.toggle('on', online);
  const box = $('#ch-list');
  const warn = CHAT.old ? '<div class="ch-warn">⚠️ 伺服器還是舊版，訊息送不出去：請到 Cloudflare 重新部署一次（Deployments → Retry deployment）。</div>' : !MP.net?.alive ? '<div class="ch-warn">連線中斷了，重新連上後才送得出去…</div>' : '';
  if (!CHAT.list.length && !CHAT.pend.length) { box.innerHTML = warn + `<div class="ch-empty"><span>💬</span><p>這裡是只有你們兩個人看得到的聊天室。<br>傳一句話給 ${esc(nameOf(other))} 吧。</p></div>`; return; }
  const lastMineRead = [...CHAT.list].reverse().find(m => m.by === me_ && m.ts <= (CHAT.read[other] || 0));
  let html = '', prev = null;
  for (const m of [...CHAT.list, ...CHAT.pend]) {
    if (!prev || m.ts - prev.ts > 10 * 60e3) html += `<div class="ch-time">${chatTime(m.ts)}</div>`;
    const mine = m.by === me_, grouped = prev && prev.by === m.by && m.ts - prev.ts < 120e3;
    const st_ = STICKERS.find(x => x[0] === m.v);
    const body = m.k === 's' && st_ ? `<div class="ch-sticker"><span>${st_[1]}</span><b>${st_[2]}</b></div>` : `<div class="ch-bubble">${esc(m.v).replace(/\n/g, '<br>')}</div>`;
    const pst = m.fail ? `<button type="button" class="ch-retry" data-cid="${m.cid}">沒有送出・點一下重送</button>` : m.pend ? '<small class="ch-read">傳送中…</small>' : '';
    html += `<div class="ch-msg ${mine ? 'me' : 'you'} ${grouped ? 'grp' : ''} ${m.ch === 'say' ? 'said' : ''} ${m.pend ? 'pend' : ''}">${m.ch === 'say' && !grouped ? '<small class="ch-said">說出來</small>' : ''}${body}${mine && lastMineRead === m ? '<small class="ch-read">已讀</small>' : ''}${pst}</div>`;
    prev = m;
  }
  box.innerHTML = warn + html;
  box.querySelectorAll('.ch-retry').forEach(b => b.onclick = () => { const p_ = CHAT.pend.find(x => x.cid === b.dataset.cid); if (!p_) return; CHAT.pend = CHAT.pend.filter(x => x !== p_); chatSend(p_.k, p_.v, p_.w); }); chatStick();
}
function chatMarkRead() {
  const last = [...CHAT.list].reverse().find(m => m.by === chatPartner()); if (!last || last.ts <= (CHAT.read[myIdx()] || 0)) return;
  CHAT.read[myIdx()] = last.ts; if (MP.on) MP.net.send({ t: 'chatread', ts: last.ts }); chatBadge();
}
function openChat() {
  if (MP.role === 'g') return;
  if (!MP.on) { toast('先在 🌐 跟另一半連線，就能聊天了', 3500); return openNet(); }
  CHAT.open = true; CHAT.stick = true; $('#ch-new').hidden = true; const ch_ = $('#chat'); ch_.hidden = false; ch_.classList.remove('enter'); void ch_.offsetWidth; ch_.classList.add('enter'); ch_.addEventListener('animationend', () => ch_.classList.remove('enter'), { once: true }); toggleLoveMenu(false); sfx('click');
  renderChat(); chatMarkRead(); chatBadge();
}
function closeChat() { CHAT.open = false; $('#chat').hidden = true; $('#ch-stickers').hidden = true; $('#ch-stk').setAttribute('aria-pressed', 'false'); $('#ch-in').blur(); chatBadge(); }
function chatSend(k, v, w = 0) {
  if (!MP.on || !v) return; const cid = Math.random().toString(36).slice(2, 10);
  // 先顯示在聊天室（傳送中），伺服器收到才變成正式訊息；5 秒沒回應就標「沒有送出」
  const p_ = { cid, by: myIdx(), k, v, w, ts: Date.now(), ch: 'w', pend: 1 }; CHAT.pend.push(p_); CHAT.stick = true; $('#ch-new').hidden = true; renderChat(); chatStick(true); /* 自己送出：一定滑到最下面 */
  if (!MP.net?.alive) p_.fail = 1; else MP.net.send({ t: 'chat', k, v, w, cid });
  setTimeout(() => { if (CHAT.pend.includes(p_)) { p_.fail = 1; renderChat(); if (!CHAT.open) toast('訊息沒有送出，打開聊天室可以重送', 3500); } }, 5000);
  sfx('pop');
  if (k === 't') showSay(me(), v.length > 24 ? v.slice(0, 24) + '…' : v, 'w'); else { const s_ = STICKERS.find(x => x[0] === v); if (s_) showSay(me(), `${s_[1]} ${s_[2]}`, 'w'); }
}
function onChat(m) {
  if (m.cid) CHAT.pend = CHAT.pend.filter(x => x.cid !== m.cid);
  if (CHAT.list.some(x => x.id === m.id)) return; CHAT.list.push(m); if (CHAT.list.length > 300) CHAT.list.shift();
  const fromPartner = m.by === chatPartner();
  if (m.ch === 'say') { renderChat(); chatBadge(); return; } // 說出來的：頭上泡泡已經出現過，只記在聊天紀錄
  if (fromPartner) {
    $('#ch-typing').hidden = true; const c = chars[m.by], s_ = STICKERS.find(x => x[0] === m.v), text = m.k === 's' && s_ ? `${s_[1]} ${s_[2]}` : m.v;
    if (c?.remote) { showSay(c, text.length > 24 ? text.slice(0, 24) + '…' : text, 'w'); if (Math.hypot(c.x - me().x, c.z - me().z) < 2.2 && c.sc === scene) setTimeout(() => { me().av.emote('shy', 1.4); burst('heart', headPos(me(), 1.4), 3, 0.3); }, 700); }
    if (CHAT.open) chatMarkRead(); else { sfx('pop'); toast(`💬 ${nameOf(m.by)}：${text.length > 30 ? text.slice(0, 30) + '…' : text}`, 6000, () => openChat()); }
  }
  renderChat(); chatBadge(); if (CHAT.open && !CHAT.stick && fromPartner) $('#ch-new').hidden = false; /* 正在看舊訊息：用按鈕提示有新訊息 */
}
// ---- 快速輸入列：打字直接冒在頭上 ----
const QC = { ch: 'say' };
function qcLabel() { const w = QC.ch === 'w'; $('#qc-ch').innerHTML = w ? '💗 悄悄話' : '💬 說出來'; $('#qc-ch').classList.toggle('w', w); $('#qc-in').placeholder = w ? `只給 ${nameOf(chatPartner())} 看…` : '說點什麼…'; }
function openQuick() {
  if (CHAT.open) return closeChat(); if (MP.role !== 'g' && chatUnread()) return openChat(); // 有未讀：先看訊息
  QC.ch = MP.role === 'g' ? 'say' : (st.qch || 'say'); qcLabel(); $('#qc-ch').hidden = MP.role === 'g'; $('#qc-room').hidden = MP.role === 'g';
  $('#qchat').hidden = false; $('#qc-in').focus(); toggleLoveMenu(false);
}
function closeQuick() { $('#qchat').hidden = true; $('#qc-in').blur(); }
$('#qc-ch').onclick = () => { if (QC.ch === 'say' && !MP.on) { toast('先在 🌐 跟另一半連線，才能講悄悄話'); return; } QC.ch = QC.ch === 'say' ? 'w' : 'say'; st.qch = QC.ch; save(); qcLabel(); $('#qc-in').focus(); sfx('click'); };
$('#qc-room').onclick = () => { closeQuick(); openChat(); };
$('#qc-in').addEventListener('keydown', e => e.stopPropagation());
$('#qc-in').addEventListener('blur', () => setTimeout(() => { if (!$('#qchat').contains(document.activeElement) && !$('#qc-in').value.trim()) closeQuick(); }, 200));
$('#qchat').onsubmit = e => { e.preventDefault(); const v = $('#qc-in').value.trim(); if (!v) return; $('#qc-in').value = ''; speak(v, QC.ch); };
// 說出來：頭上白色泡泡（島上的人都看得到）；悄悄話：只傳給另一半，靠很近時角色會湊過去咬耳朵
function speak(v, ch) {
  if (ch === 'w') {
    if (!MP.on || MP.role === 'g') return toast('先在 🌐 跟另一半連線，才能講悄悄話');
    const q = chars[chatPartner()]; if (q?.remote && q.sc === scene && Math.hypot(q.x - me().x, q.z - me().z) < 2.2 && !me().locked) { me().ry = Math.atan2(q.x - me().x, q.z - me().z); me().av.emote('whisper', 1.8); }
    chatSend('t', v.slice(0, 200), 1); return; // w=1：在島上的朋友會看到「……」
  }
  const r = checkChat(v); if (!r.ok) return toast(CHAT_WHY[r.why] || '沒有送出');
  if (MP.on) MP.net.send({ t: 'say', text: r.text }); else showSay(me(), r.text);
  sfx('pop');
}
// ---- 表情輪盤：長按聊天按鈕，滑到想說的那一個放開 ----
const WHEEL = [['wave', '👋', '嗨～'], ['shy', '💗', '想你'], ['laugh', '😂', '哈哈哈'], ['shy', '🥺', '嗚嗚'], ['cheer', '🎉', '耶！'], ['clap', '👍', '好喔'], ['', '😴', '好睏'], ['', '🍙', '肚子餓']];
const WH = { t: 0, on: false, pick: -1, skipClick: false };
function openWheel() {
  const el = $('#wheel'), cx = innerWidth / 2, cy = innerHeight - 250, R = Math.min(118, innerWidth / 2 - 54);
  el.innerHTML = WHEEL.map(([, e, t], i) => { const a = -Math.PI / 2 + i / WHEEL.length * Math.PI * 2; return `<div class="wh-i" data-i="${i}" style="left:${cx + Math.cos(a) * R}px;top:${cy + Math.sin(a) * R}px"><span>${e}</span><b>${t}</b></div>`; }).join('') + `<div class="wh-c" style="left:${cx}px;top:${cy}px">滑過去放開</div>`;
  el.hidden = false; WH.on = true; WH.pick = -1; if (navigator.vibrate) navigator.vibrate(12); sfx('click');
}
function wheelMove(x, y) { let best = -1, bd = 70; $('#wheel').querySelectorAll('.wh-i').forEach((n, i) => { const r = n.getBoundingClientRect(), d = Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y); if (d < bd) { bd = d; best = i; } n.classList.toggle('on', false); }); WH.pick = best; if (best >= 0) $('#wheel').children[best].classList.add('on'); }
function closeWheel() {
  $('#wheel').hidden = true; WH.on = false; const it = WHEEL[WH.pick]; if (!it) return;
  if (it[0]) me().av.emote(it[0], 1.6); speak(`${it[1]} ${it[2]}`, 'say');
}
const bc = $('#btn-chat');
bc.addEventListener('pointerdown', e => { WH.skipClick = false; clearTimeout(WH.t); WH.t = setTimeout(() => { WH.skipClick = true; openWheel(); }, 420); });
addEventListener('pointermove', e => { if (WH.on) wheelMove(e.clientX, e.clientY); });
addEventListener('pointerup', () => { clearTimeout(WH.t); if (WH.on) closeWheel(); });
addEventListener('pointercancel', () => { clearTimeout(WH.t); if (WH.on) { WH.pick = -1; closeWheel(); } });
bc.addEventListener('contextmenu', e => e.preventDefault());
bc.onclick = () => { if (WH.skipClick) { WH.skipClick = false; return; } openQuick(); };
$('#ch-close').onclick = closeChat;
$('#ch-quick').innerHTML = QUICK.map(q => `<button type="button">${esc(q)}</button>`).join('');
$('#ch-quick').onclick = e => { const b = e.target.closest('button'); if (b) chatSend('t', b.textContent); };
$('#ch-stickers').innerHTML = STICKERS.map(([id, e, t]) => `<button type="button" data-s="${id}" aria-label="${t}"><span>${e}</span><b>${t}</b></button>`).join('');
$('#ch-stickers').onclick = e => { const b = e.target.closest('[data-s]'); if (b) chatSend('s', b.dataset.s); };
$('#ch-stk').onclick = () => { const on = $('#ch-stickers').hidden; $('#ch-stickers').hidden = !on; $('#ch-stk').setAttribute('aria-pressed', String(on)); if (on) $('#ch-in').blur(); };
const chIn = $('#ch-in');
chIn.addEventListener('input', () => {
  chIn.style.height = 'auto'; chIn.style.height = Math.min(110, chIn.scrollHeight) + 'px';
  if (MP.on && performance.now() - CHAT.sentTyping > 1600 && chIn.value.trim()) { CHAT.sentTyping = performance.now(); MP.net.send({ t: 'typing' }); }
});
chIn.addEventListener('focus', () => { CHAT.stick = true; chatStick(); $('#ch-stickers').hidden = true; $('#ch-stk').setAttribute('aria-pressed', 'false'); });
chIn.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); const f = $('#ch-form'); if (f.requestSubmit) f.requestSubmit(); else f.dispatchEvent(new Event('submit', { cancelable: true })); } e.stopPropagation(); });
$('#ch-form').onsubmit = e => { e.preventDefault(); const v = chIn.value.trim(); if (!v) return; chatSend('t', v); chIn.value = ''; chIn.style.height = 'auto'; };
// 只有使用者自己滑動時才判斷「是不是在最下面」（程式捲動、鍵盤造成的大小變化都不算）
(() => {
  const box = $('#ch-list'); let userT = 0; const mark = () => { userT = performance.now(); };
  ['touchstart', 'touchmove', 'wheel', 'pointerdown'].forEach(ev => box.addEventListener(ev, mark, { passive: true }));
  box.addEventListener('scroll', () => { if (performance.now() - userT > 900) return; const near = box.scrollHeight - box.scrollTop - box.clientHeight < 80; CHAT.stick = near; if (near) $('#ch-new').hidden = true; }, { passive: true });
  /* 鍵盤彈出／收起、貼圖面板、「正在輸入」讓訊息區變大變小：黏在最下面的就繼續黏著 */
  if (window.ResizeObserver) new ResizeObserver(() => { if (CHAT.open && CHAT.stick) chatStick(); }).observe(box);
  $('#ch-new').onclick = () => { CHAT.stick = true; $('#ch-new').hidden = true; chatStick(true); };
})();
/* 按送出不會讓鍵盤收起來（跟 iMessage 一樣可以一直打字；鍵盤收起來會讓整個畫面重新排版） */
['#ch-send', '#qc-send'].forEach(q => { const b_ = $(q); if (b_) ['pointerdown', 'mousedown'].forEach(ev => b_.addEventListener(ev, e => e.preventDefault())); });
// 鍵盤打開時：面板跟著往上（iPhone 的鍵盤會蓋住畫面下方）
if (window.visualViewport) {
  const vv = window.visualViewport, R_ = document.documentElement.style, fit = () => { R_.setProperty('--kb', Math.max(0, innerHeight - vv.height - vv.offsetTop) + 'px'); R_.setProperty('--vvt', vv.offsetTop + 'px'); R_.setProperty('--vvh', vv.height + 'px'); };
  vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit);
  // iPhone 打開鍵盤時會把整頁往上捲：捲回來，再重新算一次鍵盤高度，輸入框才會剛好在鍵盤上面
  ['#ch-in', '#qc-in'].forEach(q => $(q).addEventListener('focus', () => { [80, 300, 600].forEach(t => setTimeout(() => { if (q === '#qc-in') scrollTo(0, 0); fit(); }, t)); }));
  ['#ch-in', '#qc-in'].forEach(q => $(q).addEventListener('blur', () => setTimeout(fit, 300)));
  $('#ch-in').addEventListener('focus', () => $('#chat').classList.add('kb')); $('#ch-in').addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== $('#ch-in')) $('#chat').classList.remove('kb'); }, 250));
}

// ---------- 開始 ----------
(async function boot() {
  window.__modOK = true; // 給 index.html 的看門狗：程式有順利跑起來
  if (/[?&]u=/.test(location.search)) history.replaceState(null, '', location.pathname + location.search.replace(/[?&]u=\d+/, '').replace(/^&/, '?'));
  makeAv(0); makeAv(1); syncSplash(); initUpdates();
  const msgEl = $('#load-msg'), btn = $('#start-btn'); btn.disabled = true;
  if (st.started) { btn.textContent = `回到小島 ♥`; }
  const tick = setInterval(() => { msgEl.textContent = `小島載入中… ${progress.done}/${Math.max(progress.pending, 1)}`; }, 200);
  frame();
  try { W = await buildIsland(OUT); } catch (e) { console.error(e); msgEl.textContent = '載入失敗，請重新整理'; clearInterval(tick); return; }
  clearInterval(tick); msgEl.textContent = st.started ? '歡迎回來 ♥' : '準備好了！';
  btn.disabled = false;
  spawnShells(); showCastles(); st.garden.forEach((_, i) => drawPlant(i)); WX = createWeatherFX(OUT); drawEggs();
  updateCam(0, true);
  buildInterior(st.theme || 'muji').then(I => { IN = I; drawDecor(); drawNotes(); drawPhotos(); drawPuzzle(); });
  CIRCLES.push([TREE.x, TREE.z, 0.45]); drawTree(); setupSurprise(); drawPlaces();
  if (visitParam.length) setupVisit();
  else if (pairParam) setupPairSplash();
  window.__booted = true;
  window.__nest = { DSP: () => DSP, CHAT, build: () => build, buildSet: (x, z) => { build.x = x; build.z = z; buildCheck(); return [build.top, build.ok]; }, canStand: (x, z) => canStand(x, z), bond: { addLove, countPlayDay, festivalCheck, surpriseAt, surpriseNow, rareStart, MINI, RAREFX, setupSurprise, surpriseToday, actSurprise, drawTree, annivCheck, dailyCheck, checkAway, SUR, TREE }, get st() { return st; }, IN: () => IN, view, OUT, pantryText, tutorial, weatherAt, seasonOf, WX: () => WX, teleportTo, quest, openShop, cam, MP, chars, allChars, forceSave: () => save(), W: () => W, act: () => act, SP, me, you, scene: () => scene, setTod: t => { st.tod = t; } };
})();

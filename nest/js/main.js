// 我們的小島：情侶小窩 3D 遊戲
import * as THREE from '../vendor/three.module.min.js';
import { Avatar, GUITAR, randomLook, heartMesh, HAIRS, HAIR_COLORS, SKINS, OUTFITS, ACCS, EYES, MOUTHS, HEADS, KIND_NAMES, preloadBodies, preloadClips } from './char.js';
import { groundH, standH, walkable, onDock, DOCK, LAND_Y, shoreR, HILL } from './terrain.js';
import { buildIsland, buildInterior, applyTheme, cutaway, THEMES, setTimeOfDay, SPOTS, INSPOTS, FURN, ROOM, blocked, CIRCLES, BOXES } from './world.js';
import { load, toon, toonGrad, tickAnimals, playA, progress, mixers, cloneModel } from './models.js';
import * as SkeletonUtils from '../vendor/SkeletonUtils.js';
import { levelOf, REWARDS, FISH, SHELLS, FLOWERS, DISHES, LETTERS, BOTTLE, TIPS, EDIBLE, RECIPES, QUESTS, QUEST_COIN, QUEST_BONUS, DECOR, MILESTONES } from './data.js';
import { Amb } from './amb.js';
import { weatherAt, seasonOf, createWeatherFX, umbrellaItem, snowmanMesh, SEASON_DAYS } from './weather.js';
import { initUpdates, showNewsOnce, APP_VER } from './update.js';
import { Music, sfx, TRACKS } from './audio.js';
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
    st.where = { sc: scene, x: +(b ? b[0] : c.x).toFixed(2), z: +(b ? b[1] : c.z).toFixed(2), ry: +c.ry.toFixed(2), yaw: +(scene === 'in' ? view.inYaw : view.yaw).toFixed(2) }; } catch (e) {}
}
const myIdx = () => MP.role === 0 || MP.role === 1 ? MP.role : st.ctrl; // 連線拿到身分前，用原本的
const nameOf = i => st.names[i] || (i === myIdx() ? '我' : '另一半');

// ---------- 畫面 ----------
const canvas = $('#stage');
const R = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const PR = Math.min(devicePixelRatio || 1, 1.75); R.setPixelRatio(PR);
R.outputColorSpace = THREE.SRGBColorSpace;
const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 900);
function resize() { R.setSize(innerWidth, innerHeight, false); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
const OUT = new THREE.Scene();
let W = null, IN = null, scene = 'out';
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
function toast(msg, ms = 2600) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms); }
function fadeDo(fn, hold = 380) { const f = $('#fade'); f.classList.add('on'); return new Promise(r => setTimeout(() => { fn(); setTimeout(() => { f.classList.remove('on'); r(); }, 120); }, hold)); }
function dateStr() { const d = new Date(); return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`; }
function addMemo(icon, text) {
  if (MP.role === 'g') return; const m = { d: dateStr(), day: st.day, icon, text };
  st.diary.unshift(m); if (st.diary.length > 300) st.diary.length = 300; save(); if (MP.on) MP.net.send({ t: 'memo', ...m });
}
function daysTogether() { if (!st.anniv) return null; const a = new Date(st.anniv + 'T00:00:00'), n = new Date(); n.setHours(0, 0, 0, 0); return Math.max(1, Math.round((n - a) / 864e5) + 1); }
const loveCD = {};
function addLove(n, why, key) {
  if (key) { const now = performance.now(); if (loveCD[key] && now - loveCD[key] < 45e3) { n = Math.ceil(n / 4); } loveCD[key] = now; }
  if (MP.role === 'g') { if (why) toast(why); return; }
  const before = levelOf(st.love).lv; st.love += n; const after = levelOf(st.love);
  if (MP.on) { MP.net.send({ t: 'addlove', n }); MP.sent && (MP.sent.love = JSON.stringify(st.love)); }
  updateHud();
  if (after.lv > before) {
    sfx('chime'); setTimeout(() => toast(`💗 升到 Lv${after.lv}「${after.title}」！${REWARDS[after.lv] ? '解鎖：' + REWARDS[after.lv] : ''}`, 4500), 400);
    addMemo('💗', `我們的關係升級成「${after.title}」`);
    burst('heart', me().av.root.position.clone().add(new THREE.Vector3(0, 1.8, 0)), 14);
    if (after.lv === 2 && !st.looks.some(l => l.acc)) { /* 只解鎖，不自動戴 */ }
  } else if (why) toast(`${why}　+${n} 甜蜜`);
}
function updateHud() {
  $('#hud-names').textContent = `${nameOf(myIdx())} ♥ ${nameOf(1 - myIdx())}`;
  const d = daysTogether(), se = seasonOf(st.day); $('#hud-days').textContent = (d ? `在一起第 ${d} 天` : `小島第 ${st.day} 天`) + ` ${se.icon}`;
  const L = levelOf(st.love); $('#hud-lv').textContent = `Lv${L.lv} ${L.title}`; $('#love-bar').style.width = (L.pct * 100).toFixed(1) + '%';
  $('#btn-music').setAttribute('aria-pressed', String(!!st.music));
}
function clockText() { const h = Math.floor(st.tod), m = Math.floor((st.tod - h) * 60); const wi = weatherAt(st.day, st.tod).icon; const ic = wi || (st.tod >= 5.5 && st.tod < 17.8 ? '☀️' : st.tod >= 17.8 && st.tod < 19.3 ? '🌇' : '🌙'); return `${ic} ${String(h).padStart(2, '0')}:${String(Math.floor(m / 10) * 10).padStart(2, '0')}`; }
const isNight = () => st.tod >= 19 || st.tod < 5.3;

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
function tickParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.life += dt; const k = p.life / p.max;
    p.sp.position.addScaledVector(p.v, dt); p.v.y *= 0.985; p.sp.material.opacity = 1 - k * k; const sc = p.s * (0.6 + Math.min(1, p.life * 4) * 0.4); p.sp.scale.set(sc, sc, sc);
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
const view = { yaw: 0.5, pitch: 0.5, dist: 11, inYaw: 0, inDist: 14 };
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
    if (scene === 'in') { view.inYaw -= dx * 0.006; return; } // 屋內可以 360 度轉
    view.yaw -= dx * 0.006; view.pitch = clamp(view.pitch + dy * 0.004, 0.08, 1.35);
  });
  const up = e => { const was = pts.get(e.pointerId); pts.delete(e.pointerId); if (downAt && was && downAt.moved < 10 && performance.now() - downAt.t < 400) tapAt(e.clientX, e.clientY); downAt = null; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', e => { pts.delete(e.pointerId); downAt = null; });
  canvas.addEventListener('wheel', e => { e.preventDefault(); zoom(1 + Math.sign(e.deltaY) * 0.1); }, { passive: false });
})();
function zoom(k) { if (scene === 'in') view.inDist = clamp(view.inDist * k, 5, 20); else view.dist = clamp(view.dist * k, 3.2, 24); }
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
    const k = lovePending, gap = k.kind === 'hug' ? 0.55 : k.kind === 'kiss' ? 0.62 : 0.8;
    // 站在你的「畫面右邊」，兩個人面對面，鏡頭看到側面
    const yw = scene === 'in' ? view.inYaw : view.yaw, sx = Math.cos(yw), sz = -Math.sin(yw);
    tx = p.x + sx * gap; tz = p.z + sz * gap; if (!canStand(tx, tz)) { tx = p.x - sx * gap; tz = p.z - sz * gap; } k.t += dt;
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
  const alone = you().ghost; m.querySelectorAll('[data-l]').forEach(b => { b.hidden = alone && ['hand', 'hug', 'kiss', 'pat'].includes(b.dataset.l); });
  let tip = m.querySelector('.tip'); if (!tip) { tip = document.createElement('p'); tip.className = 'tip muted'; tip.style.cssText = 'grid-column:1/-1;margin:2px 4px 0;font-size:12px'; m.appendChild(tip); }
  tip.textContent = alone ? (MP.role === 'g' ? '朋友可以揮手、跳舞、一起跳' : '另一半上線後，就能牽手、抱抱、親親（🌐 邀請）') : '';
  m.querySelector('[data-l="hand"]').setAttribute('aria-pressed', String(!!(MP.lead || MP.led)));
}
$('#btn-love').onclick = () => toggleLoveMenu();
$('#love-menu').addEventListener('click', e => { const b = e.target.closest('[data-l]'); if (!b) return; toggleLoveMenu(false); loveAction(b.dataset.l); });
function loveAction(kind) {
  sfx('click');
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
function unseat(c) { if (c.ghost || c.remote) return; c.locked = false; c.y = null; c.tilt = 0; c.moving = false; c.av.setPose('stand'); c.av.reach(false); c.av.lean(0); c.av.setItem(null); }
function setBtns(list) {
  const box = $('#ap-btns'); box.innerHTML = '';
  list.filter(Boolean).forEach(b => {
    const el = document.createElement('button'); el.type = 'button'; el.textContent = b.t; if (b.main) el.className = 'main'; if (b.dis) el.disabled = true; if (b.id) el.id = b.id;
    if (b.hold) { el.addEventListener('pointerdown', e => { e.preventDefault(); el.setPointerCapture(e.pointerId); b.hold(true); }); const up = () => b.hold(false); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('contextmenu', e => e.preventDefault()); }
    else el.onclick = () => { sfx('click'); b.fn(); };
    box.appendChild(el);
  });
}
const msg = t => { $('#ap-msg').textContent = t; };
function meter(on, v = 0, zone) { const m = $('#ap-meter'); m.hidden = !on; if (!on) return; m.querySelector('i').style.width = (v * 100) + '%'; if (zone) { const em = m.querySelector('em'); em.style.left = zone[0] * 100 + '%'; em.style.width = (zone[1] - zone[0]) * 100 + '%'; } }
function beginAct(id, title, text, o = {}) {
  act = { id, t: 0, ...o }; $('#act-panel').hidden = false; $('#ap-title').textContent = title; msg(text); meter(false); setBtns(o.btns || []);
  toggleLoveMenu(false); $('#btn-act').hidden = true; if (!o.move) $('#joy').style.visibility = 'hidden';
  $('#act-panel').classList.toggle('top', !!o.move); // 可以走動的活動：面板放上面，不擋搖桿
  // 有些活動要看向特定方向（海、夕陽、煙火）
  act.camBack = { yaw: view.yaw, pitch: view.pitch };
  if (o.camYaw != null) { view.yaw = o.camYaw; if (o.camPitch != null) view.pitch = o.camPitch; }
}
function endAct() {
  if (!act) return; const a = act; act = null;
  a.end?.(); chars.forEach(unseat); if (guestChar) unseat(guestChar);
  if (tutorial.step === 2 && a.id !== 'place') tutorialNext();
  if (a.camBack && a.camYaw != null) { view.yaw = a.camBack.yaw; view.pitch = a.camBack.pitch; } $('#act-panel').hidden = true; $('#joy').style.visibility = '';
  // 站到活動地點旁邊
  if (a.back) { const [x, z] = a.back; const p = me(), q = you(); [p.x, p.z] = freeSpot(x, z); [q.x, q.z] = freeSpot(p.x + 0.9, p.z + 0.5); }
  chars.forEach(c => { if (!canStand(c.x, c.z)) [c.x, c.z] = freeSpot(c.x, c.z); });
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
  { id: 'mailbox', sc: 'out', ...SPOTS.mailbox, icon: '💌', name: '信箱', run: openMail, badge: () => st.letterDay !== st.day },
  { id: 'garden', sc: 'out', ...SPOTS.garden, r: 2.6, icon: '🌱', name: '菜園', run: actGarden },
  { id: 'swing', sc: 'out', x: SPOTS.swing.x, z: SPOTS.swing.z + 1.4, icon: '🎠', name: '雙人鞦韆', run: actSwing },
  { id: 'hammock', sc: 'out', x: SPOTS.hammock.x, z: SPOTS.hammock.z + 1.3, icon: '💤', name: '吊床', run: actHammock },
  { id: 'campfire', sc: 'out', x: SPOTS.campfire.x - 1.8, z: SPOTS.campfire.z, r: 2.6, icon: '🔥', name: '營火', run: actCampfire },
  { id: 'picnic', sc: 'out', x: SPOTS.picnic.x, z: SPOTS.picnic.z + 1.6, icon: '🧺', name: '野餐', run: actPicnic },
  { id: 'sunbathe', sc: 'out', x: SPOTS.sunbathe.x, z: SPOTS.sunbathe.z - 1.6, icon: '🏖️', name: '曬太陽', run: actSunbathe },
  { id: 'sandcastle', sc: 'out', ...SPOTS.sandcastle, icon: '🏰', name: '堆沙堡', run: actSand },
  { id: 'beach', sc: 'out', ...SPOTS.beach, icon: '🪁', name: '放風箏', run: actBeach, dyn: () => isNight() ? ['🎆', '放煙火'] : ['🪁', '放風箏'] },
  { id: 'fishing', sc: 'out', x: SPOTS.fishing.x - 1, z: 0, r: 2.4, icon: '🎣', name: '釣魚', run: actFish },
  { id: 'boat', sc: 'out', x: SPOTS.boat.x, z: 0.2, r: 2, icon: '🚣', name: '划船', run: actBoat },
  { id: 'sunset', sc: 'out', x: SPOTS.sunset.x + 1.4, z: SPOTS.sunset.z + 0.4, icon: '🌅', name: '看夕陽', run: actSunset, dyn: () => isNight() ? ['🌠', '看星星'] : ['🌅', '看夕陽'] },
  { id: 'dog', sc: 'out', x: 0, z: 0, r: 1.8, icon: '🐶', name: '狗狗', run: actDog, pos: () => W.dog?.o.position },
  { id: 'coop', sc: 'out', x: SPOTS.coop.x, z: SPOTS.coop.z + 1.9, icon: '🐔', name: '雞舍', run: () => actCoop() },
  { id: 'bike', sc: 'out', x: 0, z: 0, r: 1.8, icon: '🚲', name: '腳踏車', run: () => actBike(), pos: () => W.bike?.position, hide: () => act?.id === 'bike' },
  { id: 'snowman', sc: 'out', x: 3.5, z: 12.4, icon: '⛄', name: '堆雪人', run: () => actSnowman(), hide: () => seasonOf(st.day).k !== 'winter' },
  { id: 'exit', sc: 'in', ...INSPOTS.exit, r: 1.6, icon: '🚪', name: '出門', run: exitHouse },
  { id: 'bed', sc: 'in', ...INSPOTS.bed, icon: '🛏️', name: '床', run: actBed },
  { id: 'sofa', sc: 'in', ...INSPOTS.sofa, icon: '🛋️', name: '沙發', run: actSofa },
  { id: 'kitchen', sc: 'in', ...INSPOTS.kitchen, icon: '🍳', name: '做飯', run: actCook },
  { id: 'read', sc: 'in', ...INSPOTS.read, icon: '📚', name: '閱讀角', run: actRead },
  { id: 'dining', sc: 'in', ...INSPOTS.dining, icon: '🍽️', name: '吃飯', run: actEat, hide: () => !IN?.dish.visible },
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
const OWNER_ONLY = ['mailbox', 'garden', 'bed', 'wardrobe'];
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
  const p = me(); let best = null, bd = 1e9;
  for (const s of SP) {
    const pp = s.pos?.() || s; const show = s.sc === scene && started() && !photo.on && !spotHidden(s);
    const d = Math.hypot(pp.x - p.x, pp.z - p.z);
    if (s.dyn) { const [ic, nm] = s.dyn(); if (s.icon !== ic) { s.icon = ic; s.name = nm; s.el.textContent = `${ic} ${nm}`; } }
    if (show && !act && d < s.r && d < bd) { bd = d; best = s; }
    const vis = show && !act && d < (scene === 'in' ? 30 : 20);
    if (!vis) { if (s.el.style.display !== 'none') s.el.style.display = 'none'; continue; }
    const y = scene === 'in' ? 2.1 : (s.id === 'dog' ? pp.y + 1.2 : standH(pp.x, pp.z) + 2.0);
    v3.set(pp.x, y, pp.z).project(cam);
    if (v3.z > 1) { s.el.style.display = 'none'; continue; }
    s.el.style.display = ''; s.el.style.left = ((v3.x + 1) / 2 * innerWidth) + 'px'; s.el.style.top = ((1 - v3.y) / 2 * innerHeight) + 'px';
    s.el.style.opacity = d < 12 ? 1 : 0.75; s.el.classList.toggle('near', s === best);
    if (s.badge) s.el.textContent = `${s.icon} ${s.name}${s.badge() ? ' ●' : ''}`;
  }
  // 名字（頭上）
  const seen = new Set();
  for (const c of allChars()) {
    let e = nameEls.get(c); if (!e) { e = document.createElement('div'); e.className = 'lbl name'; $('#labels').appendChild(e); nameEls.set(c, e); }
    seen.add(c);
    if (!started() || photo.on || !c.av.root.visible) { e.style.display = 'none'; continue; }
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
    updateCam(0, true);
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
function openMail() {
  me().av.emote('interact', 1.4);
  const fresh = st.letterDay !== st.day;
  const idx = (st.day * 7 + (myIdx() ? 3 : 0)) % LETTERS.length;
  const text = LETTERS[idx].replaceAll('{a}', nameOf(me().i)).replaceAll('{b}', nameOf(you().i));
  openDlg('💌 今天的信', `<div class="letter">${esc(text)}</div><p class="muted">${fresh ? '每天都會有一封新的信。' : '今天的信已經看過了，明天再來看看。'}</p>`);
  if (fresh) { st.letterDay = st.day; quest('mail'); addLove(3, '收到情書'); addMemo('💌', `${nameOf(me().i)} 收到 ${nameOf(you().i)} 寫的信`); me().av.emote('shy', 1.6); burst('heart', headPos(me()), 4); }
}

// ---------- 雙人鞦韆 ----------
function actSwing() {
  const sw = W.swing, pv = sw.userData.pivot, seatG = sw.userData.seat;
  let amp = 0.18, ph = 0, tick = 0;
  const mine = you().remote && you().act === 'swing' && you().x < SPOTS.swing.x ? 0.42 : -0.42;
  const place = () => {
    [[me(), mine], [you(), -mine]].forEach(([c, x]) => { if (c.remote || c.ghost) return; seatG.localToWorld(v3.set(x, 0.05, 0.02)); c.locked = true; c.x = v3.x; c.z = v3.z; c.y = v3.y - HIP; c.ry = 0; c.tilt = pv.rotation.x; c.av.setPose('swing'); });
  };
  fadeDo(place, 250); quest('swing');
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
  const { x, z } = SPOTS.hammock, y = LAND_Y + 0.42;
  fadeDo(() => { seat(me(), x + 0.75, y, z - 0.18, Math.PI / 2, 'lie'); seat(you(), x + 0.75, y, z + 0.18, Math.PI / 2, 'lie'); }, 250);
  let nap = false, zt = 0;
  beginAct('hammock', '💤 吊床', '兩個人擠在吊床上，搖啊搖。', {
    focus: () => new THREE.Vector3(x, LAND_Y + 1, z), back: [x, z + 1.6],
    btns: [{ t: duo() ? '一起睡午覺' : '睡個午覺', main: true, fn: () => { nap = true; msg('呼…呼…（時間過得特別快）'); } }, duo() && { t: '說悄悄話', fn: () => { you().av.emote('shy', 1.6); burst('heart', midPos(0.6), 4); addLove(2, pick(['「我好喜歡你」', '「今天也謝謝你」', '「下次一起去看海」']), 'whisper'); } }],
    update(dt) {
      zt += dt; if (nap) { st.tod += dt * 0.4; if (zt > 1.2) { zt = 0; burst('z', midPos(0.7), 1, 0.2); } if (Math.random() < dt / 8) addLove(1); }
    },
    end() { if (nap) addMemo('💤', '在吊床上一起睡了午覺'); else addMemo('💤', '一起躺在吊床上聊天'); },
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
  fadeDo(() => sitPair(x, y, z - 1.9, 0, 0.62), 250);
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
  const player = () => duo() ? you() : me();
  const toggleGuitar = () => { guitar = !guitar; if (guitar && roast) { me().av.setItem(null); roast = null; me().av.reach(false); } player().av.setLap(guitar ? guitarItem() : null); if (W.guitar) W.guitar.visible = !guitar; player().av.emote(guitar ? 'strum' : 'idle', guitar ? 9999 : 0.1); if (guitar) { Music.duet(true); setTimeout(() => { if (guitar && Music.guitarSong) msg(`🎸 正在彈《${Music.guitarSong}》`); }, 1200); msg(duo() ? `${nameOf(you().i)} 拿起吉他，兩個人一起哼歌 🎶` : '拿起旁邊的吉他，對著營火彈唱 🎶'); addLove(2, '營火邊唱歌', 'guitar'); addMemo('🎸', '在營火邊一起唱歌'); } else Music.duet(false); roastBtns(); };
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
  fadeDo(() => { seat(me(), x - 0.5, y, z + 0.35, 0.5, 'floor'); seat(you(), x + 0.5, y, z + 0.35, -0.5, 'floor'); W.picnic.userData.food.visible = true; }, 250);
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
  const { x, z } = SPOTS.sunbathe, cy = standH(x, z + 0.4) + 0.32 - HIP;
  fadeDo(() => { seat(me(), x - 0.75, cy, z + 0.25, 0, 'recline'); seat(you(), x + 0.75, cy, z + 0.25, 0, 'recline'); }, 250);
  let t = 0;
  beginAct('sunbathe', '🏖️ 曬太陽', '躺在海灘椅上，聽海浪的聲音。', {
    focus: () => new THREE.Vector3(x, 1, z + 1), back: [x, z - 1.6], camYaw: Math.PI - 0.5, camPitch: 0.3,
    btns: [duo() ? { t: '幫忙擦防曬', main: true, fn: () => { me().av.emote('pat', 1.4); you().av.emote('shy', 1.4); burst('heart', headPos(you(), 1.1), 3); addLove(2, '擦好防曬了', 'sun'); } } : { t: '伸個懶腰', main: true, fn: () => { me().av.emote('cheer', 1.4); addLove(1, '好舒服～', 'sun'); } }, { t: '去踩浪花', fn: () => { endAct(); const p = me(), q = you(); p.x = x - 0.5; p.z = z + 3.2; if (!q.ghost && !q.remote) { q.x = x + 0.5; q.z = z + 3.2; } toast('去踩浪花吧～ 🌊'); } }],
    update(dt) { t += dt; if (t > 12) { t = 0; addLove(1); } },
    end() { addMemo('🏖️', '一起在海灘曬太陽'); },
  });
}

// ---------- 堆沙堡 ----------
let castleObjs = [];
const CASTLE_SPOTS = [[-6.4, 24.6], [-3.8, 24.9], [-5.3, 25.8], [-7.2, 23.3]];
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
  fadeDo(() => { seat(me(), cx - 0.62, null, cz, Math.PI / 2, 'crouch'); seat(you(), cx + 0.62, null, cz, -Math.PI / 2, 'crouch'); }, 250);
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
    fadeDo(() => { const y = standH(x, z) + 0.02 - HIP; seat(me(), x - 0.4, y, z + 0.8, 0.15, 'floor'); seat(you(), x + 0.4, y, z + 0.8, -0.15, 'floor'); }, 250);
    let n = 0;
    beginAct('fireworks', '🎆 放煙火', '坐在沙灘上看煙火在海上綻放。', {
      focus: () => new THREE.Vector3(x, 4.2, z + 4), back: [x, z - 1], camYaw: Math.PI, camPitch: 0.14,
      btns: [{ t: '點煙火！', main: true, fn: () => { launchFirework(levelOf(st.love).lv >= 3 && Math.random() < 0.35); n++; st.fireworks++; if (n % 3 === 0) { addLove(2, '好漂亮！', 'fw'); you().av.lean(-1); me().av.lean(1); } } }, { t: '連發 ×5', fn: () => { for (let i = 0; i < 5; i++) setTimeout(() => launchFirework(levelOf(st.love).lv >= 3 && i === 4), i * 420); n += 5; st.fireworks += 5; addLove(3, '煙火大會', 'fw5'); } }],
      end() { if (n) addMemo('🎆', `在海邊放了 ${n} 發煙火`); },
    });
    return;
  }
  const kite = kiteItem(); OUT.add(kite);
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: '#ffffff' })); OUT.add(line);
  let h = 3, want = 10, t = 0, tk = 0;
  fadeDo(() => { const y = standH(x, z); [[me(), -0.45], [you(), 0.45]].forEach(([c, dx]) => { if (c.remote || c.ghost) return; c.locked = true; c.x = x + dx; c.z = z; c.y = null; c.ry = 0.1; c.moving = false; }); me().av.reach(true); }, 250);
  quest('kite');
  beginAct('kite', '🪁 放風箏', '海風好大，風箏飛好高！', {
    focus: () => new THREE.Vector3(x, 3.5, z + 3), back: [x, z - 1], camYaw: Math.PI + 0.3, camPitch: 0.22,
    btns: [{ t: '放線（飛高一點）', main: true, fn: () => { want = Math.min(24, want + 3); } }, { t: '收線', fn: () => { want = Math.max(4, want - 3); } }, duo() && { t: '交給對方', fn: () => { const a = me().av.reaching; me().av.reach(!a); you().av.reach(a); you().av.emote('cheer', 1); addLove(1, null, 'kitepass'); } }],
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
function pickFish() { const tot = FISH.reduce((s, f) => s + f[2], 0); let r = Math.random() * tot; for (const f of FISH) { r -= f[2]; if (r <= 0) return f; } return FISH[0]; }
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
  fadeDo(() => { seat(me(), fx + 0.8, null, -0.3, Math.PI / 2, 'hold'); seat(you(), fx + 0.9, DOCK.y + 0.04 - HIP, 0.55, Math.PI / 2); me().av.setItem(rod); me().av.reach(true); }, 250);
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
      if (state === 'fly') { flyT += dt / 0.7; const k = Math.min(1, flyT); bob.position.lerpVectors(v3, target, k); bob.position.y += Math.sin(k * Math.PI) * 1.8; if (k >= 1) { setState('wait'); wait = rand(2, 6); msg('靜靜等待…'); btns(); sfx('plop'); } }
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
    const ry = boat.rotation.y, fx = Math.sin(ry), fz = Math.cos(ry);
    const y = boat.position.y + 0.44 - HIP; // 坐在船中間的橫板上，上半身露出船邊
    const [a, b] = passenger ? [you(), me()] : [me(), you()];
    if (!a.remote && !a.ghost) { a.x = boat.position.x + fx * 0.55; a.z = boat.position.z + fz * 0.55; a.y = y; a.ry = ry + Math.PI; }
    if (!b.remote && !b.ghost) { b.x = boat.position.x - fx * 0.55; b.z = boat.position.z - fz * 0.55; b.y = y; b.ry = ry; }
  };
  MP.driving = !passenger;
  if (!W.oars) { W.oars = makeOars(boat); poseOars(W.oars, null); }
  let rowPh = 0; const rower = () => passenger ? driver : me();
  const grips = () => W.oars.map(o => o.userData.grip.getWorldPosition(new THREE.Vector3()));
  fadeDo(() => { [me(), you()].forEach(c => { if (c.remote || c.ghost) return; c.locked = true; c.av.setPose('sit'); c.moving = false; }); if (!passenger) me().av.emote('row', 9999); place(); }, 250);
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
  fadeDo(() => { sitPair(x + 0.3, y, z, ry, 0.62); me().av.lean(1); }, 250);
  let warp = 0, mt = rand(3, 8), wished = false;
  const btns = () => setBtns([
    { t: isNight() ? '等流星…' : '等夕陽', main: true, id: 'ss-main', fn: () => { if (!isNight()) { warp = 17.9; msg('時間慢慢流過去…'); } } },
    { t: '🌠 許願', id: 'ss-wish', dis: !meteor, fn: wish },
  ]);
  const wish = () => {
    if (!meteor && !(act?.metT > 0)) return;
    openDlg('🌠 對流星許願', `<p class="muted">願望只會寫在你們的回憶本裡。</p><label class="anniv"><span>願望</span><input id="wish-in" maxlength="40" placeholder="例如：明年一起去看雪"></label><button type="button" class="primary" id="wish-ok">許願</button>`);
    $('#wish-ok').onclick = () => { const w = $('#wish-in').value.trim(); $('#dlg').close(); st.wishes++; addMemo('🌠', w ? `對流星許願：「${w}」` : '一起對流星許了願'); addLove(5, '願望一定會實現'); burst('star', midPos(), 10); wished = true; };
  };
  beginAct('sunset', isNight() ? '🌠 看星星' : '🌅 看夕陽', isNight() ? '滿天星星，等等看會不會有流星。' : '燈塔旁的長椅，最適合看夕陽。', {
    focus: () => new THREE.Vector3(x - 1.5, 2.2, z - 0.6), back: [x + 1.6, z + 0.6], camYaw: ry + Math.PI, camPitch: 0.1,
    update(dt) {
      if (warp) { st.tod += dt * 1.6; if (st.tod >= warp) { warp = 0; msg('夕陽好美。' + (Math.random() < 0.5 ? `${nameOf(you().i)} 偷偷看了你一眼。` : '天空變成粉紅色了。')); addLove(4, '一起看夕陽'); addMemo('🌅', '在燈塔旁一起看夕陽'); quest('sunset'); btns(); } }
      if (isNight()) { mt -= dt; if (mt <= 0 && !meteor) { spawnMeteor(); mt = rand(5, 11); act.metT = 3; msg('流星！快許願！'); sfx('chime'); } }
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
    $('#dlg-body').querySelectorAll('[data-t]').forEach(b => b.onclick = () => { st.garden[i] = { t: +b.dataset.t, w: [] }; save(); drawPlant(i); goPlot(i); me().av.emote('plant', 2.2); sfx('sand'); toast(`種下了${FLOWERS[+b.dataset.t][0]}的種子`); render(); });
  };
  const water = i => { const s = st.garden[i]; if (s.w.includes(st.day)) return; s.w.push(st.day); quest('water'); goPlot(i); me().av.emote('water', 2.4); me().av.setItem(canItem()); setTimeout(() => me().av.setItem(null), 2400); save(); drawPlant(i); const p = SPOTS.garden.plots[i]; burst('drop', new THREE.Vector3(p[0], LAND_Y + 1, p[1]), 5, 0.4); sfx('water'); addLove(1, null, 'water'); if (s.w.length >= 3) { toast(`${FLOWERS[s.t][1]} 開花了！`); addMemo(FLOWERS[s.t][1], `菜園的${FLOWERS[s.t][0]}開花了`); } render(); };
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
function actBed() {
  const y = 0.52;
  // 上床前換上睡衣，起床（離開）時換回原本的衣服
  const prev = [st.looks[0].outfit, st.looks[1].outfit];
  const pj = j => OUTFITS[st.looks[j].outfit]?.kind === 'pj' ? st.looks[j].outfit : OUTFITS.findIndex(o => o.kind === 'pj' && o.name === (st.looks[j].gender === 'f' ? '粉紅睡衣' : '天藍睡衣'));
  fadeDo(() => { [0, 1].forEach(j => { const o = pj(j); if (o !== st.looks[j].outfit) chars[j].av.setLook({ ...st.looks[j], outfit: o }); }); seat(me(), FURN.bed.x - 0.35, y, FURN.bed.z + 1.0, 0, 'lie'); seat(you(), FURN.bed.x + 0.35, y, FURN.bed.z + 1.0, 0, 'lie'); }, 250);
  beginAct('bed', '🛏️ 床', '換上睡衣，軟綿綿的床，可以一起睡到明天早上。', {
    focus: () => new THREE.Vector3(FURN.bed.x, 0.8, FURN.bed.z + 0.5), back: [INSPOTS.bed.x, INSPOTS.bed.z + 0.4],
    btns: [{ t: '晚安，睡到明天', main: true, fn: sleep }, duo() && { t: '枕頭大戰', fn: () => { me().av.emote('cheer', 1); you().av.emote('jump', 1); burst('star', midPos(0.6), 6); addLove(2, '哈哈哈', 'pillow'); } }],
    end() { [0, 1].forEach(j => { st.looks[j].outfit = prev[j]; chars[j].av.setLook(st.looks[j]); }); },
  });
  function sleep() {
    msg('晚安 ♥'); setBtns([]); let n = 0; const zz = setInterval(() => { burst('z', midPos(0.6), 1, 0.2); if (++n > 4) clearInterval(zz); }, 350);
    setTimeout(() => fadeDo(() => { st.tod = 7.2; newDay(); endAct(); toast(`早安！第 ${st.day} 天 ☀️`); addLove(3); addMemo('🛏️', '一起睡到自然醒'); }, 1100), 1500);
  }
}
function actSofa() {
  const y = 0.45 - HIP + 0.02;
  fadeDo(() => { seat(me(), FURN.sofa.x - 0.35, y, FURN.sofa.z - 0.05, Math.PI, 'recline'); seat(you(), FURN.sofa.x + 0.35, y, FURN.sofa.z - 0.05, Math.PI, 'recline'); }, 250);
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
  fadeDo(() => { sitBeans(); books(true); squish(); }, 250);
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
    { t: lying ? '🛋️ 回懶人沙發' : '🧸 躺在地毯上', fn: () => { lying = !lying; fadeDo(() => { (lying ? lieRug : sitBeans)(); books(true); if (cat) { catOn = !lying; cat.o.visible = catOn; } squish(); }, 200); btns(); } }]);
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
    openDlg('🍳 食譜', `<p class="muted">🧊 冰箱：${esc(pantryText())}</p><div class="shop">${RECIPES.map((r, i) => { const need = Object.entries(r[3]).map(([k, n]) => `${FOOD_ICON[k] || ''}${k}×${n}`).join(' ') || '不用食材'; return `<button type="button" data-r="${i}" ${canCook(r) ? '' : 'disabled'}>${r[1]} ${esc(r[0])}<small>${esc(need)}・+${r[4]} 🪙</small></button>`; }).join('')}</div>`);
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
    IN.dish.visible = true; st.dishes++; quest('cook'); addCoins(dish[4]); addLove(dish[5], `${dish[1]} ${dish[0]}完成`); addMemo(dish[1], `${duo() ? '一起' : ''}做了${dish[0]}`);
    msg(`${dish[0]}做好了，放在餐桌上！到餐桌${duo() ? '一起' : ''}吃吧。`); setBtns([{ t: '去餐桌吃飯', main: true, fn: () => { endAct(); actEat(); } }, { t: '再做一道', fn: pickRecipe }]);
  }
}
function actEat() {
  if (!IN.dish.visible) return toast('先去廚房做飯吧');
  const y = 0.47 - HIP;
  const T = FURN.table; fadeDo(() => { seat(me(), T.x - 0.45, y, T.z - 1.0, 0); seat(you(), T.x + 0.45, y, T.z + 1.0, Math.PI); }, 250); // 坐在椅子正中間，頭不會撞到桌子
  beginAct('eat', '🍽️ 吃飯', '開動了！', {
    focus: () => new THREE.Vector3(FURN.table.x, 0.9, FURN.table.z), back: [INSPOTS.dining.x, INSPOTS.dining.z],
    btns: [{ t: '好好吃！', main: true, fn: () => { me().av.emote('eatseat', 2.2); burst('heart', headPos(me(), 1.3), 2); addLove(1, null, 'eat'); } }, duo() && { t: '餵對方一口', fn: () => { me().av.reach(true); setTimeout(() => { me().av.reach(false); you().av.emote('shy', 1.4); burst('heart', headPos(you(), 1.3), 5); }, 500); addLove(3, '啊～', 'feed2'); } }, { t: '吃飽了', fn: () => { IN.dish.visible = false; addMemo('🍽️', '一起吃了一頓飯'); endAct(); } }],
  });
}

// ---------- 對話框：地圖、回憶本、造型 ----------
function openDlg(title, html) { $('#dlg-title').textContent = title; $('#dlg-body').innerHTML = html; const d = $('#dlg'); if (!d.open) d.showModal(); }
$('#btn-map').onclick = () => {
  sfx('click');
  const cell = s => `<button type="button" class="cell" data-s="${s.id}" style="border:0"><span class="e">${s.icon}</span>${esc(s.name)}</button>`;
  const outL = SP.filter(s => s.sc === 'out' && !spotHidden(s) && s.id !== 'door'), inL = SP.filter(s => s.sc === 'in' && !spotHidden(s) && s.id !== 'exit');
  openDlg('🗺️ 小島地圖', `<p class="muted">點一下，畫面一暗就到了。</p><b>🏝️ 屋外</b><div class="grid3">${outL.map(cell).join('')}</div>${MP.role === 'g' ? '' : `<b>🏠 小木屋裡</b><div class="grid3">${inL.map(cell).join('')}</div>`}`);
  $('#dlg-body').querySelectorAll('[data-s]').forEach(b => b.onclick = () => { const s = SP.find(x => x.id === b.dataset.s); $('#dlg').close(); teleportTo(s); });
};
$('#couple-card').onclick = () => MP.role === 'g' ? openNet() : openBook('us');
$('#btn-book').onclick = () => MP.role === 'g' ? openNet() : openBook('memo');
$('#btn-net').onclick = () => openNet();
function openBook(tab = 'memo') {
  sfx('click');
  const tabs = [['memo', '回憶'], ['col', '收藏'], ['us', '我們'], ['about', '關於']];
  const L = levelOf(st.love), d = daysTogether();
  const body = {
    memo: () => st.diary.length ? st.diary.slice(0, 120).map(m => `<div class="memo"><span class="ic">${m.icon}</span><b>${esc(m.text)}</b><small>${esc(m.d)} · 小島第 ${m.day} 天</small></div>`).join('') : '<p class="muted">還沒有回憶，去小島上走走吧。</p>',
    col: () => `<b>🎣 釣到的東西</b><div class="grid3">${FISH.map(f => `<div class="cell ${st.fish[f[0]] ? '' : 'no'}"><span class="e">${f[1]}</span>${st.fish[f[0]] ? esc(f[0]) : '？？？'}<small>${st.fish[f[0]] ? '×' + st.fish[f[0]] + (st.fishMax?.[f[0]] ? `・最大 ${st.fishMax[f[0]]} 公分` : '') : '還沒釣到'}</small></div>`).join('')}</div>
      <b>🐚 海邊撿到的</b><div class="grid3">${SHELLS.map(s => `<div class="cell ${st.shells[s[0]] ? '' : 'no'}"><span class="e">${s[1]}</span>${esc(s[0])}<small>×${st.shells[s[0]] || 0}</small></div>`).join('')}</div>
      <p class="muted">沙堡 ${st.castles} 座 · 送花 ${st.flowersGiven} 次 · 做飯 ${st.dishes} 次 · 煙火 ${st.fireworks} 發 · 繞島 ${st.laps} 圈 · 許願 ${st.wishes} 次</p>`,
    us: () => `<div class="memo"><span class="ic">💗</span><b>${esc(nameOf(0))} ♥ ${esc(nameOf(1))}</b><small>${d ? `在一起第 ${d} 天 · ` : ''}甜蜜值 ${st.love} · Lv${L.lv} ${L.title}${L.next ? `（再 ${L.next - st.love} 升級）` : ''}</small></div>
      <label class="anniv"><span>我的名字</span><input id="ed-n0" maxlength="8" value="${esc(st.myName || '')}"></label>
      <label class="anniv"><span>在一起的日子</span><input id="ed-an" type="date" value="${esc(st.anniv)}"></label>
      <button type="button" class="ghost" id="ed-look0">👗 我的造型</button>
      <p class="muted">另一半的名字和造型，由另一半在自己的手機設定（🌐 連線後會同步）。</p>
      <button type="button" class="primary" id="ed-save">儲存</button>`,
    about: () => `<p>兩個人的 3D 小島。小木屋、沙灘、碼頭、燈塔，一起盪鞦韆、釣魚、烤棉花糖、看夕陽、划船、放煙火。</p>
      <p class="muted">資料只存在這支手機（瀏覽器）裡。版本 ${esc(APP_VER)}</p>
      <details><summary>3D 模型出處（Polyfork，CC BY 4.0）</summary><div id="credits" class="muted" style="font-size:12px;line-height:1.5">載入中…</div></details>
      <b>⚙️ 設定</b>
      <div class="toggle-row"><span>🔋 省電模式<br><small class="muted">畫面稍微不那麼細，比較順、比較不燙</small></span><button type="button" id="low-tg" aria-pressed="${!!st.low}">${st.low ? '開' : '關'}</button></div>
      <button type="button" class="ghost" id="tut-again">🎓 再看一次新手教學</button>
      <button type="button" class="ghost" id="reset-all" style="margin-top:8px">清除所有資料、重新開始</button>`,
  };
  openDlg('📔 我們的回憶本', `<div class="tabs" role="tablist">${tabs.map(([k, n]) => `<button type="button" role="tab" data-t="${k}" aria-selected="${k === tab}">${n}</button>`).join('')}</div><div id="book-body" style="display:grid;gap:8px">${body[tab]()}</div>`);
  $('#dlg-body').querySelectorAll('[data-t]').forEach(b => b.onclick = () => openBook(b.dataset.t));
  if (tab === 'us') {
    $('#ed-save').onclick = () => { st.myName = $('#ed-n0').value.trim().slice(0, 8); st.names[myIdx()] = st.myName; st.anniv = $('#ed-an').value; save(); updateHud(); $('#dlg').close(); toast('已儲存'); };
    $('#ed-look0').onclick = () => openLooks(myIdx());
  }
  if (tab === 'about') {
    fetch('models/credits.json').then(r => r.json()).then(c => { $('#credits').innerHTML = Object.values(c).filter(Boolean).map(esc).join('<br>'); }).catch(() => {});
    $('#low-tg').onclick = () => { st.low = !st.low; save(); applyLow(); $('#low-tg').setAttribute('aria-pressed', String(st.low)); $('#low-tg').textContent = st.low ? '開' : '關'; };
    $('#tut-again').onclick = () => { $('#dlg').close(); tutorialStart(); };
    $('#reset-all').onclick = () => { if (confirm('確定要清除小島上所有的回憶嗎？這個動作不能復原。')) { localStorage.removeItem(KEY); location.reload(); } };
  }
}
function openLooks(i = me().i) {
  const L = st.looks[i], lvl = levelOf(st.love).lv;
  const accOK = a => a === 0 || (a === 2 && lvl >= 2) || (a === 1 && lvl >= 4);
  const rows = [['髮型', 'hair', HAIRS], ['髮色', 'hairColor', HAIR_COLORS.map((c, k) => `色 ${k + 1}`)], ['膚色', 'skin', SKINS.map((c, k) => `膚 ${k + 1}`)], ['衣服', 'outfit', OUTFITS.map(o => `${KIND_NAMES[o.kind]}｜${o.name}`)], ['頭型', 'head', HEADS], ['眼睛', 'eye', EYES], ['嘴巴', 'mouth', MOUTHS], ['配件', 'acc', ACCS]];
  openDlg(`👗 ${nameOf(i)} 的造型`, `<p class="muted">改了馬上就看得到。${lvl < 4 ? '配件「小花」Lv2、「愛心光環」Lv4 解鎖。' : ''}</p>${rows.map(([n, k, arr]) => `<div class="look-row" data-k="${k}" data-n="${arr.length}"><span>${n}</span><span id="lv-${k}">${esc(arr[(L[k] | 0) % arr.length])}</span><button type="button" data-d="-1" aria-label="上一個">‹</button><button type="button" data-d="1" aria-label="下一個">›</button></div>`).join('')}
    <button type="button" class="ghost" id="lk-couple">👫 兩個人一起換情侶裝</button>
    <div class="row"><button type="button" class="ghost" id="lk-rand">🎲 隨機</button><button type="button" class="ghost" id="lk-g">${L.gender === 'f' ? '換成男生' : '換成女生'}</button></div>`);
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
  for (let k = 0; k < 7; k++) {
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
function newDay() {
  st.day++; spawnShells(); save(); updateHud(); updateChips(); drawSnowman(); drawEggs();
  const s0 = seasonOf(st.day - 1), s1 = seasonOf(st.day); if (s0 !== s1) setTimeout(() => toast(`${s1.icon} ${s1.name}來了！`, 3500), 1200);
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
    <div class="toggle-row"><span>🌿 環境音<br><small class="muted">海浪、鳥叫、蟲鳴、營火、雨聲、腳步聲</small></span><button type="button" id="amb-tg" aria-pressed="${st.amb !== false}">${st.amb !== false ? '開' : '關'}</button></div>`);
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
function updateCam(dt, snap) {
  const p = me();
  if (scene === 'in') {
    tmpT.set(clamp(p.x, -5, 5) * 0.65, 0.9, clamp(p.z, -3.5, 3.5) * 0.55);
    if (act?.focus) tmpT.lerp(act.focus(), 0.7);
    const d = view.inDist, yaw = view.inYaw;
    camP.set(tmpT.x + Math.sin(yaw) * d * 0.78, tmpT.y + d * 0.66, tmpT.z + Math.cos(yaw) * d * 0.78);
    cutaway(IN, cam.position.x, cam.position.z);
  } else {
    if (act?.focus) tmpT.copy(act.focus()); else tmpT.set(p.av.root.position.x, p.av.root.position.y + 1.2, p.av.root.position.z);
    const nf = act?.near?.(); let d = view.dist * (act?.bigView ? 1.6 : nf ? nf : act ? 1.1 : 1);
    const yaw = view.yaw, pit = view.pitch;
    for (let k = 0; k < 12; k++) { camP.set(tmpT.x + Math.sin(yaw) * Math.cos(pit) * d, tmpT.y + Math.sin(pit) * d, tmpT.z + Math.cos(yaw) * Math.cos(pit) * d); if (!camBlocked(camP.x, camP.y, camP.z)) break; if (d < 2.5) { camP.y = Math.max(camP.y, 7.2); break; } d *= 0.8; }
    camP.y = Math.max(camP.y, standH(camP.x, camP.z) + 0.6);
  }
  const k = snap ? 1 : 1 - Math.exp(-dt * (act?.camSpeed?.() || 6));
  camT.lerp(tmpT, k); cam.position.lerp(camP, k); cam.lookAt(camT);
}

// ---------- 連線：其他人的角色、共用存檔、情侶互動、訪客 ----------
const SHARED = ['names', 'looks', 'anniv', 'day', 'theme', 'pantry', 'eggs', 'fedDay', 'fish', 'fishMax', 'coins', 'inv', 'decor', 'quests', 'rewards', 'questDays', 'snowman', 'shells', 'garden', 'castles', 'letterDay', 'flowersGiven', 'dishes', 'wishes', 'fireworks', 'laps', 'coupleWorn'];
const LOVE_WORD = { hand: '牽你的手', hug: '抱抱你', kiss: '親親你', pat: '摸摸你的頭' };
function newChar(look) { const c = { i: 'g', av: new Avatar(look), x: 0, z: 0, ry: 0, y: null, moving: false, locked: false, path: null, spinT: 0, stuck: 0, tilt: 0, sc: 'out' }; OUT.add(c.av.root); hookEmote(c); return c; }
function hookEmote(c) { const orig = c.av.emote.bind(c.av); c.av.emote = (k, d) => { orig(k, d); if (MP.on && c === me()) MP.net.send({ t: 'emo', k, d }); }; }
// 畫面上所有角色（看得到的）
function allChars() { const a = [...chars]; if (guestChar) a.push(guestChar); for (const p of MP.peers.values()) if (p.role === 'g' && p.c) a.push(p.c); return a; }
// 這支手機在控制的角色
function localChars() { if (!MP.on) return chars; const a = [me()]; if (partnerLocal()) a.push(you()); return a; }
const peerChar = id => { const p = MP.peers.get(id); return p ? (p.role === 'g' ? p.c : chars[p.role]) : null; };
const peerName = id => { const p = MP.peers.get(id); return p ? (p.role === 'g' ? p.name : nameOf(p.role)) : '對方'; };
function charName(c) { if (c === guestChar) return MP.guest?.name || '我'; if (c.i === 'g') { for (const p of MP.peers.values()) if (p.c === c) return p.name; return '朋友'; } return nameOf(c.i); }
// 每一格：每個角色放到他所在的場景，看不到的藏起來；別人的角色平滑移動到收到的位置
function placeRoots(dt) {
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
    }
  }
}
// 送出自己的位置；時間跳了（睡覺、看夕陽）也告訴大家
function netTick(dt) {
  if (!MP.on || !MP.net.alive) return;
  const c = me();
  MP.net.pos({ x: +c.x.toFixed(2), z: +c.z.toFixed(2), ry: +c.ry.toFixed(2), y: c.y == null ? null : +c.y.toFixed(2), sc: scene, pose: c.av.pose || 'stand', mv: c.moving ? 1 : 0, act: act?.id || '', hand: MP.lead ? 'L' : MP.led ? 'F' : '', fl: st.flash ? 1 : 0, tilt: +(c.tilt || 0).toFixed(2) });
  if (MP.role === 'g') return;
  if (MP.expTod == null) MP.expTod = st.tod;
  MP.expTod += dt / 36; if (MP.expTod >= 24) MP.expTod -= 24;
  let diff = Math.abs(st.tod - MP.expTod); diff = Math.min(diff, 24 - diff);
  if (diff > 0.05) { MP.net.send({ t: 'tod', tod: st.tod, day: st.day }); MP.expTod = st.tod; }
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
const MINE = ['myName', 'myLook', 'ctrl', 'tut', 'music', 'track', 'low', 'amb', 'run', 'flash', 'where'];
function applySave(keys, first) {
  for (const [k, v] of Object.entries(keys)) { if (k === 'diary' && !first) continue; if (MINE.includes(k)) continue; st[k] = v; }
  if (keys.looks) [0, 1].forEach(i => { if (st.looks[i]) chars[i].av.setLook(st.looks[i]); });
  if ('castles' in keys) showCastles();
  if (keys.garden) st.garden.forEach((_, i) => drawPlant(i));
  if (keys.eggs) drawEggs(); if (keys.decor) drawDecor(); if (keys.theme && IN) applyTheme(IN, keys.theme); if ('snowman' in keys) drawSnowman(); updateChips?.();
  snapSent(); if (MP.role !== 'g') try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {}
  updateHud(); if (keys.names && !first && $('#dlg').open && $('#dlg').dataset.net) openNet();
}
function onNet(m) {
  if (m.t === 'welcome') {
    MP.id = m.id; MP.role = m.role; MP.owner = m.owner;
    if (m.role === 'g') { st = { ...DEF, ...m.save, music: st.music }; [0, 1].forEach(i => { if (st.looks?.[i]) chars[i].av.setLook(st.looks[i]); }); showCastles(); st.garden.forEach((_, i) => drawPlant(i)); snapSent(); updateHud(); }
    else {
      applySave(m.save, true);
      // 這支手機的主人：用自己設定的名字、樣子
      const i = m.role; st.ctrl = i; if (st.myName) st.names[i] = st.myName; if (st.myLook) st.looks[i] = st.myLook;
      chars[i].av.setLook(st.looks[i]); if (st.looks[1 - i]) chars[1 - i].av.setLook(st.looks[1 - i]);
      const mc = chars[i], oc = chars[1 - i]; if (!mc.seenMe) { mc.x = oc.x; mc.z = oc.z; mc.ry = oc.ry; mc.sc = oc.sc || scene; mc.seenMe = 1; }
      save(); updateHud();
    }
    st.tod = m.clock.tod; st.day = m.clock.day; MP.expTod = st.tod;
    for (const p of MP.peers.values()) if (p.c && p.role === 'g') OUT.remove(p.c.av.root);
    MP.peers.clear(); chars.forEach(c => { if (c.remote) c.remote = false; });
    m.peers.forEach(p => addPeer(p, true));
    updateNetChip(); if ($('#dlg').open && $('#dlg').dataset.net) openNet();
    return;
  }
  if (m.t === 'join') { addPeer(m.p); if ($('#dlg').open && $('#dlg').dataset.net) openNet(); toast(`${m.p.role === 'g' ? '🎈 ' + m.p.name : nameOf(m.p.role)} 來到小島了`); sfx('chime'); return; }
  if (m.t === 'leave') {
    const p = MP.peers.get(m.id); if (!p) return; MP.peers.delete(m.id);
    if (p.role === 'g') { p.c.av.root.parent?.remove(p.c.av.root); toast(`${p.name} 離開小島了`); }
    else { const c = chars[p.role]; c.remote = false; c.net = null; c.locked = false; c.y = null; c.av.setPose('stand'); c.av.holdHand(0); c.sc = scene; c.x = me().x + 1; c.z = me().z + 1; toast(`${nameOf(p.role)} 離線了`); if (MP.led || MP.lead) { MP.led = null; MP.lead = false; } }
    updateNetChip(); if ($('#dlg').open && $('#dlg').dataset.net) openNet(); return;
  }
  if (m.t === 'pos') { const c = peerChar(m.id); if (!c) return; c.net = m; if (!c.seen) { c.seen = 1; c.x = m.x; c.z = m.z; c.ry = m.ry; } return; }
  if (m.t === 'emo') { const c = peerChar(m.id); if (!c) return; c.av.emote(m.k, m.d); if (m.k === 'kiss' || m.k === 'hug') burst('heart', headPos(c, 1.6), 5, 0.3); return; }
  if (m.t === 'fx') { if (m.k === 'fw' && scene === 'out') launchFirework(!!m.a, true); return; }
  if (m.t === 'boat') { if (W?.boat && !MP.driving) { W.boat.position.x = m.x; W.boat.position.z = m.z; W.boat.rotation.y = m.ry; } MP.boatAway = !m.home; return; }
  if (m.t === 'save') { applySave(m.keys); return; }
  if (m.t === 'memo') { st.diary.unshift(m.m); if (st.diary.length > 300) st.diary.length = 300; save(); return; }
  if (m.t === 'clock') { st.tod = m.clock.tod; st.day = m.clock.day; MP.expTod = st.tod; updateHud(); return; }
  if (m.t === 'owner') { MP.owner = m.owner; if ($('#dlg').open && $('#dlg').dataset.net) openNet(); return; }
  if (m.t === 'paired') { if (MP.owner) MP.owner.paired = true; toast('另一半加入小島了 ❤', 3500); burst('heart', headPos(me(), 1.6), 10); if ($('#dlg').open && $('#dlg').dataset.net) openNet(); return; }
  if (m.t === 'book') { if (MP.owner) MP.owner.book = [m.e, ...(MP.owner.book || [])]; if (MP.role !== 'g') toast(`📝 ${m.e.n}：${m.e.text}`, 4000); return; }
  if (m.t === 'say') { const c = peerChar(m.id) || (m.id === MP.id ? me() : null); if (c) showSay(c, m.text); return; }
  if (m.t === 'err') { toast(m.why === 'slow' ? '留言太快了，等一下再寫' : CHAT_WHY[m.why] || '沒有送出'); return; }
  if (m.t === 'love') { onLoveReq(m.from, m.k); return; }
  if (m.t === 'loveok') { onLoveOk(m.from, m.k, m.ok); return; }
}
function addPeer(p, quiet) {
  MP.peers.set(p.id, p);
  if (p.role === 'g') { p.c = newChar(p.look || randomLook()); p.c.remote = true; if (p.pos) { p.c.net = p.pos; p.c.x = p.pos.x; p.c.z = p.pos.z; p.c.seen = 1; } }
  else { const c = chars[p.role]; c.remote = true; c.locked = false; c.path = null; if (p.pos) { c.net = p.pos; c.x = p.pos.x; c.z = p.pos.z; c.seen = 1; } else c.seen = 0; }
  updateNetChip();
}
// 頭上冒出的一句話
function showSay(c, text) {
  const e = document.createElement('div'); e.className = 'lbl say'; e.textContent = text; $('#labels').appendChild(e);
  const t0 = performance.now(), tick = () => { const k = (performance.now() - t0) / 5000; if (k > 1 || !c.av.root.visible) { e.remove(); return; } v3.copy(c.av.root.position); v3.y += 2.3; v3.project(cam); e.style.left = ((v3.x + 1) / 2 * innerWidth) + 'px'; e.style.top = ((1 - v3.y) / 2 * innerHeight) + 'px'; e.style.opacity = k > 0.85 ? (1 - k) / 0.15 : 1; requestAnimationFrame(tick); };
  tick();
}
// 情侶互動（連線）：問對方 → 對方答應才開始
let loveAsk = null, approach = null;
function requestLove(k) {
  const q = you(); const pid = [...MP.peers.values()].find(p => p.role === 1 - MP.role)?.id; if (!pid) return;
  if (k === 'hand' && (MP.lead || MP.led)) { MP.net.send({ t: 'love', to: pid, k: 'unhand' }); MP.lead = false; MP.led = null; toast('放開手了'); return; }
  MP.net.send({ t: 'love', to: pid, k }); toast(`問問 ${nameOf(q.i)}…`);
}
function onLoveReq(from, k) {
  if (k === 'unhand') { MP.lead = false; MP.led = null; toast(`${peerName(from)} 放開手了`); return; }
  if (!LOVE_WORD[k]) return;
  loveAsk = { from, k };
  openDlg('💕', `<p style="font-size:17px;font-weight:700;text-align:center">${esc(peerName(from))} 想${LOVE_WORD[k]} ❤</p><div class="row"><button type="button" class="ghost" id="lv-no">等一下</button><button type="button" class="primary" id="lv-ok">好呀</button></div>`);
  sfx('chime');
  $('#lv-no').onclick = () => { MP.net.send({ t: 'loveok', to: from, k, ok: 0 }); $('#dlg').close(); };
  $('#lv-ok').onclick = () => {
    $('#dlg').close(); MP.net.send({ t: 'loveok', to: from, k, ok: 1 });
    const c = peerChar(from); if (!c) return;
    if (act) endAct();
    if (k === 'hand') { MP.led = c; toast(`${peerName(from)} 牽著你走 🤝（推搖桿就會放開）`); return; }
    approach = { c, k, t: 0 };
  };
}
function onLoveOk(from, k, ok) {
  const c = peerChar(from); if (!c) return;
  if (!ok) { toast(`${peerName(from)} 說等一下`); return; }
  if (k === 'hand') { MP.lead = true; toast(`牽起 ${peerName(from)} 的手 🤝`); addLove(2, null, 'hand'); return; }
  setTimeout(() => {
    const p = me(); p.ry = Math.atan2(c.x - p.x, c.z - p.z);
    if (k === 'hug') { p.av.emote('hug', 1.8); toast(`抱住了 ${peerName(from)} 🤗`); }
    if (k === 'kiss') { p.av.emote('kiss', 1.5); toast('啾 😘'); }
    if (k === 'pat') { p.av.emote('pat', 1.6); }
    burst('heart', headPos(p, 1.6), k === 'kiss' ? 10 : 6, 0.4); sfx('pop'); addLove({ hug: 2, kiss: 3, pat: 2 }[k] || 1, null, k);
  }, 900);
}
// 這支手機的角色被牽著走、或走過去讓對方抱
function netMove(dt, hasInput) {
  const p = me();
  if (approach) {
    const c = approach.c, yw = scene === 'in' ? view.inYaw : view.yaw, gap = approach.k === 'hug' ? 0.55 : approach.k === 'kiss' ? 0.62 : 0.8;
    let tx = c.x + Math.cos(yw) * gap, tz = c.z - Math.sin(yw) * gap; if (!canStand(tx, tz)) { tx = c.x - Math.cos(yw) * gap; tz = c.z + Math.sin(yw) * gap; }
    approach.t += dt; const d = Math.hypot(tx - p.x, tz - p.z);
    if (d < 0.12 || approach.t > 2) { if (d >= 0.12) { p.x = tx; p.z = tz; } p.ry = Math.atan2(c.x - p.x, c.z - p.z); const k = approach.k; p.av.emote(k === 'hug' ? 'hug' : 'shy', 1.8); burst('heart', headPos(p, 1.6), 4, 0.3); approach = null; loveHold = 2; }
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
  if (!MP.on) { el.textContent = '🌐'; el.classList.remove('on'); return; }
  const n = MP.peers.size + 1; el.textContent = `🌐 ${n}`; el.classList.add('on');
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
      ${o.paired ? '' : `<div class="memo"><span class="ic">💌</span><b>情侶碼：<span style="font-size:22px;letter-spacing:.15em">${esc(o.pair || '（已過期）')}</span></b><small>給另一半在自己手機的「🌐 → 我有情侶碼」輸入（7 天內有效）</small></div><button type="button" class="primary" id="net-invite">💌 傳給另一半</button><button type="button" class="ghost" id="net-newpair">重新產生情侶碼</button>`}
      <div class="memo"><span class="ic">🎈</span><b>訪客連結</b><small style="word-break:break-all">${esc(link)}</small></div>
      <div class="row"><button type="button" class="ghost" id="net-share">分享給朋友</button><button type="button" class="ghost" id="net-newguest">重設連結</button></div>
      <div class="toggle-row"><span>${o.locked ? '🔒' : '🚪'} 朋友可以來玩<br><small class="muted">${o.locked ? '目前：鎖住了，朋友點連結也進不來' : '目前：開放中，有訪客連結的朋友都能進來'}</small></span><button type="button" id="net-lock" aria-pressed="${!o.locked}" aria-label="朋友可以來玩">${o.locked ? '關' : '開'}</button></div>
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
    const link = `${location.origin}${location.pathname}?pair=${code}`, text = `💌 ${nameOf(myIdx())} 邀請你一起住在「我們的小島」！點連結、填名字就能加入（情侶碼 ${code}）`;
    try { if (navigator.share) await navigator.share({ title: '我們的小島', text, url: link }); else { await navigator.clipboard.writeText(text + '\n' + link); toast('邀請連結已複製，貼給另一半吧'); } } catch (e) {}
  });
  on('net-newguest', () => { if (confirm('重設之後，舊的訪客連結就不能用了。確定嗎？')) MP.net.send({ t: 'newguest' }); });
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
  for (const [id, p] of MP.peers) rows.push(`<li>${p.role === 'g' ? '🎈 ' + esc(p.name) : '💗 ' + esc(nameOf(p.role)) + '（島主）'}${owner && p.role === 'g' ? ` <button type="button" class="ghost" data-kick="${id}" style="padding:2px 8px;font-size:12px">請離開</button>` : ''}</li>`);
  return `<b>在島上的人（${MP.peers.size + 1}）</b><ul style="margin:0;padding-left:1.2em;display:grid;gap:4px">${rows.join('')}</ul>`;
}

// ---------- 天氣、環境音 ----------
let WX = null, wNow = null, ambT = 0;
function tickWeather(dt, k) {
  if (!WX) return;
  wNow = weatherAt(st.day, st.tod);
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
function addCoins(n, why) { if (MP.role === 'g' || !n) return; if (n > 0) sfx('coin'); st.coins = (st.coins || 0) + n; save(); updateChips(); if (why) toast(`${why}　+${n} 🪙`); }
function questsToday() {
  if (MP.role === 'g') return [];
  if (!st.quests || st.quests.day !== st.day) {
    const season = seasonOf(st.day).k, pool = QUESTS.filter(q => !q[3] || q[3] === season);
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
  if (q.n >= def[2]) { addCoins(QUEST_COIN); toast(`📋 任務完成：${def[1]}　+${QUEST_COIN} 🪙`, 3200); sfx('chime'); }
  if (!st.quests.bonus && list.every(x => x.n >= QUESTS.find(y => y[0] === x.k)[2])) {
    st.quests.bonus = true; st.questDays = (st.questDays || 0) + 1; addCoins(QUEST_BONUS);
    setTimeout(() => { toast(`🎉 今天的任務全部完成！+${QUEST_BONUS} 🪙`, 3500); burst('star', headPos(me(), 1.6), 10); }, 1500);
    addLove(5); addMemo('📋', `完成了第 ${st.questDays} 天的每日任務`);
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
  const qc = $('#quest-chip'); qc.textContent = `📋 今日任務 ${done}/3`; qc.classList.toggle('done', done === 3);
  $('#coin-chip').textContent = `🪙 ${st.coins || 0}`;
}
$('#quest-chip').onclick = () => openQuests();
$('#coin-chip').onclick = () => openShop();
function openQuests() {
  sfx('click'); const list = questsToday(), s = seasonOf(st.day), w = weatherAt(st.day, st.tod);
  const rows = list.map(q => { const d = QUESTS.find(x => x[0] === q.k), ok = q.n >= d[2]; return `<div class="quest ${ok ? 'ok' : ''}"><span class="q-e">${ok ? '✅' : '⬜'}</span><b>${esc(d[1])}</b><span class="q-r">+${QUEST_COIN} 🪙</span><small>${q.n}/${d[2]}</small><div class="bar"><i style="width:${q.n / d[2] * 100}%"></i></div></div>`; }).join('');
  const ms = MILESTONES.map(([k, text, ok, coins, item]) => `<div class="quest ${st.rewards?.[k] ? 'ok' : ''}"><span class="q-e">${st.rewards?.[k] ? '🏆' : '🔒'}</span><b>${esc(text)}</b><span class="q-r">+${coins} 🪙</span><small>送「${esc(DECOR.find(d => d[0] === item)?.[1] || '')}」</small></div>`).join('');
  openDlg('📋 今日任務', `<p class="muted">小島第 ${st.day} 天 · ${s.icon} ${s.name}（每 7 天換季）· 今天 ${w.icon || '☀️'} ${w.name}</p>${rows}<p class="muted">三個都完成再加 ${QUEST_BONUS} 🪙 和甜蜜值，明天會換新的任務。</p><b>🏆 收藏獎勵</b>${ms}<button type="button" class="primary" id="q-shop">🪙 ${st.coins || 0} → 去買擺設</button>`);
  $('#q-shop').onclick = openShop;
}

// ---------- 裝潢：買擺設、擺在屋外或小木屋裡 ----------
const decorObjs = []; const DCIRC = { out: [], in: [] };
async function drawDecor() {
  decorObjs.forEach(o => o.parent?.remove(o)); decorObjs.length = 0; DCIRC.out = []; DCIRC.in = [];
  for (const d of st.decor || []) {
    const def = DECOR.find(x => x[0] === d.id); if (!def) continue;
    const S = d.sc === 'in' ? IN?.S : OUT; if (!S) continue;
    const g = await load(def[0]); if (!g) continue;
    const o = cloneModel(g); o.scale.setScalar(def[4]); o.position.set(d.x, d.sc === 'in' ? 0 : standH(d.x, d.z), d.z); o.rotation.y = d.ry || 0; S.add(o); decorObjs.push(o);
    if (def[5]) DCIRC[d.sc].push([d.x, d.z, def[5]]);
  }
  delete grids.out; delete grids.in;
}
function openShop() {
  if (MP.role === 'g') return; sfx('click'); st.inv = st.inv || {}; st.decor = st.decor || [];
  const here = scene, can = d => d[3] === 'any' || d[3] === here;
  const items = DECOR.filter(can).map(d => `<button type="button" data-buy="${d[0]}" ${(st.coins || 0) < d[2] ? 'disabled' : ''}>${esc(d[1])}<small>🪙 ${d[2]}${st.inv[d[0]] ? ` · 有 ${st.inv[d[0]]} 個` : ''}</small></button>`).join('');
  const inv = Object.entries(st.inv).filter(([k, n]) => n > 0 && can(DECOR.find(d => d[0] === k) || [0, 0, 0, 'none'])).map(([k, n]) => `<button type="button" data-place="${k}">${esc(DECOR.find(d => d[0] === k)[1])}<small>×${n}・點一下擺放</small></button>`).join('');
  const placed = (st.decor || []).map((d, i) => d.sc === here ? `<button type="button" data-take="${i}">${esc(DECOR.find(x => x[0] === d.id)?.[1] || '')}<small>收起來（放回包包）</small></button>` : '').join('');
  openDlg(`🛠️ 裝潢${here === 'in' ? '小木屋' : '小島'}`, `<p class="muted">🪙 ${st.coins || 0} 小島幣（做每日任務、釣魚、撿貝殼、堆沙堡可以賺）${here === 'in' ? '' : '　想裝潢小木屋就進屋再打開'}</p>
    ${here === 'in' ? `<b>🏠 屋內風格</b><div class="shop">${Object.entries(THEMES).map(([k, t]) => `<button type="button" data-theme="${k}" aria-pressed="${(st.theme || 'muji') === k}">${k === 'muji' ? '🤍' : '🪵'} ${esc(t.name)}<small>${k === 'muji' ? '淺色原木、米白、亞麻灰' : '原木牆、深木地板、暖黃光'}</small></button>`).join('')}</div>` : ''}
    ${inv ? `<b>🎒 包包裡</b><div class="shop">${inv}</div>` : ''}<b>🛒 商店</b><div class="shop">${items}</div>${placed ? `<b>📍 已經擺好的</b><div class="shop">${placed}</div>` : ''}`);
  $('#dlg-body').querySelectorAll('[data-buy]').forEach(b => b.onclick = () => { const d = DECOR.find(x => x[0] === b.dataset.buy); if ((st.coins || 0) < d[2]) return; st.coins -= d[2]; st.inv[d[0]] = (st.inv[d[0]] || 0) + 1; save(); updateChips(); sfx('chime'); toast(`買了「${d[1]}」`); startPlace(d[0]); });
  $('#dlg-body').querySelectorAll('[data-place]').forEach(b => b.onclick = () => startPlace(b.dataset.place));
  $('#dlg-body').querySelectorAll('[data-theme]').forEach(b => b.onclick = () => { st.theme = b.dataset.theme; save(); if (IN) applyTheme(IN, st.theme); sfx('chime'); toast(`屋內換成「${THEMES[st.theme].name}」風格`); openShop(); });
  $('#dlg-body').querySelectorAll('[data-take]').forEach(b => b.onclick = () => { const d = st.decor.splice(+b.dataset.take, 1)[0]; st.inv[d.id] = (st.inv[d.id] || 0) + 1; save(); drawDecor(); openShop(); });
}
async function startPlace(id) {
  $('#dlg').close(); const def = DECOR.find(x => x[0] === id); const g = await load(def[0]); if (!g) return;
  const ghostO = cloneModel(g); ghostO.scale.setScalar(def[4]); ghostO.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.6; } }); curS().add(ghostO);
  let ry = me().ry + Math.PI, ok = false;
  const pos = () => { const p = me(), d = 1.5; return [p.x + Math.sin(p.ry) * d, p.z + Math.cos(p.ry) * d]; };
  beginAct('place', `🛠️ 擺放「${def[1]}」`, '走動決定位置，擺好按「放這裡」。', {
    move: true,
    btns: [{ t: '放這裡', main: true, fn: () => { if (!ok) return toast('這裡放不下，換個地方'); const [x, z] = pos(); st.decor = st.decor || []; st.decor.push({ id, sc: scene, x: +x.toFixed(2), z: +z.toFixed(2), ry: +ry.toFixed(2) }); st.inv[id]--; save(); drawDecor(); sfx('pop'); burst('star', new THREE.Vector3(x, (scene === 'in' ? 0 : standH(x, z)) + 0.6, z), 6, 0.4); addMemo('🛠️', `在${scene === 'in' ? '小木屋' : '小島'}擺了「${def[1]}」`); endAct(); } }, { t: '轉一下', fn: () => { ry += Math.PI / 4; } }],
    update() { const [x, z] = pos(); ghostO.position.set(x, scene === 'in' ? 0 : standH(x, z), z); ghostO.rotation.y = ry; ok = canStand(x, z) || (def[5] === 0); ghostO.traverse(o => { if (o.isMesh) o.material.color?.set(ok ? '#ffffff' : '#ff6a6a'); }); },
    end() { ghostO.parent?.remove(ghostO); },
  });
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
  fadeDo(() => { seat(me(), SNOWMAN.x - 0.9, null, SNOWMAN.z + 0.3, Math.PI / 2 - 0.2, 'crouch'); seat(you(), SNOWMAN.x + 0.9, null, SNOWMAN.z + 0.3, -Math.PI / 2 + 0.2, 'crouch'); }, 250);
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
function applyLow() { R.setPixelRatio(st.low ? 1 : PR); resize(); }
let fpsT = 0, fpsN = 0, lowAsked = false;
function tickFps(dt) {
  if (st.low || lowAsked || !started() || navigator.webdriver) return; fpsT += dt; fpsN++;
  if (fpsT > 10) { const fps = fpsN / fpsT; fpsT = 0; fpsN = 0; if (fps < 24) { lowAsked = true; openDlg('🔋 手機有點吃力', `<p>畫面每秒只有 ${Math.round(fps)} 張，要不要打開<b>省電模式</b>？畫面會稍微不那麼細，但比較順、比較不燙。</p><div class="row"><button type="button" class="ghost" value="close">先不用</button><button type="button" class="primary" id="low-on">打開省電模式</button></div>`); $('#low-on').onclick = () => { st.low = true; save(); applyLow(); $('#dlg').close(); toast('🔋 已打開省電模式（📔 → 關於 可以關掉）'); }; } }
}


// ---------- 雞舍：撿雞蛋、餵雞（前一天有餵，隔天多下一顆蛋） ----------
let eggObjs = [];
function eggsToday() { if (!st.eggs || st.eggs.day !== st.day) { st.eggs = { day: st.day, n: 2 + (st.fedDay === st.day - 1 ? 1 : 0) }; } return st.eggs.n; }
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
    { t: `🥚 撿雞蛋（還有 ${eggsToday()} 顆）`, main: true, dis: !eggsToday(), fn: () => {
      if (!eggsToday()) return; st.eggs.n--; st.pantry = st.pantry || {}; st.pantry['雞蛋'] = (st.pantry['雞蛋'] || 0) + 1; save(); drawEggs();
      me().av.emote('pickup', 1.1); sfx('pop'); quest('egg'); burst('star', headPos(me(), 0.4), 2, 0.2);
      msg(`撿到一顆雞蛋！冰箱裡有 ${st.pantry['雞蛋']} 顆。`); btns();
    } },
    { t: st.fedDay === st.day ? '今天餵過了' : '🌾 餵雞', dis: st.fedDay === st.day, fn: () => {
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
    btns: [{ t: '下車', main: true, fn: () => endAct() }, { t: '🔔 按鈴', fn: () => { if (ringT > 0) return; ringT = 0.6; sfx('chime'); you().av.emote('wave', 1); } }],
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
    const want = (c === me() ? !!st.flash : !!c.net?.fl) && c.av.root.visible && (c.sc || 'out') === scene;
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
  if (started() && !document.hidden) { st.tod += dt / 36; if (st.tod >= 24) { st.tod -= 24; newDay(); toast(`第 ${st.day} 天了`); } }
  const k = setTimeOfDay(W, OUT, preview.on ? 17.6 : st.tod, cam.position);
  W.water.material.uniforms.uTime.value = T;
  if (!preview.on) { tickWeather(dt, k); tickTutorial(dt); tickFps(dt); tickRemoteBikes(); nightK = k.night; tickFlash();
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
  allChars().forEach(c => syncAv(c, dt));
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
  saveT += dt; if (saveT > 1) { saveT = 0; $('#clock').textContent = clockText(); }
  R.render(curS(), cam);
}

// 用情侶碼加入另一半的小島
async function joinByCode(code) {
  const r = await pairIsland(code); saveAuth({ island: r.island, key: r.key, role: r.role }); MP.role = r.role; MP.id = null;
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
  try { const r = await peekPair(pairParam); const n = r.names?.find(Boolean); if (n) ban.textContent = `💌 ${n} 邀請你一起住在小島上`; if (r.paired) ban.textContent = '這座小島已經有兩位島主了'; } catch (e) { ban.textContent = '💌 邀請碼可能過期了，請另一半重新傳一次'; }
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

// ---------- 開始 ----------
(async function boot() {
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
  buildInterior(st.theme || 'muji').then(I => { IN = I; drawDecor(); });
  if (visitParam.length) setupVisit();
  else if (pairParam) setupPairSplash();
  window.__nest = { get st() { return st; }, IN: () => IN, view, OUT, pantryText, tutorial, weatherAt, seasonOf, WX: () => WX, teleportTo, quest, openShop, cam, MP, chars, allChars, forceSave: () => save(), W: () => W, act: () => act, SP, me, you, scene: () => scene, setTod: t => { st.tod = t; } };
})();

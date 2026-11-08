// 我們的小島：情侶小窩 3D 遊戲
import * as THREE from '../vendor/three.module.min.js';
import { Avatar, randomLook, heartMesh, HAIRS, HAIR_COLORS, SKINS, OUTFITS, ACCS, EYES, MOUTHS, HEADS, KIND_NAMES, preloadBodies, preloadClips } from './char.js';
import { groundH, standH, walkable, onDock, DOCK, LAND_Y, shoreR } from './terrain.js';
import { buildIsland, buildInterior, setTimeOfDay, SPOTS, INSPOTS, ROOM, blocked, CIRCLES, BOXES } from './world.js';
import { load, toon, tickAnimals, playA, progress, mixers } from './models.js';
import { levelOf, REWARDS, FISH, SHELLS, FLOWERS, DISHES, LETTERS, BOTTLE, TIPS } from './data.js';
import { initUpdates, showNewsOnce, APP_VER } from './update.js';
import { Music, sfx } from './audio.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rand = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const AS = 1, HIP = 0.306; // 角色大小、坐下時屁股離腳底的高度

// ---------- 存檔 ----------
const KEY = 'nest.save';
const DEF = { v: 1, names: ['', ''], looks: [null, null], anniv: '', love: 0, day: 1, tod: 9, diary: [], fish: {}, shells: {}, garden: [null, null, null], castles: 0, letterDay: 0, ctrl: 0, music: true, started: false, hand: false, flowersGiven: 0, dishes: 0, wishes: 0, fireworks: 0, laps: 0 };
let st = (() => { try { return { ...DEF, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (e) { return { ...DEF }; } })();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };
setInterval(save, 5000); addEventListener('visibilitychange', () => { if (document.hidden) save(); });
const nameOf = i => st.names[i] || (i ? '另一半' : '我');

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
const chars = [0, 1].map(i => ({ i, av: null, x: i ? 1.4 : 0, z: 1.5, ry: Math.PI, y: null, moving: false, locked: false, path: null, spinT: 0, stuck: 0, tilt: 0 }));
function makeAv(i) {
  const c = chars[i];
  if (c.av) { c.av.setLook(st.looks[i]); return; }
  c.av = new Avatar(st.looks[i]); c.av.root.scale.setScalar(AS); OUT.add(c.av.root);
}
const me = () => chars[st.ctrl], you = () => chars[1 - st.ctrl];

// ---------- 開場 ----------
const preview = { on: true, t: 0 };
function syncSplash() {
  $('#name0').value = st.names[0]; $('#name1').value = st.names[1]; $('#anniv').value = st.anniv || '';
  document.querySelectorAll('.who').forEach(w => { const i = +w.dataset.i; w.querySelectorAll('[data-g]').forEach(b => b.setAttribute('aria-pressed', String(st.looks[i].gender === b.dataset.g))); });
}
document.querySelectorAll('.who').forEach(w => {
  const i = +w.dataset.i;
  w.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { st.looks[i] = randomLook(b.dataset.g); makeAv(i); syncSplash(); sfx('click'); });
  w.querySelector('.shuffle').onclick = () => { st.looks[i] = randomLook(st.looks[i].gender); makeAv(i); chars[i].av.emote('jump', 1); sfx('click'); };
});
$('#start-btn').onclick = () => {
  st.names = [$('#name0').value.trim().slice(0, 8), $('#name1').value.trim().slice(0, 8)];
  st.anniv = $('#anniv').value || '';
  const first = !st.started; st.started = true; save();
  Music.init(); if (st.music) Music.play();
  $('#splash').classList.add('out'); setTimeout(() => { $('#splash').hidden = true; }, 600);
  $('#hud').hidden = false; preview.on = false;
  chars.forEach(c => { c.locked = false; c.av.setPose('stand'); });
  placeStart();
  updateHud();
  if (first) { addMemo('🏝️', `${nameOf(0)} 和 ${nameOf(1)} 一起搬到了小島上`); setTimeout(() => toast('歡迎回家！靠近有標籤的地方就能一起做事 ♥', 4200), 900); }
  else { toast(pick(TIPS), 4000); showNewsOnce(); }
};
function placeStart() { const c0 = me(), c1 = you(); c0.x = 0.5; c0.z = 3.2; c0.ry = 0.5; c1.x = -0.6; c1.z = 3.4; c1.ry = 0.5; view.yaw = 0.5; updateCam(0, true); }

// ---------- 介面小工具 ----------
let toastT = 0;
function toast(msg, ms = 2600) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms); }
function fadeDo(fn, hold = 380) { const f = $('#fade'); f.classList.add('on'); return new Promise(r => setTimeout(() => { fn(); setTimeout(() => { f.classList.remove('on'); r(); }, 120); }, hold)); }
function dateStr() { const d = new Date(); return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`; }
function addMemo(icon, text) { st.diary.unshift({ d: dateStr(), day: st.day, icon, text }); if (st.diary.length > 300) st.diary.length = 300; save(); }
function daysTogether() { if (!st.anniv) return null; const a = new Date(st.anniv + 'T00:00:00'), n = new Date(); n.setHours(0, 0, 0, 0); return Math.max(1, Math.round((n - a) / 864e5) + 1); }
const loveCD = {};
function addLove(n, why, key) {
  if (key) { const now = performance.now(); if (loveCD[key] && now - loveCD[key] < 45e3) { n = Math.ceil(n / 4); } loveCD[key] = now; }
  const before = levelOf(st.love).lv; st.love += n; const after = levelOf(st.love);
  updateHud();
  if (after.lv > before) {
    sfx('chime'); setTimeout(() => toast(`💗 升到 Lv${after.lv}「${after.title}」！${REWARDS[after.lv] ? '解鎖：' + REWARDS[after.lv] : ''}`, 4500), 400);
    addMemo('💗', `我們的關係升級成「${after.title}」`);
    burst('heart', me().av.root.position.clone().add(new THREE.Vector3(0, 1.8, 0)), 14);
    if (after.lv === 2 && !st.looks.some(l => l.acc)) { /* 只解鎖，不自動戴 */ }
  } else if (why) toast(`${why}　+${n} 甜蜜`);
}
function updateHud() {
  $('#hud-names').textContent = `${nameOf(0)} ♥ ${nameOf(1)}`;
  const d = daysTogether(); $('#hud-days').textContent = d ? `在一起第 ${d} 天` : `小島第 ${st.day} 天`;
  const L = levelOf(st.love); $('#hud-lv').textContent = `Lv${L.lv} ${L.title}`; $('#love-bar').style.width = (L.pct * 100).toFixed(1) + '%';
  $('#swap-name').textContent = `換${nameOf(1 - st.ctrl)}`;
  $('#btn-music').setAttribute('aria-pressed', String(!!st.music));
}
function clockText() { const h = Math.floor(st.tod), m = Math.floor((st.tod - h) * 60); const ic = st.tod >= 5.5 && st.tod < 17.8 ? '☀️' : st.tod >= 17.8 && st.tod < 19.3 ? '🌇' : '🌙'; return `${ic} ${String(h).padStart(2, '0')}:${String(Math.floor(m / 10) * 10).padStart(2, '0')}`; }
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
const midPos = (up = 1.6) => headPos(chars[0], up).add(headPos(chars[1], up)).multiplyScalar(0.5);

// ---------- 煙火 ----------
const fireworks = [];
function launchFirework(heart) {
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
const view = { yaw: 0.5, pitch: 0.5, dist: 11, inYaw: 0, inDist: 10.5 };
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
    if (scene === 'in') { view.inYaw = clamp(view.inYaw - dx * 0.004, -0.7, 0.7); return; }
    view.yaw -= dx * 0.006; view.pitch = clamp(view.pitch + dy * 0.004, 0.08, 1.35);
  });
  const up = e => { const was = pts.get(e.pointerId); pts.delete(e.pointerId); if (downAt && was && downAt.moved < 10 && performance.now() - downAt.t < 400) tapAt(e.clientX, e.clientY); downAt = null; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', e => { pts.delete(e.pointerId); downAt = null; });
  canvas.addEventListener('wheel', e => { e.preventDefault(); zoom(1 + Math.sign(e.deltaY) * 0.1); }, { passive: false });
})();
function zoom(k) { if (scene === 'in') view.inDist = clamp(view.inDist * k, 5.5, 15); else view.dist = clamp(view.dist * k, 3.2, 24); }
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
  if (pt) { me().path = { x: pt.x, z: pt.z }; spawnRing(pt); }
}
let ringM = null;
function spawnRing(p) {
  if (!ringM) { ringM = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.36, 24), new THREE.MeshBasicMaterial({ color: '#ff7a9c', transparent: true, depthWrite: false })); ringM.rotation.x = -Math.PI / 2; }
  curS().add(ringM); ringM.position.set(p.x, (scene === 'in' ? 0 : standH(p.x, p.z)) + 0.05, p.z); ringM.userData.t = 0;
}

// ---------- 移動與碰撞 ----------
const R_BODY = 0.28;
function canStand(x, z) {
  if (scene === 'in') { const hw = ROOM.w / 2 - 0.4, hd = ROOM.d / 2 - 0.4; return x > -hw && x < hw && z > -hd && z < hd + 0.3 && !blocked(x, z, R_BODY, [], IN.BOXES); }
  return walkable(x, z) && !blocked(x, z, R_BODY, CIRCLES, BOXES);
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
  const p = me(), q = you(); if (q.locked) return;
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
function toggleLoveMenu(force) { const m = $('#love-menu'); m.hidden = force === undefined ? !m.hidden : !force; m.querySelector('[data-l="hand"]').setAttribute('aria-pressed', String(!!st.hand)); }
$('#btn-love').onclick = () => toggleLoveMenu();
$('#love-menu').addEventListener('click', e => { const b = e.target.closest('[data-l]'); if (!b) return; toggleLoveMenu(false); loveAction(b.dataset.l); });
function loveAction(kind) {
  sfx('click');
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
  if (act) return toast('先離開目前的活動喔');
  st.ctrl = 1 - st.ctrl; save(); updateHud(); me().path = null; you().path = null; me().stuck = you().stuck = 0;
  toast(`現在操作：${nameOf(st.ctrl)}`); me().av.emote('wave', 1.2); sfx('click');
};

// ---------- 活動系統 ----------
let act = null;
const started = () => !preview.on;
const v3 = new THREE.Vector3();
function seat(c, x, y, z, ry, pose = 'sit') { c.locked = true; c.path = null; c.x = x; c.z = z; c.y = y; c.ry = ry; c.moving = false; c.av.setPose(pose); c.av.holdHand(0); }
function unseat(c) { c.locked = false; c.y = null; c.tilt = 0; c.moving = false; c.av.setPose('stand'); c.av.reach(false); c.av.lean(0); c.av.setItem(null); }
function setBtns(list) {
  const box = $('#ap-btns'); box.innerHTML = '';
  list.forEach(b => {
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
  toggleLoveMenu(false); $('#btn-act').hidden = true; $('#joy').style.visibility = 'hidden';
  // 有些活動要看向特定方向（海、夕陽、煙火）
  if (o.camYaw != null) { view.yaw = o.camYaw; if (o.camPitch != null) view.pitch = o.camPitch; }
}
function endAct() {
  if (!act) return; const a = act; act = null;
  a.end?.(); chars.forEach(unseat); $('#act-panel').hidden = true; $('#joy').style.visibility = '';
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
  { id: 'exit', sc: 'in', ...INSPOTS.exit, r: 1.6, icon: '🚪', name: '出門', run: exitHouse },
  { id: 'bed', sc: 'in', ...INSPOTS.bed, icon: '🛏️', name: '床', run: actBed },
  { id: 'sofa', sc: 'in', ...INSPOTS.sofa, icon: '🛋️', name: '沙發', run: actSofa },
  { id: 'kitchen', sc: 'in', ...INSPOTS.kitchen, icon: '🍳', name: '做飯', run: actCook },
  { id: 'dining', sc: 'in', ...INSPOTS.dining, icon: '🍽️', name: '吃飯', run: actEat, hide: () => !IN?.dish.visible },
  { id: 'wardrobe', sc: 'in', x: -0.6, z: -2.7, icon: '👗', name: '衣櫃', run: () => openLooks() },
];
SP.forEach(s => {
  s.r = s.r || 2.2;
  const el = document.createElement('button'); el.type = 'button'; el.className = 'lbl'; el.textContent = `${s.icon} ${s.name}`; el.style.display = 'none';
  el.onclick = () => { if (act || !started()) return; const p = s.pos?.() || s; me().path = { x: p.x, z: p.z, then: s }; sfx('click'); };
  $('#labels').appendChild(el); s.el = el;
});
const nameEls = [0, 1].map(() => { const e = document.createElement('div'); e.className = 'lbl name'; $('#labels').appendChild(e); return e; });
let nearSpot = null;
function tickSpots() {
  const p = me(); let best = null, bd = 1e9;
  for (const s of SP) {
    const pp = s.pos?.() || s; const show = s.sc === scene && started() && !photo.on && !(s.hide?.());
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
  chars.forEach((c, i) => {
    const e = nameEls[i]; if (!started() || photo.on) { e.style.display = 'none'; return; }
    v3.copy(c.av.root.position); v3.y += c.av.pose === 'lie' ? 0.8 : 1.95; v3.project(cam);
    if (v3.z > 1) { e.style.display = 'none'; return; }
    e.style.display = ''; e.textContent = (i === st.ctrl ? '▼ ' : '') + nameOf(i); e.style.left = ((v3.x + 1) / 2 * innerWidth) + 'px'; e.style.top = ((1 - v3.y) / 2 * innerHeight) + 'px';
  });
  if (best !== nearSpot) {
    nearSpot = best; const b = $('#btn-act');
    if (best) { $('#act-icon').textContent = best.icon; $('#act-name').textContent = best.name; b.hidden = false; b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; }
    else b.hidden = true;
  }
}
$('#btn-act').onclick = () => { if (nearSpot && !act) { sfx('click'); nearSpot.run(); } };

// ---------- 小木屋：進出 ----------
async function enterHouse() {
  if (!IN) { toast('小屋整理中，稍等一下…'); IN = await buildInterior(); }
  await fadeDo(() => {
    scene = 'in'; chars.forEach(c => { OUT.remove(c.av.root); IN.S.add(c.av.root); c.path = null; c.y = null; });
    const p = me(), q = you(); p.x = INSPOTS.exit.x - 0.4; p.z = INSPOTS.exit.z - 0.6; p.ry = Math.PI; q.x = p.x - 0.8; q.z = p.z + 0.2; q.ry = Math.PI;
    view.inYaw = 0; nearSpot = null;
  });
  sfx('door');
}
async function exitHouse() {
  await fadeDo(() => {
    scene = 'out'; chars.forEach(c => { IN.S.remove(c.av.root); OUT.add(c.av.root); c.path = null; c.y = null; });
    const p = me(), q = you(); p.x = SPOTS.door.x; p.z = SPOTS.door.z + 1.4; p.ry = 0; q.x = p.x + 0.8; q.z = p.z + 0.3; q.ry = 0;
    view.yaw = 0; nearSpot = null;
  });
  sfx('door');
}

// ---------- 信箱：另一半寫的情書（每天一封） ----------
function openMail() {
  const fresh = st.letterDay !== st.day;
  const idx = (st.day * 7 + (st.ctrl ? 3 : 0)) % LETTERS.length;
  const text = LETTERS[idx].replaceAll('{a}', nameOf(me().i)).replaceAll('{b}', nameOf(you().i));
  openDlg('💌 今天的信', `<div class="letter">${esc(text)}</div><p class="muted">${fresh ? '每天都會有一封新的信。' : '今天的信已經看過了，明天再來看看。'}</p>`);
  if (fresh) { st.letterDay = st.day; addLove(3, '收到情書'); addMemo('💌', `${nameOf(me().i)} 收到 ${nameOf(you().i)} 寫的信`); me().av.emote('shy', 1.6); burst('heart', headPos(me()), 4); }
}

// ---------- 雙人鞦韆 ----------
function actSwing() {
  const sw = W.swing, pv = sw.userData.pivot, seatG = sw.userData.seat;
  let amp = 0.18, ph = 0, tick = 0;
  const place = () => {
    [[me(), -0.42], [you(), 0.42]].forEach(([c, x]) => { seatG.localToWorld(v3.set(x, 0.05, 0.02)); c.locked = true; c.x = v3.x; c.z = v3.z; c.y = v3.y - HIP; c.ry = 0; c.tilt = pv.rotation.x; c.av.setPose('swing'); });
  };
  fadeDo(place, 250);
  beginAct('swing', '🎠 雙人鞦韆', '兩個人一起盪鞦韆，風好舒服。', {
    focus: () => new THREE.Vector3(SPOTS.swing.x, LAND_Y + 1.4, SPOTS.swing.z), back: [SPOTS.swing.x, SPOTS.swing.z + 1.8],
    btns: [{ t: '用力盪！', main: true, fn: () => { amp = Math.min(0.62, amp + 0.12); me().av.emote('cheer', 0.8); sfx('whoosh'); } }, { t: '靠在肩膀上', fn: () => { you().av.lean(-1); me().av.lean(1); burst('heart', midPos(1.3), 4); addLove(2, '靠在一起', 'lean'); setTimeout(() => { you().av.lean(0); me().av.lean(0); }, 4000); } }],
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
    btns: [{ t: '一起睡午覺', main: true, fn: () => { nap = true; msg('呼…呼…（時間過得特別快）'); } }, { t: '說悄悄話', fn: () => { you().av.emote('shy', 1.6); burst('heart', midPos(0.6), 4); addLove(2, pick(['「我好喜歡你」', '「今天也謝謝你」', '「下次一起去看海」']), 'whisper'); } }],
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
function guitarItem() { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), toon('#c88a4a')); b.scale.set(1, 1.2, 0.45); g.add(b); const n = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.03), toon('#5a3a22')); n.position.y = 0.38; g.add(n); g.rotation.set(0.2, 0, 1.2); g.position.set(0.1, 0.1, 0.12); return g; }
function actCampfire() {
  const { x, z } = SPOTS.campfire, y = LAND_Y + 0.46 - HIP;
  fadeDo(() => sitPair(x, y, z - 1.9, 0, 0.62), 250);
  let roast = null, heat = 0, guitar = false, gt = 0, made = 0;
  const ZONE = [0.52, 0.74];
  const roastBtns = () => setBtns([{ t: '按住烤棉花糖', main: true, hold: on => { if (on) { if (!roast) { roast = stickItem(); me().av.setItem(roast); me().av.reach(true); heat = 0; } roast.userData.on = true; } else if (roast) { roast.userData.on = false; finish(); } } }, { t: guitar ? '停止彈唱' : '🎸 彈吉他', fn: toggleGuitar }]);
  const finish = () => {
    const h = heat; let t;
    if (h < ZONE[0]) t = '還沒烤熟，軟軟白白的…'; else if (h <= ZONE[1]) t = '完美的金黃色！外酥內軟 ✨'; else if (h < 0.92) t = '有點焦，但是很香。'; else t = '燒成黑炭了 😂';
    const good = h >= ZONE[0] && h <= ZONE[1];
    msg(`${t} 餵給 ${nameOf(you().i)} 吃～`); me().av.reach(false);
    setTimeout(() => { me().av.setItem(null); roast = null; meter(true, 0, ZONE); you().av.emote(good ? 'cheer' : 'shy', 1.4); burst('heart', headPos(you(), 1.3), good ? 8 : 3); sfx('pop'); }, 500);
    made++; addLove(good ? 4 : 1, good ? '完美棉花糖' : null, good ? null : 'mm');
    if (good) addMemo('🍡', `${nameOf(me().i)} 烤了完美的棉花糖餵 ${nameOf(you().i)}`);
  };
  const toggleGuitar = () => { guitar = !guitar; you().av.setItem(guitar ? guitarItem() : null); you().av.reach(guitar); if (guitar) { Music.duet(true); msg(`${nameOf(you().i)} 彈起吉他，兩個人一起哼歌 🎶`); addLove(2, '營火邊唱歌', 'guitar'); addMemo('🎸', '在營火邊一起唱歌'); } else Music.duet(false); roastBtns(); };
  beginAct('campfire', '🔥 營火', `按住按鈕烤棉花糖，在粉紅區放開最好吃。`, {
    focus: () => new THREE.Vector3(x, LAND_Y + 0.9, z - 0.6), back: [x - 1.8, z - 2.2],
    update(dt) {
      if (roast?.userData.on) { heat = Math.min(1, heat + dt * 0.28); meter(true, heat, ZONE); const c = new THREE.Color('#ffffff').lerp(new THREE.Color('#e8a040'), clamp(heat / 0.65, 0, 1)).lerp(new THREE.Color('#2a1a10'), clamp((heat - 0.7) / 0.3, 0, 1)); roast.userData.mm.material.color.copy(c); }
      if (guitar) { gt += dt; if (gt > 0.7) { gt = 0; burst('note', headPos(you(), 1.4), 1, 0.3); } }
    },
    end() { Music.duet(false); },
  });
  roastBtns(); meter(true, 0, ZONE);
}

// ---------- 野餐 ----------
function actPicnic() {
  const { x, z } = SPOTS.picnic, y = LAND_Y + 0.06 - HIP;
  let lying = false;
  fadeDo(() => { seat(me(), x - 0.5, y, z + 0.35, 0.5); seat(you(), x + 0.5, y, z + 0.35, -0.5); W.picnic.userData.food.visible = true; }, 250);
  const btns = () => setBtns([{ t: '餵你吃一口', main: true, fn: () => { me().av.reach(true); setTimeout(() => { me().av.reach(false); you().av.emote('shy', 1.5); burst('heart', headPos(you(), 1.2), 5); sfx('pop'); }, 600); addLove(3, pick(['草莓好甜', '三明治好吃', '西瓜冰冰涼涼']), 'feed'); } },
    { t: lying ? '坐起來' : '躺下看雲', fn: () => { lying = !lying; if (lying) { seat(me(), x - 0.35, LAND_Y + 0.02, z + 0.9, 0, 'lie'); seat(you(), x + 0.35, LAND_Y + 0.02, z + 0.9, 0, 'lie'); msg(pick(['那朵雲像一隻小狗！', '那朵雲像愛心耶', '那朵雲好像棉花糖'])); addLove(2, null, 'cloud'); } else { seat(me(), x - 0.5, y, z + 0.35, 0.5); seat(you(), x + 0.5, y, z + 0.35, -0.5); } btns(); } }]);
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
    btns: [{ t: '幫忙擦防曬', main: true, fn: () => { me().av.emote('pat', 1.4); you().av.emote('shy', 1.4); burst('heart', headPos(you(), 1.1), 3); addLove(2, '擦好防曬了', 'sun'); } }, { t: '去踩浪花', fn: () => { endAct(); const p = me(), q = you(); p.x = x - 0.5; p.z = z + 3.2; q.x = x + 0.5; q.z = z + 3.2; st.hand = true; toast('牽手去踩浪花吧～ 🌊'); } }],
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
  for (let i = 0; i < Math.min(st.castles, CASTLE_SPOTS.length); i++) { const [x, z] = CASTLE_SPOTS[i]; const o = g.scene.clone(true); o.position.set(x, standH(x, z), z); o.rotation.y = i * 1.3; OUT.add(o); castleObjs.push(o); }
}
async function actSand() {
  const idx = st.castles % CASTLE_SPOTS.length, [cx, cz] = CASTLE_SPOTS[idx];
  const g = await load('sandcastle'); const castle = g ? g.scene.clone(true) : new THREE.Group(); castle.position.set(cx, standH(cx, cz), cz); castle.scale.setScalar(0.05); OUT.add(castle);
  if (idx < castleObjs.length) castleObjs[idx].visible = false;
  const y = standH(cx, cz) + 0.02 - HIP;
  fadeDo(() => { seat(me(), cx - 0.75, y, cz, Math.PI / 2); seat(you(), cx + 0.75, y, cz, -Math.PI / 2); }, 250);
  let n = 0; const N = 8;
  beginAct('sand', '🏰 堆沙堡', `一起堆一座沙堡！點「堆沙」${N} 次。`, {
    focus: () => new THREE.Vector3(cx, 0.8, cz), back: [cx, cz - 1.6],
    btns: [{ t: '堆沙！', main: true, id: 'sand-go', fn: () => {
      if (n >= N) return; n++; castle.scale.setScalar(0.05 + 0.95 * (n / N)); me().av.reach(true); you().av.reach(true); setTimeout(() => { me().av.reach(false); you().av.reach(false); }, 250); sfx('sand'); burst('star', new THREE.Vector3(cx, standH(cx, cz) + 0.5, cz), 1, 0.3);
      msg(n < N ? `堆了 ${n}/${N}` : `完成了！這是你們的第 ${st.castles + 1} 座沙堡 🏰`);
      if (n === N) { st.castles++; addLove(4, '沙堡完成'); addMemo('🏰', `堆好第 ${st.castles} 座沙堡`); me().av.emote('cheer', 1.5); you().av.emote('clap', 1.5); burst('heart', midPos(1.2), 8); $('#sand-go').disabled = true; }
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
    fadeDo(() => { const y = standH(x, z) + 0.02 - HIP; seat(me(), x - 0.4, y, z + 0.8, 0.15); seat(you(), x + 0.4, y, z + 0.8, -0.15); }, 250);
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
  fadeDo(() => { const y = standH(x, z); [[me(), -0.45], [you(), 0.45]].forEach(([c, dx]) => { c.locked = true; c.x = x + dx; c.z = z; c.y = null; c.ry = 0.1; c.moving = false; }); me().av.reach(true); }, 250);
  beginAct('kite', '🪁 放風箏', '海風好大，風箏飛好高！', {
    focus: () => new THREE.Vector3(x, 3.5, z + 3), back: [x, z - 1], camYaw: Math.PI + 0.3, camPitch: 0.22,
    btns: [{ t: '放線（飛高一點）', main: true, fn: () => { want = Math.min(24, want + 3); } }, { t: '收線', fn: () => { want = Math.max(4, want - 3); } }, { t: '交給對方', fn: () => { const a = me().av.reaching; me().av.reach(!a); you().av.reach(a); you().av.emote('cheer', 1); addLove(1, null, 'kitepass'); } }],
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

// ---------- 釣魚 ----------
function rodItem() {
  const g = new THREE.Group(); const r = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.02, 1.8, 5), toon('#5a3a22')); r.position.y = 0.85; g.add(r);
  const tip = new THREE.Object3D(); tip.position.y = 1.75; g.add(tip); g.userData.tip = tip; g.rotation.x = 0.9; return g;
}
function pickFish() { const tot = FISH.reduce((s, f) => s + f[2], 0); let r = Math.random() * tot; for (const f of FISH) { r -= f[2]; if (r <= 0) return f; } return FISH[0]; }
function actFish() {
  const fx = SPOTS.fishing.x, y = DOCK.y + 0.04 - HIP;
  const rod = rodItem(), bob = new THREE.Group();
  const bb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), toon('#ff4a4a')); bob.add(bb); const bw = new THREE.Mesh(new THREE.SphereGeometry(0.091, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon('#ffffff')); bob.add(bw);
  const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8 }));
  bob.visible = ln.visible = false; OUT.add(bob); OUT.add(ln);
  fadeDo(() => { seat(me(), fx + 0.9, y, -0.35, Math.PI / 2); seat(you(), fx + 0.9, y, 0.45, Math.PI / 2); me().av.setItem(rod); me().av.reach(true); }, 250);
  let state = 'idle', t = 0, wait = 0, flyT = 0; const target = new THREE.Vector3(fx + 4.4, 0, -0.6);
  let caughtShow = null;
  const setState = s => { state = s; t = 0; };
  const btns = () => setBtns([{ t: state === 'idle' ? '拋竿' : state === 'bite' ? '收竿！' : state === 'wait' ? '等魚上鉤…' : '…', main: true, dis: state === 'fly' || state === 'reel', fn: press }]);
  const press = () => {
    if (state === 'idle') { setState('fly'); bob.visible = ln.visible = true; flyT = 0; target.set(fx + 3.6 + rand(0, 1.6), 0, rand(-1.4, 0.8)); msg('咻～'); sfx('whoosh'); btns(); }
    else if (state === 'wait') { msg('太早了，魚被嚇跑了…再試一次'); reset(); }
    else if (state === 'bite') { catchFish(); }
  };
  const reset = () => { setState('idle'); bob.visible = ln.visible = false; btns(); };
  const catchFish = async () => {
    setState('reel'); btns();
    const f = pickFish(), size = f[3] ? Math.round(rand(f[3], f[4])) : 0;
    st.fish[f[0]] = (st.fish[f[0]] || 0) + 1; save();
    sfx('splash'); me().av.emote('cheer', 1.2); you().av.emote('clap', 1.4);
    // 魚跳出水面
    const g = await load('fish'); let o = null;
    if (g && f[0] !== '舊靴子' && f[0] !== '瓶中信') { o = g.scene.clone(true); o.scale.setScalar(0.6); o.position.copy(bob.position); OUT.add(o); caughtShow = { o, t: 0 }; }
    bob.visible = ln.visible = false;
    const rare = f[0] === '愛心魚', bottle = f[0] === '瓶中信';
    msg(`釣到 ${f[1]} ${f[0]}${size ? `（${size} 公分）` : ''}！${f[5]}${bottle ? '\n' + pick(BOTTLE) : ''}`);
    addLove(rare ? 20 : bottle ? 5 : 2, rare ? '💗 傳說中的愛心魚！' : null, rare ? null : 'fish');
    if (rare || st.fish[f[0]] === 1) addMemo(f[1], `${nameOf(me().i)} 第一次釣到${f[0]}${size ? `（${size} 公分）` : ''}`);
    if (rare) burst('heart', midPos(), 16);
    setTimeout(() => { if (act?.id === 'fish') reset(); }, 1600);
  };
  beginAct('fish', '🎣 釣魚', '按「拋竿」，浮標往下沉的時候馬上按「收竿」！', {
    focus: () => new THREE.Vector3(fx + 2, DOCK.y + 0.5, 0), back: [fx - 0.5, 0], camYaw: -Math.PI / 2 - 0.5, camPitch: 0.35,
    update(dt) {
      t += dt; rod.userData.tip.getWorldPosition(v3);
      if (state === 'fly') { flyT += dt / 0.7; const k = Math.min(1, flyT); bob.position.lerpVectors(v3, target, k); bob.position.y += Math.sin(k * Math.PI) * 1.8; if (k >= 1) { setState('wait'); wait = rand(2, 6); msg('靜靜等待…'); btns(); sfx('plop'); } }
      if (state === 'wait') { bob.position.y = Math.sin(t * 2.4) * 0.03; if (t > wait) { setState('bite'); msg('上鉤了！快收竿！'); btns(); sfx('bite'); you().av.emote('cheer', 0.6); } }
      if (state === 'bite') { bob.position.y = -0.12 + Math.sin(t * 22) * 0.06; if (t > 1.15) { msg('魚跑掉了…再試一次'); reset(); } }
      if (bob.visible) ln.geometry.setFromPoints([v3.clone(), bob.position.clone()]);
      if (caughtShow) { const c = caughtShow; c.t += dt; c.o.position.y = Math.sin(Math.min(1, c.t / 1.2) * Math.PI) * 2.2; c.o.rotation.z += dt * 6; if (c.t > 1.25) { OUT.remove(c.o); caughtShow = null; } }
    },
    end() { OUT.remove(bob); OUT.remove(ln); if (caughtShow) OUT.remove(caughtShow.o); },
  });
  btns();
}

// ---------- 划船：繞小島一圈 ----------
function actBoat() {
  const boat = W.boat; if (!boat) return toast('小船還沒準備好');
  const home = boat.position.clone(), homeRy = boat.rotation.y;
  const RAD = 49, a0 = Math.atan2(home.z, home.x) + 0.05;
  let s = 0, paused = false, phase = 'out', lapA = 0, tk = 0;
  const place = () => {
    const ry = boat.rotation.y, fx = Math.sin(ry), fz = Math.cos(ry);
    const y = boat.position.y + 0.18 - HIP + 0.1;
    me().x = boat.position.x + fx * 0.55; me().z = boat.position.z + fz * 0.55; me().y = y; me().ry = ry + Math.PI;
    you().x = boat.position.x - fx * 0.55; you().z = boat.position.z - fz * 0.55; you().y = y; you().ry = ry;
  };
  fadeDo(() => { [me(), you()].forEach(c => { c.locked = true; c.av.setPose('sit'); c.moving = false; }); me().av.reach(true); place(); }, 250);
  const startP = new THREE.Vector3(Math.cos(a0) * RAD, 0, Math.sin(a0) * RAD);
  beginAct('boat', '🚣 划船', '慢慢划著船，繞小島一圈。', {
    focus: () => boat.position.clone().add(new THREE.Vector3(0, 1, 0)), back: [SPOTS.boat.x, 0.2], bigView: true,
    btns: [{ t: '停下來看海', fn: () => { paused = !paused; msg(paused ? '海面亮晶晶的，好安靜。' : '繼續划～'); me().av.reach(!paused); if (paused) { you().av.emote('shy', 1.4); burst('heart', midPos(1.1), 4); addLove(2, null, 'boatstop'); } } }, { t: '划回碼頭', main: true, fn: () => { phase = 'home'; paused = false; msg('往碼頭划回去～'); } }],
    update(dt) {
      const t = performance.now() / 1000; boat.position.y = 0.05 + Math.sin(t * 1.6) * 0.05; boat.rotation.z = Math.sin(t * 1.2) * 0.04;
      if (!paused) {
        const sp = 3.4 * dt;
        if (phase === 'out') { const d = startP.clone().sub(boat.position).setY(0); if (d.length() < 0.5) { phase = 'lap'; lapA = 0; } else { d.normalize(); boat.position.addScaledVector(d, sp); turnTo(boat, Math.atan2(d.x, d.z), dt); } }
        else if (phase === 'lap') { lapA += sp / RAD; const a = a0 + lapA; boat.position.x = Math.cos(a) * RAD; boat.position.z = Math.sin(a) * RAD; turnTo(boat, Math.atan2(-Math.sin(a), Math.cos(a)), dt); if (lapA >= Math.PI * 2) { phase = 'home'; st.laps++; addLove(6, '繞小島一圈！'); addMemo('🚣', `一起划船繞了小島一圈（第 ${st.laps} 次）`); } }
        else if (phase === 'home') { const d = home.clone().sub(boat.position).setY(0); if (d.length() < 0.3) { boat.position.x = home.x; boat.position.z = home.z; boat.rotation.y = homeRy; endAct(); return; } d.normalize(); boat.position.addScaledVector(d, sp); turnTo(boat, Math.atan2(d.x, d.z), dt); }
      }
      place(); tk += dt; if (tk > 10) { tk = 0; addLove(1); }
    },
    end() { boat.position.copy(home); boat.rotation.set(0, homeRy, 0); },
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
      if (warp) { st.tod += dt * 1.6; if (st.tod >= warp) { warp = 0; msg('夕陽好美。' + (Math.random() < 0.5 ? `${nameOf(you().i)} 偷偷看了你一眼。` : '天空變成粉紅色了。')); addLove(4, '一起看夕陽'); addMemo('🌅', '在燈塔旁一起看夕陽'); btns(); } }
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
    else { const m = await load(kind); if (m) spots.forEach(([x, z], k) => { const o = m.scene.clone(true); o.position.set(x, 0, z); o.rotation.y = k * 1.7; o.scale.setScalar(kind === 'sunflower' ? 0.55 : 1.5); g.add(o); }); }
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
  const choose = i => {
    openDlg('🌱 要種什麼？', `<div class="opts">${FLOWERS.map((f, t) => `<button type="button" data-t="${t}">${f[1]} ${f[0]}</button>`).join('')}</div>`);
    $('#dlg-body').querySelectorAll('[data-t]').forEach(b => b.onclick = () => { st.garden[i] = { t: +b.dataset.t, w: [] }; save(); drawPlant(i); me().av.emote('plant', 2.2); sfx('sand'); toast(`種下了${FLOWERS[+b.dataset.t][0]}的種子`); render(); });
  };
  const water = i => { const s = st.garden[i]; if (s.w.includes(st.day)) return; s.w.push(st.day); me().av.emote('water', 2.4); save(); drawPlant(i); const p = SPOTS.garden.plots[i]; burst('drop', new THREE.Vector3(p[0], LAND_Y + 1, p[1]), 5, 0.4); sfx('water'); addLove(1, null, 'water'); if (s.w.length >= 3) { toast(`${FLOWERS[s.t][1]} 開花了！`); addMemo(FLOWERS[s.t][1], `菜園的${FLOWERS[s.t][0]}開花了`); } render(); };
  const pickF = i => {
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
  $('#dog-pet').onclick = () => { $('#dlg').close(); me().av.emote('pat', 1.4); burst('heart', d.o.position.clone().add(new THREE.Vector3(0, 0.9, 0)), 4, 0.3); addLove(1, '狗狗搖尾巴', 'dog'); sfx('pop'); };
  $('#dog-ball').onclick = () => {
    $('#dlg').close(); const p = me();
    if (!ballM) { ballM = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), toon('#d8f04a')); }
    OUT.add(ballM); ballM.visible = true;
    // 往前丟 8 公尺，找得到能走的地方
    let tx = p.x + Math.sin(p.ry) * 8, tz = p.z + Math.cos(p.ry) * 8; for (let k = 8; k > 2 && !walkable(tx, tz); k--) { tx = p.x + Math.sin(p.ry) * k; tz = p.z + Math.cos(p.ry) * k; }
    const from = new THREE.Vector3(p.x, standH(p.x, p.z) + 1.4, p.z), to = new THREE.Vector3(tx, standH(tx, tz) + 0.1, tz); let t = 0;
    p.av.emote('wave', 0.6); sfx('whoosh');
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
  fadeDo(() => { [0, 1].forEach(j => { const o = pj(j); if (o !== st.looks[j].outfit) chars[j].av.setLook({ ...st.looks[j], outfit: o }); }); seat(me(), -3.75, y, -1.75, 0, 'lie'); seat(you(), -3.05, y, -1.75, 0, 'lie'); }, 250);
  beginAct('bed', '🛏️ 床', '換上睡衣，軟綿綿的床，可以一起睡到明天早上。', {
    focus: () => new THREE.Vector3(-3.4, 0.8, -2.5), back: [INSPOTS.bed.x, INSPOTS.bed.z + 0.6],
    btns: [{ t: '晚安，睡到明天', main: true, fn: sleep }, { t: '枕頭大戰', fn: () => { me().av.emote('cheer', 1); you().av.emote('jump', 1); burst('star', midPos(0.6), 6); addLove(2, '哈哈哈', 'pillow'); } }],
    end() { [0, 1].forEach(j => { st.looks[j].outfit = prev[j]; chars[j].av.setLook(st.looks[j]); }); },
  });
  function sleep() {
    msg('晚安 ♥'); setBtns([]); let n = 0; const zz = setInterval(() => { burst('z', midPos(0.6), 1, 0.2); if (++n > 4) clearInterval(zz); }, 350);
    setTimeout(() => fadeDo(() => { st.tod = 7.2; newDay(); endAct(); toast(`早安！第 ${st.day} 天 ☀️`); addLove(3); addMemo('🛏️', '一起睡到自然醒'); }, 1100), 1500);
  }
}
function actSofa() {
  const y = 0.45 - HIP + 0.02;
  fadeDo(() => { seat(me(), 1.25, y, 0.85, Math.PI, 'recline'); seat(you(), 1.95, y, 0.85, Math.PI, 'recline'); }, 250);
  let movie = false, t = 0;
  beginAct('sofa', '🛋️ 沙發', '窩在沙發上。', {
    focus: () => new THREE.Vector3(1.6, 1, -1), back: [INSPOTS.sofa.x, INSPOTS.sofa.z + 0.8],
    btns: [{ t: '看電影', main: true, fn: () => { movie = !movie; msg(movie ? pick(['看了一部愛情片，兩個人都哭了', '看恐怖片，一直抓著對方的手', '看動畫，笑到肚子痛']) : '電視關掉了。'); if (movie) { you().av.lean(1); addLove(3, '電影之夜', 'movie'); addMemo('🎬', '窩在沙發上一起看電影'); } else you().av.lean(0); } }, { t: '靠過去', fn: () => { you().av.lean(1); me().av.lean(-1); burst('heart', midPos(1.1), 4); addLove(2, null, 'sofalean'); } }],
    update(dt) { t += dt; if (movie) IN.screen.material.color.setHSL((t * 0.07) % 1, 0.5, 0.45 + Math.sin(t * 3) * 0.1); else IN.screen.material.color.set('#111'); },
    end() { IN.screen.material.color.set('#111'); },
  });
}
function actCook() {
  const p = me(), q = you(); seat(p, 3.6, 0, -0.45, Math.PI, 'stand'); p.y = null; seat(q, 4.4, 0, -0.45, Math.PI, 'stand'); q.y = null;
  let dish = null, prog = 0, cooking = false;
  beginAct('cook', '🍳 一起做飯', '想吃什麼？', {
    focus: () => new THREE.Vector3(3.9, 1, -1.2), back: [INSPOTS.kitchen.x, INSPOTS.kitchen.z + 1],
    btns: DISHES.map((d, i) => ({ t: `${d[1]} ${d[0]}`, fn: () => start(i) })),
    update(dt) {
      if (!cooking) return; prog += dt / 4; meter(true, Math.min(1, prog) * 0.6); p.av.reach(Math.sin(prog * 30) > 0); q.av.reach(true);
      if (Math.random() < dt * 3) burst('star', new THREE.Vector3(3.9, 1.2, -1.2), 1, 0.3);
      if (prog >= 1) { cooking = false; meter(false); p.av.reach(false); q.av.reach(false); serve(); }
    },
  });
  function start(i) { dish = DISHES[i]; cooking = true; prog = 0; msg(`${nameOf(me().i)} 切菜、${nameOf(you().i)} 掌廚，做${dish[0]}中…`); setBtns([]); sfx('sizzle'); }
  function serve() {
    IN.dish.clear(); [-0.35, 0.35].forEach(dx => { const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.03, 16), toon('#ffffff')); pl.position.set(0, 0, dx); IN.dish.add(pl); const f = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), toon(dish[2])); f.scale.y = 0.45; f.position.set(0, 0.05, dx); IN.dish.add(f); });
    IN.dish.visible = true; st.dishes++; addLove(3, `${dish[1]} ${dish[0]}完成`); addMemo(dish[1], `一起做了${dish[0]}`);
    msg(`${dish[0]}做好了，放在餐桌上！到餐桌一起吃吧。`); setBtns([{ t: '去餐桌吃飯', main: true, fn: () => { endAct(); actEat(); } }]);
  }
}
function actEat() {
  if (!IN.dish.visible) return toast('先去廚房做飯吧');
  const y = 0.47 - HIP;
  fadeDo(() => { seat(me(), -3.4, y, 1.75, 0); seat(you(), -2.2, y, 3.05, Math.PI); }, 250);
  beginAct('eat', '🍽️ 吃飯', '開動了！', {
    focus: () => new THREE.Vector3(-2.8, 1, 2.4), back: [INSPOTS.dining.x + 1.4, INSPOTS.dining.z - 1],
    btns: [{ t: '好好吃！', main: true, fn: () => { me().av.reach(true); setTimeout(() => me().av.reach(false), 400); burst('heart', headPos(me(), 1.3), 2); addLove(1, null, 'eat'); } }, { t: '餵對方一口', fn: () => { me().av.reach(true); setTimeout(() => { me().av.reach(false); you().av.emote('shy', 1.4); burst('heart', headPos(you(), 1.3), 5); }, 500); addLove(3, '啊～', 'feed2'); } }, { t: '吃飽了', fn: () => { IN.dish.visible = false; addMemo('🍽️', '一起吃了一頓飯'); endAct(); } }],
  });
}

// ---------- 對話框：地圖、回憶本、造型 ----------
function openDlg(title, html) { $('#dlg-title').textContent = title; $('#dlg-body').innerHTML = html; const d = $('#dlg'); if (!d.open) d.showModal(); }
$('#btn-map').onclick = () => {
  sfx('click');
  const list = SP.filter(s => s.sc === scene && !s.hide?.() && s.id !== 'dog');
  openDlg(scene === 'in' ? '🏠 小木屋裡' : '🗺️ 小島地圖', `<p class="muted">點一下，${esc(nameOf(me().i))} 會走過去。</p><div class="grid3">${list.map(s => `<button type="button" class="cell" data-s="${s.id}" style="border:0"><span class="e">${s.icon}</span>${esc(s.name)}</button>`).join('')}</div>`);
  $('#dlg-body').querySelectorAll('[data-s]').forEach(b => b.onclick = () => { const s = SP.find(x => x.id === b.dataset.s); $('#dlg').close(); if (act) endAct(); me().path = { x: s.x, z: s.z, then: s }; });
};
$('#couple-card').onclick = () => openBook('us');
$('#btn-book').onclick = () => openBook('memo');
function openBook(tab = 'memo') {
  sfx('click');
  const tabs = [['memo', '回憶'], ['col', '收藏'], ['us', '我們'], ['about', '關於']];
  const L = levelOf(st.love), d = daysTogether();
  const body = {
    memo: () => st.diary.length ? st.diary.slice(0, 120).map(m => `<div class="memo"><span class="ic">${m.icon}</span><b>${esc(m.text)}</b><small>${esc(m.d)} · 小島第 ${m.day} 天</small></div>`).join('') : '<p class="muted">還沒有回憶，去小島上走走吧。</p>',
    col: () => `<b>🎣 釣到的東西</b><div class="grid3">${FISH.map(f => `<div class="cell ${st.fish[f[0]] ? '' : 'no'}"><span class="e">${f[1]}</span>${st.fish[f[0]] ? esc(f[0]) : '？？？'}<small>${st.fish[f[0]] ? '×' + st.fish[f[0]] : '還沒釣到'}</small></div>`).join('')}</div>
      <b>🐚 海邊撿到的</b><div class="grid3">${SHELLS.map(s => `<div class="cell ${st.shells[s[0]] ? '' : 'no'}"><span class="e">${s[1]}</span>${esc(s[0])}<small>×${st.shells[s[0]] || 0}</small></div>`).join('')}</div>
      <p class="muted">沙堡 ${st.castles} 座 · 送花 ${st.flowersGiven} 次 · 做飯 ${st.dishes} 次 · 煙火 ${st.fireworks} 發 · 繞島 ${st.laps} 圈 · 許願 ${st.wishes} 次</p>`,
    us: () => `<div class="memo"><span class="ic">💗</span><b>${esc(nameOf(0))} ♥ ${esc(nameOf(1))}</b><small>${d ? `在一起第 ${d} 天 · ` : ''}甜蜜值 ${st.love} · Lv${L.lv} ${L.title}${L.next ? `（再 ${L.next - st.love} 升級）` : ''}</small></div>
      <label class="anniv"><span>我的名字</span><input id="ed-n0" maxlength="8" value="${esc(st.names[0])}"></label>
      <label class="anniv"><span>另一半的名字</span><input id="ed-n1" maxlength="8" value="${esc(st.names[1])}"></label>
      <label class="anniv"><span>在一起的日子</span><input id="ed-an" type="date" value="${esc(st.anniv)}"></label>
      <div class="row"><button type="button" class="ghost" id="ed-look0">👗 ${esc(nameOf(0))} 的造型</button><button type="button" class="ghost" id="ed-look1">👔 ${esc(nameOf(1))} 的造型</button></div>
      <button type="button" class="primary" id="ed-save">儲存</button>`,
    about: () => `<p>兩個人的 3D 小島。小木屋、沙灘、碼頭、燈塔，一起盪鞦韆、釣魚、烤棉花糖、看夕陽、划船、放煙火。</p>
      <p class="muted">資料只存在這支手機（瀏覽器）裡。版本 ${esc(APP_VER)}</p>
      <details><summary>3D 模型出處（Polyfork，CC BY 4.0）</summary><div id="credits" class="muted" style="font-size:12px;line-height:1.5">載入中…</div></details>
      <button type="button" class="ghost" id="reset-all" style="margin-top:8px">清除所有資料、重新開始</button>`,
  };
  openDlg('📔 我們的回憶本', `<div class="tabs" role="tablist">${tabs.map(([k, n]) => `<button type="button" role="tab" data-t="${k}" aria-selected="${k === tab}">${n}</button>`).join('')}</div><div id="book-body" style="display:grid;gap:8px">${body[tab]()}</div>`);
  $('#dlg-body').querySelectorAll('[data-t]').forEach(b => b.onclick = () => openBook(b.dataset.t));
  if (tab === 'us') {
    $('#ed-save').onclick = () => { st.names = [$('#ed-n0').value.trim().slice(0, 8), $('#ed-n1').value.trim().slice(0, 8)]; st.anniv = $('#ed-an').value; save(); updateHud(); $('#dlg').close(); toast('已儲存'); };
    $('#ed-look0').onclick = () => openLooks(0); $('#ed-look1').onclick = () => openLooks(1);
  }
  if (tab === 'about') {
    fetch('models/credits.json').then(r => r.json()).then(c => { $('#credits').innerHTML = Object.values(c).filter(Boolean).map(esc).join('<br>'); }).catch(() => {});
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
      toast(`撿到 ${e} ${n}（共 ${st.shells[n]} 個）`); sfx('chime'); burst('star', s.o.position.clone().add(new THREE.Vector3(0, 0.5, 0)), 3, 0.2);
      if (st.shells[n] === 1) addMemo(e, `在海邊撿到第一個${n}`);
      if (s.t === 5) { addLove(3, `把心形石頭送給 ${nameOf(you().i)}`); you().av.emote('shy', 1.4); }
    }
  }
}

// ---------- 新的一天 ----------
function newDay() {
  st.day++; spawnShells(); save(); updateHud();
}

// ---------- 拍照 ----------
const photo = { on: false };
$('#btn-photo').onclick = () => { if (act && act.id !== 'boat') {} photo.on = true; $('#hud').hidden = true; $('#act-panel').style.display = 'none'; $('#photo-ui').hidden = false; sfx('click'); };
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
  addMemo('📷', '拍了一張合照');
};
$('#btn-music').onclick = () => { st.music = !st.music; save(); Music.init(); st.music ? Music.play() : Music.stop(); updateHud(); };

// ---------- 鏡頭 ----------
const camT = new THREE.Vector3(), camP = new THREE.Vector3(), tmpT = new THREE.Vector3();
function camBlocked(x, y, z) {
  for (const [x0, z0, x1, z1] of BOXES) if (y < 6.5 && x > x0 - 0.4 && x < x1 + 0.4 && z > z0 - 0.4 && z < z1 + 0.4) return true;
  return false;
}
function updateCam(dt, snap) {
  const p = me();
  if (scene === 'in') {
    tmpT.set(clamp(p.x, -3.5, 3.5) * 0.6, 0.9, clamp(p.z, -2.5, 2.5) * 0.4);
    if (act?.focus) tmpT.lerp(act.focus(), 0.7);
    const d = view.inDist, yaw = view.inYaw;
    camP.set(tmpT.x + Math.sin(yaw) * d * 0.8, tmpT.y + d * 0.62, tmpT.z + Math.cos(yaw) * d * 0.8);
  } else {
    if (act?.focus) tmpT.copy(act.focus()); else tmpT.set(p.av.root.position.x, p.av.root.position.y + 1.2, p.av.root.position.z);
    let d = view.dist * (act?.bigView ? 1.6 : act ? 1.1 : 1);
    const yaw = view.yaw, pit = view.pitch;
    for (let k = 0; k < 12; k++) { camP.set(tmpT.x + Math.sin(yaw) * Math.cos(pit) * d, tmpT.y + Math.sin(pit) * d, tmpT.z + Math.cos(yaw) * Math.cos(pit) * d); if (!camBlocked(camP.x, camP.y, camP.z) || d < 2.5) break; d *= 0.8; }
    camP.y = Math.max(camP.y, standH(camP.x, camP.z) + 0.6);
  }
  const k = snap ? 1 : 1 - Math.exp(-dt * 6);
  camT.lerp(tmpT, k); cam.position.lerp(camP, k); cam.lookAt(camT);
}

// ---------- 主迴圈 ----------
const clock = new THREE.Clock(); let T = 0, saveT = 0;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta()); T += dt;
  if (!W) return;
  // 時間：一小時 = 36 秒
  if (started() && !document.hidden) { st.tod += dt / 36; if (st.tod >= 24) { st.tod -= 24; newDay(); toast(`第 ${st.day} 天了`); } }
  const k = setTimeOfDay(W, OUT, preview.on ? 17.6 : st.tod, cam.position);
  W.water.material.uniforms.uTime.value = T;
  if (IN) { IN.winMat.color.copy(k.hor); }
  W.sky.clouds.rotation.y += dt * 0.004;
  W.fireL.intensity = (6 + Math.sin(T * 13) * 1.2 + Math.sin(T * 7.3) * 1.0) * (0.5 + k.night * 0.8);

  if (preview.on) { // 開場：繞著小屋慢慢轉
    preview.t += dt * 0.08; const a = preview.t + 0.3;
    cam.position.set(Math.sin(a) * 52, 26, Math.cos(a) * 52); cam.lookAt(0, -6, 0);
    chars.forEach((c, i) => { c.x = i ? 0.7 : -0.7; c.z = -1.4; c.ry = 0; c.y = null; syncAv(c, dt); });
    chars[0].av.holdHand(1); chars[1].av.holdHand(-1);
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
    if (mag > 0.12) {
      p.path = null; lovePending = null;
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = -fz, rz = fx;
      const dx = fx * -iy + rx * ix, dz = fz * -iy + rz * ix;
      stepChar(p, dx, dz, dt, (st.hand ? 3.4 : 4.2) * mag);
    } else if (p.path) {
      const dx = p.path.x - p.x, dz = p.path.z - p.z, d = Math.hypot(dx, dz), arrive = p.path.then ? Math.min(1.4, p.path.then.r * 0.6) : 0.15;
      if (d < arrive) { const then = p.path.then; p.path = null; p.moving = false; if (then && !act) then.run(); }
      else if (!stepChar(p, dx, dz, dt, st.hand ? 3.4 : 4.2)) { p.stuck += dt; if (p.stuck > 0.8) { p.path = null; p.stuck = 0; } } else p.stuck = 0;
    } else p.moving = false;
  }
  if (!act || !you().locked) partnerAI(dt);
  if (act) { act.t += dt; act.update?.(dt); }
  chars.forEach(c => syncAv(c, dt));
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
  spawnShells(); showCastles(); st.garden.forEach((_, i) => drawPlant(i));
  updateCam(0, true);
  buildInterior().then(I => { IN = I; });
  window.__nest = { st, chars, W: () => W, act: () => act, SP, me, you, scene: () => scene, setTod: t => { st.tod = t; } };
})();

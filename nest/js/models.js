// Polyfork 的低多邊形 3D 模型（CC BY 4.0，出處見 models/credits.json 與「關於」）
// 材質統一換成卡通明暗；同一種模型放很多個用 InstancedMesh；動物用 SkeletonUtils 複製＋AnimationMixer
import * as THREE from '../vendor/three.module.min.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import * as SkeletonUtils from '../vendor/SkeletonUtils.js';
import { standH } from './terrain.js';

export const M = {
  cabin: 'porch-log-cabin-d2f3ef', palm: 'palm-tree-a307da', sapling: 'palm-sapling-ef7ae4', hammock: 'hammock-on-posts-7d5c47',
  rowboat: 'rowboat-c42d85', campfire: 'stone-ring-campfire-8a0c6f', logBench: 'split-log-bench-289780', picnicTable: 'campsite-picnic-table-361d51',
  parasol: 'beach-parasol-fd4530', deckChair: 'striped-deck-chair-70b506', ball: 'beach-ball-4b2a9b', bucket: 'beach-bucket-dc52dd', sandcastle: 'sandcastle-ddc562',
  tent: 'dome-tent-9ee59d', rod: 'propped-fishing-rod-072978', flowerBed: 'flower-bed-708e73', sunflower: 'sunflower-80ce15', wildflower: 'wildflower-68d3a1',
  mailbox: 'curbside-mailbox-0e0736', dockLamp: 'dock-lantern-post-5e58a4', rocker: 'porch-rocking-chair-89b2d7', lighthouse: 'old-lighthouse-48ca6c',
  shells: 'shell-scatter-6d36b7', starfish: 'starfish-772749', rock: 'medium-rock-e08405', pebble: 'small-rock-db33a7', gardenRock: 'garden-rock-7f5d60',
  bush: 'round-bush-cd2ac0', cherry: 'cherry-blossom-tree-3f7ab7', guitar: 'guitar-b013ee', kiteSpool: 'kite-spool-with-hilo-fe7e05', bike: 'city-bicycle-5b67d1',
  swingTree: 'lakeside-swing-tree-02c084', dockRun: 'lake-dock-run-f5380e',
  bed: 'bed-6e10e8', sofa: 'sofa-9c0e7e', coffeeTable: 'coffee-table-acc698', rug: 'wool-rug-ab2bd1', tableLamp: 'table-lamp-e25998', floorLamp: 'arc-floor-lamp-fa0b5f',
  bedside: 'bedside-table-740c6b', tv: 'flat-screen-television-97b1f3', media: 'low-media-unit-645e61', diningTable: 'dining-table-7af83a', diningChair: 'dining-chair-530532',
  island: 'kitchen-island-47f4c8', fridge: 'fridge-freezer-fb9b5a', hob: 'hob-01fe88', worktop: 'worktop-run-643552', plant: 'floor-houseplant-8fad17', bookcase: 'alcove-bookcase-83894d',
  art: 'framed-wall-art-d2c8a2', cushion: 'cushion-121479', blanket: 'throw-blanket-f1ab26', wardrobe: 'wardrobe-f3b2f2', curtain: 'curtain-panel-ee2ed9', pendant: 'ceiling-pendant-d21307',
  dog: 'dog-base', cat: 'cat-base', crab: 'hermit-crab-base', gull: 'herring-gull-base', rabbit: 'rabbit-base', fish: 'reef-fish-base', duck: 'duck-base',
};

let _grad;
export function toonGrad() { if (_grad) return _grad; _grad = new THREE.DataTexture(new Uint8Array([120, 195, 255]), 3, 1, THREE.RedFormat); _grad.minFilter = _grad.magFilter = THREE.NearestFilter; _grad.needsUpdate = true; return _grad; }
export const toon = (c, extra = {}) => new THREE.MeshToonMaterial({ color: c, gradientMap: toonGrad(), ...extra });
function toonify(root) {
  const conv = m => new THREE.MeshToonMaterial({ color: m.color, map: m.map || null, gradientMap: toonGrad(), vertexColors: !!m.vertexColors, transparent: !!m.transparent, opacity: m.opacity ?? 1, alphaTest: m.alphaTest || 0, side: m.side,
    emissive: m.emissive || new THREE.Color(0), emissiveMap: m.emissiveMap || null, emissiveIntensity: m.emissiveIntensity ?? 1 });
  root.traverse(o => { if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material); });
}
const loader = new GLTFLoader(), cache = new Map();
let pending = 0, done = 0; export const progress = { get pending() { return pending; }, get done() { return done; } };
// 複製模型：有骨架（會動）的模型要連骨架一起複製，不然會畫在原點（陽傘的布曾經跑到地圖中間）
export function cloneModel(g) { let skinned = false; g.scene.traverse(o => { if (o.isSkinnedMesh) skinned = true; }); return skinned ? SkeletonUtils.clone(g.scene) : g.scene.clone(true); }
export function load(key) {
  const id = M[key] || key;
  if (!cache.has(id)) { pending++; cache.set(id, loader.loadAsync(`models/${id}.glb`).then(g => { toonify(g.scene); g.scene.updateMatrixWorld(true); done++; return g; }).catch(e => { done++; console.warn('模型載入失敗', id, e); return null; })); }
  return cache.get(id);
}

// 碰撞：圓形 [x, z, r]、方形 [x0, z0, x1, z1]
export const CIRCLES = [], BOXES = [];

// 單一個模型；y 不給就站在地面上
export async function one(parent, key, x, z, ry = 0, s = 1, { col = 0, y = null, box = null } = {}) {
  const g = await load(key); if (!g) return null;
  const o = cloneModel(g); o.position.set(x, y ?? standH(x, z), z); o.rotation.y = ry; o.scale.setScalar(s); parent.add(o);
  if (g.animations?.length) { const mixer = new THREE.AnimationMixer(o); g.animations.forEach(c => mixer.clipAction(c).play()); mixers.push(mixer); }
  if (col) CIRCLES.push([x, z, col * s]);
  if (box) BOXES.push(box);
  return o;
}
// 同一種模型放很多個：每個子網格一個 InstancedMesh；list：[[x, z, 轉向, 大小]]
export async function scatter(parent, key, list, { col = 0, y = null } = {}) {
  const g = await load(key); if (!g || !list.length) return null;
  const group = new THREE.Group(), Mx = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  g.scene.traverse(o => {
    if (!o.isMesh) return;
    const im = new THREE.InstancedMesh(o.geometry, o.material, list.length);
    list.forEach(([x, z, ry = 0, s = 1], i) => { q.setFromAxisAngle(up, ry); Mx.compose(new THREE.Vector3(x, y ?? standH(x, z), z), q, new THREE.Vector3(s, s, s)); im.setMatrixAt(i, Mx.clone().multiply(o.matrixWorld)); });
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); group.add(im);
  });
  parent.add(group);
  if (col) list.forEach(([x, z, , s = 1]) => CIRCLES.push([x, z, col * s]));
  return group;
}

// 會動的模型（營火、陽傘、吊床的 tick 動畫）
export const mixers = [];

// ---------- 動物 ----------
export const animals = [];
export async function animal(parent, key, x, z, { s = 1, roam = 4, speed = 0.6, walk = 'Walk', idle = 'Idle', run = 'Run', idleOnly = false, y = null, swim = false } = {}) {
  const g = await load(key); if (!g) return null;
  const o = SkeletonUtils.clone(g.scene); o.position.set(x, y ?? standH(x, z), z); o.scale.setScalar(s); o.rotation.y = Math.random() * 6.28; parent.add(o);
  const mixer = new THREE.AnimationMixer(o), acts = {};
  g.animations.forEach(c => { acts[c.name] = mixer.clipAction(c); });
  const a = { key, o, mixer, acts, home: { x, z }, tx: x, tz: z, t: Math.random() * 4, roam, speed, idleOnly, walk, idle, run, cur: null, y, swim, follow: null };
  playA(a, swim ? 'Swim' : idle); mixer.update(Math.random() * 2); animals.push(a); return a;
}
export function playA(a, n) { if (a.cur === n || !a.acts[n]) return; const nx = a.acts[n]; nx.reset().fadeIn(0.25).play(); if (a.cur && a.acts[a.cur]) a.acts[a.cur].fadeOut(0.25); a.cur = n; }
// 被嚇到：跑過去會逃開，慢慢走近只會讓開一點點；海鷗被衝過去會飛走
const FLEE = { 'chicken-base': [2.8, 3.2, 3.6], rabbit: [3.4, 4.5, 3.4], duck: [2.6, 3.2, 3], crab: [1.8, 2.2, 3], cat: [2.2, 3, 3.2], gull: [3.2, 3, 2.4] }; // [跑步時多近會逃, 逃多遠, 逃的速度倍數]
const _pv = { x: 0, z: 0, ok: false, sp: 0, vx: 0, vz: 0 };
function startFlee(a, P, d, run, walkOK) {
  const f = FLEE[a.key]; if (!f) return;
  const p = a.o.position, ax = (p.x - P.x) / (d || 1), az = (p.z - P.z) / (d || 1);
  if (a.key === 'gull' && run && !a.swim) { // 飛走：往遠離人的方向飛一段，找一塊陸地降落
    for (let k = 0; k < 8; k++) { const ang = Math.atan2(az, ax) + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.5, r = 9 + Math.random() * 5, tx = p.x + Math.cos(ang) * r, tz = p.z + Math.sin(ang) * r;
      if (!walkOK || walkOK(tx, tz)) { a.fly = { t: 0, dur: 3.2, fx: p.x, fz: p.z, fy: p.y, tx, tz }; a.home = { x: tx, z: tz }; return; } }
  }
  const dist = run ? f[1] : 1.4;
  for (let k = 0; k < 6; k++) { const ang = Math.atan2(az, ax) + (Math.random() - 0.5) * 0.8 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.6, tx = p.x + Math.cos(ang) * dist, tz = p.z + Math.sin(ang) * dist;
    if (!walkOK || walkOK(tx, tz)) { a.tx = tx; a.tz = tz; a.flee = run ? f[2] : 1.6; a.t = 2.5 + Math.random() * 2; if (a.idleOnly) { a.wasIdle = true; a.idleOnly = false; } return; } }
}
export function tickAnimals(dt, P, walkOK) {
  // 人的速度與方向（用位置變化算）
  if (P) { if (_pv.ok && dt > 0) { const vx = (P.x - _pv.x) / dt, vz = (P.z - _pv.z) / dt; _pv.vx += (vx - _pv.vx) * Math.min(1, dt * 6); _pv.vz += (vz - _pv.vz) * Math.min(1, dt * 6); _pv.sp = Math.hypot(_pv.vx, _pv.vz); } _pv.x = P.x; _pv.z = P.z; _pv.ok = true; }
  for (const a of animals) {
    const p = a.o.position, far = P && Math.hypot(p.x - P.x, p.z - P.z) > 60;
    if (far) continue;
    a.mixer.update(dt);
    // 飛走中：先往上飛、再滑翔降落
    if (a.fly) { const F = a.fly; F.t += dt; const k = Math.min(1, F.t / F.dur), gy = standH(F.tx, F.tz);
      p.x = F.fx + (F.tx - F.fx) * k; p.z = F.fz + (F.tz - F.fz) * k; p.y = F.fy + (gy - F.fy) * k + Math.sin(k * Math.PI) * 3.2;
      const want = Math.atan2(F.tx - F.fx, F.tz - F.fz); a.o.rotation.y += Math.atan2(Math.sin(want - a.o.rotation.y), Math.cos(want - a.o.rotation.y)) * Math.min(1, dt * 6);
      playA(a, a.acts.Fly ? 'Fly' : a.walk); if (k >= 1) { a.fly = null; a.tx = p.x; a.tz = p.z; a.t = 3; p.y = gy; } continue; }
    // 人靠近：跑過去會逃開；走過來只有太近才讓一下（被摸的時候、狗、在水裡的不會）
    if (P && FLEE[a.key] && !a.hold && !a.follow && !a.swim && !(a.flee > 0)) {
      const d = Math.hypot(p.x - P.x, p.z - P.z), toward = (_pv.vx * (p.x - P.x) + _pv.vz * (p.z - P.z)) / (d || 1), run = _pv.sp > 3.2 && toward > 1.5;
      if ((run && d < FLEE[a.key][0]) || (_pv.sp > 0.5 && toward > 0.3 && d < (a.key === 'gull' ? 1.6 : 1.0))) startFlee(a, P, d, run, walkOK);
    }
    if (a.idleOnly) continue;
    if (a.hold > 0) { a.hold -= dt; playA(a, a.idle); continue; } // 被摸的時候乖乖站好
    a.t -= dt;
    // 跟著主人（狗）：保持 2 公尺左右
    if (a.follow && !a.fetch) {
      const f = a.follow(); if (f) { const d = Math.hypot(f.x - p.x, f.z - p.z); if (d > 3.2) { a.tx = f.x + (p.x - f.x) / d * 2; a.tz = f.z + (p.z - f.z) / d * 2; a.t = 1; } }
    }
    const dx = a.tx - p.x, dz = a.tz - p.z, d = Math.hypot(dx, dz);
    if (d > 0.1) {
      const sp = a.flee > 0 ? a.speed * a.flee : a.fetch || d > 5 ? a.speed * 2.6 : a.speed, st = Math.min(d, dt * sp);
      const nx = p.x + dx / d * st, nz = p.z + dz / d * st;
      if (a.swim || !walkOK || walkOK(nx, nz)) { p.x = nx; p.z = nz; } else { a.tx = p.x; a.tz = p.z; }
      if (!a.swim && a.y == null) p.y = standH(p.x, p.z);
      const want = Math.atan2(dx, dz); let df = want - a.o.rotation.y; df = Math.atan2(Math.sin(df), Math.cos(df)); a.o.rotation.y += df * Math.min(1, dt * 6);
      playA(a, a.swim ? 'Swim' : sp > a.speed * 1.5 ? (a.acts[a.run] ? a.run : a.walk) : a.walk);
    } else {
      if (a.flee > 0) { a.flee = 0; if (a.wasIdle) { a.backT = 5; } } // 逃完了；原本坐著的（貓）過一下再走回去
      if (a.backT > 0 && (a.backT -= dt) <= 0) { a.tx = a.home.x; a.tz = a.home.z; a.t = 99; }
      if (a.wasIdle && a.backT <= 0 && Math.hypot(p.x - a.home.x, p.z - a.home.z) < 0.15) { a.idleOnly = true; a.wasIdle = false; }
      if (a.fetchDone) { a.fetchDone(); a.fetchDone = null; }
      playA(a, a.swim ? 'Swim' : a.idle);
      if (a.t <= 0 && !a.follow) { a.t = 2 + Math.random() * 5; const ang = Math.random() * 6.28, r = Math.random() * a.roam; a.tx = a.home.x + Math.cos(ang) * r; a.tz = a.home.z + Math.sin(ang) * r; }
    }
  }
}

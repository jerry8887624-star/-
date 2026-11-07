// 0.29：Polyfork 的低多邊形 3D 模型（CC BY 4.0，出處見 models/credits.json 與「關於」頁）
// 依區域延遲載入：走近那一區才下載；靜態擺設用 InstancedMesh（同一種模型只要幾次繪製），動物有動作與簡單的走動
import * as THREE from '../vendor/three.module.min.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import * as SkeletonUtils from '../vendor/SkeletonUtils.js';
import { CIRCLES } from './scene.js';
import { ZONES, TEAS, SHOP, BOSS_HOME, CAM_POSTS } from './zones.js';

const ID = {
  lion: 'guardian-lion-statue-5bde18', bell: 'temple-bell-tower-745387', drum: 'war-drum-on-stand-cbb91a',
  ginkgo: 'ginkgo-tree-baa895', cherry: 'cherry-blossom-tree-3f7ab7', maple: 'japanese-maple-d2fb29', bush: 'round-bush-cd2ac0', azalea: 'azalea-bush-7bb14d',
  flowers: 'flower-bed-708e73', well: 'stone-well-b2dfcd', stall: 'market-stall-94937d',
  bamboo: 'bamboo-stalk-e4d362', archBridge: 'arched-foot-bridge-0da34f', pine: 'sculpted-pine-e45d4f', stump: 'moss-covered-stump-7253ab', fernRock: 'fern-covered-boulder-2e0375', lotus: 'lotus-flower-cluster-bc129a', scrolls: 'scroll-rack-f465dd',
  boulders: 'boulder-field-cluster-08e364', sandstone: 'sandstone-outcrop-75800b', basalt: 'basalt-column-outcrop-f1339d', ledge: 'cliff-perch-ledge-afb065', dwarfPine: 'dwarf-pine-mat-faee77', larch: 'windblown-larch-abb99c', amber: 'crystal-cluster-78f2d7',
  scorched: 'scorched-tree-e927a3', deadTree: 'dead-tree-6795fa', deadOak: 'twisted-dead-oak-49457b', volRocks: 'volcanic-boulder-cluster-7e29ea', scoria: 'red-scoria-rock-35bb9c', obsidian: 'obsidian-fang-rock-67e326', campfire: 'stone-ring-campfire-8a0c6f', torch: 'reed-fire-torch-f7453e',
  pagoda: 'tiered-pagoda-f4ade0', purple: 'crystal-cluster-624138', crystalCol: 'lair-crystal-column-877d1a', rune: 'glowing-rune-stone-5a5558', column: 'broken-stone-column-c91287', stair: 'terrace-stone-stair-494ef8', rowan: 'bare-mountain-rowan-10e72e',
  deer: 'forest-deer-fe648d', crow: 'crow-base', chicken: 'village-chicken-9ba715', duck: 'duck-base', cat: 'cat-base', koi: 'koi-base', pigeon: 'pigeon-base',
};

let _grad;
function toonGrad() { if (_grad) return _grad; _grad = new THREE.DataTexture(new Uint8Array([120, 195, 255]), 3, 1, THREE.RedFormat); _grad.minFilter = _grad.magFilter = THREE.NearestFilter; _grad.needsUpdate = true; return _grad; }
// 換成跟廟裡一樣的卡通明暗（保留顏色、貼圖、發光）
function toonify(root) {
  const conv = m => new THREE.MeshToonMaterial({ color: m.color, map: m.map || null, gradientMap: toonGrad(), vertexColors: !!m.vertexColors, transparent: !!m.transparent, opacity: m.opacity ?? 1, alphaTest: m.alphaTest || 0, side: m.side,
    emissive: m.emissive || new THREE.Color(0), emissiveMap: m.emissiveMap || null, emissiveIntensity: m.emissiveIntensity ?? 1 });
  root.traverse(o => { if (o.isMesh) { o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material); o.frustumCulled = true; } });
}
const loader = new GLTFLoader(), cache = new Map();
function load(key) {
  if (!cache.has(key)) cache.set(key, loader.loadAsync(`models/${ID[key]}.glb`).then(g => { toonify(g.scene); g.scene.updateMatrixWorld(true); return g; }).catch(e => { console.warn('模型載入失敗', key, e); return null; }));
  return cache.get(key);
}

// 同一種模型放很多個：每個子網格各做一個 InstancedMesh
// list：[[x, z, 轉向, 大小]]；col：碰撞半徑（乘上大小）；cam：高的東西讓鏡頭避開
async function scatter(S, key, list, { col = 0, cam = 0, y = 0 } = {}) {
  const g = await load(key); if (!g || !list.length) return null;
  const group = new THREE.Group(), M = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  g.scene.traverse(o => {
    if (!o.isMesh) return;
    const im = new THREE.InstancedMesh(o.geometry, o.material, list.length);
    list.forEach(([x, z, ry = 0, s = 1], i) => { q.setFromAxisAngle(up, ry); M.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s, s)); im.setMatrixAt(i, M.clone().multiply(o.matrixWorld)); });
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); group.add(im);
  });
  S.add(group);
  list.forEach(([x, z, , s = 1]) => { if (col) CIRCLES.push([x, z, col * s]); if (cam) CAM_POSTS.push([x, z, cam * s]); });
  return group;
}
// 單一個（不需要 instancing 的大型建築）
async function one(S, key, x, z, ry = 0, s = 1, { col = 0, cam = 0, y = 0 } = {}) {
  const g = await load(key); if (!g) return null;
  const o = g.scene.clone(true); o.position.set(x, y, z); o.rotation.y = ry; o.scale.setScalar(s); S.add(o);
  if (col) CIRCLES.push([x, z, col * s]); if (cam) CAM_POSTS.push([x, z, cam * s]);
  return o;
}
function seeded(s) { return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

// ---------- 動物：骨架動畫＋在家附近慢慢走 ----------
const animals = [];
async function animal(S, key, x, z, { s = 1, roam = 4, speed = 0.6, y = 0, idleOnly = false, walk = 'Walk', idle = 'Idle' } = {}) {
  const g = await load(key); if (!g) return null;
  const o = SkeletonUtils.clone(g.scene); o.position.set(x, y, z); o.scale.setScalar(s); o.rotation.y = Math.random() * 6.28; S.add(o);
  const mixer = new THREE.AnimationMixer(o), clip = n => g.animations.find(a => a.name === n);
  const acts = {}; [walk, idle].forEach(n => { const c = clip(n); if (c) acts[n] = mixer.clipAction(c); });
  const a = { o, mixer, acts, home: { x, z }, tx: x, tz: z, t: Math.random() * 4, roam, speed, idleOnly, walk, idle, cur: null, y };
  play(a, idle); mixer.update(Math.random() * 2); animals.push(a); return a;
}
function play(a, n) { if (a.cur === n || !a.acts[n]) return; const nx = a.acts[n]; nx.reset().fadeIn(0.25).play(); if (a.cur && a.acts[a.cur]) a.acts[a.cur].fadeOut(0.25); a.cur = n; }
function tickAnimals(dt, P) {
  for (const a of animals) {
    const p = a.o.position, far = !P || Math.hypot(p.x - P.x, p.z - P.z) > 48;
    a.o.visible = !far; if (far) continue;
    a.mixer.update(dt);
    if (a.idleOnly) continue;
    a.t -= dt;
    const dx = a.tx - p.x, dz = a.tz - p.z, d = Math.hypot(dx, dz);
    if (d > 0.08) { const st = Math.min(d, dt * a.speed); p.x += dx / d * st; p.z += dz / d * st; const want = Math.atan2(dx, dz); let df = want - a.o.rotation.y; df = Math.atan2(Math.sin(df), Math.cos(df)); a.o.rotation.y += df * Math.min(1, dt * 5); play(a, a.walk); }
    else { play(a, a.idle); if (a.t <= 0) { a.t = 2 + Math.random() * 5; const ang = Math.random() * 6.28, r = Math.random() * a.roam; a.tx = a.home.x + Math.cos(ang) * r; a.tz = a.home.z + Math.sin(ang) * r; } }
    // 玩家靠太近：往旁邊閃
    if (P && Math.hypot(p.x - P.x, p.z - P.z) < 1.4 && d < 0.1) { const ang = Math.atan2(p.x - P.x, p.z - P.z); a.tx = p.x + Math.sin(ang) * 2.5; a.tz = p.z + Math.cos(ang) * 2.5; }
  }
}

// ---------- 各區的擺設 ----------
const BUILD = [
  // 0 廟口草原（含廟埕的鴿子）
  async (out, S) => {
    await Promise.all([
      one(S, 'lion', -4.4, 21.9, 0, 1.15, { col: 0.45 }), one(S, 'lion', 4.4, 21.9, 0, 1.15, { col: 0.45 }),
      one(S, 'bell', -7, 29.5, Math.PI / 2, 1, { col: 2.3, cam: 2.4 }), one(S, 'drum', 7, 26, -Math.PI / 2, 1.3, { col: 0.6 }),
      scatter(S, 'ginkgo', [[-36, 38, 0.3, 0.9], [33, 55, 1.2, 0.85]], { col: 0.5, cam: 1.6 }),
      scatter(S, 'cherry', [[-33, 24, 0.5, 1.2], [8.5, 22.6, 2, 1.0], [20, 32.5, 1, 1.2], [-13, 56.2, 0.2, 1.1], [-20, 22.5, 1.4, 1.1]], { col: 0.35, cam: 1.3 }),
      scatter(S, 'maple', [[26, 27.5, 0.6, 1.3], [-38, 52, 2.2, 1.3], [5, 57.4, 1.3, 1.1], [-31, 33, 0.9, 1.2]], { col: 0.35, cam: 1.5 }),
      scatter(S, 'azalea', [[-6.2, 22.4, 0, 1.3], [6.2, 22.4, 1, 1.3], [-3, 34, 0.5, 1], [3, 34, 2, 1], [11, 43, 1, 1.2], [21, 41.5, 2, 1.2]], { col: 0.5 }),
      scatter(S, 'bush', [[-3, 26, 0], [3, 26, 1], [-3, 30, 2], [3, 30, 3], [-3, 41, 1], [3, 41, 0], [17.5, 26.5, 1, 1.2], [10.5, 33, 2, 1.2]], { col: 0.5 }),
      scatter(S, 'flowers', [[11, 27, 0.3, 1.4], [17, 33.2, 1.1, 1.4], [11.3, 47.5, 0, 1.4], [20.7, 47.5, 0.8, 1.4]], { col: 0.6 }),
      one(S, 'well', 5.8, 56.6, 0, 1.2, { col: 0.6 }),
      scatter(S, 'stall', [[13.4, 51.4, -Math.PI / 2, 1.2], [13.4, 55.6, -Math.PI / 2, 1.2]], { col: 1.0 }),
    ]);
    // 動物：鹿在西邊草地、雞在市集、鴨在錦鯉池邊、貓在文具鋪門口、鴿子在廟埕
    await Promise.all([
      animal(S, 'deer', -32, 42, { s: 0.85, roam: 6, speed: 0.7 }), animal(S, 'deer', -30, 48, { s: 0.8, roam: 6, speed: 0.7 }),
      ...[[15.5, 53.4], [16.5, 55.2], [15, 57]].map(([x, z]) => animal(S, 'chicken', x, z, { s: 1.6, roam: 2.5, speed: 0.5, idleOnly: true })),
      ...[[10.8, 44.5], [21.3, 45.6]].map(([x, z]) => animal(S, 'duck', x, z, { s: 1.3, roam: 2, speed: 0.4 })),
      animal(S, 'cat', 6.6, 51.6, { s: 1.6, roam: 1.5, speed: 0.4 }),
      ...[[-2.5, 10], [2.8, 11], [-1.5, 13], [3.2, 9.2]].map(([x, z]) => animal(S, 'pigeon', x, z, { s: 1.6, roam: 2, speed: 0.5 })),
    ]);
    // 錦鯉池：把原本簡單的魚換成會擺尾的錦鯉
    const kg = await load('koi');
    if (kg && out.fish) out.fish.slice(0, 6).forEach((f, i) => {
      const k = SkeletonUtils.clone(kg.scene); k.scale.setScalar(0.9 + (i % 3) * 0.12); const mixer = new THREE.AnimationMixer(k), c = kg.animations.find(a => a.name === 'Swim') || kg.animations[0];
      if (c) mixer.clipAction(c).play(); mixer.update(Math.random());
      k.position.copy(f.m.position); out.S.remove(f.m); out.S.add(k); f.m = k; animals.push({ o: k, mixer, idleOnly: true, acts: {}, home: f, external: true });
    });
  },
  // 1 竹林書徑
  async (out, S) => {
    const spots = out.bambooSpots || [];
    if (spots.length) { const g = await scatter(S, 'bamboo', spots.map(([x, z, h], i) => [x, z, i * 1.7, 1.5 + h * 0.9]), {}); if (g) out.bambooOld?.forEach(m => { m.visible = false; }); }
    const r = seeded(101), Z = ZONES[1], rnd = (n, f) => Array.from({ length: n }, () => { let x, z, k = 0; do { x = (r() - 0.5) * 100; z = Z.z0 + 3 + r() * (Z.z1 - Z.z0 - 6); } while (++k < 20 && (Math.abs(x) < 6 || Math.abs(z - 70) < 2.5 || Math.hypot(x + 7, z - TEAS[1].z) < 5)); return f(x, z, r()); });
    await Promise.all([
      scatter(S, 'pine', rnd(8, (x, z, k) => [x, z, k * 6, 1.1 + k * 0.5]), { col: 0.4, cam: 1 }),
      scatter(S, 'stump', rnd(10, (x, z, k) => [x, z, k * 6, 1 + k * 0.4]), { col: 0.45 }),
      scatter(S, 'fernRock', rnd(8, (x, z, k) => [x, z, k * 6, 1 + k * 0.6]), { col: 0.9 }),
      scatter(S, 'lotus', [[-9, 70, 0, 1], [-15, 69.6, 1, 1.2], [12, 70.3, 2, 1], [19, 69.7, 3, 1.1], [-28, 70.2, 4, 1], [30, 69.8, 5, 1.2]]),
      scatter(S, 'archBridge', [[-20, 70, Math.PI / 2, 1.3], [22, 70, Math.PI / 2, 1.3]], { col: 1.2 }),
      one(S, 'scrolls', -9.6, TEAS[1].z - 2.6, 0, 1.1, { col: 0.8 }), one(S, 'scrolls', -4.4, TEAS[1].z - 2.6, 0, 1.1, { col: 0.8 }),
      animal(S, 'deer', -16, 74, { s: 0.85, roam: 5, speed: 0.6 }), animal(S, 'deer', 18, 64, { s: 0.8, roam: 5, speed: 0.6 }),
    ]);
  },
  // 2 岩石山谷：原本的石頭換成三種岩石，加上崖邊石台、矮松、迎風樹、琥珀水晶
  async (out, S) => {
    const old = out.rockOld || [], kinds = ['boulders', 'sandstone', 'basalt'];
    const groups = await Promise.all(kinds.map((k, i) => scatter(S, k, old.filter((_, j) => j % 3 === i).map(o => [o.x, o.z, o.x * 3, 0.55 + o.r * 0.55]))));
    if (groups.every(Boolean)) old.forEach(o => { o.m.visible = false; });
    const r = seeded(202), Z = ZONES[2], rnd = (n, f) => Array.from({ length: n }, () => { let x, z, k = 0; do { x = (r() - 0.5) * 100; z = Z.z0 + 3 + r() * (Z.z1 - Z.z0 - 6); } while (++k < 20 && (Math.abs(x) < 6 || Math.hypot(x + 7, z - TEAS[2].z) < 5)); return f(x, z, r()); });
    await Promise.all([
      scatter(S, 'ledge', [[-47, 88, 0.6, 1], [46, 97, 2.5, 1.1], [-46, 102, 1.2, 0.9]], { col: 3, cam: 3.2 }),
      scatter(S, 'dwarfPine', rnd(10, (x, z, k) => [x, z, k * 6, 1 + k * 0.6]), { col: 0.8 }),
      scatter(S, 'larch', rnd(6, (x, z, k) => [x, z, k * 6, 0.9 + k * 0.3]), { col: 0.5, cam: 1.2 }),
      scatter(S, 'amber', rnd(14, (x, z, k) => [x, z, k * 6, 2.5 + k * 2]), { col: 0.4 }),
    ]);
  },
  // 3 熔岩火山：原本的焦木換成焦樹／枯樹／扭曲枯橡，再多種一倍；火山岩、黑曜石、營火、步道火把
  async (out, S) => {
    const old = out.burntOld || [], trees = ['scorched', 'deadTree', 'deadOak'];
    const r = seeded(303), Z = ZONES[3], extra = Array.from({ length: 18 }, () => { let x, z, k = 0; do { x = (r() - 0.5) * 104; z = Z.z0 + 3 + r() * (Z.z1 - Z.z0 - 6); } while (++k < 20 && (Math.abs(x) < 6 || Math.hypot(x - 42, z - 117) < 13 || Math.hypot(x + 7, z - TEAS[3].z) < 5)); return { x, z }; });
    const all = [...old, ...extra];
    const groups = await Promise.all(trees.map((k, i) => scatter(S, k, all.filter((_, j) => j % 3 === i).map(o => [o.x, o.z, o.x * 2.3, k === 'deadTree' ? 1.1 : 0.75]), { col: 0.45, cam: 1 })));
    if (groups.every(Boolean)) old.forEach(o => { o.g.visible = false; });
    const rnd = (n, f) => Array.from({ length: n }, () => { let x, z, k = 0; do { x = (r() - 0.5) * 100; z = Z.z0 + 3 + r() * (Z.z1 - Z.z0 - 6); } while (++k < 20 && (Math.abs(x) < 5 || Math.hypot(x - 42, z - 117) < 12)); return f(x, z, r()); });
    const torches = []; for (let z = Z.z0 + 4; z < Z.z1 - 2; z += 6) torches.push([-3.4, z, 0, 0.9], [3.4, z + 3, 0, 0.9]);
    await Promise.all([
      scatter(S, 'volRocks', rnd(10, (x, z, k) => [x, z, k * 6, 1.2 + k * 1.2]), { col: 0.8 }),
      scatter(S, 'scoria', rnd(14, (x, z, k) => [x, z, k * 6, 1.5 + k * 2]), { col: 0.4 }),
      scatter(S, 'obsidian', rnd(8, (x, z, k) => [x, z, k * 6, 0.9 + k * 0.8]), { col: 0.5, cam: 0.6 }),
      one(S, 'campfire', TEAS[3].x + 3.4, TEAS[3].z + 3, 0, 1.2, { col: 0.9 }),
      scatter(S, 'torch', torches, { col: 0.25 }),
      ...[[-12, 110], [17, 122]].map(([x, z]) => animal(S, 'crow', x, z, { s: 2.2, idleOnly: true })),
    ]);
  },
  // 4 雷雲山頂：水晶換成紫水晶／發光水晶柱；寶塔、符石、斷柱、石階、枯樹；烏鴉停在魔王石柱頂
  async (out, S) => {
    const old = out.crystalOld || [];
    const groups = await Promise.all(['purple', 'crystalCol'].map((k, i) => scatter(S, k, old.filter((_, j) => j % 2 === i).map(o => [o.x, o.z, o.x, k === 'purple' ? 1 + o.h * 0.6 : 0.6 + o.h * 0.4]))));
    if (groups.every(Boolean)) old.forEach(o => { o.m.visible = false; });
    const r = seeded(404), Z = ZONES[4], B = BOSS_HOME, rnd = (n, f) => Array.from({ length: n }, () => { let x, z, k = 0; do { x = (r() - 0.5) * 100; z = Z.z0 + 3 + r() * (Z.z1 - Z.z0 - 6); } while (++k < 20 && (Math.abs(x) < 5 || Math.hypot(x - B.x, z - B.z) < 12 || Math.hypot(x + 7, z - TEAS[4].z) < 5)); return f(x, z, r()); });
    await Promise.all([
      one(S, 'pagoda', 17, 147, -0.5, 1, { col: 3.4, cam: 3.4 }),
      scatter(S, 'rune', [0, 1, 2, 3, 4, 5].map(i => { const a = i / 6 * Math.PI * 2 + 0.3; return [B.x + Math.cos(a) * 6.3, B.z + Math.sin(a) * 5, a, 1.5]; }), { col: 0.35 }),
      scatter(S, 'column', rnd(6, (x, z, k) => [x, z, k * 6, 0.9 + k * 0.4]), { col: 0.9, cam: 1 }),
      one(S, 'stair', -38, 140, Math.PI / 2, 1, { col: 2.8, cam: 2.6 }),
      scatter(S, 'rowan', rnd(8, (x, z, k) => [x, z, k * 6, 0.9 + k * 0.4]), { col: 0.4, cam: 1 }),
      ...[0, 3, 5, 8].map(i => { const a = i / 10 * Math.PI * 2; return animal(S, 'crow', B.x + Math.cos(a) * 10, B.z + Math.sin(a) * 8, { s: 2.2, y: 4.75, idleOnly: true }); }),
    ]);
  },
];

// out：Outside；P：玩家位置（Vector3）
export function initModels(out, P) {
  const done = new Set(), S = out.S;
  const want = () => { ZONES.forEach((Z, i) => { if (!done.has(i) && P.z > Z.z0 - 30) { done.add(i); BUILD[i](out, S).catch(e => console.warn('擺設失敗', i, e)); } }); };
  want();
  out.t.updaters.push(dt => { want(); tickAnimals(dt, P); });
}

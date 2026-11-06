// 廟門外的樹林：金榜樹林、天燈廣場、錦鯉池、每日尋寶、拖延怪與考試魔王
import * as THREE from '../vendor/three.module.min.js';
import { L, CIRCLES } from './scene.js';
import { ZONES, WORLD, zoneAt, buildZones, tickZones, buildMonster, SPECIES, EL_COLOR, monStats, ZONE_COLLIDERS, CAM_POSTS, BOSS_HOME, TEAS, STELES, SHOP, DUMMY, ARENA, glow as zglow } from './zones.js';
export { ZONES, zoneAt, STELES, TEAS, SHOP, DUMMY, ARENA, SPECIES };

// 卡通（賽璐璐）明暗：三段色階，整個場景跟人物同一種畫風
let _grad;
function toonGrad() {
  if (_grad) return _grad;
  _grad = new THREE.DataTexture(new Uint8Array([120, 195, 255]), 3, 1, THREE.RedFormat);
  _grad.minFilter = _grad.magFilter = THREE.NearestFilter; _grad.needsUpdate = true; return _grad;
}
const lam = (c, extra = {}) => new THREE.MeshToonMaterial({ color: c, gradientMap: toonGrad(), ...extra });
const basic = (c, extra = {}) => new THREE.MeshBasicMaterial({ color: c, ...extra });
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
// 永遠面向鏡頭的文字牌（名字、怪物名稱）
function textSprite(text, { w = 256, h = 64, font = 30, bg = 'rgba(36,20,14,.82)', fg = '#fff4d6', sx = 1.4 } = {}) {
  const tex = canvasTex(w, h, (g, W, H) => { g.fillStyle = bg; g.beginPath(); g.roundRect(2, 2, W - 4, H - 4, H / 2 - 2); g.fill(); g.fillStyle = fg; g.font = `700 ${font}px "Noto Serif TC",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, W / 2, H / 2 + 2); });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false })); s.scale.set(sx, sx * h / w, 1); return s;
}
let _glow;
function glowTex() {
  if (_glow) return _glow;
  _glow = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,240,180,1)'); gr.addColorStop(0.4, 'rgba(255,210,90,.5)'); gr.addColorStop(1, 'rgba(255,200,60,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  return _glow;
}
// 天燈的燈紙：米黃到橘的漸層、上下紅邊，正反兩面用直書寫上心願（右到左）
function lanternTex(text) {
  const chars = [...String(text || '金榜題名').replace(/\s+/g, '')].slice(0, 30);
  const n = chars.length, per = n <= 5 ? n : n <= 12 ? 6 : n <= 20 ? 7 : 8, cols = Math.ceil(n / per);
  return canvasTex(1024, 512, (g, W, H) => {
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#fff4d8'); gr.addColorStop(0.55, '#ffd890'); gr.addColorStop(1, '#ff9a40');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = '#c8352b'; g.fillRect(0, 0, W, 22); g.fillRect(0, H - 26, W, 26);
    g.strokeStyle = 'rgba(160,80,30,.35)'; g.lineWidth = 3; for (let k = 0; k < 8; k++) { const x = k * W / 8; g.beginPath(); g.moveTo(x, 22); g.lineTo(x, H - 26); g.stroke(); }
    const area = H - 90, font = Math.min(82, Math.floor(area / per), Math.floor(300 / cols / 1.12));
    g.fillStyle = '#9a1c14'; g.font = `900 ${font}px "Noto Serif TC","Kaiti TC","STKaiti",serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    [W * 0.25, W * 0.75].forEach(cx => {
      const top = 22 + (H - 48 - per * font) / 2 + font / 2;
      for (let c = 0; c < cols; c++) {
        const x = cx + ((cols - 1) / 2 - c) * font * 1.12; // 第一行在最右邊
        chars.slice(c * per, c * per + per).forEach((ch, r) => g.fillText(ch, x, top + r * font));
      }
    });
  });
}
const glowSprite = (color = '#ffd76a', size = 1) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.scale.set(size, size, 1); return s; };

// 位置
export const KOI = { x: 16, z: 45, r: 4 };
export const BOSS_AT = BOSS_HOME; // 0.26 起：考試魔王住在最深處的雷雲山頂
// 摩天輪：中心在 (x, z)，輪軸高 hub、半徑 r、12 個車廂、轉一圈 period 秒
export const WHEEL = { x: 37, z: 41, hub: 13.5, r: 11, n: 12, period: 120 };
// 車廂半徑（可以在裡面走動）、車廂中心離輪子的距離
export const CABIN_R = 1.45, CABIN_OFF = 2.95;
export const PLOTS = [];
for (let r = 0; r < 8; r++) for (let c = 0; c < 6; c++) PLOTS.push({ x: -26 + c * 3.6, z: 25 + r * 3.6 });
export const OUT_SPOTS = {
  grove: { x: -9.5, z: 23.2, f: Math.PI },
  sky: { x: 14, z: 30, f: Math.PI }, // 面向廟放燈：鏡頭在廣場這一側，不會卡在樹後面
  koi: { x: 16, z: 39.6, f: 0 },
  wheel: { x: 37, z: 36.5, f: 0 },
  boss: { x: 0, z: BOSS_HOME.z - 7, f: 0 },
  forest: { x: 0, z: 34, f: 0 },
};
export const OUT_MARKS = [
  { id: 'grove', name: '金榜樹林', pos: [-17, 3.4, 23.2] },
  { id: 'sky', name: '天燈廣場', pos: [14, 3.2, 27] },
  { id: 'koi', name: '錦鯉池', pos: [16, 2.6, 45] },
  { id: 'boss', name: '考試魔王', pos: [0, 4.8, BOSS_HOME.z] },
  { id: 'shop', name: '文具鋪', pos: [SHOP.x, 4.4, SHOP.z] },
  { id: 'dummy', name: '木人樁', pos: [DUMMY.x, 3.4, DUMMY.z] },
  { id: 'arena', name: '擂台', pos: [ARENA.x, 3, ARENA.z] },
  { id: 'wheel', name: '摩天輪', pos: [37, 27, 41] },
];
export const TREASURE_KINDS = [{ k: 'brush', name: '毛筆' }, { k: 'ink', name: '墨條' }, { k: 'paper', name: '宣紙' }, { k: 'stone', name: '硯台' }, { k: 'scroll', name: '書卷' }];
// 寶物可能出現的地方（每天依日期挑 5 個，大家一樣）
export const TREASURE_SPOTS = [[-28, 22.5], [-27, 38], [-5, 52.5], [6, 52], [27, 23], [28, 37], [25, 52.5], [-15, 52], [-3, 29], [5, 35], [10, 23.5], [-29, 51], [11, 51], [-5, 41], [24, 31], [8, 44], [-17, 2], [17, 18.5], [-13, 18.5], [26, 44], [-2, 24]];
// hp：要打幾下；hit：被打中時說的話；bye：被打倒時說的話
export const MONSTER_KINDS = [
  { name: '拖延怪', color: '#8a6ac8', hp: 3, say: '等一下再讀…', hit: ['哎呀！', '明天再讀嘛～', '別催我啦！'], bye: '哇！我不拖了～' },
  { name: '滑手機怪', color: '#4a8ad8', hp: 4, say: '再滑一下就好', hit: ['我的手機！', '再一則就好！', '電量剩 1%…'], bye: '手機還你啦！' },
  { name: '緊張怪', color: '#e8705a', hp: 3, say: '完蛋了完蛋了', hit: ['好可怕！', '心跳好快！', '你怎麼這麼冷靜？'], bye: '深呼吸…我放鬆了～' },
  { name: '瞌睡蟲', color: '#7ac86a', hp: 2, say: '好睏喔…', hit: ['呼…嗯？', '再睡五分鐘…'], bye: '醒了醒了！' },
];
export const BOSS_LINES = ['這題你不會吧？', '時間只剩五分鐘！', '選擇題全部選 C？', '我還有附加題！', '哼，有兩下子', '畫卡畫歪了吧？'];
// 怪物能走動的範圍：自己那一區裡面，避開錦鯉池、摩天輪、文具鋪、擂台、茶亭和區域入口（牌樓前後）
const AVOID = [[KOI.x, KOI.z, KOI.r + 1.2], [37, 41, 8], [14, 30, 4.5], [SHOP.x, SHOP.z, 3.5], [ARENA.x, ARENA.z, ARENA.r + 1], [DUMMY.x, DUMMY.z, 1.5], ...TEAS.map(t => [t.x, t.z, 4.5]), ...STELES.map(s => [s.x, s.z, 2])];
const inZone = (x, z, zi) => { const Z = ZONES[zi], lim = zi ? WORLD.FW - 3 : 30; return x > -lim && x < lim && z > Z.z0 + (zi ? 3 : 2.5) && z < Z.z1 - 2 && !AVOID.some(([ax, az, r]) => Math.hypot(x - ax, z - az) < r) && Math.hypot(x - BOSS_HOME.x, z - BOSS_HOME.z) > 6; };
const inArea = (x, z) => inZone(x, z, Math.max(0, zoneAt(z)));
// 每區怪物數量
const ZONE_COUNT = [7, 5, 5, 5, 5];

export class Outside {
  constructor(t) {
    this.t = t; this.S = t.scene; this.time = 0;
    this.trees = []; this.lanterns = []; this.fish = []; this.food = null; this.monsters = []; this.treasures = []; this.fx = [];
    this.playerLv = 1; this.steleOn = new Set();
    this.buildLand(); buildZones(this); this.buildGrove(); this.buildSky(); this.buildKoi(); this.buildBoss(); this.buildWheel(); this.buildFar();
    CIRCLES.push(...ZONE_COLLIDERS); // 區域裡的石頭、竹子、柱子不能穿過去
    ZONES.forEach((Z, zi) => { for (let i = 0; i < ZONE_COUNT[zi]; i++) this.spawnMonster(zi); });
    t.updaters.push(dt => this.update(dt));
    // 鏡頭不要鑽進樹冠裡
    // 鏡頭到角色之間（不只鏡頭那一點）碰到樹冠就拉近，才不會整個畫面被一棵樹擋住
    const hitAt = (x0, y0, z0) => z0 > L.GZ && ((y0 < 6.5 && this.treeSpots.some(([x, z, r]) => Math.hypot(x0 - x, z0 - z) < r + 0.4)) || (y0 < 8 && CAM_POSTS.some(([x, z, r]) => Math.hypot(x0 - x, z0 - z) < r + 0.35)));
    t.camHit = (v, pp) => { if (!pp) return hitAt(v.x, v.y, v.z); for (let k = 0.35; k <= 1.001; k += 0.13) if (hitAt(pp.x + (v.x - pp.x) * k, pp.y + 1.2 + (v.y - pp.y - 1.2) * k, pp.z + (v.z - pp.z) * k)) return true; return false; };
  }

  // ---------- 地面、步道、四周的樹 ----------
  buildLand() {
    const S = this.S, z0 = L.GZ + 0.5, depth = L.FZ - z0 + 2, gd = ZONES[0].z1 - z0;
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(L.FW * 2 + 4, gd), lam('#7cc456')); grass.rotation.x = -Math.PI / 2; grass.position.set(0, 0.004, z0 + gd / 2); S.add(grass);
    this.t.ground.push(grass);
    // 路面分層：草地 → 橫向路 → 直向步道，各自有高度差＋polygonOffset，路口才不會互相搶畫（出現馬賽克閃爍）
    const road = (c, k) => lam(c, { polygonOffset: true, polygonOffsetFactor: -k, polygonOffsetUnits: -k * 2 });
    const cross = new THREE.Mesh(new THREE.PlaneGeometry(L.FW * 2 - 6, 2.4), road('#c9b48a', 1)); cross.rotation.x = -Math.PI / 2; cross.position.set(0, 0.016, 36.5); S.add(cross);
    const path = new THREE.Mesh(new THREE.PlaneGeometry(3, depth), road('#e6d2a0', 2)); path.rotation.x = -Math.PI / 2; path.position.set(0, 0.028, z0 + depth / 2); S.add(path);
    // 四周的樹（樹林邊界）
    const trunkM = lam('#7a5232'), leafM = [lam('#5cb04a'), lam('#6cc456'), lam('#4a9a42')];
    this.treeSpots = [[-14, 24, 1.7], [14, 24.5, 1.7], [-8, 25, 1.7], [9, 26, 1.7]]; // 含 scene.js 種在廟門外的樹
    const tree = (x, z, s = 1) => {
      this.treeSpots.push([x, z, 1.7 * s]);
      const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s);
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 2.2, 7), trunkM); tr.position.y = 1.1; g.add(tr);
      [[0, 2.8, 0, 1.4], [0.7, 2.4, 0.3, 1], [-0.6, 2.5, -0.2, 1.05], [0, 3.6, 0, 0.9]].forEach(([a, b, c, r], i) => { const l = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), leafM[i % 3]); l.position.set(a, b, c); g.add(l); });
      S.add(g);
    };
    for (let z = 24; z <= ZONES[2].z0 - 2; z += 4.2) { tree(-L.FW - 1.5, z, 1.1); tree(L.FW + 1.5, z + 2, 1.15); }
    [[22, 24.5], [27, 31], [23, 51.5]].forEach(([x, z]) => tree(x, z, 0.9));
    // 指示牌
    const sign = (x, z, text, ry = 0) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; S.add(g);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6), trunkM); post.position.y = 0.8; g.add(post);
      const tex = canvasTex(256, 80, (c, W, H) => { c.fillStyle = '#6a3a22'; c.fillRect(0, 0, W, H); c.strokeStyle = '#e8c15a'; c.lineWidth = 4; c.strokeRect(4, 4, W - 8, H - 8); c.fillStyle = '#f6dc94'; c.font = '700 36px "Noto Serif TC",serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, W / 2, H / 2 + 2); });
      [0, Math.PI].forEach(r => { const b = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.44), basic('#fff', { map: tex })); b.position.y = 1.55; b.rotation.y = r; b.position.z = r ? -0.03 : 0.03; g.add(b); });
    };
    sign(-4, 22.6, '← 金榜樹林'); sign(4, 22.6, '天燈廣場 →'); sign(24, 36.4, '摩天輪 →'); sign(4.5, 38.4, '錦鯉池 →'); sign(-2.2, 42, '↓ 練功場・竹林');
  }

  // ---------- 摩天輪：12 個車廂、兩人一格；轉動角度用時間算，所有人看到的一樣 ----------
  buildWheel() {
    const S = this.S, W = WHEEL, white = lam('#f4f2ee'), red = lam('#e8584a'), gold = lam('#e8c15a');
    const g = new THREE.Group(); g.position.set(W.x, 0, W.z); S.add(g); this.wheel = g;
    // 支架：兩組 A 字腳
    [-1.4, 1.4].forEach(dz => [-1, 1].forEach(s => {
      const len = Math.hypot(W.hub, 6), leg = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, len, 10), white);
      leg.position.set(s * 3, W.hub / 2, dz); leg.rotation.z = Math.atan2(6, W.hub) * -s; g.add(leg);
    }));
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 3.4, 12), gold); axle.rotation.x = Math.PI / 2; axle.position.y = W.hub; g.add(axle);
    // 會轉的部分：外圈、輻條、燈
    const rot = new THREE.Group(); rot.position.y = W.hub; g.add(rot); this.wheelRot = rot;
    [-0.9, 0.9].forEach(z => { const rim = new THREE.Mesh(new THREE.TorusGeometry(W.r, 0.16, 8, 60), red); rim.position.z = z; rot.add(rim); const inner = new THREE.Mesh(new THREE.TorusGeometry(W.r * 0.45, 0.1, 6, 36), white); inner.position.z = z; rot.add(inner); });
    for (let i = 0; i < W.n; i++) {
      const a = i / W.n * Math.PI * 2;
      [-0.9, 0.9].forEach(z => { const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, W.r), white); sp.position.set(Math.sin(a) * W.r / 2, -Math.cos(a) * W.r / 2, z); sp.rotation.z = a; rot.add(sp); });
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), basic(['#ffd76a', '#ff8ab0', '#8ad0ff'][i % 3])); bulb.position.set(Math.sin(a) * W.r, -Math.cos(a) * W.r, 1.05); rot.add(bulb);
    }
    // 車廂：掛在外圈上，永遠保持直立
    const cols = ['#ff9aa8', '#ffd36a', '#8ad0ff', '#9ae0a0', '#c8a8ff', '#ffb07a'];
    this.cabins = [];
    for (let i = 0; i < W.n; i++) {
      const c = new THREE.Group(); S.add(c);
      const col = lam(cols[i % cols.length]);
      const R = CABIN_R;
      const floor = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.12, 20), col); floor.position.y = -1.0; c.add(floor);
      const back = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 1.0, 20, 1, true, -Math.PI * 0.3, Math.PI * 0.6), col); back.material = lam(cols[i % cols.length], { side: THREE.DoubleSide }); back.position.y = -0.45; c.add(back);
      const rail = new THREE.Mesh(new THREE.TorusGeometry(R, 0.04, 6, 32), white); rail.rotation.x = Math.PI / 2; rail.position.y = -0.4; c.add(rail);
      // 屋頂：自己搭的那一格會變半透明，從外面看得到裡面的人
      const roof = new THREE.Mesh(new THREE.ConeGeometry(R + 0.15, 0.6, 20), lam(cols[i % cols.length], { transparent: true })); roof.position.y = 1.1; c.add(roof); c.userData.roof = roof;
      [0, Math.PI / 2, Math.PI, Math.PI * 1.5].forEach(a => { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.0), white); post.position.set(Math.sin(a) * (R - 0.05), 0, Math.cos(a) * (R - 0.05)); c.add(post); });
      const hang = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6), gold); hang.position.y = 1.55; c.add(hang);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, CABIN_OFF), gold); arm.position.set(0, 1.85, CABIN_OFF / 2); c.add(arm); // 接到輪框的橫桿
      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.45), white); seat.position.set(0, -0.6, R - 0.6); c.add(seat);
      this.cabins.push(c);
    }
    // 上下車的月台
    const plat = new THREE.Mesh(new THREE.BoxGeometry(5, 0.3, 3), lam('#c8a878')); plat.position.set(W.x, 0.15, W.z - 3.2); S.add(plat);
    const steps = new THREE.Mesh(new THREE.BoxGeometry(3, 0.15, 1), lam('#b89868')); steps.position.set(W.x, 0.07, W.z - 5.1); S.add(steps);
    this.t.tapTargets.push([plat, () => this.t.emit('tapWheel')]);
    this.updateWheel();
  }
  wheelAngle() { return (Date.now() / 1000) / WHEEL.period * Math.PI * 2; }
  // 第 i 個車廂現在的角度（0 = 最下面，月台的位置）
  cabinAngle(i) { return this.wheelAngle() + i / WHEEL.n * Math.PI * 2; }
  // 車廂掛在輪子前面（靠廟的那一側），坐在裡面往外看不會被輪框擋住
  cabinPos(i, out = new THREE.Vector3()) { const a = this.cabinAngle(i), W = WHEEL; return out.set(W.x + Math.sin(a) * W.r, W.hub - Math.cos(a) * W.r - 1.2, W.z - CABIN_OFF); }
  updateWheel() {
    this.wheelRot.rotation.z = this.wheelAngle();
    this.cabins.forEach((c, i) => { this.cabinPos(i, c.position); c.position.y += 1.2; c.rotation.z = Math.sin(this.time * 0.8 + i) * 0.04; });
  }

  // ---------- 遠方的山、雲 ----------
  buildFar() {
    const S = this.S;
    const mtn = (x, z, r, h, col) => { const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), lam(col)); m.position.set(x, h / 2 - 1, z); m.rotation.y = Math.random() * 6; S.add(m); return m; };
    // 近一點的綠色山丘
    for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2, R = 128 + (i % 3) * 12; mtn(Math.cos(a) * R, 80 + Math.sin(a) * R, 18 + (i % 4) * 5, 14 + (i % 5) * 5, ['#6cba5a', '#5aa850', '#7cc466'][i % 3]); }
    // 遠方的高山（藍綠色，有雪頂）
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * Math.PI * 2 + 0.2, R = 205 + (i % 2) * 20, h = 55 + (i % 4) * 16, x = Math.cos(a) * R, z = 80 + Math.sin(a) * R;
      mtn(x, z, 34 + (i % 3) * 8, h, ['#6a9ab8', '#7aa8c4', '#5a8aa8'][i % 3]);
      const cap = new THREE.Mesh(new THREE.ConeGeometry((34 + (i % 3) * 8) * 0.28, h * 0.28, 7), lam('#f4f8ff')); cap.position.set(x, h - 1 - h * 0.14, z); S.add(cap);
    }
    // 雲
    for (let i = 0; i < 10; i++) {
      const c = new THREE.Group(), a = i * 0.63, R = 90 + (i % 3) * 30; c.position.set(Math.cos(a) * R, 42 + (i % 4) * 6, 80 + Math.sin(a) * R);
      [[0, 0, 0, 5], [5, -1, 0, 3.5], [-5, -1, 1, 3.8], [2, 2, -1, 3.2]].forEach(([x, y, z, r]) => { const b = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), lam('#ffffff')); b.position.set(x, y, z); b.scale.y = 0.6; c.add(b); });
      S.add(c); (this.clouds ||= []).push(c);
    }
  }

  // ---------- 金榜樹林：一人一棵，每天澆水就長大 ----------
  buildGrove() {
    const S = this.S, soilM = lam('#6a4a30');
    this.plotGroups = PLOTS.map((p, i) => {
      const g = new THREE.Group(); g.position.set(p.x, 0, p.z); S.add(g);
      const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.8, 0.08, 16), soilM); soil.position.y = 0.04; g.add(soil);
      g.userData.plot = i; this.t.tapTargets.push([g, () => this.t.emit('tapTree', i)]);
      return g;
    });
    // 苗圃：種樹的地方（靠著圍牆，不擋路）
    const nursery = new THREE.Group(); nursery.position.set(-9.5, 0, 21.6); S.add(nursery);
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.9), lam('#7a4a2a')); box.position.y = 0.25; nursery.add(box);
    for (let k = 0; k < 6; k++) { const sp = this.treeMesh(0); sp.scale.setScalar(0.7); sp.position.set(-0.55 + (k % 3) * 0.55, 0.5, k < 3 ? -0.2 : 0.2); nursery.add(sp); }
    this.t.tapTargets.push([nursery, () => this.t.emit('tapNursery')]);
  }
  treeMesh(stage) {
    const g = new THREE.Group(), leaf = lam('#5fa040', { flatShading: true });
    if (stage <= 0) {
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.25), lam('#6a9a3a')); st.position.y = 0.12; g.add(st);
      [-1, 1].forEach(s => { const l = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), leaf); l.scale.set(1.4, 0.4, 0.8); l.position.set(0.06 * s, 0.25, 0); l.rotation.z = 0.4 * s; g.add(l); });
      return g;
    }
    const k = Math.min(stage, 9), h = 0.4 + k * 0.22, r = 0.22 + k * 0.1;
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.03 + k * 0.012, 0.05 + k * 0.016, h), lam('#6a4428')); tr.position.y = h / 2; g.add(tr);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), leaf); crown.position.y = h + r * 0.6; g.add(crown);
    if (k >= 4) [[0.6, 0.1], [-0.6, -0.1]].forEach(([a, b]) => { const c2 = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 0.65, 1), leaf); c2.position.set(a * r, h + r * 0.35, b * r); g.add(c2); });
    // 開花（第 7 天起）、結狀元果（第 10 天起）
    if (stage >= 7) for (let i = 0; i < 9; i++) { const a = i * 2.4, e = 0.4 + (i % 3) * 0.3; const f = new THREE.Mesh(new THREE.SphereGeometry(0.06 + k * 0.004, 6, 5), lam('#f2a0b8')); f.position.set(Math.cos(a) * r * 0.95 * Math.cos(e), h + r * 0.6 + Math.sin(e) * r * 0.8, Math.sin(a) * r * 0.95 * Math.cos(e)); g.add(f); }
    if (stage >= 10) for (let i = 0; i < 6; i++) { const a = i * 1.05; const f = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), lam('#ffcf3a', { emissive: '#7a5410' })); f.position.set(Math.cos(a) * r * 0.9, h + r * 0.2, Math.sin(a) * r * 0.9); g.add(f); }
    return g;
  }
  // list：[{ i, n, s, mine, wt }]
  setTrees(list) {
    this.trees = list;
    this.plotGroups.forEach(g => { if (g.userData.tree) { g.remove(g.userData.tree); g.userData.tree = null; } if (g.userData.tag) { g.remove(g.userData.tag); g.userData.tag = null; } });
    list.forEach(tr => {
      const g = this.plotGroups[tr.i]; if (!g) return;
      const m = this.treeMesh(tr.s); g.add(m); g.userData.tree = m;
      const tag = textSprite(`${tr.mine ? '⭐ ' : ''}${tr.n || '考生'}・${tr.s} 天`, { bg: tr.mine ? 'rgba(150,36,28,.9)' : 'rgba(36,20,14,.78)', sx: 1.5 });
      tag.position.y = 0.55; g.add(tag); g.userData.tag = tag;
    });
  }
  // 澆水：水滴灑在樹上
  splash(i) {
    const p = PLOTS[i]; if (!p) return;
    for (let k = 0; k < 14; k++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), basic('#8ad0ff', { transparent: true }));
      const a = Math.random() * 6.28, r = Math.random() * 0.5; d.position.set(p.x + Math.cos(a) * r, 2 + Math.random(), p.z + Math.sin(a) * r); this.S.add(d);
      this.fx.push({ m: d, vy: 0, life: 1.2, g: -6 });
    }
    const g = this.plotGroups[i]; if (g?.userData.tree) this.t.tween(500, k => g.userData.tree.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.15));
  }

  // ---------- 天燈 ----------
  buildSky() {
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.06, 28), lam('#b9a07a')); pad.position.set(14, 0.03, 30); this.S.add(pad);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.08, 6, 36), lam('#c8352b')); ring.rotation.x = Math.PI / 2; ring.position.set(14, 0.07, 30); this.S.add(ring);
    // 廣場中間擺一盞還沒點的天燈，點它也能放
    const g = new THREE.Group(); g.position.set(14, 0, 30); this.S.add(g);
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.3, 12), lam('#8a5a3a')); stand.position.y = 0.15; g.add(stand);
    const lan = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.32, 0.8, 10), lam('#f4e2b8')); lan.position.y = 0.72; g.add(lan);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 6, 16), lam('#c8352b')); rim.rotation.x = Math.PI / 2; rim.position.y = 1.12; g.add(rim);
    this.t.tapTargets.push([g, () => this.t.emit('tapSky')]); this.t.tapTargets.push([pad, () => this.t.emit('tapSky')]);
  }
  // 天燈：x, z 是放燈的人站的位置；face 是燈要朝向的方向（看的人在哪一邊），字寫在燈身正反兩面
  // 燈放在人的前面 1.4 公尺，先低低地浮著讓人看清楚字，再慢慢升空
  releaseLantern(x, z, { text = '金榜題名', face = null, view = null, near = false } = {}) {
    const g = new THREE.Group();
    const dir = face ?? 0, fx = Math.sin(dir), fz = Math.cos(dir), d = near ? 1.7 : 0;
    g.position.set(x + fx * d, near ? 1.9 : 1.6, z + fz * d);
    const tex = lanternTex(text);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.46, 1.25, 24, 1, true), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true }));
    g.add(body); const top = new THREE.Mesh(new THREE.CircleGeometry(0.62, 24), basic('#f2b860', { transparent: true })); top.rotation.x = -Math.PI / 2; top.position.y = 0.625; g.add(top);
    const fire = glowSprite('#ffcf70', 0.7); fire.position.y = -0.62; g.add(fire);
    const glow = glowSprite('#ffb050', 2.6); g.add(glow);
    // 圓柱的 +x 面寫著字：轉到 +x 朝向看的人（view＝鏡頭在燈的哪個方向；沒給就朝放燈的人）
    const base = view != null ? Math.atan2(-Math.cos(view), Math.sin(view)) : Math.atan2(fz, -fx);
    body.rotation.y = base; this.S.add(g);
    this.lanterns.push({ g, body, base, t: near ? -3 : 0, ph: Math.random() * 6, mats: [body.material, top.material, fire.material, glow.material] });
    if (this.lanterns.length > 40) { const o = this.lanterns.shift(); this.S.remove(o.g); o.body.material.map?.dispose(); }
    return g;
  }

  // ---------- 錦鯉池 ----------
  buildKoi() {
    const S = this.S, K = KOI;
    const water = new THREE.Mesh(new THREE.CircleGeometry(K.r, 40), lam('#3a7f9a', { emissive: '#0a2a3a' })); water.rotation.x = -Math.PI / 2; water.position.set(K.x, 0.03, K.z); S.add(water);
    for (let i = 0; i < 22; i++) { const a = i / 22 * Math.PI * 2, rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35 + (i % 3) * 0.08, 0), lam(i % 2 ? '#8a8478' : '#9a9488', { flatShading: true })); rock.position.set(K.x + Math.cos(a) * (K.r + 0.2), 0.12, K.z + Math.sin(a) * (K.r + 0.2)); rock.scale.y = 0.6; S.add(rock); }
    for (let i = 0; i < 5; i++) { const a = i * 1.3, pad = new THREE.Mesh(new THREE.CircleGeometry(0.35, 12), lam('#4f8a3a')); pad.rotation.x = -Math.PI / 2; pad.position.set(K.x + Math.cos(a) * 2.6, 0.04, K.z + Math.sin(a) * 2.6); S.add(pad); }
    const colors = ['#f07a2a', '#f4f0e8', '#e8402a', '#f07a2a', '#ffffff', '#e8a02a', '#f07a2a', '#e8402a'];
    colors.forEach((c, i) => { const f = this.fishMesh(c, i % 3 === 1 ? '#e8402a' : null); f.position.set(K.x, 0.05, K.z); S.add(f); this.fish.push({ m: f, a: i / colors.length * 6.28, r: 1 + (i % 4) * 0.7, sp: 0.4 + (i % 3) * 0.15, x: K.x, z: K.z }); });
    this.goldFish = this.fishMesh('#ffd34a', null, 1.4); this.goldFish.visible = false; S.add(this.goldFish);
    this.t.tapTargets.push([water, () => this.t.emit('tapKoi')]);
  }
  fishMesh(color, spot, s = 1) {
    const g = new THREE.Group(), m = lam(color);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), m); body.scale.set(0.6, 0.45, 1.6); g.add(body);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.2, 4), m); tail.rotation.x = -Math.PI / 2; tail.position.z = -0.3; g.add(tail); g.userData.tail = tail;
    if (spot) { const sp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), lam(spot)); sp.position.set(0, 0.05, 0.05); g.add(sp); }
    g.scale.setScalar(s); return g;
  }
  // 撒飼料：魚游過來；有機會看到金色錦鯉躍出水面（鯉躍龍門）
  feed(x, z, golden) {
    this.food = { x, z, t: 5 };
    for (let k = 0; k < 10; k++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.03, 5, 4), lam('#c89a5a')); d.position.set(x + (Math.random() - 0.5) * 0.6, 0.06, z + (Math.random() - 0.5) * 0.6); this.S.add(d); this.fx.push({ m: d, vy: 0, life: 4, g: 0 }); }
    if (!golden) return;
    const f = this.goldFish; f.visible = true; f.rotation.set(0, 0, 0);
    this.t.tween(1500, k => { f.position.set(x - 1.2 + k * 2.4, 0.1 + Math.sin(k * Math.PI) * 2.2, z); f.rotation.x = -Math.cos(k * Math.PI) * 1.1; f.rotation.y = Math.PI / 2; }, 900, t => t, () => { f.visible = false; this.ripple(x + 1.2, z); });
    const sp = glowSprite('#ffe08a', 2.4); sp.position.set(x, 1.6, z); this.S.add(sp); this.fx.push({ m: sp, vy: 0, life: 2.6, g: 0, sprite: true });
  }
  ripple(x, z) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.16, 24), basic('#e8f6ff', { transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.05, z); this.S.add(m);
    this.t.tween(1400, k => { m.scale.setScalar(1 + k * 8); m.material.opacity = 0.8 * (1 - k); }, 0, t => t, () => this.S.remove(m));
  }

  // ---------- 每日尋寶 ----------
  // list：[{ k, x, z, got }]
  setTreasures(list) {
    this.treasures.forEach(o => { this.S.remove(o.g); this.t.tapTargets = this.t.tapTargets.filter(tt => tt[0] !== o.g); });
    this.treasures = list.map(it => {
      const g = new THREE.Group(); g.position.set(it.x, 0.5, it.z); g.visible = !it.got; this.S.add(g);
      const m = this.treasureMesh(it.k); g.add(m); g.add(glowSprite('#ffe08a', 1.3));
      const o = { ...it, g, m }; this.t.tapTargets.push([g, () => this.t.emit('tapTreasure', o)]); return o;
    });
  }
  treasureMesh(k) {
    const g = new THREE.Group();
    if (k === 'brush') { const h = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5), lam('#8a5a2a')); g.add(h); const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 8), lam('#1a1412')); tip.rotation.x = Math.PI; tip.position.y = -0.31; g.add(tip); g.rotation.z = 0.6; }
    if (k === 'ink') { const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.32, 0.05), lam('#1a1412')); g.add(b); const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.052), lam('#d8ab45')); g.add(l); }
    if (k === 'paper') { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.42, 12), lam('#f8f4e8')); r.rotation.z = Math.PI / 2; g.add(r); }
    if (k === 'stone') { const s = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.24), lam('#3a3a40')); g.add(s); const w = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.12), lam('#101014')); w.position.y = 0.04; g.add(w); }
    if (k === 'scroll') { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 12), lam('#f0e2b8')); r.rotation.z = Math.PI / 2; g.add(r); [-0.22, 0.22].forEach(x => { const e = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 12), lam('#b8241c')); e.rotation.z = Math.PI / 2; e.position.x = x; g.add(e); }); }
    return g;
  }
  pickTreasure(o) {
    o.got = true;
    this.t.tween(500, k => { o.g.position.y = 0.5 + k * 1.2; o.g.scale.setScalar(1 - k * 0.8); }, 0, t => t, () => { o.g.visible = false; o.g.scale.setScalar(1); o.g.position.y = 0.5; });
  }

  // ---------- 各區的怪物：等級依區域、一般型／進化型 ----------
  // zi：第幾區；at：指定位置（魔王叫小怪時）
  spawnMonster(zi = 0, at = null) {
    const Z = ZONES[zi];
    let x, z, tries = 0;
    if (at) { x = at.x; z = at.z; }
    else do { x = (Math.random() - 0.5) * (zi ? WORLD.FW * 2 - 8 : 58); z = Z.z0 + 3 + Math.random() * (Z.z1 - Z.z0 - 5); } while (!inZone(x, z, zi) && ++tries < 40);
    const lv = Z.lv[0] + Math.floor(Math.random() * (Z.lv[1] - Z.lv[0] + 1)), evo = lv >= Z.lv[0] + Math.ceil((Z.lv[1] - Z.lv[0]) * 0.6);
    const sp = SPECIES[Z.el][evo ? 1 : 0], st = monStats(lv), size = (evo ? 1.35 : 1) * (0.92 + (lv - Z.lv[0]) / Math.max(1, Z.lv[1] - Z.lv[0]) * 0.16);
    const g = new THREE.Group(); g.position.set(x, 0, z); this.S.add(g);
    const model = buildMonster(Z.el, evo); model.g.scale.setScalar(size); g.add(model.g);
    const top = (Z.el === 'grass' ? 1.45 : 1.25) * size;
    const hc = document.createElement('canvas'); hc.width = 128; hc.height = 20; const ht = new THREE.CanvasTexture(hc); ht.colorSpace = THREE.SRGBColorSpace;
    const hpBar = new THREE.Sprite(new THREE.SpriteMaterial({ map: ht, depthWrite: false })); hpBar.scale.set(0.9, 0.14, 1); hpBar.position.y = top + 0.12; g.add(hpBar);
    const mats = []; model.g.traverse(o => { if (o.isMesh && o.material?.emissive && !mats.includes(o.material)) { o.material = o.material.clone(); o.material.userData.e0 = o.material.emissive.clone(); mats.push(o.material); } });
    const m = { g, body: model.g, P: model.P, fxs: model.fxs, sp, el: Z.el, evo, zi, lv, name: sp.name, say: sp.say, x, z, home: { x, z }, tx: x, tz: z, t: Math.random() * 5, ph: Math.random() * 6,
      alive: true, hp: st.hp, max: st.hp, atk: st.atk, xp: st.xp, coin: st.coin, cd: 1 + Math.random(), wind: 0, stun: 0, angry: 0, chase: false, size, top, hc, ht, mats };
    this.drawHp(m); this.setTag(m);
    this.monsters.push(m); this.t.tapTargets.push([g, () => this.t.emit('tapMonster', m)]);
    g.scale.setScalar(0.01); this.t.tween(500, k => g.scale.setScalar(0.01 + k * 0.99));
    return m;
  }
  // 名牌：「Lv12 岩鎧穿山甲」；顏色看跟你的等級差多少（灰＝太弱、白＝剛好、橘＝有點強、紅＝很危險）
  setTag(m) {
    if (m.tag) m.g.remove(m.tag);
    const d = m.lv - this.playerLv, bg = d <= -6 ? 'rgba(90,90,90,.8)' : d <= 2 ? 'rgba(36,20,14,.82)' : d <= 5 ? 'rgba(190,100,20,.92)' : 'rgba(170,30,30,.94)';
    m.tag = textSprite(`${d >= 6 ? '☠ ' : ''}Lv${m.lv} ${m.name}`, { w: 320, h: 64, font: 30, sx: 1.5, bg }); m.tag.position.y = m.top + 0.42; m.g.add(m.tag);
  }
  refreshTags(lv) { this.playerLv = lv; this.monsters.forEach(m => m.alive && this.setTag(m)); }
  nearestMonster(x, z, max = 99) {
    let best = null, bd = max;
    for (const m of this.monsters) { if (!m.alive) continue; const d = Math.hypot(m.g.position.x - x, m.g.position.z - z); if (d < bd) { bd = d; best = m; } }
    return best;
  }
  // 丟毛筆：從人手上飛到目標，打中時冒出星星
  throwBrush(from, to, done) {
    const b = new THREE.Group(); const h = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4), lam('#8a5a2a')); b.add(h); const tip = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.12, 8), lam('#1a1412')); tip.position.y = -0.26; tip.rotation.x = Math.PI; b.add(tip);
    this.S.add(b); const sx = from.x, sz = from.z, ex = to.x, ez = to.z, ey = to.y ?? 0.6;
    this.t.tween(420, k => { b.position.set(sx + (ex - sx) * k, 1.3 + Math.sin(k * Math.PI) * 0.8 + (ey - 1.3) * k, sz + (ez - sz) * k); b.rotation.z = k * 12; }, 0, t => t, () => { this.S.remove(b); this.stars(ex, ey, ez); done?.(); });
  }
  stars(x, y, z) {
    for (let k = 0; k < 10; k++) {
      const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.07), basic(['#ffe08a', '#ffffff', '#f2a0b8'][k % 3], { transparent: true }));
      s.position.set(x, y, z); this.S.add(s); const a = k / 10 * 6.28;
      this.fx.push({ m: s, vx: Math.cos(a) * 2, vz: Math.sin(a) * 2, vy: 2 + Math.random() * 2, life: 0.8, g: -8 });
    }
  }
  drawHp(m) {
    const g = m.hc.getContext('2d'), W = 128, H = 20, k = Math.max(0, m.hp / m.max);
    g.clearRect(0, 0, W, H); g.fillStyle = 'rgba(20,10,20,.85)'; g.beginPath(); g.roundRect(0, 0, W, H, 6); g.fill();
    g.fillStyle = k > 0.5 ? '#5ad06a' : k > 0.25 ? '#f0c040' : '#e8402a'; g.beginPath(); g.roundRect(3, 3, (W - 6) * k, H - 6, 4); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 2; if (m.max <= 12) for (let i = 1; i < m.max; i++) { const x = 3 + (W - 6) * i / m.max; g.beginPath(); g.moveTo(x, 3); g.lineTo(x, H - 3); g.stroke(); }
    m.ht.needsUpdate = true;
  }
  // 怪物頭上冒出一句話（對話泡泡）
  say(obj, text, y = 1.75, ms = 1300) {
    if (obj.bubble) obj.g.remove(obj.bubble);
    const b = textSprite(text, { w: 320, h: 64, font: 30, bg: 'rgba(255,250,240,.95)', fg: '#3a2410', sx: 1.6 }); b.position.y = y; obj.g.add(b); obj.bubble = b;
    clearTimeout(obj.bubbleT); obj.bubbleT = setTimeout(() => { if (obj.bubble === b) { obj.g.remove(b); obj.bubble = null; } }, ms);
  }
  // 打中：閃白、壓扁回彈、往後退一點、冒出屬性粒子；回傳是不是打倒了
  // from：打的人站的位置（決定往哪邊退）
  damage(m, amount = 1, crit = false, from = null) {
    if (!m.alive) return false;
    m.hp -= amount; this.drawHp(m);
    m.mats.forEach(mt => mt.emissive.set('#ffffff')); clearTimeout(m.flashT); m.flashT = setTimeout(() => m.mats.forEach(mt => mt.emissive.copy(mt.userData.e0)), crit ? 140 : 90);
    const b = m.body, s0 = m.size, k0 = crit ? 0.42 : 0.28; this.t.tween(crit ? 320 : 240, k => { const q = Math.sin(k * Math.PI) * (1 - k * 0.3); b.scale.set(s0 * (1 + q * k0), s0 * (1 - q * k0), s0 * (1 + q * k0)); }, 0, t => t, () => b.scale.setScalar(s0));
    const p = m.g.position;
    if (from) { const dx = p.x - from.x, dz = p.z - from.z, d = Math.hypot(dx, dz) || 1, push = crit ? 1.1 : 0.6, sx = p.x, sz = p.z; this.t.tween(160, k => { const nx = sx + dx / d * push * k, nz = sz + dz / d * push * k; if (inZone(nx, nz, m.zi) || m.zi === 0) { p.x = nx; p.z = nz; } }, 0, t => 1 - (1 - t) * (1 - t)); }
    m.stun = crit ? 0.5 : 0.28; m.wind = 0; m.angry = 8;
    this.hitBurst(new THREE.Vector3(p.x, m.top * 0.5, p.z), m.el, crit);
    if (m.hp > 0) {
      if (Math.random() < 0.45) this.say(m, m.sp.hit[(m.max - m.hp) % m.sp.hit.length], m.top + 0.75);
      if (!m.zi) { m.tx = p.x + (Math.random() - 0.5) * 6; m.tz = p.z + (Math.random() - 0.5) * 6; } // 草原的怪被打會逃跑
      return false;
    }
    return true;
  }
  // 打中的特效：白色衝擊星芒＋屬性粒子（草＝葉子、水＝水花、岩＝碎石、火＝火花、雷＝電光）
  hitBurst(at, el, crit) {
    const star = zglow('#ffffff', crit ? 2.6 : 1.6); star.position.copy(at); star.material.depthTest = false; star.renderOrder = 9; this.S.add(star);
    this.t.tween(crit ? 260 : 180, k => { star.scale.setScalar((crit ? 2.6 : 1.6) * (1 + k * 0.8)); star.material.opacity = 1 - k; }, 0, t => t, () => this.S.remove(star));
    if (crit) { const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.45, 28), basic('#ffe24a', { transparent: true, side: THREE.DoubleSide, depthWrite: false })); ring.position.copy(at); ring.lookAt(this.t.camera.position); this.S.add(ring); this.t.tween(300, k => { ring.scale.setScalar(1 + k * 4); ring.material.opacity = 1 - k; }, 0, t => t, () => this.S.remove(ring)); }
    const col = EL_COLOR[el] || '#ffffff', n = crit ? 16 : 9;
    for (let k = 0; k < n; k++) {
      const geo = el === 'rock' ? new THREE.DodecahedronGeometry(0.06 + Math.random() * 0.05, 0) : el === 'grass' ? new THREE.CircleGeometry(0.07, 5) : el === 'thunder' ? new THREE.BoxGeometry(0.03, 0.22, 0.03) : new THREE.SphereGeometry(0.05 + Math.random() * 0.04, 6, 4);
      const mat = el === 'rock' ? lam(col) : basic(k % 3 ? col : '#ffffff', { transparent: true, side: THREE.DoubleSide, blending: el === 'fire' || el === 'thunder' ? THREE.AdditiveBlending : THREE.NormalBlending });
      const d = new THREE.Mesh(geo, mat); d.position.copy(at); this.S.add(d); const a = Math.random() * 6.28, v = 1.5 + Math.random() * (crit ? 4 : 2.5);
      this.fx.push({ m: d, vx: Math.cos(a) * v, vz: Math.sin(a) * v, vy: (el === 'fire' ? 3 : 2) + Math.random() * 2.5, life: 0.5 + Math.random() * 0.4, g: el === 'fire' ? -2 : -9, spin: el === 'grass' || el === 'rock' || el === 'thunder' });
    }
  }
  // 打倒：說最後一句話 → 鼓起來 → 「啵！」煙霧和紙花 → 化成金光飛進玩家身體
  defeatMonster(m, toward) {
    m.alive = false; const g = m.g, K = { color: EL_COLOR[m.el] };
    this.say(m, m.sp.bye, m.top + 0.75, 900);
    m.mats.forEach(mt => mt.emissive.set('#ffffff'));
    this.t.tween(380, k => g.scale.setScalar(1 + k * 0.5), 0, t => t, () => {
      const p = g.position.clone(); p.y = 0.5;
      this.S.remove(g); this.monsters = this.monsters.filter(x => x !== m); this.t.tapTargets = this.t.tapTargets.filter(tt => tt[0] !== g);
      this.poof(p, K.color); this.absorb(p, toward);
      if (!m.summoned) setTimeout(() => this.spawnMonster(m.zi), 6000 + Math.random() * 6000);
    });
  }
  poof(p, color) {
    // 白色煙霧：幾團球往外膨脹變淡
    for (let k = 0; k < 9; k++) {
      const a = k / 9 * Math.PI * 2, puff = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), basic(k % 3 ? '#ffffff' : color, { transparent: true, opacity: 0.9, depthWrite: false }));
      puff.position.copy(p); this.S.add(puff);
      const dx = Math.cos(a) * 0.9, dz = Math.sin(a) * 0.9, dy = 0.2 + Math.random() * 0.6;
      this.t.tween(650, t => { puff.position.set(p.x + dx * t, p.y + dy * t, p.z + dz * t); puff.scale.setScalar(1 + t * 1.6); puff.material.opacity = 0.9 * (1 - t); }, 0, t => 1 - Math.pow(1 - t, 3), () => { this.S.remove(puff); puff.material.dispose(); });
    }
    // 中間一圈白光
    const flash = glowSprite('#ffffff', 0.5); flash.position.copy(p); this.S.add(flash);
    this.t.tween(350, t => { flash.scale.setScalar(0.5 + t * 3.5); flash.material.opacity = 1 - t; }, 0, t => t, () => this.S.remove(flash));
    // 彩色紙花
    const cols = ['#e8c15a', '#c8352b', '#5ad06a', '#4a8ad8', '#f2a0b8'];
    for (let k = 0; k < 18; k++) {
      const c = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.12), basic(cols[k % 5], { side: THREE.DoubleSide, transparent: true }));
      c.position.copy(p); c.position.y += 0.3; this.S.add(c); const a = Math.random() * 6.28, sp = 1.5 + Math.random() * 2;
      this.fx.push({ m: c, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: 3 + Math.random() * 2.5, life: 1.4, g: -7, spin: true });
    }
  }
  // 金光：一串光點從怪物飛向玩家，到了以後在玩家身上亮一下
  absorb(from, toward) {
    if (!toward) return;
    for (let k = 0; k < 8; k++) {
      const s = glowSprite('#ffd76a', 0.45); s.position.copy(from); this.S.add(s);
      const side = (Math.random() - 0.5) * 3, up = 1 + Math.random() * 1.5;
      this.t.tween(700, t => { const q = toward(); const ix = from.x + (q.x - from.x) * t, iz = from.z + (q.z - from.z) * t; s.position.set(ix + Math.sin(t * Math.PI) * side * 0.4, from.y + (1.1 - from.y) * t + Math.sin(t * Math.PI) * up, iz); s.material.opacity = 0.4 + t * 0.6; },
        250 + k * 60, t => t * t, () => {
          this.S.remove(s);
          if (k === 7) { const q = toward(), aura = glowSprite('#ffd76a', 1); aura.position.set(q.x, 1, q.z); this.S.add(aura); this.t.tween(500, t => { aura.scale.setScalar(1 + t * 2.2); aura.material.opacity = 1 - t; }, 0, t => t, () => this.S.remove(aura)); this.onAbsorb?.(); }
        });
    }
  }

  // ---------- 考試魔王：大家一起打，每天復活 ----------
  buildBoss() {
    const g = new THREE.Group(); g.position.set(BOSS_AT.x, 0, BOSS_AT.z); this.S.add(g); this.boss = g;
    const body = new THREE.Mesh(new THREE.SphereGeometry(1.5, 24, 18), lam('#5a3a8a')); body.scale.set(1, 0.85, 1); body.position.y = 1.3; g.add(body); this.bossBody = body;
    [-1, 1].forEach(s => {
      const w = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), lam('#ffffff')); w.position.set(0.5 * s, 1.75, 1.2); g.add(w);
      const pu = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), lam('#1a1412')); pu.position.set(0.5 * s, 1.72, 1.47); g.add(pu);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.09, 0.08), lam('#2a1a3a')); brow.position.set(0.5 * s, 2.1, 1.25); brow.rotation.z = -0.4 * s; g.add(brow);
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.6, 8), lam('#e8c15a')); horn.position.set(0.8 * s, 2.55, 0); horn.rotation.z = -0.4 * s; g.add(horn);
    });
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.06, 6, 14, Math.PI), lam('#2a1a3a')); mouth.position.set(0, 1.05, 1.3); g.add(mouth);
    // 考卷：魔王手上拿著寫滿紅字的考卷
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.1), basic('#fff', { map: canvasTex(128, 160, (c, W, H) => { c.fillStyle = '#fbf8ef'; c.fillRect(0, 0, W, H); c.fillStyle = '#c8241c'; c.font = '900 64px serif'; c.textAlign = 'center'; c.fillText('0', W / 2, 90); c.fillStyle = '#888'; for (let y = 110; y < 150; y += 12) c.fillRect(16, y, 96, 4); }), side: THREE.DoubleSide }));
    paper.position.set(1.55, 1.2, 0.6); paper.rotation.y = -0.5; g.add(paper); this.bossPaper = paper;
    this.bossPos = { x: BOSS_AT.x, z: BOSS_AT.z, tx: BOSS_AT.x, tz: BOSS_AT.z, t: 0, face: 0 };
    this.hpCanvas = document.createElement('canvas'); this.hpCanvas.width = 256; this.hpCanvas.height = 40;
    this.hpTex = new THREE.CanvasTexture(this.hpCanvas); this.hpTex.colorSpace = THREE.SRGBColorSpace;
    // 名字和血條只放在畫面上方的大血條（頭上的會被鏡頭切到）
    // 魔王不在時：原地立一塊牌子寫下次出現的時間
    this.bossSign = new THREE.Group(); this.bossSign.position.set(BOSS_AT.x, 0, BOSS_AT.z); this.bossSign.visible = false; this.S.add(this.bossSign);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.6), lam('#5a3a24')); post.position.y = 0.8; this.bossSign.add(post);
    this.t.tapTargets.push([g, () => this.t.emit('tapBoss')]);
    this.setBoss(120, 120, 0);
  }
  setBoss(hp, max, next) {
    const was = this.bossHp; this.bossHp = hp; this.bossMax = max; const g = this.hpCanvas.getContext('2d'), W = 256, H = 40;
    g.clearRect(0, 0, W, H); g.fillStyle = 'rgba(20,10,20,.85)'; g.beginPath(); g.roundRect(0, 0, W, H, 10); g.fill();
    g.fillStyle = '#e8402a'; g.beginPath(); g.roundRect(4, 4, (W - 8) * Math.max(0, hp / max), H - 8, 7); g.fill();
    g.fillStyle = '#fff'; g.font = '700 22px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(`${Math.max(0, hp)} / ${max}`, W / 2, H / 2 + 1);
    this.hpTex.needsUpdate = true;
    const down = hp <= 0;
    // 被打倒：跟小怪一樣炸開消失；新的一隻出現：從地上冒出來
    if (down && this.boss.visible) { if (was > 0 && this.ready) this.bossVanish(); else this.boss.visible = false; }
    if (!down && !this.boss.visible) this.bossAppear(this.ready);
    if (next && next !== this.bossNext) {
      this.bossNext = next; if (this.signTag) this.bossSign.remove(this.signTag);
      const t = new Date(next), hh = String(t.getHours()).padStart(2, '0'), mm = String(t.getMinutes()).padStart(2, '0');
      this.signTag = textSprite(`👹 下一隻魔王 ${hh}:${mm} 出現`, { w: 420, h: 72, font: 32, sx: 3, bg: 'rgba(60,20,80,.9)' }); this.signTag.position.y = 1.9; this.bossSign.add(this.signTag);
    }
    this.bossSign.visible = down;
    this.ready = true;
  }
  bossVanish() {
    const g = this.boss, b = this.bossBody; b.material.emissive.set('#ffffff');
    this.say({ g }, '可惡…我還會再來的！', 3.4, 900);
    this.t.tween(500, k => g.scale.setScalar(1 + k * 0.35), 0, t => t, () => { g.visible = false; g.scale.setScalar(1); b.material.emissive.set('#000000'); this.bossPoof(); });
  }
  bossAppear(anim) {
    const g = this.boss; g.visible = true; this.bossSign.visible = false;
    if (!anim) return;
    g.position.set(BOSS_AT.x, 0, BOSS_AT.z); Object.assign(this.bossPos, { x: BOSS_AT.x, z: BOSS_AT.z, tx: BOSS_AT.x, tz: BOSS_AT.z });
    g.scale.setScalar(0.01); this.poof(new THREE.Vector3(BOSS_AT.x, 0.6, BOSS_AT.z), '#5a3a8a');
    this.t.tween(900, k => g.scale.setScalar(0.01 + k * 0.99), 200, t => 1 - Math.pow(1 - t, 3));
    this.say({ g }, '哈哈哈！考試魔王來了！', 3.4, 2000);
  }
  hitBoss() {
    const b = this.bossBody; this.t.tween(250, k => { b.scale.set(1 + Math.sin(k * Math.PI) * 0.08, 0.85 - Math.sin(k * Math.PI) * 0.08, 1); });
    b.material.emissive.set('#ffffff'); setTimeout(() => b.material.emissive.set('#000000'), 110);
    if (Math.random() < 0.3) this.say({ g: this.boss }, BOSS_LINES[Math.floor(Math.random() * BOSS_LINES.length)], 3.4, 1600);
  }
  // 魔王被打倒：大爆炸
  bossPoof() { const p = new THREE.Vector3(this.boss.position.x, 1.4, this.boss.position.z); this.poof(p, '#5a3a8a'); setTimeout(() => this.poof(p.clone().setY(2.2), '#e8c15a'), 220); }

  // 考試魔王：在自己的地盤走來走去、跳一跳，身體轉向最近的玩家；血剩一半以下進入狂暴（變紅、變大、變快）
  get rage() { return this.bossHp > 0 && this.bossHp / (this.bossMax || 1) < 0.5; }
  updateBoss(dt, t) {
    const b = this.bossPos, g = this.boss, rage = this.rage, sp = rage ? 1.9 : 1.0;
    b.t += dt;
    if (Math.hypot(b.tx - b.x, b.tz - b.z) < 0.2 || b.t > (rage ? 2.5 : 4)) { b.t = 0; const a = Math.random() * 6.28, r = Math.random() * 4.5; b.tx = BOSS_AT.x + Math.cos(a) * r; b.tz = BOSS_AT.z + Math.sin(a) * r * 0.7; }
    const dx = b.tx - b.x, dz = b.tz - b.z, d = Math.hypot(dx, dz);
    if (d > 0.05) { b.x += dx / d * Math.min(d, dt * sp); b.z += dz / d * Math.min(d, dt * sp); }
    const near = this.nearestPlayer?.(b.x, b.z);
    const want = near ? Math.atan2(near.x - b.x, near.z - b.z) : Math.atan2(dx, dz);
    let df = want - b.face; df = Math.atan2(Math.sin(df), Math.cos(df)); b.face += df * Math.min(1, dt * 3);
    g.position.set(b.x, Math.abs(Math.sin(t * (rage ? 4 : 2.2))) * (rage ? 0.35 : 0.2), b.z); g.rotation.y = b.face;
    if (this.bossPaper) this.bossPaper.rotation.z = Math.sin(t * (rage ? 9 : 4)) * 0.35;
    const want2 = rage ? 1.22 : 1; g.scale.setScalar(g.scale.x + (want2 - g.scale.x) * Math.min(1, dt * 2));
    this.bossBody.material.color.set(rage ? '#b8302a' : '#5a3a8a');
  }
  // 魔王反擊：地上先出現紅圈（1.2 秒），然後一張考卷砸下來；砸完呼叫 done(落點)
  bossThrow(to, done) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.25, 32), basic('#e8402a', { transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(to.x, 0.05, to.z); this.S.add(ring);
    const fill = new THREE.Mesh(new THREE.CircleGeometry(1.0, 32), basic('#e8402a', { transparent: true, opacity: 0.25, depthWrite: false })); fill.rotation.x = -Math.PI / 2; fill.position.set(to.x, 0.04, to.z); this.S.add(fill);
    this.t.tween(1200, k => { fill.scale.setScalar(Math.max(0.01, k)); ring.material.opacity = 0.5 + Math.sin(k * 20) * 0.35; });
    this.say({ g: this.boss }, ['考卷來了！', '接招！隨堂考！', '這題送分喔～', '突襲小考！'][Math.floor(Math.random() * 4)], 3.4, 1200);
    const from = this.boss.position.clone(); from.y = 2.2;
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.9), basic('#fbf8ef', { side: THREE.DoubleSide })); this.S.add(paper);
    paper.position.copy(from);
    this.t.tween(1200, k => { paper.position.set(from.x + (to.x - from.x) * k, from.y + Math.sin(k * Math.PI) * 4 - (from.y - 0.2) * k, from.z + (to.z - from.z) * k); paper.rotation.set(k * 14, k * 9, 0); }, 0, t => t, () => {
      this.S.remove(paper); this.S.remove(ring); this.S.remove(fill); this.poof(new THREE.Vector3(to.x, 0.3, to.z), '#fbf8ef'); done?.(to);
    });
  }
  // 在某個位置叫出一隻拖延怪（魔王召喚用）
  spawnMonsterAt(x, z) { const m = this.spawnMonster(Math.max(0, zoneAt(z)), { x, z }); m.summoned = true; m.angry = 30; this.poof(new THREE.Vector3(x, 0.4, z), '#8a6ac8'); return m; }
  // 傷害數字：從目標頭上飄起來，爆擊用金色大字
  dmgText(pos, text, crit, color) {
    const s = textSprite(text, { w: 256, h: 80, font: crit ? 44 : 38, bg: 'rgba(0,0,0,0)', fg: color || (crit ? '#ffd23a' : '#ffffff'), sx: crit ? 1.9 : 1.3 });
    s.material.depthTest = false; s.renderOrder = 10; s.position.set(pos.x + (Math.random() - 0.5) * 0.6, (pos.y ?? 1.4), pos.z); this.S.add(s);
    const y0 = s.position.y;
    this.t.tween(900, k => { s.position.y = y0 + k * 1.3; s.material.opacity = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4; s.scale.multiplyScalar(k < 0.15 ? 1.04 : 1); }, 0, t => t, () => this.S.remove(s));
  }
  // 技能一：墨汁潑灑（往外擴散的墨圈和墨點）
  inkSplash(c, r) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.7, 40), basic('#1a1a2a', { transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(c.x, 0.06, c.z); this.S.add(ring);
    this.t.tween(600, k => { ring.scale.setScalar(1 + k * r * 1.5); ring.material.opacity = 0.85 * (1 - k); }, 0, t => 1 - Math.pow(1 - t, 2), () => this.S.remove(ring));
    for (let k = 0; k < 26; k++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.09 + Math.random() * 0.08, 6, 5), basic('#151522', { transparent: true }));
      d.position.set(c.x, 1, c.z); this.S.add(d); const a = Math.random() * 6.28, sp = 3 + Math.random() * 5;
      this.fx.push({ m: d, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: 3 + Math.random() * 3, life: 0.9, g: -12 });
    }
  }
  // 技能二：文昌光束（從玩家射向目標的一道金光）
  beam(from, to) {
    const a = new THREE.Vector3(from.x, 1.3, from.z), b = new THREE.Vector3(to.x, to.y ?? 1.2, to.z), len = a.distanceTo(b);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, len, 10, 1, true), basic('#ffe08a', { transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.copy(a).lerp(b, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); this.S.add(m);
    const glow = glowSprite('#ffe08a', 3); glow.position.copy(b); this.S.add(glow);
    this.t.tween(550, k => { m.scale.set(1 + k * 1.5, 1, 1 + k * 1.5); m.material.opacity = 0.95 * (1 - k); glow.scale.setScalar(3 + k * 3); glow.material.opacity = 1 - k; }, 0, t => t, () => { this.S.remove(m); this.S.remove(glow); });
  }
  // 技能三：金榜題名（一道道金色光柱從天而降）
  goldRain(points) {
    points.forEach((p, i) => {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 30, 12, 1, true), basic('#ffd76a', { transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      col.position.set(p.x, 15, p.z); this.S.add(col);
      this.t.tween(900, k => { col.material.opacity = Math.sin(k * Math.PI) * 0.8; col.scale.set(1 + k, 1, 1 + k); }, i * 70, t => t, () => { this.S.remove(col); this.stars(p.x, 0.8, p.z); });
    });
  }

  update(dt) {
    this.time += dt; const t = this.time;
    this.updateWheel();
    if (this.clouds) this.clouds.forEach((c, i) => { c.position.x += dt * (0.4 + (i % 3) * 0.2); if (c.position.x > 160) c.position.x = -160; });
    // 天燈慢慢往上飄，40 秒後消失
    for (let i = this.lanterns.length - 1; i >= 0; i--) {
      // t < 0：剛點燃，在面前浮著（慢慢往上一點點），讓人看清楚燈上的字
      const o = this.lanterns[i]; o.t += dt; o.g.position.y += dt * (o.t < 0 ? 0.12 : Math.min(0.9, 0.25 + o.t * 0.2)); o.g.position.x += Math.sin(t * 0.5 + o.ph) * dt * 0.3;
      o.body.rotation.y = o.base + Math.sin(t * 0.6 + o.ph) * 0.35; // 輕輕左右轉，字一直朝著前面
      const a = o.t > 30 ? Math.max(0, 1 - (o.t - 30) / 10) : 1; o.mats.forEach(m => { m.opacity = a; });
      if (o.t > 40) { this.S.remove(o.g); this.lanterns.splice(i, 1); o.body.material.map?.dispose(); }
    }
    // 錦鯉：繞圈游；有飼料就游過去
    if (this.food) { this.food.t -= dt; if (this.food.t <= 0) this.food = null; }
    for (const f of this.fish) {
      let tx, tz;
      if (this.food) { tx = this.food.x + Math.cos(f.a) * 0.4; tz = this.food.z + Math.sin(f.a) * 0.4; }
      else { f.a += dt * f.sp * 0.5; tx = KOI.x + Math.cos(f.a) * f.r; tz = KOI.z + Math.sin(f.a) * f.r * 0.8; }
      const dx = tx - f.x, dz = tz - f.z, d = Math.hypot(dx, dz), sp = Math.min(d, dt * (this.food ? 1.8 : 0.9));
      if (d > 0.01) { f.x += dx / d * sp; f.z += dz / d * sp; f.m.rotation.y = Math.atan2(dx, dz); }
      f.m.position.set(f.x, 0.05, f.z); if (f.m.userData.tail) f.m.userData.tail.rotation.y = Math.sin(t * 8 + f.a) * 0.5;
    }
    // 怪物：草原的會晃來晃去；其他區看到玩家會衝過來、蓄力、撲上來咬一口（交給 main.js 扣體力）
    tickZones(this, dt, t, this.player ? this.player.z : 0);
    const pl = this.player, safe = this.playerSafe?.() ?? false;
    for (const m of this.monsters) {
      if (!m.alive) continue; const p = m.g.position, dpl = pl ? Math.hypot(pl.x - p.x, pl.z - p.z) : 999;
      const vis = dpl < 62; if (m.g.visible !== vis) m.g.visible = vis; if (!vis) continue;
      m.t += dt; m.angry = Math.max(0, m.angry - dt);
      if (m.stun > 0) { m.stun -= dt; continue; }
      const home = Math.hypot(p.x - m.home.x, p.z - m.home.z), hostile = (m.zi > 0 || m.summoned) && !safe;
      if (hostile && pl && (dpl < (m.chase ? 11 : 6.5) || (m.angry > 0 && dpl < 14)) && home < 20) m.chase = true; else if (m.chase && (dpl > 13 || home > 22 || safe)) { m.chase = false; m.tx = m.home.x; m.tz = m.home.z; m.wind = 0; }
      let speed = 0.8, face = null;
      if (m.chase) {
        face = Math.atan2(pl.x - p.x, pl.z - p.z);
        if (m.wind > 0) {           // 蓄力：身體往下壓、發紅光，0.5 秒後撲上來
          m.wind -= dt; const k = 1 - m.wind / 0.5; m.body.scale.set(m.size * (1 + k * 0.18), m.size * (1 - k * 0.22), m.size * (1 + k * 0.18));
          m.mats.forEach(mt => mt.emissive.setRGB(0.25 + k * 0.45, 0.02, 0)); speed = 0;
          if (m.wind <= 0) {
            m.mats.forEach(mt => mt.emissive.copy(mt.userData.e0)); m.body.scale.setScalar(m.size);
            const sx = p.x, sz = p.z, ux = Math.sin(face), uz = Math.cos(face); this.t.tween(180, k => { const q = Math.sin(k * Math.PI); p.x = sx + ux * q * 0.7; p.z = sz + uz * q * 0.7; p.y = q * 0.35; });
            setTimeout(() => { if (m.alive && pl && Math.hypot(pl.x - p.x, pl.z - p.z) < 2.1) this.onMonsterHit?.(m); }, 90);
            m.cd = 1.5 + Math.random() * 0.8;
          }
        } else if (dpl > 1.35) { m.tx = pl.x; m.tz = pl.z; speed = 1.7 + m.zi * 0.12; }
        else { speed = 0; m.cd -= dt; if (m.cd <= 0) m.wind = 0.5; }
      } else if (Math.hypot(m.tx - p.x, m.tz - p.z) < 0.2 || m.t > 6) { m.t = 0; for (let k = 0; k < 10; k++) { const a = Math.random() * 6.28, r = 2 + Math.random() * 4, nx = p.x + Math.cos(a) * r, nz = p.z + Math.sin(a) * r; if (inZone(nx, nz, m.zi) && Math.hypot(nx - m.home.x, nz - m.home.z) < 12) { m.tx = nx; m.tz = nz; break; } } }
      const dx = m.tx - p.x, dz = m.tz - p.z, d = Math.hypot(dx, dz);
      if (speed && d > 0.05) { const st = Math.min(d, dt * speed); p.x += dx / d * st; p.z += dz / d * st; face = face ?? Math.atan2(dx, dz); }
      if (face != null) { let df = face - m.g.rotation.y; df = Math.atan2(Math.sin(df), Math.cos(df)); m.g.rotation.y += df * Math.min(1, dt * 8); }
      // 走路一跳一跳；部位擺動
      if (m.wind <= 0) { const hop = m.chase ? 7 : 4; p.y = Math.abs(Math.sin(t * hop + m.ph)) * (m.chase ? 0.16 : 0.1); m.body.rotation.z = Math.sin(t * hop + m.ph) * 0.06; }
      const P = m.P, s1 = Math.sin(t * 3 + m.ph);
      P.ears?.forEach((e, i) => { e.rotation.x = s1 * 0.15 * (i ? 1 : -1); });
      if (P.tail) P.tail.rotation.y = Math.sin(t * 5 + m.ph) * 0.3;
      P.tails?.forEach((tl, i) => { tl.rotation.z = Math.sin(t * 4 + i) * 0.25; tl.children[1] && (tl.children[1].scale.y = 1 + Math.sin(t * 14 + i * 2) * 0.15); });
      P.wings?.forEach((w, i) => { w.rotation.x = Math.sin(t * (m.chase ? 14 : 6) + m.ph) * 0.35 * (i ? 1 : -1); });
      P.bubbles?.forEach((b, i) => { b.position.set(Math.cos(t * 1.4 + i * 2.1) * (i ? 0.4 : 0.3), 1.05 + Math.sin(t * 2 + i) * 0.08 + i * 0.12, Math.sin(t * 1.4 + i * 2.1) * (i ? 0.4 : 0.1)); });
      P.sparks?.forEach((sp, i) => { const a = t * 5 + i * 2.1; sp.position.set(Math.cos(a) * 0.55, 0.7 + Math.sin(a * 1.7) * 0.25, Math.sin(a) * 0.55); sp.material.opacity = Math.random() < 0.15 ? 0.2 : 1; });
      if (P.mane) P.mane.rotation.y += dt * 1.5;
      if (P.aura) { const k = 0.3 + Math.sin(t * 3 + m.ph) * 0.1; P.aura.material.opacity = k; }
      if (P.cape) P.cape.forEach((c2, i) => { c2.rotation.x = Math.sin(t * 3 + i) * 0.15; });
      m.fxs.forEach(f => { if (f.parent?.parent === m.body && !P.sparks?.includes(f)) f.material.opacity = 0.7 + Math.random() * 0.3; });
    }
    // 寶物：轉圈、上下浮動
    for (const o of this.treasures) if (o.g.visible) { o.m.rotation.y += dt * 1.5; o.g.position.y = 0.5 + Math.sin(t * 2 + o.x) * 0.1; }
    if (this.boss && this.bossHp > 0 && this.boss.visible) this.updateBoss(dt, t);
    // 粒子（水滴、星星、飼料）
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i]; f.life -= dt;
      if (f.vx) { f.m.position.x += f.vx * dt; f.m.position.z += f.vz * dt; }
      if (f.spin) { f.m.rotation.x += dt * 9; f.m.rotation.y += dt * 7; f.vx *= 0.98; f.vz *= 0.98; }
      if (f.g) { f.vy += f.g * dt; f.m.position.y = Math.max(0.03, f.m.position.y + f.vy * dt); }
      if (f.m.material?.transparent) f.m.material.opacity = Math.min(1, f.life * 2);
      if (f.life <= 0) { this.S.remove(f.m); this.fx.splice(i, 1); }
    }
  }
}

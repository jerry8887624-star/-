// 廟門外的樹林：金榜樹林、天燈廣場、錦鯉池、每日尋寶、拖延怪與考試魔王
import * as THREE from '../vendor/three.module.min.js';
import { L } from './scene.js';

const lam = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });
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
const glowSprite = (color = '#ffd76a', size = 1) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.scale.set(size, size, 1); return s; };

// 位置
export const KOI = { x: 16, z: 45, r: 4 };
export const BOSS_AT = { x: 0, z: 47.5 };
export const PLOTS = [];
for (let r = 0; r < 8; r++) for (let c = 0; c < 6; c++) PLOTS.push({ x: -26 + c * 3.6, z: 25 + r * 3.6 });
export const OUT_SPOTS = {
  grove: { x: -9.5, z: 23.2, f: Math.PI },
  sky: { x: 14, z: 30, f: 0 },
  koi: { x: 16, z: 39.6, f: 0 },
  boss: { x: 0, z: 42.5, f: 0 },
  forest: { x: 0, z: 34, f: 0 },
};
export const OUT_MARKS = [
  { id: 'grove', name: '金榜樹林', pos: [-17, 3.4, 23.2] },
  { id: 'sky', name: '天燈廣場', pos: [14, 3.2, 27] },
  { id: 'koi', name: '錦鯉池', pos: [16, 2.6, 45] },
  { id: 'boss', name: '考試魔王', pos: [0, 4.8, 47.5] },
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
const inArea = (x, z) => x > -L.FW + 1.5 && x < L.FW - 1.5 && z > L.GZ + 2.5 && z < L.FZ - 1 && Math.hypot(x - KOI.x, z - KOI.z) > KOI.r + 1.2 && Math.hypot(x - BOSS_AT.x, z - BOSS_AT.z) > 3;

export class Outside {
  constructor(t) {
    this.t = t; this.S = t.scene; this.time = 0;
    this.trees = []; this.lanterns = []; this.fish = []; this.food = null; this.monsters = []; this.treasures = []; this.fx = [];
    this.buildLand(); this.buildGrove(); this.buildSky(); this.buildKoi(); this.buildBoss();
    for (let i = 0; i < 6; i++) this.spawnMonster();
    t.updaters.push(dt => this.update(dt));
    // 鏡頭不要鑽進樹冠裡
    t.camHit = v => v.z > L.GZ && v.y < 6 && this.treeSpots.some(([x, z, r]) => Math.hypot(v.x - x, v.z - z) < r);
  }

  // ---------- 地面、步道、四周的樹 ----------
  buildLand() {
    const S = this.S, z0 = L.GZ + 0.5, depth = L.FZ - z0 + 2;
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(L.FW * 2 + 4, depth), lam('#6f9a4a')); grass.rotation.x = -Math.PI / 2; grass.position.set(0, 0.004, z0 + depth / 2); S.add(grass);
    this.t.ground.push(grass);
    const path = new THREE.Mesh(new THREE.PlaneGeometry(3, depth), lam('#c9b48a')); path.rotation.x = -Math.PI / 2; path.position.set(0, 0.008, z0 + depth / 2); S.add(path);
    const cross = new THREE.Mesh(new THREE.PlaneGeometry(L.FW * 2 - 6, 2.4), lam('#c9b48a')); cross.rotation.x = -Math.PI / 2; cross.position.set(0, 0.008, 36.5); S.add(cross);
    // 四周的樹（樹林邊界）
    const trunkM = lam('#5a3a24'), leafM = [lam('#4f7a3a', { flatShading: true }), lam('#5f8a3a', { flatShading: true }), lam('#3f6a35', { flatShading: true })];
    this.treeSpots = [];
    const tree = (x, z, s = 1) => {
      this.treeSpots.push([x, z, 1.7 * s]);
      const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s);
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 2.2, 7), trunkM); tr.position.y = 1.1; g.add(tr);
      [[0, 2.8, 0, 1.4], [0.7, 2.4, 0.3, 1], [-0.6, 2.5, -0.2, 1.05], [0, 3.6, 0, 0.9]].forEach(([a, b, c, r], i) => { const l = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), leafM[i % 3]); l.position.set(a, b, c); g.add(l); });
      S.add(g);
    };
    for (let z = 24; z <= L.FZ + 2; z += 4.2) { tree(-L.FW - 1.5, z, 1.1); tree(L.FW + 1.5, z + 2, 1.15); }
    for (let x = -L.FW; x <= L.FW; x += 4.5) tree(x + (Math.abs(x) < 3 ? 4 : 0), L.FZ + 2, 1.2);
    [[22, 24.5], [27, 31], [23, 51.5]].forEach(([x, z]) => tree(x, z, 0.9));
    // 指示牌
    const sign = (x, z, text, ry = 0) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; S.add(g);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6), trunkM); post.position.y = 0.8; g.add(post);
      const tex = canvasTex(256, 80, (c, W, H) => { c.fillStyle = '#6a3a22'; c.fillRect(0, 0, W, H); c.strokeStyle = '#e8c15a'; c.lineWidth = 4; c.strokeRect(4, 4, W - 8, H - 8); c.fillStyle = '#f6dc94'; c.font = '700 36px "Noto Serif TC",serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, W / 2, H / 2 + 2); });
      [0, Math.PI].forEach(r => { const b = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.44), basic('#fff', { map: tex })); b.position.y = 1.55; b.rotation.y = r; b.position.z = r ? -0.03 : 0.03; g.add(b); });
    };
    sign(-4, 22.6, '← 金榜樹林'); sign(4, 22.6, '天燈廣場 →'); sign(4.5, 38.4, '錦鯉池 →'); sign(-2.2, 42, '↓ 考試魔王');
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
  releaseLantern(x, z) {
    const g = new THREE.Group(); g.position.set(x, 1.6, z);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.24, 0.62, 10, 1, true), basic('#ffb04a', { side: THREE.DoubleSide, transparent: true }));
    g.add(body); const top = new THREE.Mesh(new THREE.CircleGeometry(0.32, 10), basic('#ff9a3a', { transparent: true })); top.rotation.x = -Math.PI / 2; top.position.y = 0.31; g.add(top);
    const glow = glowSprite('#ffb050', 1.6); g.add(glow);
    this.S.add(g); this.lanterns.push({ g, t: 0, ph: Math.random() * 6, mats: [body.material, top.material, glow.material] });
    if (this.lanterns.length > 40) { const o = this.lanterns.shift(); this.S.remove(o.g); }
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

  // ---------- 拖延怪 ----------
  spawnMonster() {
    let x, z, tries = 0; do { x = (Math.random() - 0.5) * (L.FW * 2 - 6); z = L.GZ + 4 + Math.random() * (L.FZ - L.GZ - 6); } while (!inArea(x, z) && ++tries < 30);
    const kind = Math.floor(Math.random() * MONSTER_KINDS.length), K = MONSTER_KINDS[kind];
    const g = new THREE.Group(); g.position.set(x, 0, z); this.S.add(g);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), lam(K.color)); body.scale.set(1, kind === 0 ? 0.75 : 0.9, 1); body.position.y = 0.42; g.add(body);
    [-1, 1].forEach(s => {
      const w = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), lam('#ffffff')); w.position.set(0.15 * s, 0.55, 0.38); g.add(w);
      const pu = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), lam('#1a1412')); pu.position.set(0.15 * s, kind === 3 ? 0.52 : 0.55, 0.47); if (kind === 3) pu.scale.y = 0.3; g.add(pu);
      const ft = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), lam(K.color)); ft.scale.set(1, 0.5, 1.3); ft.position.set(0.2 * s, 0.05, 0.1); g.add(ft);
    });
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.015, 4, 10, Math.PI), lam('#3a1a14')); mouth.position.set(0, 0.36, 0.43); if (kind !== 2) mouth.rotation.z = Math.PI; g.add(mouth);
    if (kind === 1) { const ph = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.26, 0.03), lam('#202428')); ph.position.set(0.35, 0.4, 0.3); ph.rotation.x = -0.4; g.add(ph); const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.21), basic('#7ad0ff')); sc.position.set(0.35, 0.41, 0.317); sc.rotation.x = -0.4; g.add(sc); }
    if (kind === 2) { const sw = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), lam('#8ad0ff')); sw.scale.y = 1.5; sw.position.set(0.32, 0.72, 0.25); g.add(sw); }
    if (kind === 3) { const cap = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.45, 10), lam('#3a5a9a')); cap.position.set(0, 0.92, -0.05); cap.rotation.z = 0.5; g.add(cap); const pom = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), lam('#ffffff')); pom.position.set(0.2, 1.07, -0.05); g.add(pom); }
    if (kind === 0) [-1, 1].forEach(s => { const h = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 6), lam('#5a4a8a')); h.position.set(0.2 * s, 0.78, 0); g.add(h); });
    const tag = textSprite(K.name, { sx: 1.1, bg: 'rgba(60,30,80,.8)' }); tag.position.y = 1.42; g.add(tag);
    // 頭上的小血條
    const hc = document.createElement('canvas'); hc.width = 128; hc.height = 20; const ht = new THREE.CanvasTexture(hc); ht.colorSpace = THREE.SRGBColorSpace;
    const hpBar = new THREE.Sprite(new THREE.SpriteMaterial({ map: ht, depthWrite: false })); hpBar.scale.set(0.9, 0.14, 1); hpBar.position.y = 1.17; g.add(hpBar);
    const mats = []; g.traverse(o => { if (o.isMesh && o.material?.emissive) mats.push(o.material); });
    const m = { g, kind, name: K.name, say: K.say, x, z, tx: x, tz: z, t: Math.random() * 5, alive: true, hp: K.hp, max: K.hp, hc, ht, mats };
    this.drawHp(m);
    this.monsters.push(m); this.t.tapTargets.push([g, () => this.t.emit('tapMonster', m)]);
    g.scale.setScalar(0.01); this.t.tween(500, k => g.scale.setScalar(0.01 + k * 0.99));
    return m;
  }
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
    g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 2; for (let i = 1; i < m.max; i++) { const x = 3 + (W - 6) * i / m.max; g.beginPath(); g.moveTo(x, 3); g.lineTo(x, H - 3); g.stroke(); }
    m.ht.needsUpdate = true;
  }
  // 怪物頭上冒出一句話（對話泡泡）
  say(obj, text, y = 1.75, ms = 1300) {
    if (obj.bubble) obj.g.remove(obj.bubble);
    const b = textSprite(text, { w: 320, h: 64, font: 30, bg: 'rgba(255,250,240,.95)', fg: '#3a2410', sx: 1.6 }); b.position.y = y; obj.g.add(b); obj.bubble = b;
    clearTimeout(obj.bubbleT); obj.bubbleT = setTimeout(() => { if (obj.bubble === b) { obj.g.remove(b); obj.bubble = null; } }, ms);
  }
  // 打中：閃白、被打得一縮、扣一格血；回傳是不是打倒了
  damage(m) {
    if (!m.alive) return false;
    m.hp -= 1; this.drawHp(m);
    m.mats.forEach(mt => mt.emissive.set('#ffffff')); setTimeout(() => m.mats.forEach(mt => mt.emissive.set('#000000')), 110);
    const g = m.g; this.t.tween(260, k => { const s = Math.sin(k * Math.PI); g.scale.set(1 + s * 0.25, 1 - s * 0.25, 1 + s * 0.25); });
    if (m.hp > 0) { const K = MONSTER_KINDS[m.kind]; this.say(m, K.hit[(m.max - m.hp - 1) % K.hit.length]); m.tx = g.position.x + (Math.random() - 0.5) * 6; m.tz = g.position.z + (Math.random() - 0.5) * 6; return false; }
    return true;
  }
  // 打倒：說最後一句話 → 鼓起來 → 「啵！」煙霧和紙花 → 化成金光飛進玩家身體
  defeatMonster(m, toward) {
    m.alive = false; const g = m.g, K = MONSTER_KINDS[m.kind];
    this.say(m, K.bye, 1.75, 900);
    m.mats.forEach(mt => mt.emissive.set('#ffffff'));
    this.t.tween(380, k => g.scale.setScalar(1 + k * 0.5), 0, t => t, () => {
      const p = g.position.clone(); p.y = 0.5;
      this.S.remove(g); this.monsters = this.monsters.filter(x => x !== m); this.t.tapTargets = this.t.tapTargets.filter(tt => tt[0] !== g);
      this.poof(p, K.color); this.absorb(p, toward);
      setTimeout(() => this.spawnMonster(), 6000 + Math.random() * 6000);
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
    paper.position.set(1.55, 1.2, 0.6); paper.rotation.y = -0.5; g.add(paper);
    this.bossTag = textSprite('考試魔王', { sx: 2, bg: 'rgba(90,30,120,.88)' }); this.bossTag.position.y = 3.6; g.add(this.bossTag);
    this.hpCanvas = document.createElement('canvas'); this.hpCanvas.width = 256; this.hpCanvas.height = 40;
    this.hpTex = new THREE.CanvasTexture(this.hpCanvas); this.hpTex.colorSpace = THREE.SRGBColorSpace;
    const hp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.hpTex, depthWrite: false })); hp.scale.set(2.4, 0.375, 1); hp.position.y = 3.15; g.add(hp);
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
    this.say({ g }, '可惡…我還會再來的！', 4.1, 900);
    this.t.tween(500, k => g.scale.setScalar(1 + k * 0.35), 0, t => t, () => { g.visible = false; g.scale.setScalar(1); b.material.emissive.set('#000000'); this.bossPoof(); });
  }
  bossAppear(anim) {
    const g = this.boss; g.visible = true; this.bossSign.visible = false;
    if (!anim) return;
    g.scale.setScalar(0.01); this.poof(new THREE.Vector3(BOSS_AT.x, 0.6, BOSS_AT.z), '#5a3a8a');
    this.t.tween(900, k => g.scale.setScalar(0.01 + k * 0.99), 200, t => 1 - Math.pow(1 - t, 3));
    this.say({ g }, '哈哈哈！考試魔王來了！', 4.1, 2000);
  }
  hitBoss() {
    const b = this.bossBody; this.t.tween(250, k => { b.scale.set(1 + Math.sin(k * Math.PI) * 0.08, 0.85 - Math.sin(k * Math.PI) * 0.08, 1); });
    b.material.emissive.set('#ffffff'); setTimeout(() => b.material.emissive.set('#000000'), 110);
    if (Math.random() < 0.35) this.say({ g: this.boss }, BOSS_LINES[Math.floor(Math.random() * BOSS_LINES.length)], 4.1, 1600);
  }
  // 魔王被打倒：大爆炸
  bossPoof() { const p = new THREE.Vector3(BOSS_AT.x, 1.4, BOSS_AT.z); this.poof(p, '#5a3a8a'); setTimeout(() => this.poof(p.clone().setY(2.2), '#e8c15a'), 220); }

  update(dt) {
    this.time += dt; const t = this.time;
    // 天燈慢慢往上飄，40 秒後消失
    for (let i = this.lanterns.length - 1; i >= 0; i--) {
      const o = this.lanterns[i]; o.t += dt; o.g.position.y += dt * 0.9; o.g.position.x += Math.sin(t * 0.5 + o.ph) * dt * 0.3;
      const a = o.t > 30 ? Math.max(0, 1 - (o.t - 30) / 10) : 1; o.mats.forEach(m => { m.opacity = a; });
      if (o.t > 40) { this.S.remove(o.g); this.lanterns.splice(i, 1); }
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
    // 拖延怪：慢慢晃來晃去，上下彈
    for (const m of this.monsters) {
      if (!m.alive) continue; m.t += dt; const p = m.g.position;
      if (Math.hypot(m.tx - p.x, m.tz - p.z) < 0.2 || m.t > 6) { m.t = 0; for (let k = 0; k < 10; k++) { const a = Math.random() * 6.28, r = 2 + Math.random() * 4, nx = p.x + Math.cos(a) * r, nz = p.z + Math.sin(a) * r; if (inArea(nx, nz)) { m.tx = nx; m.tz = nz; break; } } }
      const dx = m.tx - p.x, dz = m.tz - p.z, d = Math.hypot(dx, dz);
      if (d > 0.05) { p.x += dx / d * dt * 0.8; p.z += dz / d * dt * 0.8; m.g.rotation.y = Math.atan2(dx, dz); }
      p.y = Math.abs(Math.sin(t * 4 + m.kind)) * 0.12; if (m.kind === 2) p.x += Math.sin(t * 40) * 0.01;
    }
    // 寶物：轉圈、上下浮動
    for (const o of this.treasures) if (o.g.visible) { o.m.rotation.y += dt * 1.5; o.g.position.y = 0.5 + Math.sin(t * 2 + o.x) * 0.1; }
    if (this.boss && this.bossHp > 0 && this.boss.visible) this.boss.position.y = Math.abs(Math.sin(t * 1.5)) * 0.1;
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

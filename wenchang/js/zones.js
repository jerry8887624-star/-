// 廟外的五個練功區（由近到遠越來越強）、原創怪物（3D 卡通＋粗黑描邊）、傳送石碑、茶亭、文具鋪、木人樁與擂台
import * as THREE from '../vendor/three.module.min.js';

// ---------- 小工具（跟 outside.js 同一種卡通畫風） ----------
let _grad;
function toonGrad() {
  if (_grad) return _grad;
  _grad = new THREE.DataTexture(new Uint8Array([120, 195, 255]), 3, 1, THREE.RedFormat);
  _grad.minFilter = _grad.magFilter = THREE.NearestFilter; _grad.needsUpdate = true; return _grad;
}
const lam = (c, extra = {}) => new THREE.MeshToonMaterial({ color: c, gradientMap: toonGrad(), ...extra });
const basic = (c, extra = {}) => new THREE.MeshBasicMaterial({ color: c, ...extra });
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
export function textSprite(text, { w = 320, h = 64, font = 30, bg = 'rgba(36,20,14,.82)', fg = '#fff4d6', sx = 1.5 } = {}) {
  const tex = canvasTex(w, h, (g, W, H) => { g.fillStyle = bg; g.beginPath(); g.roundRect(2, 2, W - 4, H - 4, H / 2 - 2); g.fill(); g.fillStyle = fg; g.font = `700 ${font}px "Noto Serif TC",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, W / 2, H / 2 + 2); });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false })); s.scale.set(sx, sx * h / w, 1); return s;
}
let _glow;
function glowTex() {
  if (_glow) return _glow;
  _glow = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  return _glow;
}
export const glow = (color = '#ffd76a', size = 1) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.scale.set(size, size, 1); return s; };

// 粗黑描邊：把同一個形狀沿法線往外推一點、只畫背面（卡通「外框」做法）
const OUTLINE = new THREE.ShaderMaterial({
  uniforms: { w: { value: 0.035 } },
  vertexShader: 'uniform float w; void main(){ vec3 p = position + normalize(normal) * w; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
  fragmentShader: 'void main(){ gl_FragColor = vec4(0.11, 0.07, 0.06, 1.0); }',
  side: THREE.BackSide,
});
const OUTLINE_THIN = OUTLINE.clone(); OUTLINE_THIN.uniforms = { w: { value: 0.02 } };

// ---------- 五個區域 ----------
// z0～z1：區域範圍（往廟外越走越遠）；lv：怪物等級範圍；el：這區怪物的屬性
export const ZONES = [
  { id: 'meadow', name: '廟口草原', lv: [1, 5], z0: 20, z1: 58, el: 'grass', ground: '#7cc456', tip: '新手區：怪物不會主動攻擊' },
  { id: 'bamboo', name: '竹林書徑', lv: [5, 10], z0: 58, z1: 82, el: 'water', ground: '#5fae52', tip: '怪物看到你會衝過來' },
  { id: 'rock', name: '岩石山谷', lv: [10, 15], z0: 82, z1: 106, el: 'rock', ground: '#b4a383', tip: '皮很硬，記得去文具鋪換好筆' },
  { id: 'lava', name: '熔岩火山', lv: [15, 20], z0: 106, z1: 128, el: 'fire', ground: '#6a4a40', tip: '攻擊很痛，體力不夠先去茶亭' },
  { id: 'thunder', name: '雷雲山頂', lv: [20, 28], z0: 128, z1: 152, el: 'thunder', ground: '#8e8aac', tip: '考試魔王就住在山頂' },
];
export const WORLD = { FW: 56, FZ: 152 };
export const zoneAt = z => { for (let i = ZONES.length - 1; i >= 0; i--) if (z >= ZONES[i].z0) return i; return -1; };
// 各區入口：牌樓、傳送石碑、茶亭
export const STELES = ZONES.map((Z, i) => ({ i, x: 4.6, z: Z.z0 + (i ? 3.2 : 18) }));
export const TEAS = ZONES.map((Z, i) => i ? { i, x: -7, z: Z.z0 + 6 } : { i, x: -5, z: 42 });
export const SHOP = { x: 9, z: 53.5 };
export const DUMMY = { x: -4.6, z: 47.6 };
export const ARENA = { x: 0, z: 51.5, r: 3.4 };
export const BOSS_HOME = { x: 0, z: 143 };
// 不能穿過的東西（圓形：x, z, 半徑），交給 scene.js 的碰撞
export const ZONE_COLLIDERS = [];
// 高高的柱子：鏡頭和角色中間有這些就拉近（不然整個畫面被柱子擋住）
export const CAM_POSTS = [];

// ---------- 原創怪物：五個屬性，每種有一般型和進化型（進化型更大、更華麗） ----------
// 參考 Q 版、粗描邊的風格自己設計，不是任何現有遊戲的角色
export const SPECIES = {
  grass: [
    { name: '葉兜兔', color: '#8ed16a', say: '等一下再讀…', hit: ['哎呀！', '明天再讀嘛～', '別催我啦！'], bye: '我不拖了～' },
    { name: '花冠兔', color: '#79c454', say: '再休息五分鐘', hit: ['花瓣掉了！', '好痛喔～', '我的花冠！'], bye: '好啦去讀書…' },
  ],
  water: [
    { name: '泡泡獺', color: '#4fa8d8', say: '再滑一下手機', hit: ['泡泡破了！', '咕嚕咕嚕！', '電量剩 1%…'], bye: '手機還你啦！' },
    { name: '浪花獺', color: '#2f7fd0', say: '追劇追到天亮', hit: ['浪打過來！', '下一集就好！', '嘩啦！'], bye: '不追劇了…' },
  ],
  rock: [
    { name: '石丸穿山甲', color: '#a08a6a', say: '這題好難不想寫', hit: ['殼很硬喔！', '鏘！', '滾開～'], bye: '我…我寫就是了' },
    { name: '岩鎧穿山甲', color: '#7a6a58', say: '我就是不想動', hit: ['岩鎧裂了！', '你很有力氣嘛', '哼！'], bye: '動起來了…' },
  ],
  fire: [
    { name: '炭丸狸', color: '#3c3844', say: '完蛋了完蛋了', hit: ['好燙！', '心跳好快！', '別緊張…是我緊張'], bye: '深呼吸…放鬆了～' },
    { name: '焰尾狸', color: '#2e2a36', say: '考不好怎麼辦', hit: ['火大了喔！', '尾巴燒起來！', '哇啊！'], bye: '冷靜下來了…' },
  ],
  thunder: [
    { name: '雷丸鴞', color: '#f2cf3a', say: '好睏…眼睛睜不開', hit: ['霹哩！', '醒了醒了！', '嗚嗚～'], bye: '今天早點睡…' },
    { name: '霹靂鴞', color: '#7a5ad8', say: '熬夜才有效率！', hit: ['雷聲大作！', '你怎麼還醒著', '轟！'], bye: '規律作息最重要' },
  ],
};
export const EL_COLOR = { grass: '#7ad04a', water: '#5ac0ff', rock: '#c8a070', fire: '#ff7a2a', thunder: '#ffe24a' };

// 等級 → 能力值（hp：要扣多少血；atk：打你一下多痛；xp、coin：打倒拿到的）
export const monStats = lv => ({ hp: Math.round(3 + lv * 2 + lv * lv * 0.06), atk: Math.round(2 + lv * 1.5), xp: 6 + lv * 3, coin: 2 + lv * 2 });

function part(g, geo, color, o = {}) {
  const mat = typeof color === 'string' ? lam(color, o.emissive ? { emissive: o.emissive } : {}) : color;
  const m = new THREE.Mesh(geo, mat);
  m.position.set(o.x || 0, o.y || 0, o.z || 0); m.scale.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1); m.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0);
  if (o.ol !== false) m.add(new THREE.Mesh(geo, o.thin ? OUTLINE_THIN : OUTLINE));
  g.add(m); return m;
}
const S = (r, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h);
const C = (r, h, s = 10) => new THREE.ConeGeometry(r, h, s);
// 大眼睛：白眼球＋深色瞳孔＋亮點（附圖那種水汪汪的 Q 版眼）
function eyes(g, y, z, dx, r = 0.11, opt = {}) {
  [-1, 1].forEach(s => {
    part(g, S(r, 14, 10), opt.white || '#ffffff', { x: dx * s, y, z, sz: 0.6, thin: true });
    part(g, S(r * 0.62, 12, 8), opt.pupil || '#1e1a24', { x: dx * s + 0.01 * s, y: y - 0.01, z: z + r * 0.42, sz: 0.5, ol: false });
    part(g, S(r * 0.22, 8, 6), '#ffffff', { x: dx * s + r * 0.25, y: y + r * 0.3, z: z + r * 0.62, ol: false, emissive: '#ffffff' });
    if (opt.angry) part(g, new THREE.BoxGeometry(r * 2, r * 0.35, r * 0.4), '#1e1a24', { x: dx * s, y: y + r * 1.15, z: z + 0.02, rz: -0.45 * s, ol: false });
  });
}
const feet = (g, col, dx = 0.2, s = 1) => [-1, 1].forEach(k => part(g, S(0.12 * s, 10, 8), col, { x: dx * k, y: 0.06, z: 0.12, sy: 0.55, sz: 1.3 }));

// 建出一隻怪物的模型；回傳 { g（整隻）, parts（會動的部位）, fx（發光特效） }
export function buildMonster(el, evo) {
  const g = new THREE.Group(), P = {}, fxs = [];
  const sp = SPECIES[el][evo ? 1 : 0], c = sp.color;
  if (el === 'grass') {
    part(g, S(0.48), c, { y: 0.48, sy: 0.92, sz: 0.95 });
    part(g, S(0.3), '#f4f7e6', { y: 0.4, z: 0.26, sz: 0.5, ol: false });
    P.ears = [-1, 1].map(s => { const e = part(g, S(0.12), c, { x: 0.18 * s, y: 0.98, z: -0.02, sy: 3.0, sz: 0.7, rz: -0.22 * s }); part(e, S(0.07), '#f2a0b8', { z: 0.05, sy: 0.85, ol: false }); return e; });
    part(g, S(0.24), '#3f9a3a', { y: 0.93, z: 0.05, sx: 1.5, sy: 0.25, rx: -0.3 }); // 葉子帽
    part(g, new THREE.CylinderGeometry(0.02, 0.02, 0.16), '#2f7a2a', { y: 1.03, z: 0.02, ol: false });
    part(g, S(0.1), '#ffffff', { y: 0.35, z: -0.46 });
    eyes(g, 0.56, 0.38, 0.17); feet(g, c);
    part(g, S(0.05, 8, 6), '#f28aa0', { x: -0.3, y: 0.42, z: 0.35, ol: false }); part(g, S(0.05, 8, 6), '#f28aa0', { x: 0.3, y: 0.42, z: 0.35, ol: false });
    if (evo) {
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; part(g, S(0.09), i % 2 ? '#ff9ac0' : '#ffd0e0', { x: Math.cos(a) * 0.2, y: 1.02, z: Math.sin(a) * 0.2 + 0.02, sy: 0.6 }); }
      part(g, S(0.07), '#ffd84a', { y: 1.06, z: 0.02 });
      P.cape = [-1, 1].map(s => part(g, S(0.28), '#4caf50', { x: 0.25 * s, y: 0.55, z: -0.35, sx: 0.5, sy: 1.2, sz: 0.25, ry: 0.5 * s }));
    }
  } else if (el === 'water') {
    part(g, S(0.5), c, { y: 0.5, sy: 0.95 });
    part(g, S(0.34), '#eaf6ff', { y: 0.42, z: 0.24, sz: 0.55, ol: false });
    part(g, S(0.17), '#ffffff', { y: 0.44, z: 0.43, sx: 1.2, sy: 0.8 });
    part(g, S(0.05, 8, 6), '#2a1a20', { y: 0.5, z: 0.6, ol: false });
    [-1, 1].forEach(s => part(g, S(0.09), c, { x: 0.32 * s, y: 0.88, z: -0.02 }));
    [-1, 1].forEach(s => part(g, new THREE.CylinderGeometry(0.005, 0.005, 0.25), '#ffffff', { x: 0.2 * s, y: 0.44, z: 0.52, rz: Math.PI / 2 + 0.2 * s, ol: false }));
    P.tail = part(g, S(0.2), c, { y: 0.15, z: -0.62, sx: 0.65, sy: 0.25, sz: 1.6 });
    eyes(g, 0.62, 0.36, 0.17, 0.1); feet(g, c);
    const bub = new THREE.Mesh(S(0.15), basic('#bff0ff', { transparent: true, opacity: 0.45 })); bub.position.set(0.3, 1.05, 0.1); g.add(bub); P.bubbles = [bub];
    if (evo) {
      P.fins = [0, 1, 2].map(k => part(g, C(0.13, 0.42, 8), k === 1 ? '#ffffff' : '#8ad8ff', { y: 0.9 - k * 0.12, z: -0.18 - k * 0.2, rx: -0.6 }));
      P.tail.scale.set(0.9, 0.3, 2.1);
      for (let k = 0; k < 2; k++) { const b = bub.clone(); b.material = bub.material; g.add(b); P.bubbles.push(b); }
    }
  } else if (el === 'rock') {
    part(g, S(0.5), c, { y: 0.45, sx: 1.05, sy: 0.85, sz: 1.15 });
    part(g, S(0.3), '#e8d8b8', { y: 0.36, z: 0.42, sz: 0.45, ol: false });
    part(g, C(0.13, 0.3, 10), '#c8b490', { y: 0.36, z: 0.7, rx: Math.PI / 2 });
    part(g, S(0.045, 8, 6), '#2a1a20', { y: 0.36, z: 0.86, ol: false });
    const plate = evo ? '#5e5244' : '#7e6a52', n = evo ? 5 : 4;
    for (let k = 0; k < n; k++) part(g, S(0.32), plate, { y: 0.72 - Math.abs(k - (n - 1) / 2) * 0.05, z: 0.18 - k * 0.2, sx: 1.25, sy: 0.42, sz: 0.55 });
    const cry = lam('#f0a83a', { emissive: '#6a3a00' });
    const spikes = evo ? [[0, 1.02, -0.1, 0.12, 0.5], [-0.24, 0.92, -0.3, 0.09, 0.38], [0.24, 0.92, -0.3, 0.09, 0.38], [0, 0.95, -0.55, 0.1, 0.4], [0, 0.98, 0.2, 0.08, 0.3]] : [[-0.12, 0.88, -0.2, 0.07, 0.24], [0.14, 0.86, -0.4, 0.06, 0.2]];
    spikes.forEach(([x, y, z, r, h]) => part(g, C(r, h, 5), cry, { x, y, z, rz: x * 0.8 }));
    if (evo) part(g, C(0.06, 0.22, 6), '#e8d8b8', { y: 0.5, z: 0.74, rx: 0.4 });
    P.tail = part(g, C(0.16, 0.6, 8), c, { y: 0.25, z: -0.62, rx: -Math.PI / 2 - 0.3 });
    eyes(g, 0.6, 0.55, 0.2, 0.1, { angry: evo }); feet(g, '#6a5a48', 0.26);
  } else if (el === 'fire') {
    part(g, S(0.48), c, { y: 0.48, sy: 0.95 });
    part(g, S(0.3), '#f6e6d0', { y: 0.38, z: 0.26, sz: 0.5, ol: false });
    [-1, 1].forEach(s => part(g, S(0.14), '#f08a3a', { x: 0.17 * s, y: 0.57, z: 0.33, sx: 1.4, sy: 0.9, sz: 0.45, ol: false })); // 眼睛周圍的橘色面罩
    P.ears = [-1, 1].map(s => { const e = part(g, C(0.12, 0.26, 8), c, { x: 0.25 * s, y: 0.95, rz: -0.35 * s }); part(e, C(0.06, 0.12, 6), '#ff8a3a', { y: 0.08, ol: false, emissive: '#7a2a00' }); return e; });
    part(g, S(0.06, 8, 6), '#2a1a20', { y: 0.44, z: 0.47, ol: false });
    const flame = lam('#ff7a2a', { emissive: '#ff4a10' }), flame2 = lam('#ffd23a', { emissive: '#ff9a10' });
    const tails = evo ? [-1, 1] : [0];
    P.tails = tails.map(s => {
      const t = new THREE.Group(); t.position.set(0.18 * s, 0.4, -0.45); t.rotation.set(-0.7, 0.4 * s, 0); g.add(t);
      part(t, S(0.18), c, { y: 0.1, sy: 1.4 }); const f = part(t, C(0.15, 0.4, 8), flame, { y: 0.42 }); part(f, C(0.08, 0.22, 6), flame2, { y: 0.02, ol: false });
      const gl = glow('#ff8a3a', 0.9); gl.position.y = 0.45; t.add(gl); fxs.push(gl); return t;
    });
    eyes(g, 0.57, 0.38, 0.17, 0.1, { angry: true, white: evo ? '#ffe88a' : '#ffffff' }); feet(g, '#24202a');
    if (evo) { P.mane = new THREE.Group(); P.mane.position.y = 0.66; g.add(P.mane); for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; part(P.mane, C(0.1, 0.34, 6), i % 2 ? flame : flame2, { x: Math.sin(a) * 0.42, z: Math.cos(a) * 0.42 - 0.05, rx: Math.cos(a) * 0.9, rz: -Math.sin(a) * 0.9 }); } }
  } else if (el === 'thunder') {
    part(g, S(0.5), c, { y: 0.52, sy: 1.05, sz: 0.95 });
    part(g, S(0.36), evo ? '#f2cf3a' : '#fff3c4', { y: 0.6, z: 0.22, sy: 0.85, sz: 0.5, ol: false });
    part(g, C(0.07, 0.16, 6), '#f08a2a', { y: 0.5, z: 0.5, rx: Math.PI / 2 + 0.4 });
    const wing = evo ? '#5a3ab8' : '#d8a820';
    P.wings = [-1, 1].map(s => part(g, S(0.3), wing, { x: 0.45 * s, y: 0.5, z: -0.05, sx: evo ? 0.5 : 0.3, sy: evo ? 1.1 : 0.85, sz: 0.8, rz: (evo ? 0.9 : 0.25) * s }));
    // 頭上的閃電呆毛（折線）
    const bolt = lam('#ffe24a', { emissive: evo ? '#a07a00' : '#3a2a00' });
    [-1, 1].forEach(s => { [[0, 0], [1, 1]].forEach(([k]) => part(g, new THREE.BoxGeometry(0.06, 0.2, 0.06), bolt, { x: 0.2 * s + (k ? 0.06 * s : 0), y: 1.02 + k * 0.17, rz: (k ? -0.6 : 0.6) * s, thin: true })); });
    eyes(g, 0.66, 0.38, 0.17, 0.13, { white: '#ffffff', angry: evo }); feet(g, '#f08a2a', 0.18, 0.9);
    if (evo) { for (let k = 0; k < 3; k++) { const sp2 = glow('#ffe24a', 0.5); sp2.position.set(0, 0.9, 0); g.add(sp2); fxs.push(sp2); } P.sparks = fxs.slice(-3); }
  }
  if (evo) { const gl = glow(EL_COLOR[el], 2.2); gl.position.y = 0.6; gl.material.opacity = 0.35; g.add(gl); P.aura = gl; }
  return { g, P, fxs };
}

// ---------- 區域場景 ----------
export function buildZones(out) {
  const Sc = out.S, t = out.t;
  const trunk = lam('#7a5232');
  // 各區地面（第一區沿用原本的草地）
  ZONES.forEach((Z, i) => {
    if (!i) return;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.FW * 2 + 4, Z.z1 - Z.z0), lam(Z.ground)); m.rotation.x = -Math.PI / 2; m.position.set(0, 0.006, (Z.z0 + Z.z1) / 2); Sc.add(m); t.ground.push(m);
  });
  // 牌樓（區域入口）＋石碑寫建議等級
  ZONES.forEach((Z, i) => {
    if (!i) return;
    const g = new THREE.Group(); g.position.set(0, 0, Z.z0); Sc.add(g);
    const red = lam('#b8382a'), gold = lam('#e8c15a'), dark = lam('#3a2a20');
    [-3.6, 3.6].forEach(x => { part(g, new THREE.CylinderGeometry(0.24, 0.28, 7, 10), red, { x, y: 3.5 }); part(g, new THREE.CylinderGeometry(0.4, 0.45, 0.4, 10), dark, { x, y: 0.2 }); ZONE_COLLIDERS.push([x, Z.z0, 0.4]); CAM_POSTS.push([x, Z.z0, 0.5]); });
    part(g, new THREE.BoxGeometry(9, 0.35, 0.5), red, { y: 6.9 }); part(g, new THREE.BoxGeometry(9.8, 0.3, 1.2), lam('#3a6a5a'), { y: 7.25 });
    part(g, new THREE.BoxGeometry(8.2, 0.2, 0.4), gold, { y: 6.1 });
    const tex = canvasTex(512, 160, (c, W, H) => { c.fillStyle = '#5a2a1a'; c.fillRect(0, 0, W, H); c.strokeStyle = '#e8c15a'; c.lineWidth = 8; c.strokeRect(6, 6, W - 12, H - 12); c.fillStyle = '#f6dc94'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '900 64px "Noto Serif TC",serif'; c.fillText(Z.name, W / 2, 62); c.font = '700 34px "Noto Serif TC",serif'; c.fillText(`建議等級 Lv${Z.lv[0]}–${Z.lv[1]}`, W / 2, 122); });
    [0, Math.PI].forEach(r => { const b = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.88), basic('#fff', { map: tex })); b.position.set(0, 6.5, r ? 0.27 : -0.27); b.rotation.y = r ? 0 : Math.PI; g.add(b); });
  });
  // 竹林：一叢叢竹子＋一條小溪和木橋
  {
    const Z = ZONES[1], N = 260, geo = new THREE.CylinderGeometry(0.09, 0.11, 7, 6), mat = lam('#6aaa3a');
    const im = new THREE.InstancedMesh(geo, mat, N), leafIm = new THREE.InstancedMesh(new THREE.ConeGeometry(0.9, 2.4, 6), lam('#4c9a3a'), N);
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(); let k = 0;
    const rnd = seeded(11);
    while (k < N) {
      const x = (rnd() - 0.5) * (WORLD.FW * 2 - 4), z = Z.z0 + 2 + rnd() * (Z.z1 - Z.z0 - 4);
      if (Math.abs(x) < 5 || (Math.abs(x + 7) < 3 && Math.abs(z - TEAS[1].z) < 3)) continue;
      const h = 0.75 + rnd() * 0.5; e.set((rnd() - 0.5) * 0.12, 0, (rnd() - 0.5) * 0.12); q.setFromEuler(e);
      M.compose(new THREE.Vector3(x, 3.5 * h, z), q, new THREE.Vector3(1, h, 1)); im.setMatrixAt(k, M);
      M.compose(new THREE.Vector3(x, 7 * h + 0.6, z), q, new THREE.Vector3(1, 1, 1)); leafIm.setMatrixAt(k, M);
      if (k % 3 === 0) ZONE_COLLIDERS.push([x, z, 0.25]);
      k++;
    }
    Sc.add(im); Sc.add(leafIm);
    const sz = 70, water = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.FW * 2 + 4, 3.2), lam('#4aa0c8', { emissive: '#0a2a3a', polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 })); water.rotation.x = -Math.PI / 2; water.position.set(0, 0.03, sz); Sc.add(water); out.stream = water;
    const bridge = new THREE.Group(); bridge.position.set(0, 0, sz); Sc.add(bridge);
    part(bridge, new THREE.BoxGeometry(3.4, 0.16, 4.2), lam('#9a6a3a'), { y: 0.1 });
    [-1.7, 1.7].forEach(x => { part(bridge, new THREE.BoxGeometry(0.12, 0.12, 4.2), lam('#7a4a2a'), { x, y: 0.75 }); [-1.8, 0, 1.8].forEach(z => part(bridge, new THREE.BoxGeometry(0.12, 0.7, 0.12), lam('#7a4a2a'), { x, y: 0.45, z })); });
  }
  // 岩石山谷：大石頭、石柱、兩側崖壁
  {
    const Z = ZONES[2], rnd = seeded(23), rock = lam('#9a8a74', { flatShading: true }), rock2 = lam('#857560', { flatShading: true });
    for (let k = 0; k < 46; k++) {
      const x = (rnd() - 0.5) * (WORLD.FW * 2 - 6), z = Z.z0 + 2 + rnd() * (Z.z1 - Z.z0 - 4); if (Math.abs(x) < 5) continue;
      const r = 0.6 + rnd() * 1.6, m = part(Sc, new THREE.DodecahedronGeometry(r, 0), k % 2 ? rock : rock2, { x, y: r * 0.55, z, sy: 0.75, ry: rnd() * 6 });
      ZONE_COLLIDERS.push([x, z, r * 0.9]); void m;
    }
    for (let k = 0; k < 8; k++) { const x = (k % 2 ? 1 : -1) * (12 + rnd() * 30), z = Z.z0 + 4 + k * 2.6, h = 4 + rnd() * 5; part(Sc, new THREE.CylinderGeometry(0.9, 1.3, h, 6), rock2, { x, y: h / 2, z }); ZONE_COLLIDERS.push([x, z, 1.3]); CAM_POSTS.push([x, z, 1.3]); }
  }
  // 熔岩火山：岩漿池、冒煙的火山、燒焦的樹
  {
    const Z = ZONES[3], rnd = seeded(37);
    out.lavaMats = [];
    for (let k = 0; k < 9; k++) {
      const x = (k % 2 ? 1 : -1) * (7 + rnd() * 38), z = Z.z0 + 3 + rnd() * (Z.z1 - Z.z0 - 6), r = 1.4 + rnd() * 2;
      const mat = lam('#ff6a1a', { emissive: '#ff3a00', polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 }); out.lavaMats.push(mat);
      const pool = new THREE.Mesh(new THREE.CircleGeometry(r, 20), mat); pool.rotation.x = -Math.PI / 2; pool.position.set(x, 0.03, z); Sc.add(pool);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.25, 6, 22), lam('#2a1e1c')); rim.rotation.x = -Math.PI / 2; rim.position.set(x, 0.05, z); Sc.add(rim);
      ZONE_COLLIDERS.push([x, z, r]);
    }
    const vol = new THREE.Group(); vol.position.set(42, 0, 117); Sc.add(vol);
    part(vol, new THREE.CylinderGeometry(3, 11, 16, 12), lam('#4a3634', { flatShading: true }), { y: 8 });
    const top = new THREE.Mesh(new THREE.CircleGeometry(3, 14), lam('#ff6a1a', { emissive: '#ff4a00' })); top.rotation.x = -Math.PI / 2; top.position.y = 16.02; vol.add(top); out.lavaMats.push(top.material);
    const g2 = glow('#ff7a2a', 14); g2.position.y = 18; vol.add(g2);
    ZONE_COLLIDERS.push([42, 117, 11]);
    out.smoke = []; for (let k = 0; k < 14; k++) { const s = new THREE.Mesh(S(1.2, 8, 6), lam('#6a6060', { transparent: true, opacity: 0.6 })); s.position.set(42, 17 + k, 117); Sc.add(s); out.smoke.push({ m: s, t: k / 14 }); }
    const burnt = lam('#2a2220');
    for (let k = 0; k < 16; k++) { const x = (k % 2 ? 1 : -1) * (6 + rnd() * 44), z = Z.z0 + 2 + rnd() * (Z.z1 - Z.z0 - 4); const tr = new THREE.Group(); tr.position.set(x, 0, z); Sc.add(tr); part(tr, new THREE.CylinderGeometry(0.12, 0.2, 2.6, 6), burnt, { y: 1.3 }); part(tr, new THREE.CylinderGeometry(0.06, 0.08, 1, 5), burnt, { x: 0.3, y: 2, rz: -0.8 }); ZONE_COLLIDERS.push([x, z, 0.3]); }
  }
  // 雷雲山頂：發光的水晶、低低的烏雲、魔王的石柱圈
  {
    const Z = ZONES[4], rnd = seeded(51), cry = lam('#8ae0ff', { emissive: '#1a5a8a' }), cry2 = lam('#c8a8ff', { emissive: '#4a2a8a' });
    for (let k = 0; k < 24; k++) {
      const x = (rnd() - 0.5) * (WORLD.FW * 2 - 8), z = Z.z0 + 2 + rnd() * (Z.z1 - Z.z0 - 4); if (Math.abs(x) < 5 || Math.hypot(x - BOSS_HOME.x, z - BOSS_HOME.z) < 12) continue;
      const h = 1.5 + rnd() * 3; part(Sc, new THREE.OctahedronGeometry(0.6, 0), k % 2 ? cry : cry2, { x, y: h / 2, z, sy: h, ry: rnd() * 3 }); ZONE_COLLIDERS.push([x, z, 0.6]);
    }
    out.stormClouds = [];
    for (let k = 0; k < 12; k++) { const c = new THREE.Group(); c.position.set((rnd() - 0.5) * 100, 20 + rnd() * 6, Z.z0 + rnd() * (Z.z1 - Z.z0)); [[0, 0, 0, 5], [5, -1, 0, 3.8], [-5, -1, 1, 4]].forEach(([x, y, z, r]) => { const b = new THREE.Mesh(S(r, 10, 8), lam('#5a5a72')); b.position.set(x, y, z); b.scale.y = 0.5; c.add(b); }); Sc.add(c); out.stormClouds.push(c); }
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2, x = BOSS_HOME.x + Math.cos(a) * 10, z = BOSS_HOME.z + Math.sin(a) * 8; part(Sc, new THREE.BoxGeometry(1, 4.5, 1), lam('#6a6680'), { x, y: 2.25, z, ry: a }); part(Sc, new THREE.BoxGeometry(1.3, 0.3, 1.3), lam('#e8c15a'), { x, y: 4.6, z, ry: a }); ZONE_COLLIDERS.push([x, z, 0.8]); CAM_POSTS.push([x, z, 0.8]); }
    const plat = new THREE.Mesh(new THREE.CircleGeometry(8.5, 32), lam('#a8a4c0', { polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 })); plat.rotation.x = -Math.PI / 2; plat.position.set(BOSS_HOME.x, 0.03, BOSS_HOME.z); Sc.add(plat);
    // 閃電（雷雲山頂才會打雷）
    out.bolt = new THREE.Group(); out.bolt.visible = false; Sc.add(out.bolt);
    const bm = basic('#f4f0ff', { transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    let y = 24, x = 0; for (let k = 0; k < 7; k++) { const nx = x + (Math.random() - 0.5) * 2.4, ny = y - 3.5; const len = Math.hypot(nx - x, 3.5); const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, len, 5), bm); seg.position.set((x + nx) / 2, (y + ny) / 2, 0); seg.rotation.z = Math.atan2(x - nx, 3.5); out.bolt.add(seg); x = nx; y = ny; }
  }
  // 兩側崖壁：岩石區以後改成山壁（前兩區是樹）
  {
    const wall = lam('#8a7a66', { flatShading: true }), rnd = seeded(77);
    for (let z = ZONES[2].z0; z <= WORLD.FZ + 4; z += 5) [-1, 1].forEach(s => { const h = 6 + rnd() * 6; part(Sc, new THREE.DodecahedronGeometry(3.4, 0), z > ZONES[3].z0 ? lam('#4a3834', { flatShading: true }) : wall, { x: s * (WORLD.FW + 2.5), y: h * 0.4, z, sy: h / 4, ry: rnd() * 6, ol: false }); });
    for (let x = -WORLD.FW; x <= WORLD.FW; x += 5) part(Sc, new THREE.DodecahedronGeometry(3.4, 0), lam('#6a6680', { flatShading: true }), { x, y: 3, z: WORLD.FZ + 3, sy: 2.2, ry: x, ol: false });
  }
  buildFacilities(out);
}

// ---------- 設施：傳送石碑、茶亭、文具鋪、木人樁、擂台 ----------
function buildFacilities(out) {
  const Sc = out.S, t = out.t;
  out.steleMeshes = STELES.map(s => {
    const g = new THREE.Group(); g.position.set(s.x, 0, s.z); Sc.add(g);
    part(g, new THREE.BoxGeometry(1.4, 0.3, 0.9), lam('#6a6a72'), { y: 0.15 });
    const slab = part(g, new THREE.BoxGeometry(0.9, 1.9, 0.28), lam('#8a8a96'), { y: 1.25 });
    const rune = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 1.3), basic('#fff', { map: canvasTex(128, 300, (c, W, H) => { c.fillStyle = '#3a3a48'; c.fillRect(0, 0, W, H); c.fillStyle = '#9ae8ff'; c.font = '900 64px "Noto Serif TC",serif'; c.textAlign = 'center'; c.fillText('傳', W / 2, 90); c.fillText('送', W / 2, 170); c.font = '700 30px sans-serif'; c.fillText('✦', W / 2, 240); }), transparent: true }));
    rune.position.set(0, 1.25, 0.15); g.add(rune);
    const gl = glow('#7ad8ff', 2.4); gl.position.y = 1.4; gl.material.opacity = 0.35; g.add(gl);
    ZONE_COLLIDERS.push([s.x, s.z, 0.75]);
    t.tapTargets.push([g, () => t.emit('tapStele', s.i)]);
    return { g, gl, rune };
  });
  // 茶亭：四根柱子、屋頂、茶桌與兩張椅子（在這裡回滿體力、也是被打倒後的休息點）
  out.teaSteam = [];
  TEAS.forEach(s => {
    const g = new THREE.Group(); g.position.set(s.x, 0, s.z); Sc.add(g);
    const wood = lam('#8a4a2a');
    [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]].forEach(([x, z]) => part(g, new THREE.CylinderGeometry(0.1, 0.1, 2.5, 8), wood, { x, y: 1.25, z }));
    part(g, new THREE.ConeGeometry(2.6, 1.2, 4), lam('#3a7a5a'), { y: 3.05, ry: Math.PI / 4 });
    part(g, new THREE.CylinderGeometry(0.2, 0.2, 0.4, 8), lam('#e8c15a'), { y: 3.75 });
    part(g, new THREE.CylinderGeometry(0.55, 0.55, 0.08, 16), lam('#a0603a'), { y: 0.75 }); part(g, new THREE.CylinderGeometry(0.08, 0.12, 0.75, 8), wood, { y: 0.38 });
    part(g, new THREE.SphereGeometry(0.14, 12, 10), lam('#e8e0d0'), { y: 0.9 }); part(g, new THREE.SphereGeometry(0.05, 8, 6), lam('#e8e0d0'), { x: 0.14, y: 0.95 });
    [-0.9, 0.9].forEach(x => part(g, new THREE.CylinderGeometry(0.25, 0.25, 0.45, 10), lam('#c88a5a'), { x, y: 0.22 }));
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.42), basic('#fff', { map: canvasTex(300, 96, (c, W, H) => { c.fillStyle = '#2a4a3a'; c.fillRect(0, 0, W, H); c.strokeStyle = '#e8c15a'; c.lineWidth = 5; c.strokeRect(4, 4, W - 8, H - 8); c.fillStyle = '#f6dc94'; c.font = '900 52px "Noto Serif TC",serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('🍵 茶亭', W / 2, H / 2 + 2); }), side: THREE.DoubleSide }));
    sign.position.set(0, 2.35, -1.45); g.add(sign);
    for (let k = 0; k < 4; k++) { const st = new THREE.Mesh(S(0.06, 6, 5), basic('#ffffff', { transparent: true, opacity: 0.5 })); st.position.set(0, 1, 0); g.add(st); out.teaSteam.push({ m: st, t: k / 4 }); }
    [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]].forEach(([x, z]) => ZONE_COLLIDERS.push([s.x + x, s.z + z, 0.15]));
    ZONE_COLLIDERS.push([s.x, s.z, 0.6]);
    t.tapTargets.push([g, () => t.emit('tapTea', s.i)]);
  });
  // 文具鋪：小木屋＋招牌，賣毛筆（攻擊力）和茶包（補體力）
  {
    const g = new THREE.Group(); g.position.set(SHOP.x, 0, SHOP.z); g.rotation.y = -Math.PI / 2; Sc.add(g);
    part(g, new THREE.BoxGeometry(4, 2.6, 2.6), lam('#f2e2c0'), { y: 1.3 });
    part(g, new THREE.BoxGeometry(4.6, 0.25, 3.3), lam('#a8382a'), { y: 2.75 });
    part(g, new THREE.ConeGeometry(3.1, 1.2, 4), lam('#a8382a'), { y: 3.45, ry: Math.PI / 4, sx: 1.05, sz: 0.75 });
    part(g, new THREE.BoxGeometry(3.4, 0.9, 0.5), lam('#8a5a3a'), { y: 0.45, z: 1.55 }); // 櫃台
    for (let k = 0; k < 5; k++) part(g, new THREE.CylinderGeometry(0.03, 0.03, 0.55), lam(['#c8352b', '#3a6ab8', '#2a8a4a', '#e8c15a', '#1a1412'][k]), { x: -1.2 + k * 0.3, y: 1.15, z: 1.6, rz: 0.15 - k * 0.07 });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.62), basic('#fff', { map: canvasTex(420, 120, (c, W, H) => { c.fillStyle = '#5a2a1a'; c.fillRect(0, 0, W, H); c.strokeStyle = '#e8c15a'; c.lineWidth = 6; c.strokeRect(5, 5, W - 10, H - 10); c.fillStyle = '#f6dc94'; c.font = '900 64px "Noto Serif TC",serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('文具鋪', W / 2, H / 2 + 3); }) }));
    sign.position.set(0, 2.2, 1.32); g.add(sign);
    ZONE_COLLIDERS.push([SHOP.x + 0.3, SHOP.z - 1, 1.5], [SHOP.x + 0.3, SHOP.z + 1, 1.5]);
    t.tapTargets.push([g, () => t.emit('tapShop')]);
  }
  // 木人樁：打不倒，會顯示傷害和每秒輸出
  {
    const g = new THREE.Group(); g.position.set(DUMMY.x, 0, DUMMY.z); Sc.add(g); out.dummy = g;
    const wood = lam('#b0763a');
    part(g, new THREE.CylinderGeometry(0.3, 0.36, 1.9, 10), wood, { y: 0.95 });
    part(g, new THREE.SphereGeometry(0.3, 12, 10), wood, { y: 2.05 });
    [-1, 1].forEach(s => part(g, new THREE.CylinderGeometry(0.07, 0.07, 0.8, 8), wood, { x: 0.4 * s, y: 1.35, rz: Math.PI / 2 }));
    part(g, new THREE.TorusGeometry(0.34, 0.05, 6, 18), lam('#c8352b'), { y: 1.55, rx: Math.PI / 2 });
    const tag = textSprite('木人樁・打不倒', { sx: 1.4 }); tag.position.y = 2.75; g.add(tag);
    ZONE_COLLIDERS.push([DUMMY.x, DUMMY.z, 0.45]);
    t.tapTargets.push([g, () => t.emit('tapDummy')]);
  }
  // 擂台：地上一圈紅框、四角旗子（站進來可以跟其他考生切磋）
  {
    const g = new THREE.Group(); g.position.set(ARENA.x, 0, ARENA.z); Sc.add(g);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(ARENA.r, 36), lam('#e2c890', { polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 })); floor.rotation.x = -Math.PI / 2; floor.position.y = 0.035; g.add(floor);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(ARENA.r, 0.09, 6, 40), lam('#c8352b')); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.07; g.add(ring);
    [0, 1, 2, 3].forEach(k => { const a = k / 4 * Math.PI * 2 + Math.PI / 4, x = Math.cos(a) * (ARENA.r + 0.3), z = Math.sin(a) * (ARENA.r + 0.3); part(g, new THREE.CylinderGeometry(0.05, 0.05, 2.2), lam('#5a3a24'), { x, y: 1.1, z }); part(g, new THREE.PlaneGeometry(0.6, 0.4), lam(k % 2 ? '#e8c15a' : '#c8352b', { side: THREE.DoubleSide }), { x: x + 0.3, y: 1.95, z, ol: false }); ZONE_COLLIDERS.push([ARENA.x + x, ARENA.z + z, 0.12]); });
    const tag = textSprite('擂台・站進來切磋', { sx: 1.6 }); tag.position.set(0, 2.6, -ARENA.r - 0.3); g.add(tag);
  }
}

// 每一幀：岩漿發光、火山冒煙、茶冒蒸氣、石碑發光、雷雲飄動
export function tickZones(out, dt, t, pz) {
  if (out.lavaMats) { const k = 0.75 + Math.sin(t * 2.2) * 0.25; out.lavaMats.forEach(m => m.emissive.setRGB(k, k * 0.24, 0)); }
  if (out.smoke) out.smoke.forEach(s => { s.t = (s.t + dt * 0.06) % 1; s.m.position.set(42 + Math.sin(s.t * 9) * 2, 17 + s.t * 18, 117 + s.t * 3); s.m.scale.setScalar(0.6 + s.t * 2.4); s.m.material.opacity = 0.55 * (1 - s.t); });
  if (out.teaSteam) out.teaSteam.forEach(s => { s.t = (s.t + dt * 0.4) % 1; s.m.position.set(Math.sin(s.t * 8) * 0.06, 1.0 + s.t * 0.8, 0); s.m.material.opacity = 0.5 * (1 - s.t); s.m.scale.setScalar(1 + s.t * 2); });
  if (out.steleMeshes) out.steleMeshes.forEach((s, i) => { s.gl.material.opacity = (out.steleOn?.has(i) ? 0.55 : 0.18) + Math.sin(t * 2 + i) * 0.1; });
  if (out.stormClouds) out.stormClouds.forEach((c, i) => { c.position.x += dt * (0.5 + (i % 3) * 0.3); if (c.position.x > 70) c.position.x = -70; });
  // 雷雲山頂：玩家在這區時偶爾打雷
  if (out.bolt && pz > ZONES[4].z0 - 4) {
    out.boltT = (out.boltT ?? 4) - dt;
    if (out.boltT <= 0) { out.boltT = 6 + Math.random() * 6; const b = out.bolt; b.position.set((Math.random() - 0.5) * 80, 0, ZONES[4].z0 + 4 + Math.random() * 20); b.visible = true; out.onThunder?.(); setTimeout(() => { b.visible = false; }, 140); setTimeout(() => { b.visible = true; setTimeout(() => { b.visible = false; }, 80); }, 220); }
  }
}

function seeded(s) { return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

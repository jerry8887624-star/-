// 3D 文昌祠：建築、擺設、走動、鏡頭、日夜、擲筊與插香等場景動畫
import * as THREE from '../vendor/three.module.min.js';
import { Avatar } from './avatar.js';

const lam = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });
const basic = (c, extra = {}) => new THREE.MeshBasicMaterial({ color: c, ...extra });

// 廟的尺寸（公尺）：正殿寬 30、深 21、高 8，約是第一版的 5 倍面積
export const L = { HW: 15, HF: -1, HB: -22, HH: 8, CW: 20, GZ: 20, CZ: 6, FW: 30, FZ: 54 }; // FW、FZ：廟門外樹林的寬度與最遠處
const ALTAR_Z = -18.3, CUSHION_Z = -15.3, WC_CENSER_Z = -16.85; // 供桌、主拜墊、文昌爐
const JINLU = { x: 12, z: 13 }; // 金爐

// 站位：x, z, 面向（弧度；0 = 朝 +z 也就是朝廟外）
export const SPOTS = {
  start: { x: -4, z: 3, f: Math.PI },
  counter: { x: -15.7, z: 11, f: -Math.PI / 2 },
  censerOut: { x: 0, z: L.CZ - 1.6, f: 0 },
  censer: { x: 0, z: L.CZ + 1.6, f: Math.PI },
  cushion: { x: 0, z: CUSHION_Z, f: Math.PI, kneel: true },
  wcCenser: { x: 0, z: WC_CENSER_Z + 1.05, f: Math.PI },
  jinlu: { x: JINLU.x - 0.8, z: JINLU.z - 1.9, f: 0.35, cam: 0.6 }, // 站在爐口左前方，才不會擋住火光
  qianTube: { x: 6.4, z: -16.4, f: Math.PI, cam: -0.45 },
  wall: { x: 16.4, z: 8, f: Math.PI / 2 },
  lingxi: { x: 16.3, z: 14.6, f: Math.PI / 2, cam: 0.35 },
  bang: { x: 16.4, z: 1.8, f: Math.PI / 2, cam: 0.3 },
  study: { x: -11, z: 8.6, f: Math.PI },
  pool: { x: -10, z: 17.2, f: Math.PI, cam: 0.2 },
  lamp: { x: -12.9, z: -8.25, f: -Math.PI / 2, cam: 0.5 },
  photo: { x: 4, z: 11, f: 0 },
};
// 讀書角書桌（坐在凳子上、面向書桌）：座位編號 700 起
export const DESKS = [];
[-14, -11, -8].forEach(x => [3.4, 6.6].forEach(z => DESKS.push({ x, z })));
export const DESK_SEAT0 = 700;
export const POOL = { x: -10, z: 14.4, r: 1.7 };
// 名牌標示（可點擊走過去）
export const MARKS = [
  { id: 'counter', name: '辦事處', pos: [-17.6, 2.9, 11] },
  { id: 'censer', name: '天公爐', pos: [0, 2.6, L.CZ] },
  { id: 'cushion', name: '文昌帝君', pos: [0, 6.4, -20.4] },
  { id: 'qianTube', name: '籤筒', pos: [6.4, 1.9, -17.6] },
  { id: 'wall', name: '祈福牆', pos: [18.2, 3.4, 8] },
  { id: 'jinlu', name: '金爐', pos: [JINLU.x, 4.6, JINLU.z] },
  { id: 'lingxi', name: '靈犀占卜', pos: [18.6, 4.3, 14.6] },
  { id: 'bang', name: '還願紅榜', pos: [18.6, 3.9, 1.8] },
  { id: 'study', name: '讀書角', pos: [-11, 2.4, 5] },
  { id: 'pool', name: '許願池', pos: [-10, 2.0, 14.4] },
  { id: 'lamp', name: '光明燈', pos: [-14.6, 4.6, -8.25] },
  { id: 'photo', name: '合照打卡', pos: [4, 2.6, 11] },
];
// 鏡頭特寫用的位置
export const FOCUS = { altar: [-0.6, 1.6, -18.4], censer: [0, 2.2, L.CZ], wcCenser: [0, 1.6, WC_CENSER_Z], jinlu: [JINLU.x, 1.6, JINLU.z], wall: [18.2, 2, 8] };

// 天公爐前的拜位：面朝廟外一排五個，一人一位，滿了就要等
export const TIANGONG_SLOTS = [];
[0, -1.2, 1.2, -2.4, 2.4, -3.6, 3.6].forEach(x => TIANGONG_SLOTS.push({ x, z: L.CZ - 1.75, f: 0 }));
[-0.6, 0.6, -1.8, 1.8, -3.0, 3.0].forEach(x => TIANGONG_SLOTS.push({ x, z: L.CZ - 3.0, f: 0 }));   // 第二排
export const TIANGONG_SEAT0 = 500; // 伺服器座位編號：天公爐拜位從 500 開始

// 殿內的拜墊：誰都可以走上去跪拜（前排三個是正對神像的主拜墊）
// 前排五個主拜墊（正對文昌爐），後面一排排拜墊；中間留走道
export const CUSHIONS = [];
[0, -1.4, 1.4, -2.8, 2.8].forEach(x => CUSHIONS.push({ x, z: CUSHION_Z }));
export const MAIN_CUSHIONS = 5;
[-13.6, -12.0, -10.4, -8.8, -7.2, -5.6, -4.0].forEach(z => [-1.6, 1.6, -3.1, 3.1, -4.6, 4.6, -6.1, 6.1, -7.6, 7.6, -9.1, 9.1, -10.6, 10.6].forEach(x => {
  if (Math.abs(x) > 10 && [-6, -12].some(pz => Math.abs(z - pz) < 0.9)) return; // 避開殿內柱子
  CUSHIONS.push({ x, z });
}));

// 不能走進去的區塊（矩形 x1,z1,x2,z2）與圓形（x,z,r）
const BOXES = [
  [-18.8, 9, -16.6, 13],            // 辦事處櫃台
  [-4.6, ALTAR_Z - 0.7, 4.6, ALTAR_Z + 0.7], // 供桌（加長）
  [-2.4, L.HB, 2.4, -19.6],         // 神龕
  [5.9, -18.1, 6.9, -17.1],         // 籤筒桌
  [17.6, 5.2, 19.2, 10.8],          // 祈福牆
  [18.1, 12.8, 19.4, 16.4],         // 靈犀占卜電子牆
  [18.1, 0.1, 19.3, 3.5],           // 還願紅榜
  ...[-14, -11, -8].flatMap(x => [3.4, 6.6].map(z => [x - 0.65, z - 0.95, x + 0.65, z - 0.45])), // 讀書角書桌
  [-15, -10.1, -14.3, -6.4],        // 光明燈牆
  [-10.3, 21.15, -8.7, 22.05],      // 廟外苗圃
  [-L.CW - 0.4, L.GZ - 0.2, -3.3, L.GZ + 0.4], [3.3, L.GZ - 0.2, L.CW + 0.4, L.GZ + 0.4], // 前牆
];
const FRONT_PILLARS = [-14.2, -8.5, -3.4, 3.4, 8.5, 14.2];
const INNER_PILLARS = [];
[-11.8, 11.8].forEach(x => [-6, -12, -18].forEach(z => INNER_PILLARS.push([x, z])));
const CIRCLES = [[-10, 14.4, 1.9], [16, 45, 4.3], [0, 47.5, 1.6], [22, 24.5, 0.35], [27, 31, 0.35], [23, 51.5, 0.35], [-2.95, -20.2, 0.3], [2.95, -20.2, 0.3], [0, L.CZ, 1.25], [0, WC_CENSER_Z, 0.62], [JINLU.x, JINLU.z, 1.35], ...FRONT_PILLARS.map(x => [x, L.HF, 0.35]), ...INNER_PILLARS.map(([x, z]) => [x, z, 0.45]), [-2.9, L.GZ, 0.45], [2.9, L.GZ, 0.45]];

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function plaqueTex(text, { bg = '#1a1210', fg = '#e8c15a', vertical = false, w = 512, h = 160, font = 96 } = {}) {
  return canvasTex(w, h, (g, W, H) => {
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.strokeStyle = fg; g.lineWidth = 10; g.strokeRect(12, 12, W - 24, H - 24);
    g.fillStyle = fg; g.font = `900 ${font}px "Noto Serif TC","Songti TC","PMingLiU",serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (vertical) [...text].forEach((ch, i, a) => g.fillText(ch, W / 2, H / 2 + (i - (a.length - 1) / 2) * font * 1.05));
    else g.fillText(text, W / 2, H / 2 + 4);
  });
}

export class Temple {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(1.75, window.devicePixelRatio || 1)); // 大場景在手機上省一點效能
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 260);
    this.clock = new THREE.Clock();
    this.camYaw = 0; this.camYawTarget = 0; this.camDist = 8; this.camPitch = 0.32; // 仰角：0＝平視，1.45＝幾乎正上方往下看
    this.stick = { x: 0, y: 0 }; // 方向搖桿
    this.takenSeats = new Set(); // 其他真人玩家佔用的座位（伺服器同步）
    this.focus = null; // 特寫目標
    this.avatars = new Set();
    this.tapTargets = []; // 其他模組（例如廟外樹林）可以登記可點的物件：[物件, 點到時呼叫的函式]
    this.updaters = [];   // 每一格畫面都要更新的東西（傳入 dt）
    this.anims = [];
    this.night = false;
    this.listeners = {};
    this.build();
    this.resize();
    addEventListener('resize', () => this.resize());
    this.bindInput();
  }
  on(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
  emit(ev, ...a) { (this.listeners[ev] || []).forEach(f => f(...a)); }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // 直式手機視角放寬、鏡頭拉遠，才看得到整個場景
    this.camera.fov = w < h ? 60 : 50;
    this.camera.updateProjectionMatrix();
  }

  build() {
    const S = this.scene;
    this.hemi = new THREE.HemisphereLight(0xfff1dc, 0x5a4636, 1.6); S.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffe2b8, 1.6); this.sun.position.set(-8, 14, 10); S.add(this.sun);
    S.fog = new THREE.Fog(0xe9c9a4, 45, 120);

    // 地面：外圍石地＋中庭石板＋殿內紅磚
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), lam('#7d6a58')); outer.rotation.x = -Math.PI / 2; outer.position.y = -0.02; S.add(outer);
    const slab = canvasTex(512, 512, (g, W, H) => {
      g.fillStyle = '#c9b49a'; g.fillRect(0, 0, W, H);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const v = 190 + Math.random() * 25; g.fillStyle = `rgb(${v},${v - 18},${v - 40})`;
        g.fillRect(x * 64 + 2 + (y % 2) * 32, y * 64 + 2, 60, 60);
      }
    });
    slab.wrapS = slab.wrapT = THREE.RepeatWrapping; slab.repeat.set(10, 5.3);
    const cd = L.GZ - L.HF;
    const court = new THREE.Mesh(new THREE.PlaneGeometry(L.CW * 2 + 0.6, cd + 0.4), lam('#fff', { map: slab })); court.rotation.x = -Math.PI / 2; court.position.set(0, 0, L.HF + cd / 2); S.add(court);
    const brick = canvasTex(256, 256, (g, W, H) => {
      g.fillStyle = '#8a3f2c'; g.fillRect(0, 0, W, H);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) { const v = 150 + Math.random() * 30; g.fillStyle = `rgb(${v},${v * 0.45},${v * 0.32})`; g.fillRect(x * 64 + 2, y * 32 + 2, 60, 28); }
    });
    brick.wrapS = brick.wrapT = THREE.RepeatWrapping; brick.repeat.set(9, 6);
    const hd = L.HF - L.HB;
    const hallFloor = new THREE.Mesh(new THREE.PlaneGeometry(L.HW * 2, hd), lam('#fff', { map: brick })); hallFloor.rotation.x = -Math.PI / 2; hallFloor.position.set(0, 0.01, (L.HF + L.HB) / 2); S.add(hallFloor);
    const step = new THREE.Mesh(new THREE.BoxGeometry(L.HW * 2 + 0.4, 0.12, 0.5), lam('#a89580')); step.position.set(0, 0.06, L.HF + 0.45); S.add(step);

    this.buildHall(); this.buildGate(); this.buildCourt(); this.buildGod();
    this.buildCenser(); this.buildShrineDecor(); this.buildWenchangCenser(); this.buildJinlu(); this.buildLingxiScreen(); this.buildBang(); this.buildPlaza(); this.buildCounter(); this.buildWall(); this.buildTrees();

    this.ground = [outer, court, hallFloor];
  }

  buildHall() {
    const S = this.scene, red = lam('#9e2a22'), dark = lam('#3a1d16'), gold = lam('#d8ab45');
    const { HW, HF, HB, HH } = L, hd = HF - HB, mid = (HF + HB) / 2;
    const wallM = lam('#b2483a');
    const back = new THREE.Mesh(new THREE.BoxGeometry(HW * 2 + 0.4, HH, 0.4), wallM); back.position.set(0, HH / 2, HB - 0.2); S.add(back);
    [-1, 1].forEach(s => {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.4, HH, hd), wallM); side.position.set((HW + 0.2) * s, HH / 2, mid); S.add(side);
      // 圓窗
      [-5, -11.5, -18].forEach(z => {
        const win = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.15, 8, 28), gold); win.position.set((HW - 0.02) * s, 3.6, z); win.rotation.y = Math.PI / 2; S.add(win);
        const lat = new THREE.Mesh(new THREE.CircleGeometry(1.28, 28), lam('#3d2a1c')); lat.position.set((HW - 0.03) * s, 3.6, z); lat.rotation.y = -Math.PI / 2 * s; S.add(lat);
      });
    });
    // 前排柱子＋對聯
    FRONT_PILLARS.forEach(x => {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.33, HH, 14), red); p.position.set(x, HH / 2, HF); S.add(p);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.35, 8), lam('#9a8a78')); base.position.set(x, 0.17, HF); S.add(base);
      if (Math.abs(x) < 4) {
        const t = plaqueTex(x < 0 ? '文章司命' : '桂籍名高', { bg: '#a62a20', fg: '#f3d27a', vertical: true, w: 120, h: 480, font: 92 });
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 2.3), basic('#fff', { map: t })); m.position.set(x, 3.2, HF + 0.34); S.add(m);
      }
    });
    // 殿內柱子
    INNER_PILLARS.forEach(([x, z]) => {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.44, HH, 14), red); p.position.set(x, HH / 2, z); S.add(p);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.62, 0.4, 8), lam('#9a8a78')); base.position.set(x, 0.2, z); S.add(base);
    });
    // 彩繪橫樑
    const beamT = canvasTex(1024, 64, (g, W, H) => {
      const cols = ['#1f6b5c', '#2a4f8a', '#d8ab45', '#b8322a'];
      for (let i = 0; i < 16; i++) { g.fillStyle = cols[i % 4]; g.fillRect(i * 64, 0, 64, H); g.fillStyle = '#f2d98a'; g.beginPath(); g.arc(i * 64 + 32, 32, 14, 0, 7); g.fill(); }
    });
    beamT.wrapS = THREE.RepeatWrapping; beamT.repeat.set(2, 1);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(HW * 2 + 0.4, 0.8, 0.6), [lam('#2a4f8a'), lam('#2a4f8a'), dark, dark, lam('#fff', { map: beamT }), lam('#fff', { map: beamT })]);
    beam.position.set(0, HH - 0.4, HF); S.add(beam);
    // 匾額
    const pl = new THREE.Mesh(new THREE.BoxGeometry(5, 1.5, 0.15), [gold, gold, gold, gold, basic('#fff', { map: plaqueTex('文昌帝君', { w: 640, h: 190, font: 120 }) }), gold]);
    pl.position.set(0, HH - 1.6, HF + 0.35); S.add(pl);
    // 屋頂：四面坡＋燕尾脊
    const tile = canvasTex(256, 256, (g, W, H) => { g.fillStyle = '#b5543a'; g.fillRect(0, 0, W, H); g.fillStyle = '#8f3c28'; for (let x = 0; x < W; x += 16) g.fillRect(x, 0, 6, H); });
    tile.wrapS = tile.wrapT = THREE.RepeatWrapping; tile.repeat.set(20, 5);
    const rb = (HW + 1.5) * Math.SQRT2;
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(2.6, rb, 5, 4, 1), lam('#fff', { map: tile }));
    roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, (hd / 2 + 1.5) / (HW + 1.5)); roof.position.set(0, HH + 2.45, mid); S.add(roof);
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(HW * 1.35, 0.6, 0.8), lam('#7a2a1c')); ridge.position.set(0, HH + 5.1, mid); S.add(ridge);
    [-1, 1].forEach(s => {
      const tail = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.22, 8, 16, Math.PI / 2), lam('#7a2a1c'));
      tail.position.set(HW * 0.675 * s, HH + 6.6, mid); tail.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI; S.add(tail);
    });
    const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 12), lam('#e8b84a', { emissive: '#5a3a00' })); pearl.position.set(0, HH + 5.9, mid); S.add(pearl);
    // 燈籠：殿前一排、殿內兩排
    this.lanterns = [];
    [-11, -6, -1.8, 1.8, 6, 11].forEach(x => this.addLantern(x, HH - 1.6, HF + 0.4));
    [-7.5, 7.5].forEach(x => [-5, -10, -15].forEach(z => this.addLantern(x, HH - 1.8, z)));
    // 天花板
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2, hd), lam('#5a2a20', { side: THREE.DoubleSide })); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, HH, mid); S.add(ceil);
    // 供桌：加長到 9 公尺，大家的供品和准考證都擺得下
    const TW = 9, tableM = lam('#8a2a20'), goldM = lam('#d8ab45');
    const table = new THREE.Mesh(new THREE.BoxGeometry(TW, 1.0, 1.3), tableM); table.position.set(0, 0.5, ALTAR_Z); S.add(table);
    // 桌裙：紅底金邊、祥雲、正中「文星高照」
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(TW - 0.3, 0.86), basic('#fff', { map: canvasTex(1024, 98, (g, W, H) => {
      g.fillStyle = '#c8352b'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#e8b84a'; g.fillRect(0, 0, W, 7); g.fillRect(0, H - 7, W, 7);
      g.strokeStyle = 'rgba(243,210,122,.75)'; g.lineWidth = 2.5;
      for (let x = 40; x < W; x += 92) { if (Math.abs(x - W / 2) < 160) continue; g.beginPath(); g.arc(x, H / 2, 14, Math.PI * 0.2, Math.PI * 1.8); g.stroke(); g.beginPath(); g.arc(x + 18, H / 2 + 6, 9, Math.PI, Math.PI * 2.5); g.stroke(); }
      g.fillStyle = '#f3d27a'; g.font = '900 56px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('文 星 高 照', W / 2, H / 2 + 3);
    }) }));
    cloth.position.set(0, 0.55, ALTAR_Z + 0.66); S.add(cloth);
    const topBoard = new THREE.Mesh(new THREE.BoxGeometry(TW + 0.2, 0.08, 1.4), lam('#5a1a14')); topBoard.position.set(0, 1.03, ALTAR_Z); S.add(topBoard);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(TW + 0.24, 0.04, 0.04), goldM); edge.position.set(0, 1.05, ALTAR_Z + 0.71); S.add(edge);
    // 燭台（兩端，金色底座）
    [-1, 1].forEach(sd => {
      const x = sd * (TW / 2 - 0.35), base = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.17, 0.12, 12), goldM); base.position.set(x, 1.13, ALTAR_Z - 0.3); S.add(base);
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.6), lam('#d23a2a')); c.position.set(x, 1.48, ALTAR_Z - 0.3); S.add(c);
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), basic('#ffcc66')); f.scale.y = 1.6; f.position.set(x, 1.86, ALTAR_Z - 0.3); S.add(f);
      // 花瓶插花
      const vx = sd * (TW / 2 - 1.0), vase = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.42, 14), lam('#2f6fa8')); vase.position.set(vx, 1.28, ALTAR_Z - 0.38); S.add(vase);
      const neck = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 6, 14), goldM); neck.rotation.x = Math.PI / 2; neck.position.set(vx, 1.49, ALTAR_Z - 0.38); S.add(neck);
      for (let k = 0; k < 7; k++) {
        const a = k * 0.9, st = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.36), lam('#3f7a3a')); st.position.set(vx + Math.cos(a) * 0.05, 1.66, ALTAR_Z - 0.38 + Math.sin(a) * 0.05); st.rotation.set(Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3); S.add(st);
        const fl = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), lam(['#e8c15a', '#f2a0b8', '#c8352b', '#f4efe2'][k % 4])); fl.position.set(vx + Math.cos(a) * 0.12, 1.84 + (k % 3) * 0.04, ALTAR_Z - 0.38 + Math.sin(a) * 0.1); S.add(fl);
      }
      // 水果塔（桌子後排）
      const fx = sd * 2.2, plate = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.05, 16), lam('#f4efe2')); plate.position.set(fx, 1.1, ALTAR_Z - 0.4); S.add(plate);
      [[0, 0, 0], [0.11, 0, 0.06], [-0.11, 0, 0.06], [0, 0, -0.12], [0.06, 0.13, 0], [-0.06, 0.13, 0], [0, 0.24, 0]].forEach(([dx, dy, dz]) => {
        const o = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), lam(sd < 0 ? '#f0902a' : '#e8402a')); o.position.set(fx + dx, 1.2 + dy, ALTAR_Z - 0.4 + dz); S.add(o);
      });
    });
    // 小香爐
    const small = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.26, 0.3, 16), lam('#9a7a3a')); small.position.set(0, 1.22, ALTAR_Z - 0.35); S.add(small);
    // 供品區：桌子前半。正中間被文昌爐擋住，所以自己的擺在爐子左邊，其他人的往兩邊擺
    this.offeringSlots = new THREE.Group(); this.offeringSlots.position.set(0, 1.07, ALTAR_Z + 0.22); S.add(this.offeringSlots);
    this.myOffer = null; this.otherOffers = [];
    // 拜墊（可以跪的）
    const cushionM = lam('#b8322a'), cushionTop = lam('#d8473a');
    // 用 InstancedMesh 一次畫完所有拜墊，人多拜墊多時手機也不會卡
    const cBody = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.42, 0.45, 0.16, 18), cushionM, CUSHIONS.length);
    const ringG = new THREE.TorusGeometry(0.3, 0.03, 6, 18); ringG.rotateX(Math.PI / 2);
    const cRing = new THREE.InstancedMesh(ringG, cushionTop, CUSHIONS.length);
    const mtx = new THREE.Matrix4();
    CUSHIONS.forEach((c, i) => { mtx.makeTranslation(c.x, 0.08, c.z); cBody.setMatrixAt(i, mtx); mtx.makeTranslation(c.x, 0.165, c.z); cRing.setMatrixAt(i, mtx); });
    S.add(cBody, cRing); this.cushionMeshes = [cBody];
    // 籤筒桌
    const st = new THREE.Mesh(new THREE.BoxGeometry(1, 0.9, 1), lam('#6a2a1e')); st.position.set(6.4, 0.45, -17.6); S.add(st);
    const tube = new THREE.Group(); tube.position.set(6.4, 0.9, -17.6); S.add(tube); this.qianTube = tube;
    const tb = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.55, 16, 1, true), lam('#8a5a2a', { side: THREE.DoubleSide })); tb.position.y = 0.28; tube.add(tb);
    for (let i = 0; i < 18; i++) {
      const a = i * 2.4, r = 0.05 + (i % 3) * 0.04;
      const stick = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.75, 0.01), lam('#d9b77a')); stick.position.set(Math.cos(a) * r, 0.5, Math.sin(a) * r); stick.rotation.z = Math.cos(a) * 0.12; tube.add(stick);
    }
  }

  addLantern(x, y, z) {
    const g = new THREE.Group(); g.position.set(x, y, z);
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12), lam('#d8322a', { emissive: '#3a0800' })); m.scale.y = 1.15; g.add(m);
    const capT = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.1), lam('#2a1a10')); capT.position.y = 0.4; g.add(capT);
    const capB = capT.clone(); capB.position.y = -0.4; g.add(capB);
    const tas = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, 0.3), lam('#e8b84a')); tas.position.y = -0.6; g.add(tas);
    this.scene.add(g); this.lanterns.push(m); return g;
  }

  buildGate() {
    const S = this.scene, red = lam('#a12c22'), G = L.GZ, CW = L.CW;
    [-2.9, 2.9].forEach(x => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 4, 12), red); p.position.set(x, 2, G); S.add(p); });
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(7, 0.5, 0.6), lam('#2a4f8a')); lintel.position.set(0, 4.1, G); S.add(lintel);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 5.2, 1.3, 4, 1), lam('#b5543a')); roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, 0.3); roof.position.set(0, 4.95, G); S.add(roof);
    const pt = plaqueTex('文昌祠', { w: 512, h: 170, font: 110 });
    const pl = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 0.1), [lam('#d8ab45'), lam('#d8ab45'), lam('#d8ab45'), lam('#d8ab45'), basic('#fff', { map: pt }), basic('#fff', { map: pt })]);
    pl.position.set(0, 3.45, G + 0.3); S.add(pl);
    [-1.6, 1.6].forEach(x => this.addLantern(x, 3.4, G + 0.4));
    // 圍牆
    const wallM = lam('#a5473a'), capM = lam('#2f6b5c');
    const seg = (x, z, w, d) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 2.2, d), wallM); m.position.set(x, 1.1, z); S.add(m); const c = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.2, d + 0.2), capM); c.position.set(x, 2.3, z); S.add(c); };
    const fw = CW + 0.5 - 3.3;
    seg(-(3.3 + fw / 2), G + 0.1, fw, 0.5); seg(3.3 + fw / 2, G + 0.1, fw, 0.5);
    const sd = G - L.HF + 0.4;
    seg(-(CW + 0.25), L.HF + sd / 2 - 0.2, 0.5, sd); seg(CW + 0.25, L.HF + sd / 2 - 0.2, 0.5, sd);
    // 圍牆接到正殿兩側
    seg(-(L.HW + CW) / 2 - 0.2, L.HF, CW - L.HW + 0.5, 0.5); seg((L.HW + CW) / 2 + 0.2, L.HF, CW - L.HW + 0.5, 0.5);
  }

  buildCourt() {
    // 石獅（簡化）一對
    [-2.4, 2.4].forEach(x => {
      const g = new THREE.Group(); g.position.set(x, 0, L.GZ - 1.4);
      const ped = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.9), lam('#8f8476')); ped.position.y = 0.35; g.add(ped);
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 10), lam('#a59a8a')); body.scale.set(0.9, 1.1, 1); body.position.y = 1.05; g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.33, 14, 10), lam('#a59a8a')); head.position.set(0, 1.55, 0.1); g.add(head);
      const mane = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.1, 8, 16), lam('#8f8476')); mane.position.set(0, 1.55, 0.05); g.add(mane);
      this.scene.add(g); g.rotation.y = Math.PI;
    });
  }

  buildGod() {
    // 神龕＋文昌帝君：藍底金紋官袍、紅白袖緣、展角官帽、長鬚，右手持笏、左手捧書，坐在金獅扶手的寶座上
    const S = this.scene, gold = lam('#d8ab45'), shrineM = lam('#4a1610'), wood = lam('#3a1a12');
    const sh = new THREE.Group(); sh.position.set(0, 0, -20.7); S.add(sh);
    const base = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.6, 2), shrineM); base.position.y = 0.8; sh.add(base);
    const baseTrim = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.12, 2.05), gold); baseTrim.position.y = 1.56; sh.add(baseTrim);
    // 背後的藍底金雲龍壁
    const mural = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 3.8), lam('#fff', { map: canvasTex(512, 440, (g, W, H) => {
      const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#2c3f63'); bg.addColorStop(1, '#1d2b48'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
      g.lineCap = 'round';
      for (let i = 0; i < 46; i++) { // 祥雲
        const x = Math.random() * W, y = Math.random() * H, r = 10 + Math.random() * 22;
        g.strokeStyle = `rgba(214,176,92,${0.35 + Math.random() * 0.35})`; g.lineWidth = 2 + Math.random() * 2;
        g.beginPath(); for (let a = 0; a < 9; a += 0.2) { const rr = r * (1 - a / 11); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.7); } g.stroke();
      }
      g.strokeStyle = 'rgba(226,190,110,.55)'; g.lineWidth = 9; // 龍身
      [[60, 120], [380, 300]].forEach(([x0, y0]) => { g.beginPath(); for (let t = 0; t < 1; t += 0.02) g.lineTo(x0 + t * 160, y0 + Math.sin(t * 9) * 34 - t * 50); g.stroke(); });
    }) }));
    mural.position.set(0, 3.45, -0.8); sh.add(mural);
    const muralFrame = new THREE.Mesh(new THREE.BoxGeometry(4.6, 4.0, 0.12), wood); muralFrame.position.set(0, 3.45, -0.88); sh.add(muralFrame);
    const pt = plaqueTex('文昌帝君', { vertical: false, w: 512, h: 120, font: 80, bg: '#2a1410' });
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.52), basic('#fff', { map: pt })); pl.position.set(0, 5.62, -0.7); sh.add(pl);
    // 側邊直式牌位
    const vt = plaqueTex('文昌帝君', { vertical: true, w: 150, h: 520, font: 100, bg: '#4a1a14', fg: '#e8c15a' });
    [-1.82, 1.82].forEach(x => { const v = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.75), basic('#fff', { map: vt })); v.position.set(x, 3.7, -0.72); sh.add(v); });
    [-2.15, 2.15].forEach(x => { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4, 10), gold); c.position.set(x, 3.5, -0.6); sh.add(c); });

    // 寶座：椅背＋金獅扶手
    const throne = new THREE.Group(); throne.position.set(0, 1.6, -0.25); sh.add(throne);
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.3, 0.18), wood); back.position.set(0, 1.15, -0.5); throne.add(back);
    const backTrim = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.12, 0.22), gold); backTrim.position.set(0, 2.32, -0.5); throne.add(backTrim);
    [-1, 1].forEach(s => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.55, 1.1), wood); arm.position.set(1.0 * s, 0.4, 0.05); throne.add(arm);
      const lion = new THREE.Group(); lion.position.set(1.0 * s, 0.8, 0.55); throne.add(lion);
      const lh = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), gold); lion.add(lh);
      const mane = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.06, 6, 14), lam('#b8892e')); mane.position.z = -0.03; lion.add(mane);
      const snout = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), gold); snout.position.set(0, -0.04, 0.14); lion.add(snout);
      [-1, 1].forEach(e => { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), lam('#3a1a10')); eye.position.set(0.06 * e, 0.05, 0.14); lion.add(eye); });
    });

    // 官袍布料：藍底金色雲紋與團花
    const robeTex = canvasTex(256, 256, (g, W, H) => {
      g.fillStyle = '#2d4f8e'; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 26; i++) {
        const x = Math.random() * W, y = Math.random() * H;
        g.strokeStyle = 'rgba(232,193,90,.85)'; g.lineWidth = 2.5; g.beginPath(); g.arc(x, y, 9 + Math.random() * 8, 0, Math.PI * 1.6); g.stroke();
        g.beginPath(); g.arc(x + 10, y + 4, 6, Math.PI, Math.PI * 2.4); g.stroke();
      }
      for (let i = 0; i < 9; i++) { const x = Math.random() * W, y = Math.random() * H; g.fillStyle = ['#c8352b', '#f3efe2', '#e2b13c'][i % 3]; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); }
    });
    robeTex.wrapS = robeTex.wrapT = THREE.RepeatWrapping; robeTex.repeat.set(2, 2);
    const robe = lam('#fff', { map: robeTex }), red = lam('#b8322a'), white = lam('#f4efe2'), skin = lam('#efc9a3'), black = lam('#161414');

    const god = new THREE.Group(); god.position.set(0, 1.6, -0.2); sh.add(god); this.god = god;
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.92, 0.75, 24), robe); lower.position.y = 0.37; god.add(lower);
    const knees = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.38, 0.8), robe); knees.position.set(0, 0.32, 0.38); god.add(knees);
    const drape = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.42, 0.08), robe); drape.position.set(0, 0.14, 0.8); god.add(drape);
    [-1, 1].forEach(s => { const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.3), white); shoe.position.set(0.32 * s, 0.07, 0.86); god.add(shoe); });
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.64, 0.9, 24), robe); torso.position.y = 1.15; god.add(torso);
    // 交領：紅底白邊
    [-1, 1].forEach(s => {
      const lap = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.62, 0.04), red); lap.position.set(0.1 * s, 1.36, 0.47); lap.rotation.z = 0.5 * s; god.add(lap);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.62, 0.045), white); edge.position.set(0.15 * s, 1.36, 0.48); edge.rotation.z = 0.5 * s; god.add(edge);
    });
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.06, 8, 24), gold); belt.rotation.x = Math.PI / 2; belt.position.y = 0.78; god.add(belt);
    const jade = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.05), lam('#2f8a6e')); jade.position.set(0, 0.78, 0.62); god.add(jade);
    // 寬袖子（袖口紅白滾邊）＋手
    // 袖子往前內收，手在胸前握著笏和書
    [-1, 1].forEach(s => {
      const sl = new THREE.Group(); sl.position.set(0.55 * s, 1.32, 0.18); sl.rotation.set(-0.72, 0, -0.18 * s); god.add(sl);
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.27, 0.7, 16), robe); sleeve.position.y = -0.33; sl.add(sleeve);
      const cuffR = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.045, 6, 18), red); cuffR.rotation.x = Math.PI / 2; cuffR.position.y = -0.66; sl.add(cuffR);
      const cuffW = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 6, 18), white); cuffW.rotation.x = Math.PI / 2; cuffW.position.y = -0.69; sl.add(cuffW);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), skin); hand.scale.set(1, 1.15, 0.9); hand.position.y = -0.78; sl.add(hand);
    });
    // 右手（神像的右邊＝畫面左邊）持笏
    const hu = new THREE.Group(); hu.position.set(-0.4, 1.18, 0.86); hu.rotation.set(-0.15, 0, 0.18); god.add(hu);
    const huBody = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.95, 0.04), gold); hu.add(huBody);
    const huInlay = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.82, 0.045), lam('#7a5a24')); hu.add(huInlay);
    // 左手捧書（書背寫「文昌帝君」）
    const books = new THREE.Group(); books.position.set(0.38, 0.98, 0.84); books.rotation.set(-0.2, -0.25, -0.05); god.add(books);
    const cover = canvasTex(96, 128, (g, W, H) => { g.fillStyle = '#23305a'; g.fillRect(0, 0, W, H); g.fillStyle = '#f4ecd6'; g.fillRect(30, 12, 36, 104); g.fillStyle = '#2a1a10'; g.font = '700 22px serif'; g.textAlign = 'center'; [...'文昌帝君'].forEach((c, i) => g.fillText(c, 48, 36 + i * 24)); });
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.055), [lam('#f4ecd6'), lam('#f4ecd6'), lam('#f4ecd6'), lam('#f4ecd6'), i === 3 ? lam('#fff', { map: cover }) : lam('#23305a'), lam('#23305a')]);
      b.position.set(i * 0.012, 0, i * 0.058); books.add(b);
    }
    // 頭、臉
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.46, 24, 18), skin); head.scale.set(0.95, 1.05, 0.95); head.position.y = 2.02; god.add(head);
    [-1, 1].forEach(s => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), black); eye.scale.set(1.3, 0.6, 0.5); eye.position.set(0.15 * s, 2.08, 0.42); god.add(eye);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.035, 0.03), black); brow.position.set(0.15 * s, 2.17, 0.42); brow.rotation.z = -0.25 * s; god.add(brow);
      const mus = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.14, 4, 6), black); mus.position.set(0.08 * s, 1.88, 0.44); mus.rotation.z = (Math.PI / 2 - 0.45) * s; god.add(mus);
      const whisk = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.42, 4, 6), black); whisk.position.set(0.24 * s, 1.68, 0.3); whisk.rotation.z = 0.12 * s; god.add(whisk);
    });
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), skin); nose.position.set(0, 1.99, 0.46); god.add(nose);
    const lips = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.025, 0.02), lam('#a2402e')); lips.position.set(0, 1.85, 0.45); god.add(lips);
    // 長鬚：從下巴一路垂到胸前
    const beard = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.05, 14), lam('#1e1a18')); beard.rotation.x = Math.PI; beard.scale.z = 0.45; beard.position.set(0, 1.33, 0.48); god.add(beard);
    // 官帽：黑底金飾、前方綠寶石、頂上藍珠、兩側展角
    const hatG = new THREE.Group(); hatG.position.y = 2.42; god.add(hatG);
    const hatBase = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.47, 0.32, 24), black); hatG.add(hatBase);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.035, 6, 24), gold); band.rotation.x = Math.PI / 2; band.position.y = -0.13; hatG.add(band);
    const crown = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.34, 0.5), black); crown.position.set(0, 0.3, -0.05); hatG.add(crown);
    const crownTrim = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.05, 0.54), gold); crownTrim.position.set(0, 0.48, -0.05); hatG.add(crownTrim);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.04), gold); plate.position.set(0, 0.02, 0.45); hatG.add(plate);
    const gem = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), lam('#1f8a6a')); gem.position.set(0, 0.02, 0.48); hatG.add(gem);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), lam('#2a2f6a')); knob.position.set(0, 0.6, 0.05); hatG.add(knob);
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.14, 8), gold); spike.position.set(0, 0.36, 0.22); hatG.add(spike);
    [-1, 1].forEach(s => {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.07, 0.05), black); wing.position.set(0.72 * s, 0.12, -0.22); hatG.add(wing);
      const wt = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.025, 0.06), gold); wt.position.set(0.72 * s, 0.12, -0.21); hatG.add(wt);
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.06), gold); tip.position.set(1.02 * s, 0.12, -0.22); hatG.add(tip);
    });
    // 神前光
    this.godLight = new THREE.PointLight(0xffc27a, 7, 10, 1.6); this.godLight.position.set(0, 3.4, -17.6); S.add(this.godLight);
  }

  buildCenser() {
    const S = this.scene, bronze = lam('#6e5a3a');
    const g = new THREE.Group(); g.position.set(0, 0, L.CZ); S.add(g); this.censer = g;
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.5, 8), lam('#8f8476')); ped.position.y = 0.25; g.add(ped);
    [0, 2.1, 4.2].forEach(a => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.6), bronze); l.position.set(Math.cos(a) * 0.55, 0.75, Math.sin(a) * 0.55); g.add(l); });
    const pot = new THREE.Mesh(new THREE.SphereGeometry(0.85, 24, 14, 0, Math.PI * 2, Math.PI * 0.3, Math.PI * 0.7), bronze); pot.position.y = 1.55; pot.scale.y = 0.75; g.add(pot);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.08, 8, 24), lam('#8a7448')); rim.rotation.x = Math.PI / 2; rim.position.y = 2.0; g.add(rim);
    [-1, 1].forEach(s => { const e = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 6, 12), bronze); e.position.set(0.86 * s, 2.05, 0); e.rotation.y = Math.PI / 2; g.add(e); });
    const ash = new THREE.Mesh(new THREE.CircleGeometry(0.7, 24), lam('#9a8f80')); ash.rotation.x = -Math.PI / 2; ash.position.y = 1.95; g.add(ash);
    const plq = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.3), basic('#fff', { map: plaqueTex('天公爐', { w: 300, h: 100, font: 62, bg: '#5a4024', fg: '#f3d27a' }) }));
    plq.position.set(0, 1.45, 0.66); g.add(plq);
    const plq2 = plq.clone(); plq2.position.z = -0.66; plq2.rotation.y = Math.PI; g.add(plq2);
    // 已插的香
    this.sticks = new THREE.Group(); this.sticks.position.y = 1.95; g.add(this.sticks);
    for (let i = 0; i < 26; i++) this.addStick(Math.random() * 6.28, Math.random() * 0.55, 0.3 + Math.random() * 0.4);
    this.smokes = [];
    this.addSmoke(new THREE.Vector3(0, 2.1, L.CZ), 60, 0.6, 3.2, 0.3);
  }
  addStick(a, r, h, group = this.sticks) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, h), lam('#7a3a2a')); s.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), basic('#ff8a3a')); tip.position.y = h / 2; s.add(tip);
    group.add(s); return s;
  }
  // 煙：香爐的香煙、金爐的煙
  addSmoke(pos, N, size, rise, spread, color = 0xeeeeee, opacity = 0.22) {
    const arr = new Float32Array(N * 3), geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    this.smokeTex ||= canvasTex(64, 64, (c) => { const gr = c.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, 64, 64); });
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size, map: this.smokeTex, transparent: true, opacity, depthWrite: false, color }));
    pts.position.copy(pos); this.scene.add(pts);
    const sm = { N, arr, pts, rise, spread, life: new Float32Array(N).map(() => Math.random()) }; this.smokes.push(sm); return sm;
  }

  // 文昌帝君專屬香爐（文昌爐）：在主拜墊和供桌之間
  buildWenchangCenser() {
    const S = this.scene, bronze = lam('#7a6236'), gold = lam('#d8ab45');
    const g = new THREE.Group(); g.position.set(0, 0, WC_CENSER_Z); S.add(g); this.wcCenser = g;
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.75, 8), lam('#5a1a14')); stand.position.y = 0.375; g.add(stand);
    const standTop = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 8), gold); standTop.position.y = 0.78; g.add(standTop);
    [0, 2.1, 4.2].forEach(a => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.25), bronze); l.position.set(Math.cos(a) * 0.28, 0.92, Math.sin(a) * 0.28); g.add(l); });
    const pot = new THREE.Mesh(new THREE.SphereGeometry(0.42, 22, 12, 0, Math.PI * 2, Math.PI * 0.3, Math.PI * 0.7), bronze); pot.position.y = 1.3; pot.scale.y = 0.75; g.add(pot);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.045, 8, 22), gold); rim.rotation.x = Math.PI / 2; rim.position.y = 1.52; g.add(rim);
    [-1, 1].forEach(s => { const e = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 6, 12), gold); e.position.set(0.43 * s, 1.55, 0); e.rotation.y = Math.PI / 2; g.add(e); });
    const ash = new THREE.Mesh(new THREE.CircleGeometry(0.35, 22), lam('#9a8f80')); ash.rotation.x = -Math.PI / 2; ash.position.y = 1.5; g.add(ash);
    const plq = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.17), basic('#fff', { map: plaqueTex('文昌爐', { w: 300, h: 100, font: 62, bg: '#5a4024', fg: '#f3d27a' }) }));
    plq.position.set(0, 1.18, 0.33); g.add(plq);
    this.wcSticks = new THREE.Group(); this.wcSticks.position.y = 1.5; g.add(this.wcSticks);
    for (let i = 0; i < 14; i++) this.addStick(Math.random() * 6.28, Math.random() * 0.26, 0.22 + Math.random() * 0.3, this.wcSticks);
    this.addSmoke(new THREE.Vector3(0, 1.6, WC_CENSER_Z), 36, 0.4, 2.4, 0.18);
  }

  // 金爐：燒金紙的地方（中庭右前方）
  buildJinlu() {
    const S = this.scene, brick = lam('#a8452f'), dark = lam('#2a140e'), gold = lam('#d8ab45'), roofM = lam('#2f6b5c');
    const g = new THREE.Group(); g.position.set(JINLU.x, 0, JINLU.z); S.add(g); this.jinlu = g; // 爐口在 -z，朝向中庭的人
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.35, 0.4, 6), lam('#8f8476')); base.position.y = 0.2; g.add(base);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.1, 1.7, 6), brick); body.position.y = 1.25; g.add(body);
    const mid = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.95, 0.9, 6), brick); mid.position.y = 2.55; g.add(mid);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.65, 0.7, 6), brick); top.position.y = 3.35; g.add(top);
    [[2.12, 1.25], [3.03, 0.95], [3.72, 0.7]].forEach(([y, r]) => { const eave = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.75, r + 0.18, 0.18, 6), roofM); eave.position.y = y; g.add(eave); });
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.6, 6), roofM); cap.position.y = 4.1; g.add(cap);
    const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), gold); pearl.position.y = 4.48; g.add(pearl);
    // 爐口與火光（朝玩家那一面）
    const mouthFrame = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.75, 0.1), dark); mouthFrame.position.set(0, 1.3, -0.97); g.add(mouthFrame);
    const flameTex = canvasTex(128, 104, (c, W, H) => {
      c.fillStyle = '#1a0805'; c.fillRect(0, 0, W, H);
      const gr = c.createRadialGradient(W / 2, H * 0.9, 4, W / 2, H * 0.75, H * 0.85);
      gr.addColorStop(0, '#fff2b0'); gr.addColorStop(0.3, '#ffb23a'); gr.addColorStop(0.65, '#e8461c'); gr.addColorStop(1, 'rgba(60,10,4,0)');
      c.fillStyle = gr; c.fillRect(0, 0, W, H);
      c.fillStyle = 'rgba(255,220,120,.85)';
      for (let i = 0; i < 6; i++) { const x = 14 + i * 20; c.beginPath(); c.moveTo(x - 9, H); c.quadraticCurveTo(x - 6, H * 0.45, x, H * (0.2 + (i % 3) * 0.12)); c.quadraticCurveTo(x + 6, H * 0.45, x + 9, H); c.fill(); }
    });
    this.fireMat = new THREE.MeshBasicMaterial({ map: flameTex, color: 0xffffff });
    const fire = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.58), this.fireMat); fire.position.set(0, 1.3, -1.03); fire.rotation.y = Math.PI; g.add(fire); this.fire = fire;
    const plq = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.3), basic('#fff', { map: plaqueTex('金爐', { w: 300, h: 110, font: 70, bg: '#5a4024', fg: '#f3d27a' }) }));
    plq.position.set(0, 1.95, -0.98); plq.rotation.y = Math.PI; g.add(plq);
    this.fireBoost = 0;
    this.jinluSmoke = this.addSmoke(new THREE.Vector3(JINLU.x, 4.4, JINLU.z), 40, 0.9, 3.5, 0.35, 0xcfc6bb, 0.25);
  }
  // 丟一疊金紙進金爐：從玩家手上飛進爐口，火光變大
  burnPaper(from, kind = 0) {
    const cols = ['#e6c04a', '#d9a63a', '#c99a3a'];
    const tex = canvasTex(64, 64, (c) => { c.fillStyle = cols[kind % 3]; c.fillRect(0, 0, 64, 64); c.fillStyle = '#c8352b'; c.fillRect(22, 22, 20, 20); c.strokeStyle = '#8a5a14'; c.strokeRect(2, 2, 60, 60); });
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.34), [lam(cols[kind % 3]), lam(cols[kind % 3]), lam('#fff', { map: tex }), lam(cols[kind % 3]), lam(cols[kind % 3]), lam(cols[kind % 3])]);
    const sx = from.x, sz = from.z, ex = JINLU.x, ez = JINLU.z - 0.95;
    m.position.set(sx, 1.1, sz); this.scene.add(m);
    this.tween(700, k => { m.position.set(sx + (ex - sx) * k, 1.1 + Math.sin(k * Math.PI) * 0.7 + 0.2 * k, sz + (ez - sz) * k); m.rotation.set(k * 3, k * 2, 0); m.scale.setScalar(1 - 0.6 * k); }, 0, t => t * (2 - t));
    setTimeout(() => { this.scene.remove(m); this.fireBoost = 1; }, 720);
    return new Promise(r => setTimeout(r, 900));
  }

  buildCounter() {
    const S = new THREE.Group(); S.position.set(-10, 0, 4); this.scene.add(S); // 以第一版座標畫，整組移到新位置
    const c = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 4), lam('#7a3a24')); c.position.set(-7.7, 0.55, 7); S.add(c);
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 4.2), lam('#4a1e12')); top.position.set(-7.7, 1.12, 7); S.add(top);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.15, 4.8), lam('#2f6b5c')); roof.position.set(-7.9, 2.6, 7); roof.rotation.z = -0.15; S.add(roof);
    [5, 9].forEach(z => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.5), lam('#5a2a1a')); p.position.set(-8.4, 1.9, z); S.add(p); });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.45), basic('#fff', { map: plaqueTex('辦事處', { w: 360, h: 120, font: 70 }) }));
    sign.position.set(-6.85, 2.3, 7); sign.rotation.y = Math.PI / 2; S.add(sign);
    // 櫃台上的香與供品籃
    for (let i = 0; i < 12; i++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.6), lam('#8a3a2a')); s.position.set(-7.5 + (i % 3) * 0.05, 1.45, 5.6 + Math.floor(i / 3) * 0.05); S.add(s); }
    const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.25, 0.25, 12), lam('#b08a4a')); basket.position.set(-7.6, 1.28, 7.6); S.add(basket);
    [[0x4f9a3a, 0], [0xf3efe2, 1], [0xf6ead2, 2]].forEach(([c, i]) => { const b = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), lam(c)); b.position.set(-7.7 + i * 0.12, 1.45, 7.55 + (i % 2) * 0.1); S.add(b); });
  }

  // 靈犀占卜電子牆：祈福牆旁邊一面會發光的螢幕，點了在遊戲裡打開「靈犀」
  buildLingxiScreen() {
    const S = this.scene, g = new THREE.Group(); g.position.set(18.7, 0, 14.6); g.rotation.y = -Math.PI / 2; S.add(g);
    const frameM = lam('#2a1a14'), gold = lam('#d8ab45');
    [-1.75, 1.75].forEach(x => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3.6, 0.18), frameM); p.position.set(x, 1.8, 0); g.add(p); });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.4, 0.16), frameM); frame.position.set(0, 2.25, -0.04); g.add(frame);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.08, 0.2), gold); trim.position.set(0, 3.49, 0); g.add(trim);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.14, 0.7), lam('#2f6b5c')); roof.position.set(0, 3.62, 0); g.add(roof);
    // 螢幕畫面：一張 canvas，持續換頁顯示各種占卜
    const c = document.createElement('canvas'); c.width = 640; c.height = 400; this.lxCanvas = c;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; this.lxTex = tex;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(3.36, 2.1), new THREE.MeshBasicMaterial({ map: tex }));
    screen.position.set(0, 2.25, 0.045); g.add(screen); this.lxScreen = screen;
    this.lxFrame = 0; this.drawLingxi(0);
  }
  drawLingxi(t) {
    const c = this.lxCanvas, g = c.getContext('2d'), W = c.width, H = c.height;
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#16123a'); bg.addColorStop(1, '#3a1636'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) { const x = (i * 97 + t * 8) % W, y = (i * 53) % H; g.fillStyle = `rgba(255,236,190,${0.25 + 0.25 * Math.sin(t * 2 + i)})`; g.fillRect(x, y, 2, 2); }
    g.textAlign = 'center'; g.fillStyle = '#f6dc94'; g.font = '900 54px "Noto Serif TC",serif'; g.fillText('靈犀 LINGXI', W / 2, 70);
    g.fillStyle = '#e8d9f2'; g.font = '700 26px "Noto Serif TC",serif'; g.fillText('線上算命占卜・點我打開', W / 2, 110);
    const items = ['今日運勢', '星座', '解夢', '塔羅', '易卦', '紫微', '流年', '合婚', '擇日', '拜拜', '風水', '改名'];
    const hi = Math.floor(t * 1.2) % items.length;
    items.forEach((n, i) => {
      const col = i % 4, row = Math.floor(i / 4), x = 90 + col * 153, y = 165 + row * 72;
      g.fillStyle = i === hi ? 'rgba(232,193,90,.9)' : 'rgba(255,255,255,.08)'; g.strokeStyle = 'rgba(232,193,90,.7)'; g.lineWidth = 2;
      g.beginPath(); g.roundRect(x - 66, y - 30, 132, 52, 14); g.fill(); g.stroke();
      g.fillStyle = i === hi ? '#2a1410' : '#fff4d6'; g.font = '700 26px "Noto Serif TC",serif'; g.fillText(n, x, y + 6);
    });
    this.lxTex.needsUpdate = true;
  }

  // 廣場：讀書角、許願池、光明燈牆
  buildPlaza() {
    const S0 = this.scene, wood = lam('#7a4a2a'), dark = lam('#4a2a1a');
    // 可以點的地方：點書桌、池子、合照牌子就開始
    this.places = [];
    const grp = id => { const g = new THREE.Group(); S0.add(g); this.places.push([id, g]); return g; };
    let S = grp('study');
    DESKS.forEach(d => {
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.5), wood); top.position.set(d.x, 0.78, d.z - 0.7); S.add(top);
      [-0.52, 0.52].forEach(dx => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.74, 0.44), dark); l.position.set(d.x + dx, 0.37, d.z - 0.7); S.add(l); });
      const book = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.26), lam('#e8e0c8')); book.position.set(d.x, 0.84, d.z - 0.66); S.add(book);
      const cover = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.28), lam('#2a4f8a')); cover.position.set(d.x + 0.4, 0.86, d.z - 0.72); S.add(cover);
      const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.3, 12), dark); stool.position.set(d.x, 0.15, d.z); S.add(stool);
    });
    // 兩面各貼一張，從殿那邊或書桌那邊看都是正的字
    const twoSided = (map, w, h, y) => [[0, 1.62], [Math.PI, 1.58]].forEach(([r, z]) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), basic('#fff', { map })); m.position.set(-11, y, z); m.rotation.y = r; S.add(m); });
    twoSided(plaqueTex('一起讀書角', { w: 512, h: 128, font: 80, bg: '#2a4f8a', fg: '#f6dc94' }), 2.4, 0.6, 1.9);
    // 告示板：今天大家一起專注了幾分鐘、現在幾個人在讀書
    const bc = document.createElement('canvas'); bc.width = 512; bc.height = 128; this.studyCanvas = bc;
    this.studyTex = new THREE.CanvasTexture(bc); this.studyTex.colorSpace = THREE.SRGBColorSpace;
    twoSided(this.studyTex, 2.4, 0.6, 1.22);
    this.drawStudyBoard(0, 0);
    [-12.3, -9.7].forEach(x => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.9), dark); p.position.set(x, 0.95, 1.6); S.add(p); });
    // 許願池
    S = grp('pool');
    const P = POOL;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(P.r, 0.22, 10, 36), lam('#9a8a78')); rim.rotation.x = Math.PI / 2; rim.position.set(P.x, 0.3, P.z); S.add(rim);
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(P.r, P.r, 0.3, 36, 1, true), lam('#8a7a68', { side: THREE.DoubleSide })); wall.position.set(P.x, 0.15, P.z); S.add(wall);
    const water = new THREE.Mesh(new THREE.CircleGeometry(P.r - 0.05, 36), lam('#3f8fa8', { emissive: '#0a2a3a' })); water.rotation.x = -Math.PI / 2; water.position.set(P.x, 0.24, P.z); S.add(water);
    this.coins = new THREE.Group(); S.add(this.coins);
    for (let i = 0; i < 26; i++) { const a = i * 2.4, r = 0.2 + (i % 5) * 0.28; this.dropCoin(P.x + Math.cos(a) * r, P.z + Math.sin(a) * r); }
    const lotus = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), lam('#f2a0b8')); lotus.scale.y = 0.6; lotus.position.set(P.x + 0.5, 0.3, P.z - 0.4); S.add(lotus);
    const pad = new THREE.Mesh(new THREE.CircleGeometry(0.35, 14), lam('#4f8a3a')); pad.rotation.x = -Math.PI / 2; pad.position.set(P.x + 0.5, 0.25, P.z - 0.4); S.add(pad);
    this.ripples = [];
    // 合照打卡點：地上金色圓圈＋立牌
    S = grp('photo');
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.7, 32), basic('#e8c15a', { side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.set(4, 0.03, 11); S.add(ring);
    const spot = new THREE.Mesh(new THREE.CircleGeometry(0.55, 32), basic('#c8352b', { transparent: true, opacity: 0.35 })); spot.rotation.x = -Math.PI / 2; spot.position.set(4, 0.025, 11); S.add(spot);
    const pt = plaqueTex('合照打卡', { w: 512, h: 150, font: 92, bg: '#b8241c', fg: '#f6dc94' });
    const photoSign = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 0.06), [dark, dark, dark, dark, basic('#fff', { map: pt }), basic('#fff', { map: pt })]); photoSign.position.set(5.6, 1.9, 11.4); S.add(photoSign);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.65), dark); post.position.set(5.6, 0.82, 11.4); S.add(post);
    const tip = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.3), basic('#fff', { map: plaqueTex('站進圓圈拍照', { w: 512, h: 96, font: 56, bg: '#2a1410', fg: '#f6dc94' }), side: THREE.DoubleSide }));
    tip.position.set(5.6, 1.45, 11.44); S.add(tip);
    // 光明燈牆（殿內左側牆，兩扇圓窗中間）
    const g = new THREE.Group(); g.position.set(-14.8, 0, -8.25); g.rotation.y = Math.PI / 2; S0.add(g);
    const c = document.createElement('canvas'); c.width = 512; c.height = 448; this.lampCanvas = c;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; this.lampTex = tex;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.98), basic('#fff', { map: tex })); board.position.set(0, 2.45, 0.06); g.add(board); this.lampBoard = board;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(3.6, 3.18, 0.08), lam('#d8ab45')); frame.position.set(0, 2.45, 0); g.add(frame);
    this.drawLamps([]);
    this.feet = [];
  }
  drawStudyBoard(total, now) {
    const g = this.studyCanvas.getContext('2d'), W = 512, H = 128;
    g.fillStyle = '#1f2f4a'; g.fillRect(0, 0, W, H); g.strokeStyle = '#e8c15a'; g.lineWidth = 4; g.strokeRect(4, 4, W - 8, H - 8);
    g.fillStyle = '#f6dc94'; g.textAlign = 'center'; g.font = '700 34px "Noto Serif TC",serif'; g.fillText(`今天大家專注了 ${total} 分鐘`, W / 2, 54);
    g.fillStyle = '#e8eef8'; g.font = '500 26px "Noto Serif TC",serif'; g.fillText(now ? `現在 ${now} 人在讀書・坐下來一起吧` : '坐下來，一起讀書吧', W / 2, 98);
    this.studyTex.needsUpdate = true;
  }
  dropCoin(x, z) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.012, 10), lam('#e8c15a', { emissive: '#3a2600' })); m.position.set(x, 0.245, z); this.coins.add(m);
    if (this.coins.children.length > 80) this.coins.remove(this.coins.children[0]);
  }
  // 丟一枚許願幣：從人手上飛進池子，水面起漣漪
  tossCoin(from) {
    const P = POOL, a = Math.random() * 6.28, r = Math.random() * (P.r - 0.4), ex = P.x + Math.cos(a) * r, ez = P.z + Math.sin(a) * r;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.015, 10), lam('#ffd76a', { emissive: '#7a5410' })); this.scene.add(m);
    return new Promise(res => this.tween(800, k => { m.position.set(from.x + (ex - from.x) * k, 1.2 + Math.sin(k * Math.PI) * 1.2 - k * 0.95, from.z + (ez - from.z) * k); m.rotation.x = k * 12; }, 0, t => t, () => {
      this.scene.remove(m); this.dropCoin(ex, ez); this.ripple(ex, ez); res();
    }));
  }
  ripple(x = POOL.x, z = POOL.z) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.16, 24), new THREE.MeshBasicMaterial({ color: '#e8f6ff', transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.26, z); this.scene.add(m);
    this.tween(1400, k => { m.scale.setScalar(1 + k * 6); m.material.opacity = 0.8 * (1 - k); }, 0, t => t, () => this.scene.remove(m));
  }
  // 光明燈：最多畫 40 盞，點亮的顯示暱稱與考試
  drawLamps(list, label = () => '') {
    const c = this.lampCanvas, g = c.getContext('2d'), W = c.width, H = c.height;
    g.fillStyle = '#3a1410'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#f6dc94'; g.textAlign = 'center'; g.font = '900 34px "Noto Serif TC",serif'; g.fillText('光 明 燈', W / 2, 40);
    g.font = '500 15px "Noto Serif TC",serif'; g.fillStyle = '#e8c9a0'; g.fillText(`考生祈福・點亮七天・目前 ${list.length} 盞`, W / 2, 62);
    const show = list.slice(-40).reverse();
    for (let i = 0; i < 40; i++) {
      const col = i % 8, row = Math.floor(i / 8), x = 34 + col * 63, y = 104 + row * 70, e = show[i];
      if (e) { const gr = g.createRadialGradient(x, y, 2, x, y, 30); gr.addColorStop(0, 'rgba(255,220,120,.9)'); gr.addColorStop(1, 'rgba(255,160,40,0)'); g.fillStyle = gr; g.fillRect(x - 30, y - 30, 60, 60); }
      g.fillStyle = e ? '#ffcf5a' : '#5a2a20'; g.beginPath(); g.ellipse(x, y, 13, 17, 0, 0, 7); g.fill();
      g.fillStyle = e ? '#b8241c' : '#3a1a14'; g.fillRect(x - 9, y - 21, 18, 5); g.fillRect(x - 9, y + 16, 18, 5);
      if (e) { g.fillStyle = '#fff4d6'; g.font = '700 12px sans-serif'; g.fillText(label(e).slice(0, 5), x, y + 36); }
    }
    this.lampTex.needsUpdate = true;
  }

  // 還願紅榜：考上的人回來答謝，名字掛上紅榜
  buildBang() {
    const S = this.scene, g = new THREE.Group(); g.position.set(18.7, 0, 1.8); g.rotation.y = -Math.PI / 2; S.add(g);
    const wood = lam('#3a1a10'), gold = lam('#d8ab45');
    [-1.55, 1.55].forEach(x => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3.3, 0.18), wood); p.position.set(x, 1.65, 0); g.add(p); });
    const roof = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.14, 0.7), lam('#2f6b5c')); roof.position.set(0, 3.38, 0); g.add(roof);
    const c = document.createElement('canvas'); c.width = 512; c.height = 400; this.bangCanvas = c;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; this.bangTex = tex;
    const board = new THREE.Mesh(new THREE.BoxGeometry(3.0, 2.34, 0.1), [gold, gold, gold, gold, basic('#fff', { map: tex }), lam('#8a1a14')]);
    board.position.set(0, 2.0, 0); g.add(board); this.bangBoard = board;
    this.drawBang([]);
  }
  drawBang(list, label = () => '') {
    const c = this.bangCanvas, g = c.getContext('2d'), W = c.width, H = c.height;
    g.fillStyle = '#b8241c'; g.fillRect(0, 0, W, H); g.strokeStyle = '#f3d27a'; g.lineWidth = 6; g.strokeRect(10, 10, W - 20, H - 20);
    g.fillStyle = '#f6dc94'; g.textAlign = 'center'; g.font = '900 52px "Noto Serif TC",serif'; g.fillText('還 願 紅 榜', W / 2, 72);
    g.font = '500 20px "Noto Serif TC",serif'; g.fillStyle = '#ffe9b0'; g.fillText('金榜題名・回來答謝文昌帝君', W / 2, 104);
    const show = list.slice(-12).reverse();
    g.font = '700 24px "Noto Serif TC",serif'; g.fillStyle = '#fff4d6';
    if (!show.length) { g.fillText('等你考上，回來掛第一個名字', W / 2, 220); }
    show.forEach((e, i) => { const col = i % 2, row = Math.floor(i / 2); g.textAlign = 'left'; g.fillText(`✦ ${label(e)}`, 36 + col * 240, 150 + row * 40); });
    this.bangTex.needsUpdate = true;
  }
  // 文昌帝君聖誕：殿前掛紅布條、多掛一排燈籠
  setFestival(on) {
    if (!!this.fest === on) return;
    if (!on) { this.scene.remove(this.fest); this.fest = null; return; }
    const g = new THREE.Group(); this.fest = g; this.scene.add(g);
    const tex = plaqueTex('恭祝 文昌帝君聖誕', { bg: '#c8241c', fg: '#f6dc94', w: 1024, h: 140, font: 92 });
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 0.9), basic('#fff', { map: tex, side: THREE.DoubleSide })); banner.position.set(0, 4.9, L.HF + 0.45); g.add(banner);
    const gt = plaqueTex('文昌聖誕・考生祈福', { bg: '#c8241c', fg: '#f6dc94', w: 1024, h: 140, font: 92 });
    // 山門兩面各一張，從廟裡、廟外看都是正的字
    [[L.GZ + 0.25, 0], [L.GZ - 0.25, Math.PI]].forEach(([z, r]) => { const gb = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 0.7), basic('#fff', { map: gt })); gb.position.set(0, 5.95, z); gb.rotation.y = r; g.add(gb); });
    const before = this.lanterns.length;
    for (let x = -14; x <= 14; x += 2.8) { const l = this.addLantern(x, 5.0, L.HF + 1.2); l.scale.setScalar(0.7); this.scene.remove(l); g.add(l); }
    this.lanterns.length = before;
  }

  buildWall() {
    const S = this.scene, wood = lam('#6a3a22');
    const g = new THREE.Group(); g.position.set(18.4, 0, 8); g.rotation.y = -Math.PI / 2; S.add(g); this.wall = g;
    [-2.6, 2.6].forEach(x => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.2, 0.2), wood); p.position.set(x, 1.6, 0); g.add(p); });
    const roof = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.15, 0.9), lam('#2f6b5c')); roof.position.set(0, 3.3, 0); g.add(roof);
    [1.0, 1.75, 2.5].forEach(y => { const b = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.06, 0.06), wood); b.position.set(0, y, 0); g.add(b); });
    this.cards = [];
    // 牆上的位置：先放裝飾用的空白卡，連線後換成大家掛的卡
    this.slots = [];
    [1.75, 2.5, 1.0].forEach(y => { for (let x = -2.3; x <= 2.3; x += 0.42) this.slots.push({ x: x + (Math.random() - 0.5) * 0.08, y, deco: Math.random() > 0.2 }); });
    // 中間那排正中央留給自己的卡
    this.slots = this.slots.filter(sl => !(Math.abs(sl.x) < 0.4 && sl.y > 1.5));
    this.setSharedCards([]);
  }
  setSharedCards(list, colors = ['#c8352b', '#e2b13c', '#2f7d6d', '#2a2f4a'], label = () => '') {
    this.cardColors = colors; this.cardLabel = label;
    this.slots.forEach(sl => { if (sl.pivot) { this.wall.remove(sl.pivot); this.cards.splice(this.cards.indexOf(sl.pivot), 1); sl.pivot = null; } });
    const shared = list.slice(-this.slots.length);
    this.slots.forEach((sl, i) => {
      const c = shared[i];
      if (c) { sl.pivot = this.addCard(sl.x, sl.y, colors[c.c] || colors[0], this.smallCardTex(colors[c.c] || colors[0], label(c), c.b)); sl.pivot.userData.card = c; }
      else if (sl.deco) { sl.pivot = this.addCard(sl.x, sl.y, colors[i % colors.length]); sl.pivot.userData.card = { deco: true }; }
    });
    this.sharedCount = shared.length;
  }
  // 有人新掛一張卡：放進下一個位置，彈出來
  addSharedCard(c) {
    const i = (this.sharedCount || 0) % this.slots.length, sl = this.slots[i];
    if (sl.pivot) { this.wall.remove(sl.pivot); this.cards.splice(this.cards.indexOf(sl.pivot), 1); }
    const col = this.cardColors[c.c] || this.cardColors[0];
    sl.pivot = this.addCard(sl.x, sl.y, col, this.smallCardTex(col, this.cardLabel(c), c.b)); sl.pivot.userData.card = c;
    sl.pivot.scale.setScalar(0.01); this.tween(500, k => sl.pivot.scale.setScalar(0.01 + 0.99 * k), 0, t => 1 - Math.pow(1 - t, 3));
    this.sharedCount = (this.sharedCount || 0) + 1;
  }
  // 有人加持：更新那張卡上的加持數，卡片輕輕跳一下
  setCardBless(id, b) {
    const sl = this.slots.find(s => s.pivot?.userData.card?.id === id); if (!sl) return null;
    const c = sl.pivot.userData.card; c.b = b; const m = sl.pivot.children[0], col = this.cardColors[c.c] || this.cardColors[0];
    m.material.map?.dispose(); m.material.map = this.smallCardTex(col, this.cardLabel(c), b); m.material.needsUpdate = true;
    this.tween(500, k => sl.pivot.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.35));
    return sl.pivot;
  }
  smallCardTex(hex, text, bless = 0) {
    return canvasTex(96, 160, (g, W, H) => {
      g.fillStyle = hex; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(255,240,200,.7)'; g.lineWidth = 3; g.strokeRect(6, 6, W - 12, H - 12);
      g.fillStyle = hex.toLowerCase() === '#e2b13c' ? '#3a2408' : '#fff4d6'; g.textAlign = 'center'; g.font = '900 22px "Noto Serif TC",serif';
      [...(text || '祈福')].slice(0, 5).forEach((ch, i, a) => g.fillText(ch, W / 2, H / 2 + (i - (a.length - 1) / 2) * 25 + 8 - (bless ? 10 : 0)));
      if (bless) { g.font = '700 17px sans-serif'; g.fillText(`🙏${bless > 99 ? '99+' : bless}`, W / 2, H - 16); }
    });
  }
  addCard(x, y, color, tex) {
    const pivot = new THREE.Group(); pivot.position.set(x, y, 0.05);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.5), tex ? basic('#fff', { map: tex, side: THREE.DoubleSide }) : lam(color, { side: THREE.DoubleSide }));
    m.position.y = -0.3; pivot.add(m);
    const str = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.06), lam('#c8352b')); str.position.y = -0.03; pivot.add(str);
    pivot.userData.ph = Math.random() * 6; this.wall.add(pivot); this.cards.push(pivot); return pivot;
  }
  // 掛上自己的祈福卡（大一點、放在最前排中間）
  hangMyCard(card) {
    if (this.myCard) { this.wall.remove(this.myCard); }
    const tex = canvasTex(240, 400, (g, W, H) => {
      g.fillStyle = card.hex; g.fillRect(0, 0, W, H);
      g.strokeStyle = card.ink; g.globalAlpha = 0.6; g.lineWidth = 6; g.strokeRect(12, 12, W - 24, H - 24); g.globalAlpha = 1;
      g.fillStyle = card.ink; g.textAlign = 'center';
      g.font = '900 40px "Noto Serif TC",serif'; g.fillText(card.exam || '祈福', W / 2, 70);
      g.font = '700 30px "Noto Serif TC",serif';
      const text = card.text || '金榜題名'; const lines = []; for (let i = 0; i < text.length; i += 6) lines.push(text.slice(i, i + 6));
      lines.slice(0, 6).forEach((l, i) => g.fillText(l, W / 2, 140 + i * 42));
      g.font = '700 26px serif'; g.fillText('金榜題名', W / 2, H - 34);
    });
    const p = this.addCard(0, 2.15, card.hex, tex); p.scale.setScalar(1.7); p.position.z = 0.16;
    this.myCard = p; return p;
  }

  buildTrees() {
    const S = this.scene;
    [[-14, 24], [14, 24.5], [-24, 8], [24, 5], [-23, -12], [23, -15], [-8, 25], [9, 26]].forEach(([x, z]) => {
      const g = new THREE.Group(); g.position.set(x, 0, z);
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 2.2, 8), lam('#5a3a24')); t.position.y = 1.1; g.add(t);
      [[0, 2.8, 0, 1.4], [0.7, 2.4, 0.3, 1], [-0.6, 2.5, -0.2, 1.05], [0, 3.6, 0, 0.9]].forEach(([a, b, c, r]) => {
        const l = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), lam('#4f7a3a', { flatShading: true })); l.position.set(a, b, c); g.add(l);
      });
      S.add(g);
    });
  }

  // ---------- 供品、插香、擲筊 ----------
  // 神明身邊的裝飾：天聾地啞兩位書僮、蓮花燈、宮燈、塔香、綵帶
  buildShrineDecor() {
    const S = this.scene, gold = lam('#d8ab45'), red = lam('#c8352b'), skin = lam('#efc9a3'), black = lam('#161414');
    // 書僮：天聾（左，捧書）、地啞（右，捧印）站在神龕上，個子比帝君小
    [[-1.62, '#2f7d6d', 'book'], [1.62, '#b8322a', 'seal']].forEach(([x, robeC, item]) => {
      const g = new THREE.Group(); g.position.set(x, 1.6, -20.35); S.add(g);
      const robe = lam(robeC);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.32, 0.8, 14), robe); body.position.y = 0.4; g.add(body);
      const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.215, 0.05, 14), gold); belt.position.y = 0.55; g.add(belt);
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.03, 6, 14), lam('#f4efe2')); collar.rotation.x = Math.PI / 2; collar.position.y = 0.8; g.add(collar);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 12), skin); head.position.y = 0.97; g.add(head);
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.175, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), black); hair.rotation.x = -0.35; hair.position.set(0, 0.99, -0.02); g.add(hair);
      [-1, 1].forEach(e => { const bun = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), black); bun.position.set(0.12 * e, 1.13, -0.02); g.add(bun); });
      [-1, 1].forEach(e => { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), black); eye.position.set(0.055 * e, 0.98, 0.155); g.add(eye); });
      [-1, 1].forEach(e => { const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.22, 4, 8), robe); arm.position.set(0.15 * e, 0.6, 0.12); arm.rotation.x = -1.1; g.add(arm); });
      const it = item === 'book' ? new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.18), lam('#2a4f8a')) : new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.16), lam('#e2b13c'));
      it.position.set(0, 0.64, 0.28); g.add(it);
      if (item === 'seal') { const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), red); knob.position.set(0, 0.74, 0.28); g.add(knob); }
      else { const pages = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.16), lam('#f4efe2')); pages.position.set(0, 0.675, 0.28); g.add(pages); }
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.06, 14), gold); base.position.y = 0.03; g.add(base);
    });
    // 蓮花燈：神龕兩側的落地燈
    [-2.95, 2.95].forEach(x => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.4, 10), gold); pole.position.set(x, 1.2, -20.2); S.add(pole);
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.12, 12), gold); foot.position.set(x, 0.06, -20.2); S.add(foot);
      for (let k = 0; k < 8; k++) {
        const a = k / 8 * Math.PI * 2, petal = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), lam('#f2a0b8')); petal.scale.set(0.5, 1, 0.3);
        petal.position.set(x + Math.cos(a) * 0.14, 2.5, -20.2 + Math.sin(a) * 0.14); petal.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); S.add(petal);
      }
      const light = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), basic('#ffd77a')); light.position.set(x, 2.6, -20.2); S.add(light);
    });
    // 宮燈：六角紅燈，掛在神龕兩邊
    [-3.6, 3.6].forEach(x => {
      const g = new THREE.Group(); g.position.set(x, 5.4, -19.4); S.add(g);
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, L.HH - 5.4 - 0.5), lam('#5a2a18')); rope.position.y = (L.HH - 5.4) / 2 + 0.2; g.add(rope);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.62, 6), lam('#d8322a', { emissive: '#4a0a00' })); g.add(body);
      [0.33, -0.33].forEach(y => { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.07, 6), gold); cap.position.y = y; g.add(cap); });
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2, t = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.03, 0.3), lam('#e8b84a')); t.position.set(Math.cos(a) * 0.38, -0.52, Math.sin(a) * 0.38); g.add(t); }
      const tas = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.07, 0.4), red); tas.position.y = -0.6; g.add(tas);
    });
    // 塔香：螺旋盤香掛在供桌兩端上方，慢慢冒煙
    [-3.7, 3.7].forEach(x => {
      const g = new THREE.Group(); g.position.set(x, 3.5, -18.5); S.add(g);
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, L.HH - 3.5), lam('#5a2a18')); rope.position.y = (L.HH - 3.5) / 2; g.add(rope);
      for (let k = 0; k < 7; k++) { const r = 0.34 - k * 0.042, ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.016, 5, 22), lam('#7a5a3a')); ring.rotation.x = Math.PI / 2; ring.position.y = -k * 0.07; g.add(ring); }
      const ember = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), basic('#ff8a3a')); ember.position.set(0.06, -0.49, 0); g.add(ember);
      this.addSmoke(new THREE.Vector3(x, 3.0, -18.5), 14, 0.15, 1.6, 0.12);
    });
    // 綵帶：神龕上方的紅色垂幔
    for (let k = 0; k < 4; k++) {
      const arc = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.07, 6, 18, Math.PI), red); arc.rotation.z = Math.PI; arc.position.set(-1.6 + k * 1.07, 5.32, -20.12); S.add(arc);
    }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.1, 0.1), gold); bar.position.set(0, 5.34, -20.1); S.add(bar);
  }

  // 一樣供品的 3D 模型（底部在 y=0）
  offerMesh(o) {
    let m;
    if (o.id === 'scallion' || o.id === 'celery') { m = new THREE.Group(); for (let k = 0; k < 4; k++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.42), lam(o.color)); s.rotation.z = Math.PI / 2 + (k - 1.5) * 0.08; s.position.set(0, 0.04 + k * 0.03, (k - 1.5) * 0.04); m.add(s); } }
    else if (o.id === 'radish') { m = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.42, 12), lam(o.color)); m.rotation.z = Math.PI / 2; m.position.y = 0.1; }
    else if (o.id === 'zongzi') { m = new THREE.Mesh(new THREE.TetrahedronGeometry(0.17), lam(o.color)); m.position.y = 0.13; }
    else if (o.id === 'tea') { m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.12), lam('#c8352b')); m.position.y = 0.14; }
    else if (o.id === 'fagao') { m = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.18, 12), lam(o.color)); m.position.y = 0.09; }
    else { m = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), lam(o.color)); m.scale.y = 0.8; m.position.y = 0.11; }
    const g = new THREE.Group(); g.add(m); return g;
  }
  // 一份供品：紅色托盤＋供品（最多七樣，排兩排）＋准考證影本與鉛筆
  offerTray(items, ticket, mine) {
    const g = new THREE.Group();
    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.04, 0.5), lam(mine ? '#b8241c' : '#8a2a20')); tray.position.y = 0.02; g.add(tray);
    const rim = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.03, 0.54), lam('#d8ab45')); rim.position.y = 0.005; g.add(rim);
    items.slice(0, 7).forEach((o, i) => {
      const back = i < 4, n = back ? Math.min(4, items.length) : items.length - 4, k = back ? i : i - 4;
      const m = this.offerMesh(o); m.scale.setScalar(0.68); m.position.set((k - (n - 1) / 2) * 0.19, 0.04, back ? -0.11 : 0.11); g.add(m);
    });
    if (ticket) {
      if (!this._ticketTex) this._ticketTex = canvasTex(96, 128, (c, W, H) => {
        c.fillStyle = '#fbf8ef'; c.fillRect(0, 0, W, H); c.fillStyle = '#3a2a20'; c.font = '700 17px sans-serif'; c.textAlign = 'center'; c.fillText('准考證', W / 2, 24);
        c.fillStyle = '#c9c2b2'; c.fillRect(14, 36, 30, 38); for (let y = 42; y < 108; y += 11) c.fillRect(52, y, 32, 3);
        c.strokeStyle = '#c8352b'; c.lineWidth = 3; c.beginPath(); c.arc(70, 104, 12, 0, 7); c.stroke();
      });
      const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.23), basic('#fff', { map: this._ticketTex })); paper.rotation.x = -Math.PI / 2; paper.rotation.z = 0.15; paper.position.set(0.22, 0.012, 0.37); g.add(paper);
      const pencil = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.2, 6), lam('#e8c040')); pencil.rotation.z = Math.PI / 2; pencil.rotation.y = 0.4; pencil.position.set(0.0, 0.012, 0.4); g.add(pencil);
    }
    return g;
  }
  // 自己的供品（正中間）
  setOfferings(list, ticket = false) { this.myOffer = list.length ? { items: list, tk: ticket } : null; this.renderAltar(); }
  // 其他人的供品：最新的放離中間最近
  setOtherOffers(list) { this.otherOffers = list; this.renderAltar(); }
  renderAltar() {
    this.offeringSlots.clear();
    if (this.myOffer) { const t = this.offerTray(this.myOffer.items, this.myOffer.tk, true); t.position.x = -0.95; this.offeringSlots.add(t); }
    const xs = [0.95, -1.9, 1.9, -2.85, 2.85, -3.75, 3.75];
    this.otherOffers.slice(-xs.length).reverse().forEach((o, i) => { const t = this.offerTray(o.items, o.tk); t.position.x = xs[i]; this.offeringSlots.add(t); });
  }
  // 從拜墊把香「送」進文昌爐（不用擠到爐前）
  flyIncense(from, n = 2) {
    const sticks = Array.from({ length: n }, (_, i) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.45), lam('#8a3a2a'));
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), basic('#ff8a3a')); tip.position.y = 0.23; m.add(tip);
      m.position.set(from.x + (i - (n - 1) / 2) * 0.1, 1.2, from.z); this.scene.add(m); return m;
    });
    const ex = 0, ez = WC_CENSER_Z;
    sticks.forEach((m, i) => { const sx = m.position.x, sz = m.position.z; this.tween(800, k => { m.position.set(sx + (ex - sx) * k, 1.2 + Math.sin(k * Math.PI) * 0.8 + 0.4 * k, sz + (ez - sz) * k); }, i * 120, t => t * (2 - t)); });
    return new Promise(r => setTimeout(() => { sticks.forEach(m => this.scene.remove(m)); r(); }, 800 + n * 120));
  }
  // 插香：where = 'heaven'（天公爐）或 'wenchang'（文昌爐）
  plantIncense(where = 'heaven', n = 1) {
    const base = Math.random() * 6.28, g = where === 'wenchang' ? this.wcSticks : this.sticks, r0 = where === 'wenchang' ? 0.1 : 0.25;
    const added = Array.from({ length: n }, (_, i) => this.addStick(base + i * 0.25, r0 + Math.random() * 0.12, where === 'wenchang' ? 0.42 : 0.55, g));
    added.forEach((s, i) => { s.scale.y = 0.01; this.tween(500, k => { s.scale.y = Math.max(0.01, k); }, i * 120); });
  }

  // 擲筊：在玩家面前丟出一對筊，回傳結果 'sheng' | 'xiao' | 'yin'
  tossJiaobei(origin, facing) {
    const r = Math.random(), res = r < 0.5 ? 'sheng' : r < 0.75 ? 'xiao' : 'yin';
    const faces = res === 'sheng' ? [true, false] : res === 'xiao' ? [true, true] : [false, false]; // true = 平面朝上
    if (this.blocks) this.blocks.forEach(b => this.scene.remove(b));
    const fx = Math.sin(facing), fz = Math.cos(facing);
    this.blocks = [-1, 1].map((s, i) => {
      const g = new THREE.Group();
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.12, 20, 1, false, 0, Math.PI), [lam('#c8352b'), lam('#e05a48'), lam('#e05a48')]);
      m.rotation.x = Math.PI / 2; m.scale.set(1, 1, 0.9); g.add(m);
      const sx = origin.x + fx * 0.5, sz = origin.z + fz * 0.5;
      const ex = origin.x + fx * 1.5 + -fz * s * 0.3, ez = origin.z + fz * 1.5 + fx * s * 0.3;
      g.position.set(sx, 1.1, sz); this.scene.add(g);
      const spin = 6 + Math.random() * 4, endRot = faces[i] ? Math.PI : 0;
      const yaw = Math.random() * 6.28;
      this.tween(900, k => {
        g.position.x = sx + (ex - sx) * k; g.position.z = sz + (ez - sz) * k;
        g.position.y = 0.06 + 1.04 * (1 - k) + Math.sin(k * Math.PI) * 1.1;
        g.rotation.set(0, yaw, endRot + (1 - k) * spin * Math.PI);
      }, i * 60, t => 1 - Math.pow(1 - t, 2));
      return g;
    });
    return new Promise(r => setTimeout(() => r(res), 1050));
  }
  clearBlocks() { if (this.blocks) { this.blocks.forEach(b => this.scene.remove(b)); this.blocks = null; } }

  tween(ms, fn, delay = 0, ease = t => t, done) { this.anims.push({ t: -delay, ms, fn, ease, done }); }

  setNight(on) {
    this.night = on;
    this.hemi.intensity = on ? 0.55 : 1.6; this.hemi.color.set(on ? 0x8a9ad8 : 0xfff1dc);
    this.sun.intensity = on ? 0.25 : 1.6; this.sun.color.set(on ? 0x9aa8ff : 0xffe2b8);
    this.scene.fog.color.set(on ? 0x141a33 : 0xe9c9a4);
    this.lanterns.forEach(l => l.material.emissive.set(on ? '#ff5a2a' : '#3a0800'));
    this.godLight.intensity = on ? 10 : 6;
  }

  // ---------- 走動與鏡頭 ----------
  setPlayer(av) { this.player = av; this.player.root.position.set(SPOTS.start.x, 0, SPOTS.start.z); this.player.root.rotation.y = SPOTS.start.f; this.camYaw = this.camYawTarget = 0; }
  addAvatar(av) { this.avatars.add(av); this.scene.add(av.root); av.target = null; return av; }
  removeAvatar(av) { this.avatars.delete(av); this.scene.remove(av.root); }

  walk(av, x, z, face) {
    const pts = route(av.root.position, { x, z });
    av.path = pts.slice(1); av.target = { ...pts[0], face: pts.length === 1 ? face : null }; av._finalFace = face;
    av._arrive?.(false);
    return new Promise(r => { av._arrive = r; });
  }
  goSpot(av, id) { const s = SPOTS[id]; return this.walk(av, s.x, s.z, s.f); }
  // 動作時把鏡頭轉到角色斜後方
  frame(face, offset = 0.22) { this.camYawTarget = face + Math.PI + offset; }

  collide(p) {
    const { HW, HF, HB, CW, GZ } = L;
    // 廟門外是比較寬的樹林；圍牆內維持原本的範圍
    const outside = p.z > GZ, W = outside ? L.FW : CW;
    p.x = Math.max(-W + 0.4, Math.min(W - 0.4, p.x)); p.z = Math.max(HB + 0.6, Math.min(L.FZ, p.z));
    if (p.z < HF + 0.2) p.x = Math.max(-HW + 0.6, Math.min(HW - 0.6, p.x));
    if (p.z > GZ - 0.4 && p.z < GZ + 0.6 && Math.abs(p.x) > 2.4) p.z = p.z < GZ + 0.1 ? GZ - 0.4 : GZ + 0.6;
    for (const [x1, z1, x2, z2] of BOXES) {
      if (p.x > x1 - 0.3 && p.x < x2 + 0.3 && p.z > z1 - 0.3 && p.z < z2 + 0.3) {
        const d = [p.x - (x1 - 0.3), (x2 + 0.3) - p.x, p.z - (z1 - 0.3), (z2 + 0.3) - p.z], m = Math.min(...d);
        if (m === d[0]) p.x = x1 - 0.3; else if (m === d[1]) p.x = x2 + 0.3; else if (m === d[2]) p.z = z1 - 0.3; else p.z = z2 + 0.3;
      }
    }
    for (const [x, z, r] of CIRCLES) { const dx = p.x - x, dz = p.z - z, d = Math.hypot(dx, dz), R = r + 0.3; if (d < R && d > 0.001) { p.x = x + dx / d * R; p.z = z + dz / d * R; } }
  }

  // 一排拜位裡第一個空的（跟其他人至少隔 0.55 公尺）
  freeSlot(slots, self = this.player, seat0 = TIANGONG_SEAT0, skip = 0) {
    return slots.findIndex((sl, k) => { if (k < skip || this.takenSeats.has(seat0 + k)) return false; for (const av of this.avatars) if (av !== self && !av.netId && Math.hypot(av.root.position.x - sl.x, av.root.position.z - sl.z) < 0.55) return false; return true; });
  }
  // 拜墊是否空著：伺服器說沒人坐，示意香客也不在上面
  cushionFree(i, self = this.player) {
    if (this.takenSeats.has(i)) return false;
    const c = CUSHIONS[i];
    for (const av of this.avatars) if (av !== self && !av.netId && Math.hypot(av.root.position.x - c.x, av.root.position.z - c.z) < 0.45) return false;
    return true;
  }
  // 站位被別人佔了就往旁邊挪：依面向的左右兩側找一個空位
  freeSpot(x, z, f, self = this.player) {
    const px = Math.cos(f), pz = -Math.sin(f);
    for (const o of [0, 0.85, -0.85, 1.7, -1.7, 2.55, -2.55]) {
      const cx = x + px * o, cz = z + pz * o;
      let ok = true;
      for (const av of this.avatars) if (av !== self && Math.hypot(av.root.position.x - cx, av.root.position.z - cz) < 0.6) { ok = false; break; }
      if (ok) return { x: cx, z: cz };
    }
    return { x, z };
  }
  // 最近的空拜墊（others：其他人的位置，避免兩個人跪同一個）
  freeCushion(x, z, maxD = 0.9) {
    let best = -1, bd = maxD;
    CUSHIONS.forEach((c, i) => {
      const d = Math.hypot(c.x - x, c.z - z); if (d >= bd) return;
      if (!this.cushionFree(i)) return;
      best = i; bd = d;
    });
    return best;
  }

  bindInput() {
    // 單指拖曳：左右轉視角、上下調仰角（可以轉到頭頂往下看）；雙指捏合／滾輪：拉近拉遠；輕點：走過去
    const el = this.canvas, pts = new Map(); let down = null, pinch = null;
    const clampP = v => Math.max(0.04, Math.min(1.45, v)), clampD = v => Math.max(2.5, Math.min(24, v));
    el.addEventListener('pointerdown', e => {
      el.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), dist: this.camDist }; down = null; return; }
      down = { x: e.clientX, y: e.clientY, t: performance.now(), yaw: this.camYawTarget, pitch: this.camPitch, moved: false };
    });
    el.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pts.size >= 2) { const [a, b] = [...pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); this.camDist = clampD(pinch.dist * pinch.d / Math.max(20, d)); return; }
      if (!down) return; const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) down.moved = true;
      if (down.moved) { this.camYawTarget = this.camYaw = down.yaw - dx * 0.008; this.camPitch = clampP(down.pitch + dy * 0.006); this.focus = null; }
    });
    const up = e => {
      pts.delete(e.pointerId); if (pts.size < 2) pinch = null;
      if (!down || e.type === 'pointercancel') { down = null; return; } const d = down; down = null;
      if (d.moved || performance.now() - d.t > 600) return;
      const ndc = new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
      const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, this.camera);
      const avs = [...this.avatars].filter(a => a !== this.player).map(a => a.root);
      const hitA = ray.intersectObjects(avs, true)[0];
      if (hitA) { this.emit('tapAvatar', hitA.object.userData.avatar, e); return; }
      if (ray.intersectObject(this.lxScreen, false)[0]) { this.emit('tapLingxi'); return; }
      if (ray.intersectObject(this.bangBoard, true)[0]) { this.emit('tapBang'); return; }
      if (ray.intersectObject(this.lampBoard, false)[0]) { this.emit('tapLamp'); return; }
      for (const [id, obj] of this.places) if (ray.intersectObject(obj, true)[0]) { this.emit('tapPlace', id); return; }
      for (const [obj, fn] of this.tapTargets) { const h = obj.visible !== false && ray.intersectObject(obj, true)[0]; if (h) { fn(h); return; } }
      const hitK = ray.intersectObject(this.wall, true)[0];
      if (hitK) { let o = hitK.object; while (o && !o.userData.card && o !== this.wall) o = o.parent; this.emit('tapWall', o?.userData.card || null); return; }
      const hitC = ray.intersectObjects(this.cushionMeshes, false)[0];
      if (hitC && hitC.instanceId != null) { this.emit('tapCushion', hitC.instanceId); return; }
      const hit = ray.intersectObjects(this.ground, false)[0];
      if (hit) this.emit('tapGround', hit.point);
    };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', e => { e.preventDefault(); this.camDist = clampD(this.camDist * (e.deltaY > 0 ? 1.1 : 0.9)); }, { passive: false });
    this.keys = {};
    addEventListener('keydown', e => { if (e.target.closest?.('input,textarea,dialog')) return; this.keys[e.key.toLowerCase()] = true; });
    addEventListener('keyup', e => { this.keys[e.key.toLowerCase()] = false; });
  }

  project(v) {
    const p = v.clone().project(this.camera);
    return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight, vis: p.z < 1 && p.z > -1 };
  }

  shake(amt = 0.15, sec = 0.25) { if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; this.shakeAmt = amt; this.shakeT = this.shakeDur = sec; }
  footprint(p, f, side) {
    if (this.feet.length > 80) return;
    if (!this._footG) this._footG = new THREE.CircleGeometry(0.09, 10);
    const m = new THREE.Mesh(this._footG, new THREE.MeshBasicMaterial({ color: '#ffd76a', transparent: true, opacity: 0.8, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.scale.set(1, 1.6, 1); m.position.set(p.x + Math.cos(f) * 0.12 * side, 0.02, p.z - Math.sin(f) * 0.12 * side); this.scene.add(m);
    this.feet.push({ m, life: 2 });
  }
  // 手機變卡時自動降低解析度，順了再慢慢調回來
  perfTick(dt) {
    const P = this.perf ||= { t: 0, n: 0, ratio: this.renderer.getPixelRatio(), max: this.renderer.getPixelRatio(), good: 0 };
    P.t += dt; P.n++;
    if (P.t < 2) return;
    const fps = P.n / P.t; P.t = 0; P.n = 0; this.fps = fps;
    if (document.hidden) return;
    if (fps < 38 && P.ratio > 0.8) { P.ratio = Math.max(0.8, P.ratio - 0.25); P.good = 0; this.renderer.setPixelRatio(P.ratio); this.resize(); }
    else if (fps > 57 && P.ratio < P.max) { if (++P.good >= 3) { P.good = 0; P.ratio = Math.min(P.max, P.ratio + 0.25); this.renderer.setPixelRatio(P.ratio); this.resize(); } }
    else P.good = 0;
  }

  update() {
    const dt = Math.min(0.05, this.clock.getDelta());
    // 鍵盤走動
    const k = this.keys, P = this.player;
    // 鍵盤或方向搖桿：以鏡頭方向為「前」
    let f = 0, sd = 0;
    if (P && !this.lockMove) {
      f = (k.w || k.arrowup ? 1 : 0) - (k.s || k.arrowdown ? 1 : 0); sd = (k.d || k.arrowright ? 1 : 0) - (k.a || k.arrowleft ? 1 : 0);
      if (Math.hypot(this.stick.x, this.stick.y) > 0.12) { f = this.stick.y; sd = this.stick.x; }
    }
    const mag = Math.min(1, Math.hypot(f, sd));
    if (P && mag > 0) {
      const yaw = this.camYaw + Math.PI, fx = Math.sin(yaw), fz = Math.cos(yaw);
      const dx = (fx * f - fz * sd) / mag, dz = (fz * f + fx * sd) / mag;
      P.path = null; P.target = { x: P.root.position.x + dx * 0.6, z: P.root.position.z + dz * 0.6 }; P._arrive?.(false); P._arrive = null;
      P.moveMul = 0.35 + 0.65 * mag; this.emit('manualMove');
    } else if (P) P.moveMul = 1;
    for (const av of this.avatars) {
      const p = av.root.position; let moving = false;
      if (av.target) {
        const dx = av.target.x - p.x, dz = av.target.z - p.z, d = Math.hypot(dx, dz);
        const sp = (av.speed || 3.2) * (av.moveMul || 1) * dt;
        if (d > 0.05) {
          moving = true; const st = Math.min(sp, d);
          const before = { x: p.x, z: p.z };
          p.x += dx / d * st; p.z += dz / d * st; this.collide(p);
          const want = Math.atan2(dx, dz); av.root.rotation.y = lerpAngle(av.root.rotation.y, want, Math.min(1, dt * 10));
          // 卡住了就放棄
          if (Math.hypot(p.x - before.x, p.z - before.z) < st * 0.15) { av.stuck = (av.stuck || 0) + dt; if (av.stuck > 0.6) { av.target = null; av.path = null; av.stuck = 0; av._arrive?.(false); av._arrive = null; } }
          else av.stuck = 0;
        } else {
          if (av.path?.length) { const n = av.path.shift(); av.target = { ...n, face: av.path.length ? null : av._finalFace }; }
          else {
            if (av.target.face != null) av.faceTo = av.target.face;
            av.target = null; const r = av._arrive; av._arrive = null; r?.(true);
          }
        }
      }
      if (!moving && av.faceTo != null) { av.root.rotation.y = lerpAngle(av.root.rotation.y, av.faceTo, Math.min(1, dt * 8)); if (Math.abs(angDiff(av.root.rotation.y, av.faceTo)) < 0.01) av.faceTo = null; }
      if (moving && av.kneeling) av.kneel(false);
      if (moving && av.sitting && !av.netId) av.sit(false);
      av.moving = moving;
      if (av.root.visible) av.update(dt, moving); // 人多時遠處的人藏起來，也不用算動作
      // 金色腳印特效
      if (moving && av.root.visible && (av.look.fx | 0) === 2 && (av.footT = (av.footT || 0) + dt) > 0.28) { av.footT = 0; this.footprint(p, av.root.rotation.y, av.footSide = -(av.footSide || 1)); }
    }
    // 人不要疊在一起：站著不動的自己和示意香客會被推開；走路中的人可以穿過去（人多時才不會卡住）
    const list = [...this.avatars];
    for (const a of list) {
      if (a.netId || a.kneeling || a.moving) continue;
      const p = a.root.position;
      for (const b of list) {
        if (a === b) continue;
        const q = b.root.position, dx = p.x - q.x, dz = p.z - q.z, d = Math.hypot(dx, dz), R = 0.62;
        if (d < R) {
          if (b.moving) continue;
          const push = (R - d) * (b.netId || b.kneeling ? 1 : 0.5) * Math.min(1, dt * 12);
          const ux = d > 0.001 ? dx / d : Math.cos(a.t), uz = d > 0.001 ? dz / d : Math.sin(a.t);
          p.x += ux * push; p.z += uz * push; this.collide(p);
        }
      }
    }
    // 腳印淡出
    for (let i = this.feet.length - 1; i >= 0; i--) { const f = this.feet[i]; f.life -= dt; f.m.material.opacity = Math.max(0, f.life / 2) * 0.8; if (f.life <= 0) { this.scene.remove(f.m); f.m.material.dispose(); this.feet.splice(i, 1); } }
    this.perfTick(dt);
    for (const fn of this.updaters) fn(dt);
    // 動畫
    // 動畫結束時可能又開始新的動畫：先把清單換新，跑完再把新加的接回去，才不會被丟掉
    const running = this.anims; this.anims = [];
    const keep = running.filter(a => { a.t += dt * 1000; if (a.t < 0) return true; const k = Math.min(1, a.t / a.ms); a.fn(a.ease(k)); if (k >= 1) a.done?.(); return k < 1; });
    this.anims = keep.concat(this.anims);
    // 香煙、金爐煙與火光
    for (const sm of this.smokes) {
      const a = sm.arr, boost = sm === this.jinluSmoke ? 1 + this.fireBoost * 1.5 : 1;
      for (let i = 0; i < sm.N; i++) {
        sm.life[i] += dt * 0.25 * boost; if (sm.life[i] > 1) sm.life[i] = 0;
        const l = sm.life[i];
        a[i * 3] = Math.sin(i * 1.7 + l * 3) * sm.spread * (0.4 + l); a[i * 3 + 1] = l * sm.rise; a[i * 3 + 2] = Math.cos(i * 2.3 + l * 2) * sm.spread * (0.4 + l);
      }
      sm.pts.geometry.attributes.position.needsUpdate = true;
    }
    this.fireBoost = Math.max(0, this.fireBoost - dt * 0.6);
    const fl = 0.75 + Math.sin(this.clock.elapsedTime * 13) * 0.08 + Math.sin(this.clock.elapsedTime * 7.3) * 0.07;
    this.fire.scale.set(1, Math.min(1.25, fl + this.fireBoost * 0.35), 1); this.fireMat.color.setScalar(0.85 + this.fireBoost * 0.15);
    // 祈福卡搖動
    const t = this.clock.elapsedTime;
    this.cards.forEach(c => { c.rotation.x = Math.sin(t * 1.4 + c.userData.ph) * 0.08; c.rotation.z = Math.sin(t * 1.1 + c.userData.ph) * 0.05; });
    this.god.position.y = 1.6 + Math.sin(t * 1.2) * 0.015;
    if (t - (this.lxLast || 0) > 0.25) { this.lxLast = t; this.drawLingxi(t); }
    // 鏡頭：繞著角色轉（左右＝方位、上下＝仰角、遠近＝距離），可以一路轉到頭頂往下看
    if (P) {
      this.camYaw = lerpAngle(this.camYaw, this.camYawTarget, Math.min(1, dt * 3));
      const pp = P.root.position, tgt = this.focus || new THREE.Vector3(pp.x, 1.2, pp.z);
      const piv = new THREE.Vector3(pp.x, 1.2, pp.z), cp = Math.cos(this.camPitch), sp = Math.sin(this.camPitch);
      const at = d => new THREE.Vector3(piv.x + Math.sin(this.camYaw) * cp * d, Math.max(0.35, piv.y + sp * d), piv.z + Math.cos(this.camYaw) * cp * d);
      let want = at(this.camDist);
      // 擋到牆、天花板、天公爐等就拉近
      for (let d = this.camDist - 0.4; (!camClear(want, pp) || this.camHit?.(want)) && d > 1.6; d -= 0.4) want = at(d);
      this.camera.position.lerp(want, Math.min(1, dt * 5));
      this._look = this._look ? this._look.lerp(tgt, Math.min(1, dt * 5)) : tgt.clone();
      this.camera.lookAt(this._look);
      // 畫面震動（打中怪物時）：鏡頭位置隨機抖一下，慢慢停下來
      if (this.shakeT > 0) { this.shakeT -= dt; const a = this.shakeAmt * Math.max(0, this.shakeT / this.shakeDur); this.camera.position.x += (Math.random() - 0.5) * a; this.camera.position.y += (Math.random() - 0.5) * a; }
    }
    this.renderer.render(this.scene, this.camera);
    return dt;
  }
}

function angDiff(a, b) { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }
function lerpAngle(a, b, k) { return a + angDiff(a, b) * k; }

// 簡單路徑：穿過山門、繞過天公爐
function route(a, b) {
  const pts = [], G = L.GZ + 0.1, C = L.CZ;
  let cur = { x: a.x, z: a.z };
  if ((cur.z > G) !== (b.z > G)) {
    const k = (G - cur.z) / (b.z - cur.z), x = cur.x + (b.x - cur.x) * k;
    if (Math.abs(x) > 1.8) { const gx = Math.max(-1.6, Math.min(1.6, x)), s = cur.z > G ? 1 : -1; pts.push({ x: gx, z: G + s * 1.1 }, { x: gx, z: G - s * 1.1 }); cur = pts[pts.length - 1]; }
  }
  // 進出正殿要從正面柱子之間走
  if ((cur.z > L.HF) !== (b.z > L.HF)) {
    const k = (L.HF - cur.z) / (b.z - cur.z), x = cur.x + (b.x - cur.x) * k;
    if (Math.abs(x) > L.HW - 1) { const gx = Math.sign(x) * (L.HW - 3), s = cur.z > L.HF ? 1 : -1; pts.push({ x: gx, z: L.HF + s * 1.2 }, { x: gx, z: L.HF - s * 1.2 }); cur = pts[pts.length - 1]; }
  }
  const segDist = (p, q) => { const vx = q.x - p.x, vz = q.z - p.z, Ln = vx * vx + vz * vz || 1, t = Math.max(0, Math.min(1, ((0 - p.x) * vx + (C - p.z) * vz) / Ln)); return Math.hypot(p.x + vx * t, p.z + vz * t - C); };
  if (segDist(cur, b) < 1.65) {
    const side = (cur.x + b.x) / 2 >= 0 ? 1 : -1;
    if (Math.abs(cur.z - C) > 1 && Math.abs(b.z - C) > 1) pts.push({ x: 2.2 * side, z: C });
    else pts.push({ x: 2.2 * side, z: cur.z < C ? C - 1.4 : C + 1.4 }, { x: 2.2 * side, z: b.z < C ? C - 1.4 : C + 1.4 });
  }
  // 許願池：路線穿過池子就從旁邊繞
  const poolDist = (p, q) => { const vx = q.x - p.x, vz = q.z - p.z, Ln = vx * vx + vz * vz || 1, t = Math.max(0, Math.min(1, ((POOL.x - p.x) * vx + (POOL.z - p.z) * vz) / Ln)); return Math.hypot(p.x + vx * t - POOL.x, p.z + vz * t - POOL.z); };
  if (poolDist(cur, b) < POOL.r + 0.5 && Math.hypot(b.x - POOL.x, b.z - POOL.z) > POOL.r) {
    const side = (cur.x + b.x) / 2 >= POOL.x ? 1 : -1; pts.push({ x: POOL.x + side * (POOL.r + 1.2), z: POOL.z }); cur = pts[pts.length - 1];
  }
  // 廟外的錦鯉池、考試魔王：一樣從旁邊繞
  for (const [ox, oz, orr] of [[16, 45, 4.3], [0, 47.5, 1.6]]) {
    const vx = b.x - cur.x, vz = b.z - cur.z, Ln = vx * vx + vz * vz || 1, t = Math.max(0, Math.min(1, ((ox - cur.x) * vx + (oz - cur.z) * vz) / Ln));
    if (Math.hypot(cur.x + vx * t - ox, cur.z + vz * t - oz) < orr + 0.5 && Math.hypot(b.x - ox, b.z - oz) > orr) {
      const side = (cur.z + b.z) / 2 >= oz ? 1 : -1; pts.push({ x: ox + (b.x >= ox ? 1 : -1) * (orr + 1.2), z: oz + side * (orr + 1.2) }); cur = pts[pts.length - 1];
    }
  }
  // 讀書角：書桌一排一排的，從東西兩側沿著凳子那一排走進去／走出來
  const inDesk = p => p.x > -15.2 && p.x < -6.8 && p.z > 2.2 && p.z < 7.4;
  if (inDesk(cur) && !inDesk(b)) { const ex = b.x > -11 ? -6.3 : -15.7; pts.push({ x: ex, z: cur.z }); cur = pts[pts.length - 1]; }
  if (inDesk(b) && !inDesk(cur)) {
    const ex = cur.x > -11 ? -6.3 : -15.7;
    if (cur.z < 2.2 || cur.z > 7.4) pts.push({ x: ex, z: cur.z < 2.2 ? 1.8 : 7.8 });
    pts.push({ x: ex, z: b.z }); cur = pts[pts.length - 1];
  }
  pts.push({ x: b.x, z: b.z });
  return pts;
}

// 鏡頭位置是否不會穿模
function camClear(v, player) {
  const { HW, HF, HB, HH } = L;
  const inHall = player.z < HF + 0.3;
  if (inHall) {
    if (Math.abs(v.x) > HW - 0.4 || v.z < HB + 0.4 || v.y > HH - 0.4) return false;
    for (const [x, z] of INNER_PILLARS) if (Math.hypot(v.x - x, v.z - z) < 0.8) return false;
  } else if (v.z < HF + 0.6 && Math.abs(v.x) < HW + 1 && v.y < HH + 6) return false; // 在殿外時不要穿進正殿
  if (Math.hypot(v.x, v.z - L.CZ) < 1.9 && v.y < 3.6) return false;
  if (Math.hypot(v.x - JINLU.x, v.z - JINLU.z) < 1.9 && v.y < 4.8) return false;
  if (Math.hypot(v.x, v.z - WC_CENSER_Z) < 0.9 && v.y < 2) return false;
  for (const [x1, z1, x2, z2] of BOXES) if (v.x > x1 - 0.4 && v.x < x2 + 0.4 && v.z > z1 - 0.4 && v.z < z2 + 0.4 && v.y < 3.4) return false;
  for (const x of FRONT_PILLARS) if (Math.hypot(v.x - x, v.z - HF) < 0.9) return false;
  if (Math.abs(v.x) > (player.z > L.GZ + 0.6 ? L.FW : L.CW) + 6 || v.z > L.FZ + 8) return false;
  return true;
}

// 3D 文昌祠：建築、擺設、走動、鏡頭、日夜、擲筊與插香等場景動畫
import * as THREE from '../vendor/three.module.min.js';
import { Avatar } from './avatar.js';

const lam = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });
const basic = (c, extra = {}) => new THREE.MeshBasicMaterial({ color: c, ...extra });

// 站位：x, z, 面向（弧度；0 = 朝 +z 也就是朝廟外）
export const SPOTS = {
  start: { x: 0, z: 13, f: Math.PI },
  counter: { x: -5.7, z: 7, f: -Math.PI / 2 },
  censerOut: { x: 0, z: 2.5, f: 0 },
  censer: { x: 0, z: 5.6, f: Math.PI },
  cushion: { x: 0, z: -4.4, f: Math.PI },
  qianTube: { x: 2.7, z: -4.3, f: Math.PI, cam: -0.45 },
  wall: { x: 6.4, z: 4, f: Math.PI / 2 },
};
// 名牌標示（可點擊走過去）
export const MARKS = [
  { id: 'counter', name: '辦事處', pos: [-7.6, 2.9, 7] },
  { id: 'censer', name: '天公爐', pos: [0, 2.6, 4] },
  { id: 'cushion', name: '文昌帝君', pos: [0, 5.2, -8.4] },
  { id: 'qianTube', name: '籤筒', pos: [2.7, 1.9, -5.6] },
  { id: 'wall', name: '祈福牆', pos: [8.2, 3.4, 4] },
];

// 不能走進去的區塊（矩形 x1,z1,x2,z2）與圓形（x,z,r）
const BOXES = [
  [-8.9, 5, -6.6, 9],              // 辦事處櫃台
  [-2.6, -6.9, 2.6, -5.7],         // 供桌
  [-2.4, -10, 2.4, -7.6],          // 神龕
  [2.2, -6.2, 3.2, -5.1],          // 籤筒桌
  [7.6, 1.2, 9.2, 6.8],            // 祈福牆
  [-10.4, 9.8, -3.3, 10.4], [3.3, 9.8, 10.4, 10.4], // 前牆
];
const CIRCLES = [[0, 4, 1.25], [-6.4, -1, 0.35], [-2.8, -1, 0.35], [2.8, -1, 0.35], [6.4, -1, 0.35], [-2.9, 10, 0.45], [2.9, 10, 0.45]];

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
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 120);
    this.clock = new THREE.Clock();
    this.camYaw = 0; this.camYawTarget = 0; this.camDist = 7; this.camH = 3.6;
    this.focus = null; // 特寫目標
    this.avatars = new Set();
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
    this.camera.fov = w < h ? 58 : 46;
    this.camDist = w < h ? 8 : 7;
    this.camera.updateProjectionMatrix();
  }

  build() {
    const S = this.scene;
    this.hemi = new THREE.HemisphereLight(0xfff1dc, 0x5a4636, 1.6); S.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffe2b8, 1.6); this.sun.position.set(-8, 14, 10); S.add(this.sun);
    S.fog = new THREE.Fog(0xe9c9a4, 26, 60);

    // 地面：外圍石地＋中庭石板＋殿內紅磚
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), lam('#7d6a58')); outer.rotation.x = -Math.PI / 2; outer.position.y = -0.02; S.add(outer);
    const slab = canvasTex(512, 512, (g, W, H) => {
      g.fillStyle = '#c9b49a'; g.fillRect(0, 0, W, H);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const v = 190 + Math.random() * 25; g.fillStyle = `rgb(${v},${v - 18},${v - 40})`;
        g.fillRect(x * 64 + 2 + (y % 2) * 32, y * 64 + 2, 60, 60);
      }
    });
    slab.wrapS = slab.wrapT = THREE.RepeatWrapping; slab.repeat.set(5, 4);
    const court = new THREE.Mesh(new THREE.PlaneGeometry(20.6, 16), lam('#fff', { map: slab })); court.rotation.x = -Math.PI / 2; court.position.set(0, 0, 4.6); S.add(court);
    const brick = canvasTex(256, 256, (g, W, H) => {
      g.fillStyle = '#8a3f2c'; g.fillRect(0, 0, W, H);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) { const v = 150 + Math.random() * 30; g.fillStyle = `rgb(${v},${v * 0.45},${v * 0.32})`; g.fillRect(x * 64 + 2, y * 32 + 2, 60, 28); }
    });
    brick.wrapS = brick.wrapT = THREE.RepeatWrapping; brick.repeat.set(4, 3);
    const hallFloor = new THREE.Mesh(new THREE.PlaneGeometry(14, 9.6), lam('#fff', { map: brick })); hallFloor.rotation.x = -Math.PI / 2; hallFloor.position.set(0, 0.01, -5.4); S.add(hallFloor);
    const step = new THREE.Mesh(new THREE.BoxGeometry(14.4, 0.12, 0.5), lam('#a89580')); step.position.set(0, 0.06, -0.55); S.add(step);

    this.buildHall(); this.buildGate(); this.buildCourt(); this.buildGod();
    this.buildCenser(); this.buildCounter(); this.buildWall(); this.buildTrees();

    this.ground = [outer, court, hallFloor];
  }

  buildHall() {
    const S = this.scene, red = lam('#9e2a22'), dark = lam('#3a1d16'), wood = lam('#6a2a1e'), gold = lam('#d8ab45');
    const wallM = lam('#b2483a');
    const back = new THREE.Mesh(new THREE.BoxGeometry(14.4, 5.2, 0.4), wallM); back.position.set(0, 2.6, -10.2); S.add(back);
    [-1, 1].forEach(s => {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5.2, 9.4), wallM); side.position.set(7.0 * s, 2.6, -5.5); S.add(side);
      // 圓窗
      const win = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.12, 8, 24), gold); win.position.set(6.78 * s, 2.6, -5); win.rotation.y = Math.PI / 2; S.add(win);
      const lat = new THREE.Mesh(new THREE.CircleGeometry(0.88, 24), lam('#3d2a1c')); lat.position.set(6.77 * s, 2.6, -5); lat.rotation.y = -Math.PI / 2 * s; S.add(lat);
    });
    // 前排柱子
    [-6.4, -2.8, 2.8, 6.4].forEach(x => {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 4.4, 14), red); p.position.set(x, 2.2, -1); S.add(p);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.4, 0.3, 8), lam('#9a8a78')); base.position.set(x, 0.15, -1); S.add(base);
      // 對聯
      if (Math.abs(x) < 3) {
        const t = plaqueTex(x < 0 ? '文章司命' : '桂籍名高', { bg: '#a62a20', fg: '#f3d27a', vertical: true, w: 120, h: 480, font: 92 });
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 1.7), basic('#fff', { map: t })); m.position.set(x, 2.5, -0.74); S.add(m);
      }
    });
    // 彩繪橫樑
    const beamT = canvasTex(1024, 64, (g, W, H) => {
      const cols = ['#1f6b5c', '#2a4f8a', '#d8ab45', '#b8322a'];
      for (let i = 0; i < 16; i++) { g.fillStyle = cols[i % 4]; g.fillRect(i * 64, 0, 64, H); g.fillStyle = '#f2d98a'; g.beginPath(); g.arc(i * 64 + 32, 32, 14, 0, 7); g.fill(); }
    });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(14.4, 0.6, 0.5), [lam('#2a4f8a'), lam('#2a4f8a'), dark, dark, lam('#fff', { map: beamT }), lam('#fff', { map: beamT })]);
    beam.position.set(0, 4.55, -1); S.add(beam);
    // 匾額
    const pl = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.0, 0.12), [gold, gold, gold, gold, basic('#fff', { map: plaqueTex('文昌帝君', { w: 640, h: 190, font: 120 }) }), gold]);
    pl.position.set(0, 5.35, -0.7); S.add(pl);
    // 屋頂：四面坡＋燕尾脊
    const tile = canvasTex(256, 256, (g, W, H) => { g.fillStyle = '#b5543a'; g.fillRect(0, 0, W, H); g.fillStyle = '#8f3c28'; for (let x = 0; x < W; x += 16) g.fillRect(x, 0, 6, H); });
    tile.wrapS = tile.wrapT = THREE.RepeatWrapping; tile.repeat.set(10, 3);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(1, 10.6, 2.6, 4, 1), lam('#fff', { map: tile }));
    roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, 0.62); roof.position.set(0, 6.15, -5.5);
    const roofG = new THREE.Group(); roofG.add(roof); S.add(roofG);
    roof.scale.set(1.02, 1, 0.66);
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.4, 0.5), lam('#7a2a1c')); ridge.position.set(0, 7.5, -5.5); S.add(ridge);
    [-1, 1].forEach(s => {
      const tail = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.14, 8, 16, Math.PI / 2), lam('#7a2a1c'));
      tail.position.set(4.8 * s, 8.4, -5.5); tail.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI; tail.scale.set(1, 1, 1); S.add(tail);
    });
    const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12), lam('#e8b84a', { emissive: '#5a3a00' })); pearl.position.set(0, 8.0, -5.5); S.add(pearl);
    // 燈籠
    this.lanterns = [];
    [-4.6, -1.4, 1.4, 4.6].forEach(x => this.addLantern(x, 3.7, -0.6));
    // 殿內藻井色塊
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(14, 9.4), lam('#5a2a20', { side: THREE.DoubleSide })); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 5.1, -5.5); S.add(ceil);
    // 供桌
    const tableM = lam('#8a2a20');
    const table = new THREE.Mesh(new THREE.BoxGeometry(5, 1.0, 1.1), tableM); table.position.set(0, 0.5, -6.3); S.add(table);
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 0.8), basic('#fff', { map: canvasTex(512, 96, (g, W, H) => {
      g.fillStyle = '#c8352b'; g.fillRect(0, 0, W, H); g.fillStyle = '#f3d27a'; g.font = '900 58px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('文 星 高 照', W / 2, H / 2 + 3);
    }) }));
    cloth.position.set(0, 0.55, -5.74); S.add(cloth);
    const topBoard = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.08, 1.2), lam('#5a1a14')); topBoard.position.set(0, 1.03, -6.3); S.add(topBoard);
    // 燭台
    [-2.1, 2.1].forEach(x => {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.5), lam('#d23a2a')); c.position.set(x, 1.32, -6.5); S.add(c);
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), basic('#ffcc66')); f.scale.y = 1.6; f.position.set(x, 1.65, -6.5); S.add(f);
    });
    // 小香爐
    const small = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.26, 0.3, 16), lam('#9a7a3a')); small.position.set(0, 1.22, -6.55); S.add(small);
    this.offeringSlots = new THREE.Group(); this.offeringSlots.position.set(0, 1.07, -6.15); S.add(this.offeringSlots);
    // 拜墊
    [-1.4, 0, 1.4].forEach(x => {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.45, 0.16, 18), lam('#b8322a')); c.position.set(x, 0.08, -4.75); S.add(c);
    });
    // 籤筒桌
    const st = new THREE.Mesh(new THREE.BoxGeometry(1, 0.9, 1), lam('#6a2a1e')); st.position.set(2.7, 0.45, -5.65); S.add(st);
    const tube = new THREE.Group(); tube.position.set(2.7, 0.9, -5.65); S.add(tube); this.qianTube = tube;
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
    const S = this.scene, red = lam('#a12c22');
    [-2.9, 2.9].forEach(x => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 4, 12), red); p.position.set(x, 2, 10); S.add(p); });
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(7, 0.5, 0.6), lam('#2a4f8a')); lintel.position.set(0, 4.1, 10); S.add(lintel);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 5.2, 1.3, 4, 1), lam('#b5543a')); roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, 0.3); roof.position.set(0, 4.95, 10); S.add(roof);
    const pt = plaqueTex('文昌祠', { w: 512, h: 170, font: 110 });
    const pl = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 0.1), [lam('#d8ab45'), lam('#d8ab45'), lam('#d8ab45'), lam('#d8ab45'), basic('#fff', { map: pt }), basic('#fff', { map: pt })]);
    pl.position.set(0, 3.45, 10.3); S.add(pl);
    [-1.6, 1.6].forEach(x => this.addLantern(x, 3.4, 10.4));
    // 圍牆
    const wallM = lam('#a5473a'), capM = lam('#2f6b5c');
    const seg = (x, z, w, d) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 2.2, d), wallM); m.position.set(x, 1.1, z); S.add(m); const c = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.2, d + 0.2), capM); c.position.set(x, 2.3, z); S.add(c); };
    seg(-6.85, 10.1, 7.1, 0.5); seg(6.85, 10.1, 7.1, 0.5);
    seg(-10.25, 4.5, 0.5, 11.6); seg(10.25, 4.5, 0.5, 11.6);
  }

  buildCourt() {
    // 石獅（簡化）一對
    [-2.4, 2.4].forEach(x => {
      const g = new THREE.Group(); g.position.set(x, 0, 8.6);
      const ped = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.9), lam('#8f8476')); ped.position.y = 0.35; g.add(ped);
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 10), lam('#a59a8a')); body.scale.set(0.9, 1.1, 1); body.position.y = 1.05; g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.33, 14, 10), lam('#a59a8a')); head.position.set(0, 1.55, 0.1); g.add(head);
      const mane = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.1, 8, 16), lam('#8f8476')); mane.position.set(0, 1.55, 0.05); g.add(mane);
      this.scene.add(g); g.rotation.y = Math.PI;
    });
  }

  buildGod() {
    // 神龕＋文昌帝君（Q 版、坐姿、手持如意）
    const S = this.scene, gold = lam('#d8ab45'), shrineM = lam('#5a1a14');
    const sh = new THREE.Group(); sh.position.set(0, 0, -8.9); S.add(sh);
    const base = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.6, 2), shrineM); base.position.y = 0.8; sh.add(base);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3.4, 0.3), shrineM); frame.position.set(0, 3.3, -0.85); sh.add(frame);
    const halo = new THREE.Mesh(new THREE.CircleGeometry(1.25, 40), basic('#fff', { map: canvasTex(256, 256, (g, W) => {
      const gr = g.createRadialGradient(128, 128, 10, 128, 128, 128); gr.addColorStop(0, '#fff2c0'); gr.addColorStop(0.6, '#e8b84a'); gr.addColorStop(1, '#b8322a');
      g.fillStyle = gr; g.fillRect(0, 0, W, W); g.strokeStyle = 'rgba(255,240,200,.7)'; g.lineWidth = 4; for (let r = 40; r < 128; r += 22) { g.beginPath(); g.arc(128, 128, r, 0, 7); g.stroke(); }
    }) })); halo.position.set(0, 3.35, -0.68); sh.add(halo);
    const pt = plaqueTex('文昌帝君', { vertical: false, w: 512, h: 120, font: 80, bg: '#2a1410' });
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.52), basic('#fff', { map: pt })); pl.position.set(0, 5.1, -0.68); sh.add(pl);
    [-1.9, 1.9].forEach(x => { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.4, 10), gold); c.position.set(x, 3.3, -0.6); sh.add(c); });

    const god = new THREE.Group(); god.position.set(0, 1.6, -0.2); sh.add(god); this.god = god;
    const robe = lam('#2f6e5c'), trim = gold, skin = lam('#f3d6b6');
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.85, 0.7, 20), robe); lower.position.y = 0.35; god.add(lower);
    const knees = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.35, 0.7), robe); knees.position.set(0, 0.3, 0.35); god.add(knees);
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 0.8, 20), robe); torso.position.y = 1.05; god.add(torso);
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.06, 8, 20), trim); belt.rotation.x = Math.PI / 2; belt.position.y = 0.72; god.add(belt);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.07, 8, 20), lam('#b8322a')); collar.rotation.x = Math.PI / 2; collar.position.y = 1.45; god.add(collar);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 18), skin); head.position.y = 1.9; god.add(head);
    [-1, 1].forEach(s => {
      const eye = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.015, 4, 10, Math.PI), lam('#2a1a10')); eye.position.set(0.17 * s, 1.95, 0.47); god.add(eye);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.4, 4, 10), robe); arm.position.set(0.5 * s, 1.0, 0.25); arm.rotation.x = -1.1; god.add(arm);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), skin); hand.position.set(0.32 * s, 0.85, 0.6); god.add(hand);
    });
    // 長鬍子
    const beard = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 12), lam('#1f1a18')); beard.rotation.x = Math.PI; beard.position.set(0, 1.5, 0.42); god.add(beard);
    // 官帽
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.42, 20), lam('#1f2430')); hat.position.y = 2.38; god.add(hat);
    const hatTop = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.5), lam('#1f2430')); hatTop.position.y = 2.62; god.add(hatTop);
    const jewel = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), gold); jewel.position.set(0, 2.42, 0.46); god.add(jewel);
    // 如意
    const ruyi = new THREE.Group(); ruyi.position.set(0, 0.95, 0.66); ruyi.rotation.z = 0.9; god.add(ruyi);
    const rs = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.8), gold); ruyi.add(rs);
    const rh = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), lam('#e8d27a')); rh.scale.set(1.3, 0.8, 0.6); rh.position.y = 0.42; ruyi.add(rh);
    // 神前光
    this.godLight = new THREE.PointLight(0xffc27a, 6, 9, 1.6); this.godLight.position.set(0, 3.2, -6.4); S.add(this.godLight);
  }

  buildCenser() {
    const S = this.scene, bronze = lam('#6e5a3a');
    const g = new THREE.Group(); g.position.set(0, 0, 4); S.add(g); this.censer = g;
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
    // 香煙粒子
    const N = 60, pos = new Float32Array(N * 3);
    this.smoke = { N, life: new Float32Array(N).map(() => Math.random()), pos };
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const tex = canvasTex(64, 64, (c) => { const gr = c.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, 64, 64); });
    this.smokePts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.6, map: tex, transparent: true, opacity: 0.22, depthWrite: false, color: 0xeeeeee }));
    this.smokePts.position.copy(g.position); this.smokePts.position.y = 2.1; S.add(this.smokePts);
  }
  addStick(a, r, h) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, h), lam('#7a3a2a')); s.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), basic('#ff8a3a')); tip.position.y = h / 2; s.add(tip);
    this.sticks.add(s); return s;
  }

  buildCounter() {
    const S = this.scene;
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

  buildWall() {
    const S = this.scene, wood = lam('#6a3a22');
    const g = new THREE.Group(); g.position.set(8.4, 0, 4); g.rotation.y = -Math.PI / 2; S.add(g); this.wall = g;
    [-2.6, 2.6].forEach(x => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.2, 0.2), wood); p.position.set(x, 1.6, 0); g.add(p); });
    const roof = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.15, 0.9), lam('#2f6b5c')); roof.position.set(0, 3.3, 0); g.add(roof);
    [1.0, 1.75, 2.5].forEach(y => { const b = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.06, 0.06), wood); b.position.set(0, y, 0); g.add(b); });
    this.cards = [];
    const cols = ['#c8352b', '#e2b13c', '#2f7d6d', '#2a2f4a', '#c8352b', '#e2b13c'];
    let k = 0;
    [1.0, 1.75, 2.5].forEach(y => { for (let x = -2.3; x <= 2.3; x += 0.42) { if (Math.random() < 0.18) continue; this.addCard(x + (Math.random() - 0.5) * 0.08, y, cols[k++ % cols.length]); } });
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
    [[-8, 13], [8, 13.5], [-12.5, 2], [12.5, 0], [-12, -8], [12, -7]].forEach(([x, z]) => {
      const g = new THREE.Group(); g.position.set(x, 0, z);
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 2.2, 8), lam('#5a3a24')); t.position.y = 1.1; g.add(t);
      [[0, 2.8, 0, 1.4], [0.7, 2.4, 0.3, 1], [-0.6, 2.5, -0.2, 1.05], [0, 3.6, 0, 0.9]].forEach(([a, b, c, r]) => {
        const l = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), lam('#4f7a3a', { flatShading: true })); l.position.set(a, b, c); g.add(l);
      });
      S.add(g);
    });
  }

  // ---------- 供品、插香、擲筊 ----------
  setOfferings(list) {
    this.offeringSlots.clear();
    list.forEach((o, i) => {
      const x = (i - (list.length - 1) / 2) * 0.62;
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.04, 16), lam('#f4efe2')); plate.position.set(x, 0.02, 0); this.offeringSlots.add(plate);
      let m;
      if (o.id === 'scallion' || o.id === 'celery') { m = new THREE.Group(); for (let k = 0; k < 4; k++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.42), lam(o.color)); s.rotation.z = Math.PI / 2 + (k - 1.5) * 0.08; s.position.set(0, 0.06 + k * 0.03, (k - 1.5) * 0.04); m.add(s); } }
      else if (o.id === 'radish') { m = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.42, 12), lam(o.color)); m.rotation.z = Math.PI / 2; m.position.y = 0.1; }
      else if (o.id === 'zongzi') { m = new THREE.Mesh(new THREE.TetrahedronGeometry(0.17), lam(o.color)); m.position.y = 0.13; }
      else if (o.id === 'tea') { m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.12), lam('#c8352b')); m.position.y = 0.16; }
      else if (o.id === 'fagao') { m = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.18, 12), lam(o.color)); m.position.y = 0.11; }
      else { m = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), lam(o.color)); m.scale.y = 0.8; m.position.y = 0.12; }
      m.position.x += x; this.offeringSlots.add(m);
    });
  }
  plantIncense() {
    const base = Math.random() * 6.28;
    const added = [0, 1, 2].map(i => this.addStick(base + i * 0.2, 0.25 + Math.random() * 0.2, 0.55));
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

  tween(ms, fn, delay = 0, ease = t => t) { this.anims.push({ t: -delay, ms, fn, ease }); }

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
    p.x = Math.max(-9.6, Math.min(9.6, p.x)); p.z = Math.max(-9.4, Math.min(16, p.z));
    if (p.z < -0.8) p.x = Math.max(-6.4, Math.min(6.4, p.x));
    if (p.z > 9.6 && p.z < 10.6 && Math.abs(p.x) > 2.4) p.z = p.z < 10.1 ? 9.6 : 10.6;
    for (const [x1, z1, x2, z2] of BOXES) {
      if (p.x > x1 - 0.3 && p.x < x2 + 0.3 && p.z > z1 - 0.3 && p.z < z2 + 0.3) {
        const d = [p.x - (x1 - 0.3), (x2 + 0.3) - p.x, p.z - (z1 - 0.3), (z2 + 0.3) - p.z], m = Math.min(...d);
        if (m === d[0]) p.x = x1 - 0.3; else if (m === d[1]) p.x = x2 + 0.3; else if (m === d[2]) p.z = z1 - 0.3; else p.z = z2 + 0.3;
      }
    }
    for (const [x, z, r] of CIRCLES) { const dx = p.x - x, dz = p.z - z, d = Math.hypot(dx, dz), R = r + 0.3; if (d < R && d > 0.001) { p.x = x + dx / d * R; p.z = z + dz / d * R; } }
  }

  bindInput() {
    const el = this.canvas; let down = null;
    el.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now(), yaw: this.camYawTarget, moved: false }; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', e => {
      if (!down) return; const dx = e.clientX - down.x;
      if (Math.abs(dx) > 8 || Math.abs(e.clientY - down.y) > 8) down.moved = true;
      if (down.moved) { this.camYawTarget = down.yaw - dx * 0.008; this.camYaw = this.camYawTarget; this.focus = null; }
    });
    el.addEventListener('pointerup', e => {
      if (!down) return; const d = down; down = null;
      if (d.moved || performance.now() - d.t > 600) return;
      const ndc = new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
      const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, this.camera);
      const avs = [...this.avatars].filter(a => a !== this.player).map(a => a.root);
      const hitA = ray.intersectObjects(avs, true)[0];
      if (hitA) { this.emit('tapAvatar', hitA.object.userData.avatar, e); return; }
      const hit = ray.intersectObjects(this.ground, false)[0];
      if (hit) this.emit('tapGround', hit.point);
    });
    el.addEventListener('pointercancel', () => { down = null; });
    this.keys = {};
    addEventListener('keydown', e => { if (e.target.closest?.('input,textarea,dialog')) return; this.keys[e.key.toLowerCase()] = true; });
    addEventListener('keyup', e => { this.keys[e.key.toLowerCase()] = false; });
  }

  project(v) {
    const p = v.clone().project(this.camera);
    return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight, vis: p.z < 1 && p.z > -1 };
  }

  update() {
    const dt = Math.min(0.05, this.clock.getDelta());
    // 鍵盤走動
    const k = this.keys, P = this.player;
    if (P && (k.w || k.a || k.s || k.d || k.arrowup || k.arrowdown || k.arrowleft || k.arrowright)) {
      const f = (k.w || k.arrowup ? 1 : 0) - (k.s || k.arrowdown ? 1 : 0), s = (k.d || k.arrowright ? 1 : 0) - (k.a || k.arrowleft ? 1 : 0);
      const yaw = this.camYaw + Math.PI, fx = Math.sin(yaw), fz = Math.cos(yaw);
      const dx = fx * f - fz * s, dz = fz * f + fx * s;
      if (dx || dz) { P.path = null; P.target = { x: P.root.position.x + dx * 0.6, z: P.root.position.z + dz * 0.6 }; P._arrive = null; this.emit('manualMove'); }
    }
    for (const av of this.avatars) {
      const p = av.root.position; let moving = false;
      if (av.target) {
        const dx = av.target.x - p.x, dz = av.target.z - p.z, d = Math.hypot(dx, dz);
        const sp = (av.speed || 3.2) * dt;
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
      av.moving = moving;
      av.update(dt, moving);
    }
    // 動畫
    this.anims = this.anims.filter(a => { a.t += dt * 1000; if (a.t < 0) return true; const k = Math.min(1, a.t / a.ms); a.fn(a.ease(k)); return k < 1; });
    // 香煙
    const sm = this.smoke, arr = sm.pos;
    for (let i = 0; i < sm.N; i++) {
      sm.life[i] += dt * 0.25; if (sm.life[i] > 1) sm.life[i] = 0;
      const l = sm.life[i];
      arr[i * 3] = Math.sin(i * 1.7 + l * 3) * 0.3 * (0.4 + l); arr[i * 3 + 1] = l * 3.2; arr[i * 3 + 2] = Math.cos(i * 2.3 + l * 2) * 0.3 * (0.4 + l);
    }
    this.smokePts.geometry.attributes.position.needsUpdate = true;
    // 祈福卡搖動
    const t = this.clock.elapsedTime;
    this.cards.forEach(c => { c.rotation.x = Math.sin(t * 1.4 + c.userData.ph) * 0.08; c.rotation.z = Math.sin(t * 1.1 + c.userData.ph) * 0.05; });
    this.god.position.y = 1.6 + Math.sin(t * 1.2) * 0.015;
    // 鏡頭跟隨
    if (P) {
      this.camYaw = lerpAngle(this.camYaw, this.camYawTarget, Math.min(1, dt * 3));
      const pp = P.root.position, d = pp.z < -0.5 ? Math.min(this.camDist, 6.2) : this.camDist;
      const tgt = this.focus || new THREE.Vector3(pp.x, 1.3, pp.z);
      let want, dd = d;
      // 鏡頭不要穿進天公爐、櫃台、供桌等物件：擋到就拉近
      for (; dd > 2.4; dd -= 0.4) {
        want = new THREE.Vector3(pp.x + Math.sin(this.camYaw) * dd, this.camH * (0.6 + 0.4 * dd / d), pp.z + Math.cos(this.camYaw) * dd);
        if (camClear(want)) break;
      }
      // 殿內不要穿過屋頂與牆
      if (want.z < -0.6) want.y = Math.min(want.y, 3.0); // 殿內壓低鏡頭，避開燈籠與橫樑
      want.x = Math.max(-9.8, Math.min(9.8, want.x)); want.z = Math.max(-9.6, Math.min(22, want.z));
      this.camera.position.lerp(want, Math.min(1, dt * 4));
      this._look = this._look ? this._look.lerp(tgt, Math.min(1, dt * 4)) : tgt.clone();
      this.camera.lookAt(this._look);
    }
    this.renderer.render(this.scene, this.camera);
    return dt;
  }
}

function angDiff(a, b) { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }
function lerpAngle(a, b, k) { return a + angDiff(a, b) * k; }

// 簡單路徑：穿過山門、繞過天公爐
function route(a, b) {
  const pts = [];
  let cur = { x: a.x, z: a.z };
  const crossGate = (cur.z > 10.1) !== (b.z > 10.1);
  if (crossGate) {
    const k = (10.1 - cur.z) / (b.z - cur.z), x = cur.x + (b.x - cur.x) * k;
    if (Math.abs(x) > 1.8) { const gx = Math.max(-1.6, Math.min(1.6, x)), s = cur.z > 10.1 ? 1 : -1; pts.push({ x: gx, z: 10.1 + s * 1.1 }, { x: gx, z: 10.1 - s * 1.1 }); cur = pts[pts.length - 1]; }
  }
  // 與天公爐 (0,4) 的距離
  const segDist = (p, q) => { const vx = q.x - p.x, vz = q.z - p.z, L = vx * vx + vz * vz || 1, t = Math.max(0, Math.min(1, ((0 - p.x) * vx + (4 - p.z) * vz) / L)); return Math.hypot(p.x + vx * t, p.z + vz * t - 4); };
  if (segDist(cur, b) < 1.65) {
    const side = (cur.x + b.x) / 2 >= 0 ? 1 : -1;
    const near = { x: 2.2 * side, z: 4 };
    if (Math.abs(cur.z - 4) > 1 && Math.abs(b.z - 4) > 1) pts.push(near);
    else pts.push({ x: 2.2 * side, z: cur.z < 4 ? 2.6 : 5.4 }, { x: 2.2 * side, z: b.z < 4 ? 2.6 : 5.4 });
  }
  pts.push({ x: b.x, z: b.z });
  return pts;
}

function camClear(v) {
  if (Math.hypot(v.x, v.z - 4) < 1.9 && v.y < 3.6) return false;
  for (const [x1, z1, x2, z2] of BOXES) if (v.x > x1 - 0.4 && v.x < x2 + 0.4 && v.z > z1 - 0.4 && v.z < z2 + 0.4 && v.y < 3.4) return false;
  if (v.z < -0.8 && Math.abs(v.x) > 6.6) return false;
  for (const x of [-6.4, -2.8, 2.8, 6.4]) if (Math.hypot(v.x - x, v.z + 1) < 0.9) return false;
  for (const x of [-2.9, 2.9]) if (Math.hypot(v.x - x, v.z - 10) < 1.0) return false;
  if (v.z > 9.2) return false; // 不要退到山門外
  return true;
}

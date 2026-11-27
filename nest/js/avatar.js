// Q 版情侶角色：全部用基本幾何（3D）組成；姿勢：走路、坐、躺、牽手、抱抱、親親、拿東西
import * as THREE from '../vendor/three.module.min.js';

export const HAIRS = ['短髮', '鮑伯頭', '雙丸子', '馬尾', '頭頂丸子', '刺刺頭', '長髮', '爆炸頭', '中分', '公主切', '雙馬尾', '光頭'];
// 髮色（動物頭的毛色也用這一組）
export const HAIR_COLORS = ['#1d1612', '#4a2c1a', '#7a4b2a', '#c99a5b', '#2b2f4a', '#8c2f2f', '#e8b04a', '#e08a3a', '#f2a0b8', '#7a8ad8', '#e6e6ea'];
// 新顏色一律加在後面，舊玩家存的編號才不會跑掉
export const SKINS = ['#f7dcc6', '#eec3a0', '#d9a179', '#b07a52', '#7d5136', '#fbe6d6', '#5e3a24'];
// 頭型：人類，或可愛的動物頭、外星人
export const HEADS = ['人類', '小熊', '小貓', '小兔', '小狗', '熊貓', '外星人'];
export const EYES = ['圓圓', '笑瞇瞇', '閃亮大眼', '慵懶', '星星眼'];
export const MOUTHS = ['微笑', '開心', 'ω 貓嘴', '嘟嘴', '小嘴'];
export const CHEEKS = ['腮紅', '無', '雀斑'];
export const OUTFITS = [
  { name: '白T牛仔', top: '#f6f4ee', trim: '#9ab4d8', bottom: '#3d5a8a' },
  { name: '情侶帽T', top: '#f2a0b8', trim: '#ffffff', bottom: '#4a4f5a', hood: true },
  { name: '藍色帽T', top: '#7fa8e0', trim: '#ffffff', bottom: '#4a4f5a', hood: true },
  { name: '碎花洋裝', top: '#f7d6dc', trim: '#e07a8f', bottom: '#f7d6dc', skirt: true },
  { name: '海灘襯衫', top: '#58c0b8', trim: '#ffe08a', bottom: '#e8dcc0' },
  { name: '吊帶褲', top: '#f4efe2', trim: '#4a6a9a', bottom: '#4a6a9a', straps: true },
  { name: '毛衣', top: '#d98c5f', trim: '#f2e1c9', bottom: '#5b4636' },
  { name: '水手服', top: '#f8f8f4', trim: '#1f3a6a', bottom: '#1f3a6a', skirt: true, bow: '#c8241c' },
  { name: '小白裙', top: '#ffffff', trim: '#f0c8a0', bottom: '#ffffff', skirt: true },
  { name: '西裝', top: '#26304a', trim: '#e9e4d8', bottom: '#26304a' },
  { name: '熊熊睡衣', top: '#9a6a44', trim: '#f2e1c9', bottom: '#9a6a44', hood: true, belly: true },
  { name: '條紋衫', top: '#ffffff', trim: '#2c4a7a', bottom: '#2c3a4a', stripe: '#2c4a7a' },
];
// 不用解鎖、可以隨機抽到的服裝編號
export const FREE_OUTFIT_IDS = OUTFITS.map((o, i) => o.locked ? -1 : i).filter(i => i >= 0);
export const FREE_OUTFITS = FREE_OUTFIT_IDS.length;
export const GLASSES = ['無', '圓框', '方框', '圓墨鏡', '心形墨鏡', '貓眼框'];
/* 配件（衣櫃）：n 名字、p 島幣（0 免費）、c 帽子蓋住頭頂（頭頂翹起來的頭髮收進去） */
export const HATS = [{ n: '不戴', p: 0 }, { n: '毛線帽', p: 0, c: 1 }, { n: '漁夫帽', p: 0, c: 1 }, { n: '草帽', p: 0, c: 1 }, { n: '棒球帽', p: 0, c: 1 }, { n: '貝雷帽', p: 120, c: 1 },
  { n: '花冠', p: 150 }, { n: '雞蛋花髮夾', p: 0 }, { n: '大蝴蝶結', p: 0 }, { n: '兔耳髮箍', p: 120 }, { n: '貓耳髮箍', p: 120 }, { n: '耳罩耳機', p: 150 }, { n: '小皇冠', p: 300 }, { n: '聖誕帽', p: 150, c: 1 }, { n: '頭巾', p: 0 }];
export const GLASSES_P = [0, 0, 0, 0, 120, 120];
export const NECKS = [{ n: '不戴', p: 0 }, { n: '針織圍巾', p: 0 }, { n: '花環', p: 0 }, { n: '珍珠項鍊', p: 120 }, { n: '愛心金項鍊', p: 150 }, { n: '領結', p: 0 }, { n: '小領巾', p: 0 }];
export const EARS = [{ n: '不戴', p: 0 }, { n: '珍珠耳環', p: 0 }, { n: '金色圈圈', p: 120 }, { n: '星星耳環', p: 120 }, { n: '櫻桃耳環', p: 150 }];
// 配件：完成每日小任務解鎖（0 = 不戴）；3 是文昌帝君聖誕限定
export const ACCS = ['不戴', '愛心光環', '小花'];

export function randomLook(gender) {
  const g = gender || (Math.random() < 0.5 ? 'f' : 'm');
  const r = n => Math.floor(Math.random() * n);
  const fh = [1, 2, 3, 4, 6, 8, 9, 10], mh = [0, 5, 0, 7, 8];
  return { gender: g, hair: g === 'f' ? fh[r(fh.length)] : mh[r(mh.length)], hairColor: Math.random() < 0.8 ? r(4) : r(HAIR_COLORS.length), skin: r(SKINS.length),
    outfit: g === 'f' ? [0, 1, 3, 5, 7, 8][r(6)] : [0, 2, 4, 5, 6, 11][r(6)], glasses: Math.random() < 0.15 ? 1 + r(2) : 0, head: 0, eye: r(EYES.length), mouth: r(MOUTHS.length), cheek: Math.random() < 0.75 ? 0 : 1 + r(2) };
}

// 卡通（賽璐璐）明暗：三段色階，看起來像可愛的動畫角色
let _grad;
function toonGrad() {
  if (_grad) return _grad;
  _grad = new THREE.DataTexture(new Uint8Array([110, 190, 255]), 3, 1, THREE.RedFormat);
  _grad.minFilter = _grad.magFilter = THREE.NearestFilter; _grad.needsUpdate = true; return _grad;
}
const lam = (c, extra = {}) => new THREE.MeshToonMaterial({ color: c, gradientMap: toonGrad(), ...extra });
// 光暈貼圖：大家共用一張
let _glow;
function glowTex() {
  if (_glow) return _glow;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,240,180,1)'); gr.addColorStop(0.4, 'rgba(255,210,90,.5)'); gr.addColorStop(1, 'rgba(255,200,60,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); _glow = new THREE.CanvasTexture(c); return _glow;
}

export class Avatar {
  constructor(look) {
    this.root = new THREE.Group();
    this.t = Math.random() * 10;
    this.anim = 'idle';
    this.walkAmt = 0;
    this.bowT = -1;
    this.holding = false;
    this.setLook(look);
  }

  setLook(look) {
    this.look = { ...look };
    if (this.body) { this.root.remove(this.body); this.body.traverse(o => { o.geometry?.dispose(); }); }
    const L = this.look, out = OUTFITS[L.outfit % OUTFITS.length];
    const headType = (L.head | 0) % HEADS.length, furC = headType === 5 ? '#f4f2ee' : headType === 6 ? '#8fd16a' : HAIR_COLORS[L.hairColor % HAIR_COLORS.length];
    // 動物頭：手腳也換成毛色，看起來才是同一隻
    const skin = lam(headType ? furC : SKINS[L.skin % SKINS.length]), hair = lam(HAIR_COLORS[L.hairColor % HAIR_COLORS.length]);
    const top = lam(out.top), trim = lam(out.trim), bottom = lam(out.bottom), dark = lam('#2a2422');
    const body = new THREE.Group();

    // 腿與鞋
    this.legs = [-1, 1].map(s => {
      const g = new THREE.Group(); g.position.set(0.12 * s, 0.36, 0);
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.18, 4, 8), out.skirt ? skin : bottom); leg.position.y = -0.17; g.add(leg);
      const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), dark); shoe.scale.set(1, 0.6, 1.4); shoe.position.set(0, -0.33, 0.04); g.add(shoe);
      body.add(g); return g;
    });

    // 上半身（彎腰時整組轉動）
    const upper = new THREE.Group(); upper.position.y = 0.36; body.add(upper); this.upper = upper;
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.33, 0.5, 16), top); torso.position.y = 0.25; upper.add(torso);
    if (out.skirt) { const sk = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.42, 0.26, 16), bottom); sk.position.y = 0.02; upper.add(sk); }
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.335, 0.335, 0.05, 16), trim); belt.position.y = 0.08; upper.add(belt);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 6, 16), trim); collar.rotation.x = Math.PI / 2; collar.position.y = 0.5; upper.add(collar);
    // 服裝小細節
    if (out.bow) { const bm = lam(out.bow); [-1, 1].forEach(s => { const w = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), bm); w.scale.set(1.2, 0.8, 0.5); w.position.set(0.06 * s, 0.42, 0.24); upper.add(w); }); const k = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), bm); k.position.set(0, 0.42, 0.26); upper.add(k); }
    if (out.stripe) [-1, 1].forEach(s => { const st = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.46, 0.02), lam(out.stripe)); st.position.set(0.27 * s, 0.25, 0.12); st.rotation.z = -0.15 * s; upper.add(st); });
    if (out.frog) for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 4), trim); f.position.set(0.1, 0.42 - i * 0.09, 0.25 - i * 0.008); upper.add(f); }
    if (out.hood) { const hd = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), top); hd.rotation.x = -2.2; hd.position.set(0, 0.52, -0.2); upper.add(hd); }
    if (out.straps) { [-1, 1].forEach(s => { const st = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.34, 0.02), trim); st.position.set(0.11 * s, 0.33, 0.255); upper.add(st); }); const bib = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.03), trim); bib.position.set(0, 0.19, 0.29); upper.add(bib); }
    if (out.belly) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8), trim); b.scale.set(1, 1.1, 0.35); b.position.set(0, 0.22, 0.27); upper.add(b); }

    // 手臂（肩膀為轉軸）
    this.arms = [-1, 1].map(s => {
      const g = new THREE.Group(); g.position.set(0.31 * s, 0.44, 0);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.2, 4, 8), top); arm.position.y = -0.15; g.add(arm);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), skin); hand.position.y = -0.32; g.add(hand);
      upper.add(g); return g;
    });

    // 頭
    const head = new THREE.Group(); head.position.y = 0.92; upper.add(head); this.head = head;
    const fur = skin, black = lam('#161414');
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 18), headType ? fur : skin); face.scale.set(1, 0.95, 0.95);
    if (headType === 6) face.scale.set(1.05, 1.08, 0.95);
    head.add(face);
    const part = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); head.add(m); return m; };
    // 動物頭的耳朵、鼻子
    const muzzleM = lam(headType === 5 ? '#f4f2ee' : '#f3e2c8'), pinkM = lam('#f2a0b0');
    let mouthY = -0.12, mouthZ = 0.39;
    if (headType === 1 || headType === 5) { // 小熊、熊貓：圓耳朵
      const earM = headType === 5 ? black : fur;
      [-1, 1].forEach(s => { part(new THREE.SphereGeometry(0.13, 12, 10), earM, 0.3 * s, 0.33, -0.02); part(new THREE.SphereGeometry(0.07, 10, 8), headType === 5 ? black : muzzleM, 0.31 * s, 0.34, 0.06, 1, 1, 0.5); });
    }
    if (headType === 2) [-1, 1].forEach(s => { const e = part(new THREE.ConeGeometry(0.12, 0.22, 4), fur, 0.27 * s, 0.38, 0); e.rotation.z = -0.45 * s; e.rotation.y = Math.PI / 4; const i = part(new THREE.ConeGeometry(0.07, 0.13, 4), pinkM, 0.27 * s, 0.37, 0.05); i.rotation.z = -0.45 * s; i.rotation.y = Math.PI / 4; });
    if (headType === 3) [-1, 1].forEach(s => { const e = part(new THREE.CapsuleGeometry(0.07, 0.34, 4, 8), fur, 0.14 * s, 0.6, -0.02); e.rotation.z = -0.18 * s; const i = part(new THREE.CapsuleGeometry(0.035, 0.26, 4, 6), pinkM, 0.14 * s, 0.6, 0.04, 1, 1, 0.5); i.rotation.z = -0.18 * s; });
    if (headType === 4) [-1, 1].forEach(s => { const e = part(new THREE.SphereGeometry(0.15, 10, 8), lam(new THREE.Color(furC).multiplyScalar(0.7)), 0.4 * s, 0.02, -0.02, 0.45, 1.25, 0.8); e.rotation.z = 0.25 * s; });
    if (headType >= 1 && headType <= 5) {
      const big = headType === 1 || headType === 4 || headType === 5;
      part(new THREE.SphereGeometry(big ? 0.14 : 0.1, 12, 10), muzzleM, 0, -0.1, big ? 0.33 : 0.35, 1.25, 0.8, 0.75);
      part(new THREE.SphereGeometry(big ? 0.045 : 0.03, 8, 6), headType === 2 || headType === 3 ? pinkM : black, 0, -0.05, big ? 0.44 : 0.42, 1.3, 0.9, 0.8);
      mouthY = -0.15; mouthZ = big ? 0.435 : 0.41;
      if (headType === 2) [-1, 1].forEach(s => [-0.03, 0.01].forEach(dy => { const w = part(new THREE.BoxGeometry(0.16, 0.006, 0.006), black, 0.17 * s, -0.07 + dy, 0.39); w.rotation.z = dy * 4 * s; }));
    }
    if (headType === 5) [-1, 1].forEach(s => { const p = part(new THREE.SphereGeometry(0.075, 10, 8), black, 0.14 * s, -0.005, 0.355, 1, 1.35, 0.45); p.rotation.z = 0.5 * s; });
    if (headType === 6) { // 外星人：大黑眼、觸角
      [-1, 1].forEach(s => {
        const e = part(new THREE.SphereGeometry(0.1, 12, 10), black, 0.15 * s, 0.03, 0.35, 1.3, 0.8, 0.4); e.rotation.z = 0.45 * s;
        const hl = part(new THREE.SphereGeometry(0.02, 6, 4), lam('#ffffff'), 0.13 * s, 0.07, 0.39);
        const ant = part(new THREE.CylinderGeometry(0.012, 0.012, 0.28), fur, 0.13 * s, 0.53, 0); ant.rotation.z = -0.35 * s;
        part(new THREE.SphereGeometry(0.045, 8, 6), lam('#f6e05a', { emissive: '#7a6a00' }), 0.18 * s, 0.67, 0);
      });
    }
    // 眼睛（外星人有自己的大眼）
    const eyeM = lam('#1a1412'), es = (L.eye | 0) % EYES.length;
    if (headType !== 6) [-1, 1].forEach(s => {
      const x = 0.14 * s, z = 0.385;
      if (es === 1) { const e = part(new THREE.TorusGeometry(0.04, 0.012, 4, 10, Math.PI), eyeM, x, -0.01, z + 0.005); }
      else if (es === 2) { part(new THREE.SphereGeometry(0.062, 12, 10), eyeM, x, 0, z - 0.005, 1, 1.2, 0.5); part(new THREE.SphereGeometry(0.02, 6, 4), lam('#ffffff'), x + 0.02, 0.03, z + 0.03); part(new THREE.SphereGeometry(0.011, 6, 4), lam('#ffffff'), x - 0.02, -0.025, z + 0.03); }
      else if (es === 3) { part(new THREE.SphereGeometry(0.045, 10, 8), eyeM, x, -0.01, z, 1.1, 0.5, 0.5); part(new THREE.BoxGeometry(0.11, 0.014, 0.02), eyeM, x, 0.018, z + 0.008); }
      else if (es === 4) { const gm = lam('#e8b030', { emissive: '#5a3a00' }); const a = part(new THREE.OctahedronGeometry(0.055), gm, x, 0, z, 1, 1.3, 0.35); const b2 = part(new THREE.OctahedronGeometry(0.04), gm, x, 0, z + 0.005, 1.3, 1, 0.35); b2.rotation.z = Math.PI / 4; }
      else { part(new THREE.SphereGeometry(0.05, 12, 10), eyeM, x, 0, z, 1, 1.25, 0.5); part(new THREE.SphereGeometry(0.016, 6, 4), lam('#ffffff'), x + 0.016 * s, 0.025, z + 0.024); } // 圓圓眼加上亮點
    });
    // 臉頰
    const ck = (L.cheek | 0) % CHEEKS.length;
    [-1, 1].forEach(s => {
      if (ck === 0) { const blush = part(new THREE.CircleGeometry(0.055, 12), lam('#f2a0a0', { transparent: true, opacity: 0.7 }), 0.23 * s, -0.09, 0.36); blush.rotation.y = 0.5 * s; }
      if (ck === 2) [[0, 0], [0.04, 0.02], [0.03, -0.025]].forEach(([dx, dy]) => part(new THREE.SphereGeometry(0.011, 5, 4), lam('#8a5a3a'), (0.21 + dx) * s, -0.07 + dy, 0.37 - dx));
    });
    // 嘴巴
    const ms = (L.mouth | 0) % MOUTHS.length, mouthM = lam('#8a3a32');
    if (ms === 1) { const m = part(new THREE.CircleGeometry(0.05, 14, Math.PI, Math.PI), mouthM, 0, mouthY + 0.01, mouthZ + 0.005); part(new THREE.CircleGeometry(0.025, 10, Math.PI, Math.PI), pinkM, 0, mouthY - 0.02, mouthZ + 0.008); }
    else if (ms === 2) [-1, 1].forEach(s => { const m = part(new THREE.TorusGeometry(0.022, 0.009, 4, 8, Math.PI), mouthM, 0.022 * s, mouthY, mouthZ); m.rotation.z = Math.PI; });
    else if (ms === 3) part(new THREE.TorusGeometry(0.022, 0.012, 6, 12), lam('#d8607a'), 0, mouthY, mouthZ);
    else if (ms === 4) part(new THREE.BoxGeometry(0.05, 0.012, 0.01), mouthM, 0, mouthY, mouthZ);
    else { const m = part(new THREE.TorusGeometry(0.035, 0.012, 4, 10, Math.PI), mouthM, 0, mouthY, mouthZ); m.rotation.z = Math.PI; }

    // 髮型（動物頭、外星人、光頭沒有頭髮）
    const h = L.hair % HAIRS.length, cover = !!HATS[(L.hat | 0) % HATS.length]?.c;
    if (!headType && h !== 11) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.445, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), hair);
      cap.rotation.x = -0.32; cap.position.set(0, 0.02, -0.02); head.add(cap);
      const back = new THREE.Mesh(new THREE.SphereGeometry(0.45, 20, 14, Math.PI * 1.08, Math.PI * 0.84, Math.PI * 0.2, Math.PI * 0.5), hair);
      back.position.z = -0.03; head.add(back);
    }
    const add = (geo, x, y, z, sx = 1, sy = 1, sz = 1) => (cover && y > 0.2 ? { rotation: {}, position: {} } : part(geo, hair, x, y, z, sx, sy, sz)); /* 戴帽子：頭頂翹起來的頭髮（丸子、刺刺、爆炸頭上面）收進帽子裡 */
    if (!headType) {
      // 鮑伯頭：圓柱 theta=0 在正前方，缺口要留在前面露出臉
      if (h === 1) { add(new THREE.CylinderGeometry(0.46, 0.48, 0.42, 20, 1, true, Math.PI * 0.32, Math.PI * 1.36), 0, -0.1, 0); }
      if (h === 2) { add(new THREE.SphereGeometry(0.15, 12, 10), -0.3, 0.33, -0.05); add(new THREE.SphereGeometry(0.15, 12, 10), 0.3, 0.33, -0.05); }
      if (h === 3) { add(new THREE.SphereGeometry(0.13, 12, 10), 0, 0.12, -0.44); add(new THREE.CapsuleGeometry(0.1, 0.3, 4, 8), 0, -0.18, -0.5); }
      if (h === 4) { add(new THREE.SphereGeometry(0.17, 12, 10), 0, 0.46, -0.08); }
      if (h === 5) { for (let i = 0; i < 7; i++) { const a = (i / 6 - 0.5) * 2.2; const m = add(new THREE.ConeGeometry(0.09, 0.22, 6), Math.sin(a) * 0.32, 0.36 + Math.cos(a) * 0.05, -0.02 + Math.cos(a) * 0.05); m.rotation.z = -a * 0.7; } }
      if (h === 6) { add(new THREE.BoxGeometry(0.78, 0.7, 0.18), 0, -0.3, -0.33); }
      // 爆炸頭：一圈蓬蓬的球，不擋到臉
      if (h === 7) [[0, 0.42, -0.04], [0.3, 0.32, -0.1], [-0.3, 0.32, -0.1], [0.4, 0.08, -0.12], [-0.4, 0.08, -0.12], [0, 0.3, -0.32], [0.24, 0.1, -0.34], [-0.24, 0.1, -0.34], [0, 0.05, -0.42]].forEach(([x, y, z]) => add(new THREE.SphereGeometry(0.2, 10, 8), x, y, z));
      if (h === 8) [-1, 1].forEach(s => { const m = add(new THREE.BoxGeometry(0.1, 0.42, 0.3), 0.39 * s, -0.08, 0.02); m.rotation.z = 0.08 * s; });
      if (h === 9) { add(new THREE.BoxGeometry(0.8, 0.75, 0.18), 0, -0.32, -0.33); [-1, 1].forEach(s => add(new THREE.BoxGeometry(0.08, 0.36, 0.16), 0.37 * s, -0.17, 0.16)); }
      if (h === 10) [-1, 1].forEach(s => { add(new THREE.SphereGeometry(0.08, 8, 6), 0.4 * s, 0.22, -0.08); const t = add(new THREE.CapsuleGeometry(0.085, 0.34, 4, 8), 0.5 * s, -0.08, -0.1); t.rotation.z = 0.25 * s; });
    }
    if (out.hat) { // 狀元帽：黑色官帽＋兩邊帽翅＋紅花
      const hatM = lam('#1f1a18');
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.26, 16), hatM); crown.position.y = 0.42; head.add(crown);
      [-1, 1].forEach(s => { const w = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.08), hatM); w.position.set(0.48 * s, 0.42, -0.08); head.add(w); });
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), lam('#d23a2c')); fl.position.set(0.18, 0.52, 0.22); head.add(fl);
    }
    if (out.cap) {
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.04, 0.72), dark); board.position.y = 0.43; board.rotation.y = Math.PI / 4; head.add(board);
      const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.25), lam('#e2b13c')); tassel.position.set(0.3, 0.3, 0.1); head.add(tassel);
    }
    const gl = (L.glasses | 0) % GLASSES.length;
    if (gl) {
      const gm = lam(gl === 4 ? '#e8507a' : gl === 5 ? '#3a2a2a' : '#2a2a2a'), lens = lam(gl === 4 ? '#ff8fb0' : '#1e2430', { transparent: true, opacity: gl === 3 || gl === 4 ? 0.88 : 0 });
      [-1, 1].forEach(s => {
        let r;
        if (gl === 4) { r = heartMesh(0.1, gm); r.position.set(0.15 * s, -0.01, 0.41); r.rotation.x = Math.PI / 2; head.add(r); const l = heartMesh(0.085, lens); l.position.set(0.15 * s, -0.01, 0.418); l.rotation.x = Math.PI / 2; head.add(l); return; }
        const ring = gl === 2 ? new THREE.TorusGeometry(0.09, 0.014, 4, 4) : new THREE.TorusGeometry(gl === 3 ? 0.095 : 0.085, gl === 5 ? 0.02 : 0.014, 6, 18);
        r = new THREE.Mesh(ring, gm); r.position.set(0.14 * s, 0.0, 0.41); if (gl === 2) r.rotation.z = Math.PI / 4; if (gl === 5) { r.scale.set(1.15, 0.8, 1); r.rotation.z = -0.25 * s; } head.add(r);
        if (gl === 3) { const d = new THREE.Mesh(new THREE.CircleGeometry(0.09, 16), lens); d.position.set(0.14 * s, 0, 0.412); head.add(d); }
        if (gl === 5) { const tip = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.07, 4), gm); tip.position.set(0.24 * s, 0.07, 0.4); tip.rotation.z = -1.1 * s; head.add(tip); }
      });
      const br = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.1), gm); br.rotation.z = Math.PI / 2; br.position.set(0, 0.02, 0.42); head.add(br);
    }
    this.buildAcc(head, L, lam, part);

    // 配件：1 愛心光環、2 頭上小花
    const acc = L.acc | 0;
    if (acc === 1) { const hm = lam('#ff7a9a', { emissive: '#7a1030' }); const halo = new THREE.Group(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, h = heartMesh(0.07, hm); h.position.set(Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3); halo.add(h); } halo.position.y = 0.62; head.add(halo); this.halo = halo; } else this.halo = null;
    if (acc === 2) { const pm = lam('#ffb0c8'); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, p = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), pm); p.position.set(0.28 + Math.cos(a) * 0.06, 0.34 + Math.sin(a) * 0.06, 0.18); head.add(p); } const c = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), lam('#ffe07a')); c.position.set(0.28, 0.34, 0.2); head.add(c); }

    // 特效：1 金色光暈、2 金色腳印（由場景畫在地上）、3 頭頂文昌星
    const fx = L.fx | 0; this.fxGlow = this.fxStar = null;
    if (fx === 1) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: '#ffd76a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85 }));
      sp.scale.set(2.2, 2.6, 1); sp.position.y = 0.95; body.add(sp); this.fxGlow = sp;
    }
    if (fx === 4) { // 小天燈：飄在肩膀旁邊
      const lg = new THREE.Group(); lg.position.set(0.55, 1.75, 0); body.add(lg); this.fxLamp = lg;
      const lb = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.2, 8), new THREE.MeshBasicMaterial({ color: '#ffb04a' })); lg.add(lb);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: '#ffb050', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); sp.scale.set(0.7, 0.7, 1); lg.add(sp);
    } else this.fxLamp = null;
    if (fx === 5) { // 綠葉環繞
      const lg = new THREE.Group(); lg.position.y = 1.0; body.add(lg); this.fxLeaves = lg;
      for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2, l = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), lam('#6fbf4a')); l.scale.set(1.6, 0.35, 0.9); l.position.set(Math.cos(a) * 0.62, Math.sin(a * 2) * 0.15, Math.sin(a) * 0.62); lg.add(l); }
    } else this.fxLeaves = null;
    if (fx === 3) {
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.14), lam('#ffe08a', { emissive: '#c08a10' })); star.position.y = 2.25; body.add(star); this.fxStar = star;
    }

    // 手上拿的東西（釣竿、棉花糖、花…）掛在右手
    const hand = new THREE.Group(); hand.position.set(0, -0.34, 0.04); this.arms[1].add(hand); this.handSlot = hand;
    if (this.item) hand.add(this.item);

    // 影子
    const sh = new THREE.Mesh(new THREE.CircleGeometry(0.42, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.01; body.add(sh);

    body.traverse(o => { if (o.isMesh) o.userData.avatar = this; });
    this.shadow = sh;
    this.body = body; this.root.add(body);
  }

  // 表情動作：wave 揮手、jump 開心跳、hug 抱抱、kiss 親親、pat 摸頭、cheer 歡呼、clap 拍手
  emote(kind, dur = 1.6) { this.emoteKind = kind; this.emoteT = 0; this.emoteDur = dur; }
  // 姿勢：'stand' | 'sit' | 'lie' | 'swing'
  setPose(p) { this.pose = p || 'stand'; }
  // 牽手：side = -1 牽左手、1 牽右手、0 放開
  holdHand(side) { this.handSide = side | 0; }
  // 拿東西：傳入 Object3D，null 放下
  setItem(obj) { if (this.item) this.handSlot.remove(this.item); this.item = obj || null; if (obj) this.handSlot.add(obj); }
  // 手往前伸（烤棉花糖、釣魚、划船）
  reach(on) { this.reaching = !!on; }
  // 靠在對方肩膀上：-1 往左、1 往右、0 坐正
  lean(side) { this.leanSide = side | 0; }

  /* 帽子／頭飾、項鍊、耳環（頭的座標：臉是半徑 0.42 的球，下巴約在 y -0.4） */
  buildAcc(head, L, lam, part) {
    const M = (geo, c, x, y, z, sx = 1, sy = 1, sz = 1, ex = {}) => { const m = new THREE.Mesh(geo, typeof c === 'string' ? lam(c, ex) : c); m.position.set(x, y, z); m.scale.set(sx, sy, sz); head.add(m); return m; };
    const flower = (x, y, z, petal, center, r = 0.05, rx = 0, ry = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.set(rx, ry, 0); const pm = lam(petal); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, p = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), pm); p.position.set(Math.cos(a) * r * 1.1, Math.sin(a) * r * 1.1, 0); p.scale.z = 0.45; g.add(p); } const c = new THREE.Mesh(new THREE.SphereGeometry(r * 0.6, 8, 6), lam(center)); c.position.z = r * 0.25; g.add(c); head.add(g); return g; };
    const hat = (L.hat | 0) % HATS.length;
    if (hat === 1) { const c = '#e9877a'; M(new THREE.SphereGeometry(0.47, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), c, 0, 0.05, -0.02, 1, 1.02, 1); const band = M(new THREE.TorusGeometry(0.455, 0.06, 8, 26), '#f3d3c8', 0, 0.07, -0.02); band.rotation.x = Math.PI / 2; M(new THREE.SphereGeometry(0.1, 10, 8), '#f8efe8', 0, 0.55, -0.02); }
    if (hat === 2) { const c = '#d9cdb4'; M(new THREE.CylinderGeometry(0.36, 0.45, 0.3, 20), c, 0, 0.36, -0.02); M(new THREE.CylinderGeometry(0.62, 0.66, 0.04, 22), c, 0, 0.2, -0.02).rotation.x = 0.06; const b = M(new THREE.TorusGeometry(0.43, 0.025, 6, 22), '#7a6a52', 0, 0.26, -0.02); b.rotation.x = Math.PI / 2; }
    if (hat === 3) { const st = '#e8cf8a'; M(new THREE.CylinderGeometry(0.32, 0.42, 0.28, 18), st, 0, 0.4, -0.02); const br = M(new THREE.CylinderGeometry(0.82, 0.86, 0.035, 26), st, 0, 0.26, -0.02); br.rotation.x = 0.05; const rb = M(new THREE.TorusGeometry(0.405, 0.035, 6, 22), '#f08a8a', 0, 0.3, -0.02); rb.rotation.x = Math.PI / 2; flower(0.34, 0.33, 0.2, '#fbf6ea', '#f6d77a', 0.04, 0, 0.6); }
    if (hat === 4) { const c = '#3f6fb0'; M(new THREE.SphereGeometry(0.47, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), c, 0, 0.17, -0.02, 1.03, 0.85, 1.03); const v = M(new THREE.CylinderGeometry(0.34, 0.34, 0.05, 18, 1, false, -Math.PI / 2, Math.PI), c, 0, 0.2, 0.34, 1, 1, 1.1); v.rotation.x = 0.1; /* 帽簷平平往前，不能壓到眼睛（以前往下壓太多，正面看整張臉都被擋住） */ M(new THREE.SphereGeometry(0.04, 8, 6), '#f4f4f4', 0, 0.57, -0.02); }
    if (hat === 5) { const b = M(new THREE.SphereGeometry(0.5, 20, 10), '#b03a3e', -0.06, 0.36, -0.04, 1, 0.32, 1); b.rotation.z = 0.22; M(new THREE.CylinderGeometry(0.02, 0.02, 0.08), '#3a1a1a', -0.12, 0.54, -0.04); }
    if (hat === 6) { const cols = ['#f7a6c0', '#fbf6ea', '#f6d77a', '#c8a6ea', '#f7a6c0', '#fbf6ea', '#9ad3b8']; for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; flower(Math.sin(a) * 0.4, 0.32 + Math.cos(a) * 0.04, Math.cos(a) * 0.4 - 0.02, cols[i % cols.length], '#f6d77a', 0.042, -Math.PI / 2 + 0.5, a); } }
    if (hat === 7) { flower(0.33, 0.24, 0.22, '#fbf6ea', '#f6c84a', 0.065, 0, 0.75); }
    if (hat === 8) { const c = '#e84a6a', g = new THREE.Group(); g.position.set(0.22, 0.4, 0.16); g.rotation.set(-0.5, 0.35, 0.35); head.add(g); [-1, 1].forEach(s => { const w = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.24, 4), lam(c)); w.position.x = 0.13 * s; w.rotation.z = -Math.PI / 2 * s; w.scale.z = 0.45; g.add(w); }); const k = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), lam('#d23a5a')); g.add(k); } /* 大蝴蝶結斜斜別在頭上前面 */
    if (hat === 9 || hat === 10) { M(new THREE.TorusGeometry(0.465, 0.024, 6, 24, Math.PI), hat === 9 ? '#fbf3f5' : '#3a3036', 0, 0.02, -0.06); /* 髮箍從左耳繞過頭頂到右耳 */
      [-1, 1].forEach(s => { if (hat === 9) { const e = M(new THREE.CapsuleGeometry(0.065, 0.32, 4, 8), '#fbf3f5', 0.16 * s, 0.68, -0.04); e.rotation.z = -0.18 * s; const i = M(new THREE.CapsuleGeometry(0.035, 0.24, 4, 8), '#f6b6c8', 0.16 * s, 0.69, -0.0); i.rotation.z = -0.18 * s; }
        else { const e = M(new THREE.ConeGeometry(0.12, 0.2, 4), '#3a3036', 0.27 * s, 0.5, -0.04); e.rotation.z = -0.4 * s; e.rotation.y = Math.PI / 4; const i = M(new THREE.ConeGeometry(0.06, 0.11, 4), '#f6b6c8', 0.26 * s, 0.49, 0.0); i.rotation.z = -0.4 * s; i.rotation.y = Math.PI / 4; } }); }
    if (hat === 11) { M(new THREE.TorusGeometry(0.475, 0.035, 6, 24, Math.PI), '#f4f1ec', 0, 0.0, -0.04); [-1, 1].forEach(s => { const cup = M(new THREE.CylinderGeometry(0.13, 0.13, 0.1, 16), '#f4f1ec', 0.45 * s, -0.04, -0.03); cup.rotation.z = Math.PI / 2; M(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 16), '#e8a0b4', 0.51 * s, -0.04, -0.03).rotation.z = Math.PI / 2; }); }
    if (hat === 12) { const g = lam('#f2c94c', { emissive: '#4a3600' }); const base = M(new THREE.CylinderGeometry(0.17, 0.17, 0.08, 12, 1, true), g, 0.12, 0.46, 0); base.material.side = THREE.DoubleSide; for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; M(new THREE.ConeGeometry(0.035, 0.1, 4), g, 0.12 + Math.cos(a) * 0.16, 0.54, Math.sin(a) * 0.16); } M(new THREE.SphereGeometry(0.03, 8, 6), '#e8506a', 0.12, 0.47, 0.17); }
    if (hat === 13) { const c = '#d33a3a'; const cone = M(new THREE.ConeGeometry(0.42, 0.55, 18), c, 0, 0.5, -0.04); cone.rotation.z = 0.35; const band = M(new THREE.TorusGeometry(0.42, 0.07, 8, 24), '#f8f6f2', 0, 0.22, -0.03); band.rotation.x = Math.PI / 2; M(new THREE.SphereGeometry(0.09, 10, 8), '#f8f6f2', -0.24, 0.72, -0.04); }
    if (hat === 14) { const c = '#e9b04a'; const band = M(new THREE.TorusGeometry(0.44, 0.07, 8, 26), c, 0, 0.16, -0.02); band.rotation.x = Math.PI / 2 - 0.2; band.scale.set(1, 1, 0.5); [-1, 1].forEach(s => { const t = M(new THREE.ConeGeometry(0.06, 0.18, 4), c, 0.07 * s, 0.12, -0.5); t.rotation.z = 0.6 * s; t.rotation.x = -0.4; }); }
    /* 項鍊／圍巾：在下巴下面一圈 */
    const nk = (L.neck | 0) % NECKS.length, NY = -0.5;
    if (nk === 1) { const sc = '#d8564a'; const r = M(new THREE.TorusGeometry(0.22, 0.08, 8, 20), sc, 0, NY, 0); r.rotation.x = Math.PI / 2; const tail = M(new THREE.BoxGeometry(0.12, 0.3, 0.05), sc, 0.12, NY - 0.18, 0.2); tail.rotation.z = 0.15; M(new THREE.BoxGeometry(0.12, 0.04, 0.052), '#f3e3d0', 0.135, NY - 0.31, 0.2).rotation.z = 0.15; }
    if (nk === 2) { const cols = ['#f7a6c0', '#fbf6ea', '#f6d77a', '#f58a6a']; for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; M(new THREE.SphereGeometry(0.05, 8, 6), cols[i % 4], Math.sin(a) * 0.25, NY - 0.02 - Math.max(0, Math.cos(a)) * 0.1, Math.cos(a) * 0.22); } }
    if (nk === 3) { for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2; M(new THREE.SphereGeometry(0.025, 8, 6), '#fbf8f2', Math.sin(a) * 0.23, NY + 0.02 - Math.max(0, Math.cos(a)) * 0.08, Math.cos(a) * 0.21); } }
    if (nk === 4) { const g = lam('#f2c94c', { emissive: '#3a2a00' }); const ch = M(new THREE.TorusGeometry(0.22, 0.008, 4, 28), g, 0, NY + 0.02, 0.0); ch.rotation.x = Math.PI / 2 - 0.35; const h = heartMesh(0.05, lam('#e8506a', { emissive: '#4a0a1a' })); h.position.set(0, NY - 0.07, 0.23); head.add(h); }
    if (nk === 5) { const c = '#2c3e6a'; [-1, 1].forEach(s => { const w = M(new THREE.ConeGeometry(0.07, 0.12, 4), c, 0.065 * s, NY + 0.04, 0.24); w.rotation.z = -Math.PI / 2 * s; w.scale.z = 0.5; }); M(new THREE.SphereGeometry(0.035, 8, 6), c, 0, NY + 0.04, 0.25); }
    if (nk === 6) { const c = '#e9b04a'; const r = M(new THREE.TorusGeometry(0.21, 0.035, 6, 20), c, 0, NY + 0.02, 0); r.rotation.x = Math.PI / 2; const t = M(new THREE.ConeGeometry(0.12, 0.2, 3), c, 0, NY - 0.08, 0.2); t.rotation.x = Math.PI; t.scale.z = 0.3; }
    /* 耳環：臉的兩側 */
    const er = (L.ear | 0) % EARS.length;
    if (er) [-1, 1].forEach(s => { const x = 0.42 * s, y = -0.17, z = 0.02;
      if (er === 1) M(new THREE.SphereGeometry(0.035, 10, 8), '#fbf8f2', x, y, z);
      if (er === 2) { const r = M(new THREE.TorusGeometry(0.05, 0.012, 6, 16), lam('#f2c94c', { emissive: '#3a2a00' }), x, y - 0.03, z); r.rotation.y = Math.PI / 2; }
      if (er === 3) { const st = M(new THREE.OctahedronGeometry(0.045), lam('#f6d24a', { emissive: '#5a4200' }), x, y - 0.03, z, 1, 1, 0.4); st.rotation.y = Math.PI / 2; }
      if (er === 4) { [-0.025, 0.025].forEach(dz => M(new THREE.SphereGeometry(0.03, 8, 6), '#d8323c', x, y - 0.07, z + dz)); M(new THREE.CylinderGeometry(0.006, 0.006, 0.07), '#4a8a3a', x, y - 0.03, z).rotation.x = 0.3; } });
  }

  update(dt, moving) {
    this.t += dt;
    this.walkAmt += ((moving ? 1 : 0) - this.walkAmt) * Math.min(1, dt * 10);
    const w = this.walkAmt, s = Math.sin(this.t * 10), k = Math.min(1, dt * 8);
    if (this.halo) { this.halo.rotation.y += dt * 1.2; this.halo.position.y = 0.62 + Math.sin(this.t * 2) * 0.03; }
    if (this.fxGlow) this.fxGlow.material.opacity = 0.65 + Math.sin(this.t * 2.4) * 0.2;
    if (this.fxStar) { this.fxStar.rotation.y += dt * 2; this.fxStar.position.y = 2.25 + Math.sin(this.t * 2) * 0.06; }
    if (this.fxLamp) { this.fxLamp.position.y = 1.75 + Math.sin(this.t * 1.6) * 0.08; }
    if (this.fxLeaves) this.fxLeaves.rotation.y += dt * 1.2;
    const pose = this.pose || 'stand';
    this.sitAmt = (this.sitAmt || 0) + (((pose === 'sit' || pose === 'swing' || pose === 'recline') ? 1 : 0) - (this.sitAmt || 0)) * k;
    this.lieAmt = (this.lieAmt || 0) + ((pose === 'lie' ? 1 : 0) - (this.lieAmt || 0)) * k;
    const si = this.sitAmt, li = this.lieAmt;
    this.legs[0].rotation.x = s * 0.6 * w - 1.45 * si; this.legs[1].rotation.x = -s * 0.6 * w - 1.45 * si;
    // 躺下：整個身體往後倒（以腰為軸），稍微抬高才不會陷進地裡
    this.body.rotation.x = -Math.PI / 2 * li;
    this.body.position.z = 0;
    let by = Math.abs(Math.cos(this.t * 10)) * 0.05 * w + li * 0.28;
    let armX = [s * -0.5 * w, s * 0.5 * w], armZ = [-0.12, 0.12], lean = 0, headY = 0;
    if (si > 0.5) { armX = [-0.9, -0.9]; armZ = [0.15, -0.15]; }
    if (pose === 'swing') { armX = [-2.6, -2.6]; armZ = [0.25, -0.25]; }
    if (pose === 'recline') { lean = -0.55; armX = [-0.4, -0.4]; armZ = [0.25, -0.25]; }
    if (this.leanSide) { this.upper.rotation.z += (this.leanSide * 0.22 - this.upper.rotation.z) * k; } else this.upper.rotation.z *= 1 - k;
    if (li > 0.5) { armX = [-0.2, -0.2]; armZ = [-0.5, 0.5]; }
    if (this.reaching) { armX[1] = -1.25; armZ[1] = 0.05; armX[0] = -1.05; armZ[0] = -0.1; }
    // 牽手：靠近對方那隻手往旁邊伸
    if (this.handSide && si < 0.5 && li < 0.5) { const i = this.handSide < 0 ? 0 : 1; armX[i] = -0.15 + s * 0.15 * w; armZ[i] = this.handSide < 0 ? -0.55 : 0.55; }
    if (this.emoteKind) {
      this.emoteT += dt; const e = this.emoteT;
      if (this.emoteKind === 'wave') { armX[1] = -0.3; armZ[1] = 2.5 + Math.sin(e * 14) * 0.35; }
      if (this.emoteKind === 'jump') { by += Math.abs(Math.sin(e * 7)) * 0.35; armZ = [-0.9, 0.9]; }
      if (this.emoteKind === 'cheer') { by += Math.abs(Math.sin(e * 6)) * 0.2; armX = [-0.2, -0.2]; armZ = [-2.6, 2.6]; }
      if (this.emoteKind === 'clap') { armX = [-1.3, -1.3]; armZ = [0.5 + Math.sin(e * 18) * 0.25, -0.5 - Math.sin(e * 18) * 0.25]; }
      if (this.emoteKind === 'hug') { armX = [-1.35, -1.35]; armZ = [0.75, -0.75]; lean = 0.12; }
      if (this.emoteKind === 'kiss') { lean = 0.28 * Math.sin(Math.min(1, e / 0.5) * Math.PI / 2); armX = [-0.6, -0.6]; armZ = [0.3, -0.3]; by += 0.04; }
      if (this.emoteKind === 'pat') { armX[1] = -2.4; armZ[1] = 0.6 + Math.sin(e * 12) * 0.15; }
      if (this.emoteKind === 'shy') { armX = [-1.4, -1.4]; armZ = [0.55, -0.55]; headY = Math.sin(e * 3) * 0.2; lean = 0.1; }
      if (this.emoteKind === 'sleep') { headY = 0; }
      if (e > this.emoteDur) { this.emoteKind = null; }
    }
    this.body.position.y = by;
    this.upper.rotation.x += (lean - this.upper.rotation.x) * Math.min(1, dt * 12);
    this.arms.forEach((a, i) => { a.rotation.x += (armX[i] - a.rotation.x) * Math.min(1, dt * 12); a.rotation.z += (armZ[i] - a.rotation.z) * Math.min(1, dt * 12); });
    this.head.rotation.z = Math.sin(this.t * 1.3) * 0.03 * (1 - w);
    this.head.rotation.y += (headY - this.head.rotation.y) * k;
    if (this.shadow) this.shadow.visible = li < 0.3;
  }
}

// 小愛心（立體）：兩顆球＋一個錐
export function heartMesh(r, mat) {
  const g = new THREE.Group();
  [-1, 1].forEach(s => { const b = new THREE.Mesh(new THREE.SphereGeometry(r * 0.62, 10, 8), mat); b.position.set(r * 0.42 * s, r * 0.25, 0); g.add(b); });
  const c = new THREE.Mesh(new THREE.ConeGeometry(r * 0.88, r * 1.2, 12), mat); c.rotation.z = Math.PI; c.position.y = -r * 0.42; c.scale.z = 0.7; g.add(c);
  return g;
}

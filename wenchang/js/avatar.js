// Q 版考生角色：全部用基本幾何組成，不需要外部模型檔
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
  { name: '高中制服', top: '#f4f2ea', trim: '#2c4a7a', bottom: '#2c4a7a', skirt: true },
  { name: '國中運動服', top: '#ffffff', trim: '#c33b32', bottom: '#2a3a6a' },
  { name: '帽T', top: '#9aa3ad', trim: '#6c757d', bottom: '#3a3f4a' },
  { name: '紅唐裝', top: '#b8322a', trim: '#e7b54a', bottom: '#2a2220' },
  { name: '青色漢服', top: '#cfe3d6', trim: '#3f7d6a', bottom: '#cfe3d6', skirt: true },
  { name: '西裝', top: '#26304a', trim: '#e9e4d8', bottom: '#26304a' },
  { name: '學士服', top: '#1f1f26', trim: '#d6b04c', bottom: '#1f1f26', skirt: true, cap: true },
  { name: '毛衣', top: '#d98c5f', trim: '#f2e1c9', bottom: '#5b4636' },
  // 以下是獎勵解鎖的限定服裝
  { name: '書生服', top: '#dbe8f2', trim: '#3a5a8a', bottom: '#dbe8f2', skirt: true, locked: true },
  { name: '狀元袍', top: '#b8241c', trim: '#e8c15a', bottom: '#b8241c', skirt: true, hat: true, locked: true },
  { name: '水手服', top: '#f8f8f4', trim: '#1f3a6a', bottom: '#1f3a6a', skirt: true, bow: '#c8241c' },
  { name: '籃球衣', top: '#e8602a', trim: '#ffffff', bottom: '#e8602a', stripe: '#ffffff' },
  { name: '旗袍', top: '#c8241c', trim: '#e8c15a', bottom: '#c8241c', skirt: true, frog: true },
  { name: '道袍', top: '#3a5a8a', trim: '#f4efe2', bottom: '#3a5a8a', skirt: true },
  { name: '連帽外套', top: '#3a6ab8', trim: '#f4f4f4', bottom: '#2a2f3a', hood: true },
  { name: '吊帶褲', top: '#f4efe2', trim: '#4a6a9a', bottom: '#4a6a9a', straps: true },
  { name: '熊熊睡衣', top: '#9a6a44', trim: '#f2e1c9', bottom: '#9a6a44', hood: true, belly: true },
];
// 不用解鎖、可以隨機抽到的服裝編號
export const FREE_OUTFIT_IDS = OUTFITS.map((o, i) => o.locked ? -1 : i).filter(i => i >= 0);
export const FREE_OUTFITS = FREE_OUTFIT_IDS.length;
export const GLASSES = ['無', '圓框', '方框'];
// 配件：完成每日小任務解鎖（0 = 不戴）；3 是文昌帝君聖誕限定
export const ACCS = ['不戴', '金色光環', '狀元紅花', '魁星金冠'];

export function randomLook(gender) {
  const g = gender || (Math.random() < 0.5 ? 'f' : 'm');
  const r = n => Math.floor(Math.random() * n);
  const fh = [1, 2, 3, 4, 6, 8, 9, 10], mh = [0, 5, 0, 1, 7, 8, 11];
  return { gender: g, hair: g === 'f' ? fh[r(fh.length)] : mh[r(mh.length)], hairColor: Math.random() < 0.8 ? r(4) : r(HAIR_COLORS.length), skin: r(SKINS.length),
    outfit: FREE_OUTFIT_IDS[r(FREE_OUTFITS)], glasses: Math.random() < 0.3 ? 1 + r(2) : 0, head: 0, eye: r(EYES.length), mouth: r(MOUTHS.length), cheek: Math.random() < 0.75 ? 0 : 1 + r(2) };
}

const lam = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });
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
      else part(new THREE.SphereGeometry(0.045, 10, 8), eyeM, x, 0, z, 1, 1.25, 0.5);
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
    const h = L.hair % HAIRS.length;
    if (!headType && h !== 11) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.445, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), hair);
      cap.rotation.x = -0.32; cap.position.set(0, 0.02, -0.02); head.add(cap);
      const back = new THREE.Mesh(new THREE.SphereGeometry(0.45, 20, 14, Math.PI * 1.08, Math.PI * 0.84, Math.PI * 0.2, Math.PI * 0.5), hair);
      back.position.z = -0.03; head.add(back);
    }
    const add = (geo, x, y, z, sx = 1, sy = 1, sz = 1) => part(geo, hair, x, y, z, sx, sy, sz);
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
    if (L.glasses) {
      const gm = lam('#2a2a2a');
      [-1, 1].forEach(s => {
        const ring = L.glasses === 1 ? new THREE.TorusGeometry(0.085, 0.014, 6, 18) : new THREE.TorusGeometry(0.09, 0.014, 4, 4);
        const r = new THREE.Mesh(ring, gm); r.position.set(0.14 * s, 0.0, 0.41); if (L.glasses === 2) r.rotation.z = Math.PI / 4; head.add(r);
      });
      const br = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.1), gm); br.rotation.z = Math.PI / 2; br.position.set(0, 0.02, 0.42); head.add(br);
    }

    // 配件
    const acc = L.acc | 0, goldM = lam('#e8c15a', { emissive: '#7a5410' });
    if (acc === 1) { const halo = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 8, 28), goldM); halo.rotation.x = Math.PI / 2; halo.position.y = 0.62; head.add(halo); this.halo = halo; } else this.halo = null;
    if (acc === 2) {
      const red = lam('#d23a2c');
      const sash = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.04, 6, 24), red); sash.position.set(0, 0.27, 0); sash.rotation.set(Math.PI / 2, 0.75, 0); upper.add(sash);
      const flower = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), red); flower.scale.set(1, 1, 0.5); flower.position.set(0, 0.36, 0.3); upper.add(flower);
      [-1, 1].forEach(s => { const r = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.02), red); r.position.set(0.05 * s, 0.24, 0.31); r.rotation.z = 0.3 * s; upper.add(r); });
    }
    if (acc === 3) {
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.14, 12, 1, true), goldM); crown.position.y = 0.42; head.add(crown);
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; const sp = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 5), goldM); sp.position.set(Math.sin(a) * 0.21, 0.55, Math.cos(a) * 0.21); head.add(sp); }
      const gem = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), lam('#c8352b')); gem.position.set(0, 0.43, 0.23); head.add(gem);
    }

    // 特效：1 金色光暈、2 金色腳印（由場景畫在地上）、3 頭頂文昌星
    const fx = L.fx | 0; this.fxGlow = this.fxStar = null;
    if (fx === 1) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: '#ffd76a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85 }));
      sp.scale.set(2.2, 2.6, 1); sp.position.y = 0.95; body.add(sp); this.fxGlow = sp;
    }
    if (fx === 3) {
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.14), lam('#ffe08a', { emissive: '#c08a10' })); star.position.y = 2.25; body.add(star); this.fxStar = star;
    }

    // 手上的三炷香
    const inc = new THREE.Group(); inc.position.set(0, -0.36, 0.06); inc.visible = this.holding;
    this.stickParts = [];
    for (let i = -1; i <= 1; i++) {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5), lam('#8a3a2a')); s.position.set(i * 0.035, 0.22, 0); s.rotation.z = i * 0.06; inc.add(s);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), new THREE.MeshBasicMaterial({ color: '#ff8a3a' })); tip.position.set(i * 0.05, 0.47, 0); inc.add(tip);
      this.stickParts.push([s, tip]);
    }
    this.arms[1].add(inc); this.incense = inc; this.setSticks(this.sticks ?? 3);

    // 影子
    const sh = new THREE.Mesh(new THREE.CircleGeometry(0.42, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.01; body.add(sh);

    body.traverse(o => { if (o.isMesh) o.userData.avatar = this; });
    this.body = body; this.root.add(body);
  }

  // 表情動作：wave 揮手、thumb 比讚、jump 開心跳（bow 用 bow()）
  emote(kind) { if (kind === 'bow') { if (this.bowT < 0) this.bow(1); return; } this.emoteKind = kind; this.emoteT = 0; }
  kneel(on) { this.kneeling = !!on; }
  // 坐在讀書角的凳子上：腿往前伸、手放到桌上
  sit(on) { this.sitting = !!on; }
  hold(on) { this.holding = on; if (this.incense) this.incense.visible = on; }
  // 手上還剩幾炷香（插了一炷就少一炷）
  setSticks(n) { this.sticks = n; this.stickParts?.forEach(([s, t], i) => { const v = n === 3 || (n === 2 ? i !== 1 : i === 1); s.visible = t.visible = v; }); }
  // 拜三拜：回傳 Promise
  bow(times = 3) {
    this.bowT = 0; this.bowTimes = times;
    return new Promise(r => { this._bowDone = r; });
  }

  update(dt, moving) {
    this.t += dt;
    this.walkAmt += ((moving ? 1 : 0) - this.walkAmt) * Math.min(1, dt * 10);
    const w = this.walkAmt, s = Math.sin(this.t * 10);
    if (this.halo) this.halo.position.y = 0.62 + Math.sin(this.t * 2) * 0.03;
    if (this.fxGlow) this.fxGlow.material.opacity = 0.65 + Math.sin(this.t * 2.4) * 0.2;
    if (this.fxStar) { this.fxStar.rotation.y += dt * 2; this.fxStar.position.y = 2.25 + Math.sin(this.t * 2) * 0.06; }
    // 跪在拜墊上：腿往後折、身體放低
    this.kneelAmt = (this.kneelAmt || 0) + ((this.kneeling ? 1 : 0) - (this.kneelAmt || 0)) * Math.min(1, dt * 8);
    const kn = this.kneelAmt;
    this.sitAmt = (this.sitAmt || 0) + ((this.sitting ? 1 : 0) - (this.sitAmt || 0)) * Math.min(1, dt * 8);
    const si = this.sitAmt;
    this.legs[0].rotation.x = s * 0.6 * w + 1.45 * kn - 1.45 * si; this.legs[1].rotation.x = -s * 0.6 * w + 1.45 * kn - 1.45 * si;
    this.body.position.y = Math.abs(Math.cos(this.t * 10)) * 0.05 * w - 0.1 * kn;
    let armX = [s * -0.5 * w, s * 0.5 * w], armZ = [-0.12, 0.12], bowX = 0;
    const together = this.holding || this.bowT >= 0;
    if (together) { armX = [-1.15, -1.15]; armZ = [0.45, -0.45]; }
    else if (si > 0.5) { armX = [-1.0, -1.0]; armZ = [0.2, -0.2]; }
    if (this.bowT >= 0) {
      this.bowT += dt;
      const per = 1.1, k = this.bowT / per;
      bowX = Math.sin(Math.min(1, k % 1) * Math.PI) * 0.55;
      if (k >= this.bowTimes) { this.bowT = -1; bowX = 0; this._bowDone?.(); }
    }
    if (this.emoteKind) {
      this.emoteT += dt; const e = this.emoteT;
      if (this.emoteKind === 'wave') { armX[1] = -0.3; armZ[1] = 2.5 + Math.sin(e * 14) * 0.35; }
      if (this.emoteKind === 'thumb') { armX[1] = -1.5; armZ[1] = -0.1; }
      if (this.emoteKind === 'jump') { this.body.position.y = Math.abs(Math.sin(e * 7)) * 0.35; armZ = [-0.9, 0.9]; }
      if (e > 1.4) { this.emoteKind = null; this.body.position.y = 0; }
    }
    this.upper.rotation.x += (bowX - this.upper.rotation.x) * Math.min(1, dt * 14);
    this.arms.forEach((a, i) => { a.rotation.x += (armX[i] - a.rotation.x) * Math.min(1, dt * 12); a.rotation.z += (armZ[i] - a.rotation.z) * Math.min(1, dt * 12); });
    this.head.rotation.z = Math.sin(this.t * 1.3) * 0.03 * (1 - w);
    if (this.incense) this.incense.rotation.x = 1.15;
  }
}

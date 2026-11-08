// 方案 C 的角色：Polyfork 的身體（有骨架、真實動作）＋我們自己做的 Q 版大頭
// 身體：Polyfork 人物（CC BY 4.0），用頂點顏色換衣服顏色、換膚色、藏起手上的道具
// 動作：Quaternius（CC0）的坐、吃、澆水、跳舞…放在 anims/；走路、待機、跑步、大笑從 Polyfork 線上讀取（沒網路時用備用動作）
// 抱抱、親親、牽手、揮手這些沒有現成動作，用程式把手臂轉到指定方向
import * as THREE from '../vendor/three.module.min.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import * as SkeletonUtils from '../vendor/SkeletonUtils.js';
import { Avatar as HeadMaker, HAIR_COLORS, SKINS, heartMesh } from './avatar.js';
import { toonGrad } from './models.js';

export { HAIRS, HAIR_COLORS, SKINS, HEADS, EYES, MOUTHS, CHEEKS, ACCS, heartMesh } from './avatar.js';

// ---------- 身體（衣服） ----------
// 每個身體列出顏色區塊：skin 皮膚、top 上衣、bottom 褲子、print 圖案、hide 手上的道具（藏起來）
const BODIES = {
  tee: { id: 'neighborhood-child-8cc5ac', skin: ['daaf87'], top: ['d27f69'], bottom: ['3f4a58'] },
  hoodie: { id: 'teen-player-37865e', skin: ['d5b192'], top: ['3d9679', '38896f', '3b8e73'], print: ['d1a737'], bottom: ['302f2f'] },
  sweater: { id: 'kite-kid-0a7d70', skin: ['dbad8b'], top: ['b54f46', 'a3473f', 'a84941', 'a84a40', 'a84a41', 'bf463e'], bottom: ['6683a1', '718fab', '6683a2'], hide: ['b7845a', 'c4a990', '9a6e49', 'dfdde0'] },
  long: { id: 'student-in-a-hoodie-7c8223', skin: ['dcb490'], top: ['d1c8bd', 'c6bdb2', 'beb5aa', 'c3baaf', 'f0ede9'], bottom: ['56534f', '4b4946'], hide: ['6e4f39', '4a494b', 'e7e3dd', '6a4b32', '292a2c'] },
  street: { id: 'street-skater-4ee28b', skin: ['d7a47d'], top: ['5c554c'], print: ['d8673d', '5e92b7', '37373d', 'c5bbaa'], bottom: ['8e9fa7', '83939d'], hide: ['c74333', '8c959d', '242427', 'c8945e', '2e2e30', 'dfaf3d', '508ebf'] },
};
// 衣服：kind = 'casual' 休閒、'pj' 睡衣、'couple' 情侶裝（兩個人穿一樣）
export const OUTFITS = [
  { name: '珊瑚色T恤', kind: 'casual', body: 'tee' },
  { name: '綠色帽T', kind: 'casual', body: 'hoodie' },
  { name: '紅色毛衣', kind: 'casual', body: 'sweater' },
  { name: '米色大學T', kind: 'casual', body: 'long' },
  { name: '街頭T恤', kind: 'casual', body: 'street' },
  { name: '天藍T恤', kind: 'casual', body: 'tee', top: '#78aee0', bottom: '#d8cbaa' },
  { name: '鵝黃帽T', kind: 'casual', body: 'hoodie', top: '#eec850', bottom: '#5a6a8a', print: '#ffffff' },
  { name: '粉紅睡衣', kind: 'pj', body: 'hoodie', top: '#f59ab4', bottom: '#f59ab4', print: '#ffffff', cap: '#f59ab4' },
  { name: '天藍睡衣', kind: 'pj', body: 'hoodie', top: '#86b8ea', bottom: '#86b8ea', print: '#ffffff', cap: '#86b8ea' },
  { name: '小雞睡衣', kind: 'pj', body: 'sweater', top: '#f8d050', bottom: '#f8d050', cap: '#f8d050' },
  { name: '情侶白T', kind: 'couple', body: 'tee', top: '#f8f6f0', bottom: '#4a6a9a', heart: true },
  { name: '情侶粉帽T', kind: 'couple', body: 'hoodie', top: '#f4a6bc', bottom: '#4a4f5a', print: '#ffffff', heart: true },
  { name: '情侶紅毛衣', kind: 'couple', body: 'sweater', top: '#c8323c', bottom: '#3a4a6a', heart: true },
];
export const KIND_NAMES = { casual: '休閒便服', pj: '睡衣', couple: '情侶裝' };
const CASUAL = OUTFITS.map((o, i) => o.kind === 'casual' ? i : -1).filter(i => i >= 0);

export function randomLook(gender) {
  const g = gender || (Math.random() < 0.5 ? 'f' : 'm'), r = n => Math.floor(Math.random() * n);
  const fh = [1, 2, 3, 4, 6, 8, 9, 10], mh = [0, 5, 0, 7, 8];
  return { gender: g, hair: g === 'f' ? fh[r(fh.length)] : mh[r(mh.length)], hairColor: Math.random() < 0.8 ? r(4) : r(HAIR_COLORS.length), skin: r(3),
    outfit: CASUAL[r(CASUAL.length)], glasses: Math.random() < 0.15 ? 1 + r(2) : 0, head: 0, eye: r(5), mouth: r(5), cheek: Math.random() < 0.75 ? 0 : 1 + r(2), acc: 0 };
}

// ---------- 載入 ----------
const loader = new GLTFLoader(), bodyCache = new Map();
function loadBody(id) { if (!bodyCache.has(id)) bodyCache.set(id, loader.loadAsync(`models/chars/${id}.glb`)); return bodyCache.get(id); }
export function preloadBodies(looks) { return Promise.all(looks.map(l => loadBody(BODIES[OUTFITS[l.outfit % OUTFITS.length].body].id).catch(() => null))); }

// 動作：本機的（CC0）與線上的（Polyfork）
const LOCAL = ['Sitting', 'Sitting talking', 'Talking', 'Arms folded', 'Interact', 'Pick up', 'Crouch', 'Eating', 'Planting', 'Watering', 'Walk formal', 'Jog', 'Dance', 'Leaning on rail', 'Phone call', 'Harvesting'];
const ONLINE = ['Idle', 'Walk', 'Run', 'Laughing', 'Agree'];
const FALLBACK = { Idle: 'Arms folded', Walk: 'Walk formal', Run: 'Jog', Laughing: 'Talking', Agree: 'Talking' };
const slug = n => n.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const rawCache = new Map();
function getRaw(name) {
  if (!rawCache.has(name)) {
    const url = LOCAL.includes(name) ? `anims/anim-${slug(name)}.json` : `https://polyfork.dev/cdn/anim-${slug(name)}.json`;
    rawCache.set(name, fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .catch(() => FALLBACK[name] ? getRaw(FALLBACK[name]) : null));
  }
  return rawCache.get(name);
}
export function preloadClips() { return Promise.all([...ONLINE, 'Sitting', 'Dance', 'Eating', 'Watering', 'Planting', 'Pick up', 'Talking', 'Arms folded'].map(getRaw)); }
function toClip(raw, name, bones, restHipsY) {
  const tracks = [];
  for (const [bn, values] of Object.entries(raw.tracks)) { const b = bones[bn]; if (b && values.length) tracks.push(new THREE.QuaternionKeyframeTrack(`${b.uuid}.quaternion`, raw.times.slice(), Float32Array.from(values))); }
  const h = bones.Hips, ratio = restHipsY / 0.95, pos = new Float32Array(raw.hips.length);
  for (let i = 0; i < raw.hips.length; i += 3) { pos[i] = h.position.x; pos[i + 1] = restHipsY + raw.hips[i + 1] * ratio; pos[i + 2] = h.position.z; }
  tracks.push(new THREE.VectorKeyframeTrack(`${h.uuid}.position`, raw.times.slice(), pos));
  return new THREE.AnimationClip(name, -1, tracks);
}

// ---------- 顏色 ----------
const _c = new THREE.Color();
const hexOf = (r, g, b) => _c.setRGB(r, g, b, THREE.LinearSRGBColorSpace).getHexString();
function near(hex, list) { const a = parseInt(hex, 16); for (const h of list) { const b = parseInt(h, 16); if (Math.abs((a >> 16) - (b >> 16)) + Math.abs(((a >> 8) & 255) - ((b >> 8) & 255)) + Math.abs((a & 255) - (b & 255)) < 14) return h; } return null; }
function recolor(model, spec, out, skinHex) {
  const zones = [['skin', skinHex], ['top', out.top], ['bottom', out.bottom], ['print', out.print]];
  model.traverse(o => {
    if (!o.isSkinnedMesh && !o.isMesh) return;
    o.geometry = o.geometry.clone();
    const col = o.geometry.attributes.color, pos = o.geometry.attributes.position; if (!col) return;
    let anchor = -1;
    for (let i = 0; i < col.count; i++) {
      const hex = hexOf(col.getX(i), col.getY(i), col.getZ(i));
      if (spec.hide && near(hex, spec.hide)) { // 手上的道具：縮成一點
        if (anchor < 0) anchor = i; pos.setXYZ(i, pos.getX(anchor), pos.getY(anchor), pos.getZ(anchor)); continue;
      }
      for (const [zone, target] of zones) {
        if (!target || !spec[zone]) continue; const base = near(hex, spec[zone]); if (!base) continue;
        // 保留原本的深淺差別
        const sum = h => parseInt(h.slice(0, 2), 16) + parseInt(h.slice(2, 4), 16) + parseInt(h.slice(4, 6), 16);
        const k = Math.min(1.25, (sum(hex) + 1) / (sum(base) + 1));
        _c.set(target); _c.r = Math.min(1, _c.r * k); _c.g = Math.min(1, _c.g * k); _c.b = Math.min(1, _c.b * k);
        col.setXYZ(i, _c.r, _c.g, _c.b); break;
      }
    }
    col.needsUpdate = true; pos.needsUpdate = true;
  });
}

// ---------- 角色 ----------
const NECK_Y = 0.86;      // 脖子（頭骨）離地高度：決定身體大小
const HEAD_SIZE = 0.6;    // Q 版頭的大小
const HIP_SEAT = 0.306;   // 坐下時屁股離腳底的高度（main.js 的 HIP）
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const LAP = [-0.02, 0.06, 0.2];                 // 腿上放東西的位置（相對屁股）
export const GUITAR = { scale: 0.62, tilt: 0.42, neck: [0.34, 0.16] }; // 吉他：大小、琴頸往上翹的角度、左手握的位置
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _m = new THREE.Matrix4();

export class Avatar {
  constructor(look) {
    this.root = new THREE.Group();
    this.body = new THREE.Group(); this.root.add(this.body);
    this.t = Math.random() * 10; this.pose = 'stand'; this.handSide = 0; this.reaching = false; this.leanSide = 0;
    this.emoteKind = null; this.emoteT = 0; this.emoteDur = 0; this.clipEmote = null; this.ready = false;
    this.w = {}; // 各個手動姿勢的權重（平滑過渡）
    this.handSlot = new THREE.Group(); this.item = null;
    this.lap = new THREE.Group(); this.root.add(this.lap); this.lapItem = null; // 抱在腿上的東西（吉他）
    this.lastPos = new THREE.Vector3(); this.speed = 0;
    // 影子
    const sh = new THREE.Mesh(new THREE.CircleGeometry(0.36, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.01; this.root.add(sh); this.shadow = sh;
    this.setLook(look);
  }

  async setLook(look) {
    this.look = { ...look }; const token = this._tok = Symbol();
    const out = OUTFITS[(look.outfit | 0) % OUTFITS.length], spec = BODIES[out.body];
    const g = await loadBody(spec.id).catch(() => null); if (!g || token !== this._tok) return;
    // 換掉舊的身體
    if (this.model) { this.body.remove(this.model); this.mixer?.stopAllAction(); }
    const model = SkeletonUtils.clone(g.scene); this.model = model;
    const skinHex = SKINS[(look.skin | 0) % SKINS.length];
    recolor(model, spec, out, skinHex);
    const mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGrad() });
    model.traverse(o => { if (o.isMesh) { o.material = mat; o.frustumCulled = false; o.userData.avatar = this; } });
    const bones = {}; model.traverse(o => { if (o.isBone && !bones[o.name]) bones[o.name] = o; }); this.bones = bones;
    // 每一格先把骨頭放回原位，再套動作與手動姿勢（不然沒有動畫軌道的骨頭會一直累加轉動）
    this.bind = Object.values(bones).map(b => [b, b.quaternion.clone()]);
    // 縮放：脖子高度一樣
    model.updateMatrixWorld(true); const hp = bones.Head.getWorldPosition(new THREE.Vector3());
    const sc = NECK_Y / hp.y; model.scale.setScalar(sc); this.modelScale = sc;
    this.body.add(model);
    // 裝頭、愛心之前先把身體擺正（躺著、坐著、盪鞦韆時換衣服，頭才不會歪掉）
    const keep = { rr: this.root.rotation.clone(), br: this.body.rotation.clone(), bp: this.body.position.clone() };
    this.root.rotation.set(0, 0, 0); this.body.rotation.set(0, 0, 0); this.body.position.set(0, 0, 0); this.root.updateMatrixWorld(true);
    // 換上 Q 版頭：原本的頭縮到看不見，我們的頭掛在頭骨上
    const hb = bones.Head; hb.scale.setScalar(0.01); model.updateMatrixWorld(true);
    const maker = new HeadMaker({ ...look, outfit: 0, acc: look.acc | 0 }), head = maker.head; head.parent.remove(head); head.position.set(0, 0, 0);
    const holder = new THREE.Group(); holder.add(head); hb.add(holder);
    const hw = hb.getWorldPosition(new THREE.Vector3()), tgt = hw.clone().add(V(0, HEAD_SIZE * 0.33, 0.01));
    holder.position.copy(hb.worldToLocal(tgt.clone()));
    hb.getWorldQuaternion(_q); this.root.getWorldQuaternion(_q2); holder.quaternion.copy(_q.invert().multiply(_q2));
    const ws = hb.getWorldScale(new THREE.Vector3()); holder.scale.setScalar(HEAD_SIZE / 0.84 / ws.x);
    this.head = head; this.headHolder = holder; this.halo = maker.halo;
    head.traverse(o => { if (o.isMesh) o.userData.avatar = this; });
    // 睡帽、情侶裝的愛心
    if (out.cap) { const capG = new THREE.Group(), cm = new THREE.MeshToonMaterial({ color: out.cap, gradientMap: toonGrad() }); const cone = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.62, 16, 1, true), cm); cone.position.y = 0.5; cone.rotation.z = -0.35; capG.add(cone); const rim = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.07, 8, 20), new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: toonGrad() })); rim.rotation.x = Math.PI / 2; rim.position.y = 0.22; capG.add(rim); const pom = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), rim.material); pom.position.set(0.32, 0.74, 0); capG.add(pom); capG.position.y = 0.12; head.add(capG); }
    if (out.heart) { const h = heartMesh(0.1, new THREE.MeshToonMaterial({ color: '#ff5a8a', gradientMap: toonGrad() })); h.position.set(0, -0.02, 0.17); const sp = bones.Spine2; const holderH = new THREE.Group(); holderH.add(h); sp.add(holderH); sp.getWorldQuaternion(_q); this.root.getWorldQuaternion(_q2); holderH.quaternion.copy(_q.invert().multiply(_q2)); const s2 = sp.getWorldScale(new THREE.Vector3()); holderH.scale.setScalar(1 / s2.x); }
    this.root.rotation.copy(keep.rr); this.body.rotation.copy(keep.br); this.body.position.copy(keep.bp); this.root.updateMatrixWorld(true);
    // 手上的東西
    bones.RightHand.add(this.handSlot); const hs = bones.RightHand.getWorldScale(new THREE.Vector3()); this.handSlot.scale.setScalar(1 / hs.x);
    // 動作
    this.mixer = new THREE.AnimationMixer(model); this.actions = {}; this.cur = null;
    const restY = bones.Hips.position.y;
    const names = [...ONLINE, ...LOCAL.filter(n => n !== 'Walk formal' && n !== 'Jog')];
    const raws = await Promise.all(names.map(getRaw)); if (token !== this._tok) return;
    names.forEach((n, i) => { if (raws[i]) this.actions[n] = this.mixer.clipAction(toClip(raws[i], n, bones, restY)); });
    this.play('Idle', 0); this.mixer.update(Math.random() * 3);
    this.ready = true;
  }
  play(name, fade = 0.25, ts = 1) {
    const a = this.actions?.[name]; if (!a) return; a.timeScale = ts;
    if (this.cur === a) return; a.reset().play(); if (this.cur) this.cur.crossFadeTo(a, fade, false); else a.fadeIn(fade); this.cur = a;
  }

  // ---- 跟舊版一樣的介面 ----
  emote(kind, dur = 1.6) {
    const clipMap = { dance: 'Dance', laugh: 'Laughing', eat: 'Eating', water: 'Watering', plant: 'Planting', pickup: 'Pick up', talk: 'Talking', crouch: 'Crouch', interact: 'Interact', harvest: 'Harvesting', phone: 'Phone call', lean_rail: 'Leaning on rail', sittalk: 'Sitting talking', fold: 'Arms folded', agree: 'Agree' };
    // 動作＋手的姿勢一起：蹲下摸狗
    const COMBO = { petdog: ['Idle', 'petdog'] };
    if (COMBO[kind]) { this.clipEmote = COMBO[kind][0]; this.emoteKind = COMBO[kind][1]; }
    else if (clipMap[kind]) { this.clipEmote = clipMap[kind]; this.emoteKind = null; } else { this.emoteKind = kind; this.clipEmote = null; }
    this.emoteT = 0; this.emoteDur = dur;
  }
  setPose(p) { this.pose = p || 'stand'; }
  holdHand(side) { this.handSide = side | 0; }
  setItem(obj) { if (this.item) this.handSlot.remove(this.item); this.item = obj || null; if (obj) this.handSlot.add(obj); }
  setLap(obj) { if (this.lapItem) this.lap.remove(this.lapItem); this.lapItem = obj || null; if (obj) this.lap.add(obj); }
  reach(on) { this.reaching = !!on; }
  dig() { this.digT = 0.5; this.emoteT = 0; }
  holdUmbrella(on) { this.umb = !!on; }
  lean(side) { this.leanSide = side | 0; }
  kneel() {} hold() {}

  // 把骨頭（到子骨頭的方向）轉向角色空間的某個方向；w = 0..1
  aim(name, child, dir, w) {
    if (w < 0.01) return; const b = this.bones[name], c = this.bones[child]; if (!b || !c) return;
    b.getWorldPosition(_v1); c.getWorldPosition(_v2); const cur = _v2.sub(_v1).normalize();
    this.root.getWorldQuaternion(_q2); const want = dir.clone().normalize().applyQuaternion(_q2);
    _q.setFromUnitVectors(cur, want);                        // 世界空間的轉動
    b.getWorldQuaternion(_q3); _q3.premultiply(_q);           // 新的世界朝向
    b.parent.getWorldQuaternion(_q2); _q2.invert().multiply(_q3); // 換回父骨頭空間
    b.quaternion.slerp(_q2, w); b.updateMatrixWorld(true);
  }
  // 兩段手臂伸到角色空間的某一點（簡單 IK）；pole：手肘往哪邊彎
  ik(up, lo, hand, tgt, pole, w) {
    if (w < 0.01) return; const B = this.bones; if (!B[up] || !B[lo] || !B[hand]) return;
    const sh = B[up].getWorldPosition(new THREE.Vector3()), el = B[lo].getWorldPosition(new THREE.Vector3()), hd = B[hand].getWorldPosition(new THREE.Vector3());
    const a = sh.distanceTo(el), b = el.distanceTo(hd), T = this.root.localToWorld(tgt.clone());
    this.root.getWorldQuaternion(_q2); const iq = _q2.clone().invert();
    const toT = T.clone().sub(sh); const d = Math.min(toT.length(), (a + b) * 0.995); toT.normalize();
    const cosA = Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d))), sinA = Math.sqrt(1 - cosA * cosA);
    const pw = pole.clone().applyQuaternion(_q2); pw.sub(toT.clone().multiplyScalar(pw.dot(toT))).normalize();
    const elbow = sh.clone().add(toT.clone().multiplyScalar(a * cosA)).add(pw.multiplyScalar(a * sinA));
    this.aim(up, lo, elbow.clone().sub(sh).applyQuaternion(iq), w);
    const e2 = B[lo].getWorldPosition(new THREE.Vector3()); const tt = sh.clone().add(toT.multiplyScalar(d));
    this.aim(lo, hand, tt.sub(e2).applyQuaternion(iq), w);
  }
  // 在角色空間繞某軸轉（彎腰、側靠）
  twist(name, axis, ang) {
    if (Math.abs(ang) < 1e-3) return; const b = this.bones[name]; if (!b) return;
    this.root.getWorldQuaternion(_q2); const ax = axis.clone().applyQuaternion(_q2);
    _q.setFromAxisAngle(ax, ang); b.getWorldQuaternion(_q3); _q3.premultiply(_q); b.parent.getWorldQuaternion(_q2); _q2.invert().multiply(_q3); b.quaternion.copy(_q2); b.updateMatrixWorld(true);
  }
  wt(k, on, dt, speed = 8) { speed = typeof speed === 'number' ? speed : 8; const v = this.w[k] || 0; return (this.w[k] = v + ((on ? 1 : 0) - v) * Math.min(1, dt * speed)); }

  update(dt, moving) {
    this.t += dt;
    // 速度：用位置變化算
    const p = this.root.position; const sp = dt > 0 ? Math.hypot(p.x - this.lastPos.x, p.z - this.lastPos.z) / dt : 0; this.lastPos.copy(p);
    this.speed += (Math.min(sp, 8) - this.speed) * Math.min(1, dt * 8);
    if (this.halo) { this.halo.rotation.y += dt * 1.2; }
    if (!this.model || !this.actions) return;
    const pose = this.pose, seated = pose === 'sit' || pose === 'swing' || pose === 'recline' || pose === 'floor' || pose === 'ride';
    const k = Math.min(1, dt * 8);
    // 1. 選動作
    if (this.emoteKind || this.clipEmote) { this.emoteT += dt; if (this.emoteT > this.emoteDur) { this.emoteKind = null; this.clipEmote = null; } }
    if (seated) this.play('Sitting', 0.3);
    else if (pose === 'lie') this.play('Arms folded', 0.3);
    else if (pose === 'crouch') this.play('Crouch', 0.35, 0.25);
    else if (pose === 'hold' && !this.clipEmote) this.play('Idle', 0.35, 0.35);
    else if (this.clipEmote && this.actions[this.clipEmote]) this.play(this.clipEmote, 0.3);
    else if (moving && this.speed > 0.2) { if (this.speed > 3.6 && this.actions.Run) this.play('Run', 0.2, Math.min(1.5, this.speed / 4.6)); else this.play('Walk', 0.2, Math.max(0.6, Math.min(1.8, this.speed / 1.3))); }
    else this.play(this.reaching ? 'Arms folded' : 'Idle', 0.3);
    for (const [b, q0] of this.bind) b.quaternion.copy(q0);
    this.mixer.update(dt);
    this.model.updateMatrixWorld(true);
    // 2. 坐下時把屁股對到椅子的高度；躺下時整個人往後倒
    const hips = this.bones.Hips; hips.getWorldPosition(_v1); this.model.worldToLocal(_v1);
    const hipY = _v1.y * this.modelScale;
    this.lieAmt = (this.lieAmt || 0) + ((pose === 'lie' ? 1 : 0) - (this.lieAmt || 0)) * k;
    const seatOff = seated ? HIP_SEAT - hipY : 0; this.seatOff = (this.seatOff || 0) + (seatOff - (this.seatOff || 0)) * k;
    let by = this.seatOff + this.lieAmt * 0.16;
    this.body.rotation.x = -Math.PI / 2 * this.lieAmt;
    this.shadow.visible = this.lieAmt < 0.3 && !seated;
    // 3. 手動姿勢（覆蓋在動作上）
    const e = this.emoteKind, et = this.emoteT, R = 'RightArm', RF = 'RightForeArm', RH = 'RightHand', L = 'LeftArm', LF = 'LeftForeArm', LH = 'LeftHand';
    const s = (n, on, sp) => this.wt(n, on, dt, sp);
    let w;
    // 坐著：大腿往前、小腿往下（椅子）；坐地上：腳往前伸；斜躺：腳抬高一點
    const LL = [['LeftUpLeg', 'LeftLeg', 'LeftFoot', 1], ['RightUpLeg', 'RightLeg', 'RightFoot', -1]];
    // 騎腳踏車：兩腳輪流踩踏板（有在動才踩）
    this.pedal = (this.pedal || 0) + dt * Math.min(9, this.speed * 1.6);
    if ((w = s('legRide', pose === 'ride'))) LL.forEach(([u, l, f, sx], j) => { const ph = this.pedal + j * Math.PI; this.aim(u, l, V(0.07 * sx, -0.5 + Math.sin(ph) * 0.38, 0.85), w); this.aim(l, f, V(0.03 * sx, -1, -0.05 + Math.cos(ph) * 0.3), w); });
    if ((w = s('legChair', pose === 'sit' || pose === 'swing'))) LL.forEach(([u, l, f, sx]) => { this.aim(u, l, V(0.08 * sx, -0.05, 1), w); this.aim(l, f, V(0.03 * sx, -1, 0.12), w); });
    if ((w = s('legFloor', pose === 'floor'))) LL.forEach(([u, l, f, sx]) => { this.aim(u, l, V(0.12 * sx, 0.02, 1), w); this.aim(l, f, V(0.08 * sx, -0.1, 1), w); });
    if ((w = s('legRecl', pose === 'recline'))) LL.forEach(([u, l, f, sx]) => { this.aim(u, l, V(0.06 * sx, 0.18, 1), w); this.aim(l, f, V(0.04 * sx, -0.35, 1), w); });
    if ((w = s('swing', pose === 'swing'))) { this.aim(R, RF, V(-0.22, 1, 0.12), w); this.aim(RF, RH, V(-0.15, 1, 0.1), w); this.aim(L, LF, V(0.22, 1, 0.12), w); this.aim(LF, LH, V(0.15, 1, 0.1), w); }
    if ((w = s('recline', pose === 'recline'))) this.twist('Spine', V(1, 0, 0), -(this.reclineAng ?? 0.45) * w); // 往後靠的角度（海灘椅比沙發躺得更斜）
    if ((w = s('reach', this.reaching && pose !== 'lie'))) { this.aim(R, RF, V(-0.18, -0.15, 1), w); this.aim(RF, RH, V(-0.05, 0.1, 1), w); this.aim(L, LF, V(0.18, -0.2, 1), w * 0.8); this.aim(LF, LH, V(0.05, 0.05, 1), w * 0.8); }
    if ((w = s('handR', this.handSide < 0 && !seated && pose !== 'lie'))) { this.aim(R, RF, V(-0.42, -0.9, 0.12), w); this.aim(RF, RH, V(-0.35, -0.92, 0.18), w); }
    if ((w = s('handL', this.handSide > 0 && !seated && pose !== 'lie'))) { this.aim(L, LF, V(0.42, -0.9, 0.12), w); this.aim(LF, LH, V(0.35, -0.92, 0.18), w); }
    if ((w = s('lean', !!this.leanSide))) this.twist('Spine1', V(0, 0, 1), -this.leanSide * 0.2 * w);
    const osc = Math.sin(et * 14);
    if ((w = s('wave', e === 'wave'))) { this.aim(R, RF, V(-0.92, 0.38, 0.12), w); this.aim(RF, RH, V(-0.35 + osc * 0.4, 1, 0.25), w); }
    if ((w = s('cheer', e === 'cheer' || e === 'jump'))) { this.aim(R, RF, V(-0.85, 0.55, 0.1), w); this.aim(RF, RH, V(-0.45, 1, 0.1), w); this.aim(L, LF, V(0.85, 0.55, 0.1), w); this.aim(LF, LH, V(0.45, 1, 0.1), w); }
    if (e === 'jump' || e === 'cheer') by += Math.abs(Math.sin(et * (e === 'jump' ? 7 : 6))) * (e === 'jump' ? 0.3 : 0.15);
    if ((w = s('clap', e === 'clap'))) { const c = 0.35 + Math.sin(et * 18) * 0.25; this.aim(R, RF, V(-0.3, -0.25, 1), w); this.aim(RF, RH, V(c, 0.25, 1), w); this.aim(L, LF, V(0.3, -0.25, 1), w); this.aim(LF, LH, V(-c, 0.25, 1), w); }
    if ((w = s('hug', e === 'hug'))) { this.aim(R, RF, V(-0.5, 0.05, 1), w); this.aim(RF, RH, V(0.85, 0.05, 0.55), w); this.aim(L, LF, V(0.5, 0.05, 1), w); this.aim(LF, LH, V(-0.85, 0.05, 0.55), w); this.twist('Spine1', V(1, 0, 0), 0.12 * w); }
    if ((w = s('kiss', e === 'kiss'))) { this.twist('Spine1', V(1, 0, 0), 0.3 * w * Math.min(1, et * 3)); this.aim(R, RF, V(-0.3, -0.8, -0.5), w); this.aim(L, LF, V(0.3, -0.8, -0.5), w); }
    if ((w = s('pat', e === 'pat'))) { this.aim(R, RF, V(-0.15, 0.65, 0.8), w); this.aim(RF, RH, V(0.15, 0.1 + Math.sin(et * 12) * 0.25, 1), w); }
    if ((w = s('shy', e === 'shy'))) { this.aim(R, RF, V(-0.3, -0.55, 0.75), w); this.aim(RF, RH, V(0.35, 0.92, 0.2), w); this.aim(L, LF, V(0.3, -0.55, 0.75), w); this.aim(LF, LH, V(-0.35, 0.92, 0.2), w); this.twist('Spine1', V(0, 0, 1), Math.sin(et * 3) * 0.12 * w); }
    // 蹲下摸狗：右手往前下方輕輕摸
    // 撐傘：右手舉在肩膀前面
    if ((w = s('umb', this.umb && !seated && pose !== 'lie'))) { this.aim(R, RF, V(-0.3, -0.35, 0.55), w); this.aim(RF, RH, V(-0.05, 0.95, 0.2), w); }
    // 蹲著挖沙：雙手輪流往前下方挖
    if ((w = s('dig', pose === 'crouch'))) { const k = this.digT || 0; this.digT = Math.max(0, k - dt); const f = k > 0 ? Math.sin(et * 14) : 0; this.aim(R, RF, V(-0.2, -0.7, 0.7), w); this.aim(RF, RH, V(-0.05, -0.75 + f * 0.25, 0.6), w); this.aim(L, LF, V(0.2, -0.7, 0.7), w); this.aim(LF, LH, V(0.05, -0.75 - f * 0.25, 0.6), w); }
    // 彎腰摸狗：上半身往前彎、右手往前下方輕輕摸
    if ((w = s('petdog', e === 'petdog'))) { this.twist('Spine', V(1, 0, 0), 0.5 * w); this.twist('Spine1', V(1, 0, 0), 0.35 * w); this.aim(R, RF, V(-0.12, -0.75, 0.65), w); this.aim(RF, RH, V(0, -0.8 + Math.sin(et * 9) * 0.2, 0.6), w); this.aim(L, LF, V(0.25, -0.9, 0.2), w); }
    // 丟球：手往後舉 → 往前甩
    if ((w = s('throw', e === 'throw', 14))) { if (et < 0.35) { this.aim(R, RF, V(-0.3, 0.85, -0.45), w); this.aim(RF, RH, V(-0.1, 1, -0.3), w); } else { this.aim(R, RF, V(-0.2, 0.4, 1), w); this.aim(RF, RH, V(-0.1, 0.25, 1), w); } }
    // 坐著吃東西：手拿到嘴邊
    if ((w = s('eatseat', e === 'eatseat'))) { const k = (Math.sin(et * 3.5) + 1) / 2; this.aim(R, RF, V(-0.15, -0.35, 0.9), w); this.aim(RF, RH, V(0.25, 0.3 + k * 0.65, 0.6 - k * 0.3), w); }
    // 咬耳朵：身體往前傾、右手半遮在嘴邊
    if ((w = s('whisper', e === 'whisper'))) { this.twist('Spine', V(1, 0, 0), 0.22 * w); this.twist('Spine1', V(0, 1, 0), 0.25 * w); this.aim(R, RF, V(-0.3, -0.15, 0.85), w); this.aim(RF, RH, V(0.55, 0.8, 0.25), w); }
    // 彈吉他：左手扶琴頸、右手撥弦
    if ((w = s('strum', e === 'strum'))) {
      // 吉他橫抱在腿上：左手握琴頸（往左伸）、右手在音孔上撥弦，身體微微前傾跟著打拍子
      const lp = this.lap.position, sw = Math.sin(et * 9);
      this.twist('Spine', V(1, 0, 0), (0.18 + sw * 0.02) * w); this.twist('Spine1', V(0, 0, 1), -0.06 * w);
      this.ik(L, LF, LH, V(lp.x + GUITAR.neck[0], lp.y + GUITAR.neck[1], lp.z + 0.1), V(0.3, -1, -0.4), w);
      this.ik(R, RF, RH, V(lp.x - 0.02, lp.y + 0.08 + sw * 0.04, lp.z + 0.14), V(-0.6, -0.2, -1), w);
    }
    // 划船：兩手握住槳柄（位置由 main.js 每格算好，世界座標），身體跟著一推一拉前後擺
    if (this.rowGrip) this._grip = this.rowGrip; // 停槳時手慢慢放下，這段時間用最後的槳柄位置
    if ((w = s('row', e === 'row' && !!this.rowGrip, 6)) && this._grip) {
      const [A, B] = this._grip.map(p => this.root.worldToLocal(p.clone())), [Lp, Rp] = A.x > B.x ? [A, B] : [B, A];
      const lean = Math.max(-0.25, Math.min(0.3, ((Lp.z + Rp.z) / 2 - 0.3) * 0.8));
      this.twist('Spine', V(1, 0, 0), lean * 1.1 * w); this.twist('Spine1', V(1, 0, 0), lean * 0.5 * w);
      this.ik(L, LF, LH, Lp, V(1, -0.7, -0.5), w); this.ik(R, RF, RH, Rp, V(-1, -0.7, -0.5), w);
    }
    this.body.position.y = by;
    if (this.lapItem) { this.bones.Hips.getWorldPosition(_v1); this.root.worldToLocal(_v1); this.lap.position.set(_v1.x + LAP[0], _v1.y + LAP[1], _v1.z + LAP[2]); }
    // 4. 手上的東西保持跟身體同方向；頭微微晃
    if (this.item) { this.handSlot.parent.getWorldQuaternion(_q); this.root.getWorldQuaternion(_q2); this.handSlot.quaternion.copy(_q.invert().multiply(_q2)); }
    if (this.headHolder) this.head.rotation.z = (e === 'shy' ? Math.sin(et * 3) * 0.15 : Math.sin(this.t * 1.3) * 0.03);
  }
}

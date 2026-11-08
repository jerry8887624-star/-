// 小島場景：地形、海、天空（白天黑夜）、擺設、小屋室內
import * as THREE from '../vendor/three.module.min.js';
import { groundH, standH, shoreR, sandAmt, walkable, DOCK, HILL, LAND_Y } from './terrain.js';
import { M, load, one, scatter, animal, toon, CIRCLES, BOXES, animals, mixers } from './models.js';

// 各個活動的位置（main.js 用）
export const SPOTS = {
  door: { x: 0, z: -3.3 },
  mailbox: { x: 3.2, z: -2.6 },
  garden: { x: -10, z: 0.4, plots: [[-12, -1.6], [-10, -1.6], [-8, -1.6]] },
  swing: { x: -15, z: -11 },
  hammock: { x: 12, z: -11 },
  campfire: { x: 11, z: 6 },
  picnic: { x: -10, z: 8 },
  sunbathe: { x: 2, z: 23 },
  sandcastle: { x: -5, z: 23.5 },
  beach: { x: 8.5, z: 23.5 },
  fishing: { x: 41.6, z: 0 },
  boat: { x: 33.5, z: 1.6, boatX: 35.5, boatZ: 2.4 },
  sunset: { x: -23.2, z: -9.5 },
  dog: { x: 4, z: 2 },
};
// 室內（另一個場景，原點在房間中央）
export const ROOM = { w: 11, d: 8, h: 3 };
export const INSPOTS = {
  exit: { x: 3.8, z: 3.4 },
  bed: { x: -3.4, z: -1.2 },
  sofa: { x: 1.6, z: 0.6 },
  kitchen: { x: 3.6, z: -1.6 },
  dining: { x: -2.8, z: 2.2 },
  guitar: { x: -0.6, z: -2.6 },
};

function seeded(s) { return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

// ---------- 地形 ----------
function makeIsland() {
  const N = 220, size = 96;
  const geo = new THREE.PlaneGeometry(size, size, N, N); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
  const grass = new THREE.Color('#8fd06a'), grass2 = new THREE.Color('#74bd5a'), sand = new THREE.Color('#f3e2b3'), wet = new THREE.Color('#d9bf88'), deep = new THREE.Color('#c9b07a'), rockC = new THREE.Color('#9aa59a');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = groundH(x, z); pos.setY(i, h);
    const s = sandAmt(x, z), n = (Math.sin(x * 0.7) * Math.cos(z * 0.6) + Math.sin(x * 0.23 + z * 0.31)) * 0.5;
    c.copy(grass).lerp(grass2, 0.5 + n * 0.5);
    let sa = s; if (h > LAND_Y + 0.25) sa = 0; // 山丘上是草
    c.lerp(sand, sa);
    if (h < 0.15) c.lerp(wet, Math.min(1, (0.15 - h) / 0.3));
    if (h < -0.3) c.lerp(deep, 0.6);
    const dh = Math.hypot(x - HILL.x, z - HILL.z); if (dh < 3.5) c.lerp(rockC, 0.35 * (1 - dh / 3.5));
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, toon('#ffffff', { vertexColors: true })); m.name = 'ground'; return m;
}

// ---------- 海：顏色依離岸距離由淺到深，岸邊有白色浪花 ----------
function makeWater() {
  const geo = new THREE.PlaneGeometry(600, 600, 120, 120); geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uShallow: { value: new THREE.Color('#5fd8cf') }, uDeep: { value: new THREE.Color('#2f86c8') }, uFoam: { value: new THREE.Color('#ffffff') }, uDark: { value: 0 }, uSky: { value: new THREE.Color('#bfe6ff') } },
    vertexShader: `uniform float uTime; varying vec3 vP;
      void main(){ vec3 p = position; float r = length(p.xz);
        p.y += (sin(p.x*0.35+uTime*1.2)*0.06 + sin(p.z*0.42+uTime*0.9)*0.05) * smoothstep(20.0, 40.0, r);
        vec4 w = modelMatrix * vec4(p,1.0); vP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime; uniform vec3 uShallow, uDeep, uFoam, uSky; uniform float uDark; varying vec3 vP;
      void main(){ float a = atan(vP.z, vP.x); float R = 33.0 + 2.5*sin(3.0*a) + 1.5*sin(5.0*a+1.0);
        float r = length(vP.xz); float d = r - (R - 4.6);
        vec3 c = mix(uShallow, uDeep, smoothstep(-2.0, 22.0, d));
        float rip = sin(vP.x*1.3 + uTime*1.6) * sin(vP.z*1.1 - uTime*1.3);
        c += vec3(0.06) * smoothstep(0.6, 1.0, rip);
        float wave = sin(d*1.4 - uTime*1.8);
        float foam = smoothstep(1.4, 0.0, abs(d - 0.2 - wave*0.35)) * 0.9 + smoothstep(0.85, 1.0, wave) * smoothstep(5.0, 1.0, d) * 0.5;
        c = mix(c, uFoam, clamp(foam, 0.0, 1.0) * (1.0 - uDark*0.6));
        c = mix(c, uSky, smoothstep(80.0, 260.0, r) * 0.55);
        c *= mix(1.0, 0.32, uDark);
        float alpha = mix(0.55, 0.95, smoothstep(-3.0, 6.0, d));
        gl_FragColor = vec4(c, alpha); }`,
  });
  const m = new THREE.Mesh(geo, mat); m.position.y = 0; m.renderOrder = 1; return m;
}

// ---------- 天空：漸層圓頂＋星星＋太陽月亮＋雲 ----------
function makeSky() {
  const g = new THREE.Group();
  const mat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTop: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uBot: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uGlow: { value: new THREE.Color() } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 uTop, uMid, uBot, uGlow; uniform vec3 uSun; varying vec3 vD;
      void main(){ float y = vD.y; vec3 c = y > 0.0 ? mix(uMid, uTop, smoothstep(0.0, 0.55, y)) : mix(uMid, uBot, smoothstep(0.0, -0.2, y));
        float s = max(dot(normalize(vD), normalize(uSun)), 0.0); c += uGlow * pow(s, 8.0) * 0.6 + uGlow * pow(s, 200.0) * 1.5;
        gl_FragColor = vec4(c, 1.0); }` });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), mat); g.add(dome);
  // 星星
  const n = 900, sp = new Float32Array(n * 3), r = seeded(7);
  for (let i = 0; i < n; i++) { const u = r() * 2 - 1, th = r() * Math.PI * 2, y = Math.abs(u) * 0.9 + 0.08, k = Math.sqrt(1 - y * y); sp.set([Math.cos(th) * k * 380, y * 380, Math.sin(th) * k * 380], i * 3); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false })); g.add(stars);
  const sun = new THREE.Mesh(new THREE.SphereGeometry(10, 20, 12), new THREE.MeshBasicMaterial({ color: '#fff4d0', fog: false })); g.add(sun);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(7, 20, 12), new THREE.MeshBasicMaterial({ color: '#f4f0dc', fog: false })); g.add(moon);
  // 雲：幾團白色圓球
  const clouds = new THREE.Group(), cm = new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: null, fog: false, transparent: true, opacity: 0.95 });
  for (let i = 0; i < 9; i++) {
    const c = new THREE.Group(), k = 3 + Math.floor(r() * 4);
    for (let j = 0; j < k; j++) { const b = new THREE.Mesh(new THREE.SphereGeometry(4 + r() * 4, 10, 8), cm); b.position.set(j * 5 - k * 2.5, r() * 2, r() * 3); b.scale.y = 0.65; c.add(b); }
    const a = r() * Math.PI * 2, d = 150 + r() * 90; c.position.set(Math.cos(a) * d, 45 + r() * 35, Math.sin(a) * d); c.lookAt(0, c.position.y, 0); clouds.add(c);
  }
  g.add(clouds);
  return { g, mat, stars, sun, moon, clouds, cm };
}

// 一天的顏色：[時, 天頂, 地平線, 光色, 光強, 環境光強, 霧色, 夜晚程度]
const KEYS = [
  [0, '#0b1030', '#1b2350', '#6a7ab8', 0.25, 0.35, '#141a3a', 1],
  [4.5, '#141a44', '#3a3a6a', '#7a86c0', 0.3, 0.4, '#262a55', 0.9],
  [5.6, '#4a5aa0', '#f2a07a', '#ffb08a', 0.8, 0.6, '#d9a090', 0.4],
  [7, '#6ab4f0', '#ffe2b8', '#fff0d8', 1.6, 0.9, '#cfe6f2', 0],
  [12, '#4aa6f0', '#bfe6ff', '#ffffff', 2.0, 1.0, '#cde8f7', 0],
  [16.5, '#5aa8ea', '#ffe6b0', '#fff0c8', 1.7, 0.9, '#e6e2c8', 0],
  [18, '#5a6ab8', '#ff9a6a', '#ffa070', 1.2, 0.7, '#e8a088', 0.15],
  [18.9, '#2c2f70', '#e0708a', '#d07a9a', 0.6, 0.5, '#7a5070', 0.55],
  [20, '#10163a', '#2a2a5a', '#6a7ab8', 0.3, 0.38, '#1a2045', 0.95],
  [24, '#0b1030', '#1b2350', '#6a7ab8', 0.25, 0.35, '#141a3a', 1],
];
const _c1 = new THREE.Color(), _c2 = new THREE.Color();
function lerpKey(t) {
  let i = 0; while (i < KEYS.length - 2 && t >= KEYS[i + 1][0]) i++;
  const a = KEYS[i], b = KEYS[i + 1], k = (t - a[0]) / (b[0] - a[0]);
  const col = j => _c1.set(a[j]).clone().lerp(_c2.set(b[j]), k), num = j => a[j] + (b[j] - a[j]) * k;
  return { top: col(1), hor: col(2), light: col(3), li: num(4), amb: num(5), fog: col(6), night: num(7) };
}

// ---------- 程式做的小東西 ----------
const wood = () => toon('#b07a4a'), woodD = () => toon('#8a5a32');
function box(w, h, d, mat, x, y, z, parent) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent?.add(m); return m; }

// 雙人鞦韆：A 字木架＋可以擺動的長椅
function makeSwing() {
  const g = new THREE.Group(), W = wood(), D = woodD();
  [-1, 1].forEach(s => { [-1, 1].forEach(f => { const leg = box(0.14, 3.0, 0.14, D, 1.35 * s, 1.45, 0.55 * f, g); leg.rotation.x = -0.2 * f; }); });
  box(3.0, 0.16, 0.16, D, 0, 2.92, 0, g);
  const pivot = new THREE.Group(); pivot.position.y = 2.85; g.add(pivot);
  const rope = toon('#e8dcc0');
  [-0.85, 0.85].forEach(x => [-0.18, 0.18].forEach(z => { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.2), rope); r.position.set(x, -1.1, z); pivot.add(r); }));
  const seat = new THREE.Group(); seat.position.y = -2.25; pivot.add(seat);
  box(2.0, 0.08, 0.5, W, 0, 0, 0, seat); box(2.0, 0.42, 0.06, W, 0, 0.24, -0.25, seat);
  // 鞦韆上的小花藤
  const fl = toon('#ff9ab8'), lf = toon('#6fbf4a');
  for (let i = 0; i < 14; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.07 + (i % 3) * 0.02, 6, 5), i % 3 ? fl : lf); b.position.set(-1.4 + i * 0.2, 2.98 + Math.sin(i) * 0.06, 0.1); g.add(b); }
  g.userData.pivot = pivot; g.userData.seat = seat; return g;
}
// 野餐墊＋籃子
function makePicnic() {
  const g = new THREE.Group(), c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.fillStyle = (i + j) % 2 ? '#f6f0e6' : '#e86a7a'; x.fillRect(i * 8, j * 8, 8, 8); }
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshToonMaterial({ map: t }); const mat2 = toon('#c8955a');
  const cloth = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.04, 2.2), mat); cloth.position.y = 0.02; g.add(cloth);
  const basket = new THREE.Group(); basket.position.set(0.9, 0.04, -0.6); g.add(basket);
  box(0.55, 0.3, 0.38, mat2, 0, 0.15, 0, basket);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 6, 16, Math.PI), mat2); handle.position.y = 0.3; basket.add(handle);
  // 盤子上的水果（野餐時才出現）
  const food = new THREE.Group(); food.visible = false; g.add(food); g.userData.food = food;
  const plate = (px, pz) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.03, 16), toon('#ffffff')); p.position.set(px, 0.06, pz); food.add(p); return p; };
  plate(-0.3, 0); plate(0.3, 0.1);
  [[-0.35, 0.05], [-0.25, -0.05], [-0.3, 0.08]].forEach(([a, b]) => { const s = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), toon('#e23a4a')); s.position.set(a, 0.11, b); s.scale.y = 1.2; food.add(s); });
  const wm = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 12, 1, false, 0, Math.PI), toon('#ff6a6a')); wm.rotation.x = Math.PI / 2; wm.position.set(0.3, 0.16, 0.1); food.add(wm);
  const sw = box(0.22, 0.08, 0.22, toon('#f2d79a'), 0.3, 0.11, 0.1, null); sw.rotation.y = 0.6; food.add(sw);
  return g;
}
// 菜園：三塊土
function makePlot() { const g = new THREE.Group(); box(1.5, 0.18, 1.5, toon('#8a6a48'), 0, 0.09, 0, g); box(1.3, 0.04, 1.3, toon('#5e4330'), 0, 0.19, 0, g); return g; }
// 碼頭：木板＋柱子
function makeDock() {
  const g = new THREE.Group(), W = wood(), D = woodD(), L = DOCK.x1 - DOCK.x0, w = DOCK.z1 - DOCK.z0;
  for (let i = 0; i < L / 0.42; i++) { const p = box(0.38, 0.1, w, i % 2 ? W : toon('#c08a58'), DOCK.x0 + 0.21 + i * 0.42, DOCK.y - 0.05, 0, g); }
  for (let x = DOCK.x0 + 1; x <= DOCK.x1; x += 3) [-1, 1].forEach(s => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.4, 8), D); p.position.set(x, DOCK.y - 0.9, (w / 2 + 0.05) * s); g.add(p); });
  // 盡頭的平台
  box(2.4, 0.1, 3.4, W, DOCK.x1 - 1.2, DOCK.y - 0.05, 0, g);
  return g;
}
// 屋外的燈串（夜晚發光）
function makeLights(points) {
  const g = new THREE.Group(), cols = ['#ffd27a', '#ff9ab8', '#9ad8ff', '#c8ff9a'];
  const mats = cols.map(c => new THREE.MeshBasicMaterial({ color: c }));
  const wireM = new THREE.LineBasicMaterial({ color: '#4a3a2a' });
  for (let i = 0; i < points.length - 1; i++) {
    const [a, b] = [points[i], points[i + 1]], pts = [];
    for (let k = 0; k <= 12; k++) { const t = k / 12, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t, y = a[2] + (b[2] - a[2]) * t - Math.sin(t * Math.PI) * 0.45; pts.push(new THREE.Vector3(x, y, z)); if (k % 2 === 1) { const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), mats[(i * 6 + k) % 4]); bulb.position.set(x, y - 0.08, z); g.add(bulb); } }
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireM));
  }
  g.userData.mats = mats; return g;
}

// ---------- 建立整個小島 ----------
export async function buildIsland(S) {
  const W = {};
  W.ground = makeIsland(); S.add(W.ground);
  W.water = makeWater(); S.add(W.water);
  W.sky = makeSky(); S.add(W.sky.g);
  W.hemi = new THREE.HemisphereLight('#dff2ff', '#a89a70', 1); S.add(W.hemi);
  W.sunL = new THREE.DirectionalLight('#ffffff', 1.8); W.sunL.position.set(30, 60, 20); S.add(W.sunL); S.add(W.sunL.target);
  S.fog = new THREE.Fog('#cde8f7', 90, 330);
  // 夜晚的暖光：小屋門口、營火、碼頭
  W.porchL = new THREE.PointLight('#ffb870', 0, 14, 1.6); W.porchL.position.set(0, 3, -3.6); S.add(W.porchL);
  W.fireL = new THREE.PointLight('#ff8a3a', 0, 12, 1.5); W.fireL.position.set(SPOTS.campfire.x, 1.6, SPOTS.campfire.z); S.add(W.fireL);
  W.dockL = new THREE.PointLight('#ffd27a', 0, 14, 1.6); W.dockL.position.set(DOCK.x1 - 2, 2.8, 0); S.add(W.dockL);

  // 程式做的：碼頭、鞦韆、野餐墊、菜園
  S.add(makeDock());
  W.swing = makeSwing(); W.swing.position.set(SPOTS.swing.x, standH(SPOTS.swing.x, SPOTS.swing.z), SPOTS.swing.z); S.add(W.swing);
  CIRCLES.push([SPOTS.swing.x - 1.4, SPOTS.swing.z, 0.4], [SPOTS.swing.x + 1.4, SPOTS.swing.z, 0.4]);
  W.picnic = makePicnic(); W.picnic.position.set(SPOTS.picnic.x, LAND_Y, SPOTS.picnic.z); S.add(W.picnic);
  W.plots = SPOTS.garden.plots.map(([x, z]) => { const p = makePlot(); p.position.set(x, LAND_Y, z); S.add(p); CIRCLES.push([x, z, 0.6]); return p; });
  W.lights = makeLights([[-3.9, -4.3, 3.3], [-7, 0.2, 2.6], [-9.5, 4.5, 2.4]]); S.add(W.lights);
  W.lights2 = makeLights([[3.9, -4.3, 3.3], [7.5, 1.5, 2.6], [10, 4.8, 2.2]]); S.add(W.lights2);
  [[-7, 0.2], [-9.5, 4.5], [7.5, 1.5], [10, 4.8]].forEach(([x, z]) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.6, 6), woodD()); p.position.set(x, LAND_Y + 1.2, z); S.add(p); CIRCLES.push([x, z, 0.15]); });

  // 碰撞：小屋（含前廊）、碼頭兩側是海（walkable 會擋）
  BOXES.push([-4.1, -12.2, 4.1, -4.1]);
  const r = seeded(42), near = (x, z, d) => Object.values(SPOTS).some(s => Math.hypot(s.x - x, s.z - z) < d) || (Math.abs(x) < 6 && z > -13 && z < 2) || (x > 24 && Math.abs(z) < 4);
  const ring = (n, rmin, rmax, avoid, f) => { const out = []; let k = 0; while (out.length < n && k++ < n * 40) { const a = r() * Math.PI * 2, R = shoreR(Math.cos(a), Math.sin(a)), d = R - rmin - r() * (rmax - rmin), x = Math.cos(a) * d, z = Math.sin(a) * d; if (!near(x, z, avoid) && walkable(x, z) && groundH(x, z) > 0.05) out.push(f(x, z, r())); } return out; };
  const inland = (n, avoid, f) => { const out = []; let k = 0; while (out.length < n && k++ < n * 50) { const x = (r() - 0.5) * 44, z = (r() - 0.5) * 44, R = shoreR(x, z); if (Math.hypot(x, z) < R - 12 && !near(x, z, avoid)) out.push(f(x, z, r())); } return out; };

  const jobs = [
    one(S, 'cabin', 0, -8, 0, 1, { y: LAND_Y }),
    one(S, 'mailbox', SPOTS.mailbox.x, SPOTS.mailbox.z - 0.6, Math.PI, 1, { col: 0.3 }),
    one(S, 'bike', -5.2, -3.4, 0.4, 1, { col: 0.6 }),
    one(S, 'hammock', SPOTS.hammock.x, SPOTS.hammock.z, 0, 1, { }),
    one(S, 'campfire', SPOTS.campfire.x, SPOTS.campfire.z, 0, 1, { col: 0.9 }),
    one(S, 'logBench', SPOTS.campfire.x, SPOTS.campfire.z - 1.9, 0, 1, { col: 0 }),
    one(S, 'logBench', SPOTS.campfire.x, SPOTS.campfire.z + 1.9, Math.PI, 1, { col: 0 }),
    one(S, 'tent', 15.6, 9.2, -0.7, 1, { col: 1.4 }),
    one(S, 'guitar', 12.6, 4.4, -0.3, 1, { y: LAND_Y + 0.02 }).then(o => { if (o) { o.rotation.x = -1.35; o.position.y = LAND_Y + 0.08; } }),
    one(S, 'cherry', -12.6, 10.6, 0.4, 1.1, { col: 0.4 }),
    one(S, 'cherry', -13.5, -16.5, 1.2, 1.0, { col: 0.4 }),
    one(S, 'cherry', 7, -7.5, 2.1, 0.9, { col: 0.4 }),
    one(S, 'parasol', SPOTS.sunbathe.x, SPOTS.sunbathe.z - 0.6, 0, 1, { col: 0.15 }),
    one(S, 'deckChair', SPOTS.sunbathe.x - 0.75, SPOTS.sunbathe.z + 0.4, 0, 1),
    one(S, 'deckChair', SPOTS.sunbathe.x + 0.75, SPOTS.sunbathe.z + 0.4, 0, 1),
    one(S, 'ball', SPOTS.sunbathe.x + 3.2, SPOTS.sunbathe.z + 1.2, 0, 1),
    one(S, 'bucket', SPOTS.sandcastle.x + 1.1, SPOTS.sandcastle.z + 0.6, 0.6, 1),
    one(S, 'lighthouse', HILL.x, HILL.z, 0.8, 0.62, { col: 3.0 }),
    one(S, 'logBench', SPOTS.sunset.x + 0.3, SPOTS.sunset.z, -Math.PI / 2 - 0.35, 1),
    one(S, 'rowboat', SPOTS.boat.boatX, SPOTS.boat.boatZ, Math.PI / 2, 1, { y: 0.05 }).then(o => { W.boat = o; }),
    one(S, 'dockLamp', DOCK.x0 + 3, DOCK.z0 - 0.15, 0, 1, { y: DOCK.y }),
    one(S, 'dockLamp', DOCK.x1 - 0.4, DOCK.z1 + 1.1, Math.PI, 1, { y: DOCK.y }),
    one(S, 'rod', SPOTS.fishing.x + 0.2, -1.4, Math.PI / 2, 0.8, { y: DOCK.y }),
    one(S, 'flowerBed', -3.2, -3.4, 0, 1, { col: 0.5 }), one(S, 'flowerBed', 2.0, -3.6, 0, 0.8, { col: 0.4 }),
    one(S, 'sapling', -2.6, 1.8, 0.3, 1, { col: 0.3 }),
    // 海裡的小石頭、燈塔下的岩石
    scatter(S, 'rock', [[HILL.x + 4, HILL.z - 3, 0.3, 1.6], [HILL.x - 3, HILL.z + 4.6, 1.1, 1.3], [HILL.x - 5.5, HILL.z - 1, 2, 2], [-28, 14, 0.4, 1.8], [24, -22, 1, 1.6], [30, 12, 2, 1.3]], { col: 0.5 }),
    scatter(S, 'palm', ring(16, 6.5, 8.5, 3.5, (x, z, v) => [x, z, v * 6.28, 0.8 + v * 0.4]), { col: 0.35 }),
    scatter(S, 'sapling', ring(10, 6, 9, 3, (x, z, v) => [x, z, v * 6.28, 0.8 + v * 0.5]), { col: 0.25 }),
    scatter(S, 'bush', inland(16, 3.5, (x, z, v) => [x, z, v * 6.28, 0.8 + v * 0.6]), { col: 0.6 }),
    scatter(S, 'gardenRock', inland(8, 3.5, (x, z, v) => [x, z, v * 6.28, 0.8 + v * 0.8]), { col: 0.4 }),
    scatter(S, 'wildflower', inland(70, 2.5, (x, z, v) => [x, z, v * 6.28, 1.2 + v * 0.8])),
    scatter(S, 'pebble', ring(14, 4.5, 8, 2.5, (x, z, v) => [x, z, v * 6.28, 1 + v * 1.5])),
    scatter(S, 'shells', ring(5, 5, 7.5, 3, (x, z, v) => [x, z, v * 6.28, 1])),
  ];
  // 動物：狗跟著你、貓在門廊打盹、兔子在草地、寄居蟹在沙灘、海鷗在碼頭、魚在碼頭下
  const zoo = [
    animal(S, 'dog', SPOTS.dog.x, SPOTS.dog.z, { s: 0.8, speed: 1.4 }).then(a => { W.dog = a; }),
    animal(S, 'cat', 1.6, -3.0, { s: 1.0, idleOnly: true }).then(a => { W.cat = a; if (a) a.o.rotation.y = 0.4; }),
    ...[[-6, 12], [-16, 2], [16, -2]].map(([x, z]) => animal(S, 'rabbit', x, z, { s: 0.9, roam: 4, speed: 0.6 })),
    ...ring(4, 5.5, 7, 3, (x, z) => [x, z]).map(([x, z]) => animal(S, 'crab', x, z, { s: 0.22, roam: 2.5, speed: 0.25 })),
    ...[[DOCK.x1 - 0.6, 1.0], [30, -0.8], [-14, 24]].map(([x, z]) => animal(S, 'gull', x, z, { s: 1.2, roam: 1.5, speed: 0.3 })),
    ...[[40, 4], [38, -4], [44, 2], [42, -6]].map(([x, z]) => animal(S, 'fish', x, z, { s: 0.7, roam: 4, speed: 0.8, swim: true, y: -0.5 })),
  ];
  await Promise.all([...jobs, ...zoo]);
  // 狗一開始待在家附近，main.js 會設定 follow
  return W;
}

// 每一格：時間（0–24）影響天空、光線、海、燈串
const _v = new THREE.Vector3();
export function setTimeOfDay(W, S, t, camPos) {
  const k = lerpKey(t), sky = W.sky;
  sky.mat.uniforms.uTop.value.copy(k.top); sky.mat.uniforms.uMid.value.copy(k.hor); sky.mat.uniforms.uBot.value.copy(k.hor).multiplyScalar(0.8);
  sky.mat.uniforms.uGlow.value.set(k.night > 0.6 ? '#334' : '#ffcf9a').multiplyScalar(1 - k.night * 0.7);
  // 太陽從東（+x）升起、西（-x）落下
  const a = (t - 6) / 12 * Math.PI; _v.set(Math.cos(a), Math.sin(a), -0.35).normalize();
  sky.mat.uniforms.uSun.value.copy(_v);
  sky.sun.position.copy(_v).multiplyScalar(350); sky.sun.visible = _v.y > -0.1;
  sky.moon.position.set(-_v.x * 350, -_v.y * 350, 120); sky.moon.visible = _v.y < 0.15;
  sky.stars.material.opacity = k.night * 0.95;
  sky.cm.color.set('#ffffff').lerp(_c1.set('#3a4070'), k.night).lerp(_c2.set('#ffb0a0'), (t > 17 && t < 19.5) ? 0.35 : 0);
  if (camPos) sky.g.position.set(camPos.x, 0, camPos.z);
  W.sunL.color.copy(k.light); W.sunL.intensity = k.li;
  const sp = _v.y > 0 ? _v : _v.set(-_v.x, -_v.y, _v.z);
  W.sunL.position.set(sp.x * 60, Math.max(10, sp.y * 60), 30); W.hemi.intensity = k.amb * 1.1;
  W.hemi.color.copy(k.top).lerp(_c1.set('#ffffff'), 0.6); W.hemi.groundColor.set('#a89a70').multiplyScalar(1 - k.night * 0.6);
  S.fog.color.copy(k.fog);
  W.water.material.uniforms.uDark.value = k.night * 0.85; W.water.material.uniforms.uSky.value.copy(k.hor);
  const lamp = Math.max(0, Math.min(1, (k.night - 0.15) * 2));
  W.porchL.intensity = lamp * 14; W.dockL.intensity = lamp * 10;
  [W.lights, W.lights2].forEach(l => l.userData.mats.forEach((m, i) => m.color.set(['#ffd27a', '#ff9ab8', '#9ad8ff', '#c8ff9a'][i]).multiplyScalar(0.35 + lamp * 0.9)));
  return k;
}

// ---------- 小屋室內（另一個場景） ----------
// 屋內風格：muji 無印風（淺色原木、米白、亞麻、灰米）、wood 溫潤木屋（原木牆、深木地板、暖光）
// 家具只換淺色的部分（保留明暗），原本的顏色記在 userData.base，換風格時重新上色
export const THEMES = {
  muji: { name: '無印風', bg: '#3a342e', walls: 'plaster', wall: '#f1ece3', wainscot: '#d6c3a5', floorA: '#c8ab88', floorB: '#d1b694', trim: '#b49a7a', beam: '#c4a986',
    hemi: ['#fff6ea', '#9c8f7e', 1.0], key: ['#fff0dc', 11], dl: ['#fff6ea', 0.5], lamp: ['#ffdcae', 1.6],
    linen: '#f3efe7', sofa: '#cfc7ba', rug: '#e0d6c4', cushion: '#a8a39a', blanket: '#e9e1d2', table: '#c4ab8e', wood: '#d2bea2', cream: '#f4f1ea', island: '#c9b296', pot: '#e6dfd2', dark: '#5e5a54' },
  wood: { name: '溫潤木屋', bg: '#1c130f', walls: 'log', logA: '#946746', logB: '#a2734f', floorA: '#6a4630', floorB: '#755037', trim: '#4e3322', beam: '#5e3c26',
    hemi: ['#f5d7b8', '#33221a', 0.62], key: ['#ffc48a', 11], dl: ['#ffd6a8', 0.3], lamp: ['#ffae5c', 3],
    linen: '#ece0cb', sofa: '#8aa38c', rug: '#b9694a', cushion: '#cf9c45', blanket: '#c48c7c', table: '#7c553a', wood: '#a97c55', cream: '#e4d7c2', island: '#7a978f', pot: '#b9694a', dark: '#4e3322' },
};
function paint(obj, tint, glow, full) {
  if (!obj) return; const T = new THREE.Color(tint || '#ffffff'), warm = new THREE.Color('#7a4a2a'), hsl = {};
  obj.traverse(m => {
    if (!m.isMesh) return;
    if (!m.userData.base) { m.material = m.material.clone(); m.userData.base = m.material.color.clone(); }
    const c = m.material.color; c.copy(m.userData.base); c.getHSL(hsl);
    // 顏色畫在頂點上的家具（例如電視櫃）：算出頂點顏色的平均亮度，整件提亮成指定的木色
    const vc = m.geometry.attributes.color;
    if (full && tint && vc && m.material.vertexColors) {
      if (m.userData.vAvg == null) { let sum = 0; for (let i = 0; i < vc.count; i++) sum += vc.getX(i) * 0.3 + vc.getY(i) * 0.59 + vc.getZ(i) * 0.11; m.userData.vAvg = Math.max(0.02, sum / vc.count); }
      c.copy(T).multiplyScalar(Math.min(5, 0.45 / m.userData.vAvg)); return;
    }
    if (tint && (hsl.l > 0.62 || (full && hsl.l > 0.12))) c.copy(T).multiplyScalar(full && hsl.l <= 0.62 ? 0.72 + hsl.l * 0.35 : 0.75 + hsl.l * 0.3); else c.lerp(warm, 0.1);
    if (glow && hsl.l > 0.7) { m.material.emissive = new THREE.Color('#ffc27a'); m.material.emissiveIntensity = 0.5; }
  });
}
export async function buildInterior(themeKey = 'muji') {
  const S = new THREE.Scene();
  const { w, d, h } = ROOM;
  const I = { S, themed: [] };
  const mat = role => { const m = toon('#ffffff'); I.themed.push([m, role]); return m; };
  // 地板：木地板，兩種木色交錯
  const fl = new THREE.Group(); S.add(fl);
  for (let i = 0; i < w / 0.5; i++) box(0.48, 0.1, d, mat(i % 3 === 0 ? 'floorB' : 'floorA'), -w / 2 + 0.25 + i * 0.5, -0.05, 0, fl);
  // 牆（兩種，換風格時切換）：灰泥牆＋淺木護牆板／一根根疊起來的原木
  const plaster = new THREE.Group(), logs = new THREE.Group(); S.add(plaster); S.add(logs); I.plaster = plaster; I.logs = logs;
  const wm = mat('wall'), wn = mat('wainscot');
  box(w, h, 0.2, wm, 0, h / 2, -d / 2, plaster); [-1, 1].forEach(sx => box(0.2, h, d, wm, sx * w / 2, h / 2, 0, plaster));
  box(w, 0.9, 0.24, wn, 0, 0.45, -d / 2 + 0.03, plaster); [-1, 1].forEach(sx => box(0.24, 0.9, d, wn, sx * (w / 2 - 0.03), 0.45, 0, plaster));
  const lA = mat('logA'), lB = mat('logB'), R = 0.15, n = Math.ceil(h / (R * 2));
  for (let i = 0; i < n; i++) {
    const y = R + i * R * 2, m = i % 2 ? lB : lA;
    const back = new THREE.Mesh(new THREE.CylinderGeometry(R, R, w + 0.3, 10), m); back.rotation.z = Math.PI / 2; back.position.set(0, y, -d / 2 - 0.02); logs.add(back);
    [-1, 1].forEach(sx => { const side = new THREE.Mesh(new THREE.CylinderGeometry(R, R, d + 0.3, 10), m); side.rotation.x = Math.PI / 2; side.position.set(sx * (w / 2 + 0.02), y, 0); logs.add(side); });
  }
  // 橫樑、牆角柱、踢腳板
  const beamM = mat('beam');
  box(w + 0.4, 0.22, 0.24, beamM, 0, h + 0.05, -d / 2 + 0.2, S);
  [-1, 1].forEach(sx => box(0.3, h + 0.2, 0.3, beamM, sx * (w / 2), h / 2, -d / 2, S));
  box(w, 0.16, 0.2, mat('trim'), 0, 0.08, -d / 2 + 0.16, S);
  // 窗戶
  const winMat = new THREE.MeshBasicMaterial({ color: '#9fd6ff' }), frame = mat('trim'); I.winMat = winMat;
  [-1.4, 3.0].forEach(x => { box(1.3, 1.1, 0.05, winMat, x, 1.8, -d / 2 + 0.16, S); box(1.5, 0.1, 0.16, frame, x, 1.22, -d / 2 + 0.18, S); box(1.5, 0.1, 0.12, frame, x, 2.38, -d / 2 + 0.18, S); [-0.7, 0, 0.7].forEach(dx => box(0.08, 1.2, 0.1, frame, x + dx, 1.8, -d / 2 + 0.19, S)); box(1.3, 0.06, 0.1, frame, x, 1.8, -d / 2 + 0.19, S); });
  // 燈光
  I.hemi = new THREE.HemisphereLight('#ffffff', '#888888', 1); S.add(I.hemi);
  I.key = new THREE.PointLight('#ffffff', 10, 18, 1.3); I.key.position.set(0, 2.8, 0.6); S.add(I.key);
  I.dl = new THREE.DirectionalLight('#ffffff', 0.4); I.dl.position.set(2, 6, 6); S.add(I.dl);
  I.lamps = [[-3.4, 1.1, -3.3, 4.5], [4.8, 1.7, 1.5, 4.5], [-2.8, 2.0, 2.4, 5]].map(([x, y, z, r]) => { const l = new THREE.PointLight('#ffae5c', 2, r, 2); l.position.set(x, y, z); S.add(l); return l; });
  // 家具：角色（role）決定上什麼顏色
  I.furn = [];
  const o = (k, x, z, ry = 0, s = 1, y = 0, role, glow) => one(S, k, x, z, ry, s, { y }).then(m => { if (m) I.furn.push([m, role, glow]); return m; });
  await Promise.all([
    o('bed', -3.4, -2.75, 0, 1, 0, 'linen'), o('bedside', -4.6, -3.55, 0, 1, 0, 'wood'), o('bedside', -2.2, -3.55, 0, 1, 0, 'wood'), o('tableLamp', -4.6, -3.55, 0, 1, 0.6, null, true), o('tableLamp', -2.2, -3.55, 0, 1, 0.6, null, true),
    o('rug', 1.6, -0.6, Math.PI / 2, 1, 0, 'rug'), o('sofa', 1.6, 0.9, Math.PI, 1, 0, 'sofa'), o('coffeeTable', 1.6, -0.9, 0, 1, 0, 'table'), o('media', 1.6, -3.6, 0, 1, 0, 'table'), o('tv', 1.6, -3.65, 0, 1, 0.5),
    o('cushion', 1.0, 1.0, Math.PI, 1, 0.45, 'cushion'), o('blanket', 2.3, 1.0, Math.PI, 1, 0.5, 'blanket'),
    o('fridge', 5.0, -3.45, 0, 1, 0, 'cream'), o('worktop', 4.0, -3.6, 0, 1, 0, 'wood'), o('worktop', 3.0, -3.6, 0, 1, 0, 'wood'), o('hob', 4.0, -3.6, 0, 1, 0.9), o('island', 3.9, -1.2, 0, 1, 0, 'island'),
    o('diningTable', -2.8, 2.4, 0, 1, 0, 'table'), ...[[-3.4, 1.6, 0], [-2.2, 1.6, 0], [-3.4, 3.2, Math.PI], [-2.2, 3.2, Math.PI]].map(([x, z, r]) => o('diningChair', x, z, r, 1, 0, 'wood')),
    o('bookcase', -5.15, 0.2, Math.PI / 2, 1, 0, 'table'), o('plant', -5.0, 3.4, 0, 1, 0, 'pot'), o('plant', 5.0, 3.2, 0, 1, 0, 'pot'), o('art', -0.3, -3.82, 0, 1.2, 1.4), o('wardrobe', -0.6, -3.6, 0, 1, 0, 'wood'),
    o('floorLamp', 4.9, 1.6, -Math.PI / 2, 1, 0, null, true), o('pendant', -2.8, 2.4, 0, 1, 2.4, null, true), o('pendant', 3.9, -1.2, 0, 1, 2.4, null, true),
    o('guitar', -1.5, -3.75, 0, 1, 0),
  ]);
  applyTheme(I, themeKey);
  // 室內碰撞（相對房間中心）
  I.BOXES = [[-4.4, -4, -2.4, -1.6], [0.6, 0.45, 2.6, 1.35], [0.9, -1.3, 2.3, -0.5], [3.0, -1.7, 4.9, -0.7], [-3.8, 1.3, -1.8, 3.5], [-5.4, -0.4, -4.8, 0.8], [2.6, -4, 5.5, -3.0], [-1.2, -4, 0, -3.2], [0.6, -4, 2.6, -3.2]];
  // 電視螢幕（看電影時會變色）
  I.screen = box(0.95, 0.52, 0.02, new THREE.MeshBasicMaterial({ color: '#111' }), 1.6, 0.5 + 0.42, -3.6, S);
  // 餐桌上的菜（做好飯才出現）
  I.dish = new THREE.Group(); I.dish.position.set(-2.8, 0.78, 2.4); I.dish.visible = false; S.add(I.dish);
  return I;
}
// 換屋內風格
export function applyTheme(I, key) {
  const T = THEMES[key] || THEMES.muji; I.theme = key;
  I.S.background = new THREE.Color(T.bg);
  I.themed.forEach(([m, role]) => { if (T[role]) m.color.set(T[role]); });
  I.plaster.visible = T.walls === 'plaster'; I.logs.visible = T.walls === 'log';
  I.hemi.color.set(T.hemi[0]); I.hemi.groundColor.set(T.hemi[1]); I.hemi.intensity = T.hemi[2];
  I.key.color.set(T.key[0]); I.key.intensity = T.key[1]; I.dl.color.set(T.dl[0]); I.dl.intensity = T.dl[1];
  I.lamps.forEach(l => { l.color.set(T.lamp[0]); l.intensity = T.lamp[1]; });
  // 無印風：木頭家具整件換成淺橡木
  I.furn.forEach(([m, role, glow]) => paint(m, role ? T[role] : null, glow, key === 'muji' && ['table', 'wood', 'island'].includes(role)));
}
// 碰撞檢查（圓與方）
export function blocked(x, z, r, circles, boxes) {
  for (const [cx, cz, cr] of circles) if (Math.hypot(x - cx, z - cz) < cr + r) return true;
  for (const [x0, z0, x1, z1] of boxes) if (x > x0 - r && x < x1 + r && z > z0 - r && z < z1 + r) return true;
  return false;
}
export { CIRCLES, BOXES, animals, mixers };

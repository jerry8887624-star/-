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
  sandcastle: { x: -4.8, z: 18.4 },
  beach: { x: 8.5, z: 23.5 },
  fishing: { x: 41.6, z: 0 },
  boat: { x: 33.5, z: 1.6, boatX: 35.5, boatZ: 2.4 },
  sunset: { x: -23.2, z: -9.5 },
  dog: { x: 4, z: 2 },
  coop: { x: 9, z: -2.6 },
  bike: { x: -5.2, z: -3.4 },
};
// 室內（另一個場景，原點在房間中央）
// 格局（由後往前）：左後臥室、中間客廳（電視牆）、右後廚房（流理台＋爐子＋水槽一整排）、右前餐廳、左前閱讀角、前牆中間偏右是門
export const ROOM = { w: 14, d: 10, h: 3 };
export const INSPOTS = {
  exit: { x: 0.8, z: 4.3 },
  bed: { x: -4.6, z: -2.0 },
  sofa: { x: 0, z: -0.1 },
  kitchen: { x: 4.4, z: -3.3 },
  dining: { x: 2.8, z: 1.6 },
  read: { x: -3.6, z: 1.8 },
};
// 家具位置（main.js 的活動也用）
export const FURN = {
  bed: { x: -4.6, z: -3.43, sx: 1.35, sz: 1.3 }, /* 雙人加大床：寬 2 公尺、長 2.9 公尺 */ sofa: { x: 0, z: -0.9 }, tv: { x: 0, z: -4.6 }, cook: { x: 4.5, z: -4.55 },
  table: { x: 4.3, z: 1.6 }, desk: { x: 6.52, z: -1.6, top: 0.75 }, nook: { x: -4.7, z: 2.9 }, beans: [[-5.55, 2.05, Math.PI / 2 + 0.35], [-5.55, 3.75, Math.PI / 2 - 0.35]],
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

// ---------- 岸邊浪花：浪沖上沙灘（前緣白色泡沫）→ 退回去（留下深色濕沙），兩道浪錯開 ----------
// 一條貼著地面的環狀帶子：d = 離「岸邊基準線」的距離（負的往陸地、正的往海），水線大約在 d = -0.25
function makeSurf() {
  const N = 900, D = [-3.6, -3, -2.5, -2, -1.6, -1.2, -0.85, -0.5, -0.25, 0, 0.4, 0.9, 1.5];
  const pos = [], ad = [], aa = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const a = i / N * Math.PI * 2 - Math.PI, R = 33 + 2.5 * Math.sin(3 * a) + 1.5 * Math.sin(5 * a + 1);
    for (const d of D) { const r = R - 4.6 + d, x = Math.cos(a) * r, z = Math.sin(a) * r; pos.push(x, Math.max(groundH(x, z), 0) + 0.02, z); ad.push(d); aa.push(a); }
  }
  const M = D.length; for (let i = 0; i < N; i++) for (let j = 0; j < M - 1; j++) { const a = i * M + j, b = a + M; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aD', new THREE.Float32BufferAttribute(ad, 1)); g.setAttribute('aA', new THREE.Float32BufferAttribute(aa, 1)); g.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
    uniforms: { uTime: { value: 0 }, uDark: { value: 0 } },
    vertexShader: `attribute float aD, aA; varying float vD, vS;
      void main(){ vD = aD; vS = aA * 33.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uTime, uDark; varying float vD, vS;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), u.x), mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), u.x), u.y); }
      // 沖上來快（前 40%），退回去慢
      float swash(float u){ return u < 0.4 ? sin(u / 0.4 * 1.5708) : cos((u - 0.4) / 0.6 * 1.5708); }
      void main(){
        float wl = -0.25, sheetA = 0.0, foam = 0.0, wet = 0.0;
        for (int k = 0; k < 2; k++) {
          float fk = float(k);
          float u = fract(uTime / 7.0 + noise(vec2(vS * 0.04, fk * 9.0)) * 0.5 + fk * 0.5);
          float run = (1.5 + 1.1 * noise(vec2(vS * 0.07, 3.0 + fk * 7.0))) * (k == 1 ? 0.72 : 1.0);
          float edge = wl - run * swash(u) + (noise(vec2(vS * 0.7, uTime * 0.35 + fk)) - 0.5) * 0.3;
          float lace = noise(vec2(vS * 1.7, vD * 3.2 - uTime * 0.5 + fk * 4.0));
          float sheet = smoothstep(edge - 0.04, edge + 0.22, vD);
          sheetA = max(sheetA, sheet);
          float front = smoothstep(0.5, 0.0, abs(vD - edge - 0.14)) * (u < 0.4 ? 1.0 : 1.0 - (u - 0.4) / 0.6 * 0.75);
          foam = max(foam, front * (0.6 + 0.6 * lace) + sheet * smoothstep(0.58, 0.9, lace) * 0.45 * smoothstep(wl + 1.4, wl - 0.2, vD));
          float maxEdge = wl - run;
          wet = max(wet, (1.0 - sheet) * smoothstep(maxEdge - 0.15, maxEdge + 0.35, vD) * (u > 0.4 ? 1.0 - (u - 0.4) / 0.6 : 0.35 + u));
        }
        float seaFade = 1.0 - smoothstep(wl + 0.4, 1.5, vD); // 往海裡慢慢交給原本的海水
        vec3 water = vec3(0.7, 0.96, 0.93), sand = vec3(0.42, 0.32, 0.2);
        vec3 c = mix(sand, water, sheetA); float a = max(wet * 0.32, sheetA * 0.42 * seaFade);
        c = mix(c, vec3(1.0), clamp(foam, 0.0, 1.0)); a = max(a, clamp(foam, 0.0, 1.0) * 0.92 * seaFade);
        c *= mix(1.0, 0.35, uDark);
        gl_FragColor = vec4(c, a); }`,
  });
  const m = new THREE.Mesh(g, mat); m.renderOrder = 2; return m;
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
  const cloth = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.04, 3.0), mat); /* 野餐墊加大：兩個人躺得下 */ cloth.position.y = 0.02; g.add(cloth);
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
  W.water = makeWater(); S.add(W.water); W.surf = makeSurf(); S.add(W.surf);
  W.sky = makeSky(); S.add(W.sky.g);
  W.hemi = new THREE.HemisphereLight('#dff2ff', '#a89a70', 1); S.add(W.hemi);
  W.sunL = new THREE.DirectionalLight('#ffffff', 1.8); W.sunL.position.set(30, 60, 20); S.add(W.sunL); S.add(W.sunL.target);
  /* 真實陰影：太陽的影子框跟著玩家走（main.js 每格更新位置） */
  { const sh = W.sunL.shadow; sh.mapSize.set(2048, 2048); sh.camera.left = sh.camera.bottom = -24; sh.camera.right = sh.camera.top = 24; sh.camera.near = 1; sh.camera.far = 160; sh.bias = -0.0005; sh.normalBias = 0.05; sh.radius = 3; sh.camera.updateProjectionMatrix(); }
  W.ground.receiveShadow = true;
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
    one(S, 'bike', SPOTS.bike.x, SPOTS.bike.z, 0.4, 1).then(o => { W.bike = o; }),
    one(S, 'chicken-coop-371f97', SPOTS.coop.x, SPOTS.coop.z - 0.6, -Math.PI / 2, 0.8, { col: 1.1 }),
    one(S, 'feed-sack-c84641', SPOTS.coop.x - 1.6, SPOTS.coop.z - 1.4, 0.6, 1, { col: 0.25 }),
    one(S, 'hammock', SPOTS.hammock.x, SPOTS.hammock.z, 0, 1, { }),
    one(S, 'campfire', SPOTS.campfire.x, SPOTS.campfire.z, 0, 1, { col: 0.9 }),
    one(S, 'logBench', SPOTS.campfire.x, SPOTS.campfire.z - 1.9, 0, 1, { col: 0 }),
    one(S, 'logBench', SPOTS.campfire.x, SPOTS.campfire.z + 1.9, Math.PI, 1, { col: 0 }),
    one(S, 'tent', 15.6, 9.2, -0.7, 1, { col: 1.4 }),
    one(S, 'guitar', 12.6, 4.4, -0.3, 1, { y: LAND_Y + 0.02 }).then(o => { if (o) { o.rotation.x = -1.35; o.position.y = LAND_Y + 0.08; W.guitar = o; } }),
    one(S, 'cherry', -12.6, 10.6, 0.4, 1.1, { col: 0.4 }),
    one(S, 'cherry', -13.5, -16.5, 1.2, 1.0, { col: 0.4 }),
    one(S, 'cherry', 7, -7.5, 2.1, 0.9, { col: 0.4 }),
    one(S, 'parasol', SPOTS.sunbathe.x, SPOTS.sunbathe.z - 0.6, 0, 1, { col: 0.15 }),
    one(S, 'deckChair', SPOTS.sunbathe.x - 0.75, SPOTS.sunbathe.z + 0.4, 0, 1),
    one(S, 'deckChair', SPOTS.sunbathe.x + 0.75, SPOTS.sunbathe.z + 0.4, 0, 1),
    one(S, 'ball', SPOTS.sunbathe.x + 3.2, SPOTS.sunbathe.z + 1.2, 0, 1).then(o => { if (o) W.ball = o; }), /* 海灘球可以踢 */
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
    ...[[0.8, 0.9], [-0.9, 1.1], [0.2, 1.8]].map(([dx, dz]) => animal(S, 'chicken-base', SPOTS.coop.x + dx, SPOTS.coop.z + dz, { s: 0.8, roam: 2.2, speed: 0.5 }).then(a => { if (a) (W.chickens ||= []).push(a); })),
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
  W.water.material.uniforms.uDark.value = k.night * 0.85; if (W.surf) W.surf.material.uniforms.uDark.value = k.night * 0.85; W.water.material.uniforms.uSky.value.copy(k.hor);
  const lamp = Math.max(0, Math.min(1, (k.night - 0.15) * 2));
  W.porchL.intensity = lamp * 14; W.dockL.intensity = lamp * 10;
  const hueT = performance.now() / 1000; /* W.rainbow：升級解鎖後燈串會慢慢變色 */
  [W.lights, W.lights2].forEach(l => l.userData.mats.forEach((m, i) => { if (W.rainbow) m.color.setHSL((hueT * 0.08 + i * 0.25) % 1, 0.85, 0.65); else m.color.set(['#ffd27a', '#ff9ab8', '#9ad8ff', '#c8ff9a'][i]); m.color.multiplyScalar(0.35 + lamp * 0.9); }));
  return k;
}

// ---------- 小屋室內（另一個場景） ----------
// 屋內風格：muji 無印風（淺色原木、米白、亞麻、灰米）、wood 溫潤木屋（原木牆、深木地板、暖光）
// 家具只換淺色的部分（保留明暗），原本的顏色記在 userData.base，換風格時重新上色
export const THEMES = {
  muji: { name: '無印風', bg: '#3a342e', walls: 'plaster', wall: '#f1ece3', wainscot: '#d6c3a5', floorA: '#c8ab88', floorB: '#d1b694', trim: '#b49a7a', beam: '#c4a986',
    hemi: ['#fff6ea', '#9c8f7e', 1.0], key: ['#fff0dc', 11], dl: ['#fff6ea', 0.5], lamp: ['#ffdcae', 1.6],
    linen: '#f3efe7', sofa: '#cfc7ba', rug: '#e0d6c4', cushion: '#a8a39a', blanket: '#e9e1d2', table: '#c4ab8e', wood: '#d2bea2', cream: '#f4f1ea', island: '#c9b296', pot: '#e6dfd2', dark: '#5e5a54',
    cabinet: '#e4d6c0', steel: '#c3c6c6', bean: '#c9bfae', bean2: '#a9a49b', door: '#cfb894', counter: '#efe9de' },
  wood: { name: '溫潤木屋', bg: '#1c130f', walls: 'log', logA: '#946746', logB: '#a2734f', floorA: '#6a4630', floorB: '#755037', trim: '#4e3322', beam: '#5e3c26',
    hemi: ['#f5d7b8', '#33221a', 0.62], key: ['#ffc48a', 11], dl: ['#ffd6a8', 0.3], lamp: ['#ffae5c', 3],
    linen: '#ece0cb', sofa: '#8aa38c', rug: '#b9694a', cushion: '#cf9c45', blanket: '#c48c7c', table: '#7c553a', wood: '#a97c55', cream: '#e4d7c2', island: '#7a978f', pot: '#b9694a', dark: '#4e3322',
    cabinet: '#8a603f', steel: '#b8bcbe', bean: '#c98b5a', bean2: '#8aa38c', door: '#6a4630', counter: '#d9c7a8' },
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
  const I = { S, themed: [], walls: [] };
  const mat = role => { const m = toon('#ffffff'); I.themed.push([m, role]); return m; };
  // 地板：木地板，兩種木色交錯
  const fl = new THREE.Group(); S.add(fl);
  for (let i = 0; i < w / 0.5; i++) box(0.48, 0.1, d, mat(i % 3 === 0 ? 'floorB' : 'floorA'), -w / 2 + 0.25 + i * 0.5, -0.05, 0, fl);
  // 四面牆：每面一組（本地 x 沿著牆、+z 朝屋內）；鏡頭轉到哪一邊，那一邊的牆就隱藏（360 度都看得到屋內）
  const wm = mat('wall'), wn = mat('wainscot'), lA = mat('logA'), lB = mat('logB'), beamM = mat('beam'), trimM = mat('trim'), doorM = mat('door');
  const winMat = new THREE.MeshBasicMaterial({ color: '#9fd6ff' }); I.winMat = winMat;
  I.plasters = []; I.logsets = [];
  const SIDES = [
    { k: 'back', n: [0, -1], len: w, x: 0, z: -d / 2, ry: 0, win: [-4.6, 4.5] },
    { k: 'front', n: [0, 1], len: w, x: 0, z: d / 2, ry: Math.PI, win: [4.4, -4.3], door: -0.8 },
    { k: 'left', n: [-1, 0], len: d, x: -w / 2, z: 0, ry: Math.PI / 2, win: [3.4] },
    { k: 'right', n: [1, 0], len: d, x: w / 2, z: 0, ry: -Math.PI / 2, win: [1.6] },
  ];
  for (const sd of SIDES) {
    const G = new THREE.Group(); G.position.set(sd.x, 0, sd.z); G.rotation.y = sd.ry; S.add(G); G.userData.n = sd.n; I.walls.push(G); I[sd.k + 'Wall'] = G;
    const plaster = new THREE.Group(), logs = new THREE.Group(); G.add(plaster); G.add(logs); I.plasters.push(plaster); I.logsets.push(logs);
    box(sd.len + 0.2, h, 0.2, wm, 0, h / 2, 0, plaster); box(sd.len, 0.9, 0.24, wn, 0, 0.45, 0.03, plaster);
    const R = 0.15, n = Math.ceil(h / (R * 2));
    for (let i = 0; i < n; i++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(R, R, sd.len + 0.3, 10), i % 2 ? lB : lA); m.rotation.z = Math.PI / 2; m.position.set(0, R + i * R * 2, -0.02); logs.add(m); }
    box(sd.len + 0.4, 0.22, 0.24, beamM, 0, h + 0.05, 0.2, G); box(sd.len, 0.16, 0.2, trimM, 0, 0.08, 0.16, G);
    [-1, 1].forEach(sx => box(0.3, h + 0.2, 0.3, beamM, sx * sd.len / 2, h / 2, 0, G));
    // 窗戶（木窗框、十字格）
    sd.win.forEach(x => { box(1.3, 1.1, 0.05, winMat, x, 1.8, 0.16, G); box(1.5, 0.1, 0.18, trimM, x, 1.22, 0.18, G); box(1.5, 0.1, 0.12, trimM, x, 2.38, 0.18, G); [-0.7, 0, 0.7].forEach(dx => box(0.08, 1.2, 0.1, trimM, x + dx, 1.8, 0.18, G)); box(1.3, 0.06, 0.08, trimM, x, 1.8, 0.18, G); });
    // 門：木門＋門框＋門把＋門口地墊
    if (sd.door != null) { const x = sd.door; box(1.0, 2.1, 0.08, doorM, x, 1.05, 0.15, G); box(1.2, 0.1, 0.14, trimM, x, 2.15, 0.16, G); [-1, 1].forEach(s2 => box(0.1, 2.2, 0.14, trimM, x + s2 * 0.55, 1.1, 0.16, G)); [0.55, 1.45].forEach(y => box(0.8, 0.6, 0.02, trimM, x, y, 0.2, G)); const kn = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), toon('#c9a65a')); kn.position.set(x - 0.35, 1.0, 0.24); G.add(kn); box(1.1, 0.02, 0.6, mat('rug'), x, 0.01, 0.6, G); }
  }
  // 燈光：主燈＋幾盞暖光（床頭、沙發旁、閱讀角、餐桌吊燈）
  I.hemi = new THREE.HemisphereLight('#ffffff', '#888888', 1); S.add(I.hemi);
  I.key = new THREE.PointLight('#ffffff', 10, 22, 1.3); I.key.position.set(0, 2.8, 0.4); S.add(I.key);
  I.dl = new THREE.DirectionalLight('#ffffff', 0.4); I.dl.position.set(2, 6, 6); S.add(I.dl);
  I.lamps = [[-4.6, 1.2, -4.3, 4.5], [1.5, 1.7, -0.4, 4.5], [-6.1, 1.7, 4.3, 4.5], [4.3, 2.0, 1.6, 5]].map(([x, y, z, r]) => { const l = new THREE.PointLight('#ffae5c', 2, r, 2); l.position.set(x, y, z); S.add(l); return l; });
  // 家具：角色（role）決定上什麼顏色
  I.furn = [];
  const o = (k, x, z, ry = 0, s = 1, y = 0, role, glow, parent = S) => one(parent, k, x, z, ry, s, { y }).then(m => { if (m) I.furn.push([m, role, glow]); return m; });
  const F = FURN, P = Math.PI;
  await Promise.all([
    // 臥室：床頭靠後牆、兩側床頭櫃＋檯燈，衣櫃靠左牆
    o('bed', F.bed.x, F.bed.z, 0, 1, 0, 'linen').then(m => { if (m) m.scale.set(F.bed.sx, 1, F.bed.sz); }), o('bedside', F.bed.x - 1.3, -4.6, 0, 1, 0, 'wood'), o('bedside', F.bed.x + 1.3, -4.6, 0, 1, 0, 'wood'),
    o('tableLamp', F.bed.x - 1.3, -4.6, 0, 1, 0.55, null, true), o('tableLamp', F.bed.x + 1.3, -4.6, 0, 1, 0.55, null, true),
    o('wardrobe', -6.55, -1.2, P / 2, 1, 0, 'wood'), o('plant', -6.4, -3.0, 0, 0.8, 0, 'pot'),
    // 客廳：電視櫃靠後牆、沙發面對電視，中間地毯＋茶几，沙發旁立燈
    o('rug', 0, -2.5, P / 2, 1.05, 0, 'rug'), o('media', F.tv.x, F.tv.z, 0, 1, 0, 'table'), o('tv', F.tv.x, F.tv.z - 0.05, 0, 1, 0.45),
    o('sofa', F.sofa.x, F.sofa.z, P, 1, 0, 'sofa'), o('coffeeTable', 0, -2.5, 0, 1, 0, 'table'),
    o('cushion', F.sofa.x - 0.6, F.sofa.z + 0.1, P, 1, 0.45, 'cushion'), o('blanket', F.sofa.x + 0.7, F.sofa.z + 0.1, P, 1, 0.5, 'blanket'),
    o('floorLamp', 1.5, -0.4, -P / 2, 1, 0, null, true), o('plant', -1.6, -4.5, 0, 0.9, 0, 'pot'), o('guitar', 1.5, -4.65, 0, 1, 0),
    o('art', -2.6, 0.12, 0, 1.2, 1.35, null, false, I.backWall),
    // 廚房：流理台、水槽、爐子一整排靠後牆，冰箱在角落
    ...[3.5, 4.5, 5.5].map(x => o('worktop', x, F.cook.z, 0, 1, 0, 'counter')), o('hob', 5.0, F.cook.z, 0, 1, 0.155), o('fridge', 6.45, -4.5, 0, 1, 0, 'cream'),
    // 餐廳：在廚房前面、靠近門，吊燈在桌子正上方
    o('diningTable', F.table.x, F.table.z, 0, 1, 0, 'table'),
    ...[[-0.45, -0.98, 0], [0.45, -0.98, 0], [-0.45, 0.98, P], [0.45, 0.98, P]].map(([dx, dz, r]) => o('diningChair', F.table.x + dx, F.table.z + dz, r, 1, 0, 'wood')),
    o('pendant', F.table.x, F.table.z, 0, 1, 2.4, null, true), o('plant', 6.4, 4.3, 0, 1, 0, 'pot'),
    // 閱讀角：書櫃靠左牆、地毯、兩顆懶人沙發、閱讀立燈
    o('bookcase', -6.6, 1.7, P / 2, 1, 0, 'table'), o('bookcase', -6.6, 2.75, P / 2, 1, 0, 'table'), o('rug', F.nook.x, F.nook.z, 0, 0.9, 0, 'rug'),
    o('floorLamp', -6.45, 4.5, P / 4, 1, 0, null, true), o('cushion', -3.5, 4.4, -0.6, 1, 0, 'cushion'),
    // 書桌角：靠右牆、在廚房和餐桌中間，面向房間；檯燈、一疊書、地球儀
    o('office-desk-021eb3', F.desk.x, F.desk.z, -P / 2, 1, 0, 'table'), o('dorm-desk-chair-9b4076', F.desk.x - 0.85, F.desk.z + 0.1, P / 2, 1, 0, 'wood'),
    o('tableLamp', F.desk.x + 0.12, F.desk.z - 0.5, -P / 2, 0.9, F.desk.top, null, true), o('exercise-book-stack-266d9d', F.desk.x + 0.05, F.desk.z + 0.45, 0.3, 1, F.desk.top), o('classroom-globe-16a96e', F.desk.x + 0.12, F.desk.z + 0.1, 0, 0.9, F.desk.top),
    // 更多盆栽：衣櫃和書櫃中間、電視櫃旁邊、門口、流理台、餐桌
    o('fern-plant-1559b8', -6.35, 0.25, 0.4, 0.75, 0, 'pot'), o('ti-plant-a7ad06', 2.45, -4.4, 0.6, 0.55, 0, 'pot'), o('taro-plant-8c0493', 2.4, 4.3, 2.2, 0.8, 0, 'pot'),
    o('table-herb-pot-3c0cf4', 5.85, F.cook.z, 0.4, 1, 1.0), o('basil-pot-125949', F.table.x + 0.62, F.table.z - 0.1, 0, 0.8, 0.75),
  ]);
  /* 靠牆的高家具（衣櫃、書櫃、冰箱…）跟著牆一起：牆因為擋到鏡頭被隱藏時，這些家具也一起隱藏 */
  for (const [m] of I.furn) {
    const b = new THREE.Box3().setFromObject(m); if (b.isEmpty() || b.max.y < 1.15) continue; const c = b.getCenter(new THREE.Vector3());
    for (const [k, dd] of [['left', c.x + w / 2], ['right', w / 2 - c.x], ['back', c.z + d / 2], ['front', d / 2 - c.z]]) if (dd < 1.1) (I[k + 'Wall'].userData.tall ||= []).push(m);
  }
  // 流理台下面的櫃子、水槽、水龍頭、牆上的開放層板（放罐子）
  const cab = mat('cabinet'), steel = mat('steel'), K = F.cook;
  box(3.0, 0.85, 0.56, cab, 4.5, 0.425, K.z, S); [3.0, 3.5, 4.0, 4.5, 5.0, 5.5].forEach(x => box(0.02, 0.7, 0.02, trimM, x + 0.25, 0.45, K.z + 0.29, S));
  box(0.5, 0.06, 0.36, steel, 3.6, 0.98, K.z + 0.02, S); const tap = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.018, 6, 12, Math.PI), steel); tap.position.set(3.6, 1.06, K.z - 0.18); S.add(tap);
  box(2.2, 0.05, 0.28, mat('cabinet'), 4.2, 1.9, -4.75, S);
  [[3.4, '#e9dcc6'], [3.7, '#d6c3a5'], [4.0, '#f1ece3'], [4.6, '#b8c4b0'], [4.9, '#e9dcc6']].forEach(([x, c]) => { const j = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.2, 10), toon(c)); j.position.set(x, 2.03, -4.75); S.add(j); });
  // 懶人沙發（無印良品那種軟軟的方形豆袋）
  I.beans = F.beans.map(([x, z, ry], i) => { const g = new THREE.Group(), m = mat(i ? 'bean2' : 'bean'); const b = new THREE.Mesh(new THREE.SphereGeometry(0.5, 18, 12), m); b.scale.set(1.15, 0.62, 1.15); b.position.y = 0.3; g.add(b); const t = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 10), m); t.scale.set(1.1, 0.5, 0.55); t.position.set(0, 0.5, -0.38); g.add(t); g.position.set(x, 0, z); g.rotation.y = ry; S.add(g); return g; });
  // 地上的一疊書和一杯熱可可
  [['#c97b63', 0], ['#7c9a8a', 0.05], ['#e0c27a', 0.1]].forEach(([c, y], i) => box(0.32, 0.05, 0.24, toon(c), -4.9 + i * 0.02, 0.025 + y, 4.45, S).rotation.y = i * 0.3);
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.1, 10), toon('#f4efe6')); mug.position.set(-4.5, 0.05, 4.55); S.add(mug);
  applyTheme(I, themeKey);
  // 室內碰撞（相對房間中心）
  I.BOXES = [
    [-5.62, -4.9, -3.58, -1.95], [-6.15, -4.9, -3.05, -4.3], [-6.9, -1.75, -6.25, -0.65], [-6.85, -3.4, -6.0, -2.6], // 臥室
    [-1.0, -4.9, 1.0, -4.3], [-1.0, -1.4, 1.0, -0.4], [-0.6, -2.8, 0.6, -2.2], [1.3, -0.6, 1.7, -0.2], [-1.9, -4.9, -1.3, -4.2], [1.3, -4.9, 1.7, -4.4], // 客廳
    [3.0, -4.9, 6.9, -4.2], // 廚房
    [3.3, 0.45, 5.3, 2.75], [6.0, 3.9, 6.9, 4.9], // 餐廳
    [6.15, -2.35, 6.9, -0.85], [5.4, -1.8, 5.95, -1.2], [-6.8, -0.2, -5.9, 0.7], [2.05, -4.9, 2.85, -4.0], [2.0, 3.9, 2.8, 4.7], // 書桌角、盆栽
    [-6.9, 1.1, -6.35, 3.3], [-6.15, 1.5, -4.95, 2.6], [-6.15, 3.2, -4.95, 4.3], [-6.75, 4.2, -6.15, 4.9], // 閱讀角
  ];
  // 電視螢幕（看電影時會變色）
  I.screen = box(0.95, 0.52, 0.02, new THREE.MeshBasicMaterial({ color: '#111' }), F.tv.x, 0.45 + 0.42, F.tv.z - 0.01, S);
  // 餐桌上的菜（做好飯才出現）
  I.dish = new THREE.Group(); I.dish.position.set(F.table.x, 0.76, F.table.z); I.dish.visible = false; S.add(I.dish);
  return I;
}
// 鏡頭在哪一邊，就把那一邊的牆藏起來（像娃娃屋切開一面）
export function cutaway(I, camX, camZ) {
  const L = Math.hypot(camX, camZ) || 1;
  for (const G of I.walls) { const [nx, nz] = G.userData.n; G.visible = (nx * camX + nz * camZ) / L < 0.35; }
  for (const G of I.walls) for (const t of G.userData.tall || []) t.visible = true;
  for (const G of I.walls) if (!G.visible) for (const t of G.userData.tall || []) t.visible = false;
}
// 換屋內風格
export function applyTheme(I, key) {
  const T = THEMES[key] || THEMES.muji; I.theme = key;
  I.S.background = new THREE.Color(T.bg);
  I.themed.forEach(([m, role]) => { if (T[role]) m.color.set(T[role]); });
  I.plasters.forEach(g => { g.visible = T.walls === 'plaster'; }); I.logsets.forEach(g => { g.visible = T.walls === 'log'; });
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

// 天氣與季節：跟台灣真實的季節一樣，天氣依「哪一天、幾點」決定（兩支手機算出來一樣）
import * as THREE from '../vendor/three.module.min.js';

export const SEASONS = [
  { k: 'spring', name: '春天', icon: '🌸', rain: 0.22, cloudy: 0.2, snow: 0 },
  { k: 'summer', name: '夏天', icon: '☀️', rain: 0.2, cloudy: 0.15, snow: 0 },
  { k: 'autumn', name: '秋天', icon: '🍂', rain: 0.15, cloudy: 0.3, snow: 0 },
  { k: 'winter', name: '冬天', icon: '❄️', rain: 0.08, cloudy: 0.32, snow: 0.3 },
];
export const SEASON_DAYS = 7; /* 雪人可以放幾天 */
/* 真實時間：第 1 天＝2026/1/1（台灣日期），季節跟著台灣真實的月份：3–5 月春、6–8 月夏、9–11 月秋、12–2 月冬 */
export const DAY0 = Date.UTC(2026, 0, 1);
export const dateOfDay = d => new Date(DAY0 + (d - 1) * 864e5);
export const seasonOf = day => { const m = dateOfDay(Math.max(1, day)).getUTCMonth() + 1; return SEASONS[m >= 3 && m <= 5 ? 0 : m >= 6 && m <= 8 ? 1 : m >= 9 && m <= 11 ? 2 : 3]; };
const hash = n => { n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n ^= n >>> 4; n = Math.imul(n, 0x27d4eb2d); n ^= n >>> 15; return (n >>> 0) / 4294967295; };
function kindAt(day, block) {
  const s = seasonOf(day), r = hash(hash(day * 7919 + 17) * 1e9 + block * 104729 | 0);
  if (r < s.snow) return 'snow';
  if (r < s.snow + s.rain) return 'rain';
  if (r < s.snow + s.rain + s.cloudy) return 'cloudy';
  return 'clear';
}
// 現在的天氣：每 6 小時一段
export function weatherAt(day, tod) {
  const block = Math.floor(tod / 6), kind = kindAt(day, block), s = seasonOf(day);
  const prev = block > 0 ? kindAt(day, block - 1) : kindAt(day - 1, 3);
  const rainbow = kind === 'clear' && prev === 'rain' && tod >= 7 && tod < 18 && (tod - block * 6) < 3;
  const icon = { clear: rainbow ? '🌈' : null, cloudy: '⛅', rain: '🌧️', snow: '❄️' }[kind];
  const name = { clear: rainbow ? '雨後彩虹' : '晴天', cloudy: '多雲', rain: '下雨', snow: '下雪' }[kind];
  return { kind, rainbow, season: s, icon, name };
}

// ---------- 畫面效果 ----------
export function createWeatherFX(S) {
  const g = new THREE.Group(); S.add(g);
  // 雨：一條一條往下掉的線
  const RN = 1400, rpos = new Float32Array(RN * 6), rgeo = new THREE.BufferGeometry();
  rgeo.setAttribute('position', new THREE.BufferAttribute(rpos, 3));
  const rain = new THREE.LineSegments(rgeo, new THREE.LineBasicMaterial({ color: '#cfe0f0', transparent: true, opacity: 0.55, fog: false })); rain.frustumCulled = false; g.add(rain);
  const rdat = Array.from({ length: RN }, () => [Math.random() * 44 - 22, Math.random() * 24, Math.random() * 44 - 22]);
  // 雪、花瓣、落葉、螢火蟲：小點點
  const mkDots = (n, color, size, add) => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); const m = new THREE.Points(geo, new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.9, depthWrite: false, fog: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending })); m.frustumCulled = false; g.add(m); return { m, d: Array.from({ length: n }, () => [Math.random() * 40 - 20, Math.random() * 16, Math.random() * 40 - 20, Math.random() * 6.28]) }; };
  const snow = mkDots(1200, '#ffffff', 0.16), petals = mkDots(90, '#ffb7cf', 0.14), leaves = mkDots(70, '#e8913a', 0.16), flies = mkDots(45, '#fff59a', 0.22, true);
  // 彩虹：七條半圓
  const rb = new THREE.Group(); ['#ff5a5a', '#ffa64a', '#ffe45a', '#7ad86a', '#5ab4ff', '#6a7aff', '#b47aff'].forEach((c, i) => { const m = new THREE.Mesh(new THREE.TorusGeometry(150 - i * 3.2, 1.7, 6, 64, Math.PI), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0, fog: false, depthWrite: false })); rb.add(m); });
  rb.position.set(-20, -18, 210); S.add(rb);
  const st = { rain: 0, snow: 0, cloud: 0, rainbow: 0, cover: 0 };
  return {
    st,
    // w：weatherAt 的結果；P：角色位置；night：0～1；out：在屋外
    update(dt, w, P, night, out, Wd) {
      const k = Math.min(1, dt * 0.6);
      st.rain += ((w.kind === 'rain' ? 1 : 0) - st.rain) * k;
      st.snow += ((w.kind === 'snow' ? 1 : 0) - st.snow) * k;
      st.cloud += ((w.kind === 'clear' ? 0 : 1) - st.cloud) * k;
      st.rainbow += ((w.rainbow ? 1 : 0) - st.rainbow) * Math.min(1, dt * 0.4);
      // 積雪：下雪時慢慢變白，不是冬天就慢慢融化
      st.cover = Math.max(0, Math.min(1, st.cover + dt * (w.kind === 'snow' ? 0.02 : w.season.k === 'winter' ? 0 : -0.03)));
      g.visible = out; if (!P) return;
      // 雨
      rain.visible = st.rain > 0.02; rain.material.opacity = 0.55 * st.rain;
      if (rain.visible) for (let i = 0; i < RN; i++) { const d = rdat[i]; d[1] -= dt * 22; if (d[1] < 0) { d[1] += 24; d[0] = Math.random() * 44 - 22; d[2] = Math.random() * 44 - 22; } const x = P.x + d[0], y = d[1], z = P.z + d[2]; rpos.set([x, y, z, x + 0.05, y + 0.7, z], i * 6); }
      rgeo.attributes.position.needsUpdate = true;
      const dots = (o, on, fall, sway) => { o.m.visible = on > 0.02; o.m.material.opacity = 0.9 * on; if (!o.m.visible) return; const a = o.m.geometry.attributes.position; o.d.forEach((d, i) => { d[1] -= dt * fall; d[3] += dt; if (d[1] < 0) { d[1] += 16; d[0] = Math.random() * 40 - 20; d[2] = Math.random() * 40 - 20; } a.setXYZ(i, P.x + d[0] + Math.sin(d[3]) * sway, d[1], P.z + d[2] + Math.cos(d[3] * 0.7) * sway); }); a.needsUpdate = true; };
      dots(snow, st.snow, 1.4, 0.6);
      dots(petals, w.season.k === 'spring' && w.kind !== 'rain' ? 1 : 0, 0.8, 1.2);
      dots(leaves, w.season.k === 'autumn' && w.kind !== 'rain' ? 1 : 0, 1.0, 1.4);
      // 螢火蟲：夏天晚上，在草地上飄
      flies.m.visible = w.season.k === 'summer' && night > 0.5 && w.kind !== 'rain'; if (flies.m.visible) { const a = flies.m.geometry.attributes.position; flies.d.forEach((d, i) => { d[3] += dt * 0.6; a.setXYZ(i, P.x + d[0] + Math.sin(d[3] * 1.3) * 1.2, 0.8 + (d[1] % 2.5) + Math.sin(d[3] * 2) * 0.3, P.z + d[2] + Math.cos(d[3]) * 1.2); }); a.needsUpdate = true; flies.m.material.opacity = 0.6 + Math.sin(performance.now() / 300) * 0.3; }
      // 彩虹
      rb.children.forEach(m => { m.material.opacity = 0.32 * st.rainbow * (1 - night); }); rb.visible = st.rainbow > 0.01;
      // 天色：陰天、下雨變暗變灰；地上積雪
      if (Wd) {
        const dim = 1 - st.cloud * 0.25 - st.rain * 0.25;
        Wd.sunL.intensity *= dim; Wd.hemi.intensity *= 1 - st.rain * 0.15;
        const gray = new THREE.Color('#9aa4ae'), u = Wd.sky.mat.uniforms, f = (st.cloud * 0.35 + st.rain * 0.4) * (1 - night * 0.6);
        u.uTop.value.lerp(gray, f); u.uMid.value.lerp(gray, f); u.uGlow.value.multiplyScalar(1 - f);
        S.fog.color.lerp(gray, f * 0.8); S.fog.near = 90 - st.rain * 50; S.fog.far = 330 - st.rain * 170;
        Wd.sky.cm.color.lerp(new THREE.Color('#8a929c'), st.rain * 0.7);
        Wd.ground.material.emissive.setRGB(1, 1, 1).multiplyScalar(st.cover * 0.42);
      }
    },
  };
}

// 雨傘（拿在手上）
export function umbrellaItem(color = '#ff8fab') {
  const g = new THREE.Group(); const m = new THREE.MeshToonMaterial({ color: '#6a5040' });
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.25, 6), m); stick.position.y = 0.55; g.add(stick);
  const can = new THREE.Mesh(new THREE.ConeGeometry(0.72, 0.32, 12, 1, true), new THREE.MeshToonMaterial({ color, side: THREE.DoubleSide })); can.position.y = 1.25; g.add(can);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), m); tip.position.y = 1.42; g.add(tip);
  g.userData.umbrella = true; return g;
}
// 雪人：三顆雪球＋眼睛、紅蘿蔔鼻子、圍巾
export function snowmanMesh(stage = 3) {
  const g = new THREE.Group(), wm = new THREE.MeshToonMaterial({ color: '#ffffff' }), k = new THREE.MeshToonMaterial({ color: '#2a2a2a' });
  const ball = (r, y) => { const b = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), wm); b.position.y = y; g.add(b); return b; };
  if (stage >= 1) ball(0.5, 0.45);
  if (stage >= 2) ball(0.36, 1.12);
  if (stage >= 3) {
    ball(0.26, 1.6);
    [-1, 1].forEach(s => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), k); e.position.set(0.09 * s, 1.66, 0.23); g.add(e); });
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.2, 8), new THREE.MeshToonMaterial({ color: '#ff8a2a' })); nose.rotation.x = Math.PI / 2; nose.position.set(0, 1.6, 0.33); g.add(nose);
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.06, 8, 20), new THREE.MeshToonMaterial({ color: '#e84a6a' })); scarf.rotation.x = Math.PI / 2; scarf.position.y = 1.38; g.add(scarf);
    [-1, 1].forEach(s => { const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.5, 5), new THREE.MeshToonMaterial({ color: '#6a4a32' })); arm.position.set(0.48 * s, 1.2, 0); arm.rotation.z = -1.0 * s; g.add(arm); });
  }
  return g;
}

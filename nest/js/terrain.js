// 小島的地形：純數學，不依賴 three.js（node 也能測）
// 島中心在 (0,0)，北方是 -z；海平面 y = 0；島內平地高 0.6
export const LAND_Y = 0.6;
export const DOCK = { x0: 27, x1: 43, z0: -1.1, z1: 1.1, y: 0.8 };
// 燈塔所在的小山丘
export const HILL = { x: -19, z: -19, r: 7, h: 1.8 };
// 某個方向的岸邊半徑（GLSL 裡有一份一樣的公式，改的話兩邊一起改）
export function shoreR(x, z) {
  const a = Math.atan2(z, x);
  return 33 + 2.5 * Math.sin(3 * a) + 1.5 * Math.sin(5 * a + 1);
}
const smooth = t => t * t * (3 - 2 * t);
export function groundH(x, z) {
  const r = Math.hypot(x, z), R = shoreR(x, z), inner = R - 10;
  const t = Math.min(1, Math.max(0, (r - inner) / 12));
  let h = LAND_Y * (1 - smooth(t)) - 0.9 * smooth(t);
  const d = Math.hypot(x - HILL.x, z - HILL.z);
  if (d < HILL.r * 2) h += HILL.h * Math.exp(-(d * d) / (HILL.r * HILL.r * 0.5));
  return h;
}
export function onDock(x, z) { return x >= DOCK.x0 && x <= DOCK.x1 && z >= DOCK.z0 && z <= DOCK.z1; }
// 角色站的高度（碼頭上就站在木板上）
/* 海邊瑜伽木棧平台：面向海（東南），比沙灘高，站上去就在木板上 */
const YA = Math.PI / 4, YR = 33 + 2.5 * Math.sin(3 * YA) + 1.5 * Math.sin(5 * YA + 1) - 8.2;
export const YOGA = { x: Math.cos(YA) * YR, z: Math.sin(YA) * YR, a: YA, hu: 2.2, hv: 3, y: 0.68 };
export function onYoga(x, z) { const dx = x - YOGA.x, dz = z - YOGA.z, u = dx * Math.cos(YOGA.a) + dz * Math.sin(YOGA.a), v = -dx * Math.sin(YOGA.a) + dz * Math.cos(YOGA.a); return Math.abs(u) <= YOGA.hu && Math.abs(v) <= YOGA.hv; }
export function standH(x, z) { return onDock(x, z) ? Math.max(DOCK.y, groundH(x, z)) : onYoga(x, z) ? Math.max(YOGA.y, groundH(x, z)) : groundH(x, z); }
// 可以走的地方：陸地（水深不超過 15 公分）或碼頭
export function walkable(x, z) { return onDock(x, z) || groundH(x, z) > -0.15; }
// 沙灘：島的外圈
export function sandAmt(x, z) { const r = Math.hypot(x, z), R = shoreR(x, z); return Math.min(1, Math.max(0, (r - (R - 10.5)) / 2.5)); }

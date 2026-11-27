// 島上的居民：每個人有名字、有家、有工作，照著台灣時間過日子。
// 位置全部由「今天日期＋現在幾點」算出來（同一套規則、同一張地圖），兩支手機看到的居民一定在同一個地方，
// 也不用連線同步；重新打開 App 時居民也不會突然冒出來，而是本來就在那裡。
// 回家、進燈塔都是走到門口再走進去，早上從門口走出來，不會憑空消失。
import * as THREE from '../vendor/three.module.min.js';
import { Avatar } from './char.js';
import { standH, walkable, shoreR, DOCK, HILL, YOGA } from './terrain.js';
import { umbrellaItem } from './weather.js';
import { load, cloneModel } from './models.js';
import { CIRCLES, BOXES, blocked, VILLAGE, doorOf, SPOTS, FARM, CHAPEL, BEACH } from './world.js';

const TAU = Math.PI * 2;
const SPEED = 1.7; /* 居民走路慢慢的（玩家走路 3 m/s） */
const R_NPC = 0.3;

/* ---------- 亂數：同一天、同一個人、同一段時間 → 同一串數字 ---------- */
function hash(...a) { let h = 2166136261; for (const v of a) { const s = String(v); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } h ^= 0x9e37; h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let t = seed >>> 0; return () => { t = (t + 0x6D2B79F5) >>> 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; }

/* ---------- 找路：0.5 公尺一格的 A*，石板路上比較「便宜」→ 居民會沿著小路走 ---------- */
const C = 0.5, HALF = 62, N = Math.round(HALF * 2 / C);
let okG = null, cheap = null;
const cellI = v => Math.max(0, Math.min(N - 1, Math.floor((v + HALF) / C))), cellV = i => -HALF + (i + 0.5) * C;
function standOK(x, z) { return walkable(x, z) && !blocked(x, z, R_NPC, CIRCLES, BOXES); }
function okAt(k) { if (!okG[k]) okG[k] = standOK(cellV(k % N), cellV(Math.floor(k / N))) ? 1 : 2; return okG[k] === 1; }
function markCheap(paths) {
  cheap = new Uint8Array(N * N);
  for (const p of paths || []) for (let s = 0; s < p.pts.length - 1; s++) { const [ax, az] = p.pts[s], [bx, bz] = p.pts[s + 1], L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / 0.25);
    for (let k = 0; k <= n; k++) { const x = ax + (bx - ax) * k / n, z = az + (bz - az) * k / n; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const i = cellI(x) + di, j = cellI(z) + dj; if (i >= 0 && j >= 0 && i < N && j < N) cheap[j * N + i] = 1; } } }
}
function lineOK(ax, az, bx, bz) { const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 0.25); for (let i = 1; i < n; i++) { const t = i / n; if (!standOK(ax + (bx - ax) * t, az + (bz - az) * t)) return false; } return true; }
const pathCache = new Map();
function nearestOK(x, z) { const i0 = cellI(x), j0 = cellI(z); for (let r = 0; r < 10; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue; const i = i0 + di, j = j0 + dj; if (i >= 0 && j >= 0 && i < N && j < N && okAt(j * N + i)) return j * N + i; } return -1; }
function findPath(ax, az, bx, bz) {
  const key = `${ax.toFixed(1)},${az.toFixed(1)}>${bx.toFixed(1)},${bz.toFixed(1)}`; if (pathCache.has(key)) return pathCache.get(key);
  let out;
  if (Math.hypot(bx - ax, bz - az) < 6 && lineOK(ax, az, bx, bz)) out = [[ax, az], [bx, bz]];
  else {
    const s0 = nearestOK(ax, az), g0 = nearestOK(bx, bz);
    if (s0 < 0 || g0 < 0) out = [[ax, az], [bx, bz]];
    else {
      const g = new Float32Array(N * N).fill(1e9), from = new Int32Array(N * N).fill(-1), closed = new Uint8Array(N * N), gi = g0 % N, gj = Math.floor(g0 / N);
      const heap = [], push = (k, f) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
      const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
      const h = k => Math.hypot(k % N - gi, Math.floor(k / N) - gj) * 0.6;
      g[s0] = 0; push(s0, h(s0)); let found = false, guard = 0;
      while (heap.length && guard++ < 80000) { const [, k] = pop(); if (closed[k]) continue; closed[k] = 1; if (k === g0) { found = true; break; }
        const i = k % N, j = Math.floor(k / N);
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { if (!di && !dj) continue; const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue; const nk = nj * N + ni; if (closed[nk] || !okAt(nk)) continue; if (di && dj && (!okAt(j * N + ni) || !okAt(nj * N + i))) continue;
          const w = (di && dj ? 1.414 : 1) * (cheap?.[nk] ? 0.6 : 1), ng = g[k] + w; if (ng < g[nk]) { g[nk] = ng; from[nk] = k; push(nk, ng + h(nk)); } } }
      if (!found) out = [[ax, az], [bx, bz]];
      else { const pts = []; for (let k = g0; k >= 0 && k !== s0; k = from[k]) pts.push([cellV(k % N), cellV(Math.floor(k / N))]); pts.reverse();
        /* 拉直，但不離開石板路太多：只在兩點之間都能走時才連 */
        const raw = [[ax, az], ...pts, [bx, bz]], sm = [raw[0]]; let i = 0;
        while (i < raw.length - 1) { let j = Math.min(raw.length - 1, i + 14); while (j > i + 1 && !lineOK(raw[i][0], raw[i][1], raw[j][0], raw[j][1])) j--; sm.push(raw[j]); i = j; }
        out = sm; }
    }
  }
  pathCache.set(key, out); return out;
}
const plen = pts => { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; };

/* ---------- 地點 ---------- */
/* 一個地點 = 幾個站的位置 [x, z, 面向, 姿勢, 動作, 手上拿的]；居民在這幾個位置之間慢慢換來換去 */
const face = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
function P(x, z, ry, pose = 'stand', emo = null, item = null) { return [x, z, ry, pose, emo, item]; }
function around(cx, cz, r, n, a0, pose, emo) { const o = []; for (let i = 0; i < n; i++) { const a = a0 + i / n * TAU, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; o.push(P(x, z, face(x, z, cx, cz), pose, emo)); } return o; }
function places() {
  const H = VILLAGE, d = id => doorOf(H[id], 1.0), dIn = id => doorOf(H[id], -1.2);
  const F = FARM.field, PA = FARM.pasture, T = CHAPEL.terrace, cf = SPOTS.campfire, dockZ = 0.72;
  const mai = d('mai'), mf = { x: Math.sin(H.mai.ry), z: Math.cos(H.mai.ry) };
  const fieldPts = [0.2, 0.5, 0.8].map(k => { const z = F.z0 + (F.z1 - F.z0) * k; return P(F.x0 - 0.7, z, Math.PI / 2, 'stand', 'harvest'); }).concat([0.3, 0.7].map(k => { const x = F.x0 + (F.x1 - F.x0) * k; return P(x, F.z1 + 0.7, Math.PI, 'stand', 'plant'); }));
  return {
    shopFront: [P(mai.x + mf.x * 0.6, mai.z + mf.z * 0.6 + 1.1, H.mai.ry, 'stand', 'talk'), P(mai.x + mf.x * 0.5, mai.z + mf.z * 0.5 - 0.9, H.mai.ry, 'stand', 'interact')],
    shopBuy: [P(mai.x + mf.x * 2.6, mai.z + mf.z * 2.6 + 1.6, H.mai.ry + Math.PI, 'stand', 'talk'), P(mai.x + mf.x * 2.8, mai.z + mf.z * 2.8 - 0.4, H.mai.ry + Math.PI, 'stand', 'agree'), P(mai.x + mf.x * 2.4, mai.z + mf.z * 2.4 + 3.2, H.mai.ry + Math.PI + 0.4, 'stand', 'talk')],
    dock: [P(DOCK.x0 + 6, dockZ, 0, 'stand', null, 'rod'), P(DOCK.x0 + 9.5, -dockZ, Math.PI, 'stand', null, 'rod'), P(DOCK.x0 + 4, -dockZ, Math.PI, 'stand', null, 'rod')],
    nets: (() => { const h = H.hai, c = Math.cos(h.ry), s = Math.sin(h.ry), at = (dx, dz) => [h.x + dx * c + dz * s, h.z - dx * s + dz * c]; const [x, z] = at(2.9, 2.6), [x2, z2] = at(1.6, 3.4); return [P(x, z, face(x, z, ...at(2.9, 1.2)), 'stand', 'pickup'), P(x2, z2, face(x2, z2, ...at(2.9, 1.2)), 'stand', 'fold')]; })(),
    field: fieldPts,
    pasture: [P(PA.x - PA.w / 2 - 0.9, PA.z, Math.PI / 2, 'stand', 'interact'), P(PA.x, PA.z - PA.d / 2 - 0.9, 0, 'stand', 'fold'), P(PA.x + PA.w / 2 + 0.9, PA.z + 1, -Math.PI / 2, 'stand', 'interact')],
    well: [P(FARM.well.x + 1.3, FARM.well.z, -Math.PI / 2, 'stand', 'interact'), P(FARM.well.x, FARM.well.z + 1.3, Math.PI, 'stand', 'water')],
    campfire: around(cf.x, cf.z, 3.0, 5, 0.3, 'stand', 'talk'),
    chapel: [P((T.x0 + T.x1) / 2 - 1.5, T.z1 + 1.4, Math.PI, 'stand', 'fold'), P(CHAPEL.bell.x - 1.4, CHAPEL.bell.z + 1.6, face(CHAPEL.bell.x - 1.4, CHAPEL.bell.z + 1.6, CHAPEL.bell.x, CHAPEL.bell.z), 'stand', null)],
    paintChapel: [P(T.x1 + 1.6, (T.z0 + T.z1) / 2, -Math.PI / 2, 'stand', 'interact', 'brush'), P(T.x0 - 1.6, T.z1 + 1.2, Math.PI * 0.75, 'stand', 'interact', 'brush')],
    beachWalk: [[0.75, 0.5], [0.95, 1.2], [1.25, 0.8], [2.1, 0.6], [2.35, 1.4]].map(([a, f]) => { const R = shoreR(Math.cos(a), Math.sin(a)) - 6.5 - f, x = Math.cos(a) * R, z = Math.sin(a) * R; return P(x, z, face(x, z, x * 2, z * 2), 'stand', null); }),
    paintBeach: (() => { const L = BEACH.launch; return [P(L.x - 3, L.z - 2.5, face(L.x - 3, L.z - 2.5, L.x, L.z + 8), 'stand', 'interact', 'brush')]; })(),
    sunset: [P(SPOTS.sunset.x + 1.6, SPOTS.sunset.z + 1.5, face(SPOTS.sunset.x + 1.6, SPOTS.sunset.z + 1.5, SPOTS.sunset.x - 20, SPOTS.sunset.z), 'stand', 'interact', 'brush')],
    sakura: [P(SPOTS.swing.x + 3.2, SPOTS.swing.z - 2.6, 2.4, 'stand', 'fold'), P(SPOTS.swing.x + 4.6, SPOTS.swing.z + 1.5, -2.2, 'stand', null)],
    garden: (() => { const h = H.deng, c = Math.cos(h.ry), s = Math.sin(h.ry), at = (dx, dz) => [h.x + dx * c + dz * s, h.z - dx * s + dz * c]; return [[3.6, 3.3], [-3.6, 3.0], [1.8, 4.2]].map(([a, b]) => { const [x, z] = at(a, b); return P(x, z, face(x, z, h.x, h.z) + Math.PI, 'stand', 'water'); }); })(),
    lighthouseDoor: (() => { const cx = HILL.x - 0.2, cz = HILL.z - 0.2, x = cx + 4.6, z = cz + 1.2, a = Math.atan2(z - cz, x - cx); return { door: [x, z], in: [cx + Math.cos(a) * 3.2, cz + Math.sin(a) * 3.2] }; })(), /* 燈塔的門：跟玩家爬燈塔走同一個門 */
    yoga: [P(YOGA.x - Math.cos(YOGA.a) * 4.2, YOGA.z - Math.sin(YOGA.a) * 4.2, YOGA.a + Math.PI / 2, 'stand', 'fold')],
    picnic: [P(SPOTS.picnic.x + 3.2, SPOTS.picnic.z + 1.2, -2, 'floor', 'sittalk'), P(SPOTS.picnic.x + 2.8, SPOTS.picnic.z - 2.4, -1, 'stand', null)],
    pond: [P(-6.4, 1.2, Math.PI / 2, 'stand', 'fold')],
    mailRound: [...Object.keys(VILLAGE).map(id => { const p = doorOf(VILLAGE[id], 2.2); return P(p.x, p.z, p.ry + Math.PI, 'stand', 'interact', 'letter'); }), P(SPOTS.mailbox.x + 1.1, SPOTS.mailbox.z + 0.6, face(SPOTS.mailbox.x + 1.1, SPOTS.mailbox.z + 0.6, SPOTS.mailbox.x, SPOTS.mailbox.z), 'stand', 'interact', 'letter')],
    home: id => ({ door: [d(id).x, d(id).z], in: [dIn(id).x, dIn(id).z] }),
  };
}
/* 站的位置剛好被東西擋到：往旁邊找一個站得下的地方（每支手機算出來都一樣） */
function fixPlaces(PL) { for (const v of Object.values(PL)) if (Array.isArray(v)) v.forEach(p => { if (standOK(p[0], p[1])) return; for (let r = 0.3; r < 3; r += 0.3) for (let k = 0; k < 12; k++) { const a = k / 12 * TAU, x = p[0] + Math.cos(a) * r, z = p[1] + Math.sin(a) * r; if (standOK(x, z)) { p[0] = x; p[1] = z; return; } } }); return PL; }

/* ---------- 居民 ---------- */
/* sched：[幾點, 地點, 說明]；'home' = 回家（走進門）；enter = 走進某棟建築 */
export const NPCS = [
  { id: 'hai', name: '阿海', icon: '🎣', job: '漁夫', home: 'hai', look: { gender: 'm', hair: 0, hairColor: 1, skin: 3, outfit: 14, glasses: 0, head: 0, eye: 1, mouth: 2, cheek: 0, acc: 0, hat: 2, neck: 0, ear: 0 },
    sched: [[5, 'dock', '在碼頭釣魚'], [10, 'shopBuy', '去麵包店送魚'], [11.2, 'nets', '在家門口補漁網'], [12, 'home', '回家吃午飯'], [14, 'nets', '在家門口補漁網'], [16.5, 'dock', '在碼頭等黃昏的魚'], [19, 'campfire', '在營火邊聊天'], [21, 'home', '回家睡覺了']],
    lines: { dock: ['今天的海很平，魚應該會上鉤。', '噓——魚在看餌了。', '釣魚要有耐心，跟談戀愛一樣。'], nets: ['網子破了要馬上補，不然魚會跑掉。', '海風吹久了，手會變得很粗。'], campfire: ['以前我年輕的時候，也帶女朋友來這裡看星星。', '烤魚最好吃的就是魚皮。'], shopBuy: ['小麥的麵包配我的魚湯，最對味。'], any: ['今天天氣不錯吧？', '要釣魚的話，碼頭最尾端最好釣。'] } },
  { id: 'mai', name: '小麥', icon: '🥐', job: '麵包店老闆', home: 'mai', look: { gender: 'f', hair: 3, hairColor: 3, skin: 0, outfit: 26, glasses: 0, head: 0, eye: 2, mouth: 1, cheek: 1, acc: 0, hat: 0, neck: 0, ear: 1 },
    sched: [[6, 'shopFront', '在麵包店顧店'], [13, 'home', '午休中'], [14, 'field', '去田裡看小麥'], [15.5, 'shopFront', '在麵包店顧店'], [19, 'beachWalk', '在海邊散步'], [21, 'home', '回家睡覺了']],
    lines: { shopFront: ['剛出爐的可頌，還熱熱的喔！', '今天的蜂蜜吐司賣得特別好。', '早起烤麵包，整間店都香香的。'], field: ['阿土伯種的小麥，今年長得好漂亮。'], beachWalk: ['收店之後來海邊吹吹風，最舒服了。', '你們兩個走在沙灘上，好像電影喔。'], any: ['肚子餓的話來店裡坐坐！'] } },
  { id: 'tu', name: '阿土伯', icon: '🌾', job: '農夫', home: 'tu', look: { gender: 'm', hair: 0, hairColor: 10, skin: 2, outfit: 27, glasses: 0, head: 0, eye: 3, mouth: 0, cheek: 0, acc: 0, hat: 3, neck: 0, ear: 0 },
    sched: [[5.5, 'field', '在田裡忙'], [11, 'home', '回家吃午飯'], [13, 'pasture', '去牧場餵動物'], [15.5, 'well', '在水井打水'], [16.5, 'field', '在田裡忙'], [18, 'campfire', '在營火邊休息'], [20, 'home', '回家睡覺了']],
    lines: { field: ['草莓再過幾天就可以採了。', '種田啊，就是每天看天吃飯。', '土要鬆，菜才會甜。'], pasture: ['小羊今天特別愛撒嬌。', '牛吃飽了就會趴下來曬太陽。'], well: ['這口井的水，夏天冰冰涼涼的。'], campfire: ['年輕人，要好好珍惜身邊的人啊。'], any: ['早啊！', '有空來田裡幫忙採收，分你們一些。'] } },
  { id: 'deng', name: '燈婆婆', icon: '🏮', job: '燈塔守護人', home: 'deng', look: { gender: 'f', hair: 4, hairColor: 10, skin: 1, outfit: 21, glasses: 1, head: 0, eye: 0, mouth: 1, cheek: 1, acc: 0, hat: 0, neck: 1, ear: 1 },
    sched: [[6, 'garden', '在家門口澆花'], [9, 'chapel', '去小教堂走走'], [11, 'home', '回家午睡'], [14, 'sakura', '在櫻花樹下乘涼'], [16, 'shopBuy', '去麵包店買麵包'], [17.4, 'lighthouse', '去燈塔點燈'], [23, 'home', '回家睡覺了']],
    lines: { garden: ['花跟人一樣，每天跟它說說話就會開得好。', '這些繡球花是我先生以前種的。'], chapel: ['小教堂的鐘聲，整座島都聽得到喔。', '在這裡許的願望都會實現的。'], sakura: ['櫻花開的時候，整條路都是粉紅色的。'], shopBuy: ['小麥的紅豆麵包，我每天都要買一個。'], lighthouse: ['天黑了，要幫船點燈囉。'], any: ['你們兩個感情真好，看了心裡暖暖的。', '晚上燈塔亮起來的時候，記得抬頭看看。'] } },
  { id: 'lan', name: '小藍', icon: '🎨', job: '畫家', home: 'lan', look: { gender: 'm', hair: 8, hairColor: 4, skin: 0, outfit: 19, glasses: 2, head: 0, eye: 4, mouth: 3, cheek: 0, acc: 0, hat: 5, neck: 6, ear: 0 },
    sched: [[8, 'paintChapel', '在小教堂旁畫畫'], [11, 'shopBuy', '去麵包店買午餐'], [12, 'home', '在家整理畫'], [14, 'paintBeach', '在海邊畫畫'], [16.8, 'sunset', '在畫夕陽'], [19, 'campfire', '在營火邊彈琴聊天'], [21.5, 'home', '回家睡覺了']],
    lines: { paintChapel: ['藍色的圓頂配上白牆，怎麼畫都畫不膩。', '光線一直在變，要畫快一點。'], paintBeach: ['海的顏色每個小時都不一樣。', '可以把你們兩個畫進去嗎？站在那邊就好！'], sunset: ['今天的夕陽是橘子汽水的顏色。', '最美的不是夕陽，是一起看夕陽的人。'], campfire: ['營火的光，是全世界最溫柔的顏色。'], any: ['靈感來了擋都擋不住。'] } },
  { id: 'you', name: '小郵', icon: '📮', job: '郵差', home: 'you', look: { gender: 'f', hair: 1, hairColor: 2, skin: 1, outfit: 36, glasses: 0, head: 0, eye: 1, mouth: 4, cheek: 2, acc: 0, hat: 4, neck: 0, ear: 0 },
    sched: [[7, 'shopBuy', '去麵包店吃早餐'], [8, 'mailRound', '挨家挨戶送信'], [12, 'home', '回家吃午飯'], [13, 'mailRound', '挨家挨戶送信'], [16, 'yoga', '在瑜伽教室旁伸展'], [17.5, 'picnic', '在野餐墊旁休息'], [20, 'home', '回家睡覺了']],
    lines: { mailRound: ['有你們的信喔！記得去信箱看看。', '整座島每一家我都知道住在哪。', '今天的信特別多，大家都好愛寫信。'], yoga: ['送了一整天的信，腳好痠～'], picnic: ['這裡的風最舒服了。'], shopBuy: ['早餐一定要吃小麥的可頌！'], any: ['嗨！今天也辛苦了～'] } },
];

/* ---------- 一天的行程表：從 0 點到 24 點，每一段「站著做事」或「走路」 ---------- */
/* 誰在什麼時間站在哪裡（同一天先排好的人先選，後面的人避開，不會兩個人站在同一個位置） */
const TAKEN = new Map();
function buildDay(n, day, PL) {
  if (n === NPCS[0] || !TAKEN.has(day)) { TAKEN.clear(); TAKEN.set(day, []); } const taken = TAKEN.get(day); /* 每天從第一個人開始依序排，兩支手機排出來一樣 */
  const busy = (p, a, b) => taken.some(q => q.id !== n.id && q.t0 < b && q.t1 > a && Math.hypot(q.x - p[0], q.z - p[1]) < 1.2);
  const ev = [], R0 = rng(hash(n.id, day));
  const home = PL.home(n.home);
  let pos = home.in, inside = home, t = 0;
  const walk = (pts, label) => { const L = plen(pts); if (L < 0.05) return; ev.push({ k: 'walk', t0: t, t1: t + L / SPEED, pts, L, label }); t += L / SPEED; pos = pts[pts.length - 1]; };
  const stay = (p, t1, label) => { if (t1 <= t) return; ev.push({ k: 'stay', t0: t, t1, x: p[0], z: p[1], ry: p[2], pose: p[3], emo: p[4], item: p[5], label }); t = t1; pos = [p[0], p[1]]; };
  const goIn = (bld, t1, label) => { walk([...findPath(pos[0], pos[1], bld.door[0], bld.door[1]), bld.in], label); ev.push({ k: 'in', t0: t, t1: Math.max(t, t1), x: bld.in[0], z: bld.in[1], label }); t = Math.max(t, t1); pos = bld.in; inside = bld; };
  const S = n.sched, first = S[0][0] * 3600;
  ev.push({ k: 'in', t0: 0, t1: first, x: home.in[0], z: home.in[1], label: '在家睡覺' }); t = first;
  for (let b = 0; b < S.length; b++) {
    const [h, key, label] = S[b], t1 = b + 1 < S.length ? S[b + 1][0] * 3600 : 86400, r = rng(hash(n.id, day, b));
    t = Math.max(t, h * 3600);
    const bld = key === 'home' ? home : key === 'lighthouse' ? PL.lighthouseDoor : null;
    if (inside && inside !== bld) { walk([pos, inside.door], label); inside = null; } /* 走出門 */
    if (bld) { if (inside !== bld) goIn(bld, t1, label); else { ev.push({ k: 'in', t0: t, t1, x: bld.in[0], z: bld.in[1], label }); t = t1; } continue; }
    const pts = PL[key]; if (!pts?.length) continue;
    const seq = key === 'mailRound'; let i = seq ? 0 : Math.floor(r() * pts.length), guard = 0;
    while (t < t1 - 20 && guard++ < 400) {
      const dw = seq ? 22 + r() * 18 : 28 + r() * 55; /* 不要在同一個點站太久：換位置、走動，看起來才像在生活 */
      let p = pts[i]; { const L0 = plen(findPath(pos[0], pos[1], p[0], p[1])) / SPEED; for (let k = 0; k < pts.length && busy(p, t, t + L0 + dw); k++) p = pts[(i + k + 1) % pts.length];
        if (busy(p, t, t + L0 + dw)) { const a = hash(n.id, b, guard) % 8 / 8 * TAU, q = [p[0] + Math.cos(a) * 1.1, p[1] + Math.sin(a) * 1.1]; p = standOK(q[0], q[1]) ? [q[0], q[1], p[2], p[3], p[4], p[5]] : p; } }
      walk(findPath(pos[0], pos[1], p[0], p[1]), label);
      stay(p, Math.min(t1, t + dw), label);
      if (pts.length > 1) { let j = seq ? (i + 1) % pts.length : Math.floor(r() * (pts.length - 1)); if (!seq && j >= i) j++; i = j; }
      else stay(p, Math.min(t1, t + 60), label);
    }
    if (t < t1 && ev.length && ev[ev.length - 1].k === 'stay' && !busy([ev[ev.length - 1].x, ev[ev.length - 1].z], t, t1)) ev[ev.length - 1].t1 = t = t1;
  }
  for (const e of ev) if (e.k === 'stay') taken.push({ id: n.id, t0: e.t0, t1: e.t1, x: e.x, z: e.z });
  void R0; return ev;
}
function evalAt(ev, t) {
  let lo = 0, hi = ev.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (ev[m].t0 <= t) lo = m; else hi = m - 1; }
  const e = ev[lo]; if (!e) return null;
  if (e.k === 'walk') { let d = Math.min(e.L, Math.max(0, (t - e.t0) * SPEED)); for (let i = 1; i < e.pts.length; i++) { const [ax, az] = e.pts[i - 1], [bx, bz] = e.pts[i], L = Math.hypot(bx - ax, bz - az); if (d <= L || i === e.pts.length - 1) { const k = L ? Math.min(1, d / L) : 1; return { e, x: ax + (bx - ax) * k, z: az + (bz - az) * k, ry: Math.atan2(bx - ax, bz - az), walk: true }; } d -= L; } }
  if (e.k === 'in' && t >= e.t1 && ev[lo + 1]) return evalAt(ev, ev[lo + 1].t0);
  return { e, x: e.x, z: e.z, ry: e.ry ?? 0, walk: false, inside: e.k === 'in' };
}

/* ---------- 手上的東西 ---------- */
function item(kind) {
  const g = new THREE.Group(), m = c => new THREE.MeshToonMaterial({ color: c });
  if (kind === 'rod') { const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 1.9, 5), m('#5a3a22')); rod.position.set(0, 0.55, 0.5); rod.rotation.x = 1.0; g.add(rod); const line = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 1.6, 3), m('#eeeeee')); line.position.set(0, 0.55, 1.75); g.add(line); }
  if (kind === 'brush') { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.28, 5), m('#c8a060')); b.rotation.x = 1.2; b.position.z = 0.08; g.add(b); const tip = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.06, 6), m('#3a7ad8')); tip.position.set(0, 0.05, 0.21); tip.rotation.x = 1.2 + Math.PI; g.add(tip); }
  if (kind === 'letter') { const l = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.13, 0.01), m('#fff6e4')); l.position.set(0, 0, 0.08); g.add(l); const s = new THREE.Mesh(new THREE.CircleGeometry(0.025, 10), m('#e04a5a')); s.position.set(0, 0, 0.087); g.add(s); }
  return g;
}

/* ---------- 對外：建立、每一格更新 ---------- */
const NP = []; let PL = null, ready = false;
export function npcList() { return NP; }
export function initNPCs(S, W) {
  markCheap(W.paths); okG = new Uint8Array(N * N); PL = fixPlaces(places());
  for (const d of NPCS) {
    const av = new Avatar(d.look), c = { def: d, av, sc: 'out', x: 0, z: 0, ry: 0, moving: false, day: -1, ev: null, cur: null, off: { x: 0, z: 0 }, vis: false, faceT: 0, faceRy: 0 };
    av.root.visible = false; S.add(av.root); NP.push(c);
  }
  ready = true; window.__npcDbg = { evalAt, standOK, buildDay: (d, day) => buildDay(d, day, PL), PL }; return NP;
}
/* 傳回「現在」在做什麼（對話框用） */
export function npcNow(c) { const e = c.cur?.e; if (!e) return ''; const L = e.label || ''; if (!c.cur.walk) return L; return /^在/.test(L) ? L.replace(/^在/, '正要去') : /^(去|回家)/.test(L) ? '正要' + L : '在路上'; }
export function npcKey(c) { const t = c.tNow ?? 0, s = c.def.sched; let k = 'any'; for (const [h, key] of s) if (h * 3600 <= t) k = key; return k; }
/* ---------- 站著的時候在做什麼：一直換小動作，不會像木頭人 ---------- */
const pick2 = a => a[Math.floor(Math.random() * a.length)];
const WORK = new Set(['harvest', 'plant', 'water', 'pickup', 'interact']), TALK = new Set(['talk', 'sittalk']);
function behave(c, e, dt, rain, x, z) {
  const b = c.beh; if (b && (b.t -= dt) > 0) { if (b.k === 'look') c.look += (b.to - c.look) * Math.min(1, dt * 1.5); return; }
  const em = e.emo, A = c.av, R = Math.random();
  if (e.item === 'rod') { /* 釣魚：等一等、偶爾拉一下竿、看看海 */
    if (R < 0.35) { c.beh = { k: 'work', t: 2.4 }; A.emote('pickup', 2.4); } else if (R < 0.5) { c.beh = { k: 'look', t: 3 + Math.random() * 2, to: (Math.random() - 0.5) * 1.2 }; A.emote(null, 0); } else { c.beh = { k: 'idle', t: 4 + Math.random() * 5 }; A.emote(null, 0); c.look *= 0.5; } return; }
  if (WORK.has(em) && !rain) { /* 做事：做一陣子 → 停下來伸伸懶腰、看看四周 → 再繼續 */
    if (!b || b.k !== 'work' || R < 0.25) { const k = R < 0.12 && em !== 'interact' ? 'pickup' : em; c.beh = { k: 'work', t: 5 + Math.random() * 7 }; A.emote(k, c.beh.t); c.look = 0; }
    else if (R < 0.55) { c.beh = { k: 'look', t: 2 + Math.random() * 2, to: (Math.random() - 0.5) * 1.6 }; A.emote(null, 0); }
    else { c.beh = { k: 'rest', t: 1.8 }; A.emote(pick2(['agree', 'fold']), 1.8); }
    return; }
  if (TALK.has(em) || e.pose === 'floor') { /* 聊天：面向旁邊的人，講話、笑、點頭輪流來 */
    const k = R < 0.45 ? (e.pose === 'floor' ? 'sittalk' : 'talk') : R < 0.65 ? 'laugh' : R < 0.8 ? 'agree' : null; const d = k === 'talk' || k === 'sittalk' ? 4 + Math.random() * 4 : 2 + Math.random() * 1.5;
    c.beh = { k: 'chat', t: d }; A.emote(e.pose === 'floor' && k !== 'sittalk' ? null : k, d);
    const n = NP.find(o => o !== c && o.vis && !o.moving && Math.hypot(o.x - x, o.z - z) < 4); if (n) { c.look = 0; c.faceRy = Math.atan2(n.x - x, n.z - z); c.faceT = d; }
    return; }
  /* 散步、看風景：東張西望、抱胸、伸懶腰、偶爾滑一下手機 */
  if (R < 0.45) { c.beh = { k: 'look', t: 2.5 + Math.random() * 3, to: (Math.random() - 0.5) * 2.2 }; A.emote(null, 0); }
  else if (R < 0.62 && !rain) { c.beh = { k: 'act', t: 3.5 }; A.emote('fold', 3.5); }
  else if (R < 0.74 && !rain) { c.beh = { k: 'act', t: 3 }; A.emote('phone', 3); }
  else if (R < 0.84) { c.beh = { k: 'act', t: 2 }; A.emote('agree', 2); }
  else { c.beh = { k: 'idle', t: 2 + Math.random() * 3 }; A.emote(null, 0); }
}
/* others：其他人的位置（玩家、另一半），居民會稍微讓開，不會疊在一起 */
export function tickNPCs(dt, { day, tod, cam, others, rain, show }) {
  if (!ready) return; const t = tod * 3600; let built = 0;
  for (const c of NP) {
    if (c.day !== day && built++) { c.av.root.visible = c.vis = false; continue; } /* 一格只排一個人的行程，不會卡一下 */
    if (c.day !== day) { const t0 = performance.now(); c.day = day; c.ev = buildDay(c.def, day, PL); c.lastE = null; c.buildMs = Math.round(performance.now() - t0); }
    c.tNow = t; const s = evalAt(c.ev, t); c.cur = s; if (!s) continue;
    const root = c.av.root;
    if (s.inside || !show) { root.visible = false; c.vis = false; if (c.easel) c.easel.visible = false; c.x = s.x; c.z = s.z; continue; }
    /* 讓路：附近有人（玩家或其他居民），慢慢往旁邊挪一點，走開了再回來 */
    let px = 0, pz = 0; for (const o of others) { const dx = s.x + c.off.x - o.x, dz = s.z + c.off.z - o.z, d = Math.hypot(dx, dz); if (d < 0.7 && d > 1e-3) { px += dx / d * (0.7 - d); pz += dz / d * (0.7 - d); } }
    for (const o of NP) { if (o === c || !o.vis) continue; const dx = s.x + c.off.x - o.x, dz = s.z + c.off.z - o.z, d = Math.hypot(dx, dz); if (d < 0.65 && d > 1e-3) { const k = c.def.id < o.def.id ? 1 : 0.4; px += dx / d * (0.65 - d) * k; pz += dz / d * (0.65 - d) * k; } }
    const kk = Math.min(1, dt * 5); if (px || pz) { c.off.x += px * kk; c.off.z += pz * kk; } else { c.off.x *= 1 - dt * 1.5; c.off.z *= 1 - dt * 1.5; }
    const L = Math.hypot(c.off.x, c.off.z); if (L > 0.8) { c.off.x *= 0.8 / L; c.off.z *= 0.8 / L; }
    let x = s.x + c.off.x, z = s.z + c.off.z; if (!walkable(x, z)) { x = s.x; z = s.z; c.off.x = c.off.z = 0; }
    const jump = !c.vis || Math.hypot(x - c.x, z - c.z) > 3; c.x = x; c.z = z;
    /* 遠的不畫、不算動作（省電） */
    const far = Math.hypot(cam.position.x - x, cam.position.z - z) > 75; root.visible = !far; c.vis = true; if (far) continue;
    /* 有人走近：轉過來看你、點個頭（不是在忙的時候） */
    let near = null, nd = 3.6; if (!s.walk) for (const o of others) { const d = Math.hypot(o.x - x, o.z - z); if (d < nd) { nd = d; near = o; } }
    if (near && !c.noticed && c.beh?.k !== 'work') { c.noticed = true; c.beh = { k: 'greet', t: 2.2 }; c.av.emote(pick2(['agree', 'laugh']), 2.2); c.greetAt = t; }
    if (!near && nd >= 3.6) c.noticed = false;
    let want = c.faceT > 0 ? c.faceRy : s.ry + (c.look || 0); if (c.faceT > 0) c.faceT -= dt;
    else if (near && c.beh?.k !== 'work') { const a = Math.atan2(near.x - x, near.z - z); let d = a - s.ry; d = Math.atan2(Math.sin(d), Math.cos(d)); want = s.ry + Math.max(-1.6, Math.min(1.6, d)); }
    if (jump) c.ry = want; else { let a = want - c.ry; a = Math.atan2(Math.sin(a), Math.cos(a)); c.ry += a * Math.min(1, dt * 6); }
    root.position.set(x, standH(x, z), z); root.rotation.set(0, c.ry, 0);
    if (s.e !== c.lastE) { c.lastE = s.e; const e = s.e; c.av.setPose(e.k === 'stay' ? e.pose : 'stand'); c.av.emote(null, 0); c.beh = null; c.look = 0; }
    if (s.e.k === 'stay') behave(c, s.e, dt, rain, x, z); else c.look = 0;
    /* 下雨：撐傘（釣竿照拿） */
    const e = s.e, wantI = e.k === "stay" && e.item === "rod" ? "rod" : rain ? "umb" : e.k === "stay" ? e.item || null : null;
    if (c.itemK !== wantI) { c.itemK = wantI; c.av.setItem(wantI === "umb" ? umbrellaItem() : wantI ? item(wantI) : null); c.av.holdUmbrella?.(wantI === "umb"); if (wantI === "umb") c.av.emote(null, 0); }
    /* 畫畫的時候：畫架擺在面前 */
    const paint = e.k === 'stay' && e.item === 'brush';
    if (paint && !c.easel && !c.easelLoading) { c.easelLoading = true; load('art-easel-078422').then(g => { if (g) { c.easel = cloneModel(g); c.easel.scale.setScalar(0.85); c.easel.visible = false; root.parent?.add(c.easel); } }); }
    if (c.easel) { c.easel.visible = paint; if (paint) { const ex = e.x + Math.sin(e.ry) * 0.85, ez = e.z + Math.cos(e.ry) * 0.85; c.easel.position.set(ex, standH(ex, ez), ez); c.easel.rotation.y = e.ry; } /* 畫的那一面朝著畫家 */ }
    c.moving = s.walk; c.av.update(dt, s.walk);
  }
}
/* 對話時轉過來看著你 */
export function npcFace(c, x, z, sec = 5) { c.faceRy = Math.atan2(x - c.x, z - c.z); c.faceT = sec; }

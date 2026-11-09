// 聲音：全部用 Web Audio 即時合成（不需要音檔）
let ctx = null, master = null;
function ac() {
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination); } catch (e) { return null; } }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function tone(f, t0, dur, { type = 'sine', vol = 0.2, attack = 0.005, out = master, bend = 0 } = {}) {
  const c = ctx, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0); if (bend) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * bend), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + dur + 0.05);
}
function noise(t0, dur, { vol = 0.2, freq = 1200, q = 0.8, type = 'bandpass' } = {}) {
  const c = ctx, n = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = b; f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.value = vol;
  s.connect(f); f.connect(g); g.connect(master); s.start(t0);
}
// 給環境音用：拿到同一個 AudioContext 與總音量
export function audioCtx() { return ac() ? { ctx, master } : null; }
// 錄好的音效（audio/sfx/）：Kenney、Ninja Adventure（CC0）、Moodist（CC0）；沒載到就用下面的合成音
// [檔名（多個就隨機挑一個）, 音量]；沒列在這裡的（冒愛心、完成）維持合成音
const SAMPLES = {
  shutter: [['shutter'], 0.7], click: [['click'], 0.45], coin: [['coin'], 0.5], 'door-open': [['door-open'], 0.6], 'door-close': [['door-close'], 0.55],
  wood: [['wood-0', 'wood-1', 'wood-2', 'wood-3'], 0.16], whoosh: [['whoosh'], 0.5], plop: [['plop'], 0.55], splash: [['splash'], 0.6],
  water: [['water'], 0.4], sand: [['sand-0', 'sand-1'], 0.45], sizzle: [['sizzle'], 0.45], boom: [['boom'], 0.55], book: [['book'], 0.55],
  bite: [['bite-0'], 0.6], bite2: [['bite-1'], 0.6],
  bell: [['bell'], 0.7], /* 腳踏車鈴（錄音；沒有就用下面合成的） */
};
const bufs = {}; let loading = false;
function loadSamples() {
  if (loading || !ctx) return; loading = true;
  const names = new Set(Object.values(SAMPLES).flatMap(v => v[0]));
  names.forEach(n => fetch(`audio/sfx/${n}.mp3`).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }).then(b => ctx.decodeAudioData(b)).then(d => { bufs[n] = d; }).catch(() => {})); /* 沒有這個檔案就用合成音 */
}
function playSample(name, delay = 0) {
  const S = SAMPLES[name]; if (!S) return false; const list = S[0].filter(n => bufs[n]); if (!list.length) return false;
  const src = ctx.createBufferSource(), g = ctx.createGain(); src.buffer = bufs[list[Math.floor(Math.random() * list.length)]]; g.gain.value = S[1];
  src.playbackRate.value = name === 'wood' || name === 'sand' ? 0.94 + Math.random() * 0.12 : 1; // 腳步每一步音高稍微不一樣，聽起來比較自然
  src.connect(g); g.connect(master); src.start(ctx.currentTime + delay); return true;
}
export function sfx(name) {
  if (!ac()) return; const t = ctx.currentTime; loadSamples();
  if (name === 'door') name = 'door-open';
  if (name === 'bite' && playSample('bite')) { playSample('bite2', 0.15); return; }
  if (name === 'launch') { playSample('whoosh'); return; } // 升空：輕輕一聲，真正的聲音在爆開那一下
  if (playSample(name)) return;
  switch (name) {
    case 'click': tone(880, t, 0.06, { type: 'triangle', vol: 0.06 }); break;
    case 'bell': [0, 0.16].forEach(d => [[2350, 0.07], [3170, 0.045], [4890, 0.025], [6400, 0.015]].forEach(([f, v]) => tone(f, t + d, 1.3, { type: 'sine', vol: v }))); break; /* 叮叮：金屬鈴的泛音（不是整數倍） */
    case 'pop': tone(660, t, 0.12, { vol: 0.12, bend: 1.6 }); tone(990, t + 0.06, 0.14, { vol: 0.08 }); break;
    case 'chime': [1047, 1319, 1568].forEach((f, i) => tone(f, t + i * 0.08, 0.6, { type: 'triangle', vol: 0.07 })); break;
    case 'whoosh': noise(t, 0.35, { vol: 0.25, freq: 900, q: 0.6 }); break;
    case 'splash': noise(t, 0.5, { vol: 0.35, freq: 700, q: 0.5 }); tone(320, t, 0.2, { vol: 0.08, bend: 0.5 }); break;
    case 'plop': tone(520, t, 0.15, { vol: 0.12, bend: 0.4 }); noise(t, 0.12, { vol: 0.1, freq: 1500 }); break;
    case 'bite': tone(1200, t, 0.08, { type: 'square', vol: 0.05 }); tone(1200, t + 0.12, 0.08, { type: 'square', vol: 0.05 }); break;
    case 'sand': noise(t, 0.18, { vol: 0.2, freq: 2400, q: 0.4 }); break;
    case 'water': noise(t, 0.6, { vol: 0.15, freq: 3000, q: 0.3, type: 'highpass' }); break;
    case 'door': tone(180, t, 0.18, { type: 'triangle', vol: 0.12 }); tone(140, t + 0.12, 0.2, { type: 'triangle', vol: 0.1 }); break;
    case 'launch': noise(t, 1.0, { vol: 0.08, freq: 2000, q: 2 }); tone(300, t, 1.0, { vol: 0.03, bend: 3 }); break;
    case 'boom': noise(t, 1.2, { vol: 0.45, freq: 160, q: 0.4, type: 'lowpass' }); noise(t + 0.15, 0.9, { vol: 0.08, freq: 4000, q: 0.5 }); break;
    case 'sizzle': noise(t, 2.5, { vol: 0.06, freq: 5000, q: 0.3, type: 'highpass' }); break;
    case 'shutter': noise(t, 0.08, { vol: 0.3, freq: 2500 }); noise(t + 0.09, 0.06, { vol: 0.2, freq: 1800 }); break;
  }
}

// 背景音樂：四首 mp3（audio/），自動輪播或指定一首；營火彈吉他時再疊一段合成的吉他旋律
export const TRACKS = [
  ['Island Toybox', '島嶼玩具盒', 'audio/island-toybox.mp3'],
  ['Island Drift', '小島漂流', 'audio/island-drift.mp3'],
  ['Glassy Pads', '玻璃晴空', 'audio/glassy-pads.mp3'],
  ['Cozy Puzzle', '暖暖拼圖', 'audio/cozy-puzzle.mp3'],
];
const VOL = 0.55;
const el = typeof Audio !== 'undefined' ? new Audio() : null;
if (el) { el.preload = 'none'; el.volume = 0; el.setAttribute('playsinline', ''); }
let on = false, pickI = -1, idx = 0, fadeT = null, order = [];
function fadeTo(v, ms, done) {
  if (!el) return; clearInterval(fadeT); const from = el.volume, t0 = performance.now();
  fadeT = setInterval(() => { const k = Math.min(1, (performance.now() - t0) / ms); el.volume = from + (v - from) * k; if (k >= 1) { clearInterval(fadeT); done?.(); } }, 50);
}
function nextIdx() { if (pickI >= 0) return pickI; if (!order.length) order = TRACKS.map((_, i) => i).sort(() => Math.random() - 0.5); return order.shift(); }
function load(i) { idx = i; el.src = TRACKS[i][2]; el.currentTime = 0; }
if (el) el.addEventListener('ended', () => { if (!on) return; load(nextIdx()); el.play().catch(() => {}); });
// 營火彈吉他：隨機播兩首吉他曲（背景音樂先淡出，停下來再接回去）
export const GUITAR_SONGS = [['雨後の静けさ', 'audio/guitar-ame.mp3'], ['情非得已', 'audio/guitar-qing.mp3']];
const gel = typeof Audio !== 'undefined' ? new Audio() : null;
if (gel) { gel.preload = 'none'; gel.volume = 0; gel.setAttribute('playsinline', ''); }
let gOn = false, gI = -1, gFade = null, bgWas = false;
function gFadeTo(v, ms, done) { clearInterval(gFade); const from = gel.volume, t0 = performance.now(); gFade = setInterval(() => { const k = Math.min(1, (performance.now() - t0) / ms); gel.volume = from + (v - from) * k; if (k >= 1) { clearInterval(gFade); done?.(); } }, 50); }
function gNext() { gI = gI < 0 ? Math.floor(Math.random() * GUITAR_SONGS.length) : (gI + 1) % GUITAR_SONGS.length; gel.src = GUITAR_SONGS[gI][1]; gel.currentTime = 0; gel.play().then(() => gFadeTo(0.8, 900)).catch(() => {}); }
if (gel) gel.addEventListener('ended', () => { if (gOn) gNext(); });
export const Music = {
  init() {},
  get track() { return pickI; },
  get playing() { return on ? TRACKS[idx][1] : ''; },
  play() {
    if (!el) return; on = true;
    if (!el.src) load(nextIdx());
    el.play().then(() => fadeTo(VOL, 1200)).catch(() => {});
  },
  stop() { if (!el) return; on = false; fadeTo(0, 600, () => el.pause()); },
  // i = -1 自動輪播
  // 換歌：馬上換成新的那首再淡入（以前是先淡出、淡出完才換，但緊接著的 play() 會把淡出中斷，歌就一直沒換）
  pick(i) { pickI = i; order = []; if (!el) return; const playing = on && !el.paused; clearInterval(fadeT); load(i >= 0 ? i : nextIdx()); if (playing) { el.volume = 0; el.play().then(() => fadeTo(VOL, 900)).catch(() => {}); } mediaInfo(); },
  get guitarSong() { return gOn && gI >= 0 ? GUITAR_SONGS[gI][0] : ''; },
  duet(v) {
    if (!gel || !!v === gOn) return; gOn = !!v;
    if (gOn) { bgWas = on && !el.paused; if (bgWas) fadeTo(0, 700, () => el.pause()); gI = -1; gNext(); }
    else { gFadeTo(0, 800, () => gel.pause()); if (bgWas && on) { el.play().then(() => fadeTo(VOL, 1200)).catch(() => {}); } bgWas = false; }
  },
};
// 切到背景：環境音、音效（Web Audio）暫停省電；背景音樂可以選擇繼續播（預設繼續）
let bgPlay = true;
export function setBackgroundPlay(v) { bgPlay = !!v; }
document.addEventListener('visibilitychange', () => {
  if (ctx) document.hidden ? ctx.suspend() : ctx.resume();
  const a = gel && gOn ? gel : el && on ? el : null; if (!a) return;
  if (document.hidden) { if (!bgPlay) a.pause(); } else if (a.paused) a.play().catch(() => {});
});
// 鎖定畫面／控制中心：顯示正在播的歌，可以暫停、下一首
function mediaInfo() {
  const ms = navigator.mediaSession; if (!ms || typeof MediaMetadata === 'undefined') return;
  const title = gOn && gI >= 0 ? GUITAR_SONGS[gI][0] : on ? TRACKS[idx][1] : ''; if (!title) return;
  try { ms.metadata = new MediaMetadata({ title, artist: '我們的小島', artwork: [{ src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }] }); } catch (e) {}
}
if (typeof navigator !== 'undefined' && navigator.mediaSession) {
  const ms = navigator.mediaSession, act = (k, f) => { try { ms.setActionHandler(k, f); } catch (e) {} };
  act('play', () => { (gOn ? gel : el)?.play().catch(() => {}); });
  act('pause', () => { (gOn ? gel : el)?.pause(); });
  act('nexttrack', () => { if (gOn) gNext(); else if (on) { load(nextIdx()); el.play().catch(() => {}); } mediaInfo(); });
}
if (el) el.addEventListener('play', mediaInfo); if (gel) gel.addEventListener('play', mediaInfo);

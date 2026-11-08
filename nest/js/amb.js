// 環境音：海浪、營火、風、海鷗、鳥叫、蟲鳴、青蛙、雨、雨打傘、腳步
// 音檔取自開源專案 Moodist（CC0／Pixabay Content License），剪成 20～30 秒無縫循環，放在 audio/amb/
// 每一層一個循環的聲音，依「離海多近、白天晚上、天氣、有沒有在走路」調大小聲
import { audioCtx } from './audio.js';

const NAMES = ['waves', 'campfire', 'wind', 'seagulls', 'birds', 'crickets', 'frog', 'light-rain', 'rain-on-umbrella', 'walk-on-leaves'];
const MAX = { waves: 0.55, campfire: 0.6, wind: 0.32, seagulls: 0.35, birds: 0.4, crickets: 0.35, frog: 0.25, 'light-rain': 0.6, 'rain-on-umbrella': 0.5, 'walk-on-leaves': 0.45 };
let bus = null, layers = {}, started = false, on = true;

async function loadLayer(A, n) {
  try {
    const buf = await (await fetch(`audio/amb/${n}.mp3`)).arrayBuffer();
    const data = await new Promise((res, rej) => A.ctx.decodeAudioData(buf, res, rej));
    const src = A.ctx.createBufferSource(), g = A.ctx.createGain(); src.buffer = data; src.loop = true; g.gain.value = 0;
    src.connect(g); g.connect(bus); src.start(A.ctx.currentTime + Math.random() * 0.1, Math.random() * data.duration);
    layers[n] = { src, g, v: 0 };
  } catch (e) { /* 沒有網路：沒有環境音 */ }
}
export const Amb = {
  // 第一次（使用者按了按鈕之後）才開始下載與播放
  start() {
    if (started) return; const A = audioCtx(); if (!A) return; started = true;
    bus = A.ctx.createGain(); bus.gain.value = on ? 1 : 0; bus.connect(A.master);
    NAMES.forEach((n, i) => setTimeout(() => loadLayer(A, n), i * 150));
  },
  setOn(v) { on = !!v; const A = audioCtx(); if (bus && A) bus.gain.setTargetAtTime(on ? 1 : 0, A.ctx.currentTime, 0.3); },
  // levels：{ 名稱: 0～1 }
  set(levels) {
    const A = audioCtx(); if (!A || !started) return; const t = A.ctx.currentTime;
    for (const n of NAMES) { const L = layers[n]; if (!L) continue; const v = Math.max(0, Math.min(1, levels[n] || 0)) * MAX[n]; if (Math.abs(v - L.v) < 0.005) continue; L.v = v; L.g.gain.setTargetAtTime(v, t, n === 'walk-on-leaves' ? 0.08 : 0.6); }
  },
};

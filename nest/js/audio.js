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
export function sfx(name) {
  if (!ac()) return; const t = ctx.currentTime;
  switch (name) {
    case 'click': tone(880, t, 0.06, { type: 'triangle', vol: 0.06 }); break;
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

// 背景音樂：溫柔的烏克麗麗風琶音（C–Am–F–G），營火邊彈吉他時多一層旋律
const CH = [[261.6, 329.6, 392.0], [220.0, 261.6, 329.6], [174.6, 220.0, 261.6], [196.0, 246.9, 293.7]];
const MEL = [659.3, 587.3, 523.3, 587.3, 659.3, 659.3, 659.3, 0, 587.3, 587.3, 587.3, 0, 659.3, 784, 784, 0];
let bus = null, timer = null, step = 0, next = 0, duet = false;
export const Music = {
  init() { if (!ac() || bus) return; bus = ctx.createGain(); bus.gain.value = 0; bus.connect(master); },
  play() {
    if (!ac()) return; this.init(); bus.gain.cancelScheduledValues(ctx.currentTime); bus.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 1.5);
    if (timer) return; next = ctx.currentTime + 0.1;
    timer = setInterval(() => {
      while (next < ctx.currentTime + 0.4) {
        const bar = Math.floor(step / 8) % 4, ch = CH[bar], i = step % 8, beat = 0.32;
        const f = [ch[0], ch[1], ch[2], ch[1] * 2, ch[2], ch[1], ch[0] * 2, ch[2]][i];
        tone(f, next, 0.9, { type: 'triangle', vol: 0.05, out: bus });
        if (i === 0) tone(ch[0] / 2, next, 2.4, { vol: 0.06, out: bus, attack: 0.05 });
        if (duet) { const m = MEL[step % 16]; if (m) tone(m, next, 0.5, { type: 'sine', vol: 0.05, out: bus }); }
        next += beat; step++;
      }
    }, 100);
  },
  stop() { if (!bus) return; bus.gain.cancelScheduledValues(ctx.currentTime); bus.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6); setTimeout(() => { if (timer) { clearInterval(timer); timer = null; } }, 700); },
  duet(on) { duet = !!on; },
};
document.addEventListener('visibilitychange', () => { if (!ctx) return; document.hidden ? ctx.suspend() : ctx.resume(); });

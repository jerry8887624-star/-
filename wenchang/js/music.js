// 背景音樂：取用「靈犀」的寺院系配樂。用原生 <audio> 播放（不經 Web Audio，避免畫面捲動時變調、爆音）
const TRACKS = [
  { k: 'ritual', zh: '儀式靜心', src: 'audio/ritual-pause.mp3', d: '沉穩莊嚴，適合拜拜、擲筊、求籤', mood: 'day' },
  { k: 'still', zh: '缽音入定', src: 'audio/resonant-stillness.mp3', d: '低沉缽音、留白多，適合跪拜靜心', mood: 'day' },
  { k: 'dawn', zh: '晨鐘回響', src: 'audio/resonant-dawn.mp3', d: '多一點流動與明亮，像清晨的廟宇', mood: 'day' },
  { k: 'night', zh: '靜夜安神', src: 'audio/nocturnal-calm.mp3', d: '深夜般的安定氛圍，適合夜晚參拜', mood: 'night' },
];
export const MUSIC_TRACKS = TRACKS;

const get = (k, d) => { try { const v = localStorage.getItem('wc.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
const set = (k, v) => { try { localStorage.setItem('wc.' + k, JSON.stringify(v)); } catch (e) {} };

export const music = {
  el: null,
  on: get('musicOn', true),
  pick: get('music', 'auto'),   // 'auto'＝依白天／夜晚輪播；或固定某一首的 k
  night: false,
  cur: null,
  muted: false,                 // 右上角喇叭關掉時一起靜音
  listeners: [],
  onChange(fn) { this.listeners.push(fn); },
  emit() { this.listeners.forEach(f => f(this)); },
  ensure() {
    if (this.el) return this.el;
    const a = new Audio(); a.preload = 'none'; a.volume = 0.55; a.setAttribute('playsinline', '');
    a.addEventListener('ended', () => this.next());
    a.addEventListener('error', () => { if (this.on) setTimeout(() => this.next(), 1500); });
    this.el = a; return a;
  },
  // 依目前設定挑下一首
  choose() {
    if (this.pick !== 'auto') return TRACKS.find(t => t.k === this.pick) || TRACKS[0];
    const pool = TRACKS.filter(t => t.mood === (this.night ? 'night' : 'day'));
    const others = pool.filter(t => t !== this.cur);
    const list = others.length ? others : pool;
    return list[Math.floor(Math.random() * list.length)];
  },
  load(t) { const a = this.ensure(); this.cur = t; a.src = t.src; a.loop = this.pick !== 'auto'; this.emit(); },
  play() {
    if (this.focusing || !this.on || this.muted) return;
    const a = this.ensure();
    if (!this.cur || (this.pick !== 'auto' && this.cur.k !== this.pick)) this.load(this.choose());
    a.play().catch(() => {});
    this.emit();
  },
  pause() { this.el?.pause(); this.emit(); },
  next() { if (!this.on || this.focusing) return; this.load(this.choose()); this.play(); },
  // 從「進入廟宇」等使用者點擊時呼叫（手機要使用者先點過才能播放聲音）
  start() { this.ensure(); this.play(); },
  setOn(on) { this.on = on; set('musicOn', on); on ? this.play() : this.pause(); },
  setPick(k) { this.pick = k; set('music', k); this.load(this.choose()); this.on = true; set('musicOn', true); this.play(); },
  setMuted(m) { this.muted = m; if (this.focusing) { if (m) this.el?.pause(); else if (this.focusSrc) this.el.play().catch(() => {}); return; } m ? this.pause() : this.play(); },
  // 讀書角專注聲音：跟背景音樂用同一個播放器（iPhone 上這個播放器已經被點過、確定能出聲），結束再換回背景音樂
  focusOn(src, vol = 0.8) {
    const a = this.ensure();
    if (!this.focusing) { this.wasPlaying = this.playing; this.focusing = true; }
    this.focusSrc = src;
    if (!src) { a.pause(); this.emit(); return; }
    a.loop = true; a.volume = vol;
    if (!a.src.endsWith(src)) a.src = src;
    if (!this.muted) a.play().catch(() => {});
    this.emit();
  },
  focusOff() {
    if (!this.focusing) return;
    this.focusing = false; this.focusSrc = null;
    const a = this.el; a.pause(); a.volume = 0.55; this.cur = null;
    if (this.wasPlaying) this.play();
    this.emit();
  },
  // 白天／夜晚切換：自動模式下換成適合的曲子
  setNight(n) {
    if (this.night === n) return; this.night = n;
    if (!this.focusing && this.pick === 'auto' && this.cur && this.el && !this.el.paused) { this.load(this.choose()); this.play(); }
  },
  get playing() { return !!this.el && !this.el.paused; },
};

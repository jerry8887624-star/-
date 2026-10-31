import * as THREE from '../vendor/three.module.min.js';
import { L, Temple, SPOTS, MARKS, FOCUS, CUSHIONS, TIANGONG_SLOTS, TIANGONG_SEAT0, MAIN_CUSHIONS, DESKS, DESK_SEAT0 } from './scene.js';
import { Avatar, randomLook, HAIRS, HAIR_COLORS, SKINS, OUTFITS, GLASSES, ACCS, HEADS, EYES, MOUTHS, CHEEKS } from './avatar.js';
import { STEPS, EXTRAS, OFFERINGS, TABOO, EXAMS, CARD_COLORS, CHEERS, EMOTES, CHAT_PHRASES, RANK_TIP, RITUAL_NOTE, FACTS, SOURCES, JINZHI, TASK_POOL, DAILY_COUNT, WEEK_GOAL, TITLES, FXS, REWARDS, FOCUS_MIN, FOCUS_SOUNDS, FOCUS_CHEERS, FEAST_DATES, FEAST_DAYS_BEFORE } from './data.js';
import { Net } from './net.js';
import { Outside, PLOTS, OUT_SPOTS, OUT_MARKS, TREASURE_KINDS, TREASURE_SPOTS, BOSS_AT, KOI } from './outside.js';
import { checkChat, CHAT_WHY, checkName, NAME_WHY } from './chatfilter.js';
import { WS_URL } from './config.js';
import { initUpdates, showNewsOnce } from './update.js';
import { music, MUSIC_TRACKS } from './music.js';

const $ = s => document.querySelector(s);
const store = {
  get(k, d) { try { const v = localStorage.getItem('wc.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('wc.' + k, JSON.stringify(v)); } catch (e) {} },
};
const sess = {
  get(k, d) { try { const v = sessionStorage.getItem('wc.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { sessionStorage.setItem('wc.' + k, JSON.stringify(v)); } catch (e) {} },
};
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- 場景 ----------
const temple = new Temple($('#stage'));
Object.assign(SPOTS, OUT_SPOTS); MARKS.push(...OUT_MARKS); // 廟門外樹林的站位與名牌
let look = store.get('look', null) || randomLook();
const me = temple.addAvatar(new Avatar(look));
temple.setPlayer(me);
me.speed = 4.8;
// 開場：角色站在中庭，鏡頭在前方，背後是正殿
const SPLASH = { x: -4.4 + Math.random() * 1.6, z: 1.8 + Math.random() * 1.4, f: 0.3 }; // 每個人出生點略有不同，才不會疊在一起
me.root.position.set(SPLASH.x, 0, SPLASH.z); me.root.rotation.y = SPLASH.f;
temple.camYaw = temple.camYawTarget = SPLASH.f; temple.camDist = 5.6; temple.camPitch = 0.14;
temple.focus = new THREE.Vector3(SPLASH.x, 0.75, SPLASH.z);
let night = store.get('night', false);
if (night) { document.body.classList.add('night'); temple.setNight(true); }

// ---------- 狀態 ----------
const state = {
  done: new Set(sess.get('done', [])),
  carry: sess.get('carry', { incense: false, offerings: [], ticket: false }),
  busy: false,
};
const save = () => { sess.set('done', [...state.done]); sess.set('carry', state.carry); };
if (state.carry.incense) { me.hold(true); me.setSticks(state.carry.sticks ?? 3); }
if (state.done.has('wenchang')) temple.setOfferings(OFFERINGS.filter(o => state.carry.offerings.includes(o.id)), state.carry.ticket);
const myCard = store.get('card', null);
const cardLabel = c => (c.x >= 0 ? EXAMS[c.x] : '祈福').replace('期中期末考', '期中期末').replace('分科測驗', '分科');
temple.setSharedCards([], CARD_COLORS.map(c => c.hex), cardLabel);
if (myCard) temple.hangMyCard(myCard);
const current = () => STEPS.find(s => !state.done.has(s.id));

// ---------- 聲音（Web Audio 即時合成，不需音檔） ----------
const sound = {
  on: store.get('sound', true), ctx: null,
  init() {
    if (this.ctx) return; try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    const c = this.ctx, len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    let last = 0; for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3; }
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
    this.amb = c.createGain(); this.amb.gain.value = this.on ? 0.05 : 0;
    src.connect(lp).connect(this.amb).connect(c.destination); src.start();
    this.master = c.createGain(); this.master.gain.value = this.on ? 1 : 0; this.master.connect(c.destination);
    setInterval(() => { if (this.on && Math.random() < 0.35) this.bell(0.05); }, 14000);
    this.loadSamples();
  },
  // 真實錄音音效（取自「靈犀」audio/sfx，Freesound CC0 錄音剪輯，來源見 audio/sfx/make_sfx.py）；載入前或失敗時用合成音
  samples: {},
  loadSamples() {
    const files = { bell: ['bell'], clack: ['clack0', 'clack1'], shake: ['shake'], stick: ['stick'], ting: ['ting'], unroll: ['unroll'], moku: ['moku'] };
    Object.entries(files).forEach(([k, list]) => { this.samples[k] = []; list.forEach(n => fetch(`audio/sfx/${n}.mp3`).then(r => { if (!r.ok) throw 0; return r.arrayBuffer(); })
      .then(b => new Promise((ok, no) => this.ctx.decodeAudioData(b, ok, no))).then(ab => this.samples[k].push(ab)).catch(() => {})); });
  },
  sample(k, gain = 1, delay = 0) {
    const c = this.ctx, L = this.samples[k]; if (!c || !this.on || !L || !L.length) return false;
    const s = c.createBufferSource(); s.buffer = L[Math.floor(Math.random() * L.length)]; s.playbackRate.value = 1 + (Math.random() - 0.5) * 0.06;
    const g = c.createGain(); g.gain.value = gain; s.connect(g).connect(this.master); s.start(c.currentTime + delay); return true;
  },
  toggle() { this.on = !this.on; store.set('sound', this.on); if (this.ctx) { this.amb.gain.value = this.on ? 0.05 : 0; this.master.gain.value = this.on ? 1 : 0; } music.setMuted(!this.on); },
  bell(vol = 0.18) { // 磬
    if (this.sample('bell', Math.min(1, vol * 4.5))) return;
    const c = this.ctx; if (!c || !this.on) return; const t = c.currentTime;
    [[620, 1], [1240, 0.5], [1860, 0.25], [2790, 0.12]].forEach(([f, a]) => {
      const o = c.createOscillator(), g = c.createGain(); o.frequency.value = f; o.type = 'sine';
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * a, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
      o.connect(g).connect(this.master); o.start(t); o.stop(t + 3.3);
    });
  },
  clack(n = 2) {
    if (this.samples.clack?.length) { for (let k = 0; k < n; k++) this.sample('clack', 0.9, k * 0.09); return; }
    const c = this.ctx; if (!c || !this.on) return;
    for (let k = 0; k < n; k++) {
      const t = c.currentTime + k * 0.09, len = 0.06 * c.sampleRate, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      const s = c.createBufferSource(); s.buffer = b; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900 + k * 300; bp.Q.value = 4;
      const g = c.createGain(); g.gain.value = 0.7; s.connect(bp).connect(g).connect(this.master); s.start(t);
    }
  },
  fire() { // 金紙入爐：一陣火焰呼呼聲
    const c = this.ctx; if (!c || !this.on) return; const t = c.currentTime, len = c.sampleRate * 1.2, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(Math.sin(Math.PI * i / len), 1.5);
    const s = c.createBufferSource(); s.buffer = b; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const g = c.createGain(); g.gain.value = 0.35; s.connect(lp).connect(g).connect(this.master); s.start(t);
  },
  chime() {
    if (this.sample('ting', 0.7)) return;
    const c = this.ctx; if (!c || !this.on) return; const t = c.currentTime;
    [784, 988, 1175, 1568].forEach((f, i) => { const o = c.createOscillator(), g = c.createGain(); o.frequency.value = f; g.gain.setValueAtTime(0, t + i * 0.09); g.gain.linearRampToValueAtTime(0.08, t + i * 0.09 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 1.2); o.connect(g).connect(this.master); o.start(t + i * 0.09); o.stop(t + i * 0.09 + 1.3); });
  },
};
const buzz = ms => { try { navigator.vibrate?.(ms); } catch (e) {} };

// ---------- 開場：選外觀 ----------
const parts = [
  ['head', '頭型', HEADS.length, v => HEADS[v]],
  ['eye', '眼睛', EYES.length, v => EYES[v]],
  ['mouth', '嘴巴', MOUTHS.length, v => MOUTHS[v]],
  ['cheek', '臉頰', CHEEKS.length, v => CHEEKS[v]],
  ['hair', '髮型', HAIRS.length, v => HAIRS[v]],
  ['hairColor', '髮色', HAIR_COLORS.length, v => `<i class="sw" style="background:${HAIR_COLORS[v]}"></i>`],
  ['skin', '膚色', SKINS.length, v => `<i class="sw" style="background:${SKINS[v]}"></i>`],
  ['outfit', '服裝', OUTFITS.length, v => OUTFITS[v].name],
  ['glasses', '眼鏡', GLASSES.length, v => GLASSES[v]],
];
function renderPicker() {
  document.querySelectorAll('[data-gender]').forEach(b => b.setAttribute('aria-pressed', b.dataset.gender === look.gender));
  $('#customize').innerHTML = parts.map(([k, name, n, fmt]) =>
    `<div class="crow" data-part="${k}"><span>${k === 'hairColor' && (look.head | 0) ? '毛色' : name}</span><button type="button" data-d="-1" aria-label="上一個${name}">◀</button><b>${fmt((look[k] | 0) % n)}</b><button type="button" data-d="1" aria-label="下一個${name}">▶</button></div>`).join('');
}
function setLook(l) { look = l; store.set('look', l); me.setLook(l); me.hold(state.carry.incense); net.setLook(l); renderPicker(); }
const keepRewards = l => ({ ...l, acc: look.acc | 0, ttl: look.ttl | 0, fx: look.fx | 0, head: look.head | 0 });
document.querySelectorAll('[data-gender]').forEach(b => b.onclick = () => setLook(keepRewards(randomLook(b.dataset.gender))));
$('#pick-shuffle').onclick = () => setLook(keepRewards(randomLook(look.gender)));
// 換頭型：人類 → 小熊 → 小貓 → 小兔 → 小狗 → 熊貓 → 外星人
$('#pick-head').onclick = () => { const v = ((look.head | 0) + 1) % HEADS.length; setLook({ ...look, head: v }); toast(`頭型：${HEADS[v]}`, 1400); };
$('#pick-custom').onclick = e => { const open = $('#customize').hidden; $('#customize').hidden = !open; e.currentTarget.setAttribute('aria-expanded', open); };
$('#customize').onclick = e => {
  const b = e.target.closest('button'); if (!b) return; const row = b.closest('.crow'), k = row.dataset.part, n = parts.find(p => p[0] === k)[2];
  let v = look[k] | 0;
  do { v = (v + +b.dataset.d + n) % n; } while (k === 'outfit' && !isOpen('outfit', v) && v !== look[k]);
  setLook({ ...look, [k]: v });
};
renderPicker();

// 暱稱：進廟前輸入，會顯示在頭上、名單和密語裡；空白就用「考生 #編號」
let nick = store.get('nick', '');
$('#nick-input').value = nick;
$('#nick-input').addEventListener('input', () => { $('#nick-msg').textContent = ''; });
$('#nick-input').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#enter-btn').click(); } });
$('#enter-btn').onclick = async () => {
  const nr = checkName($('#nick-input').value);
  if (!nr.ok) { $('#nick-msg').textContent = NAME_WHY[nr.why] || '這個暱稱不能用，換一個吧。'; $('#nick-input').focus(); return; }
  nick = nr.text; store.set('nick', nick); $('#nick-input').blur();
  sound.init(); sound.bell(0.12);
  music.night = night; music.muted = !sound.on; music.start();
  $('#splash').classList.add('leaving');
  setTimeout(() => { $('#splash').hidden = true; }, 500);
  $('#hud').hidden = false;
  temple.focus = null; temple.camDist = innerWidth < innerHeight ? 9 : 8; temple.camPitch = 0.32;
  temple.frame(Math.PI, 0.35);
  me.faceTo = Math.PI;
  net.connect(look, nick);
  if (!wsUrl) startNpcs();
  else setTimeout(() => { if (!net.alive) startNpcs(); }, 5000); // 連不上伺服器就先放示意香客
  refresh(); startToday();
  const visits = store.get('visits', 0) + 1; store.set('visits', visits);
  if (visits >= 2) setTimeout(maybeInstall, 25000);
  setTimeout(showNewsOnce, 900);
  setTimeout(() => toast(innerWidth < 720 ? '點地板走動、拖曳轉動視角。下方按鈕會帶你一步步參拜。' : '點地板或用 WASD／方向鍵走動，拖曳轉動視角。下方按鈕會帶你一步步參拜。', 4200), 700);
};

// ---------- HUD ----------
const ICONS = {
  prepare: '<path d="M4 20V10h16v10M2 10h20M7 10V6h10v4"/><path d="M10 15h4"/>',
  heaven: '<circle cx="12" cy="7" r="3"/><path d="M12 1.5v1.5M5.5 7H4M20 7h-1.5M7.4 2.4l1 1M16.6 2.4l-1 1"/><path d="M9 21v-6l3-3 3 3v6"/>',
  wenchang: '<path d="M5 21l9-9"/><path d="M14 12l3-7 2 2-5 5"/><path d="M4 22c1-.2 2-.8 2.4-2"/><path d="M15 21h5"/>',
  plant: '<path d="M9 14V6M12 14V4M15 14V6"/><path d="M5 14h14l-2 6H7z"/>',
  pass: '<path d="M5 12a7 7 0 1 1 2 5"/><path d="M5 18v-4h4"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/>',
  card: '<path d="M7 5h10v13l-5 3-5-3z"/><path d="M12 2v3M9.5 10h5M9.5 13h5"/>',
  jinzhi: '<path d="M6 21h12M8 21V11h8v10"/><path d="M12 11c-2-2-1-4 0-6 1 2 3 3 1 6"/><path d="M10 15h4"/>',
  jiaobei: '<path d="M3 14c2-6 7-6 8 0zM13 10c1 6 6 6 8 0z"/>',
  qian: '<path d="M7 11h10l-1.5 10h-7z"/><path d="M10 11V3M13 11V5M15.5 11l1-6"/>',
};
$('#dock').innerHTML = STEPS.map(s => `<button type="button" data-act="${s.id}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[s.id]}</svg><span>${s.dock}</span></button>`).join('')
  + '<i class="sep" aria-hidden="true"></i>'
  + EXTRAS.map(s => `<button type="button" data-act="${s.id}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[s.id]}</svg><span>${s.dock}</span></button>`).join('')
  + '<button type="button" data-act="tasks" aria-label="每日任務"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2.8h6V4M8.5 10l1.5 1.5 3-3M8.5 16l1.5 1.5 3-3"/></svg><span>任務</span><b class="dot" id="dock-task-dot" hidden></b></button>';
$('#dock').onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.act === 'tasks') openToday('tasks'); else act(b.dataset.act); };
$('#guide-steps').innerHTML = STEPS.map((s, i) => `<li data-n="${i + 1}" data-id="${s.id}">${s.label}</li>`).join('');
$('#guide-toggle').onclick = e => { const b = e.currentTarget, open = b.getAttribute('aria-expanded') !== 'true'; b.setAttribute('aria-expanded', open); store.set('guideOpen', open); refresh(); };
if (!store.get('guideOpen', innerWidth >= 720)) $('#guide-toggle').setAttribute('aria-expanded', 'false');
$('#info-btn').onclick = () => { const d = $('#info-dlg'); d.showModal(); d.scrollTop = 0; };
$('#time-btn').setAttribute('aria-pressed', night);
$('#time-btn').onclick = e => { night = !night; store.set('night', night); document.body.classList.toggle('night', night); temple.setNight(night); music.setNight(night); e.currentTarget.setAttribute('aria-pressed', night); };

// 背景音樂面板
function renderMusic() {
  $('#music-on').checked = music.on;
  const cur = music.cur?.k;
  $('#music-list').innerHTML = [{ k: 'auto', zh: '自動輪播', d: '白天輪播寺院配樂，夜晚播〈靜夜安神〉' }, ...MUSIC_TRACKS].map(t =>
    `<button type="button" role="radio" data-k="${t.k}" aria-checked="${music.pick === t.k}"><span><b>${t.zh}${music.on && music.playing && t.k === music.pick ? `<span class="now">♪ ${t.k === 'auto' ? (music.cur?.zh || '') : '播放中'}</span>` : ''}</b><small>${t.d}</small></span></button>`).join('');
  $('#music-btn').classList.toggle('playing', music.playing);
}
music.onChange(renderMusic);
$('#music-btn').onclick = () => {
  const pop = $('#music-pop'), open = pop.hidden; hideCheer(); hideSocial();
  pop.hidden = !open; $('#music-btn').setAttribute('aria-expanded', open); if (open) renderMusic();
};
$('#music-on').onchange = e => { sound.init(); music.setOn(e.target.checked); if (e.target.checked && !sound.on) toast('右上角喇叭目前是關的，打開後才聽得到。'); renderMusic(); };
$('#music-list').onclick = e => { const b = e.target.closest('[data-k]'); if (!b) return; sound.init(); music.setPick(b.dataset.k); if (!sound.on) toast('右上角喇叭目前是關的，打開後才聽得到。'); renderMusic(); };
const hideMusic = () => { $('#music-pop').hidden = true; $('#music-btn').setAttribute('aria-expanded', 'false'); };
$('#sound-btn').setAttribute('aria-pressed', sound.on);
$('#sound-btn').onclick = e => { sound.init(); sound.toggle(); e.currentTarget.setAttribute('aria-pressed', sound.on); };
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close('cancel')));

// 說明內容
$('#info-steps').innerHTML = STEPS.map(s => `<li>${s.label}</li>`).join('') + '<li>考上之後，回來還願答謝</li>';
$('#info-note').textContent = RITUAL_NOTE + '擲筊與求籤是一般廟宇習俗的體驗，不是必要步驟。';
$('#info-facts').innerHTML = FACTS.map(f => `<li>${f}</li>`).join('');
$('#info-sources').innerHTML = '資料來源：' + SOURCES.map(([t, u]) => `<a href="${u}" target="_blank" rel="noopener">${t}</a>`).join('、') + '。';

function refresh() {
  const cur = current();
  document.querySelectorAll('#guide-steps li').forEach(li => { li.className = state.done.has(li.dataset.id) ? 'ok' : cur && li.dataset.id === cur.id ? 'cur' : ''; });
  $('#guide-count').textContent = `${state.done.size} / ${STEPS.length}`;
  document.querySelectorAll('#dock button').forEach(b => { b.classList.toggle('done', state.done.has(b.dataset.act)); b.classList.toggle('cur', !!cur && b.dataset.act === cur.id); });
  const c = state.carry, items = [];
  if (c.incense) items.push('三炷香');
  if (c.offerings.length && !state.done.has('wenchang')) items.push(OFFERINGS.filter(o => c.offerings.includes(o.id)).map(o => o.name).join('、'));
  if (c.ticket) items.push(state.done.has('pass') ? '過爐的准考證影本' : '准考證影本與文具');
  $('#guide-carry').textContent = items.length ? '隨身：' + items.join('・') : '';
  $('#next').innerHTML = cur ? `下一步：<b>${cur.dock}</b>・${cur.label}` : '參拜完成！可以<b>擲筊</b>、<b>求籤</b>、去祈福牆旁的<b>靈犀占卜</b>，或在參拜指引裡按「再參拜一次」。';
  $('#again-guide').hidden = !!cur;
  document.body.classList.toggle('guide-open', $('#guide-toggle').getAttribute('aria-expanded') === 'true');
}

let toastT;
function toast(msg, ms = 3200) {
  const t = $('#toast'); t.innerHTML = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms);
}

// ---------- 名牌與泡泡（HTML 疊在 3D 上） ----------
const labelsEl = $('#labels');
const markEls = MARKS.map(m => {
  const el = document.createElement('button'); el.type = 'button'; el.className = 'mark'; el.textContent = m.name; el.dataset.id = m.id; labelsEl.appendChild(el);
  el.onclick = () => {
    const cur = current(), map = { counter: 'prepare', censer: 'heaven', cushion: ['wenchang', 'plant', 'pass', 'jiaobei'], wall: 'card', qianTube: 'qian', jinlu: 'jinzhi', lingxi: 'lingxi' };
    const ids = [].concat(map[m.id]);
    if (cur && ids.includes(cur.id)) act(cur.id);
    else if (m.id === 'qianTube') act('qian');
    else if (m.id === 'lingxi') act('lingxi');
    else if (['study', 'pool', 'lamp', 'photo', 'grove', 'sky', 'koi', 'boss'].includes(m.id)) act(m.id);
    else if (m.id === 'bang') { if (!state.busy) { state.busy = true; arrive('bang').then(ok => { if (ok) openToday('bang'); }).finally(() => { state.busy = false; }); } }
    else if (!state.busy) { const sp = m.id === 'censer' ? 'censerOut' : m.id; state.busy = true; arrive(sp).finally(() => { state.busy = false; }); }
  };
  return { m, el, v: new THREE.Vector3(...m.pos) };
});
const bubbles = [];
function bubble(av, text, cls = 'bubble', ms = 2600) {
  const el = document.createElement('div'); el.className = cls; el.textContent = text; labelsEl.appendChild(el);
  const b = { av, el, until: performance.now() + ms }; bubbles.push(b); return b;
}
const tags = new Map(); // avatar -> el
// 名牌：稱號（外框依等級）＋暱稱；讀書中前面加 📖
function tagFor(av, name, mine, ttl = 0, studying = false) {
  let el = tags.get(av);
  if (!el) { el = document.createElement('button'); el.type = 'button'; el.className = 'tag' + (mine ? ' me' : ''); labelsEl.appendChild(el); tags.set(av, el); el.onclick = () => openCheer(av); }
  const t = TITLES[ttl | 0] || TITLES[0], key = `${name}|${ttl | 0}|${studying}`;
  if (el.dataset.k !== key) {
    el.dataset.k = key; el.dataset.tier = ttl ? t.tier : 0;
    el.innerHTML = `${studying ? '📖 ' : ''}${mine ? '你・' : ''}${ttl ? `<span class="ttl">${esc(t.name)}</span>` : ''}${esc(name)}`;
  }
  return el;
}
const tmpV = new THREE.Vector3();
function placeLabels() {
  const cur = current(), whereMark = cur ? { counter: 'counter', censerOut: 'censer', censer: 'censer', cushion: 'cushion', wcCenser: 'cushion', wall: 'wall', jinlu: 'jinlu' }[cur.where] : null;
  const pp = me.root.position;
  markEls.forEach(({ m, el, v }) => {
    const p = temple.project(v), far = Math.hypot(v.x - pp.x, v.z - pp.z);
    el.style.display = p.vis && !$('#hud').hidden ? '' : 'none';
    el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
    el.classList.toggle('goal', m.id === whereMark); el.classList.toggle('dim', m.id !== whereMark && far < 2.2);
  });
  for (const [av, el] of tags) {
    if (!temple.avatars.has(av)) { el.remove(); tags.delete(av); continue; }
    tmpV.set(av.root.position.x, 2.05, av.root.position.z);
    const p = temple.project(tmpV); el.style.display = p.vis && !$('#hud').hidden ? '' : 'none'; el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
  }
  const now = performance.now();
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i];
    if (now > b.until || !temple.avatars.has(b.av)) { b.el.remove(); bubbles.splice(i, 1); continue; }
    tmpV.set(b.av.root.position.x, 2.45, b.av.root.position.z);
    const p = temple.project(tmpV); b.el.style.left = p.x + 'px'; b.el.style.top = p.y + 'px'; b.el.style.display = p.vis ? '' : 'none';
  }
}

// ---------- 走動 ----------
temple.on('tapGround', p => { if (state.busy) return; hideCheer(); hideSocial(); hideMusic(); me.faceTo = null; temple.walk(me, p.x, p.z).then(ok => { if (ok) kneelIfOnCushion(); }); });
// 拜墊：點拜墊或走到拜墊上就會跪下（面向文昌帝君），可以叩拜；一走動就起身
temple.on('tapCushion', async i => {
  if (state.busy) return; hideCheer(); hideSocial();
  if (!temple.cushionFree(i) || !(await takeSeat(i))) { toast('這個拜墊有人了，換一個吧。'); return; }
  const c = CUSHIONS[i]; if (await temple.walk(me, c.x, c.z, Math.PI)) kneelIfOnCushion(true); else leaveSeat();
});
function kneelIfOnCushion(tapped) {
  const i = mySeat && mySeat.id < TIANGONG_SEAT0 ? mySeat.id : temple.freeCushion(me.root.position.x, me.root.position.z, 0.6);
  if (i < 0) { if (tapped) toast('這個拜墊有人了，換一個吧。'); return; }
  if (!mySeat || mySeat.id !== i) takeSeat(i).then(ok => { if (!ok) { me.kneel(false); toast('這個拜墊剛好有人了，換一個吧。'); } });
  const c = CUSHIONS[i]; me.root.position.x = c.x; me.root.position.z = c.z; me.faceTo = Math.PI; me.kneel(true);
  if (!store.get('kneelTip', false)) { toast('跪在拜墊上了。按「叩拜」拜三拜；移動就會起身。', 3600); store.set('kneelTip', true); }
}
// 方向搖桿：按住往哪推就往哪走（推越遠走越快），以鏡頭方向為「前」
(() => {
  const el = $('#stick'), knob = $('#stick-knob'); let id = null;
  const set = e => {
    const r = el.getBoundingClientRect(), R = r.width / 2 - 14;
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); const d = Math.hypot(dx, dy);
    if (d > R) { dx = dx / d * R; dy = dy / d * R; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`; temple.stick.x = dx / R; temple.stick.y = -dy / R;
  };
  const end = () => { id = null; el.classList.remove('on'); knob.style.transform = ''; temple.stick.x = temple.stick.y = 0; };
  el.addEventListener('pointerdown', e => { if (state.busy) return; id = e.pointerId; el.setPointerCapture(id); el.classList.add('on'); hideCheer(); hideSocial(); me.faceTo = null; set(e); });
  el.addEventListener('pointermove', e => { if (e.pointerId === id) set(e); });
  el.addEventListener('pointerup', e => { if (e.pointerId === id) { end(); kneelIfOnCushion(); } });
  el.addEventListener('pointercancel', end);
})();
$('#kneel-bow').onclick = async () => { if (me.bowT >= 0) return; sound.bell(0.1); await me.bow(3); };
// 叩拜時配木魚聲（每拜一下敲一聲）
const _bow = me.bow.bind(me); me.bow = n => { for (let k = 0; k < (n || 3); k++) sound.sample('moku', 0.5, 0.45 + k * 1.1); if (me.kneeling) setTimeout(() => task('bow'), 1500); return _bow(n); };
$('#kneel-up').onclick = () => { me.kneel(false); };
temple.on('tapAvatar', av => openCheer(av));
async function walkTo(spot) { me.faceTo = null; const ok = await temple.goSpot(me, spot); return ok; }

// ---------- 參拜動作 ----------
async function act(id) {
  if (state.busy) return;
  hideCheer();
  const fn = id.startsWith('water') ? () => water(+id.slice(5)) : { prepare, heaven, wenchang, plant, pass, jinzhi, card, jiaobei, qian, lingxi, study, lamp: lampAct, pool: wishAct, photo: photoAct, grove: sow, sky: skyAct, koi: koiAct, boss: bossAct, hunt, forest }[id];
  state.busy = true; $('#dock').setAttribute('aria-busy', 'true');
  try { await fn(); } finally { state.busy = false; $('#dock').removeAttribute('aria-busy'); refresh(); }
}
function complete(id) {
  if (state.done.has(id)) return;
  state.done.add(id); save(); refresh(); net.step(state.done.size);
  const s = STEPS.find(x => x.id === id); toast(s.done); sound.chime(); buzz(20);
  if (state.done.size === STEPS.length) setTimeout(showDone, 1600);
}
function need(cond, msg) { if (!cond) { toast(msg, 3600); buzz([10, 60, 10]); } return cond; }
// 向伺服器登記座位（拜墊編號 0…、天公爐拜位 500…），一位一人，兩個人不會搶到同一個
let mySeat = null;
async function takeSeat(id) { const ok = await net.seat(id); if (ok) mySeat = { id, x: seatPos(id).x, z: seatPos(id).z }; else temple.takenSeats.add(id); return ok; }
const seatPos = id => id >= DESK_SEAT0 ? DESKS[id - DESK_SEAT0] : id >= TIANGONG_SEAT0 ? TIANGONG_SLOTS[id - TIANGONG_SEAT0] : CUSHIONS[id];
function leaveSeat() { if (mySeat) { net.leaveSeat(); mySeat = null; } }

async function arrive(spot) {
  const S = SPOTS[spot]; me.faceTo = null;
  let ok;
  if (S.kneel) {
    // 已經跪在拜墊上就不用動；否則依序找：前排主拜墊 → 最近的空拜墊（向伺服器登記，搶不到就換下一個）
    if (me.kneeling && mySeat && mySeat.id < TIANGONG_SEAT0) { temple.frame(S.f, S.cam ?? 0.22); return true; }
    const p = me.root.position;
    const order = CUSHIONS.map((c, k) => k).sort((a, b) => (a < MAIN_CUSHIONS ? a - 100 : Math.hypot(CUSHIONS[a].x, CUSHIONS[a].z - S.z)) - (b < MAIN_CUSHIONS ? b - 100 : Math.hypot(CUSHIONS[b].x, CUSHIONS[b].z - S.z)));
    let got = -1;
    for (const k of order) { if (!temple.cushionFree(k)) continue; if (await takeSeat(k)) { got = k; break; } }
    if (got < 0) { toast('拜墊都有人了，就在這裡跪拜吧。', 2600); me.faceTo = Math.PI; me.kneel(true); await wait(350); return true; }
    if (got >= MAIN_CUSHIONS) toast('前排拜墊有人，幫你找了後面的空拜墊。', 2400);
    ok = await temple.walk(me, CUSHIONS[got].x, CUSHIONS[got].z, S.f);
  } else if (spot === 'censerOut') {
    // 天公爐前一人一個拜位（兩排共 13 位）；都滿了就在後面遙拜，不會卡住
    if (mySeat && mySeat.id >= TIANGONG_SEAT0 && mySeat.id < DESK_SEAT0) ok = true;
    else {
      let got = -1;
      for (let k = 0; k < TIANGONG_SLOTS.length; k++) { if (temple.freeSlot([TIANGONG_SLOTS[k]], me, TIANGONG_SEAT0 + k) !== 0) continue; if (await takeSeat(TIANGONG_SEAT0 + k)) { got = k; break; } }
      if (got < 0) { toast('天公爐前人很多，在後面遙拜也可以。', 2600); const b = temple.freeSpot((Math.random() - 0.5) * 6, SPOTS.censerOut.z - 3.2, 0); ok = await temple.walk(me, b.x, b.z, 0); }
      else ok = await temple.walk(me, TIANGONG_SLOTS[got].x, TIANGONG_SLOTS[got].z, 0);
    }
  } else {
    leaveSeat();
    const p = temple.freeSpot(S.x, S.z, S.f);
    ok = await temple.walk(me, p.x, p.z, S.f);
  }
  if (!ok) { leaveSeat(); return false; }
  temple.frame(S.f, S.cam ?? 0.22);
  if (S.kneel) me.kneel(true);
  await wait(350); return true;
}

// 1. 備供品
const picked = new Set(state.carry.offerings);
$('#offer-grid').innerHTML = OFFERINGS.map(o => `<button type="button" data-id="${o.id}" aria-pressed="${picked.has(o.id)}"><i style="background:#${o.color.toString(16).padStart(6, '0')}"></i><b>${o.name}</b><small>${o.mean}</small></button>`).join('');
$('#taboo-grid').innerHTML = TABOO.map(o => `<button type="button" data-id="${o.id}"><b>${o.name}</b><small>點我看原因</small></button>`).join('');
function offerMsg() {
  const n = picked.size, m = $('#offer-msg');
  m.className = 'msg' + (n && n % 2 === 0 ? ' warn' : '');
  m.textContent = !n ? '先挑幾樣喜歡的供品。' : n % 2 === 0 ? `已選 ${n} 樣。供品習慣取單數，再加或減一樣吧。` : `已選 ${n} 樣：` + OFFERINGS.filter(o => picked.has(o.id)).map(o => `${o.name}（${o.mean}）`).join('、');
}
$('#offer-grid').onclick = e => {
  const b = e.target.closest('button'); if (!b) return; const id = b.dataset.id;
  if (picked.has(id)) picked.delete(id); else { if (picked.size >= 7) { $('#offer-msg').textContent = '最多 7 樣就好。'; return; } picked.add(id); }
  b.setAttribute('aria-pressed', picked.has(id)); offerMsg(); buzz(8);
};
$('#taboo-grid').onclick = e => { const b = e.target.closest('button'); if (!b) return; const t = TABOO.find(x => x.id === b.dataset.id); const m = $('#offer-msg'); m.className = 'msg warn'; m.textContent = `${t.name}：${t.why}`; };
async function prepare() {
  if (state.done.has('prepare')) {
    if (state.carry.incense) { toast('你手上已經拿著香了。'); return; }
    if (!(await arrive('counter'))) return;
    state.carry.incense = true; state.carry.sticks = 3; me.hold(true); me.setSticks(3); save(); toast('再點了三炷香。（供品只在第一次參拜時準備）'); return;
  }
  if (!(await arrive('counter'))) return;
  offerMsg();
  const dlg = $('#offer-dlg');
  const ok = await new Promise(res => {
    $('#offer-ok').onclick = () => { if (!picked.size || picked.size % 2 === 0) { offerMsg(); $('#offer-msg').classList.add('warn'); if (!picked.size) $('#offer-msg').textContent = '至少挑一樣供品。'; return; } dlg.close('ok'); };
    dlg.onclose = () => res(dlg.returnValue === 'ok'); dlg.returnValue = ''; dlg.showModal();
  });
  if (!ok) return;
  state.carry = { incense: true, sticks: 3, offerings: [...picked], ticket: $('#offer-ticket').checked, jinzhi: true };
  me.hold(true); me.setSticks(3); sound.bell(0.08);
  complete('prepare');
}

// 2. 拜天公 / 3. 拜文昌：共用稟告表單
let examPick = '';
$('#exam-chips').innerHTML = EXAMS.map(x => `<button type="button" aria-pressed="false">${x}</button>`).join('');
$('#exam-chips').onclick = e => { const b = e.target.closest('button'); if (!b) return; examPick = b.textContent; document.querySelectorAll('#exam-chips button').forEach(x => x.setAttribute('aria-pressed', x === b)); };
function introduce(mode) {
  const dlg = $('#intro-dlg'), f = $('#intro-form');
  dlg.dataset.mode = mode;
  $('#intro-title').textContent = mode === 'heaven' ? '向天公自我介紹' : '向文昌帝君稟告';
  $('#intro-hint').textContent = mode === 'heaven' ? '面朝廟外，報上姓名、生日與住址，祈求考試平安順利。都可以不填，心裡默念也可以。' : '說明要考什麼試、什麼時候考、在哪裡考，以及你的心願。都可以不填，心裡默念也可以。';
  return new Promise(res => {
    f.onsubmit = e => { e.preventDefault(); const data = Object.fromEntries(new FormData(f)); dlg.close('ok'); res({ ...data, exam: examPick }); };
    dlg.onclose = () => { if (dlg.returnValue !== 'ok') res(null); };
    dlg.returnValue = ''; dlg.showModal();
  });
}
const clearForm = () => { $('#intro-form').reset(); };
async function heaven() {
  if (!need(state.done.has('prepare') || state.carry.incense, '請先到<b>辦事處</b>備供品、領三炷香。')) return;
  if (state.done.has('heaven')) { toast('已經拜過天公了。'); return; }
  if (!(await arrive('censerOut'))) return;
  temple.camYawTarget = SPOTS.censerOut.f + 1.1; // 從廟外斜前方看，背景是正殿
  const r = await introduce('heaven'); if (!r) return;
  if (r.name) bubble(me, `我是${r.name.slice(0, 8)}`, 'bubble', 2200);
  sound.bell(); await me.bow(3); clearForm();
  // 第一炷香插在天公爐（站在爐前、面朝廟外）
  temple.plantIncense('heaven', 1); state.carry.sticks = 2; me.setSticks(2); save();
  complete('heaven');
}
async function wenchang() {
  if (!need(state.done.has('heaven'), '先到天公爐前<b>拜天公</b>，再入殿拜文昌帝君。')) return;
  if (state.done.has('wenchang')) { if (!(await arrive('cushion'))) return; toast('再向文昌帝君拜一拜。想請示可以<b>擲筊</b>。'); sound.bell(); await me.bow(3); return; }
  if (!(await arrive('cushion'))) return;
  temple.setOfferings(OFFERINGS.filter(o => state.carry.offerings.includes(o.id)), state.carry.ticket);
  net.offer(state.carry.offerings.map(id => OFFERINGS.findIndex(o => o.id === id)), state.carry.ticket);
  toast(state.carry.ticket ? '供品和准考證影本擺上供桌了。' : '供品擺上供桌了。', 1800);
  temple.focus = new THREE.Vector3(...FOCUS.altar);
  await wait(1200); temple.focus = null;
  examPick = ''; document.querySelectorAll('#exam-chips button').forEach(x => x.setAttribute('aria-pressed', 'false'));
  const r = await introduce('wenchang'); if (!r) return;
  if (r.exam) bubble(me, `保佑${r.exam}順利`, 'bubble', 2400);
  sound.bell(); await me.bow(3); clearForm();
  complete('wenchang');
  if (!exam) setTimeout(() => feed('⏳ 可以在左上「📅 今日」設定考試倒數'), 2500);
}
async function plant() {
  if (!need(state.carry.incense, '手上沒有香。請先到<b>辦事處</b>領香。')) return;
  if (!need(state.done.has('wenchang'), '先跪在拜墊上向<b>文昌帝君</b>稟告，再把香插進文昌爐。')) return;
  // 不用擠到爐前：跪在拜墊上，把香送進文昌爐
  if (!(await arrive('cushion'))) return;
  temple.focus = new THREE.Vector3(...FOCUS.wcCenser);
  sound.bell(0.1); await me.bow(1);
  const n = Math.max(1, state.carry.sticks ?? 2);
  me.hold(false); await temple.flyIncense(me.root.position, n);
  temple.plantIncense('wenchang', n); state.carry.incense = false; state.carry.sticks = 0; save();
  await wait(500); temple.focus = null;
  complete('plant');
}

// 5. 過爐：手指繞圈
async function pass() {
  if (!need(state.carry.ticket, '你沒有帶准考證影本。可以重新到<b>辦事處</b>備供品時勾選。')) return;
  if (state.done.has('pass')) { toast('准考證已經過爐了。'); return; }
  if (!need(state.done.has('plant') || state.done.has('wenchang'), '先拜完文昌帝君、<b>插香</b>，再來過爐。')) return;
  if (!(await arrive('cushion'))) return; // 跪在拜墊上就能過爐，不用擠到爐前
  temple.focus = new THREE.Vector3(...FOCUS.wcCenser);
  const ok = await circleGesture();
  temple.focus = null;
  if (ok) complete('pass');
}
function circleGesture() {
  const ui = $('#pass-ui'), ring = $('#pass-ring'), prog = $('#pass-prog'), item = $('#pass-item');
  let total = 0, lastA = null, auto = null, done = false;
  const L = 490;
  const draw = a => {
    const turns = Math.min(3, total / (Math.PI * 2));
    prog.style.strokeDashoffset = L - L * ((turns % 1) || (turns >= 1 && total > 0 && turns % 1 === 0 ? 1 : 0));
    $('#pass-num').textContent = `${Math.min(3, Math.floor(turns))} / 3`;
    const ang = a ?? (-Math.PI / 2 + total);
    item.setAttribute('transform', `translate(${100 + Math.cos(ang) * 78} ${100 + Math.sin(ang) * 78}) rotate(${ang * 180 / Math.PI + 90})`);
  };
  total = 0; draw(-Math.PI / 2); $('#pass-hint').textContent = '從上面開始往右繞';
  ui.hidden = false;
  return new Promise(res => {
    const finish = ok => { if (done) return; done = true; clearInterval(auto); ui.hidden = true; ring.onpointerdown = ring.onpointermove = ring.onpointerup = null; res(ok); };
    const angleOf = e => { const r = ring.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)); };
    const advance = d => {
      total += d; const before = Math.floor((total - d) / (Math.PI * 2)), after = Math.floor(total / (Math.PI * 2));
      if (after > before) { sound.bell(0.06); buzz(15); }
      if (total >= Math.PI * 6) { draw(); $('#pass-num').textContent = '3 / 3'; setTimeout(() => finish(true), 450); }
    };
    ring.onpointerdown = e => { ring.setPointerCapture(e.pointerId); lastA = angleOf(e); };
    ring.onpointermove = e => {
      if (lastA == null || done) return; const a = angleOf(e); let d = a - lastA; if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; lastA = a;
      if (d > 0) { advance(d); $('#pass-hint').textContent = '很好，繼續繞'; } else if (d < -0.15) $('#pass-hint').textContent = '要順時針（往右）繞喔';
      draw(a);
    };
    ring.onpointerup = () => { lastA = null; };
    $('#pass-auto').onclick = () => { if (auto) return; auto = setInterval(() => { advance(0.12); draw(); }, reduceMotion() ? 5 : 16); };
    $('#pass-cancel').onclick = () => finish(false);
  });
}

// 燒金紙：到金爐，依序丟入天金、壽金、刈金
async function jinzhi() {
  if (!need(state.carry.jinzhi, '身上沒有金紙。請先到<b>辦事處</b>備供品，會一起領金紙。')) return;
  if (state.done.has('jinzhi')) { toast('金紙已經燒過了。'); return; }
  if (!need(state.done.has('plant'), '拜完文昌帝君、<b>插香</b>之後，再來燒金紙。')) return;
  if (!(await arrive('jinlu'))) return;
  temple.focus = new THREE.Vector3(...FOCUS.jinlu);
  const ok = await burnGesture();
  temple.focus = null;
  if (ok) { state.carry.jinzhi = false; save(); complete('jinzhi'); }
}
function burnGesture() {
  const ui = $('#jinzhi-ui'), grid = $('#jinzhi-grid'); let next = 0, busy = false, done = false;
  const render = () => {
    grid.innerHTML = JINZHI.map((j, i) => `<button type="button" data-i="${i}" class="${i < next ? 'burnt' : i === next ? 'next' : ''}" ${i < next ? 'disabled' : ''}><i style="background:${j.color}"></i><b>${j.name}</b><small>${i < next ? '已燒' : j.for}</small></button>`).join('');
    $('#jinzhi-hint').textContent = next < JINZHI.length ? `點「${JINZHI[next].name}」投進金爐（${JINZHI[next].for}）` : '都燒完了';
  };
  next = 0; render(); ui.hidden = false;
  return new Promise(res => {
    const finish = ok => { if (done) return; done = true; ui.hidden = true; res(ok); };
    grid.onclick = async e => {
      const b = e.target.closest('button'); if (!b || busy) return; const i = +b.dataset.i;
      if (i !== next) { $('#jinzhi-hint').textContent = `順序是先天公、再神明：請先燒「${JINZHI[next].name}」。`; buzz([10, 60, 10]); return; }
      busy = true; await temple.burnPaper(me.root.position, i); sound.fire(); buzz(15); next++; render(); busy = false;
      if (next >= JINZHI.length) setTimeout(() => finish(true), 700);
    };
    $('#jinzhi-cancel').onclick = () => finish(false);
  });
}

// 6. 祈福卡
let cardColor = (myCard && myCard.color) || 'red';
$('#card-colors').innerHTML = CARD_COLORS.map(c => `<button type="button" data-id="${c.id}" aria-label="${c.name}色" style="background:${c.hex}"></button>`).join('');
function cardPreview() {
  const c = CARD_COLORS.find(x => x.id === cardColor), p = $('#card-preview');
  p.style.background = c.hex; p.style.color = c.ink;
  $('#cp-exam').textContent = lastExam || '祈福'; $('#cp-text').textContent = $('#card-text').value || '一次就考上理想的學校';
  document.querySelectorAll('#card-colors button').forEach(b => b.setAttribute('aria-pressed', b.dataset.id === cardColor));
}
let lastExam = (myCard && myCard.exam) || '';
$('#card-colors').onclick = e => { const b = e.target.closest('button'); if (b) { cardColor = b.dataset.id; cardPreview(); } };
$('#card-text').oninput = cardPreview;
async function card() {
  if (!(await arrive('wall'))) return;
  if (examPick) lastExam = examPick;
  if (myCard) $('#card-text').value = myCard.text || '';
  cardPreview();
  const dlg = $('#card-dlg');
  const ok = await new Promise(res => { $('#card-ok').onclick = () => dlg.close('ok'); dlg.onclose = () => res(dlg.returnValue === 'ok'); dlg.returnValue = ''; dlg.showModal(); });
  if (!ok) return;
  const c = CARD_COLORS.find(x => x.id === cardColor);
  const data = { color: c.id, hex: c.hex, ink: c.ink, exam: lastExam, text: $('#card-text').value.trim().slice(0, 24) };
  store.set('card', data);
  net.card(CARD_COLORS.indexOf(c), EXAMS.indexOf(lastExam)); // 只分享顏色和考試類別，寫的字只在自己手機
  const p = temple.hangMyCard(data); p.scale.setScalar(0.01); temple.tween(600, k => p.scale.setScalar(0.01 + 1.69 * k), 0, t => 1 - Math.pow(1 - t, 3));
  temple.focus = new THREE.Vector3(...FOCUS.wall); await wait(1400); temple.focus = null;
  if (state.done.has('card')) { toast('祈福卡換新了。'); return; }
  complete('card');
}

// 擲筊
const JIAO = { sheng: ['聖筊', '一平一凸：文昌帝君應允。'], xiao: ['笑筊', '兩平：笑而不答，可以把問題說得更清楚，再擲一次。'], yin: ['陰筊', '兩凸：不允，請再想一想。'] };
async function toss() {
  const f = me.root.rotation.y, p = me.root.position;
  temple.focus = new THREE.Vector3(p.x + Math.sin(f) * 1.2, 0.3, p.z + Math.cos(f) * 1.2);
  const r = await temple.tossJiaobei(p, f);
  setTimeout(() => { temple.focus = null; }, 1800);
  sound.clack(2); buzz(18);
  bubble(me, JIAO[r][0], 'result-chip', 2600);
  return r;
}
async function jiaobei() {
  if (!(await arrive('cushion'))) return;
  toast('心裡默念想請示的事……', 1400); await me.bow(1);
  const r = await toss();
  toast(`<b>${JIAO[r][0]}</b>：${JIAO[r][1]}`, 4200);
  setTimeout(() => temple.clearBlocks(), 5000);
  setTimeout(() => task('jiaobei'), 1500);
}

// 求籤：搖籤筒 → 擲筊確認 → 籤詩
async function qian() {
  if (!(await arrive('qianTube'))) return;
  for (;;) {
    const n = await shakeTube(); if (!n) return;
    toast(`抽到第 ${n} 籤，到神前擲筊請示是不是這支籤…`, 2600);
    if (!(await arrive('cushion'))) return;
    const r = await toss();
    if (r === 'sheng') { await wait(900); toast('聖筊，就是這支籤。', 1800); temple.clearBlocks(); showLot(n); return; }
    toast(`${JIAO[r][0]}：不是這支籤，請重新求籤。`, 2600); await wait(1800); temple.clearBlocks();
    if (!(await arrive('qianTube'))) return;
  }
}
function shakeTube() {
  const ui = $('#qian-ui'), tube = $('#qian-tube'), fill = $('#shake-fill'), out = $('#stick-out');
  let power = 0, holding = false, raf, done = false, lastRattle = 0;
  fill.style.width = '0%'; out.className = 'stick-out'; out.textContent = ''; tube.classList.remove('shaking');
  ui.hidden = false;
  const motion = e => { const a = e.accelerationIncludingGravity || {}; const m = Math.abs(a.x || 0) + Math.abs(a.z || 0); if (m > 14) bump(0.06); };
  if (typeof DeviceMotionEvent !== 'undefined' && DeviceMotionEvent.requestPermission) DeviceMotionEvent.requestPermission().then(s => { if (s === 'granted') addEventListener('devicemotion', motion); }).catch(() => {});
  else addEventListener('devicemotion', motion);
  function bump(v) {
    if (done) return; power = Math.min(1, power + v); fill.style.width = power * 100 + '%';
    tube.classList.add('shaking'); clearTimeout(bump.t); bump.t = setTimeout(() => { if (!holding) tube.classList.remove('shaking'); }, 250);
    const now = performance.now(); if (now - lastRattle > (sound.samples.shake?.length ? 420 : 90)) { if (!sound.sample('shake', 0.8)) sound.clack(1); lastRattle = now; }
  }
  return new Promise(res => {
    const finish = n => { done = true; cancelAnimationFrame(raf); removeEventListener('devicemotion', motion); tube.onpointerdown = tube.onpointerup = tube.onpointerleave = null; setTimeout(() => { ui.hidden = true; res(n); }, n ? 1100 : 0); };
    let lastT = performance.now();
    const loop = () => { const now = performance.now(), dt = Math.min(0.1, (now - lastT) / 1000); lastT = now; if (holding) bump(dt * 0.6); if (power >= 1 && !done) { const n = 1 + Math.floor(Math.random() * 60); tube.classList.remove('shaking'); out.textContent = ''; out.classList.add('fall'); if (!sound.sample('stick', 0.9)) sound.clack(1); buzz(30); finish(n); return; } raf = requestAnimationFrame(loop); };
    tube.onpointerdown = e => { e.preventDefault(); holding = true; bump(0.08); };
    tube.onpointerup = tube.onpointerleave = () => { holding = false; };
    $('#qian-cancel').onclick = () => finish(0);
    raf = requestAnimationFrame(loop);
  });
}
const NUM = n => { const d = '〇一二三四五六七八九'; if (n <= 10) return n === 10 ? '十' : d[n]; if (n < 20) return '十' + d[n - 10]; return d[Math.floor(n / 10)] + '十' + (n % 10 ? d[n % 10] : ''); };
function rankKey(r) { return r.startsWith('上上') ? '上上' : r.startsWith('上') ? '上' : r.startsWith('下') ? '下' : '中'; }
let shownLot = 0;
function showLot(n, isDaily) {
  const q = window.QIAN_DATA[n - 1], lines = (window.QIAN_LINES || [])[n - 1] || [], story = (window.QIAN_STORY || {})[n];
  shownLot = n; store.set('lastLot', n);
  $('#lot-number').textContent = `${isDaily ? '今日一籤・' : ''}第${NUM(n)}籤・${q[0]}`;
  $('#lot-rank').textContent = q[1];
  $('#lot-poem').innerHTML = q[2].split(/[，。]/).filter(Boolean).map((l, i) => `<span style="animation-delay:${i * 180}ms">${esc(l)}</span>`).join('');
  $('#lot-plain').textContent = q[3];
  $('#lot-tip').textContent = RANK_TIP[rankKey(q[1])] + `（籤中「事業」一項：${q[4]}）`;
  $('#lot-lines').innerHTML = lines.map(l => `<li>${esc(l)}</li>`).join('');
  $('#lot-story-wrap').hidden = !story; if (story) $('#lot-story').textContent = `${story[0]}：${story[1]}`;
  $('#lot-saved').textContent = '';
  if (!sound.sample('unroll', 0.8)) sound.bell(0.1); $('#lot-dlg').showModal();
}
$('#lot-save').onclick = async () => {
  const n = shownLot, q = window.QIAN_DATA[n - 1];
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1440; const g = c.getContext('2d');
  g.fillStyle = '#f6e6bd'; g.fillRect(0, 0, 1080, 1440);
  g.strokeStyle = '#b8322a'; g.lineWidth = 14; g.strokeRect(50, 50, 980, 1340); g.lineWidth = 3; g.strokeRect(78, 78, 924, 1284);
  g.fillStyle = '#8a2a20'; g.textAlign = 'center'; g.font = '700 40px "Noto Serif TC",serif'; g.fillText('文 昌 祠 ・ 六 十 甲 子 籤', 540, 170);
  g.fillStyle = '#4a1a10'; g.font = '900 84px "Noto Serif TC",serif'; g.fillText(`第${NUM(n)}籤`, 540, 290);
  g.fillStyle = '#b8322a'; g.fillRect(440, 320, 200, 70); g.fillStyle = '#fff4d6'; g.font = '700 44px "Noto Serif TC",serif'; g.fillText(`${q[0]} ${q[1]}`, 540, 370);
  const ls = q[2].split(/[，。]/).filter(Boolean); g.fillStyle = '#3a140c'; g.font = '700 58px "Noto Serif TC",serif';
  ls.forEach((l, i) => { const x = 540 + (ls.length - 1) / 2 * 150 - i * 150; [...l].forEach((ch, k) => g.fillText(ch, x, 500 + k * 68)); });
  g.font = '500 34px "Noto Serif TC",serif'; g.fillStyle = '#5a2a18';
  const wrap = (t, y) => { let line = ''; for (const ch of t) { if (g.measureText(line + ch).width > 860) { g.fillText(line, 540, y); y += 50; line = ch; } else line += ch; } g.fillText(line, 540, y); return y; };
  wrap(q[3], 1060);
  g.font = '500 26px sans-serif'; g.fillStyle = '#8a5a3a'; g.fillText('線上參拜文昌帝君・非官方教育作品・籤意請向廟方或解籤人請教', 540, 1320);
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  const file = new File([blob], `文昌籤-第${n}籤.png`, { type: 'image/png' });
  try {
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: '我的文昌籤' }); $('#lot-saved').textContent = '已分享。'; return; }
  } catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  $('#lot-saved').textContent = '已存成圖片。';
};

function showDone() {
  const n = store.get('rounds', 0) + 1; store.set('rounds', n);
  $('#done-text').textContent = `七個步驟都完成了${n > 1 ? `，這是你第 ${n} 次完整參拜` : ''}。祝你考試時頭腦清楚、下筆順利，金榜題名！`;
  sound.chime(); $('#done-dlg').showModal();
}
// 再參拜一次：從備供品重新走一遍完整流程（祈福卡保留在牆上，重寫會換新）
function restartRitual() {
  state.done.clear(); state.carry = { incense: false, offerings: [], ticket: false, jinzhi: false };
  picked.clear(); document.querySelectorAll('#offer-grid button').forEach(b => b.setAttribute('aria-pressed', 'false'));
  temple.setOfferings([]); me.hold(false); me.kneel(false); leaveSeat();
  save(); net.step(0); refresh();
  toast('重新開始參拜：先到<b>辦事處</b>備供品、領香和金紙。', 4000);
}
$('#again-btn').onclick = () => { $('#done-dlg').close(); restartRitual(); };
$('#done-dlg').addEventListener('close', () => { if (store.get('rounds', 0) === 1) setTimeout(maybeInstall, 3000); });
$('#again-guide').onclick = () => { if (!state.busy) restartRitual(); };

// 靈犀占卜：點電子牆在遊戲裡打開靈犀（同一位作者的命理 App）
const LINGXI_URL = 'https://lingxi-397.pages.dev/';
const LX = [['overview', '☀️', '今日運勢', '每天的運勢'], ['star', '⭐', '星座', '星座運勢'], ['dream', '🌙', '解夢', '夢到什麼'], ['qian', '🎋', '求籤', '多種籤詩'], ['tarot', '🃏', '塔羅', '抽牌占卜'], ['meihua', '☯️', '易卦', '梅花易數'],
  ['ziwei', '🔯', '紫微', '命盤'], ['liunian', '📅', '流年', '今年運勢'], ['hehun', '💞', '合婚', '兩人合盤'], ['zeri', '🗓️', '擇日', '挑好日子'], ['festival', '🏮', '拜拜', '節日與拜拜'], ['name', '✍️', '改名', '姓名學']];
$('#lx-grid').innerHTML = LX.map(([v, i, n, d]) => `<button type="button" data-v="${v}"><i aria-hidden="true">${i}</i><b>${n}</b><small>${d}</small></button>`).join('');
let lxMusic = false;
function openLingxi() {
  $('#lingxi-ui').hidden = false; $('#lx-menu').hidden = false; $('#lx-frame').hidden = true; $('#lx-back').hidden = true;
  document.body.classList.add('lx-open'); lxMusic = music.playing; music.pause();
}
function closeLingxi() {
  $('#lingxi-ui').hidden = true; document.body.classList.remove('lx-open');
  $('#lx-frame').src = 'about:blank'; if (lxMusic) music.play();
}
$('#lx-grid').onclick = e => {
  const b = e.target.closest('[data-v]'); if (!b) return; const url = LINGXI_URL + '#' + b.dataset.v;
  $('#lx-frame').src = url; $('#lx-frame').hidden = false; $('#lx-menu').hidden = true; $('#lx-back').hidden = false;
};
$('#lx-back').onclick = () => { $('#lx-frame').src = 'about:blank'; $('#lx-frame').hidden = true; $('#lx-menu').hidden = false; $('#lx-back').hidden = true; };
$('#lx-close').onclick = closeLingxi;
async function lingxi() {
  if (Math.hypot(me.root.position.x - SPOTS.lingxi.x, me.root.position.z - SPOTS.lingxi.z) > 3) { if (!(await arrive('lingxi'))) return; }
  openLingxi();
}
temple.on('tapLingxi', () => act('lingxi'));

// ---------- 其他香客：多人連線或示意香客 ----------
const remotes = new Map(); // id -> avatar
let myId = 0, blocked = new Set(sess.get('blocked', []));
const blockedNames = sess.get('blockedNames', {}); // 封鎖時記下暱稱，名單上才認得出是誰
// 本機測試可用 ?ws=ws://127.0.0.1:8787/ws
const wsUrl = (location.hostname === 'localhost' && new URLSearchParams(location.search).get('ws'))
  || (WS_URL === 'auto' ? (/github\.io$/.test(location.hostname) || !/^https?:$/.test(location.protocol) ? '' : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`) : WS_URL);
const peers = new Map(); // id -> { s: 參拜進度, n: 暱稱 }
const who = id => id === myId ? (nick || `考生 #${id}`) : (peers.get(id)?.n || `考生 #${id}`);
const net = new Net(wsUrl, {
  status(on, was) {
    $('#presence').hidden = !on;
    if (on) { stopNpcs(); net.step(state.done.size); net.dmOff(!dmAllow); blocked.forEach(id => net.block(id)); renderDm(); }
    else { for (const c of dm.convs.values()) c.gone = true; renderDm(); for (const av of remotes.values()) temple.removeAvatar(av); remotes.clear(); peers.clear(); if (was) feed('連線中斷，正在重新連線…'); }
    renderPeople();
  },
  message(m) {
    if (m.t === 'welcome') {
      myId = m.you; temple.setSharedCards(m.cards || [], CARD_COLORS.map(c => c.hex), cardLabel); if (m.cards?.length) feed(`祈福牆上已經有 ${m.cards.length} 張大家的卡`);
      blessing.clear(); blessOk.clear(); if (m.bang) setBang(m.bang); if (m.lamps) setLamps(m.lamps); setOthersOffers(m.offers || []); if (m.trees) setTrees(m.trees); if (m.boss) out.setBoss(m.boss.hp, m.boss.max); wishes = m.wishes || 0; focusAll = m.focus || 0; drawStudyBoard();
      if (typeof m.myBless === 'number' && m.myBless > myBless) { myBless = m.myBless; store.set('myBless', myBless); }
      renderToday();
    }
    else if (m.t === 'bless') {
      const pv = temple.setCardBless(m.id, m.b);
      // 自己剛送出的加持：伺服器確認後才算數
      if (blessing.has(m.id) && !blessOk.has(m.id)) { blessOk.add(m.id); const c = pv?.userData.card; blessFx(c ? cardLabel(c) : ''); task('bless'); }
    }
    else if (m.t === 'bless-no') toast('這張卡不能加持（可能是你自己的，或已經加持過了）。');
    else if (m.t === 'blessed') {
      myBless++; store.set('myBless', myBless); renderToday(); sound.chime(); buzz(15);
      toast(`🙏 ${m.from ? esc(m.from) : '有人'}幫你的祈福卡加持了！（這張共 ${m.b} 次）`, 4200);
    }
    else if (m.t === 'bang') {
      setBang([...bang, m.e].slice(-60));
      if (m.from === myId) bangDone(m.e);
      else { feed(`🎉 ${bangLabel(m.e)}，回來還願了！`); const av = remotes.get(m.from); if (av) { av.emote('jump'); bubble(av, '🎉 金榜題名', 'bubble', 2600); } }
    }
    else if (m.t === 'lamp') { setLamps(m.lamps || []); if (m.from === myId) lampDone(); else feed(`🏮 ${m.e?.n || who(m.from)} 點了一盞光明燈`); }
    else if (m.t === 'wish') {
      wishes = m.n || wishes + 1; if (m.from === myId) return;
      const av = remotes.get(m.from); if (av?.root.visible) temple.tossCoin(av.root.position);
      if (performance.now() - lastWishFeed > 6000) { lastWishFeed = performance.now(); feed(`🪙 ${who(m.from)} 在許願池許了願`); }
    }
    else if (m.t === 'offer') setOthersOffers(m.offers || []);
    else if (m.t === 'trees') setTrees(m.trees || []);
    else if (m.t === 'sowed') sowed(m.i);
    else if (m.t === 'watered') watered(m);
    else if (m.t === 'tree-help') { sound.chime(); toast(`🌳 ${m.from ? esc(m.from) : '有人'}幫你的金榜樹澆水了${m.grew ? `，長到 ${m.s} 天` : ''}！`, 4000); }
    else if (m.t === 'tree-have') toast('你已經有一棵金榜樹了。');
    else if (m.t === 'tree-full') toast('金榜樹林的位置都滿了，過幾天再來看看。');
    else if (m.t === 'sky') { if (m.from !== myId) { out.releaseLantern(m.x, m.z); if (performance.now() - lastWishFeed > 6000) { lastWishFeed = performance.now(); feed(`🏮 ${who(m.from)} 放了一盞天燈`); } } }
    else if (m.t === 'boss') {
      out.setBoss(m.hp, m.max);
      if (m.beat) { if (m.hitters?.includes(myId)) bossBeat(); else feed('⚔️ 大家一起打倒了考試魔王！明天牠還會再來'); }
    }
    else if (m.t === 'board') { board = m; if ($('#rank-dlg').open) renderRank(); }
    else if (m.t === 'focus') { focusAll = m.m || 0; drawStudyBoard(); renderFocusScreen(); }
    else if (m.t === 'bang-dup') toast('這項考試你已經還願過了，紅榜上有你的名字。');
    else if (m.t === 'state') {
      $('#presence .online').textContent = `${m.online} 人`; $('#presence').setAttribute('aria-label', `${m.online} 人在廟裡，點開互動`);
      const seen = new Set();
      for (const p of m.players) {
        if (p.id === myId) continue; seen.add(p.id);
        let av = remotes.get(p.id);
        if (!av) { av = temple.addAvatar(new Avatar(p.look)); av.netId = p.id; av.root.position.set(p.x, 0, p.z); av.speed = 4.5; remotes.set(p.id, av); }
        else if (JSON.stringify(av.look) !== JSON.stringify(p.look)) av.setLook(p.look);
        if (Math.hypot(av.root.position.x - p.x, av.root.position.z - p.z) > 0.1) { av.path = null; av.target = { x: p.x, z: p.z, face: p.f }; } else av.faceTo = p.f;
        av.hold(!!p.h); av.kneel(!!p.k); av.sit(!!p.su); av.study = !!p.su; if (p.b && av.bowT < 0) av.bow(1);
        peers.set(p.id, { s: p.s || 0, n: p.n || '' });
      }
      for (const id of [...peers.keys()]) if (!seen.has(id)) peers.delete(id);
      temple.takenSeats = new Set(m.players.filter(p => p.id !== myId && p.st >= 0).map(p => p.st));
      renderPeople();
      for (const [id, av] of remotes) if (!seen.has(id)) { temple.removeAvatar(av); remotes.delete(id); }
    }
    else if (m.t === 'leave') { const av = remotes.get(m.id); if (av) { temple.removeAvatar(av); remotes.delete(m.id); } peers.delete(m.id); renderPeople(); if (dm.convs.has(m.id)) { dm.convs.get(m.id).gone = true; dmLine(m.id, 'sys', '對方離開了廟裡。'); } }
    else if (m.t === 'emote') {
      if (blocked.has(m.from)) return;
      const e = EMOTES[m.e]; const av = m.from === myId ? null : remotes.get(m.from);
      if (e && av) { av.emote(e.id); bubble(av, e.icon, 'bubble', 1800); }
    }
    else if (m.t === 'card') {
      temple.addSharedCard(m.card);
      if (m.card.by !== myId) feed(`${who(m.card.by)} 掛上一張「${cardLabel(m.card)}」祈福卡`);
    }
    else if (m.t === 'feed') {
      if (m.from === myId) return;
      if (m.k === 'join') feed(`${m.n || who(m.from)} 走進了文昌祠`);
      if (m.k === 'done') feed(`${who(m.from)} 完成參拜了！點「互動」幫他加油`);
    }
    else if (m.t === 'cheer') {
      if (blocked.has(m.from)) return;
      const text = CHEERS[m.i] || CHEERS[0];
      const from = m.from === myId ? me : remotes.get(m.from);
      if (from) bubble(from, text);
      if (m.to === myId && m.from !== myId && !blocked.has(m.from)) {
        toast(`${esc(who(m.from))} 對你說：<b>${esc(text)}</b><button type="button" class="reply" data-reply="${m.from}">回覆</button>`, 5000); sound.chime(); buzz(20);
      }
    }
    else if (m.t === 'dm') {
      if (blocked.has(m.from)) return;
      dmLine(m.from, 'them', m.text);
      const av = remotes.get(m.from); if (av) bubble(av, '💬', 'bubble', 1500);
      sound.chime(); buzz(15);
      if (!(dm.open && dm.cur === m.from)) toast(`<b>${esc(who(m.from))}</b> 密語：${esc(m.text)}<button type="button" class="reply" data-dm="${m.from}">回覆</button>`, 6000);
    }
    else if (m.t === 'dm-ok') { dmLine(m.to, 'me', m.text); bubble(me, '💬', 'bubble', 1500); }
    else if (m.t === 'dm-reject') dmLine(m.to, 'sys', CHAT_WHY[m.why] || '這則密語沒有送出。');
    else if (m.t === 'dm-fail') dmLine(m.to, 'sys', m.why === 'gone' ? '對方已經離開廟裡了。' : '對方目前不接收密語。');
    else if (m.t === 'slow' && m.kind === 'msg') { if (dm.cur) dmLine(dm.cur, 'sys', '說慢一點喔。'); }
    else if (m.t === 'slow' && m.kind === 'hit') {}
    else if (m.t === 'slow') { if (m.kind === 'bless') { blessing.clear(); } toast(m.kind === 'card' ? '祈福卡剛掛過，等一下再換。' : m.kind === 'bang' ? '剛剛才還願過，等一分鐘再試。' : m.kind === 'lamp' ? '光明燈剛點過，等一下再點。' : m.kind === 'wish' ? '許願幣一枚一枚投，慢一點。' : m.kind === 'bless' ? '加持慢一點，一張一張來。' : '慢一點喔，稍等一下再送。'); }
  },
});
function openCheer(av) {
  if (av === me) return;
  const menu = $('#cheer-menu');
  if (av.npc) { toast('這位是示意香客，不是真人。連上多人伺服器後，就能和真的考生互相打氣。', 4200); return; }
  openCheerFor(av.netId, av);
}
function openCheerFor(id, av = remotes.get(id)) {
  const menu = $('#cheer-menu'); hideSocial();
  menu.hidden = false; menu.dataset.id = id;
  const isB = blocked.has(id);
  $('#cheer-name').textContent = isB ? `${who(id)}（已封鎖）` : `對 ${who(id)} 說：`;
  $('#cheer-list').hidden = isB; $('#cheer-invite').hidden = isB; $('#cheer-block').hidden = isB; $('#cheer-unblock').hidden = !isB;
  $('#cheer-list').innerHTML = CHEERS.map((c, i) => `<button type="button" data-i="${i}">${c}</button>`).join('');
  const w = Math.min(280, innerWidth - 24); menu.style.width = w + 'px';
  if (!av) { menu.style.left = (innerWidth - w) / 2 + 'px'; menu.style.top = Math.max(70, innerHeight / 2 - 160) + 'px'; return; }
  tmpV.set(av.root.position.x, 2.4, av.root.position.z); const p = temple.project(tmpV);
  menu.style.left = Math.max(12, Math.min(innerWidth - w - 12, p.x - w / 2)) + 'px'; menu.style.top = Math.max(70, Math.min(innerHeight - 320, p.y - 230)) + 'px';
}
function hideCheer() { $('#cheer-menu').hidden = true; }
$('#cheer-list').onclick = e => { const b = e.target.closest('button'); if (!b) return; net.cheer(+$('#cheer-menu').dataset.id, +b.dataset.i); hideCheer(); buzz(10); task('cheer'); };
function blockUser(id) { blockedNames[id] = who(id); sess.set('blockedNames', blockedNames); blocked.add(id); sess.set('blocked', [...blocked]); net.block(id); renderPeople(); }
function unblockUser(id) {
  blocked.delete(id); delete blockedNames[id]; sess.set('blocked', [...blocked]); sess.set('blockedNames', blockedNames); net.unblock(id); renderPeople();
  toast(`已解除封鎖 ${esc(who(id))}，可以再收到他的密語和打氣。`);
}
$('#cheer-block').onclick = () => { blockUser(+$('#cheer-menu').dataset.id); hideCheer(); toast('已封鎖，不會再收到他的密語和打氣。之後可以在「互動」裡解除封鎖。'); };
$('#cheer-unblock').onclick = () => { unblockUser(+$('#cheer-menu').dataset.id); hideCheer(); };
$('#cheer-invite').onclick = () => { const id = +$('#cheer-menu').dataset.id; hideCheer(); openDm(id, true); };

// ---------- 密語：點人就能直接傳，可以同時和好幾個人聊 ----------
const dm = { open: false, cur: 0, convs: new Map() }; // id -> { lines, unread, gone }
let dmAllow = store.get('dmAllow', true);
$('#dm-allow').checked = dmAllow;
$('#dm-allow').onchange = e => { dmAllow = e.target.checked; store.set('dmAllow', dmAllow); net.dmOff(!dmAllow); toast(dmAllow ? '會收到別人的密語。' : '已關閉密語，別人傳不過來。'); };
function conv(id) { if (!dm.convs.has(id)) dm.convs.set(id, { lines: [], unread: 0, gone: false }); return dm.convs.get(id); }
function dmLine(id, who, text) {
  const c = conv(id); c.lines.push({ who, text }); if (c.lines.length > 60) c.lines.shift();
  if (who === 'them' && !(dm.open && dm.cur === id)) c.unread++;
  if (!dm.cur) dm.cur = id;
  renderDm();
}
function openDm(id, focus) {
  hideCheer(); hideSocial();
  if (id) { if (blocked.has(id)) { toast('你已封鎖這位考生。'); return; } conv(id); dm.cur = id; }
  else if (!dm.convs.has(dm.cur)) dm.cur = [...dm.convs.keys()].pop() || 0;
  if (dm.cur) conv(dm.cur).unread = 0;
  dm.open = true; $('#chat').hidden = false; document.body.classList.add('chatting'); renderDm();
  if (focus) setTimeout(() => $('#chat-input').focus(), 80);
}
function closeDm() { dm.open = false; $('#chat').hidden = true; document.body.classList.remove('chatting'); $('#chat-input').blur(); renderDm(); }
function renderDm() {
  const unread = [...dm.convs.values()].reduce((n, c) => n + c.unread, 0), btn = $('#dm-btn');
  let dot = btn.querySelector('.dot'); if (unread) { if (!dot) { dot = document.createElement('b'); dot.className = 'dot'; btn.appendChild(dot); } dot.textContent = unread; } else dot?.remove();
  btn.hidden = !net.alive && !dm.convs.size;
  if (!dm.open) return;
  $('#dm-tabs').innerHTML = [...dm.convs].map(([id, c]) => `<button type="button" role="tab" data-tab="${id}" aria-selected="${id === dm.cur}" class="${c.gone ? 'gone' : ''}">${esc(who(id))}${c.unread ? `<b>${c.unread}</b>` : ''}</button>`).join('');
  const c = dm.convs.get(dm.cur);
  $('#chat-title').textContent = c ? `密語：${who(dm.cur)}` : '密語';
  $('#dm-empty').hidden = !!c; $('#chat-log').hidden = !c; $('#chat-block').hidden = !c;
  $('#chat-form').hidden = !c; $('#chat-phrases').hidden = !c;
  $('#chat-input').disabled = !c || c.gone; $('#chat-form button').disabled = !c || c.gone;
  if (!c) return;
  const log = $('#chat-log');
  log.innerHTML = ''; c.lines.forEach(l => { const li = document.createElement('li'); li.className = l.who; li.textContent = l.text; log.appendChild(li); });
  log.scrollTop = log.scrollHeight;
}
function sendChat(text) {
  if (!dm.cur || conv(dm.cur).gone) return false;
  const r = checkChat(text);
  if (!r.ok) { dmLine(dm.cur, 'sys', CHAT_WHY[r.why]); return false; }
  net.dm(dm.cur, r.text); return true;
}
$('#dm-tabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (b) { dm.cur = +b.dataset.tab; conv(dm.cur).unread = 0; renderDm(); } };
$('#dm-btn').onclick = () => openDm();
$('#chat-min').onclick = closeDm;
$('#chat-phrases').innerHTML = CHAT_PHRASES.map(t => `<button type="button">${t}</button>`).join('');
$('#chat-phrases').onclick = e => { const b = e.target.closest('button'); if (b) sendChat(b.textContent); };
$('#chat-form').onsubmit = e => { e.preventDefault(); const i = $('#chat-input'); if (sendChat(i.value)) i.value = ''; };
// 手機鍵盤跳出來時，把密語視窗往上推，輸入框才不會被擋住
if (window.visualViewport) {
  const fit = () => { const v = visualViewport; $('#chat').style.bottom = Math.max(0, innerHeight - v.height - v.offsetTop) + 'px'; };
  visualViewport.addEventListener('resize', fit); visualViewport.addEventListener('scroll', fit);
}
$('#chat-block').onclick = () => { const id = dm.cur; blockUser(id); dm.convs.delete(id); dm.cur = [...dm.convs.keys()].pop() || 0; renderDm(); toast(`已封鎖 ${esc(who(id))}，不會再收到他的密語。可以在「互動」裡解除封鎖。`); };
$('#presence').onclick = () => openSocial();
$('#toast').addEventListener('click', e => {
  const b = e.target.closest('[data-reply]'); if (b) { $('#toast').classList.remove('show'); openCheerFor(+b.dataset.reply); }
  const d = e.target.closest('[data-dm]'); if (d) { $('#toast').classList.remove('show'); openDm(+d.dataset.dm, true); }
});

// 互動面板：表情動作＋在廟裡的考生
$('#emote-list').innerHTML = EMOTES.map((e, i) => `<button type="button" data-e="${i}"><i aria-hidden="true">${e.icon}</i>${e.name}</button>`).join('');
let lastEmote = 0;
$('#emote-list').onclick = e => {
  const b = e.target.closest('button'); if (!b) return; const now = performance.now(); if (now - lastEmote < 1000) return; lastEmote = now;
  const em = EMOTES[+b.dataset.e]; me.emote(em.id); bubble(me, em.icon, 'bubble', 1800); net.emote(+b.dataset.e); buzz(10); hideSocial(); task('cheer');
};
function openSocial() { hideCheer(); renderPeople(); $('#social').hidden = false; $('#social-btn').setAttribute('aria-expanded', 'true'); }
function hideSocial() { $('#social').hidden = true; $('#social-btn').setAttribute('aria-expanded', 'false'); }
$('#social-btn').onclick = () => $('#social').hidden ? openSocial() : hideSocial();
function renderPeople() {
  const bl = [...blocked];
  $('#blocked-wrap').hidden = !bl.length;
  const bh = bl.map(id => `<li><span><b>${esc(blockedNames[id] || who(id))}</b><small>${peers.has(id) ? '在廟裡' : '已離開'}・#${id}</small></span><button type="button" data-unblock="${id}">解除封鎖</button></li>`).join('');
  if ($('#blocked-list').innerHTML !== bh) $('#blocked-list').innerHTML = bh;
  const online = net.alive;
  $('#social-offline').hidden = online; $('#people-wrap').hidden = !online;
  const ids = [...peers.keys()].filter(id => id !== myId).sort((a, b) => a - b);
  $('#people-title').textContent = `在廟裡的考生（${ids.length + (online ? 1 : 0)} 人，含你）`;
  $('#people-empty').hidden = ids.length > 0;
  const html = ids.map(id => { const s = peers.get(id).s; return `<li><span><b>${esc(who(id))}</b><small>${peers.get(id).n ? `#${id}・` : ''}${s >= STEPS.length ? '已完成參拜 ✓' : s ? `參拜中・${s}/${STEPS.length}` : '剛進廟'}</small></span><span class="acts">${blocked.has(id) ? '' : `<button type="button" data-cheer="${id}">打氣</button>`}${blocked.has(id) ? `<button type="button" data-unblock-p="${id}">解除封鎖</button>` : `<button type="button" class="alt" data-whisper="${id}">密語</button>`}</span></li>`; }).join('');
  if ($('#people-list').innerHTML !== html) $('#people-list').innerHTML = html;
  const btn = $('#social-btn'); let dot = btn.querySelector('.dot');
  if (online && ids.length) { if (!dot) { dot = document.createElement('b'); dot.className = 'dot'; btn.appendChild(dot); } dot.textContent = ids.length; } else dot?.remove();
}
// 在廟裡改暱稱
$('#my-nick').value = nick;
$('#my-nick-save').onclick = () => {
  const r = checkName($('#my-nick').value);
  if (!r.ok) { toast(NAME_WHY[r.why] || '這個暱稱不能用。'); return; }
  nick = r.text; store.set('nick', nick); $('#nick-input').value = nick; net.setName(nick); toast(nick ? `暱稱改成「${esc(nick)}」了。` : '已清除暱稱，會顯示考生編號。');
};
$('#blocked-list').onclick = e => { const b = e.target.closest('[data-unblock]'); if (b) unblockUser(+b.dataset.unblock); };
$('#people-list').onclick = e => {
  const b = e.target.closest('[data-cheer]'); if (b) openCheerFor(+b.dataset.cheer);
  const w = e.target.closest('[data-whisper]'); if (w) openDm(+w.dataset.whisper, true);
  const u = e.target.closest('[data-unblock-p]'); if (u) unblockUser(+u.dataset.unblockP);
};

// 動態：誰進來、誰掛卡、誰完成參拜
function feed(text) {
  const ol = $('#feed'), li = document.createElement('li'); li.textContent = text; ol.prepend(li);
  while (ol.children.length > 3) ol.lastChild.remove(); // 最新的在最下面
  setTimeout(() => li.classList.add('out'), 5500); setTimeout(() => li.remove(), 6100);
}

// ---------- 今日：考試倒數、每日一籤、每日小任務、祈福牆加持、還願紅榜、文昌帝君聖誕 ----------
// 匿名代碼：隨機產生、只存在這支手機，用來認出「哪張祈福卡是你掛的」；不含任何個資
const uid = store.get('uid', '') || (() => { const v = [...crypto.getRandomValues(new Uint8Array(12))].map(b => (b % 36).toString(36)).join(''); store.set('uid', v); return v; })();
net.uid = uid;
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayNum = s => { const [y, m, d] = s.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 864e5); };
const today = () => ymd(new Date());
const daysTo = s => dayNum(s) - dayNum(today());
// 聖誕：農曆二月初三前兩天到當天是活動期間；本機測試可加 ?fest=1
function feast() {
  const t = dayNum(today()), force = location.hostname === 'localhost' && new URLSearchParams(location.search).get('fest');
  for (const d of FEAST_DATES) { const n = dayNum(d) - t; if (n >= 0) return { date: d, n, on: !!force || n <= FEAST_DAYS_BEFORE }; }
  return { date: '', n: -1, on: !!force };
}
// 今天的任務：「抽今日一籤」每天都有，其他依日期從任務池抽 3 項（同一天大家都一樣）
function seeded(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function pickTasks(d) {
  const r = seeded(dayNum(d) * 7919), rest = TASK_POOL.filter(t => !t.fixed).map(t => [r(), t]).sort((a, b) => a[0] - b[0]).map(x => x[1].id);
  return [...TASK_POOL.filter(t => t.fixed).map(t => t.id), ...rest.slice(0, DAILY_COUNT - 1)];
}
let daily = store.get('daily', null);
const freshDaily = () => {
  if (!daily || daily.d !== today()) daily = { d: today(), t: {}, bless: 0 };
  // 舊版存的今天進度：已完成的任務保留在清單裡
  if (!daily.ids) { const old = Object.keys(daily.t); daily.ids = [...new Set([...old, ...pickTasks(daily.d)])].slice(0, Math.max(DAILY_COUNT, old.length)); }
  return daily;
};
freshDaily();
const saveDaily = () => store.set('daily', daily);
const tasksOf = () => daily.ids.map(id => TASK_POOL.find(t => t.id === id)).filter(Boolean);
const tasksLeft = () => tasksOf().filter(t => !daily.t[t.id]).length;
function task(id, n = 1) {
  freshDaily(); const list = tasksOf(), def = list.find(x => x.id === id);
  if (!def || daily.t[id]) return;
  if (def.need) { daily.c ||= {}; const v = daily.c[id] = (daily.c[id] ?? (id === 'bless' ? daily.bless || 0 : 0)) + n; if (v < def.need) { saveDaily(); renderToday(); return; } }
  daily.t[id] = 1; saveDaily();
  const left = tasksLeft(); sound.chime(); buzz(20);
  celebrate({ title: `任務完成：${def.name}`, sub: left ? `今日任務 ${list.length - left} / ${list.length}，還有 ${left} 項` : '今天的任務全部完成！', done: list.length - left, total: list.length });
  if (!left) dayDone();
  renderToday(); const chip = $('#task-chip'); chip.classList.remove('pop'); void chip.offsetWidth; chip.classList.add('pop');
}
// 統計：解鎖獎勵用
const stats = store.get('stats', {});
const weekKey = () => { const d = new Date(); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return ymd(d); };
const stat = () => ({ days: store.get('days', 0), streak: Math.max(store.get('streakMax', 0), store.get('streak', 0)), bless: stats.bless || 0, bang: stats.bang || 0,
  fest: store.get('accFest', false) ? 1 : 0, study: stats.study || 0, week: stats.weeks || 0, lamp: stats.lamp || 0,
  tree: stats.tree || 0, monster: stats.monster || 0, boss: stats.boss || 0, goldkoi: stats.goldkoi || 0, treasure: stats.treasure || 0, sky: stats.sky || 0 });
const unlocked = (r, s = stat()) => Object.entries(r.need).every(([k, v]) => s[k] >= v);
const rkey = r => r.kind + r.v;
const rewardName = r => r.kind === 'title' ? `稱號「${TITLES[r.v].name}」` : r.kind === 'acc' ? `配件「${ACCS[r.v]}」` : r.kind === 'fx' ? `特效「${FXS[r.v]}」` : `服裝「${OUTFITS[r.v].name}」`;
function isOpen(kind, v) {
  if (kind === 'outfit') return !OUTFITS[v]?.locked || REWARDS.some(r => r.kind === kind && r.v === v && unlocked(r));
  return !v || REWARDS.some(r => r.kind === kind && r.v === v && unlocked(r));
}
function addStat(k, n = 1) { stats[k] = (stats[k] || 0) + n; store.set('stats', stats); checkUnlocks(); }
// 新解鎖的獎勵：跳出慶祝（第一次載入時只記下來，不打擾）
function checkUnlocks(show = true) {
  const seen = new Set(store.get('seenRw', [])), s = stat(), fresh = REWARDS.filter(r => !seen.has(rkey(r)) && unlocked(r, s));
  if (!fresh.length) return []; fresh.forEach(r => seen.add(rkey(r))); store.set('seenRw', [...seen]);
  if (show) celebrate({ big: true, title: '解鎖新獎勵！', sub: '到「📅 今日」的獎勵區換上，大家都看得到。', rewards: fresh });
  return fresh;
}
checkUnlocks(false);
function dayDone() {
  const prev = store.get('lastDay', ''), days = store.get('days', 0) + 1;
  const streak = prev && dayNum(today()) - dayNum(prev) === 1 ? store.get('streak', 0) + 1 : 1;
  store.set('days', days); store.set('lastDay', today()); store.set('streak', streak); store.set('streakMax', Math.max(streak, store.get('streakMax', 0)));
  if (stats.wk !== weekKey()) { stats.wk = weekKey(); stats.wd = 0; }
  stats.wd = (stats.wd || 0) + 1; if (stats.wd === WEEK_GOAL) stats.weeks = (stats.weeks || 0) + 1; store.set('stats', stats);
  if (feast().on && !store.get('accFest', false)) store.set('accFest', true);
  const fresh = checkUnlocks(false);
  celebrate({ big: true, confetti: true, title: '🎉 今日任務全部完成！', sub: `累積 ${days} 天${streak > 1 ? `・連續 ${streak} 天` : ''}。明天還有新任務！`, rewards: fresh });
}

// 慶祝畫面：小的（完成一項）自動消失；大的（全部完成、解鎖獎勵）要按「太好了」
const celQ = []; let celOn = false;
function celebrate(o) { celQ.push(o); if (!celOn) nextCel(); }
function nextCel() {
  const o = celQ.shift(), el = $('#celebrate'); if (!o) { celOn = false; el.hidden = true; return; }
  celOn = true; el.hidden = false; el.classList.toggle('big', !!o.big);
  $('#cel-t').textContent = o.title; $('#cel-s').textContent = o.sub || '';
  $('.cel-bar').hidden = !o.total; $('#cel-bar').style.width = '0%';
  if (o.total) requestAnimationFrame(() => requestAnimationFrame(() => { $('#cel-bar').style.width = `${o.done / o.total * 100}%`; }));
  $('#cel-rw').innerHTML = (o.rewards || []).map(r => `<li>🏅 ${esc(rewardName(r))}</li>`).join('');
  $('#cel-btns').hidden = !o.big; $('#cel-wear').hidden = !(o.rewards || []).length;
  const card = $('.cel-card'); card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
  const cf = $('.confetti'); cf.innerHTML = '';
  if (o.confetti || o.rewards?.length) {
    const cols = ['#e8c15a', '#c8352b', '#f6dc94', '#2f7d6d', '#fff4d6'];
    cf.innerHTML = Array.from({ length: reduceMotion() ? 0 : 40 }, (_, i) => `<i style="left:${Math.random() * 100}%;background:${cols[i % 5]};animation-delay:${Math.random() * 0.8}s;animation-duration:${2 + Math.random() * 1.5}s"></i>`).join('');
    sound.bell(0.12);
  }
  if (!o.big) setTimeout(nextCel, 1900);
}
$('#cel-ok').onclick = () => nextCel();
$('#cel-wear').onclick = () => { celQ.length = 0; nextCel(); openToday('reward'); };

// 考試倒數
let exam = store.get('exam', null); // { x: 考試名稱, d: 'YYYY-MM-DD' }
$('#exam-name').innerHTML = EXAMS.map(x => `<option>${x}</option>`).join('');
$('#bang-exam').innerHTML = EXAMS.map((x, i) => `<option value="${i}">${x}</option>`).join('');
$('#exam-save').onclick = () => {
  const d = $('#exam-date').value; if (!d) { toast('先選考試日期。'); return; }
  exam = { x: $('#exam-name').value, d }; store.set('exam', exam); renderToday();
  const n = daysTo(d); toast(n > 0 ? `記住了：距離${exam.x}還有 ${n} 天，加油！` : n === 0 ? '就是今天！深呼吸，你可以的。' : '這個日期已經過了，考完了嗎？可以回來還願喔。');
};
$('#exam-clear').onclick = () => { exam = null; store.set('exam', null); $('#exam-date').value = ''; renderToday(); };
// 加到手機行事曆：下載 .ics，考前一天提醒
$('#exam-ics').onclick = () => {
  if (!exam) return; const d = exam.d.replace(/-/g, ''), [y, m, dd] = exam.d.split('-').map(Number), next = ymd(new Date(y, m - 1, dd + 1)).replace(/-/g, '');
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//wenchang//exam//ZH', 'BEGIN:VEVENT', `UID:${uid}-${d}@wenchang`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${next}`, `SUMMARY:${exam.x}（金榜題名！）`, 'DESCRIPTION:記得帶准考證、文具。考完回線上文昌祠還願。',
    'BEGIN:VALARM', 'TRIGGER:-PT15H', 'ACTION:DISPLAY', `DESCRIPTION:明天就是${exam.x}，早點睡！`, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })); a.download = `${exam.x}.ics`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};

// 每日一籤：每天每支手機固定一支（用日期＋匿名代碼算出來），明天換新的
function dailyLotNo() { let h = 2166136261; for (const ch of uid + today()) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return 1 + ((h >>> 0) % 60); }
$('#daily-lot-btn').onclick = () => { $('#today-dlg').close(); showLot(dailyLotNo(), true); task('lot'); };

// 祈福牆加持：點別人掛的卡
let myBless = store.get('myBless', 0);
const blessing = new Set(), blessOk = new Set(), blessedLocal = new Set();
temple.on('tapWall', c => {
  if (state.busy) return;
  if (!c) { toast('點牆上別人掛的小卡，就能幫他加持 🙏'); return; }
  if (c.mine) { toast(`這是你掛的卡，目前收到 <b>${c.b || 0}</b> 次加持。`); return; }
  if (c.deco || !net.alive) { // 裝飾卡（或沒連線時）只在自己畫面上加持
    if (blessedLocal.has(c)) { toast('這張已經加持過了，換一張吧。'); return; }
    blessedLocal.add(c); blessFx(); task('bless'); return;
  }
  if (blessing.has(c.id)) { toast('這張已經加持過了，換一張吧。'); return; }
  blessing.add(c.id); net.bless(c.id);
});
function blessFx(label) { addStat('bless'); me.emote('bow'); bubble(me, '🙏', 'bubble', 1500); sound.sample('ting', 0.5); buzz(10); toast(label ? `幫這張「${esc(label)}」祈福卡加持了 🙏` : '加持了 🙏 願他金榜題名'); }

// 還願紅榜
let bang = [];
const bangLabel = e => `${e.n || '一位考生'}・${(EXAMS[e.x] || '考試').replace('期中期末考', '期中期末')}`;
function setBang(list) { bang = list; temple.drawBang(bang, bangLabel); renderToday(); }
setBang(store.get('bangLocal', []));
$('#bang-btn').onclick = async () => {
  const x = +$('#bang-exam').value;
  if (!confirm(`確定考上「${EXAMS[x]}」了嗎？\n名字會掛上還願紅榜，廟裡的人都看得到（只顯示${nick ? `暱稱「${nick}」` : '「一位考生」'}和考試）。`)) return;
  if (!net.alive) { const e = { x, n: nick, d: Date.now() }; const l = store.get('bangLocal', []); l.push(e); store.set('bangLocal', l); setBang(l); bangDone(e); return; }
  net.bang(x);
};
function bangDone(e) {
  addStat('bang');
  $('#today-dlg').close(); sound.bell(); sound.chime(); me.emote('jump'); bubble(me, '🎉 金榜題名', 'result-chip', 3000);
  toast(`恭喜考上<b>${esc(EXAMS[e.x])}</b>！名字掛上紅榜了。<button type="button" class="reply" data-share="bang:${e.x}">分享圖卡</button>`, 7000);
  temple.focus = new THREE.Vector3(18.6, 2, 1.8); setTimeout(() => { temple.focus = null; }, 2200);
}
temple.on('tapBang', () => openToday('bang'));

// 今日面板
function openToday(part) {
  renderToday(); const d = $('#today-dlg'); d.showModal();
  const box = { bang: '#bang-box', reward: '#reward-box', tasks: '#task-list' }[part];
  if (box) setTimeout(() => $(box).scrollIntoView({ block: 'start' }), 60); else d.scrollTop = 0;
}
$('#today-btn').onclick = () => openToday();
// 任務清單（今日面板、左上小卡、每日第一次的清單共用）
function taskItems(withGo = true) {
  return tasksOf().map(t => { const ok = !!daily.t[t.id], p = t.need && !ok ? `（${daily.c?.[t.id] ?? (t.id === 'bless' ? daily.bless || 0 : 0)}/${t.need}）` : '';
    return `<li class="${ok ? 'ok' : ''}"><i>${ok ? '✓' : ''}</i><span>${t.name}${p}</span>${ok || !withGo ? '' : `<button type="button" data-go="${t.go}">前往</button>`}</li>`; }).join('');
}
function goTask(go) {
  $('#today-dlg').open && $('#today-dlg').close(); $('#tasks-dlg').open && $('#tasks-dlg').close();
  if (go === 'lot') { showLot(dailyLotNo(), true); task('lot'); }
  else if (go === 'social') openSocial();
  else if (['study', 'lamp', 'pool', 'photo', 'jiaobei', 'grove', 'forest', 'sky', 'koi', 'hunt'].includes(go)) { if (go === 'grove' && myTree()) act('water' + myTree().i); else act(go); }
  else if (go === 'cushion' || go === 'wall') {
    if (state.busy) return; state.busy = true;
    arrive(go).then(ok => { if (ok) toast(go === 'cushion' ? '按「叩拜」拜三拜。' : '點牆上別人掛的小卡幫他加持 🙏'); }).finally(() => { state.busy = false; refresh(); });
  }
}
['#task-list', '#task-mini', '#tasks-intro'].forEach(sel => $(sel).addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) goTask(b.dataset.go); }));
$('#task-chip').onclick = e => { const open = e.currentTarget.getAttribute('aria-expanded') !== 'true'; e.currentTarget.setAttribute('aria-expanded', open); $('#task-mini').hidden = !open; store.set('taskOpen', open); };
if (store.get('taskOpen', false)) { $('#task-chip').setAttribute('aria-expanded', 'true'); $('#task-mini').hidden = false; }
// 獎勵：稱號、特效、配件、限定服裝
function renderRewards() {
  const s = stat(), f = feast();
  // 一顆獎勵按鈕：v=0 是「不使用」；沒解鎖就鎖起來並寫出條件；聖誕限定的在活動外、沒拿到就不顯示
  const chip = (kind, key, v, name, cur) => {
    if (!v && kind !== 'outfit') return `<button type="button" data-${key}="0" aria-pressed="${!cur}">${name}</button>`;
    const r = REWARDS.find(x => x.kind === kind && x.v === v); if (!r) return '';
    const open = unlocked(r, s); if (r.fest && !open && !f.on) return '';
    return `<button type="button" data-${key}="${v}" aria-pressed="${cur === v}" ${open ? '' : 'disabled'}>${open ? '' : '🔒 '}${name}${open ? '' : `<small>${r.how}</small>`}</button>`;
  };
  $('#ttl-list').innerHTML = TITLES.map((t, v) => chip('title', 'ttl', v, t.name, look.ttl | 0)).join('');
  $('#fx-list').innerHTML = FXS.map((n, v) => chip('fx', 'fx', v, n, look.fx | 0)).join('');
  $('#acc-list').innerHTML = ACCS.map((n, v) => chip('acc', 'acc', v, n, look.acc | 0)).join('');
  $('#outfit-list').innerHTML = OUTFITS.map((o, v) => o.locked ? chip('outfit', 'outfit', v, o.name, look.outfit) : '').join('');
  const all = REWARDS.filter(r => !r.fest || unlocked(r, s) || f.on), got = all.filter(r => unlocked(r, s)).length;
  $('#reward-count').textContent = `${got} / ${all.length}`;
  const nx = REWARDS.filter(r => !unlocked(r, s) && r.need.days).sort((a, b) => a.need.days - b.need.days)[0];
  $('#next-reward').textContent = nx ? `下一個獎勵：再完成 ${nx.need.days - s.days} 天每日任務，可得${rewardName(nx)}。` : '每日任務的獎勵都拿到了，真厲害！';
}
$('#reward-box').addEventListener('click', e => {
  const b = e.target.closest('button[data-ttl],button[data-fx],button[data-acc],button[data-outfit]'); if (!b || b.disabled) return;
  const k = ['ttl', 'fx', 'acc', 'outfit'].find(x => b.dataset[x] != null); setLook({ ...look, [k]: +b.dataset[k] }); renderToday();
  toast('換好了，大家都看得到。', 1600);
});
// 每天第一次進廟：跳出今天的任務
function showTasksIntro() {
  if (store.get('introDay', '') === today()) return;
  if (document.querySelector('dialog[open]') || !$('#celebrate').hidden) { setTimeout(showTasksIntro, 1500); return; }
  store.set('introDay', today());
  const s = stat(), nx = REWARDS.filter(r => !unlocked(r, s) && r.need.days).sort((a, b) => a.need.days - b.need.days)[0];
  $('#tasks-sub').textContent = s.days ? `你已經累積 ${s.days} 天了，今天也一起加油！` : '每天換新的任務，完成四項算一天，累積天數可以解鎖獎勵。';
  $('#tasks-intro').innerHTML = taskItems(false);
  $('#tasks-reward').textContent = nx ? `🏅 ${nx.need.days - s.days <= 1 ? '今天完成就能' : `再 ${nx.need.days - s.days} 天`}解鎖${rewardName(nx)}` : '';
  $('#tasks-dlg').showModal();
}
$('#tasks-more').onclick = () => { $('#tasks-dlg').close(); openToday('reward'); };
function renderToday() {
  freshDaily(); const f = feast();
  $('#today-date').textContent = today().replace(/-/g, '/');
  // 頂端按鈕：有設定考試就顯示倒數
  const n = exam ? daysTo(exam.d) : null;
  $('#today-label').textContent = exam ? (n > 0 ? `${exam.x} ${n} 天` : n === 0 ? `今天${exam.x}！` : '考完了？來還願') : f.on ? '文昌聖誕' : '今日';
  // 手機窄螢幕用短字，右上角的按鈕才不會被擠出畫面
  $('#today-short').textContent = exam ? (n > 0 ? `${n}天` : n === 0 ? '今天考' : '還願') : f.on ? '聖誕' : '今日';
  $('#today-btn').setAttribute('aria-label', `${$('#today-label').textContent}：考試倒數、每日一籤、每日任務`);
  $('#today-btn').classList.toggle('fest', f.on);
  const list = tasksOf(), left = tasksLeft(); $('#today-dot').hidden = !left; $('#dock-task-dot').hidden = !left;
  $('#exam-count').innerHTML = exam ? (n > 0 ? `距離 ${esc(exam.x)} 還有<b>${n}</b>天` : n === 0 ? `<b>今天</b>就是 ${esc(exam.x)}，加油！` : `${esc(exam.x)}已經考完了，辛苦了！`) : '還沒設定考試日期。';
  if (exam) { $('#exam-name').value = exam.x; $('#exam-date').value = exam.d; }
  $('#exam-clear').hidden = $('#exam-ics').hidden = !exam;
  const done = !!daily.t.lot; $('#daily-lot-btn').textContent = done ? '再看一次今日一籤' : '抽今日一籤';
  $('#daily-lot-text').textContent = done ? `今天抽到第 ${dailyLotNo()} 籤，明天再來換新的。` : '每天可以抽一支屬於你的籤，明天再來換新的。';
  $('#task-count').textContent = `${list.length - left} / ${list.length}`;
  const html = taskItems(); $('#task-list').innerHTML = html; $('#task-mini').innerHTML = html;
  $('#task-chip-n').textContent = left ? `${list.length - left} / ${list.length}` : '完成 ✓'; $('#task-chip').classList.toggle('done', !left);
  if (stats.wk !== weekKey()) { stats.wk = weekKey(); stats.wd = 0; store.set('stats', stats); }
  $('#focus-line').textContent = `📖 ${focusText()}`;
  $('#week-line').textContent = `本週已完成 ${Math.min(stats.wd || 0, 7)} 天（${WEEK_GOAL} 天可得稱號「本週全勤」）。`;
  renderRewards();
  const days = store.get('days', 0), streak = store.get('streak', 0), last = store.get('lastDay', '');
  const alive = last && dayNum(today()) - dayNum(last) <= 1;
  $('#task-days').textContent = days ? `已累積完成 ${days} 天${alive && streak > 1 ? `，連續 ${streak} 天` : ''}。` : '四項都完成算一天，累積天數可以解鎖稱號、特效和服裝。';
  $('#bless-mine').textContent = store.get('card', null) || myBless ? `你掛的祈福卡共收到 ${myBless} 次加持。` : '還沒掛祈福卡。完成參拜第七步就能掛上去。';
  $('#bang-list').innerHTML = bang.length ? bang.slice(-30).reverse().map(e => `<li>${esc(bangLabel(e))}<small>${new Date(e.d).toLocaleDateString('zh-TW')}</small></li>`).join('') : '<li>還沒有人還願，等你來當第一個！</li>';
  const fb = $('#fest-box'); fb.hidden = !f.date && !f.on;
  if (f.on) fb.innerHTML = `<h3>🎊 文昌帝君聖誕活動中</h3><p class="say">農曆二月初三是文昌帝君聖誕${f.n > 0 && f.n <= FEAST_DAYS_BEFORE ? `（還有 ${f.n} 天）` : f.n === 0 ? '，就是今天' : ''}。殿前掛起紅布條和燈籠，活動期間完成每日任務，可以拿到限定配件「魁星金冠」！</p>`;
  else if (f.date) fb.innerHTML = `<h3>🏮 文昌帝君聖誕倒數</h3><p class="say">農曆二月初三（國曆 ${f.date.replace(/-/g, '/')}）還有 <b>${f.n}</b> 天。聖誕前後會有限定活動與配件。</p>`;
}

// 分享圖卡：圖片上不放網址，分享的文字才附上連結
async function shareImage(kind, x) {
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1350; const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 0, 1350); bg.addColorStop(0, '#7a1a12'); bg.addColorStop(1, '#2a0c08'); g.fillStyle = bg; g.fillRect(0, 0, 1080, 1350);
  g.strokeStyle = '#e8c15a'; g.lineWidth = 12; g.strokeRect(46, 46, 988, 1258); g.lineWidth = 3; g.strokeRect(72, 72, 936, 1206);
  g.textAlign = 'center'; g.fillStyle = '#f6dc94'; g.font = '700 40px "Noto Serif TC",serif'; g.fillText('線 上 文 昌 祠', 540, 170);
  const title = kind === 'bang' ? '金榜題名' : '參拜完成', sub = kind === 'bang' ? `考上 ${EXAMS[x] || ''}，回來還願` : `第 ${store.get('rounds', 1)} 次完整參拜文昌帝君`;
  g.fillStyle = '#fff4d6'; g.font = '900 150px "Noto Serif TC",serif'; g.fillText(title, 540, 470);
  g.fillStyle = '#f6dc94'; g.font = '700 50px "Noto Serif TC",serif'; g.fillText(sub, 540, 580);
  if (nick) { g.fillStyle = '#fff4d6'; g.font = '700 46px "Noto Serif TC",serif'; g.fillText(nick, 540, 680); }
  const ex = exam && daysTo(exam.d) > 0 && kind !== 'bang' ? `距離${exam.x}還有 ${daysTo(exam.d)} 天` : '';
  g.font = '500 40px "Noto Serif TC",serif'; g.fillStyle = '#ffe9b0';
  [ex, kind === 'bang' ? '感謝文昌帝君保佑' : '祝考試頭腦清楚、下筆順利'].filter(Boolean).forEach((t, i) => g.fillText(t, 540, 830 + i * 70));
  g.fillStyle = '#e8c15a'; g.beginPath(); g.arc(540, 1080, 70, 0, 7); g.fill(); g.fillStyle = '#7a1a12'; g.font = '900 80px "Noto Serif TC",serif'; g.fillText(kind === 'bang' ? '榜' : '文', 540, 1108);
  g.font = '500 26px sans-serif'; g.fillStyle = '#c9a874'; g.fillText('非官方教育作品', 540, 1250);
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  const file = new File([blob], `文昌祠-${title}.png`, { type: 'image/png' });
  const link = location.origin + location.pathname, text = `${title}！一起來線上文昌祠拜拜：${link}`;
  try { if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text }); return; } } catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('圖卡已存到手機。');
}
$('#done-share').onclick = () => shareImage('done');
$('#toast').addEventListener('click', e => { const b = e.target.closest('[data-share]'); if (b) { const [k, x] = b.dataset.share.split(':'); shareImage(k, +x); } });

// 進廟時：聖誕活動、提醒今天還有每日任務
function startToday() {
  const f = feast(); temple.setFestival(f.on);
  renderToday(); setTimeout(showTasksIntro, 2600);
  resetTreasures(); // 每天換藏寶的地方
  if (f.on) setTimeout(() => { feed('🎊 文昌帝君聖誕活動中！完成每日任務可得限定配件'); }, 2500);
  else if (exam && daysTo(exam.d) >= 0 && daysTo(exam.d) <= 7) setTimeout(() => feed(`⏳ 距離${exam.x}只剩 ${daysTo(exam.d)} 天，加油！`), 2500);
}
// 跨過午夜也會換新的每日任務
setInterval(() => { if (daily.d !== today()) { freshDaily(); startToday(); } }, 60000);

// ---------- 廣場：讀書角、光明燈、許願池、合照打卡 ----------
// 讀書角：坐下來專注計時，頭上顯示 📖；本機測試加 ?fast 會把分鐘當秒
const MIN_MS = location.hostname === 'localhost' && new URLSearchParams(location.search).has('fast') ? 1000 : 60000;
let studyAt = null, focusEnd = 0, focusStart = 0, focusMin = 0, focusTimer = 0;
$('#study-mins').innerHTML = FOCUS_MIN.map(m => `<button type="button" data-m="${m}">${m} 分鐘</button>`).join('');
async function study() {
  if (studyAt != null) { focusEnd ? openFocusScreen() : showStudy(); return; }
  me.kneel(false);
  let got = -1;
  for (let k = 0; k < DESKS.length; k++) { if (temple.freeSlot([DESKS[k]], me, DESK_SEAT0 + k) !== 0) continue; if (await takeSeat(DESK_SEAT0 + k)) { got = k; break; } }
  if (got < 0) { toast('書桌都有人在讀書，等一下再來。'); return; }
  const d = DESKS[got];
  if (!(await temple.walk(me, d.x, d.z, Math.PI))) { leaveSeat(); return; }
  me.root.position.set(d.x, 0, d.z); me.faceTo = Math.PI; me.sit(true); studyAt = got;
  temple.frame(Math.PI, 0.5); showStudy();
}
function showStudy() { document.body.classList.add('studying'); $('#study-ui').hidden = false; $('#study-pick').hidden = !!focusEnd; $('#study-run').hidden = !focusEnd; }
function leaveDesk(msg) {
  if (studyAt == null) return;
  if (focusEnd) stopFocus(false);
  studyAt = null; me.sit(false); $('#study-ui').hidden = true; document.body.classList.remove('studying'); if (msg) toast(msg);
}
$('#study-mins').onclick = e => {
  const b = e.target.closest('[data-m]'); if (!b) return;
  focusMin = +b.dataset.m; focusStart = Date.now(); focusEnd = focusStart + focusMin * MIN_MS;
  net.study(1); showStudy(); tickFocus(); bubble(me, '📖', 'bubble', 1500);
  $('#fs-cheer').textContent = FOCUS_CHEERS[Math.floor(Math.random() * FOCUS_CHEERS.length)];
  openFocusScreen(); playFocusSound();
};
function tickFocus() {
  clearTimeout(focusTimer); if (!focusEnd) return;
  const left = Math.max(0, focusEnd - Date.now()), sec = Math.ceil(left / 1000);
  const t = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
  $('#study-time').textContent = t; $('#fs-time').textContent = t;
  if (left <= 0) { stopFocus(true); return; }
  focusTimer = setTimeout(tickFocus, 500);
}
// 結束：完成就算一輪；提早結束也把專注過的分鐘記下來
function stopFocus(done) {
  clearTimeout(focusTimer);
  const mins = done ? focusMin : Math.floor((Date.now() - focusStart) / MIN_MS);
  focusEnd = 0; net.study(0, mins); addFocusMinutes(mins); stopFocusSound(); closeFocusScreen();
  if (studyAt != null) showStudy();
  if (done) { sound.bell(); buzz([30, 80, 30]); addStat('study'); toast(`專注 ${focusMin} 分鐘完成！休息一下再繼續。`, 4000); task('study'); }
}
$('#study-stop').onclick = () => { stopFocus(false); toast('這輪專注提早結束了。'); };
$('#study-back').onclick = () => openFocusScreen();
$('#study-leave').onclick = () => { leaveDesk(); leaveSeat(); me.root.position.z += 0.9; };

// 全螢幕專注畫面：蓋住整個遊戲，點到哪裡都不會走動；按住「解鎖」1 秒才回到廟裡
function openFocusScreen() { $('#focus-screen').hidden = false; temple.lockMove = true; renderFocusScreen(); }
function closeFocusScreen() { $('#focus-screen').hidden = true; temple.lockMove = false; }
(() => {
  const btn = $('#fs-unlock'), bar = $('#fs-hold'); let t0 = 0, raf = 0;
  const step = () => { const k = Math.min(1, (performance.now() - t0) / 1000); bar.style.width = k * 100 + '%'; if (k >= 1) { end(); closeFocusScreen(); buzz(15); return; } raf = requestAnimationFrame(step); };
  const end = () => { cancelAnimationFrame(raf); t0 = 0; bar.style.width = '0%'; };
  btn.addEventListener('pointerdown', e => { e.preventDefault(); t0 = performance.now(); raf = requestAnimationFrame(step); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => btn.addEventListener(ev, end));
  btn.addEventListener('contextmenu', e => e.preventDefault());
})();

// 專注聲音：靈犀配樂或環境聲，用原生 <audio> 循環播放；專注時先暫停廟裡的背景音樂
const focusAudio = new Audio(); focusAudio.loop = true; focusAudio.preload = 'none';
let focusSnd = store.get('focusSnd', 'rain'), musicWas = false;
function playFocusSound() {
  const s = FOCUS_SOUNDS.find(x => x.k === focusSnd) || FOCUS_SOUNDS[0];
  if (music.playing) { musicWas = true; music.pause(); }
  if (!s.src || !sound.on) { focusAudio.pause(); return; }
  if (!focusAudio.src.endsWith(s.src)) focusAudio.src = s.src;
  focusAudio.volume = s.vol ?? 0.8; focusAudio.play().catch(() => {});
}
function stopFocusSound() { focusAudio.pause(); if (musicWas) { musicWas = false; music.play(); } }
$('#fs-sounds').onclick = e => {
  const b = e.target.closest('[data-snd]'); if (!b) return;
  focusSnd = b.dataset.snd; store.set('focusSnd', focusSnd); playFocusSound(); renderFocusScreen();
  if (!sound.on && focusSnd !== 'none') toast('右上角喇叭目前是關的，打開後才聽得到。');
};

// 專注紀錄：今天、本週、累積
// 今日面板在載入時就會畫，所以這裡用函式（不用 const），才不會還沒定義就被呼叫
function readFocusLog() { return store.get('focusLog', { d: '', day: 0, wk: '', week: 0, total: 0 }); }
function addFocusMinutes(m) {
  if (!m) return;
  const focusLog = readFocusLog();
  if (focusLog.d !== today()) { focusLog.d = today(); focusLog.day = 0; }
  if (focusLog.wk !== weekKey()) { focusLog.wk = weekKey(); focusLog.week = 0; }
  focusLog.day += m; focusLog.week += m; focusLog.total += m; store.set('focusLog', focusLog);
  if (!net.alive) { focusAll += m; drawStudyBoard(); }
  renderToday();
}
function focusText() {
  const focusLog = readFocusLog(), day = focusLog.d === today() ? focusLog.day : 0, week = focusLog.wk === weekKey() ? focusLog.week : 0;
  return `今天專注 ${day} 分鐘・本週 ${week} 分鐘・累積 ${focusLog.total} 分鐘`;
}
// 一起專注：今天全廟累計的專注分鐘、現在有幾個人在讀書
let focusAll = 0;
const studyingNow = () => [...remotes.values()].filter(av => av.study).length + (focusEnd ? 1 : 0);
function drawStudyBoard() { temple.drawStudyBoard(focusAll, studyingNow()); }
function renderFocusScreen() {
  if ($('#focus-screen').hidden) return;
  let grp = '';
  $('#fs-sounds').innerHTML = FOCUS_SOUNDS.map(s => { const g = s.group !== grp ? `<p class="grp">${s.group}</p>` : ''; grp = s.group; return `${g}<button type="button" data-snd="${s.k}" aria-pressed="${s.k === focusSnd}">${s.zh}</button>`; }).join('');
  const n = studyingNow();
  $('#fs-together').textContent = `${n > 1 ? `現在有 ${n} 人和你一起讀書・` : ''}今天大家一共專注了 ${focusAll} 分鐘`;
  $('#fs-stats').textContent = focusText();
}
setInterval(() => { drawStudyBoard(); renderFocusScreen(); }, 5000);

// 光明燈：殿內左牆，點亮七天、顯示暱稱
let lamps = [];
const lampLabel = e => e.n || '考生';
function setLamps(l) { lamps = l; temple.drawLamps(l, lampLabel); }
setLamps(store.get('lampLocal', []).filter(e => Date.now() - e.d < 7 * 864e5));
$('#lamp-exam').innerHTML = '<option value="-1">祈福（不指定考試）</option>' + EXAMS.map((x, i) => `<option value="${i}">${x}</option>`).join('');
async function lampAct() {
  if (!(await arrive('lamp'))) return;
  if (exam) $('#lamp-exam').value = EXAMS.indexOf(exam.x);
  $('#lamp-note').textContent = `殿內目前亮著 ${lamps.length} 盞。一支手機一次亮一盞，再點會換新、重新亮七天。${nick ? '' : '沒有暱稱的話會顯示「考生」。'}`;
  const dlg = $('#lamp-dlg');
  const ok = await new Promise(res => { $('#lamp-ok').onclick = () => dlg.close('ok'); dlg.onclose = () => res(dlg.returnValue === 'ok'); dlg.returnValue = ''; dlg.showModal(); });
  if (!ok) return;
  const x = +$('#lamp-exam').value;
  if (!net.alive) { const l = store.get('lampLocal', []).filter(e => Date.now() - e.d < 7 * 864e5 && !e.mine); l.push({ x, n: nick, d: Date.now(), mine: 1 }); store.set('lampLocal', l); setLamps(l); lampDone(); return; }
  net.lamp(x);
}
function lampDone() {
  addStat('lamp'); sound.bell(0.15); me.emote('bow'); bubble(me, '🏮', 'bubble', 2000); toast('點亮了一盞光明燈，會亮七天。');
  temple.focus = new THREE.Vector3(-14.7, 2.4, -8.25); setTimeout(() => { temple.focus = null; }, 2400);
  task('lamp');
}
temple.on('tapLamp', () => act('lamp'));
temple.on('tapPlace', id => act(id));

// 走到這些地方附近，畫面下方會出現大按鈕，按了就開始（不用知道要點名牌）
const PLACES = [
  { id: 'study', x: -11, z: 5, r: 5.6, label: '📖 坐下來讀書' },
  { id: 'pool', x: -10, z: 14.4, r: 3.8, label: '🪙 投許願幣許願' },
  { id: 'photo', x: 4, z: 11, r: 2.6, label: '📸 合照打卡' },
  { id: 'lamp', x: -13.4, z: -8.25, r: 2.4, label: '🏮 點光明燈' },
  { id: 'lingxi', x: 16.3, z: 14.6, r: 3, label: '🔮 打開靈犀占卜' },
  { id: 'bang', x: 16.4, z: 1.8, r: 3, label: '🏮 看還願紅榜' },
  { id: 'qian', x: 6.4, z: -16.4, r: 1.8, label: '🎋 求籤' },
];
let nearId = '';
function nearCheck() {
  const p = me.root.position;
  const blocked = state.busy || studyAt != null || document.body.classList.contains('photo-mode') || document.body.classList.contains('chatting') || !!document.querySelector('dialog[open]') || !$('#lingxi-ui').hidden;
  const dyn = blocked ? null : nearOutside(p);
  const pl = dyn || (blocked ? null : PLACES.find(q => Math.hypot(p.x - q.x, p.z - q.z) < q.r)), id = pl?.id || '';
  nearFn = pl?.fn || null;
  if (id === nearId) return;
  nearId = id; const b = $('#near-btn'); b.hidden = !pl;
  if (pl) { b.textContent = pl.label; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
}
let nearFn = null;
$('#near-btn').onclick = () => { const id = nearId; if (!id) return; if (nearFn) nearFn(); else if (id === 'bang') openToday('bang'); else act(id); };

// 許願池：願望只留在這一頁，只告訴大家「有人投了許願幣」
let wishes = 0, lastWishFeed = 0;
async function wishAct() {
  if (!(await arrive('pool'))) return;
  $('#wish-text').value = ''; $('#wish-count').textContent = wishes ? `池子裡已經有 ${wishes} 枚大家的許願幣。` : '';
  const dlg = $('#wish-dlg');
  const ok = await new Promise(res => { $('#wish-ok').onclick = () => dlg.close('ok'); dlg.onclose = () => res(dlg.returnValue === 'ok'); dlg.returnValue = ''; dlg.showModal(); });
  if (!ok) return;
  const w = $('#wish-text').value.trim().slice(0, 40); $('#wish-text').value = '';
  me.emote('bow'); await wait(500);
  await temple.tossCoin(me.root.position); sound.sample('ting', 0.6); buzz(15);
  bubble(me, '🪙 許下心願', 'bubble', 2200);
  net.wish(); if (!net.alive) wishes++;
  addStat('wish'); toast(w ? `許下心願：「${esc(w)}」` : '許下心願了，願望會實現的。', 3200);
  task('wish');
}

// 合照打卡：鏡頭轉到正面、倒數三秒、拍下來加上相框
let photoBlob = null;
async function photoAct() {
  if (!(await arrive('photo'))) return;
  const t = temple, saved = { d: t.camDist, p: t.camPitch }, P = me.root.position;
  me.faceTo = 0; me.kneel(false);
  t.camYaw = t.camYawTarget = 0; t.camPitch = 0.12; t.camDist = 5.6; t.focus = new THREE.Vector3(P.x, 1.6, P.z - 2.5);
  document.body.classList.add('photo-mode');
  const cnt = $('#photo-count'); cnt.hidden = false;
  for (const n of [3, 2, 1]) { cnt.textContent = n; sound.sample('ting', 0.3); if (n === 1) me.emote('thumb'); await wait(850); }
  cnt.hidden = true;
  t.renderer.render(t.scene, t.camera); const shot = t.renderer.domElement.toDataURL('image/jpeg', 0.92);
  $('#flash').hidden = false; setTimeout(() => { $('#flash').hidden = true; }, 500); sound.clack(1);
  document.body.classList.remove('photo-mode'); t.focus = null; t.camDist = saved.d; t.camPitch = saved.p;
  const names = [nick || '我', ...[...remotes].filter(([, av]) => av.root.visible && Math.hypot(av.root.position.x - P.x, av.root.position.z - P.z) < 4).map(([id]) => who(id))].slice(0, 6);
  photoBlob = await photoCard(shot, names);
  $('#photo-img').src = URL.createObjectURL(photoBlob); $('#photo-dlg').showModal();
  task('photo');
}
async function photoCard(src, names) {
  const img = new Image(); img.src = src; await img.decode();
  const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.fillStyle = '#7a1a12'; g.fillRect(0, 0, W, H);
  const bx = 40, by = 40, bw = 1000, bh = 1090, k = Math.max(bw / img.width, bh / img.height), w = img.width * k, h = img.height * k;
  g.save(); g.beginPath(); g.rect(bx, by, bw, bh); g.clip(); g.drawImage(img, bx + (bw - w) / 2, by + (bh - h) / 2, w, h); g.restore();
  g.strokeStyle = '#e8c15a'; g.lineWidth = 8; g.strokeRect(bx, by, bw, bh);
  g.fillStyle = '#f6dc94'; g.textAlign = 'center'; g.font = '900 64px "Noto Serif TC",serif'; g.fillText('文昌祠・合照打卡', W / 2, 1212);
  g.font = '500 34px "Noto Serif TC",serif'; g.fillStyle = '#fff4d6'; g.fillText(`${names.join('、')}　${today().replace(/-/g, '/')}`.slice(0, 42), W / 2, 1278);
  return new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
}
// 分享或存檔：圖片上不放網址，分享的文字才附連結
async function shareBlob(blob, name, msg) {
  const file = new File([blob], name, { type: blob.type }), text = `${msg}一起來線上文昌祠：${location.origin + location.pathname}`;
  try { if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text }); return; } } catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('圖片已存到手機。');
}
$('#photo-share').onclick = () => { if (photoBlob) shareBlob(photoBlob, '文昌祠合照.jpg', '在線上文昌祠合照打卡！'); };

// ---------- 排行榜：專注時間、在廟裡的時間（今日／本週／總榜） ----------
let rankOn = store.get('rankOn', true), board = null, rankKind = 'focus', rankPer = 'd';
net.rankOn = rankOn; $('#rank-allow').checked = rankOn;
$('#rank-allow').onchange = e => { rankOn = e.target.checked; store.set('rankOn', rankOn); net.rank(rankOn); toast(rankOn ? '會用你的暱稱顯示在排行榜。' : '不會顯示在排行榜，自己的紀錄還是看得到。'); };
const fmtMin = m => m >= 60 ? `${Math.floor(m / 60)} 小時${m % 60 ? ` ${m % 60} 分` : ''}` : `${m} 分鐘`;
function openRank() {
  if ($('#today-dlg').open) $('#today-dlg').close(); hideSocial();
  $('#rank-dlg').showModal();
  if (net.alive) { net.board(); if (!board) $('#rank-list').innerHTML = '<li class="empty">讀取中…</li>'; }
  renderRank();
}
function renderRank() {
  document.querySelectorAll('#rank-kind [data-k]').forEach(b => b.setAttribute('aria-selected', b.dataset.k === rankKind));
  document.querySelectorAll('#rank-per [data-p]').forEach(b => b.setAttribute('aria-selected', b.dataset.p === rankPer));
  if (!net.alive) { $('#rank-list').innerHTML = '<li class="empty">連上多人伺服器才看得到排行榜。</li>'; $('#rank-me').textContent = rankKind === 'focus' ? `你的專注：${focusText()}` : ''; return; }
  if (!board) return;
  const b = board[rankKind], list = b[rankPer], me = b.me, medal = ['🥇', '🥈', '🥉'];
  $('#rank-list').innerHTML = list.length ? list.map((e, i) => `<li class="${e.me ? 'me' : ''}"><b>${medal[i] || i + 1}</b><span>${esc(e.n)}${e.me ? '（你）' : ''}</span><em>${fmtMin(e.v)}</em></li>`).join('')
    : `<li class="empty">${rankPer === 'd' ? '今天' : rankPer === 'w' ? '這週' : ''}還沒有人上榜，${rankKind === 'focus' ? '去讀書角專注一輪' : '多在廟裡走走、拜拜'}就能上榜！</li>`;
  const v = me?.[rankPer] || 0, r = me?.['r' + rankPer] || 0;
  $('#rank-me').textContent = board.hidden ? `你設定了不上榜・你的紀錄：${fmtMin(v)}` : v ? `你：${fmtMin(v)}・第 ${r} 名` : `你${rankPer === 'd' ? '今天' : rankPer === 'w' ? '這週' : ''}還沒有紀錄`;
}
$('#rank-kind').onclick = e => { const b = e.target.closest('[data-k]'); if (b) { rankKind = b.dataset.k; renderRank(); } };
$('#rank-per').onclick = e => { const b = e.target.closest('[data-p]'); if (b) { rankPer = b.dataset.p; renderRank(); } };
document.querySelectorAll('.rank-open').forEach(b => b.addEventListener('click', openRank));

// ---------- 加到主畫面：依手機與瀏覽器給不同教學 ----------
let installEvt = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });
addEventListener('appinstalled', () => { installEvt = null; store.set('installed', true); toast('已加到主畫面，下次從桌面的「線上文昌祠」打開！', 4000); renderInstallBtns(); });
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const UA = navigator.userAgent;
const isIOS = /iPhone|iPad|iPod/.test(UA) || (/Macintosh/.test(UA) && navigator.maxTouchPoints > 1);
const inApp = /\bLine\/|FBAN|FBAV|Instagram|MicroMessenger|GSA\//i.test(UA);
const isAndroid = /Android/i.test(UA);
const ICO_SHARE = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3M8 7l4-4 4 4"/><path d="M6 11H5v10h14V11h-1"/></svg>';
const ICO_ADD = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/></svg>';
const ICO_MORE = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/></svg>';
function installSteps() {
  if (isStandalone()) return ['你已經是從主畫面打開的，不用再加了 👍'];
  if (inApp) return [`在 LINE／FB／IG 裡打開的網頁沒辦法加到主畫面。先點右上角的 ${ICO_MORE} 或「⋯」`, `選「<b>用瀏覽器開啟</b>」${isIOS ? '（Safari）' : '（Chrome）'}<span class="note">找不到的話，按下面「複製網址」，再貼到瀏覽器打開。</span>`, '在瀏覽器裡再打開這份教學（左上角 ⓘ「說明」→「看怎麼加」）'];
  if (isIOS) return [`點${/CriOS|EdgiOS|FxiOS/.test(UA) ? '網址列旁邊' : '畫面下方（iPad 在上方）'}的「分享」按鈕 ${ICO_SHARE}`, `往下滑，點「<b>加入主畫面</b>」${ICO_ADD}<span class="note">沒看到的話，在最下面「編輯動作」把它加進來。</span>`, '按右上角「<b>加入</b>」，桌面就會出現「線上文昌祠」'];
  if (installEvt) return ['按下面的「<b>立即安裝</b>」', '在跳出來的視窗按「安裝」，桌面就會出現「線上文昌祠」'];
  if (isAndroid) return [`點右上角的 ${ICO_MORE}`, '選「<b>加到主畫面</b>」或「<b>安裝應用程式</b>」', '按「新增／安裝」，桌面就會出現「線上文昌祠」'];
  return [`電腦版 Chrome／Edge：點網址列右邊的安裝圖示 ${ICO_ADD}，或右上角 ${ICO_MORE} →「安裝線上文昌祠」`, '手機打開這個網址，也可以照著教學加到主畫面'];
}
function openInstall(auto) {
  const steps = installSteps(), done = isStandalone();
  $('#install-steps').className = 'install-steps' + (done ? ' done' : '');
  $('#install-steps').innerHTML = steps.map(s => `<li><span>${s}</span></li>`).join('') + (inApp ? '<li><span><button type="button" class="ghost small" id="install-copy">複製網址</button></span></li>' : '');
  $('#install-go').hidden = !installEvt || done; $('#install-later').hidden = !auto || done;
  $('#install-copy')?.addEventListener('click', () => { navigator.clipboard?.writeText(location.origin + location.pathname).then(() => toast('網址複製好了，貼到瀏覽器打開。')).catch(() => toast(location.origin + location.pathname, 6000)); });
  const d = $('#install-dlg'); if (!d.open) d.showModal();
}
$('#install-go').onclick = async () => { if (!installEvt) return; installEvt.prompt(); const r = await installEvt.userChoice.catch(() => null); installEvt = null; $('#install-dlg').close(); if (r?.outcome !== 'accepted') snoozeInstall(); };
$('#install-ok').onclick = () => { $('#install-dlg').close(); snoozeInstall(); };
$('#install-later').onclick = () => { $('#install-dlg').close(); snoozeInstall(); toast('之後想加，可以在「說明」或「📅 今日」找到「加到主畫面」。', 3600); };
function snoozeInstall() { const s = store.get('installSnooze', { n: 0, t: 0 }); store.set('installSnooze', { n: s.n + 1, t: Date.now() }); }
// 自動提醒：第二次進廟或第一次參拜完成後；按過就隔 7 天，最多 3 次
function maybeInstall(tries = 0) {
  if (isStandalone() || store.get('installed', false)) return;
  const s = store.get('installSnooze', { n: 0, t: 0 }); if (s.n >= 3 || Date.now() - s.t < 7 * 864e5) return;
  if (document.querySelector('dialog[open]') || !$('#celebrate').hidden || state.busy || studyAt != null) { if (tries < 30) setTimeout(() => maybeInstall(tries + 1), 4000); return; }
  openInstall(true);
}
function renderInstallBtns() { const hide = isStandalone(); document.querySelectorAll('.install-open, #splash-install').forEach(b => { b.hidden = hide; }); }
document.querySelectorAll('.install-open, #splash-install').forEach(b => b.addEventListener('click', () => openInstall(false)));
renderInstallBtns();

// 供桌上其他人的供品：連線時是真的考生擺的；人少時補幾份示意的，供桌才不會空蕩蕩
const decoOffers = Array.from({ length: 4 }, (_, i) => ({ items: OFFERINGS.filter((o, k) => (k + i) % 3 === 0).slice(0, 3 + (i % 2) * 2), tk: i % 2 === 0 }));
function setOthersOffers(list) {
  const real = list.filter(o => !o.mine).map(o => ({ items: (o.o || []).map(i => OFFERINGS[i]).filter(Boolean), tk: !!o.tk })).filter(o => o.items.length);
  temple.setOtherOffers([...decoOffers.slice(0, Math.max(0, 4 - real.length)), ...real]);
}
setOthersOffers([]);

// ---------- 廟門外的樹林：金榜樹、天燈、錦鯉、尋寶、拖延怪、考試魔王 ----------
const out = new Outside(temple);
const myTree = () => outTrees.find(t => t.mine);
let outTrees = [];
// 沒連線時：只有自己的樹，存在這支手機
function localTrees() { const t = store.get('treeLocal', null); return t ? [{ i: 0, n: nick, s: t.s, wt: t.d === today() ? 1 : 0, mine: 1 }] : []; }
function setTrees(list) { outTrees = list; out.setTrees(list); const t = myTree(); if (t && t.s > (stats.tree || 0)) { stats.tree = t.s; store.set('stats', stats); checkUnlocks(); } }
setTrees(localTrees());
async function sow() {
  if (myTree()) { const t = myTree(); toast(`你已經有一棵金榜樹了（${t.s} 天），記得每天來澆水。`); await walkToTree(t.i); return; }
  if (!(await arrive('grove'))) return;
  if (!net.alive) { store.set('treeLocal', { s: 0, d: '' }); setTrees(localTrees()); sowed(0); return; }
  net.sow();
}
function sowed(i) {
  sound.chime(); me.emote('bow'); bubble(me, '🌱', 'bubble', 2000);
  celebrate({ big: true, title: '🌱 種下金榜樹了！', sub: '每天來澆一次水，它會長大、開花（第 7 天），第 10 天結出金色的狀元果。也可以幫別人的樹澆水。' });
  const p = PLOTS[i]; temple.focus = new THREE.Vector3(p.x, 1, p.z); setTimeout(() => { temple.focus = null; }, 2500);
}
async function walkToTree(i) { const p = PLOTS[i]; me.faceTo = null; return temple.walk(me, p.x, p.z + 1.1, Math.PI); }
async function water(i) {
  const tr = outTrees.find(t => t.i === i); if (!tr) return;
  if (Math.hypot(me.root.position.x - PLOTS[i].x, me.root.position.z - PLOTS[i].z) > 2 && !(await walkToTree(i))) return;
  me.faceTo = Math.PI; bubble(me, '💧', 'bubble', 1500); out.splash(i); sound.sample('ting', 0.4);
  if (!net.alive) { const t = store.get('treeLocal', { s: 0, d: '' }), grew = t.d !== today(); if (grew) { t.s++; t.d = today(); } store.set('treeLocal', t); setTrees(localTrees()); watered({ i, grew, s: t.s, mine: 1 }); return; }
  net.water(i);
}
function watered(m) {
  task('water');
  if (m.mine) toast(m.grew ? `金榜樹長大了！已經 ${m.s} 天${m.s === 7 ? '，開花了 🌸' : m.s === 10 ? '，結出狀元果了 🍊' : ''}` : '今天已經澆過了，明天再來看它長大。', 3200);
  else toast(m.grew ? '幫別人的金榜樹澆水，它長大了！' : '這棵樹今天已經有人澆過了，謝謝你的好意。', 3000);
}
const nearTree = (p, max = 1.9) => { let best = null, bd = max; for (const t of outTrees) { const q = PLOTS[t.i], d = Math.hypot(p.x - q.x, p.z - q.z); if (d < bd) { bd = d; best = t; } } return best; };
temple.on('tapTree', i => { if (state.busy) return; const t = outTrees.find(x => x.i === i); if (t) act('water' + i); else if (!myTree()) act('grove'); else toast('這裡還沒有人種樹。'); });
temple.on('tapNursery', () => act('grove'));

// 天燈：心願只留在自己手機，大家看到一盞燈飛上天
async function skyAct() {
  if (!(await arrive('sky'))) return;
  $('#sky-text').value = ''; const dlg = $('#sky-dlg');
  const ok = await new Promise(res => { $('#sky-ok').onclick = () => dlg.close('ok'); dlg.onclose = () => res(dlg.returnValue === 'ok'); dlg.returnValue = ''; dlg.showModal(); });
  if (!ok) return;
  const w = $('#sky-text').value.trim().slice(0, 30); $('#sky-text').value = '';
  me.emote('jump'); out.releaseLantern(me.root.position.x, me.root.position.z); net.sky(); sound.chime();
  temple.camPitch = 0.55; addStat('sky'); task('sky');
  toast(w ? `天燈帶著「${esc(w)}」飛上天了。` : '天燈飛上天了，願望會被聽見。', 3200);
}

// 錦鯉池：撒飼料；有機會遇到金色錦鯉躍龍門
async function koiAct() {
  if (!(await arrive('koi'))) return;
  const p = me.root.position, fx = p.x + (KOI.x - p.x) * 0.45, fz = p.z + (KOI.z - p.z) * 0.45;
  const golden = Math.random() < 0.12;
  me.emote('wave'); out.feed(fx, fz, golden); sound.sample('ting', 0.3); task('koi');
  if (golden) setTimeout(() => { sound.bell(); addStat('goldkoi'); celebrate({ big: true, confetti: true, title: '🐟 鯉躍龍門！', sub: '金色錦鯉跳出水面了！好兆頭，考運旺旺。' }); }, 1500);
  else toast('撒了一把飼料，錦鯉都游過來了。', 2400);
}

// 每日尋寶：每天依日期挑 5 個地方藏文房五寶（大家一樣），自己撿到的就不見
function todayTreasures() {
  const r = seeded(dayNum(today()) * 31 + 7), spots = TREASURE_SPOTS.map(s => [r(), s]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  const got = store.get('treasure', { d: '', got: [] }); const mine = got.d === today() ? got.got : [];
  return TREASURE_KINDS.map((k, i) => ({ ...k, x: spots[i][0], z: spots[i][1], got: mine.includes(k.k) }));
}
// 用場景裡的寶物物件（有 3D 模型），按鈕和點擊才會是同一個
let treasures = [];
function resetTreasures() { out.setTreasures(todayTreasures()); treasures = out.treasures; }
resetTreasures();
function pickTreasure(o) {
  if (o.got) return;
  const p = me.root.position; if (Math.hypot(p.x - o.x, p.z - o.z) > 2.2) { toast(`走近一點才撿得到${o.name}。`); return; }
  out.pickTreasure(o); sound.sample('ting', 0.6); buzz(15); bubble(me, `✨ ${o.name}`, 'bubble', 1800);
  const g = store.get('treasure', { d: '', got: [] }); if (g.d !== today()) { g.d = today(); g.got = []; }
  g.got.push(o.k); store.set('treasure', g); task('treasure');
  if (g.got.length === TREASURE_KINDS.length) { addStat('treasure'); celebrate({ big: true, confetti: true, title: '✨ 文房五寶找齊了！', sub: '筆、墨、紙、硯、書卷都到手，明天寶物會藏到新的地方。' }); }
  else toast(`撿到${o.name}！今天還有 ${TREASURE_KINDS.length - g.got.length} 樣寶物藏在附近。`, 2600);
}
temple.on('tapTreasure', o => { if (!state.busy) pickTreasure(o); });
async function hunt() {
  const left = treasures.filter(o => !o.got); if (!left.length) { toast('今天的寶物都找到了，明天再來！'); return; }
  const p = me.root.position, o = left.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
  toast(`往發光的地方走：附近有一個${o.name}。`, 2400); me.faceTo = null; await temple.walk(me, o.x, o.z + 0.8);
}

// 拖延怪：點牠或靠近按按鈕，丟毛筆把牠打跑
let throwing = false;
async function hitMonster(m) {
  if (!m?.alive || throwing) return;
  const p = me.root.position, gp = m.g.position, d = Math.hypot(gp.x - p.x, gp.z - p.z);
  if (d > 7) { me.faceTo = null; const k = (d - 5) / d; await temple.walk(me, p.x + (gp.x - p.x) * k, p.z + (gp.z - p.z) * k); if (!m.alive) return; }
  throwing = true; me.faceTo = Math.atan2(gp.x - p.x, gp.z - p.z); me.emote('wave'); bubble(me, '✏️', 'bubble', 900);
  out.throwBrush(p, { x: gp.x, y: 0.5, z: gp.z }, () => {
    throwing = false; if (!m.alive) return;
    out.defeatMonster(m); sound.clack(1); buzz(15); addStat('monster'); task('monster');
    toast(`打跑了${m.name}！「${m.say}」不要來吵我讀書。`, 2400);
  });
}
temple.on('tapMonster', m => { if (!state.busy) hitMonster(m); });
// 前往打怪：走到離你最近的拖延怪旁邊
async function forest() {
  const p = me.root.position, m = out.nearestMonster(p.x, p.z) ;
  toast('拖延怪在廟外的樹林裡晃來晃去，點牠或按下方按鈕丟毛筆！', 3000); me.faceTo = null;
  if (!m) { await temple.walk(me, OUT_SPOTS.forest.x, OUT_SPOTS.forest.z); return; }
  const gp = m.g.position, d = Math.hypot(gp.x - p.x, gp.z - p.z), k = Math.max(0, (d - 4) / d);
  await temple.walk(me, p.x + (gp.x - p.x) * k, p.z + (gp.z - p.z) * k);
}

// 考試魔王：大家共用一條血，一起打；每天復活
let bossHp = 200, bossMax = 200, bossHitToday = store.get('bossHit', '') === today();
function localBoss() { const b = store.get('bossLocal', { d: '', hp: 30 }); if (b.d !== today()) { b.d = today(); b.hp = 30; } return b; }
if (!net.alive) { const b = localBoss(); out.setBoss(b.hp, 30); }
async function bossAct() {
  const p = me.root.position, d = Math.hypot(p.x - BOSS_AT.x, p.z - BOSS_AT.z);
  if (out.bossHp <= 0) { toast('考試魔王今天已經被大家打倒了，明天牠還會再來！'); return; }
  if (d > 8 && !(await arrive('boss'))) return;
  if (throwing) return; throwing = true;
  me.faceTo = Math.atan2(BOSS_AT.x - p.x, BOSS_AT.z - p.z); me.emote('wave');
  out.throwBrush(p, { x: BOSS_AT.x, y: 1.4, z: BOSS_AT.z }, () => {
    throwing = false; out.hitBoss(); sound.clack(1); buzz(10);
    store.set('bossHit', today()); bossHitToday = true;
    if (!net.alive) { const b = localBoss(); b.hp = Math.max(0, b.hp - 1); store.set('bossLocal', b); out.setBoss(b.hp, 30); if (!b.hp) bossBeat(); return; }
    net.hit();
  });
}
function bossBeat() {
  addStat('boss'); sound.bell(); me.emote('jump');
  celebrate({ big: true, confetti: true, title: '⚔️ 打倒考試魔王了！', sub: '大家一起把考試魔王打跑了！考試那天也會這麼順利。明天牠還會再來。' });
}
temple.on('tapBoss', () => { if (!state.busy) act('boss'); });

// 廟外的「走近就出現按鈕」：寶物 > 種樹 > 澆水 > 魔王 > 拖延怪（拖延怪會亂跑，放最後才不會擋住其他按鈕）
function nearOutside(p) {
  if (p.z < L.GZ - 4) return null;
  const tr = treasures.find(o => !o.got && Math.hypot(p.x - o.x, p.z - o.z) < 1.8);
  if (tr) return { id: 'tr' + tr.k, label: `✨ 撿起${tr.name}`, fn: () => pickTreasure(tr) };
  if (!myTree() && Math.hypot(p.x + 9.5, p.z - 22.4) < 3) return { id: 'sow', label: '🌱 種一棵金榜樹', fn: () => act('grove') };
  const t = nearTree(p);
  if (t) return { id: 'tree' + t.i, label: t.mine ? '💧 幫我的金榜樹澆水' : `💧 幫${t.n || '考生'}的樹澆水`, fn: () => act('water' + t.i) };
  if (Math.hypot(p.x - BOSS_AT.x, p.z - BOSS_AT.z) < 7 && out.bossHp > 0) return { id: 'boss', label: '⚔️ 一起打考試魔王', fn: () => act('boss') };
  const m = out.nearestMonster(p.x, p.z, 7);
  if (m) return { id: 'mo' + m.g.id, label: `✏️ 丟毛筆打${m.name}`, fn: () => hitMonster(m) };
  return null;
}

// 沒有連線時：幾位示意香客在廟裡走動、拜拜
const npcs = [];
let npcGen = 0;
function stopNpcs() { npcGen++; npcs.splice(0).forEach(av => temple.removeAvatar(av)); }
function startNpcs() {
  if (npcs.length || net.alive) return;
  const gen = ++npcGen;
  // 示意香客：拜天公要排到空拜位、拜完就離開；不站在文昌爐前、不佔主拜墊
  const route = ['tiangong', 'tiangong', 'wall', 'counter', 'qianTube', 'jinlu', 'stroll'];
  for (let i = 0; i < 6; i++) {
    const av = temple.addAvatar(new Avatar(randomLook())); av.npc = true; av.speed = 2.2 + Math.random() * 0.8;
    av.root.position.set(-4 + i * 2.6, 0, 7 - i * 2.2);
    npcs.push(av);
    (async function life() {
      await wait(800 + i * 1500);
      while (gen === npcGen) {
        if (Math.random() < 0.4) { // 找個空拜墊跪拜（主拜墊留給玩家）
          const free = CUSHIONS.map((c, k) => k).filter(k => k >= MAIN_CUSHIONS && temple.cushionFree(k, av) && Math.hypot(me.root.position.x - CUSHIONS[k].x, me.root.position.z - CUSHIONS[k].z) > 1);
          const c = CUSHIONS[free[Math.floor(Math.random() * free.length)]];
          if (c && await temple.walk(av, c.x, c.z, Math.PI)) { av.kneel(true); await wait(600); await av.bow(3); await wait(3000 + Math.random() * 4000); av.kneel(false); continue; }
        }
        const go = route[Math.floor(Math.random() * route.length)];
        if (go === 'tiangong') {
          const k = temple.freeSlot(TIANGONG_SLOTS.slice(1), av); // 正中間的拜位留給玩家
          if (k < 0) { await wait(3000); continue; }
          const sl = TIANGONG_SLOTS[k + 1];
          if (await temple.walk(av, sl.x, sl.z, 0)) { av.hold(true); await av.bow(3); av.hold(false); }
          // 拜完就離開，往中庭兩側散開
          await temple.walk(av, (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 8), 3 + Math.random() * 12);
          continue;
        }
        if (go === 'stroll') { await temple.walk(av, (Math.random() - 0.5) * 30, 2 + Math.random() * 14); await wait(2000 + Math.random() * 3000); continue; }
        const s = SPOTS[go], p = temple.freeSpot(s.x + (Math.random() - 0.5) * 2, s.z + (Math.random() - 0.5) * 1.2, s.f, av);
        await temple.walk(av, p.x, p.z, s.f);
        if (Math.random() < 0.6) await av.bow(1 + Math.floor(Math.random() * 2));
        await wait(1500 + Math.random() * 3500);
      }
    })();
  }
}

// ---------- 主迴圈 ----------
function loop() {
  temple.update();
  if (!$('#hud').hidden) {
    placeLabels();
    const p = me.root.position;
    if (myId || look.ttl || focusEnd) tagFor(me, myId ? who(myId) : (nick || '我'), true, look.ttl, !!focusEnd);
    // 人多時只顯示離你最近的 12 個名牌，畫面才不會被名字蓋滿
    const near = [...remotes].map(([id, av]) => [id, av, Math.hypot(av.root.position.x - p.x, av.root.position.z - p.z)]).sort((a, b) => a[2] - b[2]);
    // 人很多時，只畫離你最近的 24 個人（遠處的人藏起來，手機才不會卡）
    const crowd = near.length > 24;
    near.forEach(([id, av, d], k) => {
      av.root.visible = !crowd || (k < 24 && d < 30);
      const el = tagFor(av, who(id), false, av.look?.ttl, av.study); el.classList.toggle('done', (peers.get(id)?.s || 0) >= STEPS.length); el.classList.toggle('far', k >= 12 || d > 14 || !av.root.visible);
    });
    if (studyAt != null && (!mySeat || mySeat.id !== DESK_SEAT0 + studyAt)) leaveDesk(focusEnd ? '離開座位，這輪專注沒有完成。' : '');
    net.pos(p.x, p.z, me.root.rotation.y, me.holding, me.bowT >= 0, me.kneeling);
    // 離開拜墊／拜位／書桌就釋放座位（走過去的路上不算，到了之後再離開才算）
    if (mySeat) { const d = Math.hypot(p.x - mySeat.x, p.z - mySeat.z); if (d < 0.35) mySeat.near = true; else if (mySeat.near && d > 0.7) leaveSeat(); else if (!mySeat.near && !me.target && !me.path?.length && !state.busy) leaveSeat(); }
    $('#kneel-bar').hidden = !me.kneeling || state.busy || studyAt != null;
    document.body.classList.toggle('kneeling', !!me.kneeling);
    nearCheck();
  }
  requestAnimationFrame(loop);
}
temple.on('manualMove', () => { hideCheer(); hideSocial(); hideMusic(); });
refresh();
renderDm();
initUpdates();
requestAnimationFrame(loop);
window.__wc = { temple, me, state, act, net };

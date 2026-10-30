import * as THREE from '../vendor/three.module.min.js';
import { Temple, SPOTS, MARKS, FOCUS, CUSHIONS, TIANGONG_SLOTS, TIANGONG_SEAT0, MAIN_CUSHIONS } from './scene.js';
import { Avatar, randomLook, HAIRS, HAIR_COLORS, SKINS, OUTFITS, GLASSES, ACCS } from './avatar.js';
import { STEPS, EXTRAS, OFFERINGS, TABOO, EXAMS, CARD_COLORS, CHEERS, EMOTES, CHAT_PHRASES, RANK_TIP, RITUAL_NOTE, FACTS, SOURCES, JINZHI, DAILY, ACC_UNLOCK, FEAST_DATES, FEAST_DAYS_BEFORE } from './data.js';
import { Net } from './net.js';
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
if (state.done.has('wenchang')) temple.setOfferings(OFFERINGS.filter(o => state.carry.offerings.includes(o.id)));
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
  ['hair', '髮型', HAIRS.length, v => HAIRS[v]],
  ['hairColor', '髮色', HAIR_COLORS.length, v => `<i class="sw" style="background:${HAIR_COLORS[v]}"></i>`],
  ['skin', '膚色', SKINS.length, v => `<i class="sw" style="background:${SKINS[v]}"></i>`],
  ['outfit', '服裝', OUTFITS.length, v => OUTFITS[v].name],
  ['glasses', '眼鏡', GLASSES.length, v => GLASSES[v]],
];
function renderPicker() {
  document.querySelectorAll('[data-gender]').forEach(b => b.setAttribute('aria-pressed', b.dataset.gender === look.gender));
  $('#customize').innerHTML = parts.map(([k, name, n, fmt]) =>
    `<div class="crow" data-part="${k}"><span>${name}</span><button type="button" data-d="-1" aria-label="上一個${name}">◀</button><b>${fmt(look[k] % n)}</b><button type="button" data-d="1" aria-label="下一個${name}">▶</button></div>`).join('');
}
function setLook(l) { look = l; store.set('look', l); me.setLook(l); me.hold(state.carry.incense); net.setLook(l); renderPicker(); }
document.querySelectorAll('[data-gender]').forEach(b => b.onclick = () => setLook({ ...randomLook(b.dataset.gender), acc: look.acc | 0 }));
$('#pick-shuffle').onclick = () => setLook({ ...randomLook(look.gender), acc: look.acc | 0 });
$('#pick-custom').onclick = e => { const open = $('#customize').hidden; $('#customize').hidden = !open; e.currentTarget.setAttribute('aria-expanded', open); };
$('#customize').onclick = e => {
  const b = e.target.closest('button'); if (!b) return; const row = b.closest('.crow'), k = row.dataset.part, n = parts.find(p => p[0] === k)[2];
  setLook({ ...look, [k]: (look[k] + +b.dataset.d + n) % n });
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
  + EXTRAS.map(s => `<button type="button" data-act="${s.id}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[s.id]}</svg><span>${s.dock}</span></button>`).join('');
$('#dock').onclick = e => { const b = e.target.closest('button'); if (b) act(b.dataset.act); };
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
function tagFor(av, text, mine) {
  let el = tags.get(av);
  if (!el) { el = document.createElement('button'); el.type = 'button'; el.className = 'tag' + (mine ? ' me' : ''); labelsEl.appendChild(el); tags.set(av, el); el.onclick = () => openCheer(av); }
  if (el.textContent !== text) el.textContent = text;
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
  const fn = { prepare, heaven, wenchang, plant, pass, jinzhi, card, jiaobei, qian, lingxi }[id];
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
const seatPos = id => id >= TIANGONG_SEAT0 ? TIANGONG_SLOTS[id - TIANGONG_SEAT0] : CUSHIONS[id];
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
    if (mySeat && mySeat.id >= TIANGONG_SEAT0) ok = true;
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
  temple.setOfferings(OFFERINGS.filter(o => state.carry.offerings.includes(o.id)));
  toast('供品擺上供桌了。', 1800);
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
  $('#lx-frame').src = url; $('#lx-out').href = url; $('#lx-frame').hidden = false; $('#lx-menu').hidden = true; $('#lx-back').hidden = false;
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
      blessing.clear(); blessOk.clear(); if (m.bang) setBang(m.bang);
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
        av.hold(!!p.h); av.kneel(!!p.k); if (p.b && av.bowT < 0) av.bow(1);
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
    else if (m.t === 'slow') { if (m.kind === 'bless') { blessing.clear(); } toast(m.kind === 'card' ? '祈福卡剛掛過，等一下再換。' : m.kind === 'bang' ? '剛剛才還願過，等一分鐘再試。' : m.kind === 'bless' ? '加持慢一點，一張一張來。' : '慢一點喔，稍等一下再送。'); }
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
let daily = store.get('daily', null);
const freshDaily = () => { if (!daily || daily.d !== today()) daily = { d: today(), t: {}, bless: 0 }; return daily; };
freshDaily();
const saveDaily = () => store.set('daily', daily);
function task(id, n = 1) {
  freshDaily(); if (daily.t[id]) return;
  const def = DAILY.find(x => x.id === id);
  if (def.need) { daily.bless = (daily.bless || 0) + n; if (daily.bless < def.need) { saveDaily(); renderToday(); return; } }
  daily.t[id] = 1; saveDaily();
  const left = DAILY.filter(x => !daily.t[x.id]).length;
  toast(left ? `✅ 每日任務：${def.name}（還有 ${left} 項）` : '🎉 今天的每日任務全部完成！', 3000); sound.chime();
  if (!left) dayDone();
  renderToday();
}
function dayDone() {
  const prev = store.get('lastDay', ''), days = store.get('days', 0) + 1;
  const streak = prev && dayNum(today()) - dayNum(prev) === 1 ? store.get('streak', 0) + 1 : 1;
  store.set('days', days); store.set('lastDay', today()); store.set('streak', streak);
  const got = ACC_UNLOCK.filter(u => u.days === days).map(u => u.acc);
  if (feast().on && !store.get('accFest', false)) { store.set('accFest', true); got.push(3); }
  if (got.length) setTimeout(() => toast(`解鎖新配件：<b>${got.map(a => ACCS[a]).join('、')}</b>！到「📅 今日」戴上它。`, 5000), 3200);
}
const accOpen = a => a === 0 || (a === 3 ? store.get('accFest', false) : store.get('days', 0) >= ACC_UNLOCK.find(u => u.acc === a).days);

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
function blessFx(label) { me.emote('bow'); bubble(me, '🙏', 'bubble', 1500); sound.sample('ting', 0.5); buzz(10); toast(label ? `幫這張「${esc(label)}」祈福卡加持了 🙏` : '加持了 🙏 願他金榜題名'); }

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
  $('#today-dlg').close(); sound.bell(); sound.chime(); me.emote('jump'); bubble(me, '🎉 金榜題名', 'result-chip', 3000);
  toast(`恭喜考上<b>${esc(EXAMS[e.x])}</b>！名字掛上紅榜了。<button type="button" class="reply" data-share="bang:${e.x}">分享圖卡</button>`, 7000);
  temple.focus = new THREE.Vector3(18.6, 2, 1.8); setTimeout(() => { temple.focus = null; }, 2200);
}
temple.on('tapBang', () => openToday('bang'));

// 今日面板
function openToday(part) {
  renderToday(); const d = $('#today-dlg'); d.showModal();
  if (part === 'bang') setTimeout(() => $('#bang-box').scrollIntoView({ block: 'start' }), 60); else d.scrollTop = 0;
}
$('#today-btn').onclick = () => openToday();
$('#task-list').onclick = e => {
  const b = e.target.closest('[data-go]'); if (!b) return; const go = b.dataset.go; $('#today-dlg').close();
  if (go === 'lot') { showLot(dailyLotNo(), true); task('lot'); }
  else if (go === 'social') openSocial();
  else if (go === 'cushion') { if (!state.busy) { state.busy = true; arrive('cushion').then(ok => { if (ok) toast('按「叩拜」拜三拜。'); }).finally(() => { state.busy = false; refresh(); }); } }
  else if (go === 'wall') { if (!state.busy) { state.busy = true; arrive('wall').then(ok => { if (ok) toast('點牆上別人掛的小卡幫他加持 🙏'); }).finally(() => { state.busy = false; refresh(); }); } }
};
$('#acc-list').onclick = e => { const b = e.target.closest('[data-acc]'); if (!b || b.disabled) return; setLook({ ...look, acc: +b.dataset.acc }); renderToday(); };
function renderToday() {
  freshDaily(); const f = feast();
  $('#today-date').textContent = today().replace(/-/g, '/');
  // 頂端按鈕：有設定考試就顯示倒數
  const n = exam ? daysTo(exam.d) : null;
  $('#today-label').textContent = exam ? (n > 0 ? `${exam.x} ${n} 天` : n === 0 ? `今天${exam.x}！` : '考完了？來還願') : f.on ? '文昌聖誕' : '今日';
  $('#today-btn').classList.toggle('fest', f.on);
  const left = DAILY.filter(x => !daily.t[x.id]).length; $('#today-dot').hidden = !left;
  $('#exam-count').innerHTML = exam ? (n > 0 ? `距離 ${esc(exam.x)} 還有<b>${n}</b>天` : n === 0 ? `<b>今天</b>就是 ${esc(exam.x)}，加油！` : `${esc(exam.x)}已經考完了，辛苦了！`) : '還沒設定考試日期。';
  if (exam) { $('#exam-name').value = exam.x; $('#exam-date').value = exam.d; }
  $('#exam-clear').hidden = $('#exam-ics').hidden = !exam;
  const done = !!daily.t.lot; $('#daily-lot-btn').textContent = done ? '再看一次今日一籤' : '抽今日一籤';
  $('#daily-lot-text').textContent = done ? `今天抽到第 ${dailyLotNo()} 籤，明天再來換新的。` : '每天可以抽一支屬於你的籤，明天再來換新的。';
  $('#task-count').textContent = `${DAILY.length - left} / ${DAILY.length}`;
  $('#task-list').innerHTML = DAILY.map(t => { const ok = !!daily.t[t.id]; const p = t.need && !ok ? `（${daily.bless || 0}/${t.need}）` : '';
    return `<li class="${ok ? 'ok' : ''}"><i>${ok ? '✓' : ''}</i><span>${t.name}${p}</span>${ok ? '' : `<button type="button" data-go="${t.go}">前往</button>`}</li>`; }).join('');
  const days = store.get('days', 0), streak = store.get('streak', 0), last = store.get('lastDay', '');
  const alive = last && dayNum(today()) - dayNum(last) <= 1;
  $('#task-days').textContent = days ? `已累積完成 ${days} 天${alive && streak > 1 ? `，連續 ${streak} 天` : ''}。` : '四項都完成算一天，累積天數可以解鎖配件。';
  $('#acc-list').innerHTML = ACCS.map((name, a) => { const open = accOpen(a), how = ACC_UNLOCK.find(u => u.acc === a)?.how;
    if (a === 3 && !open && !f.on) return '';
    return `<button type="button" data-acc="${a}" aria-pressed="${(look.acc | 0) === a}" ${open ? '' : 'disabled'}>${open ? '' : '🔒 '}${name}${open ? '' : `<small>${how}</small>`}</button>`; }).join('');
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
  renderToday();
  if (f.on) setTimeout(() => { feed('🎊 文昌帝君聖誕活動中！完成每日任務可得限定配件'); }, 2500);
  else if (exam && daysTo(exam.d) >= 0 && daysTo(exam.d) <= 7) setTimeout(() => feed(`⏳ 距離${exam.x}只剩 ${daysTo(exam.d)} 天，加油！`), 2500);
}
// 跨過午夜也會換新的每日任務
setInterval(() => { if (daily.d !== today()) { freshDaily(); startToday(); } }, 60000);

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
    if (myId) tagFor(me, `你・${who(myId)}`, true);
    // 人多時只顯示離你最近的 12 個名牌，畫面才不會被名字蓋滿
    const near = [...remotes].map(([id, av]) => [id, av, Math.hypot(av.root.position.x - p.x, av.root.position.z - p.z)]).sort((a, b) => a[2] - b[2]);
    near.forEach(([id, av, d], k) => { const el = tagFor(av, who(id)); el.classList.toggle('done', (peers.get(id)?.s || 0) >= STEPS.length); el.classList.toggle('far', k >= 12 || d > 14); });
    net.pos(p.x, p.z, me.root.rotation.y, me.holding, me.bowT >= 0, me.kneeling);
    if (mySeat && Math.hypot(p.x - mySeat.x, p.z - mySeat.z) > 0.7) leaveSeat(); // 離開拜墊／拜位就釋放座位
    $('#kneel-bar').hidden = !me.kneeling || state.busy;
    document.body.classList.toggle('kneeling', !!me.kneeling);
  }
  requestAnimationFrame(loop);
}
temple.on('manualMove', () => { hideCheer(); hideSocial(); hideMusic(); });
refresh();
renderDm();
initUpdates();
requestAnimationFrame(loop);
window.__wc = { temple, me, state, act, net };

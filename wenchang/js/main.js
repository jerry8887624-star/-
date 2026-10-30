import * as THREE from '../vendor/three.module.min.js';
import { Temple, SPOTS, MARKS, FOCUS, CUSHIONS } from './scene.js';
import { Avatar, randomLook, HAIRS, HAIR_COLORS, SKINS, OUTFITS, GLASSES } from './avatar.js';
import { STEPS, EXTRAS, OFFERINGS, TABOO, EXAMS, CARD_COLORS, CHEERS, EMOTES, CHAT_PHRASES, RANK_TIP, RITUAL_NOTE, FACTS, SOURCES } from './data.js';
import { Net } from './net.js';
import { checkChat, CHAT_WHY } from './chatfilter.js';
import { WS_URL } from './config.js';
import { initUpdates, showNewsOnce } from './update.js';

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
if (state.carry.incense) me.hold(true);
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
  },
  toggle() { this.on = !this.on; store.set('sound', this.on); if (this.ctx) { this.amb.gain.value = this.on ? 0.05 : 0; this.master.gain.value = this.on ? 1 : 0; } },
  bell(vol = 0.18) { // 磬
    const c = this.ctx; if (!c || !this.on) return; const t = c.currentTime;
    [[620, 1], [1240, 0.5], [1860, 0.25], [2790, 0.12]].forEach(([f, a]) => {
      const o = c.createOscillator(), g = c.createGain(); o.frequency.value = f; o.type = 'sine';
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * a, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
      o.connect(g).connect(this.master); o.start(t); o.stop(t + 3.3);
    });
  },
  clack(n = 2) {
    const c = this.ctx; if (!c || !this.on) return;
    for (let k = 0; k < n; k++) {
      const t = c.currentTime + k * 0.09, len = 0.06 * c.sampleRate, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      const s = c.createBufferSource(); s.buffer = b; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900 + k * 300; bp.Q.value = 4;
      const g = c.createGain(); g.gain.value = 0.7; s.connect(bp).connect(g).connect(this.master); s.start(t);
    }
  },
  chime() {
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
document.querySelectorAll('[data-gender]').forEach(b => b.onclick = () => setLook(randomLook(b.dataset.gender)));
$('#pick-shuffle').onclick = () => setLook(randomLook(look.gender));
$('#pick-custom').onclick = e => { const open = $('#customize').hidden; $('#customize').hidden = !open; e.currentTarget.setAttribute('aria-expanded', open); };
$('#customize').onclick = e => {
  const b = e.target.closest('button'); if (!b) return; const row = b.closest('.crow'), k = row.dataset.part, n = parts.find(p => p[0] === k)[2];
  setLook({ ...look, [k]: (look[k] + +b.dataset.d + n) % n });
};
renderPicker();

$('#enter-btn').onclick = async () => {
  sound.init(); sound.bell(0.12);
  $('#splash').classList.add('leaving');
  setTimeout(() => { $('#splash').hidden = true; }, 500);
  $('#hud').hidden = false;
  temple.focus = null; temple.camDist = innerWidth < innerHeight ? 9 : 8; temple.camPitch = 0.32;
  temple.frame(Math.PI, 0.35);
  me.faceTo = Math.PI;
  net.connect(look);
  if (!wsUrl) startNpcs();
  else setTimeout(() => { if (!net.alive) startNpcs(); }, 5000); // 連不上伺服器就先放示意香客
  refresh();
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
$('#time-btn').onclick = e => { night = !night; store.set('night', night); document.body.classList.toggle('night', night); temple.setNight(night); e.currentTarget.setAttribute('aria-pressed', night); };
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
  $('#next').innerHTML = cur ? `下一步：<b>${cur.dock}</b>・${cur.label}` : '參拜完成！還可以<b>擲筊</b>、<b>求籤</b>，或點其他香客互相打氣。';
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
    const cur = current(), map = { counter: 'prepare', censer: ['heaven', 'plant', 'pass'], cushion: ['wenchang', 'jiaobei'], wall: 'card', qianTube: 'qian' };
    const ids = [].concat(map[m.id]);
    if (cur && ids.includes(cur.id)) act(cur.id);
    else if (m.id === 'qianTube') act('qian');
    else walkTo(m.id === 'censer' ? 'censer' : m.id);
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
  const cur = current(), whereMark = cur ? { counter: 'counter', censerOut: 'censer', censer: 'censer', cushion: 'cushion', wall: 'wall' }[cur.where] : null;
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
temple.on('tapGround', p => { if (state.busy) return; hideCheer(); hideSocial(); me.faceTo = null; temple.walk(me, p.x, p.z).then(ok => { if (ok) kneelIfOnCushion(); }); });
// 拜墊：點拜墊或走到拜墊上就會跪下（面向文昌帝君），可以叩拜；一走動就起身
temple.on('tapCushion', i => { if (state.busy) return; hideCheer(); hideSocial(); const c = CUSHIONS[i]; temple.walk(me, c.x, c.z, Math.PI).then(ok => { if (ok) kneelIfOnCushion(true); }); });
function kneelIfOnCushion(tapped) {
  const i = temple.freeCushion(me.root.position.x, me.root.position.z, 0.6);
  if (i < 0) { if (tapped) toast('這個拜墊有人了，換一個吧。'); return; }
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
$('#kneel-up').onclick = () => { me.kneel(false); };
temple.on('tapAvatar', av => openCheer(av));
async function walkTo(spot) { me.faceTo = null; const ok = await temple.goSpot(me, spot); return ok; }

// ---------- 參拜動作 ----------
async function act(id) {
  if (state.busy) return;
  hideCheer();
  const fn = { prepare, heaven, wenchang, plant, pass, card, jiaobei, qian }[id];
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
async function arrive(spot) {
  const ok = await walkTo(spot); if (!ok) return false;
  temple.frame(SPOTS[spot].f, SPOTS[spot].cam ?? 0.22);
  if (SPOTS[spot].kneel) me.kneel(true);
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
    state.carry.incense = true; me.hold(true); save(); toast('再點了三炷香。（供品只在第一次參拜時準備）'); return;
  }
  if (!(await arrive('counter'))) return;
  offerMsg();
  const dlg = $('#offer-dlg');
  const ok = await new Promise(res => {
    $('#offer-ok').onclick = () => { if (!picked.size || picked.size % 2 === 0) { offerMsg(); $('#offer-msg').classList.add('warn'); if (!picked.size) $('#offer-msg').textContent = '至少挑一樣供品。'; return; } dlg.close('ok'); };
    dlg.onclose = () => res(dlg.returnValue === 'ok'); dlg.returnValue = ''; dlg.showModal();
  });
  if (!ok) return;
  state.carry = { incense: true, offerings: [...picked], ticket: $('#offer-ticket').checked };
  me.hold(true); sound.bell(0.08);
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
  complete('heaven');
}
async function wenchang() {
  if (!need(state.done.has('heaven'), '先到天公爐前<b>拜天公</b>，再入殿拜文昌帝君。')) return;
  if (state.done.has('wenchang')) { toast('已經向文昌帝君稟告過了。想再請示可以<b>擲筊</b>。'); return; }
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
}
async function plant() {
  if (!need(state.carry.incense, '手上沒有香。請先到<b>辦事處</b>領香。')) return;
  if (!need(state.done.has('wenchang'), '香要拜完天公和<b>文昌帝君</b>之後再插。')) return;
  if (!(await arrive('censer'))) return;
  sound.bell(0.1); await me.bow(1);
  temple.plantIncense(); me.hold(false); state.carry.incense = false; save();
  complete('plant');
}

// 5. 過爐：手指繞圈
async function pass() {
  if (!need(state.carry.ticket, '你沒有帶准考證影本。可以重新到<b>辦事處</b>備供品時勾選。')) return;
  if (state.done.has('pass')) { toast('准考證已經過爐了。'); return; }
  if (!need(state.done.has('plant') || state.done.has('wenchang'), '先拜完文昌帝君、<b>插香</b>，再來過爐。')) return;
  if (!(await arrive('censer'))) return;
  temple.focus = new THREE.Vector3(...FOCUS.censer);
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
    const now = performance.now(); if (now - lastRattle > 90) { sound.clack(1); lastRattle = now; }
  }
  return new Promise(res => {
    const finish = n => { done = true; cancelAnimationFrame(raf); removeEventListener('devicemotion', motion); tube.onpointerdown = tube.onpointerup = tube.onpointerleave = null; setTimeout(() => { ui.hidden = true; res(n); }, n ? 1100 : 0); };
    let lastT = performance.now();
    const loop = () => { const now = performance.now(), dt = Math.min(0.1, (now - lastT) / 1000); lastT = now; if (holding) bump(dt * 0.6); if (power >= 1 && !done) { const n = 1 + Math.floor(Math.random() * 60); tube.classList.remove('shaking'); out.textContent = ''; out.classList.add('fall'); sound.clack(1); buzz(30); finish(n); return; } raf = requestAnimationFrame(loop); };
    tube.onpointerdown = e => { e.preventDefault(); holding = true; bump(0.08); };
    tube.onpointerup = tube.onpointerleave = () => { holding = false; };
    $('#qian-cancel').onclick = () => finish(0);
    raf = requestAnimationFrame(loop);
  });
}
const NUM = n => { const d = '〇一二三四五六七八九'; if (n <= 10) return n === 10 ? '十' : d[n]; if (n < 20) return '十' + d[n - 10]; return d[Math.floor(n / 10)] + '十' + (n % 10 ? d[n % 10] : ''); };
function rankKey(r) { return r.startsWith('上上') ? '上上' : r.startsWith('上') ? '上' : r.startsWith('下') ? '下' : '中'; }
let shownLot = 0;
function showLot(n) {
  const q = window.QIAN_DATA[n - 1], lines = (window.QIAN_LINES || [])[n - 1] || [], story = (window.QIAN_STORY || {})[n];
  shownLot = n; store.set('lastLot', n);
  $('#lot-number').textContent = `第${NUM(n)}籤・${q[0]}`;
  $('#lot-rank').textContent = q[1];
  $('#lot-poem').innerHTML = q[2].split(/[，。]/).filter(Boolean).map((l, i) => `<span style="animation-delay:${i * 180}ms">${esc(l)}</span>`).join('');
  $('#lot-plain').textContent = q[3];
  $('#lot-tip').textContent = RANK_TIP[rankKey(q[1])] + `（籤中「事業」一項：${q[4]}）`;
  $('#lot-lines').innerHTML = lines.map(l => `<li>${esc(l)}</li>`).join('');
  $('#lot-story-wrap').hidden = !story; if (story) $('#lot-story').textContent = `${story[0]}：${story[1]}`;
  $('#lot-saved').textContent = '';
  sound.bell(0.1); $('#lot-dlg').showModal();
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
  $('#done-text').textContent = '六個步驟都完成了。祝你考試時頭腦清楚、下筆順利，金榜題名！';
  sound.chime(); $('#done-dlg').showModal();
}

// ---------- 其他香客：多人連線或示意香客 ----------
const remotes = new Map(); // id -> avatar
let myId = 0, blocked = new Set(sess.get('blocked', []));
// 本機測試可用 ?ws=ws://127.0.0.1:8787/ws
const wsUrl = (location.hostname === 'localhost' && new URLSearchParams(location.search).get('ws'))
  || (WS_URL === 'auto' ? (/github\.io$/.test(location.hostname) || !/^https?:$/.test(location.protocol) ? '' : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`) : WS_URL);
const peers = new Map(); // id -> { s: 參拜進度 }
const net = new Net(wsUrl, {
  status(on, was) {
    $('#presence').hidden = !on;
    if (on) { stopNpcs(); net.step(state.done.size); net.dmOff(!dmAllow); renderDm(); }
    else { for (const c of dm.convs.values()) c.gone = true; renderDm(); for (const av of remotes.values()) temple.removeAvatar(av); remotes.clear(); peers.clear(); if (was) feed('連線中斷，正在重新連線…'); }
    renderPeople();
  },
  message(m) {
    if (m.t === 'welcome') { myId = m.you; temple.setSharedCards(m.cards || [], CARD_COLORS.map(c => c.hex), cardLabel); if (m.cards?.length) feed(`祈福牆上已經有 ${m.cards.length} 張大家的卡`); }
    else if (m.t === 'state') {
      $('#presence .online').textContent = `${m.online} 人在廟裡`;
      const seen = new Set();
      for (const p of m.players) {
        if (p.id === myId) continue; seen.add(p.id);
        let av = remotes.get(p.id);
        if (!av) { av = temple.addAvatar(new Avatar(p.look)); av.netId = p.id; av.root.position.set(p.x, 0, p.z); av.speed = 4.5; remotes.set(p.id, av); }
        else if (JSON.stringify(av.look) !== JSON.stringify(p.look)) av.setLook(p.look);
        if (Math.hypot(av.root.position.x - p.x, av.root.position.z - p.z) > 0.1) { av.path = null; av.target = { x: p.x, z: p.z, face: p.f }; } else av.faceTo = p.f;
        av.hold(!!p.h); av.kneel(!!p.k); if (p.b && av.bowT < 0) av.bow(1);
        peers.set(p.id, { s: p.s || 0 });
      }
      for (const id of [...peers.keys()]) if (!seen.has(id)) peers.delete(id);
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
      if (m.card.by !== myId) feed(`考生 #${m.card.by} 掛上一張「${cardLabel(m.card)}」祈福卡`);
    }
    else if (m.t === 'feed') {
      if (m.from === myId) return;
      if (m.k === 'join') feed(`考生 #${m.from} 走進了文昌祠`);
      if (m.k === 'done') feed(`考生 #${m.from} 完成參拜了！點「互動」幫他加油`);
    }
    else if (m.t === 'cheer') {
      if (blocked.has(m.from)) return;
      const text = CHEERS[m.i] || CHEERS[0];
      const from = m.from === myId ? me : remotes.get(m.from);
      if (from) bubble(from, text);
      if (m.to === myId && m.from !== myId && !blocked.has(m.from)) {
        toast(`考生 #${m.from} 對你說：<b>${esc(text)}</b><button type="button" class="reply" data-reply="${m.from}">回覆</button>`, 5000); sound.chime(); buzz(20);
      }
    }
    else if (m.t === 'dm') {
      if (blocked.has(m.from)) return;
      dmLine(m.from, 'them', m.text);
      const av = remotes.get(m.from); if (av) bubble(av, '💬', 'bubble', 1500);
      sound.chime(); buzz(15);
      if (!(dm.open && dm.cur === m.from)) toast(`<b>考生 #${m.from}</b> 密語：${esc(m.text)}<button type="button" class="reply" data-dm="${m.from}">回覆</button>`, 6000);
    }
    else if (m.t === 'dm-ok') { dmLine(m.to, 'me', m.text); bubble(me, '💬', 'bubble', 1500); }
    else if (m.t === 'dm-reject') dmLine(m.to, 'sys', CHAT_WHY[m.why] || '這則密語沒有送出。');
    else if (m.t === 'dm-fail') dmLine(m.to, 'sys', m.why === 'gone' ? '對方已經離開廟裡了。' : '對方目前不接收密語。');
    else if (m.t === 'slow' && m.kind === 'msg') { if (dm.cur) dmLine(dm.cur, 'sys', '說慢一點喔。'); }
    else if (m.t === 'slow') toast(m.kind === 'card' ? '祈福卡剛掛過，等一下再換。' : '慢一點喔，稍等一下再送。');
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
  $('#cheer-name').textContent = `對考生 #${id} 說：`;
  $('#cheer-list').innerHTML = CHEERS.map((c, i) => `<button type="button" data-i="${i}">${c}</button>`).join('');
  const w = Math.min(280, innerWidth - 24); menu.style.width = w + 'px';
  if (!av) { menu.style.left = (innerWidth - w) / 2 + 'px'; menu.style.top = Math.max(70, innerHeight / 2 - 160) + 'px'; return; }
  tmpV.set(av.root.position.x, 2.4, av.root.position.z); const p = temple.project(tmpV);
  menu.style.left = Math.max(12, Math.min(innerWidth - w - 12, p.x - w / 2)) + 'px'; menu.style.top = Math.max(70, Math.min(innerHeight - 320, p.y - 230)) + 'px';
}
function hideCheer() { $('#cheer-menu').hidden = true; }
$('#cheer-list').onclick = e => { const b = e.target.closest('button'); if (!b) return; net.cheer(+$('#cheer-menu').dataset.id, +b.dataset.i); hideCheer(); buzz(10); };
function blockUser(id) { blocked.add(id); sess.set('blocked', [...blocked]); net.block(id); }
$('#cheer-block').onclick = () => { blockUser(+$('#cheer-menu').dataset.id); hideCheer(); toast('已封鎖，不會再收到他的密語和打氣。'); };
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
  $('#dm-tabs').innerHTML = [...dm.convs].map(([id, c]) => `<button type="button" role="tab" data-tab="${id}" aria-selected="${id === dm.cur}" class="${c.gone ? 'gone' : ''}">考生 #${id}${c.unread ? `<b>${c.unread}</b>` : ''}</button>`).join('');
  const c = dm.convs.get(dm.cur);
  $('#chat-title').textContent = c ? `密語：考生 #${dm.cur}` : '密語';
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
$('#chat-block').onclick = () => { const id = dm.cur; blockUser(id); dm.convs.delete(id); dm.cur = [...dm.convs.keys()].pop() || 0; renderDm(); toast(`已封鎖考生 #${id}，不會再收到他的密語。`); };
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
  const em = EMOTES[+b.dataset.e]; me.emote(em.id); bubble(me, em.icon, 'bubble', 1800); net.emote(+b.dataset.e); buzz(10); hideSocial();
};
function openSocial() { hideCheer(); renderPeople(); $('#social').hidden = false; $('#social-btn').setAttribute('aria-expanded', 'true'); }
function hideSocial() { $('#social').hidden = true; $('#social-btn').setAttribute('aria-expanded', 'false'); }
$('#social-btn').onclick = () => $('#social').hidden ? openSocial() : hideSocial();
function renderPeople() {
  const online = net.alive;
  $('#social-offline').hidden = online; $('#people-wrap').hidden = !online;
  const ids = [...peers.keys()].filter(id => id !== myId).sort((a, b) => a - b);
  $('#people-title').textContent = `在廟裡的考生（${ids.length + (online ? 1 : 0)} 人，含你）`;
  $('#people-empty').hidden = ids.length > 0;
  const html = ids.map(id => { const s = peers.get(id).s; return `<li><span><b>考生 #${id}</b><small>${s >= 6 ? '已完成參拜 ✓' : s ? `參拜中・${s}/6` : '剛進廟'}</small></span><span class="acts"><button type="button" data-cheer="${id}">打氣</button><button type="button" class="alt" data-whisper="${id}">密語</button></span></li>`; }).join('');
  if ($('#people-list').innerHTML !== html) $('#people-list').innerHTML = html;
  const btn = $('#social-btn'); let dot = btn.querySelector('.dot');
  if (online && ids.length) { if (!dot) { dot = document.createElement('b'); dot.className = 'dot'; btn.appendChild(dot); } dot.textContent = ids.length; } else dot?.remove();
}
$('#people-list').onclick = e => {
  const b = e.target.closest('[data-cheer]'); if (b) openCheerFor(+b.dataset.cheer);
  const w = e.target.closest('[data-whisper]'); if (w) openDm(+w.dataset.whisper, true);
};

// 動態：誰進來、誰掛卡、誰完成參拜
function feed(text) {
  const ol = $('#feed'), li = document.createElement('li'); li.textContent = text; ol.prepend(li);
  while (ol.children.length > 3) ol.lastChild.remove(); // 最新的在最下面
  setTimeout(() => li.classList.add('out'), 5500); setTimeout(() => li.remove(), 6100);
}

// 沒有連線時：幾位示意香客在廟裡走動、拜拜
const npcs = [];
let npcGen = 0;
function stopNpcs() { npcGen++; npcs.splice(0).forEach(av => temple.removeAvatar(av)); }
function startNpcs() {
  if (npcs.length || net.alive) return;
  const gen = ++npcGen;
  const route = ['censerOut', 'cushion', 'wall', 'counter', 'censer', 'qianTube'];
  for (let i = 0; i < 6; i++) {
    const av = temple.addAvatar(new Avatar(randomLook())); av.npc = true; av.speed = 2.2 + Math.random() * 0.8;
    av.root.position.set(-4 + i * 2.6, 0, 7 - i * 2.2);
    npcs.push(av);
    (async function life() {
      await wait(800 + i * 1500);
      while (gen === npcGen) {
        if (Math.random() < 0.4) { // 找個空拜墊跪拜
          const free = CUSHIONS.map((c, k) => k).filter(k => k > 2 && temple.freeCushion(CUSHIONS[k].x, CUSHIONS[k].z, 0.3) === k && Math.hypot(me.root.position.x - CUSHIONS[k].x, me.root.position.z - CUSHIONS[k].z) > 1);
          const c = CUSHIONS[free[Math.floor(Math.random() * free.length)]];
          if (c && await temple.walk(av, c.x, c.z, Math.PI)) { av.kneel(true); await wait(600); await av.bow(3); await wait(3000 + Math.random() * 4000); av.kneel(false); continue; }
        }
        const s = SPOTS[route[Math.floor(Math.random() * route.length)]];
        const ox = (Math.random() < 0.5 ? -1 : 1) * (1.4 + Math.random()), oz = (Math.random() - 0.5) * 1.2; // 站兩側，不擋住玩家的位置
        await temple.walk(av, s.x + ox, s.z + oz, s.f);
        av.hold(Math.random() < 0.5);
        if (Math.random() < 0.7) await av.bow(1 + Math.floor(Math.random() * 3));
        await wait(2000 + Math.random() * 5000);
      }
    })();
  }
}

// ---------- 主迴圈 ----------
function loop() {
  temple.update();
  if (!$('#hud').hidden) {
    placeLabels();
    if (!tags.has(me) && myId) tagFor(me, `你・考生 #${myId}`, true);
    for (const [id, av] of remotes) tagFor(av, `考生 #${id}`).classList.toggle('done', (peers.get(id)?.s || 0) >= 6);
    const p = me.root.position; net.pos(p.x, p.z, me.root.rotation.y, me.holding, me.bowT >= 0, me.kneeling);
    $('#kneel-bar').hidden = !me.kneeling || state.busy;
    document.body.classList.toggle('kneeling', !!me.kneeling);
  }
  requestAnimationFrame(loop);
}
temple.on('manualMove', () => { hideCheer(); hideSocial(); });
refresh();
renderDm();
initUpdates();
requestAnimationFrame(loop);
window.__wc = { temple, me, state, act, net };

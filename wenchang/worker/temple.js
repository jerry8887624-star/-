// 「線上參拜文昌帝君」網站＋多人連線伺服器（Cloudflare Worker + Durable Object）
// 網站檔案由 Workers 靜態資源提供（wrangler.toml 的 [assets]），只有 /ws 會進到這裡。
// 轉送：位置、外觀、參拜進度、表情與打氣語的「編號」、祈福卡的顏色與考試類別編號，
// 以及「密語」（一對一，最多 40 字，過濾網址與聯絡方式，只轉給對方、不存檔；可封鎖、可關閉接收）。
// 不收姓名、生日、住址、准考證。會存的只有「累計人次」、牆上的祈福卡（顏色＋考試類別＋加持數）與還願紅榜（暱稱＋考試類別）。
// 每支手機有一個隨機的匿名代碼（不含任何個資），只用來認出「這張祈福卡是你掛的」、紅榜不重複。

import { checkChat, checkName } from '../js/chatfilter.js';

const MAX_PLAYERS = 100;
const STEP_COUNT = 7;        // 參拜步驟數，與前端 data.js 的 STEPS 一致
const CHEER_COUNT = 8;      // 與前端 data.js 的 CHEERS 數量一致
const EMOTE_COUNT = 4;      // 與前端 EMOTES 數量一致
const EXAM_COUNT = 10;      // 與前端 EXAMS 數量一致
const COLOR_COUNT = 4;      // 與前端 CARD_COLORS 數量一致
const MAX_CARDS = 60;
const MAX_BANG = 60;        // 還願紅榜最多保留幾筆
const MAX_LAMPS = 200;      // 光明燈最多幾盞
const LAMP_DAYS = 7;        // 光明燈亮幾天
const GAP = { cheer: 2000, emote: 1000, card: 30000, msg: 1000, bless: 1200, bang: 60000, lamp: 20000, wish: 4000, study: 2000, board: 1500, offer: 10000 };
// 台灣時間的日期與週（週一開始），排行榜用
const twNow = () => new Date(Date.now() + 8 * 3600e3);
const dayKey = () => twNow().toISOString().slice(0, 10);
const weekKey = () => { const d = twNow(); d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7); return d.toISOString().slice(0, 10); };
const IDLE_MS = 3 * 60000; // 超過 3 分鐘沒動作就不算「在廟裡的時間」

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/ws') {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('websocket only', { status: 426 });
      const id = env.TEMPLE.idFromName('wenchang');
      return env.TEMPLE.get(id).fetch(req);
    }
    return new Response('Not found', { status: 404 });
  }
};

const send = (p, o) => { try { p.ws.send(JSON.stringify(o)); } catch (_) {} };
const num = (v, lo, hi) => { v = Number(v); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : 0; };
const int = (v, lo, hi) => Math.round(num(v, lo, hi));
function cleanLook(l) {
  l = l || {};
  return { gender: l.gender === 'm' ? 'm' : 'f', hair: int(l.hair, 0, 20), hairColor: int(l.hairColor, 0, 20),
    skin: int(l.skin, 0, 20), outfit: int(l.outfit, 0, 20), glasses: int(l.glasses, 0, 2), acc: int(l.acc, 0, 3), ttl: int(l.ttl, 0, 30), fx: int(l.fx, 0, 5),
    head: int(l.head, 0, 10), eye: int(l.eye, 0, 10), mouth: int(l.mouth, 0, 10), cheek: int(l.cheek, 0, 5) };
}

export class Temple {
  constructor(state) {
    this.state = state;
    this.players = new Map(); // ws -> player
    this.byId = new Map();    // id -> player
    this.seats = new Map();   // 座位編號（拜墊、天公爐拜位）-> 玩家 id，一位一人
    this.timer = null;
    state.blockConcurrencyWhile(async () => {
      this.total = (await state.storage.get('total')) || 0;
      this.seq = (await state.storage.get('seq')) || 0;
      this.cards = (await state.storage.get('cards')) || [];
      this.cardSeq = (await state.storage.get('cardSeq')) || 0;
      this.cards.forEach(c => { if (!c.id) c.id = ++this.cardSeq; c.b ||= 0; });
      this.bang = (await state.storage.get('bang')) || [];
      this.lamps = (await state.storage.get('lamps')) || [];
      this.wishes = (await state.storage.get('wishes')) || 0;
      this.focus = (await state.storage.get('focus')) || { d: '', m: 0 };
      this.offers = (await state.storage.get('offers')) || [];
      // 排行榜：每支手機（匿名代碼）一筆，記暱稱、專注分鐘、在廟裡的分鐘（今日／本週／累積）
      this.recs = new Map();
      for (const [k, v] of await state.storage.list({ prefix: 'u:' })) this.recs.set(k.slice(2), v);
    });
  }

  async fetch(req) {
    if (this.players.size >= MAX_PLAYERS) return new Response('full', { status: 503 });
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();
    this.seq += 1; this.state.storage.put('seq', this.seq);
    const p = { id: this.seq, x: 0, z: 13, f: Math.PI, h: 0, b: 0, s: 0, look: null, last: {}, ws: server, dmOff: false, blocked: new Set(), blessed: new Set(), uid: '' };
    this.players.set(server, p); this.byId.set(p.id, p);
    server.addEventListener('message', e => this.onMessage(p, e.data));
    const bye = () => { if (this.players.delete(server)) { this.byId.delete(p.id); this.freeSeat(p); this.broadcast({ t: 'leave', id: p.id }); } };
    server.addEventListener('close', bye); server.addEventListener('error', bye);
    this.tick();
    return new Response(null, { status: 101, webSocket: client });
  }

  // 同一種動作的最短間隔
  allow(p, kind) {
    const now = Date.now();
    if (now - (p.last[kind] || 0) < GAP[kind]) { p.ws.send(JSON.stringify({ t: 'slow', kind })); return false; }
    p.last[kind] = now; return true;
  }

  onMessage(p, raw) {
    if (typeof raw !== 'string' || raw.length > 600) return;
    let m; try { m = JSON.parse(raw); } catch (_) { return; }
    p.lastAct = Date.now();
    if (m.t === 'hi' && !p.look) {
      p.look = cleanLook(m.look);
      const n = checkName(m.name); p.name = n.ok ? n.text : '';
      p.uid = String(m.uid || '').replace(/[^a-z0-9]/gi, '').slice(0, 24);
      p.rank = m.rank !== 0; this.syncRec(p);
      this.total += 1; this.state.storage.put('total', this.total);
      const mine = this.cards.filter(c => p.uid && c.u === p.uid);
      p.ws.send(JSON.stringify({ t: 'welcome', you: p.id, total: this.total, cards: this.publicCards(p), bang: this.bang.map(e => ({ x: e.x, n: e.n, d: e.d })), lamps: this.publicLamps(), wishes: this.wishes, focus: this.focusToday(), offers: this.publicOffers(p), myBless: mine.reduce((n, c) => n + (c.b || 0), 0) }));
      this.broadcast({ t: 'feed', from: p.id, k: 'join', n: p.name }, p.ws);
    } else if (!p.look) {
      return;
    } else if (m.t === 'look') {
      p.look = cleanLook(m.look);
    } else if (m.t === 'name') {
      const n = checkName(m.name); if (n.ok) p.name = n.text; this.syncRec(p);
    } else if (m.t === 'pos') {
      p.x = num(m.x, -30, 40); p.z = num(m.z, -30, 40); p.f = num(m.f, -10, 10); p.h = m.h ? 1 : 0; p.b = m.b ? 1 : 0; p.k = m.k ? 1 : 0;
    } else if (m.t === 'step') {
      const s = int(m.s, 0, STEP_COUNT);
      if (s >= STEP_COUNT && p.s < STEP_COUNT) this.broadcast({ t: 'feed', from: p.id, k: 'done' });
      p.s = s;
    } else if (m.t === 'cheer') {
      if (!this.allow(p, 'cheer')) return;
      this.broadcast({ t: 'cheer', from: p.id, to: int(m.to, 0, 1e9), i: int(m.i, 0, CHEER_COUNT - 1) });
    } else if (m.t === 'emote') {
      if (!this.allow(p, 'emote')) return;
      this.broadcast({ t: 'emote', from: p.id, e: int(m.e, 0, EMOTE_COUNT - 1) });
    } else if (m.t === 'card') {
      if (!this.allow(p, 'card')) return;
      const card = { id: ++this.cardSeq, c: int(m.c, 0, COLOR_COUNT - 1), x: int(m.x, -1, EXAM_COUNT - 1), by: p.id, u: p.uid, b: 0 };
      this.cards.push(card); if (this.cards.length > MAX_CARDS) this.cards.splice(0, this.cards.length - MAX_CARDS);
      this.state.storage.put('cards', this.cards); this.state.storage.put('cardSeq', this.cardSeq);
      const pub = { id: card.id, c: card.c, x: card.x, by: card.by, b: 0 };
      for (const q of this.players.values()) if (q.look) send(q, { t: 'card', card: { ...pub, mine: q === p ? 1 : 0 } });
    } else if (m.t === 'bless') {
      // 祈福卡加持：每人每張卡只能加持一次；卡片主人在線上就通知他
      const card = this.cards.find(c => c.id === int(m.id, 0, 1e9));
      if (!card || p.blessed.has(card.id) || (p.uid && (card.u === p.uid || card.bu?.includes(p.uid)))) return send(p, { t: 'bless-no', id: int(m.id, 0, 1e9) });
      if (!this.allow(p, 'bless')) return;
      p.blessed.add(card.id); card.b = (card.b || 0) + 1;
      if (p.uid) { card.bu ||= []; if (card.bu.length < 50) card.bu.push(p.uid); } // 記下誰加持過（最多 50 個匿名代碼），重新整理也不能重複加持 this.state.storage.put('cards', this.cards);
      this.broadcast({ t: 'bless', id: card.id, b: card.b });
      for (const q of this.players.values()) if (q.uid && q.uid === card.u) send(q, { t: 'blessed', id: card.id, b: card.b, from: p.name || '' });
    } else if (m.t === 'study') {
      // 讀書角：頭上顯示「專注中」
      if (!this.allow(p, 'study') && m.on) return;
      // 專注結束：把專注的分鐘加進「今天大家一共專注」（只有真的在專注中的人才算）
      if (!m.on && p.su) { const mins = Math.min(int(m.m, 0, 60), Math.ceil((Date.now() - (p.suAt || 0)) / 60000)); if (mins > 0) { this.addRec(p, 'f', mins); this.focusToday(); this.focus.m += mins; this.state.storage.put('focus', this.focus); this.broadcast({ t: 'focus', m: this.focus.m }); } }
      if (m.on && !p.su) p.suAt = Date.now();
      p.su = m.on ? 1 : 0;
    } else if (m.t === 'lamp') {
      // 光明燈：一支手機同時只亮一盞，再點就換新、重新亮七天
      if (!this.allow(p, 'lamp')) return;
      const now = Date.now();
      this.lamps = this.lamps.filter(e => now - e.d < LAMP_DAYS * 864e5 && !(p.uid && e.u === p.uid));
      const e = { x: int(m.x, -1, EXAM_COUNT - 1), n: p.name || '', d: now, u: p.uid };
      this.lamps.push(e); if (this.lamps.length > MAX_LAMPS) this.lamps.splice(0, this.lamps.length - MAX_LAMPS);
      this.state.storage.put('lamps', this.lamps);
      this.broadcast({ t: 'lamp', lamps: this.publicLamps(), from: p.id, e: { x: e.x, n: e.n } });
    } else if (m.t === 'wish') {
      // 許願池：只廣播「有人投了許願幣」，許的願不傳
      if (!this.allow(p, 'wish')) return;
      this.wishes += 1; this.state.storage.put('wishes', this.wishes);
      this.broadcast({ t: 'wish', from: p.id, n: this.wishes });
    } else if (m.t === 'offer') {
      // 供桌：每支手機一份（供品編號＋有沒有准考證），最多 8 份，最新的擺在最靠近中間
      if (!this.allow(p, 'offer')) return;
      const o = [...new Set((Array.isArray(m.o) ? m.o : []).filter(v => Number.isInteger(v) && v >= 0 && v <= 7))].slice(0, 7);
      if (!o.length) return;
      this.offers = this.offers.filter(e => !(p.uid && e.u === p.uid)); this.offers.push({ o, tk: m.tk ? 1 : 0, u: p.uid, d: Date.now() });
      if (this.offers.length > 8) this.offers.splice(0, this.offers.length - 8);
      this.state.storage.put('offers', this.offers);
      for (const q of this.players.values()) if (q.look) send(q, { t: 'offer', offers: this.publicOffers(q) });
    } else if (m.t === 'rank') {
      // 要不要顯示在排行榜
      p.rank = !!m.on; this.syncRec(p);
    } else if (m.t === 'board') {
      if (!this.allow(p, 'board')) return;
      send(p, this.board(p));
    } else if (m.t === 'bang') {
      // 還願紅榜：考上了回來答謝（暱稱＋考試類別），同一支手機同一種考試只登一次
      const x = int(m.x, 0, EXAM_COUNT - 1);
      if (p.uid && this.bang.some(e => e.u === p.uid && e.x === x)) return send(p, { t: 'bang-dup' });
      if (!this.allow(p, 'bang')) return;
      const e = { x, n: p.name || '', d: Date.now(), u: p.uid };
      this.bang.push(e); if (this.bang.length > MAX_BANG) this.bang.splice(0, this.bang.length - MAX_BANG);
      this.state.storage.put('bang', this.bang);
      this.broadcast({ t: 'bang', e: { x: e.x, n: e.n, d: e.d }, from: p.id });
    } else if (m.t === 'dm') {
      // 密語：直接傳給對方（過濾聯絡方式；對方封鎖你或關閉密語時傳不過去）
      const q = this.byId.get(int(m.to, 0, 1e9));
      if (!q || q === p || !q.look) return send(p, { t: 'dm-fail', to: int(m.to, 0, 1e9), why: 'gone' });
      if (!this.allow(p, 'msg')) return;
      const r = checkChat(m.text);
      if (!r.ok) return send(p, { t: 'dm-reject', to: q.id, why: r.why });
      if (q.blocked.has(p.id) || q.dmOff) return send(p, { t: 'dm-fail', to: q.id, why: 'closed' });
      send(q, { t: 'dm', from: p.id, text: r.text }); send(p, { t: 'dm-ok', to: q.id, text: r.text });
    } else if (m.t === 'dmoff') {
      p.dmOff = !!m.off;
    } else if (m.t === 'seat') {
      // 搶座位：有人坐了就回 ok:0；成功就釋放原本的座位
      const i = int(m.i, -1, 999), owner = this.seats.get(i);
      if (i < 0) { this.freeSeat(p); return; }
      if (owner && owner !== p.id && this.byId.has(owner)) return send(p, { t: 'seat', i, ok: 0 });
      this.freeSeat(p); this.seats.set(i, p.id); p.seat = i; send(p, { t: 'seat', i, ok: 1 });
    } else if (m.t === 'block') {
      p.blocked.add(int(m.id, 0, 1e9));
    } else if (m.t === 'unblock') {
      p.blocked.delete(int(m.id, 0, 1e9));
    }
  }

  // 排行榜紀錄：換日、換週就把「今日」「本週」歸零
  rec(uid) {
    let r = this.recs.get(uid);
    if (!r) { r = { n: '', h: false, d: '', w: '', fd: 0, fw: 0, ft: 0, ad: 0, aw: 0, at: 0 }; this.recs.set(uid, r); }
    const d = dayKey(), w = weekKey();
    if (r.d !== d) { r.d = d; r.fd = 0; r.ad = 0; }
    if (r.w !== w) { r.w = w; r.fw = 0; r.aw = 0; }
    return r;
  }
  syncRec(p) { if (!p.uid) return; const r = this.rec(p.uid); r.n = p.name || ''; r.h = !p.rank; this.state.storage.put('u:' + p.uid, r); }
  addRec(p, k, mins) { if (!p.uid) return; const r = this.rec(p.uid); r[k + 'd'] += mins; r[k + 'w'] += mins; r[k + 't'] += mins; this.state.storage.put('u:' + p.uid, r); }
  // 每分鐘：有在動（或正在專注）的人，在廟裡的時間 +1 分鐘
  creditActive() {
    const now = Date.now(), seen = new Set();
    for (const p of this.players.values()) {
      if (!p.look || !p.uid || seen.has(p.uid)) continue; seen.add(p.uid);
      if (p.su || now - (p.lastAct || 0) < IDLE_MS) this.addRec(p, 'a', 1);
    }
  }
  board(p) {
    const d = dayKey(), w = weekKey();
    const val = (r, k, per) => per === 't' ? r[k + 't'] : per === 'w' ? (r.w === w ? r[k + 'w'] : 0) : (r.d === d ? r[k + 'd'] : 0);
    const recs = [...this.recs.entries()];
    const top = (k, per) => recs.filter(([, r]) => !r.h && val(r, k, per) > 0).sort((a, b) => val(b[1], k, per) - val(a[1], k, per)).slice(0, 10)
      .map(([u, r]) => ({ n: r.n || '考生', v: val(r, k, per), me: u === p.uid ? 1 : 0 }));
    const mine = p.uid && this.recs.get(p.uid);
    const myRank = (k, per) => { if (!mine) return 0; const v = val(mine, k, per); if (!v) return 0; return 1 + recs.filter(([u, r]) => u !== p.uid && !r.h && val(r, k, per) > v).length; };
    const pack = k => ({ d: top(k, 'd'), w: top(k, 'w'), t: top(k, 't'),
      me: mine ? { d: val(mine, k, 'd'), w: val(mine, k, 'w'), t: val(mine, k, 't'), rd: myRank(k, 'd'), rw: myRank(k, 'w'), rt: myRank(k, 't') } : null });
    return { t: 'board', focus: pack('f'), active: pack('a'), hidden: !!mine?.h };
  }

  // 台灣日期換日就歸零
  focusToday() { const d = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10); if (this.focus.d !== d) this.focus = { d, m: 0 }; return this.focus.m; }

  publicOffers(p) { return this.offers.map(e => ({ o: e.o, tk: e.tk, mine: p.uid && e.u === p.uid ? 1 : 0 })); }

  publicLamps() { const now = Date.now(); return this.lamps.filter(e => now - e.d < LAMP_DAYS * 864e5).map(e => ({ x: e.x, n: e.n, d: e.d })); }

  // 給玩家的卡片清單：不帶匿名代碼，只標出哪幾張是他自己的
  publicCards(p) { return this.cards.map(c => ({ id: c.id, c: c.c, x: c.x, by: c.by, b: c.b || 0, mine: p.uid && c.u === p.uid ? 1 : 0 })); }

  freeSeat(p) { if (p.seat != null && this.seats.get(p.seat) === p.id) this.seats.delete(p.seat); p.seat = null; }

  broadcast(o, except) {
    const s = JSON.stringify(o);
    for (const ws of this.players.keys()) { if (ws === except) continue; try { ws.send(s); } catch (_) {} }
  }

  // 每 250ms 廣播一次所有人的位置
  tick() {
    if (this.timer) return;
    const loop = () => {
      if (!this.players.size) { this.timer = null; this.lastMin = 0; return; }
      const list = [...this.players.values()].filter(p => p.look).map(p => ({ id: p.id, x: p.x, z: p.z, f: p.f, h: p.h, b: p.b, k: p.k || 0, s: p.s, n: p.name || '', st: p.seat ?? -1, su: p.su || 0, look: p.look }));
      this.broadcast({ t: 'state', players: list, online: list.length, total: this.total });
      if (Date.now() - (this.lastMin || 0) >= 60000) { if (this.lastMin) this.creditActive(); this.lastMin = Date.now(); }
      this.timer = setTimeout(loop, list.length > 40 ? 400 : 250); // 人多時降低更新頻率，伺服器才撐得住
    };
    this.timer = setTimeout(loop, 250);
  }
}

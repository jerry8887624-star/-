// 「我們的小島」網站＋連線伺服器（Cloudflare Worker + Durable Object）
// - 網站檔案由 Workers 靜態資源提供（wrangler.toml 的 [assets]），只有 /api 與 /ws 進到這裡。
// - 每座小島是一個 Island（Durable Object）：兩位島主共用的存檔、時間、訪客留言簿，以及在線上的人。
// - 情侶碼（6 碼，7 天內有效、用一次就失效）記在 Registry（只有一個）。
// - 島主用「鑰匙」（隨機 32 字，只存雜湊）登入；朋友用訪客連結裡的訪客碼，最多 4 位，島主可重設、請離開、鎖島。
// - 不收真實姓名、電話等個資；暱稱與留言用 js/chatfilter.js 過濾（擋網址、聯絡方式、不雅字詞）。
import { checkChat, checkName } from '../js/chatfilter.js';

const MAX_GUESTS = 4;
const PAIR_DAYS = 7;
const HOUR_MS = 36000; // 遊戲裡一小時 = 36 秒（跟前端一樣）
// 兩位島主共用的存檔欄位
const SHARED = ['names', 'looks', 'anniv', 'love', 'day', 'diary', 'fish', 'shells', 'garden', 'castles', 'letterDay', 'flowersGiven', 'dishes', 'wishes', 'fireworks', 'laps', 'coupleWorn'];
const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const rnd = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return [...a].map(x => ABC[x % ABC.length]).join(''); };
const hash = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('');
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const num = (v, lo, hi) => { v = Number(v); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : lo; };
const int = (v, lo, hi) => Math.round(num(v, lo, hi));
function cleanLook(l) {
  l = l || {};
  return { gender: l.gender === 'm' ? 'm' : 'f', hair: int(l.hair, 0, 20), hairColor: int(l.hairColor, 0, 20), skin: int(l.skin, 0, 20), outfit: int(l.outfit, 0, 30),
    glasses: int(l.glasses, 0, 2), acc: int(l.acc, 0, 2), head: int(l.head, 0, 10), eye: int(l.eye, 0, 10), mouth: int(l.mouth, 0, 10), cheek: int(l.cheek, 0, 5) };
}
function cleanSave(s) {
  const o = {}; if (!s || typeof s !== 'object') return o;
  for (const k of SHARED) if (k in s) o[k] = s[k];
  if (o.looks) o.looks = [cleanLook(o.looks[0]), cleanLook(o.looks[1])];
  if (o.names) o.names = [0, 1].map(i => { const r = checkName(o.names?.[i]); return r.ok ? r.text : ''; });
  if (Array.isArray(o.diary)) o.diary = o.diary.slice(0, 300);
  if (JSON.stringify(o).length > 200000) delete o.diary;
  return o;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url), path = url.pathname.replace(/^.*?\/(api|ws)\b/, '/$1');
    if (path === '/api/ping') return json({ ok: true });
    if (path === '/ws') {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('websocket only', { status: 426 });
      const island = (url.searchParams.get('island') || '').toUpperCase(); if (!/^[A-Z0-9]{10}$/.test(island)) return new Response('bad island', { status: 400 });
      return env.ISLAND.get(env.ISLAND.idFromName(island)).fetch(req);
    }
    if (req.method !== 'POST' || !path.startsWith('/api/')) return new Response('Not found', { status: 404 });
    let body = {}; try { body = await req.json(); } catch (e) {}
    const reg = env.REGISTRY.get(env.REGISTRY.idFromName('registry'));
    const call = (stub, p, b) => stub.fetch('https://x' + p, { method: 'POST', body: JSON.stringify(b || {}) });
    if (path === '/api/create') {
      const island = rnd(10), stub = env.ISLAND.get(env.ISLAND.idFromName(island));
      const r = await (await call(stub, '/init', { island, save: body.save, role: body.role ? 1 : 0 })).json();
      if (r.error) return json(r, 400);
      const pair = await (await call(reg, '/new', { island })).json();
      await call(stub, '/setpair', { code: pair.code, exp: pair.exp });
      return json({ island, key: r.key, role: r.role, pair: pair.code });
    }
    if (path === '/api/pair') {
      const code = String(body.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const r = await (await call(reg, '/take', { code })).json();
      if (!r.island) return json({ error: '情侶碼不對或已經過期了' }, 400);
      const stub = env.ISLAND.get(env.ISLAND.idFromName(r.island));
      const j = await (await call(stub, '/pair', { code })).json();
      if (j.error) return json(j, 400);
      return json({ island: r.island, key: j.key, role: j.role });
    }
    if (path === '/api/peek') {
      const island = String(body.island || '').toUpperCase(); if (!/^[A-Z0-9]{10}$/.test(island)) return json({ error: '連結不對' }, 400);
      const j = await (await call(env.ISLAND.get(env.ISLAND.idFromName(island)), '/peek', { guest: body.guest })).json();
      return json(j, j.error ? 400 : 200);
    }
    return new Response('Not found', { status: 404 });
  },
};

// 情侶碼 → 小島
export class Registry {
  constructor(state) { this.state = state; }
  async fetch(req) {
    const p = new URL(req.url).pathname, b = await req.json().catch(() => ({})), S = this.state.storage;
    if (p === '/new') {
      let code; for (let i = 0; i < 20; i++) { code = rnd(6); if (!(await S.get('c:' + code))) break; }
      const exp = Date.now() + PAIR_DAYS * 864e5; await S.put('c:' + code, { island: b.island, exp });
      return json({ code, exp });
    }
    if (p === '/take') {
      const v = await S.get('c:' + b.code); if (!v || v.exp < Date.now()) { if (v) await S.delete('c:' + b.code); return json({}); }
      await S.delete('c:' + b.code); return json({ island: v.island });
    }
    return json({ error: 'no' }, 404);
  }
}

const send = (s, o) => { try { s.ws.send(JSON.stringify(o)); } catch (_) {} };

export class Island {
  constructor(state, env) {
    this.state = state; this.env = env; this.sessions = new Map(); this.seq = 0;
    state.blockConcurrencyWhile(async () => {
      this.meta = (await state.storage.get('meta')) || null;
      this.save = (await state.storage.get('save')) || {};
      this.clock = (await state.storage.get('clock')) || { tod: 9, day: 1, at: Date.now() };
      this.book = (await state.storage.get('book')) || [];
    });
  }
  now() { // 現在的遊戲時間
    let { tod, day, at } = this.clock; tod += (Date.now() - at) / HOUR_MS;
    while (tod >= 24) { tod -= 24; day++; } return { tod, day, at: Date.now() };
  }
  persist(k) { return this.state.storage.put(k, this[k]); }
  others(s) { return [...this.sessions.values()].filter(x => x !== s && x.ready); }
  bcast(o, except) { for (const s of this.sessions.values()) if (s !== except && s.ready) send(s, o); }
  info(s) { return { id: s.id, role: s.role, name: s.name, look: s.look, pos: s.pos || null }; }
  ownerView() { return { guest: this.meta.guest, locked: !!this.meta.locked, paired: !!(this.meta.keys[0] && this.meta.keys[1]), pair: this.meta.pair && this.meta.pair.exp > Date.now() ? this.meta.pair.code : '', book: this.book.slice(0, 50) }; }

  async fetch(req) {
    const url = new URL(req.url);
    if (req.headers.get('Upgrade') === 'websocket') return this.join(url);
    const b = await req.json().catch(() => ({}));
    if (url.pathname === '/init') {
      if (this.meta) return json({ error: 'exists' });
      const key = rnd(32), role = b.role ? 1 : 0, keys = [null, null]; keys[role] = await hash(key);
      this.meta = { island: b.island, keys, guest: rnd(6), locked: false, pair: null, created: Date.now() };
      this.save = cleanSave(b.save); const sd = b.save || {};
      this.clock = { tod: num(sd.tod, 0, 23.99) || 9, day: int(sd.day, 1, 99999) || 1, at: Date.now() };
      await Promise.all([this.persist('meta'), this.persist('save'), this.persist('clock')]);
      return json({ key, role });
    }
    if (!this.meta) return json({ error: '找不到這座小島' });
    if (url.pathname === '/setpair') { this.meta.pair = { code: b.code, exp: b.exp }; await this.persist('meta'); return json({ ok: 1 }); }
    if (url.pathname === '/pair') {
      if (this.meta.pair?.code !== b.code) return json({ error: '情侶碼不對或已經過期了' });
      const role = this.meta.keys[0] ? 1 : 0; if (this.meta.keys[role]) return json({ error: '這座小島已經有兩位島主了' });
      const key = rnd(32); this.meta.keys[role] = await hash(key); this.meta.pair = null; await this.persist('meta');
      this.bcast({ t: 'paired' });
      return json({ key, role });
    }
    if (url.pathname === '/peek') {
      if (b.guest !== this.meta.guest) return json({ error: '這個訪客連結已經失效了，請島主重新分享' });
      const guests = [...this.sessions.values()].filter(s => s.role === 'g').length;
      return json({ names: this.save.names || ['', ''], looks: this.save.looks || null, locked: !!this.meta.locked, full: guests >= MAX_GUESTS });
    }
    return json({ error: 'no' }, 404);
  }

  async join(url) {
    const pair = new WebSocketPair(), [client, server] = Object.values(pair);
    server.accept();
    const fail = (code, why) => { server.close(code, why); return new Response(null, { status: 101, webSocket: client }); };
    if (!this.meta) return fail(4004, '找不到這座小島');
    let role = null; const key = url.searchParams.get('key'), guest = url.searchParams.get('guest');
    if (key) { const h = await hash(key); role = this.meta.keys.indexOf(h); if (role < 0) return fail(4004, '鑰匙不對'); }
    else if (guest) {
      if (guest !== this.meta.guest) return fail(4004, '訪客連結已經失效了');
      if (this.meta.locked) return fail(4003, '小島目前鎖起來了');
      if ([...this.sessions.values()].filter(s => s.role === 'g').length >= MAX_GUESTS) return fail(4005, '小島上的朋友已經滿了（最多 4 位）');
      role = 'g';
    } else return fail(4004, '缺少鑰匙');
    // 同一位島主從另一支手機登入：舊的那個斷線
    if (role !== 'g') for (const s of this.sessions.values()) if (s.role === role) { try { s.ws.close(4002, '你在另一支手機登入了'); } catch (_) {} this.sessions.delete(s.ws); }
    const s = { ws: server, id: 'p' + (++this.seq), role, name: '', look: null, pos: null, ready: false, last: {} };
    this.sessions.set(server, s);
    server.addEventListener('message', e => this.onMsg(s, e.data));
    const bye = () => { if (!this.sessions.has(server)) return; this.sessions.delete(server); if (s.ready) this.bcast({ t: 'leave', id: s.id, role: s.role, name: s.name }); };
    server.addEventListener('close', bye); server.addEventListener('error', bye);
    return new Response(null, { status: 101, webSocket: client });
  }

  gap(s, k, ms) { const now = Date.now(); if (now - (s.last[k] || 0) < ms) return true; s.last[k] = now; return false; }

  async onMsg(s, raw) {
    if (typeof raw !== 'string' || raw.length > 250000) return;
    let m; try { m = JSON.parse(raw); } catch (_) { return; }
    const owner = s.role === 0 || s.role === 1;
    if (m.t === 'hi') {
      if (s.ready) return;
      if (s.role === 'g') { const r = checkName(m.name); s.name = r.ok && r.text ? r.text : '朋友'; s.look = cleanLook(m.look); }
      else { s.name = (this.save.names || [])[s.role] || ''; s.look = (this.save.looks || [])[s.role] || null; }
      s.ready = true;
      send(s, { t: 'welcome', id: s.id, role: s.role, save: this.save, clock: this.now(), peers: this.others(s).map(x => this.info(x)), owner: owner ? this.ownerView() : null });
      this.bcast({ t: 'join', p: this.info(s) }, s);
      if (s.role === 'g') { this.addMemo({ icon: '🎈', text: `${s.name} 來島上玩` }); }
      return;
    }
    if (!s.ready) return;
    switch (m.t) {
      case 'pos': {
        const p = { x: num(m.x, -60, 60), z: num(m.z, -60, 60), ry: num(m.ry, -100, 100), y: m.y == null ? null : num(m.y, -5, 10), sc: m.sc === 'in' ? 'in' : 'out',
          pose: ['stand', 'sit', 'lie', 'swing', 'recline'].includes(m.pose) ? m.pose : 'stand', mv: m.mv ? 1 : 0, act: String(m.act || '').slice(0, 16), hand: String(m.hand || '').slice(0, 8), tilt: num(m.tilt, -1, 1) };
        s.pos = p; this.bcast({ t: 'pos', id: s.id, ...p }, s); break;
      }
      case 'emo': if (this.gap(s, 'emo', 300)) return; this.bcast({ t: 'emo', id: s.id, k: String(m.k || '').slice(0, 12), d: num(m.d, 0.3, 8) }, s); break;
      case 'fx': if (this.gap(s, 'fx', 150)) return; this.bcast({ t: 'fx', id: s.id, k: String(m.k || '').slice(0, 12), a: m.a == null ? null : num(m.a, -1e6, 1e6) }, s); break;
      case 'boat': if (this.gap(s, 'boat', 120)) return; this.bcast({ t: 'boat', x: num(m.x, -80, 80), z: num(m.z, -80, 80), ry: num(m.ry, -100, 100), home: m.home ? 1 : 0 }, s); break;
      case 'item': this.bcast({ t: 'item', id: s.id, k: String(m.k || '').slice(0, 12) }, s); break;
      case 'say': { // 朋友之間的一句話（40 字內，過濾）
        if (this.gap(s, 'say', 1500)) return; const r = checkChat(m.text); if (!r.ok) return send(s, { t: 'err', why: r.why });
        this.bcast({ t: 'say', id: s.id, text: r.text }); break;
      }
      case 'love': case 'loveok': { // 情侶互動：只有島主之間
        if (!owner || this.gap(s, 'love', 400)) return; const to = [...this.sessions.values()].find(x => x.id === m.to && (x.role === 0 || x.role === 1)); if (!to) return;
        send(to, { t: m.t, from: s.id, k: String(m.k || '').slice(0, 12), ok: m.ok ? 1 : 0 }); break;
      }
      case 'save': {
        if (!owner || !m.keys || typeof m.keys !== 'object') return;
        const keys = cleanSave(m.keys); if (!Object.keys(keys).length) return;
        Object.assign(this.save, keys); await this.persist('save');
        if (keys.names) for (const x of this.sessions.values()) if (x.role === 0 || x.role === 1) x.name = this.save.names[x.role];
        if (keys.looks) for (const x of this.sessions.values()) if (x.role === 0 || x.role === 1) x.look = this.save.looks[x.role];
        this.bcast({ t: 'save', keys }, s); break;
      }
      case 'addlove': if (!owner) return; this.save.love = int((this.save.love || 0) + int(m.n, 0, 30), 0, 1e7); await this.persist('save'); this.bcast({ t: 'save', keys: { love: this.save.love } }); break;
      case 'memo': if (!owner) return; await this.addMemo({ icon: String(m.icon || '').slice(0, 4), text: String(m.text || '').slice(0, 80), d: String(m.d || '').slice(0, 12), day: int(m.day, 1, 99999) }, s); break;
      case 'tod': if (!owner) return; this.clock = { tod: num(m.tod, 0, 23.999), day: int(m.day, 1, 99999), at: Date.now() }; await this.persist('clock'); this.bcast({ t: 'clock', clock: this.clock }, s); break;
      case 'book': { // 訪客留言簿
        if (this.gap(s, 'book', 20000)) return send(s, { t: 'err', why: 'slow' }); const r = checkChat(m.text); if (!r.ok) return send(s, { t: 'err', why: r.why });
        const e = { n: s.name || '朋友', text: r.text, at: Date.now() }; this.book.unshift(e); this.book.length = Math.min(this.book.length, 100); await this.persist('book');
        for (const x of this.sessions.values()) if (x.role !== 'g' || x === s) send(x, { t: 'book', e });
        if (s.role === 'g') await this.addMemo({ icon: '📝', text: `${s.name} 在留言簿寫：「${r.text}」` });
        break;
      }
      case 'kick': { if (!owner) return; const x = [...this.sessions.values()].find(y => y.id === m.id && y.role === 'g'); if (x) { try { x.ws.close(4001, '島主請你先離開了'); } catch (_) {} } break; }
      case 'lock': if (!owner) return; this.meta.locked = !!m.on; await this.persist('meta'); this.ownersSend({ t: 'owner', owner: this.ownerView() }); break;
      case 'newguest': if (!owner) return; this.meta.guest = rnd(6); await this.persist('meta'); this.ownersSend({ t: 'owner', owner: this.ownerView() }); break;
      case 'newpair': {
        if (!owner || (this.meta.keys[0] && this.meta.keys[1])) return;
        const reg = this.env.REGISTRY.get(this.env.REGISTRY.idFromName('registry'));
        const p = await (await reg.fetch('https://x/new', { method: 'POST', body: JSON.stringify({ island: this.meta.island }) })).json();
        this.meta.pair = { code: p.code, exp: p.exp }; await this.persist('meta'); this.ownersSend({ t: 'owner', owner: this.ownerView() }); break;
      }
    }
  }
  ownersSend(o) { for (const x of this.sessions.values()) if (x.ready && (x.role === 0 || x.role === 1)) send(x, o); }
  async addMemo(e, except) {
    const d = new Date(Date.now() + 8 * 3600e3); const memo = { d: e.d || `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}`, day: e.day || this.now().day, icon: e.icon || '💗', text: e.text };
    this.save.diary = [memo, ...(this.save.diary || [])].slice(0, 300); await this.persist('save');
    for (const x of this.sessions.values()) if (x !== except && x.ready && (x.role === 0 || x.role === 1)) send(x, { t: 'memo', m: memo });
  }
}

// 「線上參拜文昌帝君」多人連線伺服器（Cloudflare Worker + Durable Object）
// 只轉送：位置、外觀、預設打氣語的編號。不收姓名、生日、住址、准考證或任何自由輸入文字，也不存檔。
// 唯一會存的是「累計人次」一個數字。部署步驟見 README.md。

const MAX_PLAYERS = 60;
const CHEER_COUNT = 8;           // 與前端 data.js 的 CHEERS 數量一致
const CHEER_GAP_MS = 2000;       // 每人兩次打氣至少間隔 2 秒

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/ws') {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('websocket only', { status: 426 });
      const id = env.TEMPLE.idFromName('wenchang');
      return env.TEMPLE.get(id).fetch(req);
    }
    return new Response('ok');
  }
};

const num = (v, lo, hi) => { v = Number(v); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : 0; };
function cleanLook(l) {
  l = l || {};
  return { gender: l.gender === 'm' ? 'm' : 'f', hair: num(l.hair, 0, 20) | 0, hairColor: num(l.hairColor, 0, 20) | 0,
    skin: num(l.skin, 0, 20) | 0, outfit: num(l.outfit, 0, 20) | 0, glasses: num(l.glasses, 0, 2) | 0 };
}

export class Temple {
  constructor(state) {
    this.state = state;
    this.players = new Map(); // ws -> player
    this.seq = 0;
    this.timer = null;
    state.blockConcurrencyWhile(async () => { this.total = (await state.storage.get('total')) || 0; this.seq = this.total; });
  }

  async fetch(req) {
    if (this.players.size >= MAX_PLAYERS) return new Response('full', { status: 503 });
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();
    const p = { id: ++this.seq, x: 0, z: 13, f: Math.PI, h: 0, b: 0, look: null, lastCheer: 0, ws: server };
    this.players.set(server, p);
    server.addEventListener('message', e => this.onMessage(p, e.data));
    const bye = () => { this.players.delete(server); this.broadcast({ t: 'leave', id: p.id }); };
    server.addEventListener('close', bye); server.addEventListener('error', bye);
    this.tick();
    return new Response(null, { status: 101, webSocket: client });
  }

  async onMessage(p, raw) {
    if (typeof raw !== 'string' || raw.length > 600) return;
    let m; try { m = JSON.parse(raw); } catch (_) { return; }
    if (m.t === 'hi' && !p.look) {
      p.look = cleanLook(m.look);
      this.total += 1; this.state.storage.put('total', this.total);
      p.ws.send(JSON.stringify({ t: 'welcome', you: p.id, total: this.total }));
    } else if (m.t === 'look') {
      p.look = cleanLook(m.look);
    } else if (m.t === 'pos') {
      p.x = num(m.x, -12, 25); p.z = num(m.z, -12, 25); p.f = num(m.f, -10, 10); p.h = m.h ? 1 : 0; p.b = m.b ? 1 : 0;
    } else if (m.t === 'cheer') {
      const now = Date.now(), i = num(m.i, 0, CHEER_COUNT - 1) | 0, to = num(m.to, 0, 1e9) | 0;
      if (now - p.lastCheer < CHEER_GAP_MS) { p.ws.send(JSON.stringify({ t: 'slow' })); return; }
      p.lastCheer = now;
      this.broadcast({ t: 'cheer', from: p.id, to, i });
    }
  }

  broadcast(o) {
    const s = JSON.stringify(o);
    for (const ws of this.players.keys()) { try { ws.send(s); } catch (_) {} }
  }

  // 每 250ms 廣播一次所有人的位置
  tick() {
    if (this.timer) return;
    const loop = () => {
      if (!this.players.size) { this.timer = null; return; }
      const list = [...this.players.values()].filter(p => p.look).map(p => ({ id: p.id, x: p.x, z: p.z, f: p.f, h: p.h, b: p.b, look: p.look }));
      this.broadcast({ t: 'state', players: list, online: list.length, total: this.total });
      this.timer = setTimeout(loop, 250);
    };
    this.timer = setTimeout(loop, 250);
  }
}

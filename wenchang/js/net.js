// 和其他香客連線（WebSocket）。沒有設定伺服器網址時整個功能不啟用。
export class Net {
  constructor(url, handlers) {
    this.url = url; this.h = handlers; this.ws = null; this.alive = false; this.retry = 1000; this.last = '';
  }
  connect(look = this.look, name = this.name || '') {
    this.look = look; this.name = name;
    if (!this.url) return;
    let ws;
    try { ws = new WebSocket(this.url); } catch (e) { return; }
    this.ws = ws;
    ws.onopen = () => { this.alive = true; this.retry = 1000; this.send({ t: 'hi', look: this.look, name: this.name, uid: this.uid || '' }); this.h.status?.(true); };
    ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (_) { return; } if (m.t === 'seat' && this.seatWait?.(m)) return; this.h.message?.(m); };
    ws.onclose = () => {
      const was = this.alive; this.alive = false; this.h.status?.(false, was);
      setTimeout(() => this.connect(), this.retry); this.retry = Math.min(30000, this.retry * 2);
    };
    ws.onerror = () => ws.close();
  }
  send(o) { if (this.alive && this.ws?.readyState === 1) this.ws.send(JSON.stringify(o)); }
  // 位置只在有變化時送出，最多每 200ms 一次
  pos(x, z, f, h, b, k) {
    const s = [x.toFixed(2), z.toFixed(2), f.toFixed(2), h ? 1 : 0, b ? 1 : 0, k ? 1 : 0].join();
    const now = performance.now();
    if (s === this.last || now - (this.lastT || 0) < 200) return;
    this.last = s; this.lastT = now;
    this.send({ t: 'pos', x: +x.toFixed(2), z: +z.toFixed(2), f: +f.toFixed(2), h: h ? 1 : 0, b: b ? 1 : 0, k: k ? 1 : 0 });
  }
  setLook(look) { this.look = look; this.send({ t: 'look', look }); }
  setName(name) { this.name = name; this.send({ t: 'name', name }); }
  cheer(to, i) { this.send({ t: 'cheer', to, i }); }
  emote(e) { this.send({ t: 'emote', e }); }
  step(s) { this.send({ t: 'step', s }); }
  card(c, x) { this.send({ t: 'card', c, x }); }
  dm(to, text) { this.send({ t: 'dm', to, text }); }
  dmOff(off) { this.send({ t: 'dmoff', off: off ? 1 : 0 }); }
  block(id) { this.send({ t: 'block', id }); }
  unblock(id) { this.send({ t: 'unblock', id }); }
  bless(id) { this.send({ t: 'bless', id }); }
  bang(x) { this.send({ t: 'bang', x }); }
  study(on) { this.send({ t: 'study', on: on ? 1 : 0 }); }
  lamp(x) { this.send({ t: 'lamp', x }); }
  wish() { this.send({ t: 'wish' }); }
  // 向伺服器要一個座位（拜墊／拜位）；離線時直接當作成功
  seat(i) {
    if (!this.alive) return Promise.resolve(true);
    return new Promise(res => {
      const t = setTimeout(() => { this.seatWait = null; res(true); }, 1500);
      this.seatWait = m => { if (m.i !== i) return false; clearTimeout(t); this.seatWait = null; res(!!m.ok); return true; };
      this.send({ t: 'seat', i });
    });
  }
  leaveSeat() { this.send({ t: 'seat', i: -1 }); }
}

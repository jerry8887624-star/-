// 和其他香客連線（WebSocket）。沒有設定伺服器網址時整個功能不啟用。
export class Net {
  constructor(url, handlers) {
    this.url = url; this.h = handlers; this.ws = null; this.alive = false; this.retry = 1000; this.last = '';
  }
  connect(look) {
    this.look = look;
    if (!this.url) return;
    let ws;
    try { ws = new WebSocket(this.url); } catch (e) { return; }
    this.ws = ws;
    ws.onopen = () => { this.alive = true; this.retry = 1000; this.send({ t: 'hi', look: this.look }); this.h.status?.(true); };
    ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (_) { return; } this.h.message?.(m); };
    ws.onclose = () => {
      const was = this.alive; this.alive = false; this.h.status?.(false, was);
      setTimeout(() => this.connect(this.look), this.retry); this.retry = Math.min(30000, this.retry * 2);
    };
    ws.onerror = () => ws.close();
  }
  send(o) { if (this.alive && this.ws?.readyState === 1) this.ws.send(JSON.stringify(o)); }
  // 位置只在有變化時送出，最多每 200ms 一次
  pos(x, z, f, h, b) {
    const s = [x.toFixed(2), z.toFixed(2), f.toFixed(2), h ? 1 : 0, b ? 1 : 0].join();
    const now = performance.now();
    if (s === this.last || now - (this.lastT || 0) < 200) return;
    this.last = s; this.lastT = now;
    this.send({ t: 'pos', x: +x.toFixed(2), z: +z.toFixed(2), f: +f.toFixed(2), h: h ? 1 : 0, b: b ? 1 : 0 });
  }
  setLook(look) { this.look = look; this.send({ t: 'look', look }); }
  cheer(to, i) { this.send({ t: 'cheer', to, i }); }
  emote(e) { this.send({ t: 'emote', e }); }
  step(s) { this.send({ t: 'step', s }); }
  card(c, x) { this.send({ t: 'card', c, x }); }
  invite(to) { this.send({ t: 'invite', to }); }
  accept(from) { this.send({ t: 'accept', from }); }
  decline(from) { this.send({ t: 'decline', from }); }
  say(text) { this.send({ t: 'msg', text }); }
  endChat() { this.send({ t: 'end' }); }
  block(id) { this.send({ t: 'block', id }); }
}

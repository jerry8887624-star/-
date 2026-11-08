// 連線：兩位島主＋最多 4 位朋友在同一座小島（Cloudflare Worker + Durable Object，程式在 worker/island.js）
// 只有部署在 Cloudflare（同一個網址提供 /api 與 /ws）時才會啟用；GitHub Pages 上是單機版。
const KEY = 'nest.net';
export const auth = (() => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } })();
export function saveAuth(a) { try { a ? localStorage.setItem(KEY, JSON.stringify(a)) : localStorage.removeItem(KEY); } catch (e) {} }

// 這個網址有沒有連線伺服器
let _avail = null;
export function serverAvailable() {
  if (_avail) return _avail;
  if (location.protocol === 'file:') return (_avail = Promise.resolve(false));
  return (_avail = fetch('api/ping', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(j => !!j?.ok).catch(() => false));
}
async function post(path, body) {
  const r = await fetch('api/' + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) });
  let j = null; try { j = await r.json(); } catch (e) {}
  if (!r.ok || !j || j.error) throw new Error(j?.error || '連線失敗，請稍後再試');
  return j;
}
// 建立小島（上傳目前的存檔），回傳 { island, key, role, pair }
export const createIsland = (save, role) => post('create', { save, role });
// 用情侶碼加入，回傳 { island, key, role }
export const pairIsland = code => post('pair', { code });
// 看訪客連結對應的小島（顯示名字用）
export const peekIsland = (island, guest) => post('peek', { island, guest });

export class Net {
  constructor(h) { this.h = h; this.ws = null; this.alive = false; this.retry = 1000; this.lastPos = ''; this.lastT = 0; this.closed = false; }
  // a：{ island, key } 島主，或 { island, guest, name, look } 訪客
  connect(a) {
    this.a = a; this.closed = false;
    const q = new URLSearchParams({ island: a.island }); if (a.key) q.set('key', a.key); if (a.guest) q.set('guest', a.guest);
    const url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + location.pathname.replace(/[^/]*$/, '') + 'ws?' + q;
    let ws; try { ws = new WebSocket(url); } catch (e) { return; }
    this.ws = ws;
    ws.onopen = () => { this.alive = true; this.retry = 1000; this.send({ t: 'hi', name: a.name || '', look: a.look || null }); };
    ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (_) { return; } this.h.message?.(m); };
    ws.onclose = ev => {
      const was = this.alive; this.alive = false; this.h.status?.(false, was, ev.code, ev.reason);
      if (this.closed || ev.code === 4001 || ev.code === 4003 || ev.code === 4004) return; // 被請離開、島鎖起來、驗證失敗：不重連
      setTimeout(() => this.connect(this.a), this.retry); this.retry = Math.min(20000, this.retry * 2);
    };
    ws.onerror = () => ws.close();
  }
  close() { this.closed = true; try { this.ws?.close(1000); } catch (e) {} }
  send(o) { if (this.alive && this.ws?.readyState === 1) this.ws.send(JSON.stringify(o)); }
  // 位置：有變化才送，最多每 150ms 一次
  pos(o) {
    const s = JSON.stringify(o), now = performance.now();
    if (s === this.lastPos && now - this.lastT < 2000) return; if (now - this.lastT < 150) return;
    this.lastPos = s; this.lastT = now; this.send({ t: 'pos', ...o });
  }
}

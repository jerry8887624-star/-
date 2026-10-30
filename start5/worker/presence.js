// 「先動五分鐘」同時專注人數（Cloudflare Worker + KV）
// 只記一個隨機匿名代碼與心跳時間，90 秒沒心跳就自動過期，不存任何個人資料。
// 部署步驟見 worker/README.md；部署後把網址填進 js/v2.js 的 PRESENCE_URL。
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', ...CORS } });

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
    const { pathname } = new URL(req.url);
    let id = '';
    try { id = String((await req.json()).id || '').replace(/[^a-z0-9]/gi, '').slice(0, 16); } catch (e) {}
    if (!id) return json({ error: 'id required' }, 400);
    if (pathname.endsWith('/beat')) await env.PRESENCE.put('p:' + id, '1', { expirationTtl: 90 });
    else if (pathname.endsWith('/leave')) await env.PRESENCE.delete('p:' + id);
    else return json({ error: 'not found' }, 404);
    const list = await env.PRESENCE.list({ prefix: 'p:', limit: 1000 });
    return json({ count: list.keys.length });
  }
};

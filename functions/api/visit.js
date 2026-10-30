// 靈犀拜訪人次（Cloudflare Pages Function）
// 資料存在 Cloudflare D1，綁定名稱 DB；只存「日期、次數」兩欄，不記錄任何個人資料或 IP。
// GET  /api/visit → {total, today}
// POST /api/visit → 今天加 1 後回傳 {total, today}（App 端每台手機每天只送一次）
const twDay = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10); // 以台灣時間換日
const json = (o, status = 200) => new Response(JSON.stringify(o), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});
async function run(db, d, add) {
  if (add) await db.prepare('INSERT INTO hits(day, n) VALUES(?1, 1) ON CONFLICT(day) DO UPDATE SET n = n + 1').bind(d).run();
  const r = await db.prepare('SELECT COALESCE(SUM(n), 0) AS total, COALESCE(MAX(CASE WHEN day = ?1 THEN n END), 0) AS today FROM hits').bind(d).first();
  return { total: r.total, today: r.today };
}
export async function onRequest({ request, env }) {
  if (request.method !== 'GET' && request.method !== 'POST') return json({ error: 'method' }, 405);
  if (!env.DB) return json({ error: 'no-db' }, 503);
  const d = twDay(), add = request.method === 'POST';
  try {
    return json(await run(env.DB, d, add));
  } catch (e) {
    if (!/no such table/i.test(String(e))) return json({ error: 'db' }, 500);
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS hits(day TEXT PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0)').run();
    return json(await run(env.DB, d, add));
  }
}

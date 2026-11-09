// 版本更新：偵測到新版就先列出更新內容（立即更新／稍後更新）；更新後介紹一次
import { CHANGES } from './changes.js';

export const APP_VER = CHANGES[0].v;
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const get = (k, d) => { try { const v = localStorage.getItem('nest.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
const set = (k, v) => { try { localStorage.setItem('nest.' + k, JSON.stringify(v)); } catch (e) {} };
const newer = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };

let pending = null, laterFor = '';

function show(list, mode) {
  const dlg = $('#update-dlg'), top = list[0] || CHANGES[0];
  $('#update-title').textContent = mode === 'pre' ? `有新版本 ${top.n || top.v}` : `已更新到 ${top.n || top.v} 版`;
  $('#update-list').innerHTML = list.flatMap(c => c.items).slice(0, 6).map(([t, d]) => `<li><b>${esc(t)}</b><span>${esc(d)}</span></li>`).join('');
  $('#update-go').hidden = mode !== 'pre'; $('#update-later').hidden = mode !== 'pre'; $('#update-ok').hidden = mode === 'pre';
  if (!dlg.open) dlg.showModal();
}

// 線上的更新紀錄比手上的新 → 提示更新
async function check() {
  let all;
  try { all = await (await fetch('changes.json?t=' + Date.now(), { cache: 'no-store' })).json(); } catch (e) { return; }
  if (!Array.isArray(all) || !all[0] || !newer(all[0].v, APP_VER)) return;
  pending = all;
  $('#update-chip').hidden = false;
  if (laterFor !== all[0].v) show(all.filter(c => newer(c.v, APP_VER)).slice(0, 3), 'pre');
}

async function applyUpdate() {
  $('#update-go').disabled = true; $('#update-go').textContent = '更新中…';
  // 等新版的離線快取裝好再重新開（最多 6 秒），網址加上時間讓瀏覽器一定拿新的網頁
  try {
    const r = await navigator.serviceWorker?.getRegistration(); await r?.update();
    const w = r?.installing || r?.waiting;
    if (w) await new Promise(res => { const t = setTimeout(res, 6000); w.addEventListener('statechange', () => { if (w.state === 'activated') { clearTimeout(t); res(); } }); });
  } catch (e) {}
  await new Promise(r => setTimeout(r, 600)); /* 讓新版的離線快取切換完成，再重新開，避免載到一半的檔案失敗（人物變透明） */
  location.replace(location.pathname + (location.search ? location.search + '&' : '?') + 'u=' + Date.now());
}

// 更新後第一次打開：介紹這次改了什麼
export function showNewsOnce() {
  // 以前玩過（存過角色外觀）但還沒有版本紀錄的人，當作從上一版更新上來
  const seen = get('ver', null) || (get('look', null) && CHANGES[1]?.v) || null; set('ver', APP_VER);
  if (!seen || seen === APP_VER || !newer(APP_VER, seen)) return;
  show(CHANGES.filter(c => newer(c.v, seen)).slice(0, 3), 'post');
}

export function initUpdates() {
  $('#app-ver').textContent = `版本 ${APP_VER}`;
  $('#update-go').onclick = applyUpdate;
  $('#update-later').onclick = () => { laterFor = pending?.[0]?.v || ''; $('#update-dlg').close(); };
  $('#update-ok').onclick = () => $('#update-dlg').close();
  $('#update-chip').onclick = () => { if (pending) show(pending.filter(c => newer(c.v, APP_VER)).slice(0, 3), 'pre'); };
  setTimeout(check, 3000);
  setInterval(check, 10 * 60e3);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
}

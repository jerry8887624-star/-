// 密語的文字檢查：前端（即時提示）與伺服器（最後把關）共用同一份規則
export const CHAT_MAX = 40;

// 不能傳的聯絡方式：通訊軟體、帳號、電話、住址、約見面
const CONTACT_LATIN = /(^|[^a-z])(line|ig|insta|instagram|telegram|tg|wechat|discord|dc|fb|facebook|threads|snap|snapchat|kakao|whatsapp|twitter|tiktok|dcard)([^a-z]|$)/;
const CONTACT_ZH = /(微信|臉書|脸书|加賴|我的賴|賴id|私訊|私信|加我|加好友|帳號|账号|電話|电话|手機號|手機幾號|住址|地址|住哪|哪間學校|哪一間學校|見面|约见面|約出來|出來玩|视频|視訊)/;
const RUDE = ['幹你', '干你', '操你', '靠北', '靠杯', '白癡', '白痴', '智障', '去死', '廢物', '垃圾人', '賤', '婊', '約砲', '约炮', '色情', '裸', '做愛', 'fuck', 'shit', 'bitch', 'sex'];

export function checkChat(raw) {
  const text = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return { ok: false, why: 'empty' };
  if ([...text].length > CHAT_MAX) return { ok: false, why: 'long' };
  const n = text.normalize('NFKC').toLowerCase();
  if (/https?:|www\.|\.(com|net|org|tw|io|me|cc|ly|gg|co|app|link)(\b|\/)|[a-z0-9-]+\.[a-z]{2,}\//.test(n)) return { ok: false, why: 'link' };
  const squeezed = n.replace(/[\s\-_.,，、()（）]/g, '');
  if (/\d{5,}/.test(squeezed) || /[零〇一二三四五六七八九壹貳參叁肆伍陸柒捌玖]{6,}/.test(squeezed) || /@[a-z0-9_.]{2,}/.test(n)) return { ok: false, why: 'contact' };
  if (CONTACT_LATIN.test(n) || CONTACT_ZH.test(squeezed)) return { ok: false, why: 'contact' };
  if (RUDE.some(w => squeezed.includes(w))) return { ok: false, why: 'rude' };
  return { ok: true, text };
}

export const CHAT_WHY = {
  empty: '請輸入內容。',
  long: `訊息太長了（最多 ${CHAT_MAX} 字）。`,
  link: '不能傳送網址。',
  contact: '為了安全，不能傳送電話、帳號、住址或約見面。',
  rude: '請保持友善。',
};

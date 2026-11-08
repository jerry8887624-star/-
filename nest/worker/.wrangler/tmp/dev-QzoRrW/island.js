var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../js/chatfilter.js
var CHAT_MAX = 40;
var CONTACT_LATIN = /(^|[^a-z])(line|ig|insta|instagram|telegram|tg|wechat|discord|dc|fb|facebook|threads|snap|snapchat|kakao|whatsapp|twitter|tiktok|dcard)([^a-z]|$)/;
var CONTACT_ZH = /(微信|臉書|脸书|加賴|我的賴|賴id|私訊|私信|加我|加好友|帳號|账号|電話|电话|手機號|手機幾號|住址|地址|住哪|哪間學校|哪一間學校|見面|约见面|約出來|出來玩|视频|視訊)/;
var RUDE = ["\u5E79\u4F60", "\u5E72\u4F60", "\u64CD\u4F60", "\u9760\u5317", "\u9760\u676F", "\u767D\u7661", "\u767D\u75F4", "\u667A\u969C", "\u53BB\u6B7B", "\u5EE2\u7269", "\u5783\u573E\u4EBA", "\u8CE4", "\u5A4A", "\u7D04\u7832", "\u7EA6\u70AE", "\u8272\u60C5", "\u88F8", "\u505A\u611B", "fuck", "shit", "bitch", "sex"];
function checkChat(raw) {
  const text = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!text) return { ok: false, why: "empty" };
  if ([...text].length > CHAT_MAX) return { ok: false, why: "long" };
  const n = text.normalize("NFKC").toLowerCase();
  if (/https?:|www\.|\.(com|net|org|tw|io|me|cc|ly|gg|co|app|link)(\b|\/)|[a-z0-9-]+\.[a-z]{2,}\//.test(n)) return { ok: false, why: "link" };
  const squeezed = n.replace(/[\s\-_.,，、()（）]/g, "");
  if (/\d{5,}/.test(squeezed) || /[零〇一二三四五六七八九壹貳參叁肆伍陸柒捌玖]{6,}/.test(squeezed) || /@[a-z0-9_.]{2,}/.test(n)) return { ok: false, why: "contact" };
  if (CONTACT_LATIN.test(n) || CONTACT_ZH.test(squeezed)) return { ok: false, why: "contact" };
  if (RUDE.some((w) => squeezed.includes(w))) return { ok: false, why: "rude" };
  return { ok: true, text };
}
__name(checkChat, "checkChat");
var CHAT_WHY = {
  empty: "\u8ACB\u8F38\u5165\u5167\u5BB9\u3002",
  long: `\u8A0A\u606F\u592A\u9577\u4E86\uFF08\u6700\u591A ${CHAT_MAX} \u5B57\uFF09\u3002`,
  link: "\u4E0D\u80FD\u50B3\u9001\u7DB2\u5740\u3002",
  contact: "\u70BA\u4E86\u5B89\u5168\uFF0C\u4E0D\u80FD\u50B3\u9001\u96FB\u8A71\u3001\u5E33\u865F\u3001\u4F4F\u5740\u6216\u7D04\u898B\u9762\u3002",
  rude: "\u8ACB\u4FDD\u6301\u53CB\u5584\u3002"
};
var NAME_MAX = 8;
function checkName(raw) {
  const text = String(raw ?? "").replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim();
  if (!text) return { ok: true, text: "" };
  if ([...text].length > NAME_MAX) return { ok: false, why: "long" };
  const r = checkChat(text);
  return r.ok ? { ok: true, text } : r;
}
__name(checkName, "checkName");
var NAME_WHY = { long: `\u66B1\u7A31\u6700\u591A ${NAME_MAX} \u500B\u5B57\u3002`, link: "\u66B1\u7A31\u4E0D\u80FD\u653E\u7DB2\u5740\u3002", contact: "\u70BA\u4E86\u5B89\u5168\uFF0C\u66B1\u7A31\u4E0D\u80FD\u653E\u96FB\u8A71\u3001\u5E33\u865F\u6216\u5B78\u6821\u3002", rude: "\u8ACB\u63DB\u4E00\u500B\u53CB\u5584\u7684\u66B1\u7A31\u3002" };

// island.js
var MAX_GUESTS = 4;
var PAIR_DAYS = 7;
var HOUR_MS = 36e3;
var SHARED = ["names", "looks", "anniv", "love", "day", "diary", "fish", "shells", "garden", "castles", "letterDay", "flowersGiven", "dishes", "wishes", "fireworks", "laps", "coupleWorn"];
var ABC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
var rnd = /* @__PURE__ */ __name((n) => {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return [...a].map((x) => ABC[x % ABC.length]).join("");
}, "rnd");
var hash = /* @__PURE__ */ __name(async (s) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, "0")).join(""), "hash");
var json = /* @__PURE__ */ __name((o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } }), "json");
var num = /* @__PURE__ */ __name((v, lo, hi) => {
  v = Number(v);
  return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : lo;
}, "num");
var int = /* @__PURE__ */ __name((v, lo, hi) => Math.round(num(v, lo, hi)), "int");
function cleanLook(l) {
  l = l || {};
  return {
    gender: l.gender === "m" ? "m" : "f",
    hair: int(l.hair, 0, 20),
    hairColor: int(l.hairColor, 0, 20),
    skin: int(l.skin, 0, 20),
    outfit: int(l.outfit, 0, 30),
    glasses: int(l.glasses, 0, 2),
    acc: int(l.acc, 0, 2),
    head: int(l.head, 0, 10),
    eye: int(l.eye, 0, 10),
    mouth: int(l.mouth, 0, 10),
    cheek: int(l.cheek, 0, 5)
  };
}
__name(cleanLook, "cleanLook");
function cleanSave(s) {
  const o = {};
  if (!s || typeof s !== "object") return o;
  for (const k of SHARED) if (k in s) o[k] = s[k];
  if (o.looks) o.looks = [cleanLook(o.looks[0]), cleanLook(o.looks[1])];
  if (o.names) o.names = [0, 1].map((i) => {
    const r = checkName(o.names?.[i]);
    return r.ok ? r.text : "";
  });
  if (Array.isArray(o.diary)) o.diary = o.diary.slice(0, 300);
  if (JSON.stringify(o).length > 2e5) delete o.diary;
  return o;
}
__name(cleanSave, "cleanSave");
var island_default = {
  async fetch(req, env) {
    const url = new URL(req.url), path = url.pathname.replace(/^.*?\/(api|ws)\b/, "/$1");
    if (path === "/api/ping") return json({ ok: true });
    if (path === "/ws") {
      if (req.headers.get("Upgrade") !== "websocket") return new Response("websocket only", { status: 426 });
      const island = (url.searchParams.get("island") || "").toUpperCase();
      if (!/^[A-Z0-9]{10}$/.test(island)) return new Response("bad island", { status: 400 });
      return env.ISLAND.get(env.ISLAND.idFromName(island)).fetch(req);
    }
    if (req.method !== "POST" || !path.startsWith("/api/")) return new Response("Not found", { status: 404 });
    let body = {};
    try {
      body = await req.json();
    } catch (e) {
    }
    const reg = env.REGISTRY.get(env.REGISTRY.idFromName("registry"));
    const call = /* @__PURE__ */ __name((stub, p, b) => stub.fetch("https://x" + p, { method: "POST", body: JSON.stringify(b || {}) }), "call");
    if (path === "/api/create") {
      const island = rnd(10), stub = env.ISLAND.get(env.ISLAND.idFromName(island));
      const r = await (await call(stub, "/init", { island, save: body.save, role: body.role ? 1 : 0 })).json();
      if (r.error) return json(r, 400);
      const pair = await (await call(reg, "/new", { island })).json();
      await call(stub, "/setpair", { code: pair.code, exp: pair.exp });
      return json({ island, key: r.key, role: r.role, pair: pair.code });
    }
    if (path === "/api/pair") {
      const code = String(body.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      const r = await (await call(reg, "/take", { code })).json();
      if (!r.island) return json({ error: "\u60C5\u4FB6\u78BC\u4E0D\u5C0D\u6216\u5DF2\u7D93\u904E\u671F\u4E86" }, 400);
      const stub = env.ISLAND.get(env.ISLAND.idFromName(r.island));
      const j = await (await call(stub, "/pair", { code })).json();
      if (j.error) return json(j, 400);
      return json({ island: r.island, key: j.key, role: j.role });
    }
    if (path === "/api/peek") {
      const island = String(body.island || "").toUpperCase();
      if (!/^[A-Z0-9]{10}$/.test(island)) return json({ error: "\u9023\u7D50\u4E0D\u5C0D" }, 400);
      const j = await (await call(env.ISLAND.get(env.ISLAND.idFromName(island)), "/peek", { guest: body.guest })).json();
      return json(j, j.error ? 400 : 200);
    }
    return new Response("Not found", { status: 404 });
  }
};
var Registry = class {
  static {
    __name(this, "Registry");
  }
  constructor(state) {
    this.state = state;
  }
  async fetch(req) {
    const p = new URL(req.url).pathname, b = await req.json().catch(() => ({})), S = this.state.storage;
    if (p === "/new") {
      let code;
      for (let i = 0; i < 20; i++) {
        code = rnd(6);
        if (!await S.get("c:" + code)) break;
      }
      const exp = Date.now() + PAIR_DAYS * 864e5;
      await S.put("c:" + code, { island: b.island, exp });
      return json({ code, exp });
    }
    if (p === "/take") {
      const v = await S.get("c:" + b.code);
      if (!v || v.exp < Date.now()) {
        if (v) await S.delete("c:" + b.code);
        return json({});
      }
      await S.delete("c:" + b.code);
      return json({ island: v.island });
    }
    return json({ error: "no" }, 404);
  }
};
var send = /* @__PURE__ */ __name((s, o) => {
  try {
    s.ws.send(JSON.stringify(o));
  } catch (_) {
  }
}, "send");
var Island = class {
  static {
    __name(this, "Island");
  }
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = /* @__PURE__ */ new Map();
    this.seq = 0;
    state.blockConcurrencyWhile(async () => {
      this.meta = await state.storage.get("meta") || null;
      this.save = await state.storage.get("save") || {};
      this.clock = await state.storage.get("clock") || { tod: 9, day: 1, at: Date.now() };
      this.book = await state.storage.get("book") || [];
    });
  }
  now() {
    let { tod, day, at } = this.clock;
    tod += (Date.now() - at) / HOUR_MS;
    while (tod >= 24) {
      tod -= 24;
      day++;
    }
    return { tod, day, at: Date.now() };
  }
  persist(k) {
    return this.state.storage.put(k, this[k]);
  }
  others(s) {
    return [...this.sessions.values()].filter((x) => x !== s && x.ready);
  }
  bcast(o, except) {
    for (const s of this.sessions.values()) if (s !== except && s.ready) send(s, o);
  }
  info(s) {
    return { id: s.id, role: s.role, name: s.name, look: s.look, pos: s.pos || null };
  }
  ownerView() {
    return { guest: this.meta.guest, locked: !!this.meta.locked, paired: !!(this.meta.keys[0] && this.meta.keys[1]), pair: this.meta.pair && this.meta.pair.exp > Date.now() ? this.meta.pair.code : "", book: this.book.slice(0, 50) };
  }
  async fetch(req) {
    const url = new URL(req.url);
    if (req.headers.get("Upgrade") === "websocket") return this.join(url);
    const b = await req.json().catch(() => ({}));
    if (url.pathname === "/init") {
      if (this.meta) return json({ error: "exists" });
      const key = rnd(32), role = b.role ? 1 : 0, keys = [null, null];
      keys[role] = await hash(key);
      this.meta = { island: b.island, keys, guest: rnd(6), locked: false, pair: null, created: Date.now() };
      this.save = cleanSave(b.save);
      const sd = b.save || {};
      this.clock = { tod: num(sd.tod, 0, 23.99) || 9, day: int(sd.day, 1, 99999) || 1, at: Date.now() };
      await Promise.all([this.persist("meta"), this.persist("save"), this.persist("clock")]);
      return json({ key, role });
    }
    if (!this.meta) return json({ error: "\u627E\u4E0D\u5230\u9019\u5EA7\u5C0F\u5CF6" });
    if (url.pathname === "/setpair") {
      this.meta.pair = { code: b.code, exp: b.exp };
      await this.persist("meta");
      return json({ ok: 1 });
    }
    if (url.pathname === "/pair") {
      if (this.meta.pair?.code !== b.code) return json({ error: "\u60C5\u4FB6\u78BC\u4E0D\u5C0D\u6216\u5DF2\u7D93\u904E\u671F\u4E86" });
      const role = this.meta.keys[0] ? 1 : 0;
      if (this.meta.keys[role]) return json({ error: "\u9019\u5EA7\u5C0F\u5CF6\u5DF2\u7D93\u6709\u5169\u4F4D\u5CF6\u4E3B\u4E86" });
      const key = rnd(32);
      this.meta.keys[role] = await hash(key);
      this.meta.pair = null;
      await this.persist("meta");
      this.bcast({ t: "paired" });
      return json({ key, role });
    }
    if (url.pathname === "/peek") {
      if (b.guest !== this.meta.guest) return json({ error: "\u9019\u500B\u8A2A\u5BA2\u9023\u7D50\u5DF2\u7D93\u5931\u6548\u4E86\uFF0C\u8ACB\u5CF6\u4E3B\u91CD\u65B0\u5206\u4EAB" });
      const guests = [...this.sessions.values()].filter((s) => s.role === "g").length;
      return json({ names: this.save.names || ["", ""], looks: this.save.looks || null, locked: !!this.meta.locked, full: guests >= MAX_GUESTS });
    }
    return json({ error: "no" }, 404);
  }
  async join(url) {
    const pair = new WebSocketPair(), [client, server] = Object.values(pair);
    server.accept();
    const fail = /* @__PURE__ */ __name((code, why) => {
      server.close(code, why);
      return new Response(null, { status: 101, webSocket: client });
    }, "fail");
    if (!this.meta) return fail(4004, "\u627E\u4E0D\u5230\u9019\u5EA7\u5C0F\u5CF6");
    let role = null;
    const key = url.searchParams.get("key"), guest = url.searchParams.get("guest");
    if (key) {
      const h = await hash(key);
      role = this.meta.keys.indexOf(h);
      if (role < 0) return fail(4004, "\u9470\u5319\u4E0D\u5C0D");
    } else if (guest) {
      if (guest !== this.meta.guest) return fail(4004, "\u8A2A\u5BA2\u9023\u7D50\u5DF2\u7D93\u5931\u6548\u4E86");
      if (this.meta.locked) return fail(4003, "\u5C0F\u5CF6\u76EE\u524D\u9396\u8D77\u4F86\u4E86");
      if ([...this.sessions.values()].filter((s2) => s2.role === "g").length >= MAX_GUESTS) return fail(4005, "\u5C0F\u5CF6\u4E0A\u7684\u670B\u53CB\u5DF2\u7D93\u6EFF\u4E86\uFF08\u6700\u591A 4 \u4F4D\uFF09");
      role = "g";
    } else return fail(4004, "\u7F3A\u5C11\u9470\u5319");
    if (role !== "g") {
      for (const s2 of this.sessions.values()) if (s2.role === role) {
        try {
          s2.ws.close(4002, "\u4F60\u5728\u53E6\u4E00\u652F\u624B\u6A5F\u767B\u5165\u4E86");
        } catch (_) {
        }
        this.sessions.delete(s2.ws);
      }
    }
    const s = { ws: server, id: "p" + ++this.seq, role, name: "", look: null, pos: null, ready: false, last: {} };
    this.sessions.set(server, s);
    server.addEventListener("message", (e) => this.onMsg(s, e.data));
    const bye = /* @__PURE__ */ __name(() => {
      if (!this.sessions.has(server)) return;
      this.sessions.delete(server);
      if (s.ready) this.bcast({ t: "leave", id: s.id, role: s.role, name: s.name });
    }, "bye");
    server.addEventListener("close", bye);
    server.addEventListener("error", bye);
    return new Response(null, { status: 101, webSocket: client });
  }
  gap(s, k, ms) {
    const now = Date.now();
    if (now - (s.last[k] || 0) < ms) return true;
    s.last[k] = now;
    return false;
  }
  async onMsg(s, raw) {
    if (typeof raw !== "string" || raw.length > 25e4) return;
    let m;
    try {
      m = JSON.parse(raw);
    } catch (_) {
      return;
    }
    const owner = s.role === 0 || s.role === 1;
    if (m.t === "hi") {
      if (s.ready) return;
      if (s.role === "g") {
        const r = checkName(m.name);
        s.name = r.ok && r.text ? r.text : "\u670B\u53CB";
        s.look = cleanLook(m.look);
      } else {
        s.name = (this.save.names || [])[s.role] || "";
        s.look = (this.save.looks || [])[s.role] || null;
      }
      s.ready = true;
      send(s, { t: "welcome", id: s.id, role: s.role, save: this.save, clock: this.now(), peers: this.others(s).map((x) => this.info(x)), owner: owner ? this.ownerView() : null });
      this.bcast({ t: "join", p: this.info(s) }, s);
      if (s.role === "g") {
        this.addMemo({ icon: "\u{1F388}", text: `${s.name} \u4F86\u5CF6\u4E0A\u73A9` });
      }
      return;
    }
    if (!s.ready) return;
    switch (m.t) {
      case "pos": {
        const p = {
          x: num(m.x, -60, 60),
          z: num(m.z, -60, 60),
          ry: num(m.ry, -100, 100),
          y: m.y == null ? null : num(m.y, -5, 10),
          sc: m.sc === "in" ? "in" : "out",
          pose: ["stand", "sit", "lie", "swing", "recline"].includes(m.pose) ? m.pose : "stand",
          mv: m.mv ? 1 : 0,
          act: String(m.act || "").slice(0, 16),
          hand: String(m.hand || "").slice(0, 8),
          tilt: num(m.tilt, -1, 1)
        };
        s.pos = p;
        this.bcast({ t: "pos", id: s.id, ...p }, s);
        break;
      }
      case "emo":
        if (this.gap(s, "emo", 300)) return;
        this.bcast({ t: "emo", id: s.id, k: String(m.k || "").slice(0, 12), d: num(m.d, 0.3, 8) }, s);
        break;
      case "fx":
        if (this.gap(s, "fx", 150)) return;
        this.bcast({ t: "fx", id: s.id, k: String(m.k || "").slice(0, 12), a: m.a == null ? null : num(m.a, -1e6, 1e6) }, s);
        break;
      case "boat":
        if (this.gap(s, "boat", 120)) return;
        this.bcast({ t: "boat", x: num(m.x, -80, 80), z: num(m.z, -80, 80), ry: num(m.ry, -100, 100), home: m.home ? 1 : 0 }, s);
        break;
      case "item":
        this.bcast({ t: "item", id: s.id, k: String(m.k || "").slice(0, 12) }, s);
        break;
      case "say": {
        if (this.gap(s, "say", 1500)) return;
        const r = checkChat(m.text);
        if (!r.ok) return send(s, { t: "err", why: r.why });
        this.bcast({ t: "say", id: s.id, text: r.text });
        break;
      }
      case "love":
      case "loveok": {
        if (!owner || this.gap(s, "love", 400)) return;
        const to = [...this.sessions.values()].find((x) => x.id === m.to && (x.role === 0 || x.role === 1));
        if (!to) return;
        send(to, { t: m.t, from: s.id, k: String(m.k || "").slice(0, 12), ok: m.ok ? 1 : 0 });
        break;
      }
      case "save": {
        if (!owner || !m.keys || typeof m.keys !== "object") return;
        const keys = cleanSave(m.keys);
        if (!Object.keys(keys).length) return;
        Object.assign(this.save, keys);
        await this.persist("save");
        if (keys.names) {
          for (const x of this.sessions.values()) if (x.role === 0 || x.role === 1) x.name = this.save.names[x.role];
        }
        if (keys.looks) {
          for (const x of this.sessions.values()) if (x.role === 0 || x.role === 1) x.look = this.save.looks[x.role];
        }
        this.bcast({ t: "save", keys }, s);
        break;
      }
      case "addlove":
        if (!owner) return;
        this.save.love = int((this.save.love || 0) + int(m.n, 0, 30), 0, 1e7);
        await this.persist("save");
        this.bcast({ t: "save", keys: { love: this.save.love } });
        break;
      case "memo":
        if (!owner) return;
        await this.addMemo({ icon: String(m.icon || "").slice(0, 4), text: String(m.text || "").slice(0, 80), d: String(m.d || "").slice(0, 12), day: int(m.day, 1, 99999) }, s);
        break;
      case "tod":
        if (!owner) return;
        this.clock = { tod: num(m.tod, 0, 23.999), day: int(m.day, 1, 99999), at: Date.now() };
        await this.persist("clock");
        this.bcast({ t: "clock", clock: this.clock }, s);
        break;
      case "book": {
        if (this.gap(s, "book", 2e4)) return send(s, { t: "err", why: "slow" });
        const r = checkChat(m.text);
        if (!r.ok) return send(s, { t: "err", why: r.why });
        const e = { n: s.name || "\u670B\u53CB", text: r.text, at: Date.now() };
        this.book.unshift(e);
        this.book.length = Math.min(this.book.length, 100);
        await this.persist("book");
        for (const x of this.sessions.values()) if (x.role !== "g" || x === s) send(x, { t: "book", e });
        if (s.role === "g") await this.addMemo({ icon: "\u{1F4DD}", text: `${s.name} \u5728\u7559\u8A00\u7C3F\u5BEB\uFF1A\u300C${r.text}\u300D` });
        break;
      }
      case "kick": {
        if (!owner) return;
        const x = [...this.sessions.values()].find((y) => y.id === m.id && y.role === "g");
        if (x) {
          try {
            x.ws.close(4001, "\u5CF6\u4E3B\u8ACB\u4F60\u5148\u96E2\u958B\u4E86");
          } catch (_) {
          }
        }
        break;
      }
      case "lock":
        if (!owner) return;
        this.meta.locked = !!m.on;
        await this.persist("meta");
        this.ownersSend({ t: "owner", owner: this.ownerView() });
        break;
      case "newguest":
        if (!owner) return;
        this.meta.guest = rnd(6);
        await this.persist("meta");
        this.ownersSend({ t: "owner", owner: this.ownerView() });
        break;
      case "newpair": {
        if (!owner || this.meta.keys[0] && this.meta.keys[1]) return;
        const reg = this.env.REGISTRY.get(this.env.REGISTRY.idFromName("registry"));
        const p = await (await reg.fetch("https://x/new", { method: "POST", body: JSON.stringify({ island: this.meta.island }) })).json();
        this.meta.pair = { code: p.code, exp: p.exp };
        await this.persist("meta");
        this.ownersSend({ t: "owner", owner: this.ownerView() });
        break;
      }
    }
  }
  ownersSend(o) {
    for (const x of this.sessions.values()) if (x.ready && (x.role === 0 || x.role === 1)) send(x, o);
  }
  async addMemo(e, except) {
    const d = new Date(Date.now() + 8 * 36e5);
    const memo = { d: e.d || `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}`, day: e.day || this.now().day, icon: e.icon || "\u{1F497}", text: e.text };
    this.save.diary = [memo, ...this.save.diary || []].slice(0, 300);
    await this.persist("save");
    for (const x of this.sessions.values()) if (x !== except && x.ready && (x.role === 0 || x.role === 1)) send(x, { t: "memo", m: memo });
  }
};

// ../../../../../tmp/claude-0/-home-user--/8ca6a947-2758-5851-a081-92071f7c3786/scratchpad/tools/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../../tmp/claude-0/-home-user--/8ca6a947-2758-5851-a081-92071f7c3786/scratchpad/tools/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-WEi0N1/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = island_default;

// ../../../../../tmp/claude-0/-home-user--/8ca6a947-2758-5851-a081-92071f7c3786/scratchpad/tools/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-WEi0N1/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  Island,
  Registry,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=island.js.map

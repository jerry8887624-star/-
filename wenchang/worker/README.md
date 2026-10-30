# 多人連線伺服器（選用）

沒有部署這個伺服器時，App 照常能參拜，只是看不到其他真人香客，廟裡會有幾位「示意香客」走動。

部署後，大家會在同一座廟裡看到彼此（人物、位置、拜拜動作），可以點別人送出預設的打氣語（例如「金榜題名！」）。
伺服器**只轉送位置、外觀與打氣語編號**，不收也不存任何姓名、生日、住址、准考證或自由輸入的文字；只存一個「累計人次」數字。

## 部署（Cloudflare，免費方案即可）

```bash
cd wenchang/worker
npx wrangler login
npx wrangler deploy
```

部署完成會得到網址，例如 `https://wenchang-temple.<你的帳號>.workers.dev`。
把它改成 `wss://` 開頭、加上 `/ws`，填進 `wenchang/js/config.js`：

```js
export const WS_URL = 'wss://wenchang-temple.<你的帳號>.workers.dev/ws';
```

再執行 `python3 build.py` 並發布即可。

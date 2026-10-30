# 同時專注人數（選用）

App 預設不顯示人數。要開啟「此刻還有 N 人也在開始」，需要部署這個小型伺服器（Cloudflare 免費方案即可）：

1. 安裝工具並登入：`npm i -g wrangler`、`wrangler login`
2. 建立資料庫：`wrangler kv namespace create PRESENCE`，把顯示的 id 填進 `wrangler.toml`
3. 部署：在此資料夾執行 `wrangler deploy`，會得到網址，例如 `https://start5-presence.<帳號>.workers.dev`
4. 把網址填進 `js/v2.js` 的 `PRESENCE_URL`，執行 `python3 build.py` 後發布

只存隨機匿名代碼與 90 秒過期的心跳，不存任何個人資料。人數最多延遲約 1 分鐘。

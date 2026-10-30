# 讓大家能互相互動（部署到 Cloudflare）

部署後，這個 Worker 會同時提供**網站**和**多人連線**，網址像 `https://wenchang-temple.<你的帳號>.workers.dev`。
在這個網址參拜的人會在同一座廟裡看到彼此，可以：

- 看到其他考生走動、拜拜、拿香（名牌顯示「考生 #編號」，完成參拜的人有 ✓）
- 點對方或從「互動 → 在廟裡的考生」送打氣語，收到的人可以按「回覆」
- 做動作讓大家看到：揮手、拜一拜、比讚、開心跳
- 祈福牆上看到大家掛的卡（只顯示顏色和考試類別，寫的字只留在自己手機）
- 左下角動態：誰走進文昌祠、誰完成參拜、誰掛了祈福卡
- **悄悄話**：點對方 →「邀請說悄悄話」，對方接受後一對一聊天（最多 40 字，也有快速句子）

悄悄話的安全設計（使用者多半是學生）：
- 一定要對方按「接受」才開始；邀請 25 秒沒回應自動婉拒；每 5 秒最多邀請一次、每秒最多一則訊息
- 伺服器擋掉網址、電話號碼（含國字數字）、LINE／IG 等帳號、住址、學校、約見面，以及不雅字詞（規則在 `js/chatfilter.js`，前後端共用）
- 隨時可以「封鎖」：對方不會被告知，只會看到悄悄話結束；之後他的邀請一律被婉拒
- 訊息只轉給對方，不存檔

其他資料：伺服器只轉送位置、外觀、進度與動作編號，不收姓名、生日、住址、准考證。
間隔限制：打氣 2 秒、動作 1 秒、祈福卡 30 秒；最多 60 人同時在廟裡。

## 一次設定（只要點按，不用打指令）

1. 登入 Cloudflare（和「靈犀」同一個帳號）→ 左側 **Workers & Pages** → **Create**。
2. 選 **Workers** 分頁 → **Import a repository**（匯入存放庫）→ 選這個 GitHub 存放庫。
3. 設定：
   - Project name：`wenchang-temple`
   - Build command：留空
   - Deploy command：`npx wrangler deploy`
   - 展開 Advanced settings → **Root directory**：`wenchang/worker`
4. 按 **Deploy**。完成後畫面上會出現 `https://wenchang-temple.….workers.dev` 網址，就是要分享的網址。

之後每次合併到 `main`，Cloudflare 會自動重新部署。

GitHub Pages 上的舊網址仍可單人參拜（廟裡是示意香客，沒有真人互動）。

## 用指令部署（替代做法）

```bash
cd wenchang/worker
npx wrangler login
npx wrangler deploy
```

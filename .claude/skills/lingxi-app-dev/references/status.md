# 靈犀目前狀態（交接用）

更新：2026-10-29。新對話接手時先讀這份，再照 SKILL.md 的流程做。

## 版本與網址
- 目前版本：1.26（`data/changes.json` 最上面那筆，v = `2026.11.12`）。下次發布版號接著遞增。
- 正式網址：**https://lingxi-397.pages.dev/**（Cloudflare Pages，從 GitHub `main` 自動部署，建置輸出目錄 `divination`，沒有建置命令）。
- 新網址寫在 `divination/data/site.json`，build.py 會帶入 `SITE_URL`、og 標籤，並產生 `old-site.html`。
- 舊網址 `…github.io/-/divination/` 現在只放輕量搬家頁：`deploy.yml` 把 `divination/old-site.html` 複製成舊網址的 index.html。來源是 `divination/move.html`，裡面的 `/*SITE_URL*/` 會被替換掉。
- 對使用者只提新網址。使用者在意隱私，不想讓 GitHub 帳號名稱曝光。
- Claude 預覽：**https://claude.ai/artifact/NFMsVktuVdW4jCLPHc2rVb**（1.22 起改用這個；舊的 Q2UEHLYeWttgayJDgdCgwH 使用者要求保留不動，不要再更新它）。預覽裡圖片、音樂檔載不到屬正常。

## 搬家機制（1.21）
- 搬家碼 = base64(JSON(所有 `gx_*` localStorage))。
- 舊網址搬家頁：
  - 一般瀏覽器：帶 `#move=` 跳轉，同時自動複製搬家碼備用。
  - 從主畫面打開：顯示三步驟卡片，沒複製就想離開時會被攔下；無法自動複製時改用 execCommand，再不行就顯示整段搬家碼讓人手動拷貝。
- 新網址：開啟時有 `#move=` 就自動匯入；歡迎畫面有「我用過舊網址，有搬家碼」可貼上；「AA 顯示與設定 → 搬家碼」可匯出或匯入。
- iOS 主畫面 App 和 Safari 的資料分開存放，所以主畫面使用者一定要走搬家碼。

## 待辦
1. **GitHub 專案改成私人**：等使用者搬完（約 1–2 週後）再帶使用者操作（Settings → Danger Zone → Change visibility）。改了之後舊網址會停用，Cloudflare 照常運作。專案根目錄另有幾份與靈犀無關、使用者個人的 PDF，改成私人後就不會公開。
2. 紫微「時辰不確定」提醒：命書已做（1.24）；紫微頁本身尚未加，待使用者決定。
3. **帶使用者在 Cloudflare 建 D1 並綁定 DB**（拜訪人次要靠它；一次一步、等截圖）。

## 觀音一百籤（1.22）
- `data/guanyin.js`：`GUANYIN_DATA[i][0]` 宮位、`[1]` 上／中／下；`GUANYIN_META` 存異說籤等、聖意、解曰、典故名稱、典故白話（自撰）、十五項斷語（`GUANYIN_KEYS`）。
- 籤譜資料取自 GitHub 兩份整理（yuleshow/M5Stack-Paper-S3-Chinese-Books 的 kuanyin.csv、yangnine.github.io 的 Goddess100.json）互相核對；只取傳統籤譜文字，不抄其現代長篇故事。raw.githubusercontent.com 在此環境可連。

## 開源對照驗證（1.23）
- 用 tyme4ts（lunar 作者新版）逐日比對 1920–2050 年：農曆、大運 0 差異；四柱只差在 23:30，屬早晚子時流派（App 用 lunar 預設：晚子時日柱不換日）。
- 用 cantian-tymext（bazi-mcp 的神煞庫）比對神煞與刑沖合害；已修天德貴人漏看月柱、半合須含子午卯酉。文昌只用日干、羊刃只算陽干、空亡只用日柱，屬主流流派，刻意不改。
- iztro 已升 2.6.3（比對 988 張命盤含流年 0 差異）。
- Lighthouse（有壓縮、模擬慢速 4G）：效能約 40、其他三項 100；首次下載 944→641KB。剩下的大頭是 index.html 內嵌資料（約 300KB 壓縮後），要再快需把籤詩、解夢等資料拆成延遲載入的檔案。

## 命書（1.24）
- `reportHtml()` 依實歲分段：`kid`（<18）、`senior`（≥65）改寫事業、感情、大運建議；`noHour`（時辰不確定）開頭加說明、章節依據註明紫微僅供參考。
- 流月改由共用的 `liuMonths(年干支)` 產生（流年頁與命書同一套）；星數與文字分級一律用 `Math.round(score)`。
- 檢查方式：多組命主（長輩、孩子、時辰不確定、複姓、單名）產生命書，掃描 undefined／NaN／重複標點／空格，並看手機截圖與列印 PDF。

## 拜訪人次（1.25）
- `functions/api/visit.js`（repo 根目錄，Cloudflare Pages Function）＋ D1，綁定名稱 `DB`；表 `hits(day, n)` 會自動建立。累計人次 = 1800（`BASE`，使用者指定）＋資料庫合計。GET 讀、POST 今天加一；以台灣時間換日。
- App：`visitPing()` 在 boot 呼叫，`gx_vday` 記錄今天是否已計；結果存 `gx_visits`；顯示在頁首 `#navVisits`（1.26 起；空間不夠時 `visitFit()` 依序省略「累計」「今日」，再不夠改用標題上方的 `#ltVisits`）。API 不通時隱藏。SW 不快取 `/api/`。
- 本機測試：scratchpad 安裝 wrangler，在含 functions/ 的暫存資料夾執行 `wrangler pages dev divination --d1 DB=xxx --persist-to <scratch>`，避免 .wrangler 寫進 repo。不要用 pkill -f 比對含相同字串的指令（會把自己的 shell 一起砍掉）。
- 使用者需在 Cloudflare 後台建立 D1 並綁定到 Pages 專案（變數名 DB），之後重新部署一次才生效。

## 音訊（目前做法）
- 背景音樂 5 首，放在 `audio/*.mp3`（響度 -20 LUFS、112 kbps）：寺院系〈儀式靜心〉〈缽音入定〉〈晨鐘回響〉、星空系〈琉璃雨〉〈靜夜安神〉。用**原生 `<audio>`** 播放、不經 Web Audio，因為接 Web Audio 時捲動會變調、爆音。iOS 不能調網頁音量。
- 音效：`audio/sfx/*.mp3`，由另一個對話換成 Freesound CC0 真實錄音（見 `audio/sfx/make_sfx.py`）。
- 使用者不接受把 Artlist 試聽音檔「錄下來」用，那是未授權使用；他的 Artlist 方案不含音效下載。

## 使用者偏好（摘要，詳見 mobile-app-craft 技能的 ui-ux.md）
- 繁體中文、白話。術語只當小字；賣給一般人的內容要像占卜師親筆寫的。
- 做完要自己完整測過再交付，有問題自己修。改善建議用選擇題給他挑。
- 帶他操作設定時，一次一步，等他回覆截圖再下一步。
- 重視 UI 邏輯、直觀、美術、動效；不要紅色恐嚇式用語。

## 省用量
- 這個對話到 75 萬 token 時，使用者因為用量增加而改開新對話。
- 小改動只跑相關測試，大改版才跑全套（全尺寸溢出掃描約 10 分鐘）。
- 截圖只在需要判斷畫面時才看。

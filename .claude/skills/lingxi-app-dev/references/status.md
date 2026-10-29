# 靈犀目前狀態（交接用）

更新：2026-10-29。新對話接手時先讀這份，再照 SKILL.md 的流程做。

## 版本與網址
- 目前版本：1.21（`data/changes.json` 最上面那筆，v = `2026.11.7`）。下次發布版號接著遞增。
- 正式網址：**https://lingxi-397.pages.dev/**（Cloudflare Pages，從 GitHub `main` 自動部署，建置輸出目錄 `divination`，沒有建置命令）。
- 新網址寫在 `divination/data/site.json`，build.py 會帶入 `SITE_URL`、og 標籤，並產生 `old-site.html`。
- 舊網址 `…github.io/-/divination/` 現在只放輕量搬家頁：`deploy.yml` 把 `divination/old-site.html` 複製成舊網址的 index.html。來源是 `divination/move.html`，裡面的 `/*SITE_URL*/` 會被替換掉。
- 對使用者只提新網址。使用者在意隱私，不想讓 GitHub 帳號名稱曝光。
- Claude 預覽：https://claude.ai/artifact/Q2UEHLYeWttgayJDgdCgwH（預覽裡圖片、音樂檔載不到屬正常）。

## 搬家機制（1.21）
- 搬家碼 = base64(JSON(所有 `gx_*` localStorage))。
- 舊網址搬家頁：
  - 一般瀏覽器：帶 `#move=` 跳轉，同時自動複製搬家碼備用。
  - 從主畫面打開：顯示三步驟卡片，沒複製就想離開時會被攔下；無法自動複製時改用 execCommand，再不行就顯示整段搬家碼讓人手動拷貝。
- 新網址：開啟時有 `#move=` 就自動匯入；歡迎畫面有「我用過舊網址，有搬家碼」可貼上；「AA 顯示與設定 → 搬家碼」可匯出或匯入。
- iOS 主畫面 App 和 Safari 的資料分開存放，所以主畫面使用者一定要走搬家碼。

## 待辦
1. **GitHub 專案改成私人**：等使用者搬完（約 1–2 週後）再帶使用者操作（Settings → Danger Zone → Change visibility）。改了之後舊網址會停用，Cloudflare 照常運作。專案根目錄另有幾份與靈犀無關、使用者個人的 PDF，改成私人後就不會公開。
2. 觀音一百籤的**籤題、典故、正式籤等**還沒補：目前的吉／平／守是依籤意判讀，已在畫面上標註。資料來源（temples.tw、qiangua.temple01.com、goodfate.tw）在這個環境被網路政策擋住，要使用者把這些網域加進 Allowed domains，或提供 PDF。
3. 紫微「時辰不確定」提醒：使用者先前沒選，未做。

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

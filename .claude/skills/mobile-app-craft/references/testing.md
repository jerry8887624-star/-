# 測試

Playwright 已安裝，Chromium 在 `/opt/pw-browsers/chromium`（不要執行 playwright install）。

## 一鍵檢查：scripts/qa.cjs
```bash
node <skill>/scripts/qa.cjs <index.html 或 http://localhost:8765/> <輸出資料夾> [--views=a,b,c] [--seed=seed.json]
```
- 每個 view（以 `#<view>` 錨點或 `data-go` 切換）× 淺色／深色 × 寬度 360、390 × 字級 1、1.45 截圖。
- 回報水平溢出（scrollWidth > 視窗寬）、超出卡片的元素、console／page error。
- `--seed=seed.json` 給初始狀態，格式 `{"local":{鍵:值}, "session":{鍵:值}}`（跳過開場、歡迎頁、更新彈窗、首次提示）。
- 自己寫互動腳本時：`const {launch}=require('<skill>/scripts/pw.cjs')`。專案的 package.json 若是 `"type":"module"`，測試腳本請用 `.cjs` 副檔名。
- 有 `node_modules/axe-core` 時附帶 WCAG AA 檢查。
截完圖**用 Read 打開重點截圖親自看**。

## 互動腳本要點
- `page.addInitScript` 先寫 localStorage／sessionStorage，避免開場與彈窗擋住操作。
- 會被收起的分頁列：點分頁前先移除收起狀態。
- 動畫要依實際時間取格：`waitForFunction(t=>performance.now()-window.__t0>t)`。
- canvas 匯出、service worker、manifest 要用本機 http 伺服器（`python3 -m http.server`），不能用 file://。
- 模擬裝置能力：方向感測 dispatch `deviceorientationabsolute`；安裝提示 dispatch 自訂 `beforeinstallprompt`；改 userAgent 模擬 iPhone／Android／LINE 內建瀏覽器。
- 長時間檢查用 run_in_background，不要卡在前景超時。
- 截圖輸出放 scratchpad，不要寫進專案資料夾。

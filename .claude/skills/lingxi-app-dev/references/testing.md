# 測試做法

Playwright 已安裝，瀏覽器在 `/opt/pw-browsers/chromium`。啟動方式：

```js
const {chromium,devices}=require('playwright');
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--headless=new'],headless:false});
const ctx=await b.newContext({...devices['iPhone 13'],viewport:{width:390,height:844},colorScheme:'light'});
```

## 進入 App 前先設定狀態（跳過開場、歡迎頁、更新彈窗、首次提示）

用 `scripts/seed.cjs` 的 `seed(page, opts)`，或自己寫：

```js
await p.addInitScript(([ver])=>{
  sessionStorage.setItem('gx_sp','1'); sessionStorage.setItem('gx_wel','1');
  localStorage.setItem('gx_ver', JSON.stringify(ver));            // 讀 data/changes.json[0].v
  localStorage.setItem('gx_tips', JSON.stringify({overview:1}));  // 要測提示時不要設
  localStorage.setItem('gx_profiles', JSON.stringify([{sur:'林',given:'書言',gender:'男',date:'1985-02-16',hour:10,sample:false}]));
},[ver]);
```

- 只用 file:// 時：`p.route('**/*', r=>r.request().url().startsWith('file:')?r.continue():r.abort())`
- 需要 canvas 匯出（分享圖卡）、service worker、manifest 時：在 divination/ 開 `python3 -m http.server 8765`，用 http://localhost:8765。

## 每次發布至少跑

1. **流程 e2e**：開場 10 秒內結束、歡迎頁、填資料、今日抽牌、字級、塔羅六種牌陣、求籤完整流程、擲筊三次、紫微、流年、姓名、奇門、多人命盤、重新整理。
2. **axe**：注入 node_modules/axe-core/axe.min.js，`runOnly:['wcag2a','wcag2aa']`，深淺色 × 16 個 view，目標 0 項。
3. **溢出**：360px、390px × 字級 1／1.15／1.3／1.45＋粗體，檢查 `document.documentElement.scrollWidth` 與元素是否超出卡片。命主表單內可捲動的說明文字是已知誤報。整輪很久，用 run_in_background。
4. **改動專用截圖**：淺色＋深色，必要時 1.45 倍字級；用 Read 看圖。動畫要用 `waitForFunction(t=>performance.now()-window.__spT0>t)` 依實際時間取格。

## 模擬裝置能力

- 方向感測（羅盤）：dispatch `deviceorientationabsolute`，`Object.defineProperty(e,'alpha',{value})`、`absolute:true`。
- 安裝提示：dispatch 自訂 `beforeinstallprompt`，附 `prompt()` 與 `userChoice`。
- 瀏覽器種類：改 `userAgent`（加 ` Line/14.0.0` 模擬 LINE 內建瀏覽器；`devices['Pixel 7']` 模擬 Android）。
- 新版本：`p.route('**/changes.json')` 回傳多一筆的假資料，再呼叫 `window.__gxShowUpdate()`。

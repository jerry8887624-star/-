# 踩過的坑（每次試用或專案中發現就補上）

| 現象 | 原因 | 做法 |
|---|---|---|
| 畫面一片空白 | 大段替換程式時誤刪必要的一行（例如 VIEWS 定義），JS 一出錯整頁不畫 | 改完先收集 `pageerror`；模板把「App 內容」與「框架」分段，只改內容段 |
| 進度圈／數字沒有動畫 | 整頁重畫後元素是新的，transition 沒有起點 | 先用舊值畫，再 `requestAnimationFrame` 兩次後設成新值 |
| 面板背景透明、背景圖不見 | `background:var(--顏色) var(--多層漸層)` 簡寫無效（顏色必須在最後一層） | 分開寫 `background-color` 與 `background-image` |
| 大字級時按鈕擠成兩行 | 主文字＋規格說明寫在同一行 | 次要資訊用 `<small>`，或拆成兩層 |
| 快速入口只有 2 個時靠左 | 4 欄 grid 固定 | 改 flex＋置中，項目少時也平衡 |
| 大字級時快速入口文字被截 | 欄寬太窄又不換行 | 允許換行、`min-width:0` |
| 檢查工具誤報全部超出 | 新版 Chromium 在 CSS zoom 下回傳畫面座標，不該再除以 zoom | qa.cjs 已修正，直接與 `innerWidth` 比較 |
| 檢查工具報「Failed to load resource」 | 測試封鎖外部網路（字型）造成 | qa.cjs 已忽略 |
| 測試被「更新內容」或首次提示擋住 | 新版本紀錄、提示泡泡蓋在畫面上 | seed 裡設定已讀版本與提示 |
| iOS 上 SVG 旋轉位移 | transform-origin 用 px 座標 | `transform-box:fill-box;transform-origin:center` |
| 部署後手機仍是舊版 | Service worker 讀到 HTTP 快取 | 網頁 `cache:'no-store'`、註冊 `updateViaCache:'none'` |
| 分頁列擋住內文 | 固定在底部 | 往下捲收起、往上捲或到底出現 |

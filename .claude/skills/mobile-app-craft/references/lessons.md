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
| iPhone 翻牌後牌面空白 | 圖在 3D 翻到背面後才載完，iOS Safari 不重繪；`onerror` 呼叫的後備函式寫在 IIFE 內找不到 | 選取時就預載＋`decode()`，翻前等圖就緒；`onerror` 用掛在 window 的函式並重試一次；翻完強制重繪 |
| 3D 翻牌後要長時間顯示的牌面 | 放在 `backface-visibility:hidden` 的背面，iOS 可能不載入／不重繪 | 翻牌動畫結束就改成平面（不含 3D）的牌面；備用圖只在真的載入失敗兩次才換 |
| 手勢互動（攪牌）時誤觸按鈕 | 子元素仍可點 | 互動中子元素 `pointer-events:none`、容器 `touch-action:none`，狀態旗標擋住點擊處理 |
| 3D 場景鏡頭被柱子、香爐、燈籠擋住 | 鏡頭固定在角色背後一段距離 | 每格檢查鏡頭位置是否在物件範圍內，擋到就拉近；室內壓低鏡頭；每個站位可設鏡頭偏角 |
| 直書（vertical-rl）的籤詩在 flex 裡被截斷 | 正交書寫方向在 flex 中高度算錯 | 每行直書元素給明確高度（例如 8.4em） |
| Playwright 點不到 3D 名牌 | 名牌每格跟著角色移動，永遠「不穩定」 | 測試用 `element.click()`；真機上可點人物本體（射線偵測） |
| 3D 頁在測試機上很慢 | 無 GPU，軟體算圖 | deviceScaleFactor 設 1、長流程放背景執行，等待條件而不是固定秒數 |
| 程式改完物件消失或整頁不畫 | 用腳本在同一行程式尾端加 `// 註解`，把後面的程式（例如 `god.add(x);`、`}`）一起註解掉 | 註解一律放在上一行；改完跑 `node --check` 並截圖確認物件真的出現 |

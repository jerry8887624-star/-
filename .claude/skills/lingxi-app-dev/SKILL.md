---
name: lingxi-app-dev
description: 開發、修改、測試與發布「靈犀 LINGXI」命理占卜 Web App（divination/ 資料夾，單一 HTML、GitHub Pages 部署、另有 claude.ai Artifact 預覽）的完整流程。只要使用者要調整靈犀的任何功能、畫面、動畫、文案、命理內容（塔羅、求籤、擲筊、易卦、解夢、紫微、八字、流年、姓名學、風水、奇門、擇日、拜拜節日），或回報 bug、截圖說哪裡跑版、要求「部署」「給連結」「更新說明」，都應該使用這個技能——即使沒有明說「靈犀」，只要工作目錄裡有 divination/src.html 就適用。
---

# 靈犀 App 開發流程

這份技能整理了靈犀從需求到上線的完整做法。使用者是非工程背景、以繁體中文溝通的 App 擁有者，App 主要給長輩與家人使用，所以「正確、好讀、不嚇人、手機上真的能用」比炫技重要。

## 0. 先搞清楚要做什麼

- 截圖是最常見的需求來源：先看清楚截圖裡的每個問題（跑版、遮擋、文字被截斷、顏色），一張圖可能藏兩三個問題，全部處理。
- 使用者說「依照建議修改」並附上規格文件時，逐條對照實作；做不到的（例如 iOS 不允許網頁自己加入主畫面）要說明原因並給最接近的替代方案。
- 使用者要你「提出改善方案」時，用選擇題（AskUserQuestion，附「其他」可自填）讓他挑，不要自己全部決定。
- 命理內容要「有規矩」：依台灣主流民俗與典籍做法，不自創規則；流派有爭議的地方標註「各派說法不一」。需要專業知識時先用 WebSearch 查證，最後回覆附上來源連結。
- 用語禁忌：說「犯太歲」不說「沖太歲年」之類的自創詞；不用恐嚇式或保證式文案；結果定位是參考與自我反思。

## 1. 開工前同步分支

```bash
cd <repo> && git fetch -q origin main && git checkout -q -B claude/divination-app origin/main
```
每一輪都從最新的 main 重開分支（上一輪的 PR 已經合併）。

## 2. 專案結構（改之前先讀）

詳見 `references/architecture.md`。重點：
- 程式在 `divination/src.html`，樣式在 `divination/css/app.css`，資料在 `divination/data/*.js`；**不要直接改 `index.html`**，它由 `python3 divination/build.py` 產生（同時產生 `sw.js` 與 `changes.json`）。
- 新增 CSS 一律附加在 `app.css` 檔尾，以後蓋前，避免動到舊規則牽一髮動全身。
- 用 Python 腳本做多行字串替換時，每個替換都 `assert old in s`，避免默默失敗。

## 3. 實作時的慣例

- 全域都在 IIFE 裡，測試只能操作 UI，不能直接呼叫函式。
- 點擊統一由 `document.addEventListener('click')` 以 `data-*` 屬性分派；新按鈕加 `data-act="xxx"` 再到分派處加分支。
- SVG 動畫的旋轉縮放一律用 `transform-box:fill-box;transform-origin:center`，或直接用 SVG 的 `transform` 屬性；用 px 座標當 transform-origin 在 iOS Safari 會位移。
- 所有動畫尊重 `reduceMotion()`（系統減少動態＋App 內「簡化動效」）。
- 深淺色都要顧：顏色用 CSS 變數，深色對比不足是常見 axe 問題。
- 固定在底部的元素要避開分頁列與安全區；長頁捲動時分頁列會自動收起（`body.tabhide`）。
- 範例命主（`P.sample`）時，標題下會顯示「範例資料」，不要把範例當個人結果呈現。

## 4. 測試（每次發布前都要）

在 scratchpad 執行，參考 `references/testing.md`：
1. `python3 divination/build.py`
2. 功能流程 e2e（23 步左右）、axe 無障礙檢查（深淺色、所有分頁）、窄螢幕（360px）× 四種字級的溢出檢查。
3. 針對這次改動寫專用腳本並截圖，**親自看截圖**再判斷，不要只看數字。
4. 常見坑：
   - 「更新內容」彈窗會擋住測試 → 在測試的 localStorage 把 `gx_ver` 設成最新版本號。
   - 首次提示泡泡（`.tipbub`）會擋點擊 → 預設 `gx_tips`。
   - 往下捲後分頁列收起 → 點分頁前移除 `tabhide`。
   - 用 `file://` 開頁時 canvas 會被污染（分享圖卡）→ 改用本機 `python3 -m http.server`。
   - 本機伺服器在容器重啟後會消失，記得重開；字型無法連外，要測字型時用 scratchpad 的本地字檔。
   - 截圖存檔前確認目前目錄在 scratchpad，以免把圖寫進 repo。

## 5. 發布流程

1. 在 `divination/data/changes.json` **最前面**新增一筆更新紀錄（`v` 新版本字串、`n` 顯示版號遞增、`d` 日期、`items` 為 `[標題, 白話說明, 可選的跳轉 view]`）。使用者更新後會自動跳出這份說明；忘了加就不會出現。
2. 更新 `divination/README.md` 的功能說明。
3. build → 測試全過 → commit（訊息用繁中描述改了什麼，結尾加上 session 要求的 Co-Authored-By／Claude-Session 兩行）→ `git push -u origin claude/divination-app`。
4. 用 GitHub MCP 開 PR（繁中說明：變更、測試），然後合併（使用者已授權）。
5. 產生 Artifact 片段並重新發布到既有網址：
   ```bash
   python3 divination/build.py --fragment <scratchpad>/artifact.html
   ```
   Artifact 發布時若頁面引用新的圖片，要用 `files` 一併上傳（例如 `img/bg-day.jpg`）。
6. 確認 GitHub Actions `deploy.yml` 成功（約 1–2 分鐘）。

## 6. 回報給使用者

用繁體中文，先講結論，再分點說明做了什麼與為什麼；附上兩個連結：
- App：https://jerry8887624-star.github.io/-/divination/
- Claude 預覽：https://claude.ai/artifact/Q2UEHLYeWttgayJDgdCgwH

誠實說明沒辦法驗證的部分（例如沒有真機 iPhone、只用模擬事件測過羅盤或安裝提示），並提醒手機上如何拿到新版（完全關閉 App 再開、看到「更新內容」按立即更新）。還沒做的建議項目列出來，問要不要接著做。

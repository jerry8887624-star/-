# 發布與回報

1. **更新紀錄**：在 `data/changes.json` 最前面加一筆 `{v, n, d, items:[[標題, 白話說明, 可選跳轉頁]]}`。App 偵測到新版時會先列出內容（立即更新／稍後更新），更新後也會介紹一次。忘了加就不會顯示。
2. **README**：同步更新功能說明。
3. **build**：`python3 build.py`（內嵌 CSS 與資料、產生 sw.js 版本雜湊）。
4. **commit／push**：繁中描述改了什麼；結尾加上工作階段要求的署名行；`git push -u origin <branch>`。
5. **PR → 合併**：用 GitHub MCP；說明包含「變更」「測試」兩段。使用者已授權直接合併。
6. **確認部署**：查 GitHub Actions 部署 workflow 成功。
7. **預覽**：若有 claude.ai Artifact 預覽，用 `--fragment` 輸出片段並重新發布到同一網址；新圖片用 `files` 一起上傳。
8. **回報**：先結論，附 App 與預覽連結；說明手機如何拿到新版（關閉 App 重開、按「立即更新」）；列出未真機驗證項目與尚未做的建議。

Service worker 要點：網頁用 `cache:'no-store'` 優先網路（4 秒逾時才用快取），註冊時 `updateViaCache:'none'`，否則使用者會一直看到舊版。

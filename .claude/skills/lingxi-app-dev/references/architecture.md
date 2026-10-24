# 靈犀專案結構

```
divination/
├── src.html          主程式（HTML + 全部 JS，含 /*KX_DATA*/ 等資料標記）
├── css/app.css       全部樣式（新規則附加在檔尾）
├── data/
│   ├── content.js    說明文字 GC.HELP、81 數理、三才、五行開運等
│   ├── tarot.js      78 張牌、牌陣、各類別解讀
│   ├── qian.js       六十甲子籤
│   ├── dream.js      周公解夢條目 [關鍵字, 類別, 吉凶, 民間說法, 心理提醒]
│   ├── yijing.js     64 卦卦辭與白話
│   ├── kangxi.js     康熙筆畫
│   ├── tones.js      字的聲調
│   └── changes.json  更新紀錄（最新在最前）
├── build.py          內嵌 css/data → index.html；產生 sw.js（版本為內容雜湊）與 changes.json
├── sw.src.js         Service worker 原始檔（網頁 no-store 優先網路、靜態資源快取）
├── img/  icons/  vendor/（lunar.js 曆法、iztro 紫微）
└── manifest.webmanifest
```

## 導覽（ALL_GROUPS）

| 分頁 k | 名稱 | views |
|---|---|---|
| today | 今日 | overview, star, dream, family |
| ask | 問事 | qian, jiao, tarot, meihua |
| cal | 日曆 | festival, zeri, journal |
| chart | 命盤 | ziwei, liunian, hehun |
| tools | 開運 | fengshui, name, qimen |

簡易模式 `SIMPLE_GROUPS`：今日、問事（求籤・擲筊）、全家。新增 view 時要同時更新：`<section id="v-xxx">`、`ALL_GROUPS`、`TITLES`、`SUBTITLE`、`render` 對照表、必要時 `TAGS`、`GC.HELP`、`TIPS`。

## 常用函式與狀態

- `store.get/set(key, default)`：localStorage（鍵名 `gx_*`）
- `sheet(title, html)` 底部面板（回傳 L，`L.panel`）；`closeLayer()`；`toast(msg, icon)`；`hud()`
- `go(view)` 切頁（記住各頁捲動位置）；`render(view)`；`renderTitle()`
- `P` 目前命主、`PEOPLE` 全部命主、`D` 命盤推算結果、`fortune(date)` 每日運勢
- `reduceMotion()`、`wait(ms)`（減少動態時為 0）、`buzz(ms)`（尊重震動開關）
- `isDark()`、`setTheme()`；`canInstall()`、`doInstall()`、`installSteps()`（加到主畫面）
- `CHANGES`（由 changes.json 內嵌）、`updModal()` 更新內容彈窗、`maybeNews()`、`showUpdate()`

## 重要 localStorage 鍵

`gx_profiles` 命主、`gx_ver` 已看過的版本、`gx_tips` 已看過的提示、`gx_fs` 字級、`gx_theme`、`gx_motion`、`gx_haptic`、`gx_simple`、`gx_inst`／`gx_inst_d` 安裝提醒、`gx_dt_<日期>` 每日一牌是否已翻。sessionStorage：`gx_sp` 開場已播、`gx_wel` 歡迎頁已看。

# 觀象閣 iOS App

用 Expo 把 `divination/` 的網頁版包成 iOS App。網頁會先打包成單一離線檔案 `assets/web/app.html`（曆法、紫微程式庫和圖片都內嵌，不需要網路），App 用 WebView 載入它，並把震動回饋和分享換成 iOS 原生功能。

## 改了網頁之後

```bash
npm run sync-web     # 重新產生 assets/web/app.html
```

`divination/` 的內容有改，記得跑一次再打包 App。

## 開發預覽

```bash
npm install
npx expo start       # 用 iPhone 的 Expo Go 掃 QR code
```

## 打包與上架（不需要 Mac）

```bash
npx eas-cli login
npx eas-cli build --platform ios --profile production   # 第一次會引導建立 Apple 憑證
npx eas-cli submit --platform ios                       # 上傳到 App Store Connect / TestFlight
```

- Bundle ID：`com.jerry8887624.guanxiangge`（`app.json`，送審後就不能改）
- 版本號在 `app.json` 的 `version`；build 編號由 EAS 自動遞增

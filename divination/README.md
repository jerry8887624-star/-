# 觀象閣

手機優先的命理占卜 App，單一 HTML 頁面，不需後端。

- **每日運勢**：七天日期切換（可左右滑動），總分、五大面向、幸運色／數字／方位、吉時、宜忌
- **今日行動指南**：趨吉、避凶、開運、化沖／借合、修心五項，可打勾，並引導到起卦、奇門、流月
- **易經**：銅錢六擲、時間起卦、報數起卦；本卦／互卦／變卦、六十四卦卦辭、大象傳、384 爻辭與白話、依動爻規則斷卦、五類分項解讀
- **紫微斗數**：十二宮命盤、主星亮度、四化、三方四正、星曜細論、流年疊盤
- **流年**：十年流年評分、宜忌、犯太歲化解、十二流月、八字大運
- **姓名學**：康熙筆畫五格剖象、81 數理詳解、三才、姓名與八字喜用對照、**改名建議**（依姓氏、性別、喜用神自動找五格皆吉的名字，可指定輩分字、收藏比較）
- **奇門遁甲**：時家轉盤拆補法，依問事找用神，點宮看詳解

## 開發

```bash
python3 divination/build.py      # 由 src.html + data/ 產生 index.html
```

- `src.html`：介面與程式
- `data/yijing.js`：六十四卦詳解與爻辭
- `data/content.js`：81 數理、星曜、十神、五行開運、取名字庫、各頁說明
- `data/kangxi.js`：康熙筆畫表（由 Unicode Unihan `kRSKangXi` 產生）

曆法與紫微排盤使用 [lunar-javascript](https://github.com/6tail/lunar-javascript) 與 [iztro](https://github.com/SylarLong/iztro)，由 jsDelivr 載入。資料只存在使用者自己的瀏覽器。

推到 `main` 後，GitHub Actions 會把本資料夾部署到 GitHub Pages 的 `/divination/`。

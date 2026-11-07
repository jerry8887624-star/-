# 3D 素材與建模工具包：Polyfork（使用者指定，做遊戲先來這裡找）

使用者交代：以後做遊戲，3D 素材與工具包先到 **Polyfork** 找。

- 網站：https://polyfork.dev（給 AI 的說明：https://polyfork.dev/agents、https://polyfork.dev/llms.txt）
- 內容：三千多個低多邊形模型（道具、建築、植物、岩石、動物、角色），每個模型是可調參數的小程式；也有整組「kit」（同一風格、可拼成一整個場景，附 three.js 的 `buildKit()`／`stage()`）。
- 格式：GLB、ES module（three.js 可直接 import）、FBX、USD、OBJ。尺寸是真實公尺、原點在地面。

## 怎麼用
- **API（免金鑰）**：`GET https://polyfork.dev/api/assets?q=關鍵字&free=1&per_page=30`（另有 class、kit、max_triangles 篩選）、`/api/assets/{id}`（尺寸、面數、預覽圖 thumbnail／renders、授權、credit）、`/api/assets/{id}/matching`（風格相配的模型）、`/api/kits`、下載 `https://polyfork.dev/cdn/{id}.glb`。
  - 用 curl 抓；Python urllib 的預設 User-Agent 會被擋（403）。
- **MCP**：`claude mcp add --transport http polyfork https://polyfork.dev/mcp --header "Authorization: Bearer pf_KEY"`（瀏覽免金鑰；金鑰免費，請使用者用安全表單提供，不要貼在聊天裡）。
- **網路**：雲端環境要允許 `polyfork.dev`（已加在使用者的 Default 環境）。

## 授權（2026-11 確認）
- 低多邊形模型全部免費、可商用。模型檔可選：
  - **CC BY 4.0**：可以下載放進自己的 App，但要列出處（每個模型 API 的 `credit` 欄位）。← 我們用這個，放在「關於」頁。
  - **Polyfork 授權**：不用列出處，但只能從它的 CDN 讀取、不能自己散布檔案。
- 不可以：轉賣模型檔、拿來訓練商用 3D 生成器；若是「讓使用者自己用這些素材蓋東西的平台」要買 platform 授權。
- Pro（每月 15 美元）是高精細 HD 版，一般手機遊戲用不到。

## 做法（文昌祠 0.29 的經驗）
1. **先讓使用者看圖選**：用 API 撈候選、抓 `thumbnail`，用 PIL 拼成有編號的目錄圖（每格寫中文名稱、面數、高度），分區傳給使用者，再用選擇題讓他勾。使用者說過「有看見圖比較好決策」。
2. **挑選原則**：避開風格不合的（例如台灣廟宇不放日式鳥居、日式石燈籠、神社）；科幻感的東西不要放進古風場景。
3. **壓縮**：`npx @gltf-transform/cli optimize in.glb out.glb --compress quantize --texture-compress false --simplify false`（13MB → 4.5MB；動物的動畫關鍵影格最大）。quantize 是 three.js 原生支援的，不需要解碼器。
4. **載入**：three r170 的 `GLTFLoader.js`、`SkeletonUtils.js`、`BufferGeometryUtils.js` 放進 `vendor/`，把 `from 'three'` 改成相對路徑。
5. **畫風統一**：材質全部換成 MeshToonMaterial（保留 color／map／vertexColors／emissive）。
6. **效能**：同一種模型放很多個 → 每個子網格一個 InstancedMesh；依區域延遲載入（走近才下載）；動物用 SkeletonUtils.clone＋AnimationMixer，遠處不更新。
7. **場景限制**：沒有高低地形時，拱橋這類會讓角色「穿過去」的東西不要放在步道上。
8. 出處清單存成 `models/credits.json`，「關於」頁可展開。

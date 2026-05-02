# Cloud-Native LIMS Prototype

本資料夾整理了課程 PDF 中「實驗室資訊管理系統」題目的架構草案、五人分工與前後端分離的可互動系統雛形。

## 檔案

- `frontend/`：前端靜態頁面與前端 HTTPS server，預設跑在 `https://localhost:8443/`。
- `backend/`：後端 HTTPS REST API、JWT Auth、Redis cache、MongoDB store、domain helper 與 API 測試，預設跑在 `https://localhost:3443/`。
- `docs/architecture.md`：系統架構、模組切分、狀態流程、資料模型、API 與雲原生設計。
- `docs/team-division.md`：五人分工方式、評分項目對應與建議里程碑。
- `docs/project-execution-plan.md`：目前完成內容、五人分工、系統架構圖、後續新增功能與檔案修改位置。
- `docker-compose.yml`：同時啟動 frontend 與 backend 的容器化設定。

## 使用方式

建議使用 Docker Compose 一次啟動前後端：

```bash
docker compose up --build
```

啟動後打開前端：

```text
https://localhost:8443/
```

後端健康檢查：

```text
https://localhost:3443/api/health
```

本專案使用 `certs/localhost-cert.pem` 和 `certs/localhost-key.pem` 作為本機自簽憑證。第一次開啟瀏覽器時需要接受本機憑證警告；若前端登入後 API 被瀏覽器阻擋，先開啟 `https://localhost:3443/api/health` 並接受後端憑證。

Docker Compose 模式會使用：

- MongoDB：`mongodb://localhost:27017`，後端容器內使用 `mongodb://mongo:27017`
- Redis：`redis://localhost:6379`，後端容器內使用 `redis://redis:6379`
- JWT Secret：由 `docker-compose.yml` 的 `JWT_SECRET` 設定

Docker Compose 模式會把資料保存到 MongoDB；未設定 `MONGO_URL` 的本機 Node 模式會 fallback 到 `data/lims-state.json`。

登入帳號：

| 角色 | 帳號 | 密碼 |
| --- | --- | --- |
| 廠區使用者 | `fab` | `password123` |
| 實驗室主管 | `supervisor` | `password123` |
| 實驗室人員 | `operator` | `password123` |
| 系統管理員 | `admin` | `password123` |

也可以分別用 Node 啟動：

```bash
npm run start:backend
```

另開一個終端機：

```bash
npm run start:frontend
```

## API MVP 已支援流程

- 登入取得 JWT：`POST /api/auth/login`
- 查詢目前登入者：`GET /api/auth/me`
- 登出並撤銷 Redis session：`POST /api/auth/logout`
- 建立委託單並送出簽核：`POST /api/requests`
- 主管核准 / 退回：`POST /api/requests/:id/approve`、`POST /api/requests/:id/reject`
- 實驗室收件：`POST /api/requests/:id/receive`
- 樣品分貨成 WIP：`POST /api/requests/:id/split`
- 建立派貨任務：`POST /api/dispatch-jobs`
- 上貨、下貨、回收資料、自動結案：`POST /api/dispatch-jobs/:id/load`、`POST /api/dispatch-jobs/:id/unload`
- 機台狀態管理：`POST /api/equipment/:id/status`
- 新增 Recipe：`POST /api/recipes`
- 模擬告警與確認處理：`POST /api/alarms/simulate`、`POST /api/alarms/:id/ack`
- 取得目前完整狀態：`GET /api/state`
- 健康檢查：`GET /api/health`

除 `/api/health` 與 `/api/auth/login` 外，其餘 API 都需要 `Authorization: Bearer <JWT>`。

## 測試

```bash
npm test
```

測試會驗證開單、簽核、收件、分貨、派貨、上貨、下貨、自動結案與告警處理。

## Docker 啟動

```bash
docker compose up --build
```

前端服務：`https://localhost:8443/`

後端 API：`https://localhost:3443/api/health`

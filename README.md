# Cloud-Native LIMS Prototype

## 環境版本

目前 `fastapi-backend` 分支的後端已改為 FastAPI。以下是本機/WSL 驗證過的版本與專案需求：

| 項目 | 版本 |
| --- | --- |
| WSL Python | `3.12.11` |
| Backend runtime | `Python 3.12` |
| Backend framework | `FastAPI >=0.115,<1.0` |
| ASGI server | `uvicorn[standard] >=0.30,<1.0` |
| MongoDB driver | `pymongo >=4.6,<5` |
| Backend tests | `pytest >=8,<9`, `httpx >=0.27,<1` |
| Node.js | `>=20`; 本機驗證為 `v24.13.0` |
| npm | `11.6.2` |
| Docker Compose | 需要 Docker Engine + Compose v2；目前此 shell 未安裝 `docker` 指令 |
| Docker backend image | `python:3.12-slim` |
| Docker MongoDB image | `mongo:7` |
| Docker Redis image | `redis:7-alpine` |

確認版本可使用：

```bash
python3 --version
node --version
npm --version
docker compose version
```

本資料夾整理了課程 PDF 中「實驗室資訊管理系統」題目的架構草案、五人分工與前後端分離的可互動系統雛形。

## 檔案

- `frontend/`：前端靜態頁面與前端 HTTPS server，預設跑在 `https://localhost:8080/`。
- `backend/`：後端 HTTPS REST API、JWT Auth、Redis cache、MongoDB store、domain helper 與 API 測試，預設跑在 `https://localhost:3443/`。
- `docs/current-system-architecture.md`：目前已實作的系統架構、API、資料儲存、測試與限制。
- `docs/future-optimization-and-workplan.md`：未來優化 roadmap 與五人分工。
- `docker-compose.yml`：同時啟動 frontend 與 backend 的容器化設定。
- `k8s/`：本機 Kubernetes demo manifests，包含 frontend、backend、MongoDB、Redis。

## 使用方式

建議使用 Docker Compose 一次啟動前後端：

```bash
docker compose up --build
```

啟動後打開前端：

```text
https://localhost:8080/
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

Docker Compose 模式會把資料保存到 MongoDB；未設定 `MONGO_URL` 的本機 FastAPI 模式會 fallback 到 `data/lims-state.json`。

MongoDB 會使用多個 collection 保存主要資料：`users`、`requests`、`equipment`、`recipes`、`jobs`、`results`、`alarms`、`audit`。`app_meta` 保存 request/job/recipe/alarm 序號與 schema version；若既有資料仍在舊版 `app_state` 單一 document，後端第一次啟動時會自動遷移到新的 collection layout。

登入帳號：

| 角色 | 帳號 | 密碼 |
| --- | --- | --- |
| 廠區使用者 | `fab` | `password123` |
| 實驗室主管 | `supervisor` | `password123` |
| 實驗室人員 | `operator` | `password123` |
| 系統管理員 | `admin` | `password123` |

也可以分別啟動 FastAPI 後端與 Node 前端。以下 npm scripts 會使用專案根目錄的 `.venv/bin/python`，請先建立虛擬環境並安裝後端 dependencies：

```bash
python -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
```

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
- 登入者自行更換密碼：`PATCH /api/auth/password`
- 管理員建立帳號、查詢 / 指派使用者角色：`POST /api/users`、`GET /api/users`、`PATCH /api/users/:id/role`
- 建立委託單並送出簽核：`POST /api/requests`
- 主管核准 / 退回：`POST /api/requests/:id/approve`、`POST /api/requests/:id/reject`
- 實驗室收件：`POST /api/requests/:id/receive`
- 樣品分貨成 WIP：`POST /api/requests/:id/split`
- 建立派貨任務：`POST /api/dispatch-jobs`
- 上貨、下貨、回收資料、自動結案：`POST /api/dispatch-jobs/:id/load`、`POST /api/dispatch-jobs/:id/unload`
- 機台狀態管理：`POST /api/equipment/:id/status`
- 主管設定機台種類與台數：`PUT /api/equipment/types`
- 新增 Recipe：`POST /api/recipes`
- 模擬告警與確認處理：`POST /api/alarms/simulate`、`POST /api/alarms/:id/ack`
- 取得目前完整狀態：`GET /api/state`
- 健康檢查：`GET /api/health`

除 `/api/health` 與 `/api/auth/login` 外，其餘 API 都需要 `Authorization: Bearer <JWT>`。

## 測試

```bash
npm test
```

測試會依序執行：

- `npm run test:backend`：`.venv/bin/python -m pytest backend/tests`，驗證開單、簽核、收件、分貨、派貨、上貨、下貨、自動結案與告警處理。
- `npm run test:frontend`：`node --test frontend/tests/*.test.js`，驗證前端靜態 server、`config.js`、404/405 與路徑防護。

## Docker 啟動

```bash
docker compose up --build
```

前端服務：`https://localhost:8080/`

後端 API：`https://localhost:3443/api/health`

## Kubernetes 本機 Demo

本專案也提供 `k8s/` manifests，可用 Minikube 或 kind 在本機跑 frontend、backend、MongoDB、Redis。Kubernetes demo 使用 HTTP 方便 port-forward；Docker Compose 仍使用本機自簽 HTTPS。

Minikube 範例：

```bash
minikube start
eval $(minikube docker-env)
docker build -t lims-backend:local ./backend
docker build -t lims-frontend:local ./frontend
kubectl apply -f k8s/
```

kind 範例：

```bash
kind create cluster
docker build -t lims-backend:local ./backend
docker build -t lims-frontend:local ./frontend
kind load docker-image lims-backend:local
kind load docker-image lims-frontend:local
kubectl apply -f k8s/
```

確認部署：

```bash
kubectl get pods
kubectl get svc
kubectl rollout status deployment/backend
kubectl rollout status deployment/frontend
```

本機開啟服務：

```bash
kubectl port-forward svc/backend 3000:3000
kubectl port-forward svc/frontend 8080:8080
```

前端服務：`http://localhost:8080/`

後端 API：`http://localhost:3000/api/health`

`k8s/secret.example.yaml` 內的 `JWT_SECRET` 只供本機 demo 使用；正式環境請改成自己的 Secret 管理流程。

驗證 manifests：

```bash
kubectl apply --dry-run=client -f k8s/
```

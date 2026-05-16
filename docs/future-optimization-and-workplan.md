# 未來優化內容與五人分工

本文件把接下來的優化項目收斂成五人分工。目前採用「Docker + K8s 1 人、Backend 2 人、Frontend 2 人」的配置。這樣適合本專案，因為期末 demo 會高度依賴使用者操作流程、Dashboard、RWD 與資料展示；測試、觀測與文件責任則分散到各角色，而不是獨立設一位 QA/Docs 成員。

## 1. 建議五人角色

| 成員 | 角色 | 主責 | 主要參考檔案 |
| --- | --- | --- | --- |
| A | Docker + K8s / DevOps | Docker、Compose、K8s manifests、CI/CD、healthcheck、部署文件 | `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`, `.github/workflows/ci.yml`, `README.md`, `docs/current-system-architecture.md`, `docs/future-optimization-and-workplan.md` |
| B | Backend 1 - Workflow / RBAC | Request/Approval/Sample/WIP/Dispatch 狀態流程、RBAC、Audit | `backend/app/main.py`, `backend/app/domain.py`, `backend/app/auth.py`, `backend/app/seed.py`, `backend/tests/test_api.py` |
| C | Backend 2 - Equipment / Recipe / Machine Event | Equipment、Recipe version、Machine Event、Result、Alarm | `backend/app/main.py`, `backend/app/dashboard.py`, `backend/app/store.py`, `backend/tests/test_api.py` |
| D | Frontend 1 - Workflow UI / UX | 登入、角色權限 UI、委託/簽核/收件/手動分貨流程 | `frontend/index.html`, `frontend/app.js`, `frontend/styles.css`, `frontend/tests/` |
| E | Frontend 2 - Dashboard / Quality | Dashboard、結果/告警頁、RWD、XSS escape、frontend tests | `frontend/index.html`, `frontend/app.js`, `frontend/styles.css`, `frontend/tests/server.test.js`, `frontend/server.js` |

## 2. 依課程評分對應

| 評分項目 | 主要負責 | 目前狀態 | 下一步 |
| --- | --- | --- | --- |
| 需求轉換與實作 | B, C, D, E | 核心閉環已完成 | 手動分貨、Machine Event、Recipe version、Dashboard 強化 |
| 程式碼品質 | 全員 | 已有 pytest/Node tests | 拆 backend routes、補 lint/format、前端 XSS escape |
| 架構設計與可擴展性 | A, B, C | 有 Docker Compose 與 modular monolith | K8s manifests、route 分層、event-oriented extension |
| 系統測試與驗證 | B, C, D, E | `npm test` 已跑 backend + frontend | 各自負責自己功能的測試，D/E 補 frontend tests |
| 運維與可靠性 | A 主責，全員支援 | CI 與 health API 已有 | Docker healthcheck、restart policy、metrics、runbook |

## 3. 優化 Roadmap

### Phase 1：修正 Demo 風險與安全基本盤

目標：避免展示時出現角色混亂、安全明顯漏洞或流程跳關。

| 項目 | 負責 | 檔案 | 驗收標準 |
| --- | --- | --- | --- |
| 移除或鎖定登入後角色切換 | D | `frontend/app.js`, `frontend/index.html` | UI 顯示角色與 JWT user role 一致 |
| 前端 XSS escape | E | `frontend/app.js`, `frontend/tests/` | 所有使用者輸入顯示前都 escape；補 frontend test |
| 補 request/job 狀態錯誤訊息整理 | B | `backend/app/domain.py`, `backend/app/main.py` | 錯誤訊息可讀、測試通過 |
| 更新 demo script | A, D, E | `README.md`, `docs/` | 任何組員照 script 可完成展示 |

### Phase 2：補 LIMS 核心進階需求

目標：讓專案更貼近題目要求，而不是只做簡化流程。

| 項目 | 負責 | 檔案 | 驗收標準 |
| --- | --- | --- | --- |
| 手動 WIP 分貨 | B, D | `backend/app/main.py`, `frontend/app.js`, `frontend/index.html` | 可輸入多筆 WIP，總量不得超過 sample quantity |
| 派貨規則細化 | B | `backend/app/main.py`, `backend/tests/test_api.py` | 不可派已處理 WIP；不可重複派貨同一 item |
| Recipe version / deactivate | C, E | `backend/app/main.py`, `frontend/app.js` | 可停用舊版，只允許 active recipe 派貨 |
| Machine Event API | C | `backend/app/main.py` 或 `backend/app/routes/machine_events.py` | `completed` event 自動完成 job；`alarm` event 自動建告警 |
| 結果查詢強化 | C, E | `backend/app/main.py`, `frontend/app.js` | 可查單筆 result，前端可顯示 raw data/report metadata |

### Phase 3：雲原生部署與可靠性

目標：提高運維與可靠性評分。

| 項目 | 負責 | 檔案 | 驗收標準 |
| --- | --- | --- | --- |
| Docker healthcheck | A | `backend/Dockerfile`, `frontend/Dockerfile` | image 內可自我健康檢查 |
| Compose restart policy | A | `docker-compose.yml` | backend/frontend/mongo/redis 有 restart policy |
| K8s manifests | A | `k8s/` | 至少有 backend/frontend Deployment、Service、ConfigMap、Secret 範本 |
| Readiness/Liveness 說明 | A | `docs/future-optimization-and-workplan.md` 或 `docs/deployment-runbook.md` | 說明 K8s 如何判斷服務可用 |
| Runbook | A | `docs/` | 包含啟動、停止、重建、清資料、常見錯誤 |

### Phase 4：測試、觀測與文件收斂

目標：讓系統可驗證、可說明、可 demo。

| 項目 | 負責 | 檔案 | 驗收標準 |
| --- | --- | --- | --- |
| Backend tests 擴充 | B, C | `backend/tests/test_api.py` | 覆蓋 manual split、recipe inactive、machine event |
| Frontend tests 擴充 | D, E | `frontend/tests/` | 覆蓋 XSS escape、role UI、render helper |
| Dashboard metrics | C, E | `backend/app/dashboard.py`, `frontend/app.js` | 顯示 request status、operator actions、equipment utilization |
| Structured logs | A, B, C | `backend/app/main.py` | API error 與重要 action 有一致格式 |
| 文件一致性檢查 | A, D, E | `README.md`, `docs/` | 文件不再出現過期路徑或舊技術棧 |

## 4. 個人工作包

### A. Docker + K8s / DevOps

主要目標：讓專案從「能跑」提升到「有雲原生部署形狀」。

負責項目：

- Dockerfile healthcheck。參考檔案：`backend/Dockerfile`, `frontend/Dockerfile`。
- `docker-compose.yml` restart policy 與 service dependency 說明。參考檔案：`docker-compose.yml`。
- K8s manifests：
  - `k8s/backend-deployment.yaml`
  - `k8s/backend-service.yaml`
  - `k8s/frontend-deployment.yaml`
  - `k8s/frontend-service.yaml`
  - `k8s/configmap.yaml`
  - `k8s/secret.example.yaml`
- CI/CD 說明與部署 runbook。參考檔案：`.github/workflows/ci.yml`, `README.md`, `docs/current-system-architecture.md`。

驗收：

- `docker compose up --build` 可跑。
- `curl -k https://localhost:3443/api/health` 正常。
- README 有 Docker/K8s demo 步驟。
- K8s manifest 可被 `kubectl apply --dry-run=client -f k8s/` 驗證。

### B. Backend 1 - Workflow / RBAC

主要目標：把委託單、簽核、收件、分貨、派貨流程做紮實。

負責項目：

- 手動 WIP 分貨 API。參考檔案：`backend/app/main.py`, `backend/app/domain.py`。
- Request/job 狀態轉換規則。參考檔案：`backend/app/domain.py`, `backend/app/main.py`。
- 派貨 item 狀態規則。參考檔案：`backend/app/main.py`, `backend/tests/test_api.py`。
- Audit log 欄位強化，例如 action、targetType、targetId、actor。參考檔案：`backend/app/domain.py`, `backend/app/store.py`。
- RBAC 測試補齊。參考檔案：`backend/app/auth.py`, `backend/tests/test_api.py`。

建議檔案：

- `backend/app/main.py`
- `backend/app/domain.py`
- `backend/tests/test_api.py`

驗收：

- 未核准不可收件。
- 未收件不可分貨。
- WIP 總量不可超過 sample quantity。
- 同一 WIP 不可重複派貨。
- `npm test` 通過。

### C. Backend 2 - Equipment / Recipe / Machine Event

主要目標：補齊 LIMS 題目的機台、Recipe、結果回收與告警進階需求。

負責項目：

- Recipe version / deactivate API。參考檔案：`backend/app/main.py`, `backend/tests/test_api.py`。
- inactive recipe 不可派貨。參考檔案：`backend/app/main.py`, `backend/tests/test_api.py`。
- Machine Event API：
  - `completed`
  - `alarm`
  - `measurement`
- Result metadata 強化。參考檔案：`backend/app/main.py`, `backend/app/store.py`。
- Alarm rule threshold。參考檔案：`backend/app/main.py`, `backend/tests/test_api.py`。

建議檔案：

- `backend/app/main.py`
- `backend/app/dashboard.py`
- `backend/tests/test_api.py`

驗收：

- 新版 recipe 可建立，舊版可停用。
- machine completed event 可自動完成 job 並產生 result。
- machine alarm event 可建立 alarm 並更新 equipment status。
- Dashboard 可看到結果與告警數量變化。

### D. Frontend 1 - Workflow UI / UX

主要目標：讓使用者操作流程順暢，避免 UI 與權限模型互相矛盾。

負責項目：

- 登入後角色顯示與 JWT user role 一致。參考檔案：`frontend/app.js`, `frontend/index.html`。
- 移除或鎖定 role switcher。參考檔案：`frontend/index.html`, `frontend/app.js`。
- 手動 WIP 分貨表單。參考檔案：`frontend/index.html`, `frontend/app.js`, `frontend/styles.css`。
- Machine event 模擬 UI。參考檔案：`frontend/index.html`, `frontend/app.js`。
- 委託單、簽核、收件、派貨流程的狀態提示。參考檔案：`frontend/app.js`, `frontend/styles.css`。

建議檔案：

- `frontend/index.html`
- `frontend/app.js`
- `frontend/styles.css`
- `frontend/tests/`

驗收：

- 不同角色只看到合理操作。
- 手動分貨可輸入多筆 WIP。
- 操作失敗時有清楚錯誤提示。
- 核心 demo 流程不需要手動改資料即可完成。

### E. Frontend 2 - Dashboard / Quality

主要目標：讓系統資訊呈現完整，並補足前端品質、安全與測試。

負責項目：

- XSS escape。參考檔案：`frontend/app.js`, `frontend/tests/`。
- Dashboard 圖表強化。參考檔案：`frontend/app.js`, `frontend/index.html`, `frontend/styles.css`, `backend/app/dashboard.py`。
- 結果管理頁強化。參考檔案：`frontend/app.js`, `frontend/index.html`, `backend/app/main.py`。
- 告警頁強化。參考檔案：`frontend/app.js`, `frontend/index.html`, `backend/app/main.py`。
- Recipe version / deactivate UI。參考檔案：`frontend/app.js`, `frontend/index.html`, `backend/app/main.py`。
- RWD 與文字不爆版。參考檔案：`frontend/styles.css`, `frontend/index.html`。
- Frontend tests。參考檔案：`frontend/tests/server.test.js`, `frontend/server.js`；需要測 UI helper 時可新增 `frontend/tests/app.test.js`。

建議檔案：

- `frontend/index.html`
- `frontend/app.js`
- `frontend/styles.css`
- `frontend/tests/server.test.js` 或新增 `frontend/tests/app.test.js`

驗收：

- 使用者輸入特殊字元不會被當成 HTML 執行。
- 手機版畫面不重疊、不爆版。
- Dashboard 至少呈現 request status、operator actions、equipment utilization。
- 結果與告警頁可支援期末 demo。
- `npm run test:frontend` 通過。

## 5. 建議開發順序

| 順序 | 工作 | 負責 | 原因 |
| ---: | --- | --- | --- |
| 1 | 角色/JWT 一致性、XSS escape | D | 最容易在 demo 被看出問題 |
| 2 | 手動 WIP 分貨與狀態規則 | B | 對應 LIMS 核心流程 |
| 3 | Recipe version 與 Machine Event | C | 對應進階需求與自動化 |
| 4 | Docker healthcheck、Compose restart、K8s manifests | A | 對應雲原生部署 |
| 5 | Dashboard、RWD、frontend tests | E | 對應 demo 呈現與前端品質 |

## 6. Demo 分工

| 段落 | 展示者 | 展示內容 |
| --- | --- | --- |
| 架構與部署 | A | Docker Compose、K8s manifests、healthcheck、CI/CD |
| 委託與簽核流程 | B | 建立委託單、主管簽核、收件、狀態規則 |
| 機台與結果自動化 | C | Recipe version、machine event、result、alarm |
| 前端操作與 UX | D | 權限化 UI、手動分貨、Machine Event 模擬操作 |
| Dashboard 與前端品質 | E | Dashboard、結果/告警頁、RWD、frontend tests、XSS 防護 |

## 7. 結論

此分工可行，而且比原本「每人按功能頁切」更貼近課程評分：

- A 負責雲原生部署與可靠性。
- B/C 負責後端核心與進階需求。
- D 負責前端使用者流程。
- E 負責 Dashboard、結果告警頁、RWD 與前端品質。

這樣可以避免所有人都擠在同一塊程式碼，也能讓每個人在期末報告都有清楚可展示的成果。

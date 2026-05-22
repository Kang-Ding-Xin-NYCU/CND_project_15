# 未來優化內容與五人分工

本文件把接下來的優化項目收斂成五人分工。目前採用「Docker + K8s 1 人、Backend 2 人、Frontend 2 人」的配置。這樣適合本專案，因為期末 demo 會高度依賴使用者操作流程、Dashboard、RWD 與資料展示；測試、觀測與文件責任則分散到各角色，而不是獨立設一位 QA/Docs 成員。

## 1. 建議五人角色

| 成員 | 角色 | 主責 | 主要參考檔案 |
| --- | --- | --- | --- |
| A | Docker + K8s / DevOps | Docker、Compose、K8s manifests、CI/CD、healthcheck、部署文件 | `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`, `.github/workflows/ci.yml`, `README.md`, `docs/current-system-architecture.md`, `docs/future-optimization-and-workplan.md` |
| B | Backend 1 - Workflow / RBAC | Request/Approval/Sample/WIP/Dispatch 狀態流程、RBAC、Audit | `backend/app/routes/requests.py`, `backend/app/routes/jobs.py`, `backend/app/services/request_service.py`, `backend/app/services/dispatch_service.py`, `backend/app/domain.py`, `backend/app/auth.py`, `backend/app/seed.py`, `backend/tests/test_api.py` |
| C | Backend 2 - Equipment / Recipe / Machine Event | Equipment、Recipe version、Machine Event、Result、Alarm | `backend/app/routes/equipment.py`, `backend/app/routes/recipes.py`, `backend/app/routes/alarms.py`, `backend/app/routes/results.py`, `backend/app/services/equipment_service.py`, `backend/app/services/recipe_service.py`, `backend/app/services/alarm_service.py`, `backend/app/dashboard.py`, `backend/app/store.py`, `backend/tests/test_api.py` |
| D | Frontend 1 - Workflow UI / UX | 登入、角色權限 UI、委託/簽核/收件/手動分貨流程 | `frontend/index.html`, `frontend/app.js`, `frontend/styles.css`, `frontend/tests/` |
| E | Frontend 2 - Dashboard / Quality | Dashboard、結果/告警頁、RWD、XSS escape、frontend tests | `frontend/index.html`, `frontend/app.js`, `frontend/styles.css`, `frontend/tests/server.test.js`, `frontend/server.js` |

### `frontend/app.js` 分工約定

D 與 E 都會動 `frontend/app.js`，為避免 merge conflict 採以下約定：

- **D 維護**：login、role display、request / dispatch / split / Machine event simulator 相關 handler 與 form。
- **E 維護**：dashboard、results、alarms、recipes 頁面、render helper、XSS escape util。
- XSS escape helper 由 **E 在 Day 1 寫成 export function**，D 引用同一個，不另開。
- 動到 shared section（state、router、entry point、common API client）前，必須先在 stand-up 對齊。

## 2. 依課程評分對應

| 評分項目 | 主要負責 | 目前狀態 | 下一步 |
| --- | --- | --- | --- |
| 需求轉換與實作 | B, C, D, E | 核心閉環已完成 | 手動分貨、Machine Event、Recipe version、Dashboard 強化 |
| 程式碼品質 | 全員 | 已有 pytest/Node tests；後端已分 routes/ + services/ 層 | 補 lint/format、前端 XSS escape |
| 架構設計與可擴展性 | A, B, C | Docker Compose、modular monolith、router/service/domain/repository 四層 | K8s manifests、event-oriented extension |
| 系統測試與驗證 | B, C, D, E | `npm test` 已跑 backend + frontend | 各自負責自己功能的測試，D/E 補 frontend tests |
| 運維與可靠性 | A 主責，全員支援 | CI 與 health API 已有 | Docker healthcheck、restart policy、metrics、runbook |

## 3. 一週 Sprint 排程

整個 sprint 壓在 7 天內，5 人並行。下表用「半天為單位」估算，每日 stand-up 微調。日期以實際 kickoff 日為準。

| Day | A — DevOps | B — Workflow / RBAC | C — Equipment / Recipe / Event | D — Workflow UI | E — Dashboard / Quality |
| --- | --- | --- | --- | --- | --- |
| 1 (Kickoff) | Dockerfile healthcheck、Compose restart policy | **Phase 1** 狀態錯誤訊息 + **§4 freeze API contracts**（manual split、dispatch rule） | **§4 freeze API contracts**（machine event、recipe deactivate） | **Phase 1** 角色 / JWT 一致性、移除 role switcher | **Phase 1** XSS escape helper（export） + 套到所有 render |
| 2 | K8s manifests 起手（Deployment / Service / ConfigMap） | **Phase 2** 手動 WIP 分貨 API + 派貨規則 | **Phase 2** Machine Event API + Recipe deactivate | 套 B 的 contract 做手動分貨表單（mock 即可） | Dashboard metrics + 結果頁 |
| 3 | K8s manifests 補完 + `secret.example.yaml` | Audit log additive 欄位（§4.4） | inactive recipe 不可派 + Result metadata | 接 B/C 真實 API、跑 happy path | 告警頁 + Recipe deactivate UI |
| 4 | Readiness/Liveness 接 `/api/health` + Runbook | Backend tests 擴充（manual split、dispatch rule） | Backend tests 擴充（machine event、recipe deactivate） | Machine event 模擬 UI | RWD + frontend tests 擴充 |
| 5 | Structured logs middleware（與 B/C 對欄位） | Phase 1/2 殘餘修補 + code review | Phase 1/2 殘餘修補 + code review | UX 微調、錯誤提示 | Dashboard 收尾、XSS test |
| 6 | 文件一致性檢查 + `docs/demo-script.md` | Demo 排練（B 段） | Demo 排練（C 段） | Demo 排練（D 段） | Demo 排練（E 段） |
| 7 | Demo 整合演練 + buffer | Buffer / 補測試 | Buffer / 補測試 | Buffer / UX polish | Buffer / 文件 |

**並行規則**：

- **Day 1 結束前** B/C 必須 freeze §4 API contracts 為 GitHub Issue，否則 D/E 在 Day 2 沒辦法開工 Phase 2。
- **Day 1–5** A 全程 Docker/K8s，跟 B/C/D/E 解耦，不擋路徑。
- **Day 6 起 feature freeze**，只做 demo polish、文件、buffer。
- 每天 15 分鐘 stand-up：昨天做了什麼 / 今天要做什麼 / blocker。
- 任一新 API（即使是 §4 之外）merge 前要 PR + 1 個 reviewer，CI 必須綠燈。

## 4. API Contracts（Day 1 由 B/C freeze 成 GitHub Issues）

下列三個 API 是 Phase 2 同時被 backend 與 frontend 依賴的介面。Day 1 必須 freeze，frozen 後改 contract 需重新對齊。frontend 在 Day 1–2 可用 mock 並行開發。

### 4.1 手動 WIP 分貨（B → D）

```
POST /api/requests/{id}/split
Roles: operator
Body:
{
  "actor": "string",
  "wips": [
    { "quantity": int, "purpose": "string" }
  ]
}
Validation:
  - request.status must be "received"          → 409
  - len(wips) ≥ 1                              → 400
  - Σ wips[].quantity ≤ samples[0].quantity    → 400
  - 每個 wip.quantity > 0                       → 400
Side effect:
  - request.status = "split"
  - samples[0].status = "split"
  - 自動生成 wips[].id = "{sampleCode}-A", "-B", "-C", …
  - audit: "{REQ} split into A,B,C"
Response 200: { "state": {...}, "message": "{REQ} split into WIP" }
```

### 4.2 Machine Event API（C → D）

```
POST /api/machine-events
Roles: operator
Body:
{
  "equipmentId": "string",
  "eventType":  "completed" | "alarm" | "measurement",
  "jobId":      "string?",   # required for completed / measurement
  "payload":    { ... },     # event-specific
  "actor":      "string?"    # default "Machine"
}
Semantics:
  completed:
    - asserts job.status ∈ (running, loaded)
    - job → completed, machine → idle, request → closed
    - 產生 result row（等同 POST /api/dispatch-jobs/{id}/unload）
  alarm:
    - 建 alarm（severity / message 來自 payload）+ machine.status = "alarm"
  measurement:
    - v1 暫時 append 到 job.history，audit only
Response 201: { "state": {...}, "message": "event processed" }
```

### 4.3 Recipe deactivate（C → E）

```
POST /api/recipes/{id}/deactivate
Roles: admin
Body: { "actor": "string?" }
Validation:
  - recipe must exist          → 404
Side effect:
  - recipe.active = false
  - audit: "{RCP} deactivated"
Response 200: { "state": {...}, "message": "{RCP} deactivated" }

# dispatch_service 已會拒絕 active=false 的 recipe，不必改派貨邏輯
```

### 4.4 Audit log additive（B → 全員）

audit row 由 `{message, actor, occurredAt}` 擴充為：

```
{
  "message":     "string",     # 保留，舊 reader 仍可用
  "actor":       "string",
  "occurredAt":  "string",
  "action":      "string",     # 例如 "request.split", "job.unload"
  "targetType":  "request" | "job" | "equipment" | "recipe" | "alarm",
  "targetId":    "string"
}
```

**additive 不破壞既有資料**。舊資料缺 `action / targetType / targetId` 時，frontend 顯示直接 fallback 用 `message`。

### 4.5 派貨規則細化（B 內部規則，不改 endpoint shape）

`POST /api/dispatch-jobs` 新增驗證：

- WIP.status 必須 `== "queued"`，否則 409，message：`"WIP {wipId} is not dispatchable (status: {x})"`。
- 同一個 `(requestId, wipId)` 不可存在 status ∈ (`queued`, `running`, `loaded`) 的 job，否則 409 防重派。

## 5. 優化 Roadmap

### Phase 1：修正 Demo 風險與安全基本盤

目標：避免展示時出現角色混亂、安全明顯漏洞或流程跳關。優先級：**P0** 必做、**P1** 加分、**P2** 時間不夠可砍。

| 優先 | 項目 | 負責 | 檔案 | 驗收標準 |
| --- | --- | --- | --- | --- |
| P0 | 移除或鎖定登入後角色切換 | D | `frontend/app.js`, `frontend/index.html` | UI 顯示角色與 JWT user role 一致 |
| P0 | 前端 XSS escape | E | `frontend/app.js`, `frontend/tests/` | 所有使用者輸入顯示前都 escape；補 frontend test |
| P1 | 補 request/job 狀態錯誤訊息整理 | B | `backend/app/domain.py`, `backend/app/services/request_service.py`, `backend/app/services/dispatch_service.py` | 錯誤訊息可讀；**每個錯誤分支至少 1 個 test 驗證** |
| P1 | 更新 demo script | A, D, E | `docs/demo-script.md`（新增）, `README.md` | 任何組員照 script 可完成展示 |

### Phase 2：補 LIMS 核心進階需求

目標：讓專案更貼近題目要求，而不是只做簡化流程。所有 P0 都是題目卡片明文要求，**全部 contract 在 §4 freeze**。

| 優先 | 項目 | 負責 | 檔案 | 驗收標準 |
| --- | --- | --- | --- | --- |
| P0 | 手動 WIP 分貨 | B, D | `backend/app/routes/requests.py`, `backend/app/services/request_service.py`, `frontend/app.js`, `frontend/index.html` | 依 §4.1；可輸入多筆 WIP，總量不得超過 sample quantity |
| P0 | 派貨規則細化 | B | `backend/app/services/dispatch_service.py`, `backend/tests/test_api.py` | 依 §4.5；WIP 必須 queued 才能派；不可重複派 |
| P0 | Recipe deactivate | C, E | `backend/app/routes/recipes.py`, `backend/app/services/recipe_service.py`, `frontend/app.js` | 依 §4.3；可停用舊版，只允許 active recipe 派貨 |
| P0 | Machine Event API | C | 新增 `backend/app/routes/machine_events.py` + `backend/app/services/machine_event_service.py` | 依 §4.2；`completed` 自動完成 job、`alarm` 自動建告警 |
| P1 | 結果查詢強化 | C, E | `backend/app/routes/results.py`, `frontend/app.js` | 可查單筆 result，前端可顯示 raw data / report metadata |

### Phase 3：雲原生部署與可靠性

目標：提高運維與可靠性評分。

| 優先 | 項目 | 負責 | 檔案 | 驗收標準 |
| --- | --- | --- | --- | --- |
| P0 | Docker healthcheck | A | `backend/Dockerfile`, `frontend/Dockerfile` | image 內可自我健康檢查 |
| P0 | Compose restart policy | A | `docker-compose.yml` | backend/frontend/mongo/redis 有 restart policy |
| P0 | K8s manifests | A | `k8s/` | 至少有 backend/frontend Deployment、Service、ConfigMap、Secret 範本；`kubectl apply --dry-run=client -f k8s/` 通過 |
| P1 | K8s manifests hardening | A | `k8s/` | 已有本機 manifests；下一步補 ingress / namespace / resource limits / production Secret 流程 |
| P1 | Readiness/Liveness 說明 | A | `docs/future-optimization-and-workplan.md` 或 `docs/deployment-runbook.md` | 說明 K8s 如何判斷服務可用 |
| P1 | Runbook | A | `docs/` | 包含啟動、停止、重建、清資料、常見錯誤 |

### Phase 4：測試、觀測與文件收斂

目標：讓系統可驗證、可說明、可 demo。

| 優先 | 項目 | 負責 | 檔案 | 驗收標準 |
| --- | --- | --- | --- | --- |
| P0 | Backend tests 擴充 | B, C | `backend/tests/test_api.py` | 覆蓋 manual split、dispatch rule、recipe inactive、machine event |
| P0 | Frontend tests 擴充 | D, E | `frontend/tests/` | 覆蓋 XSS escape、role UI、render helper |
| P1 | Dashboard metrics | C, E | `backend/app/dashboard.py`, `frontend/app.js` | 顯示 request status、operator actions、equipment utilization |
| P2 | Structured logs | A, B, C | `backend/app/main.py`（middleware）、`backend/app/services/` | API error 與重要 action 有一致 JSON 格式（time / level / event / actor / targetId） |
| P1 | 文件一致性檢查 | A, D, E | `README.md`, `docs/` | 文件不再出現過期路徑或舊技術棧 |

## 6. 個人工作包

### A. Docker + K8s / DevOps

主要目標：讓專案從「能跑」提升到「有雲原生部署形狀」。

負責項目：

- Dockerfile healthcheck。參考檔案：`backend/Dockerfile`, `frontend/Dockerfile`。
- `docker-compose.yml` restart policy 與 service dependency 說明。參考檔案：`docker-compose.yml`。
- K8s manifests 與後續 hardening：
  - `k8s/backend-deployment.yaml`
  - `k8s/backend-service.yaml`
  - `k8s/frontend-deployment.yaml`
  - `k8s/frontend-service.yaml`
  - `k8s/configmap.yaml`
  - `k8s/secret.example.yaml`
  - `k8s/mongo.yaml`
  - `k8s/redis.yaml`
- CI/CD 說明與部署 runbook。參考檔案：`.github/workflows/ci.yml`, `README.md`, `docs/current-system-architecture.md`。

驗收：

- `docker compose up --build` 可跑。
- `curl -k https://localhost:3443/api/health` 正常。
- README 有 Docker/K8s demo 步驟。
- K8s manifest 可被 `kubectl apply --dry-run=client -f k8s/` 驗證。

### B. Backend 1 - Workflow / RBAC

主要目標：把委託單、簽核、收件、分貨、派貨流程做紮實。

負責項目：

- 手動 WIP 分貨 API。參考檔案：`backend/app/routes/requests.py`, `backend/app/services/request_service.py`, `backend/app/domain.py`。
- Request/job 狀態轉換規則。參考檔案：`backend/app/domain.py`, `backend/app/services/request_service.py`, `backend/app/services/dispatch_service.py`。
- 派貨 item 狀態規則。參考檔案：`backend/app/services/dispatch_service.py`, `backend/tests/test_api.py`。
- Audit log 欄位強化，例如 action、targetType、targetId、actor。參考檔案：`backend/app/domain.py`, `backend/app/store.py`。
- RBAC 測試補齊。參考檔案：`backend/app/auth.py`, `backend/tests/test_api.py`。

建議檔案：

- `backend/app/routes/requests.py`
- `backend/app/routes/jobs.py`
- `backend/app/services/request_service.py`
- `backend/app/services/dispatch_service.py`
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

- Recipe version / deactivate API。參考檔案：`backend/app/routes/recipes.py`, `backend/app/services/recipe_service.py`, `backend/tests/test_api.py`。
- inactive recipe 不可派貨。參考檔案：`backend/app/services/dispatch_service.py`, `backend/tests/test_api.py`。
- Machine Event API：新增 `backend/app/routes/machine_events.py` + `backend/app/services/machine_event_service.py`，事件型別：
  - `completed`
  - `alarm`
  - `measurement`
- Result metadata 強化。參考檔案：`backend/app/routes/results.py`, `backend/app/services/dispatch_service.py`, `backend/app/store.py`。
- Alarm rule threshold。參考檔案：`backend/app/services/alarm_service.py`, `backend/app/services/equipment_service.py`, `backend/tests/test_api.py`。

建議檔案：

- `backend/app/routes/recipes.py`, `backend/app/routes/results.py`, `backend/app/routes/alarms.py`, `backend/app/routes/equipment.py`
- `backend/app/services/recipe_service.py`, `backend/app/services/alarm_service.py`, `backend/app/services/equipment_service.py`
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
- 結果管理頁強化。參考檔案：`frontend/app.js`, `frontend/index.html`, `backend/app/routes/results.py`。
- 告警頁強化。參考檔案：`frontend/app.js`, `frontend/index.html`, `backend/app/routes/alarms.py`。
- Recipe version / deactivate UI。參考檔案：`frontend/app.js`, `frontend/index.html`, `backend/app/routes/recipes.py`。
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

## 7. Demo 分工

| 段落 | 展示者 | 展示內容 |
| --- | --- | --- |
| 架構與部署 | A | Docker Compose、K8s manifests、healthcheck、CI/CD |
| 委託與簽核流程 | B | 建立委託單、主管簽核、收件、狀態規則 |
| 機台與結果自動化 | C | Recipe version、machine event、result、alarm |
| 前端操作與 UX | D | 權限化 UI、手動分貨、Machine Event 模擬操作 |
| Dashboard 與前端品質 | E | Dashboard、結果/告警頁、RWD、frontend tests、XSS 防護 |

## 8. 結論

此分工可行，而且比原本「每人按功能頁切」更貼近課程評分：

- A 負責雲原生部署與可靠性。
- B/C 負責後端核心與進階需求。
- D 負責前端使用者流程。
- E 負責 Dashboard、結果告警頁、RWD 與前端品質。

這樣可以避免所有人都擠在同一塊程式碼，也能讓每個人在期末報告都有清楚可展示的成果。

# 五人分工建議

## 分工原則

以功能邊界切分，每個人都有清楚的責任區塊與可展示成果。每週整合一次，避免最後才合併。所有人都要共同遵守 Git flow、code review、測試與文件格式。

## 角色與負責區塊

| 成員 | 角色 | 負責區塊 | 主要交付 |
| --- | --- | --- | --- |
| A | 組長 / 架構 / DevOps | 系統架構、repo 管理、Docker、CI/CD、部署與監控 | 架構圖、README、`backend/Dockerfile`、`frontend/Dockerfile`、docker-compose 或 k8s manifests、CI pipeline |
| B | 前端 / UX | RWD 介面、角色流程、Dashboard、委託單與簽核頁面 | `frontend/index.html`、`frontend/app.js`、`frontend/styles.css`、表單驗證、狀態提示 |
| C | 後端 - Auth、委託單與簽核 | JWT Auth、Request、Approval、RBAC、Audit Log | `backend/src/auth.js`、`backend/src/routes/auth.js`、`backend/src/routes/requests.js`、權限檢查、簽核 API、單元測試 |
| D | 後端 - 樣品與派貨 | Sample、WIP 分貨、Dispatch、上下貨歷史 | `backend/src/routes/dispatch-jobs.js`、收件/分貨 API、派貨 API、整合測試 |
| E | 機台 / Recipe / 結果與測試 | Equipment、Recipe、Redis cache、機台資料模擬、結果回收、告警、測試策略 | `backend/src/cache.js`、`backend/src/routes/equipment.js`、`backend/src/routes/recipes.js`、`backend/src/routes/alarms.js`、測試報告 |

## 依課程評分對應

| 評分項目 | 主要負責 | 補充 |
| --- | --- | --- |
| 需求轉換與實作 30% | B, C, D, E | B 確保流程可展示；C/D/E 完成核心 API 與資料流 |
| 程式碼品質 10% | 全員，A 把關 | lint、formatter、PR review、模組邊界 |
| 架構設計與可擴展性 20% | A 主責，全員補充 | Mermaid 架構圖、資料模型、事件流、擴展策略 |
| 系統測試與驗證 20% | E 主責，全員撰寫 | 單元測試、整合測試、端到端測試、測試資料 |
| 運維與可靠性 20% | A, E | CI/CD、Docker、健康檢查、監控、錯誤處理 |

## 建議開發里程碑

| 週期 | 目標 |
| --- | --- |
| 第 1 週 | 確認 user story、資料模型、API contract、UI wireframe |
| 第 2 週 | 完成委託單、簽核、收件與基本 Dashboard |
| 第 3 週 | 完成機台/Recipe、分貨、派貨、上下貨歷史 |
| 第 4 週 | 完成結果回收、告警、統計圖表與測試 |
| 第 5 週 | 補 CI/CD、容器化、監控說明、簡報與 demo script |

## Demo 分工

| 流程 | 展示者 | Demo 重點 |
| --- | --- | --- |
| 開立委託單 | B | 表單、樣品資訊、RWD |
| 主管簽核 | C | 狀態流轉、權限、audit log |
| 收件與分貨 | D | 樣品歷程、WIP 追溯 |
| 派貨與機台結果 | E | Recipe、上貨下貨、機台自動回傳 |
| 架構與部署 | A | 雲原生架構、CI/CD、監控與可靠性 |

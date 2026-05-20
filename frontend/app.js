const statusText = {
  draft: "草稿",
  pending_approval: "待簽核",
  approved: "已核准",
  rejected: "退回",
  received: "已收件",
  split: "已分貨",
  in_progress: "實驗中",
  completed: "已完成",
  closed: "已結案",
  queued: "待上貨",
  loaded: "已上貨",
  running: "執行中",
  failed: "失敗",
  idle: "閒置",
  busy: "使用中",
  maintenance: "保養",
  alarm: "異常"
};

const roleText = {
  fab: "廠區使用者",
  supervisor: "實驗室主管",
  operator: "實驗室人員",
  admin: "系統管理員"
};

const state = {
  requestSeq: 4,
  recipeSeq: 4,
  jobSeq: 2,
  alarmSeq: 2,
  currentRole: "fab",
  requests: [
    {
      id: "REQ-2026-001",
      requester: "Evan Lin",
      department: "Fab 12 R&D",
      labType: "SEM",
      priority: "High",
      dueDate: "2026-05-08",
      goal: "Gate oxide defect review，需輸出 SEM 影像與缺陷摘要。",
      status: "pending_approval",
      samples: [
        { id: "SMP-001", material: "Wafer Lot A13", quantity: 3, status: "created" }
      ],
      wips: []
    },
    {
      id: "REQ-2026-002",
      requester: "Mia Huang",
      department: "Fab 15 Process",
      labType: "XRD",
      priority: "Normal",
      dueDate: "2026-05-10",
      goal: "薄膜晶向分析，需確認 stress trend。",
      status: "received",
      samples: [
        { id: "SMP-002", material: "Wafer Lot B07", quantity: 2, status: "received" }
      ],
      wips: [
        { id: "WIP-002-A", source: "SMP-002", quantity: 1, purpose: "XRD baseline", status: "queued" },
        { id: "WIP-002-B", source: "SMP-002", quantity: 1, purpose: "XRD confirm", status: "queued" }
      ]
    },
    {
      id: "REQ-2026-003",
      requester: "Nora Wu",
      department: "Fab 18 Yield",
      labType: "FTIR",
      priority: "Critical",
      dueDate: "2026-05-06",
      goal: "污染來源確認，需快速回傳光譜結果。",
      status: "in_progress",
      samples: [
        { id: "SMP-003", material: "Wafer Lot C21", quantity: 1, status: "loaded" }
      ],
      wips: [
        { id: "WIP-003-A", source: "SMP-003", quantity: 1, purpose: "FTIR urgent scan", status: "loaded" }
      ]
    }
  ],
  equipment: [
    { id: "EQ-SEM-01", name: "SEM-01", area: "Lab A", capability: "高解析影像", status: "idle", utilization: 62 },
    { id: "EQ-XRD-02", name: "XRD-02", area: "Lab B", capability: "薄膜晶體分析", status: "idle", utilization: 48 },
    { id: "EQ-FTIR-03", name: "FTIR-03", area: "Lab C", capability: "材料光譜", status: "busy", utilization: 81 },
    { id: "EQ-PROBE-04", name: "Probe-04", area: "Lab D", capability: "電性測試", status: "alarm", utilization: 35 }
  ],
  recipes: [
    { id: "RCP-001", equipmentId: "EQ-SEM-01", name: "Defect Review Standard", version: "1.2.0", parameters: "voltage=3kV; dwell=30ms" },
    { id: "RCP-002", equipmentId: "EQ-XRD-02", name: "Thin Film Stress Scan", version: "2.1.0", parameters: "angle=20-80; step=0.02" },
    { id: "RCP-003", equipmentId: "EQ-FTIR-03", name: "Contamination Quick Scan", version: "1.4.3", parameters: "range=400-4000; resolution=4" }
  ],
  jobs: [
    {
      id: "JOB-2026-001",
      requestId: "REQ-2026-003",
      wipId: "WIP-003-A",
      equipmentId: "EQ-FTIR-03",
      recipeId: "RCP-003",
      operator: "Lab Operator",
      status: "running",
      note: "緊急件，優先處理。",
      history: ["2026-05-02 18:20 派貨", "2026-05-02 18:32 上貨"]
    }
  ],
  results: [],
  alarms: [
    { id: "ALM-001", equipmentId: "EQ-PROBE-04", severity: "High", message: "Probe card contact resistance over threshold", status: "alarm" }
  ],
  audit: [
    "REQ-2026-003 已派貨到 FTIR-03",
    "REQ-2026-002 實驗室已收件",
    "REQ-2026-001 送出主管簽核"
  ]
};

const pageTitles = {
  dashboard: "總覽",
  requests: "委託開單",
  approval: "簽核中心",
  lab: "收件與派貨",
  equipment: "機台與 Recipe",
  reports: "結果與統計"
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const apiBaseUrl = (window.LIMS_API_BASE_URL || "").replace(/\/$/, "");

function escapeHtml(unsafe) {
  if (typeof unsafe !== "string") return unsafe;
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const authState = {
  token: window.localStorage.getItem("limsJwt") || "",
  user: null
};

function apiUrl(path) {
  return `${apiBaseUrl}${path}`;
}

function statusPill(status) {
  const safeStatus = escapeHtml(status);
  return `<span class="status-pill status-${safeStatus}">${statusText[status] || safeStatus}</span>`;
}

function priorityPill(priority) {
  const safePriority = escapeHtml(priority);
  return `<span class="priority-pill priority-${safePriority}">${safePriority}</span>`;
}

function equipmentName(id) {
  return state.equipment.find((item) => item.id === id)?.name || id;
}

function recipeName(id) {
  return state.recipes.find((item) => item.id === id)?.name || id;
}

function requestById(id) {
  return state.requests.find((request) => request.id === id);
}

function jobById(id) {
  return state.jobs.find((job) => job.id === id);
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  const loginToast = $("#loginToast");
  if (loginToast) {
    loginToast.textContent = message;
    loginToast.classList.add("is-visible");
  }
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.textContent = "";
    toast.classList.remove("is-visible");
    if (loginToast) {
      loginToast.textContent = "";
      loginToast.classList.remove("is-visible");
    }
  }, 2600);
}

function addAudit(message) {
  state.audit.unshift({
    message,
    actor: roleText[state.currentRole] || "Demo User",
    occurredAt: new Date().toLocaleString("zh-TW", { hour12: false })
  });
}

function auditMessage(entry) {
  return escapeHtml(typeof entry === "string" ? entry : entry.message);
}

function auditTime(entry) {
  return typeof entry === "string"
    ? new Date().toLocaleString("zh-TW", { hour12: false })
    : entry.occurredAt;
}

function formToObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function actorPayload(extra = {}) {
  return {
    actor: roleText[state.currentRole] || "Demo User",
    role: state.currentRole,
    ...extra
  };
}

function syncState(nextState) {
  const currentRole = state.currentRole;
  Object.keys(state).forEach((key) => delete state[key]);
  Object.assign(state, nextState, { currentRole });
  renderAll();
}

const apiClient = {
  available: window.location.protocol !== "file:",

  async request(path, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {})
    };
    if (authState.token) headers.Authorization = `Bearer ${authState.token}`;

    const response = await fetch(apiUrl(path), {
      ...options,
      headers
    });
    const payload = await response.json();
    if (!response.ok) {
      const error = new Error(payload.error || `API request failed: ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return payload;
  },

  async action(path, options = {}) {
    if (!this.available) return false;

    try {
      const payload = await this.request(path, options);
      if (payload.state) syncState(payload.state);
      if (payload.message) showToast(payload.message);
      return true;
    } catch (error) {
      if (error.status) {
        console.error(error);
        if (error.status === 401) {
          clearSession();
          showLogin();
        }
        showToast(error.message);
        return true;
      }
      this.available = false;
      console.error(error);
      showToast("API 連線失敗，改用前端 demo 模式");
      return false;
    }
  }
};

function showLogin() {
  $("#loginView").classList.remove("is-hidden");
  $("#appShell").classList.add("is-hidden");
}

function showApp() {
  $("#loginView").classList.add("is-hidden");
  $("#appShell").classList.remove("is-hidden");
}

function setSession(token, user) {
  authState.token = token;
  authState.user = user;
  window.localStorage.setItem("limsJwt", token);
  state.currentRole = user.role;
  $("#roleSelect").value = user.role;
  $("#userBadge").textContent = `${user.name}`;
}

function clearSession() {
  authState.token = "";
  authState.user = null;
  window.localStorage.removeItem("limsJwt");
  $("#userBadge").textContent = "未登入";
}

async function loadState() {
  const snapshot = await apiClient.request("/api/state");
  syncState(snapshot);
  showApp();
}

async function login(form) {
  const payload = formToObject(form);
  const result = await apiClient.request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  setSession(result.token, result.user);
  await loadState();
  showToast(`${result.user.name} 已登入`);
}

async function logout() {
  if (authState.token) {
    try {
      await apiClient.request("/api/auth/logout", { method: "POST", body: "{}" });
    } catch (error) {
      console.warn(error);
    }
  }
  clearSession();
  showLogin();
}

function switchSection(sectionId) {
  $$(".nav-item").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.section === sectionId);
  });
  $$(".view").forEach((view) => {
    view.classList.toggle("is-active", view.id === sectionId);
  });
  $("#pageTitle").textContent = pageTitles[sectionId] || "Cloud LIMS";
}

function renderMetrics() {
  const counts = {
    pending: state.requests.filter((item) => item.status === "pending_approval").length,
    receiving: state.requests.filter((item) => item.status === "approved").length,
    running: state.jobs.filter((job) => ["queued", "loaded", "running"].includes(job.status)).length,
    alarms: state.alarms.filter((alarm) => alarm.status === "alarm").length
  };

  $("#metricGrid").innerHTML = [
    ["待簽核", counts.pending, "主管需核准後才能送件"],
    ["待收件", counts.receiving, "已核准但尚未進實驗室"],
    ["進行中任務", counts.running, "派貨、上貨或執行中的實驗"],
    ["異常告警", counts.alarms, "需要實驗室人員介入"]
  ]
    .map(([label, value, note]) => `
      <article class="metric-card">
        <span class="metric-label">${label}</span>
        <strong class="metric-value">${value}</strong>
        <p class="metric-note">${note}</p>
      </article>
    `)
    .join("");
}

function renderDashboardStatusChart() {
  const statusOrder = ["pending_approval", "approved", "received", "split", "in_progress", "completed", "closed", "rejected"];
  const statusColors = {
    pending_approval: "var(--amber)", approved: "var(--green)", received: "#38a169",
    split: "var(--violet)", in_progress: "var(--blue)", completed: "var(--teal)",
    closed: "var(--teal)", rejected: "var(--red)"
  };

  const counts = {};
  state.requests.forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1; });
  const total = state.requests.length || 1;

  const segments = statusOrder
    .filter((s) => counts[s])
    .map((s) => `<div class="status-bar-segment seg-${s}" style="width: ${(counts[s] / total * 100).toFixed(1)}%" title="${statusText[s] || s}: ${counts[s]}">${counts[s]}</div>`)
    .join("");

  const legend = statusOrder
    .filter((s) => counts[s])
    .map((s) => `<span class="legend-item"><span class="legend-dot" style="background: ${statusColors[s]}"></span>${statusText[s] || s} (${counts[s]})</span>`)
    .join("");

  $("#dashboardStatusChart").innerHTML = `
    <div class="status-bar-container">${segments || '<div style="width:100%;text-align:center;color:var(--muted);font-size:12px;">尚無委託單</div>'}</div>
    <div class="status-legend">${legend}</div>
  `;
}

function renderDashboardUtilization() {
  $("#dashboardUtilization").innerHTML = state.equipment
    .map((machine) => `
      <div class="chart-item">
        <div class="chart-label">
          <span>${escapeHtml(machine.name)} ${statusPill(machine.status)}</span>
          <span>${machine.utilization}%</span>
        </div>
        <div class="chart-track"><div class="chart-bar" style="width: ${machine.utilization}%"></div></div>
      </div>
    `)
    .join("");
}

function renderDashboardTimeline() {
  const items = state.audit.slice(0, 8);
  $("#dashboardTimeline").innerHTML = items.length
    ? items.map((entry) => `
        <div class="mini-timeline-item">
          <span>${auditMessage(entry)}</span>
          <span class="mini-time">${auditTime(entry)}</span>
        </div>
      `).join("")
    : '<div class="empty-state" style="min-height:60px;">尚無操作紀錄</div>';
}

function renderRequestTables() {
  const rows = state.requests
    .map((request) => `
      <tr>
        <td><strong>${escapeHtml(request.id)}</strong><br><span class="muted">${escapeHtml(request.department)}</span></td>
        <td>${escapeHtml(request.requester)}</td>
        <td>${request.samples.map((sample) => `${escapeHtml(sample.id)} (${sample.quantity})`).join("<br>")}</td>
        <td>${statusPill(request.status)}</td>
      </tr>
    `)
    .join("");

  $("#requestRows").innerHTML = rows;

  $("#recentRequestRows").innerHTML = state.requests
    .slice(0, 5)
    .map((request) => `
      <tr>
        <td><strong>${escapeHtml(request.id)}</strong></td>
        <td>${escapeHtml(request.labType)}<br><span class="muted">${escapeHtml(request.samples[0]?.material || "")}</span></td>
        <td>${statusPill(request.status)}</td>
        <td>${escapeHtml(request.dueDate)}</td>
      </tr>
    `)
    .join("");
}

function renderMachineSummary() {
  $("#machineSummary").innerHTML = state.equipment
    .map((machine) => `
      <article class="machine-card">
        <div class="stack-card-header">
          <h3>${escapeHtml(machine.name)}</h3>
          ${statusPill(machine.status)}
        </div>
        <p>${escapeHtml(machine.area)}｜${escapeHtml(machine.capability)}</p>
        <div class="machine-meta">
          <span class="muted">利用率 ${machine.utilization}%</span>
        </div>
      </article>
    `)
    .join("");
}

function renderApproval() {
  const pending = state.requests.filter((request) => request.status === "pending_approval");

  $("#approvalQueue").innerHTML = pending.length
    ? pending
        .map((request) => `
          <article class="stack-card">
            <div class="stack-card-header">
              <div>
                <h3>${escapeHtml(request.id)}｜${escapeHtml(request.labType)}</h3>
                <p>${escapeHtml(request.goal)}</p>
              </div>
              ${priorityPill(request.priority)}
            </div>
            <ul class="detail-list">
              <li><strong>申請人：</strong>${escapeHtml(request.requester)} / ${escapeHtml(request.department)}</li>
              <li><strong>樣品：</strong>${request.samples.map((sample) => `${escapeHtml(sample.id)} ${escapeHtml(sample.material)}`).join(", ")}</li>
              <li><strong>需求日期：</strong>${escapeHtml(request.dueDate)}</li>
            </ul>
            <div class="button-row">
              <button class="success-button" type="button" data-action="approve" data-request-id="${request.id}">✓ 核准</button>
              <button class="danger-button" type="button" data-action="reject" data-request-id="${request.id}">× 退回</button>
            </div>
          </article>
        `)
        .join("")
    : `<div class="empty-state">目前沒有待簽核委託單</div>`;

  $("#auditTrail").innerHTML = state.audit
    .slice(0, 10)
    .map((entry) => `
      <div class="timeline-item">
        <p><strong>${auditMessage(entry)}</strong></p>
        <span class="muted">${auditTime(entry)}</span>
      </div>
    `)
    .join("");
}

function renderReceiving() {
  const actionable = state.requests.filter((request) => ["approved", "received", "split"].includes(request.status));

  $("#receivingList").innerHTML = actionable.length
    ? actionable
        .map((request) => {
          const sampleInfo = request.samples
            .map((sample) => `${escapeHtml(sample.id)} ${escapeHtml(sample.material)} x${sample.quantity}｜${statusText[sample.status] || escapeHtml(sample.status)}`)
            .join("<br>");
          const wipInfo = request.wips.length
            ? request.wips.map((wip) => `${escapeHtml(wip.id)}｜${escapeHtml(wip.purpose)}｜${wip.quantity}`).join("<br>")
            : "尚未分貨";
          const receiveButton = request.status === "approved"
            ? `<button class="success-button" type="button" data-action="receive" data-request-id="${request.id}">✓ 收件</button>`
            : "";
          const splitButton = request.status === "received" && request.wips.length === 0
            ? `<button class="warning-button" type="button" data-action="split" data-request-id="${request.id}">分貨</button>`
            : "";

          return `
            <article class="stack-card">
              <div class="stack-card-header">
                <div>
                  <h3>${escapeHtml(request.id)}｜${escapeHtml(request.labType)}</h3>
                  <p>${escapeHtml(request.goal)}</p>
                </div>
                ${statusPill(request.status)}
              </div>
              <ul class="detail-list">
                <li><strong>樣品：</strong>${sampleInfo}</li>
                <li><strong>WIP：</strong>${wipInfo}</li>
              </ul>
              <div class="button-row">${receiveButton}${splitButton}</div>
            </article>
          `;
        })
        .join("")
    : `<div class="empty-state">尚無可收件或可分貨的委託單</div>`;
}

function renderDispatchOptions() {
  const requestSelect = $("#dispatchRequest");
  const selectedRequestId = requestSelect.value;
  const dispatchable = state.requests.filter((request) => ["received", "split"].includes(request.status));
  requestSelect.innerHTML = dispatchable.length
    ? dispatchable.map((request) => `<option value="${escapeHtml(request.id)}">${escapeHtml(request.id)}｜${escapeHtml(request.labType)}</option>`).join("")
    : `<option value="">沒有可派貨項目</option>`;

  if (selectedRequestId && dispatchable.some((request) => request.id === selectedRequestId)) {
    requestSelect.value = selectedRequestId;
  }

  const selectedRequest = requestById(requestSelect.value);
  const wipOptions = selectedRequest
    ? (selectedRequest.wips.length ? selectedRequest.wips : selectedRequest.samples).map((item) => `
        <option value="${escapeHtml(item.id)}">${escapeHtml(item.id)}｜${item.quantity || 1}</option>
      `)
    : [];
  $("#dispatchWip").innerHTML = wipOptions.join("") || `<option value="">請先收件</option>`;

  $("#dispatchEquipment").innerHTML = state.equipment
    .filter((machine) => !["maintenance", "alarm"].includes(machine.status))
    .map((machine) => `<option value="${escapeHtml(machine.id)}">${escapeHtml(machine.name)}｜${statusText[machine.status]}</option>`)
    .join("") || `<option value="">沒有可派貨機台</option>`;
  renderRecipeOptions();
}

function renderRecipeOptions() {
  const equipmentId = $("#dispatchEquipment").value;
  const recipes = state.recipes.filter((recipe) => recipe.equipmentId === equipmentId && recipe.active !== false);
  $("#dispatchRecipe").innerHTML = recipes.length
    ? recipes.map((recipe) => `<option value="${escapeHtml(recipe.id)}">${escapeHtml(recipe.name)} v${escapeHtml(recipe.version)}</option>`).join("")
    : `<option value="">此機台尚無 Recipe</option>`;
}

function renderJobs() {
  $("#jobBoard").innerHTML = state.jobs.length
    ? state.jobs
        .map((job) => {
          const request = requestById(job.requestId);
          const canLoad = job.status === "queued";
          const canUnload = ["loaded", "running"].includes(job.status);
          const history = (job.history || [])
            .map((item) => typeof item === "string" ? escapeHtml(item) : `${escapeHtml(item.occurredAt)} ${escapeHtml(item.note || item.action)}`)
            .join("<br>");
          return `
            <article class="job-card">
              <div class="job-card-header">
                <div>
                  <h3>${escapeHtml(job.id)}</h3>
                  <p>${escapeHtml(job.requestId)}｜${escapeHtml(request?.labType || "")}</p>
                </div>
                ${statusPill(job.status)}
              </div>
              <ul class="detail-list">
                <li><strong>WIP：</strong>${escapeHtml(job.wipId)}</li>
                <li><strong>機台：</strong>${escapeHtml(equipmentName(job.equipmentId))}</li>
                <li><strong>Recipe：</strong>${escapeHtml(recipeName(job.recipeId))}</li>
                <li><strong>備註：</strong>${escapeHtml(job.note)}</li>
                <li><strong>歷史：</strong>${history || "尚無紀錄"}</li>
              </ul>
              <div class="button-row">
                ${canLoad ? `<button class="primary-button" type="button" data-action="load" data-job-id="${job.id}">上貨</button>` : ""}
                ${canUnload ? `<button class="success-button" type="button" data-action="unload" data-job-id="${job.id}">下貨並回收數據</button>` : ""}
              </div>
            </article>
          `;
        })
        .join("")
    : `<div class="empty-state">尚未建立派貨任務</div>`;
}

function renderEquipment() {
  $("#equipmentList").innerHTML = state.equipment
    .map((machine) => `
      <article class="stack-card">
        <div class="stack-card-header">
          <div>
            <h3>${escapeHtml(machine.name)}</h3>
            <p>${escapeHtml(machine.area)}｜${escapeHtml(machine.capability)}</p>
          </div>
          ${statusPill(machine.status)}
        </div>
        <div class="button-row">
          <button class="ghost-button" type="button" data-action="machine-status" data-equipment-id="${escapeHtml(machine.id)}" data-status="idle">設為閒置</button>
          <button class="warning-button" type="button" data-action="machine-status" data-equipment-id="${escapeHtml(machine.id)}" data-status="maintenance">保養</button>
          <button class="danger-button" type="button" data-action="machine-status" data-equipment-id="${escapeHtml(machine.id)}" data-status="alarm">異常</button>
        </div>
      </article>
    `)
    .join("");

  $("#recipeEquipment").innerHTML = state.equipment
    .map((machine) => `<option value="${escapeHtml(machine.id)}">${escapeHtml(machine.name)}</option>`)
    .join("");

  $("#recipeRows").innerHTML = state.recipes
    .map((recipe) => {
      const isDeactivated = recipe.active === false;
      const deactivateBtn = (!isDeactivated && state.currentRole === "admin")
        ? `<button class="ghost-button compact-button" type="button" data-action="deactivate-recipe" data-recipe-id="${escapeHtml(recipe.id)}">停用</button>`
        : "";
      return `
      <tr class="${isDeactivated ? 'recipe-deactivated' : ''}">
        <td><strong>${escapeHtml(recipe.name)}</strong> ${isDeactivated ? '<span class="status-pill status-maintenance">已停用</span>' : ''}<br><span class="muted">${escapeHtml(recipe.id)}</span></td>
        <td>${escapeHtml(equipmentName(recipe.equipmentId))}</td>
        <td>${escapeHtml(recipe.version)}</td>
        <td>${escapeHtml(recipe.parameters)}<br>${deactivateBtn}</td>
      </tr>
      `;
    })
    .join("");
}

function renderReports() {
  // Result stat bar
  const closedResults = state.results.filter((r) => {
    const req = requestById(r.requestId);
    return req && req.status === "closed";
  }).length;
  $("#resultStatBar").innerHTML = state.results.length
    ? `<div class="result-stat-bar">
        <span>結果總數 <span class="stat-value">${state.results.length}</span></span>
        <span>已結案 <span class="stat-value">${closedResults}</span></span>
       </div>`
    : "";

  // Result cards — enhanced with metadata
  $("#resultList").innerHTML = state.results.length
    ? state.results
        .map((result) => {
          const request = requestById(result.requestId);
          const job = result.jobId ? jobById(result.jobId) : null;
          const closeButton = request && request.status !== "closed"
            ? `<button class="success-button" type="button" data-action="close-request" data-request-id="${request.id}">結案</button>`
            : "";
          return `
            <article class="stack-card">
              <div class="stack-card-header">
                <div>
                  <h3>${escapeHtml(result.id)}｜${escapeHtml(result.requestId)}</h3>
                  <p>${escapeHtml(result.summary)}</p>
                </div>
                ${request ? statusPill(request.status) : ""}
              </div>
              <ul class="detail-list">
                ${job ? `<li><strong>Job：</strong>${escapeHtml(job.id)}</li>` : ""}
                ${job ? `<li><strong>機台：</strong>${escapeHtml(equipmentName(job.equipmentId))}</li>` : ""}
                ${job ? `<li><strong>Recipe：</strong>${escapeHtml(recipeName(job.recipeId))}</li>` : ""}
                ${result.createdAt ? `<li><strong>完成時間：</strong>${escapeHtml(result.createdAt)}</li>` : ""}
                <li><strong>Raw data：</strong><span class="result-meta-code">${escapeHtml(result.rawData)}</span></li>
                <li><strong>Report：</strong><span class="result-meta-code">${escapeHtml(result.report)}</span></li>
              </ul>
              <div class="button-row">${closeButton}</div>
            </article>
          `;
        })
        .join("")
    : `<div class="empty-state">完成下貨後會自動產生結果資料</div>`;

  // Utilization chart
  $("#utilizationChart").innerHTML = state.equipment
    .map((machine) => `
      <div class="chart-item">
        <div class="chart-label">
          <span>${escapeHtml(machine.name)}</span>
          <span>${machine.utilization}%</span>
        </div>
        <div class="chart-track"><div class="chart-bar" style="width: ${machine.utilization}%"></div></div>
      </div>
    `)
    .join("");

  // Alarm summary bar
  const activeAlarms = state.alarms.filter((a) => a.status === "alarm").length;
  const closedAlarms = state.alarms.filter((a) => a.status === "closed").length;
  $("#alarmSummaryBar").innerHTML = state.alarms.length
    ? `<div class="alarm-summary">
        <span>活動中 <span class="summary-count">${activeAlarms}</span></span>
        <span>已處理 <span class="summary-count">${closedAlarms}</span></span>
        <span>合計 <span class="summary-count">${state.alarms.length}</span></span>
       </div>`
    : "";

  // Alarm cards — enhanced with severity and ack info
  $("#alarmList").innerHTML = state.alarms.length
    ? state.alarms
        .map((alarm) => {
          const severityTag = alarm.severity
            ? `<span class="severity-pill severity-${escapeHtml(alarm.severity)}">${escapeHtml(alarm.severity)}</span>`
            : "";
          const ackInfo = alarm.status === "closed" && alarm.acknowledgedBy
            ? `<li><strong>處理者：</strong>${escapeHtml(alarm.acknowledgedBy)}</li>
               <li><strong>處理時間：</strong>${escapeHtml(alarm.acknowledgedAt || "N/A")}</li>`
            : "";
          return `
            <article class="stack-card">
              <div class="stack-card-header">
                <div>
                  <h3>${escapeHtml(alarm.id)}｜${escapeHtml(equipmentName(alarm.equipmentId))} ${severityTag}</h3>
                  <p>${escapeHtml(alarm.message)}</p>
                </div>
                ${statusPill(alarm.status)}
              </div>
              <ul class="detail-list">
                ${ackInfo}
              </ul>
              <div class="button-row">
                ${alarm.status === "alarm" ? `<button class="success-button" type="button" data-action="ack-alarm" data-alarm-id="${escapeHtml(alarm.id)}">確認處理</button>` : ""}
              </div>
            </article>
          `;
        })
        .join("")
    : `<div class="empty-state">目前沒有異常告警</div>`;
}

function renderAll() {
  $("#roleBadge").textContent = roleText[state.currentRole];
  renderMetrics();
  renderDashboardStatusChart();
  renderDashboardUtilization();
  renderDashboardTimeline();
  renderRequestTables();
  renderMachineSummary();
  renderApproval();
  renderReceiving();
  renderDispatchOptions();
  renderJobs();
  renderEquipment();
  renderReports();
}

async function createRequest(form) {
  const payload = formToObject(form);
  if (await apiClient.action("/api/requests", {
    method: "POST",
    body: JSON.stringify(payload)
  })) return;

  const data = new FormData(form);
  const id = `REQ-2026-${String(state.requestSeq).padStart(3, "0")}`;
  state.requestSeq += 1;
  const request = {
    id,
    requester: data.get("requester").trim(),
    department: data.get("department").trim(),
    labType: data.get("labType"),
    priority: data.get("priority"),
    dueDate: data.get("dueDate"),
    goal: data.get("goal").trim(),
    status: "pending_approval",
    samples: [
      {
        id: data.get("sampleCode").trim(),
        material: data.get("material").trim(),
        quantity: Number(data.get("quantity")),
        status: "created"
      }
    ],
    wips: []
  };
  state.requests.unshift(request);
  addAudit(`${id} 由 ${request.requester} 建立並送出簽核`);
  showToast(`${id} 已送出簽核`);
  renderAll();
}

async function approveRequest(id) {
  if (await apiClient.action(`/api/requests/${encodeURIComponent(id)}/approve`, {
    method: "POST",
    body: JSON.stringify(actorPayload())
  })) return;

  const request = requestById(id);
  if (!request) return;
  request.status = "approved";
  addAudit(`${id} 已由主管核准`);
  showToast(`${id} 已核准，可進行收件`);
  renderAll();
}

async function rejectRequest(id) {
  if (await apiClient.action(`/api/requests/${encodeURIComponent(id)}/reject`, {
    method: "POST",
    body: JSON.stringify(actorPayload({ reason: "請補充樣品或實驗條件" }))
  })) return;

  const request = requestById(id);
  if (!request) return;
  request.status = "rejected";
  request.rejectReason = "請補充樣品或實驗條件";
  addAudit(`${id} 已退回申請人補件`);
  showToast(`${id} 已退回`);
  renderAll();
}

async function receiveRequest(id) {
  if (await apiClient.action(`/api/requests/${encodeURIComponent(id)}/receive`, {
    method: "POST",
    body: JSON.stringify(actorPayload())
  })) return;

  const request = requestById(id);
  if (!request) return;
  request.status = "received";
  request.receivedAt = new Date().toLocaleString("zh-TW", { hour12: false });
  request.samples.forEach((sample) => {
    sample.status = "received";
  });
  addAudit(`${id} 實驗室完成收件`);
  showToast(`${id} 已收件，可分貨或派貨`);
  renderAll();
}

async function splitRequest(id) {
  if (await apiClient.action(`/api/requests/${encodeURIComponent(id)}/split`, {
    method: "POST",
    body: JSON.stringify(actorPayload())
  })) return;

  const request = requestById(id);
  if (!request || request.wips.length) return;
  const source = request.samples[0];
  const total = Math.max(1, Number(source.quantity) || 1);
  const firstQty = total === 1 ? 1 : Math.floor(total / 2);
  const secondQty = total - firstQty;
  request.status = "split";
  source.status = "split";
  request.wips = [
    { id: `${source.id}-A`, source: source.id, quantity: firstQty, purpose: `${request.labType} primary`, status: "queued" }
  ];
  if (secondQty > 0) {
    request.wips.push({ id: `${source.id}-B`, source: source.id, quantity: secondQty, purpose: `${request.labType} backup`, status: "queued" });
  }
  addAudit(`${id} 已分貨為 ${request.wips.map((wip) => wip.id).join(", ")}`);
  showToast(`${id} 已建立 WIP`);
  renderAll();
}

async function createDispatchJob(form) {
  const payload = actorPayload({
    ...formToObject(form),
    operator: roleText[state.currentRole]
  });
  if (await apiClient.action("/api/dispatch-jobs", {
    method: "POST",
    body: JSON.stringify(payload)
  })) return;

  const data = new FormData(form);
  const requestId = data.get("requestId");
  const equipmentId = data.get("equipmentId");
  const recipeId = data.get("recipeId");
  if (!requestId || !equipmentId || !recipeId) {
    showToast("請先選擇可派貨的委託單、機台與 Recipe");
    return;
  }

  const id = `JOB-2026-${String(state.jobSeq).padStart(3, "0")}`;
  state.jobSeq += 1;
  const job = {
    id,
    requestId,
    wipId: data.get("wipId"),
    equipmentId,
    recipeId,
    operator: roleText[state.currentRole],
    status: "queued",
    note: data.get("note").trim(),
    history: [{ action: "dispatch", actor: roleText[state.currentRole], occurredAt: new Date().toLocaleString("zh-TW", { hour12: false }), note: "派貨" }]
  };
  state.jobs.unshift(job);

  const request = requestById(requestId);
  if (request) {
    request.status = "in_progress";
    [...request.wips, ...request.samples].forEach((item) => {
      if (item.id === job.wipId) item.status = "queued";
    });
  }

  addAudit(`${requestId} 建立派貨任務 ${id}，目標機台 ${equipmentName(equipmentId)}`);
  showToast(`${id} 已建立`);
  renderAll();
}

async function loadJob(id) {
  if (await apiClient.action(`/api/dispatch-jobs/${encodeURIComponent(id)}/load`, {
    method: "POST",
    body: JSON.stringify(actorPayload())
  })) return;

  const job = jobById(id);
  if (!job) return;
  job.status = "running";
  job.history.push({ action: "load", actor: roleText[state.currentRole], occurredAt: new Date().toLocaleString("zh-TW", { hour12: false }), note: "上貨" });
  const machine = state.equipment.find((item) => item.id === job.equipmentId);
  if (machine) {
    machine.status = "busy";
    machine.utilization = Math.min(96, machine.utilization + 8);
  }
  const request = requestById(job.requestId);
  request && [...request.wips, ...request.samples].forEach((item) => {
    if (item.id === job.wipId) item.status = "loaded";
  });
  addAudit(`${job.id} 已上貨並開始實驗`);
  showToast(`${job.id} 已上貨`);
  renderAll();
}

async function unloadJob(id) {
  if (await apiClient.action(`/api/dispatch-jobs/${encodeURIComponent(id)}/unload`, {
    method: "POST",
    body: JSON.stringify(actorPayload())
  })) return;

  const job = jobById(id);
  if (!job) return;
  job.status = "completed";
  job.history.push({ action: "unload", actor: roleText[state.currentRole], occurredAt: new Date().toLocaleString("zh-TW", { hour12: false }), note: "下貨與數據回收" });

  const machine = state.equipment.find((item) => item.id === job.equipmentId);
  if (machine) {
    machine.status = "idle";
    machine.utilization = Math.min(99, machine.utilization + 5);
  }

  const request = requestById(job.requestId);
  if (request) {
    request.status = "closed";
    request.closedAt = new Date().toLocaleString("zh-TW", { hour12: false });
    [...request.wips, ...request.samples].forEach((item) => {
      if (item.id === job.wipId) item.status = "processed";
    });
  }

  const resultId = `RST-${job.id.replace("JOB-", "")}`;
  if (!state.results.some((result) => result.id === resultId)) {
    state.results.unshift({
      id: resultId,
      requestId: job.requestId,
      jobId: job.id,
      summary: `${equipmentName(job.equipmentId)} 已依 ${recipeName(job.recipeId)} 完成實驗，系統自動回收 raw data 並自動結案。`,
      rawData: `s3://lims-demo/raw/${job.id}.csv`,
      report: `s3://lims-demo/report/${job.requestId}.pdf`,
      createdAt: new Date().toLocaleString("zh-TW", { hour12: false })
    });
  }

  addAudit(`${job.id} 完成下貨，實驗數據已回收並自動結案`);
  showToast(`${job.id} 已完成，資料已回收並自動結案`);
  renderAll();
}

async function changeMachineStatus(id, status) {
  if (await apiClient.action(`/api/equipment/${encodeURIComponent(id)}/status`, {
    method: "POST",
    body: JSON.stringify(actorPayload({ status }))
  })) return;

  const machine = state.equipment.find((item) => item.id === id);
  if (!machine) return;
  machine.status = status;
  if (status === "alarm") {
    const alarmId = `ALM-${String(state.alarmSeq).padStart(3, "0")}`;
    state.alarmSeq += 1;
    state.alarms.unshift({
      id: alarmId,
      equipmentId: id,
      severity: "Medium",
      message: `${machine.name} 狀態異常，請確認機台訊號與保養紀錄。`,
      status: "alarm"
    });
  }
  addAudit(`${machine.name} 狀態更新為 ${statusText[status]}`);
  showToast(`${machine.name} 已更新`);
  renderAll();
}

async function createRecipe(form) {
  const payload = actorPayload(formToObject(form));
  if (await apiClient.action("/api/recipes", {
    method: "POST",
    body: JSON.stringify(payload)
  })) return;

  const data = new FormData(form);
  const id = `RCP-${String(state.recipeSeq).padStart(3, "0")}`;
  state.recipeSeq += 1;
  state.recipes.unshift({
    id,
    equipmentId: data.get("equipmentId"),
    name: data.get("name").trim(),
    version: data.get("version").trim(),
    parameters: data.get("parameters").trim()
  });
  addAudit(`${id} Recipe 已建立`);
  showToast(`${id} 已新增`);
  renderAll();
}

async function closeRequest(id) {
  if (await apiClient.action(`/api/requests/${encodeURIComponent(id)}/close`, {
    method: "POST",
    body: JSON.stringify(actorPayload())
  })) return;

  const request = requestById(id);
  if (!request) return;
  request.status = "closed";
  request.closedAt = new Date().toLocaleString("zh-TW", { hour12: false });
  addAudit(`${id} 已結案`);
  showToast(`${id} 已結案`);
  renderAll();
}

async function acknowledgeAlarm(id) {
  if (await apiClient.action(`/api/alarms/${encodeURIComponent(id)}/ack`, {
    method: "POST",
    body: JSON.stringify(actorPayload())
  })) return;

  const alarm = state.alarms.find((item) => item.id === id);
  if (!alarm) return;
  alarm.status = "closed";
  alarm.acknowledgedAt = new Date().toLocaleString("zh-TW", { hour12: false });
  alarm.acknowledgedBy = roleText[state.currentRole];
  const machine = state.equipment.find((item) => item.id === alarm.equipmentId);
  if (machine && machine.status === "alarm") {
    machine.status = "maintenance";
  }
  addAudit(`${id} 已確認處理`);
  showToast(`${id} 已確認`);
  renderAll();
}

async function simulateAlarm() {
  if (await apiClient.action("/api/alarms/simulate", {
    method: "POST",
    body: JSON.stringify(actorPayload())
  })) return;

  const machine = state.equipment.find((item) => item.status !== "alarm") || state.equipment[0];
  changeMachineStatus(machine.id, "alarm");
}

async function boot() {
  if (!apiClient.available) {
    renderAll();
    return;
  }

  if (!authState.token) {
    showLogin();
    return;
  }

  try {
    const profile = await apiClient.request("/api/auth/me");
    setSession(authState.token, profile.user);
    await loadState();
  } catch (error) {
    clearSession();
    console.warn(error);
    showLogin();
  }
}

document.addEventListener("click", (event) => {
  const navButton = event.target.closest("[data-section]");
  if (navButton) {
    switchSection(navButton.dataset.section);
    return;
  }

  const jumpButton = event.target.closest("[data-section-jump]");
  if (jumpButton) {
    switchSection(jumpButton.dataset.sectionJump);
    return;
  }

  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;

  const { action, requestId, jobId, equipmentId, status, alarmId, recipeId } = actionButton.dataset;
  if (action === "approve") approveRequest(requestId);
  if (action === "reject") rejectRequest(requestId);
  if (action === "receive") receiveRequest(requestId);
  if (action === "split") splitRequest(requestId);
  if (action === "load") loadJob(jobId);
  if (action === "unload") unloadJob(jobId);
  if (action === "machine-status") changeMachineStatus(equipmentId, status);
  if (action === "close-request") closeRequest(requestId);
  if (action === "ack-alarm") acknowledgeAlarm(alarmId);
  if (action === "deactivate-recipe") deactivateRecipe(recipeId);
});

$("#requestForm").addEventListener("submit", (event) => {
  event.preventDefault();
  createRequest(event.currentTarget);
});

$("#loginForm").addEventListener("submit", (event) => {
  event.preventDefault();
  login(event.currentTarget).catch((error) => {
    console.error(error);
    showToast(error.message || "登入失敗");
  });
});

$("#logoutButton").addEventListener("click", logout);

$("#dispatchForm").addEventListener("submit", (event) => {
  event.preventDefault();
  createDispatchJob(event.currentTarget);
});

$("#recipeForm").addEventListener("submit", (event) => {
  event.preventDefault();
  createRecipe(event.currentTarget);
});

async function deactivateRecipe(id) {
  if (await apiClient.action(`/api/recipes/${encodeURIComponent(id)}/deactivate`, {
    method: "POST",
    body: JSON.stringify(actorPayload())
  })) return;

  const recipe = state.recipes.find((r) => r.id === id);
  if (!recipe) return;
  recipe.active = false;
  addAudit(`${id} 已停用`);
  showToast(`${id} 已停用`);
  renderAll();
}

$("#dispatchRequest").addEventListener("change", renderDispatchOptions);
$("#dispatchEquipment").addEventListener("change", renderRecipeOptions);
$("#roleSelect").addEventListener("change", (event) => {
  state.currentRole = event.target.value;
  showToast(`角色已切換為 ${roleText[state.currentRole]}`);
  renderAll();
});
$("#createAlarmButton").addEventListener("click", simulateAlarm);

boot();

if (typeof module !== "undefined") {
  module.exports = { escapeHtml, statusPill, priorityPill, auditMessage, auditTime, equipmentName, recipeName, state, statusText };
}

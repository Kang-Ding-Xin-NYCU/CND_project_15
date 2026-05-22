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
  dispatched: "已派貨",
  loaded: "已上貨",
  running: "執行中",
  failed: "失敗",
  idle: "閒置",
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
  users: [
    { id: "USR-001", username: "fab", name: "Ivy Chen", role: "fab", department: "Fab 12 R&D", site: "Fab 12" },
    { id: "USR-002", username: "supervisor", name: "Sam Wang", role: "supervisor", department: "Central Lab", site: "Fab 12" },
    { id: "USR-003", username: "operator", name: "Lab Operator", role: "operator", department: "Central Lab", site: "Fab 12" },
    { id: "USR-004", username: "admin", name: "System Admin", role: "admin", department: "IT", site: "Global" }
  ],
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
    { id: "EQ-SEM-01", type: "SEM", name: "SEM-01", area: "Lab A", capability: "高解析影像", status: "idle", utilization: 0 },
    { id: "EQ-XRD-01", type: "XRD", name: "XRD-01", area: "Lab B", capability: "薄膜晶體分析", status: "idle", utilization: 0 },
    { id: "EQ-FTIR-01", type: "FTIR", name: "FTIR-01", area: "Lab C", capability: "材料光譜", status: "running", utilization: 100 },
    { id: "EQ-PROBE-01", type: "PROBE", name: "Probe-01", area: "Lab D", capability: "電性測試", status: "alarm", utilization: 0 }
  ],
  recipes: [
    { id: "RCP-001", equipmentId: "EQ-SEM-01", equipmentType: "SEM", name: "Defect Review Standard", version: "1.2.0", parameters: "voltage=3kV; dwell=30ms" },
    { id: "RCP-002", equipmentId: "EQ-XRD-01", equipmentType: "XRD", name: "Thin Film Stress Scan", version: "2.1.0", parameters: "angle=20-80; step=0.02" },
    { id: "RCP-003", equipmentId: "EQ-FTIR-01", equipmentType: "FTIR", name: "Contamination Quick Scan", version: "1.4.3", parameters: "range=400-4000; resolution=4" }
  ],
  jobs: [
    {
      id: "JOB-2026-001",
      requestId: "REQ-2026-003",
      wipId: "WIP-003-A",
      equipmentId: "EQ-FTIR-01",
      recipeId: "RCP-003",
      operator: "Lab Operator",
      status: "running",
      note: "緊急件，優先處理。",
      history: ["2026-05-02 18:20 派貨", "2026-05-02 18:32 上貨"]
    }
  ],
  results: [],
  alarms: [
    { id: "ALM-001", equipmentId: "EQ-PROBE-01", severity: "High", message: "Probe card contact resistance over threshold", status: "alarm" }
  ],
  audit: [
    "REQ-2026-003 已派貨到 FTIR-01",
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
  users: "使用者管理",
  account: "帳號設定",
  reports: "結果與統計"
};

const sectionRoles = {
  dashboard: ["fab", "supervisor", "operator", "admin"],
  requests: ["fab", "admin"],
  approval: ["supervisor", "admin"],
  lab: ["operator", "admin"],
  equipment: ["operator", "supervisor", "admin"],
  users: ["admin"],
  account: ["fab", "supervisor", "operator", "admin"],
  reports: ["fab", "supervisor", "operator", "admin"]
};

const RESULTS_PER_PAGE = 5;

const uiState = {
  splitRows: [{ quantity: 1, purpose: "" }],
  splitRequestId: "",
  equipmentTypeRows: [],
  machineEventEquipmentId: "",
  machineEventType: "completed",
  resultsPage: 1
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

function roleAllows(allowedRoles, role = state.currentRole) {
  return role === "admin" || allowedRoles.includes(role);
}

function sectionAllowed(sectionId) {
  return roleAllows(sectionRoles[sectionId] || []);
}

function currentActorName() {
  return authState.user?.name || roleText[state.currentRole] || "Demo User";
}

function setHidden(element, hidden) {
  if (!element) return;
  if (hidden) {
    element.classList.add("is-hidden");
  } else {
    element.classList.remove("is-hidden");
  }
}

function dispatchableItemsForRequest(request) {
  if (!request) return [];
  const items = request.wips?.length ? request.wips : request.samples || [];
  return items.filter((item) => item.status === "queued");
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

function machineType(machine) {
  if (!machine) return "";
  if (machine.type) return String(machine.type);
  const parts = String(machine.id || "").split("-");
  if (parts.length >= 3 && parts[0] === "EQ") return parts[1];
  return String(machine.name || machine.id || "UNKNOWN").split("-")[0];
}

function equipmentTypeSummary() {
  const groups = new Map();
  (state.equipment || []).forEach((machine) => {
    const type = machineType(machine);
    if (!groups.has(type)) {
      groups.set(type, {
        type,
        count: 0,
        running: 0,
        area: machine.area || "",
        capability: machine.capability || ""
      });
    }
    const row = groups.get(type);
    row.count += 1;
    if (machine.status === "running") row.running += 1;
  });
  return Array.from(groups.values()).map((row) => ({
    ...row,
    utilization: row.count ? Math.round((row.running / row.count) * 100) : 0
  }));
}

function refreshLocalEquipmentUtilization() {
  const summary = equipmentTypeSummary();
  (state.equipment || []).forEach((machine) => {
    const row = summary.find((item) => item.type === machineType(machine));
    machine.utilization = row?.utilization || 0;
  });
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
    actor: currentActorName(),
    role: state.currentRole,
    ...extra
  };
}

function syncState(nextState) {
  const currentRole = authState.user?.role || state.currentRole;
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

  async action(path, options = {}, settings = {}) {
    if (!this.available) return false;

    try {
      const payload = await this.request(path, options);
      if (payload.state) syncState(payload.state);
      if (payload.message) showToast(payload.message);
      return true;
    } catch (error) {
      if (error.status) {
        if ((settings.fallbackOnStatuses || []).includes(error.status)) {
          return false;
        }
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
  $("#roleSelect").disabled = true;
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
  if (!sectionAllowed(sectionId)) {
    const fallback = Object.keys(sectionRoles).find((item) => sectionAllowed(item)) || "dashboard";
    sectionId = fallback;
  }
  $$(".nav-item").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.section === sectionId);
  });
  $$(".view").forEach((view) => {
    view.classList.toggle("is-active", view.id === sectionId);
  });
  $("#pageTitle").textContent = pageTitles[sectionId] || "Cloud LIMS";
}

function applyRoleVisibility() {
  const allowedSections = Object.keys(sectionRoles).filter((sectionId) => sectionAllowed(sectionId));
  const activeView = $(".view.is-active");
  if (activeView && !sectionAllowed(activeView.id)) {
    switchSection(allowedSections[0] || "dashboard");
  }

  $$(".nav-item").forEach((button) => {
    setHidden(button, !sectionAllowed(button.dataset.section));
  });

  $$("[data-role-visible]").forEach((element) => {
    const allowed = (element.dataset.roleVisible || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    setHidden(element, allowed.length > 0 && !roleAllows(allowed));
  });
}

function renderMetrics() {
  const requests = state.requests || [];
  const jobs = state.jobs || [];
  const alarms = state.alarms || [];
  const counts = {
    pending: requests.filter((item) => item.status === "pending_approval").length,
    receiving: requests.filter((item) => item.status === "approved").length,
    running: jobs.filter((job) => ["queued", "loaded", "running"].includes(job.status)).length,
    alarms: alarms.filter((alarm) => alarm.status === "alarm").length
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
  const requests = state.requests || [];
  const statusOrder = ["pending_approval", "approved", "received", "split", "in_progress", "completed", "closed", "rejected"];
  const statusColors = {
    pending_approval: "var(--amber)", approved: "var(--green)", received: "#38a169",
    split: "var(--violet)", in_progress: "var(--blue)", completed: "var(--teal)",
    closed: "var(--teal)", rejected: "var(--red)"
  };

  const counts = {};
  requests.forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1; });
  const total = requests.length || 1;

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
  const summaries = equipmentTypeSummary();
  $("#dashboardUtilization").innerHTML = summaries.length
    ? summaries
        .map((row) => {
          const cleanUtil = Math.max(0, Math.min(100, Math.round(Number(row.utilization) || 0)));
          return `
          <div class="chart-item">
            <div class="chart-label">
              <span>${escapeHtml(row.type)}｜運作中 ${row.running}/${row.count}</span>
              <span>${cleanUtil}%</span>
            </div>
            <div class="chart-track"><div class="chart-bar" style="width: ${cleanUtil}%"></div></div>
          </div>
        `})
        .join("")
    : '<div class="empty-state">尚無機台資料</div>';
}

function renderDashboardTimeline() {
  const audit = state.audit || [];
  const items = audit.slice(0, 8);
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
  const requests = state.requests || [];
  const rows = requests.length
    ? requests
        .map((request) => `
          <tr>
            <td><strong>${escapeHtml(request.id)}</strong><br><span class="muted">${escapeHtml(request.department)}</span></td>
            <td>${escapeHtml(request.requester)}</td>
            <td>${request.samples.map((sample) => `${escapeHtml(sample.id)} (${sample.quantity})`).join("<br>")}</td>
            <td>${statusPill(request.status)}</td>
          </tr>
        `)
        .join("")
    : '<tr><td colspan="4" class="empty-state">尚無委託單資料</td></tr>';

  $("#requestRows").innerHTML = rows;

  $("#recentRequestRows").innerHTML = requests.length
    ? requests
        .slice(0, 5)
        .map((request) => `
          <tr>
            <td><strong>${escapeHtml(request.id)}</strong></td>
            <td>${escapeHtml(request.labType)}<br><span class="muted">${escapeHtml(request.samples[0]?.material || "")}</span></td>
            <td>${statusPill(request.status)}</td>
            <td>${escapeHtml(request.dueDate)}</td>
          </tr>
        `)
        .join("")
    : '<tr><td colspan="4" class="empty-state">尚無委託單資料</td></tr>';
}

function renderMachineSummary() {
  const summaries = equipmentTypeSummary();
  $("#machineSummary").innerHTML = summaries.length
    ? summaries
        .map((machine) => `
          <article class="machine-card">
            <div class="stack-card-header">
              <h3>${escapeHtml(machine.type)}</h3>
              <span class="status-pill status-running">${machine.running}/${machine.count}</span>
            </div>
            <p>${escapeHtml(machine.area)}｜${escapeHtml(machine.capability)}</p>
            <div class="machine-meta">
              <span class="muted">利用率 ${machine.utilization}%</span>
            </div>
          </article>
        `)
        .join("")
    : '<div class="empty-state">尚無機台資料</div>';
}

function renderApproval() {
  const requests = state.requests || [];
  const audit = state.audit || [];
  const pending = requests.filter((request) => request.status === "pending_approval");
  const canApprove = roleAllows(["supervisor"]);

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
            ${canApprove ? `<div class="button-row">
              <button class="success-button" type="button" data-action="approve" data-request-id="${escapeHtml(request.id)}">✓ 核准</button>
              <button class="danger-button" type="button" data-action="reject" data-request-id="${escapeHtml(request.id)}">× 退回</button>
            </div>` : ""}
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
  const requests = state.requests || [];
  const actionable = requests.filter((request) => ["approved", "received", "split"].includes(request.status));
  const canOperate = roleAllows(["operator"]);

  $("#receivingList").innerHTML = actionable.length
    ? actionable
        .map((request) => {
          const sampleInfo = request.samples
            .map((sample) => `${escapeHtml(sample.id)} ${escapeHtml(sample.material)} x${sample.quantity}｜${statusText[sample.status] || escapeHtml(sample.status)}`)
            .join("<br>");
          const wipInfo = request.wips.length
            ? request.wips.map((wip) => `${escapeHtml(wip.id)}｜${escapeHtml(wip.purpose)}｜${wip.quantity}｜${statusText[wip.status] || escapeHtml(wip.status)}`).join("<br>")
            : "尚未分貨";
          const receiveButton = canOperate && request.status === "approved"
            ? `<button class="success-button" type="button" data-action="receive" data-request-id="${escapeHtml(request.id)}">✓ 收件</button>`
            : "";
          const splitButton = canOperate && request.status === "received" && request.wips.length === 0
            ? `<button class="warning-button" type="button" data-action="select-split" data-request-id="${escapeHtml(request.id)}">分貨</button>`
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

function normalizeSplitRows(request, rows) {
  const source = request?.samples?.[0];
  if (!request || !source) {
    throw new Error("找不到可分貨的樣品");
  }
  if (!rows.length) {
    throw new Error("至少需要 1 筆 WIP");
  }
  if (rows.length > 26) {
    throw new Error("最多只能分成 26 筆 WIP");
  }

  const sampleQuantity = Number(source.quantity) || 0;
  const wips = rows.map((row, index) => {
    const quantity = Number(row.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error(`第 ${index + 1} 筆 WIP 數量需為正整數`);
    }
    return {
      quantity,
      purpose: String(row.purpose || `${request.labType} split`).trim() || `${request.labType} split`
    };
  });
  const totalQuantity = wips.reduce((total, row) => total + row.quantity, 0);
  if (totalQuantity > sampleQuantity) {
    throw new Error(`WIP 總量 ${totalQuantity} 不可超過樣品數量 ${sampleQuantity}`);
  }
  return { source, sampleQuantity, totalQuantity, wips };
}

function readSplitRows() {
  return $$("#splitRows .split-row").map((row) => ({
    quantity: row.querySelector('[name="quantity"]').value,
    purpose: row.querySelector('[name="purpose"]').value
  }));
}

function renderSplitForm() {
  const requests = state.requests || [];
  const candidates = requests.filter((request) => request.status === "received" && !request.wips?.length);
  const requestSelect = $("#splitRequest");
  const selectedId = uiState.splitRequestId || requestSelect.value;

  requestSelect.innerHTML = candidates.length
    ? candidates.map((request) => `<option value="${escapeHtml(request.id)}">${escapeHtml(request.id)}｜${escapeHtml(request.labType)}</option>`).join("")
    : `<option value="">沒有可分貨委託單</option>`;

  const selectedRequest = candidates.find((request) => request.id === selectedId) || candidates[0];
  uiState.splitRequestId = selectedRequest?.id || "";
  if (selectedRequest) {
    requestSelect.value = selectedRequest.id;
  }

  const source = selectedRequest?.samples?.[0];
  const disabled = !selectedRequest || !source;
  requestSelect.disabled = disabled;
  $("#addSplitRowButton").disabled = disabled;
  const submitButton = $("#manualSplitForm").querySelector?.('button[type="submit"]');
  if (submitButton) submitButton.disabled = disabled;

  if (disabled) {
    $("#splitSummary").textContent = "";
    $("#splitRows").innerHTML = `<div class="empty-state compact-empty">目前沒有 received 且尚未分貨的委託單</div>`;
    return;
  }

  if (!uiState.splitRows.length) {
    uiState.splitRows = [{ quantity: source?.quantity || 1, purpose: `${selectedRequest.labType} split` }];
  }

  $("#splitRows").innerHTML = uiState.splitRows
    .map((row, index) => `
      <div class="split-row" data-split-index="${index}">
        <label>
          數量
          <input name="quantity" type="number" min="1" step="1" value="${escapeHtml(String(row.quantity || 1))}" required>
        </label>
        <label>
          用途
          <input name="purpose" type="text" value="${escapeHtml(row.purpose || `${selectedRequest.labType} split`)}" required>
        </label>
        <button class="ghost-button compact-button" type="button" data-action="remove-split-row" data-split-index="${index}">移除</button>
      </div>
    `)
    .join("");
  updateSplitSummary(source, selectedRequest);
}

function updateSplitSummary(source, selectedRequest) {
  if (!source || !selectedRequest) return;
  const total = readSplitRows().reduce((sum, row) => sum + (Number(row.quantity) || 0), 0);
  const matches = total === Number(source.quantity);
  $("#splitSummary").textContent =
    `${source.id}｜${source.material}｜樣品數量 ${source.quantity}｜已配置 ${total}` +
    (matches ? "（✓ 可建立）" : "（總量需等於樣品數量才可建立）");
  $("#splitSummary").classList.toggle("split-summary-error", !matches);
  const submitButton = $("#manualSplitForm").querySelector?.('button[type="submit"]');
  if (submitButton) submitButton.disabled = !matches;
}

function renderDispatchOptions() {
  const requests = state.requests || [];
  const equipment = state.equipment || [];
  const requestSelect = $("#dispatchRequest");
  const selectedRequestId = requestSelect.value;
  const dispatchable = requests.filter((request) => ["received", "split"].includes(request.status) && dispatchableItemsForRequest(request).length);
  requestSelect.innerHTML = dispatchable.length
    ? dispatchable.map((request) => `<option value="${escapeHtml(request.id)}">${escapeHtml(request.id)}｜${escapeHtml(request.labType)}</option>`).join("")
    : `<option value="">沒有可派貨項目</option>`;

  if (selectedRequestId && dispatchable.some((request) => request.id === selectedRequestId)) {
    requestSelect.value = selectedRequestId;
  }

  const selectedRequest = requestById(requestSelect.value);
  const wipOptions = selectedRequest
    ? dispatchableItemsForRequest(selectedRequest).map((item) => `
        <option value="${escapeHtml(item.id)}">${escapeHtml(item.id)}｜${item.quantity || 1}｜${statusText[item.status] || item.status}</option>
      `)
    : [];
  $("#dispatchWip").innerHTML = wipOptions.join("") || `<option value="">請先收件</option>`;

  $("#dispatchEquipment").innerHTML = equipment
    .filter((machine) => machine.status === "idle")
    .map((machine) => `<option value="${escapeHtml(machine.id)}">${escapeHtml(machine.name)}｜${statusText[machine.status]}</option>`)
    .join("") || `<option value="">沒有可派貨機台</option>`;
  renderRecipeOptions();
}

function renderRecipeOptions() {
  const equipmentId = $("#dispatchEquipment").value;
  const machine = (state.equipment || []).find((item) => item.id === equipmentId);
  const selectedType = machineType(machine);
  const recipes = state.recipes.filter((recipe) => (
    recipe.active !== false
    && (recipe.equipmentId === equipmentId || recipe.equipmentType === selectedType)
  ));
  $("#dispatchRecipe").innerHTML = recipes.length
    ? recipes.map((recipe) => `<option value="${escapeHtml(recipe.id)}">${escapeHtml(recipe.name)} v${escapeHtml(recipe.version)}</option>`).join("")
    : `<option value="">此機台尚無 Recipe</option>`;
}

function renderJobs() {
  const jobs = state.jobs || [];
  $("#jobBoard").innerHTML = jobs.length
    ? jobs
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
                ${canLoad ? `<button class="primary-button" type="button" data-action="load" data-job-id="${escapeHtml(job.id)}">上貨</button>` : ""}
                ${canUnload ? `<button class="success-button" type="button" data-action="unload" data-job-id="${escapeHtml(job.id)}">下貨並回收數據</button>` : ""}
              </div>
            </article>
          `;
        })
        .join("")
    : `<div class="empty-state">尚未建立派貨任務</div>`;
}

function readEquipmentTypeRows() {
  return $$("#equipmentTypeRows .split-row").map((row) => ({
    type: row.querySelector('[name="type"]')?.value.trim().toUpperCase() || "",
    count: Number(row.querySelector('[name="count"]')?.value || 0),
    area: row.querySelector('[name="area"]')?.value.trim() || "",
    capability: row.querySelector('[name="capability"]')?.value.trim() || ""
  }));
}

function renderEquipmentTypeForm() {
  const rows = uiState.equipmentTypeRows.length ? uiState.equipmentTypeRows : equipmentTypeSummary();
  $("#equipmentTypeRows").innerHTML = rows.length
    ? rows.map((row, index) => `
      <div class="split-row" data-equipment-type-index="${index}">
        <label>
          種類
          <input name="type" type="text" value="${escapeHtml(row.type)}" required>
        </label>
        <label>
          台數
          <input name="count" type="number" min="1" max="50" value="${escapeHtml(String(row.count || 1))}" required>
        </label>
        <label>
          區域
          <input name="area" type="text" value="${escapeHtml(row.area || "")}">
        </label>
        <label>
          能力
          <input name="capability" type="text" value="${escapeHtml(row.capability || row.type || "")}">
        </label>
        <button class="ghost-button compact-button" type="button" data-action="remove-equipment-type-row" data-equipment-type-index="${index}">移除</button>
      </div>
    `).join("")
    : `<div class="empty-state compact-empty">尚無機台種類</div>`;
}

function renderEquipment() {
  const equipment = state.equipment || [];
  const recipes = state.recipes || [];
  const canOperate = roleAllows(["operator"]);
  renderEquipmentTypeForm();
  $("#equipmentList").innerHTML = equipment.length
    ? equipment
        .map((machine) => `
          <article class="stack-card">
            <div class="stack-card-header">
              <div>
                <h3>${escapeHtml(machine.name)}</h3>
                <p>${escapeHtml(machine.area)}｜${escapeHtml(machine.capability)}</p>
              </div>
              ${statusPill(machine.status)}
            </div>
            ${canOperate ? `<div class="button-row">
              ${["alarm", "maintenance"].includes(machine.status) ? `<button class="ghost-button" type="button" data-action="machine-status" data-equipment-id="${escapeHtml(machine.id)}" data-status="idle">設為閒置</button>` : ""}
              <button class="warning-button" type="button" data-action="machine-status" data-equipment-id="${escapeHtml(machine.id)}" data-status="maintenance">保養</button>
              <button class="danger-button" type="button" data-action="machine-status" data-equipment-id="${escapeHtml(machine.id)}" data-status="alarm">異常</button>
            </div>` : ""}
          </article>
        `)
        .join("")
    : '<div class="empty-state">尚無機台資料</div>';

  $("#recipeEquipment").innerHTML = equipment
    .map((machine) => `<option value="${escapeHtml(machine.id)}">${escapeHtml(machine.name)}</option>`)
    .join("");

  $("#recipeRows").innerHTML = recipes
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

function renderMachineEventOptions() {
  const equipment = state.equipment || [];
  const jobs = state.jobs || [];
  const equipmentSelect = $("#machineEventEquipment");
  const typeSelect = $("#machineEventType");
  const jobSelect = $("#machineEventJob");

  const selectedEquipmentId = uiState.machineEventEquipmentId || equipmentSelect.value;
  equipmentSelect.innerHTML = equipment.length
    ? equipment.map((machine) => `<option value="${escapeHtml(machine.id)}">${escapeHtml(machine.name)}｜${statusText[machine.status] || machine.status}</option>`).join("")
    : `<option value="">沒有機台資料</option>`;
  const selectedMachine = equipment.find((machine) => machine.id === selectedEquipmentId) || equipment[0];
  uiState.machineEventEquipmentId = selectedMachine?.id || "";
  if (selectedMachine) equipmentSelect.value = selectedMachine.id;

  const eventType = uiState.machineEventType || typeSelect.value || "completed";
  typeSelect.value = eventType;

  const selectableJobs = jobs.filter((job) => (
    job.equipmentId === equipmentSelect.value
    && (eventType === "measurement" || ["running", "loaded"].includes(job.status))
  ));
  jobSelect.innerHTML = eventType === "alarm"
    ? `<option value="">不需 Job</option>`
    : (selectableJobs.length
        ? selectableJobs.map((job) => `<option value="${escapeHtml(job.id)}">${escapeHtml(job.id)}｜${statusText[job.status] || job.status}</option>`).join("")
        : `<option value="">沒有可用 Job</option>`);
  jobSelect.disabled = eventType === "alarm";
}

function roleOptions(selectedRole) {
  return Object.entries(roleText)
    .map(([value, label]) => `
      <option value="${escapeHtml(value)}" ${value === selectedRole ? "selected" : ""}>${escapeHtml(label)}</option>
    `)
    .join("");
}

function renderUsers() {
  const users = state.users || [];
  const canManage = state.currentRole === "admin";
  $("#userRows").innerHTML = users.length
    ? users
        .map((user) => `
          <tr>
            <td><strong>${escapeHtml(user.name)}</strong><br><span class="muted">${escapeHtml(user.username)}｜${escapeHtml(user.id)}</span></td>
            <td>${escapeHtml(user.department || "")}<br><span class="muted">${escapeHtml(user.site || "")}</span></td>
            <td><span class="role-badge">${escapeHtml(roleText[user.role] || user.role)}</span></td>
            <td>
              <div class="button-row">
                <select data-user-role-select data-user-id="${escapeHtml(user.id)}" ${canManage ? "" : "disabled"}>
                  ${roleOptions(user.role)}
                </select>
                <button class="primary-button compact-button" type="button" data-action="update-user-role" data-user-id="${escapeHtml(user.id)}" ${canManage ? "" : "disabled"}>更新</button>
              </div>
            </td>
          </tr>
        `)
        .join("")
    : `<tr><td colspan="4" class="empty-state">尚無使用者資料</td></tr>`;
}

function renderAccountSummary() {
  const user = authState.user || {};
  $("#accountSummary").innerHTML = `
    <article class="stack-card">
      <div class="stack-card-header">
        <div>
          <h3>${escapeHtml(user.name || "未登入")}</h3>
          <p>${escapeHtml(user.username || "")}｜${escapeHtml(user.id || "")}</p>
        </div>
        <span class="role-badge">${escapeHtml(roleText[user.role] || user.role || "")}</span>
      </div>
      <ul class="detail-list">
        <li><strong>部門：</strong>${escapeHtml(user.department || "")}</li>
        <li><strong>Site：</strong>${escapeHtml(user.site || "")}</li>
      </ul>
    </article>
  `;
}

function renderReports() {
  const results = state.results || [];
  const equipment = state.equipment || [];
  const alarms = state.alarms || [];
  const canOperate = roleAllows(["operator"]);

  // Result stat bar
  const closedResults = results.filter((r) => {
    const req = requestById(r.requestId);
    return req && req.status === "closed";
  }).length;
  $("#resultStatBar").innerHTML = results.length
    ? `<div class="result-stat-bar">
        <span>結果總數 <span class="stat-value">${results.length}</span></span>
        <span>已結案 <span class="stat-value">${closedResults}</span></span>
       </div>`
    : "";

  // Clamp page within bounds and slice for current page
  const totalPages = Math.max(1, Math.ceil(results.length / RESULTS_PER_PAGE));
  if (uiState.resultsPage > totalPages) uiState.resultsPage = totalPages;
  if (uiState.resultsPage < 1) uiState.resultsPage = 1;
  const pageStart = (uiState.resultsPage - 1) * RESULTS_PER_PAGE;
  const pageResults = results.slice(pageStart, pageStart + RESULTS_PER_PAGE);

  // Result cards — enhanced with metadata
  $("#resultList").innerHTML = results.length
    ? pageResults
        .map((result) => {
          const request = requestById(result.requestId);
          const job = result.jobId ? jobById(result.jobId) : null;
          const closeButton = canOperate && request && request.status !== "closed"
            ? `<button class="success-button" type="button" data-action="close-request" data-request-id="${escapeHtml(request.id)}">結案</button>`
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

  // Pagination control (only when more than one page)
  $("#resultPagination").innerHTML = results.length > RESULTS_PER_PAGE
    ? `<div class="pagination">
         <button class="ghost-button compact-button" type="button" data-action="prev-result-page" ${uiState.resultsPage <= 1 ? "disabled" : ""}>← 上一頁</button>
         <span class="pagination-info">第 ${uiState.resultsPage} / ${totalPages} 頁（共 ${results.length} 筆）</span>
         <button class="ghost-button compact-button" type="button" data-action="next-result-page" ${uiState.resultsPage >= totalPages ? "disabled" : ""}>下一頁 →</button>
       </div>`
    : "";

  // Utilization chart
  $("#utilizationChart").innerHTML = equipmentTypeSummary()
    .map((row) => {
      const cleanUtil = Math.max(0, Math.min(100, Math.round(Number(row.utilization) || 0)));
      return `
      <div class="chart-item">
        <div class="chart-label">
          <span>${escapeHtml(row.type)}｜運作中 ${row.running}/${row.count}</span>
          <span>${cleanUtil}%</span>
        </div>
        <div class="chart-track"><div class="chart-bar" style="width: ${cleanUtil}%"></div></div>
      </div>
    `})
    .join("");

  // Alarm summary bar
  const activeAlarms = alarms.filter((a) => a.status === "alarm").length;
  const closedAlarms = alarms.filter((a) => a.status === "closed").length;
  $("#alarmSummaryBar").innerHTML = alarms.length
    ? `<div class="alarm-summary">
        <span>活動中 <span class="summary-count">${activeAlarms}</span></span>
        <span>已處理 <span class="summary-count">${closedAlarms}</span></span>
        <span>合計 <span class="summary-count">${alarms.length}</span></span>
       </div>`
    : "";

  // Alarm cards — enhanced with severity and ack info
  $("#alarmList").innerHTML = alarms.length
    ? alarms
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
                ${canOperate && alarm.status === "alarm" ? `<button class="success-button" type="button" data-action="ack-alarm" data-alarm-id="${escapeHtml(alarm.id)}">確認處理</button>` : ""}
              </div>
            </article>
          `;
        })
        .join("")
    : `<div class="empty-state">目前沒有異常告警</div>`;
}

function renderAll() {
  $("#roleBadge").textContent = roleText[state.currentRole];
  if (authState.user) {
    $("#userBadge").textContent = authState.user.name;
  }
  applyRoleVisibility();
  renderMetrics();
  renderDashboardStatusChart();
  renderDashboardUtilization();
  renderDashboardTimeline();
  renderRequestTables();
  renderMachineSummary();
  renderApproval();
  renderReceiving();
  renderSplitForm();
  renderDispatchOptions();
  renderJobs();
  renderEquipment();
  renderMachineEventOptions();
  renderUsers();
  renderAccountSummary();
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

function applyManualSplit(request, wips) {
  const source = request.samples[0];
  request.status = "split";
  source.status = "split";
  request.wips = wips.map((wip, index) => ({
    id: `${source.id}-${String.fromCharCode(65 + index)}`,
    source: source.id,
    quantity: wip.quantity,
    purpose: wip.purpose,
    status: "queued"
  }));
  addAudit(`${request.id} 已分貨為 ${request.wips.map((wip) => wip.id).join(", ")}`);
  showToast(`${request.id} 已建立 WIP`);
  uiState.splitRows = [{ quantity: 1, purpose: "" }];
  uiState.splitRequestId = "";
  renderAll();
}

async function splitRequest(id, wips = null) {
  const request = requestById(id);
  if (!request || request.wips.length) return;
  const rows = wips || [
    { quantity: Math.max(1, Number(request.samples[0]?.quantity) || 1), purpose: `${request.labType} split` }
  ];
  let normalized;
  try {
    normalized = normalizeSplitRows(request, rows);
  } catch (error) {
    showToast(error.message);
    return;
  }

  if (await apiClient.action(`/api/requests/${encodeURIComponent(id)}/split`, {
    method: "POST",
    body: JSON.stringify(actorPayload({ wips: normalized.wips }))
  })) return;

  applyManualSplit(request, normalized.wips);
}

async function submitManualSplit(form) {
  uiState.splitRows = readSplitRows();
  const requestId = new FormData(form).get("requestId");
  await splitRequest(requestId, uiState.splitRows);
}

async function createDispatchJob(form) {
  const payload = actorPayload({
    ...formToObject(form),
    operator: currentActorName()
  });
  if (await apiClient.action("/api/dispatch-jobs", {
    method: "POST",
    body: JSON.stringify(payload)
  })) return;

  const data = new FormData(form);
  const requestId = data.get("requestId");
  const wipId = data.get("wipId");
  const equipmentId = data.get("equipmentId");
  const recipeId = data.get("recipeId");
  if (!requestId || !wipId || !equipmentId || !recipeId) {
    showToast("請先選擇可派貨的委託單、機台與 Recipe");
    return;
  }
  const request = requestById(requestId);
  const target = dispatchableItemsForRequest(request).find((item) => item.id === wipId);
  const machine = (state.equipment || []).find((item) => item.id === equipmentId);
  if (!target) {
    showToast(`WIP ${wipId || ""} 目前不可派貨`);
    return;
  }
  if (!machine || machine.status !== "idle") {
    showToast("只能派貨到閒置機台");
    return;
  }

  const id = `JOB-2026-${String(state.jobSeq).padStart(3, "0")}`;
  state.jobSeq += 1;
  const job = {
    id,
    requestId,
    wipId,
    equipmentId,
    recipeId,
    operator: currentActorName(),
    status: "queued",
    note: data.get("note").trim(),
    history: [{ action: "dispatch", actor: roleText[state.currentRole], occurredAt: new Date().toLocaleString("zh-TW", { hour12: false }), note: "派貨" }]
  };
  state.jobs.unshift(job);
  machine.status = "running";
  refreshLocalEquipmentUtilization();

  if (request) {
    request.status = "in_progress";
    [...request.wips, ...request.samples].forEach((item) => {
      if (item.id === job.wipId) item.status = "dispatched";
    });
  }

  addAudit(`${requestId} 建立派貨任務 ${id}，目標機台 ${equipmentName(equipmentId)}`);
  showToast(`${id} 已建立`);
  renderAll();
}

function completeJobLocally(job, actor, historyAction, historyNote, auditNote) {
  job.status = "completed";
  job.history = job.history || [];
  job.history.push({
    action: historyAction,
    actor,
    occurredAt: new Date().toLocaleString("zh-TW", { hour12: false }),
    note: historyNote
  });

  const machine = state.equipment.find((item) => item.id === job.equipmentId);
  if (machine) {
    machine.status = "idle";
    refreshLocalEquipmentUtilization();
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

  addAudit(auditNote);
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
  job.history.push({ action: "load", actor: currentActorName(), occurredAt: new Date().toLocaleString("zh-TW", { hour12: false }), note: "上貨" });
  const machine = state.equipment.find((item) => item.id === job.equipmentId);
  if (machine) {
    machine.status = "running";
    refreshLocalEquipmentUtilization();
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
  completeJobLocally(
    job,
    currentActorName(),
    "unload",
    "下貨與數據回收",
    `${job.id} 完成下貨，實驗數據已回收並自動結案`
  );
  showToast(`${job.id} 已完成，資料已回收並自動結案`);
}

async function changeMachineStatus(id, status) {
  if (await apiClient.action(`/api/equipment/${encodeURIComponent(id)}/status`, {
    method: "POST",
    body: JSON.stringify(actorPayload({ status }))
  })) return;

  const machine = state.equipment.find((item) => item.id === id);
  if (!machine) return;
  if (status === "idle" && machine.status === "running") {
    showToast("運作中的機台不可手動設為閒置");
    return;
  }
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
  refreshLocalEquipmentUtilization();
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

function applyEquipmentTypesLocally(types) {
  const previousByType = new Map();
  (state.equipment || []).forEach((machine) => {
    const type = machineType(machine);
    if (!previousByType.has(type)) previousByType.set(type, []);
    previousByType.get(type).push(machine);
  });
  const nextEquipment = [];
  types.forEach((row) => {
    const type = String(row.type || "").trim().toUpperCase();
    const count = Math.max(1, Number(row.count) || 1);
    const existing = previousByType.get(type) || [];
    for (let index = 0; index < count; index += 1) {
      const current = existing[index];
      nextEquipment.push(current ? {
        ...current,
        type,
        area: row.area || current.area || "",
        capability: row.capability || current.capability || type,
        status: current.status === "busy" ? "running" : current.status
      } : {
        id: `EQ-${type}-${String(index + 1).padStart(2, "0")}`,
        type,
        name: `${type}-${String(index + 1).padStart(2, "0")}`,
        area: row.area || "",
        capability: row.capability || type,
        status: "idle",
        utilization: 0
      });
    }
  });
  state.equipment = nextEquipment;
  refreshLocalEquipmentUtilization();
}

async function configureEquipmentTypes(form) {
  const types = readEquipmentTypeRows()
    .filter((row) => row.type)
    .map((row) => ({
      type: row.type,
      count: row.count,
      area: row.area,
      capability: row.capability
    }));
  if (!types.length) {
    showToast("至少需要一種機台");
    return;
  }

  if (await apiClient.action("/api/equipment/types", {
    method: "PUT",
    body: JSON.stringify(actorPayload({ types }))
  })) {
    uiState.equipmentTypeRows = [];
    return;
  }

  applyEquipmentTypesLocally(types);
  uiState.equipmentTypeRows = [];
  addAudit("機台種類與台數已更新");
  showToast("機台配置已更新");
  renderAll();
}

async function createUser(form) {
  const payload = actorPayload(formToObject(form));
  if (!apiClient.available) {
    const id = `USR-${String((state.users || []).length + 1).padStart(3, "0")}`;
    state.users = state.users || [];
    state.users.push({
      id,
      username: payload.username,
      name: payload.name,
      role: payload.role,
      department: payload.department || "",
      site: payload.site || ""
    });
    addAudit(`${payload.username} 帳號已建立`);
    showToast(`${payload.username} 已建立，預設密碼 password123`);
    form.reset();
    renderAll();
    return;
  }

  try {
    const result = await apiClient.request("/api/users", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    if (result.users) state.users = result.users;
    showToast(`${result.user.username} 已建立，預設密碼 ${result.defaultPassword}`);
    form.reset();
    renderAll();
  } catch (error) {
    console.error(error);
    if (error.status === 401) {
      clearSession();
      showLogin();
    }
    showToast(error.message || "新增帳號失敗");
  }
}

async function updateUserRole(userId) {
  const select = $$("[data-user-role-select]").find((element) => element.dataset.userId === userId);
  const role = select?.value;
  if (!userId || !role) return;

  if (!apiClient.available) {
    const user = state.users.find((item) => item.id === userId);
    if (user) {
      user.role = role;
      addAudit(`${user.username} 角色更新為 ${roleText[role] || role}`);
      showToast(`${user.username} 角色已更新`);
      renderAll();
    }
    return;
  }

  try {
    const payload = await apiClient.request(`/api/users/${encodeURIComponent(userId)}/role`, {
      method: "PATCH",
      body: JSON.stringify(actorPayload({ role }))
    });
    if (payload.users) {
      state.users = payload.users;
      if (authState.user?.id === userId) {
        const currentUser = payload.users.find((user) => user.id === userId);
        if (currentUser) setSession(authState.token, currentUser);
      }
    }
    showToast(payload.message || "使用者角色已更新");
    renderAll();
  } catch (error) {
    console.error(error);
    if (error.status === 401) {
      clearSession();
      showLogin();
    }
    showToast(error.message || "使用者角色更新失敗");
  }
}

async function changeOwnPassword(form) {
  if (!apiClient.available) {
    showToast("更換密碼需要連線到後端 API");
    return;
  }

  try {
    const result = await apiClient.request("/api/auth/password", {
      method: "PATCH",
      body: JSON.stringify(formToObject(form))
    });
    form.reset();
    showToast(result.message || "密碼已更新");
  } catch (error) {
    console.error(error);
    if (error.status === 401) {
      showToast(error.message || "目前密碼錯誤");
      return;
    }
    showToast(error.message || "密碼更新失敗");
  }
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
    refreshLocalEquipmentUtilization();
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

function machineEventPayloadFromFields(fields) {
  const eventType = String(fields.eventType || "completed");
  const payload = {};
  if (eventType === "alarm") {
    payload.severity = fields.severity || "Medium";
    payload.message = fields.message || "Machine reported an alarm";
  } else if (eventType === "measurement") {
    payload.metric = fields.metric || "measurement";
    if (fields.value !== "" && fields.value !== undefined) {
      payload.value = Number(fields.value);
    }
    payload.note = fields.message || "Measurement event";
  } else {
    payload.note = fields.message || "Machine completed event";
  }

  const event = {
    equipmentId: fields.equipmentId,
    eventType,
    payload,
    actor: fields.actor || currentActorName()
  };
  if (eventType !== "alarm") {
    event.jobId = fields.jobId;
  }
  return event;
}

function buildMachineEventPayload(form) {
  const fields = formToObject(form);
  fields.actor = currentActorName();
  return machineEventPayloadFromFields(fields);
}

function applyMachineEventFallback(event) {
  const machine = state.equipment.find((item) => item.id === event.equipmentId);
  if (!machine) {
    showToast("找不到指定機台");
    return;
  }

  if (event.eventType === "completed") {
    const job = jobById(event.jobId);
    if (!job || job.equipmentId !== machine.id || !["running", "loaded"].includes(job.status)) {
      showToast("completed event 需要同機台且執行中的 Job");
      return;
    }
    completeJobLocally(
      job,
      event.actor,
      "machine.completed",
      event.payload.note || "Machine completed event",
      `${machine.name} 回報 ${job.id} 完成`
    );
    showToast("event processed");
    return;
  }

  if (event.eventType === "alarm") {
    machine.status = "alarm";
    refreshLocalEquipmentUtilization();
    const alarmId = `ALM-${String(state.alarmSeq).padStart(3, "0")}`;
    state.alarmSeq += 1;
    state.alarms.unshift({
      id: alarmId,
      equipmentId: machine.id,
      severity: event.payload.severity || "Medium",
      message: event.payload.message || `${machine.name} reported an alarm`,
      status: "alarm"
    });
    addAudit(`${machine.name} machine event 建立告警 ${alarmId}`);
    showToast("event processed");
    renderAll();
    return;
  }

  if (event.eventType === "measurement") {
    const job = jobById(event.jobId);
    if (!job || job.equipmentId !== machine.id) {
      showToast("measurement event 需要同機台 Job");
      return;
    }
    job.history = job.history || [];
    job.history.push({
      action: "machine.measurement",
      actor: event.actor,
      occurredAt: new Date().toLocaleString("zh-TW", { hour12: false }),
      note: event.payload.note || "Measurement event",
      payload: event.payload
    });
    addAudit(`${machine.name} measurement 已寫入 ${job.id}`);
    showToast("event processed");
    renderAll();
  }
}

async function processMachineEvent(form) {
  const event = buildMachineEventPayload(form);
  if (!event.equipmentId) {
    showToast("請先選擇機台");
    return;
  }
  if (event.eventType !== "alarm" && !event.jobId) {
    showToast(`${event.eventType} event 需要 Job`);
    return;
  }

  if (await apiClient.action("/api/machine-events", {
    method: "POST",
    body: JSON.stringify(event)
  }, { fallbackOnStatuses: [404, 405] })) return;

  applyMachineEventFallback(event);
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

  const {
    action,
    requestId,
    jobId,
    equipmentId,
    status,
    alarmId,
    recipeId,
    splitIndex,
    equipmentTypeIndex,
    userId
  } = actionButton.dataset;
  if (action === "approve") approveRequest(requestId);
  if (action === "reject") rejectRequest(requestId);
  if (action === "receive") receiveRequest(requestId);
  if (action === "split") splitRequest(requestId);
  if (action === "select-split") {
    uiState.splitRequestId = requestId;
    uiState.splitRows = [{ quantity: 1, purpose: "" }];
    switchSection("lab");
    renderSplitForm();
  }
  if (action === "remove-split-row") {
    uiState.splitRows = readSplitRows().filter((_row, index) => index !== Number(splitIndex));
    if (!uiState.splitRows.length) uiState.splitRows = [{ quantity: 1, purpose: "" }];
    renderSplitForm();
  }
  if (action === "remove-equipment-type-row") {
    uiState.equipmentTypeRows = readEquipmentTypeRows().filter((_row, index) => index !== Number(equipmentTypeIndex));
    renderEquipmentTypeForm();
  }
  if (action === "load") loadJob(jobId);
  if (action === "unload") unloadJob(jobId);
  if (action === "machine-status") changeMachineStatus(equipmentId, status);
  if (action === "close-request") closeRequest(requestId);
  if (action === "ack-alarm") acknowledgeAlarm(alarmId);
  if (action === "deactivate-recipe") deactivateRecipe(recipeId);
  if (action === "prev-result-page") {
    if (uiState.resultsPage > 1) {
      uiState.resultsPage -= 1;
      renderReports();
    }
  }
  if (action === "next-result-page") {
    uiState.resultsPage += 1;
    renderReports();
  }
  if (action === "update-user-role") updateUserRole(userId);
});

$("#splitRows").addEventListener("input", (event) => {
  if (!(event.target instanceof HTMLInputElement)) return;
  if (event.target.name !== "quantity") return;
  const selectedRequest = requestById(uiState.splitRequestId);
  const source = selectedRequest?.samples?.[0];
  updateSplitSummary(source, selectedRequest);
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

$("#manualSplitForm").addEventListener("submit", (event) => {
  event.preventDefault();
  submitManualSplit(event.currentTarget);
});

$("#recipeForm").addEventListener("submit", (event) => {
  event.preventDefault();
  createRecipe(event.currentTarget);
});

$("#machineEventForm").addEventListener("submit", (event) => {
  event.preventDefault();
  processMachineEvent(event.currentTarget);
});

$("#equipmentTypeForm").addEventListener("submit", (event) => {
  event.preventDefault();
  configureEquipmentTypes(event.currentTarget);
});

$("#userForm").addEventListener("submit", (event) => {
  event.preventDefault();
  createUser(event.currentTarget);
});

$("#passwordForm").addEventListener("submit", (event) => {
  event.preventDefault();
  changeOwnPassword(event.currentTarget);
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
$("#splitRequest").addEventListener("change", (event) => {
  uiState.splitRequestId = event.target.value;
  uiState.splitRows = [{ quantity: 1, purpose: "" }];
  renderSplitForm();
});
$("#addSplitRowButton").addEventListener("click", () => {
  uiState.splitRows = readSplitRows();
  uiState.splitRows.push({ quantity: 1, purpose: "" });
  renderSplitForm();
});
$("#addEquipmentTypeButton").addEventListener("click", () => {
  uiState.equipmentTypeRows = readEquipmentTypeRows();
  uiState.equipmentTypeRows.push({ type: "", count: 1, area: "", capability: "" });
  renderEquipmentTypeForm();
});
$("#machineEventEquipment").addEventListener("change", (event) => {
  uiState.machineEventEquipmentId = event.target.value;
  renderMachineEventOptions();
});
$("#machineEventType").addEventListener("change", (event) => {
  uiState.machineEventType = event.target.value;
  renderMachineEventOptions();
});
$("#createAlarmButton").addEventListener("click", simulateAlarm);

boot();

if (typeof module !== "undefined") {
  module.exports = {
    escapeHtml, statusPill, priorityPill, auditMessage, auditTime, equipmentName, recipeName, state, statusText,
    roleAllows, sectionAllowed, normalizeSplitRows, machineEventPayloadFromFields, dispatchableItemsForRequest,
    machineType, equipmentTypeSummary, refreshLocalEquipmentUtilization,
    renderDashboardStatusChart, renderDashboardUtilization, renderDashboardTimeline,
    renderReports, renderRequestTables, renderMachineSummary, renderEquipment, renderUsers, renderAccountSummary
  };
}

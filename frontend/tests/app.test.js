global.window = {
  localStorage: { getItem: () => "", setItem: () => {}, removeItem: () => {} },
  location: { protocol: "http:" },
  LIMS_API_BASE_URL: "http://localhost:3443",
  setTimeout: () => {},
  clearTimeout: () => {}
};
global.domNodes = {};
global.document = {
  querySelector: (sel) => {
    if (!global.domNodes[sel]) {
      global.domNodes[sel] = { classList: { add: () => {}, remove: () => {} }, textContent: "", addEventListener: () => {}, innerHTML: "" };
    }
    return global.domNodes[sel];
  },
  querySelectorAll: () => [],
  addEventListener: () => {}
};

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  escapeHtml, statusPill, priorityPill, auditMessage, auditTime, equipmentName, recipeName, state, statusText,
  roleAllows, sectionAllowed, normalizeSplitRows, machineEventPayloadFromFields, dispatchableItemsForRequest,
  renderDashboardStatusChart, renderDashboardUtilization, renderReports, renderUsers
} = require("../app");

// ==================== escapeHtml ====================
test("escapeHtml should replace HTML special characters", () => {
  assert.equal(escapeHtml("Hello & World"), "Hello &amp; World");
  assert.equal(escapeHtml("<script>alert('XSS')</script>"), "&lt;script&gt;alert(&#039;XSS&#039;)&lt;/script&gt;");
  assert.equal(escapeHtml('User "Admin"'), "User &quot;Admin&quot;");
});

test("escapeHtml should return non-string inputs as is", () => {
  assert.equal(escapeHtml(123), 123);
  assert.equal(escapeHtml(null), null);
  assert.equal(escapeHtml(undefined), undefined);
  const obj = {};
  assert.equal(escapeHtml(obj), obj);
});

// ==================== statusPill ====================
test("statusPill should return a span with correct class and label", () => {
  const result = statusPill("idle");
  assert.ok(result.includes('class="status-pill status-idle"'), "should have correct CSS class");
  assert.ok(result.includes("閒置"), "should contain the Chinese translation");
});

test("statusPill should fallback to raw status when no translation exists", () => {
  const result = statusPill("unknown_status");
  assert.ok(result.includes("unknown_status"), "should show raw status as fallback");
});

// ==================== priorityPill ====================
test("priorityPill should return a span with correct priority class", () => {
  const result = priorityPill("High");
  assert.ok(result.includes('class="priority-pill priority-High"'), "should have correct CSS class");
  assert.ok(result.includes("High"), "should contain the priority text");
});

test("priorityPill should handle Critical priority", () => {
  const result = priorityPill("Critical");
  assert.ok(result.includes("priority-Critical"), "should have Critical class");
});

// ==================== auditMessage ====================
test("auditMessage should extract message from string entry", () => {
  const result = auditMessage("REQ-001 已核准");
  assert.ok(result.includes("REQ-001 已核准"), "should return the escaped string");
});

test("auditMessage should extract message from object entry", () => {
  const entry = { message: "REQ-002 已收件", actor: "Lab Operator", occurredAt: "2026/05/01 10:00" };
  const result = auditMessage(entry);
  assert.ok(result.includes("REQ-002 已收件"), "should extract .message from object");
});

test("auditMessage should escape HTML in message", () => {
  const result = auditMessage("<b>XSS</b>");
  assert.ok(result.includes("&lt;b&gt;"), "should escape HTML tags");
  assert.ok(!result.includes("<b>"), "should not contain raw HTML");
});

// ==================== auditTime ====================
test("auditTime should return occurredAt from object entry", () => {
  const entry = { message: "test", occurredAt: "2026/05/01 10:00:00" };
  assert.equal(auditTime(entry), "2026/05/01 10:00:00");
});

test("auditTime should return a date string for plain string entry", () => {
  const result = auditTime("some action");
  assert.equal(typeof result, "string");
  assert.ok(result.length > 0, "should return a non-empty date string");
});

// ==================== equipmentName ====================
test("equipmentName should return machine name for known equipment ID", () => {
  assert.equal(equipmentName("EQ-SEM-01"), "SEM-01");
  assert.equal(equipmentName("EQ-XRD-01"), "XRD-01");
  assert.equal(equipmentName("EQ-FTIR-01"), "FTIR-01");
});

test("equipmentName should fallback to raw ID for unknown equipment", () => {
  assert.equal(equipmentName("EQ-UNKNOWN-99"), "EQ-UNKNOWN-99");
});

// ==================== recipeName ====================
test("recipeName should return recipe name for known recipe ID", () => {
  assert.equal(recipeName("RCP-001"), "Defect Review Standard");
  assert.equal(recipeName("RCP-002"), "Thin Film Stress Scan");
});

test("recipeName should fallback to raw ID for unknown recipe", () => {
  assert.equal(recipeName("RCP-UNKNOWN"), "RCP-UNKNOWN");
});

// ==================== statusText mapping ====================
test("statusText should contain all expected status translations", () => {
  assert.equal(statusText.idle, "閒置");
  assert.equal(statusText.alarm, "異常");
  assert.equal(statusText.pending_approval, "待簽核");
  assert.equal(statusText.completed, "已完成");
  assert.equal(statusText.running, "執行中");
  assert.equal(statusText.dispatched, "已派貨");
});

// ==================== Role-driven UI helpers ====================
test("roleAllows should let admin pass every role-gated UI check", () => {
  assert.equal(roleAllows(["operator"], "operator"), true);
  assert.equal(roleAllows(["operator"], "fab"), false);
  assert.equal(roleAllows(["operator"], "admin"), true);
});

test("sectionAllowed should follow current JWT role state", () => {
  const previousRole = state.currentRole;
  state.currentRole = "fab";
  assert.equal(sectionAllowed("requests"), true);
  assert.equal(sectionAllowed("lab"), false);
  assert.equal(sectionAllowed("users"), false);

  state.currentRole = "operator";
  assert.equal(sectionAllowed("lab"), true);
  assert.equal(sectionAllowed("approval"), false);

  state.currentRole = "admin";
  assert.equal(sectionAllowed("users"), true);
  state.currentRole = previousRole;
});

// ==================== Manual split helpers ====================
test("normalizeSplitRows should build contract-compatible WIP payload", () => {
  const request = {
    id: "REQ-1",
    labType: "SEM",
    samples: [{ id: "SMP-1", quantity: 4 }]
  };
  const result = normalizeSplitRows(request, [
    { quantity: "2", purpose: "SEM primary" },
    { quantity: 1, purpose: "" }
  ]);

  assert.equal(result.totalQuantity, 3);
  assert.deepEqual(result.wips, [
    { quantity: 2, purpose: "SEM primary" },
    { quantity: 1, purpose: "SEM split" }
  ]);
});

test("normalizeSplitRows should reject impossible WIP quantities", () => {
  const request = {
    id: "REQ-1",
    labType: "XRD",
    samples: [{ id: "SMP-1", quantity: 2 }]
  };

  assert.throws(() => normalizeSplitRows(request, [{ quantity: 0, purpose: "bad" }]), /正整數/);
  assert.throws(() => normalizeSplitRows(request, [{ quantity: 3, purpose: "too much" }]), /不可超過/);
});

test("dispatchableItemsForRequest should only expose queued WIPs", () => {
  const request = {
    wips: [
      { id: "WIP-A", status: "queued" },
      { id: "WIP-B", status: "dispatched" }
    ],
    samples: [{ id: "SMP-1", status: "received" }]
  };

  assert.deepEqual(dispatchableItemsForRequest(request).map((item) => item.id), ["WIP-A"]);
});

// ==================== Machine event helpers ====================
test("machineEventPayloadFromFields should build completed event payload", () => {
  const payload = machineEventPayloadFromFields({
    equipmentId: "EQ-SEM-01",
    eventType: "completed",
    jobId: "JOB-1",
    message: "done",
    actor: "Machine"
  });

  assert.deepEqual(payload, {
    equipmentId: "EQ-SEM-01",
    eventType: "completed",
    jobId: "JOB-1",
    payload: { note: "done" },
    actor: "Machine"
  });
});

test("machineEventPayloadFromFields should omit jobId for alarm events", () => {
  const payload = machineEventPayloadFromFields({
    equipmentId: "EQ-PROBE-01",
    eventType: "alarm",
    severity: "High",
    message: "Probe warning",
    actor: "Machine"
  });

  assert.equal(payload.jobId, undefined);
  assert.equal(payload.payload.severity, "High");
  assert.equal(payload.payload.message, "Probe warning");
});

// ==================== XSS safety in helpers ====================
test("statusPill should escape malicious status values", () => {
  const result = statusPill('<img onerror="alert(1)">');
  assert.ok(!result.includes('<img'), "should not contain raw HTML tag");
  assert.ok(result.includes("&lt;img"), "should contain escaped HTML");
});

test("priorityPill should escape malicious priority values", () => {
  const result = priorityPill('" onclick="alert(1)"');
  // The raw " should be escaped to &quot; preventing attribute injection
  assert.ok(!result.includes('onclick="alert'), "should not contain unescaped attribute injection");
  assert.ok(result.includes("&quot;"), "should contain escaped quotes");
});

// ==================== Render Functions ====================
test("renderDashboardStatusChart should handle empty state", () => {
  state.requests = [];
  renderDashboardStatusChart();
  const html = global.domNodes["#dashboardStatusChart"].innerHTML;
  assert.ok(html.includes("尚無委託單"), "Should show empty state for requests");
});

test("renderDashboardUtilization should handle empty state", () => {
  state.equipment = [];
  renderDashboardUtilization();
  const html = global.domNodes["#dashboardUtilization"].innerHTML;
  assert.ok(html.includes("尚無機台資料"), "Should show empty state for equipment");
});

test("renderDashboardUtilization should escape equipment name", () => {
  state.equipment = [{ id: "EQ-1", name: "<script>alert(1)</script>", status: "idle", utilization: 50 }];
  renderDashboardUtilization();
  const html = global.domNodes["#dashboardUtilization"].innerHTML;
  assert.ok(!html.includes("<script>"), "Should not contain unescaped script tag");
  assert.ok(html.includes("&lt;script&gt;"), "Should contain escaped script tag");
});

test("renderReports should handle empty state for results and alarms", () => {
  state.results = [];
  state.alarms = [];
  renderReports();
  assert.ok(global.domNodes["#resultStatBar"].innerHTML === "", "Result stat bar should be empty when no results");
  assert.ok(global.domNodes["#alarmSummaryBar"].innerHTML === "", "Alarm summary bar should be empty when no alarms");
  assert.ok(global.domNodes["#resultList"].innerHTML.includes("完成下貨後會自動產生結果資料"), "Should show empty state for results");
  assert.ok(global.domNodes["#alarmList"].innerHTML.includes("目前沒有異常告警"), "Should show empty state for alarms");
});

test("renderReports should display formatted result and alarm data", () => {
  state.results = [{ id: "RES-1", requestId: "REQ-1", summary: "Test Summary", rawData: "/data/1", report: "/report/1", createdAt: "2026/05/20 10:00:00" }];
  state.alarms = [{ id: "ALM-1", equipmentId: "EQ-SEM-01", message: "Test Alarm", status: "alarm", severity: "High" }];
  renderReports();
  const resultHtml = global.domNodes["#resultList"].innerHTML;
  const alarmHtml = global.domNodes["#alarmList"].innerHTML;

  assert.ok(resultHtml.includes("RES-1"), "Should display result ID");
  assert.ok(resultHtml.includes("2026/05/20 10:00:00"), "Should display created time");
  assert.ok(resultHtml.includes('class="result-meta-code"'), "Should use code block style for paths");

  assert.ok(alarmHtml.includes("ALM-1"), "Should display alarm ID");
  assert.ok(alarmHtml.includes("severity-High"), "Should display severity class");
});

test("renderUsers should show sanitized role controls for admin", () => {
  const previousUsers = state.users;
  const previousRole = state.currentRole;
  state.currentRole = "admin";
  state.users = [{
    id: "USR-X",
    username: "<admin>",
    name: "Admin <script>",
    role: "operator",
    department: "IT",
    site: "Fab 12",
    passwordHash: "secret"
  }];

  renderUsers();
  const html = global.domNodes["#userRows"].innerHTML;
  assert.ok(html.includes("&lt;admin&gt;"), "username should be escaped");
  assert.ok(!html.includes("<script>"), "name should not contain raw script tag");
  assert.ok(!html.includes("passwordHash"), "password fields should not be rendered");
  assert.ok(html.includes("實驗室人員"), "role label should be rendered");

  state.users = previousUsers;
  state.currentRole = previousRole;
});

// ==================== Extended Edge Case Tests ====================
test("Defensive State Null-Safety: render functions should survive null states", () => {
  const originalState = { ...state };

  // Simulate API returning nulls
  state.requests = null;
  state.equipment = null;
  state.recipes = null;
  state.jobs = null;
  state.results = null;
  state.alarms = null;
  state.audit = null;

  // Execution should not throw TypeError
  assert.doesNotThrow(() => {
    renderDashboardStatusChart();
    renderDashboardUtilization();
    renderReports();
  }, "Render functions should handle null states gracefully");

  // Restore state
  Object.assign(state, originalState);
});

test("Utilization should be calculated by running machines per equipment type", () => {
  state.equipment = [
    { id: "EQ-SEM-01", type: "SEM", name: "SEM-01", status: "running" },
    { id: "EQ-SEM-02", type: "SEM", name: "SEM-02", status: "idle" },
    { id: "EQ-XRD-01", type: "XRD", name: "XRD-01", status: "idle" },
    { id: "EQ-XRD-02", type: "XRD", name: "XRD-02", status: "maintenance" }
  ];

  renderDashboardUtilization();
  const html = global.domNodes["#dashboardUtilization"].innerHTML;

  assert.ok(html.includes("SEM｜運作中 1/2"), "SEM should show running count over total");
  assert.ok(html.includes("width: 50%"), "SEM utilization should be 50%");
  assert.ok(html.includes("XRD｜運作中 0/2"), "XRD should show zero running machines");
  assert.ok(html.includes("width: 0%"), "XRD utilization should be 0%");
});

test("HTML Attribute XSS Defense: data-* attributes should be escaped", () => {
  const evilId = 'REQ-"onclick="alert(1)"';
  state.requests = [{ id: evilId, status: "completed", samples: [], wips: [] }];
  state.results = [{
    id: "RES-1",
    requestId: evilId,
    summary: "Test",
    rawData: "path",
    report: "path"
  }];

  renderReports();
  const html = global.domNodes["#resultList"].innerHTML;

  assert.ok(!html.includes(`data-request-id="${evilId}"`), "Should not contain unescaped attribute injection");
  assert.ok(html.includes("&quot;"), "Should escape quotes in data-request-id attribute");
});

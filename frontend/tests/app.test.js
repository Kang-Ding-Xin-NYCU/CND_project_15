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
  renderDashboardStatusChart, renderDashboardUtilization, renderReports
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
  assert.equal(equipmentName("EQ-XRD-02"), "XRD-02");
  assert.equal(equipmentName("EQ-FTIR-03"), "FTIR-03");
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

test("Utilization Boundary Defense: Should restrict out-of-bound and NaN utilization", () => {
  state.equipment = [
    { id: "EQ-1", name: "Eq 1", status: "idle", utilization: -20 },
    { id: "EQ-2", name: "Eq 2", status: "idle", utilization: 150 },
    { id: "EQ-3", name: "Eq 3", status: "idle", utilization: "invalid" }
  ];
  
  renderDashboardUtilization();
  const html = global.domNodes["#dashboardUtilization"].innerHTML;
  
  assert.ok(html.includes("width: 0%"), "Negative utilization should be clamped to 0%");
  assert.ok(html.includes("width: 100%"), "Over-100 utilization should be clamped to 100%");
  
  const zeroCount = (html.match(/width: 0%/g) || []).length;
  assert.equal(zeroCount, 2, "Both negative and invalid utilizations should be clamped to 0%");
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


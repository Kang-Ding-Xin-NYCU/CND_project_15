global.window = {
  localStorage: { getItem: () => "", setItem: () => {}, removeItem: () => {} },
  location: { protocol: "http:" },
  LIMS_API_BASE_URL: "http://localhost:3443",
  setTimeout: () => {},
  clearTimeout: () => {}
};
global.document = {
  querySelector: () => ({ classList: { add: () => {}, remove: () => {} }, textContent: "", addEventListener: () => {}, innerHTML: "" }),
  querySelectorAll: () => [],
  addEventListener: () => {}
};

const assert = require("node:assert/strict");
const test = require("node:test");
const { escapeHtml, statusPill, priorityPill, auditMessage, auditTime, equipmentName, recipeName, state, statusText } = require("../app");

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

global.window = {
  localStorage: { getItem: () => "", setItem: () => {}, removeItem: () => {} },
  location: { protocol: "http:" },
  LIMS_API_BASE_URL: "http://localhost:3443",
  setTimeout: () => {},
  clearTimeout: () => {}
};
global.document = {
  querySelector: () => ({ classList: { add: () => {}, remove: () => {} }, textContent: "", addEventListener: () => {} }),
  querySelectorAll: () => [],
  addEventListener: () => {}
};

const assert = require("node:assert/strict");
const test = require("node:test");
const { escapeHtml } = require("../app");

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

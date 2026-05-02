const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createServer } = require("../server");

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, () => {
      const { port } = server.address();
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

async function jsonFetch(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  return payload;
}

async function login(baseUrl, username = "operator") {
  const payload = await jsonFetch(baseUrl, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password: "password123" })
  });
  assert.ok(payload.token);
  return payload.token;
}

function authOptions(token, options = {}) {
  return {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  };
}

test("protected API rejects missing JWT", async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lims-api-"));
  const server = createServer({ dataFile: path.join(tempDir, "state.json"), staticRoot: path.join(__dirname, "..") });
  const baseUrl = await listen(server);
  t.after(() => server.close());

  const response = await fetch(`${baseUrl}/api/state`);
  assert.equal(response.status, 401);
});

test("request can move through approval, receiving, split, dispatch, load, unload, and auto-close", async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lims-api-"));
  const server = createServer({ dataFile: path.join(tempDir, "state.json"), staticRoot: path.join(__dirname, "..") });
  const baseUrl = await listen(server);
  t.after(() => server.close());
  const token = await login(baseUrl);

  let payload = await jsonFetch(baseUrl, "/api/requests", {
    method: "POST",
    body: JSON.stringify({
      requester: "Test User",
      department: "Fab Test",
      labType: "SEM",
      priority: "High",
      dueDate: "2026-05-20",
      sampleCode: "SMP-T-001",
      material: "Wafer Lot T01",
      quantity: "4",
      goal: "Validate API flow"
    }),
    headers: { Authorization: `Bearer ${token}` }
  });
  const requestId = payload.state.requests[0].id;
  assert.equal(payload.state.requests[0].status, "pending_approval");

  payload = await jsonFetch(baseUrl, `/api/requests/${requestId}/approve`, authOptions(token, { method: "POST", body: "{}" }));
  assert.equal(payload.state.requests[0].status, "approved");

  payload = await jsonFetch(baseUrl, `/api/requests/${requestId}/receive`, authOptions(token, { method: "POST", body: "{}" }));
  assert.equal(payload.state.requests[0].status, "received");

  payload = await jsonFetch(baseUrl, `/api/requests/${requestId}/split`, authOptions(token, { method: "POST", body: "{}" }));
  const request = payload.state.requests.find((item) => item.id === requestId);
  assert.equal(request.status, "split");
  assert.equal(request.wips.length, 2);

  payload = await jsonFetch(baseUrl, "/api/dispatch-jobs", {
    method: "POST",
    body: JSON.stringify({
      requestId,
      wipId: request.wips[0].id,
      equipmentId: "EQ-SEM-01",
      recipeId: "RCP-001",
      operator: "Tester",
      note: "API test dispatch"
    }),
    headers: { Authorization: `Bearer ${token}` }
  });
  const jobId = payload.state.jobs[0].id;
  assert.equal(payload.state.jobs[0].status, "queued");

  payload = await jsonFetch(baseUrl, `/api/dispatch-jobs/${jobId}/load`, authOptions(token, { method: "POST", body: "{}" }));
  assert.equal(payload.state.jobs[0].status, "running");

  payload = await jsonFetch(baseUrl, `/api/dispatch-jobs/${jobId}/unload`, authOptions(token, { method: "POST", body: "{}" }));
  const closedRequest = payload.state.requests.find((item) => item.id === requestId);
  assert.equal(payload.state.jobs[0].status, "completed");
  assert.equal(closedRequest.status, "closed");
  assert.equal(payload.state.results[0].jobId, jobId);
});

test("alarm can be simulated and acknowledged", async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lims-api-"));
  const server = createServer({ dataFile: path.join(tempDir, "state.json"), staticRoot: path.join(__dirname, "..") });
  const baseUrl = await listen(server);
  t.after(() => server.close());
  const token = await login(baseUrl);

  const simulated = await jsonFetch(baseUrl, "/api/alarms/simulate", authOptions(token, { method: "POST", body: "{}" }));
  const alarm = simulated.state.alarms[0];
  assert.equal(alarm.status, "alarm");

  const acknowledged = await jsonFetch(baseUrl, `/api/alarms/${alarm.id}/ack`, authOptions(token, { method: "POST", body: "{}" }));
  assert.equal(acknowledged.state.alarms[0].status, "closed");
});

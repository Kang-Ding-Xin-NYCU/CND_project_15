const { createDashboard } = require("../dashboard");
const { sendJson } = require("../http-utils");

async function handleQueryRoutes(req, res, pathname, store) {
  if (req.method === "GET" && pathname === "/api/health") {
    sendJson(res, 200, {
      status: "ok",
      store: store.driver,
      cache: store.cache?.enabled ? "redis" : "none"
    });
    return true;
  }

  if (req.method === "GET" && pathname === "/api/state") {
    if (store.cache?.enabled) {
      const cachedState = await store.cache.getJson("state");
      if (cachedState) {
        sendJson(res, 200, cachedState);
        return true;
      }
    }
    const state = await store.read();
    if (store.cache?.enabled) await store.cache.setJson("state", state, 20);
    sendJson(res, 200, state);
    return true;
  }

  if (req.method === "POST" && pathname === "/api/reset") {
    sendJson(res, 200, { state: await store.reset(), message: "Demo data reset" });
    return true;
  }

  if (req.method === "GET" && pathname === "/api/dashboard") {
    if (store.cache?.enabled) {
      const cachedDashboard = await store.cache.getJson("dashboard");
      if (cachedDashboard) {
        sendJson(res, 200, cachedDashboard);
        return true;
      }
    }
    const dashboard = createDashboard(await store.read());
    if (store.cache?.enabled) await store.cache.setJson("dashboard", dashboard, 30);
    sendJson(res, 200, dashboard);
    return true;
  }

  if (req.method === "GET" && pathname === "/api/requests") {
    const state = await store.read();
    sendJson(res, 200, state.requests);
    return true;
  }

  if (req.method === "GET" && pathname === "/api/equipment") {
    const state = await store.read();
    sendJson(res, 200, state.equipment);
    return true;
  }

  if (req.method === "GET" && pathname === "/api/jobs") {
    const state = await store.read();
    sendJson(res, 200, state.jobs);
    return true;
  }

  if (req.method === "GET" && pathname === "/api/results") {
    const state = await store.read();
    sendJson(res, 200, state.results);
    return true;
  }

  if (req.method === "GET" && pathname === "/api/alarms") {
    const state = await store.read();
    sendJson(res, 200, state.alarms);
    return true;
  }

  return false;
}

module.exports = {
  handleQueryRoutes
};

const { sendJson } = require("../http-utils");
const { authenticateRequest } = require("../auth");
const { handleAlarmRoutes } = require("./alarms");
const { handleAuthRoutes } = require("./auth");
const { handleDispatchJobRoutes } = require("./dispatch-jobs");
const { handleEquipmentRoutes } = require("./equipment");
const { handleQueryRoutes } = require("./queries");
const { handleRecipeRoutes } = require("./recipes");
const { handleRequestRoutes } = require("./requests");

const routeHandlers = [
  handleAuthRoutes,
  handleQueryRoutes,
  handleRequestRoutes,
  handleDispatchJobRoutes,
  handleEquipmentRoutes,
  handleRecipeRoutes,
  handleAlarmRoutes
];

async function handleApi(req, res, pathname, store) {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  if (!(req.method === "GET" && pathname === "/api/health") && !(req.method === "POST" && pathname === "/api/auth/login")) {
    req.user = await authenticateRequest(req, store.cache);
  }

  for (const handler of routeHandlers) {
    if (await handler(req, res, pathname, store)) return;
  }

  sendJson(res, 404, { error: "API route not found" });
}

module.exports = {
  handleApi
};

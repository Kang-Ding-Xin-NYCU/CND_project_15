const http = require("node:http");
const https = require("node:https");
const fs = require("node:fs");
const { URL } = require("node:url");
const {
  DEFAULT_DATA_FILE,
  DEFAULT_PORT,
  HTTPS_ENABLED,
  MONGO_DB_NAME,
  MONGO_URL,
  REDIS_URL,
  TLS_CERT_FILE,
  TLS_KEY_FILE
} = require("./src/config");
const { createRedisCache } = require("./src/cache");
const { sendJson } = require("./src/http-utils");
const { handleApi } = require("./src/routes");
const { createInitialState } = require("./src/seed");
const { createStore } = require("./src/store");

function loadTlsOptions(options = {}) {
  const keyFile = options.tlsKeyFile || TLS_KEY_FILE;
  const certFile = options.tlsCertFile || TLS_CERT_FILE;
  if (!keyFile || !certFile) {
    const error = new Error("HTTPS requires TLS_KEY_FILE and TLS_CERT_FILE");
    error.statusCode = 500;
    throw error;
  }
  return {
    key: fs.readFileSync(keyFile),
    cert: fs.readFileSync(certFile)
  };
}

function createRequestHandler(store) {
  return async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    try {
      if (url.pathname.startsWith("/api/")) {
        await handleApi(req, res, url.pathname, store);
        return;
      }
      sendJson(res, 404, {
        error: "API route not found",
        service: "cloud-lims-backend",
        health: "/api/health"
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;
      sendJson(res, statusCode, { error: error.message || "Internal server error" });
    }
  };
}

function createServer(options = {}) {
  const dataFile = options.dataFile || DEFAULT_DATA_FILE;
  const cache = options.cache || createRedisCache(options.redisUrl ?? REDIS_URL);
  const store = createStore(dataFile, {
    cache,
    mongoUrl: options.mongoUrl ?? MONGO_URL,
    dbName: options.mongoDbName ?? MONGO_DB_NAME
  });
  const handler = createRequestHandler(store);
  const useHttps = options.https ?? HTTPS_ENABLED;

  return useHttps
    ? https.createServer(loadTlsOptions(options), handler)
    : http.createServer(handler);
}

if (require.main === module) {
  const server = createServer();
  server.listen(DEFAULT_PORT, () => {
    const protocol = HTTPS_ENABLED ? "https" : "http";
    console.log(`Cloud LIMS backend API listening on ${protocol}://localhost:${DEFAULT_PORT}/api/health`);
  });
}

module.exports = {
  createServer,
  createInitialState
};

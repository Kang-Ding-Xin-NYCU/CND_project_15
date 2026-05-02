const path = require("node:path");

const ROOT_DIR = path.join(__dirname, "..");

module.exports = {
  DEFAULT_DATA_FILE: process.env.DATA_FILE || path.join(ROOT_DIR, "data", "lims-state.json"),
  HTTPS_ENABLED: process.env.HTTPS === "true",
  DEFAULT_PORT: Number(process.env.PORT || (process.env.HTTPS === "true" ? 3443 : 3000)),
  JWT_SECRET: process.env.JWT_SECRET || "dev-lims-secret-change-me",
  MONGO_URL: process.env.MONGO_URL || "",
  MONGO_DB_NAME: process.env.MONGO_DB_NAME || "cloud_lims",
  REDIS_URL: process.env.REDIS_URL || "",
  TLS_CERT_FILE: process.env.TLS_CERT_FILE || "",
  TLS_KEY_FILE: process.env.TLS_KEY_FILE || ""
};

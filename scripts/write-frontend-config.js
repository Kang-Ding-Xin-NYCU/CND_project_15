const fs = require("node:fs");
const path = require("node:path");

const rawApiBaseUrl = process.env.API_BASE_URL || process.env.LIMS_API_BASE_URL || "";

if (!rawApiBaseUrl.trim()) {
  console.error("API_BASE_URL is required, for example: https://cloud-lims-backend.onrender.com");
  process.exit(1);
}

let apiBaseUrl;
try {
  apiBaseUrl = new URL(rawApiBaseUrl.trim());
} catch (error) {
  console.error(`API_BASE_URL is not a valid URL: ${rawApiBaseUrl}`);
  process.exit(1);
}

if (!["http:", "https:"].includes(apiBaseUrl.protocol)) {
  console.error("API_BASE_URL must start with http:// or https://");
  process.exit(1);
}

const normalizedApiBaseUrl = apiBaseUrl.toString().replace(/\/$/, "");
const outputPath = path.join(__dirname, "..", "frontend", "config.js");
fs.writeFileSync(
  outputPath,
  `window.LIMS_API_BASE_URL = ${JSON.stringify(normalizedApiBaseUrl)};\n`,
  "utf-8",
);

console.log(`Wrote frontend/config.js for ${normalizedApiBaseUrl}`);

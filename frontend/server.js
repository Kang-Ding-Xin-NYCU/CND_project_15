const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const path = require("node:path");
const { URL } = require("node:url");

const HTTPS_ENABLED = process.env.HTTPS === "true";
const PORT = Number(process.env.PORT || process.env.FRONTEND_PORT || (HTTPS_ENABLED ? 8443 : 8080));
const API_BASE_URL = process.env.API_BASE_URL || (HTTPS_ENABLED ? "https://localhost:3443" : "http://localhost:3000");
const STATIC_ROOT = __dirname;
const TLS_CERT_FILE = process.env.TLS_CERT_FILE || "";
const TLS_KEY_FILE = process.env.TLS_KEY_FILE || "";

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8"
};

function sendConfig(res) {
  res.writeHead(200, {
    "Content-Type": "application/javascript; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(`window.LIMS_API_BASE_URL = ${JSON.stringify(API_BASE_URL)};\n`);
}

function sendStatic(res, pathname) {
  const normalizedPath = pathname === "/" ? "/index.html" : pathname;
  const resolvedPath = path.resolve(STATIC_ROOT, `.${decodeURIComponent(normalizedPath)}`);

  if (!resolvedPath.startsWith(STATIC_ROOT)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  if (!fs.existsSync(resolvedPath) || fs.statSync(resolvedPath).isDirectory()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  res.writeHead(200, {
    "Content-Type": contentTypes[path.extname(resolvedPath)] || "application/octet-stream",
    "Cache-Control": "no-store"
  });
  fs.createReadStream(resolvedPath).pipe(res);
}

function loadTlsOptions() {
  if (!TLS_KEY_FILE || !TLS_CERT_FILE) {
    throw new Error("HTTPS requires TLS_KEY_FILE and TLS_CERT_FILE");
  }
  return {
    key: fs.readFileSync(TLS_KEY_FILE),
    cert: fs.readFileSync(TLS_CERT_FILE)
  };
}

function requestHandler(req, res) {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/config.js") {
    sendConfig(res);
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Method not allowed");
    return;
  }
  sendStatic(res, url.pathname);
}

const server = HTTPS_ENABLED
  ? https.createServer(loadTlsOptions(), requestHandler)
  : http.createServer(requestHandler);

server.listen(PORT, () => {
  const protocol = HTTPS_ENABLED ? "https" : "http";
  console.log(`Cloud LIMS frontend listening on ${protocol}://localhost:${PORT}/`);
  console.log(`Frontend API base URL: ${API_BASE_URL}`);
});

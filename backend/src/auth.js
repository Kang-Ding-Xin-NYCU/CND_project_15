const crypto = require("node:crypto");
const { JWT_SECRET } = require("./config");

const TOKEN_TTL_SECONDS = 60 * 60 * 8;

function base64Url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function decodeBase64Url(input) {
  const normalized = input.replaceAll("-", "+").replaceAll("_", "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(String(password), String(salt), 120_000, 32, "sha256").toString("hex");
}

function verifyPassword(password, user) {
  return crypto.timingSafeEqual(
    Buffer.from(hashPassword(password, user.passwordSalt), "hex"),
    Buffer.from(user.passwordHash, "hex")
  );
}

function signJwt(payload, options = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const body = {
    iat: now,
    exp: now + (options.ttlSeconds || TOKEN_TTL_SECONDS),
    jti: crypto.randomUUID(),
    ...payload
  };
  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedBody = base64Url(JSON.stringify(body));
  const signature = crypto
    .createHmac("sha256", options.secret || JWT_SECRET)
    .update(`${encodedHeader}.${encodedBody}`)
    .digest("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");

  return {
    token: `${encodedHeader}.${encodedBody}.${signature}`,
    payload: body
  };
}

function verifyJwt(token, options = {}) {
  const [encodedHeader, encodedBody, signature] = String(token || "").split(".");
  if (!encodedHeader || !encodedBody || !signature) {
    const error = new Error("Invalid token");
    error.statusCode = 401;
    throw error;
  }

  const expectedSignature = crypto
    .createHmac("sha256", options.secret || JWT_SECRET)
    .update(`${encodedHeader}.${encodedBody}`)
    .digest("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    const error = new Error("Invalid token signature");
    error.statusCode = 401;
    throw error;
  }

  const payload = JSON.parse(decodeBase64Url(encodedBody));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    const error = new Error("Token expired");
    error.statusCode = 401;
    throw error;
  }
  return payload;
}

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : "";
}

async function authenticateRequest(req, cache) {
  const token = getBearerToken(req);
  if (!token) {
    const error = new Error("Missing bearer token");
    error.statusCode = 401;
    throw error;
  }

  const payload = verifyJwt(token);
  if (cache?.enabled) {
    const session = await cache.getJson(`session:${payload.jti}`);
    if (session === null) {
      const error = new Error("Session expired or revoked");
      error.statusCode = 401;
      throw error;
    }
  }
  return payload;
}

module.exports = {
  TOKEN_TTL_SECONDS,
  authenticateRequest,
  hashPassword,
  signJwt,
  verifyJwt,
  verifyPassword
};

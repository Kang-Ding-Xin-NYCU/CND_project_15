const net = require("node:net");

function parseRedisUrl(redisUrl) {
  const url = new URL(redisUrl);
  return {
    host: url.hostname || "127.0.0.1",
    port: Number(url.port || 6379)
  };
}

function encodeCommand(parts) {
  return `*${parts.length}\r\n${parts.map((part) => {
    const value = String(part);
    return `$${Buffer.byteLength(value)}\r\n${value}\r\n`;
  }).join("")}`;
}

function decodeSimpleResponse(raw) {
  if (raw.startsWith("$-1")) return null;
  if (raw.startsWith("$")) {
    const [, rest] = raw.split("\r\n", 2);
    return rest;
  }
  if (raw.startsWith("+")) return raw.slice(1).split("\r\n")[0];
  if (raw.startsWith(":")) return Number(raw.slice(1).split("\r\n")[0]);
  if (raw.startsWith("-")) {
    throw new Error(raw.slice(1).split("\r\n")[0]);
  }
  return raw;
}

function sendRedisCommand(connection, parts) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(connection);
    let raw = "";
    socket.setTimeout(1200);
    socket.on("connect", () => socket.write(encodeCommand(parts)));
    socket.on("data", (chunk) => {
      raw += chunk.toString("utf8");
      socket.end();
    });
    socket.on("end", () => {
      try {
        resolve(decodeSimpleResponse(raw));
      } catch (error) {
        reject(error);
      }
    });
    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error("Redis command timeout"));
    });
    socket.on("error", reject);
  });
}

function createNoopCache() {
  return {
    enabled: false,
    async getJson() {
      return null;
    },
    async setJson() {},
    async del() {},
    async ping() {
      return false;
    }
  };
}

function createRedisCache(redisUrl) {
  if (!redisUrl) return createNoopCache();
  const connection = parseRedisUrl(redisUrl);

  return {
    enabled: true,
    async getJson(key) {
      try {
        const value = await sendRedisCommand(connection, ["GET", key]);
        return value ? JSON.parse(value) : null;
      } catch (error) {
        console.warn(`Redis GET failed for ${key}: ${error.message}`);
        return undefined;
      }
    },
    async setJson(key, value, ttlSeconds = 60) {
      try {
        await sendRedisCommand(connection, ["SETEX", key, ttlSeconds, JSON.stringify(value)]);
      } catch (error) {
        console.warn(`Redis SETEX failed for ${key}: ${error.message}`);
      }
    },
    async del(...keys) {
      try {
        if (keys.length) await sendRedisCommand(connection, ["DEL", ...keys]);
      } catch (error) {
        console.warn(`Redis DEL failed: ${error.message}`);
      }
    },
    async ping() {
      return (await sendRedisCommand(connection, ["PING"])) === "PONG";
    }
  };
}

module.exports = {
  createRedisCache
};

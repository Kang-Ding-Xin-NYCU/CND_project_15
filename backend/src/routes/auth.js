const { TOKEN_TTL_SECONDS, signJwt, verifyPassword } = require("../auth");
const { addAudit } = require("../domain");
const { parseJsonBody, requireFields, sendJson } = require("../http-utils");

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    department: user.department,
    site: user.site
  };
}

async function handleAuthRoutes(req, res, pathname, store) {
  if (req.method === "POST" && pathname === "/api/auth/login") {
    const body = await parseJsonBody(req);
    requireFields(body, ["username", "password"]);
    const state = await store.read();
    const user = state.users.find((item) => item.username === body.username);
    if (!user || !verifyPassword(body.password, user)) {
      sendJson(res, 401, { error: "Invalid username or password" });
      return true;
    }

    const safeUser = publicUser(user);
    const { token, payload } = signJwt({
      sub: user.id,
      username: user.username,
      name: user.name,
      role: user.role
    });
    if (store.cache?.enabled) {
      await store.cache.setJson(`session:${payload.jti}`, safeUser, TOKEN_TTL_SECONDS);
    }
    await store.update((currentState) => {
      addAudit(currentState, `${user.name} 已登入`, user.name);
    });
    sendJson(res, 200, {
      token,
      user: safeUser,
      expiresAt: payload.exp
    });
    return true;
  }

  if (req.method === "GET" && pathname === "/api/auth/me") {
    sendJson(res, 200, { user: req.user });
    return true;
  }

  if (req.method === "POST" && pathname === "/api/auth/logout") {
    if (store.cache?.enabled) await store.cache.del(`session:${req.user.jti}`);
    sendJson(res, 200, { message: "Logged out" });
    return true;
  }

  return false;
}

module.exports = {
  handleAuthRoutes
};

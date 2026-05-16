const assert = require("node:assert/strict");
const { Writable } = require("node:stream");
const test = require("node:test");

process.env.HTTPS = "false";
process.env.API_BASE_URL = "https://backend.example.test";

const { requestHandler } = require("../server");

class MockResponse extends Writable {
  constructor(resolve) {
    super();
    this.statusCode = 200;
    this.headers = {};
    this.chunks = [];
    this.on("finish", () => resolve(this));
  }

  writeHead(statusCode, headers = {}) {
    this.statusCode = statusCode;
    this.headers = Object.fromEntries(
      Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
    );
  }

  _write(chunk, _encoding, callback) {
    this.chunks.push(Buffer.from(chunk));
    callback();
  }

  end(chunk) {
    if (chunk) {
      this.chunks.push(Buffer.from(chunk));
    }
    super.end();
  }

  text() {
    return Buffer.concat(this.chunks).toString("utf8");
  }

  header(name) {
    return this.headers[name.toLowerCase()];
  }
}

function dispatch(method, url) {
  return new Promise((resolve, reject) => {
    const response = new MockResponse(resolve);
    response.on("error", reject);
    requestHandler({ method, url }, response);
  });
}

test("frontend server serves index, assets, and runtime config", async () => {
  const root = await dispatch("GET", "/");
  assert.equal(root.statusCode, 200);
  assert.match(root.header("content-type"), /text\/html/);
  assert.match(root.text(), /Cloud-Native LIMS Prototype/);

  const styles = await dispatch("GET", "/styles.css");
  assert.equal(styles.statusCode, 200);
  assert.match(styles.header("content-type"), /text\/css/);
  assert.match(styles.text(), /\.app-shell/);

  const app = await dispatch("GET", "/app.js?cache-bust=1");
  assert.equal(app.statusCode, 200);
  assert.match(app.header("content-type"), /application\/javascript/);
  assert.match(app.text(), /function renderAll/);

  const config = await dispatch("GET", "/config.js");
  assert.equal(config.statusCode, 200);
  assert.match(config.header("content-type"), /application\/javascript/);
  assert.equal(config.header("cache-control"), "no-store");
  assert.equal(config.text(), 'window.LIMS_API_BASE_URL = "https://backend.example.test";\n');
});

test("frontend server rejects unsupported and unsafe requests", async () => {
  const missing = await dispatch("GET", "/missing.js");
  assert.equal(missing.statusCode, 404);
  assert.equal(missing.text(), "Not found");

  const post = await dispatch("POST", "/");
  assert.equal(post.statusCode, 405);
  assert.equal(post.text(), "Method not allowed");

  const configPost = await dispatch("POST", "/config.js");
  assert.equal(configPost.statusCode, 405);
  assert.equal(configPost.text(), "Method not allowed");

  const directory = await dispatch("GET", "/tests");
  assert.equal(directory.statusCode, 404);
  assert.equal(directory.text(), "Not found");

  const traversal = await dispatch("GET", "/..%2FREADME.md");
  assert.equal(traversal.statusCode, 403);
  assert.equal(traversal.text(), "Forbidden");
});

const fs = require("node:fs");
const path = require("node:path");
const { MONGO_DB_NAME } = require("./config");
const { createInitialState } = require("./seed");

const CACHE_KEYS = ["state", "dashboard"];

function ensureDataFile(dataFile) {
  if (fs.existsSync(dataFile)) return;
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  fs.writeFileSync(dataFile, `${JSON.stringify(createInitialState(), null, 2)}\n`);
}

async function invalidateCache(cache) {
  if (cache?.enabled) await cache.del(...CACHE_KEYS);
}

function createJsonStore(dataFile, cache) {
  return {
    driver: "json",
    cache,
    async read() {
      ensureDataFile(dataFile);
      return JSON.parse(fs.readFileSync(dataFile, "utf8"));
    },
    async write(state) {
      fs.mkdirSync(path.dirname(dataFile), { recursive: true });
      fs.writeFileSync(dataFile, `${JSON.stringify(state, null, 2)}\n`);
      await invalidateCache(cache);
    },
    async update(mutator) {
      const state = await this.read();
      const result = mutator(state) || {};
      await this.write(state);
      return { state, ...result };
    },
    async reset() {
      const state = createInitialState();
      await this.write(state);
      return state;
    }
  };
}

function createMongoStore(mongoUrl, cache, options = {}) {
  let client;
  let collection;

  async function connectWithRetry(MongoClient) {
    let lastError;
    for (let attempt = 1; attempt <= 8; attempt += 1) {
      try {
        const nextClient = new MongoClient(mongoUrl);
        await nextClient.connect();
        return nextClient;
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, attempt * 250));
      }
    }
    throw lastError;
  }

  async function getCollection() {
    if (collection) return collection;
    let MongoClient;
    try {
      ({ MongoClient } = require("mongodb"));
    } catch (error) {
      error.message = "MongoDB driver is not installed. Run `npm --prefix backend install` or use Docker Compose.";
      throw error;
    }
    client = await connectWithRetry(MongoClient);
    const db = client.db(options.dbName || MONGO_DB_NAME);
    collection = db.collection("app_state");
    const existing = await collection.findOne({ _id: "lims-state" });
    if (!existing) {
      await collection.insertOne({
        _id: "lims-state",
        state: createInitialState(),
        updatedAt: new Date()
      });
    }
    return collection;
  }

  return {
    driver: "mongodb",
    cache,
    async read() {
      const stateCollection = await getCollection();
      const document = await stateCollection.findOne({ _id: "lims-state" });
      return document?.state || createInitialState();
    },
    async write(state) {
      const stateCollection = await getCollection();
      await stateCollection.updateOne(
        { _id: "lims-state" },
        { $set: { state, updatedAt: new Date() } },
        { upsert: true }
      );
      await invalidateCache(cache);
    },
    async update(mutator) {
      const state = await this.read();
      const result = mutator(state) || {};
      await this.write(state);
      return { state, ...result };
    },
    async reset() {
      const state = createInitialState();
      await this.write(state);
      return state;
    },
    async close() {
      if (client) await client.close();
    }
  };
}

function createStore(dataFile, options = {}) {
  if (options.mongoUrl) {
    return createMongoStore(options.mongoUrl, options.cache, { dbName: options.dbName });
  }
  return createJsonStore(dataFile, options.cache);
}

module.exports = {
  createStore
};

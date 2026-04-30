import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ServerAdapterModule } from "../adapters/index.js";
import {
  registerServerAdapter,
  unregisterServerAdapter,
} from "../adapters/index.js";
import { adapterRoutes } from "../routes/adapters.js";
import { errorHandler } from "../middleware/index.js";

const testAdapterType = "test_plugin_lifecycle";

const stubAdapter: ServerAdapterModule = {
  type: testAdapterType,
  execute: async () => ({ exitCode: 0, signal: null, timedOut: false }),
  testEnvironment: async () => ({
    adapterType: testAdapterType,
    status: "pass",
    checks: [],
    testedAt: new Date(0).toISOString(),
  }),
  models: [],
  sessionCodec: {
    encode: async (cmd: string) => cmd,
    decode: async (chunk: string) => chunk,
  },
};

function createBoardApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.actor = {
      type: "board",
      userId: "board-user",
      source: "local_implicit",
      isInstanceAdmin: true,
      companyIds: [],
    };
    next();
  });
  app.use("/api", adapterRoutes());
  app.use(errorHandler);
  return app;
}

function createAgentApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.actor = {
      type: "agent",
      agentId: "agent-1",
      companyId: "c1",
      source: "agent_key",
    };
    next();
  });
  app.use("/api", adapterRoutes());
  app.use(errorHandler);
  return app;
}

describe("plugin lifecycle integration", () => {
  beforeEach(() => {
    registerServerAdapter(stubAdapter);
  });

  afterEach(() => {
    unregisterServerAdapter(testAdapterType);
  });

  it("board can list registered adapters", async () => {
    const app = createBoardApp();
    const res = await request(app).get("/api/adapters");

    expect(res.status).toBe(200);
    const types = res.body.map((a: { type: string }) => a.type);
    expect(types).toContain(testAdapterType);
  });

  it("board can retrieve config-schema for an adapter that provides one", async () => {
    const schemaAdapter: ServerAdapterModule = {
      ...stubAdapter,
      getConfigSchema: async () => ({
        version: 1,
        fields: [{ key: "apiKey", type: "text", label: "API Key" }],
      }),
    };
    registerServerAdapter(schemaAdapter);

    const app = createBoardApp();
    const res = await request(app).get(
      `/api/adapters/${testAdapterType}/config-schema`,
    );

    expect(res.status).toBe(200);
    expect(res.body.fields).toEqual([
      { key: "apiKey", type: "text", label: "API Key" },
    ]);

    unregisterServerAdapter(testAdapterType);
  });

  it("board can unregister an adapter (simulating plugin removal)", async () => {
    const app = createBoardApp();

    const before = await request(app).get("/api/adapters");
    expect(before.status).toBe(200);
    const typesBefore = before.body.map((a: { type: string }) => a.type);
    expect(typesBefore).toContain(testAdapterType);

    unregisterServerAdapter(testAdapterType);

    const after = await request(app).get("/api/adapters");
    expect(after.status).toBe(200);
    const typesAfter = after.body.map((a: { type: string }) => a.type);
    expect(typesAfter).not.toContain(testAdapterType);
  });

  it("returns 404 config-schema for unregistered adapter", async () => {
    unregisterServerAdapter(testAdapterType);

    const app = createBoardApp();
    const res = await request(app).get(
      `/api/adapters/${testAdapterType}/config-schema`,
    );

    expect(res.status).toBe(404);
  });

  it("rejects adapter list from agent actor", async () => {
    const app = createAgentApp();
    const res = await request(app).get("/api/adapters");
    expect(res.status).toBe(403);
  });

  it("rejects adapter install from agent actor", async () => {
    const app = createAgentApp();
    const res = await request(app).post("/api/adapters/install").send({
      packageName: "test-adapter-plugin",
    });
    expect(res.status).toBe(403);
  });

  it("rejects adapter delete from agent actor", async () => {
    const app = createAgentApp();
    const res = await request(app).delete(`/api/adapters/${testAdapterType}`);
    expect(res.status).toBe(403);
  });
});

import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { pluginRoutes } from "../routes/plugins.js";
import { errorHandler } from "../middleware/error-handler.js";

function createApp() {
  const app = express();
  app.use(express.json());
  // biome-ignore lint/suspicious/noExplicitAny: existing code, suppress for CI promotion
  app.use("/api", pluginRoutes({} as any, {} as any));
  app.use(errorHandler);
  return app;
}

function expectValidationError(res: request.Response) {
  expect(res.status).toBe(400);
  expect(res.body.error).toBe("Validation error");
}

describe("plugin route validation", () => {
  it("rejects invalid plugin install request bodies", async () => {
    const res = await request(createApp())
      .post("/api/plugins/install")
      .send({ packageName: "bad<name" });

    expectValidationError(res);
    expect(res.body.details[0].path).toEqual(["packageName"]);
  });

  it("rejects invalid plugin tool execute request bodies", async () => {
    const res = await request(createApp())
      .post("/api/plugins/tools/execute")
      .send({
        tool: "demo.tool",
        runContext: {
          agentId: "agent-1",
        },
      });

    expectValidationError(res);
    expect(
      res.body.details.some((issue: { path: string[] }) => issue.path.join(".") === "runContext.runId"),
    ).toBe(true);
  });

  it("rejects invalid bridge request bodies before bridge deps are required", async () => {
    const res = await request(createApp())
      .post("/api/plugins/plugin-1/bridge/data")
      .send({ params: { q: "test" } });

    expectValidationError(res);
    expect(res.body.details[0].path).toEqual(["key"]);
  });

  it("rejects invalid plugin config request bodies", async () => {
    const res = await request(createApp())
      .post("/api/plugins/plugin-1/config")
      .send({ configJson: "not-an-object" });

    expectValidationError(res);
    expect(res.body.details[0].path).toEqual(["configJson"]);
  });

  it("rejects invalid plugin upgrade request bodies", async () => {
    const res = await request(createApp())
      .post("/api/plugins/plugin-1/upgrade")
      .send({ version: "   " });

    expectValidationError(res);
    expect(res.body.details[0].path).toEqual(["version"]);
  });

  it("rejects invalid plugin disable request bodies", async () => {
    const res = await request(createApp())
      .post("/api/plugins/plugin-1/disable")
      .send({ reason: "   " });

    expectValidationError(res);
    expect(res.body.details[0].path).toEqual(["reason"]);
  });

  it("rejects invalid plugin jobs query strings", async () => {
    const invalidJobsStatus = await request(createApp()).get("/api/plugins/plugin-1/jobs?status=done");
    expectValidationError(invalidJobsStatus);
    expect(invalidJobsStatus.body.details[0].path).toEqual(["status"]);

    const invalidJobLimit = await request(createApp()).get("/api/plugins/plugin-1/jobs/job-1/runs?limit=0");
    expectValidationError(invalidJobLimit);
    expect(invalidJobLimit.body.details[0].path).toEqual(["limit"]);
  });

  it("rejects invalid plugin route query and params", async () => {
    const invalidStatus = await request(createApp()).get("/api/plugins?status=bogus");
    expect(invalidStatus.status).toBe(400);

    const invalidPluginId = await request(createApp()).post("/api/plugins/%20/enable").send({});
    expect(invalidPluginId.status).toBe(400);
  });
});

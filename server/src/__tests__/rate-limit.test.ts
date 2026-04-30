import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import {
  createApiRateLimiter,
  createAuthSensitiveRateLimiter,
  isAuthSensitiveRateLimitRoute,
  RATE_LIMIT_ERROR_MESSAGE,
} from "../middleware/rate-limit.js";

function createTestApp(opts: { apiLimit?: number; authLimit?: number } = {}) {
  const app = express();
  app.use(express.json());
  app.use("/api", createApiRateLimiter({ windowMs: 60_000, limit: opts.apiLimit ?? 20 }));
  app.use(createAuthSensitiveRateLimiter({ windowMs: 60_000, limit: opts.authLimit ?? 20 }));

  app.get("/api/projects", (_req, res) => {
    res.status(200).json({ ok: true });
  });
  app.post("/api/auth/sign-in/email", (_req, res) => {
    res.status(200).json({ ok: true });
  });
  app.get("/api/auth/get-session", (_req, res) => {
    res.status(200).json({ session: null });
  });
  app.post("/api/cli-auth/challenges", (_req, res) => {
    res.status(201).json({ ok: true });
  });
  app.get("/api/cli-auth/challenges/challenge-1", (_req, res) => {
    res.status(200).json({ status: "pending" });
  });

  return app;
}

describe("rate limit middleware", () => {
  it("applies the default API limit to API routes", async () => {
    const app = createTestApp({ apiLimit: 2, authLimit: 20 });

    expect((await request(app).get("/api/projects")).status).toBe(200);
    expect((await request(app).get("/api/projects")).status).toBe(200);

    const limited = await request(app).get("/api/projects");
    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({ error: RATE_LIMIT_ERROR_MESSAGE });
    expect(limited.headers.ratelimit).toBeDefined();
    expect(limited.headers["x-ratelimit-limit"]).toBeUndefined();
  });

  it("uses the stricter limit for auth-sensitive requests", async () => {
    const app = createTestApp({ apiLimit: 20, authLimit: 2 });

    expect((await request(app).post("/api/auth/sign-in/email").send({})).status).toBe(200);
    expect((await request(app).post("/api/auth/sign-in/email").send({})).status).toBe(200);

    const limited = await request(app).post("/api/auth/sign-in/email").send({});
    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({ error: RATE_LIMIT_ERROR_MESSAGE });
  });

  it("does not apply the stricter limit to session checks or CLI auth polling", async () => {
    const app = createTestApp({ apiLimit: 20, authLimit: 2 });

    for (let i = 0; i < 3; i += 1) {
      expect((await request(app).get("/api/auth/get-session")).status).toBe(200);
      expect(
        (await request(app).get("/api/cli-auth/challenges/challenge-1?token=secret")).status,
      ).toBe(200);
    }
  });

  it("matches only credential and claim endpoints for the stricter limiter", () => {
    expect(
      isAuthSensitiveRateLimitRoute({ method: "POST", path: "/api/auth/sign-in/email" }),
    ).toBe(true);
    expect(
      isAuthSensitiveRateLimitRoute({ method: "POST", path: "/api/cli-auth/challenges" }),
    ).toBe(true);
    expect(
      isAuthSensitiveRateLimitRoute({ method: "POST", path: "/api/invites/token/accept" }),
    ).toBe(true);
    expect(isAuthSensitiveRateLimitRoute({ method: "GET", path: "/api/auth/get-session" })).toBe(false);
    expect(
      isAuthSensitiveRateLimitRoute({ method: "GET", path: "/api/cli-auth/challenges/challenge-1" }),
    ).toBe(false);
  });
});

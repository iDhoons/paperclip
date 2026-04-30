import type { Request, RequestHandler } from "express";
import rateLimit, { type Options } from "express-rate-limit";

export const API_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const API_RATE_LIMIT_LIMIT = 100;
export const AUTH_SENSITIVE_RATE_LIMIT_LIMIT = 10;
export const RATE_LIMIT_ERROR_MESSAGE = "Too many requests. Please retry later.";

type RateLimitOverrides = Partial<Options>;

type AuthSensitiveRoute = {
  method: "GET" | "POST";
  path: RegExp;
};

export const AUTH_SENSITIVE_RATE_LIMIT_ROUTES: AuthSensitiveRoute[] = [
  {
    method: "POST",
    path: /^\/api\/auth\/(?:sign-in|sign-up|forget-password|reset-password|verify-email|email-otp|two-factor)(?:\/|$)/,
  },
  { method: "GET", path: /^\/api\/board-claim\/[^/]+$/ },
  { method: "POST", path: /^\/api\/board-claim\/[^/]+\/claim$/ },
  { method: "POST", path: /^\/api\/cli-auth\/challenges$/ },
  { method: "POST", path: /^\/api\/cli-auth\/challenges\/[^/]+\/approve$/ },
  { method: "POST", path: /^\/api\/invites\/[^/]+\/accept$/ },
  { method: "POST", path: /^\/api\/join-requests\/[^/]+\/claim-api-key$/ },
];

function buildRateLimiter(input: {
  identifier: string;
  limit: number;
  windowMs: number;
  overrides?: RateLimitOverrides;
}): RequestHandler {
  return rateLimit({
    windowMs: input.windowMs,
    limit: input.limit,
    identifier: input.identifier,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ error: RATE_LIMIT_ERROR_MESSAGE });
    },
    ...input.overrides,
  });
}

export function createApiRateLimiter(overrides: RateLimitOverrides = {}): RequestHandler {
  return buildRateLimiter({
    identifier: "api",
    limit: API_RATE_LIMIT_LIMIT,
    windowMs: API_RATE_LIMIT_WINDOW_MS,
    overrides,
  });
}

export function isAuthSensitiveRateLimitRoute(req: Pick<Request, "method" | "path">): boolean {
  const method = req.method.toUpperCase();
  return AUTH_SENSITIVE_RATE_LIMIT_ROUTES.some(
    (route) => route.method === method && route.path.test(req.path),
  );
}

export function createAuthSensitiveRateLimiter(overrides: RateLimitOverrides = {}): RequestHandler {
  const limiter = buildRateLimiter({
    identifier: "auth-sensitive",
    limit: AUTH_SENSITIVE_RATE_LIMIT_LIMIT,
    windowMs: API_RATE_LIMIT_WINDOW_MS,
    overrides,
  });

  return (req, res, next) => {
    if (!isAuthSensitiveRateLimitRoute(req)) {
      next();
      return;
    }
    limiter(req, res, next);
  };
}

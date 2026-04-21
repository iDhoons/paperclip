import { afterEach, describe, expect, it } from "vitest";
import { buildPaperclipEnv } from "../adapters/utils.js";
import { sanitizeInheritedAgentRuntimeEnv } from "../paperclip-runtime-env.js";

const ORIGINAL_PAPERCLIP_API_URL = process.env.PAPERCLIP_API_URL;
const ORIGINAL_PAPERCLIP_LISTEN_HOST = process.env.PAPERCLIP_LISTEN_HOST;
const ORIGINAL_PAPERCLIP_LISTEN_PORT = process.env.PAPERCLIP_LISTEN_PORT;
const ORIGINAL_HOST = process.env.HOST;
const ORIGINAL_PORT = process.env.PORT;

afterEach(() => {
  if (ORIGINAL_PAPERCLIP_API_URL === undefined) delete process.env.PAPERCLIP_API_URL;
  else process.env.PAPERCLIP_API_URL = ORIGINAL_PAPERCLIP_API_URL;

  if (ORIGINAL_PAPERCLIP_LISTEN_HOST === undefined) delete process.env.PAPERCLIP_LISTEN_HOST;
  else process.env.PAPERCLIP_LISTEN_HOST = ORIGINAL_PAPERCLIP_LISTEN_HOST;

  if (ORIGINAL_PAPERCLIP_LISTEN_PORT === undefined) delete process.env.PAPERCLIP_LISTEN_PORT;
  else process.env.PAPERCLIP_LISTEN_PORT = ORIGINAL_PAPERCLIP_LISTEN_PORT;

  if (ORIGINAL_HOST === undefined) delete process.env.HOST;
  else process.env.HOST = ORIGINAL_HOST;

  if (ORIGINAL_PORT === undefined) delete process.env.PORT;
  else process.env.PORT = ORIGINAL_PORT;
});

describe("buildPaperclipEnv", () => {
  it("prefers an explicit PAPERCLIP_API_URL", () => {
    process.env.PAPERCLIP_API_URL = "http://localhost:4100";
    process.env.PAPERCLIP_LISTEN_HOST = "127.0.0.1";
    process.env.PAPERCLIP_LISTEN_PORT = "3101";

    const env = buildPaperclipEnv({ id: "agent-1", companyId: "company-1" });

    expect(env.PAPERCLIP_API_URL).toBe("http://localhost:4100");
  });

  it("uses runtime listen host/port when explicit URL is not set", () => {
    delete process.env.PAPERCLIP_API_URL;
    process.env.PAPERCLIP_LISTEN_HOST = "0.0.0.0";
    process.env.PAPERCLIP_LISTEN_PORT = "3101";
    process.env.PORT = "3100";

    const env = buildPaperclipEnv({ id: "agent-1", companyId: "company-1" });

    expect(env.PAPERCLIP_API_URL).toBe("http://localhost:3101");
  });

  it("formats IPv6 hosts safely in fallback URL generation", () => {
    delete process.env.PAPERCLIP_API_URL;
    process.env.PAPERCLIP_LISTEN_HOST = "::1";
    process.env.PAPERCLIP_LISTEN_PORT = "3101";

    const env = buildPaperclipEnv({ id: "agent-1", companyId: "company-1" });

    expect(env.PAPERCLIP_API_URL).toBe("http://[::1]:3101");
  });
});

describe("sanitizeInheritedAgentRuntimeEnv", () => {
  it("removes inherited agent heartbeat env without touching server config env", () => {
    const env: NodeJS.ProcessEnv = {
      PAPERCLIP_AGENT_ID: "agent-1",
      PAPERCLIP_COMPANY_ID: "company-1",
      PAPERCLIP_API_KEY: "token",
      PAPERCLIP_API_URL: "http://localhost:3100",
      PAPERCLIP_RUN_ID: "run-1",
      PAPERCLIP_WORKSPACE_CWD: "/tmp/workspace",
      PAPERCLIP_LISTEN_HOST: "127.0.0.1",
      PAPERCLIP_LISTEN_PORT: "3100",
      PAPERCLIP_MIGRATION_AUTO_APPLY: "true",
      HOST: "127.0.0.1",
      PORT: "3100",
    };

    sanitizeInheritedAgentRuntimeEnv(env);

    expect(env.PAPERCLIP_AGENT_ID).toBeUndefined();
    expect(env.PAPERCLIP_COMPANY_ID).toBeUndefined();
    expect(env.PAPERCLIP_API_KEY).toBeUndefined();
    expect(env.PAPERCLIP_API_URL).toBeUndefined();
    expect(env.PAPERCLIP_RUN_ID).toBeUndefined();
    expect(env.PAPERCLIP_WORKSPACE_CWD).toBeUndefined();
    expect(env.PAPERCLIP_LISTEN_HOST).toBe("127.0.0.1");
    expect(env.PAPERCLIP_LISTEN_PORT).toBe("3100");
    expect(env.PAPERCLIP_MIGRATION_AUTO_APPLY).toBe("true");
    expect(env.HOST).toBe("127.0.0.1");
    expect(env.PORT).toBe("3100");
  });
});

import { describe, expect, it } from "vitest";
import {
  jsonSchemaSchema,
  pluginJobDeclarationSchema,
  pluginWebhookDeclarationSchema,
  pluginToolDeclarationSchema,
  pluginUiSlotDeclarationSchema,
  pluginLauncherActionDeclarationSchema,
  pluginLauncherRenderDeclarationSchema,
  pluginLauncherDeclarationSchema,
  pluginManifestV1Schema,
  installPluginSchema,
  pluginIdParamsSchema,
  pluginKeyParamsSchema,
  pluginStreamParamsSchema,
  pluginJobParamsSchema,
  pluginWebhookParamsSchema,
  listPluginsQuerySchema,
  listPluginToolsQuerySchema,
  pluginLogsQuerySchema,
  listPluginJobsQuerySchema,
  listPluginJobRunsQuerySchema,
  pluginInstallRequestSchema,
  pluginToolRunContextSchema,
  pluginToolExecuteRequestSchema,
  pluginBridgeDataRequestSchema,
  pluginBridgeActionRequestSchema,
  pluginDisableRequestSchema,
  pluginUpgradeRequestSchema,
  upsertPluginConfigSchema,
  patchPluginConfigSchema,
  updatePluginStatusSchema,
  uninstallPluginSchema,
  pluginStateScopeKeySchema,
  setPluginStateSchema,
  listPluginStateSchema,
} from "../plugin.js";

// ---------------------------------------------------------------------------
// jsonSchemaSchema
// ---------------------------------------------------------------------------
describe("jsonSchemaSchema", () => {
  it("accepts empty object", () => {
    const result = jsonSchemaSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts object with type", () => {
    const result = jsonSchemaSchema.safeParse({ type: "string" });
    expect(result.success).toBe(true);
  });

  it("accepts object with $ref", () => {
    const result = jsonSchemaSchema.safeParse({ $ref: "#/definitions/Foo" });
    expect(result.success).toBe(true);
  });

  it("accepts object with oneOf", () => {
    const result = jsonSchemaSchema.safeParse({ oneOf: [] });
    expect(result.success).toBe(true);
  });

  it("accepts object with anyOf", () => {
    const result = jsonSchemaSchema.safeParse({ anyOf: [] });
    expect(result.success).toBe(true);
  });

  it("accepts object with allOf", () => {
    const result = jsonSchemaSchema.safeParse({ allOf: [] });
    expect(result.success).toBe(true);
  });

  it("rejects object without recognized keys", () => {
    const result = jsonSchemaSchema.safeParse({ unknown: "value" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// pluginJobDeclarationSchema
// ---------------------------------------------------------------------------
describe("pluginJobDeclarationSchema", () => {
  it("accepts a minimal valid job", () => {
    const result = pluginJobDeclarationSchema.safeParse({
      jobKey: "daily-sync",
      displayName: "Daily Sync",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a job with schedule", () => {
    const result = pluginJobDeclarationSchema.safeParse({
      jobKey: "daily-sync",
      displayName: "Daily Sync",
      schedule: "*/15 * * * *",
    });
    expect(result.success).toBe(true);
  });

  it("accepts common cron expressions", () => {
    const cronExpressions = [
      "0 9 * * *",
      "30 */2 * * *",
      "0 0 1 1 *",
      "0,30 9-17 * * 1-5",
    ];
    for (const schedule of cronExpressions) {
      const result = pluginJobDeclarationSchema.safeParse({
        jobKey: "test",
        displayName: "Test",
        schedule,
      });
      expect(result.success, `Expected "${schedule}" to be valid`).toBe(true);
    }
  });

  it("rejects empty jobKey", () => {
    const result = pluginJobDeclarationSchema.safeParse({
      jobKey: "",
      displayName: "Test",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty displayName", () => {
    const result = pluginJobDeclarationSchema.safeParse({
      jobKey: "test",
      displayName: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid cron (4 fields)", () => {
    const result = pluginJobDeclarationSchema.safeParse({
      jobKey: "test",
      displayName: "Test",
      schedule: "* * * *",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid cron (6 fields)", () => {
    const result = pluginJobDeclarationSchema.safeParse({
      jobKey: "test",
      displayName: "Test",
      schedule: "* * * * * *",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// pluginWebhookDeclarationSchema
// ---------------------------------------------------------------------------
describe("pluginWebhookDeclarationSchema", () => {
  it("accepts a valid webhook", () => {
    const result = pluginWebhookDeclarationSchema.safeParse({
      endpointKey: "github-push",
      displayName: "GitHub Push",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty endpointKey", () => {
    const result = pluginWebhookDeclarationSchema.safeParse({
      endpointKey: "",
      displayName: "Test",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty displayName", () => {
    const result = pluginWebhookDeclarationSchema.safeParse({
      endpointKey: "test",
      displayName: "",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// pluginToolDeclarationSchema
// ---------------------------------------------------------------------------
describe("pluginToolDeclarationSchema", () => {
  it("accepts a valid tool", () => {
    const result = pluginToolDeclarationSchema.safeParse({
      name: "search",
      displayName: "Search",
      description: "Search documents",
      parametersSchema: { type: "object", properties: {} },
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = pluginToolDeclarationSchema.safeParse({
      name: "",
      displayName: "Search",
      description: "Search documents",
      parametersSchema: {},
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty description", () => {
    const result = pluginToolDeclarationSchema.safeParse({
      name: "search",
      displayName: "Search",
      description: "",
      parametersSchema: {},
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// pluginUiSlotDeclarationSchema
// ---------------------------------------------------------------------------
describe("pluginUiSlotDeclarationSchema", () => {
  const validSlot = {
    type: "page" as const,
    id: "main-page",
    displayName: "Main Page",
    exportName: "MainPage",
    routePath: "my-plugin",
  };

  it("accepts a valid page slot", () => {
    const result = pluginUiSlotDeclarationSchema.safeParse(validSlot);
    expect(result.success).toBe(true);
  });

  it("accepts slot without routePath", () => {
    const result = pluginUiSlotDeclarationSchema.safeParse({
      type: "sidebar",
      id: "my-sidebar",
      displayName: "My Sidebar",
      exportName: "MySidebar",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid type", () => {
    const result = pluginUiSlotDeclarationSchema.safeParse({
      ...validSlot,
      type: "unknown",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty id", () => {
    const result = pluginUiSlotDeclarationSchema.safeParse({
      ...validSlot,
      id: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects routePath on non-page type", () => {
    const result = pluginUiSlotDeclarationSchema.safeParse({
      type: "sidebar",
      id: "my-sidebar",
      displayName: "My Sidebar",
      exportName: "MySidebar",
      routePath: "my-page",
    });
    expect(result.success).toBe(false);
  });

  it("rejects reserved routePath", () => {
    const result = pluginUiSlotDeclarationSchema.safeParse({
      ...validSlot,
      routePath: "dashboard",
    });
    expect(result.success).toBe(false);
  });

  it("rejects uppercase routePath", () => {
    const result = pluginUiSlotDeclarationSchema.safeParse({
      ...validSlot,
      routePath: "MyPlugin",
    });
    expect(result.success).toBe(false);
  });

  it("requires entityTypes for detailTab", () => {
    const result = pluginUiSlotDeclarationSchema.safeParse({
      type: "detailTab",
      id: "my-tab",
      displayName: "My Tab",
      exportName: "MyTab",
    });
    expect(result.success).toBe(false);
  });

  it("accepts detailTab with entityTypes", () => {
    const result = pluginUiSlotDeclarationSchema.safeParse({
      type: "detailTab",
      id: "my-tab",
      displayName: "My Tab",
      exportName: "MyTab",
      entityTypes: ["issue"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects commentAnnotation without comment entityType", () => {
    const result = pluginUiSlotDeclarationSchema.safeParse({
      type: "commentAnnotation",
      id: "my-annot",
      displayName: "My Annotation",
      exportName: "MyAnnotation",
      entityTypes: ["issue"],
    });
    expect(result.success).toBe(false);
  });

  it("accepts projectSidebarItem with project entityType", () => {
    const result = pluginUiSlotDeclarationSchema.safeParse({
      type: "projectSidebarItem",
      id: "my-item",
      displayName: "My Item",
      exportName: "MyItem",
      entityTypes: ["project"],
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// pluginLauncherActionDeclarationSchema
// ---------------------------------------------------------------------------
describe("pluginLauncherActionDeclarationSchema", () => {
  it("accepts navigate action", () => {
    const result = pluginLauncherActionDeclarationSchema.safeParse({
      type: "navigate",
      target: "/issues",
    });
    expect(result.success).toBe(true);
  });

  it("accepts performAction", () => {
    const result = pluginLauncherActionDeclarationSchema.safeParse({
      type: "performAction",
      target: "doSomething",
    });
    expect(result.success).toBe(true);
  });

  it("rejects performAction with slash in target", () => {
    const result = pluginLauncherActionDeclarationSchema.safeParse({
      type: "performAction",
      target: "path/to/action",
    });
    expect(result.success).toBe(false);
  });

  it("rejects navigate with absolute URL", () => {
    const result = pluginLauncherActionDeclarationSchema.safeParse({
      type: "navigate",
      target: "https://example.com",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid action type", () => {
    const result = pluginLauncherActionDeclarationSchema.safeParse({
      type: "unknown",
      target: "test",
    });
    expect(result.success).toBe(false);
  });

  it("accepts params", () => {
    const result = pluginLauncherActionDeclarationSchema.safeParse({
      type: "navigate",
      target: "/page",
      params: { id: "123" },
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// pluginLauncherRenderDeclarationSchema
// ---------------------------------------------------------------------------
describe("pluginLauncherRenderDeclarationSchema", () => {
  it("accepts environment without bounds", () => {
    const result = pluginLauncherRenderDeclarationSchema.safeParse({
      environment: "hostOverlay",
    });
    expect(result.success).toBe(true);
  });

  it("accepts hostOverlay with compact bounds", () => {
    const result = pluginLauncherRenderDeclarationSchema.safeParse({
      environment: "hostOverlay",
      bounds: "compact",
    });
    expect(result.success).toBe(true);
  });

  it("rejects unsupported bounds for environment", () => {
    const result = pluginLauncherRenderDeclarationSchema.safeParse({
      environment: "hostRoute",
      bounds: "inline",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid environment", () => {
    const result = pluginLauncherRenderDeclarationSchema.safeParse({
      environment: "unknown",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// pluginLauncherDeclarationSchema
// ---------------------------------------------------------------------------
describe("pluginLauncherDeclarationSchema", () => {
  const baseLauncher = {
    id: "my-launcher",
    displayName: "My Launcher",
    placementZone: "page" as const,
    action: {
      type: "navigate" as const,
      target: "/issues",
    },
  };

  it("accepts a minimal navigate launcher", () => {
    const result = pluginLauncherDeclarationSchema.safeParse(baseLauncher);
    expect(result.success).toBe(true);
  });

  it("requires render for openModal", () => {
    const result = pluginLauncherDeclarationSchema.safeParse({
      ...baseLauncher,
      action: { type: "openModal", target: "modal-key" },
    });
    expect(result.success).toBe(false);
  });

  it("accepts openModal with render", () => {
    const result = pluginLauncherDeclarationSchema.safeParse({
      ...baseLauncher,
      action: { type: "openModal", target: "modal-key" },
      render: { environment: "hostOverlay", bounds: "default" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects openModal with hostInline", () => {
    const result = pluginLauncherDeclarationSchema.safeParse({
      ...baseLauncher,
      action: { type: "openModal", target: "modal-key" },
      render: { environment: "hostInline" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects performAction with render", () => {
    const result = pluginLauncherDeclarationSchema.safeParse({
      ...baseLauncher,
      action: { type: "performAction", target: "action-key" },
      render: { environment: "hostOverlay" },
    });
    expect(result.success).toBe(false);
  });

  it("requires entityTypes for entity-scoped placementZone", () => {
    const result = pluginLauncherDeclarationSchema.safeParse({
      ...baseLauncher,
      placementZone: "detailTab",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// pluginManifestV1Schema
// ---------------------------------------------------------------------------
describe("pluginManifestV1Schema", () => {
  const minimalManifest = {
    id: "my-plugin",
    apiVersion: 1 as const,
    version: "1.0.0",
    displayName: "My Plugin",
    description: "A test plugin",
    author: "Test Author",
    categories: ["connector"] as const,
    capabilities: ["companies.read"] as const,
    entrypoints: { worker: "./worker.js" },
  };

  it("accepts a minimal valid manifest", () => {
    const result = pluginManifestV1Schema.safeParse(minimalManifest);
    expect(result.success).toBe(true);
  });

  // -- Field-level validation --
  it("rejects plugin id starting with hyphen", () => {
    const result = pluginManifestV1Schema.safeParse({
      ...minimalManifest,
      id: "-my-plugin",
    });
    expect(result.success).toBe(false);
  });

  it("rejects plugin id with uppercase", () => {
    const result = pluginManifestV1Schema.safeParse({
      ...minimalManifest,
      id: "My-Plugin",
    });
    expect(result.success).toBe(false);
  });

  it("rejects apiVersion other than 1", () => {
    const result = pluginManifestV1Schema.safeParse({
      ...minimalManifest,
      apiVersion: 2,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid semver", () => {
    const result = pluginManifestV1Schema.safeParse({
      ...minimalManifest,
      version: "1.0",
    });
    expect(result.success).toBe(false);
  });

  it("accepts semver with prerelease", () => {
    const result = pluginManifestV1Schema.safeParse({
      ...minimalManifest,
      version: "1.0.0-beta.1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects displayName over 100 chars", () => {
    const result = pluginManifestV1Schema.safeParse({
      ...minimalManifest,
      displayName: "x".repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it("rejects description over 500 chars", () => {
    const result = pluginManifestV1Schema.safeParse({
      ...minimalManifest,
      description: "x".repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty categories", () => {
    const result = pluginManifestV1Schema.safeParse({
      ...minimalManifest,
      categories: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty capabilities", () => {
    const result = pluginManifestV1Schema.safeParse({
      ...minimalManifest,
      capabilities: [],
    });
    expect(result.success).toBe(false);
  });

  // -- Cross-field rules --
  it("requires entrypoints.ui when ui.slots declared", () => {
    const result = pluginManifestV1Schema.safeParse({
      ...minimalManifest,
      entrypoints: { worker: "./worker.js" },
      ui: {
        slots: [
          {
            type: "page",
            id: "my-page",
            displayName: "My Page",
            exportName: "MyPage",
            routePath: "my-page",
          },
        ],
      },
    });
    expect(result.success).toBe(false);
  });

  it("accepts ui.slots when entrypoints.ui is set", () => {
    const result = pluginManifestV1Schema.safeParse({
      ...minimalManifest,
      entrypoints: { worker: "./worker.js", ui: "./ui.js" },
      ui: {
        slots: [
          {
            type: "page",
            id: "my-page",
            displayName: "My Page",
            exportName: "MyPage",
            routePath: "my-page",
          },
        ],
      },
    });
    expect(result.success).toBe(true);
  });

  it("requires agent.tools.register capability when tools declared", () => {
    const result = pluginManifestV1Schema.safeParse({
      ...minimalManifest,
      capabilities: ["companies.read"],
      tools: [
        {
          name: "search",
          displayName: "Search",
          description: "Search",
          parametersSchema: { type: "object" },
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepts tools with correct capability", () => {
    const result = pluginManifestV1Schema.safeParse({
      ...minimalManifest,
      capabilities: ["companies.read", "agent.tools.register"],
      tools: [
        {
          name: "search",
          displayName: "Search",
          description: "Search",
          parametersSchema: { type: "object" },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("requires jobs.schedule capability when jobs declared", () => {
    const result = pluginManifestV1Schema.safeParse({
      ...minimalManifest,
      capabilities: ["companies.read"],
      jobs: [
        {
          jobKey: "sync",
          displayName: "Sync",
          schedule: "0 * * * *",
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("requires webhooks.receive capability when webhooks declared", () => {
    const result = pluginManifestV1Schema.safeParse({
      ...minimalManifest,
      capabilities: ["companies.read"],
      webhooks: [
        {
          endpointKey: "push",
          displayName: "Push",
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  // -- Uniqueness checks --
  it("rejects duplicate job keys", () => {
    const result = pluginManifestV1Schema.safeParse({
      ...minimalManifest,
      capabilities: ["companies.read", "jobs.schedule"],
      jobs: [
        { jobKey: "sync", displayName: "Sync 1" },
        { jobKey: "sync", displayName: "Sync 2" },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate webhook endpointKeys", () => {
    const result = pluginManifestV1Schema.safeParse({
      ...minimalManifest,
      capabilities: ["companies.read", "webhooks.receive"],
      webhooks: [
        { endpointKey: "push", displayName: "Push 1" },
        { endpointKey: "push", displayName: "Push 2" },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate tool names", () => {
    const result = pluginManifestV1Schema.safeParse({
      ...minimalManifest,
      capabilities: ["companies.read", "agent.tools.register"],
      tools: [
        {
          name: "search",
          displayName: "Search 1",
          description: "Search",
          parametersSchema: {},
        },
        {
          name: "search",
          displayName: "Search 2",
          description: "Search",
          parametersSchema: {},
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate ui slot ids", () => {
    const result = pluginManifestV1Schema.safeParse({
      ...minimalManifest,
      entrypoints: { worker: "./worker.js", ui: "./ui.js" },
      ui: {
        slots: [
          {
            type: "page",
            id: "my-page",
            displayName: "Page 1",
            exportName: "Page1",
            routePath: "page-1",
          },
          {
            type: "page",
            id: "my-page",
            displayName: "Page 2",
            exportName: "Page2",
            routePath: "page-2",
          },
        ],
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects mismatched minimumHostVersion and minimumPaperclipVersion", () => {
    const result = pluginManifestV1Schema.safeParse({
      ...minimalManifest,
      minimumHostVersion: "1.0.0",
      minimumPaperclipVersion: "2.0.0",
    });
    expect(result.success).toBe(false);
  });

  it("accepts matching minimumHostVersion and minimumPaperclipVersion", () => {
    const result = pluginManifestV1Schema.safeParse({
      ...minimalManifest,
      minimumHostVersion: "1.0.0",
      minimumPaperclipVersion: "1.0.0",
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// installPluginSchema
// ---------------------------------------------------------------------------
describe("installPluginSchema", () => {
  it("accepts valid install request", () => {
    const result = installPluginSchema.safeParse({
      packageName: "@scope/my-plugin",
    });
    expect(result.success).toBe(true);
  });

  it("accepts with version", () => {
    const result = installPluginSchema.safeParse({
      packageName: "my-plugin",
      version: "1.0.0",
    });
    expect(result.success).toBe(true);
  });

  it("accepts with packagePath", () => {
    const result = installPluginSchema.safeParse({
      packageName: "my-plugin",
      packagePath: "/local/path",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty packageName", () => {
    const result = installPluginSchema.safeParse({ packageName: "" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Route param schemas
// ---------------------------------------------------------------------------
describe("pluginIdParamsSchema", () => {
  it("accepts valid id", () => {
    const result = pluginIdParamsSchema.safeParse({ pluginId: "abc" });
    expect(result.success).toBe(true);
  });

  it("rejects empty pluginId", () => {
    const result = pluginIdParamsSchema.safeParse({ pluginId: "" });
    expect(result.success).toBe(false);
  });
});

describe("pluginKeyParamsSchema", () => {
  it("accepts valid params", () => {
    const result = pluginKeyParamsSchema.safeParse({
      pluginId: "abc",
      key: "my-key",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing key", () => {
    const result = pluginKeyParamsSchema.safeParse({ pluginId: "abc" });
    expect(result.success).toBe(false);
  });
});

describe("pluginStreamParamsSchema", () => {
  it("accepts valid params", () => {
    const result = pluginStreamParamsSchema.safeParse({
      pluginId: "abc",
      channel: "events",
    });
    expect(result.success).toBe(true);
  });
});

describe("pluginJobParamsSchema", () => {
  it("accepts valid params", () => {
    const result = pluginJobParamsSchema.safeParse({
      pluginId: "abc",
      jobId: "job-1",
    });
    expect(result.success).toBe(true);
  });
});

describe("pluginWebhookParamsSchema", () => {
  it("accepts valid params", () => {
    const result = pluginWebhookParamsSchema.safeParse({
      pluginId: "abc",
      endpointKey: "push",
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Query schemas
// ---------------------------------------------------------------------------
describe("listPluginsQuerySchema", () => {
  it("accepts empty query", () => {
    const result = listPluginsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts valid status", () => {
    const result = listPluginsQuerySchema.safeParse({ status: "ready" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid status", () => {
    const result = listPluginsQuerySchema.safeParse({ status: "unknown" });
    expect(result.success).toBe(false);
  });
});

describe("listPluginToolsQuerySchema", () => {
  it("accepts empty query", () => {
    const result = listPluginToolsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts with pluginId", () => {
    const result = listPluginToolsQuerySchema.safeParse({ pluginId: "abc" });
    expect(result.success).toBe(true);
  });
});

describe("pluginLogsQuerySchema", () => {
  it("accepts valid query", () => {
    const result = pluginLogsQuerySchema.safeParse({
      limit: "50",
      level: "error",
      since: "2026-01-01T00:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects limit out of range", () => {
    const result = pluginLogsQuerySchema.safeParse({ limit: "501" });
    expect(result.success).toBe(false);
  });

  it("rejects non-numeric limit", () => {
    const result = pluginLogsQuerySchema.safeParse({ limit: "abc" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid level", () => {
    const result = pluginLogsQuerySchema.safeParse({ level: "trace" });
    expect(result.success).toBe(false);
  });
});

describe("listPluginJobsQuerySchema", () => {
  it("accepts valid status", () => {
    const result = listPluginJobsQuerySchema.safeParse({ status: "active" });
    expect(result.success).toBe(true);
  });
});

describe("listPluginJobRunsQuerySchema", () => {
  it("accepts valid limit", () => {
    const result = listPluginJobRunsQuerySchema.safeParse({ limit: "10" });
    expect(result.success).toBe(true);
  });

  it("rejects zero limit", () => {
    const result = listPluginJobRunsQuerySchema.safeParse({ limit: "0" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// pluginInstallRequestSchema
// ---------------------------------------------------------------------------
describe("pluginInstallRequestSchema", () => {
  it("accepts valid request", () => {
    const result = pluginInstallRequestSchema.safeParse({
      packageName: "my-plugin",
    });
    expect(result.success).toBe(true);
  });

  it("accepts isLocalPath", () => {
    const result = pluginInstallRequestSchema.safeParse({
      packageName: "/local/path",
      isLocalPath: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid characters in packageName (non-local)", () => {
    const result = pluginInstallRequestSchema.safeParse({
      packageName: "my<plugin>",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// pluginToolExecuteRequestSchema
// ---------------------------------------------------------------------------
describe("pluginToolExecuteRequestSchema", () => {
  it("accepts valid request", () => {
    const result = pluginToolExecuteRequestSchema.safeParse({
      tool: "search",
      runContext: {
        agentId: "550e8400-e29b-41d4-a716-446655440000",
        runId: "550e8400-e29b-41d4-a716-446655440001",
        companyId: "550e8400-e29b-41d4-a716-446655440002",
        projectId: "550e8400-e29b-41d4-a716-446655440003",
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty tool name", () => {
    const result = pluginToolExecuteRequestSchema.safeParse({
      tool: "",
      runContext: {
        agentId: "550e8400-e29b-41d4-a716-446655440000",
        runId: "550e8400-e29b-41d4-a716-446655440001",
        companyId: "550e8400-e29b-41d4-a716-446655440002",
        projectId: "550e8400-e29b-41d4-a716-446655440003",
      },
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Bridge schemas
// ---------------------------------------------------------------------------
describe("pluginBridgeDataRequestSchema", () => {
  it("accepts valid request", () => {
    const result = pluginBridgeDataRequestSchema.safeParse({
      key: "data-key",
      companyId: "abc",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing key", () => {
    const result = pluginBridgeDataRequestSchema.safeParse({
      companyId: "abc",
    });
    expect(result.success).toBe(false);
  });
});

describe("pluginBridgeActionRequestSchema", () => {
  it("accepts valid request", () => {
    const result = pluginBridgeActionRequestSchema.safeParse({
      key: "action-key",
    });
    expect(result.success).toBe(true);
  });
});

describe("pluginDisableRequestSchema", () => {
  it("accepts empty body (default)", () => {
    const result = pluginDisableRequestSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts with reason", () => {
    const result = pluginDisableRequestSchema.safeParse({
      reason: "maintenance",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty reason", () => {
    const result = pluginDisableRequestSchema.safeParse({ reason: "" });
    expect(result.success).toBe(false);
  });
});

describe("pluginUpgradeRequestSchema", () => {
  it("accepts empty body (default)", () => {
    const result = pluginUpgradeRequestSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts with version", () => {
    const result = pluginUpgradeRequestSchema.safeParse({ version: "2.0.0" });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Config schemas
// ---------------------------------------------------------------------------
describe("upsertPluginConfigSchema", () => {
  it("accepts valid config", () => {
    const result = upsertPluginConfigSchema.safeParse({
      configJson: { key: "value" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty configJson", () => {
    const result = upsertPluginConfigSchema.safeParse({ configJson: {} });
    expect(result.success).toBe(true);
  });
});

describe("patchPluginConfigSchema", () => {
  it("accepts valid patch", () => {
    const result = patchPluginConfigSchema.safeParse({
      configJson: { key: "updated" },
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// updatePluginStatusSchema
// ---------------------------------------------------------------------------
describe("updatePluginStatusSchema", () => {
  it("accepts valid status", () => {
    const result = updatePluginStatusSchema.safeParse({ status: "ready" });
    expect(result.success).toBe(true);
  });

  it("accepts with lastError", () => {
    const result = updatePluginStatusSchema.safeParse({
      status: "error",
      lastError: "Something broke",
    });
    expect(result.success).toBe(true);
  });

  it("accepts null lastError", () => {
    const result = updatePluginStatusSchema.safeParse({
      status: "ready",
      lastError: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid status", () => {
    const result = updatePluginStatusSchema.safeParse({ status: "unknown" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// uninstallPluginSchema
// ---------------------------------------------------------------------------
describe("uninstallPluginSchema", () => {
  it("accepts empty body (defaults to false)", () => {
    const result = uninstallPluginSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.removeData).toBe(false);
    }
  });

  it("accepts removeData true", () => {
    const result = uninstallPluginSchema.safeParse({ removeData: true });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Plugin state schemas
// ---------------------------------------------------------------------------
describe("pluginStateScopeKeySchema", () => {
  it("accepts valid scope key", () => {
    const result = pluginStateScopeKeySchema.safeParse({
      scopeKind: "company",
      stateKey: "my-key",
    });
    expect(result.success).toBe(true);
  });

  it("accepts optional fields", () => {
    const result = pluginStateScopeKeySchema.safeParse({
      scopeKind: "issue",
      scopeId: "issue-123",
      namespace: "custom",
      stateKey: "my-key",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty stateKey", () => {
    const result = pluginStateScopeKeySchema.safeParse({
      scopeKind: "instance",
      stateKey: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid scopeKind", () => {
    const result = pluginStateScopeKeySchema.safeParse({
      scopeKind: "unknown",
      stateKey: "key",
    });
    expect(result.success).toBe(false);
  });
});

describe("setPluginStateSchema", () => {
  it("accepts valid state", () => {
    const result = setPluginStateSchema.safeParse({
      scopeKind: "company",
      stateKey: "key",
      value: { data: "test" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts primitive value", () => {
    const result = setPluginStateSchema.safeParse({
      scopeKind: "instance",
      stateKey: "count",
      value: 42,
    });
    expect(result.success).toBe(true);
  });
});

describe("listPluginStateSchema", () => {
  it("accepts empty query", () => {
    const result = listPluginStateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts partial filters", () => {
    const result = listPluginStateSchema.safeParse({
      scopeKind: "project",
      scopeId: "proj-1",
    });
    expect(result.success).toBe(true);
  });
});

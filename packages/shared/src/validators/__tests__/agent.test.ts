import { describe, expect, it } from "vitest";
import {
  createAgentSchema,
  createAgentHireSchema,
  updateAgentSchema,
  createAgentKeySchema,
  agentMineInboxQuerySchema,
  wakeAgentSchema,
  resetAgentSessionSchema,
  testAdapterEnvironmentSchema,
  updateAgentPermissionsSchema,
  updateAgentInstructionsPathSchema,
  upsertAgentInstructionsFileSchema,
  updateAgentInstructionsBundleSchema,
  agentInstructionsBundleModeSchema,
} from "../agent.js";

// ---------------------------------------------------------------------------
// agentInstructionsBundleModeSchema
// ---------------------------------------------------------------------------
describe("agentInstructionsBundleModeSchema", () => {
  it("accepts 'managed'", () => {
    const result = agentInstructionsBundleModeSchema.safeParse("managed");
    expect(result.success).toBe(true);
  });

  it("accepts 'external'", () => {
    const result = agentInstructionsBundleModeSchema.safeParse("external");
    expect(result.success).toBe(true);
  });

  it("rejects invalid mode", () => {
    const result = agentInstructionsBundleModeSchema.safeParse("hybrid");
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// updateAgentInstructionsBundleSchema
// ---------------------------------------------------------------------------
describe("updateAgentInstructionsBundleSchema", () => {
  it("accepts mode update", () => {
    const result = updateAgentInstructionsBundleSchema.safeParse({
      mode: "managed",
    });
    expect(result.success).toBe(true);
  });

  it("accepts rootPath with nullable", () => {
    const result = updateAgentInstructionsBundleSchema.safeParse({
      rootPath: null,
    });
    expect(result.success).toBe(true);
  });

  it("accepts full bundle update", () => {
    const result = updateAgentInstructionsBundleSchema.safeParse({
      mode: "external",
      rootPath: "/path/to/instructions",
      entryFile: "main.md",
      clearLegacyPromptTemplate: true,
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// upsertAgentInstructionsFileSchema
// ---------------------------------------------------------------------------
describe("upsertAgentInstructionsFileSchema", () => {
  it("accepts valid file", () => {
    const result = upsertAgentInstructionsFileSchema.safeParse({
      path: "instructions.md",
      content: "# Hello",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty path", () => {
    const result = upsertAgentInstructionsFileSchema.safeParse({
      path: "",
      content: "# Hello",
    });
    expect(result.success).toBe(false);
  });

  it("accepts empty content", () => {
    const result = upsertAgentInstructionsFileSchema.safeParse({
      path: "empty.md",
      content: "",
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// createAgentSchema
// ---------------------------------------------------------------------------
describe("createAgentSchema", () => {
  const minimalAgent = {
    name: "Test Agent",
    adapterType: "claude_local",
  };

  it("accepts a minimal valid agent", () => {
    const result = createAgentSchema.safeParse(minimalAgent);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Test Agent");
      expect(result.data.role).toBe("general");
      expect(result.data.budgetMonthlyCents).toBe(0);
    }
  });

  it("accepts a fully populated agent", () => {
    const result = createAgentSchema.safeParse({
      name: "Full Agent",
      role: "engineer",
      title: "Senior Engineer",
      icon: "bot",
      reportsTo: "550e8400-e29b-41d4-a716-446655440000",
      capabilities: "coding,debugging",
      desiredSkills: ["typescript", "react"],
      adapterType: "claude_local",
      adapterConfig: { env: {} },
      runtimeConfig: { model: "opus" },
      budgetMonthlyCents: 5000,
      permissions: { canCreateAgents: true },
      metadata: { tier: "senior" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = createAgentSchema.safeParse({ adapterType: "claude_local" });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = createAgentSchema.safeParse({
      name: "",
      adapterType: "claude_local",
    });
    expect(result.success).toBe(false);
  });

  it("defaults adapterType to 'process'", () => {
    const result = createAgentSchema.safeParse({ name: "Agent" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.adapterType).toBe("process");
    }
  });

  it("rejects invalid role", () => {
    const result = createAgentSchema.safeParse({
      ...minimalAgent,
      role: "superadmin",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid UUID for reportsTo", () => {
    const result = createAgentSchema.safeParse({
      ...minimalAgent,
      reportsTo: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative budgetMonthlyCents", () => {
    const result = createAgentSchema.safeParse({
      ...minimalAgent,
      budgetMonthlyCents: -100,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer budgetMonthlyCents", () => {
    const result = createAgentSchema.safeParse({
      ...minimalAgent,
      budgetMonthlyCents: 10.5,
    });
    expect(result.success).toBe(false);
  });

  it("applies defaults for optional fields", () => {
    const result = createAgentSchema.safeParse(minimalAgent);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe("general");
      expect(result.data.adapterConfig).toEqual({});
      expect(result.data.runtimeConfig).toEqual({});
      expect(result.data.budgetMonthlyCents).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// createAgentHireSchema
// ---------------------------------------------------------------------------
describe("createAgentHireSchema", () => {
  it("accepts agent with source issue", () => {
    const result = createAgentHireSchema.safeParse({
      name: "Hired Agent",
      adapterType: "claude_local",
      sourceIssueId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("accepts multiple sourceIssueIds", () => {
    const result = createAgentHireSchema.safeParse({
      name: "Hired Agent",
      adapterType: "claude_local",
      sourceIssueIds: [
        "550e8400-e29b-41d4-a716-446655440000",
        "550e8400-e29b-41d4-a716-446655440001",
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts null sourceIssueId", () => {
    const result = createAgentHireSchema.safeParse({
      name: "Hired Agent",
      adapterType: "claude_local",
      sourceIssueId: null,
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// updateAgentSchema
// ---------------------------------------------------------------------------
describe("updateAgentSchema", () => {
  it("accepts empty update", () => {
    const result = updateAgentSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts partial name update", () => {
    const result = updateAgentSchema.safeParse({ name: "Updated Name" });
    expect(result.success).toBe(true);
  });

  it("accepts status update", () => {
    const result = updateAgentSchema.safeParse({ status: "paused" });
    expect(result.success).toBe(true);
  });

  it("accepts spentMonthlyCents", () => {
    const result = updateAgentSchema.safeParse({ spentMonthlyCents: 100 });
    expect(result.success).toBe(true);
  });

  it("rejects invalid status", () => {
    const result = updateAgentSchema.safeParse({ status: "unknown" });
    expect(result.success).toBe(false);
  });

  it("rejects negative spentMonthlyCents", () => {
    const result = updateAgentSchema.safeParse({ spentMonthlyCents: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects permissions field", () => {
    const result = updateAgentSchema.safeParse({
      permissions: { canCreateAgents: true },
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// updateAgentInstructionsPathSchema
// ---------------------------------------------------------------------------
describe("updateAgentInstructionsPathSchema", () => {
  it("accepts valid path", () => {
    const result = updateAgentInstructionsPathSchema.safeParse({
      path: "/path/to/instructions",
    });
    expect(result.success).toBe(true);
  });

  it("accepts null path", () => {
    const result = updateAgentInstructionsPathSchema.safeParse({ path: null });
    expect(result.success).toBe(true);
  });

  it("rejects empty path", () => {
    const result = updateAgentInstructionsPathSchema.safeParse({ path: "" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createAgentKeySchema
// ---------------------------------------------------------------------------
describe("createAgentKeySchema", () => {
  it("accepts default name", () => {
    const result = createAgentKeySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("default");
    }
  });

  it("accepts custom name", () => {
    const result = createAgentKeySchema.safeParse({ name: "production" });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createAgentKeySchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// agentMineInboxQuerySchema
// ---------------------------------------------------------------------------
describe("agentMineInboxQuerySchema", () => {
  it("accepts valid query", () => {
    const result = agentMineInboxQuerySchema.safeParse({ userId: "user-123" });
    expect(result.success).toBe(true);
  });

  it("applies default status", () => {
    const result = agentMineInboxQuerySchema.safeParse({ userId: "user-123" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBeTruthy();
    }
  });

  it("rejects empty userId", () => {
    const result = agentMineInboxQuerySchema.safeParse({ userId: "" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// wakeAgentSchema
// ---------------------------------------------------------------------------
describe("wakeAgentSchema", () => {
  it("accepts empty body with defaults", () => {
    const result = wakeAgentSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.source).toBe("on_demand");
      expect(result.data.forceFreshSession).toBe(false);
    }
  });

  it("accepts all fields", () => {
    const result = wakeAgentSchema.safeParse({
      source: "timer",
      triggerDetail: "manual",
      reason: "Scheduled wake",
      payload: { key: "value" },
      idempotencyKey: "unique-key",
      forceFreshSession: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid source", () => {
    const result = wakeAgentSchema.safeParse({ source: "invalid" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid triggerDetail", () => {
    const result = wakeAgentSchema.safeParse({ triggerDetail: "invalid" });
    expect(result.success).toBe(false);
  });

  it("handles null forceFreshSession", () => {
    const result = wakeAgentSchema.safeParse({ forceFreshSession: null });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.forceFreshSession).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// resetAgentSessionSchema
// ---------------------------------------------------------------------------
describe("resetAgentSessionSchema", () => {
  it("accepts empty body", () => {
    const result = resetAgentSessionSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts valid taskKey", () => {
    const result = resetAgentSessionSchema.safeParse({ taskKey: "task-1" });
    expect(result.success).toBe(true);
  });

  it("accepts null taskKey", () => {
    const result = resetAgentSessionSchema.safeParse({ taskKey: null });
    expect(result.success).toBe(true);
  });

  it("rejects empty taskKey", () => {
    const result = resetAgentSessionSchema.safeParse({ taskKey: "" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// testAdapterEnvironmentSchema
// ---------------------------------------------------------------------------
describe("testAdapterEnvironmentSchema", () => {
  it("accepts empty body with defaults", () => {
    const result = testAdapterEnvironmentSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.adapterConfig).toEqual({});
    }
  });

  it("accepts adapterConfig", () => {
    const result = testAdapterEnvironmentSchema.safeParse({
      adapterConfig: { apiKey: "test" },
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// updateAgentPermissionsSchema
// ---------------------------------------------------------------------------
describe("updateAgentPermissionsSchema", () => {
  it("accepts valid permissions", () => {
    const result = updateAgentPermissionsSchema.safeParse({
      canCreateAgents: true,
      canAssignTasks: false,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing canCreateAgents", () => {
    const result = updateAgentPermissionsSchema.safeParse({
      canAssignTasks: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing canAssignTasks", () => {
    const result = updateAgentPermissionsSchema.safeParse({
      canCreateAgents: true,
    });
    expect(result.success).toBe(false);
  });
});

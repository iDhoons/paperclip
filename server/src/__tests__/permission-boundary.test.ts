import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { agentRoutes } from "../routes/agents.js";
import { errorHandler } from "../middleware/index.js";

const agentId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const companyId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const baseAgent = {
  id: agentId,
  companyId,
  name: "TestAgent",
  urlKey: "testagent",
  role: "engineer",
  title: "TestAgent",
  icon: null,
  status: "idle",
  reportsTo: null,
  capabilities: null,
  adapterType: "process",
  adapterConfig: {},
  runtimeConfig: {},
  budgetMonthlyCents: 0,
  spentMonthlyCents: 0,
  pauseReason: null,
  pausedAt: null,
  permissions: { canCreateAgents: false },
  lastHeartbeatAt: null,
  metadata: null,
  createdAt: new Date("2026-03-19T00:00:00.000Z"),
  updatedAt: new Date("2026-03-19T00:00:00.000Z"),
};

const mockAgentService = vi.hoisted(() => ({
  getById: vi.fn(),
  create: vi.fn(),
  updatePermissions: vi.fn(),
  remove: vi.fn(),
  getChainOfCommand: vi.fn(),
  resolveByReference: vi.fn(),
}));

const mockAccessService = vi.hoisted(() => ({
  canUser: vi.fn(),
  hasPermission: vi.fn(),
  getMembership: vi.fn(),
  ensureMembership: vi.fn(),
  listPrincipalGrants: vi.fn(),
  setPrincipalPermission: vi.fn(),
}));

const mockApprovalService = vi.hoisted(() => ({
  create: vi.fn(),
  getById: vi.fn(),
}));

const mockBudgetService = vi.hoisted(() => ({
  upsertPolicy: vi.fn(),
}));

const mockHeartbeatService = vi.hoisted(() => ({
  listTaskSessions: vi.fn(),
  resetRuntimeSession: vi.fn(),
}));

const mockIssueApprovalService = vi.hoisted(() => ({
  linkManyForApproval: vi.fn(),
}));

const mockIssueService = vi.hoisted(() => ({
  list: vi.fn(),
}));

const mockSecretService = vi.hoisted(() => ({
  normalizeAdapterConfigForPersistence: vi.fn(),
  resolveAdapterConfigForRuntime: vi.fn(),
}));

const mockAgentInstructionsService = vi.hoisted(() => ({
  materializeManagedBundle: vi.fn(),
}));

const mockCompanySkillService = vi.hoisted(() => ({
  listRuntimeSkillEntries: vi.fn(),
  resolveRequestedSkillKeys: vi.fn(),
}));

const mockWorkspaceOperationService = vi.hoisted(() => ({}));
const mockLogActivity = vi.hoisted(() => vi.fn());

vi.mock("../services/index.js", () => ({
  agentService: () => mockAgentService,
  agentInstructionsService: () => mockAgentInstructionsService,
  accessService: () => mockAccessService,
  approvalService: () => mockApprovalService,
  companySkillService: () => mockCompanySkillService,
  budgetService: () => mockBudgetService,
  heartbeatService: () => mockHeartbeatService,
  issueApprovalService: () => mockIssueApprovalService,
  issueService: () => mockIssueService,
  logActivity: mockLogActivity,
  secretService: () => mockSecretService,
  syncInstructionsBundleConfigFromFilePath: vi.fn((_agent, config) => config),
  workspaceOperationService: () => mockWorkspaceOperationService,
}));

function createDbStub() {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          then: vi.fn().mockResolvedValue([
            {
              id: companyId,
              name: "TestCo",
              requireBoardApprovalForNewAgents: false,
            },
          ]),
        }),
      }),
    }),
  };
}

function createApp(actor: Record<string, unknown>) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.actor = actor;
    next();
  });
  app.use("/api", agentRoutes(createDbStub() as unknown));
  app.use(errorHandler);
  return app;
}

describe("permission boundary — board vs agent", () => {
  const boardActor = {
    type: "board",
    userId: "board-user",
    source: "local_implicit",
    isInstanceAdmin: true,
    companyIds: [companyId],
  };

  const agentActor = {
    type: "agent",
    agentId,
    companyId,
    runId: "run-1",
    source: "agent_key",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAgentService.getById.mockResolvedValue(baseAgent);
    mockAgentService.getChainOfCommand.mockResolvedValue([]);
    mockAgentService.resolveByReference.mockResolvedValue({
      ambiguous: false,
      agent: baseAgent,
    });
    mockAccessService.getMembership.mockResolvedValue({
      id: "membership-1",
      companyId,
      principalType: "agent",
      principalId: agentId,
      status: "active",
      membershipRole: "member",
      createdAt: new Date("2026-03-19T00:00:00.000Z"),
      updatedAt: new Date("2026-03-19T00:00:00.000Z"),
    });
    mockAccessService.listPrincipalGrants.mockResolvedValue([]);
    mockAgentInstructionsService.materializeManagedBundle.mockImplementation(
      async (
        agent: Record<string, unknown>,
        files: Record<string, string>,
      ) => ({
        bundle: null,
        adapterConfig: {
          ...((agent.adapterConfig as Record<string, unknown> | undefined) ??
            {}),
          instructionsBundleMode: "managed",
          instructionsRootPath: `/tmp/${String(agent.id)}/instructions`,
          instructionsEntryFile: "AGENTS.md",
          instructionsFilePath: `/tmp/${String(agent.id)}/instructions/AGENTS.md`,
          promptTemplate: files["AGENTS.md"] ?? "",
        },
      }),
    );
    mockCompanySkillService.listRuntimeSkillEntries.mockResolvedValue([]);
    mockSecretService.normalizeAdapterConfigForPersistence.mockImplementation(
      async (_c: string, config: unknown) => config,
    );
    mockSecretService.resolveAdapterConfigForRuntime.mockImplementation(
      async (_c: string, config: unknown) => ({ config }),
    );
    mockLogActivity.mockResolvedValue(undefined);
  });

  it("board can create agents, agent cannot", async () => {
    mockAgentService.create.mockResolvedValue(baseAgent);

    const boardRes = await request(createApp(boardActor))
      .post(`/api/companies/${companyId}/agents`)
      .send({
        name: "NewAgent",
        role: "engineer",
        adapterType: "process",
        adapterConfig: {},
      });
    expect(boardRes.status).toBe(201);

    const agentRes = await request(createApp(agentActor))
      .post(`/api/companies/${companyId}/agents`)
      .send({
        name: "NewAgent",
        role: "engineer",
        adapterType: "process",
        adapterConfig: {},
      });
    expect(agentRes.status).toBe(403);
  });

  it("board can update agent permissions, agent cannot", async () => {
    mockAgentService.updatePermissions.mockResolvedValue(baseAgent);

    const boardRes = await request(createApp(boardActor))
      .patch(`/api/agents/${agentId}/permissions`)
      .send({ canCreateAgents: true, canAssignTasks: true });
    expect(boardRes.status).toBe(200);

    const agentRes = await request(createApp(agentActor))
      .patch(`/api/agents/${agentId}/permissions`)
      .send({ canCreateAgents: true, canAssignTasks: true });
    expect(agentRes.status).toBe(403);
  });

  it("board can delete agents, agent cannot", async () => {
    mockAgentService.remove.mockResolvedValue(baseAgent);

    const boardRes = await request(createApp(boardActor)).delete(
      `/api/agents/${agentId}`,
    );
    expect(boardRes.status).toBe(200);

    const agentRes = await request(createApp(agentActor)).delete(
      `/api/agents/${agentId}`,
    );
    expect(agentRes.status).toBe(403);
  });

  it("agent can read its own detail but board can read any", async () => {
    const agentRes = await request(createApp(agentActor)).get(
      `/api/agents/${agentId}`,
    );
    expect(agentRes.status).toBe(200);

    const boardRes = await request(createApp(boardActor)).get(
      `/api/agents/${agentId}`,
    );
    expect(boardRes.status).toBe(200);
  });
});

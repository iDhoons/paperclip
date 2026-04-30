import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { agentRoutes } from "../routes/agents.js";
import { errorHandler } from "../middleware/index.js";

const companyA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const companyB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const agentIdA = "11111111-1111-4111-8111-111111111111";

const agentA = {
  id: agentIdA,
  companyId: companyA,
  name: "AgentA",
  urlKey: "agenta",
  role: "engineer",
  title: "AgentA",
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
              id: companyA,
              name: "CompanyA",
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

describe("multi-company data isolation", () => {
  const agentActorA = {
    type: "agent",
    agentId: agentIdA,
    companyId: companyA,
    runId: "run-a",
    source: "agent_key",
  };

  const boardActorA = {
    type: "board",
    userId: "board-user-a",
    source: "session",
    isInstanceAdmin: false,
    companyIds: [companyA],
  };

  const boardActorB = {
    type: "board",
    userId: "board-user-b",
    source: "session",
    isInstanceAdmin: false,
    companyIds: [companyB],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAgentService.getById.mockResolvedValue(agentA);
    mockAgentService.getChainOfCommand.mockResolvedValue([]);
    mockAgentService.resolveByReference.mockResolvedValue({
      ambiguous: false,
      agent: agentA,
    });
    mockAccessService.getMembership.mockResolvedValue({
      id: "membership-1",
      companyId: companyA,
      principalType: "agent",
      principalId: agentIdA,
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

  it("agent from company A cannot create agents in company B", async () => {
    const res = await request(createApp(agentActorA))
      .post(`/api/companies/${companyB}/agents`)
      .send({
        name: "Spy",
        role: "engineer",
        adapterType: "process",
        adapterConfig: {},
      });
    expect(res.status).toBe(403);
  });

  it("board user from company A cannot create agents in company B", async () => {
    mockAgentService.create.mockResolvedValue(agentA);

    const res = await request(createApp(boardActorA))
      .post(`/api/companies/${companyB}/agents`)
      .send({
        name: "Spy",
        role: "engineer",
        adapterType: "process",
        adapterConfig: {},
      });
    expect(res.status).toBe(403);
  });

  it("instance admin can operate across companies", async () => {
    mockAgentService.create.mockResolvedValue(agentA);

    const adminActor = {
      type: "board",
      userId: "admin",
      source: "local_implicit",
      isInstanceAdmin: true,
      companyIds: [companyA, companyB],
    };

    const res = await request(createApp(adminActor))
      .post(`/api/companies/${companyB}/agents`)
      .send({
        name: "CrossCompany",
        role: "engineer",
        adapterType: "process",
        adapterConfig: {},
      });
    expect(res.status).toBe(201);
  });

  it("board user without company membership cannot access agent detail", async () => {
    const res = await request(createApp(boardActorB)).get(
      `/api/agents/${agentIdA}`,
    );
    expect(res.status).toBe(403);
  });

  it("board user with company membership can access agent detail", async () => {
    const res = await request(createApp(boardActorA)).get(
      `/api/agents/${agentIdA}`,
    );
    expect(res.status).toBe(200);
  });
});

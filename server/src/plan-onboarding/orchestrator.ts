/**
 * Onboarding Orchestrator — 파싱된 플랜 + 팀 구성을 Paperclip 엔티티로 생성
 *
 * 호출 순서:
 * 1. Goal 생성 (plan.goal → Paperclip Goal)
 * 2. Project 생성/재사용
 * 3. Agent 채용 (TeamComposition → Agents)
 * 4. Issue 생성 (Phase.Tasks → Issues, Phase 순서 = 의존성)
 * 5. Issue 할당 (Agent 역할 매칭)
 */

import type { Db } from "@paperclipai/db";
import type { ParsedPlan, OnboardingResult } from "@paperclipai/shared";
import type { TeamComposition, TeamMember } from "./team-composer.js";
import { computePlanHash } from "./team-composer.js";
import { agentService } from "../services/agents.js";
import { goalService } from "../services/goals.js";
import { projectService } from "../services/projects.js";
import { issueService } from "../services/issues.js";

// ---------------------------------------------------------------------------
// 타입
// ---------------------------------------------------------------------------

export interface OnboardingOptions {
  /** 회사 ID (필수) */
  companyId: string;
  /** 기존 프로젝트 ID가 있으면 재사용 */
  existingProjectId?: string;
  /** Board 사용자 ID (감사 로그용) */
  userId?: string;
  /** 드라이런 — 실제 생성 없이 계획만 반환 */
  dryRun?: boolean;
}

export interface OnboardingPlan {
  goal: { title: string; description: string };
  project: { name: string; description: string };
  agents: Array<{ name: string; role: string; responsibility: string }>;
  issues: Array<{ title: string; priority: string; phaseNumber: number }>;
}

// ---------------------------------------------------------------------------
// 메인 함수
// ---------------------------------------------------------------------------

export async function onboardFromPlan(
  db: Db,
  plan: ParsedPlan,
  team: TeamComposition,
  options: OnboardingOptions,
): Promise<OnboardingResult> {
  const { companyId, userId } = options;
  const planHash = computePlanHash(plan);

  // 드라이런: 실제 생성 없이 계획만 반환
  if (options.dryRun) {
    return buildDryRunResult(plan, team, planHash);
  }

  const goals = goalService(db);
  const projects = projectService(db);
  const agentSvc = agentService(db);
  const issues = issueService(db);

  // 1. Goal 생성
  const goal = await goals.create(companyId, {
    title: plan.goal,
    description: plan.architecture || undefined,
    level: "project",
    status: "active",
  });

  // 2. Project 생성 또는 재사용
  let projectId = options.existingProjectId;
  if (!projectId) {
    const project = await projects.create(companyId, {
      name: plan.frontmatter.project,
      description: plan.goal,
      status: "in_progress",
      goalId: goal.id,
    });
    projectId = project.id;
  }

  // 3. Agent 채용
  const createdAgents: OnboardingResult["agents"] = [];
  for (const member of team.members) {
    const agent = await agentSvc.create(companyId, {
      name: member.name,
      role: member.role,
      title: member.responsibility,
      adapterType: plan.frontmatter.adapter || "claude_local",
      capabilities: member.responsibility,
      budgetMonthlyCents: plan.frontmatter.budget || 0,
    });
    createdAgents.push({
      id: agent.id,
      name: agent.name,
      role: member.role,
    });
  }

  // 4 + 5. Issue 생성 + 할당
  const createdIssues: OnboardingResult["issues"] = [];

  for (const phase of plan.phases) {
    // 이미 완료된 Phase는 건너뜀
    if (phase.status === "completed") continue;

    // Phase에 매칭되는 에이전트 찾기
    const assignee = findAssignee(phase.number, team.members, createdAgents);

    for (const task of phase.tasks) {
      // 이미 완료된 태스크도 건너뜀
      if (task.completed) continue;

      const issue = await issues.create(companyId, {
        title: `[Phase ${phase.number}] ${task.title}`,
        description: buildIssueDescription(task, phase, plan),
        status: "todo",
        priority: task.priority || "medium",
        projectId,
        goalId: goal.id,
        assigneeAgentId:
          plan.frontmatter.auto_assign !== false ? assignee?.id : undefined,
      });

      createdIssues.push({
        id: issue.id,
        identifier: issue.identifier ?? `${plan.frontmatter.project}-${createdIssues.length + 1}`,
        title: issue.title,
        assigneeAgentId: assignee?.id,
      });
    }
  }

  return {
    projectId,
    goalId: goal.id,
    agents: createdAgents,
    issues: createdIssues,
    planHash,
  };
}

// ---------------------------------------------------------------------------
// 프리뷰 (드라이런)
// ---------------------------------------------------------------------------

export function previewOnboarding(
  plan: ParsedPlan,
  team: TeamComposition,
): OnboardingPlan {
  const pendingTasks = plan.phases
    .filter((p) => p.status !== "completed")
    .flatMap((p) =>
      p.tasks
        .filter((t) => !t.completed)
        .map((t) => ({
          title: `[Phase ${p.number}] ${t.title}`,
          priority: t.priority || "medium",
          phaseNumber: p.number,
        })),
    );

  return {
    goal: { title: plan.goal, description: plan.architecture || "" },
    project: { name: plan.frontmatter.project, description: plan.goal },
    agents: team.members.map((m) => ({
      name: m.name,
      role: m.role,
      responsibility: m.responsibility,
    })),
    issues: pendingTasks,
  };
}

// ---------------------------------------------------------------------------
// 헬퍼
// ---------------------------------------------------------------------------

function findAssignee(
  phaseNumber: number,
  members: TeamMember[],
  createdAgents: OnboardingResult["agents"],
): OnboardingResult["agents"][number] | undefined {
  // Phase에 배정된 멤버 중 첫 번째 (PM/CEO 제외, 실무자 우선)
  const worker = members.find(
    (m) =>
      m.phases.includes(phaseNumber) &&
      m.role !== "pm" &&
      m.role !== "ceo",
  );
  const target = worker || members[0];

  return createdAgents.find((a) => a.name === target?.name);
}

function buildIssueDescription(
  task: { id: string; title: string },
  phase: { number: number; name: string; verification?: string },
  plan: ParsedPlan,
): string {
  const lines = [
    `**Task ID:** ${task.id}`,
    `**Phase:** ${phase.number} — ${phase.name}`,
    `**Project:** ${plan.frontmatter.project}`,
  ];
  if (plan.techStack?.length) {
    lines.push(`**Tech Stack:** ${plan.techStack.join(", ")}`);
  }
  if (phase.verification) {
    lines.push(`**검증 기준:** ${phase.verification}`);
  }
  return lines.join("\n");
}

function buildDryRunResult(
  plan: ParsedPlan,
  team: TeamComposition,
  planHash: string,
): OnboardingResult {
  return {
    projectId: "dry-run",
    goalId: "dry-run",
    agents: team.members.map((m, i) => ({
      id: `dry-run-agent-${i}`,
      name: m.name,
      role: m.role,
    })),
    issues: plan.phases
      .filter((p) => p.status !== "completed")
      .flatMap((p) =>
        p.tasks
          .filter((t) => !t.completed)
          .map((t, i) => ({
            id: `dry-run-issue-${i}`,
            identifier: `DRY-${i + 1}`,
            title: `[Phase ${p.number}] ${t.title}`,
            assigneeAgentId: undefined,
          })),
      ),
    planHash,
  };
}

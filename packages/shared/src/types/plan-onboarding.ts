/**
 * Plan Onboarding — task_plan.md → Paperclip 자동 온보딩
 *
 * 사용자가 작성한 마크다운 계획서를 파싱하여
 * Paperclip 프로젝트/에이전트/이슈를 자동 생성한다.
 */

import type { AgentAdapterType, AgentRole } from "../constants.js";

// ---------------------------------------------------------------------------
// 1. YAML Frontmatter (task_plan.md 맨 위에 추가하는 설정 블록)
// ---------------------------------------------------------------------------

export interface PlanFrontmatter {
  /** Paperclip 프로젝트 이름 (필수) */
  project: string;

  /** 에이전트가 사용할 AI 어댑터 (기본: claude_local) */
  adapter?: AgentAdapterType;

  /** 월 예산 상한 — 센트 단위 (기본: 0 = 무제한) */
  budget?: number;

  /** 팀 구성 힌트 — LLM 판단의 참고용 (기본: LLM이 자동 결정) */
  team_hint?: AgentRole[];

  /** 이슈 생성 후 에이전트에 자동 할당 (기본: true) */
  auto_assign?: boolean;

  /** 플랜 파일의 원본 경로 (파서가 자동 설정) */
  source_path?: string;
}

/** frontmatter 기본값 */
export const PLAN_FRONTMATTER_DEFAULTS: Required<
  Omit<PlanFrontmatter, "project" | "source_path">
> = {
  adapter: "claude_local",
  budget: 0,
  team_hint: [],
  auto_assign: true,
};

// ---------------------------------------------------------------------------
// 2. 파싱된 플랜 구조
// ---------------------------------------------------------------------------

export interface ParsedPlan {
  /** YAML frontmatter */
  frontmatter: PlanFrontmatter;

  /** 플랜 제목 (# 첫 번째 헤딩) */
  title: string;

  /** 프로젝트 목표 (**Goal:** 값) */
  goal: string;

  /** 아키텍처 설명 */
  architecture?: string;

  /** 기술 스택 목록 */
  techStack?: string[];

  /** 생성일 */
  created?: string;

  /** 현재 진행 중인 Phase 이름 */
  currentPhase?: string;

  /** Phase 목록 */
  phases: ParsedPhase[];
}

export interface ParsedPhase {
  /** Phase 번호 (1, 2, 3...) */
  number: number;

  /** Phase 이름 */
  name: string;

  /** Phase 설명/부제 */
  description?: string;

  /** 상태: completed, in_progress, pending */
  status: "completed" | "in_progress" | "pending";

  /** 이 Phase에 속한 태스크 목록 */
  tasks: ParsedTask[];

  /** 의존하는 Phase 번호 목록 */
  dependencies?: number[];

  /** 검증 기준 */
  verification?: string;

  /** 예상 기간 (예: "Week 1-2") */
  timeline?: string;
}

export interface ParsedTask {
  /** 태스크 ID (예: "1.1", "2-3", "Story 1.1") */
  id: string;

  /** 태스크 제목 */
  title: string;

  /** 완료 여부 ([x] = true, [ ] = false) */
  completed: boolean;

  /** 우선순위 (Epics Overview 테이블에서 추출) */
  priority?: "critical" | "high" | "medium" | "low";
}

// ---------------------------------------------------------------------------
// 3. 온보딩 결과
// ---------------------------------------------------------------------------

export interface OnboardingResult {
  /** 생성/재사용된 프로젝트 ID */
  projectId: string;

  /** 생성된 목표 ID */
  goalId: string;

  /** 채용된 에이전트 목록 */
  agents: Array<{
    id: string;
    name: string;
    role: AgentRole;
  }>;

  /** 생성된 이슈 목록 */
  issues: Array<{
    id: string;
    identifier: string;
    title: string;
    assigneeAgentId?: string;
  }>;

  /** 플랜 해시 (변경 감지용) */
  planHash: string;
}

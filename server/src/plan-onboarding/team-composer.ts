/**
 * Team Composer — LLM이 플랜을 분석하여 에이전트 팀 구성을 결정한다.
 *
 * 입력: ParsedPlan (파서 결과)
 * 출력: TeamComposition (역할 + 이름 + 담당 영역)
 *
 * 동작 방식:
 * 1. team_hint가 있으면 힌트를 참고하되 LLM이 최종 결정
 * 2. Tech Stack + Goal + Tasks를 분석하여 필요한 역할 판단
 * 3. 결과를 plan hash 기반으로 캐시 (동일 플랜 = 동일 팀)
 */

import { createHash } from "node:crypto";
import type { ParsedPlan } from "@paperclipai/shared";
import type { AgentRole, AgentAdapterType } from "@paperclipai/shared";

// ---------------------------------------------------------------------------
// 타입
// ---------------------------------------------------------------------------

export interface TeamMember {
  /** 에이전트 이름 */
  name: string;
  /** 역할 */
  role: AgentRole;
  /** 담당 영역 설명 */
  responsibility: string;
  /** 할당할 Phase 번호 목록 */
  phases: number[];
}

export interface TeamComposition {
  /** 팀 멤버 목록 (최소 1, 최대 8) */
  members: TeamMember[];
  /** LLM이 판단한 이유 */
  reasoning: string;
  /** 사용한 plan hash (캐시 키) */
  planHash: string;
}

// ---------------------------------------------------------------------------
// 메인 함수
// ---------------------------------------------------------------------------

const compositionCache = new Map<string, TeamComposition>();

export async function composeTeam(
  plan: ParsedPlan,
  options?: {
    apiKey?: string;
    model?: string;
    forceRefresh?: boolean;
  },
): Promise<TeamComposition> {
  const hash = computePlanHash(plan);

  // 캐시 확인
  if (!options?.forceRefresh && compositionCache.has(hash)) {
    return compositionCache.get(hash)!;
  }

  const apiKey =
    options?.apiKey || process.env.ANTHROPIC_API_KEY;

  let composition: TeamComposition;

  if (apiKey) {
    composition = await composeWithLLM(plan, hash, apiKey, options?.model);
  } else {
    // API 키 없으면 규칙 기반 폴백
    composition = composeWithRules(plan, hash);
  }

  compositionCache.set(hash, composition);
  return composition;
}

/** 캐시 초기화 (테스트용) */
export function clearCompositionCache(): void {
  compositionCache.clear();
}

// ---------------------------------------------------------------------------
// LLM 기반 팀 구성
// ---------------------------------------------------------------------------

async function composeWithLLM(
  plan: ParsedPlan,
  hash: string,
  apiKey: string,
  model = "claude-sonnet-4-20250514",
): Promise<TeamComposition> {
  const prompt = buildPrompt(plan);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    console.warn(
      `[team-composer] LLM API 실패 (${response.status}), 규칙 기반 폴백`,
    );
    return composeWithRules(plan, hash);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text: string }>;
  };

  const text = data.content?.[0]?.text ?? "";

  try {
    return parseTeamResponse(text, hash);
  } catch {
    console.warn("[team-composer] LLM 응답 파싱 실패, 규칙 기반 폴백");
    return composeWithRules(plan, hash);
  }
}

function buildPrompt(plan: ParsedPlan): string {
  const teamHint = plan.frontmatter.team_hint?.length
    ? `\n사용자 힌트: ${plan.frontmatter.team_hint.join(", ")}`
    : "";

  const phasesSummary = plan.phases
    .map(
      (p) =>
        `Phase ${p.number}: ${p.name} (${p.status}, ${p.tasks.length} tasks)`,
    )
    .join("\n");

  return `당신은 AI 에이전트 팀 구성 전문가입니다.
아래 프로젝트 계획서를 분석하여 필요한 에이전트 팀을 구성해주세요.

## 프로젝트 정보
- 이름: ${plan.frontmatter.project}
- 목표: ${plan.goal}
- 기술 스택: ${plan.techStack?.join(", ") || "미지정"}
- 아키텍처: ${plan.architecture || "미지정"}${teamHint}

## Phase 목록
${phasesSummary}

## 사용 가능한 역할
ceo, cto, engineer, designer, pm, qa, devops, researcher, general

## 규칙
1. 최소 1명, 최대 8명
2. CEO/PM 중 하나는 반드시 포함 (전체 조율 역할)
3. 각 에이전트에 담당 Phase를 배정
4. 이름은 역할을 반영한 영문명 (예: "Lead Engineer", "QA Specialist")

## 응답 형식 (반드시 JSON만 출력)
\`\`\`json
{
  "members": [
    {
      "name": "에이전트 이름",
      "role": "역할",
      "responsibility": "담당 영역 한 줄",
      "phases": [1, 2]
    }
  ],
  "reasoning": "팀 구성 이유 한 줄"
}
\`\`\``;
}

function parseTeamResponse(text: string, hash: string): TeamComposition {
  // JSON 블록 추출
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in response");

  const raw = JSON.parse(jsonMatch[1] || jsonMatch[0]) as {
    members: TeamMember[];
    reasoning: string;
  };

  // 검증: 1~8명
  if (!raw.members?.length || raw.members.length > 8) {
    throw new Error(`Invalid team size: ${raw.members?.length}`);
  }

  return {
    members: raw.members,
    reasoning: raw.reasoning || "LLM 자동 구성",
    planHash: hash,
  };
}

// ---------------------------------------------------------------------------
// 규칙 기반 폴백 (API 키 없거나 실패 시)
// ---------------------------------------------------------------------------

/** Tech Stack 키워드 → 역할 매핑 */
const TECH_ROLE_MAP: Record<string, AgentRole[]> = {
  // 프론트엔드
  "react": ["engineer"],
  "next.js": ["engineer"],
  "vue": ["engineer"],
  "tailwind": ["designer"],
  "three.js": ["engineer"],
  "astro": ["engineer"],
  // 백엔드
  "supabase": ["engineer"],
  "express": ["engineer"],
  "postgresql": ["engineer"],
  "node.js": ["engineer"],
  // 인프라
  "docker": ["devops"],
  "vercel": ["devops"],
  "aws": ["devops"],
  // AI
  "openai": ["engineer"],
  "anthropic": ["engineer"],
  "langchain": ["engineer"],
};

export function composeWithRules(
  plan: ParsedPlan,
  hash: string,
): TeamComposition {
  const roles = new Set<AgentRole>();

  // 1. team_hint 우선
  if (plan.frontmatter.team_hint?.length) {
    for (const hint of plan.frontmatter.team_hint) {
      roles.add(hint);
    }
  }

  // 2. Tech Stack 기반 역할 추가
  if (plan.techStack) {
    for (const tech of plan.techStack) {
      const lower = tech.toLowerCase();
      for (const [keyword, techRoles] of Object.entries(TECH_ROLE_MAP)) {
        if (lower.includes(keyword)) {
          for (const r of techRoles) roles.add(r);
        }
      }
    }
  }

  // 3. 기본: 최소 engineer 1명 + pm 1명
  if (!roles.has("ceo") && !roles.has("pm")) {
    roles.add("pm");
  }
  if (!roles.has("engineer")) {
    roles.add("engineer");
  }

  // 4. 태스크 수가 많으면 QA 추가
  const totalTasks = plan.phases.reduce((sum, p) => sum + p.tasks.length, 0);
  if (totalTasks > 10 && !roles.has("qa")) {
    roles.add("qa");
  }

  // 5. 멤버 생성
  const members: TeamMember[] = [];
  const allPhaseNums = plan.phases.map((p) => p.number);

  for (const role of roles) {
    members.push({
      name: generateAgentName(role, members.length),
      role,
      responsibility: ROLE_DESCRIPTIONS[role] || `${role} 담당`,
      phases: role === "pm" || role === "ceo" ? allPhaseNums : allPhaseNums,
    });
  }

  return {
    members: members.slice(0, 8),
    reasoning: `규칙 기반 구성: Tech Stack(${plan.techStack?.join(", ") || "없음"})에서 ${members.length}명 도출`,
    planHash: hash,
  };
}

// ---------------------------------------------------------------------------
// 유틸리티
// ---------------------------------------------------------------------------

const ROLE_DESCRIPTIONS: Partial<Record<AgentRole, string>> = {
  ceo: "프로젝트 전체 조율 및 의사결정",
  cto: "기술 아키텍처 및 코드 품질 관리",
  pm: "작업 분배, 진행 관리, 보고",
  engineer: "기능 개발 및 구현",
  designer: "UI/UX 디자인 및 프론트엔드 스타일링",
  qa: "테스트 작성 및 품질 검증",
  devops: "배포, CI/CD, 인프라 관리",
  researcher: "기술 조사 및 PoC",
};

function generateAgentName(role: AgentRole, index: number): string {
  const names: Partial<Record<AgentRole, string>> = {
    ceo: "Chief Executive",
    cto: "Tech Lead",
    pm: "Project Manager",
    engineer: index === 0 ? "Lead Engineer" : `Engineer ${index}`,
    designer: "UI Designer",
    qa: "QA Specialist",
    devops: "DevOps Engineer",
    researcher: "Tech Researcher",
    general: `Agent ${index + 1}`,
  };
  return names[role] || `${role} Agent`;
}

export function computePlanHash(plan: ParsedPlan): string {
  const content = JSON.stringify({
    project: plan.frontmatter.project,
    goal: plan.goal,
    techStack: plan.techStack,
    phases: plan.phases.map((p) => ({
      number: p.number,
      name: p.name,
      taskCount: p.tasks.length,
    })),
  });
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

/**
 * Plan Parser — task_plan.md → ParsedPlan
 *
 * 기존 task_plan.md 형식을 파싱하여 구조화된 데이터로 변환한다.
 * 외부 의존성 없이 regex + 문자열 처리로 동작.
 */

import { readFile } from "node:fs/promises";
import type {
  ParsedPlan,
  ParsedPhase,
  ParsedTask,
  PlanFrontmatter,
} from "@paperclipai/shared";
import {
  PLAN_FRONTMATTER_DEFAULTS,
  planFrontmatterSchema,
} from "@paperclipai/shared";
import { parseFrontmatter } from "./parse-frontmatter.js";

// ---------------------------------------------------------------------------
// 메인 파서
// ---------------------------------------------------------------------------

export async function parsePlanFile(filePath: string): Promise<ParsedPlan> {
  const raw = await readFile(filePath, "utf-8");
  return parsePlanContent(raw, filePath);
}

export function parsePlanContent(
  raw: string,
  sourcePath?: string,
): ParsedPlan {
  const { data: rawFm, content } = parseFrontmatter(raw);

  // frontmatter 검증 + 기본값 적용
  const frontmatter = buildFrontmatter(rawFm, sourcePath);

  // 본문 파싱
  const lines = content.split("\n");

  return {
    frontmatter,
    title: extractTitle(lines),
    goal: extractMeta(lines, "Goal") || "No goal specified",
    architecture: extractMeta(lines, "Architecture") || undefined,
    techStack: extractTechStack(lines),
    created: extractMeta(lines, "Created") || undefined,
    currentPhase: extractCurrentPhase(lines),
    phases: extractPhases(lines),
  };
}

// ---------------------------------------------------------------------------
// Frontmatter 처리
// ---------------------------------------------------------------------------

function buildFrontmatter(
  raw: Record<string, unknown>,
  sourcePath?: string,
): PlanFrontmatter {
  // project가 없으면 파일 경로에서 추론 시도
  if (!raw.project && sourcePath) {
    raw.project = inferProjectName(sourcePath);
  }

  const result = planFrontmatterSchema.safeParse(raw);

  if (!result.success) {
    // 검증 실패 시 기본값으로 폴백 (project는 필수이므로 에러 전파)
    if (!raw.project) {
      throw new Error(
        `plan frontmatter에 project가 필요합니다: ${result.error.message}`,
      );
    }
    return {
      ...PLAN_FRONTMATTER_DEFAULTS,
      project: String(raw.project),
      source_path: sourcePath,
    };
  }

  return { ...result.data, source_path: sourcePath };
}

/**
 * 파일 경로에서 프로젝트 이름 추론.
 *
 * 우선순위:
 * 1. ~/dev/{project}/docs/plans/... → project (프로젝트 내부 플랜)
 * 2. ~/dev/plans/{project}/...     → project (독립 플랜 디렉토리)
 * 3. 그 외 /dev/{name}/           → name
 */
function inferProjectName(filePath: string): string {
  // 1. /dev/{project}/docs/plans/ 패턴 (프로젝트 내부)
  const inProjectMatch = filePath.match(/\/dev\/([^/]+)\/docs\/plans\//);
  if (inProjectMatch) return inProjectMatch[1];

  // 2. /dev/plans/{project}/ 패턴 (독립 플랜 폴더)
  const standalonePlansMatch = filePath.match(/\/dev\/plans\/([^/.][^/]*)\//);
  if (standalonePlansMatch) return standalonePlansMatch[1];

  // 3. /dev/{name}/ 폴백
  const devMatch = filePath.match(/\/dev\/([^/]+)\//);
  if (devMatch) return devMatch[1];

  return "unknown";
}

// ---------------------------------------------------------------------------
// 본문 파싱 헬퍼
// ---------------------------------------------------------------------------

/** # 첫 번째 헤딩 추출 */
function extractTitle(lines: string[]): string {
  for (const line of lines) {
    const match = line.match(/^#\s+(.+)/);
    if (match) return match[1].trim();
  }
  return "Untitled Plan";
}

/** **Key:** Value 형식의 메타데이터 추출 */
function extractMeta(lines: string[], key: string): string | null {
  for (const line of lines) {
    const pattern = new RegExp(`^\\*\\*${key}:\\*\\*\\s*(.+)`, "i");
    const match = line.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

/** Tech Stack을 파싱하여 배열로 변환 */
function extractTechStack(lines: string[]): string[] | undefined {
  const raw = extractMeta(lines, "Tech Stack");
  if (!raw) return undefined;
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

/** Current Phase 섹션에서 현재 Phase 이름 추출 */
function extractCurrentPhase(lines: string[]): string | undefined {
  let inSection = false;
  for (const line of lines) {
    if (/^##\s+Current Phase/i.test(line)) {
      inSection = true;
      continue;
    }
    if (inSection && line.trim()) {
      // "Phase 1: Project Setup — Status: **completed**" 형식
      const match = line.match(/^(Phase\s+\d+[^—\-]*)/i);
      if (match) return match[1].trim();
      return line.trim();
    }
    if (inSection && /^##\s/.test(line)) break;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Phase & Task 파싱
// ---------------------------------------------------------------------------

/** ### Phase N: Name 패턴으로 Phase 목록 추출 */
function extractPhases(lines: string[]): ParsedPhase[] {
  const phases: ParsedPhase[] = [];
  let currentPhase: ParsedPhase | null = null;
  let inPhasesSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // ## Phases 또는 ## Phase 상세 섹션 시작 감지
    if (/^##\s+(Phases|Phase\s)/i.test(line)) {
      inPhasesSection = true;
    }

    // 다른 ## 섹션 (Decisions, Errors 등)이면 Phase 섹션 종료
    if (
      inPhasesSection &&
      /^##\s+(Decisions|Errors|Key Questions)/i.test(line)
    ) {
      if (currentPhase) phases.push(currentPhase);
      currentPhase = null;
      break;
    }

    // ### Phase N: Name 매칭
    const phaseMatch = line.match(
      /^###\s+Phase\s+(\d+)\s*[:：]\s*(.+?)(?:\s*\((.+?)\))?\s*$/,
    );
    if (phaseMatch) {
      if (currentPhase) phases.push(currentPhase);
      currentPhase = {
        number: parseInt(phaseMatch[1], 10),
        name: phaseMatch[2].trim(),
        status: "pending",
        tasks: [],
        timeline: phaseMatch[3]?.trim(),
      };
      continue;
    }

    if (!currentPhase) continue;

    // - [x] 또는 - [ ] 태스크 매칭
    const taskMatch = line.match(
      /^[-*]\s+\[([ xX])\]\s+(?:(?:Story\s+)?(\d[\d.-]*)\s*[:：.]\s*)?(.+)/,
    );
    if (taskMatch) {
      const task: ParsedTask = {
        id:
          taskMatch[2] ||
          `${currentPhase.number}.${currentPhase.tasks.length + 1}`,
        title: taskMatch[3].trim(),
        completed: taskMatch[1].toLowerCase() === "x",
      };
      currentPhase.tasks.push(task);
      continue;
    }

    // **Status:** 매칭 (줄 앞에 `- ` 등 접두사 허용)
    const statusMatch = line.match(
      /\*\*Status:\*\*\s*\*?\*?(completed|in_progress|pending|done)/i,
    );
    if (statusMatch) {
      const raw = statusMatch[1].toLowerCase();
      currentPhase.status =
        raw === "done" || raw === "completed"
          ? "completed"
          : raw === "in_progress"
            ? "in_progress"
            : "pending";
      continue;
    }

    // **의존:** Phase N 매칭
    const depMatch = line.match(/\*\*의존:\*\*\s*Phase\s+([\d,\s]+)/i);
    if (depMatch) {
      currentPhase.dependencies = depMatch[1]
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n));
      continue;
    }

    // **검증:** 매칭
    const verifyMatch = line.match(/\*\*검증[^:]*:\*\*\s*(.+)/);
    if (verifyMatch) {
      currentPhase.verification = verifyMatch[1].trim();
    }
  }

  // 마지막 Phase 추가
  if (currentPhase) phases.push(currentPhase);

  return phases;
}

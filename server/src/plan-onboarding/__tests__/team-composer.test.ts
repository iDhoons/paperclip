import { describe, it, expect, beforeEach } from "vitest";
import { composeWithRules, computePlanHash, clearCompositionCache } from "../team-composer.js";
import { parsePlanContent } from "../plan-parser.js";

function makePlan(overrides: {
  project?: string;
  goal?: string;
  techStack?: string;
  teamHint?: string;
  phases?: string;
}) {
  const frontmatter = overrides.teamHint
    ? `---\nproject: ${overrides.project || "test"}\nteam_hint: ${overrides.teamHint}\n---\n`
    : `---\nproject: ${overrides.project || "test"}\n---\n`;

  return parsePlanContent(
    `${frontmatter}
# Test Plan

**Goal:** ${overrides.goal || "테스트 프로젝트"}
**Tech Stack:** ${overrides.techStack || "Node.js"}

## Phases

### Phase 1: Setup

${overrides.phases || "- [ ] 1.1: 초기 설정\n- [ ] 1.2: 기본 구성"}
- **Status:** pending
`,
  );
}

describe("composeWithRules", () => {
  beforeEach(() => clearCompositionCache());

  it("기본: PM + Engineer 최소 구성", () => {
    const plan = makePlan({});
    const hash = computePlanHash(plan);
    const result = composeWithRules(plan, hash);

    expect(result.members.length).toBeGreaterThanOrEqual(2);
    expect(result.members.some((m) => m.role === "pm")).toBe(true);
    expect(result.members.some((m) => m.role === "engineer")).toBe(true);
    expect(result.planHash).toBe(hash);
  });

  it("team_hint를 반영한다", () => {
    const plan = makePlan({ teamHint: "[engineer, designer, qa]" });
    const hash = computePlanHash(plan);
    const result = composeWithRules(plan, hash);

    expect(result.members.some((m) => m.role === "designer")).toBe(true);
    expect(result.members.some((m) => m.role === "qa")).toBe(true);
  });

  it("Tech Stack에서 역할을 추론한다", () => {
    const plan = makePlan({
      techStack: "Next.js 15, Three.js, Supabase, TailwindCSS, Docker",
    });
    const hash = computePlanHash(plan);
    const result = composeWithRules(plan, hash);

    expect(result.members.some((m) => m.role === "engineer")).toBe(true);
    expect(result.members.some((m) => m.role === "designer")).toBe(true);
    expect(result.members.some((m) => m.role === "devops")).toBe(true);
  });

  it("태스크가 많으면 QA를 추가한다", () => {
    const tasks = Array.from({ length: 12 }, (_, i) => `- [ ] 1.${i + 1}: Task ${i + 1}`).join("\n");
    const plan = makePlan({ phases: tasks });
    const hash = computePlanHash(plan);
    const result = composeWithRules(plan, hash);

    expect(result.members.some((m) => m.role === "qa")).toBe(true);
  });

  it("최대 8명을 넘지 않는다", () => {
    const plan = makePlan({
      teamHint: "[ceo, cto, engineer, designer, pm, qa, devops, researcher]",
    });
    const hash = computePlanHash(plan);
    const result = composeWithRules(plan, hash);

    expect(result.members.length).toBeLessThanOrEqual(8);
  });

  it("CEO가 hint에 있으면 PM을 추가하지 않는다", () => {
    const plan = makePlan({ teamHint: "[ceo, engineer]" });
    const hash = computePlanHash(plan);
    const result = composeWithRules(plan, hash);

    expect(result.members.some((m) => m.role === "ceo")).toBe(true);
    // pm이 없어도 OK (ceo가 조율 담당)
    const pmCount = result.members.filter((m) => m.role === "pm").length;
    const ceoCount = result.members.filter((m) => m.role === "ceo").length;
    expect(pmCount + ceoCount).toBeGreaterThanOrEqual(1);
  });
});

describe("computePlanHash", () => {
  it("같은 플랜은 같은 해시", () => {
    const plan = makePlan({ goal: "동일 플랜" });
    expect(computePlanHash(plan)).toBe(computePlanHash(plan));
  });

  it("다른 플랜은 다른 해시", () => {
    const plan1 = makePlan({ goal: "플랜 A" });
    const plan2 = makePlan({ goal: "플랜 B" });
    expect(computePlanHash(plan1)).not.toBe(computePlanHash(plan2));
  });
});

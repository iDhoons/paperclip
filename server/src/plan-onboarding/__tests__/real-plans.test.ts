import { describe, it, expect } from "vitest";
import { parsePlanFile } from "../plan-parser.js";
import { existsSync } from "node:fs";

const REAL_PLANS = [
  {
    path: "/Users/daehoonkim/dev/aichatbot/docs/plans/in-progress/mvp/task_plan.md",
    expectedProject: "aichatbot",  // /dev/{project}/docs/plans/ 패턴
    minPhases: 3,
  },
  {
    path: "/Users/daehoonkim/dev/plans/claudewind-bot/task_plan.md",
    expectedProject: "claudewind-bot",
    minPhases: 1,
  },
];

describe("실제 플랜 파일 파싱", () => {
  for (const plan of REAL_PLANS) {
    const exists = existsSync(plan.path);

    it.skipIf(!exists)(`${plan.expectedProject} 파싱`, async () => {
      const result = await parsePlanFile(plan.path);

      // 기본 구조 검증
      expect(result.frontmatter.project).toBe(plan.expectedProject);
      expect(result.title).toBeTruthy();
      expect(result.goal).toBeTruthy();
      expect(result.phases.length).toBeGreaterThanOrEqual(plan.minPhases);

      // 모든 Phase에 최소 1개 태스크
      for (const phase of result.phases) {
        expect(phase.number).toBeGreaterThan(0);
        expect(phase.name).toBeTruthy();
        expect(phase.tasks.length).toBeGreaterThan(0);
      }

      // 디버그 출력
      console.log(`\n=== ${plan.expectedProject} ===`);
      console.log(`title: ${result.title}`);
      console.log(`goal: ${result.goal.slice(0, 60)}...`);
      console.log(`techStack: ${result.techStack?.join(", ")}`);
      console.log(`phases: ${result.phases.length}`);
      result.phases.forEach((p) =>
        console.log(`  Phase ${p.number}: ${p.name} | ${p.status} | ${p.tasks.length} tasks`),
      );
    });
  }
});

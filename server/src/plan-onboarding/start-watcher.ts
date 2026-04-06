/**
 * Plan Watcher 서버 연동 — Paperclip 서버 시작 시 호출
 *
 * ~/dev/ 하위의 task_plan.md 변경을 감지하여
 * 자동으로 onboard-plan API를 호출한다.
 */

import { homedir } from "node:os";
import { join } from "node:path";
import { createPlanWatcher } from "./plan-watcher.js";
import { parsePlanContent } from "./plan-parser.js";
import { composeTeam } from "./team-composer.js";
import { previewOnboarding } from "./orchestrator.js";

const DEV_DIR = join(homedir(), "dev");

interface StartOptions {
  /** Paperclip 서버 URL (기본: http://localhost:3100) */
  serverUrl?: string;
  /** 감시할 디렉토리 (기본: ~/dev) */
  watchPaths?: string[];
}

export function startPlanWatcher(options?: StartOptions) {
  const serverUrl = options?.serverUrl || "http://localhost:3100";
  const watchPaths = options?.watchPaths || [DEV_DIR];

  const watcher = createPlanWatcher({
    watchPaths,
    onPlanChanged: async (filePath, content) => {
      console.log(`[plan-watcher] 변경 감지: ${filePath}`);

      try {
        // 1. 파싱
        const plan = parsePlanContent(content, filePath);

        // frontmatter에 project가 없으면 무시
        if (plan.frontmatter.project === "unknown") {
          console.log(`[plan-watcher] project 미지정, 건너뜀: ${filePath}`);
          return;
        }

        // 2. 프리뷰 (팀 구성)
        const team = await composeTeam(plan);
        const preview = previewOnboarding(plan, team);

        console.log(
          `[plan-watcher] 프리뷰: ${preview.project.name}` +
          ` | 에이전트 ${preview.agents.length}명` +
          ` | 이슈 ${preview.issues.length}건`,
        );

        // 3. 첫 번째 회사 조회
        const companiesRes = await fetch(`${serverUrl}/api/companies`);
        if (!companiesRes.ok) {
          console.error("[plan-watcher] 회사 조회 실패");
          return;
        }
        const companies = (await companiesRes.json()) as Array<{ id: string; name: string }>;
        if (!companies.length) {
          console.error("[plan-watcher] 회사 없음 — 먼저 회사를 생성하세요");
          return;
        }
        const companyId = companies[0].id;

        // 4. 온보딩 API 호출
        const res = await fetch(
          `${serverUrl}/api/companies/${companyId}/onboard-plan`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content, filePath }),
          },
        );

        if (res.ok) {
          const result = await res.json() as {
            projectId: string;
            agents: Array<{ name: string }>;
            issues: Array<{ identifier: string }>;
          };
          console.log(
            `[plan-watcher] 온보딩 완료!` +
            ` 프로젝트: ${result.projectId}` +
            ` | 에이전트 ${result.agents.length}명` +
            ` | 이슈 ${result.issues.length}건`,
          );
        } else {
          const err = await res.json().catch(() => ({})) as { error?: string };
          console.error(
            `[plan-watcher] 온보딩 실패 (${res.status}):`,
            err.error || "알 수 없는 에러",
          );
        }
      } catch (err) {
        console.error(
          "[plan-watcher] 처리 실패:",
          err instanceof Error ? err.message : err,
        );
      }
    },
  });

  watcher.start();
  return watcher;
}

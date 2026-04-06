import { Router } from "express";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import type { Db } from "@paperclipai/db";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { logActivity } from "../services/index.js";
import {
  parsePlanContent,
  parsePlanFile,
  composeTeam,
  previewOnboarding,
  onboardFromPlan,
} from "../plan-onboarding/index.js";

export function planOnboardingRoutes(db: Db) {
  const router = Router();

  // -------------------------------------------------------------------------
  // POST /companies/:companyId/onboard-plan
  // 플랜 내용을 받아서 온보딩 실행 (또는 프리뷰)
  // -------------------------------------------------------------------------
  router.post(
    "/companies/:companyId/onboard-plan",
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const { content, filePath, dryRun } = req.body as {
        content?: string;
        filePath?: string;
        dryRun?: boolean;
      };

      // 입력 검증: content 또는 filePath 중 하나 필수
      if (!content && !filePath) {
        res.status(400).json({
          error: "content 또는 filePath 중 하나가 필요합니다",
        });
        return;
      }

      try {
        // 1. 플랜 파싱
        let plan;
        if (filePath) {
          if (!existsSync(filePath)) {
            res.status(404).json({ error: `파일을 찾을 수 없습니다: ${filePath}` });
            return;
          }
          plan = await parsePlanFile(filePath);
        } else {
          plan = parsePlanContent(content!);
        }

        // 2. 팀 구성
        const team = await composeTeam(plan);

        // 3. 프리뷰 모드
        if (dryRun) {
          const preview = previewOnboarding(plan, team);
          res.json({
            dryRun: true,
            plan: preview,
            team: {
              members: team.members,
              reasoning: team.reasoning,
            },
          });
          return;
        }

        // 4. 실제 온보딩 실행
        const actor = getActorInfo(req);
        const result = await onboardFromPlan(db, plan, team, {
          companyId,
          userId: actor.actorId,
        });

        // 5. 활동 로그
        await logActivity(db, {
          companyId,
          actorType: actor.actorType,
          actorId: actor.actorId,
          agentId: actor.agentId,
          action: "plan.onboarded",
          entityType: "project",
          entityId: result.projectId,
          details: {
            project: plan.frontmatter.project,
            agentCount: result.agents.length,
            issueCount: result.issues.length,
            planHash: result.planHash,
          },
        });

        res.status(201).json(result);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "온보딩 실패";
        res.status(500).json({ error: message });
      }
    },
  );

  // -------------------------------------------------------------------------
  // POST /companies/:companyId/parse-plan
  // 플랜만 파싱 (온보딩 없이 결과 확인)
  // -------------------------------------------------------------------------
  router.post(
    "/companies/:companyId/parse-plan",
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const { content, filePath } = req.body as {
        content?: string;
        filePath?: string;
      };

      if (!content && !filePath) {
        res.status(400).json({
          error: "content 또는 filePath 중 하나가 필요합니다",
        });
        return;
      }

      try {
        const plan = filePath
          ? await parsePlanFile(filePath)
          : parsePlanContent(content!);

        res.json(plan);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "파싱 실패";
        res.status(400).json({ error: message });
      }
    },
  );

  return router;
}

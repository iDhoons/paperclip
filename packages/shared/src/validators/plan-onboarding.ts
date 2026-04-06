import { z } from "zod";
import { AGENT_ADAPTER_TYPES, AGENT_ROLES } from "../constants.js";

// ---------------------------------------------------------------------------
// Frontmatter 검증 스키마
// ---------------------------------------------------------------------------

export const planFrontmatterSchema = z
  .object({
    project: z
      .string()
      .min(1, "project는 필수입니다"),

    adapter: z
      .enum(AGENT_ADAPTER_TYPES)
      .optional()
      .default("claude_local"),

    budget: z
      .number()
      .int()
      .nonnegative("budget은 0 이상이어야 합니다")
      .optional()
      .default(0),

    team_hint: z
      .array(z.enum(AGENT_ROLES))
      .optional()
      .default([]),

    auto_assign: z
      .boolean()
      .optional()
      .default(true),

    source_path: z
      .string()
      .optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// 파싱된 태스크 검증
// ---------------------------------------------------------------------------

export const parsedTaskSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  completed: z.boolean(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional(),
});

export const parsedPhaseSchema = z.object({
  number: z.number().int().positive(),
  name: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(["completed", "in_progress", "pending"]),
  tasks: z.array(parsedTaskSchema),
  dependencies: z.array(z.number().int().positive()).optional(),
  verification: z.string().optional(),
  timeline: z.string().optional(),
});

export const parsedPlanSchema = z.object({
  frontmatter: planFrontmatterSchema,
  title: z.string().min(1),
  goal: z.string().min(1),
  architecture: z.string().optional(),
  techStack: z.array(z.string()).optional(),
  created: z.string().optional(),
  currentPhase: z.string().optional(),
  phases: z.array(parsedPhaseSchema),
});

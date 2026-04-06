import { describe, it, expect } from "vitest";
import { parsePlanContent } from "../plan-parser.js";

describe("parsePlanContent", () => {
  it("frontmatter가 있는 플랜을 파싱한다", () => {
    const input = `---
project: deck-planner
adapter: claude_local
team_hint: [engineer, designer]
---

# Deck Planner MVP

**Goal:** 데크 시각화 웹앱 MVP 완성
**Architecture:** Next.js 15 + Three.js + Supabase
**Tech Stack:** Next.js 15, Three.js, Supabase, TailwindCSS
**Created:** 2026-04-01

---

## Current Phase

Phase 1: Project Setup — Status: **completed**

---

## Phases

### Phase 1: Project Setup (Week 1-2)

- [x] 1.1: Next.js 프로젝트 초기화
- [x] 1.2: Supabase 연결 설정
- [ ] 1.3: Three.js 기본 씬 구성
- **Status:** **completed**
- **검증:** pnpm dev 정상 실행

### Phase 2: Core Features (Week 3-4)

- [ ] 2.1: 데크 3D 모델 렌더링
- [ ] 2.2: 자재 선택 UI
- **Status:** pending
- **의존:** Phase 1
- **검증:** 3D 모델 표시 확인

---

## Decisions Made

| # | Decision | Rationale | Date |
|---|----------|-----------|------|
| 1 | Three.js 사용 | 가볍고 커뮤니티 활성 | 2026-04-01 |
`;

    const result = parsePlanContent(input, "/dev/deck-planner/docs/plans/mvp/task_plan.md");

    // frontmatter
    expect(result.frontmatter.project).toBe("deck-planner");
    expect(result.frontmatter.adapter).toBe("claude_local");
    expect(result.frontmatter.team_hint).toEqual(["engineer", "designer"]);
    expect(result.frontmatter.auto_assign).toBe(true); // 기본값

    // 메타데이터
    expect(result.title).toBe("Deck Planner MVP");
    expect(result.goal).toContain("데크 시각화");
    expect(result.techStack).toEqual(["Next.js 15", "Three.js", "Supabase", "TailwindCSS"]);
    expect(result.created).toBe("2026-04-01");

    // current phase
    expect(result.currentPhase).toContain("Phase 1");

    // phases
    expect(result.phases).toHaveLength(2);

    const phase1 = result.phases[0];
    expect(phase1.number).toBe(1);
    expect(phase1.name).toBe("Project Setup");
    expect(phase1.status).toBe("completed");
    expect(phase1.timeline).toBe("Week 1-2");
    expect(phase1.tasks).toHaveLength(3);
    expect(phase1.tasks[0].completed).toBe(true);
    expect(phase1.tasks[2].completed).toBe(false);
    expect(phase1.verification).toContain("pnpm dev");

    const phase2 = result.phases[1];
    expect(phase2.number).toBe(2);
    expect(phase2.status).toBe("pending");
    expect(phase2.dependencies).toEqual([1]);
    expect(phase2.tasks).toHaveLength(2);
  });

  it("frontmatter가 없는 플랜도 파싱한다 (경로에서 프로젝트 추론)", () => {
    const input = `# claudewind-bot Refactoring Plan

**Goal:** 안정적 개인 비서 봇
**Tech Stack:** Node.js, grammy, claude-agent-sdk

## Phases

### Phase 1: 안정화

- [ ] 1-1. unhandledRejection 핸들러 추가
- [x] 1-2. grammy auto-retry 추가
- **Status:** **completed**
`;

    const result = parsePlanContent(input, "/Users/daehoonkim/dev/plans/claudewind-bot/task_plan.md");

    expect(result.frontmatter.project).toBe("claudewind-bot");
    expect(result.frontmatter.adapter).toBe("claude_local"); // 기본값
    expect(result.title).toContain("claudewind-bot");
    expect(result.phases).toHaveLength(1);
    expect(result.phases[0].tasks).toHaveLength(2);
  });

  it("Purpose 필드를 파싱한다", () => {
    const input = `---
project: deck-planner
---

# Deck Planner

**Purpose:** 데크 시공 시장의 디지털 전환을 가속화
**Goal:** 자재 견적 자동화 웹앱 MVP 완성
**Tech Stack:** Next.js 15, Three.js

## Phases

### Phase 1: Setup

- [ ] 1.1: 프로젝트 초기화
`;

    const result = parsePlanContent(input);

    expect(result.purpose).toBe("데크 시공 시장의 디지털 전환을 가속화");
    expect(result.goal).toBe("자재 견적 자동화 웹앱 MVP 완성");
  });

  it("Purpose가 없으면 undefined이다", () => {
    const input = `---
project: test
---

# Test

**Goal:** 테스트 목표

## Phases

### Phase 1: Setup

- [ ] 1.1: 태스크
`;

    const result = parsePlanContent(input);

    expect(result.purpose).toBeUndefined();
    expect(result.goal).toBe("테스트 목표");
  });

  it("Story 형식 태스크를 파싱한다", () => {
    const input = `---
project: aichatbot
---

# aichatbot MVP

**Goal:** 챗봇 MVP

## Phases

### Phase 1: Setup (Week 1-2)

- [x] Story 1.1: Next.js 프로젝트 초기화
- [x] Story 1.2: DB 스키마 생성
- [ ] Story 1.3: 시드 데이터
- **Status:** **done**
`;

    const result = parsePlanContent(input);

    expect(result.phases[0].tasks[0].id).toBe("1.1");
    expect(result.phases[0].tasks[0].title).toBe("Next.js 프로젝트 초기화");
    expect(result.phases[0].status).toBe("completed"); // done → completed
  });
});

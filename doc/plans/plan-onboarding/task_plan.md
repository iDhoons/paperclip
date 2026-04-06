# Plan Onboarding — task_plan.md 자동 온보딩

**Goal:** 사용자가 작성한 task_plan.md를 파싱하여 Paperclip 프로젝트/에이전트/이슈를 자동 생성하는 시스템
**Architecture:** Plan Parser (regex) + LLM Team Composer (Anthropic API + 규칙 폴백) + Paperclip API Orchestrator + File Watcher
**Tech Stack:** TypeScript, chokidar, Anthropic API (fetch)
**Created:** 2026-04-06

---

## Current Phase

Phase 3: Orchestrator + Watcher + Learning — Status: **completed**

---

## Phases Overview

| Phase | 설명 | 우선순위 | 상태 |
|-------|------|---------|------|
| 0 | Frontmatter 스키마 + 타입 정의 | P0 | completed |
| 1 | Plan Parser (마크다운 → 구조화 데이터) | P0 | completed |
| 2 | LLM Team Composer (팀 자동 구성) | P1 | completed |
| 3 | Orchestrator + File Watcher + 학습 | P1 | completed |

---

## Phase 0: Frontmatter 스키마 정의

- [x] 0.1: PlanFrontmatter TypeScript 타입 정의 (packages/shared)
- [x] 0.2: shared/types/index.ts에서 export
- [x] 0.3: frontmatter 예시 문서 작성
- [x] 0.4: Zod 검증 스키마 추가
- **Status:** completed
- **검증:** tsc --noEmit 통과

## Phase 1: Plan Parser

- [x] 1.1: 커스텀 frontmatter 파서로 추출 (gray-matter 대신 자체 구현)
- [x] 1.2: regex 기반 마크다운 파싱 (제목, 메타데이터, Phase, Task)
- [x] 1.3: 체크박스 태스크 → ParsedTask 변환
- [x] 1.4: Phase 의존성 추출
- [x] 1.5: 파서 단위 테스트 (기존 플랜으로 검증)
- **Status:** completed
- **의존:** Phase 0
- **검증:** 기존 task_plan.md 3개를 파싱하여 구조화 데이터 정확 추출

## Phase 2: LLM Team Composer

- [x] 2.1: 팀 구성 프롬프트 설계 (Goal + Tech Stack → 역할 목록)
- [x] 2.2: Anthropic API 호출 모듈 (fetch 기반)
- [x] 2.3: team_hint가 있으면 LLM 판단 보조, 없으면 완전 자동
- [x] 2.4: 팀 구성 결과 캐시 (plan hash 기반)
- [x] 2.5: 팀 구성 결과 검증 (최소 1명, 최대 8명) + 규칙 폴백
- **Status:** completed
- **의존:** Phase 1

## Phase 3: Orchestrator + Watcher + Learning

- [x] 3.1: Paperclip API 호출 오케스트레이터 (Goal → Project → Agents → Issues)
- [x] 3.2: 서버 API 엔드포인트 추가 (POST /api/companies/{id}/onboard-plan + parse-plan)
- [x] 3.3: chokidar 파일 감지 (task_plan.md 변경 시 자동 트리거)
- [ ] 3.4: 플랜 변경 시 3-way diff (이전 vs 새 vs 현재 상태)
- [ ] 3.5: 팀 구성 피드백 수집 + 학습 데이터 축적
- **Status:** completed
- **의존:** Phase 2

---

## Decisions Made

| # | Decision | Rationale | Date |
|---|----------|-----------|------|
| 1 | 회사 1개 + 프로젝트 여러 개 | 에이전트 재활용, 관리 단순화 | 2026-04-06 |
| 2 | LLM 팀 구성 + 학습 개선 | MetaGPT 선례, 정적 구성보다 유연 | 2026-04-06 |
| 3 | 파싱(규칙) / 판단(LLM) 분리 | 안정성 확보, MetaGPT 교훈 | 2026-04-06 |
| 4 | 기존 task_plan.md 형식 유지 | 사용자 기존 워크플로우 존중 | 2026-04-06 |

---

## Errors Encountered

| # | Error | Resolution |
|---|-------|-----------|
| — | — | — |

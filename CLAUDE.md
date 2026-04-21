# Paperclip — Context Vault

> 이 파일은 세션 시작 시 자동 로드되는 프로젝트 컨텍스트.
> 상세 규칙은 AGENTS.md 참조. 여기는 빠른 오리엔테이션용.

## What

AI 에이전트 회사를 관리하는 컨트롤 플레인. 에이전트 채용/해고, 태스크 할당, 예산 관리, 거버넌스를 제공.

## Tech Stack

| 계층 | 기술 |
|------|------|
| Server | Express + TypeScript |
| UI | React + Vite |
| DB | PostgreSQL (dev: PGlite), Drizzle ORM |
| Adapters | Claude Code, Codex, Cursor 등 |
| Monorepo | pnpm workspace |
| Test | Vitest |

## Quick Reference

| 항목 | 값 |
|------|---|
| Dev 서버 | `pnpm dev` → localhost:3100 |
| 빌드 검증 | `pnpm -r typecheck && pnpm test:run && pnpm build` |
| DB 마이그레이션 | schema 수정 → `pnpm db:generate` |
| DB 리셋 | `rm -rf data/pglite && pnpm dev` |

## Repo Map (요약)

- `server/` — Express REST API + 오케스트레이션
- `ui/` — React 보드 UI
- `packages/db/` — Drizzle 스키마, 마이그레이션
- `packages/shared/` — 공유 타입, 상수, 밸리데이터
- `packages/adapters/` — 에이전트 어댑터
- `doc/` — 운영/제품 문서 (SPEC, GOAL, PRODUCT)

## 필수 문서 (상세 내용은 여기 참조)

1. **AGENTS.md** — 엔지니어링 규칙, DB 워크플로, PR 요구사항, DoD
2. **doc/SPEC-implementation.md** — V1 빌드 계약서
3. **doc/GOAL.md** — 프로젝트 목표
4. **doc/DEVELOPING.md** — 개발 환경 상세

## 핵심 불변식 (AGENTS.md에서 발췌)

- 모든 도메인 엔티티는 company 스코프
- 변경 시 db → shared → server → ui 계약 동기화 필수
- Single-assignee 태스크 모델
- 에이전트 API 키는 해시 저장, 타사 접근 불가

## 나의 워크플로 (회장)

- 굵직한 기능은 직접 구현, QA/버그는 에이전트 위임
- 태스크 완료 → in_review + 리뷰어 할당
- human 라벨: 사람 직접 작업 / needs-review 라벨: 에이전트 작업 후 검토

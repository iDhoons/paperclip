# Plan Onboarding — Frontmatter 명세

## 사용법

기존 task_plan.md 맨 위에 `---`로 감싼 YAML 블록을 추가한다.
기존 내용은 한 글자도 바꿀 필요 없다.

## Before / After

### Before (기존 그대로)
```markdown
# aichatbot MVP Implementation Plan

**Goal:** 건설자재 업체의 고객 문의를 자동 답변하는 챗봇
**Tech Stack:** Next.js 15, Supabase, OpenAI
...
```

### After (frontmatter 3줄 추가)
```markdown
---
project: aichatbot
---

# aichatbot MVP Implementation Plan

**Goal:** 건설자재 업체의 고객 문의를 자동 답변하는 챗봇
**Tech Stack:** Next.js 15, Supabase, OpenAI
...
```

## 필드 정의

| 필드 | 필수 | 타입 | 기본값 | 설명 |
|------|------|------|--------|------|
| `project` | **필수** | string | — | Paperclip 프로젝트 이름 |
| `adapter` | 선택 | string | `claude_local` | AI 어댑터 (claude_local, codex_local, gemini_local 등) |
| `budget` | 선택 | number | `0` | 월 예산 상한 (센트). 0 = 무제한 |
| `team_hint` | 선택 | string[] | `[]` | 팀 구성 힌트 (engineer, designer, qa 등) |
| `auto_assign` | 선택 | boolean | `true` | 이슈를 에이전트에 자동 할당 |

## 예시: 최소 (필수만)

```yaml
---
project: deck-planner
---
```

## 예시: 팀 힌트 포함

```yaml
---
project: deck-planner
adapter: claude_local
team_hint: [engineer, designer, qa]
budget: 5000
---
```

## 예시: 자동 할당 끄기 (수동 배정)

```yaml
---
project: triplan
auto_assign: false
---
```

## 규칙

1. `project`만 필수. 나머지는 전부 생략 가능
2. frontmatter가 없는 플랜도 파서는 처리 가능 (project를 파일 경로에서 추론)
3. `team_hint`는 참고용. LLM이 최종 판단하므로 힌트와 다른 팀이 나올 수 있음
4. `adapter`는 Paperclip이 지원하는 어댑터만 허용 (검증 에러 발생)

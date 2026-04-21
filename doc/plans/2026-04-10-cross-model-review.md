# 크로스모델 리뷰 (Cross-Model Review) 구현 계획

## Context

Paperclip은 현재 single-assignee 모델로, 태스크당 1개 에이전트만 할당 가능.
원래 "동시 협업(페어 프로그래밍)"을 설계했으나, ROI 분석 결과 **순차적 크로스모델 리뷰**가 비용/품질/구현 복잡도 모두에서 우위로 판명.
기존 `in_review` 상태 + 에이전트 웨이크업 메커니즘을 활용하는 최소 변경.

## 핵심 플로우

```
[생성] 이슈에 assigneeAgentId + reviewerAgentId 지정
   ↓
[구현] assignee가 작업 → in_review로 전환
   ↓ 시스템이 reviewer 자동 웨이크업 (payload: { reviewReason: "cross_model_review" })
[리뷰] reviewer가 코드 검토 → approve / request_changes
   ↓
approve → reviewStatus 저장, done 전환 가능
request_changes → in_progress 복귀 + assignee 웨이크업 + activity log
```

## 수정 파일 목록

### 1. DB 스키마: `packages/db/src/schema/issues.ts`
- `reviewerAgentId` 컬럼 추가: `uuid("reviewer_agent_id").references(() => agents.id)`
- `reviewStatus` 컬럼 추가: `text("review_status")` — `"pending" | "approved" | "changes_requested" | null`
- 인덱스 추가: `(companyId, reviewerAgentId, status)` (assigneeStatusIdx와 동일 패턴)

### 2. Shared 타입: `packages/shared/src/types/issue.ts`
- `Issue` 인터페이스에 `reviewerAgentId: string | null` + `reviewStatus: string | null` 추가
- `IssueAncestor`는 변경하지 않음 (요약 뷰에 reviewer 불필요)

### 3. Shared 상수: `packages/shared/src/constants.ts`
- `REVIEW_STATUSES = ["pending", "approved", "changes_requested"] as const` 추가
- `REVIEW_STATUS` 타입 추가

### 4. Shared 검증: `packages/shared/src/validators/issue.ts`
- `createIssueSchema`에 `reviewerAgentId: z.string().uuid().optional().nullable()` 추가
  - `updateIssueSchema = createIssueSchema.partial().extend(...)` 이므로 자동 포함됨
- `updateIssueSchema`에 `.refine()` 추가: `reviewerAgentId !== assigneeAgentId` (자기 리뷰 방지)
- 새 스키마: `submitReviewSchema = z.object({ result: z.enum(REVIEW_STATUSES).exclude(["pending"]), comment: z.string().optional() })`

### 5. 서비스: `server/src/services/issues.ts`

#### 5a. `update()` 함수 내 in_review 전환 감지 (~line 1382 `applyStatusSideEffects` 근처)
```typescript
// applyStatusSideEffects() 이후, 트랜잭션 완료 후(then 블록 내)
if (patch.status === "in_review" && existing.reviewerAgentId) {
  // reviewerAgentId에 대해 company 스코프 검증
  await assertAssignableAgent(existing.companyId, existing.reviewerAgentId);
  // reviewer 웨이크업 (reason으로 "review_requested" 명시)
  void queueIssueAssignmentWakeup({
    heartbeat,
    issue: { ...updated, assigneeAgentId: existing.reviewerAgentId },
    reason: "review_requested",
    mutation: "status_change",
    contextSource: "issue.update.to_in_review",
  });
}
```

#### 5b. done 전환 시 리뷰 게이팅
```typescript
// patch.status === "done" && existing.reviewerAgentId && existing.reviewStatus !== "approved"
// → throw unprocessable("Issue with reviewer requires review approval before completion")
```

#### 5c. `submitReview(issueId, reviewerAgentId, result, comment)` 함수 추가
```typescript
// db.transaction() 내에서 원자적으로 처리:
// 1. 이슈 조회 + reviewerAgentId 검증 + company 스코프 확인
// 2. reviewStatus 업데이트
// 3. result === "approved": status 유지 (done은 별도 update로)
// 4. result === "changes_requested": status → in_progress, checkoutRunId/executionRunId → null
// 5. comment가 있으면 issueComments에 추가
// 트랜잭션 커밋 후:
// 6. logActivity({ action: "issue.review_submitted", ... })
// 7. changes_requested 시 assignee 웨이크업
```

### 6. 라우트: `server/src/routes/issues.ts`
- `POST /issues/:id/review` 엔드포인트 추가 (checkout/release 패턴과 동일)
  - Agent API key 인증 (기존 `requireAgentAuth` 패턴 재사용)
  - `reviewerAgentId === req.body.agentId` 검증
  - 이슈 상태가 `in_review`인지 확인
  - `reviewStatus === "approved"`면 이미 승인된 것이므로 409
  - `logActivity({ action: "issue.review_submitted" })` 호출

### 7. 에러 케이스 처리
| 케이스 | 처리 |
|--------|------|
| `reviewerAgentId === assigneeAgentId` | validator `.refine()`으로 생성/수정 시 차단 |
| reviewer가 다른 company 소속 | `assertAssignableAgent(companyId, reviewerAgentId)`에서 차단 (기존 함수) |
| reviewer 삭제/비활성화 | 웨이크업 실패 시 로그만 남기고 무시 (기존 `.catch()` 패턴) |
| 리뷰 대기 중 이슈 취소 | 취소는 독립적, reviewer에게 wakeup 불필요 |
| 이미 승인된 리뷰 재제출 | `reviewStatus === "approved"`면 409 Conflict |

## 테스트 계획

### 단위 테스트: `server/src/__tests__/issue-review.test.ts`
- `submitReview`: 정상 승인 → reviewStatus 변경 확인
- `submitReview`: changes_requested → status in_progress 복귀 + comment 생성
- `submitReview`: 잘못된 agentId → 403
- `submitReview`: 이미 승인된 이슈 → 409
- `submitReview`: reviewerAgentId 없는 이슈 → 422
- `createIssue`: reviewerAgentId === assigneeAgentId → validation error

### 통합 테스트
- `update`에서 `in_review` 전환 시 reviewer wakeup 호출 확인
- `update`에서 `done` 전환 시 review 미승인이면 차단 확인

## 구현 순서

```
Step 1: DB 스키마 + 마이그레이션
        packages/db/src/schema/issues.ts 수정
        pnpm db:generate

Step 2: Shared 계층 (타입 + 상수 + 검증)
        packages/shared/src/constants.ts
        packages/shared/src/validators/issue.ts
        packages/shared/src/types/issue.ts

Step 3: 서비스 로직
        server/src/services/issues.ts
        - applyStatusSideEffects 이후 reviewer wakeup
        - done 전환 게이팅
        - submitReview 함수

Step 4: API 엔드포인트 + Activity Log
        server/src/routes/issues.ts
        - POST /issues/:id/review
        - logActivity 호출

Step 5: 테스트
        server/src/__tests__/issue-review.test.ts 작성

Step 6: 검증
        pnpm -r typecheck && pnpm test:run && pnpm build
```

## 검증 방법

```bash
# 1. 타입체크
pnpm -r typecheck

# 2. 전체 테스트 (기존 + 신규)
pnpm test:run

# 3. 빌드
pnpm build

# 4. 수동 테스트
# - 이슈 생성 시 reviewerAgentId 지정 (assignee와 동일하면 에러)
# - in_review 전환 시 reviewer 웨이크업 확인
# - POST /issues/:id/review 로 approve/request_changes 테스트
# - reviewerAgentId 없는 기존 이슈는 영향 없음 확인
# - review 미승인 상태에서 done 전환 시도 → 422 확인
```

## 하위 호환성

- `reviewerAgentId`, `reviewStatus` 모두 nullable → 기존 이슈는 null, 기존 로직에 영향 없음
- 웨이크업은 기존 `queueIssueAssignmentWakeup` 재사용 (reviewer를 assigneeAgentId 자리에 넣어 호출)
- AGENTS.md "Single-assignee task model" 불변식 유지 (구현자는 여전히 1명)
- 리뷰는 순차적 → 동시성 문제 없음
- `reviewStatus` 없는 기존 이슈 → done 전환 게이팅 조건이 `reviewerAgentId && reviewStatus !== "approved"` 이므로, `reviewerAgentId`가 null이면 게이팅 미작동

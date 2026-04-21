---
name: assign
description: >
  Paperclip CEO에게 작업을 위임하는 원클릭 스킬. /assign "기능 설명"으로
  이슈를 생성하고 CEO에게 배정한다. CEO가 wakeOnDemand로 깨어나
  서브태스크를 분해하고 IC에게 위임한다.
---

# /assign — Paperclip 작업 위임

Claude Code에서 AI 팀(CEO → CTO → IC)에게 작업을 위임한다.

## 사용법

```
/assign 로그인 폼에 비밀번호 재설정 링크 추가
/assign deck-planner 3D 뷰어에 줌 제스처 지원
/assign --priority high 결제 API 500 에러 긴급 수정
```

## 인자 파싱

1. `args`에서 옵션 플래그를 먼저 추출한다:
   - `--priority <critical|high|medium|low>` (기본: medium)
   - `--project <프로젝트명>` (명시하지 않으면 자동 감지)
   - `--base <git-ref>` (워크스페이스 baseRef, 기본: 없음)
   - 나머지 텍스트 = 기능 설명 (title + description)

2. 프로젝트 자동 감지: `--project`가 없으면
   - 현재 작업 디렉토리(cwd)에서 프로젝트명 추론 (~/dev/triplan → triplan)
   - 매칭되는 Paperclip 프로젝트가 있으면 자동 연결
   - 없으면 프로젝트 미지정으로 생성

## 실행 절차

### Step 1 — 환경 확인

```bash
# Paperclip 서버 상태 확인
curl -sf http://localhost:3100/api/health > /dev/null
```

서버가 응답하지 않으면: "Paperclip 서버가 꺼져 있어요. `cd ~/dev/paperclip && pnpm dev`로 먼저 시작해주세요." 출력 후 중단.

### Step 2 — 이슈 생성

```bash
curl -s -X POST "http://localhost:3100/api/companies/10a31c72-824b-4343-bf30-8d490cc904a7/issues" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "<기능 설명 첫 문장 — 50자 이내>",
    "description": "<전체 기능 설명. 3줄 지시 형식으로 구조화>\n\n## 요청\n<원문>\n\n## 컨텍스트\n- 요청자: Board (Claude Code)\n- 프로젝트: <프로젝트명>\n- cwd: <현재 작업 디렉토리>",
    "status": "todo",
    "priority": "<파싱된 priority>",
    "assigneeAgentId": "100c380c-d7be-439b-bb3f-93b2b06d45f4",
    "projectId": "<매칭된 프로젝트 ID 또는 null>"
  }'
```

**핵심 값:**
| 키 | 값 | 이유 |
|---|---|---|
| assigneeAgentId | `100c380c-d7be-439b-bb3f-93b2b06d45f4` | CEO 에이전트 |
| status | `todo` | wakeOnDemand 트리거 조건 |
| companyId | `10a31c72-824b-4343-bf30-8d490cc904a7` | dh Studio |

**프로젝트 ID 매핑:**
| 프로젝트명 | ID |
|---|---|
| deck-planner | 708be431-b269-446e-a3be-717714e46ddb |
| deckctr | c49d8fc8-db7b-407e-ad3d-916a3e1a8903|
| triplan | 431099ad-aa22-403a-8367-7a6c561ca802 |
| price-compare | efe32ca4-4c25-425f-be1b-e58e875dc957 |
| claudewind-bot | fe4f4ea9-7757-4293-b584-3fce3314e8f4 |
| urizen | 438f2790-715c-4579-910c-8141744a61d9 |
| aichatbot | 894513d0-e4d3-441f-85de-c45d5e13c0c5 |

### Step 3 — baseRef 설정 (선택)

`--base` 옵션이 있으면, 생성된 이슈에 executionWorkspaceSettings를 설정한다:

```bash
curl -s -X PATCH "http://localhost:3100/api/issues/<issueId>" \
  -H "Content-Type: application/json" \
  -d '{
    "executionWorkspaceSettings": {
      "workspaceStrategy": {
        "type": "git_worktree",
        "baseRef": "<지정된 git ref>"
      }
    }
  }'
```

### Step 4 — 결과 보고

이슈 생성 성공 시:

```
Paperclip에 위임했어요.

  이슈: DEC-{번호} — {제목}
  담당: CEO (Opus)
  프로젝트: {프로젝트명 또는 "미지정"}
  우선순위: {priority}

  진행 흐름:
  1. CEO가 서브태스크 분해 → 엔지니어 배정
  2. 엔지니어 작업 완료 → QA 자동 리뷰
  3. QA 통과 → 텔레그램으로 리뷰 요청 도착
  4. 내가 확인 후 승인/반려

진행 상황: http://localhost:3100/DEC/issues/DEC-{번호}
```

실패 시 에러 내용을 그대로 보여준다.

## 프로젝트 자동 감지 로직

```
cwd = 현재 작업 디렉토리
if cwd starts with ~/dev/:
  projectName = cwd에서 ~/dev/ 다음 폴더명 추출
  if projectName in 프로젝트 ID 매핑:
    projectId = 매핑[projectName]
else:
  projectId = null
```

## 금지 사항

- CEO가 아닌 다른 에이전트에게 직접 배정하지 않는다 (CEO가 분해/배정)
- status를 `todo` 외 다른 값으로 설정하지 않는다 (wakeOnDemand 조건)
- description에 코드 전체를 붙여넣지 않는다 (파일 경로만 참조)
- 이슈 생성 후 추가 API 호출은 baseRef 설정만 허용 (나머지는 CEO가 처리)

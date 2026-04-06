#!/bin/bash
# plan-watcher.sh — 플랜 문서 감지 → Paperclip 이슈 자동 등록
#
# 동작: 각 프로젝트의 docs/plans/ 폴더를 스캔하여
#       아직 등록하지 않은 플랜 문서를 Paperclip 이슈로 자동 생성
#
# 실행: launchd (5분 간격) 또는 수동 ./plan-watcher.sh
# 설정: PROJECTS 배열에 프로젝트 매핑 추가

set -euo pipefail

# ── 설정 ──────────────────────────────────────────────
API="http://localhost:3100/api"
COMPANY_ID="10a31c72-824b-4343-bf30-8d490cc904a7"
STATE_FILE="$HOME/dev/paperclip/.plan-watcher-state"
LOG_FILE="$HOME/dev/paperclip/logs/plan-watcher.log"

# 프로젝트 매핑: "로컬경로|Paperclip프로젝트ID"
PROJECTS=(
  "$HOME/dev/triplan|431099ad-aa22-403a-8367-7a6c561ca802"
  "$HOME/dev/aichatbot|894513d0-e4d3-441f-85de-c45d5e13c0c5"
  # 새 프로젝트 추가 시 여기에 한 줄 추가
)

# ── 함수 ──────────────────────────────────────────────
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"
}

# 상태 파일 초기화 (없으면 생성)
touch "$STATE_FILE"

# 플랜 파일에서 제목 추출 (첫 번째 # 헤딩)
extract_title() {
  local file="$1"
  grep -m1 '^#\s' "$file" 2>/dev/null | sed 's/^#\+\s*//' || basename "$(dirname "$file")"
}

# 플랜 파일에서 요약 추출 (제목 다음 첫 번째 비어있지 않은 줄)
extract_summary() {
  local file="$1"
  # 첫 번째 헤딩 이후, 빈 줄 건너뛰고 첫 텍스트 줄
  awk '/^#/{found=1; next} found && /^[^#\s]/{print; exit}' "$file" 2>/dev/null | head -c 500
}

# 플랜 상태 판별 (폴더 이름 기반)
detect_status() {
  local path="$1"
  case "$path" in
    */in-progress/*) echo "todo" ;;  # Paperclip에서 에이전트가 시작하도록 todo로
    */done/*)        echo "done" ;;
    *)               echo "backlog" ;;
  esac
}

# 플랜 우선순위 판별
detect_priority() {
  local path="$1"
  case "$path" in
    */in-progress/*) echo "high" ;;
    *)               echo "medium" ;;
  esac
}

# Paperclip API 호출하여 이슈 생성
create_issue() {
  local project_id="$1"
  local title="$2"
  local description="$3"
  local status="$4"
  local priority="$5"

  # JSON 이스케이프 (제목/설명의 특수문자 처리)
  local json_title
  local json_desc
  json_title=$(printf '%s' "$title" | jq -Rs '.')
  json_desc=$(printf '%s' "$description" | jq -Rs '.')

  local response
  response=$(curl -s -w "\n%{http_code}" -X POST \
    "$API/companies/$COMPANY_ID/issues" \
    -H "Content-Type: application/json" \
    -d "{
      \"title\": $json_title,
      \"description\": $json_desc,
      \"projectId\": \"$project_id\",
      \"status\": \"$status\",
      \"priority\": \"$priority\"
    }" 2>/dev/null)

  local http_code
  http_code=$(echo "$response" | tail -1)
  local body
  body=$(echo "$response" | sed '$d')

  if [ "$http_code" = "201" ]; then
    local identifier
    identifier=$(echo "$body" | jq -r '.identifier // "unknown"')
    log "OK created $identifier: $title"
    echo "$identifier"
    return 0
  else
    log "ERR ($http_code) creating issue: $title — $body"
    return 1
  fi
}

# ── 메인 ──────────────────────────────────────────────
log "=== plan-watcher start ==="

total_new=0

for mapping in "${PROJECTS[@]}"; do
  IFS='|' read -r project_path project_id <<< "$mapping"
  plans_dir="$project_path/docs/plans"

  if [ ! -d "$plans_dir" ]; then
    continue
  fi

  # 플랜 파일 검색 (task_plan.md 또는 plan-*.md)
  while IFS= read -r plan_file; do
    # 이미 등록된 파일인지 확인
    if grep -qF "$plan_file" "$STATE_FILE" 2>/dev/null; then
      continue
    fi

    # done 폴더는 건너뛰기 (이미 완료된 플랜)
    if [[ "$plan_file" == */done/* ]]; then
      # 상태 파일에 기록만 하고 이슈는 생성하지 않음
      echo "$plan_file" >> "$STATE_FILE"
      continue
    fi

    # 플랜 정보 추출
    title=$(extract_title "$plan_file")
    summary=$(extract_summary "$plan_file")
    status=$(detect_status "$plan_file")
    priority=$(detect_priority "$plan_file")

    # 상대 경로 (description에 포함)
    relative_path="${plan_file#$project_path/}"
    description="${summary}

플랜 문서: ${relative_path}"

    # 이슈 생성
    if create_issue "$project_id" "$title" "$description" "$status" "$priority"; then
      echo "$plan_file" >> "$STATE_FILE"
      total_new=$((total_new + 1))
    fi

    # API 부하 방지
    sleep 1
  done < <(find "$plans_dir" -type f \( -name "task_plan.md" -o -name "plan-*.md" \) 2>/dev/null)
done

log "=== plan-watcher done: $total_new new issues ==="

# 결과 출력 (수동 실행 시)
if [ "$total_new" -gt 0 ]; then
  echo "${total_new}개 플랜 -> Paperclip 이슈 등록 완료"
else
  echo "📋 새 플랜 없음"
fi

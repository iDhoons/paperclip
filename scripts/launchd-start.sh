#!/bin/bash
# Paperclip 서버 LaunchAgent 시작 스크립트
# LaunchAgent(com.user.paperclip)가 호출하는 엔트리포인트
#
# 2026-04-06: 프로덕션 모드 전환
#   Before: pnpm→tsx 6단계 체인 (~770MB, 16프로세스)
#   After:  node dist/index.js 직접 실행 (~150MB, 3프로세스)
#   핵심: 조건부 exports로 dev/prod 분리 (paperclip-dev 조건)

set -euo pipefail

# NVM 환경 로드
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# 프로젝트 디렉토리
cd "$HOME/dev/paperclip/server"

# Node.js 메모리 상한 (768MB)
export NODE_OPTIONS="--max-old-space-size=768"

# 프로덕션 모드: 빌드된 JS 직접 실행 (tsx/esbuild 불필요)
exec node dist/index.js

#!/bin/bash

# Dining Docker 안전 재시작 스크립트
# NAS에서 실행: ./restart.sh
# 사전 요구사항: hydra01 사용자가 docker 그룹에 속해야 함
#   sudo synogroup --add docker hydra01

set -e

# docker 그룹 체크 (Synology는 groups 명령이 없어서 id 사용)
if ! id | grep -q docker; then
    echo "⚠️ docker 그룹에 속해있지 않습니다."
    echo "다음 명령 실행 후 다시 로그인하세요:"
    echo "  sudo synogroup --add docker \$USER"
    exit 1
fi

echo "🔄 Dining Docker 재시작 시작..."

# 1. 기존 dining 컨테이너 중지 및 제거
echo "📦 기존 컨테이너 중지 및 제거..."
CONTAINER_ID=$(docker ps -q --filter "ancestor=dining:latest")
if [ -n "$CONTAINER_ID" ]; then
    # 종료 전 WAL checkpoint (DB 손상 방지)
    echo "🔧 컨테이너 내 WAL checkpoint 실행..."
    docker exec $CONTAINER_ID sqlite3 /app/dev.db \
        "PRAGMA wal_checkpoint(TRUNCATE);" 2>/dev/null || true
    docker stop $CONTAINER_ID
    docker rm $CONTAINER_ID
    echo "✅ 컨테이너 안전 종료 완료: $CONTAINER_ID"
else
    echo "ℹ️  실행 중인 dining 컨테이너 없음"
fi

# 중지된 dining 컨테이너도 정리
STOPPED_CONTAINERS=$(docker ps -aq --filter "ancestor=dining:latest")
if [ -n "$STOPPED_CONTAINERS" ]; then
    docker rm $STOPPED_CONTAINERS
    echo "🧹 중지된 컨테이너 정리 완료"
fi

# 2. Git pull로 최신 코드 가져오기
echo "📥 최신 코드 pull..."
GIT_SSH_COMMAND="ssh -i ./id_rsa -o StrictHostKeyChecking=no" \
    git pull git@github.com:lks21c/dining.git main

# 3. Docker 이미지 빌드
echo "🔨 Docker 이미지 빌드..."
./build.sh

# 4. dangling 이미지 정리
echo "🧹 미사용 Docker 이미지 정리..."
docker image prune -f

# 5. 새 컨테이너 실행
echo "🚀 새 컨테이너 시작..."
docker run -p 3232:3232 --restart=unless-stopped \
    --env-file .env \
    -v $(pwd)/dev.db:/app/dev.db \
    -d dining:latest

# 6. 실행 확인
sleep 2
NEW_CONTAINER=$(docker ps -q --filter "ancestor=dining:latest")
if [ -n "$NEW_CONTAINER" ]; then
    echo "✅ Dining 재시작 완료!"
    echo "📋 컨테이너 ID: $NEW_CONTAINER"
    docker ps --filter "ancestor=dining:latest"
else
    echo "❌ 컨테이너 시작 실패. 로그 확인 필요"
    exit 1
fi

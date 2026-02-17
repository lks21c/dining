#!/bin/bash

# Dining Docker 재시작 스크립트 (NAS에서 실행)
# deps 변경 자동 감지: package.json / prisma 스키마 변경 시에만 deps 재빌드

set -e

if ! id | grep -q docker; then
    echo "⚠️ docker 그룹에 속해있지 않습니다."
    echo "  sudo synogroup --add docker \$USER"
    exit 1
fi

echo "🔄 Dining 재시작 시작..."

# 1. 기존 컨테이너 중지
echo "📦 기존 컨테이너 중지..."
CONTAINER_ID=$(docker ps -q --filter "ancestor=dining:latest")
if [ -n "$CONTAINER_ID" ]; then
    docker stop $CONTAINER_ID
    docker rm $CONTAINER_ID
    echo "✅ 컨테이너 종료: $CONTAINER_ID"
else
    echo "ℹ️  실행 중인 컨테이너 없음"
fi

STOPPED=$(docker ps -aq --filter "ancestor=dining:latest")
[ -n "$STOPPED" ] && docker rm $STOPPED

# 1-1. DB 정리: 순위 없는 크롤링 장소 삭제 + WAL 체크포인트
if [ -f ./dev.db ]; then
    echo "🗃️ DB 정리 중..."
    DELETED=$(sqlite3 ./dev.db "
        DELETE FROM Menu WHERE placeName IN (
            SELECT cp.name FROM CrawledPlace cp
            WHERE NOT EXISTS (
                SELECT 1 FROM PlaceSource ps
                WHERE ps.crawledPlaceId = cp.id
                AND ps.source = 'diningcode'
                AND json_extract(ps.metadata, '\$.score') IS NOT NULL
            )
        );
        DELETE FROM PlaceSource WHERE crawledPlaceId IN (
            SELECT cp.id FROM CrawledPlace cp
            WHERE NOT EXISTS (
                SELECT 1 FROM PlaceSource ps2
                WHERE ps2.crawledPlaceId = cp.id
                AND ps2.source = 'diningcode'
                AND json_extract(ps2.metadata, '\$.score') IS NOT NULL
            )
        );
        DELETE FROM CrawledPlace WHERE id NOT IN (
            SELECT DISTINCT crawledPlaceId FROM PlaceSource
            WHERE source = 'diningcode'
            AND json_extract(metadata, '\$.score') IS NOT NULL
        );
        SELECT changes();
    " 2>/dev/null)
    [ -n "$DELETED" ] && [ "$DELETED" -gt 0 ] 2>/dev/null && echo "  🗑️ 미순위 장소 ${DELETED}건 삭제"
    sqlite3 ./dev.db "PRAGMA wal_checkpoint(TRUNCATE);" 2>/dev/null || true
    echo "  ✅ WAL 체크포인트 완료"
fi

# 2. Git pull
echo "📥 최신 코드 pull..."
GIT_SSH_COMMAND="ssh -i ./id_rsa -o StrictHostKeyChecking=no" \
    git pull git@github.com:lks21c/dining.git main

# 3. deps 변경 감지 → 필요 시에만 deps 재빌드
CURRENT_HASH=$(md5sum package.json package-lock.json prisma/schema.prisma 2>/dev/null | md5sum | cut -d' ' -f1)
SAVED_HASH=$(cat .deps-hash 2>/dev/null || echo "")

if [ "$CURRENT_HASH" != "$SAVED_HASH" ] || ! docker image inspect dining-deps:latest >/dev/null 2>&1; then
    echo "📦 deps 변경 감지 → deps 이미지 재빌드..."
    ./build-deps.sh
else
    echo "⏩ deps 변경 없음 → 스킵"
fi

# 4. 앱 이미지 빌드 (소스만, 빠름)
echo "🔨 앱 빌드..."
./build.sh

# 5. dangling 이미지 정리 (deps 이미지는 보존)
docker image prune -f --filter "label!=dining-deps"

# 6. 새 컨테이너 시작
echo "🚀 컨테이너 시작..."
docker run -p 3232:3232 --restart=unless-stopped \
    --env-file .env \
    -v $(pwd)/dev.db:/app/dev.db \
    -d dining:latest

sleep 2
NEW_CONTAINER=$(docker ps -q --filter "ancestor=dining:latest")
if [ -n "$NEW_CONTAINER" ]; then
    echo "✅ 재시작 완료! 컨테이너: $NEW_CONTAINER"
    docker ps --filter "ancestor=dining:latest"
else
    echo "❌ 시작 실패"
    exit 1
fi

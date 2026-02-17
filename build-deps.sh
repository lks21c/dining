#!/bin/bash

# dining-deps 이미지 빌드 (node_modules + prisma client)
# package.json 또는 prisma 스키마 변경 시에만 실행

set -e

echo "📦 deps 이미지 빌드: dining-deps:latest"
docker build -f Dockerfile.deps -t dining-deps:latest .

# 현재 해시 저장 (변경 감지용)
md5sum package.json package-lock.json prisma/schema.prisma 2>/dev/null | md5sum | cut -d' ' -f1 > .deps-hash

echo "✅ deps 빌드 완료"

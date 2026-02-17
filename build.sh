#!/bin/bash

# dining Docker 이미지 빌드 스크립트
# 사용법: ./build.sh [TAG]

set -e

IMAGE_NAME="dining"
TAG="${1:-latest}"

# Extract NEXT_PUBLIC_* vars from .env for build-time injection
BUILD_ARGS=""
if [ -f .env ]; then
    while IFS='=' read -r key value; do
        case "$key" in
            NEXT_PUBLIC_*) BUILD_ARGS="$BUILD_ARGS --build-arg $key=$value" ;;
        esac
    done < <(grep -v '^#' .env | grep -v '^$')
fi

echo "🔨 Docker 이미지 빌드 시작: $IMAGE_NAME:$TAG"
docker build $BUILD_ARGS -t "$IMAGE_NAME:$TAG" .

echo "✅ 빌드 완료: $IMAGE_NAME:$TAG"

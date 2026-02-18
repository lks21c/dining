#!/bin/bash

# dining Docker 이미지 빌드 스크립트
# 사용법: ./build.sh [TAG]

set -e

IMAGE_NAME="dining"
TAG="${1:-latest}"

echo "🔨 이미지 빌드: $IMAGE_NAME:$TAG"
docker build -t "$IMAGE_NAME:$TAG" .

echo "✅ 빌드 완료: $IMAGE_NAME:$TAG"

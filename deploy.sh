#!/bin/bash

# deploy.sh - 원격 NAS에서 dining 재시작 스크립트
# Mac에서 실행: ./deploy.sh

set -e

# 네트워크 환경 감지 (hostname 기반)
CURRENT_HOST=$(hostname)
if [ "$CURRENT_HOST" = "Mac.asus.com" ]; then
    REMOTE_HOST="hydra01@192.168.1.177"
    echo "🏠 홈 맥북 감지 → ${REMOTE_HOST}"
else
    REMOTE_HOST="hydra01@hydra01.asuscomm.com"
    echo "🌐 외부 환경 → ${REMOTE_HOST}"
fi

REMOTE_DIR="/volume1/repo/dining"

echo "=== 리모트 서버 배포 시작 ==="
echo "SSH 접속: $REMOTE_HOST"
echo ""

echo "🚀 restart.sh 원격 실행 중..."
ssh $REMOTE_HOST "export PATH=/usr/local/bin:\$PATH && cd $REMOTE_DIR && ./restart.sh"

echo ""
echo "=== 배포 완료 ==="

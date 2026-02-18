#!/bin/bash

# deploy.sh - 원격 NAS에서 dining 재시작 스크립트
# Mac에서 실행: ./deploy.sh

set -e

REMOTE_DIR="/volume1/repo/dining"
REMOTE_CMD="export PATH=/usr/local/bin:\$PATH && cd $REMOTE_DIR && ./restart.sh"

# 네트워크 환경 감지 (hostname 기반)
CURRENT_HOST=$(hostname)
if [ "$CURRENT_HOST" = "Mac.asus.com" ]; then
    PRIMARY="hydra01@192.168.1.177"
    FALLBACK="hydra01@hydra01.asuscomm.com"
    echo "🏠 홈 맥북 감지 → 1차: ${PRIMARY} / 2차: ${FALLBACK}"
else
    PRIMARY="hydra01@hydra01.asuscomm.com"
    FALLBACK=""
    echo "🌐 외부 환경 → ${PRIMARY}"
fi

echo "=== 리모트 서버 배포 시작 ==="
echo ""

echo "🚀 restart.sh 원격 실행 중... (${PRIMARY})"
if ssh -o ConnectTimeout=10 $PRIMARY "$REMOTE_CMD"; then
    echo ""
    echo "=== 배포 완료 ==="
    exit 0
fi

if [ -n "$FALLBACK" ]; then
    echo ""
    echo "⚠️ 1차 접속 실패 → fallback: ${FALLBACK}"
    echo ""
    ssh -o ConnectTimeout=15 $FALLBACK "$REMOTE_CMD"
    echo ""
    echo "=== 배포 완료 (fallback) ==="
else
    echo "❌ 배포 실패"
    exit 1
fi

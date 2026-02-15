#!/bin/bash
IMAGE_NAME="dining"
TAG="${1:-latest}"

docker build -t "$IMAGE_NAME:$TAG" .

echo "Built $IMAGE_NAME:$TAG"
echo "Run: docker run --env-file .env -p 3232:3232 -v ./dev.db:/app/dev.db $IMAGE_NAME:$TAG"

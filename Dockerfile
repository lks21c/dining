FROM node:24-alpine

WORKDIR /repo

# native 모듈 빌드 도구 (better-sqlite3 등)
RUN apk add --no-cache python3 make g++ bash sqlite

# npm 캐시 워밍 (마운트 시 node_modules 없으면 빠른 설치 위해)
COPY package.json package-lock.json /tmp/deps/
RUN cd /tmp/deps && npm install && rm -rf /tmp/deps

ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3232
EXPOSE 3232

CMD ["sh", "-c", "cd /repo/dining && npm install && npx prisma generate && npm run build && npx next start -p 3232"]

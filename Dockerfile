# Source build: uses pre-built dining-deps with node_modules + prisma client
FROM dining-deps:latest AS builder
WORKDIR /app
COPY . .
ARG NEXT_PUBLIC_NAVER_MAP_CLIENT_ID
ENV NEXT_PUBLIC_NAVER_MAP_CLIENT_ID=$NEXT_PUBLIC_NAVER_MAP_CLIENT_ID
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Runtime: minimal production image
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
ENV PORT=3232
EXPOSE 3232
CMD ["node", "server.js"]

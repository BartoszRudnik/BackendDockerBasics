FROM node:24-alpine AS builder

WORKDIR /app

COPY --chown=node:node package*.json ./
RUN npm ci --only=production --ignore-scripts
RUN mkdir -p /app/data && chown -R node:node /app/data

FROM gcr.io/distroless/nodejs24-debian12 AS runner

LABEL org.opencontainers.image.title="backend-docker-basics" \
      org.opencontainers.image.description="Production Node.js backend" \
      org.opencontainers.image.source="https://github.com/BartoszRudnik/BackendDockerBasics"

WORKDIR /app

COPY --from=builder --chown=nonroot:nonroot /app/data ./data
COPY --chown=node:node src/ ./src/
COPY --chown=node:node package.json ./

EXPOSE 3000

ARG APP_VERSION=dev
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    DATA_DIR=/app/data \
    APP_VERSION=${APP_VERSION}

VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["/nodejs/bin/node", "-e", "require('http').get('http://127.0.0.1:3000/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"]

USER nonroot

CMD ["src/server.js"]

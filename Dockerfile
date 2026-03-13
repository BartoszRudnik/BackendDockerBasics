FROM node:24-alpine

WORKDIR /app

COPY --chown=node:node package*.json ./
RUN npm ci --only=production
COPY --chown=node:node src/ ./src/

RUN mkdir -p /app/data && chown -R node:node /app/data

EXPOSE 3000

ARG APP_VERSION=dev


ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    DATA_DIR=/app/data \
    APP_VERSION=${APP_VERSION}

VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

USER node

CMD ["node", "src/server.js"]

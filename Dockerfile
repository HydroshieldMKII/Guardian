FROM node:22-alpine AS backend-build
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build

FROM node:22-alpine AS backend-deps
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    DATABASE_PATH=/app/data/plex-guard.db

RUN apk add --no-cache wget python3 py3-pip tini su-exec \
    && pip3 install --no-cache-dir --break-system-packages apprise

COPY --from=backend-deps /app/backend/node_modules ./backend/node_modules
COPY --from=backend-build /app/backend/dist ./backend/dist
COPY --from=backend-build /app/backend/package.json ./backend/package.json
COPY --from=backend-build /app/backend/src/scripts ./backend/src/scripts

COPY --from=frontend-build /app/frontend/.next/standalone ./frontend/
COPY --from=frontend-build /app/frontend/.next/static ./frontend/.next/static
COPY --from=frontend-build /app/frontend/public ./frontend/public

COPY docker-entrypoint.sh /usr/local/bin/guardian-entrypoint
RUN chmod +x /usr/local/bin/guardian-entrypoint \
    && mkdir -p /app/data \
    && chown -R node:node /app

VOLUME ["/app/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3001/health >/dev/null || exit 1

ENTRYPOINT ["/sbin/tini", "--", "guardian-entrypoint"]

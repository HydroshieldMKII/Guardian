# frontend/Dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Runtime-configurable port (overridden by Compose)
ENV PORT=3000

# health tools (optional)
RUN apk add --no-cache wget

# Non-root user (as you had)
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Public assets
COPY --from=build /app/public ./public

# Standalone output
RUN mkdir .next && chown nextjs:nodejs .next
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
CMD ["node", "server.js"]

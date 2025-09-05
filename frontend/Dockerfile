# Frontend Dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Accept build arguments for environment variables
ARG PLEXGUARD_API_PORT=3001
ARG PLEXGUARD_FRONTEND_PORT=3000

# Set environment variables for the build process
ENV NEXT_PUBLIC_API_PORT=${PLEXGUARD_API_PORT}
ENV NEXT_PUBLIC_API_URL=http://localhost:${PLEXGUARD_API_PORT}

# Build the application
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Install wget for health checks
RUN apk add --no-cache wget

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

# Use configurable port
ARG PLEXGUARD_FRONTEND_PORT=3000
EXPOSE ${PLEXGUARD_FRONTEND_PORT}

ENV PORT=${PLEXGUARD_FRONTEND_PORT}

CMD ["node", "server.js"]

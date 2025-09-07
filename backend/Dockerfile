# backend/Dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production image, copy all the files and run the app
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install wget for health checks
RUN apk add --no-cache wget

# Prod deps only
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Built application
COPY --from=builder /app/dist ./dist

# Expose (documentation only; compose will bind)
EXPOSE 3001

# Data volume
VOLUME ["/app/data"]

CMD ["node", "dist/main"]

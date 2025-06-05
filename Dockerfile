# Multi-stage Docker build for NIPUN Teachers Portal
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci --only=production && npm cache clean --force

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application
RUN npm run build

# Production image, copy all the files and run the application
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 express

# Copy built application
COPY --from=builder --chown=express:nodejs /app/dist ./dist
COPY --from=builder --chown=express:nodejs /app/client/dist ./client/dist
COPY --from=deps --chown=express:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=express:nodejs /app/package.json ./package.json

# Copy essential configuration files
COPY --chown=express:nodejs drizzle.config.ts ./
COPY --chown=express:nodejs tsconfig.json ./
COPY --chown=express:nodejs shared ./shared

USER express

EXPOSE 5000

ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

CMD ["node", "dist/server/index.js"]
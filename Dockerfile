# Multi-stage Docker build for NIPUN Teachers Portal
# Base image
FROM node:20-alpine AS base

# Stage: Install all dependencies (dev + prod)
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci && npm cache clean --force

# Stage: Build the application
FROM base AS builder
WORKDIR /app

# Copy installed node_modules with dev deps
COPY --from=deps /app/node_modules ./node_modules

# Copy the rest of the codebase
COPY . .

# Build the app (requires vite or esbuild from dev deps)
RUN npm run build

# Stage: Create production image with only necessary files
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 express

# Install only production dependencies
COPY package.json package-lock.json* ./
RUN npm ci --only=production && npm cache clean --force

# Copy necessary built files
COPY --from=builder --chown=express:nodejs /app/dist ./dist
COPY --from=builder --chown=express:nodejs /app/client/dist ./client/dist
COPY --from=builder --chown=express:nodejs /app/shared ./shared
COPY --from=builder --chown=express:nodejs /app/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=express:nodejs /app/drizzle.config.ts ./drizzle.config.ts

USER express

EXPOSE 5000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

CMD ["node", "dist/server/index.js"]

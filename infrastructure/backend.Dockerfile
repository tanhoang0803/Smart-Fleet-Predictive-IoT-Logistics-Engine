# Smart-Fleet IoT — Backend Dockerfile
# TanQHoang © 2026
# Alpine Node for minimal image size

FROM node:18-alpine AS base

# Install wget for healthcheck
RUN apk add --no-cache wget

WORKDIR /app

# --- Dependencies ---
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --only=production && npm cache clean --force

# --- Production image ---
FROM base AS runner

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodeuser -u 1001 -G nodejs

WORKDIR /app

# Copy deps from deps stage
COPY --from=deps --chown=nodeuser:nodejs /app/node_modules ./node_modules

# Copy source
COPY --chown=nodeuser:nodejs . .

USER nodeuser

EXPOSE 3001

ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3001/health || exit 1

CMD ["node", "server.js"]

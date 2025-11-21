# syntax=docker/dockerfile:1

# Production-ready Dockerfile for Railway Service
# Optimized for Docker layer caching

# ==============================================================================
# Stage 1: Dependencies - This layer is cached unless package*.json changes
# ==============================================================================
FROM node:20-alpine AS deps

# Install build dependencies for native modules (Baileys)
RUN apk add --no-cache \
    git \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev

WORKDIR /app

# Copy ONLY package files first (better cache utilization)
COPY package.json package-lock.json ./

# Install dependencies with cache mount for faster rebuilds
RUN --mount=type=cache,target=/root/.npm \
    npm ci --only=production

# ==============================================================================
# Stage 2: Production - Only copy what's needed
# ==============================================================================
FROM node:20-alpine AS production

# Install runtime dependencies only (no build tools)
RUN apk add --no-cache \
    cairo \
    jpeg \
    pango \
    giflib

WORKDIR /app

# Copy node_modules from deps stage (cached)
COPY --from=deps /app/node_modules ./node_modules

# Copy application files (this layer changes frequently)
COPY . .

# Create directory for WhatsApp sessions
RUN mkdir -p /app/auth_sessions

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"

# Start the application
CMD ["node", "index.js"]

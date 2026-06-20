# Self-contained Dockerfile for the Cosmo backend (NestJS).
# Build context = this repo root (cosmo-backend).

# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# `build` runs `prisma generate && nest build`
RUN npm run build

# ── Stage 2: production runtime ───────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production PORT=4000

# Production deps only (includes prisma + @prisma/client for runtime migrations)
COPY package*.json ./
RUN npm ci --omit=dev

# Compiled app, generated Prisma client, and the schema + migrations
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/prisma/generated ./src/prisma/generated
COPY --from=builder /app/prisma ./prisma

EXPOSE 4000

# Apply migrations, then start the server.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]

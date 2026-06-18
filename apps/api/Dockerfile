# Use slim (Debian) for apt-get package support (OCR tools require it)
FROM node:20-slim AS base
RUN npm install -g pnpm

# Install system packages for OCR and PDF processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-ron \
    ghostscript \
    poppler-utils \
    python3 \
    python3-pip \
    python3-venv \
    && pip3 install --no-cache-dir --break-system-packages ocrmypdf \
    && rm -rf /var/lib/apt/lists/*

# ── Dependencies ──────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

# ── Build ─────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# ── Production runner ─────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./

USER app
EXPOSE 3001

CMD ["node", "dist/main"]

# ── Stage 1: builder ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json tsconfig.json ./
COPY prisma ./prisma
RUN npm ci
RUN npx prisma generate
COPY src ./src
RUN npm run build

# ── Stage 2: runner ───────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate

COPY --from=builder /app/dist ./dist
RUN mkdir -p uploads

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]

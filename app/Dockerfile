FROM node:20-slim AS deps
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# On copie aussi package-lock.json s'il existe pour une installation plus stable
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Ensure node_modules binaries are executable and on PATH (needed on ARM/Raspberry Pi)
ENV PATH="/app/node_modules/.bin:${PATH}"
RUN chmod -R +x node_modules/.bin || true
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# On réinstalle curl dans l'étape finale pour que le Healthcheck Docker fonctionne
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["npm", "start"]
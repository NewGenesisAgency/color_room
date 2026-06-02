FROM node:20-slim AS deps
WORKDIR /app

# Pas d'apt-get : better-sqlite3 récupère un binaire prebuilt (prebuild-install).
# Aucun besoin de python3/make/g++ tant que le prebuilt est disponible pour la plateforme.
# On copie aussi package-lock.json s'il existe pour une installation plus stable.
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Ensure node_modules binaries are executable (can be stripped by Docker COPY on some systems)
RUN chmod -R +x node_modules/.bin || true
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

# Healthcheck via node (fetch intégré à Node 20) — évite d'installer curl via apt-get.
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "start"]

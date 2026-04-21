FROM node:20-slim AS deps
 
WORKDIR /app
 
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
 
COPY package.json /app/package.json
RUN npm install --legacy-peer-deps
 
 
FROM node:20-slim AS builder
 
WORKDIR /app
 
COPY --from=deps /app/node_modules /app/node_modules
COPY . /app
 
RUN npm run build
 
 
FROM node:20-slim AS runner
 
WORKDIR /app
 
ENV NODE_ENV=production

# --- MODIFICATION ICI ---
# On réinstalle curl dans l'étape finale pour que le Healthcheck Docker fonctionne
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
# ------------------------
 
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/next.config.mjs /app/next.config.mjs
COPY --from=builder /app/public /app/public
COPY --from=builder /app/.next /app/.next
COPY --from=builder /app/node_modules /app/node_modules
 
EXPOSE 3000
 
CMD ["npm", "start"]
# ── build ──────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── runtime ────────────────────────────────────────────────────
FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production \
    DATA_DIR=/var/data

# better-sqlite3 is a native module — build it in this image too
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev \
 && npm rebuild better-sqlite3 --build-from-source

COPY --from=build /app/dist ./dist
COPY server ./server
COPY src ./src              

RUN mkdir -p /var/data
VOLUME /var/data
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "start"]

FROM node:24-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    REMOTION_BROWSER_EXECUTABLE=/usr/bin/chromium \
    REMOTION_GL=swangle

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium ffmpeg ca-certificates fonts-noto-cjk fonts-liberation \
    libasound2 libatk-bridge2.0-0 libatk1.0-0 libatspi2.0-0 libcairo2 libcups2 \
    libdbus-1-3 libdrm2 libgbm1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 \
    libpango-1.0-0 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxdamage1 \
    libxext6 libxfixes3 libxkbcommon0 libxrandr2 libxrender1 libxshmfence1 libxtst6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build \
    && mkdir -p .local-data out backups .next/cache node_modules/.cache \
    && chown node:node .local-data out backups .next/cache node_modules/.cache \
    && chmod 700 backups

# Run as the image's non-root user (uid/gid 1000). Host bind mounts must be writable by uid 1000 (docs/development/OPERATIONS.md).
USER node

EXPOSE 3000
VOLUME ["/app/.local-data", "/app/out", "/app/backups"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "node_modules/next/dist/bin/next", "start", "-H", "0.0.0.0", "-p", "3000"]

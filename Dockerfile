# task-011: whisper.cpp is built from a pinned source commit (v1.9.5). Nothing is downloaded at install or run time; only the executable is copied into the final image. Not built on the dev PC yet (unverified).
FROM debian:bookworm-slim AS whisper-build
ARG WHISPER_COMMIT=d1be6fde11ac6e0407606b4e42fe72d34add8037
RUN apt-get update && apt-get install -y --no-install-recommends build-essential cmake git ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN git init /src && cd /src \
    && git fetch --depth 1 https://github.com/ggml-org/whisper.cpp.git "$WHISPER_COMMIT" \
    && git checkout FETCH_HEAD \
    && test "$(git rev-parse HEAD)" = "$WHISPER_COMMIT" \
    && cmake -B build -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF -DGGML_NATIVE=OFF -DGGML_OPENMP=OFF -DWHISPER_BUILD_TESTS=OFF \
    && cmake --build build -j"$(nproc)" --target whisper-cli

FROM node:26-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive \
    STT_MODEL_DIR=/app/models-stt \
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

COPY --from=whisper-build /src/build/bin/whisper-cli /usr/local/bin/whisper-cli

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
# /app/models-stt holds the speech models (npm run stt:model, SHA256 verified); mount it read-only while the server runs. It is not part of backups.
VOLUME ["/app/.local-data", "/app/out", "/app/backups", "/app/models-stt"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "node_modules/next/dist/bin/next", "start", "-H", "0.0.0.0", "-p", "3000"]

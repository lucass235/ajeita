# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim
ENV DEBIAN_FRONTEND=noninteractive \
    PUPPETEER_SKIP_DOWNLOAD=true \
    CHROME_PATH=/usr/bin/chromium \
    CHROME_NO_SANDBOX=true \
    AUTH_DATA_PATH=/data/whatsapp \
    PYTHON_BIN=/opt/venv/bin/python \
    PYTHONUNBUFFERED=1 \
    PORT=3000
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium ffmpeg python3 python3-venv ca-certificates fonts-liberation tini \
    && rm -rf /var/lib/apt/lists/* \
    && python3 -m venv /opt/venv \
    && /opt/venv/bin/pip install --no-cache-dir --upgrade pip 'yt-dlp[default]' curl_cffi
WORKDIR /app
COPY package.json package-lock.json ./
COPY scripts ./scripts
RUN sed -i 's/\r$//' /app/scripts/*.sh
RUN npm ci --omit=dev --no-audit --no-fund
COPY src ./src
RUN mkdir -p /data/whatsapp && chown -R node:node /app /data/whatsapp
USER node
EXPOSE 3000
ENTRYPOINT ["sh", "/app/scripts/start-container.sh"]
CMD ["node", "src/bot.js"]


# XAUView feed server - Render.com (Linux). MetaTrader5 BU YERDA YO'Q.
# Build context = repo root (render.yaml: dockerContext: .), shuning uchun:
#   docker build -f server/Dockerfile -t xauview .
#   docker run --rm -p 8080:8080 -e XAUVIEW_DATA=open xauview
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=8080 \
    XAUVIEW_DATA=open

WORKDIR /app

# 1) Faqat Linux'da mavjud paketlar (MetaTrader5 / pandas / numpy YO'Q).
COPY server/requirements-render.txt /app/server/requirements-render.txt
RUN pip install --no-cache-dir -r /app/server/requirements-render.txt

# 2) Kod + statik mobil ilova.
#    app.py: BASE_DIR=/app/server, MOBILE_DIR=/app/mobile  -> shu tuzilma kerak.
COPY server/ /app/server/
COPY mobile/ /app/mobile/

WORKDIR /app/server
EXPOSE 8080

# Render o'z health check'ini healthCheckPath orqali qiladi; bu lokal docker uchun.
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
    CMD python -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:'+os.getenv('PORT','8080')+'/api/health', timeout=4)"

# Render PORT env'ini beradi (free tier odatda 10000). Shell form: PORT kengayadi.
CMD uvicorn app:app --host 0.0.0.0 --port "${PORT:-8080}" --proxy-headers --forwarded-allow-ips="*"

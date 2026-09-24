FROM python:3.11-slim

WORKDIR /app

# Install Node.js (for fallback execution) and curl
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    nodejs \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Health check script checking Redis heartbeat
HEALTHCHECK --interval=5s --timeout=3s --start-period=5s --retries=3 \
  CMD python -c "import redis, os, sys; r = redis.from_url(os.getenv('REDIS_URL', 'redis://localhost:6379/0')); sys.exit(0 if r.ping() else 1)"

CMD ["python", "worker.py"]

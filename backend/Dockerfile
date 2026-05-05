FROM python:3.8-slim-bullseye

ENV TZ=Asia/Shanghai \
    PYTHONPATH=/app \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple \
    PIP_DEFAULT_TIMEOUT=60

WORKDIR /app

RUN sed -i 's/deb.debian.org/mirrors.ustc.edu.cn/g' /etc/apt/sources.list \
    && sed -i 's/security.debian.org/mirrors.ustc.edu.cn/g' /etc/apt/sources.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        net-tools \
        tzdata \
    && rm -rf /var/lib/apt/lists/*

COPY ./app/requirements.txt /app/requirements.txt
RUN pip install --upgrade pip --prefer-binary --retries 3 \
    && pip install --prefer-binary --retries 3 -r /app/requirements.txt

COPY ./app /app
RUN chmod +x /app/run.sh

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8000/api/v1/system/health || exit 1

CMD ["sh", "/app/run.sh"]

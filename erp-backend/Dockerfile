ARG APT_MIRROR=https://deb.debian.org/debian
ARG APT_SECURITY_MIRROR=https://deb.debian.org/debian-security
ARG PIP_INDEX_URL=https://pypi.org/simple

FROM python:3.12-slim

ARG APT_MIRROR
ARG APT_SECURITY_MIRROR
ARG PIP_INDEX_URL

WORKDIR /app

# Install system dependencies
RUN set -eux; \
    if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
        sed -i "s|http://deb.debian.org/debian|${APT_MIRROR}|g; s|http://deb.debian.org/debian-security|${APT_SECURITY_MIRROR}|g" /etc/apt/sources.list.d/debian.sources; \
    else \
        sed -i "s|http://deb.debian.org/debian|${APT_MIRROR}|g; s|http://deb.debian.org/debian-security|${APT_SECURITY_MIRROR}|g" /etc/apt/sources.list; \
    fi; \
    apt-get update && apt-get install -y --no-install-recommends \
        default-libmysqlclient-dev \
        pkg-config \
        gcc \
        && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -i "${PIP_INDEX_URL}" -r requirements.txt

# Copy application code
COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

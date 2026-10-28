# Stage 1: Build Frontend Assets
FROM docker.io/library/node:24-alpine AS frontend-builder

WORKDIR /app/frontend

COPY record_views/frontend/package.json record_views/frontend/package-lock.json ./
RUN npm ci

COPY record_views/frontend/ ./
RUN npm test && npm run build

# Stage 2: Installed package
FROM docker.io/library/python:3.12-slim AS package

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    STREAMLIT_SERVER_PORT=8501 \
    STREAMLIT_SERVER_ADDRESS=0.0.0.0 \
    STREAMLIT_SERVER_HEADLESS=true

# Copy package source and pyproject.toml
COPY pyproject.toml README.md LICENSE ./
COPY record_views/ ./record_views/

# Copy compiled frontend build assets into the package asset directory
COPY --from=frontend-builder /app/frontend/build ./record_views/frontend/build

# Install the package and dependencies
RUN pip install --no-cache-dir .

# Stage 3: Python tests (podman build --target test -t streamlit-record-views:test .)
FROM package AS test

RUN pip install --no-cache-dir pandas pytest
COPY tests/ ./tests/

ENTRYPOINT ["python", "-m", "pytest", "-q"]

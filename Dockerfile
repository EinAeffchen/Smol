# ---- Stage 1: Build Frontend (No changes here) ----
FROM node:20-slim as frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend ./
RUN npm run build


# ---- Stage 2: Optimized Final Python Application ----
FROM python:3.12-slim

# Create a non-root user and group first
ARG UID=1000
ARG GID=1000
RUN groupadd -g ${GID} --non-unique appgroup && \
    useradd -u ${UID} -g appgroup -s /bin/sh -m appuser

WORKDIR /app

# Install system dependencies (these rarely change)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libgl1 \
    build-essential \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=true \
    PIP_DISABLE_PIP_VERSION_CHECK=on \
    VENV_PATH=/app/venv \
    PORT=8000 \
    MEDIA_DIR=/app/media \
    DATA_DIR=/app/data \
    STATIC_ASSETS_PATH=/app/static
ENV PATH="$VENV_PATH/bin:$PATH"
# Further ENV VARS for application
ENV SQLITE_VEC_PATH=${VENV_PATH}/lib/python3.12/site-packages/sqlite_vec/vec0
ENV HF_HOME=${DATA_DIR}/.smol/models \
    TORCH_HOME=${DATA_DIR}/.smol/models \
    INSIGHTFACE_HOME=${DATA_DIR}/.smol/models

# --- OPTIMIZED LAYER ORDER ---

# 1. Create the virtual environment
RUN python3 -m venv $VENV_PATH

# 2. Copy only the requirements file and install dependencies.
# This layer is now cached and will only be rebuilt if requirements.txt changes.
COPY requirements.txt .
RUN pip install --no-cache-dir --no-compile torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir --no-compile --upgrade pip && pip install -r requirements.txt && \
    apt-get remove -y build-essential
# 3. Change ownership of the entire venv.
# This creates another large, but CACHED, layer. It's only rebuilt if the
# pip install layer above is rebuilt.
# RUN chown -R appuser:appgroup $VENV_PATH

# --- Layers below this point are rebuilt more frequently ---

# 4. Copy application source code, setting ownership directly.
# This is now separate from the dependency layers.
COPY --chown=appuser:appgroup ./app ./app
COPY --chown=appuser:appgroup alembic /app/alembic
COPY --chown=appuser:appgroup alembic.ini /app/alembic.ini
COPY --chown=appuser:appgroup entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

# 5. Copy frontend assets from the build stage.
COPY --from=frontend-builder --chown=appuser:appgroup /app/frontend/dist ${STATIC_ASSETS_PATH}

# 6. Create mount points for volumes and set permissions. This is a small final layer.
RUN mkdir -p ${DATA_DIR} ${MEDIA_DIR} && \
    chown -R appuser:appgroup ${DATA_DIR} ${MEDIA_DIR}

# 7. Switch to the non-root user
# USER appuser

EXPOSE $PORT
ENTRYPOINT ["/entrypoint.sh"]
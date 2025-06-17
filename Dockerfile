FROM python:3.12-slim
ARG UID=1000
ARG GID=1000

RUN groupadd -g ${GID} --non-unique appgroup && \
    useradd -u ${UID} -g appgroup -s /bin/sh -m appuser

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
ffmpeg \
libgl1 \
npm \
build-essential \
&& rm -rf /var/lib/apt/lists/* \
&& apt-get clean

# Set environment variables
# PYTHONUNBUFFERED: Prevents Python output from being buffered, making logs appear in real-time.
# PIP_NO_CACHE_DIR: Disables pip's cache, reducing image size.
# PIP_DISABLE_PIP_VERSION_CHECK: Speeds up pip installs slightly.
# VENV_PATH: Defines the path for the virtual environment.
# PORT: The port your application will run on (uvicorn will use this).
# MEDIA_DIR: Application directory for media files (runtime data, should be a volume).
# STATIC_DIR: Directory where static frontend assets will be served from.
ENV PYTHONUNBUFFERED=1 \
PIP_NO_CACHE_DIR=true \
PIP_DISABLE_PIP_VERSION_CHECK=on \
VENV_PATH=/app/venv \
PORT=8000 \
MEDIA_DIR=/app/media \
DATA_DIR=/app/data

ENV HF_HOME=${DATA_DIR}/.smol/models \
TORCH_HOME=${DATA_DIR}/.smol/models \
INSIGHTFACE_HOME=${DATA_DIR}/.smol/models

RUN python3 -m venv $VENV_PATH
ENV PATH="$VENV_PATH/bin:$PATH"

RUN chown -R appuser:appgroup $VENV_PATH

COPY requirements.txt .
RUN pip install --upgrade pip && \
pip install -r requirements.txt

COPY --chown=appuser:appgroup frontend /app/frontend
COPY --chown=appuser:appgroup ./app ./app

COPY --chown=appuser:appgroup entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Create a non-root user and switch to it for better security

EXPOSE $PORT
USER appuser

ENTRYPOINT ["/entrypoint.sh"]

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

ENV PYTHONUNBUFFERED=1 \
PIP_NO_CACHE_DIR=true \
PIP_DISABLE_PIP_VERSION_CHECK=on \
VENV_PATH=/app/venv \
PORT=8000 \
MEDIA_DIR=/app/media \
DATA_DIR=/app/data

ENV SQLITE_VEC_PATH=${VENV_PATH}/lib/python3.12/site-packages/sqlite_vec/vec0
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

COPY --chown=appuser:appuser alembic /app/alembic
COPY --chown=appuser:appuser alembic.ini /app/alembic.ini
# Create a non-root user and switch to it for better security

EXPOSE $PORT
USER appuser

ENTRYPOINT ["/entrypoint.sh"]

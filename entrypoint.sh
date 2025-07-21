#!/bin/sh
set -e

USER_ID=${PUID:-1000}
GROUP_ID=${PGID:-1000}

echo "--- Entrypoint: Starting with UID: $USER_ID, GID: $GROUP_ID ---"

groupmod -g $GROUP_ID appgroup
usermod -u $USER_ID -g appgroup appuser

echo "--- Entrypoint: Updating ownership of internal app directories ---"
chown -R appuser:appgroup /app
chown appuser:appgroup /entrypoint.sh

echo "--- Entrypoint: Running Migrations ---"
exec su appuser alembic upgrade head

echo "--- Entrypoint: Starting Uvicorn ---"
exec su appuser -c "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"
#!/bin/sh
set -e

echo "--- Entrypoint: Running Migrations ---"
alembic upgrade head

echo "--- Entrypoint: Checking volume permissions ---"
# Change ownership of volume mounts to appuser
# This allows the app to write to the mounted directories
chown -R appuser:appgroup /app/data /app/media

echo "--- Entrypoint: Running Migrations ---"
# Run alembic as the appuser
su appuser -s /bin/sh -c "alembic upgrade head"

echo "--- Entrypoint: Starting Uvicorn as appuser ---"
# Use su-exec to drop from root to appuser before starting the main application
exec su appuser -s /bin/sh -c "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"
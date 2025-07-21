#!/bin/sh
# set -e

LOG_FILE="/app/data/debug_entrypoint.log"

echo "--- [DEBUG] Entrypoint started at $(date) ---" > "$LOG_FILE"

USER_ID=${PUID:-1000}
GROUP_ID=${PGID:-1000}

echo "--- Entrypoint: Starting with UID: $USER_ID, GID: $GROUP_ID ---"

groupmod -g $GROUP_ID appgroup
usermod -u $USER_ID -g appgroup appuser

echo "--- Entrypoint: Updating ownership of internal app directories ---"
chown -R appuser:appgroup /app
chown appuser:appgroup /entrypoint.sh

echo "--- Entrypoint: Running Migrations ---"
su appuser -c "alembic upgrade head" >> "$LOG_FILE" 2>&1

EXIT_CODE=$? # Capture the exit code of the 'su' command

echo "--- Entrypoint: Starting Uvicorn ---"
if [ $EXIT_CODE -eq 0 ]; then
    echo "--- [SUCCESS] Migrations completed. Starting Uvicorn. ---" >> "$LOG_FILE"
    exec su appuser -c "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"
else
    echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!" >> "$LOG_FILE"
    echo "!!!!!!   [FAILURE] MIGRATION FAILED. See log.   !!!!!!" >> "$LOG_FILE"
    echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!" >> "$LOG_FILE"
    echo "Container will sleep for 600 seconds to allow for inspection."
    sleep 600
    exit 1
fi
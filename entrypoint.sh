#!/bin/sh
set -e # Exit immediately if a command exits with a non-zero status

# Path where frontend assets should be/will be built
STATIC_ASSETS_PATH="/app/data/.smol/static"
FRONTEND_SRC_DIR="/app/frontend" # Where frontend source is copied in Dockerfile
FRONTEND_BUILD_OUTPUT_DIR="${FRONTEND_SRC_DIR}/dist" # Common for Vite/React builds

echo "--- Entrypoint: Initializing ---"
echo "VENV_PATH: ${VENV_PATH}"
echo "STATIC_ASSETS_PATH: ${STATIC_ASSETS_PATH}"
echo "FRONTEND_SRC_DIR: ${FRONTEND_SRC_DIR}"

# Check if frontend assets already exist in the target static path
# We'll check for the existence of an index.html file as a proxy

echo "Attempting to build frontend..."

if [ ! -d "${FRONTEND_SRC_DIR}" ]; then
    echo "Error: Frontend source directory ${FRONTEND_SRC_DIR} not found. Cannot build."
    exit 1
fi
if [ ! -f "${FRONTEND_SRC_DIR}/package.json" ]; then
    echo "Error: ${FRONTEND_SRC_DIR}/package.json not found. Cannot build."
    exit 1
fi

echo "Navigating to ${FRONTEND_SRC_DIR} to build frontend."
cd "${FRONTEND_SRC_DIR}"

echo "Running 'npm install'..."
npm install

echo "Running 'npm run build'..."
npm run build # This should create the FRONTEND_BUILD_OUTPUT_DIR (e.g., /frontend/dist)

if [ ! -d "${FRONTEND_BUILD_OUTPUT_DIR}" ]; then
    echo "Error: Frontend build output directory ${FRONTEND_BUILD_OUTPUT_DIR} not found after build."
    exit 1
fi

echo "Creating target static assets directory: ${STATIC_ASSETS_PATH}"
mkdir -p "${STATIC_ASSETS_PATH}"

echo "Copying built assets from ${FRONTEND_BUILD_OUTPUT_DIR}/ to ${STATIC_ASSETS_PATH}/"
# Using 'cp -a' to preserve attributes and copy contents of dist
cp -a "${FRONTEND_BUILD_OUTPUT_DIR}/." "${STATIC_ASSETS_PATH}/"

echo "Frontend build complete."
cd "/app" # Return to WORKDIR


echo "--- Entrypoint: Starting Uvicorn ---"
# Ensure venv is activated for the uvicorn command
# The PATH should already be set by Dockerfile's ENV PATH="$VENV_PATH/bin:$PATH"

# Execute Uvicorn, replacing this script process
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
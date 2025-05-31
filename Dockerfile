# Use an NVIDIA CUDA base image
# Choose a version compatible with your GPU drivers and library requirements.
# 12.1.0 is a recent stable version. Check compatibility if needed.
FROM nvidia/cuda:12.1.0-cudnn8-runtime-ubuntu22.04

# Prevent apt-get from asking questions
ENV DEBIAN_FRONTEND=noninteractive

WORKDIR /app

# Install Python, pip, venv, and essential build tools + your system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.10 \
    python3.10-dev \
    python3.10-venv \
    python3-pip \
    git \
    ffmpeg \
    libgl1-mesa-glx \
    # build-essential might be needed if any pip package compiles C/C++ extensions
    build-essential \
    && rm -rf /var/lib/apt/lists/* \
    # Clean up DEBIAN_FRONTEND
    && apt-get clean

# Make python3.10 the default python3 and pip point to python3.10's pip
RUN update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.10 1 && \
    pip3 install --no-cache-dir --upgrade pip setuptools wheel

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=off \
    PIP_DISABLE_PIP_VERSION_CHECK=on \
    VENV_PATH=/app/venv \
    PORT=8000 \
    MEDIA_DIR=/app/media

# Create and activate virtual environment (using python3.10 explicitly)
RUN python3.10 -m venv $VENV_PATH
ENV PATH="$VENV_PATH/bin:$PATH"

# Install Python dependencies
# Note: onnxruntime-gpu should now be able to find and use CUDA
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install -r requirements.txt

# Copy your backend application code
COPY ./app .

# Create the media directory mount point target
RUN mkdir -p $MEDIA_DIR

# Expose the port the app runs on
EXPOSE $PORT

# Create a non-root user with a fixed UID (e.g., 1001) and switch to it
# This UID can be used to manage permissions on mounted volumes from the host.
RUN useradd -m -u 1001 myuser && \
    chown -R myuser:myuser $VENV_PATH && \
    chown -R myuser:myuser /app
# Note: chown on $MEDIA_DIR itself here has limited effect if it's immediately overlaid by a volume mount.
# Permissions on the host-side mounted volume are key.

USER myuser

# Command to run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "$PORT"]
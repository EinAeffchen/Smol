<div align="center">
  <img src="frontend/public/logo.png" alt="logo" width="200"/>
</div>

# Smart Media Organizing Library

This project is a powerful, self-contained media management system designed to run as a standalone service. It brings advanced, AI-powered features like face recognition, multi-lingual full-text search, and similarity tracking directly to your personal photo and video collection, all without relying on external databases or APIs.

<a href="https://photos.dummer.dev">Read only Demo</a>

<img src="app/screenshots/Front.PNG">

---

## Key Features

-   **Face Recognition & Person Tracking**
    -   Automatically detects faces in photos and videos.
    -   Groups faces belonging to the same person, allowing you to name and organize them.
    -   Tracks people across your entire media library to find all content they appear in.

    <br>
    <img src="app/screenshots/Person_Tracking.PNG">
    <img src="app/screenshots/Person_suggestions.PNG">
    <br>

-   **Multi-Lingual Full-Text Search**
    -   Supports multiple languages, allowing you to find media by what they depict, moods, etc

    <br>
    <img src="app/screenshots/search_en.PNG">
    <img src="app/screenshots/search_jp.PNG">
    <br>

-   **Content-Based Similarity Search**
    -   Finds visually similar photos and videos, making it easy to discover related content or duplicates.

    <br>
    <img src="app/screenshots/similar.PNG">
    <br>

-   **Interactive Map & Geotagging**
    -   Displays all geotagged photos on an interactive world map.
    -   Includes a dedicated API endpoint to add or update GPS coordinates for your media.

    <br>
    <img src="app/screenshots/map.PNG">
    <br>

-   **Advanced Media Processing**
    -   **Built-in Video Converter:** Convert videos into a web-compatible format for seamless playback with one click.
    -   **EXIF Processor:** Reads and displays detailed metadata (camera model, shutter speed, ISO, etc.) from your photos.

-   **Flexible Organization**
    -   **Free Tagging System:** Add any number of custom tags to your photos and videos for flexible organization.
    -   **Infinite Scroll:** A modern, infinite-scrolling library view for effortlessly browsing thousands of media files.
    -   **Read-Only Mode:** A special mode for secure, online presentation of your library without allowing changes.
    -   **Enable/Disable people** Only want to present your photos and videos without focusing on the people? No problem simply deactivate the recognition via env (ENABLE_PEOPLE=false)

---

## Getting Started

This application can be run directly on your machine or as a Docker container.

> For arm64 support, update the sqlite-vec version in the requirements.txt to 0.1.7a2 and build with `docker buildx build --platform linux/arm64 <name>`

1. **Create .env for docker-compose**
    Copy the .env.template file and rename it `.env`.
    ```bash
    cp .env.template .env
    ```
    Set the variables as described within the <> in your new .env file
    Make sure you create the folder your HOST_DATA_DIR shows to, otherwise docker will create it as root!

3.  **Start the Container:**
    This command will build the Docker image (if it doesn't exist) and start the container.

    ```bash
    docker compose up -d
    ```

4.  **Access the Application:**
Your media manager will be available in your browser at Your media manager should now be running and be accssible at **[http://localhost:8000](http://localhost:8000)**


---

## License

- Project license: PolyForm Noncommercial License 1.0.0. See `LICENSE.md`.
- Third‑party software remains under its own licenses. See `THIRD_PARTY_NOTICES.md`.

Noncommercial only: You may use, run, modify, and share this project for non‑commercial purposes, but commercial use is not permitted under this license.

## Redistribution Notes (Binaries and Docker)

- Binaries (PyInstaller):
  - The application may bundle Qt/PySide6 components. PySide6 is licensed under LGPL‑3.0.
  - Include copies of the LGPL‑3.0 and relevant Qt/PySide6 license texts in your distribution, allow reverse engineering for debugging such modifications, and ensure dynamic linking to Qt libraries (PyInstaller typically bundles shared libraries).
  - If you include Apache‑2.0 components with `NOTICE` files (e.g., some ML libraries), include their `NOTICE` content.

- Docker Image:
  - The image installs `ffmpeg` via Debian packages. FFmpeg’s licenses and notices are included in the image (e.g., `/usr/share/doc/ffmpeg/`). Preserve those when redistributing the image and comply with the license terms for enabled codecs.
  - The image contains additional third‑party packages installed via `uv` (Python). Refer to `THIRD_PARTY_NOTICES.md` for attribution and consider including generated license reports in releases.

## Third‑Party License Reports (Optional)

For precise attribution per release, you can generate machine‑readable reports:

- Python:
  - `uv pip install pip-licenses`
  - `uv run pip-licenses --with-system --format=markdown --output-file THIRD_PARTY_LICENSES_PY.md`

- Frontend:
  - `npm i -g license-checker`
  - `license-checker --production --summary --json > THIRD_PARTY_LICENSES_JS.json`

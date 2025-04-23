# Smol Media Platform

[![Python](https://img.shields.io/badge/Python-%3E%3D3.10-blue)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-%5E0.95-lightgrey)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-%5E18.0-61DAFB)](https://reactjs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A **self‑contained**, **volume‑mounted** media server with face detection, recognition, tagging, and metadata processors—built with **FastAPI**, **SQLite**, and **React**.


## 🚀 Features

- **Automatic Ingestion**  
  Scan a mounted media folder (`./media`), detect new images/videos, extract basic metadata (size, duration, resolution), and generate thumbnails.

- **Face Detection & Recognition**  
  Extract up to N faces per video/image, compute embeddings, assign faces to “persons”, merge duplicates, and suggest similar people.

- **Tagging & Search**  
  Tag media and persons, query by name, age, tags, or custom processor output.

- **Extensible Processor System**  
  Drop new Python “processors” in `app/processors/` (e.g. EXIF, OCR, speech‑to‑text). Each processor writes its own tables and exposes results via a generic API and UI panel.

- **Single‑Process Deployment**  
  Serve static React assets and API from one FastAPI + Uvicorn instance—no Docker, no extra web server.

- **Responsive Front‑End**  
  Built with React, Vite, Tailwind CSS. Auto‑fitting grids for media, faces, and similar‑people panels.


## 📦 Tech Stack

- **Backend**: Python 3.10+, FastAPI, SQLModel (SQLAlchemy), SQLite  
- **Media**: FFmpeg, OpenCV, DeepFace  
- **Frontend**: React, TypeScript, Vite, Tailwind CSS  
- **Processing Plugins**: Python modules under `app/processors/`  



## ⚙️ Installation & Setup


### Prerequisites
* Install [npm](https://docs.npmjs.com/cli/v9/configuring-npm/install?v=trues) 



1. Clone the repo
    ```sh
    git clone [git@github.com:EinAeffchen/Smol.git](https://github.com/EinAeffchen/Smol.git)
    cd smol-media-platform
    ```

2. Prepare your media volume
Mount (or create) a folder for your images/videos, e.g.:
    ```sh
    mkdir -p ~/smol_media/media/
    export MEDIA_DIR=~/smol_media/media
    ```

3. Build & copy frontend assets
    ```sh
    make build
    ```

4. Run the server
    ```sh
    make up
    ````
    The API & SPA are both served from http://localhost:8000/.

## Usage
### Initial Scan

Open the UI in your browser, click in the upper right on the Menu and 
1. Start the initial scan with `Scan Folder`. 
2. Start processing the detected media with `Process Media`
3. Create Person clusters based on the extracted face embeddings with `Cluster Persons`

### Web UI

    Browse newest / most‑viewed media, people, and tags.

    Search by name, age, tags, or processor outputs.

    Person Detail: edit profile, merge duplicates, view face carousel, similar‑people suggestions.

    Media Detail: hover‑play videos, view image preview, see detected faces, EXIF, OCR, or any processor results via the “Processor Outputs” panel.

    Tagging: add/remove tags on media & persons.

📈 Extending with Processors

To add a new media processor:

    Create app/processors/your_processor.py

    Implement a subclass of MediaProcessor (see base.py):

    class MyProcessor(MediaProcessor):
        name = "my_processor"
        def process(self, media, session):
            …  # insert your tables, enrich rows
        def get_results(self, media_id, session):
            …  # optional JSON for front‑end

    Adjust the [app/models.py](app/models.py) database models as needed.

    Restart the server - your new processor runs on each `Process Media` call, and its results are available with api under `/api/media/{media_id}/processors/{processor_name}`.

🔗 API Reference

    POST /api/scan
    Enqueue a new scan of media/originals/.

    GET /api/media
    List & filter media by tags, persons, etc.

    GET /api/media/{id}
    Get media detail (thumbnails, faces, tags, processor‑results).

    GET /api/persons, GET /api/persons/{id}, PATCH /api/persons/{id}, DELETE /api/persons/{id}
    CRUD & merge persons.

    GET /api/media/{id}/processors
    List all processor names.

    GET /api/media/{id}/processors/{name}
    Fetch JSON output for a given processor.

For more check your local [http://localhost:8000/docs](http://localhost:8000/docs)

📄 License

This project is licensed under the MIT License. See LICENSE for details.
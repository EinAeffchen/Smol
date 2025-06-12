SHELL := /usr/bin/bash
.SHELLFLAGS := -ec

ENV_FILE ?= .env

ifneq ($(strip $(wildcard $(ENV_FILE))),)
    include $(ENV_FILE)

    _ENV_VARS_TO_EXPORT := $(shell grep -vE '^\s*#|^\s*$$' $(ENV_FILE) | cut -d= -f1)
    ifneq ($(_ENV_VARS_TO_EXPORT),)
        export $(_ENV_VARS_TO_EXPORT)
    endif
    _ENV_VARS_TO_EXPORT :=
endif


VENV         ?= $(MEDIA_DIR)/.smol/venv
PIP          := $(VENV)/bin/pip
PYTHON       := $(VENV)/bin/python
UVICORN      := $(VENV)/bin/uvicorn

$(VENV)/bin/activate:
	@test -n "$(MEDIA_DIR)" || (echo "MEDIA_DIR not set"; exit 1)
	@python3 -m venv "$(VENV)"
	@$(PIP) install --upgrade pip

install: $(VENV)/bin/activate
	@$(PIP) install -r requirements.txt

up: 
	$(UVICORN) app.main:app --reload --log-level debug --host 0.0.0.0 --port $(PORT)

build: install
	ifndef MEDIA_DIR
	$(error MEDIA_DIR is not set)
	endif
	cd frontend && npm install && npm run build
	mkdir -p "${MEDIA_DIR}/.smol/static"
	cp -r frontend/dist/* "${MEDIA_DIR}/.smol/static"

test:
	${PYTHON}

dev:
	cd frontend && npm run dev

docker-start:
	mkdir -p ${HOST_DATABASE_DIR}
	docker compose up -d --build

backup:
	sqlite3 ".backup ${HOST_DATABASE_DIR}/smol.db '${HOST_MEDIA_DIR}/db.backup'"
SHELL := /usr/bin/bash
.SHELLFLAGS := -ec

ENV_FILE ?= local.env

DOCKER_TARGETS := docker-start docker-down push

ifneq (,$(filter $(DOCKER_TARGETS),$(MAKECMDGOALS)))
	ENV_FILE := smol.env
endif

ifneq ($(strip $(wildcard $(ENV_FILE))),)
	include $(ENV_FILE)
	export $(shell grep -vE '^\s*#|^\s*$$' $(ENV_FILE) | cut -d= -f1)
endif

VENV		?= $(shell pwd)/venv
PIP			:= $(VENV)/bin/pip
PYTHON		:= $(VENV)/bin/python
UVICORN		:= $(VENV)/bin/uvicorn

install:
	@python3 -m venv "$(VENV)"
	@$(PIP) install --upgrade pip
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

dev:
	cd frontend && npm install && npm run dev

docker-start:
	@echo "--- Using Docker environment from $(ENV_FILE) ---"
	@test -n "$(HOST_MEDIA_DIR)" || (echo "HOST_MEDIA_DIR from smol.env is not set"; exit 1)
	mkdir -p ${HOST_DATA_DIR}
	PUID=$(shell id -u) PGID=$(shell id -g) docker compose up -d

docker-down:
	@echo "--- Using Docker environment from $(ENV_FILE) ---"
	@test -n "$(HOST_MEDIA_DIR)" || (echo "HOST_MEDIA_DIR from smol.env is not set"; exit 1)
	PUID=$(shell id -u) PGID=$(shell id -g) docker compose down

backup:
	sqlite3 ".backup ${HOST_DATA_DIR}/smol.db '${HOST_MEDIA_DIR}/db.backup'"

build-image:
	docker build -t smol .
	docker tag smol einaeffchen2/smol

push: build-image
	docker push einaeffchen2/smol

alembic-generate:
	echo ${DATA_DIR}
	alembic revision --autogenerate -m "RENAME_ME"

alembic-upgrade:
	alembic upgrade head

alembic-downgrade:
	alembic downgrade -1
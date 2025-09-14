# SHELL := /usr/bin/bash
# .SHELLFLAGS := -ec

ENV_FILE ?= omoide.env

DOCKER_TARGETS := docker-start docker-down push

ifneq (,$(filter $(DOCKER_TARGETS),$(MAKECMDGOALS)))
	ifndef ENV_FILE
		ENV_FILE := omoide.env
	endif
endif

ifneq ($(strip $(wildcard $(ENV_FILE))),)
	include $(ENV_FILE)
	export $(shell grep -vE '^\s*#|^\s*$$' $(ENV_FILE) | cut -d= -f1)
endif

VENV		?= $(shell pwd)/venv
PIP			:= $(VENV)/bin/pip
PYTHON		:= $(VENV)/bin/python

up: 
	uvicorn app.main:app --reload --log-level debug --host 0.0.0.0 --port 8000 

build: 
	cd frontend && npm install && npm run build
	pyinstaller .\main.spec

dev:
	cd frontend && npm install && npm run dev

docker-start:
	docker compose up -d

docker-down:
	@echo "--- Using Docker environment from $(ENV_FILE) ---"
	@test -n "$(HOST_MEDIA_DIR)" || (echo "HOST_MEDIA_DIR from omoide.env is not set"; exit 1)
	PUID=$(shell id -u) PGID=$(shell id -g) docker compose down

backup:
	sqlite3 ".backup ${HOST_DATA_DIR}/omoide.db '${HOST_MEDIA_DIR}/db.backup'"

build-image:
	docker build -t omoide .
	docker tag omoide einaeffchen2/omoide

push: build-image
	docker push einaeffchen2/omoide

alembic-generate:
	echo ${DATA_DIR}
	alembic revision --autogenerate -m "RENAME_ME"

alembic-upgrade:
	alembic upgrade head

alembic-downgrade:
	alembic downgrade -1
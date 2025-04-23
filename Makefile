VENV := $(MEDIA_DIR)/.smol/venv
PIP := $(VENV)/bin/pip
PYTHON := $(VENV)/bin/python
UVICORN := $(VENV)/bin/uvicorn

$(VENV)/bin/activate:
	@test -n "$(MEDIA_DIR)" || (echo "MEDIA_DIR not set"; exit 1)
	@python3 -m venv $(VENV)
	@$(PIP) install --upgrade pip

install: $(VENV)/bin/activate
	@$(PIP) install -r requirements.txt

up: $(UVICORN)
	$(UVICORN) app.main:app --reload --log-level debug --host 0.0.0.0 --port 8001

build: install
	cd frontend && npm install && npm run build
	mkdir -p ${MEDIA_DIR}/.smol/static
	cp -r frontend/dist/* ${MEDIA_DIR}/.smol/static

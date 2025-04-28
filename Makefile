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

load_scene_model:
ifeq (,$(wildcard ./app/models/resnet18_places365.pth.tar))
	wget -O ./app/models/resnet18_places365.pth.tar http://places2.csail.mit.edu/models_places365/resnet18_places365.pth.tar
	wget -O ./app/models/categories.txt https://raw.githubusercontent.com/csailvision/places365/master/categories_places365.txt
else
	echo "Model already downloaded"
endif

up: $(UVICORN)
	$(UVICORN) app.main:app --reload --log-level debug --host 0.0.0.0 --port 8000

build: install load_scene_model
	cd frontend && npm install && npm run build
	mkdir -p ${MEDIA_DIR}/.smol/static
	cp -r frontend/dist/* ${MEDIA_DIR}/.smol/static

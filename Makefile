all: build up 

build:
	docker-compose build

up:
	docker-compose up -d django

logs:
	docker logs django
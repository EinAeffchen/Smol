all: build up 

build:
	docker-compose build

up:
	docker-compose up -d

logs:
	docker logs django

down:
	docker-compose down

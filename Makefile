all: build up 

build:
	docker-compose -p moars build

up:
	docker-compose -p moars up -d 

logs:
	docker logs django

down:
	docker-compose -p moars down

killall:
	docker kill django nginx postgresql
	docker rm django nginx postgresql
	docker volume rm moars_db-data moars_media-volume moars_ml-volume moars_static-movie-volume moars_static-volume

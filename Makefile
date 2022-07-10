all: build-image push kill up 

build-image:
	docker build -t smol .
	docker build -t smol_nginx ./nginx

push:
	docker tag smol einaeffchen/smol
	docker push einaeffchen/smol
	docker tag smol_nginx einaeffchen/smol_nginx
	docker push einaeffchen/smol_nginx

kill:
	docker-compose down
	docker-compose rm -f

up:
	docker-compose pull
	docker-compose -p smol up -d 

logs:
	docker logs django

down:
	docker-compose -p smol down

killall:
	docker kill django nginx postgresql
	docker rm django nginx postgresql
	docker volume rm smol_db-data smol_media-volume smol_ml-volume smol_static-movie-volume smol_static-volume

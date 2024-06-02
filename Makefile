kill:
	docker-compose down
	docker-compose rm -f

mount:
	rclone mount onedrive_crypt:/sec smol/local_media --buffer-size 128Mi --drive-chunk-size 128M --vfs-cache-max-age 210000h --vfs-read-ahead 128Mi --vfs-cache-mode full --allow-other &

unmount:
	umount smol/local_media

up:
	cd smol && python3 manage.py collectstatic --noinput
	cd smol && python3 manage.py makemigrations
	cd smol && python3 manage.py migrate
	cd smol && python3 manage.py runserver

logs:
	docker logs django

down:
	docker-compose -p smol down

killall:
	docker kill django nginx postgresql
	docker rm django nginx postgresql
	docker volume rm smol_db-data smol_media-volume smol_ml-volume smol_static-movie-volume smol_static-volume

#!/usr/bin/env sh

python ./fapflix/manage.py makemigrations
python ./fapflix/manage.py migrate
python ./fapflix/manage.py loaddata labels.json
python ./fapflix/manage.py runserver


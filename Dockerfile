FROM python:3.11.0b3-slim

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
RUN pip install --upgrade pip

RUN mkdir /code
WORKDIR /code
COPY requirements.txt /code/
RUN apt-get update
RUN apt-get install ffmpeg -y
RUN pip install -r requirements.txt
COPY ./smol /srv/data/smol
WORKDIR /srv/data/smol
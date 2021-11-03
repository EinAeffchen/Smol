FROM nginx:1.17.2-alpine

RUN apk update && apk add bash && apk add fail2ban && apk add openrc --no-cache
RUN apk add --no-cache bash
RUN apk add --upgrade apache2-utils
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d
RUN mkdir -p /etc/nginx
FROM node:0.12-onbuild

RUN apt-get update
RUN apt-get -y upgrade

RUN apt-get -f install -y graphicsmagick

EXPOSE 3000

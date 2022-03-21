# This dockerfile is for the API + Frontend production image

#############################################
# Build osm2pgsql AS builder
#############################################

# This image should be the same as final one, because of the lib versions
FROM python:3.9.7-bullseye as osm2pgsql-builder

ARG DEBIAN_FRONTEND=noninteractive
ENV TZ=Europe/Berlin
ENV OSM2PGSQL_VERSION=1.5.1

# Dependencies
RUN apt-get update &&\
    apt-get install -y \
    make \
    cmake \
    g++ \
    libboost-dev \
    libboost-system-dev \
    libboost-filesystem-dev \
    libexpat1-dev \
    zlib1g-dev \
    libbz2-dev \
    libpq-dev \
    libproj-dev \
    lua5.3 \
    liblua5.3-dev \
    git &&\
    rm -rf /var/lib/apt/lists/*

# Clone & Build
RUN git clone  --branch $OSM2PGSQL_VERSION https://github.com/openstreetmap/osm2pgsql.git &&\
    cd osm2pgsql/ &&\
    mkdir build &&\
    cd build &&\
    cmake .. &&\
    make -j4 &&\
    make install

#############################################
# Build the frontend AS builder
#############################################

FROM node:17 as frontend-builder

WORKDIR /opt/obs/frontend
ADD frontend/package.json frontend/package-lock.json /opt/obs/frontend/
RUN echo update-notifier=false >> ~/.npmrc
RUN npm ci

ADD frontend/tsconfig.json frontend/webpack.config.js /opt/obs/frontend/
ADD frontend/src /opt/obs/frontend/src/
ADD frontend/public /opt/obs/frontend/public/

RUN npm run build

#############################################
# Build the API and add the built frontend to it
#############################################

FROM python:3.9.7-bullseye

RUN apt-get update &&\
    apt-get install -y \
    libboost-dev \
    libboost-system-dev \
    libboost-filesystem-dev \
    libexpat1-dev \
    zlib1g-dev \
    libbz2-dev \
    libpq-dev \
    libproj-dev \
    lua5.3 \
    liblua5.3-dev &&\
    rm -rf /var/lib/apt/lists/*

WORKDIR /opt/obs/api

ADD api/requirements.txt  /opt/obs/api/
RUN pip install -r requirements.txt

ADD tile-generator /opt/obs/tile-generator

ADD api/scripts /opt/obs/scripts
RUN pip install -e /opt/obs/scripts

ADD api/setup.py  /opt/obs/api/
ADD api/alembic.ini /opt/obs/api/
ADD api/migrations /opt/obs/api/migrations/
ADD api/obs /opt/obs/api/obs/
ADD api/tools /opt/obs/api/tools/
RUN pip install -e /opt/obs/api/

ADD roads_import.lua /opt/obs/api/tools
ADD osm2pgsql.sh /opt/obs/api/tools

COPY --from=frontend-builder /opt/obs/frontend/build /opt/obs/frontend/build
COPY --from=osm2pgsql-builder /usr/local/bin/osm2pgsql /usr/local/bin/osm2pgsql

EXPOSE 3000

CMD ["openbikesensor-api"]

# This dockerfile is for the API + Frontend production image

#############################################
# Build the frontend AS builder
#############################################

FROM node:18 as frontend-builder

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

FROM python:3.12.8-bookworm

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
    python3-dev \
    liblua5.3-dev &&\
    rm -rf /var/lib/apt/lists/*

# install protobuf-compiler (protoc) to /opt/protobuf, but don 't use the debian
# one, as it is horribly outdated

ADD https://github.com/protocolbuffers/protobuf/releases/download/v26.0/protoc-26.0-linux-x86_64.zip /tmp/protoc.zip
ADD https://github.com/openbikesensor/proto/archive/refs/tags/v1.0.0.tar.gz /tmp/obsproto.tar.gz
RUN unzip -d /opt/protobuf /tmp/protoc.zip \
  && tar -zvxf /tmp/obsproto.tar.gz\
  && mkdir -p /opt/obs\
  && cp -r proto-1.0.0 /opt/obs/proto

WORKDIR /opt/obs/proto

RUN PATH="/opt/protobuf/bin:${PATH}" make && pip install --root-user-action ignore .
WORKDIR /opt/obs/api

ADD api/requirements.txt  /opt/obs/api/
RUN pip install --root-user-action ignore -r requirements.txt

ADD tile-generator /opt/obs/tile-generator

ADD api/setup.py  /opt/obs/api/
ADD api/alembic.ini /opt/obs/api/
ADD api/migrations /opt/obs/api/migrations/
ADD api/obs /opt/obs/api/obs/
ADD api/tools /opt/obs/api/tools/
RUN pip install --root-user-action ignore -e /opt/obs/api/

COPY --from=frontend-builder /opt/obs/frontend/build /opt/obs/frontend/build

EXPOSE 3000

CMD ["openbikesensor-api"]

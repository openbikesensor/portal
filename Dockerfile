# This dockerfile is for the API + Frontend production image

#############################################
# Build the frontend AS builder
#############################################

FROM node:24-alpine AS frontend-builder

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

FROM ghcr.io/astral-sh/uv:python3.14-trixie

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

RUN PATH="/opt/protobuf/bin:${PATH}" make
WORKDIR /opt/obs/api


COPY tile-generator /opt/obs/tile-generator

COPY api/pyproject.toml  /opt/obs/api/
COPY api/uv.lock /opt/obs/api/
COPY api/alembic.ini /opt/obs/api/
COPY api/migrations /opt/obs/api/migrations/
COPY api/obs /opt/obs/api/obs/
COPY api/tools /opt/obs/api/tools/
WORKDIR /opt/obs/api
RUN uv sync --locked
RUN uv pip install --no-deps /opt/obs/proto
RUN uv pip install --no-deps .

COPY --from=frontend-builder /opt/obs/frontend/build /opt/obs/frontend/build

EXPOSE 3000

ENV PATH=/opt/obs/api/.venv/bin:/usr/local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
CMD ["openbikesensor-api"]

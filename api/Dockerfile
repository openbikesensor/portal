from ghcr.io/astral-sh/uv:python3.14-trixie

# install protobuf-compiler (protoc) to /opt/protobuf, but don't use the debian
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


# Notice in the development compose file, we mount a bunch of things in here via volumes to
# not have to build the container for every change...
COPY pyproject.toml /opt/obs/api/
COPY uv.lock /opt/obs/api/
COPY obs /opt/obs/api/obs/
COPY tools /opt/obs/api/tools
RUN uv sync --locked
RUN uv pip install --no-deps /opt/obs/proto
RUN uv pip install --no-deps .


EXPOSE 8000
ENV PATH=/opt/obs/api/.venv/bin:/usr/local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

CMD ["openbikesensor-api"]

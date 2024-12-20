FROM python:3.12.8-bookworm

# install protobuf-compiler (protoc) to /opt/protobuf, but don't use the debian
# one, as it is horribly outdated
RUN wget -O /tmp/protoc.zip \
  https://github.com/protocolbuffers/protobuf/releases/download/v26.0/protoc-26.0-linux-x86_64.zip \
  && unzip -d /opt/protobuf /tmp/protoc.zip

RUN wget -O /tmp/obsproto.tar.gz https://github.com/openbikesensor/proto/archive/refs/tags/v1.0.0.tar.gz\
  && tar -zvxf /tmp/obsproto.tar.gz\
  && mkdir -p /opt/obs\
  && cp -r proto-1.0.0 /opt/obs/proto

WORKDIR /opt/obs/proto
RUN PATH=/opt/protobuf/bin:$PATH make && pip install .

WORKDIR /opt/obs/api

COPY requirements.txt /opt/obs/api/
COPY setup.py /opt/obs/api/
COPY obs /opt/obs/api/obs/
COPY tools /opt/obs/api/tools
RUN pip install -r requirements.txt; pip install .


EXPOSE 8000

CMD ["openbikesensor-api"]

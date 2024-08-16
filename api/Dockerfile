FROM python:3.12.5-bullseye

# install protobuf-compiler (protoc) to /opt/protobuf, but don't use the debian
# one, as it is horribly outdated
RUN wget -O /tmp/protoc.zip \
  https://github.com/protocolbuffers/protobuf/releases/download/v26.0/protoc-26.0-linux-x86_64.zip \
  && unzip -d /opt/protobuf /tmp/protoc.zip

WORKDIR /opt/obs/proto

ADD proto/ /opt/obs/proto/
RUN PATH=/opt/protobuf/bin:$PATH make && pip install .

WORKDIR /opt/obs/api

ADD requirements.txt /opt/obs/api/
RUN pip install -r requirements.txt

ADD setup.py /opt/obs/api/
ADD obs /opt/obs/api/obs/
RUN pip install -e .

EXPOSE 8000

CMD ["openbikesensor-api"]

FROM python:3.9.7-bullseye

WORKDIR /opt/obs/api

ADD scripts /opt/obs/scripts
RUN pip install -e /opt/obs/scripts

ADD requirements.txt setup.py /opt/obs/api/
ADD obs /opt/obs/api/obs/
RUN pip install -e .

EXPOSE 8000

CMD ["openbikesensor-api"]

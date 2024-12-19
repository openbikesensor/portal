FROM python:3.12-bookworm

WORKDIR /opt/obs/api

ADD requirements.txt /opt/obs/api/
RUN pip install -r requirements.txt
ADD setup.py /opt/obs/api/
ADD obs /opt/obs/api/obs/
RUN pip install -e .

EXPOSE 8000

CMD ["openbikesensor-api"]

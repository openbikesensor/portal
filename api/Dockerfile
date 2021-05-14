FROM node:15.14-buster

# Install python3, pip3, and make them the default for `python` and `pip` commands
RUN apt-get update && apt-get install -y python3 python3-pip
RUN ln -s $(which python3) /usr/local/bin/python
RUN ln -s $(which pip3) /usr/local/bin/pip

WORKDIR /opt/obs/api

ADD package.json package-lock.json /opt/obs/api/
RUN echo update-notifier=false >> ~/.npmrc
RUN npm ci

ADD scripts /opt/obs/api/scripts/
RUN cd scripts && pip install -e .

ADD views /opt/obs/api/views/
ADD src /opt/obs/api/src/

#ADD .migrations.js .
#ADD migrations .

EXPOSE 3000

ENV PORT=3000
ENV DATA_DIR=/data

CMD ["npm", "run", "start"]
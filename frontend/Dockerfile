FROM node:15.14-buster

WORKDIR /opt/obs/frontend
ADD package.json package-lock.json /opt/obs/frontend/
RUN npm ci

ADD tsconfig.json /opt/obs/frontend
ADD public/ /opt/obs/frontend/public/
ADD src/ /opt/obs/frontend/src/

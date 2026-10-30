FROM node:24-alpine

WORKDIR /opt/obs/frontend
COPY package.json package-lock.json /opt/obs/frontend/
RUN echo update-notifier=false >> ~/.npmrc
RUN npm ci --ignore-scripts

COPY tsconfig.json webpack.config.js /opt/obs/frontend/
COPY public/ /opt/obs/frontend/public/
COPY src/ /opt/obs/frontend/src/

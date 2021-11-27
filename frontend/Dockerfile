FROM node:17

WORKDIR /opt/obs/frontend
ADD package.json package-lock.json /opt/obs/frontend/
RUN echo update-notifier=false >> ~/.npmrc
RUN npm ci

ADD tsconfig.json webpack.config.js /opt/obs/frontend/
ADD public/ /opt/obs/frontend/public/
ADD src/ /opt/obs/frontend/src/

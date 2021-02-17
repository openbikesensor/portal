FROM node:14

WORKDIR /opt/obs/api
ADD package.json package-lock.json /opt/obs/api/
RUN npm ci

ADD src /opt/obs/api/src/

EXPOSE 3000
ENV PORT=3000
CMD ["npm", "start"]

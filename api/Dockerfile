FROM node:14

WORKDIR /opt/obsAPI
ADD package.json package-lock.json /opt/obsAPI/
RUN npm ci

ADD src /opt/obsAPI/src/

EXPOSE 8080
ENV PORT=8080
CMD ["npm", "start"]

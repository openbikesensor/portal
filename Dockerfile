FROM node:14

WORKDIR /opt/obsAPI
ADD package.json package-lock.json /opt/obsAPI/
RUN npm ci

ADD _helpers _middleware accounts config models public routes app.js /opt/obsAPI/

EXPOSE 8080
ENV PORT=8080
CMD ["npm", "start"]

FROM node:22-alpine

WORKDIR /app

COPY package.json ./
COPY server.js ./
COPY index.html ./
COPY app.js ./
COPY styles.css ./

EXPOSE 8443

CMD ["npm", "start"]

FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.js ./
COPY src ./src
COPY test ./test

RUN mkdir -p /app/data

EXPOSE 3443

CMD ["npm", "start"]

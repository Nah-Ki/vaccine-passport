# server/Dockerfile
FROM node:alpine

WORKDIR /usr/src/app

COPY package.json yarn.lock ./

RUN yarn install --production=false

COPY . .

EXPOSE 4000

CMD ["yarn", "start"]

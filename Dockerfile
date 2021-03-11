FROM node:14
ENV NODE_ENV=production

WORKDIR /app

COPY ["package.json", "package-lock.json*", "tsconfig.json", "./"]

RUN npm install --production

COPY . .

RUN npm run build

CMD [ "node", "./dist/app.js" ]
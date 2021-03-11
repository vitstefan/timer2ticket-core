FROM node:14
ENV NODE_ENV=production

WORKDIR /app

COPY ["package.json", "package-lock.json*", "tsconfig.json", "./"]

RUN npm install --production
RUN npm run build

COPY . .

CMD [ "node", "./dist/app.js" ]
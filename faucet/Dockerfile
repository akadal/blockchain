FROM node:18-alpine

WORKDIR /app

COPY package.json .
# We will create package.json next 
RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]

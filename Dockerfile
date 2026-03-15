FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

# Ensure data and uploads dirs exist
RUN mkdir -p data uploads

EXPOSE 3000

CMD ["node", "server.js"]

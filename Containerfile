FROM docker.io/node:20-slim
WORKDIR /app
COPY . .
RUN npm i
CMD ["node", "src/server.js"]
EXPOSE 5000

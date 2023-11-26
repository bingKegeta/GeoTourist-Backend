FROM docker.io/python:3.10-slim
WORKDIR /app

COPY . .
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
RUN apt-get update
RUN apt-get install -f nodejs npm -y
RUN pip install --no-cache-dir -r ./location-suggest/random-forest/setup/requirements.txt
RUN npm i

CMD ["node", "src/server.js"]
EXPOSE 5000

FROM docker.io/python:3.10-slim
WORKDIR /app

COPY . .
RUN apt-get update
RUN apt-get install curl -y
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
RUN apt-get install nodejs -y
#RUN curl https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem | openssl x509 -inform PEM -out /usr/local/share/ca-certificates/mongo.crt
#RUN update-ca-certificates
RUN curl https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem > global-bundle.pem
RUN pip install --no-cache-dir -r ./location-suggest/random-forest/setup/requirements.txt
RUN npm i

CMD ["node", "src/server.js"]
EXPOSE 80

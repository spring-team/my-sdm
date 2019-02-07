FROM atomist/sdm-base:0.0.4

RUN npm install --global yarn

RUN apt-get update && apt-get install -y \
        libfontconfig \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./

ARG NPMRC
RUN echo "$NPMRC" > .npmrc \
    && npm ci \
    && npm cache clean --force \
    && rm .npmrc

COPY . .

# Declaring a volume will instruct kaniko to skip the directory when snapshotting
VOLUME /opt/app

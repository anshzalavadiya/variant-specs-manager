FROM node:20-slim

RUN apt-get update && apt-get install -y openssl python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

EXPOSE 3000

WORKDIR /app

ENV NODE_ENV=production
ENV ROLLUP_SKIP_NODEJS_NATIVE=1

COPY package.json package-lock.json* ./

RUN npm ci
RUN npm install @rollup/rollup-linux-x64-gnu --save-optional
RUN npm cache clean --force

COPY . .

RUN npm run build

CMD ["npm", "run", "docker-start"]
FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY api ./api
COPY server ./server
COPY src/domain ./src/domain
COPY src/data ./src/data
COPY tsconfig.cloudrun.json ./tsconfig.cloudrun.json

RUN npm run build:cloudrun

FROM node:22-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/build/cloudrun ./build/cloudrun

EXPOSE 8080

CMD ["npm", "run", "start:cloudrun"]

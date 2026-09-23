# Build stage — installs full deps (incl. dev) and compiles Nest.
FROM node:22-alpine AS build
WORKDIR /app

# bcrypt is a native module — needs a toolchain to compile on alpine (musl)
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Runtime stage — same base image as build, so the compiled bcrypt binary
# is ABI-compatible. Fresh prod-only install (ts-node/typescript are real
# runtime deps here: entrypoint runs migrations/seed through the TypeORM
# CLI against .ts sources before starting) — skips jest/eslint/webpack/
# @nestjs-cli/etc that the build stage needed but runtime never touches.
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
    && npm ci --omit=dev \
    && apk del .build-deps

COPY --from=build /app/dist ./dist
COPY --from=build /app/src ./src
COPY --from=build /app/data-source.ts ./data-source.ts
COPY --from=build /app/tsconfig*.json ./

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && \
    sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]

# Build stage — installs full deps (incl. dev: ts-node/typescript, needed at
# runtime too, since migration:run/seed:user run against .ts sources via the
# TypeORM CLI, not compiled dist) and compiles Nest.
FROM node:22-alpine AS build
WORKDIR /app

# bcrypt is a native module — needs a toolchain to compile on alpine (musl)
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Runtime stage — same base image as build, so the compiled bcrypt binary
# is ABI-compatible. Keeps dev deps (ts-node/typescript) because the
# entrypoint runs migrations/seed through the TypeORM CLI before starting.
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/src ./src
COPY --from=build /app/data-source.ts ./data-source.ts
COPY --from=build /app/tsconfig*.json ./
COPY --from=build /app/package*.json ./

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && \
    sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]

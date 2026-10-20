# Shattered Stars relay — build context is the REPOSITORY ROOT:
#   docker build -f server/Dockerfile -t ss-relay .
# The relay imports the shared wire protocol (src/net) and the game rules it validates
# against (ship data, map themes), so the whole src tree is copied; esbuild bundles only what is imported.

FROM node:22-alpine AS build
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY server/src ./src
COPY src /app/src
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=8080
WORKDIR /app
COPY --from=build /app/server/dist/server.cjs ./server.cjs
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" >/dev/null || exit 1
CMD ["node", "server.cjs"]

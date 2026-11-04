# Same canonical platform source, with private bootstrap and retained volume IDs.
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/pathfinder/package.json apps/pathfinder/package-lock.json apps/pathfinder/
COPY apps/indoor-map/package.json apps/indoor-map/package-lock.json apps/indoor-map/
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm ci --no-audit --no-fund
COPY . .
ENV CLOUDFLARE_SEND_METRICS=false CI=true
RUN npm run build
RUN cp public/source/radar-campus-explorer.tar.gz dist/pathfinder-upstream-source.tar.gz && cp LICENSE dist/pathfinder-license.txt
COPY integrations/pathfinder/wrangler.local.toml wrangler.toml
FROM node:24-bookworm-slim
WORKDIR /app
COPY --from=build --chown=node:node /app /app
COPY --chown=node:node integrations/pathfinder /opt/radar-pathfinder
RUN mkdir -p /app/.wrangler && chown node:node /app /app/.wrangler
USER node
ENV CLOUDFLARE_SEND_METRICS=false CI=true
VOLUME ["/app/.wrangler"]
EXPOSE 8082
HEALTHCHECK --interval=10s --timeout=5s --start-period=120s CMD node -e "fetch('http://127.0.0.1:8082/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","/opt/radar-pathfinder/start.mjs"]

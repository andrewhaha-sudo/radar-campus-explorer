FROM node:24-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN git init . && git remote add origin https://github.com/melonmelonz/pathfinder.git && git fetch --depth 1 origin d07b3fcf96c3dd04f9ffc5e59120a61d93e99e5a && git checkout --detach FETCH_HEAD && test "$(git rev-parse HEAD)" = "d07b3fcf96c3dd04f9ffc5e59120a61d93e99e5a"
RUN npm ci
# Preserve the complete licensed upstream source before adding runtime configuration.
RUN mkdir -p static && git archive --format=tar.gz HEAD > static/pathfinder-upstream-source.tar.gz && cp LICENSE static/pathfinder-license.txt
COPY integrations/pathfinder/wrangler.local.toml wrangler.toml
ENV WRANGLER_SEND_METRICS=false CI=true
RUN npm run check && npm run test:unit && npm run build
FROM node:24-bookworm-slim
WORKDIR /app
COPY --from=build --chown=node:node /app /app
COPY --chown=node:node integrations/pathfinder /opt/radar-pathfinder
RUN rm -rf /app/.git && mkdir -p /app/.wrangler && chown node:node /app /app/.wrangler
USER node
ENV WRANGLER_SEND_METRICS=false CI=true
VOLUME ["/app/.wrangler"]
EXPOSE 8082
HEALTHCHECK --interval=10s --timeout=5s --start-period=120s CMD node -e "fetch('http://127.0.0.1:8082/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","/opt/radar-pathfinder/start.mjs"]

FROM golang:1.25.3-alpine AS build
WORKDIR /src
COPY services/liferouter/go.mod services/liferouter/go.sum ./
RUN go mod download
COPY services/liferouter/*.go ./
RUN CGO_ENABLED=0 go build -trimpath -o /bridge .
FROM alpine:3.22
RUN adduser -D -u 10001 router
COPY --from=build /bridge /usr/local/bin/bridge
COPY experiments/liferouter/generated /grids
COPY services/liferouter/NOTICE.md /licenses/NOTICE.md
COPY services/liferouter/licenses /licenses
RUN chmod -R a+rX /grids /licenses
USER router
ENV CAMPUS_GRID_DIR=/grids LISTEN_ADDR=0.0.0.0:8091
EXPOSE 8091
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s CMD wget -q -O /dev/null http://127.0.0.1:8091/api/liferouter/health || exit 1
ENTRYPOINT ["bridge"]

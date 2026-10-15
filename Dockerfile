# syntax=docker/dockerfile:1

# Base images are pinned by digest; Dependabot proposes updates.
FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS build
WORKDIR /src
COPY package.json package-lock.json ./
# The npm cache survives between builds, so a rebuild with changed
# dependencies doesn't download every package again.
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
# Optional build settings (see the README), e.g.
# docker build --build-arg SITE_URL=https://signs.example.com .
ARG SITE_URL
ARG NOINDEX
ARG OPERATOR_DOCS
RUN npm run build

# The stock Caddy image, with the site and its Caddyfile added, running as a
# non-root user. Docker lets unprivileged processes bind port 80 inside the
# container, and the caddy binary also has the capability to.
FROM caddy:2-alpine@sha256:d8542f48d34a9cf4e4c11a478865229840e87e4c96ea3f439101f31a5d35f75f
RUN chown 65532:65532 /data /config
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /src/dist /usr/share/caddy
USER 65532:65532
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s CMD wget -q --spider http://127.0.0.1/ || exit 1

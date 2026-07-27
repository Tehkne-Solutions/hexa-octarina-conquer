FROM node:24-bookworm-slim AS web-build

ARG HEXA_RELEASE_VERSION=0.12.0
ARG HEXA_RELEASE_SHA=unknown
ARG PACK99_RELEASE_URL=https://github.com/Tehkne-Solutions/hexa-octarina-conquer/releases/download/pack99-runtime-v1.0.1/HOC_PACK_99_FINAL_RUNTIME_RECOVERED_1.0.1.zip
ARG PACK99_SHA256=f72cce299fd28c8bb8520320871d90057884bb0ec19dd449f1c3d07e56a71bbe
ENV VITE_RELEASE_VERSION=${HEXA_RELEASE_VERSION} \
    VITE_RELEASE_SHA=${HEXA_RELEASE_SHA} \
    VITE_HOC_ALLOW_PROCEDURAL_FALLBACK=0

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace
COPY scripts/install_pack99.py ./scripts/install_pack99.py
COPY client/web/package*.json ./client/web/
WORKDIR /workspace/client/web
RUN npm install --no-audit --no-fund

WORKDIR /workspace
COPY client/web/ ./client/web/
RUN test -n "${PACK99_RELEASE_URL}" \
    && test -n "${PACK99_SHA256}" \
    && curl --fail --location --retry 5 --retry-delay 5 \
      --output /tmp/hoc-pack99.zip "${PACK99_RELEASE_URL}" \
    && echo "${PACK99_SHA256}  /tmp/hoc-pack99.zip" | sha256sum -c - \
    && python3 scripts/install_pack99.py /tmp/hoc-pack99.zip \
      --repo /workspace \
      --target web \
      --profile full \
      --clean \
    && rm -f /tmp/hoc-pack99.zip

WORKDIR /workspace/client/web
RUN npm run build

FROM node:24-bookworm-slim

ARG HEXA_RELEASE_VERSION=0.12.0
ARG HEXA_RELEASE_SHA=unknown

WORKDIR /app

COPY server/package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

COPY server/src ./src
COPY --from=web-build /workspace/client/web/dist ./web

ENV NODE_ENV=production \
    PORT=8080 \
    HEXA_RELEASE_VERSION=${HEXA_RELEASE_VERSION} \
    HEXA_RELEASE_SHA=${HEXA_RELEASE_SHA} \
    HEXA_WEB_ROOT=/app/web \
    HEXA_STORE=sqlite \
    HEXA_DB_PATH=/data/hexa-octarina.sqlite \
    HEXA_IDENTITY_STORE=sqlite \
    HEXA_IDENTITY_DB_PATH=/data/hexa-identity.sqlite \
    HEXA_COMPETITION_STORE=memory \
    HEXA_CLUSTER_BUS=memory \
    HEXA_PRESENCE_STORE=memory \
    HEXA_GOVERNANCE_STORE=memory \
    HEXA_RECOVERY_PROVIDER=none \
    HEXA_RECOVERY_EXPOSE_CODE=false

RUN mkdir -p /data && chown -R node:node /app /data

USER node

EXPOSE 8080
VOLUME ["/data"]

HEALTHCHECK --interval=20s --timeout=4s --start-period=10s --retries=3 \
  CMD node -e "const p=process.env.PORT||8080;fetch('http://127.0.0.1:'+p+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "src/index.js"]

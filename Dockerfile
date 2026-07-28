FROM node:24-bookworm-slim AS web-build

ARG HEXA_RELEASE_VERSION=0.12.0
ARG HEXA_RELEASE_SHA=unknown
ARG PACK99_WEB_RUNTIME_URL=https://github.com/Tehkne-Solutions/hexa-octarina-conquer/releases/download/pack99-runtime-v1.0.2/hoc-pack99-web-full.zip
ARG PACK99_WEB_RUNTIME_SHA256_URL=https://github.com/Tehkne-Solutions/hexa-octarina-conquer/releases/download/pack99-runtime-v1.0.2/hoc-pack99-web-full.zip.sha256
ARG PACK99_WEB_RUNTIME_REQUIRED=false
ENV VITE_RELEASE_VERSION=${HEXA_RELEASE_VERSION} \
    VITE_RELEASE_SHA=${HEXA_RELEASE_SHA}

WORKDIR /web
COPY client/web/package*.json ./
RUN npm install --no-audit --no-fund
COPY client/web/ ./

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl unzip \
    && rm -rf /var/lib/apt/lists/*

RUN set -eux; \
    runtime_name="hoc-pack99-web-full.zip"; \
    checksum_name="${runtime_name}.sha256"; \
    rm -f "/tmp/${runtime_name}" "/tmp/${checksum_name}"; \
    if curl --fail --location --silent --show-error --retry 3 \
         "${PACK99_WEB_RUNTIME_URL}" -o "/tmp/${runtime_name}" \
       && curl --fail --location --silent --show-error --retry 3 \
         "${PACK99_WEB_RUNTIME_SHA256_URL}" -o "/tmp/${checksum_name}"; then \
      (cd /tmp && sha256sum --check "${checksum_name}"); \
      rm -rf /web/public/assets/runtime; \
      mkdir -p /web/public/assets/runtime; \
      unzip -oq "/tmp/${runtime_name}" -d /web/public/assets/runtime; \
      node -e 'const fs=require("node:fs"); const root="/web/public/assets/runtime"; const install=JSON.parse(fs.readFileSync(root+"/runtime-install.json","utf8")); const index=JSON.parse(fs.readFileSync(root+"/pack99/runtime-index.json","utf8")); if(install.profile!=="full"||install.assetCount!==1037||install.unresolvedReferences!==0||index.runtimeMode!=="full"||index.canonicalAssetCount!==1037||!Array.isArray(index.assets)||index.assets.length<1037){throw new Error("PACK99_FULL_RUNTIME_INVALID")}; console.log(`PACK99_PRODUCTION_RUNTIME=full canonical=${index.canonicalAssetCount} materialized=${index.assets.length}`);'; \
    else \
      if [ "${PACK99_WEB_RUNTIME_REQUIRED}" = "true" ]; then \
        echo "A Release integral do PACK 99 é obrigatória, mas não pôde ser baixada." >&2; \
        exit 2; \
      fi; \
      echo "PACK99_PRODUCTION_RUNTIME=bootstrap (Release ainda indisponível)"; \
    fi; \
    rm -f "/tmp/${runtime_name}" "/tmp/${checksum_name}"

RUN npm run build

FROM node:24-bookworm-slim

ARG HEXA_RELEASE_VERSION=0.12.0
ARG HEXA_RELEASE_SHA=unknown

WORKDIR /app

COPY server/package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

COPY server/src ./src
COPY --from=web-build /web/dist ./web

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

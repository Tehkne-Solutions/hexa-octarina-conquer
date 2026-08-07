FROM node:24-bookworm-slim AS web-build

ARG HEXA_RELEASE_VERSION=0.12.0
ARG HEXA_RELEASE_SHA=unknown
ARG PACK99_WEB_RUNTIME_URL=https://github.com/Tehkne-Solutions/hexa-octarina-conquer/releases/download/pack99-runtime-v1.0.3/hoc-pack99-web-full.zip
ARG PACK99_WEB_RUNTIME_SHA256_URL=https://github.com/Tehkne-Solutions/hexa-octarina-conquer/releases/download/pack99-runtime-v1.0.3/hoc-pack99-web-full.zip.sha256
ARG PACK99_WEB_RUNTIME_REQUIRED=true
ENV VITE_RELEASE_VERSION=${HEXA_RELEASE_VERSION} \
    VITE_RELEASE_SHA=${HEXA_RELEASE_SHA}

WORKDIR /web
COPY client/web/package*.json ./
RUN npm install --no-audit --no-fund
COPY client/web/ ./
COPY runtime/packs/PACK_99_RECOVERED/production-release.json /tmp/pack99-production-release.json

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl unzip \
    && rm -rf /var/lib/apt/lists/*

RUN set -eux; \
    runtime_name="hoc-pack99-web-full.zip"; \
    checksum_name="${runtime_name}.sha256"; \
    marker_required="$(node -e 'const marker=require("/tmp/pack99-production-release.json"); process.stdout.write(marker.required === true ? "true" : "false")')"; \
    marker_status="$(node -e 'const marker=require("/tmp/pack99-production-release.json"); process.stdout.write(String(marker.status || "unknown"))')"; \
    marker_sha="$(node -e 'const marker=require("/tmp/pack99-production-release.json"); process.stdout.write(String(marker.webArchiveSha256 || ""))')"; \
    runtime_required="${PACK99_WEB_RUNTIME_REQUIRED}"; \
    if [ "${marker_required}" = "true" ]; then runtime_required="true"; fi; \
    echo "PACK99_PRODUCTION_MARKER=${marker_status} required=${runtime_required}"; \
    rm -f "/tmp/${runtime_name}" "/tmp/${checksum_name}"; \
    curl --fail --location --silent --show-error --retry 3 "${PACK99_WEB_RUNTIME_URL}" -o "/tmp/${runtime_name}"; \
    curl --fail --location --silent --show-error --retry 3 "${PACK99_WEB_RUNTIME_SHA256_URL}" -o "/tmp/${checksum_name}"; \
    (cd /tmp && sha256sum --check "${checksum_name}"); \
    actual_sha="$(sha256sum "/tmp/${runtime_name}" | cut -d' ' -f1)"; \
    if [ -n "${marker_sha}" ] && [ "${actual_sha}" != "${marker_sha}" ]; then echo "PACK99_MARKER_SHA_MISMATCH" >&2; exit 2; fi; \
    rm -rf /web/public/assets/runtime; \
    mkdir -p /web/public/assets/runtime; \
    unzip -oq "/tmp/${runtime_name}" -d /web/public/assets/runtime; \
    node -e 'const fs=require("node:fs"); const root="/web/public/assets/runtime"; const required=["runtime-install.json","pack-manifest.json","registry/assets-runtime.json"]; for(const file of required){if(!fs.existsSync(root+"/"+file)) throw new Error("PACK99_REQUIRED_FILE_MISSING:"+file)} const install=JSON.parse(fs.readFileSync(root+"/runtime-install.json","utf8")); const manifest=JSON.parse(fs.readFileSync(root+"/pack-manifest.json","utf8")); const registry=JSON.parse(fs.readFileSync(root+"/registry/assets-runtime.json","utf8")); const assets=Array.isArray(registry.assets)?registry.assets:[]; const unresolved=Array.isArray(registry.unresolved)?registry.unresolved:[]; const requiredMission=["packages/PACK_07_HERO_ROSTER/guardian/directions/HERO_GUARDIAN_01_IDLE_BASE_SW_01.png","packages/PACK_07_HERO_ROSTER/ranger/directions/HERO_RANGER_01_IDLE_BASE_NE_01.png","packages/PACK_08_BASIC_UNITS/recruit/directions/UNIT_RECRUIT_01_IDLE_BASE_NW_01.png","packages/PACK_09_CHAMPIONS_ADVANCED/berserker/directions/CHAMP_BERSERKER_01_IDLE_BASE_NW_01.png"]; if(install.packId!=="HOC_PACK_99_FINAL_RUNTIME"||install.profile!=="full"||install.assetCount!==1037||install.unresolvedReferences!==0||registry.packId!==install.packId||registry.profile!=="full"||registry.assetCount!==1037||assets.length!==1037||unresolved.length!==0||!manifest.version){throw new Error("PACK99_FULL_RUNTIME_INVALID")}; for(const file of requiredMission){if(!fs.existsSync(root+"/"+file)) throw new Error("PACK99_REQUIRED_MISSION_FILE_MISSING:"+file)} console.log(`PACK99_PRODUCTION_RUNTIME=full canonical=${assets.length} materialized=${assets.length} mission=${requiredMission.length}`);'; \
    rm -f "/tmp/${runtime_name}" "/tmp/${checksum_name}" /tmp/pack99-production-release.json

RUN npm run build \
    && test -f /web/dist/hoc2.html \
    && cp /web/dist/hoc2.html /web/dist/index.html \
    && test -f /web/dist/assets/runtime/runtime-install.json \
    && echo "HOC2_DOCKER_ROOT=PASS source=hoc2.html target=index.html" \
    && echo "HOC2_DOCKER_PACK99=PASS"

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

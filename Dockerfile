FROM node:24-bookworm-slim

WORKDIR /app

COPY server/package.json ./package.json
RUN npm install --omit=dev && npm cache clean --force

COPY server/src ./src

ENV NODE_ENV=production \
    PORT=8080 \
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
  CMD node -e "fetch('http://127.0.0.1:8080/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "src/index.js"]

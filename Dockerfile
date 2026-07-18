FROM node:24-bookworm-slim

WORKDIR /app

COPY server/package.json ./package.json
RUN npm install --omit=dev && npm cache clean --force

COPY server/src ./src

ENV NODE_ENV=production \
    PORT=8080 \
    HEXA_STORE=sqlite \
    HEXA_DB_PATH=/data/hexa-octarina.sqlite

RUN mkdir -p /data && chown -R node:node /app /data

USER node

EXPOSE 8080
VOLUME ["/data"]

HEALTHCHECK --interval=20s --timeout=4s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "src/index.js"]

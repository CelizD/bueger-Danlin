FROM node:24-bookworm-slim AS build

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@10.34.5 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json prisma.config.ts ./
COPY apps/api apps/api
COPY apps/web/package.json apps/web/package.json
COPY packages packages
COPY database database

RUN pnpm install --frozen-lockfile

RUN DATABASE_URL="postgresql://prisma_build:prisma_build@127.0.0.1:5432/prisma_build?schema=public" pnpm db:generate \
  && pnpm --filter @burger/types build \
  && pnpm --filter @burger/api build

FROM build AS prod-deps

RUN rm -rf node_modules apps/*/node_modules packages/*/node_modules \
  && pnpm --filter @burger/api... install --prod --no-optional --frozen-lockfile --offline

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app/apps/api

RUN apt-get update \
  && apt-get install -y --no-install-recommends --only-upgrade libpcre2-8-0 \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/* \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn-v1.22.22 \
  && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg /usr/local/bin/pnpm /usr/local/bin/pnpx

COPY --from=prod-deps --chown=node:node /app/node_modules /app/node_modules
COPY --from=prod-deps --chown=node:node /app/apps/api /app/apps/api
COPY --from=prod-deps --chown=node:node /app/packages /app/packages
COPY --from=prod-deps --chown=node:node /app/database /app/database
COPY --from=prod-deps --chown=node:node /app/prisma.config.ts /app/prisma.config.ts
COPY --from=prod-deps --chown=node:node /app/package.json /app/package.json

USER node

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/v1/health/ready',{headers:{'x-forwarded-proto':'https'}}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]

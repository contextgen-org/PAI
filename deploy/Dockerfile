# syntax=docker/dockerfile:1.7
FROM node:24.18.0-bookworm-slim AS dependencies

WORKDIR /workspace
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

# Keep this layer dependent only on the lockfile and workspace manifests. A
# source-only change must not force all service images to ask the registry for
# package metadata again; the resulting layer is shared by every PAI service.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/auth/package.json packages/auth/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/eventing/package.json packages/eventing/package.json
COPY packages/object-store/package.json packages/object-store/package.json
COPY packages/persistence/package.json packages/persistence/package.json
COPY packages/service-kit/package.json packages/service-kit/package.json
COPY packages/skill-package/package.json packages/skill-package/package.json
COPY packages/system-e2e/package.json packages/system-e2e/package.json
COPY services/action-runtime/package.json services/action-runtime/package.json
COPY services/event-dispatcher/package.json services/event-dispatcher/package.json
COPY services/event-redriver/package.json services/event-redriver/package.json
COPY services/knowthat/package.json services/knowthat/package.json
COPY services/memory/package.json services/memory/package.json
COPY services/meta-cognition/package.json services/meta-cognition/package.json
COPY services/observation-gateway/package.json services/observation-gateway/package.json
COPY services/skill-registry/package.json services/skill-registry/package.json
COPY services/timer-trigger-app/package.json services/timer-trigger-app/package.json
COPY services/trigger-processor/package.json services/trigger-processor/package.json

# Docker Desktop's proxy bridge can refuse bursts of parallel package
# downloads. Keep the locked install deterministic while fetching one artifact
# at a time and reusing the BuildKit store on a cold dependency change.
RUN --mount=type=cache,id=pai-pnpm-v11,target=/pnpm/store \
  env -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY \
      -u http_proxy -u https_proxy -u all_proxy \
      sh -ec 'corepack enable \
        && corepack prepare pnpm@11.13.1 --activate \
        && pnpm config set store-dir /pnpm/store \
        && pnpm install --frozen-lockfile --prefer-offline --network-concurrency=1'

FROM dependencies AS workspace-build

COPY . .

# Compile the workspace before selecting a service image. PAI_SERVICE is
# deliberately introduced only in the next stage so BuildKit can reuse this
# expensive TypeScript layer for all ten application images.
RUN pnpm -r --if-present run build

FROM workspace-build AS build

ARG PAI_SERVICE
RUN --mount=type=cache,id=pai-pnpm-v11,target=/pnpm/store \
  --mount=type=cache,id=pai-pnpm-deploy-metadata-v11,target=/root/.cache/pnpm/v11/metadata \
  env -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY \
      -u http_proxy -u https_proxy -u all_proxy \
      sh -ec 'pnpm --prefer-offline --network-concurrency=1 --filter "${PAI_SERVICE}" deploy --legacy --prod /opt/pai-service'

FROM node:24.18.0-bookworm-slim AS runtime

WORKDIR /app
RUN install -d -o node -g node -m 0700 /var/lib/pai/runtime \
  && install -d -o node -g node -m 0700 /var/lib/pai/observation \
  && install -d -o node -g node -m 0700 /var/lib/pai/meta \
  && install -d -o node -g node -m 0700 /var/lib/pai/trigger-intent
COPY --from=build --chown=node:node /opt/pai-service/ /app/

USER node
ENV NODE_ENV=production
ENTRYPOINT ["node", "dist/main.js"]

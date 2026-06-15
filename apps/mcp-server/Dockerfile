# Construir desde la RAÍZ del repo (necesita el workspace completo):
#   docker build -f apps/mcp-server/Dockerfile .
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo
# Evita que el script "prepare" (husky) corra dentro del contenedor.
ENV HUSKY=0

# ── Stage 1: build ────────────────────────────────────────────────
FROM base AS build
# Solo manifests primero: la capa de install se cachea entre builds.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/tsconfig/package.json packages/tsconfig/
COPY apps/mcp-server/package.json apps/mcp-server/
RUN pnpm install --frozen-lockfile --filter @app/mcp-server...

COPY packages/tsconfig packages/tsconfig
COPY apps/mcp-server apps/mcp-server
RUN pnpm --filter @app/mcp-server build

# ── Stage 2: runtime ──────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production

# Reinstala solo deps de producción preservando el layout del workspace
# (los symlinks de pnpm son relativos: funcionan dentro de la imagen).
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/tsconfig/package.json packages/tsconfig/
COPY apps/mcp-server/package.json apps/mcp-server/
RUN pnpm install --prod --frozen-lockfile --ignore-scripts --filter @app/mcp-server...

COPY --from=build /repo/apps/mcp-server/dist apps/mcp-server/dist

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/health >/dev/null 2>&1 || exit 1

# Sin migraciones ni seed: el MCP server no toca la DB, solo llama al backend.
CMD ["node", "apps/mcp-server/dist/index.js"]

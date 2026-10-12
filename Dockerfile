# Proyecto UDC en una imagen (E7-6): el servidor sirve también el cliente compilado y el
# WebSocket por el mismo puerto. Ver «Despliegue» en el README.

# ---- Compilar el cliente ----
FROM node:22.23.2-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
COPY packages/bots/package.json packages/bots/
RUN pnpm install --frozen-lockfile
COPY packages ./packages
RUN pnpm --filter @udc/client build

# ---- Ejecutar: servidor (con tsx, sin paso de build) y bots para la prueba de carga ----
FROM node:22.23.2-slim
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
COPY packages/bots/package.json packages/bots/
# Solo las dependencias del servidor y de los bots: ni Babylon ni Vite.
RUN pnpm install --frozen-lockfile --filter "@udc/server..." --filter "@udc/bots..." \
  && rm -rf /root/.cache /root/.local/share/pnpm
COPY packages/shared ./packages/shared
COPY packages/server ./packages/server
COPY packages/bots ./packages/bots
COPY --from=build /app/packages/client/dist ./packages/client/dist
# COPY conserva los permisos de la carpeta de origen: en un recurso compartido del NAS pueden ser
# solo del propietario, y el usuario `node` no podría leer el código. Legible para todos (sin
# tocar node_modules, que instala pnpm con los permisos normales).
RUN find /app -path '*/node_modules' -prune -o -exec chmod a+rX {} +

ENV NODE_ENV=production \
    PORT=8080 \
    CLIENT_DIR=/app/packages/client/dist
# Sin privilegios. Sin --admin: nada de comandos de administración.
USER node
WORKDIR /app/packages/server
EXPOSE 8080
CMD ["node", "--import", "tsx", "src/index.ts"]

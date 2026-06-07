# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — build
#   Full pnpm workspace: install all deps, compile TypeScript, vendor Shoelace.
#   Base: official Node LTS slim image. linux/amd64 only (Hetzner x86).
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-slim AS builder

# Enable corepack so pnpm is available without a separate install step.
RUN corepack enable

WORKDIR /build

# Copy lockfile + workspace manifests first so dependency layer is cacheable.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/schema/package.json   packages/schema/package.json
COPY packages/runtime/package.json  packages/runtime/package.json
COPY packages/renderer/package.json packages/renderer/package.json
COPY packages/editor/package.json   packages/editor/package.json

# Install all dependencies (including devDependencies needed for the build).
RUN pnpm install --frozen-lockfile

# Copy the full source tree and run the full build pipeline
# (vendor:shoelace + TypeScript compilation for all packages).
COPY . .
RUN pnpm build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — runtime
#   Minimal Node-RED image. We copy only the built artefacts — NOT pnpm pack
#   because the files whitelist omits packages/renderer/dist which is required
#   at runtime. Instead we copy the built repo state and install only zod.
#
#   Layout inside the image mirrors the local example:start script:
#     /data/                          <- Node-RED userDir
#       flows.json                    <- seeded from examples/customers-crud/flow.json
#       settings.js                   <- demo-specific settings
#       node_modules/
#         node-red-contrib-webapp/    <- built repo tree (symlink-equivalent)
#           nodes/
#           resources/
#           packages/*/dist/
#           package.json
#           node_modules/zod/         <- only runtime dep
# ─────────────────────────────────────────────────────────────────────────────
FROM nodered/node-red:4-22

# Switch to root for installs; nodered/node-red image runs as node by default.
USER root

# Create the plugin directory inside Node-RED's userDir node_modules.
RUN mkdir -p /data/node_modules/node-red-contrib-webapp

# nodes/ and resources/ are fully needed at runtime.
COPY --from=builder /build/nodes/     /data/node_modules/node-red-contrib-webapp/nodes/
COPY --from=builder /build/resources/ /data/node_modules/node-red-contrib-webapp/resources/

# Compiled TypeScript packages (dist/ only — src is not needed at runtime).
COPY --from=builder /build/packages/schema/dist/   /data/node_modules/node-red-contrib-webapp/packages/schema/dist/
COPY --from=builder /build/packages/runtime/dist/  /data/node_modules/node-red-contrib-webapp/packages/runtime/dist/
COPY --from=builder /build/packages/renderer/dist/ /data/node_modules/node-red-contrib-webapp/packages/renderer/dist/
COPY --from=builder /build/packages/editor/dist/   /data/node_modules/node-red-contrib-webapp/packages/editor/dist/

# package.json is needed so Node-RED discovers the node-red.nodes entries.
COPY --from=builder /build/package.json /data/node_modules/node-red-contrib-webapp/package.json

# Install only the runtime dependency (zod) inside the plugin directory.
WORKDIR /data/node_modules/node-red-contrib-webapp
RUN npm install --omit=dev zod

# Seed the demo flow. Node-RED will load this on startup.
# Data is EPHEMERAL (no volume for /data) so each deploy starts with a clean state.
COPY --from=builder /build/examples/customers-crud/flow.json /data/flows.json

# Copy the demo-specific settings file.
COPY deploy/settings.js /data/settings.js

# Return ownership to the node user expected by nodered/node-red.
RUN chown -R node:node /data

USER node

# Node-RED listens on 1880 by default.
EXPOSE 1880

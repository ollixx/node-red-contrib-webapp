---
id: P65
title: "Demo-Deployment des Beispiel-Apps (Docker + GHCR + SSH/Caddy auf Hetzner, in-repo, extraktionsbereit) für Remote-Reviews"
epic: aspects/misc
status: done
dependencies: [P7]
---
# P65 — Demo-Deployment des Beispiel-Apps (Docker + GHCR + SSH/Caddy auf Hetzner, in-repo, extraktionsbereit) für Remote-Reviews

## Result

**Delivered:** Complete demo-deployment infrastructure, all under deploy/ plus one workflow file (extraction-ready): deploy/Dockerfile (multi-stage — stage 1 corepack pnpm install --frozen-lockfile && pnpm build; stage 2 nodered/node-red copies the BUILT repo tree — nodes/, resources/, packages/*/dist, package.json — into /data/node_modules/node-red-contrib-webapp, installs only zod, seeds examples/customers-crud/flow.json → /data/flows.json), deploy/settings.js (created fresh; NOT copied from owner-private .node-red-dev), deploy/docker-compose.yml (node-red ephemeral + caddy reverse_proxy with auto-TLS + Basic-Auth), deploy/Caddyfile (domain + basicauth + reverse_proxy :1880), deploy/README.md (one-time server setup, GitHub Environment 'demo' secrets table, extraction guide for publish time), .github/workflows/deploy-demo.yml (build+push GHCR then SSH docker compose pull && up -d).

**Stats:** 6 files, 406 lines (deploy/: 5 files; .github/workflows/: 1); pnpm validate green (452 unit tests).

**Notes:** Did NOT read or copy .node-red-dev/settings.js (owner-private/off-limits) — settings.js created fresh. Did NOT pnpm pack (files-whitelist omits packages/renderer/dist → would break) — copies the built repo tree + installs only zod at runtime. Workflow trigger strictly gated: workflow_dispatch + push to develop ONLY (never pull_request_target / fork PRs → secrets safe). Node-RED data intentionally ephemeral (no /data volume) so every deploy re-seeds the demo flow for a clean reviewer state. Could NOT verify end-to-end (no Docker daemon / GHCR / Hetzner server / secrets in the agent or orchestrator environment): actual image build, GHCR push and SSH deploy are deferred to when the owner provisions the server. Base images not yet digest-pinned (owner can pin at provisioning). Merging P65 locally does NOT trigger the workflow — that fires only on a push to the remote develop branch.


**Cost:** session a4dc397ded6e9b612, ~14m; orchestrator merge (no E2E needed — infra only)

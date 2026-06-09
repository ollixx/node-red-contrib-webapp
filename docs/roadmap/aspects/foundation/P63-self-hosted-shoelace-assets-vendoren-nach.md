---
id: P63
title: "Self-hosted Shoelace-Assets (vendoren nach resources/) statt CDN — strikt lokal (ADR 0008)"
epic: aspects/foundation
status: done
dependencies: [P57]
---
# P63 — Self-hosted Shoelace-Assets (vendoren nach resources/) statt CDN — strikt lokal (ADR 0008)

## Result

**Delivered:** Made the app fully offline/air-gapped capable: removed all jsdelivr/CDN references and vendored Shoelace 2.20.1 locally. @shoelace-style/shoelace pinned as an exact devDependency; scripts/vendor-shoelace.js copies node_modules/@shoelace-style/shoelace/cdn → resources/shoelace/ with a hard drift guard (fails if installed version != SHOELACE_VERSION). Vendor step hooked into `pnpm build` AND npm `prepare` so dev:start, E2E rebuild, validate and publish all have the assets; resources/shoelace/ is .gitignored (generated) and ships in the tarball (npm pack --dry-run: 2939 files). nodes/webapp.js: SHOELACE_CDN_BASE/jsdelivr removed; <head> loads themes/light.css + shoelace-autoloader.js from /resources/node-red-contrib-webapp/shoelace/ (autoloader self-detects base path → lazy chunks + sl-icon assets resolve locally) via the existing module-resource mechanism (no new route code). ADR 0002 references ADR 0008.

**Stats:** package.json, pnpm-lock.yaml, .gitignore, scripts/vendor-shoelace.js, nodes/webapp.js, ADR 0002; +P63 tests (drift guard, no-external-URL source guard, served-HTML local-path, offline+network E2E). E2E 262 passed / 0 failed; pnpm validate green; gen:example/gen:node-examples no diff.

**Notes:** Final roadmap phase. Verified authoritatively in the main checkout: after `corepack pnpm install` (new devDependency) + `corepack pnpm build`, the vendor step produced resources/shoelace/ (2938 files); the offline E2E spec (tests/e2e/p63-offline-shoelace.spec.ts) passed — theme + autoloader load from the local resource path, ZERO requests to any external Shoelace CDN, an sl-button upgrades without network, and a lazily-loaded element upgrades from local chunks. Source grep confirms no jsdelivr/SHOELACE_CDN_BASE remains in nodes/ resources/ packages/. Generated assets correctly gitignored (not committed).


**Cost:** session <see .ai/agent-runs.jsonl>; impl ~7m; orchestrator main-checkout install+build+E2E (262) + network verification; subagent_tokens ~79k

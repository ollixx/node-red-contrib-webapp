---
id: P41
title: "Per-node E2E — test infrastructure"
epic: aspects/test-infra
status: done
dependencies: [P40]
---
# P41 — Per-node E2E — test infrastructure

## Result

**Delivered:** Shared per-node E2E infrastructure: a FlowBuilder fluent flow assembler with canonical per-type defaults, admin-API helpers (deployFlow, resetFlow, injectMessage) for the live E2E Node-RED, and a WebappPage page-object (navigate, expectComponent/expectAttr, getHtml, interceptNextEvent, waitForSseSnapshot). customers-crud is tagged @integration and gated out of the default run; playwright.config.ts seeds the baseline only when E2E_RESET_ON_START != false.


**Stats:** 9 files (3 helpers, 1 smoke spec, .gitkeep, config, package.json, customers-crud spec, TESTING.md), 2 new smoke tests, 0 new nodes

**Notes:** Deviation from scope: scope suggested excluding @integration via config grep:/^(?!.*@integration)/ and running it with `--grep @integration`. That does not work in Playwright 1.58 — a CLI --grep is ANDed with config grep/grepInvert, not substituted, so any config-side @integration exclusion is uncancellable from the CLI. Implemented an E2E_INTEGRATION=1 env toggle instead (grepInvert by default, grep when set) exposed as `pnpm test:e2e:integration`. The {tag:"@integration"} object form on describe was also not grep-matchable in this version; used the title-suffix " @integration" convention. deployFlow uses POST /flows (matching existing specs), not PUT. FlowBuilder view-node mounts default to the id-keyed `<routeId>.content` form. Default E2E run: 44 pass; integration run: 12 pass; full unit suite: 207 pass.


**Cost:** session 9bad3814-4228-45bf-a0d0-ebc42ef878ca, ~13m

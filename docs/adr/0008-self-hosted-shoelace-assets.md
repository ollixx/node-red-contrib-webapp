# ADR 0008: self-hosted (vendored) Shoelace assets — strictly local, no CDN

- Status: accepted
- Date: 2026-06-06
- Builds on: [ADR 0002](0002-web-component-rendering-and-theming.md) (Shoelace is
  the default Web-Component rendering target, themed via CSS custom properties).

## Context

Shoelace is currently loaded **exclusively from a public CDN** (jsdelivr):
`nodes/webapp.js` hard-codes `SHOELACE_CDN_BASE = https://cdn.jsdelivr.net/npm/
@shoelace-style/shoelace@<ver>/cdn`, and the rendered page's `<head>` pulls the
theme stylesheet and the autoloader from there. Shoelace is not even an npm
dependency — only `zod` is.

For Node-RED's typical deployment targets this is the wrong default:

- **Air-gapped / industrial / on-prem** installs frequently have no outbound
  internet. A CDN dependency means the UI silently renders unstyled (and, with
  the autoloader, non-functional — components never upgrade).
- **Offline / intermittent** environments (edge devices, field gateways) cannot
  rely on a remote fetch at page load.
- **Privacy** — every app user's browser would hit a third-party CDN.
- **Reliability / supply chain** — a CDN outage, or a mutated/withdrawn version,
  breaks or alters every deployed app.

The codebase already self-hosts its own browser assets (`webapp-client.js`,
`webapp-serializer.js`) through Node-RED's per-module resource mechanism, served
at `/resources/node-red-contrib-webapp/lib/…` and consumed by the **public** app
page (not just the editor). That path is proven to work for app users. Shoelace
should ride the same mechanism.

The owner's decision: **strictly local, no external base path.** Self-hosting is
the only mode — no configurable CDN/proxy override.

## Decision

### 1. Vendor Shoelace's `cdn` build into `resources/shoelace/`

Add `@shoelace-style/shoelace` as a **devDependency** pinned to the existing
`SHOELACE_VERSION` (2.20.1). A build step copies the package's `cdn/` build
(the autoloader bundle with self-contained chunks — the same artifact the
jsdelivr `…/cdn` path served) into `resources/shoelace/`. It is **generated, not
hand-edited**, and `.gitignore`d; it is produced before publish so the npm
tarball ships it.

### 2. Serve via the existing module-resource mechanism

Node-RED serves a module's `resources/` directory at
`/resources/<module>/…` for both editor and public-app origins (already relied
on for `webapp-client.js`). So `resources/shoelace/shoelace-autoloader.js`
becomes `/resources/node-red-contrib-webapp/shoelace/shoelace-autoloader.js`,
and `themes/light.css` sits beside it. **No new HTTP route, no static
middleware, no `sendFile` handler** — zero runtime route code.

The Shoelace **autoloader auto-detects its base path from its own script URL**,
so lazy-loaded component chunks *and* `sl-icon` assets resolve under the same
local `resources/shoelace/` path automatically — no `setBasePath` call needed.

### 3. Remove all external references

`SHOELACE_CDN_BASE` and the jsdelivr URLs are deleted. The `<head>` references a
single local base constant. `SHOELACE_VERSION` is retained solely to (a) pin the
devDependency and (b) drive the vendor copy; the vendor script asserts the
installed package version matches `SHOELACE_VERSION` so the two cannot drift.

### 4. Wire vendoring into the lifecycle

The copy runs as part of `pnpm build` and an npm `prepare` script, so:
- local dev (`pnpm dev:start`) and E2E (`.node-red-e2e` rebuild) have the assets
  and run **fully offline**;
- `pnpm validate` produces them;
- publishing includes them in the tarball.

## Consequences

- The app renders and functions with **no outbound network** — correct default
  for air-gapped/industrial/offline Node-RED targets.
- The Shoelace version is reproducible and pinned in `package.json`; no silent
  CDN drift.
- The published npm tarball grows by the size of Shoelace's `cdn` build. Accepted
  trade-off for offline correctness (ADR 0002 already commits to Shoelace).
- E2E no longer depends on jsdelivr availability — fewer flaky external factors.
- A single source of truth for the version (`SHOELACE_VERSION` ↔ the
  devDependency), enforced by the vendor script.
- No configurable external base path: deliberately out of scope (owner decision).
  A future per-app override could revisit this if a concrete need appears.

#!/usr/bin/env node
// P274 — Publish-Build: make the runtime entry self-contained.
//
// The packaging blocker (finding A): the published package's runtime entry
// (`nodes/webapp.js`) require's `../packages/schema/dist/index.js` AND
// `../packages/renderer/dist/index.js` by relative path, and the compiled
// renderer in turn require's `@node-red-contrib-webapp/schema` by PACKAGE NAME
// (`workspace:*`). That name only resolves through pnpm workspace symlinks, so an
// installed single package throws `Cannot find module`.
//
// Fix: esbuild-bundle each `packages/*/dist/index.js` that the runtime entry
// loads into ONE self-contained CommonJS file — the internal
// `@node-red-contrib-webapp/*` requires are INLINED — with `zod` kept EXTERNAL
// (the one real runtime dependency, declared in `dependencies`). Node-RED itself
// is never bundled (it is the peer/runtime environment). `resources/` (incl. the
// vendored Shoelace, ADR 0008) stays served statically and is NOT pulled into JS.
//
// dist/ is gitignored (a build artifact), so overwriting the tsc output in place
// is safe and needs no restore — a later `pnpm build` regenerates the tsc form.
//
// Runs from the `prepack` hook (npm pack / npm publish) after `pnpm build`.

import { build } from "esbuild";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, statSync } from "node:fs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Every package/dist entry the SHIPPED runtime entry (nodes/webapp.js) require's,
// bundled self-contained. schema has no internal cross-package require but is
// bundled too so a single file ships (its siblings are inlined).
const ENTRIES = [
    "packages/schema/dist/index.js",
    "packages/renderer/dist/index.js"
];

async function bundleEntry(rel) {
    const abs = resolve(REPO_ROOT, rel);
    if (!existsSync(abs)) {
        throw new Error(`missing build output ${rel} — run \`pnpm build\` first`);
    }
    await build({
        entryPoints: [abs],
        outfile: abs, // overwrite in place (dist/ is gitignored)
        allowOverwrite: true,
        bundle: true,
        platform: "node",
        format: "cjs",
        target: "node18",
        // zod is the ONE external runtime dependency (declared in `dependencies`).
        // Everything internal (@node-red-contrib-webapp/* + relative siblings) is
        // inlined. Node built-ins stay external automatically on platform:node.
        external: ["zod"],
        logLevel: "warning"
    });
    const kb = (statSync(abs).size / 1024).toFixed(1);
    console.error(`build-publish: bundled ${rel} → ${kb} KB (self-contained, zod external)`);
}

async function main() {
    for (const entry of ENTRIES) {
        await bundleEntry(entry);
    }
    console.error("build-publish: done — runtime entry loads with no workspace-package deps.");
}

main().catch((e) => {
    console.error(`build-publish: FAILED — ${e.message || e}`);
    process.exit(1);
});

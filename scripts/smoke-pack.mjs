#!/usr/bin/env node
// P274 — Install-Smoke-Test (acceptance point 2).
//
// The HARD proof that the published tarball is self-contained. This script:
//   1. `npm pack`s the repo into a tarball.
//   2. Installs that tarball — together with node-red — into a FRESH temp dir
//      OUTSIDE the workspace (real npm install, no pnpm workspace symlinks).
//   3. Boots a minimal Node-RED on a free port (never 1880/1881/1882/1883) with
//      a minimal ui-app + ui-route + ui-text flow deployed.
//   4. Fetches the app URL and asserts the rendered HTML contains the marker text
//      (measured render, in the spirit of examples/customers-crud).
//   5. Cleans up: kills Node-RED and removes every temp dir.
//
// This catches exactly the "green in the monorepo, broken once installed" class:
// on today's un-bundled code it FAILS (the runtime entry requires
// packages/renderer/dist by relative path and that dist requires
// `@node-red-contrib-webapp/schema` by package name — neither resolves in an
// installed single package). After the publish-bundle it PASSES.
//
// Usage:  node scripts/smoke-pack.mjs   (or: pnpm smoke:pack)

import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MARKER = "SMOKE_MARKER_P274_RENDERED";
const APP_ID = "smokeApp";
const FORBIDDEN_PORTS = new Set([1880, 1881, 1882, 1883]);

function log(msg) {
    console.log(`[smoke-pack] ${msg}`);
}

function fail(msg) {
    console.error(`[smoke-pack] FAIL: ${msg}`);
    process.exitCode = 1;
}

// A free ephemeral port, never one of the reserved Node-RED ports.
function freePort() {
    return new Promise((res, rej) => {
        const srv = createServer();
        srv.on("error", rej);
        srv.listen(0, "127.0.0.1", () => {
            const { port } = srv.address();
            srv.close(() => {
                if (FORBIDDEN_PORTS.has(port)) { res(freePort()); }
                else { res(port); }
            });
        });
    });
}

function run(cmd, args, opts = {}) {
    const r = spawnSync(cmd, args, { stdio: "inherit", ...opts });
    if (r.status !== 0) {
        throw new Error(`${cmd} ${args.join(" ")} exited ${r.status}`);
    }
    return r;
}

async function waitFor(fn, { timeoutMs = 60000, intervalMs = 500 } = {}) {
    const start = Date.now();
    for (;;) {
        try {
            const v = await fn();
            if (v) { return v; }
        } catch { /* keep polling */ }
        if (Date.now() - start > timeoutMs) { return null; }
        await new Promise((r) => setTimeout(r, intervalMs));
    }
}

// Minimal, self-contained flow: an app + a root route + one static ui-text whose
// content is the marker. Mirrors examples/guide/ui-text.json shape.
function flowFixture() {
    return [
        { id: "smokeTab", type: "tab", label: "Smoke", disabled: false, info: "" },
        {
            id: APP_ID, type: "ui-app", name: "Smoke app", uiId: APP_ID,
            root: APP_ID, layout: "app", z: "smokeTab", x: 120, y: 80, wires: [[]]
        },
        {
            id: "smokeHeading", type: "ui-text", name: "Heading", uiId: "smokeHeading",
            app: APP_ID, mount: `${APP_ID}.content`, text: MARKER,
            value: { kind: "literal", value: MARKER },
            style: "heading-1", variant: "primary", display: "text", order: "1",
            z: "smokeTab", x: 360, y: 80, wires: [[]]
        }
    ];
}

const SETTINGS_JS = `module.exports = {
    flowFile: "flows.json",
    userDir: __dirname,
    uiPort: process.env.PORT || 1880,
    logging: { console: { level: "warn", metrics: false, audit: false } },
    editorTheme: { tours: false },
    functionGlobalContext: {}
};
`;

async function main() {
    let tmpRoot;
    let nodeRed;
    let cleanedUp = false;

    const cleanup = () => {
        if (cleanedUp) { return; }
        cleanedUp = true;
        if (nodeRed && !nodeRed.killed) {
            try { process.kill(-nodeRed.pid, "SIGKILL"); } catch { /* noop */ }
            try { nodeRed.kill("SIGKILL"); } catch { /* noop */ }
        }
        if (tmpRoot) {
            try { rmSync(tmpRoot, { recursive: true, force: true }); } catch { /* noop */ }
        }
    };
    process.on("exit", cleanup);
    process.on("SIGINT", () => { cleanup(); process.exit(130); });
    process.on("SIGTERM", () => { cleanup(); process.exit(143); });

    try {
        tmpRoot = mkdtempSync(join(tmpdir(), "nrcw-smoke-"));
        const project = join(tmpRoot, "project");
        const userDir = join(tmpRoot, "userDir");
        const packDir = join(tmpRoot, "pack");
        mkdirSync(project, { recursive: true });
        mkdirSync(userDir, { recursive: true });
        mkdirSync(packDir, { recursive: true });

        // 1. Pack the repo. --json keeps stdout parseable; a polluting prepare
        //    hook would break this parse (that is itself part of the acceptance).
        log("npm pack …");
        const packed = spawnSync("npm", ["pack", "--json", "--pack-destination", packDir], {
            cwd: REPO_ROOT, encoding: "utf8"
        });
        if (packed.status !== 0) {
            throw new Error(`npm pack failed: ${packed.stderr}`);
        }
        let tarball;
        try {
            tarball = join(packDir, JSON.parse(packed.stdout)[0].filename);
        } catch (e) {
            throw new Error(`npm pack --json stdout not parseable (hook pollution?):\n${packed.stdout}\n${e}`);
        }
        log(`packed → ${tarball}`);

        // 2. Fresh install into a workspace-foreign dir (no pnpm symlinks).
        writeFileSync(join(project, "package.json"), JSON.stringify({
            name: "nrcw-smoke-host", version: "1.0.0", private: true,
            dependencies: { "node-red": "^4.0.0", "node-red-contrib-webapp": `file:${tarball}` }
        }, null, 2));
        log("npm install (node-red + packed tarball) …");
        run("npm", ["install", "--no-audit", "--no-fund", "--loglevel=error"], { cwd: project });

        // 3. Boot minimal Node-RED with the flow deployed at startup.
        writeFileSync(join(userDir, "flows.json"), JSON.stringify(flowFixture(), null, 2));
        writeFileSync(join(userDir, "settings.js"), SETTINGS_JS);
        const port = await freePort();
        const redJs = join(project, "node_modules", "node-red", "red.js");
        log(`starting Node-RED on port ${port} …`);
        nodeRed = spawn(process.execPath, [redJs, "--userDir", userDir, "--port", String(port)], {
            cwd: project,
            env: { ...process.env, PORT: String(port) },
            stdio: ["ignore", "pipe", "pipe"],
            detached: true
        });
        let redLog = "";
        nodeRed.stdout.on("data", (d) => { redLog += d; });
        nodeRed.stderr.on("data", (d) => { redLog += d; });

        // 4. Poll the app URL for the rendered marker.
        const url = `http://127.0.0.1:${port}/webapp/${APP_ID}`;
        log(`polling ${url} …`);
        const html = await waitFor(async () => {
            if (nodeRed.exitCode !== null) {
                throw new Error(`Node-RED exited early (code ${nodeRed.exitCode})`);
            }
            const resp = await fetch(url);
            if (!resp.ok) { return null; }
            const body = await resp.text();
            return body.includes(MARKER) ? body : null;
        }, { timeoutMs: 90000, intervalMs: 750 });

        if (!html) {
            console.error("\n----- Node-RED output -----\n" + redLog + "\n---------------------------\n");
            throw new Error(`marker "${MARKER}" not found in rendered app at ${url}`);
        }
        log(`PASS: marker rendered by the installed package (${html.length} bytes of HTML).`);
    } finally {
        cleanup();
    }
}

main().catch((e) => {
    fail(e.message || String(e));
    process.exit(1);
});

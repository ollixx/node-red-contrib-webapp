import { defineConfig } from "@playwright/test";

// P41: per-node E2E specs build isolated flows and reset between tests, so the
// E2E Node-RED no longer needs the customers-crud flow as a fixed startup flow.
// Set E2E_RESET_ON_START=false to start empty; default true seeds the known-good
// customers-crud flow so the @integration smoke suite has its baseline available.
const seedBaseline = process.env.E2E_RESET_ON_START !== "false";
const seedStep = seedBaseline
    ? "cp examples/customers-crud/flow.json .node-red-e2e/flows.json && "
    : "";

// P186: SHOWCASE=1 enables video + trace + HTML report for on-demand review runs.
// Normal runs (CI, pnpm exec playwright test) stay video-free for speed.
const isShowcase = process.env.SHOWCASE === "1";

export default defineConfig({
    testDir: "./tests/e2e",
    fullyParallel: false,
    workers: 1,
    // HTML reporter is used in showcase mode; default list reporter otherwise.
    reporter: isShowcase ? [["html", { open: "never" }]] : [["list"]],
    // @integration-tagged specs (the customers-crud smoke + fixture guards) are
    // excluded from the default run and gated behind E2E_INTEGRATION=1 instead.
    // NOTE: a CLI `--grep` does NOT replace config grep/grepInvert — they AND
    // together — so a config-side exclusion can never be overridden from the CLI.
    // The env flag is therefore the override mechanism (see pnpm test:e2e:integration).
    // Default: exclude @integration. With E2E_INTEGRATION=1: run ONLY @integration.
    ...(process.env.E2E_INTEGRATION === "1"
        ? { grep: /@integration/ }
        : { grepInvert: /@integration/ }),
    use: {
        baseURL: "http://127.0.0.1:1882",
        // Showcase mode: record video + trace for every test so the HTML report
        // embeds reviewable footage and a clickable step-by-step DOM trace.
        // Default mode: no video/trace (fast, disk-friendly, safe for CI).
        ...(isShowcase
            ? { video: "on", trace: "on" }
            : {})
    },
    webServer: {
        // The E2E userDir uses a committed, owner-private-free settings file
        // (tests/e2e/settings.js) — NOT .node-red-dev/settings.js — so the suite
        // starts in a git worktree and in CI, not just the owner's main checkout.
        command: `rm -rf .node-red-e2e && mkdir -p .node-red-e2e/node_modules && cp tests/e2e/settings.js .node-red-e2e/settings.js && ${seedStep}ln -sfn ../.. .node-red-e2e/node_modules/node-red-contrib-webapp && node-red --userDir .node-red-e2e --port 1882 >/tmp/node-red-webapp-playwright.log 2>&1`,
        url: "http://127.0.0.1:1882",
        reuseExistingServer: false,
        timeout: 120000
    },
    projects: [
        {
            name: "chromium",
            use: {
                browserName: "chromium"
            }
        }
    ]
});

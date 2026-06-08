/**
 * E2E Node-RED settings — committed, in-repo, owner-private-free.
 *
 * The Playwright webServer rebuilds the ephemeral .node-red-e2e userDir before
 * every run and copies THIS file into it as settings.js. It used to copy the
 * owner-private, gitignored .node-red-dev/settings.js, which made the E2E suite
 * impossible to start in a git worktree or in CI (those have no .node-red-dev/).
 *
 * DO NOT copy .node-red-dev/settings.js here — that file is owner-private and
 * may contain credentials or personal paths (same rule as deploy/settings.js).
 *
 * These are plain Node-RED defaults tuned for headless test runs: no auth, no
 * onboarding tour, quiet logging. The listening port is supplied by the
 * webServer command via `--port 1882` (which overrides uiPort).
 */

module.exports = {
    // ── Flow file / port ───────────────────────────────────────────────────
    flowFile: "flows.json",
    uiPort: process.env.PORT || 1882,
    // Bind to loopback only — the E2E server is local to the test run.
    uiHost: "127.0.0.1",

    // ── Security ───────────────────────────────────────────────────────────
    // No editor/admin auth: the suite drives the editor and admin API directly.
    adminAuth: null,

    // ── Runtime ────────────────────────────────────────────────────────────
    // Function nodes in the customers-crud example may require npm modules.
    functionExternalModules: true,
    functionTimeout: 0,
    functionGlobalContext: {},

    // ── Logging ────────────────────────────────────────────────────────────
    // Quiet by default; the webServer redirects this to a /tmp log file.
    logging: {
        console: {
            level: "warn",
            metrics: false,
            audit: false,
        },
    },

    // ── Editor ─────────────────────────────────────────────────────────────
    editorTheme: {
        palette: {},
        // No first-run tour: it overlays the editor and breaks E2E selectors.
        tours: false,
        projects: {
            enabled: false,
        },
    },

    // ── Diagnostics ────────────────────────────────────────────────────────
    diagnostics: {
        enabled: true,
        ui: true,
    },
};

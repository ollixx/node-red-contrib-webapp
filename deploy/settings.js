/**
 * demo/deploy Node-RED settings
 *
 * Minimal, demo-safe settings for the Customers CRUD demo running inside
 * Docker on Hetzner. Caddy handles TLS and Basic-Auth in front of this
 * instance, so Node-RED itself runs plain HTTP on port 1880 (container-local
 * only — never exposed directly).
 *
 * DO NOT copy .node-red-dev/settings.js here — that file is owner-private
 * and may contain credentials or personal paths.
 */

module.exports = {
    // ── HTTP / port ────────────────────────────────────────────────────────
    // Node-RED listens inside the container; Caddy proxies from outside.
    uiPort: process.env.PORT || 1880,

    // ── Flow file ──────────────────────────────────────────────────────────
    // The Dockerfile seeds /data/flows.json with the customers-crud demo.
    flowFile: "flows.json",

    // ── Credential secret ──────────────────────────────────────────────────
    // Passed in via Docker environment / GitHub Secret.
    // If not set, Node-RED generates one — acceptable for a stateless demo.
    credentialSecret: process.env.NODE_RED_CREDENTIAL_SECRET || false,

    // ── Editor ─────────────────────────────────────────────────────────────
    // The editor is reachable at /  (protected by Caddy Basic-Auth).
    // Disable the built-in user management; authentication is handled
    // externally by Caddy.
    adminAuth: null,

    // ── Logging ────────────────────────────────────────────────────────────
    logging: {
        console: {
            level: "info",
            metric: false,
            audit: false,
        },
    },

    // ── Editor theme ───────────────────────────────────────────────────────
    editorTheme: {
        // No palette restrictions — all nodes visible.
        palette: {},
        projects: {
            // Projects UI is off for this simple demo instance.
            enabled: false,
        },
    },

    // ── Diagnostics ────────────────────────────────────────────────────────
    // Allow the diagnostics endpoint (harmless for a private demo behind auth).
    diagnostics: {
        enabled: true,
        ui: true,
    },
};

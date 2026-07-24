#!/usr/bin/env node
/*
 * User-guide coverage tripwire (P265, ADR 0042). WRITES NOTHING. Exits non-zero
 * when a registered `ui-*` node lacks its user-guide coverage. Read-only: it
 * enumerates nodes from package.json `node-red.nodes` (exactly as check-help.js /
 * check-fields.js) and enforces the ADR-0042 per-node user-docs contract:
 *
 * RULES (each violation names the node):
 *
 *   (1) EN GUIDE DOC. `docs/guide/nodes/<node>.md` exists.
 *
 *   (2) DE GUIDE DOC. `docs/guide/de/nodes/<node>.md` exists (German is a
 *       translation in the same package — never EN without DE, the drift rule).
 *
 *   (3) EXAMPLE LINKED (EN). The EN doc references >= 1 `examples/**.json`
 *       flow file that resolves on disk (the importable example; the E2E smoke
 *       harness tests/e2e/guide-examples-smoke.spec.ts proves every
 *       `examples/guide/**.json` deploys + renders).
 *
 *   (4) EXAMPLE LINKED (DE). Same for the DE doc (mirror completeness).
 *
 * ALLOWLIST — the SHRINKING rest-list (the proven check-fields idiom): seeded
 * P265 with every registered node EXCEPT the pilot ui-divider; the five node
 * batches P267–P271 drive it to EMPTY. An entry `{ "<node>": "reason" }`
 * suppresses ALL rules for that node. A NEW node must NOT be added here —
 * it ships with its guide docs.
 *
 * Run via `pnpm check:guide`; part of `pnpm validate`.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PKG = require(path.join(ROOT, "package.json"));

/* ------------------------------------------------------------------ *
 * Allowlist — seeded P265: all nodes except the pilot. The batches
 * P267–P271 delete one entry per migrated node. Target: EMPTY.
 * ------------------------------------------------------------------ */
const ALLOWLIST = {};
for (const t of [

    
    "ui-tab", "ui-accordion", "ui-accordion-section",
    "ui-pagination", "ui-stepper",
    // ui-divider: PILOT (P265) — has full guide coverage; intentionally absent.
    // P267: the backbone batch (app, route, dialog, component pair, store family,
    // query family, action) is now fully migrated — no entries remain here.
]) {
    ALLOWLIST[t] = "guide docs pending (batches P267-P271)";
}

// Repo-relative example references inside a guide doc, e.g.
// `examples/guide/ui-divider.json` (plain text or link target).
const EXAMPLE_REF_RE = /examples\/[A-Za-z0-9/_.-]*\.json/g;

/* ------------------------------------------------------------------ *
 * Node enumeration (mirrors check-help.js)
 * ------------------------------------------------------------------ */
function registeredTypes() {
    const reg = (PKG["node-red"] && PKG["node-red"].nodes) || {};
    return Object.keys(reg).filter((t) => t.startsWith("ui-")).sort();
}

/* ------------------------------------------------------------------ *
 * Rule evaluation (pure — the unit-testable seam)
 * ------------------------------------------------------------------ *
 * guideViolation({ type, enDoc, deDoc }, opts): first { rule, message } or null.
 *   enDoc/deDoc: the doc file CONTENT, or null when the file is missing.
 *   opts.exampleExists(relPath) -> whether a repo-relative example resolves.
 */
function guideViolation(node, opts) {
    const exampleExists =
        (opts && opts.exampleExists) || ((rel) => fs.existsSync(path.join(ROOT, rel)));
    const { type, enDoc, deDoc } = node;

    if (enDoc == null) {
        return {
            rule: "no-en-doc",
            message: `has no user-guide doc — add \`docs/guide/nodes/${type}.md\` (template: docs/guide/_templates/node-reference.md).`,
        };
    }
    if (deDoc == null) {
        return {
            rule: "no-de-doc",
            message: `has no GERMAN guide doc — add \`docs/guide/de/nodes/${type}.md\` (never EN without DE — the drift rule).`,
        };
    }
    for (const [ruleLang, content] of [["en", enDoc], ["de", deDoc]]) {
        const refs = content.match(EXAMPLE_REF_RE) || [];
        const resolved = refs.filter((rel) => exampleExists(rel));
        if (resolved.length === 0) {
            return {
                rule: `no-example-${ruleLang}`,
                message:
                    `${ruleLang === "en" ? "EN" : "DE"} guide doc references no resolvable importable example — ` +
                    `link >= 1 \`examples/guide/${type}*.json\` (with import instructions).`,
            };
        }
    }
    return null;
}

/* ------------------------------------------------------------------ *
 * Core analysis (pure — operates on an in-memory node list)
 * ------------------------------------------------------------------ */
function analyzeNodes(nodes, allowlist, opts) {
    const errors = [];
    let checked = 0;
    let allowlisted = 0;
    for (const n of nodes) {
        checked++;
        if (allowlist && allowlist[n.type]) {
            allowlisted++;
            continue;
        }
        const v = guideViolation(n, opts);
        if (v) {
            errors.push(
                `${n.type}: ${v.message} ` +
                    `Fix: add the doc/example (see docs/guide/README.md), or allowlist it in ` +
                    `scripts/check-guide.js with a one-line reason.`
            );
        }
    }
    return { errors, checked, allowlisted };
}

/* ------------------------------------------------------------------ *
 * Run against the real tree
 * ------------------------------------------------------------------ */
function buildNodes() {
    return registeredTypes().map((type) => {
        const enPath = path.join(ROOT, "docs", "guide", "nodes", `${type}.md`);
        const dePath = path.join(ROOT, "docs", "guide", "de", "nodes", `${type}.md`);
        return {
            type,
            enDoc: fs.existsSync(enPath) ? fs.readFileSync(enPath, "utf8") : null,
            deDoc: fs.existsSync(dePath) ? fs.readFileSync(dePath, "utf8") : null,
        };
    });
}

function checkGuide() {
    return analyzeNodes(buildNodes(), ALLOWLIST);
}

function main() {
    const { errors, checked, allowlisted } = checkGuide();
    if (errors.length) {
        console.error("User-guide coverage check FAILED:\n");
        for (const e of errors) console.error("  - " + e);
        console.error(
            `\n${errors.length} guide violation(s) across ${checked} node(s) checked; ` +
                `${allowlisted} node(s) allowlisted.`
        );
        process.exit(1);
    }
    console.log(
        `User-guide coverage OK: ${checked} ui-* node(s) checked — ` +
            `${checked - allowlisted} with EN+DE guide doc + resolvable example; ` +
            `${allowlisted} on the shrinking allowlist (P267-P271 drive it to 0).`
    );
}

if (require.main === module) main();

module.exports = {
    checkGuide,
    analyzeNodes,
    guideViolation,
    registeredTypes,
    ALLOWLIST,
};

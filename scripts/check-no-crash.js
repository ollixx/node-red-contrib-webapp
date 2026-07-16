#!/usr/bin/env node
/*
 * "renders without crashing" / presence-only test tripwire (P233). WRITES
 * NOTHING. Exits non-zero when any E2E spec still contains a forbidden
 * no-crash / DOM-presence-only marker in a test title or comment.
 *
 * Rationale: `.ai/agents/node-testing.md` forbids "renders without crashing" /
 * DOM-presence-only tests outright — a test must assert an OBSERVABLE OUTCOME
 * (rendered attribute / DOM structure / emitted message / store value) and turn
 * RED when the feature is removed. A 2026-07-14 audit sweep found ~12 nodes with
 * such tests (P233 replaced them). This tripwire makes the ban machine-checked
 * so the anti-pattern cannot creep back in a NEW spec.
 *
 * WHAT IT SCANS: every `*.spec.ts` file under `tests/e2e/` (recursive) — the
 * specs. It does NOT scan `.tests.md` catalogues, this script, or its own unit
 * test.
 *
 * FORBIDDEN MARKERS (case-insensitive), matched anywhere in a spec line:
 *   (1) `without crashing`
 *   (2) `renders without` / `render without`
 * Each hit names the file + line + the offending text.
 *
 * ALLOWLIST — curated, one-line reason each (mirrors check-help.js /
 * check-fields.js). An entry `{ "<repo-rel-spec-path>": "reason" }` suppresses
 * ALL hits for that spec. It lands EMPTY and must stay empty — every entry
 * WEAKENS the check.
 *
 * Run via `pnpm check:no-crash`; part of `pnpm validate`; unit-tested by
 * scripts/check-no-crash.test.ts.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SPEC_DIR = path.join(ROOT, "tests", "e2e");

/* ------------------------------------------------------------------ *
 * Allowlist — curated exceptions (EMPTY on landing). Format:
 * { "<repo-relative-spec-path>": "one-line reason" }.
 * ------------------------------------------------------------------ */
const ALLOWLIST = {};

/* ------------------------------------------------------------------ *
 * Forbidden markers. Each entry: { id, re }. `re` is applied per line.
 * ------------------------------------------------------------------ */
const MARKERS = [
    { id: "without-crashing", re: /without\s+crashing/i },
    { id: "renders-without", re: /renders?\s+without/i },
];

/* ------------------------------------------------------------------ *
 * Pure core (the unit-testable seam)
 * ------------------------------------------------------------------ *
 * findForbiddenMarkers(source): [{ line, marker, text }] over one file's text.
 */
function findForbiddenMarkers(source) {
    const hits = [];
    const lines = String(source).split(/\r?\n/);
    lines.forEach((text, i) => {
        for (const m of MARKERS) {
            if (m.re.test(text)) {
                hits.push({ line: i + 1, marker: m.id, text: text.trim() });
            }
        }
    });
    return hits;
}

/* ------------------------------------------------------------------ *
 * analyzeSpecs(specs, allowlist): pure over an in-memory spec list.
 *   specs: [{ path: <repo-rel>, source: string }]
 * ------------------------------------------------------------------ */
function analyzeSpecs(specs, allowlist) {
    const errors = [];
    let checked = 0;
    let allowlisted = 0;

    for (const spec of specs) {
        checked++;
        if (allowlist && allowlist[spec.path]) {
            allowlisted++;
            continue;
        }
        for (const hit of findForbiddenMarkers(spec.source)) {
            errors.push(
                `${spec.path}:${hit.line}: forbidden "${hit.marker}" marker — ` +
                    `"${hit.text}". Replace it with a real outcome assertion (rendered ` +
                    `attribute / DOM structure / emitted message / store value) that goes ` +
                    `RED when the feature is removed (see .ai/agents/node-testing.md), or ` +
                    `allowlist the spec in scripts/check-no-crash.js with a one-line reason.`
            );
        }
    }
    return { errors, checked, allowlisted };
}

/* ------------------------------------------------------------------ *
 * Enumerate spec files under tests/e2e (recursive).
 * ------------------------------------------------------------------ */
function specFiles(dir) {
    const out = [];
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            out.push(...specFiles(full));
        } else if (entry.isFile() && entry.name.endsWith(".spec.ts")) {
            out.push(full);
        }
    }
    return out;
}

function buildSpecs() {
    return specFiles(SPEC_DIR)
        .sort()
        .map((full) => ({
            path: path.relative(ROOT, full),
            source: fs.readFileSync(full, "utf8"),
        }));
}

function checkNoCrash() {
    return analyzeSpecs(buildSpecs(), ALLOWLIST);
}

function main() {
    const { errors, checked, allowlisted } = checkNoCrash();
    if (errors.length) {
        console.error('"renders without crashing" / presence-only check FAILED:\n');
        for (const e of errors) console.error("  - " + e);
        console.error(
            `\n${errors.length} forbidden marker(s) across ${checked} spec(s) checked; ` +
                `${allowlisted} spec(s) allowlisted.`
        );
        process.exit(1);
    }
    console.log(
        `no-crash check OK: ${checked} spec(s) scanned, no "without crashing" / ` +
            `"renders without" markers; ${allowlisted} allowlisted.`
    );
}

if (require.main === module) main();

module.exports = {
    checkNoCrash,
    analyzeSpecs,
    findForbiddenMarkers,
    specFiles,
    MARKERS,
    ALLOWLIST,
};

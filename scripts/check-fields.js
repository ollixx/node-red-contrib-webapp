#!/usr/bin/env node
/*
 * Cross-node field-consistency tripwire (P227). WRITES NOTHING. Exits non-zero on
 * a field-model drift. Read-only: it parses the `defaults` blocks of every `ui-*`
 * node `.html` (comment-robustly, exactly as check-specs.js / check-roundtrip.js
 * enumerate them) and enforces the ADR-0038 field-model contract ACROSS nodes.
 *
 * Rationale: ADR 0038 — a cross-node audit (45 nodes × 128 fields) found the field
 * model internally inconsistent in ways nothing checked: `check:specs` enforces
 * defaults↔spec PER NODE, never cross-node coherence. This tripwire makes the
 * ADR-0038 target explicit and STOPS NEW DRIFT before the renames (P228) and the
 * legacy sweep (P229) land. It documents the target; it renames/removes NOTHING.
 *
 * The convention it enforces is documented for humans in
 * docs/nodes/concepts/field-conventions.md (linked from concepts/editor.md).
 *
 * RULES (each violation names the node + field):
 *
 *   (a) CARRIER-TWIN CONSISTENCY. There is exactly ONE binding-carrier pattern —
 *       `<base>` (the binding object) + `<base>Binding` (the editor typedInput
 *       carrier). The legacy `<base>Path` twin is retired. So: if a node's defaults
 *       carry `<base>Binding`, they must NOT also carry `<base>Path`. (The offender
 *       reported is the residual `<base>Path`.)
 *
 *   (b) NO REMOVED-LEGACY FIELD. A field that ADR 0038 marks removed must not (re)
 *       appear in defaults:
 *         - any `*Json` raw-JSON authoring carrier (`optionsJson`/`itemsJson`);
 *         - the dead input write-target pair `storeId` and its partner `path`
 *           (`path` is dead ONLY when it rides with `storeId` — the ADR-0027 input
 *           pair; `path` alone on ui-store-read/-action is the LIVE store subpath,
 *           and `ui-route.path` is the URL path, so neither is flagged);
 *         - the pagination aliases `page` / `currentPagePath`.
 *
 *   (c) BARE-NAME REFERENCE FIELDS. A field that references another node carries the
 *       BARE concept name (the value IS the id), matching `store`/`mount`/`app`:
 *       `layout` not `layoutId`, `route` not `routeId`, `definition` not
 *       `definitionId`. Any `*Id` field is a violation EXCEPT the keep-list —
 *       `uiId` (a node's OWN stable id, not a reference) and `selectedId` (a
 *       *selected value*, not a node reference). `storeId` is a rule-(b) removed
 *       legacy, so rule (c) leaves it to (b) to avoid a double message.
 *       P228 guardrail: `parent` — the pre-rename owning-app field — is also a
 *       rule-(c) violation. The rename wave is FROZEN: no node may reintroduce a
 *       `parent` reference default (the runtime/editor migration READERS remain).
 *
 * ALLOWLIST — a curated allowlist carries TODAY's real violations (the ones P228
 * renames / P229 sweeps) so `pnpm validate` stays GREEN on landing. Format:
 * { "<node>": { "<field>": "one-line reason" } }. An entry suppresses EVERY rule
 * for that (node, field). Every entry WEAKENS the check — keep it shrinking: P228
 * (renames) and P229 (legacy sweep) drive it to EMPTY. A NEW entry is only ever
 * justified by an ADR reason, never "not migrated yet" for a field ADR 0038 did
 * not already list.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PKG = require(path.join(ROOT, "package.json"));

/* ------------------------------------------------------------------ *
 * Allowlist — TODAY's ADR-0038 violations, one-line reason each.
 * Seeded 2026-07-14 by running this checker over the real nodes/** tree.
 * P228 (parent→app, id-suffix renames) + P229 (legacy `*Path`/`*Json`/dead
 * `storeId`/`path`/pagination-alias sweep) drive this to {}.
 * ------------------------------------------------------------------ */
const ALLOWLIST = {
    // EMPTY since P259 — the ADR-0038 field model is fully enforced (P228:
    // parent→app; P229: legacy sweep; P259: layoutId→layout, routeId→route,
    // definitionId→definition). Rule (c) stays sharp with no exceptions: any
    // future `*Id` reference default (or `parent`) is flagged immediately. A
    // NEW entry is only ever justified by an ADR reason.
};

/* ------------------------------------------------------------------ *
 * Rule config (ADR 0038)
 * ------------------------------------------------------------------ */

// `*Id` fields that are NOT node references (rule c keep-list). `storeId` is a
// rule-(b) removed legacy, so it is excluded here (rule b owns its message).
const ID_KEEP = new Set(["uiId", "selectedId"]);

// Named removed-legacy fields (rule b) that are not otherwise pattern-detected.
const REMOVED_LEGACY_FIELDS = new Set(["page", "currentPagePath"]);

/* ------------------------------------------------------------------ *
 * Node -> html mapping + defaults extraction (mirrors check-specs.js)
 * ------------------------------------------------------------------ */

function nodeHtmlPaths() {
    const reg = (PKG["node-red"] && PKG["node-red"].nodes) || {};
    const out = {};
    for (const [type, jsRel] of Object.entries(reg)) {
        if (!type.startsWith("ui-")) continue;
        out[type] = path.join(ROOT, jsRel.replace(/\.js$/, ".html"));
    }
    return out;
}

function stripComments(s) {
    return s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

function extractDefaultsKeys(src) {
    const clean = stripComments(src);
    const i = clean.indexOf("defaults:");
    if (i < 0) return [];
    let j = clean.indexOf("{", i);
    if (j < 0) return [];
    let depth = 0;
    let end = -1;
    for (let k = j; k < clean.length; k++) {
        const c = clean[k];
        if (c === "{") depth++;
        else if (c === "}") {
            depth--;
            if (depth === 0) {
                end = k;
                break;
            }
        }
    }
    if (end < 0) return [];
    const block = clean.slice(j + 1, end);
    let flat = "";
    let d = 0;
    for (const c of block) {
        if (c === "{" || c === "[") d++;
        if (d === 0) flat += c;
        if (c === "}" || c === "]") d--;
    }
    const keys = [];
    const re = /(?:^|,)\s*([A-Za-z_$][\w$]*)\s*:/g;
    let m;
    while ((m = re.exec(flat))) keys.push(m[1]);
    return keys;
}

/* ------------------------------------------------------------------ *
 * Rule evaluation (pure — the unit-testable seam)
 * ------------------------------------------------------------------ *
 * fieldViolations(defaults): [{ field, rule, message }] for ONE node's
 * defaults key list. Rules are independent; a field can trip more than one.
 */
function fieldViolations(defaults) {
    const set = new Set(defaults);
    const out = [];

    // (a) carrier-twin consistency: `<base>Binding` present ⇒ no `<base>Path`.
    for (const field of defaults) {
        if (!field.endsWith("Binding")) continue;
        const base = field.slice(0, -"Binding".length);
        if (!base) continue;
        const twin = `${base}Path`;
        if (set.has(twin)) {
            out.push({
                field: twin,
                rule: "carrier-twin",
                message: `carries both \`${field}\` and the retired \`${twin}\` twin — remove the \`<base>Path\` default (ADR 0038: one carrier pattern, \`<base>\` + \`<base>Binding\`).`,
            });
        }
    }

    // (b) no removed-legacy field.
    for (const field of defaults) {
        if (field.endsWith("Json")) {
            out.push({
                field,
                rule: "removed-legacy",
                message: `\`${field}\` is a removed legacy raw-JSON carrier (ADR 0038) — bind via \`<base>Binding\` instead.`,
            });
        } else if (field === "storeId") {
            out.push({
                field,
                rule: "removed-legacy",
                message: "`storeId` is the dead pre-ADR-0027 input write target (superseded by `writeTo`) — remove it from defaults.",
            });
        } else if (field === "path" && set.has("storeId")) {
            out.push({
                field,
                rule: "removed-legacy",
                message: "`path` is the dead pre-ADR-0027 input write target (rides with `storeId`, superseded by `writeTo`) — remove it from defaults.",
            });
        } else if (REMOVED_LEGACY_FIELDS.has(field)) {
            out.push({
                field,
                rule: "removed-legacy",
                message: `\`${field}\` is a removed legacy pagination alias (ADR 0038) — use the canonical \`<base>\` + \`<base>Binding\`.`,
            });
        }
    }

    // (c) bare-name reference fields: no `*Id` reference (keep-list excepted),
    //     and no retired `parent` reference (P228: the owning app is `app`).
    for (const field of defaults) {
        if (field === "parent") {
            out.push({
                field,
                rule: "reference-bare-name",
                message: "`parent` is the retired owning-app reference (renamed P228, ADR 0038) — the canonical field is `app`; the migration READER keeps legacy flows working, but no node may (re)introduce a `parent` default.",
            });
            continue;
        }
        if (!/Id$/.test(field)) continue;
        if (ID_KEEP.has(field)) continue;
        if (field === "storeId") continue; // owned by rule (b)
        const bare = field.slice(0, -"Id".length);
        out.push({
            field,
            rule: "reference-bare-name",
            message: `reference field \`${field}\` must use the bare concept name \`${bare}\` (ADR 0038: the value IS the id, like \`store\`/\`mount\`).`,
        });
    }

    return out;
}

/* ------------------------------------------------------------------ *
 * Core analysis (pure — operates on an in-memory node list)
 * ------------------------------------------------------------------ *
 * nodes: [{ type, defaults: string[] }]
 * allowlist: { <type>: { <field>: reason } }
 */
function analyzeNodes(nodes, allowlist) {
    const errors = [];
    const violations = []; // unique (type, field) that remain after allowlist
    let checked = 0;
    let allowlisted = 0;

    for (const n of nodes) {
        checked++;
        const raw = fieldViolations(n.defaults || []);
        const nodeAllow = (allowlist && allowlist[n.type]) || {};
        // Dedupe per (field): one allowlist entry / one report line per field,
        // even if the field trips more than one rule.
        const byField = new Map();
        for (const v of raw) {
            if (!byField.has(v.field)) byField.set(v.field, v);
        }
        for (const [field, v] of byField) {
            if (nodeAllow[field]) {
                allowlisted++;
                continue;
            }
            violations.push({ type: n.type, field: v.field, rule: v.rule });
            errors.push(
                `${n.type}: field \`${field}\` ${v.message} ` +
                    `Fix: rename/remove it (P228/P229), or allowlist it in ` +
                    `scripts/check-fields.js with a one-line reason.`
            );
        }
    }
    return { errors, violations, checked, allowlisted };
}

/* ------------------------------------------------------------------ *
 * Run against the real tree
 * ------------------------------------------------------------------ */

function buildNodes() {
    const htmls = nodeHtmlPaths();
    const nodes = [];
    for (const [type, htmlPath] of Object.entries(htmls).sort()) {
        if (!fs.existsSync(htmlPath)) continue;
        const defaults = extractDefaultsKeys(fs.readFileSync(htmlPath, "utf8"));
        nodes.push({ type, defaults });
    }
    return nodes;
}

function checkFields() {
    return analyzeNodes(buildNodes(), ALLOWLIST);
}

function main() {
    const { errors, checked, allowlisted } = checkFields();
    if (errors.length) {
        console.error("Cross-node field-consistency check FAILED:\n");
        for (const e of errors) console.error("  - " + e);
        console.error(
            `\n${errors.length} field-model violation(s) across ${checked} node(s) checked; ` +
                `${allowlisted} field(s) allowlisted (the list is frozen EMPTY since P259 — new entries need an ADR reason).`
        );
        process.exit(1);
    }
    console.log(
        `Cross-node field-consistency OK: ${checked} ui-* node(s) checked, ` +
            `${allowlisted} field(s) allowlisted (ADR 0038 fully enforced since P259).`
    );
}

if (require.main === module) main();

module.exports = {
    checkFields,
    analyzeNodes,
    fieldViolations,
    extractDefaultsKeys,
    nodeHtmlPaths,
    ALLOWLIST,
};

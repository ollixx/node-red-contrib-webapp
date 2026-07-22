#!/usr/bin/env node
/*
 * Editor open→save round-trip coverage tripwire (P216). WRITES NOTHING.
 * Exits non-zero on a missing round-trip test.
 *
 * Rationale: ADR 0031 — the editor open→save *clobber* bug class. A node field
 * that persists through a HIDDEN `#node-input-<field>` carrier must be *seeded*
 * from the saved config by `oneditprepare`; if it is not, Node-RED's field-copy
 * on **Done** writes the empty carrier back over the real property and the value
 * is silently lost on the first edit. P215 introduced the standard (a shared
 * `assertEditorRoundTrip` harness + a `.tests.md` catalogue entry). This tripwire
 * makes the standard ENFORCED, not aspirational: every node that declares a
 * qualifying carrier field must register a round-trip test, or it goes red.
 *
 * DETECTION RULE — a node QUALIFIES when its editor `.html` declares a
 * hidden-carrier field of one of these two shapes:
 *
 *   (a) an `installReferenceSelectors` reference/picker field whose config key is
 *       NOT `parent`/`mount` — e.g. `store`, `query`, `action`, `route`, `layout`.
 *       The carrier field name is the `#node-input-<field>` id the picker binds
 *       (from the config's selector value, or the picker's default carrier id).
 *   (b) an `editableList` field — a `#node-input-<field>-list` widget whose rows
 *       `oneditsave` serialises into a hidden `#node-input-<field>` input (e.g.
 *       `ui-component-instance` `props`).
 *
 * PARENT/MOUNT EXCLUSION — the ubiquitous `{ mount: true }` / `{ parent: … }`
 * placement picker is deliberately NOT a qualifying field: it is already covered
 * by `parent-selector.spec.ts` / `editor-mount-options.spec.ts`, and widening the
 * round-trip mandate to it would explode the suite for no new coverage (ADR 0031
 * §Consequences "scope is deliberately narrow"). Only the `parent` and `mount`
 * config keys are excluded — every other reference-picker key qualifies.
 *
 * COVERAGE — for each qualifying field the tripwire requires a registered editor
 * round-trip test, detected by a marker in the node's
 * `<node>.tests.md` catalogue under tests/e2e/nodes: a round-trip section (a heading
 * naming "round-trip" / "open→save") or any line naming the round-trip, in which
 * the field appears as a `` `field` `` code span (the exact format the P215
 * catalogues use — see ui-store-action.tests.md / ui-component.tests.md).
 *
 * ALLOWLIST — a small curated allowlist carries the currently-unconverted
 * qualifying nodes so `pnpm validate` stays green during the P217 backfill. Keep
 * it small; every entry weakens the check. P217 drives it to EMPTY. Nodes already
 * covered by a P215 round-trip test (`ui-store-action`, `ui-component-instance`)
 * are NOT allowlisted — they must stay covered by their real test.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PKG = require(path.join(ROOT, "package.json"));

/* ------------------------------------------------------------------ *
 * Allowlist — currently-unconverted qualifying nodes. Keep it SMALL.
 * Format: { "<node>": { "<field>": "one-line reason" } }.
 * P217 (2026-07-13) backfilled the round-trip tests for every qualifying node
 * (ui-query `params`/`refreshAction`, ui-query-action `query`, ui-store-read
 * `store`, ui-dialog `routeId`) and drove this to {} — every reference/picker/
 * editableList carrier is now provably covered by a real round-trip test.
 * Keep it EMPTY: a new entry is only ever justified by an ADR reason a
 * round-trip is genuinely N/A, never "not written yet".
 * ------------------------------------------------------------------ */
const ALLOWLIST = {};

/* ------------------------------------------------------------------ *
 * Node -> html -> tests.md mapping
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

// Index every `<name>.tests.md` catalogue under tests/e2e/nodes/** by basename.
function catalogueIndex() {
    const base = path.join(ROOT, "tests", "e2e", "nodes");
    const out = {};
    function walk(dir) {
        for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
            const p = path.join(dir, ent.name);
            if (ent.isDirectory()) walk(p);
            else if (ent.name.endsWith(".tests.md")) out[ent.name] = p;
        }
    }
    if (fs.existsSync(base)) walk(base);
    return out;
}

// Locate the round-trip catalogue for a node type. Most map 1:1 to
// <type>.tests.md; the two component nodes share ui-component.tests.md.
function cataloguePathFor(type, index) {
    if (type === "ui-component-definition" || type === "ui-component-instance") {
        return index["ui-component.tests.md"] || null;
    }
    return index[`${type}.tests.md`] || null;
}

/* ------------------------------------------------------------------ *
 * Extract `defaults` keys from a node .html (mirrors check-specs.js)
 * ------------------------------------------------------------------ */

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
 * Enumerate the qualifying carrier fields of a node .html
 * ------------------------------------------------------------------ */

// Config keys that are the placement baseline — excluded from the round-trip
// mandate (covered by parent-selector.spec.ts / editor-mount-options.spec.ts /
// the P228 category roundtrips in field-naming.spec.ts). `app` is the canonical
// owning-app key (P228, ex-`parent`); the legacy key stays excluded for
// robustness against old configs.
const EXCLUDED_KEYS = new Set(["app", "parent", "mount"]);

// The default `#node-input-<carrier>` id each reference-picker branch binds when
// the config value is `true` rather than an explicit selector string (mirrors
// installReferenceSelectors in resources/lib/editor-common.js).
const DEFAULT_CARRIER = {
    store: "storeId",
    query: "queryId",
    // P259 (ADR 0038): the route/layout reference carriers are the bare
    // concept names.
    route: "route",
    layout: "layout",
};

function selectorToField(sel) {
    const m = String(sel).match(/#node-input-([\w-]+)/);
    return m ? m[1] : null;
}

// Grab the balanced (...) argument text after the first `installReferenceSelectors(`.
function referenceSelectorConfig(src) {
    const clean = stripComments(src);
    const idx = clean.indexOf("installReferenceSelectors(");
    if (idx < 0) return null;
    const start = clean.indexOf("(", idx);
    let depth = 0;
    for (let k = start; k < clean.length; k++) {
        const c = clean[k];
        if (c === "(") depth++;
        else if (c === ")") {
            depth--;
            if (depth === 0) return clean.slice(start + 1, k);
        }
    }
    return null;
}

// Parse the top-level `key: value` pairs of the config object literal.
function parseConfigPairs(argText) {
    if (!argText) return [];
    const objStart = argText.indexOf("{");
    if (objStart < 0) return [];
    let depth = 0;
    let objEnd = -1;
    for (let k = objStart; k < argText.length; k++) {
        const c = argText[k];
        if (c === "{") depth++;
        else if (c === "}") {
            depth--;
            if (depth === 0) {
                objEnd = k;
                break;
            }
        }
    }
    if (objEnd < 0) return [];
    const body = argText.slice(objStart + 1, objEnd);
    const pairs = [];
    const re = /([A-Za-z_$][\w$]*)\s*:\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|true|false|[A-Za-z_$][\w$.]*)/g;
    let m;
    while ((m = re.exec(body))) {
        let val = m[2];
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
        }
        pairs.push({ key: m[1], value: val });
    }
    return pairs;
}

// Reference-picker qualifying fields: every non-parent/mount config key resolved
// to its `#node-input-<field>` carrier id, kept only if that id is a real
// `defaults` key (so the rule can never invent a phantom field).
function referencePickerFields(src, defaults) {
    const pairs = parseConfigPairs(referenceSelectorConfig(src));
    const out = [];
    for (const { key, value } of pairs) {
        if (EXCLUDED_KEYS.has(key)) continue;
        let field = null;
        if (typeof value === "string" && value.startsWith("#node-input-")) {
            field = selectorToField(value);
        } else if (DEFAULT_CARRIER[key]) {
            field = DEFAULT_CARRIER[key];
        } else {
            field = key;
        }
        if (field && defaults.includes(field)) out.push({ field, kind: "picker" });
    }
    return out;
}

// editableList qualifying fields: each `$("#node-input-<id>").editableList(` maps
// to the hidden carrier `<id>` (or `<id>` with a trailing `-list` stripped — the
// widget lives on `<field>-list`, the carrier on `<field>`). Kept only if the
// carrier is a real `defaults` key.
function editableListFields(src, defaults) {
    const clean = stripComments(src);
    const re = /#node-input-([\w-]+)["']\s*\)\s*\.editableList\(/g;
    const seen = new Set();
    const out = [];
    let m;
    while ((m = re.exec(clean))) {
        const id = m[1];
        let field = id;
        if (!defaults.includes(field) && id.endsWith("-list")) {
            field = id.slice(0, -"-list".length);
        }
        if (defaults.includes(field) && !seen.has(field)) {
            seen.add(field);
            out.push({ field, kind: "editableList" });
        }
    }
    return out;
}

// All qualifying carrier fields of a node .html, de-duplicated by field name.
function qualifyingFields(src) {
    const defaults = extractDefaultsKeys(src);
    const all = [...referencePickerFields(src, defaults), ...editableListFields(src, defaults)];
    const seen = new Set();
    const out = [];
    for (const f of all) {
        if (seen.has(f.field)) continue;
        seen.add(f.field);
        out.push(f);
    }
    return out;
}

/* ------------------------------------------------------------------ *
 * Detect registered round-trip fields in a .tests.md catalogue
 * ------------------------------------------------------------------ */

// A round-trip marker: a heading or line naming "round-trip"/"roundtrip" or an
// "open→save"/"open→Done" round-trip entry. Field names are the `` `field` ``
// code spans that appear inside a round-trip section (from its heading until the
// next `##`-level heading) or on any single round-trip-marked line.
const ROUNDTRIP_MARKER = /round.?trip|open\s*(?:→|->|&rarr;|—|-)\s*(?:save|done)/i;

function roundtripFields(md) {
    const out = new Set();
    if (!md) return out;
    let inSection = false;
    for (const line of md.split("\n")) {
        const heading = line.match(/^#{2,}\s+(.*)$/);
        if (heading) inSection = ROUNDTRIP_MARKER.test(heading[1]);
        if (inSection || ROUNDTRIP_MARKER.test(line)) {
            const spans = line.match(/`([A-Za-z_$][\w$-]*)`/g) || [];
            for (const s of spans) out.add(s.replace(/`/g, ""));
        }
    }
    return out;
}

/* ------------------------------------------------------------------ *
 * Core analysis (pure — the unit-testable seam)
 * ------------------------------------------------------------------ *
 * nodes: [{ type, htmlSrc, catalogueMd, cataloguePath }]
 * allowlist: { <type>: { <field>: reason } }
 */
function analyzeNodes(nodes, allowlist) {
    const errors = [];
    const qualifying = [];
    let checked = 0;
    let allowlisted = 0;

    for (const n of nodes) {
        const fields = qualifyingFields(n.htmlSrc || "");
        if (!fields.length) continue;
        checked++;
        const covered = roundtripFields(n.catalogueMd);
        const nodeAllow = (allowlist && allowlist[n.type]) || {};
        const uncovered = [];
        for (const f of fields) {
            qualifying.push({ type: n.type, field: f.field, kind: f.kind });
            if (covered.has(f.field)) continue;
            if (nodeAllow[f.field]) {
                allowlisted++;
                continue;
            }
            uncovered.push(f);
        }
        if (uncovered.length) {
            const where = n.cataloguePath || "<no .tests.md catalogue>";
            const list = uncovered.map((u) => `\`${u.field}\` (${u.kind})`).join(", ");
            errors.push(
                `${n.type}: qualifying carrier field(s) ${list} have NO editor open→save ` +
                    `round-trip test registered in ${where}. ` +
                    `Fix: add an assertEditorRoundTrip test + a round-trip entry naming the ` +
                    `field in the .tests.md catalogue, or allowlist it in ` +
                    `scripts/check-roundtrip.js with a one-line reason.`
            );
        }
    }
    return { errors, qualifying, checked, allowlisted };
}

/* ------------------------------------------------------------------ *
 * Run against the real tree
 * ------------------------------------------------------------------ */

function buildNodes() {
    const htmls = nodeHtmlPaths();
    const index = catalogueIndex();
    const nodes = [];
    for (const [type, htmlPath] of Object.entries(htmls).sort()) {
        if (!fs.existsSync(htmlPath)) continue;
        const htmlSrc = fs.readFileSync(htmlPath, "utf8");
        const cataloguePath = cataloguePathFor(type, index);
        const catalogueMd = cataloguePath ? fs.readFileSync(cataloguePath, "utf8") : "";
        nodes.push({
            type,
            htmlSrc,
            catalogueMd,
            cataloguePath: cataloguePath ? path.relative(ROOT, cataloguePath) : null,
        });
    }
    return nodes;
}

function checkRoundtrip() {
    return analyzeNodes(buildNodes(), ALLOWLIST);
}

function main() {
    const { errors, qualifying, checked, allowlisted } = checkRoundtrip();
    if (errors.length) {
        console.error("Editor open→save round-trip coverage check FAILED:\n");
        for (const e of errors) console.error("  - " + e);
        console.error(
            `\n${errors.length} uncovered qualifying node(s) across ${checked} node(s) with ` +
                `carrier fields; ${allowlisted} field(s) allowlisted.`
        );
        process.exit(1);
    }
    console.log(
        `Editor round-trip coverage OK: ${checked} node(s) with ${qualifying.length} qualifying ` +
            `carrier field(s) checked, ${allowlisted} allowlisted.`
    );
}

if (require.main === module) main();

module.exports = {
    checkRoundtrip,
    analyzeNodes,
    qualifyingFields,
    referencePickerFields,
    editableListFields,
    roundtripFields,
    extractDefaultsKeys,
    nodeHtmlPaths,
    cataloguePathFor,
    ALLOWLIST,
};

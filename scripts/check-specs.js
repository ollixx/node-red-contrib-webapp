#!/usr/bin/env node
/*
 * Spec<->Code conformance tripwire (P195). WRITES NOTHING. Exits non-zero on drift.
 *
 * Per `ui-*` node it checks the node's editor `defaults` keys (the runtime field
 * contract, read from the node `.html` `registerNodeType(...)` block) against the
 * fields *named* in that node's spec doc under `docs/nodes/<cat>/<node>.md`. The
 * check is BIDIRECTIONAL:
 *
 *   1. MISSING-IN-SPEC: every `defaults` key must be named (as a `` `field` ``
 *      code span) somewhere in the spec doc — otherwise the doc has silently
 *      drifted behind the code.
 *   2. PHANTOM-IN-SPEC: every field the spec's "Felder" table names as a node
 *      field must exist in `defaults` — otherwise the doc invents a field the
 *      code does not have.
 *
 * A curated ALLOWLIST carves out the deliberate omissions: layout/placement
 * boilerplate (documented centrally in layout.md, not per node), the typedInput
 * binding *carrier* fields (an editor-only twin of a real binding object), and a
 * handful of doc-stub / concurrently-owned nodes. Keep it small — every entry
 * weakens the check.
 *
 * Source of the field tables: the spec format is `## Felder` followed by one or
 * more markdown tables whose first column is a `` `field` `` code span. We do not
 * parse full markdown table semantics — we read the `` `field` `` code spans, which
 * is robust against column/format churn (per the P195 package note).
 *
 * Rationale: the node "contracts" (fields) are documented as per-node field
 * tables, but they drift silently (ui-list/ui-text drifted in one session). This
 * refuses to let that drift pass `pnpm validate`.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PKG = require(path.join(ROOT, "package.json"));

/* ------------------------------------------------------------------ *
 * Allowlist — deliberate, documented omissions. Keep it SMALL.
 * ------------------------------------------------------------------ */

// Layout / placement boilerplate: injected by the shared layout helper
// (`installLayoutChildPropRows`) and documented centrally in
// docs/nodes/concepts/layout.md, NOT in every per-node field table. Every
// child-placeable node carries these identically.
const LAYOUT_BOILERPLATE = new Set([
    "order",
    "row",
    "col",
    "colSize",
    "rowSize",
    "layoutX",
    "layoutY",
]);

// Universal placement / identity boilerplate carried by (almost) every node and
// documented centrally, not per-node:
//   - `parent`  — the direct-parent-id ALTERNATIVE to `mount` (the "Einordnung"
//                 prose of every spec covers "mount ODER parent"; the mount grammar
//                 lives in docs/nodes/concepts/ and ../../README). Not a per-node
//                 semantic field.
//   - `uiId`    — stable instance id carrier on the few nodes that need to address
//                 themselves at runtime (ui-log, ui-component-*). Plumbing, not a
//                 user-facing field.
//   - `outputs` — Node-RED's dynamic output-PORT count, derived from a node's
//                 `events` config by the editor. Pure wiring plumbing (how many
//                 output ports the node draws), never a user-authored field — the
//                 user-facing surface is `events`, which IS documented per node.
//   - `visible`/`disabled`/`color` — the ADR 0015 common BASE FIELDS. After the
//                 P222 rollout they are a UNIVERSAL, standardised group ("Allgemein")
//                 installed by `installBaseFields`, documented centrally in
//                 docs/nodes/concepts/editor.md (with the per-node applicability
//                 table) rather than re-listed in every node's Felder table — the
//                 same central-doc treatment as the layout/placement boilerplate.
//                 (`size` stays per-node: it is only a default on the few nodes with
//                 a genuine size axis, and each already documents it.)
const COMMON_BOILERPLATE = new Set([
    "parent",
    "uiId",
    "outputs",
    "visible",
    "disabled",
    "color",
]);

// Editor-only typedInput binding CARRIER fields. A binding `<base>` lives in the
// node as a binding OBJECT plus, by convention, editor-only sibling carriers:
//   `<base>Binding`  — the typedInput carrier (drives the binding via oneditsave)
//   `<base>Path`     — the query-path sub-field for the binding
//   `<base>Json`     — the raw-JSON authoring carrier
//   `<base>Field`    — the alternate field-name carrier
//   `<base>Input`    — the alternate typedInput carrier
// These are editor implementation details of an already-documented `<base>` field,
// so they are not separately named in the field table. A carrier is allowlisted
// ONLY when its `<base>` field also exists in the node's defaults — so the rule
// can never hide a genuinely undocumented field (the base must be real and, being
// real, is itself subject to the missing-in-spec check).
const CARRIER_SUFFIXES = ["Binding", "Path", "Json", "Field", "Input"];

function carrierBase(field) {
    for (const suf of CARRIER_SUFFIXES) {
        if (field.endsWith(suf) && field.length > suf.length) {
            return field.slice(0, -suf.length);
        }
    }
    return null;
}

// Nodes excluded from the bidirectional field check entirely, with a reason.
const NODE_ALLOWLIST = {
    // The two component nodes share a single stub spec doc (ui-component.md) that
    // has no `## Felder` table yet — it is explicitly a "to be filled" stub for
    // the Components wave. Re-enable once the stub gains field tables.
    "ui-component-definition": "stub spec doc ui-component.md has no field table yet",
    "ui-component-instance": "stub spec doc ui-component.md has no field table yet",
    // ui-repeat: spec + html owned by concurrent P190/P191/P193 — reconcile later.
    // (Do not edit ui-repeat.md / ui-repeat.html in P195; allowlist instead.)
    "ui-repeat": "owned by concurrent P190/P191/P193 — reconcile later",
};

// Per-node, per-field allowlist for individual deliberate omissions that are not
// covered by the categories above. Format: { "<node>": { "<field>": "reason" } }.
const FIELD_ALLOWLIST = {
    // ui-avatar persists its image binding OBJECT as `src` (documented in the
    // Felder table, "früher Src Path") but the editor typedInput carrier is named
    // after the UI label `image` → `imageBinding`. The carrier-suffix rule cannot
    // match it because its `<base>` (`image`) is intentionally not a defaults key
    // (the object is `src`). Same story for the `initials` binding carrier.
    "ui-avatar": {
        imageBinding: "editor carrier for the `src` image binding (UI-relabelled `image`)",
        initialsBinding: "editor carrier for the `initials` binding object",
    },
    // Back-compat alias: P92 renamed `severity` -> `variant`; `severity` is kept in
    // defaults ONLY to migrate old flows and is intentionally not a documented
    // field (the spec documents `variant` + an explicit "no separate severity" note).
    "ui-badge": {
        severity: "P92 back-compat alias of `variant`, kept only to migrate old flows",
    },
    // The following are SPEC-AHEAD (planned) fields. A `*.md` spec is a REQUIREMENTS
    // doc — its header states it describes the DESIRED contract, not the current
    // implementation. These fields are specified-but-not-yet-built; each is an
    // open/planned item in its spec ("Offene Punkte" / prose). They are allowlisted
    // on the PHANTOM direction so the spec may keep describing the intended field
    // until the code catches up. (The MISSING direction — undocumented CODE fields —
    // stays strict; that is the high-value drift this tripwire guards.)
    "ui-image": {
        // P151/P237: `fallbackSrc` is the DEFINITION field (schema union with
        // bindingSchema); its editor typedInput CARRIER is named `fallback`
        // (persists the binding object), which mapConfig maps to `fallbackSrc`.
        // The spec documents the definition field `fallbackSrc` and names the
        // `fallback` carrier in that row (carrier relabel, like ui-avatar image→src).
        fallbackSrc: "editor carrier is `fallback`; mapConfig maps it to the `fallbackSrc` definition field",
    },
    "ui-input": {
        placeholder: "spec-ahead: planned placeholder field, not yet in node defaults",
    },
    "ui-menu": {
        collapsed: "spec-ahead: planned sidebar-collapse binding, not yet in node defaults",
    },
    "ui-pagination": {
        totalItems: "spec-ahead: planned item-count binding (Offene Punkte), not yet in defaults",
        showInfo: "spec-ahead: planned info-row toggle, not yet in defaults",
        variant: "spec-ahead: planned numbered/simple style, not yet in defaults",
    },
    "ui-stepper": {
        linear: "spec-ahead: planned linear-navigation flag (Offene Punkte), not yet in defaults",
    },
    "ui-tabs": {
        variant: "spec-ahead: planned line/contained/pills style, not yet in defaults",
    },
};

/* ------------------------------------------------------------------ *
 * Node -> html -> spec mapping
 * ------------------------------------------------------------------ */

function nodeHtmlPaths() {
    const reg = (PKG["node-red"] && PKG["node-red"].nodes) || {};
    const out = {};
    for (const [type, jsRel] of Object.entries(reg)) {
        if (!type.startsWith("ui-")) continue;
        const html = path.join(ROOT, jsRel.replace(/\.js$/, ".html"));
        out[type] = html;
    }
    return out;
}

// Locate the spec doc for a node type. Most map 1:1 to docs/nodes/<cat>/<type>.md;
// the two component nodes map to the shared ui-component.md.
function specPathFor(type) {
    if (type === "ui-component-definition" || type === "ui-component-instance") {
        return path.join(ROOT, "docs", "nodes", "structure", "ui-component.md");
    }
    const base = path.join(ROOT, "docs", "nodes");
    for (const cat of fs.readdirSync(base)) {
        const catDir = path.join(base, cat);
        if (!fs.statSync(catDir).isDirectory()) continue;
        const p = path.join(catDir, `${type}.md`);
        if (fs.existsSync(p)) return p;
    }
    return null;
}

/* ------------------------------------------------------------------ *
 * Extract `defaults` keys from a node .html
 * ------------------------------------------------------------------ */

function stripComments(s) {
    // Naive strip of /* */ and // comments — fine for these editor files (no
    // regex-literal / string-with-// edge cases occur in the defaults blocks).
    return s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

function extractDefaultsKeys(src) {
    const clean = stripComments(src);
    const i = clean.indexOf("defaults:");
    if (i < 0) return null;
    let j = clean.indexOf("{", i);
    if (j < 0) return null;
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
    if (end < 0) return null;
    const block = clean.slice(j + 1, end);
    // Flatten to depth-0 chars only (drop nested object/array values) so the only
    // identifiers left are the top-level field keys.
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
 * Extract field names from a spec doc
 * ------------------------------------------------------------------ */

// `` `field` `` code spans anywhere in the doc — used for the MISSING-IN-SPEC
// direction (a defaults key counts as "named" if mentioned anywhere, e.g. a
// carrier explained in "Besonderheiten").
function codeSpansAnywhere(md) {
    const out = new Set();
    const re = /`([A-Za-z_$][\w$]*)`/g;
    let m;
    while ((m = re.exec(md))) out.add(m[1]);
    return out;
}

// The canonical per-node FIELD-table header. Only tables with exactly this header
// declare node fields. The Felder section also contains SUB-tables — item-object
// schemas (`| Feld | Typ | Beschreibung |`), enum-value tables (`| Wert | … |`),
// binding-detail tables (`| Feld | Anwendbar | Beschreibung |`) — whose first
// column is NOT a node field. Header-gating the extraction avoids mistaking those
// sub-rows for phantom node fields.
const FIELD_TABLE_HEADER = ["feld", "label", "editor-typ", "pflicht", "beschreibung"];

function rowCells(line) {
    // "| a | b | c |" -> ["a","b","c"] (drop the empty edges).
    const parts = line.split("|");
    return parts.slice(1, parts.length - 1).map((c) => c.trim());
}

function isFieldTableHeader(line) {
    const cells = rowCells(line).map((c) => c.toLowerCase().replace(/[„""]/g, ""));
    if (cells.length !== FIELD_TABLE_HEADER.length) return false;
    return FIELD_TABLE_HEADER.every((h, i) => cells[i] === h);
}

// Field names declared as node fields in the `## Felder` section — the
// `` `field` `` code spans of the FIRST column of each row of a canonical
// FIELD-table (header-gated, see above). Used for the PHANTOM-IN-SPEC direction
// (the spec must not invent fields the code lacks).
function felderTableFields(md) {
    const lines = md.split("\n");
    let inFelder = false;
    let inFieldTable = false; // inside a canonical field-table's body
    const out = new Set();
    for (const line of lines) {
        const h = line.match(/^##\s+(.*)$/);
        if (h) {
            inFelder = /^Felder\b/.test(h[1].trim());
            inFieldTable = false;
            continue;
        }
        if (!inFelder) continue;
        const trimmed = line.trim();
        if (!trimmed.startsWith("|")) {
            // A blank/prose line ends the current table.
            if (trimmed === "") inFieldTable = false;
            continue;
        }
        if (isFieldTableHeader(line)) {
            inFieldTable = true;
            continue;
        }
        // Separator row (|---|---|) — keep table open, declares no field.
        if (/^\|[\s:|-]+\|?\s*$/.test(trimmed)) continue;
        if (!inFieldTable) continue; // a sub-table row — not a node field
        let first = rowCells(line)[0] || "";
        // Strikethrough rows (`~~`field`~~`) DOCUMENT a removed field on purpose —
        // they are not a claim that the field still exists. Drop struck-through
        // spans before extracting field names.
        first = first.replace(/~~.*?~~/g, "");
        // Capture all code spans in the first cell — some rows pack two fields
        // ("`row` / `col`").
        const all = first.match(/`([A-Za-z_$][\w$]*)`/g) || [];
        for (const a of all) out.add(a.replace(/`/g, ""));
    }
    return out;
}

/* ------------------------------------------------------------------ *
 * Run
 * ------------------------------------------------------------------ */

function isAllowed(type, field, defaults) {
    if (LAYOUT_BOILERPLATE.has(field)) return true;
    if (COMMON_BOILERPLATE.has(field)) return true;
    // Carrier fields: allowlisted only when their `<base>` is a real defaults key.
    const base = carrierBase(field);
    if (base && defaults.includes(base)) return true;
    if (FIELD_ALLOWLIST[type] && FIELD_ALLOWLIST[type][field]) return true;
    return false;
}

function checkSpecs() {
    const htmls = nodeHtmlPaths();
    const errors = [];
    let checked = 0;
    let skipped = 0;

    for (const [type, htmlPath] of Object.entries(htmls).sort()) {
        if (NODE_ALLOWLIST[type]) {
            skipped++;
            continue;
        }
        if (!fs.existsSync(htmlPath)) {
            errors.push(`${type}: node html not found at ${path.relative(ROOT, htmlPath)}`);
            continue;
        }
        const specPath = specPathFor(type);
        if (!specPath || !fs.existsSync(specPath)) {
            errors.push(`${type}: no spec doc found under docs/nodes/**/${type}.md`);
            continue;
        }

        const defaults = extractDefaultsKeys(fs.readFileSync(htmlPath, "utf8"));
        if (!defaults) {
            errors.push(`${type}: could not parse a defaults block in ${path.relative(ROOT, htmlPath)}`);
            continue;
        }
        const md = fs.readFileSync(specPath, "utf8");
        const named = codeSpansAnywhere(md);
        const tableFields = felderTableFields(md);
        const specRel = path.relative(ROOT, specPath);

        // (1) MISSING-IN-SPEC: every defaults key must be named in the spec.
        for (const key of defaults) {
            if (isAllowed(type, key, defaults)) continue;
            if (!named.has(key)) {
                errors.push(
                    `${type}: field \`${key}\` is in defaults (${path.relative(ROOT, htmlPath)}) ` +
                        `but is NOT named anywhere in the spec ${specRel}. ` +
                        `Fix: add it to the Felder table (or, if it is deliberate boilerplate, ` +
                        `allowlist it in scripts/check-specs.js with a reason).`
                );
            }
        }

        // (2) PHANTOM-IN-SPEC: every field declared in the Felder table must exist
        // in defaults.
        for (const field of tableFields) {
            if (isAllowed(type, field, defaults)) continue;
            if (!defaults.includes(field)) {
                errors.push(
                    `${type}: field \`${field}\` is declared in the Felder table of ${specRel} ` +
                        `but does NOT exist in defaults (${path.relative(ROOT, htmlPath)}) — phantom field. ` +
                        `Fix: remove it from the spec (or rename it to the real defaults key).`
                );
            }
        }
        checked++;
    }

    return { errors, checked, skipped };
}

function main() {
    const { errors, checked, skipped } = checkSpecs();
    if (errors.length) {
        console.error("Spec<->Code conformance check FAILED:\n");
        for (const e of errors) console.error("  - " + e);
        console.error(
            `\n${errors.length} drift issue(s) across ${checked} node(s) checked, ${skipped} allowlisted.`
        );
        process.exit(1);
    }
    console.log(
        `Spec<->Code conformance OK: ${checked} ui-* node(s) checked bidirectionally, ${skipped} allowlisted.`
    );
}

if (require.main === module) main();

module.exports = {
    checkSpecs,
    extractDefaultsKeys,
    felderTableFields,
    codeSpansAnywhere,
    specPathFor,
    nodeHtmlPaths,
};

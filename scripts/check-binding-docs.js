#!/usr/bin/env node
/*
 * Binding-doc-drift tripwire (P237, "Muster 4"). WRITES NOTHING. Exits non-zero
 * on drift. Enforces ADR 0012 (binding ubiquity): a field whose SCHEMA is
 * binding-capable must NOT be documented in its spec's Felder table as a
 * static, non-bindable field.
 *
 * The recurring drift (found repeatedly by the per-node conformance audit): a
 * field is end-to-end bindable — its schema is `z.union([bindingSchema, …])` or
 * a direct `bindingSchema`, and the editor offers a typedInput — yet its spec
 * still calls it a plain "Textfeld" or explicitly claims "kein Binding" /
 * "nicht bindbar". A flow author CAN bind it in the editor; the doc lies.
 *
 * What it checks, per `ui-*` node with a spec doc:
 *   For each field the node's schema (packages/schema/src/node-definitions.ts)
 *   declares binding-capable, if that field ALSO has a row in the spec's
 *   canonical Felder table, the row must not document it as non-bindable:
 *     - Editor-Typ column contains "Textfeld", OR
 *     - the row text says "kein Binding" / "nicht bindbar".
 *   Either → a `node:field` drift finding.
 *
 * Binding-capability is read from the SCHEMA (the truth), matching the token
 * `bindingSchema` (the canonical value-binding validator). `writeToBindingSchema`
 * (the restricted WRITE half) is intentionally NOT matched — it is a distinct
 * identifier ("BindingSchema", capital B) and a write target, not a display
 * binding.
 *
 * A field with no Felder-table row is not flagged: the ADR 0015 base fields
 * (`visible`/`disabled`/`color`) are binding-capable but documented centrally in
 * editor.md, not per node — there is no per-node row claiming they are static.
 *
 * Parsing (regex over source, like check-specs.js / check-fields.js — robust to
 * format churn, no TS/Zod evaluation):
 *   - schema: the `uiNodeSchemaByType` registry maps `ui-x` → its schema const;
 *     each `export const <Const> = …({ <body> })` block yields top-level
 *     `field: <expr>` entries; binding-capable ⇔ <expr> contains `bindingSchema`.
 *   - spec: the canonical FIELD-table (`| Feld | Label | Editor-Typ | Pflicht |
 *     Beschreibung |`) yields per-field {editorType, description}.
 *
 * ALLOWLIST is EMPTY by design (P237): the four offenders it was written for are
 * fixed in the same package; button/progress binding-doc drift is owned by
 * P236/P234. Seed an entry ONLY with an ADR-grade reason, and keep it shrinking.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const { specPathFor, nodeHtmlPaths } = require("./check-specs.js");

const ROOT = path.resolve(__dirname, "..");
const SCHEMA_SRC = path.join(ROOT, "packages", "schema", "src", "node-definitions.ts");

/* ------------------------------------------------------------------ *
 * Allowlist — deliberate exceptions. Keep it SHRINKING; every entry needs
 * an ADR-grade reason. Format: { "<node>": { "<field>": "reason" } }
 *
 * P237 landed the guardrail after fixing its four target fields
 * (ui-datepicker.placeholder, ui-slider.label, ui-image.alt/fallbackSrc). The
 * guardrail — reading the SCHEMA as truth — then surfaced the SAME Muster-4
 * drift on three OTHER nodes the manual audit had not listed, which P237
 * allowlisted and deferred to each node's own conformance pass. P253 closed that
 * sweep: ui-input.label; ui-switch.label/labelOn/labelOff; and
 * ui-textarea.label/placeholder are now documented as bindable, and the
 * ui-textarea.placeholder serializer bug is fixed. The allowlist is empty again.
 * ------------------------------------------------------------------ */
// EMPTY (P253): the six Muster-4 offenders P237 deferred here
// (ui-input.label; ui-switch.label/labelOn/labelOff; ui-textarea.label/placeholder)
// are now documented as bindable and the ui-textarea.placeholder serializer bug
// is fixed. The allowlist is back to empty by design (P237).
const FIELD_ALLOWLIST = {};

/* ------------------------------------------------------------------ *
 * Schema: node type -> binding-capable field names
 * ------------------------------------------------------------------ */

// Extract the `uiNodeSchemaByType` registry: { "ui-x": uiXNodeDefinitionSchema }.
function schemaConstByType(src) {
    const out = {};
    const re = /"(ui-[a-z-]+)"\s*:\s*(ui[A-Za-z]+NodeDefinitionSchema)\b/g;
    let m;
    while ((m = re.exec(src))) out[m[1]] = m[2];
    return out;
}

// Given a schema const name, return the balanced `{ … }` body of its definition
// object (the first brace group after `export const <Const> =`).
function schemaBody(src, constName) {
    const decl = new RegExp(`export const ${constName}\\s*=`);
    const dm = decl.exec(src);
    if (!dm) return null;
    const from = dm.index + dm[0].length;
    const open = src.indexOf("{", from);
    if (open < 0) return null;
    let depth = 0;
    for (let k = open; k < src.length; k++) {
        const c = src[k];
        if (c === "{") depth++;
        else if (c === "}") {
            depth--;
            if (depth === 0) return src.slice(open + 1, k);
        }
    }
    return null;
}

// Strip /* */ and // comments — otherwise a field preceded by a line comment
// would be skipped by the key regex (it would see `// …` first). Naive strip is
// safe for these schema blocks (no `//` occurs inside their string literals),
// the same assumption check-specs.js makes for the editor `defaults` blocks.
function stripComments(s) {
    return s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

// Split a schema object body into top-level `key: expr` entries (respecting
// nested {}/[]/() and ignoring `...spread` members), then return the set of
// field names whose expression references the `bindingSchema` validator.
function bindingCapableFields(rawBody) {
    const fields = new Set();
    if (!rawBody) return fields;
    const body = stripComments(rawBody);
    // Walk top-level entries by tracking bracket depth; split on depth-0 commas.
    const entries = [];
    let depth = 0;
    let buf = "";
    for (const c of body) {
        if (c === "{" || c === "[" || c === "(") depth++;
        else if (c === "}" || c === "]" || c === ")") depth--;
        if (c === "," && depth === 0) {
            entries.push(buf);
            buf = "";
        } else {
            buf += c;
        }
    }
    if (buf.trim()) entries.push(buf);

    for (const entry of entries) {
        const trimmed = entry.trim();
        if (!trimmed || trimmed.startsWith("...")) continue;
        const km = /^([A-Za-z_$][\w$]*)\s*:/.exec(trimmed);
        if (!km) continue;
        const key = km[1];
        const expr = trimmed.slice(km[0].length);
        // The canonical value-binding validator token. `\b` before the lowercase
        // `b` never matches inside `writeToBindingSchema` (capital B).
        if (/\bbindingSchema\b/.test(expr)) fields.add(key);
    }
    return fields;
}

/* ------------------------------------------------------------------ *
 * Spec: field -> { editorType, description } from the canonical field table
 * ------------------------------------------------------------------ */

const FIELD_TABLE_HEADER = ["feld", "label", "editor-typ", "pflicht", "beschreibung"];

function rowCells(line) {
    const parts = line.split("|");
    return parts.slice(1, parts.length - 1).map((c) => c.trim());
}

function isFieldTableHeader(line) {
    const cells = rowCells(line).map((c) => c.toLowerCase().replace(/[„""]/g, ""));
    if (cells.length !== FIELD_TABLE_HEADER.length) return false;
    return FIELD_TABLE_HEADER.every((h, i) => cells[i] === h);
}

// Map each field named in the FIRST column of a canonical Felder table to its
// Editor-Typ (col 2) and Beschreibung (col 4). Rows that pack two fields
// ("`row` / `col`") map both to the same cells (harmless; not binding fields).
function felderRows(md) {
    const lines = md.split("\n");
    let inFelder = false;
    let inFieldTable = false;
    const out = {};
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
            if (trimmed === "") inFieldTable = false;
            continue;
        }
        if (isFieldTableHeader(line)) {
            inFieldTable = true;
            continue;
        }
        if (/^\|[\s:|-]+\|?\s*$/.test(trimmed)) continue;
        if (!inFieldTable) continue;
        const cells = rowCells(line);
        let first = (cells[0] || "").replace(/~~.*?~~/g, "");
        const editorType = cells[2] || "";
        const description = cells[4] || "";
        const names = (first.match(/`([A-Za-z_$][\w$]*)`/g) || []).map((s) => s.replace(/`/g, ""));
        for (const name of names) out[name] = { editorType, description };
    }
    return out;
}

/* ------------------------------------------------------------------ *
 * Drift rule
 * ------------------------------------------------------------------ */

// A field-table row documents a field as NON-bindable when its Editor-Typ is a
// plain "Textfeld", or its text asserts "kein Binding" / "nicht bindbar".
function documentsAsNonBindable(row) {
    const editor = (row.editorType || "").toLowerCase();
    const all = ((row.editorType || "") + " " + (row.description || "")).toLowerCase();
    if (/\btextfeld\b/.test(editor)) return true;
    if (/kein\s+binding/.test(all)) return true;
    if (/nicht\s+bindbar/.test(all)) return true;
    return false;
}

function checkBindingDocs() {
    const src = fs.readFileSync(SCHEMA_SRC, "utf8");
    const constByType = schemaConstByType(src);
    const htmls = nodeHtmlPaths();
    const errors = [];
    let checked = 0;
    let allowlisted = 0;

    for (const type of Object.keys(htmls).sort()) {
        const constName = constByType[type];
        if (!constName) continue; // no schema in the registry — skip
        const capable = bindingCapableFields(schemaBody(src, constName));
        if (capable.size === 0) continue;
        const specPath = specPathFor(type);
        if (!specPath || !fs.existsSync(specPath)) continue;
        const rows = felderRows(fs.readFileSync(specPath, "utf8"));
        const specRel = path.relative(ROOT, specPath);

        for (const field of [...capable].sort()) {
            const row = rows[field];
            if (!row) continue; // no per-node row (documented centrally) — nothing to flag
            if (FIELD_ALLOWLIST[type] && FIELD_ALLOWLIST[type][field]) {
                allowlisted++;
                continue;
            }
            if (documentsAsNonBindable(row)) {
                errors.push(
                    `${type}:${field} — schema is binding-capable (bindingSchema) but the spec ` +
                        `${specRel} documents it as non-bindable (Editor-Typ „${row.editorType}"). ` +
                        `Fix: document it as bindable (typedInput + binding kinds) per ADR 0012, or ` +
                        `allowlist it in scripts/check-binding-docs.js with an ADR-grade reason.`
                );
            }
        }
        checked++;
    }
    return { errors, checked, allowlisted };
}

function main() {
    const { errors, checked, allowlisted } = checkBindingDocs();
    if (errors.length) {
        console.error("Binding-doc-drift check FAILED (ADR 0012):\n");
        for (const e of errors) console.error("  - " + e);
        console.error(
            `\n${errors.length} drift finding(s) across ${checked} node(s) checked, ${allowlisted} allowlisted.`
        );
        process.exit(1);
    }
    console.log(
        `Binding-doc-drift OK: ${checked} ui-* node(s) checked, ${allowlisted} allowlisted.`
    );
}

if (require.main === module) main();

module.exports = {
    checkBindingDocs,
    schemaConstByType,
    schemaBody,
    bindingCapableFields,
    felderRows,
    documentsAsNonBindable,
    FIELD_ALLOWLIST,
};

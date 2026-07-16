#!/usr/bin/env node
/*
 * Inline-help doc-link tripwire (P232). WRITES NOTHING. Exits non-zero when a
 * `ui-*` node's `data-help-name` block is missing a full-doc link. Read-only: it
 * parses the help `<script type="text/html" data-help-name="...">` block of every
 * `ui-*` node `.html` (enumerated from package.json `node-red.nodes`, exactly as
 * check-fields.js / check-specs.js) and enforces the inline-help convention.
 *
 * Rationale: the spec convention (docs/nodes/concepts/editor.md → "Inline-Hilfe")
 * requires every node's editor help to end with a link to its FULL doc
 * (`docs/nodes/<cat>/<node>.md`), like ui-divider / ui-alert. A 2026-07-14 sweep
 * found ~12 nodes without one. This tripwire makes the convention machine-checked
 * so a NEW node cannot ship help without a resolvable doc link.
 *
 * RULES (each violation names the node):
 *
 *   (1) HELP BLOCK PRESENT. Every ui-* node HTML has a `data-help-name` block.
 *
 *   (2) DOC LINK PRESENT. The block contains at least one anchor to the canonical
 *       develop-blob docs URL:
 *         https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/<...>.md
 *
 *   (3) LINK RESOLVES. That doc path exists on disk (so the link is not dangling —
 *       this is what check:links cannot see, since it does not scan `.html`).
 *
 *   (4) LINKS ITS OWN SPEC. At least one such anchor targets the node's OWN spec
 *       (basename `<node>.md`). Nodes with no own spec (the component pair) link
 *       the ui-component concept doc instead — see EXPECTED_DOC.
 *
 * ALLOWLIST — curated, one-line reason each (mirrors check-fields.js). An entry
 * `{ "<node>": "reason" }` suppresses ALL rules for that node. Every entry WEAKENS
 * the check — keep it EMPTY unless an ADR reason forces an exception.
 *
 * Run via `pnpm check:help`; part of `pnpm validate`.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PKG = require(path.join(ROOT, "package.json"));

/* ------------------------------------------------------------------ *
 * Allowlist — curated exceptions (EMPTY on landing). Format:
 * { "<node-type>": "one-line reason" }.
 * ------------------------------------------------------------------ */
const ALLOWLIST = {};

/* ------------------------------------------------------------------ *
 * Expected doc basename per node. Default: `<type>.md`. Nodes without an
 * own spec map to a sensible concept doc (ADR 0020 — the component pair
 * shares docs/nodes/structure/ui-component.md).
 * ------------------------------------------------------------------ */
const EXPECTED_DOC = {
    "ui-component-definition": "ui-component.md",
    "ui-component-instance": "ui-component.md",
};

// Canonical inline-help full-doc URL. Capture group 1 = the repo-relative
// `docs/nodes/<...>.md` path (used for on-disk resolution + basename check).
const DOC_LINK_RE =
    /https:\/\/github\.com\/ollixx\/node-red-contrib-webapp\/blob\/develop\/(docs\/nodes\/[A-Za-z0-9/_-]+\.md)/g;

/* ------------------------------------------------------------------ *
 * Node -> html mapping + help-block extraction (mirrors check-fields.js)
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

// Extract the inner HTML of the `data-help-name="<type>"` script block, or null
// if there is none. Tolerates arbitrary attribute order / whitespace.
function extractHelpBlock(src, type) {
    const openRe = new RegExp(
        `<script[^>]*data-help-name\\s*=\\s*["']${type.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}["'][^>]*>`,
        "i"
    );
    const m = openRe.exec(src);
    if (!m) return null;
    const start = m.index + m[0].length;
    const end = src.indexOf("</script>", start);
    if (end < 0) return null;
    return src.slice(start, end);
}

/* ------------------------------------------------------------------ *
 * Rule evaluation (pure — the unit-testable seam)
 * ------------------------------------------------------------------ *
 * helpViolation({ type, help }, opts): a single { rule, message } or null.
 *   opts.expectedBasename(type) -> the doc basename the node must link.
 *   opts.docExists(relPath)     -> whether a repo-relative doc path resolves.
 */
function helpViolation(node, opts) {
    const expectedBasename =
        (opts && opts.expectedBasename) || ((t) => EXPECTED_DOC[t] || `${t}.md`);
    const docExists =
        (opts && opts.docExists) || ((rel) => fs.existsSync(path.join(ROOT, rel)));

    const { type, help } = node;

    // (1) help block present.
    if (help == null) {
        return {
            rule: "no-help-block",
            message: "has no `data-help-name` help block — add one with a purpose + a full-doc link.",
        };
    }

    // (2) at least one canonical develop-blob docs link.
    const links = [];
    let mm;
    DOC_LINK_RE.lastIndex = 0;
    while ((mm = DOC_LINK_RE.exec(help)) !== null) links.push(mm[1]);
    if (links.length === 0) {
        return {
            rule: "no-doc-link",
            message:
                "help block has no full-doc link. Add " +
                `\`https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/<cat>/${expectedBasename(type)}\` ` +
                "(pattern: ui-divider / ui-alert).",
        };
    }

    // (3) at least one linked doc resolves on disk.
    const resolved = links.filter((rel) => docExists(rel));
    if (resolved.length === 0) {
        return {
            rule: "dangling-doc-link",
            message: `help doc link(s) do not resolve on disk: ${links.join(", ")}.`,
        };
    }

    // (4) at least one resolved link targets the node's own spec.
    const want = expectedBasename(type);
    const hitsOwnSpec = resolved.some((rel) => path.basename(rel) === want);
    if (!hitsOwnSpec) {
        return {
            rule: "not-own-spec",
            message:
                `help links a doc but not its own spec (expected basename \`${want}\`, ` +
                `found ${resolved.join(", ")}).`,
        };
    }

    return null;
}

/* ------------------------------------------------------------------ *
 * Core analysis (pure — operates on an in-memory node list)
 * ------------------------------------------------------------------ *
 * nodes: [{ type, help: string|null }]
 * allowlist: { <type>: reason }
 */
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
        const v = helpViolation(n, opts);
        if (v) {
            errors.push(
                `${n.type}: ${v.message} ` +
                    `Fix: add the link (see docs/nodes/concepts/editor.md), or allowlist ` +
                    `it in scripts/check-help.js with a one-line reason.`
            );
        }
    }
    return { errors, checked, allowlisted };
}

/* ------------------------------------------------------------------ *
 * Run against the real tree
 * ------------------------------------------------------------------ */

function buildNodes() {
    const htmls = nodeHtmlPaths();
    const nodes = [];
    for (const [type, htmlPath] of Object.entries(htmls).sort()) {
        if (!fs.existsSync(htmlPath)) continue;
        const src = fs.readFileSync(htmlPath, "utf8");
        nodes.push({ type, help: extractHelpBlock(src, type) });
    }
    return nodes;
}

function checkHelp() {
    return analyzeNodes(buildNodes(), ALLOWLIST);
}

function main() {
    const { errors, checked, allowlisted } = checkHelp();
    if (errors.length) {
        console.error("Inline-help doc-link check FAILED:\n");
        for (const e of errors) console.error("  - " + e);
        console.error(
            `\n${errors.length} help-link violation(s) across ${checked} node(s) checked; ` +
                `${allowlisted} node(s) allowlisted.`
        );
        process.exit(1);
    }
    console.log(
        `Inline-help doc-link OK: ${checked} ui-* node(s) checked, ` +
            `every help block links a resolvable full doc; ${allowlisted} allowlisted.`
    );
}

if (require.main === module) main();

module.exports = {
    checkHelp,
    analyzeNodes,
    helpViolation,
    extractHelpBlock,
    nodeHtmlPaths,
    EXPECTED_DOC,
    ALLOWLIST,
};

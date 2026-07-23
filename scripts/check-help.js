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
 * P265 EXTENSION (ADR 0042): help migrates to Node-RED's per-node locale
 * mechanism. Nodes on the shrinking TRANSITION_INLINE rest-list keep the
 * inline rules (1)-(4) above; every OTHER node (locale-migrated, starting
 * with the pilot ui-divider — and any NEW node) is checked under the STRICT
 * locale rules (L0)-(L6): inline block gone; en-US AND de locale help files
 * present with the data-help-name wrapper, the mandatory Inputs section, and
 * a resolving language-correct link to the node's own guide doc
 * (docs/guide/nodes/<node>.md / docs/guide/de/nodes/<node>.md).
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
 * P265 (ADR 0042) — locale-help migration. Help moves from the inline
 * `data-help-name` block to Node-RED's per-node locale mechanism:
 * `nodes/<cat>/locales/en-US/<node>.html` + `locales/de/<node>.html`, both
 * linking the node's USER guide doc (EN → docs/guide/nodes/<node>.md,
 * DE → docs/guide/de/nodes/<node>.md) and both carrying the mandatory
 * Inputs section (help template: docs/guide/_templates/help.md).
 *
 * TRANSITION_INLINE is the SHRINKING rest-list (the proven check-fields
 * idiom): a node listed here is still checked under the OLD inline rules
 * (inline block + contract-doc link). The batches P267–P271 migrate every
 * node and delete its entry; a node NOT listed here (incl. any NEW node)
 * is checked under the STRICT locale rules below. Format:
 * { "<node-type>": "one-line reason" }. Target: EMPTY.
 * ------------------------------------------------------------------ */
const TRANSITION_INLINE = {};
for (const t of [
    "ui-app", "ui-route", "ui-dialog", "ui-component-definition", "ui-component-instance",
    "ui-text", "ui-button", "ui-table", "ui-container", "ui-input", "ui-select",
    "ui-checkbox", "ui-radio", "ui-switch", "ui-textarea", "ui-datepicker", "ui-slider",
    "ui-alert", "ui-toast", "ui-progress", "ui-skeleton", "ui-badge", "ui-empty-state",
    "ui-tabs", "ui-tab", "ui-accordion", "ui-accordion-section", "ui-breadcrumb", "ui-menu",
    "ui-pagination", "ui-stepper", "ui-image", "ui-icon", "ui-list", "ui-avatar",
    "ui-log", "ui-repeat", "ui-store", "ui-query", "ui-store-read",
    "ui-store-action", "ui-query-action", "ui-action",
    // ui-divider: MIGRATED (P265 pilot) — intentionally absent.
]) {
    TRANSITION_INLINE[t] = "inline help pending locale migration (batches P267-P271)";
}

// Canonical guide-doc URL per language. Capture group 1 = repo-relative path.
const GUIDE_LINK_RE = {
    "en-US": /https:\/\/github\.com\/ollixx\/node-red-contrib-webapp\/blob\/develop\/(docs\/guide\/nodes\/[A-Za-z0-9/_-]+\.md)/,
    "de": /https:\/\/github\.com\/ollixx\/node-red-contrib-webapp\/blob\/develop\/(docs\/guide\/de\/nodes\/[A-Za-z0-9/_-]+\.md)/,
};

// The mandatory Inputs section heading per language (help template).
const INPUTS_HEADING_RE = {
    "en-US": /<h3>\s*Inputs?\s*<\/h3>/i,
    "de": /<h3>\s*Eingä?a?ng(e)?\s*<\/h3>/i,
};

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
 * P265 — STRICT locale rules for migrated nodes (pure seam, like
 * helpViolation). node: { type, help, locales: { "en-US": s|null, de: s|null } }.
 * Returns the FIRST { rule, message } or null.
 *   opts.docExists(relPath) -> whether a repo-relative doc path resolves.
 */
function localeViolation(node, opts) {
    const docExists =
        (opts && opts.docExists) || ((rel) => fs.existsSync(path.join(ROOT, rel)));
    const { type, help } = node;
    const locales = node.locales || {};

    // (L0) the inline block must be GONE — if it stays, it shadows nothing
    // (locale help is appended per request) but it is dead, drift-prone weight.
    if (help != null) {
        return {
            rule: "inline-help-remains",
            message:
                "still has an inline `data-help-name` block although its help is locale-migrated — " +
                "delete the inline block (help lives in `nodes/<cat>/locales/<lang>/`).",
        };
    }

    for (const lang of ["en-US", "de"]) {
        const content = locales[lang];
        // (L1) locale help file present.
        if (content == null) {
            return {
                rule: "missing-locale-help",
                message: `has no locale help for \`${lang}\` — add \`nodes/<cat>/locales/${lang}/${type}.html\` (template: docs/guide/_templates/help.md).`,
            };
        }
        // (L2) the file carries the node's own data-help-name block.
        if (extractHelpBlock(content, type) == null) {
            return {
                rule: "locale-no-help-block",
                message: `locale help \`${lang}\` lacks the \`<script type="text/html" data-help-name="${type}">\` wrapper — Node-RED appends the file verbatim; the wrapper is required.`,
            };
        }
        // (L3) mandatory Inputs section (help template).
        if (!INPUTS_HEADING_RE[lang].test(content)) {
            return {
                rule: "no-inputs-section",
                message: `locale help \`${lang}\` is missing the mandatory Inputs section (\`<h3>${lang === "de" ? "Eingang" : "Inputs"}</h3>\`) — even "no input port" must be stated.`,
            };
        }
        // (L4) guide link present, language-correct.
        const m = GUIDE_LINK_RE[lang].exec(content);
        if (!m) {
            const want = lang === "de" ? `docs/guide/de/nodes/${type}.md` : `docs/guide/nodes/${type}.md`;
            return {
                rule: "no-guide-link",
                message: `locale help \`${lang}\` has no guide-doc link — add \`https://github.com/ollixx/node-red-contrib-webapp/blob/develop/${want}\`.`,
            };
        }
        // (L5) the linked guide doc resolves on disk.
        if (!docExists(m[1])) {
            return {
                rule: "dangling-guide-link",
                message: `locale help \`${lang}\` links \`${m[1]}\`, which does not resolve on disk.`,
            };
        }
        // (L6) it links the node's OWN guide doc.
        if (path.basename(m[1]) !== `${type}.md`) {
            return {
                rule: "not-own-guide",
                message: `locale help \`${lang}\` links \`${m[1]}\` but not the node's own guide doc (\`${type}.md\`).`,
            };
        }
    }
    return null;
}

/* ------------------------------------------------------------------ *
 * Core analysis (pure — operates on an in-memory node list)
 * ------------------------------------------------------------------ *
 * nodes: [{ type, help: string|null, locales?: { "en-US": s|null, de: s|null } }]
 * allowlist: { <type>: reason }
 * opts.transition: { <type>: reason } — nodes still under the OLD inline
 *   rules (defaults to TRANSITION_INLINE); everything else gets the STRICT
 *   locale rules (localeViolation).
 */
function analyzeNodes(nodes, allowlist, opts) {
    const errors = [];
    let checked = 0;
    let allowlisted = 0;
    let transitional = 0;
    let migrated = 0;
    const transition = (opts && opts.transition) || TRANSITION_INLINE;

    for (const n of nodes) {
        checked++;
        if (allowlist && allowlist[n.type]) {
            allowlisted++;
            continue;
        }
        let v;
        if (transition[n.type]) {
            transitional++;
            v = helpViolation(n, opts);
        } else {
            migrated++;
            v = localeViolation(n, opts);
        }
        if (v) {
            errors.push(
                `${n.type}: ${v.message} ` +
                    `Fix: add the link (see docs/nodes/concepts/editor.md / docs/guide/README.md), or allowlist ` +
                    `it in scripts/check-help.js with a one-line reason.`
            );
        }
    }
    return { errors, checked, allowlisted, transitional, migrated };
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
        // P265: locale help files live next to the registered .js/.html —
        // `<dir>/locales/<lang>/<type>.html` (the PROVEN Node-RED mechanic,
        // docs/guide/README.md).
        const dir = path.dirname(htmlPath);
        const locales = {};
        for (const lang of ["en-US", "de"]) {
            const p = path.join(dir, "locales", lang, `${type}.html`);
            locales[lang] = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
        }
        nodes.push({ type, help: extractHelpBlock(src, type), locales });
    }
    return nodes;
}

function checkHelp() {
    return analyzeNodes(buildNodes(), ALLOWLIST);
}

function main() {
    const { errors, checked, allowlisted, transitional, migrated } = checkHelp();
    if (errors.length) {
        console.error("Node-help check FAILED:\n");
        for (const e of errors) console.error("  - " + e);
        console.error(
            `\n${errors.length} help violation(s) across ${checked} node(s) checked; ` +
                `${allowlisted} node(s) allowlisted.`
        );
        process.exit(1);
    }
    console.log(
        `Node-help OK: ${checked} ui-* node(s) checked — ${migrated} locale-migrated ` +
            `(en-US+de help, guide links resolve), ${transitional} transitional inline ` +
            `(rest-list, shrinking to 0 via P267-P271); ${allowlisted} allowlisted.`
    );
}

if (require.main === module) main();

module.exports = {
    checkHelp,
    analyzeNodes,
    helpViolation,
    localeViolation,
    extractHelpBlock,
    nodeHtmlPaths,
    EXPECTED_DOC,
    ALLOWLIST,
    TRANSITION_INLINE,
};

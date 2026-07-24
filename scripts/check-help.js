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

    
    "ui-alert", "ui-toast", "ui-progress", "ui-skeleton", "ui-badge", "ui-empty-state",
    "ui-tabs", "ui-tab", "ui-accordion", "ui-accordion-section", "ui-breadcrumb", "ui-menu",
    "ui-pagination", "ui-stepper",
    "ui-log",
    // ui-divider: MIGRATED (P265 pilot) — intentionally absent.
    // P267: backbone batch fully migrated — no entries remain here.
]) {
    TRANSITION_INLINE[t] = "inline help pending locale migration (batches P267-P271)";
}

/* ------------------------------------------------------------------ *
 * P272 (ADR 0042 §3) — editor-LABEL i18n. Labels migrate to `data-i18n`
 * keys + per-node message catalogs `nodes/<cat>/locales/<lang>/<node>.json`
 * (en-US + de, key convention in docs/guide/README.md). LABEL_TRANSITION is
 * the SHRINKING rest-list (same idiom as TRANSITION_INLINE): a node listed
 * here may still carry untranslated literal labels; a node NOT listed here
 * (starting with the pilot ui-divider — and any NEW node) must use
 * `data-i18n` labels AND ship both catalogs with mirrored key structure.
 * Independent of the list: ANY node that uses `data-i18n` must have both
 * catalogs (a half-migrated node cannot ship EN-only). Target: EMPTY.
 * ------------------------------------------------------------------ */
const LABEL_TRANSITION = {};
for (const t of [

    
    "ui-alert", "ui-toast", "ui-progress", "ui-skeleton", "ui-badge", "ui-empty-state",
    "ui-tabs", "ui-tab", "ui-accordion", "ui-accordion-section", "ui-breadcrumb", "ui-menu",
    "ui-pagination", "ui-stepper",
    "ui-log",
    // ui-divider: MIGRATED (P272 pilot) — intentionally absent.
    // P267: backbone batch fully migrated — no entries remain here.
]) {
    LABEL_TRANSITION[t] = "editor labels pending i18n migration (batches P267-P271)";
}

// The SHARED editor-common catalog (P272): the catalog-carrier set
// `webapp-common` must ship both languages with mirrored key structure.
const SHARED_CATALOG_LANGS = ["en-US", "de"];
const SHARED_CATALOG_DIR = path.join(ROOT, "nodes", "locales");

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
 * P272 — label-catalog rules (pure seam, like helpViolation).
 * ------------------------------------------------------------------ */

// The sorted list of dotted LEAF key paths of a parsed catalog object — the
// structural fingerprint two languages must share (values differ, keys never).
function catalogKeyTree(obj, prefix) {
    const keys = [];
    const pre = prefix ? prefix + "." : "";
    for (const k of Object.keys(obj || {})) {
        const v = obj[k];
        if (v !== null && typeof v === "object" && !Array.isArray(v)) {
            keys.push(...catalogKeyTree(v, pre + k));
        } else {
            keys.push(pre + k);
        }
    }
    return keys.sort();
}

/* labelViolation(node, opts): the FIRST { rule, message } or null.
 * node: { type, html: string|null, labelCatalogs: { "en-US": s|null, de: s|null } }
 *   (catalog entries are the RAW file contents, null when the file is absent).
 * opts.labelTransition: { <type>: reason } — nodes still allowed to carry
 *   untranslated literal labels (defaults to LABEL_TRANSITION). Rules:
 *   (LB1) a label-migrated node (not on the list) uses `data-i18n` in its HTML;
 *   (LB2) any node using `data-i18n` (migrated or not) has BOTH catalogs;
 *   (LB3) both catalogs parse as JSON;
 *   (LB4) both carry the node's own type as top-level key;
 *   (LB5) the two languages' key trees are identical (no drift).
 */
function labelViolation(node, opts) {
    const transition = (opts && opts.labelTransition) || LABEL_TRANSITION;
    const { type } = node;
    const html = node.html || "";
    const catalogs = node.labelCatalogs || {};
    const usesDataI18n = /data-i18n\s*=/.test(html);
    const migrated = !transition[type];

    if (!migrated && !usesDataI18n) {
        return null; // untouched legacy node — the batches migrate it.
    }
    // (LB1)
    if (migrated && !usesDataI18n) {
        return {
            rule: "no-data-i18n-labels",
            message:
                "is label-migrated (not on LABEL_TRANSITION) but its template has no `data-i18n` labels — " +
                "add them per the key convention (docs/guide/README.md) or re-list the node.",
        };
    }
    const parsed = {};
    for (const lang of ["en-US", "de"]) {
        const raw = catalogs[lang];
        // (LB2)
        if (raw == null) {
            return {
                rule: "missing-label-catalog",
                message: `uses \`data-i18n\` labels but has no \`${lang}\` message catalog — add \`nodes/<cat>/locales/${lang}/${type}.json\` (EN + DE always together).`,
            };
        }
        // (LB3)
        try {
            parsed[lang] = JSON.parse(raw);
        } catch (err) {
            return {
                rule: "invalid-label-catalog",
                message: `label catalog \`${lang}\` is not valid JSON: ${err.message}.`,
            };
        }
        // (LB4)
        if (!parsed[lang] || typeof parsed[lang] !== "object" || !(type in parsed[lang])) {
            return {
                rule: "label-catalog-wrong-root",
                message: `label catalog \`${lang}\` lacks the top-level \`${type}\` key (the namespace-internal root the data-i18n keys start with).`,
            };
        }
    }
    // (LB5)
    const enKeys = catalogKeyTree(parsed["en-US"]);
    const deKeys = catalogKeyTree(parsed.de);
    if (enKeys.join("\n") !== deKeys.join("\n")) {
        const missingInDe = enKeys.filter((k) => !deKeys.includes(k));
        const missingInEn = deKeys.filter((k) => !enKeys.includes(k));
        return {
            rule: "label-catalog-key-drift",
            message:
                "label catalogs en-US and de have drifted key structures — " +
                (missingInDe.length ? `missing in de: ${missingInDe.join(", ")}; ` : "") +
                (missingInEn.length ? `missing in en-US: ${missingInEn.join(", ")}` : "") +
                " (every key EN + DE together).",
        };
    }
    return null;
}

/* sharedCatalogViolations(catalogs): array of message strings (empty = OK).
 * catalogs: { "en-US": s|null, de: s|null } — raw webapp-common.json contents.
 * The shared catalog must exist in both languages, parse, carry the `common`
 * root, and mirror key structures (same drift rule as per-node catalogs).
 */
function sharedCatalogViolations(catalogs) {
    const errors = [];
    const parsed = {};
    for (const lang of SHARED_CATALOG_LANGS) {
        const raw = catalogs ? catalogs[lang] : null;
        if (raw == null) {
            errors.push(
                `webapp-common: shared catalog \`nodes/locales/${lang}/webapp-common.json\` is missing — ` +
                    "editor-common's shared strings need en-US AND de."
            );
            continue;
        }
        try {
            parsed[lang] = JSON.parse(raw);
        } catch (err) {
            errors.push(`webapp-common: shared catalog \`${lang}\` is not valid JSON: ${err.message}.`);
            continue;
        }
        if (!parsed[lang] || typeof parsed[lang] !== "object" || !("common" in parsed[lang])) {
            errors.push(`webapp-common: shared catalog \`${lang}\` lacks the top-level \`common\` key.`);
        }
    }
    if (parsed["en-US"] && parsed.de) {
        const enKeys = catalogKeyTree(parsed["en-US"]);
        const deKeys = catalogKeyTree(parsed.de);
        if (enKeys.join("\n") !== deKeys.join("\n")) {
            const missingInDe = enKeys.filter((k) => !deKeys.includes(k));
            const missingInEn = deKeys.filter((k) => !enKeys.includes(k));
            errors.push(
                "webapp-common: shared catalogs en-US and de have drifted key structures — " +
                    (missingInDe.length ? `missing in de: ${missingInDe.join(", ")}; ` : "") +
                    (missingInEn.length ? `missing in en-US: ${missingInEn.join(", ")}` : "")
            );
        }
    }
    return errors;
}

/* analyzeLabels(nodes, opts): { errors, labelMigrated, labelTransitional } —
 * runs labelViolation over the node list (pure, like analyzeNodes). */
function analyzeLabels(nodes, opts) {
    const errors = [];
    let labelMigrated = 0;
    let labelTransitional = 0;
    const transition = (opts && opts.labelTransition) || LABEL_TRANSITION;
    for (const n of nodes) {
        if (transition[n.type]) {
            labelTransitional++;
        } else {
            labelMigrated++;
        }
        const v = labelViolation(n, opts);
        if (v) {
            errors.push(
                `${n.type}: ${v.message} ` +
                    "Fix: follow the label key convention (docs/guide/README.md, \"How editor-label i18n works\") " +
                    "or adjust LABEL_TRANSITION in scripts/check-help.js with a one-line reason."
            );
        }
    }
    return { errors, labelMigrated, labelTransitional };
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
        const labelCatalogs = {};
        for (const lang of ["en-US", "de"]) {
            const p = path.join(dir, "locales", lang, `${type}.html`);
            locales[lang] = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
            // P272: the LABEL message catalog lives next to the help file.
            const cat = path.join(dir, "locales", lang, `${type}.json`);
            labelCatalogs[lang] = fs.existsSync(cat) ? fs.readFileSync(cat, "utf8") : null;
        }
        nodes.push({ type, help: extractHelpBlock(src, type), locales, html: src, labelCatalogs });
    }
    return nodes;
}

// P272: the shared webapp-common catalogs from the real tree.
function readSharedCatalogs() {
    const catalogs = {};
    for (const lang of SHARED_CATALOG_LANGS) {
        const p = path.join(SHARED_CATALOG_DIR, lang, "webapp-common.json");
        catalogs[lang] = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
    }
    return catalogs;
}

function checkHelp() {
    const nodes = buildNodes();
    const helpResult = analyzeNodes(nodes, ALLOWLIST);
    // P272: label-catalog rules + the shared webapp-common catalog check run in
    // the same tripwire (one `pnpm check:help` covers the whole i18n surface).
    const labelResult = analyzeLabels(nodes);
    const sharedErrors = sharedCatalogViolations(readSharedCatalogs());
    return {
        ...helpResult,
        errors: helpResult.errors.concat(labelResult.errors, sharedErrors),
        labelMigrated: labelResult.labelMigrated,
        labelTransitional: labelResult.labelTransitional,
    };
}

function main() {
    const { errors, checked, allowlisted, transitional, migrated, labelMigrated, labelTransitional } = checkHelp();
    if (errors.length) {
        console.error("Node-help check FAILED:\n");
        for (const e of errors) console.error("  - " + e);
        console.error(
            `\n${errors.length} help/label violation(s) across ${checked} node(s) checked; ` +
                `${allowlisted} node(s) allowlisted.`
        );
        process.exit(1);
    }
    console.log(
        `Node-help OK: ${checked} ui-* node(s) checked — ${migrated} locale-migrated ` +
            `(en-US+de help, guide links resolve), ${transitional} transitional inline ` +
            `(rest-list, shrinking to 0 via P267-P271); ${allowlisted} allowlisted. ` +
            `Labels: ${labelMigrated} migrated (data-i18n + en-US/de catalogs, keys mirrored), ` +
            `${labelTransitional} transitional (LABEL_TRANSITION, shrinking to 0); ` +
            `shared webapp-common catalogs OK.`
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
    // P272 — label-catalog rules.
    labelViolation,
    analyzeLabels,
    sharedCatalogViolations,
    catalogKeyTree,
    LABEL_TRANSITION,
};

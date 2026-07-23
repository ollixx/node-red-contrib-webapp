import { execFileSync } from "node:child_process";
import path from "node:path";

import { describe, it, expect } from "vitest";

// The check script is plain CommonJS; require it for the pure-function assertions
// and invoke it as a child process for the end-to-end (exit-code) proof. Modelled
// on scripts/check-fields.test.ts — the core logic (`helpViolation` /
// `analyzeNodes`) is pure over an in-memory { type, help } list, so the per-rule
// pass/fail cases need no real tree and no shelling out. Rules (3)/(4) resolve a
// doc path on disk; the pure tests inject a `docExists` stub so they stay
// hermetic.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const check = require("./check-help.js");

const ROOT = path.resolve(__dirname, "..");
const SCRIPT = path.join(ROOT, "scripts", "check-help.js");

const LINK = (rel: string) =>
    `https://github.com/ollixx/node-red-contrib-webapp/blob/develop/${rel}`;

// A help block that links the node's own spec, resolvable per the stub below.
const okHelp = (type: string, cat = "display") =>
    `<p>Purpose.</p><p>Doku: <a href="${LINK(`docs/nodes/${cat}/${type}.md`)}" target="_blank">${type}.md</a></p>`;

// docExists stub: treat any `docs/nodes/**.md` we explicitly list as present.
const stubExists = (present: string[]) => (rel: string) => present.includes(rel);

describe("check-help inline-help doc-link tripwire", () => {
    it("is GREEN on the real tree (every ui-* node links its own resolvable spec)", () => {
        const { errors, checked, allowlisted } = check.checkHelp();
        expect(errors).toEqual([]);
        expect(checked).toBeGreaterThan(0);
        expect(allowlisted).toBe(0);
    });

    it("exits 0 when run as the CI tripwire", () => {
        expect(() => execFileSync(process.execPath, [SCRIPT], { cwd: ROOT })).not.toThrow();
    });

    it("passes a node whose help links its own resolvable spec", () => {
        const v = check.helpViolation(
            { type: "ui-table", help: okHelp("ui-table") },
            { docExists: stubExists(["docs/nodes/display/ui-table.md"]) }
        );
        expect(v).toBeNull();
    });

    // ---- Rule (1): help block present ---------------------------------------
    it("FAILS a node with no help block at all", () => {
        const v = check.helpViolation({ type: "ui-x", help: null }, {});
        expect(v.rule).toBe("no-help-block");
        const { errors } = check.analyzeNodes([{ type: "ui-x", help: null }], {}, {});
        expect(errors.length).toBe(1);
        expect(errors[0]).toContain("ui-x");
    });

    // ---- Rule (2): doc link present -----------------------------------------
    it("FAILS a help block with a purpose but no doc link", () => {
        const v = check.helpViolation(
            { type: "ui-x", help: "<p>Just a purpose, no link.</p>" },
            {}
        );
        expect(v.rule).toBe("no-doc-link");
    });

    it("does NOT accept a non-canonical (wrong org/branch) link as the doc link", () => {
        // The legacy `ollix/blob/master/...concepts/reactive-expressions.md` shape
        // must NOT satisfy the own-spec rule.
        const help = `<p>See <a href="https://github.com/ollix/node-red-contrib-webapp/blob/master/docs/nodes/concepts/reactive-expressions.md">x</a></p>`;
        const v = check.helpViolation({ type: "ui-text", help }, {});
        expect(v.rule).toBe("no-doc-link");
    });

    // ---- Rule (3): link resolves on disk ------------------------------------
    it("FAILS a canonical link whose doc does not exist on disk", () => {
        // Build the (deliberately non-existent) doc path from split literals so the
        // check:links Tier-2 scanner never sees a contiguous `docs/...md` path.
        const ghost = "docs/nodes/display/" + "ui-ghost.md";
        const v = check.helpViolation(
            { type: "ui-x", help: `<p><a href="${LINK(ghost)}">x</a></p>` },
            { docExists: stubExists([]) }
        );
        expect(v.rule).toBe("dangling-doc-link");
    });

    // ---- Rule (4): links its OWN spec ---------------------------------------
    it("FAILS a node that links a resolvable doc that is NOT its own spec", () => {
        // ui-divider.md is a REAL doc (so the link resolves) but not ui-table's spec.
        const help = `<p><a href="${LINK("docs/nodes/display/ui-divider.md")}">divider</a></p>`;
        const v = check.helpViolation(
            { type: "ui-table", help },
            { docExists: stubExists(["docs/nodes/display/ui-divider.md"]) }
        );
        expect(v.rule).toBe("not-own-spec");
    });

    it("accepts the component pair linking the shared ui-component concept doc", () => {
        const help = `<p><a href="${LINK("docs/nodes/structure/ui-component.md")}">component</a></p>`;
        const v = check.helpViolation(
            { type: "ui-component-instance", help },
            { docExists: stubExists(["docs/nodes/structure/ui-component.md"]) }
        );
        expect(v).toBeNull();
    });

    // ---- Allowlist ----------------------------------------------------------
    it("PASSES an allowlisted node even with no help block", () => {
        const { errors, allowlisted } = check.analyzeNodes(
            [{ type: "ui-x", help: null }],
            { "ui-x": "temporary exception" },
            {}
        );
        expect(errors).toEqual([]);
        expect(allowlisted).toBe(1);
    });

    // ---- extractHelpBlock ---------------------------------------------------
    it("extractHelpBlock returns the inner HTML for a matching type, null otherwise", () => {
        const src = `<script type="text/html" data-help-name="ui-foo"><p>Hi</p></script>`;
        expect(check.extractHelpBlock(src, "ui-foo")).toBe("<p>Hi</p>");
        expect(check.extractHelpBlock(src, "ui-bar")).toBeNull();
    });
});

// ---- P265 (ADR 0042): STRICT locale rules for migrated nodes ----------------

const localeHelp = (type: string, lang: "en-US" | "de", overrides?: { link?: string; inputs?: string }) => {
    const link =
        overrides?.link ??
        LINK(lang === "de" ? `docs/guide/de/nodes/${type}.md` : `docs/guide/nodes/${type}.md`);
    const inputs = overrides?.inputs ?? (lang === "de" ? "<h3>Eingang</h3><p>Keiner.</p>" : "<h3>Inputs</h3><p>None.</p>");
    return (
        `<script type="text/html" data-help-name="${type}">` +
        `<p>Purpose.</p>${inputs}<p><a href="${link}">docs</a></p></script>`
    );
};

const migratedOk = (type: string) => ({
    type,
    help: null,
    locales: { "en-US": localeHelp(type, "en-US"), de: localeHelp(type, "de") },
});

const guideDocs = (type: string) => [
    `docs/guide/nodes/${type}.md`,
    `docs/guide/de/nodes/${type}.md`,
];

describe("check-help locale rules (P265 — migrated nodes)", () => {
    it("the transition rest-list excludes every locale-migrated node (pilot + P267 backbone)", () => {
        const types = Object.keys(check.nodeHtmlPaths());
        const transitional = types.filter((t) => check.TRANSITION_INLINE[t]);
        // Migrated so far: the P265 pilot + the P267 backbone batch (11 nodes).
        const migrated = [
            "ui-divider",
            "ui-app", "ui-route", "ui-dialog",
            "ui-component-definition", "ui-component-instance",
            "ui-store", "ui-store-read", "ui-store-action",
            "ui-query", "ui-query-action", "ui-action",
        ];
        expect(transitional.length).toBe(types.length - migrated.length);
        for (const t of migrated) expect(check.TRANSITION_INLINE[t]).toBeUndefined();
    });

    it("passes a fully migrated node (en-US + de locale help, guide links resolve)", () => {
        const v = check.localeViolation(migratedOk("ui-divider"), {
            docExists: stubExists(guideDocs("ui-divider")),
        });
        expect(v).toBeNull();
    });

    it("FAILS a migrated node that still carries an inline help block", () => {
        const n = { ...migratedOk("ui-divider"), help: "<p>stale inline help</p>" };
        const v = check.localeViolation(n, { docExists: stubExists(guideDocs("ui-divider")) });
        expect(v.rule).toBe("inline-help-remains");
    });

    it("FAILS when the de locale help is missing (German is not optional)", () => {
        const n = migratedOk("ui-divider");
        n.locales.de = null as unknown as string;
        const v = check.localeViolation(n, { docExists: stubExists(guideDocs("ui-divider")) });
        expect(v.rule).toBe("missing-locale-help");
        expect(v.message).toContain("de");
    });

    it("FAILS a locale file without the data-help-name wrapper", () => {
        const n = migratedOk("ui-divider");
        n.locales["en-US"] = "<p>bare html, no script wrapper</p>";
        const v = check.localeViolation(n, { docExists: stubExists(guideDocs("ui-divider")) });
        expect(v.rule).toBe("locale-no-help-block");
    });

    it("FAILS a locale help without the mandatory Inputs section", () => {
        const n = migratedOk("ui-divider");
        n.locales["en-US"] = localeHelp("ui-divider", "en-US", { inputs: "" });
        const v = check.localeViolation(n, { docExists: stubExists(guideDocs("ui-divider")) });
        expect(v.rule).toBe("no-inputs-section");
    });

    it("FAILS an en-US help whose link targets the DE guide tree (language-correct links)", () => {
        const n = migratedOk("ui-divider");
        n.locales["en-US"] = localeHelp("ui-divider", "en-US", {
            link: LINK("docs/guide/de/nodes/ui-divider.md"),
        });
        const v = check.localeViolation(n, { docExists: stubExists(guideDocs("ui-divider")) });
        expect(v.rule).toBe("no-guide-link");
    });

    it("FAILS a guide link that does not resolve on disk", () => {
        const v = check.localeViolation(migratedOk("ui-divider"), { docExists: stubExists([]) });
        expect(v.rule).toBe("dangling-guide-link");
    });

    it("FAILS a help linking a resolvable guide doc that is not the node's own", () => {
        const n = migratedOk("ui-table");
        n.locales["en-US"] = localeHelp("ui-table", "en-US", {
            link: LINK("docs/guide/nodes/ui-divider.md"),
        });
        const v = check.localeViolation(n, {
            docExists: stubExists([...guideDocs("ui-divider"), ...guideDocs("ui-table")]),
        });
        expect(v.rule).toBe("not-own-guide");
    });

    it("analyzeNodes dispatches: transition list → inline rules, otherwise → locale rules", () => {
        const inlineNode = { type: "ui-old", help: okHelp("ui-old") };
        const { errors } = check.analyzeNodes(
            [inlineNode, migratedOk("ui-new")],
            {},
            {
                transition: { "ui-old": "pending" },
                // Split literal so the check:links Tier-2 scanner never sees a
                // contiguous docs path for this fictitious node (same idiom as
                // the "ghost" test above).
                docExists: stubExists([
                    "docs/nodes/display/" + "ui-old.md",
                    ...guideDocs("ui-new"),
                ]),
            }
        );
        expect(errors).toEqual([]);
        // Flip: the migrated node judged under inline rules would FAIL (no inline
        // block) — proving the dispatch is what makes it pass.
        const flipped = check.analyzeNodes([migratedOk("ui-new")], {}, {
            transition: { "ui-new": "pending" },
            docExists: stubExists(guideDocs("ui-new")),
        });
        expect(flipped.errors.length).toBe(1);
    });
});

/* ------------------------------------------------------------------ *
 * P272 — editor-LABEL i18n rules (labelViolation / analyzeLabels /
 * sharedCatalogViolations / catalogKeyTree). Pure over in-memory nodes.
 * ------------------------------------------------------------------ */

const labelCatalog = (type: string, labels: Record<string, string>) =>
    JSON.stringify({ [type]: { label: labels } });

const labelOk = (type: string) => ({
    type,
    html: `<script type="text/html" data-template-name="${type}"><label data-i18n="${type}.label.mount">Parent Slot</label></script>`,
    labelCatalogs: {
        "en-US": labelCatalog(type, { mount: "Parent Slot" }),
        de: labelCatalog(type, { mount: "Parent-Slot" }),
    },
});

describe("check-help label-catalog rules (P272 — editor-label i18n)", () => {
    it("the label transition rest-list excludes every migrated node (pilot + P267 backbone)", () => {
        const types = Object.keys(check.nodeHtmlPaths());
        const transitional = types.filter((t) => check.LABEL_TRANSITION[t]);
        const migrated = [
            "ui-divider",
            "ui-app", "ui-route", "ui-dialog",
            "ui-component-definition", "ui-component-instance",
            "ui-store", "ui-store-read", "ui-store-action",
            "ui-query", "ui-query-action", "ui-action",
        ];
        expect(transitional.length).toBe(types.length - migrated.length);
        for (const t of migrated) expect(check.LABEL_TRANSITION[t]).toBeUndefined();
    });

    it("catalogKeyTree fingerprints leaf key paths, sorted", () => {
        expect(check.catalogKeyTree({ a: { b: "x", c: "y" }, d: "z" })).toEqual(["a.b", "a.c", "d"]);
    });

    it("passes a migrated node with data-i18n labels + mirrored en-US/de catalogs", () => {
        expect(check.labelViolation(labelOk("ui-x"), { labelTransition: {} })).toBeNull();
    });

    it("passes an untouched legacy node while it is on LABEL_TRANSITION", () => {
        const n = { type: "ui-legacy", html: "<label>Titel</label>", labelCatalogs: { "en-US": null, de: null } };
        expect(check.labelViolation(n, { labelTransition: { "ui-legacy": "pending" } })).toBeNull();
    });

    it("FAILS a migrated node whose template has no data-i18n labels (LB1)", () => {
        const n = { ...labelOk("ui-x"), html: "<label>Titel</label>" };
        const v = check.labelViolation(n, { labelTransition: {} });
        expect(v?.rule).toBe("no-data-i18n-labels");
    });

    it("FAILS a data-i18n-using node without the de catalog — even on the transition list (LB2)", () => {
        const n = labelOk("ui-x");
        n.labelCatalogs.de = null as unknown as string;
        const v = check.labelViolation(n, { labelTransition: { "ui-x": "pending" } });
        expect(v?.rule).toBe("missing-label-catalog");
        expect(v?.message).toContain("de");
    });

    it("FAILS an unparseable catalog (LB3)", () => {
        const n = labelOk("ui-x");
        n.labelCatalogs["en-US"] = "{ not json";
        const v = check.labelViolation(n, { labelTransition: {} });
        expect(v?.rule).toBe("invalid-label-catalog");
    });

    it("FAILS a catalog missing the node's own top-level key (LB4)", () => {
        const n = labelOk("ui-x");
        n.labelCatalogs["en-US"] = JSON.stringify({ "ui-other": { label: { mount: "x" } } });
        const v = check.labelViolation(n, { labelTransition: {} });
        expect(v?.rule).toBe("label-catalog-wrong-root");
    });

    it("FAILS drifted key structures between en-US and de (LB5)", () => {
        const n = labelOk("ui-x");
        n.labelCatalogs.de = labelCatalog("ui-x", { mount: "Parent-Slot", extra: "Nur-DE" });
        const v = check.labelViolation(n, { labelTransition: {} });
        expect(v?.rule).toBe("label-catalog-key-drift");
        expect(v?.message).toContain("extra");
    });

    it("analyzeLabels aggregates violations and counts migrated vs transitional", () => {
        const result = check.analyzeLabels(
            [labelOk("ui-a"), { type: "ui-b", html: "", labelCatalogs: {} }],
            { labelTransition: { "ui-b": "pending" } }
        );
        expect(result.errors).toEqual([]);
        expect(result.labelMigrated).toBe(1);
        expect(result.labelTransitional).toBe(1);
    });

    it("sharedCatalogViolations: OK when both languages mirror; reports missing/drifted otherwise", () => {
        const en = JSON.stringify({ common: { picker: { clear: "Clear" } } });
        const de = JSON.stringify({ common: { picker: { clear: "Leeren" } } });
        expect(check.sharedCatalogViolations({ "en-US": en, de })).toEqual([]);

        const missing = check.sharedCatalogViolations({ "en-US": en, de: null });
        expect(missing.length).toBe(1);
        expect(missing[0]).toContain("de");

        const drifted = check.sharedCatalogViolations({
            "en-US": en,
            de: JSON.stringify({ common: { picker: { clear: "Leeren", extra: "x" } } }),
        });
        expect(drifted.length).toBe(1);
        expect(drifted[0]).toContain("drifted");
    });

    it("the real tree is GREEN including label + shared-catalog rules", () => {
        const { errors, labelMigrated, labelTransitional } = check.checkHelp();
        expect(errors).toEqual([]);
        expect(labelMigrated).toBeGreaterThanOrEqual(1);
        expect(labelMigrated + labelTransitional).toBe(Object.keys(check.nodeHtmlPaths()).length);
    });
});

import { expect, test } from "@playwright/test";

import { gotoEditor } from "../../../helpers/editor-ready";

/**
 * P232 — every `ui-*` node's inline help (the `data-help-name` block) ends with a
 * link to its FULL doc (`docs/nodes/<cat>/<node>.md`), like ui-divider / ui-alert.
 *
 * The disk-level guardrail is scripts/check-help.js (+ check-help.test.ts). THIS
 * spec is the browser proof the phase contract asks for: it drives the real
 * Node-RED editor and reads each node's help through Node-RED's OWN retrieval path
 * — `RED.nodes.getNodeHelp(type)`, the exact call that populates the info-sidebar
 * "Help" section and the palette popover. So we prove the sidebar actually renders
 * a working doc link, not just that the source file contains one.
 */

// Mirrors scripts/check-help.js EXPECTED_DOC: nodes with no own spec (the
// component pair) link the shared ui-component concept doc.
const EXPECTED_DOC: Record<string, string> = {
    "ui-component-definition": "ui-component.md",
    "ui-component-instance": "ui-component.md",
};

// P265 (ADR 0042): nodes whose help has moved to the Node-RED locale mechanism
// (`nodes/<cat>/locales/<lang>/<node>.html`). Their help links the USER guide
// doc (`docs/guide/nodes/<node>.md`) instead of the internal contract doc —
// the intent (a resolvable full-doc link in the rendered help) is unchanged.
// The batches P267–P271 move every node here; the transitional inline nodes
// keep the contract-doc link until migrated.
const LOCALE_MIGRATED = new Set<string>([
    "ui-datepicker",
    "ui-slider",
    "ui-switch",
    "ui-checkbox",
    "ui-radio",
    "ui-select",
    "ui-textarea",
    "ui-input",
    "ui-divider", "ui-app", "ui-route", "ui-dialog",
    "ui-component-definition", "ui-component-instance",
    "ui-store", "ui-store-read", "ui-store-action", "ui-query", "ui-query-action",
    "ui-action",
]);

// Every ui-* editor type (from package.json node-red.nodes). Kept explicit so a
// new node that forgets a help link fails HERE too, not only in the guardrail.
const UI_TYPES = [
    "ui-app", "ui-route", "ui-dialog", "ui-component-definition", "ui-component-instance",
    "ui-text", "ui-button", "ui-table", "ui-container", "ui-input", "ui-select",
    "ui-checkbox", "ui-radio", "ui-switch", "ui-textarea", "ui-datepicker", "ui-slider",
    "ui-alert", "ui-toast", "ui-progress", "ui-skeleton", "ui-badge", "ui-empty-state",
    "ui-tabs", "ui-tab", "ui-accordion", "ui-accordion-section", "ui-breadcrumb", "ui-menu",
    "ui-pagination", "ui-stepper", "ui-image", "ui-icon", "ui-list", "ui-avatar",
    "ui-divider", "ui-log", "ui-repeat", "ui-store", "ui-query", "ui-store-read",
    "ui-store-action", "ui-query-action", "ui-action",
    // P243 (ADR 0040): ui-navigation retired — navigation is a ui-action navigate.
] as const;

// Contract docs may share a spec basename (the component pair → ui-component.md),
// but the USER guide docs are per-type. A locale-migrated node therefore links
// its OWN guide doc (`<type>.md`); only transitional inline nodes fall back to
// the shared contract-doc basename in EXPECTED_DOC.
const expectedBasename = (type: string) =>
    LOCALE_MIGRATED.has(type) ? `${type}.md` : (EXPECTED_DOC[type] ?? `${type}.md`);

const CANONICAL_PREFIX =
    "https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/";
const GUIDE_PREFIX =
    "https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/guide/nodes/";

// The doc-link prefix a node's rendered help must carry: guide doc for
// locale-migrated nodes (P265), contract doc for the transitional inline rest.
const expectedPrefix = (type: string) =>
    LOCALE_MIGRATED.has(type) ? GUIDE_PREFIX : CANONICAL_PREFIX;

// Representative sample rendered through the FULL help path with anchor-attribute
// assertions (href + it is a real <a>). One per category + the special cases.
const SAMPLE = [
    "ui-divider",   // reference (display)
    "ui-table",     // display with fields
    "ui-app",       // structure
    "ui-action",    // behavior
    "ui-toast",     // feedback (terse)
    "ui-component-instance", // no own spec → concept doc
] as const;

test.describe("editor help — every node links its full doc (P232)", () => {
    test("all ui-* nodes expose a resolvable full-doc link via RED.nodes.getNodeHelp", async ({ page }) => {
        await gotoEditor(page, UI_TYPES);

        // Read the rendered help for every type in one page evaluation.
        const helpByType = await page.evaluate((types) => {
            const RED = (window as unknown as {
                RED: { nodes: { getNodeHelp: (t: string) => string } };
            }).RED;
            const out: Record<string, string> = {};
            for (const t of types) out[t] = RED.nodes.getNodeHelp(t) || "";
            return out;
        }, Array.from(UI_TYPES));

        const missing: string[] = [];
        for (const type of UI_TYPES) {
            const help = helpByType[type] ?? "";
            const wanted = expectedPrefix(type);
            // The rendered help must contain a canonical develop-blob docs link
            // whose basename is the node's own spec (or the concept doc for the
            // component pair; or the guide doc for locale-migrated nodes).
            const hasOwnSpecLink =
                help.includes(wanted) && help.includes(expectedBasename(type));
            if (!hasOwnSpecLink) missing.push(`${type} (expected ${expectedBasename(type)})`);
        }
        expect(missing, `nodes whose rendered help lacks their full-doc link: ${missing.join(", ")}`).toEqual([]);
    });

    for (const type of SAMPLE) {
        test(`${type} — help sidebar renders a working <a> to ${expectedBasename(type)}`, async ({ page }) => {
            await gotoEditor(page, UI_TYPES);

            // Render the node's help HTML into a detached container and inspect the
            // anchor Node-RED produced — this is exactly what the info sidebar shows.
            // A help block may legitimately carry MORE than one canonical doc
            // link (e.g. ui-app links the auth concept doc since P260 AND its
            // own spec) — find the anchor for the node's OWN doc, not just the
            // first doc-prefixed anchor.
            const link = await page.evaluate(({ t, basename, prefix }) => {
                const RED = (window as unknown as {
                    RED: { nodes: { getNodeHelp: (t: string) => string } };
                }).RED;
                const html = RED.nodes.getNodeHelp(t) || "";
                const el = document.createElement("div");
                el.innerHTML = html;
                const anchors = Array.from(el.querySelectorAll("a")) as HTMLAnchorElement[];
                const docAnchor = anchors.find((a) => {
                    const href = a.getAttribute("href") || "";
                    return href.startsWith(prefix) && href.includes(basename);
                });
                return docAnchor
                    ? { href: docAnchor.getAttribute("href"), text: docAnchor.textContent }
                    : null;
            }, { t: type, basename: expectedBasename(type), prefix: expectedPrefix(type) });

            expect(link, `${type}: no rendered doc anchor in help`).not.toBeNull();
            expect(link!.href).toContain(expectedPrefix(type));
            expect(link!.href).toContain(expectedBasename(type));
        });
    }
});

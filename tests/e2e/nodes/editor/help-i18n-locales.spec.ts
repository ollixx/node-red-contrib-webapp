import { expect, test } from "@playwright/test";

import { gotoEditor } from "../../../helpers/editor-ready";

/**
 * P265 (ADR 0042) — the Node-RED per-node locale help mechanic, PROVEN on the
 * pilot node `ui-divider`.
 *
 * Mechanic (measured against node-red 4.0.5):
 *   - Help files live at `nodes/<cat>/locales/<lang>/<node>.html`, next to the
 *     registered `.js` (`@node-red/registry/lib/loader.js` → loadNodeHelp:
 *     `path.dirname(node.template) + /locales/<lang>/<basename>`). Each file
 *     contains the FULL `<script type="text/html" data-help-name="...">` block.
 *   - The editor requests `GET /nodes` (text/html) with
 *     `Accept-Language: localStorage["editor-language"] || detected browser
 *     language` — i.e. the editor's own language setting (User Settings →
 *     View → Language) drives which locale help the runtime appends.
 *   - Fallback chain (registry loader getNodeHelp): exact lang (`de-DE`) →
 *     lang prefix (`de`) → `i18n.defaultLang` (`en-US`).
 *   - The inline `data-help-name` block is REMOVED from ui-divider.html; the
 *     help the info sidebar renders (via `RED.nodes.getNodeHelp`) comes
 *     exclusively from the locale files.
 *
 * This spec measures all of it in the real editor: English under en-US
 * (default + explicit), German under `de` (editor language switched via the
 * exact storage key the editor reads), and the fallback for an unknown
 * language. It also proves the doc link now targets the guide tree
 * (docs/guide/nodes/ui-divider.md — ADR 0042 §2).
 */

const EN_MARKER = "Renders a visual divider line";
const DE_MARKER = "Rendert eine visuelle Trennlinie";
const EN_GUIDE_LINK =
    "https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/guide/nodes/ui-divider.md";
const DE_GUIDE_LINK =
    "https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/guide/de/nodes/ui-divider.md";

async function renderedHelp(page: import("@playwright/test").Page): Promise<string> {
    await gotoEditor(page, ["ui-divider"]);
    return page.evaluate(() => {
        const RED = (window as unknown as {
            RED: { nodes: { getNodeHelp: (t: string) => string } };
        }).RED;
        return RED.nodes.getNodeHelp("ui-divider") || "";
    });
}

test.describe("ui-divider locale help (P265 i18n pilot)", () => {
    test("default editor language (en-US browser) renders the ENGLISH locale help", async ({ page }) => {
        const help = await renderedHelp(page);
        expect(help).toContain(EN_MARKER);
        expect(help).not.toContain(DE_MARKER);
        expect(help).toContain(EN_GUIDE_LINK);
        // The mandatory Inputs section of the help template is present.
        expect(help).toContain("no input port");
    });

    test("editor language en-US (explicit setting) renders the ENGLISH locale help", async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem("editor-language", "en-US"));
        const help = await renderedHelp(page);
        expect(help).toContain(EN_MARKER);
        expect(help).not.toContain(DE_MARKER);
    });

    test("editor language de renders the GERMAN locale help with the de guide link", async ({ page }) => {
        // The exact mechanism of the editor's language setting: the User
        // Settings language dropdown persists to localStorage["editor-language"],
        // which the editor sends as Accept-Language on GET /nodes.
        await page.addInitScript(() => localStorage.setItem("editor-language", "de"));
        const help = await renderedHelp(page);
        expect(help).toContain(DE_MARKER);
        expect(help).not.toContain(EN_MARKER);
        expect(help).toContain(DE_GUIDE_LINK);
        expect(help).toContain("keinen Eingangs-Port");
    });

    test("editor language de-DE falls back to the `de` locale file (lang-prefix fallback)", async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem("editor-language", "de-DE"));
        const help = await renderedHelp(page);
        expect(help).toContain(DE_MARKER);
    });

    test("unknown editor language falls back to en-US (defaultLang fallback)", async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem("editor-language", "fr"));
        const help = await renderedHelp(page);
        expect(help).toContain(EN_MARKER);
    });

    test("the info-sidebar help renders a working <a> to the guide doc (en + de)", async ({ page }) => {
        for (const [lang, wanted] of [["en-US", EN_GUIDE_LINK], ["de", DE_GUIDE_LINK]] as const) {
            // addInitScript entries accumulate and run in order — the LAST
            // registered language wins, so re-registering per iteration is safe.
            await page.addInitScript((l) => localStorage.setItem("editor-language", l), lang);
            await gotoEditor(page, ["ui-divider"]);
            const href = await page.evaluate(() => {
                const RED = (window as unknown as {
                    RED: { nodes: { getNodeHelp: (t: string) => string } };
                }).RED;
                const el = document.createElement("div");
                el.innerHTML = RED.nodes.getNodeHelp("ui-divider") || "";
                const a = Array.from(el.querySelectorAll("a")).find((x) =>
                    (x.getAttribute("href") || "").includes("/blob/develop/docs/guide/")
                );
                return a ? a.getAttribute("href") : null;
            });
            expect(href, `lang=${lang}`).toBe(wanted);
        }
    });
});

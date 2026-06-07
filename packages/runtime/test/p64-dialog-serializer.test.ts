import { describe, expect, it } from "vitest";

/**
 * P64 — dialogs render as a native Shoelace <sl-dialog>. The serializer emits
 * the native element with `open` and `label`, drops the bespoke chrome
 * (.webapp-dialog-card / hard-coded Close link), maps each dialog-layout region
 * onto the matching native slot, and honours `closable` via `no-header`.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const serializer = require("../../../resources/lib/webapp-serializer.js") as {
    renderDialogHtml: (dialog: unknown, ctx: unknown) => string;
    getLayoutVariant: (layoutId: string) => string;
};

function dialog(overrides: Record<string, unknown> = {}): unknown {
    return {
        id: "customerEditor",
        title: "Edit customer",
        modal: true,
        closable: true,
        open: true,
        layoutId: "dialog",
        regions: [
            { kind: "region", name: "header", title: undefined, components: [], regions: [] },
            { kind: "region", name: "header-actions", title: undefined, components: [], regions: [] },
            {
                kind: "region",
                name: "content",
                title: undefined,
                components: [
                    { kind: "text", id: "bodyText", text: "Body", props: {}, events: [] }
                ],
                regions: []
            },
            {
                kind: "region",
                name: "footer",
                title: undefined,
                components: [
                    { kind: "button", id: "saveBtn", label: "Save", props: {}, events: [] }
                ],
                regions: []
            }
        ],
        ...overrides
    };
}

describe("P64: native sl-dialog serialization", () => {
    it("renders a native <sl-dialog open label> element, not the old sl-card chrome", () => {
        const html = serializer.renderDialogHtml(dialog(), { appId: "app1", params: {} });

        expect(html).toContain("<sl-dialog");
        expect(html).toContain(" open");
        expect(html).toContain('label="Edit customer"');
        // Bespoke chrome / hard-coded Close link are gone.
        expect(html).not.toContain("webapp-dialog-card");
        expect(html).not.toContain("webapp-dialog-head");
        expect(html).not.toContain(">Close<");
    });

    it("tags the dialog with data-webapp-dialog = its node id (client dismissal hook)", () => {
        const html = serializer.renderDialogHtml(dialog(), { appId: "app1", params: {} });
        expect(html).toContain('data-webapp-dialog="customerEditor"');
    });

    it("maps dialog-layout regions onto the native slots (label / header-actions / footer; content → default)", () => {
        const html = serializer.renderDialogHtml(dialog(), { appId: "app1", params: {} });
        expect(html).toContain('slot="label"');
        expect(html).toContain('slot="header-actions"');
        expect(html).toContain('slot="footer"');
        // The content region lands in the default (body) slot — no slot attribute
        // on its wrapper. The body text must be present and not slotted.
        expect(html).toContain("Body");
        // The footer button's region carries slot="footer"; the body region does not.
        const contentWrapper = html.match(/<div class="webapp-dialog-region webapp-dialog-region--content"[^>]*>/);
        expect(contentWrapper).not.toBeNull();
        expect(contentWrapper && contentWrapper[0]).not.toContain("slot=");
    });

    it("emits no-header when closable is false (removes native X + title)", () => {
        const html = serializer.renderDialogHtml(dialog({ closable: false }), { appId: "app1", params: {} });
        expect(html).toContain("no-header");
    });

    it("does NOT emit no-header when closable is true (default)", () => {
        const html = serializer.renderDialogHtml(dialog({ closable: true }), { appId: "app1", params: {} });
        expect(html).not.toContain("no-header");
    });

    it("recognises 'dialog' as a known layout variant", () => {
        expect(serializer.getLayoutVariant("dialog")).toBe("dialog");
    });
});

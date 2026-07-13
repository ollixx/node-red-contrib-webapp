import { describe, expect, it } from "vitest";

/**
 * P221 (ADR 0035) — ui-text read-only FORM-FIELD presentation mode.
 *
 * The serializer is the single SSR render source (render-parity, P26). These
 * tests assert the observable rendered markup for the new `display: "formField"`
 * mode against the historic free-text default. Each assertion turns RED if the
 * feature is removed (mutation rule, node-testing.md).
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const serializer = require("../../../resources/lib/webapp-serializer.js") as {
    renderComponentHtml: (component: unknown, layoutId: string, ctx: unknown) => string;
};

const ctx = { appId: "app1", location: "/" };

function renderText(component: Record<string, unknown>): string {
    return serializer.renderComponentHtml(
        { kind: "text", id: "t1", ...component },
        "vertical",
        ctx
    );
}

describe("P221: ui-text form-field mode renders a read-only labelled row", () => {
    it("formField mode renders an <sl-input readonly> (control optics), not a <p>", () => {
        const html = renderText({ text: "abc-123", props: { display: "formField", label: "ID" } });
        expect(html).toContain("<sl-input");
        expect(html).toContain("readonly");
        // NOT the free-text element.
        expect(html).not.toContain("<p ");
        expect(html).not.toContain("webapp-text--body");
    });

    it("formField mode puts the label into the sl-input label slot and the bound value into value", () => {
        const html = renderText({ text: "abc-123", props: { display: "formField", label: "Entity ID" } });
        expect(html).toContain('label="Entity ID"');
        expect(html).toContain('value="abc-123"');
    });

    it("formField mode is read-only — no name, no event/source attrs → no emission", () => {
        const html = renderText({ text: "abc-123", props: { display: "formField", label: "ID" } });
        expect(html).not.toContain("name=");
        expect(html).not.toContain("data-webapp-source");
        expect(html).not.toContain("data-webapp-event");
    });

    it("empty bound value renders an empty value cell, never '?' (ADR 0032)", () => {
        // component.text is "" — the renderer already normalised a missing store
        // key to empty (ADR 0032). The form-field row must keep it empty.
        const html = renderText({ text: "", props: { display: "formField", label: "ID" } });
        expect(html).toContain('value=""');
        expect(html).not.toContain("?");
        // The label stays visible even with an empty value.
        expect(html).toContain('label="ID"');
    });

    it("HTML-escapes the label and value (no attribute injection)", () => {
        const html = renderText({ text: '"><x', props: { display: "formField", label: '"><y' } });
        expect(html).not.toContain('"><x');
        expect(html).not.toContain('"><y');
    });
});

describe("P221: the default free-text presentation is unchanged", () => {
    it("no display prop → historic <p class=webapp-text> free text, not an sl-input", () => {
        const html = renderText({ text: "Hello", props: { style: "body" } });
        expect(html).toContain("<p");
        expect(html).toContain("webapp-text");
        expect(html).toContain("Hello");
        expect(html).not.toContain("<sl-input");
        expect(html).not.toContain("readonly");
    });

    it('display: "text" is treated as the free-text default', () => {
        const html = renderText({ text: "Hello", props: { display: "text", style: "heading-2" } });
        expect(html).toContain("<h2");
        expect(html).toContain("webapp-text--heading-2");
        expect(html).not.toContain("<sl-input");
    });
});

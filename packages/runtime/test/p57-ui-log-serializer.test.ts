import { describe, expect, it } from "vitest";

/**
 * P57 — ui-log serializer rendering tests.
 * Verifies that renderComponentHtml("log") produces the expected HTML structure:
 *   - an sl-details element with data-webapp-log attribute
 *   - the min-severity and max-entries data attributes
 *   - "open" attribute is present by default (not collapsed)
 *   - collapsed mode emits open=""
 *   - an empty .webapp-log-entries list
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const serializer = require("../../../resources/lib/webapp-serializer.js") as {
    renderComponentHtml: (component: unknown, layoutId: string, ctx: unknown) => string;
};

describe("P57: ui-log serializer rendering", () => {
    const baseComponent = {
        id: "logNode1",
        kind: "log",
        mount: "app:myApp/content",
        order: undefined,
        bind: {},
        props: {
            minSeverity: "warn",
            maxEntries: 100,
            collapsed: false
        },
        events: []
    };

    it("renders an sl-details element with data-webapp-log", () => {
        const html = serializer.renderComponentHtml(baseComponent, "layout1", {});
        expect(html).toContain("data-webapp-log=\"logNode1\"");
        expect(html).toContain("<sl-details");
    });

    it("carries min-severity and max-entries data attributes", () => {
        const html = serializer.renderComponentHtml(baseComponent, "layout1", {});
        expect(html).toContain("data-log-min-severity=\"warn\"");
        expect(html).toContain("data-log-max-entries=\"100\"");
    });

    it("has an empty .webapp-log-entries list", () => {
        const html = serializer.renderComponentHtml(baseComponent, "layout1", {});
        expect(html).toContain("<ul class=\"webapp-log-entries\"></ul>");
    });

    it("is open (not collapsed) by default", () => {
        const html = serializer.renderComponentHtml(baseComponent, "layout1", {});
        // Non-collapsed: the sl-details has the `open` attribute (expanded by default).
        expect(html).toContain(" open");
        // Should NOT have open="" (that would be the collapsed placeholder)
        expect(html).not.toMatch(/open=""/);
    });

    it("starts collapsed when collapsed=true — no `open` attribute in markup", () => {
        const collapsed = {
            ...baseComponent,
            props: { ...baseComponent.props, collapsed: true }
        };
        const html = serializer.renderComponentHtml(collapsed, "layout1", {});
        // Shoelace sl-details: presence of `open` attribute = expanded, absence = collapsed.
        // collapsed=true → the `open` attribute must be absent from the markup.
        expect(html).not.toContain(" open");
    });

    it("applies the webapp-log css class", () => {
        const html = serializer.renderComponentHtml(baseComponent, "layout1", {});
        expect(html).toContain("class=\"webapp-log\"");
    });
});

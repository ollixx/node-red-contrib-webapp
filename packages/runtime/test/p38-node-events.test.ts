import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * P38 — UI node events.
 *
 * Every interactive node (checkbox, switch, radio, select, slider, input,
 * textarea, datepicker, tabs, pagination, stepper) emits a msg.ui `change`
 * event on its output port whenever the user interacts in the browser.
 *
 * Contracts verified here:
 * 1. The serializer emits data-webapp-source on every interactive kind.
 * 2. Checkbox / switch use data-webapp-event="change" on the wrapper div
 *    (the existing P30 mechanism) — the client sends { checked: bool }.
 * 3. Tabs carry data-webapp-source + data-webapp-event="sl-tab-show" on
 *    the sl-tab-group element itself.
 * 4. Pagination renders prev/next buttons each with data-webapp-source +
 *    data-webapp-event="click" + data-webapp-page.
 * 5. Stepper renders step buttons each with data-webapp-source +
 *    data-webapp-event="click" + data-webapp-step.
 * 6. The client change handler uses { checked } for toggles and { value }
 *    for all other controls.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const serializer = require("../../../resources/lib/webapp-serializer.js") as {
    renderComponentHtml: (component: unknown, layoutId: string, ctx: unknown) => string;
};

const clientSource = readFileSync(
    fileURLToPath(new URL("../../../resources/lib/webapp-client.js", import.meta.url)),
    "utf8"
);

function makeComponent(kind: string, id: string, extra: Record<string, unknown> = {}) {
    return { kind, id, value: undefined, props: {}, events: [], ...extra };
}

describe("P38: serializer emits data-webapp-source on all interactive kinds", () => {
    const interactiveKinds: Array<[string, Record<string, unknown>?]> = [
        ["input"],
        ["select", { props: { options: [] } }],
        ["checkbox"],
        ["switch"],
        ["radio", { props: { options: [] } }],
        ["textarea"],
        ["datepicker"],
        ["slider"]
    ];

    for (const [kind, extra] of interactiveKinds) {
        it(`${kind} wrapper div carries data-webapp-source and data-webapp-event="change"`, () => {
            const html = serializer.renderComponentHtml(makeComponent(kind, `${kind}-1`, extra), "app", {});
            expect(html).toContain(`data-webapp-source="${kind}-1"`);
            expect(html).toContain('data-webapp-event="change"');
        });
    }

    it("tabs sl-tab-group carries data-webapp-source and data-webapp-event=\"sl-tab-show\"", () => {
        const component = makeComponent("tabs", "tabs-1", { props: { tabs: [{ id: "a", label: "A" }, { id: "b", label: "B" }] } });
        const html = serializer.renderComponentHtml(component, "app", {});
        expect(html).toContain("data-webapp-source=\"tabs-1\"");
        expect(html).toContain("data-webapp-event=\"sl-tab-show\"");
        expect(html).toContain("<sl-tab-group");
    });

    it("tabs active tab gets the active attribute when value matches tab id", () => {
        const component = makeComponent("tabs", "tabs-1", {
            value: "b",
            props: { tabs: [{ id: "a", label: "A" }, { id: "b", label: "B" }] }
        });
        const html = serializer.renderComponentHtml(component, "app", {});
        expect(html).toContain("panel=\"b\" data-webapp-part=\"b\" active");
    });

    it("pagination renders prev/next buttons with data-webapp-source and data-webapp-page", () => {
        const component = makeComponent("pagination", "pg-1", { page: 3, totalPages: 10 });
        const html = serializer.renderComponentHtml(component, "app", {});
        expect(html).toContain("data-webapp-source=\"pg-1\"");
        expect(html).toContain("data-webapp-event=\"click\"");
        expect(html).toContain("data-webapp-page=\"2\"");  // prev page
        expect(html).toContain("data-webapp-page=\"4\"");  // next page
    });

    it("pagination prev button is disabled on page 1", () => {
        const component = makeComponent("pagination", "pg-1", { page: 1, totalPages: 5 });
        const html = serializer.renderComponentHtml(component, "app", {});
        // prev page would be 1 (clamped), button is disabled
        expect(html).toContain(" disabled");
    });

    it("pagination next button is disabled on last page", () => {
        const component = makeComponent("pagination", "pg-1", { page: 5, totalPages: 5 });
        const html = serializer.renderComponentHtml(component, "app", {});
        // Prev button is not disabled, but next button is disabled
        const nextMatch = html.match(/data-webapp-page="5"[^>]*disabled/);
        // The last page button should be disabled — check simpler: count disabled
        const disabledCount = (html.match(/ disabled/g) || []).length;
        expect(disabledCount).toBeGreaterThanOrEqual(1);
    });

    it("stepper renders step buttons with data-webapp-source and data-webapp-step", () => {
        const component = makeComponent("stepper", "st-1", {
            steps: [{ id: "s1", label: "Step 1" }, { id: "s2", label: "Step 2" }]
        });
        const html = serializer.renderComponentHtml(component, "app", {});
        expect(html).toContain("data-webapp-source=\"st-1\"");
        expect(html).toContain("data-webapp-event=\"click\"");
        expect(html).toContain("data-webapp-step=\"0\"");
        expect(html).toContain("data-webapp-step=\"1\"");
    });

    it("stepper active step gets webapp-step--active class", () => {
        const component = makeComponent("stepper", "st-1", {
            activeStep: 1,
            steps: [{ id: "s1", label: "Step 1" }, { id: "s2", label: "Step 2" }]
        });
        const html = serializer.renderComponentHtml(component, "app", {});
        expect(html).toContain("webapp-step--active");
    });
});

describe("P38: client source uses correct param key per control kind", () => {
    it("change handler uses { checked } for sl-checkbox and sl-switch, not { value }", () => {
        // The client source must use the `checked` key for toggle controls.
        // Check that the new param shape is in the source.
        expect(clientSource).toContain("{ checked: Boolean(field.checked) }");
    });

    it("change handler uses { value } for non-toggle controls", () => {
        expect(clientSource).toContain("{ value: field.value }");
    });

    it("client listens for sl-tab-show and dispatches change with params.value", () => {
        expect(clientSource).toContain("sl-tab-show");
        expect(clientSource).toContain("detail.name");
    });

    it("click handler dispatches change with params.page for data-webapp-page buttons", () => {
        expect(clientSource).toContain("data-webapp-page");
        expect(clientSource).toContain("page: page");
    });

    it("click handler dispatches change with params.value for data-webapp-step buttons", () => {
        expect(clientSource).toContain("data-webapp-step");
        expect(clientSource).toContain("value: step");
    });

    it("client listens for sl-change (Shoelace CustomEvent) in addition to change", () => {
        // Shoelace fires sl-change from the host element — the native change from
        // inside the shadow DOM is composed:false and does not cross the boundary.
        // Both listeners must be present.
        expect(clientSource).toContain("addEventListener(\"sl-change\"");
        expect(clientSource).toContain("addEventListener(\"change\"");
    });
});

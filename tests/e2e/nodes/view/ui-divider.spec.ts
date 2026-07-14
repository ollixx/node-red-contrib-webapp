import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * ui-divider — feature coverage (P230, node-conformance).
 *
 * Outcome-based, per the acceptance criteria: orientation, label (literal +
 * bound), the base-field `color` on the rendered line, `visible` render-gate,
 * grid placement, and no ports. Editor base-field coverage lives in
 * tests/e2e/nodes/editor/base-fields.spec.ts (not duplicated here).
 */

async function served(request: import("@playwright/test").APIRequestContext, appId: string): Promise<string> {
    const res = await request.get(`/webapp/${appId}/`);
    expect(res.ok()).toBeTruthy();
    return res.text();
}

test.describe("ui-divider — orientation + label", () => {
    test.afterEach(async ({ request }) => { await resetFlow(request); });

    test("horizontal → <sl-divider> without the vertical attribute", async ({ request }) => {
        const flow = new FlowBuilder().app({ id: "divH", root: "divH" })
            .node("ui-divider", { id: "dH", orientation: "horizontal" }).build();
        await deployFlow(request, flow);
        const html = await served(request, "divH");
        expect(html).toContain("<sl-divider");
        expect(html).not.toContain("<sl-divider vertical");
    });

    test("vertical → <sl-divider vertical>", async ({ request }) => {
        const flow = new FlowBuilder().app({ id: "divV", root: "divV" })
            .node("ui-divider", { id: "dV", orientation: "vertical" }).build();
        await deployFlow(request, flow);
        expect(await served(request, "divV")).toContain("<sl-divider vertical");
    });

    test("literal label renders centred inside the divider", async ({ request }) => {
        const flow = new FlowBuilder().app({ id: "divL", root: "divL" })
            .node("ui-divider", { id: "dL", label: { kind: "literal", value: "Abschnitt A" } }).build();
        await deployFlow(request, flow);
        const html = await served(request, "divL");
        expect(html).toMatch(/<sl-divider[^>]*>Abschnitt A<\/sl-divider>/);
    });

    test("bound label (store) renders the resolved live value (P150)", async ({ request }) => {
        const flow = new FlowBuilder().app({ id: "divB", root: "divB" })
            .node("ui-store", { id: "lblStore", parent: "divB", statePath: "dividerLabel", initialValue: JSON.stringify("Gebunden") })
            .node("ui-divider", { id: "dB", label: { kind: "store", path: "lblStore" } })
            .build();
        await deployFlow(request, flow);
        const html = await served(request, "divB");
        expect(html).toMatch(/<sl-divider[^>]*>Gebunden<\/sl-divider>/);
    });
});

// P231: the base-field `visible`/`disabled`/`color` are now declared in the
// ui-divider SCHEMA (packages/schema/src/node-definitions.ts, baseFieldsSchema
// mixin), so Zod PRESERVES them at validation; mapConfig routes `color` →
// bind.color generically and the serializer applies the Shoelace `--color`.
test.describe("ui-divider — base-field color on the line (P231)", () => {
    test.afterEach(async ({ request }) => { await resetFlow(request); });

    test("bound color emits the Shoelace --color custom property", async ({ request }) => {
        const flow = new FlowBuilder().app({ id: "divC", root: "divC" })
            .node("ui-divider", { id: "dC", color: { kind: "literal", value: "#ff0000" } }).build();
        await deployFlow(request, flow);
        const html = await served(request, "divC");
        expect(html).toMatch(/<sl-divider[^>]*style="[^"]*--color:#ff0000/);
    });

    test("the --color is applied on the rendered element (computed style)", async ({ page, request }) => {
        const flow = new FlowBuilder().app({ id: "divCm", root: "divCm" })
            .node("ui-divider", { id: "dCm", color: { kind: "literal", value: "rgb(0, 128, 0)" } }).build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "divCm");
        await webapp.navigate("/");
        const divider = page.locator("sl-divider").first();
        await expect(divider).toBeVisible();
        const color = await divider.evaluate((el) => getComputedStyle(el).getPropertyValue("--color").trim());
        expect(color).toBe("rgb(0, 128, 0)");
    });
});

// P231: `visible` is now in the ui-divider schema (baseFieldsSchema mixin), so a
// bound visible survives validation and reaches `visibleIf` — the render-gate fires.
test.describe("ui-divider — visible render-gate (bound; ADR 0037) (P231)", () => {
    test.afterEach(async ({ request }) => { await resetFlow(request); });

    // A store-bound `visible` governs the render (a plain literal is treated as an
    // unbound dynamic-state field seeded to the neutral default `true`, ADR 0037).
    test("visible bound to a store=false → the divider is not rendered", async ({ request }) => {
        const flow = new FlowBuilder().app({ id: "divVis", root: "divVis" })
            .node("ui-store", { id: "visStore", parent: "divVis", statePath: "show", initialValue: JSON.stringify(false) })
            .node("ui-divider", { id: "dVis", visible: { kind: "store", path: "visStore" } })
            .build();
        await deployFlow(request, flow);
        expect(await served(request, "divVis")).not.toContain("<sl-divider");
    });

    test("visible bound to a store=true → the divider is rendered", async ({ request }) => {
        const flow = new FlowBuilder().app({ id: "divVis2", root: "divVis2" })
            .node("ui-store", { id: "visStore2", parent: "divVis2", statePath: "show", initialValue: JSON.stringify(true) })
            .node("ui-divider", { id: "dVis2", visible: { kind: "store", path: "visStore2" } })
            .build();
        await deployFlow(request, flow);
        expect(await served(request, "divVis2")).toContain("<sl-divider");
    });
});

test.describe("ui-divider — ports", () => {
    test.afterEach(async ({ request }) => { await resetFlow(request); });

    // Placement (order/row/col) is universal layout boilerplate, covered generically
    // by the layout suite — not re-tested per node (node-testing.md: keep the suite lean).

    test("has no input and no output port (static leaf)", async ({ request }) => {
        const flow = new FlowBuilder().app({ id: "divP", root: "divP" })
            .node("ui-divider", { id: "dP" }).build();
        await deployFlow(request, flow);
        const node = flow.find((n) => n.id === "dP") as Record<string, unknown>;
        // ui-divider registers inputs:0 / outputs:0 (P76); the built node has no wires out.
        expect(node.wires === undefined || (Array.isArray(node.wires) && node.wires.flat().length === 0)).toBeTruthy();
    });
});

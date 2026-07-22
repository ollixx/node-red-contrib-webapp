import { expect, test } from "@playwright/test";

import { deployFlow, injectMessage, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * ui-progress — feature coverage (P234, node-conformance).
 *
 * Fresh per .ai/agents/node-testing.md (the old P43 presence tests are discarded).
 * Every assertion derives from the serializer's progress path
 * (resources/lib/webapp-serializer.js): displayType bar/spinner/circular,
 * indeterminate when the value is missing, showValue percentage relative to `max`,
 * `max` scaling, base-field `color`/`visible`, and the msg.payload input.
 *
 * Expected render forms (DERIVED from the serializer, P234):
 *   bar (determinate)   → <sl-progress-bar value="<pct>"> …slot… </sl-progress-bar>
 *   bar (no value)      → <sl-progress-bar indeterminate>              (no value attr)
 *   spinner             → <sl-spinner>                                (always, no value)
 *   circular            → <sl-progress-ring value="<pct>"> …slot… </sl-progress-ring>
 *   circular (no value) → <sl-spinner>              (ring has no indeterminate mode)
 * where pct = round(value / max * 100), clamped 0..100 (max defaults to 100).
 */

async function served(request: import("@playwright/test").APIRequestContext, appId: string): Promise<string> {
    const res = await request.get(`/webapp/${appId}/`);
    expect(res.ok()).toBeTruthy();
    return res.text();
}

test.describe("ui-progress — displayType", () => {
    test.afterEach(async ({ request }) => { await resetFlow(request); });

    test("bar (default) → <sl-progress-bar> with the scaled value", async ({ request }) => {
        const flow = new FlowBuilder().app({ id: "prgBar", root: "prgBar" })
            .node("ui-progress", { id: "pBar", value: { kind: "literal", value: 75 } }).build();
        await deployFlow(request, flow);
        const html = await served(request, "prgBar");
        // max defaults to 100 → 75/100 = 75 %.
        expect(html).toMatch(/<sl-progress-bar[^>]*\svalue="75"/);
        expect(html).not.toContain("<sl-spinner");
    });

    test("spinner → <sl-spinner> (indeterminate, no value bar)", async ({ request }) => {
        const flow = new FlowBuilder().app({ id: "prgSpin", root: "prgSpin" })
            // A value is set but a spinner has no percentage → it is ignored.
            .node("ui-progress", { id: "pSpin", displayType: "spinner", value: { kind: "literal", value: 60 } }).build();
        await deployFlow(request, flow);
        const html = await served(request, "prgSpin");
        expect(html).toContain("<sl-spinner");
        expect(html).not.toContain("<sl-progress-bar");
    });

    test("circular → <sl-progress-ring> with the scaled value", async ({ request }) => {
        const flow = new FlowBuilder().app({ id: "prgCirc", root: "prgCirc" })
            .node("ui-progress", { id: "pCirc", displayType: "circular", value: { kind: "literal", value: 40 } }).build();
        await deployFlow(request, flow);
        const html = await served(request, "prgCirc");
        expect(html).toMatch(/<sl-progress-ring[^>]*\svalue="40"/);
    });

    test("circular with no value → <sl-spinner> (ring has no indeterminate mode)", async ({ request }) => {
        const flow = new FlowBuilder().app({ id: "prgCircInd", root: "prgCircInd" })
            .node("ui-progress", { id: "pCircInd", displayType: "circular" }).build();
        await deployFlow(request, flow);
        const html = await served(request, "prgCircInd");
        expect(html).toContain("<sl-spinner");
        expect(html).not.toContain("<sl-progress-ring");
    });
});

test.describe("ui-progress — value", () => {
    test.afterEach(async ({ request }) => { await resetFlow(request); });

    test("literal value → sl-progress-bar[value=75]", async ({ page, request }) => {
        const flow = new FlowBuilder().app({ id: "prgVal", root: "prgVal" })
            .node("ui-progress", { id: "pVal", value: { kind: "literal", value: 75 } }).build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "prgVal");
        await webapp.navigate("/");
        await expect(page.locator("sl-progress-bar")).toHaveAttribute("value", "75");
    });

    test("store-bound value renders live and updates via SSE", async ({ page, request }) => {
        const flow = new FlowBuilder().app({ id: "prgStore", root: "prgStore" })
            .node("ui-store", { id: "prgStoreNode", app: "prgStore", statePath: "pct", initialValue: JSON.stringify(30) })
            .node("ui-progress", { id: "pStore", value: { kind: "store", path: "prgStoreNode" } })
            .withStoreInject("prgStoreInj", "prgStoreNode", 80)
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "prgStore");
        await webapp.navigate("/");
        // Initial store value 30 → 30 %.
        await expect(page.locator("sl-progress-bar")).toHaveAttribute("value", "30");
        // Replace the store with 80 → SSE re-render → 80 %.
        await injectMessage(request, "prgStoreInj");
        await expect(page.locator("sl-progress-bar")).toHaveAttribute("value", "80", { timeout: 5000 });
    });

    test("missing value → indeterminate bar (NOT value 0)", async ({ request }) => {
        const flow = new FlowBuilder().app({ id: "prgInd", root: "prgInd" })
            .node("ui-progress", { id: "pInd" }).build();
        await deployFlow(request, flow);
        const html = await served(request, "prgInd");
        expect(html).toMatch(/<sl-progress-bar[^>]*\bindeterminate\b/);
        // The indeterminate bar carries NO value attribute (would be value 0 otherwise).
        expect(html).not.toMatch(/<sl-progress-bar[^>]*\svalue=/);
    });
});

test.describe("ui-progress — label (P137)", () => {
    test.afterEach(async ({ request }) => { await resetFlow(request); });

    test("literal label renders as the bar's visible text + a11y label", async ({ request }) => {
        const flow = new FlowBuilder().app({ id: "prgLbl", root: "prgLbl" })
            .node("ui-progress", { id: "pLbl", value: { kind: "literal", value: 50 }, label: { kind: "literal", value: "Uploading" } }).build();
        await deployFlow(request, flow);
        const html = await served(request, "prgLbl");
        expect(html).toMatch(/<sl-progress-bar[^>]*\slabel="Uploading"[^>]*>Uploading<\/sl-progress-bar>/);
    });

    test("store-bound label renders the resolved live value", async ({ request }) => {
        const flow = new FlowBuilder().app({ id: "prgLblB", root: "prgLblB" })
            .node("ui-store", { id: "prgLblStore", app: "prgLblB", statePath: "lbl", initialValue: JSON.stringify("Live") })
            .node("ui-progress", { id: "pLblB", value: { kind: "literal", value: 50 }, label: { kind: "store", path: "prgLblStore" } })
            .build();
        await deployFlow(request, flow);
        const html = await served(request, "prgLblB");
        expect(html).toMatch(/<sl-progress-bar[^>]*>Live<\/sl-progress-bar>/);
    });
});

test.describe("ui-progress — showValue", () => {
    test.afterEach(async ({ request }) => { await resetFlow(request); });

    test("showValue=true → the percentage text is visible", async ({ request }) => {
        const flow = new FlowBuilder().app({ id: "prgSV", root: "prgSV" })
            .node("ui-progress", { id: "pSV", value: { kind: "literal", value: 75 }, showValue: true }).build();
        await deployFlow(request, flow);
        const html = await served(request, "prgSV");
        expect(html).toMatch(/<sl-progress-bar[^>]*>75%<\/sl-progress-bar>/);
    });

    test("showValue=false → no percentage text", async ({ request }) => {
        const flow = new FlowBuilder().app({ id: "prgSVoff", root: "prgSVoff" })
            .node("ui-progress", { id: "pSVoff", value: { kind: "literal", value: 75 } }).build();
        await deployFlow(request, flow);
        const html = await served(request, "prgSVoff");
        expect(html).not.toMatch(/<sl-progress-bar[^>]*>75%/);
    });

    test("showValue ignored when indeterminate (no percentage)", async ({ request }) => {
        const flow = new FlowBuilder().app({ id: "prgSVind", root: "prgSVind" })
            .node("ui-progress", { id: "pSVind", showValue: true }).build();
        await deployFlow(request, flow);
        const html = await served(request, "prgSVind");
        // Indeterminate bar with an EMPTY slot → no percentage text is emitted
        // (an unscoped "%" check would match CSS percentages elsewhere on the page).
        expect(html).toMatch(/<sl-progress-bar[^>]*\bindeterminate\b[^>]*><\/sl-progress-bar>/);
    });
});

test.describe("ui-progress — max scaling (P234)", () => {
    test.afterEach(async ({ request }) => { await resetFlow(request); });

    test("value=50, max=200 → 25 % filled", async ({ request }) => {
        const flow = new FlowBuilder().app({ id: "prgMax", root: "prgMax" })
            .node("ui-progress", { id: "pMax", value: { kind: "literal", value: 50 }, max: 200 }).build();
        await deployFlow(request, flow);
        const html = await served(request, "prgMax");
        expect(html).toMatch(/<sl-progress-bar[^>]*\svalue="25"/);
    });

    test("showValue percentage is relative to max", async ({ request }) => {
        const flow = new FlowBuilder().app({ id: "prgMaxSV", root: "prgMaxSV" })
            .node("ui-progress", { id: "pMaxSV", value: { kind: "literal", value: 50 }, max: 200, showValue: true }).build();
        await deployFlow(request, flow);
        const html = await served(request, "prgMaxSV");
        expect(html).toMatch(/<sl-progress-bar[^>]*>25%<\/sl-progress-bar>/);
    });
});

// P231/P234: the base-field `color` colours the indicator; a bound `visible=false`
// gates the render (ADR 0037). Both flow through the schema baseFieldsSchema mixin.
test.describe("ui-progress — base-field color on the fill (P234)", () => {
    test.afterEach(async ({ request }) => { await resetFlow(request); });

    test("bound color emits the Shoelace --indicator-color custom property", async ({ request }) => {
        const flow = new FlowBuilder().app({ id: "prgClr", root: "prgClr" })
            .node("ui-progress", { id: "pClr", value: { kind: "literal", value: 50 }, color: { kind: "literal", value: "#ff0000" } }).build();
        await deployFlow(request, flow);
        const html = await served(request, "prgClr");
        expect(html).toMatch(/<sl-progress-bar[^>]*style="[^"]*--indicator-color:#ff0000/);
    });

    test("the --indicator-color is applied on the rendered element (computed style)", async ({ page, request }) => {
        const flow = new FlowBuilder().app({ id: "prgClrM", root: "prgClrM" })
            .node("ui-progress", { id: "pClrM", value: { kind: "literal", value: 50 }, color: { kind: "literal", value: "rgb(0, 128, 0)" } }).build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "prgClrM");
        await webapp.navigate("/");
        const bar = page.locator("sl-progress-bar").first();
        await expect(bar).toBeVisible();
        const color = await bar.evaluate((el) => getComputedStyle(el).getPropertyValue("--indicator-color").trim());
        expect(color).toBe("rgb(0, 128, 0)");
    });
});

test.describe("ui-progress — visible render-gate (bound; ADR 0037)", () => {
    test.afterEach(async ({ request }) => { await resetFlow(request); });

    test("visible bound to store=false → the progress is not rendered", async ({ request }) => {
        const flow = new FlowBuilder().app({ id: "prgVis", root: "prgVis" })
            .node("ui-store", { id: "prgVisStore", app: "prgVis", statePath: "show", initialValue: JSON.stringify(false) })
            .node("ui-progress", { id: "pVis", value: { kind: "literal", value: 50 }, visible: { kind: "store", path: "prgVisStore" } })
            .build();
        await deployFlow(request, flow);
        const html = await served(request, "prgVis");
        expect(html).not.toContain("<sl-progress-bar");
        expect(html).not.toContain("<sl-spinner");
    });

    test("visible bound to store=true → the progress is rendered", async ({ request }) => {
        const flow = new FlowBuilder().app({ id: "prgVis2", root: "prgVis2" })
            .node("ui-store", { id: "prgVisStore2", app: "prgVis2", statePath: "show", initialValue: JSON.stringify(true) })
            .node("ui-progress", { id: "pVis2", value: { kind: "literal", value: 50 }, visible: { kind: "store", path: "prgVisStore2" } })
            .build();
        await deployFlow(request, flow);
        expect(await served(request, "prgVis2")).toContain("<sl-progress-bar");
    });
});

test.describe("ui-progress — msg.payload input", () => {
    test.afterEach(async ({ request }) => { await resetFlow(request); });

    test("msg.payload updates the value live via SSE", async ({ page, request }) => {
        const flow = new FlowBuilder().app({ id: "prgMsg", root: "prgMsg" })
            .node("ui-progress", { id: "pMsg", value: { kind: "literal", value: 10 } })
            .withInjectNode("prgMsgInj", "pMsg", 42)
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "prgMsg");
        await webapp.navigate("/");
        await expect(page.locator("sl-progress-bar")).toHaveAttribute("value", "10");
        await injectMessage(request, "prgMsgInj");
        await expect(page.locator("sl-progress-bar")).toHaveAttribute("value", "42", { timeout: 5000 });
    });
});

test.describe("ui-progress — ports", () => {
    test.afterEach(async ({ request }) => { await resetFlow(request); });

    // inputs:1 is exercised by the msg.payload live-update test above (a message on
    // the input port updates the value). outputs:0 → the node draws no output port,
    // so a built node has no outbound wires. Placement (order/row/col) is universal
    // layout boilerplate, covered generically by the layout suite (node-testing.md).
    test("has an input and no output port (0 output wires)", async ({ request }) => {
        const flow = new FlowBuilder().app({ id: "prgPort", root: "prgPort" })
            .node("ui-progress", { id: "pPort" }).build();
        await deployFlow(request, flow);
        const node = flow.find((n) => n.id === "pPort") as Record<string, unknown>;
        expect(node.wires === undefined || (Array.isArray(node.wires) && (node.wires as unknown[]).flat().length === 0)).toBeTruthy();
    });
});

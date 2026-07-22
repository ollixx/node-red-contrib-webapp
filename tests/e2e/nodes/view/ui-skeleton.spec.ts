import { expect, test, type Locator } from "@playwright/test";

import { deployFlow, injectMessage, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { NodeEditorPage } from "../../../helpers/node-editor-page";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * ui-skeleton — feature coverage (P241, node-conformance).
 *
 * FRESH tests (node-testing.md): the node used to render NOTHING, so its only
 * prior test asserted a SIBLING still rendered. That crutch is gone. Every claim
 * here is proven against the REAL DOM by MEASUREMENT (bounding boxes / computed
 * style), per [[verify-rendering-by-measurement-not-tags]]:
 *
 *  - the skeleton renders visible chrome (box height > 0);
 *  - the four displayType forms are distinguishable (text lines stacked; avatar
 *    round; card taller+wider than a line; table = lines × 3 columns);
 *  - `lines` drives the count (5 → 5, 1 → 1) and `lines=0` is a real EDITOR error;
 *  - `visible` gates it (store=false hidden; a live inject toggles it via SSE);
 *  - the base-field `color` tints the placeholder fill (measured on the chrome).
 */

async function served(request: import("@playwright/test").APIRequestContext, appId: string): Promise<string> {
    const res = await request.get(`/webapp/${appId}/`);
    expect(res.ok()).toBeTruthy();
    return res.text();
}

/** Wait until an <sl-skeleton> has upgraded and its shadow indicator exists. */
async function waitForIndicator(locator: Locator): Promise<void> {
    await expect.poll(async () => locator.evaluate((el) => {
        const root = (el as unknown as { shadowRoot: ShadowRoot | null }).shadowRoot;
        return Boolean(root && root.querySelector(".skeleton__indicator"));
    }), { timeout: 5000 }).toBe(true);
}

test.describe("ui-skeleton — renders visible chrome", () => {
    test.afterEach(async ({ request }) => { await resetFlow(request); });

    test("a visible skeleton produces its own chrome (box height > 0)", async ({ page, request }) => {
        const flow = new FlowBuilder().app({ id: "skChrome", root: "skChrome" })
            .node("ui-skeleton", { id: "skC1", displayType: "text", lines: 3 }).build();
        await deployFlow(request, flow);

        // Served HTML carries the composed sl-skeleton (was empty before P241).
        expect(await served(request, "skChrome")).toContain("webapp-skeleton--text");

        const webapp = new WebappPage(page, "skChrome");
        await webapp.navigate("/");
        const container = page.locator(".webapp-skeleton--text").first();
        await expect(container).toBeVisible();
        const box = await container.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.height).toBeGreaterThan(0);
    });
});

test.describe("ui-skeleton — displayType forms are distinguishable", () => {
    test.afterEach(async ({ request }) => { await resetFlow(request); });

    test("text: `lines` placeholder lines stacked vertically (ascending y)", async ({ page, request }) => {
        const flow = new FlowBuilder().app({ id: "skText", root: "skText" })
            .node("ui-skeleton", { id: "skT", displayType: "text", lines: 5 }).build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "skText");
        await webapp.navigate("/");

        const lines = page.locator(".webapp-skeleton--text .webapp-skeleton-line");
        await expect(lines).toHaveCount(5);
        const boxes = await lines.evaluateAll((els) =>
            els.map((el) => { const r = el.getBoundingClientRect(); return { y: r.top, h: r.height }; }));
        expect(boxes).toHaveLength(5);
        for (const b of boxes) { expect(b.h).toBeGreaterThan(0); }
        for (let i = 1; i < boxes.length; i++) {
            expect(boxes[i].y).toBeGreaterThan(boxes[i - 1].y);
        }
    });

    test("text: lines=1 → exactly one line", async ({ page, request }) => {
        const flow = new FlowBuilder().app({ id: "skText1", root: "skText1" })
            .node("ui-skeleton", { id: "skT1", displayType: "text", lines: 1 }).build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "skText1");
        await webapp.navigate("/");
        await expect(page.locator(".webapp-skeleton--text .webapp-skeleton-line")).toHaveCount(1);
    });

    test("avatar: round placeholder (width ≈ height, --border-radius 50%)", async ({ page, request }) => {
        const flow = new FlowBuilder().app({ id: "skAv", root: "skAv" })
            .node("ui-skeleton", { id: "skA", displayType: "avatar" }).build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "skAv");
        await webapp.navigate("/");

        const avatar = page.locator(".webapp-skeleton--avatar").first();
        await expect(avatar).toBeVisible();
        await waitForIndicator(avatar);
        const box = await avatar.boundingBox();
        expect(box).not.toBeNull();
        // Width ≈ height (square footprint → round once the radius applies).
        expect(Math.abs(box!.width - box!.height)).toBeLessThanOrEqual(2);
        // The circular radius drives the indicator. Measure the computed radius on
        // the shadow chrome: it must be ≥ 50% of the box's half-dimension (i.e. a
        // real pill/circle, not the square default).
        const radiusPx = await avatar.evaluate((el) => {
            const root = (el as unknown as { shadowRoot: ShadowRoot }).shadowRoot;
            const ind = root.querySelector(".skeleton__indicator") as HTMLElement;
            const r = getComputedStyle(ind).borderTopLeftRadius;
            const rect = ind.getBoundingClientRect();
            // borderTopLeftRadius may be "24px" or "50%"; normalise "%" to px.
            const px = r.endsWith("%") ? (parseFloat(r) / 100) * rect.width : parseFloat(r);
            return { px, half: rect.width / 2 };
        });
        expect(radiusPx.px).toBeGreaterThanOrEqual(radiusPx.half * 0.9);
    });

    test("card: block placeholder taller AND wider than a single text line", async ({ page, request }) => {
        const flow = new FlowBuilder().app({ id: "skCard", root: "skCard" })
            .node("ui-skeleton", { id: "skCardN", displayType: "card" })
            .node("ui-skeleton", { id: "skLineN", displayType: "text", lines: 1 })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "skCard");
        await webapp.navigate("/");

        const card = page.locator(".webapp-skeleton--card").first();
        const line = page.locator(".webapp-skeleton--text .webapp-skeleton-line").first();
        await expect(card).toBeVisible();
        await expect(line).toBeVisible();
        const cardBox = await card.boundingBox();
        const lineBox = await line.boundingBox();
        expect(cardBox).not.toBeNull();
        expect(lineBox).not.toBeNull();
        expect(cardBox!.height).toBeGreaterThan(lineBox!.height);
        expect(cardBox!.width).toBeGreaterThan(lineBox!.width);
    });

    test("table: `lines` rows × 3 columns (Owner-Entscheid)", async ({ page, request }) => {
        const flow = new FlowBuilder().app({ id: "skTable", root: "skTable" })
            .node("ui-skeleton", { id: "skTbl", displayType: "table", lines: 4 }).build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "skTable");
        await webapp.navigate("/");

        const rows = page.locator(".webapp-skeleton--table .webapp-skeleton-row");
        await expect(rows).toHaveCount(4);
        // Each row has exactly 3 cells, laid out left→right (ascending x).
        for (let r = 0; r < 4; r++) {
            const cells = rows.nth(r).locator(".webapp-skeleton-cell");
            await expect(cells).toHaveCount(3);
            const xs = await cells.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().left));
            expect(xs[1]).toBeGreaterThan(xs[0]);
            expect(xs[2]).toBeGreaterThan(xs[1]);
        }
        // Distinguishable from text: the text form has no rows.
        await expect(page.locator(".webapp-skeleton--text")).toHaveCount(0);
    });
});

test.describe("ui-skeleton — visible render-gate (store binding, live)", () => {
    test.afterEach(async ({ request }) => { await resetFlow(request); });

    test("store=false → not rendered; store=true → rendered", async ({ request }) => {
        const hidden = new FlowBuilder().app({ id: "skVisF", root: "skVisF" })
            .node("ui-store", { id: "skVisStoreF", app: "skVisF", statePath: "loading", initialValue: JSON.stringify(false) })
            .node("ui-skeleton", { id: "skVisF1", visible: { kind: "store", path: "skVisStoreF" } })
            .build();
        await deployFlow(request, hidden);
        expect(await served(request, "skVisF")).not.toContain("webapp-skeleton");
        await resetFlow(request);

        const shown = new FlowBuilder().app({ id: "skVisT", root: "skVisT" })
            .node("ui-store", { id: "skVisStoreT", app: "skVisT", statePath: "loading", initialValue: JSON.stringify(true) })
            .node("ui-skeleton", { id: "skVisT1", visible: { kind: "store", path: "skVisStoreT" } })
            .build();
        await deployFlow(request, shown);
        expect(await served(request, "skVisT")).toContain("webapp-skeleton");
    });

    test("a live inject flips visible false→true and the skeleton appears via SSE", async ({ page, request }) => {
        const flow = new FlowBuilder().app({ id: "skVisLive", root: "skVisLive" })
            .node("ui-store", { id: "skLiveStore", app: "skVisLive", statePath: "loading", initialValue: JSON.stringify(false) })
            .node("ui-skeleton", { id: "skLive1", displayType: "text", lines: 2, visible: { kind: "store", path: "skLiveStore" } })
            .withStoreInject("skLiveInj", "skLiveStore", true)
            .build();
        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "skVisLive");
        await webapp.navigate("/");
        // Initially hidden (store=false).
        await expect(page.locator(".webapp-skeleton--text")).toHaveCount(0);

        // Flip the bound store to true → SSE snapshot morphs the DOM in.
        await injectMessage(request, "skLiveInj");
        await expect(page.locator(".webapp-skeleton--text")).toHaveCount(1, { timeout: 5000 });
        const box = await page.locator(".webapp-skeleton--text").first().boundingBox();
        expect(box!.height).toBeGreaterThan(0);
    });
});

test.describe("ui-skeleton — base-field color tints the placeholder fill", () => {
    test.afterEach(async ({ request }) => { await resetFlow(request); });

    test("color emits the sl-skeleton --color and the shadow indicator uses it", async ({ page, request }) => {
        const flow = new FlowBuilder().app({ id: "skColor", root: "skColor" })
            .node("ui-skeleton", { id: "skClr", displayType: "avatar", color: { kind: "literal", value: "rgb(255, 0, 0)" } })
            .build();
        await deployFlow(request, flow);

        // Served markup carries the custom property on the composed piece.
        expect(await served(request, "skColor")).toContain("--color:rgb(255, 0, 0)");

        const webapp = new WebappPage(page, "skColor");
        await webapp.navigate("/");
        const avatar = page.locator(".webapp-skeleton--avatar").first();
        await expect(avatar).toBeVisible();
        await waitForIndicator(avatar);
        // The indicator's actual fill (background) resolves to the chosen colour
        // (effect="pulse" keeps background = var(--color), measurable).
        const bg = await avatar.evaluate((el) => {
            const root = (el as unknown as { shadowRoot: ShadowRoot }).shadowRoot;
            const ind = root.querySelector(".skeleton__indicator") as HTMLElement;
            return getComputedStyle(ind).backgroundColor;
        });
        expect(bg).toBe("rgb(255, 0, 0)");
    });
});

test.describe("ui-skeleton — lines validation (editor)", () => {
    test.afterEach(async ({ request }) => { await resetFlow(request); });

    test("lines=0 is a real editor validation error (deploy blocked)", async ({ page, request }) => {
        // Seed the universal placement fields to "" so only `lines` varies — a
        // freshly-imported node otherwise reports its (undefined) order/row/… as
        // invalid until the first save (Node-RED quirk, unrelated to this check).
        const flow = new FlowBuilder().app({ id: "skVal", root: "skVal" })
            .node("ui-skeleton", {
                id: "skValN", displayType: "text", lines: 3,
                order: "", row: "", col: "", colSize: "", rowSize: "", layoutX: "", layoutY: ""
            }).build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("skValN");
        // Valid to start.
        expect(await editor.getValidationState("skValN")).toBe("valid");

        // 0 → invalid. Save (Done) so the graph node's validity is recomputed —
        // the editor's own signal that drives the red node badge and blocks deploy.
        // Before P241 the validator was `value === "" || RED.validators.number()`,
        // which let 0/negative pass to the schema at deploy time.
        await editor.fillField("lines", "0");
        await editor.save();
        expect(await editor.getValidationState("skValN")).toBe("invalid");

        // A positive value clears the error.
        await editor.openNode("skValN");
        await editor.fillField("lines", "3");
        await editor.save();
        expect(await editor.getValidationState("skValN")).toBe("valid");
    });
});

test.describe("ui-skeleton — ports", () => {
    test.afterEach(async ({ request }) => { await resetFlow(request); });

    test("has an input port (component-state ops) and no output port", async ({ page, request }) => {
        const flow = new FlowBuilder().app({ id: "skPorts", root: "skPorts" })
            .node("ui-skeleton", { id: "skP1" }).build();
        await deployFlow(request, flow);
        const editor = new NodeEditorPage(page);
        await editor.open();
        expect(await editor.inputPortCount("skP1")).toBe(1);
        expect((await editor.outputLabels("skP1")).length).toBe(0);
    });
});

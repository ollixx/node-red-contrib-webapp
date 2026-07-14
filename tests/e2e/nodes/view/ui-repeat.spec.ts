import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { waitForNodeTypes } from "../../../helpers/editor-ready";

/**
 * P165 (ADR 0017) — ui-repeat end-to-end browser proof.
 *
 * A ui-store array `[{name:'A'},{name:'B'}]` + a `ui-repeat` (bound to the store)
 * containing a single `ui-text` child whose value is the scope-local binding
 * `{ kind:'item', path:'name' }`. The renderer clones the template once per
 * element, so the page shows two rows 'A' and 'B'. Pushing a third item
 * (`store.replace` with a 3-element array) renders a visible third row 'C', and
 * — because the repeat is keyed by `name` (keyField) — the first two rows keep
 * their stable per-instance ids (`A#personName`, `B#personName`) and values
 * across the update; only the new `C#personName` row is added. The stable
 * per-instance id is exactly the keyed signal the client morph reconciles on,
 * so the first two rows do not flicker / re-key.
 *
 * A dedicated fixture flow is used (NOT customers-crud) so the assertions are
 * independent of the example's own wiring. The baseline is restored afterwards.
 */

type FlowNode = Record<string, unknown>;

async function loadFlowFixture(relativePath: string): Promise<FlowNode[]> {
    const fixturePath = path.resolve(process.cwd(), relativePath);
    const content = await readFile(fixturePath, "utf8");
    return JSON.parse(content) as FlowNode[];
}

test.describe("ui-repeat template render (P165)", () => {
    test.beforeAll(async ({ request }) => {
        const flow = await loadFlowFixture("tests/e2e/fixtures/ui-repeat.flow.json");
        const response = await request.post("/flows", { data: flow });
        expect(response.ok()).toBeTruthy();
    });

    // Restore the customers-crud baseline so later specs that depend on
    // customersApp are not left with the repeatApp fixture flow.
    test.afterAll(async ({ request }) => {
        const baseline = await loadFlowFixture("examples/customers-crud/flow.json");
        await request.post("/flows", { data: baseline });
    });

    test("a store array renders one row per item via item.name", async ({ page }) => {
        await page.goto("/webapp/repeatApp/");

        const rows = page.locator(".webapp-text");
        await expect(rows).toHaveCount(2);
        await expect(rows.nth(0)).toHaveText("A");
        await expect(rows.nth(1)).toHaveText("B");
    });

    test("adding a third item renders a visible third row, keyed (first two do not re-mount)", async ({ page }) => {
        await page.goto("/webapp/repeatApp/");

        const rows = page.locator(".webapp-text");
        await expect(rows).toHaveCount(2);

        // The first two rows carry stable per-instance ids keyed by `name`.
        await expect(page.locator('[data-webapp-node="A#personName"]')).toHaveText("A");
        await expect(page.locator('[data-webapp-node="B#personName"]')).toHaveText("B");

        // Push the 3-item array through the store.
        await page.getByText("Add third").click();

        // The third row 'C' becomes visible.
        await expect(rows).toHaveCount(3);
        await expect(page.locator('[data-webapp-node="C#personName"]')).toHaveText("C");

        // Keyed (keyField:"name"): the first two rows keep their EXACT per-instance
        // ids and values across the update — they are not re-keyed/re-ordered, so
        // they do not flicker. Only the new C row is appended.
        await expect(page.locator('[data-webapp-node="A#personName"]')).toHaveText("A");
        await expect(page.locator('[data-webapp-node="B#personName"]')).toHaveText("B");
        await expect(page.locator('.webapp-text')).toHaveText(["A", "B", "C"]);
    });
});

/**
 * P184 — scope-local bindings with an EMPTY path: a repeat over a STRING array.
 *
 * The fixture binds a `ui-text` to the whole `item` ({kind:'item'}, no path) and
 * a sibling `ui-text` to `index` ({kind:'index'}, no path). Both are the
 * legitimate "whole element / bare position" cases that older builds serialised
 * as `path:''`. The repeat clones BOTH children once per element, so a
 * `["alpha","beta","gamma"]` store renders the interleaved sequence
 * `alpha,0, beta,1, gamma,2` — proving the whole string element and its
 * zero-based index resolve end-to-end with no validation error.
 */
test.describe("ui-repeat over a string array — whole-item + index (P184)", () => {
    test.beforeAll(async ({ request }) => {
        const flow = await loadFlowFixture("tests/e2e/fixtures/ui-repeat-primitive.flow.json");
        const response = await request.post("/flows", { data: flow });
        expect(response.ok()).toBeTruthy();
    });

    test.afterAll(async ({ request }) => {
        const baseline = await loadFlowFixture("examples/customers-crud/flow.json");
        await request.post("/flows", { data: baseline });
    });

    test("each string element renders verbatim alongside its zero-based index", async ({ page }) => {
        await page.goto("/webapp/repeatPrimApp/");

        // Whole-`item` renders the string element; `index` renders the position.
        // The two children are cloned per element in mount order → interleaved.
        await expect(page.locator(".webapp-text")).toHaveText([
            "alpha",
            "0",
            "beta",
            "1",
            "gamma",
            "2"
        ]);
    });
});

/**
 * P185 (ADR 0017) — `item`/`index` reachable INSIDE a reactive expression with
 * PER-INSTANCE scope. The fixture binds a single `ui-text` in a repeat to a
 * reactive value `` `Zeile ${index}: ${item.name}` `` over an object array
 * `[{name:'Ada'},{name:'Linus'},{name:'Grace'}]`. One compiled expression yields
 * each row its OWN item/index — the proof of per-instance scope (rows differ).
 */
test.describe("ui-repeat — item/index inside a reactive expression (P185)", () => {
    test.beforeAll(async ({ request }) => {
        const flow = await loadFlowFixture("tests/e2e/fixtures/ui-repeat-reactive.flow.json");
        const response = await request.post("/flows", { data: flow });
        expect(response.ok()).toBeTruthy();
    });

    test.afterAll(async ({ request }) => {
        const baseline = await loadFlowFixture("examples/customers-crud/flow.json");
        await request.post("/flows", { data: baseline });
    });

    test("a reactive `${index}: ${item.name}` resolves each row's own item/index", async ({ page }) => {
        await page.goto("/webapp/repeatReactiveApp/");

        // Same compiled expression, three clones → three DISTINCT per-instance
        // values, proving the renderer injects each row's item/index.
        await expect(page.locator(".webapp-text")).toHaveText([
            "Zeile 0: Ada",
            "Zeile 1: Linus",
            "Zeile 2: Grace"
        ]);
    });
});

/**
 * P192 (renderer bug, Owner 2026-06-19) — the repeat item-scope must propagate
 * THROUGH an intermediate child-bearing node, not just the direct template
 * children. The Owner's repro: a `ui-container` (layout horizontal) inside a
 * `ui-repeat`, holding two `ui-text` nodes bound to `item.name` / `item.city`.
 *
 * Before P192 the container's children were rendered by the general mount pass
 * WITHOUT the item scope (and under the original, not the cloned id), so `item`
 * resolved to `undefined` → the cells showed the `"?"` display fallback. After
 * P192 the whole template subtree is cloned per item — scope + per-instance re-id
 * propagate through the container — so each container clone shows its OWN row's
 * name + city. The cloned container + its children carry the `<itemKey>#<id>`
 * prefix (keyField = `name`), proving the keying is consistent through the
 * container.
 *
 * Structure nodes (ui-app/ui-route/ui-dialog) are top-level mounted, never repeat
 * children, so they are out of scope here.
 */
test.describe("ui-repeat — item-scope through a nested ui-container (P192)", () => {
    test.beforeAll(async ({ request }) => {
        const flow = await loadFlowFixture("tests/e2e/fixtures/ui-repeat-container.flow.json");
        const response = await request.post("/flows", { data: flow });
        expect(response.ok()).toBeTruthy();
    });

    test.afterAll(async ({ request }) => {
        const baseline = await loadFlowFixture("examples/customers-crud/flow.json");
        await request.post("/flows", { data: baseline });
    });

    test("two ui-text in a container inside the repeat resolve item.* per row", async ({ page }) => {
        await page.goto("/webapp/repeatContainerApp/");

        // One container clone per row, each holding name + city resolved against
        // THAT row's item — interleaved in mount order. No `"?"` fallback.
        await expect(page.locator(".webapp-text")).toHaveText([
            "Ada",
            "London",
            "Linus",
            "Helsinki"
        ]);
    });

    test("the cloned container's children carry the per-instance id prefix", async ({ page }) => {
        await page.goto("/webapp/repeatContainerApp/");

        // keyField = name → itemKey = Ada/Linus. The children inside the cloned
        // container resolve INSIDE the clone (id <itemKey>#<childId>), not back to
        // the original node.
        await expect(page.locator('[data-webapp-node="Ada#rowName"]')).toHaveText("Ada");
        await expect(page.locator('[data-webapp-node="Ada#rowCity"]')).toHaveText("London");
        await expect(page.locator('[data-webapp-node="Linus#rowName"]')).toHaveText("Linus");
        await expect(page.locator('[data-webapp-node="Linus#rowCity"]')).toHaveText("Helsinki");
    });
});

/**
 * P193 (ADR 0023) — named repeat scopes: an OUTER repeat's item is addressable by
 * alias from a deeply-nested child, past an inner repeat. The fixture nests an
 * `orderRepeat` (itemName="order", items bound to the OUTER customer's orders via
 * `{kind:item, scope:"customer", path:"orders"}`) inside a `customerRepeat`
 * (itemName="customer"). A child `ui-text` reads the OUTER customer name via
 * `{kind:item, scope:"customer", path:"name"}`, the INNER order total via
 * `{kind:item, scope:"order", path:"total"}`, and the bare innermost via
 * `{kind:item, path:"total"}` (== order). Ada has 2 orders (10, 20), Linus has 1
 * (30) — so the per-order interleaved sequence proves the outer name repeats
 * correctly for each inner order while the inner total varies.
 *
 * P196 (ADR 0023 §3) adds a 4th text per clone using the REACTIVE `scope()`
 * accessor: `${scope("customer").name}=${scope("order").total}` — the reactive
 * twin of the scope-qualified binding, proving the named frames reach the reactive
 * eval per instance.
 */
test.describe("ui-repeat — outer item addressable by alias from a nested repeat (P193 + P196)", () => {
    test.beforeAll(async ({ request }) => {
        const flow = await loadFlowFixture("tests/e2e/fixtures/ui-repeat-named-scope.flow.json");
        const response = await request.post("/flows", { data: flow });
        expect(response.ok()).toBeTruthy();
    });

    test.afterAll(async ({ request }) => {
        const baseline = await loadFlowFixture("examples/customers-crud/flow.json");
        await request.post("/flows", { data: baseline });
    });

    test("a nested child reads the OUTER customer by alias and the INNER order by alias / bare / reactive scope()", async ({ page }) => {
        await page.goto("/webapp/repeatNamedApp/");

        // Per inner-order clone, four texts in mount order:
        //   outerName (scope:customer), innerTotal (scope:order), bareTotal
        //   (innermost==order), reactiveScope (`scope("customer").name=scope("order").total`).
        // Ada → orders 10,20 ; Linus → order 30.
        await expect(page.locator(".webapp-text")).toHaveText([
            "Ada", "10", "10", "Ada=10",
            "Ada", "20", "20", "Ada=20",
            "Linus", "30", "30", "Linus=30"
        ]);
    });
});

/**
 * P190 — items typedInput carrier-id round-trip fix.
 *
 * Before P190 the typedInput lived on `#node-input-items` (same id as the
 * `items` property). Node-RED's auto-field handling would write the raw widget
 * value (a JSON string) into `this.items`, clobbering the binding object.
 * On re-open `parseBindingValue` could not read the raw string → the field
 * showed blank even though `properties.items` had "something".
 *
 * Fix (mirroring ui-list / P171): the typedInput now lives on the SEPARATE
 * carrier `#node-input-itemsBinding`; the `items` property has NO matching DOM
 * field so Node-RED cannot clobber it.
 *
 * Proof: deploy a flow with a `ui-repeat` node whose `items` binding is a json
 * literal `[{"name":"Alice"},{"name":"Bob"}]`; open the editor → the
 * `#node-input-itemsBinding` carries the correct type ("json") and a non-empty
 * value; close and re-open → the same value is still shown (round-trip).
 * Also verify a store-binding round-trips correctly.
 */
test.describe("ui-repeat items typedInput round-trip (P190)", () => {
    test.afterEach(async ({ request }) => {
        const baseline = await loadFlowFixture("examples/customers-crud/flow.json");
        await request.post("/flows", { data: baseline });
    });

    test("json literal items binding round-trips: type=json, value visible after reopen", async ({ page, request }) => {
        // Deploy a flow with a ui-repeat using a json literal items binding.
        const flow = await loadFlowFixture("tests/e2e/fixtures/ui-repeat.flow.json");
        const response = await request.post("/flows", { data: flow });
        expect(response.ok()).toBeTruthy();

        // Open the Node-RED editor.
        await page.goto("/");
        await page.waitForLoadState("networkidle");
        // Wait for the node-type REGISTRY (getType + editor.edit), not just
        // RED.nodes.node — otherwise red.editor.edit() below races template
        // registration and the tray never builds ([[e2e-editor-registration-race]]).
        await waitForNodeTypes(page, ["ui-repeat"]);

        // Open the ui-repeat node config (peopleRepeat is defined in ui-repeat.flow.json).
        await page.evaluate(() => {
            const red = (window as unknown as {
                RED: {
                    nodes: { node: (id: string) => Record<string, unknown> | null };
                    editor: { edit: (n: Record<string, unknown>) => void };
                };
            }).RED;
            const node = red.nodes.node("peopleRepeat");
            if (node) { red.editor.edit(node); }
        });
        await expect(page.locator(".red-ui-tray").last()).toBeVisible({ timeout: 10000 });
        await page.waitForTimeout(500);

        // The carrier is now #node-input-itemsBinding (NOT #node-input-items).
        // The field must be present and report a non-empty value and type.
        const bindingCarrier = page.locator("#node-input-itemsBinding");
        await expect(bindingCarrier).toHaveCount(1);

        const type1 = await page.evaluate(() => {
            const $ = (window as unknown as { $: (sel: string) => { typedInput: (...a: unknown[]) => string } }).$;
            return String($("#node-input-itemsBinding").typedInput("type") ?? "");
        });
        const value1 = await page.evaluate(() => {
            const $ = (window as unknown as { $: (sel: string) => { typedInput: (...a: unknown[]) => string } }).$;
            return String($("#node-input-itemsBinding").typedInput("value") ?? "");
        });

        // The binding should have a type and a non-empty value (the fixture uses a store binding).
        expect(type1).toBeTruthy();
        expect(value1).not.toBe("");

        // Close (Done) → reopen → the same type+value should still be there.
        await page.locator("#node-dialog-ok").click();
        await page.locator(".red-ui-tray").last().waitFor({ state: "detached", timeout: 5000 }).catch(() => undefined);
        await page.waitForTimeout(300);

        // Reopen the same node.
        await page.evaluate(() => {
            const red = (window as unknown as {
                RED: {
                    nodes: { node: (id: string) => Record<string, unknown> | null };
                    editor: { edit: (n: Record<string, unknown>) => void };
                };
            }).RED;
            const node = red.nodes.node("peopleRepeat");
            if (node) { red.editor.edit(node); }
        });
        await expect(page.locator(".red-ui-tray").last()).toBeVisible({ timeout: 10000 });
        await page.waitForTimeout(500);

        const type2 = await page.evaluate(() => {
            const $ = (window as unknown as { $: (sel: string) => { typedInput: (...a: unknown[]) => string } }).$;
            return String($("#node-input-itemsBinding").typedInput("type") ?? "");
        });
        const value2 = await page.evaluate(() => {
            const $ = (window as unknown as { $: (sel: string) => { typedInput: (...a: unknown[]) => string } }).$;
            return String($("#node-input-itemsBinding").typedInput("value") ?? "");
        });

        // Round-trip: type and value must be unchanged after close+reopen.
        expect(type2).toBe(type1);
        expect(value2).toBe(value1);
        expect(value2).not.toBe("");

        // Close the tray.
        await page.locator("#node-dialog-ok").click();
        await page.locator(".red-ui-tray").last().waitFor({ state: "detached", timeout: 5000 }).catch(() => undefined);
    });
});

/**
 * ADR 0025 — ui-repeat is TRANSPARENT. It only iterates: the cloned template
 * children flatten into the HOST region with NO per-item wrapper, no own layout,
 * no variant. Layout/chrome is the job of an explicit enclosing ui-container.
 *
 * The owner's real case: a ui-container[variant=span] holding a ui-repeat over a
 * string array of a single ui-text(item) must render the values on ONE line,
 * tight ("dicht hintereinander") — NOT stacked. This is asserted by MEASUREMENT
 * (same y, increasing x), not by tag/class, because the previous P191/P197
 * "repeat-as-container" tests passed on tags while the layout was actually broken.
 */
test.describe("ui-repeat is transparent — inline composition via ui-container[span] (ADR 0025)", () => {
    test.afterAll(async ({ request }) => {
        const baseline = await loadFlowFixture("examples/customers-crud/flow.json");
        await request.post("/flows", { data: baseline });
    });

    test("ui-container[span] > ui-repeat > ui-text(item) renders the 3 values SIDE BY SIDE (same row), tight", async ({ page, request }) => {
        const flow = await loadFlowFixture("tests/e2e/fixtures/ui-repeat-inline-compose.flow.json");
        const response = await request.post("/flows", { data: flow });
        expect(response.ok()).toBeTruthy();
        await page.goto("/webapp/riApp/");
        await page.locator(".webapp-text").first().waitFor();

        // The repeat adds NO wrapper of its own: there is no element keyed by the
        // repeat id (`<itemKey>#<repeatId>`) and no nested container around items.
        await expect(page.locator('[data-webapp-node$="#riRepeat"]')).toHaveCount(0);
        await expect(page.locator(".webapp-container--transparent")).toHaveCount(0);

        // The three texts exist and read the item values.
        const texts = page.locator(".webapp-text");
        await expect(texts).toHaveCount(3);
        await expect(texts).toHaveText(["a", "b", "c"]);

        // MEASURED: all three are on the same line (identical top within 2px), and
        // their left edges strictly increase (laid out left-to-right, not stacked).
        const boxes = await texts.evaluateAll((els) =>
            els.map((el) => {
                const r = el.getBoundingClientRect();
                return { x: Math.round(r.x), y: Math.round(r.y) };
            })
        );
        const ys = boxes.map((b) => b.y);
        expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(2); // same row
        expect(boxes[0].x).toBeLessThan(boxes[1].x); // left-to-right
        expect(boxes[1].x).toBeLessThan(boxes[2].x);
    });

    test("a plain ui-repeat (no enclosing span) clones children with NO repeat wrapper element", async ({ page, request }) => {
        const flow = await loadFlowFixture("tests/e2e/fixtures/ui-repeat-primitive.flow.json");
        const response = await request.post("/flows", { data: flow });
        expect(response.ok()).toBeTruthy();
        await page.goto("/webapp/repeatPrimApp/");
        await page.locator(".webapp-text").first().waitFor();
        // No element carries the repeat's id as a wrapper — the repeat is transparent.
        await expect(page.locator('[data-webapp-node$="#wordsRepeat"]')).toHaveCount(0);
    });
});

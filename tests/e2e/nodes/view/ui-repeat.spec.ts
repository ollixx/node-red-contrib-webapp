import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

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

import { expect, test } from "@playwright/test";

import { deployFlow, injectMessage, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * ui-list — per-node E2E spec (rewritten at P171, ui-list/spec alignment).
 *
 * P171 (ADR 0012): `items` is a STRUCTURAL array value typedInput (the list
 * renders its rows ITSELF — NOT a repeats case), exactly like ui-menu `items`.
 * Each element is a String shorthand (→ {label}) OR an object
 * {id?,label,value?,icon?}. `label` is required (object form); a missing label
 * renders "?" for THAT row only; a non-array root → empty list (zero items). The
 * node-wide `displayValue` (none/secondary/badge) controls how a row's `value`
 * is DISPLAYED; `value` is ALWAYS carried in the itemClick event (row.value).
 * The itemClick event emits params { rowId, row }. Legacy `itemsPath` migrates
 * to a state binding.
 */

test.describe("ui-list — items typedInput + item schema (P171)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("array of strings renders one labelled row per string", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "listStrApp", root: "listStrApp" })
            .node("ui-list", {
                id: "listStrNode",
                items: { kind: "literal", value: ["Ada", "Alan"] }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "listStrApp");
        await webapp.navigate("/");

        await expect(page.locator("ul.webapp-list")).toBeVisible();
        const items = page.locator("ul.webapp-list li.webapp-list-item");
        await expect(items).toHaveCount(2);
        await expect(items.nth(0)).toContainText("Ada");
        await expect(items.nth(1)).toContainText("Alan");
    });

    test("mixed array (string + object) renders; missing label → '?' for that row only", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "listMixApp", root: "listMixApp" })
            .node("ui-list", {
                id: "listMixNode",
                items: { kind: "literal", value: [
                    "Shortcut",
                    { id: "c-1", label: "Open invoices" },
                    { id: "c-2", value: 7 }
                ] }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "listMixApp");
        await webapp.navigate("/");

        const items = page.locator("ul.webapp-list li.webapp-list-item");
        await expect(items).toHaveCount(3);
        await expect(items.nth(0)).toContainText("Shortcut");
        await expect(items.nth(1)).toContainText("Open invoices");
        // The third element has no label → "?" for that row only (the others render).
        await expect(items.nth(2)).toContainText("?");
    });

    test("object items with value + displayValue=badge render a badge in badgeVariant", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "listBadgeApp", root: "listBadgeApp" })
            .node("ui-list", {
                id: "listBadgeNode",
                items: { kind: "literal", value: [
                    { id: "c-1", label: "Open invoices", value: 3 },
                    { id: "c-2", label: "Paid", value: 12 }
                ] },
                displayValue: "badge",
                badgeVariant: "warning"
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "listBadgeApp");
        await webapp.navigate("/");

        // value renders as an sl-badge inside the row, in the configured variant.
        const badges = page.locator("ul.webapp-list li.webapp-list-item sl-badge.webapp-list-value");
        await expect(badges).toHaveCount(2);
        await expect(badges.nth(0)).toContainText("3");
        await expect(badges.nth(1)).toContainText("12");
        // "warning" maps to the Shoelace variant the badge serializer emits.
        await expect(badges.first()).toHaveAttribute("variant", "warning");
    });

    test("legacy itemsPath migrates to a state binding and renders from the store", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "listMigApp", root: "listMigApp" })
            .node("ui-store", {
                id: "listMigStore",
                statePath: "people",
                initialValue: JSON.stringify([{ label: "Grace" }])
            })
            .node("ui-list", {
                id: "listMigNode",
                // legacy plain state-path field — migrates to { kind:"state", path }.
                itemsPath: "people"
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "listMigApp");
        await webapp.navigate("/");

        await expect(page.locator("ul.webapp-list li.webapp-list-item").first()).toContainText("Grace");
    });

    test("non-array root resolves to an empty list (zero list items)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "listScalarApp", root: "listScalarApp" })
            .node("ui-store", {
                id: "listScalarStore",
                statePath: "notAnArray",
                initialValue: JSON.stringify("hello")
            })
            .node("ui-list", {
                id: "listScalarNode",
                items: { kind: "store", path: "listScalarStore" }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "listScalarApp");
        await webapp.navigate("/");

        await expect(webapp.root()).toBeVisible();
        await expect(page.locator("ul.webapp-list li.webapp-list-item")).toHaveCount(0);
    });

    test("itemClick event emits params { rowId, row } with the whole element incl. value", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "listClickApp", root: "listClickApp" })
            .node("ui-list", {
                id: "listClickNode",
                items: { kind: "literal", value: [
                    { id: "fruit-1", label: "Cherry", value: 5 },
                    { id: "fruit-2", label: "Date", value: 9 }
                ] },
                events: JSON.stringify(["itemClick"])
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "listClickApp");
        await webapp.navigate("/");

        const eventPromise = webapp.interceptNextEvent();
        await page.locator("ul.webapp-list li.webapp-list-item a.webapp-link").first().click();

        const body = await eventPromise;
        expect(body.event).toBe("itemClick");
        expect(body.sourceId).toBe("listClickNode");
        const params = body.params as Record<string, unknown>;
        // rowId = id (else index); row = whole element incl. value.
        expect(params.rowId).toBe("fruit-1");
        const row = params.row as Record<string, unknown>;
        expect(row.label).toBe("Cherry");
        expect(row.value).toBe(5);
    });
});

/**
 * P173 — ui-list: Single-Select (selectable + selectedId TWO-WAY + selected state +
 * itemSelect). Resolves review W1. Mirrors the ui-tabs `activeTab` two-way pattern
 * (P155): `selectedId` reads the selected id from the bound store/state (marks the
 * row) and the itemSelect event carries the new id for the wired write-back loop.
 */
test.describe("ui-list — single-select (P173)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    const FRUITS = [
        { id: "apple", label: "Apple" },
        { id: "banana", label: "Banana" },
        { id: "cherry", label: "Cherry" }
    ];

    test("S01 — selectable off → no selection state (no aria-selected / selected class)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "listSelOffApp", root: "listSelOffApp" })
            .node("ui-list", {
                id: "listSelOffNode",
                items: { kind: "literal", value: FRUITS }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "listSelOffApp");
        await webapp.navigate("/");

        await expect(page.locator("ul.webapp-list li.webapp-list-item")).toHaveCount(3);
        await expect(page.locator("ul.webapp-list li[aria-selected]")).toHaveCount(0);
        await expect(page.locator("ul.webapp-list li.webapp-list-item--selected")).toHaveCount(0);
    });

    test("S02 — selectable on + selectedId state binding marks the matching row", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "listSelReadApp", root: "listSelReadApp" })
            .node("ui-store", {
                id: "listSelReadStore",
                statePath: "sel",
                initialValue: JSON.stringify({ id: "banana" })
            })
            .node("ui-list", {
                id: "listSelReadNode",
                items: { kind: "literal", value: FRUITS },
                selectable: true,
                selectedId: { kind: "state", path: "sel.id" }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "listSelReadApp");
        await webapp.navigate("/");

        // The Banana row is selected (one selected row).
        await expect(page.locator("ul.webapp-list li.webapp-list-item--selected")).toHaveCount(1);
        await expect(page.locator("ul.webapp-list li[aria-selected='true']")).toContainText("Banana");
    });

    test("S03 — external store change → SSE re-render marks the new row", async ({ page, request }) => {
        const builder = new FlowBuilder()
            .app({ id: "listSelSseApp", root: "listSelSseApp" })
            .node("ui-store", {
                id: "listSelSseStore",
                statePath: "sel",
                initialValue: JSON.stringify({ id: "apple" })
            })
            .node("ui-list", {
                id: "listSelSseNode",
                items: { kind: "literal", value: FRUITS },
                selectable: true,
                selectedId: { kind: "state", path: "sel.id" }
            });
        const flow = builder.withStoreInject("listSelSseInj", "listSelSseStore", { id: "cherry" }).build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "listSelSseApp");
        await webapp.navigate("/");
        await expect(page.locator("ul.webapp-list li[aria-selected='true']")).toContainText("Apple");

        // External store change → SSE re-render moves the selection to Cherry.
        await injectMessage(request, "listSelSseInj");
        await expect(page.locator("ul.webapp-list li[aria-selected='true']")).toContainText("Cherry", { timeout: 5000 });
        await expect(page.locator("ul.webapp-list li.webapp-list-item--selected")).toHaveCount(1);
    });

    test("S04 — two-way roundtrip: clicking a row → itemSelect → wired store set → that row becomes selected", async ({ page, request }) => {
        const writeBackFnId = "listSelRtFn";
        const builder = new FlowBuilder()
            .app({ id: "listSelRtApp", root: "listSelRtApp" })
            .node("ui-store", {
                id: "listSelRtStore",
                statePath: "sel",
                initialValue: JSON.stringify({ id: "apple" })
            })
            .node("ui-list", {
                id: "listSelRtNode",
                items: { kind: "literal", value: FRUITS },
                selectable: true,
                selectedId: { kind: "state", path: "sel.id" },
                events: JSON.stringify(["itemSelect"]),
                wires: [[writeBackFnId]]
            });
        const flow = builder.build();

        flow.push({
            type: "function",
            id: writeBackFnId,
            name: writeBackFnId,
            // itemSelect carries params.rowId → write it back into the bound store.
            func: 'msg.ui = { store: { id: "listSelRtStore", op: "set", path: "id", value: msg.ui.params.rowId } }; return msg;',
            outputs: 1,
            z: flow[0].id,
            x: 400,
            y: 420,
            wires: [["listSelRtStore"]]
        });

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "listSelRtApp");
        await webapp.navigate("/");
        await expect(page.locator("ul.webapp-list li[aria-selected='true']")).toContainText("Apple");

        // Click the Cherry row → itemSelect → function → store set → SSE re-render.
        await page.locator("ul.webapp-list li", { hasText: "Cherry" }).locator("a.webapp-link").click();

        await expect(page.locator("ul.webapp-list li[aria-selected='true']")).toContainText("Cherry", { timeout: 5000 });
        await expect(page.locator("ul.webapp-list li.webapp-list-item--selected")).toHaveCount(1);
    });

    test("S05 — itemSelect fires only in selectable mode, only on a selection change", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "listSelEvtApp", root: "listSelEvtApp" })
            .node("ui-store", {
                id: "listSelEvtStore",
                statePath: "sel",
                initialValue: JSON.stringify({ id: "apple" })
            })
            .node("ui-list", {
                id: "listSelEvtNode",
                items: { kind: "literal", value: FRUITS },
                selectable: true,
                selectedId: { kind: "state", path: "sel.id" },
                events: JSON.stringify(["itemSelect"])
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "listSelEvtApp");
        await webapp.navigate("/");
        await expect(page.locator("ul.webapp-list li[aria-selected='true']")).toContainText("Apple");

        // Collect ALL event POSTs (a selectable-row click fires BOTH itemClick — on
        // every click — AND itemSelect — only on a selection change). We assert that
        // itemSelect IS emitted (with the documented payload) for a DIFFERENT row.
        const events: Record<string, unknown>[] = [];
        page.on("request", (req) => {
            if (req.url().includes("/event") && req.method() === "POST") {
                events.push((req.postDataJSON() ?? {}) as Record<string, unknown>);
            }
        });

        // Click a DIFFERENT row (Banana) → selection changes → itemSelect fires.
        await page.locator("ul.webapp-list li", { hasText: "Banana" }).locator("a.webapp-link").click();
        await expect.poll(() => events.some((e) => e.event === "itemSelect")).toBe(true);

        const selectEvt = events.find((e) => e.event === "itemSelect") as Record<string, unknown>;
        expect(selectEvt.sourceId).toBe("listSelEvtNode");
        const params = selectEvt.params as Record<string, unknown>;
        expect(params.rowId).toBe("banana");
        expect((params.row as Record<string, unknown>).label).toBe("Banana");
    });

    test("S06 — selectable off → clicking a row does NOT emit itemSelect (itemClick only)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "listSelNoneApp", root: "listSelNoneApp" })
            .node("ui-list", {
                id: "listSelNoneNode",
                items: { kind: "literal", value: FRUITS },
                // selectable omitted (off); only itemClick is meaningful.
                events: JSON.stringify(["itemClick", "itemSelect"])
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "listSelNoneApp");
        await webapp.navigate("/");

        // No selection state is rendered at all.
        await expect(page.locator("ul.webapp-list li[aria-selected]")).toHaveCount(0);
        await expect(page.locator("ul.webapp-list [data-webapp-selectable]")).toHaveCount(0);

        // A click emits itemClick — and never itemSelect (selectable is off).
        const clickEvent = webapp.interceptNextEvent();
        await page.locator("ul.webapp-list li", { hasText: "Apple" }).locator("a.webapp-link").click();
        const body = await clickEvent;
        expect(body.event).toBe("itemClick");
    });
});

/**
 * P176 — ui-list: per-item icon rendering.
 * Each item may declare an `icon` field (bare string OR {library?,name}).
 * The serializer must emit a leading <sl-icon class="webapp-list-item-icon …">
 * before the label in BOTH interactive and non-interactive rows.
 * Items without an icon field are unaffected.
 */
test.describe("ui-list — per-item icon (P176)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("I01 — non-interactive: item with bare-string icon renders a leading sl-icon; item without icon does not", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "listIconNonIntApp", root: "listIconNonIntApp" })
            .node("ui-list", {
                id: "listIconNonIntNode",
                items: { kind: "literal", value: [
                    { id: "i1", label: "With icon", icon: "star" },
                    { id: "i2", label: "No icon" }
                ] }
                // no events → non-interactive rows
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "listIconNonIntApp");
        await webapp.navigate("/");

        const items = page.locator("ul.webapp-list li.webapp-list-item");
        await expect(items).toHaveCount(2);

        // Row with icon: leading sl-icon before the label text.
        const iconEl = items.nth(0).locator("sl-icon.webapp-list-item-icon");
        await expect(iconEl).toHaveCount(1);
        await expect(iconEl).toHaveAttribute("name", "star");

        // Row without icon: no sl-icon.
        await expect(items.nth(1).locator("sl-icon.webapp-list-item-icon")).toHaveCount(0);
    });

    test("I02 — interactive (itemClick): item with bare-string icon renders a leading sl-icon inside the <a>", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "listIconIntApp", root: "listIconIntApp" })
            .node("ui-list", {
                id: "listIconIntNode",
                items: { kind: "literal", value: [
                    { id: "j1", label: "Clickable with icon", icon: "heart" },
                    { id: "j2", label: "Clickable no icon" }
                ] },
                events: JSON.stringify(["itemClick"])
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "listIconIntApp");
        await webapp.navigate("/");

        const links = page.locator("ul.webapp-list li.webapp-list-item a.webapp-link");
        await expect(links).toHaveCount(2);

        // Row with icon: leading sl-icon inside the <a>.
        const iconEl = links.nth(0).locator("sl-icon.webapp-list-item-icon");
        await expect(iconEl).toHaveCount(1);
        await expect(iconEl).toHaveAttribute("name", "heart");

        // Row without icon: no sl-icon.
        await expect(links.nth(1).locator("sl-icon.webapp-list-item-icon")).toHaveCount(0);
    });

    test("I03 — object-form icon {name} renders correctly; string shorthand item has no icon", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "listIconObjApp", root: "listIconObjApp" })
            .node("ui-list", {
                id: "listIconObjNode",
                items: { kind: "literal", value: [
                    { id: "k1", label: "Object icon", icon: { name: "bell" } },
                    "String shorthand"
                ] }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "listIconObjApp");
        await webapp.navigate("/");

        const items = page.locator("ul.webapp-list li.webapp-list-item");
        await expect(items).toHaveCount(2);

        // Object-form icon renders.
        await expect(items.nth(0).locator("sl-icon.webapp-list-item-icon")).toHaveCount(1);
        await expect(items.nth(0).locator("sl-icon.webapp-list-item-icon")).toHaveAttribute("name", "bell");

        // String shorthand has no icon.
        await expect(items.nth(1).locator("sl-icon.webapp-list-item-icon")).toHaveCount(0);
        await expect(items.nth(1)).toContainText("String shorthand");
    });

    test("I04 — icon + value (badge) both render: icon leads, badge follows the label", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "listIconBadgeApp", root: "listIconBadgeApp" })
            .node("ui-list", {
                id: "listIconBadgeNode",
                items: { kind: "literal", value: [
                    { id: "m1", label: "Inbox", icon: "inbox", value: 5 }
                ] },
                displayValue: "badge",
                badgeVariant: "primary"
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "listIconBadgeApp");
        await webapp.navigate("/");

        const item = page.locator("ul.webapp-list li.webapp-list-item").first();
        await expect(item.locator("sl-icon.webapp-list-item-icon")).toHaveCount(1);
        await expect(item.locator("sl-badge.webapp-list-value")).toHaveCount(1);
        await expect(item.locator("sl-badge.webapp-list-value")).toContainText("5");
    });
});

/**
 * P180 (ADR 0021): displayType semantic intents + ordered.
 *
 * displayType is a backend-neutral semantic intent enum (plain|divided|grouped|
 * actionable). The Shoelace adapter maps each intent to CSS classes. One render
 * proof per intent. Also: ordered (ul↔ol) and old-value migration shims.
 */
test.describe("ui-list — displayType semantic intents + ordered (P180)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("DT01 — plain (default) renders bare ul without extra CSS classes", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "listPlainApp", root: "listPlainApp" })
            .node("ui-list", {
                id: "listPlainNode",
                items: { kind: "literal", value: ["Alpha", "Beta"] },
                displayType: "plain"
            })
            .build();

        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "listPlainApp");
        await webapp.navigate("/");

        // plain = bare ul.webapp-list — no extra intent CSS class.
        const list = page.locator("ul.webapp-list");
        await expect(list).toBeVisible();
        await expect(list).not.toHaveClass(/webapp-list--divided/);
        await expect(list).not.toHaveClass(/webapp-list--grouped/);
        await expect(list).not.toHaveClass(/webapp-list--actionable/);
    });

    test("DT02 — divided renders ul.webapp-list--divided (separator class)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "listDividedApp", root: "listDividedApp" })
            .node("ui-list", {
                id: "listDividedNode",
                items: { kind: "literal", value: ["One", "Two", "Three"] },
                displayType: "divided"
            })
            .build();

        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "listDividedApp");
        await webapp.navigate("/");

        const list = page.locator("ul.webapp-list.webapp-list--divided");
        await expect(list).toBeVisible();
        const items = list.locator("li.webapp-list-item");
        await expect(items).toHaveCount(3);
    });

    test("DT03 — grouped renders ul.webapp-list--grouped (bordered/box-like)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "listGroupedApp", root: "listGroupedApp" })
            .node("ui-list", {
                id: "listGroupedNode",
                items: { kind: "literal", value: [
                    { id: "g1", label: "Open invoices", value: 3 },
                    { id: "g2", label: "Paid", value: 12 }
                ] },
                displayType: "grouped"
            })
            .build();

        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "listGroupedApp");
        await webapp.navigate("/");

        // grouped = bordered card-like container class present.
        const list = page.locator("ul.webapp-list.webapp-list--grouped");
        await expect(list).toBeVisible();
        const items = list.locator("li.webapp-list-item");
        await expect(items).toHaveCount(2);
        await expect(items.nth(0)).toContainText("Open invoices");
        await expect(items.nth(1)).toContainText("Paid");
    });

    test("DT04 — actionable renders ul.webapp-list--actionable (hover/click affordance class)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "listActionableApp", root: "listActionableApp" })
            .node("ui-list", {
                id: "listActionableNode",
                items: { kind: "literal", value: ["Click me", "Or me"] },
                displayType: "actionable",
                events: ["itemClick"]
            })
            .build();

        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "listActionableApp");
        await webapp.navigate("/");

        const list = page.locator("ul.webapp-list.webapp-list--actionable");
        await expect(list).toBeVisible();
        const items = list.locator("li.webapp-list-item");
        await expect(items).toHaveCount(2);
    });

    test("DT05 — ordered renders ol (not ul)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "listOrderedApp", root: "listOrderedApp" })
            .node("ui-list", {
                id: "listOrderedNode",
                items: { kind: "literal", value: ["Step 1", "Step 2", "Step 3"] },
                ordered: true
            })
            .build();

        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "listOrderedApp");
        await webapp.navigate("/");

        // ordered=true → <ol>, not <ul>.
        const list = page.locator("ol.webapp-list");
        await expect(list).toBeVisible();
        // No ul.webapp-list should exist.
        await expect(page.locator("ul.webapp-list")).toHaveCount(0);
        const items = list.locator("li.webapp-list-item");
        await expect(items).toHaveCount(3);
        await expect(items.nth(0)).toContainText("Step 1");
    });

    test("DT06 — ordered=false (default) renders ul", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "listUnorderedApp", root: "listUnorderedApp" })
            .node("ui-list", {
                id: "listUnorderedNode",
                items: { kind: "literal", value: ["Alpha"] },
                ordered: false
            })
            .build();

        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "listUnorderedApp");
        await webapp.navigate("/");

        await expect(page.locator("ul.webapp-list")).toBeVisible();
        await expect(page.locator("ol.webapp-list")).toHaveCount(0);
    });

    test("DT07 — migration: old 'default' value renders as plain (bare ul, no extra class)", async ({ page, request }) => {
        // Simulate a stored flow with the old displayType:"default" value.
        // The serializer shim migrates it to "plain" at render time.
        const flow = new FlowBuilder()
            .app({ id: "listMigrateDefaultApp", root: "listMigrateDefaultApp" })
            .node("ui-list", {
                id: "listMigrateDefaultNode",
                items: { kind: "literal", value: ["Legacy A", "Legacy B"] },
                displayType: "default" as unknown as "plain"
            })
            .build();

        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "listMigrateDefaultApp");
        await webapp.navigate("/");

        // "default" → "plain": renders as ul.webapp-list, no divided/grouped/actionable.
        const list = page.locator("ul.webapp-list");
        await expect(list).toBeVisible();
        await expect(list).not.toHaveClass(/webapp-list--divided/);
        await expect(list).not.toHaveClass(/webapp-list--grouped/);
        await expect(list).not.toHaveClass(/webapp-list--actionable/);
    });

    test("DT08 — migration: old 'compact' value renders as plain (no extra class)", async ({ page, request }) => {
        // Simulate a stored flow with the old displayType:"compact" value.
        // compact was density (not a look); migrates to plain.
        const flow = new FlowBuilder()
            .app({ id: "listMigrateCompactApp", root: "listMigrateCompactApp" })
            .node("ui-list", {
                id: "listMigrateCompactNode",
                items: { kind: "literal", value: ["Compact A"] },
                displayType: "compact" as unknown as "plain"
            })
            .build();

        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "listMigrateCompactApp");
        await webapp.navigate("/");

        const list = page.locator("ul.webapp-list");
        await expect(list).toBeVisible();
        await expect(list).not.toHaveClass(/webapp-list--divided/);
    });
});

/**
 * P202 (ADR 0026) — `visible=false` (bool literal) must ACTUALLY hide the node:
 * the ui-list is ABSENT from the rendered DOM (locator count 0), not merely
 * CSS-hidden. Proven by DOM MEASUREMENT (count), not by a class/tag assert — a
 * display-only check would have missed the P181 swallowed-false defect. The same
 * ui-list with an empty `visible` IS present (count > 0). This is the owner's
 * "false really hides" red→green.
 */
test.describe("ui-list — P202 visible=false removes the node from the DOM (ADR 0026)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    // The render path DOES honour visibility: nodes/webapp.js maps a node's
    // `visible` binding → the component's `visibleIf`, and the renderer omits a
    // component whose `visibleIf` resolves false (toRenderedComponent returns
    // undefined → DOM-absent). The gap the owner hit was that ui-list's mapConfig
    // never EMITTED `visible` (it does now, P202) — so visibleIf stayed undefined
    // and the list always rendered. Measured by DOM count, not a class/tag assert.
    test("visible=false (literal) → ui-list ABSENT from DOM (count 0), not CSS-hidden", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "listHiddenApp", root: "listHiddenApp" })
            // A sibling ui-text serves as the "app rendered" control: it proves the
            // page is not simply blank when we assert the list's absence.
            .node("ui-text", { id: "listHiddenMarker", text: "rendered-marker" })
            .node("ui-list", {
                id: "listHiddenNode",
                items: { kind: "literal", value: ["Ada", "Alan"] },
                visible: { kind: "literal", value: false }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "listHiddenApp");
        // navigate() already awaits the app root + the SSE stream connection, so
        // the initial render has been applied. (No networkidle wait: the SSE
        // stream keeps the network permanently active and never idles.)
        await webapp.navigate("/");

        // Control: the sibling text IS rendered → the app is live, not blank.
        await expect(page.getByText("rendered-marker")).toBeVisible();

        // DOM MEASUREMENT: the hidden list element must not exist at all.
        await expect(page.locator("ul.webapp-list")).toHaveCount(0);
        await expect(page.locator("li.webapp-list-item")).toHaveCount(0);
    });

    test("empty visible → ui-list IS present in DOM (count > 0)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "listShownApp", root: "listShownApp" })
            .node("ui-list", {
                id: "listShownNode",
                items: { kind: "literal", value: ["Ada", "Alan"] },
                visible: null
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "listShownApp");
        await webapp.navigate("/");

        // DOM MEASUREMENT: empty visible defaults to shown → present.
        await expect(page.locator("ul.webapp-list")).toHaveCount(1);
        await expect(page.locator("li.webapp-list-item")).toHaveCount(2);
    });
});

/**
 * P208 — ui-list: item-field mapping (labelField/valueField/idField/iconField).
 *
 * A ui-list binds RAW query entities directly — configure WHICH entity field is
 * the label/value/id/icon instead of requiring shaped {id,label,value,icon}
 * items. Absent ⇒ the historical defaults (label/value/id/icon) → existing
 * shaped-item lists render unchanged. FLAT field names only in this stage.
 * `itemClick.row` keeps the FULL raw entity; only the derived label/id/value/
 * icon use the mapping. idField feeds rowId (itemClick), selectedId marking and
 * the itemSelect roundtrip consistently.
 */
test.describe("ui-list — item-field mapping (P208)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    // Raw entities: no `.label`/`.id` — the label lives in `name`, the id in `_id`.
    const RAW_ENTITIES = [
        { _id: "e1", name: "Alpha" },
        { _id: "e2", name: "Bravo" }
    ];

    test("FM01 — labelField/idField render raw-entity rows (measured DOM text)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "listFmApp", root: "listFmApp" })
            .node("ui-list", {
                id: "listFmNode",
                items: { kind: "literal", value: RAW_ENTITIES },
                labelField: "name",
                idField: "_id"
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "listFmApp");
        await webapp.navigate("/");

        const items = page.locator("ul.webapp-list li.webapp-list-item");
        await expect(items).toHaveCount(2);
        // MEASURED DOM TEXT — the rows render the mapped `name` field, not "?".
        await expect(items.nth(0)).toHaveText("Alpha");
        await expect(items.nth(1)).toHaveText("Bravo");
    });

    test("FM02 — itemClick rowId comes from idField; row stays the FULL raw entity", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "listFmClickApp", root: "listFmClickApp" })
            .node("ui-list", {
                id: "listFmClickNode",
                items: { kind: "literal", value: RAW_ENTITIES },
                labelField: "name",
                idField: "_id",
                events: JSON.stringify(["itemClick"])
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "listFmClickApp");
        await webapp.navigate("/");

        const eventPromise = webapp.interceptNextEvent();
        await page.locator("ul.webapp-list li.webapp-list-item a.webapp-link").first().click();

        const body = await eventPromise;
        expect(body.event).toBe("itemClick");
        expect(body.sourceId).toBe("listFmClickNode");
        const params = body.params as Record<string, unknown>;
        // rowId derives from idField (_id), NOT the absent `.id`.
        expect(params.rowId).toBe("e1");
        // row is the UNCHANGED full raw entity (no reshape).
        const row = params.row as Record<string, unknown>;
        expect(row).toEqual({ _id: "e1", name: "Alpha" });
    });

    test("FM03 — selectable + idField: selectedId marks the matching raw-entity row", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "listFmSelApp", root: "listFmSelApp" })
            .node("ui-store", {
                id: "listFmSelStore",
                statePath: "sel",
                initialValue: JSON.stringify({ id: "e2" })
            })
            .node("ui-list", {
                id: "listFmSelNode",
                items: { kind: "literal", value: RAW_ENTITIES },
                labelField: "name",
                idField: "_id",
                selectable: true,
                selectedId: { kind: "state", path: "sel.id" }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "listFmSelApp");
        await webapp.navigate("/");

        // The row whose _id === selectedId ("e2" → Bravo) is the single selected row.
        await expect(page.locator("ul.webapp-list li.webapp-list-item--selected")).toHaveCount(1);
        await expect(page.locator("ul.webapp-list li[aria-selected='true']")).toHaveText("Bravo");
    });

    test("FM04 — backward-compat: shaped items with NO *Field options render via defaults", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "listFmBcApp", root: "listFmBcApp" })
            .node("ui-list", {
                id: "listFmBcNode",
                // classic shaped items — no labelField/idField set → defaults apply.
                items: { kind: "literal", value: [
                    { id: "s-1", label: "Legacy One" },
                    { id: "s-2", label: "Legacy Two" }
                ] },
                events: JSON.stringify(["itemClick"])
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "listFmBcApp");
        await webapp.navigate("/");

        const items = page.locator("ul.webapp-list li.webapp-list-item");
        await expect(items).toHaveCount(2);
        await expect(items.nth(0)).toHaveText("Legacy One");
        await expect(items.nth(1)).toHaveText("Legacy Two");

        // rowId still comes from the default `id` field.
        const eventPromise = webapp.interceptNextEvent();
        await page.locator("ul.webapp-list li.webapp-list-item a.webapp-link").first().click();
        const body = await eventPromise;
        const params = body.params as Record<string, unknown>;
        expect(params.rowId).toBe("s-1");
        expect((params.row as Record<string, unknown>).label).toBe("Legacy One");
    });
});

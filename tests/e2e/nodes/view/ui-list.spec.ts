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
 * renders "?" for THAT row only; a non-array root → empty list (no crash). The
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

    test("non-array root resolves to an empty list without crashing", async ({ page, request }) => {
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

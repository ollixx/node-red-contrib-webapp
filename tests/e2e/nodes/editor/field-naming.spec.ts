import { expect, test, type Page } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { gotoEditor } from "../../../helpers/editor-ready";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { NodeEditorPage } from "../../../helpers/node-editor-page";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P229 (ADR 0038) — legacy-field sweep: migration harness.
 *
 * The legacy editor fields are REMOVED from the authored `defaults` blocks; the
 * open-time migrations stay. Registration injects hidden migration-only defaults
 * (`migrationFields`, see editor-common.js `withMigrationDefaults`) so a legacy
 * flow still imports its legacy values into the editor, the `oneditprepare`
 * migration lifts them into the canonical field, and `oneditsave` DELETES the
 * legacy field so the saved node exports without it.
 *
 * Slice A — the dead pre-ADR-0027 input write-target pair `storeId`/`path`
 * (8 input nodes). A legacy flow opens showing the migrated `writeTo` store
 * binding and saves WITHOUT the legacy pair.
 *
 * Slice B — the residual `<base>Path` twins. One representative per field TYPE
 * (value: ui-badge `valuePath` + ui-input `valuePath`; label: ui-tab
 * `labelPath`; items: ui-list `itemsPath`; active*: ui-tabs `activeTabPath`):
 * the legacy flow renders unchanged (runtime migration), and open→save writes
 * ONLY the canonical binding field.
 */

/** Read selected fields off the live editor node config after a save. */
async function readNode(page: Page, nodeId: string, fields: string[]): Promise<Record<string, unknown>> {
    return page.evaluate((args) => {
        const node = RED.nodes.node(args.nodeId) as Record<string, unknown> | null;
        const out: Record<string, unknown> = {};
        if (node) {
            for (const f of args.fields) {
                out[f] = node[f];
            }
        }
        return out;
    }, { nodeId, fields });
}

// ─── Slice A — dead `storeId`/`path` pair on the 8 input nodes ───────────────

const STORE_WRITE_NODES = [
    "ui-input",
    "ui-select",
    "ui-checkbox",
    "ui-radio",
    "ui-switch",
    "ui-textarea",
    "ui-datepicker",
    "ui-slider"
] as const;

const APP_A = "fnaApp";
const STORE_A = "fnaStore";

/** One legacy flow: every input node carries the dead storeId/path pair. */
function legacyStoreWriteFlow() {
    const builder = new FlowBuilder().app({ id: APP_A, root: APP_A });
    builder.node("ui-store", { id: STORE_A, statePath: "draft", initialValue: "{}" });
    for (const type of STORE_WRITE_NODES) {
        const id = nodeIdFor(type);
        builder.node(type, {
            id,
            storeId: STORE_A,
            path: `sub_${id}`
        });
    }
    return builder.build();
}

function nodeIdFor(type: string): string {
    return `fna_${type.replace(/^ui-/, "")}`;
}

test.describe("P229 slice A — dead storeId/path pair migrates to writeTo", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("a legacy flow with storeId/path still renders (runtime migration intact)", async ({ page, request }) => {
        await deployFlow(request, legacyStoreWriteFlow());

        const webapp = new WebappPage(page, APP_A);
        await webapp.navigate("/");
        // The runtime `legacyStoreWriteTo` migration keeps the legacy configs
        // valid — every control mounts and renders. (`first()`: the datepicker
        // renders an inner sl-input of its own.)
        await expect(page.locator("sl-input").first()).toBeVisible();
        await expect(page.locator("sl-select").first()).toBeVisible();
        await expect(page.locator("sl-checkbox").first()).toBeVisible();
        await expect(page.locator("sl-radio-group").first()).toBeVisible();
        await expect(page.locator("sl-switch").first()).toBeVisible();
        await expect(page.locator("sl-textarea").first()).toBeVisible();
        await expect(page.locator("sl-range").first()).toBeVisible();
    });

    for (const type of STORE_WRITE_NODES) {
        test(`${type}: opens showing migrated writeTo, saves WITHOUT storeId/path`, async ({ page, request }) => {
            await deployFlow(request, legacyStoreWriteFlow());
            await gotoEditor(page);
            const editor = new NodeEditorPage(page);
            const id = nodeIdFor(type);

            await editor.openNode(id);
            // Open-time migration: the writeTo typedInput shows the store target
            // built from the legacy pair (store id + literal subPath envelope).
            expect(await editor.readTypedInputType("writeToBinding")).toBe("store");
            const carrier = await editor.readTypedInput("writeToBinding");
            expect(carrier).toContain(STORE_A);
            expect(carrier).toContain(`sub_${id}`);

            await editor.save();
            const n = await readNode(page, id, ["writeTo", "storeId", "path"]);
            expect(n.writeTo, `${type} writeTo migrated`).toMatchObject({
                kind: "store",
                path: STORE_A,
                subPath: { kind: "literal", value: `sub_${id}` }
            });
            expect(n.storeId, `${type} legacy storeId dropped`).toBeUndefined();
            expect(n.path, `${type} legacy path dropped`).toBeUndefined();
        });
    }
});

// ─── Slice B — residual `<base>Path` twins migrate to the canonical binding ──

const APP_B = "fnbApp";

/** One legacy flow: a representative per `<base>Path` field TYPE. */
function legacyPathTwinFlow() {
    return new FlowBuilder()
        .app({ id: APP_B, root: APP_B })
        .node("ui-store", {
            id: "fnbStore",
            statePath: "fnb",
            initialValue: JSON.stringify({
                badge: "B7",
                tabLabel: "TabOne",
                active: "fnbTab2",
                people: [{ label: "Grace" }],
                name: "Ada"
            })
        })
        // value (display): ui-badge valuePath
        .node("ui-badge", { id: "fnbBadge", valuePath: "fnb.badge", value: undefined, order: 0 })
        // value (input): ui-input valuePath
        .node("ui-input", { id: "fnbInput", valuePath: "fnb.name", value: undefined, order: 1 })
        // items: ui-list itemsPath
        .node("ui-list", { id: "fnbList", itemsPath: "fnb.people", order: 2 })
        // active*: ui-tabs activeTabPath — with two ui-tab children, the first
        // carrying a label: ui-tab labelPath.
        .node("ui-tabs", { id: "fnbTabs", activeTabPath: "fnb.active", order: 3 })
        .node("ui-tab", { id: "fnbTab1", mount: "ui-tabs:fnbTabs/content", labelPath: "fnb.tabLabel", order: 0 })
        .node("ui-tab", { id: "fnbTab2", mount: "ui-tabs:fnbTabs/content", label: { kind: "literal", value: "Two" }, order: 1 })
        .build();
}

/** The slice-B migration matrix: node → carrier element + canonical/legacy field. */
const PATH_TWIN_CASES = [
    { nodeId: "fnbBadge", carrier: "valueBinding", canonical: "value", legacy: "valuePath", path: "fnb.badge" },
    { nodeId: "fnbInput", carrier: "valueBinding", canonical: "value", legacy: "valuePath", path: "fnb.name" },
    { nodeId: "fnbList", carrier: "itemsBinding", canonical: "items", legacy: "itemsPath", path: "fnb.people" },
    { nodeId: "fnbTabs", carrier: "activeTabBinding", canonical: "activeTab", legacy: "activeTabPath", path: "fnb.active" },
    { nodeId: "fnbTab1", carrier: "labelBinding", canonical: "label", legacy: "labelPath", path: "fnb.tabLabel" }
] as const;

test.describe("P229 slice B — residual <base>Path twins migrate to canonical bindings", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("a legacy flow with <base>Path fields renders unchanged (runtime migration intact)", async ({ page, request }) => {
        await deployFlow(request, legacyPathTwinFlow());

        const webapp = new WebappPage(page, APP_B);
        await webapp.navigate("/");

        await expect(page.locator("sl-badge")).toContainText("B7");
        await expect(page.locator("ul.webapp-list li.webapp-list-item").first()).toContainText("Grace");
        await expect(page.locator("sl-tab[panel='fnbTab1']")).toContainText("TabOne");
        await expect(page.locator("sl-tab[panel='fnbTab2']")).toHaveAttribute("active", "");
    });

    for (const c of PATH_TWIN_CASES) {
        test(`${c.nodeId}: legacy ${c.legacy} opens as a state binding, save writes only \`${c.canonical}\``, async ({ page, request }) => {
            await deployFlow(request, legacyPathTwinFlow());
            await gotoEditor(page);
            const editor = new NodeEditorPage(page);

            await editor.openNode(c.nodeId);
            // Open-time migration: the binding carrier shows the migrated state
            // binding built from the legacy plain path.
            expect(await editor.readTypedInputType(c.carrier)).toBe("state");
            expect(await editor.readTypedInput(c.carrier)).toBe(c.path);

            await editor.save();
            const n = await readNode(page, c.nodeId, [c.canonical, c.legacy]);
            expect(n[c.canonical], `${c.nodeId} ${c.legacy} → ${c.canonical}`).toMatchObject({
                kind: "state",
                path: c.path
            });
            expect(n[c.legacy], `${c.nodeId} legacy ${c.legacy} dropped`).toBeUndefined();
        });
    }
});

// ─── Slice C — legacy `*Json` carriers + the pagination alias ────────────────

const APP_C = "fncApp";

/** One legacy flow: raw-JSON carriers + the pagination currentPagePath alias. */
function legacyJsonCarrierFlow() {
    return new FlowBuilder()
        .app({ id: APP_C, root: APP_C })
        .node("ui-store", {
            id: "fncStore",
            statePath: "fnc",
            initialValue: JSON.stringify({ page: 2 })
        })
        // legacy raw-JSON options carrier (builder default `options` suppressed)
        .node("ui-select", {
            id: "fncSelect",
            optionsJson: JSON.stringify([{ label: "EN", value: "en" }]),
            options: undefined,
            order: 0
        })
        .node("ui-radio", {
            id: "fncRadio",
            optionsJson: JSON.stringify([{ label: "Red", value: "red" }]),
            options: undefined,
            order: 1
        })
        // legacy raw-JSON items carrier
        .node("ui-breadcrumb", {
            id: "fncCrumb",
            itemsJson: JSON.stringify([{ label: "Home" }, { label: "Deep" }]),
            order: 2
        })
        // legacy pagination alias
        .node("ui-pagination", {
            id: "fncPager",
            currentPagePath: "fnc.page",
            total: { kind: "literal", value: 9 },
            order: 3
        })
        .build();
}

test.describe("P229 slice C — *Json carriers + currentPagePath migrate to canonical bindings", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("a legacy flow with *Json carriers + currentPagePath renders unchanged", async ({ page, request }) => {
        await deployFlow(request, legacyJsonCarrierFlow());

        const webapp = new WebappPage(page, APP_C);
        await webapp.navigate("/");

        await expect(page.locator("sl-option[value='en']")).toBeAttached();
        await expect(page.locator("sl-radio[value='red']")).toBeVisible();
        await expect(page.locator("sl-breadcrumb-item")).toHaveCount(2);
        await expect(page.locator(".webapp-pagination-page")).toContainText("2 / 9");
    });

    test("ui-select: legacy optionsJson opens in the Options field, save writes only `options`", async ({ page, request }) => {
        await deployFlow(request, legacyJsonCarrierFlow());
        await gotoEditor(page);
        const editor = new NodeEditorPage(page);

        await editor.openNode("fncSelect");
        expect(await editor.readTypedInputType("optionsField")).toBe("json");
        expect(await editor.readTypedInput("optionsField")).toContain("EN");

        await editor.save();
        const n = await readNode(page, "fncSelect", ["options", "optionsJson"]);
        expect(n.options).toMatchObject({ kind: "literal", value: [{ label: "EN", value: "en" }] });
        expect(n.optionsJson, "legacy optionsJson dropped").toBeUndefined();
    });

    test("ui-radio: legacy optionsJson opens in the Options field, save writes only `options`", async ({ page, request }) => {
        await deployFlow(request, legacyJsonCarrierFlow());
        await gotoEditor(page);
        const editor = new NodeEditorPage(page);

        await editor.openNode("fncRadio");
        expect(await editor.readTypedInputType("optionsField")).toBe("json");
        expect(await editor.readTypedInput("optionsField")).toContain("Red");

        await editor.save();
        const n = await readNode(page, "fncRadio", ["options", "optionsJson"]);
        expect(n.options).toMatchObject({ kind: "literal", value: [{ label: "Red", value: "red" }] });
        expect(n.optionsJson, "legacy optionsJson dropped").toBeUndefined();
    });

    test("ui-breadcrumb: legacy itemsJson opens as the literal Items value, save writes only `items`", async ({ page, request }) => {
        await deployFlow(request, legacyJsonCarrierFlow());
        await gotoEditor(page);
        const editor = new NodeEditorPage(page);

        await editor.openNode("fncCrumb");
        expect(await editor.readTypedInputType("itemsBinding")).toBe("literal");
        expect(await editor.readTypedInput("itemsBinding")).toContain("Home");

        await editor.save();
        const n = await readNode(page, "fncCrumb", ["items", "itemsJson"]);
        expect(n.items).toMatchObject({ kind: "literal", value: [{ label: "Home" }, { label: "Deep" }] });
        expect(n.itemsJson, "legacy itemsJson dropped").toBeUndefined();
    });

    test("ui-pagination: legacy currentPagePath opens as a state binding, save writes only `currentPage`", async ({ page, request }) => {
        await deployFlow(request, legacyJsonCarrierFlow());
        await gotoEditor(page);
        const editor = new NodeEditorPage(page);

        await editor.openNode("fncPager");
        expect(await editor.readTypedInputType("currentPageBinding")).toBe("state");
        expect(await editor.readTypedInput("currentPageBinding")).toBe("fnc.page");

        await editor.save();
        const n = await readNode(page, "fncPager", ["currentPage", "currentPagePath"]);
        expect(n.currentPage).toMatchObject({ kind: "state", path: "fnc.page" });
        expect(n.currentPagePath, "legacy currentPagePath dropped").toBeUndefined();
    });
});

// ─── Slice D — ui-textarea `rows` → `lines` (the only real rename) ───────────

const APP_D = "fndApp";

function legacyRowsFlow() {
    return new FlowBuilder()
        .app({ id: APP_D, root: APP_D })
        .node("ui-textarea", { id: "fndText", rows: 7, lines: undefined })
        .build();
}

test.describe("P229 slice D — ui-textarea rows renames to lines", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("a legacy flow with `rows` renders the same height (measured rows attribute)", async ({ page, request }) => {
        await deployFlow(request, legacyRowsFlow());

        const webapp = new WebappPage(page, APP_D);
        await webapp.navigate("/");
        // The runtime migrates rows → lines; the native sl-textarea `rows`
        // attribute (the measured height surface) is unchanged.
        await expect(page.locator("sl-textarea")).toHaveAttribute("rows", "7");
    });

    test("open migrates rows → lines; save writes only `lines`; height unchanged after deploy", async ({ page, request }) => {
        await deployFlow(request, legacyRowsFlow());
        await gotoEditor(page);
        const editor = new NodeEditorPage(page);

        await editor.openNode("fndText");
        // Open-time migration seeds the Lines field from the legacy rows value.
        expect(await editor.readField("lines")).toBe("7");

        await editor.save();
        const n = await readNode(page, "fndText", ["lines", "rows"]);
        expect(String(n.lines), "rows → lines").toBe("7");
        expect(n.rows, "legacy rows dropped").toBeUndefined();

        // Deploy the migrated node — the rendered height must be unchanged.
        await editor.deploy();
        const webapp = new WebappPage(page, APP_D);
        await webapp.navigate("/");
        await expect(page.locator("sl-textarea")).toHaveAttribute("rows", "7");
    });
});

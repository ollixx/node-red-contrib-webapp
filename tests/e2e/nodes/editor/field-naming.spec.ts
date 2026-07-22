import { readFileSync } from "node:fs";
import path from "node:path";

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

// ─── P228 — `parent` → `app` (owning-app field) category roundtrips ──────────
//
// The first P228 attempt died on migrate-on-save leaving `app` EMPTY (the
// ADR-0031 clobber class). These tests disprove that bug per node CATEGORY:
// one representative each for structure (ui-route), view (ui-text — no app
// carrier input), state (ui-store) and behavior (ui-action). A legacy node
// authored with `parent` must (a) open with the App picker FILLED (where the
// template has one), and (b) save `app` with the legacy `parent` deleted.

const APP_P = "p228App";

/** One legacy flow: a `parent`-authored representative per category. The
 *  explicit `parent` override makes FlowBuilder emit a PURE legacy node. */
function legacyParentFlow() {
    return new FlowBuilder()
        .app({ id: APP_P, root: APP_P })
        // view (BEFORE .route(): mounts into the app's own content slot)
        .node("ui-text", { id: "p228Text", parent: APP_P, text: "Legacy parent text" })
        // structure
        .route({ id: "p228Route", path: "/sub", parent: APP_P })
        // state + behavior
        .node("ui-store", { id: "p228Store", parent: APP_P, statePath: "p228" })
        .node("ui-action", { id: "p228Action", parent: APP_P })
        .build();
}

/** category → node id + whether the template carries the #node-input-app picker */
const PARENT_APP_CASES = [
    { category: "structure", type: "ui-route", nodeId: "p228Route", hasPicker: true },
    { category: "view", type: "ui-text", nodeId: "p228Text", hasPicker: false },
    { category: "state", type: "ui-store", nodeId: "p228Store", hasPicker: true },
    { category: "behavior", type: "ui-action", nodeId: "p228Action", hasPicker: true }
] as const;

test.describe("P228 — legacy `parent` migrates to canonical `app`", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("a legacy flow with `parent` still renders (runtime fallback intact)", async ({ page, request }) => {
        await deployFlow(request, legacyParentFlow());

        const webapp = new WebappPage(page, APP_P);
        await webapp.navigate("/");
        await expect(page.locator("text=Legacy parent text")).toBeVisible();
    });

    for (const c of PARENT_APP_CASES) {
        test(`${c.category} (${c.type}): opens with App ${c.hasPicker ? "picker FILLED" : "migrated"}, saves \`app\`, drops \`parent\``, async ({ page, request }) => {
            await deployFlow(request, legacyParentFlow());
            await gotoEditor(page);
            const editor = new NodeEditorPage(page);

            await editor.openNode(c.nodeId);
            if (c.hasPicker) {
                // On-open migration: the hidden #node-input-app carrier is
                // seeded from the legacy `parent` — the picker shows the app.
                expect(await editor.readField("app"), `${c.type} picker seeded from legacy parent`).toBe(APP_P);
            }

            await editor.save();
            const n = await readNode(page, c.nodeId, ["app", "parent"]);
            expect(n.app, `${c.type} app written on save`).toBe(APP_P);
            expect(n.parent, `${c.type} legacy parent dropped`).toBeUndefined();
        });
    }
});

// ─── P228 Gesamt-Beweis — a pre-rename FIXTURE flow loads, renders, migrates ─

test.describe("P228 — pre-rename fixture (parent-era flow)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("loads + renders unchanged; editor open→save→deploy migrates to `app`", async ({ page, request }) => {
        const fixture = JSON.parse(
            readFileSync(path.resolve(process.cwd(), "tests/e2e/fixtures/pre-rename-parent.flow.json"), "utf8")
        ) as Parameters<typeof deployFlow>[1];
        await deployFlow(request, fixture);

        // 1. The legacy flow renders unchanged.
        const webapp = new WebappPage(page, "preApp");
        await webapp.navigate("/");
        await expect(page.locator("text=Pre-rename text")).toBeVisible();

        // 2. Open the legacy store: the App picker is FILLED from `parent`.
        await gotoEditor(page);
        const editor = new NodeEditorPage(page);
        await editor.openNode("preStore");
        expect(await editor.readField("app")).toBe("preApp");

        // 3. Save migrates: `app` written, legacy `parent` deleted.
        await editor.save();
        const n = await readNode(page, "preStore", ["app", "parent"]);
        expect(n.app).toBe("preApp");
        expect(n.parent).toBeUndefined();

        // 4. Deploy the migrated flow — it still renders.
        await editor.deploy();
        await webapp.navigate("/");
        await expect(page.locator("text=Pre-rename text")).toBeVisible();
    });
});

// ─── P259 Stufe 1 — `layoutId` → `layout` (route / dialog / container) ───────
//
// The layout reference is renamed to the canonical bare name `layout` (ADR 0038
// rule (c)). A legacy flow authored with `layoutId` must (a) render unchanged
// (the runtime mapConfig reads `layout || layoutId`), (b) OPEN with the layout
// preset SelectBox FILLED from the legacy value, and (c) save `layout` with the
// legacy `layoutId` deleted (withReferenceFieldMigration in editor-common.js).

const TAB_L = "e2e-flow";
const APP_L = "p259App";

/** One legacy flow: route (grid) + container + dialog authored with `layoutId`. */
function legacyLayoutIdFlow(): Parameters<typeof deployFlow>[1] {
    return [
        { id: TAB_L, type: "tab", label: "P259 layoutId", disabled: false, info: "" },
        { type: "ui-app", id: APP_L, uiId: APP_L, name: "P259 App", title: "P259 App", root: APP_L, layout: "vertical", z: TAB_L, x: 100, y: 80, wires: [[]] },
        { type: "ui-route", id: "p259Route", uiId: "p259Route", name: "Page", app: APP_L, path: "/page", title: "Page", layoutId: "grid", events: "[]", outputs: 0, z: TAB_L, x: 100, y: 160, wires: [] },
        { type: "ui-container", id: "p259Cont", uiId: "p259Cont", name: "Card", app: APP_L, mount: "route:/page/content", layoutId: "vertical", order: 0, row: 1, col: 1, colSize: 6, z: TAB_L, x: 100, y: 220, wires: [[]] },
        { type: "ui-text", id: "p259Text", uiId: "p259Text", name: "Text", app: APP_L, mount: "container:p259Cont/content", text: "Legacy layout renders", z: TAB_L, x: 100, y: 280, wires: [[]] },
        { type: "ui-dialog", id: "p259Dialog", uiId: "p259Dialog", name: "Dialog", app: APP_L, title: "Dialog", layoutId: "dialog", modal: true, closable: true, events: "[]", outputs: 0, z: TAB_L, x: 100, y: 340, wires: [] }
    ];
}

/** node id → the legacy preset the SelectBox must show on open. */
const LAYOUT_RENAME_CASES = [
    { type: "ui-route", nodeId: "p259Route", preset: "grid" },
    { type: "ui-container", nodeId: "p259Cont", preset: "vertical" },
    { type: "ui-dialog", nodeId: "p259Dialog", preset: "dialog" }
] as const;

test.describe("P259 Stufe 1 — legacy `layoutId` migrates to canonical `layout`", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("a legacy flow with `layoutId` renders unchanged (runtime fallback intact)", async ({ page, request }) => {
        await deployFlow(request, legacyLayoutIdFlow());

        const webapp = new WebappPage(page, APP_L);
        await webapp.navigate("/page");
        // The legacy `layoutId: "grid"` still drives the route layout class and
        // the mounted container/text chain renders.
        await expect(page.locator(".webapp-layout--grid").first()).toBeVisible();
        await expect(page.locator("text=Legacy layout renders")).toBeVisible();
    });

    for (const c of LAYOUT_RENAME_CASES) {
        test(`${c.type}: opens with the preset FILLED ('${c.preset}'), saves \`layout\`, drops \`layoutId\``, async ({ page, request }) => {
            await deployFlow(request, legacyLayoutIdFlow());
            await gotoEditor(page);
            const editor = new NodeEditorPage(page);

            await editor.openNode(c.nodeId);
            // On-open migration: the layout preset SelectBox shows the legacy
            // value (seeded via the migrated `layout` carrier / getValue chain).
            expect(await editor.readField("layout-preset"), `${c.type} preset seeded from legacy layoutId`).toBe(c.preset);

            await editor.save();
            const n = await readNode(page, c.nodeId, ["layout", "layoutId"]);
            expect(n.layout, `${c.type} layoutId → layout`).toBe(c.preset);
            expect(n.layoutId, `${c.type} legacy layoutId dropped`).toBeUndefined();
        });
    }
});

// ─── P259 Stufe 2 — `routeId` → `route` + `definitionId` → `definition` ──────
//
// The route reference (ui-dialog parent route, ui-action navigate target) and
// the component-definition reference are renamed to the canonical bare names
// (ADR 0038 rule (c)). A legacy flow authored with `routeId`/`definitionId`
// must (a) render/behave unchanged (schema transitional union + runtime
// fallbacks), and (b) migrate to the canonical field on open→save.

const TAB_R = "e2e-flow";
const APP_R = "p259bApp";

/** One legacy flow: dialog routeId + navigate-action routeId + instance definitionId. */
function legacyIdSuffixFlow(): Parameters<typeof deployFlow>[1] {
    return [
        { id: TAB_R, type: "tab", label: "P259 id-suffix", disabled: false, info: "" },
        { type: "ui-app", id: APP_R, uiId: APP_R, name: "P259b App", title: "P259b App", root: APP_R, layout: "vertical", z: TAB_R, x: 100, y: 80, wires: [[]] },
        { type: "ui-route", id: "p259bRoute", uiId: "p259bRoute", name: "Page", app: APP_R, path: "/page", title: "Page", layout: "vertical", events: "[]", outputs: 0, z: TAB_R, x: 100, y: 160, wires: [] },
        // ui-dialog: legacy routeId (route-scoped to /page)
        { type: "ui-dialog", id: "p259bDialog", uiId: "p259bDialog", name: "Dialog", app: APP_R, title: "Dialog", layout: "vertical", routeId: "p259bRoute", modal: true, closable: true, events: "[]", outputs: 0, z: TAB_R, x: 100, y: 220, wires: [] },
        { type: "ui-text", id: "p259bDlgText", uiId: "p259bDlgText", name: "DlgText", app: APP_R, mount: "dialog:p259bDialog/content", text: "Scoped dialog body", z: TAB_R, x: 300, y: 220, wires: [[]] },
        // ui-action: legacy navigate routeId (route mode)
        { type: "ui-action", id: "p259bAction", uiId: "p259bAction", name: "Go", app: APP_R, actionType: "navigate", targetMode: "route", routeId: "p259bRoute", params: "[]", z: TAB_R, x: 100, y: 280, wires: [[]] },
        // ui-component-definition + instance: legacy definitionId
        { type: "ui-component-definition", id: "p259bDef", uiId: "p259bDef", name: "Widget", z: TAB_R, x: 400, y: 80, wires: [[]] },
        { type: "ui-text", id: "p259bDefText", uiId: "p259bDefText", name: "DefText", app: APP_R, mount: "def:p259bDef/content", text: "widget body", z: TAB_R, x: 400, y: 140, wires: [[]] },
        { type: "ui-component-instance", id: "p259bInst", uiId: "p259bInst", name: "Instance", app: APP_R, mount: "route:/page/content", definitionId: "p259bDef", props: {}, z: TAB_R, x: 100, y: 340, wires: [[]] }
    ];
}

test.describe("P259 Stufe 2 — legacy `routeId`/`definitionId` migrate to `route`/`definition`", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("a legacy flow with routeId/definitionId renders unchanged (runtime fallbacks intact)", async ({ page, request }) => {
        await deployFlow(request, legacyIdSuffixFlow());

        const webapp = new WebappPage(page, APP_R);
        // The instance's legacy definitionId still expands the definition subtree.
        await webapp.navigate("/page");
        await expect(page.locator("text=widget body")).toBeVisible();
        // The dialog's legacy routeId still route-scopes it: present under
        // ?dialog on its route, with its mounted child rendered.
        await webapp.navigate("/page?dialog=p259bDialog");
        await expect(page.locator("sl-dialog.webapp-dialog")).toBeAttached();
        await expect(page.locator("text=Scoped dialog body")).toBeAttached();
    });

    test("ui-dialog: opens with the Route picker FILLED, saves `route`, drops `routeId`", async ({ page, request }) => {
        await deployFlow(request, legacyIdSuffixFlow());
        await gotoEditor(page);
        const editor = new NodeEditorPage(page);

        await editor.openNode("p259bDialog");
        // On-open migration seeds the #node-input-route carrier from routeId.
        expect(await editor.readField("route"), "dialog route picker seeded from legacy routeId").toBe("p259bRoute");

        await editor.save();
        const n = await readNode(page, "p259bDialog", ["route", "routeId"]);
        expect(n.route, "dialog routeId → route").toBe("p259bRoute");
        expect(n.routeId, "legacy routeId dropped").toBeUndefined();
    });

    test("ui-action (navigate, route mode): opens with the Ziel-Route FILLED, saves `route`, drops `routeId`", async ({ page, request }) => {
        await deployFlow(request, legacyIdSuffixFlow());
        await gotoEditor(page);
        const editor = new NodeEditorPage(page);

        await editor.openNode("p259bAction");
        // The navigate controller reads the migrated #node-input-route carrier.
        expect(await editor.readField("route"), "navigate route carrier seeded from legacy routeId").toBe("p259bRoute");

        await editor.save();
        const n = await readNode(page, "p259bAction", ["route", "routeId", "targetMode"]);
        expect(n.route, "action routeId → route").toBe("p259bRoute");
        expect(n.routeId, "legacy routeId dropped").toBeUndefined();
        expect(n.targetMode, "route mode kept").toBe("route");
    });

    test("ui-component-instance: opens with the Definition picker FILLED, saves `definition`, drops `definitionId`", async ({ page, request }) => {
        await deployFlow(request, legacyIdSuffixFlow());
        await gotoEditor(page);
        const editor = new NodeEditorPage(page);

        await editor.openNode("p259bInst");
        expect(await editor.readField("definition"), "definition picker seeded from legacy definitionId").toBe("p259bDef");

        await editor.save();
        const n = await readNode(page, "p259bInst", ["definition", "definitionId"]);
        expect(n.definition, "instance definitionId → definition").toBe("p259bDef");
        expect(n.definitionId, "legacy definitionId dropped").toBeUndefined();
    });
});

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

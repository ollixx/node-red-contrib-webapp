import { test } from "@playwright/test";

import { deployFlow, resetFlow, type NodeDef } from "../../../helpers/admin-api";
import { NodeEditorPage } from "../../../helpers/node-editor-page";

/**
 * P217 (ADR 0031) — editor open→save round-trip for the `ui-dialog` parent-route
 * reference picker. P228 (ADR 0038): the field is now the canonical `route`
 * (renamed from `routeId`); the fixture below deploys the LEGACY `routeId` (plus
 * `parent`/`layoutId`) so this doubly proves back-compat load + migrate-on-save.
 *
 * `route` is a hidden-carrier reference field
 * (`installReferenceSelectors({ route: true })`, seeded via `#node-input-route`
 * with `seedValue: self.route || self.routeId`, `clearable: true`). If
 * `oneditprepare` fails to seed the carrier from the saved value, Node-RED's
 * field-copy on Done writes the empty carrier back over it — silently losing the
 * parent-route reference on the first edit. Runtime specs deploy the value pre-set
 * via the admin API and never drive the editor, so the clobber went uncaught.
 *
 * The migration (`withUiIdMigration`) lifts the legacy `routeId` into `route` on
 * open and re-seeds the carrier, so after Done the node carries ONLY `route`.
 * Single `assertEditorRoundTrip` call — the canonical way per node-testing.md.
 */

const TAB = "e2e-flow";

function roundTripFlow(): NodeDef[] {
    // app + two routes (so a value-change has a second target) + a dialog whose
    // routeId is pre-set to the first route. layoutId is required; modal/closable
    // carry their defaults.
    return [
        { id: TAB, type: "tab", label: "Dialog round-trip", disabled: false, info: "" },
        { type: "ui-app", id: "dlgApp", uiId: "dlgApp", name: "dlgApp", title: "dlgApp", root: "dlgApp", layout: "vertical", z: TAB, x: 100, y: 100, wires: [[]] },
        { type: "ui-route", id: "dlgRouteA", uiId: "dlgRouteA", name: "Route A", parent: "dlgApp", path: "/a", title: "Route A", layoutId: "vertical", z: TAB, x: 100, y: 160, wires: [[]] },
        { type: "ui-route", id: "dlgRouteB", uiId: "dlgRouteB", name: "Route B", parent: "dlgApp", path: "/b", title: "Route B", layoutId: "vertical", z: TAB, x: 100, y: 220, wires: [[]] },
        {
            type: "ui-dialog",
            id: "dlgDialog",
            uiId: "dlgDialog",
            name: "Dialog",
            parent: "dlgApp",
            title: "Dialog",
            layoutId: "vertical",
            routeId: "dlgRouteA",
            modal: true,
            closable: true,
            events: "[]",
            outputs: 0,
            z: TAB,
            x: 100,
            y: 280,
            wires: []
        }
    ];
}

test.describe("ui-dialog — route reference open→save round-trip", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("route survives open→Done and a value-change round-trips", async ({ page, request }) => {
        await deployFlow(request, roundTripFlow());

        const editor = new NodeEditorPage(page);
        await editor.open();

        await editor.assertEditorRoundTrip("dlgDialog", [
            { field: "route", carrier: "picker", expected: "dlgRouteA", newValue: "dlgRouteB" }
        ]);
    });
});

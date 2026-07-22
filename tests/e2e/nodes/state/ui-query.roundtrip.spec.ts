import { test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { NodeEditorPage } from "../../../helpers/node-editor-page";

/**
 * P217 (ADR 0031) — editor open→save round-trip for the `ui-query` reference
 * pickers: `params` (the params-store the query observes) and `refreshAction`
 * (the action that re-runs it).
 *
 * Both are hidden-carrier reference fields
 * (`installReferenceSelectors({ action: "#node-input-refreshAction", store:
 * "#node-input-params" })`). If `oneditprepare` fails to seed either carrier from
 * the saved config, Node-RED's field-copy on Done writes the empty carrier back
 * over the real property — silently losing the reference on the first edit.
 * Runtime specs deploy these pre-set via the admin API and never drive the
 * editor, so the clobber went uncaught.
 *
 * Seed sources: `params` ← `self.store || self.storeId || self.params` (ui-query's
 * own field is `params`, so it falls through to `self.params`); `refreshAction` ←
 * `self.action || self.selectAction || self.refreshAction` (falls through to
 * `self.refreshAction`). Removing either seed turns this red. One
 * `assertEditorRoundTrip` call covers both carriers — the canonical way per
 * `.ai/agents/node-testing.md`.
 */

test.describe("ui-query — params/refreshAction reference open→save round-trip", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("params and refreshAction survive open→Done and value-changes round-trip", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "qApp", root: "qApp" })
            .node("ui-store", { id: "qStore", app: "qApp", statePath: "params" })
            .node("ui-store", { id: "qStore2", app: "qApp", statePath: "params2" })
            .node("ui-action", { id: "qAction", app: "qApp", actionType: "navigate" })
            .node("ui-action", { id: "qAction2", app: "qApp", actionType: "navigate" })
            .node("ui-query", { id: "qQuery", app: "qApp", queryPath: "rows", params: "qStore", refreshAction: "qAction" })
            .build();

        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();

        await editor.assertEditorRoundTrip("qQuery", [
            { field: "params", carrier: "picker", expected: "qStore", newValue: "qStore2" },
            { field: "refreshAction", carrier: "picker", expected: "qAction", newValue: "qAction2" }
        ]);
    });
});

import { test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { NodeEditorPage } from "../../../helpers/node-editor-page";

/**
 * P217 (ADR 0031) — editor open→save round-trip for the `ui-store-read` `store`
 * reference picker.
 *
 * `store` is a hidden-carrier reference field (`installReferenceSelectors({ store:
 * "#node-input-store" })`, ADR 0028). It is the SAME clobber class the store
 * nodes hit: if `oneditprepare` fails to seed `#node-input-store` from the saved
 * `this.store`, Node-RED's field-copy on Done writes the empty carrier back over
 * `this.store`, silently losing the store reference on the first edit. Runtime
 * specs deploy `store` pre-set via the admin API and never drive the editor, so
 * the round-trip clobber went uncaught.
 *
 * The seed reads `self.store || self.storeId || self.params` (ui-store-read's own
 * field is `store`, so it seeds from `self.store`); removing that seed turns this
 * red. Single `assertEditorRoundTrip` call — the canonical way per
 * `.ai/agents/node-testing.md`.
 */

test.describe("ui-store-read — store reference open→save round-trip", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("store survives open→Done and a value-change round-trips", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "srApp", root: "srApp" })
            .node("ui-store", { id: "srStore", app: "srApp", statePath: "entity", initialValue: JSON.stringify({ name: "A" }) })
            .node("ui-store", { id: "srStore2", app: "srApp", statePath: "other", initialValue: JSON.stringify({ name: "B" }) })
            .node("ui-store-read", { id: "srRead", app: "srApp", store: "srStore", path: "name" })
            .build();

        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();

        await editor.assertEditorRoundTrip("srRead", [
            { field: "store", carrier: "picker", expected: "srStore", newValue: "srStore2" }
        ]);
    });
});

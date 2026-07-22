import { test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { NodeEditorPage } from "../../../helpers/node-editor-page";

/**
 * P215 (ADR 0031) — editor open→save round-trip for the `ui-store-action` `store`
 * reference picker.
 *
 * `store` is a hidden-carrier reference field (`installReferenceSelectors`). The
 * clobber bug (fixed 2026-07-13): its picker seeded from the legacy
 * `self.storeId || self.params` instead of `self.store`, so on open the hidden
 * `#node-input-store` was empty and Node-RED's field-copy wiped `this.store` to
 * "" on the first Done. Runtime specs deploy `store` pre-set and never drive the
 * editor, so the round-trip clobber went uncaught.
 *
 * This replaces the bespoke `ui-store-action-store-save.spec.ts` with a single
 * `assertEditorRoundTrip` call — the canonical way per `.ai/agents/node-testing.md`.
 * Removing the `store` seed in `installReferenceSelectors` turns this red.
 */

test.describe("ui-store-action — store reference open→save round-trip", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("store survives open→Done and a value-change round-trips", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "saApp", root: "saApp" })
            .node("ui-store", { id: "saStore", app: "saApp", statePath: "entity", initialValue: JSON.stringify({ name: "A" }) })
            .node("ui-store", { id: "saStore2", app: "saApp", statePath: "other", initialValue: JSON.stringify({ name: "B" }) })
            .node("ui-store-action", { id: "saAction", app: "saApp", store: "saStore", op: "set", path: "name", mode: "reference" })
            .build();

        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();

        await editor.assertEditorRoundTrip("saAction", [
            { field: "store", carrier: "picker", expected: "saStore", newValue: "saStore2" }
        ]);
    });
});

import { test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { NodeEditorPage } from "../../../helpers/node-editor-page";

/**
 * P217 (ADR 0031) — editor open→save round-trip for the `ui-query-action` `query`
 * reference picker.
 *
 * `query` is a hidden-carrier reference field (`installReferenceSelectors({ query:
 * "#node-input-query" })`, ADR 0029). If `oneditprepare` fails to seed
 * `#node-input-query` from the saved `this.query`, Node-RED's field-copy on Done
 * writes the empty carrier back over `this.query` — silently losing the query
 * reference on the first edit. Runtime specs deploy `query` pre-set via the admin
 * API and never drive the editor, so the round-trip clobber went uncaught.
 *
 * The seed reads `self.query` (ui-query-action's own field); removing that seed
 * turns this red. Single `assertEditorRoundTrip` call — the canonical way per
 * `.ai/agents/node-testing.md`.
 */

test.describe("ui-query-action — query reference open→save round-trip", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("query survives open→Done and a value-change round-trips", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "qaApp", root: "qaApp" })
            .node("ui-query", { id: "qaQuery", app: "qaApp", queryPath: "rows" })
            .node("ui-query", { id: "qaQuery2", app: "qaApp", queryPath: "other" })
            .node("ui-query-action", { id: "qaAction", app: "qaApp", query: "qaQuery", action: "refresh", mode: "reference" })
            .build();

        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();

        await editor.assertEditorRoundTrip("qaAction", [
            { field: "query", carrier: "picker", expected: "qaQuery", newValue: "qaQuery2" }
        ]);
    });
});

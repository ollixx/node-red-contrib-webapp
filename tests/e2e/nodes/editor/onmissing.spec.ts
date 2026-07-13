import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { NodeEditorPage } from "../../../helpers/node-editor-page";

/**
 * P219 (ADR 0034) — per-field `onMissing` selector (foundation: marker | ignore).
 *
 * The ui-text value field gains a plain native <select> (`On Missing`) that
 * persists onto the value BINDING:
 *  - `marker` (default) → the invalid-value marker "?" (today's behaviour)
 *  - `ignore`           → render empty ("") with no report
 *
 * These are EDITOR + BROWSER specs: (1) the selector is present, defaults to
 * `marker`, and round-trips `ignore` through save/re-open; (2) the running app
 * renders "?" for `marker` and empty for `ignore` on the SAME unresolvable
 * binding (a ui-text bound to a whole object store slice with no sub-path).
 */

type ValueBinding = { kind: string; path?: string; value?: unknown; onMissing?: string } | undefined;

async function readTextValue(page: Page, nodeId: string): Promise<ValueBinding> {
    return page.evaluate((id) => {
        const node = RED.nodes.node(id) as unknown as { value?: ValueBinding };
        return node?.value;
    }, nodeId);
}

// A ui-app + a /home route + a ui-store whose slice is a whole object ({}), and a
// ui-text bound to that store WITHOUT a sub-path. A whole-object slice bound to a
// text field is the deterministic "unresolvable display value" case: it renders
// "?" by default (marker) and empty under `ignore`. `onMissing` (when given) is
// set directly on the value binding — the schema keeps it, the renderer honours it.
function objectStoreFlow(appId: string, textId: string, onMissing?: "marker" | "ignore") {
    const storeId = `${appId}-store`;
    return new FlowBuilder()
        .app({ id: appId, root: appId, name: appId, title: appId, layout: "app" })
        .route({ id: `${appId}-route`, path: "/home", title: "Home", layoutId: "vertical" })
        .node("ui-store", { id: storeId, name: "obj", statePath: "obj", initialValue: "{}" })
        .node("ui-text", {
            id: textId,
            mount: "route:/home/content",
            value: { kind: "store", path: storeId, ...(onMissing ? { onMissing } : {}) }
        })
        .build();
}

test.describe("editor — per-field onMissing selector (P219)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("the On Missing selector is present, defaults to marker, and round-trips ignore", async ({ page, request }) => {
        await deployFlow(request, objectStoreFlow("omApp0", "omText0"));

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("omText0");

        // Present with exactly the two foundation values, defaulting to marker.
        await expect(page.locator("#node-input-onMissing")).toHaveCount(1);
        expect(await editor.selectOptionValues("onMissing")).toEqual(["marker", "ignore"]);
        expect(await editor.readField("onMissing")).toBe("marker");

        // Choose ignore + save → persisted onto the binding.
        await editor.fillField("onMissing", "ignore");
        await editor.save();
        const saved = await readTextValue(page, "omText0");
        expect(saved?.onMissing).toBe("ignore");

        // Re-open → the selector round-trips back to ignore.
        await editor.openNode("omText0");
        expect(await editor.readField("onMissing")).toBe("ignore");

        // Switch back to marker + save → the default is NOT persisted (absent).
        await editor.fillField("onMissing", "marker");
        await editor.save();
        const reverted = await readTextValue(page, "omText0");
        expect(reverted?.onMissing).toBeUndefined();
    });

    test("browser proof: marker renders '?' for an unresolvable binding", async ({ page, request }) => {
        await deployFlow(request, objectStoreFlow("omAppMarker", "omTextMarker", "marker"));

        await page.goto("/webapp/omAppMarker/home");
        await expect(page.locator(".webapp-text")).toHaveText("?");
    });

    test("browser proof: ignore renders EMPTY for the same unresolvable binding", async ({ page, request }) => {
        await deployFlow(request, objectStoreFlow("omAppIgnore", "omTextIgnore", "ignore"));

        await page.goto("/webapp/omAppIgnore/home");
        await expect(page.locator(".webapp-text")).toHaveText("");
    });
});

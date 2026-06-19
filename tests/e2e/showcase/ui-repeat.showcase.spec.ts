/**
 * ui-repeat — Showcase spec (P187, ADR 0022 §2).
 *
 * Pilot showcase for the `ui-repeat` node: a feature tour that walks the
 * three major binding modes in named `test.step` chapters. Produces a
 * readable review video under SHOWCASE=1 (P186).
 *
 * Features covered (per P187 acceptance criteria):
 *   - String array via whole-item + index (P184).
 *   - Object array via item.<field> (P165).
 *   - Keyed update: adding an item, verifying stable ids (P165).
 *   - Config-dialog cameo: items typedInput + keyField visible.
 *
 * See `tests/e2e/showcase/showcase-helpers.ts` for the pattern docs.
 */

import { expect, test } from "@playwright/test";

import { FlowBuilder, ShowcaseFlow, deployFlow, resetFlow } from "./showcase-helpers";
import { injectMessage } from "../../helpers/admin-api";

// Shared tab id used by all nodes in a single-flow build.
const TAB_ID = "e2e-flow";

/** Build the object-array repeat flow: ui-store + ui-repeat + ui-text child. */
function buildObjectRepeatFlow(extraItems?: { name: string }[]) {
    const people = [{ name: "Ada" }, { name: "Linus" }];
    if (extraItems) {
        people.push(...extraItems);
    }
    return new FlowBuilder()
        .app({ id: "repeatShowcaseApp", root: "repeatShowcaseApp" })
        .node("ui-store", {
            id: "repeatPeopleStore",
            statePath: "people",
            initialValue: JSON.stringify(people)
        })
        .node("ui-repeat", {
            id: "repeatPeopleRepeat",
            items: { kind: "store", path: "repeatPeopleStore" },
            keyField: "name",
            mount: "repeatShowcaseApp.content"
        })
        .node("ui-text", {
            id: "repeatPersonName",
            parent: "repeatPeopleRepeat",
            mount: "container:repeatPeopleRepeat/content",
            value: { kind: "item", path: "name" }
        })
        .build();
}

test.describe("ui-repeat showcase (P187)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("ui-repeat feature tour", async ({ page, request }) => {
        const sf = new ShowcaseFlow(page, request);

        // ── Step 1: String-array — whole-item + index ─────────────────────────
        await test.step("Step 1 — string array: whole-item + index (P184)", async () => {
            const flow = new FlowBuilder()
                .app({ id: "repeatShowcaseApp", root: "repeatShowcaseApp" })
                .node("ui-store", {
                    id: "repeatPrimStore",
                    statePath: "letters",
                    initialValue: JSON.stringify(["alpha", "beta", "gamma"])
                })
                .node("ui-repeat", {
                    id: "repeatPrimRepeat",
                    items: { kind: "store", path: "repeatPrimStore" },
                    mount: "repeatShowcaseApp.content"
                })
                .node("ui-text", {
                    id: "repeatPrimItem",
                    parent: "repeatPrimRepeat",
                    mount: "container:repeatPrimRepeat/content",
                    order: 0,
                    value: { kind: "item" }
                })
                .node("ui-text", {
                    id: "repeatPrimIndex",
                    parent: "repeatPrimRepeat",
                    mount: "container:repeatPrimRepeat/content",
                    order: 1,
                    value: { kind: "index" }
                })
                .build();

            await sf.deploy(flow);
            await sf.openApp("repeatShowcaseApp");

            // Whole-item clones the string; index the position; interleaved per element.
            const texts = page.locator(".webapp-text");
            await expect(texts).toHaveText(["alpha", "0", "beta", "1", "gamma", "2"]);
        });

        // ── Step 2: Object-array — item.<field> ───────────────────────────────
        await test.step("Step 2 — object array: item.name resolves per clone (P165)", async () => {
            await deployFlow(request, buildObjectRepeatFlow());
            const app = await sf.openApp("repeatShowcaseApp");
            void app;

            const rows = page.locator(".webapp-text");
            await expect(rows).toHaveCount(2);
            await expect(rows.nth(0)).toHaveText("Ada");
            await expect(rows.nth(1)).toHaveText("Linus");
        });

        // ── Step 3: Keyed update ───────────────────────────────────────────────
        await test.step("Step 3 — keyed update: add Grace, Ada and Linus keep their ids (P165)", async () => {
            // Inject an inject node into the flow so we can push a third person.
            const storeInjectFlow = (() => {
                const flow = buildObjectRepeatFlow();
                const funcId = "repeatGraceFn";
                const injectId = "repeatGraceInj";
                flow.push(
                    {
                        type: "inject",
                        id: injectId,
                        name: injectId,
                        props: [{ p: "payload" }],
                        repeat: "",
                        crontab: "",
                        once: false,
                        onceDelay: "0.1",
                        topic: "",
                        payload: "",
                        payloadType: "date",
                        z: TAB_ID,
                        x: 100,
                        y: 500,
                        wires: [[funcId]]
                    } as Record<string, unknown>,
                    {
                        type: "function",
                        id: funcId,
                        name: funcId,
                        func: 'msg.ui = { store: { id: "repeatPeopleStore", op: "replace", value: [{name:"Ada"},{name:"Linus"},{name:"Grace"}] } }; return msg;',
                        outputs: 1,
                        z: TAB_ID,
                        x: 300,
                        y: 500,
                        wires: [["repeatPeopleStore"]]
                    } as Record<string, unknown>
                );
                return flow;
            })();

            await deployFlow(request, storeInjectFlow);
            await sf.openApp("repeatShowcaseApp");

            const rows = page.locator(".webapp-text");
            await expect(rows).toHaveCount(2);

            // Stable keyed per-instance ids BEFORE the update.
            await expect(page.locator('[data-webapp-node="Ada#repeatPersonName"]')).toHaveText("Ada");
            await expect(page.locator('[data-webapp-node="Linus#repeatPersonName"]')).toHaveText("Linus");

            // Trigger the store replace.
            await injectMessage(request, "repeatGraceInj");

            // Grace is added; Ada and Linus keep their exact per-instance ids.
            await expect(rows).toHaveCount(3, { timeout: 5000 });
            await expect(page.locator('[data-webapp-node="Grace#repeatPersonName"]')).toHaveText("Grace");
            await expect(page.locator('[data-webapp-node="Ada#repeatPersonName"]')).toHaveText("Ada");
            await expect(page.locator('[data-webapp-node="Linus#repeatPersonName"]')).toHaveText("Linus");
        });

        // ── Step 4: Config-dialog cameo ───────────────────────────────────────
        await test.step("Step 4 — config dialog: items typedInput + keyField visible", async () => {
            // Deploy a clean object-array flow so the node id is known.
            await deployFlow(request, buildObjectRepeatFlow());
            await sf.openEditor(["ui-repeat", "ui-app"]);
            await sf.openNodeConfig("repeatPeopleRepeat");
            // The items typedInput (carrier #node-input-itemsBinding, P190 fix) and
            // keyField text input must be present.
            await expect(page.locator("#node-input-itemsBinding")).toHaveCount(1);
            await expect(page.locator("#node-input-keyField")).toHaveCount(1);
            await sf.closeNodeConfig();
        });
    });
});

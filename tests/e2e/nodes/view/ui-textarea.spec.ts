import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { NodeEditorPage } from "../../../helpers/node-editor-page";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P44 — per-node E2E specs for ui-textarea (interactive view node).
 *
 * Covers:
 *   - rendering: sl-textarea is visible with label attribute.
 *   - events: sl-change → POST /event { event:"change", params:{ value: string } }.
 *
 * P82: inject → value update behaviour is covered by classic unit tests
 * (packages/runtime/test/p82-input-nodes-behaviour.test.ts).
 *
 * P128 (ADR 0012): value → canonical typedInput (full set); valuePath migration;
 * bindable disabled (boolean category, incl. Store).
 */

test.describe("ui-textarea (P44)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    // ─── rendering ───────────────────────────────────────────────────────────

    test("renders sl-textarea with label attribute", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "taApp1", root: "taApp1" })
            .node("ui-textarea", { id: "taNode1", label: "Notes" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "taApp1");
        await webapp.navigate("/");
        await expect(page.locator("sl-textarea")).toBeVisible();
        await expect(page.locator("sl-textarea")).toHaveAttribute("label", "Notes");
    });

    test("disabled renders sl-textarea[disabled]", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "taApp2", root: "taApp2" })
            .node("ui-textarea", {
                id: "taNode2",
                label: "Read-only notes",
                disabled: { kind: "literal", value: true }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "taApp2");
        await webapp.navigate("/");
        await expect(page.locator("sl-textarea[disabled]")).toBeVisible();
    });

    // ─── events — output port ────────────────────────────────────────────────

    test("sl-change → POST /event with { event:'change', params:{ value: string } }", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "taApp3", root: "taApp3" })
            .node("ui-textarea", { id: "taNode3", label: "Description" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "taApp3");
        await webapp.navigate("/");

        const eventPromise = webapp.interceptNextEvent();

        await page.evaluate(() => {
            const el = document.querySelector("sl-textarea") as HTMLElement & { value: string };
            if (el) {
                el.value = "My text";
                el.dispatchEvent(new CustomEvent("sl-change", { bubbles: true, composed: true }));
            }
        });

        const body = await eventPromise;
        expect(body.event).toBe("change");
        expect((body.params as Record<string, unknown>).value).toBe("My text");
    });

    // ─── P128: value typedInput — literal binding ─────────────────────────────

    test("P128: value binding (literal string) renders as initial textarea value", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "taApp4", root: "taApp4" })
            .node("ui-textarea", {
                id: "taNode4",
                label: "Notes",
                value: { kind: "literal", value: "Hello world" }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "taApp4");
        await webapp.navigate("/");
        await expect(page.locator("sl-textarea")).toHaveAttribute("value", "Hello world");
    });

    // ─── P128: valuePath legacy migration ────────────────────────────────────

    test("P128: legacy valuePath is accepted and renders textarea without crash", async ({ page, request }) => {
        // A pre-P128 config uses plain `valuePath` with no `value` binding object.
        // webapp.js migrates it via getBinding(config.value, stateBinding(config.valuePath)).
        const flow = new FlowBuilder()
            .app({ id: "taApp5", root: "taApp5" })
            .node("ui-textarea", {
                id: "taNode5",
                label: "Legacy",
                valuePath: "form.notes",
                value: null
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "taApp5");
        await webapp.navigate("/");
        // The textarea renders (no crash); value is empty because store is not seeded.
        await expect(page.locator("sl-textarea")).toBeVisible();
    });

    // ─── P128: disabled binding ───────────────────────────────────────────────

    test("P128: disabled=false (literal) renders enabled sl-textarea", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "taApp6", root: "taApp6" })
            .node("ui-textarea", {
                id: "taNode6",
                label: "Editable",
                disabled: { kind: "literal", value: false }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "taApp6");
        await webapp.navigate("/");
        await expect(page.locator("sl-textarea")).toBeVisible();
        // Must NOT carry the disabled attribute.
        await expect(page.locator("sl-textarea[disabled]")).toHaveCount(0);
    });

    // ─── writeTo write-back (P204 / ADR 0027) — measured, no wiring ────────────

    test("W01 — writeTrigger=submit: blur persists the text and a second bound view updates live", async ({ page, request }) => {
        // A textarea is text-like: submit mode confirms on BLUR (Enter inserts a
        // newline). Measured proof: a second ui-text bound to the same store slice
        // shows the new text over SSE, with NO function wiring.
        const flow = new FlowBuilder()
            .app({ id: "taWbApp", root: "taWbApp" })
            .node("ui-store", { id: "taWbStore", statePath: "form", initialValue: JSON.stringify({ notes: "seed" }) })
            .node("ui-textarea", {
                id: "taWbIn",
                label: "Notes",
                value: { kind: "store", path: "taWbStore", subPath: { kind: "literal", value: "notes" } },
                writeTo: { kind: "store", path: "taWbStore", subPath: { kind: "literal", value: "notes" } },
                writeTrigger: "submit"
            })
            .node("ui-text", {
                id: "taWbOut",
                value: { kind: "store", path: "taWbStore", subPath: { kind: "literal", value: "notes" } }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "taWbApp");
        await webapp.navigate("/");
        await expect(webapp.root().locator(".webapp-text")).toContainText("seed");

        // A change event alone must NOT write in submit mode.
        await page.evaluate(() => {
            const el = document.querySelector("sl-textarea") as HTMLElement & { value: string };
            el.value = "typed";
            el.dispatchEvent(new CustomEvent("sl-change", { bubbles: true, composed: true }));
        });
        await page.waitForTimeout(400);
        await expect(webapp.root().locator(".webapp-text")).toContainText("seed");

        // Blur (focusout) is the textarea's submit gesture → write-back fires.
        await page.evaluate(() => {
            const el = document.querySelector("sl-textarea") as HTMLElement & { value: string };
            el.value = "committed";
            el.dispatchEvent(new FocusEvent("focusout", { bubbles: true, composed: true }));
        });
        await expect(webapp.root().locator(".webapp-text")).toContainText("committed", { timeout: 5000 });
    });

    test("W02 — writeTrigger=change: every change persists and the bound view updates live", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "taWb2App", root: "taWb2App" })
            .node("ui-store", { id: "taWb2Store", statePath: "form", initialValue: JSON.stringify({ notes: "init" }) })
            .node("ui-textarea", {
                id: "taWb2In",
                label: "Notes",
                value: { kind: "store", path: "taWb2Store", subPath: { kind: "literal", value: "notes" } },
                writeTo: { kind: "store", path: "taWb2Store", subPath: { kind: "literal", value: "notes" } },
                writeTrigger: "change"
            })
            .node("ui-text", {
                id: "taWb2Out",
                value: { kind: "store", path: "taWb2Store", subPath: { kind: "literal", value: "notes" } }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "taWb2App");
        await webapp.navigate("/");
        await expect(webapp.root().locator(".webapp-text")).toContainText("init");

        await page.evaluate(() => {
            const el = document.querySelector("sl-textarea") as HTMLElement & { value: string };
            el.value = "live-typing";
            el.dispatchEvent(new CustomEvent("sl-change", { bubbles: true, composed: true }));
        });

        await expect(webapp.root().locator(".webapp-text")).toContainText("live-typing", { timeout: 5000 });
    });

});

// ─── P128: editor panel ───────────────────────────────────────────────────────

test.describe("ui-textarea editor panel (P128)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("P128: canonical fields present — valueBinding + disabledBinding; label drives validity", async ({ page, request }) => {
        // Deploy with empty label → node is invalid (required field).
        const flow = new FlowBuilder()
            .app({ id: "taEdApp1", root: "taEdApp1" })
            .node("ui-textarea", { id: "taEdNode1", label: "" })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("taEdNode1");

        // P128: valueBinding and disabledBinding typedInputs must be present.
        await editor.expectFields(["name", "mount", "label", "valueBinding", "disabledBinding"]);

        // Empty required label → invalid.
        expect(await editor.getValidationState("taEdNode1")).toBe("invalid");

        // Fill label via typedInput helper (label is now a typedInput widget).
        await editor.fillTypedInput("label", "My Textarea");
        await editor.save();
        expect(await editor.getValidationState("taEdNode1")).toBe("valid");

        await editor.openNode("taEdNode1");
        expect(await editor.readTypedInput("label")).toBe("My Textarea");
    });
});

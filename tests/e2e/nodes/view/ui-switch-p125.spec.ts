import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P125 — E2E specs for ui-switch value→canonical typedInput + valuePath
 * migration + bindable disabled (ADR 0012).
 *
 * Covers (see tests/e2e/nodes/view/ui-switch.tests.md — P125 section):
 *   - value: literal boolean → switch checked/unchecked state.
 *   - valuePath migration: legacy string path → treated as state binding at
 *     runtime (mapConfig already handles this; behaviour is tested server-side
 *     via unit tests; here we assert the round-trip from the editor perspective
 *     i.e. the rendered state when value is a state binding object).
 *   - disabled: literal true → sl-switch[disabled].
 *   - disabled: literal false → sl-switch active.
 *   - disabled: store binding (truthy initial value) → sl-switch[disabled].
 *
 * NOTE: Do NOT run this file directly in the worktree — the orchestrator runs
 * the full E2E suite on develop after merge (parallel worktree Playwright
 * collides on port 1882). Written per .ai/agents/node-testing.md.
 */

test.describe("ui-switch P125 — value typedInput + disabled binding", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    // ── value: literal boolean ───────────────────────────────────────────────

    test("value: literal true → sl-switch is checked", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "sw125App1", root: "sw125App1" })
            .node("ui-switch", {
                id: "sw125Node1",
                label: "Dark mode",
                value: { kind: "literal", value: true }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "sw125App1");
        await webapp.navigate("/");

        // Outcome: sl-switch present and its `checked` attribute is set.
        const sw = page.locator("sl-switch");
        await expect(sw).toBeVisible();
        // A Shoelace sl-switch reflects checked state via the `checked` attribute
        // when the initial value is truthy.
        await expect(sw).toHaveAttribute("checked", "");
    });

    test("value: literal false → sl-switch is unchecked", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "sw125App2", root: "sw125App2" })
            .node("ui-switch", {
                id: "sw125Node2",
                label: "Notifications",
                value: { kind: "literal", value: false }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "sw125App2");
        await webapp.navigate("/");

        const sw = page.locator("sl-switch");
        await expect(sw).toBeVisible();
        await expect(sw).not.toHaveAttribute("checked");
    });

    // ── value: store binding ─────────────────────────────────────────────────

    test("value: store binding with truthy initial value → sl-switch is checked", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "sw125App3", root: "sw125App3" })
            .node("ui-store", { id: "sw125Store3", statePath: "darkMode", initialValue: "true" })
            .node("ui-switch", {
                id: "sw125Node3",
                label: "Dark mode",
                value: { kind: "store", path: "sw125Store3" }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "sw125App3");
        await webapp.navigate("/");

        const sw = page.locator("sl-switch");
        await expect(sw).toBeVisible();
        await expect(sw).toHaveAttribute("checked", "");
    });

    // ── disabled: literal boolean ────────────────────────────────────────────

    test("disabled: literal true → sl-switch[disabled]", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "sw125App4", root: "sw125App4" })
            .node("ui-switch", {
                id: "sw125Node4",
                label: "Locked",
                value: { kind: "literal", value: false },
                disabled: { kind: "literal", value: true }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "sw125App4");
        await webapp.navigate("/");

        await expect(page.locator("sl-switch[disabled]")).toBeVisible();
    });

    test("disabled: literal false → sl-switch is active (no disabled attribute)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "sw125App5", root: "sw125App5" })
            .node("ui-switch", {
                id: "sw125Node5",
                label: "Active",
                value: { kind: "literal", value: false },
                disabled: { kind: "literal", value: false }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "sw125App5");
        await webapp.navigate("/");

        const sw = page.locator("sl-switch");
        await expect(sw).toBeVisible();
        await expect(sw).not.toHaveAttribute("disabled");
    });

    // ── disabled: store binding ──────────────────────────────────────────────

    test("disabled: store binding (truthy) → sl-switch[disabled]", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "sw125App6", root: "sw125App6" })
            .node("ui-store", { id: "sw125Store6", statePath: "isLocked", initialValue: "true" })
            .node("ui-switch", {
                id: "sw125Node6",
                label: "Locked by store",
                value: { kind: "literal", value: false },
                disabled: { kind: "store", path: "sw125Store6" }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "sw125App6");
        await webapp.navigate("/");

        // Outcome: sl-switch is disabled because the store's initial value is truthy.
        await expect(page.locator("sl-switch[disabled]")).toBeVisible();
    });

    test("disabled: absent → sl-switch is active", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "sw125App7", root: "sw125App7" })
            .node("ui-switch", {
                id: "sw125Node7",
                label: "No disabled field",
                value: { kind: "literal", value: false }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "sw125App7");
        await webapp.navigate("/");

        const sw = page.locator("sl-switch");
        await expect(sw).toBeVisible();
        await expect(sw).not.toHaveAttribute("disabled");
    });
});

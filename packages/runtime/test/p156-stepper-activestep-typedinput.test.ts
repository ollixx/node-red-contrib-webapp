import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const webapp = require("../../../nodes/webapp.js") as {
    __test__: {
        runtimeNodeRegistry: Record<string, { mapConfig: (config: Record<string, unknown>) => unknown }>;
        renderAppPage: (appId: string, location: string, dialogId: string | undefined, definitions: unknown[]) => { status: number; body: string };
        getAppModelResult: (appId: string, definitions: unknown[]) => { success: boolean; model?: unknown };
    };
};

const { runtimeNodeRegistry, renderAppPage } = webapp.__test__;

function buildDefinitions(rawNodes: Record<string, unknown>[]) {
    return rawNodes.map((node) => {
        const reg = runtimeNodeRegistry[node.type as string];
        return reg?.mapConfig ? { ...(reg.mapConfig(node) as Record<string, unknown>), z: node.z } : { ...node, id: node.id };
    });
}

/**
 * P156 (ADR 0012) — ui-stepper field-typing wave 2.
 *
 * `activeStepPath` → `activeStep` (canonical value typedInput, TWO-WAY: reads the
 * active step from a Store/state binding AND, on step change, the existing
 * `stepChange` event carries the chosen step so a wired flow writes it back). The
 * canonical field carries a binding OBJECT; the legacy plain-string
 * `activeStepPath` migrates losslessly to `{kind:"state", path}`.
 *
 * Scope is ONLY the active step — the `steps` list is out of scope.
 * Mirrors the P155 ui-tabs `activeTab` and P154 ui-pagination `currentPage` pattern.
 */
describe("P156: ui-stepper — activeStep canonical typedInput", () => {
    const reg = runtimeNodeRegistry["ui-stepper"];
    const steps = JSON.stringify([{ id: "s1", label: "Step 1" }, { id: "s2", label: "Step 2" }]);

    it("canonical activeStep binding object drives activeStep", () => {
        const def = reg.mapConfig({
            id: "st1",
            mount: "app1.content",
            steps,
            activeStep: { kind: "state", path: "wizard.step" }
        }) as Record<string, unknown>;

        const activeStep = def.activeStep as Record<string, unknown> | undefined;
        expect(activeStep?.kind).toBe("state");
        expect(activeStep?.path).toBe("wizard.step");
    });

    it("activeStep accepts a store binding (two-way source)", () => {
        const def = reg.mapConfig({
            id: "st2",
            mount: "app1.content",
            steps,
            activeStep: { kind: "store", storeId: "s", path: "step" }
        }) as Record<string, unknown>;

        const activeStep = def.activeStep as Record<string, unknown> | undefined;
        expect(activeStep?.kind).toBe("store");
        expect(activeStep?.path).toBe("step");
    });

    it("activeStep accepts a literal binding (step id string)", () => {
        const def = reg.mapConfig({
            id: "st3",
            mount: "app1.content",
            steps,
            activeStep: { kind: "literal", value: "s2" }
        }) as Record<string, unknown>;

        const activeStep = def.activeStep as Record<string, unknown> | undefined;
        expect(activeStep?.kind).toBe("literal");
        expect(activeStep?.value).toBe("s2");
    });

    it("legacy activeStepPath migrates to a state binding", () => {
        const def = reg.mapConfig({
            id: "st4",
            mount: "app1.content",
            steps,
            activeStepPath: "wizard.step"
        }) as Record<string, unknown>;

        const activeStep = def.activeStep as Record<string, unknown> | undefined;
        expect(activeStep?.kind).toBe("state");
        expect(activeStep?.path).toBe("wizard.step");
    });

    it("canonical activeStep wins over legacy activeStepPath when both present", () => {
        const def = reg.mapConfig({
            id: "st5",
            mount: "app1.content",
            steps,
            activeStep: { kind: "store", storeId: "s", path: "step" },
            activeStepPath: "legacy.step"
        }) as Record<string, unknown>;

        const activeStep = def.activeStep as Record<string, unknown> | undefined;
        expect(activeStep?.kind).toBe("store");
        expect(activeStep?.path).toBe("step");
    });

    it("no activeStep and no activeStepPath leaves activeStep undefined", () => {
        const def = reg.mapConfig({
            id: "st6",
            mount: "app1.content",
            steps
        }) as Record<string, unknown>;

        expect(def.activeStep).toBeUndefined();
    });

    it("the stepChange event is preserved alongside the activeStep binding", () => {
        const def = reg.mapConfig({
            id: "st7",
            mount: "app1.content",
            steps,
            activeStep: { kind: "state", path: "wizard.step" },
            events: JSON.stringify(["stepChange"])
        }) as Record<string, unknown>;

        expect(def.events).toEqual(["stepChange"]);
    });
});

/**
 * P156 read-resolution: the activeStep binding routes through bind.value, so the
 * renderer resolves the active step id (literal / store / state source) and the
 * serializer marks the matching step active. This is the SAME read path P154/P155
 * established for ui-pagination currentPage / ui-tabs activeTab.
 */
describe("P156: ui-stepper — activeStep read-resolution into the active step", () => {
    const steps = JSON.stringify([
        { id: "details", label: "Details" },
        { id: "review", label: "Review" }
    ]);

    // The stepper serializer marks the active step by numeric index (data-webapp-step)
    // and stamps webapp-step--active on the matching button. The bound activeStep value
    // is that index, resolved from the literal / store / state source into component.value.
    function activeIndex(body: string): number {
        const re = /data-webapp-step="(\d+)"[^>]*>/g;
        // find the button that carries webapp-step--active
        const m = body.match(/<button class="webapp-step webapp-step--active"[^>]*data-webapp-step="(\d+)"/);
        void re;
        return m ? Number(m[1]) : -1;
    }

    it("a literal activeStep (index) marks the matching step active", () => {
        const definitions = buildDefinitions([
            { type: "ui-app", id: "stepResApp", name: "Stepper", root: "stepResApp", layout: "app", z: "f1" },
            { type: "ui-stepper", id: "stepRes1", mount: "stepResApp.content", steps, activeStep: { kind: "literal", value: 1 }, z: "f1" }
        ]);

        const result = renderAppPage("stepResApp", "/", undefined, definitions);
        expect(result.status).toBe(200);
        expect(activeIndex(result.body)).toBe(1);
    });

    it("a state activeStep resolves the active step index from the store", () => {
        const definitions = buildDefinitions([
            { type: "ui-app", id: "stepResApp2", name: "Stepper", root: "stepResApp2", layout: "app", z: "f1" },
            { type: "ui-store", id: "stepResStore", statePath: "wizard", initialValue: JSON.stringify({ step: 1 }), z: "f1" },
            { type: "ui-stepper", id: "stepRes2", mount: "stepResApp2.content", steps, activeStep: { kind: "state", path: "wizard.step" }, z: "f1" }
        ]);

        const result = renderAppPage("stepResApp2", "/", undefined, definitions);
        expect(result.status).toBe(200);
        expect(activeIndex(result.body)).toBe(1);
    });

    it("a legacy activeStepPath still resolves the active step index from the store", () => {
        const definitions = buildDefinitions([
            { type: "ui-app", id: "stepResApp3", name: "Stepper", root: "stepResApp3", layout: "app", z: "f1" },
            { type: "ui-store", id: "stepResStore3", statePath: "wizard", initialValue: JSON.stringify({ step: 0 }), z: "f1" },
            { type: "ui-stepper", id: "stepRes3", mount: "stepResApp3.content", steps, activeStepPath: "wizard.step", z: "f1" }
        ]);

        const result = renderAppPage("stepResApp3", "/", undefined, definitions);
        expect(result.status).toBe(200);
        expect(activeIndex(result.body)).toBe(0);
    });
});

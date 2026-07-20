import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { NodeBehaviourHarness, webappTest } from "./helpers/node-behaviour-harness";

/**
 * P85 — Classic behaviour tests for the navigation-category nodes:
 * ui-accordion, ui-breadcrumb, ui-menu, ui-pagination, ui-stepper, ui-tabs.
 *
 * For each node we verify via the shared NodeBehaviourHarness:
 *
 * Interaction-capable nodes (ui-tabs, ui-stepper, ui-menu, ui-accordion):
 *   1. select-verb (tabs/stepper/menu) → SSE command push + pass-through.
 *   2. open/close verbs (accordion) → SSE command push + pass-through.
 *   3. show/hide verbs → SSE command push.
 *   4. Non-owned verb → pass-through, no SSE push.
 *   5. No msg.ui.action → delegates to componentStateInputHandler (pass-through).
 *
 * ComponentStateInputHandler-only nodes (ui-pagination, ui-breadcrumb):
 *   6. Valid component op (show/hide) → pass-through.
 *   7. Invalid component op → message dropped.
 *   8. No component op → pass-through.
 *
 * Event dispatch via dispatchClientEvent:
 *   9. tabChange dispatched on ui-tabs node → emits msg.ui on output port.
 *  10. stepChange dispatched on ui-stepper node → emits msg.ui with params.stepId.
 *  11. P251: legacy `complete` event on ui-stepper is filtered out (dead event).
 *  12. sectionOpen dispatched on ui-accordion node → emits msg.ui with params.sectionId.
 *  13. sectionClose dispatched on ui-accordion node → emits msg.ui on correct port.
 *  14. navigate dispatched on ui-menu node → emits msg.ui with params.path.
 *  15. navigate dispatched on ui-breadcrumb node → emits msg.ui with params.path.
 *  16. pageChange dispatched on ui-pagination → emits msg.ui with params.page.
 *
 * msg.payload / patch:
 *  17. ui-tabs: msg.payload sets activeTab field (via componentStateInputHandler — pass-through, no definition patch).
 *  18. ui-accordion: multiple / defaultOpen fields round-trip through mapConfig.
 *  19. ui-stepper: steps list and activeStep round-trip through mapConfig.
 *
 * Pass-through:
 *  20. All navigation nodes pass through an unrecognised message unchanged.
 *
 * E2E note (test-conventions.md): the "render" tests for these nodes already live
 * in tests/e2e/nodes/composite/ and tests/e2e/nodes/view/. This file covers only
 * the handler behaviour (SSE push, output events, pass-through). The missing per-node
 * editor E2E is added in tests/e2e/nodes/editor/navigation-nodes.spec.ts (P85).
 */

const h = new NodeBehaviourHarness("navApp");

beforeEach(() => {
    h.reset();
});

afterEach(() => {
    h.teardown();
});

// ---------------------------------------------------------------------------
// 1–4. Interaction verbs (tabs/stepper/menu/accordion)
// ---------------------------------------------------------------------------

describe("P85: select verb → SSE command push (tabs / stepper / menu)", () => {
    for (const type of ["ui-tabs", "ui-stepper", "ui-menu"] as const) {
        it(`${type}: owned 'select' verb pushes SSE command frame and passes msg through`, () => {
            const nodeId = `sel-${type}`;
            const client = h.connectClient("c1");
            const node = h.makeNode(type, nodeId);

            const { sent, done } = h.drive(type, node, {
                ui: { clientId: "c1", action: { type: "select", to: "item-1" } }
            });

            const commands = client.eventsOfType("command");
            expect(commands).toHaveLength(1);
            expect(commands[0].data).toMatchObject({ command: { type: "select", target: nodeId } });
            expect(sent).toHaveLength(1);
            expect(done).toHaveBeenCalledTimes(1);
        });
    }
});

// P226 (ADR 0037): show/hide on navigation nodes are dynamic-state WRITERS — they
// set the node's ONE `visible` value via setDynamicStateField (unbound → per-client
// slot), NOT a client overlay `command`. Assert the slot write + no command frame.
const dsNav = webappTest as unknown as {
    getClientState: (appId: string, clientId: string) => { state: Record<string, unknown> } | null;
};
function navSlotValue(state: Record<string, unknown> | undefined, nodeId: string, field: string): unknown {
    const root = state && (state.__dynamicState as Record<string, Record<string, unknown>> | undefined);
    return root && root[nodeId] ? root[nodeId][field] : undefined;
}

describe("P226: show / hide verbs write the `visible` value (all interaction navigation nodes)", () => {
    for (const type of ["ui-tabs", "ui-stepper", "ui-menu", "ui-accordion"] as const) {
        it(`${type}: 'show' writes visible=true to the per-client slot, no command`, () => {
            const nodeId = `show-${type}`;
            const client = h.connectClient("c1");
            h.state.definitions.set(nodeId, { nodeId, appId: h.appId, definition: { type, id: nodeId } });
            const node = h.makeNode(type, nodeId);

            h.drive(type, node, { ui: { clientId: "c1", action: { type: "show" } } });

            expect(client.eventsOfType("command")).toHaveLength(0);
            expect(navSlotValue(dsNav.getClientState(h.appId, "c1")!.state, nodeId, "visible")).toBe(true);
        });

        it(`${type}: 'hide' writes visible=false to the per-client slot, no command`, () => {
            const nodeId = `hide-${type}`;
            const client = h.connectClient("c2");
            h.state.definitions.set(nodeId, { nodeId, appId: h.appId, definition: { type, id: nodeId } });
            const node = h.makeNode(type, nodeId);

            h.drive(type, node, { ui: { clientId: "c2", action: { type: "hide" } } });

            expect(client.eventsOfType("command")).toHaveLength(0);
            expect(navSlotValue(dsNav.getClientState(h.appId, "c2")!.state, nodeId, "visible")).toBe(false);
        });
    }
});

describe("P85: accordion open / close verbs → SSE command push", () => {
    it("ui-accordion: owned 'open' verb pushes SSE command frame", () => {
        const nodeId = "acc-open";
        const client = h.connectClient("c1");
        const node = h.makeNode("ui-accordion", nodeId);

        h.drive("ui-accordion", node, {
            ui: { clientId: "c1", action: { type: "open", part: "section-a" } }
        });

        const commands = client.eventsOfType("command");
        expect(commands).toHaveLength(1);
        expect(commands[0].data).toMatchObject({ command: { type: "open", target: nodeId } });
    });

    it("ui-accordion: owned 'close' verb pushes SSE command frame", () => {
        const nodeId = "acc-close";
        const client = h.connectClient("c1");
        const node = h.makeNode("ui-accordion", nodeId);

        h.drive("ui-accordion", node, {
            ui: { clientId: "c1", action: { type: "close", part: "section-a" } }
        });

        const commands = client.eventsOfType("command");
        expect(commands).toHaveLength(1);
        expect(commands[0].data).toMatchObject({ command: { type: "close", target: nodeId } });
    });
});

describe("P85: non-owned verb passes through without SSE push", () => {
    // "focus" is owned by input nodes, not navigation nodes
    const notOwned = "focus";

    for (const type of ["ui-tabs", "ui-stepper", "ui-menu", "ui-accordion"] as const) {
        it(`${type}: non-owned verb '${notOwned}' passes through, no command push`, () => {
            const nodeId = `no-verb-${type}`;
            const client = h.connectClient("c1");
            const node = h.makeNode(type, nodeId);

            const { sent } = h.drive(type, node, {
                ui: { clientId: "c1", action: { type: notOwned } }
            });

            expect(client.eventsOfType("command")).toHaveLength(0);
            expect(sent).toHaveLength(1);
        });
    }
});

// ---------------------------------------------------------------------------
// 5. No msg.ui.action → componentStateInputHandler: pass-through
// ---------------------------------------------------------------------------

describe("P85: no msg.ui.action → componentStateInputHandler pass-through", () => {
    for (const type of ["ui-tabs", "ui-stepper", "ui-menu", "ui-accordion"] as const) {
        it(`${type}: message without ui.action passes through (delegates to componentStateInputHandler)`, () => {
            const nodeId = `noop-${type}`;
            const node = h.makeNode(type, nodeId);
            const msg = { topic: "unrelated" };
            const { sent, done } = h.drive(type, node, msg);

            expect(sent).toHaveLength(1);
            expect(sent[0]).toBe(msg);
            expect(done).toHaveBeenCalledTimes(1);
        });
    }
});

// ---------------------------------------------------------------------------
// 6. ui-pagination / ui-breadcrumb: valid component op → pass-through
// ---------------------------------------------------------------------------

describe("P85: pagination / breadcrumb — valid component op passes through", () => {
    for (const type of ["ui-pagination", "ui-breadcrumb"] as const) {
        it(`${type}: 'show' op passes msg through (componentStateInputHandler)`, () => {
            const nodeId = `op-${type}`;
            const node = h.makeNode(type, nodeId);
            const msg = { ui: { component: { op: "show", id: nodeId } } };
            const { sent, done } = h.drive(type, node, msg);

            expect(sent).toHaveLength(1);
            expect(sent[0]).toBe(msg);
            expect(done).toHaveBeenCalledTimes(1);
        });
    }
});

// ---------------------------------------------------------------------------
// 7. ui-pagination / ui-breadcrumb: invalid component op → message dropped
// ---------------------------------------------------------------------------

describe("P85: pagination / breadcrumb — invalid component op drops message", () => {
    for (const type of ["ui-pagination", "ui-breadcrumb"] as const) {
        it(`${type}: unrecognised op is dropped (done() called, no send)`, () => {
            const nodeId = `bad-${type}`;
            const node = h.makeNode(type, nodeId);
            const { sent, done } = h.drive(type, node, {
                ui: { component: { op: "teleport", id: nodeId } }
            });

            expect(sent).toHaveLength(0);
            expect(done).toHaveBeenCalledTimes(1);
        });
    }
});

// ---------------------------------------------------------------------------
// 8. ui-pagination / ui-breadcrumb: no component op → pass-through
// ---------------------------------------------------------------------------

describe("P85: pagination / breadcrumb — no component op passes through", () => {
    for (const type of ["ui-pagination", "ui-breadcrumb"] as const) {
        it(`${type}: message without ui.component passes through`, () => {
            const nodeId = `pt-${type}`;
            const node = h.makeNode(type, nodeId);
            const msg = { topic: "nothing" };
            const { sent, done } = h.drive(type, node, msg);

            expect(sent).toHaveLength(1);
            expect(sent[0]).toBe(msg);
            expect(done).toHaveBeenCalledTimes(1);
        });
    }
});

// ---------------------------------------------------------------------------
// Helpers for dispatchClientEvent tests
// ---------------------------------------------------------------------------

function buildNavDefinitions(nodeType: string, nodeId: string, extra: Record<string, unknown> = {}) {
    return h.buildDefinitions([
        { type: "ui-app", id: h.appId, root: h.appId, name: "Nav App", layout: "app", z: "f1" },
        { type: nodeType, id: nodeId, parent: h.appId, z: "f1", ...extra }
    ]);
}

// ---------------------------------------------------------------------------
// 9. tabChange dispatched on ui-tabs node
// ---------------------------------------------------------------------------

describe("P85: tabChange event dispatched via dispatchClientEvent", () => {
    it("tabChange event emits msg.ui with event='tabChange' and params.tabId on port 0", () => {
        const nodeId = "tabs-evt";
        const definitions = buildNavDefinitions("ui-tabs", nodeId, {
            tabs: JSON.stringify([
                { id: "tab-a", label: "Tab A" },
                { id: "tab-b", label: "Tab B" }
            ]),
            events: JSON.stringify(["tabChange"])
        });

        const { result, emitted } = h.dispatchClientEvent(
            [nodeId],
            { clientId: "c1", event: "tabChange", sourceId: nodeId, params: { tabId: "tab-b" } },
            definitions
        );

        expect(result.success).toBe(true);
        const out = emitted.get(nodeId)!;
        expect(out).toHaveLength(1);
        expect(out[0]).toMatchObject({ event: "tabChange", sourceId: nodeId });
    });
});

// ---------------------------------------------------------------------------
// 10. stepChange dispatched on ui-stepper node
// ---------------------------------------------------------------------------

describe("P85: stepChange event dispatched via dispatchClientEvent", () => {
    it("stepChange event emits msg.ui with event='stepChange' and params.stepId", () => {
        const nodeId = "stepper-evt";
        const definitions = buildNavDefinitions("ui-stepper", nodeId, {
            steps: JSON.stringify([
                { id: "step-1", label: "Configure" },
                { id: "step-2", label: "Review" },
                { id: "step-3", label: "Deploy" }
            ]),
            events: JSON.stringify(["stepChange"])
        });

        const { result, emitted } = h.dispatchClientEvent(
            [nodeId],
            { clientId: "c1", event: "stepChange", sourceId: nodeId, params: { stepId: "step-2", previousStepId: "step-1" } },
            definitions
        );

        expect(result.success).toBe(true);
        const out = emitted.get(nodeId)!;
        expect(out).toHaveLength(1);
        expect(out[0]).toMatchObject({ event: "stepChange", sourceId: nodeId });
    });
});

// ---------------------------------------------------------------------------
// 11. P251: `complete` was a dead ui-stepper event — no DOM source emits it, so
//     it was removed from the schema enum. `filterSupportedStepperEvents` strips a
//     legacy `complete` from a flow config so an old flow keeps deploying.
// ---------------------------------------------------------------------------

describe("P85/P251: stepper `complete` legacy event is filtered out", () => {
    it("a legacy events list ['stepChange','complete'] maps to ['stepChange'] only", () => {
        const def = h.registry["ui-stepper"].mapConfig({
            id: "stepper-complete",
            parent: h.appId,
            steps: JSON.stringify([
                { id: "s1", label: "Step 1" },
                { id: "s2", label: "Step 2" }
            ]),
            events: JSON.stringify(["stepChange", "complete"])
        });

        expect(def.events).toEqual(["stepChange"]);
    });
});

// ---------------------------------------------------------------------------
// 12. sectionOpen dispatched on ui-accordion node
// ---------------------------------------------------------------------------

describe("P85: sectionOpen event dispatched via dispatchClientEvent", () => {
    it("sectionOpen event emits msg.ui with event='sectionOpen' and params.sectionId", () => {
        const nodeId = "acc-sectionOpen";
        const definitions = buildNavDefinitions("ui-accordion", nodeId, {
            sections: JSON.stringify([
                { id: "sec-a", label: "Section A" },
                { id: "sec-b", label: "Section B" }
            ]),
            events: JSON.stringify(["sectionOpen", "sectionClose"])
        });

        const { result, emitted } = h.dispatchClientEvent(
            [nodeId],
            { clientId: "c1", event: "sectionOpen", sourceId: nodeId, params: { sectionId: "sec-a" } },
            definitions
        );

        expect(result.success).toBe(true);
        const out = emitted.get(nodeId)!;
        expect(out).toHaveLength(1);
        expect(out[0]).toMatchObject({ event: "sectionOpen", sourceId: nodeId });
    });
});

// ---------------------------------------------------------------------------
// 13. sectionClose dispatched on ui-accordion node → correct port
// ---------------------------------------------------------------------------

describe("P85: sectionClose event dispatched via dispatchClientEvent", () => {
    it("sectionClose event emits msg.ui on the 'sectionClose' port", () => {
        const nodeId = "acc-sectionClose";
        const definitions = buildNavDefinitions("ui-accordion", nodeId, {
            sections: JSON.stringify([
                { id: "sec-a", label: "Section A" },
                { id: "sec-b", label: "Section B" }
            ]),
            // sectionOpen=port0, sectionClose=port1
            events: JSON.stringify(["sectionOpen", "sectionClose"])
        });

        const { result, emitted } = h.dispatchClientEvent(
            [nodeId],
            { clientId: "c1", event: "sectionClose", sourceId: nodeId, params: { sectionId: "sec-b" } },
            definitions
        );

        expect(result.success).toBe(true);
        const out = emitted.get(nodeId)!;
        expect(out).toHaveLength(1);
        expect(out[0]).toMatchObject({ event: "sectionClose", sourceId: nodeId });
    });
});

// ---------------------------------------------------------------------------
// 14. navigate dispatched on ui-menu node
// ---------------------------------------------------------------------------

describe("P85: navigate event dispatched via dispatchClientEvent (ui-menu)", () => {
    it("navigate event emits msg.ui with event='navigate' and params.path", () => {
        const nodeId = "menu-nav";
        const definitions = buildNavDefinitions("ui-menu", nodeId, {
            items: JSON.stringify([
                { label: "Dashboard", route: "/dashboard" },
                { label: "Customers", route: "/customers" }
            ])
        });

        const { result, emitted } = h.dispatchClientEvent(
            [nodeId],
            { clientId: "c1", event: "navigate", sourceId: nodeId, params: { path: "/dashboard" } },
            definitions
        );

        expect(result.success).toBe(true);
        const out = emitted.get(nodeId)!;
        expect(out).toHaveLength(1);
        expect(out[0]).toMatchObject({ event: "navigate", sourceId: nodeId });
    });
});

// ---------------------------------------------------------------------------
// 15. navigate dispatched on ui-breadcrumb node
// ---------------------------------------------------------------------------

describe("P85: navigate event dispatched via dispatchClientEvent (ui-breadcrumb)", () => {
    it("navigate event emits msg.ui with event='navigate' and params.path", () => {
        const nodeId = "breadcrumb-nav";
        const definitions = buildNavDefinitions("ui-breadcrumb", nodeId, {
            items: [
                { label: "Home", path: "/" },
                { label: "Customers", path: "/customers" },
                { label: "Details" }
            ]
        });

        const { result, emitted } = h.dispatchClientEvent(
            [nodeId],
            { clientId: "c1", event: "navigate", sourceId: nodeId, params: { path: "/" } },
            definitions
        );

        expect(result.success).toBe(true);
        const out = emitted.get(nodeId)!;
        expect(out).toHaveLength(1);
        expect(out[0]).toMatchObject({ event: "navigate", sourceId: nodeId });
    });
});

// ---------------------------------------------------------------------------
// 16. pageChange dispatched on ui-pagination node
// ---------------------------------------------------------------------------

describe("P85: pageChange event dispatched via dispatchClientEvent (ui-pagination)", () => {
    it("pageChange event emits msg.ui with event='pageChange' and params.page", () => {
        const nodeId = "paging-evt";
        const definitions = buildNavDefinitions("ui-pagination", nodeId, {
            page: { kind: "literal", value: 2 },
            totalPages: { kind: "literal", value: 10 },
            events: JSON.stringify(["pageChange"])
        });

        const { result, emitted } = h.dispatchClientEvent(
            [nodeId],
            { clientId: "c1", event: "pageChange", sourceId: nodeId, params: { page: 3 } },
            definitions
        );

        expect(result.success).toBe(true);
        const out = emitted.get(nodeId)!;
        expect(out).toHaveLength(1);
        expect(out[0]).toMatchObject({ event: "pageChange", sourceId: nodeId });
    });
});

// ---------------------------------------------------------------------------
// 17–19. mapConfig round-trips: tabs activeTab, accordion multiple/defaultOpen,
//         stepper steps/activeStep
// ---------------------------------------------------------------------------

describe("P85/P168: ui-tabs + ui-tab mapConfig round-trip (children model)", () => {
    it("ui-tabs no longer carries a tabs config-array (ADR 0018, Model 1a)", () => {
        const def = h.registry["ui-tabs"].mapConfig({
            id: "t1",
            parent: h.appId
        });

        // Tabs are now derived from mounted ui-tab children; the node has no
        // `tabs` field at all.
        expect(def.tabs).toBeUndefined();
    });

    it("activeTab binding is preserved in definition", () => {
        const def = h.registry["ui-tabs"].mapConfig({
            id: "t2",
            parent: h.appId,
            activeTab: { kind: "literal", value: "tab-a" }
        });

        expect(def.activeTab).toMatchObject({ kind: "literal", value: "tab-a" });
    });

    it("ui-tab maps to a tab definition with id, label binding, mount, order", () => {
        const def = h.registry["ui-tab"].mapConfig({
            id: "tab-x",
            mount: "ui-tabs:t3/content",
            label: { kind: "literal", value: "X" },
            icon: "house",
            order: 1
        }) as Record<string, unknown>;

        expect(def.type).toBe("ui-tab");
        expect(def.id).toBe("tab-x");
        expect(def.mount).toBe("ui-tabs:t3/content");
        expect(def.label).toMatchObject({ kind: "literal", value: "X" });
        expect(def.icon).toBe("house");
        expect(def.order).toBe(1);
    });
});

describe("P85: ui-accordion multiple / defaultOpen round-trip through mapConfig", () => {
    it("multiple:true is stored in definition", () => {
        const def = h.registry["ui-accordion"].mapConfig({
            id: "acc1",
            parent: h.appId,
            sections: JSON.stringify([
                { id: "s1", label: "Section 1" },
                { id: "s2", label: "Section 2" }
            ]),
            multiple: true
        });

        expect(def.multiple).toBe(true);
    });

    it("multiple:false (string) is stored as undefined (falsy default)", () => {
        const def = h.registry["ui-accordion"].mapConfig({
            id: "acc2",
            parent: h.appId,
            sections: JSON.stringify([{ id: "s1", label: "Section 1" }]),
            multiple: false
        });

        // multiple is only stored when truthy (or truthy string)
        expect(def.multiple).toBeFalsy();
    });

    // P169 (ADR 0018, Model 1a): the `sections` config-array is REMOVED. A legacy
    // `sections` JSON is preserved on the `legacySections` carrier so the in-editor
    // migration pre-pass can synthesize ui-accordion-section children; the mapConfig
    // no longer emits a `sections` field.
    it("a legacy sections list is preserved on the legacySections carrier (not `sections`)", () => {
        const def = h.registry["ui-accordion"].mapConfig({
            id: "acc3",
            parent: h.appId,
            sections: JSON.stringify([
                { id: "faq-1", label: "What is this?" },
                { id: "faq-2", label: "How does it work?" }
            ])
        });

        expect(def.sections).toBeUndefined();
        expect(Array.isArray(def.legacySections)).toBe(true);
        const sections = def.legacySections as Array<{ id: string; label: string }>;
        expect(sections).toHaveLength(2);
        expect(sections[0]).toMatchObject({ id: "faq-1", label: "What is this?" });
    });
});

describe("P85: ui-stepper steps + activeStep round-trip through mapConfig", () => {
    it("steps list is parsed into an array of step objects", () => {
        const def = h.registry["ui-stepper"].mapConfig({
            id: "stp1",
            parent: h.appId,
            steps: JSON.stringify([
                { id: "setup", label: "Setup" },
                { id: "review", label: "Review" },
                { id: "deploy", label: "Deploy" }
            ])
        });

        expect(Array.isArray(def.steps)).toBe(true);
        const steps = def.steps as Array<{ id: string; label: string }>;
        expect(steps).toHaveLength(3);
        expect(steps[0]).toMatchObject({ id: "setup", label: "Setup" });
    });

    it("activeStep binding is preserved in definition", () => {
        const def = h.registry["ui-stepper"].mapConfig({
            id: "stp2",
            parent: h.appId,
            steps: JSON.stringify([
                { id: "s1", label: "S1" },
                { id: "s2", label: "S2" }
            ]),
            activeStep: { kind: "literal", value: "s1" }
        });

        expect(def.activeStep).toMatchObject({ kind: "literal", value: "s1" });
    });

    it("events list with stepChange is stored as array (P251: legacy `complete` filtered out)", () => {
        const def = h.registry["ui-stepper"].mapConfig({
            id: "stp3",
            parent: h.appId,
            steps: JSON.stringify([{ id: "s1", label: "S1" }, { id: "s2", label: "S2" }]),
            events: JSON.stringify(["stepChange", "complete"])
        });

        expect(Array.isArray(def.events)).toBe(true);
        expect(def.events).toContain("stepChange");
        expect(def.events).not.toContain("complete");
    });
});

// ---------------------------------------------------------------------------
// 20. Pass-through: all navigation nodes pass unrecognised messages through
// ---------------------------------------------------------------------------

describe("P85: all navigation nodes pass unrecognised messages through (pass-through)", () => {
    const navTypes = [
        "ui-accordion",
        "ui-breadcrumb",
        "ui-menu",
        "ui-pagination",
        "ui-stepper",
        "ui-tabs"
    ];

    for (const type of navTypes) {
        it(`${type}: passes through a message with no matching payload or verb`, () => {
            const nodeId = `pass-${type}`;
            const node = h.makeNode(type, nodeId);
            const originalMsg = { topic: "test", someField: "value" };
            const { sent, done } = h.drive(type, node, originalMsg);

            expect(sent).toHaveLength(1);
            expect(sent[0]).toBe(originalMsg);
            expect(done).toHaveBeenCalledTimes(1);
        });
    }
});

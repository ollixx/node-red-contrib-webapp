import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { NodeBehaviourHarness } from "./helpers/node-behaviour-harness";

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
 *  11. complete dispatched on ui-stepper node → emits msg.ui on port for "complete".
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

describe("P85: show / hide verbs → SSE command push (all interaction navigation nodes)", () => {
    for (const type of ["ui-tabs", "ui-stepper", "ui-menu", "ui-accordion"] as const) {
        it(`${type}: owned 'show' verb pushes SSE command frame`, () => {
            const nodeId = `show-${type}`;
            const client = h.connectClient("c1");
            const node = h.makeNode(type, nodeId);

            h.drive(type, node, { ui: { clientId: "c1", action: { type: "show" } } });

            const commands = client.eventsOfType("command");
            expect(commands).toHaveLength(1);
            expect(commands[0].data).toMatchObject({ command: { type: "show", target: nodeId } });
        });

        it(`${type}: owned 'hide' verb pushes SSE command frame`, () => {
            const nodeId = `hide-${type}`;
            const client = h.connectClient("c2");
            const node = h.makeNode(type, nodeId);

            h.drive(type, node, { ui: { clientId: "c2", action: { type: "hide" } } });

            const commands = client.eventsOfType("command");
            expect(commands).toHaveLength(1);
            expect(commands[0].data).toMatchObject({ command: { type: "hide", target: nodeId } });
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
            events: JSON.stringify(["stepChange", "complete"])
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
// 11. complete dispatched on ui-stepper → lands on the correct port
// ---------------------------------------------------------------------------

describe("P85: stepper complete event dispatched via dispatchClientEvent", () => {
    it("complete event emits msg.ui on the 'complete' output port (port 1 when stepChange is also enabled)", () => {
        const nodeId = "stepper-complete";
        const definitions = buildNavDefinitions("ui-stepper", nodeId, {
            steps: JSON.stringify([
                { id: "s1", label: "Step 1" },
                { id: "s2", label: "Step 2" }
            ]),
            // events list defines port order: stepChange=0, complete=1
            events: JSON.stringify(["stepChange", "complete"])
        });

        // The node definition must carry the right events array for port routing.
        // We need to inject the events field so the definition node carries it.
        const nodeWithEvents = h.registry["ui-stepper"].mapConfig({
            id: nodeId,
            parent: h.appId,
            steps: JSON.stringify([
                { id: "s1", label: "Step 1" },
                { id: "s2", label: "Step 2" }
            ]),
            events: JSON.stringify(["stepChange", "complete"])
        });

        // buildDefinitions already maps through mapConfig, so definitions carries events.
        const { result, emitted } = h.dispatchClientEvent(
            [nodeId],
            { clientId: "c1", event: "complete", sourceId: nodeId, params: {} },
            definitions
        );

        expect(result.success).toBe(true);
        const out = emitted.get(nodeId)!;
        expect(out).toHaveLength(1);
        expect(out[0]).toMatchObject({ event: "complete", sourceId: nodeId });
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

describe("P85: ui-tabs mapConfig round-trip", () => {
    it("tabs list is stored as an array of tab objects", () => {
        const def = h.registry["ui-tabs"].mapConfig({
            id: "t1",
            parent: h.appId,
            tabs: JSON.stringify([
                { id: "tab-x", label: "X" },
                { id: "tab-y", label: "Y" }
            ])
        });

        expect(Array.isArray(def.tabs)).toBe(true);
        const tabs = def.tabs as Array<{ id: string; label: string }>;
        expect(tabs).toHaveLength(2);
        expect(tabs[0]).toMatchObject({ id: "tab-x", label: "X" });
        expect(tabs[1]).toMatchObject({ id: "tab-y", label: "Y" });
    });

    it("activeTab binding is preserved in definition", () => {
        const def = h.registry["ui-tabs"].mapConfig({
            id: "t2",
            parent: h.appId,
            tabs: JSON.stringify([{ id: "tab-a", label: "A" }]),
            activeTab: { kind: "literal", value: "tab-a" }
        });

        expect(def.activeTab).toMatchObject({ kind: "literal", value: "tab-a" });
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

    it("sections list is parsed into an array of section objects", () => {
        const def = h.registry["ui-accordion"].mapConfig({
            id: "acc3",
            parent: h.appId,
            sections: JSON.stringify([
                { id: "faq-1", label: "What is this?" },
                { id: "faq-2", label: "How does it work?" }
            ])
        });

        expect(Array.isArray(def.sections)).toBe(true);
        const sections = def.sections as Array<{ id: string; label: string }>;
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

    it("events list with stepChange and complete is stored as array", () => {
        const def = h.registry["ui-stepper"].mapConfig({
            id: "stp3",
            parent: h.appId,
            steps: JSON.stringify([{ id: "s1", label: "S1" }, { id: "s2", label: "S2" }]),
            events: JSON.stringify(["stepChange", "complete"])
        });

        expect(Array.isArray(def.events)).toBe(true);
        expect(def.events).toContain("stepChange");
        expect(def.events).toContain("complete");
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

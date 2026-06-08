import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
    INTERACTION_VERBS_BY_TYPE,
    NodeBehaviourHarness,
    interactionInputHandler,
    makeFakeSseRes
} from "./helpers/node-behaviour-harness";

/**
 * P81 — self-test for the shared classic node-behaviour test harness.
 *
 * This file is both the harness's regression guard AND the canonical usage
 * example for the per-category behaviour phases P82–P86. It drives REAL
 * registered nodes through the harness and asserts the two observable effects
 * (SSE pushes + output messages) plus the dispatch path.
 */

describe("P81 harness: makeFakeSseRes parses SSE frames", () => {
    it("parses event/data frames and filters by event name", () => {
        const res = makeFakeSseRes();
        res.write("event: command\ndata: " + JSON.stringify({ command: { type: "open" } }) + "\n\n");
        res.write("event: snapshot\ndata: " + JSON.stringify({ a: 1 }) + "\n\n");

        expect(res.events()).toHaveLength(2);
        const commands = res.eventsOfType("command");
        expect(commands).toHaveLength(1);
        expect(commands[0].data).toMatchObject({ command: { type: "open" } });
        expect(res.eventsOfType("snapshot")[0].data).toEqual({ a: 1 });
    });
});

describe("P81 harness: drive captures SSE pushes (interaction verb)", () => {
    const h = new NodeBehaviourHarness();
    beforeEach(() => h.reset());
    afterEach(() => h.teardown());

    it("a ui-dialog `open` verb pushes a command frame to a connected client", () => {
        const client = h.connectClient("c1");
        const node = h.makeNode("ui-dialog", "editDialog");

        const { sent, done } = h.drive("ui-dialog", node, {
            payload: { keep: 7 },
            ui: { clientId: "c1", action: { type: "open" } }
        });

        const commands = client.eventsOfType("command");
        expect(commands).toHaveLength(1);
        expect(commands[0].data).toMatchObject({ command: { type: "open", target: "editDialog" } });

        // The harness also captures the output-port effect: the msg passes through.
        expect(sent).toHaveLength(1);
        expect(done).toHaveBeenCalledTimes(1);
    });

    it("a node receiving a verb it does NOT own pushes nothing and passes through", () => {
        const client = h.connectClient("c1");

        const { sent } = h.drive("ui-dialog", "editDialog", {
            ui: { clientId: "c1", action: { type: "show" } }
        });

        expect(client.eventsOfType("command")).toHaveLength(0);
        expect(sent).toHaveLength(1);
    });
});

describe("P81 harness: registerApp with config feeds the real ui-app mapConfig", () => {
    const h = new NodeBehaviourHarness("cfgApp");
    beforeEach(() => h.reset({ forwardErrorsToClient: true, forwardErrorMinSeverity: "warn" }));
    afterEach(() => h.teardown());

    it("stores a compiled ui-app definition reflecting the passed config", () => {
        const stored = h.state.definitions.get("cfgApp");
        expect(stored?.definition).toMatchObject({
            forwardErrorsToClient: true,
            forwardErrorMinSeverity: "warn"
        });
    });
});

describe("P81 harness: dispatchClientEvent drives the client→server ingest path", () => {
    const h = new NodeBehaviourHarness("evtApp");
    beforeEach(() => h.reset());
    afterEach(() => h.teardown());

    it("a button click emits msg.ui on the originating node's output port", () => {
        const definitions = h.buildDefinitions([
            { type: "ui-app", id: "evtApp", name: "Event App", root: "evtApp", layout: "app", z: "f1" },
            { type: "ui-button", id: "saveBtn", name: "Save", mount: "evtApp.content", label: "Save", z: "f1" }
        ]);

        const { result, emitted } = h.dispatchClientEvent(
            ["saveBtn"],
            { clientId: "c1", event: "click", sourceId: "saveBtn", params: {} },
            definitions
        );

        expect(result.success).toBe(true);
        const out = emitted.get("saveBtn")!;
        expect(out).toHaveLength(1);
        expect(out[0]).toMatchObject({ event: "click", sourceId: "saveBtn", appId: "evtApp", clientId: "c1" });
    });
});

describe("P81 harness: exposes verb table + factory verbatim", () => {
    it("re-exports INTERACTION_VERBS_BY_TYPE", () => {
        expect(INTERACTION_VERBS_BY_TYPE["ui-dialog"]).toEqual(expect.arrayContaining(["open", "close"]));
    });

    it("re-exports the interactionInputHandler factory (delegates with no verb)", () => {
        let delegated = false;
        const handler = interactionInputHandler(["open"], () => {
            delegated = true;
        });
        handler({ id: "n", z: undefined }, { payload: 1 }, () => undefined, () => undefined);
        expect(delegated).toBe(true);
    });
});

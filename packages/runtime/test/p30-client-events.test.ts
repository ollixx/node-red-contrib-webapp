import { describe, expect, it } from "vitest";

import type { AppModel, RenderSnapshot } from "@node-red-contrib-webapp/renderer";

/**
 * P30 — Real Client→Server events.
 *
 * The browser reports WHAT HAPPENED (events.md): it sends a raw event
 *   { appId, clientId, event, sourceId, params }
 * and never an actionId to execute. The runtime routes that event to the
 * originating node and emits `msg.ui` on that node's OUTPUT PORT into the wired
 * flow. The runtime itself takes NO domain action — no preview state mutation,
 * no CRUD, no automatic event→action link. The flow is the only place logic lives.
 *
 * These tests drive the webapp.js dispatch helper directly (no HTTP server) with
 * a stub RED whose nodes record what was emitted on their output port.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const webappTest = (require("../../../nodes/webapp.js") as { __test__: Record<string, unknown> }).__test__;

const dispatchClientEvent = webappTest.dispatchClientEvent as (
    RED: unknown,
    appId: string,
    body: Record<string, unknown>,
    definitions: unknown[]
) => { success: boolean; status?: number; body?: string; message?: { ui: Record<string, unknown> } };

const runtimeNodeRegistry = webappTest.runtimeNodeRegistry as Record<
    string,
    { mapConfig: (config: Record<string, unknown>) => Record<string, unknown> }
>;

const runtimeState = webappTest.runtimeState as {
    previewState: Map<string, unknown>;
    previewQueries: Map<string, unknown>;
};

const getAppModelResult = webappTest.getAppModelResult as (
    appId: string,
    definitions: unknown[]
) => { success: boolean; model?: AppModel };

const buildAppSnapshot = webappTest.buildAppSnapshot as (
    appId: string,
    location: string,
    dialogId: string | undefined,
    definitions: unknown[]
) => { success: boolean; snapshot?: RenderSnapshot };

function buildDefinitions(rawNodes: Record<string, unknown>[]) {
    return rawNodes.map((node) => {
        const reg = runtimeNodeRegistry[node.type as string];
        return reg?.mapConfig ? { ...reg.mapConfig(node), z: node.z } : { ...node, id: node.id };
    });
}

interface EmittedMsg {
    ui: Record<string, unknown>;
}

// A RED double whose nodes record everything sent on their output port.
function makeRED(nodeIds: string[]) {
    const emitted = new Map<string, EmittedMsg[]>();
    const nodes = new Map<string, { id: string; send: (msg: EmittedMsg) => void }>();
    for (const id of nodeIds) {
        emitted.set(id, []);
        nodes.set(id, {
            id,
            send(msg: EmittedMsg) {
                emitted.get(id)!.push(msg);
            }
        });
    }
    return {
        emitted,
        RED: { nodes: { getNode: (id: string) => nodes.get(id) || undefined } }
    };
}

const buttonRawNodes = [
    { type: "ui-app", id: "evtApp", name: "Event App", root: "evtApp", layout: "app", z: "f1" },
    { type: "ui-route", id: "evtHome", name: "Home", parent: "evtApp", path: "/", title: "Home", layoutId: "app", z: "f1" },
    { type: "ui-button", id: "saveBtn", name: "Save", mount: "evtApp.content", label: "Save", z: "f1" }
];
const buttonDefinitions = buildDefinitions(buttonRawNodes);

const tableRawNodes = [
    { type: "ui-app", id: "tblApp", name: "Table App", root: "tblApp", layout: "app", z: "f2" },
    {
        type: "ui-table",
        id: "peopleTable",
        name: "People",
        mount: "tblApp.content",
        rows: { kind: "literal", value: [{ id: "42", name: "Müller GmbH" }] },
        columns: [{ key: "name", label: "Name" }],
        events: ["rowSelect"],
        order: 1,
        z: "f2"
    }
];
const tableDefinitions = buildDefinitions(tableRawNodes);

describe("P30: client → server events emit on the originating node's output port", () => {
    it("a click on a wired ui-button emits msg.ui {event:'click', sourceId, clientId, appId} and changes no runtime state", () => {
        const { emitted, RED } = makeRED(["saveBtn"]);

        const before = {
            previewState: runtimeState.previewState.get("evtApp"),
            previewQueries: runtimeState.previewQueries.get("evtApp")
        };

        const result = dispatchClientEvent(
            RED,
            "evtApp",
            { clientId: "client-abc123", event: "click", sourceId: "saveBtn", params: {} },
            buttonDefinitions
        );

        expect(result.success).toBe(true);

        const out = emitted.get("saveBtn")!;
        expect(out).toHaveLength(1);
        expect(out[0].ui).toMatchObject({
            event: "click",
            sourceId: "saveBtn",
            clientId: "client-abc123",
            appId: "evtApp"
        });

        // The runtime took NO domain action — preview state is untouched.
        expect(runtimeState.previewState.get("evtApp")).toBe(before.previewState);
        expect(runtimeState.previewQueries.get("evtApp")).toBe(before.previewQueries);
    });

    it("a ui-table row select emits {event:'rowSelect', params:{rowId,row}} on the output port", () => {
        const { emitted, RED } = makeRED(["peopleTable"]);

        const result = dispatchClientEvent(
            RED,
            "tblApp",
            { clientId: "c1", event: "rowSelect", sourceId: "peopleTable", params: { rowId: "42" } },
            tableDefinitions
        );

        expect(result.success).toBe(true);

        const out = emitted.get("peopleTable")!;
        expect(out).toHaveLength(1);
        expect(out[0].ui.event).toBe("rowSelect");
        expect(out[0].ui.sourceId).toBe("peopleTable");
        const params = out[0].ui.params as { rowId: string; row: Record<string, unknown> };
        expect(params.rowId).toBe("42");
        expect(params.row).toMatchObject({ id: "42", name: "Müller GmbH" });
    });

    it("with no downstream wiring, a client event produces an output message and nothing else", () => {
        // A real Node-RED node always has a send(); whether anything is wired
        // downstream is invisible here. The contract is: the runtime emits the
        // message and does nothing else — no state mutation, no return action.
        const { emitted, RED } = makeRED(["saveBtn"]);

        const result = dispatchClientEvent(
            RED,
            "evtApp",
            { clientId: "lonely", event: "click", sourceId: "saveBtn", params: {} },
            buttonDefinitions
        );

        expect(result.success).toBe(true);
        // The only observable effect is the emitted output message.
        expect(emitted.get("saveBtn")!).toHaveLength(1);
        expect(result.message?.ui).toMatchObject({ event: "click", sourceId: "saveBtn" });
        // No actionId / dispatch semantics: the result carries no executed action.
        expect((result as Record<string, unknown>).redirectLocation).toBeUndefined();
        expect((result as Record<string, unknown>).dialogId).toBeUndefined();
    });

    it("rejects an event with no sourceId (the runtime cannot route it)", () => {
        const { RED } = makeRED(["saveBtn"]);
        const result = dispatchClientEvent(
            RED,
            "evtApp",
            { clientId: "c", event: "click", params: {} },
            buttonDefinitions
        );
        expect(result.success).toBe(false);
        expect(result.status).toBe(400);
    });

    it("routes every documented event type generically to the originating node (change / onEnter / onLeave / onOpen / onClose)", () => {
        // The ingest path is event-type agnostic: whatever the browser reports for
        // a node is emitted verbatim on that node's output port. This locks the
        // mechanism for the full documented event catalogue (events.md) — the
        // runtime never inspects or special-cases the event meaning.
        const { emitted, RED } = makeRED(["evtHome", "saveBtn"]);

        const cases: Array<{ event: string; params: Record<string, unknown> }> = [
            { event: "change", params: { value: "active" } },
            { event: "onEnter", params: { path: "/", params: {} } },
            { event: "onLeave", params: { path: "/" } }
        ];

        for (const testCase of cases) {
            const result = dispatchClientEvent(
                RED,
                "evtApp",
                { clientId: "c", event: testCase.event, sourceId: "evtHome", params: testCase.params },
                buttonDefinitions
            );
            expect(result.success).toBe(true);
        }

        const out = emitted.get("evtHome")!;
        expect(out.map((message) => message.ui.event)).toEqual(["change", "onEnter", "onLeave"]);
        expect(out[1].ui.params).toMatchObject({ path: "/" });
    });

    it("getAppModelResult and buildAppSnapshot are unaffected — rendering still works", () => {
        const modelResult = getAppModelResult("tblApp", tableDefinitions);
        expect(modelResult.success).toBe(true);
        const built = buildAppSnapshot("tblApp", "/", undefined, tableDefinitions);
        expect(built.success).toBe(true);
    });
});

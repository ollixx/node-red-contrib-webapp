import { beforeEach, describe, expect, it } from "vitest";

/**
 * P64 — ui-dialog native dismissal + multi-event out-port routing.
 *
 *  1. A node with multiple configured events exposes one output port per event
 *     (port index === events.indexOf(event)). dispatchClientEvent must route the
 *     message to the MATCHING port, not always port 0.
 *  2. A ui-dialog dismissed natively (onClose) is the authoritative close: the
 *     runtime sets ui.dialogs.<id>.open = false on the server state (so other
 *     clients reconcile) in addition to emitting onClose on the out-port.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const webappTest = (require("../../../nodes/webapp.js") as { __test__: Record<string, unknown> }).__test__;

const dispatchClientEvent = webappTest.dispatchClientEvent as (
    RED: unknown,
    appId: string,
    body: Record<string, unknown>,
    definitions: unknown[]
) => { success: boolean };

const runtimeState = webappTest.runtimeState as {
    liveState: Map<string, unknown>;
    clientStateMap: Map<string, unknown>;
    streamClients: Map<string, Map<string, { res: unknown; location: string }>>;
};

const getClientState = webappTest.getClientState as (
    appId: string,
    clientId: string
) => { state: Record<string, unknown> } | null;

interface SentPort {
    msg: { ui: Record<string, unknown> } | null;
}

// A RED node double whose `send` records, per call, an array of per-port payloads
// (a bare object is normalised to [object] = port 0).
function makeDialogNode(id: string, events: string[]) {
    const sends: SentPort[][] = [];
    return {
        node: {
            id,
            webappDefinition: { type: "ui-dialog", id, events },
            send(arg: unknown) {
                if (Array.isArray(arg)) {
                    sends.push(arg.map((m) => ({ msg: (m as { ui: Record<string, unknown> }) || null })));
                }
                else {
                    sends.push([{ msg: arg as { ui: Record<string, unknown> } }]);
                }
            }
        },
        sends
    };
}

function makeRED(node: { id: string }) {
    return { nodes: { getNode: (id: string) => (id === node.id ? node : undefined) } };
}

const APP_ID = "dlgApp";

const dialogRawNodes = [
    { type: "ui-app", id: APP_ID, name: "Dialog App", root: APP_ID, layout: "app", z: "f1" },
    {
        type: "ui-dialog",
        id: "editor",
        name: "Editor",
        parent: APP_ID,
        title: "Editor",
        layoutId: "dialog",
        closable: true,
        events: JSON.stringify(["onOpen", "onClose"]),
        z: "f1"
    }
];

function buildDefinitions() {
    const reg = webappTest.runtimeNodeRegistry as Record<
        string,
        { mapConfig: (config: Record<string, unknown>) => Record<string, unknown> }
    >;
    return dialogRawNodes.map((node) => {
        const r = reg[node.type as string];
        return r?.mapConfig ? { ...r.mapConfig(node), z: node.z } : { ...node, id: node.id };
    });
}

beforeEach(() => {
    runtimeState.liveState.clear();
    runtimeState.clientStateMap.clear();
    runtimeState.streamClients.clear();
});

describe("P64: ui-dialog multi-event out-port routing", () => {
    it("routes onClose to the SECOND output port (events.indexOf('onClose') === 1)", () => {
        const { node, sends } = makeDialogNode("editor", ["onOpen", "onClose"]);

        const result = dispatchClientEvent(
            makeRED(node),
            APP_ID,
            { clientId: "c1", event: "onClose", sourceId: "editor", params: {} },
            buildDefinitions()
        );

        expect(result.success).toBe(true);
        expect(sends).toHaveLength(1);
        const ports = sends[0];
        // Two ports, port 0 null, port 1 carries the message.
        expect(ports).toHaveLength(2);
        expect(ports[0].msg).toBeNull();
        expect(ports[1].msg?.ui).toMatchObject({ event: "onClose", sourceId: "editor" });
    });

    it("routes onOpen to the FIRST output port (port 0)", () => {
        const { node, sends } = makeDialogNode("editor", ["onOpen", "onClose"]);

        dispatchClientEvent(
            makeRED(node),
            APP_ID,
            { clientId: "c1", event: "onOpen", sourceId: "editor", params: {} },
            buildDefinitions()
        );

        const ports = sends[0];
        // Port 0 → bare send → single-element array.
        expect(ports[0].msg?.ui).toMatchObject({ event: "onOpen", sourceId: "editor" });
    });
});

describe("P64: ui-dialog onClose is the authoritative close", () => {
    it("sets ui.dialogs.<id>.open = false for the acting client on native onClose", () => {
        const { node } = makeDialogNode("editor", ["onOpen", "onClose"]);
        const definitions = buildDefinitions();

        // A subscribed client at the home route so the snapshot push has a target.
        const subscribers = new Map<string, { res: unknown; location: string }>();
        subscribers.set("c1", { res: { write() {}, flush() {} }, location: "/" });
        runtimeState.streamClients.set(APP_ID, subscribers);
        // Make readDeployDefinitions(runtimeState.RED) resolve to our definitions
        // by giving pushSnapshotToTargets nothing to read is fine — it falls back
        // to readDeployDefinitions, which returns [] without a RED; the state write
        // still happens regardless of whether the snapshot build succeeds.

        dispatchClientEvent(
            makeRED(node),
            APP_ID,
            { clientId: "c1", event: "onClose", sourceId: "editor", params: {} },
            definitions
        );

        const clientState = getClientState(APP_ID, "c1");
        const open = clientState
            && (((clientState.state.ui as Record<string, unknown> | undefined)
                ?.dialogs as Record<string, { open?: boolean }> | undefined)?.editor?.open);
        expect(open).toBe(false);
    });
});

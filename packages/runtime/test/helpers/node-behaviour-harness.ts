import { createRequire } from "node:module";

import { vi } from "vitest";

/**
 * Shared classic node-behaviour test harness (roadmap P81).
 *
 * Extracted from the repeated boilerplate in the p59 / p56 / p30 / p38 tests.
 * The contract for the per-category behaviour-test phases P82–P86 is THIS file:
 * those phases should drive node behaviour through the helpers here and not
 * re-derive the `webapp.__test__` plumbing.
 *
 * What "classic behaviour test" means in this repo:
 *   - Drive a *registered* node's `inputHandler` (the real one wired in
 *     `nodes/webapp.js`) with an incoming `msg`.
 *   - Observe BOTH observable effects of a handler:
 *       1. output messages on the node's port (the `send` callback), and
 *       2. SSE pushes written to connected clients (the live transport).
 *   - Assert against the parsed SSE frames and the captured output messages.
 *
 * No HTTP server, no browser. E2E (Playwright) is reserved for the editor
 * property panels and client rendering — see `test-conventions.md` in this dir.
 */

const require = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// webapp.__test__ surface — typed just enough for the harness.
// ---------------------------------------------------------------------------

/** A Node-RED-style input handler: `(node, msg, send, done)`. */
export type InputHandler = (node: unknown, msg: unknown, send: unknown, done: unknown) => void;

interface NodeRegistration {
    mapConfig: (config: Record<string, unknown>) => Record<string, unknown>;
    options: { inputHandler: InputHandler };
}

interface RuntimeState {
    liveState: Map<string, unknown>;
    clientStateMap: Map<string, unknown>;
    streamClients: Map<string, Map<string, { res: unknown; location: string }>>;
    definitions: Map<string, { nodeId: string; appId?: string; definition: Record<string, unknown> }>;
    RED: unknown;
}

interface WebappTestSurface {
    runtimeNodeRegistry: Record<string, NodeRegistration>;
    runtimeState: RuntimeState;
    addStreamClient: (appId: string, clientId: string, res: unknown, location: string) => void;
    interactionInputHandler: (ownedVerbs: string[], next?: InputHandler) => InputHandler;
    INTERACTION_VERBS_BY_TYPE: Record<string, string[]>;
    dispatchClientEvent: (
        RED: unknown,
        appId: string,
        body: Record<string, unknown>,
        definitions: unknown[]
    ) => {
        success: boolean;
        status?: number;
        body?: string;
        message?: { ui: Record<string, unknown> };
        [key: string]: unknown;
    };
}

const webapp = require("../../../../nodes/webapp.js") as { __test__: WebappTestSurface };

/**
 * The raw `webapp.__test__` surface. Prefer the helpers below; reach for this
 * only when you need an export the harness does not wrap.
 */
export const webappTest = webapp.__test__;

// ---------------------------------------------------------------------------
// Fake SSE response — records every frame and parses it back into events.
// ---------------------------------------------------------------------------

/** One parsed SSE frame: its event name and the JSON-decoded `data:` payload. */
export interface SseEvent {
    event: string;
    data: unknown;
}

/**
 * A fake SSE `res` that the runtime can `write()` to. Pass it to
 * {@link NodeBehaviourHarness.connectClient} (or `addStreamClient`) and then
 * read parsed frames back with {@link FakeSseRes.events}.
 */
export interface FakeSseRes {
    /** Raw chunks written by the runtime, in order. */
    frames: string[];
    /** Called by the runtime to push a frame. */
    write(chunk: string): void;
    /** All parsed `event:`/`data:` frames written so far. */
    events(): SseEvent[];
    /** Parsed frames filtered to a single event name (e.g. `"command"`). */
    eventsOfType(eventName: string): SseEvent[];
}

/** Create a standalone fake SSE response. */
export function makeFakeSseRes(): FakeSseRes {
    const frames: string[] = [];
    const res: FakeSseRes = {
        frames,
        write(chunk: string) {
            frames.push(chunk);
        },
        events(): SseEvent[] {
            return frames
                .join("")
                .split("\n\n")
                .filter((block) => block.includes("event:"))
                .map((block) => {
                    const lines = block.split("\n");
                    const eventLine = lines.find((l) => l.startsWith("event: "))!;
                    const dataLine = lines.find((l) => l.startsWith("data: "))!;
                    return {
                        event: eventLine.slice("event: ".length),
                        data: JSON.parse(dataLine.slice("data: ".length))
                    };
                });
        },
        eventsOfType(eventName: string): SseEvent[] {
            return res.events().filter((e) => e.event === eventName);
        }
    };
    return res;
}

// ---------------------------------------------------------------------------
// Driving an input handler.
// ---------------------------------------------------------------------------

/** The result of driving an input handler: the two observable effects. */
export interface DriveResult {
    /** The vitest mock passed as the handler's `send` (output port). */
    send: ReturnType<typeof vi.fn>;
    /** The vitest mock passed as the handler's `done`. */
    done: ReturnType<typeof vi.fn>;
    /** Output messages emitted on the port, in order (i.e. each `send(msg)`). */
    sent: unknown[];
}

/** A fake node object as the shared input handlers expect it. */
export interface FakeNode {
    id: string;
    z: undefined;
    webappDefinition: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// The harness.
// ---------------------------------------------------------------------------

/**
 * Per-test harness around the live `webapp.__test__` runtime.
 *
 * Construct one in `beforeEach` and call {@link reset} (or just construct fresh
 * each test). Typical flow:
 *
 * ```ts
 * const h = new NodeBehaviourHarness();
 * beforeEach(() => h.reset());
 * afterEach(() => h.teardown());
 *
 * it("ui-dialog open pushes a command", () => {
 *   const client = h.connectClient("c1");
 *   const node = h.makeNode("ui-dialog", "editDialog");
 *   const { sent } = h.drive("ui-dialog", node, {
 *     ui: { clientId: "c1", action: { type: "open" } }
 *   });
 *   expect(client.eventsOfType("command")[0].data).toMatchObject({
 *     command: { type: "open", target: "editDialog" }
 *   });
 *   expect(sent[0]).toBeDefined(); // msg passed through
 * });
 * ```
 */
export class NodeBehaviourHarness {
    /** The app id every helper defaults to. Override per call where needed. */
    readonly appId: string;

    /** Direct access to the live runtime state maps (cleared by {@link reset}). */
    readonly state: RuntimeState;

    /** The registered node table — `<type> → { mapConfig, options.inputHandler }`. */
    readonly registry: Record<string, NodeRegistration>;

    constructor(appId = "harnessApp") {
        this.appId = appId;
        this.state = webappTest.runtimeState;
        this.registry = webappTest.runtimeNodeRegistry;
    }

    /**
     * Clear all runtime state and register a bare default `ui-app` definition.
     * Pass `appConfig` to register the app with extra config (e.g. error
     * forwarding); it is run through the real `ui-app` `mapConfig`.
     *
     * Call this in `beforeEach`.
     */
    reset(appConfig?: Record<string, unknown>): this {
        this.state.liveState.clear();
        this.state.clientStateMap.clear();
        this.state.streamClients.clear();
        this.state.definitions.clear();
        this.state.RED = { nodes: { getNode: () => undefined } };
        this.registerApp(appConfig);
        return this;
    }

    /**
     * Restore RED to undefined. Call in `afterEach` to match the existing
     * p56/p59 cleanup and avoid leaking the stub across files.
     */
    teardown(): void {
        this.state.RED = undefined;
    }

    /**
     * Replace the runtime `RED` double. The default ({@link reset}) returns
     * `undefined` from `getNode`; override for tests that need `RED.log`,
     * `RED.nodes.getNode` to resolve, etc.
     */
    setRED(red: unknown): this {
        this.state.RED = red;
        return this;
    }

    /**
     * Register the harness app (id = {@link appId}) in `runtimeState.definitions`.
     * With no config it stores a minimal `{ type: "ui-app", id }` definition (the
     * p59 shape). With config it runs the real `ui-app` `mapConfig` first (the
     * p56 shape) so `resolveAppForwardConfig` and friends read a real definition.
     */
    registerApp(appConfig?: Record<string, unknown>): Record<string, unknown> {
        const definition = appConfig
            ? this.registry["ui-app"].mapConfig({
                  id: this.appId,
                  root: this.appId,
                  name: "Harness App",
                  layout: "app",
                  ...appConfig
              })
            : { type: "ui-app", id: this.appId };
        this.state.definitions.set(this.appId, {
            nodeId: this.appId,
            appId: this.appId,
            definition
        });
        return definition;
    }

    /**
     * Connect a fake SSE client to an app and return its {@link FakeSseRes}.
     * Defaults to {@link appId} and location `"/"`.
     */
    connectClient(clientId: string, location = "/", appId = this.appId): FakeSseRes {
        const res = makeFakeSseRes();
        webappTest.addStreamClient(appId, clientId, res, location);
        return res;
    }

    /**
     * Build a fake node object suitable for passing to an input handler. It
     * carries `id`, `z: undefined`, and `webappDefinition` — the fields the
     * shared handlers read. Pass `definition` to override the default
     * `{ type, id }` (e.g. a `mapConfig` output for a store/query node).
     */
    makeNode(type: string, id: string, definition?: Record<string, unknown>): FakeNode {
        return {
            id,
            z: undefined,
            webappDefinition: definition ?? { type, id }
        };
    }

    /**
     * Map a raw node config through its registered `mapConfig`, the way deploy
     * does. Use for store/query/etc. nodes whose handlers read a compiled
     * definition. Returns the mapped definition (no `z`).
     */
    mapConfig(type: string, config: Record<string, unknown>): Record<string, unknown> {
        const reg = this.registry[type];
        if (!reg?.mapConfig) {
            throw new Error(`node type "${type}" has no mapConfig in the runtime registry`);
        }
        return reg.mapConfig(config);
    }

    /**
     * Map a list of raw node configs through their registered `mapConfig`,
     * preserving each node's `z` (flow id). This is the input shape the
     * dispatch/render helpers expect (mirrors the p30/p56 `buildDefinitions`).
     */
    buildDefinitions(rawNodes: Record<string, unknown>[]): Record<string, unknown>[] {
        return rawNodes.map((node) => {
            const reg = this.registry[node.type as string];
            return reg?.mapConfig ? { ...reg.mapConfig(node), z: node.z } : { ...node, id: node.id };
        });
    }

    /**
     * Drive a registered node's real `inputHandler` with an incoming `msg`.
     * Captures the output-port messages (`send`) and `done`. Inspect SSE pushes
     * via the {@link FakeSseRes} returned by {@link connectClient}.
     *
     * `nodeOrId` may be a node object (from {@link makeNode}) or an id string,
     * in which case a default node `{ id, webappDefinition: { type, id } }` is
     * built for you.
     */
    drive(type: string, nodeOrId: FakeNode | string, msg: unknown): DriveResult {
        const reg = this.registry[type];
        if (!reg?.options?.inputHandler) {
            throw new Error(`node type "${type}" has no inputHandler in the runtime registry`);
        }
        const node = typeof nodeOrId === "string" ? this.makeNode(type, nodeOrId) : nodeOrId;
        const send = vi.fn();
        const done = vi.fn();
        reg.options.inputHandler(node, msg, send, done);
        return {
            send,
            done,
            sent: send.mock.calls.map((call) => call[0])
        };
    }

    /**
     * Drive the raw client→server event ingest path (P30): the browser reports
     * `{ clientId, event, sourceId, params }` and the runtime emits `msg.ui` on
     * the originating node's output port. Builds a RED double whose listed nodes
     * record what was emitted; returns the dispatch result plus an `emitted` map
     * (`nodeId → msg.ui[]`).
     */
    dispatchClientEvent(
        nodeIds: string[],
        body: Record<string, unknown>,
        definitions: Record<string, unknown>[],
        appId = this.appId
    ): {
        result: ReturnType<WebappTestSurface["dispatchClientEvent"]>;
        emitted: Map<string, Array<Record<string, unknown>>>;
    } {
        const emitted = new Map<string, Array<Record<string, unknown>>>();
        const nodes = new Map<string, { id: string; send: (msg: { ui: Record<string, unknown> }) => void }>();
        for (const id of nodeIds) {
            emitted.set(id, []);
            nodes.set(id, {
                id,
                send(msg: { ui: Record<string, unknown> }) {
                    emitted.get(id)!.push(msg.ui);
                }
            });
        }
        const RED = { nodes: { getNode: (id: string) => nodes.get(id) || undefined } };
        const result = webappTest.dispatchClientEvent(RED, appId, body, definitions);
        return { result, emitted };
    }
}

/**
 * Convenience: the verb-ownership table (`INTERACTION_VERBS_BY_TYPE`) exported
 * verbatim from the runtime, for assertions like the p59 ownership tests.
 */
export const INTERACTION_VERBS_BY_TYPE = webappTest.INTERACTION_VERBS_BY_TYPE;

/**
 * Convenience: the `interactionInputHandler(ownedVerbs[, next])` factory, for
 * testing the delegation/ownership behaviour directly (p59).
 */
export const interactionInputHandler = webappTest.interactionInputHandler;

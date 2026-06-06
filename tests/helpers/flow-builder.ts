import type { NodeDef } from "./admin-api";

/**
 * FlowBuilder — fluent construction of minimal, isolated flows for per-node
 * E2E specs (P41).
 *
 * Each spec needs a tiny flow: one ui-app, usually one ui-route, and the node
 * under test mounted into it. Writing that raw JSON by hand is verbose and
 * error-prone (uiId vs id, parent vs mount, the tab `z` field). FlowBuilder
 * supplies canonical defaults for every node type so a spec only overrides the
 * field it is actually testing.
 *
 * Invariants honoured (see .ai/agents/architecture.md):
 *   - UI hierarchy is `parent` / `mount`, never wires.
 *   - Mount paths: view nodes default to `<routeId>.content` (the id-keyed dot
 *     form, e.g. `home.content`). Route mounts may also be keyed by path
 *     (`route:/path/content`) — override `mount` if a spec needs that form.
 *   - Every non-app node carries a `parent` (the app id) and a `mount`.
 *
 * Usage:
 *   const flow = new FlowBuilder()
 *     .app({ id: "testApp", root: "testApp" })
 *     .node("ui-text", { id: "t1", text: "Hello" })   // mounts to testApp.content
 *     .build();
 *
 * P48: the ui-app is the implicit root route ("/"). A .route() call must use a
 * non-"/" path (e.g. "/customers"); path "/" throws. Home content needs no route.
 */

const TAB_ID = "e2e-flow";

let seq = 0;
function uid(prefix: string): string {
    seq += 1;
    return `${prefix}${seq}`;
}

type Overrides = Record<string, unknown>;

/** Canonical minimal default for one node type, given the current app/route. */
function defaultsFor(type: string, ctx: { appId: string; routeId?: string; id: string }): NodeDef {
    // P48: with no explicit route, content mounts into the ui-app's content slot
    // (the app is the implicit root route). `mount` is a normal override — a spec
    // that wants another slot (e.g. `appId.navbar`) still passes it explicitly.
    const mount = ctx.routeId ? `${ctx.routeId}.content` : `${ctx.appId}.content`;
    const base: NodeDef = {
        type,
        id: ctx.id,
        uiId: ctx.id,
        name: ctx.id,
        parent: ctx.appId,
        mount,
        z: TAB_ID,
        x: 100,
        y: 100,
        wires: [[]]
    };
    switch (type) {
        // ui-text: leave `value` unset so the runtime derives a literal binding
        // from `text` (config.value ?? literalBinding(config.text)). Baking a
        // `value` here would shadow a caller's `text` override.
        case "ui-text":
            return { ...base, text: "Text" };
        case "ui-button":
            return { ...base, label: "Button" };
        case "ui-input":
            return { ...base, label: "Input", inputType: "text", value: { kind: "literal", value: "" } };
        case "ui-textarea":
            return { ...base, label: "Textarea", value: { kind: "literal", value: "" } };
        case "ui-select":
            return { ...base, label: "Select", optionsJson: JSON.stringify([{ label: "A", value: "a" }]), value: { kind: "literal", value: "" } };
        case "ui-checkbox":
            return { ...base, label: "Checkbox", value: { kind: "literal", value: false } };
        case "ui-radio":
            return { ...base, label: "Radio", optionsJson: JSON.stringify([{ label: "A", value: "a" }]), value: { kind: "literal", value: "" } };
        case "ui-switch":
            return { ...base, label: "Switch", value: { kind: "literal", value: false } };
        case "ui-datepicker":
            return { ...base, label: "Date", value: { kind: "literal", value: "" } };
        case "ui-slider":
            return { ...base, label: "Slider", min: 0, max: 100, step: 1, value: { kind: "literal", value: 0 } };
        case "ui-table":
            return { ...base, columns: JSON.stringify([{ key: "name", label: "Name" }]), rowsPath: "rows" };
        case "ui-container":
            return { ...base, layoutId: "vertical" };
        case "ui-store":
            // store has no visible mount but MUST have x/y so Node-RED places it
            // in flow.nodes (not flow.configs). Nodes without x/y are treated as
            // config nodes, which causes "Circular config node dependency" errors.
            return { type, id: ctx.id, uiId: ctx.id, name: ctx.id, parent: ctx.appId, statePath: "state", initialValue: "{}", z: TAB_ID, x: 100, y: 300, wires: [[]] };
        case "ui-query":
            // query has no visible mount; x/y required to avoid config-node treatment.
            return { type, id: ctx.id, uiId: ctx.id, name: ctx.id, parent: ctx.appId, queryPath: "data", z: TAB_ID, x: 100, y: 350, wires: [[]] };
        case "ui-action":
            // action has no visible mount; x/y required to avoid config-node treatment.
            return { type, id: ctx.id, uiId: ctx.id, name: ctx.id, parent: ctx.appId, actionType: "navigate", z: TAB_ID, x: 100, y: 400, wires: [[]] };
        case "ui-navigation":
            // navigation has no visible mount; x/y required to avoid config-node treatment.
            return { type, id: ctx.id, uiId: ctx.id, name: ctx.id, parent: ctx.appId, to: "/", z: TAB_ID, x: 100, y: 450, wires: [[]] };
        default:
            return base;
    }
}

export class FlowBuilder {
    private nodes: NodeDef[] = [];
    private appId: string | undefined;
    private routeId: string | undefined;

    /** Add a ui-app node. Becomes the default parent for subsequent nodes. */
    app(overrides: Overrides = {}): this {
        const id = (overrides.id as string) ?? uid("app");
        const node: NodeDef = {
            type: "ui-app",
            id,
            name: id,
            title: id,
            root: id,
            layout: "vertical",
            z: TAB_ID,
            x: 100,
            y: 100,
            wires: [[]],
            ...overrides
        };
        this.appId = node.id as string;
        this.nodes.push(node);
        return this;
    }

    /** Add a ui-route. Parent defaults to the last-added app. */
    route(overrides: Overrides = {}): this {
        if (!this.appId) {
            throw new Error("FlowBuilder.route() called before .app()");
        }
        // P48: path "/" is reserved for the implicit app root route. Home content
        // mounts directly to the ui-app slots; ui-route is for sub-paths only.
        if ((overrides.path as string | undefined ?? "/") === "/") {
            throw new Error(
                "FlowBuilder.route() path '/' is reserved for the implicit app root. " +
                "Drop the .route() call and mount content to the app's content slot, " +
                "or pass a non-'/' path (e.g. { path: '/customers' })."
            );
        }
        const id = (overrides.id as string) ?? uid("route");
        const node: NodeDef = {
            type: "ui-route",
            id,
            uiId: id,
            name: id,
            parent: this.appId,
            path: "/",
            title: id,
            layoutId: "vertical",
            z: TAB_ID,
            x: 100,
            y: 200,
            wires: [[]],
            ...overrides
        };
        this.routeId = node.id as string;
        this.nodes.push(node);
        return this;
    }

    /** Add any node type with canonical defaults; override only what you test. */
    node(type: string, overrides: Overrides = {}): this {
        if (!this.appId) {
            throw new Error(`FlowBuilder.node(${type}) called before .app()`);
        }
        const id = (overrides.id as string) ?? uid(type.replace(/^ui-/, ""));
        const defaults = defaultsFor(type, { appId: this.appId, routeId: this.routeId, id });
        this.nodes.push({ ...defaults, ...overrides });
        return this;
    }

    /**
     * Add an inject → function pipeline that issues a ui-store `replace` operation.
     * The inject id is `<injectId>`; fire it via `injectMessage(request, injectId)`.
     * The function node reformats `msg.payload` into the `msg.ui.store` structure
     * the store input-handler expects.
     *
     * @param injectId   id for the inject node (pass to injectMessage)
     * @param storeId    ui-store node id (must match the store's uiId)
     * @param value      value to replace the store with (must be JSON-serialisable)
     * @param storeNodeId  Node-RED node id of the ui-store (typically same as storeId)
     */
    withStoreInject(injectId: string, storeId: string, value: unknown, storeNodeId?: string): this {
        const funcId = `${injectId}__fn`;
        const targetId = storeNodeId ?? storeId;
        const funcCode = `msg.ui = { store: { id: "${storeId}", op: "replace", value: ${JSON.stringify(value)} } }; return msg;`;
        this.nodes.push({
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
            y: 420,
            wires: [[funcId]]
        });
        this.nodes.push({
            type: "function",
            id: funcId,
            name: funcId,
            func: funcCode,
            outputs: 1,
            z: TAB_ID,
            x: 300,
            y: 420,
            wires: [[targetId]]
        });
        return this;
    }

    /**
     * Add a standard inject node wired to `wiredTo` (the node-under-test id), so
     * input-port tests can fire a message via admin-api.injectMessage(id).
     */
    withInjectNode(id: string, wiredTo: string, payload?: unknown): this {
        const hasPayload = payload !== undefined;
        this.nodes.push({
            type: "inject",
            id,
            name: id,
            props: hasPayload ? [{ p: "payload" }] : [{ p: "payload" }],
            repeat: "",
            crontab: "",
            once: false,
            onceDelay: "0.1",
            topic: "",
            payload: hasPayload ? JSON.stringify(payload) : "",
            payloadType: hasPayload ? "json" : "date",
            z: TAB_ID,
            x: 100,
            y: 400,
            wires: [[wiredTo]]
        });
        return this;
    }

    /** Return the assembled flow, with a leading tab node. */
    build(): NodeDef[] {
        const tab: NodeDef = { id: TAB_ID, type: "tab", label: "Flow", disabled: false, info: "" };
        return [tab, ...this.nodes];
    }
}

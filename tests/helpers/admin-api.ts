import type { APIRequestContext } from "@playwright/test";

/**
 * Admin-API helpers for per-node E2E specs (P41).
 *
 * These wrap the Node-RED admin endpoints exposed on the E2E instance (port
 * 1882, reachable via the Playwright `request` fixture's baseURL). Every helper
 * throws on a non-2xx response so a broken deploy fails the test immediately
 * rather than producing a confusing downstream assertion failure.
 *
 * A flow is a flat array of node definitions (see FlowBuilder). The first entry
 * is always a `tab` node; everything else references it via `z`.
 */

export type NodeDef = Record<string, unknown>;

const TAB_ID = "e2e-flow";

/** A minimal single-tab flow with no nodes. Used by resetFlow(). */
export function emptyFlow(): NodeDef[] {
    return [{ id: TAB_ID, type: "tab", label: "E2E", disabled: false, info: "" }];
}

async function putFlows(request: APIRequestContext, nodes: NodeDef[]): Promise<void> {
    // Node-RED accepts a full flow replace via POST /flows (the editor uses the
    // same endpoint on deploy). It returns 200/204 with the new revision.
    const response = await request.post("/flows", { data: nodes });
    if (!response.ok()) {
        const body = await response.text().catch(() => "<unreadable>");
        throw new Error(`deployFlow failed: ${response.status()} ${response.statusText()} — ${body}`);
    }
}

/**
 * Deploy `nodes` as the complete flow on the E2E Node-RED instance. If the flow
 * has no `tab` node, one is prepended and every node missing a `z` is bound to
 * it — so callers can pass a FlowBuilder.build() result or a bare node list.
 */
export async function deployFlow(request: APIRequestContext, nodes: NodeDef[]): Promise<void> {
    const hasTab = nodes.some((node) => node.type === "tab");
    let flow = nodes;
    if (!hasTab) {
        const tab = emptyFlow()[0];
        flow = [tab, ...nodes.map((node) => (node.z ? node : { ...node, z: tab.id }))];
    }
    await putFlows(request, flow);
}

/** Reset the E2E instance to a single empty tab — full isolation between specs. */
export async function resetFlow(request: APIRequestContext): Promise<void> {
    await putFlows(request, emptyFlow());
}

/**
 * Trigger a node's input via Node-RED's built-in admin inject endpoint
 * (POST /inject/:id). Used to drive input-port tests: wire an `inject` node to
 * the node under test (FlowBuilder.withInjectNode) and call this to fire it.
 *
 * The optional payload is applied to the inject node's `payload` first via a
 * flow patch is NOT done here — Node-RED's /inject/:id fires the node as
 * configured. To send a specific payload, configure the inject node's payload
 * in the flow (FlowBuilder.withInjectNode accepts a payload) and call this with
 * no argument.
 */
export async function injectMessage(
    request: APIRequestContext,
    nodeId: string,
    payload?: unknown
): Promise<void> {
    const options = payload === undefined ? {} : { data: { __user_inject_props__: [{ p: "payload", v: payload, vt: "json" }] } };

    // Node-RED registers the inject endpoint asynchronously after `POST /flows`
    // resolves. Retry up to 5× with a 200ms back-off so the test does not fail
    // on a transient 404 before the node is fully registered.
    const maxRetries = 5;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const response = await request.post(`/inject/${encodeURIComponent(nodeId)}`, options);
        if (response.ok()) {
            return;
        }
        if (response.status() === 404 && attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
            continue;
        }
        const body = await response.text().catch(() => "<unreadable>");
        throw new Error(`injectMessage(${nodeId}) failed: ${response.status()} ${response.statusText()} — ${body}`);
    }
}

import { type Page } from "@playwright/test";

/**
 * Editor readiness helpers (P65).
 *
 * The Node-RED editor registers node-type definitions asynchronously: after the
 * page loads, the editor fetches each node's HTML/script bundle and *evals* it,
 * which is what populates `RED.nodes.getType(...)`. `page.waitForLoadState(
 * "networkidle")` only proves the network went quiet — it does NOT prove those
 * type scripts have finished executing. Late in the ~6-minute sequential E2E run
 * the shared server is slower, so registration races past `networkidle` and
 * `getType("ui-app")` intermittently returns `undefined` (the historical
 * "found:false" flakiness documented in docs/agent-roadmap-archive.yaml#P66).
 *
 * `gotoEditor` / `waitForNodeTypes` poll the registry itself until the requested
 * first-party types are present, which is the real readiness signal. Use them in
 * place of a bare `goto("/")` + `networkidle` whenever a test reads
 * `RED.nodes.getType(...)` or per-node editor defaults.
 */

type REDRegistry = {
    nodes?: {
        node?: (id: string) => unknown;
        getType?: (type: string) => unknown;
    };
    editor?: { edit?: (node: unknown) => void };
};

/** The first-party editor types every webapp spec depends on being registered. */
export const CORE_UI_TYPES = [
    "ui-app",
    "ui-route",
    "ui-container",
    "ui-button",
    "ui-table",
    "ui-store"
] as const;

/**
 * Wait until `RED.nodes.getType(type)` is truthy for every requested type. This
 * is the registry-readiness signal `networkidle` cannot give. Defaults to the
 * core webapp types when no explicit list is passed.
 */
export async function waitForNodeTypes(
    page: Page,
    types: readonly string[] = CORE_UI_TYPES,
    timeout = 30000
): Promise<void> {
    await page.waitForFunction(
        (wanted) => {
            const red = (window as unknown as { RED?: REDRegistry }).RED;
            const getType = red?.nodes?.getType;
            const edit = red?.editor?.edit;
            if (typeof getType !== "function" || typeof edit !== "function") {
                return false;
            }
            return wanted.every((t) => Boolean(getType(t)));
        },
        Array.from(types),
        { timeout }
    );
}

/**
 * Navigate to the editor and block until the requested node types are
 * registered. Replaces the `goto("/") + waitForLoadState("networkidle")`
 * preamble that raced node-type registration.
 */
export async function gotoEditor(
    page: Page,
    types: readonly string[] = CORE_UI_TYPES
): Promise<void> {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await waitForNodeTypes(page, types);
}

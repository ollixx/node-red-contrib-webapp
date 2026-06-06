import { expect, type Page } from "@playwright/test";

/**
 * WebappPage — page-object for driving a deployed webapp in the browser and
 * asserting on rendering and events (P41).
 *
 * The webapp client (resources/lib/webapp-client.js) renders into
 * #webapp-client-root, opens an SSE stream at /webapp/:appId/stream, and POSTs
 * UI events to /webapp/:appId/event. This object wraps the common waits and
 * assertions so per-node specs stay declarative.
 */
export class WebappPage {
    constructor(
        private readonly page: Page,
        private readonly appId: string
    ) {}

    private base(): string {
        return `/webapp/${encodeURIComponent(this.appId)}`;
    }

    /** The app client root, where the rendered component tree lives. */
    root() {
        return this.page.locator("#webapp-client-root");
    }

    /**
     * Navigate to the app at `path` (default "/") and wait for the SSE stream
     * response headers to arrive. Waiting for the response (rather than just the
     * request) guarantees the server has registered this client before the test
     * injects any messages — otherwise a command push could arrive before the
     * subscriber is in the map and be silently dropped.
     */
    async navigate(path = "/"): Promise<void> {
        const streamConnected = this.page.waitForResponse((res) =>
            res.url().includes(`${this.base()}/stream`)
        );
        const suffix = path.startsWith("/") ? path : `/${path}`;
        await this.page.goto(`${this.base()}${suffix}`);
        await expect(this.root()).toBeVisible();
        await streamConnected;
    }

    /** Assert a component matching `selector` is visible in the rendered tree. */
    async expectComponent(selector: string): Promise<void> {
        await expect(this.page.locator(selector)).toBeVisible();
    }

    /** Assert that `selector`'s `attr` attribute equals `value`. */
    async expectAttr(selector: string, attr: string, value: string): Promise<void> {
        await expect(this.page.locator(selector)).toHaveAttribute(attr, value);
    }

    /** The current innerHTML of the app root — for structural assertions. */
    async getHtml(): Promise<string> {
        return this.root().innerHTML();
    }

    /**
     * Intercept the next POST /webapp/:appId/event request and resolve with its
     * parsed JSON body. Call this BEFORE the action that triggers the event, then
     * await the returned promise after.
     */
    interceptNextEvent(): Promise<Record<string, unknown>> {
        return this.page
            .waitForRequest(
                (req) => req.url().includes(`${this.base()}/event`) && req.method() === "POST"
            )
            .then((req) => (req.postDataJSON() ?? {}) as Record<string, unknown>);
    }

    /**
     * Wait for the live SSE "snapshot" push to re-render the root and resolve
     * with the new innerHTML. The client applies the snapshot in place (no
     * reload), so we wait for the root to settle after the next stream frame.
     */
    async waitForSseSnapshot(): Promise<string> {
        // The stream frame mutates #webapp-client-root in place. There is no
        // separate DOM signal, so we wait for the network frame, then read.
        await this.page.waitForResponse(
            (res) => res.url().includes(`${this.base()}/stream`),
            { timeout: 10000 }
        ).catch(() => undefined);
        return this.getHtml();
    }
}

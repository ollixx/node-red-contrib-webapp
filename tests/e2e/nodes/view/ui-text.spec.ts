import { expect, test } from "@playwright/test";

import { deployFlow, injectMessage, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * Per-node E2E specs for ui-text (stateless view node).
 *
 * P43 scope:
 *   - text content renders inside the component.
 *   - binding to store value renders the store's current value.
 * P111 scope (style/variant split):
 *   - `style` renders the matching semantic HTML element + webapp-text--<role> class.
 *   - `variant` (semantic colour) adds a webapp-text--color-<c> class.
 *   - legacy `variant: "<role>"` migrates onto the style axis.
 * P111 scope (value sources):
 *   - `store` binding renders the bound store value.
 *   - standard `msg` binding renders empty until the configured message property
 *     is pushed; respects the binding's path (e.g. payload, payload.label).
 */

test.describe("ui-text (P43)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("text content renders inside the component", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "textApp1", root: "textApp1" })
            .node("ui-text", { id: "textNode1", text: "Hello from ui-text" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "textApp1");
        await webapp.navigate("/");
        await expect(webapp.root()).toContainText("Hello from ui-text");
    });

    // P111: `state` is no longer offered in the ui-text editor, but the renderer
    // still supports it — a legacy/existing `state` binding must keep rendering.
    test("legacy state binding still renders (editor no longer offers it)", async ({ page, request }) => {
        // Build a flow with a store holding an initial string and a text node
        // whose value is bound to the store's state path.
        const flow = new FlowBuilder()
            .app({ id: "textApp2", root: "textApp2" })
            .node("ui-store", {
                id: "textStore2",
                statePath: "greeting",
                initialValue: "\"Hello from store\""
            })
            .node("ui-text", {
                id: "textNode2",
                value: { kind: "state", path: "greeting" }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "textApp2");
        await webapp.navigate("/");
        await expect(webapp.root()).toContainText("Hello from store");
    });

    test("renders inside webapp-text element", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "textApp3", root: "textApp3" })
            .node("ui-text", { id: "textNode3", text: "Structured text" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "textApp3");
        await webapp.navigate("/");
        await expect(webapp.root().locator(".webapp-text")).toBeVisible();
        await expect(webapp.root().locator(".webapp-text")).toContainText("Structured text");
    });

    // P111: `style` (typographic role) renders the matching semantic HTML element
    // plus a webapp-text--<role> class.
    test("style 'heading-1' renders an <h1> with the role class", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "textApp4", root: "textApp4" })
            .node("ui-text", { id: "textNode4", text: "Big title", style: "heading-1" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "textApp4");
        await webapp.navigate("/");
        const heading = webapp.root().locator("h1.webapp-text--heading-1");
        await expect(heading).toBeVisible();
        await expect(heading).toContainText("Big title");
    });

    test("style 'code' renders a <code> element", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "textApp5", root: "textApp5" })
            .node("ui-text", { id: "textNode5", text: "const x = 1", style: "code" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "textApp5");
        await webapp.navigate("/");
        await expect(webapp.root().locator("code.webapp-text--code")).toContainText("const x = 1");
    });

    // P111: `variant` (semantic colour) adds a webapp-text--color-<c> class.
    test("variant 'danger' adds the colour class", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "textApp6", root: "textApp6" })
            .node("ui-text", { id: "textNode6", text: "Warning!", variant: "danger" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "textApp6");
        await webapp.navigate("/");
        await expect(webapp.root().locator(".webapp-text--color-danger")).toContainText("Warning!");
    });

    // P111: legacy flows stored the typographic role in `variant`; the runtime
    // migrates them so an old `variant: "heading-2"` still renders as a heading.
    test("legacy variant='heading-2' migrates to the style axis (<h2>)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "textApp7", root: "textApp7" })
            .node("ui-text", { id: "textNode7", text: "Legacy heading", variant: "heading-2" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "textApp7");
        await webapp.navigate("/");
        await expect(webapp.root().locator("h2.webapp-text--heading-2")).toContainText("Legacy heading");
    });

    // P111: `store` binding — the text is bound to a ui-store and renders its value.
    test("store binding renders the bound store value", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "textApp8", root: "textApp8" })
            .node("ui-store", { id: "textStore8", statePath: "title", initialValue: "\"From store\"" })
            .node("ui-text", { id: "textNode8", value: { kind: "store", path: "textStore8" } })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "textApp8");
        await webapp.navigate("/");
        await expect(webapp.root().locator(".webapp-text")).toContainText("From store");
    });

    // P111: standard msg binding (path "payload") — renders empty until a message
    // is pushed to the node.
    test("msg binding (payload): empty until a message is pushed", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "textApp9", root: "textApp9" })
            .node("ui-text", { id: "textNode9", value: { kind: "msg", path: "payload" } })
            .withInjectNode("inj9", "textNode9", "Pushed value")
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "textApp9");
        await webapp.navigate("/");

        // Before any message: the text element renders but is empty (NOT "?").
        const text = webapp.root().locator(".webapp-text");
        await expect(text).toHaveText("");

        // Push a payload → the text updates and is shared via SSE.
        await injectMessage(request, "inj9");
        await expect(text).toHaveText("Pushed value");
    });

    // P113: JSONata binding — message-driven. The expression is evaluated against
    // the incoming msg; renders empty until the first message, then shows the
    // result. `payload.user.name` against { user: { name: "Ada" } } → "Ada".
    test("jsonata binding (payload.user.name): empty until a message, then the evaluated value", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "textApp11", root: "textApp11" })
            .node("ui-text", { id: "textNode11", value: { kind: "jsonata", path: "payload.user.name" } })
            .withInjectNode("inj11", "textNode11", { user: { name: "Ada" } })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "textApp11");
        await webapp.navigate("/");

        // Before any message: the text element renders but is empty (NOT "?").
        const text = webapp.root().locator(".webapp-text");
        await expect(text).toHaveText("");

        // Push a message → the JSONata expression evaluates against msg and the
        // result is held server-side and shared via SSE.
        await injectMessage(request, "inj11");
        await expect(text).toHaveText("Ada");
    });

    // P113: a `number` literal sub-type renders its String() form ("42").
    test("number literal binding renders its stringified value", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "textApp12", root: "textApp12" })
            .node("ui-text", { id: "textNode12", value: { kind: "literal", value: 42 } })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "textApp12");
        await webapp.navigate("/");
        await expect(webapp.root().locator(".webapp-text")).toHaveText("42");
    });

    // P111: the msg binding respects its PATH — a nested property (payload.label)
    // is read from the incoming message, not just the whole payload.
    test("msg binding respects a nested path (payload.label)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "textApp10", root: "textApp10" })
            .node("ui-text", { id: "textNode10", value: { kind: "msg", path: "payload.label" } })
            .withInjectNode("inj10", "textNode10", { label: "Nested!" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "textApp10");
        await webapp.navigate("/");

        const text = webapp.root().locator(".webapp-text");
        await expect(text).toHaveText("");

        await injectMessage(request, "inj10");
        await expect(text).toHaveText("Nested!");
    });
});

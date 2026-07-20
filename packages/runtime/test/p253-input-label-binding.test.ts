import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * P253 — Muster-4-Abschluss (input/switch/textarea).
 *
 * `ui-input.label` is schema- and editor-bindable (P145, ADR 0012), yet its spec
 * documented it as a static "Textfeld". This test proves the full render pipeline
 * (renderer → serializer): a `state`-BOUND label is RESOLVED and rendered as the
 * `sl-input` `label` attribute with the resolved value — NOT the literal path
 * string. Turns RED if either the renderer stops resolving the binding or the
 * serializer stops emitting the attribute.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const require = createRequire(import.meta.url);
const _dir = path.dirname(fileURLToPath(import.meta.url));
const serializerPath = path.resolve(_dir, "../../../resources/lib/webapp-serializer.js");
const rendererPath = path.resolve(_dir, "../../renderer/dist/index.js");

const serializer = require(serializerPath) as {
    renderComponentHtml: (component: unknown, layoutId: string, ctx: unknown) => string;
};

const { createRendererApp, findComponentInSnapshot } = require(rendererPath) as {
    createRendererApp: (model: unknown, options: unknown) => { render: () => unknown };
    findComponentInSnapshot: (snapshot: unknown, id: string) => unknown;
};

const NO_INTEGRATION = { stores: [], queries: [], actions: [], navigations: [] };
const CTX = { appId: "app1", location: "/" };

function renderInput(state: Record<string, unknown>): string {
    const model = {
        id: "app",
        name: "App",
        layouts: [{ id: "main", slots: [{ name: "content" }] }],
        routes: [{ id: "home", path: "/home", layoutId: "main" }],
        dialogs: [],
        components: [
            {
                id: "in1",
                kind: "input",
                mount: "route:/home/content",
                order: 0,
                bind: {
                    label: { kind: "state", path: "form.lbl" },
                    value: { kind: "literal", value: "" }
                },
                props: {},
                events: []
            }
        ]
    };
    const app = createRendererApp(model, { integration: NO_INTEGRATION, state });
    const rendered = findComponentInSnapshot(app.render(), "in1");
    return serializer.renderComponentHtml(rendered, "content", CTX);
}

describe("P253: ui-input.label — state binding resolved + rendered", () => {
    it("a state-bound label is resolved and rendered as the sl-input label attribute", () => {
        const html = renderInput({ form: { lbl: "Full name" } });
        expect(html).toContain("<sl-input");
        expect(html).toContain('label="Full name"');
    });

    it("the raw binding path string never leaks into the rendered attribute", () => {
        const html = renderInput({ form: { lbl: "Full name" } });
        expect(html).not.toContain("form.lbl");
        expect(html).not.toContain("[object Object]");
    });
});

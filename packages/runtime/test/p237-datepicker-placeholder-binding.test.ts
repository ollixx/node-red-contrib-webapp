import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * P237 — binding-doc-drift sweep (Muster 4).
 *
 * `ui-datepicker.placeholder` is schema- and editor-bindable (P149, ADR 0012),
 * yet its spec documented it as a static "Textfeld". This test proves the full
 * render pipeline (renderer → serializer): a `state`-BOUND placeholder is
 * RESOLVED and rendered as the `sl-input` `placeholder` attribute with the
 * resolved value — NOT the literal path string. Turns RED if either the
 * renderer stops resolving the binding or the serializer stops emitting the
 * attribute (the P237 serializer fix).
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

function renderDatepicker(state: Record<string, unknown>): string {
    const model = {
        id: "app",
        name: "App",
        layouts: [{ id: "main", slots: [{ name: "content" }] }],
        routes: [{ id: "home", path: "/home", layoutId: "main" }],
        dialogs: [],
        components: [
            {
                id: "dp1",
                kind: "datepicker",
                mount: "route:/home/content",
                order: 0,
                bind: {
                    placeholder: { kind: "state", path: "form.ph" },
                    value: { kind: "literal", value: "" }
                },
                props: { label: "Birthday" },
                events: []
            }
        ]
    };
    const app = createRendererApp(model, { integration: NO_INTEGRATION, state });
    const rendered = findComponentInSnapshot(app.render(), "dp1");
    return serializer.renderComponentHtml(rendered, "content", CTX);
}

describe("P237: ui-datepicker.placeholder — state binding resolved + rendered", () => {
    it("a state-bound placeholder is resolved and rendered as the sl-input placeholder attribute", () => {
        const html = renderDatepicker({ form: { ph: "Pick a date" } });
        expect(html).toContain("<sl-input");
        expect(html).toContain('placeholder="Pick a date"');
    });

    it("the raw binding path string never leaks into the rendered attribute", () => {
        const html = renderDatepicker({ form: { ph: "Pick a date" } });
        expect(html).not.toContain("form.ph");
        expect(html).not.toContain("[object Object]");
    });
});

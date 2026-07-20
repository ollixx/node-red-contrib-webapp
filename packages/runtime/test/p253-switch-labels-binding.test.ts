import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * P253 — Muster-4-Abschluss (input/switch/textarea).
 *
 * `ui-switch.label` / `labelOn` / `labelOff` are schema- and editor-bindable
 * (P147, ADR 0012), yet their spec rows documented them as static "Textfeld".
 * This test proves the full render pipeline (renderer → serializer): each
 * `state`-BOUND label is RESOLVED and rendered on the `sl-switch` (label as text
 * content, labelOn → `label-on`, labelOff → `label-off`) with the resolved value
 * — NOT the literal path string. Turns RED if the renderer stops resolving a
 * binding or the serializer stops emitting the attribute.
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

function renderSwitch(state: Record<string, unknown>): string {
    const model = {
        id: "app",
        name: "App",
        layouts: [{ id: "main", slots: [{ name: "content" }] }],
        routes: [{ id: "home", path: "/home", layoutId: "main" }],
        dialogs: [],
        components: [
            {
                id: "sw1",
                kind: "switch",
                mount: "route:/home/content",
                order: 0,
                bind: {
                    label: { kind: "state", path: "form.lbl" },
                    labelOn: { kind: "state", path: "form.on" },
                    labelOff: { kind: "state", path: "form.off" },
                    value: { kind: "literal", value: false }
                },
                props: {},
                events: []
            }
        ]
    };
    const app = createRendererApp(model, { integration: NO_INTEGRATION, state });
    const rendered = findComponentInSnapshot(app.render(), "sw1");
    return serializer.renderComponentHtml(rendered, "content", CTX);
}

describe("P253: ui-switch.label/labelOn/labelOff — state bindings resolved + rendered", () => {
    const state = { form: { lbl: "Notifications", on: "Enabled", off: "Disabled" } };

    it("a state-bound label is resolved and rendered as the sl-switch label text", () => {
        const html = renderSwitch(state);
        expect(html).toContain("<sl-switch");
        expect(html).toContain(">Notifications<");
    });

    it("a state-bound labelOn is resolved and rendered as the label-on attribute", () => {
        const html = renderSwitch(state);
        expect(html).toContain('label-on="Enabled"');
    });

    it("a state-bound labelOff is resolved and rendered as the label-off attribute", () => {
        const html = renderSwitch(state);
        expect(html).toContain('label-off="Disabled"');
    });

    it("no raw binding path string leaks into the rendered markup", () => {
        const html = renderSwitch(state);
        expect(html).not.toContain("form.lbl");
        expect(html).not.toContain("form.on");
        expect(html).not.toContain("form.off");
        expect(html).not.toContain("[object Object]");
    });
});

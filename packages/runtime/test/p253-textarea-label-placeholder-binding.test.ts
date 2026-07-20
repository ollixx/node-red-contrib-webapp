import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * P253 — Muster-4-Abschluss (input/switch/textarea).
 *
 * `ui-textarea.label` and `ui-textarea.placeholder` are schema- and
 * editor-bindable (P148, ADR 0012), yet their spec rows documented them as static
 * "Textfeld". `placeholder` was ALSO a live serializer bug: the resolved value
 * was dropped because the `sl-textarea` serializer never emitted a `placeholder`
 * attribute (the P253 serializer fix, mirroring the P237 datepicker fix). This
 * test proves the full render pipeline (renderer → serializer): each `state`/
 * `store`-BOUND value is RESOLVED and rendered as the `sl-textarea` `label` /
 * `placeholder` attribute — NOT the literal path string.
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

function renderTextarea(state: Record<string, unknown>): string {
    const model = {
        id: "app",
        name: "App",
        layouts: [{ id: "main", slots: [{ name: "content" }] }],
        routes: [{ id: "home", path: "/home", layoutId: "main" }],
        dialogs: [],
        components: [
            {
                id: "ta1",
                kind: "textarea",
                mount: "route:/home/content",
                order: 0,
                bind: {
                    label: { kind: "state", path: "form.lbl" },
                    placeholder: { kind: "state", path: "form.ph" },
                    value: { kind: "literal", value: "" }
                },
                props: {},
                events: []
            }
        ]
    };
    const app = createRendererApp(model, { integration: NO_INTEGRATION, state });
    const rendered = findComponentInSnapshot(app.render(), "ta1");
    return serializer.renderComponentHtml(rendered, "content", CTX);
}

describe("P253: ui-textarea.label/placeholder — state bindings resolved + rendered", () => {
    const state = { form: { lbl: "Comment", ph: "Type your comment…" } };

    it("a state-bound label is resolved and rendered as the sl-textarea label attribute", () => {
        const html = renderTextarea(state);
        expect(html).toContain("<sl-textarea");
        expect(html).toContain('label="Comment"');
    });

    it("a state-bound placeholder is resolved and rendered as the sl-textarea placeholder attribute (P253 serializer fix)", () => {
        const html = renderTextarea(state);
        expect(html).toContain('placeholder="Type your comment…"');
    });

    it("no raw binding path string leaks into the rendered markup", () => {
        const html = renderTextarea(state);
        expect(html).not.toContain("form.lbl");
        expect(html).not.toContain("form.ph");
        expect(html).not.toContain("[object Object]");
    });
});

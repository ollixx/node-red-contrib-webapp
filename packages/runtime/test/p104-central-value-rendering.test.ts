import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
    customersCrudAppModelFixture,
    customersCrudRuntimeIntegrationFixture
} from "@node-red-contrib-webapp/schema";

/**
 * P104 — central display-value normalization, proven through the FULL render
 * pipeline (renderer → serializer), the layer the browser actually observes.
 *
 * The contract (docs/nodes/concepts/value-rendering.md §1) is applied in ONE
 * place — renderer.ts `normalizeDisplayValue` — so every value-binding display
 * node behaves identically. These outcome tests render a ui-text and a ui-badge
 * bound to each row of the §1 table and assert the resulting DOM text:
 *
 *   0      → "0"      (falsy-but-valid number)
 *   false  → "false"  (falsy-but-valid boolean)
 *   ""     → ""       (deliberate empty — element rendered, no content)
 *   null   → "?"      (not displayable)
 *   undefined → "?"   (not displayable)
 *   {}/[]  → "?"      (non-scalar — never [object Object], never a JSON dump)
 *
 * Path note: createRequire + an absolute serializer path so the test runs
 * identically in the main checkout and in a worktree (resources/ is copied).
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

const ctx = { appId: "app1", location: "/" };

/**
 * Render one probe node bound (literal) to `value`, through renderer + serializer,
 * and return the text the browser would see inside the produced element.
 */
function renderToDom(kind: "text" | "badge", value: unknown): string {
    const model = {
        ...customersCrudAppModelFixture,
        components: [
            ...customersCrudAppModelFixture.components,
            {
                id: "probe",
                kind,
                mount: "layout:app/footer",
                bind: { value: { kind: "literal", value } },
                props: {},
                events: []
            }
        ]
    };

    const app = createRendererApp(model, {
        integration: customersCrudRuntimeIntegrationFixture,
        location: "/"
    });
    const rendered = findComponentInSnapshot(app.render(), "probe");
    const html = serializer.renderComponentHtml(rendered, "vertical", ctx);
    return innerText(kind, html);
}

/**
 * Extract the rendered display text from the produced HTML. The serializer wraps
 * each component in a `webapp-item` div; we read the content of the actual
 * display element (the inner webapp-text element — P111: a semantic tag such as
 * <p>/<h1>/<code> — for text, the <sl-badge> for badge), not the wrapper.
 */
function innerText(kind: "text" | "badge", html: string): string {
    if (kind === "badge") {
        const match = /<sl-badge[^>]*>([\s\S]*?)<\/sl-badge>/i.exec(html);
        return match ? match[1] : "<<no sl-badge>>";
    }

    // P111: the text element tag varies by `style` (defaults to <p>); capture the
    // tag name and use a backreference so any role's element is matched. ADR 0025:
    // the leaf now also carries `data-webapp-node` after its class (the per-item
    // wrapper div was dropped), so tolerate further attributes before the `>`.
    const match = /<([a-z0-9]+) class="webapp-text[^"]*"[^>]*>([\s\S]*?)<\/\1>/i.exec(html);
    return match ? match[2] : "<<no webapp-text>>";
}

const TABLE: Array<[label: string, raw: unknown, expected: string]> = [
    ["0 (valid number)", 0, "0"],
    ["42", 42, "42"],
    ["false (valid boolean)", false, "false"],
    ["true", true, "true"],
    ["empty string", "", ""],
    ["null", null, "?"],
    ["undefined", undefined, "?"],
    ["plain object", { foo: "bar" }, "?"],
    ["array", [1, 2, 3], "?"]
];

describe("P104: ui-text central value rendering (renderer → serializer → DOM)", () => {
    for (const [label, raw, expected] of TABLE) {
        it(`${label} → "${expected}"`, () => {
            expect(renderToDom("text", raw)).toBe(expected);
        });
    }

    it("a non-scalar never leaks as [object Object] or a JSON dump", () => {
        const html = serializer.renderComponentHtml(
            findComponentInSnapshot(
                createRendererApp(
                    {
                        ...customersCrudAppModelFixture,
                        components: [
                            ...customersCrudAppModelFixture.components,
                            {
                                id: "probe",
                                kind: "text",
                                mount: "layout:app/footer",
                                bind: { value: { kind: "literal", value: { a: 1, b: 2 } } },
                                props: {},
                                events: []
                            }
                        ]
                    },
                    { integration: customersCrudRuntimeIntegrationFixture, location: "/" }
                ).render(),
                "probe"
            ),
            "vertical",
            ctx
        );
        expect(html).not.toContain("[object Object]");
        expect(html).not.toContain('{"a":1');
        expect(html).toContain(">?<");
    });
});

describe("P104: ui-badge central value rendering (renderer → serializer → DOM)", () => {
    for (const [label, raw, expected] of TABLE) {
        it(`${label} → "${expected}"`, () => {
            expect(renderToDom("badge", raw)).toBe(expected);
        });
    }
});

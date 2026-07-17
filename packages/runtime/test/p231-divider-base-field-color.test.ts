import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

/**
 * P231 — base-field `color`/`visible` on ui-divider (and generic `color` routing).
 *
 * The schema now PRESERVES `visible`/`disabled`/`color` (baseFieldsSchema mixin),
 * mapConfig routes a `color` binding object GENERICALLY into `bind.color` (no
 * longer list-only) and `visible` into `visibleIf`, the renderer resolves
 * `bind.color` into `resolvedProps.color`, and the serializer applies it as the
 * Shoelace `--color` custom property on `<sl-divider>`. This is the unit-level lock
 * for the ui-divider color/visible E2E (tests/e2e/nodes/view/ui-divider.spec.ts,
 * un-fixmed by P231); the E2E proves the same behaviour end-to-end in the browser.
 */

const require = createRequire(import.meta.url);
const webapp = require("../../../nodes/webapp.js") as {
    __test__: {
        toComponentDefinitions: (components: unknown[]) => Array<Record<string, unknown>>;
    };
};
const { toComponentDefinitions } = webapp.__test__;

// Route ONE component config through toComponentDefinitions (the pass that builds
// `bind`/`visibleIf` from the mapped node fields) and return the compiled def.
function compile(config: Record<string, unknown>): Record<string, unknown> {
    return toComponentDefinitions([config])[0];
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const serializer = require("../../../resources/lib/webapp-serializer.js") as {
    renderComponentHtml: (component: unknown, layoutId: string, ctx: unknown) => string;
};

const ctx = { appId: "app1", location: "/" };

function divider(props: Record<string, unknown>): unknown {
    return { kind: "divider", id: "div", props };
}

describe("P231: ui-divider base-field color", () => {
    it("applies a bare CSS colour as the --color custom property", () => {
        const html = serializer.renderComponentHtml(divider({ color: "#ff0000" }), "vertical", ctx);
        expect(html).toMatch(/<sl-divider[^>]*style="[^"]*--color:#ff0000/);
    });

    it("maps a semantic token to the --wa-color-* var via --color", () => {
        const html = serializer.renderComponentHtml(divider({ color: "primary" }), "vertical", ctx);
        expect(html).toContain("--color:var(--wa-color-primary)");
    });

    it("passes an rgb() value through unchanged", () => {
        const html = serializer.renderComponentHtml(divider({ color: "rgb(0, 128, 0)" }), "vertical", ctx);
        expect(html).toContain("--color:rgb(0, 128, 0)");
    });

    it("emits NO style attribute when color is absent (markup unchanged)", () => {
        const html = serializer.renderComponentHtml(divider({}), "vertical", ctx);
        expect(html).toContain("<sl-divider");
        expect(html).not.toContain("style=");
    });

    it("ignores an unknown bare word (no broken inline style)", () => {
        const html = serializer.renderComponentHtml(divider({ color: "not-a-colour" }), "vertical", ctx);
        expect(html).not.toContain("style=");
    });

    it("keeps a label alongside the color style", () => {
        const html = serializer.renderComponentHtml(divider({ label: "Abschnitt A", color: "#00f" }), "vertical", ctx);
        expect(html).toMatch(/<sl-divider[^>]*style="[^"]*--color:#00f[^"]*"[^>]*>Abschnitt A<\/sl-divider>/);
    });
});

describe("P231: toComponentDefinitions — generic color/visible routing (not list-only)", () => {
    const mount = "route:/main/content";

    it("ui-divider color binding routes into bind.color (was list-only before P231)", () => {
        const def = compile({ type: "ui-divider", id: "dc", mount, color: { kind: "literal", value: "#ff0000" } });
        expect((def.bind as Record<string, unknown>).color).toEqual({ kind: "literal", value: "#ff0000" });
    });

    it("ui-divider visible binding routes into visibleIf (render-gate)", () => {
        const def = compile({ type: "ui-divider", id: "dv", mount, visible: { kind: "store", path: "visStore" } });
        expect(def.visibleIf).toEqual({ kind: "store", path: "visStore" });
    });

    it("ui-avatar color binding also routes into bind.color (generic, not list-only)", () => {
        const def = compile({ type: "ui-avatar", id: "av", mount, color: { kind: "store", path: "avatarColor" } });
        expect((def.bind as Record<string, unknown>).color).toEqual({ kind: "store", path: "avatarColor" });
    });

    // P238 (ADR 0039 §4): ui-icon no longer has a plain-string `color` field — it
    // uses the base bindable colour like every other node, and a store/state-bound
    // colour DOES now route into bind.color (see
    // p238-color-standard-control.test.ts). What is asserted here is the narrower,
    // still-true fact about THIS pass: toComponentDefinitions routes only binding
    // OBJECTS. A legacy plain string is migrated upstream by the ui-icon mapConfig;
    // if one reaches this pass unmigrated it stays in props (where the serializer
    // resolves it), rather than being silently treated as a binding.
    it("a plain-string color is NOT routed to bind.color (only binding objects are)", () => {
        const def = compile({ type: "ui-icon", id: "ic", mount, icon: "star", color: "#123456" });
        expect((def.bind as Record<string, unknown>).color).toBeUndefined();
        expect((def.props as Record<string, unknown>).color).toBe("#123456");
    });
});

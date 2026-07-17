import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

/**
 * P238 (ADR 0039) — the `color` standard control: tokens + any colour + binding.
 *
 * Unit-level lock for the two pieces the browser E2E cannot isolate:
 *   1. the token→CSS-var RESOLUTION in the shared serializer helper, and
 *   2. the plain-string→literal-binding MIGRATION that keeps a deployed
 *      pre-P238 ui-icon from losing its colour.
 *
 * The DERIVED mapping (do not re-guess it): resolveColorValue maps a semantic
 * colour token to `var(--wa-color-<token>)`. That is this project's own token
 * namespace — the `--wa-color-*` custom properties are defined on `:root` in
 * nodes/webapp.js and overridden by ui-app's `designTokens`, and are bridged to
 * Shoelace's `--sl-*` separately. It is NOT `--sl-color-primary-600` (the ADR/
 * roadmap prose used that only as an illustrative "e.g.").
 *
 * The browser side (computed style on a real <sl-icon>) is
 * tests/e2e/nodes/view/ui-icon.spec.ts.
 */

const require = createRequire(import.meta.url);

// eslint-disable-next-line @typescript-eslint/no-require-imports
const serializer = require("../../../resources/lib/webapp-serializer.js") as {
    renderComponentHtml: (component: unknown, layoutId: string, ctx: unknown) => string;
    resolveColorValue: (raw: unknown) => string | undefined;
};

const webapp = require("../../../nodes/webapp.js") as {
    __test__: {
        toComponentDefinitions: (components: unknown[]) => Array<Record<string, unknown>>;
        runtimeNodeRegistry: Record<string, { mapConfig: (config: Record<string, unknown>) => Record<string, unknown> }>;
    };
};
const { toComponentDefinitions, runtimeNodeRegistry } = webapp.__test__;

const ctx = { appId: "app1", location: "/" };
const mount = "route:/main/content";

function icon(props: Record<string, unknown>): unknown {
    return { kind: "icon", id: "ic", props };
}

function renderIcon(props: Record<string, unknown>): string {
    return serializer.renderComponentHtml(icon(props), "vertical", ctx);
}

describe("P238: resolveColorValue — the token:<name> form", () => {
    // The DERIVED mapping, asserted literally so a change to the token namespace
    // has to be made deliberately here as well as in the serializer.
    it.each([
        ["token:primary", "var(--wa-color-primary)"],
        ["token:success", "var(--wa-color-success)"],
        ["token:warning", "var(--wa-color-warning)"],
        ["token:danger", "var(--wa-color-danger)"],
        ["token:neutral", "var(--wa-color-neutral)"],
        // `info` is an accepted ALIAS of primary — there is no --wa-color-info token.
        ["token:info", "var(--wa-color-primary)"],
        // `muted` is the one token reachable ONLY through the token: path (see below).
        ["token:muted", "var(--wa-color-text-muted)"]
    ])("%s → %s", (raw, expected) => {
        expect(serializer.resolveColorValue(raw)).toBe(expected);
    });

    it("is case-insensitive on the token name", () => {
        expect(serializer.resolveColorValue("Token:Primary")).toBe("var(--wa-color-primary)");
    });

    it("tolerates surrounding whitespace", () => {
        expect(serializer.resolveColorValue("  token:danger  ")).toBe("var(--wa-color-danger)");
    });

    // The whole point of the prefix (ADR 0039 §1): a token must NEVER reach the DOM
    // raw — `color: primary` / `color: token:primary` are not valid CSS.
    it("an UNKNOWN token yields no value (never a raw/broken CSS colour)", () => {
        expect(serializer.resolveColorValue("token:bogus")).toBeUndefined();
        expect(serializer.resolveColorValue("token:")).toBeUndefined();
    });
});

describe("P238: resolveColorValue — no regression on the pre-existing forms", () => {
    // These lock the ~30 other base-colour nodes (ui-divider/ui-list/ui-progress/…):
    // P238 is ADDITIVE and must not change what any existing value renders.
    it("a bare semantic token still maps to its --wa-color-* var (pre-P238 form)", () => {
        expect(serializer.resolveColorValue("primary")).toBe("var(--wa-color-primary)");
        expect(serializer.resolveColorValue("danger")).toBe("var(--wa-color-danger)");
    });

    it("CSS values still pass through unchanged", () => {
        expect(serializer.resolveColorValue("#ff0000")).toBe("#ff0000");
        expect(serializer.resolveColorValue("rgb(255, 0, 0)")).toBe("rgb(255, 0, 0)");
        expect(serializer.resolveColorValue("hsl(0, 100%, 50%)")).toBe("hsl(0, 100%, 50%)");
        expect(serializer.resolveColorValue("red")).toBe("red");
        expect(serializer.resolveColorValue("var(--my-own-token)")).toBe("var(--my-own-token)");
    });

    it("empty / unknown still yield undefined", () => {
        expect(serializer.resolveColorValue("")).toBeUndefined();
        expect(serializer.resolveColorValue(undefined)).toBeUndefined();
        expect(serializer.resolveColorValue("not-a-colour")).toBeUndefined();
    });

    // Deliberate asymmetry, asserted so it cannot be "tidied" away by accident:
    // `muted` resolves ONLY via token:muted. Teaching the BARE-word map `muted`
    // would change what an existing `color: "muted"` renders on every base-colour
    // node (today: nothing) — that would not be additive.
    it("a BARE `muted` is still unknown (only token:muted resolves it)", () => {
        expect(serializer.resolveColorValue("muted")).toBeUndefined();
        expect(serializer.resolveColorValue("token:muted")).toBe("var(--wa-color-text-muted)");
    });
});

describe("P238: ui-icon renders its colour through the shared resolver", () => {
    it("a token renders as the design-token CSS custom property", () => {
        expect(renderIcon({ icon: "house", color: "token:primary" }))
            .toMatch(/<sl-icon[^>]*style="color:var\(--wa-color-primary\)"/);
    });

    it("a token is NEVER emitted raw (the ADR 0039 §1 invariant)", () => {
        const html = renderIcon({ icon: "house", color: "token:primary" });
        expect(html).not.toContain("color:token:primary");
        expect(html).not.toContain("color:primary\"");
    });

    it("a free colour passes through unchanged", () => {
        expect(renderIcon({ icon: "house", color: "#ff0000" }))
            .toMatch(/<sl-icon[^>]*style="color:#ff0000"/);
        // Pre-P238 behaviour, unchanged (locks tests/e2e/.../ui-icon.spec.ts P235).
        expect(renderIcon({ icon: "house", color: "rgb(0, 128, 0)" }))
            .toMatch(/<sl-icon[^>]*style="color:rgb\(0, 128, 0\)"/);
    });

    it("no colour → no style attribute (markup unchanged)", () => {
        const html = renderIcon({ icon: "house" });
        expect(html).toContain("<sl-icon");
        expect(html).not.toContain("style=");
    });

    it("an unknown bare word yields NO style (was: a broken inline style)", () => {
        // Pre-P238 renderIconHtml emitted `style="color:not-a-colour"` verbatim.
        // Routing through resolveColorValue makes ui-icon behave like every other
        // base-colour node: an unresolvable colour is simply not applied.
        expect(renderIcon({ icon: "house", color: "not-a-colour" })).not.toContain("style=");
    });
});

describe("P238: ui-icon back-compat — a deployed plain-string colour", () => {
    const mapConfig = runtimeNodeRegistry["ui-icon"].mapConfig;

    // The migration that lets a pre-P238 flow keep its colour WITHOUT being
    // re-opened: the schema override is gone, so a bare string would now fail
    // validation. mapConfig normalises it first.
    it("migrates a plain-string colour to the equivalent literal binding", () => {
        expect(mapConfig({ id: "ic", mount, icon: "house", color: "#ff0000" }).color)
            .toEqual({ kind: "literal", value: "#ff0000" });
        expect(mapConfig({ id: "ic", mount, icon: "house", color: "red" }).color)
            .toEqual({ kind: "literal", value: "red" });
    });

    it("passes a binding object through untouched", () => {
        expect(mapConfig({ id: "ic", mount, icon: "house", color: { kind: "store", path: "s1" } }).color)
            .toEqual({ kind: "store", path: "s1" });
        expect(mapConfig({ id: "ic", mount, icon: "house", color: { kind: "literal", value: "token:primary" } }).color)
            .toEqual({ kind: "literal", value: "token:primary" });
    });

    it("an absent/empty colour stays absent (no empty literal is invented)", () => {
        expect(mapConfig({ id: "ic", mount, icon: "house" }).color).toBeUndefined();
        expect(mapConfig({ id: "ic", mount, icon: "house", color: "" }).color).toBeUndefined();
        expect(mapConfig({ id: "ic", mount, icon: "house", color: "   " }).color).toBeUndefined();
    });

    // The migrated value must RENDER identically to what the plain string rendered
    // before — that is the actual "no flow loses its colour" promise.
    it("the migrated literal renders the same colour the plain string did", () => {
        const migrated = mapConfig({ id: "ic", mount, icon: "house", color: "#ff0000" }).color as { value: string };
        expect(renderIcon({ icon: "house", color: migrated.value }))
            .toMatch(/<sl-icon[^>]*style="color:#ff0000"/);
    });
});

describe("P238: ui-icon colour is BINDABLE (the ADR 0039 §4 behaviour change)", () => {
    // Pre-P238 this was impossible: `color` was a plain string, so getBinding never
    // matched and bind.color stayed empty — a state/store colour could not drive
    // the icon. (The pre-P238 lock asserting exactly that lived in
    // p231-divider-base-field-color.test.ts and is updated there.)
    it("a store-bound colour routes into bind.color", () => {
        const def = toComponentDefinitions([
            { type: "ui-icon", id: "ic", mount, icon: "house", color: { kind: "store", path: "colStore" } }
        ])[0];
        expect((def.bind as Record<string, unknown>).color).toEqual({ kind: "store", path: "colStore" });
    });

    it("a state-bound colour routes into bind.color", () => {
        const def = toComponentDefinitions([
            { type: "ui-icon", id: "ic", mount, icon: "house", color: { kind: "state", path: "iconColor" } }
        ])[0];
        expect((def.bind as Record<string, unknown>).color).toEqual({ kind: "state", path: "iconColor" });
    });

    // The renderer resolves every bind.* key into resolvedProps (renderer.ts), and
    // the serializer reads component.props.color — so a resolved token/colour lands
    // on the icon. This asserts the serializer half of that contract.
    it("a resolved bound value renders as the icon colour", () => {
        expect(renderIcon({ icon: "house", color: "token:danger" }))
            .toMatch(/<sl-icon[^>]*style="color:var\(--wa-color-danger\)"/);
    });
});

describe("P238: the other base-colour nodes are unaffected (additive)", () => {
    function render(kind: string, props: Record<string, unknown>): string {
        return serializer.renderComponentHtml({ kind, id: kind, props }, "vertical", ctx);
    }

    // ui-divider applies the colour as Shoelace's `--color` custom property, and
    // ui-list as a plain `color` — both via the same resolveColorValue. Their
    // existing values must render exactly as before, and they GAIN the token form.
    it("ui-divider: existing values unchanged, token form added", () => {
        expect(render("divider", { color: "#ff0000" })).toContain("--color:#ff0000");
        expect(render("divider", { color: "primary" })).toContain("--color:var(--wa-color-primary)");
        expect(render("divider", { color: "token:primary" })).toContain("--color:var(--wa-color-primary)");
        expect(render("divider", {})).not.toContain("style=");
    });

    it("ui-list: existing values unchanged, token form added", () => {
        expect(render("list", { items: ["a"], color: "#ff0000" })).toContain("color:#ff0000");
        expect(render("list", { items: ["a"], color: "token:success" })).toContain("color:var(--wa-color-success)");
    });
});

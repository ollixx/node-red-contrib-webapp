import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const webapp = require("../../../nodes/webapp.js") as {
    __test__: {
        runtimeNodeRegistry: Record<string, { mapConfig: (config: Record<string, unknown>) => unknown }>;
        renderComponentHtml: (component: unknown, layoutId: string, ctx: unknown) => string;
    };
};

const { runtimeNodeRegistry, renderComponentHtml } = webapp.__test__;

/**
 * P94 — ui-avatar Feld-Erweiterung.
 *
 * Deliverables:
 *   1. `src` → `image` as full typedInput binding (all kinds incl. store + asset).
 *   2. `initials` as full typedInput binding (all kinds); back-compat with plain strings.
 *   3. `variant` → `data-variant` attribute (Shoelace sl-avatar has no native variant).
 *   4. Docs updated (checked in cross-check).
 */

// ── mapConfig tests ────────────────────────────────────────────────────────

describe("P94: ui-avatar — mapConfig", () => {
    const reg = runtimeNodeRegistry["ui-avatar"];
    const base = { id: "av1", mount: "route:/main/content" };

    it("src literal binding is preserved by mapConfig", () => {
        const binding = { kind: "literal", value: "https://example.com/av.png" };
        const def = reg.mapConfig({ ...base, src: binding }) as Record<string, unknown>;
        expect(def.src).toEqual(binding);
    });

    it("src store binding is preserved by mapConfig", () => {
        const binding = { kind: "store", path: "storeId1" };
        const def = reg.mapConfig({ ...base, src: binding }) as Record<string, unknown>;
        expect(def.src).toEqual(binding);
    });

    it("legacy srcPath (plain state path, pre-P94) → migrated to state binding", () => {
        const def = reg.mapConfig({ ...base, srcPath: "user.avatarUrl" }) as Record<string, unknown>;
        expect(def.src).toEqual({ kind: "state", path: "user.avatarUrl" });
    });

    it("initials literal binding is preserved by mapConfig", () => {
        const binding = { kind: "literal", value: "JD" };
        const def = reg.mapConfig({ ...base, initials: binding }) as Record<string, unknown>;
        expect(def.initials).toEqual(binding);
    });

    it("initials store binding is preserved by mapConfig", () => {
        const binding = { kind: "store", path: "storeId2" };
        const def = reg.mapConfig({ ...base, initials: binding }) as Record<string, unknown>;
        expect(def.initials).toEqual(binding);
    });

    it("initials plain string (legacy pre-P94) → promoted to literal binding", () => {
        const def = reg.mapConfig({ ...base, initials: "JD" }) as Record<string, unknown>;
        expect(def.initials).toEqual({ kind: "literal", value: "JD" });
    });

    it("variant field is preserved by mapConfig", () => {
        const def = reg.mapConfig({ ...base, variant: "primary" }) as Record<string, unknown>;
        expect(def.variant).toBe("primary");
    });

    it("variant absent → undefined in mapConfig result", () => {
        const def = reg.mapConfig({ ...base }) as Record<string, unknown>;
        expect(def.variant).toBeUndefined();
    });
});

// ── serializer tests ────────────────────────────────────────────────────────

describe("P94: ui-avatar — serializer (variant + initials guard)", () => {
    function makeAvatar(overrides: Record<string, unknown> = {}): Record<string, unknown> {
        return {
            id: "avatar1",
            kind: "avatar",
            mount: "route:/main/content",
            order: undefined,
            bind: {},
            props: { ...overrides },
            value: undefined,
            events: []
        };
    }

    // variant → data-variant attribute (Shoelace has no native variant for sl-avatar)
    it("variant 'primary' → sl-avatar has data-variant='primary'", () => {
        const html = renderComponentHtml(makeAvatar({ variant: "primary" }), "main", {});
        expect(html).toContain("data-variant=\"primary\"");
    });

    it("variant 'danger' → sl-avatar has data-variant='danger'", () => {
        const html = renderComponentHtml(makeAvatar({ variant: "danger" }), "main", {});
        expect(html).toContain("data-variant=\"danger\"");
    });

    it("variant 'success' → sl-avatar has data-variant='success'", () => {
        const html = renderComponentHtml(makeAvatar({ variant: "success" }), "main", {});
        expect(html).toContain("data-variant=\"success\"");
    });

    it("no variant → no data-variant attribute on sl-avatar", () => {
        const html = renderComponentHtml(makeAvatar(), "main", {});
        expect(html).not.toContain("data-variant=");
    });

    it("variant does NOT emit a native 'variant=' attribute (Shoelace has none for sl-avatar)", () => {
        const html = renderComponentHtml(makeAvatar({ variant: "primary" }), "main", {});
        // data-variant should be present
        expect(html).toContain("data-variant=\"primary\"");
        // Guard: must not also emit a bare ' variant=' (the native Shoelace form that sl-avatar doesn't support).
        // Note: data-variant= is acceptable; we exclude that with a negative lookbehind for '-'.
        expect(html).not.toMatch(/(?<!data-|\w)variant=/);
    });

    // initials: plain string in props still renders correctly (back-compat path)
    it("initials plain string in props → sl-avatar has initials='JD'", () => {
        const html = renderComponentHtml(makeAvatar({ initials: "JD" }), "main", {});
        expect(html).toContain("initials=\"JD\"");
    });

    it("initials as binding object in props (unresolved) → NOT rendered as '[object Object]'", () => {
        // This simulates the case where the binding was not resolved by the renderer
        // (e.g. store not found). The guard must prevent "[object Object]" in HTML.
        const bindingObj = { kind: "store", path: "nonexistent" };
        const html = renderComponentHtml(makeAvatar({ initials: bindingObj }), "main", {});
        expect(html).not.toContain("[object Object]");
    });

    // Combined: size + shape + initials + variant
    it("size 'sm' + shape 'square' + initials 'MR' + variant 'success' all rendered", () => {
        const html = renderComponentHtml(
            makeAvatar({ size: "sm", shape: "square", initials: "MR", variant: "success" }),
            "main",
            {}
        );
        expect(html).toContain("data-size=\"sm\"");
        expect(html).toContain("shape=\"square\"");
        expect(html).toContain("initials=\"MR\"");
        expect(html).toContain("data-variant=\"success\"");
    });
});

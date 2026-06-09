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
 * P97 — ui-checkbox field extension.
 *
 * Deliverables:
 *   1. Fix `disabled` having no effect — editor now exposes disabledBinding typedInput.
 *   2. `value` / "Value Path" as full typedInput binding (all binding kinds).
 *   3. `label` as full typedInput binding (all binding kinds).
 *   4. `size` field added (xs/sm/md/lg/xl).
 *   5. Docs updated.
 */

// ── helpers ────────────────────────────────────────────────────────────────

const BASE = { id: "cb1", mount: "route:/main/content" };

function makeCheckbox(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id: "cbId",
        kind: "checkbox",
        mount: "route:/main/content",
        bind: {},
        props: { label: "Accept" },
        events: [],
        disabled: false,
        value: false,
        ...overrides
    };
}

const CTX = { sources: {} };

// ── mapConfig: label binding ───────────────────────────────────────────────

describe("P97: ui-checkbox mapConfig — label", () => {
    const reg = runtimeNodeRegistry["ui-checkbox"];

    it("label as literal binding is preserved by mapConfig", () => {
        const binding = { kind: "literal", value: "Accept terms" };
        const def = reg.mapConfig({ ...BASE, label: binding }) as Record<string, unknown>;
        expect(def.label).toEqual(binding);
    });

    it("label as state binding is preserved by mapConfig", () => {
        const binding = { kind: "state", path: "form.labelText" };
        const def = reg.mapConfig({ ...BASE, label: binding }) as Record<string, unknown>;
        expect(def.label).toEqual(binding);
    });

    it("label as store binding is preserved by mapConfig", () => {
        const binding = { kind: "store", path: "storeId1" };
        const def = reg.mapConfig({ ...BASE, label: binding }) as Record<string, unknown>;
        expect(def.label).toEqual(binding);
    });

    it("label as plain string (legacy) is preserved by mapConfig", () => {
        const def = reg.mapConfig({ ...BASE, label: "Accept" }) as Record<string, unknown>;
        expect(def.label).toBe("Accept");
    });
});

// ── mapConfig: value binding ───────────────────────────────────────────────

describe("P97: ui-checkbox mapConfig — value", () => {
    const reg = runtimeNodeRegistry["ui-checkbox"];

    it("value literal binding is preserved by mapConfig", () => {
        const binding = { kind: "literal", value: true };
        const def = reg.mapConfig({ ...BASE, value: binding }) as Record<string, unknown>;
        expect(def.value).toEqual(binding);
    });

    it("value state binding is preserved by mapConfig", () => {
        const binding = { kind: "state", path: "form.accepted" };
        const def = reg.mapConfig({ ...BASE, value: binding }) as Record<string, unknown>;
        expect(def.value).toEqual(binding);
    });

    it("value store binding is preserved by mapConfig", () => {
        const binding = { kind: "store", path: "storeId2" };
        const def = reg.mapConfig({ ...BASE, value: binding }) as Record<string, unknown>;
        expect(def.value).toEqual(binding);
    });

    it("legacy valuePath (plain state path, pre-P97) → migrated to state binding", () => {
        const def = reg.mapConfig({ ...BASE, valuePath: "form.accepted" }) as Record<string, unknown>;
        expect(def.value).toEqual({ kind: "state", path: "form.accepted" });
    });

    it("value query binding is preserved by mapConfig", () => {
        const binding = { kind: "query", path: "result.active" };
        const def = reg.mapConfig({ ...BASE, value: binding }) as Record<string, unknown>;
        expect(def.value).toEqual(binding);
    });

    it("value msg binding is preserved by mapConfig", () => {
        const binding = { kind: "msg", path: "payload" };
        const def = reg.mapConfig({ ...BASE, value: binding }) as Record<string, unknown>;
        expect(def.value).toEqual(binding);
    });
});

// ── mapConfig: disabled binding ────────────────────────────────────────────

describe("P97: ui-checkbox mapConfig — disabled", () => {
    const reg = runtimeNodeRegistry["ui-checkbox"];

    it("disabled literal true binding is preserved by mapConfig", () => {
        const binding = { kind: "literal", value: true };
        const def = reg.mapConfig({ ...BASE, disabled: binding }) as Record<string, unknown>;
        expect(def.disabled).toEqual(binding);
    });

    it("disabled state binding is preserved by mapConfig", () => {
        const binding = { kind: "state", path: "ui.isLocked" };
        const def = reg.mapConfig({ ...BASE, disabled: binding }) as Record<string, unknown>;
        expect(def.disabled).toEqual(binding);
    });

    it("disabled absent → undefined in mapConfig result", () => {
        const def = reg.mapConfig({ ...BASE }) as Record<string, unknown>;
        expect(def.disabled).toBeUndefined();
    });
});

// ── mapConfig: size field ──────────────────────────────────────────────────

describe("P97: ui-checkbox mapConfig — size", () => {
    const reg = runtimeNodeRegistry["ui-checkbox"];

    it("size 'sm' is preserved by mapConfig", () => {
        const def = reg.mapConfig({ ...BASE, size: "sm" }) as Record<string, unknown>;
        expect(def.size).toBe("sm");
    });

    it("size 'lg' is preserved by mapConfig", () => {
        const def = reg.mapConfig({ ...BASE, size: "lg" }) as Record<string, unknown>;
        expect(def.size).toBe("lg");
    });

    it("size absent → undefined in mapConfig result", () => {
        const def = reg.mapConfig({ ...BASE }) as Record<string, unknown>;
        expect(def.size).toBeUndefined();
    });

    it("size empty string → undefined in mapConfig result", () => {
        const def = reg.mapConfig({ ...BASE, size: "" }) as Record<string, unknown>;
        expect(def.size).toBeUndefined();
    });
});

// ── serializer: label rendering ────────────────────────────────────────────

describe("P97: ui-checkbox serializer — label", () => {
    it("renders plain label string inside sl-checkbox", () => {
        const html = renderComponentHtml(
            makeCheckbox({ props: { label: "Accept terms" } }),
            "rows",
            CTX
        );
        expect(html).toContain("<sl-checkbox");
        expect(html).toContain("Accept terms");
    });

    it("XSS guard: label is escaped in output", () => {
        const html = renderComponentHtml(
            makeCheckbox({ props: { label: '<script>alert("xss")</script>' } }),
            "rows",
            CTX
        );
        expect(html).not.toContain("<script>");
        expect(html).toContain("&lt;script&gt;");
    });

    it("label resolved from binding appears in rendered output", () => {
        // Simulate renderer having resolved label binding → string in props
        const html = renderComponentHtml(
            makeCheckbox({ props: { label: "Dynamisches Label" } }),
            "rows",
            CTX
        );
        expect(html).toContain("Dynamisches Label");
    });
});

// ── serializer: disabled attribute ────────────────────────────────────────

describe("P97: ui-checkbox serializer — disabled", () => {
    it("disabled:true → sl-checkbox[disabled] attribute present", () => {
        const html = renderComponentHtml(
            makeCheckbox({ disabled: true }),
            "rows",
            CTX
        );
        expect(html).toContain(" disabled");
    });

    it("disabled:false → no disabled attribute", () => {
        const html = renderComponentHtml(
            makeCheckbox({ disabled: false }),
            "rows",
            CTX
        );
        // Should not have bare ` disabled` but may have name= etc.
        expect(html).not.toMatch(/ disabled[^=]/);
        // Verify sl-checkbox still renders
        expect(html).toContain("<sl-checkbox");
    });
});

// ── serializer: size attribute ─────────────────────────────────────────────

describe("P97: ui-checkbox serializer — size", () => {
    it("size 'sm' → size attribute on sl-checkbox", () => {
        const html = renderComponentHtml(
            makeCheckbox({ props: { label: "X", size: "sm" } }),
            "rows",
            CTX
        );
        expect(html).toContain('size="small"');
    });

    it("size 'lg' → size attribute on sl-checkbox", () => {
        const html = renderComponentHtml(
            makeCheckbox({ props: { label: "X", size: "lg" } }),
            "rows",
            CTX
        );
        expect(html).toContain('size="large"');
    });

    it("size absent → no size attribute on sl-checkbox (default sizing)", () => {
        const html = renderComponentHtml(
            makeCheckbox({ props: { label: "X" } }),
            "rows",
            CTX
        );
        expect(html).not.toContain("size=");
    });
});

// ── serializer: checked state ──────────────────────────────────────────────

describe("P97: ui-checkbox serializer — checked state", () => {
    it("value:true → checked attribute on sl-checkbox", () => {
        const html = renderComponentHtml(
            makeCheckbox({ value: true }),
            "rows",
            CTX
        );
        expect(html).toContain(" checked");
    });

    it("value:false → no checked attribute", () => {
        const html = renderComponentHtml(
            makeCheckbox({ value: false }),
            "rows",
            CTX
        );
        expect(html).not.toContain(" checked");
    });
});

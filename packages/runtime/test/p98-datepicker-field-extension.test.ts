import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const webapp = require("../../../nodes/webapp.js") as {
    __test__: {
        runtimeNodeRegistry: Record<string, { mapConfig: (config: Record<string, unknown>) => unknown }>;
        renderComponentHtml: (component: unknown, layoutId: string, ctx: unknown) => string;
    };
};

const { runtimeNodeRegistry, renderComponentHtml } = webapp.__test__;

// Also test the serializer directly for the render-pipeline guard.
const _dir = path.dirname(fileURLToPath(import.meta.url));
const serializerPath = path.resolve(_dir, "../../../resources/lib/webapp-serializer.js");
const serializer = require(serializerPath) as {
    renderComponentHtml: (component: unknown, layoutId: string, ctx: unknown) => string;
};

/**
 * P98 — ui-datepicker render pipeline + field extension.
 *
 * Deliverables:
 *   1. Render pipeline verification — sl-input[type=date] is rendered (regression guard).
 *   2. `value` / "Value Path" as full typedInput binding (all binding kinds).
 *   3. `label` as full typedInput binding (all binding kinds).
 *   4. Docs updated.
 *
 * Tests are written fresh per .ai/agents/node-testing.md.
 * Each test asserts an observable OUTCOME and turns RED if the feature is removed.
 */

// ── helpers ────────────────────────────────────────────────────────────────

const BASE = { id: "dp1", mount: "route:/main/content" };

/** Build a minimal rendered-datepicker component (what the renderer passes to the serializer). */
function makeDatepicker(overrides: Record<string, unknown> = {}): unknown {
    return {
        kind: "datepicker",
        id: "dp1",
        mount: "route:/main/content",
        bind: {},
        props: { label: "Birthday" },
        events: [],
        disabled: false,
        value: "",
        ...overrides
    };
}

const CTX = { appId: "app1", location: "/" };

// ── 1. Render pipeline: sl-input[type=date] is produced ───────────────────

describe("P98: ui-datepicker render pipeline", () => {
    it("renders sl-input[type=date] with label — core regression guard", () => {
        const html = serializer.renderComponentHtml(makeDatepicker(), "rows", CTX);
        expect(html).toContain("<sl-input");
        expect(html).toContain('type="date"');
        expect(html).toContain('label="Birthday"');
    });

    it("mode=datetime → type=datetime-local", () => {
        const html = serializer.renderComponentHtml(
            makeDatepicker({ props: { label: "Datetime", mode: "datetime" } }),
            "rows",
            CTX
        );
        expect(html).toContain('type="datetime-local"');
    });

    it("mode=time → type=time", () => {
        const html = serializer.renderComponentHtml(
            makeDatepicker({ props: { label: "Time", mode: "time" } }),
            "rows",
            CTX
        );
        expect(html).toContain('type="time"');
    });

    it("value rendered as value attribute on sl-input", () => {
        const html = serializer.renderComponentHtml(
            makeDatepicker({ value: "2024-06-15" }),
            "rows",
            CTX
        );
        expect(html).toContain('value="2024-06-15"');
    });

    it("disabled:true → sl-input carries disabled attribute", () => {
        const html = serializer.renderComponentHtml(
            makeDatepicker({ disabled: true }),
            "rows",
            CTX
        );
        expect(html).toContain(" disabled");
    });

    it("disabled:false → no disabled attribute", () => {
        const html = serializer.renderComponentHtml(
            makeDatepicker({ disabled: false }),
            "rows",
            CTX
        );
        expect(html).not.toMatch(/ disabled[^=]/);
        expect(html).toContain("<sl-input");
    });

    it("label XSS guard: label is escaped in rendered output", () => {
        const html = serializer.renderComponentHtml(
            makeDatepicker({ props: { label: '<script>alert("xss")</script>' } }),
            "rows",
            CTX
        );
        expect(html).not.toContain("<script>");
        expect(html).toContain("&lt;script&gt;");
    });

    it("label resolved from binding appears in rendered output", () => {
        // Simulate renderer having resolved label binding → string in props
        const html = serializer.renderComponentHtml(
            makeDatepicker({ props: { label: "Dynamisches Label" } }),
            "rows",
            CTX
        );
        expect(html).toContain("Dynamisches Label");
    });
});

// ── 2. mapConfig: label binding ────────────────────────────────────────────

describe("P98: ui-datepicker mapConfig — label", () => {
    const reg = runtimeNodeRegistry["ui-datepicker"];

    it("label as literal binding is preserved by mapConfig", () => {
        const binding = { kind: "literal", value: "Birthday" };
        const def = reg.mapConfig({ ...BASE, label: binding, value: { kind: "literal", value: "" } }) as Record<string, unknown>;
        expect(def.label).toEqual(binding);
    });

    it("label as state binding is preserved by mapConfig", () => {
        const binding = { kind: "state", path: "form.labelText" };
        const def = reg.mapConfig({ ...BASE, label: binding, value: { kind: "literal", value: "" } }) as Record<string, unknown>;
        expect(def.label).toEqual(binding);
    });

    it("label as store binding is preserved by mapConfig", () => {
        const binding = { kind: "store", path: "storeId1" };
        const def = reg.mapConfig({ ...BASE, label: binding, value: { kind: "literal", value: "" } }) as Record<string, unknown>;
        expect(def.label).toEqual(binding);
    });

    it("label as plain string (legacy) is preserved by mapConfig", () => {
        const def = reg.mapConfig({ ...BASE, label: "Birthday", value: { kind: "literal", value: "" } }) as Record<string, unknown>;
        expect(def.label).toBe("Birthday");
    });

    it("label as msg binding is preserved by mapConfig", () => {
        const binding = { kind: "msg", path: "payload.label" };
        const def = reg.mapConfig({ ...BASE, label: binding, value: { kind: "literal", value: "" } }) as Record<string, unknown>;
        expect(def.label).toEqual(binding);
    });
});

// ── 3. mapConfig: value binding ────────────────────────────────────────────

describe("P98: ui-datepicker mapConfig — value", () => {
    const reg = runtimeNodeRegistry["ui-datepicker"];

    it("value literal binding is preserved by mapConfig", () => {
        const binding = { kind: "literal", value: "2024-06-15" };
        const def = reg.mapConfig({ ...BASE, label: "Date", value: binding }) as Record<string, unknown>;
        expect(def.value).toEqual(binding);
    });

    it("value state binding is preserved by mapConfig", () => {
        const binding = { kind: "state", path: "form.selectedDate" };
        const def = reg.mapConfig({ ...BASE, label: "Date", value: binding }) as Record<string, unknown>;
        expect(def.value).toEqual(binding);
    });

    it("value store binding is preserved by mapConfig", () => {
        const binding = { kind: "store", path: "storeId2" };
        const def = reg.mapConfig({ ...BASE, label: "Date", value: binding }) as Record<string, unknown>;
        expect(def.value).toEqual(binding);
    });

    it("value query binding is preserved by mapConfig", () => {
        const binding = { kind: "query", path: "result.date" };
        const def = reg.mapConfig({ ...BASE, label: "Date", value: binding }) as Record<string, unknown>;
        expect(def.value).toEqual(binding);
    });

    it("value msg binding is preserved by mapConfig", () => {
        const binding = { kind: "msg", path: "payload" };
        const def = reg.mapConfig({ ...BASE, label: "Date", value: binding }) as Record<string, unknown>;
        expect(def.value).toEqual(binding);
    });

    it("legacy valuePath (plain state path, pre-P98) → migrated to state binding", () => {
        const def = reg.mapConfig({ ...BASE, label: "Date", valuePath: "form.selectedDate" }) as Record<string, unknown>;
        expect(def.value).toEqual({ kind: "state", path: "form.selectedDate" });
    });
});

// ── 4. mapConfig: disabled binding ────────────────────────────────────────

describe("P98: ui-datepicker mapConfig — disabled", () => {
    const reg = runtimeNodeRegistry["ui-datepicker"];

    it("disabled literal true binding is preserved by mapConfig", () => {
        const binding = { kind: "literal", value: true };
        const def = reg.mapConfig({ ...BASE, label: "Date", value: { kind: "literal", value: "" }, disabled: binding }) as Record<string, unknown>;
        expect(def.disabled).toEqual(binding);
    });

    it("disabled state binding is preserved by mapConfig", () => {
        const binding = { kind: "state", path: "ui.isLocked" };
        const def = reg.mapConfig({ ...BASE, label: "Date", value: { kind: "literal", value: "" }, disabled: binding }) as Record<string, unknown>;
        expect(def.disabled).toEqual(binding);
    });

    it("disabled absent → undefined in mapConfig result", () => {
        const def = reg.mapConfig({ ...BASE, label: "Date", value: { kind: "literal", value: "" } }) as Record<string, unknown>;
        expect(def.disabled).toBeUndefined();
    });
});

// ── 5. mapConfig: mode field ───────────────────────────────────────────────

describe("P98: ui-datepicker mapConfig — mode", () => {
    const reg = runtimeNodeRegistry["ui-datepicker"];

    it("mode 'date' is preserved by mapConfig", () => {
        const def = reg.mapConfig({ ...BASE, label: "Date", value: { kind: "literal", value: "" }, mode: "date" }) as Record<string, unknown>;
        expect(def.mode).toBe("date");
    });

    it("mode 'datetime' is preserved by mapConfig", () => {
        const def = reg.mapConfig({ ...BASE, label: "Date", value: { kind: "literal", value: "" }, mode: "datetime" }) as Record<string, unknown>;
        expect(def.mode).toBe("datetime");
    });

    it("mode 'time' is preserved by mapConfig", () => {
        const def = reg.mapConfig({ ...BASE, label: "Date", value: { kind: "literal", value: "" }, mode: "time" }) as Record<string, unknown>;
        expect(def.mode).toBe("time");
    });

    it("mode absent → undefined in mapConfig result", () => {
        const def = reg.mapConfig({ ...BASE, label: "Date", value: { kind: "literal", value: "" } }) as Record<string, unknown>;
        expect(def.mode).toBeUndefined();
    });
});

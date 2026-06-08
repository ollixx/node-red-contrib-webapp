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
 * P90 — ui-alert icon field.
 *
 * Decision: Option 1 — icon selection by severity + explicit override.
 *
 * icon="auto" (default) → severity-appropriate Bootstrap icon in the Shoelace
 *   `icon` slot:  primary/info → info-circle, success → check-circle,
 *                 warning → exclamation-triangle, danger → x-circle,
 *                 neutral → circle.
 * icon="none"         → no icon slot; the sl-alert renders without an icon.
 * icon="<name>"       → renders the named icon (any Shoelace-registered icon).
 *
 * The icon field is also bindable (iconFieldSchema) — a dynamic binding routes
 * through bind.icon and is resolved by the renderer to a resolvedProps.icon
 * value at runtime.
 */

describe("P90: ui-alert icon — mapConfig", () => {
    const reg = runtimeNodeRegistry["ui-alert"];

    it("icon field absent → mapConfig result has no icon property", () => {
        const def = reg.mapConfig({
            id: "a1",
            mount: "route:/main/content",
            message: { kind: "literal", value: "Info" }
        }) as Record<string, unknown>;
        expect(def).not.toHaveProperty("icon");
    });

    it("icon='auto' → preserved in mapConfig result", () => {
        const def = reg.mapConfig({
            id: "a2",
            mount: "route:/main/content",
            message: { kind: "literal", value: "Info" },
            icon: "auto"
        }) as Record<string, unknown>;
        expect(def.icon).toBe("auto");
    });

    it("icon='none' → preserved in mapConfig result", () => {
        const def = reg.mapConfig({
            id: "a3",
            mount: "route:/main/content",
            message: { kind: "literal", value: "Info" },
            icon: "none"
        }) as Record<string, unknown>;
        expect(def.icon).toBe("none");
    });

    it("explicit icon name → preserved in mapConfig result", () => {
        const def = reg.mapConfig({
            id: "a4",
            mount: "route:/main/content",
            message: { kind: "literal", value: "Info" },
            icon: "bell"
        }) as Record<string, unknown>;
        expect(def.icon).toBe("bell");
    });

    it("icon binding → preserved in mapConfig result", () => {
        const def = reg.mapConfig({
            id: "a5",
            mount: "route:/main/content",
            message: { kind: "literal", value: "Info" },
            icon: { kind: "state", path: "alerts.icon" }
        }) as Record<string, unknown>;
        expect(def.icon).toEqual({ kind: "state", path: "alerts.icon" });
    });
});

describe("P90: ui-alert icon — serializer", () => {
    function makeAlert(overrides: Record<string, unknown> = {}): Record<string, unknown> {
        return {
            id: "alertA",
            kind: "alert",
            mount: "route:/main/content",
            order: undefined,
            bind: {},
            props: {
                severity: "info",
                dismissible: false,
                ...overrides
            },
            value: "Test message",
            events: []
        };
    }

    it("icon='auto' + severity='info' → sl-icon name='info-circle' in slot='icon'", () => {
        const html = renderComponentHtml(
            makeAlert({ icon: "auto", severity: "info" }), "main", {}
        );
        expect(html).toContain("slot=\"icon\"");
        expect(html).toContain("name=\"info-circle\"");
    });

    it("icon='auto' + severity='success' → sl-icon name='check-circle'", () => {
        const html = renderComponentHtml(
            makeAlert({ icon: "auto", severity: "success" }), "main", {}
        );
        expect(html).toContain("name=\"check-circle\"");
    });

    it("icon='auto' + severity='warning' → sl-icon name='exclamation-triangle'", () => {
        const html = renderComponentHtml(
            makeAlert({ icon: "auto", severity: "warning" }), "main", {}
        );
        expect(html).toContain("name=\"exclamation-triangle\"");
    });

    it("icon='auto' + severity='danger' → sl-icon name='x-circle'", () => {
        const html = renderComponentHtml(
            makeAlert({ icon: "auto", severity: "danger" }), "main", {}
        );
        expect(html).toContain("name=\"x-circle\"");
    });

    it("icon='auto' + severity='neutral' → sl-icon name='circle'", () => {
        const html = renderComponentHtml(
            makeAlert({ icon: "auto", severity: "neutral" }), "main", {}
        );
        expect(html).toContain("name=\"circle\"");
    });

    it("icon='auto' + severity='primary' → sl-icon name='info-circle'", () => {
        const html = renderComponentHtml(
            makeAlert({ icon: "auto", severity: "primary" }), "main", {}
        );
        expect(html).toContain("name=\"info-circle\"");
    });

    it("icon='none' → no sl-icon element in the output", () => {
        const html = renderComponentHtml(
            makeAlert({ icon: "none", severity: "info" }), "main", {}
        );
        expect(html).not.toContain("<sl-icon");
    });

    it("icon absent → no sl-icon element (default: no icon)", () => {
        const html = renderComponentHtml(
            makeAlert({ severity: "info" }), "main", {}
        );
        expect(html).not.toContain("<sl-icon");
    });

    it("explicit icon name 'bell' → sl-icon name='bell' in slot='icon'", () => {
        const html = renderComponentHtml(
            makeAlert({ icon: "bell", severity: "info" }), "main", {}
        );
        expect(html).toContain("slot=\"icon\"");
        expect(html).toContain("name=\"bell\"");
    });

    it("icon={library:'default',name:'star'} → sl-icon name='star' in slot='icon'", () => {
        const html = renderComponentHtml(
            makeAlert({ icon: { library: "default", name: "star" }, severity: "info" }), "main", {}
        );
        expect(html).toContain("slot=\"icon\"");
        expect(html).toContain("name=\"star\"");
    });

    it("sl-alert output contains the message text", () => {
        const html = renderComponentHtml(
            makeAlert({ icon: "auto", severity: "info" }), "main", {}
        );
        expect(html).toContain("Test message");
        expect(html).toContain("<sl-alert");
    });
});

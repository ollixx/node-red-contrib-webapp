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
 * P91 — ui-alert duration + countdown fields.
 *
 * duration (positive integer, in ms): when set the sl-alert auto-hides after
 *   that many milliseconds. Shoelace natively supports this via the `duration`
 *   attribute on <sl-alert>. Must be a positive integer (>= 1); 0 or absent =
 *   no auto-hide.
 *
 * countdown (boolean): when true and duration is set, Shoelace renders a
 *   progress bar indicating remaining time ("ltr" countdown mode). For backends
 *   without native countdown support a JS Function-Fallback is included.
 *
 * The fields are backend-neutral:
 *  - Shoelace: `duration` and `countdown="ltr"` attributes on <sl-alert>.
 *  - Other backends: duration auto-hide via JS timeout (Function-Fallback);
 *    countdown progress bar via inline JS animation (Bootstrap example pattern).
 */

// ── mapConfig tests ────────────────────────────────────────────────────────

describe("P91: ui-alert duration/countdown — mapConfig", () => {
    const reg = runtimeNodeRegistry["ui-alert"];

    it("duration absent → mapConfig result has no duration property", () => {
        const def = reg.mapConfig({
            id: "a1",
            mount: "route:/main/content",
            message: { kind: "literal", value: "Info" }
        }) as Record<string, unknown>;
        expect(def).not.toHaveProperty("duration");
    });

    it("countdown absent → mapConfig result has no countdown property", () => {
        const def = reg.mapConfig({
            id: "a1",
            mount: "route:/main/content",
            message: { kind: "literal", value: "Info" }
        }) as Record<string, unknown>;
        expect(def).not.toHaveProperty("countdown");
    });

    it("duration=5000 → preserved in mapConfig result as number", () => {
        const def = reg.mapConfig({
            id: "a2",
            mount: "route:/main/content",
            message: { kind: "literal", value: "Info" },
            duration: 5000
        }) as Record<string, unknown>;
        expect(def.duration).toBe(5000);
    });

    it("duration='3000' (string from editor) → coerced to number 3000", () => {
        const def = reg.mapConfig({
            id: "a3",
            mount: "route:/main/content",
            message: { kind: "literal", value: "Info" },
            duration: "3000"
        }) as Record<string, unknown>;
        expect(def.duration).toBe(3000);
    });

    it("countdown=true → preserved in mapConfig result", () => {
        const def = reg.mapConfig({
            id: "a4",
            mount: "route:/main/content",
            message: { kind: "literal", value: "Info" },
            duration: 5000,
            countdown: true
        }) as Record<string, unknown>;
        expect(def.countdown).toBe(true);
    });

    it("countdown='true' (string from editor checkbox) → coerced to boolean true", () => {
        const def = reg.mapConfig({
            id: "a5",
            mount: "route:/main/content",
            message: { kind: "literal", value: "Info" },
            duration: 5000,
            countdown: "true"
        }) as Record<string, unknown>;
        expect(def.countdown).toBe(true);
    });

    it("countdown=false → not included (or false) in mapConfig result", () => {
        const def = reg.mapConfig({
            id: "a6",
            mount: "route:/main/content",
            message: { kind: "literal", value: "Info" },
            duration: 5000,
            countdown: false
        }) as Record<string, unknown>;
        // countdown: false → not serialized (falsy optional → omitted, like dismissible)
        expect(def.countdown).toBeFalsy();
    });
});

// ── serializer tests ────────────────────────────────────────────────────────

describe("P91: ui-alert duration/countdown — serializer", () => {
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

    // duration attribute on sl-alert
    it("duration=5000 → sl-alert has duration='5000' attribute", () => {
        const html = renderComponentHtml(
            makeAlert({ duration: 5000 }), "main", {}
        );
        expect(html).toContain("duration=\"5000\"");
    });

    it("duration=3000 → sl-alert has duration='3000' attribute", () => {
        const html = renderComponentHtml(
            makeAlert({ duration: 3000 }), "main", {}
        );
        expect(html).toContain("duration=\"3000\"");
    });

    it("duration absent → sl-alert has NO duration attribute", () => {
        const html = renderComponentHtml(
            makeAlert(), "main", {}
        );
        expect(html).not.toContain("duration=");
    });

    // countdown handling — P100 regression fix:
    // The serializer emits data-webapp-countdown="ltr" (not countdown="ltr") to avoid
    // a Shoelace timing bug where @watch("countdown") fires before the shadow DOM is
    // ready, crashing animate() on a null countdownElement. webapp-client.js sets
    // el.countdown = "ltr" after the element upgrades.
    it("countdown=true + duration → sl-alert has data-webapp-countdown='ltr' data attribute", () => {
        const html = renderComponentHtml(
            makeAlert({ duration: 5000, countdown: true }), "main", {}
        );
        expect(html).toContain("data-webapp-countdown=\"ltr\"");
        // Must NOT emit the raw Shoelace attribute (would crash upgrade)
        expect(html).not.toContain(" countdown=\"ltr\"");
    });

    it("countdown=true without duration → data-webapp-countdown still emitted", () => {
        // countdown without duration is an edge case but should not crash;
        // we emit the data attribute — webapp-client.js will set it after upgrade.
        const html = renderComponentHtml(
            makeAlert({ countdown: true }), "main", {}
        );
        expect(html).toContain("data-webapp-countdown=\"ltr\"");
    });

    it("countdown absent → sl-alert has NO countdown-related attribute", () => {
        const html = renderComponentHtml(
            makeAlert({ duration: 5000 }), "main", {}
        );
        expect(html).not.toContain("countdown=");
        expect(html).not.toContain("data-webapp-countdown=");
    });

    it("countdown=false → sl-alert has NO countdown-related attribute", () => {
        const html = renderComponentHtml(
            makeAlert({ duration: 5000, countdown: false }), "main", {}
        );
        expect(html).not.toContain("countdown=");
        expect(html).not.toContain("data-webapp-countdown=");
    });

    // sl-alert is still well-formed
    it("duration+countdown → sl-alert is still present and open", () => {
        const html = renderComponentHtml(
            makeAlert({ duration: 2000, countdown: true }), "main", {}
        );
        expect(html).toContain("<sl-alert");
        expect(html).toContain(" open");
        expect(html).toContain("Test message");
    });
});

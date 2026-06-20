import { describe, expect, it } from "vitest";

import {
    ALERT_VARIANTS,
    BADGE_VARIANTS,
    BUTTON_VARIANTS
} from "@node-red-contrib-webapp/schema";

/**
 * P49 — the shared serializer routes every node's variant vocabulary through
 * ONE mapping layer. Every vocabulary value maps to a valid Shoelace variant
 * token, and an unknown value degrades gracefully to a sensible default
 * (never a crash, never a raw unmapped token passed through).
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const serializer = require("../../../resources/lib/webapp-serializer.js") as {
    mapVariant: (kind: string, variant: string | undefined) => string;
    renderComponentHtml: (component: unknown, layoutId: string, ctx: unknown) => string;
};

// Shoelace's documented variant tokens for sl-button / sl-alert / sl-badge.
const VALID_SHOELACE_VARIANTS = new Set([
    "default",
    "primary",
    "success",
    "neutral",
    "warning",
    "danger",
    "text"
]);

describe("P49: serializer variant mapping", () => {
    it("maps every button variant to a valid Shoelace variant", () => {
        for (const v of BUTTON_VARIANTS) {
            const mapped = serializer.mapVariant("button", v);
            expect(VALID_SHOELACE_VARIANTS.has(mapped), `button variant ${v} → ${mapped}`).toBe(true);
        }
    });

    it("maps every badge/alert severity to a valid Shoelace variant", () => {
        for (const v of [...BADGE_VARIANTS, ...ALERT_VARIANTS]) {
            const badge = serializer.mapVariant("badge", v);
            const alert = serializer.mapVariant("alert", v);
            expect(VALID_SHOELACE_VARIANTS.has(badge), `badge ${v} → ${badge}`).toBe(true);
            expect(VALID_SHOELACE_VARIANTS.has(alert), `alert ${v} → ${alert}`).toBe(true);
        }
    });

    it("info maps onto the primary look for badge and alert (documented alias)", () => {
        expect(serializer.mapVariant("badge", "info")).toBe("primary");
        expect(serializer.mapVariant("alert", "info")).toBe("primary");
    });

    it("degrades an unknown variant to a sensible default — never a raw pass-through", () => {
        const mapped = serializer.mapVariant("button", "totally-made-up");
        expect(VALID_SHOELACE_VARIANTS.has(mapped)).toBe(true);
        expect(mapped).not.toBe("totally-made-up");
    });

    it("an absent variant falls back to the kind default", () => {
        expect(VALID_SHOELACE_VARIANTS.has(serializer.mapVariant("button", undefined))).toBe(true);
        expect(VALID_SHOELACE_VARIANTS.has(serializer.mapVariant("badge", undefined))).toBe(true);
    });
});

describe("P49: non-button variants render the mapped Shoelace output", () => {
    it("a ui-text style 'heading-2' renders an <h2> with the role class", () => {
        const html = serializer.renderComponentHtml(
            // P111: typographic role lives in props.style now (variant = colour).
            { kind: "text", id: "t1", text: "Title", props: { style: "heading-2" } },
            "vertical",
            { appId: "app1", location: "/" }
        );
        // style maps onto a semantic element + a webapp-text--<role> class.
        expect(html).toContain("<h2");
        expect(html).toContain("webapp-text--heading-2");
    });

    it("a ui-text colour variant 'danger' adds the colour class", () => {
        const html = serializer.renderComponentHtml(
            { kind: "text", id: "t2", text: "Oops", props: { style: "body", variant: "danger" } },
            "vertical",
            { appId: "app1", location: "/" }
        );
        expect(html).toContain("<p");
        expect(html).toContain("webapp-text--color-danger");
    });

    it("a ui-container variant 'card' renders an sl-card element (P198)", () => {
        const cardHtml = serializer.renderComponentHtml(
            { kind: "container", id: "c1", layoutId: "vertical", regions: [], props: { variant: "card" } },
            "vertical",
            { appId: "app1", location: "/" }
        );
        // P198: card → <sl-card> element; no bogus variant="..." attribute (sl-card ignores it).
        expect(cardHtml).toContain("<sl-card");
        expect(cardHtml).toContain("webapp-container--card");
    });

    it("panel variant renders a plain <div>, not sl-card (P198)", () => {
        const panelHtml = serializer.renderComponentHtml(
            { kind: "container", id: "c2", layoutId: "vertical", regions: [], props: { variant: "panel" } },
            "vertical",
            { appId: "app1", location: "/" }
        );
        expect(panelHtml).not.toContain("<sl-card");
        expect(panelHtml).toContain("<div");
        expect(panelHtml).toContain("webapp-container--panel");
    });

    it("section variant renders a plain <div>, not sl-card (P198)", () => {
        const sectionHtml = serializer.renderComponentHtml(
            { kind: "container", id: "c3", layoutId: "vertical", regions: [], props: { variant: "section" } },
            "vertical",
            { appId: "app1", location: "/" }
        );
        expect(sectionHtml).not.toContain("<sl-card");
        expect(sectionHtml).toContain("<div");
        expect(sectionHtml).toContain("webapp-container--section");
    });

    it("transparent variant renders a plain <div>, not sl-card (P198)", () => {
        const transparentHtml = serializer.renderComponentHtml(
            { kind: "container", id: "c4", layoutId: "vertical", regions: [], props: { variant: "transparent" } },
            "vertical",
            { appId: "app1", location: "/" }
        );
        expect(transparentHtml).not.toContain("<sl-card");
        expect(transparentHtml).toContain("<div");
        expect(transparentHtml).toContain("webapp-container--transparent");
    });

    it("default (no variant) renders as sl-card (card is default) (P198)", () => {
        const defaultHtml = serializer.renderComponentHtml(
            { kind: "container", id: "c5", layoutId: "vertical", regions: [], props: {} },
            "vertical",
            { appId: "app1", location: "/" }
        );
        expect(defaultHtml).toContain("<sl-card");
        expect(defaultHtml).toContain("webapp-container--card");
    });

    it("span variant renders a <span> element, not sl-card or div container (P199)", () => {
        const spanHtml = serializer.renderComponentHtml(
            { kind: "container", id: "c6", layoutId: "vertical", regions: [], props: { variant: "span" } },
            "vertical",
            { appId: "app1", location: "/" }
        );
        // P199: span → <span class="webapp-container webapp-container--span">
        // The outer webapp-item div is always present; the CONTAINER element itself must be a <span>.
        expect(spanHtml).not.toContain("<sl-card");
        expect(spanHtml).toContain("<span");
        expect(spanHtml).toContain("webapp-container--span");
        // The container class must appear on a span, not a div
        expect(spanHtml).toContain('<span class="webapp-container webapp-container--span"');
        expect(spanHtml).not.toContain('<div class="webapp-container');
    });
});

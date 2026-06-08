import { describe, expect, it } from "vitest";

import {
    buildShoelaceTokenBridgeCss,
    mapButtonVariant,
    mapComponentToShoelace,
    mapSize
} from "../src";

describe("P23 Shoelace adapter", () => {
    it("maps kind=button to the Shoelace button element with semantic variant/size attributes", () => {
        const descriptor = mapComponentToShoelace("button", { variant: "danger", size: "lg" });

        expect(descriptor.tag).toBe("sl-button");
        expect(descriptor.fallback).toBe(false);
        expect(descriptor.attributes.variant).toBe("danger");
        expect(descriptor.attributes.size).toBe("large");
    });

    it("maps the full semantic button variant vocabulary onto Shoelace variants", () => {
        expect(mapButtonVariant("primary")).toBe("primary");
        expect(mapButtonVariant("secondary")).toBe("neutral");
        expect(mapButtonVariant("danger")).toBe("danger");
        expect(mapButtonVariant("ghost")).toBe("default");
        expect(mapButtonVariant("link")).toBe("text");
        expect(mapButtonVariant(undefined)).toBe("default");
    });

    it("collapses the five semantic sizes onto the three Shoelace sizes", () => {
        expect(mapSize("xs")).toBe("small");
        expect(mapSize("sm")).toBe("small");
        expect(mapSize("md")).toBe("medium");
        expect(mapSize("lg")).toBe("large");
        expect(mapSize("xl")).toBe("large");
        expect(mapSize(undefined)).toBeUndefined();
    });

    it("P71: emits the outline attribute on a button when outline is true", () => {
        const descriptor = mapComponentToShoelace("button", { outline: true });
        expect(descriptor.attributes.outline).toBe("");
    });

    it("P71: omits the outline attribute when outline is falsey", () => {
        expect(mapComponentToShoelace("button", { outline: false }).attributes.outline).toBeUndefined();
        expect(mapComponentToShoelace("button", {}).attributes.outline).toBeUndefined();
    });

    it("P71: outline is button-specific (not applied to other kinds)", () => {
        expect(mapComponentToShoelace("input", { outline: true }).attributes.outline).toBeUndefined();
    });

    it("produces a defined fallback rendering for a kind without a 1:1 Shoelace element (stepper)", () => {
        const descriptor = mapComponentToShoelace("stepper", {});

        expect(descriptor.fallback).toBe(true);
        // Not an empty node: a real tag plus markers identifying the unmapped kind.
        expect(descriptor.tag).toBe("div");
        expect(descriptor.attributes["data-wa-kind"]).toBe("stepper");
        expect(descriptor.attributes["data-wa-fallback"]).toBe("true");
    });

    it("aliases Shoelace custom properties to the --wa-* design tokens with literal fallbacks", () => {
        const css = buildShoelaceTokenBridgeCss();

        // colorPrimary token reaches Shoelace's primary color property; when the
        // --wa-* token is unset the fallback is the *literal* Shoelace default
        // (the palette ref), never the property itself.
        expect(css).toContain("--sl-color-primary-600: var(--wa-color-primary, var(--sl-color-sky-600));");
        // The bridge is a :root block consumed natively by the components.
        expect(css.startsWith(":root {")).toBe(true);
    });

    it("P62 regression: no bridged token falls back to its own --sl-* property (no self-reference cycle)", () => {
        const css = buildShoelaceTokenBridgeCss();

        // Each declaration looks like:  --sl-X: var(--wa-Y, <literal default>);
        // A self-reference (`var(--wa-Y, var(--sl-X))`) creates a CSS dependency
        // cycle that makes --sl-X guaranteed-invalid when --wa-Y is unset — which
        // collapsed sl-button's label padding to 0. Assert it never recurs.
        const declRe = /^\s*(--sl-[\w-]+):\s*(.+);\s*$/;

        for (const line of css.split("\n")) {
            const match = declRe.exec(line);

            if (!match) {
                continue;
            }

            const [, slVar, value] = match;

            expect(
                value.includes(`var(${slVar})`),
                `bridge declaration for ${slVar} must not reference itself in its fallback: "${value}"`
            ).toBe(false);
        }
    });

    it("P62 regression: --sl-spacing-medium is no longer bridged (Shoelace keeps its own spacing scale)", () => {
        const css = buildShoelaceTokenBridgeCss();

        expect(css).not.toContain("--sl-spacing-medium");
        // The semantically-wrong source token must not appear either.
        expect(css).not.toContain("--wa-spacing-unit");
    });

    it("keeps the adapter's accepted variant vocabulary semantic — no framework token as input (audit guard)", () => {
        // The semantic side (what the schema/props emit, the adapter's *input*)
        // must be the documented P49 BUTTON_VARIANTS vocabulary. `neutral` and
        // `text` are deliberately part of that semantic vocabulary (owner
        // decision: generous, portable set) even though they coincide with
        // Shoelace output tokens — that overlap is fine. Genuinely
        // framework-specific tokens (contained/outlined) must NEVER be accepted.
        const semanticVariants = ["primary", "secondary", "success", "danger", "warning", "neutral", "ghost", "link"];
        const frameworkOnlyTokens = ["contained", "outlined"];

        // Every documented semantic variant resolves to a Shoelace variant…
        for (const variant of semanticVariants) {
            expect(mapButtonVariant(variant)).not.toBe("");
        }

        // …and no framework-specific token is accepted as a semantic input
        // (passing one does not silently pass through — it falls back).
        for (const token of frameworkOnlyTokens) {
            expect(mapButtonVariant(token)).toBe("default");
        }
    });
});

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

    it("produces a defined fallback rendering for a kind without a 1:1 Shoelace element (stepper)", () => {
        const descriptor = mapComponentToShoelace("stepper", {});

        expect(descriptor.fallback).toBe(true);
        // Not an empty node: a real tag plus markers identifying the unmapped kind.
        expect(descriptor.tag).toBe("div");
        expect(descriptor.attributes["data-wa-kind"]).toBe("stepper");
        expect(descriptor.attributes["data-wa-fallback"]).toBe("true");
    });

    it("aliases Shoelace custom properties to the --wa-* design tokens with safe fallbacks", () => {
        const css = buildShoelaceTokenBridgeCss();

        // colorPrimary token reaches Shoelace's primary color property.
        expect(css).toContain("--sl-color-primary-600: var(--wa-color-primary, var(--sl-color-primary-600));");
        // The bridge is a :root block consumed natively by the components.
        expect(css.startsWith(":root {")).toBe(true);
    });

    it("keeps the adapter's accepted variant vocabulary semantic — no framework token as input (audit guard)", () => {
        // The semantic side (what the schema/props emit, the adapter's *input*)
        // must be the documented semantic vocabulary, never a Shoelace token.
        // Framework values (neutral/text/contained/outlined) appear only on the
        // *output* side of the mapping, produced inside the adapter.
        const semanticVariants = ["primary", "secondary", "danger", "ghost", "link"];
        const shoelaceOnlyTokens = ["neutral", "text", "contained", "outlined"];

        // Every documented semantic variant resolves to a Shoelace variant…
        for (const variant of semanticVariants) {
            expect(mapButtonVariant(variant)).not.toBe("");
        }

        // …and no Shoelace-only output token is itself accepted as a semantic
        // input (i.e. passing a framework token does not silently pass through).
        for (const token of shoelaceOnlyTokens) {
            // Unknown semantic input falls back to "default", proving the schema
            // side never carries framework tokens as valid variants.
            expect(mapButtonVariant(token)).toBe("default");
        }
    });
});

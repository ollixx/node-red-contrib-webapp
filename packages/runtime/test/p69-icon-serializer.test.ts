import { describe, expect, it } from "vitest";

/**
 * P69 — the shared serializer renders backend-neutral { library, name } icon
 * values as <sl-icon>. A bare-string icon name maps to the default library
 * (rendered without a library attribute → Shoelace's system/default set). An
 * explicit library surfaces as the `library` attribute. The same icon machinery
 * powers ui-icon (kind "icon"), ui-button's prefix slot, and ui-avatar's
 * icon fallback.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const serializer = require("../../../resources/lib/webapp-serializer.js") as {
    renderComponentHtml: (component: unknown, layoutId: string, ctx: unknown) => string;
    renderIconHtml: (icon: unknown, opts?: unknown) => string;
};

const ctx = { appId: "app1", location: "/" };

describe("P69: renderIconHtml", () => {
    it("renders a bare-string icon as <sl-icon name> with no library attr (default lib)", () => {
        const html = serializer.renderIconHtml("home");
        expect(html).toContain("<sl-icon");
        expect(html).toContain("name=\"home\"");
        expect(html).not.toContain("library=");
    });

    it("renders an explicit library as the library attribute", () => {
        const html = serializer.renderIconHtml({ library: "lucide", name: "user" });
        expect(html).toContain("name=\"user\"");
        expect(html).toContain("library=\"lucide\"");
    });

    it("treats the default library as no library attribute", () => {
        const html = serializer.renderIconHtml({ library: "default", name: "gear" });
        expect(html).toContain("name=\"gear\"");
        expect(html).not.toContain("library=");
    });

    it("supports the library:name shorthand string", () => {
        const html = serializer.renderIconHtml("lucide:star");
        expect(html).toContain("name=\"star\"");
        expect(html).toContain("library=\"lucide\"");
    });

    it("renders nothing for an empty/undefined icon", () => {
        expect(serializer.renderIconHtml("")).toBe("");
        expect(serializer.renderIconHtml(undefined)).toBe("");
        expect(serializer.renderIconHtml(null)).toBe("");
    });

    it("escapes the name attribute (no markup injection)", () => {
        const html = serializer.renderIconHtml({ name: "a\"><script>x" });
        expect(html).not.toContain("<script>");
    });
});

describe("P69: ui-icon component renders as <sl-icon>", () => {
    it("renders an { library, name } icon value", () => {
        const html = serializer.renderComponentHtml(
            { kind: "icon", id: "i1", props: { icon: { library: "lucide", name: "home" } } },
            "vertical",
            ctx
        );
        expect(html).toContain("<sl-icon");
        expect(html).toContain("name=\"home\"");
        expect(html).toContain("library=\"lucide\"");
    });

    it("renders a bare-string icon (back-compat)", () => {
        const html = serializer.renderComponentHtml(
            { kind: "icon", id: "i2", props: { icon: "trash" } },
            "vertical",
            ctx
        );
        expect(html).toContain("name=\"trash\"");
    });

    it("carries size and color when set", () => {
        const html = serializer.renderComponentHtml(
            { kind: "icon", id: "i3", props: { icon: "gear", size: "lg", color: "#ff0000" } },
            "vertical",
            ctx
        );
        expect(html).toContain("<sl-icon");
        expect(html.toLowerCase()).toContain("ff0000");
    });
});

describe("P69: ui-button icon prefix slot", () => {
    it("renders an sl-icon with slot=prefix inside the button", () => {
        const html = serializer.renderComponentHtml(
            { kind: "button", id: "b1", label: "Add", props: { label: "Add", icon: { library: "default", name: "plus" } } },
            "vertical",
            ctx
        );
        expect(html).toContain("<sl-button");
        expect(html).toContain("slot=\"prefix\"");
        expect(html).toContain("name=\"plus\"");
    });

    it("renders no icon when the button has none", () => {
        const html = serializer.renderComponentHtml(
            { kind: "button", id: "b2", label: "Plain", props: { label: "Plain" } },
            "vertical",
            ctx
        );
        expect(html).not.toContain("slot=\"prefix\"");
    });
});

describe("P69: ui-avatar icon fallback", () => {
    it("renders an sl-icon inside the avatar when no src/initials and an icon is set", () => {
        const html = serializer.renderComponentHtml(
            { kind: "avatar", id: "a1", props: { icon: { library: "default", name: "person" } } },
            "vertical",
            ctx
        );
        expect(html).toContain("<sl-avatar");
        expect(html).toContain("name=\"person\"");
    });

    it("prefers src over the icon fallback", () => {
        const html = serializer.renderComponentHtml(
            { kind: "avatar", id: "a2", value: "http://example/x.png", props: { src: "http://example/x.png", icon: { name: "person" } } },
            "vertical",
            ctx
        );
        expect(html).toContain("image=\"http://example/x.png\"");
        expect(html).not.toContain("name=\"person\"");
    });
});

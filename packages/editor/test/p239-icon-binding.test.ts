import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

/**
 * P239 (ADR 0012 §Binding-Ubiquität) — unit coverage for the BINDABLE icon field.
 *
 * `iconFieldSchema` is binding-capable (bare string | {library,name} | binding) and
 * the renderer resolves a bound icon name live (P235). Until P239 the editor
 * offered a plain text input, so a binding was unreachable for the author. The
 * serialisation pair `readIconBinding` / `applyIconBinding` is pure (no jQuery /
 * RED), so — like p113 — we load the browser IIFE in a vm and assert the exports.
 *
 * The load-bearing property here is LOSSLESS ROUND-TRIP: `icon` has THREE stored
 * shapes and open→save must not drift any of them.
 */

interface TypedInputType {
    value: string;
    label?: string;
}

interface Binding {
    kind: string;
    path?: string;
    value?: unknown;
}

interface EditorCommon {
    valueBindingTypes: (options?: { category?: string; currentKind?: string }) => Array<TypedInputType | string>;
    readIconBinding: (stored: unknown) => { type: string; value: string };
    applyIconBinding: (type: string, value: string, original?: unknown) => unknown;
    iconLiteralStringForm: (stored: unknown) => string;
}

let common: EditorCommon;

function typeValues(types: Array<TypedInputType | string>): string[] {
    return types.map((t) => (typeof t === "string" ? t : t.value));
}

beforeAll(() => {
    const editorCommonPath = fileURLToPath(
        new URL("../../../resources/lib/editor-common.js", import.meta.url)
    );
    const source = readFileSync(editorCommonPath, "utf8");
    const sandbox: Record<string, unknown> = {};
    sandbox.window = sandbox;
    createContext(sandbox);
    runInContext(source, sandbox);
    common = sandbox.WebappEditorCommon as EditorCommon;
});

describe("P239: the `icon` binding-type category", () => {
    it("is the canonical value set with `str` replaced by `icon` — exactly one delta, no additions/removals", () => {
        const value = typeValues(common.valueBindingTypes({ category: "value" }));
        const icon = typeValues(common.valueBindingTypes({ category: "icon" }));

        // The delta is positional: `icon` sits exactly where `str` sits.
        expect(icon).toEqual(value.map((t) => (t === "str" ? "icon" : t)));
        expect(icon).not.toContain("str");
        expect(icon).toContain("icon");
        expect(icon.length).toBe(value.length);
    });

    it("offers every canonical dynamic binding kind (ADR 0012) — the point of the package", () => {
        const icon = typeValues(common.valueBindingTypes({ category: "icon" }));
        for (const kind of ["store", "query", "routeParam", "reactive", "msg", "jsonata", "flow", "global", "env"]) {
            expect(icon).toContain(kind);
        }
    });

    it("the icon literal type carries the P69 picker on its expand button", () => {
        const iconType = common
            .valueBindingTypes({ category: "icon" })
            .find((t) => typeof t !== "string" && t.value === "icon") as (TypedInputType & { expand?: unknown });
        expect(iconType).toBeDefined();
        expect(typeof iconType.expand).toBe("function");
    });
});

describe("P239: readIconBinding — the three stored shapes open correctly", () => {
    it("a back-compat BARE STRING opens on the literal type", () => {
        expect(common.readIconBinding("home")).toEqual({ type: "icon", value: "home" });
    });

    it("a `library:name` shorthand opens on the literal type verbatim", () => {
        expect(common.readIconBinding("lucide:user")).toEqual({ type: "icon", value: "lucide:user" });
    });

    it("a literal {library,name} opens on the literal type as its string form", () => {
        expect(common.readIconBinding({ library: "lucide", name: "user" })).toEqual({
            type: "icon",
            value: "lucide:user"
        });
        // The default library is implicit in the string form.
        expect(common.readIconBinding({ library: "default", name: "house" })).toEqual({
            type: "icon",
            value: "house"
        });
    });

    it("a BINDING object opens on its own kind — the P239 capability", () => {
        expect(common.readIconBinding({ kind: "store", path: "iconStore" })).toEqual({
            type: "store",
            value: "iconStore"
        });
        expect(common.readIconBinding({ kind: "state", path: "icons.current" })).toEqual({
            type: "state",
            value: "icons.current"
        });
    });

    it("an empty/absent icon opens on the literal type with an empty value", () => {
        expect(common.readIconBinding("")).toEqual({ type: "icon", value: "" });
        expect(common.readIconBinding(undefined)).toEqual({ type: "icon", value: "" });
    });
});

describe("P239: applyIconBinding — open→save is lossless (acceptance: no field drift)", () => {
    it("an UNTOUCHED bare string round-trips VERBATIM (back-compat)", () => {
        const original = "home";
        const opened = common.readIconBinding(original);
        expect(common.applyIconBinding(opened.type, opened.value, original)).toBe(original);
    });

    it("an UNTOUCHED literal {library,name} round-trips VERBATIM — not flattened to a string", () => {
        const original = { library: "lucide", name: "user" };
        const opened = common.readIconBinding(original);
        const saved = common.applyIconBinding(opened.type, opened.value, original);
        // Identity, not just equality: the stored shape is written back untouched.
        expect(saved).toBe(original);
        expect(saved).toEqual({ library: "lucide", name: "user" });
    });

    it("an UNTOUCHED {library:'default'} literal round-trips VERBATIM despite its bare string form", () => {
        // Regression guard: the string form drops the default library ("house"),
        // so a naive save would drift {library,name} → "house".
        const original = { library: "default", name: "house" };
        const opened = common.readIconBinding(original);
        expect(opened.value).toBe("house");
        expect(common.applyIconBinding(opened.type, opened.value, original)).toBe(original);
    });

    it("an UNTOUCHED binding object round-trips to an equal binding", () => {
        const original = { kind: "store", path: "iconStore" };
        const opened = common.readIconBinding(original);
        expect(common.applyIconBinding(opened.type, opened.value, original)).toEqual(original);
    });

    it("a CHANGED literal persists as the plain string form (mapIconField splits library:name downstream)", () => {
        expect(common.applyIconBinding("icon", "star", "home")).toBe("star");
        expect(common.applyIconBinding("icon", "lucide:gear", { library: "default", name: "house" })).toBe("lucide:gear");
    });

    it("switching literal → binding persists the BINDING object (the editor-exposure gap P239 closes)", () => {
        expect(common.applyIconBinding("store", "iconStore", "home")).toEqual({
            kind: "store",
            path: "iconStore"
        });
    });

    it("switching binding → literal persists the plain icon name, never a {kind:'literal'} wrapper", () => {
        const saved = common.applyIconBinding("icon", "house", { kind: "store", path: "iconStore" });
        expect(saved).toBe("house");
    });

    it("a whitespace-padded literal is trimmed (and still round-trips its original)", () => {
        expect(common.applyIconBinding("icon", "  star  ", "home")).toBe("star");
        expect(common.applyIconBinding("icon", "  home  ", "home")).toBe("home");
    });
});

describe("P239: iconLiteralStringForm", () => {
    it("maps every literal shape to the form the picker/preview speak", () => {
        expect(common.iconLiteralStringForm("home")).toBe("home");
        expect(common.iconLiteralStringForm("  home  ")).toBe("home");
        expect(common.iconLiteralStringForm({ library: "default", name: "house" })).toBe("house");
        expect(common.iconLiteralStringForm({ name: "house" })).toBe("house");
        expect(common.iconLiteralStringForm({ library: "lucide", name: "user" })).toBe("lucide:user");
    });

    it("has no string form for a binding object or an empty value", () => {
        expect(common.iconLiteralStringForm({ kind: "store", path: "s" })).toBe("");
        expect(common.iconLiteralStringForm("")).toBe("");
        expect(common.iconLiteralStringForm(undefined)).toBe("");
    });
});

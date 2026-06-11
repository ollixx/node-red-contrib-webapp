import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

import { assembleNodeSet } from "../src";

const require = createRequire(import.meta.url);
const webapp = require("../../../nodes/webapp.js") as {
    __test__: {
        runtimeNodeRegistry: Record<string, { mapConfig: (config: Record<string, unknown>) => unknown }>;
    };
};

const { runtimeNodeRegistry } = webapp.__test__;

const baseMount = { parent: "app1/route1/content" };

type RadioDef = {
    type: string;
    label: unknown;
    options: unknown;
};

function mapRadio(config: Record<string, unknown>): RadioDef {
    return runtimeNodeRegistry["ui-radio"].mapConfig(config) as RadioDef;
}

/**
 * P136 — ui-radio mirrors P133 (ui-select): the SHARED options helper (one
 * source of truth) and a binding-capable `label`. These tests assert the
 * ui-radio runtime mapper consumes that shared model exactly like ui-select.
 */
describe("P136: ui-radio — shared Options helper (json | store, 3 forms + migration)", () => {
    it("Form 1 — options object map {label:value} via the json literal binding", () => {
        const def = mapRadio({
            id: "r1",
            ...baseMount,
            label: "Country",
            options: { kind: "literal", value: { Germany: "de", France: "fr" } }
        });
        expect(def.options).toEqual([
            { label: "Germany", value: "de" },
            { label: "France", value: "fr" }
        ]);
    });

    it("Form 2 — options array of strings (value = label)", () => {
        const def = mapRadio({
            id: "r2",
            ...baseMount,
            label: "Size",
            options: { kind: "literal", value: ["S", "M", "L"] }
        });
        expect(def.options).toEqual([
            { label: "S", value: "S" },
            { label: "M", value: "M" },
            { label: "L", value: "L" }
        ]);
    });

    it("Form 3 — options array of {label,value} objects", () => {
        const def = mapRadio({
            id: "r3",
            ...baseMount,
            label: "Pick",
            options: { kind: "literal", value: [{ label: "A", value: "a" }, { label: "B", value: "b" }] }
        });
        expect(def.options).toEqual([
            { label: "A", value: "a" },
            { label: "B", value: "b" }
        ]);
    });

    it("invalid options structure → fallback (undefined), node fails validation", () => {
        const def = mapRadio({
            id: "r4",
            ...baseMount,
            label: "Bad",
            options: { kind: "literal", value: 42 }
        });
        expect(def.options).toBeUndefined();
    });

    it("store-type options pass through as a binding object (resolved reactively)", () => {
        const def = mapRadio({
            id: "r5",
            ...baseMount,
            label: "Dynamic",
            options: { kind: "store", path: "lookups", subPath: "countries" }
        });
        expect(def.options).toEqual({ kind: "store", path: "lookups", subPath: "countries" });
    });

    it("migration — legacy optionsJson string normalises to the array form", () => {
        const def = mapRadio({
            id: "r6",
            ...baseMount,
            label: "Legacy",
            optionsJson: '[{"label":"M","value":"m"}]'
        });
        expect(def.options).toEqual([{ label: "M", value: "m" }]);
    });

    it("migration — legacy optionsBinding string becomes a state binding", () => {
        const def = mapRadio({
            id: "r7",
            ...baseMount,
            label: "Legacy2",
            optionsBinding: "data.options"
        });
        expect(def.options).toEqual({ kind: "state", path: "data.options" });
    });
});

describe("P136: ui-radio — label accepts the canonical value-binding set", () => {
    it("a literal-string label is preserved", () => {
        const def = mapRadio({ id: "r8", ...baseMount, label: "Gender", options: { kind: "literal", value: ["m", "f"] } });
        expect(def.label).toBe("Gender");
    });

    it("a binding-object label passes through to bind.label (renderer resolves it)", () => {
        const labelBinding = { kind: "store", path: "labels" };
        const def = mapRadio({ id: "r9", ...baseMount, label: labelBinding, options: { kind: "literal", value: ["m", "f"] } });
        expect(def.label).toEqual(labelBinding);
    });

    it("compiles to a valid AppModel with a binding label and store options", () => {
        const assembly = assembleNodeSet([
            { type: "ui-app", id: "app1", name: "App", root: "app1", layout: "app" },
            { type: "ui-route", id: "route1", path: "/test", layout: "vertical" },
            {
                type: "ui-radio",
                id: "rad1",
                mount: "route:/test/content",
                label: { kind: "store", path: "labels" },
                value: { kind: "state", path: "form.gender" },
                options: { kind: "store", path: "lookups" }
            }
        ]);
        expect(assembly.success).toBe(true);
    });
});

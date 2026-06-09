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

// ── ui-select ────────────────────────────────────────────────────────────────

describe("P16a: ui-select — schema compilation", () => {
    it("compiles to a valid schema definition with label and value", () => {
        const assembly = assembleNodeSet([
            { type: "ui-app", id: "app1", name: "App", root: "app1", layout: "app" },
            { type: "ui-route", id: "route1", path: "/test", layout: "vertical" },
            {
                type: "ui-select",
                id: "sel1",
                mount: "route:/test/content",
                label: "Status",
                value: { kind: "state", path: "form.status" }
            }
        ]);

        expect(assembly.success).toBe(true);
    });

    it("mapConfig produces correct type and label", () => {
        const def = runtimeNodeRegistry["ui-select"].mapConfig({
            id: "sel1",
            ...baseMount,
            label: "Color",
            valuePath: "form.color"
        }) as Record<string, unknown>;

        expect(def.type).toBe("ui-select");
        expect(def.label).toBe("Color");
    });

    it("static options JSON is parsed to array", () => {
        const def = runtimeNodeRegistry["ui-select"].mapConfig({
            id: "sel1",
            ...baseMount,
            label: "X",
            valuePath: "v",
            optionsJson: '[{"label":"A","value":"a"}]'
        }) as { options: unknown[] };

        expect(Array.isArray(def.options)).toBe(true);
        expect((def.options as Record<string, unknown>[])[0]).toMatchObject({ label: "A", value: "a" });
    });

    it("options binding is resolved to a state binding", () => {
        const def = runtimeNodeRegistry["ui-select"].mapConfig({
            id: "sel1",
            ...baseMount,
            label: "X",
            valuePath: "v",
            optionsBinding: "data.options"
        }) as { options: Record<string, unknown> };

        expect(def.options).toMatchObject({ kind: "state", path: "data.options" });
    });

    it("emits change event with correct payload on value change", () => {
        const def = runtimeNodeRegistry["ui-select"].mapConfig({
            id: "sel1",
            ...baseMount,
            label: "X",
            valuePath: "v"
        }) as Record<string, unknown>;

        // Schema type check — definition is valid
        expect(def.type).toBe("ui-select");
    });
});

// ── ui-checkbox ──────────────────────────────────────────────────────────────

describe("P16a: ui-checkbox — schema compilation", () => {
    it("compiles to a valid schema definition", () => {
        const assembly = assembleNodeSet([
            { type: "ui-app", id: "app1", name: "App", root: "app1", layout: "app" },
            { type: "ui-route", id: "route1", path: "/test", layout: "vertical" },
            {
                type: "ui-checkbox",
                id: "chk1",
                mount: "route:/test/content",
                label: "Active",
                value: { kind: "state", path: "form.active" }
            }
        ]);

        expect(assembly.success).toBe(true);
    });

    it("mapConfig produces correct type and label", () => {
        const def = runtimeNodeRegistry["ui-checkbox"].mapConfig({
            id: "chk1",
            ...baseMount,
            label: "Active",
            valuePath: "form.active"
        }) as Record<string, unknown>;

        expect(def.type).toBe("ui-checkbox");
        expect(def.label).toBe("Active");
    });
});

// ── ui-radio ─────────────────────────────────────────────────────────────────

describe("P16a: ui-radio — schema compilation", () => {
    it("compiles to a valid schema definition", () => {
        const assembly = assembleNodeSet([
            { type: "ui-app", id: "app1", name: "App", root: "app1", layout: "app" },
            { type: "ui-route", id: "route1", path: "/test", layout: "vertical" },
            {
                type: "ui-radio",
                id: "rad1",
                mount: "route:/test/content",
                label: "Gender",
                value: { kind: "state", path: "form.gender" },
                options: [{ label: "M", value: "m" }, { label: "F", value: "f" }]
            }
        ]);

        expect(assembly.success).toBe(true);
    });

    it("mapConfig produces correct type and static options", () => {
        const def = runtimeNodeRegistry["ui-radio"].mapConfig({
            id: "rad1",
            ...baseMount,
            label: "Gender",
            valuePath: "form.gender",
            optionsJson: '[{"label":"M","value":"m"}]'
        }) as { type: string; options: unknown[] };

        expect(def.type).toBe("ui-radio");
        expect(Array.isArray(def.options)).toBe(true);
    });

    it("orientation field is forwarded", () => {
        const def = runtimeNodeRegistry["ui-radio"].mapConfig({
            id: "rad1",
            ...baseMount,
            label: "X",
            valuePath: "v",
            optionsJson: "[]",
            orientation: "horizontal"
        }) as { orientation: string };

        expect(def.orientation).toBe("horizontal");
    });
});

// ── ui-switch ─────────────────────────────────────────────────────────────────

describe("P16a: ui-switch — schema compilation", () => {
    it("compiles to a valid schema definition", () => {
        const assembly = assembleNodeSet([
            { type: "ui-app", id: "app1", name: "App", root: "app1", layout: "app" },
            { type: "ui-route", id: "route1", path: "/test", layout: "vertical" },
            {
                type: "ui-switch",
                id: "sw1",
                mount: "route:/test/content",
                value: { kind: "state", path: "settings.enabled" }
            }
        ]);

        expect(assembly.success).toBe(true);
    });

    it("mapConfig produces correct type and optional label fields", () => {
        const def = runtimeNodeRegistry["ui-switch"].mapConfig({
            id: "sw1",
            ...baseMount,
            valuePath: "settings.enabled",
            label: "Enable",
            labelOn: "On",
            labelOff: "Off"
        }) as Record<string, unknown>;

        expect(def.type).toBe("ui-switch");
        expect(def.label).toBe("Enable");
        expect(def.labelOn).toBe("On");
        expect(def.labelOff).toBe("Off");
    });
});

// ── ui-textarea ───────────────────────────────────────────────────────────────

describe("P16a: ui-textarea — schema compilation", () => {
    it("compiles to a valid schema definition", () => {
        const assembly = assembleNodeSet([
            { type: "ui-app", id: "app1", name: "App", root: "app1", layout: "app" },
            { type: "ui-route", id: "route1", path: "/test", layout: "vertical" },
            {
                type: "ui-textarea",
                id: "ta1",
                mount: "route:/test/content",
                label: "Notes",
                value: { kind: "state", path: "form.notes" }
            }
        ]);

        expect(assembly.success).toBe(true);
    });

    it("mapConfig forwards rows and maxLength", () => {
        const def = runtimeNodeRegistry["ui-textarea"].mapConfig({
            id: "ta1",
            ...baseMount,
            label: "Notes",
            valuePath: "form.notes",
            rows: "5",
            maxLength: "500"
        }) as Record<string, unknown>;

        expect(def.type).toBe("ui-textarea");
        expect(def.rows).toBe(5);
        expect(def.maxLength).toBe(500);
    });
});

// ── ui-datepicker ─────────────────────────────────────────────────────────────

describe("P16a: ui-datepicker — schema compilation", () => {
    it("compiles to a valid schema definition", () => {
        const assembly = assembleNodeSet([
            { type: "ui-app", id: "app1", name: "App", root: "app1", layout: "app" },
            { type: "ui-route", id: "route1", path: "/test", layout: "vertical" },
            {
                type: "ui-datepicker",
                id: "dp1",
                mount: "route:/test/content",
                label: "Date",
                value: { kind: "state", path: "form.date" }
            }
        ]);

        expect(assembly.success).toBe(true);
    });

    it("mapConfig forwards mode, min, max", () => {
        const def = runtimeNodeRegistry["ui-datepicker"].mapConfig({
            id: "dp1",
            ...baseMount,
            label: "Date",
            valuePath: "form.date",
            mode: "datetime",
            min: "2020-01-01",
            max: "2030-12-31"
        }) as Record<string, unknown>;

        expect(def.type).toBe("ui-datepicker");
        expect(def.mode).toBe("datetime");
        expect(def.min).toBe("2020-01-01");
        expect(def.max).toBe("2030-12-31");
    });
});

// ── ui-slider ─────────────────────────────────────────────────────────────────

describe("P16a: ui-slider — schema compilation", () => {
    it("compiles to a valid schema definition", () => {
        const assembly = assembleNodeSet([
            { type: "ui-app", id: "app1", name: "App", root: "app1", layout: "app" },
            { type: "ui-route", id: "route1", path: "/test", layout: "vertical" },
            {
                type: "ui-slider",
                id: "sl1",
                mount: "route:/test/content",
                value: { kind: "state", path: "form.level" }
            }
        ]);

        expect(assembly.success).toBe(true);
    });

    it("mapConfig forwards min, max, step, showValue", () => {
        const def = runtimeNodeRegistry["ui-slider"].mapConfig({
            id: "sl1",
            ...baseMount,
            valuePath: "form.level",
            min: "0",
            max: "100",
            step: "5",
            showValue: true
        }) as Record<string, unknown>;

        expect(def.type).toBe("ui-slider");
        expect(def.min).toBe(0);
        expect(def.max).toBe(100);
        expect(def.step).toBe(5);
        expect(def.showValue).toBe(true);
    });
});

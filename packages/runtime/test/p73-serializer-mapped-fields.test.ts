/**
 * P73 — Bugfix: Serializer does not render mapped fields.
 *
 * Three bugs:
 *   1. ui-switch `labelOn`/`labelOff` — in schema + mapConfig but not rendered
 *      in webapp-serializer.js (missing from props assembly AND serializer HTML).
 *   2. ui-slider `showValue` — in schema + mapConfig + props assembly (line ~975)
 *      but not emitted in the serializer's <sl-range> HTML.
 *   3. ui-datepicker `mode` — in schema + mapConfig but hardcoded `type="date"`
 *      in the serializer regardless of mode=datetime or mode=time.
 */

import { describe, expect, it } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const serializer = require("../../../resources/lib/webapp-serializer.js") as {
    renderComponentHtml: (component: unknown, layoutId: string, ctx: unknown) => string;
};

const CTX = { appId: "testApp", location: "/", params: {}, formId: undefined };

// Helpers
function makeSwitch(extra: Record<string, unknown> = {}): unknown {
    return {
        id: "sw1",
        kind: "switch",
        props: { label: "Enable", ...extra },
        bind: { value: { kind: "literal", value: false } },
        value: false,
        disabled: false,
    };
}

function makeSlider(extra: Record<string, unknown> = {}): unknown {
    return {
        id: "sl1",
        kind: "slider",
        props: { label: "Volume", min: 0, max: 100, step: 1, ...extra },
        bind: { value: { kind: "literal", value: 50 } },
        value: 50,
        disabled: false,
    };
}

function makeDatepicker(extra: Record<string, unknown> = {}): unknown {
    return {
        id: "dp1",
        kind: "datepicker",
        props: { label: "Date", ...extra },
        bind: { value: { kind: "literal", value: "" } },
        value: "",
        disabled: false,
    };
}

// ─── Bug 1: ui-switch labelOn / labelOff ────────────────────────────────────

describe("P73 — ui-switch: labelOn/labelOff rendered in HTML", () => {
    it("renders <sl-switch> without labelOn/labelOff when not set", () => {
        const html = serializer.renderComponentHtml(makeSwitch(), "vertical", CTX);
        expect(html).toContain("<sl-switch");
        // should not contain empty label-on / label-off attrs
        expect(html).not.toContain('label-on="');
        expect(html).not.toContain('label-off="');
    });

    it("renders <sl-switch label-on=...> when labelOn is set", () => {
        const html = serializer.renderComponentHtml(
            makeSwitch({ labelOn: "On", labelOff: "Off" }),
            "vertical",
            CTX
        );
        expect(html).toContain('label-on="On"');
        expect(html).toContain('label-off="Off"');
    });

    it("renders only labelOn when labelOff is absent", () => {
        const html = serializer.renderComponentHtml(
            makeSwitch({ labelOn: "Yes" }),
            "vertical",
            CTX
        );
        expect(html).toContain('label-on="Yes"');
        expect(html).not.toContain('label-off="');
    });
});

// ─── Bug 2: ui-slider showValue ─────────────────────────────────────────────

describe("P73 — ui-slider: showValue rendered as attribute", () => {
    it("renders <sl-range> without label-value when showValue is false/absent", () => {
        const html = serializer.renderComponentHtml(makeSlider(), "vertical", CTX);
        expect(html).toContain("<sl-range");
        // No label-value or show-value attr when not set
        expect(html).not.toContain("label-value");
        expect(html).not.toContain("show-value");
    });

    it("renders <sl-range label-value> when showValue is true", () => {
        const html = serializer.renderComponentHtml(
            makeSlider({ showValue: true }),
            "vertical",
            CTX
        );
        // sl-range uses label-value attribute to show current value
        expect(html).toContain("label-value");
    });
});

// ─── Bug 3: ui-datepicker mode ───────────────────────────────────────────────

describe("P73 — ui-datepicker: mode correctly maps to type attribute", () => {
    it("defaults to type=date when mode is absent", () => {
        const html = serializer.renderComponentHtml(makeDatepicker(), "vertical", CTX);
        expect(html).toContain('type="date"');
        expect(html).not.toContain('type="datetime-local"');
        expect(html).not.toContain('type="time"');
    });

    it("renders type=date when mode='date'", () => {
        const html = serializer.renderComponentHtml(
            makeDatepicker({ mode: "date" }),
            "vertical",
            CTX
        );
        expect(html).toContain('type="date"');
    });

    it("renders type=datetime-local when mode='datetime'", () => {
        const html = serializer.renderComponentHtml(
            makeDatepicker({ mode: "datetime" }),
            "vertical",
            CTX
        );
        expect(html).toContain('type="datetime-local"');
        expect(html).not.toContain('type="date"');
    });

    it("renders type=time when mode='time'", () => {
        const html = serializer.renderComponentHtml(
            makeDatepicker({ mode: "time" }),
            "vertical",
            CTX
        );
        expect(html).toContain('type="time"');
        expect(html).not.toContain('type="date"');
    });
});

// ─── Props assembly: labelOn/labelOff/mode flow through mapConfig ────────────

describe("P73 — props assembly: labelOn/labelOff/mode appear in component.props", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const webappTest = (require("../../../nodes/webapp.js") as { __test__: Record<string, unknown> }).__test__;

    const runtimeNodeRegistry = webappTest.runtimeNodeRegistry as Record<
        string,
        { mapConfig: (config: Record<string, unknown>) => Record<string, unknown> }
    >;

    const buildAppSnapshot = webappTest.buildAppSnapshot as (
        appId: string,
        location: string,
        dialogId: string | undefined,
        definitions: unknown[]
    ) => { success: boolean; snapshot?: { regions: { components: unknown[] }[] } };

    function buildDefs(nodes: Record<string, unknown>[]) {
        return nodes.map((n) => {
            const reg = runtimeNodeRegistry[n.type as string];
            return reg?.mapConfig ? { ...reg.mapConfig(n), z: n.z } : { ...n, id: n.id };
        });
    }

    it("ui-switch with labelOn/labelOff: component.props contains both fields", () => {
        const defs = buildDefs([
            { type: "ui-app", id: "app73a", name: "App", root: "app73a", layout: "app", z: "f1" },
            {
                type: "ui-switch",
                id: "sw73",
                mount: "app73a.content",
                label: "Toggle",
                labelOn: "On",
                labelOff: "Off",
                z: "f1",
            },
        ]);

        const result = buildAppSnapshot("app73a", "/", undefined, defs);
        expect(result.success).toBe(true);

        const components = result.snapshot!.regions.flatMap((r) => r.components);
        const sw = components.find((c) => (c as { id: string }).id === "sw73") as { props: Record<string, unknown> } | undefined;
        expect(sw).toBeDefined();
        expect(sw!.props.labelOn).toBe("On");
        expect(sw!.props.labelOff).toBe("Off");
    });

    it("ui-datepicker with mode='datetime': component.props.mode is 'datetime'", () => {
        const defs = buildDefs([
            { type: "ui-app", id: "app73b", name: "App", root: "app73b", layout: "app", z: "f1" },
            {
                type: "ui-datepicker",
                id: "dp73",
                mount: "app73b.content",
                label: "Date",
                mode: "datetime",
                z: "f1",
            },
        ]);

        const result = buildAppSnapshot("app73b", "/", undefined, defs);
        expect(result.success).toBe(true);

        const components = result.snapshot!.regions.flatMap((r) => r.components);
        const dp = components.find((c) => (c as { id: string }).id === "dp73") as { props: Record<string, unknown> } | undefined;
        expect(dp).toBeDefined();
        expect(dp!.props.mode).toBe("datetime");
    });
});

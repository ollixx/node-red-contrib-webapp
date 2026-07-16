import { execFileSync } from "node:child_process";
import path from "node:path";

import { describe, it, expect } from "vitest";

// The check script is plain CommonJS; require it for the pure-function assertions
// and invoke it as a child process for the end-to-end (exit-code) proof. Modelled
// on scripts/check-no-crash.test.ts — the core logic is pure over in-memory
// strings, so the pass/fail cases need no real tree and no shelling out.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const check = require("./check-binding-docs.js");

const ROOT = path.resolve(__dirname, "..");
const SCRIPT = path.join(ROOT, "scripts", "check-binding-docs.js");

describe("check-binding-docs tripwire (ADR 0012, Muster 4)", () => {
    it("is GREEN on the real tree", () => {
        const { errors, checked } = check.checkBindingDocs();
        expect(errors).toEqual([]);
        expect(checked).toBeGreaterThan(0);
    });

    it("exits 0 when run as the CI tripwire", () => {
        expect(() => execFileSync(process.execPath, [SCRIPT], { cwd: ROOT })).not.toThrow();
    });

    // ---- bindingCapableFields (pure) ---------------------------------------
    it("detects a union-with-bindingSchema field and a direct bindingSchema field", () => {
        const body = `
            type: z.literal("ui-x"),
            placeholder: z.union([bindingSchema, z.string()]).optional(),
            value: bindingSchema,
            label: z.union([bindingSchema, z.string().min(1, "no empty")]),
        `;
        const fields = check.bindingCapableFields(body);
        expect([...fields].sort()).toEqual(["label", "placeholder", "value"]);
    });

    it("does NOT treat writeToBindingSchema as binding-capable (write half, not a display binding)", () => {
        const body = `
            writeTo: writeToBindingSchema.optional(),
            min: z.string().optional(),
        `;
        expect([...check.bindingCapableFields(body)]).toEqual([]);
    });

    it("finds a field even when a line comment precedes it", () => {
        const body = `
            // P147: label is now a full binding (ADR 0012).
            label: z.union([bindingSchema, z.string()]).optional(),
        `;
        expect([...check.bindingCapableFields(body)]).toEqual(["label"]);
    });

    it("ignores spread members and non-binding scalar fields", () => {
        const body = `
            ...baseFieldsSchema,
            step: z.number().positive().optional(),
            showValue: z.boolean().optional(),
        `;
        expect([...check.bindingCapableFields(body)]).toEqual([]);
    });

    // ---- documentsAsNonBindable (pure) -------------------------------------
    it("flags a `Textfeld` editor-type row", () => {
        expect(check.documentsAsNonBindable({ editorType: "Textfeld", description: "some text" })).toBe(true);
    });

    it("flags a row whose text says `kein Binding` or `nicht bindbar`", () => {
        expect(check.documentsAsNonBindable({ editorType: "typedInput", description: "Kein Binding — statische URL." })).toBe(true);
        expect(check.documentsAsNonBindable({ editorType: "typedInput", description: "Dieses Feld ist nicht bindbar." })).toBe(true);
    });

    it("does NOT flag a correctly-documented bindable row", () => {
        expect(check.documentsAsNonBindable({ editorType: "typedInput (alle Binding-Arten)", description: "Unterstützt alle Binding-Arten." })).toBe(false);
    });

    // ---- felderRows (pure) --------------------------------------------------
    it("parses the Editor-Typ and Beschreibung of each canonical field-table row", () => {
        const md = [
            "## Felder",
            "",
            "| Feld | Label | Editor-Typ | Pflicht | Beschreibung |",
            "|---|---|---|---|---|",
            "| `foo` | „Foo\" | Textfeld | optional | Ein Feld. |",
            "| `bar` | „Bar\" | typedInput (Binding) | **ja** | Bindbar. |",
        ].join("\n");
        const rows = check.felderRows(md);
        expect(rows.foo.editorType).toBe("Textfeld");
        expect(rows.bar.editorType).toBe("typedInput (Binding)");
    });

    // ---- allowlist state ----------------------------------------------------
    it("never allowlists any of P237's four target fields (they are fixed, not carved out)", () => {
        const allow = check.FIELD_ALLOWLIST as Record<string, Record<string, string>>;
        expect(allow["ui-datepicker"]?.placeholder).toBeUndefined();
        expect(allow["ui-slider"]?.label).toBeUndefined();
        expect(allow["ui-image"]?.alt).toBeUndefined();
        expect(allow["ui-image"]?.fallbackSrc).toBeUndefined();
    });

    it("every allowlist entry carries a non-empty reason (shrinking, ADR-grade)", () => {
        const allow = check.FIELD_ALLOWLIST as Record<string, Record<string, string>>;
        for (const [node, fields] of Object.entries(allow)) {
            for (const [field, reason] of Object.entries(fields)) {
                expect(reason, `${node}:${field}`).toBeTruthy();
                expect(reason.length, `${node}:${field}`).toBeGreaterThan(10);
            }
        }
    });
});

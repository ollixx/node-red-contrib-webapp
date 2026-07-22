import { execFileSync } from "node:child_process";
import path from "node:path";

import { describe, it, expect } from "vitest";

// The check script is plain CommonJS; require it for the pure-function assertions
// and invoke it as a child process for the end-to-end (exit-code) proof. Modelled
// on scripts/check-specs.test.ts + check-roundtrip.test.ts — the core logic
// (`fieldViolations` / `analyzeNodes`) is pure over an in-memory defaults list, so
// the per-rule pass/fail/allowlist cases need no real tree and no shelling out.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const check = require("./check-fields.js");

const ROOT = path.resolve(__dirname, "..");
const SCRIPT = path.join(ROOT, "scripts", "check-fields.js");

// A fully conformant node: bare `layout`/`route` references, a `<base>`+`<base>Binding`
// carrier with NO `<base>Path` twin, no `*Json`/`storeId`/`path` legacy, and the
// kept `selectedId`/`uiId` (which are NOT node references).
const CONFORMANT = [
    "name",
    "app",
    "mount",
    "layout",
    "route",
    "value",
    "valueBinding",
    "selectedId",
    "uiId",
];

describe("check-fields cross-node consistency tripwire", () => {
    it("is GREEN on the real tree with a COMPLETELY EMPTY allowlist (P259: field model frozen)", () => {
        const { errors, checked, allowlisted } = check.checkFields();
        expect(errors).toEqual([]);
        expect(checked).toBeGreaterThan(0);
        // P259 closed the ADR-0038 rename train — no allowlist entry remains and
        // none may come back without an ADR reason.
        expect(allowlisted).toBe(0);
        expect(check.ALLOWLIST).toEqual({});
    });

    it("exits 0 when run as the CI tripwire", () => {
        expect(() => execFileSync(process.execPath, [SCRIPT], { cwd: ROOT })).not.toThrow();
    });

    it("passes a fully conformant node (no violation)", () => {
        expect(check.fieldViolations(CONFORMANT)).toEqual([]);
        const { errors, checked } = check.analyzeNodes(
            [{ type: "ui-ok", defaults: CONFORMANT }],
            {}
        );
        expect(errors).toEqual([]);
        expect(checked).toBe(1);
    });

    // ---- Rule (a): carrier-twin consistency ---------------------------------
    it("FAILS a node carrying both `<base>Binding` and the retired `<base>Path` twin", () => {
        const v = check.fieldViolations(["value", "valueBinding", "valuePath"]);
        expect(v).toEqual([{ field: "valuePath", rule: "carrier-twin", message: expect.any(String) }]);
        const { errors } = check.analyzeNodes(
            [{ type: "ui-x", defaults: ["value", "valueBinding", "valuePath"] }],
            {}
        );
        expect(errors.length).toBe(1);
        expect(errors[0]).toContain("ui-x");
        expect(errors[0]).toContain("valuePath");
    });

    it("does NOT flag a `<base>Path` when there is no `<base>Binding` twin", () => {
        // `path` alone (no `storeId`) is the LIVE store subpath, not a carrier twin.
        expect(check.fieldViolations(["store", "path"])).toEqual([]);
    });

    // ---- Rule (b): removed-legacy fields ------------------------------------
    it("FAILS a node reintroducing a `*Json` raw-JSON carrier", () => {
        const v = check.fieldViolations(["options", "optionsBinding", "optionsJson"]);
        expect(v.map((x: { field: string }) => x.field)).toContain("optionsJson");
        expect(v.find((x: { field: string }) => x.field === "optionsJson").rule).toBe("removed-legacy");
    });

    it("FAILS the dead `storeId` + `path` input write-target pair", () => {
        const v = check.fieldViolations(["value", "storeId", "path", "writeTo"]);
        const fields = v.map((x: { field: string }) => x.field);
        expect(fields).toContain("storeId");
        expect(fields).toContain("path");
    });

    it("does NOT flag a live `path` when it does not ride with `storeId`", () => {
        // ui-store-read / ui-store-action carry a live `path` subpath; ui-route.path
        // is the URL path — neither is the dead ADR-0027 pair.
        expect(check.fieldViolations(["store", "op", "path", "mode"])).toEqual([]);
    });

    it("FAILS a node reintroducing the `currentPagePath` pagination alias", () => {
        const v = check.fieldViolations(["total", "pageSize", "currentPagePath"]);
        expect(v.map((x: { field: string }) => x.field)).toContain("currentPagePath");
    });

    // ---- Rule (c): bare-name reference fields -------------------------------
    it("FAILS an id-suffixed reference field (`layoutId` must be `layout`)", () => {
        const v = check.fieldViolations(["name", "layoutId"]);
        expect(v).toEqual([
            { field: "layoutId", rule: "reference-bare-name", message: expect.any(String) },
        ]);
        expect(v[0].message).toContain("`layout`");
    });

    it("does NOT flag the kept `selectedId` / `uiId` (not node references)", () => {
        expect(check.fieldViolations(["selectedId", "uiId"])).toEqual([]);
    });

    // ---- Rule (c) P228 guardrail: `parent` is a retired reference field -----
    it("FAILS a node reintroducing the retired `parent` reference field (P228: use `app`)", () => {
        const v = check.fieldViolations(["name", "parent"]);
        expect(v).toEqual([
            { field: "parent", rule: "reference-bare-name", message: expect.any(String) },
        ]);
        expect(v[0].message).toContain("`app`");
    });

    it("does NOT flag the canonical `app` owning-app field", () => {
        expect(check.fieldViolations(["name", "app", "mount"])).toEqual([]);
    });

    // ---- Allowlist ----------------------------------------------------------
    it("PASSES an allowlisted (node, field) violation", () => {
        const { errors, allowlisted } = check.analyzeNodes(
            [{ type: "ui-x", defaults: ["name", "layoutId"] }],
            { "ui-x": { layoutId: "P228: rename pending" } }
        );
        expect(errors).toEqual([]);
        expect(allowlisted).toBe(1);
    });

    it("reports one line per field even when a field trips more than one rule", () => {
        // `currentPagePath` trips (a) carrier-twin AND (b) removed-legacy — one report.
        const { errors } = check.analyzeNodes(
            [{ type: "ui-x", defaults: ["currentPage", "currentPageBinding", "currentPagePath"] }],
            {}
        );
        expect(errors.length).toBe(1);
        expect(errors[0]).toContain("currentPagePath");
    });
});

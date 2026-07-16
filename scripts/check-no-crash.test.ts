import { execFileSync } from "node:child_process";
import path from "node:path";

import { describe, it, expect } from "vitest";

// The check script is plain CommonJS; require it for the pure-function assertions
// and invoke it as a child process for the end-to-end (exit-code) proof. Modelled
// on scripts/check-help.test.ts — the core logic (`findForbiddenMarkers` /
// `analyzeSpecs`) is pure over in-memory strings, so the pass/fail cases need no
// real tree and no shelling out.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const check = require("./check-no-crash.js");

const ROOT = path.resolve(__dirname, "..");
const SCRIPT = path.join(ROOT, "scripts", "check-no-crash.js");

// Build the forbidden phrases from split literals so this test file itself never
// contains a contiguous forbidden marker (it is not a *.spec.ts so the real scan
// skips it anyway, but this keeps grep-audits of the tree clean).
const CRASH = "without " + "crashing";
const RENDERS_WITHOUT = "renders " + "without error";

describe("check-no-crash presence-only tripwire", () => {
    it("is GREEN on the real tree (no spec has a forbidden marker)", () => {
        const { errors, checked, allowlisted } = check.checkNoCrash();
        expect(errors).toEqual([]);
        expect(checked).toBeGreaterThan(0);
        expect(allowlisted).toBe(0);
    });

    it("exits 0 when run as the CI tripwire", () => {
        expect(() => execFileSync(process.execPath, [SCRIPT], { cwd: ROOT })).not.toThrow();
    });

    // ---- findForbiddenMarkers (pure) ----------------------------------------
    it("flags a `without crashing` test title", () => {
        const hits = check.findForbiddenMarkers(`test("renders ${CRASH}", async () => {});`);
        expect(hits).toHaveLength(1);
        expect(hits[0].marker).toBe("without-crashing");
        expect(hits[0].line).toBe(1);
    });

    it("flags a `renders without` test title", () => {
        const hits = check.findForbiddenMarkers(`test("default state ${RENDERS_WITHOUT}", async () => {});`);
        expect(hits.some((h: { marker: string }) => h.marker === "renders-without")).toBe(true);
    });

    it("reports the correct 1-based line number", () => {
        const src = ["line one", "line two", `it("empty items ${CRASH}", () => {});`].join("\n");
        const hits = check.findForbiddenMarkers(src);
        expect(hits).toHaveLength(1);
        expect(hits[0].line).toBe(3);
    });

    it("passes a spec with only real outcome assertions", () => {
        const src = `test("shows the value", async ({ page }) => { await expect(page.locator("sl-badge")).toContainText("42"); });`;
        expect(check.findForbiddenMarkers(src)).toEqual([]);
    });

    // ---- analyzeSpecs (pure) ------------------------------------------------
    it("FAILS a spec list containing a forbidden marker", () => {
        const { errors, checked } = check.analyzeSpecs(
            [{ path: "tests/e2e/x.spec.ts", source: `test("renders ${CRASH}", () => {});` }],
            {}
        );
        expect(checked).toBe(1);
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain("tests/e2e/x.spec.ts:1");
        expect(errors[0]).toContain("without-crashing");
    });

    it("PASSES an allowlisted spec even with a forbidden marker", () => {
        const { errors, allowlisted } = check.analyzeSpecs(
            [{ path: "tests/e2e/x.spec.ts", source: `test("renders ${CRASH}", () => {});` }],
            { "tests/e2e/x.spec.ts": "temporary exception" }
        );
        expect(errors).toEqual([]);
        expect(allowlisted).toBe(1);
    });

    it("ships with an EMPTY allowlist", () => {
        expect(Object.keys(check.ALLOWLIST)).toEqual([]);
    });
});

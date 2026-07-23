import { execFileSync } from "node:child_process";
import path from "node:path";

import { describe, it, expect } from "vitest";

// P265 (ADR 0042) — user-guide coverage tripwire. Modelled on
// check-help.test.ts: the core (`guideViolation` / `analyzeNodes`) is pure over
// an in-memory { type, enDoc, deDoc } list; example resolution is injected via
// an `exampleExists` stub so the per-rule cases stay hermetic. The end-to-end
// proof shells the script out against the real tree.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const check = require("./check-guide.js");

const ROOT = path.resolve(__dirname, "..");
const SCRIPT = path.join(ROOT, "scripts", "check-guide.js");

const okDoc = (type: string) =>
    `# ${type}\n\nPurpose.\n\n## Examples\n\nFlow file: [\`examples/guide/${type}.json\`](../../../examples/guide/${type}.json)\n`;

const stubExists = (present: string[]) => (rel: string) => present.includes(rel);

describe("check-guide user-docs coverage tripwire", () => {
    it("is GREEN on the real tree (pilot covered, rest allowlisted)", () => {
        const { errors, checked, allowlisted } = check.checkGuide();
        expect(errors).toEqual([]);
        expect(checked).toBeGreaterThan(0);
        // P265 state: exactly the pilot is NOT allowlisted. The batches shrink
        // the allowlist — this assertion is on the invariant (covered = checked
        // minus allowlisted), not on today's absolute count.
        expect(checked - allowlisted).toBeGreaterThanOrEqual(1);
        expect(check.ALLOWLIST["ui-divider"]).toBeUndefined();
    });

    it("exits 0 when run as the CI tripwire", () => {
        expect(() => execFileSync(process.execPath, [SCRIPT], { cwd: ROOT })).not.toThrow();
    });

    it("passes a node with EN + DE docs each linking a resolvable example", () => {
        const v = check.guideViolation(
            { type: "ui-divider", enDoc: okDoc("ui-divider"), deDoc: okDoc("ui-divider") },
            { exampleExists: stubExists(["examples/guide/ui-divider.json"]) }
        );
        expect(v).toBeNull();
    });

    // ---- Rule (1): EN guide doc ---------------------------------------------
    it("FAILS a node without an EN guide doc", () => {
        const v = check.guideViolation({ type: "ui-x", enDoc: null, deDoc: null }, {});
        expect(v.rule).toBe("no-en-doc");
        const { errors } = check.analyzeNodes([{ type: "ui-x", enDoc: null, deDoc: null }], {}, {});
        expect(errors.length).toBe(1);
        expect(errors[0]).toContain("ui-x");
    });

    // ---- Rule (2): DE guide doc (never EN without DE) -----------------------
    it("FAILS a node with an EN doc but no DE mirror", () => {
        const v = check.guideViolation(
            { type: "ui-x", enDoc: okDoc("ui-x"), deDoc: null },
            { exampleExists: stubExists(["examples/guide/ui-x.json"]) }
        );
        expect(v.rule).toBe("no-de-doc");
    });

    // ---- Rules (3)/(4): resolvable example reference ------------------------
    it("FAILS an EN doc that references no example at all", () => {
        const v = check.guideViolation(
            { type: "ui-x", enDoc: "# ui-x\nNo example here.", deDoc: okDoc("ui-x") },
            { exampleExists: stubExists(["examples/guide/ui-x.json"]) }
        );
        expect(v.rule).toBe("no-example-en");
    });

    it("FAILS when the referenced example does not resolve on disk", () => {
        const v = check.guideViolation(
            { type: "ui-x", enDoc: okDoc("ui-x"), deDoc: okDoc("ui-x") },
            { exampleExists: stubExists([]) }
        );
        expect(v.rule).toBe("no-example-en");
    });

    it("FAILS when only the DE doc lacks a resolvable example (mirror completeness)", () => {
        const v = check.guideViolation(
            { type: "ui-x", enDoc: okDoc("ui-x"), deDoc: "# ui-x\nKein Beispiel." },
            { exampleExists: stubExists(["examples/guide/ui-x.json"]) }
        );
        expect(v.rule).toBe("no-example-de");
    });

    it("accepts an example from the generated per-node tree (examples/<cat>/) too", () => {
        const doc = "# ui-y\nFlow: `examples/view/ui-y.json`\n";
        const v = check.guideViolation(
            { type: "ui-y", enDoc: doc, deDoc: doc },
            { exampleExists: stubExists(["examples/view/ui-y.json"]) }
        );
        expect(v).toBeNull();
    });

    // ---- Allowlist ----------------------------------------------------------
    it("PASSES an allowlisted node with no docs (the shrinking rest-list)", () => {
        const { errors, allowlisted } = check.analyzeNodes(
            [{ type: "ui-x", enDoc: null, deDoc: null }],
            { "ui-x": "guide docs pending" },
            {}
        );
        expect(errors).toEqual([]);
        expect(allowlisted).toBe(1);
    });

    it("enumerates the registered ui-* types from package.json", () => {
        const types = check.registeredTypes();
        expect(types).toContain("ui-divider");
        expect(types).toContain("ui-app");
        expect(types.every((t: string) => t.startsWith("ui-"))).toBe(true);
    });
});

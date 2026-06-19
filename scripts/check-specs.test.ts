import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, it, expect } from "vitest";

// The check script is plain CommonJS; require it for the unit-level assertions and
// invoke it as a child process for the end-to-end (exit-code) drift proof.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const checkSpecs = require("./check-specs.js");

const ROOT = path.resolve(__dirname, "..");
const SCRIPT = path.join(ROOT, "scripts", "check-specs.js");

describe("check-specs conformance tripwire", () => {
    it("is GREEN on the real tree (every documented node conforms bidirectionally)", () => {
        const { errors, checked } = checkSpecs.checkSpecs();
        expect(errors).toEqual([]);
        expect(checked).toBeGreaterThan(20); // sanity: it actually checked the nodes
    });

    it("exits 0 when run as the CI tripwire", () => {
        // Throws (non-zero exit) on drift; a clean run must not throw.
        expect(() => execFileSync(process.execPath, [SCRIPT], { cwd: ROOT })).not.toThrow();
    });

    it("extracts the top-level defaults keys from a node .html, ignoring comments and nested values", () => {
        const keys = checkSpecs.extractDefaultsKeys(`
            common.registerNodeType("ui-x", {
                defaults: {
                    name: { value: "" },
                    // a comment with a colon: not a field
                    value: { value: { kind: "literal", value: "" }, validate: fn() },
                    variant: { value: "default" },
                }
            });
        `);
        expect(keys).toEqual(["name", "value", "variant"]);
    });

    it("reads field declarations ONLY from the canonical Felder field-table, not sub-tables", () => {
        const md = [
            "## Felder",
            "",
            "| Feld | Label | Editor-Typ | Pflicht | Beschreibung |",
            "|---|---|---|---|---|",
            "| `realField` | x | y | ja | z |",
            "",
            "### Sub-table (item schema)",
            "",
            "| Feld | Typ | Beschreibung |",
            "|---|---|---|",
            "| `subProp` | String | not a node field |",
            "",
            "## Output",
        ].join("\n");
        const fields = checkSpecs.felderTableFields(md);
        expect(fields.has("realField")).toBe(true);
        expect(fields.has("subProp")).toBe(false);
    });

    it("ignores struck-through (removed-field) rows in the Felder table", () => {
        const md = [
            "## Felder",
            "",
            "| Feld | Label | Editor-Typ | Pflicht | Beschreibung |",
            "|---|---|---|---|---|",
            "| ~~`gone`~~ | – | – | – | *Entfernt in Pxx.* |",
            "",
        ].join("\n");
        expect(checkSpecs.felderTableFields(md).has("gone")).toBe(false);
    });

    it("goes RED on a deliberately injected drift (code field absent from the spec)", () => {
        // Build a throwaway mini-tree: one node whose defaults carry an extra,
        // undocumented field, and a spec that omits it. The check must surface it.
        const dir = mkdtempSync(path.join(tmpdir(), "check-specs-drift-"));
        try {
            // Minimal package.json registering a single ui-* node.
            writeFileSync(
                path.join(dir, "package.json"),
                JSON.stringify({
                    name: "drift-fixture",
                    "node-red": { nodes: { "ui-drift": "nodes/ui-drift.js" } },
                })
            );
            mkdirSync(path.join(dir, "nodes"), { recursive: true });
            writeFileSync(
                path.join(dir, "nodes", "ui-drift.html"),
                `common.registerNodeType("ui-drift", {
                    defaults: {
                        name: { value: "" },
                        documented: { value: "" },
                        undocumentedField: { value: "" }
                    }
                });`
            );
            mkdirSync(path.join(dir, "docs", "nodes", "display"), { recursive: true });
            writeFileSync(
                path.join(dir, "docs", "nodes", "display", "ui-drift.md"),
                [
                    "# ui-drift",
                    "## Felder",
                    "",
                    "| Feld | Label | Editor-Typ | Pflicht | Beschreibung |",
                    "|---|---|---|---|---|",
                    "| `name` | x | y | nein | z |",
                    "| `documented` | x | y | nein | z |",
                    "",
                ].join("\n")
            );
            // Run the script with ROOT pointed at the fixture (it resolves ROOT from
            // its own dir, so copy it next to the fixture's scripts/).
            mkdirSync(path.join(dir, "scripts"), { recursive: true });
            cpSync(SCRIPT, path.join(dir, "scripts", "check-specs.js"));

            let exitCode = 0;
            let output = "";
            try {
                execFileSync(process.execPath, [path.join(dir, "scripts", "check-specs.js")], {
                    cwd: dir,
                    stdio: "pipe",
                });
            } catch (e: any) {
                exitCode = e.status;
                output = String(e.stderr ?? "") + String(e.stdout ?? "");
            }
            expect(exitCode).toBe(1);
            expect(output).toContain("undocumentedField");
            expect(output).toContain("ui-drift");
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});

import { execFileSync } from "node:child_process";
import path from "node:path";

import { describe, it, expect } from "vitest";

// The check script is plain CommonJS; require it for the pure-function assertions
// and invoke it as a child process for the end-to-end (exit-code) proof. Modelled
// on scripts/check-specs.test.ts — the core logic (`analyzeNodes`) is a pure
// function over an in-memory node list, so the pass/fail/exclusion/allowlist cases
// need no real tree and no shelling out.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const check = require("./check-roundtrip.js");

const ROOT = path.resolve(__dirname, "..");
const SCRIPT = path.join(ROOT, "scripts", "check-roundtrip.js");

// A node .html declaring a `store` reference picker (installReferenceSelectors)
// whose carrier is a real `defaults` key — the canonical qualifying shape.
const STORE_PICKER_HTML = `
    common.registerNodeType("ui-x", {
        defaults: {
            name: { value: "" },
            parent: { value: "", required: true },
            store: { value: "" }
        },
        oneditprepare: function () {
            common.installReferenceSelectors({ store: "#node-input-store" }).call(this);
        }
    });
`;

// A node .html declaring ONLY the ubiquitous parent/mount placement picker —
// deliberately NOT a qualifying field.
const MOUNT_ONLY_HTML = `
    common.registerNodeType("ui-y", {
        defaults: { name: { value: "" }, mount: { value: "" } },
        oneditprepare: function () {
            common.installReferenceSelectors({ mount: true }).call(this);
        }
    });
`;

// A node .html declaring an editableList carrier (`props` lives on a hidden
// `#node-input-props` input; the widget is `#node-input-props-list`).
const EDITABLE_LIST_HTML = `
    common.registerNodeType("ui-z", {
        defaults: { name: { value: "" }, mount: { value: "" }, props: { value: "" } },
        oneditprepare: function () {
            $("#node-input-props-list").editableList({ addItem: function () {} });
        }
    });
`;

// A catalogue that registers a round-trip test naming the `store` field, in the
// exact P215 marker format (a "…open→save round-trip" heading + a row naming the
// field in a code span).
const CATALOGUE_WITH_ROUNDTRIP = [
    "# ui-x — test catalogue",
    "",
    "## E2E — Editor open→save round-trip (`tests/e2e/nodes/state/ui-x.roundtrip.spec.ts`)",
    "",
    "| Test | Ziel |",
    "|---|---|",
    "| `store` open→Done Round-Trip | picker seeded on open, survives Done, value-change persists |",
    "",
].join("\n");

const CATALOGUE_WITHOUT_ROUNDTRIP = [
    "# ui-x — test catalogue",
    "",
    "## E2E — renders correctly",
    "",
    "| Test | Ziel |",
    "|---|---|",
    "| deploys | the node deploys and renders |",
    "",
].join("\n");

describe("check-roundtrip coverage tripwire", () => {
    it("is GREEN on the real tree (every qualifying node has a round-trip test or an allowlist entry)", () => {
        const { errors, checked } = check.checkRoundtrip();
        expect(errors).toEqual([]);
        expect(checked).toBeGreaterThan(0);
    });

    it("exits 0 when run as the CI tripwire", () => {
        expect(() => execFileSync(process.execPath, [SCRIPT], { cwd: ROOT })).not.toThrow();
    });

    it("enumerates a non-parent/mount reference picker as a qualifying field", () => {
        const fields = check.qualifyingFields(STORE_PICKER_HTML);
        expect(fields).toEqual([{ field: "store", kind: "picker" }]);
    });

    it("does NOT flag a parent/mount-only placement picker", () => {
        expect(check.qualifyingFields(MOUNT_ONLY_HTML)).toEqual([]);
        const { errors, checked } = check.analyzeNodes(
            [{ type: "ui-y", htmlSrc: MOUNT_ONLY_HTML, catalogueMd: "", cataloguePath: null }],
            {}
        );
        expect(errors).toEqual([]);
        expect(checked).toBe(0); // no qualifying field → not even checked
    });

    it("enumerates an editableList carrier field (list widget maps to its hidden carrier)", () => {
        expect(check.qualifyingFields(EDITABLE_LIST_HTML)).toEqual([
            { field: "props", kind: "editableList" },
        ]);
    });

    it("PASSES a qualifying node that registers a round-trip test in its catalogue", () => {
        const { errors, checked } = check.analyzeNodes(
            [
                {
                    type: "ui-x",
                    htmlSrc: STORE_PICKER_HTML,
                    catalogueMd: CATALOGUE_WITH_ROUNDTRIP,
                    cataloguePath: "tests/e2e/nodes/state/ui-x.tests.md",
                },
            ],
            {}
        );
        expect(errors).toEqual([]);
        expect(checked).toBe(1);
    });

    it("FAILS a qualifying node with neither a round-trip test nor an allowlist entry", () => {
        const { errors } = check.analyzeNodes(
            [
                {
                    type: "ui-x",
                    htmlSrc: STORE_PICKER_HTML,
                    catalogueMd: CATALOGUE_WITHOUT_ROUNDTRIP,
                    cataloguePath: "tests/e2e/nodes/state/ui-x.tests.md",
                },
            ],
            {}
        );
        expect(errors.length).toBe(1);
        expect(errors[0]).toContain("ui-x");
        expect(errors[0]).toContain("store");
    });

    it("PASSES an allowlisted qualifying node even without a round-trip test", () => {
        const { errors, allowlisted } = check.analyzeNodes(
            [
                {
                    type: "ui-x",
                    htmlSrc: STORE_PICKER_HTML,
                    catalogueMd: CATALOGUE_WITHOUT_ROUNDTRIP,
                    cataloguePath: "tests/e2e/nodes/state/ui-x.tests.md",
                },
            ],
            { "ui-x": { store: "backlog: not written yet" } }
        );
        expect(errors).toEqual([]);
        expect(allowlisted).toBe(1);
    });

    it("detects the round-trip field marker from the P215 catalogue format", () => {
        const covered = check.roundtripFields(CATALOGUE_WITH_ROUNDTRIP);
        expect(covered.has("store")).toBe(true);
        expect(check.roundtripFields(CATALOGUE_WITHOUT_ROUNDTRIP).has("store")).toBe(false);
    });
});

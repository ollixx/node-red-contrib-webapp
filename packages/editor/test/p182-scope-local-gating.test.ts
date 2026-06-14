import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

/**
 * P182 — the scope-local binding kinds (item/index from a ui-repeat, prop from a
 * ui-component-definition) are CONTEXT-GATED. This pins the two pure scope
 * helpers used to decide the gate:
 *
 *   - `mountIsInsideRepeat(mount, references)`         (P165, pre-existing)
 *   - `mountIsInsideComponentDef(mount, references)`   (P182, new analogue)
 *
 * Both walk the container chain upward and consult `RED.nodes.node(id).type` for
 * each ancestor. We stub a minimal `RED.nodes` + a `references` graph and assert
 * the transitive containment decisions.
 */

interface ContainerRef {
    id: string;
    mount: string;
}

interface References {
    containers: ContainerRef[];
}

interface EditorCommon {
    mountIsInsideRepeat: (mount: string, references: References) => boolean;
    mountIsInsideComponentDef: (mount: string, references: References) => boolean;
}

let common: EditorCommon;
// Node id → node type, consulted by the helpers via RED.nodes.node(id).type.
const nodeTypes: Record<string, string> = {};

beforeAll(() => {
    const editorCommonPath = fileURLToPath(
        new URL("../../../resources/lib/editor-common.js", import.meta.url)
    );
    const source = readFileSync(editorCommonPath, "utf8");
    const sandbox: Record<string, unknown> = {};
    sandbox.window = sandbox;
    // Minimal RED stub: only RED.nodes.node(id).type is used by the helpers.
    sandbox.RED = {
        nodes: {
            node: (id: string) => (nodeTypes[id] ? { type: nodeTypes[id] } : null)
        }
    };
    createContext(sandbox);
    runInContext(source, sandbox);
    common = sandbox.WebappEditorCommon as EditorCommon;
});

describe("P182: mountIsInsideRepeat", () => {
    it("is true for a direct child of a ui-repeat container", () => {
        nodeTypes.rep = "ui-repeat";
        const refs: References = { containers: [{ id: "rep", mount: "route:/x/content" }] };
        expect(common.mountIsInsideRepeat("container:rep/content", refs)).toBe(true);
    });

    it("is true transitively (container nested inside a repeat)", () => {
        nodeTypes.rep = "ui-repeat";
        nodeTypes.inner = "ui-container";
        const refs: References = {
            containers: [
                { id: "rep", mount: "route:/x/content" },
                { id: "inner", mount: "container:rep/content" }
            ]
        };
        expect(common.mountIsInsideRepeat("container:inner/content", refs)).toBe(true);
    });

    it("is false for a node mounted directly in a route slot", () => {
        const refs: References = { containers: [] };
        expect(common.mountIsInsideRepeat("route:/x/content", refs)).toBe(false);
    });

    it("is false for an empty mount", () => {
        expect(common.mountIsInsideRepeat("", { containers: [] })).toBe(false);
    });
});

describe("P182: mountIsInsideComponentDef", () => {
    it("is true for a direct `def:` mount head", () => {
        const refs: References = { containers: [] };
        expect(common.mountIsInsideComponentDef("def:cmp1/content", refs)).toBe(true);
    });

    it("is true transitively — a plain container nested inside a definition", () => {
        // The off-canvas component-definition surfaces a container whose own mount
        // is the `def:` head; its child container mounts via `container:`.
        nodeTypes.cmpDef = "ui-component-definition";
        nodeTypes.box = "ui-container";
        const refs: References = {
            containers: [
                // The definition's synthetic container: its mount is the def head.
                { id: "cmpDef", mount: "def:cmpDef/content" },
                { id: "box", mount: "container:cmpDef/content" }
            ]
        };
        expect(common.mountIsInsideComponentDef("container:box/content", refs)).toBe(true);
    });

    it("is true when an ancestor container node IS a ui-component-definition", () => {
        // Even without a def: head recorded on the ref mount, an ancestor whose
        // node type is ui-component-definition closes the gate.
        nodeTypes.cmpDef2 = "ui-component-definition";
        const refs: References = {
            containers: [{ id: "cmpDef2", mount: "" }]
        };
        // A child mounting via container:<defId>/content resolves the ancestor by
        // node type (its ref mount is empty / off-canvas).
        expect(common.mountIsInsideComponentDef("container:cmpDef2/content", refs)).toBe(true);
    });

    it("is false for a node mounted in a normal route/container chain", () => {
        nodeTypes.plain = "ui-container";
        const refs: References = {
            containers: [{ id: "plain", mount: "route:/x/content" }]
        };
        expect(common.mountIsInsideComponentDef("container:plain/content", refs)).toBe(false);
    });

    it("is false for a node inside a ui-repeat (a repeat is NOT a component def)", () => {
        nodeTypes.rep2 = "ui-repeat";
        const refs: References = { containers: [{ id: "rep2", mount: "route:/x/content" }] };
        expect(common.mountIsInsideComponentDef("container:rep2/content", refs)).toBe(false);
    });

    it("is false for an empty mount", () => {
        expect(common.mountIsInsideComponentDef("", { containers: [] })).toBe(false);
    });
});

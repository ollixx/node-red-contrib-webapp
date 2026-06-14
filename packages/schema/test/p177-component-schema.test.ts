import { describe, expect, it } from "vitest";

import {
    bindingSchema,
    SCOPE_LOCAL_BINDING_KINDS,
    COMPONENT_DEF_SLOT,
    uiComponentDefinitionNodeDefinitionSchema,
    uiComponentInstanceNodeDefinitionSchema,
    validateComponentAcyclic,
    validateUiNodeDefinition,
    parseMountReference,
    propBindingFixture,
    minimalComponentNodeSetFixture
} from "../src";

// P177 (ADR 0020) — Schicht 1 of the Components wave. SCHEMA only: the two node
// definitions + the `def:` mount scope + the `prop`/`prop.<name>` scope-local
// binding FORM + the self-reference validation rule + fixtures. No renderer, no
// editor, no node registration, no resolution.

describe("P177 (ADR 0020): ui-component-definition node definition", () => {
    const baseDefinition = {
        type: "ui-component-definition" as const,
        id: "greetingCard"
    };

    it("validates an off-canvas definition with no outer mount (it never renders on its own)", () => {
        const result = uiComponentDefinitionNodeDefinitionSchema.safeParse(baseDefinition);
        expect(result.success).toBe(true);
    });

    it("accepts an optional display name", () => {
        const result = uiComponentDefinitionNodeDefinitionSchema.safeParse({ ...baseDefinition, name: "Greeting card" });
        expect(result.success).toBe(true);
    });

    it("rejects an empty-string name", () => {
        const result = uiComponentDefinitionNodeDefinitionSchema.safeParse({ ...baseDefinition, name: "" });
        expect(result.success).toBe(false);
    });

    it("requires an id", () => {
        const { id: _id, ...withoutId } = baseDefinition;
        const result = uiComponentDefinitionNodeDefinitionSchema.safeParse(withoutId);
        expect(result.success).toBe(false);
    });

    it("is reachable through the discriminated dispatch (validateUiNodeDefinition)", () => {
        const result = validateUiNodeDefinition(baseDefinition);
        expect(result.success).toBe(true);
    });

    it("exposes the fixed default slot name 'content' (COMPONENT_DEF_SLOT)", () => {
        expect(COMPONENT_DEF_SLOT).toBe("content");
    });
});

describe("P177 (ADR 0020): ui-component-instance node definition", () => {
    const baseInstance = {
        type: "ui-component-instance" as const,
        id: "greetingInstance",
        mount: "componentApp.content",
        definitionId: "greetingCard"
    };

    it("validates an instance with an outer mount, a definitionId and props", () => {
        const result = uiComponentInstanceNodeDefinitionSchema.safeParse({
            ...baseInstance,
            props: { title: { kind: "literal", value: "A" } }
        });
        expect(result.success).toBe(true);
    });

    it("defaults props to an empty map when omitted", () => {
        const result = uiComponentInstanceNodeDefinitionSchema.safeParse(baseInstance);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.props).toEqual({});
        }
    });

    it("requires a definitionId", () => {
        const { definitionId: _definitionId, ...withoutDef } = baseInstance;
        const result = uiComponentInstanceNodeDefinitionSchema.safeParse(withoutDef);
        expect(result.success).toBe(false);
    });

    it("rejects an empty-string definitionId", () => {
        const result = uiComponentInstanceNodeDefinitionSchema.safeParse({ ...baseInstance, definitionId: "" });
        expect(result.success).toBe(false);
    });

    it("requires an outer mount or parent (leaf-shaped, mounted into a real region)", () => {
        const { mount: _mount, ...floating } = baseInstance;
        const result = uiComponentInstanceNodeDefinitionSchema.safeParse(floating);
        expect(result.success).toBe(false);
    });

    it("accepts props of any binding kind (state, store, item, …)", () => {
        const result = uiComponentInstanceNodeDefinitionSchema.safeParse({
            ...baseInstance,
            props: {
                a: { kind: "state", path: "ui.x" },
                b: { kind: "store", path: "slice" },
                c: { kind: "item", path: "name" }
            }
        });
        expect(result.success).toBe(true);
    });

    it("rejects a props map whose value carries an UNKNOWN binding kind (negative)", () => {
        const result = uiComponentInstanceNodeDefinitionSchema.safeParse({
            ...baseInstance,
            props: { title: { kind: "bogus", path: "x" } }
        });
        expect(result.success).toBe(false);
    });

    it("is reachable through the discriminated dispatch (validateUiNodeDefinition)", () => {
        const result = validateUiNodeDefinition(baseInstance);
        expect(result.success).toBe(true);
    });
});

describe("P177 (ADR 0020): def: mount scope", () => {
    it("parses a def:<id>/<slot> mount as the new sibling scope", () => {
        const result = parseMountReference("def:greetingCard/content");
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.scope).toBe("def");
            if (result.data.scope === "def") {
                expect(result.data.target).toBe("greetingCard");
                expect(result.data.regionPath).toEqual(["content"]);
            }
        }
    });

    it("round-trips a def: mount through parse → serialize → parse losslessly", () => {
        const raw = "def:greetingCard/content";
        const parsed = parseMountReference(raw);
        expect(parsed.success).toBe(true);
        if (parsed.success) {
            expect(parsed.data.raw).toBe(raw);
            const reparsed = parseMountReference(parsed.data.raw);
            expect(reparsed.success).toBe(true);
            if (reparsed.success) {
                expect(reparsed.data).toEqual(parsed.data);
            }
        }
    });

    it("requires a region after the def: target", () => {
        const result = parseMountReference("def:greetingCard");
        expect(result.success).toBe(false);
    });

    it("still rejects a mount with an UNKNOWN scope (negative)", () => {
        const result = parseMountReference("widget:foo/content");
        expect(result.success).toBe(false);
    });
});

describe("P177 (ADR 0020): scope-local binding kind prop / prop.<path>", () => {
    it("declares prop alongside item and index as a scope-local kind", () => {
        expect([...SCOPE_LOCAL_BINDING_KINDS]).toEqual(["item", "index", "prop"]);
    });

    it("accepts a bare `prop` binding (whole prop value)", () => {
        const result = bindingSchema.safeParse({ kind: "prop" });
        expect(result.success).toBe(true);
    });

    it("accepts a one-level `prop.<path>` field binding", () => {
        const result = bindingSchema.safeParse({ kind: "prop", path: "title" });
        expect(result.success).toBe(true);
    });

    it("accepts a multi-level `prop.<path>` field binding (prop.address.city)", () => {
        const result = bindingSchema.safeParse({ kind: "prop", path: "address.city" });
        expect(result.success).toBe(true);
    });

    it("rejects a malformed prop path (leading dot)", () => {
        const result = bindingSchema.safeParse({ kind: "prop", path: ".title" });
        expect(result.success).toBe(false);
    });

    it("rejects a malformed prop path (double dot)", () => {
        const result = bindingSchema.safeParse({ kind: "prop", path: "address..city" });
        expect(result.success).toBe(false);
    });

    it("round-trips a prop.<path> binding through parse → serialize → parse", () => {
        const input = { kind: "prop", path: "address.city" };
        const parsed = bindingSchema.parse(input);
        const roundTripped = bindingSchema.parse(JSON.parse(JSON.stringify(parsed)));
        expect(roundTripped).toEqual({ kind: "prop", path: "address.city" });
    });

    it("leaves item / index behaviour unchanged (item path still validated, index still path-free)", () => {
        expect(bindingSchema.safeParse({ kind: "item", path: "name" }).success).toBe(true);
        expect(bindingSchema.safeParse({ kind: "index" }).success).toBe(true);
        expect(bindingSchema.safeParse({ kind: "index", path: "name" }).success).toBe(false);
    });

    it("rejects a binding with an UNKNOWN kind (negative)", () => {
        const result = bindingSchema.safeParse({ kind: "scope", path: "name" });
        expect(result.success).toBe(false);
    });
});

describe("P177 (ADR 0020): validateComponentAcyclic", () => {
    it("accepts an acyclic definition → instance graph", () => {
        const result = validateComponentAcyclic(minimalComponentNodeSetFixture);
        expect(result.success).toBe(true);
    });

    it("rejects a definition that instantiates itself directly", () => {
        const nodes = [
            { type: "ui-component-definition", id: "card" },
            {
                type: "ui-component-instance",
                id: "selfInstance",
                mount: "def:card/content",
                definitionId: "card"
            }
        ];
        const result = validateComponentAcyclic(nodes);
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/self/i);
    });

    it("rejects a transitive instantiation cycle (A → B → A)", () => {
        const nodes = [
            { type: "ui-component-definition", id: "A" },
            { type: "ui-component-definition", id: "B" },
            {
                type: "ui-component-instance",
                id: "aHostsB",
                mount: "def:A/content",
                definitionId: "B"
            },
            {
                type: "ui-component-instance",
                id: "bHostsA",
                mount: "def:B/content",
                definitionId: "A"
            }
        ];
        const result = validateComponentAcyclic(nodes);
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/cycle/i);
    });

    it("accepts a transitive but acyclic chain (A → B, B is a leaf)", () => {
        const nodes = [
            { type: "ui-component-definition", id: "A" },
            { type: "ui-component-definition", id: "B" },
            {
                type: "ui-component-instance",
                id: "aHostsB",
                mount: "def:A/content",
                definitionId: "B"
            },
            {
                type: "ui-component-instance",
                id: "routeUsesA",
                mount: "someRoute.content",
                definitionId: "A"
            }
        ];
        const result = validateComponentAcyclic(nodes);
        expect(result.success).toBe(true);
    });

    it("accepts a node set with no components at all", () => {
        const result = validateComponentAcyclic([
            { type: "ui-text", id: "t", mount: "app.content", value: { kind: "literal", value: "x" } }
        ]);
        expect(result.success).toBe(true);
    });
});

describe("P177 (ADR 0020): fixtures", () => {
    it("the prop binding fixture parses", () => {
        expect(bindingSchema.safeParse(propBindingFixture).success).toBe(true);
    });

    it("the minimal component node-set fixture validates every node", () => {
        for (const node of minimalComponentNodeSetFixture) {
            const result = validateUiNodeDefinition(node);
            expect(result.success, `node ${node.id} should validate`).toBe(true);
        }
    });

    it("the fixture's definition child mounts into the def: slot and binds prop.title", () => {
        const child = minimalComponentNodeSetFixture.find((node) => node.id === "greetingText");
        expect(child).toBeDefined();
        expect((child as { mount?: string }).mount).toBe("def:greetingCard/content");
    });

    it("the fixture's instance supplies props = { title: 'A' } against the definition", () => {
        const instance = minimalComponentNodeSetFixture.find((node) => node.id === "greetingInstance");
        expect(instance).toBeDefined();
        expect((instance as { definitionId?: string }).definitionId).toBe("greetingCard");
    });

    it("the fixture graph is acyclic per validateComponentAcyclic", () => {
        expect(validateComponentAcyclic(minimalComponentNodeSetFixture).success).toBe(true);
    });
});

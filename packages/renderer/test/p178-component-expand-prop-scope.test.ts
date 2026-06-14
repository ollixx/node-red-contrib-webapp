import { beforeEach, describe, expect, it } from "vitest";

import type { AppModel, BindingDefinition, ComponentDefinition, RuntimeIntegrationModel } from "@node-red-contrib-webapp/schema";

import {
    __resetReactiveCache,
    createRendererApp,
    type RenderedComponent,
    type RenderedTextComponent
} from "../src";

/**
 * P178 (ADR 0020) — renderer half of `ui-component`: `expandComponent` (resolve the
 * instance's props → a `propScope` frame → render the `def:<id>/content` subtree →
 * re-id `<instanceId>#<innerNodeId>` → flatten into the host region), the `prop` /
 * `prop.<path>` scope-local binding kind, nested instances + a self-reference guard,
 * and the definition-never-renders-on-its-own rule.
 *
 * These snapshot tests ARE the acceptance for the phase (`verify: unit`); the browser
 * proof of the full flow is P179. The whole package is modelled 1:1 on `expandRepeat`
 * (P164) — these tests mirror p164-repeat-template-clone.test.ts.
 */

beforeEach(() => {
    __resetReactiveCache();
});

const NO_INTEGRATION: RuntimeIntegrationModel = { stores: [], queries: [], actions: [], navigations: [] };

/** A definition node (off-canvas template container). */
function definition(id: string): ComponentDefinition {
    return { id, kind: "component-definition", mount: `def:${id}`, order: 0, bind: {}, props: {}, events: [] };
}

/** A `ui-text` child mounted into a definition's `def:<defId>/content` slot. */
function defChild(id: string, defId: string, value: BindingDefinition, order = 0): ComponentDefinition {
    return { id, kind: "text", mount: `def:${defId}/content`, order, bind: { value }, props: {}, events: [] };
}

/** A `ui-component-instance` mounted into a real region, with prop bindings. */
function instance(
    id: string,
    definitionId: string,
    props: Record<string, BindingDefinition>,
    mount = "route:/home/content",
    order = 0
): ComponentDefinition {
    return { id, kind: "component-instance", mount, order, bind: props, props: { definitionId }, events: [] };
}

/** Assemble a one-route app from an explicit component list. */
function app(components: ComponentDefinition[], state?: Record<string, unknown>): ReturnType<typeof createRendererApp> {
    const model: AppModel = {
        id: "app",
        name: "App",
        layouts: [{ id: "main", slots: [{ name: "content" }] }],
        routes: [{ id: "home", path: "/home", layoutId: "main" }],
        dialogs: [],
        components
    };
    return createRendererApp(model, { integration: NO_INTEGRATION, state });
}

function contentComponents(rendered: ReturnType<typeof createRendererApp>): RenderedComponent[] {
    const region = rendered.render().regions.find((candidate) => candidate.name === "content");
    return region ? region.components : [];
}

function texts(rendered: ReturnType<typeof createRendererApp>): string[] {
    return contentComponents(rendered)
        .filter((component): component is RenderedTextComponent => component.kind === "text")
        .map((component) => component.text);
}

function ids(rendered: ReturnType<typeof createRendererApp>): string[] {
    return contentComponents(rendered).map((component) => component.id);
}

describe("P178 — instance renders the definition subtree at its mount", () => {
    it("an instance with props={title:'A'} renders the def subtree with prop.title resolved", () => {
        const rendered = app([
            definition("greetingCard"),
            defChild("greetingText", "greetingCard", { kind: "prop", path: "title" }),
            instance("inst", "greetingCard", { title: { kind: "literal", value: "A" } })
        ]);

        expect(texts(rendered)).toEqual(["A"]);
    });

    it("the cloned node carries the composed id <instanceId>#<innerNodeId>", () => {
        const rendered = app([
            definition("greetingCard"),
            defChild("greetingText", "greetingCard", { kind: "prop", path: "title" }),
            instance("inst", "greetingCard", { title: { kind: "literal", value: "A" } })
        ]);

        expect(ids(rendered)).toEqual(["inst#greetingText"]);
    });
});

describe("P178 — two instances of the same definition resolve prop per instance", () => {
    it("renders different prop values and unique stable ids", () => {
        const rendered = app([
            definition("greetingCard"),
            defChild("greetingText", "greetingCard", { kind: "prop", path: "title" }),
            instance("a", "greetingCard", { title: { kind: "literal", value: "Alpha" } }, "route:/home/content", 0),
            instance("b", "greetingCard", { title: { kind: "literal", value: "Beta" } }, "route:/home/content", 1)
        ]);

        expect(texts(rendered)).toEqual(["Alpha", "Beta"]);
        expect(ids(rendered)).toEqual(["a#greetingText", "b#greetingText"]);
    });
});

describe("P178 — prop path resolution", () => {
    it("prop.<path> resolves a multi-level field of an object prop", () => {
        const rendered = app([
            definition("card"),
            defChild("name", "card", { kind: "prop", path: "user.name" }),
            instance("inst", "card", {
                user: { kind: "literal", value: { name: "Ada", age: 36 } }
            })
        ]);

        expect(texts(rendered)).toEqual(["Ada"]);
    });

    it("prop (bare path = prop name) yields the whole prop value", () => {
        const rendered = app([
            definition("card"),
            defChild("whole", "card", { kind: "prop", path: "title" }),
            instance("inst", "card", { title: { kind: "literal", value: "Whole" } })
        ]);

        expect(texts(rendered)).toEqual(["Whole"]);
    });

    it("prop outside any component instance → undefined (no crash; fallback applies, like item)", () => {
        // A plain text bound to `prop.title` mounted DIRECTLY into the route — no
        // enclosing instance, so the prop scope stack is empty.
        const rendered = app([
            {
                id: "orphan",
                kind: "text",
                mount: "route:/home/content",
                order: 0,
                bind: { value: { kind: "prop", path: "title", fallback: "FALLBACK" } },
                props: {},
                events: []
            }
        ]);

        // Resolves to the fallback (the binding's own fallback) — defined "no value",
        // never a throw.
        expect(texts(rendered)).toEqual(["FALLBACK"]);
    });

    it("prop outside any instance with no fallback → normalized empty/'?' but no crash", () => {
        const rendered = app([
            {
                id: "orphan",
                kind: "text",
                mount: "route:/home/content",
                order: 0,
                bind: { value: { kind: "prop", path: "title" } },
                props: {},
                events: []
            }
        ]);

        // No throw; the orphan still renders (a single text component).
        expect(contentComponents(rendered)).toHaveLength(1);
    });
});

describe("P178 — a definition never renders on its own", () => {
    it("a definition with children but no instance emits nothing into any real region", () => {
        const rendered = app([
            definition("lonelyCard"),
            defChild("lonelyText", "lonelyCard", { kind: "literal", value: "should not show" })
        ]);

        expect(contentComponents(rendered)).toHaveLength(0);
    });
});

describe("P178 — nested instances expand recursively", () => {
    it("an instance whose definition contains another instance expands both, each prop against its own frame", () => {
        const rendered = app([
            // Outer definition: contains a text bound to prop.heading AND an inner instance.
            definition("outer"),
            defChild("outerHeading", "outer", { kind: "prop", path: "heading" }, 0),
            {
                id: "innerInst",
                kind: "component-instance",
                mount: "def:outer/content",
                order: 1,
                bind: { label: { kind: "prop", path: "heading" } },
                props: { definitionId: "inner" },
                events: []
            },
            // Inner definition: a text bound to prop.label.
            definition("inner"),
            defChild("innerLabel", "inner", { kind: "prop", path: "label" }),
            // The outer instance supplies heading="Top".
            instance("top", "outer", { heading: { kind: "literal", value: "Top" } })
        ]);

        // Outer heading = "Top"; inner instance's `label` prop binds to the OUTER
        // frame's `prop.heading` ("Top"), so the inner text also shows "Top".
        expect(texts(rendered)).toEqual(["Top", "Top"]);
        expect(ids(rendered)).toEqual(["top#outerHeading", "top#innerInst#innerLabel"]);
    });
});

describe("P178 — self-reference guard (no hang)", () => {
    it("a definition that instantiates itself directly terminates (no infinite expansion)", () => {
        const rendered = app([
            definition("recur"),
            defChild("recurText", "recur", { kind: "literal", value: "once" }, 0),
            {
                // Self-reference: an instance of `recur` INSIDE `recur`.
                id: "selfInst",
                kind: "component-instance",
                mount: "def:recur/content",
                order: 1,
                bind: {},
                props: { definitionId: "recur" },
                events: []
            },
            instance("root", "recur", {})
        ]);

        // One level expands ("once"); the self-instance is cut by the guard — the
        // render terminates with the single text, no hang, no stack overflow.
        expect(texts(rendered)).toEqual(["once"]);
    });

    it("a transitive self-reference (A→B→A) terminates", () => {
        const rendered = app([
            definition("A"),
            defChild("aText", "A", { kind: "literal", value: "a" }, 0),
            {
                id: "aToB",
                kind: "component-instance",
                mount: "def:A/content",
                order: 1,
                bind: {},
                props: { definitionId: "B" },
                events: []
            },
            definition("B"),
            defChild("bText", "B", { kind: "literal", value: "b" }, 0),
            {
                id: "bToA",
                kind: "component-instance",
                mount: "def:B/content",
                order: 1,
                bind: {},
                props: { definitionId: "A" },
                events: []
            },
            instance("root", "A", {})
        ]);

        // A renders "a", then B renders "b", then B's instance of A is cut (A already
        // on the path). Terminates — no hang.
        expect(texts(rendered)).toEqual(["a", "b"]);
    });
});

describe("P178 — reactive prop (store/state) change → fresh snapshot", () => {
    it("a prop bound to state re-resolves on the next render after a state change", () => {
        const rendered = app(
            [
                definition("card"),
                defChild("cardText", "card", { kind: "prop", path: "title" }),
                instance("inst", "card", { title: { kind: "state", path: "headline" } })
            ],
            { headline: "First" }
        );

        expect(texts(rendered)).toEqual(["First"]);

        // Replace state (a reactive store/state change) and re-render: the prop
        // re-resolves against the fresh state, so every affected instance updates.
        rendered.replaceState({ headline: "Second" });

        expect(texts(rendered)).toEqual(["Second"]);
    });

    it("a dangling definitionId renders nothing (no crash)", () => {
        const rendered = app([instance("inst", "missingDef", { title: { kind: "literal", value: "x" } })]);

        expect(contentComponents(rendered)).toHaveLength(0);
    });
});

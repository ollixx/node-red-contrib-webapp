import { z } from "zod";

import {
    actionParamListSchema,
    actionToTypeSchema,
    actionTypeSchema,
    navigateTargetModeSchema,
    BUTTON_LINK_MODES,
    BUTTON_VARIANTS,
    bindingSchema,
    COMPONENT_SIZES,
    CONTAINER_VARIANTS,
    errorSeveritySchema,
    iconFieldSchema,
    identifierSchema,
    INPUT_VARIANTS,
    routeNodePathSchema,
    SEVERITY_VARIANTS,
    TEXT_COLOR_VARIANTS,
    TEXT_DISPLAY_MODES,
    TEXT_STYLES,
    writeToBindingSchema,
    writeTriggerSchema
} from "./contracts";
import { standardLayoutPresetIds } from "./layout-presets";
import { formatValidationIssues } from "./validation";

const standardLayoutPresetSchema = z.enum(standardLayoutPresetIds);

// P71: three-step size token (sm/md/lg) for nodes backed by a natively-sized
// Shoelace element. ui-avatar / ui-badge / ui-icon keep their own xs..xl scale.
const componentSizeSchema = z.enum(COMPONENT_SIZES);

const identifiedNodeSchema = z.object({
    id: identifierSchema
});

const mountableNodeSchema = identifiedNodeSchema.extend({
    // P228 (ADR 0038): `app` is the canonical owning-app field; `parent` is the
    // legacy alias accepted for pre-rename flows (transitional union).
    app: z.string().min(1, "Component app references must not be empty.").optional(),
    parent: z.string().min(1, "Component parent paths must not be empty.").optional(),
    mount: z.string().min(1, "Component mounts must not be empty.").optional(),
    order: z.number().int("Component order must be an integer.").optional(),
    row: z.number().int("Grid rows are 1-based — row must be a positive integer.").positive("Grid rows are 1-based — row must be a positive integer.").optional(),
    col: z.number().int("Grid columns are 1-based — col must be a positive integer.").positive("Grid columns are 1-based — col must be a positive integer.").optional(),
    colSize: z.number().int("Grid column spans must be positive integers.").positive("Grid column spans must be positive integers.").optional(),
    rowSize: z.number().int("Grid row spans must be positive integers.").positive("Grid row spans must be positive integers.").optional(),
    layoutX: z.number().int("Component x coordinates must be integers.").optional(),
    layoutY: z.number().int("Component y coordinates must be integers.").optional()
}).superRefine((node, context) => {
    if (!node.mount && !node.app && !node.parent) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Component nodes must declare either a mount or a parent path.",
            path: ["mount"]
        });
    }
});

// ── P231 (ADR 0015 §1 / ADR 0037): the common BASE FIELDS mixin ──────────────
//
// P139/P172/P222 rolled the editor controls (`visible`/`disabled`/`color`) out
// across every view node, but the SCHEMAS declared them almost nowhere — so Zod
// STRIPPED them at validation and they never reached the runtime. The result:
// `visible`/`disabled`/`color` were inert on ~29 nodes even though the editor and
// docs offer them (P231 finding, exposed by the P230 ui-divider pilot). This
// shared mixin declares the three as OPTIONAL value-bindings ONCE; every
// applicable mountable view node mixes it in by SPREADING it as the first entry
// of its `mountableNodeSchema.extend({ ...baseFieldsSchema, … })` shape, so a
// deployed binding is PRESERVED (not stripped) and flows through mapConfig into
// `visibleIf` / `bind.disabled` / `bind.color`.
//
// The spread is applied FIRST inside the SAME object literal, so a node that
// already declares one of these with node-specific semantics — e.g.
// ui-empty-state's REQUIRED `visible`, the input nodes' `disabled` — overrides it
// with its own later key in that literal (JS last-key-wins). NOTE (P238/ADR 0039
// §4): ui-icon USED to override `color` with a plain `z.string()`, which silently
// downgraded a base field to a non-bindable one; that override is removed and no
// node may re-introduce one — `color` is bindable everywhere it applies.
// Doing it in ONE `.extend()` (rather than chaining a second
// `.extend`) is REQUIRED under Zod v4: a chained extend that re-declares a key
// throws "Cannot overwrite keys on object schemas containing refinements"
// (`mountableNodeSchema` carries a `.superRefine`). A single merged shape only
// ADDS new keys to the refined base, which Zod allows.
//
// Per the P222 applicability table a field may be N/A on a given node (the editor
// greys it out and never emits it); the schema stays permissive-optional so
// nothing is stripped if it ever is emitted. `size` is intentionally NOT here: it
// is a static enum token (COMPONENT_SIZES / per-node scale) declared per-node
// where applicable, not a value-binding.
const baseFieldsSchema = {
    visible: bindingSchema.optional(),
    disabled: bindingSchema.optional(),
    color: bindingSchema.optional()
};

// ── P17: Design token schema ─────────────────────────────────────────────────

export const designTokensSchema = z.object({
    // Colors
    colorPrimary: z.string().optional(),
    colorPrimaryFg: z.string().optional(),
    colorDanger: z.string().optional(),
    colorDangerFg: z.string().optional(),
    colorSuccess: z.string().optional(),
    colorSuccessFg: z.string().optional(),
    colorWarning: z.string().optional(),
    colorWarningFg: z.string().optional(),
    colorNeutral: z.string().optional(),
    colorNeutralFg: z.string().optional(),
    colorBackground: z.string().optional(),
    colorSurface: z.string().optional(),
    colorBorder: z.string().optional(),
    colorText: z.string().optional(),
    colorTextMuted: z.string().optional(),
    // Typography
    fontFamily: z.string().optional(),
    fontSizeBase: z.string().optional(),
    fontWeightNormal: z.string().optional(),
    fontWeightBold: z.string().optional(),
    lineHeightBase: z.string().optional(),
    // Spacing
    spacingUnit: z.string().optional(),
    // Radii
    radiusSm: z.string().optional(),
    radiusMd: z.string().optional(),
    radiusLg: z.string().optional(),
    radiusFull: z.string().optional()
}).optional();

export type DesignTokens = z.infer<typeof designTokensSchema>;

/** Map design token field names to CSS custom property names. */
export const DESIGN_TOKEN_CSS_VARS: Record<string, string> = {
    colorPrimary:    "--wa-color-primary",
    colorPrimaryFg:  "--wa-color-primary-fg",
    colorDanger:     "--wa-color-danger",
    colorDangerFg:   "--wa-color-danger-fg",
    colorSuccess:    "--wa-color-success",
    colorSuccessFg:  "--wa-color-success-fg",
    colorWarning:    "--wa-color-warning",
    colorWarningFg:  "--wa-color-warning-fg",
    colorNeutral:    "--wa-color-neutral",
    colorNeutralFg:  "--wa-color-neutral-fg",
    colorBackground: "--wa-color-background",
    colorSurface:    "--wa-color-surface",
    colorBorder:     "--wa-color-border",
    colorText:       "--wa-color-text",
    colorTextMuted:  "--wa-color-text-muted",
    fontFamily:      "--wa-font-family",
    fontSizeBase:    "--wa-font-size-base",
    fontWeightNormal:"--wa-font-weight-normal",
    fontWeightBold:  "--wa-font-weight-bold",
    lineHeightBase:  "--wa-line-height-base",
    spacingUnit:     "--wa-spacing-unit",
    radiusSm:        "--wa-radius-sm",
    radiusMd:        "--wa-radius-md",
    radiusLg:        "--wa-radius-lg",
    radiusFull:      "--wa-radius-full"
};

/**
 * Build a CSS :root { } block from a design tokens object.
 * Returns an empty string if tokens is undefined or has no values.
 */
export function buildDesignTokenCss(tokens: DesignTokens): string {
    if (!tokens) {
        return "";
    }

    const declarations: string[] = [];

    for (const [field, cssVar] of Object.entries(DESIGN_TOKEN_CSS_VARS)) {
        const value = (tokens as Record<string, string | undefined>)[field];

        if (value !== undefined && value !== null && value !== "") {
            declarations.push(`  ${cssVar}: ${value};`);
        }
    }

    if (declarations.length === 0) {
        return "";
    }

    return `:root {\n${declarations.join("\n")}\n}`;
}

export const uiAppNodeDefinitionSchema = z.object({
    type: z.literal("ui-app"),
    id: identifierSchema,
    // P109: `name` replaces the old `title` field. `name` is the display name shown
    // in the Editor and used as the HTML <title> / app-bar heading at runtime.
    // `title` is no longer a schema field — Zod strips it silently (back-compat:
    // old configs with `title` are still accepted; mapConfig migrates title → name).
    name: z.string().optional(),
    // P109: `root` is now in the schema (it was only in mapConfig before).
    // The URL root segment for the app (e.g. "myapp" → served at /webapp/myapp/).
    root: z.string().optional(),
    layout: standardLayoutPresetSchema,
    // P66 (ADR 0007): ui-app owns the implicit root route "/", so a navigate
    // action wired to it enters/leaves the root — it emits onEnter / onLeave just
    // like a ui-route. clientConnected / clientDisconnected remain its own events.
    events: z.array(z.enum(["clientConnected", "clientDisconnected", "onEnter", "onLeave"])).optional(),
    tokens: designTokensSchema,
    // P56 / ADR 0006 §4: opt-in backend→frontend error forwarding. Absent means
    // OFF (security: anonymous httpNode visitors must not receive server
    // internals unless the app deliberately enables it). When enabled, only
    // framework errors at or above `forwardErrorMinSeverity` (default "error")
    // are forwarded over the SSE "error" channel, redacted. Optional rather than
    // .default() so existing fixtures/configs stay valid; the runtime applies the
    // secure fallbacks (false / "error") when the fields are absent.
    forwardErrorsToClient: z.boolean().optional(),
    forwardErrorMinSeverity: errorSeveritySchema.optional(),
    // P70: optional media-store base URL. When set, `ui-image` src values of the
    // form `asset:<id>` are resolved by the runtime through a Node-RED backend
    // proxy that fetches `<mediaStoreUrl>/<id>` and streams it — the real store
    // URL never reaches the client (obfuscation). Absent = no asset references.
    mediaStoreUrl: z.string().optional(),
    // P106: deploy MODE. "development" (default) auto-delivers a freshly-compiled
    // model to connected clients on every deploy (in-place via snapshot, full
    // reload only on a shell/topology change). "production" never auto-updates a
    // connected client; instead the client shows a version alert and only the
    // user's manual reload adopts the new model, so no running user state is lost.
    // The editor field is labelled status (Entwicklung / Produktion); mapConfig
    // normalises it to this enum and defaults to "development".
    mode: z.enum(["development", "production"]).optional(),
    // P260 (ADR 0041 §2): auth configuration as ONE object (a future
    // mode:"oidc" extends it without flooding the ui-app field list).
    // Defaults when absent: mode "none"; header defaults X-Forwarded-User /
    // X-Forwarded-Email / X-Forwarded-Groups; redirect none.
    // INERT until P261: configurable but NOT enforced — no runtime code reads
    // this yet (see docs/nodes/concepts/auth.md).
    auth: z
        .object({
            mode: z.enum(["none", "trusted-header"]),
            headerUser: z.string().optional(),
            headerEmail: z.string().optional(),
            headerGroups: z.string().optional(),
            redirect: z.string().optional()
        })
        .optional()
});

export type UiAppNodeDefinition = z.infer<typeof uiAppNodeDefinitionSchema>;

export const uiContainerNodeDefinitionSchema = mountableNodeSchema.extend({
    ...baseFieldsSchema,
    type: z.literal("ui-container"),
    layout: standardLayoutPresetSchema,
    // P49: true Ebene-2 variant (surface role). Default "card".
    variant: z.enum(CONTAINER_VARIANTS).optional(),
    events: z.array(z.enum(["onShow", "onHide"])).optional()
});

export type UiContainerNodeDefinition = z.infer<typeof uiContainerNodeDefinitionSchema>;

// P163 (ADR 0017): `ui-repeat` — a template CONTAINER (children allowed),
// analogous to `ui-container`. It is mountable, holds a child subtree in a
// **default slot** (the template), and is repeated n× by the renderer over the
// bound `items` collection. Unlike ui-container it carries no `layout`/`variant`
// chrome: its single slot is fixed to the standard "content" slot (REPEAT_SLOT)
// so children mount via `<type>:<id>/content` exactly like any other container.
//
//  - `items`    → REQUIRED value-binding (the collection to iterate). Resolves to
//                 an array (an object is iterated as `{key, value}` entries). The
//                 renderer (P164) does the n× expansion; here it is form-only.
//  - `keyField` → optional field name used as the stable per-instance key for the
//                 keyed morph; falls back to the array index when absent.
export const REPEAT_SLOT = "content";

export const uiRepeatNodeDefinitionSchema = mountableNodeSchema.extend({
    ...baseFieldsSchema,
    type: z.literal("ui-repeat"),
    // REQUIRED collection binding — full value-binding set (literal/state/query/
    // store/routeParam/reactive/msg/flow/global/jsonata/env). Resolution → array
    // happens in the renderer (P164), not here.
    items: bindingSchema,
    // ADR 0025: ui-repeat is TRANSPARENT — it ONLY iterates. It carries NO `layout`
    // and NO `variant`: the cloned children flatten into the host region with no
    // wrapper. Layout/chrome is the job of an explicit enclosing/inner `ui-container`
    // (which owns `layout` + `variant`). This reverses the P191/P197 direction that
    // had briefly made ui-repeat a container — that produced per-item wrapper divs
    // which broke inline composition (a repeat over ui-text could never render the
    // texts side by side). `layout`/`variant` here are intentionally gone.
    // Optional stable key field for the keyed morph (e.g. "id"). When omitted the
    // renderer keys instances by array index.
    keyField: z.string().min(1, "ui-repeat keyField must not be empty when set.").optional(),
    // P193 (ADR 0023): an optional ALIAS naming this repeat's item scope (the
    // `v-for="customer in customers"` model). When set (e.g. "customer") any
    // descendant can address THIS repeat's item by name via a scope-qualified
    // `item`/`index` binding (`{kind:"item", scope:"customer", path:"name"}`),
    // regardless of inner repeats sitting between. Empty/absent → only the generic
    // innermost item/index sugar, today's behaviour verbatim (backward compatible).
    itemName: z.string().min(1, "ui-repeat itemName must not be empty when set.").optional()
});

export type UiRepeatNodeDefinition = z.infer<typeof uiRepeatNodeDefinitionSchema>;

// ── P177 (ADR 0020): the `ui-component` definition / instance node pair ───────
//
// A **Component** is a named, parametrised, reusable set of `ui-*` nodes —
// authored once as a `ui-component-definition` and used many times as a
// `ui-component-instance` with props. This is the schema layer only: the two node
// definitions, the `def:` mount scope (validation.ts), the `prop`/`prop.<name>`
// scope-local binding kind (contracts.ts), and a self-reference validation rule.
// The render-time expansion (`expandComponent`) is P178; the node registration +
// editor + browser proof is P179. Reuses the ADR 0017 render-time-scope machinery.

// The component DEFINITION is a CONTAINER-kind node (children allowed), registered
// analogously to `ui-container`/`ui-repeat`. Its children mount into a fixed
// default slot `content` via the new `def:` scope — `def:<componentId>/content`.
// Unlike a normal container it is **off-canvas**: it carries no required outer
// mount (it never renders on its own — it exists only to be expanded by instances)
// and no `layout`/`variant` chrome. The node's own id IS its `componentId`.
export const COMPONENT_DEF_SLOT = "content";

export const uiComponentDefinitionNodeDefinitionSchema = identifiedNodeSchema.extend({
    type: z.literal("ui-component-definition"),
    // Off-canvas: no required outer mount/parent (the definition never renders on
    // its own). An optional display name for the editor/structure sidebar.
    name: z.string().min(1, "A component definition name must not be empty when set.").optional()
});

export type UiComponentDefinitionNodeDefinition = z.infer<typeof uiComponentDefinitionNodeDefinitionSchema>;

// The component INSTANCE is a LEAF-shaped node (no children of its own). It carries
// a required outer `mount`/`parent` into a real route/container (like any mounted
// node), a required `definition` reference (P259: bare name; legacy alias
// `definitionId`) to a `ui-component-definition`, and a
// `props` map (name → value-binding, any binding kind; optional/empty allowed).
// The renderer (P178) resolves each prop into a `propScope` frame and renders the
// `def:<definitionId>/content` subtree against it.
export const uiComponentInstanceNodeDefinitionSchema = mountableNodeSchema.extend({
    type: z.literal("ui-component-instance"),
    // REQUIRED reference to a `ui-component-definition` node id. Existence /
    // self-reference checks happen in `validateComponentAcyclic` and the runtime,
    // not in this per-node form check. P259 (ADR 0038): the canonical field is
    // the bare `definition`; `definitionId` is the legacy alias accepted for
    // pre-rename flows (transitional union — exactly ONE of the two must be set).
    definition: z.string().min(1, "A component instance must reference a definition.").optional(),
    definitionId: z.string().min(1, "A component instance must reference a definition.").optional(),
    // Named prop values: each is an ordinary value-binding (any binding kind).
    // Optional and may be empty. Resolution → `propScope` is P178.
    props: z.record(z.string(), bindingSchema).default({})
}).superRefine((def, ctx) => {
    if (!def.definition && !def.definitionId) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["definition"],
            message: "A component instance must reference a definition."
        });
    }
});

export type UiComponentInstanceNodeDefinition = z.infer<typeof uiComponentInstanceNodeDefinitionSchema>;

/**
 * P177 (ADR 0020): self-reference validation as a PURE function. A component
 * definition that instantiates itself — directly (an instance in its own subtree
 * references it back) or transitively (through a chain of definitions) — would
 * make `expandComponent` recurse forever. This walks the definition→instance graph
 * and rejects any cycle with a clear, path-bearing error message. An acyclic
 * definition→instance graph is valid.
 *
 * The graph is reconstructed purely from the node set: an instance's enclosing
 * definition is found by walking its `mount`/`parent` chain up to a
 * `ui-component-definition`; a `def:<id>/…` mount names the enclosing definition
 * directly. An instance whose enclosing definition cannot be determined (it lives
 * on a real route/container, the normal case) contributes no edge — only
 * definition-to-definition edges can form a cycle.
 */
export interface ComponentAcyclicResult {
    success: boolean;
    error?: string;
}

interface ComponentGraphNode {
    mount?: string;
    parent?: string;
    type?: string;
    id?: string;
    // P259 (ADR 0038): canonical `definition`; legacy `definitionId` alias.
    definition?: string;
    definitionId?: string;
}

// Extract the enclosing-definition id from a single mount/parent string, if that
// string addresses a component-definition subtree (`def:<id>/<slot>`). Returns
// undefined otherwise.
function definitionTargetOfReference(reference: string | undefined): string | undefined {
    if (!reference) {
        return undefined;
    }

    const trimmed = reference.trim();
    const scopeMatch = /^def:(.*)$/.exec(trimmed);

    if (scopeMatch) {
        // `def:<id>/<slot>` — the target id is the first `/`-segment.
        const [target] = scopeMatch[1].split("/").filter(Boolean);
        return target || undefined;
    }

    return undefined;
}

export function validateComponentAcyclic(nodes: unknown[]): ComponentAcyclicResult {
    const graphNodes = nodes.filter(
        (node): node is ComponentGraphNode => node != null && typeof node === "object"
    );

    const byId = new Map<string, ComponentGraphNode>();
    for (const node of graphNodes) {
        if (typeof node.id === "string") {
            byId.set(node.id, node);
        }
    }

    const definitionIds = new Set<string>(
        graphNodes
            .filter((node) => node.type === "ui-component-definition" && typeof node.id === "string")
            .map((node) => node.id as string)
    );

    // Resolve the enclosing component-definition id for a node by walking its
    // mount/parent chain upward until a `def:` reference (or a parent pointing at a
    // definition node) is found. Bounded by the node count to avoid runaway loops
    // on a malformed (cyclic) mount chain.
    function enclosingDefinitionId(start: ComponentGraphNode): string | undefined {
        let current: ComponentGraphNode | undefined = start;
        let hops = 0;

        while (current && hops <= graphNodes.length) {
            const fromMount = definitionTargetOfReference(current.mount);
            if (fromMount) {
                return fromMount;
            }

            const parentRef = current.parent;
            if (!parentRef) {
                return undefined;
            }

            const fromDefParent = definitionTargetOfReference(parentRef);
            if (fromDefParent) {
                return fromDefParent;
            }

            const parentNode = byId.get(parentRef);
            if (!parentNode) {
                return undefined;
            }

            if (parentNode.type === "ui-component-definition") {
                return parentNode.id;
            }

            current = parentNode;
            hops += 1;
        }

        return undefined;
    }

    // Build definition→definition edges: an instance inside definition D that
    // references definition T contributes an edge D → T.
    const edges = new Map<string, Set<string>>();
    for (const definitionId of definitionIds) {
        edges.set(definitionId, new Set());
    }

    for (const node of graphNodes) {
        // P259 (ADR 0038): canonical `definition`; legacy `definitionId` fallback.
        const definitionRef = typeof node.definition === "string" ? node.definition : node.definitionId;
        if (node.type !== "ui-component-instance" || typeof definitionRef !== "string") {
            continue;
        }

        const host = enclosingDefinitionId(node);
        if (host && definitionIds.has(host)) {
            const target = definitionRef;

            if (host === target) {
                return {
                    success: false,
                    error: `Component definition '${host}' instantiates itself (instance '${node.id ?? "?"}') — a component may not be self-referential.`
                };
            }

            edges.get(host)?.add(target);
        }
    }

    // Depth-first cycle detection over the definition→definition edges.
    const VISITING = 1;
    const DONE = 2;
    const state = new Map<string, number>();

    function findCycle(definitionId: string, stack: string[]): string[] | undefined {
        state.set(definitionId, VISITING);
        stack.push(definitionId);

        for (const next of edges.get(definitionId) ?? []) {
            const nextState = state.get(next);

            if (nextState === VISITING) {
                return [...stack.slice(stack.indexOf(next)), next];
            }

            if (nextState === undefined && definitionIds.has(next)) {
                const found = findCycle(next, stack);
                if (found) {
                    return found;
                }
            }
        }

        stack.pop();
        state.set(definitionId, DONE);
        return undefined;
    }

    for (const definitionId of definitionIds) {
        if (state.get(definitionId) === undefined) {
            const cycle = findCycle(definitionId, []);
            if (cycle) {
                return {
                    success: false,
                    error: `Component definitions form an instantiation cycle: ${cycle.join(" → ")}. A component may not instantiate itself directly or transitively.`
                };
            }
        }
    }

    return { success: true };
}

export const uiRouteNodeDefinitionSchema = identifiedNodeSchema.extend({
    type: z.literal("ui-route"),
    // P228 (ADR 0038): `app` is the canonical owning-app field; `parent` is the
    // legacy alias accepted for pre-rename flows (transitional union).
    app: identifierSchema.optional(),
    parent: identifierSchema.optional(),
    path: routeNodePathSchema,
    // P89: title is now a bindable field (literal/state/store/query/routeParam/msg/
    // flow/global/jsonata/env). A plain string is accepted as back-compat (treated as
    // a literal binding). The compiled AppModel resolves literal bindings to a plain
    // string; dynamic bindings resolve to undefined at the <title> element (server
    // render time).
    title: z.union([bindingSchema, z.string().min(1, "Route titles must not be empty.")]).optional(),
    layout: standardLayoutPresetSchema,
    events: z.array(z.enum(["onEnter", "onLeave"])).optional()
});

export type UiRouteNodeDefinition = z.infer<typeof uiRouteNodeDefinitionSchema>;

export const uiDialogNodeDefinitionSchema = identifiedNodeSchema.extend({
    type: z.literal("ui-dialog"),
    // P228 (ADR 0038): `app` is the canonical owning-app field; `parent` is the
    // legacy alias accepted for pre-rename flows (transitional union).
    app: identifierSchema.optional(),
    parent: identifierSchema.optional(),
    title: z.string().min(1, "Dialog titles must not be empty.").optional(),
    layout: standardLayoutPresetSchema,
    // P259 (ADR 0038): `route` is the canonical route reference (bare name);
    // `routeId` is the legacy alias accepted for pre-rename flows (transitional
    // union). Consumers read `route ?? routeId`.
    route: identifierSchema.optional(),
    routeId: identifierSchema.optional(),
    modal: z.boolean().default(true),
    // P64: when false the native <sl-dialog> renders with `no-header`, removing
    // the whole header (native X + title). When true (default) the dialog shows
    // the native close button and is dismissable via X / ESC / overlay click.
    closable: z.boolean().default(true),
    events: z.array(z.enum(["onOpen", "onClose"])).optional()
});

export type UiDialogNodeDefinition = z.infer<typeof uiDialogNodeDefinitionSchema>;

export const uiTextNodeDefinitionSchema = mountableNodeSchema.extend({
    ...baseFieldsSchema,
    type: z.literal("ui-text"),
    value: bindingSchema,
    // P111: `style` is the typographic ROLE (maps to an HTML element). Default
    // "body". Legacy configs that stored the role in `variant` are migrated in
    // the ui-text mapConfig before validation.
    style: z.enum(TEXT_STYLES).optional(),
    // P111: `variant` is the semantic COLOUR (aligned with ui-button/badge/alert
    // and Shoelace/Bootstrap-Vue). Default "default" (inherit). The old size
    // field (P71) was removed — typographic sizing is governed by `style`.
    variant: z.enum(TEXT_COLOR_VARIANTS).optional(),
    // P221 (ADR 0035): presentation mode. Absent / "text" (default) = the
    // historic free display text. "formField" = a read-only LABELLED form row
    // (label left / value right) styled like the input controls, so ui-text
    // lines up next to ui-input/ui-select in a form. Read-only: no editing, no
    // value emission. Optional (like `style`/`variant`) so existing flows and
    // fixtures stay valid; consumers treat absence as "text".
    display: z.enum(TEXT_DISPLAY_MODES).optional(),
    // P221 (ADR 0035): the row label used in `display: "formField"` mode (the
    // form label slot). Ignored in the default free-text mode.
    label: z.string().optional()
});

export type UiTextNodeDefinition = z.infer<typeof uiTextNodeDefinitionSchema>;

export const uiButtonNodeDefinitionSchema = mountableNodeSchema.extend({
    ...baseFieldsSchema,
    type: z.literal("ui-button"),
    // P144 (ADR 0012): label accepts the canonical value-binding set — a literal
    // string or a dynamic binding object. Back-compat: a plain string from a
    // pre-P144 flow is still accepted and treated as a literal label.
    label: z.union([bindingSchema, z.string().min(1, "Button labels must not be empty.")]),
    // P49: true Ebene-2 variant (semantic action role). Default "neutral".
    variant: z.enum(BUTTON_VARIANTS).optional(),
    // action is deprecated — click events are now emitted on the output port.
    // Kept for backward compatibility with existing flows.
    action: z.string().min(1, "Buttons must reference an action.").optional(),
    // P69: optional icon shown in the button's prefix slot. Backend-neutral
    // { library, name }; binding-capable (literal value or dynamic binding).
    icon: iconFieldSchema.optional(),
    // P71: three-step size (sm/md/lg). The adapter maps it onto Shoelace's
    // small/medium/large.
    size: componentSizeSchema.optional(),
    // P71: explicit outline flag. When true the button renders with an outlined
    // (transparent-fill) treatment, independent of the semantic variant.
    outline: z.boolean().optional(),
    // P71: link mode. "button" (default) = event source; "url" = real hyperlink
    // via href; "navigate" = emit an in-app navigate action against the href
    // route. href is binding-capable and only meaningful for url/navigate.
    linkMode: z.enum(BUTTON_LINK_MODES).optional(),
    href: bindingSchema.optional(),
    disabled: bindingSchema.optional()
});

export type UiButtonNodeDefinition = z.infer<typeof uiButtonNodeDefinitionSchema>;

export const tableColumnDefinitionSchema = z.union([
    z.string().min(1, "Table column keys must not be empty."),
    z.object({
        key: z.string().min(1, "Table column keys must not be empty."),
        label: z.string().optional(),
        type: z.enum(["text", "checkbox", "number", "date", "actions"]).optional(),
        sortable: z.boolean().optional(),
        filterable: z.boolean().optional(),
        width: z.number().int().positive().optional()
    })
]);

export type TableColumnDefinition = z.infer<typeof tableColumnDefinitionSchema>;

export const uiTableNodeDefinitionSchema = mountableNodeSchema.extend({
    ...baseFieldsSchema,
    type: z.literal("ui-table"),
    columns: z.array(tableColumnDefinitionSchema).min(1, "Tables must declare at least one column."),
    rows: bindingSchema,
    // P249: only `rowSelect` has an observable end-to-end effect (the serializer
    // renders a selectable first-cell link that POSTs a `rowSelect` event). The
    // former `rowAction`/`checkboxChange`/`cellSelect` values were inert — no DOM
    // source ever emitted them — and were removed (no documented event without
    // effect). Legacy flows carrying the dropped values are filtered in the node
    // mapConfig before they reach this schema.
    events: z.array(z.enum(["rowSelect"])).optional(),
    selectAction: z.string().min(1, "Table select actions must not be empty.").optional()
});

export type UiTableNodeDefinition = z.infer<typeof uiTableNodeDefinitionSchema>;

export const uiInputNodeDefinitionSchema = mountableNodeSchema.extend({
    ...baseFieldsSchema,
    type: z.literal("ui-input"),
    // P145 (ADR 0012): label accepts the canonical value-binding set — a literal
    // string or a dynamic binding object. Back-compat: a plain string from a
    // pre-P145 flow is still accepted and treated as a literal label.
    label: z.union([bindingSchema, z.string().min(1, "Input labels must not be empty.")]),
    value: bindingSchema,
    // P203 (ADR 0027): `writeTo` is the symmetric WRITE half of `value` — the
    // target the runtime persists the user's edit into, restricted to the
    // writable kinds (store/flow/global). It replaces the dead `storeId`+`path`
    // write-back pair (removed). `writeTrigger` chooses when to persist
    // (change|submit, default submit).
    writeTo: writeToBindingSchema.optional(),
    writeTrigger: writeTriggerSchema.optional(),
    inputType: z.enum(["text", "email", "number"]).default("text"),
    // P49: true Ebene-2 variant (field style). Default "default".
    variant: z.enum(INPUT_VARIANTS).optional(),
    // P71: three-step size (sm/md/lg).
    size: componentSizeSchema.optional(),
    placeholder: z.string().min(1, "Input placeholders must not be empty.").optional(),
    disabled: bindingSchema.optional()
});

export type UiInputNodeDefinition = z.infer<typeof uiInputNodeDefinitionSchema>;

export const uiStoreScopeSchema = z.enum(["any", "broadcast-only", "client-only"]);
export type UiStoreScope = z.infer<typeof uiStoreScopeSchema>;

export const uiStoreNodeDefinitionSchema = identifiedNodeSchema.extend({
    type: z.literal("ui-store"),
    // P228 (ADR 0038): `app` is the canonical owning-app field; `parent` is the
    // legacy alias accepted for pre-rename flows (transitional union).
    app: identifierSchema.optional(),
    parent: identifierSchema.optional(),
    statePath: z.string().min(1, "Stores must declare a state path."),
    initialValue: z.unknown().optional(),
    persist: z.boolean().optional(),
    scope: uiStoreScopeSchema.optional()
});

export type UiStoreNodeDefinition = z.infer<typeof uiStoreNodeDefinitionSchema>;

export const uiQueryNodeDefinitionSchema = identifiedNodeSchema.extend({
    type: z.literal("ui-query"),
    // P228 (ADR 0038): `app` is the canonical owning-app field; `parent` is the
    // legacy alias accepted for pre-rename flows (transitional union).
    app: identifierSchema.optional(),
    parent: identifierSchema.optional(),
    queryPath: z.string().min(1, "Queries must declare a query path."),
    params: z.string().min(1, "Params store reference must not be empty.").optional(),
    refreshAction: z.string().min(1, "Refresh actions must not be empty.").optional(),
    // P161 (ADR 0016 §3): debounce the params-observed out-port refresh so a
    // search-as-you-type does not fire a fetch per keystroke. Default (absent /
    // 0) = immediate.
    debounceMs: z.number().int().nonnegative("Debounce must not be negative.").optional(),
});

export type UiQueryNodeDefinition = z.infer<typeof uiQueryNodeDefinitionSchema>;

// P209 (ADR 0028): a reference-based, on-demand, NON-mutating reader of a
// `ui-store`. `store` references a ui-store node id; `path` is an optional
// default one-level sub-path (relative to the store's statePath, ADR 0013) that
// a runtime `msg.ui.store.path` / `msg.path` can override. `parent` is the
// owning app (required at deploy via the P205 parent validation).
export const uiStoreReadNodeDefinitionSchema = identifiedNodeSchema.extend({
    type: z.literal("ui-store-read"),
    // P228 (ADR 0038): `app` is the canonical owning-app field; `parent` is the
    // legacy alias accepted for pre-rename flows (transitional union).
    app: identifierSchema.optional(),
    parent: identifierSchema.optional(),
    store: z.string().min(1, "ui-store-read must reference a ui-store node."),
    path: z.string().min(1, "Store read paths must not be empty.").optional()
});

export type UiStoreReadNodeDefinition = z.infer<typeof uiStoreReadNodeDefinitionSchema>;

// P211 (ADR 0029): a typed, reference-based MUTATION node for a `ui-store`. It
// references a ui-store by id (`store`) and carries an op selector
// (`set|patch|delete|replace|reset`) plus an optional one-level sub-path (`path`,
// relative to the store's statePath, ADR 0013). `mode` mirrors
// `ui-action.targetMode`: `reference` applies the op directly server-side (per
// client via msg.ui.clientId, SSE re-render); `wire` emits the
// `msg.ui.store = {id,op,path,value}` envelope on the out-port instead. `parent`
// is the owning app (required at deploy via the P205 parent validation). The
// value comes from `msg.payload` (set/patch/replace); `reset` ignores it.
export const uiStoreActionNodeDefinitionSchema = identifiedNodeSchema.extend({
    type: z.literal("ui-store-action"),
    // P228 (ADR 0038): `app` is the canonical owning-app field; `parent` is the
    // legacy alias accepted for pre-rename flows (transitional union).
    app: identifierSchema.optional(),
    parent: identifierSchema.optional(),
    store: z.string().min(1, "ui-store-action must reference a ui-store node."),
    op: z.enum(["set", "patch", "delete", "replace", "reset"]).default("set"),
    path: z.string().min(1, "Store action paths must not be empty.").optional(),
    mode: z.enum(["reference", "wire"]).default("reference")
});

export type UiStoreActionNodeDefinition = z.infer<typeof uiStoreActionNodeDefinitionSchema>;

// P212 (ADR 0029): a typed, reference-based node for a `ui-query`. It references a
// ui-query by id (`query`) and carries an action selector (`refresh` | `replace`,
// an extensible enum). `mode` mirrors `ui-action.targetMode`:
//   - `refresh` (P212, trigger-out): `reference` fires the referenced query's
//     refresh directly server-side (via fireQueryRefresh, per client via
//     msg.ui.clientId) so its out-port emits the retrieval; `wire` emits the
//     `msg.ui.query = {queryPath, refresh:true, params}` envelope on the out-port.
//   - `replace` (P213, data-in): the typed form of `msg.ui.query.data`. `reference`
//     writes `msg.payload` DIRECTLY into `ui.queries.<queryPath>.data` (per-client,
//     SSE re-render); `wire` emits `msg.ui.query = {queryPath, data}` on the
//     out-port for the flow to wire to the ui-query input.
// `parent` is the owning app (required at deploy via the P205 parent validation).
// Optional query params (refresh) come from `msg.payload`/`msg.ui.query.params`;
// the replace data comes from `msg.payload`.
export const uiQueryActionNodeDefinitionSchema = identifiedNodeSchema.extend({
    type: z.literal("ui-query-action"),
    // P228 (ADR 0038): `app` is the canonical owning-app field; `parent` is the
    // legacy alias accepted for pre-rename flows (transitional union).
    app: identifierSchema.optional(),
    parent: identifierSchema.optional(),
    query: z.string().min(1, "ui-query-action must reference a ui-query node."),
    action: z.enum(["refresh", "replace"]).default("refresh"),
    mode: z.enum(["reference", "wire"]).default("reference")
});

export type UiQueryActionNodeDefinition = z.infer<typeof uiQueryActionNodeDefinitionSchema>;

// P118 (ADR 0011 §1): navigate target-mode exclusivity. The stored `targetMode`
// declares the single intent; only that mode's fields may be set so a config can
// never carry a double configuration:
//   • route ⇒ `route` set; `to` must NOT be set.
//   • url   ⇒ `to` set; `route` must NOT be set.
//   • wire  ⇒ neither `route` nor `to`.
// Violations are validation (compile-time) errors. Only enforced for navigate
// actions (other verbs ignore targetMode). Absent targetMode skips the check
// (legacy configs are migrated to a mode on load before they reach here).
function applyNavigateTargetModeExclusivity(
    def: {
        actionType?: string;
        targetMode?: string;
        route?: string;
        routeId?: string;
        to?: string;
    },
    ctx: z.RefinementCtx
): void {
    if (def.actionType !== "navigate" || !def.targetMode) {
        return;
    }
    const hasTo = typeof def.to === "string" && def.to.length > 0;
    // P259 (ADR 0038): canonical `route`; legacy `routeId` counts the same.
    const routeRef = def.route ?? def.routeId;
    const hasRouteId = typeof routeRef === "string" && routeRef.length > 0;
    if (def.targetMode === "route") {
        if (hasTo) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["to"],
                message: "targetMode 'route' must not set `to` — the route reference supplies the path."
            });
        }
    }
    else if (def.targetMode === "url") {
        if (hasRouteId) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["route"],
                message: "targetMode 'url' must not set `route` — the `to` URL is built whole."
            });
        }
    }
    else if (def.targetMode === "wire") {
        if (hasTo) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["to"],
                message: "targetMode 'wire' must not set `to` — the wired route supplies the path."
            });
        }
        if (hasRouteId) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["route"],
                message: "targetMode 'wire' must not set `route` — the wired route is the target."
            });
        }
    }
}

export const uiActionNodeDefinitionSchema = identifiedNodeSchema.extend({
    type: z.literal("ui-action"),
    // P228 (ADR 0038): `app` is the canonical owning-app field; `parent` is the
    // legacy alias accepted for pre-rename flows (transitional union).
    app: identifierSchema.optional(),
    parent: identifierSchema.optional(),
    actionType: actionTypeSchema.optional(),
    // P60 (ADR 0007 §3): the node picker (RED.view.selectNodes) stores a LIST of
    // target node ids — the optional "wireless" addressing path delivered via
    // targetNode.receive(). Wiring the output port stays the primary model.
    targets: z.array(identifierSchema).optional(),
    // targetMode and target are kept for backward compatibility but deprecated.
    // The preferred model is wiring the output port to the target node.
    // P118 (ADR 0011 §1): `targetMode` is REPURPOSED for navigate as the explicit
    // target SOURCE — wire | route | url. (The old out-port/path enum is dropped;
    // legacy values migrate to a navigate mode on load.)
    targetMode: navigateTargetModeSchema.optional(),
    // P118: the referenced ui-route id (navigate `route` mode only). Resolved
    // app-globally to the route's `path` at action time. P259 (ADR 0038): the
    // canonical field is the bare `route`; `routeId` is the legacy alias
    // accepted for pre-rename flows (transitional union).
    route: identifierSchema.optional(),
    routeId: identifierSchema.optional(),
    target: z.string().min(1, "Action targets must not be empty.").optional(),
    // P53 (ADR 0005): sub-id within the target for open / close / select
    // granularity (accordion section, tree branch, tab name).
    part: z.string().min(1, "Action parts must not be empty.").optional(),
    // P66 (ADR 0007): navigate destination as a typedInput. `to` holds the value
    // (a path template, a msg/flow/global reference, or a JSONata expression),
    // `toType` its type (default "str"). P118: only meaningful in `url` mode.
    to: z.string().min(1, "Navigate actions must declare a destination.").optional(),
    toType: actionToTypeSchema.optional(),
    // P118 (ADR 0011 §1): typed navigate params — an ordered LIST of
    // { name, value, valueType } entries (route mode). Supersedes the P66
    // literal-only `{k: "v"}` object (migrated to str-typed rows on load).
    params: actionParamListSchema.optional(),
    description: z.string().min(1, "Action descriptions must not be empty.").optional()
}).superRefine((def, ctx) => {
    applyNavigateTargetModeExclusivity(def, ctx);
});

export type UiActionNodeDefinition = z.infer<typeof uiActionNodeDefinitionSchema>;

// P243 (ADR 0040): the ui-navigation node is retired. Navigation is solely a
// ui-action with actionType:"navigate" (three target modes + typed params).
// There is no separate navigation node definition.

// ── P16a: input control nodes ────────────────────────────────────────────────

const selectOptionSchema = z.object({
    label: z.string(),
    value: z.unknown()
});

/** A normalised select option — always `{ label, value }`. */
export interface SelectOption {
    label: string;
    value: unknown;
}

/** Result of {@link normalizeSelectOptions}: either the normalised list or an error message. */
export type SelectOptionsResult =
    | { ok: true; options: SelectOption[] }
    | { ok: false; error: string };

/**
 * P133 (ADR 0012): the ONE pure validator/normaliser for a ui-select `options`
 * JSON value. The editor's `json`-type Options field, the runtime mapper, and
 * the unit tests all share this single source of truth so the three accepted
 * forms — and the rejection of everything else — stay in lockstep.
 *
 * Accepts exactly one of three shapes and normalises to `{ label, value }[]`:
 *   1. **Object** `{ "<label>": "<value>" }`  → key = label, value = value.
 *   2. **Array of strings** `["A","B"]`       → value = label.
 *   3. **Array of objects** `[{ label, value }]` (each needs both props).
 *
 * Anything else (a bare number/string/bool, an array of numbers, an array of
 * objects missing `label`/`value`, an object whose values are non-scalars, …)
 * is rejected with a spoken error. An empty array / empty object → `[]` (valid,
 * renders no options). `null`/`undefined` → `[]` (no options).
 */
export function normalizeSelectOptions(input: unknown): SelectOptionsResult {
    if (input === undefined || input === null) {
        return { ok: true, options: [] };
    }

    if (Array.isArray(input)) {
        if (input.length === 0) {
            return { ok: true, options: [] };
        }

        // Form 2: array of strings (value = label).
        if (input.every((entry) => typeof entry === "string")) {
            return { ok: true, options: input.map((label) => ({ label: label as string, value: label })) };
        }

        // Form 3: array of objects, each with both `label` and `value`.
        if (input.every((entry) => typeof entry === "object" && entry !== null && !Array.isArray(entry))) {
            const options: SelectOption[] = [];
            for (const entry of input as Record<string, unknown>[]) {
                if (typeof entry.label !== "string" || entry.label.length === 0) {
                    return { ok: false, error: "Each option object must have a non-empty string 'label'." };
                }
                if (!("value" in entry)) {
                    return { ok: false, error: "Each option object must declare a 'value'." };
                }
                options.push({ label: entry.label, value: entry.value });
            }
            return { ok: true, options };
        }

        return {
            ok: false,
            error: "Options array must be all strings (['A','B']) or all objects ([{label,value}])."
        };
    }

    if (typeof input === "object") {
        // Form 1: object map { label: value } — each value must be a scalar.
        const entries = Object.entries(input as Record<string, unknown>);
        if (entries.length === 0) {
            return { ok: true, options: [] };
        }
        const options: SelectOption[] = [];
        for (const [label, value] of entries) {
            if (value !== null && typeof value === "object") {
                return { ok: false, error: "Options object values must be scalars (string/number/boolean), not objects or arrays." };
            }
            options.push({ label, value });
        }
        return { ok: true, options };
    }

    return {
        ok: false,
        error: "Options must be an object {label:value}, an array of strings, or an array of {label,value} objects."
    };
}

export const uiSelectNodeDefinitionSchema = mountableNodeSchema.extend({
    ...baseFieldsSchema,
    type: z.literal("ui-select"),
    // P133: label accepts the canonical value-binding set (ADR 0012) — a literal
    // non-empty string OR a binding object (store/query/route-param/…).
    label: z.union([bindingSchema, z.string().min(1, "Select labels must not be empty.")]),
    value: bindingSchema,
    // P204 (ADR 0027): the symmetric WRITE half of `value` — writable kinds only
    // (store/flow/global). A select has no submit gesture, so it persists on
    // `change` regardless of `writeTrigger` (see the runtime write-back gate).
    writeTo: writeToBindingSchema.optional(),
    writeTrigger: writeTriggerSchema.optional(),
    options: z.union([z.array(selectOptionSchema), bindingSchema]).optional(),
    // P133: placeholder and label accept the canonical value-binding set (ADR
    // 0012) — a literal string, a store/query/route-param/… binding object, etc.
    placeholder: z.union([bindingSchema, z.string()]).optional(),
    multiple: z.boolean().optional(),
    // P133: `searchable` removed — neither Shoelace nor Bootstrap support it.
    // P71: three-step size (sm/md/lg).
    size: componentSizeSchema.optional(),
    disabled: bindingSchema.optional()
});

export type UiSelectNodeDefinition = z.infer<typeof uiSelectNodeDefinitionSchema>;

export const uiCheckboxNodeDefinitionSchema = mountableNodeSchema.extend({
    ...baseFieldsSchema,
    type: z.literal("ui-checkbox"),
    // P97: label is now a full binding (literal string or dynamic binding).
    label: z.union([bindingSchema, z.string().min(1, "Checkbox labels must not be empty.")]),
    value: bindingSchema,
    // P204 (ADR 0027): symmetric WRITE half of `value` — writable kinds only.
    // A checkbox has no submit gesture → persists on `change` regardless of
    // `writeTrigger` (see the runtime write-back gate).
    writeTo: writeToBindingSchema.optional(),
    writeTrigger: writeTriggerSchema.optional(),
    // P97: size — xs / sm / md (default) / lg / xl (Shoelace size tokens).
    size: z.enum(["xs", "sm", "md", "lg", "xl"]).optional(),
    disabled: bindingSchema.optional()
});

export type UiCheckboxNodeDefinition = z.infer<typeof uiCheckboxNodeDefinitionSchema>;

export const uiRadioNodeDefinitionSchema = mountableNodeSchema.extend({
    ...baseFieldsSchema,
    type: z.literal("ui-radio"),
    // P136 (ADR 0012): label accepts the canonical value-binding set — a literal
    // non-empty string OR a binding object (store/query/route-param/…), mirroring
    // ui-select (P133).
    label: z.union([bindingSchema, z.string().min(1, "Radio labels must not be empty.")]),
    value: bindingSchema,
    // P204 (ADR 0027): symmetric WRITE half of `value` — writable kinds only.
    // A radio group has no submit gesture → persists on `change` regardless of
    // `writeTrigger` (see the runtime write-back gate).
    writeTo: writeToBindingSchema.optional(),
    writeTrigger: writeTriggerSchema.optional(),
    // P136: options is the SHARED model with ui-select — a normalised
    // `{label,value}[]` array (json type) or a binding object (store type).
    // Optional so an as-yet-unconfigured radio (empty/null options) stays valid,
    // matching ui-select.
    options: z.union([z.array(selectOptionSchema), bindingSchema]).optional(),
    orientation: z.enum(["horizontal", "vertical"]).optional(),
    disabled: bindingSchema.optional()
});

export type UiRadioNodeDefinition = z.infer<typeof uiRadioNodeDefinitionSchema>;

export const uiSwitchNodeDefinitionSchema = mountableNodeSchema.extend({
    ...baseFieldsSchema,
    type: z.literal("ui-switch"),
    value: bindingSchema,
    // P204 (ADR 0027): symmetric WRITE half of `value` — writable kinds only.
    // A switch has no submit gesture → persists on `change` regardless of
    // `writeTrigger` (see the runtime write-back gate).
    writeTo: writeToBindingSchema.optional(),
    writeTrigger: writeTriggerSchema.optional(),
    // P147 (ADR 0012): label/labelOn/labelOff accept the canonical value-binding
    // set — a literal string binding or a plain string (legacy). All three are
    // optional (spec says labels are optional on ui-switch).
    label: z.union([bindingSchema, z.string()]).optional(),
    labelOn: z.union([bindingSchema, z.string()]).optional(),
    labelOff: z.union([bindingSchema, z.string()]).optional(),
    disabled: bindingSchema.optional()
});

export type UiSwitchNodeDefinition = z.infer<typeof uiSwitchNodeDefinitionSchema>;

export const uiTextareaNodeDefinitionSchema = mountableNodeSchema.extend({
    ...baseFieldsSchema,
    type: z.literal("ui-textarea"),
    // P148 (ADR 0012): label accepts the canonical value-binding set — a literal
    // string or a dynamic binding object. Back-compat: a plain string from a
    // pre-P148 flow is still accepted and treated as a literal label.
    label: z.union([bindingSchema, z.string().min(1, "Textarea labels must not be empty.")]),
    value: bindingSchema,
    // P204 (ADR 0027): symmetric WRITE half of `value` — writable kinds only.
    // A textarea is text-like: it honours `writeTrigger` (submit=Enter/blur,
    // change=every keystroke) via the runtime write-back gate.
    writeTo: writeToBindingSchema.optional(),
    writeTrigger: writeTriggerSchema.optional(),
    // P148 (ADR 0012): placeholder accepts the canonical value-binding set.
    // Back-compat: a plain string from a pre-P148 flow is still accepted.
    placeholder: z.union([bindingSchema, z.string().min(1, "Textarea placeholders must not be empty.")]).optional(),
    // P229 (ADR 0038): `lines` = visible text-line count (field height). Renamed
    // from the overloaded `rows` so `rows` means only the ui-table DATA binding;
    // the runtime mapConfig migrates a legacy `rows` config into `lines`.
    lines: z.number().int().positive().optional(),
    maxLength: z.number().int().positive().optional(),
    // P71: three-step size (sm/md/lg).
    size: componentSizeSchema.optional(),
    disabled: bindingSchema.optional()
});

export type UiTextareaNodeDefinition = z.infer<typeof uiTextareaNodeDefinitionSchema>;

export const uiDatepickerNodeDefinitionSchema = mountableNodeSchema.extend({
    ...baseFieldsSchema,
    type: z.literal("ui-datepicker"),
    // P98: label is now a full binding (literal string or dynamic binding).
    label: z.union([bindingSchema, z.string().min(1, "Datepicker labels must not be empty.")]),
    value: bindingSchema,
    // P204 (ADR 0027): symmetric WRITE half of `value` — writable kinds only.
    // A datepicker is text-like: it honours `writeTrigger` (submit=Enter/blur,
    // change=on pick) via the runtime write-back gate.
    writeTo: writeToBindingSchema.optional(),
    writeTrigger: writeTriggerSchema.optional(),
    mode: z.enum(["date", "datetime", "time"]).optional(),
    min: z.string().optional(),
    max: z.string().optional(),
    // P149 (ADR 0012): placeholder accepts the canonical value-binding set — a literal
    // string or a dynamic binding object. Back-compat: a plain string is still accepted.
    placeholder: z.union([bindingSchema, z.string()]).optional(),
    disabled: bindingSchema.optional()
});

export type UiDatepickerNodeDefinition = z.infer<typeof uiDatepickerNodeDefinitionSchema>;

export const uiSliderNodeDefinitionSchema = mountableNodeSchema.extend({
    ...baseFieldsSchema,
    type: z.literal("ui-slider"),
    value: bindingSchema,
    // P204 (ADR 0027): symmetric WRITE half of `value` — writable kinds only.
    // A slider has no submit gesture → persists on `change` (drag end) regardless
    // of `writeTrigger`. Its value is numeric (see the special-model note).
    writeTo: writeToBindingSchema.optional(),
    writeTrigger: writeTriggerSchema.optional(),
    // P146 (ADR 0012): label accepts the canonical value-binding set — a literal
    // string or a dynamic binding object. Back-compat: a plain string from a
    // pre-P146 flow is still accepted and treated as a literal label.
    label: z.union([bindingSchema, z.string()]).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().positive().optional(),
    showValue: z.boolean().optional(),
    disabled: bindingSchema.optional()
});

export type UiSliderNodeDefinition = z.infer<typeof uiSliderNodeDefinitionSchema>;

// ── P16b: feedback and status nodes ─────────────────────────────────────────

export const uiAlertNodeDefinitionSchema = mountableNodeSchema.extend({
    ...baseFieldsSchema,
    type: z.literal("ui-alert"),
    message: bindingSchema,
    // P49b: unified with SEVERITY_VARIANTS — the single source of truth.
    // Legacy values "error" and "default" are no longer accepted; they were
    // normalised in the serializer before reaching here, so no runtime impact.
    severity: z.enum(SEVERITY_VARIANTS).optional(),
    // P67: title is now a full binding (literal/state/query/.../store), mirroring
    // `message`. Plain strings are no longer valid here — the editor and serializer
    // wrap a static title as { kind: "literal", value }.
    title: bindingSchema.optional(),
    dismissible: z.boolean().optional(),
    visible: bindingSchema.optional(),
    // P90: icon field — controls what appears in the Shoelace `icon` slot.
    //   "auto"   → severity-derived icon (default when field is set; omitting the
    //              field entirely means no icon is shown).
    //   "none"   → no icon, even if severity is set.
    //   <name>   → any icon name (plain string) or { library, name } object.
    //   binding  → dynamic binding resolved at runtime to one of the above.
    icon: z.union([
        z.literal("auto"),
        z.literal("none"),
        iconFieldSchema
    ]).optional(),
    // P91: duration + countdown — auto-hide and countdown progress bar.
    //   duration  → positive integer (ms); when set the alert auto-hides after
    //               that many milliseconds. Shoelace renders `duration` attribute
    //               on <sl-alert>; other backends use a JS timeout fallback.
    //               Absent / 0 = never auto-hide.
    //   countdown → when true and duration is set, a progress bar shows remaining
    //               time. Shoelace renders `countdown="ltr"` on <sl-alert>; other
    //               backends can use a CSS/JS animation (Bootstrap example pattern).
    duration: z.number().int().positive().optional(),
    countdown: z.boolean().optional()
});

export type UiAlertNodeDefinition = z.infer<typeof uiAlertNodeDefinitionSchema>;

export const uiToastNodeDefinitionSchema = identifiedNodeSchema.extend({
    type: z.literal("ui-toast"),
    // P228 (ADR 0038): `app` is the canonical owning-app field; `parent` is the
    // legacy alias accepted for pre-rename flows (transitional union).
    app: identifierSchema.optional(),
    parent: identifierSchema.optional(),
    // P49b: unified with SEVERITY_VARIANTS — same single source of truth as ui-alert.
    severity: z.enum(SEVERITY_VARIANTS).optional(),
    duration: z.number().int().min(0).optional(),
    position: z.enum(["top-right", "top-center", "bottom-right", "bottom-center"]).optional()
});

export type UiToastNodeDefinition = z.infer<typeof uiToastNodeDefinitionSchema>;

export const uiProgressNodeDefinitionSchema = mountableNodeSchema.extend({
    ...baseFieldsSchema,
    type: z.literal("ui-progress"),
    // P49: this is a DISPLAY TYPE (rendering form), not an Ebene-2 semantic
    // variant — renamed from `variant` so the variant SelectBox (P50) stays
    // semantic. Legacy `variant` is still accepted by webapp.js mapConfig.
    displayType: z.enum(["bar", "spinner", "circular"]).optional(),
    // P137 (ADR 0012): `value` is the canonical value/display typedInput (literal
    // default `number`). Legacy `valuePath` (pre-P137 plain state path) is migrated
    // by webapp.js getBinding / editor shim on first open.
    value: bindingSchema.optional(),
    // P137 (ADR 0012): `label` is now a full binding (literal string or dynamic
    // binding) so the progress bar label can be reactive. Back-compat: a plain
    // string is still accepted (legacy flows).
    label: z.union([bindingSchema, z.string()]).optional(),
    showValue: z.boolean().optional(),
    // P234 (owner decision 2026-07-16): the upper bound of the progress range.
    // Optional, default `100` (applied by the serializer when absent/invalid). The
    // rendered fill scales as `value / max` (e.g. value=50, max=200 → 25 %), and
    // `showValue` shows the percentage relative to `max`. A non-positive/NaN max
    // degrades to 100 in the serializer rather than dividing by zero.
    max: z.number().optional()
});

export type UiProgressNodeDefinition = z.infer<typeof uiProgressNodeDefinitionSchema>;

export const uiSkeletonNodeDefinitionSchema = mountableNodeSchema.extend({
    ...baseFieldsSchema,
    type: z.literal("ui-skeleton"),
    // P138 (ADR 0012): `visible` is now the standard boolean-state binding
    // (optional — absent/null ⇒ always visible = true). Legacy `visiblePath`
    // (plain state path string) is migrated by webapp.js and editor/nodes.ts.
    visible: bindingSchema.optional(),
    // P49: DISPLAY TYPE (placeholder shape), not a semantic variant.
    displayType: z.enum(["text", "avatar", "card", "table"]).optional(),
    lines: z.number().int().positive().optional()
});

export type UiSkeletonNodeDefinition = z.infer<typeof uiSkeletonNodeDefinitionSchema>;

export const uiBadgeNodeDefinitionSchema = mountableNodeSchema.extend({
    ...baseFieldsSchema,
    type: z.literal("ui-badge"),
    value: bindingSchema,
    // P92: displayType = shape of the badge (square/rounded/pill). This is a
    // DISPLAY TYPE (Darstellungstyp), NOT a semantic Ebene-2 variant. "pill"
    // maps to Shoelace `pill` attribute; "rounded" is the default rounded badge;
    // "square" maps to a square-cornered variant (custom CSS or data-attr).
    displayType: z.enum(["square", "rounded", "pill"]).optional(),
    // P92: variant (renamed from `severity` in P49/P49b). Semantic Ebene-2
    // colour role for the badge. Uses SEVERITY_VARIANTS as the badge vocabulary.
    // (VARIANT_BY_KIND["badge"] = BADGE_VARIANTS = SEVERITY_VARIANTS.)
    variant: z.enum(SEVERITY_VARIANTS).optional(),
    // P92: pulsating — makes the badge pulse to draw attention. Maps to the
    // Shoelace `pulse` boolean attribute on <sl-badge>. Other backends without
    // native support can apply a CSS animation fallback.
    pulsating: z.boolean().optional()
    // P92: `max` field removed (was for count truncation — no longer relevant
    // as displayType is now shape-only, not a count/dot/status distinction).
    // P103: `size` field removed — Shoelace has no native badge sizing; a pure
    // data-size attr without a backend that evaluates it is dead weight.
    // Size differences are handled via Theme/CSS at the use site, not a node field.
});

export type UiBadgeNodeDefinition = z.infer<typeof uiBadgeNodeDefinitionSchema>;

export const uiEmptyStateNodeDefinitionSchema = mountableNodeSchema.extend({
    ...baseFieldsSchema,
    type: z.literal("ui-empty-state"),
    visible: bindingSchema,
    icon: z.string().optional(),
    title: z.string().optional(),
    message: z.string().optional(),
    action: identifierSchema.optional(),
    actionLabel: z.string().optional()
});

export type UiEmptyStateNodeDefinition = z.infer<typeof uiEmptyStateNodeDefinitionSchema>;

// ── P16c: navigation and structure nodes ────────────────────────────────────

// P167 (ADR 0018, Model 1a): legacy `tabs` config-array item shape. Kept ONLY
// as the INPUT type for the migration mapping (`migrateUiTabsToChildren`); the
// `ui-tabs` node no longer carries a `tabs` field.
export const legacyTabItemSchema = z.object({
    id: z.string().min(1),
    label: z.string().min(1)
});

export type LegacyTabItem = z.infer<typeof legacyTabItemSchema>;

// P167 (ADR 0018, Model 1a): `ui-tabs` slots are derived from its children. A
// content child mounts into the standard "content" slot of its `ui-tab` parent
// exactly like any other container child: `ui-tab:<tabId>/content` (= TAB_SLOT).
// The slot KEY a `ui-tab` contributes to its `ui-tabs` parent is the tab's own
// id (ADR 0018 §1: "the id is the slot key and the token `activeTab` carries").
export const TAB_SLOT = "content";

// P167 (ADR 0018): `ui-tab` — a thin CONTAINER child of `ui-tabs`. It carries
// the section's own metadata (`label`, optional `icon`, `order`) plus a single
// DEFAULT slot for its content. The MOUNT is the declaration of the tab — there
// is no second source of truth (no orphan problem). `ui-tab` is children-allowed
// (container-kind), registered analogously to `ui-container`/`ui-repeat`.
export const uiTabNodeDefinitionSchema = mountableNodeSchema.extend({
    ...baseFieldsSchema,
    type: z.literal("ui-tab"),
    // The tab's label. Full value-binding set (literal/state/store/query/…) so a
    // tab title may be static or bound. The editor's value typedInput persists a
    // binding object; a literal-kind binding holds a plain string.
    label: bindingSchema,
    // Optional icon shown beside the label (literal name / icon value / binding).
    icon: iconFieldSchema.optional()
    // NOTE: `order` is inherited from `mountableNodeSchema` (an optional integer);
    // it is the per-tab ordering within the `ui-tabs` parent. The first tab by
    // `order` is the default `activeTab` (see `defaultActiveTabId`). Tabs without
    // an `order` sort after ordered tabs, ties broken by declaration order.
});

export type UiTabNodeDefinition = z.infer<typeof uiTabNodeDefinitionSchema>;

export const uiTabsNodeDefinitionSchema = mountableNodeSchema.extend({
    ...baseFieldsSchema,
    type: z.literal("ui-tabs"),
    // P167 (ADR 0018, Model 1a): the `tabs` JSON config-array is REMOVED. The
    // tabs are derived from the mounted `ui-tab` children (one slot per child,
    // slot key = child id). See `uiTabNodeDefinitionSchema` and `TAB_SLOT`.
    //
    // P155 (ADR 0012): the canonical editor field `activeTab` (two-way value
    // typedInput) compiles to this binding. P167 (ADR 0018 §4): `activeTab` now
    // carries the CHILD ID; the DEFAULT is the first child by `order` (resolved
    // from the mounted children — see `defaultActiveTabId`). There is no static
    // default value on this node because the children are not visible to a single
    // node's schema; an invalid value falls back to the first child (P168).
    activeTab: bindingSchema.optional(),
    variant: z.enum(["line", "contained", "pills"]).optional(),
    events: z.array(z.enum(["tabChange"])).optional()
});

export type UiTabsNodeDefinition = z.infer<typeof uiTabsNodeDefinitionSchema>;

// ── P167 (ADR 0018): ui-tabs uniqueness + migration (pure functions) ─────────

/**
 * P167 (ADR 0018 §1): the child ids of a `ui-tabs` MUST be unique within the
 * parent — a duplicate is a validation error (the id is the slot key and the
 * `activeTab` token, so a collision would alias two tabs onto one slot).
 *
 * This is a pure, registry-level check (the per-node schema cannot see its
 * siblings). Returns an error string on the first duplicate, or `undefined` when
 * all ids are unique.
 */
export function validateUiTabChildrenUnique(
    tabChildren: ReadonlyArray<{ id: string }>
): string | undefined {
    const seen = new Set<string>();
    for (const child of tabChildren) {
        if (seen.has(child.id)) {
            return `Duplicate ui-tab id '${child.id}' within a ui-tabs — tab ids must be unique (the id is the slot key and the activeTab value).`;
        }
        seen.add(child.id);
    }
    return undefined;
}

/**
 * P167 (ADR 0018 §4): resolve the DEFAULT active tab id — the first child by
 * `order` (tabs without an `order` sort after ordered tabs, ties broken by
 * declaration order). Returns `undefined` for an empty child set.
 */
export function defaultActiveTabId(
    tabChildren: ReadonlyArray<{ id: string; order?: number }>
): string | undefined {
    if (tabChildren.length === 0) {
        return undefined;
    }
    const sorted = tabChildren
        .map((child, index) => ({ child, index }))
        .sort((a, b) => {
            const ao = a.child.order;
            const bo = b.child.order;
            if (ao !== undefined && bo !== undefined && ao !== bo) {
                return ao - bo;
            }
            if (ao !== undefined && bo === undefined) {
                return -1;
            }
            if (ao === undefined && bo !== undefined) {
                return 1;
            }
            return a.index - b.index;
        });
    return sorted[0].child.id;
}

/**
 * P167 (ADR 0018 §5): build the new content-slot mount for a tab —
 * `ui-tab:<tabId>/<TAB_SLOT>`.
 */
export function uiTabContentMount(tabId: string): string {
    return `ui-tab:${tabId}/${TAB_SLOT}`;
}

/**
 * P167 (ADR 0018 §5): one-shot migration mapping from the LEGACY config-array
 * model (`ui-tabs` with a `tabs:[{id,label}]` field) to the Model-1a children
 * model. Pure function — given a legacy `ui-tabs` config plus the content
 * children that mounted into its legacy `tab:<id>` slots, it returns the
 * reworked `ui-tabs` (no `tabs` field), one new `ui-tab` child per legacy entry
 * (id/label preserved, ordered by declaration), and the remapped child mounts
 * (`tab:<id>` → `ui-tab:<id>/content`).
 */
export interface LegacyUiTabsForMigration {
    /** The legacy `ui-tabs` node id. */
    id: string;
    /** The legacy `tabs` config array. */
    tabs: ReadonlyArray<LegacyTabItem>;
    /** Optional carried-over fields (mount/parent/activeTab/variant/events). */
    mount?: string;
    parent?: string;
    activeTab?: UiTabsNodeDefinition["activeTab"];
    variant?: UiTabsNodeDefinition["variant"];
    events?: UiTabsNodeDefinition["events"];
}

export interface MigratedChildMount {
    /** The content node whose mount is being re-pointed. */
    childId: string;
    /** The legacy mount string (e.g. `tab:<tabId>`). */
    legacyMount: string;
    /** The new mount string pointing at the ui-tab's content slot. */
    mount: string;
}

export interface UiTabsMigrationResult {
    /** The reworked `ui-tabs` node (no `tabs` field). */
    tabs: UiTabsNodeDefinition;
    /** One new `ui-tab` child per legacy entry (id/label preserved). */
    tabChildren: UiTabNodeDefinition[];
    /** Remapped content-child mounts (`tab:<id>` → new ui-tab content slot). */
    childMounts: MigratedChildMount[];
}

export function migrateUiTabsToChildren(
    legacy: LegacyUiTabsForMigration,
    /**
     * Content children currently mounted into a legacy derived tab slot, given as
     * `{ id, tabId, legacyMount }`. The migration re-points each onto the matching
     * new `ui-tab`'s content slot.
     */
    contentChildren: ReadonlyArray<{ id: string; tabId: string; legacyMount: string }> = []
): UiTabsMigrationResult {
    const tabChildren: UiTabNodeDefinition[] = legacy.tabs.map((entry, index) => ({
        type: "ui-tab",
        id: entry.id,
        // The new `ui-tab` mounts into its `ui-tabs` parent's content slot,
        // contributing the slot keyed by its own id (ADR 0018 §1).
        mount: `ui-tabs:${legacy.id}/${TAB_SLOT}`,
        label: { kind: "literal", value: entry.label },
        order: index
    }));

    const childMounts: MigratedChildMount[] = contentChildren.map((content) => ({
        childId: content.id,
        legacyMount: content.legacyMount,
        mount: uiTabContentMount(content.tabId)
    }));

    const tabs: UiTabsNodeDefinition = {
        type: "ui-tabs",
        id: legacy.id,
        ...(legacy.mount !== undefined ? { mount: legacy.mount } : {}),
        ...(legacy.parent !== undefined ? { parent: legacy.parent } : {}),
        ...(legacy.activeTab !== undefined ? { activeTab: legacy.activeTab } : {}),
        ...(legacy.variant !== undefined ? { variant: legacy.variant } : {}),
        ...(legacy.events !== undefined ? { events: legacy.events } : {})
    };

    return { tabs, tabChildren, childMounts };
}

// P169 (ADR 0018, Model 1a): legacy accordion `sections` config-array item shape.
// Kept ONLY as the INPUT type for the migration mapping
// (`migrateUiAccordionToChildren`); the `ui-accordion` node no longer carries a
// `sections` field.
export const legacySectionItemSchema = z.object({
    id: z.string().min(1),
    label: z.string().min(1)
});

export type LegacySectionItem = z.infer<typeof legacySectionItemSchema>;

// P169 (ADR 0018, Model 1a): `ui-accordion` slots are derived from its children.
// A content child mounts into the standard "content" slot of its
// `ui-accordion-section` parent exactly like any other container child:
// `ui-accordion-section:<sectionId>/content` (= ACCORDION_SECTION_SLOT). The slot
// KEY a section contributes to its `ui-accordion` parent is the section's own id
// (the id is the slot key and the token the open-state carries — ADR 0018 §1/§4).
export const ACCORDION_SECTION_SLOT = "content";

// P169 (ADR 0018): `ui-accordion-section` — a thin CONTAINER child of
// `ui-accordion`. It carries the section's own metadata (`label`, optional
// `icon`, `order`) plus a single DEFAULT slot for its content. The MOUNT is the
// declaration of the section — there is no second source of truth (no orphan
// problem). Mirrors `ui-tab` (P167).
export const uiAccordionSectionNodeDefinitionSchema = mountableNodeSchema.extend({
    ...baseFieldsSchema,
    type: z.literal("ui-accordion-section"),
    // The section's summary/header label. Full value-binding set
    // (literal/state/store/query/…) so a section title may be static or bound.
    label: bindingSchema,
    // Optional icon shown beside the label (literal name / icon value / binding).
    icon: iconFieldSchema.optional()
    // NOTE: `order` is inherited from `mountableNodeSchema`; it is the per-section
    // ordering within the `ui-accordion` parent. The first section by `order` is
    // the default open section (see `defaultOpenSectionId`).
});

export type UiAccordionSectionNodeDefinition = z.infer<typeof uiAccordionSectionNodeDefinitionSchema>;

export const uiAccordionNodeDefinitionSchema = mountableNodeSchema.extend({
    ...baseFieldsSchema,
    type: z.literal("ui-accordion"),
    // P169 (ADR 0018, Model 1a): the `sections` JSON config-array is REMOVED. The
    // sections are derived from the mounted `ui-accordion-section` children (one
    // panel per child, slot key = child id). See
    // `uiAccordionSectionNodeDefinitionSchema` and `ACCORDION_SECTION_SLOT`.
    //
    // The open-state is analogous to ui-tabs `activeTab` (ADR 0018 §4): the
    // canonical two-way `openSection` value typedInput compiles to this binding and
    // carries the open section's CHILD ID. The DEFAULT is the first child by
    // `order` (resolved from the mounted children — see `defaultOpenSectionId`); an
    // invalid value falls back to the first child.
    openSection: bindingSchema.optional(),
    // When true, more than one section may be open at once (sl-details semantics).
    multiple: z.boolean().optional(),
    events: z.array(z.enum(["sectionOpen", "sectionClose"])).optional()
});

export type UiAccordionNodeDefinition = z.infer<typeof uiAccordionNodeDefinitionSchema>;

// ── P169 (ADR 0018): ui-accordion uniqueness + migration (pure functions) ─────

/**
 * P169 (ADR 0018 §1): the child ids of a `ui-accordion` MUST be unique within the
 * parent — a duplicate is a validation error (the id is the slot key and the
 * open-state token, so a collision would alias two sections onto one slot).
 *
 * This is a pure, registry-level check (the per-node schema cannot see its
 * siblings). Returns an error string on the first duplicate, or `undefined` when
 * all ids are unique.
 */
export function validateUiAccordionChildrenUnique(
    sectionChildren: ReadonlyArray<{ id: string }>
): string | undefined {
    const seen = new Set<string>();
    for (const child of sectionChildren) {
        if (seen.has(child.id)) {
            return `Duplicate ui-accordion-section id '${child.id}' within a ui-accordion — section ids must be unique (the id is the slot key and the open-state value).`;
        }
        seen.add(child.id);
    }
    return undefined;
}

/**
 * P169 (ADR 0018 §4): resolve the DEFAULT open section id — the first child by
 * `order` (sections without an `order` sort after ordered sections, ties broken by
 * declaration order). Returns `undefined` for an empty child set. Mirrors
 * `defaultActiveTabId`.
 */
export function defaultOpenSectionId(
    sectionChildren: ReadonlyArray<{ id: string; order?: number }>
): string | undefined {
    return defaultActiveTabId(sectionChildren);
}

/**
 * P169 (ADR 0018 §5): build the new content-slot mount for a section —
 * `ui-accordion-section:<sectionId>/<ACCORDION_SECTION_SLOT>`.
 */
export function uiAccordionSectionContentMount(sectionId: string): string {
    return `ui-accordion-section:${sectionId}/${ACCORDION_SECTION_SLOT}`;
}

/**
 * P169 (ADR 0018 §5): one-shot migration mapping from the LEGACY config-array
 * model (`ui-accordion` with a `sections:[{id,label}]` field) to the Model-1a
 * children model. Pure function — given a legacy `ui-accordion` config plus the
 * content children that mounted into its legacy `section:<id>` slots, it returns
 * the reworked `ui-accordion` (no `sections` field), one new
 * `ui-accordion-section` child per legacy entry (id/label preserved, ordered by
 * declaration), and the remapped child mounts
 * (`section:<id>` → `ui-accordion-section:<id>/content`).
 */
export interface LegacyUiAccordionForMigration {
    /** The legacy `ui-accordion` node id. */
    id: string;
    /** The legacy `sections` config array. */
    sections: ReadonlyArray<LegacySectionItem>;
    /** Optional carried-over fields (mount/parent/openSection/multiple/events). */
    mount?: string;
    parent?: string;
    openSection?: UiAccordionNodeDefinition["openSection"];
    multiple?: UiAccordionNodeDefinition["multiple"];
    events?: UiAccordionNodeDefinition["events"];
}

export interface UiAccordionMigrationResult {
    /** The reworked `ui-accordion` node (no `sections` field). */
    accordion: UiAccordionNodeDefinition;
    /** One new `ui-accordion-section` child per legacy entry (id/label preserved). */
    sectionChildren: UiAccordionSectionNodeDefinition[];
    /** Remapped content-child mounts (`section:<id>` → new section content slot). */
    childMounts: MigratedChildMount[];
}

export function migrateUiAccordionToChildren(
    legacy: LegacyUiAccordionForMigration,
    /**
     * Content children currently mounted into a legacy derived section slot, given
     * as `{ id, sectionId, legacyMount }`. The migration re-points each onto the
     * matching new `ui-accordion-section`'s content slot.
     */
    contentChildren: ReadonlyArray<{ id: string; sectionId: string; legacyMount: string }> = []
): UiAccordionMigrationResult {
    const sectionChildren: UiAccordionSectionNodeDefinition[] = legacy.sections.map((entry, index) => ({
        type: "ui-accordion-section",
        id: entry.id,
        // The new section mounts into its `ui-accordion` parent's content slot,
        // contributing the slot keyed by its own id (ADR 0018 §1).
        mount: `ui-accordion:${legacy.id}/${ACCORDION_SECTION_SLOT}`,
        label: { kind: "literal", value: entry.label },
        order: index
    }));

    const childMounts: MigratedChildMount[] = contentChildren.map((content) => ({
        childId: content.id,
        legacyMount: content.legacyMount,
        mount: uiAccordionSectionContentMount(content.sectionId)
    }));

    const accordion: UiAccordionNodeDefinition = {
        type: "ui-accordion",
        id: legacy.id,
        ...(legacy.mount !== undefined ? { mount: legacy.mount } : {}),
        ...(legacy.parent !== undefined ? { parent: legacy.parent } : {}),
        ...(legacy.openSection !== undefined ? { openSection: legacy.openSection } : {}),
        ...(legacy.multiple !== undefined ? { multiple: legacy.multiple } : {}),
        ...(legacy.events !== undefined ? { events: legacy.events } : {})
    };

    return { accordion, sectionChildren, childMounts };
}

// P95: breadcrumb item schema — supports three static forms:
//   (a) a string         → label = string, action = string (click param)
//   (b) an object        → { label, action?, active? }
//       action: click parameter sent with the event (defaults to label if omitted)
//       active: marks the current-page item (different rendering); item stays clickable
//   (c) child-node slots → set layout: "breadcrumb"; items field is then a binding or omitted;
//       children in the "default" slot are rendered as breadcrumb items, click-param = child id
export const breadcrumbItemSchema = z.union([
    z.string().min(1),
    z.object({
        label: z.string().min(1),
        action: z.string().optional(),
        active: z.boolean().optional()
    })
]);

export type BreadcrumbItem = z.infer<typeof breadcrumbItemSchema>;

export const uiBreadcrumbNodeDefinitionSchema = mountableNodeSchema.extend({
    ...baseFieldsSchema,
    type: z.literal("ui-breadcrumb"),
    // Optional layout field: set to "breadcrumb" to enable child-node slots (modes c & d).
    layout: standardLayoutPresetSchema.optional(),
    // items: static array of string/object breadcrumb items, OR a binding.
    // Optional when layout="breadcrumb" (child nodes via slot take over).
    items: z.union([
        z.array(breadcrumbItemSchema),
        bindingSchema
    ]).optional(),
    separator: z.string().optional(),
    // P95: ALL items emit a `click` event on the node's output port.
    // P75 legacy: `navigate` is kept for back-compat during migration.
    events: z.array(z.enum(["click", "navigate"])).optional()
});

export type UiBreadcrumbNodeDefinition = z.infer<typeof uiBreadcrumbNodeDefinitionSchema>;

const menuItemSchema: z.ZodType<{ label: string; route?: string; href?: string; path?: string; icon?: string; children?: Array<{ label: string; path?: string; icon?: string }> }> = z.object({
    label: z.string().min(1),
    route: z.string().optional(),
    href: z.string().optional(),
    path: z.string().optional(),
    icon: z.string().optional(),
    children: z.array(z.object({ label: z.string().min(1), path: z.string().optional(), icon: z.string().optional() })).optional()
});

export const uiMenuNodeDefinitionSchema = mountableNodeSchema.extend({
    ...baseFieldsSchema,
    type: z.literal("ui-menu"),
    // P49: sidebar/topbar is a DISPLAY TYPE (layout mode), not a semantic variant.
    // P244: `dropdown` was removed from the enum — it was never reachable from the
    // editor (only sidebar/topbar are offered) and had no trigger model. A deployed
    // legacy flow carrying `displayType: "dropdown"` (or any out-of-enum value) must
    // NOT fail validation and drop the node; `.catch("sidebar")` degrades it to the
    // default. NOTE: no displayType value produces an observable render difference
    // today (renderer/adapter do not branch on it — findings A); the modes are
    // documented as planned, not implemented.
    displayType: z.enum(["sidebar", "topbar"]).optional().catch("sidebar"),
    // P157 (ADR 0012): `items` is the canonical STRUCTURAL array source — either a
    // static array of menu items (the menu renders its entries itself; NOT a
    // repeats case, vgl. ui-list P140) OR a binding (store/query/reactive/
    // json-literal) resolved structurally by the renderer (shared P133 path).
    items: z.union([z.array(menuItemSchema), bindingSchema]),
    // P157 (ADR 0012): `activeItem` is the read-only active-route binding (editor
    // field `activeRoute`); the matching item is highlighted by the serializer.
    activeItem: bindingSchema.optional(),
    // P244: `collapsed` was removed — it was a phantom field: not in the editor
    // (no defaults entry / form row), never read by mapConfig, never rendered.
    // Removal is lossless (no authored flow could set or depend on it).
    // P75: clicking a navigable item (one with `route`/`path`, not an external
    // `href`) emits a `navigate` event on the node's output port. See the
    // ui-breadcrumb note above for the dispatch/serializer roles of this contract.
    events: z.array(z.enum(["navigate"])).optional()
});

export type UiMenuNodeDefinition = z.infer<typeof uiMenuNodeDefinitionSchema>;

export const uiPaginationNodeDefinitionSchema = mountableNodeSchema.extend({
    ...baseFieldsSchema,
    type: z.literal("ui-pagination"),
    // P154 (ADR 0012): the canonical editor field `currentPage` (two-way value
    // typedInput: read source + change-event write-back) compiles to this `page`
    // binding; the editor field `total` (read-only value typedInput) compiles to
    // `totalPages`. Legacy `currentPagePath` / `totalPath` plain state paths are
    // migrated to state bindings by webapp.js mapConfig / the editor mapper.
    page: bindingSchema,
    totalPages: bindingSchema,
    pageSize: bindingSchema.optional(),
    // P252: `showInfo` toggles a measured info-text region ("Seite X von Y")
    // rendered below the prev/next controls. mapConfig passes the boolean through
    // to props.showInfo; the serializer emits `.webapp-pagination-info` only when
    // true. (The former `totalItems` binding and `variant` enum were vestigial —
    // never in the editor, never mapped, never consumed by serializer/renderer:
    // `totalPages` is the sole authoritative page-count source, and there was no
    // numbered/simple distinction to render. Both removed in P252; a legacy flow
    // that still carries them deploys unchanged since non-strict Zod drops unknown
    // keys and mapConfig never produced either field.)
    showInfo: z.boolean().optional(),
    events: z.array(z.enum(["pageChange"])).optional()
});

export type UiPaginationNodeDefinition = z.infer<typeof uiPaginationNodeDefinitionSchema>;

export const uiStepperNodeDefinitionSchema = mountableNodeSchema.extend({
    ...baseFieldsSchema,
    type: z.literal("ui-stepper"),
    steps: z.array(z.object({ id: z.string().min(1), label: z.string().min(1) })).min(2, "Stepper must declare at least two steps."),
    // P156 (ADR 0012): the canonical editor field `activeStep` (two-way value
    // typedInput: reads the active step from a Store/state binding + the existing
    // step-change event writes the chosen step back) compiles to this binding. The
    // legacy `activeStepPath` plain state path is migrated to a state binding by
    // webapp.js toComponentDefinitions / the editor mapper (mirrors ui-tabs P155).
    activeStep: bindingSchema.optional(),
    variant: z.enum(["horizontal", "vertical"]).optional(),
    // P251: `complete` was a dead event — no DOM source ever emitted it (the only
    // step interaction the client dispatches is `change` with params.value). Dropped
    // to the single honest event `stepChange`; a legacy flow that still carries
    // `complete` is filtered by webapp.js `filterSupportedStepperEvents` so it keeps
    // deploying. (The former `linear` field was likewise a dead field — in the schema
    // but never in the editor defaults and consumed nowhere — and was removed.)
    events: z.array(z.enum(["stepChange"])).optional()
});

export type UiStepperNodeDefinition = z.infer<typeof uiStepperNodeDefinitionSchema>;

// ── P16d: display nodes ──────────────────────────────────────────────────────

export const uiImageNodeDefinitionSchema = mountableNodeSchema.extend({
    ...baseFieldsSchema,
    type: z.literal("ui-image"),
    src: bindingSchema,
    // P151 (ADR 0012): alt and fallbackSrc are now binding-capable. A plain
    // string is still accepted for back-compat (e.g. from FlowBuilder tests).
    alt: z.union([bindingSchema, z.string()]).optional(),
    fallbackSrc: z.union([bindingSchema, z.string()]).optional(),
    width: z.union([z.number().int().positive(), z.string()]).optional(),
    height: z.union([z.number().int().positive(), z.string()]).optional(),
    fit: z.enum(["contain", "cover", "fill", "none"]).optional()
});

export type UiImageNodeDefinition = z.infer<typeof uiImageNodeDefinitionSchema>;

export const uiIconNodeDefinitionSchema = mountableNodeSchema.extend({
    ...baseFieldsSchema,
    type: z.literal("ui-icon"),
    // P69: backend-neutral { library, name } icon value; binding-capable. A bare
    // string is still accepted (back-compat — maps to the default library).
    icon: iconFieldSchema,
    // P159: canonical values are xs/sm/md/lg/xl tokens. A plain string is also
    // accepted for back-compat with existing nodes that store a legacy free CSS
    // value (e.g. "24", "1.5rem") — those round-trip through the editor via the
    // "(bestehend)" option and render as-is. The editor SelectBox only offers the
    // five tokens; the free value is preserved until the user actively picks a token.
    size: z.union([z.enum(["xs", "sm", "md", "lg", "xl"]), z.string()]).optional()
    // P238 (ADR 0039 §4): the plain-string `color: z.string()` OVERRIDE is GONE.
    // ui-icon now uses the BASE `color: bindingSchema.optional()` (the spread
    // above) — tokens + any colour + every binding kind, like every other node.
    // A deployed plain-string colour is migrated to a literal binding by the
    // ui-icon mapConfig BEFORE validation (nodes/webapp.js), so no deployed flow
    // loses its colour (P146/P149/P151 pattern).
});

export type UiIconNodeDefinition = z.infer<typeof uiIconNodeDefinitionSchema>;

// P171: the FIXED item-object schema — the contract between the author's data and
// the rendered row. `label` is required (the String shorthand sets exactly this).
// `id` = identity (rowId / render key, default array index); `value` (String|Number)
// = the application value, ALWAYS carried in the event (row.value), displayed only
// via the node-wide `displayValue`; `icon` = leading icon name. Extra fields are
// ignored — ui-list reads only these four (no implicit mapping).
const listItemObjectSchema = z.object({
    id: z.string().optional(),
    label: z.string().min(1),
    value: z.union([z.string(), z.number()]).optional(),
    icon: z.string().optional()
});

// P171: an element is a String shorthand (→ {label}) OR an item object. A static
// `items` array may mix both.
const listItemSchema = z.union([z.string(), listItemObjectSchema]);

export const uiListNodeDefinitionSchema = mountableNodeSchema.extend({
    ...baseFieldsSchema,
    type: z.literal("ui-list"),
    items: z.union([z.array(listItemSchema), bindingSchema]),
    // P180 (ADR 0021): displayType is a SEMANTIC INTENT enum — backend-neutral,
    // mapped per adapter. Vocab: plain (default look, back-compat), divided
    // (horizontal dividers between rows), grouped (bordered card-like rows,
    // list-group look), actionable (hover/focus affordance, pairs with
    // itemClick/selectable). Migration: old "default"→"plain", "compact"→"plain"
    // (compact was density, not a look; density is a future modifier).
    // Load-shim for old values lives in the editor (oneditprepare) and in the
    // serializer (graceful fallback).
    displayType: z.enum(["plain", "divided", "grouped", "actionable"]).optional(),
    // P180: ordered (boolean, default false) — switches ul↔ol. Backend-neutral.
    ordered: z.boolean().optional(),
    // P171: node-wide DISPLAY of a row's `value` — `none` (data-only, event only),
    // `secondary` (trailing text), `badge` (a badge pill in `badgeVariant`). The
    // value is always carried in the event regardless of this setting.
    displayValue: z.enum(["none", "secondary", "badge"]).optional(),
    // P171: semantic colour role of the value badge (only when displayValue=badge).
    // Same palette as ui-badge (SEVERITY_VARIANTS). Node-wide.
    badgeVariant: z.enum(SEVERITY_VARIANTS).optional(),
    // P173: single-select. `selectable` (default false when absent) turns on the
    // selection state — a row click marks the row and fires `itemSelect`. Multi-select
    // is out of scope.
    selectable: z.boolean().optional(),
    // P173: `selectedId` is the canonical TWO-WAY value binding on the selected row's
    // `id` (mirror of ui-tabs `activeTab`, P155): the renderer resolves it to mark the
    // matching row, and the `itemSelect` event carries the new id for the wired
    // write-back loop. An absent/empty/unmatched id marks no row. Only meaningful when
    // `selectable`.
    selectedId: bindingSchema.optional(),
    // P208: item-field mapping — WHICH raw-entity field is the label/value/id/icon
    // of a row. Lets a ui-list bind raw query entities ({_id, name, …}) directly,
    // without a reshape/Function. FLAT field names only (no dot-path) in this stage.
    // Absent ⇒ the historical hard-coded names (label/value/id/icon), so existing
    // shaped-item lists are unaffected. Only the DERIVED label/id/value/icon use the
    // mapping — `items` stays the raw list and `itemClick.row` keeps the full entity.
    labelField: z.string().min(1).default("label"),
    valueField: z.string().min(1).default("value"),
    idField: z.string().min(1).default("id"),
    iconField: z.string().min(1).default("icon"),
    events: z.array(z.enum(["itemClick", "itemSelect"])).optional(),
    // P172 (ADR 0015): common base fields — visible (boolean-state binding, absent
    // = always visible), disabled (boolean-state binding, locks row interaction)
    // and color (active value binding, non-variant node).
    visible: bindingSchema.optional(),
    disabled: bindingSchema.optional(),
    color: bindingSchema.optional()
});

export type UiListNodeDefinition = z.infer<typeof uiListNodeDefinitionSchema>;

export const uiAvatarNodeDefinitionSchema = mountableNodeSchema.extend({
    ...baseFieldsSchema,
    type: z.literal("ui-avatar"),
    // P94: `src` (runtime field name) is a full binding. In the editor it is labelled
    // "Image" and accepts all binding kinds including "store" and "literal asset:<id>".
    // Back-compat: old `srcPath` (plain state path) is still accepted in mapConfig.
    src: bindingSchema.optional(),
    // P94: initials is a full binding (literal/state/store/…). P93 stored it as a plain
    // string; the schema now accepts both. mapConfig and the serializer handle both.
    initials: z.union([z.string(), bindingSchema]).optional(),
    // P69: optional icon fallback (shown when no src/initials resolve).
    // Backend-neutral { library, name }; binding-capable.
    icon: iconFieldSchema.optional(),
    // P93: alt attribute removed — sl-avatar uses the `label` attr for a11y, not `alt`.
    size: z.enum(["xs", "sm", "md", "lg", "xl"]).optional(),
    shape: z.enum(["circle", "square"]).optional(),
    // P94: semantic colour role. Bootstrap supports this natively via CSS classes.
    // Shoelace sl-avatar has no native variant attr; the serializer emits data-variant
    // so CSS (or a Bootstrap adapter) can style it. Editor shows a Shoelace warning.
    variant: z.enum(SEVERITY_VARIANTS).optional()
});

export type UiAvatarNodeDefinition = z.infer<typeof uiAvatarNodeDefinitionSchema>;

export const uiDividerNodeDefinitionSchema = mountableNodeSchema.extend({
    ...baseFieldsSchema,
    type: z.literal("ui-divider"),
    orientation: z.enum(["horizontal", "vertical"]).optional(),
    // P150 (ADR 0012): `label` accepts the canonical value-binding set — a
    // literal string or a dynamic binding object. A legacy plain string is
    // accepted directly (z.string() branch). Optional: a divider can have no label.
    label: z.union([bindingSchema, z.string()]).optional()
});

export type UiDividerNodeDefinition = z.infer<typeof uiDividerNodeDefinitionSchema>;

// ── P57: ui-log — persistent inspectable error/log display ──────────────────
// Subscribes to the app's SSE "error" channel and renders structured log
// entries (ADR 0006 shape) as a readable list. Distinct from ui-toast:
// ui-log is persistent and aimed at operator inspection, not end-user toasts.

export const uiLogNodeDefinitionSchema = mountableNodeSchema.extend({
    ...baseFieldsSchema,
    type: z.literal("ui-log"),
    // Which severity levels to display. Defaults to all levels when unset.
    minSeverity: errorSeveritySchema.optional(),
    // Maximum number of entries to retain in the list (oldest dropped first).
    maxEntries: z.number().int().positive().optional(),
    // Whether the panel starts collapsed or expanded.
    collapsed: z.boolean().optional()
});

export type UiLogNodeDefinition = z.infer<typeof uiLogNodeDefinitionSchema>;

export const uiNodeDefinitionSchema = z.union([
    uiAppNodeDefinitionSchema,
    uiRouteNodeDefinitionSchema,
    uiContainerNodeDefinitionSchema,
    uiRepeatNodeDefinitionSchema,
    uiComponentDefinitionNodeDefinitionSchema,
    uiComponentInstanceNodeDefinitionSchema,
    uiTextNodeDefinitionSchema,
    uiButtonNodeDefinitionSchema,
    uiTableNodeDefinitionSchema,
    uiInputNodeDefinitionSchema,
    uiSelectNodeDefinitionSchema,
    uiCheckboxNodeDefinitionSchema,
    uiRadioNodeDefinitionSchema,
    uiSwitchNodeDefinitionSchema,
    uiTextareaNodeDefinitionSchema,
    uiDatepickerNodeDefinitionSchema,
    uiSliderNodeDefinitionSchema,
    uiDialogNodeDefinitionSchema,
    uiStoreNodeDefinitionSchema,
    uiQueryNodeDefinitionSchema,
    uiStoreReadNodeDefinitionSchema,
    uiStoreActionNodeDefinitionSchema,
    uiQueryActionNodeDefinitionSchema,
    uiActionNodeDefinitionSchema,
    uiAlertNodeDefinitionSchema,
    uiToastNodeDefinitionSchema,
    uiProgressNodeDefinitionSchema,
    uiSkeletonNodeDefinitionSchema,
    uiBadgeNodeDefinitionSchema,
    uiEmptyStateNodeDefinitionSchema,
    uiTabsNodeDefinitionSchema,
    uiTabNodeDefinitionSchema,
    uiAccordionNodeDefinitionSchema,
    uiAccordionSectionNodeDefinitionSchema,
    uiBreadcrumbNodeDefinitionSchema,
    uiMenuNodeDefinitionSchema,
    uiPaginationNodeDefinitionSchema,
    uiStepperNodeDefinitionSchema,
    uiImageNodeDefinitionSchema,
    uiIconNodeDefinitionSchema,
    uiListNodeDefinitionSchema,
    uiAvatarNodeDefinitionSchema,
    uiDividerNodeDefinitionSchema,
    uiLogNodeDefinitionSchema
]);

const uiNodeSchemaByType: Record<string, z.ZodTypeAny> = {
    "ui-app": uiAppNodeDefinitionSchema,
    "ui-route": uiRouteNodeDefinitionSchema,
    "ui-container": uiContainerNodeDefinitionSchema,
    "ui-repeat": uiRepeatNodeDefinitionSchema,
    "ui-component-definition": uiComponentDefinitionNodeDefinitionSchema,
    "ui-component-instance": uiComponentInstanceNodeDefinitionSchema,
    "ui-text": uiTextNodeDefinitionSchema,
    "ui-button": uiButtonNodeDefinitionSchema,
    "ui-table": uiTableNodeDefinitionSchema,
    "ui-input": uiInputNodeDefinitionSchema,
    "ui-select": uiSelectNodeDefinitionSchema,
    "ui-checkbox": uiCheckboxNodeDefinitionSchema,
    "ui-radio": uiRadioNodeDefinitionSchema,
    "ui-switch": uiSwitchNodeDefinitionSchema,
    "ui-textarea": uiTextareaNodeDefinitionSchema,
    "ui-datepicker": uiDatepickerNodeDefinitionSchema,
    "ui-slider": uiSliderNodeDefinitionSchema,
    "ui-dialog": uiDialogNodeDefinitionSchema,
    "ui-store": uiStoreNodeDefinitionSchema,
    "ui-query": uiQueryNodeDefinitionSchema,
    "ui-store-read": uiStoreReadNodeDefinitionSchema,
    "ui-store-action": uiStoreActionNodeDefinitionSchema,
    "ui-query-action": uiQueryActionNodeDefinitionSchema,
    "ui-action": uiActionNodeDefinitionSchema,
    "ui-alert": uiAlertNodeDefinitionSchema,
    "ui-toast": uiToastNodeDefinitionSchema,
    "ui-progress": uiProgressNodeDefinitionSchema,
    "ui-skeleton": uiSkeletonNodeDefinitionSchema,
    "ui-badge": uiBadgeNodeDefinitionSchema,
    "ui-empty-state": uiEmptyStateNodeDefinitionSchema,
    "ui-tabs": uiTabsNodeDefinitionSchema,
    "ui-tab": uiTabNodeDefinitionSchema,
    "ui-accordion": uiAccordionNodeDefinitionSchema,
    "ui-accordion-section": uiAccordionSectionNodeDefinitionSchema,
    "ui-breadcrumb": uiBreadcrumbNodeDefinitionSchema,
    "ui-menu": uiMenuNodeDefinitionSchema,
    "ui-pagination": uiPaginationNodeDefinitionSchema,
    "ui-stepper": uiStepperNodeDefinitionSchema,
    "ui-image": uiImageNodeDefinitionSchema,
    "ui-icon": uiIconNodeDefinitionSchema,
    "ui-list": uiListNodeDefinitionSchema,
    "ui-avatar": uiAvatarNodeDefinitionSchema,
    "ui-divider": uiDividerNodeDefinitionSchema,
    "ui-log": uiLogNodeDefinitionSchema
};

export type UiNodeDefinition = z.infer<typeof uiNodeDefinitionSchema>;

export function validateUiNodeDefinition(input: unknown): { success: true; data: UiNodeDefinition } | { success: false; error: string } {
    const nodeType = input != null && typeof input === "object" && "type" in input
        ? String((input as Record<string, unknown>).type)
        : undefined;

    const specificSchema = nodeType ? uiNodeSchemaByType[nodeType] : undefined;

    if (specificSchema) {
        const result = specificSchema.safeParse(input);
        if (!result.success) {
            return { success: false, error: formatValidationIssues(result.error.issues) };
        }
        return { success: true, data: result.data as UiNodeDefinition };
    }

    const result = uiNodeDefinitionSchema.safeParse(input);

    if (!result.success) {
        return {
            success: false,
            error: nodeType
                ? `Unknown node type: ${nodeType}`
                : formatValidationIssues(result.error.issues)
        };
    }

    return {
        success: true,
        data: result.data
    };
}
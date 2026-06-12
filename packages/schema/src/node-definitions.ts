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
    routePathSchema,
    SEVERITY_VARIANTS,
    TEXT_COLOR_VARIANTS,
    TEXT_STYLES
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
    if (!node.mount && !node.parent) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Component nodes must declare either a mount or a parent path.",
            path: ["mount"]
        });
    }
});

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
    mode: z.enum(["development", "production"]).optional()
});

export type UiAppNodeDefinition = z.infer<typeof uiAppNodeDefinitionSchema>;

export const uiContainerNodeDefinitionSchema = mountableNodeSchema.extend({
    type: z.literal("ui-container"),
    layout: standardLayoutPresetSchema,
    // P49: true Ebene-2 variant (surface role). Default "card".
    variant: z.enum(CONTAINER_VARIANTS).optional(),
    events: z.array(z.enum(["onShow", "onHide"])).optional()
});

export type UiContainerNodeDefinition = z.infer<typeof uiContainerNodeDefinitionSchema>;

export const uiRouteNodeDefinitionSchema = identifiedNodeSchema.extend({
    type: z.literal("ui-route"),
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
    parent: identifierSchema.optional(),
    title: z.string().min(1, "Dialog titles must not be empty.").optional(),
    layout: standardLayoutPresetSchema,
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
    type: z.literal("ui-text"),
    value: bindingSchema,
    // P111: `style` is the typographic ROLE (maps to an HTML element). Default
    // "body". Legacy configs that stored the role in `variant` are migrated in
    // the ui-text mapConfig before validation.
    style: z.enum(TEXT_STYLES).optional(),
    // P111: `variant` is the semantic COLOUR (aligned with ui-button/badge/alert
    // and Shoelace/Bootstrap-Vue). Default "default" (inherit). The old size
    // field (P71) was removed — typographic sizing is governed by `style`.
    variant: z.enum(TEXT_COLOR_VARIANTS).optional()
});

export type UiTextNodeDefinition = z.infer<typeof uiTextNodeDefinitionSchema>;

export const uiButtonNodeDefinitionSchema = mountableNodeSchema.extend({
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
    type: z.literal("ui-table"),
    columns: z.array(tableColumnDefinitionSchema).min(1, "Tables must declare at least one column."),
    rows: bindingSchema,
    footer: z.boolean().optional(),
    events: z.array(z.enum(["rowSelect", "rowAction", "checkboxChange", "cellSelect"])).optional(),
    selectAction: z.string().min(1, "Table select actions must not be empty.").optional()
});

export type UiTableNodeDefinition = z.infer<typeof uiTableNodeDefinitionSchema>;

export const uiInputNodeDefinitionSchema = mountableNodeSchema.extend({
    type: z.literal("ui-input"),
    // P145 (ADR 0012): label accepts the canonical value-binding set — a literal
    // string or a dynamic binding object. Back-compat: a plain string from a
    // pre-P145 flow is still accepted and treated as a literal label.
    label: z.union([bindingSchema, z.string().min(1, "Input labels must not be empty.")]),
    value: bindingSchema,
    storeId: identifierSchema.optional(),
    path: z.string().min(1, "Input store paths must not be empty.").optional(),
    inputType: z.enum(["text", "email", "number"]).default("text"),
    // P49: true Ebene-2 variant (field style). Default "default".
    variant: z.enum(INPUT_VARIANTS).optional(),
    // P71: three-step size (sm/md/lg).
    size: componentSizeSchema.optional(),
    placeholder: z.string().min(1, "Input placeholders must not be empty.").optional(),
    disabled: bindingSchema.optional()
}).superRefine((input, context) => {
    if ((input.storeId && !input.path) || (!input.storeId && input.path)) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Inputs must declare both storeId and path when they write to a store.",
            path: [input.storeId ? "path" : "storeId"]
        });
    }
});

export type UiInputNodeDefinition = z.infer<typeof uiInputNodeDefinitionSchema>;

export const uiStoreScopeSchema = z.enum(["any", "broadcast-only", "client-only"]);
export type UiStoreScope = z.infer<typeof uiStoreScopeSchema>;

export const uiStoreNodeDefinitionSchema = identifiedNodeSchema.extend({
    type: z.literal("ui-store"),
    parent: identifierSchema.optional(),
    statePath: z.string().min(1, "Stores must declare a state path."),
    initialValue: z.unknown().optional(),
    persist: z.boolean().optional(),
    scope: uiStoreScopeSchema.optional()
});

export type UiStoreNodeDefinition = z.infer<typeof uiStoreNodeDefinitionSchema>;

export const uiQueryNodeDefinitionSchema = identifiedNodeSchema.extend({
    type: z.literal("ui-query"),
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

// P118 (ADR 0011 §1): navigate target-mode exclusivity. The stored `targetMode`
// declares the single intent; only that mode's fields may be set so a config can
// never carry a double configuration:
//   • route ⇒ routeId set; `to` must NOT be set.
//   • url   ⇒ `to` set; routeId must NOT be set.
//   • wire  ⇒ neither routeId nor `to`.
// Violations are validation (compile-time) errors. Only enforced for navigate
// actions (other verbs ignore targetMode). Absent targetMode skips the check
// (legacy configs are migrated to a mode on load before they reach here).
function applyNavigateTargetModeExclusivity(
    def: {
        actionType?: string;
        targetMode?: string;
        routeId?: string;
        to?: string;
    },
    ctx: z.RefinementCtx
): void {
    if (def.actionType !== "navigate" || !def.targetMode) {
        return;
    }
    const hasTo = typeof def.to === "string" && def.to.length > 0;
    const hasRouteId = typeof def.routeId === "string" && def.routeId.length > 0;
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
                path: ["routeId"],
                message: "targetMode 'url' must not set `routeId` — the `to` URL is built whole."
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
                path: ["routeId"],
                message: "targetMode 'wire' must not set `routeId` — the wired route is the target."
            });
        }
    }
}

export const uiActionNodeDefinitionSchema = identifiedNodeSchema.extend({
    type: z.literal("ui-action"),
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
    // app-globally to the route's `path` at action time.
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

export const uiNavigationNodeDefinitionSchema = identifiedNodeSchema.extend({
    type: z.literal("ui-navigation"),
    parent: identifierSchema.optional(),
    // P119 (ADR 0011 §5): ui-navigation aligns to the ui-action navigate model —
    // the editor offers the same wire | route | url switcher. The runtime still
    // treats ui-navigation as a `url` target via `to` (P118 node-set mapping), so
    // `to` is now OPTIONAL (a route-mode ui-navigation carries routeId, no `to`).
    to: routePathSchema.optional()
});

export type UiNavigationNodeDefinition = z.infer<typeof uiNavigationNodeDefinitionSchema>;

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
    type: z.literal("ui-select"),
    // P133: label accepts the canonical value-binding set (ADR 0012) — a literal
    // non-empty string OR a binding object (store/query/route-param/…).
    label: z.union([bindingSchema, z.string().min(1, "Select labels must not be empty.")]),
    value: bindingSchema,
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
    type: z.literal("ui-checkbox"),
    // P97: label is now a full binding (literal string or dynamic binding).
    label: z.union([bindingSchema, z.string().min(1, "Checkbox labels must not be empty.")]),
    value: bindingSchema,
    // P97: size — xs / sm / md (default) / lg / xl (Shoelace size tokens).
    size: z.enum(["xs", "sm", "md", "lg", "xl"]).optional(),
    disabled: bindingSchema.optional()
});

export type UiCheckboxNodeDefinition = z.infer<typeof uiCheckboxNodeDefinitionSchema>;

export const uiRadioNodeDefinitionSchema = mountableNodeSchema.extend({
    type: z.literal("ui-radio"),
    // P136 (ADR 0012): label accepts the canonical value-binding set — a literal
    // non-empty string OR a binding object (store/query/route-param/…), mirroring
    // ui-select (P133).
    label: z.union([bindingSchema, z.string().min(1, "Radio labels must not be empty.")]),
    value: bindingSchema,
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
    type: z.literal("ui-switch"),
    value: bindingSchema,
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
    type: z.literal("ui-textarea"),
    // P148 (ADR 0012): label accepts the canonical value-binding set — a literal
    // string or a dynamic binding object. Back-compat: a plain string from a
    // pre-P148 flow is still accepted and treated as a literal label.
    label: z.union([bindingSchema, z.string().min(1, "Textarea labels must not be empty.")]),
    value: bindingSchema,
    // P148 (ADR 0012): placeholder accepts the canonical value-binding set.
    // Back-compat: a plain string from a pre-P148 flow is still accepted.
    placeholder: z.union([bindingSchema, z.string().min(1, "Textarea placeholders must not be empty.")]).optional(),
    rows: z.number().int().positive().optional(),
    maxLength: z.number().int().positive().optional(),
    // P71: three-step size (sm/md/lg).
    size: componentSizeSchema.optional(),
    disabled: bindingSchema.optional()
});

export type UiTextareaNodeDefinition = z.infer<typeof uiTextareaNodeDefinitionSchema>;

export const uiDatepickerNodeDefinitionSchema = mountableNodeSchema.extend({
    type: z.literal("ui-datepicker"),
    // P98: label is now a full binding (literal string or dynamic binding).
    label: z.union([bindingSchema, z.string().min(1, "Datepicker labels must not be empty.")]),
    value: bindingSchema,
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
    type: z.literal("ui-slider"),
    value: bindingSchema,
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
    parent: identifierSchema.optional(),
    // P49b: unified with SEVERITY_VARIANTS — same single source of truth as ui-alert.
    severity: z.enum(SEVERITY_VARIANTS).optional(),
    duration: z.number().int().min(0).optional(),
    position: z.enum(["top-right", "top-center", "bottom-right", "bottom-center"]).optional()
});

export type UiToastNodeDefinition = z.infer<typeof uiToastNodeDefinitionSchema>;

export const uiProgressNodeDefinitionSchema = mountableNodeSchema.extend({
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
    showValue: z.boolean().optional()
});

export type UiProgressNodeDefinition = z.infer<typeof uiProgressNodeDefinitionSchema>;

export const uiSkeletonNodeDefinitionSchema = mountableNodeSchema.extend({
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

const tabItemSchema = z.object({
    id: z.string().min(1),
    label: z.string().min(1)
});

export const uiTabsNodeDefinitionSchema = mountableNodeSchema.extend({
    type: z.literal("ui-tabs"),
    tabs: z.array(tabItemSchema).min(1, "Tabs must declare at least one tab."),
    // P155 (ADR 0012): the canonical editor field `activeTab` (two-way value
    // typedInput: reads the active tab from a Store/state binding + the existing
    // tab-change event writes the chosen tab back) compiles to this binding. The
    // legacy `activeTabPath` plain state path is migrated to a state binding by
    // webapp.js mapConfig / the editor mapper (P137/P154 shim).
    activeTab: bindingSchema.optional(),
    variant: z.enum(["line", "contained", "pills"]).optional(),
    events: z.array(z.enum(["tabChange"])).optional()
});

export type UiTabsNodeDefinition = z.infer<typeof uiTabsNodeDefinitionSchema>;

const accordionSectionSchema = z.object({
    id: z.string().min(1),
    label: z.string().min(1)
});

export const uiAccordionNodeDefinitionSchema = mountableNodeSchema.extend({
    type: z.literal("ui-accordion"),
    sections: z.array(accordionSectionSchema).min(1, "Accordion must declare at least one section."),
    multiple: z.boolean().optional(),
    defaultOpen: z.union([identifierSchema, z.array(identifierSchema)]).optional(),
    events: z.array(z.enum(["sectionOpen", "sectionClose"])).optional()
});

export type UiAccordionNodeDefinition = z.infer<typeof uiAccordionNodeDefinitionSchema>;

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
    type: z.literal("ui-menu"),
    // P49: sidebar/topbar/dropdown is a DISPLAY TYPE (layout mode), not a
    // semantic variant.
    displayType: z.enum(["sidebar", "topbar", "dropdown"]).optional(),
    // P157 (ADR 0012): `items` is the canonical STRUCTURAL array source — either a
    // static array of menu items (the menu renders its entries itself; NOT a
    // repeats case, vgl. ui-list P140) OR a binding (store/query/reactive/
    // json-literal) resolved structurally by the renderer (shared P133 path).
    items: z.union([z.array(menuItemSchema), bindingSchema]),
    // P157 (ADR 0012): `activeItem` is the read-only active-route binding (editor
    // field `activeRoute`); the matching item is highlighted by the serializer.
    activeItem: bindingSchema.optional(),
    collapsed: bindingSchema.optional(),
    // P75: clicking a navigable item (one with `route`/`path`, not an external
    // `href`) emits a `navigate` event on the node's output port. See the
    // ui-breadcrumb note above for the dispatch/serializer roles of this contract.
    events: z.array(z.enum(["navigate"])).optional()
});

export type UiMenuNodeDefinition = z.infer<typeof uiMenuNodeDefinitionSchema>;

export const uiPaginationNodeDefinitionSchema = mountableNodeSchema.extend({
    type: z.literal("ui-pagination"),
    // P154 (ADR 0012): the canonical editor field `currentPage` (two-way value
    // typedInput: read source + change-event write-back) compiles to this `page`
    // binding; the editor field `total` (read-only value typedInput) compiles to
    // `totalPages`. Legacy `currentPagePath` / `totalPath` plain state paths are
    // migrated to state bindings by webapp.js mapConfig / the editor mapper.
    page: bindingSchema,
    totalPages: bindingSchema,
    pageSize: bindingSchema.optional(),
    totalItems: bindingSchema.optional(),
    showInfo: z.boolean().optional(),
    variant: z.enum(["numbered", "simple"]).optional(),
    events: z.array(z.enum(["pageChange"])).optional()
});

export type UiPaginationNodeDefinition = z.infer<typeof uiPaginationNodeDefinitionSchema>;

export const uiStepperNodeDefinitionSchema = mountableNodeSchema.extend({
    type: z.literal("ui-stepper"),
    steps: z.array(z.object({ id: z.string().min(1), label: z.string().min(1) })).min(2, "Stepper must declare at least two steps."),
    // P156 (ADR 0012): the canonical editor field `activeStep` (two-way value
    // typedInput: reads the active step from a Store/state binding + the existing
    // step-change event writes the chosen step back) compiles to this binding. The
    // legacy `activeStepPath` plain state path is migrated to a state binding by
    // webapp.js toComponentDefinitions / the editor mapper (mirrors ui-tabs P155).
    activeStep: bindingSchema.optional(),
    variant: z.enum(["horizontal", "vertical"]).optional(),
    linear: z.boolean().optional(),
    events: z.array(z.enum(["stepChange", "complete"])).optional()
});

export type UiStepperNodeDefinition = z.infer<typeof uiStepperNodeDefinitionSchema>;

// ── P16d: display nodes ──────────────────────────────────────────────────────

export const uiImageNodeDefinitionSchema = mountableNodeSchema.extend({
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
    type: z.literal("ui-icon"),
    // P69: backend-neutral { library, name } icon value; binding-capable. A bare
    // string is still accepted (back-compat — maps to the default library).
    icon: iconFieldSchema,
    // P159: canonical values are xs/sm/md/lg/xl tokens. A plain string is also
    // accepted for back-compat with existing nodes that store a legacy free CSS
    // value (e.g. "24", "1.5rem") — those round-trip through the editor via the
    // "(bestehend)" option and render as-is. The editor SelectBox only offers the
    // five tokens; the free value is preserved until the user actively picks a token.
    size: z.union([z.enum(["xs", "sm", "md", "lg", "xl"]), z.string()]).optional(),
    color: z.string().optional()
});

export type UiIconNodeDefinition = z.infer<typeof uiIconNodeDefinitionSchema>;

const listItemSchema = z.object({
    id: z.string().optional(),
    label: z.string().min(1),
    value: z.string().optional(),
    icon: z.string().optional()
});

export const uiListNodeDefinitionSchema = mountableNodeSchema.extend({
    type: z.literal("ui-list"),
    items: z.union([z.array(listItemSchema), bindingSchema]),
    // P49: list render mode is a DISPLAY TYPE, not a semantic variant.
    displayType: z.enum(["default", "divided", "compact"]).optional(),
    events: z.array(z.enum(["itemClick", "itemSelect"])).optional()
});

export type UiListNodeDefinition = z.infer<typeof uiListNodeDefinitionSchema>;

export const uiAvatarNodeDefinitionSchema = mountableNodeSchema.extend({
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
    uiActionNodeDefinitionSchema,
    uiNavigationNodeDefinitionSchema,
    uiAlertNodeDefinitionSchema,
    uiToastNodeDefinitionSchema,
    uiProgressNodeDefinitionSchema,
    uiSkeletonNodeDefinitionSchema,
    uiBadgeNodeDefinitionSchema,
    uiEmptyStateNodeDefinitionSchema,
    uiTabsNodeDefinitionSchema,
    uiAccordionNodeDefinitionSchema,
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
    "ui-action": uiActionNodeDefinitionSchema,
    "ui-navigation": uiNavigationNodeDefinitionSchema,
    "ui-alert": uiAlertNodeDefinitionSchema,
    "ui-toast": uiToastNodeDefinitionSchema,
    "ui-progress": uiProgressNodeDefinitionSchema,
    "ui-skeleton": uiSkeletonNodeDefinitionSchema,
    "ui-badge": uiBadgeNodeDefinitionSchema,
    "ui-empty-state": uiEmptyStateNodeDefinitionSchema,
    "ui-tabs": uiTabsNodeDefinitionSchema,
    "ui-accordion": uiAccordionNodeDefinitionSchema,
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
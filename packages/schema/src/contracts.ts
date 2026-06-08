import { z } from "zod";

export const identifierSchema = z
    .string()
    .min(1, "IDs must not be empty.");

export const regionNameSchema = z
    .string()
    .min(1, "Region names must not be empty.");

export const routePathSchema = z
    .string()
    .min(1, "Route paths must not be empty.")
    .startsWith("/", "Route paths must start with '/'.");

/**
 * Path schema for a ui-route node's own `path` field. Identical to
 * {@link routePathSchema} but additionally forbids "/" — the root path is
 * reserved for the implicit app root route (ui-app owns "/"). Home-page content
 * mounts directly into the ui-app's layout slots (e.g. `appId.content`) instead
 * of declaring a `path: "/"` route. See docs/nodes/structure/ui-route.md.
 *
 * Navigation destinations (navigationDefinitionSchema.to, ui.navigation.to) keep
 * using routePathSchema: navigating *to* "/" (the app root) is always valid.
 */
export const routeNodePathSchema = routePathSchema.refine((path) => path !== "/", {
    message: "Route path '/' is reserved for the implicit app root. Mount content directly to the ui-app slots (e.g. appId.content) instead."
});

/**
 * Binding kinds that require a path (i.e. they are not literal).
 *
 * `store` is path-bearing too: its `path` holds the referenced ui-store node's
 * id, which the renderer resolves to the store's current value via its
 * statePath. Referencing the store by id (not by statePath) keeps the binding
 * robust against later statePath renames.
 */
export const DYNAMIC_BINDING_KINDS = ["state", "query", "routeParam", "msg", "flow", "global", "jsonata", "env", "store"] as const;

export const bindingSchema = z
    .object({
        kind: z.enum(["state", "query", "routeParam", "literal", "msg", "flow", "global", "jsonata", "env", "store"]),
        path: z.string().min(1, "Binding paths must not be empty.").optional(),
        value: z.unknown().optional(),
        fallback: z.unknown().optional()
    })
    .superRefine((binding, context) => {
        if (binding.kind === "literal") {
            if (binding.value === undefined) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Literal bindings require a value."
                });
            }

            return;
        }

        if (!binding.path) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Bindings of kind '${binding.kind}' require a path.`
            });
        }
    });

export type BindingDefinition = z.infer<typeof bindingSchema>;

/**
 * P69 — Icon system.
 *
 * Icon values are backend-neutral: an icon is identified by a `name` within an
 * optional `library`. When the library is omitted, the renderer falls back to
 * {@link DEFAULT_ICON_LIBRARY} — the vendored Bootstrap-Icons set that ships with
 * the Shoelace assets (ADR 0008). A backend other than Shoelace is free to map
 * the same `{ library, name }` pair onto its own icon mechanism (ADR 0002).
 */
export const DEFAULT_ICON_LIBRARY = "default";

/** A literal icon value: `{ library?, name }`. */
export const iconValueSchema = z.object({
    library: z.string().min(1, "Icon library names must not be empty.").optional(),
    name: z.string().min(1, "Icon names must not be empty.")
});

export type IconValue = z.infer<typeof iconValueSchema>;

/**
 * The shape stored on a node's icon field. It is binding-capable (P67): it may be
 *  - a bare string (back-compat: a plain icon name, or the `library:name`
 *    shorthand),
 *  - a literal `{ library?, name }` icon value, or
 *  - a dynamic {@link bindingSchema} binding (state/query/msg/store/…), so the
 *    icon can be driven at runtime.
 *
 * A literal icon value is distinguished from a binding by the presence of a
 * `name` field (icon value) vs. a `kind` field (binding).
 */
export const iconFieldSchema = z.union([
    z.string().min(1, "Icon names must not be empty."),
    iconValueSchema,
    bindingSchema
]);

export type IconField = z.infer<typeof iconFieldSchema>;

/**
 * Normalise any accepted *literal* icon representation into a canonical
 * `{ library, name }` value with the library always present. Returns `undefined`
 * for empty/nullish input. Dynamic bindings (objects carrying `kind`) are not
 * literal values and are returned as `undefined` here; callers resolve the
 * binding first, then normalise the result.
 *
 * Accepts:
 *  - `"home"`               → `{ library: DEFAULT_ICON_LIBRARY, name: "home" }`
 *  - `"lucide:user"`        → `{ library: "lucide", name: "user" }`
 *  - `{ name: "check" }`    → `{ library: DEFAULT_ICON_LIBRARY, name: "check" }`
 *  - `{ library, name }`    → unchanged
 */
export function normalizeIconValue(input: unknown): IconValue | undefined {
    if (input === undefined || input === null) {
        return undefined;
    }

    if (typeof input === "string") {
        const trimmed = input.trim();
        if (trimmed.length === 0) {
            return undefined;
        }

        const sep = trimmed.indexOf(":");
        if (sep > 0 && sep < trimmed.length - 1) {
            return { library: trimmed.slice(0, sep), name: trimmed.slice(sep + 1) };
        }

        return { library: DEFAULT_ICON_LIBRARY, name: trimmed };
    }

    if (typeof input === "object") {
        const obj = input as Record<string, unknown>;
        if (typeof obj.name === "string" && obj.name.length > 0) {
            const library = typeof obj.library === "string" && obj.library.length > 0
                ? obj.library
                : DEFAULT_ICON_LIBRARY;
            return { library, name: obj.name };
        }
    }

    return undefined;
}

export const slotDefinitionSchema = z.object({
    name: regionNameSchema,
    title: z.string().min(1, "Slot titles must not be empty.").optional()
});

export type SlotDefinition = z.infer<typeof slotDefinitionSchema>;

export interface LayoutDefinition {
    id: string;
    title?: string;
    slots: SlotDefinition[];
}

export const layoutDefinitionSchema: z.ZodType<LayoutDefinition> = z
    .object({
        id: identifierSchema,
        title: z.string().min(1, "Layout titles must not be empty.").optional(),
        slots: z.array(slotDefinitionSchema).min(1, "Layouts must declare at least one slot.")
    })
    .superRefine((layout, context) => {
        const seenNames = new Set<string>();

        layout.slots.forEach((slot, index) => {
            if (seenNames.has(slot.name)) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `Layout '${layout.id}' declares slot '${slot.name}' more than once.`,
                    path: ["slots", index, "name"]
                });
            }

            seenNames.add(slot.name);
        });
    });

export const routeDefinitionSchema = z.object({
    id: identifierSchema,
    // path uses routePathSchema (NOT routeNodePathSchema): the compiled AppModel
    // legitimately contains the implicit app root route with path "/" (id === appId,
    // produced by createAppRootRoute). The "/" prohibition applies to authored
    // ui-route NODES only — enforced via routeNodePathSchema in node-definitions.ts.
    path: routePathSchema,
    title: z.string().min(1, "Route titles must not be empty.").optional(),
    layoutId: identifierSchema
});

export type RouteDefinition = z.infer<typeof routeDefinitionSchema>;

export const dialogDefinitionSchema = z.object({
    id: identifierSchema,
    title: z.string().min(1, "Dialog titles must not be empty.").optional(),
    layoutId: identifierSchema,
    routeId: identifierSchema.optional(),
    modal: z.boolean().default(true),
    // P64: see uiDialogNodeDefinitionSchema.closable. false → native no-header.
    closable: z.boolean().default(true)
});

export type DialogDefinition = z.infer<typeof dialogDefinitionSchema>;

export const storeDefinitionSchema = z.object({
    id: identifierSchema,
    statePath: z.string().min(1, "Stores must declare a state path."),
    initialValue: z.unknown().optional()
});

export type StoreDefinition = z.infer<typeof storeDefinitionSchema>;

export const storeOperationSchema = z.object({
    id: identifierSchema,
    op: z.enum(["set", "patch", "delete", "replace", "reset"]),
    path: z.string().min(1, "Store operation paths must not be empty.").optional(),
    value: z.unknown().optional()
}).superRefine((operation, context) => {
    if (["set", "patch", "delete"].includes(operation.op) && !operation.path) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Store operation '${operation.op}' requires a path.`,
            path: ["path"]
        });
    }

    if (["set", "patch", "replace"].includes(operation.op) && operation.value === undefined) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Store operation '${operation.op}' requires a value.`,
            path: ["value"]
        });
    }
});

export type StoreOperation = z.infer<typeof storeOperationSchema>;

export const uiStoreMessageSchema = z.object({
    ui: z.object({
        store: z.object({
            id: identifierSchema,
            event: z.literal("changed"),
            op: z.enum(["set", "patch", "delete", "replace", "reset"]),
            path: z.string().optional(),
            fullPath: z.string().min(1, "Store notifications must include a full path."),
            value: z.unknown().optional(),
            previousValue: z.unknown().optional(),
            origin: z.enum(["node-red", "client"]).default("node-red")
        })
    })
});

export type UiStoreMessage = z.infer<typeof uiStoreMessageSchema>;

export const queryDefinitionSchema = z.object({
    id: identifierSchema,
    queryPath: z.string().min(1, "Queries must declare a query path."),
    source: z.string().min(1, "Query sources must not be empty.").optional(),
    refreshAction: z.string().min(1, "Refresh actions must not be empty.").optional(),
});

export type QueryDefinition = z.infer<typeof queryDefinitionSchema>;

// Actions change only the UI's INTERACTION state (navigation, visibility,
// enabled state, focus, reset) — never business data. See
// docs/nodes/concepts/actions.md. CRUD belongs in the wired flow, not here;
// the former "submit"/"remove" data actions were removed in P29 (ADR 0003).
// P53 (ADR 0005): the canonical interaction verb set, in three semantic classes:
//   presence:    show / hide   — element visibility (any element)
//   disclosure:  open / close  — disclosure state of an openable, visible element
//                                (dialog, drawer, accordion section, details, tree
//                                branch). openDialog / closeDialog are kept as
//                                back-compat aliases.
//   single:      select        — single-active among siblings (tab, stepper, menu)
//   plus navigate, enable / disable, focus, reset.
// submit / remove stay removed (P29 / ADR 0003) — CRUD belongs in the wired flow.
export const actionTypeSchema = z.enum([
    "navigate",
    "show",
    "hide",
    "open",
    "close",
    "select",
    "enable",
    "disable",
    "focus",
    "reset",
    // back-compat aliases for open / close (P53 / ADR 0005):
    "openDialog",
    "closeDialog",
    // legacy pure pass-through verb (pre-P53): pushes no interaction overlay
    // change; the wired flow handles everything. Kept for existing flows.
    "trigger"
]);

export type ActionType = z.infer<typeof actionTypeSchema>;

export const actionTargetModeSchema = z.enum(["out-port", "path"]);

export type ActionTargetMode = z.infer<typeof actionTargetModeSchema>;

// P66 (ADR 0007): the navigate `to` destination is a Node-RED typedInput — the
// path can be a static string ("str"), taken from the message ("msg"), a flow /
// global context value, or computed by a JSONata expression. `to` holds the
// value, `toType` the typedInput type (default "str", a literal path).
export const actionToTypeSchema = z.enum(["str", "msg", "flow", "global", "jsonata"]);

export type ActionToType = z.infer<typeof actionToTypeSchema>;

// P66: named URL parameters for a navigate action. Keys/values are strings —
// they fill the `:placeholder` segments of the target route's path (Scenario 1:
// a wired ui-route builds the location from its OWN path + these params).
export const actionParamsSchema = z.record(z.string(), z.string());

export type ActionParams = z.infer<typeof actionParamsSchema>;

export const actionDefinitionSchema = z.object({
    id: identifierSchema,
    actionType: actionTypeSchema.optional(),
    // targetMode and target are deprecated — wiring the output port is the preferred model.
    targetMode: actionTargetModeSchema.optional(),
    target: z.string().min(1, "Action targets must not be empty.").optional(),
    // P53: open / close / select granularity — a sub-id within the target element
    // (accordion section, tree branch, tab name).
    part: z.string().min(1, "Action parts must not be empty.").optional(),
    // P66: `to` is a navigate destination typedInput; `toType` is its type.
    // Optional everywhere because Scenario 1 (wired to a ui-route) carries no
    // `to` at all — the wired route supplies the path from its own definition.
    to: z.string().min(1, "Navigate actions must declare a destination.").optional(),
    toType: actionToTypeSchema.optional(),
    // P66: named URL params (Scenario 1, and extra params alongside a `to`).
    params: actionParamsSchema.optional(),
    description: z.string().min(1, "Action descriptions must not be empty.").optional()
});

export type ActionDefinition = z.infer<typeof actionDefinitionSchema>;

/**
 * P58 (ADR 0007): the public ACTION MESSAGE contract.
 *
 * An interaction command travels in `msg.ui.action`. Because it is a plain
 * message contract, ANY node — `inject`, `trigger`, `function`, an HTTP
 * response, or `ui-action` — can produce it; `ui-action` is the ergonomic,
 * schema-backed emitter, not a privileged one.
 *
 * Validation scope is deliberately NARROW. The schema validates ONLY
 * `msg.ui.action`. Unrelated `msg.*` fields (e.g. `payload`, `topic`,
 * `_msgid`) and unrelated `msg.ui.*` fields are PASSED THROUGH untouched —
 * there is intentionally no `.strict()` on `msg` or on `msg.ui`. This is the
 * idiomatic "enrich the incoming message" model: the emitter sets/merges
 * `msg.ui.action`, everything else rides along. `msg.ui.action` itself is
 * strict so that typos in the command are caught.
 *
 *   msg.ui = {
 *     clientId?: string,   // P15 per-client targeting; absent = broadcast
 *     action: {
 *       type:    <verb>,   // ADR 0005 / actionTypeSchema verb set
 *       to?:     string,   // navigate destination (route path)
 *       part?:   string,   // disclosure / single-active sub-id
 *       target?: string,   // OPTIONAL explicit component / node id (override)
 *     }
 *   }
 */
export const actionMessageCommandSchema = z
    .object({
        type: actionTypeSchema,
        to: z.string().min(1, "Navigate actions must declare a destination.").optional(),
        part: z.string().min(1, "Action parts must not be empty.").optional(),
        target: z.string().min(1, "Action targets must not be empty.").optional(),
        // P66 (ADR 0007): named URL params for a navigate action. In Scenario 1
        // (wired to a ui-route, no `to`) the route fills its own path's
        // `:placeholders` from these. String values only (they become URL parts).
        params: actionParamsSchema.optional()
    })
    .strict();

export type ActionMessageCommand = z.infer<typeof actionMessageCommandSchema>;

export const actionMessageSchema = z
    .object({
        // `.passthrough()` (not `.strict()`): foreign msg.ui.* fields (appId, …)
        // ride along untouched. `action` is strict so typos are caught.
        ui: z
            .object({
                clientId: identifierSchema.optional(),
                action: actionMessageCommandSchema
            })
            .passthrough()
    })
    // `.passthrough()` (not `.strict()`): foreign msg.* fields (payload, topic,
    // _msgid, …) ride along untouched (ADR 0007 §1 — enrich, don't replace).
    .passthrough();

export type ActionMessage = z.infer<typeof actionMessageSchema>;

export const navigationDefinitionSchema = z.object({
    id: identifierSchema,
    to: routePathSchema
});

export type NavigationDefinition = z.infer<typeof navigationDefinitionSchema>;

export const runtimeIntegrationModelSchema = z.object({
    stores: z.array(storeDefinitionSchema).default([]),
    queries: z.array(queryDefinitionSchema).default([]),
    actions: z.array(actionDefinitionSchema).default([]),
    navigations: z.array(navigationDefinitionSchema).default([])
});

export type RuntimeIntegrationModel = z.infer<typeof runtimeIntegrationModelSchema>;

export const componentKindSchema = z.enum([
    "text",
    "button",
    "table",
    "input",
    "card",
    "container",
    // P25: remaining interactive kinds from P16x nodes
    "select",
    "checkbox",
    "radio",
    "switch",
    "textarea",
    "datepicker",
    "slider",
    "alert",
    "badge",
    "progress",
    "breadcrumb",
    "tabs",
    "accordion",
    "menu",
    "avatar",
    // P70: image display node (native <img>)
    "image",
    // P45: composite and layout nodes
    "list",
    "pagination",
    "stepper",
    // P57: log display node
    "log",
    // P69: icon display node
    "icon",
    // P83: divider — static visual separator (sl-divider)
    "divider"
]);

/**
 * Component variant vocabularies (theming.md Ebene 2 — semantic roles).
 *
 * P49: a SINGLE, PORTABLE source of truth for the `variant` field of each
 * component kind. The vocabulary belongs to the component CONTRACT, above the
 * renderer-backend seam (ADR 0002), so the editor SelectBox (P50) and the
 * serializer import the SAME constants. It is deliberately GENEROUS: a backend
 * may map several variants onto the same concrete output (many-to-one) and must
 * degrade gracefully for an unknown value — a backend NEVER adds its own
 * variants.
 *
 * IMPORTANT — variant vs displayType. Some nodes carry an HTML field named
 * `variant` that is really a DISPLAY TYPE, not an Ebene-2 semantic role
 * (ui-progress bar/spinner/circular, ui-list unordered/ordered/description,
 * ui-menu sidebar/topbar, ui-skeleton text/avatar/card/table, ui-badge
 * square/rounded/pill). Those are NOT part of the variant vocabulary and must not
 * appear in the variant SelectBox — they are display types. The semantic
 * variant for those nodes lives in the `variant` field (ui-badge uses `variant`
 * with BADGE_VARIANTS = SEVERITY_VARIANTS; ui-alert uses `severity`).
 */
export const BUTTON_VARIANTS = [
    "primary",
    "secondary",
    "success",
    "danger",
    "warning",
    "neutral",
    "ghost",
    "link"
] as const;

export const TEXT_VARIANTS = [
    "heading-1",
    "heading-2",
    "heading-3",
    "body",
    "caption",
    "label",
    "code",
    "muted"
] as const;

export const CONTAINER_VARIANTS = ["card", "panel", "section", "transparent"] as const;

export const INPUT_VARIANTS = ["default", "filled", "outlined"] as const;

/**
 * Status/severity vocabulary shared by ui-alert and ui-badge. `info` is an
 * accepted ALIAS of `primary` (the serializer maps it onto the primary look).
 */
export const SEVERITY_VARIANTS = ["primary", "success", "warning", "danger", "neutral", "info"] as const;

export const BADGE_VARIANTS = SEVERITY_VARIANTS;
export const ALERT_VARIANTS = SEVERITY_VARIANTS;

/**
 * P71 — component size vocabulary.
 *
 * Shoelace exposes only three native sizes (small / medium / large). Nodes whose
 * underlying Shoelace element is sized that way (button, text, input, select,
 * textarea …) use this 3-step token set. The richer 5-step `xs..xl` scale stays
 * on ui-avatar / ui-icon, where it maps to CSS sizing rather than a
 * native `size` attribute. ui-badge uses the sm/md/lg scale (P92; sl-badge has
 * no native size attr; the adapter emits data-size for CSS targeting).
 * The adapter's `mapSize` already accepts both scales.
 */
export const COMPONENT_SIZES = ["sm", "md", "lg"] as const;
export type ComponentSize = (typeof COMPONENT_SIZES)[number];

/**
 * P71 — ui-button link mode. A button is, by default, an event source (its click
 * is reported on the output port). It can instead act as a hyperlink ("url",
 * renders a real `<a>` via sl-button `href`) or as an in-app navigation trigger
 * ("navigate", emits a navigate action against a route target).
 */
export const BUTTON_LINK_MODES = ["button", "url", "navigate"] as const;
export type ButtonLinkMode = (typeof BUTTON_LINK_MODES)[number];

export type ButtonVariant = (typeof BUTTON_VARIANTS)[number];
export type TextVariant = (typeof TEXT_VARIANTS)[number];
export type ContainerVariant = (typeof CONTAINER_VARIANTS)[number];
export type InputVariant = (typeof INPUT_VARIANTS)[number];
export type SeverityVariant = (typeof SEVERITY_VARIANTS)[number];

/**
 * Per-node-type variant vocabulary lookup. Maps a component `kind` to its
 * fixed list of TRUE Ebene-2 semantic variants. Kinds whose `variant`-named
 * field is actually a display type are intentionally ABSENT here so that
 * downstream consumers (editor SelectBox, serializer) treat only real variants
 * as variants. ui-badge/ui-alert expose their semantic variant via `severity`,
 * so the vocabulary is keyed for both `kind` and the field convention used by
 * each node.
 */
export const COMPONENT_VARIANT_VOCABULARY: Readonly<Record<string, readonly string[]>> = {
    button: BUTTON_VARIANTS,
    text: TEXT_VARIANTS,
    container: CONTAINER_VARIANTS,
    card: CONTAINER_VARIANTS,
    input: INPUT_VARIANTS,
    badge: BADGE_VARIANTS,
    alert: ALERT_VARIANTS
};

/**
 * Documented default variant per kind. A node that omits `variant` renders as
 * if it had this value; the serializer must produce the same output for an
 * absent variant and for the explicit default.
 */
export const COMPONENT_VARIANT_DEFAULT: Readonly<Record<string, string>> = {
    button: "neutral",
    text: "body",
    container: "card",
    card: "card",
    input: "default",
    badge: "neutral",
    alert: "primary"
};

export const uiEventNameSchema = z.enum(["click", "submit", "change", "select", "open", "close", "navigate", "load"]);

export const componentEventHandlerSchema = z.object({
    event: uiEventNameSchema,
    // action is optional since P20a — button click events are emitted on the output port
    // and the wiring determines the target, not a string action reference.
    action: z.string().min(1, "Component events must reference an action.").optional()
});

export type ComponentEventHandler = z.infer<typeof componentEventHandlerSchema>;

export const componentDefinitionSchema = z.object({
    id: identifierSchema,
    kind: componentKindSchema,
    mount: z.string().min(1, "Component mounts must not be empty."),
    order: z.number().int("Component order must be an integer.").optional(),
    bind: z.record(z.string(), bindingSchema).default({}),
    visibleIf: bindingSchema.optional(),
    enabledIf: bindingSchema.optional(),
    events: z.array(componentEventHandlerSchema).default([]),
    props: z.record(z.string(), z.unknown()).default({})
});

export type ComponentDefinition = z.infer<typeof componentDefinitionSchema>;

export const uiEventMessageSchema = z.object({
    ui: z.object({
        event: uiEventNameSchema,
        componentId: identifierSchema,
        action: z.string().min(1, "Actions must not be empty.").optional(),
        route: routePathSchema.optional(),
        params: z.record(z.string(), z.string()).default({}),
        statePatch: z.record(z.string(), z.unknown()).default({}),
        payload: z.record(z.string(), z.unknown()).default({}),
        dialog: z
            .object({
                id: identifierSchema,
                open: z.boolean()
            })
            .optional(),
        navigation: z
            .object({
                id: identifierSchema,
                to: routePathSchema
            })
            .optional(),
        queries: z
            .array(
                z.object({
                    id: identifierSchema,
                    queryPath: z.string().min(1, "Query payloads must include a query path."),
                    mode: z.enum(["load", "refresh"])
                })
            )
            .default([])
    })
});

export type UiEventMessage = z.infer<typeof uiEventMessageSchema>;

/**
 * Structured error/log contract — ADR 0006.
 *
 * The SINGLE source of truth for the shape of an error/log entry across the
 * thin client (P55), the webapp runtime forwarder (P56), and the ui-log display
 * node (P57). P54 adds the contract only; no behaviour is wired here.
 *
 * `severity` is the only enum that maps to a console method (debug→console.debug,
 * info→console.info, warn→console.warn, error→console.error) and to the
 * backend→frontend forwarding threshold. `origin` records which side produced the
 * entry, so a forwarded server error stays recognisable as `origin: "server"`
 * once it is logged in the browser.
 */
export const errorSeveritySchema = z.enum(["debug", "info", "warn", "error"]);

export type ErrorSeverity = z.infer<typeof errorSeveritySchema>;

export const errorOriginSchema = z.enum(["client", "server"]);

export type ErrorOrigin = z.infer<typeof errorOriginSchema>;

/** Structural context for an error/log entry — every field optional. */
export const errorContextSchema = z.object({
    appId: identifierSchema.optional(),
    nodeId: identifierSchema.optional(),
    op: z.string().min(1, "Error context op must not be empty.").optional()
});

export type ErrorContext = z.infer<typeof errorContextSchema>;

export const structuredErrorSchema = z.object({
    severity: errorSeveritySchema,
    // Stable, machine-greppable identifier: "<origin>.<area>.<reason>",
    // e.g. "client.snapshot.malformed". Not shown to end users.
    code: z.string().min(1, "Error code must not be empty."),
    // Human-readable line, with context interpolated inline (ADR 0006).
    message: z.string().min(1, "Error message must not be empty."),
    context: errorContextSchema.default({}),
    // ISO 8601 timestamp (new Date().toISOString()).
    timestamp: z.string().min(1, "Error timestamp must not be empty."),
    origin: errorOriginSchema
});

export type StructuredError = z.infer<typeof structuredErrorSchema>;

export const appModelSchema = z.object({
    id: identifierSchema,
    title: z.string().min(1, "App titles must not be empty."),
    layouts: z.array(layoutDefinitionSchema).min(1, "Apps must declare at least one layout."),
    routes: z.array(routeDefinitionSchema).min(1, "Apps must declare at least one route."),
    dialogs: z.array(dialogDefinitionSchema).default([]),
    components: z.array(componentDefinitionSchema).default([])
});

export type AppModel = z.infer<typeof appModelSchema>;
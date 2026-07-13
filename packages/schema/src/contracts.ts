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

/**
 * P163 (ADR 0017): the **scope-local** binding kinds introduced by `ui-repeat`.
 * Unlike the global kinds above (state/store/query/…), these resolve against the
 * render-time item scope the renderer pushes while cloning a repeat template —
 * they are not persisted and have no global source. This phase validates their
 * **form** only; resolution lands in the renderer (P164).
 *
 *  - `item`  → the whole current element; an optional `path` selects a one- OR
 *              multi-level field of the element (e.g. `address.city`).
 *  - `index` → the zero-based position of the current element. Path-free.
 *  - `prop`  → P177 (ADR 0020): the value of a `ui-component-instance` prop, read
 *              inside the component's `def:` subtree. `prop` alone is the whole
 *              prop value; an optional `path` selects a one- OR multi-level field
 *              (`prop.<name>`), exactly mirroring `item.<path>`. It resolves at
 *              render time against the instance's `propScope` frame (P178); outside
 *              any instance it resolves to `undefined`, mirroring `item` today.
 */
export const SCOPE_LOCAL_BINDING_KINDS = ["item", "index", "prop"] as const;

const BINDING_KINDS = ["state", "query", "routeParam", "literal", "msg", "flow", "global", "jsonata", "env", "store", "reactive", "item", "index", "prop"] as const;

/**
 * P219 (ADR 0034): per-field behaviour when this binding's value is
 * missing/unresolvable (a `reactive` expression fails, a store sub-path hits a
 * scalar / is not found). The FOUNDATION package delivers only the two
 * non-visual outcomes; the enum is intentionally named + extensible so the
 * richer P220 behaviours (`errorPort`, `throw`) slot in without changing the
 * contract or existing definitions.
 *
 *  - `marker` (**default**, absent → this) → render the invalid-value marker
 *    `"?"` (P104) and fire the existing one-time report — today's behaviour, so
 *    nothing changes for an existing flow.
 *  - `ignore` → render EMPTY (`""`) and report NOTHING — the same "absent value"
 *    semantics ADR 0032 gives a transient object-slice miss, now selectable for
 *    any field.
 *
 * P220 will extend this to `["marker", "ignore", "errorPort", "throw"]`.
 */
export const ON_MISSING_BEHAVIORS = ["marker", "ignore"] as const;

export type OnMissingBehavior = (typeof ON_MISSING_BEHAVIORS)[number];

/**
 * P163: validates the FIELD-PATH form of an `item.<path>` binding — a dotted path
 * of one or more segments, each a JS-identifier-ish word (letters, digits, `_`,
 * `$`), e.g. `name`, `address.city`. No leading/trailing/double dots. The `item.`
 * prefix is the `kind`, NOT part of `path`; `path` carries only the field tail
 * (a field that happens to be named `item` is a legitimate segment). This is pure
 * FORM validation — no slice/length requirement (cf. store subPath).
 */
const ITEM_PATH_PATTERN = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/;

/**
 * The kind-level validity check shared by the leaf and the full binding schema:
 * literal needs a `value`, reactive needs a non-empty expression in `value`, all
 * other (path-bearing) kinds need a `path`.
 */
function refineBindingKindShape(
    binding: { kind: string; path?: string; value?: unknown },
    context: z.RefinementCtx
): void {
    if (binding.kind === "literal") {
        if (binding.value === undefined) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Literal bindings require a value."
            });
        }

        return;
    }

    // P115 (ADR 0010): a `reactive` binding carries the expression SOURCE in
    // `value` (a non-empty string), not a `path`. The renderer compiles and
    // evaluates it per snapshot.
    if (binding.kind === "reactive") {
        if (typeof binding.value !== "string" || binding.value.trim().length === 0) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Reactive bindings require a non-empty expression in 'value'."
            });
        }

        return;
    }

    // P184: for the scope-local kinds (`item`/`index`/`prop`) an EMPTY `path`
    // ('') is the legitimate "whole element / bare index" case — NOT a malformed
    // path. Normalise `''` to "no path" up front so a saved `path:''` (older
    // editor builds, before the serialiser dropped the empty key) validates
    // EXACTLY like a path-free binding — old flows go green without a re-save.
    // This normalisation is scoped to item/index/prop ONLY; the data-binding
    // kinds below still reject an empty path via the `!binding.path` guard, so we
    // do NOT loosen path validation for state/query/etc.
    const scopeLocalPath = binding.path === "" ? undefined : binding.path;

    // P163 (ADR 0017): scope-local `item` / `index` bindings. FORM only — the
    // renderer resolves them against the render-time item scope (P164), not here.
    if (binding.kind === "index") {
        // `index` is the bare zero-based position — it carries no path. An empty
        // path ('') is tolerated as "no path" (P184); a real, non-empty path is
        // still rejected.
        if (scopeLocalPath !== undefined) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: "An 'index' binding is the bare item position — it must not carry a path."
            });
        }

        return;
    }

    if (binding.kind === "item") {
        // `item` alone is the whole element (an empty/absent path — P184). A
        // present, non-empty `path` selects a one- OR multi-level field of the
        // element (e.g. `address.city`) — pure path-form validation, no `item.`
        // prefix (that is the kind).
        if (scopeLocalPath !== undefined && !ITEM_PATH_PATTERN.test(scopeLocalPath)) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: "An 'item' binding path must be a dotted field path (e.g. 'name' or 'address.city')."
            });
        }

        return;
    }

    // P177 (ADR 0020): scope-local `prop` binding — the exact sibling of `item`.
    // `prop` alone is the whole prop value (an empty/absent path — P184); a
    // present, non-empty `path` selects a one- OR multi-level field (`prop.<name>`
    // / `prop.address.city`). The `prop.` prefix is the KIND, not part of `path`.
    // FORM only — the renderer resolves it against the instance's render-time
    // `propScope` (P178), not here.
    if (binding.kind === "prop") {
        if (scopeLocalPath !== undefined && !ITEM_PATH_PATTERN.test(scopeLocalPath)) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: "A 'prop' binding path must be a dotted field path (e.g. 'title' or 'address.city')."
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
}

/**
 * P131 (ADR 0013): a `store` binding may carry an optional `subPath` — a value
 * binding that resolves to a path string / numeric index into the store slice.
 * That sub-binding is a **leaf**: it follows the full kind rules but may NOT
 * itself carry a `subPath`. This is the structural recursion lock — a path of a
 * path of a path has no use, and forbidding `subPath.subPath` makes a chain/cycle
 * impossible by construction. The runtime keeps a depth guard as a backstop.
 *
 * The leaf accepts the full canonical source set EXCEPT `state` (which is not an
 * editor offering; the sub-path comes from the canonical value-binding types).
 * `state` is still tolerated here for symmetry with the main binding, but a
 * `subPath` is rejected on it.
 */
export const leafBindingSchema = z
    .object({
        kind: z.enum(BINDING_KINDS),
        // P184: `path` is a plain optional string here — the empty-path RULE is
        // enforced per-kind in `refineBindingKindShape`, NOT by a field-level
        // `.min(1)`. A `.min(1)` would reject `path:''` for EVERY kind before the
        // refine runs, which wrongly rejects the legitimate whole-`item` / bare
        // `index` / whole-`prop` case (all serialised/migrated with `path:''`).
        // Data-binding kinds still require a non-empty path via the refine's
        // `!binding.path` guard, so this does not loosen them.
        path: z.string().optional(),
        value: z.unknown().optional(),
        fallback: z.unknown().optional(),
        // P193 (ADR 0023): an `item`/`index` binding may carry an optional `scope`
        // = a ui-repeat alias (`itemName`). It selects the NAMED enclosing repeat
        // frame instead of the innermost one. Meaningful only for `item`/`index`;
        // ignored elsewhere. FORM only — the renderer (P193) resolves it against
        // the named frame in the scope stack, not here.
        scope: z.string().optional(),
        // P219 (ADR 0034): per-field missing-value behaviour. Optional (absent →
        // `marker`, today's `"?"`), so existing leaf bindings validate unchanged.
        onMissing: z.enum(ON_MISSING_BEHAVIORS).optional(),
        // The structural recursion lock: a sub-path binding may not declare its
        // own sub-path. `subPath` is meaningful ONLY on the top-level store
        // binding; on a leaf it is always an error.
        subPath: z.unknown().optional()
    })
    .superRefine((binding, context) => {
        if (binding.subPath !== undefined) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: "A store binding's subPath is a single leaf — it must not itself declare a subPath.",
                path: ["subPath"]
            });
        }

        refineBindingKindShape(binding, context);
    });

export type LeafBindingDefinition = z.infer<typeof leafBindingSchema>;

export const bindingSchema = z
    .object({
        kind: z.enum(BINDING_KINDS),
        // P184: see leafBindingSchema — `path` carries no field-level `.min(1)`;
        // the per-kind refine enforces non-empty for data kinds and treats `''`
        // as "no path" for the scope-local kinds (whole-item / index / whole-prop).
        path: z.string().optional(),
        value: z.unknown().optional(),
        fallback: z.unknown().optional(),
        // P193 (ADR 0023): an `item`/`index` binding may carry an optional `scope`
        // = a ui-repeat alias (`itemName`). Selects the NAMED enclosing repeat
        // frame instead of the innermost one. Meaningful only for `item`/`index`.
        scope: z.string().optional(),
        // P219 (ADR 0034): per-field missing-value behaviour. Optional (absent →
        // `marker`, today's `"?"`), so every existing definition/fixture validates
        // unchanged. Invalid values are rejected by the enum. Extensible: P220 adds
        // `errorPort`/`throw` to ON_MISSING_BEHAVIORS with no contract change.
        onMissing: z.enum(ON_MISSING_BEHAVIORS).optional(),
        // P131 (ADR 0013): optional one-level sub-path into a store slice. Only
        // valid on `kind:"store"`; itself a LEAF binding (no nested subPath).
        subPath: leafBindingSchema.optional()
    })
    .superRefine((binding, context) => {
        // P193: a `scope` qualifier is only meaningful on `item`/`index`.
        if (binding.scope !== undefined && binding.kind !== "item" && binding.kind !== "index") {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: "A scope qualifier is only valid on an 'item' or 'index' binding.",
                path: ["scope"]
            });
        }

        // P131: `subPath` is only meaningful when reaching into a store slice.
        if (binding.subPath !== undefined && binding.kind !== "store") {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: "A subPath is only valid on a 'store' binding.",
                path: ["subPath"]
            });
        }

        refineBindingKindShape(binding, context);
    });

export type BindingDefinition = z.infer<typeof bindingSchema>;

/**
 * P203 (ADR 0027): the **writable** binding kinds — the target set for an input
 * control's `writeTo` binding (the WRITE half of a bidirectional value binding).
 * You can only persist a user edit into a real, writable target:
 *  - `store`  → a `ui-store` node (path = store id) + optional one-level subPath.
 *  - `flow`   → Node-RED flow context (path = context key).
 *  - `global` → Node-RED global context (path = context key).
 *
 * The read-only / computed kinds (query, routeParam, reactive, literal, msg,
 * jsonata, env, item, index, prop) are deliberately excluded — you cannot write
 * a value back into a computed source.
 */
export const WRITABLE_BINDING_KINDS = ["store", "flow", "global"] as const;

export type WritableBindingKind = (typeof WRITABLE_BINDING_KINDS)[number];

/**
 * P203 (ADR 0027): the `writeTo` binding — the symmetric WRITE half of an input's
 * `value` binding. Structurally the same as {@link bindingSchema} (store node +
 * optional one-level subPath), but the `kind` is restricted to the writable set.
 * Zod REJECTS query/routeParam/reactive/literal/msg/jsonata/env/timestamp/item/
 * index/prop for a `writeTo`.
 */
export const writeToBindingSchema = z
    .object({
        kind: z.enum(WRITABLE_BINDING_KINDS),
        path: z.string().optional(),
        value: z.unknown().optional(),
        fallback: z.unknown().optional(),
        // P131 (ADR 0013): optional one-level sub-path into a store slice. Only
        // valid on `kind:"store"`; itself a LEAF binding (no nested subPath).
        subPath: leafBindingSchema.optional()
    })
    .superRefine((binding, context) => {
        // A subPath only reaches into a store slice.
        if (binding.subPath !== undefined && binding.kind !== "store") {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: "A subPath is only valid on a 'store' writeTo target.",
                path: ["subPath"]
            });
        }

        // All writable kinds are path-bearing: store carries the store id, flow/
        // global carry the context key.
        if (!binding.path) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: `A '${binding.kind}' writeTo target requires a path.`
            });
        }
    });

export type WriteToBindingDefinition = z.infer<typeof writeToBindingSchema>;

/**
 * P203 (ADR 0027): when the runtime persists the field value into the `writeTo`
 * target. `submit` (default) writes on Enter/blur; `change` writes on every
 * keystroke. Non-text controls (checkbox/switch/select/radio/slider) have no
 * submit gesture and effectively write on `change` regardless.
 *
 * P206 (ADR 0027 amendment): `none` disables the automatic write-back entirely —
 * the control still emits its `change`/`submit` output events, so the flow author
 * wires the persistence by hand (`change → function → ui-store`). With `none`,
 * `writeTo` may be left empty (an empty write target is deliberate, not a gap).
 */
export const WRITE_TRIGGERS = ["none", "change", "submit"] as const;

export const writeTriggerSchema = z.enum(WRITE_TRIGGERS).default("submit");

export type WriteTrigger = (typeof WRITE_TRIGGERS)[number];

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
    // P115 (ADR 0010): the store's authoring NAME. The `store` binding kind
    // references a store by id (rename-robust); a `reactive` expression instead
    // resolves `store("<name>")` by this human-facing name, so it is carried
    // through to the renderer. Optional for back-compat; empty/absent is a valid
    // (unnamed) store and simply won't be reachable via store("…").
    name: z.string().optional(),
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

// P118 (ADR 0011 §1): the explicit target-SOURCE mode for a navigate action.
// The stored intent — wire (the target route is reached over Node-RED wires),
// route (a ui-route chosen by reference), or url (a `to` typedInput URL built
// whole). The mode technically excludes double configuration: per mode only the
// matching fields may be set (route ⇒ routeId, no `to`; url ⇒ `to`, no routeId;
// wire ⇒ neither). Distinct from the deprecated `actionTargetModeSchema`
// (out-port/path) which addressed a different, vestigial concern.
export const navigateTargetModeSchema = z.enum(["wire", "route", "url"]);

export type NavigateTargetMode = z.infer<typeof navigateTargetModeSchema>;

// P118 (ADR 0011 §1): the typedInput value-type for a single navigate param.
// Each param value is evaluated against the triggering message server-side at
// action time (str = literal; msg/flow/global/env via evaluateNodeProperty;
// jsonata against the msg). Replaces the literal-only free-text key/value list.
export const actionParamValueTypeSchema = z.enum(["str", "msg", "jsonata", "flow", "global", "env"]);

export type ActionParamValueType = z.infer<typeof actionParamValueTypeSchema>;

// P118 (ADR 0011 §1): a single typed navigate param row. `name` fills a
// `:placeholder` segment of the target route's path; `value` + `valueType` form
// the typedInput that is resolved at action time.
export const actionParamEntrySchema = z.object({
    name: z.string().min(1, "Param names must not be empty."),
    value: z.string(),
    valueType: actionParamValueTypeSchema
});

export type ActionParamEntry = z.infer<typeof actionParamEntrySchema>;

// P118: the navigate params as an ordered list of typed entries (route mode, and
// wire mode where detected). Supersedes the literal-only `{k: "v"}` object form
// (which migrates to a list of str-typed entries on load).
export const actionParamListSchema = z.array(actionParamEntrySchema);

export type ActionParamList = z.infer<typeof actionParamListSchema>;

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
    // P118 (ADR 0011 §1): `targetMode` is the navigate target SOURCE (wire | route
    // | url). `target` stays for the deprecated wireless addressing path.
    targetMode: navigateTargetModeSchema.optional(),
    // P118: referenced ui-route id (navigate `route` mode).
    routeId: identifierSchema.optional(),
    target: z.string().min(1, "Action targets must not be empty.").optional(),
    // P53: open / close / select granularity — a sub-id within the target element
    // (accordion section, tree branch, tab name).
    part: z.string().min(1, "Action parts must not be empty.").optional(),
    // P66: `to` is a navigate destination typedInput; `toType` is its type.
    // P118: only meaningful in `url` mode (the URL is built whole).
    to: z.string().min(1, "Navigate actions must declare a destination.").optional(),
    toType: actionToTypeSchema.optional(),
    // P118 (ADR 0011 §1): typed navigate params as an ordered list of
    // { name, value, valueType } entries (route mode).
    params: actionParamListSchema.optional(),
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
    // P168 (ADR 0018, Model 1a): ui-tab — a thin CONTAINER child of ui-tabs. It
    // carries section metadata (label/icon/order) plus a single default "content"
    // slot. It renders NO standalone chrome: its parent `tabs` component
    // enumerates its `ui-tab` children and renders one panel per child (content
    // mounts via `ui-tab:<tabId>/content`). A stray `tab` not enumerated by a
    // `tabs` parent is dropped by the renderer.
    "tab",
    "accordion",
    // P169 (ADR 0018, Model 1a): ui-accordion-section — a thin CONTAINER child of
    // ui-accordion. It carries section metadata (label/icon/order) plus a single
    // default "content" slot. It renders NO standalone chrome: its parent
    // `accordion` component enumerates its `ui-accordion-section` children and
    // renders one collapsible panel per child (content mounts via
    // `ui-accordion-section:<sectionId>/content`). A stray `accordion-section` not
    // enumerated by an `accordion` parent is dropped by the renderer.
    "accordion-section",
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
    "divider",
    // P164 (ADR 0017): ui-repeat — a TEMPLATE CONTAINER. It carries no rendered
    // chrome of its own; the renderer EXPANDS it, cloning its default-slot child
    // subtree once per resolved `items` element (with a render-time item scope).
    // It appears in the compiled AppModel like a container does, so children mount
    // via `container:<repeatId>/content` (= REPEAT_SLOT); `bind.items` holds the
    // collection binding and `props.keyField` the optional stable key field.
    "repeat",
    // P178 (ADR 0020): ui-component-definition — an OFF-CANVAS template container.
    // Its children mount into `def:<definitionId>/content` (= COMPONENT_DEF_SLOT),
    // and its outer mount never resolves to a real region, so `renderRegions` never
    // emits it directly. It exists only to be EXPANDED by instances.
    "component-definition",
    // P178 (ADR 0020): ui-component-instance — a leaf-shaped node that EXPANDS, at
    // its real outer `mount`, the `def:` subtree of the definition named by
    // `props.definitionId`, resolving the instance's `bind` props into a render-time
    // `propScope` frame. Like `repeat`, it carries no rendered chrome of its own.
    "component-instance"
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

/**
 * ui-text typographic role ("style" field). Each value maps 1:1 onto a semantic
 * HTML element (heading-1/2/3 → h1/h2/h3, body → p, caption → small, label →
 * span, code → code) and drives size/weight/font-family — NOT colour. Colour is
 * an orthogonal axis (`variant`, see TEXT_COLOR_VARIANTS). `muted` was previously
 * part of this list but is a colour, not a role, so it now lives on the colour
 * axis; legacy configs are migrated in the ui-text mapConfig.
 */
export const TEXT_STYLES = [
    "heading-1",
    "heading-2",
    "heading-3",
    "body",
    "caption",
    "label",
    "code"
] as const;

/**
 * ui-text semantic colour ("variant" field). Aligns with the project's
 * SEVERITY_VARIANTS palette (and Bootstrap-Vue / Shoelace colour tokens) so
 * `variant` means the SAME thing on ui-text as it does on ui-button/badge/alert.
 * `default` inherits the surrounding text colour; `muted` dims it.
 */
export const TEXT_COLOR_VARIANTS = [
    "default",
    "muted",
    "primary",
    "success",
    "warning",
    "danger",
    "neutral"
] as const;

/**
 * P221 (ADR 0035) — ui-text presentation mode. `text` (default) is the historic
 * free-display-text rendering. `formField` renders the same bound value as a
 * read-only, LABELLED form row (label left / value right) styled like the input
 * controls, so a ui-text can line up next to ui-input/ui-select in a form (e.g.
 * a read-only `_id` field in an Entity Editor). Read-only: no editing, no value
 * emission. In `formField` mode the `label` field becomes relevant.
 */
export const TEXT_DISPLAY_MODES = ["text", "formField"] as const;
export type TextDisplayMode = (typeof TEXT_DISPLAY_MODES)[number];

export const CONTAINER_VARIANTS = ["card", "panel", "section", "transparent", "span"] as const;

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
 * native `size` attribute. ui-badge no longer uses this scale (P103: size field
 * removed; sizing is handled via Theme/CSS at the use site).
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
export type TextStyle = (typeof TEXT_STYLES)[number];
export type TextColorVariant = (typeof TEXT_COLOR_VARIANTS)[number];
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
    // P111: ui-text `variant` is now the semantic COLOUR axis (the typographic
    // role moved to the separate `style` field → TEXT_STYLES).
    text: TEXT_COLOR_VARIANTS,
    container: CONTAINER_VARIANTS,
    card: CONTAINER_VARIANTS,
    // ADR 0025: ui-repeat is transparent — NO variant (reverted from P197). Layout/
    // chrome belongs to an explicit ui-container.
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
    // P111: ui-text colour default — `default` inherits the surrounding text colour.
    text: "default",
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
    // P109: `name` replaces `title` in the compiled AppModel. The name is the
    // display name of the app (HTML <title>, app-bar heading).
    name: z.string().min(1, "App names must not be empty."),
    layouts: z.array(layoutDefinitionSchema).min(1, "Apps must declare at least one layout."),
    routes: z.array(routeDefinitionSchema).min(1, "Apps must declare at least one route."),
    dialogs: z.array(dialogDefinitionSchema).default([]),
    components: z.array(componentDefinitionSchema).default([])
});

export type AppModel = z.infer<typeof appModelSchema>;
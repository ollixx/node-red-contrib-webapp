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

/** Binding kinds that require a path (i.e. they are not literal). */
export const DYNAMIC_BINDING_KINDS = ["state", "query", "routeParam", "msg", "flow", "global", "jsonata", "env"] as const;

export const bindingSchema = z
    .object({
        kind: z.enum(["state", "query", "routeParam", "literal", "msg", "flow", "global", "jsonata", "env"]),
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
    modal: z.boolean().default(true)
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
export const actionTypeSchema = z.enum(["navigate", "disable", "enable", "show", "hide", "trigger"]);

export type ActionType = z.infer<typeof actionTypeSchema>;

export const actionTargetModeSchema = z.enum(["out-port", "path"]);

export type ActionTargetMode = z.infer<typeof actionTargetModeSchema>;

export const actionDefinitionSchema = z.object({
    id: identifierSchema,
    actionType: actionTypeSchema.optional(),
    // targetMode and target are deprecated — wiring the output port is the preferred model.
    targetMode: actionTargetModeSchema.optional(),
    target: z.string().min(1, "Action targets must not be empty.").optional(),
    to: z.string().min(1, "Navigate actions must declare a destination.").optional(),
    description: z.string().min(1, "Action descriptions must not be empty.").optional()
});

export type ActionDefinition = z.infer<typeof actionDefinitionSchema>;

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
    "avatar"
]);

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

export const appModelSchema = z.object({
    id: identifierSchema,
    title: z.string().min(1, "App titles must not be empty."),
    layouts: z.array(layoutDefinitionSchema).min(1, "Apps must declare at least one layout."),
    routes: z.array(routeDefinitionSchema).min(1, "Apps must declare at least one route."),
    dialogs: z.array(dialogDefinitionSchema).default([]),
    components: z.array(componentDefinitionSchema).default([])
});

export type AppModel = z.infer<typeof appModelSchema>;
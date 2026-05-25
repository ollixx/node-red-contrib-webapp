import { z } from "zod";

const identifierPattern = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

export const identifierSchema = z
    .string()
    .min(1, "IDs must not be empty.")
    .regex(identifierPattern, "IDs must start with a letter and only contain letters, numbers, underscores, or hyphens.");

export const regionNameSchema = z
    .string()
    .min(1, "Region names must not be empty.")
    .regex(identifierPattern, "Region names must start with a letter and only contain letters, numbers, underscores, or hyphens.");

export const routePathSchema = z
    .string()
    .min(1, "Route paths must not be empty.")
    .startsWith("/", "Route paths must start with '/'.");

export const bindingSchema = z
    .object({
        kind: z.enum(["state", "query", "routeParam", "literal"]),
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

export interface RegionDefinition {
    name: string;
    title?: string;
    regions?: RegionDefinition[];
}

export const regionDefinitionSchema: z.ZodType<RegionDefinition> = z.lazy(() =>
    z
        .object({
            name: regionNameSchema,
            title: z.string().min(1, "Region titles must not be empty.").optional(),
            regions: z.array(regionDefinitionSchema).default([])
        })
        .superRefine((region, context) => {
            const seenNames = new Set<string>();

            region.regions.forEach((childRegion, index) => {
                if (seenNames.has(childRegion.name)) {
                    context.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: `Region '${childRegion.name}' is declared more than once in '${region.name}'.`,
                        path: ["regions", index, "name"]
                    });
                }

                seenNames.add(childRegion.name);
            });
        })
);

export interface LayoutDefinition {
    id: string;
    title?: string;
    regions: RegionDefinition[];
}

export const layoutDefinitionSchema: z.ZodType<LayoutDefinition> = z
    .object({
        id: identifierSchema,
        title: z.string().min(1, "Layout titles must not be empty.").optional(),
        regions: z.array(regionDefinitionSchema).min(1, "Layouts must declare at least one region.")
    })
    .superRefine((layout, context) => {
        const seenNames = new Set<string>();

        layout.regions.forEach((region, index) => {
            if (seenNames.has(region.name)) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `Layout '${layout.id}' declares region '${region.name}' more than once.`,
                    path: ["regions", index, "name"]
                });
            }

            seenNames.add(region.name);
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

export const queryDefinitionSchema = z.object({
    id: identifierSchema,
    queryPath: z.string().min(1, "Queries must declare a query path."),
    source: z.string().min(1, "Query sources must not be empty.").optional(),
    refreshAction: z.string().min(1, "Refresh actions must not be empty.").optional()
});

export type QueryDefinition = z.infer<typeof queryDefinitionSchema>;

export const actionDefinitionSchema = z.object({
    id: identifierSchema,
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

export const componentKindSchema = z.enum(["text", "button", "table", "form", "input", "card"]);

export const uiEventNameSchema = z.enum(["click", "submit", "change", "select", "open", "close", "navigate", "load"]);

export const componentEventHandlerSchema = z.object({
    event: uiEventNameSchema,
    action: z.string().min(1, "Component events must reference an action.")
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
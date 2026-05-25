import { z } from "zod";

import {
    bindingSchema,
    identifierSchema,
    regionNameSchema,
    routePathSchema
} from "./contracts";
import { formatValidationIssues } from "./validation";

const appScopedNodeSchema = z.object({
    appId: identifierSchema,
    id: identifierSchema
});

const mountableNodeSchema = appScopedNodeSchema.extend({
    mount: z.string().min(1, "Component mounts must not be empty."),
    order: z.number().int("Component order must be an integer.").optional()
});

export const uiAppNodeDefinitionSchema = z.object({
    type: z.literal("ui-app"),
    id: identifierSchema,
    title: z.string().min(1, "App titles must not be empty.")
});

export type UiAppNodeDefinition = z.infer<typeof uiAppNodeDefinitionSchema>;

export const uiLayoutNodeDefinitionSchema = appScopedNodeSchema.extend({
    type: z.literal("ui-layout"),
    title: z.string().min(1, "Layout titles must not be empty.").optional()
});

export type UiLayoutNodeDefinition = z.infer<typeof uiLayoutNodeDefinitionSchema>;

export const uiRegionNodeDefinitionSchema = appScopedNodeSchema.extend({
    type: z.literal("ui-region"),
    layoutId: identifierSchema,
    name: regionNameSchema,
    parentRegionId: identifierSchema.optional(),
    title: z.string().min(1, "Region titles must not be empty.").optional(),
    order: z.number().int("Region order must be an integer.").default(0)
});

export type UiRegionNodeDefinition = z.infer<typeof uiRegionNodeDefinitionSchema>;

export const uiRouteNodeDefinitionSchema = appScopedNodeSchema.extend({
    type: z.literal("ui-route"),
    path: routePathSchema,
    title: z.string().min(1, "Route titles must not be empty.").optional(),
    layoutId: identifierSchema
});

export type UiRouteNodeDefinition = z.infer<typeof uiRouteNodeDefinitionSchema>;

export const uiDialogNodeDefinitionSchema = appScopedNodeSchema.extend({
    type: z.literal("ui-dialog"),
    title: z.string().min(1, "Dialog titles must not be empty.").optional(),
    layoutId: identifierSchema,
    routeId: identifierSchema.optional(),
    modal: z.boolean().default(true)
});

export type UiDialogNodeDefinition = z.infer<typeof uiDialogNodeDefinitionSchema>;

export const uiTextNodeDefinitionSchema = mountableNodeSchema.extend({
    type: z.literal("ui-text"),
    value: bindingSchema,
    variant: z.string().min(1, "Text variants must not be empty.").optional()
});

export type UiTextNodeDefinition = z.infer<typeof uiTextNodeDefinitionSchema>;

export const uiButtonNodeDefinitionSchema = mountableNodeSchema.extend({
    type: z.literal("ui-button"),
    label: z.string().min(1, "Button labels must not be empty."),
    action: z.string().min(1, "Buttons must reference an action."),
    disabled: bindingSchema.optional()
});

export type UiButtonNodeDefinition = z.infer<typeof uiButtonNodeDefinitionSchema>;

export const uiTableNodeDefinitionSchema = mountableNodeSchema.extend({
    type: z.literal("ui-table"),
    columns: z.array(z.string().min(1, "Table columns must not be empty.")).min(1, "Tables must declare at least one column."),
    rows: bindingSchema,
    selectAction: z.string().min(1, "Table select actions must not be empty.").optional()
});

export type UiTableNodeDefinition = z.infer<typeof uiTableNodeDefinitionSchema>;

export const uiFormNodeDefinitionSchema = mountableNodeSchema.extend({
    type: z.literal("ui-form"),
    fields: z.array(z.string().min(1, "Form field names must not be empty.")).min(1, "Forms must declare at least one field."),
    model: bindingSchema,
    submitAction: z.string().min(1, "Forms must reference a submit action.")
});

export type UiFormNodeDefinition = z.infer<typeof uiFormNodeDefinitionSchema>;

export const uiStoreNodeDefinitionSchema = appScopedNodeSchema.extend({
    type: z.literal("ui-store"),
    statePath: z.string().min(1, "Stores must declare a state path."),
    initialValue: z.unknown().optional()
});

export type UiStoreNodeDefinition = z.infer<typeof uiStoreNodeDefinitionSchema>;

export const uiQueryNodeDefinitionSchema = appScopedNodeSchema.extend({
    type: z.literal("ui-query"),
    queryPath: z.string().min(1, "Queries must declare a query path."),
    source: z.string().min(1, "Query sources must not be empty.").optional(),
    refreshAction: z.string().min(1, "Refresh actions must not be empty.").optional()
});

export type UiQueryNodeDefinition = z.infer<typeof uiQueryNodeDefinitionSchema>;

export const uiActionNodeDefinitionSchema = appScopedNodeSchema.extend({
    type: z.literal("ui-action"),
    description: z.string().min(1, "Action descriptions must not be empty.").optional()
});

export type UiActionNodeDefinition = z.infer<typeof uiActionNodeDefinitionSchema>;

export const uiNavigationNodeDefinitionSchema = appScopedNodeSchema.extend({
    type: z.literal("ui-navigation"),
    to: routePathSchema
});

export type UiNavigationNodeDefinition = z.infer<typeof uiNavigationNodeDefinitionSchema>;

export const uiNodeDefinitionSchema = z.union([
    uiAppNodeDefinitionSchema,
    uiRouteNodeDefinitionSchema,
    uiLayoutNodeDefinitionSchema,
    uiRegionNodeDefinitionSchema,
    uiTextNodeDefinitionSchema,
    uiButtonNodeDefinitionSchema,
    uiTableNodeDefinitionSchema,
    uiFormNodeDefinitionSchema,
    uiDialogNodeDefinitionSchema,
    uiStoreNodeDefinitionSchema,
    uiQueryNodeDefinitionSchema,
    uiActionNodeDefinitionSchema,
    uiNavigationNodeDefinitionSchema
]);

export type UiNodeDefinition = z.infer<typeof uiNodeDefinitionSchema>;

export function validateUiNodeDefinition(input: unknown): { success: true; data: UiNodeDefinition } | { success: false; error: string } {
    const result = uiNodeDefinitionSchema.safeParse(input);

    if (!result.success) {
        return {
            success: false,
            error: formatValidationIssues(result.error.issues)
        };
    }

    return {
        success: true,
        data: result.data
    };
}
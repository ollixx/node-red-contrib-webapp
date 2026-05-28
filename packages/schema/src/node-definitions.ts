import { z } from "zod";

import {
    actionTargetModeSchema,
    actionTypeSchema,
    bindingSchema,
    identifierSchema,
    regionNameSchema,
    routePathSchema
} from "./contracts";
import { formatValidationIssues } from "./validation";

const identifiedNodeSchema = z.object({
    id: identifierSchema
});

const mountableNodeSchema = identifiedNodeSchema.extend({
    mount: z.string().min(1, "Component mounts must not be empty."),
    order: z.number().int("Component order must be an integer.").optional()
});

export const uiAppNodeDefinitionSchema = z.object({
    type: z.literal("ui-app"),
    id: identifierSchema,
    title: z.string().min(1, "App titles must not be empty."),
    layout: identifierSchema
});

export type UiAppNodeDefinition = z.infer<typeof uiAppNodeDefinitionSchema>;

export const uiLayoutNodeDefinitionSchema = identifiedNodeSchema.extend({
    type: z.literal("ui-layout"),
    title: z.string().min(1, "Layout titles must not be empty.").optional()
});

export type UiLayoutNodeDefinition = z.infer<typeof uiLayoutNodeDefinitionSchema>;

export const uiSlotNodeDefinitionSchema = identifiedNodeSchema.extend({
    type: z.literal("ui-slot"),
    layoutId: identifierSchema,
    name: regionNameSchema,
    title: z.string().min(1, "Region titles must not be empty.").optional(),
    order: z.number().int("Region order must be an integer.").default(0)
});

export type UiSlotNodeDefinition = z.infer<typeof uiSlotNodeDefinitionSchema>;

export const uiContainerNodeDefinitionSchema = mountableNodeSchema.extend({
    type: z.literal("ui-container"),
    layoutId: identifierSchema,
    title: z.string().min(1, "Container titles must not be empty.").optional()
});

export type UiContainerNodeDefinition = z.infer<typeof uiContainerNodeDefinitionSchema>;

export const uiRouteNodeDefinitionSchema = identifiedNodeSchema.extend({
    type: z.literal("ui-route"),
    path: routePathSchema,
    title: z.string().min(1, "Route titles must not be empty.").optional(),
    layoutId: identifierSchema
});

export type UiRouteNodeDefinition = z.infer<typeof uiRouteNodeDefinitionSchema>;

export const uiDialogNodeDefinitionSchema = identifiedNodeSchema.extend({
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

export const uiInputNodeDefinitionSchema = mountableNodeSchema.extend({
    type: z.literal("ui-input"),
    label: z.string().min(1, "Input labels must not be empty."),
    value: bindingSchema,
    storeId: identifierSchema.optional(),
    path: z.string().min(1, "Input store paths must not be empty.").optional(),
    inputType: z.enum(["text", "email", "number"]).default("text"),
    placeholder: z.string().min(1, "Input placeholders must not be empty.").optional()
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

export const uiStoreNodeDefinitionSchema = identifiedNodeSchema.extend({
    type: z.literal("ui-store"),
    statePath: z.string().min(1, "Stores must declare a state path."),
    initialValue: z.unknown().optional()
});

export type UiStoreNodeDefinition = z.infer<typeof uiStoreNodeDefinitionSchema>;

export const uiQueryNodeDefinitionSchema = identifiedNodeSchema.extend({
    type: z.literal("ui-query"),
    queryPath: z.string().min(1, "Queries must declare a query path."),
    source: z.string().min(1, "Query sources must not be empty.").optional(),
    refreshAction: z.string().min(1, "Refresh actions must not be empty.").optional()
});

export type UiQueryNodeDefinition = z.infer<typeof uiQueryNodeDefinitionSchema>;

export const uiActionNodeDefinitionSchema = identifiedNodeSchema.extend({
    type: z.literal("ui-action"),
    actionType: actionTypeSchema.optional(),
    targetMode: actionTargetModeSchema.optional(),
    target: z.string().min(1, "Action targets must not be empty.").optional(),
    to: z.string().min(1, "Navigate actions must declare a destination.").optional(),
    description: z.string().min(1, "Action descriptions must not be empty.").optional()
}).superRefine((action, context) => {
    if (action.actionType && !action.targetMode) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Typed actions must declare a target mode.",
            path: ["targetMode"]
        });
    }

    if (!action.actionType && action.targetMode) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Target modes require an action type.",
            path: ["actionType"]
        });
    }

    if (action.targetMode === "path" && !action.target) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Path-targeted actions must declare a target.",
            path: ["target"]
        });
    }

    if (action.targetMode === "out-port" && action.target) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Out-port actions must not declare a direct target.",
            path: ["target"]
        });
    }

    if (action.actionType === "navigate" && !action.to) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Navigate actions must declare a destination.",
            path: ["to"]
        });
    }
});

export type UiActionNodeDefinition = z.infer<typeof uiActionNodeDefinitionSchema>;

export const uiNavigationNodeDefinitionSchema = identifiedNodeSchema.extend({
    type: z.literal("ui-navigation"),
    to: routePathSchema
});

export type UiNavigationNodeDefinition = z.infer<typeof uiNavigationNodeDefinitionSchema>;

export const uiNodeDefinitionSchema = z.union([
    uiAppNodeDefinitionSchema,
    uiRouteNodeDefinitionSchema,
    uiLayoutNodeDefinitionSchema,
    uiSlotNodeDefinitionSchema,
    uiContainerNodeDefinitionSchema,
    uiTextNodeDefinitionSchema,
    uiButtonNodeDefinitionSchema,
    uiTableNodeDefinitionSchema,
    uiInputNodeDefinitionSchema,
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
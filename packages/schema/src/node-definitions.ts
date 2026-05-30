import { z } from "zod";

import {
    actionTargetModeSchema,
    actionTypeSchema,
    bindingSchema,
    identifierSchema,
    routePathSchema
} from "./contracts";
import { standardLayoutPresetIds } from "./layout-presets";
import { formatValidationIssues } from "./validation";

const standardLayoutPresetSchema = z.enum(standardLayoutPresetIds);

const identifiedNodeSchema = z.object({
    id: identifierSchema
});

const mountableNodeSchema = identifiedNodeSchema.extend({
    parent: z.string().min(1, "Component parent paths must not be empty.").optional(),
    mount: z.string().min(1, "Component mounts must not be empty.").optional(),
    order: z.number().int("Component order must be an integer.").optional(),
    row: z.number().int("Component rows must be integers.").optional(),
    col: z.number().int("Component columns must be integers.").optional(),
    colSize: z.number().int("Component column spans must be integers.").optional(),
    rowSize: z.number().int("Component row spans must be integers.").optional(),
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
    title: z.string().min(1, "App titles must not be empty."),
    layout: standardLayoutPresetSchema,
    events: z.array(z.enum(["clientConnected", "clientDisconnected"])).optional(),
    tokens: designTokensSchema
});

export type UiAppNodeDefinition = z.infer<typeof uiAppNodeDefinitionSchema>;

export const uiContainerNodeDefinitionSchema = mountableNodeSchema.extend({
    type: z.literal("ui-container"),
    layout: standardLayoutPresetSchema,
    events: z.array(z.enum(["onShow", "onHide"])).optional()
});

export type UiContainerNodeDefinition = z.infer<typeof uiContainerNodeDefinitionSchema>;

export const uiRouteNodeDefinitionSchema = identifiedNodeSchema.extend({
    type: z.literal("ui-route"),
    parent: identifierSchema.optional(),
    path: routePathSchema,
    title: z.string().min(1, "Route titles must not be empty.").optional(),
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
    events: z.array(z.enum(["onOpen", "onClose"])).optional()
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
    // action is deprecated — click events are now emitted on the output port.
    // Kept for backward compatibility with existing flows.
    action: z.string().min(1, "Buttons must reference an action.").optional(),
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
    parent: identifierSchema.optional(),
    statePath: z.string().min(1, "Stores must declare a state path."),
    initialValue: z.unknown().optional(),
    persist: z.boolean().optional()
});

export type UiStoreNodeDefinition = z.infer<typeof uiStoreNodeDefinitionSchema>;

export const uiQueryNodeDefinitionSchema = identifiedNodeSchema.extend({
    type: z.literal("ui-query"),
    parent: identifierSchema.optional(),
    queryPath: z.string().min(1, "Queries must declare a query path."),
    params: z.string().min(1, "Params store reference must not be empty.").optional(),
    refreshAction: z.string().min(1, "Refresh actions must not be empty.").optional()
});

export type UiQueryNodeDefinition = z.infer<typeof uiQueryNodeDefinitionSchema>;

export const uiActionNodeDefinitionSchema = identifiedNodeSchema.extend({
    type: z.literal("ui-action"),
    parent: identifierSchema.optional(),
    actionType: actionTypeSchema.optional(),
    // targetMode and target are kept for backward compatibility but deprecated.
    // The preferred model is wiring the output port to the target node.
    targetMode: actionTargetModeSchema.optional(),
    target: z.string().min(1, "Action targets must not be empty.").optional(),
    to: z.string().min(1, "Navigate actions must declare a destination.").optional(),
    description: z.string().min(1, "Action descriptions must not be empty.").optional()
});

export type UiActionNodeDefinition = z.infer<typeof uiActionNodeDefinitionSchema>;

export const uiNavigationNodeDefinitionSchema = identifiedNodeSchema.extend({
    type: z.literal("ui-navigation"),
    parent: identifierSchema.optional(),
    to: routePathSchema
});

export type UiNavigationNodeDefinition = z.infer<typeof uiNavigationNodeDefinitionSchema>;

// ── P16a: input control nodes ────────────────────────────────────────────────

const selectOptionSchema = z.object({
    label: z.string(),
    value: z.unknown()
});

export const uiSelectNodeDefinitionSchema = mountableNodeSchema.extend({
    type: z.literal("ui-select"),
    label: z.string().min(1, "Select labels must not be empty."),
    value: bindingSchema,
    options: z.union([z.array(selectOptionSchema), bindingSchema]).optional(),
    placeholder: z.string().optional(),
    multiple: z.boolean().optional(),
    searchable: z.boolean().optional(),
    disabled: bindingSchema.optional()
});

export type UiSelectNodeDefinition = z.infer<typeof uiSelectNodeDefinitionSchema>;

export const uiCheckboxNodeDefinitionSchema = mountableNodeSchema.extend({
    type: z.literal("ui-checkbox"),
    label: z.string().min(1, "Checkbox labels must not be empty."),
    value: bindingSchema,
    disabled: bindingSchema.optional()
});

export type UiCheckboxNodeDefinition = z.infer<typeof uiCheckboxNodeDefinitionSchema>;

export const uiRadioNodeDefinitionSchema = mountableNodeSchema.extend({
    type: z.literal("ui-radio"),
    label: z.string().min(1, "Radio labels must not be empty."),
    value: bindingSchema,
    options: z.union([z.array(selectOptionSchema), bindingSchema]),
    orientation: z.enum(["horizontal", "vertical"]).optional(),
    disabled: bindingSchema.optional()
});

export type UiRadioNodeDefinition = z.infer<typeof uiRadioNodeDefinitionSchema>;

export const uiSwitchNodeDefinitionSchema = mountableNodeSchema.extend({
    type: z.literal("ui-switch"),
    value: bindingSchema,
    label: z.string().optional(),
    labelOn: z.string().optional(),
    labelOff: z.string().optional(),
    disabled: bindingSchema.optional()
});

export type UiSwitchNodeDefinition = z.infer<typeof uiSwitchNodeDefinitionSchema>;

export const uiTextareaNodeDefinitionSchema = mountableNodeSchema.extend({
    type: z.literal("ui-textarea"),
    label: z.string().min(1, "Textarea labels must not be empty."),
    value: bindingSchema,
    placeholder: z.string().optional(),
    rows: z.number().int().positive().optional(),
    maxLength: z.number().int().positive().optional(),
    disabled: bindingSchema.optional()
});

export type UiTextareaNodeDefinition = z.infer<typeof uiTextareaNodeDefinitionSchema>;

export const uiDatepickerNodeDefinitionSchema = mountableNodeSchema.extend({
    type: z.literal("ui-datepicker"),
    label: z.string().min(1, "Datepicker labels must not be empty."),
    value: bindingSchema,
    mode: z.enum(["date", "datetime", "time"]).optional(),
    min: z.string().optional(),
    max: z.string().optional(),
    placeholder: z.string().optional(),
    disabled: bindingSchema.optional()
});

export type UiDatepickerNodeDefinition = z.infer<typeof uiDatepickerNodeDefinitionSchema>;

export const uiSliderNodeDefinitionSchema = mountableNodeSchema.extend({
    type: z.literal("ui-slider"),
    value: bindingSchema,
    label: z.string().optional(),
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
    severity: z.enum(["info", "warning", "error", "success"]).optional(),
    title: z.string().optional(),
    dismissible: z.boolean().optional(),
    visible: bindingSchema.optional()
});

export type UiAlertNodeDefinition = z.infer<typeof uiAlertNodeDefinitionSchema>;

export const uiToastNodeDefinitionSchema = identifiedNodeSchema.extend({
    type: z.literal("ui-toast"),
    parent: identifierSchema.optional(),
    severity: z.enum(["info", "warning", "error", "success"]).optional(),
    duration: z.number().int().min(0).optional(),
    position: z.enum(["top-right", "top-center", "bottom-right", "bottom-center"]).optional()
});

export type UiToastNodeDefinition = z.infer<typeof uiToastNodeDefinitionSchema>;

export const uiProgressNodeDefinitionSchema = mountableNodeSchema.extend({
    type: z.literal("ui-progress"),
    variant: z.enum(["bar", "spinner", "circular"]).optional(),
    value: bindingSchema.optional(),
    label: z.string().optional(),
    showValue: z.boolean().optional()
});

export type UiProgressNodeDefinition = z.infer<typeof uiProgressNodeDefinitionSchema>;

export const uiSkeletonNodeDefinitionSchema = mountableNodeSchema.extend({
    type: z.literal("ui-skeleton"),
    visible: bindingSchema,
    variant: z.enum(["text", "avatar", "card", "table"]).optional(),
    lines: z.number().int().positive().optional()
});

export type UiSkeletonNodeDefinition = z.infer<typeof uiSkeletonNodeDefinitionSchema>;

export const uiBadgeNodeDefinitionSchema = mountableNodeSchema.extend({
    type: z.literal("ui-badge"),
    value: bindingSchema,
    variant: z.enum(["count", "dot", "status"]).optional(),
    severity: z.enum(["default", "info", "warning", "error", "success"]).optional(),
    max: z.number().int().positive().optional()
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

export const uiBreadcrumbNodeDefinitionSchema = mountableNodeSchema.extend({
    type: z.literal("ui-breadcrumb"),
    items: z.union([
        z.array(z.object({ label: z.string().min(1), path: z.string().optional() })),
        bindingSchema
    ]),
    separator: z.string().optional()
});

export type UiBreadcrumbNodeDefinition = z.infer<typeof uiBreadcrumbNodeDefinitionSchema>;

const menuItemSchema: z.ZodType<{ label: string; path?: string; icon?: string; children?: Array<{ label: string; path?: string; icon?: string }> }> = z.object({
    label: z.string().min(1),
    path: z.string().optional(),
    icon: z.string().optional(),
    children: z.array(z.object({ label: z.string().min(1), path: z.string().optional(), icon: z.string().optional() })).optional()
});

export const uiMenuNodeDefinitionSchema = mountableNodeSchema.extend({
    type: z.literal("ui-menu"),
    variant: z.enum(["sidebar", "topbar", "dropdown"]).optional(),
    items: z.union([z.array(menuItemSchema), bindingSchema]),
    activeItem: bindingSchema.optional(),
    collapsed: bindingSchema.optional()
});

export type UiMenuNodeDefinition = z.infer<typeof uiMenuNodeDefinitionSchema>;

export const uiPaginationNodeDefinitionSchema = mountableNodeSchema.extend({
    type: z.literal("ui-pagination"),
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
    activeStep: bindingSchema,
    variant: z.enum(["horizontal", "vertical"]).optional(),
    linear: z.boolean().optional(),
    events: z.array(z.enum(["stepChange", "complete"])).optional()
});

export type UiStepperNodeDefinition = z.infer<typeof uiStepperNodeDefinitionSchema>;

// ── P16d: display nodes ──────────────────────────────────────────────────────

export const uiImageNodeDefinitionSchema = mountableNodeSchema.extend({
    type: z.literal("ui-image"),
    src: bindingSchema,
    alt: z.string().optional(),
    fallbackSrc: z.string().optional(),
    width: z.union([z.number().int().positive(), z.string()]).optional(),
    height: z.union([z.number().int().positive(), z.string()]).optional(),
    fit: z.enum(["contain", "cover", "fill", "none"]).optional()
});

export type UiImageNodeDefinition = z.infer<typeof uiImageNodeDefinitionSchema>;

export const uiIconNodeDefinitionSchema = mountableNodeSchema.extend({
    type: z.literal("ui-icon"),
    icon: z.string().min(1, "Icon names must not be empty."),
    size: z.enum(["xs", "sm", "md", "lg", "xl"]).optional(),
    color: z.string().optional()
});

export type UiIconNodeDefinition = z.infer<typeof uiIconNodeDefinitionSchema>;

const listItemSchema = z.object({
    label: z.string().min(1),
    value: z.string().optional(),
    icon: z.string().optional()
});

export const uiListNodeDefinitionSchema = mountableNodeSchema.extend({
    type: z.literal("ui-list"),
    items: z.union([z.array(listItemSchema), bindingSchema]),
    variant: z.enum(["default", "divided", "compact"]).optional(),
    events: z.array(z.enum(["itemClick", "itemSelect"])).optional()
});

export type UiListNodeDefinition = z.infer<typeof uiListNodeDefinitionSchema>;

export const uiAvatarNodeDefinitionSchema = mountableNodeSchema.extend({
    type: z.literal("ui-avatar"),
    src: bindingSchema.optional(),
    initials: bindingSchema.optional(),
    alt: z.string().optional(),
    size: z.enum(["xs", "sm", "md", "lg", "xl"]).optional(),
    shape: z.enum(["circle", "square"]).optional()
});

export type UiAvatarNodeDefinition = z.infer<typeof uiAvatarNodeDefinitionSchema>;

export const uiDividerNodeDefinitionSchema = mountableNodeSchema.extend({
    type: z.literal("ui-divider"),
    orientation: z.enum(["horizontal", "vertical"]).optional(),
    label: z.string().optional()
});

export type UiDividerNodeDefinition = z.infer<typeof uiDividerNodeDefinitionSchema>;

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
    uiDividerNodeDefinitionSchema
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
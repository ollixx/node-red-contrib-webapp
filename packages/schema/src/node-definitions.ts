import { z } from "zod";

import {
    actionParamsSchema,
    actionTargetModeSchema,
    actionToTypeSchema,
    actionTypeSchema,
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
    TEXT_VARIANTS
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
    title: z.string().min(1, "App titles must not be empty."),
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
    mediaStoreUrl: z.string().optional()
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
    // P49: constrained to the portable text vocabulary. Default "body".
    variant: z.enum(TEXT_VARIANTS).optional(),
    // P71: three-step size (sm/md/lg).
    size: componentSizeSchema.optional()
});

export type UiTextNodeDefinition = z.infer<typeof uiTextNodeDefinitionSchema>;

export const uiButtonNodeDefinitionSchema = mountableNodeSchema.extend({
    type: z.literal("ui-button"),
    label: z.string().min(1, "Button labels must not be empty."),
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
    label: z.string().min(1, "Input labels must not be empty."),
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
    refreshAction: z.string().min(1, "Refresh actions must not be empty.").optional(),
});

export type UiQueryNodeDefinition = z.infer<typeof uiQueryNodeDefinitionSchema>;

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
    targetMode: actionTargetModeSchema.optional(),
    target: z.string().min(1, "Action targets must not be empty.").optional(),
    // P53 (ADR 0005): sub-id within the target for open / close / select
    // granularity (accordion section, tree branch, tab name).
    part: z.string().min(1, "Action parts must not be empty.").optional(),
    // P66 (ADR 0007): navigate destination as a typedInput. `to` holds the value
    // (a path template, a msg/flow/global reference, or a JSONata expression),
    // `toType` its type (default "str"). Both optional: Scenario 1 (wired to a
    // ui-route) carries NO `to` — the route supplies the path. The dead-link /
    // ambiguity cross-checks are RUNTIME checks (the wire is invisible here).
    to: z.string().min(1, "Navigate actions must declare a destination.").optional(),
    toType: actionToTypeSchema.optional(),
    // P66: named URL params (Scenario 1 wired-route; or extra params with a `to`).
    params: actionParamsSchema.optional(),
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
    // P71: three-step size (sm/md/lg).
    size: componentSizeSchema.optional(),
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
    // P71: three-step size (sm/md/lg).
    size: componentSizeSchema.optional(),
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
    // P49b: unified with SEVERITY_VARIANTS — the single source of truth.
    // Legacy values "error" and "default" are no longer accepted; they were
    // normalised in the serializer before reaching here, so no runtime impact.
    severity: z.enum(SEVERITY_VARIANTS).optional(),
    // P67: title is now a full binding (literal/state/query/.../store), mirroring
    // `message`. Plain strings are no longer valid here — the editor and serializer
    // wrap a static title as { kind: "literal", value }.
    title: bindingSchema.optional(),
    dismissible: z.boolean().optional(),
    visible: bindingSchema.optional()
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
    value: bindingSchema.optional(),
    label: z.string().optional(),
    showValue: z.boolean().optional()
});

export type UiProgressNodeDefinition = z.infer<typeof uiProgressNodeDefinitionSchema>;

export const uiSkeletonNodeDefinitionSchema = mountableNodeSchema.extend({
    type: z.literal("ui-skeleton"),
    visible: bindingSchema,
    // P49: DISPLAY TYPE (placeholder shape), not a semantic variant.
    displayType: z.enum(["text", "avatar", "card", "table"]).optional(),
    lines: z.number().int().positive().optional()
});

export type UiSkeletonNodeDefinition = z.infer<typeof uiSkeletonNodeDefinitionSchema>;

export const uiBadgeNodeDefinitionSchema = mountableNodeSchema.extend({
    type: z.literal("ui-badge"),
    value: bindingSchema,
    // P49: count/dot/status is a DISPLAY TYPE, not a semantic variant. The
    // semantic Ebene-2 variant for a badge is `severity`.
    displayType: z.enum(["count", "dot", "status"]).optional(),
    // P49b: unified with SEVERITY_VARIANTS — the single source of truth.
    // Legacy values "error" and "default" are no longer accepted here.
    severity: z.enum(SEVERITY_VARIANTS).optional(),
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
    // P69: backend-neutral { library, name } icon value; binding-capable. A bare
    // string is still accepted (back-compat — maps to the default library).
    icon: iconFieldSchema,
    size: z.enum(["xs", "sm", "md", "lg", "xl"]).optional(),
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
    src: bindingSchema.optional(),
    initials: bindingSchema.optional(),
    // P69: optional icon fallback (shown when no src/initials resolve).
    // Backend-neutral { library, name }; binding-capable.
    icon: iconFieldSchema.optional(),
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
import {
    normalizeSelectOptions,
    standardLayoutPresetIds,
    validateUiNodeDefinition,
    SEVERITY_VARIANTS,
    type ActionParamEntry,
    type BindingDefinition,
    type StandardLayoutPresetId,
    type UiActionNodeDefinition,
    type UiAlertNodeDefinition,
    type UiAppNodeDefinition,
    type UiBadgeNodeDefinition,
    type UiButtonNodeDefinition,
    type UiCheckboxNodeDefinition,
    type UiContainerNodeDefinition,
    type UiDatepickerNodeDefinition,
    type UiDialogNodeDefinition,
    type UiEmptyStateNodeDefinition,
    type UiInputNodeDefinition,
    type UiNavigationNodeDefinition,
    type UiNodeDefinition,
    type UiProgressNodeDefinition,
    type UiQueryNodeDefinition,
    type UiRadioNodeDefinition,
    type UiRouteNodeDefinition,
    type UiSelectNodeDefinition,
    type UiSkeletonNodeDefinition,
    type UiSliderNodeDefinition,
    type UiStoreNodeDefinition,
    type UiSwitchNodeDefinition,
    type UiTableNodeDefinition,
    type UiTextareaNodeDefinition,
    type UiTextNodeDefinition,
    type UiToastNodeDefinition,
    type UiTabsNodeDefinition,
    type UiTabNodeDefinition,
    type UiAccordionNodeDefinition,
    type UiAccordionSectionNodeDefinition,
    type UiBreadcrumbNodeDefinition,
    type UiMenuNodeDefinition,
    type UiPaginationNodeDefinition,
    type UiStepperNodeDefinition,
    type UiImageNodeDefinition,
    type UiIconNodeDefinition,
    type UiListNodeDefinition,
    type UiAvatarNodeDefinition,
    type UiDividerNodeDefinition,
    type UiLogNodeDefinition,
    type UiRepeatNodeDefinition
} from "@node-red-contrib-webapp/schema";

export type NodeEditorType = UiNodeDefinition["type"];

export interface EditorValidationIssue {
    field: string;
    message: string;
}

interface EditorFieldDefinition {
    required?: boolean;
    validate?: (value: unknown, config: Record<string, unknown>) => string | undefined;
}

interface BaseEditorNodeDefinition<TConfig extends object, TDefinition extends UiNodeDefinition> {
    type: TDefinition["type"];
    category: "structure" | "view" | "state" | "behavior";
    defaults: Record<string, EditorFieldDefinition>;
    validate(config: TConfig): EditorValidationIssue[];
    emit(config: TConfig): { success: true; data: TDefinition } | { success: false; error: string; issues: EditorValidationIssue[] };
}

export interface UiAppEditorConfig {
    root?: string;
    name?: string;
    layout?: StandardLayoutPresetId;
}

export type UiAppEditorNodeDefinition = BaseEditorNodeDefinition<UiAppEditorConfig, UiAppNodeDefinition>;

export interface IdentifiedEditorConfig {
    id?: string;
}

export interface UiContainerEditorConfig extends MountableEditorConfig {
    layoutId?: StandardLayoutPresetId;
    title?: string;
    variant?: "card" | "panel" | "section" | "transparent";
}

// P163 (ADR 0017): minimal ui-repeat editor config. The full editor UX (items
// typedInput, keyField field, template slot) lands in P165 — this entry exists
// so the editor package type-checks against the schema's UiNodeDefinition union.
export interface UiRepeatEditorConfig extends MountableEditorConfig {
    items?: BindingDefinition | unknown[];
    itemsPath?: string;
    keyField?: string;
}

export interface UiRouteEditorConfig extends IdentifiedEditorConfig {
    path?: string;
    title?: string;
    layoutId?: StandardLayoutPresetId;
}

export interface UiDialogEditorConfig extends IdentifiedEditorConfig {
    title?: string;
    layoutId?: StandardLayoutPresetId;
    routeId?: string;
    modal?: boolean;
    closable?: boolean;
}

interface MountableEditorConfig extends IdentifiedEditorConfig {
    mount?: string;
    order?: number;
    row?: number;
    col?: number;
    colSize?: number;
    rowSize?: number;
    layoutX?: number;
    layoutY?: number;
}

export interface UiTextEditorConfig extends MountableEditorConfig {
    text?: string;
    value?: BindingDefinition;
    // P111: `style` = typographic role (→ HTML tag), `variant` = semantic colour.
    style?: "heading-1" | "heading-2" | "heading-3" | "body" | "caption" | "label" | "code";
    variant?: "default" | "muted" | "primary" | "success" | "warning" | "danger" | "neutral";
}

export interface UiButtonEditorConfig extends MountableEditorConfig {
    // P144 (ADR 0012): label accepts a binding object or a literal string.
    label?: string | BindingDefinition;
    action?: string;
    disabledPath?: string;
    variant?: "primary" | "secondary" | "success" | "danger" | "warning" | "neutral" | "ghost" | "link";
}

export interface UiTableEditorConfig extends MountableEditorConfig {
    columns?: string[];
    // P158 (ADR 0012): `rows` is the canonical STRUCTURAL array DATA SOURCE — a
    // static array of row records, OR a binding object (store/query/reactive/
    // json-literal). The table renders its rows ITSELF (a data source, NOT a
    // repeats case). `rowsPath` is the legacy plain state/query path kept for
    // migration only. `columns` (schema) stays separate (Collections).
    rows?: BindingDefinition | unknown[];
    rowsPath?: string;
    selectAction?: string;
}

export interface UiInputEditorConfig extends MountableEditorConfig {
    // P145 (ADR 0012): label accepts a binding object or a literal string.
    label?: string | BindingDefinition;
    valuePath?: string;
    storeId?: string;
    path?: string;
    inputType?: "text" | "email" | "number";
    placeholder?: string;
    variant?: "default" | "filled" | "outlined";
}

export interface UiStoreEditorConfig extends IdentifiedEditorConfig {
    statePath?: string;
    initialValue?: unknown;
}

export interface UiQueryEditorConfig extends IdentifiedEditorConfig {
    queryPath?: string;
    refreshAction?: string;
}

export interface UiSelectEditorConfig extends MountableEditorConfig {
    // P133: label and placeholder accept a binding object or a literal string.
    label?: string | BindingDefinition;
    valuePath?: string;
    // P133: single Options field — a binding object (json literal | store) or a
    // raw JSON value; legacy optionsJson/optionsBinding kept for migration.
    options?: unknown;
    optionsJson?: string;
    optionsBinding?: string;
    placeholder?: string | BindingDefinition;
    multiple?: boolean;
}

export interface UiCheckboxEditorConfig extends MountableEditorConfig {
    label?: string;
    valuePath?: string;
}

export interface UiRadioEditorConfig extends MountableEditorConfig {
    // P136: label accepts a binding object or a literal string (shared with ui-select).
    label?: string | BindingDefinition;
    valuePath?: string;
    // P136: single Options field — a binding object (json literal | store) or a
    // raw JSON value; legacy optionsJson/optionsBinding kept for migration.
    options?: unknown;
    optionsJson?: string;
    optionsBinding?: string;
    orientation?: "horizontal" | "vertical";
}

export interface UiSwitchEditorConfig extends MountableEditorConfig {
    valuePath?: string;
    // P147 (ADR 0012): all three label fields accept a binding object or a
    // plain string (legacy plain-string migrated via load-shim in the editor).
    label?: string | BindingDefinition;
    labelOn?: string | BindingDefinition;
    labelOff?: string | BindingDefinition;
}

export interface UiTextareaEditorConfig extends MountableEditorConfig {
    // P148 (ADR 0012): label and placeholder accept a binding object or a literal string.
    label?: string | BindingDefinition;
    valuePath?: string;
    placeholder?: string | BindingDefinition;
    rows?: number;
    maxLength?: number;
}

export interface UiDatepickerEditorConfig extends MountableEditorConfig {
    label?: string;
    valuePath?: string;
    mode?: "date" | "datetime" | "time";
    min?: string;
    max?: string;
    // P149 (ADR 0012): placeholder accepts a binding object or a literal string.
    placeholder?: string | BindingDefinition;
}

export interface UiSliderEditorConfig extends MountableEditorConfig {
    valuePath?: string;
    // P146 (ADR 0012): label accepts a binding object or a literal string.
    label?: string | BindingDefinition;
    min?: number;
    max?: number;
    step?: number;
    showValue?: boolean;
}

export interface UiActionEditorConfig extends IdentifiedEditorConfig {
    actionType?: "navigate" | "disable" | "enable" | "show" | "hide" | "trigger";
    // P118 (ADR 0011 §1): navigate target SOURCE — wire | route | url.
    targetMode?: "wire" | "route" | "url";
    // P118: referenced ui-route id (route mode).
    routeId?: string;
    target?: string;
    to?: string;
    // P66: navigate `to` is a typedInput. `toType` is its type.
    toType?: "str" | "msg" | "flow" | "global" | "jsonata";
    // P118 (ADR 0011 §1): typed navigate params — a JSON-array string of
    // { name, value, valueType } rows (route mode). The legacy `{k: "v"}` object
    // string is still accepted and migrated to str-typed rows on emit.
    params?: string;
    description?: string;
}

export interface UiNavigationEditorConfig extends IdentifiedEditorConfig {
    to?: string;
}

// P16b: feedback and status node editor configs
export interface UiAlertEditorConfig extends MountableEditorConfig {
    // P67: message is a full binding (literal/state/query/.../store). messagePath
    // stays for back-compat (legacy flows) → wrapped as a state binding.
    message?: BindingDefinition;
    messagePath?: string;
    // P49b: unified with SEVERITY_VARIANTS — primary|success|warning|danger|neutral|info
    severity?: "primary" | "success" | "warning" | "danger" | "neutral" | "info";
    // P67: title is a binding too (or a plain string → literal binding).
    title?: BindingDefinition | string;
    dismissible?: boolean;
}

export interface UiToastEditorConfig extends IdentifiedEditorConfig {
    parent?: string;
    // P49b: unified with SEVERITY_VARIANTS — primary|success|warning|danger|neutral|info
    severity?: "primary" | "success" | "warning" | "danger" | "neutral" | "info";
    duration?: number;
    position?: "top-right" | "top-center" | "bottom-right" | "bottom-center";
}

export interface UiProgressEditorConfig extends MountableEditorConfig {
    displayType?: "bar" | "spinner" | "circular";
    // P137 (ADR 0012): `valuePath` kept for migration only (pre-P137 plain state path).
    // The canonical field is `value` (persisted as a binding object by the editor).
    valuePath?: string;
    value?: BindingDefinition;
    // P137 (ADR 0012): `label` is now a full binding (literal string or dynamic binding).
    // Back-compat: a plain string is still accepted for pre-P137 flows.
    label?: string | BindingDefinition;
    showValue?: boolean;
}

export interface UiSkeletonEditorConfig extends MountableEditorConfig {
    // P138 (ADR 0012): `visible` is now a full binding object (boolean-state set).
    // Legacy `visiblePath` (plain state path string) is kept for migration only.
    visible?: BindingDefinition | null;
    visiblePath?: string;
    displayType?: "text" | "avatar" | "card" | "table";
    lines?: number;
}

export interface UiBadgeEditorConfig extends MountableEditorConfig {
    // P153 (ADR 0012): `valuePath` kept for migration only (pre-P153 plain state path).
    // The canonical field is `value` (persisted as a binding object by the editor).
    valuePath?: string;
    value?: BindingDefinition;
    // P92: displayType is now shape (square/rounded/pill).
    displayType?: "square" | "rounded" | "pill";
    // P92: variant (renamed from severity).
    variant?: "primary" | "success" | "warning" | "danger" | "neutral" | "info";
    // P92: severity kept for back-compat with old flows.
    severity?: "primary" | "success" | "warning" | "danger" | "neutral" | "info";
    // P92: pulsating — maps to Shoelace `pulse` attribute.
    pulsating?: boolean;
    // P103: size field removed.
    // P92: max field removed (was for count truncation).
}

export interface UiEmptyStateEditorConfig extends MountableEditorConfig {
    visiblePath?: string;
    icon?: string;
    title?: string;
    message?: string;
    action?: string;
    actionLabel?: string;
}

// P16c: navigation and structure node editor configs
// P167 (ADR 0018, Model 1a): the `tabs` JSON config field is REMOVED — tabs are
// derived from mounted `ui-tab` children. The full ui-tabs editor UX (no tabs
// field, derived-slot mount picker) lands in P168; this entry keeps the editor
// package type-checking against the schema's reworked UiTabsNodeDefinition.
export interface UiTabsEditorConfig extends MountableEditorConfig {
    // P155 (ADR 0012): `activeTab` is the canonical two-way value typedInput
    // (persisted as a binding object). P167: it now carries the active CHILD ID.
    // The legacy `activeTabPath` plain state path is kept for migration only.
    activeTab?: BindingDefinition;
    activeTabPath?: string;
    events?: string;
}

// P167 (ADR 0018): minimal `ui-tab` editor config — a container child of
// ui-tabs carrying label/icon/order plus a default content slot. The full editor
// UX (label value typedInput, icon, order, content slot) lands in P168; this
// entry exists so the editor package type-checks against the schema's new
// UiTabNodeDefinition.
export interface UiTabEditorConfig extends MountableEditorConfig {
    label?: BindingDefinition;
    labelPath?: string;
    icon?: string;
}

// P169 (ADR 0018, Model 1a): the `sections` JSON config field is REMOVED —
// sections are derived from mounted `ui-accordion-section` children. The
// open-state is the canonical two-way `openSection` binding (mirror of ui-tabs
// `activeTab`); the legacy `openSectionPath` plain state path is migration-only.
export interface UiAccordionEditorConfig extends MountableEditorConfig {
    openSection?: BindingDefinition;
    openSectionPath?: string;
    multiple?: boolean;
    events?: string;
}

// P169 (ADR 0018): `ui-accordion-section` editor config — a container child of
// ui-accordion carrying label/icon/order plus a default content slot. Mirror of
// UiTabEditorConfig.
export interface UiAccordionSectionEditorConfig extends MountableEditorConfig {
    label?: BindingDefinition;
    labelPath?: string;
    icon?: string;
}

export interface UiBreadcrumbEditorConfig extends MountableEditorConfig {
    itemsPath?: string;
}

export interface UiMenuEditorConfig extends MountableEditorConfig {
    displayType?: "sidebar" | "topbar";
    // P157 (ADR 0012): `items` (structural array source: store/query/reactive/
    // json-literal) and `activeRoute` (read-only active-route value) are the
    // canonical value typedInputs, persisted as binding objects. The legacy
    // `itemsPath` / `activeRoutePath` plain state paths are kept for migration only.
    items?: BindingDefinition | unknown[];
    activeRoute?: BindingDefinition;
    itemsPath?: string;
    activeRoutePath?: string;
}

export interface UiPaginationEditorConfig extends MountableEditorConfig {
    // P154 (ADR 0012): `total` (read-only) and `currentPage` (two-way) are the
    // canonical value typedInputs (persisted as binding objects). The legacy
    // `totalPath` / `currentPagePath` plain state paths are kept for migration only.
    total?: BindingDefinition;
    currentPage?: BindingDefinition;
    totalPath?: string;
    currentPagePath?: string;
    pageSize?: number;
    events?: string;
}

export interface UiStepperEditorConfig extends MountableEditorConfig {
    steps?: string;
    // P156 (ADR 0012): `activeStep` is the canonical two-way value typedInput
    // (persisted as a binding object). The legacy `activeStepPath` plain state
    // path is kept for migration only.
    activeStep?: BindingDefinition;
    activeStepPath?: string;
    orientation?: "horizontal" | "vertical";
    events?: string;
}

export interface UiImageEditorConfig extends MountableEditorConfig {
    srcPath?: string;
    // P151 (ADR 0012): alt and fallback are now binding-capable.
    alt?: string | BindingDefinition;
    fallback?: string | BindingDefinition;
    width?: string;
    height?: string;
}

export interface UiIconEditorConfig extends MountableEditorConfig {
    icon?: string;
    size?: string;
    color?: string;
}

export interface UiListEditorConfig extends MountableEditorConfig {
    // P171: `items` is a STRUCTURAL value-binding (typedInput). A stored binding
    // object wins; the legacy `itemsPath` plain state path migrates to a state
    // binding; a static array may carry mixed String/object elements.
    items?: unknown;
    itemsPath?: string;
    displayType?: "default" | "divided" | "compact";
    displayValue?: "none" | "secondary" | "badge";
    badgeVariant?: (typeof SEVERITY_VARIANTS)[number];
    events?: string;
}

export interface UiAvatarEditorConfig extends MountableEditorConfig {
    srcPath?: string;
    initials?: string;
    // P93: alt removed — sl-avatar uses `label` attr for a11y, not `alt`.
    size?: "sm" | "md" | "lg";
    shape?: "circle" | "square";
}

export interface UiDividerEditorConfig extends MountableEditorConfig {
    orientation?: "horizontal" | "vertical";
    // P150 (ADR 0012): label may be a literal string or a binding object.
    label?: string | BindingDefinition;
}

export interface UiLogEditorConfig extends MountableEditorConfig {
    minSeverity?: "debug" | "info" | "warn" | "error";
    maxEntries?: number;
    collapsed?: boolean;
}

export type NodeEditorConfig =
    | UiAppEditorConfig
    | UiRouteEditorConfig
    | UiDialogEditorConfig
    | UiTextEditorConfig
    | UiButtonEditorConfig
    | UiTableEditorConfig
    | UiContainerEditorConfig
    | UiRepeatEditorConfig
    | UiInputEditorConfig
    | UiSelectEditorConfig
    | UiCheckboxEditorConfig
    | UiRadioEditorConfig
    | UiSwitchEditorConfig
    | UiTextareaEditorConfig
    | UiDatepickerEditorConfig
    | UiSliderEditorConfig
    | UiStoreEditorConfig
    | UiQueryEditorConfig
    | UiActionEditorConfig
    | UiNavigationEditorConfig
    | UiAlertEditorConfig
    | UiToastEditorConfig
    | UiProgressEditorConfig
    | UiSkeletonEditorConfig
    | UiBadgeEditorConfig
    | UiEmptyStateEditorConfig
    | UiTabsEditorConfig
    | UiTabEditorConfig
    | UiAccordionEditorConfig
    | UiBreadcrumbEditorConfig
    | UiMenuEditorConfig
    | UiPaginationEditorConfig
    | UiStepperEditorConfig
    | UiImageEditorConfig
    | UiIconEditorConfig
    | UiListEditorConfig
    | UiAvatarEditorConfig
    | UiDividerEditorConfig
    | UiLogEditorConfig;

export type NodeEditorDefinition =
    | UiAppEditorNodeDefinition
    | BaseEditorNodeDefinition<UiRouteEditorConfig, UiRouteNodeDefinition>
    | BaseEditorNodeDefinition<UiDialogEditorConfig, UiDialogNodeDefinition>
    | BaseEditorNodeDefinition<UiTextEditorConfig, UiTextNodeDefinition>
    | BaseEditorNodeDefinition<UiButtonEditorConfig, UiButtonNodeDefinition>
    | BaseEditorNodeDefinition<UiTableEditorConfig, UiTableNodeDefinition>
    | BaseEditorNodeDefinition<UiContainerEditorConfig, UiContainerNodeDefinition>
    | BaseEditorNodeDefinition<UiRepeatEditorConfig, UiRepeatNodeDefinition>
    | BaseEditorNodeDefinition<UiInputEditorConfig, UiInputNodeDefinition>
    | BaseEditorNodeDefinition<UiSelectEditorConfig, UiSelectNodeDefinition>
    | BaseEditorNodeDefinition<UiCheckboxEditorConfig, UiCheckboxNodeDefinition>
    | BaseEditorNodeDefinition<UiRadioEditorConfig, UiRadioNodeDefinition>
    | BaseEditorNodeDefinition<UiSwitchEditorConfig, UiSwitchNodeDefinition>
    | BaseEditorNodeDefinition<UiTextareaEditorConfig, UiTextareaNodeDefinition>
    | BaseEditorNodeDefinition<UiDatepickerEditorConfig, UiDatepickerNodeDefinition>
    | BaseEditorNodeDefinition<UiSliderEditorConfig, UiSliderNodeDefinition>
    | BaseEditorNodeDefinition<UiStoreEditorConfig, UiStoreNodeDefinition>
    | BaseEditorNodeDefinition<UiQueryEditorConfig, UiQueryNodeDefinition>
    | BaseEditorNodeDefinition<UiActionEditorConfig, UiActionNodeDefinition>
    | BaseEditorNodeDefinition<UiNavigationEditorConfig, UiNavigationNodeDefinition>
    | BaseEditorNodeDefinition<UiAlertEditorConfig, UiAlertNodeDefinition>
    | BaseEditorNodeDefinition<UiToastEditorConfig, UiToastNodeDefinition>
    | BaseEditorNodeDefinition<UiProgressEditorConfig, UiProgressNodeDefinition>
    | BaseEditorNodeDefinition<UiSkeletonEditorConfig, UiSkeletonNodeDefinition>
    | BaseEditorNodeDefinition<UiBadgeEditorConfig, UiBadgeNodeDefinition>
    | BaseEditorNodeDefinition<UiEmptyStateEditorConfig, UiEmptyStateNodeDefinition>
    | BaseEditorNodeDefinition<UiTabsEditorConfig, UiTabsNodeDefinition>
    | BaseEditorNodeDefinition<UiTabEditorConfig, UiTabNodeDefinition>
    | BaseEditorNodeDefinition<UiAccordionEditorConfig, UiAccordionNodeDefinition>
    | BaseEditorNodeDefinition<UiAccordionSectionEditorConfig, UiAccordionSectionNodeDefinition>
    | BaseEditorNodeDefinition<UiBreadcrumbEditorConfig, UiBreadcrumbNodeDefinition>
    | BaseEditorNodeDefinition<UiMenuEditorConfig, UiMenuNodeDefinition>
    | BaseEditorNodeDefinition<UiPaginationEditorConfig, UiPaginationNodeDefinition>
    | BaseEditorNodeDefinition<UiStepperEditorConfig, UiStepperNodeDefinition>
    | BaseEditorNodeDefinition<UiImageEditorConfig, UiImageNodeDefinition>
    | BaseEditorNodeDefinition<UiIconEditorConfig, UiIconNodeDefinition>
    | BaseEditorNodeDefinition<UiListEditorConfig, UiListNodeDefinition>
    | BaseEditorNodeDefinition<UiAvatarEditorConfig, UiAvatarNodeDefinition>
    | BaseEditorNodeDefinition<UiDividerEditorConfig, UiDividerNodeDefinition>
    | BaseEditorNodeDefinition<UiLogEditorConfig, UiLogNodeDefinition>;

function requiredString(message: string): EditorFieldDefinition {
    return {
        required: true,
        validate(value) {
            return typeof value === "string" && value.trim().length > 0 ? undefined : message;
        }
    };
}

function requiredStringArray(message: string): EditorFieldDefinition {
    return {
        required: true,
        validate(value) {
            return Array.isArray(value) && value.length > 0 && value.every((entry) => typeof entry === "string" && entry.trim().length > 0)
                ? undefined
                : message;
        }
    };
}

function optionalInteger(message: string): EditorFieldDefinition {
    return {
        validate(value) {
            if (value === undefined) {
                return undefined;
            }

            return typeof value === "number" && Number.isInteger(value) ? undefined : message;
        }
    };
}

function optionalStringEnum(values: string[], message: string): EditorFieldDefinition {
    return {
        validate(value) {
            if (value === undefined) {
                return undefined;
            }

            return typeof value === "string" && values.includes(value) ? undefined : message;
        }
    };
}

function requiredStringEnum(values: string[], missingMessage: string, invalidMessage: string): EditorFieldDefinition {
    return {
        required: true,
        validate(value) {
            if (typeof value !== "string" || value.trim().length === 0) {
                return missingMessage;
            }

            return values.includes(value) ? undefined : invalidMessage;
        }
    };
}

function collectIssues(config: Record<string, unknown>, defaults: Record<string, EditorFieldDefinition>): EditorValidationIssue[] {
    const issues: EditorValidationIssue[] = [];

    for (const [field, definition] of Object.entries(defaults)) {
        const message = definition.validate?.(config[field], config);

        if (message) {
            issues.push({
                field,
                message
            });
        }
    }

    return issues;
}

function emitDefinition<TDefinition extends UiNodeDefinition>(
    rawDefinition: TDefinition,
    issues: EditorValidationIssue[]
): { success: true; data: TDefinition } | { success: false; error: string; issues: EditorValidationIssue[] } {
    if (issues.length > 0) {
        return {
            success: false,
            error: issues.map((issue) => `${issue.field}: ${issue.message}`).join(" "),
            issues
        };
    }

    const validation = validateUiNodeDefinition(rawDefinition);

    if (!validation.success) {
        return {
            success: false,
            error: validation.error,
            issues
        };
    }

    return {
        success: true,
        data: validation.data as TDefinition
    };
}

// P66: parse the editor's key/value params (stored as a JSON object string) into
// a string→string record. Returns undefined for empty / invalid input so the
// emitted definition omits `params` rather than carrying noise.
function parseParamsObject(value: string | undefined): Record<string, string> | undefined {
    if (!value || typeof value !== "string") {
        return undefined;
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(value);
    }
    catch {
        return undefined;
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return undefined;
    }
    const out: Record<string, string> = {};
    for (const [key, val] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof val === "string") {
            out[key] = val;
        }
    }
    return Object.keys(out).length > 0 ? out : undefined;
}

// P118 (ADR 0011 §1): normalise the editor's `params` field into the canonical
// list of typed entries. Accepts the new JSON-array form `[{name,value,valueType}]`
// or the legacy JSON-object `{k: "v"}` (migrated to str-typed rows). Returns
// undefined for empty/invalid input.
const ACTION_PARAM_VALUE_TYPES = new Set(["str", "msg", "jsonata", "flow", "global", "env"]);

function migrateActionParamList(value: string | undefined): ActionParamEntry[] | undefined {
    if (!value || typeof value !== "string") {
        return undefined;
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(value);
    }
    catch {
        return undefined;
    }
    if (Array.isArray(parsed)) {
        const out: ActionParamEntry[] = [];
        for (const entry of parsed) {
            if (!entry || typeof entry !== "object") {
                continue;
            }
            const e = entry as Record<string, unknown>;
            const name = typeof e.name === "string" ? e.name.trim() : "";
            if (!name) {
                continue;
            }
            const valueType = (typeof e.valueType === "string" && ACTION_PARAM_VALUE_TYPES.has(e.valueType)
                ? e.valueType
                : "str") as ActionParamEntry["valueType"];
            const v = e.value === undefined || e.value === null ? "" : String(e.value);
            out.push({ name, value: v, valueType });
        }
        return out.length > 0 ? out : undefined;
    }
    // Legacy object → str-typed rows.
    const obj = parseParamsObject(value);
    if (!obj) {
        return undefined;
    }
    const migrated = Object.entries(obj).map(([name, v]) => ({ name, value: v, valueType: "str" as const }));
    return migrated.length > 0 ? migrated : undefined;
}

function literalBinding(value: string): BindingDefinition {
    return {
        kind: "literal",
        value
    };
}

function stateBinding(path: string): BindingDefinition {
    return {
        kind: "state",
        path
    };
}

function isBindingObject(value: unknown): value is BindingDefinition {
    return Boolean(value) && typeof value === "object" && typeof (value as { kind?: unknown }).kind === "string";
}

// P133 (ADR 0012): resolve a ui-select / ui-radio `options` editor config into
// the node-definition `options` value — a normalised `{label,value}[]` array
// (json type) or a binding object (store type), migrating legacy fields.
function selectOptionsFromConfig(
    config: { options?: unknown; optionsJson?: string; optionsBinding?: string },
    fallback: UiSelectNodeDefinition["options"]
): UiSelectNodeDefinition["options"] {
    const candidate = config.options;
    if (isBindingObject(candidate)) {
        if (candidate.kind === "literal") {
            const normalised = normalizeSelectOptions((candidate as { value?: unknown }).value);
            return normalised.ok ? normalised.options : fallback;
        }
        return candidate;
    }
    if (candidate && typeof candidate === "object") {
        const normalised = normalizeSelectOptions(candidate);
        return normalised.ok ? normalised.options : fallback;
    }
    if (config.optionsJson) {
        const normalised = normalizeSelectOptions(JSON.parse(config.optionsJson));
        return normalised.ok ? normalised.options : fallback;
    }
    if (config.optionsBinding) {
        return stateBinding(config.optionsBinding);
    }
    return fallback;
}

// P133: a ui-select label/placeholder may be a literal string or a binding —
// either is passed through to the schema (which accepts both).
function bindingOrString(value: string | BindingDefinition | undefined): string | BindingDefinition | undefined {
    return value;
}

// P157 (ADR 0012): resolve a ui-menu `items` editor config into the schema
// `items` value — a static array (the menu renders its entries itself, a
// STRUCTURAL array like ui-select `options`, NOT a repeats case) OR a binding
// object (store/query/reactive). A json-literal binding's raw array is unwrapped
// so the schema's `array(menuItem)` branch accepts it; every dynamic binding kind
// passes through for the renderer's structural resolution. Legacy `itemsPath`
// plain state paths migrate to a state binding.
function menuItemsFromConfig(config: UiMenuEditorConfig): UiMenuNodeDefinition["items"] {
    const candidate = config.items;
    if (isBindingObject(candidate)) {
        if (candidate.kind === "literal") {
            const raw = (candidate as { value?: unknown }).value;
            return Array.isArray(raw) ? (raw as UiMenuNodeDefinition["items"]) : candidate;
        }
        return candidate;
    }
    if (Array.isArray(candidate)) {
        return candidate as UiMenuNodeDefinition["items"];
    }
    if (config.itemsPath) {
        return stateBinding(config.itemsPath);
    }
    return stateBinding("");
}

// P158 (ADR 0012): resolve a ui-table `rows` editor config into the schema
// `rows` value — the canonical STRUCTURAL array DATA SOURCE (the table renders
// its rows ITSELF; this is a data source, NOT a repeats case). It mirrors the
// ui-select `options` (P133) / ui-menu `items` (P157) structural pattern: a
// static array of row records, OR a binding object (store/query/reactive). A
// json-literal binding's raw array is unwrapped so the schema's binding-literal
// branch carries it; every dynamic binding kind passes through for the
// renderer's structural resolution. Legacy `rowsPath` plain paths migrate to a
// state binding (P137 shim). `columns` (schema) stays separate.
function tableRowsFromConfig(config: UiTableEditorConfig): UiTableNodeDefinition["rows"] {
    const candidate = config.rows;
    if (isBindingObject(candidate)) {
        return candidate;
    }
    if (Array.isArray(candidate)) {
        return { kind: "literal", value: candidate };
    }
    if (config.rowsPath) {
        return stateBinding(config.rowsPath);
    }
    return stateBinding("");
}

// P171 (ADR 0012): resolve a ui-list `items` editor config into the schema `items`
// value — a STRUCTURAL array source like ui-menu `items` / ui-table `rows`. A
// binding object passes through (a json-literal's raw array is unwrapped so the
// schema's `array(listItem)` branch accepts it); a static array (mixed String /
// object elements) is kept; a legacy `itemsPath` plain state path migrates to a
// state binding (PRECISE: a leading `state.` is stripped — never `state.state.…`).
function listItemsFromConfig(config: UiListEditorConfig): UiListNodeDefinition["items"] {
    const candidate = config.items;
    if (isBindingObject(candidate)) {
        if (candidate.kind === "literal") {
            const raw = (candidate as { value?: unknown }).value;
            return Array.isArray(raw) ? (raw as UiListNodeDefinition["items"]) : candidate;
        }
        return candidate;
    }
    if (Array.isArray(candidate)) {
        return candidate as UiListNodeDefinition["items"];
    }
    if (config.itemsPath) {
        const trimmed = config.itemsPath.trim();
        const path = trimmed.startsWith("state.") ? trimmed.slice("state.".length) : trimmed;
        return stateBinding(path);
    }
    return [];
}

// P163 (ADR 0017): build the ui-repeat `items` value-binding from editor config.
// Mirrors tableRowsFromConfig — a binding object, a raw array (→ literal), or a
// plain state path (legacy `itemsPath`). The full typedInput UX is P165.
function repeatItemsFromConfig(config: UiRepeatEditorConfig): UiRepeatNodeDefinition["items"] {
    const candidate = config.items;
    if (isBindingObject(candidate)) {
        return candidate;
    }
    if (Array.isArray(candidate)) {
        return { kind: "literal", value: candidate };
    }
    if (config.itemsPath) {
        return stateBinding(config.itemsPath);
    }
    return stateBinding("");
}

function collectLayoutChildConfig(config: MountableEditorConfig) {
    return {
        ...(config.order !== undefined ? { order: config.order } : {}),
        ...(config.row !== undefined ? { row: config.row } : {}),
        ...(config.col !== undefined ? { col: config.col } : {}),
        ...(config.colSize !== undefined ? { colSize: config.colSize } : {}),
        ...(config.rowSize !== undefined ? { rowSize: config.rowSize } : {}),
        ...(config.layoutX !== undefined ? { layoutX: config.layoutX } : {}),
        ...(config.layoutY !== undefined ? { layoutY: config.layoutY } : {})
    };
}

function createDefinition<TConfig extends object, TDefinition extends UiNodeDefinition>(
    type: TDefinition["type"],
    category: BaseEditorNodeDefinition<TConfig, TDefinition>["category"],
    defaults: Record<string, EditorFieldDefinition>,
    factory: (config: TConfig) => TDefinition
): BaseEditorNodeDefinition<TConfig, TDefinition> {
    return {
        type,
        category,
        defaults,
        validate(config) {
            return collectIssues(config as Record<string, unknown>, defaults);
        },
        emit(config) {
            const issues = collectIssues(config as Record<string, unknown>, defaults);
            return emitDefinition(factory(config), issues);
        }
    };
}

export const nodeSet: Record<NodeEditorType, NodeEditorDefinition> = {
    "ui-app": createDefinition("ui-app", "structure", {
        root: requiredString("App roots are required before deploy."),
        layout: requiredStringEnum([...standardLayoutPresetIds], "Apps must declare a base layout.", "Apps must declare a known base layout.")
    }, (config: UiAppEditorConfig): UiAppNodeDefinition => ({
        type: "ui-app",
        id: config.root ?? "",
        // P109: `name` replaces `title` in the schema.
        name: config.name ?? undefined,
        root: config.root ?? undefined,
        layout: config.layout ?? "vertical"
    })),
    "ui-route": createDefinition("ui-route", "structure", {
        id: requiredString("Route IDs are required before deploy."),
        path: requiredString("Routes must declare a path."),
        layoutId: requiredStringEnum([...standardLayoutPresetIds], "Routes must reference a layout.", "Routes must reference a known layout.")
    }, (config: UiRouteEditorConfig): UiRouteNodeDefinition => ({
        type: "ui-route",
        id: config.id ?? "",
        path: config.path ?? "",
        title: config.title,
        layout: config.layoutId ?? "vertical"
    })),
    "ui-dialog": createDefinition("ui-dialog", "structure", {
        id: requiredString("Dialog IDs are required before deploy."),
        layoutId: requiredStringEnum([...standardLayoutPresetIds], "Dialogs must reference a layout.", "Dialogs must reference a known layout.")
    }, (config: UiDialogEditorConfig): UiDialogNodeDefinition => ({
        type: "ui-dialog",
        id: config.id ?? "",
        title: config.title,
        layout: config.layoutId ?? "vertical",
        routeId: config.routeId,
        modal: config.modal ?? true,
        closable: config.closable ?? true
    })),
    "ui-text": createDefinition("ui-text", "view", {
        id: requiredString("Text node IDs are required before deploy."),
        mount: requiredString("Text nodes must declare a mount target."),
        text: {
            validate(value, config) {
                if (config.value && typeof config.value === "object") {
                    return undefined;
                }

                return typeof value === "string" && value.trim().length > 0
                    ? undefined
                    : "Text nodes must declare a value.";
            }
        },
        order: optionalInteger("Text order must be an integer."),
        row: optionalInteger("Text grid rows must be integers."),
        col: optionalInteger("Text grid columns must be integers."),
        colSize: optionalInteger("Text grid column spans must be integers."),
        rowSize: optionalInteger("Text grid row spans must be integers."),
        layoutX: optionalInteger("Text absolute x coordinates must be integers."),
        layoutY: optionalInteger("Text absolute y coordinates must be integers.")
    }, (config: UiTextEditorConfig): UiTextNodeDefinition => ({
        type: "ui-text",
        id: config.id ?? "",
        mount: config.mount ?? "",
        value: config.value ?? literalBinding(config.text ?? ""),
        // P111: style (typographic role) + variant (semantic colour).
        style: config.style,
        variant: config.variant,
        ...collectLayoutChildConfig(config)
    })),
    "ui-button": createDefinition("ui-button", "view", {
        id: requiredString("Button IDs are required before deploy."),
        mount: requiredString("Buttons must declare a mount target."),
        label: requiredString("Buttons must declare a label."),
        action: requiredString("Buttons must reference an action."),
        order: optionalInteger("Button order must be an integer."),
        row: optionalInteger("Button grid rows must be integers."),
        col: optionalInteger("Button grid columns must be integers."),
        colSize: optionalInteger("Button grid column spans must be integers."),
        rowSize: optionalInteger("Button grid row spans must be integers."),
        layoutX: optionalInteger("Button absolute x coordinates must be integers."),
        layoutY: optionalInteger("Button absolute y coordinates must be integers.")
    }, (config: UiButtonEditorConfig): UiButtonNodeDefinition => ({
        type: "ui-button",
        id: config.id ?? "",
        mount: config.mount ?? "",
        // P144: label is a binding (literal string or dynamic binding).
        label: bindingOrString(config.label) ?? "",
        action: config.action ?? "",
        variant: config.variant,
        disabled: config.disabledPath ? stateBinding(config.disabledPath) : undefined,
        ...collectLayoutChildConfig(config)
    })),
    "ui-table": createDefinition("ui-table", "view", {
        id: requiredString("Table IDs are required before deploy."),
        mount: requiredString("Tables must declare a mount target."),
        columns: requiredStringArray("Tables must declare at least one column."),
        // P158 (ADR 0012): `rows` is a typedInput binding (data-array source) — no
        // requiredString validator. Migration: legacy `rowsPath` → state binding.
        order: optionalInteger("Table order must be an integer."),
        row: optionalInteger("Table grid rows must be integers."),
        col: optionalInteger("Table grid columns must be integers."),
        colSize: optionalInteger("Table grid column spans must be integers."),
        rowSize: optionalInteger("Table grid row spans must be integers."),
        layoutX: optionalInteger("Table absolute x coordinates must be integers."),
        layoutY: optionalInteger("Table absolute y coordinates must be integers.")
    }, (config: UiTableEditorConfig): UiTableNodeDefinition => ({
        type: "ui-table",
        id: config.id ?? "",
        mount: config.mount ?? "",
        columns: config.columns ?? [],
        rows: tableRowsFromConfig(config),
        selectAction: config.selectAction,
        ...collectLayoutChildConfig(config)
    })),
    "ui-container": createDefinition("ui-container", "view", {
        id: requiredString("Container IDs are required before deploy."),
        mount: requiredString("Containers must declare a mount target."),
        layoutId: requiredStringEnum([...standardLayoutPresetIds], "Containers must reference a child layout.", "Containers must reference a known child layout."),
        order: optionalInteger("Container order must be an integer."),
        row: optionalInteger("Container grid rows must be integers."),
        col: optionalInteger("Container grid columns must be integers."),
        colSize: optionalInteger("Container grid column spans must be integers."),
        rowSize: optionalInteger("Container grid row spans must be integers."),
        layoutX: optionalInteger("Container absolute x coordinates must be integers."),
        layoutY: optionalInteger("Container absolute y coordinates must be integers.")
    }, (config: UiContainerEditorConfig): UiContainerNodeDefinition => ({
        type: "ui-container",
        id: config.id ?? "",
        mount: config.mount ?? "",
        layout: config.layoutId ?? "vertical",
        variant: config.variant,
        ...collectLayoutChildConfig(config)
    })),
    // P163 (ADR 0017): minimal ui-repeat registration. Full editor UX is P165.
    "ui-repeat": createDefinition("ui-repeat", "view", {
        id: requiredString("Repeat IDs are required before deploy."),
        mount: requiredString("Repeats must declare a mount target."),
        order: optionalInteger("Repeat order must be an integer."),
        row: optionalInteger("Repeat grid rows must be integers."),
        col: optionalInteger("Repeat grid columns must be integers."),
        colSize: optionalInteger("Repeat grid column spans must be integers."),
        rowSize: optionalInteger("Repeat grid row spans must be integers."),
        layoutX: optionalInteger("Repeat absolute x coordinates must be integers."),
        layoutY: optionalInteger("Repeat absolute y coordinates must be integers.")
    }, (config: UiRepeatEditorConfig): UiRepeatNodeDefinition => ({
        type: "ui-repeat",
        id: config.id ?? "",
        mount: config.mount ?? "",
        items: repeatItemsFromConfig(config),
        ...(config.keyField ? { keyField: config.keyField } : {}),
        ...collectLayoutChildConfig(config)
    })),
    "ui-input": createDefinition("ui-input", "view", {
        id: requiredString("Input IDs are required before deploy."),
        mount: requiredString("Inputs must declare a mount target."),
        label: requiredString("Inputs must declare a label."),
        valuePath: requiredString("Inputs must bind a value path."),
        order: optionalInteger("Input order must be an integer."),
        row: optionalInteger("Input grid rows must be integers."),
        col: optionalInteger("Input grid columns must be integers."),
        colSize: optionalInteger("Input grid column spans must be integers."),
        rowSize: optionalInteger("Input grid row spans must be integers."),
        layoutX: optionalInteger("Input absolute x coordinates must be integers."),
        layoutY: optionalInteger("Input absolute y coordinates must be integers."),
        inputType: optionalStringEnum(["text", "email", "number"], "Input types must be text, email, or number."),
        storeId: {
            validate(value, config) {
                if (value === undefined && config.path === undefined) {
                    return undefined;
                }

                return typeof value === "string" && value.trim().length > 0 ? undefined : "Inputs that write to a store must declare a store ID.";
            }
        },
        path: {
            validate(value, config) {
                if (value === undefined && config.storeId === undefined) {
                    return undefined;
                }

                return typeof value === "string" && value.trim().length > 0 ? undefined : "Inputs that write to a store must declare a relative path.";
            }
        }
    }, (config: UiInputEditorConfig): UiInputNodeDefinition => ({
        type: "ui-input",
        id: config.id ?? "",
        mount: config.mount ?? "",
        // P145: label is a binding (literal string or dynamic binding).
        label: bindingOrString(config.label) ?? "",
        value: stateBinding(config.valuePath ?? ""),
        storeId: config.storeId,
        path: config.path,
        inputType: config.inputType ?? "text",
        placeholder: config.placeholder,
        variant: config.variant,
        ...collectLayoutChildConfig(config)
    })),
    "ui-select": createDefinition("ui-select", "view", {
        id: requiredString("Select IDs are required before deploy."),
        mount: requiredString("Select nodes must declare a mount target."),
        label: requiredString("Select nodes must declare a label."),
        valuePath: requiredString("Select nodes must bind a value path."),
        order: optionalInteger("Select order must be an integer."),
        row: optionalInteger("Select grid rows must be integers."),
        col: optionalInteger("Select grid columns must be integers."),
        colSize: optionalInteger("Select grid column spans must be integers."),
        rowSize: optionalInteger("Select grid row spans must be integers."),
        layoutX: optionalInteger("Select absolute x coordinates must be integers."),
        layoutY: optionalInteger("Select absolute y coordinates must be integers.")
    }, (config: UiSelectEditorConfig): UiSelectNodeDefinition => ({
        type: "ui-select",
        id: config.id ?? "",
        mount: config.mount ?? "",
        // P133: label is a binding (literal string or dynamic binding).
        label: bindingOrString(config.label) ?? "",
        value: stateBinding(config.valuePath ?? ""),
        // P133: single Options field — json (array) | store, with legacy migration.
        options: selectOptionsFromConfig(config, undefined),
        // P133: placeholder is a binding (literal string or dynamic binding).
        placeholder: bindingOrString(config.placeholder),
        multiple: config.multiple,
        // P133: `searchable` removed.
        ...collectLayoutChildConfig(config)
    })),
    "ui-checkbox": createDefinition("ui-checkbox", "view", {
        id: requiredString("Checkbox IDs are required before deploy."),
        mount: requiredString("Checkboxes must declare a mount target."),
        label: requiredString("Checkboxes must declare a label."),
        valuePath: requiredString("Checkboxes must bind a value path."),
        order: optionalInteger("Checkbox order must be an integer."),
        row: optionalInteger("Checkbox grid rows must be integers."),
        col: optionalInteger("Checkbox grid columns must be integers."),
        colSize: optionalInteger("Checkbox grid column spans must be integers."),
        rowSize: optionalInteger("Checkbox grid row spans must be integers."),
        layoutX: optionalInteger("Checkbox absolute x coordinates must be integers."),
        layoutY: optionalInteger("Checkbox absolute y coordinates must be integers.")
    }, (config: UiCheckboxEditorConfig): UiCheckboxNodeDefinition => ({
        type: "ui-checkbox",
        id: config.id ?? "",
        mount: config.mount ?? "",
        label: config.label ?? "",
        value: stateBinding(config.valuePath ?? ""),
        ...collectLayoutChildConfig(config)
    })),
    "ui-radio": createDefinition("ui-radio", "view", {
        id: requiredString("Radio IDs are required before deploy."),
        mount: requiredString("Radio nodes must declare a mount target."),
        label: requiredString("Radio nodes must declare a label."),
        valuePath: requiredString("Radio nodes must bind a value path."),
        order: optionalInteger("Radio order must be an integer."),
        row: optionalInteger("Radio grid rows must be integers."),
        col: optionalInteger("Radio grid columns must be integers."),
        colSize: optionalInteger("Radio grid column spans must be integers."),
        rowSize: optionalInteger("Radio grid row spans must be integers."),
        layoutX: optionalInteger("Radio absolute x coordinates must be integers."),
        layoutY: optionalInteger("Radio absolute y coordinates must be integers."),
        orientation: optionalStringEnum(["horizontal", "vertical"], "Radio orientation must be horizontal or vertical.")
    }, (config: UiRadioEditorConfig): UiRadioNodeDefinition => ({
        type: "ui-radio",
        id: config.id ?? "",
        mount: config.mount ?? "",
        // P136: label is a binding (literal string or dynamic binding).
        label: bindingOrString(config.label) ?? "",
        value: stateBinding(config.valuePath ?? ""),
        // P136: single Options field — json (array) | store, via the SAME shared
        // resolver as ui-select, with legacy optionsJson/optionsBinding migration.
        options: selectOptionsFromConfig(config, undefined),
        orientation: config.orientation,
        ...collectLayoutChildConfig(config)
    })),
    "ui-switch": createDefinition("ui-switch", "view", {
        id: requiredString("Switch IDs are required before deploy."),
        mount: requiredString("Switches must declare a mount target."),
        valuePath: requiredString("Switches must bind a value path."),
        order: optionalInteger("Switch order must be an integer."),
        row: optionalInteger("Switch grid rows must be integers."),
        col: optionalInteger("Switch grid columns must be integers."),
        colSize: optionalInteger("Switch grid column spans must be integers."),
        rowSize: optionalInteger("Switch grid row spans must be integers."),
        layoutX: optionalInteger("Switch absolute x coordinates must be integers."),
        layoutY: optionalInteger("Switch absolute y coordinates must be integers.")
    }, (config: UiSwitchEditorConfig): UiSwitchNodeDefinition => ({
        type: "ui-switch",
        id: config.id ?? "",
        mount: config.mount ?? "",
        value: stateBinding(config.valuePath ?? ""),
        // P147 (ADR 0012): all three label fields accept a binding object or a
        // plain string (legacy). bindingOrString passes either through unchanged.
        label: bindingOrString(config.label),
        labelOn: bindingOrString(config.labelOn),
        labelOff: bindingOrString(config.labelOff),
        ...collectLayoutChildConfig(config)
    })),
    "ui-textarea": createDefinition("ui-textarea", "view", {
        id: requiredString("Textarea IDs are required before deploy."),
        mount: requiredString("Textareas must declare a mount target."),
        label: requiredString("Textareas must declare a label."),
        valuePath: requiredString("Textareas must bind a value path."),
        order: optionalInteger("Textarea order must be an integer."),
        row: optionalInteger("Textarea grid rows must be integers."),
        col: optionalInteger("Textarea grid columns must be integers."),
        colSize: optionalInteger("Textarea grid column spans must be integers."),
        rowSize: optionalInteger("Textarea grid row spans must be integers."),
        layoutX: optionalInteger("Textarea absolute x coordinates must be integers."),
        layoutY: optionalInteger("Textarea absolute y coordinates must be integers."),
        rows: optionalInteger("Textarea rows must be a positive integer."),
        maxLength: optionalInteger("Textarea max length must be a positive integer.")
    }, (config: UiTextareaEditorConfig): UiTextareaNodeDefinition => ({
        type: "ui-textarea",
        id: config.id ?? "",
        mount: config.mount ?? "",
        // P148: label is a binding (literal string or dynamic binding).
        label: bindingOrString(config.label) ?? "",
        value: stateBinding(config.valuePath ?? ""),
        // P148: placeholder is a binding (literal string or dynamic binding).
        placeholder: bindingOrString(config.placeholder),
        rows: config.rows,
        maxLength: config.maxLength,
        ...collectLayoutChildConfig(config)
    })),
    "ui-datepicker": createDefinition("ui-datepicker", "view", {
        id: requiredString("Datepicker IDs are required before deploy."),
        mount: requiredString("Datepickers must declare a mount target."),
        label: requiredString("Datepickers must declare a label."),
        valuePath: requiredString("Datepickers must bind a value path."),
        order: optionalInteger("Datepicker order must be an integer."),
        row: optionalInteger("Datepicker grid rows must be integers."),
        col: optionalInteger("Datepicker grid columns must be integers."),
        colSize: optionalInteger("Datepicker grid column spans must be integers."),
        rowSize: optionalInteger("Datepicker grid row spans must be integers."),
        layoutX: optionalInteger("Datepicker absolute x coordinates must be integers."),
        layoutY: optionalInteger("Datepicker absolute y coordinates must be integers."),
        mode: optionalStringEnum(["date", "datetime", "time"], "Datepicker mode must be date, datetime, or time.")
    }, (config: UiDatepickerEditorConfig): UiDatepickerNodeDefinition => ({
        type: "ui-datepicker",
        id: config.id ?? "",
        mount: config.mount ?? "",
        label: config.label ?? "",
        value: stateBinding(config.valuePath ?? ""),
        mode: config.mode,
        min: config.min,
        max: config.max,
        // P149: placeholder is a binding (literal string or dynamic binding).
        placeholder: bindingOrString(config.placeholder),
        ...collectLayoutChildConfig(config)
    })),
    "ui-slider": createDefinition("ui-slider", "view", {
        id: requiredString("Slider IDs are required before deploy."),
        mount: requiredString("Sliders must declare a mount target."),
        valuePath: requiredString("Sliders must bind a value path."),
        order: optionalInteger("Slider order must be an integer."),
        row: optionalInteger("Slider grid rows must be integers."),
        col: optionalInteger("Slider grid columns must be integers."),
        colSize: optionalInteger("Slider grid column spans must be integers."),
        rowSize: optionalInteger("Slider grid row spans must be integers."),
        layoutX: optionalInteger("Slider absolute x coordinates must be integers."),
        layoutY: optionalInteger("Slider absolute y coordinates must be integers.")
    }, (config: UiSliderEditorConfig): UiSliderNodeDefinition => ({
        type: "ui-slider",
        id: config.id ?? "",
        mount: config.mount ?? "",
        value: stateBinding(config.valuePath ?? ""),
        // P146: label is a binding (literal string or dynamic binding).
        label: bindingOrString(config.label),
        min: config.min,
        max: config.max,
        step: config.step,
        showValue: config.showValue,
        ...collectLayoutChildConfig(config)
    })),
    "ui-store": createDefinition("ui-store", "state", {
        id: requiredString("Store IDs are required before deploy."),
        statePath: requiredString("Stores must declare a state path.")
    }, (config: UiStoreEditorConfig): UiStoreNodeDefinition => ({
        type: "ui-store",
        id: config.id ?? "",
        statePath: config.statePath ?? "",
        initialValue: config.initialValue
    })),
    "ui-query": createDefinition("ui-query", "state", {
        id: requiredString("Query IDs are required before deploy."),
        queryPath: requiredString("Queries must declare a query path.")
    }, (config: UiQueryEditorConfig): UiQueryNodeDefinition => ({
        type: "ui-query",
        id: config.id ?? "",
        queryPath: config.queryPath ?? "",
        refreshAction: config.refreshAction
    })),
    "ui-action": createDefinition("ui-action", "behavior", {
        id: requiredString("Action IDs are required before deploy."),
        actionType: optionalStringEnum(["navigate", "disable", "enable", "show", "hide", "trigger"], "Actions must use a known action type."),
        // P118 (ADR 0011 §1): `targetMode` is the navigate target SOURCE
        // (wire | route | url) — navigate-only and optional (legacy configs are
        // migrated to a mode on emit). The old out-port/path enum and the
        // "typed actions must declare a target mode" rule are dropped.
        targetMode: {
            validate(value) {
                if (value === undefined || value === "") {
                    return undefined;
                }
                return ["wire", "route", "url"].includes(value as string)
                    ? undefined
                    : "Navigate target mode must be one of wire, route, url.";
            }
        },
        // `target` is the deprecated wireless addressing field — accepted as-is.
        target: {
            validate() {
                return undefined;
            }
        },
        // P118: `routeId` is the referenced ui-route id (route mode). The picker
        // (P119) supplies it; per-node validation only checks it is a string.
        routeId: {
            validate(value) {
                if (value === undefined || value === "") {
                    return undefined;
                }
                return typeof value === "string" ? undefined : "Route reference must be a string id.";
            }
        },
        // P66 (ADR 0007): a navigate action no longer REQUIRES `to`. When the
        // action is wired (or picked) to a ui-route, the route supplies the path
        // from its own definition (Scenario 1) and `to` is empty. The wire is
        // invisible to this per-node validator, so the "no target at all" /
        // "ambiguous (wired AND `to`)" / "dead static link" cross-checks are
        // RUNTIME checks (full flow graph). Here we only validate per-node shape:
        // a known `toType`, and a `params` value that parses as a JSON object.
        toType: {
            validate(value) {
                if (value === undefined || value === "") {
                    return undefined;
                }
                return ["str", "msg", "flow", "global", "jsonata"].includes(value as string)
                    ? undefined
                    : "Navigate `to` must use a known typedInput type.";
            }
        },
        params: {
            // P118 (ADR 0011 §1): accept the new typed-list form
            // `[{name,value,valueType}]` OR the legacy `{k: "v"}` object (migrated
            // on emit). Per-node validation only checks it parses to one of those.
            validate(value) {
                if (value === undefined || value === "" || typeof value !== "string") {
                    return undefined;
                }
                let parsed: unknown;
                try {
                    parsed = JSON.parse(value);
                }
                catch {
                    return "Navigate params must be a JSON array of typed entries or a JSON object.";
                }
                if (Array.isArray(parsed)) {
                    const ok = parsed.every((entry) => entry
                        && typeof entry === "object"
                        && typeof (entry as Record<string, unknown>).name === "string"
                        && (entry as Record<string, unknown>).name !== "");
                    return ok ? undefined : "Navigate param rows need a non-empty `name`.";
                }
                if (typeof parsed !== "object" || parsed === null) {
                    return "Navigate params must be a JSON array of typed entries or a JSON object.";
                }
                return Object.values(parsed as Record<string, unknown>).every((v) => typeof v === "string")
                    ? undefined
                    : "Navigate param values must be strings (they fill URL segments).";
            }
        }
    }, (config: UiActionEditorConfig): UiActionNodeDefinition => {
        // P118 (ADR 0011 §1 + Migration): derive the navigate target mode and keep
        // only the fields it owns, so the emitted definition is mode-exclusive
        // (and never trips the schema's double-config refinement).
        const isNavigate = config.actionType === "navigate";
        const targetMode: UiActionNodeDefinition["targetMode"] = isNavigate
            ? (config.targetMode
                ?? (config.routeId ? "route" : (config.to ? "url" : "wire")))
            : undefined;
        return {
            type: "ui-action",
            id: config.id ?? "",
            actionType: config.actionType,
            targetMode,
            routeId: targetMode === "route" ? (config.routeId || undefined) : undefined,
            target: config.target,
            to: targetMode === "url" ? (config.to || undefined) : undefined,
            toType: targetMode === "url" ? config.toType : undefined,
            params: targetMode === "url" ? undefined : migrateActionParamList(config.params),
            description: config.description
        };
    }),
    "ui-navigation": createDefinition("ui-navigation", "behavior", {
        id: requiredString("Navigation IDs are required before deploy."),
        to: requiredString("Navigation nodes must declare a destination path.")
    }, (config: UiNavigationEditorConfig): UiNavigationNodeDefinition => ({
        type: "ui-navigation",
        id: config.id ?? "",
        to: config.to ?? ""
    })),
    "ui-alert": createDefinition("ui-alert", "view", {
        id: requiredString("Alert IDs are required before deploy."),
        mount: requiredString("Alerts must declare a parent slot."),
        // P67: a binding object satisfies the requirement; otherwise messagePath
        // (back-compat) must be a non-empty string.
        message: {
            validate(value, config) {
                if (value && typeof value === "object") {
                    return undefined;
                }

                const messagePath = config.messagePath;

                return typeof messagePath === "string" && messagePath.trim().length > 0
                    ? undefined
                    : "Alerts must declare a message.";
            }
        }
    }, (config: UiAlertEditorConfig): UiAlertNodeDefinition => ({
        type: "ui-alert",
        id: config.id ?? "",
        mount: config.mount ?? "",
        message: config.message ?? stateBinding(config.messagePath ?? ""),
        severity: config.severity,
        // P67: a plain-string title is wrapped as a literal binding.
        title: typeof config.title === "string"
            ? (config.title.length > 0 ? literalBinding(config.title) : undefined)
            : config.title,
        dismissible: config.dismissible,
        ...collectLayoutChildConfig(config)
    })),
    "ui-toast": createDefinition("ui-toast", "view", {
        id: requiredString("Toast IDs are required before deploy.")
    }, (config: UiToastEditorConfig): UiToastNodeDefinition => ({
        type: "ui-toast",
        id: config.id ?? "",
        parent: config.parent,
        severity: config.severity,
        duration: config.duration,
        position: config.position
    })),
    "ui-progress": createDefinition("ui-progress", "view", {
        id: requiredString("Progress IDs are required before deploy."),
        mount: requiredString("Progress nodes must declare a parent slot.")
    }, (config: UiProgressEditorConfig): UiProgressNodeDefinition => ({
        type: "ui-progress",
        id: config.id ?? "",
        mount: config.mount ?? "",
        displayType: config.displayType,
        // P137 (ADR 0012): prefer the stored binding object; migrate legacy valuePath.
        value: isBindingObject(config.value) ? config.value
            : (config.valuePath ? stateBinding(config.valuePath) : undefined),
        // P137 (ADR 0012): label is now a binding (literal string or dynamic binding).
        label: bindingOrString(config.label),
        showValue: config.showValue,
        ...collectLayoutChildConfig(config)
    })),
    "ui-skeleton": createDefinition("ui-skeleton", "view", {
        id: requiredString("Skeleton IDs are required before deploy."),
        mount: requiredString("Skeletons must declare a parent slot.")
        // P138 (ADR 0012): `visible` is now optional — absent ⇒ always visible.
        // No required validator: the typedInput may be left empty (= no binding).
    }, (config: UiSkeletonEditorConfig): UiSkeletonNodeDefinition => ({
        type: "ui-skeleton",
        id: config.id ?? "",
        mount: config.mount ?? "",
        // P138 (ADR 0012): prefer the stored binding object; fall back to the
        // legacy `visiblePath` plain state path; absent = no binding (always visible).
        visible: isBindingObject(config.visible)
            ? config.visible
            : (config.visiblePath ? stateBinding(config.visiblePath) : undefined),
        displayType: config.displayType,
        lines: config.lines,
        ...collectLayoutChildConfig(config)
    })),
    "ui-badge": createDefinition("ui-badge", "view", {
        id: requiredString("Badge IDs are required before deploy."),
        mount: requiredString("Badges must declare a parent slot.")
        // P153 (ADR 0012): value is now a typedInput binding object — no requiredString
        // validator. The typedInput may store any binding kind (literal/state/store/…).
        // Migration: legacy `valuePath` is converted to a state binding by the mapper.
    }, (config: UiBadgeEditorConfig): UiBadgeNodeDefinition => ({
        type: "ui-badge",
        id: config.id ?? "",
        mount: config.mount ?? "",
        // P153 (ADR 0012): prefer the stored binding object; migrate legacy valuePath.
        value: isBindingObject(config.value) ? config.value
            : (config.valuePath ? stateBinding(config.valuePath) : stateBinding("")),
        // P92: displayType now shape (square/rounded/pill); variant replaces severity.
        // P103: size field removed.
        displayType: config.displayType,
        variant: config.variant ?? (config.severity as UiBadgeNodeDefinition["variant"] | undefined),
        pulsating: config.pulsating,
        // P92: max field removed.
        ...collectLayoutChildConfig(config)
    })),
    "ui-empty-state": createDefinition("ui-empty-state", "view", {
        id: requiredString("Empty state IDs are required before deploy."),
        mount: requiredString("Empty states must declare a parent slot."),
        visiblePath: requiredString("Empty states must declare a visible path.")
    }, (config: UiEmptyStateEditorConfig): UiEmptyStateNodeDefinition => ({
        type: "ui-empty-state",
        id: config.id ?? "",
        mount: config.mount ?? "",
        visible: stateBinding(config.visiblePath ?? ""),
        icon: config.icon,
        title: config.title,
        message: config.message,
        action: config.action,
        actionLabel: config.actionLabel,
        ...collectLayoutChildConfig(config)
    })),
    // P167 (ADR 0018, Model 1a): the `tabs` JSON field is REMOVED. Tabs are
    // derived from mounted `ui-tab` children; the full ui-tabs/ui-tab editor UX
    // (no tabs field, derived-slot picker, validation) lands in P168. This entry
    // keeps the editor mapping type-checking against the reworked schema.
    "ui-tabs": createDefinition("ui-tabs", "view", {
        id: requiredString("Tabs IDs are required before deploy."),
        mount: requiredString("Tabs must declare a parent slot.")
    }, (config: UiTabsEditorConfig): UiTabsNodeDefinition => ({
        type: "ui-tabs",
        id: config.id ?? "",
        mount: config.mount ?? "",
        // P155 (ADR 0012): prefer the canonical `activeTab` binding object; migrate
        // a legacy `activeTabPath` plain state path to a state binding. P167: the
        // value is now the active CHILD ID.
        activeTab: isBindingObject(config.activeTab)
            ? config.activeTab
            : (config.activeTabPath ? stateBinding(config.activeTabPath) : undefined),
        ...collectLayoutChildConfig(config)
    })),
    // P167 (ADR 0018): minimal `ui-tab` registration — a container child of
    // ui-tabs with label/icon/order. Full editor UX is P168.
    "ui-tab": createDefinition("ui-tab", "view", {
        id: requiredString("Tab IDs are required before deploy."),
        mount: requiredString("Tabs must declare a parent ui-tabs slot."),
        order: optionalInteger("Tab order must be an integer.")
    }, (config: UiTabEditorConfig): UiTabNodeDefinition => ({
        type: "ui-tab",
        id: config.id ?? "",
        mount: config.mount ?? "",
        label: isBindingObject(config.label)
            ? config.label
            : literalBinding(config.labelPath ?? ""),
        ...(config.icon ? { icon: config.icon } : {}),
        ...collectLayoutChildConfig(config)
    })),
    // P169 (ADR 0018, Model 1a): the `sections` JSON field is REMOVED. Sections are
    // derived from mounted `ui-accordion-section` children; the open-state is the
    // canonical two-way `openSection` binding (mirror of ui-tabs `activeTab`). A
    // legacy `openSectionPath` plain state path migrates to a state binding.
    "ui-accordion": createDefinition("ui-accordion", "view", {
        id: requiredString("Accordion IDs are required before deploy."),
        mount: requiredString("Accordion must declare a parent slot.")
    }, (config: UiAccordionEditorConfig): UiAccordionNodeDefinition => ({
        type: "ui-accordion",
        id: config.id ?? "",
        mount: config.mount ?? "",
        openSection: isBindingObject(config.openSection)
            ? config.openSection
            : (config.openSectionPath ? stateBinding(config.openSectionPath) : undefined),
        multiple: config.multiple,
        ...collectLayoutChildConfig(config)
    })),
    // P169 (ADR 0018): `ui-accordion-section` registration — a container child of
    // ui-accordion with label/icon/order (mirror of ui-tab).
    "ui-accordion-section": createDefinition("ui-accordion-section", "view", {
        id: requiredString("Section IDs are required before deploy."),
        mount: requiredString("Sections must declare a parent ui-accordion slot."),
        order: optionalInteger("Section order must be an integer.")
    }, (config: UiAccordionSectionEditorConfig): UiAccordionSectionNodeDefinition => ({
        type: "ui-accordion-section",
        id: config.id ?? "",
        mount: config.mount ?? "",
        label: isBindingObject(config.label)
            ? config.label
            : literalBinding(config.labelPath ?? ""),
        ...(config.icon ? { icon: config.icon } : {}),
        ...collectLayoutChildConfig(config)
    })),
    "ui-breadcrumb": createDefinition("ui-breadcrumb", "view", {
        id: requiredString("Breadcrumb IDs are required before deploy."),
        mount: requiredString("Breadcrumb must declare a parent slot."),
        itemsPath: requiredString("Breadcrumb must declare an items state path.")
    }, (config: UiBreadcrumbEditorConfig): UiBreadcrumbNodeDefinition => ({
        type: "ui-breadcrumb",
        id: config.id ?? "",
        mount: config.mount ?? "",
        items: stateBinding(config.itemsPath ?? ""),
        ...collectLayoutChildConfig(config)
    })),
    // P157 (ADR 0012): `items` / `activeRoute` are canonical value typedInputs
    // (binding objects) — no requiredString validator (mirrors P154 pagination).
    // Legacy `itemsPath` / `activeRoutePath` plain state paths migrate to state
    // bindings. `items` is a STRUCTURAL array binding: a json-literal binding's
    // raw array is unwrapped; every dynamic kind passes through for the renderer's
    // structural resolution. A bare array (flow.json/tests) passes through.
    "ui-menu": createDefinition("ui-menu", "view", {
        id: requiredString("Menu IDs are required before deploy."),
        mount: requiredString("Menu must declare a parent slot.")
    }, (config: UiMenuEditorConfig): UiMenuNodeDefinition => ({
        type: "ui-menu",
        id: config.id ?? "",
        mount: config.mount ?? "",
        displayType: config.displayType,
        items: menuItemsFromConfig(config),
        activeItem: isBindingObject(config.activeRoute) ? config.activeRoute
            : (config.activeRoutePath ? stateBinding(config.activeRoutePath) : undefined),
        ...collectLayoutChildConfig(config)
    })),
    "ui-pagination": createDefinition("ui-pagination", "view", {
        id: requiredString("Pagination IDs are required before deploy."),
        mount: requiredString("Pagination must declare a parent slot.")
        // P154 (ADR 0012): `total` / `currentPage` are typedInput binding objects —
        // no requiredString validator. Migration: legacy `totalPath` /
        // `currentPagePath` plain state paths are converted to state bindings.
    }, (config: UiPaginationEditorConfig): UiPaginationNodeDefinition => ({
        type: "ui-pagination",
        id: config.id ?? "",
        mount: config.mount ?? "",
        // P154: `currentPage` (two-way) → schema `page`; `total` (read-only) →
        // schema `totalPages`. Prefer the stored binding object; migrate legacy paths.
        page: isBindingObject(config.currentPage) ? config.currentPage
            : (config.currentPagePath ? stateBinding(config.currentPagePath) : stateBinding("")),
        totalPages: isBindingObject(config.total) ? config.total
            : (config.totalPath ? stateBinding(config.totalPath) : stateBinding("")),
        pageSize: config.pageSize ? stateBinding(config.pageSize.toString()) : undefined,
        ...collectLayoutChildConfig(config)
    })),
    "ui-stepper": createDefinition("ui-stepper", "view", {
        id: requiredString("Stepper IDs are required before deploy."),
        mount: requiredString("Stepper must declare a parent slot."),
        steps: requiredString("Stepper must declare at least two steps.")
    }, (config: UiStepperEditorConfig): UiStepperNodeDefinition => ({
        type: "ui-stepper",
        id: config.id ?? "",
        mount: config.mount ?? "",
        steps: JSON.parse(config.steps ?? "[]"),
        // P156 (ADR 0012): prefer the canonical `activeStep` binding object; migrate
        // a legacy `activeStepPath` plain state path to a state binding (mirrors ui-tabs P155).
        activeStep: isBindingObject(config.activeStep)
            ? config.activeStep
            : (config.activeStepPath ? stateBinding(config.activeStepPath) : undefined),
        variant: config.orientation,
        ...collectLayoutChildConfig(config)
    })),
    "ui-image": createDefinition("ui-image", "view", {
        id: requiredString("Image IDs are required before deploy."),
        mount: requiredString("Image must declare a parent slot.")
    }, (config: UiImageEditorConfig): UiImageNodeDefinition => ({
        type: "ui-image",
        id: config.id ?? "",
        mount: config.mount ?? "",
        src: stateBinding(config.srcPath ?? ""),
        // P151 (ADR 0012): alt and fallbackSrc are binding-capable; plain strings
        // are accepted unchanged via bindingOrString.
        alt: bindingOrString(config.alt) || undefined,
        fallbackSrc: bindingOrString(config.fallback) || undefined,
        width: config.width || undefined,
        height: config.height || undefined,
        ...collectLayoutChildConfig(config)
    })),
    "ui-icon": createDefinition("ui-icon", "view", {
        id: requiredString("Icon IDs are required before deploy."),
        mount: requiredString("Icon must declare a parent slot."),
        icon: requiredString("Icon name is required.")
    }, (config: UiIconEditorConfig): UiIconNodeDefinition => ({
        type: "ui-icon",
        id: config.id ?? "",
        mount: config.mount ?? "",
        icon: config.icon ?? "",
        size: config.size as "xs" | "sm" | "md" | "lg" | "xl" | undefined,
        color: config.color || undefined,
        ...collectLayoutChildConfig(config)
    })),
    "ui-list": createDefinition("ui-list", "view", {
        id: requiredString("List IDs are required before deploy."),
        mount: requiredString("List must declare a parent slot.")
    }, (config: UiListEditorConfig): UiListNodeDefinition => ({
        type: "ui-list",
        id: config.id ?? "",
        mount: config.mount ?? "",
        items: listItemsFromConfig(config),
        displayType: config.displayType,
        displayValue: config.displayValue,
        badgeVariant: config.badgeVariant,
        ...collectLayoutChildConfig(config)
    })),
    "ui-avatar": createDefinition("ui-avatar", "view", {
        id: requiredString("Avatar IDs are required before deploy."),
        mount: requiredString("Avatar must declare a parent slot.")
    }, (config: UiAvatarEditorConfig): UiAvatarNodeDefinition => ({
        type: "ui-avatar",
        id: config.id ?? "",
        mount: config.mount ?? "",
        src: config.srcPath ? stateBinding(config.srcPath) : undefined,
        initials: config.initials ? { kind: "literal" as const, value: config.initials } : undefined,
        // P93: alt field removed — sl-avatar uses `label` for a11y, not `alt`.
        size: config.size as "xs" | "sm" | "md" | "lg" | "xl" | undefined,
        shape: config.shape,
        ...collectLayoutChildConfig(config)
    })),
    "ui-divider": createDefinition("ui-divider", "view", {
        id: requiredString("Divider IDs are required before deploy."),
        mount: requiredString("Divider must declare a parent slot.")
    }, (config: UiDividerEditorConfig): UiDividerNodeDefinition => ({
        type: "ui-divider",
        id: config.id ?? "",
        mount: config.mount ?? "",
        orientation: config.orientation,
        // P150 (ADR 0012): label may be a binding object or a plain string;
        // bindingOrString passes either through unchanged. Falsy → undefined.
        label: bindingOrString(config.label) || undefined,
        ...collectLayoutChildConfig(config)
    })),
    // P57: ui-log — persistent error/log display
    "ui-log": createDefinition("ui-log", "view", {
        id: requiredString("Log IDs are required before deploy."),
        mount: requiredString("Log must declare a parent slot.")
    }, (config: UiLogEditorConfig): UiLogNodeDefinition => ({
        type: "ui-log",
        id: config.id ?? "",
        mount: config.mount ?? "",
        minSeverity: config.minSeverity,
        maxEntries: config.maxEntries !== undefined ? Number(config.maxEntries) : undefined,
        collapsed: config.collapsed,
        ...collectLayoutChildConfig(config)
    }))
};

export function validateEditorNodeConfig<TConfig extends NodeEditorConfig>(type: NodeEditorType, config: TConfig): EditorValidationIssue[] {
    return nodeSet[type].validate(config as never);
}

export function emitNodeDefinition<TConfig extends NodeEditorConfig>(
    type: NodeEditorType,
    config: TConfig
): { success: true; data: UiNodeDefinition } | { success: false; error: string; issues: EditorValidationIssue[] } {
    return nodeSet[type].emit(config as never);
}
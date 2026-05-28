import {
    validateUiNodeDefinition,
    type BindingDefinition,
    type UiActionNodeDefinition,
    type UiAppNodeDefinition,
    type UiButtonNodeDefinition,
    type UiContainerNodeDefinition,
    type UiDialogNodeDefinition,
    type UiInputNodeDefinition,
    type UiLayoutNodeDefinition,
    type UiNavigationNodeDefinition,
    type UiNodeDefinition,
    type UiQueryNodeDefinition,
    type UiRouteNodeDefinition,
    type UiSlotNodeDefinition,
    type UiStoreNodeDefinition,
    type UiTableNodeDefinition,
    type UiTextNodeDefinition
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
    layout?: string;
}

export type UiAppEditorNodeDefinition = BaseEditorNodeDefinition<UiAppEditorConfig, UiAppNodeDefinition>;

export interface IdentifiedEditorConfig {
    id?: string;
}

export interface UiLayoutEditorConfig extends IdentifiedEditorConfig {
    title?: string;
}

export interface UiSlotEditorConfig extends IdentifiedEditorConfig {
    layoutId?: string;
    name?: string;
    title?: string;
    order?: number;
}

export interface UiContainerEditorConfig extends MountableEditorConfig {
    layoutId?: string;
    title?: string;
}

export interface UiRouteEditorConfig extends IdentifiedEditorConfig {
    path?: string;
    title?: string;
    layoutId?: string;
}

export interface UiDialogEditorConfig extends IdentifiedEditorConfig {
    title?: string;
    layoutId?: string;
    routeId?: string;
    modal?: boolean;
}

interface MountableEditorConfig extends IdentifiedEditorConfig {
    mount?: string;
    order?: number;
}

export interface UiTextEditorConfig extends MountableEditorConfig {
    text?: string;
    value?: BindingDefinition;
    variant?: string;
}

export interface UiButtonEditorConfig extends MountableEditorConfig {
    label?: string;
    action?: string;
    disabledPath?: string;
}

export interface UiTableEditorConfig extends MountableEditorConfig {
    columns?: string[];
    rowsPath?: string;
    selectAction?: string;
}

export interface UiInputEditorConfig extends MountableEditorConfig {
    label?: string;
    valuePath?: string;
    storeId?: string;
    path?: string;
    inputType?: "text" | "email" | "number";
    placeholder?: string;
}

export interface UiStoreEditorConfig extends IdentifiedEditorConfig {
    statePath?: string;
    initialValue?: unknown;
}

export interface UiQueryEditorConfig extends IdentifiedEditorConfig {
    queryPath?: string;
    source?: string;
    refreshAction?: string;
}

export interface UiActionEditorConfig extends IdentifiedEditorConfig {
    actionType?: "navigate" | "disable" | "enable" | "show" | "hide" | "trigger";
    targetMode?: "out-port" | "path";
    target?: string;
    to?: string;
    description?: string;
}

export interface UiNavigationEditorConfig extends IdentifiedEditorConfig {
    to?: string;
}

export type NodeEditorConfig =
    | UiAppEditorConfig
    | UiLayoutEditorConfig
    | UiSlotEditorConfig
    | UiRouteEditorConfig
    | UiDialogEditorConfig
    | UiTextEditorConfig
    | UiButtonEditorConfig
    | UiTableEditorConfig
    | UiContainerEditorConfig
    | UiInputEditorConfig
    | UiStoreEditorConfig
    | UiQueryEditorConfig
    | UiActionEditorConfig
    | UiNavigationEditorConfig;

export type NodeEditorDefinition =
    | UiAppEditorNodeDefinition
    | BaseEditorNodeDefinition<UiLayoutEditorConfig, UiLayoutNodeDefinition>
    | BaseEditorNodeDefinition<UiSlotEditorConfig, UiSlotNodeDefinition>
    | BaseEditorNodeDefinition<UiRouteEditorConfig, UiRouteNodeDefinition>
    | BaseEditorNodeDefinition<UiDialogEditorConfig, UiDialogNodeDefinition>
    | BaseEditorNodeDefinition<UiTextEditorConfig, UiTextNodeDefinition>
    | BaseEditorNodeDefinition<UiButtonEditorConfig, UiButtonNodeDefinition>
    | BaseEditorNodeDefinition<UiTableEditorConfig, UiTableNodeDefinition>
    | BaseEditorNodeDefinition<UiContainerEditorConfig, UiContainerNodeDefinition>
    | BaseEditorNodeDefinition<UiInputEditorConfig, UiInputNodeDefinition>
    | BaseEditorNodeDefinition<UiStoreEditorConfig, UiStoreNodeDefinition>
    | BaseEditorNodeDefinition<UiQueryEditorConfig, UiQueryNodeDefinition>
    | BaseEditorNodeDefinition<UiActionEditorConfig, UiActionNodeDefinition>
    | BaseEditorNodeDefinition<UiNavigationEditorConfig, UiNavigationNodeDefinition>;

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

function queryBinding(path: string): BindingDefinition {
    return {
        kind: "query",
        path
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
        layout: requiredString("Apps must declare a base layout.")
    }, (config: UiAppEditorConfig) => ({
        type: "ui-app",
        id: config.root ?? "",
        title: config.name ?? config.root ?? "",
        layout: config.layout ?? "vertical"
    })),
    "ui-layout": createDefinition("ui-layout", "structure", {
        id: requiredString("Layout IDs are required before deploy.")
    }, (config: UiLayoutEditorConfig) => ({
        type: "ui-layout",
        id: config.id ?? "",
        title: config.title
    })),
    "ui-slot": createDefinition("ui-slot", "structure", {
        id: requiredString("Slot node IDs are required before deploy."),
        layoutId: requiredString("Slots must reference a layout."),
        name: requiredString("Slots must declare a slot name."),
        order: optionalInteger("Slot order must be an integer.")
    }, (config: UiSlotEditorConfig) => ({
        type: "ui-slot",
        id: config.id ?? "",
        layoutId: config.layoutId ?? "",
        name: config.name ?? "",
        title: config.title,
        order: config.order ?? 0
    })),
    "ui-route": createDefinition("ui-route", "structure", {
        id: requiredString("Route IDs are required before deploy."),
        path: requiredString("Routes must declare a path."),
        layoutId: requiredString("Routes must reference a layout.")
    }, (config: UiRouteEditorConfig) => ({
        type: "ui-route",
        id: config.id ?? "",
        path: config.path ?? "",
        title: config.title,
        layoutId: config.layoutId ?? ""
    })),
    "ui-dialog": createDefinition("ui-dialog", "structure", {
        id: requiredString("Dialog IDs are required before deploy."),
        layoutId: requiredString("Dialogs must reference a layout.")
    }, (config: UiDialogEditorConfig) => ({
        type: "ui-dialog",
        id: config.id ?? "",
        title: config.title,
        layoutId: config.layoutId ?? "",
        routeId: config.routeId,
        modal: config.modal ?? true
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
        order: optionalInteger("Text order must be an integer.")
    }, (config: UiTextEditorConfig) => ({
        type: "ui-text",
        id: config.id ?? "",
        mount: config.mount ?? "",
        order: config.order,
        value: config.value ?? literalBinding(config.text ?? ""),
        variant: config.variant
    })),
    "ui-button": createDefinition("ui-button", "view", {
        id: requiredString("Button IDs are required before deploy."),
        mount: requiredString("Buttons must declare a mount target."),
        label: requiredString("Buttons must declare a label."),
        action: requiredString("Buttons must reference an action."),
        order: optionalInteger("Button order must be an integer.")
    }, (config: UiButtonEditorConfig) => ({
        type: "ui-button",
        id: config.id ?? "",
        mount: config.mount ?? "",
        order: config.order,
        label: config.label ?? "",
        action: config.action ?? "",
        disabled: config.disabledPath ? stateBinding(config.disabledPath) : undefined
    })),
    "ui-table": createDefinition("ui-table", "view", {
        id: requiredString("Table IDs are required before deploy."),
        mount: requiredString("Tables must declare a mount target."),
        columns: requiredStringArray("Tables must declare at least one column."),
        rowsPath: requiredString("Tables must bind to a query path."),
        order: optionalInteger("Table order must be an integer.")
    }, (config: UiTableEditorConfig) => ({
        type: "ui-table",
        id: config.id ?? "",
        mount: config.mount ?? "",
        order: config.order,
        columns: config.columns ?? [],
        rows: queryBinding(config.rowsPath ?? ""),
        selectAction: config.selectAction
    })),
    "ui-container": createDefinition("ui-container", "view", {
        id: requiredString("Container IDs are required before deploy."),
        mount: requiredString("Containers must declare a mount target."),
        layoutId: requiredString("Containers must reference a child layout."),
        order: optionalInteger("Container order must be an integer.")
    }, (config: UiContainerEditorConfig) => ({
        type: "ui-container",
        id: config.id ?? "",
        mount: config.mount ?? "",
        order: config.order,
        layoutId: config.layoutId ?? "",
        title: config.title
    })),
    "ui-input": createDefinition("ui-input", "view", {
        id: requiredString("Input IDs are required before deploy."),
        mount: requiredString("Inputs must declare a mount target."),
        label: requiredString("Inputs must declare a label."),
        valuePath: requiredString("Inputs must bind to a state path."),
        order: optionalInteger("Input order must be an integer."),
        inputType: optionalStringEnum(["text", "email", "number"], "Input type must be text, email, or number."),
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
    }, (config: UiInputEditorConfig) => ({
        type: "ui-input",
        id: config.id ?? "",
        mount: config.mount ?? "",
        order: config.order,
        label: config.label ?? "",
        value: stateBinding(config.valuePath ?? ""),
        storeId: config.storeId,
        path: config.path,
        inputType: config.inputType ?? "text",
        placeholder: config.placeholder
    })),
    "ui-store": createDefinition("ui-store", "state", {
        id: requiredString("Store IDs are required before deploy."),
        statePath: requiredString("Stores must declare a state path.")
    }, (config: UiStoreEditorConfig) => ({
        type: "ui-store",
        id: config.id ?? "",
        statePath: config.statePath ?? "",
        initialValue: config.initialValue
    })),
    "ui-query": createDefinition("ui-query", "state", {
        id: requiredString("Query IDs are required before deploy."),
        queryPath: requiredString("Queries must declare a query path.")
    }, (config: UiQueryEditorConfig) => ({
        type: "ui-query",
        id: config.id ?? "",
        queryPath: config.queryPath ?? "",
        source: config.source,
        refreshAction: config.refreshAction
    })),
    "ui-action": createDefinition("ui-action", "behavior", {
        id: requiredString("Action IDs are required before deploy."),
        actionType: optionalStringEnum(["navigate", "disable", "enable", "show", "hide", "trigger"], "Actions must use a known action type."),
        targetMode: {
            validate(value, config) {
                if (value === undefined) {
                    return typeof config.actionType === "string" ? "Typed actions must declare a target mode." : undefined;
                }

                if (typeof value !== "string" || !["out-port", "path"].includes(value)) {
                    return "Actions must use a known target mode.";
                }

                return typeof config.actionType === "string" ? undefined : "Target modes require an action type.";
            }
        },
        target: {
            validate(value, config) {
                if (config.targetMode === "path") {
                    return typeof value === "string" && value.trim().length > 0
                        ? undefined
                        : "Path-targeted actions must declare a target.";
                }

                if (config.targetMode === "out-port") {
                    return value === undefined || value === ""
                        ? undefined
                        : "Out-port actions must not declare a direct target.";
                }

                return undefined;
            }
        },
        to: {
            validate(value, config) {
                if (config.actionType === "navigate") {
                    return typeof value === "string" && value.trim().length > 0
                        ? undefined
                        : "Navigate actions must declare a destination.";
                }

                return undefined;
            }
        }
    }, (config: UiActionEditorConfig) => ({
        type: "ui-action",
        id: config.id ?? "",
        actionType: config.actionType,
        targetMode: config.targetMode,
        target: config.target,
        to: config.to,
        description: config.description
    })),
    "ui-navigation": createDefinition("ui-navigation", "behavior", {
        id: requiredString("Navigation IDs are required before deploy."),
        to: requiredString("Navigation nodes must declare a destination path.")
    }, (config: UiNavigationEditorConfig) => ({
        type: "ui-navigation",
        id: config.id ?? "",
        to: config.to ?? ""
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
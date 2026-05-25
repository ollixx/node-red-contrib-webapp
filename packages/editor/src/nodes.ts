import {
    validateUiNodeDefinition,
    type BindingDefinition,
    type UiActionNodeDefinition,
    type UiAppNodeDefinition,
    type UiButtonNodeDefinition,
    type UiDialogNodeDefinition,
    type UiFormNodeDefinition,
    type UiLayoutNodeDefinition,
    type UiNavigationNodeDefinition,
    type UiNodeDefinition,
    type UiQueryNodeDefinition,
    type UiRegionNodeDefinition,
    type UiRouteNodeDefinition,
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
    id?: string;
    title?: string;
}

export type UiAppEditorNodeDefinition = BaseEditorNodeDefinition<UiAppEditorConfig, UiAppNodeDefinition>;

export interface AppScopedEditorConfig {
    appId?: string;
    id?: string;
}

export interface UiLayoutEditorConfig extends AppScopedEditorConfig {
    title?: string;
}

export interface UiRegionEditorConfig extends AppScopedEditorConfig {
    layoutId?: string;
    name?: string;
    parentRegionId?: string;
    title?: string;
    order?: number;
}

export interface UiRouteEditorConfig extends AppScopedEditorConfig {
    path?: string;
    title?: string;
    layoutId?: string;
}

export interface UiDialogEditorConfig extends AppScopedEditorConfig {
    title?: string;
    layoutId?: string;
    routeId?: string;
    modal?: boolean;
}

interface MountableEditorConfig extends AppScopedEditorConfig {
    mount?: string;
    order?: number;
}

export interface UiTextEditorConfig extends MountableEditorConfig {
    text?: string;
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

export interface UiFormEditorConfig extends MountableEditorConfig {
    fields?: string[];
    modelPath?: string;
    submitAction?: string;
}

export interface UiStoreEditorConfig extends AppScopedEditorConfig {
    statePath?: string;
    initialValue?: unknown;
}

export interface UiQueryEditorConfig extends AppScopedEditorConfig {
    queryPath?: string;
    source?: string;
    refreshAction?: string;
}

export interface UiActionEditorConfig extends AppScopedEditorConfig {
    description?: string;
}

export interface UiNavigationEditorConfig extends AppScopedEditorConfig {
    to?: string;
}

export type NodeEditorConfig =
    | UiAppEditorConfig
    | UiLayoutEditorConfig
    | UiRegionEditorConfig
    | UiRouteEditorConfig
    | UiDialogEditorConfig
    | UiTextEditorConfig
    | UiButtonEditorConfig
    | UiTableEditorConfig
    | UiFormEditorConfig
    | UiStoreEditorConfig
    | UiQueryEditorConfig
    | UiActionEditorConfig
    | UiNavigationEditorConfig;

export type NodeEditorDefinition =
    | UiAppEditorNodeDefinition
    | BaseEditorNodeDefinition<UiLayoutEditorConfig, UiLayoutNodeDefinition>
    | BaseEditorNodeDefinition<UiRegionEditorConfig, UiRegionNodeDefinition>
    | BaseEditorNodeDefinition<UiRouteEditorConfig, UiRouteNodeDefinition>
    | BaseEditorNodeDefinition<UiDialogEditorConfig, UiDialogNodeDefinition>
    | BaseEditorNodeDefinition<UiTextEditorConfig, UiTextNodeDefinition>
    | BaseEditorNodeDefinition<UiButtonEditorConfig, UiButtonNodeDefinition>
    | BaseEditorNodeDefinition<UiTableEditorConfig, UiTableNodeDefinition>
    | BaseEditorNodeDefinition<UiFormEditorConfig, UiFormNodeDefinition>
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
        id: requiredString("App IDs are required before deploy."),
        title: requiredString("App titles are required before deploy.")
    }, (config: UiAppEditorConfig) => ({
        type: "ui-app",
        id: config.id ?? "",
        title: config.title ?? ""
    })),
    "ui-layout": createDefinition("ui-layout", "structure", {
        appId: requiredString("Layouts must reference an app."),
        id: requiredString("Layout IDs are required before deploy.")
    }, (config: UiLayoutEditorConfig) => ({
        type: "ui-layout",
        appId: config.appId ?? "",
        id: config.id ?? "",
        title: config.title
    })),
    "ui-region": createDefinition("ui-region", "structure", {
        appId: requiredString("Regions must reference an app."),
        id: requiredString("Region node IDs are required before deploy."),
        layoutId: requiredString("Regions must reference a layout."),
        name: requiredString("Regions must declare a region name."),
        order: optionalInteger("Region order must be an integer.")
    }, (config: UiRegionEditorConfig) => ({
        type: "ui-region",
        appId: config.appId ?? "",
        id: config.id ?? "",
        layoutId: config.layoutId ?? "",
        name: config.name ?? "",
        parentRegionId: config.parentRegionId,
        title: config.title,
        order: config.order ?? 0
    })),
    "ui-route": createDefinition("ui-route", "structure", {
        appId: requiredString("Routes must reference an app."),
        id: requiredString("Route IDs are required before deploy."),
        path: requiredString("Routes must declare a path."),
        layoutId: requiredString("Routes must reference a layout.")
    }, (config: UiRouteEditorConfig) => ({
        type: "ui-route",
        appId: config.appId ?? "",
        id: config.id ?? "",
        path: config.path ?? "",
        title: config.title,
        layoutId: config.layoutId ?? ""
    })),
    "ui-dialog": createDefinition("ui-dialog", "structure", {
        appId: requiredString("Dialogs must reference an app."),
        id: requiredString("Dialog IDs are required before deploy."),
        layoutId: requiredString("Dialogs must reference a layout.")
    }, (config: UiDialogEditorConfig) => ({
        type: "ui-dialog",
        appId: config.appId ?? "",
        id: config.id ?? "",
        title: config.title,
        layoutId: config.layoutId ?? "",
        routeId: config.routeId,
        modal: config.modal ?? true
    })),
    "ui-text": createDefinition("ui-text", "view", {
        appId: requiredString("Text nodes must reference an app."),
        id: requiredString("Text node IDs are required before deploy."),
        mount: requiredString("Text nodes must declare a mount target."),
        text: requiredString("Text nodes must declare a value."),
        order: optionalInteger("Text order must be an integer.")
    }, (config: UiTextEditorConfig) => ({
        type: "ui-text",
        appId: config.appId ?? "",
        id: config.id ?? "",
        mount: config.mount ?? "",
        order: config.order,
        value: literalBinding(config.text ?? ""),
        variant: config.variant
    })),
    "ui-button": createDefinition("ui-button", "view", {
        appId: requiredString("Buttons must reference an app."),
        id: requiredString("Button IDs are required before deploy."),
        mount: requiredString("Buttons must declare a mount target."),
        label: requiredString("Buttons must declare a label."),
        action: requiredString("Buttons must reference an action."),
        order: optionalInteger("Button order must be an integer.")
    }, (config: UiButtonEditorConfig) => ({
        type: "ui-button",
        appId: config.appId ?? "",
        id: config.id ?? "",
        mount: config.mount ?? "",
        order: config.order,
        label: config.label ?? "",
        action: config.action ?? "",
        disabled: config.disabledPath ? stateBinding(config.disabledPath) : undefined
    })),
    "ui-table": createDefinition("ui-table", "view", {
        appId: requiredString("Tables must reference an app."),
        id: requiredString("Table IDs are required before deploy."),
        mount: requiredString("Tables must declare a mount target."),
        columns: requiredStringArray("Tables must declare at least one column."),
        rowsPath: requiredString("Tables must bind to a query path."),
        order: optionalInteger("Table order must be an integer.")
    }, (config: UiTableEditorConfig) => ({
        type: "ui-table",
        appId: config.appId ?? "",
        id: config.id ?? "",
        mount: config.mount ?? "",
        order: config.order,
        columns: config.columns ?? [],
        rows: queryBinding(config.rowsPath ?? ""),
        selectAction: config.selectAction
    })),
    "ui-form": createDefinition("ui-form", "view", {
        appId: requiredString("Forms must reference an app."),
        id: requiredString("Form IDs are required before deploy."),
        mount: requiredString("Forms must declare a mount target."),
        fields: requiredStringArray("Forms must declare at least one field."),
        modelPath: requiredString("Forms must bind to a state path."),
        submitAction: requiredString("Forms must reference a submit action."),
        order: optionalInteger("Form order must be an integer.")
    }, (config: UiFormEditorConfig) => ({
        type: "ui-form",
        appId: config.appId ?? "",
        id: config.id ?? "",
        mount: config.mount ?? "",
        order: config.order,
        fields: config.fields ?? [],
        model: stateBinding(config.modelPath ?? ""),
        submitAction: config.submitAction ?? ""
    })),
    "ui-store": createDefinition("ui-store", "state", {
        appId: requiredString("Stores must reference an app."),
        id: requiredString("Store IDs are required before deploy."),
        statePath: requiredString("Stores must declare a state path.")
    }, (config: UiStoreEditorConfig) => ({
        type: "ui-store",
        appId: config.appId ?? "",
        id: config.id ?? "",
        statePath: config.statePath ?? "",
        initialValue: config.initialValue
    })),
    "ui-query": createDefinition("ui-query", "state", {
        appId: requiredString("Queries must reference an app."),
        id: requiredString("Query IDs are required before deploy."),
        queryPath: requiredString("Queries must declare a query path.")
    }, (config: UiQueryEditorConfig) => ({
        type: "ui-query",
        appId: config.appId ?? "",
        id: config.id ?? "",
        queryPath: config.queryPath ?? "",
        source: config.source,
        refreshAction: config.refreshAction
    })),
    "ui-action": createDefinition("ui-action", "behavior", {
        appId: requiredString("Actions must reference an app."),
        id: requiredString("Action IDs are required before deploy.")
    }, (config: UiActionEditorConfig) => ({
        type: "ui-action",
        appId: config.appId ?? "",
        id: config.id ?? "",
        description: config.description
    })),
    "ui-navigation": createDefinition("ui-navigation", "behavior", {
        appId: requiredString("Navigation nodes must reference an app."),
        id: requiredString("Navigation IDs are required before deploy."),
        to: requiredString("Navigation nodes must declare a destination path.")
    }, (config: UiNavigationEditorConfig) => ({
        type: "ui-navigation",
        appId: config.appId ?? "",
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
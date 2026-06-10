import {
    collectMissingStandardLayouts,
    actionDefinitionSchema,
    navigationDefinitionSchema,
    queryDefinitionSchema,
    runtimeIntegrationModelSchema,
    routeDefinitionSchema,
    storeDefinitionSchema,
    dialogDefinitionSchema,
    validateUiNodeDefinition,
    type StandardLayoutPresetId,
    type ComponentDefinition,
    type RuntimeIntegrationModel,
    type UiAppNodeDefinition,
    type UiButtonNodeDefinition,
    type UiContainerNodeDefinition,
    type UiDialogNodeDefinition,
    type UiInputNodeDefinition,
    type UiNodeDefinition,
    type UiQueryNodeDefinition,
    type UiRouteNodeDefinition,
    type UiStoreNodeDefinition,
    type UiTableNodeDefinition,
    type UiTextNodeDefinition,
    type UiActionNodeDefinition,
    type UiNavigationNodeDefinition,
    type UiAlertNodeDefinition,
    type UiBadgeNodeDefinition
} from "@node-red-contrib-webapp/schema";

import type {
    AppContribution,
    ComponentContribution,
    DialogContribution,
    RouteContribution,
    RuntimeRegistryContribution
} from "./registry";

export interface AssembledNodeSet {
    appId: string;
    emittedDefinitions: UiNodeDefinition[];
    contributions: RuntimeRegistryContribution[];
    integration: RuntimeIntegrationModel;
    passiveDefinitions: Array<UiStoreNodeDefinition | UiQueryNodeDefinition | UiActionNodeDefinition | UiNavigationNodeDefinition>;
}

type Result<T> =
    | { success: true; data: T }
    | { success: false; error: string };

function sortById<T extends { id: string }>(items: T[]): T[] {
    return [...items].sort((left, right) => left.id.localeCompare(right.id));
}

function makeRegistrationId(type: string, appId: string, id: string): string {
    return `${appId}:${type}:${id}`;
}

function resolveMount(node: { mount?: string; parent?: string }): string {
    return (node.mount || node.parent) ?? "";
}

function toTextComponent(node: UiTextNodeDefinition): ComponentDefinition {
    return {
        id: node.id,
        kind: "text",
        mount: resolveMount(node),
        order: node.order,
        bind: {
            value: node.value
        },
        props: node.variant ? { variant: node.variant } : {},
        events: []
    };
}

function toButtonComponent(node: UiButtonNodeDefinition): ComponentDefinition {
    return {
        id: node.id,
        kind: "button",
        mount: resolveMount(node),
        order: node.order,
        bind: node.disabled ? { disabled: node.disabled } : {},
        props: {
            label: node.label,
            ...(node.variant ? { variant: node.variant } : {})
        },
        events: [
            {
                event: "click",
                action: node.action
            }
        ]
    };
}

function toTableComponent(node: UiTableNodeDefinition): ComponentDefinition {
    return {
        id: node.id,
        kind: "table",
        mount: resolveMount(node),
        order: node.order,
        bind: {
            rows: node.rows
        },
        props: {
            columns: node.columns,
            footer: node.footer === true,
            events: node.events ?? [],
            selectAction: node.selectAction ?? undefined
        },
        events: node.selectAction
            ? [
                {
                    event: "select",
                    action: node.selectAction
                }
            ]
            : []
    };
}

function toContainerComponent(node: UiContainerNodeDefinition): ComponentDefinition {
    return {
        id: node.id,
        kind: "container",
        mount: resolveMount(node),
        order: node.order,
        bind: {},
        props: {
            layoutId: node.layout,
            ...(node.variant ? { variant: node.variant } : {})
        },
        events: []
    };
}

function toInputComponent(node: UiInputNodeDefinition): ComponentDefinition {
    return {
        id: node.id,
        kind: "input",
        mount: resolveMount(node),
        order: node.order,
        bind: {
            value: node.value
        },
        props: {
            label: node.label,
            inputType: node.inputType,
            placeholder: node.placeholder,
            storeId: node.storeId,
            path: node.path,
            ...(node.variant ? { variant: node.variant } : {})
        },
        events: []
    };
}

function toAlertComponent(node: UiAlertNodeDefinition): ComponentDefinition {
    return {
        id: node.id,
        kind: "alert",
        mount: resolveMount(node),
        order: node.order,
        bind: node.message ? { message: node.message } : {},
        props: {
            severity: node.severity,
            title: node.title,
            dismissible: node.dismissible,
            // P90: icon field — "auto" / "none" / icon name / binding.
            ...(node.icon !== undefined ? { icon: node.icon } : {})
        },
        events: []
    };
}

function toBadgeComponent(node: UiBadgeNodeDefinition): ComponentDefinition {
    return {
        id: node.id,
        kind: "badge",
        mount: resolveMount(node),
        order: node.order,
        bind: { value: node.value },
        props: {
            // P92: variant (renamed from severity), pulsating fields added;
            // max field removed; displayType values changed to square/rounded/pill.
            // P103: size field removed.
            displayType: node.displayType,
            variant: node.variant,
            pulsating: node.pulsating
        },
        events: []
    };
}

function assembleRouteContribution(appId: string, routeNode: UiRouteNodeDefinition): Result<RouteContribution> {
    const definition = {
        id: routeNode.id,
        path: routeNode.path,
        title: routeNode.title,
        layoutId: routeNode.layout
    };
    const validation = routeDefinitionSchema.safeParse(definition);

    if (!validation.success) {
        return {
            success: false,
            error: validation.error.issues.map((issue) => issue.message).join(" ")
        };
    }

    return {
        success: true,
        data: {
            kind: "route",
            appId,
            registrationId: makeRegistrationId(routeNode.type, appId, routeNode.id),
            definition: validation.data
        }
    };
}

function assembleRouteDefinitionContribution(
    appId: string,
    routeDefinition: Pick<UiRouteNodeDefinition, "id" | "path" | "title" | "layout">
): Result<RouteContribution> {
    const definition = {
        id: routeDefinition.id,
        path: routeDefinition.path,
        title: routeDefinition.title,
        layoutId: routeDefinition.layout
    };
    const validation = routeDefinitionSchema.safeParse(definition);

    if (!validation.success) {
        return {
            success: false,
            error: validation.error.issues.map((issue) => issue.message).join(" ")
        };
    }

    return {
        success: true,
        data: {
            kind: "route",
            appId,
            registrationId: makeRegistrationId("ui-route", appId, definition.id),
            definition: validation.data
        }
    };
}

function assembleDialogContribution(appId: string, dialogNode: UiDialogNodeDefinition): Result<DialogContribution> {
    const definition = {
        id: dialogNode.id,
        title: dialogNode.title,
        layoutId: dialogNode.layout,
        routeId: dialogNode.routeId,
        modal: dialogNode.modal,
        closable: dialogNode.closable
    };
    const validation = dialogDefinitionSchema.safeParse(definition);

    if (!validation.success) {
        return {
            success: false,
            error: validation.error.issues.map((issue) => issue.message).join(" ")
        };
    }

    return {
        success: true,
        data: {
            kind: "dialog",
            appId,
            registrationId: makeRegistrationId(dialogNode.type, appId, dialogNode.id),
            definition: validation.data
        }
    };
}

function assembleComponentContribution(
    appId: string,
    node: UiTextNodeDefinition | UiButtonNodeDefinition | UiTableNodeDefinition | UiContainerNodeDefinition | UiInputNodeDefinition | UiAlertNodeDefinition | UiBadgeNodeDefinition
): ComponentContribution {
    const definition =
        node.type === "ui-text"
            ? toTextComponent(node)
            : node.type === "ui-button"
                ? toButtonComponent(node)
                : node.type === "ui-table"
                    ? toTableComponent(node)
                    : node.type === "ui-container"
                        ? toContainerComponent(node)
                        : node.type === "ui-alert"
                            ? toAlertComponent(node)
                            : node.type === "ui-badge"
                                ? toBadgeComponent(node)
                                : toInputComponent(node);

    return {
        kind: "component",
        appId,
        registrationId: makeRegistrationId(node.type, appId, node.id),
        definition
    };
}

function assembleRuntimeIntegration(
    passiveDefinitions: Array<UiStoreNodeDefinition | UiQueryNodeDefinition | UiActionNodeDefinition | UiNavigationNodeDefinition>
): Result<RuntimeIntegrationModel> {
    const stores = passiveDefinitions
        .filter((definition): definition is UiStoreNodeDefinition => definition.type === "ui-store")
        .map((definition) => ({
            id: definition.id,
            statePath: definition.statePath,
            initialValue: definition.initialValue
        }))
        .sort((left, right) => left.id.localeCompare(right.id));

    const queries = passiveDefinitions
        .filter((definition): definition is UiQueryNodeDefinition => definition.type === "ui-query")
        .map((definition) => ({
            id: definition.id,
            queryPath: definition.queryPath,
            params: definition.params,
            refreshAction: definition.refreshAction
        }))
        .sort((left, right) => left.id.localeCompare(right.id));

    const actions = passiveDefinitions
        .filter((definition): definition is UiActionNodeDefinition | UiNavigationNodeDefinition => definition.type === "ui-action" || definition.type === "ui-navigation")
        .map((definition) => ({
            id: definition.id,
            actionType: definition.type === "ui-navigation" ? "navigate" : definition.actionType,
            // P118 (ADR 0011 §1): the navigate target SOURCE (wire | route | url).
            // ui-navigation has no stored mode → its `to` makes it a url target.
            targetMode: definition.type === "ui-navigation" ? "url" : definition.targetMode,
            routeId: definition.type === "ui-navigation" ? undefined : definition.routeId,
            target: definition.type === "ui-navigation" ? undefined : definition.target,
            to: definition.type === "ui-navigation" ? definition.to : definition.to,
            params: definition.type === "ui-navigation" ? undefined : definition.params,
            description: definition.type === "ui-navigation" ? undefined : definition.description
        }))
        .sort((left, right) => left.id.localeCompare(right.id));

    const navigations = passiveDefinitions
        .filter((definition): definition is UiNavigationNodeDefinition | UiActionNodeDefinition => definition.type === "ui-navigation" || definition.type === "ui-action" && definition.actionType === "navigate" && typeof definition.to === "string")
        .map((definition) => ({
            id: definition.id,
            to: definition.to
        }))
        .sort((left, right) => left.id.localeCompare(right.id));

    const storeValidation = storeDefinitionSchema.array().safeParse(stores);

    if (!storeValidation.success) {
        return {
            success: false,
            error: storeValidation.error.issues.map((issue) => issue.message).join(" ")
        };
    }

    const queryValidation = queryDefinitionSchema.array().safeParse(queries);

    if (!queryValidation.success) {
        return {
            success: false,
            error: queryValidation.error.issues.map((issue) => issue.message).join(" ")
        };
    }

    const actionValidation = actionDefinitionSchema.array().safeParse(actions);

    if (!actionValidation.success) {
        return {
            success: false,
            error: actionValidation.error.issues.map((issue) => issue.message).join(" ")
        };
    }

    const navigationValidation = navigationDefinitionSchema.array().safeParse(navigations);

    if (!navigationValidation.success) {
        return {
            success: false,
            error: navigationValidation.error.issues.map((issue) => issue.message).join(" ")
        };
    }

    const integrationValidation = runtimeIntegrationModelSchema.safeParse({
        stores: storeValidation.data,
        queries: queryValidation.data,
        actions: actionValidation.data,
        navigations: navigationValidation.data
    });

    if (!integrationValidation.success) {
        return {
            success: false,
            error: integrationValidation.error.issues.map((issue) => issue.message).join(" ")
        };
    }

    return {
        success: true,
        data: integrationValidation.data
    };
}

export function assembleNodeSet(input: unknown[]): Result<AssembledNodeSet> {
    const emittedDefinitions: UiNodeDefinition[] = [];

    for (const rawDefinition of input) {
        const validation = validateUiNodeDefinition(rawDefinition);

        if (!validation.success) {
            return {
                success: false,
                error: validation.error
            };
        }

        emittedDefinitions.push(validation.data);
    }

    const appNodes = emittedDefinitions.filter((definition): definition is UiAppNodeDefinition => definition.type === "ui-app");

    if (appNodes.length !== 1) {
        return {
            success: false,
            error: "Exactly one ui-app definition is required to assemble a node set."
        };
    }

    const appNode = appNodes[0];
    const appId = appNode.id;

    const contributions: RuntimeRegistryContribution[] = [
        {
            kind: "app",
            registrationId: makeRegistrationId(appNode.type, appId, appNode.id),
            definition: {
                id: appNode.id,
                // P109: AppModel uses `name` (was `title`).
                name: appNode.name ?? appNode.id
            }
        } satisfies AppContribution
    ];

    const routeNodes = sortById(
        emittedDefinitions.filter((definition): definition is UiRouteNodeDefinition => definition.type === "ui-route")
    );
    const dialogNodes = sortById(
        emittedDefinitions.filter((definition): definition is UiDialogNodeDefinition => definition.type === "ui-dialog")
    );
    const passiveDefinitions = emittedDefinitions.filter(
        (
            definition
        ): definition is UiStoreNodeDefinition | UiQueryNodeDefinition | UiActionNodeDefinition | UiNavigationNodeDefinition =>
            definition.type === "ui-store" ||
            definition.type === "ui-query" ||
            definition.type === "ui-action" ||
            definition.type === "ui-navigation"
    );
    const componentNodes = sortById(
        emittedDefinitions.filter(
            (
                definition
            ): definition is UiTextNodeDefinition | UiButtonNodeDefinition | UiTableNodeDefinition | UiContainerNodeDefinition | UiInputNodeDefinition | UiAlertNodeDefinition | UiBadgeNodeDefinition =>
                definition.type === "ui-text" ||
                definition.type === "ui-button" ||
                definition.type === "ui-table" ||
                definition.type === "ui-container" ||
                definition.type === "ui-input" ||
                definition.type === "ui-alert" ||
                definition.type === "ui-badge"
        )
    );
    const containerNodes = componentNodes.filter((definition): definition is UiContainerNodeDefinition => definition.type === "ui-container");
    const integration = assembleRuntimeIntegration(passiveDefinitions);

    if (!integration.success) {
        return integration;
    }

    const referencedLayoutIds = new Set<string>([
        appNode.layout,
        ...routeNodes.map((routeNode) => routeNode.layout),
        ...dialogNodes.map((dialogNode) => dialogNode.layout),
        ...containerNodes.map((containerNode) => containerNode.layout)
    ]);

    const standardLayouts = collectMissingStandardLayouts(
        referencedLayoutIds,
        []
    );

    for (const layoutDefinition of standardLayouts) {
        contributions.push({
            kind: "layout",
            appId,
            registrationId: makeRegistrationId("layout", appId, layoutDefinition.id),
            definition: layoutDefinition
        });
    }

    for (const routeNode of routeNodes) {
        const routeContribution = assembleRouteContribution(appId, routeNode);

        if (!routeContribution.success) {
            return routeContribution;
        }

        contributions.push(routeContribution.data);
    }

    if (!routeNodes.some((routeNode) => routeNode.path === "/") && !routeNodes.some((routeNode) => routeNode.id === appId)) {
        const rootRouteContribution = assembleRouteDefinitionContribution(
            appId,
            {
                id: appId,
                path: "/",
                // P109: use appNode.name (was appNode.title).
                title: appNode.name ?? undefined,
                layout: appNode.layout as StandardLayoutPresetId
            }
        );

        if (!rootRouteContribution.success) {
            return rootRouteContribution;
        }

        contributions.push(rootRouteContribution.data);
    }

    for (const dialogNode of dialogNodes) {
        const dialogContribution = assembleDialogContribution(appId, dialogNode);

        if (!dialogContribution.success) {
            return dialogContribution;
        }

        contributions.push(dialogContribution.data);
    }

    for (const componentNode of componentNodes) {
        contributions.push(assembleComponentContribution(appId, componentNode));
    }

    return {
        success: true,
        data: {
            appId,
            emittedDefinitions,
            contributions,
            integration: integration.data,
            passiveDefinitions
        }
    };
}
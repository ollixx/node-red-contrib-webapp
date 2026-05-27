import {
    actionDefinitionSchema,
    layoutDefinitionSchema,
    navigationDefinitionSchema,
    queryDefinitionSchema,
    runtimeIntegrationModelSchema,
    routeDefinitionSchema,
    storeDefinitionSchema,
    dialogDefinitionSchema,
    validateUiNodeDefinition,
    type ComponentDefinition,
    type RuntimeIntegrationModel,
    type UiAppNodeDefinition,
    type UiButtonNodeDefinition,
    type UiContainerNodeDefinition,
    type UiDialogNodeDefinition,
    type UiInputNodeDefinition,
    type UiLayoutNodeDefinition,
    type UiNodeDefinition,
    type UiQueryNodeDefinition,
    type UiRouteNodeDefinition,
    type UiSlotNodeDefinition,
    type UiStoreNodeDefinition,
    type UiTableNodeDefinition,
    type UiTextNodeDefinition,
    type UiActionNodeDefinition,
    type UiNavigationNodeDefinition
} from "@node-red-contrib-webapp/schema";

import type {
    AppContribution,
    ComponentContribution,
    DialogContribution,
    LayoutContribution,
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

function makeRegistrationId(type: UiNodeDefinition["type"], appId: string, id: string): string {
    return `${appId}:${type}:${id}`;
}

function toTextComponent(node: UiTextNodeDefinition): ComponentDefinition {
    return {
        id: node.id,
        kind: "text",
        mount: node.mount,
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
        mount: node.mount,
        order: node.order,
        bind: node.disabled ? { disabled: node.disabled } : {},
        props: {
            label: node.label
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
        mount: node.mount,
        order: node.order,
        bind: {
            rows: node.rows
        },
        props: {
            columns: node.columns
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
        mount: node.mount,
        order: node.order,
        bind: {},
        props: {
            layoutId: node.layoutId,
            title: node.title
        },
        events: []
    };
}

function toInputComponent(node: UiInputNodeDefinition): ComponentDefinition {
    return {
        id: node.id,
        kind: "input",
        mount: node.mount,
        order: node.order,
        bind: {
            value: node.value
        },
        props: {
            label: node.label,
            inputType: node.inputType,
            placeholder: node.placeholder,
            storeId: node.storeId,
            path: node.path
        },
        events: []
    };
}

function assembleLayoutContribution(appId: string, layoutNode: UiLayoutNodeDefinition, slotNodes: UiSlotNodeDefinition[]): Result<LayoutContribution> {
    const layoutDefinition = {
        id: layoutNode.id,
        title: layoutNode.title,
        slots: slotNodes
            .slice()
            .sort((left, right) => left.order - right.order || left.name.localeCompare(right.name))
            .map((slotNode) => ({
                name: slotNode.name,
                title: slotNode.title
            }))
    };
    const validation = layoutDefinitionSchema.safeParse(layoutDefinition);

    if (!validation.success) {
        return {
            success: false,
            error: validation.error.issues.map((issue) => issue.message).join(" ")
        };
    }

    return {
        success: true,
        data: {
            kind: "layout",
            appId,
            registrationId: makeRegistrationId(layoutNode.type, appId, layoutNode.id),
            definition: validation.data
        }
    };
}

function assembleRouteContribution(appId: string, routeNode: UiRouteNodeDefinition): Result<RouteContribution> {
    const definition = {
        id: routeNode.id,
        path: routeNode.path,
        title: routeNode.title,
        layoutId: routeNode.layoutId
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

function assembleDialogContribution(appId: string, dialogNode: UiDialogNodeDefinition): Result<DialogContribution> {
    const definition = {
        id: dialogNode.id,
        title: dialogNode.title,
        layoutId: dialogNode.layoutId,
        routeId: dialogNode.routeId,
        modal: dialogNode.modal
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
    node: UiTextNodeDefinition | UiButtonNodeDefinition | UiTableNodeDefinition | UiContainerNodeDefinition | UiInputNodeDefinition
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
            source: definition.source,
            refreshAction: definition.refreshAction
        }))
        .sort((left, right) => left.id.localeCompare(right.id));

    const actions = passiveDefinitions
        .filter((definition): definition is UiActionNodeDefinition | UiNavigationNodeDefinition => definition.type === "ui-action" || definition.type === "ui-navigation")
        .map((definition) => ({
            id: definition.id,
            actionType: definition.type === "ui-navigation" ? "navigate" : definition.actionType,
            targetMode: definition.type === "ui-navigation" ? "out-port" : definition.targetMode,
            target: definition.type === "ui-navigation" ? undefined : definition.target,
            to: definition.type === "ui-navigation" ? definition.to : definition.to,
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
                title: appNode.title
            }
        } satisfies AppContribution
    ];

    const layoutNodes = sortById(
        emittedDefinitions.filter((definition): definition is UiLayoutNodeDefinition => definition.type === "ui-layout")
    );
    const slotNodes = emittedDefinitions.filter((definition): definition is UiSlotNodeDefinition => definition.type === "ui-slot");
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
            ): definition is UiTextNodeDefinition | UiButtonNodeDefinition | UiTableNodeDefinition | UiContainerNodeDefinition | UiInputNodeDefinition =>
                definition.type === "ui-text" ||
                definition.type === "ui-button" ||
                definition.type === "ui-table" ||
                definition.type === "ui-container" ||
                definition.type === "ui-input"
        )
    );
    const integration = assembleRuntimeIntegration(passiveDefinitions);

    if (!integration.success) {
        return integration;
    }

    for (const layoutNode of layoutNodes) {
        const layoutSlotNodes = slotNodes.filter((slotNode) => slotNode.layoutId === layoutNode.id);
        const layoutContribution = assembleLayoutContribution(appId, layoutNode, layoutSlotNodes);

        if (!layoutContribution.success) {
            return layoutContribution;
        }

        contributions.push(layoutContribution.data);
    }

    for (const routeNode of routeNodes) {
        const routeContribution = assembleRouteContribution(appId, routeNode);

        if (!routeContribution.success) {
            return routeContribution;
        }

        contributions.push(routeContribution.data);
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
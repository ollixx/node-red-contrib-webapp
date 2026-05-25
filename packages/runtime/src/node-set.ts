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
    type RegionDefinition,
    type RuntimeIntegrationModel,
    type UiAppNodeDefinition,
    type UiButtonNodeDefinition,
    type UiDialogNodeDefinition,
    type UiFormNodeDefinition,
    type UiLayoutNodeDefinition,
    type UiNodeDefinition,
    type UiQueryNodeDefinition,
    type UiRegionNodeDefinition,
    type UiRouteNodeDefinition,
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

function toFormComponent(node: UiFormNodeDefinition): ComponentDefinition {
    return {
        id: node.id,
        kind: "form",
        mount: node.mount,
        order: node.order,
        bind: {
            model: node.model
        },
        props: {
            fields: node.fields
        },
        events: [
            {
                event: "submit",
                action: node.submitAction
            }
        ]
    };
}

function buildRegionTree(regionNodes: UiRegionNodeDefinition[], layoutId: string): Result<RegionDefinition[]> {
    const nodesById = new Map(regionNodes.map((node) => [node.id, node]));
    const childrenByParentId = new Map<string | undefined, UiRegionNodeDefinition[]>();

    for (const node of regionNodes) {
        if (node.parentRegionId && !nodesById.has(node.parentRegionId)) {
            return {
                success: false,
                error: `Region '${node.id}' references missing parent region '${node.parentRegionId}' in layout '${layoutId}'.`
            };
        }

        const siblings = childrenByParentId.get(node.parentRegionId);

        if (siblings) {
            siblings.push(node);
            continue;
        }

        childrenByParentId.set(node.parentRegionId, [node]);
    }

    const visit = (parentId: string | undefined, path: string[]): Result<RegionDefinition[]> => {
        const siblings = [...(childrenByParentId.get(parentId) ?? [])].sort((left, right) => {
            if (left.order !== right.order) {
                return left.order - right.order;
            }

            return left.name.localeCompare(right.name);
        });

        const seenNames = new Set<string>();
        const regions: RegionDefinition[] = [];

        for (const sibling of siblings) {
            if (path.includes(sibling.id)) {
                return {
                    success: false,
                    error: `Region '${sibling.id}' creates a cycle in layout '${layoutId}'.`
                };
            }

            if (seenNames.has(sibling.name)) {
                return {
                    success: false,
                    error: `Layout '${layoutId}' declares sibling region name '${sibling.name}' more than once.`
                };
            }

            seenNames.add(sibling.name);

            const childResult = visit(sibling.id, [...path, sibling.id]);

            if (!childResult.success) {
                return childResult;
            }

            regions.push({
                name: sibling.name,
                title: sibling.title,
                regions: childResult.data
            });
        }

        return {
            success: true,
            data: regions
        };
    };

    return visit(undefined, []);
}

function assembleLayoutContribution(appId: string, layoutNode: UiLayoutNodeDefinition, regionNodes: UiRegionNodeDefinition[]): Result<LayoutContribution> {
    const regionTree = buildRegionTree(regionNodes, layoutNode.id);

    if (!regionTree.success) {
        return regionTree;
    }

    const layoutDefinition = {
        id: layoutNode.id,
        title: layoutNode.title,
        regions: regionTree.data
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
    node: UiTextNodeDefinition | UiButtonNodeDefinition | UiTableNodeDefinition | UiFormNodeDefinition
): ComponentContribution {
    const definition =
        node.type === "ui-text"
            ? toTextComponent(node)
            : node.type === "ui-button"
                ? toButtonComponent(node)
                : node.type === "ui-table"
                    ? toTableComponent(node)
                    : toFormComponent(node);

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
        .filter((definition): definition is UiActionNodeDefinition => definition.type === "ui-action")
        .map((definition) => ({
            id: definition.id,
            description: definition.description
        }))
        .sort((left, right) => left.id.localeCompare(right.id));

    const navigations = passiveDefinitions
        .filter((definition): definition is UiNavigationNodeDefinition => definition.type === "ui-navigation")
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

    for (const definition of emittedDefinitions) {
        if (definition.type === "ui-app") {
            continue;
        }

        if (definition.appId !== appId) {
            return {
                success: false,
                error: `Node '${definition.id}' belongs to app '${definition.appId}', but the active ui-app is '${appId}'.`
            };
        }
    }

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
    const regionNodes = emittedDefinitions.filter((definition): definition is UiRegionNodeDefinition => definition.type === "ui-region");
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
            ): definition is UiTextNodeDefinition | UiButtonNodeDefinition | UiTableNodeDefinition | UiFormNodeDefinition =>
                definition.type === "ui-text" ||
                definition.type === "ui-button" ||
                definition.type === "ui-table" ||
                definition.type === "ui-form"
        )
    );
    const integration = assembleRuntimeIntegration(passiveDefinitions);

    if (!integration.success) {
        return integration;
    }

    for (const layoutNode of layoutNodes) {
        const layoutRegionNodes = regionNodes.filter((regionNode) => regionNode.layoutId === layoutNode.id);
        const layoutContribution = assembleLayoutContribution(appId, layoutNode, layoutRegionNodes);

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
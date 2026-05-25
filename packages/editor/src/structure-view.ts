import {
    resolveMountReference,
    type AppModel,
    type ComponentDefinition,
    type LayoutDefinition,
    type RegionDefinition,
    type UiButtonNodeDefinition,
    type UiDialogNodeDefinition,
    type UiFormNodeDefinition,
    type UiLayoutNodeDefinition,
    type UiNodeDefinition,
    type UiRegionNodeDefinition,
    type UiRouteNodeDefinition,
    type UiTextNodeDefinition
} from "@node-red-contrib-webapp/schema";

type StructureScope = "route" | "dialog" | "layout";

type StructureNodeKind = "app" | "route" | "dialog" | "layout" | "region" | "component";

type RuntimeDiagnosticLike = {
    code: string;
    message: string;
    registrationIds?: string[];
};

export type MountableEditorSourceNode = UiTextNodeDefinition | UiButtonNodeDefinition | UiFormNodeDefinition | UiTableSourceNode;

type UiTableSourceNode = Extract<UiNodeDefinition, { type: "ui-table" }>;

export interface CompiledRegistrySnapshot {
    appId: string;
    model?: AppModel;
    diagnostics?: readonly RuntimeDiagnosticLike[];
}

export interface EditorStructureItem {
    id: string;
    kind: StructureNodeKind;
    label: string;
    canvasNodeId?: string;
    children: EditorStructureItem[];
    meta?: {
        layoutId?: string;
        mount?: string;
        path?: string;
        routePath?: string;
    };
}

export interface EditorStructureDiagnostic {
    severity: "warning";
    code: "orphaned-mount" | "unresolved-slot" | "compiler-diagnostic";
    message: string;
    canvasNodeIds: string[];
    structureItemIds: string[];
}

export interface EditorStructureSelection {
    activeStructureItemId?: string;
    matchedStructureItemIds: string[];
    activeCanvasNodeIds: string[];
}

export interface EditorStructureView {
    appId: string;
    root?: EditorStructureItem;
    diagnostics: EditorStructureDiagnostic[];
    itemsById: Record<string, EditorStructureItem>;
}

interface SourceNodeLookup {
    app?: Extract<UiNodeDefinition, { type: "ui-app" }>;
    layouts: Map<string, UiLayoutNodeDefinition>;
    routes: Map<string, UiRouteNodeDefinition>;
    dialogs: Map<string, UiDialogNodeDefinition>;
    components: Map<string, MountableEditorSourceNode>;
    regionsByLayoutId: Map<string, UiRegionNodeDefinition[]>;
}

interface StructureIndex {
    itemsById: Record<string, EditorStructureItem>;
    structureItemIdsByCanvasNodeId: Map<string, string[]>;
}

function isMountableNode(node: UiNodeDefinition): node is MountableEditorSourceNode {
    return node.type === "ui-text" || node.type === "ui-button" || node.type === "ui-form" || node.type === "ui-table";
}

function sortComponents(left: ComponentDefinition, right: ComponentDefinition): number {
    const leftOrder = left.order ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.order ?? Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
    }

    return left.id.localeCompare(right.id);
}

function createSourceNodeLookup(sourceNodes: readonly UiNodeDefinition[]): SourceNodeLookup {
    const regionsByLayoutId = new Map<string, UiRegionNodeDefinition[]>();
    const lookup: SourceNodeLookup = {
        app: sourceNodes.find((node): node is Extract<UiNodeDefinition, { type: "ui-app" }> => node.type === "ui-app"),
        layouts: new Map(),
        routes: new Map(),
        dialogs: new Map(),
        components: new Map(),
        regionsByLayoutId
    };

    for (const sourceNode of sourceNodes) {
        if (sourceNode.type === "ui-layout") {
            lookup.layouts.set(sourceNode.id, sourceNode);
            continue;
        }

        if (sourceNode.type === "ui-route") {
            lookup.routes.set(sourceNode.id, sourceNode);
            continue;
        }

        if (sourceNode.type === "ui-dialog") {
            lookup.dialogs.set(sourceNode.id, sourceNode);
            continue;
        }

        if (sourceNode.type === "ui-region") {
            const layoutRegions = regionsByLayoutId.get(sourceNode.layoutId);

            if (layoutRegions) {
                layoutRegions.push(sourceNode);
            } else {
                regionsByLayoutId.set(sourceNode.layoutId, [sourceNode]);
            }

            continue;
        }

        if (isMountableNode(sourceNode)) {
            lookup.components.set(sourceNode.id, sourceNode);
        }
    }

    return lookup;
}

function registerItem(index: StructureIndex, item: EditorStructureItem): EditorStructureItem {
    index.itemsById[item.id] = item;

    if (item.canvasNodeId) {
        const itemIds = index.structureItemIdsByCanvasNodeId.get(item.canvasNodeId);

        if (itemIds) {
            itemIds.push(item.id);
        } else {
            index.structureItemIdsByCanvasNodeId.set(item.canvasNodeId, [item.id]);
        }
    }

    return item;
}

function findLayout(model: AppModel, layoutId: string): LayoutDefinition | undefined {
    return model.layouts.find((layout) => layout.id === layoutId);
}

function findRegionNodeId(lookup: SourceNodeLookup, layoutId: string, regionPath: string[]): string | undefined {
    const regionNodes = lookup.regionsByLayoutId.get(layoutId) ?? [];
    let parentRegionId: string | undefined;
    let currentNode: UiRegionNodeDefinition | undefined;

    for (const regionName of regionPath) {
        currentNode = regionNodes.find((regionNode) => regionNode.parentRegionId === parentRegionId && regionNode.name === regionName);

        if (!currentNode) {
            return undefined;
        }

        parentRegionId = currentNode.id;
    }

    return currentNode?.id;
}

function hasRegionPath(layout: LayoutDefinition, regionPath: string[]): boolean {
    let regions = layout.regions;

    for (const regionName of regionPath) {
        const region = regions.find((candidate) => candidate.name === regionName);

        if (!region) {
            return false;
        }

        regions = region.regions ?? [];
    }

    return true;
}

function createResolvedComponentMap(model: AppModel): Map<string, ComponentDefinition[]> {
    const resolvedComponents = new Map<string, ComponentDefinition[]>();

    for (const component of model.components) {
        const mountResolution = resolveMountReference(component.mount, model);

        if (!mountResolution.success) {
            continue;
        }

        const mountKey = `${mountResolution.data.scope}:${mountResolution.data.targetId}:${mountResolution.data.regionPath.join("/")}`;
        const currentBucket = resolvedComponents.get(mountKey);

        if (currentBucket) {
            currentBucket.push(component);
        } else {
            resolvedComponents.set(mountKey, [component]);
        }
    }

    for (const bucket of resolvedComponents.values()) {
        bucket.sort(sortComponents);
    }

    return resolvedComponents;
}

function createComponentItems(
    branchItemId: string,
    targets: Array<{ scope: StructureScope; targetId: string }>,
    regionPath: string[],
    resolvedComponents: Map<string, ComponentDefinition[]>,
    lookup: SourceNodeLookup,
    index: StructureIndex
): EditorStructureItem[] {
    const components = targets.flatMap((target) => resolvedComponents.get(`${target.scope}:${target.targetId}:${regionPath.join("/")}`) ?? []);
    const dedupedComponents = [...new Map(components.map((component) => [component.id, component])).values()].sort(sortComponents);

    return dedupedComponents.map((component) =>
        registerItem(index, {
            id: `${branchItemId}/component:${component.id}`,
            kind: "component",
            label: component.id,
            canvasNodeId: lookup.components.get(component.id)?.id ?? component.id,
            children: [],
            meta: {
                mount: component.mount
            }
        })
    );
}

function createRegionItems(
    branchItemId: string,
    layoutId: string,
    regions: RegionDefinition[],
    targets: Array<{ scope: StructureScope; targetId: string }>,
    resolvedComponents: Map<string, ComponentDefinition[]>,
    lookup: SourceNodeLookup,
    index: StructureIndex,
    regionPath: string[] = []
): EditorStructureItem[] {
    return regions.map((region) => {
        const nextRegionPath = [...regionPath, region.name];
        const regionItemId = `${branchItemId}/region:${nextRegionPath.join("/")}`;
        const regionChildren = createRegionItems(
            branchItemId,
            layoutId,
            region.regions ?? [],
            targets,
            resolvedComponents,
            lookup,
            index,
            nextRegionPath
        );
        const componentChildren = createComponentItems(branchItemId, targets, nextRegionPath, resolvedComponents, lookup, index);

        return registerItem(index, {
            id: regionItemId,
            kind: "region",
            label: region.title ?? region.name,
            canvasNodeId: findRegionNodeId(lookup, layoutId, nextRegionPath),
            children: [...regionChildren, ...componentChildren],
            meta: {
                layoutId,
                path: nextRegionPath.join("/")
            }
        });
    });
}

function createLayoutBranch(
    branchPrefix: string,
    parentKind: "route" | "dialog",
    parentId: string,
    label: string,
    layoutId: string,
    model: AppModel,
    resolvedComponents: Map<string, ComponentDefinition[]>,
    lookup: SourceNodeLookup,
    index: StructureIndex
): EditorStructureItem {
    const layout = findLayout(model, layoutId);

    if (!layout) {
        return registerItem(index, {
            id: `${branchPrefix}/layout:${layoutId}`,
            kind: "layout",
            label: layoutId,
            canvasNodeId: lookup.layouts.get(layoutId)?.id,
            children: [],
            meta: {
                layoutId
            }
        });
    }

    return registerItem(index, {
        id: `${branchPrefix}/layout:${layout.id}`,
        kind: "layout",
        label: layout.title ?? layout.id,
        canvasNodeId: lookup.layouts.get(layout.id)?.id ?? layout.id,
        children: createRegionItems(
            `${branchPrefix}/layout:${layout.id}`,
            layout.id,
            layout.regions,
            [
                { scope: parentKind, targetId: parentId },
                { scope: "layout", targetId: layout.id }
            ],
            resolvedComponents,
            lookup,
            index
        ),
        meta: {
            layoutId: layout.id,
            path: label
        }
    });
}

function registrationIdsToCanvasNodeIds(registrationIds: readonly string[] | undefined, sourceNodes: readonly UiNodeDefinition[]): string[] {
    if (!registrationIds || registrationIds.length === 0) {
        return [];
    }

    const sourceNodeIds = new Set(sourceNodes.map((sourceNode) => sourceNode.id));

    return registrationIds
        .map((registrationId) => registrationId.split(":").at(-1) ?? "")
        .filter((nodeId) => sourceNodeIds.has(nodeId));
}

function createCompilerDiagnostics(
    snapshot: CompiledRegistrySnapshot,
    sourceNodes: readonly UiNodeDefinition[],
    structureIndex: StructureIndex
): EditorStructureDiagnostic[] {
    return (snapshot.diagnostics ?? []).map((diagnostic) => {
        const canvasNodeIds = registrationIdsToCanvasNodeIds(diagnostic.registrationIds, sourceNodes);
        const structureItemIds = canvasNodeIds.flatMap((canvasNodeId) => structureIndex.structureItemIdsByCanvasNodeId.get(canvasNodeId) ?? []);

        return {
            severity: "warning",
            code: "compiler-diagnostic",
            message: diagnostic.message,
            canvasNodeIds,
            structureItemIds
        };
    });
}

function createMountDiagnostics(
    model: AppModel,
    sourceNodes: readonly UiNodeDefinition[],
    structureIndex: StructureIndex
): EditorStructureDiagnostic[] {
    const compiledComponentIds = new Set(model.components.map((component) => component.id));

    return sourceNodes
        .filter(isMountableNode)
        .filter((sourceNode) => !compiledComponentIds.has(sourceNode.id))
        .flatMap<EditorStructureDiagnostic>((sourceNode) => {
            const mountResolution = resolveMountReference(sourceNode.mount, model);

            if (!mountResolution.success) {
                return [
                    {
                        severity: "warning",
                        code: "orphaned-mount",
                        message: `Component '${sourceNode.id}' cannot resolve mount '${sourceNode.mount}': ${mountResolution.error}`,
                        canvasNodeIds: [sourceNode.id],
                        structureItemIds: structureIndex.structureItemIdsByCanvasNodeId.get(sourceNode.id) ?? []
                    }
                ];
            }

            const layout = findLayout(model, mountResolution.data.layoutId);

            if (!layout || !hasRegionPath(layout, mountResolution.data.regionPath)) {
                return [
                    {
                        severity: "warning",
                        code: "unresolved-slot",
                        message: `Component '${sourceNode.id}' targets unresolved slot '${sourceNode.mount}'.`,
                        canvasNodeIds: [sourceNode.id],
                        structureItemIds: structureIndex.structureItemIdsByCanvasNodeId.get(sourceNode.id) ?? []
                    }
                ];
            }

            return [];
        });
}

export function buildEditorStructureView(
    snapshot: CompiledRegistrySnapshot,
    sourceNodes: readonly UiNodeDefinition[] = []
): EditorStructureView {
    const structureIndex: StructureIndex = {
        itemsById: {},
        structureItemIdsByCanvasNodeId: new Map()
    };
    const lookup = createSourceNodeLookup(sourceNodes);

    if (!snapshot.model) {
        return {
            appId: snapshot.appId,
            diagnostics: createCompilerDiagnostics(snapshot, sourceNodes, structureIndex),
            itemsById: structureIndex.itemsById
        };
    }

    const resolvedComponents = createResolvedComponentMap(snapshot.model);
    const routeItems = snapshot.model.routes
        .slice()
        .sort((left, right) => left.path.localeCompare(right.path) || left.id.localeCompare(right.id))
        .map((route) => {
            const routeItemId = `app:${snapshot.model?.id}/route:${route.id}`;
            const routeDialogs = snapshot.model?.dialogs
                .filter((dialog) => dialog.routeId === route.id)
                .sort((left, right) => left.id.localeCompare(right.id))
                .map((dialog) => {
                    const dialogItemId = `${routeItemId}/dialog:${dialog.id}`;

                    return registerItem(structureIndex, {
                        id: dialogItemId,
                        kind: "dialog",
                        label: dialog.title ?? dialog.id,
                        canvasNodeId: lookup.dialogs.get(dialog.id)?.id ?? dialog.id,
                        children: [
                            createLayoutBranch(dialogItemId, "dialog", dialog.id, dialog.id, dialog.layoutId, snapshot.model as AppModel, resolvedComponents, lookup, structureIndex)
                        ],
                        meta: {
                            layoutId: dialog.layoutId
                        }
                    });
                }) ?? [];

            return registerItem(structureIndex, {
                id: routeItemId,
                kind: "route",
                label: route.title ?? route.id,
                canvasNodeId: lookup.routes.get(route.id)?.id ?? route.id,
                children: [
                    createLayoutBranch(routeItemId, "route", route.id, route.path, route.layoutId, snapshot.model as AppModel, resolvedComponents, lookup, structureIndex),
                    ...routeDialogs
                ],
                meta: {
                    layoutId: route.layoutId,
                    routePath: route.path
                }
            });
        });

    const globalDialogItems = snapshot.model.dialogs
        .filter((dialog) => dialog.routeId === undefined)
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((dialog) => {
            const dialogItemId = `app:${snapshot.model?.id}/dialog:${dialog.id}`;

            return registerItem(structureIndex, {
                id: dialogItemId,
                kind: "dialog",
                label: dialog.title ?? dialog.id,
                canvasNodeId: lookup.dialogs.get(dialog.id)?.id ?? dialog.id,
                children: [
                    createLayoutBranch(dialogItemId, "dialog", dialog.id, dialog.id, dialog.layoutId, snapshot.model as AppModel, resolvedComponents, lookup, structureIndex)
                ],
                meta: {
                    layoutId: dialog.layoutId
                }
            });
        });

    const root = registerItem(structureIndex, {
        id: `app:${snapshot.model.id}`,
        kind: "app",
        label: snapshot.model.title,
        canvasNodeId: lookup.app?.id ?? snapshot.model.id,
        children: [...routeItems, ...globalDialogItems]
    });

    return {
        appId: snapshot.model.id,
        root,
        diagnostics: [
            ...createCompilerDiagnostics(snapshot, sourceNodes, structureIndex),
            ...createMountDiagnostics(snapshot.model, sourceNodes, structureIndex)
        ],
        itemsById: structureIndex.itemsById
    };
}

export function findStructureItem(view: EditorStructureView, itemId: string): EditorStructureItem | undefined {
    return view.itemsById[itemId];
}

export function selectFromCanvas(view: EditorStructureView, canvasNodeId: string): EditorStructureSelection {
    const matchedStructureItemIds = Object.values(view.itemsById)
        .filter((item) => item.canvasNodeId === canvasNodeId)
        .map((item) => item.id);

    return {
        activeStructureItemId: matchedStructureItemIds[0],
        matchedStructureItemIds,
        activeCanvasNodeIds: matchedStructureItemIds.length > 0 ? [canvasNodeId] : []
    };
}

export function selectFromStructure(view: EditorStructureView, structureItemId: string): EditorStructureSelection {
    const structureItem = view.itemsById[structureItemId];
    const activeCanvasNodeIds = structureItem?.canvasNodeId ? [structureItem.canvasNodeId] : [];

    return {
        activeStructureItemId: structureItem?.id,
        matchedStructureItemIds: structureItem ? [structureItem.id] : [],
        activeCanvasNodeIds
    };
}
import {
    appModelSchema,
    formatValidationIssues,
    type AppModel,
    type ComponentDefinition,
    type DialogDefinition,
    type LayoutDefinition,
    type RouteDefinition,
    type SlotDefinition,
    validateMountReference
} from "@node-red-contrib-webapp/schema";

export type RuntimeContributionKind = "app" | "layout" | "route" | "dialog" | "component";

interface RuntimeContributionBase {
    registrationId: string;
    source?: string;
}

export interface AppContribution extends RuntimeContributionBase {
    kind: "app";
    // P109: `name` replaces `title` in AppModel.
    definition: Pick<AppModel, "id" | "name">;
}

export interface LayoutContribution extends RuntimeContributionBase {
    kind: "layout";
    appId: string;
    definition: LayoutDefinition;
}

export interface RouteContribution extends RuntimeContributionBase {
    kind: "route";
    appId: string;
    definition: RouteDefinition;
}

export interface DialogContribution extends RuntimeContributionBase {
    kind: "dialog";
    appId: string;
    definition: DialogDefinition;
}

export interface ComponentContribution extends RuntimeContributionBase {
    kind: "component";
    appId: string;
    definition: ComponentDefinition;
}

export type RuntimeRegistryContribution =
    | AppContribution
    | LayoutContribution
    | RouteContribution
    | DialogContribution
    | ComponentContribution;

export interface RuntimeDiagnostic {
    severity: "error";
    code:
    | "missing-app"
    | "duplicate-app"
    | "duplicate-id"
    | "duplicate-route-path"
    | "unknown-layout"
    | "unknown-route"
    | "invalid-mount"
    | "invalid-model";
    message: string;
    appId: string;
    registrationIds: string[];
}

export interface CompilationResult {
    appId: string;
    model?: AppModel;
    diagnostics: RuntimeDiagnostic[];
}

type SortableContribution = RuntimeRegistryContribution & { appId: string };

function compareRegistrationIds(left: RuntimeRegistryContribution, right: RuntimeRegistryContribution): number {
    return left.registrationId.localeCompare(right.registrationId);
}

function toAppScopedContribution(contribution: RuntimeRegistryContribution): SortableContribution {
    if (contribution.kind === "app") {
        return {
            ...contribution,
            appId: contribution.definition.id
        };
    }

    return contribution;
}

function cloneLayout(layout: LayoutDefinition): LayoutDefinition {
    return {
        ...layout,
        slots: layout.slots.map((slot) => ({ ...slot }))
    };
}

function cloneRoute(route: RouteDefinition): RouteDefinition {
    return { ...route };
}

function cloneDialog(dialog: DialogDefinition): DialogDefinition {
    return { ...dialog };
}

function cloneComponent(component: ComponentDefinition): ComponentDefinition {
    return {
        ...component,
        bind: { ...component.bind },
        events: component.events.map((eventHandler) => ({ ...eventHandler })),
        props: { ...component.props }
    };
}

function findSlot(slots: SlotDefinition[], slotName: string): SlotDefinition | undefined {
    return slots.find((slot) => slot.name === slotName);
}

function hasSlotPath(layout: LayoutDefinition, regionPath: string[]): boolean {
    return regionPath.length === 1 && findSlot(layout.slots, regionPath[0]) !== undefined;
}

function dedupeByKey<T extends RuntimeRegistryContribution>(
    contributions: T[],
    keySelector: (contribution: T) => string,
    createDiagnostic: (duplicateGroup: T[], key: string) => RuntimeDiagnostic
): { kept: T[]; diagnostics: RuntimeDiagnostic[] } {
    const grouped = new Map<string, T[]>();

    for (const contribution of contributions) {
        const key = keySelector(contribution);
        const existing = grouped.get(key);

        if (existing) {
            existing.push(contribution);
            continue;
        }

        grouped.set(key, [contribution]);
    }

    const diagnostics: RuntimeDiagnostic[] = [];
    const kept: T[] = [];

    for (const [key, duplicateGroup] of grouped.entries()) {
        const sortedGroup = [...duplicateGroup].sort(compareRegistrationIds);
        kept.push(sortedGroup[0]);

        if (sortedGroup.length > 1) {
            diagnostics.push(createDiagnostic(sortedGroup, key));
        }
    }

    return {
        kept,
        diagnostics
    };
}

function normalizeComponents(components: ComponentDefinition[]): ComponentDefinition[] {
    return components.sort((left, right) => {
        const leftOrder = left.order ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = right.order ?? Number.MAX_SAFE_INTEGER;

        if (left.mount !== right.mount) {
            return left.mount.localeCompare(right.mount);
        }

        if (leftOrder !== rightOrder) {
            return leftOrder - rightOrder;
        }

        return left.id.localeCompare(right.id);
    });
}

export function createContributionsFromAppModel(appModel: AppModel, registrationPrefix = appModel.id): RuntimeRegistryContribution[] {
    return [
        {
            kind: "app",
            registrationId: `${registrationPrefix}:app`,
            definition: {
                id: appModel.id,
                // P109: `name` replaces `title`.
                name: appModel.name
            }
        },
        ...appModel.layouts.map<LayoutContribution>((layout) => ({
            kind: "layout",
            appId: appModel.id,
            registrationId: `${registrationPrefix}:layout:${layout.id}`,
            definition: cloneLayout(layout)
        })),
        ...appModel.routes.map<RouteContribution>((route) => ({
            kind: "route",
            appId: appModel.id,
            registrationId: `${registrationPrefix}:route:${route.id}`,
            definition: cloneRoute(route)
        })),
        ...appModel.dialogs.map<DialogContribution>((dialog) => ({
            kind: "dialog",
            appId: appModel.id,
            registrationId: `${registrationPrefix}:dialog:${dialog.id}`,
            definition: cloneDialog(dialog)
        })),
        ...appModel.components.map<ComponentContribution>((component) => ({
            kind: "component",
            appId: appModel.id,
            registrationId: `${registrationPrefix}:component:${component.id}`,
            definition: cloneComponent(component)
        }))
    ];
}

export class RuntimeRegistry {
    private readonly contributions = new Map<string, RuntimeRegistryContribution>();

    register(contribution: RuntimeRegistryContribution): void {
        this.contributions.set(contribution.registrationId, contribution);
    }

    registerMany(contributions: RuntimeRegistryContribution[]): void {
        for (const contribution of contributions) {
            this.register(contribution);
        }
    }

    unregister(registrationId: string): boolean {
        return this.contributions.delete(registrationId);
    }

    list(appId?: string): RuntimeRegistryContribution[] {
        const entries = [...this.contributions.values()].sort(compareRegistrationIds);

        if (!appId) {
            return entries;
        }

        return entries.filter((contribution) => toAppScopedContribution(contribution).appId === appId);
    }

    compile(appId: string): CompilationResult {
        const diagnostics: RuntimeDiagnostic[] = [];
        const contributions = this.list(appId).map(toAppScopedContribution);

        const appDefinitions = contributions.filter((contribution): contribution is AppContribution & { appId: string } => contribution.kind === "app");

        if (appDefinitions.length === 0) {
            return {
                appId,
                diagnostics: [
                    {
                        severity: "error",
                        code: "missing-app",
                        message: `No app contribution is registered for '${appId}'.`,
                        appId,
                        registrationIds: []
                    }
                ]
            };
        }

        const uniqueApps = dedupeByKey(appDefinitions, (contribution) => contribution.definition.id, (duplicateGroup, duplicateId) => ({
            severity: "error",
            code: "duplicate-app",
            message: `App '${duplicateId}' is registered more than once. The contribution '${duplicateGroup[0].registrationId}' wins deterministically.`,
            appId,
            registrationIds: duplicateGroup.map((contribution) => contribution.registrationId)
        }));

        diagnostics.push(...uniqueApps.diagnostics);

        const appDefinition = uniqueApps.kept[0]?.definition;

        if (!appDefinition) {
            return {
                appId,
                diagnostics
            };
        }

        const rawLayouts = contributions.filter((contribution): contribution is LayoutContribution => contribution.kind === "layout");
        const rawRoutes = contributions.filter((contribution): contribution is RouteContribution => contribution.kind === "route");
        const rawDialogs = contributions.filter((contribution): contribution is DialogContribution => contribution.kind === "dialog");
        const rawComponents = contributions.filter((contribution): contribution is ComponentContribution => contribution.kind === "component");

        const uniqueLayouts = dedupeByKey(rawLayouts, (contribution) => contribution.definition.id, (duplicateGroup, duplicateId) => ({
            severity: "error",
            code: "duplicate-id",
            message: `Layout '${duplicateId}' is registered more than once. The contribution '${duplicateGroup[0].registrationId}' wins deterministically.`,
            appId,
            registrationIds: duplicateGroup.map((contribution) => contribution.registrationId)
        }));
        diagnostics.push(...uniqueLayouts.diagnostics);

        const uniqueRoutesById = dedupeByKey(rawRoutes, (contribution) => contribution.definition.id, (duplicateGroup, duplicateId) => ({
            severity: "error",
            code: "duplicate-id",
            message: `Route '${duplicateId}' is registered more than once. The contribution '${duplicateGroup[0].registrationId}' wins deterministically.`,
            appId,
            registrationIds: duplicateGroup.map((contribution) => contribution.registrationId)
        }));
        diagnostics.push(...uniqueRoutesById.diagnostics);

        const uniqueRoutes = dedupeByKey(uniqueRoutesById.kept, (contribution) => contribution.definition.path, (duplicateGroup, duplicatePath) => ({
            severity: "error",
            code: "duplicate-route-path",
            message: `Route path '${duplicatePath}' is registered more than once. The contribution '${duplicateGroup[0].registrationId}' wins deterministically.`,
            appId,
            registrationIds: duplicateGroup.map((contribution) => contribution.registrationId)
        }));
        diagnostics.push(...uniqueRoutes.diagnostics);

        const uniqueDialogs = dedupeByKey(rawDialogs, (contribution) => contribution.definition.id, (duplicateGroup, duplicateId) => ({
            severity: "error",
            code: "duplicate-id",
            message: `Dialog '${duplicateId}' is registered more than once. The contribution '${duplicateGroup[0].registrationId}' wins deterministically.`,
            appId,
            registrationIds: duplicateGroup.map((contribution) => contribution.registrationId)
        }));
        diagnostics.push(...uniqueDialogs.diagnostics);

        const uniqueComponents = dedupeByKey(rawComponents, (contribution) => contribution.definition.id, (duplicateGroup, duplicateId) => ({
            severity: "error",
            code: "duplicate-id",
            message: `Component '${duplicateId}' is registered more than once. The contribution '${duplicateGroup[0].registrationId}' wins deterministically.`,
            appId,
            registrationIds: duplicateGroup.map((contribution) => contribution.registrationId)
        }));
        diagnostics.push(...uniqueComponents.diagnostics);

        const layouts = uniqueLayouts.kept.map((contribution) => cloneLayout(contribution.definition)).sort((left, right) => left.id.localeCompare(right.id));
        const layoutIds = new Set(layouts.map((layout) => layout.id));

        const routes = uniqueRoutes.kept
            .filter((contribution) => {
                if (layoutIds.has(contribution.definition.layoutId)) {
                    return true;
                }

                diagnostics.push({
                    severity: "error",
                    code: "unknown-layout",
                    message: `Route '${contribution.definition.id}' references unknown layout '${contribution.definition.layoutId}'.`,
                    appId,
                    registrationIds: [contribution.registrationId]
                });

                return false;
            })
            .map((contribution) => cloneRoute(contribution.definition))
            .sort((left, right) => left.path.localeCompare(right.path) || left.id.localeCompare(right.id));

        const routeIds = new Set(routes.map((route) => route.id));

        const dialogs = uniqueDialogs.kept
            .filter((contribution) => {
                if (!layoutIds.has(contribution.definition.layoutId)) {
                    diagnostics.push({
                        severity: "error",
                        code: "unknown-layout",
                        message: `Dialog '${contribution.definition.id}' references unknown layout '${contribution.definition.layoutId}'.`,
                        appId,
                        registrationIds: [contribution.registrationId]
                    });

                    return false;
                }

                if (contribution.definition.routeId && !routeIds.has(contribution.definition.routeId)) {
                    diagnostics.push({
                        severity: "error",
                        code: "unknown-route",
                        message: `Dialog '${contribution.definition.id}' references unknown route '${contribution.definition.routeId}'.`,
                        appId,
                        registrationIds: [contribution.registrationId]
                    });

                    return false;
                }

                return true;
            })
            .map((contribution) => cloneDialog(contribution.definition))
            .sort((left, right) => left.id.localeCompare(right.id));

        const candidateModel: AppModel = {
            id: appDefinition.id,
            // P109: `name` replaces `title`.
            name: appDefinition.name,
            layouts,
            routes,
            dialogs,
            components: []
        };

        const layoutById = new Map(candidateModel.layouts.map((layout) => [layout.id, layout]));
        const components = uniqueComponents.kept
            .filter((contribution) => {
                const resolvedMount = validateMountReference(contribution.definition.mount, candidateModel);

                if (!resolvedMount.success) {
                    diagnostics.push({
                        severity: "error",
                        code: "invalid-mount",
                        message: `Component '${contribution.definition.id}' has an invalid mount '${contribution.definition.mount}': ${resolvedMount.error}`,
                        appId,
                        registrationIds: [contribution.registrationId]
                    });

                    return false;
                }

                const layout = layoutById.get(resolvedMount.data.layoutId);

                if (!layout || !hasSlotPath(layout, resolvedMount.data.regionPath)) {
                    diagnostics.push({
                        severity: "error",
                        code: "invalid-mount",
                        message: `Component '${contribution.definition.id}' mounts into missing slot path '${resolvedMount.data.regionPath.join("/")}' on layout '${resolvedMount.data.layoutId}'. Nested slot paths are not supported; use a ui-container with a child layout.`,
                        appId,
                        registrationIds: [contribution.registrationId]
                    });

                    return false;
                }

                return true;
            })
            .map((contribution) => cloneComponent(contribution.definition));

        const normalizedModel: AppModel = {
            ...candidateModel,
            components: normalizeComponents(components)
        };

        const validationResult = appModelSchema.safeParse(normalizedModel);

        if (!validationResult.success) {
            diagnostics.push({
                severity: "error",
                code: "invalid-model",
                message: formatValidationIssues(validationResult.error.issues),
                appId,
                registrationIds: []
            });

            return {
                appId,
                diagnostics
            };
        }

        return {
            appId,
            model: validationResult.data,
            diagnostics
        };
    }
}

export function createRuntimeRegistry(): RuntimeRegistry {
    return new RuntimeRegistry();
}
import {
    resolveMountReference,
    uiEventMessageSchema,
    type AppModel,
    type BindingDefinition,
    type ComponentDefinition,
    type LayoutDefinition,
    type NavigationDefinition,
    type QueryDefinition,
    type RouteDefinition,
    type RuntimeIntegrationModel,
    type SlotDefinition,
    type UiEventMessage
} from "@node-red-contrib-webapp/schema";

type UiEventName = UiEventMessage["ui"]["event"];

export interface RendererAppOptions {
    integration?: RuntimeIntegrationModel;
    location?: string;
    state?: Record<string, unknown>;
    queries?: Record<string, unknown>;
}

export interface RenderedEventBinding {
    event: UiEventName;
    // action is optional since P20a — click events on buttons are routed via wiring,
    // not by a string action reference.
    action?: string;
}

interface RenderedComponentBase {
    id: string;
    kind: ComponentDefinition["kind"];
    mount: string;
    props: Record<string, unknown>;
    events: RenderedEventBinding[];
    disabled: boolean;
}

export interface RenderedTextComponent extends RenderedComponentBase {
    kind: "text";
    text: string;
}

export interface RenderedButtonComponent extends RenderedComponentBase {
    kind: "button";
    label: string;
}

export interface RenderedTableComponent extends RenderedComponentBase {
    kind: "table";
    columns: string[];
    rows: Record<string, unknown>[];
}

export interface RenderedCardComponent extends RenderedComponentBase {
    kind: "card";
    title?: string;
    data: unknown;
}

export interface RenderedContainerComponent extends RenderedComponentBase {
    kind: "container";
    layoutId: string;
    title?: string;
    regions: RenderedRegion[];
}

export interface RenderedInputComponent extends RenderedComponentBase {
    kind: "input";
    value: unknown;
}

export type RenderedComponent =
    | RenderedButtonComponent
    | RenderedCardComponent
    | RenderedContainerComponent
    | RenderedInputComponent
    | RenderedTableComponent
    | RenderedTextComponent;

export interface RenderedRegion {
    kind: "region";
    name: string;
    title?: string;
    components: RenderedComponent[];
    regions: RenderedRegion[];
}

export interface RenderedDialog {
    id: string;
    title?: string;
    modal: boolean;
    open: boolean;
    layoutId: string;
    regions: RenderedRegion[];
}

export interface RouteMatch {
    route: RouteDefinition;
    params: Record<string, string>;
}

export interface RenderSnapshot {
    appId: string;
    title: string;
    location: string;
    route: RouteDefinition;
    params: Record<string, string>;
    layout: LayoutDefinition;
    regions: RenderedRegion[];
    dialogs: RenderedDialog[];
}

export interface DispatchResult {
    message: UiEventMessage;
    snapshot: RenderSnapshot;
}

export interface RendererApp {
    render(): RenderSnapshot;
    navigate(location: string): RenderSnapshot;
    replaceState(nextState: Record<string, unknown>): RenderSnapshot;
    replaceQueries(nextQueries: Record<string, unknown>): RenderSnapshot;
    dispatchEvent(componentId: string, event: UiEventName, payload?: Record<string, unknown>): DispatchResult;
}

interface BindingSources {
    state: Record<string, unknown>;
    queries: Record<string, unknown>;
    params: Record<string, string>;
}

interface ComponentRenderContext {
    sources: BindingSources;
}

function getObjectRecord(input: unknown): Record<string, unknown> {
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
        return {};
    }

    return input as Record<string, unknown>;
}

function getValueAtPath(source: unknown, path: string | undefined): unknown {
    if (!path) {
        return undefined;
    }

    return path.split(".").reduce<unknown>((currentValue, segment) => {
        if (typeof currentValue !== "object" || currentValue === null || Array.isArray(currentValue)) {
            return undefined;
        }

        return (currentValue as Record<string, unknown>)[segment];
    }, source);
}

function setValueAtPath(source: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
    const segments = path.split(".").filter(Boolean);

    if (segments.length === 0) {
        return source;
    }

    const cloneRoot = { ...source };
    let currentTarget: Record<string, unknown> = cloneRoot;

    segments.forEach((segment, index) => {
        const isLeaf = index === segments.length - 1;

        if (isLeaf) {
            currentTarget[segment] = value;
            return;
        }

        const nextTarget = getObjectRecord(currentTarget[segment]);
        currentTarget[segment] = { ...nextTarget };
        currentTarget = currentTarget[segment] as Record<string, unknown>;
    });

    return cloneRoot;
}

function applyStatePatch(currentState: Record<string, unknown>, statePatch: Record<string, unknown>): Record<string, unknown> {
    return Object.entries(statePatch).reduce<Record<string, unknown>>((nextState, [path, value]) => setValueAtPath(nextState, path, value), currentState);
}

function resolveBinding(binding: BindingDefinition | undefined, sources: BindingSources): unknown {
    if (!binding) {
        return undefined;
    }

    let resolvedValue: unknown;

    switch (binding.kind) {
        case "literal":
            resolvedValue = binding.value;
            break;
        case "query":
            resolvedValue = getValueAtPath(sources.queries, binding.path);
            break;
        case "routeParam":
            resolvedValue = binding.path ? sources.params[binding.path] : undefined;
            break;
        case "state":
            resolvedValue = getValueAtPath(sources.state, binding.path);
            break;
    }

    return resolvedValue === undefined ? binding.fallback : resolvedValue;
}

function matchesCondition(binding: BindingDefinition | undefined, sources: BindingSources, defaultValue: boolean): boolean {
    const resolvedValue = resolveBinding(binding, sources);

    if (resolvedValue === undefined) {
        return defaultValue;
    }

    return Boolean(resolvedValue);
}

function asStringArray(input: unknown): string[] {
    return Array.isArray(input) ? input.filter((value): value is string => typeof value === "string") : [];
}

function asRecordArray(input: unknown): Record<string, unknown>[] {
    return Array.isArray(input)
        ? input
            .map((entry) => getObjectRecord(entry))
            .filter((entry) => Object.keys(entry).length > 0)
        : [];
}

function findLayout(appModel: AppModel, layoutId: string): LayoutDefinition {
    const layout = appModel.layouts.find((candidate) => candidate.id === layoutId);

    if (!layout) {
        throw new Error(`Renderer cannot find layout '${layoutId}'.`);
    }

    return layout;
}

function escapeRegExp(input: string): string {
    return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchRoute(location: string, routes: RouteDefinition[]): RouteMatch {
    const normalizedLocation = location.startsWith("/") ? location : `/${location}`;

    const matches = routes
        .map((route) => {
            const paramNames: string[] = [];
            const pattern = route.path
                .split("/")
                .map((segment) => {
                    if (segment.startsWith(":")) {
                        paramNames.push(segment.slice(1));
                        return "([^/]+)";
                    }

                    return escapeRegExp(segment);
                })
                .join("/");
            const matcher = new RegExp(`^${pattern}$`);
            const result = matcher.exec(normalizedLocation);

            if (!result) {
                return undefined;
            }

            const params = paramNames.reduce<Record<string, string>>((accumulator, paramName, index) => {
                accumulator[paramName] = result[index + 1] ?? "";
                return accumulator;
            }, {});

            return {
                route,
                params
            };
        })
        .filter((value): value is RouteMatch => value !== undefined)
        .sort((left, right) => right.route.path.length - left.route.path.length);

    const bestMatch = matches[0];

    if (!bestMatch) {
        throw new Error(`Renderer cannot match location '${location}' to any route.`);
    }

    return bestMatch;
}

function isDialogOpen(state: Record<string, unknown>, dialogId: string): boolean {
    return getValueAtPath(state, `ui.dialogs.${dialogId}.open`) === true;
}

function normalizeIntegration(integration: RuntimeIntegrationModel | undefined): RuntimeIntegrationModel {
    return {
        stores: integration?.stores ?? [],
        queries: integration?.queries ?? [],
        actions: integration?.actions ?? [],
        navigations: integration?.navigations ?? []
    };
}

function initializeState(
    baseState: Record<string, unknown>,
    queryState: Record<string, unknown>,
    integration: RuntimeIntegrationModel
): Record<string, unknown> {
    let nextState = { ...baseState };

    for (const store of integration.stores) {
        if (store.initialValue === undefined || getValueAtPath(nextState, store.statePath) !== undefined) {
            continue;
        }

        nextState = setValueAtPath(nextState, store.statePath, store.initialValue);
    }

    for (const query of integration.queries) {
        const hasData = getValueAtPath(queryState, query.queryPath) !== undefined;
        const loadingPath = `ui.queries.${query.id}.loading`;
        const statusPath = `ui.queries.${query.id}.status`;

        if (getValueAtPath(nextState, loadingPath) === undefined) {
            nextState = setValueAtPath(nextState, loadingPath, false);
        }

        if (getValueAtPath(nextState, statusPath) === undefined) {
            nextState = setValueAtPath(nextState, statusPath, hasData ? "success" : "idle");
        }
    }

    return nextState;
}

function syncQueryState(currentState: Record<string, unknown>, queryState: Record<string, unknown>, integration: RuntimeIntegrationModel): Record<string, unknown> {
    let nextState = currentState;

    for (const query of integration.queries) {
        const hasData = getValueAtPath(queryState, query.queryPath) !== undefined;
        nextState = setValueAtPath(nextState, `ui.queries.${query.id}.loading`, false);
        nextState = setValueAtPath(nextState, `ui.queries.${query.id}.status`, hasData ? "success" : "idle");
    }

    return nextState;
}

function findTriggeredQueries(action: string | undefined, integration: RuntimeIntegrationModel): QueryDefinition[] {
    if (!action) {
        return [];
    }

    return integration.queries.filter((query) => query.refreshAction === action);
}

function findNavigation(action: string | undefined, integration: RuntimeIntegrationModel): NavigationDefinition | undefined {
    if (!action) {
        return undefined;
    }

    return integration.navigations.find((navigation) => navigation.id === action);
}

function resolveNavigationTarget(
    navigation: NavigationDefinition,
    payload: Record<string, unknown>,
    currentParams: Record<string, string>
): string {
    return navigation.to
        .split("/")
        .map((segment) => {
            if (!segment.startsWith(":")) {
                return segment;
            }

            const paramName = segment.slice(1);
            const payloadParams = getObjectRecord(payload.params);
            const payloadRow = getObjectRecord(payload.row);
            const payloadValues = getObjectRecord(payload.values);
            const resolvedValue = payloadParams[paramName] ?? payloadRow[paramName] ?? payloadValues[paramName] ?? payload[paramName] ?? currentParams[paramName];

            if (resolvedValue === undefined) {
                throw new Error(`Renderer cannot resolve navigation parameter '${paramName}' for '${navigation.id}'.`);
            }

            return encodeURIComponent(String(resolvedValue));
        })
        .join("/");
}

function toRenderedComponent(component: ComponentDefinition, context: ComponentRenderContext, appModel: AppModel): RenderedComponent | undefined {
    const visible = matchesCondition(component.visibleIf, context.sources, true);

    if (!visible) {
        return undefined;
    }

    const disabledBinding = resolveBinding(component.bind.disabled, context.sources);
    const enabled = matchesCondition(component.enabledIf, context.sources, true);
    const resolvedProps: Record<string, unknown> = { ...component.props };

    for (const [key, binding] of Object.entries(component.bind)) {
        resolvedProps[key] = resolveBinding(binding, context.sources);
    }

    const baseComponent: RenderedComponentBase = {
        id: component.id,
        kind: component.kind,
        mount: component.mount,
        props: resolvedProps,
        events: component.events,
        disabled: !enabled || Boolean(disabledBinding)
    };

    switch (component.kind) {
        case "text":
            return {
                ...baseComponent,
                kind: "text",
                text: String(resolvedProps.value ?? resolvedProps.text ?? "")
            };
        case "button":
            return {
                ...baseComponent,
                kind: "button",
                label: String(resolvedProps.label ?? component.id)
            };
        case "table":
            return {
                ...baseComponent,
                kind: "table",
                columns: asStringArray(resolvedProps.columns),
                rows: asRecordArray(resolvedProps.rows)
            };
        case "card":
            return {
                ...baseComponent,
                kind: "card",
                title: typeof resolvedProps.title === "string" ? resolvedProps.title : undefined,
                data: resolvedProps.customer ?? resolvedProps.data
            };
        case "container": {
            const layoutId = typeof resolvedProps.layoutId === "string" ? resolvedProps.layoutId : undefined;

            if (!layoutId) {
                return undefined;
            }

            const layout = findLayout(appModel, layoutId);

            return {
                ...baseComponent,
                kind: "container",
                layoutId,
                title: typeof resolvedProps.title === "string" ? resolvedProps.title : undefined,
                regions: renderRegions(
                    layout.slots,
                    createContainerMountMatcher(appModel, component.id, layoutId),
                    appModel,
                    context
                )
            };
        }
        case "input":
            return {
                ...baseComponent,
                kind: "input",
                value: resolvedProps.value
            };
    }
}

function componentSort(left: ComponentDefinition, right: ComponentDefinition): number {
    const leftOrder = left.order ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.order ?? Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
    }

    return left.id.localeCompare(right.id);
}

function renderRegions(
    slotDefinitions: SlotDefinition[],
    shouldIncludeMount: (component: ComponentDefinition, regionPath: string[]) => boolean,
    appModel: AppModel,
    context: ComponentRenderContext
): RenderedRegion[] {
    return slotDefinitions.map((slotDefinition) => {
        const regionPath = [slotDefinition.name];
        const mountedComponents = appModel.components
            .filter((component) => shouldIncludeMount(component, regionPath))
            .sort(componentSort)
            .map((component) => toRenderedComponent(component, context, appModel))
            .filter((component): component is RenderedComponent => component !== undefined);

        return {
            kind: "region",
            name: slotDefinition.name,
            title: slotDefinition.title,
            components: mountedComponents,
            regions: []
        };
    });
}

function createMountMatcher(
    appModel: AppModel,
    targets: Array<{
        scope: "route" | "dialog" | "layout";
        targetId: string;
    }>
): (component: ComponentDefinition, regionPath: string[]) => boolean {
    return (component, regionPath) => {
        const resolvedMount = resolveMountReference(component.mount, appModel);

        if (!resolvedMount.success) {
            return false;
        }

        const regionKey = regionPath.join("/");

        return targets.some(
            (target) =>
                resolvedMount.data.scope === target.scope &&
                resolvedMount.data.targetId === target.targetId &&
                resolvedMount.data.regionPath.join("/") === regionKey
        );
    };
}

// Container children are addressed either by the container's own id
// (`container:<id>/<region>`, the form the editor emits) or by the container's
// layout id (`layout:<layoutId>/<region>`, the form the typed fixture uses).
// Both resolve to the same rendered region; mount resolution lives only here.
function createContainerMountMatcher(
    appModel: AppModel,
    containerId: string,
    layoutId: string
): (component: ComponentDefinition, regionPath: string[]) => boolean {
    const layoutMatcher = createMountMatcher(appModel, [{ scope: "layout", targetId: layoutId }]);

    return (component, regionPath) => {
        const rawMount = component.mount.trim();

        if (rawMount.startsWith("container:")) {
            const separatorIndex = rawMount.indexOf("/");

            if (separatorIndex < 0) {
                return false;
            }

            const targetContainerId = rawMount.slice("container:".length, separatorIndex);
            const regionKey = rawMount.slice(separatorIndex + 1);

            return targetContainerId === containerId && regionKey === regionPath.join("/");
        }

        return layoutMatcher(component, regionPath);
    };
}

function flattenRegions(regions: RenderedRegion[]): RenderedComponent[] {
    return regions.flatMap((region) => region.components.flatMap((component) => {
        if (component.kind === "container") {
            return [component, ...flattenRegions(component.regions)];
        }

        return [component];
    }));
}

function inferDialogTransition(action: string | undefined, appModel: AppModel): { dialogId: string; open: boolean } | undefined {
    if (!action) {
        return undefined;
    }

    const lowerAction = action.toLowerCase();
    const transition = lowerAction.startsWith("open") ? true : lowerAction.startsWith("close") ? false : undefined;

    if (transition === undefined) {
        return undefined;
    }

    const suffix = action.slice(transition ? 4 : 5);

    if (!suffix) {
        return undefined;
    }

    const dialogId = `${suffix.slice(0, 1).toLowerCase()}${suffix.slice(1)}`;

    return appModel.dialogs.some((dialog) => dialog.id === dialogId)
        ? {
            dialogId,
            open: transition
        }
        : undefined;
}

function findRenderedComponent(snapshot: RenderSnapshot, componentId: string): RenderedComponent | undefined {
    return [...flattenRegions(snapshot.regions), ...snapshot.dialogs.flatMap((dialog) => flattenRegions(dialog.regions))].find(
        (component) => component.id === componentId
    );
}

export function createRendererApp(appModel: AppModel, options: RendererAppOptions = {}): RendererApp {
    const integration = normalizeIntegration(options.integration);
    let location = options.location ?? appModel.routes[0]?.path ?? "/";
    let queries = options.queries ?? {};
    let state = initializeState(options.state ?? {}, queries, integration);

    function render(): RenderSnapshot {
        const routeMatch = matchRoute(location, appModel.routes);
        const layout = findLayout(appModel, routeMatch.route.layoutId);
        const context: ComponentRenderContext = {
            sources: {
                state,
                queries,
                params: routeMatch.params
            }
        };
        const dialogs = appModel.dialogs
            .filter((dialog) => !dialog.routeId || dialog.routeId === routeMatch.route.id)
            .filter((dialog) => isDialogOpen(state, dialog.id))
            .map<RenderedDialog>((dialog) => ({
                id: dialog.id,
                title: dialog.title,
                modal: dialog.modal,
                open: true,
                layoutId: dialog.layoutId,
                regions: renderRegions(
                    findLayout(appModel, dialog.layoutId).slots,
                    createMountMatcher(appModel, [
                        { scope: "dialog", targetId: dialog.id },
                        { scope: "layout", targetId: dialog.layoutId }
                    ]),
                    appModel,
                    context
                )
            }));

        return {
            appId: appModel.id,
            title: appModel.title,
            location,
            route: routeMatch.route,
            params: routeMatch.params,
            layout,
            regions: renderRegions(
                layout.slots,
                createMountMatcher(appModel, [
                    { scope: "route", targetId: routeMatch.route.id },
                    { scope: "layout", targetId: layout.id }
                ]),
                appModel,
                context
            ),
            dialogs
        };
    }

    function replaceState(nextState: Record<string, unknown>): RenderSnapshot {
        state = initializeState(nextState, queries, integration);
        return render();
    }

    function replaceQueries(nextQueries: Record<string, unknown>): RenderSnapshot {
        queries = nextQueries;
        state = syncQueryState(state, queries, integration);
        return render();
    }

    function navigate(nextLocation: string): RenderSnapshot {
        location = nextLocation;
        return render();
    }

    function dispatchEvent(componentId: string, event: UiEventName, payload: Record<string, unknown> = {}): DispatchResult {
        const snapshotBeforeDispatch = render();
        const renderedComponent = findRenderedComponent(snapshotBeforeDispatch, componentId);

        if (!renderedComponent) {
            throw new Error(`Renderer cannot dispatch '${event}' for missing component '${componentId}'.`);
        }

        if (renderedComponent.disabled) {
            throw new Error(`Renderer cannot dispatch '${event}' for disabled component '${componentId}'.`);
        }

        const sourceComponent = appModel.components.find((component) => component.id === componentId);
        const eventBinding = sourceComponent?.events.find((candidate) => candidate.event === event);
        const action = eventBinding?.action;
        const triggeredQueries = findTriggeredQueries(action, integration);
        const navigation = findNavigation(action, integration);
        const statePatch: Record<string, unknown> = getObjectRecord(payload.statePatch);
        const nextPayload: Record<string, unknown> = {
            ...payload
        };

        if (action) {
            nextPayload.action = action;
        }

        if (
            sourceComponent?.kind === "input" &&
            event === "change" &&
            sourceComponent.bind.value?.kind === "state" &&
            sourceComponent.bind.value.path &&
            payload.value !== undefined
        ) {
            statePatch[sourceComponent.bind.value.path] = payload.value;
        }

        const dialogTransition = inferDialogTransition(action, appModel);

        if (dialogTransition) {
            statePatch[`ui.dialogs.${dialogTransition.dialogId}.open`] = dialogTransition.open;
        }

        for (const triggeredQuery of triggeredQueries) {
            const hasCachedData = getValueAtPath(queries, triggeredQuery.queryPath) !== undefined;
            statePatch[`ui.queries.${triggeredQuery.id}.loading`] = true;
            statePatch[`ui.queries.${triggeredQuery.id}.status`] = hasCachedData ? "refreshing" : "loading";
        }

        state = applyStatePatch(state, statePatch);

        const navigationTarget = navigation ? resolveNavigationTarget(navigation, payload, snapshotBeforeDispatch.params) : undefined;

        if (navigationTarget) {
            location = navigationTarget;
        }

        const message = uiEventMessageSchema.parse({
            ui: {
                event,
                componentId,
                action,
                route: snapshotBeforeDispatch.location,
                params: snapshotBeforeDispatch.params,
                statePatch,
                payload: nextPayload,
                dialog: dialogTransition
                    ? {
                        id: dialogTransition.dialogId,
                        open: dialogTransition.open
                    }
                    : undefined,
                navigation: navigation && navigationTarget
                    ? {
                        id: navigation.id,
                        to: navigationTarget
                    }
                    : undefined,
                queries: triggeredQueries.map((query) => ({
                    id: query.id,
                    queryPath: query.queryPath,
                    mode: getValueAtPath(queries, query.queryPath) !== undefined ? "refresh" : "load"
                }))
            }
        });

        return {
            message,
            snapshot: render()
        };
    }

    return {
        render,
        navigate,
        replaceQueries,
        replaceState,
        dispatchEvent
    };
}

export function findComponentInSnapshot(snapshot: RenderSnapshot, componentId: string): RenderedComponent | undefined {
    return findRenderedComponent(snapshot, componentId);
}

export function matchRouteLocation(location: string, appModel: AppModel): RouteMatch {
    return matchRoute(location, appModel.routes);
}
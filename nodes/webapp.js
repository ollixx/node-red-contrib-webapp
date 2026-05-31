"use strict";

const fs = require("fs");
const path = require("path");
const {
    appModelSchema,
    collectMissingStandardLayouts,
    createAppRootRoute,
    uiEventMessageSchema,
    validateUiNodeDefinition
} = require("../packages/schema/dist/index.js");
const { createRendererApp } = require("../packages/renderer/dist/index.js");

const runtimeState = {
    definitions: new Map(),
    previewState: new Map(),
    previewQueries: new Map(),
    previewMessages: new Map(),
    queryEtags: new Map(),
    // clientStateMap: appId → Map<clientId, { state, timestamp }>
    clientStateMap: new Map(),
    endpointsRegistered: false
};

const WEBAPP_NODE_TYPES = new Set([
    "ui-app",
    "ui-route",
    "ui-dialog",
    "ui-text",
    "ui-button",
    "ui-table",
    "ui-container",
    "ui-input",
    "ui-select",
    "ui-checkbox",
    "ui-radio",
    "ui-switch",
    "ui-textarea",
    "ui-datepicker",
    "ui-slider",
    "ui-store",
    "ui-query",
    "ui-action",
    "ui-navigation",
    "ui-alert",
    "ui-toast",
    "ui-progress",
    "ui-skeleton",
    "ui-badge",
    "ui-empty-state",
    "ui-tabs",
    "ui-accordion",
    "ui-breadcrumb",
    "ui-menu",
    "ui-pagination",
    "ui-stepper",
    "ui-image",
    "ui-icon",
    "ui-list",
    "ui-avatar",
    "ui-divider"
]);

function parseList(value) {
    if (Array.isArray(value)) {
        return value.filter(Boolean).map((entry) => String(entry).trim()).filter(Boolean);
    }

    if (typeof value !== "string") {
        return [];
    }

    return value
        .split(/\r?\n|,/)
        .map((entry) => entry.trim())
        .filter(Boolean);
}

function parseJsonList(value) {
    if (Array.isArray(value)) {
        return value;
    }

    if (typeof value !== "string" || value.trim().length === 0) {
        return [];
    }

    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch (_e) {
        return parseList(value);
    }
}

function parseColumns(value) {
    const raw = Array.isArray(value) ? value : parseList(value);
    return raw.map((entry) => {
        if (typeof entry === "string") {
            return { key: entry, label: entry };
        }
        if (entry && typeof entry === "object" && entry.key) {
            return {
                key: String(entry.key),
                label: entry.label !== undefined ? String(entry.label) : String(entry.key),
                type: entry.type || undefined,
                sortable: entry.sortable !== undefined ? Boolean(entry.sortable) : undefined,
                filterable: entry.filterable !== undefined ? Boolean(entry.filterable) : undefined,
                width: entry.width !== undefined ? Number(entry.width) : undefined
            };
        }
        return null;
    }).filter(Boolean);
}

function parseJson(value) {
    if (value === undefined || value === null || value === "") {
        return undefined;
    }

    if (typeof value !== "string") {
        return value;
    }

    try {
        return JSON.parse(value);
    }
    catch {
        return value;
    }
}

function literalBinding(value) {
    return {
        kind: "literal",
        value
    };
}

function stateBinding(path) {
    return {
        kind: "state",
        path
    };
}

function queryBinding(path) {
    return {
        kind: "query",
        path
    };
}

function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function customerDraftFromRecord(record) {
    const source = record && typeof record === "object" ? record : {};
    return {
        name: String(source.name || ""),
        email: String(source.email || ""),
        status: String(source.status || "draft")
    };
}

function isPlainObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeDeep(base, override) {
    if (!isPlainObject(base) || !isPlainObject(override)) {
        return override === undefined ? base : override;
    }

    const result = { ...base };

    Object.entries(override).forEach(([key, value]) => {
        result[key] = key in base ? mergeDeep(base[key], value) : clone(value);
    });

    return result;
}

function toOptionalNumber(value) {
    return value === "" || value === undefined || value === null ? undefined : Number(value);
}

function collectNodeConfigLayoutProps(source) {
    const row = toOptionalNumber(source.row);
    const col = toOptionalNumber(source.col);
    const colSize = toOptionalNumber(source.colSize !== undefined ? source.colSize : source.col_size);
    const rowSize = toOptionalNumber(source.rowSize !== undefined ? source.rowSize : source.row_size);
    const x = toOptionalNumber(source.layoutX !== undefined ? source.layoutX : source.layout_x);
    const y = toOptionalNumber(source.layoutY !== undefined ? source.layoutY : source.layout_y);

    return {
        ...(row !== undefined ? { row } : {}),
        ...(col !== undefined ? { col } : {}),
        ...(colSize !== undefined ? { colSize } : {}),
        ...(rowSize !== undefined ? { rowSize } : {}),
        ...(x !== undefined ? { x } : {}),
        ...(y !== undefined ? { y } : {})
    };
}

function collectNormalizedLayoutProps(source) {
    const row = toOptionalNumber(source.row);
    const col = toOptionalNumber(source.col);
    const colSize = toOptionalNumber(source.colSize);
    const rowSize = toOptionalNumber(source.rowSize);
    const x = toOptionalNumber(source.x);
    const y = toOptionalNumber(source.y);

    return {
        ...(row !== undefined ? { row } : {}),
        ...(col !== undefined ? { col } : {}),
        ...(colSize !== undefined ? { colSize } : {}),
        ...(rowSize !== undefined ? { rowSize } : {}),
        ...(x !== undefined ? { x } : {}),
        ...(y !== undefined ? { y } : {})
    };
}

function blankToUndefined(value) {
    if (value === undefined || value === null) {
        return undefined;
    }

    return typeof value === "string" && value.trim() === "" ? undefined : value;
}

function getValueAtPath(source, path) {
    if (!path) {
        return undefined;
    }

    return String(path).split(".").reduce((currentValue, segment) => {
        if (typeof currentValue !== "object" || currentValue === null || Array.isArray(currentValue)) {
            return undefined;
        }

        return currentValue[segment];
    }, source);
}

function setValueAtPath(source, path, value) {
    const segments = String(path).split(".").filter(Boolean);

    if (segments.length === 0) {
        return source;
    }

    const cloneRoot = { ...source };
    let currentTarget = cloneRoot;

    segments.forEach((segment, index) => {
        if (index === segments.length - 1) {
            currentTarget[segment] = value;
            return;
        }

        const nextTarget = currentTarget[segment] && typeof currentTarget[segment] === "object" && !Array.isArray(currentTarget[segment])
            ? currentTarget[segment]
            : {};
        currentTarget[segment] = { ...nextTarget };
        currentTarget = currentTarget[segment];
    });

    return cloneRoot;
}

function deleteValueAtPath(source, path) {
    const segments = String(path).split(".").filter(Boolean);

    if (segments.length === 0) {
        return source;
    }

    const cloneRoot = { ...source };
    let currentTarget = cloneRoot;

    for (let index = 0; index < segments.length - 1; index += 1) {
        const segment = segments[index];

        if (typeof currentTarget[segment] !== "object" || currentTarget[segment] === null || Array.isArray(currentTarget[segment])) {
            return cloneRoot;
        }

        currentTarget[segment] = { ...currentTarget[segment] };
        currentTarget = currentTarget[segment];
    }

    delete currentTarget[segments[segments.length - 1]];

    return cloneRoot;
}

function joinStatePath(rootPath, relativePath) {
    const normalizedRoot = blankToUndefined(rootPath);
    const normalizedRelative = blankToUndefined(relativePath);

    if (!normalizedRoot) {
        return normalizedRelative || "";
    }

    if (!normalizedRelative) {
        return normalizedRoot;
    }

    return `${normalizedRoot}.${normalizedRelative}`;
}

function normalizeStoreOperationMessage(msg, storeDefinition) {
    const candidate = msg && msg.ui && msg.ui.store && typeof msg.ui.store === "object"
        ? msg.ui.store
        : undefined;

    if (!candidate || candidate.id !== storeDefinition.id || typeof candidate.op !== "string") {
        return undefined;
    }

    return {
        id: candidate.id,
        op: candidate.op,
        path: blankToUndefined(candidate.path),
        value: candidate.value
    };
}

function applyStoreOperation(currentState, storeDefinition, operation) {
    const storeRootPath = storeDefinition.statePath;
    const fullPath = joinStatePath(storeRootPath, operation.path);
    const previousValue = clone(getValueAtPath(currentState, fullPath || storeRootPath));
    let nextState = currentState;
    let nextValue;

    if (operation.op === "reset") {
        nextState = setValueAtPath(currentState, storeRootPath, clone(storeDefinition.initialValue));
        nextValue = clone(storeDefinition.initialValue);
    }
    else if (operation.op === "replace") {
        nextState = setValueAtPath(currentState, storeRootPath, clone(operation.value));
        nextValue = clone(operation.value);
    }
    else if (operation.op === "set") {
        nextState = setValueAtPath(currentState, fullPath, clone(operation.value));
        nextValue = clone(operation.value);
    }
    else if (operation.op === "patch") {
        const currentValue = getValueAtPath(currentState, fullPath);
        nextValue = mergeDeep(isPlainObject(currentValue) ? currentValue : {}, operation.value);
        nextState = setValueAtPath(currentState, fullPath, nextValue);
    }
    else if (operation.op === "delete") {
        nextState = deleteValueAtPath(currentState, fullPath);
        nextValue = undefined;
    }
    else {
        throw new Error(`Unknown store operation '${operation.op}'.`);
    }

    return {
        nextState,
        notification: {
            ui: {
                store: {
                    id: storeDefinition.id,
                    event: "changed",
                    op: operation.op,
                    path: operation.path,
                    fullPath: fullPath || storeRootPath,
                    value: nextValue,
                    previousValue,
                    origin: "node-red"
                }
            }
        }
    };
}

// ---------------------------------------------------------------------------
// P15: clientId routing and reconnect sync helpers
// ---------------------------------------------------------------------------

/**
 * Returns the per-client state for a given appId and clientId.
 * Creates the client sub-map lazily if needed.
 */
function getClientState(appId, clientId) {
    let appClients = runtimeState.clientStateMap.get(appId);
    if (!appClients) {
        appClients = new Map();
        runtimeState.clientStateMap.set(appId, appClients);
    }
    return appClients.get(clientId) || null;
}

/**
 * Sets the per-client state for a given appId and clientId.
 */
function setClientState(appId, clientId, state, timestamp) {
    let appClients = runtimeState.clientStateMap.get(appId);
    if (!appClients) {
        appClients = new Map();
        runtimeState.clientStateMap.set(appId, appClients);
    }
    appClients.set(clientId, { state: clone(state), timestamp });
}

/**
 * Resolves which state wins after a reconnect.
 * Returns { winner: "server"|"client", state, timestamp }.
 *
 * Rules:
 *   - If client timestamp is newer than server timestamp → client wins.
 *   - Otherwise (server newer or equal, or missing timestamp) → server wins.
 */
function resolveReconnectState(serverEntry, clientSnapshot) {
    if (!serverEntry) {
        // No server state recorded yet — accept client state.
        return { winner: "client", state: clientSnapshot.state, timestamp: clientSnapshot.timestamp };
    }
    if (clientSnapshot.timestamp > serverEntry.timestamp) {
        return { winner: "client", state: clientSnapshot.state, timestamp: clientSnapshot.timestamp };
    }
    return { winner: "server", state: serverEntry.state, timestamp: serverEntry.timestamp };
}

function escapeHtml(input) {
    return String(input)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function escapeAttribute(input) {
    return escapeHtml(input);
}

function escapeJson(input) {
    return JSON.stringify(input).replace(/</g, "\\u003c");
}

function getBinding(bindingCandidate, fallbackBinding) {
    if (bindingCandidate && typeof bindingCandidate === "object" && typeof bindingCandidate.kind === "string") {
        return bindingCandidate;
    }

    return fallbackBinding;
}

function initializeState(stores, queries, appId) {
    let state = {
        ui: {
            appId,
            dialogs: {},
            queries: {}
        }
    };

    for (const store of stores) {
        if (store.initialValue !== undefined) {
            state = setValueAtPath(state, store.statePath, clone(store.initialValue));
        }
    }

    for (const query of queries) {
        state = setValueAtPath(state, `ui.queries.${query.id}.loading`, false);
        state = setValueAtPath(state, `ui.queries.${query.id}.status`, "idle");
    }

    return state;
}

function createDemoQueryData() {
    return {
        customers: {
            list: [
                { id: "c-100", name: "Ada Lovelace", email: "ada@example.com", status: "active" },
                { id: "c-200", name: "Grace Hopper", email: "grace@example.com", status: "inactive" },
                { id: "c-300", name: "Radia Perlman", email: "radia@example.com", status: "trial" }
            ],
            current: { id: "c-100", name: "Ada Lovelace", email: "ada@example.com", status: "active" }
        }
    };
}

function getPreviewQueries(appId) {
    return clone(runtimeState.previewQueries.get(appId) || createDemoQueryData());
}

function getPreviewMessages(appId) {
    return clone(runtimeState.previewMessages.get(appId) || []);
}

function resetPreview(appId) {
    runtimeState.previewState.delete(appId);
    runtimeState.previewQueries.delete(appId);
    runtimeState.previewMessages.delete(appId);
}

function rememberPreviewMessage(appId, message) {
    const currentMessages = runtimeState.previewMessages.get(appId) || [];
    const nextMessages = [...currentMessages, {
        at: new Date().toISOString(),
        message
    }].slice(-20);
    runtimeState.previewMessages.set(appId, nextMessages);
}

function nextCustomerId(rows) {
    const maxNumericId = rows.reduce((currentMax, row) => {
        const match = /^c-(\d+)$/.exec(String(row.id || ""));
        return match ? Math.max(currentMax, Number(match[1])) : currentMax;
    }, 0);
    return `c-${String(maxNumericId + 100 || 100).padStart(3, "0")}`;
}

function resolveNavigationTarget(navigationPath, parameters, routeParams) {
    return navigationPath
        .split("/")
        .map((segment) => {
            if (!segment.startsWith(":")) {
                return segment;
            }

            const paramName = segment.slice(1);
            const resolvedValue = parameters[paramName] || routeParams[paramName] || parameters.rowId;
            return encodeURIComponent(String(resolvedValue || ""));
        })
        .join("/");
}

function findTypedAction(actions, actionId) {
    return actions.find((entry) => entry.id === actionId && entry.actionType);
}

function parsePreviewTarget(target) {
    if (typeof target !== "string" || target.trim().length === 0) {
        return undefined;
    }

    const [scope, ...pathSegments] = target.split(":");

    if (scope === "dialog" && pathSegments.length === 1 && pathSegments[0]) {
        return {
            scope,
            id: pathSegments[0]
        };
    }

    return undefined;
}

function buildUiMessage({ componentId, eventName, actionId, location, routeParams, statePatch, payload, dialog, navigation, queries }) {
    return uiEventMessageSchema.parse({
        ui: {
            event: eventName,
            componentId,
            action: actionId,
            route: location,
            params: routeParams,
            statePatch,
            payload,
            dialog,
            navigation,
            queries
        }
    });
}

function emitMessageToRuntimeNodes(RED, actionId, queries, navigationId, message) {
    const candidateIds = new Set([actionId, navigationId, ...queries.map((query) => query.id)].filter(Boolean));

    candidateIds.forEach((nodeId) => {
        const node = RED.nodes.getNode(nodeId);
        if (node && typeof node.send === "function") {
            node.send(clone(message));
        }
    });
}

function getRouteMatch(location, routes) {
    const normalizedLocation = location.startsWith("/") ? location : `/${location}`;
    const matches = routes
        .map((route) => {
            const paramNames = [];
            const pattern = route.path
                .split("/")
                .map((segment) => {
                    if (segment.startsWith(":")) {
                        paramNames.push(segment.slice(1));
                        return "([^/]+)";
                    }

                    return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                })
                .join("/");
            const result = new RegExp(`^${pattern}$`).exec(normalizedLocation);

            if (!result) {
                return undefined;
            }

            const params = {};
            paramNames.forEach((paramName, index) => {
                params[paramName] = decodeURIComponent(result[index + 1] || "");
            });

            return {
                route,
                params
            };
        })
        .filter(Boolean)
        .sort((left, right) => right.route.path.length - left.route.path.length);

    return matches[0];
}

function toComponentDefinitions(components) {
    return components.map((component) => {
        if (component.type === "ui-text") {
            const layoutProps = collectNormalizedLayoutProps(component);
            return {
                id: component.id,
                kind: "text",
                mount: component.mount || component.parent,
                order: toOptionalNumber(component.order),
                bind: {
                    value: getBinding(component.value, literalBinding(component.text || ""))
                },
                props: {
                    ...(blankToUndefined(component.variant) ? { variant: component.variant } : {}),
                    ...(Object.keys(layoutProps).length > 0 ? { layout: layoutProps } : {})
                },
                events: []
            };
        }

        if (component.type === "ui-button") {
            const layoutProps = collectNormalizedLayoutProps(component);
            // P20a: click events are emitted on the button's own output port.
            // Use the button node's id as the action target so the preview endpoint
            // routes the click to the button node (which then sends to its wired output).
            const clickAction = component.action || component.id;
            return {
                id: component.id,
                kind: "button",
                mount: component.mount || component.parent,
                order: toOptionalNumber(component.order),
                bind: component.disabled || component.disabledPath ? { disabled: getBinding(component.disabled, stateBinding(component.disabledPath || "")) } : {},
                props: {
                    label: component.label,
                    ...(Object.keys(layoutProps).length > 0 ? { layout: layoutProps } : {})
                },
                events: [{ event: "click", action: clickAction }]
            };
        }

        if (component.type === "ui-table") {
            const layoutProps = collectNormalizedLayoutProps(component);
            const tableEvents = parseJsonList(component.events);
            return {
                id: component.id,
                kind: "table",
                mount: component.mount || component.parent,
                order: toOptionalNumber(component.order),
                footer: component.footer === true || component.footer === "true",
                bind: {
                    rows: getBinding(component.rows, queryBinding(component.rowsPath || ""))
                },
                props: {
                    columns: parseColumns(component.columns),
                    events: tableEvents.length > 0 ? tableEvents : (component.selectAction ? ["rowSelect"] : []),
                    selectAction: component.selectAction || null,
                    ...(Object.keys(layoutProps).length > 0 ? { layout: layoutProps } : {})
                },
                events: component.selectAction ? [{ event: "select", action: component.selectAction }] : []
            };
        }

        if (component.type === "ui-container") {
            const layoutProps = collectNormalizedLayoutProps(component);
            return {
                id: component.id,
                kind: "container",
                mount: component.mount || component.parent,
                order: toOptionalNumber(component.order),
                bind: {},
                props: {
                    layoutId: component.layout || component.layoutId,
                    ...(Object.keys(layoutProps).length > 0 ? { layout: layoutProps } : {})
                },
                events: []
            };
        }

        if (component.type === "ui-input") {
            const layoutProps = collectNormalizedLayoutProps(component);
            return {
                id: component.id,
                kind: "input",
                mount: component.mount || component.parent,
                order: toOptionalNumber(component.order),
                bind: {
                    value: getBinding(component.value, stateBinding(joinStatePath(component.storeId ? undefined : "", component.path || "")))
                },
                props: {
                    label: component.label,
                    storeId: component.storeId,
                    path: component.path,
                    inputType: component.inputType,
                    ...(Object.keys(layoutProps).length > 0 ? { layout: layoutProps } : {})
                },
                events: []
            };
        }

        return {
            id: component.id,
            kind: "text",
            mount: component.mount || component.parent,
            order: toOptionalNumber(component.order),
            bind: {
                value: literalBinding(component.id)
            },
            props: {},
            events: []
        };
    });
}

function getAppModelResult(appId, definitions) {
    const buckets = getDefinitionBuckets(appId, definitions);

    if (!buckets.app) {
        return {
            success: false,
            status: 404,
            message: `Unknown app '${appId}'.`
        };
    }

    const referencedLayoutIds = new Set([
        buckets.app.layout,
        ...buckets.routes.map((route) => route.layout || route.layoutId),
        ...buckets.dialogs.map((dialog) => dialog.layout || dialog.layoutId),
        ...buckets.components.filter((component) => component.type === "ui-container").map((component) => component.layout || component.layoutId)
    ]);
    const standardLayouts = collectMissingStandardLayouts(
        referencedLayoutIds,
        []
    );
    const routes = buckets.routes.slice();

    if (!routes.some((route) => route.path === "/") && !routes.some((route) => route.id === buckets.app.id)) {
        routes.push(createAppRootRoute(buckets.app.id, blankToUndefined(buckets.app.title), buckets.app.layout));
    }

    const modelCandidate = {
        id: buckets.app.id,
        title: buckets.app.title,
        layouts: [...standardLayouts]
            .map((layout) => ({
                id: layout.id,
                title: blankToUndefined(layout.title),
                slots: layout.slots
            }))
            .sort((left, right) => left.id.localeCompare(right.id)),
        routes: routes
            .map((route) => ({
                id: route.id,
                path: route.path,
                title: blankToUndefined(route.title),
                layoutId: route.layout || route.layoutId
            }))
            .sort((left, right) => left.path.localeCompare(right.path)),
        dialogs: buckets.dialogs
            .map((dialog) => ({
                id: dialog.id,
                title: blankToUndefined(dialog.title),
                layoutId: dialog.layout || dialog.layoutId,
                routeId: blankToUndefined(dialog.routeId),
                modal: dialog.modal !== false
            }))
            .sort((left, right) => left.id.localeCompare(right.id)),
        components: toComponentDefinitions(buckets.components)
    };

    const validation = appModelSchema.safeParse(modelCandidate);

    if (!validation.success) {
        const messages = validation.error.issues.map((issue) => issue.message).join("; ");
        return {
            success: false,
            status: 409,
            message: messages || `App '${appId}' is incomplete.`
        };
    }

    return {
        success: true,
        model: validation.data
    };
}

function getLayout(model, layoutId) {
    return model.layouts.find((layout) => layout.id === layoutId);
}

function resolveBinding(binding, sources) {
    if (!binding) {
        return undefined;
    }

    let resolved;

    if (binding.kind === "literal") {
        resolved = binding.value;
    }
    else if (binding.kind === "state") {
        resolved = getValueAtPath(sources.state, binding.path);
    }
    else if (binding.kind === "query") {
        resolved = getValueAtPath(sources.queries, binding.path);
    }
    else if (binding.kind === "routeParam") {
        resolved = sources.params[binding.path];
    }
    else if (binding.kind === "msg") {
        resolved = getValueAtPath(sources.msg, binding.path);
    }
    else if (binding.kind === "flow") {
        resolved = sources.flowContext ? sources.flowContext.get(binding.path) : undefined;
    }
    else if (binding.kind === "global") {
        resolved = sources.globalContext ? sources.globalContext.get(binding.path) : undefined;
    }
    else if (binding.kind === "env") {
        resolved = sources.env ? sources.env[binding.path] : undefined;
    }
    else if (binding.kind === "jsonata") {
        // JSONata expressions are evaluated at render time when a JSONata evaluator is provided.
        resolved = sources.jsonata ? sources.jsonata(binding.path, sources) : undefined;
    }

    return resolved === undefined ? binding.fallback : resolved;
}

function buildActionHref(appId, action, location, componentId, eventName, params = {}) {
    const query = new URLSearchParams({
        location: location || "/customers",
        sourceId: componentId,
        event: eventName,
        ...Object.entries(params).reduce((result, [key, value]) => {
            if (value !== undefined && value !== null && value !== "") {
                result[key] = String(value);
            }
            return result;
        }, {})
    });

    return `/webapp/${encodeURIComponent(appId)}/action/${encodeURIComponent(action)}?${query.toString()}`;
}

function sanitizeClassSuffix(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "") || "default";
}

function getLayoutVariant(layoutId) {
    return ["horizontal", "vertical", "app", "grid", "absolute"].includes(layoutId) ? layoutId : "custom";
}

function renderLayoutHtml(layoutId, regions, serializerContext) {
    const variant = getLayoutVariant(layoutId);
    return `<div class="webapp-layout webapp-layout--${escapeAttribute(variant)}">${regions.map((region) => renderRegionHtml(region, layoutId, serializerContext)).join("")}</div>`;
}

// --- Snapshot serializers (P21) ---------------------------------------------
//
// All mount resolution, binding resolution, region nesting and dialog gating
// now live in packages/renderer (createRendererApp → RenderSnapshot). webapp.js
// only serializes that snapshot into the preview HTML; it no longer re-walks the
// AppModel or owns a second slot-tree/mount matcher.

function regionContainsInput(region) {
    return region.components.some((component) => {
        if (component.kind === "input") {
            return true;
        }

        if (component.kind === "container") {
            return component.regions.some((child) => regionContainsInput(child));
        }

        return false;
    });
}

function getComponentLayoutProps(component) {
    const layout = component.props && component.props.layout;
    return layout && typeof layout === "object" ? layout : {};
}

function wrapRenderedComponentHtml(component, layoutId, innerHtml) {
    const layoutVariant = getLayoutVariant(layoutId || "");
    const layoutProps = getComponentLayoutProps(component);
    const styles = [];

    if (layoutVariant === "grid") {
        if (layoutProps.col !== undefined) {
            styles.push(`grid-column:${layoutProps.col}${layoutProps.colSize !== undefined ? ` / span ${layoutProps.colSize}` : ""}`);
        }

        if (layoutProps.row !== undefined) {
            styles.push(`grid-row:${layoutProps.row}${layoutProps.rowSize !== undefined ? ` / span ${layoutProps.rowSize}` : ""}`);
        }
    }

    if (layoutVariant === "absolute") {
        if (layoutProps.x !== undefined) {
            styles.push(`left:${layoutProps.x}px`);
        }

        if (layoutProps.y !== undefined) {
            styles.push(`top:${layoutProps.y}px`);
        }
    }

    const styleAttribute = styles.length > 0 ? ` style="${escapeAttribute(styles.join(";"))}"` : "";
    return `<div class="webapp-item webapp-item--${escapeAttribute(layoutVariant)}"${styleAttribute}>${innerHtml}</div>`;
}

function renderRegionHtml(region, layoutId, serializerContext) {
    const title = region.title ? `<h3>${escapeHtml(region.title)}</h3>` : "";
    const components = region.components
        .map((component) => renderComponentHtml(component, layoutId, serializerContext))
        .join("");
    const layoutVariant = getLayoutVariant(layoutId);
    const slotClass = sanitizeClassSuffix(region.name);
    return `<section class="webapp-slot webapp-slot--${escapeAttribute(slotClass)}">${title}<div class="webapp-slot-body webapp-slot-body--${escapeAttribute(layoutVariant)}">${components}</div></section>`;
}

function renderComponentHtml(component, layoutId, serializerContext) {
    const { appId, location } = serializerContext;

    if (component.kind === "text") {
        return wrapRenderedComponentHtml(component, layoutId, `<div class="webapp-text">${escapeHtml(component.text)}</div>`);
    }

    if (component.kind === "button") {
        const label = escapeHtml(component.label);
        const action = component.events && component.events[0] ? component.events[0].action : undefined;
        const inForm = Boolean(serializerContext.formId);
        const href = action
            ? buildActionHref(appId, action, location, component.id, inForm ? "submit" : "click", serializerContext.params)
            : undefined;

        if (component.disabled || !href) {
            return wrapRenderedComponentHtml(component, layoutId, `<button class="webapp-button" disabled>${label}</button>`);
        }

        if (inForm) {
            return wrapRenderedComponentHtml(component, layoutId, `<button class="webapp-button" type="submit" form="${escapeAttribute(serializerContext.formId)}" formaction="${escapeAttribute(href)}">${label}</button>`);
        }

        return wrapRenderedComponentHtml(component, layoutId, `<a class="webapp-button" href="${escapeAttribute(href)}">${label}</a>`);
    }

    if (component.kind === "table") {
        const columns = Array.isArray(component.props.columns) ? component.props.columns : [];
        const rows = Array.isArray(component.rows) ? component.rows : [];
        const selectAction = component.props.selectAction
            || (component.events.find((event) => event.event === "select") || {}).action
            || undefined;
        const header = columns.map((col) => `<th>${escapeHtml(col.label || col.key || col)}</th>`).join("");
        const body = rows.length === 0
            ? `<tr><td colspan="${Math.max(columns.length, 1)}">No rows loaded.</td></tr>`
            : rows.map((row) => {
                const rowId = row.id !== undefined ? String(row.id) : "";
                const actionPrefix = selectAction
                    ? `/webapp/${encodeURIComponent(appId)}/action/${encodeURIComponent(selectAction)}?location=${encodeURIComponent(location || "/customers")}&sourceId=${encodeURIComponent(component.id)}&event=select&rowId=${encodeURIComponent(rowId)}`
                    : undefined;
                const cells = columns.map((col, index) => {
                    const key = col.key || col;
                    const value = escapeHtml(row[key] ?? "");

                    if (index === 0 && actionPrefix && rowId) {
                        return `<td><a class="webapp-link" href="${escapeAttribute(actionPrefix)}">${value}</a></td>`;
                    }

                    return `<td>${value}</td>`;
                }).join("");
                return `<tr>${cells}</tr>`;
            }).join("");
        return wrapRenderedComponentHtml(component, layoutId, `<table class="webapp-table"><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`);
    }

    if (component.kind === "input") {
        const label = String(component.props.label || component.id);
        const name = String(component.props.path || component.id);
        const inputType = String(component.props.inputType || "text");
        const value = component.value === undefined || component.value === null ? "" : String(component.value);
        return wrapRenderedComponentHtml(component, layoutId, `<label class="webapp-field">${escapeHtml(label)}<input type="${escapeAttribute(inputType)}" name="${escapeAttribute(name)}" value="${escapeAttribute(value)}"></label>`);
    }

    if (component.kind === "container") {
        const childLayoutId = component.layoutId;
        const hasInputs = component.regions.some((region) => regionContainsInput(region));
        const formId = hasInputs ? `webapp-form-${component.id}` : undefined;
        const childContext = { ...serializerContext, formId };
        const content = renderLayoutHtml(childLayoutId, component.regions, childContext);
        const inner = formId
            ? `<form class="webapp-form" id="${escapeAttribute(formId)}" method="get">${content}</form>`
            : `<div class="webapp-container">${content}</div>`;
        return wrapRenderedComponentHtml(component, layoutId, inner);
    }

    return "";
}

function applyPreviewAction(RED, appId, actionId, parameters, definitions) {
    const buckets = getDefinitionBuckets(appId, definitions);
    const matchingInputs = buckets.components.filter((entry) => entry.type === "ui-input" && entry.path && parameters[entry.path] !== undefined);
    const typedAction = findTypedAction(buckets.actions, actionId);
    const allowLegacyPreviewAction = typedAction
        && typedAction.targetMode === "out-port"
        && ["openCustomerEditor", "closeCustomerEditor", "saveCustomer", "deleteCustomer"].includes(actionId);
    const modelResult = getAppModelResult(appId, definitions);

    if (!modelResult.success) {
        return {
            success: false,
            status: modelResult.status,
            body: modelResult.message
        };
    }

    const { model } = modelResult;

    const location = parameters.location ? String(parameters.location) : "/";
    const routeMatch = getRouteMatch(location, model.routes) || { route: { id: "customers", path: "/customers" }, params: {} };
    const currentState = clone(runtimeState.previewState.get(appId) || {});
    let nextState = currentState;
    let nextQueries = getPreviewQueries(appId);
    let redirectLocation = location;
    let dialogId;
    let dialogMessage;
    let navigationMessage;
    let queryMessages = [];
    const matchingRefreshQueries = buckets.queries
        .filter((query) => query.refreshAction === actionId)
        .map((query) => ({
            id: query.id,
            queryPath: query.queryPath,
            mode: Array.isArray(getValueAtPath(nextQueries, query.queryPath)) ? "refresh" : "load"
        }));
    const componentId = parameters.sourceId ? String(parameters.sourceId) : actionId;
    const eventName = parameters.event ? String(parameters.event) : matchingInputs.length > 0 ? "submit" : "click";
    const payload = {};
    const statePatch = {};

    if (typedAction && !allowLegacyPreviewAction) {
        // P20a: New wiring model — no targetMode means the output port is wired directly.
        // The action node will forward the message to its wired target via actionInputHandler.
        if (!typedAction.targetMode) {
            // Just emit the message to the action node — wiring handles the rest.
        }
        else if (typedAction.targetMode === "out-port") {
            // Legacy out-port: emit UI message, wired target handles it.
        }
        else if (typedAction.actionType === "navigate") {
            if (typedAction.targetMode === "path") {
                redirectLocation = resolveNavigationTarget(typedAction.to, parameters, routeMatch.params);
                navigationMessage = {
                    id: typedAction.id,
                    to: redirectLocation
                };
            }
        }
        else if (typedAction.targetMode === "path" && ["show", "hide"].includes(typedAction.actionType)) {
            const previewTarget = parsePreviewTarget(typedAction.target);

            if (!previewTarget || previewTarget.scope !== "dialog") {
                return {
                    success: false,
                    status: 422,
                    body: `Typed action '${typedAction.id}' uses an unsupported preview target.`
                };
            }

            const isOpen = typedAction.actionType === "show";
            nextState = setValueAtPath(nextState, `ui.dialogs.${previewTarget.id}.open`, isOpen);
            statePatch[`ui.dialogs.${previewTarget.id}.open`] = isOpen;
            dialogMessage = {
                id: previewTarget.id,
                open: isOpen
            };
            dialogId = isOpen ? previewTarget.id : undefined;
        }
        else {
            return {
                success: false,
                status: 422,
                body: `Typed action '${typedAction.actionType}' is not implemented in the preview yet.`
            };
        }
    }
    else if (actionId === "openCustomerEditor") {
        const customerId = parameters.id ? String(parameters.id) : routeMatch.params.id;
        const selectedCustomer = nextQueries.customers && Array.isArray(nextQueries.customers.list)
            ? nextQueries.customers.list.find((row) => String(row.id) === customerId)
            : undefined;
        const draft = customerId && selectedCustomer ? customerDraftFromRecord(selectedCustomer) : customerDraftFromRecord({});
        nextState = setValueAtPath(nextState, "draft.customer", draft);
        nextState = setValueAtPath(nextState, "draft.customerId", customerId || "");
        nextState = setValueAtPath(nextState, "ui.dialogs.customerEditor.open", true);
        statePatch["draft.customer"] = draft;
        statePatch["draft.customerId"] = customerId || "";
        statePatch["ui.dialogs.customerEditor.open"] = true;
        dialogId = "customerEditor";
        dialogMessage = { id: "customerEditor", open: true };
    }
    else if (actionId === "closeCustomerEditor") {
        nextState = setValueAtPath(nextState, "ui.dialogs.customerEditor.open", false);
        statePatch["ui.dialogs.customerEditor.open"] = false;
        dialogMessage = { id: "customerEditor", open: false };
    }
    else if (actionId === "saveCustomer" || matchingInputs.length > 0) {
        const fieldValues = matchingInputs.reduce((result, input) => {
            result[input.path] = String(parameters[input.path]);
            return result;
        }, {});
        const storeId = matchingInputs[0] ? matchingInputs[0].storeId : undefined;
        const storeDefinition = storeId ? buckets.stores.find((entry) => entry.id === storeId) : undefined;
        const draftPath = storeDefinition ? storeDefinition.statePath : "draft.customer";
        const currentDraft = getValueAtPath(nextState, draftPath);
        const nextDraft = isPlainObject(currentDraft) ? { ...currentDraft, ...fieldValues } : fieldValues;
        const existingCustomerId = String(getValueAtPath(nextState, "draft.customerId") || "");
        const customerId = existingCustomerId || nextCustomerId(nextQueries.customers?.list || []);
        const persistedCustomer = {
            id: customerId,
            ...nextDraft
        };
        const existingRows = Array.isArray(nextQueries.customers?.list) ? nextQueries.customers.list : [];
        const existingIndex = existingRows.findIndex((row) => String(row.id) === customerId);
        const nextRows = existingIndex >= 0
            ? existingRows.map((row, index) => index === existingIndex ? persistedCustomer : row)
            : [...existingRows, persistedCustomer];

        nextQueries = {
            ...nextQueries,
            customers: {
                ...(nextQueries.customers || {}),
                list: nextRows,
                current: persistedCustomer
            }
        };
        nextState = setValueAtPath(nextState, draftPath, nextDraft);
        nextState = setValueAtPath(nextState, "draft.customerId", customerId);
        nextState = setValueAtPath(nextState, "ui.dialogs.customerEditor.open", false);
        statePatch[draftPath] = nextDraft;
        statePatch["draft.customerId"] = customerId;
        statePatch["ui.dialogs.customerEditor.open"] = false;
        redirectLocation = "/customers";
        dialogMessage = { id: "customerEditor", open: false };
        payload.values = fieldValues;
    }
    else if (actionId === "openCustomerDetail") {
        const navigation = buckets.navigations.find((entry) => entry.id === actionId);
        const rowId = parameters.rowId ? String(parameters.rowId) : routeMatch.params.id;
        const selectedCustomer = nextQueries.customers && Array.isArray(nextQueries.customers.list)
            ? nextQueries.customers.list.find((row) => String(row.id) === rowId)
            : undefined;

        if (selectedCustomer) {
            nextQueries = {
                ...nextQueries,
                customers: {
                    ...(nextQueries.customers || {}),
                    current: selectedCustomer
                }
            };
        }

        if (navigation) {
            redirectLocation = resolveNavigationTarget(navigation.to, { rowId, id: rowId }, routeMatch.params);
            navigationMessage = {
                id: navigation.id,
                to: redirectLocation
            };
        }
    }
    else if (actionId === "deleteCustomer") {
        const navigation = buckets.navigations.find((entry) => entry.id === actionId);
        const customerId = parameters.id
            ? String(parameters.id)
            : routeMatch.params.id || String(getValueAtPath(nextState, "draft.customerId") || nextQueries.customers?.current?.id || "");
        const remainingRows = Array.isArray(nextQueries.customers?.list)
            ? nextQueries.customers.list.filter((row) => String(row.id) !== customerId)
            : [];

        nextQueries = {
            ...nextQueries,
            customers: {
                ...(nextQueries.customers || {}),
                list: remainingRows,
                current: remainingRows[0] || null
            }
        };

        if (navigation) {
            redirectLocation = resolveNavigationTarget(navigation.to, { id: customerId }, routeMatch.params);
            navigationMessage = {
                id: navigation.id,
                to: redirectLocation
            };
        }
    }
    else if (actionId === "goToCustomers") {
        const navigation = buckets.navigations.find((entry) => entry.id === actionId);

        if (navigation) {
            redirectLocation = resolveNavigationTarget(navigation.to, {}, routeMatch.params);
            navigationMessage = {
                id: navigation.id,
                to: redirectLocation
            };
        }
    }
    else {
        return {
            success: false,
            status: 404,
            body: "Unknown action."
        };
    }

    if (matchingRefreshQueries.length > 0) {
        queryMessages = matchingRefreshQueries;

        matchingRefreshQueries.forEach((query) => {
            statePatch[`ui.queries.${query.id}.loading`] = false;
            statePatch[`ui.queries.${query.id}.status`] = "success";
            nextState = setValueAtPath(nextState, `ui.queries.${query.id}.loading`, false);
            nextState = setValueAtPath(nextState, `ui.queries.${query.id}.status`, "success");
        });
    }

    runtimeState.previewState.set(appId, nextState);
    runtimeState.previewQueries.set(appId, nextQueries);

    const message = buildUiMessage({
        appId,
        componentId,
        eventName,
        actionId,
        location,
        routeParams: routeMatch.params,
        statePatch,
        payload,
        dialog: dialogMessage,
        navigation: navigationMessage,
        queries: queryMessages
    });

    rememberPreviewMessage(appId, message);
    emitMessageToRuntimeNodes(RED, actionId, queryMessages, navigationMessage && navigationMessage.id, message);

    return {
        success: true,
        redirectLocation,
        dialogId,
        message
    };
}

function renderAppPage(appId, location, dialogId, definitions) {
    const modelResult = getAppModelResult(appId, definitions);

    if (!modelResult.success) {
        return {
            status: modelResult.status,
            body: `<!doctype html><html><body><h1>${modelResult.status === 404 ? "Unknown app" : "Incomplete app"}</h1><p>${escapeHtml(modelResult.message)}</p></body></html>`
        };
    }

    const { model } = modelResult;

    const routeMatch = getRouteMatch(location, model.routes);

    if (!routeMatch) {
        return {
            status: 404,
            body: `<!doctype html><html><body><h1>Unknown route</h1><p>No route matched '${escapeHtml(location)}'.</p></body></html>`
        };
    }

    const layout = getLayout(model, routeMatch.route.layoutId);

    if (!layout) {
        return {
            status: 500,
            body: `<!doctype html><html><body><h1>Missing layout</h1></body></html>`
        };
    }

    const buckets = getDefinitionBuckets(appId, definitions);
    const integration = {
        navigations: buckets.navigations.map((entry) => ({ id: entry.id, to: entry.to })),
        queries: buckets.queries,
        actions: buckets.actions,
        stores: buckets.stores
    };
    const queries = getPreviewQueries(appId);
    const state = initializeState(integration.stores, integration.queries, appId);
    const previewState = runtimeState.previewState.get(appId);
    const hydratedState = previewState ? mergeDeep(state, previewState) : state;
    const effectiveState = dialogId ? setValueAtPath(hydratedState, `ui.dialogs.${dialogId}.open`, true) : hydratedState;

    // P21: a single RenderSnapshot from packages/renderer is the source of truth.
    // webapp.js no longer re-walks the AppModel — it only serializes this snapshot.
    const rendererApp = createRendererApp(model, {
        integration,
        location,
        state: effectiveState,
        queries
    });
    const snapshot = rendererApp.render();
    const serializerContext = {
        appId: model.id,
        location: snapshot.location,
        params: snapshot.params,
        formId: undefined
    };

    const dialogHtml = snapshot.dialogs
        .map((dialog) => `<div class="webapp-dialog"><div class="webapp-dialog-card"><div class="webapp-dialog-head"><h2>${escapeHtml(dialog.title || dialog.id)}</h2><a href="/webapp/${encodeURIComponent(appId)}/action/closeCustomerEditor?location=${encodeURIComponent(location)}&sourceId=cancelCustomerButton&event=click" class="webapp-link">Close</a></div>${renderLayoutHtml(dialog.layoutId, dialog.regions, serializerContext)}</div></div>`)
        .join("");
    const pageBody = renderLayoutHtml(snapshot.layout.id, snapshot.regions, serializerContext);
    const messageFeed = getPreviewMessages(appId)
        .slice()
        .reverse()
        .map((entry) => `<li><strong>${escapeHtml(entry.message.ui.action || entry.message.ui.event)}</strong> from ${escapeHtml(entry.message.ui.componentId)} <span class="webapp-sub">${escapeHtml(entry.at)}</span></li>`)
        .join("");

    return {
        status: 200,
        body: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(model.title)} - ${escapeHtml(routeMatch.route.title || routeMatch.route.id)}</title>
  <style>
    :root { color-scheme: light; --bg:#f4f1e8; --panel:#fffdf7; --ink:#1f2933; --muted:#5b6470; --line:#d9d2c3; --accent:#0f766e; --accent-2:#9a3412; }
    * { box-sizing:border-box; }
    body { margin:0; font-family: Georgia, "Iowan Old Style", serif; color:var(--ink); background:radial-gradient(circle at top left, #fff8ec, var(--bg)); }
    a { color:inherit; text-decoration:none; }
    .webapp-shell { max-width:1100px; margin:0 auto; padding:32px 20px 60px; }
    .webapp-topbar { display:flex; justify-content:space-between; gap:16px; align-items:flex-end; margin-bottom:24px; }
    .webapp-topbar h1 { margin:0; font-size:clamp(2rem, 4vw, 3.4rem); }
    .webapp-sub { color:var(--muted); font-family: ui-monospace, SFMono-Regular, monospace; font-size:13px; }
    .webapp-grid { display:grid; gap:16px; }
    .webapp-layout { display:grid; gap:16px; }
    .webapp-layout--app { grid-template-areas:"header" "navbar" "content" "footer"; }
    .webapp-slot { border:1px solid var(--line); background:rgba(255,255,255,0.78); backdrop-filter: blur(6px); border-radius:18px; padding:16px; box-shadow:0 12px 30px rgba(79,70,50,0.08); }
    .webapp-slot--header { grid-area:header; }
    .webapp-slot--navbar { grid-area:navbar; }
    .webapp-slot--content { grid-area:content; }
    .webapp-slot--footer { grid-area:footer; }
    .webapp-slot > header { margin-bottom:12px; }
    .webapp-slot > header h2 { margin:0; font-size:1rem; text-transform:uppercase; letter-spacing:0.08em; color:var(--muted); }
    .webapp-slot-body { gap:12px; }
    .webapp-slot-body--vertical, .webapp-slot-body--app, .webapp-slot-body--custom { display:flex; flex-direction:column; }
    .webapp-slot-body--horizontal { display:flex; flex-direction:row; align-items:flex-start; flex-wrap:wrap; }
    .webapp-slot-body--horizontal > * { flex:1 1 220px; min-width:0; }
    .webapp-slot-body--grid { display:grid; grid-template-columns:repeat(12, minmax(0, 1fr)); gap:12px; }
    .webapp-slot-body--absolute { position:relative; min-height:320px; }
    .webapp-item--absolute { position:absolute; }
    .webapp-text { font-size:1.05rem; }
    .webapp-button { display:inline-flex; align-items:center; justify-content:center; padding:10px 14px; border-radius:999px; border:1px solid rgba(0,0,0,0.08); background:linear-gradient(135deg, var(--accent), #155e75); color:white; font-weight:600; }
    button.webapp-button[disabled] { background:#cbd5e1; color:#475569; }
    .webapp-table { width:100%; border-collapse:collapse; background:var(--panel); border-radius:12px; overflow:hidden; }
    .webapp-table th, .webapp-table td { padding:10px 12px; border-bottom:1px solid var(--line); text-align:left; }
    .webapp-form { display:grid; gap:10px; }
    .webapp-field { display:grid; gap:6px; color:var(--muted); font-size:0.95rem; }
    .webapp-form input { padding:10px 12px; border-radius:10px; border:1px solid var(--line); background:white; }
    .webapp-container { display:grid; gap:12px; }
    .webapp-dialog { position:fixed; inset:0; background:rgba(20, 26, 31, 0.38); display:flex; align-items:center; justify-content:center; padding:24px; }
    .webapp-dialog-card { width:min(720px, 100%); background:var(--panel); border-radius:22px; padding:20px; box-shadow:0 25px 70px rgba(0,0,0,0.18); }
    .webapp-dialog-head { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:12px; }
    .webapp-link { color:var(--accent-2); font-weight:700; }
        @media (min-width: 900px) {
            .webapp-layout--app { grid-template-columns:minmax(220px, 280px) minmax(0, 1fr); grid-template-areas:"header header" "navbar content" "footer footer"; align-items:start; }
        }
  </style>
</head>
<body>
  <div class="webapp-shell">
    <div class="webapp-topbar">
      <div>
        <div class="webapp-sub">Node-RED Webapp Runtime Preview</div>
        <h1>${escapeHtml(model.title)}</h1>
      </div>
      <div class="webapp-sub">Route: ${escapeHtml(routeMatch.route.path)}</div>
    </div>
    <div class="webapp-grid">${pageBody}</div>
    ${dialogHtml}
  </div>
</body>
</html>`
    };
}

function getFlowFilePath(RED) {
    const configuredFlowFile = RED.settings.flowFile || "flows.json";
    return path.isAbsolute(configuredFlowFile)
        ? configuredFlowFile
        : path.join(RED.settings.userDir || process.cwd(), configuredFlowFile);
}

function readDeployDefinitions(RED) {
    try {
        const flowFilePath = getFlowFilePath(RED);

        if (!fs.existsSync(flowFilePath)) {
            return [];
        }

        const parsed = JSON.parse(fs.readFileSync(flowFilePath, "utf8"));
        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed
            .filter((entry) => entry && WEBAPP_NODE_TYPES.has(entry.type))
            .map((entry) => {
                const registration = runtimeNodeRegistry[entry.type];

                if (!registration || typeof registration.mapConfig !== "function") {
                    return {
                        ...entry,
                        id: entry.uiId || entry.id
                    };
                }

                return {
                    ...registration.mapConfig(entry),
                    z: entry.z
                };
            });
    }
    catch {
        return [];
    }
}

function getDefinitionBuckets(appId, definitions) {
    const matchingApp = definitions.find((entry) => entry.type === "ui-app" && (entry.id === appId || entry.root === appId));

    if (!matchingApp) {
        return {
            app: undefined,
            routes: [],
            dialogs: [],
            components: [],
            stores: [],
            queries: [],
            actions: [],
            navigations: []
        };
    }

    const appFlowId = matchingApp.z;
    const matchingDefinitions = definitions.filter(
        (entry) => entry.type !== "ui-app" && (appFlowId === undefined || entry.z === appFlowId || entry.z === undefined)
    );

    return {
        app: matchingApp,
        routes: matchingDefinitions.filter((entry) => entry.type === "ui-route"),
        dialogs: matchingDefinitions.filter((entry) => entry.type === "ui-dialog"),
        components: matchingDefinitions.filter((entry) => ["ui-text", "ui-button", "ui-table", "ui-container", "ui-input", "ui-select", "ui-checkbox", "ui-radio", "ui-switch", "ui-textarea", "ui-datepicker", "ui-slider", "ui-alert", "ui-toast", "ui-progress", "ui-skeleton", "ui-badge", "ui-empty-state", "ui-tabs", "ui-accordion", "ui-breadcrumb", "ui-menu", "ui-pagination", "ui-stepper"].includes(entry.type)),
        stores: matchingDefinitions.filter((entry) => entry.type === "ui-store"),
        queries: matchingDefinitions.filter((entry) => entry.type === "ui-query"),
        actions: matchingDefinitions.filter((entry) => entry.type === "ui-action"),
        navigations: matchingDefinitions.filter((entry) => entry.type === "ui-navigation")
    };
}

function getActiveRuntimeAppId() {
    for (const registration of runtimeState.definitions.values()) {
        if (registration.definition.type === "ui-app") {
            return registration.definition.id;
        }
    }

    return undefined;
}

function registerEndpoints(RED) {
    if (runtimeState.endpointsRegistered) {
        return;
    }

    RED.httpAdmin.get("/webapp/apps", (req, res) => {
        const apps = readDeployDefinitions(RED)
            .filter((entry) => entry.type === "ui-app")
            .map((entry) => ({
                id: entry.id,
                title: entry.title
            }))
            .sort((left, right) => left.id.localeCompare(right.id));

        res.json({ apps });
    });

    RED.httpAdmin.get("/webapp/:appId/model", (req, res) => {
        const { appId } = req.params;
        const buckets = getDefinitionBuckets(appId, readDeployDefinitions(RED));

        if (!buckets.app) {
            res.status(404).json({ error: `Unknown app '${appId}'.` });
            return;
        }

        res.json({
            appId,
            ...buckets
        });
    });

    RED.httpNode.get("/webapp/:appId", (req, res) => {
        const location = req.query.location ? String(req.query.location) : "/";
        const dialogId = req.query.dialog ? String(req.query.dialog) : undefined;
        const page = renderAppPage(req.params.appId, location, dialogId, readDeployDefinitions(RED));

        if (!page) {
            res.status(404).send("Unknown app.");
            return;
        }

        res.status(page.status).type("html").send(page.body);
    });

    RED.httpNode.get("/webapp/:appId/events", (req, res) => {
        res.json({
            messages: getPreviewMessages(req.params.appId)
        });
    });

    RED.httpNode.get("/webapp/:appId/reset", (req, res) => {
        resetPreview(req.params.appId);
        res.json({
            ok: true
        });
    });

    RED.httpNode.get("/webapp/:appId/action/:actionId", (req, res) => {
        const { appId, actionId } = req.params;
        const definitions = readDeployDefinitions(RED);
        const applied = applyPreviewAction(RED, appId, actionId, req.query, definitions);

        if (!applied.success) {
            res.status(applied.status).send(applied.body);
            return;
        }

        const redirectTarget = `/webapp/${encodeURIComponent(appId)}${applied.redirectLocation}${applied.dialogId ? `?dialog=${encodeURIComponent(applied.dialogId)}` : ""}`;
        res.redirect(redirectTarget);
    });

    RED.httpNode.get("/webapp/:appId/*", (req, res) => {
        const suffix = req.params[0] ? `/${req.params[0]}` : "/";
        const dialogId = req.query.dialog ? String(req.query.dialog) : undefined;
        const page = renderAppPage(req.params.appId, suffix, dialogId, readDeployDefinitions(RED));

        if (!page) {
            res.status(404).send("Unknown app.");
            return;
        }

        res.status(page.status).type("html").send(page.body);
    });

    runtimeState.endpointsRegistered = true;
}

function createNodeConstructor(RED, type, mapConfig, options = {}) {
    function WebappNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        let definition;

        try {
            definition = mapConfig(config);
        }
        catch (error) {
            node.status({ fill: "red", shape: "ring", text: "config error" });
            node.error(error instanceof Error ? error.message : String(error));
            return;
        }

        const validation = validateUiNodeDefinition(definition);

        if (!validation.success) {
            node.status({ fill: "red", shape: "ring", text: validation.error });
            node.error(validation.error);
            return;
        }

        const validDefinition = validation.data;
        node.webappDefinition = validDefinition;
        runtimeState.definitions.set(node.id, {
            nodeId: node.id,
            appId: validDefinition.type === "ui-app" ? validDefinition.id : undefined,
            definition: validDefinition
        });

        node.status({ fill: "green", shape: "dot", text: type });

        if (options.inputHandler) {
            node.on("input", function onInput(msg, send, done) {
                options.inputHandler(node, msg, send, done);
            });
        }

        node.on("close", () => {
            runtimeState.definitions.delete(node.id);
        });
    }

    RED.nodes.registerType(type, WebappNode);
}

function getUiId(config) {
    return config.id;
}

function passThroughInputHandler(node, msg, send, done) {
    send(msg);
    if (done) {
        done();
    }
}

function triggerParamQueryRefresh(storeId) {
    const RED = runtimeState.RED;
    if (!RED) {
        return;
    }
    for (const registration of runtimeState.definitions.values()) {
        const def = registration.definition;
        if (def.type === "ui-query" && def.params === storeId) {
            const queryNode = RED.nodes.getNode(registration.nodeId);
            if (queryNode && typeof queryNode.send === "function") {
                queryNode.send({ ui: { query: { queryPath: def.queryPath, refresh: true } } });
            }
        }
    }
}

function queryInputHandler(node, msg, send, done) {
    const queryMsg = msg && msg.ui && typeof msg.ui === "object" ? msg.ui.query : undefined;
    if (queryMsg && typeof queryMsg === "object" && typeof queryMsg.etag === "string") {
        const cacheKey = `${node.id}::${queryMsg.queryPath || ""}`;
        const lastEtag = runtimeState.queryEtags.get(cacheKey);
        if (lastEtag === queryMsg.etag) {
            if (done) {
                done();
            }
            return;
        }
        runtimeState.queryEtags.set(cacheKey, queryMsg.etag);
    }
    send(msg);
    if (done) {
        done();
    }
}

function componentStateInputHandler(node, msg, send, done) {
    const componentMsg = msg && msg.ui && typeof msg.ui === "object" ? msg.ui.component : undefined;

    if (componentMsg && typeof componentMsg === "object" && typeof componentMsg.op === "string") {
        const op = componentMsg.op;
        const validOps = ["show", "hide", "enable", "disable", "focus", "reset"];

        if (!validOps.includes(op)) {
            if (done) {
                done();
            }
            return;
        }

        if (!componentMsg.id) {
            if (done) {
                done();
            }
            return;
        }

        send(msg);
        if (done) {
            done();
        }
        return;
    }

    send(msg);
    if (done) {
        done();
    }
}

function dialogInputHandler(node, msg, send, done) {
    const dialogMsg = msg && msg.ui && typeof msg.ui === "object" ? msg.ui.dialog : undefined;

    if (dialogMsg && typeof dialogMsg === "object" && typeof dialogMsg.op === "string") {
        const op = dialogMsg.op;
        const validOps = ["open", "close", "toggle"];

        if (!validOps.includes(op)) {
            if (done) {
                done();
            }
            return;
        }

        send(msg);
        if (done) {
            done();
        }
        return;
    }

    send(msg);
    if (done) {
        done();
    }
}

// P20a: ui-button emits click events on its output port.
// Incoming component-state messages (show/hide/enable/disable etc.) are still handled.
// Click events arrive as msg.ui.event = "click" from the preview action endpoint.
function buttonInputHandler(node, msg, send, done) {
    const uiMsg = msg && msg.ui && typeof msg.ui === "object" ? msg.ui : undefined;

    // If this is a component-state op, delegate to componentStateInputHandler behaviour
    if (uiMsg && uiMsg.component && typeof uiMsg.component.op === "string") {
        return componentStateInputHandler(node, msg, send, done);
    }

    // Emit click event on the output port
    const clickMsg = {
        ui: {
            event: "click",
            sourceId: node.id,
            clientId: uiMsg && uiMsg.clientId ? uiMsg.clientId : undefined
        }
    };
    send(clickMsg);
    if (done) {
        done();
    }
}

// P20a: ui-action reads the wired target node from the flow topology and
// forwards the action to it. If msg.ui.action.targetId is set, it overrides
// the wired target.
function actionInputHandler(node, msg, send, done) {
    const RED = runtimeState.RED;
    const uiMsg = msg && msg.ui && typeof msg.ui === "object" ? msg.ui : undefined;
    const overrideTargetId = uiMsg && uiMsg.action && typeof uiMsg.action.targetId === "string"
        ? uiMsg.action.targetId
        : undefined;

    if (overrideTargetId) {
        // Dynamic target — send directly to the overridden node
        const targetNode = RED ? RED.nodes.getNode(overrideTargetId) : null;
        if (targetNode && typeof targetNode.send === "function") {
            targetNode.send(clone(msg));
        }
        if (done) {
            done();
        }
        return;
    }

    // Static wiring — pass the message through to the wired output port
    send(msg);
    if (done) {
        done();
    }
}

const runtimeNodeRegistry = {
    "ui-app": {
        mapConfig: (config) => ({
            type: "ui-app",
            id: getUiId(config) || "",
            root: config.root || "",
            title: config.name || config.title || config.root || getUiId(config) || "App",
            layout: config.layout || "vertical",
            events: parseJsonList(config.events).length > 0 ? parseJsonList(config.events) : undefined
        }),
        options: {
            inputHandler: passThroughInputHandler
        }
    },
    "ui-route": {
        mapConfig: (config) => ({
            type: "ui-route",
            id: getUiId(config),
            parent: config.parent || undefined,
            path: config.path,
            title: config.title || undefined,
            layout: config.layoutId,
            events: parseJsonList(config.events).length > 0 ? parseJsonList(config.events) : undefined
        }),
        options: {
            inputHandler: passThroughInputHandler
        }
    },
    "ui-dialog": {
        mapConfig: (config) => ({
            type: "ui-dialog",
            id: getUiId(config),
            parent: config.parent || undefined,
            title: config.title || undefined,
            layout: config.layoutId,
            routeId: config.routeId || undefined,
            modal: config.modal !== false && config.modal !== "false",
            events: parseJsonList(config.events).length > 0 ? parseJsonList(config.events) : undefined
        }),
        options: {
            inputHandler: dialogInputHandler
        }
    },
    "ui-text": {
        mapConfig: (config) => ({
            type: "ui-text",
            id: getUiId(config),
            parent: config.parent || undefined,
            mount: config.mount || config.parent,
            order: toOptionalNumber(config.order),
            value: getBinding(config.value, literalBinding(config.text || "")),
            variant: config.variant || undefined,
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: componentStateInputHandler
        }
    },
    "ui-button": {
        mapConfig: (config) => ({
            type: "ui-button",
            id: getUiId(config),
            parent: config.parent || undefined,
            mount: config.mount || config.parent,
            order: toOptionalNumber(config.order),
            label: config.label,
            disabled: getBinding(config.disabled, config.disabledPath ? stateBinding(config.disabledPath) : undefined),
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: buttonInputHandler
        }
    },
    "ui-table": {
        mapConfig: (config) => ({
            type: "ui-table",
            id: getUiId(config),
            parent: config.parent || undefined,
            mount: config.mount || config.parent,
            order: toOptionalNumber(config.order),
            columns: parseColumns(config.columns),
            rows: getBinding(config.rows, queryBinding(config.rowsPath || "")),
            footer: config.footer === true || config.footer === "true",
            events: parseJsonList(config.events).length > 0 ? parseJsonList(config.events) : undefined,
            selectAction: config.selectAction || undefined,
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: componentStateInputHandler
        }
    },
    "ui-container": {
        mapConfig: (config) => ({
            type: "ui-container",
            id: getUiId(config),
            parent: config.parent || undefined,
            mount: config.mount || config.parent,
            order: toOptionalNumber(config.order),
            layout: config.layoutId,
            events: parseJsonList(config.events).length > 0 ? parseJsonList(config.events) : undefined,
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: componentStateInputHandler
        }
    },
    "ui-input": {
        mapConfig: (config) => ({
            type: "ui-input",
            id: getUiId(config),
            parent: config.parent || undefined,
            mount: config.mount || config.parent,
            order: toOptionalNumber(config.order),
            label: config.label,
            value: getBinding(config.value, config.valuePath ? stateBinding(config.valuePath) : undefined),
            storeId: config.storeId || undefined,
            path: config.path || undefined,
            inputType: config.inputType || undefined,
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: componentStateInputHandler
        }
    },
    "ui-select": {
        mapConfig: (config) => ({
            type: "ui-select",
            id: getUiId(config),
            parent: config.parent || undefined,
            mount: config.mount || config.parent,
            order: toOptionalNumber(config.order),
            label: config.label,
            value: getBinding(config.value, config.valuePath ? stateBinding(config.valuePath) : undefined),
            options: config.optionsJson ? JSON.parse(config.optionsJson) : (config.optionsBinding ? stateBinding(config.optionsBinding) : undefined),
            placeholder: config.placeholder || undefined,
            multiple: config.multiple === true || config.multiple === "true" || undefined,
            searchable: config.searchable === true || config.searchable === "true" || undefined,
            disabled: getBinding(config.disabled, undefined),
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: componentStateInputHandler
        }
    },
    "ui-checkbox": {
        mapConfig: (config) => ({
            type: "ui-checkbox",
            id: getUiId(config),
            parent: config.parent || undefined,
            mount: config.mount || config.parent,
            order: toOptionalNumber(config.order),
            label: config.label,
            value: getBinding(config.value, config.valuePath ? stateBinding(config.valuePath) : undefined),
            disabled: getBinding(config.disabled, undefined),
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: componentStateInputHandler
        }
    },
    "ui-radio": {
        mapConfig: (config) => ({
            type: "ui-radio",
            id: getUiId(config),
            parent: config.parent || undefined,
            mount: config.mount || config.parent,
            order: toOptionalNumber(config.order),
            label: config.label,
            value: getBinding(config.value, config.valuePath ? stateBinding(config.valuePath) : undefined),
            options: config.optionsJson ? JSON.parse(config.optionsJson) : (config.optionsBinding ? stateBinding(config.optionsBinding) : []),
            orientation: config.orientation || undefined,
            disabled: getBinding(config.disabled, undefined),
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: componentStateInputHandler
        }
    },
    "ui-switch": {
        mapConfig: (config) => ({
            type: "ui-switch",
            id: getUiId(config),
            parent: config.parent || undefined,
            mount: config.mount || config.parent,
            order: toOptionalNumber(config.order),
            value: getBinding(config.value, config.valuePath ? stateBinding(config.valuePath) : undefined),
            label: config.label || undefined,
            labelOn: config.labelOn || undefined,
            labelOff: config.labelOff || undefined,
            disabled: getBinding(config.disabled, undefined),
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: componentStateInputHandler
        }
    },
    "ui-textarea": {
        mapConfig: (config) => ({
            type: "ui-textarea",
            id: getUiId(config),
            parent: config.parent || undefined,
            mount: config.mount || config.parent,
            order: toOptionalNumber(config.order),
            label: config.label,
            value: getBinding(config.value, config.valuePath ? stateBinding(config.valuePath) : undefined),
            placeholder: config.placeholder || undefined,
            rows: toOptionalNumber(config.rows),
            maxLength: toOptionalNumber(config.maxLength),
            disabled: getBinding(config.disabled, undefined),
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: componentStateInputHandler
        }
    },
    "ui-datepicker": {
        mapConfig: (config) => ({
            type: "ui-datepicker",
            id: getUiId(config),
            parent: config.parent || undefined,
            mount: config.mount || config.parent,
            order: toOptionalNumber(config.order),
            label: config.label,
            value: getBinding(config.value, config.valuePath ? stateBinding(config.valuePath) : undefined),
            mode: config.mode || undefined,
            min: config.min || undefined,
            max: config.max || undefined,
            placeholder: config.placeholder || undefined,
            disabled: getBinding(config.disabled, undefined),
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: componentStateInputHandler
        }
    },
    "ui-slider": {
        mapConfig: (config) => ({
            type: "ui-slider",
            id: getUiId(config),
            parent: config.parent || undefined,
            mount: config.mount || config.parent,
            order: toOptionalNumber(config.order),
            value: getBinding(config.value, config.valuePath ? stateBinding(config.valuePath) : undefined),
            label: config.label || undefined,
            min: toOptionalNumber(config.min),
            max: toOptionalNumber(config.max),
            step: toOptionalNumber(config.step),
            showValue: config.showValue === true || config.showValue === "true" || undefined,
            disabled: getBinding(config.disabled, undefined),
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: componentStateInputHandler
        }
    },
    "ui-store": {
        mapConfig: (config) => ({
            type: "ui-store",
            id: getUiId(config),
            parent: config.parent || undefined,
            statePath: config.statePath,
            initialValue: parseJson(config.initialValue),
            persist: config.persist === true || config.persist === "true"
        }),
        options: {
            inputHandler(node, msg, send, done) {
                const storeDefinition = node.webappDefinition;
                const activeAppId = getActiveRuntimeAppId();
                const operation = normalizeStoreOperationMessage(msg, storeDefinition);

                if (!operation) {
                    send(msg);
                    if (done) {
                        done();
                    }
                    return;
                }

                if (!activeAppId) {
                    if (done) {
                        done(new Error("No active ui-app is registered for ui-store updates."));
                    }
                    return;
                }

                // P15: clientId routing — per-client state when clientId is present
                const clientId = msg && msg.ui && msg.ui.clientId ? String(msg.ui.clientId) : undefined;

                const baseState = clientId
                    ? (getClientState(activeAppId, clientId)?.state || clone(runtimeState.previewState.get(activeAppId) || initializeState([storeDefinition], [], activeAppId)))
                    : clone(runtimeState.previewState.get(activeAppId) || initializeState([storeDefinition], [], activeAppId));

                const applied = applyStoreOperation(baseState, storeDefinition, operation);
                const now = Date.now();

                if (clientId) {
                    // Update only the per-client state, not the shared broadcast state.
                    setClientState(activeAppId, clientId, applied.nextState, now);
                }
                else {
                    // Broadcast: update shared state.
                    runtimeState.previewState.set(activeAppId, applied.nextState);
                }

                const notificationMsg = {
                    ...msg,
                    ui: {
                        ...(msg.ui && typeof msg.ui === "object" ? msg.ui : {}),
                        store: {
                            ...applied.notification.ui.store,
                            // Preserve clientId in the outgoing notification so downstream
                            // nodes know which client the update targets (or undefined = broadcast).
                            clientId: clientId || undefined
                        }
                    }
                };
                send(notificationMsg);
                triggerParamQueryRefresh(storeDefinition.id);
                if (done) {
                    done();
                }
            }
        }
    },
    "ui-query": {
        mapConfig: (config) => ({
            type: "ui-query",
            id: getUiId(config),
            parent: config.parent || undefined,
            queryPath: config.queryPath,
            params: config.params || undefined,
            refreshAction: config.refreshAction || undefined
        }),
        options: {
            inputHandler: queryInputHandler
        }
    },
    "ui-action": {
        mapConfig: (config) => ({
            type: "ui-action",
            id: getUiId(config),
            parent: config.parent || undefined,
            actionType: blankToUndefined(config.actionType),
            to: blankToUndefined(config.to),
            description: config.description || undefined
        }),
        options: {
            inputHandler: actionInputHandler
        }
    },
    "ui-navigation": {
        mapConfig: (config) => ({
            type: "ui-navigation",
            id: getUiId(config),
            parent: config.parent || undefined,
            to: config.to
        }),
        options: {
            inputHandler: passThroughInputHandler
        }
    },
    "ui-alert": {
        mapConfig: (config) => ({
            type: "ui-alert",
            id: getUiId(config),
            parent: config.parent || undefined,
            mount: config.mount || config.parent,
            order: toOptionalNumber(config.order),
            message: getBinding(config.message, config.messagePath ? stateBinding(config.messagePath) : undefined),
            severity: config.severity || undefined,
            title: config.title || undefined,
            dismissible: config.dismissible === true || config.dismissible === "true" || undefined,
            visible: getBinding(config.visible, undefined),
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: componentStateInputHandler
        }
    },
    "ui-toast": {
        mapConfig: (config) => ({
            type: "ui-toast",
            id: getUiId(config),
            parent: config.parent || undefined,
            severity: config.severity || undefined,
            duration: toOptionalNumber(config.duration),
            position: config.position || undefined
        }),
        options: {
            inputHandler: passThroughInputHandler
        }
    },
    "ui-progress": {
        mapConfig: (config) => ({
            type: "ui-progress",
            id: getUiId(config),
            parent: config.parent || undefined,
            mount: config.mount || config.parent,
            order: toOptionalNumber(config.order),
            variant: config.variant || undefined,
            value: getBinding(config.value, config.valuePath ? stateBinding(config.valuePath) : undefined),
            label: config.label || undefined,
            showValue: config.showValue === true || config.showValue === "true" || undefined,
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: componentStateInputHandler
        }
    },
    "ui-skeleton": {
        mapConfig: (config) => ({
            type: "ui-skeleton",
            id: getUiId(config),
            parent: config.parent || undefined,
            mount: config.mount || config.parent,
            order: toOptionalNumber(config.order),
            visible: getBinding(config.visible, config.visiblePath ? stateBinding(config.visiblePath) : undefined),
            variant: config.variant || undefined,
            lines: toOptionalNumber(config.lines),
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: componentStateInputHandler
        }
    },
    "ui-badge": {
        mapConfig: (config) => ({
            type: "ui-badge",
            id: getUiId(config),
            parent: config.parent || undefined,
            mount: config.mount || config.parent,
            order: toOptionalNumber(config.order),
            value: getBinding(config.value, config.valuePath ? stateBinding(config.valuePath) : undefined),
            variant: config.variant || undefined,
            severity: config.severity || undefined,
            max: toOptionalNumber(config.max),
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: componentStateInputHandler
        }
    },
    "ui-empty-state": {
        mapConfig: (config) => ({
            type: "ui-empty-state",
            id: getUiId(config),
            parent: config.parent || undefined,
            mount: config.mount || config.parent,
            order: toOptionalNumber(config.order),
            visible: getBinding(config.visible, config.visiblePath ? stateBinding(config.visiblePath) : undefined),
            icon: config.icon || undefined,
            title: config.title || undefined,
            message: config.message || undefined,
            action: config.action || undefined,
            actionLabel: config.actionLabel || undefined,
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: componentStateInputHandler
        }
    },
    "ui-tabs": {
        mapConfig: (config) => ({
            type: "ui-tabs",
            id: getUiId(config),
            parent: config.parent || undefined,
            mount: config.mount || config.parent,
            order: toOptionalNumber(config.order),
            tabs: parseList(config.tabs).map((t) => {
                if (typeof t === "string") {
                    try { return JSON.parse(t); } catch { return { id: t, label: t }; }
                }
                return t;
            }).filter(Boolean),
            activeTab: getBinding(config.activeTab, config.activeTabPath ? stateBinding(config.activeTabPath) : undefined),
            events: parseJsonList(config.events),
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: componentStateInputHandler
        }
    },
    "ui-accordion": {
        mapConfig: (config) => ({
            type: "ui-accordion",
            id: getUiId(config),
            parent: config.parent || undefined,
            mount: config.mount || config.parent,
            order: toOptionalNumber(config.order),
            items: parseList(config.items).map((t) => {
                if (typeof t === "string") {
                    try { return JSON.parse(t); } catch { return { id: t, label: t }; }
                }
                return t;
            }).filter(Boolean),
            multiple: config.multiple === true || config.multiple === "true" || undefined,
            events: parseJsonList(config.events),
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: componentStateInputHandler
        }
    },
    "ui-breadcrumb": {
        mapConfig: (config) => ({
            type: "ui-breadcrumb",
            id: getUiId(config),
            parent: config.parent || undefined,
            mount: config.mount || config.parent,
            order: toOptionalNumber(config.order),
            items: getBinding(config.items, config.itemsPath ? stateBinding(config.itemsPath) : undefined) || parseList(config.items),
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: componentStateInputHandler
        }
    },
    "ui-menu": {
        mapConfig: (config) => ({
            type: "ui-menu",
            id: getUiId(config),
            parent: config.parent || undefined,
            mount: config.mount || config.parent,
            order: toOptionalNumber(config.order),
            variant: config.variant || undefined,
            items: getBinding(config.items, config.itemsPath ? stateBinding(config.itemsPath) : undefined) || parseList(config.items),
            activeItem: getBinding(config.activeRoute, config.activeRoutePath ? stateBinding(config.activeRoutePath) : undefined),
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: componentStateInputHandler
        }
    },
    "ui-pagination": {
        mapConfig: (config) => ({
            type: "ui-pagination",
            id: getUiId(config),
            parent: config.parent || undefined,
            mount: config.mount || config.parent,
            order: toOptionalNumber(config.order),
            page: getBinding(config.page, config.pagePath ? stateBinding(config.pagePath) : undefined),
            pageSize: config.pageSize ? stateBinding(config.pageSize) : undefined,
            totalPages: getBinding(config.totalPages, config.totalPath ? stateBinding(config.totalPath) : undefined),
            events: parseJsonList(config.events),
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: componentStateInputHandler
        }
    },
    "ui-stepper": {
        mapConfig: (config) => ({
            type: "ui-stepper",
            id: getUiId(config),
            parent: config.parent || undefined,
            mount: config.mount || config.parent,
            order: toOptionalNumber(config.order),
            steps: parseList(config.steps).map((t) => {
                if (typeof t === "string") {
                    try { return JSON.parse(t); } catch { return { id: t, label: t }; }
                }
                return t;
            }).filter(Boolean),
            activeStep: getBinding(config.activeStep, config.activeStepPath ? stateBinding(config.activeStepPath) : undefined),
            variant: config.orientation || undefined,
            events: parseJsonList(config.events),
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: componentStateInputHandler
        }
    },
    "ui-image": {
        mapConfig: (config) => ({
            type: "ui-image",
            id: getUiId(config),
            parent: config.parent || undefined,
            mount: config.mount || config.parent,
            order: toOptionalNumber(config.order),
            src: getBinding(config.src, config.srcPath ? stateBinding(config.srcPath) : undefined),
            alt: config.alt || undefined,
            fallbackSrc: config.fallback || undefined,
            width: config.width || undefined,
            height: config.height || undefined,
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: componentStateInputHandler
        }
    },
    "ui-icon": {
        mapConfig: (config) => ({
            type: "ui-icon",
            id: getUiId(config),
            parent: config.parent || undefined,
            mount: config.mount || config.parent,
            order: toOptionalNumber(config.order),
            icon: config.icon || "",
            size: config.size || undefined,
            color: config.color || undefined,
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: componentStateInputHandler
        }
    },
    "ui-list": {
        mapConfig: (config) => ({
            type: "ui-list",
            id: getUiId(config),
            parent: config.parent || undefined,
            mount: config.mount || config.parent,
            order: toOptionalNumber(config.order),
            items: getBinding(config.items, config.itemsPath ? stateBinding(config.itemsPath) : undefined) || parseList(config.items),
            variant: config.variant || undefined,
            events: parseJsonList(config.events).length > 0 ? parseJsonList(config.events) : undefined,
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: componentStateInputHandler
        }
    },
    "ui-avatar": {
        mapConfig: (config) => ({
            type: "ui-avatar",
            id: getUiId(config),
            parent: config.parent || undefined,
            mount: config.mount || config.parent,
            order: toOptionalNumber(config.order),
            src: getBinding(config.src, config.srcPath ? stateBinding(config.srcPath) : undefined),
            initials: config.initials || undefined,
            alt: config.alt || undefined,
            size: config.size || undefined,
            shape: config.shape || undefined,
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: componentStateInputHandler
        }
    },
    "ui-divider": {
        mapConfig: (config) => ({
            type: "ui-divider",
            id: getUiId(config),
            parent: config.parent || undefined,
            mount: config.mount || config.parent,
            order: toOptionalNumber(config.order),
            orientation: config.orientation || undefined,
            label: config.label || undefined,
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: componentStateInputHandler
        }
    }
};

function registerNodeType(RED, type) {
    registerEndpoints(RED);
    const registration = runtimeNodeRegistry[type];

    if (!registration) {
        throw new Error(`Unknown webapp node type '${type}'.`);
    }

    createNodeConstructor(RED, type, registration.mapConfig, registration.options);
}

function registerWebappNodes(RED) {
    runtimeState.RED = RED;
    Object.keys(runtimeNodeRegistry).forEach((type) => {
        registerNodeType(RED, type);
    });
}

registerWebappNodes.__test__ = {
    applyPreviewAction,
    applyStoreOperation,
    getPreviewMessages,
    getAppModelResult,
    renderAppPage,
    resetPreview,
    componentStateInputHandler,
    dialogInputHandler,
    queryInputHandler,
    triggerParamQueryRefresh,
    // P20a
    buttonInputHandler,
    actionInputHandler,
    runtimeNodeRegistry,
    runtimeState,
    // P15
    getClientState,
    setClientState,
    resolveReconnectState
};

registerWebappNodes.registerNodeType = registerNodeType;

module.exports = registerWebappNodes;
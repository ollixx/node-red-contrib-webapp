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
const { createRendererApp, mapComponentToShoelace, buildShoelaceTokenBridgeCss } = require("../packages/renderer/dist/index.js");
const { buildDesignTokenCss } = require("../packages/schema/dist/index.js");
// P26: the snapshot → Shoelace markup serializer is shared with the thin client
// (resources/lib/webapp-serializer.js) so server and browser cannot drift apart.
const sharedSerializer = require("../resources/lib/webapp-serializer.js");

// P22: the thin client runtime is served statically from resources/. Node-RED
// exposes a plugin's resources/ dir under resources/<module-name>/.
const CLIENT_RUNTIME_PATH = "/resources/node-red-contrib-webapp/lib/webapp-client.js";
// P26: shared snapshot serializer, served statically and consumed by the thin
// client (window.WebappSerializer) so the browser emits the same markup as the
// server. Loaded before the client runtime.
const CLIENT_SERIALIZER_PATH = "/resources/node-red-contrib-webapp/lib/webapp-serializer.js";

// P23: the default rendering target is Web Components (Shoelace, MIT) — see
// ADR 0002. Shoelace is loaded as an ES module / static resource (no bundler);
// the autoloader registers each custom element on first use. Components are
// themed natively through CSS custom properties, so the design tokens plug in
// without per-token translation.
const SHOELACE_VERSION = "2.20.1";
const SHOELACE_CDN_BASE = `https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@${SHOELACE_VERSION}/cdn`;
const SHOELACE_THEME_HREF = `${SHOELACE_CDN_BASE}/themes/light.css`;
const SHOELACE_AUTOLOADER_SRC = `${SHOELACE_CDN_BASE}/shoelace-autoloader.js`;

const runtimeState = {
    definitions: new Map(),
    queryEtags: new Map(),
    // liveState: appId → merged store state for broadcast (no clientId) updates.
    // Per-client state (clientStateMap) takes precedence when a clientId is present.
    liveState: new Map(),
    // clientStateMap: appId → Map<clientId, { state, timestamp }>
    clientStateMap: new Map(),
    // P31: live Server→Client SSE subscribers.
    // streamClients: appId → Map<clientId, { res, location }>
    // Each connected EventSource registers here; flow-driven store/action updates
    // are pushed to the targeted client (msg.ui.clientId) or broadcast to all.
    streamClients: new Map(),
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

// P23: design tokens may arrive as an object (typed fixture / gen-example) or a
// JSON string (editor field). Returns a plain object or undefined.
function parseTokens(value) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
        return value;
    }

    if (typeof value !== "string" || value.trim().length === 0) {
        return undefined;
    }

    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : undefined;
    }
    catch (_e) {
        return undefined;
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

// The dialog's Close affordance is the `hide` action targeting that dialog
// (target "dialog:<id>" or an explicit `dialog` field) — derived from config.
function findDialogCloseAction(actions, dialogId) {
    return actions.find((entry) => {
        if (entry.actionType !== "hide") {
            return false;
        }

        const parsed = parseActionTarget(entry.target);
        return (parsed && parsed.scope === "dialog" && parsed.id === dialogId) || entry.dialog === dialogId;
    });
}

function parseActionTarget(target) {
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
            // The button node's id is used as the action target for the /event endpoint.
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
            const disabledBinding = getBinding(component.disabled, component.disabledPath ? stateBinding(component.disabledPath) : undefined);
            const bind = {
                value: getBinding(component.value, stateBinding(joinStatePath(component.storeId ? undefined : "", component.path || "")))
            };
            if (disabledBinding) {
                bind.disabled = disabledBinding;
            }
            return {
                id: component.id,
                kind: "input",
                mount: component.mount || component.parent,
                order: toOptionalNumber(component.order),
                bind,
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

        // P25: P16x interactive kinds — each maps to its semantic kind so the
        // renderer snapshot carries the correct kind and renderComponentHtml can
        // produce the right Shoelace element (or semantic-HTML fallback).
        const P16X_KIND_MAP = {
            "ui-select": "select",
            "ui-checkbox": "checkbox",
            "ui-radio": "radio",
            "ui-switch": "switch",
            "ui-textarea": "textarea",
            "ui-datepicker": "datepicker",
            "ui-slider": "slider",
            "ui-alert": "alert",
            "ui-badge": "badge",
            "ui-progress": "progress",
            "ui-breadcrumb": "breadcrumb",
            "ui-tabs": "tabs",
            "ui-accordion": "accordion",
            "ui-menu": "menu",
            "ui-avatar": "avatar"
        };
        const p16Kind = P16X_KIND_MAP[component.type];

        if (p16Kind) {
            const valueBinding = getBinding(component.value, component.valuePath ? stateBinding(component.valuePath) : undefined);
            const disabledBinding = getBinding(component.disabled, component.disabledPath ? stateBinding(component.disabledPath) : undefined);
            // For alert/badge nodes that use `message`/`value` as primary binding fields
            // (not `value`), fall back to those fields as the value binding so the
            // renderer resolves them and the serializer can read the string from
            // component.value rather than the raw binding object in component.props.
            const messageBinding = !valueBinding && p16Kind === "alert" ? getBinding(component.message, undefined) : undefined;
            const srcBinding = !valueBinding && p16Kind === "avatar" ? getBinding(component.src, undefined) : undefined;
            const bind = {};
            if (valueBinding) {
                bind.value = valueBinding;
            }
            else if (messageBinding) {
                bind.value = messageBinding;
            }
            else if (srcBinding) {
                bind.value = srcBinding;
            }
            if (disabledBinding) {
                bind.disabled = disabledBinding;
            }

            return {
                id: component.id,
                kind: p16Kind,
                mount: component.mount || component.parent,
                order: toOptionalNumber(component.order),
                bind,
                props: {
                    ...(component.label !== undefined ? { label: component.label } : {}),
                    ...(component.placeholder !== undefined ? { placeholder: component.placeholder } : {}),
                    ...(component.options !== undefined ? { options: component.options } : {}),
                    ...(component.multiple !== undefined ? { multiple: component.multiple } : {}),
                    ...(component.searchable !== undefined ? { searchable: component.searchable } : {}),
                    ...(component.rows !== undefined ? { rows: component.rows } : {}),
                    ...(component.maxLength !== undefined ? { maxLength: component.maxLength } : {}),
                    ...(component.min !== undefined ? { min: component.min } : {}),
                    ...(component.max !== undefined ? { max: component.max } : {}),
                    ...(component.step !== undefined ? { step: component.step } : {}),
                    ...(component.showValue !== undefined ? { showValue: component.showValue } : {}),
                    ...(component.severity !== undefined ? { severity: component.severity } : {}),
                    ...(component.title !== undefined ? { title: component.title } : {}),
                    ...(component.dismissible !== undefined ? { dismissible: component.dismissible } : {}),
                    ...(component.message !== undefined ? { message: component.message } : {}),
                    ...(component.variant !== undefined ? { variant: component.variant } : {}),
                    ...(component.items !== undefined ? { items: component.items } : {}),
                    ...(component.tabs !== undefined ? { tabs: component.tabs } : {}),
                    ...(component.orientation !== undefined ? { orientation: component.orientation } : {})
                },
                events: Array.isArray(component.events) ? component.events : []
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

// P26: snapshot → Shoelace markup serialization is delegated to the shared
// module (resources/lib/webapp-serializer.js) so the server and the thin client
// emit byte-identical markup. The local wrappers preserve the existing call
// sites / __test__ exports while the single source of truth lives in one file.
const sanitizeClassSuffix = sharedSerializer.sanitizeClassSuffix;
const getLayoutVariant = sharedSerializer.getLayoutVariant;
const regionContainsInput = sharedSerializer.regionContainsInput;

function renderLayoutHtml(layoutId, regions, serializerContext) {
    return sharedSerializer.renderLayoutHtml(layoutId, regions, serializerContext);
}

function renderRegionHtml(region, layoutId, serializerContext) {
    return sharedSerializer.renderRegionHtml(region, layoutId, serializerContext);
}

function renderComponentHtml(component, layoutId, serializerContext) {
    return sharedSerializer.renderComponentHtml(component, layoutId, serializerContext);
}

function defaultRouteLocation(model) {
    const firstRoute = model.routes.find((route) => route.path && route.path !== "*");
    return firstRoute ? firstRoute.path : "/";
}

// P30: walk a rendered snapshot's region tree for a table component by id so a
// rowSelect / rowAction event can carry the full `row` object (events.md params),
// resolved read-only from the current render — never from a runtime data store.
function findSnapshotComponent(regions, componentId) {
    if (!Array.isArray(regions)) {
        return undefined;
    }
    for (const region of regions) {
        for (const component of region.components || []) {
            if (component.id === componentId) {
                return component;
            }
            if (component.kind === "container") {
                const nested = findSnapshotComponent(component.regions, componentId);
                if (nested) {
                    return nested;
                }
            }
        }
    }
    return undefined;
}

function resolveTableRow(appId, location, tableId, rowId, definitions) {
    const built = buildAppSnapshot(appId, location || "/", undefined, definitions);
    if (!built.success || !built.snapshot) {
        return undefined;
    }
    const table = findSnapshotComponent(built.snapshot.regions, tableId);
    const rows = table && Array.isArray(table.rows) ? table.rows : [];
    return rows.find((row) => row && row.id !== undefined && String(row.id) === String(rowId));
}

// P30: ingest a RAW client event and emit it on the ORIGINATING node's output
// port. The browser reports WHAT HAPPENED ({appId, clientId, event, sourceId,
// params}); it never names or runs an action. There is no automatic event→action
// link — the runtime takes NO domain action here. The wired Node-RED flow is the
// only place that may react. See docs/nodes/concepts/events.md.
function dispatchClientEvent(RED, appId, body, definitions) {
    const sourceId = body && body.sourceId ? String(body.sourceId) : undefined;
    const event = body && body.event ? String(body.event) : undefined;

    if (!sourceId) {
        return { success: false, status: 400, body: "Missing sourceId." };
    }

    if (!event) {
        return { success: false, status: 400, body: "Missing event." };
    }

    const clientId = body && body.clientId ? String(body.clientId) : undefined;
    const location = body && body.location ? String(body.location) : "/";
    const params = body && body.params && typeof body.params === "object" ? { ...body.params } : {};

    // Enrich documented table events with the full row object when only a rowId
    // was reported. This is a read-only render lookup, not a data action.
    if ((event === "rowSelect" || event === "rowAction") && params.rowId !== undefined && params.row === undefined) {
        const row = resolveTableRow(appId, location, sourceId, params.rowId, definitions);
        if (row !== undefined) {
            params.row = clone(row);
        }
    }

    const message = {
        ui: {
            appId,
            clientId,
            event,
            sourceId,
            params
        }
    };

    const node = RED && RED.nodes && typeof RED.nodes.getNode === "function"
        ? RED.nodes.getNode(sourceId)
        : undefined;

    if (!node || typeof node.send !== "function") {
        return { success: false, status: 404, body: `Unknown source node '${sourceId}'.` };
    }

    // Emit on the originating node's OUTPUT port — into the wired flow. The
    // runtime does nothing else: no state mutation, no action dispatch.
    node.send(clone(message));

    return { success: true, message };
}

// Builds the RenderSnapshot for an app + location + open dialog.
// The HTML route, the SSE stream initial sync, and the /event response all use this.
function buildAppSnapshot(appId, location, dialogId, definitions, clientId) {
    const modelResult = getAppModelResult(appId, definitions);

    if (!modelResult.success) {
        return { success: false, status: modelResult.status, message: modelResult.message };
    }

    const { model } = modelResult;
    const routeMatch = getRouteMatch(location, model.routes);

    if (!routeMatch) {
        return { success: false, status: 404, message: `No route matched '${location}'.` };
    }

    const layout = getLayout(model, routeMatch.route.layoutId);

    if (!layout) {
        return { success: false, status: 500, message: "Missing layout." };
    }

    const buckets = getDefinitionBuckets(appId, definitions);
    const integration = {
        navigations: buckets.navigations.map((entry) => ({ id: entry.id, to: entry.to })),
        queries: buckets.queries,
        actions: buckets.actions,
        stores: buckets.stores
    };
    const queries = {};
    const state = initializeState(integration.stores, integration.queries, appId);
    // Per-client state wins when a clientId is given and that client has its own
    // state (P15 multi-user model); otherwise fall back to the shared broadcast state.
    const clientStateEntry = clientId ? getClientState(appId, clientId) : null;
    const broadcastState = runtimeState.liveState.get(appId);
    const resolvedState = clientStateEntry ? clientStateEntry.state : broadcastState;
    const hydratedState = resolvedState ? mergeDeep(state, resolvedState) : state;
    const effectiveState = dialogId ? setValueAtPath(hydratedState, `ui.dialogs.${dialogId}.open`, true) : hydratedState;

    // P21: a single RenderSnapshot from packages/renderer is the source of truth.
    // webapp.js no longer re-walks the AppModel — it only serializes this snapshot.
    const rendererApp = createRendererApp(model, {
        integration,
        location,
        state: effectiveState,
        queries
    });

    return {
        success: true,
        status: 200,
        model,
        routeMatch,
        layout,
        tokens: parseTokens(buckets.app && buckets.app.tokens),
        snapshot: rendererApp.render()
    };
}

function renderAppPage(appId, location, dialogId, definitions) {
    const built = buildAppSnapshot(appId, location, dialogId, definitions);

    if (!built.success) {
        const heading = built.status === 404 ? "Unknown route" : built.status === 500 ? "Missing layout" : "Incomplete app";
        return {
            status: built.status,
            body: `<!doctype html><html><body><h1>${heading}</h1><p>${escapeHtml(built.message)}</p></body></html>`
        };
    }

    const { model, routeMatch, snapshot, tokens } = built;
    // P23: design tokens → CSS custom properties (consumed natively by the Web
    // Components) plus the --wa-* → --sl-* bridge so Shoelace is themed without
    // per-token translation. Unset tokens fall back to the defaults below.
    const tokenCss = buildDesignTokenCss(tokens);
    const shoelaceBridgeCss = buildShoelaceTokenBridgeCss();
    const serializerContext = {
        appId: model.id,
        location: snapshot.location,
        params: snapshot.params,
        formId: undefined
    };

    // P26/P27: dialogs are serialized through the shared module so the server and
    // the thin client emit identical markup. The Close affordance is config-driven:
    // it is the `hide` action that targets this dialog (no hard-coded wiring).
    const dialogBuckets = getDefinitionBuckets(appId, definitions);
    const dialogHtml = snapshot.dialogs
        .map((dialog) => {
            const closeAction = findDialogCloseAction(dialogBuckets.actions, dialog.id);
            return sharedSerializer.renderDialogHtml(
                closeAction ? { ...dialog, closeAction: closeAction.id, closeSource: closeAction.id } : dialog,
                serializerContext
            );
        })
        .join("");
    const isAppLayout = snapshot.layout.id === "app";
    const pageBody = renderLayoutHtml(snapshot.layout.id, snapshot.regions, serializerContext);

    // P36: for the `app` layout preset, prepend a branded top app bar showing
    // the ui-app title. The app bar is a shell concern (not a mounted component)
    // styled entirely via --wa-color-primary / --wa-color-primary-fg tokens.
    const appBarHtml = isAppLayout
        ? `<header class="webapp-app-bar"><span class="webapp-app-bar-title">${escapeHtml(model.title || model.id)}</span></header>`
        : "";

    return {
        status: 200,
        body: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(model.title)} - ${escapeHtml(routeMatch.route.title || routeMatch.route.id)}</title>
  <link rel="stylesheet" href="${SHOELACE_THEME_HREF}">
  <script type="module" src="${SHOELACE_AUTOLOADER_SRC}"></script>
  <style>
    /* P24: webapp-default design tokens. User tokens on ui-app (below) override
       these; the Web Components consume them natively as CSS custom properties. */
    :root {
      color-scheme: light;
      --wa-color-primary:#3b82f6; --wa-color-primary-fg:#ffffff;
      --wa-color-danger:#ef4444; --wa-color-danger-fg:#ffffff;
      --wa-color-success:#22c55e; --wa-color-warning:#f59e0b;
      --wa-color-neutral:#6b7280; --wa-color-background:#ffffff;
      --wa-color-surface:#f9fafb; --wa-color-border:#e5e7eb;
      --wa-color-text:#111827; --wa-color-text-muted:#6b7280;
      --wa-font-family:system-ui, sans-serif; --wa-font-size-base:16px;
      --wa-radius-md:6px;
    }
    /* P23: --wa-* → --sl-* bridge (Shoelace themed via the same tokens). */
${shoelaceBridgeCss.split("\n").map((line) => `    ${line}`).join("\n")}
    /* P24: user-defined ui-app tokens (highest precedence). */
${tokenCss ? tokenCss.split("\n").map((line) => `    ${line}`).join("\n") : "    /* (no app tokens set) */"}
    * { box-sizing:border-box; }
    body { margin:0; font-family:var(--wa-font-family); font-size:var(--wa-font-size-base); color:var(--wa-color-text); background:var(--wa-color-background); }
    a { color:inherit; text-decoration:none; }
    /* P36: non-app layouts are constrained; the app-layout shell fills the viewport */
    #webapp-client-root { max-width:1100px; margin:0 auto; padding:24px 20px 60px; }
    #webapp-client-root.webapp-is-app-layout { max-width:none; padding:0; display:flex; flex-direction:column; min-height:100vh; }
    .webapp-grid { display:grid; gap:16px; }
    /* P36: for app layout the grid wrapper is a pass-through flex container */
    .webapp-is-app-layout .webapp-grid { display:contents; }
    .webapp-layout { display:grid; gap:16px; }
    /* P36: app-layout shell — mobile-first stacked; desktop: sidebar + content */
    .webapp-layout--app { display:flex; flex-direction:column; gap:0; min-height:0; flex:1; }
    /* P36: app bar — themed via --wa-color-primary token, no hard-coded color */
    .webapp-app-bar { display:flex; align-items:center; gap:12px; padding:0 20px; height:56px; background:var(--wa-color-primary); color:var(--wa-color-primary-fg); flex-shrink:0; }
    .webapp-app-bar-title { font-size:1.1rem; font-weight:600; letter-spacing:0.01em; flex:1; }
    /* P36: slot regions — frameless; structure from whitespace and type hierarchy */
    .webapp-slot { padding:0; }
    .webapp-slot--header { padding:16px 20px; }
    .webapp-slot--navbar { padding:12px 0; }
    .webapp-slot--content { flex:1; padding:20px; min-width:0; }
    .webapp-slot--footer { padding:12px 20px; border-top:1px solid var(--wa-color-border); }
    .webapp-slot-body { gap:12px; }
    .webapp-slot-body--vertical, .webapp-slot-body--app, .webapp-slot-body--custom { display:flex; flex-direction:column; }
    .webapp-slot-body--horizontal { display:flex; flex-direction:row; align-items:flex-start; flex-wrap:wrap; }
    .webapp-slot-body--horizontal > * { flex:1 1 220px; min-width:0; }
    .webapp-slot-body--grid { display:grid; grid-template-columns:repeat(12, minmax(0, 1fr)); gap:12px; }
    .webapp-slot-body--absolute { position:relative; min-height:320px; }
    .webapp-item--absolute { position:absolute; }
    /* P36: navbar — frameless stacked nav links; active state via color */
    .webapp-nav-list { display:flex; flex-direction:column; gap:0; list-style:none; margin:0; padding:0; }
    .webapp-nav-item a, .webapp-nav-link { display:block; padding:10px 20px; font-size:0.95rem; font-weight:500; color:var(--wa-color-text); text-decoration:none; transition:color 0.15s, background 0.15s; }
    .webapp-nav-item a:hover, .webapp-nav-link:hover { color:var(--wa-color-primary); background:color-mix(in srgb, var(--wa-color-primary) 8%, transparent); }
    .webapp-nav-item[aria-current="page"] a, .webapp-nav-link[aria-current="page"] { color:var(--wa-color-primary); font-weight:600; border-left:3px solid var(--wa-color-primary); padding-left:17px; }
    /* P36: buttons inside the navbar slot render as plain nav-style links, not pill buttons */
    .webapp-slot--navbar sl-button::part(base) { border:none; background:transparent; border-radius:0; width:100%; justify-content:flex-start; padding:10px 20px; font-size:0.95rem; font-weight:500; color:var(--wa-color-text); box-shadow:none; }
    .webapp-slot--navbar sl-button::part(base):hover { color:var(--wa-color-primary); background:color-mix(in srgb, var(--wa-color-primary) 8%, transparent); }
    .webapp-slot--navbar .webapp-item { width:100%; }
    .webapp-text { font-size:1.05rem; }
    .webapp-table { width:100%; border-collapse:collapse; background:var(--wa-color-surface); border-radius:var(--wa-radius-md); overflow:hidden; }
    .webapp-table th, .webapp-table td { padding:10px 12px; border-bottom:1px solid var(--wa-color-border); text-align:left; }
    .webapp-form { display:grid; gap:10px; }
    .webapp-field { display:grid; gap:6px; color:var(--wa-color-text-muted); font-size:0.95rem; }
    .webapp-container { display:grid; gap:12px; }
    .webapp-dialog { position:fixed; inset:0; background:rgba(20,26,31,0.38); display:flex; align-items:center; justify-content:center; padding:24px; }
    .webapp-dialog-card { width:min(720px, 100%); background:var(--wa-color-surface); border-radius:var(--wa-radius-md); padding:20px; box-shadow:0 25px 70px rgba(0,0,0,0.18); }
    .webapp-dialog-head { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:12px; }
    .webapp-link { color:var(--wa-color-primary); font-weight:700; }
    /* P36: desktop — sidebar layout; navbar collapses over content on narrow viewports */
    @media (min-width:900px) {
      .webapp-layout--app { flex-direction:row; flex-wrap:wrap; }
      .webapp-slot--header { flex:0 0 100%; }
      .webapp-slot--navbar { width:220px; flex-shrink:0; border-right:1px solid var(--wa-color-border); min-height:calc(100vh - 56px); padding-top:16px; }
      .webapp-slot--content { flex:1; }
      .webapp-slot--footer { flex:0 0 100%; }
    }
  </style>
</head>
<body>
  ${appBarHtml}
  <div id="webapp-client-root"${isAppLayout ? " class=\"webapp-is-app-layout\"" : ""}
       data-webapp-app-id="${escapeAttribute(model.id)}"
       data-webapp-location="${escapeAttribute(snapshot.location)}"${dialogId ? ` data-webapp-dialog="${escapeAttribute(dialogId)}"` : ""}>
    <div class="webapp-grid">${pageBody}</div>
    ${dialogHtml}
  </div>
  <script src="${CLIENT_SERIALIZER_PATH}" defer></script>
  <script src="${CLIENT_RUNTIME_PATH}" defer></script>
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

                const baseDefinition = {
                    ...registration.mapConfig(entry),
                    z: entry.z
                };

                // P39: merge the in-memory `value` patch from viewNodePatchInputHandler
                // into the flow-file-derived definition so SSE snapshots and
                // re-renders reflect msg.payload updates. Only applied to view nodes
                // that carry a `value` binding (structural nodes like ui-app do not).
                const liveRegistration = runtimeState.definitions.get(entry.id);
                if (liveRegistration && liveRegistration.definition
                        && liveRegistration.definition.type === entry.type
                        && liveRegistration.definition.value !== undefined
                        && liveRegistration.definition.value !== baseDefinition.value) {
                    return Object.assign({}, baseDefinition, {
                        value: liveRegistration.definition.value
                    });
                }

                return baseDefinition;
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
        components: matchingDefinitions.filter((entry) => ["ui-text", "ui-button", "ui-table", "ui-container", "ui-input", "ui-select", "ui-checkbox", "ui-radio", "ui-switch", "ui-textarea", "ui-datepicker", "ui-slider", "ui-alert", "ui-toast", "ui-progress", "ui-skeleton", "ui-badge", "ui-empty-state", "ui-tabs", "ui-accordion", "ui-breadcrumb", "ui-menu", "ui-pagination", "ui-stepper", "ui-avatar"].includes(entry.type)),
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

// P22: a self-contained JSON body reader so the event endpoint does not depend on
// Node-RED's optional httpNode body-parser configuration. If a body parser already
// ran (req.body present), it is reused.
function readJsonBody(req, res, next) {
    if (req.body && typeof req.body === "object") {
        next();
        return;
    }

    let raw = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
        raw += chunk;
        if (raw.length > 1_000_000) {
            req.destroy();
        }
    });
    req.on("end", () => {
        try {
            req.body = raw ? JSON.parse(raw) : {};
        }
        catch {
            req.body = {};
        }
        next();
    });
    req.on("error", () => {
        req.body = {};
        next();
    });
}

// ════════════════════════════════════════════════════════════════════════
// P31: live Server→Client push transport (SSE).
//
// Decision recorded in docs/adr/0003: a one-directional Server-Sent Events
// stream on the existing httpNode router. Client→Server is already the
// POST /event path (P30); this supplies the only missing direction. Each
// connected EventSource registers under appId + clientId so a flow-driven
// store/action update addressed to msg.ui.clientId reaches exactly that client,
// and a broadcast (no clientId) fans out to every subscriber of the app.
// ════════════════════════════════════════════════════════════════════════

function getStreamSubscribers(appId) {
    let subscribers = runtimeState.streamClients.get(appId);
    if (!subscribers) {
        subscribers = new Map();
        runtimeState.streamClients.set(appId, subscribers);
    }
    return subscribers;
}

function addStreamClient(appId, clientId, res, location) {
    // P37: record the connect time so the redeploy broadcast can skip clients
    // that just connected (the deploy that triggered flows:started fired BEFORE
    // this client connected — reloading them immediately would be a false positive).
    // Suppress write errors on the response and its socket so that EPIPE errors
    // (browser disconnects) do not crash the server when the redeploy broadcast
    // writes to stale handles.
    const noop = function () { /* suppress */ };
    if (typeof res.on === "function") {
        res.on("error", noop);
    }
    if (res.socket && typeof res.socket.on === "function") {
        res.socket.on("error", noop);
    }
    getStreamSubscribers(appId).set(clientId, { res, location: location || "/", connectedAt: Date.now() });
}

function removeStreamClient(appId, clientId) {
    const subscribers = runtimeState.streamClients.get(appId);
    if (subscribers) {
        subscribers.delete(clientId);
        if (subscribers.size === 0) {
            runtimeState.streamClients.delete(appId);
        }
    }
}

// Serialise a single SSE message frame. A named event lets the browser
// distinguish a full snapshot re-render from an interaction command.
function writeStreamEvent(res, eventName, payload) {
    if (!res || typeof res.write !== "function") {
        return;
    }
    res.write(`event: ${eventName}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

// Push the current snapshot (built from the live node state) to one client, or
// to every subscriber of the app when clientId is undefined (broadcast). Each
// client is rendered at ITS OWN current location, with ITS OWN per-client state.
function pushSnapshotToClients(appId, clientId, definitions) {
    const subscribers = runtimeState.streamClients.get(appId);
    if (!subscribers || subscribers.size === 0) {
        return;
    }

    const targets = clientId
        ? (subscribers.has(clientId) ? [[clientId, subscribers.get(clientId)]] : [])
        : Array.from(subscribers.entries());

    for (const [targetClientId, entry] of targets) {
        const built = buildAppSnapshot(appId, entry.location || "/", undefined, definitions, targetClientId);
        if (built.success) {
            writeStreamEvent(entry.res, "snapshot", { snapshot: built.snapshot });
        }
    }
}

// Push an interaction command (navigate / openDialog / show / hide / …) produced
// by a ui-action in the flow to the targeted client(s). Interaction commands change
// INTERACTION state only (actions.md) — never business data. When the command moves
// the client to a new route, the server remembers the new location so subsequent
// snapshot pushes render the right page.
function pushActionCommandToClients(appId, clientId, command) {
    const subscribers = runtimeState.streamClients.get(appId);
    if (!subscribers || subscribers.size === 0) {
        return;
    }

    const targets = clientId
        ? (subscribers.has(clientId) ? [[clientId, subscribers.get(clientId)]] : [])
        : Array.from(subscribers.entries());

    for (const [, entry] of targets) {
        if (command && command.type === "navigate" && command.to) {
            entry.location = String(command.to);
        }
        writeStreamEvent(entry.res, "command", { command });
    }
}

// Map a ui-action definition + incoming msg into the interaction command the
// client applies. Domain-agnostic: only the documented interaction verbs.
function buildActionCommand(actionDefinition, msg) {
    const uiMsg = msg && msg.ui && typeof msg.ui === "object" ? msg.ui : {};
    const override = uiMsg.action && typeof uiMsg.action === "object" ? uiMsg.action : {};
    const type = override.type || (actionDefinition && actionDefinition.actionType);
    if (!type) {
        return null;
    }
    return {
        type: String(type),
        to: override.to || (actionDefinition && actionDefinition.to) || undefined,
        target: override.target || override.targetId || (actionDefinition && actionDefinition.target) || undefined
    };
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

    // P31: live Server→Client SSE stream. The browser opens an EventSource here
    // with its clientId and current location; the runtime registers it and pushes
    // an initial snapshot immediately (which subsumes the P15 reconnect sync).
    // Thereafter, flow-driven ui-store updates push `snapshot` events and ui-action
    // interaction commands push `command` events to the relevant client(s).
    RED.httpNode.get("/webapp/:appId/stream", (req, res) => {
        const { appId } = req.params;
        const clientId = req.query.clientId ? String(req.query.clientId) : undefined;
        const location = req.query.location ? String(req.query.location) : "/";
        // The client passes the initial dialogId so the first snapshot mirrors the
        // server-rendered page (e.g. when ?dialog=<id> was in the page URL).
        const initialDialogId = req.query.dialog ? String(req.query.dialog) : undefined;

        if (!clientId) {
            res.status(400).json({ error: "A clientId query parameter is required to subscribe." });
            return;
        }

        const buckets = getDefinitionBuckets(appId, readDeployDefinitions(RED));
        if (!buckets.app) {
            res.status(404).json({ error: `Unknown app '${appId}'.` });
            return;
        }

        res.status(200);
        res.set({
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive"
        });
        if (typeof res.flushHeaders === "function") {
            res.flushHeaders();
        }
        // Open the SSE comment line so proxies do not buffer the stream.
        res.write(":ok\n\n");

        addStreamClient(appId, clientId, res, location);

        // Initial sync: push the current live snapshot for this client immediately.
        // Pass the initialDialogId so the first push matches the server-rendered HTML
        // (prevents the SSE hydration from closing a dialog opened via ?dialog=<id>).
        const built = buildAppSnapshot(appId, location, initialDialogId, readDeployDefinitions(RED), clientId);
        if (built.success) {
            writeStreamEvent(res, "snapshot", { snapshot: built.snapshot });
        }

        req.on("close", () => {
            removeStreamClient(appId, clientId);
        });
    });

    // P30: client→server event ingest. The browser reports WHAT HAPPENED — a raw
    // event { clientId, event, sourceId, params } (events.md) — and the runtime
    // routes it to the originating node, emitting msg.ui on that node's OUTPUT
    // port into the wired flow. The runtime takes NO domain action. The wired flow
    // is the only place that may react; live push is via the SSE stream (P31).
    // The response echoes the emitted message and the CURRENT snapshot (unchanged —
    // a read-only re-render) so the thin client keeps a consistent view between pushes.
    RED.httpNode.post("/webapp/:appId/event", readJsonBody, (req, res) => {
        const { appId } = req.params;
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const definitions = readDeployDefinitions(RED);

        const dispatched = dispatchClientEvent(RED, appId, body, definitions);

        if (!dispatched.success) {
            res.status(dispatched.status).json({ error: dispatched.body });
            return;
        }

        const location = body.location ? String(body.location) : "/";
        const built = buildAppSnapshot(appId, location, undefined, definitions);

        if (!built.success) {
            res.status(built.status).json({ error: built.message });
            return;
        }

        res.json({
            message: dispatched.message,
            location,
            snapshot: built.snapshot
        });
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
// Click events arrive as msg.ui.event = "click" from the /event endpoint.
function buttonInputHandler(node, msg, send, done) {
    const uiMsg = msg && msg.ui && typeof msg.ui === "object" ? msg.ui : undefined;

    // If this is a component-state op, delegate to componentStateInputHandler behaviour
    if (uiMsg && uiMsg.component && typeof uiMsg.component.op === "string") {
        return componentStateInputHandler(node, msg, send, done);
    }

    // P39: msg.ui.patch or msg.payload updates the button label (and pushes snapshot).
    if ((uiMsg && uiMsg.patch && typeof uiMsg.patch === "object") ||
        (msg.payload !== undefined && msg.payload !== null && !(uiMsg && uiMsg.event))) {
        return viewNodePatchInputHandler(node, msg, send, done);
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

// P39: locate the ui-app that owns a view node by matching their flow tab (z).
// Falls back to getActiveRuntimeAppId() when the flow tab cannot be determined.
function findAppIdForNode(node) {
    const flowId = node.z;
    if (flowId) {
        for (const registration of runtimeState.definitions.values()) {
            const def = registration.definition;
            if (def.type === "ui-app" && registration.nodeId) {
                // The app node's own Node-RED node also has .z matching the flow
                const appNode = runtimeState.RED ? runtimeState.RED.nodes.getNode(registration.nodeId) : null;
                if (appNode && appNode.z === flowId) {
                    return def.id;
                }
            }
        }
    }
    return getActiveRuntimeAppId();
}

// P39: primary mutable field for each view-node type when msg.payload is used.
const VIEW_NODE_PRIMARY_FIELD = {
    "ui-text": "value",
    "ui-button": "label",
    "ui-badge": "value",
    "ui-checkbox": "value",
    "ui-switch": "value",
    "ui-radio": "value",
    "ui-select": "value",
    "ui-input": "value",
    "ui-textarea": "value",
    "ui-slider": "value",
    "ui-datepicker": "value",
    "ui-progress": "value",
    "ui-image": "src",
    "ui-avatar": "src",
    "ui-alert": "message",
    "ui-table": "rows",
    "ui-list": "items"
};

// Binding-wrapped fields — msg.payload is wrapped in a literalBinding so
// the renderer can resolve them like any other binding.
const VIEW_NODE_BINDING_FIELDS = new Set([
    "value", "src", "message", "rows", "items"
]);

// P39: handle incoming msg.payload / msg.ui.patch on view nodes.
// Patches the in-memory definition and pushes a fresh snapshot to all
// connected clients of the parent app.
function viewNodePatchInputHandler(node, msg, send, done) {
    const uiMsg = msg && msg.ui && typeof msg.ui === "object" ? msg.ui : undefined;

    // Delegate component-op messages (show/hide/enable/disable/…) as before.
    if (uiMsg && uiMsg.component && typeof uiMsg.component.op === "string") {
        return componentStateInputHandler(node, msg, send, done);
    }

    const registration = runtimeState.definitions.get(node.id);
    if (!registration) {
        send(msg);
        if (done) { done(); }
        return;
    }

    let patched = false;

    // msg.ui.patch — arbitrary field overrides supplied by the flow author.
    if (uiMsg && uiMsg.patch && typeof uiMsg.patch === "object") {
        registration.definition = Object.assign({}, registration.definition, uiMsg.patch);
        node.webappDefinition = registration.definition;
        patched = true;
    } else if (msg.payload !== undefined && msg.payload !== null) {
        // msg.payload — sets the primary mutable field for this node type.
        const nodeType = registration.definition.type;
        const field = VIEW_NODE_PRIMARY_FIELD[nodeType];
        if (field) {
            const newValue = VIEW_NODE_BINDING_FIELDS.has(field)
                ? literalBinding(msg.payload)
                : msg.payload;
            registration.definition = Object.assign({}, registration.definition, { [field]: newValue });
            node.webappDefinition = registration.definition;
            patched = true;
        }
    }

    if (patched) {
        const RED = runtimeState.RED;
        if (RED) {
            const appId = findAppIdForNode(node);
            if (appId) {
                pushSnapshotToClients(appId, undefined, readDeployDefinitions(RED));
            }
        }
    }

    send(msg);
    if (done) { done(); }
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

    // P31: a ui-action triggered FROM the flow pushes an interaction command
    // (navigate / openDialog / show / hide / …) to the targeted client(s). The
    // command changes interaction state only (actions.md) — it never touches
    // business data. clientId targeting honours the P15 multi-user model.
    const activeAppId = getActiveRuntimeAppId();
    const actionClientId = uiMsg && uiMsg.clientId ? String(uiMsg.clientId) : undefined;
    const command = buildActionCommand(node.webappDefinition, msg);
    if (RED && activeAppId && command) {
        pushActionCommandToClients(activeAppId, actionClientId, command);
    }

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
            events: parseJsonList(config.events).length > 0 ? parseJsonList(config.events) : undefined,
            // P23: design tokens drive the Web Component theme via CSS custom
            // properties. Carried through unchanged so the page can inject them.
            tokens: parseTokens(config.tokens)
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
            inputHandler: viewNodePatchInputHandler
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
            action: blankToUndefined(config.action),
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
            inputHandler: viewNodePatchInputHandler
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
            disabled: getBinding(config.disabled, config.disabledPath ? stateBinding(config.disabledPath) : undefined),
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: viewNodePatchInputHandler
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
            inputHandler: viewNodePatchInputHandler
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
            inputHandler: viewNodePatchInputHandler
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
            inputHandler: viewNodePatchInputHandler
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
            inputHandler: viewNodePatchInputHandler
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
            inputHandler: viewNodePatchInputHandler
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
            inputHandler: viewNodePatchInputHandler
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
            inputHandler: viewNodePatchInputHandler
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
                    ? (getClientState(activeAppId, clientId)?.state || clone(runtimeState.liveState.get(activeAppId) || initializeState([storeDefinition], [], activeAppId)))
                    : clone(runtimeState.liveState.get(activeAppId) || initializeState([storeDefinition], [], activeAppId));

                const applied = applyStoreOperation(baseState, storeDefinition, operation);
                const now = Date.now();

                if (clientId) {
                    // Update only the per-client state, not the shared broadcast state.
                    setClientState(activeAppId, clientId, applied.nextState, now);
                }
                else {
                    // Broadcast: update the shared live state so all clients and
                    // future page loads render the current value.
                    runtimeState.liveState.set(activeAppId, applied.nextState);
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

                // P31: live push. The node state has changed; push a fresh snapshot
                // to the targeted client (per-client update) or to every subscriber
                // (broadcast). No client POST is involved — the flow drove this.
                const RED = runtimeState.RED;
                if (RED) {
                    pushSnapshotToClients(activeAppId, clientId, readDeployDefinitions(RED));
                }

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
            target: blankToUndefined(config.target),
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
            inputHandler: viewNodePatchInputHandler
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
            inputHandler: viewNodePatchInputHandler
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
            inputHandler: viewNodePatchInputHandler
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
            items: getBinding(config.items, config.itemsPath ? stateBinding(config.itemsPath) : undefined) || (Array.isArray(config.items) ? config.items : parseList(config.items)),
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
            inputHandler: viewNodePatchInputHandler
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
            inputHandler: viewNodePatchInputHandler
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
            inputHandler: viewNodePatchInputHandler
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
    // P31: the live push (and dynamic action targeting) needs the RED runtime to
    // resolve nodes and read deploy definitions. Each node self-registers through
    // this path (not the legacy registerWebappNodes factory), so capture RED here.
    runtimeState.RED = RED;
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

    // P37: broadcast a "redeploy" SSE event to every connected client after a
    // flow deploy so browsers automatically reload and pick up the new flow state.
    // Guard: only notify clients that were connected BEFORE this deploy started
    // (i.e. connectedAt is more than 500 ms in the past). Clients that connected
    // during or just after the deploy are loading the new flow already; sending
    // them a redeploy immediately would cause a spurious extra reload.
    RED.events.on("flows:started", function () {
        const deployedAt = Date.now();
        // Defer by one event-loop tick so pending connection-close callbacks
        // (req.on("close") → removeStreamClient) fire first. This avoids sending
        // the redeploy event to connections already closed by the browser.
        setImmediate(function () {
            for (const [, subscribers] of runtimeState.streamClients) {
                for (const [, entry] of subscribers) {
                    // Only notify clients that were connected well before this
                    // deploy — clients that connected AFTER the deploy are
                    // already loading the fresh flow state.
                    if (entry.connectedAt < deployedAt - 500) {
                        try {
                            const res = entry.res;
                            const socket = res.socket;
                            // Only write to connections that are definitely still alive:
                            // the socket must exist, not be destroyed, and not yet
                            // have sent its half-close (FIN). This prevents EPIPE writes
                            // to browser connections that closed between the test page
                            // ending and the TCP FIN propagating to Node.js.
                            const isLive = !res.writableEnded
                                && !res.destroyed
                                && socket
                                && !socket.destroyed
                                && !socket.writableEnded
                                && socket.readable;
                            if (isLive) {
                                writeStreamEvent(res, "redeploy", {});
                            }
                        } catch (_) {
                            // Ignore write errors on stale connections.
                        }
                    }
                }
            }
        });
    });
}

registerWebappNodes.__test__ = {
    // P30: raw client→server event ingest — routes to the originating node and
    // emits msg.ui on its output port; takes no domain action.
    dispatchClientEvent,
    applyStoreOperation,
    getAppModelResult,
    renderAppPage,
    buildAppSnapshot,
    renderLayoutHtml,
    renderComponentHtml,
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
    resolveReconnectState,
    // P31: live Server→Client push transport (SSE)
    addStreamClient,
    removeStreamClient,
    getStreamSubscribers,
    pushSnapshotToClients,
    pushActionCommandToClients,
    buildActionCommand,
    writeStreamEvent
};

registerWebappNodes.registerNodeType = registerNodeType;

module.exports = registerWebappNodes;
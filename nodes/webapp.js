"use strict";

const fs = require("fs");
const path = require("path");
const {
    appModelSchema,
    collectMissingStandardLayouts,
    createAppRootRoute,
    storeOperationSchema,
    uiEventMessageSchema,
    validateUiNodeDefinition
} = require("../packages/schema/dist/index.js");
const { createRendererApp, mapComponentToShoelace, buildShoelaceTokenBridgeCss } = require("../packages/renderer/dist/index.js");
const { buildDesignTokenCss } = require("../packages/schema/dist/index.js");
// P26: the snapshot → Shoelace markup serializer is shared with the thin client
// (resources/lib/webapp-serializer.js) so server and browser cannot drift apart.
const sharedSerializer = require("../resources/lib/webapp-serializer.js");
// P69: icon library registry + manifest (backend-neutral { library, name }).
const iconLibrary = require("./icon-library.js");

// P22: the thin client runtime is served statically from resources/. Node-RED
// exposes a plugin's resources/ dir under resources/<module-name>/.
const CLIENT_RUNTIME_PATH = "/resources/node-red-contrib-webapp/lib/webapp-client.js";
// P26: shared snapshot serializer, served statically and consumed by the thin
// client (window.WebappSerializer) so the browser emits the same markup as the
// server. Loaded before the client runtime.
const CLIENT_SERIALIZER_PATH = "/resources/node-red-contrib-webapp/lib/webapp-serializer.js";

// P106: snapshot/transport contract version. Baked into the shell signature so a
// client whose code-contract predates a server upgrade falls back to a full
// reload rather than an in-place apply that its serializer may not understand.
// Bump this only when the snapshot shape or serializer markup changes (a package
// upgrade), never for an ordinary flow deploy.
const SNAPSHOT_SERIALIZER_VERSION = "1";

// P23: the default rendering target is Web Components (Shoelace, MIT) — see
// ADR 0002. Shoelace is loaded as an ES module / static resource (no bundler);
// the autoloader registers each custom element on first use. Components are
// themed natively through CSS custom properties, so the design tokens plug in
// without per-token translation.
//
// P63 / ADR 0008: Shoelace is self-hosted (vendored), strictly local — NO CDN.
// scripts/vendor-shoelace.js copies the package's `cdn` build into
// resources/shoelace/, which Node-RED serves via the module-resource mechanism
// (same path webapp-client.js rides on — no new HTTP route). SHOELACE_VERSION
// pins the @shoelace-style/shoelace devDependency and drives the vendor copy;
// the vendor script asserts the installed version matches it (drift guard).
// The autoloader auto-detects its own base path from its script URL, so lazy
// component chunks and sl-icon assets resolve under the same local path — no
// setBasePath() call needed.
const SHOELACE_VERSION = "2.20.1";
const SHOELACE_LOCAL_BASE = "/resources/node-red-contrib-webapp/shoelace";
const SHOELACE_THEME_HREF = `${SHOELACE_LOCAL_BASE}/themes/light.css`;
const SHOELACE_AUTOLOADER_SRC = `${SHOELACE_LOCAL_BASE}/shoelace-autoloader.js`;
// P69: on-disk path of the vendored default (Bootstrap-Icons) SVG set, used to
// enumerate icon names for the picker manifest. The matching URL base is
// `${SHOELACE_LOCAL_BASE}/assets/icons`.
const SHOELACE_ICONS_DIR = path.join(__dirname, "..", "resources", "shoelace", "assets", "icons");

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
    endpointsRegistered: false,
    // P106: guard so the flows:started deploy hook is wired exactly once across
    // all node-type registrations (each node calls registerNodeType, which calls
    // registerEndpoints; the hook must not stack one listener per node type).
    deployHookRegistered: false
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
    "ui-divider",
    "ui-log"
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

// P60 / ADR 0007 §3: the ui-action node picker stores a LIST of target node ids.
// The value arrives as a JSON-string array (editor field) or an array (fixture /
// gen-example). Returns a de-duplicated array of non-empty strings, or undefined
// when empty (keeps the definition clean).
function parseTargetIds(value) {
    const list = parseJsonList(value)
        .filter((id) => typeof id === "string" && id.trim().length > 0);
    const deduped = list.filter((id, index) => list.indexOf(id) === index);
    return deduped.length > 0 ? deduped : undefined;
}

// P66 (ADR 0007): a navigate action's named URL params. Arrives as an object
// (typed fixture / gen-example) or a JSON-object string (editor key/value rows).
// Returns a string→string record (non-string values are coerced to String so a
// param taken from a number still fills its URL segment), or undefined when empty.
function parseParamsObject(value) {
    let raw;
    if (value && typeof value === "object" && !Array.isArray(value)) {
        raw = value;
    }
    else if (typeof value === "string" && value.trim().length > 0) {
        try {
            const parsed = JSON.parse(value);
            raw = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : undefined;
        }
        catch (_e) {
            raw = undefined;
        }
    }
    if (!raw) {
        return undefined;
    }
    const out = {};
    for (const key of Object.keys(raw)) {
        const v = raw[key];
        if (v !== undefined && v !== null) {
            out[key] = String(v);
        }
    }
    return Object.keys(out).length > 0 ? out : undefined;
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
    // Prefer parseJsonList for JSON array strings; fall back to parseList for
    // newline/comma-separated plain-text column names.
    const raw = Array.isArray(value) ? value : (parseJsonList(value).length > 0 ? parseJsonList(value) : parseList(value));
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

// P52 / ADR 0004: grid placement props that must stay positive integers (>= 1)
// at RUNTIME, not just at deploy time (P51 enforced the schema side). layoutX /
// layoutY are intentionally excluded — 0 is the legitimate absolute-layout origin.
const PLACEMENT_INTEGER_FIELDS = ["row", "col", "colSize", "rowSize"];

function isPositiveInteger(value) {
    return typeof value === "number" && Number.isInteger(value) && value > 0;
}

// Sanitize a runtime patch's grid placement props. Any of row/col/colSize/rowSize
// present in the patch must resolve to a positive integer; an invalid one is
// dropped from the patch (other keys still apply) and a clear error is raised on
// the node. Returns the cleaned patch (a fresh object; the input is not mutated).
function sanitizePlacementPatch(patch, node) {
    if (!isPlainObject(patch)) {
        return patch;
    }

    const cleaned = { ...patch };
    PLACEMENT_INTEGER_FIELDS.forEach((field) => {
        if (!(field in cleaned)) {
            return;
        }

        const raw = cleaned[field];
        const numeric = typeof raw === "string" ? toOptionalNumber(raw) : raw;
        if (isPositiveInteger(numeric)) {
            cleaned[field] = numeric;
            return;
        }

        delete cleaned[field];
        reportRuntimeError(node, {
            severity: "error",
            code: "client.placement.invalid",
            message: `Grid placement '${field}' must be a positive integer (>= 1); got ${JSON.stringify(raw)} — update ignored.`,
            context: { appId: findAppIdForNode(node), nodeId: node && node.id, op: "viewNodePatchInputHandler" }
        });
    });

    return cleaned;
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

// P69: normalise an icon field config value into the schema-accepted shape.
//  - a dynamic binding ({ kind, … }) → passed through unchanged
//  - a literal { library, name } object → passed through unchanged
//  - a string "name" or "library:name" → parsed into { library, name } (the
//    default library stays implicit: a bare "name" is returned as-is so the
//    renderer/normalizer applies the default)
//  - empty/blank → undefined
function mapIconField(value) {
    if (value === undefined || value === null) {
        return undefined;
    }
    if (typeof value === "object") {
        if (typeof value.kind === "string") {
            return value; // dynamic binding
        }
        if (typeof value.name === "string" && value.name.length > 0) {
            return value; // literal { library, name }
        }
        return undefined;
    }
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed.length === 0) {
            return undefined;
        }
        const sep = trimmed.indexOf(":");
        if (sep > 0 && sep < trimmed.length - 1) {
            return { library: trimmed.slice(0, sep), name: trimmed.slice(sep + 1) };
        }
        return trimmed; // bare name → default library applied downstream
    }
    return undefined;
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
                    ...(blankToUndefined(component.size) ? { size: component.size } : {}),
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
            // P69: icon is binding-capable. A binding (has .kind) is routed via
            // bind.icon so the renderer resolves it into resolvedProps.icon; a
            // literal value ({library,name} or bare string) stays in props.icon.
            const iconBinding = getBinding(component.icon, undefined);
            const buttonBind = component.disabled || component.disabledPath
                ? { disabled: getBinding(component.disabled, stateBinding(component.disabledPath || "")) }
                : {};
            if (iconBinding) {
                buttonBind.icon = iconBinding;
            }
            // P71: href is a binding (mapConfig already normalised a literal string
            // into a literal binding). A dynamic binding routes through bind.href so
            // the renderer resolves it into resolvedProps.href; a literal binding's
            // value goes straight into props.href. Only used in url/navigate modes.
            const hrefDef = component.href;
            const hrefIsBinding = hrefDef && typeof hrefDef === "object" && typeof hrefDef.kind === "string";
            const hrefLiteral = (hrefIsBinding && hrefDef.kind === "literal" && hrefDef.value !== undefined && hrefDef.value !== null && hrefDef.value !== "")
                ? hrefDef.value
                : undefined;
            if (hrefIsBinding && hrefDef.kind !== "literal") {
                buttonBind.href = hrefDef;
            }
            return {
                id: component.id,
                kind: "button",
                mount: component.mount || component.parent,
                order: toOptionalNumber(component.order),
                bind: buttonBind,
                props: {
                    label: component.label,
                    ...(component.icon !== undefined && !iconBinding ? { icon: component.icon } : {}),
                    ...(blankToUndefined(component.variant) ? { variant: component.variant } : {}),
                    // P71: size (sm/md/lg), explicit outline flag, link mode + href.
                    ...(blankToUndefined(component.size) ? { size: component.size } : {}),
                    ...(component.outline === true ? { outline: true } : {}),
                    ...(blankToUndefined(component.linkMode) && component.linkMode !== "button" ? { linkMode: component.linkMode } : {}),
                    ...(hrefLiteral !== undefined ? { href: hrefLiteral } : {}),
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
                    ...(blankToUndefined(component.variant) ? { variant: component.variant } : {}),
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
                    ...(blankToUndefined(component.variant) ? { variant: component.variant } : {}),
                    ...(blankToUndefined(component.size) ? { size: component.size } : {}),
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
            "ui-avatar": "avatar",
            // P70: ui-image renders as a native <img> (kind "image").
            "ui-image": "image",
            // P69: ui-icon is a rendered component (kind "icon").
            "ui-icon": "icon",
            // P45: composite and layout nodes
            "ui-list": "list",
            "ui-pagination": "pagination",
            "ui-stepper": "stepper",
            // P57: log display node
            "ui-log": "log",
            // P83: ui-divider — static separator; renders as sl-divider.
            "ui-divider": "divider"
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
            // P67: ui-alert `title` is a binding (literal/state/.../store) routed
            // through bind.title so the renderer resolves it to a string in
            // resolvedProps.title (the serializer reads component.props.title).
            const titleBinding = p16Kind === "alert" ? getBinding(component.title, undefined) : undefined;
            const srcBinding = !valueBinding && (p16Kind === "avatar" || p16Kind === "image") ? getBinding(component.src, undefined) : undefined;
            // P94: initials binding for ui-avatar — routed through bind.initials so the
            // renderer resolves it to a string in resolvedProps.initials → component.props.initials.
            const initialsBinding = p16Kind === "avatar" ? getBinding(component.initials, undefined) : undefined;
            // P45: pagination uses `page` as its primary binding; stepper uses `activeStep`; list uses `items`.
            const pageBinding = !valueBinding && p16Kind === "pagination" ? getBinding(component.page, component.currentPagePath ? stateBinding(component.currentPagePath) : undefined) : undefined;
            const activeStepBinding = !valueBinding && p16Kind === "stepper" ? getBinding(component.activeStep, component.activeStepPath ? stateBinding(component.activeStepPath) : undefined) : undefined;
            const itemsBinding = !valueBinding && p16Kind === "list" ? getBinding(component.items, component.itemsPath ? stateBinding(component.itemsPath) : undefined) : undefined;
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
            else if (pageBinding) {
                bind.value = pageBinding;
            }
            else if (activeStepBinding) {
                bind.value = activeStepBinding;
            }
            else if (itemsBinding) {
                bind.value = itemsBinding;
            }
            if (disabledBinding) {
                bind.disabled = disabledBinding;
            }
            if (titleBinding) {
                bind.title = titleBinding;
            }
            // P94: initials binding for ui-avatar — resolved by renderer into
            // resolvedProps.initials → component.props.initials (used by serializer).
            if (initialsBinding) {
                bind.initials = initialsBinding;
            }
            // P69: icon field on ui-icon / ui-avatar (and any p16 kind that
            // carries one). A binding (has .kind) is resolved by the renderer
            // into resolvedProps.icon; a literal value stays in props.icon.
            const iconBinding = getBinding(component.icon, undefined);
            if (iconBinding) {
                bind.icon = iconBinding;
            }
            // P97/P98: label binding for ui-checkbox and ui-datepicker — when label is a
            // binding object, route it through bind.label so the renderer resolves it to a
            // string in resolvedProps.label → component.props.label (used by serializer).
            const labelBinding = (p16Kind === "checkbox" || p16Kind === "datepicker") ? getBinding(component.label, undefined) : undefined;
            if (labelBinding) {
                bind.label = labelBinding;
            }

            return {
                id: component.id,
                kind: p16Kind,
                mount: component.mount || component.parent,
                order: toOptionalNumber(component.order),
                bind,
                props: {
                    // P97/P98: For checkbox and datepicker, label may be a binding object — when so
                    // it goes through bind.label; only put it in props when it is a plain string
                    // (or for other nodes that don't support label bindings).
                    ...(component.label !== undefined && !(labelBinding) ? { label: component.label } : {}),
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
                    // P73: ui-switch labelOn/labelOff and ui-datepicker mode were in mapConfig
                    // but omitted from the props block, so the serializer never received them.
                    ...(component.labelOn !== undefined ? { labelOn: component.labelOn } : {}),
                    ...(component.labelOff !== undefined ? { labelOff: component.labelOff } : {}),
                    ...(component.mode !== undefined ? { mode: component.mode } : {}),
                    ...(component.severity !== undefined ? { severity: component.severity } : {}),
                    // P67: ui-alert title is a binding routed through bind.title;
                    // other nodes may still carry a plain-string title prop.
                    ...(component.title !== undefined && !(component.title && typeof component.title === "object" && typeof component.title.kind === "string") ? { title: component.title } : {}),
                    ...(component.dismissible !== undefined ? { dismissible: component.dismissible } : {}),
                    ...(component.message !== undefined ? { message: component.message } : {}),
                    ...(component.variant !== undefined ? { variant: component.variant } : {}),
                    // P92: pulsating → Shoelace `pulse` boolean attribute on sl-badge.
                    ...(component.pulsating !== undefined ? { pulsating: component.pulsating } : {}),
                    // P49: display type (progress/skeleton/badge/menu/list render mode).
                    ...(component.displayType !== undefined ? { displayType: component.displayType } : {}),
                    ...(component.items !== undefined ? { items: component.items } : {}),
                    ...(component.sections !== undefined ? { sections: component.sections } : {}),
                    ...(component.tabs !== undefined ? { tabs: component.tabs } : {}),
                    ...(component.orientation !== undefined ? { orientation: component.orientation } : {}),
                    // P45: composite and layout node props
                    ...(component.steps !== undefined ? { steps: component.steps } : {}),
                    ...(component.page !== undefined ? { page: component.page } : {}),
                    ...(component.totalPages !== undefined ? { totalPages: component.totalPages } : {}),
                    ...(component.activeStep !== undefined ? { activeStep: component.activeStep } : {}),
                    // Store domain-specific events (itemClick, change, etc.) in props
                    // so they reach the serializer without failing Zod event-name validation.
                    ...(Array.isArray(component.events) && component.events.length > 0 ? { componentEvents: component.events } : {}),
                    // P57: ui-log config props
                    ...(component.minSeverity !== undefined ? { minSeverity: component.minSeverity } : {}),
                    ...(component.maxEntries !== undefined ? { maxEntries: component.maxEntries } : {}),
                    ...(component.collapsed !== undefined ? { collapsed: component.collapsed } : {}),
                    // P69: icon literal + ui-icon display props (size/color).
                    ...(component.icon !== undefined && !iconBinding ? { icon: component.icon } : {}),
                    ...(component.size !== undefined ? { size: component.size } : {}),
                    ...(component.color !== undefined ? { color: component.color } : {}),
                    // P93: ui-avatar shape and initials props.
                    // P94: initials is now a binding — routed through bind.initials so the
                    // renderer resolves it. A plain string (back-compat pre-P94) is passed
                    // directly only when no binding was found (initialsBinding would be falsy).
                    // shape is passed directly (circle|square).
                    ...(component.shape !== undefined ? { shape: component.shape } : {}),
                    ...(!initialsBinding && typeof component.initials === "string" && component.initials ? { initials: component.initials } : {}),
                    // P70: ui-image display props. A raw (unresolved) src binding
                    // is kept in props.src so the serializer can fall back to it
                    // when no value binding resolved (mirrors avatar).
                    ...(component.src !== undefined && !srcBinding ? { src: component.src } : {}),
                    // alt is used by ui-image; for ui-avatar it was removed in P93
                    // (sl-avatar uses `label` for a11y). The avatar serializer block
                    // never emits alt= even when this prop is set.
                    ...(component.alt !== undefined ? { alt: component.alt } : {}),
                    ...(component.fit !== undefined ? { fit: component.fit } : {}),
                    ...(component.width !== undefined ? { width: component.width } : {}),
                    ...(component.height !== undefined ? { height: component.height } : {}),
                    ...(component.fallbackSrc !== undefined ? { fallbackSrc: component.fallbackSrc } : {}),
                    // P91: ui-alert duration + countdown — auto-hide and countdown
                    // progress bar. These are mapped by mapConfig but were missing from
                    // the props block, so the serializer never received them.
                    ...(component.duration !== undefined ? { duration: component.duration } : {}),
                    ...(component.countdown !== undefined ? { countdown: component.countdown } : {})
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
        // P109: use `name` (was `title`) for the implicit root route's title.
        routes.push(createAppRootRoute(buckets.app.id, blankToUndefined(buckets.app.name), buckets.app.layout));
    }

    const modelCandidate = {
        id: buckets.app.id,
        // P109: `name` replaces `title` in the AppModel.
        name: buckets.app.name,
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
                modal: dialog.modal !== false,
                // P64: closable defaults to true (only false when explicitly set).
                closable: dialog.closable !== false
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

    // P64: a ui-dialog dismissed natively (X / ESC / overlay → onClose) is the
    // authoritative close. Set ui.dialogs.<id>.open = false on the server and push
    // a fresh snapshot, so every client (incl. ones that did not click) reconciles
    // — there is NO wired close action any more. The client already removed its own
    // dialog optimistically; this makes the server state agree.
    const definitionType = node.webappDefinition ? node.webappDefinition.type : undefined;
    if (definitionType === "ui-dialog" && event === "onClose") {
        const subscribers = runtimeState.streamClients.get(appId);
        if (subscribers && subscribers.size > 0) {
            const targets = clientId
                ? (subscribers.has(clientId) ? [[clientId, subscribers.get(clientId)]] : [])
                : Array.from(subscribers.entries());
            writeDialogOpenState(appId, clientId, sourceId, false);
            pushSnapshotToTargets(appId, targets);
        }
    }

    // Emit on the originating node's OUTPUT port — into the wired flow. The
    // runtime does nothing else: no state mutation, no action dispatch.
    //
    // P64: positional out-port routing. A node with multiple configured events
    // exposes one output port per event (port index === events.indexOf(event)).
    // node.send was previously a bare object → ALWAYS port 0, so e.g. a ui-dialog
    // with events ["onOpen","onClose"] mis-emitted onClose on the onOpen port.
    // Build a sparse output array so the message lands on the matching port.
    const events = node.webappDefinition && Array.isArray(node.webappDefinition.events)
        ? node.webappDefinition.events
        : undefined;
    const portIndex = events ? events.indexOf(event) : -1;

    if (portIndex > 0) {
        const outputs = new Array(portIndex + 1).fill(null);
        outputs[portIndex] = clone(message);
        node.send(outputs);
    }
    else {
        // portIndex 0 (or no per-event ports / event not found) → port 0.
        node.send(clone(message));
    }

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
        appLayout: buckets.app ? buckets.app.layout : undefined,
        tokens: parseTokens(buckets.app && buckets.app.tokens),
        // P70: app-level media store URL (used only to gate asset:<id> rewriting;
        // the URL itself stays server-side).
        mediaStoreUrl: buckets.app ? buckets.app.mediaStoreUrl : undefined,
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

    const { model, routeMatch, snapshot, tokens, appLayout } = built;
    // P106: bake the shell/topology signature + deploy mode into the page so the
    // hydrated client knows its baseline. On a later deploy push (or a /snapshot
    // re-focus pull) the client compares the incoming signature against this one
    // to decide in-place apply vs full reload, and reads the mode to decide
    // auto-update (development) vs version-alert (production).
    const shellSignature = computeShellSignature(appId, definitions);
    const deployMode = resolveAppMode(appId, definitions);
    // P23: design tokens → CSS custom properties (consumed natively by the Web
    // Components) plus the --wa-* → --sl-* bridge so Shoelace is themed without
    // per-token translation. Unset tokens fall back to the defaults below.
    const tokenCss = buildDesignTokenCss(tokens);
    const shoelaceBridgeCss = buildShoelaceTokenBridgeCss();
    // P69: register any additional (non-default) icon libraries on the client via
    // Shoelace's registerIconLibrary(). The %AUTOLOADER_DIR% placeholder resolves
    // to the vendored Shoelace utilities path so registerIconLibrary imports
    // locally (no CDN — ADR 0008). Empty when only the default library exists.
    const iconLibraryRegistrationHtml = iconLibrary
        .buildIconLibraryRegistrationScript()
        .replace(/%AUTOLOADER_DIR%/g, SHOELACE_LOCAL_BASE);
    const serializerContext = {
        appId: model.id,
        location: snapshot.location,
        params: snapshot.params,
        formId: undefined,
        // P70: presence of a media store enables `asset:<id>` src rewriting to the
        // app-scoped backend proxy URL. The real store URL is never exposed here.
        mediaStoreUrl: built.mediaStoreUrl
    };

    // P26: dialogs are serialized through the shared module so the server and the
    // thin client emit identical markup. P64: each dialog renders as a native
    // <sl-dialog> whose X / ESC / overlay dismissal is handled client-side — no
    // hard-coded or wired close action.
    const dialogHtml = snapshot.dialogs
        .map((dialog) => sharedSerializer.renderDialogHtml(dialog, serializerContext))
        .join("");
    // The app-bar is a GLOBAL chrome element — it follows the ui-app node's
    // layout field, not the current route's layoutId. This means the app-bar
    // persists across all routes in the same app, regardless of their individual
    // layout presets.
    const isAppLayout = appLayout === "app";
    const pageBody = renderLayoutHtml(snapshot.layout.id, snapshot.regions, serializerContext);

    // P36: for the `app` layout preset, prepend a branded top app bar.
    // P109: Header-Slot semantics — if the `header` slot has ≥1 mounted component,
    // the slot content (already in pageBody) takes precedence and no `name` title
    // is shown in the app-bar. If the header slot is empty, the app's `name` is
    // rendered as the title inside the app-bar.
    const headerRegion = isAppLayout
        ? snapshot.regions.find((region) => region.name === "header")
        : undefined;
    const headerHasChildren = headerRegion && headerRegion.components.length > 0;
    const appBarHtml = isAppLayout
        ? headerHasChildren
            ? `<header class="webapp-app-bar"></header>`
            : `<header class="webapp-app-bar"><span class="webapp-app-bar-title">${escapeHtml(model.name || model.id)}</span></header>`
        : "";

    return {
        status: 200,
        body: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(model.name)} - ${escapeHtml(routeMatch.route.title || routeMatch.route.id)}</title>
  <link rel="stylesheet" href="${SHOELACE_THEME_HREF}">
  <script type="module" src="${SHOELACE_AUTOLOADER_SRC}"></script>
${iconLibraryRegistrationHtml}
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
    /* P23: --wa-* → --sl-* bridge (Shoelace themed via the same tokens).
       P62: the bridge falls back to literal Shoelace defaults when a --wa-*
       token is unset, so the :root above need NOT define every --wa-* token
       (e.g. --wa-spacing-unit, --wa-font-weight-*, --wa-line-height-base,
       --wa-radius-sm/lg/full). They are intentionally omitted — correctness no
       longer depends on them, and the bridge restores the real Shoelace value. */
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
    /* P53: a ui-action hide command toggles this class on a component wrapper */
    .webapp-hidden { display:none !important; }
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
    /* P64: dialogs are native <sl-dialog> (own overlay, backdrop, focus-trap).
       Only the slotted region wrappers need light layout; the footer lays its
       actions out in a row. */
    .webapp-dialog-region { display:grid; gap:10px; }
    .webapp-dialog-region--footer { display:flex; justify-content:flex-end; gap:8px; }
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
       data-webapp-location="${escapeAttribute(snapshot.location)}"
       data-webapp-signature="${escapeAttribute(shellSignature)}"
       data-webapp-mode="${escapeAttribute(deployMode)}"${dialogId ? ` data-webapp-dialog="${escapeAttribute(dialogId)}"` : ""}>
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
                // P45: also merge `rows` (ui-table) and `items` (ui-list) which are
                // the primary binding fields for those node types.
                const liveRegistration = runtimeState.definitions.get(entry.id);
                if (liveRegistration && liveRegistration.definition
                        && liveRegistration.definition.type === entry.type) {
                    const liveDef = liveRegistration.definition;
                    const patch = {};
                    if (liveDef.value !== undefined && liveDef.value !== baseDefinition.value) {
                        patch.value = liveDef.value;
                    }
                    if (liveDef.rows !== undefined && liveDef.rows !== baseDefinition.rows) {
                        patch.rows = liveDef.rows;
                    }
                    if (liveDef.items !== undefined && liveDef.items !== baseDefinition.items) {
                        patch.items = liveDef.items;
                    }
                    // src (ui-image, ui-avatar) and message (ui-alert) are binding
                    // fields listed in VIEW_NODE_BINDING_FIELDS — carry live patches
                    // so msg.payload → src/message updates reach the pushed snapshot.
                    if (liveDef.src !== undefined && liveDef.src !== baseDefinition.src) {
                        patch.src = liveDef.src;
                    }
                    if (liveDef.message !== undefined && liveDef.message !== baseDefinition.message) {
                        patch.message = liveDef.message;
                    }
                    // P52 / ADR 0004: carry a live placement patch (row/col/colSize/
                    // rowSize/layoutX/layoutY) into the pushed snapshot so a runtime
                    // re-placement actually reaches the client and the element reflows.
                    ["row", "col", "colSize", "rowSize", "layoutX", "layoutY"].forEach((field) => {
                        if (liveDef[field] !== undefined && liveDef[field] !== baseDefinition[field]) {
                            patch[field] = liveDef[field];
                        }
                    });
                    if (Object.keys(patch).length > 0) {
                        return Object.assign({}, baseDefinition, patch);
                    }
                }

                return baseDefinition;
            });
    }
    catch {
        return [];
    }
}

// P66 (ADR 0007): compile-/deploy-time cross-validation of navigate actions.
// The wire that links a navigate ui-action to a ui-route is INVISIBLE to the
// per-node editor validator, so these checks run here with the full flow graph:
//   • navigate wired-to-route AND `to` set        → ambiguous (which destination?)
//   • navigate with no wire-to-route and no `to`   → no destination at all
//   • navigate with a STATIC `to` matching no route → dead link
// A dynamic `to` (msg / flow / global / jsonata) is NOT edit-time checkable —
// it is validated at runtime on no-match. Returns a list of { nodeId, message }.
function validateNavigationFlow(RED) {
    const issues = [];
    let nodes;
    try {
        const flowFilePath = getFlowFilePath(RED);
        if (!fs.existsSync(flowFilePath)) {
            return issues;
        }
        const parsed = JSON.parse(fs.readFileSync(flowFilePath, "utf8"));
        nodes = Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return issues;
    }

    // Map Node-RED node id → type, and uiId → type (targets/picker store uiIds or
    // node ids depending on the path; check both). Collect route paths per app
    // is not needed for the dead-link check — any declared route path counts.
    const typeByNodeId = new Map();
    const typeByUiId = new Map();
    const routePaths = new Set();
    for (const n of nodes) {
        if (!n || !WEBAPP_NODE_TYPES.has(n.type)) {
            continue;
        }
        typeByNodeId.set(n.id, n.type);
        if (n.uiId) {
            typeByUiId.set(n.uiId, n.type);
        }
        if (n.type === "ui-route" && typeof n.path === "string" && n.path) {
            routePaths.add(n.path);
        }
        if (n.type === "ui-app") {
            // The ui-app owns the implicit root route "/".
            routePaths.add("/");
        }
    }

    const isRouteOrApp = (id) => {
        const t = typeByNodeId.get(id) || typeByUiId.get(id);
        return t === "ui-route" || t === "ui-app";
    };

    // Does a STATIC path template match a declared route (ignoring :param values)?
    const staticPathMatchesARoute = (template) => {
        const norm = template.startsWith("/") ? template : `/${template}`;
        for (const routePath of routePaths) {
            const rp = routePath.startsWith("/") ? routePath : `/${routePath}`;
            const tplSegs = norm.split("/");
            const rpSegs = rp.split("/");
            if (tplSegs.length !== rpSegs.length) {
                continue;
            }
            let ok = true;
            for (let i = 0; i < rpSegs.length; i += 1) {
                if (rpSegs[i].startsWith(":")) {
                    continue; // a placeholder matches any segment
                }
                if (rpSegs[i] !== tplSegs[i]) {
                    ok = false;
                    break;
                }
            }
            if (ok) {
                return true;
            }
        }
        return false;
    };

    for (const n of nodes) {
        if (!n || n.type !== "ui-action" || n.actionType !== "navigate") {
            continue;
        }
        // Wired to a route/app? Check output wires + picker targets + legacy target.
        const wiredIds = [];
        if (Array.isArray(n.wires)) {
            for (const port of n.wires) {
                if (Array.isArray(port)) {
                    for (const id of port) {
                        wiredIds.push(id);
                    }
                }
            }
        }
        const pickerTargets = parseTargetIds(n.targets) || [];
        for (const id of pickerTargets) {
            wiredIds.push(id);
        }
        if (typeof n.target === "string" && n.target) {
            wiredIds.push(n.target);
        }
        const wiredToRoute = wiredIds.some(isRouteOrApp);

        const toType = n.toType || (n.to ? "str" : undefined);
        const hasTo = typeof n.to === "string" && n.to.trim().length > 0;
        const ref = n.uiId || n.id;

        if (wiredToRoute && hasTo) {
            issues.push({
                nodeId: n.id,
                message: `ui-action '${ref}': navigate is wired to a ui-route/ui-app AND has a 'to' — ambiguous. Remove the 'to' (the route supplies the path) or the wire.`
            });
            continue;
        }
        if (!wiredToRoute && !hasTo) {
            issues.push({
                nodeId: n.id,
                message: `ui-action '${ref}': navigate has no destination — wire it to a ui-route/ui-app, or set 'to'.`
            });
            continue;
        }
        if (!wiredToRoute && hasTo && toType === "str" && !staticPathMatchesARoute(n.to)) {
            issues.push({
                nodeId: n.id,
                message: `ui-action '${ref}': navigate 'to' = '${n.to}' matches no ui-route — dead link. Every navigable path needs a ui-route.`
            });
        }
    }

    return issues;
}

// P108: cross-validate that no two ui-app nodes share the same root path.
// Two apps with the same root collide on the URL and cause non-deterministic
// routing — surface this as a structured error at deploy time.
// Returns a list of { nodeId, appId, root, message }.
function validateAppRootUniqueness(RED) {
    const issues = [];
    let nodes;
    try {
        const flowFilePath = getFlowFilePath(RED);
        if (!fs.existsSync(flowFilePath)) { return issues; }
        const parsed = JSON.parse(fs.readFileSync(flowFilePath, 'utf8'));
        nodes = Array.isArray(parsed) ? parsed : [];
    }
    catch { return issues; }

    const appNodes = nodes.filter((n) => n && n.type === 'ui-app');
    const byRoot = new Map();
    for (const n of appNodes) {
        const root = (n.root || '').trim();
        if (!root) { continue; }
        const existing = byRoot.get(root);
        if (existing) { existing.push(n); }
        else { byRoot.set(root, [n]); }
    }

    for (const [root, group] of byRoot.entries()) {
        if (group.length < 2) { continue; }
        const appIds = group.map((n) => n.uiId || n.id).join(', ');
        for (const n of group) {
            issues.push({
                nodeId: n.id,
                appId: n.uiId || n.id,
                root,
                message: `ui-app root '${root}' is shared by multiple apps (${appIds}). Each app must have a unique root path.`
            });
        }
    }
    return issues;
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
        components: matchingDefinitions.filter((entry) => ["ui-text", "ui-button", "ui-table", "ui-container", "ui-input", "ui-select", "ui-checkbox", "ui-radio", "ui-switch", "ui-textarea", "ui-datepicker", "ui-slider", "ui-alert", "ui-toast", "ui-progress", "ui-skeleton", "ui-badge", "ui-empty-state", "ui-tabs", "ui-accordion", "ui-breadcrumb", "ui-menu", "ui-pagination", "ui-stepper", "ui-avatar", "ui-image", "ui-icon", "ui-list", "ui-log", "ui-divider"].includes(entry.type)),
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

// P59-fix: resolve the registered node type for an id. Used to tell a dialog
// open/close command (which needs a snapshot re-render so snapshot.dialogs is
// populated) apart from sub-part disclosure commands the client renders locally.
function getDefinitionTypeById(id) {
    if (!id) {
        return undefined;
    }
    for (const registration of runtimeState.definitions.values()) {
        const def = registration.definition;
        if (def && def.id === id) {
            return def.type;
        }
    }
    return undefined;
}

// P22: a self-contained JSON body reader so the event endpoint does not depend on
// Node-RED's optional httpNode body-parser configuration. If a body parser already
// ran (req.body present), it is reused.
// P70 Ebene 3: collect a raw binary request body (image upload). Capped to guard
// against unbounded memory use; the cap is generous for typical UI imagery.
function readRawBody(req, res, next) {
    if (Buffer.isBuffer(req.rawBody)) {
        next();
        return;
    }
    const chunks = [];
    let size = 0;
    const MAX = 10 * 1024 * 1024; // 10 MB
    req.on("data", (chunk) => {
        size += chunk.length;
        if (size > MAX) {
            req.destroy();
            return;
        }
        chunks.push(chunk);
    });
    req.on("end", () => {
        req.rawBody = Buffer.concat(chunks);
        next();
    });
    req.on("error", () => {
        req.rawBody = Buffer.alloc(0);
        next();
    });
}

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
    // P86: emit clientConnected on the ui-app node if the event is declared.
    emitAppClientEvent(appId, "clientConnected", clientId);
}

function removeStreamClient(appId, clientId) {
    const subscribers = runtimeState.streamClients.get(appId);
    if (subscribers) {
        subscribers.delete(clientId);
        if (subscribers.size === 0) {
            runtimeState.streamClients.delete(appId);
        }
    }
    // P86: emit clientDisconnected on the ui-app node if the event is declared.
    emitAppClientEvent(appId, "clientDisconnected", clientId);
}

// Serialise a single SSE message frame. A named event lets the browser
// distinguish a full snapshot re-render from an interaction command.
function writeStreamEvent(res, eventName, payload) {
    if (!res || typeof res.write !== "function") {
        return false;
    }
    try {
        res.write(`event: ${eventName}\n`);
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
        return true;
    }
    catch (error) {
        // P56: an SSE write failure (broken pipe, closed socket) is logged with
        // context instead of crashing the push loop. Not forwarded to clients —
        // the failing transport is the very channel forwarding would use.
        const RED = runtimeState.RED;
        if (RED && RED.log && RED.log.warn) {
            RED.log.warn(`[webapp] SSE write failed for '${eventName}' frame (op=writeStreamEvent): ${error instanceof Error ? error.message : String(error)}`);
        }
        return false;
    }
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
        else {
            // P56: a failed snapshot build is no longer silently dropped — log it
            // with context and (when forwarding is on) surface it to the client.
            reportRuntimeError(undefined, {
                severity: "warn",
                code: "server.snapshot.build-failed",
                message: `Snapshot build failed for '${entry.location || "/"}' (status ${built.status}): ${built.message || "unknown error"}`,
                context: { appId, op: "buildAppSnapshot" },
                clientId: targetClientId
            });
        }
    }
}

// P106: normalise the ui-app `status` config field onto the deploy-mode enum.
// The editor offers Entwicklung / Produktion; accept the German labels, the
// English tokens, and the already-normalised enum. Anything else (incl. absent)
// falls back to "development" so existing apps keep the convenient auto-update.
function normalizeAppMode(status) {
    const raw = String(status === undefined || status === null ? "" : status).trim().toLowerCase();
    if (raw === "production" || raw === "produktion" || raw === "prod") {
        return "production";
    }
    return "development";
}

// P106: resolve an app's deploy mode from a set of definitions (the ui-app's
// `mode`, already normalised by mapConfig, with a defensive re-normalise so a
// raw `status` on the definition is honoured too).
function resolveAppMode(appId, definitions) {
    const buckets = getDefinitionBuckets(appId, definitions);
    const app = buckets.app;
    if (!app) {
        return "development";
    }
    if (app.mode === "production" || app.mode === "development") {
        return app.mode;
    }
    return normalizeAppMode(app.status);
}

// P106: a small, stable, non-cryptographic string hash (FNV-1a, 32-bit). The
// signature only needs to be deterministic and collision-resistant enough to
// tell "same shell/topology" from "different" — never a security boundary, so a
// crypto digest would be overkill.
function fnv1aHash(input) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
    }
    return ("0000000" + hash.toString(16)).slice(-8);
}

// P106: compute the shell/topology signature (live-deploy-update.md). It captures
// exactly the parts a client-side in-place `applySnapshot` CANNOT express — so a
// change here forces a full reload, while a pure content change leaves it stable:
//   1. App-shell — the ui-app layout preset + theme tokens (baked into the
//      server-rendered page hull).
//   2. Routen-Topologie — the SET of route paths (sorted; param structure rides
//      along in the path string).
//   3. Serializer/transport version — the client code-contract itself.
// Returns a short hex digest. Deterministic for equal inputs.
function computeShellSignature(appId, definitions) {
    const buckets = getDefinitionBuckets(appId, definitions);
    const app = buckets.app;

    const appLayout = app ? (app.layout || "") : "";
    // Tokens are an object on the compiled definition; serialise with sorted keys
    // so key order in the flow file never perturbs the signature.
    const tokens = app && app.tokens && typeof app.tokens === "object" ? app.tokens : {};
    const tokenKeys = Object.keys(tokens).sort();
    const tokenSig = tokenKeys.map((k) => `${k}=${tokens[k]}`).join("&");

    // The route-path SET (incl. the implicit app-root "/"). Sorted + de-duped so
    // a reorder in the flow file is NOT a topology change.
    const routePaths = new Set(["/"]);
    for (const route of buckets.routes) {
        if (route && route.path) {
            routePaths.add(String(route.path));
        }
    }
    const routeSig = Array.from(routePaths).sort().join(",");

    const material = [
        `v=${SNAPSHOT_SERIALIZER_VERSION}`,
        `layout=${appLayout}`,
        `tokens=${tokenSig}`,
        `routes=${routeSig}`
    ].join("|");

    return fnv1aHash(material);
}

// P106: on deploy, push the freshly-compiled model to every subscriber of the app
// as a `deploy` SSE frame carrying { snapshot, signature, mode }. The client
// decides what to do (live-deploy-update.md):
//   development → signature unchanged + route still present ? in-place applySnapshot
//                 : full reload.
//   production  → never auto-update; show a version alert; the user's manual
//                 reload adopts the new model.
// Always a BROADCAST (no clientId) — each subscriber is rendered at ITS OWN
// location with ITS OWN per-client state (P15), so per-client state survives.
//
// `options.connectedBefore` (a timestamp): skip clients that connected at/after
// it — they are already loading the fresh flow (the P37 connect-race guard).
// `options.requireLiveSocket`: only write to a connection whose socket is still
// fully writable (avoids EPIPE to a browser tab that closed mid-deploy).
function pushDeployToClients(appId, definitions, options) {
    const subscribers = runtimeState.streamClients.get(appId);
    if (!subscribers || subscribers.size === 0) {
        return;
    }

    const opts = options || {};
    const signature = computeShellSignature(appId, definitions);
    const mode = resolveAppMode(appId, definitions);

    for (const [targetClientId, entry] of subscribers.entries()) {
        // P37 connect-race guard: a client that connected at/after the deploy is
        // already loading the new flow — sending it a deploy push would cause a
        // spurious extra in-place apply / reload.
        if (typeof opts.connectedBefore === "number"
                && typeof entry.connectedAt === "number"
                && !(entry.connectedAt < opts.connectedBefore)) {
            continue;
        }

        // Live-socket guard: skip half-closed / destroyed connections.
        if (opts.requireLiveSocket) {
            const res = entry.res;
            const socket = res && res.socket;
            const isLive = res && !res.writableEnded && !res.destroyed
                && socket && !socket.destroyed && !socket.writableEnded && socket.readable;
            if (!isLive) {
                continue;
            }
        }

        const built = buildAppSnapshot(appId, entry.location || "/", undefined, definitions, targetClientId);
        if (built.success) {
            writeStreamEvent(entry.res, "deploy", {
                snapshot: built.snapshot,
                signature,
                mode
            });
        }
        else {
            // A failed build still emits a deploy frame WITHOUT a snapshot so the
            // client can fall back to a reload (it cannot stay on a stale page).
            writeStreamEvent(entry.res, "deploy", { snapshot: null, signature, mode });
            reportRuntimeError(undefined, {
                severity: "warn",
                code: "server.deploy.snapshot-build-failed",
                message: `Deploy snapshot build failed for '${entry.location || "/"}' (status ${built.status}): ${built.message || "unknown error"}`,
                context: { appId, op: "pushDeployToClients" },
                clientId: targetClientId
            });
        }
    }
}

// P45: push a toast notification to connected SSE clients. Toasts are transient
// notifications that appear in the browser and disappear after `duration` ms.
// They are pushed as "toast" SSE events (distinct from "snapshot" and "command").
function pushToastToClients(appId, clientId, toast) {
    const subscribers = runtimeState.streamClients.get(appId);
    if (!subscribers || subscribers.size === 0) {
        return;
    }

    const targets = clientId
        ? (subscribers.has(clientId) ? [[clientId, subscribers.get(clientId)]] : [])
        : Array.from(subscribers.entries());

    for (const [, entry] of targets) {
        writeStreamEvent(entry.res, "toast", { toast });
    }
}

// P64: authoritatively write a dialog's open state into the SAME state channel a
// ui-store uses. Mirrors ui-store's per-client vs broadcast rule, keyed on the
// given clientId: a broadcast write (no clientId) updates the shared state so a
// later broadcast store update can override it; a per-client write shadows it for
// just that client. Factored out of pushActionCommandToClients so the dialog
// open (ui-action) path and the dialog close (native dismissal) path share it.
function writeDialogOpenState(appId, clientId, dialogId, open) {
    const dialogStatePath = `ui.dialogs.${String(dialogId)}.open`;

    if (clientId) {
        const current = getClientState(appId, clientId);
        const base = current && current.state
            ? current.state
            : clone(runtimeState.liveState.get(appId) || {});
        setClientState(appId, clientId, setValueAtPath(base, dialogStatePath, open), Date.now());
    }
    else {
        const base = clone(runtimeState.liveState.get(appId) || {});
        runtimeState.liveState.set(appId, setValueAtPath(base, dialogStatePath, open));
    }
}

// P64: rebuild and push a fresh snapshot to each target client at its current
// location. Used after a server-side interaction-state write (e.g. a dialog open
// or close) so every affected client re-renders from the authoritative state.
function pushSnapshotToTargets(appId, targets, definitions) {
    const defs = definitions || readDeployDefinitions(runtimeState.RED);

    for (const [targetClientId, entry] of targets) {
        const built = buildAppSnapshot(appId, entry.location || "/", undefined, defs, targetClientId);
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

    // P59-fix: a bare open/close on a ui-dialog target (no `part`) cannot be
    // rendered by the client from its stale snapshot — `snapshot.dialogs` only
    // contains dialogs the server built as open. So for those we write the dialog
    // open state into the SAME state channel a ui-store uses, then push a fresh
    // SNAPSHOT — mirroring the store-driven open path. This keeps the dialog state
    // unified: a later store update to ui.dialogs.<id>.open overrides it naturally.
    // Every other command (navigate, show/hide, sub-part open/close, …) stays a
    // `command` the client applies locally.
    const verb = command && typeof command.type === "string" ? command.type : undefined;
    const isDialogVerb = (verb === "open" || verb === "openDialog" || verb === "close" || verb === "closeDialog");
    const isBareDialogTarget = isDialogVerb
        && !command.part
        && command.target
        && getDefinitionTypeById(String(command.target)) === "ui-dialog";

    if (isBareDialogTarget) {
        const opening = verb === "open" || verb === "openDialog";

        // Mirror ui-store's per-client vs broadcast rule, keyed on the COMMAND's
        // clientId (the function arg) — NOT the loop's target (see writeDialogOpenState).
        writeDialogOpenState(appId, clientId, String(command.target), opening);
        pushSnapshotToTargets(appId, targets);
        return;
    }

    for (const [, entry] of targets) {
        if (command && command.type === "navigate" && command.to) {
            entry.location = String(command.to);
        }
        writeStreamEvent(entry.res, "command", { command });
    }
}

// ─── P56 / ADR 0006: structured runtime logging + opt-in error forwarding ───
//
// Every framework failure in the runtime is logged WITH CONTEXT via node.error /
// node.warn (never bare), shaped after the ADR 0006 structured-error contract
// ({ severity, code, message, context:{appId,nodeId,op}, timestamp, origin }).
// When the owning ui-app opts in (forwardErrorsToClient), errors at or above its
// severity threshold are ALSO forwarded to connected clients over a new SSE
// "error" event — redacted, default OFF (security). The browser logs them via
// the P55 receiving-end handler.

// severity → ordinal, for the forwarding threshold comparison (ADR 0006 §4).
const ERROR_SEVERITY_RANK = { debug: 0, info: 1, warn: 2, error: 3 };

function nowIso() {
    return new Date().toISOString();
}

// Resolve the forwarding config for an app from its registered ui-app definition.
// Absent fields fall back to the SECURE default: no forwarding, "error" threshold.
function resolveAppForwardConfig(appId) {
    if (!appId) {
        return { enabled: false, minSeverity: "error" };
    }
    for (const registration of runtimeState.definitions.values()) {
        const def = registration.definition;
        if (def && def.type === "ui-app" && def.id === appId) {
            return {
                enabled: def.forwardErrorsToClient === true,
                minSeverity: def.forwardErrorMinSeverity || "error"
            };
        }
    }
    return { enabled: false, minSeverity: "error" };
}

// Redact a message before forwarding it to anonymous clients (ADR 0006 §4):
// strip absolute file paths and any stack-trace tail so server internals do not
// leak. The structured `code` + `context` ids still travel; only the free-text
// message is sanitised.
function redactErrorMessage(message) {
    let text = message === undefined || message === null ? "" : String(message);
    // Drop everything from the first stack frame marker onwards.
    const stackAt = text.search(/\n?\s*at\s+/);
    if (stackAt !== -1) {
        text = text.slice(0, stackAt);
    }
    // Replace absolute filesystem paths (POSIX or Windows) with a placeholder.
    text = text.replace(/(?:\/[^\s:]+)+\.[a-zA-Z]+(?::\d+(?::\d+)?)?/g, "<path>");
    text = text.replace(/[A-Za-z]:\\[^\s]+/g, "<path>");
    return text.trim() || "An internal error occurred.";
}

// Build the structured-error wire object (ADR 0006 decision 1).
function makeStructuredError(severity, code, message, context) {
    return {
        severity,
        code,
        message,
        context: context && typeof context === "object" ? context : {},
        timestamp: nowIso(),
        origin: "server"
    };
}

// Push a structured server error to the targeted client(s) over the SSE "error"
// channel — gated by the owning app's forwarding config + severity threshold,
// with the message redacted. The frame shape matches the P55 receiving handler:
//   event: error\n data: { "error": { … } }
// clientId targeting honours the P15 multi-user model (broadcast when absent).
function pushErrorToClients(appId, clientId, structuredError) {
    const config = resolveAppForwardConfig(appId);
    if (!config.enabled) {
        return false;
    }
    const rank = ERROR_SEVERITY_RANK[structuredError.severity];
    const threshold = ERROR_SEVERITY_RANK[config.minSeverity];
    if (rank === undefined || threshold === undefined || rank < threshold) {
        return false;
    }

    const subscribers = runtimeState.streamClients.get(appId);
    if (!subscribers || subscribers.size === 0) {
        return false;
    }

    const forwarded = {
        severity: structuredError.severity,
        code: structuredError.code,
        message: redactErrorMessage(structuredError.message),
        // Only framework ids travel — never arbitrary payload (ADR 0006 §4).
        context: {
            ...(structuredError.context && structuredError.context.appId ? { appId: structuredError.context.appId } : {}),
            ...(structuredError.context && structuredError.context.nodeId ? { nodeId: structuredError.context.nodeId } : {}),
            ...(structuredError.context && structuredError.context.op ? { op: structuredError.context.op } : {})
        },
        timestamp: structuredError.timestamp || nowIso(),
        origin: "server"
    };

    const targets = clientId
        ? (subscribers.has(clientId) ? [[clientId, subscribers.get(clientId)]] : [])
        : Array.from(subscribers.entries());

    let delivered = false;
    for (const [, entry] of targets) {
        writeStreamEvent(entry.res, "error", { error: forwarded });
        delivered = true;
    }
    return delivered;
}

// Central runtime error reporter (ADR 0006). Logs the failure WITH CONTEXT via
// the matching Node-RED logger (warn→node.warn, everything else→node.error) and,
// when the owning app opts in, forwards it to clients via pushErrorToClients.
// `node` may be a real Node-RED node (preferred — keeps the error on the node)
// or undefined (falls back to the runtime logger). Returns the structured error.
function reportRuntimeError(node, { severity, code, message, context, clientId }) {
    const sev = ERROR_SEVERITY_RANK[severity] !== undefined ? severity : "error";
    const ctx = context && typeof context === "object" ? context : {};
    const structured = makeStructuredError(sev, code, message, ctx);

    // Human-readable line: message + a compact rendering of the context + code.
    const ctxBits = [];
    if (ctx.appId) { ctxBits.push(`appId=${ctx.appId}`); }
    if (ctx.nodeId) { ctxBits.push(`nodeId=${ctx.nodeId}`); }
    if (ctx.op) { ctxBits.push(`op=${ctx.op}`); }
    const suffix = `${ctxBits.length ? ` [${ctxBits.join(" ")}]` : ""} (${code})`;
    const line = `${message}${suffix}`;

    if (node && typeof node[sev === "warn" ? "warn" : "error"] === "function") {
        node[sev === "warn" ? "warn" : "error"](line);
    }
    else {
        const RED = runtimeState.RED;
        const logger = RED && RED.log;
        if (logger) {
            (sev === "warn" ? logger.warn : logger.error).call(logger, `[webapp] ${line}`);
        }
    }

    const appId = ctx.appId;
    if (appId) {
        pushErrorToClients(appId, clientId, structured);
    }
    return structured;
}

// P66 (ADR 0007): resolve a ui-action's navigate `to` typedInput into a concrete
// path string. `str` is a literal; `msg` / `flow` / `global` read from the
// respective context via RED.util.evaluateNodeProperty; `jsonata` evaluates the
// expression against the incoming message. The JSONata context is the full `msg`
// (so an expression can compute the path from payload, route params, etc.). All
// paths here are synchronous; a no-match / runtime error is surfaced to the node
// and the result is undefined (the navigate is then treated as "no destination").
function resolveActionTo(node, toValue, toType, msg) {
    if (toValue === undefined || toValue === null || toValue === "") {
        return undefined;
    }
    const type = toType || "str";
    if (type === "str") {
        return String(toValue);
    }
    const RED = runtimeState.RED;
    if (!RED || !RED.util) {
        return type === "str" ? String(toValue) : undefined;
    }
    try {
        if (type === "jsonata") {
            const expr = RED.util.prepareJSONataExpression(String(toValue), node);
            const result = RED.util.evaluateJSONataExpression(expr, msg);
            return result === undefined || result === null ? undefined : String(result);
        }
        // msg / flow / global
        const result = RED.util.evaluateNodeProperty(String(toValue), type, node, msg);
        return result === undefined || result === null ? undefined : String(result);
    }
    catch (err) {
        reportRuntimeError(node, {
            severity: "error",
            code: "navigate-to-eval-failed",
            message: `Could not resolve navigate destination (${type}): ${err && err.message ? err.message : err}`,
            context: { nodeId: node && node.id, op: "navigate" }
        });
        return undefined;
    }
}

// Map a ui-action definition + incoming msg into the interaction command the
// client applies. Domain-agnostic: only the documented interaction verbs.
// `node` (optional) is the ui-action runtime node — needed to resolve a navigate
// `to` typedInput of type msg/flow/global/jsonata (P66). When absent (e.g. unit
// tests passing only a definition) `to` is treated as a literal string.
function buildActionCommand(actionDefinition, msg, node) {
    const uiMsg = msg && msg.ui && typeof msg.ui === "object" ? msg.ui : {};
    const override = uiMsg.action && typeof uiMsg.action === "object" ? uiMsg.action : {};
    const type = override.type || (actionDefinition && actionDefinition.actionType);
    if (!type) {
        return null;
    }
    // P66: resolve the navigate `to` typedInput. An explicit msg.ui.action.to
    // override (already a literal path) wins; otherwise resolve the configured
    // `to` against its `toType`.
    const resolvedConfigTo = node
        ? resolveActionTo(node, actionDefinition && actionDefinition.to, actionDefinition && actionDefinition.toType, msg)
        : (actionDefinition && actionDefinition.to ? String(actionDefinition.to) : undefined);
    const to = override.to || resolvedConfigTo || undefined;
    // P66: merge named URL params (msg override wins per-key over config).
    const configParams = actionDefinition && actionDefinition.params && typeof actionDefinition.params === "object"
        ? actionDefinition.params
        : undefined;
    const overrideParams = override.params && typeof override.params === "object" ? override.params : undefined;
    const mergedParams = (configParams || overrideParams)
        ? Object.assign({}, configParams, overrideParams)
        : undefined;
    // P53 (ADR 0005): the command carries `target` (a rendered node id) and an
    // optional `part` (a sub-id within that element — accordion section, tree
    // branch, tab) for open/close/select granularity. msg.ui.action overrides win.
    return {
        type: String(type),
        to,
        params: mergedParams && Object.keys(mergedParams).length > 0 ? mergedParams : undefined,
        target: override.target || (actionDefinition && actionDefinition.target) || undefined,
        part: override.part || (actionDefinition && actionDefinition.part) || undefined
    };
}

// P70 Ebene 3: validate an asset id and resolve the absolute store URL to fetch.
// The real media-store URL is taken from the app's mediaStoreUrl config and NEVER
// leaves the server — the client only ever sees /webapp/<appId>/asset/<id>.
// Returns { ok:true, url } or { ok:false, status, error }. The id is constrained
// to a safe charset so it cannot traverse out of the store base path.
const ASSET_ID_PATTERN = /^[A-Za-z0-9._-]+$/;

function resolveAssetStoreUrl(appId, id, definitions) {
    if (typeof id !== "string" || !ASSET_ID_PATTERN.test(id) || id === "." || id === "..") {
        return { ok: false, status: 400, error: "Invalid asset id." };
    }
    const buckets = getDefinitionBuckets(appId, definitions);
    if (!buckets.app) {
        return { ok: false, status: 404, error: `Unknown app '${appId}'.` };
    }
    const storeUrl = buckets.app.mediaStoreUrl;
    if (!storeUrl || typeof storeUrl !== "string" || storeUrl.trim() === "") {
        return { ok: false, status: 404, error: "No media store is configured for this app." };
    }
    const base = storeUrl.replace(/\/+$/, "");
    return { ok: true, url: `${base}/${encodeURIComponent(id)}` };
}

function registerEndpoints(RED) {
    if (runtimeState.endpointsRegistered) {
        return;
    }

    // P69: seed additional icon libraries from RED settings (global / module
    // level) once, before any page render or manifest request.
    iconLibrary.seedFromSettings(RED.settings || {});

    // P69: icon manifest for the editor picker — the default (vendored Bootstrap)
    // set plus any registered libraries, each with its icon names. Served on the
    // admin endpoint because the picker runs in the Node-RED editor.
    RED.httpAdmin.get("/webapp/icons/manifest", (req, res) => {
        res.json(iconLibrary.buildIconManifest({ iconsDir: SHOELACE_ICONS_DIR }));
    });

    RED.httpAdmin.get("/webapp/apps", (req, res) => {
        const apps = readDeployDefinitions(RED)
            .filter((entry) => entry.type === "ui-app")
            .map((entry) => ({
                id: entry.id,
                // P109: `name` replaces `title`. Keep both for back-compat with
                // external callers that may still read `title`.
                name: entry.name,
                title: entry.name
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

    // P70 Ebene 3: app-scoped media proxy. A ui-image src of `asset:<id>` is
    // rendered as /webapp/<appId>/asset/<id>; this endpoint resolves the app's
    // configured mediaStoreUrl server-side, fetches the asset, and streams it back
    // with the upstream content-type. The store URL is never disclosed to the
    // client (obfuscation), and the id is charset-validated (no path traversal).
    // MUST be registered before the catch-all `/webapp/:appId/*` page route.
    RED.httpNode.get("/webapp/:appId/asset/:id", (req, res) => {
        const { appId, id } = req.params;
        const resolved = resolveAssetStoreUrl(appId, id, readDeployDefinitions(RED));
        if (!resolved.ok) {
            res.status(resolved.status).json({ error: resolved.error });
            return;
        }
        fetch(resolved.url)
            .then((upstream) => {
                if (!upstream.ok) {
                    // Do not leak the upstream URL or body — only the status class.
                    res.status(upstream.status === 404 ? 404 : 502).json({ error: "Asset not available." });
                    return;
                }
                const contentType = upstream.headers.get("content-type") || "application/octet-stream";
                res.set("Content-Type", contentType);
                res.set("Cache-Control", "public, max-age=300");
                return upstream.arrayBuffer().then((buf) => {
                    res.status(200).send(Buffer.from(buf));
                });
            })
            .catch(() => {
                res.status(502).json({ error: "Asset fetch failed." });
            });
    });

    // P70 Ebene 3: editor media picker — list assets available in the store.
    // Proxies the store's listing endpoint (the store owns the catalogue); the
    // store URL stays server-side. Returns { assets: [{ id, name?, contentType? }] }.
    RED.httpAdmin.get("/webapp/:appId/assets", (req, res) => {
        const { appId } = req.params;
        const buckets = getDefinitionBuckets(appId, readDeployDefinitions(RED));
        if (!buckets.app) {
            res.status(404).json({ error: `Unknown app '${appId}'.` });
            return;
        }
        const storeUrl = buckets.app.mediaStoreUrl;
        if (!storeUrl || String(storeUrl).trim() === "") {
            res.json({ assets: [], mediaStoreConfigured: false });
            return;
        }
        const base = String(storeUrl).replace(/\/+$/, "");
        fetch(`${base}/`)
            .then((upstream) => upstream.ok ? upstream.json() : { assets: [] })
            .then((data) => {
                const assets = Array.isArray(data) ? data : (Array.isArray(data && data.assets) ? data.assets : []);
                res.json({ assets, mediaStoreConfigured: true });
            })
            .catch(() => {
                res.json({ assets: [], mediaStoreConfigured: true, error: "store-unreachable" });
            });
    });

    // P70 Ebene 3: editor media upload. The store owns persistence (open design
    // point: folder vs. service) — Node-RED stays a thin proxy. The editor sends
    // the raw image bytes (Content-Type = the image type, X-Asset-Name = filename);
    // the server POSTs them to the store and returns the assigned id. Requires a
    // configured mediaStoreUrl.
    RED.httpAdmin.post("/webapp/:appId/assets", readRawBody, (req, res) => {
        const { appId } = req.params;
        const buckets = getDefinitionBuckets(appId, readDeployDefinitions(RED));
        if (!buckets.app) {
            res.status(404).json({ error: `Unknown app '${appId}'.` });
            return;
        }
        const storeUrl = buckets.app.mediaStoreUrl;
        if (!storeUrl || String(storeUrl).trim() === "") {
            res.status(409).json({ error: "No media store is configured for this app." });
            return;
        }
        const body = Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.alloc(0);
        if (body.length === 0) {
            res.status(400).json({ error: "Empty upload." });
            return;
        }
        const base = String(storeUrl).replace(/\/+$/, "");
        const contentType = req.headers["content-type"] || "application/octet-stream";
        const name = req.headers["x-asset-name"] ? String(req.headers["x-asset-name"]) : undefined;
        fetch(base + "/", {
            method: "POST",
            headers: name
                ? { "Content-Type": contentType, "X-Asset-Name": name }
                : { "Content-Type": contentType },
            body
        })
            .then((upstream) => upstream.ok ? upstream.json().catch(() => ({})) : Promise.reject(new Error("store rejected")))
            .then((data) => {
                const id = data && (data.id || data.assetId);
                if (!id) {
                    res.status(502).json({ error: "Store did not return an asset id." });
                    return;
                }
                res.json({ id: String(id), name: name });
            })
            .catch(() => {
                res.status(502).json({ error: "Upload to media store failed." });
            });
    });

    // P106: JSON snapshot endpoint. The client polls this on tab re-focus
    // (visibilitychange) to pull the CURRENT model after a deploy it may have
    // missed while the tab was frozen/backgrounded, and on initial hydration.
    // Returns { snapshot, signature, mode } so the client can apply the same
    // in-place-vs-reload rule used for a live deploy push. MUST be registered
    // before the catch-all `/webapp/:appId/*` page route.
    RED.httpNode.get("/webapp/:appId/snapshot", (req, res) => {
        const { appId } = req.params;
        const location = req.query.location ? String(req.query.location) : "/";
        const dialogId = req.query.dialog ? String(req.query.dialog) : undefined;
        const clientId = req.query.clientId ? String(req.query.clientId) : undefined;
        const definitions = readDeployDefinitions(RED);

        const built = buildAppSnapshot(appId, location, dialogId, definitions, clientId);
        if (!built.success) {
            res.status(built.status).json({ error: built.message });
            return;
        }

        res.json({
            snapshot: built.snapshot,
            signature: computeShellSignature(appId, definitions),
            mode: resolveAppMode(appId, definitions)
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

    // P106: wire the deploy hook here (the path Node-RED actually runs). Each
    // node self-registers via registerNodeType → registerEndpoints; the legacy
    // registerWebappNodes() factory (which also called this) is NOT invoked by
    // Node-RED, so the old P37 flows:started listener never fired — the latent
    // "deploy delivers nothing to connected clients" bug. Wiring it once here
    // (guarded) is the fix.
    registerDeployHook(RED);
}

// P106: on every flow deploy, push the freshly-compiled model to every connected
// client so the UI auto-updates. The push carries a shell/topology signature +
// the app's deploy mode; the client decides in-place vs full reload (development)
// or shows a version alert (production) — see live-deploy-update.md. This
// SUBSUMES the old P37 `redeploy`-only broadcast (which reloaded unconditionally
// and pushed NO fresh model). Registered exactly once across all node-type
// registrations via the deployHookRegistered guard.
function registerDeployHook(RED) {
    if (runtimeState.deployHookRegistered) {
        return;
    }
    runtimeState.deployHookRegistered = true;

    RED.events.on("flows:started", function () {
        // P66 (ADR 0007): cross-validate navigate actions against the full flow
        // graph (ambiguous / no-destination / dead-link). These can only be seen
        // with the whole flow, not in per-node editor validation. Surface each as
        // a structured runtime error so it is visible in the Node-RED log.
        try {
            const navIssues = validateNavigationFlow(RED);
            for (const issue of navIssues) {
                reportRuntimeError(undefined, {
                    severity: "error",
                    code: "navigate-validation",
                    message: issue.message,
                    context: { nodeId: issue.nodeId, op: "deploy" }
                });
            }
        }
        catch (_e) {
            // Never let validation crash the deploy.
        }

        // P108: cross-validate that all ui-app nodes have unique root paths.
        try {
            const rootIssues = validateAppRootUniqueness(RED);
            for (const issue of rootIssues) {
                reportRuntimeError(undefined, {
                    severity: 'error',
                    code: 'duplicate-app-root',
                    message: issue.message,
                    context: { nodeId: issue.nodeId, appId: issue.appId, root: issue.root, op: 'deploy' }
                });
            }
        }
        catch (_e2) {
            // Never let validation crash the deploy.
        }

        const deployedAt = Date.now();
        // Defer by one event-loop tick so pending connection-close callbacks
        // (req.on("close") → removeStreamClient) fire first. This avoids writing
        // the deploy frame to connections already closed by the browser.
        setImmediate(function () {
            let definitions;
            try {
                definitions = readDeployDefinitions(RED);
            }
            catch (_e) {
                // If the fresh definitions cannot be read, there is nothing safe to
                // push — leave connected clients on their current page.
                return;
            }

            // One deploy push per app: each app has its own signature, mode, and
            // its subscribers render at their own location with their own state.
            const appIds = new Set();
            for (const def of definitions) {
                if (def && def.type === "ui-app") {
                    if (def.root) { appIds.add(def.root); }
                    if (def.id) { appIds.add(def.id); }
                }
            }

            for (const appId of appIds) {
                try {
                    pushDeployToClients(appId, definitions, {
                        connectedBefore: deployedAt - 500,
                        requireLiveSocket: true
                    });
                }
                catch (_) {
                    // Never let one app's push failure abort the others.
                }
            }
        });
    });
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
            reportRuntimeError(node, {
                severity: "error",
                code: "server.mapConfig.failed",
                message: `Failed to map ${type} config: ${error instanceof Error ? error.message : String(error)}`,
                context: { appId: findAppIdForNode(node), nodeId: node.id, op: "mapConfig" }
            });
            return;
        }

        const validation = validateUiNodeDefinition(definition);

        // P59 / ADR 0007 §2: the input handler is attached even when the definition
        // fails schema validation. The runtime still RENDERS the node from its
        // mapConfig output (readDeployDefinitions bypasses validation), so an
        // interaction verb (open/close/select/show/…) targeting it must still push.
        // Before P59 the push lived centrally in ui-action and did not depend on the
        // target node carrying a handler; moving the push onto the target node would
        // otherwise silently drop verbs for any node whose definition is invalid.
        // The interaction handler only ever pushes for OWNED verbs; every other
        // message falls through to `next`, which no-ops gracefully when the node has
        // no registered definition (it reads runtimeState.definitions.get(node.id)).
        if (options.inputHandler) {
            node.on("input", function onInput(msg, send, done) {
                options.inputHandler(node, msg, send, done);
            });
        }

        if (!validation.success) {
            node.status({ fill: "red", shape: "ring", text: validation.error });
            reportRuntimeError(node, {
                severity: "error",
                code: "server.validation.failed",
                message: `Invalid ${type} definition: ${validation.error}`,
                context: { appId: findAppIdForNode(node), nodeId: node.id, op: "validateUiNodeDefinition" }
            });
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

// P45: ui-toast input handler — push a toast command to connected SSE clients
// and forward the message on the output port so flows can chain further.
function toastInputHandler(node, msg, send, done) {
    const toastDefinition = node.webappDefinition;
    const activeAppId = getActiveRuntimeAppId();
    const uiMsg = msg && msg.ui && typeof msg.ui === "object" ? msg.ui : {};
    const clientId = uiMsg.clientId ? String(uiMsg.clientId) : undefined;

    if (activeAppId) {
        // Build the toast payload from the node definition + optional msg overrides.
        const toastPayload = {
            id: toastDefinition ? toastDefinition.id : node.id,
            message: uiMsg.toast && uiMsg.toast.message !== undefined ? String(uiMsg.toast.message)
                : (msg.payload !== undefined && msg.payload !== null ? String(msg.payload) : ""),
            severity: (uiMsg.toast && uiMsg.toast.severity) || (toastDefinition && toastDefinition.severity) || "info",
            duration: (uiMsg.toast && uiMsg.toast.duration !== undefined ? Number(uiMsg.toast.duration)
                : (toastDefinition && toastDefinition.duration !== undefined ? toastDefinition.duration : 3000)),
            position: (uiMsg.toast && uiMsg.toast.position) || (toastDefinition && toastDefinition.position) || "top-right"
        };
        pushToastToClients(activeAppId, clientId, toastPayload);
    }

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

// P59 / ADR 0007 §4: find the Node-RED node id of the ui-app that owns `node`.
// Used to route an app-global interaction verb (navigate / reset) emitted by a
// ui-action that has no explicit target and no output wire to the app node that
// owns those verbs — the app then performs the SSE push from its own handler.
function findOwningAppNodeId(node) {
    const appId = findAppIdForNode(node);
    if (!appId) {
        return undefined;
    }
    for (const registration of runtimeState.definitions.values()) {
        const def = registration.definition;
        if (def && def.type === "ui-app" && def.id === appId && registration.nodeId) {
            return registration.nodeId;
        }
    }
    return undefined;
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

// P70 Ebene 2 (wiring-first): sniff the image content-type from the leading
// magic bytes of a Buffer. Returns a MIME type, or undefined when unrecognised.
function sniffImageContentType(buffer) {
    if (!buffer || buffer.length < 4) {
        return undefined;
    }
    // PNG: 89 50 4E 47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
        return "image/png";
    }
    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return "image/jpeg";
    }
    // GIF: "GIF8"
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
        return "image/gif";
    }
    // WEBP: "RIFF"...."WEBP"
    if (buffer.length >= 12 && buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46
        && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
        return "image/webp";
    }
    // SVG (text): leading "<?xml" or "<svg"
    const head = buffer.slice(0, 5).toString("utf8").toLowerCase();
    if (head.startsWith("<?xml") || head.startsWith("<svg")) {
        return "image/svg+xml";
    }
    return undefined;
}

// P70 Ebene 2: turn a ui-image msg.payload into a usable src string.
//   - Buffer            → data:<type>;base64,<…>  (type from msg hint or sniff)
//   - string            → passed through (URL, asset:<id>, or existing data: URL)
//   - anything else     → String(payload)
// CAVEAT (documented): a data:/Base64 src lands in the snapshot/state and is
// re-sent on every render — fine for small/rare images; prefer URL/asset for
// large or frequently-updated images.
function payloadToImageSrc(payload, msg) {
    if (Buffer.isBuffer(payload)) {
        const hint = msg && (msg.contentType || (msg.headers && msg.headers["content-type"]));
        const contentType = (typeof hint === "string" && hint.trim()) ? hint.split(";")[0].trim()
            : (sniffImageContentType(payload) || "image/png");
        return `data:${contentType};base64,${payload.toString("base64")}`;
    }
    if (typeof payload === "string") {
        return payload;
    }
    return String(payload);
}

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
        // P52 / ADR 0004: enforce the P51 positive-integer rule on grid placement
        // props on this runtime path too — an invalid row/col/colSize/rowSize is
        // dropped (other keys still apply) and a clear node error is raised.
        const cleanPatch = sanitizePlacementPatch(uiMsg.patch, node);
        registration.definition = Object.assign({}, registration.definition, cleanPatch);
        node.webappDefinition = registration.definition;
        patched = true;
    } else if (msg.payload !== undefined && msg.payload !== null) {
        // msg.payload — sets the primary mutable field for this node type.
        const nodeType = registration.definition.type;
        const field = VIEW_NODE_PRIMARY_FIELD[nodeType];
        if (field) {
            // P70 Ebene 2: ui-image accepts a Buffer / Base64 / data: payload —
            // convert it to a usable src string before it is wrapped in a binding.
            const rawPayload = (nodeType === "ui-image" && field === "src")
                ? payloadToImageSrc(msg.payload, msg)
                : msg.payload;
            const newValue = VIEW_NODE_BINDING_FIELDS.has(field)
                ? literalBinding(rawPayload)
                : rawPayload;
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

// ─── P59 / ADR 0007 §2: per-node interaction handlers ───
//
// The SSE push moved OUT of ui-action and INTO the target node. Each
// interaction-capable node owns a set of verbs (open/close, show/hide, …) and
// uses the shared `interactionInputHandler(ownedVerbs[, next])` factory. This
// generalises the ui-toast pattern (input → push own SSE command → pass msg
// through). When a wire (ui-action → ui-dialog) or a bare inject carries
// `msg.ui.action`, the target node — not ui-action — performs the push.
//
// Resolution rules (ADR 0007 §2):
//   - command.target resolves to THE NODE'S OWN id (the wire/selection is the
//     addressing). An explicit msg.ui.action.target OVERRIDES it.
//   - `to` / `part` ride along from msg.ui.action.
//   - A verb the node does NOT own → pure pass-through (no push, no swallow),
//     so a chain of wired targets each handle the verbs they own (ADR 0007 §2,
//     ADR 0006 "no silent drops" spirit).
//   - With no msg.ui.action at all → delegate to `next` (the node's existing
//     patch / component / click / dialog handler), preserving prior behaviour.

// Verb ownership per node type (ADR 0007 §2). A node pushes only for verbs it
// owns; every other verb is passed through untouched.
const INTERACTION_VERBS_BY_TYPE = {
    "ui-dialog": ["open", "close", "openDialog", "closeDialog", "toggle"],
    "ui-app": ["navigate", "reset"],
    "ui-route": ["navigate", "reset"],
    // presence (show/hide) for view nodes; interactive controls add enable/disable;
    // input controls add focus/reset; single-active containers add select.
    "ui-button": ["show", "hide", "enable", "disable"],
    "ui-input": ["show", "hide", "enable", "disable", "focus", "reset"],
    "ui-text": ["show", "hide"],
    "ui-table": ["show", "hide", "select"],
    "ui-container": ["show", "hide"],
    "ui-select": ["show", "hide", "enable", "disable"],
    "ui-textarea": ["show", "hide", "enable", "disable", "focus", "reset"],
    "ui-checkbox": ["show", "hide", "enable", "disable"],
    "ui-radio": ["show", "hide", "enable", "disable"],
    "ui-switch": ["show", "hide", "enable", "disable"],
    "ui-slider": ["show", "hide", "enable", "disable"],
    "ui-datepicker": ["show", "hide", "enable", "disable", "focus", "reset"],
    // single-active containers (tabs / stepper / menu) own `select`
    "ui-tabs": ["show", "hide", "select"],
    "ui-stepper": ["show", "hide", "select"],
    "ui-menu": ["show", "hide", "select"],
    "ui-accordion": ["show", "hide", "open", "close"],
    // P95: breadcrumb supports show/hide visibility control
    "ui-breadcrumb": ["show", "hide"]
};

// Build the interaction command for a target node from msg.ui.action. The target
// defaults to the node's own id; an explicit msg.ui.action.target wins.
function buildInteractionCommand(node, uiAction) {
    const type = String(uiAction.type);
    const explicitTarget = typeof uiAction.target === "string" && uiAction.target
        ? uiAction.target
        : undefined;
    return {
        type,
        target: explicitTarget || node.id,
        to: typeof uiAction.to === "string" && uiAction.to ? uiAction.to : undefined,
        part: typeof uiAction.part === "string" && uiAction.part ? uiAction.part : undefined
    };
}

// ─── P66 (ADR 0007): navigate handling for ui-route / ui-app ───
//
// Two usage scenarios for actionType "navigate", both ending in the SAME push:
//   • SCENARIO 1 — the navigate action is wired (or picked) to a ui-route (or to
//     the ui-app for its implicit root "/"). The route/app builds the location
//     from ITS OWN path + the action's params. NO `to` is needed on the action.
//   • SCENARIO 2 — the navigate action is NOT wired to a route. It carries a `to`
//     (a path template, possibly with params) and is delivered app-global to the
//     ui-app, which resolves the location and navigates.
// onEnter/onLeave are emitted in BOTH scenarios as a consequence of ARRIVING at
// the new route — decoupled from the navigation mechanism (P66 owner decision).

// Collect the live in-memory node definitions (from registrations). Preferred
// over the flow file for runtime route resolution: it reflects the deployed
// nodes without a disk read and works in unit tests that populate registrations.
function collectLiveDefinitions() {
    const defs = [];
    for (const registration of runtimeState.definitions.values()) {
        if (registration && registration.definition) {
            defs.push(registration.definition);
        }
    }
    return defs;
}

// Find the route definition (and its runtime node) whose path matches a location
// for an app. The implicit app-root route has id === appId and path "/".
function findRouteNodeForLocation(RED, appId, location) {
    const live = collectLiveDefinitions();
    const definitions = live.length > 0 ? live : readDeployDefinitions(RED);
    const modelResult = getAppModelResult(appId, definitions);
    if (!modelResult.success) {
        return undefined;
    }
    const match = getRouteMatch(location || "/", modelResult.model.routes);
    if (!match) {
        return undefined;
    }
    const routeId = match.route.id;
    // The route definition id (uiId) equals the matched route id. Find its node.
    for (const registration of runtimeState.definitions.values()) {
        const def = registration.definition;
        if (def && (def.type === "ui-route" || def.type === "ui-app") && def.id === routeId && registration.nodeId) {
            return { routeId, node: RED.nodes.getNode(registration.nodeId), params: match.params || {} };
        }
    }
    return { routeId, node: undefined, params: match.params || {} };
}

// P86: Emit a clientConnected / clientDisconnected event on the ui-app node
// when a browser client connects or disconnects. The ui-app must declare the
// event (events array in its definition); absent → no-op. Positional out-port
// routing mirrors the generic dispatchClientEvent logic.
function emitAppClientEvent(appId, eventName, clientId) {
    const RED = runtimeState.RED;
    if (!RED) {
        return;
    }
    // Find the ui-app definition and its Node-RED node id.
    let appNodeId;
    let appDefinition;
    for (const registration of runtimeState.definitions.values()) {
        const def = registration.definition;
        if (def && def.type === "ui-app" && def.id === appId && registration.nodeId) {
            appNodeId = registration.nodeId;
            appDefinition = def;
            break;
        }
    }
    if (!appNodeId || !appDefinition) {
        return;
    }
    const events = Array.isArray(appDefinition.events) ? appDefinition.events : undefined;
    if (!events || events.indexOf(eventName) === -1) {
        return;
    }
    const appNode = RED.nodes.getNode(appNodeId);
    if (!appNode || typeof appNode.send !== "function") {
        return;
    }
    const message = {
        ui: {
            appId,
            clientId,
            event: eventName,
            sourceId: appId
        }
    };
    const portIndex = events.indexOf(eventName);
    if (portIndex > 0) {
        const outputs = new Array(portIndex + 1).fill(null);
        outputs[portIndex] = message;
        appNode.send(outputs);
    }
    else {
        appNode.send(message);
    }
}

// Emit an onEnter / onLeave event on a route/app node IF that node declares the
// event (positional out-port routing, mirroring dispatchClientEvent). This is how
// a wired flow reacts to a route being entered or left.
function emitRouteLifecycleEvent(node, eventName, appId, clientId, location, params) {
    if (!node || typeof node.send !== "function") {
        return;
    }
    const events = node.webappDefinition && Array.isArray(node.webappDefinition.events)
        ? node.webappDefinition.events
        : undefined;
    if (!events || events.indexOf(eventName) === -1) {
        return;
    }
    const message = {
        ui: {
            appId,
            clientId,
            event: eventName,
            sourceId: node.webappDefinition ? node.webappDefinition.id : node.id,
            route: location,
            params: params || {}
        }
    };
    const portIndex = events.indexOf(eventName);
    if (portIndex > 0) {
        const outputs = new Array(portIndex + 1).fill(null);
        outputs[portIndex] = message;
        node.send(outputs);
    }
    else {
        node.send(message);
    }
}

// Resolve the navigate destination location for a ui-route / ui-app target.
//   • ui-route → its own path, with :placeholders filled from action.params.
//   • ui-app   → action.to (Scenario 2 path template) filled from params, or the
//     implicit root "/" (Scenario 1: wired to the app for the home route).
// Returns the concrete location string (params already substituted).
function resolveNavigateLocation(node, uiAction) {
    const def = node && node.webappDefinition ? node.webappDefinition : {};
    const params = uiAction && uiAction.params && typeof uiAction.params === "object" ? uiAction.params : {};
    const explicitTo = typeof uiAction.to === "string" && uiAction.to ? uiAction.to : undefined;

    if (def.type === "ui-route") {
        // Scenario 1: the route owns its path. An explicit `to` on the action is
        // ambiguous (compile-time validation flags it) — the route's own path wins.
        const template = typeof def.path === "string" && def.path ? def.path : "/";
        return resolveNavigationTarget(template, params, {});
    }

    // ui-app: Scenario 2 (a `to` template) or Scenario 1 to the implicit root.
    const template = explicitTo || "/";
    return resolveNavigationTarget(template, params, {});
}

// Perform a navigate for a ui-route / ui-app target: resolve the new location,
// emit onLeave on the route being left and onEnter on the route being entered
// (in BOTH scenarios), then push the navigate command (which moves the client).
function performTargetNavigate(node, msg, send, done) {
    const RED = runtimeState.RED;
    const uiMsg = msg && msg.ui && typeof msg.ui === "object" ? msg.ui : undefined;
    const uiAction = uiMsg && uiMsg.action && typeof uiMsg.action === "object" ? uiMsg.action : {};
    const appId = findAppIdForNode(node);
    const clientId = uiMsg && uiMsg.clientId ? String(uiMsg.clientId) : undefined;

    const newLocation = resolveNavigateLocation(node, uiAction);

    if (RED && appId && newLocation) {
        // onLeave on the route(s) the targeted client(s) are currently on, before
        // the location changes. Then push (updates entry.location), then onEnter.
        const subscribers = runtimeState.streamClients.get(appId);
        const oldLocations = new Set();
        if (subscribers) {
            for (const [cid, entry] of subscribers.entries()) {
                if (!clientId || cid === clientId) {
                    oldLocations.add(entry.location || "/");
                }
            }
        }
        for (const oldLocation of oldLocations) {
            if (oldLocation !== newLocation) {
                const leaving = findRouteNodeForLocation(RED, appId, oldLocation);
                if (leaving && leaving.node) {
                    emitRouteLifecycleEvent(leaving.node, "onLeave", appId, clientId, oldLocation, leaving.params);
                }
            }
        }

        const command = {
            type: "navigate",
            target: node.id,
            to: newLocation
        };
        pushActionCommandToClients(appId, clientId, command);

        // onEnter on the route now entered. The targeted route node is usually
        // `node` itself (Scenario 1), but resolve by location so ui-app→sub-route
        // and `to`-template navigations emit on the correct route.
        const entering = findRouteNodeForLocation(RED, appId, newLocation);
        if (entering && entering.node) {
            emitRouteLifecycleEvent(entering.node, "onEnter", appId, clientId, newLocation, entering.params);
        }
    }

    send(msg);
    if (done) {
        done();
    }
}

// P59 / ADR 0007 §2: shared per-node interaction handler factory.
// `ownedVerbs` — the verb set this node type owns. `next` — the node's existing
// input handler, invoked when the message is NOT an owned interaction command.
function interactionInputHandler(ownedVerbs, next) {
    const owned = new Set(ownedVerbs || []);
    const fallback = next || passThroughInputHandler;
    return function onInteractionInput(node, msg, send, done) {
        const uiMsg = msg && msg.ui && typeof msg.ui === "object" ? msg.ui : undefined;
        const uiAction = uiMsg && uiMsg.action && typeof uiMsg.action === "object" ? uiMsg.action : undefined;

        if (uiAction && typeof uiAction.type === "string" && owned.has(uiAction.type)) {
            // P66: a navigate verb owned by a ui-route / ui-app is handled by the
            // shared navigate path — it resolves the location from the route's own
            // path (Scenario 1) or the action's `to` template (Scenario 2) and
            // emits onEnter/onLeave around the push. (DRY: route and app share it.)
            const ownerType = node && node.webappDefinition ? node.webappDefinition.type : undefined;
            if (uiAction.type === "navigate" && (ownerType === "ui-route" || ownerType === "ui-app")) {
                performTargetNavigate(node, msg, send, done);
                return;
            }

            // Owned verb → this node performs the SSE push, then passes msg through.
            const RED = runtimeState.RED;
            const appId = findAppIdForNode(node);
            const clientId = uiMsg && uiMsg.clientId ? String(uiMsg.clientId) : undefined;
            const command = buildInteractionCommand(node, uiAction);
            if (RED && appId) {
                pushActionCommandToClients(appId, clientId, command);
            }
            send(msg);
            if (done) {
                done();
            }
            return;
        }

        // Not an owned interaction command: defer to the node's existing handler.
        // A foreign action verb falls through here too → pure pass-through.
        fallback(node, msg, send, done);
    };
}

// Collect the configured wireless target node ids from a ui-action definition.
// P60 / ADR 0007 §3: the editor's node picker (RED.view.selectNodes) stores a
// LIST of target node ids in `targets`. The legacy singular `target` config
// field (pre-P60 free-text) is still honoured for backward-compat. Returns a
// de-duplicated, order-preserving array.
function collectConfiguredTargetIds(definition) {
    const ids = [];
    if (definition) {
        if (Array.isArray(definition.targets)) {
            for (const id of definition.targets) {
                if (typeof id === "string" && id) {
                    ids.push(id);
                }
            }
        }
        if (typeof definition.target === "string" && definition.target) {
            ids.push(definition.target);
        }
    }
    return ids.filter((id, index) => ids.indexOf(id) === index);
}

// P59 / ADR 0007 §3: ui-action is a pure typed EMITTER. On input it builds a
// schema-valid msg.ui.action from its config (msg.ui.action overrides win, ADR
// 0005) and SENDS IT OUT its output port — the wired target node performs the
// SSE push. ui-action no longer pushes centrally.
//
// P60 / ADR 0007 §3: addressing has two equivalent paths, both delivering via
// the SAME input path a wire uses (targetNode.receive(), NOT send() — fixing the
// ADR 0007 §Context-3 bug):
//   - Wiring (primary, visible): the output port is wired to the target node(s);
//     Node-RED carries the message into their input.
//   - Node picker (optional, "wireless"): the editor's RED.view.selectNodes()
//     picker stores a LIST of target ids in `targets`; on input ui-action
//     delivers the enriched message to EACH selected target via receive().
//
// An explicit msg.ui.action.target override is unified with the
// picker path: it too is delivered via receive() to exactly that node id.
//
// Backward-compat: old flows relying on the singular `target` config field with
// an UNWIRED output still work — `target` is treated as a single picked target.
function actionInputHandler(node, msg, send, done) {
    const RED = runtimeState.RED;
    const uiMsg = msg && msg.ui && typeof msg.ui === "object" ? msg.ui : undefined;

    // Build the typed action command from config + msg overrides (ADR 0005).
    const command = buildActionCommand(node.webappDefinition, msg, node);

    // Enrich the incoming message with msg.ui.action (ADR 0007 §1: enrich, don't
    // replace) — every other msg / msg.ui field rides along untouched.
    const outMsg = command
        ? Object.assign({}, msg, {
            ui: Object.assign({}, uiMsg, {
                action: Object.assign(
                    {},
                    uiMsg && uiMsg.action && typeof uiMsg.action === "object" ? uiMsg.action : {},
                    pruneUndefined(command)
                )
            })
        })
        : msg;

    // Explicit msg-level override (ADR 0007 §3, unified): msg.ui.action.target
    // names a single node id and is delivered via receive() to exactly
    // that node — NOT via send() (the ADR 0007 §Context-3 bug).
    const override = uiMsg && uiMsg.action && typeof uiMsg.action === "object" ? uiMsg.action : undefined;
    const overrideTargetId = override
        ? (typeof override.target === "string" && override.target ? override.target : undefined)
        : undefined;

    // Wireless picker (+ legacy singular `target`) → deliver to each selected
    // target's INPUT via receive(). The override, when present, takes precedence
    // and addresses exactly that node.
    const deliverTargetIds = overrideTargetId
        ? [overrideTargetId]
        : collectConfiguredTargetIds(node.webappDefinition);

    if (deliverTargetIds.length > 0 && RED) {
        let deliveredAny = false;
        for (const targetId of deliverTargetIds) {
            const targetNode = RED.nodes.getNode(targetId);
            if (targetNode && typeof targetNode.receive === "function") {
                targetNode.receive(clone(outMsg));
                deliveredAny = true;
            }
        }
        if (deliveredAny) {
            if (done) {
                done();
            }
            return;
        }
    }

    // P59 / ADR 0007 §4: app-global verbs (navigate / reset) have no per-element
    // target — their owner is the ui-app. A ui-action(navigate) with no explicit
    // target and no output wire (the common navbar-button case) is delivered to
    // the owning ui-app node's INPUT, which owns the verb and performs the push.
    const verb = command && command.type ? String(command.type) : undefined;
    const isAppGlobalVerb = verb && (INTERACTION_VERBS_BY_TYPE["ui-app"] || []).indexOf(verb) !== -1;
    if (isAppGlobalVerb && deliverTargetIds.length === 0 && RED && !nodeHasOutputWire(node)) {
        const appNodeId = findOwningAppNodeId(node);
        const appNode = appNodeId ? RED.nodes.getNode(appNodeId) : undefined;
        if (appNode && typeof appNode.receive === "function") {
            appNode.receive(clone(outMsg));
            if (done) {
                done();
            }
            return;
        }
    }

    // Primary path: emit the action message on the output port; the wired target
    // node performs the push.
    send(outMsg);
    if (done) {
        done();
    }
}

// Strip undefined values so Object.assign merges cleanly without clobbering
// existing fields with `undefined`.
function pruneUndefined(obj) {
    const out = {};
    for (const key of Object.keys(obj)) {
        if (obj[key] !== undefined) {
            out[key] = obj[key];
        }
    }
    return out;
}

// Does this ui-action node have at least one output wire? Reads the flow
// topology via the node's own `wires` array (populated by Node-RED on the
// runtime node). Used for the backward-compat unwired-target path.
function nodeHasOutputWire(node) {
    const wires = node && node.wires;
    if (!Array.isArray(wires)) {
        return false;
    }
    return wires.some((port) => Array.isArray(port) && port.length > 0);
}

const runtimeNodeRegistry = {
    "ui-app": {
        mapConfig: (config) => ({
            type: "ui-app",
            id: getUiId(config) || "",
            // P109: `root` is now an explicit schema field.
            root: config.root || "",
            // P109: `name` replaces `title`. Back-compat shim: old configs that
            // only have `title` (no `name`) are migrated transparently here.
            name: config.name || config.title || config.root || getUiId(config) || "App",
            layout: config.layout || "vertical",
            events: parseJsonList(config.events).length > 0 ? parseJsonList(config.events) : undefined,
            // P23: design tokens drive the Web Component theme via CSS custom
            // properties. Carried through unchanged so the page can inject them.
            tokens: parseTokens(config.tokens),
            // P56 / ADR 0006 §4: opt-in backend→frontend error forwarding.
            // Absent/false = OFF (secure default). minSeverity gates which errors
            // are forwarded; absent falls back to "error" at the read site.
            forwardErrorsToClient: config.forwardErrorsToClient === true || config.forwardErrorsToClient === "true",
            forwardErrorMinSeverity: blankToUndefined(config.forwardErrorMinSeverity),
            // P70: optional media-store base URL for asset:<id> resolution.
            mediaStoreUrl: blankToUndefined(config.mediaStoreUrl),
            // P106: deploy mode. The editor stores `deployMode` (config key — NOT
            // `status`, which is a reserved Node-RED node property). Accept the
            // Entwicklung / Produktion labels and the normalised development /
            // production tokens; default to "development" so existing apps keep the
            // convenient auto-update. `config.status` is honoured as a legacy alias.
            mode: normalizeAppMode(config.deployMode !== undefined ? config.deployMode : config.status)
        }),
        options: {
            // P59 / ADR 0007 §4: ui-app owns the app-global verbs navigate / reset.
            inputHandler: interactionInputHandler(INTERACTION_VERBS_BY_TYPE["ui-app"], passThroughInputHandler)
        }
    },
    "ui-route": {
        mapConfig: (config) => {
            // P89: title is a bindable field. A plain string or a literal binding
            // resolves to a string; dynamic bindings (state/store/msg/…) resolve to
            // undefined at compile time — the <title> element is server-rendered once
            // and cannot be updated at runtime for now.
            let resolvedTitle;
            if (config.title && typeof config.title === "object") {
                if (config.title.kind === "literal") {
                    // Literal binding → extract the value string.
                    resolvedTitle = typeof config.title.value === "string" && config.title.value.trim()
                        ? config.title.value
                        : undefined;
                } else if (typeof config.title.kind === "string") {
                    // Any other binding kind (state/store/msg/…) → not resolvable at
                    // compile time; fall back to undefined.
                    resolvedTitle = undefined;
                } else {
                    resolvedTitle = undefined;
                }
            } else {
                resolvedTitle = blankToUndefined(config.title);
            }
            return {
                type: "ui-route",
                id: getUiId(config),
                parent: config.parent || undefined,
                path: config.path,
                title: resolvedTitle,
                layout: config.layoutId,
                events: parseJsonList(config.events).length > 0 ? parseJsonList(config.events) : undefined
            };
        },
        options: {
            // P59 / ADR 0007 §4: ui-route gains an input handler (and inputs:1 in
            // its HTML) for the app-global verbs navigate / reset.
            inputHandler: interactionInputHandler(INTERACTION_VERBS_BY_TYPE["ui-route"], passThroughInputHandler)
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
            // P64: closable defaults to true; only an explicit false disables it.
            closable: config.closable !== false && config.closable !== "false",
            events: parseJsonList(config.events).length > 0 ? parseJsonList(config.events) : undefined
        }),
        options: {
            inputHandler: interactionInputHandler(INTERACTION_VERBS_BY_TYPE["ui-dialog"], dialogInputHandler)
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
            size: blankToUndefined(config.size),
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: interactionInputHandler(INTERACTION_VERBS_BY_TYPE["ui-text"], viewNodePatchInputHandler)
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
            variant: config.variant || undefined,
            action: blankToUndefined(config.action),
            icon: mapIconField(config.icon),
            size: blankToUndefined(config.size),
            outline: config.outline === true || config.outline === "true" ? true : undefined,
            linkMode: blankToUndefined(config.linkMode),
            // P71: href is binding-capable. A dynamic binding object passes through;
            // a non-blank literal string becomes a literal binding; blank → undefined.
            href: getBinding(
                config.href,
                blankToUndefined(config.href) ? literalBinding(config.href) : undefined
            ),
            disabled: getBinding(config.disabled, config.disabledPath ? stateBinding(config.disabledPath) : undefined),
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: interactionInputHandler(INTERACTION_VERBS_BY_TYPE["ui-button"], buttonInputHandler)
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
            inputHandler: interactionInputHandler(INTERACTION_VERBS_BY_TYPE["ui-table"], viewNodePatchInputHandler)
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
            variant: config.variant || undefined,
            events: parseJsonList(config.events).length > 0 ? parseJsonList(config.events) : undefined,
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: interactionInputHandler(INTERACTION_VERBS_BY_TYPE["ui-container"], componentStateInputHandler)
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
            variant: config.variant || undefined,
            size: blankToUndefined(config.size),
            disabled: getBinding(config.disabled, config.disabledPath ? stateBinding(config.disabledPath) : undefined),
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: interactionInputHandler(INTERACTION_VERBS_BY_TYPE["ui-input"], viewNodePatchInputHandler)
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
            size: blankToUndefined(config.size),
            disabled: getBinding(config.disabled, undefined),
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: interactionInputHandler(INTERACTION_VERBS_BY_TYPE["ui-select"], viewNodePatchInputHandler)
        }
    },
    "ui-checkbox": {
        mapConfig: (config) => ({
            type: "ui-checkbox",
            id: getUiId(config),
            parent: config.parent || undefined,
            mount: config.mount || config.parent,
            order: toOptionalNumber(config.order),
            // P97: label is now a binding object when set via typedInput; legacy plain string is preserved.
            label: config.label,
            value: getBinding(config.value, config.valuePath ? stateBinding(config.valuePath) : undefined),
            // P97: size field (xs/sm/md/lg/xl).
            size: config.size || undefined,
            disabled: getBinding(config.disabled, undefined),
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: interactionInputHandler(INTERACTION_VERBS_BY_TYPE["ui-checkbox"], viewNodePatchInputHandler)
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
            inputHandler: interactionInputHandler(INTERACTION_VERBS_BY_TYPE["ui-radio"], viewNodePatchInputHandler)
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
            inputHandler: interactionInputHandler(INTERACTION_VERBS_BY_TYPE["ui-switch"], viewNodePatchInputHandler)
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
            size: blankToUndefined(config.size),
            disabled: getBinding(config.disabled, undefined),
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: interactionInputHandler(INTERACTION_VERBS_BY_TYPE["ui-textarea"], viewNodePatchInputHandler)
        }
    },
    "ui-datepicker": {
        mapConfig: (config) => ({
            type: "ui-datepicker",
            id: getUiId(config),
            parent: config.parent || undefined,
            mount: config.mount || config.parent,
            order: toOptionalNumber(config.order),
            // P98: label is now a full binding (literal/state/store/…) or a plain string (legacy).
            // getBinding handles both: if config.label is a binding object it is returned as-is;
            // if it is a plain string a literal binding is NOT needed — the P16X handler already
            // puts plain strings into props.label directly and the renderer reads props.label.
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
            inputHandler: interactionInputHandler(INTERACTION_VERBS_BY_TYPE["ui-datepicker"], viewNodePatchInputHandler)
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
            inputHandler: interactionInputHandler(INTERACTION_VERBS_BY_TYPE["ui-slider"], viewNodePatchInputHandler)
        }
    },
    "ui-store": {
        mapConfig: (config) => {
            const VALID_SCOPES = ["any", "broadcast-only", "client-only"];
            const rawScope = config.scope;
            const scope = typeof rawScope === "string" && VALID_SCOPES.includes(rawScope) && rawScope !== "any"
                ? rawScope
                : undefined;
            return {
                type: "ui-store",
                id: getUiId(config),
                parent: config.parent || undefined,
                statePath: config.statePath,
                initialValue: parseJson(config.initialValue),
                persist: config.persist === true || config.persist === "true",
                ...(scope ? { scope } : {})
            };
        },
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

                // P15: clientId routing — per-client state when clientId is present
                const clientId = msg && msg.ui && msg.ui.clientId ? String(msg.ui.clientId) : undefined;

                // P110: scope guard — enforce the declared write-target policy before
                // any state mutation. "any" (default / undefined) never rejects.
                const scope = storeDefinition.scope;
                if (scope === "broadcast-only" && clientId) {
                    const errMsg = "ClientID auf Broadcast-Only-Store nicht erlaubt. Broadcast Only store does not accept per-client messages.";
                    reportRuntimeError(node, {
                        severity: "error",
                        code: "server.store.scope-violation",
                        message: errMsg,
                        context: { appId: activeAppId || undefined, nodeId: node.id, op: `store:${operation.op}` },
                        clientId
                    });
                    if (done) {
                        done(new Error(errMsg));
                    }
                    return;
                }
                if (scope === "client-only" && !clientId) {
                    const errMsg = "Broadcast nicht erlaubt: Store ist Client Only. Client Only store requires a clientId.";
                    reportRuntimeError(node, {
                        severity: "error",
                        code: "server.store.scope-violation",
                        message: errMsg,
                        context: { appId: activeAppId || undefined, nodeId: node.id, op: `store:${operation.op}` },
                        clientId: undefined
                    });
                    if (done) {
                        done(new Error(errMsg));
                    }
                    return;
                }

                // P80: validate the operation against storeOperationSchema before
                // attempting to apply it. This surfaces the schema's descriptive
                // per-operation messages (e.g. "Store operation 'set' requires a value.")
                // as structured runtime errors instead of silently running with undefined
                // path/value — or worse, having applyStoreOperation throw a generic error.
                const parseResult = storeOperationSchema.safeParse(operation);
                if (!parseResult.success) {
                    const firstMessage = parseResult.error.issues[0]?.message || "Invalid store operation.";
                    reportRuntimeError(node, {
                        severity: "error",
                        code: "server.store.invalid-operation",
                        message: firstMessage,
                        context: { appId: activeAppId || undefined, nodeId: node.id, op: `store:${operation.op}` },
                        clientId
                    });
                    if (done) {
                        done(new Error(firstMessage));
                    }
                    return;
                }

                if (!activeAppId) {
                    reportRuntimeError(node, {
                        severity: "error",
                        code: "server.store.no-active-app",
                        message: "No active ui-app is registered for ui-store updates.",
                        context: { nodeId: node.id, op: "storeUpdate" },
                        clientId
                    });
                    if (done) {
                        done(new Error("No active ui-app is registered for ui-store updates."));
                    }
                    return;
                }

                const baseState = clientId
                    ? (getClientState(activeAppId, clientId)?.state || clone(runtimeState.liveState.get(activeAppId) || initializeState([storeDefinition], [], activeAppId)))
                    : clone(runtimeState.liveState.get(activeAppId) || initializeState([storeDefinition], [], activeAppId));

                let applied;
                try {
                    applied = applyStoreOperation(baseState, storeDefinition, operation);
                }
                catch (error) {
                    reportRuntimeError(node, {
                        severity: "error",
                        code: "server.store.operation-failed",
                        message: `ui-store operation failed: ${error instanceof Error ? error.message : String(error)}`,
                        context: { appId: activeAppId, nodeId: node.id, op: `store:${operation && operation.op ? operation.op : "?"}` },
                        clientId
                    });
                    if (done) {
                        done(error instanceof Error ? error : new Error(String(error)));
                    }
                    return;
                }
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
            // P66 (ADR 0007): navigate `to` is a typedInput — `to` is the value,
            // `toType` its type (default "str", a literal path). Resolution of
            // msg/flow/global/jsonata happens at input time in actionInputHandler.
            to: blankToUndefined(config.to),
            toType: blankToUndefined(config.toType) || (blankToUndefined(config.to) ? "str" : undefined),
            // P66: named URL params (Scenario 1: wired to a ui-route).
            params: parseParamsObject(config.params),
            // P60 / ADR 0007 §3: the node picker stores a LIST of target node ids
            // (the optional "wireless" path). Legacy singular `target` (pre-P60
            // free-text) is still honoured for backward-compat.
            targets: parseTargetIds(config.targets),
            target: blankToUndefined(config.target),
            part: blankToUndefined(config.part),
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
            // P67: title is a binding. Back-compat: a plain-string title (legacy
            // flows / programmatic configs) is wrapped as a literal binding.
            title: getBinding(config.title, typeof config.title === "string" && config.title.length > 0 ? literalBinding(config.title) : undefined),
            dismissible: config.dismissible === true || config.dismissible === "true" || undefined,
            visible: getBinding(config.visible, undefined),
            // P90: icon field — "auto" / "none" / icon name / binding.
            // Absent (undefined) means no icon (default when not configured).
            ...(config.icon !== undefined && config.icon !== null && config.icon !== "" ? { icon: config.icon } : {}),
            // P91: duration (positive integer, ms) + countdown (boolean).
            // duration: auto-hide the alert after this many ms; absent = never.
            // countdown: show a progress bar for remaining time (Shoelace native).
            ...(config.duration ? { duration: toOptionalNumber(config.duration) } : {}),
            ...(config.countdown === true || config.countdown === "true" ? { countdown: true } : {}),
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
            inputHandler: toastInputHandler
        }
    },
    "ui-progress": {
        mapConfig: (config) => ({
            type: "ui-progress",
            id: getUiId(config),
            parent: config.parent || undefined,
            mount: config.mount || config.parent,
            order: toOptionalNumber(config.order),
            displayType: config.displayType || config.variant || undefined,
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
            displayType: config.displayType || config.variant || undefined,
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
            // P92: displayType is now shape (square/rounded/pill). Back-compat:
            // map old count/dot/status display type values to new shape values.
            displayType: (() => {
                const dt = config.displayType || config.variant || undefined;
                if (!dt) return undefined;
                // Legacy count/dot/status → map to new shape vocabulary
                if (dt === "count" || dt === "status") return "rounded";
                if (dt === "dot") return "rounded";
                return dt;
            })(),
            // P92: variant (renamed from severity). Back-compat: accept legacy
            // `severity` field too.
            variant: config.variant && !["count", "dot", "status", "square", "rounded", "pill"].includes(config.variant)
                ? config.variant
                : config.severity || undefined,
            // P92: pulsating maps to Shoelace `pulse` attribute.
            pulsating: config.pulsating === true || config.pulsating === "true" ? true : undefined,
            // P103: size field removed — not passed through any more.
            // P92: max field removed — not passed through any more.
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
            tabs: (parseJsonList(config.tabs).length > 0 ? parseJsonList(config.tabs) : parseList(config.tabs)).map((t) => {
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
            inputHandler: interactionInputHandler(INTERACTION_VERBS_BY_TYPE["ui-tabs"], componentStateInputHandler)
        }
    },
    "ui-accordion": {
        mapConfig: (config) => ({
            type: "ui-accordion",
            id: getUiId(config),
            parent: config.parent || undefined,
            mount: config.mount || config.parent,
            order: toOptionalNumber(config.order),
            sections: (parseJsonList(config.sections).length > 0 ? parseJsonList(config.sections) : parseList(config.sections)).map((t) => {
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
            inputHandler: interactionInputHandler(INTERACTION_VERBS_BY_TYPE["ui-accordion"], componentStateInputHandler)
        }
    },
    "ui-breadcrumb": {
        mapConfig: (config) => {
            // P95: normalise static breadcrumb items from the editor.
            // Priority resolution:
            //   1. config.items is a binding object ({kind,...}) → use directly
            //   2. config.items is an already-parsed array → use directly
            //   3. config.itemsJson is a JSON string (new editor format) → parse
            //   4. config.items is a JSON string (legacy) → parse
            //   5. config.itemsPath (legacy P75 state-path shorthand) → stateBinding
            function normaliseItems() {
                const rawItems = config.items;
                // Dynamic binding object
                const binding = getBinding(rawItems, undefined);
                if (binding) return binding;
                // Already an array (from flow.json or tests)
                if (Array.isArray(rawItems)) return rawItems;
                // New editor format: itemsJson holds the JSON literal
                if (config.itemsJson && typeof config.itemsJson === "string" && config.itemsJson.trim()) {
                    try {
                        const parsed = JSON.parse(config.itemsJson);
                        if (Array.isArray(parsed)) return parsed;
                    } catch (_) { /* fall through */ }
                }
                // Legacy: items as JSON string
                if (rawItems && typeof rawItems === "string" && rawItems.trim()) {
                    try {
                        const parsed = JSON.parse(rawItems);
                        if (Array.isArray(parsed)) return parsed;
                    } catch (_) { /* fall through */ }
                }
                return undefined;
            }
            const resolvedItems = normaliseItems()
                || (config.itemsPath ? stateBinding(config.itemsPath) : undefined);

            return {
                type: "ui-breadcrumb",
                id: getUiId(config),
                parent: config.parent || undefined,
                mount: config.mount || config.parent,
                order: toOptionalNumber(config.order),
                // P95: layout="breadcrumb" activates child-node slot mode (c & d).
                layout: config.layout === "breadcrumb" ? "breadcrumb" : undefined,
                items: resolvedItems,
                separator: config.separator || undefined,
                // P95: ALL items emit a `click` event (sourceId = breadcrumb node id,
                // params.action = item's action value or label).
                // `navigate` kept as back-compat alias for consumers pinned to P75.
                events: ["click"],
                ...collectNodeConfigLayoutProps(config)
            };
        },
        options: {
            inputHandler: interactionInputHandler(INTERACTION_VERBS_BY_TYPE["ui-breadcrumb"], componentStateInputHandler)
        }
    },
    "ui-menu": {
        mapConfig: (config) => ({
            type: "ui-menu",
            id: getUiId(config),
            parent: config.parent || undefined,
            mount: config.mount || config.parent,
            order: toOptionalNumber(config.order),
            displayType: config.displayType || config.variant || undefined,
            items: getBinding(config.items, config.itemsPath ? stateBinding(config.itemsPath) : undefined) || parseJsonList(config.items),
            activeItem: getBinding(config.activeRoute, config.activeRoutePath ? stateBinding(config.activeRoutePath) : undefined),
            // P75: ui-menu always exposes a single navigate output port; a click on
            // a navigable item (route/path, not external href) emits a `navigate`
            // event. See the ui-breadcrumb note above.
            events: ["navigate"],
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: interactionInputHandler(INTERACTION_VERBS_BY_TYPE["ui-menu"], componentStateInputHandler)
        }
    },
    "ui-pagination": {
        mapConfig: (config) => ({
            type: "ui-pagination",
            id: getUiId(config),
            parent: config.parent || undefined,
            mount: config.mount || config.parent,
            order: toOptionalNumber(config.order),
            page: getBinding(config.page, config.currentPagePath ? stateBinding(config.currentPagePath) : undefined),
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
            steps: (parseJsonList(config.steps).length > 0 ? parseJsonList(config.steps) : parseList(config.steps)).map((t) => {
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
            inputHandler: interactionInputHandler(INTERACTION_VERBS_BY_TYPE["ui-stepper"], componentStateInputHandler)
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
            // P70: object-fit mode (contain/cover/fill/none).
            fit: config.fit || undefined,
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
            icon: mapIconField(config.icon) || "",
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
            items: getBinding(config.items, config.itemsPath ? stateBinding(config.itemsPath) : undefined) || parseJsonList(config.items),
            displayType: config.displayType || config.variant || undefined,
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
            // P94: `src` is now a full binding (image typedInput). Back-compat: old
            // `srcPath` (plain state path, pre-P94) is still accepted.
            src: getBinding(config.src, config.srcPath ? stateBinding(config.srcPath) : undefined),
            // P94: initials is now a full binding. Back-compat: plain string from
            // pre-P94 flows is accepted by passing it as a literal binding.
            initials: (config.initials && typeof config.initials === "object" && typeof config.initials.kind === "string")
                ? getBinding(config.initials, undefined)
                : (typeof config.initials === "string" && config.initials ? { kind: "literal", value: config.initials } : undefined),
            icon: mapIconField(config.icon),
            // P93: alt attribute removed — sl-avatar uses the `label` attr for a11y.
            size: config.size || undefined,
            shape: config.shape || undefined,
            // P94: variant (semantic colour role). Shoelace emits data-variant instead.
            variant: config.variant || undefined,
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
        // P76: ui-divider is a static display node with no input port (inputs:0 in
        // the editor). The previous componentStateInputHandler was unreachable dead
        // code. Removing it makes the runtime consistent with the spec and the editor.
        options: {}
    },
    // P57: ui-log — persistent error/log display, subscribes to SSE "error" channel
    "ui-log": {
        mapConfig: (config) => ({
            type: "ui-log",
            id: getUiId(config),
            parent: config.parent || undefined,
            mount: config.mount || config.parent,
            order: toOptionalNumber(config.order),
            minSeverity: config.minSeverity || undefined,
            maxEntries: toOptionalNumber(config.maxEntries),
            collapsed: config.collapsed === true || config.collapsed === "true" || undefined,
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: passThroughInputHandler
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
    registerDeployHook(RED);
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
    // P60 / ADR 0007 §3: ui-action node-picker target list helpers
    parseTargetIds,
    collectConfiguredTargetIds,
    // P59 / ADR 0007 §2: per-node interaction handler factory + verb ownership
    interactionInputHandler,
    INTERACTION_VERBS_BY_TYPE,
    // P66 (ADR 0007): navigate scenarios + cross-validation
    resolveActionTo,
    resolveNavigateLocation,
    performTargetNavigate,
    validateNavigationFlow,
    validateAppRootUniqueness,
    parseParamsObject,
    runtimeNodeRegistry,
    runtimeState,
    // P39 / P52: view-node input patch handler + deploy-definition reader
    viewNodePatchInputHandler,
    readDeployDefinitions,
    // P70 Ebene 2: ui-image msg.payload → src (Buffer/Base64 → data:)
    payloadToImageSrc,
    sniffImageContentType,
    // P70 Ebene 3: media-store asset proxy resolution + path-traversal guard
    resolveAssetStoreUrl,
    // P15
    getClientState,
    setClientState,
    resolveReconnectState,
    // P106: live model delivery on deploy — shell signature + deploy push + mode
    computeShellSignature,
    pushDeployToClients,
    resolveAppMode,
    normalizeAppMode,
    // P31: live Server→Client push transport (SSE)
    addStreamClient,
    removeStreamClient,
    getStreamSubscribers,
    pushSnapshotToClients,
    pushActionCommandToClients,
    buildActionCommand,
    writeStreamEvent,
    // P56: structured runtime logging + opt-in error forwarding (ADR 0006)
    pushErrorToClients,
    reportRuntimeError,
    resolveAppForwardConfig,
    redactErrorMessage,
    makeStructuredError,
    // P86: ui-app clientConnected/clientDisconnected emission
    emitAppClientEvent
};

registerWebappNodes.registerNodeType = registerNodeType;

module.exports = registerWebappNodes;
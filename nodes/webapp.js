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

const runtimeState = {
    definitions: new Map(),
    previewState: new Map(),
    previewQueries: new Map(),
    previewMessages: new Map(),
    endpointsRegistered: false
};

const WEBAPP_NODE_TYPES = new Set([
    "ui-app",
    "ui-layout",
    "ui-slot",
    "ui-route",
    "ui-dialog",
    "ui-text",
    "ui-button",
    "ui-table",
    "ui-container",
    "ui-input",
    "ui-store",
    "ui-query",
    "ui-action",
    "ui-navigation"
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

function buildSlots(slotDefinitions, layoutId) {
    return slotDefinitions
        .filter((slot) => slot.layoutId === layoutId)
        .slice()
        .sort((left, right) => {
            const leftOrder = left.order || 0;
            const rightOrder = right.order || 0;
            return leftOrder - rightOrder || left.name.localeCompare(right.name);
        })
        .map((slot) => ({
            name: slot.name,
            title: slot.title
        }));
}

function toComponentDefinitions(components) {
    return components.map((component) => {
        if (component.type === "ui-text") {
            return {
                id: component.id,
                kind: "text",
                mount: component.mount,
                order: toOptionalNumber(component.order),
                bind: {
                    value: getBinding(component.value, literalBinding(component.text || ""))
                },
                props: blankToUndefined(component.variant) ? { variant: component.variant } : {},
                events: []
            };
        }

        if (component.type === "ui-button") {
            return {
                id: component.id,
                kind: "button",
                mount: component.mount,
                order: toOptionalNumber(component.order),
                bind: component.disabled || component.disabledPath ? { disabled: getBinding(component.disabled, stateBinding(component.disabledPath || "")) } : {},
                props: { label: component.label },
                events: [{ event: "click", action: component.action }]
            };
        }

        if (component.type === "ui-table") {
            return {
                id: component.id,
                kind: "table",
                mount: component.mount,
                order: toOptionalNumber(component.order),
                bind: {
                    rows: getBinding(component.rows, queryBinding(component.rowsPath || ""))
                },
                props: { columns: parseList(component.columns) },
                events: component.selectAction ? [{ event: "select", action: component.selectAction }] : []
            };
        }

        if (component.type === "ui-container") {
            return {
                id: component.id,
                kind: "container",
                mount: component.mount,
                order: toOptionalNumber(component.order),
                bind: {},
                props: { layoutId: component.layoutId },
                events: []
            };
        }

        if (component.type === "ui-input") {
            return {
                id: component.id,
                kind: "input",
                mount: component.mount,
                order: toOptionalNumber(component.order),
                bind: {
                    value: getBinding(component.value, stateBinding(joinStatePath(component.storeId ? undefined : "", component.path || "")))
                },
                props: {
                    label: component.label,
                    storeId: component.storeId,
                    path: component.path,
                    inputType: component.inputType
                },
                events: []
            };
        }

        return {
            id: component.id,
            kind: "text",
            mount: component.mount,
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
        ...buckets.routes.map((route) => route.layoutId),
        ...buckets.dialogs.map((dialog) => dialog.layoutId),
        ...buckets.components.filter((component) => component.type === "ui-container").map((component) => component.layoutId)
    ]);
    const standardLayouts = collectMissingStandardLayouts(
        referencedLayoutIds,
        buckets.layouts.map((layout) => layout.id)
    );
    const routes = buckets.routes.slice();

    if (!routes.some((route) => route.path === "/") && !routes.some((route) => route.id === buckets.app.id)) {
        routes.push(createAppRootRoute(buckets.app.id, blankToUndefined(buckets.app.title), buckets.app.layout));
    }

    const modelCandidate = {
        id: buckets.app.id,
        title: buckets.app.title,
        layouts: [...standardLayouts, ...buckets.layouts]
            .map((layout) => ({
                id: layout.id,
                title: blankToUndefined(layout.title),
                slots: layout.type === "ui-layout" ? buildSlots(buckets.slots, layout.id) : layout.slots
            }))
            .sort((left, right) => left.id.localeCompare(right.id)),
        routes: routes
            .map((route) => ({
                id: route.id,
                path: route.path,
                title: blankToUndefined(route.title),
                layoutId: route.layoutId
            }))
            .sort((left, right) => left.path.localeCompare(right.path)),
        dialogs: buckets.dialogs
            .map((dialog) => ({
                id: dialog.id,
                title: blankToUndefined(dialog.title),
                layoutId: dialog.layoutId,
                routeId: blankToUndefined(dialog.routeId),
                modal: dialog.modal !== false
            }))
            .sort((left, right) => left.id.localeCompare(right.id)),
        components: toComponentDefinitions(buckets.components)
    };

    const validation = appModelSchema.safeParse(modelCandidate);

    if (!validation.success) {
        return {
            success: false,
            status: 409,
            message: validation.error.issues[0]?.message || `App '${appId}' is incomplete.`
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

    return resolved === undefined ? binding.fallback : resolved;
}

function mountMatches(component, regionPath, model, routeId, layoutId, dialogId) {
    const mount = String(component.mount || "");

    if (mount.startsWith("route:/")) {
        const route = model.routes
            .filter((candidate) => mount.startsWith(`route:${candidate.path}/`) || mount === `route:${candidate.path}`)
            .sort((left, right) => right.path.length - left.path.length)[0];
        if (!route || route.id !== routeId) {
            return false;
        }
        const expectedPath = mount.slice(`route:${route.path}/`.length).split("/").filter(Boolean).join("/");
        return expectedPath === regionPath.join("/");
    }

    if (mount.startsWith("dialog:")) {
        if (!dialogId) {
            return false;
        }
        const [dialogTarget, ...mountPath] = mount.slice("dialog:".length).split("/").filter(Boolean);
        return dialogTarget === dialogId && mountPath.join("/") === regionPath.join("/");
    }

    if (mount.startsWith("layout:")) {
        const [layoutTarget, ...mountPath] = mount.slice("layout:".length).split("/").filter(Boolean);
        return layoutTarget === layoutId && mountPath.join("/") === regionPath.join("/");
    }

    const [target, targetRegion] = mount.split(".");
    return (target === routeId || target === layoutId || target === dialogId) && targetRegion === regionPath[0] && regionPath.length === 1;
}

function layoutHasInputs(model, layoutId, visited = new Set()) {
    if (visited.has(layoutId)) {
        return false;
    }

    visited.add(layoutId);

    return model.components.some((component) => {
        if (!String(component.mount || "").startsWith(`layout:${layoutId}/`)) {
            return false;
        }

        if (component.kind === "input") {
            return true;
        }

        if (component.kind === "container") {
            return layoutHasInputs(model, String(component.props.layoutId || ""), visited);
        }

        return false;
    });
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

function renderSlotTree(slots, model, context, routeId, layoutId, dialogId) {
    return slots.map((slot) => {
        const slotPath = [...context.path, slot.name];
        const components = model.components
            .filter((component) => mountMatches(component, slotPath, model, routeId, layoutId, dialogId))
            .sort((left, right) => (left.order || 0) - (right.order || 0) || left.id.localeCompare(right.id))
            .map((component) => renderComponent(component, context.sources, model, {
                routeId,
                layoutId,
                dialogId,
                location: context.location,
                formId: context.formId
            }));

        return {
            layoutId,
            name: slot.name,
            title: slot.title,
            components
        };
    });
}

function sanitizeClassSuffix(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "") || "default";
}

function getLayoutVariant(layoutId) {
    return ["horizontal", "vertical", "app"].includes(layoutId) ? layoutId : "custom";
}

function renderLayoutHtml(layoutId, slots) {
    const variant = getLayoutVariant(layoutId);
    return `<div class="webapp-layout webapp-layout--${escapeAttribute(variant)}">${slots.map(renderSlotHtml).join("")}</div>`;
}

function renderComponent(component, sources, model, context) {
    const disabled = Boolean(resolveBinding(component.bind && component.bind.disabled, sources));
    const action = component.events && component.events[0] ? component.events[0].action : undefined;

    if (component.kind === "text") {
        return {
            kind: "text",
            id: component.id,
            text: String(resolveBinding(component.bind.text || component.bind.value, sources) || "")
        };
    }

    if (component.kind === "button") {
        const href = action
            ? buildActionHref(model.id, action, context.location, component.id, context.formId ? "submit" : "click", sources.params)
            : undefined;

        return {
            kind: "button",
            id: component.id,
            label: String(component.props.label || component.id),
            href,
            submitFormId: context.formId,
            disabled
        };
    }

    if (component.kind === "table") {
        return {
            kind: "table",
            id: component.id,
            columns: Array.isArray(component.props.columns) ? component.props.columns : [],
            rows: Array.isArray(resolveBinding(component.bind.rows, sources)) ? resolveBinding(component.bind.rows, sources) : [],
            selectAction: action,
            appId: model.id,
            location: context.location
        };
    }

    if (component.kind === "input") {
        return {
            kind: "input",
            id: component.id,
            label: String(component.props.label || component.id),
            name: String(component.props.path || component.id),
            value: String(resolveBinding(component.bind.value, sources) || ""),
            inputType: String(component.props.inputType || "text")
        };
    }

    if (component.kind === "container") {
        const childLayout = getLayout(model, String(component.props.layoutId || ""));

        if (!childLayout) {
            return {
                kind: "container",
                id: component.id,
                formId: undefined,
                slots: []
            };
        }

        const formId = layoutHasInputs(model, childLayout.id) ? `webapp-form-${component.id}` : undefined;

        return {
            kind: "container",
            id: component.id,
            layoutId: childLayout.id,
            formId,
            slots: renderSlotTree(childLayout.slots, model, { path: [], sources, location: context.location, formId }, context.routeId, childLayout.id, context.dialogId)
        };
    }

    return {
        kind: "text",
        id: component.id,
        text: component.id
    };
}

function renderSlotHtml(slot) {
    const title = slot.title ? `<h3>${escapeHtml(slot.title)}</h3>` : "";
    const components = slot.components.map(renderComponentHtml).join("");
    const layoutVariant = getLayoutVariant(slot.layoutId);
    const slotClass = sanitizeClassSuffix(slot.name);
    return `<section class="webapp-slot webapp-slot--${escapeAttribute(slotClass)}"><header><h2>${escapeHtml(slot.name)}</h2>${title}</header><div class="webapp-slot-body webapp-slot-body--${escapeAttribute(layoutVariant)}">${components}</div></section>`;
}

function renderComponentHtml(component) {
    if (component.kind === "text") {
        return `<div class="webapp-text">${escapeHtml(component.text)}</div>`;
    }

    if (component.kind === "button") {
        const label = escapeHtml(component.label);

        if (component.disabled) {
            return `<button class="webapp-button" disabled>${label}</button>`;
        }

        if (component.submitFormId && component.href) {
            return `<button class="webapp-button" type="submit" form="${escapeAttribute(component.submitFormId)}" formaction="${escapeAttribute(component.href)}">${label}</button>`;
        }

        if (component.href) {
            return `<a class="webapp-button" href="${escapeAttribute(component.href)}">${label}</a>`;
        }

        return `<button class="webapp-button" disabled>${label}</button>`;
    }

    if (component.kind === "table") {
        const header = component.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("");
        const rows = component.rows.length === 0
            ? `<tr><td colspan="${Math.max(component.columns.length, 1)}">No rows loaded.</td></tr>`
            : component.rows.map((row) => {
                const rowId = row.id !== undefined ? String(row.id) : "";
                const actionPrefix = component.selectAction
                    ? `/webapp/${encodeURIComponent(component.appId)}/action/${encodeURIComponent(component.selectAction)}?location=${encodeURIComponent(component.location || "/customers")}&sourceId=${encodeURIComponent(component.id)}&event=select&rowId=${encodeURIComponent(rowId)}`
                    : undefined;
                const cells = component.columns.map((column, index) => {
                    const value = escapeHtml(row[column] ?? "");

                    if (index === 0 && actionPrefix && rowId) {
                        return `<td><a class="webapp-link" href="${escapeAttribute(actionPrefix)}">${value}</a></td>`;
                    }

                    return `<td>${value}</td>`;
                }).join("");
                return `<tr>${cells}</tr>`;
            }).join("");
        return `<table class="webapp-table"><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table>`;
    }

    if (component.kind === "input") {
        return `<label class="webapp-field">${escapeHtml(component.label)}<input type="${escapeAttribute(component.inputType)}" name="${escapeAttribute(component.name)}" value="${escapeAttribute(component.value)}"></label>`;
    }

    if (component.kind === "container") {
        const content = renderLayoutHtml(component.layoutId, component.slots);
        return component.formId
            ? `<form class="webapp-form" id="${escapeAttribute(component.formId)}" method="get">${content}</form>`
            : `<div class="webapp-container">${content}</div>`;
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
        if (typedAction.targetMode === "out-port") {
            // Out-port actions only emit their UI message in the first typed-action version.
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
    const sources = {
        state: effectiveState,
        queries,
        params: routeMatch.params,
        navigations: integration.navigations
    };
    const slots = renderSlotTree(layout.slots, model, { path: [], sources, location, formId: undefined }, routeMatch.route.id, layout.id, undefined);
    const dialogs = model.dialogs
        .filter((dialog) => dialog.id === dialogId)
        .map((dialog) => {
            const dialogLayout = getLayout(model, dialog.layoutId);
            return dialogLayout
                ? {
                    title: dialog.title || dialog.id,
                    layoutId: dialogLayout.id,
                    slots: renderSlotTree(dialogLayout.slots, model, { path: [], sources, location, formId: undefined }, routeMatch.route.id, dialogLayout.id, dialog.id)
                }
                : undefined;
        })
        .filter(Boolean);

    const dialogHtml = dialogs.map((dialog) => `<div class="webapp-dialog"><div class="webapp-dialog-card"><div class="webapp-dialog-head"><h2>${escapeHtml(dialog.title)}</h2><a href="/webapp/${encodeURIComponent(appId)}/action/closeCustomerEditor?location=${encodeURIComponent(location)}&sourceId=cancelCustomerButton&event=click" class="webapp-link">Close</a></div>${renderLayoutHtml(dialog.layoutId, dialog.slots)}</div></div>`).join("");
    const pageBody = renderLayoutHtml(layout.id, slots);
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
    .webapp-events { margin-top:24px; padding:16px; border-radius:16px; background:rgba(255,255,255,0.9); border:1px solid var(--line); }
    .webapp-events ul { margin:12px 0 0; padding-left:18px; display:grid; gap:8px; }
    .webapp-debug { margin-top:24px; padding:16px; border-radius:16px; background:#1f2933; color:#e6edf3; overflow:auto; font-family: ui-monospace, SFMono-Regular, monospace; font-size:12px; }
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
        <section class="webapp-events"><h2>Node messages</h2><ul>${messageFeed || "<li>No messages yet.</li>"}</ul></section>
    <details class="webapp-debug"><summary>Snapshot</summary><pre>${escapeHtml(escapeJson({ appId, location, route: routeMatch.route, params: routeMatch.params, state: effectiveState, queries }))}</pre></details>
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

                return registration.mapConfig(entry);
            });
    }
    catch {
        return [];
    }
}

function getDefinitionBuckets(appId, definitions) {
    const matchingApp = definitions.find((entry) => entry.type === "ui-app" && entry.id === appId);

    if (!matchingApp) {
        return {
            app: undefined,
            layouts: [],
            slots: [],
            routes: [],
            dialogs: [],
            components: [],
            stores: [],
            queries: [],
            actions: [],
            navigations: []
        };
    }

    const matchingDefinitions = definitions.filter((entry) => entry.type !== "ui-app");

    return {
        app: matchingApp,
        layouts: matchingDefinitions.filter((entry) => entry.type === "ui-layout"),
        slots: matchingDefinitions.filter((entry) => entry.type === "ui-slot"),
        routes: matchingDefinitions.filter((entry) => entry.type === "ui-route"),
        dialogs: matchingDefinitions.filter((entry) => entry.type === "ui-dialog"),
        components: matchingDefinitions.filter((entry) => ["ui-text", "ui-button", "ui-table", "ui-container", "ui-input"].includes(entry.type)),
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

    RED.httpAdmin.get("/resources/node-red-contrib-webapp/lib/editor-common.js", (req, res) => {
        const candidates = [
            path.join(__dirname, "lib", "editor-common.js"),
            path.join(__dirname, "..", "resources", "lib", "editor-common.js"),
            path.join(__dirname, "..", "lib", "editor-common.js")
        ];
        const filePath = candidates.find((candidate) => fs.existsSync(candidate));

        if (!filePath) {
            res.status(404).send("editor-common.js not found");
            return;
        }

        res.set("Cache-Control", "no-store");
        res.type("application/javascript");
        res.send(fs.readFileSync(filePath, "utf8"));
    });

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
            node.status({ fill: "red", shape: "ring", text: "invalid" });
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
    return config.uiId || config.id;
}

function passThroughInputHandler(node, msg, send, done) {
    send(msg);
    if (done) {
        done();
    }
}

const runtimeNodeRegistry = {
    "ui-app": {
        mapConfig: (config) => ({
            type: "ui-app",
            id: config.root || getUiId(config) || "",
            title: config.name || config.title || config.root || getUiId(config) || "App",
            layout: config.layout || "vertical"
        })
    },
    "ui-layout": {
        mapConfig: (config) => ({
            type: "ui-layout",
            id: getUiId(config),
            title: config.title || undefined
        })
    },
    "ui-slot": {
        mapConfig: (config) => ({
            type: "ui-slot",
            id: getUiId(config),
            layoutId: config.layoutId,
            name: config.name,
            title: config.title || undefined,
            order: config.order === "" || config.order === undefined ? 0 : Number(config.order)
        })
    },
    "ui-route": {
        mapConfig: (config) => ({
            type: "ui-route",
            id: getUiId(config),
            path: config.path,
            title: config.title || undefined,
            layoutId: config.layoutId
        })
    },
    "ui-dialog": {
        mapConfig: (config) => ({
            type: "ui-dialog",
            id: getUiId(config),
            title: config.title || undefined,
            layoutId: config.layoutId,
            routeId: config.routeId || undefined,
            modal: config.modal !== false && config.modal !== "false"
        })
    },
    "ui-text": {
        mapConfig: (config) => ({
            type: "ui-text",
            id: getUiId(config),
            mount: config.mount,
            order: toOptionalNumber(config.order),
            value: getBinding(config.value, literalBinding(config.text || "")),
            variant: config.variant || undefined
        })
    },
    "ui-button": {
        mapConfig: (config) => ({
            type: "ui-button",
            id: getUiId(config),
            mount: config.mount,
            order: toOptionalNumber(config.order),
            label: config.label,
            action: config.action,
            disabled: getBinding(config.disabled, config.disabledPath ? stateBinding(config.disabledPath) : undefined)
        }),
        options: {
            inputHandler: passThroughInputHandler
        }
    },
    "ui-table": {
        mapConfig: (config) => ({
            type: "ui-table",
            id: getUiId(config),
            mount: config.mount,
            order: toOptionalNumber(config.order),
            columns: parseList(config.columns),
            rows: getBinding(config.rows, queryBinding(config.rowsPath || "")),
            selectAction: config.selectAction || undefined
        }),
        options: {
            inputHandler: passThroughInputHandler
        }
    },
    "ui-container": {
        mapConfig: (config) => ({
            type: "ui-container",
            id: getUiId(config),
            mount: config.mount,
            order: toOptionalNumber(config.order),
            layoutId: config.layoutId
        }),
        options: {
            inputHandler: passThroughInputHandler
        }
    },
    "ui-input": {
        mapConfig: (config) => ({
            type: "ui-input",
            id: getUiId(config),
            mount: config.mount,
            order: toOptionalNumber(config.order),
            label: config.label,
            value: getBinding(config.value, config.valuePath ? stateBinding(config.valuePath) : undefined),
            storeId: config.storeId || undefined,
            path: config.path || undefined,
            inputType: config.inputType || undefined
        }),
        options: {
            inputHandler: passThroughInputHandler
        }
    },
    "ui-store": {
        mapConfig: (config) => ({
            type: "ui-store",
            id: getUiId(config),
            statePath: config.statePath,
            initialValue: parseJson(config.initialValue)
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

                const currentState = clone(runtimeState.previewState.get(activeAppId) || initializeState([storeDefinition], [], activeAppId));
                const applied = applyStoreOperation(currentState, storeDefinition, operation);

                runtimeState.previewState.set(activeAppId, applied.nextState);
                send({
                    ...msg,
                    ui: {
                        ...(msg.ui && typeof msg.ui === "object" ? msg.ui : {}),
                        store: applied.notification.ui.store
                    }
                });
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
            queryPath: config.queryPath,
            source: config.source || undefined,
            refreshAction: config.refreshAction || undefined
        }),
        options: {
            inputHandler: passThroughInputHandler
        }
    },
    "ui-action": {
        mapConfig: (config) => ({
            type: "ui-action",
            id: getUiId(config),
            actionType: blankToUndefined(config.actionType),
            targetMode: blankToUndefined(config.targetMode),
            target: blankToUndefined(config.target),
            to: blankToUndefined(config.to),
            description: config.description || undefined
        }),
        options: {
            inputHandler: passThroughInputHandler
        }
    },
    "ui-navigation": {
        mapConfig: (config) => ({
            type: "ui-navigation",
            id: getUiId(config),
            to: config.to
        }),
        options: {
            inputHandler: passThroughInputHandler
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
    resetPreview
};

registerWebappNodes.registerNodeType = registerNodeType;

module.exports = registerWebappNodes;
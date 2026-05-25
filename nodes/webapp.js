"use strict";

const fs = require("fs");
const path = require("path");
const { appModelSchema, uiEventMessageSchema, validateUiNodeDefinition } = require("../packages/schema/dist/index.js");

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
    "ui-region",
    "ui-route",
    "ui-dialog",
    "ui-text",
    "ui-button",
    "ui-table",
    "ui-form",
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

function toNumberWithDefault(value, fallback) {
    return value === "" || value === undefined || value === null ? fallback : Number(value);
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

function escapeHtml(input) {
    return String(input)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
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

function createDemoQueryData(appId) {
    if (appId !== "customersApp") {
        return {};
    }

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
    return clone(runtimeState.previewQueries.get(appId) || createDemoQueryData(appId));
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

function buildUiMessage({ appId, componentId, eventName, actionId, location, routeParams, statePatch, payload, dialog, navigation, queries }) {
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

function buildRegionTree(regionDefinitions, layoutId) {
    const regions = regionDefinitions.filter((region) => region.layoutId === layoutId);
    const byParent = new Map();

    regions.forEach((region) => {
        const parentKey = region.parentRegionId || "__root__";
        const siblings = byParent.get(parentKey) || [];
        siblings.push(region);
        byParent.set(parentKey, siblings);
    });

    function build(parentId) {
        return (byParent.get(parentId || "__root__") || [])
            .slice()
            .sort((left, right) => {
                const leftOrder = left.order || 0;
                const rightOrder = right.order || 0;
                return leftOrder - rightOrder || left.name.localeCompare(right.name);
            })
            .map((region) => ({
                name: region.name,
                title: region.title,
                regions: build(region.id)
            }));
    }

    return build(undefined);
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

        return {
            id: component.id,
            kind: "form",
            mount: component.mount,
            order: toOptionalNumber(component.order),
            bind: {
                model: getBinding(component.model, stateBinding(component.modelPath || ""))
            },
            props: { fields: parseList(component.fields) },
            events: [{ event: "submit", action: component.submitAction }]
        };
    });
}

function buildAppModel(appId, definitions) {
    const buckets = getDefinitionBuckets(appId, definitions);

    if (!buckets.app) {
        return undefined;
    }

    const modelCandidate = {
        id: buckets.app.id,
        title: buckets.app.title,
        layouts: buckets.layouts
            .map((layout) => ({
                id: layout.id,
                title: blankToUndefined(layout.title),
                regions: buildRegionTree(buckets.regions, layout.id)
            }))
            .sort((left, right) => left.id.localeCompare(right.id)),
        routes: buckets.routes
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
    return validation.success ? validation.data : undefined;
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

function renderRegionTree(regions, model, context, routeId, layoutId, dialogId) {
    return regions.map((region) => {
        const regionPath = [...context.path, region.name];
        const components = model.components
            .filter((component) => mountMatches(component, regionPath, model, routeId, layoutId, dialogId))
            .sort((left, right) => (left.order || 0) - (right.order || 0) || left.id.localeCompare(right.id))
            .map((component) => renderComponent(component, context.sources, model, routeId, context.location));

        return {
            name: region.name,
            title: region.title,
            components,
            regions: renderRegionTree(region.regions || [], model, { path: regionPath, sources: context.sources, location: context.location }, routeId, layoutId, dialogId)
        };
    });
}

function renderComponent(component, sources, model, routeId, location) {
    const disabled = Boolean(resolveBinding(component.bind && component.bind.disabled, sources));
    const action = component.events && component.events[0] ? component.events[0].action : undefined;
    const navigation = action ? sources.navigations.find((entry) => entry.id === action) : undefined;
    const submitForm = action ? model.components.find((candidate) => candidate.kind === "form" && candidate.events && candidate.events.some((event) => event.action === action)) : undefined;

    if (component.kind === "text") {
        return {
            kind: "text",
            id: component.id,
            text: String(resolveBinding(component.bind.value, sources) || "")
        };
    }

    if (component.kind === "button") {
        const href = action
            ? `/webapp/${encodeURIComponent(model.id)}/action/${encodeURIComponent(action)}?location=${encodeURIComponent(location || "/customers")}&sourceId=${encodeURIComponent(component.id)}&event=click${sources.params.id ? `&id=${encodeURIComponent(sources.params.id)}` : ""}`
            : navigation
                ? `/webapp/${encodeURIComponent(model.id)}${navigation.to.replace(/:id/g, encodeURIComponent(sources.params.id || "c-100"))}`
                : undefined;

        return {
            kind: "button",
            id: component.id,
            label: String(component.props.label || component.id),
            href,
            submitFormId: submitForm ? `webapp-form-${submitForm.id}` : undefined,
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
            location
        };
    }

    return {
        kind: "form",
        id: component.id,
        fields: Array.isArray(component.props.fields) ? component.props.fields : [],
        model: resolveBinding(component.bind.model, sources) || {},
        action,
        appId: model.id,
        location
    };
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

        if (component.submitFormId) {
            return `<button class="webapp-button" type="submit" form="${escapeAttribute(component.submitFormId)}">${label}</button>`;
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

    const formId = `webapp-form-${component.id}`;
    const actionUrl = component.action
        ? `/webapp/${encodeURIComponent(component.appId)}/action/${encodeURIComponent(component.action)}?location=${encodeURIComponent(component.location || "/customers")}&sourceId=${encodeURIComponent(component.id)}&event=submit`
        : undefined;
    const inputs = component.fields.map((field) => `<label>${escapeHtml(field)}<input type="text" name="${escapeAttribute(field)}" value="${escapeAttribute(component.model[field] ?? "")}"></label>`).join("");
    return actionUrl
        ? `<form class="webapp-form" id="${escapeAttribute(formId)}" method="get" action="${escapeAttribute(actionUrl)}">${inputs}</form>`
        : `<form class="webapp-form" id="${escapeAttribute(formId)}">${inputs}</form>`;
}

function applyPreviewAction(RED, appId, actionId, parameters, definitions) {
    const buckets = getDefinitionBuckets(appId, definitions);
    const matchingForm = buckets.components.find((entry) => entry.type === "ui-form" && entry.submitAction === actionId);
    const model = buildAppModel(appId, definitions);

    if (!model) {
        return {
            success: false,
            status: 404,
            body: "Unknown app."
        };
    }

    const location = parameters.location ? String(parameters.location) : "/customers";
    const routeMatch = getRouteMatch(location, model.routes) || { route: { id: "customers", path: "/customers" }, params: {} };
    const currentState = clone(runtimeState.previewState.get(appId) || {});
    let nextState = currentState;
    let nextQueries = getPreviewQueries(appId);
    let redirectLocation = location;
    let dialogId;
    let dialogMessage;
    let navigationMessage;
    let queryMessages = [];
    const componentId = parameters.sourceId ? String(parameters.sourceId) : actionId;
    const eventName = parameters.event ? String(parameters.event) : matchingForm ? "submit" : "click";
    const payload = {};
    const statePatch = {};

    if (actionId === "openCustomerEditor") {
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
    else if (matchingForm) {
        const fieldValues = (matchingForm.fields || []).reduce((result, field) => {
            if (parameters[field] !== undefined) {
                result[field] = String(parameters[field]);
            }

            return result;
        }, {});
        const existingCustomerId = String(getValueAtPath(nextState, "draft.customerId") || "");
        const customerId = existingCustomerId || nextCustomerId(nextQueries.customers?.list || []);
        const persistedCustomer = {
            id: customerId,
            ...fieldValues
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
        nextState = setValueAtPath(nextState, matchingForm.modelPath, fieldValues);
        nextState = setValueAtPath(nextState, "draft.customerId", customerId);
        nextState = setValueAtPath(nextState, "ui.dialogs.customerEditor.open", false);
        statePatch[matchingForm.modelPath] = fieldValues;
        statePatch["draft.customerId"] = customerId;
        statePatch["ui.dialogs.customerEditor.open"] = false;
        redirectLocation = "/customers";
        dialogMessage = { id: "customerEditor", open: false };
        payload.values = fieldValues;
    }
    else if (actionId === "refreshCustomers") {
        queryMessages = buckets.queries
            .filter((query) => query.refreshAction === actionId)
            .map((query) => ({
                id: query.id,
                queryPath: query.queryPath,
                mode: Array.isArray(nextQueries.customers?.list) ? "refresh" : "load"
            }));
        statePatch["ui.queries.customersQuery.loading"] = false;
        statePatch["ui.queries.customersQuery.status"] = "success";
        nextState = setValueAtPath(nextState, "ui.queries.customersQuery.loading", false);
        nextState = setValueAtPath(nextState, "ui.queries.customersQuery.status", "success");
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
        const customerId = parameters.id ? String(parameters.id) : routeMatch.params.id;
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

function renderRegionHtml(region) {
    const title = region.title ? `<h3>${escapeHtml(region.title)}</h3>` : "";
    const components = region.components.map(renderComponentHtml).join("");
    const children = region.regions.map(renderRegionHtml).join("");
    return `<section class="webapp-region"><header><h2>${escapeHtml(region.name)}</h2>${title}</header><div class="webapp-region-body">${components}${children}</div></section>`;
}

function renderAppPage(appId, location, dialogId, definitions) {
    const model = buildAppModel(appId, definitions);

    if (!model) {
        return undefined;
    }

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
    const regions = renderRegionTree(layout.regions, model, { path: [], sources, location }, routeMatch.route.id, layout.id, undefined);
    const dialogs = model.dialogs
        .filter((dialog) => dialog.id === dialogId)
        .map((dialog) => {
            const dialogLayout = getLayout(model, dialog.layoutId);
            return dialogLayout
                ? {
                    title: dialog.title || dialog.id,
                    regions: renderRegionTree(dialogLayout.regions, model, { path: [], sources, location }, routeMatch.route.id, dialogLayout.id, dialog.id)
                }
                : undefined;
        })
        .filter(Boolean);

    const dialogHtml = dialogs.map((dialog) => `<div class="webapp-dialog"><div class="webapp-dialog-card"><div class="webapp-dialog-head"><h2>${escapeHtml(dialog.title)}</h2><a href="/webapp/${encodeURIComponent(appId)}/action/closeCustomerEditor?location=${encodeURIComponent(location)}&sourceId=cancelCustomerButton&event=click" class="webapp-link">Close</a></div>${dialog.regions.map(renderRegionHtml).join("")}</div></div>`).join("");
    const pageBody = regions.map(renderRegionHtml).join("");
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
    .webapp-region { border:1px solid var(--line); background:rgba(255,255,255,0.78); backdrop-filter: blur(6px); border-radius:18px; padding:16px; box-shadow:0 12px 30px rgba(79,70,50,0.08); }
    .webapp-region > header { margin-bottom:12px; }
    .webapp-region > header h2 { margin:0; font-size:1rem; text-transform:uppercase; letter-spacing:0.08em; color:var(--muted); }
    .webapp-region-body { display:grid; gap:12px; }
    .webapp-text { font-size:1.05rem; }
    .webapp-button { display:inline-flex; align-items:center; justify-content:center; padding:10px 14px; border-radius:999px; border:1px solid rgba(0,0,0,0.08); background:linear-gradient(135deg, var(--accent), #155e75); color:white; font-weight:600; }
    button.webapp-button[disabled] { background:#cbd5e1; color:#475569; }
    .webapp-table { width:100%; border-collapse:collapse; background:var(--panel); border-radius:12px; overflow:hidden; }
    .webapp-table th, .webapp-table td { padding:10px 12px; border-bottom:1px solid var(--line); text-align:left; }
    .webapp-form { display:grid; gap:10px; }
    .webapp-form label { display:grid; gap:6px; color:var(--muted); font-size:0.95rem; }
    .webapp-form input { padding:10px 12px; border-radius:10px; border:1px solid var(--line); background:white; }
    .webapp-dialog { position:fixed; inset:0; background:rgba(20, 26, 31, 0.38); display:flex; align-items:center; justify-content:center; padding:24px; }
    .webapp-dialog-card { width:min(720px, 100%); background:var(--panel); border-radius:22px; padding:20px; box-shadow:0 25px 70px rgba(0,0,0,0.18); }
    .webapp-dialog-head { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:12px; }
    .webapp-link { color:var(--accent-2); font-weight:700; }
    .webapp-events { margin-top:24px; padding:16px; border-radius:16px; background:rgba(255,255,255,0.9); border:1px solid var(--line); }
    .webapp-events ul { margin:12px 0 0; padding-left:18px; display:grid; gap:8px; }
    .webapp-debug { margin-top:24px; padding:16px; border-radius:16px; background:#1f2933; color:#e6edf3; overflow:auto; font-family: ui-monospace, SFMono-Regular, monospace; font-size:12px; }
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
        return Array.isArray(parsed) ? parsed.filter((entry) => entry && WEBAPP_NODE_TYPES.has(entry.type)) : [];
    }
    catch {
        return [];
    }
}

function getDefinitionBuckets(appId, definitions) {
    const matchingDefinitions = definitions.filter((entry) => entry.appId === appId || entry.type === "ui-app" && entry.id === appId);

    return {
        app: matchingDefinitions.find((entry) => entry.type === "ui-app"),
        layouts: matchingDefinitions.filter((entry) => entry.type === "ui-layout"),
        regions: matchingDefinitions.filter((entry) => entry.type === "ui-region"),
        routes: matchingDefinitions.filter((entry) => entry.type === "ui-route"),
        dialogs: matchingDefinitions.filter((entry) => entry.type === "ui-dialog"),
        components: matchingDefinitions.filter((entry) => ["ui-text", "ui-button", "ui-table", "ui-form"].includes(entry.type)),
        stores: matchingDefinitions.filter((entry) => entry.type === "ui-store"),
        queries: matchingDefinitions.filter((entry) => entry.type === "ui-query"),
        actions: matchingDefinitions.filter((entry) => entry.type === "ui-action"),
        navigations: matchingDefinitions.filter((entry) => entry.type === "ui-navigation")
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
        const location = req.query.location ? String(req.query.location) : "/customers";
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
        runtimeState.definitions.set(node.id, {
            nodeId: node.id,
            appId: validDefinition.type === "ui-app" ? validDefinition.id : validDefinition.appId,
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

module.exports = function registerWebappNodes(RED) {
    registerEndpoints(RED);

    createNodeConstructor(RED, "ui-app", (config) => ({
        type: "ui-app",
        id: config.id,
        title: config.title
    }));

    createNodeConstructor(RED, "ui-layout", (config) => ({
        type: "ui-layout",
        appId: config.appId,
        id: config.id,
        title: config.title || undefined
    }));

    createNodeConstructor(RED, "ui-region", (config) => ({
        type: "ui-region",
        appId: config.appId,
        id: config.id,
        layoutId: config.layoutId,
        name: config.name,
        parentRegionId: config.parentRegionId || undefined,
        title: config.title || undefined,
        order: config.order === "" || config.order === undefined ? 0 : Number(config.order)
    }));

    createNodeConstructor(RED, "ui-route", (config) => ({
        type: "ui-route",
        appId: config.appId,
        id: config.id,
        path: config.path,
        title: config.title || undefined,
        layoutId: config.layoutId
    }));

    createNodeConstructor(RED, "ui-dialog", (config) => ({
        type: "ui-dialog",
        appId: config.appId,
        id: config.id,
        title: config.title || undefined,
        layoutId: config.layoutId,
        routeId: config.routeId || undefined,
        modal: config.modal !== false && config.modal !== "false"
    }));

    createNodeConstructor(RED, "ui-text", (config) => ({
        type: "ui-text",
        appId: config.appId,
        id: config.id,
        mount: config.mount,
        order: toOptionalNumber(config.order),
        value: getBinding(config.value, literalBinding(config.text || "")),
        variant: config.variant || undefined
    }));

    createNodeConstructor(RED, "ui-button", (config) => ({
        type: "ui-button",
        appId: config.appId,
        id: config.id,
        mount: config.mount,
        order: toOptionalNumber(config.order),
        label: config.label,
        action: config.action,
        disabled: getBinding(config.disabled, config.disabledPath ? stateBinding(config.disabledPath) : undefined)
    }), {
        inputHandler(node, msg, send, done) {
            send(msg);
            if (done) {
                done();
            }
        }
    });

    createNodeConstructor(RED, "ui-table", (config) => ({
        type: "ui-table",
        appId: config.appId,
        id: config.id,
        mount: config.mount,
        order: toOptionalNumber(config.order),
        columns: parseList(config.columns),
        rows: getBinding(config.rows, queryBinding(config.rowsPath || "")),
        selectAction: config.selectAction || undefined
    }), {
        inputHandler(node, msg, send, done) {
            send(msg);
            if (done) {
                done();
            }
        }
    });

    createNodeConstructor(RED, "ui-form", (config) => ({
        type: "ui-form",
        appId: config.appId,
        id: config.id,
        mount: config.mount,
        order: toOptionalNumber(config.order),
        fields: parseList(config.fields),
        model: getBinding(config.model, stateBinding(config.modelPath || "")),
        submitAction: config.submitAction
    }), {
        inputHandler(node, msg, send, done) {
            send(msg);
            if (done) {
                done();
            }
        }
    });

    createNodeConstructor(RED, "ui-store", (config) => ({
        type: "ui-store",
        appId: config.appId,
        id: config.id,
        statePath: config.statePath,
        initialValue: parseJson(config.initialValue)
    }), {
        inputHandler(node, msg, send, done) {
            send(msg);
            if (done) {
                done();
            }
        }
    });

    createNodeConstructor(RED, "ui-query", (config) => ({
        type: "ui-query",
        appId: config.appId,
        id: config.id,
        queryPath: config.queryPath,
        source: config.source || undefined,
        refreshAction: config.refreshAction || undefined
    }), {
        inputHandler(node, msg, send, done) {
            send(msg);
            if (done) {
                done();
            }
        }
    });

    createNodeConstructor(RED, "ui-action", (config) => ({
        type: "ui-action",
        appId: config.appId,
        id: config.id,
        description: config.description || undefined
    }), {
        inputHandler(node, msg, send, done) {
            send(msg);
            if (done) {
                done();
            }
        }
    });

    createNodeConstructor(RED, "ui-navigation", (config) => ({
        type: "ui-navigation",
        appId: config.appId,
        id: config.id,
        to: config.to
    }), {
        inputHandler(node, msg, send, done) {
            send(msg);
            if (done) {
                done();
            }
        }
    });
};
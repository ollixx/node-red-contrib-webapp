/**
 * Webapp thin client runtime (P22).
 *
 * Contract — see docs/nodes/concepts/messages.md, section "Snapshot transport":
 *
 *   IN  (browser → runtime)  POST /webapp/:appId/event
 *     { actionId, sourceId, event, location, params }
 *     - actionId : the ui-action / preview action id to dispatch (required)
 *     - sourceId : the component id that originated the event (msg.ui.componentId)
 *     - event    : the msg.ui.event name ("click" | "submit" | "select" | "change")
 *     - location : the current route location
 *     - params   : extra event params (form field values, rowId, etc.)
 *
 *   OUT (runtime → browser)
 *     { message, location, dialog, snapshot }
 *     - message  : the emitted msg.ui event message (messages.md shape)
 *     - location : the resulting route location (may differ after navigation)
 *     - dialog   : id of an open dialog, or undefined
 *     - snapshot : the new RenderSnapshot to render
 *
 * The client holds the current snapshot, renders it as Custom-Element-free HTML
 * (matching the server fallback markup), and on a UI event POSTs and re-renders.
 * Re-render is a keyed morph: only changed nodes are replaced so input focus and
 * scroll position survive list/state updates.
 */
(function () {
    "use strict";

    const root = document.getElementById("webapp-client-root");

    if (!root) {
        return;
    }

    const appId = root.getAttribute("data-webapp-app-id");
    let location = root.getAttribute("data-webapp-location") || "/";
    let dialogId = root.getAttribute("data-webapp-dialog") || undefined;
    let currentSnapshot = null;

    function base() {
        return "/webapp/" + encodeURIComponent(appId);
    }

    function escapeHtml(input) {
        return String(input === undefined || input === null ? "" : input)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function sanitizeClassSuffix(value) {
        return String(value || "custom").replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
    }

    function layoutVariant(layoutId) {
        if (layoutId === "app") return "app";
        if (layoutId === "horizontal") return "horizontal";
        if (layoutId === "grid") return "grid";
        if (layoutId === "absolute") return "absolute";
        if (layoutId === "vertical") return "vertical";
        return "custom";
    }

    function regionContainsInput(region) {
        return region.components.some(function (component) {
            if (component.kind === "input") return true;
            if (component.kind === "container") return region.regions ? false : false;
            return false;
        }) || region.components.some(function (component) {
            return component.kind === "container" && component.regions.some(regionContainsInput);
        });
    }

    function renderComponent(component, layoutId, ctx) {
        if (component.kind === "text") {
            return wrap(component, '<div class="webapp-text">' + escapeHtml(component.text) + "</div>");
        }

        if (component.kind === "button") {
            const label = escapeHtml(component.label);
            const action = component.events && component.events[0] ? component.events[0].action : undefined;
            const inForm = Boolean(ctx.formId);

            if (component.disabled || !action) {
                return wrap(component, '<button class="webapp-button" disabled>' + label + "</button>");
            }

            const attrs = [
                'class="webapp-button"',
                'type="button"',
                'data-webapp-action="' + escapeHtml(action) + '"',
                'data-webapp-source="' + escapeHtml(component.id) + '"',
                'data-webapp-event="' + (inForm ? "submit" : "click") + '"'
            ];

            if (inForm) {
                attrs.push('data-webapp-form="' + escapeHtml(ctx.formId) + '"');
            }

            return wrap(component, "<button " + attrs.join(" ") + ">" + label + "</button>");
        }

        if (component.kind === "table") {
            const columns = Array.isArray(component.props.columns) ? component.props.columns : [];
            const rows = Array.isArray(component.rows) ? component.rows : [];
            const selectEvent = (component.events || []).find(function (event) { return event.event === "select"; });
            const selectAction = component.props.selectAction || (selectEvent && selectEvent.action) || undefined;
            const header = columns.map(function (col) {
                return "<th>" + escapeHtml(col.label || col.key || col) + "</th>";
            }).join("");
            const body = rows.length === 0
                ? '<tr><td colspan="' + Math.max(columns.length, 1) + '">No rows loaded.</td></tr>'
                : rows.map(function (row) {
                    const rowId = row.id !== undefined ? String(row.id) : "";
                    const cells = columns.map(function (col, index) {
                        const key = col.key || col;
                        const value = escapeHtml(row[key] === undefined || row[key] === null ? "" : row[key]);

                        if (index === 0 && selectAction && rowId) {
                            return '<td><a class="webapp-link" href="#" data-webapp-action="' + escapeHtml(selectAction)
                                + '" data-webapp-source="' + escapeHtml(component.id)
                                + '" data-webapp-event="select" data-webapp-rowid="' + escapeHtml(rowId) + '">' + value + "</a></td>";
                        }

                        return "<td>" + value + "</td>";
                    }).join("");
                    return '<tr data-webapp-row="' + escapeHtml(rowId) + '">' + cells + "</tr>";
                }).join("");
            return wrap(component, '<table class="webapp-table"><thead><tr>' + header + "</tr></thead><tbody>" + body + "</tbody></table>");
        }

        if (component.kind === "input") {
            const label = escapeHtml(component.props.label || component.id);
            const name = escapeHtml(component.props.path || component.id);
            const inputType = escapeHtml(component.props.inputType || "text");
            const value = component.value === undefined || component.value === null ? "" : escapeHtml(component.value);
            return wrap(component, '<label class="webapp-field">' + label + '<input type="' + inputType
                + '" name="' + name + '" value="' + value + '"></label>');
        }

        if (component.kind === "container") {
            const childLayoutId = component.layoutId;
            const hasInputs = component.regions.some(regionContainsInput);
            const formId = hasInputs ? "webapp-form-" + component.id : undefined;
            const childCtx = { formId: formId, params: ctx.params };
            const content = renderLayout(childLayoutId, component.regions, childCtx);
            const inner = formId
                ? '<form class="webapp-form" id="' + escapeHtml(formId) + '" data-webapp-form-id="' + escapeHtml(formId) + '">' + content + "</form>"
                : '<div class="webapp-container">' + content + "</div>";
            return wrap(component, inner);
        }

        return "";
    }

    function wrap(component, inner) {
        return '<div class="webapp-item" data-webapp-component="' + escapeHtml(component.id)
            + '" data-webapp-kind="' + escapeHtml(component.kind) + '">' + inner + "</div>";
    }

    function renderRegion(region, layoutId) {
        const slotClass = sanitizeClassSuffix(region.name);
        const ctx = { formId: undefined, params: currentSnapshot ? currentSnapshot.params : {} };
        const components = region.components.map(function (component) {
            return renderComponent(component, layoutId, ctx);
        }).join("");
        const title = region.title ? "<header><h2>" + escapeHtml(region.title) + "</h2></header>" : "";
        return '<section class="webapp-slot webapp-slot--' + slotClass + '">' + title
            + '<div class="webapp-slot-body webapp-slot-body--' + layoutVariant(layoutId) + '">' + components + "</div></section>";
    }

    function renderLayout(layoutId, regions, ctx) {
        const ctxParams = ctx && ctx.params ? ctx.params : (currentSnapshot ? currentSnapshot.params : {});
        return regions.map(function (region) {
            const slotClass = sanitizeClassSuffix(region.name);
            const inner = region.components.map(function (component) {
                return renderComponent(component, layoutId, { formId: ctx ? ctx.formId : undefined, params: ctxParams });
            }).join("");
            const title = region.title ? "<header><h2>" + escapeHtml(region.title) + "</h2></header>" : "";
            return '<section class="webapp-slot webapp-slot--' + slotClass + '">' + title
                + '<div class="webapp-slot-body webapp-slot-body--' + layoutVariant(layoutId) + '">' + inner + "</div></section>";
        }).join("");
    }

    function renderSnapshot(snapshot) {
        const grid = renderLayout(snapshot.layout.id, snapshot.regions, { formId: undefined, params: snapshot.params });
        const dialogs = (snapshot.dialogs || []).map(function (dialog) {
            return '<div class="webapp-dialog"><div class="webapp-dialog-card"><div class="webapp-dialog-head"><h2>'
                + escapeHtml(dialog.title || dialog.id) + "</h2></div>"
                + renderLayout(dialog.layoutId, dialog.regions, { formId: undefined, params: snapshot.params })
                + "</div></div>";
        }).join("");
        return { grid: grid, dialogs: dialogs };
    }

    // Keyed morph: replace only the children whose markup changed so focus/scroll
    // in unchanged nodes (e.g. a search input, the table's scroll container) survive.
    function morph(target, html) {
        const next = document.createElement("div");
        next.innerHTML = html;

        const oldNodes = Array.prototype.slice.call(target.children);
        const newNodes = Array.prototype.slice.call(next.children);

        for (let i = 0; i < newNodes.length; i++) {
            const newNode = newNodes[i];
            const oldNode = oldNodes[i];

            if (!oldNode) {
                target.appendChild(newNode.cloneNode(true));
                continue;
            }

            if (oldNode.outerHTML !== newNode.outerHTML) {
                target.replaceChild(newNode.cloneNode(true), oldNode);
            }
        }

        for (let j = oldNodes.length - 1; j >= newNodes.length; j--) {
            target.removeChild(oldNodes[j]);
        }
    }

    function applySnapshot(snapshot) {
        currentSnapshot = snapshot;
        location = snapshot.location;
        const rendered = renderSnapshot(snapshot);

        const gridEl = root.querySelector(".webapp-grid");

        if (gridEl) {
            morph(gridEl, rendered.grid);
        }

        // Dialogs live as siblings of .webapp-grid inside root. Replace the dialog set.
        const existingDialogs = root.querySelectorAll(".webapp-dialog");
        existingDialogs.forEach(function (node) { node.remove(); });

        if (rendered.dialogs) {
            const holder = document.createElement("div");
            holder.innerHTML = rendered.dialogs;
            Array.prototype.slice.call(holder.children).forEach(function (node) {
                root.appendChild(node);
            });
        }
    }

    function collectFormValues(formId) {
        const values = {};

        if (!formId) {
            return values;
        }

        const form = root.querySelector('[data-webapp-form-id="' + formId + '"]');

        if (!form) {
            return values;
        }

        form.querySelectorAll("input, textarea, select").forEach(function (input) {
            if (input.name) {
                values[input.name] = input.value;
            }
        });

        return values;
    }

    async function dispatch(detail) {
        const params = Object.assign({}, detail.params || {});

        if (detail.formId) {
            Object.assign(params, collectFormValues(detail.formId));
        }

        const response = await fetch(base() + "/event", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                actionId: detail.action,
                sourceId: detail.source,
                event: detail.event || "click",
                location: location,
                params: params
            })
        });

        if (!response.ok) {
            return;
        }

        const result = await response.json();

        if (result && result.snapshot) {
            applySnapshot(result.snapshot);
        }
    }

    root.addEventListener("click", function (eventObject) {
        const trigger = eventObject.target.closest("[data-webapp-action]");

        if (!trigger || !root.contains(trigger)) {
            return;
        }

        eventObject.preventDefault();

        const params = {};

        if (trigger.hasAttribute("data-webapp-rowid")) {
            params.rowId = trigger.getAttribute("data-webapp-rowid");
        }

        dispatch({
            action: trigger.getAttribute("data-webapp-action"),
            source: trigger.getAttribute("data-webapp-source"),
            event: trigger.getAttribute("data-webapp-event") || "click",
            formId: trigger.getAttribute("data-webapp-form"),
            params: params
        });
    });

    // Initial hydration: pull the canonical snapshot and take over rendering.
    async function hydrate() {
        const query = "?location=" + encodeURIComponent(location) + (dialogId ? "&dialog=" + encodeURIComponent(dialogId) : "");

        try {
            const response = await fetch(base() + "/snapshot" + query);

            if (!response.ok) {
                return;
            }

            const result = await response.json();

            if (result && result.snapshot) {
                applySnapshot(result.snapshot);
            }
        }
        catch (error) {
            // Leave the server-rendered fallback in place on any failure.
        }
    }

    hydrate();
})();

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
 * The client holds the current snapshot and renders it through the SHARED
 * serializer (resources/lib/webapp-serializer.js, window.WebappSerializer) — the
 * exact same module the server uses — so the markup is byte-identical Shoelace
 * (sl-button/sl-input/…) and a hydrate / re-render never downgrades it to native
 * HTML (the P26 fix). On a UI event it POSTs to /event and re-renders. Re-render
 * is a keyed morph: only changed nodes are replaced so input focus and scroll
 * position survive list/state updates.
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

    // P26: render through the shared serializer (window.WebappSerializer) so the
    // markup the client morphs in is byte-identical to what the server emitted.
    // No local renderer remains — that divergence is what previously downgraded
    // the page from sl-* elements to native HTML on hydrate().
    const serializer = root.ownerDocument.defaultView.WebappSerializer
        || (typeof window !== "undefined" ? window.WebappSerializer : undefined);

    function base() {
        return "/webapp/" + encodeURIComponent(appId);
    }

    function renderSnapshot(snapshot) {
        const ctx = { appId: appId, location: snapshot.location || location, params: snapshot.params, formId: undefined };
        const grid = serializer.renderLayoutHtml(snapshot.layout.id, snapshot.regions, ctx);
        // Match the server's dialog markup exactly (incl. the Close affordance);
        // de-hardcoding the closeAction is P27.
        const dialogs = (snapshot.dialogs || []).map(function (dialog) {
            const withClose = Object.assign({}, dialog, { closeAction: "closeCustomerEditor", closeSource: "cancelCustomerButton" });
            return serializer.renderDialogHtml(withClose, ctx);
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

        // Read both native controls and Shoelace custom elements (sl-input et al.
        // expose `name`/`value`/`checked` on the host). Server and client emit the
        // same sl-* markup now (P26), so the values live on the custom elements.
        const selector = "input, textarea, select, sl-input, sl-textarea, sl-select, sl-checkbox, sl-switch, sl-radio-group, sl-range";

        form.querySelectorAll(selector).forEach(function (field) {
            if (!field.name) {
                return;
            }

            const tag = field.tagName.toLowerCase();

            if (tag === "sl-checkbox" || tag === "sl-switch" || (tag === "input" && field.type === "checkbox")) {
                values[field.name] = field.checked;
            }
            else {
                values[field.name] = field.value;
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

    // Test hook (P26): expose applySnapshot so a jsdom test can drive a
    // re-render / morph and assert no element-kind swap. No-op in production
    // unless a test sets window.__webappClientTestHooks beforehand.
    if (root.ownerDocument.defaultView && root.ownerDocument.defaultView.__webappClientTestHooks) {
        root.ownerDocument.defaultView.__webappClientTestHooks.applySnapshot = applySnapshot;
    }

    hydrate();
})();

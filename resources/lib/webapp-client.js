/**
 * Webapp thin client runtime (P22, live transport P31).
 *
 * P31 — live Server→Client push (SSE, see docs/adr/0003):
 *   The client opens an EventSource at GET /webapp/:appId/stream?clientId&location.
 *   The runtime pushes two named events:
 *     - `snapshot` : a fresh RenderSnapshot when a flow message updated a ui-store
 *                    (or any live node state). The client re-renders via the keyed
 *                    morph. No client POST is involved — the flow drove the update.
 *     - `command`  : an interaction command from a ui-action in the flow
 *                    (navigate / openDialog / hide …). Interaction state only.
 *   clientId targeting honours the P15 multi-user model: a push addressed to one
 *   client never reaches another. On (re)connect the server re-pushes the snapshot.
 *
 * Contract — see docs/nodes/concepts/events.md (Client → Server events):
 *
 *   IN  (browser → runtime)  POST /webapp/:appId/event
 *     { clientId, event, sourceId, location, params }
 *     - clientId : id of this browser/tab (so the flow can target it back)
 *     - event    : the event TYPE that happened ("click" | "submit" | "change" |
 *                  "rowSelect" | "rowAction" | ...). The browser reports WHAT
 *                  HAPPENED — it never names or runs an action (P30).
 *     - sourceId : the node id of the originating UI node (msg.ui.sourceId)
 *     - location : the current route location
 *     - params   : extra event params (form field values, rowId, etc.)
 *
 *   The runtime emits msg.ui on the originating node's OUTPUT port into the wired
 *   flow and takes no domain action. There is no automatic event→action link.
 *
 *   OUT (runtime → browser)
 *     { message, location, snapshot }
 *     - message  : the emitted msg.ui event message (events.md shape)
 *     - location : the current route location
 *     - snapshot : the current RenderSnapshot (a live push of flow-driven updates
 *                  is P31; for now this is an unchanged read-only re-render)
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

    // P30: a per-tab client id so the flow can address actions back to this
    // browser (events.md / actions.md clientId targeting; the live channel is P31).
    const clientId = root.getAttribute("data-webapp-client-id")
        || ("client-" + Math.random().toString(36).slice(2) + Date.now().toString(36));

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

        // P30: report WHAT HAPPENED. We send the originating node id (sourceId)
        // and the event type — never an actionId to execute.
        //
        // P31: we deliberately IGNORE the /event response snapshot. Re-renders now
        // arrive over the live SSE channel as the flow reacts (a ui-store update or
        // a ui-action command). Applying the response snapshot here would clobber
        // that live push with the stale pre-reaction state (a race), so the event
        // POST is now fire-and-report only — the stream is the single source of
        // re-renders.
        await fetch(base() + "/event", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                clientId: clientId,
                sourceId: detail.source,
                event: detail.event || "click",
                location: location,
                params: params
            })
        }).catch(function () {
            // The event report failed; nothing to apply. The next user action or
            // stream push will reconcile the view.
        });
    }

    // Click/submit/rowSelect/rowAction triggers (buttons, table row links).
    const CLICK_EVENTS = ["click", "submit", "rowSelect", "rowAction"];

    root.addEventListener("click", function (eventObject) {
        // P30: a trigger is any node that reports a click-class event
        // (data-webapp-source + a click-class data-webapp-event). An action
        // reference is no longer required — the browser reports WHAT HAPPENED;
        // the flow decides what (if anything) happens.
        const trigger = eventObject.target.closest("[data-webapp-source]");

        if (!trigger || !root.contains(trigger)) {
            return;
        }

        const event = trigger.getAttribute("data-webapp-event") || "click";

        // P38: pagination buttons carry data-webapp-page — dispatch as a `change`
        // event with params.page so the flow receives the documented shape.
        if (trigger.hasAttribute("data-webapp-page")) {
            eventObject.preventDefault();
            const page = Number(trigger.getAttribute("data-webapp-page"));
            dispatch({
                source: trigger.getAttribute("data-webapp-source"),
                event: "change",
                params: { page: page }
            });
            return;
        }

        // P38: stepper step buttons carry data-webapp-step — dispatch as a `change`
        // event with params.value (step index) so the flow receives the documented shape.
        if (trigger.hasAttribute("data-webapp-step")) {
            eventObject.preventDefault();
            const step = Number(trigger.getAttribute("data-webapp-step"));
            dispatch({
                source: trigger.getAttribute("data-webapp-source"),
                event: "change",
                params: { value: step }
            });
            return;
        }

        // P45: list items carry data-webapp-item — dispatch as an `itemClick`
        // event with params.value = item id so the flow receives the documented shape.
        if (trigger.hasAttribute("data-webapp-item")) {
            eventObject.preventDefault();
            const itemId = trigger.getAttribute("data-webapp-item");
            dispatch({
                source: trigger.getAttribute("data-webapp-source"),
                event: "itemClick",
                params: { value: itemId }
            });
            return;
        }

        // Value controls report `change`, not click — leave those to the change
        // listener so a click inside an input does not fire a spurious event.
        if (CLICK_EVENTS.indexOf(event) === -1) {
            return;
        }

        eventObject.preventDefault();

        const params = {};

        if (trigger.hasAttribute("data-webapp-rowid")) {
            params.rowId = trigger.getAttribute("data-webapp-rowid");
        }

        dispatch({
            source: trigger.getAttribute("data-webapp-source"),
            event: event,
            formId: trigger.getAttribute("data-webapp-form"),
            params: params
        });
    });

    // P30/P38: value-control change → a `change` event on the originating node.
    // Param key depends on the control kind:
    //   sl-checkbox / sl-switch  → { checked: bool }
    //   all others               → { value: string|number }
    //
    // We listen for BOTH "change" (native re-dispatch from host, works for
    // sl-input/sl-select/etc.) AND "sl-change" (Shoelace CustomEvent, the only
    // event that reliably crosses the shadow boundary for sl-checkbox/sl-switch).
    // The handler is identical; deduplication is not needed because Shoelace
    // fires either one or the other depending on the component version.
    function handleChangeEvent(eventObject) {
        const wrapper = eventObject.target.closest("[data-webapp-source][data-webapp-event=\"change\"]");

        if (!wrapper || !root.contains(wrapper)) {
            return;
        }

        const field = eventObject.target;
        const tag = field.tagName ? field.tagName.toLowerCase() : "";
        const isToggle = tag === "sl-checkbox" || tag === "sl-switch" || (tag === "input" && field.type === "checkbox");
        const params = isToggle
            ? { checked: Boolean(field.checked) }
            : { value: field.value };

        dispatch({
            source: wrapper.getAttribute("data-webapp-source"),
            event: "change",
            params: params
        });
    }

    root.addEventListener("change", handleChangeEvent);
    root.addEventListener("sl-change", handleChangeEvent);

    // P38: tabs — sl-tab-group fires `sl-tab-show` (Shoelace custom event) when a
    // tab is activated. Find the closest [data-webapp-event="sl-tab-show"] ancestor
    // and dispatch a `change` event with params.value = the newly-active tab id.
    root.addEventListener("sl-tab-show", function (eventObject) {
        const tabGroup = eventObject.target.closest("[data-webapp-source][data-webapp-event=\"sl-tab-show\"]");

        if (!tabGroup || !root.contains(tabGroup)) {
            return;
        }

        const detail = eventObject.detail;
        const tabName = detail && detail.name ? String(detail.name) : "";

        dispatch({
            source: tabGroup.getAttribute("data-webapp-source"),
            event: "change",
            params: { value: tabName }
        });
    });

    // P37: set to true after initial hydration; redeploy reloads are ignored
    // until the page has fully settled so the SSE connect race does not cause
    // a reload loop on fresh page load.
    let hydrated = false;

    // Initial hydration: pull the canonical snapshot and take over rendering.
    async function hydrate() {
        const query = "?location=" + encodeURIComponent(location) + (dialogId ? "&dialog=" + encodeURIComponent(dialogId) : "");

        try {
            const response = await fetch(base() + "/snapshot" + query);

            if (!response.ok) {
                hydrated = true;
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
        hydrated = true;
    }

    // P31: apply an interaction command pushed by a ui-action in the flow. These
    // change INTERACTION state only (actions.md) — navigate / openDialog / show /
    // hide — never business data. After a navigate, the client follows the route
    // (the server has already updated this client's stream location, so the next
    // pushed snapshot renders the new page).
    function applyCommand(command) {
        if (!command || !command.type) {
            return;
        }

        switch (command.type) {
            case "navigate":
                if (command.to) {
                    location = String(command.to);
                    window.location.assign(base() + "/" + String(command.to).replace(/^\//, ""));
                }
                break;
            case "openDialog":
                if (command.target) {
                    dialogId = String(command.target);
                    if (currentSnapshot) {
                        applySnapshot(currentSnapshot);
                    }
                }
                break;
            case "closeDialog":
            case "hide":
                dialogId = undefined;
                if (currentSnapshot) {
                    applySnapshot(currentSnapshot);
                }
                break;
            default:
                // show / enable / disable / focus … are honoured through the next
                // snapshot push; no standalone client mutation needed here.
                break;
        }
    }

    // P31: subscribe to the live Server→Client SSE stream. The flow pushes
    // `snapshot` events (a ui-store update re-renders) and `command` events (a
    // ui-action interaction). The native EventSource auto-reconnects; on every
    // (re)connect the server immediately re-pushes the current snapshot.
    function subscribe() {
        if (typeof EventSource === "undefined") {
            return;
        }

        // Include the current dialogId so the server's initial snapshot push matches
        // the server-rendered page (prevents SSE hydration from closing a dialog
        // that was opened via the ?dialog=<id> URL param on initial load).
        const streamUrl = base() + "/stream?clientId=" + encodeURIComponent(clientId)
            + "&location=" + encodeURIComponent(location)
            + (dialogId ? "&dialog=" + encodeURIComponent(dialogId) : "");

        const source = new EventSource(streamUrl);

        source.addEventListener("snapshot", function (messageEvent) {
            try {
                const payload = JSON.parse(messageEvent.data);
                if (payload && payload.snapshot) {
                    applySnapshot(payload.snapshot);
                }
            }
            catch (error) {
                // Ignore a malformed frame; the next push corrects the view.
            }
        });

        source.addEventListener("command", function (messageEvent) {
            try {
                const payload = JSON.parse(messageEvent.data);
                if (payload && payload.command) {
                    applyCommand(payload.command);
                }
            }
            catch (error) {
                // Ignore a malformed frame.
            }
        });

        // P45: ui-toast — display a transient notification pushed by the flow.
        // The toast is appended to the document body (outside the app root) and
        // removed after `duration` milliseconds. Uses sl-alert when Shoelace is
        // available, otherwise falls back to a plain <div>.
        source.addEventListener("toast", function (messageEvent) {
            try {
                const payload = JSON.parse(messageEvent.data);
                if (!payload || !payload.toast) {
                    return;
                }
                const toast = payload.toast;
                const duration = typeof toast.duration === "number" ? toast.duration : 3000;
                const severity = String(toast.severity || "info");
                const message = String(toast.message || "");
                const position = String(toast.position || "top-right");

                const el = document.createElement("sl-alert");
                el.setAttribute("variant", severity);
                el.setAttribute("open", "");
                el.setAttribute("closable", "");
                el.className = "webapp-toast webapp-toast--" + position;
                el.style.cssText = "position:fixed;z-index:9999;max-width:320px;"
                    + (position.includes("bottom") ? "bottom:1rem;" : "top:1rem;")
                    + (position.includes("left") ? "left:1rem;" : "right:1rem;");
                el.textContent = message;

                document.body.appendChild(el);

                if (duration > 0) {
                    setTimeout(function () {
                        el.remove();
                    }, duration);
                }
            }
            catch (error) {
                // Ignore a malformed toast frame.
            }
        });

        // P37: reload the page when the server signals a flow redeploy so the
        // browser always shows the current flow state without a manual refresh.
        // Guard: only reload once the initial hydration is done AND the SSE
        // connection has been open long enough that the triggering deploy
        // pre-dates this page load. This prevents a spurious reload when the
        // browser connects to SSE shortly after a deploy fires flows:started.
        var subscribeTime = Date.now();
        source.addEventListener("redeploy", function () {
            if (hydrated && (Date.now() - subscribeTime) > 1000) {
                window.location.reload();
            }
        });
    }

    // Test hook (P26): expose applySnapshot so a jsdom test can drive a
    // re-render / morph and assert no element-kind swap. No-op in production
    // unless a test sets window.__webappClientTestHooks beforehand.
    if (root.ownerDocument.defaultView && root.ownerDocument.defaultView.__webappClientTestHooks) {
        root.ownerDocument.defaultView.__webappClientTestHooks.applySnapshot = applySnapshot;
        root.ownerDocument.defaultView.__webappClientTestHooks.applyCommand = applyCommand;
    }

    hydrate();
    subscribe();
})();

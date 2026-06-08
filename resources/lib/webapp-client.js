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

    // P53: per-client interaction-state overlay (ADR 0005). A ui-action verb
    // (show/hide/enable/disable/open/close) mutates this overlay, and the overlay
    // is RE-APPLIED after every snapshot render so a flow-driven snapshot push
    // (e.g. a ui-store update) does not wipe a prior interaction command. The
    // overlay is INTERACTION state only — never business data, never sent to the
    // server (ADR 0003): it lives in this tab and is re-stamped on the freshly
    // rendered markup.
    //   visibility:  nodeId -> true (hidden)
    //   disabled:    nodeId -> true (disabled)
    //   open:        "<target>" or "<target>#<part>" -> true (disclosed)
    //   selected:    "<target>" -> "<part>" (active sub-part of a single-active
    //                set: tabs / stepper / menu — survives a snapshot re-render)
    const interaction = {
        hidden: Object.create(null),
        disabled: Object.create(null),
        open: Object.create(null),
        selected: Object.create(null)
    };

    // P30: a per-tab client id so the flow can address actions back to this
    // browser (events.md / actions.md clientId targeting; the live channel is P31).
    //
    // P87: the clientId is persisted in localStorage under
    // "webapp:clientId:<appId>" so a page reload or reconnect reuses the same
    // id. Per-client state stored on the server (clientStateMap, P15) therefore
    // survives browser reloads. The key is scoped by appId so multiple apps on
    // the same origin do not collide.
    // If localStorage is unavailable (private browsing with storage blocked, etc.)
    // we fall back silently to an ephemeral in-memory id — no error thrown.
    const LS_KEY = "webapp:clientId:" + appId;
    const clientId = (function () {
        var fromAttr = root.getAttribute("data-webapp-client-id");
        if (fromAttr) { return fromAttr; }
        try {
            var stored = localStorage.getItem(LS_KEY);
            if (stored) { return stored; }
            var fresh = "client-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
            localStorage.setItem(LS_KEY, fresh);
            return fresh;
        } catch (_e) {
            // localStorage not available (e.g. blocked in private browsing).
            return "client-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
        }
    }());

    // P26: render through the shared serializer (window.WebappSerializer) so the
    // markup the client morphs in is byte-identical to what the server emitted.
    // No local renderer remains — that divergence is what previously downgraded
    // the page from sl-* elements to native HTML on hydrate().
    const serializer = root.ownerDocument.defaultView.WebappSerializer
        || (typeof window !== "undefined" ? window.WebappSerializer : undefined);

    // P55: shared console logger (ADR 0006 shape).
    //   severity  → console method
    //   debug     → console.debug  (DevTools-filterable, no flood in default console)
    //   info      → console.info   (lifecycle events: connected / disconnected / reconnect)
    //   warn      → console.warn   (recoverable: malformed frame, failed fetch)
    //   error     → console.error  (unrecoverable / unexpected)
    //
    // Every log includes a compact context object { appId, op } so DevTools
    // "Filter" on appId finds all messages for one app without grep.
    // Never throws — the logger itself is a no-op fallback if console is absent.
    const log = (function () {
        var con = (typeof console !== "undefined") ? console : null;
        function emit(method, op, message, extra) {
            if (!con) { return; }
            var ctx = { appId: appId, op: op };
            if (extra !== undefined) {
                ctx.detail = extra;
            }
            // ADR 0006: message is human-readable; context is the second arg so
            // DevTools shows the structured object collapsible next to the text.
            (con[method] || con.log).call(con, "[webapp:" + appId + "] " + message, ctx);
        }
        return {
            debug: function (op, msg, extra) { emit("debug", op, msg, extra); },
            info:  function (op, msg, extra) { emit("info",  op, msg, extra); },
            warn:  function (op, msg, extra) { emit("warn",  op, msg, extra); },
            error: function (op, msg, extra) { emit("error", op, msg, extra); }
        };
    }());

    function base() {
        return "/webapp/" + encodeURIComponent(appId);
    }

    function renderSnapshot(snapshot) {
        const ctx = { appId: appId, location: snapshot.location || location, params: snapshot.params, formId: undefined };
        const grid = serializer.renderLayoutHtml(snapshot.layout.id, snapshot.regions, ctx);
        // P64: dialogs render as native <sl-dialog> directly from the snapshot —
        // no hard-coded close action. The native X / ESC / overlay dismissal is
        // handled by the sl-after-hide listener wired in bindDialogDismissal().
        const dialogs = (snapshot.dialogs || []).map(function (dialog) {
            return serializer.renderDialogHtml(dialog, ctx);
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

    // P53: resolve a target node id to its rendered wrapper element. The
    // serializer tags every component wrapper with data-webapp-node (ADR 0005).
    function findTargetElement(nodeId) {
        if (!nodeId) {
            return null;
        }
        return root.querySelector('[data-webapp-node="' + cssEscapeAttr(nodeId) + '"]');
    }

    // Minimal attribute-value escaper for the selector (no CSS.escape in older
    // engines). Node ids are simple tokens, but guard quotes/backslashes anyway.
    function cssEscapeAttr(value) {
        return String(value).replace(/(["\\])/g, "\\$1");
    }

    // P53: stamp the interaction overlay onto the freshly rendered DOM. Called
    // after every snapshot render so a show/hide/enable/disable survives a
    // re-render. The overlay is ADDITIVE-ONLY: it never clears a component's
    // intrinsic state (e.g. a server-rendered sl-input[disabled] from its own
    // `disabled` prop). Clearing an overlay flag (show/enable) is done by
    // re-rendering from the snapshot — which restores the intrinsic markup — and
    // then re-stamping only the still-flagged overlay entries on top.
    function applyInteractionOverlay() {
        root.querySelectorAll("[data-webapp-node]").forEach(function (element) {
            const id = element.getAttribute("data-webapp-node");
            if (interaction.hidden[id]) {
                element.classList.add("webapp-hidden");
                element.setAttribute("hidden", "");
            }
            if (interaction.disabled[id]) {
                applyDisabledState(element, true);
            }
        });

        // Disclosure (open/close) of a sub-part of a target element — additive:
        // only opens flagged sections; closing is handled by removing the flag
        // and re-applying (the fresh markup is closed by default).
        Object.keys(interaction.open).forEach(function (key) {
            if (!interaction.open[key]) {
                return;
            }
            const hashIndex = key.indexOf("#");
            const targetId = hashIndex === -1 ? key : key.slice(0, hashIndex);
            const part = hashIndex === -1 ? undefined : key.slice(hashIndex + 1);
            const targetEl = findTargetElement(targetId);
            if (!targetEl) {
                return;
            }
            const openTarget = part ? findPartElement(targetEl, part) : targetEl;
            if (openTarget) {
                openTarget.setAttribute("open", "");
            }
        });

        // Single-active selection (tabs / stepper / menu): re-stamp the active
        // sub-part so a `select` survives a snapshot re-render the same way
        // open/hide/disable do. Additive — only re-applies flagged selections.
        Object.keys(interaction.selected).forEach(function (targetId) {
            const part = interaction.selected[targetId];
            if (!part) {
                return;
            }
            const targetEl = findTargetElement(targetId);
            if (targetEl) {
                activateSelection(targetEl, String(part));
            }
        });
    }

    // P59: activate a single-active sub-part within a target (tab / step / menu
    // item). Prefer the element's own activation affordance (click) and fall back
    // to the `active`/`selected` attribute the Shoelace markup uses.
    function activateSelection(targetEl, part) {
        const partEl = findPartElement(targetEl, part);
        if (!partEl) {
            return;
        }
        if (typeof partEl.click === "function") {
            partEl.click();
        }
        else {
            partEl.setAttribute("active", "");
        }
    }

    // P53: set the disabled state on a wrapper and its inner control(s). The
    // [disabled] attribute on form controls (sl-* / native) is what the browser
    // reads. ADDITIVE — only ever called with disabled=true from the overlay; an
    // `enable` clears the flag and re-renders rather than removing the attribute
    // here (so a component's intrinsic disabled prop is never stripped).
    function applyDisabledState(element, disabled) {
        const controls = element.matches("sl-button, button, input, textarea, select, sl-input, sl-textarea, sl-select, sl-checkbox, sl-switch, sl-radio-group, sl-range")
            ? [element]
            : Array.prototype.slice.call(element.querySelectorAll("sl-button, button, input, textarea, select, sl-input, sl-textarea, sl-select, sl-checkbox, sl-switch, sl-radio-group, sl-range"));
        controls.forEach(function (control) {
            if (disabled) {
                control.setAttribute("disabled", "");
            }
        });
    }

    // P53: find an openable sub-part within a target (accordion section, tree
    // branch, tab) by its name/id. Shoelace disclosure elements expose `name`
    // (sl-tab-panel) or an id; fall back to a data hook.
    function findPartElement(targetEl, part) {
        const esc = cssEscapeAttr(part);
        return targetEl.querySelector('[name="' + esc + '"]')
            || targetEl.querySelector('[data-webapp-part="' + esc + '"]')
            || (typeof targetEl.querySelector === "function" ? targetEl.querySelector("#" + esc) : null);
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

        // P53: re-stamp interaction state on the freshly rendered markup so a
        // store-driven re-render does not wipe a prior show/hide/enable/disable.
        applyInteractionOverlay();
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
        const eventPayload = {
            clientId: clientId,
            sourceId: detail.source,
            event: detail.event || "click",
            location: location,
            params: params
        };
        // P55: trace outgoing event POST at DEBUG.
        log.debug("dispatch", "→ POST /event " + eventPayload.event, {
            sourceId: eventPayload.sourceId,
            event: eventPayload.event,
            params: eventPayload.params
        });
        await fetch(base() + "/event", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(eventPayload)
        }).catch(function (err) {
            // P55: log instead of silently swallowing. The next user action or
            // stream push will reconcile the view (graceful degradation kept).
            log.warn("dispatch", "POST /event failed — UI event not delivered to flow", {
                event: eventPayload.event,
                sourceId: eventPayload.sourceId,
                error: err && err.message ? err.message : String(err)
            });
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

        // P95: breadcrumb items carry data-webapp-breadcrumb-action with the
        // item's action value (a string the flow can use for routing decisions).
        // ALL breadcrumb items — including active ones — emit a `click` event.
        // The browser takes NO navigation action; the wired flow decides.
        if (trigger.hasAttribute("data-webapp-breadcrumb-action")) {
            eventObject.preventDefault();
            const action = trigger.getAttribute("data-webapp-breadcrumb-action");
            dispatch({
                source: trigger.getAttribute("data-webapp-source"),
                event: "click",
                params: { action: action }
            });
            return;
        }

        // P75 (back-compat): breadcrumb / menu navigable items may carry
        // data-webapp-navigate-path for older-format items still in production.
        if (trigger.hasAttribute("data-webapp-navigate-path")) {
            eventObject.preventDefault();
            const path = trigger.getAttribute("data-webapp-navigate-path");
            dispatch({
                source: trigger.getAttribute("data-webapp-source"),
                event: "navigate",
                params: { path: path }
            });
            return;
        }

        // P71: a button in "navigate" link mode carries data-webapp-navigate with
        // the target route. The client performs the in-app navigation AND still
        // reports the click to the flow (so the flow can react), mirroring the
        // navigate ui-action verb (applyCommand "navigate").
        if (trigger.hasAttribute("data-webapp-navigate")) {
            eventObject.preventDefault();
            const route = trigger.getAttribute("data-webapp-navigate");
            dispatch({
                source: trigger.getAttribute("data-webapp-source"),
                event: "click",
                params: {}
            });
            if (route) {
                location = String(route);
                window.location.assign(base() + "/" + String(route).replace(/^\//, ""));
            }
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

    // P64: native <sl-dialog> dismissal. X / ESC / overlay-click all converge on
    // Shoelace's `sl-after-hide` (fired after the dialog has finished hiding). We
    // (1) report onClose to the flow (sourceId = the dialog node id) so a wired
    // flow reacts, and (2) optimistically remove the element so it disappears even
    // before the authoritative server snapshot (which sets ui.dialogs.<id>.open =
    // false) arrives. Guard against bubbled sl-after-hide from nested Shoelace
    // components (e.g. an sl-details inside the dialog body).
    root.addEventListener("sl-after-hide", function (eventObject) {
        const dialogEl = eventObject.target;

        if (!dialogEl || !dialogEl.hasAttribute || !dialogEl.hasAttribute("data-webapp-dialog")) {
            return;
        }

        if (!root.contains(dialogEl)) {
            return;
        }

        const dialogNodeId = dialogEl.getAttribute("data-webapp-dialog");

        dispatch({
            source: dialogNodeId,
            event: "onClose",
            params: {}
        });

        // Optimistic local close; the server snapshot will reconcile.
        dialogEl.remove();
    });

    // P37: set to true after initial hydration; redeploy reloads are ignored
    // until the page has fully settled so the SSE connect race does not cause
    // a reload loop on fresh page load.
    let hydrated = false;

    // Initial hydration: pull the canonical snapshot and take over rendering.
    async function hydrate() {
        const query = "?location=" + encodeURIComponent(location) + (dialogId ? "&dialog=" + encodeURIComponent(dialogId) : "");

        // P55: trace outgoing hydrate fetch at DEBUG.
        log.debug("hydrate", "→ GET /snapshot" + query);

        try {
            const response = await fetch(base() + "/snapshot" + query);

            if (!response.ok) {
                // P55: warn on non-OK response; the server-rendered fallback stays.
                log.warn("hydrate", "GET /snapshot returned " + response.status + " — keeping server-rendered fallback", {
                    status: response.status
                });
                hydrated = true;
                return;
            }

            const result = await response.json();

            if (result && result.snapshot) {
                // P55: trace incoming snapshot at DEBUG.
                log.debug("hydrate", "← snapshot received (location: " + (result.snapshot.location || location) + ")");
                applySnapshot(result.snapshot);
            }
        }
        catch (error) {
            // P55: log instead of silently swallowing. Server-rendered fallback stays.
            log.warn("hydrate", "GET /snapshot failed — keeping server-rendered fallback", {
                error: error && error.message ? error.message : String(error)
            });
        }
        hydrated = true;
    }

    // P53 (ADR 0005): apply an interaction command pushed by a ui-action in the
    // flow. These change INTERACTION state only (actions.md) — never business
    // data. The canonical verb set, in three semantic classes:
    //   presence:   show / hide        (any element, via the overlay)
    //   disclosure: open / close       (dialog / accordion section / tree branch;
    //                                    openDialog / closeDialog are aliases)
    //   single:     select             (active sub-part of a sibling set)
    //   plus:       navigate, enable / disable, focus, reset
    // Visibility / disabled / open-state live in the client overlay so they
    // survive the next snapshot push (applyInteractionOverlay re-stamps them).
    function applyCommand(command) {
        if (!command || !command.type) {
            return;
        }

        const target = command.target ? String(command.target) : undefined;
        const part = command.part ? String(command.part) : undefined;
        const openKey = target ? (part ? target + "#" + part : target) : undefined;

        switch (command.type) {
            case "navigate":
                if (command.to) {
                    location = String(command.to);
                    window.location.assign(base() + "/" + String(command.to).replace(/^\//, ""));
                }
                break;

            // ── presence ──────────────────────────────────────────────────────
            case "show":
                if (target) {
                    // Clearing a flag → re-render from snapshot to restore the
                    // intrinsic markup, then re-stamp the remaining overlay.
                    delete interaction.hidden[target];
                    reRenderWithOverlay();
                }
                break;
            case "hide":
                // P53: `hide` is ELEMENT visibility. A target-less `hide` keeps the
                // legacy "close the open dialog" behaviour for back-compat.
                if (target) {
                    interaction.hidden[target] = true;
                    applyInteractionOverlay(); // additive — no re-render needed
                }
                else {
                    dialogId = undefined;
                    if (currentSnapshot) {
                        applySnapshot(currentSnapshot);
                    }
                }
                break;

            // ── enabled state ─────────────────────────────────────────────────
            case "enable":
                if (target) {
                    delete interaction.disabled[target];
                    reRenderWithOverlay();
                }
                break;
            case "disable":
                if (target) {
                    interaction.disabled[target] = true;
                    applyInteractionOverlay(); // additive
                }
                break;

            // ── disclosure (open/close) — dialogs + sub-parts ─────────────────
            case "open":
            case "openDialog": // alias (back-compat)
                if (target && part) {
                    interaction.open[openKey] = true;
                    applyInteractionOverlay(); // additive
                }
                else if (target) {
                    // A bare target opens it as a dialog (the original openDialog).
                    dialogId = target;
                    if (currentSnapshot) {
                        applySnapshot(currentSnapshot);
                    }
                }
                break;
            case "close":
            case "closeDialog": // alias (back-compat)
                if (target && part) {
                    // Clearing an open flag → re-render to the (closed) intrinsic
                    // markup, then re-stamp any other still-open sections.
                    delete interaction.open[openKey];
                    reRenderWithOverlay();
                }
                else {
                    // Bare close (or target matching the open dialog) closes the dialog.
                    dialogId = undefined;
                    if (currentSnapshot) {
                        applySnapshot(currentSnapshot);
                    }
                }
                break;

            // ── single-active selection ───────────────────────────────────────
            case "select":
                if (target && part) {
                    // Record in the overlay so the selection survives a later
                    // snapshot re-render (applyInteractionOverlay re-stamps it),
                    // then activate it now.
                    interaction.selected[target] = part;
                    const targetEl = findTargetElement(target);
                    if (targetEl) {
                        activateSelection(targetEl, part);
                    }
                }
                break;

            // ── transient effects ─────────────────────────────────────────────
            case "focus":
                if (target) {
                    const focusEl = findTargetElement(target);
                    const control = focusEl && (focusEl.matches("input, textarea, select, sl-input, sl-textarea, sl-select, button, sl-button")
                        ? focusEl
                        : focusEl && focusEl.querySelector("input, textarea, select, sl-input, sl-textarea, sl-select, button, sl-button"));
                    if (control && typeof control.focus === "function") {
                        control.focus();
                    }
                }
                break;
            case "reset":
                if (target) {
                    // Clear all overlay flags for this target (back to the
                    // snapshot's own intrinsic state) and re-render.
                    delete interaction.hidden[target];
                    delete interaction.disabled[target];
                    delete interaction.selected[target];
                    Object.keys(interaction.open).forEach(function (key) {
                        if (key === target || key.indexOf(target + "#") === 0) {
                            delete interaction.open[key];
                        }
                    });
                    reRenderWithOverlay();
                }
                break;

            default:
                // Unknown verb — re-render so any snapshot-borne effect still lands.
                reRenderWithOverlay();
                break;
        }
    }

    // P53: re-render from the current snapshot (restoring every component's
    // intrinsic markup) and then re-stamp the additive interaction overlay. Used
    // whenever an overlay flag is CLEARED (show / enable / close-part / reset) so
    // a component's own state is not clobbered.
    function reRenderWithOverlay() {
        if (currentSnapshot) {
            applySnapshot(currentSnapshot); // applySnapshot re-applies the overlay
        }
    }

    // P57: append a structured error entry (ADR 0006 shape) to all ui-log elements
    // whose minSeverity threshold is at or below the entry's severity.
    // ui-log elements are rendered as <sl-details data-webapp-log="<nodeId>"> with
    // a <ul class="webapp-log-entries"> child. New entries are <li> elements prepended
    // (newest first) and the list is capped at data-log-max-entries.
    var LOG_SEVERITY_RANK = { debug: 0, info: 1, warn: 2, error: 3 };
    function appendLogEntry(err) {
        if (!err) {
            return;
        }
        var severity = err.severity || "error";
        var rank = LOG_SEVERITY_RANK[severity] !== undefined ? LOG_SEVERITY_RANK[severity] : 3;
        var logPanels = document.querySelectorAll("[data-webapp-log]");
        for (var i = 0; i < logPanels.length; i++) {
            var panel = logPanels[i];
            var minSev = panel.getAttribute("data-log-min-severity") || "debug";
            var minRank = LOG_SEVERITY_RANK[minSev] !== undefined ? LOG_SEVERITY_RANK[minSev] : 0;
            if (rank < minRank) {
                continue; // below threshold for this panel
            }
            var maxEntries = parseInt(panel.getAttribute("data-log-max-entries") || "50", 10);
            if (isNaN(maxEntries) || maxEntries < 1) {
                maxEntries = 50;
            }
            var list = panel.querySelector(".webapp-log-entries");
            if (!list) {
                continue;
            }
            // Build the entry element.
            var timestamp = err.timestamp ? String(err.timestamp) : new Date().toISOString();
            var message = String(err.message || "");
            var code = err.code ? String(err.code) : "";
            var li = document.createElement("li");
            li.className = "webapp-log-entry webapp-log-entry--" + severity;
            li.setAttribute("data-log-severity", severity);
            li.innerHTML = "<span class=\"webapp-log-ts\">" + timestamp.replace("T", " ").slice(0, 19) + "</span>"
                + " <span class=\"webapp-log-sev webapp-log-sev--" + severity + "\">" + severity.toUpperCase() + "</span>"
                + (code ? " <span class=\"webapp-log-code\">" + code + "</span>" : "")
                + " <span class=\"webapp-log-msg\">" + message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") + "</span>";
            // Prepend (newest first) and cap at maxEntries.
            list.insertBefore(li, list.firstChild);
            while (list.children.length > maxEntries) {
                list.removeChild(list.lastChild);
            }
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

        // P55: lifecycle — log SSE connection open at INFO.
        source.addEventListener("open", function () {
            log.info("sse", "Connected to live stream");
        });

        // P55: "error" listener handles BOTH:
        //   a) native EventSource connection failures (browser-generated, no .data)
        //   b) named SSE `event: error` frames pushed by the backend (P56, have .data)
        // Distinguish by checking evt.data: presence means it is a server-pushed
        // structured error frame (ADR 0006 decision 4); absence means a connection event.
        source.addEventListener("error", function (evt) {
            // Branch (b): backend-forwarded structured error frame (P55 receiving end,
            // transport implemented in P56). Log at the carried severity.
            if (evt.data !== undefined && evt.data !== null && evt.data !== "") {
                try {
                    var payload = JSON.parse(evt.data);
                    if (payload && payload.error) {
                        var err = payload.error;
                        var severity = err.severity || "error";
                        var msg = "[server] " + (err.message || "Unknown server error");
                        var extra = { code: err.code, context: err.context, origin: "server" };
                        if (log[severity]) {
                            log[severity]("sse/error", msg, extra);
                        } else {
                            log.error("sse/error", msg, extra);
                        }
                        // P57: push structured error entries to all ui-log nodes
                        // whose minSeverity threshold is at or below this severity.
                        appendLogEntry(err);
                        return;
                    }
                }
                catch (parseErr) {
                    log.warn("sse/error", "Failed to parse server error frame", {
                        error: parseErr && parseErr.message ? parseErr.message : String(parseErr),
                        data: evt.data ? String(evt.data).slice(0, 120) : "<empty>"
                    });
                    return;
                }
            }

            // Branch (a): native connection lifecycle event (EventSource.readyState).
            // EventSource.readyState: 0=CONNECTING, 1=OPEN, 2=CLOSED
            var state = source.readyState;
            if (state === 2) {
                log.info("sse", "Stream closed (will not reconnect)");
            } else if (state === 0) {
                log.info("sse", "Stream disconnected — reconnecting…");
            } else {
                log.warn("sse", "Stream error (readyState=" + state + ")");
            }
        });

        source.addEventListener("snapshot", function (messageEvent) {
            try {
                const payload = JSON.parse(messageEvent.data);
                if (payload && payload.snapshot) {
                    // P55: trace incoming snapshot at DEBUG (compact summary).
                    log.debug("sse/snapshot", "← snapshot (location: " + (payload.snapshot.location || location) + ")");
                    applySnapshot(payload.snapshot);
                }
                else {
                    log.warn("sse/snapshot", "Received snapshot frame with missing payload — skipping", {
                        data: messageEvent.data ? messageEvent.data.slice(0, 120) : "<empty>"
                    });
                }
            }
            catch (error) {
                // P55: log instead of silently swallowing. Next push corrects view.
                log.warn("sse/snapshot", "Failed to parse snapshot frame — skipping", {
                    error: error && error.message ? error.message : String(error),
                    data: messageEvent.data ? messageEvent.data.slice(0, 120) : "<empty>"
                });
            }
        });

        source.addEventListener("command", function (messageEvent) {
            try {
                const payload = JSON.parse(messageEvent.data);
                if (payload && payload.command) {
                    // P55: trace incoming command at DEBUG.
                    log.debug("sse/command", "← command " + (payload.command.type || "?"), {
                        target: payload.command.target,
                        part: payload.command.part
                    });
                    applyCommand(payload.command);
                }
                else {
                    log.warn("sse/command", "Received command frame with missing payload — skipping", {
                        data: messageEvent.data ? messageEvent.data.slice(0, 120) : "<empty>"
                    });
                }
            }
            catch (error) {
                // P55: log instead of silently swallowing.
                log.warn("sse/command", "Failed to parse command frame — skipping", {
                    error: error && error.message ? error.message : String(error),
                    data: messageEvent.data ? messageEvent.data.slice(0, 120) : "<empty>"
                });
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
                    log.warn("sse/toast", "Received toast frame with missing payload — skipping", {
                        data: messageEvent.data ? messageEvent.data.slice(0, 120) : "<empty>"
                    });
                    return;
                }
                const toast = payload.toast;
                // P55: trace incoming toast at DEBUG.
                log.debug("sse/toast", "← toast severity=" + (toast.severity || "info") + " \"" + String(toast.message || "").slice(0, 60) + "\"");
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
                // P55: log instead of silently swallowing.
                log.warn("sse/toast", "Failed to parse or display toast frame — skipping", {
                    error: error && error.message ? error.message : String(error),
                    data: messageEvent.data ? messageEvent.data.slice(0, 120) : "<empty>"
                });
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
                // P55: log reload trigger at INFO.
                log.info("sse/redeploy", "Flow redeployed — reloading page");
                window.location.reload();
            }
        });
    }

    // Test hook (P26): expose applySnapshot so a jsdom test can drive a
    // re-render / morph and assert no element-kind swap. No-op in production
    // unless a test sets window.__webappClientTestHooks beforehand.
    //
    // P55: also expose handleServerError so E2E tests can fire a synthetic
    // "webapp-error" payload without needing to intercept the SSE stream.
    if (root.ownerDocument.defaultView && root.ownerDocument.defaultView.__webappClientTestHooks) {
        root.ownerDocument.defaultView.__webappClientTestHooks.applySnapshot = applySnapshot;
        root.ownerDocument.defaultView.__webappClientTestHooks.applyCommand = applyCommand;
        root.ownerDocument.defaultView.__webappClientTestHooks.handleServerError = function (errorPayload) {
            // Simulate receiving a backend-forwarded "error" SSE frame (ADR 0006 §4).
            var err = errorPayload || {};
            var severity = err.severity || "error";
            var msg = "[server] " + (err.message || "Unknown server error");
            var extra = { code: err.code, context: err.context, origin: "server" };
            if (log[severity]) {
                log[severity]("sse/error", msg, extra);
            } else {
                log.error("sse/error", msg, extra);
            }
        };
    }

    hydrate();
    subscribe();
})();

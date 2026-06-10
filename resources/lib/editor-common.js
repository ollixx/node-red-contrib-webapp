(function (global) {
    "use strict";

    const standardLayoutPresetOptions = [
        { value: "vertical", label: "Vertical" },
        { value: "horizontal", label: "Horizontal" },
        { value: "app", label: "App" },
        { value: "grid", label: "Grid" },
        { value: "absolute", label: "Absolute" },
        { value: "dialog", label: "Dialog" },
        // P95: breadcrumb layout — child nodes as items (default slot) + separator (separator slot).
        { value: "breadcrumb", label: "Breadcrumb" }
    ];
    const standardLayoutPresetSlots = {
        vertical: ["content"],
        horizontal: ["content"],
        app: ["header", "navbar", "content", "footer"],
        grid: ["content"],
        absolute: ["content"],
        // P64: maps onto native <sl-dialog> slots (label / header-actions / default / footer).
        dialog: ["header", "header-actions", "content", "footer"],
        // P95: breadcrumb layout — items go into "default" slot, separator into "separator" slot.
        breadcrumb: ["default", "separator"]
    };
    const layoutChildFieldsByVariant = {
        horizontal: ["order"],
        vertical: ["order"],
        grid: ["row", "col", "colSize", "rowSize"],
        absolute: ["layoutX", "layoutY"]
    };

    // ── Variant vocabulary (P50) ─────────────────────────────────────────────
    // Mirrors COMPONENT_VARIANT_VOCABULARY / COMPONENT_VARIANT_DEFAULT from
    // packages/schema/src/contracts.ts. Keyed by the component KIND (matches the
    // node type without the "ui-" prefix). Only nodes with TRUE Ebene-2 semantic
    // variants are present; nodes whose "variant"-named field is actually a
    // displayType are absent (they were split off by P49).
    //
    // IMPORTANT: when updating the schema vocabulary, update this table too.
    const COMPONENT_VARIANT_VOCABULARY = {
        button: ["primary", "secondary", "success", "danger", "warning", "neutral", "ghost", "link"],
        // P111: ui-text `variant` is the semantic COLOUR axis (the typographic
        // role moved to the separate `style` field → TEXT_STYLE_OPTIONS below).
        text: ["default", "muted", "primary", "success", "warning", "danger", "neutral"],
        container: ["card", "panel", "section", "transparent"],
        card: ["card", "panel", "section", "transparent"],
        input: ["default", "filled", "outlined"],
        badge: ["primary", "success", "warning", "danger", "neutral", "info"],
        alert: ["primary", "success", "warning", "danger", "neutral", "info"]
    };
    const COMPONENT_VARIANT_DEFAULT = {
        button: "neutral",
        // P111: ui-text colour default — `default` inherits the text colour.
        text: "default",
        container: "card",
        card: "card",
        input: "default",
        badge: "neutral",
        alert: "primary"
    };

    // ── Central editor-field injection ──────────────────────────────────────
    // The markup of fields shared by many nodes used to be copy-pasted into each
    // node's HTML template (the 7 placement rows lived byte-identically in 28
    // files). injectFieldGroup() is the single generic primitive that builds a
    // shared field group's markup and inserts it into the node's edit panel, so
    // the markup is authored ONCE here, not per node. A later field family (the
    // variant SelectBox, P50) reuses the same mechanism by passing its own spec.
    //
    // A field group is identified by `groupId` (a data-attribute marker) so the
    // injection is idempotent — re-opening a panel never duplicates the rows.

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, function (ch) {
            switch (ch) {
                case "&": return "&amp;";
                case "<": return "&lt;";
                case ">": return "&gt;";
                case '"': return "&quot;";
                default: return "&#39;";
            }
        });
    }

    // Build the markup for one form row described by a field spec:
    //   { id, label, type, rowAttrs?, hidden?, options? }
    // type "select" uses the `options` array: [{ value, label }]
    function buildFieldRowMarkup(field) {
        const rowAttrs = field.rowAttrs || {};
        let attrs = "";
        Object.keys(rowAttrs).forEach(function (key) {
            attrs += ' ' + key + '="' + escapeHtml(rowAttrs[key]) + '"';
        });
        const style = field.hidden ? ' style="display: none;"' : "";
        let control;
        if (field.type === "select") {
            const optionMarkup = (field.options || []).map(function (opt) {
                return '<option value="' + escapeHtml(opt.value) + '">' + escapeHtml(opt.label) + "</option>";
            }).join("");
            control = '<select id="node-input-' + escapeHtml(field.id) + '">' + optionMarkup + "</select>";
        } else {
            const inputType = field.type || "text";
            const inputAttrs = field.inputAttrs || {};
            let extraAttrs = "";
            Object.keys(inputAttrs).forEach(function (key) {
                extraAttrs += ' ' + key + '="' + escapeHtml(String(inputAttrs[key])) + '"';
            });
            control = '<input type="' + escapeHtml(inputType) + '" id="node-input-' + escapeHtml(field.id) + '"' + extraAttrs + '>';
        }
        return (
            '<div class="form-row"' + attrs + style + '>' +
            '<label for="node-input-' + escapeHtml(field.id) + '">' + escapeHtml(field.label) + "</label>" +
            control +
            "</div>"
        );
    }

    // Generic "inject this shared field group" primitive.
    // spec = {
    //   groupId:   unique marker (data-field-group="<groupId>"), for idempotency
    //   separator: boolean — prepend an <hr> matching the template convention
    //   fields:    array of field specs (see buildFieldRowMarkup)
    // }
    // Returns the injected (or pre-existing) container as a jQuery object, or null
    // if no edit form is present. Appends to the form that hosts the node fields.
    function injectFieldGroup(spec) {
        const form = $("#node-input-mount").closest("form, .red-ui-tray-content, #dialog-form");
        const container = form.length ? form : $("#dialog-form");
        const target = container.length ? container : $(".red-ui-tray-body").first();
        if (!target.length) {
            return null;
        }

        const existing = target.find('[data-field-group="' + spec.groupId + '"]');
        if (existing.length) {
            return existing;
        }

        let markup = '<span data-field-group="' + escapeHtml(spec.groupId) + '" style="display: contents;">';
        if (spec.separator) {
            markup += '<hr style="margin: 8px 0;">';
        }
        (spec.fields || []).forEach(function (field) {
            markup += buildFieldRowMarkup(field);
        });
        markup += "</span>";

        const group = $(markup);
        target.append(group);
        return group;
    }

    // The placement-row field group: the 7 layout child-prop rows that used to be
    // duplicated in every view node's template. Order, labels, ids, input types
    // and the leading <hr> match the former hand-written markup exactly so the
    // rendered panel and the saved config are unchanged (pure refactor).
    // Grid placement fields (row/col/colSize/rowSize) enforce min=1/step=1 — grid
    // positions are 1-based positive integers. layoutX/layoutY allow 0 (absolute
    // coordinates). order has no lower bound constraint.
    const placementRowFields = [
        { id: "order", label: "Order", type: "number", rowAttrs: { "data-layout-child-prop-row": "order" }, hidden: true },
        { id: "row", label: "Row", type: "number", rowAttrs: { "data-layout-child-prop-row": "row" }, inputAttrs: { min: "1", step: "1" }, hidden: true },
        { id: "col", label: "Col", type: "number", rowAttrs: { "data-layout-child-prop-row": "col" }, inputAttrs: { min: "1", step: "1" }, hidden: true },
        { id: "colSize", label: "Col Size", type: "number", rowAttrs: { "data-layout-child-prop-row": "colSize" }, inputAttrs: { min: "1", step: "1" }, hidden: true },
        { id: "rowSize", label: "Row Size", type: "number", rowAttrs: { "data-layout-child-prop-row": "rowSize" }, inputAttrs: { min: "1", step: "1" }, hidden: true },
        { id: "layoutX", label: "X", type: "number", rowAttrs: { "data-layout-child-prop-row": "layoutX" }, hidden: true },
        { id: "layoutY", label: "Y", type: "number", rowAttrs: { "data-layout-child-prop-row": "layoutY" }, hidden: true }
    ];

    function injectPlacementRows() {
        return injectFieldGroup({
            groupId: "layout-placement",
            separator: true,
            fields: placementRowFields
        });
    }

    // ── Variant SelectBox (P50) ──────────────────────────────────────────────
    // installVariantSelectBox(kind) — call in oneditprepare for any node that has
    // a TRUE semantic `variant` field. `kind` is the component kind key used in
    // COMPONENT_VARIANT_VOCABULARY (e.g. "button", "text", "container", "input").
    //
    // Behaviour:
    //   1. Looks up the vocabulary for `kind` — if unknown, does nothing.
    //   2. Injects a <select id="node-input-variant"> via injectFieldGroup()
    //      (idempotent — re-opening the panel never duplicates the row).
    //   3. Manually binds the stored value (this.variant || default) to the
    //      select, because Node-RED binds defaults BEFORE oneditprepare runs.
    //
    // Returns a function bound to the node context (for use as:
    //   common.installVariantSelectBox("button").call(this)
    // or assigned to a variable and called).
    function installVariantSelectBox(kind) {
        return function () {
            const self = this;
            const vocabulary = COMPONENT_VARIANT_VOCABULARY[kind];
            if (!vocabulary || !vocabulary.length) {
                return;
            }
            const defaultVariant = COMPONENT_VARIANT_DEFAULT[kind] || vocabulary[0];
            const options = vocabulary.map(function (v) {
                // Produce a human-readable label: capitalise first letter,
                // replace hyphens with spaces.
                const label = v.charAt(0).toUpperCase() + v.slice(1).replace(/-/g, " ");
                return { value: v, label: label };
            });

            injectFieldGroup({
                groupId: "variant-select",
                separator: false,
                fields: [
                    {
                        id: "variant",
                        label: "Variant",
                        type: "select",
                        options: options
                    }
                ]
            });

            // Bind the stored value (Node-RED already ran, so #node-input-variant
            // did not exist yet when it tried to bind the default).
            const select = $("#node-input-variant");
            if (select.length) {
                select.val(self.variant || defaultVariant);
            }
        };
    }

    // ── Size SelectBox (P71) ─────────────────────────────────────────────────
    // installSizeSelectBox() injects a "Size" select with the three-step token
    // set (sm/md/lg) for nodes backed by a natively-sized Shoelace element
    // (button/text/input/select/textarea). An empty option leaves size unset
    // (the backend's default size applies). Idempotent like the variant box.
    const SIZE_OPTIONS = [
        { value: "", label: "(default)" },
        { value: "sm", label: "Small" },
        { value: "md", label: "Medium" },
        { value: "lg", label: "Large" }
    ];

    function installSizeSelectBox() {
        return function () {
            const self = this;
            injectFieldGroup({
                groupId: "size-select",
                separator: false,
                fields: [
                    { id: "size", label: "Size", type: "select", options: SIZE_OPTIONS }
                ]
            });
            const select = $("#node-input-size");
            if (select.length) {
                select.val(self.size || "");
            }
        };
    }

    // ── Text style SelectBox (P111) ──────────────────────────────────────────
    // installTextStyleSelectBox() injects the ui-text "Style" select — the
    // typographic ROLE axis (heading-1…/body/caption/label/code), distinct from
    // the colour `variant` select. Each value maps onto a semantic HTML element
    // at render time. Idempotent like the variant box.
    const TEXT_STYLE_OPTIONS = [
        { value: "heading-1", label: "Heading 1" },
        { value: "heading-2", label: "Heading 2" },
        { value: "heading-3", label: "Heading 3" },
        { value: "body", label: "Body" },
        { value: "caption", label: "Caption" },
        { value: "label", label: "Label" },
        { value: "code", label: "Code" }
    ];

    function installTextStyleSelectBox() {
        return function () {
            const self = this;
            injectFieldGroup({
                groupId: "text-style-select",
                separator: false,
                fields: [
                    { id: "style", label: "Style", type: "select", options: TEXT_STYLE_OPTIONS }
                ]
            });
            const select = $("#node-input-style");
            if (select.length) {
                select.val(self.style || "body");
            }
        };
    }

    // ── Button link mode + outline (P71) ─────────────────────────────────────
    // installButtonLinkFields() injects:
    //   • an "Outline" checkbox (boolean outline flag),
    //   • a "Link Mode" select (button | url | navigate),
    //   • an "URL / Route" text field, shown only for url/navigate modes.
    // The href field's visibility tracks the selected mode live.
    const BUTTON_LINK_MODE_OPTIONS = [
        { value: "button", label: "Button (no link)" },
        { value: "url", label: "URL (hyperlink)" },
        { value: "navigate", label: "Navigate (in-app route)" }
    ];

    function installButtonLinkFields() {
        return function () {
            const self = this;
            injectFieldGroup({
                groupId: "button-link",
                separator: false,
                fields: [
                    { id: "outline", label: "Outline", type: "checkbox" },
                    { id: "linkMode", label: "Link Mode", type: "select", options: BUTTON_LINK_MODE_OPTIONS },
                    { id: "href", label: "URL / Route", type: "text", rowAttrs: { "data-button-href-row": "href" } }
                ]
            });

            const outline = $("#node-input-outline");
            if (outline.length) {
                outline.prop("checked", self.outline === true || self.outline === "true");
            }
            const mode = $("#node-input-linkMode");
            if (mode.length) {
                mode.val(self.linkMode || "button");
            }
            const href = $("#node-input-href");
            if (href.length) {
                href.val(self.href || "");
            }

            function syncHrefVisibility() {
                const value = $("#node-input-linkMode").val() || "button";
                const row = $('[data-button-href-row="href"]');
                if (value === "button") {
                    row.hide();
                } else {
                    row.show();
                }
            }
            mode.off("change.webappLinkMode").on("change.webappLinkMode", syncHrefVisibility);
            syncHrefVisibility();
        };
    }

    function labelWithName(fallback) {
        return function () {
            return this.name || this.id || fallback;
        };
    }

    function withUiIdMigration(definition) {
        return { ...definition };
    }

    function required(value) {
        return value !== undefined && value !== null && String(value).trim().length > 0;
    }

    function parseBindingValue(value) {
        if (value && typeof value === "object" && typeof value.kind === "string") {
            return value;
        }

        if (typeof value !== "string" || value.trim().length === 0) {
            return undefined;
        }

        try {
            const parsed = JSON.parse(value);
            return parsed && typeof parsed === "object" && typeof parsed.kind === "string" ? parsed : undefined;
        }
        catch {
            return undefined;
        }
    }

    function bindingValueForEditor(binding, fallbackLiteral) {
        if (binding && binding.kind === "literal") {
            return {
                type: "literal",
                value: binding.value === undefined || binding.value === null ? fallbackLiteral : String(binding.value)
            };
        }

        // P67: `store` binding — path holds the referenced ui-store id.
        if (binding && ["state", "query", "routeParam", "msg", "flow", "global", "jsonata", "env", "store"].includes(binding.kind)) {
            return {
                type: binding.kind,
                value: binding.path || ""
            };
        }

        return {
            type: "literal",
            value: fallbackLiteral || ""
        };
    }

    function collectReferenceNodes() {
        const references = {
            apps: [],
            routes: [],
            dialogs: [],
            containers: [],
            actions: [],
            stores: []
        };

        RED.nodes.eachNode(function (node) {
            const id = node.id || "";

            if (!id) {
                return;
            }

            if (node.type === "ui-app") {
                references.apps.push({
                    id,
                    layoutId: node.layout || "",
                    title: node.title || node.name || id
                });
                return;
            }

            if (node.type === "ui-route") {
                references.routes.push({
                    id,
                    path: node.path || "",
                    layoutId: node.layoutId || "",
                    title: node.title || node.name || id,
                    parent: node.parent || ""
                });
                return;
            }

            if (node.type === "ui-dialog") {
                references.dialogs.push({
                    id,
                    layoutId: node.layoutId || "",
                    title: node.title || node.name || id,
                    parent: node.parent || ""
                });
                return;
            }

            if (node.type === "ui-container") {
                references.containers.push({
                    id,
                    layoutId: node.layoutId || "",
                    title: node.title || node.name || id,
                    mount: node.mount || ""
                });
                return;
            }

            if (node.type === "ui-action" || node.type === "ui-navigation") {
                references.actions.push({
                    id,
                    label: node.name || id,
                    type: node.type,
                    to: node.to || "",
                    parent: node.parent || ""
                });
                return;
            }

            if (node.type === "ui-store") {
                references.stores.push({
                    id,
                    name: node.name || "",
                    statePath: node.statePath || "",
                    parent: node.parent || ""
                });
            }
        });

        return references;
    }

    // ── P117: App-scope helpers ──────────────────────────────────────────────
    // resolveEditedNodeApp(node, references) — determine the ui-app id that the
    // currently-edited node belongs to. Three cases:
    //   1. The node has a `parent` that is a known ui-app id → that app.
    //   2. The node has a `mount` → walk the mount chain upward to find the app.
    //   3. Neither known → return null (fallback: show all candidates).
    //
    // "Currently edited" means we look at the live panel values (#node-input-parent
    // / #node-input-mount) first, then fall back to the node object's fields, so
    // that changing the app in an open panel immediately scopes the picker.
    function resolveEditedNodeApp(node, references) {
        if (!node || !references) {
            return null;
        }

        const appIds = new Set(references.apps.map(function (a) { return a.id; }));

        // Read live panel value if the node is currently being edited.
        function liveVal(fieldId) {
            const el = $("#node-input-" + fieldId);
            return el.length ? (String(el.val() || "")) : null;
        }

        // Case 1: direct parent field.
        const parentVal = liveVal("parent") || (node.parent ? String(node.parent) : "");
        if (parentVal && appIds.has(parentVal)) {
            return parentVal;
        }

        // Case 2: mount chain.
        const mountVal = liveVal("mount") || (node.mount ? String(node.mount) : "");
        if (mountVal) {
            return resolveAppFromMount(mountVal, references, appIds);
        }

        return null;
    }

    // Walk a mount value upward through the hierarchy to find the app id.
    // Returns null if not resolvable. Pure — unit-testable without a DOM.
    function resolveAppFromMount(mountValue, references, appIds) {
        if (!mountValue) {
            return null;
        }
        const seen = new Set();
        let current = mountValue;
        while (current && !seen.has(current)) {
            seen.add(current);

            // Direct app slot: "<appId>.<slot>"
            const dotIdx = current.indexOf(".");
            if (dotIdx > 0 && !current.startsWith("route:") && !current.startsWith("dialog:") && !current.startsWith("container:")) {
                const candidateApp = current.slice(0, dotIdx);
                if (appIds.has(candidateApp)) {
                    return candidateApp;
                }
            }

            if (current.startsWith("route:")) {
                // route:<path>/<slot> → find the route by path, then its parent app.
                const sepIdx = current.lastIndexOf("/");
                const routePath = sepIdx >= 0 ? current.slice("route:".length, sepIdx) : current.slice("route:".length);
                const route = references.routes.find(function (r) { return r.path === routePath; });
                if (route && route.parent && appIds.has(route.parent)) {
                    return route.parent;
                }
                return null;
            }

            if (current.startsWith("dialog:")) {
                const sepIdx = current.lastIndexOf("/");
                const dialogId = sepIdx >= 0 ? current.slice("dialog:".length, sepIdx) : current.slice("dialog:".length);
                const dialog = references.dialogs.find(function (d) { return d.id === dialogId; });
                if (dialog && dialog.parent && appIds.has(dialog.parent)) {
                    return dialog.parent;
                }
                return null;
            }

            if (current.startsWith("container:")) {
                const sepIdx = current.lastIndexOf("/");
                const containerId = sepIdx >= 0 ? current.slice("container:".length, sepIdx) : current.slice("container:".length);
                const container = references.containers.find(function (c) { return c.id === containerId; });
                if (container && container.mount) {
                    current = container.mount;
                    continue;
                }
                return null;
            }

            break;
        }
        return null;
    }

    function sortOptions(options) {
        return [...options].sort(function (left, right) {
            return left.label.localeCompare(right.label, undefined, { sensitivity: "base" });
        });
    }

    // ── Unified node-picker dialog (P68) ────────────────────────────────────
    // A single reusable picker for EVERY ui-* node selection (parents, routes,
    // actions, stores, references). Same look everywhere; only the DEFAULT
    // filter (preset) differs. Inside the dialog the candidate list is further
    // narrowed by a case-insensitive contains-match over name, id AND node type.
    //
    // The candidate entries are produced by the FILTER PRESETS below — pure
    // functions over the collectReferenceNodes() result. Each returns a flat
    // list of { value, label, name, id, type } so the match/render logic stays
    // generic and the presets stay independently testable.
    //
    // The editor UI is the Node-RED admin UI (jQuery), NOT the runtime Shoelace,
    // so the dialog is built from plain admin-UI DOM (no <sl-dialog>).

    // Case-insensitive contains-match over an entry's name, id and type. An
    // empty query matches everything. Pure — unit-testable without a DOM.
    function nodePickerMatch(entry, query) {
        const q = String(query == null ? "" : query).trim().toLowerCase();
        if (!q) {
            return true;
        }
        const haystack = [entry && entry.name, entry && entry.id, entry && entry.type]
            .filter(function (part) { return part != null && part !== ""; })
            .join(" ")
            .toLowerCase();
        return haystack.indexOf(q) !== -1;
    }

    // ── App-label lookup (used in fallback secondary lines) ──────────────────
    // Returns the title of a ui-app for a given id, or "" when not found.
    function appTitleById(references, appId) {
        if (!appId) {
            return "";
        }
        const app = references.apps.find(function (a) { return a.id === appId; });
        return app ? (app.title || app.id) : appId;
    }

    // Filter presets: references → candidate entries. Pure functions; keyed by a
    // stable preset id so callers select by name and the set stays extensible.
    //
    // P117: Each preset now accepts a second `context` argument: { appId? }.
    // When `appId` is set the candidates are scoped to that app only.
    // When `appId` is null/undefined, all candidates are returned but entries
    // for `stores`, `actions` and `routes` include the app title in their
    // secondary line so origin is visible.
    const nodePickerPresets = {
        apps: function (references) {
            return references.apps.map(function (app) {
                const name = app.title || app.id;
                return { value: app.id, label: name, name: name, id: app.id, type: "ui-app" };
            });
        },
        routes: function (references, context) {
            const appId = context && context.appId ? context.appId : null;
            const candidates = appId
                ? references.routes.filter(function (r) { return r.parent === appId; })
                : references.routes;
            return candidates.map(function (route) {
                const name = route.title || route.path || route.id;
                const label = route.path ? name + " (" + route.path + ")" : name;
                const secondary = !appId && route.parent ? appTitleById(references, route.parent) : "";
                return { value: route.id, label: label, name: name, id: route.id, type: "ui-route", secondary: secondary };
            });
        },
        actions: function (references, context) {
            const appId = context && context.appId ? context.appId : null;
            const candidates = appId
                ? references.actions.filter(function (a) { return a.parent === appId; })
                : references.actions;
            return candidates.map(function (action) {
                const name = action.label || action.id;
                const suffix = action.type === "ui-navigation" && action.to ? " -> " + action.to : "";
                const secondary = !appId && action.parent ? appTitleById(references, action.parent) : "";
                return {
                    value: action.id,
                    label: name + suffix,
                    name: name,
                    id: action.id,
                    type: action.type || "ui-action",
                    secondary: secondary
                };
            });
        },
        stores: function (references, context) {
            const appId = context && context.appId ? context.appId : null;
            const candidates = appId
                ? references.stores.filter(function (s) { return s.parent === appId; })
                : references.stores;
            return candidates.map(function (store) {
                const name = store.name || store.id;
                const detail = store.statePath ? store.id + " (" + store.statePath + ")" : store.id;
                const label = store.name ? store.name + " — " + detail : detail;
                const secondary = !appId && store.parent ? appTitleById(references, store.parent) : "";
                return { value: store.id, label: label, name: name, id: store.id, type: "ui-store", secondary: secondary };
            });
        },
        // P114 / ADR 0009: the mount (parent-slot) preset. The hierarchical
        // option tree (apps → routes/dialogs → containers → slots) built by
        // buildMountOptionsTree is FLATTENED into picker entries whose label is
        // the full breadcrumb (e.g. "Shop > /customers > content"). The mount
        // value travels in `value` and `id`, the breadcrumb in `label` and
        // `name`, so nodePickerMatch searches both breadcrumb AND mount value
        // without any preset-specific match logic. The dialog needs no group
        // headers — the breadcrumb carries the hierarchy.
        // P117: With appId context, only mount slots belonging to that app are offered.
        mounts: function (references, context) {
            const appId = context && context.appId ? context.appId : null;
            const all = flattenMountOptionTree(buildMountOptionsTree(references));
            if (!appId) {
                return all;
            }
            // Filter by appId: the breadcrumb starts with the app title, or
            // the value starts with the appId (direct app slots) or belongs to
            // a route/dialog/container under that app.
            return all.filter(function (entry) {
                return isMountUnderApp(entry.value, references, appId);
            });
        }
    };

    // P117: Check whether a mount value belongs to a given app.
    // Pure — unit-testable. Works by resolving the mount chain upward.
    function isMountUnderApp(mountValue, references, appId) {
        const appIds = new Set(references.apps.map(function (a) { return a.id; }));
        return resolveAppFromMount(mountValue, references, appIds) === appId;
    }

    // Flatten the grouped/optgroup mount option tree into a flat list of picker
    // entries. Disabled group-header rows (no `value`) are dropped; each real
    // mount option becomes { value, label(breadcrumb), name, id, type }.
    // Duplicate mount values are de-duplicated (the tree can repeat a slot via
    // nested containers). Pure — unit-testable without a DOM.
    function flattenMountOptionTree(groups) {
        const entries = [];
        const seen = new Set();
        (groups || []).forEach(function (group) {
            (group.options || []).forEach(function (option) {
                if (option.disabled || !option.value || seen.has(option.value)) {
                    return;
                }
                seen.add(option.value);
                const breadcrumb = option.label || option.value;
                entries.push({
                    value: option.value,
                    label: breadcrumb,
                    name: breadcrumb,
                    id: option.value,
                    type: "mount"
                });
            });
        });
        return entries;
    }

    function getNodePickerPreset(preset) {
        if (typeof preset === "function") {
            return preset;
        }
        if (typeof preset === "string" && nodePickerPresets[preset]) {
            return nodePickerPresets[preset];
        }
        return function () { return []; };
    }

    // Produce the candidate entries for a preset against the live editor graph.
    // P117: accepts an optional `context` object { appId? } to scope candidates.
    function nodePickerOptionsForPreset(preset, context) {
        const references = collectReferenceNodes();
        return sortOptions(getNodePickerPreset(preset)(references, context || {}));
    }

    // ── P117: Shared picker stylesheet (injected once, idempotent) ───────────
    // All three picker dialogs (node/icon/media) share `.webapp-node-picker-*`
    // class names. This stylesheet replaces inline css({}) calls and applies the
    // Node-RED admin-UI look (sans-serif font, red-ui-* token colours, NR-style
    // header/search/rows/footer). Injected lazily on first open; safe to call
    // multiple times (guarded by <style> id).
    function ensurePickerStylesheet() {
        if (document.getElementById("webapp-picker-styles")) {
            return;
        }
        const css = [
            /* overlay backdrop */
            ".webapp-node-picker-overlay {",
            "  position: fixed; inset: 0;",
            "  background: rgba(0,0,0,0.4);",
            "  z-index: 2000;",
            "  display: flex; align-items: center; justify-content: center;",
            "}",

            /* dialog box — sans-serif editor font throughout */
            ".webapp-node-picker-dialog {",
            "  font-family: var(--red-ui-primary-font, 'Helvetica Neue', Arial, sans-serif);",
            "  font-size: 13px;",
            "  background: var(--red-ui-primary-background, #fff);",
            "  color: var(--red-ui-primary-text-color, #333);",
            "  border: 1px solid var(--red-ui-secondary-border-color, #ccc);",
            "  border-radius: 4px;",
            "  box-shadow: 0 4px 24px rgba(0,0,0,0.3);",
            "  width: 420px; max-width: 90vw; max-height: 80vh;",
            "  display: flex; flex-direction: column;",
            "  overflow: hidden;",
            "}",

            /* header bar — matches NR tray/dialog header style */
            ".webapp-node-picker-header {",
            "  padding: 8px 12px;",
            "  font-size: 14px;",
            "  font-weight: 500;",
            "  font-family: var(--red-ui-primary-font, 'Helvetica Neue', Arial, sans-serif);",
            "  background: var(--red-ui-secondary-background, #f3f3f3);",
            "  color: var(--red-ui-primary-text-color, #333);",
            "  border-bottom: 1px solid var(--red-ui-secondary-border-color, #ccc);",
            "  flex: 0 0 auto;",
            "}",

            /* search field wrapper */
            ".webapp-node-picker-search-wrap {",
            "  padding: 8px 10px;",
            "  flex: 0 0 auto;",
            "  border-bottom: 1px solid var(--red-ui-secondary-border-color, #eee);",
            "  display: flex; align-items: center;",
            "  gap: 6px;",
            "}",
            ".webapp-node-picker-search-wrap .fa-search {",
            "  color: var(--red-ui-secondary-text-color, #888);",
            "  font-size: 12px;",
            "}",

            /* search input — NR-like, no border boxing */
            ".webapp-node-picker-search {",
            "  flex: 1 1 auto;",
            "  min-width: 0;",
            "  font-family: var(--red-ui-primary-font, 'Helvetica Neue', Arial, sans-serif);",
            "  font-size: 13px;",
            "  border: 1px solid var(--red-ui-form-input-border-color, #ccc);",
            "  border-radius: 3px;",
            "  padding: 4px 7px;",
            "  background: var(--red-ui-primary-background, #fff);",
            "  color: var(--red-ui-primary-text-color, #333);",
            "  outline: none;",
            "}",
            ".webapp-node-picker-search:focus {",
            "  border-color: var(--red-ui-text-color-link, #4a90d9);",
            "  box-shadow: 0 0 0 2px rgba(74,144,217,0.2);",
            "}",

            /* scrollable list */
            ".webapp-node-picker-list {",
            "  flex: 1 1 auto;",
            "  overflow-y: auto;",
            "  min-height: 120px;",
            "  padding: 4px 6px 6px;",
            "}",

            /* individual row */
            ".webapp-node-picker-row {",
            "  padding: 6px 8px;",
            "  cursor: pointer;",
            "  border-radius: 3px;",
            "  margin-bottom: 1px;",
            "  background: transparent;",
            "}",
            ".webapp-node-picker-row:hover {",
            "  background: var(--red-ui-list-item-background-hover, #f3f3f3);",
            "}",
            ".webapp-node-picker-row.selected {",
            "  background: var(--red-ui-list-item-background-selected, #e6f0f8);",
            "}",

            /* primary label */
            ".webapp-node-picker-row-primary {",
            "  font-family: var(--red-ui-primary-font, 'Helvetica Neue', Arial, sans-serif);",
            "  font-size: 13px;",
            "  font-weight: 500;",
            "  color: var(--red-ui-primary-text-color, #333);",
            "}",

            /* secondary meta line (id · type · app) */
            ".webapp-node-picker-row-secondary {",
            "  font-family: var(--red-ui-primary-font, 'Helvetica Neue', Arial, sans-serif);",
            "  font-size: 11px;",
            "  color: var(--red-ui-secondary-text-color, #666);",
            "}",

            /* empty / no-match notice */
            ".webapp-node-picker-empty {",
            "  font-family: var(--red-ui-primary-font, 'Helvetica Neue', Arial, sans-serif);",
            "  font-size: 13px;",
            "  font-style: italic;",
            "  color: var(--red-ui-secondary-text-color, #666);",
            "  padding: 8px;",
            "}",

            /* footer */
            ".webapp-node-picker-footer {",
            "  padding: 8px 12px;",
            "  border-top: 1px solid var(--red-ui-secondary-border-color, #ccc);",
            "  text-align: right;",
            "  flex: 0 0 auto;",
            "  display: flex; align-items: center; justify-content: flex-end; gap: 6px;",
            "}"
        ].join("\n");

        const style = document.createElement("style");
        style.id = "webapp-picker-styles";
        style.textContent = css;
        document.head.appendChild(style);
    }

    // Open the modal picker. options:
    //   title      — dialog heading
    //   value      — currently-selected id (highlighted, pre-scrolled)
    //   entries    — array of { value, label, name, id, type, secondary? }
    //   onSelect   — function(value) called with the chosen id when confirmed
    function openNodePickerDialog(options) {
        ensurePickerStylesheet();

        const opts = options || {};
        const entries = Array.isArray(opts.entries) ? opts.entries : [];
        const currentValue = opts.value ? String(opts.value) : "";

        const $overlay = $("<div>").addClass("webapp-node-picker-overlay");

        const $dialog = $("<div>").addClass("webapp-node-picker-dialog").appendTo($overlay);

        // Header
        $("<div>")
            .addClass("webapp-node-picker-header")
            .text(opts.title || "Knoten auswählen")
            .appendTo($dialog);

        // Search bar with magnifier icon
        const $searchWrap = $("<div>").addClass("webapp-node-picker-search-wrap").appendTo($dialog);
        $("<i>").addClass("fa fa-search").appendTo($searchWrap);
        const $search = $("<input type=\"text\">")
            .attr("placeholder", "Suche (Name, ID, Typ)…")
            .addClass("webapp-node-picker-search")
            .appendTo($searchWrap);

        const $list = $("<div>").addClass("webapp-node-picker-list").appendTo($dialog);

        const $footer = $("<div>").addClass("webapp-node-picker-footer").appendTo($dialog);

        let selectedValue = currentValue;

        function close() {
            $overlay.remove();
            $(document).off("keydown.webappNodePicker");
        }

        function confirm(value) {
            close();
            if (typeof opts.onSelect === "function") {
                opts.onSelect(value);
            }
        }

        function renderRows() {
            const query = $search.val();
            $list.empty();
            const matches = entries.filter(function (entry) { return nodePickerMatch(entry, query); });

            if (matches.length === 0) {
                $("<div>").addClass("webapp-node-picker-empty").text("Keine Treffer.").appendTo($list);
                return;
            }

            matches.forEach(function (entry) {
                const isSelected = entry.value === selectedValue;
                const $row = $("<div>")
                    .addClass("webapp-node-picker-row")
                    .attr("data-value", entry.value);
                if (isSelected) {
                    $row.addClass("selected");
                }

                $("<div>")
                    .addClass("webapp-node-picker-row-primary")
                    .text(entry.label || entry.name || entry.id)
                    .appendTo($row);

                // Secondary line: id · type [· app (fallback mode)]
                const secondaryParts = [entry.id + "  ·  " + entry.type];
                if (entry.secondary) {
                    secondaryParts.push(entry.secondary);
                }
                $("<div>")
                    .addClass("webapp-node-picker-row-secondary")
                    .text(secondaryParts.join("  ·  "))
                    .appendTo($row);

                $row.on("click", function () { confirm(entry.value); });
                $list.append($row);
            });
        }

        const $clearBtn = $("<button type=\"button\" class=\"red-ui-button\">")
            .text("Leeren")
            .on("click", function (event) {
                event.preventDefault();
                confirm("");
            });
        const $cancelBtn = $("<button type=\"button\" class=\"red-ui-button\">")
            .text("Abbrechen")
            .on("click", function (event) {
                event.preventDefault();
                close();
            });
        $footer.append($clearBtn).append($cancelBtn);

        $search.on("input", renderRows);
        $overlay.on("click", function (event) {
            if (event.target === $overlay[0]) {
                close();
            }
        });
        $(document).on("keydown.webappNodePicker", function (event) {
            if (event.key === "Escape") {
                close();
            }
        });

        renderRows();
        $("body").append($overlay);
        $search.trigger("focus");

        return { close: close };
    }

    // ── Picker field (P114 / ADR 0009) ──────────────────────────────────────
    // installPickerField(selector, config) turns a bound reference field
    // (#node-input-*) into the dialog-only selection pattern: the original
    // control is HIDDEN (it stays in the DOM as the value carrier so Node-RED's
    // defaults binding, change events, validation and the save round-trip are
    // unchanged) and a read-only display + an "Auswählen…" button are rendered
    // next to it. The display shows the human-readable label of the current
    // selection (for mounts the full breadcrumb), or a placeholder when empty.
    // A non-resolvable stored value survives and is shown as "<value> (bestehend)".
    // Optional fields (clearable) get a "×" that writes "" and fires change.
    //
    // This SUPERSEDES enhanceSelectWithPicker (dropdown + button) per ADR 0009 —
    // there is no visible, fully-populated reference <select> anywhere anymore.
    //
    // config:
    //   filterPreset  — picker preset id (apps|routes|actions|stores|mounts)
    //   title         — dialog heading
    //   placeholder   — display text when the field is empty
    //   clearable     — show the "×" clear control (optional fields)
    //   seedValue     — value to seed into the carrier if it is currently empty
    //                   (the node's stored value; needed for <select> carriers
    //                   that Node-RED could not bind because they have no options)
    //   getAppId      — P117: optional function() → appId for scoping candidates
    //                   to the app of the edited node. When omitted, installPickerField
    //                   derives the app automatically from the live panel state.
    function installPickerField(selector, config) {
        const cfg = config || {};
        const $field = $(selector);
        if ($field.length === 0 || $field.data("webappPickerField")) {
            return;
        }
        $field.data("webappPickerField", true);

        const isSelect = $field.is("select");

        // A <select> only ever holds a value it has an <option> for. The template
        // ships an option-less <select> under ADR 0009, so ensure the needed
        // option exists before selecting it: an empty option so "" (cleared)
        // sticks, plus a raw option for any value not already present.
        if (isSelect && $field.find("option[value='']").length === 0) {
            $field.prepend($("<option></option>").attr("value", "").text(""));
        }
        function setFieldValue(value) {
            const next = value == null ? "" : String(value);
            if (isSelect && next && $field.find("option[value='" + next.replace(/'/g, "\\'") + "']").length === 0) {
                $field.append($("<option></option>").attr("value", next).text(next));
            }
            $field.val(next);
        }

        // Seed the stored value (Node-RED may have failed to bind it onto an
        // option-less <select>). Only when the carrier is currently empty so we
        // never clobber a value Node-RED already bound onto an <input>.
        if (cfg.seedValue && !$field.val()) {
            setFieldValue(cfg.seedValue);
        }

        // Hide the bound value carrier (a <select> or <input>) but keep it in the
        // DOM — it remains the single source of truth for save/round-trip.
        $field.hide();

        const $wrap = $("<span>")
            .addClass("webapp-picker-field")
            .css({ display: "inline-flex", "align-items": "center", gap: "6px", "max-width": "70%" });

        const $display = $("<span>")
            .addClass("webapp-picker-field-display")
            .css({
                flex: "1 1 auto",
                "min-width": "0",
                overflow: "hidden",
                "text-overflow": "ellipsis",
                "white-space": "nowrap",
                color: "var(--red-ui-primary-text-color, #333)"
            });

        const $button = $("<button type=\"button\" class=\"red-ui-button webapp-picker-field-button\">")
            .text("Auswählen…")
            .css({ "flex": "0 0 auto" });

        const $clear = $("<button type=\"button\" class=\"red-ui-button webapp-picker-field-clear\">")
            .attr("title", "Auswahl entfernen")
            .html("<i class=\"fa fa-times\"></i>")
            .css({ "flex": "0 0 auto" });

        $field.after($wrap);
        $wrap.append($display).append($button);
        if (cfg.clearable) {
            $wrap.append($clear);
        }

        // Resolve the app context for scoping — either the explicit getter or
        // derived automatically from the live panel (P117 app-scope).
        // Returns null for the `apps` preset (never scoped).
        function resolveAppContext() {
            if (cfg.filterPreset === "apps") {
                return null;
            }
            if (typeof cfg.getAppId === "function") {
                return cfg.getAppId();
            }
            // Auto-derive: look at the live #node-input-parent or #node-input-mount
            // values to find the current app. We pass a minimal node proxy.
            const references = collectReferenceNodes();
            const nodeProxy = {};
            return resolveEditedNodeApp(nodeProxy, references);
        }

        // Resolve the current value's display label from the live preset entries.
        // Returns null when the value is non-empty but not present in the graph
        // (a deleted/non-resolvable reference) so the caller can mark it.
        // When app-scoped, fall back to unscoped lookup so existing values are
        // always displayable even if they're from another app.
        function labelForValue(value) {
            if (!value) {
                return "";
            }
            const appId = resolveAppContext();
            const context = appId ? { appId } : {};
            const scopedEntries = nodePickerOptionsForPreset(cfg.filterPreset, context);
            let match = scopedEntries.find(function (entry) { return entry.value === value; });
            if (!match && appId) {
                // Value not in scoped set — try unscoped so we can still display it.
                const allEntries = nodePickerOptionsForPreset(cfg.filterPreset);
                match = allEntries.find(function (entry) { return entry.value === value; });
            }
            return match ? (match.label || match.name || match.id) : null;
        }

        function refreshDisplay() {
            const value = String($field.val() || "");
            if (!value) {
                $display
                    .text(cfg.placeholder || "Auswählen…")
                    .css({ color: "var(--red-ui-secondary-text-color, #999)", "font-style": "italic" });
                if (cfg.clearable) {
                    $clear.hide();
                }
                return;
            }
            const label = labelForValue(value);
            const text = label === null ? value + " (bestehend)" : label;
            $display
                .text(text)
                .css({ color: "var(--red-ui-primary-text-color, #333)", "font-style": "normal" })
                .attr("title", text);
            if (cfg.clearable) {
                $clear.show();
            }
        }

        $button.on("click", function (event) {
            event.preventDefault();
            const appId = resolveAppContext();
            const context = appId ? { appId: appId } : {};
            openNodePickerDialog({
                title: cfg.title || "Knoten auswählen",
                value: String($field.val() || ""),
                entries: nodePickerOptionsForPreset(cfg.filterPreset, context),
                onSelect: function (value) {
                    setFieldValue(value);
                    $field.trigger("change");
                    refreshDisplay();
                }
            });
        });

        $clear.on("click", function (event) {
            event.preventDefault();
            setFieldValue("");
            $field.trigger("change");
            refreshDisplay();
        });

        // Keep the display in sync if the value changes by other means.
        $field.on("change.webappPickerField", refreshDisplay);
        refreshDisplay();
    }

    // P67: a custom Node-RED typedInput type for the new `store` binding kind.
    // Its `value` is the referenced ui-store node id; the expand button opens the
    // SAME P68 node-picker dialog (stores preset) used everywhere else — no second
    // picker. Reusable on every binding field (ui-alert message/title, …).
    function storeTypedInputType(options) {
        const opts = options || {};
        return {
            value: "store",
            label: opts.label || "Store",
            icon: "fa fa-database",
            hasValue: true,
            // Render the store id; the picker is the primary way to choose one.
            // P117: resolve the app context from the live panel so the dialog
            // scopes to the stores of the currently-selected app.
            expand: function () {
                const that = this;
                const references = collectReferenceNodes();
                const appId = resolveEditedNodeApp({}, references);
                const context = appId ? { appId: appId } : {};
                openNodePickerDialog({
                    title: opts.pickerTitle || "Store auswählen",
                    value: String(that.value() || ""),
                    entries: nodePickerOptionsForPreset("stores", context),
                    onSelect: function (value) {
                        that.value(value);
                    }
                });
            }
        };
    }

    // P70: a custom typedInput type for a managed media asset. Its stored value is
    // a bare asset id; the serialized binding is a literal `asset:<id>`. The expand
    // button opens the media-picker dialog (browse/upload). Used on ui-image src.
    function assetTypedInputType(options) {
        const opts = options || {};
        return {
            value: "asset",
            label: opts.label || "Asset",
            icon: "fa fa-image",
            hasValue: true,
            expand: function () {
                const that = this;
                openMediaPickerDialog({
                    title: opts.pickerTitle || "Asset auswählen",
                    appId: typeof opts.appId === "function" ? opts.appId() : opts.appId,
                    value: String(that.value() || ""),
                    onSelect: function (value) {
                        that.value(value);
                    }
                });
            }
        };
    }

    // P67: the full typedInput `types` array for a bindable value field — the
    // canonical ui-text type set PLUS the `store` type. literal label is
    // configurable (e.g. "Text", "Message", "Title"). P70: pass
    // `includeAsset: true` (and optionally `appId`) to add the media-asset type.
    function bindingTypedInputTypes(options) {
        const opts = options || {};
        const assetTypes = opts.includeAsset
            ? [assetTypedInputType({ appId: opts.appId })]
            : [];
        return [
            { value: "literal", label: opts.literalLabel || "Text", icon: "fa fa-font", hasValue: true },
            ...assetTypes,
            { value: "state", label: "State", icon: "fa fa-database", hasValue: true },
            {
                value: "query",
                label: "Query",
                icon: "fa fa-search",
                hasValue: true,
                validate: function (value) {
                    if (!value || value.trim().length === 0) {
                        return false;
                    }
                    return /^[a-zA-Z_$][a-zA-Z0-9_$]*(\.[a-zA-Z_$][a-zA-Z0-9_$]*|\[\d+\])*$/.test(value.trim());
                }
            },
            { value: "routeParam", label: "Route Param", icon: "fa fa-map-signs", hasValue: true },
            storeTypedInputType({ label: "Store" }),
            "msg",
            "flow",
            "global",
            "jsonata",
            "env"
        ];
    }

    function isStandardLayoutPreset(value) {
        return standardLayoutPresetOptions.some(function (option) {
            return option.value === value;
        });
    }

    function getStandardLayoutPresetOptions() {
        return standardLayoutPresetOptions.map(function (option) {
            return { ...option };
        });
    }

    function getSlotNamesForLayout(layoutId) {
        if (isStandardLayoutPreset(layoutId)) {
            return [...standardLayoutPresetSlots[layoutId]];
        }

        return [];
    }

    function setSelectOptions(selector, options, currentValue, placeholder) {
        const input = $(selector);

        if (!input.length) {
            return;
        }

        const normalizedCurrentValue = currentValue ? String(currentValue) : "";
        const uniqueOptions = [];
        const seenValues = new Set();

        for (const option of options) {
            if (!option.value || seenValues.has(option.value)) {
                continue;
            }

            seenValues.add(option.value);
            uniqueOptions.push(option);
        }

        const sortedOptions = sortOptions(uniqueOptions);

        input.empty();
        input.append($("<option></option>").attr("value", "").text(placeholder || ""));

        for (const option of sortedOptions) {
            input.append($("<option></option>").attr("value", option.value).text(option.label));
        }

        if (normalizedCurrentValue && !seenValues.has(normalizedCurrentValue)) {
            input.append(
                $("<option></option>")
                    .attr("value", normalizedCurrentValue)
                    .text(`${normalizedCurrentValue} (bestehend)`)
            );
        }

        input.val(normalizedCurrentValue);
    }

    function buildMountOptionsTree(references) {
        const apps = references.apps;
        const routes = references.routes;
        const dialogs = references.dialogs;
        const containers = references.containers;
        const visitedContainers = new Set();

        function slotOptions(mountValue, breadcrumb) {
            const options = [{ value: mountValue, label: breadcrumb }];

            for (const child of containers.filter(function (c) {
                return c.mount === mountValue && !visitedContainers.has(c.id);
            })) {
                visitedContainers.add(child.id);
                const childSlots = getSlotNamesForLayout(child.layoutId);
                const childName = child.title || child.id;

                for (const slot of childSlots) {
                    const childLabel = childSlots.length > 1
                        ? `${breadcrumb} > ${childName} > ${slot}`
                        : `${breadcrumb} > ${childName}`;
                    options.push.apply(options, slotOptions(`container:${child.id}/${slot}`, childLabel));
                }
            }

            return options;
        }

        const groups = [];

        for (const app of apps) {
            const appLabel = app.title || app.id;
            const groupOptions = [];
            const appSlots = getSlotNamesForLayout(app.layoutId);
            const appRoutes = routes.filter(function (r) { return r.parent === app.id; });
            const appDialogs = dialogs.filter(function (d) { return d.parent === app.id; });

            // P114 / ADR 0009: breadcrumbs are now self-describing (the flattened
            // `mounts` picker has no group headers to carry context), so each
            // app/route/dialog slot label includes the full path, e.g.
            // "Shop > /customers > content".
            if (appSlots.length > 0) {
                groupOptions.push({ disabled: true, label: "Slots" });
                for (const slot of appSlots) {
                    groupOptions.push.apply(groupOptions, slotOptions(`${app.id}.${slot}`, `${appLabel} > ${slot}`));
                }
            }

            if (appRoutes.length > 0) {
                groupOptions.push({ disabled: true, label: "Routes" });
                for (const route of appRoutes) {
                    const routeSlots = getSlotNamesForLayout(route.layoutId);
                    if (routeSlots.length === 0) continue;
                    const routeLabel = route.title || route.path || route.id;
                    groupOptions.push({ disabled: true, label: routeLabel });
                    for (const slot of routeSlots) {
                        groupOptions.push.apply(groupOptions, slotOptions(`route:${route.path}/${slot}`, `${appLabel} > ${routeLabel} > ${slot}`));
                    }
                }
            }

            if (appDialogs.length > 0) {
                groupOptions.push({ disabled: true, label: "Dialoge" });
                for (const dialog of appDialogs) {
                    const dialogSlots = getSlotNamesForLayout(dialog.layoutId);
                    if (dialogSlots.length === 0) continue;
                    const dialogLabel = dialog.title || dialog.id;
                    groupOptions.push({ disabled: true, label: dialogLabel });
                    for (const slot of dialogSlots) {
                        groupOptions.push.apply(groupOptions, slotOptions(`dialog:${dialog.id}/${slot}`, `${appLabel} > ${dialogLabel} > ${slot}`));
                    }
                }
            }

            if (groupOptions.length > 0) {
                groups.push({ label: appLabel, options: groupOptions });
            }
        }

        // Orphaned routes/dialogs (no known parent app)
        const orphanOptions = [];

        for (const route of routes) {
            if (route.parent && apps.some(function (a) { return a.id === route.parent; })) continue;
            for (const slot of getSlotNamesForLayout(route.layoutId)) {
                orphanOptions.push.apply(orphanOptions, slotOptions(
                    `route:${route.path}/${slot}`,
                    `${route.title || route.path} > ${slot}`
                ));
            }
        }

        for (const dialog of dialogs) {
            if (dialog.parent && apps.some(function (a) { return a.id === dialog.parent; })) continue;
            for (const slot of getSlotNamesForLayout(dialog.layoutId)) {
                orphanOptions.push.apply(orphanOptions, slotOptions(
                    `dialog:${dialog.id}/${slot}`,
                    `${dialog.title || dialog.id} > ${slot}`
                ));
            }
        }

        if (orphanOptions.length > 0) {
            groups.push({ label: "Weitere", options: orphanOptions });
        }

        return groups;
    }

    function getMountLayoutId(mountValue, references) {
        if (!mountValue) {
            return "";
        }

        if (mountValue.startsWith("route:")) {
            const separatorIndex = mountValue.lastIndexOf("/");
            const routePath = separatorIndex >= 0 ? mountValue.slice("route:".length, separatorIndex) : "";
            const route = references.routes.find(function (entry) {
                return entry.path === routePath;
            });
            return route ? route.layoutId || "" : "";
        }

        if (mountValue.startsWith("dialog:")) {
            const separatorIndex = mountValue.lastIndexOf("/");
            const dialogId = separatorIndex >= 0 ? mountValue.slice("dialog:".length, separatorIndex) : "";
            const dialog = references.dialogs.find(function (entry) {
                return entry.id === dialogId;
            });
            return dialog ? dialog.layoutId || "" : "";
        }

        if (mountValue.startsWith("container:")) {
            const separatorIndex = mountValue.lastIndexOf("/");
            const containerId = separatorIndex >= 0 ? mountValue.slice("container:".length, separatorIndex) : "";
            const container = references.containers.find(function (entry) {
                return entry.id === containerId;
            });
            return container ? container.layoutId || "" : "";
        }

        if (mountValue.startsWith("layout:")) {
            const separatorIndex = mountValue.lastIndexOf("/");
            return separatorIndex >= 0 ? mountValue.slice("layout:".length, separatorIndex) : "";
        }

        const separatorIndex = mountValue.indexOf(".");
        const appId = separatorIndex >= 0 ? mountValue.slice(0, separatorIndex) : mountValue;
        const app = references.apps.find(function (entry) {
            return entry.id === appId;
        });
        return app ? app.layoutId || "" : "";
    }

    function installLayoutChildPropRows() {
        return function () {
            const self = this;
            // Inject the shared placement rows into this panel (idempotent). The
            // markup used to live in each node's template; it now comes from the
            // central field group so editing it happens in one place.
            injectPlacementRows();

            // Node-RED binds `defaults` fields to their `#node-input-*` inputs
            // when it builds the edit form — which is BEFORE oneditprepare runs,
            // and therefore before these inputs exist. Bind the values manually
            // from the node config so the panel shows the stored values, and
            // write them back on save so the deployed config is unchanged.
            placementRowFields.forEach(function (field) {
                const input = $("#node-input-" + field.id);
                if (input.length) {
                    const stored = self[field.id];
                    input.val(stored === undefined || stored === null ? "" : stored);
                }
            });

            const mountInput = $("#node-input-mount");

            function refreshRows() {
                const references = collectReferenceNodes();
                const layoutId = getMountLayoutId(String(mountInput.val() || ""), references);
                const activeFields = new Set(layoutChildFieldsByVariant[layoutId] || []);

                $("[data-layout-child-prop-row]").each(function () {
                    const row = $(this);
                    const field = String(row.attr("data-layout-child-prop-row") || "");
                    row.toggle(activeFields.has(field));
                });
            }

            refreshRows();
            mountInput.on("change", refreshRows);
        };
    }

    function getNextNameDefault(nodeType, prefix) {
        let count = 0;
        RED.nodes.eachNode(function (node) {
            if (node.type === nodeType) {
                count += 1;
            }
        });
        return `${prefix} ${count + 1}`;
    }

    function installParentAppSelector() {
        return function () {
            const self = this;
            // The bound #node-input-parent stays the value carrier. The template
            // ships an option-less <select>, so seed the stored value (falling
            // back to the node's own id, the legacy default) into the picker.
            installPickerField("#node-input-parent", {
                filterPreset: "apps",
                title: "App auswählen",
                placeholder: "App auswählen",
                seedValue: self.parent || self.id || ""
            });
        };
    }

    function installReferenceSelectors(config) {
        return function () {
            const self = this;

            // ADR 0009: every reference field is the dialog-only picker pattern
            // (read-only display + "Auswählen…" button). The bound #node-input-*
            // element stays as the hidden value carrier; we seed it from any
            // legacy alias the field still uses before installing the picker.

            // P117: derive app context lazily so it reflects the live panel state
            // at the moment the picker opens (not at installPickerField time).
            function getAppId() {
                const references = collectReferenceNodes();
                return resolveEditedNodeApp(self, references);
            }

            if (config.layout) {
                installPickerField("#node-input-layoutId", {
                    filterPreset: "layouts",
                    title: "Layout auswählen",
                    placeholder: "Parent-Layout auswählen",
                    seedValue: self.layoutId || ""
                });
            }

            if (config.route) {
                installPickerField("#node-input-routeId", {
                    filterPreset: "routes",
                    title: "Route auswählen",
                    placeholder: "Optional: Parent-Route auswählen",
                    clearable: true,
                    seedValue: self.routeId || "",
                    getAppId: getAppId
                });
            }

            if (config.mount) {
                installPickerField("#node-input-mount", {
                    filterPreset: "mounts",
                    title: "Parent-Slot auswählen",
                    placeholder: "Parent-Slot auswählen",
                    seedValue: self.mount || "",
                    getAppId: getAppId
                });
            }

            if (config.action) {
                installPickerField(config.action, {
                    filterPreset: "actions",
                    title: "Action auswählen",
                    placeholder: "Action auswählen",
                    seedValue: self.action || self.selectAction || self.refreshAction || "",
                    getAppId: getAppId
                });
            }

            if (config.store) {
                const storeSelector = typeof config.store === "string" && config.store.startsWith("#")
                    ? config.store
                    : "#node-input-storeId";
                installPickerField(storeSelector, {
                    filterPreset: "stores",
                    title: "Store auswählen",
                    placeholder: "Optional: Store auswählen",
                    clearable: true,
                    seedValue: self.storeId || self.params || "",
                    getAppId: getAppId
                });
            }
        };
    }

    function installLayoutSelector(config) {
        return function () {
            const presetSelector = $(config.presetSelector);
            const valueInput = $(config.valueSelector);
            const currentValue = String(valueInput.val() || config.getValue.call(this) || "").trim();

            setSelectOptions(
                presetSelector,
                getStandardLayoutPresetOptions(),
                isStandardLayoutPreset(currentValue) ? currentValue : standardLayoutPresetOptions[0].value,
                config.presetPlaceholder || "Layout auswaehlen"
            );

            function syncLayoutValue() {
                const presetValue = String(presetSelector.val() || standardLayoutPresetOptions[0].value);
                valueInput.val(presetValue);
            }

            syncLayoutValue();
            presetSelector.on("change", syncLayoutValue);
        };
    }

    function installEventCheckboxes(availableEvents) {
        return function () {
            const self = this;
            let activeEvents;

            try {
                activeEvents = Array.isArray(self.events) ? self.events : JSON.parse(self.events || "[]");
            }
            catch (_e) {
                activeEvents = [];
            }

            const container = $("#node-input-events-container");

            if (!container.length) {
                return;
            }

            container.empty();

            availableEvents.forEach(function (eventName) {
                const checked = activeEvents.includes(eventName) ? "checked" : "";
                const id = `node-event-checkbox-${eventName}`;
                const row = $(`
                    <div class="form-row" style="display:flex;align-items:center;gap:8px;">
                        <input type="checkbox" id="${id}" data-event="${eventName}" ${checked} style="width:auto;margin:0;">
                        <label for="${id}" style="width:auto;margin:0;">${eventName}</label>
                    </div>
                `);

                container.append(row);
            });
        };
    }

    function collectEventCheckboxValues() {
        const checked = [];

        $("#node-input-events-container input[type=checkbox]").each(function () {
            if ($(this).is(":checked")) {
                checked.push($(this).data("event"));
            }
        });

        return checked;
    }

    function withEventOutputs(definition, availableEvents) {
        const base = withUiIdMigration(definition);
        const originalPrepare = base.oneditprepare;
        const originalSave = base.oneditsave;

        return {
            ...base,
            oneditprepare: function () {
                if (originalPrepare) {
                    originalPrepare.call(this);
                }

                installEventCheckboxes(availableEvents).call(this);
            },
            oneditsave: function () {
                const events = collectEventCheckboxValues();
                const eventsJson = JSON.stringify(events);
                $("#node-input-events").val(eventsJson);
                $("#node-input-outputs").val(events.length);
                this.events = eventsJson;
                this.outputs = events.length;

                if (originalSave) {
                    originalSave.call(this);
                }
            }
        };
    }

    // P60 / ADR 0007 §3: multi-select canvas node picker built on Node-RED's
    // RED.view.selectNodes() — the same canvas-pick API the core catch / status /
    // complete nodes use for scope. Stores a LIST of picked node ids in a hidden
    // input as a JSON array. Used by ui-action for the optional "wireless" target
    // path (wiring the output port stays the primary path).
    //
    // options:
    //   fieldId          — hidden input id holding the JSON list (default "node-input-targets")
    //   listContainerId  — id of the <div> that renders the picked-node chips
    //   buttonId         — id of the "pick on canvas" <button>
    //   nodeTypes        — array of node types the picker accepts (filter); other
    //                      types are not selectable. Defaults to all webapp ui-*
    //                      interaction-capable types.
    function installNodePicker(options) {
        const opts = options || {};
        const fieldSelector = "#" + (opts.fieldId || "node-input-targets");
        const listSelector = "#" + (opts.listContainerId || "node-input-targets-list");
        const buttonSelector = "#" + (opts.buttonId || "node-input-targets-pick");
        const acceptedTypes = Array.isArray(opts.nodeTypes) && opts.nodeTypes.length > 0
            ? opts.nodeTypes
            : null;

        function isAcceptedType(type) {
            if (acceptedTypes) {
                return acceptedTypes.indexOf(type) !== -1;
            }
            // Default filter: interaction-capable webapp nodes only — the ui-app /
            // ui-route navigation owners and every ui-* view/structure node. The
            // emitter (ui-action) itself and non-webapp nodes are excluded.
            return typeof type === "string"
                && type.indexOf("ui-") === 0
                && type !== "ui-action"
                && type !== "ui-navigation";
        }

        function nodeLabel(node) {
            if (!node) {
                return "";
            }
            const name = node.name && String(node.name).trim().length > 0 ? node.name : null;
            return (name || node.type || node.id) + " (" + node.type + ")";
        }

        function readIds() {
            let raw = $(fieldSelector).val();
            if (Array.isArray(raw)) {
                return raw.slice();
            }
            if (typeof raw !== "string" || raw.trim().length === 0) {
                return [];
            }
            try {
                const parsed = JSON.parse(raw);
                return Array.isArray(parsed) ? parsed : [];
            }
            catch (_e) {
                return [];
            }
        }

        function writeIds(ids) {
            const deduped = ids.filter(function (id, index) {
                return typeof id === "string" && id && ids.indexOf(id) === index;
            });
            $(fieldSelector).val(JSON.stringify(deduped));
            renderList(deduped);
        }

        function renderList(ids) {
            const $list = $(listSelector);
            if ($list.length === 0) {
                return;
            }
            $list.empty();
            if (!ids || ids.length === 0) {
                $list.append(
                    $("<div>").css({ color: "#999", "font-style": "italic", padding: "2px 0" })
                        .text("Kein Ziel gewählt — Output-Port verdrahten oder Knoten wählen.")
                );
                return;
            }
            ids.forEach(function (id) {
                const node = RED.nodes.node(id);
                const $chip = $("<div>").css({
                    display: "flex",
                    "align-items": "center",
                    "justify-content": "space-between",
                    padding: "2px 0"
                });
                $("<span>").text(node ? nodeLabel(node) : id + " (entfernt?)").appendTo($chip);
                const $remove = $("<button type=\"button\" class=\"red-ui-button red-ui-button-small\">")
                    .html("<i class=\"fa fa-remove\"></i>")
                    .appendTo($chip);
                $remove.on("click", function (event) {
                    event.preventDefault();
                    writeIds(readIds().filter(function (existing) { return existing !== id; }));
                });
                $list.append($chip);
            });
        }

        function pickFromCanvas() {
            if (!RED.view || typeof RED.view.selectNodes !== "function") {
                return;
            }
            RED.view.selectNodes({
                single: false,
                filter: function (node) {
                    return isAcceptedType(node.type);
                },
                done: function (selection) {
                    if (!selection) {
                        return;
                    }
                    const picked = Array.isArray(selection) ? selection : [selection];
                    const next = readIds();
                    picked.forEach(function (node) {
                        if (node && node.id && isAcceptedType(node.type)) {
                            next.push(node.id);
                        }
                    });
                    writeIds(next);
                }
            });
        }

        return function () {
            $(buttonSelector).on("click", function (event) {
                event.preventDefault();
                pickFromCanvas();
            });
            renderList(readIds());
        };
    }

    function registerNodeType(type, definition) {
        RED.nodes.registerType(type, withUiIdMigration(definition));
    }

    function registerNodeTypeWithEvents(type, definition, availableEvents) {
        RED.nodes.registerType(type, withEventOutputs(definition, availableEvents));
    }

    // ── P69: Icon picker ────────────────────────────────────────────────────
    // The icon field stores a backend-neutral value as a string: a bare icon
    // name (default library) or the "library:name" shorthand. The picker reuses
    // the P68 dialog chrome and adds an icon preview grid, a contains-search over
    // the icon name, and a library filter. Default-library previews use the
    // vendored Bootstrap SVGs served statically; other libraries fall back to a
    // name-only tile when no basePath is known.

    const ICON_DEFAULT_LIBRARY = "default";
    const ICON_MANIFEST_URL = "webapp/icons/manifest";
    const ICON_DEFAULT_BASE_PATH = "resources/node-red-contrib-webapp/shoelace/assets/icons";
    let iconManifestCache = null;

    // Parse a stored icon string into { library, name }. Empty → null.
    function parseIconValue(value) {
        if (value === undefined || value === null) {
            return null;
        }
        const text = String(value).trim();
        if (text.length === 0) {
            return null;
        }
        const sep = text.indexOf(":");
        if (sep > 0 && sep < text.length - 1) {
            return { library: text.slice(0, sep), name: text.slice(sep + 1) };
        }
        return { library: ICON_DEFAULT_LIBRARY, name: text };
    }

    // Serialise { library, name } back to the stored string form.
    function formatIconValue(parsed) {
        if (!parsed || !parsed.name) {
            return "";
        }
        if (!parsed.library || parsed.library === ICON_DEFAULT_LIBRARY) {
            return parsed.name;
        }
        return parsed.library + ":" + parsed.name;
    }

    function iconPreviewUrl(library, name, basePaths) {
        const base = (library && basePaths && basePaths[library])
            ? basePaths[library]
            : (library === ICON_DEFAULT_LIBRARY || !library ? ICON_DEFAULT_BASE_PATH : null);
        return base ? (base + "/" + name + ".svg") : null;
    }

    function loadIconManifest(callback) {
        if (iconManifestCache) {
            callback(iconManifestCache);
            return;
        }
        $.getJSON(ICON_MANIFEST_URL).done(function (data) {
            iconManifestCache = (data && Array.isArray(data.libraries)) ? data : { libraries: [] };
            callback(iconManifestCache);
        }).fail(function () {
            callback({ libraries: [] });
        });
    }

    function openIconPickerDialog(options) {
        ensurePickerStylesheet();

        const opts = options || {};
        const current = parseIconValue(opts.value);

        const $overlay = $("<div>")
            .addClass("webapp-icon-picker-overlay webapp-node-picker-overlay");

        const $dialog = $("<div>")
            .addClass("webapp-icon-picker-dialog webapp-node-picker-dialog")
            .css({ width: "520px", "max-width": "92vw", "max-height": "82vh" })
            .appendTo($overlay);

        $("<div>")
            .addClass("webapp-node-picker-header")
            .text(opts.title || "Icon auswählen")
            .appendTo($dialog);

        const $controls = $("<div>")
            .addClass("webapp-node-picker-search-wrap")
            .appendTo($dialog);
        const $libFilter = $("<select>").addClass("webapp-icon-picker-lib").css({ "flex": "0 0 auto" }).appendTo($controls);
        const $search = $("<input type=\"text\">")
            .attr("placeholder", "Suche (Icon-Name)…")
            .addClass("webapp-icon-picker-search webapp-node-picker-search")
            .css({ flex: "1 1 auto" })
            .appendTo($controls);

        const $grid = $("<div>")
            .addClass("webapp-icon-picker-grid")
            .css({ flex: "1 1 auto", "overflow-y": "auto", "min-height": "160px", padding: "6px", display: "grid", "grid-template-columns": "repeat(auto-fill, minmax(72px, 1fr))", gap: "4px" })
            .appendTo($dialog);

        const $footer = $("<div>")
            .addClass("webapp-node-picker-footer")
            .appendTo($dialog);

        function close() {
            $overlay.remove();
            $(document).off("keydown.webappIconPicker");
        }
        function confirm(value) {
            close();
            if (typeof opts.onSelect === "function") {
                opts.onSelect(value);
            }
        }

        const $clearBtn = $("<button type=\"button\" class=\"red-ui-button\">").text("Leeren").css({ "margin-right": "6px" }).on("click", function (e) { e.preventDefault(); confirm(""); });
        const $cancelBtn = $("<button type=\"button\" class=\"red-ui-button\">").text("Abbrechen").on("click", function (e) { e.preventDefault(); close(); });
        $footer.append($clearBtn).append($cancelBtn);

        let manifest = { libraries: [] };
        const basePaths = {};

        function renderGrid() {
            const lib = String($libFilter.val() || "");
            const query = String($search.val() || "").toLowerCase();
            $grid.empty();
            const libs = manifest.libraries.filter(function (l) { return !lib || l.name === lib; });
            let shown = 0;
            const MAX = 600; // cap rendered tiles for performance with 2000+ icons
            for (let li = 0; li < libs.length && shown < MAX; li++) {
                const libEntry = libs[li];
                const names = Array.isArray(libEntry.icons) ? libEntry.icons : [];
                for (let ni = 0; ni < names.length && shown < MAX; ni++) {
                    const name = names[ni];
                    if (query && name.toLowerCase().indexOf(query) === -1) {
                        continue;
                    }
                    shown++;
                    const isSelected = current && current.library === libEntry.name && current.name === name;
                    const $tile = $("<div>")
                        .addClass("webapp-icon-picker-tile")
                        .attr("data-icon-name", name)
                        .attr("data-icon-library", libEntry.name)
                        .attr("title", libEntry.name + ":" + name)
                        .css({ display: "flex", "flex-direction": "column", "align-items": "center", "justify-content": "center", padding: "6px 2px", cursor: "pointer", "border-radius": "3px", "text-align": "center", background: isSelected ? "var(--red-ui-list-item-background-selected, #efe)" : "transparent" });
                    const url = iconPreviewUrl(libEntry.name, name, basePaths);
                    if (url) {
                        $("<img>").attr("src", url).attr("alt", name).css({ width: "22px", height: "22px" }).appendTo($tile);
                    }
                    else {
                        $("<div>").css({ width: "22px", height: "22px", "line-height": "22px" }).text("?").appendTo($tile);
                    }
                    $("<div>").addClass("webapp-node-picker-row-secondary").css({ "font-size": "0.66em", "margin-top": "2px", "word-break": "break-all" }).text(name).appendTo($tile);
                    $tile.on("click", function () {
                        confirm(formatIconValue({ library: libEntry.name, name: name }));
                    });
                    $grid.append($tile);
                }
            }
            if (shown === 0) {
                $("<div>").addClass("webapp-node-picker-empty").css({ "grid-column": "1 / -1" }).text("Keine Treffer.").appendTo($grid);
            }
            else if (shown >= MAX) {
                $("<div>").addClass("webapp-node-picker-row-secondary").css({ padding: "6px", "grid-column": "1 / -1" }).text("… weiter eingrenzen (Suche), um mehr zu sehen.").appendTo($grid);
            }
        }

        loadIconManifest(function (data) {
            manifest = data;
            $libFilter.append($("<option>").attr("value", "").text("Alle Libraries"));
            manifest.libraries.forEach(function (l) {
                $libFilter.append($("<option>").attr("value", l.name).text(l.name));
                if (l.basePath) {
                    basePaths[l.name] = l.basePath;
                }
            });
            if (current) {
                $libFilter.val(current.library);
                $search.val(current.name);
            }
            renderGrid();
        });

        $libFilter.on("change", renderGrid);
        $search.on("input", renderGrid);
        $overlay.on("click", function (e) { if (e.target === $overlay[0]) { close(); } });
        $(document).on("keydown.webappIconPicker", function (e) { if (e.key === "Escape") { close(); } });

        $("body").append($overlay);
        $search.trigger("focus");
        return { close: close };
    }

    // Enhance a text input (#node-input-<field>) with an "Icon wählen…" button +
    // a small live preview. Stores the chosen value ("name" or "library:name")
    // back into the input and fires change.
    function installIconField(fieldSelector, config) {
        const cfg = config || {};
        const $input = $(fieldSelector);
        if ($input.length === 0 || $input.data("webappIconFieldEnhanced")) {
            return;
        }
        $input.data("webappIconFieldEnhanced", true);

        const $preview = $("<img class=\"webapp-icon-field-preview\">").css({ width: "20px", height: "20px", "vertical-align": "middle", "margin-right": "6px" }).hide();
        const $button = $("<button type=\"button\" class=\"red-ui-button webapp-icon-field-button\">").text("Icon wählen…").css({ "margin-left": "6px" });

        $input.before($preview);
        $input.after($button);

        function refreshPreview() {
            const parsed = parseIconValue($input.val());
            if (!parsed) {
                $preview.hide();
                return;
            }
            const url = iconPreviewUrl(parsed.library, parsed.name, {});
            if (url) {
                $preview.attr("src", url).attr("alt", parsed.name).show();
            }
            else {
                $preview.hide();
            }
        }

        $button.on("click", function (e) {
            e.preventDefault();
            openIconPickerDialog({
                title: cfg.title || "Icon auswählen",
                value: $input.val(),
                onSelect: function (value) {
                    $input.val(value).trigger("change");
                    refreshPreview();
                }
            });
        });
        $input.on("change input", refreshPreview);
        refreshPreview();
    }

    // ── P70: Media (asset) picker ─────────────────────────────────────────────
    // Browse + upload assets from the app's configured media store. Reuses the
    // P68/P69 dialog chrome. The store URL is never exposed to the editor — the
    // admin endpoint /webapp/<appId>/assets proxies the listing, and previews/
    // uploads go through the same app-scoped backend. Stores a bare asset id; the
    // asset typedInput serializes it as a literal `asset:<id>`.
    function mediaAssetsUrl(appId) {
        return "webapp/" + encodeURIComponent(appId || "") + "/assets";
    }

    function assetPreviewUrl(appId, id) {
        return "webapp/" + encodeURIComponent(appId || "") + "/asset/" + encodeURIComponent(id);
    }

    function openMediaPickerDialog(options) {
        ensurePickerStylesheet();

        const opts = options || {};
        const appId = opts.appId || "";
        const current = String(opts.value || "");

        const $overlay = $("<div>")
            .addClass("webapp-media-picker-overlay webapp-node-picker-overlay");

        const $dialog = $("<div>")
            .addClass("webapp-media-picker-dialog webapp-node-picker-dialog")
            .css({ width: "560px", "max-width": "92vw", "max-height": "82vh" })
            .appendTo($overlay);

        $("<div>")
            .addClass("webapp-node-picker-header")
            .text(opts.title || "Asset auswählen")
            .appendTo($dialog);

        const $controls = $("<div>").addClass("webapp-node-picker-search-wrap").appendTo($dialog);
        const $search = $("<input type=\"text\">")
            .attr("placeholder", "Suche (Asset-Name)…")
            .addClass("webapp-media-picker-search webapp-node-picker-search")
            .css({ flex: "1 1 auto" })
            .appendTo($controls);
        const $uploadBtn = $("<button type=\"button\" class=\"red-ui-button\">").text("Hochladen…").appendTo($controls);
        const $uploadInput = $("<input type=\"file\" accept=\"image/*\">").css({ display: "none" }).appendTo($controls);

        const $grid = $("<div>")
            .addClass("webapp-media-picker-grid")
            .css({ flex: "1 1 auto", "overflow-y": "auto", "min-height": "160px", padding: "6px", display: "grid", "grid-template-columns": "repeat(auto-fill, minmax(96px, 1fr))", gap: "6px" })
            .appendTo($dialog);

        const $status = $("<div>").addClass("webapp-node-picker-row-secondary").css({ padding: "4px 12px" }).appendTo($dialog);

        const $footer = $("<div>").addClass("webapp-node-picker-footer").appendTo($dialog);

        function close() {
            $overlay.remove();
            $(document).off("keydown.webappMediaPicker");
        }
        function confirm(id) {
            close();
            if (typeof opts.onSelect === "function") {
                opts.onSelect(id ? "asset:" + id : "");
            }
        }

        $("<button type=\"button\" class=\"red-ui-button\">").text("Leeren").css({ "margin-right": "6px" }).on("click", function (e) { e.preventDefault(); confirm(""); }).appendTo($footer);
        $("<button type=\"button\" class=\"red-ui-button\">").text("Abbrechen").on("click", function (e) { e.preventDefault(); close(); }).appendTo($footer);

        let assets = [];

        function renderGrid() {
            const query = String($search.val() || "").toLowerCase();
            $grid.empty();
            const matches = assets.filter(function (a) {
                const name = String(a.name || a.id || "");
                return !query || name.toLowerCase().indexOf(query) !== -1;
            });
            if (matches.length === 0) {
                $("<div>").addClass("webapp-node-picker-empty").css({ "grid-column": "1 / -1" }).text("Keine Assets.").appendTo($grid);
                return;
            }
            matches.forEach(function (a) {
                const id = String(a.id);
                const name = String(a.name || id);
                const isSelected = current === ("asset:" + id) || current === id;
                const $tile = $("<div>")
                    .addClass("webapp-media-picker-tile")
                    .attr("data-asset-id", id)
                    .attr("title", name)
                    .css({ display: "flex", "flex-direction": "column", "align-items": "center", "justify-content": "center", padding: "6px 2px", cursor: "pointer", "border-radius": "3px", "text-align": "center", border: isSelected ? "2px solid var(--red-ui-text-color-link, #4a8)" : "1px solid var(--red-ui-secondary-border-color, #ddd)" });
                $("<img>").attr("src", assetPreviewUrl(appId, id)).attr("alt", name).css({ width: "64px", height: "64px", "object-fit": "cover" }).appendTo($tile);
                $("<div>").addClass("webapp-node-picker-row-secondary").css({ "font-size": "0.7em", "margin-top": "3px", "word-break": "break-all" }).text(name).appendTo($tile);
                $tile.on("click", function () { confirm(id); });
                $grid.append($tile);
            });
        }

        function loadAssets() {
            $status.text("Lade Assets…");
            $.getJSON(mediaAssetsUrl(appId)).done(function (data) {
                assets = (data && Array.isArray(data.assets)) ? data.assets : [];
                if (data && data.mediaStoreConfigured === false) {
                    $status.text("Kein Media-Store an der App (ui-app.mediaStoreUrl) konfiguriert.");
                }
                else {
                    $status.text(assets.length + " Asset(s)");
                }
                renderGrid();
            }).fail(function () {
                $status.text("Asset-Liste konnte nicht geladen werden.");
                assets = [];
                renderGrid();
            });
        }

        $uploadBtn.on("click", function (e) { e.preventDefault(); $uploadInput.trigger("click"); });
        $uploadInput.on("change", function () {
            const file = this.files && this.files[0];
            if (!file) {
                return;
            }
            $status.text("Lade hoch: " + file.name + "…");
            // P70: raw binary upload — Node-RED proxies it to the store without a
            // multipart parser. Filename travels in X-Asset-Name.
            $.ajax({
                url: mediaAssetsUrl(appId),
                method: "POST",
                data: file,
                processData: false,
                contentType: file.type || "application/octet-stream",
                headers: { "X-Asset-Name": file.name }
            })
                .done(function (res) {
                    const id = res && res.id ? String(res.id) : "";
                    if (id) {
                        confirm(id);
                    }
                    else {
                        $status.text("Upload fehlgeschlagen (keine Asset-ID zurück).");
                        loadAssets();
                    }
                })
                .fail(function () {
                    $status.text("Upload fehlgeschlagen.");
                });
        });

        $search.on("input", renderGrid);
        $overlay.on("click", function (e) { if (e.target === $overlay[0]) { close(); } });
        $(document).on("keydown.webappMediaPicker", function (e) { if (e.key === "Escape") { close(); } });

        $("body").append($overlay);
        loadAssets();
        $search.trigger("focus");
        return { close: close };
    }

    global.WebappEditorCommon = {
        assetTypedInputType,
        bindingTypedInputTypes,
        bindingValueForEditor,
        buildMountOptionsTree,
        flattenMountOptionTree,
        collectEventCheckboxValues,
        injectFieldGroup,
        getNextNameDefault,
        getStandardLayoutPresetOptions,
        installEventCheckboxes,
        installLayoutChildPropRows,
        installIconField,
        installLayoutSelector,
        installNodePicker,
        installParentAppSelector,
        installPickerField,
        isMountUnderApp,
        openIconPickerDialog,
        openMediaPickerDialog,
        parseIconValue,
        formatIconValue,
        installReferenceSelectors,
        installSizeSelectBox,
        installTextStyleSelectBox,
        installButtonLinkFields,
        installVariantSelectBox,
        isStandardLayoutPreset,
        labelWithName,
        nodePickerMatch,
        nodePickerOptionsForPreset,
        nodePickerPresets,
        openNodePickerDialog,
        parseBindingValue,
        registerNodeType,
        registerNodeTypeWithEvents,
        required,
        resolveEditedNodeApp,
        resolveAppFromMount,
        storeTypedInputType
    };
})(window);

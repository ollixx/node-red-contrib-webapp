(function (global) {
    "use strict";

    const standardLayoutPresetOptions = [
        { value: "vertical", label: "Vertical" },
        { value: "horizontal", label: "Horizontal" },
        { value: "app", label: "App" },
        { value: "grid", label: "Grid" },
        { value: "absolute", label: "Absolute" }
    ];
    const standardLayoutPresetSlots = {
        vertical: ["content"],
        horizontal: ["content"],
        app: ["header", "navbar", "content", "footer"],
        grid: ["content"],
        absolute: ["content"]
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
        text: ["heading-1", "heading-2", "heading-3", "body", "caption", "label", "code", "muted"],
        container: ["card", "panel", "section", "transparent"],
        card: ["card", "panel", "section", "transparent"],
        input: ["default", "filled", "outlined"],
        badge: ["primary", "success", "warning", "danger", "neutral", "info"],
        alert: ["primary", "success", "warning", "danger", "neutral", "info"]
    };
    const COMPONENT_VARIANT_DEFAULT = {
        button: "neutral",
        text: "body",
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

        if (binding && ["state", "query", "routeParam", "msg", "flow", "global", "jsonata", "env"].includes(binding.kind)) {
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
                    to: node.to || ""
                });
                return;
            }

            if (node.type === "ui-store") {
                references.stores.push({
                    id,
                    statePath: node.statePath || ""
                });
            }
        });

        return references;
    }

    function sortOptions(options) {
        return [...options].sort(function (left, right) {
            return left.label.localeCompare(right.label, undefined, { sensitivity: "base" });
        });
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

            if (appSlots.length > 0) {
                groupOptions.push({ disabled: true, label: "Slots" });
                for (const slot of appSlots) {
                    groupOptions.push.apply(groupOptions, slotOptions(`${app.id}.${slot}`, slot));
                }
            }

            if (appRoutes.length > 0) {
                groupOptions.push({ disabled: true, label: "Routes" });
                for (const route of appRoutes) {
                    const routeSlots = getSlotNamesForLayout(route.layoutId);
                    if (routeSlots.length === 0) continue;
                    groupOptions.push({ disabled: true, label: route.title || route.path || route.id });
                    for (const slot of routeSlots) {
                        groupOptions.push.apply(groupOptions, slotOptions(`route:${route.path}/${slot}`, slot));
                    }
                }
            }

            if (appDialogs.length > 0) {
                groupOptions.push({ disabled: true, label: "Dialoge" });
                for (const dialog of appDialogs) {
                    const dialogSlots = getSlotNamesForLayout(dialog.layoutId);
                    if (dialogSlots.length === 0) continue;
                    groupOptions.push({ disabled: true, label: dialog.title || dialog.id });
                    for (const slot of dialogSlots) {
                        groupOptions.push.apply(groupOptions, slotOptions(`dialog:${dialog.id}/${slot}`, slot));
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

    function setSelectOptionsTree(selector, groups, currentValue) {
        const input = $(selector);

        if (!input.length) return;

        const normalizedCurrentValue = currentValue ? String(currentValue) : "";
        const seenValues = new Set();

        input.empty();
        input.append($("<option></option>").attr("value", "").text("Parent-Slot auswaehlen"));

        for (const group of groups) {
            const optgroup = $("<optgroup></optgroup>").attr("label", group.label);

            for (const option of group.options) {
                if (option.disabled) {
                    optgroup.append(
                        $("<option></option>").attr("disabled", true).text(option.label)
                    );
                } else {
                    if (seenValues.has(option.value)) continue;
                    seenValues.add(option.value);
                    optgroup.append(
                        $("<option></option>").attr("value", option.value).text(option.label)
                    );
                }
            }

            input.append(optgroup);
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

    function buildMountOptions(references) {
        const apps = references.apps;
        const routes = references.routes;
        const dialogs = references.dialogs;
        const containers = references.containers;

        const options = [];

        for (const app of apps) {
            const slotNames = getSlotNamesForLayout(app.layoutId);
            const appLabel = app.title || app.id;

            for (const slotName of slotNames) {
                options.push({
                    value: `${app.id}.${slotName}`,
                    label: `${appLabel} -> ${slotName}`
                });
            }
        }

        for (const route of routes) {
            const slotNames = getSlotNamesForLayout(route.layoutId);
            const routeLabel = route.title || route.path || route.id;

            for (const slotName of slotNames) {
                options.push({
                    value: `route:${route.path}/${slotName}`,
                    label: `${routeLabel} -> ${slotName}`
                });
            }
        }

        for (const dialog of dialogs) {
            const slotNames = getSlotNamesForLayout(dialog.layoutId);
            const dialogLabel = dialog.title || dialog.id;

            for (const slotName of slotNames) {
                options.push({
                    value: `dialog:${dialog.id}/${slotName}`,
                    label: `${dialogLabel} -> ${slotName}`
                });
            }
        }

        for (const container of containers) {
            const slotNames = getSlotNamesForLayout(container.layoutId);
            const containerLabel = container.title || container.id;

            for (const slotName of slotNames) {
                options.push({
                    value: `container:${container.id}/${slotName}`,
                    label: `${containerLabel} -> ${slotName}`
                });
            }
        }

        return options;
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
            const references = collectReferenceNodes();
            setSelectOptions(
                "#node-input-parent",
                references.apps.map(function (app) {
                    return { value: app.id, label: app.title || app.id };
                }),
                self.parent || self.id,
                "App auswaehlen"
            );
        };
    }

    function installReferenceSelectors(config) {
        return function () {
            const self = this;

            function refreshSelectors() {
                const references = collectReferenceNodes();

                if (config.layout) {
                    setSelectOptions(
                        "#node-input-layoutId",
                        references.layouts.map(function (layout) {
                            return {
                                value: layout.id,
                                label: layout.title || layout.id
                            };
                        }),
                        self.layoutId,
                        "Parent-Layout auswaehlen"
                    );
                }

                if (config.route) {
                    setSelectOptions(
                        "#node-input-routeId",
                        references.routes.map(function (route) {
                            return {
                                value: route.id,
                                label: route.title || route.path || route.id
                            };
                        }),
                        self.routeId,
                        "Optional: Parent-Route auswaehlen"
                    );
                }

                if (config.mount) {
                    setSelectOptionsTree(
                        "#node-input-mount",
                        buildMountOptionsTree(references),
                        self.mount
                    );
                }

                if (config.action) {
                    setSelectOptions(
                        config.action,
                        references.actions.map(function (action) {
                            const suffix = action.type === "ui-navigation" && action.to ? ` -> ${action.to}` : "";
                            return {
                                value: action.id,
                                label: `${action.label || action.id}${suffix}`
                            };
                        }),
                        $(config.action).val() || self.action || self.selectAction || self.refreshAction,
                        "Action auswaehlen"
                    );
                }

                if (config.store) {
                    const storeSelector = typeof config.store === "string" && config.store.startsWith("#")
                        ? config.store
                        : "#node-input-storeId";
                    const currentStoreVal = $(storeSelector).val() || self.storeId || self.params;
                    setSelectOptions(
                        storeSelector,
                        references.stores.map(function (store) {
                            return {
                                value: store.id,
                                label: store.id
                            };
                        }),
                        currentStoreVal,
                        "Optional: Store auswaehlen"
                    );
                }
            }

            refreshSelectors();
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

    global.WebappEditorCommon = {
        bindingValueForEditor,
        buildMountOptionsTree,
        collectEventCheckboxValues,
        injectFieldGroup,
        getNextNameDefault,
        getStandardLayoutPresetOptions,
        installEventCheckboxes,
        installLayoutChildPropRows,
        installLayoutSelector,
        installNodePicker,
        installParentAppSelector,
        installReferenceSelectors,
        installVariantSelectBox,
        isStandardLayoutPreset,
        labelWithName,
        parseBindingValue,
        registerNodeType,
        registerNodeTypeWithEvents,
        required,
        setSelectOptionsTree
    };
})(window);

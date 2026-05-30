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

        if (binding && ["state", "query", "routeParam"].includes(binding.kind)) {
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
                    title: node.title || node.name || id
                });
                return;
            }

            if (node.type === "ui-dialog") {
                references.dialogs.push({
                    id,
                    layoutId: node.layoutId || "",
                    title: node.title || node.name || id
                });
                return;
            }

            if (node.type === "ui-container") {
                references.containers.push({
                    id,
                    layoutId: node.layoutId || "",
                    title: node.title || node.name || id
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
                    setSelectOptions(
                        "#node-input-mount",
                        buildMountOptions(references),
                        self.mount,
                        "Parent-Slot auswaehlen"
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

    function registerNodeType(type, definition) {
        RED.nodes.registerType(type, withUiIdMigration(definition));
    }

    function registerNodeTypeWithEvents(type, definition, availableEvents) {
        RED.nodes.registerType(type, withEventOutputs(definition, availableEvents));
    }

    global.WebappEditorCommon = {
        bindingValueForEditor,
        collectEventCheckboxValues,
        getNextNameDefault,
        getStandardLayoutPresetOptions,
        installEventCheckboxes,
        installLayoutChildPropRows,
        installLayoutSelector,
        installParentAppSelector,
        installReferenceSelectors,
        isStandardLayoutPreset,
        labelWithName,
        parseBindingValue,
        registerNodeType,
        registerNodeTypeWithEvents,
        required
    };
})(window);

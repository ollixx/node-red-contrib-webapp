(function (global) {
    "use strict";

    const standardLayoutPresetOptions = [
        { value: "vertical", label: "Vertical" },
        { value: "horizontal", label: "Horizontal" },
        { value: "app", label: "App" }
    ];
    const standardLayoutPresetSlots = {
        vertical: ["content"],
        horizontal: ["content"],
        app: ["header", "navbar", "content", "footer"]
    };

    function labelWithName(fallback) {
        return function () {
            return this.name || this.uiId || this.id || fallback;
        };
    }

    function withUiIdMigration(definition) {
        return {
            ...definition,
            oneditprepare: function () {
                const input = document.getElementById("node-input-uiId");

                if (input && !input.value) {
                    input.value = this.uiId || this.id || "";
                }

                if (definition.oneditprepare) {
                    definition.oneditprepare.call(this);
                }
            }
        };
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

    function readUiModelId(node) {
        return node.uiId || node.id || "";
    }

    function collectReferenceNodes() {
        const references = {
            apps: [],
            layouts: [],
            routes: [],
            dialogs: [],
            slots: [],
            actions: [],
            stores: []
        };

        RED.nodes.eachNode(function (node) {
            const id = readUiModelId(node);

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

            if (node.type === "ui-layout") {
                references.layouts.push({
                    id,
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

            if (node.type === "ui-slot") {
                references.slots.push({
                    id,
                    layoutId: node.layoutId || "",
                    name: node.name || "",
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

    function getCustomLayoutOptions(references) {
        return references.layouts
            .filter(function (layout) {
                return !isStandardLayoutPreset(layout.id);
            })
            .map(function (layout) {
                return {
                    value: layout.id,
                    label: `${layout.id} - ${layout.title}`
                };
            });
    }

    function getSlotNamesForLayout(layoutId, slotsByLayoutId) {
        const explicitSlots = slotsByLayoutId.get(layoutId) || [];

        if (explicitSlots.length > 0) {
            return explicitSlots.map(function (slot) {
                return slot.name;
            }).filter(Boolean);
        }

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
        const layouts = references.layouts;
        const routes = references.routes;
        const dialogs = references.dialogs;
        const slotsByLayoutId = new Map();

        for (const slot of references.slots) {
            if (!slot.layoutId || slot.name === "") {
                continue;
            }

            const currentSlots = slotsByLayoutId.get(slot.layoutId) || [];
            currentSlots.push(slot);
            slotsByLayoutId.set(slot.layoutId, currentSlots);
        }

        const options = [];

        for (const app of apps) {
            const slotNames = getSlotNamesForLayout(app.layoutId, slotsByLayoutId);

            for (const slotName of slotNames) {
                options.push({
                    value: `${app.id}.${slotName}`,
                    label: `App ${app.id} -> ${slotName}`
                });
            }
        }

        for (const route of routes) {
            const slotNames = getSlotNamesForLayout(route.layoutId, slotsByLayoutId);

            for (const slotName of slotNames) {
                options.push({
                    value: `route:${route.path}/${slotName}`,
                    label: `Route ${route.path} -> ${slotName}`
                });
            }
        }

        for (const dialog of dialogs) {
            const slotNames = getSlotNamesForLayout(dialog.layoutId, slotsByLayoutId);

            for (const slotName of slotNames) {
                options.push({
                    value: `dialog:${dialog.id}/${slotName}`,
                    label: `Dialog ${dialog.id} -> ${slotName}`
                });
            }
        }

        for (const layout of layouts) {
            const slotNames = getSlotNamesForLayout(layout.id, slotsByLayoutId);

            for (const slotName of slotNames) {
                options.push({
                    value: `layout:${layout.id}/${slotName}`,
                    label: `Layout ${layout.id} -> ${slotName}`
                });
            }
        }

        return options;
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
                                label: `${layout.id} - ${layout.title}`
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
                                label: `${route.id} - ${route.path}`
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
                                label: `${action.id} - ${action.label}${suffix}`
                            };
                        }),
                        $(config.action).val() || self.action || self.selectAction || self.refreshAction,
                        "Action auswaehlen"
                    );
                }

                if (config.store) {
                    setSelectOptions(
                        "#node-input-storeId",
                        references.stores.map(function (store) {
                            return {
                                value: store.id,
                                label: `${store.id}${store.statePath ? ` - ${store.statePath}` : ""}`
                            };
                        }),
                        self.storeId,
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
            const customSelector = $(config.customSelector);
            const customRow = $(config.customRowSelector);
            const valueInput = $(config.valueSelector);
            const currentValue = String(valueInput.val() || config.getValue.call(this) || "").trim();
            const presetValues = new Set(standardLayoutPresetOptions.map(function (option) {
                return option.value;
            }));
            const initialPreset = presetValues.has(currentValue) ? currentValue : "custom";

            setSelectOptions(
                presetSelector,
                [...getStandardLayoutPresetOptions(), { value: "custom", label: "Custom" }],
                initialPreset,
                config.presetPlaceholder || "Layout auswaehlen"
            );

            function refreshCustomLayouts(selectedValue) {
                setSelectOptions(
                    customSelector,
                    getCustomLayoutOptions(collectReferenceNodes()),
                    selectedValue,
                    config.customPlaceholder || "Custom-Layout auswaehlen"
                );
            }

            function syncLayoutValue() {
                const presetValue = String(presetSelector.val() || standardLayoutPresetOptions[0].value);

                if (presetValue === "custom") {
                    customRow.show();
                    valueInput.val(String(customSelector.val() || ""));
                    return;
                }

                customRow.hide();
                valueInput.val(presetValue);
            }

            refreshCustomLayouts(initialPreset === "custom" ? currentValue : "");
            syncLayoutValue();

            presetSelector.on("change", function () {
                if (String(presetSelector.val() || "") === "custom") {
                    refreshCustomLayouts(String(valueInput.val() || customSelector.val() || ""));
                }

                syncLayoutValue();
            });
            customSelector.on("change", syncLayoutValue);
        };
    }

    function registerNodeType(type, definition) {
        RED.nodes.registerType(type, withUiIdMigration(definition));
    }

    global.WebappEditorCommon = {
        bindingValueForEditor,
        getStandardLayoutPresetOptions,
        installLayoutSelector,
        installReferenceSelectors,
        isStandardLayoutPreset,
        labelWithName,
        parseBindingValue,
        registerNodeType,
        required
    };
})(window);

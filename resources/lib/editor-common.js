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

    // P139 (ADR 0015): a small heading line for an injected field group (e.g.
    // "Layout" over the placement rows, "Allgemein" over the base fields).
    // Identified per group via data-group-heading so visibility logic (e.g. the
    // placement-row toggle) can show/hide the heading with its rows.
    function buildGroupHeadingMarkup(groupId, text) {
        return '<div class="form-row webapp-field-group-heading" data-group-heading="' + escapeHtml(groupId) + '"' +
            ' style="font-weight: 600; margin: 8px 0 4px;">' + escapeHtml(text) + "</div>";
    }

    // The edit-form element injected field groups append to (shared by
    // injectFieldGroup and installBaseFields). Returns an empty jQuery set when
    // no edit form is present.
    function resolveEditFormTarget() {
        const form = $("#node-input-mount").closest("form, .red-ui-tray-content, #dialog-form");
        const container = form.length ? form : $("#dialog-form");
        return container.length ? container : $(".red-ui-tray-body").first();
    }

    // Generic "inject this shared field group" primitive.
    // spec = {
    //   groupId:   unique marker (data-field-group="<groupId>"), for idempotency
    //   separator: boolean — prepend an <hr> matching the template convention
    //   heading:   optional heading text rendered above the rows (P139)
    //   fields:    array of field specs (see buildFieldRowMarkup)
    // }
    // Returns the injected (or pre-existing) container as a jQuery object, or null
    // if no edit form is present. Appends to the form that hosts the node fields.
    function injectFieldGroup(spec) {
        const target = resolveEditFormTarget();
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
        if (spec.heading) {
            markup += buildGroupHeadingMarkup(spec.groupId, spec.heading);
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
            // P139 (ADR 0015): central "Layout" heading over the placement rows —
            // one change here lands the heading on every node at once. Shown/
            // hidden together with the rows (see installLayoutChildPropRows).
            heading: "Layout",
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

    // ── Icon Size SelectBox (P159) ────────────────────────────────────────────
    // installIconSizeSelectBox() injects a "Größe" select with the five-step
    // token set (xs/sm/md/lg/xl) for icon-scale nodes (ui-icon). Mirrors the
    // installSizeSelectBox() mechanism exactly, but uses the wider xs..xl scale.
    //
    // Migration: if the stored `size` is not a recognised token (e.g. a legacy
    // free CSS value like "24" or "1.5rem"), a temporary "<value> (bestehend)"
    // option is prepended so the old value round-trips without data loss. The
    // user can pick a proper token; on next save the legacy value is gone if a
    // token was chosen. The schema accepts only xs..xl — this guard keeps the
    // editor from silently discarding unexpected stored values.
    var ICON_SIZE_TOKENS = ["xs", "sm", "md", "lg", "xl"];
    var ICON_SIZE_OPTIONS = [
        { value: "",   label: "(default / md)" },
        { value: "xs", label: "XSmall" },
        { value: "sm", label: "Small" },
        { value: "md", label: "Medium" },
        { value: "lg", label: "Large" },
        { value: "xl", label: "XLarge" }
    ];

    function installIconSizeSelectBox() {
        return function () {
            var self = this;
            injectFieldGroup({
                groupId: "size-select",
                separator: false,
                fields: [
                    { id: "size", label: "Größe", type: "select", options: ICON_SIZE_OPTIONS }
                ]
            });
            var select = $("#node-input-size");
            if (!select.length) { return; }
            var stored = self.size || "";
            if (stored && ICON_SIZE_TOKENS.indexOf(stored) === -1) {
                // Legacy free CSS value — prepend a "(bestehend)" option so the
                // old value is preserved on first open; user can then choose a
                // token to migrate permanently.
                select.prepend(
                    $("<option>").val(stored).text(stored + " (bestehend)")
                );
            }
            select.val(stored);
        };
    }

    // ── Common base fields (P139, ADR 0015) ─────────────────────────────────
    // Every node offers the four common base fields visible/disabled/color/size
    // as ONE grouped section with its own heading ("Allgemein").
    // installBaseFields(config) renders the group in oneditprepare;
    // applyBaseFields(config) persists it in oneditsave. `config` is the
    // node-LOCAL capability declaration (a central capability map — P102 — may
    // replace the scattered flags later):
    //
    //   {
    //     visible:  true|false,   // default true — false renders the field N/A
    //     disabled: true|false,
    //     color:    true|false,
    //     size:     true|false,
    //     variant:  true|false,   // node carries semantic `variant` → color N/A
    //     advanced: ["size"],     // rarely-used fields → collapsible "Erweitert"
    //     hints:    { disabled: "…", … }  // N/A reason per field (defaults below)
    //   }
    //
    // Persistence follows the rolled-out ADR 0012 patterns exactly (REUSE, not
    // duplicate): `disabled` is the P122–P130 boolean-state typedInput
    // (#node-input-disabledBinding, binding object on `disabled`, legacy
    // `disabledPath` → state-binding migration); `visible` mirrors it (the P138
    // shape, legacy `visiblePath` migration); `color` is a general value
    // typedInput persisted as a binding object on `color` (legacy plain string →
    // literal; empty literal → null); `size` is the existing SIZE_OPTIONS token
    // select on #node-input-size (Node-RED auto-saves it via its default).
    //
    // An N/A field is SHOWN but disabled, with a short reason (visible hint +
    // title tooltip). All base fields are visible by default; only the fields
    // listed in `advanced` sit in the collapsed "Erweitert" subsection (a pure
    // editor affordance — the collapse state is never persisted).

    var BASE_FIELD_ORDER = ["visible", "disabled", "color", "size"];
    var BASE_FIELD_LABELS = { visible: "Visible", disabled: "Disabled", color: "Color", size: "Size" };
    var BASE_FIELD_DEFAULT_NA_HINTS = {
        visible: "Für diesen Knoten nicht anwendbar.",
        disabled: "Dieser Knoten hat keinen interaktiven Zustand.",
        color: "Für diesen Knoten nicht anwendbar.",
        size: "Dieser Knoten hat keine einstellbare Größe."
    };
    var BASE_FIELD_VARIANT_COLOR_HINT = "Nutzt die semantische Variant (Farbe über das Variant-Feld).";

    // The binding-carrier (or plain) input element id per base field.
    var BASE_FIELD_INPUT_IDS = {
        visible: "visibleBinding",
        disabled: "disabledBinding",
        color: "colorBinding",
        size: "size"
    };

    // Pure node-local applicability/hint resolver (unit-tested,
    // packages/editor/test/p139-base-fields.test.ts). Default: applicable.
    // `variant: true` forces `color` → N/A (mutual exclusion, ADR 0015 §1). An
    // N/A field's hint comes from config.hints[field], falling back to the
    // built-in defaults above; applicable fields never carry a hint.
    function resolveBaseFieldApplicability(config) {
        var cfg = config || {};
        var hints = cfg.hints || {};
        var result = {};
        BASE_FIELD_ORDER.forEach(function (field) {
            var applicable = cfg[field] !== false;
            var defaultHint = BASE_FIELD_DEFAULT_NA_HINTS[field];
            if (field === "color" && cfg.variant === true) {
                applicable = false;
                defaultHint = BASE_FIELD_VARIANT_COLOR_HINT;
            }
            result[field] = {
                applicable: applicable,
                hint: applicable ? "" : (hints[field] || defaultHint)
            };
        });
        return result;
    }

    // One base-field form row. N/A → control disabled + data-base-field-na
    // marker + hint (visible text and title tooltip on the row).
    function buildBaseFieldRowMarkup(field, state) {
        var inputId = "node-input-" + BASE_FIELD_INPUT_IDS[field];
        var rowAttrs = ' data-base-field="' + escapeHtml(field) + '"';
        if (!state.applicable) {
            rowAttrs += ' data-base-field-na="true" title="' + escapeHtml(state.hint) + '"';
        }
        var control;
        if (field === "size") {
            var optionMarkup = SIZE_OPTIONS.map(function (opt) {
                return '<option value="' + escapeHtml(opt.value) + '">' + escapeHtml(opt.label) + "</option>";
            }).join("");
            control = '<select id="' + inputId + '"' + (state.applicable ? "" : " disabled") + ">" + optionMarkup + "</select>";
        } else {
            control = '<input type="text" id="' + inputId + '"' + (state.applicable ? "" : " disabled") + ">";
        }
        var hintMarkup = state.applicable
            ? ""
            : '<span data-base-field-hint style="display: block; margin-left: 104px; font-size: 11px; color: var(--red-ui-secondary-text-color, #888);">' +
                escapeHtml(state.hint) + "</span>";
        return '<div class="form-row"' + rowAttrs + ">" +
            '<label for="' + inputId + '">' + escapeHtml(BASE_FIELD_LABELS[field]) + "</label>" +
            control + hintMarkup +
            "</div>";
    }

    function installBaseFields(config) {
        return function () {
            var self = this;
            var cfg = config || {};
            var applicability = resolveBaseFieldApplicability(cfg);
            var advanced = Array.isArray(cfg.advanced) ? cfg.advanced : [];

            var target = resolveEditFormTarget();
            if (!target.length) {
                return;
            }
            var group = target.find('[data-field-group="base-fields"]');
            if (!group.length) {
                var mainRows = "";
                var advancedRows = "";
                BASE_FIELD_ORDER.forEach(function (field) {
                    var row = buildBaseFieldRowMarkup(field, applicability[field]);
                    if (advanced.indexOf(field) !== -1) {
                        advancedRows += row;
                    } else {
                        mainRows += row;
                    }
                });
                var markup = '<span data-field-group="base-fields" style="display: contents;">' +
                    '<hr style="margin: 8px 0;">' +
                    buildGroupHeadingMarkup("base-fields", "Allgemein") +
                    mainRows;
                if (advancedRows) {
                    markup +=
                        '<div class="form-row" data-base-advanced-toggle style="margin-bottom: 4px;">' +
                        '<a href="#" style="text-decoration: none;"><i class="fa fa-caret-right"></i> Erweitert</a>' +
                        "</div>" +
                        '<div data-base-advanced-section style="display: none;">' + advancedRows + "</div>";
                }
                markup += "</span>";
                group = $(markup);
                target.append(group);

                // "Erweitert" collapse toggle — default collapsed, pure editor
                // affordance (no persistence).
                group.find("[data-base-advanced-toggle] a").on("click", function (evt) {
                    evt.preventDefault();
                    var section = group.find("[data-base-advanced-section]");
                    var open = section.is(":visible");
                    section.toggle(!open);
                    $(this).find("i")
                        .toggleClass("fa-caret-right", open)
                        .toggleClass("fa-caret-down", !open);
                });
            }

            // visible — boolean-state typedInput (ADR 0012 boolean set; the P138
            // shape incl. legacy visiblePath → state-binding migration). Default
            // (empty) = visible.
            if (applicability.visible.applicable) {
                var storedVisible = parseBindingValue(self.visible);
                var visibleBinding = storedVisible
                    ? storedVisible
                    : (self.visiblePath ? { kind: "state", path: self.visiblePath } : undefined);
                var visibleEditor = readValueBinding(visibleBinding, "");
                var visibleInput = $("#node-input-visibleBinding");
                visibleInput.typedInput({
                    default: visibleEditor.type,
                    types: valueBindingTypes({ category: "boolean" })
                });
                visibleInput.typedInput("type", visibleEditor.type);
                visibleInput.typedInput("value", visibleEditor.value);
            }

            // disabled — THE P122–P130 boolean-state typedInput, centralised
            // (legacy disabledPath → state-binding migration).
            if (applicability.disabled.applicable) {
                var storedDisabled = parseBindingValue(self.disabled);
                var disabledBinding = storedDisabled
                    ? storedDisabled
                    : (self.disabledPath ? { kind: "state", path: self.disabledPath } : undefined);
                var disabledEditor = readValueBinding(disabledBinding, "");
                var disabledInput = $("#node-input-disabledBinding");
                disabledInput.typedInput({
                    default: disabledEditor.type,
                    types: valueBindingTypes({ category: "boolean" })
                });
                disabledInput.typedInput("type", disabledEditor.type);
                disabledInput.typedInput("value", disabledEditor.value);
            }

            // color — general value typedInput (full canonical set); a legacy
            // plain-string colour becomes a literal binding.
            if (applicability.color.applicable) {
                var storedColor = parseBindingValue(self.color);
                var colorBinding = storedColor
                    ? storedColor
                    : (typeof self.color === "string" && self.color.length > 0
                        ? { kind: "literal", value: self.color }
                        : undefined);
                var colorEditor = readValueBinding(colorBinding, "");
                var colorInput = $("#node-input-colorBinding");
                colorInput.typedInput({
                    default: colorEditor.type,
                    types: valueBindingTypes({ category: "value" })
                });
                colorInput.typedInput("type", colorEditor.type);
                colorInput.typedInput("value", colorEditor.value);
            }

            // size — the existing token select. Node-RED binds defaults before
            // this row exists, so bind the stored value manually; auto-save
            // persists it through the node's `size` default.
            if (applicability.size.applicable) {
                var sizeSelect = $("#node-input-size");
                if (sizeSelect.length) {
                    sizeSelect.val(self.size || "");
                }
            }
        };
    }

    // oneditsave counterpart: persist the applicable base fields as binding
    // objects. N/A fields are never written (any stored value stays untouched);
    // `size` auto-saves through its #node-input-size default binding.
    function applyBaseFields(config) {
        return function () {
            var self = this;
            var applicability = resolveBaseFieldApplicability(config);

            if (applicability.visible.applicable) {
                self.visible = applyValueBinding(
                    $("#node-input-visibleBinding").typedInput("type"),
                    $("#node-input-visibleBinding").typedInput("value")
                );
                self.visiblePath = "";
            }

            if (applicability.disabled.applicable) {
                self.disabled = applyValueBinding(
                    $("#node-input-disabledBinding").typedInput("type"),
                    $("#node-input-disabledBinding").typedInput("value")
                );
                self.disabledPath = "";
            }

            if (applicability.color.applicable) {
                var colorBinding = applyValueBinding(
                    $("#node-input-colorBinding").typedInput("type"),
                    $("#node-input-colorBinding").typedInput("value")
                );
                var emptyLiteral = colorBinding.kind === "literal"
                    && (colorBinding.value === undefined || colorBinding.value === null || colorBinding.value === "");
                self.color = emptyLiteral ? null : colorBinding;
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

    // ── Button link mode + outline (P71, updated P122) ───────────────────────
    // installButtonLinkFields() injects:
    //   • an "Outline" checkbox (boolean outline flag),
    //   • a "Link Mode" select (button | url | navigate).
    // P122: the "URL / Route" href field is now a typedInput (url category,
    // ADR 0012) living in the node template as id="node-input-hrefBinding".
    // Visibility is synced via data-button-href-row="hrefBinding" on that row.
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
                    { id: "linkMode", label: "Link Mode", type: "select", options: BUTTON_LINK_MODE_OPTIONS }
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

            function syncHrefVisibility() {
                const value = $("#node-input-linkMode").val() || "button";
                const row = $('[data-button-href-row="hrefBinding"]');
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

            // P165 (ADR 0017): `ui-repeat` is a template CONTAINER — its children
            // mount into a single fixed default slot (REPEAT_SLOT = "content").
            // It carries no layout chrome, so we expose it to BOTH mount pickers as
            // a container with a synthetic single-slot layout ("vertical" → one
            // "content" slot). This yields the mount value `container:<id>/content`,
            // exactly the shape children use to bind into the repeat template.
            if (node.type === "ui-repeat") {
                references.containers.push({
                    id,
                    // Synthetic: a one-slot ("content") layout. The real ui-repeat
                    // node has no layoutId; the slot is fixed by the schema.
                    layoutId: "vertical",
                    title: node.title || node.name || id,
                    mount: node.mount || ""
                });
                return;
            }

            // P168 (ADR 0018, Model 1a): ui-tabs is a CONTAINER whose children are
            // `ui-tab`s — mounting INTO a ui-tabs means "become a tab". It carries
            // a single synthetic "content" slot (the schema's TAB_SLOT); a ui-tab
            // dropped there mounts via `container:<tabsId>/content` (the renderer
            // aliases this to `ui-tabs:<id>/content`). Surfaced to the mount picker
            // through the shared container machinery (no special tab-slot logic).
            if (node.type === "ui-tabs") {
                references.containers.push({
                    id: id,
                    layoutId: "vertical",
                    title: node.title || node.name || id,
                    mount: node.mount || "",
                    // P168: the hint the picker shows for this drop target —
                    // mounting here makes the child a tab.
                    dropHint: "Mounten in ui-tabs heißt: werde ein Tab (ui-tab).",
                    containerKind: "ui-tabs"
                });
                return;
            }

            // P168 (ADR 0018, Model 1a): ui-tab is a thin CONTAINER child of
            // ui-tabs with a single default "content" slot for the tab body.
            if (node.type === "ui-tab") {
                references.containers.push({
                    id: id,
                    layoutId: "vertical",
                    title: node.title || node.name || id,
                    mount: node.mount || "",
                    containerKind: "ui-tab"
                });
                return;
            }

            // P169 (ADR 0018, Model 1a): ui-accordion is a CONTAINER whose children
            // are `ui-accordion-section`s — mounting INTO a ui-accordion means
            // "become a section". Single synthetic "content" slot
            // (ACCORDION_SECTION_SLOT); a section dropped there mounts via
            // `container:<accId>/content` (renderer aliases to
            // `ui-accordion:<id>/content`). Mirror of ui-tabs.
            if (node.type === "ui-accordion") {
                references.containers.push({
                    id: id,
                    layoutId: "vertical",
                    title: node.title || node.name || id,
                    mount: node.mount || "",
                    dropHint: "Mounten in ui-accordion heißt: werde eine Sektion (ui-accordion-section).",
                    containerKind: "ui-accordion"
                });
                return;
            }

            // P169 (ADR 0018, Model 1a): ui-accordion-section is a thin CONTAINER
            // child of ui-accordion with a single default "content" slot for the
            // section body. Mirror of ui-tab.
            if (node.type === "ui-accordion-section") {
                references.containers.push({
                    id: id,
                    layoutId: "vertical",
                    title: node.title || node.name || id,
                    mount: node.mount || "",
                    containerKind: "ui-accordion-section"
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
                    // P132: the JSON default-slice source — used (parsed) for the
                    // soft sub-path autocomplete (keys/indices), never to restrict.
                    initialValue: node.initialValue || "",
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

    // P165 (ADR 0017): does this mount value sit (transitively) inside a
    // `ui-repeat` template? Walks the container chain upward; returns true as soon
    // as an ancestor container id resolves to a `ui-repeat` node. Pure except for
    // the RED.nodes lookup of each ancestor's type. Used to gate the scope-local
    // item/index hint — those bindings only resolve inside a repeat.
    function mountIsInsideRepeat(mountValue, references) {
        if (!mountValue) {
            return false;
        }
        const seen = new Set();
        let current = mountValue;
        while (current && !seen.has(current)) {
            seen.add(current);
            if (!current.startsWith("container:")) {
                // App/route/dialog slot — no repeat above this point.
                return false;
            }
            const sepIdx = current.lastIndexOf("/");
            const containerId = sepIdx >= 0
                ? current.slice("container:".length, sepIdx)
                : current.slice("container:".length);
            const ancestor = RED.nodes.node(containerId);
            if (ancestor && ancestor.type === "ui-repeat") {
                return true;
            }
            const container = references.containers.find(function (c) { return c.id === containerId; });
            if (container && container.mount) {
                current = container.mount;
                continue;
            }
            return false;
        }
        return false;
    }

    // P165 (ADR 0017): mount a live hint under a value typedInput that warns when
    // the field's selected kind is the scope-local `item`/`index` BUT the node is
    // not (transitively) inside a `ui-repeat`. The scope-local kinds resolve to
    // `undefined` outside a repeat, so this is a misuse the author should see. The
    // hint is advisory (non-blocking) and re-evaluates on type change + mount
    // change. `fieldSelector` is the typedInput's <input>; the hint row is created
    // lazily right after it.
    function installRepeatScopeHint(fieldSelector) {
        const $field = $(fieldSelector);
        if (!$field.length) {
            return;
        }
        const hintId = "webapp-repeat-scope-hint-" + String(fieldSelector).replace(/[^a-zA-Z0-9]/g, "");
        let $hint = $("#" + hintId);
        if (!$hint.length) {
            $hint = $("<div>")
                .attr("id", hintId)
                .addClass("form-tips")
                .css({ display: "none", "margin-top": "4px", color: "var(--red-ui-text-color-warning, #a05a00)" });
            $field.closest(".form-row").after($hint);
        }
        function currentType() {
            try {
                return $field.typedInput("type");
            }
            catch (_e) {
                return "";
            }
        }
        function reevaluate() {
            const type = currentType();
            const isScopeLocal = type === "item" || type === "index";
            if (!isScopeLocal) {
                $hint.hide();
                return;
            }
            const references = collectReferenceNodes();
            const mountVal = String($("#node-input-mount").val() || "");
            const inside = mountIsInsideRepeat(mountVal, references);
            if (inside) {
                $hint.hide();
            }
            else {
                $hint
                    .html("<i class=\"fa fa-exclamation-triangle\"></i> "
                        + "This <b>" + (type === "item" ? "Item" : "Index") + "</b> binding only resolves "
                        + "inside a <code>ui-repeat</code> template. This node is not mounted inside a "
                        + "repeat, so it will resolve to <i>undefined</i> at render time.")
                    .show();
            }
        }
        $field.on("change", reevaluate);
        const $mount = $("#node-input-mount");
        if ($mount.length) {
            $mount.on("change", reevaluate);
        }
        reevaluate();
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
        // P117 / P114-P117 fix: the mount picker is intentionally NOT app-scoped.
        // The `mount` field is what *establishes* which app a node belongs to, so
        // scoping its candidates to the already-resolved app would make it
        // impossible to move a node to a slot in another app (and yields an empty
        // list when the edited node is currently mounted elsewhere). The flattened
        // breadcrumbs are self-describing — each starts with the owning app title
        // (e.g. "Shop > /customers > content") — so cross-app origin stays visible
        // without a filter. The `context` argument is accepted for a uniform
        // preset signature but deliberately ignored here.
        mounts: function (references) {
            return flattenMountOptionTree(buildMountOptionsTree(references));
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
            "  width: 420px; max-width: 95vw; max-height: 90vh;",
            "  display: flex; flex-direction: column;",
            "  overflow: hidden;",
            /* P135 / ADR 0014: resizable via the native corner handle (no JS). */
            "  resize: both;",
            "  min-width: 320px; min-height: 280px;",
            "}",
            /* the tree variant opens wider to host the two columns side by side */
            ".webapp-node-picker-dialog-tree {",
            "  width: 640px; min-width: 420px;",
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
            /* P135: in tree mode the columns own the scrolling, not the list */
            ".webapp-node-picker-dialog-tree .webapp-node-picker-list {",
            "  overflow: hidden; padding: 0; min-height: 0;",
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

            /* primary label — P135: ellipsis instead of horizontal scroll */
            ".webapp-node-picker-row-primary {",
            "  font-family: var(--red-ui-primary-font, 'Helvetica Neue', Arial, sans-serif);",
            "  font-size: 13px;",
            "  font-weight: 500;",
            "  color: var(--red-ui-primary-text-color, #333);",
            "  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;",
            "}",

            /* secondary meta line (id · type · app) — P135: ellipsis */
            ".webapp-node-picker-row-secondary {",
            "  font-family: var(--red-ui-primary-font, 'Helvetica Neue', Arial, sans-serif);",
            "  font-size: 11px;",
            "  color: var(--red-ui-secondary-text-color, #666);",
            "  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;",
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
            "}",
            /* P135: footer breadcrumb of the current pick (left-aligned, ellipsis) */
            ".webapp-node-picker-crumb {",
            "  flex: 1 1 auto; min-width: 0; text-align: left;",
            "  font-size: 12px; color: var(--red-ui-secondary-text-color, #666);",
            "  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;",
            "}",

            /* ── P135 / ADR 0014: two-column tree (mounts preset) ──────────── */
            ".webapp-node-picker-columns {",
            "  display: flex; align-items: stretch; height: 100%;",
            "  min-height: 0;",
            "}",
            ".webapp-node-picker-tree {",
            "  flex: 1 1 55%; min-width: 0;",
            "  overflow: auto;",
            "  border-right: 1px solid var(--red-ui-secondary-border-color, #eee);",
            "  padding: 2px 0;",
            "}",
            ".webapp-node-picker-slots {",
            "  flex: 1 1 45%; min-width: 0;",
            "  overflow: auto;",
            "  padding: 2px 6px;",
            "}",
            ".webapp-node-picker-tree-label {",
            "  display: flex; align-items: center; gap: 4px;",
            "  padding: 4px 8px 4px 0;",
            "  cursor: pointer; border-radius: 3px;",
            "  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;",
            "}",
            ".webapp-node-picker-tree-label:hover {",
            "  background: var(--red-ui-list-item-background-hover, #f3f3f3);",
            "}",
            ".webapp-node-picker-tree-label.active {",
            "  background: var(--red-ui-list-item-background-selected, #e6f0f8);",
            "}",
            ".webapp-node-picker-tree-text {",
            "  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;",
            "}",
            ".webapp-node-picker-twisty {",
            "  width: 12px; text-align: center; flex: 0 0 auto;",
            "  color: var(--red-ui-secondary-text-color, #888); font-size: 12px;",
            "}",
            ".webapp-node-picker-slot-row .webapp-node-picker-row-secondary {",
            "  font-size: 10px;",
            "}"
        ].join("\n");

        const style = document.createElement("style");
        style.id = "webapp-picker-styles";
        style.textContent = css;
        document.head.appendChild(style);
    }

    // ── P120: Dual-path colour-coding — tokens, badge, user setting ─────────
    //
    // ADR 0011 §4: two conceptual paths for target configuration get a consistent
    // visual coding across all editor panels:
    //   wire — blue  (#185FA5 default)  Node-RED wiring
    //   ref  — purple (#534AB7 default) inline / internal reference
    //
    // Colour is NEVER the only carrier: every badge also shows an icon + label
    // (accessibility requirement, ADR 0011 §4). The two application forms are:
    //
    //   1. Panel background  — the active mode section's background takes the
    //      mode colour as a strong fill; form fields sit as light insets on top.
    //      Used by P119 (ui-action navigation panel). No separate badge.
    //   2. Compact badge     — pathBadge(kind, label) — strong-fill pill with
    //      white text + icon. Used where no full panel is available (e.g. the
    //      structure sidebar). Both forms share the same CSS custom properties.
    //
    // Default colours are strong/saturated fills suitable for white text
    // (WCAG AA: #185FA5 on white → 4.7:1, #534AB7 on white → 4.6:1). Pastels
    // were explicitly rejected by the owner (2026-06-10).
    //
    // User customisation lives in Node-RED's editor user settings pane
    // ("Webapp" section) — not in ui-app, because this is pure editor UX.

    /** Default token values — defined ONCE; all consumers use the CSS variables. */
    var DUAL_PATH_DEFAULTS = {
        wire: "#185FA5",
        ref:  "#534AB7"
    };

    /**
     * Ensure the dual-path CSS custom properties are set on :root and that the
     * badge + panel-background helper classes exist. Idempotent (guarded by
     * <style id>). Should be called before any badge or panel-background is
     * rendered.
     */
    function ensureDualPathStylesheet() {
        if (document.getElementById("webapp-dual-path-styles")) {
            return;
        }
        // Read persisted user preferences (set by the settings pane on save).
        var stored = (typeof RED !== "undefined" && RED.settings) ?
            RED.settings.get("webapp.dualPath") : null;
        var wireColor = (stored && stored.wire) ? stored.wire : DUAL_PATH_DEFAULTS.wire;
        var refColor  = (stored && stored.ref)  ? stored.ref  : DUAL_PATH_DEFAULTS.ref;

        var css = [
            /* ── CSS custom properties ── */
            ":root {",
            "  --webapp-path-wire-color: " + wireColor + ";",
            "  --webapp-path-ref-color:  " + refColor + ";",
            "}",

            /* ── Compact badge (pathBadge) ── */
            ".webapp-path-badge {",
            "  display: inline-flex;",
            "  align-items: center;",
            "  gap: 4px;",
            "  padding: 2px 8px;",
            "  border-radius: 10px;",
            "  font-family: var(--red-ui-primary-font, 'Helvetica Neue', Arial, sans-serif);",
            "  font-size: 11px;",
            "  font-weight: 600;",
            "  color: #fff;",
            "  white-space: nowrap;",
            "  user-select: none;",
            "}",
            ".webapp-path-badge--wire {",
            "  background: var(--webapp-path-wire-color);",
            "}",
            ".webapp-path-badge--ref {",
            "  background: var(--webapp-path-ref-color);",
            "}",
            ".webapp-path-badge .fa {",
            "  font-size: 10px;",
            "}",

            /* ── Panel background helpers (used by P119) ── */
            ".webapp-path-panel--wire {",
            "  background: var(--webapp-path-wire-color) !important;",
            "  color: #fff;",
            "}",
            ".webapp-path-panel--ref {",
            "  background: var(--webapp-path-ref-color) !important;",
            "  color: #fff;",
            "}",
            /* Light inset for form fields sitting on a coloured panel background */
            ".webapp-path-panel--wire .webapp-path-field-inset,",
            ".webapp-path-panel--ref .webapp-path-field-inset {",
            "  background: rgba(255,255,255,0.15);",
            "  border-radius: 3px;",
            "  padding: 4px 6px;",
            "}"
        ].join("\n");

        var style = document.createElement("style");
        style.id = "webapp-dual-path-styles";
        style.textContent = css;
        document.head.appendChild(style);
    }

    /**
     * Update the CSS custom properties on :root to reflect the currently active
     * (possibly just-changed) user preference. Called from the settings pane on
     * change and on page load.
     *
     * @param {string} wireColor  — hex colour for the wire path
     * @param {string} refColor   — hex colour for the reference path
     */
    function applyDualPathTokens(wireColor, refColor) {
        var root = document.documentElement;
        root.style.setProperty("--webapp-path-wire-color", wireColor || DUAL_PATH_DEFAULTS.wire);
        root.style.setProperty("--webapp-path-ref-color",  refColor  || DUAL_PATH_DEFAULTS.ref);
    }

    /**
     * Create a compact dual-path badge element.
     *
     * @param {"wire"|"ref"} kind    — which conceptual path this badge represents
     * @param {string}       label   — text label (e.g. "via Wire", "Referenz")
     * @returns {jQuery}             — the badge element (not yet in the DOM)
     *
     * @example
     *   $row.append(WebappEditorCommon.pathBadge("wire", "via Wire"));
     *   $row.append(WebappEditorCommon.pathBadge("ref",  "Referenz"));
     */
    function pathBadge(kind, label) {
        ensureDualPathStylesheet();
        var icon = (kind === "wire") ? "fa-plug" : "fa-link";
        // Return a raw DOM <span> so consumers may use either jQuery
        // (`$row.append(badge)`) or native DOM APIs
        // (`document.body.appendChild(badge)`, `badge.classList`, …).
        var badge = document.createElement("span");
        badge.className =
            "webapp-path-badge webapp-path-badge--" + (kind === "wire" ? "wire" : "ref");

        var iconEl = document.createElement("i");
        iconEl.className = "fa " + icon;
        badge.appendChild(iconEl);

        var labelEl = document.createElement("span");
        labelEl.textContent = label || (kind === "wire" ? "Wire" : "Ref");
        badge.appendChild(labelEl);

        return badge;
    }

    /**
     * Register the "Webapp" section in Node-RED's editor user settings pane
     * (RED.userSettings). Idempotent — safe to call multiple times; only the
     * first call takes effect. The section provides:
     *   - two <input type="color"> pickers (Wire colour, Reference colour)
     *   - a "Zurücksetzen" button that restores the defaults
     *
     * Changes take effect immediately (tokens on :root are updated without a
     * page reload) and are persisted via RED.settings.
     */
    function installDualPathUserSettings() {
        if (typeof RED === "undefined" || typeof RED.userSettings === "undefined" ||
            typeof RED.userSettings.add !== "function") {
            return;
        }
        // Guard against duplicate registration. editor-common.js is loaded once
        // per node HTML file (37+ <script> tags), so this IIFE — and therefore
        // this function — runs many times, each in a fresh closure. RED.userSettings.add
        // is NOT idempotent (it just pushes the pane), so without a *persistent*
        // gate we would register 37 identical "Webapp" panes, yielding 37 colour
        // inputs sharing one id. Pin the flag on the global so it survives across
        // every script-execution closure.
        if (global.__webappDualPathSettingsRegistered) {
            return;
        }
        global.__webappDualPathSettingsRegistered = true;

        RED.userSettings.add({
            id: "webapp",
            title: "Webapp",
            get: function () {
                var stored = RED.settings.get("webapp.dualPath") || {};
                var wireColor = stored.wire || DUAL_PATH_DEFAULTS.wire;
                var refColor  = stored.ref  || DUAL_PATH_DEFAULTS.ref;

                // The root element MUST carry id "red-ui-settings-tab-<paneId>".
                // Node-RED's user-settings tray shows the active pane via
                // `$("#red-ui-settings-tab-webapp").show()` after hiding all
                // siblings; without this id our pane is hidden once another tab
                // (or the initial activation) toggles visibility.
                var $section = $("<div>").attr("id", "red-ui-settings-tab-webapp").css({
                    fontFamily: "var(--red-ui-primary-font, 'Helvetica Neue', Arial, sans-serif)",
                    fontSize: "13px"
                });

                // Heading
                $("<h3>").text("Zwei-Wege-Farbcodierung").css({
                    marginTop: "0",
                    marginBottom: "8px",
                    fontSize: "13px",
                    fontWeight: "600"
                }).appendTo($section);

                $("<p>").html(
                    "Legt die Hintergrundfarben für die beiden Konfigurations-Wege fest " +
                    "(<strong>Blau = Wire</strong>, <strong>Lila = Referenz</strong>). " +
                    "Die Farbe ist nie der einzige Träger — Icon und Label sind stets dabei."
                ).css({ color: "var(--red-ui-secondary-text-color, #888)", marginBottom: "10px" })
                 .appendTo($section);

                // Wire colour row
                var $wireRow = $("<div>").css({ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" });
                $("<label>").text("Wire-Farbe").css({ minWidth: "110px" }).appendTo($wireRow);
                var $wireInput = $("<input type=\"color\">")
                    .attr("id", "webapp-setting-wire-color")
                    .val(wireColor)
                    .css({ cursor: "pointer" });
                $wireRow.append($wireInput);
                // Live preview badge
                var $wirePreview = $(pathBadge("wire", "via Wire")).css({ marginLeft: "6px" });
                $wireRow.append($wirePreview);
                $section.append($wireRow);

                // Ref colour row
                var $refRow = $("<div>").css({ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" });
                $("<label>").text("Referenz-Farbe").css({ minWidth: "110px" }).appendTo($refRow);
                var $refInput = $("<input type=\"color\">")
                    .attr("id", "webapp-setting-ref-color")
                    .val(refColor)
                    .css({ cursor: "pointer" });
                $refRow.append($refInput);
                var $refPreview = $(pathBadge("ref", "Referenz")).css({ marginLeft: "6px" });
                $refRow.append($refPreview);
                $section.append($refRow);

                // Live preview: update tokens and badge colour as the pickers change
                $wireInput.on("input change", function () {
                    var wc = $wireInput.val();
                    applyDualPathTokens(wc, $refInput.val());
                    $wirePreview.css("background", wc);
                });
                $refInput.on("input change", function () {
                    var rc = $refInput.val();
                    applyDualPathTokens($wireInput.val(), rc);
                    $refPreview.css("background", rc);
                });

                // Reset button
                var $resetBtn = $("<button type=\"button\" class=\"red-ui-button\">")
                    .text("Zurücksetzen auf Standard")
                    .on("click", function () {
                        $wireInput.val(DUAL_PATH_DEFAULTS.wire).trigger("change");
                        $refInput.val(DUAL_PATH_DEFAULTS.ref).trigger("change");
                    });
                $section.append($resetBtn);

                return $section;
            },
            // Node-RED calls pane.close() when the user-settings tray is closed.
            // Persist the current picker values and re-apply the tokens so the
            // CSS variables survive a reload.
            close: function () {
                var wireColor = $("#webapp-setting-wire-color").val() || DUAL_PATH_DEFAULTS.wire;
                var refColor  = $("#webapp-setting-ref-color").val()  || DUAL_PATH_DEFAULTS.ref;
                RED.settings.set("webapp.dualPath", { wire: wireColor, ref: refColor });
                applyDualPathTokens(wireColor, refColor);
            }
        });
    }

    // ── P119: navigate target-source mode UI (ADR 0011) ─────────────────────
    // The navigate verb gets an explicit, stored target SOURCE — wire | route |
    // url — surfaced as a three-segment switch. The switch carries icon + label
    // per segment; the active segment colours the WHOLE panel (blue for wire,
    // purple for route, neutral for url) using the P120 dual-path tokens. There
    // is no separate badge inside the panel (ADR 0011 §4 cosmetic decision).
    //
    // The helpers below are central and reusable: ui-action AND ui-navigation
    // wire the same installNavigateTargetMode() — no second implementation.

    /**
     * Parse the `:placeholder` segments out of a route path. Returns the ordered
     * list of placeholder names (without the leading colon), de-duplicated.
     *
     *   parseRoutePlaceholders("/customers/:id")        → ["id"]
     *   parseRoutePlaceholders("/orders/:id/:tab")      → ["id", "tab"]
     *   parseRoutePlaceholders("/static")               → []
     *
     * @param {string} path
     * @returns {string[]}
     */
    function parseRoutePlaceholders(path) {
        if (!path || typeof path !== "string") {
            return [];
        }
        var out = [];
        var seen = {};
        var re = /:([A-Za-z_][A-Za-z0-9_]*)/g;
        var m;
        while ((m = re.exec(path)) !== null) {
            var name = m[1];
            if (!Object.prototype.hasOwnProperty.call(seen, name)) {
                seen[name] = true;
                out.push(name);
            }
        }
        return out;
    }

    /**
     * Transitive wire-scan from the edited node (ADR 0011 §2). BFS over OUTGOING
     * wires, hopping through intermediate nodes (function, switch, …), collecting
     * every reachable `ui-route` / `ui-app`. This is ASSISTANCE only — it never
     * produces a validation error (a heuristic must not block a deploy).
     *
     * Limitations (documented, not followed): link-out/link-in nodes and subflow
     * instances are NOT traversed — targets behind them are not detected.
     *
     * @param {string} nodeId  — id of the node whose outgoing wires to scan
     * @returns {Array<{id:string,type:string,path:string,title:string,placeholders:string[]}>}
     *          de-duplicated reached navigation targets (a SET; branching ⇒ >1).
     */
    function scanWiredNavigationTargets(nodeId) {
        var results = [];
        if (typeof RED === "undefined" || !RED.nodes || typeof nodeId !== "string" || !nodeId) {
            return results;
        }
        var DEPTH_LIMIT = 50;
        var visited = {};
        var foundIds = {};
        var queue = [nodeId];
        visited[nodeId] = true;
        var hops = 0;

        // Collect the outgoing-link targets of a node id. RED.nodes.eachLink walks
        // every wire in the workspace; we keep the ones whose source is `id`.
        function outgoing(id) {
            var targets = [];
            if (typeof RED.nodes.eachLink === "function") {
                RED.nodes.eachLink(function (link) {
                    if (link && link.source && link.source.id === id && link.target && link.target.id) {
                        targets.push(link.target.id);
                    }
                });
                return targets;
            }
            // Fallback: read the node's own wires array.
            var node = RED.nodes.node(id);
            if (node && Array.isArray(node.wires)) {
                node.wires.forEach(function (port) {
                    (port || []).forEach(function (t) { if (t) { targets.push(t); } });
                });
            }
            return targets;
        }

        while (queue.length > 0 && hops < DEPTH_LIMIT) {
            var current = queue.shift();
            hops += 1;
            var nexts = outgoing(current);
            for (var i = 0; i < nexts.length; i++) {
                var tid = nexts[i];
                if (visited[tid]) {
                    continue;
                }
                visited[tid] = true;
                var tnode = RED.nodes.node(tid);
                if (!tnode) {
                    continue;
                }
                // Do not traverse link nodes / subflow instances — documented gap.
                if (tnode.type === "link out" || tnode.type === "link in" ||
                    (typeof tnode.type === "string" && tnode.type.indexOf("subflow:") === 0)) {
                    continue;
                }
                if ((tnode.type === "ui-route" || tnode.type === "ui-app") && !foundIds[tid]) {
                    foundIds[tid] = true;
                    var path = tnode.type === "ui-route" ? (tnode.path || "") : "/";
                    results.push({
                        id: tid,
                        type: tnode.type,
                        path: path,
                        title: tnode.title || tnode.name || tid,
                        placeholders: parseRoutePlaceholders(path)
                    });
                    // A route/app is a terminal target; do not scan past it.
                    continue;
                }
                queue.push(tid);
            }
        }
        return results;
    }

    /**
     * installNavigateTargetMode(config) — turn a node panel's hidden mode/route/
     * params fields into the three-mode navigate UI. Returns a controller object
     * with { refresh(), oneditsave(), isValid() }.
     *
     * Required hidden fields in the template (carriers Node-RED binds + saves):
     *   #node-input-targetMode   (str: wire|route|url)
     *   #node-input-routeId      (str: referenced ui-route id)
     *   #node-input-params       (str: JSON array of {name,value,valueType})
     *   #node-input-to / #node-input-toType  (url typedInput)
     * Required container in the template:
     *   .webapp-navigate-target-mode  (empty div this builds into)
     *
     * config:
     *   nodeId      — id of the edited node (for the wire-scan)
     *   getAppId    — optional () → appId (route picker app-scope)
     *   onChange    — optional () called when a value changes (re-validate)
     */
    function installNavigateTargetMode(config) {
        ensureDualPathStylesheet();
        var cfg = config || {};
        var $host = $(".webapp-navigate-target-mode");
        if ($host.length === 0) {
            return { refresh: function () {}, oneditsave: function () {}, isValid: function () { return true; } };
        }

        var $modeField = $("#node-input-targetMode");
        var $routeField = $("#node-input-routeId");
        var $paramsField = $("#node-input-params");

        // The initial mode: a stored value wins absolutely (ADR 0011 §1 — once
        // saved, later canvas-wire changes never switch the mode). Only when
        // nothing was ever stored do we pre-select via the wire-scan.
        var stored = String($modeField.val() || "").trim();
        var initialTargets = scanWiredNavigationTargets(cfg.nodeId);
        var mode;
        if (stored === "wire" || stored === "route" || stored === "url") {
            mode = stored;
        } else if ($routeField.val()) {
            mode = "route";
        } else if ($("#node-input-to").val()) {
            mode = "url";
        } else {
            mode = initialTargets.length >= 1 ? "wire" : "route";
        }
        $modeField.val(mode);

        // ── Build the static structure ──
        $host.empty();

        var $switch = $("<div>").addClass("webapp-nav-mode-switch")
            .css({ display: "inline-flex", border: "1px solid var(--red-ui-form-input-border-color,#ccc)", "border-radius": "4px", overflow: "hidden", "margin-bottom": "8px" });
        var SEGMENTS = [
            { mode: "wire", icon: "fa-plug", label: "via Wire" },
            { mode: "route", icon: "fa-link", label: "Route" },
            { mode: "url", icon: "fa-globe", label: "URL" }
        ];
        var $segs = {};
        SEGMENTS.forEach(function (seg) {
            var $b = $("<button type='button'>")
                .addClass("webapp-nav-mode-seg webapp-nav-mode-seg--" + seg.mode)
                .attr("data-mode", seg.mode)
                .css({ border: "none", background: "transparent", cursor: "pointer", padding: "5px 12px", "font-size": "12px", "border-right": "1px solid var(--red-ui-form-input-border-color,#ccc)" });
            $("<i>").addClass("fa " + seg.icon).css({ "margin-right": "5px" }).appendTo($b);
            $("<span>").text(seg.label).appendTo($b);
            $b.on("click", function (e) { e.preventDefault(); setMode(seg.mode); });
            $segs[seg.mode] = $b;
            $switch.append($b);
        });
        $host.append($switch);

        // The coloured panel body (background = mode colour) with insets inside.
        var $panel = $("<div>").addClass("webapp-nav-mode-panel")
            .css({ padding: "10px", "border-radius": "4px" });
        $host.append($panel);

        // Plain heading (no badge — ADR 0011 §4).
        var $heading = $("<div>").addClass("webapp-nav-mode-heading")
            .css({ "font-weight": "600", "margin-bottom": "6px" });
        $panel.append($heading);

        // Info line (neutral; e.g. "Wire vorhanden — dient als Transport").
        var $info = $("<div>").addClass("webapp-nav-mode-info")
            .css({ "font-size": "11px", "margin-bottom": "8px", opacity: "0.92" });
        $panel.append($info);

        // ── wire-mode body: scan result + grouped placeholder table ──
        var $wireBody = $("<div>").addClass("webapp-nav-wire-body").appendTo($panel);
        // ── route-mode body: route picker + mapping table ──
        var $routeBody = $("<div>").addClass("webapp-nav-route-body").appendTo($panel);
        // ── url-mode body: the `to` typedInput row is relocated here at build
        //    time so $urlBody.toggle() alone controls its visibility ──
        var $urlBody = $("<div>").addClass("webapp-nav-url-body").appendTo($panel);
        (function relocateToRow() {
            var $toRow = $("#node-input-to").closest(".form-row");
            $toRow.addClass("webapp-path-field-inset").appendTo($urlBody);
        })();
        var $urlWarn = $("<div>").addClass("webapp-nav-url-warn")
            .css({ "font-size": "11px", "margin-top": "6px", color: "#b8860b" });
        $urlBody.append($urlWarn);

        // The mapping table model: { name → {value, valueType} } persisted to
        // #node-input-params as a JSON array on save. Seed from stored params.
        var paramValues = {};
        (function seed() {
            var raw = String($paramsField.val() || "").trim();
            if (raw.startsWith("[")) {
                try {
                    JSON.parse(raw).forEach(function (e) {
                        if (e && e.name) {
                            paramValues[e.name] = { value: e.value == null ? "" : String(e.value), valueType: e.valueType || "str" };
                        }
                    });
                } catch (_e) { /* ignore */ }
            }
        })();

        var PARAM_TYPES = ["str", "msg", "jsonata", "flow", "global", "env"];

        // Track which placeholders the active mode requires a value for.
        var requiredNames = [];

        function serializeParams() {
            var list = [];
            requiredNames.forEach(function (n) {
                var v = paramValues[n] || { value: "", valueType: "str" };
                list.push({ name: n, value: v.value || "", valueType: v.valueType || "str" });
            });
            $paramsField.val(list.length > 0 ? JSON.stringify(list) : "");
        }

        function refreshValidity() {
            serializeParams();
            if (typeof cfg.onChange === "function") {
                cfg.onChange();
            }
        }

        // Build one mapping row (placeholder name fixed + typedInput value).
        function buildMappingRow($container, name) {
            var $row = $("<div>").addClass("webapp-nav-param-row webapp-path-field-inset")
                .css({ display: "flex", "align-items": "center", gap: "8px", "margin-bottom": "6px" });
            $("<code>").addClass("webapp-nav-param-name").text(":" + name)
                .css({ "flex": "0 0 30%", "font-weight": "600" }).appendTo($row);
            var $val = $("<input type='text'>").addClass("webapp-nav-param-value")
                .attr("data-name", name).css({ flex: "1 1 auto" });
            $row.append($val);
            $container.append($row);
            var existing = paramValues[name] || { value: "", valueType: "str" };
            $val.typedInput({ default: "str", types: PARAM_TYPES });
            $val.typedInput("type", existing.valueType || "str");
            $val.typedInput("value", existing.value || "");
            $val.on("change", function () {
                paramValues[name] = { value: $val.typedInput("value"), valueType: $val.typedInput("type") };
                refreshValidity();
            });
            paramValues[name] = { value: existing.value || "", valueType: existing.valueType || "str" };
            return $val;
        }

        // ── Route mode: picker + mapping table ──
        var routePickerInstalled = false;
        function ensureRoutePicker() {
            if (routePickerInstalled) {
                return;
            }
            routePickerInstalled = true;
            installPickerField("#node-input-routeId", {
                filterPreset: "routes",
                title: "Ziel-Route auswählen",
                placeholder: "Route auswählen…",
                getAppId: cfg.getAppId
            });
            $routeField.on("change.webappNavMode", function () { rebuildRouteTable(); });
        }

        function routePathById(routeId) {
            if (!routeId) {
                return null;
            }
            var refs = collectReferenceNodes();
            var match = refs.routes.find(function (r) { return r.id === routeId; });
            return match ? (match.path || "") : null;
        }

        function rebuildRouteTable() {
            var $table = $routeBody.find(".webapp-nav-route-table");
            $table.empty();
            var routeId = String($routeField.val() || "");
            var path = routePathById(routeId);
            if (routeId && path === null) {
                $table.append($("<div>").addClass("webapp-nav-route-missing")
                    .text("Die referenzierte Route existiert nicht mehr — bitte neu wählen.")
                    .css({ "font-size": "11px" }));
                requiredNames = [];
                serializeParams();
                refreshValidity();
                return;
            }
            var names = parseRoutePlaceholders(path || "");
            requiredNames = names.slice();
            if (names.length === 0) {
                $table.append($("<div>").addClass("webapp-nav-route-noparams")
                    .text("Diese Route hat keine :platzhalter — keine Parameter nötig.")
                    .css({ "font-size": "11px" }));
            } else {
                $("<div>").addClass("webapp-nav-param-caption").text("Parameter der Ziel-Route")
                    .css({ "font-weight": "600", "margin-bottom": "6px" }).appendTo($table);
                names.forEach(function (n) { buildMappingRow($table, n); });
            }
            serializeParams();
            refreshValidity();
        }

        // ── Wire mode: scan result, grouped placeholders ──
        function rebuildWireBody() {
            $wireBody.empty();
            var targets = scanWiredNavigationTargets(cfg.nodeId);
            if (targets.length === 0) {
                $("<div>").text("Kein verdrahtetes Ziel erkannt. Parameter werden zur Laufzeit über msg.ui.action.params versorgt. (Ziele hinter Link-Nodes werden nicht erkannt.)")
                    .css({ "font-size": "11px" }).appendTo($wireBody);
                requiredNames = [];
                serializeParams();
                return;
            }
            if (targets.length === 1) {
                var t = targets[0];
                $("<div>").addClass("webapp-nav-wire-single").text("via Wire → " + (t.path || "/"))
                    .css({ "font-weight": "600", "margin-bottom": "6px" }).appendTo($wireBody);
                requiredNames = t.placeholders.slice();
                if (t.placeholders.length === 0) {
                    $("<div>").text("Diese Route hat keine :platzhalter.").css({ "font-size": "11px" }).appendTo($wireBody);
                } else {
                    t.placeholders.forEach(function (n) { buildMappingRow($wireBody, n); });
                }
            } else {
                $("<div>").addClass("webapp-nav-wire-multi").text("via Wire → " + targets.length + " mögliche Ziele")
                    .css({ "font-weight": "600", "margin-bottom": "6px" }).appendTo($wireBody);
                // Branching: placeholders grouped per target. The union is NOT
                // hard-required (each branch is conditional); leave requiredNames
                // empty so the scan never blocks a deploy (ADR 0011 §2).
                requiredNames = [];
                targets.forEach(function (t) {
                    var $g = $("<div>").css({ "margin-bottom": "8px" }).appendTo($wireBody);
                    $("<div>").text(t.path || "/").css({ "font-weight": "600" }).appendTo($g);
                    if (t.placeholders.length === 0) {
                        $("<div>").text("(keine :platzhalter)").css({ "font-size": "11px" }).appendTo($g);
                    } else {
                        $("<div>").text(":" + t.placeholders.join(", :")).css({ "font-size": "11px" }).appendTo($g);
                    }
                });
                $("<div>").addClass("webapp-nav-wire-runtime-hint")
                    .text("Verzweigung erkannt — die Versorgung aller Zweige mit Parametern ist Laufzeitverantwortung (msg.ui.action.params).")
                    .css({ "font-size": "11px", "margin-top": "4px" }).appendTo($wireBody);
            }
            serializeParams();
        }

        // ── url mode: the `to` row + warning were relocated at build time;
        //    here we just (re)bind the live warning + ensure the row is shown ──
        function rebuildUrlBody() {
            $("#node-input-to").closest(".form-row").show();
            updateUrlWarn();
            $("#node-input-to").off("change.webappNavUrl").on("change.webappNavUrl", updateUrlWarn);
        }
        function updateUrlWarn() {
            if (!$urlWarn) {
                return;
            }
            var type = "str";
            try { type = $("#node-input-to").typedInput("type"); } catch (_e) { /* not yet */ }
            var val = "";
            try { val = String($("#node-input-to").typedInput("value") || ""); } catch (_e) { val = String($("#node-input-to").val() || ""); }
            if (type === "str" && /:[A-Za-z_]/.test(val)) {
                $urlWarn.text("Hinweis: Der Pfad enthält :platzhalter ohne Werte — im URL-Modus wird die URL komplett gebaut. Vermutlich ein Fehler.");
            } else {
                $urlWarn.text("");
            }
        }

        // ── mode switching ──
        function setMode(next) {
            mode = next;
            $modeField.val(mode).trigger("change");
            render();
            refreshValidity();
        }

        var $routeRowMoved = false;

        function render() {
            // Highlight the active segment.
            SEGMENTS.forEach(function (seg) {
                var active = seg.mode === mode;
                $segs[seg.mode].css({
                    background: active ? "var(--red-ui-secondary-background-selected,#efefef)" : "transparent",
                    "font-weight": active ? "700" : "400"
                });
            });
            // Panel colour: wire → blue, route → purple, url → neutral.
            $panel.removeClass("webapp-path-panel--wire webapp-path-panel--ref");
            if (mode === "wire") {
                $panel.addClass("webapp-path-panel--wire");
                $heading.text("via Wire");
            } else if (mode === "route") {
                $panel.addClass("webapp-path-panel--ref");
                $heading.text("Route (Referenz)");
            } else {
                $heading.text("URL");
            }
            $wireBody.toggle(mode === "wire");
            $routeBody.toggle(mode === "route");
            $urlBody.toggle(mode === "url");

            // Neutral info when switching to a non-wire mode while wires exist.
            $info.text("");
            if (mode !== "wire") {
                var existingTargets = scanWiredNavigationTargets(cfg.nodeId);
                if (existingTargets.length >= 1) {
                    var first = existingTargets[0].path || "/";
                    $info.text("Wire zu " + first + " vorhanden — dient als Transport, das Ziel ist hier explizit gewählt.");
                }
            }

            if (mode === "wire") {
                rebuildWireBody();
            } else if (mode === "route") {
                ensureRoutePicker();
                if (!$routeRowMoved) {
                    $routeRowMoved = true;
                    var $routeRow = $("#node-input-routeId").closest(".form-row");
                    $routeRow.addClass("webapp-path-field-inset").show().appendTo($routeBody);
                    $("<div>").addClass("webapp-nav-route-table").css({ "margin-top": "8px" }).appendTo($routeBody);
                }
                rebuildRouteTable();
            } else {
                rebuildUrlBody();
            }
        }

        render();

        return {
            refresh: function () { render(); },
            oneditsave: function () {
                // Persist mode + only the active mode's carriers (exclusivity).
                $modeField.val(mode);
                if (mode === "route") {
                    serializeParams();
                } else if (mode === "wire") {
                    serializeParams();
                    $routeField.val("");
                } else {
                    // url mode: no params, no routeId.
                    $paramsField.val("");
                    $routeField.val("");
                }
                if (mode !== "url") {
                    $("#node-input-to").val("");
                }
            },
            // For the node's validate() function: in route mode every placeholder
            // must have a non-empty value; a missing/unknown routeId is invalid.
            isValid: function () {
                if (mode !== "route") {
                    return true;
                }
                var routeId = String($routeField.val() || "");
                if (!routeId) {
                    return false;
                }
                var path = routePathById(routeId);
                if (path === null) {
                    return false;
                }
                var names = parseRoutePlaceholders(path);
                for (var i = 0; i < names.length; i++) {
                    var v = paramValues[names[i]];
                    if (!v || String(v.value || "").trim().length === 0) {
                        return false;
                    }
                }
                return true;
            }
        };
    }

    /**
     * Field-level validator for a navigate node (ADR 0011 §3). Works whether the
     * panel is open (delegates to the live controller via node.__navMode) or
     * closed (reads the stored fields directly, so deploy-time validation works).
     *
     * Rules: only `navigate` is checked; only `route` mode is hard-validated —
     * the referenced routeId must resolve AND every `:placeholder` of its path
     * must have a non-empty value. wire/url never block (heuristic / dynamic).
     *
     * @param {object} node — the Node-RED node being validated (`this` in validate)
     * @returns {boolean}
     */
    function validateNavigateConfig(node) {
        // ui-action: only the `navigate` verb navigates. ui-navigation always does.
        if (!node || (node.type !== "ui-navigation" && node.actionType !== "navigate")) {
            return true;
        }
        // Panel open: the controller knows the live picker + param state.
        if (node.__navMode && typeof node.__navMode.isValid === "function") {
            return node.__navMode.isValid();
        }
        // Panel closed / deploy time: derive the mode + check stored fields.
        var mode = node.targetMode;
        if (mode !== "wire" && mode !== "route" && mode !== "url") {
            // Legacy migration mirror of deriveNavigateTargetMode().
            mode = node.routeId ? "route" : (node.to ? "url" : "wire");
        }
        if (mode !== "route") {
            return true;
        }
        var routeId = node.routeId ? String(node.routeId) : "";
        if (!routeId) {
            return false;
        }
        var refs = collectReferenceNodes();
        var match = refs.routes.find(function (r) { return r.id === routeId; });
        if (!match) {
            return false;
        }
        var names = parseRoutePlaceholders(match.path || "");
        if (names.length === 0) {
            return true;
        }
        var values = {};
        try {
            var raw = node.params ? String(node.params).trim() : "";
            if (raw.startsWith("[")) {
                JSON.parse(raw).forEach(function (e) {
                    if (e && e.name) {
                        values[e.name] = e.value == null ? "" : String(e.value);
                    }
                });
            }
        } catch (_e) { /* treat as no values */ }
        for (var i = 0; i < names.length; i++) {
            if (!values[names[i]] || String(values[names[i]]).trim().length === 0) {
                return false;
            }
        }
        return true;
    }

    // Open the modal picker. options:
    //   title      — dialog heading
    //   value      — currently-selected id (highlighted, pre-scrolled)
    //   entries    — array of { value, label, name, id, type, secondary? }
    //   onSelect   — function(value) called with the chosen id when confirmed
    // P135 / ADR 0014: the chosen size of the SHARED picker dialog is persisted in
    // localStorage so it is restored on the next open (any picker — node/mount/
    // icon/media — through the `webapp-node-picker-dialog` class). Restored on
    // open, saved on close (the native CSS `resize` handle has no event, so we
    // read the element's box at close time). Best-effort: a missing/locked
    // localStorage simply means the size is not remembered.
    var PICKER_SIZE_STORAGE_KEY = "webapp-picker-dialog-size";
    function readPickerSize() {
        try {
            var raw = window.localStorage.getItem(PICKER_SIZE_STORAGE_KEY);
            if (!raw) {
                return null;
            }
            var parsed = JSON.parse(raw);
            if (parsed && parsed.width && parsed.height) {
                return { width: parsed.width, height: parsed.height };
            }
        } catch (err) {
            /* ignore */
        }
        return null;
    }
    function writePickerSize(width, height) {
        try {
            window.localStorage.setItem(
                PICKER_SIZE_STORAGE_KEY,
                JSON.stringify({ width: Math.round(width), height: Math.round(height) })
            );
        } catch (err) {
            /* ignore */
        }
    }
    // Apply any remembered size + persist the current box on close. Shared by
    // every picker dialog (node/mount/icon/media) via the `$dialog` element.
    function applyPickerSizePersistence($dialog) {
        var remembered = readPickerSize();
        if (remembered) {
            $dialog.css({ width: remembered.width + "px", height: remembered.height + "px" });
        }
        return function persistOnClose() {
            var el = $dialog && $dialog[0];
            if (el && el.offsetWidth && el.offsetHeight) {
                writePickerSize(el.offsetWidth, el.offsetHeight);
            }
        };
    }

    function openNodePickerDialog(options) {
        ensurePickerStylesheet();

        const opts = options || {};
        const entries = Array.isArray(opts.entries) ? opts.entries : [];
        const currentValue = opts.value ? String(opts.value) : "";

        // P135 / ADR 0014: tree mode (the `mounts` preset). `opts.tree` is the
        // structural node tree (buildMountPickerTree); `opts.searchEntries` is the
        // flat path list used while a query is present (the breadcrumb entries from
        // flattenMountOptionTree). When absent, the dialog renders the classic flat
        // row list (every other preset is unchanged).
        const treeMode = Array.isArray(opts.tree);
        const tree = treeMode ? opts.tree : [];
        const searchEntries = Array.isArray(opts.searchEntries) ? opts.searchEntries : [];

        const $overlay = $("<div>").addClass("webapp-node-picker-overlay");

        const $dialog = $("<div>").addClass("webapp-node-picker-dialog").appendTo($overlay);
        if (treeMode) {
            $dialog.addClass("webapp-node-picker-dialog-tree");
        }
        const persistPickerSize = applyPickerSizePersistence($dialog);

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
            persistPickerSize();
            $overlay.remove();
            $(document).off("keydown.webappNodePicker");
        }

        function confirm(value) {
            close();
            if (typeof opts.onSelect === "function") {
                opts.onSelect(value);
            }
        }

        // ── P135 / ADR 0014: two-column tree render ──────────────────────────
        // Left = structure tree (navigation only); right = slots of the
        // left-selected node (the only selectable leaves). A footer breadcrumb
        // shows the full path of the current pick. While a search query is
        // present the left column becomes a flat list of matching paths (no
        // slots); the right column stays the slots of the left-selected path.
        let treeSelectedKey = null;     // left-column node currently shown on the right
        const treeExpanded = {};        // key → bool (expanded branches)
        const $footerCrumb = treeMode
            ? $("<span>").addClass("webapp-node-picker-crumb").appendTo($footer)
            : null;

        function flattenTreeNodes(nodes, acc) {
            (nodes || []).forEach(function (node) {
                acc.push(node);
                flattenTreeNodes(node.children, acc);
            });
            return acc;
        }
        function findTreeNodeByKey(key) {
            const all = flattenTreeNodes(tree, []);
            for (let i = 0; i < all.length; i++) {
                if (all[i].key === key) {
                    return all[i];
                }
            }
            return null;
        }

        function breadcrumbForValue(value) {
            const hit = findMountInTree(tree, value);
            if (!hit) {
                return value || "";
            }
            const labels = hit.path.map(function (n) { return n.label; });
            labels.push(hit.slot);
            return labels.join(" > ");
        }

        function updateFooterCrumb() {
            if (!$footerCrumb) {
                return;
            }
            $footerCrumb.text(selectedValue ? breadcrumbForValue(selectedValue) : "");
        }

        function renderSlots($right, node) {
            $right.empty();
            const slots = node && node.slots ? node.slots : [];
            if (slots.length === 0) {
                $("<div>").addClass("webapp-node-picker-empty").text("Keine Slots.").appendTo($right);
                return;
            }
            slots.forEach(function (slot) {
                const $row = $("<div>")
                    .addClass("webapp-node-picker-row webapp-node-picker-slot-row")
                    .attr("data-value", slot.value);
                if (slot.value === selectedValue) {
                    $row.addClass("selected");
                }
                $("<div>").addClass("webapp-node-picker-row-primary").text(slot.slot).appendTo($row);
                $("<div>").addClass("webapp-node-picker-row-secondary").text(slot.value).appendTo($row);
                $row.on("click", function () { confirm(slot.value); });
                $right.append($row);
            });
        }

        function renderTreeBrowse() {
            $list.empty();
            const $columns = $("<div>").addClass("webapp-node-picker-columns").appendTo($list);
            const $left = $("<div>").addClass("webapp-node-picker-tree").appendTo($columns);
            const $right = $("<div>").addClass("webapp-node-picker-slots").appendTo($columns);

            function selectNode(key) {
                treeSelectedKey = key;
                $left.find(".webapp-node-picker-tree-label.active").removeClass("active");
                $left.find('[data-tree-key="' + cssEscape(key) + '"] > .webapp-node-picker-tree-label')
                    .addClass("active");
                renderSlots($right, findTreeNodeByKey(key));
            }

            function renderBranch($parent, node, depth) {
                const $node = $("<div>").addClass("webapp-node-picker-tree-node").attr("data-tree-key", node.key);
                const hasChildren = node.children && node.children.length > 0;
                const $label = $("<div>")
                    .addClass("webapp-node-picker-tree-label")
                    .css({ "padding-left": (6 + depth * 14) + "px" })
                    .appendTo($node);
                const $twisty = $("<i>")
                    .addClass("fa webapp-node-picker-twisty")
                    .addClass(hasChildren ? (treeExpanded[node.key] ? "fa-caret-down" : "fa-caret-right") : "fa-fw")
                    .appendTo($label);
                $("<span>").addClass("webapp-node-picker-tree-text").text(node.label).appendTo($label);

                const $childWrap = $("<div>").addClass("webapp-node-picker-tree-children").appendTo($node);
                if (!treeExpanded[node.key]) {
                    $childWrap.hide();
                }
                if (hasChildren) {
                    node.children.forEach(function (child) { renderBranch($childWrap, child, depth + 1); });
                    $twisty.on("click", function (event) {
                        event.stopPropagation();
                        treeExpanded[node.key] = !treeExpanded[node.key];
                        $childWrap.toggle(treeExpanded[node.key]);
                        $twisty.toggleClass("fa-caret-down", !!treeExpanded[node.key])
                            .toggleClass("fa-caret-right", !treeExpanded[node.key]);
                    });
                }
                $label.on("click", function () { selectNode(node.key); });
                $parent.append($node);
            }

            if (tree.length === 0) {
                $("<div>").addClass("webapp-node-picker-empty").text("Keine Mount-Ziele.").appendTo($left);
            } else {
                tree.forEach(function (node) { renderBranch($left, node, 0); });
            }

            // Pre-select: the current mount's owner node (expanded ancestors).
            const preHit = findMountInTree(tree, selectedValue);
            const preKey = preHit ? preHit.node.key : (tree[0] ? tree[0].key : null);
            if (preHit) {
                preHit.path.forEach(function (n) { treeExpanded[n.key] = true; });
                // Re-render so the expansion is reflected, then select.
                $left.empty();
                tree.forEach(function (node) { renderBranch($left, node, 0); });
            }
            if (preKey) {
                selectNode(preKey);
            } else {
                renderSlots($right, null);
            }
        }

        function renderTreeSearch(query) {
            $list.empty();
            const $columns = $("<div>").addClass("webapp-node-picker-columns").appendTo($list);
            const $left = $("<div>").addClass("webapp-node-picker-tree webapp-node-picker-search-paths").appendTo($columns);
            const $right = $("<div>").addClass("webapp-node-picker-slots").appendTo($columns);

            // Left = flat list of matching PATHS (branches, no slots). A path is
            // the breadcrumb of a tree node; we match against breadcrumb + the
            // node's own slot mount values (so "route:" still finds the branch).
            const allNodes = flattenTreeNodes(tree, []);
            const matches = allNodes.filter(function (node) {
                const crumb = node.slots.length
                    ? breadcrumbForValue(node.slots[0].value).replace(/ > [^>]*$/, "")
                    : node.label;
                const haystack = [crumb, node.key]
                    .concat(node.slots.map(function (s) { return s.value; }))
                    .join(" ");
                return nodePickerMatch({ label: haystack, name: haystack, id: node.key, type: node.kind }, query);
            });

            if (matches.length === 0) {
                $("<div>").addClass("webapp-node-picker-empty").text("Keine Treffer.").appendTo($left);
                renderSlots($right, null);
                return;
            }

            function selectPath(node, $row) {
                $left.find(".webapp-node-picker-row.selected").removeClass("selected");
                $row.addClass("selected");
                renderSlots($right, node);
            }

            matches.forEach(function (node, index) {
                const crumb = node.slots.length
                    ? breadcrumbForValue(node.slots[0].value).replace(/ > [^>]*$/, "")
                    : node.label;
                const $row = $("<div>").addClass("webapp-node-picker-row").attr("data-tree-key", node.key);
                $("<div>").addClass("webapp-node-picker-row-primary").text(crumb).appendTo($row);
                $("<div>").addClass("webapp-node-picker-row-secondary").text(node.key).appendTo($row);
                $row.on("click", function () { selectPath(node, $row); });
                $left.append($row);
                if (index === 0) {
                    selectPath(node, $row);
                }
            });
        }

        // Minimal CSS.escape shim (jsdom/older browsers) for the tree key selector.
        function cssEscape(value) {
            const str = String(value);
            if (window.CSS && typeof window.CSS.escape === "function") {
                return window.CSS.escape(str);
            }
            return str.replace(/[^a-zA-Z0-9_-]/g, function (ch) { return "\\" + ch; });
        }

        function renderRows() {
            const query = $search.val();
            $list.empty();

            // P135 / ADR 0014: tree mode for the `mounts` preset. Empty query →
            // two-column browse; with a query → flat matching-path list (left) +
            // the selected path's slots (right). The footer crumb always tracks
            // the current pick.
            if (treeMode) {
                if (query && String(query).trim().length > 0) {
                    renderTreeSearch(query);
                } else {
                    renderTreeBrowse();
                }
                updateFooterCrumb();
                return;
            }

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
            const dialogOptions = {
                title: cfg.title || "Knoten auswählen",
                value: String($field.val() || ""),
                entries: nodePickerOptionsForPreset(cfg.filterPreset, context),
                onSelect: function (value) {
                    setFieldValue(value);
                    $field.trigger("change");
                    refreshDisplay();
                }
            };
            // P135 / ADR 0014: the `mounts` preset gets the two-column tree. The
            // structural tree (left/right columns) comes from buildMountPickerTree;
            // the existing flat breadcrumb entries (above) stay as the source of
            // the search-mode fallback + the field's label resolution. The cycle
            // guard excludes the edited container's own subtree (a container can
            // never mount into its own descendant). Not app-scoped (P117): the
            // mount establishes which app a node belongs to, so all apps appear.
            if (cfg.filterPreset === "mounts") {
                const references = collectReferenceNodes();
                const editedId = cfg.editedNodeId
                    ? cfg.editedNodeId
                    : ($("#node-input-id").val() ? String($("#node-input-id").val()) : "");
                dialogOptions.tree = buildMountPickerTree(references, editedId);
            }
            openNodePickerDialog(dialogOptions);
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

    // ── P132 (ADR 0013): store-name + default-slice lookups (app-scoped) ──────
    // Resolve a ui-store node id to its human NAME (never the raw id). App-scoped
    // via the same picker preset used everywhere; an unresolvable id (deleted
    // store) falls back to "<id> (bestehend)", matching installPickerField.
    function resolveStoreReference(storeId) {
        if (!storeId) {
            return null;
        }
        var references = collectReferenceNodes();
        var match = null;
        for (var i = 0; i < references.stores.length; i++) {
            if (references.stores[i].id === storeId) {
                match = references.stores[i];
                break;
            }
        }
        return match;
    }
    function resolveStoreName(storeId) {
        if (!storeId) {
            return "";
        }
        var ref = resolveStoreReference(storeId);
        if (ref) {
            return ref.name || ref.statePath || ref.id;
        }
        return String(storeId) + " (bestehend)";
    }
    // The soft sub-path autocomplete entries for a store id: the keys/indices of
    // its parsed default-slice value, mapped to Node-RED autoComplete records.
    function storeSubPathSuggestions(storeId) {
        var ref = resolveStoreReference(storeId);
        if (!ref) {
            return [];
        }
        var slice = parseStoreDefaultSlice(ref.initialValue);
        return defaultSliceKeySuggestions(slice).map(function (key) {
            return { value: key, label: key };
        });
    }

    // P67/P132/P134: the custom Node-RED typedInput type for the `store` binding
    // kind. Name-in-value, path-in-a-second-row layout (ADR 0013 §4, corrected
    // 2026-06-11 — P132 had crammed a "Store ändern" button + the sub-path into a
    // single row showing the id; P134 lifts it to the corrected two-row layout):
    //   - the typedInput value carries the store id, optionally as a JSON envelope
    //     `{path, subPath}` (encodeStoreFieldValue) so a one-level sub-path
    //     round-trips through the canonical apply/read helpers unchanged.
    //   - `valueLabel` paints the value column: the chosen store's resolved NAME
    //     ("monster") in the value area — NO "Store ändern" button, NO raw id, NO
    //     "(bestehend)" for a live store. The typedInput's own "…" expand button
    //     (re-)opens the app-scoped P68 picker to pick/change; the store icon is
    //     the typedInput's type icon (`fa fa-database`). Before a pick the value
    //     area shows a soft "… auswählen"-Hinweis. Unless `leaf:true`, a SECOND,
    //     indented sub-path typedInput (the full `storePath` source set) sits
    //     BELOW the name, in the value column (the field's own label stays in
    //     column 1).
    //   - the leaf form (`leaf:true`, used as the inner source inside a sub-path)
    //     renders the name only — NO nested sub-path (one-level rule, ADR 0013 §3).
    function storeTypedInputType(options) {
        const opts = options || {};
        const isLeaf = !!opts.leaf;

        function openStorePicker(that, onPicked) {
            const references = collectReferenceNodes();
            const appId = resolveEditedNodeApp({}, references);
            const context = appId ? { appId: appId } : {};
            openNodePickerDialog({
                title: opts.pickerTitle || "Store auswählen",
                value: decodeStoreFieldValue(that.value()).path,
                entries: nodePickerOptionsForPreset("stores", context),
                onSelect: onPicked
            });
        }

        return {
            value: "store",
            label: opts.label || "Store",
            icon: "fa fa-database",
            hasValue: true,
            valueLabel: function (container, value) {
                const that = this;
                const decoded = decodeStoreFieldValue(value);
                const hasStore = !!decoded.path;
                // Two-row layout is shown only when a store is picked and this is
                // not the leaf (inner) form. Pre-pick / leaf = a single name row.
                const twoRow = !isLeaf && hasStore;

                // ── The concrete live defect (P174) ────────────────────────────
                // Node-RED's typedInput locks BOTH the outer container
                // (`.red-ui-typedInput-container`: height 34px, overflow hidden,
                // display inline-flex/row) AND the value-label cell
                // (`.red-ui-typedInput-value-label`: height 32px, overflow hidden)
                // to a single fixed-height ROW. Our `flex-direction: column` wrap
                // therefore overflowed a 32px clip — the second (sub-path) row was
                // sheared off, so live it rendered single-line / squeezed and the
                // path field was unreachable (the exact owner report). We must
                // relax those two fixed heights when — and only when — the two-row
                // store layout is active, and restore them otherwise so every other
                // state/type keeps the standard 34px row. `this.uiSelect` is the
                // outer container; `container` is the value-label cell.
                const $cell = container;
                const $outer = (that.uiSelect && that.uiSelect.length)
                    ? that.uiSelect
                    : container.closest(".red-ui-typedInput-container");
                function applyTwoRow() {
                    $outer.addClass("webapp-store-field-tworow")
                        .css({ height: "auto", "min-height": "34px", "align-items": "stretch", overflow: "visible" });
                    $cell.css({ height: "auto", overflow: "visible", "white-space": "normal", display: "flex", "align-items": "stretch" });
                }
                function restoreSingleRow() {
                    $outer.removeClass("webapp-store-field-tworow")
                        .css({ height: "", "min-height": "", "align-items": "", overflow: "" });
                    $cell.css({ height: "", overflow: "", "white-space": "", display: "", "align-items": "" });
                }
                if (twoRow) {
                    applyTwoRow();
                    // When the field's type is later switched AWAY from `store`,
                    // the framework re-renders the value-label cell but never resets
                    // the OUTER container height we relaxed — so it would stay tall.
                    // A namespaced one-shot reset on the host element restores the
                    // standard 34px row the moment the type leaves `store`.
                    if (that.element && that.element.off) {
                        that.element.off("change.webappStoreRow").on("change.webappStoreRow", function (_e, type) {
                            if (type !== "store") {
                                restoreSingleRow();
                                that.element.off("change.webappStoreRow");
                            }
                        });
                    }
                }
                else {
                    // Idempotent: the store type may have been two-row before this
                    // re-render (leaf form, or store cleared back to the hint).
                    restoreSingleRow();
                }
                container.css({ padding: "0" });

                const $wrap = $("<span>")
                    .addClass("webapp-store-field")
                    .css({ display: "inline-flex", "flex-direction": "column", gap: "6px", width: "100%", padding: "2px 0" });

                // Row 1: the resolved store NAME in the value area (no button —
                // the typedInput's native "…" expand re-opens the picker). Before
                // a pick a soft hint stands in. ADR 0013 §4 (P134 correction).
                const $row = $("<span>")
                    .css({ display: "inline-flex", "align-items": "center", gap: "8px", "min-width": "0" });
                const $name = $("<span>")
                    .addClass("webapp-store-field-name")
                    .css({ "min-width": "0", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" });
                if (hasStore) {
                    const name = resolveStoreName(decoded.path);
                    $name.text(name).attr("title", name)
                        .css({ color: "var(--red-ui-primary-text-color, #333)", "font-style": "normal" });
                }
                else {
                    $name.addClass("webapp-store-field-placeholder")
                        .text("Store über „…“ auswählen")
                        .css({ color: "var(--red-ui-secondary-text-color, #888)", "font-style": "italic" });
                }
                $row.append($name);
                $wrap.append($row);

                // Row 2: the SECOND, indented sub-path typedInput (skipped for the
                // leaf form and until a store is chosen). The field label stays in
                // column 1; this row is indented inside the value column. ADR 0013 §4.
                if (twoRow) {
                    const $pathRow = $("<span>")
                        .addClass("webapp-store-field-subpath")
                        .css({ display: "inline-flex", "align-items": "center", gap: "6px", width: "100%", "padding-left": "12px" });
                    const $pathInput = $("<input type=\"text\">")
                        .addClass("webapp-store-subpath-input")
                        .css({ width: "100%" });
                    $pathRow.append($pathInput);
                    $wrap.append($pathRow);

                    const sub = readValueBinding(decoded.subPath || { kind: "literal", value: "" }, "");
                    $pathInput.typedInput({
                        default: sub.type || "str",
                        types: valueBindingTypes({ category: "storePath" }),
                        // Soft default-slice autocomplete on the `str` type only.
                        autoComplete: function (val) {
                            if ($pathInput.typedInput("type") !== "str") {
                                return [];
                            }
                            const all = storeSubPathSuggestions(decodeStoreFieldValue(that.value()).path);
                            const q = String(val || "").toLowerCase();
                            return all.filter(function (e) {
                                return e.value.toLowerCase().indexOf(q) !== -1;
                            });
                        }
                    });
                    $pathInput.typedInput("type", sub.type || "str");
                    $pathInput.typedInput("value", sub.value || "");

                    function syncSubPath() {
                        const subBinding = applyValueBinding(
                            $pathInput.typedInput("type"),
                            $pathInput.typedInput("value")
                        );
                        const cur = decodeStoreFieldValue(that.value());
                        that.value(encodeStoreFieldValue(cur.path, subBinding));
                    }
                    $pathInput.on("change", syncSubPath);
                    $pathInput.typedInput("width", "100%");
                }

                container.append($wrap);
            },
            // P117: resolve the app context from the live panel so the dialog
            // scopes to the stores of the currently-selected app.
            expand: function () {
                const that = this;
                openStorePicker(that, function (picked) {
                    const prior = decodeStoreFieldValue(that.value());
                    that.value(encodeStoreFieldValue(picked, isLeaf ? null : prior.subPath));
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

    // ─── P113 (ADR 0012 / ADR 0010): the ONE canonical value-binding type set ───
    //
    // A single source of truth for BOTH the editor type list (order + kind) AND
    // the serialisation (type+value → binding object, and back). Every display-
    // value input calls `valueBindingTypes()` for its typedInput `types`,
    // `readValueBinding()` in oneditprepare, and `applyValueBinding()` in
    // oneditsave — so adding/reordering a type is exactly one change here.
    //
    // Canonical order (value/display = full set, 14 kinds):
    //   Store, Query, Route-Param, Reactive, msg, JSONata, string, number,
    //   boolean, json, timestamp, Flow, Global, Env.
    // `state` is deliberately NOT offered (owner decision): the renderer/schema
    // still support it for legacy bindings, it is just no longer authorable.
    //
    // Category type-sets (ADR 0012 field-category matrix):
    //   - "value"   (default): the full 14-type set above.
    //   - "boolean" (e.g. `disabled`): drops the string/number/json/timestamp
    //     literals — a boolean can only hold `bool`.
    //   - "url"     (e.g. `href`/`to`): str + msg/JSONata + Store/Reactive +
    //     Flow/Global/Env (no num/bool/json/timestamp — not a URL).
    // A field with no declared category → "value" (the safe, maximal default).

    // The five Node-RED primitive literal sub-types, in canonical order. Each
    // serialises as { kind:"literal", value:<typed value> }.
    var VALUE_BINDING_LITERAL_TYPES = ["str", "num", "bool", "json", "date"];

    // ─── P116 (ADR 0010): the `reactive` typedInput + expression-editor dialog ──
    //
    // Type #4 of the canonical set (after Route-Param, before msg). It carries the
    // expression source in the binding `value` (handled by apply/readValueBinding
    // above). The expand button opens the expression editor dialog with code
    // completion (Monaco, with a clean ace-fallback), live syntax validation and
    // a doc panel; the typedInput `validate` runs syntax + reference checks so a
    // broken/unknown-store expression marks the node invalid and blocks deploy.
    //
    // The contract the dialog teaches and validates is the renderer's (P115):
    // docs/nodes/concepts/reactive-expressions.md — a single synchronous ES2020
    // expression over the three globals `routeParam`, `store(name)`, `query(path)`.

    // The three globals offered as completion + shown in the doc panel. The
    // example snippets are quoted verbatim from reactive-expressions.md (the
    // single source of truth); if these diverge, fix the doc page, not here.
    var REACTIVE_GLOBALS = [
        {
            name: "routeParam",
            insert: "routeParam",
            detail: "Objekt — Parameter der aktiven Route",
            doc: "Aufgelöste Parameter der aktuell aktiven Route. Fehlender Parameter → undefined.",
            example: "`Kunde ${routeParam.id}`"
        },
        {
            name: "store",
            insert: "store(\"\")",
            detail: "Funktion — Live-Wert eines ui-store per Name",
            doc: "store(name) — Live-Wert des ui-store der Parent-App, dessen Name (getrimmt, exakt) übergeben wird.",
            example: "store(\"customer\").name"
        },
        {
            name: "query",
            insert: "query(\"\")",
            detail: "Funktion — Wert aus den Query-Ergebnissen",
            doc: "query(pfad) — Wert am Pfad innerhalb der Query-Ergebnisse (gleiches Lookup wie das query-Binding).",
            example: "query(\"customers.total\")"
        }
    ];

    // GitHub doc link, same pattern as the inline node helps.
    var REACTIVE_DOC_URL =
        "https://github.com/ollix/node-red-contrib-webapp/blob/master/docs/nodes/concepts/reactive-expressions.md";

    // ── Stage-1: syntax validation (pure) ────────────────────────────────────
    // The renderer compiles the source as `return ( <src> );` in strict mode, so
    // the editor parses it the same way. Empty source is invalid (a reactive
    // binding must produce a value). Pure — unit-testable without a DOM.
    function validateReactiveSyntax(src) {
        var source = src == null ? "" : String(src);
        if (source.trim().length === 0) {
            return { ok: false, error: "Ausdruck darf nicht leer sein." };
        }
        try {
            // eslint-disable-next-line no-new-func
            new Function("\"use strict\"; return ( " + source + " );");
            return { ok: true };
        }
        catch (e) {
            return { ok: false, error: (e && e.message) ? String(e.message) : "Ungültiger Ausdruck." };
        }
    }

    // ── Stage-2: reference validation — store("…") literal scan (pure) ────────
    // Extract the string literals passed to store(...) — single- or double-quoted,
    // optionally whitespace-padded — so they can be checked against the app's
    // store names. Dynamic names (store(x), template literals) are not statically
    // resolvable and are deliberately skipped. Pure — unit-testable without a DOM.
    function scanReactiveStoreLiterals(src) {
        var source = src == null ? "" : String(src);
        var out = [];
        // store ( "name" )  or  store ( 'name' )
        var re = /store\s*\(\s*(["'])((?:\\.|(?!\1).)*)\1\s*\)/g;
        var m;
        while ((m = re.exec(source)) !== null) {
            // Unescape \\ and \" / \' so the literal matches the trimmed store name.
            var raw = m[2].replace(/\\(["'\\])/g, "$1");
            out.push(raw);
        }
        return out;
    }

    // Validate every static store("…") literal in the source against the app's
    // store names. Unknown name → error naming it; ambiguous name (two stores of
    // the same name in the app) → error. `storeNames` is the trimmed-name list of
    // the parent app's stores. Pure — unit-testable without a DOM.
    function validateReactiveReferences(src, storeNames) {
        var names = Array.isArray(storeNames) ? storeNames.map(function (n) { return String(n == null ? "" : n).trim(); }) : [];
        var literals = scanReactiveStoreLiterals(src);
        for (var i = 0; i < literals.length; i++) {
            var lit = literals[i].trim();
            if (lit.length === 0) {
                continue;
            }
            var count = 0;
            for (var j = 0; j < names.length; j++) {
                if (names[j] === lit) {
                    count++;
                }
            }
            if (count === 0) {
                return { ok: false, error: "Store „" + lit + "“ existiert nicht in dieser App." };
            }
            if (count > 1) {
                return { ok: false, error: "Store „" + lit + "“ ist in dieser App mehrdeutig (mehrere gleichnamige Stores)." };
            }
        }
        return { ok: true };
    }

    // Resolve the enclosing route record of a mount value by walking the mount
    // chain upward (container → … → route). Returns the route reference object or
    // null when the node is not mounted under a route (e.g. an app slot). Reuses
    // the same chain-walking shape as resolveAppFromMount. Pure.
    function resolveRouteFromMount(mountValue, references) {
        if (!mountValue || !references) {
            return null;
        }
        var seen = {};
        var current = String(mountValue);
        while (current && !seen[current]) {
            seen[current] = true;

            if (current.indexOf("route:") === 0) {
                var rSep = current.lastIndexOf("/");
                var routePath = rSep >= 0 ? current.slice("route:".length, rSep) : current.slice("route:".length);
                return references.routes.find(function (r) { return r.path === routePath; }) || null;
            }

            if (current.indexOf("container:") === 0) {
                var cSep = current.lastIndexOf("/");
                var containerId = cSep >= 0 ? current.slice("container:".length, cSep) : current.slice("container:".length);
                var container = references.containers.find(function (c) { return c.id === containerId; });
                if (container && container.mount) {
                    current = container.mount;
                    continue;
                }
                return null;
            }

            // dialog: or app-slot (".") → no enclosing route.
            return null;
        }
        return null;
    }

    // The completion context for a node being edited: the route-param names of the
    // enclosing route (from the live mount value), the store names of the parent
    // app, and whether the node sits under a route at all. Reads the live panel
    // (#node-input-mount) so it follows the currently-open editor.
    function reactiveCompletionContext() {
        var references = collectReferenceNodes();
        var mountEl = (typeof $ === "function") ? $("#node-input-mount") : null;
        var mountVal = mountEl && mountEl.length ? String(mountEl.val() || "") : "";
        var route = resolveRouteFromMount(mountVal, references);
        var routeParams = route ? parseRoutePlaceholders(route.path || "") : [];

        var appId = resolveEditedNodeApp({}, references);
        var storeNames = references.stores
            .filter(function (s) { return !appId || s.parent === appId; })
            .map(function (s) { return String(s.name || "").trim(); })
            .filter(function (n) { return n.length > 0; });

        return { routeParams: routeParams, storeNames: storeNames, underRoute: Boolean(route) };
    }

    function reactiveTypedInputType() {
        return {
            value: "reactive",
            label: "Reactive",
            icon: "fa fa-bolt",
            hasValue: true,
            // Syntax + reference validation also runs here (not only in the
            // dialog) so a broken/unknown-store expression marks the node invalid
            // and blocks deploy even when the dialog was never opened.
            validate: function (value) {
                var syntax = validateReactiveSyntax(value);
                if (!syntax.ok) {
                    return false;
                }
                var ctx = reactiveCompletionContext();
                return validateReactiveReferences(value, ctx.storeNames).ok;
            },
            expand: function () {
                var that = this;
                openReactiveExpressionDialog({
                    value: String(that.value() || ""),
                    onSelect: function (value) {
                        that.value(value);
                    }
                });
            }
        };
    }

    // ── P116: the expression-editor dialog ───────────────────────────────────
    // Built from Node-RED admin-UI DOM (jQuery, no Shoelace) — same chrome family
    // as the P68 node picker / P69 icon picker. Uses RED.editor.createEditor (the
    // bundled code editor: Monaco on NR 2.x+, ace-compatible API). Completion is
    // registered only when Monaco is feature-detected; the ace-fallback path opens
    // and validates with NO console error (acceptance criterion).
    function openReactiveExpressionDialog(options) {
        ensurePickerStylesheet();
        var opts = options || {};
        var ctx = reactiveCompletionContext();

        var $overlay = $("<div>").addClass("webapp-reactive-dialog-overlay webapp-node-picker-overlay");
        var $dialog = $("<div>")
            .addClass("webapp-reactive-dialog webapp-node-picker-dialog")
            .css({ width: "720px", "max-width": "94vw", "max-height": "86vh", display: "flex", "flex-direction": "column" })
            .appendTo($overlay);

        $("<div>").addClass("webapp-node-picker-header").text(opts.title || "Reactive Expression").appendTo($dialog);

        var $body = $("<div>")
            .css({ display: "flex", flex: "1 1 auto", "min-height": "0", gap: "10px", padding: "8px" })
            .appendTo($dialog);

        // Left: editor + status line.
        var $left = $("<div>").css({ display: "flex", "flex-direction": "column", flex: "1 1 60%", "min-width": "0" }).appendTo($body);
        var editorHostId = "webapp-reactive-editor-" + Date.now();
        var $editorHost = $("<div>")
            .attr("id", editorHostId)
            .addClass("webapp-reactive-editor")
            .css({ flex: "1 1 auto", "min-height": "180px", border: "1px solid var(--red-ui-form-input-border-color, #ccc)", "border-radius": "3px" })
            .appendTo($left);
        var $status = $("<div>")
            .addClass("webapp-reactive-status")
            .css({ "min-height": "20px", "margin-top": "6px", "font-size": "0.85em", "white-space": "pre-wrap" })
            .appendTo($left);

        // Right: doc panel.
        var $doc = $("<div>")
            .addClass("webapp-reactive-doc")
            .css({ flex: "1 1 40%", "min-width": "0", "overflow-y": "auto", "font-size": "0.85em", "line-height": "1.45", padding: "2px 4px" })
            .appendTo($body);
        buildReactiveDocPanel($doc, ctx);

        var $footer = $("<div>").addClass("webapp-node-picker-footer").appendTo($dialog);
        var $okBtn = $("<button type=\"button\" class=\"red-ui-button\">").text("Übernehmen").css({ "margin-right": "6px" });
        var $cancelBtn = $("<button type=\"button\" class=\"red-ui-button\">").text("Abbrechen");
        $footer.append($okBtn).append($cancelBtn);

        var editor = null;

        function readSource() {
            if (editor && typeof editor.getValue === "function") {
                return String(editor.getValue() || "");
            }
            return "";
        }

        function setStatus(kind, message) {
            // kind: "ok" | "error"
            $status.attr("data-state", kind);
            if (kind === "error") {
                $status.css({ color: "var(--red-ui-text-color-error, #d33)" }).text(message || "");
            }
            else {
                $status.css({ color: "var(--red-ui-secondary-text-color, #888)" }).text(message || "Gültiger Ausdruck.");
            }
        }

        // Live stage-1 syntax validation; gate the OK button.
        function revalidate() {
            var syntax = validateReactiveSyntax(readSource());
            if (!syntax.ok) {
                setStatus("error", syntax.error);
                $okBtn.prop("disabled", true).addClass("disabled");
                return false;
            }
            setStatus("ok", "Gültiger Ausdruck.");
            $okBtn.prop("disabled", false).removeClass("disabled");
            return true;
        }

        function close() {
            try {
                if (editor && typeof editor.destroy === "function") {
                    editor.destroy();
                }
            }
            catch (_e) { /* ignore */ }
            $overlay.remove();
            $(document).off("keydown.webappReactiveDialog");
        }

        function confirm() {
            var src = readSource();
            // Stage-1 (syntax) — must hold to apply.
            var syntax = validateReactiveSyntax(src);
            if (!syntax.ok) {
                setStatus("error", syntax.error);
                return;
            }
            // Stage-2 (references) — store("…") literals against the app stores.
            var refs = validateReactiveReferences(src, ctx.storeNames);
            if (!refs.ok) {
                setStatus("error", refs.error);
                return;
            }
            close();
            if (typeof opts.onSelect === "function") {
                opts.onSelect(src);
            }
        }

        $okBtn.on("click", function (e) { e.preventDefault(); confirm(); });
        $cancelBtn.on("click", function (e) { e.preventDefault(); close(); });
        $overlay.on("click", function (e) { if (e.target === $overlay[0]) { close(); } });
        $(document).on("keydown.webappReactiveDialog", function (e) { if (e.key === "Escape") { close(); } });

        $("body").append($overlay);

        // Create the bundled editor. RED.editor.createEditor returns an
        // ace-compatible session object on both the Monaco and ace builds.
        var initial = opts.value || "";
        var created = false;
        if (typeof RED !== "undefined" && RED.editor && typeof RED.editor.createEditor === "function") {
            try {
                editor = RED.editor.createEditor({
                    id: editorHostId,
                    mode: "ace/mode/javascript",
                    value: initial,
                    options: { lineNumbers: false }
                });
                created = Boolean(editor);
            }
            catch (_e) {
                created = false;
            }
        }

        if (!created) {
            // Fallback when no bundled editor is available: a plain textarea. The
            // dialog still opens and validates — only completion is missing. No
            // console error (the createEditor call is guarded above).
            var $ta = $("<textarea>")
                .addClass("webapp-reactive-editor-fallback")
                .css({ width: "100%", height: "100%", "min-height": "180px", "box-sizing": "border-box", "font-family": "monospace", resize: "vertical" })
                .val(initial)
                .appendTo($editorHost.empty());
            editor = {
                getValue: function () { return String($ta.val() || ""); },
                setValue: function (v) { $ta.val(v == null ? "" : String(v)); },
                on: function (evt, cb) { if (evt === "change") { $ta.on("input", cb); } },
                destroy: function () { $ta.remove(); }
            };
        }

        // Register the completion provider only when Monaco is feature-detected.
        // On the ace build (or any non-Monaco editor) we silently skip it — the
        // ace-fallback path is an acceptance criterion, not an error case.
        registerReactiveCompletionProvider(ctx);

        if (editor && typeof editor.on === "function") {
            editor.on("change", revalidate);
        }
        revalidate();

        return { close: close, revalidate: revalidate };
    }

    // Feature-detect Monaco and register a one-shot JavaScript completion provider
    // offering the three globals plus the live route-param / store names. No-op
    // (and no error) when Monaco is absent (ace build). Idempotent within a page.
    var reactiveCompletionRegistered = false;
    function registerReactiveCompletionProvider(ctx) {
        var monaco = (typeof window !== "undefined") ? window.monaco : undefined;
        if (!monaco || !monaco.languages || typeof monaco.languages.registerCompletionItemProvider !== "function") {
            // Ace build / no Monaco → completion not available. Clean skip.
            return false;
        }
        // The provider reads the latest context via a module-level holder so a new
        // dialog refreshes the suggestions without stacking providers.
        reactiveCompletionContextHolder = ctx;
        if (reactiveCompletionRegistered) {
            return true;
        }
        reactiveCompletionRegistered = true;
        try {
            monaco.languages.registerCompletionItemProvider("javascript", {
                triggerCharacters: [".", "\"", "("],
                provideCompletionItems: function (model, position) {
                    var live = reactiveCompletionContextHolder || { routeParams: [], storeNames: [], underRoute: false };
                    var textBefore = model.getValueInRange({
                        startLineNumber: position.lineNumber,
                        startColumn: 1,
                        endLineNumber: position.lineNumber,
                        endColumn: position.column
                    });
                    var Kind = monaco.languages.CompletionItemKind;
                    var suggestions = [];

                    if (/routeParam\.$/.test(textBefore)) {
                        live.routeParams.forEach(function (name) {
                            suggestions.push({ label: name, kind: Kind.Property, insertText: name, detail: "Route-Parameter" });
                        });
                        return { suggestions: suggestions };
                    }
                    if (/store\(\s*["']$/.test(textBefore)) {
                        live.storeNames.forEach(function (name) {
                            suggestions.push({ label: name, kind: Kind.Value, insertText: name, detail: "Store-Name" });
                        });
                        return { suggestions: suggestions };
                    }

                    REACTIVE_GLOBALS.forEach(function (g) {
                        suggestions.push({ label: g.name, kind: Kind.Function, insertText: g.insert, detail: g.detail });
                    });
                    return { suggestions: suggestions };
                }
            });
        }
        catch (_e) {
            // Registration failed → behave like ace-fallback. No throw.
            return false;
        }
        return true;
    }
    var reactiveCompletionContextHolder = null;

    // Build the doc panel: the three globals (table form) with one example each,
    // the two ground rules, an out-of-route note when relevant, and a link to the
    // doc page. The examples are quoted from reactive-expressions.md verbatim.
    function buildReactiveDocPanel($doc, ctx) {
        $doc.empty();
        $("<div>").css({ "font-weight": "bold", "margin-bottom": "4px" }).text("Reactive-Expression").appendTo($doc);
        $("<div>").css({ "margin-bottom": "8px" }).text("Eine einzelne JavaScript-Expression über den Client-Zustand. Nur lesen, kein Statement.").appendTo($doc);

        var $table = $("<table>").css({ width: "100%", "border-collapse": "collapse", "margin-bottom": "8px" }).appendTo($doc);
        REACTIVE_GLOBALS.forEach(function (g) {
            var $tr = $("<tr>").appendTo($table);
            $("<td>").css({ "vertical-align": "top", padding: "3px 6px 3px 0", "white-space": "nowrap" })
                .append($("<code>").text(g.name)).appendTo($tr);
            var $cell = $("<td>").css({ "vertical-align": "top", padding: "3px 0" }).appendTo($tr);
            $("<div>").text(g.doc).appendTo($cell);
            $("<code>").css({ display: "block", "margin-top": "2px", color: "var(--red-ui-secondary-text-color, #888)" }).text(g.example).appendTo($cell);
        });

        var $rules = $("<ul>").css({ margin: "0 0 8px 0", "padding-left": "18px" }).appendTo($doc);
        $("<li>").text("Genau eine Expression — kein Statement, keine Zuweisung.").appendTo($rules);
        $("<li>").text("Nur lesen — Zustand schreiben über Stores.").appendTo($rules);

        if (ctx && !ctx.underRoute) {
            $("<div>")
                .css({ color: "var(--red-ui-text-color-warning, #a60)", "margin-bottom": "8px" })
                .text("Hinweis: Dieser Knoten ist nicht unter einer Route gemountet — routeParam kann zur Laufzeit leer sein.")
                .appendTo($doc);
        }

        $("<a>").attr("href", REACTIVE_DOC_URL).attr("target", "_blank").attr("rel", "noopener")
            .text("Vollständige Doku öffnen ↗").appendTo($doc);
    }

    // ── P132 (ADR 0013): default-slice autocomplete derivation (pure) ─────────
    // Given a store's parsed default-slice value, return the SOFT autocomplete
    // suggestions for a literal sub-path: the top-level keys of a plain object,
    // or the indices ("0".."n-1") of an array. Scalars / null / undefined have no
    // navigable sub-paths → []. This is advisory only (ADR 0013 §4): the editor
    // never hides/restricts the path field from the default shape — the runtime
    // (P131) validates. Pure — unit-testable without a DOM.
    function defaultSliceKeySuggestions(sliceValue) {
        if (Array.isArray(sliceValue)) {
            var indices = [];
            for (var i = 0; i < sliceValue.length; i++) {
                indices.push(String(i));
            }
            return indices;
        }
        if (sliceValue !== null && typeof sliceValue === "object") {
            return Object.keys(sliceValue);
        }
        return [];
    }

    // Parse a ui-store `initialValue`/`default` field (a JSON source string, or an
    // already-parsed value) into the value used for autocomplete derivation. A
    // non-JSON string is treated as a scalar string (no suggestions). Pure.
    function parseStoreDefaultSlice(rawDefault) {
        if (rawDefault === undefined || rawDefault === null) {
            return undefined;
        }
        if (typeof rawDefault !== "string") {
            return rawDefault;
        }
        var trimmed = rawDefault.trim();
        if (trimmed.length === 0) {
            return undefined;
        }
        try {
            return JSON.parse(trimmed);
        }
        catch (_e) {
            return trimmed;
        }
    }

    function valueBindingTypes(options) {
        var opts = options || {};
        var category = opts.category || "value";
        var assetTypes = opts.includeAsset
            ? [assetTypedInputType({ appId: opts.appId })]
            : [];

        var queryType = {
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
        };
        var routeParamType = { value: "routeParam", label: "Route Param", icon: "fa fa-map-signs", hasValue: true };
        var storeType = storeTypedInputType({ label: "Store" });
        var reactiveType = reactiveTypedInputType();
        // P165 (ADR 0017): the scope-local `item`/`index` binding kinds. They only
        // resolve inside a `ui-repeat` template (against the render-time item
        // scope). `item` carries an optional dotted field path (e.g. `name`,
        // `address.city`); `index` is the zero-based position and is PATH-FREE.
        // Outside a repeat they resolve to undefined — the consuming node shows a
        // visible hint (see installRepeatScopeHint).
        var itemType = {
            value: "item",
            label: "Item (Repeat)",
            icon: "fa fa-cube",
            hasValue: true,
            // Optional path: empty (the whole element) OR a dotted field path.
            validate: function (value) {
                var v = (value || "").trim();
                if (v.length === 0) {
                    return true;
                }
                return /^[a-zA-Z_$][a-zA-Z0-9_$]*(\.[a-zA-Z_$][a-zA-Z0-9_$]*)*$/.test(v);
            }
        };
        var indexType = { value: "index", label: "Index (Repeat)", icon: "fa fa-list-ol", hasValue: false };

        if (category === "url") {
            // str, msg, JSONata, Store, Reactive, Flow, Global, Env.
            return [
                "str",
                ...assetTypes,
                "msg",
                "jsonata",
                storeType,
                reactiveType,
                "flow",
                "global",
                "env"
            ];
        }

        if (category === "boolean") {
            // Store, Query, Route-Param, Reactive, msg, JSONata, boolean, Flow,
            // Global, Env (no string/number/json/timestamp).
            return [
                storeType,
                queryType,
                routeParamType,
                reactiveType,
                "msg",
                "jsonata",
                "bool",
                "flow",
                "global",
                "env"
            ];
        }

        // ── P132 (ADR 0013): the `storePath` category — the source set for a
        // store binding's optional one-level `subPath` (a value binding that
        // resolves to a path string / numeric index into the store slice).
        //
        //   string[default], number, routeParam, query, store, reactive,
        //   jsonata, msg, flow, global, env.
        //
        // `string` is the DEFAULT (a literal path like "c" or "b.label"). The
        // inner `store` source here is a LEAF (ADR 0013 §3, one-level rule): it is
        // the plain Node-RED-id store type WITHOUT its own subPath rendering, so a
        // sub-path can never nest inside a sub-path. The default-slice autocomplete
        // (keys/indices) is wired by the consuming store field onto the `str` type
        // via the typedInput `autoComplete` option, not baked into the type here.
        if (category === "storePath") {
            return [
                "str",
                "num",
                routeParamType,
                queryType,
                // Leaf store source — the plain id type, no nested subPath UI.
                storeTypedInputType({ label: "Store", leaf: true }),
                reactiveType,
                "jsonata",
                "msg",
                "flow",
                "global",
                "env"
            ];
        }

        // ── P171 (ADR 0012): the `structural` category — for a value field whose
        // resolved value MUST be an array/object model (e.g. ui-list `items`), not a
        // scalar. Scalar literals (str/num/bool/date) cannot yield a valid model, so
        // they are EXCLUDED; `json` (a static array literal) is kept, alongside every
        // binding kind that can resolve to an array/object (store/query/routeParam/
        // reactive/msg/jsonata/flow/global/env). No scope-local item/index here — a
        // structural source is a top-level collection, not a per-item scalar.
        if (category === "structural") {
            return [
                storeType,
                queryType,
                routeParamType,
                reactiveType,
                "msg",
                "jsonata",
                "json",
                "flow",
                "global",
                "env"
            ];
        }

        // Default — value/display full set (14 kinds) + the 2 scope-local
        // ui-repeat kinds (item/index). The scope-local pair sits at the end so it
        // never shifts the established default ordering of the global kinds.
        return [
            storeType,
            queryType,
            routeParamType,
            reactiveType,
            "msg",
            "jsonata",
            ...assetTypes,
            "str",
            "num",
            "bool",
            "json",
            "date",
            "flow",
            "global",
            "env",
            // P165 (ADR 0017): scope-local item/index (resolve only inside a repeat).
            itemType,
            indexType
        ];
    }

    // Serialise a typedInput (type + raw string value) into the stored binding.
    //   - literal sub-types (str/num/bool/json/date) → { kind:"literal", value:<typed> }
    //   - reactive → { kind:"reactive", value:<expression source> }   (value, not path)
    //   - every other kind (store/query/routeParam/msg/jsonata/flow/global/env)
    //     → { kind, path:<value> }   (jsonata's path holds the expression source)
    //
    // P132 (ADR 0013): the optional 3rd argument `subPath` carries a one-level
    // leaf value binding for the `store` kind only. A present, non-empty subPath
    // is attached as `{ kind:"store", path, subPath }`; an empty/omitted subPath
    // (whole slice) leaves the binding as the bare `{ kind:"store", path }`. The
    // subPath is ignored for every non-store kind (it has no meaning there).
    function applyValueBinding(type, value, subPath) {
        var raw = value === undefined || value === null ? "" : String(value);

        if (VALUE_BINDING_LITERAL_TYPES.indexOf(type) !== -1) {
            return { kind: "literal", value: typedLiteralValue(type, raw) };
        }

        if (type === "reactive") {
            return { kind: "reactive", value: raw };
        }

        if (type === "store") {
            // The store typedInput value carries the store id, OPTIONALLY as a
            // JSON envelope `{"path":<id>,"subPath":<leaf binding>}` written by the
            // rich store field's valueLabel (P132). Decode it so existing consumers
            // that just pass through `typedInput("value")` need no change. An
            // explicit `subPath` argument (used by a dedicated store field) wins.
            var decoded = decodeStoreFieldValue(raw);
            var storeBinding = { kind: "store", path: decoded.path };
            var effectiveSubPath = isMeaningfulSubPath(subPath) ? subPath : decoded.subPath;
            if (isMeaningfulSubPath(effectiveSubPath)) {
                storeBinding.subPath = effectiveSubPath;
            }
            return storeBinding;
        }

        return { kind: type, path: raw };
    }

    // ── P132: store typedInput value <-> {path, subPath} envelope ─────────────
    // The rich store field encodes both halves of the binding into the single
    // typedInput string value so the canonical apply/read helpers keep their
    // 2-arg shape and every existing store consumer round-trips a subPath for free.
    //   - a bare id (no subPath)        → the id string itself ("draftStore")
    //   - id + subPath                  → JSON `{"path":"draftStore","subPath":{…}}`
    // decodeStoreFieldValue tolerates either form (and a half-typed non-JSON id).
    var STORE_FIELD_ENVELOPE_PREFIX = "{";
    function encodeStoreFieldValue(path, subPath) {
        var id = path === undefined || path === null ? "" : String(path);
        if (!isMeaningfulSubPath(subPath)) {
            return id;
        }
        return JSON.stringify({ path: id, subPath: subPath });
    }
    function decodeStoreFieldValue(raw) {
        var str = raw === undefined || raw === null ? "" : String(raw);
        if (str.charAt(0) === STORE_FIELD_ENVELOPE_PREFIX) {
            try {
                var obj = JSON.parse(str);
                if (obj && typeof obj === "object" && typeof obj.path === "string") {
                    return {
                        path: obj.path,
                        subPath: (obj.subPath && typeof obj.subPath === "object" && typeof obj.subPath.kind === "string")
                            ? obj.subPath
                            : null
                    };
                }
            }
            catch (_e) {
                // Not a valid envelope — treat the whole string as a bare id.
            }
        }
        return { path: str, subPath: null };
    }

    // A subPath is "meaningful" (worth persisting) when it is a binding object
    // that resolves to a non-empty value. An empty literal ({kind:"literal",
    // value:""}) or an empty-path dynamic kind means "whole slice" → omitted.
    function isMeaningfulSubPath(subPath) {
        if (!subPath || typeof subPath !== "object" || typeof subPath.kind !== "string") {
            return false;
        }
        if (subPath.kind === "literal") {
            return subPath.value !== undefined && subPath.value !== null && String(subPath.value) !== "";
        }
        if (subPath.kind === "reactive") {
            return typeof subPath.value === "string" && subPath.value.trim().length > 0;
        }
        return typeof subPath.path === "string" && subPath.path.length > 0;
    }

    // Convert a typedInput string value into the typed JS literal for its sub-type.
    // Falls back to the string form when conversion fails, so a half-typed value
    // never throws during save.
    function typedLiteralValue(type, raw) {
        if (type === "num" || type === "date") {
            var n = Number(raw);
            return Number.isNaN(n) ? raw : n;
        }
        if (type === "bool") {
            return raw === "true";
        }
        if (type === "json") {
            try {
                return JSON.parse(raw);
            }
            catch (_e) {
                return raw;
            }
        }
        return raw;
    }

    // Read a stored binding back into a typedInput { type, value } pair. The
    // inverse of applyValueBinding: a literal restores its primitive sub-type
    // (so number/boolean/json round-trip to num/bool/json, not str), reactive
    // restores from `value`, every other dynamic kind from `path`.
    function readValueBinding(binding, fallbackLiteral) {
        var fallback = fallbackLiteral === undefined || fallbackLiteral === null ? "" : String(fallbackLiteral);
        var parsed = parseBindingValue(binding) || binding;

        if (!parsed || typeof parsed !== "object" || typeof parsed.kind !== "string") {
            return { type: "str", value: fallback };
        }

        if (parsed.kind === "literal") {
            return { type: literalSubType(parsed.value), value: literalEditorValue(parsed.value, fallback) };
        }

        if (parsed.kind === "reactive") {
            return { type: "reactive", value: typeof parsed.value === "string" ? parsed.value : "" };
        }

        // P132 (ADR 0013): a store binding carries its store-node id in `path` and
        // an optional one-level leaf `subPath`. Surface the subPath so the store
        // field can restore its path typedInput; a parsed object subPath wins, an
        // absent one is omitted (whole slice).
        if (parsed.kind === "store") {
            var storePath = parsed.path || "";
            var subPath = parsed.subPath ? (parseBindingValue(parsed.subPath) || parsed.subPath) : null;
            var hasSubPath = subPath && typeof subPath === "object" && typeof subPath.kind === "string";
            // `value` is the envelope the store typedInput consumes (id, or
            // JSON {path,subPath}); `subPath` is the structured form for dedicated
            // store fields that drive a separate path typedInput.
            var read = { type: "store", value: encodeStoreFieldValue(storePath, hasSubPath ? subPath : null) };
            if (hasSubPath) {
                read.subPath = subPath;
            }
            return read;
        }

        // All remaining kinds (query/routeParam/msg/jsonata/flow/global/env
        // and legacy `state`) carry their reference/expression in `path`.
        return { type: parsed.kind, value: parsed.path || "" };
    }

    // Pick the editor literal sub-type for a stored literal value by its JS type.
    function literalSubType(value) {
        if (typeof value === "number") {
            return "num";
        }
        if (typeof value === "boolean") {
            return "bool";
        }
        if (value !== null && typeof value === "object") {
            return "json";
        }
        return "str";
    }

    // Render a stored literal value as the string the typedInput field expects.
    function literalEditorValue(value, fallback) {
        if (value === undefined || value === null) {
            return fallback;
        }
        if (value !== null && typeof value === "object") {
            try {
                return JSON.stringify(value);
            }
            catch (_e) {
                return fallback;
            }
        }
        return String(value);
    }

    // ─── P133/P136 (ADR 0012): shared Options validation/normalisation ────────
    // The ONE options helper, shared by ui-select (P133) and ui-radio (P136) —
    // the only two nodes with an `options` model. Browser-side mirror of schema's
    // `normalizeSelectOptions` (the editor cannot require the schema dist).
    // Accepts exactly three forms and rejects the rest:
    //   1. object map  { label: value }            (values must be scalars)
    //   2. array of strings  ["A","B"]             (value = label)
    //   3. array of objects  [{ label, value }]    (both props required)
    // Empty array/object/null/undefined → [] (valid, no options).
    function normalizeOptionsStructure(input) {
        if (input === undefined || input === null) {
            return { ok: true, options: [] };
        }
        if (Array.isArray(input)) {
            if (input.length === 0) {
                return { ok: true, options: [] };
            }
            if (input.every(function (e) { return typeof e === "string"; })) {
                return { ok: true, options: input.map(function (label) { return { label: label, value: label }; }) };
            }
            if (input.every(function (e) { return typeof e === "object" && e !== null && !Array.isArray(e); })) {
                var arr = [];
                for (var i = 0; i < input.length; i++) {
                    var entry = input[i];
                    if (typeof entry.label !== "string" || entry.label.length === 0) {
                        return { ok: false, error: "Each option object must have a non-empty string 'label'." };
                    }
                    if (!("value" in entry)) {
                        return { ok: false, error: "Each option object must declare a 'value'." };
                    }
                    arr.push({ label: entry.label, value: entry.value });
                }
                return { ok: true, options: arr };
            }
            return { ok: false, error: "Options array must be all strings (['A','B']) or all objects ([{label,value}])." };
        }
        if (typeof input === "object") {
            var keys = Object.keys(input);
            if (keys.length === 0) {
                return { ok: true, options: [] };
            }
            var out = [];
            for (var k = 0; k < keys.length; k++) {
                var v = input[keys[k]];
                if (v !== null && typeof v === "object") {
                    return { ok: false, error: "Options object values must be scalars (string/number/boolean), not objects or arrays." };
                }
                out.push({ label: keys[k], value: v });
            }
            return { ok: true, options: out };
        }
        return { ok: false, error: "Options must be an object {label:value}, an array of strings, or an array of {label,value} objects." };
    }

    // Validate a raw JSON STRING for the Options `json` typedInput. Returns
    // true (valid / empty) or an error string (invalid JSON or wrong structure).
    function validateOptionsJson(raw) {
        var text = raw === undefined || raw === null ? "" : String(raw).trim();
        if (text.length === 0) {
            return true;
        }
        var parsed;
        try {
            parsed = JSON.parse(text);
        }
        catch (_e) {
            return "Options must be valid JSON.";
        }
        var result = normalizeOptionsStructure(parsed);
        return result.ok ? true : result.error;
    }

    // P133/P136: install the single shared Options typedInput on `selector`
    // (json | store) — used by both ui-select and ui-radio. Reads the stored
    // `options` binding object (literal json / store) and a legacy
    // optionsJson / optionsBinding for migration. Returns a `save()` that
    // serialises the typedInput back into the `options` binding object.
    function installOptionsField(selector, opts) {
        var options = opts || {};
        var input = $(selector);
        var stored = parseBindingValue(options.options);

        var initialType = "json";
        var initialValue = "";
        if (stored && stored.kind === "store") {
            initialType = "store";
            initialValue = encodeStoreFieldValue(stored.path, stored.subPath);
        }
        else if (stored && stored.kind === "literal") {
            initialType = "json";
            initialValue = literalEditorValue(stored.value, "");
        }
        else if (options.optionsJson) {
            // Legacy static JSON string.
            initialType = "json";
            initialValue = String(options.optionsJson);
        }
        else if (options.optionsBinding) {
            // Legacy store-path binding string → store type.
            initialType = "store";
            initialValue = encodeStoreFieldValue(options.optionsBinding, null);
        }

        input.typedInput({
            default: initialType,
            types: [
                {
                    value: "json",
                    label: "Options",
                    icon: "fa fa-list",
                    hasValue: true,
                    validate: validateOptionsJson
                },
                storeTypedInputType({ label: "Store" })
            ]
        });
        input.typedInput("type", initialType);
        input.typedInput("value", initialValue);

        return function save() {
            var type = input.typedInput("type");
            var value = input.typedInput("value");
            if (type === "store") {
                return applyValueBinding("store", value);
            }
            // json type → literal binding carrying the parsed structure (or null).
            var text = value === undefined || value === null ? "" : String(value).trim();
            if (text.length === 0) {
                return null;
            }
            try {
                return { kind: "literal", value: JSON.parse(text) };
            }
            catch (_e) {
                // Invalid JSON is blocked by the typedInput validate before save;
                // persist the raw string so nothing is silently lost.
                return { kind: "literal", value: text };
            }
        };
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

    // P135 / ADR 0014: the structural tree the two-column mount picker renders.
    // While buildMountOptionsTree FLATTENS the hierarchy into breadcrumb options
    // (kept for the flat reference list + the search-mode path list), the picker's
    // LEFT column needs the hierarchy as a *node tree*: App → (Routes / Dialoge) →
    // Container → recursive child containers. Each tree node carries the SLOTS that
    // become the RIGHT column (the only selectable leaves — the mount strings are
    // identical to buildMountOptionsTree's option values). Pure — unit-testable
    // without a DOM.
    //
    // Shape of a tree node:
    //   { key, kind: "app"|"route"|"dialog"|"container", label,
    //     slots: [{ value(mount string), slot(name) }],
    //     children: [<tree node>, …] }
    //
    // `excludeContainerId` (the cycle guard): when editing a container's own
    // mount, its entire subtree is omitted — a container can never mount into its
    // own descendant (mirrors buildMountOptionsTree's visitedContainers guard).
    function buildMountPickerTree(references, excludeContainerId) {
        const apps = references.apps || [];
        const routes = references.routes || [];
        const dialogs = references.dialogs || [];
        const containers = references.containers || [];
        const visitedContainers = new Set();
        const excluded = excludeContainerId ? String(excludeContainerId) : "";

        // Recursively collect the child-container tree nodes mounted into a given
        // mount value (a parent node's slot). Each child container becomes its own
        // tree node, with its own slots and (recursively) its own children.
        function childContainerNodes(parentMountValues) {
            const mountSet = new Set(parentMountValues);
            const nodes = [];
            for (const child of containers) {
                if (child.id === excluded || visitedContainers.has(child.id)) {
                    continue;
                }
                if (!mountSet.has(child.mount)) {
                    continue;
                }
                visitedContainers.add(child.id);
                nodes.push(containerNode(child));
            }
            return nodes;
        }

        function containerNode(child) {
            const slotNames = getSlotNamesForLayout(child.layoutId);
            const slots = slotNames.map(function (slot) {
                return { value: "container:" + child.id + "/" + slot, slot: slot };
            });
            return {
                key: "container:" + child.id,
                kind: "container",
                label: child.title || child.id,
                slots: slots,
                children: childContainerNodes(slots.map(function (s) { return s.value; }))
            };
        }

        const tree = [];

        for (const app of apps) {
            const appLabel = app.title || app.id;
            const appSlotNames = getSlotNamesForLayout(app.layoutId);
            const appSlots = appSlotNames.map(function (slot) {
                return { value: app.id + "." + slot, slot: slot };
            });
            const appNode = {
                key: "app:" + app.id,
                kind: "app",
                label: appLabel,
                slots: appSlots,
                children: childContainerNodes(appSlots.map(function (s) { return s.value; }))
            };

            const appRoutes = routes.filter(function (r) { return r.parent === app.id; });
            for (const route of appRoutes) {
                const routeSlotNames = getSlotNamesForLayout(route.layoutId);
                const routeSlots = routeSlotNames.map(function (slot) {
                    return { value: "route:" + route.path + "/" + slot, slot: slot };
                });
                appNode.children.push({
                    key: "route:" + route.id,
                    kind: "route",
                    label: route.title || route.path || route.id,
                    slots: routeSlots,
                    children: childContainerNodes(routeSlots.map(function (s) { return s.value; }))
                });
            }

            const appDialogs = dialogs.filter(function (d) { return d.parent === app.id; });
            for (const dialog of appDialogs) {
                const dialogSlotNames = getSlotNamesForLayout(dialog.layoutId);
                const dialogSlots = dialogSlotNames.map(function (slot) {
                    return { value: "dialog:" + dialog.id + "/" + slot, slot: slot };
                });
                appNode.children.push({
                    key: "dialog:" + dialog.id,
                    kind: "dialog",
                    label: dialog.title || dialog.id,
                    slots: dialogSlots,
                    children: childContainerNodes(dialogSlots.map(function (s) { return s.value; }))
                });
            }

            tree.push(appNode);
        }

        // Orphaned routes/dialogs (no known parent app) become top-level branches,
        // mirroring buildMountOptionsTree's "Weitere" group.
        for (const route of routes) {
            if (route.parent && apps.some(function (a) { return a.id === route.parent; })) {
                continue;
            }
            const routeSlots = getSlotNamesForLayout(route.layoutId).map(function (slot) {
                return { value: "route:" + route.path + "/" + slot, slot: slot };
            });
            if (routeSlots.length === 0) {
                continue;
            }
            tree.push({
                key: "route:" + route.id,
                kind: "route",
                label: route.title || route.path || route.id,
                slots: routeSlots,
                children: childContainerNodes(routeSlots.map(function (s) { return s.value; }))
            });
        }
        for (const dialog of dialogs) {
            if (dialog.parent && apps.some(function (a) { return a.id === dialog.parent; })) {
                continue;
            }
            const dialogSlots = getSlotNamesForLayout(dialog.layoutId).map(function (slot) {
                return { value: "dialog:" + dialog.id + "/" + slot, slot: slot };
            });
            if (dialogSlots.length === 0) {
                continue;
            }
            tree.push({
                key: "dialog:" + dialog.id,
                kind: "dialog",
                label: dialog.title || dialog.id,
                slots: dialogSlots,
                children: childContainerNodes(dialogSlots.map(function (s) { return s.value; }))
            });
        }

        return tree;
    }

    // P135 / ADR 0014: find the path of tree nodes (root → … → owner) whose own
    // slots contain `mountValue`, plus the slot name. Used to pre-expand and
    // pre-select the current mount, and to render the footer breadcrumb. Pure.
    function findMountInTree(tree, mountValue) {
        if (!mountValue) {
            return null;
        }
        const target = String(mountValue);
        function walk(nodes, ancestry) {
            for (const node of nodes || []) {
                const slot = (node.slots || []).find(function (s) { return s.value === target; });
                if (slot) {
                    return { path: ancestry.concat([node]), slot: slot.slot, node: node };
                }
                const hit = walk(node.children, ancestry.concat([node]));
                if (hit) {
                    return hit;
                }
            }
            return null;
        }
        return walk(tree, []);
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

                // P139: the central "Layout" heading follows its rows — no active
                // placement field (e.g. "app" layout / unresolved mount) → hidden.
                $('[data-group-heading="layout-placement"]').toggle(activeFields.size > 0);
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
                    getAppId: getAppId,
                    // P135 / ADR 0014: cycle guard — when editing a ui-container's
                    // own mount, exclude its own subtree from the tree (a container
                    // can never mount into its own descendant).
                    editedNodeId: self.type === "ui-container" ? (self.id || "") : ""
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
            .css({ width: "520px", "max-width": "95vw", "max-height": "90vh" })
            .appendTo($overlay);
        // P135 / ADR 0014: shared resize + remembered size (applied AFTER the
        // default inline width so a remembered box wins).
        const persistIconSize = applyPickerSizePersistence($dialog);

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
            persistIconSize();
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
            .css({ width: "560px", "max-width": "95vw", "max-height": "90vh" })
            .appendTo($overlay);
        // P135 / ADR 0014: shared resize + remembered size.
        const persistMediaSize = applyPickerSizePersistence($dialog);

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
            persistMediaSize();
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

    // ── P120: install dual-path user setting on load (idempotent) ────────────
    // RED.userSettings is the return value of an IIFE in red.min.js, so the
    // object (with .add) exists as soon as RED itself is defined — well before
    // any node HTML script runs. We therefore register synchronously on load.
    // The registration is globally de-duplicated (see installDualPathUserSettings)
    // because this IIFE runs once per node HTML <script> tag. As a fallback for
    // any environment where RED is not yet ready at parse time, retry once on
    // the first node-edit event.
    (function () {
        if (typeof RED === "undefined") {
            return;
        }
        if (RED.userSettings) {
            installDualPathUserSettings();
        } else if (RED.events) {
            RED.events.on("editor:open", function () {
                installDualPathUserSettings();
            });
        }
        // Ensure the stylesheet (and thus the :root CSS custom properties) is
        // injected on load, reflecting any persisted user preference, before any
        // badge or panel is rendered. ensureDualPathStylesheet() is idempotent.
        if (typeof document !== "undefined" && document.head) {
            ensureDualPathStylesheet();
        }
    }());

    global.WebappEditorCommon = {
        assetTypedInputType,
        bindingTypedInputTypes,
        valueBindingTypes,
        readValueBinding,
        applyValueBinding,
        // P136: the ONE shared Options helper (ui-select + ui-radio).
        normalizeOptionsStructure,
        validateOptionsJson,
        installOptionsField,
        // Back-compat aliases (P133 names) so older callers keep working.
        normalizeSelectOptionsStructure: normalizeOptionsStructure,
        validateSelectOptionsJson: validateOptionsJson,
        installSelectOptionsField: installOptionsField,
        bindingValueForEditor,
        buildMountOptionsTree,
        flattenMountOptionTree,
        buildMountPickerTree,
        findMountInTree,
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
        installIconSizeSelectBox,
        // P139 (ADR 0015): common base fields (visible/disabled/color/size).
        installBaseFields,
        applyBaseFields,
        resolveBaseFieldApplicability,
        installTextStyleSelectBox,
        installButtonLinkFields,
        installVariantSelectBox,
        isStandardLayoutPreset,
        labelWithName,
        nodePickerMatch,
        nodePickerOptionsForPreset,
        collectReferenceNodes,
        nodePickerPresets,
        openNodePickerDialog,
        parseBindingValue,
        pathBadge,
        installDualPathUserSettings,
        parseRoutePlaceholders,
        scanWiredNavigationTargets,
        installNavigateTargetMode,
        validateNavigateConfig,
        registerNodeType,
        registerNodeTypeWithEvents,
        required,
        resolveEditedNodeApp,
        resolveAppFromMount,
        // P165 (ADR 0017): scope-local item/index repeat helpers.
        mountIsInsideRepeat,
        installRepeatScopeHint,
        resolveRouteFromMount,
        storeTypedInputType,
        defaultSliceKeySuggestions,
        parseStoreDefaultSlice,
        encodeStoreFieldValue,
        decodeStoreFieldValue,
        validateReactiveSyntax,
        scanReactiveStoreLiterals,
        validateReactiveReferences,
        reactiveCompletionContext,
        openReactiveExpressionDialog
    };
})(window);

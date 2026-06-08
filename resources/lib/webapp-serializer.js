/**
 * Shared snapshot serializer (P26).
 *
 * SINGLE source of truth for turning a RenderSnapshot (region/component tree)
 * into the canonical Shoelace markup. Consumed by BOTH:
 *   - the server  (nodes/webapp.js, renderAppPage / the /event + /snapshot routes)
 *   - the browser (resources/lib/webapp-client.js thin client)
 *
 * Before P26 the two renderers were hand-maintained copies that had drifted:
 * the server emitted <sl-button>/<sl-input>/all P16x kinds, the client emitted
 * native <button>/<input> and only a handful of kinds. On hydrate() the client
 * overwrote the server markup and downgraded the page to unstyled HTML. With
 * this module they cannot diverge — the same function produces both outputs and
 * a unit test asserts byte-identical results.
 *
 * Interactivity is expressed with `data-webapp-*` attributes (action/source/
 * event/form/rowid). The thin client dispatches them via POST /event; the server
 * emits the IDENTICAL attributes so the morph compares like-for-like markup and
 * never swaps element kinds.
 *
 * Loadable both in Node (CommonJS) and in the browser (global
 * `window.WebappSerializer`) — the resources/ dir is served statically by
 * Node-RED, so this file must not depend on a bundler or any import.
 */
(function (root, factory) {
    "use strict";

    const api = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = api;
    }

    if (root) {
        root.WebappSerializer = api;
    }
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";

    function escapeHtml(input) {
        return String(input === undefined || input === null ? "" : input)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function escapeAttribute(input) {
        return escapeHtml(input);
    }

    // --- P69: backend-neutral icon rendering --------------------------------
    // An icon value is { library?, name }. A bare string is a plain icon name
    // ("home") or the "library:name" shorthand. The default library renders as
    // a plain <sl-icon name> (no library attr) so it resolves against Shoelace's
    // built-in / default-registered set. A named library surfaces as the
    // `library` attribute; the client must have registered it via
    // registerIconLibrary(). Kept inline so the browser thin client can use it
    // without a bundler (mirrors normalizeIconValue in packages/schema).
    const DEFAULT_ICON_LIBRARY = "default";

    function normalizeIcon(input) {
        if (input === undefined || input === null) {
            return undefined;
        }
        if (typeof input === "string") {
            const trimmed = input.trim();
            if (trimmed.length === 0) {
                return undefined;
            }
            const sep = trimmed.indexOf(":");
            if (sep > 0 && sep < trimmed.length - 1) {
                return { library: trimmed.slice(0, sep), name: trimmed.slice(sep + 1) };
            }
            return { library: DEFAULT_ICON_LIBRARY, name: trimmed };
        }
        if (typeof input === "object" && typeof input.name === "string" && input.name.length > 0) {
            const library = (typeof input.library === "string" && input.library.length > 0)
                ? input.library
                : DEFAULT_ICON_LIBRARY;
            return { library: library, name: input.name };
        }
        return undefined;
    }

    // Render an icon value as an <sl-icon> element. opts: { size, color, slot }.
    // Returns "" for an empty/undefined icon.
    function renderIconHtml(icon, opts) {
        const value = normalizeIcon(icon);
        if (!value) {
            return "";
        }
        const options = opts || {};
        const libraryAttr = (value.library && value.library !== DEFAULT_ICON_LIBRARY)
            ? " library=\"" + escapeAttribute(value.library) + "\""
            : "";
        const slotAttr = options.slot ? " slot=\"" + escapeAttribute(options.slot) + "\"" : "";
        const classAttr = options.size
            ? " class=\"webapp-icon webapp-icon--" + sanitizeClassSuffix(String(options.size)) + "\""
            : " class=\"webapp-icon\"";
        const styleAttr = options.color
            ? " style=\"color:" + escapeAttribute(String(options.color)) + "\""
            : "";
        return "<sl-icon" + slotAttr + classAttr + " name=\"" + escapeAttribute(value.name) + "\""
            + libraryAttr + styleAttr + "></sl-icon>";
    }

    // --- Shoelace adapter mapping (mirrors packages/renderer shoelace-adapter) --
    // Kept inline so this module is browser-loadable without a bundler. A unit
    // test (p26-render-parity) asserts this mapping stays in sync with the
    // canonical mapComponentToShoelace exported from the renderer package.

    const KIND_TO_SHOELACE = {
        button: "sl-button",
        card: "sl-card",
        container: "sl-card",
        input: "sl-input",
        select: "sl-select",
        checkbox: "sl-checkbox",
        radio: "sl-radio-group",
        switch: "sl-switch",
        textarea: "sl-textarea",
        datepicker: "sl-input",
        slider: "sl-range",
        alert: "sl-alert",
        badge: "sl-badge",
        progress: "sl-progress-bar",
        breadcrumb: "sl-breadcrumb",
        tabs: "sl-tab-group",
        accordion: "sl-details",
        menu: "sl-menu",
        avatar: "sl-avatar",
        toast: "sl-alert",
        pagination: "sl-button-group",
        divider: "sl-divider"
    };

    const BUTTON_VARIANT_TO_SHOELACE = {
        primary: "primary",
        secondary: "neutral",
        success: "success",
        danger: "danger",
        warning: "warning",
        neutral: "neutral",
        ghost: "default",
        // text/link are textual buttons → Shoelace "text" (many-to-one ok)
        text: "text",
        link: "text"
    };

    // P49/P49b: status/severity vocabulary shared by ui-badge + ui-alert.
    // Canonical SEVERITY_VARIANTS set: primary, success, warning, danger, neutral, info.
    // `info` is a deliberate ALIAS of primary (many-to-one, documented).
    // Legacy tokens "error" → "danger" and "default" → "neutral" are kept as
    // graceful fallbacks for any deployed flow configs that pre-date P49b; the
    // schema now rejects them at authoring time but the renderer degrades
    // gracefully rather than breaking (P49 mapping rule: unknown → kind default).
    const SEVERITY_TO_SHOELACE = {
        primary: "primary",
        info: "primary",
        success: "success",
        warning: "warning",
        danger: "danger",
        error: "danger",    // graceful fallback for pre-P49b deployed configs
        neutral: "neutral",
        default: "neutral"  // graceful fallback for pre-P49b deployed configs
    };

    // P49: per-kind variant→Shoelace mapping table. ONE place that turns the
    // portable Ebene-2 vocabulary into Shoelace variant tokens. Many-to-one is
    // expected (ghost+text → "text"); an unknown value degrades to the kind
    // default, never a raw pass-through.
    const VARIANT_MAP_BY_KIND = {
        button: BUTTON_VARIANT_TO_SHOELACE,
        badge: SEVERITY_TO_SHOELACE,
        alert: SEVERITY_TO_SHOELACE,
        toast: SEVERITY_TO_SHOELACE
    };

    const VARIANT_DEFAULT_BY_KIND = {
        button: "default",
        badge: "neutral",
        alert: "primary",
        toast: "primary"
    };

    const SIZE_TO_SHOELACE = { xs: "small", sm: "small", md: "medium", lg: "large", xl: "large" };

    // P49: single entry point. Maps a kind's semantic variant onto the Shoelace
    // variant token. Unknown / absent → the kind's documented default.
    function mapVariant(kind, variant) {
        const table = VARIANT_MAP_BY_KIND[kind] || {};
        const fallback = VARIANT_DEFAULT_BY_KIND[kind] || "default";
        if (variant === undefined || variant === null || variant === "") {
            return fallback;
        }
        return table[variant] || fallback;
    }

    function mapButtonVariant(variant) {
        return mapVariant("button", variant);
    }

    function mapSize(size) {
        if (!size) {
            return undefined;
        }
        return SIZE_TO_SHOELACE[size];
    }

    function mapComponentToShoelace(kind, props) {
        props = props || {};
        const tag = KIND_TO_SHOELACE[kind];
        const attributes = {};

        if (kind === "button") {
            attributes.variant = mapButtonVariant(typeof props.variant === "string" ? props.variant : undefined);
            const size = mapSize(typeof props.size === "string" ? props.size : undefined);
            if (size) {
                attributes.size = size;
            }
            // P71: explicit outline flag → Shoelace boolean `outline` attribute.
            // Marked as a boolean attr (true) so it renders as bare ` outline`,
            // not outline="". The variant-derived look is untouched (no double-apply).
            if (props.outline === true) {
                attributes.outline = true;
            }
        }
        else if (typeof props.size === "string") {
            const size = mapSize(props.size);
            if (size) {
                attributes.size = size;
            }
        }

        if (!tag) {
            return {
                tag: "div",
                attributes: Object.assign({}, attributes, { "data-wa-kind": kind, "data-wa-fallback": "true" }),
                fallback: true
            };
        }

        return { tag: tag, attributes: attributes, fallback: false };
    }

    function shoelaceAttrs(attributes) {
        return Object.keys(attributes || {})
            .map(function (key) {
                // P71: a boolean attribute (value === true) renders bare (e.g.
                // ` outline`) rather than as outline="".
                if (attributes[key] === true) {
                    return " " + key;
                }
                return " " + key + "=\"" + escapeAttribute(String(attributes[key])) + "\"";
            })
            .join("");
    }

    // --- layout / region helpers ------------------------------------------------

    function sanitizeClassSuffix(value) {
        return String(value === undefined || value === null ? "" : value)
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, "-")
            .replace(/^-+|-+$/g, "") || "default";
    }

    // P70: a numeric dimension is treated as pixels; a CSS string passes through.
    function cssDimension(value) {
        if (typeof value === "number") {
            return value + "px";
        }
        const text = String(value);
        return /^\d+$/.test(text) ? text + "px" : text;
    }

    // P70: defensive — strip characters that could break out of a style value.
    function sanitizeStyleValue(value) {
        return String(value === undefined || value === null ? "" : value).replace(/[<>"';{}]/g, "");
    }

    // P70: rewrite an `asset:<id>` reference to the app-scoped backend proxy URL.
    // The real media-store URL lives only on the server; the client only ever sees
    // /webapp/<appId>/asset/<id>. Non-asset values (http(s)/data:/relative) pass
    // through unchanged. Path-traversal characters in the id are rejected.
    function resolveAssetSrc(src, ctx) {
        if (typeof src !== "string") {
            return src;
        }
        const prefix = "asset:";
        if (src.indexOf(prefix) !== 0) {
            return src;
        }
        const id = src.slice(prefix.length);
        const appId = ctx && ctx.appId ? String(ctx.appId) : "";
        // Reject ids that could escape the proxy's lookup (defence in depth; the
        // server endpoint validates again).
        if (!appId || !/^[A-Za-z0-9._-]+$/.test(id)) {
            return "";
        }
        return "/webapp/" + encodeURIComponent(appId) + "/asset/" + encodeURIComponent(id);
    }

    function getLayoutVariant(layoutId) {
        return ["horizontal", "vertical", "app", "grid", "absolute", "dialog"].indexOf(layoutId) !== -1 ? layoutId : "custom";
    }

    function getComponentLayoutProps(component) {
        const layout = component.props && component.props.layout;
        return layout && typeof layout === "object" ? layout : {};
    }

    function regionContainsInput(region) {
        return region.components.some(function (component) {
            if (component.kind === "input") {
                return true;
            }
            if (component.kind === "container") {
                return component.regions.some(regionContainsInput);
            }
            return false;
        });
    }

    function wrapRenderedComponentHtml(component, layoutId, innerHtml) {
        const layoutVariant = getLayoutVariant(layoutId || "");
        const layoutProps = getComponentLayoutProps(component);
        const styles = [];

        if (layoutVariant === "grid") {
            if (layoutProps.col !== undefined) {
                styles.push("grid-column:" + layoutProps.col + (layoutProps.colSize !== undefined ? " / span " + layoutProps.colSize : ""));
            }
            if (layoutProps.row !== undefined) {
                styles.push("grid-row:" + layoutProps.row + (layoutProps.rowSize !== undefined ? " / span " + layoutProps.rowSize : ""));
            }
        }

        if (layoutVariant === "absolute") {
            if (layoutProps.x !== undefined) {
                styles.push("left:" + layoutProps.x + "px");
            }
            if (layoutProps.y !== undefined) {
                styles.push("top:" + layoutProps.y + "px");
            }
        }

        const styleAttribute = styles.length > 0 ? " style=\"" + escapeAttribute(styles.join(";")) + "\"" : "";

        // P30/P38: tag the wrapper of every value-bearing control with its node id so a
        // browser-side change reports a `change` event on the originating node (the
        // thin client's change listener reads data-webapp-source here). Buttons and
        // table rows carry their own source attribute inline; click stays separate.
        // Tabs/pagination/stepper handle their source attributes inline in their own
        // rendering branches below.
        const changeKinds = ["input", "select", "checkbox", "radio", "switch", "textarea", "datepicker", "slider"];
        const sourceAttribute = component && changeKinds.indexOf(component.kind) !== -1
            ? " data-webapp-source=\"" + escapeAttribute(component.id) + "\" data-webapp-event=\"change\""
            : "";

        // P53: tag every component wrapper with its node id so a ui-action
        // interaction command (show / hide / enable / disable / focus / reset /
        // open / close) can resolve its `target` to the rendered element. The
        // overlay that applies the command lives client-side only (ADR 0005);
        // the serializer just emits the stable hook so server and client markup
        // stay byte-identical (P26).
        const nodeAttribute = component && component.id !== undefined
            ? " data-webapp-node=\"" + escapeAttribute(component.id) + "\""
            : "";

        return "<div class=\"webapp-item webapp-item--" + escapeAttribute(layoutVariant) + "\"" + nodeAttribute + sourceAttribute + styleAttribute + ">" + innerHtml + "</div>";
    }

    function renderRegionHtml(region, layoutId, ctx) {
        const title = region.title ? "<h3>" + escapeHtml(region.title) + "</h3>" : "";
        const components = region.components
            .map(function (component) { return renderComponentHtml(component, layoutId, ctx); })
            .join("");
        const layoutVariant = getLayoutVariant(layoutId);
        const slotClass = sanitizeClassSuffix(region.name);
        return "<section class=\"webapp-slot webapp-slot--" + escapeAttribute(slotClass) + "\">" + title
            + "<div class=\"webapp-slot-body webapp-slot-body--" + escapeAttribute(layoutVariant) + "\">" + components + "</div></section>";
    }

    function renderLayoutHtml(layoutId, regions, ctx) {
        const variant = getLayoutVariant(layoutId);
        return "<div class=\"webapp-layout webapp-layout--" + escapeAttribute(variant) + "\">"
            + regions.map(function (region) { return renderRegionHtml(region, layoutId, ctx); }).join("")
            + "</div>";
    }

    // --- per-component serialization -------------------------------------------

    function renderComponentHtml(component, layoutId, ctx) {
        ctx = ctx || {};

        if (component.kind === "text") {
            // P49: text has no Shoelace element. Its semantic Ebene-2 variant
            // (heading-1…/body/muted/…) surfaces as a class modifier so a backend
            // / theme can style it. Default "body" when absent.
            const textVariant = (component.props && typeof component.props.variant === "string" && component.props.variant)
                ? component.props.variant
                : "body";
            const variantClass = " webapp-text--" + sanitizeClassSuffix(textVariant);
            return wrapRenderedComponentHtml(component, layoutId, "<div class=\"webapp-text" + variantClass + "\">" + escapeHtml(component.text) + "</div>");
        }

        // P69: ui-icon — renders an <sl-icon> from a backend-neutral
        // { library, name } value (or a bare string). The resolved icon value
        // lives in component.props.icon (literal) or component.value (resolved
        // dynamic binding). size/color come from props.
        if (component.kind === "icon") {
            const iconValue = (component.value !== undefined && component.value !== null)
                ? component.value
                : (component.props && component.props.icon);
            const iconHtml = renderIconHtml(iconValue, {
                size: component.props && component.props.size,
                color: component.props && component.props.color
            });
            return wrapRenderedComponentHtml(component, layoutId, iconHtml);
        }

        if (component.kind === "button") {
            const label = escapeHtml(component.label);
            const action = component.events && component.events[0] ? component.events[0].action : undefined;
            const inForm = Boolean(ctx.formId);
            const attrs = shoelaceAttrs(mapComponentToShoelace("button", component.props || {}).attributes);
            // P69: optional prefix icon. A literal icon value sits in props.icon;
            // a dynamic icon binding is resolved by the renderer into the same
            // props.icon slot (bind.icon → resolvedProps.icon), so reading
            // props.icon covers both cases.
            // P69: optional prefix icon (default = label, prefix = icon). A literal
            // icon value sits in props.icon; a dynamic icon binding is resolved by
            // the renderer into the same props.icon slot, so reading props.icon
            // covers both cases. The label is the button's default slot.
            const iconHtml = renderIconHtml(component.props && component.props.icon, { slot: "prefix" });
            const labelContent = iconHtml + label;

            // P71: link mode. "button" (default) = event source; "url" = real
            // hyperlink via sl-button href (renders an <a>); "navigate" = in-app
            // navigation (data-webapp-navigate carries the route; the client
            // intercepts the click, navigates, and still reports the click).
            // href is binding-capable: a literal sits in props.href; a dynamic
            // binding is resolved by the renderer into the same props.href slot
            // (bind.href → resolvedProps.href), so reading props.href covers both.
            const linkMode = (component.props && component.props.linkMode) || "button";
            const href = component.props && component.props.href;
            const hrefStr = (href === undefined || href === null) ? "" : String(href);

            if (component.disabled) {
                return wrapRenderedComponentHtml(component, layoutId, "<sl-button" + attrs + " disabled>" + labelContent + "</sl-button>");
            }

            // "url" mode: a real hyperlink. sl-button[href] renders an <a>; it is
            // NOT a click-dispatch event source (navigation is the browser's job).
            if (linkMode === "url" && hrefStr) {
                const hrefAttr = " href=\"" + escapeAttribute(hrefStr) + "\"";
                return wrapRenderedComponentHtml(component, layoutId, "<sl-button" + attrs + hrefAttr + ">" + labelContent + "</sl-button>");
            }

            // P30: EVERY enabled button is interactive and reports its click as an
            // event — independent of any action wiring. The browser reports WHAT
            // HAPPENED via data-webapp-source (the originating node id) + the event
            // type; the thin client POSTs /event and the runtime emits msg.ui on
            // that node's output port. data-webapp-action is retained only for the
            // legacy no-JS GET fallback (removed in P32). The href attribute is
            // deliberately NOT set so a button stays a button.
            const dataAttrs = [
                " data-webapp-source=\"" + escapeAttribute(component.id) + "\"",
                " data-webapp-event=\"" + (inForm ? "submit" : "click") + "\""
            ];

            // P71: "navigate" mode — the client intercepts the click and performs an
            // in-app navigation to the carried route, while still informing the flow.
            if (linkMode === "navigate" && hrefStr) {
                dataAttrs.push(" data-webapp-navigate=\"" + escapeAttribute(hrefStr) + "\"");
            }

            if (action) {
                dataAttrs.push(" data-webapp-action=\"" + escapeAttribute(action) + "\"");
            }

            if (inForm) {
                dataAttrs.push(" data-webapp-form=\"" + escapeAttribute(ctx.formId) + "\"");
            }

            return wrapRenderedComponentHtml(component, layoutId, "<sl-button" + attrs + dataAttrs.join("") + ">" + labelContent + "</sl-button>");
        }

        if (component.kind === "table") {
            const columns = Array.isArray(component.props.columns) ? component.props.columns : [];
            const rows = Array.isArray(component.rows) ? component.rows : [];
            // P30: a table emits rowSelect when it declares the event (or, legacy,
            // a selectAction). The event TYPE reported is "rowSelect" (events.md);
            // an action reference is no longer required for the row to be selectable.
            // Events are in component.props.events (renderer preserves props) or component.events.
            const rawTableEvents = Array.isArray(component.props.events) ? component.props.events
                : (Array.isArray(component.events) ? component.events : []);
            const tableEvents = rawTableEvents.map(function (event) {
                return typeof event === "string" ? event : (event && event.event);
            });
            const selectEvent = (component.events || []).find(function (event) {
                return (typeof event === "string" ? event : (event && event.event)) === "select"
                    || (typeof event === "string" ? event : (event && event.event)) === "rowSelect";
            });
            const declaresRowSelect = tableEvents.indexOf("rowSelect") !== -1 || tableEvents.indexOf("select") !== -1;
            const selectAction = component.props.selectAction || (selectEvent && selectEvent.action) || undefined;
            const rowSelectable = declaresRowSelect || Boolean(selectAction);
            const header = columns.map(function (col) {
                return "<th>" + escapeHtml(col.label || col.key || col) + "</th>";
            }).join("");
            const body = rows.length === 0
                ? "<tr><td colspan=\"" + Math.max(columns.length, 1) + "\">No rows loaded.</td></tr>"
                : rows.map(function (row) {
                    const rowId = row.id !== undefined ? String(row.id) : "";
                    const cells = columns.map(function (col, index) {
                        const key = col.key || col;
                        const value = escapeHtml(row[key] === undefined || row[key] === null ? "" : row[key]);

                        if (index === 0 && rowSelectable && rowId) {
                            const actionAttr = selectAction
                                ? " data-webapp-action=\"" + escapeAttribute(selectAction) + "\""
                                : "";
                            return "<td><a class=\"webapp-link\" href=\"#\""
                                + actionAttr
                                + " data-webapp-source=\"" + escapeAttribute(component.id) + "\""
                                + " data-webapp-event=\"rowSelect\""
                                + " data-webapp-rowid=\"" + escapeAttribute(rowId) + "\">" + value + "</a></td>";
                        }

                        return "<td>" + value + "</td>";
                    }).join("");
                    return "<tr data-webapp-row=\"" + escapeAttribute(rowId) + "\">" + cells + "</tr>";
                }).join("");
            return wrapRenderedComponentHtml(component, layoutId, "<table class=\"webapp-table\"><thead><tr>" + header + "</tr></thead><tbody>" + body + "</tbody></table>");
        }

        if (component.kind === "input") {
            const label = String(component.props.label || component.id);
            const name = String(component.props.path || component.id);
            const inputType = String(component.props.inputType || "text");
            const value = component.value === undefined || component.value === null ? "" : String(component.value);
            const disabled = component.disabled ? " disabled" : "";
            const attrs = shoelaceAttrs(mapComponentToShoelace("input", component.props || {}).attributes);
            return wrapRenderedComponentHtml(component, layoutId, "<sl-input" + attrs + " label=\"" + escapeAttribute(label)
                + "\" type=\"" + escapeAttribute(inputType) + "\" name=\"" + escapeAttribute(name) + "\" value=\"" + escapeAttribute(value) + "\"" + disabled + "></sl-input>");
        }

        if (component.kind === "container") {
            const childLayoutId = component.layoutId;
            const hasInputs = component.regions.some(regionContainsInput);
            const formId = hasInputs ? "webapp-form-" + component.id : undefined;
            const childCtx = Object.assign({}, ctx, { formId: formId });
            const content = renderLayoutHtml(childLayoutId, component.regions, childCtx);
            const body = formId
                ? "<form class=\"webapp-form\" id=\"" + escapeAttribute(formId) + "\" data-webapp-form-id=\"" + escapeAttribute(formId) + "\">" + content + "</form>"
                : content;
            const descriptor = mapComponentToShoelace(component.kind, component.props || {});
            // P49: container's semantic Ebene-2 variant (card/panel/section/
            // transparent) surfaces as a class modifier + a data hook. Default
            // "card" when absent.
            const containerVariant = (component.props && typeof component.props.variant === "string" && component.props.variant)
                ? component.props.variant
                : "card";
            const containerVariantClass = " webapp-container--" + sanitizeClassSuffix(containerVariant);
            const inner = "<" + descriptor.tag + " class=\"webapp-container" + containerVariantClass
                + "\" variant=\"" + escapeAttribute(containerVariant) + "\">" + body + "</" + descriptor.tag + ">";
            return wrapRenderedComponentHtml(component, layoutId, inner);
        }

        if (component.kind === "select") {
            const label = String(component.props.label || component.id);
            const name = String(component.props.path || component.id);
            const value = component.value === undefined || component.value === null ? "" : String(component.value);
            const disabled = component.disabled ? " disabled" : "";
            const attrs = shoelaceAttrs(mapComponentToShoelace("select", component.props || {}).attributes);
            const options = Array.isArray(component.props.options) ? component.props.options : [];
            const optionHtml = options.map(function (opt) {
                const val = escapeAttribute(String(opt.value !== undefined ? opt.value : opt));
                const lbl = escapeHtml(String(opt.label !== undefined ? opt.label : (opt.value !== undefined ? opt.value : opt)));
                const selected = val === escapeAttribute(value) ? " selected" : "";
                return "<sl-option value=\"" + val + "\"" + selected + ">" + lbl + "</sl-option>";
            }).join("");
            return wrapRenderedComponentHtml(component, layoutId, "<sl-select" + attrs + " label=\"" + escapeAttribute(label)
                + "\" name=\"" + escapeAttribute(name) + "\" value=\"" + escapeAttribute(value) + "\"" + disabled + ">" + optionHtml + "</sl-select>");
        }

        if (component.kind === "checkbox") {
            const label = String(component.props.label || component.id);
            const name = String(component.props.path || component.id);
            const checked = component.value ? " checked" : "";
            const disabled = component.disabled ? " disabled" : "";
            const attrs = shoelaceAttrs(mapComponentToShoelace("checkbox", component.props || {}).attributes);
            return wrapRenderedComponentHtml(component, layoutId, "<sl-checkbox" + attrs + " name=\"" + escapeAttribute(name) + "\"" + checked + disabled + ">" + escapeHtml(label) + "</sl-checkbox>");
        }

        if (component.kind === "radio") {
            const label = String(component.props.label || component.id);
            const name = String(component.props.path || component.id);
            const value = component.value === undefined || component.value === null ? "" : String(component.value);
            const options = Array.isArray(component.props.options) ? component.props.options : [];
            const radioHtml = options.map(function (opt) {
                const val = escapeAttribute(String(opt.value !== undefined ? opt.value : opt));
                const lbl = escapeHtml(String(opt.label !== undefined ? opt.label : (opt.value !== undefined ? opt.value : opt)));
                return "<sl-radio value=\"" + val + "\">" + lbl + "</sl-radio>";
            }).join("");
            const attrs = shoelaceAttrs(mapComponentToShoelace("radio", component.props || {}).attributes);
            return wrapRenderedComponentHtml(component, layoutId, "<sl-radio-group" + attrs + " label=\"" + escapeAttribute(label)
                + "\" name=\"" + escapeAttribute(name) + "\" value=\"" + escapeAttribute(value) + "\">" + radioHtml + "</sl-radio-group>");
        }

        if (component.kind === "switch") {
            const label = String(component.props.label || component.id);
            const name = String(component.props.path || component.id);
            const checked = component.value ? " checked" : "";
            const disabled = component.disabled ? " disabled" : "";
            // P73: render labelOn/labelOff as Shoelace sl-switch attributes
            const labelOn = component.props.labelOn ? " label-on=\"" + escapeAttribute(String(component.props.labelOn)) + "\"" : "";
            const labelOff = component.props.labelOff ? " label-off=\"" + escapeAttribute(String(component.props.labelOff)) + "\"" : "";
            const attrs = shoelaceAttrs(mapComponentToShoelace("switch", component.props || {}).attributes);
            return wrapRenderedComponentHtml(component, layoutId, "<sl-switch" + attrs + " name=\"" + escapeAttribute(name) + "\"" + checked + disabled + labelOn + labelOff + ">" + escapeHtml(label) + "</sl-switch>");
        }

        if (component.kind === "textarea") {
            const label = String(component.props.label || component.id);
            const name = String(component.props.path || component.id);
            const value = component.value === undefined || component.value === null ? "" : String(component.value);
            const rows = component.props.rows ? " rows=\"" + escapeAttribute(String(component.props.rows)) + "\"" : "";
            const disabled = component.disabled ? " disabled" : "";
            const attrs = shoelaceAttrs(mapComponentToShoelace("textarea", component.props || {}).attributes);
            return wrapRenderedComponentHtml(component, layoutId, "<sl-textarea" + attrs + " label=\"" + escapeAttribute(label)
                + "\" name=\"" + escapeAttribute(name) + "\"" + rows + " value=\"" + escapeAttribute(value) + "\"" + disabled + "></sl-textarea>");
        }

        if (component.kind === "datepicker") {
            const label = String(component.props.label || component.id);
            const name = String(component.props.path || component.id);
            const value = component.value === undefined || component.value === null ? "" : String(component.value);
            const disabled = component.disabled ? " disabled" : "";
            // P73: map mode to the correct HTML input type.
            // mode=datetime → type="datetime-local", mode=time → type="time", default → type="date"
            const mode = component.props.mode;
            const inputType = mode === "datetime" ? "datetime-local" : mode === "time" ? "time" : "date";
            const attrs = shoelaceAttrs(mapComponentToShoelace("datepicker", component.props || {}).attributes);
            return wrapRenderedComponentHtml(component, layoutId, "<sl-input" + attrs + " type=\"" + inputType + "\" label=\"" + escapeAttribute(label)
                + "\" name=\"" + escapeAttribute(name) + "\" value=\"" + escapeAttribute(value) + "\"" + disabled + "></sl-input>");
        }

        if (component.kind === "slider") {
            const label = String(component.props.label || "");
            const name = String(component.props.path || component.id);
            const value = component.value === undefined || component.value === null ? "" : String(component.value);
            const min = component.props.min !== undefined ? " min=\"" + escapeAttribute(String(component.props.min)) + "\"" : "";
            const max = component.props.max !== undefined ? " max=\"" + escapeAttribute(String(component.props.max)) + "\"" : "";
            const step = component.props.step !== undefined ? " step=\"" + escapeAttribute(String(component.props.step)) + "\"" : "";
            // P73: Shoelace sl-range shows its value tooltip by default (tooltip="top").
            // The spec default for showValue is false — suppress the tooltip unless explicitly
            // enabled by setting tooltip="none" when showValue is absent or false.
            const tooltip = component.props.showValue ? "" : " tooltip=\"none\"";
            const attrs = shoelaceAttrs(mapComponentToShoelace("slider", component.props || {}).attributes);
            return wrapRenderedComponentHtml(component, layoutId, "<sl-range" + attrs + " label=\"" + escapeAttribute(label)
                + "\" name=\"" + escapeAttribute(name) + "\"" + min + max + step + " value=\"" + escapeAttribute(value) + "\"" + tooltip + "></sl-range>");
        }

        if (component.kind === "alert") {
            // component.props.message may be a raw binding object (when the message
            // binding has not been resolved through bind.value). Use component.value
            // (the resolved binding) as the canonical source; fall back to props.message
            // only when it is a plain string.
            const rawMessage = component.props.message;
            const message = String(
                component.value !== undefined && component.value !== null ? component.value
                    : (typeof rawMessage === "string" ? rawMessage : "")
            );
            const severity = component.props.severity ? String(component.props.severity) : undefined;
            const shoelaceVariant = mapVariant("alert", severity);
            const dismissible = component.props.dismissible ? " closable" : "";
            const title = component.props.title ? "<strong>" + escapeHtml(String(component.props.title)) + "</strong><br>" : "";
            const attrs = shoelaceAttrs(mapComponentToShoelace("alert", component.props || {}).attributes);
            // P90: icon field — "auto" resolves to a severity-appropriate Bootstrap icon;
            // "none" (or absent) suppresses the icon slot; any other value is an icon name.
            const iconValue = component.props.icon;
            let iconHtml = "";
            if (iconValue !== undefined && iconValue !== null && iconValue !== "none") {
                const SEVERITY_ICON_MAP = {
                    primary: "info-circle",
                    info: "info-circle",
                    success: "check-circle",
                    warning: "exclamation-triangle",
                    danger: "x-circle",
                    neutral: "circle"
                };
                const resolvedIcon = (iconValue === "auto")
                    ? (SEVERITY_ICON_MAP[severity] || SEVERITY_ICON_MAP.primary)
                    : iconValue;
                iconHtml = renderIconHtml(resolvedIcon, { slot: "icon" });
            }
            return wrapRenderedComponentHtml(component, layoutId, "<sl-alert" + attrs + " variant=\"" + escapeAttribute(shoelaceVariant) + "\" open" + dismissible + ">" + iconHtml + title + escapeHtml(message) + "</sl-alert>");
        }

        if (component.kind === "badge") {
            const value = component.value === undefined || component.value === null ? "" : String(component.value);
            // P49: badge's semantic variant is `severity`. `variant`/`displayType`
            // (count/dot/status) is a display type and is NOT a severity.
            const severity = component.props.severity ? String(component.props.severity) : undefined;
            const shoelaceVariant = mapVariant("badge", severity);
            const attrs = shoelaceAttrs(mapComponentToShoelace("badge", component.props || {}).attributes);
            return wrapRenderedComponentHtml(component, layoutId, "<sl-badge" + attrs + " variant=\"" + escapeAttribute(shoelaceVariant) + "\">" + escapeHtml(value) + "</sl-badge>");
        }

        if (component.kind === "progress") {
            const value = component.value === undefined || component.value === null ? 0 : Number(component.value);
            const label = component.props.label ? " label=\"" + escapeAttribute(String(component.props.label)) + "\"" : "";
            const attrs = shoelaceAttrs(mapComponentToShoelace("progress", component.props || {}).attributes);
            return wrapRenderedComponentHtml(component, layoutId, "<sl-progress-bar" + attrs + " value=\"" + escapeAttribute(String(value)) + "\"" + label + "></sl-progress-bar>");
        }

        if (component.kind === "breadcrumb") {
            const items = Array.isArray(component.props.items) ? component.props.items : (Array.isArray(component.value) ? component.value : []);
            const src = escapeAttribute(component.id);
            const itemHtml = items.map(function (item, idx) {
                const label = escapeHtml(String(item.label !== undefined ? item.label : item));
                const href = item.href ? " href=\"" + escapeAttribute(item.href) + "\"" : "";
                // P75: a navigable item is one with a `path`, except the last item
                // (the current page is never clickable). Clicking it dispatches a
                // `navigate` event carrying params.path on the breadcrumb's port.
                const isLast = idx === items.length - 1;
                const navAttr = (!isLast && item.path)
                    ? " data-webapp-source=\"" + src + "\" data-webapp-navigate-path=\"" + escapeAttribute(String(item.path)) + "\""
                    : "";
                return "<sl-breadcrumb-item" + href + navAttr + ">" + label + "</sl-breadcrumb-item>";
            }).join("");
            return wrapRenderedComponentHtml(component, layoutId, "<sl-breadcrumb>" + itemHtml + "</sl-breadcrumb>");
        }

        if (component.kind === "tabs") {
            const tabs = Array.isArray(component.props.tabs) ? component.props.tabs : [];
            const activeTab = component.value !== undefined && component.value !== null ? String(component.value) : "";
            const tabHtml = tabs.map(function (tab) {
                const panelId = escapeAttribute(String(tab.id !== undefined ? tab.id : tab));
                const label = escapeHtml(String(tab.label !== undefined ? tab.label : (tab.id !== undefined ? tab.id : tab)));
                const active = activeTab && (tab.id !== undefined ? tab.id : tab) === activeTab ? " active" : "";
                return "<sl-tab slot=\"nav\" panel=\"" + panelId + "\"" + active + ">" + label + "</sl-tab>";
            }).join("");
            const panelHtml = tabs.map(function (tab) {
                return "<sl-tab-panel name=\"" + escapeAttribute(String(tab.id !== undefined ? tab.id : tab)) + "\"></sl-tab-panel>";
            }).join("");
            // P38: sl-tab-group fires sl-tab-show (Shoelace custom event) when a tab is
            // selected. The client listens for sl-tab-show on the root element, finds the
            // closest [data-webapp-source][data-webapp-event="sl-tab-show"] ancestor, and
            // dispatches a `change` event with params.value = the newly-active tab id.
            const tabSourceAttr = " data-webapp-source=\"" + escapeAttribute(component.id) + "\" data-webapp-event=\"sl-tab-show\"";
            return wrapRenderedComponentHtml(component, layoutId, "<sl-tab-group" + tabSourceAttr + ">" + tabHtml + panelHtml + "</sl-tab-group>");
        }

        if (component.kind === "accordion") {
            const items = Array.isArray(component.props.sections) ? component.props.sections : [];
            const detailsHtml = items.map(function (item) {
                // P53: each section carries a stable data-webapp-part hook (its id,
                // falling back to the label) so a ui-action open/close command can
                // disclose one section by `part` (ADR 0005).
                const partId = String(item.id !== undefined ? item.id : (item.label !== undefined ? item.label : item));
                return "<sl-details data-webapp-part=\"" + escapeAttribute(partId) + "\" summary=\"" + escapeAttribute(String(item.label !== undefined ? item.label : (item.id !== undefined ? item.id : item))) + "\"></sl-details>";
            }).join("");
            return wrapRenderedComponentHtml(component, layoutId, "<div class=\"webapp-accordion\">" + detailsHtml + "</div>");
        }

        if (component.kind === "menu") {
            const appId = ctx.appId;
            const items = Array.isArray(component.props.items) ? component.props.items : (Array.isArray(component.value) ? component.value : []);
            const src = escapeAttribute(component.id);
            const itemHtml = items.map(function (item) {
                const label = escapeHtml(String(item.label !== undefined ? item.label : item));
                const href = item.href
                    ? " href=\"" + escapeAttribute(item.href) + "\""
                    : item.route
                        ? " href=\"/webapp/" + encodeURIComponent(appId) + item.route + "\""
                        : "";
                // P75: an internal item (no external `href`, has `route`/`path`) is
                // navigable: clicking it dispatches a `navigate` event carrying
                // params.path on the menu's port. External href items open in the
                // browser and emit nothing.
                const navPath = item.href ? undefined : (item.route || item.path);
                const navAttr = navPath
                    ? " data-webapp-source=\"" + src + "\" data-webapp-navigate-path=\"" + escapeAttribute(String(navPath)) + "\""
                    : "";
                return "<sl-menu-item" + href + navAttr + ">" + label + "</sl-menu-item>";
            }).join("");
            return wrapRenderedComponentHtml(component, layoutId, "<sl-menu>" + itemHtml + "</sl-menu>");
        }

        if (component.kind === "avatar") {
            // component.value is the resolved src binding (routed through bind.value
            // in toComponentDefinitions); component.props.src is the raw binding
            // object when no value binding was resolved. Prefer the resolved value.
            const rawSrc = component.props.src;
            const src = (component.value !== undefined && component.value !== null) ? component.value
                : (typeof rawSrc === "string" ? rawSrc : undefined);
            const label = String(component.props.label || component.id);
            const initials = String(component.props.initials || "");
            const srcAttr = src ? " image=\"" + escapeAttribute(String(src)) + "\"" : "";
            const initialsAttr = !src && initials ? " initials=\"" + escapeAttribute(initials) + "\"" : "";
            const attrs = shoelaceAttrs(mapComponentToShoelace("avatar", component.props || {}).attributes);
            // P69: icon fallback — only when no src and no initials resolve.
            const iconHtml = (!src && !initials)
                ? renderIconHtml(component.props && component.props.icon, { slot: "icon" })
                : "";
            return wrapRenderedComponentHtml(component, layoutId, "<sl-avatar" + attrs + srcAttr + initialsAttr + " label=\"" + escapeAttribute(label) + "\">" + iconHtml + "</sl-avatar>");
        }

        // P70: image — renders a native <img>. The src binding is resolved by the
        // renderer into component.value (routed through bind.value, as for avatar);
        // an unresolved raw src binding falls back to component.props.src. An
        // `asset:<id>` value is rewritten to the app-scoped backend proxy URL so
        // the real media-store URL is never exposed to the client (obfuscation).
        if (component.kind === "image") {
            const rawSrc = component.props && component.props.src;
            let src = (component.value !== undefined && component.value !== null) ? component.value
                : (typeof rawSrc === "string" ? rawSrc : undefined);
            src = resolveAssetSrc(src, ctx);
            const alt = component.props && component.props.alt !== undefined ? String(component.props.alt) : "";
            const fit = component.props && component.props.fit;
            const width = component.props && component.props.width;
            const height = component.props && component.props.height;
            const fallbackSrc = component.props && component.props.fallbackSrc;
            const styles = [];
            if (fit) {
                styles.push("object-fit: " + sanitizeStyleValue(String(fit)));
            }
            if (width !== undefined && width !== null && width !== "") {
                styles.push("width: " + cssDimension(width));
            }
            if (height !== undefined && height !== null && height !== "") {
                styles.push("height: " + cssDimension(height));
            }
            const styleAttr = styles.length > 0 ? " style=\"" + escapeAttribute(styles.join("; ")) + "\"" : "";
            const srcAttr = src ? " src=\"" + escapeAttribute(String(src)) + "\"" : "";
            // P70: a static fallback URL via the native onerror handler — swaps to
            // fallbackSrc once on load failure (guarded so it cannot loop).
            const onErrorAttr = fallbackSrc
                ? " onerror=\"this.onerror=null;this.src='" + escapeAttribute(String(fallbackSrc)) + "'\""
                : "";
            return wrapRenderedComponentHtml(component, layoutId,
                "<img" + srcAttr + " alt=\"" + escapeAttribute(alt) + "\"" + styleAttr + onErrorAttr + ">");
        }

        // P38: pagination — renders prev/next buttons. Each button carries
        // data-webapp-source + data-webapp-event="click" + data-webapp-page so the
        // click handler can dispatch a `change` event with params.page.
        if (component.kind === "pagination") {
            // component.value = resolved page binding (from renderer); component.props.page = raw binding obj.
            // Prefer the resolved value; fall back to props.page then component.page (legacy path).
            const rawPage = component.value !== undefined && component.value !== null ? component.value
                : (component.props && component.props.page !== undefined ? component.props.page : component.page);
            const rawTotal = (component.props && component.props.totalPages !== undefined) ? component.props.totalPages
                : component.totalPages;
            // If the value is a binding object (kind + value), extract the value.
            const resolveLiteral = function (v) {
                return (v && typeof v === "object" && v.kind === "literal") ? v.value : v;
            };
            const currentPage = rawPage !== undefined && rawPage !== null ? Number(resolveLiteral(rawPage)) : 1;
            const totalPages = rawTotal !== undefined && rawTotal !== null ? Number(resolveLiteral(rawTotal)) : 0;
            const src = " data-webapp-source=\"" + escapeAttribute(component.id) + "\"";
            const prevPage = Math.max(1, currentPage - 1);
            const nextPage = totalPages > 0 ? Math.min(totalPages, currentPage + 1) : currentPage + 1;
            const prevDisabled = currentPage <= 1 ? " disabled" : "";
            const nextDisabled = totalPages > 0 && currentPage >= totalPages ? " disabled" : "";
            const prevBtn = "<sl-button" + src + " data-webapp-event=\"click\" data-webapp-page=\"" + prevPage + "\"" + prevDisabled + " size=\"small\">&#8249;</sl-button>";
            const nextBtn = "<sl-button" + src + " data-webapp-event=\"click\" data-webapp-page=\"" + nextPage + "\"" + nextDisabled + " size=\"small\">&#8250;</sl-button>";
            const pageLabel = "<span class=\"webapp-pagination-page\">" + escapeHtml(String(currentPage)) + (totalPages > 0 ? " / " + escapeHtml(String(totalPages)) : "") + "</span>";
            return wrapRenderedComponentHtml(component, layoutId, "<div class=\"webapp-pagination\">" + prevBtn + pageLabel + nextBtn + "</div>");
        }

        // P38: stepper — renders a step indicator. Each step carries
        // data-webapp-source + data-webapp-event="click" + data-webapp-step so the
        // click handler can dispatch a `change` event with params.value (step index).
        if (component.kind === "stepper") {
            const steps = Array.isArray(component.props.steps) ? component.props.steps : (Array.isArray(component.steps) ? component.steps : []);
            const activeStep = component.activeStep !== undefined && component.activeStep !== null ? Number(component.activeStep) : (component.value !== undefined && component.value !== null ? Number(component.value) : 0);
            const src = " data-webapp-source=\"" + escapeAttribute(component.id) + "\"";
            const orientation = String(component.variant || component.props.orientation || "horizontal");
            const stepHtml = steps.map(function (step, idx) {
                const label = escapeHtml(String(step.label !== undefined ? step.label : (step.id !== undefined ? step.id : step)));
                const isActive = idx === activeStep ? " webapp-step--active" : "";
                return "<button class=\"webapp-step" + isActive + "\"" + src + " data-webapp-event=\"click\" data-webapp-step=\"" + idx + "\" type=\"button\">" + label + "</button>";
            }).join("");
            return wrapRenderedComponentHtml(component, layoutId, "<div class=\"webapp-stepper webapp-stepper--" + escapeAttribute(orientation) + "\">" + stepHtml + "</div>");
        }

        // P45: list — renders a <ul> with <li> items. Each item carries
        // data-webapp-source + data-webapp-event="click" so clicks dispatch
        // an itemClick event with params.value = item id (or label).
        if (component.kind === "list") {
            const rawItems = Array.isArray(component.props.items) ? component.props.items
                : (Array.isArray(component.value) ? component.value : []);
            const src = " data-webapp-source=\"" + escapeAttribute(component.id) + "\"";
            // Events are stored in props.componentEvents (to avoid Zod uiEventName validation).
            const allEvents = Array.isArray(component.props.componentEvents) ? component.props.componentEvents
                : (Array.isArray(component.events) ? component.events : []);
            const declaresClick = allEvents.some(function (ev) {
                return (typeof ev === "string" ? ev : (ev && ev.event)) === "itemClick";
            });
            const itemHtml = rawItems.map(function (item) {
                const label = escapeHtml(String(item.label !== undefined ? item.label : (item.id !== undefined ? item.id : item)));
                const itemId = item.id !== undefined ? String(item.id) : label;
                if (declaresClick) {
                    return "<li class=\"webapp-list-item\"><a class=\"webapp-link\" href=\"#\""
                        + src + " data-webapp-event=\"click\" data-webapp-item=\"" + escapeAttribute(itemId) + "\">"
                        + label + "</a></li>";
                }
                return "<li class=\"webapp-list-item\">" + label + "</li>";
            }).join("");
            return wrapRenderedComponentHtml(component, layoutId, "<ul class=\"webapp-list\">" + itemHtml + "</ul>");
        }

        // P83: ui-divider — static horizontal/vertical separator (sl-divider or webapp-divider fallback).
        if (component.kind === "divider") {
            const orientation = (component.props && component.props.orientation) ? String(component.props.orientation) : "horizontal";
            const label = (component.props && component.props.label) ? String(component.props.label) : "";
            const orientationAttr = orientation === "vertical" ? " vertical" : "";
            const inner = label
                ? "<sl-divider" + orientationAttr + ">" + escapeHtml(label) + "</sl-divider>"
                : "<sl-divider" + orientationAttr + "></sl-divider>";
            return wrapRenderedComponentHtml(component, layoutId, inner);
        }

        // P57: ui-log — persistent error/log display that updates live via SSE "error" events.
        // Rendered as a collapsible panel with an empty log list; entries are appended by the
        // thin client when it receives SSE "error" frames. The data attributes carry the node's
        // config so the client can apply the severity filter and max-entries cap without a
        // round-trip to the server.
        if (component.kind === "log") {
            const minSeverity = component.props.minSeverity ? String(component.props.minSeverity) : "debug";
            const maxEntries = component.props.maxEntries !== undefined ? String(component.props.maxEntries) : "50";
            // Shoelace sl-details: `open` attribute = expanded; absence = collapsed.
            // collapsed=true → omit `open`; collapsed=false/undefined → add ` open`.
            const openAttr = component.props.collapsed ? "" : " open";
            const nodeId = escapeAttribute(component.id);
            return wrapRenderedComponentHtml(component, layoutId,
                "<sl-details class=\"webapp-log\" data-webapp-log=\"" + nodeId + "\""
                + " data-log-min-severity=\"" + escapeAttribute(minSeverity) + "\""
                + " data-log-max-entries=\"" + escapeAttribute(maxEntries) + "\""
                + openAttr + ">"
                + "<span slot=\"summary\">Log</span>"
                + "<ul class=\"webapp-log-entries\"></ul>"
                + "</sl-details>"
            );
        }

        return "";
    }

    // P64: map a dialog layout region name onto the native <sl-dialog> slot.
    // The "dialog" preset names them directly; other presets (vertical/grid …)
    // only have a "content" region, which lands in the default (body) slot.
    function dialogSlotForRegion(regionName) {
        if (regionName === "header") {
            return "label";
        }
        if (regionName === "header-actions") {
            return "header-actions";
        }
        if (regionName === "footer") {
            return "footer";
        }
        // "content" and anything else → default slot (the dialog body).
        return "";
    }

    // P64: dialogs render as a native Shoelace <sl-dialog>. It provides the close
    // button (X), ESC/overlay dismissal, focus-trap and a11y natively — no bespoke
    // chrome. `closable === false` ⇒ native `no-header` (removes X + title). Each
    // dialog-layout region maps to a native slot; the slot attribute MUST sit on
    // the direct light-DOM child of <sl-dialog>, so we emit one slotted wrapper
    // per region (NOT the webapp-layout/-slot wrappers, which Shoelace would not
    // project). data-webapp-dialog lets the client find the element for dismissal.
    function renderDialogHtml(dialog, ctx) {
        const closable = dialog.closable !== false;
        const slotted = (dialog.regions || []).map(function (region) {
            const slotName = dialogSlotForRegion(region.name);
            const slotAttr = slotName ? " slot=\"" + escapeAttribute(slotName) + "\"" : "";
            const body = region.components
                .map(function (component) { return renderComponentHtml(component, dialog.layoutId, ctx); })
                .join("");
            const slotClass = sanitizeClassSuffix(region.name);
            return "<div class=\"webapp-dialog-region webapp-dialog-region--" + escapeAttribute(slotClass) + "\""
                + slotAttr + ">" + body + "</div>";
        }).join("");

        return "<sl-dialog class=\"webapp-dialog\" data-webapp-dialog=\"" + escapeAttribute(dialog.id) + "\" open"
            + " label=\"" + escapeAttribute(dialog.title || dialog.id) + "\""
            + (closable ? "" : " no-header") + ">"
            + slotted + "</sl-dialog>";
    }

    // Serialize a whole snapshot into { grid, dialogs }. `ctx` carries appId and
    // params; both server and client pass the same shape so the output matches.
    function serializeSnapshot(snapshot, ctx) {
        ctx = ctx || {};
        const baseCtx = { appId: ctx.appId, params: snapshot.params, formId: undefined };
        const grid = renderLayoutHtml(snapshot.layout.id, snapshot.regions, baseCtx);
        const dialogs = (snapshot.dialogs || []).map(function (dialog) {
            return renderDialogHtml(dialog, baseCtx);
        }).join("");
        return { grid: grid, dialogs: dialogs };
    }

    return {
        escapeHtml: escapeHtml,
        escapeAttribute: escapeAttribute,
        mapVariant: mapVariant,
        mapComponentToShoelace: mapComponentToShoelace,
        sanitizeClassSuffix: sanitizeClassSuffix,
        getLayoutVariant: getLayoutVariant,
        regionContainsInput: regionContainsInput,
        normalizeIcon: normalizeIcon,
        renderIconHtml: renderIconHtml,
        renderComponentHtml: renderComponentHtml,
        renderRegionHtml: renderRegionHtml,
        renderLayoutHtml: renderLayoutHtml,
        renderDialogHtml: renderDialogHtml,
        serializeSnapshot: serializeSnapshot
    };
}));

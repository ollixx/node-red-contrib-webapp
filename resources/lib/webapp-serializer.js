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
 *
 * P96: verified that ui-button kind="button" is rendered as <sl-button> with
 * the component label as the default slot. The render pipeline was confirmed
 * correct (components-filter, kind mapping, renderer, serializer all handle
 * "button" consistently).
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
    //
    // P238 (ADR 0039 §4): `color` goes through the SHARED resolveColorValue (as
    // ui-divider/ui-list already did) instead of being emitted raw. So a
    // `token:primary` becomes `color:var(--wa-color-primary)` — never the invalid
    // `color:token:primary` — a free colour (#ff0000 / rgb(…)) passes through
    // unchanged, and an unknown bare word now yields NO style instead of a broken
    // one. (resolveColorValue is a hoisted function declaration below.)
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
        const resolvedIconColor = resolveColorValue(options.color);
        const styleAttr = resolvedIconColor
            ? " style=\"color:" + escapeAttribute(resolvedIconColor) + "\""
            : "";
        return "<sl-icon" + slotAttr + classAttr + " name=\"" + escapeAttribute(value.name) + "\""
            + libraryAttr + styleAttr + "></sl-icon>";
    }

    // P183: resolveColorValue — shared color-resolution helper for base-field `color`.
    // Maps a raw color value to a safe CSS value or undefined (no style attr).
    //
    //   token:<name>    → var(--wa-color-<token>)          (P238 — the EXPLICIT form)
    //   semantic token  → var(--wa-color-<token>)          (bare word, pre-P238)
    //     "primary" | "success" | "warning" | "danger" | "neutral" | "info"
    //   valid CSS value → passed through unchanged
    //     #hex, rgb(), hsl(), CSS named color, var(...), etc.
    //   empty / unknown → undefined (no style attribute emitted — no broken CSS)
    //
    // Detection strategy: the `token:` prefix is authoritative (P238). Otherwise a
    // semantic token is any of the six known bare words. Everything else is
    // classified: CSS functions (#hex, rgb(...), var(...)) pass through; known CSS
    // keyword names pass through; unknown bare words are IGNORED.
    var SEMANTIC_COLOR_TOKENS = {
        primary: "var(--wa-color-primary)",
        success: "var(--wa-color-success)",
        warning: "var(--wa-color-warning)",
        danger:  "var(--wa-color-danger)",
        neutral: "var(--wa-color-neutral)",
        info:    "var(--wa-color-primary)"   // info → primary (no separate --wa-color-info token)
    };

    // P238 (ADR 0039 §1) — the token→CSS-custom-property map for the EXPLICIT
    // `token:<name>` form written by the editor's Theme-Token typedInput.
    // MIRRORS packages/schema COLOR_TOKENS (this file is served to the browser and
    // cannot import it). The design tokens are defined on :root in nodes/webapp.js
    // and overridden by ui-app's `designTokens` — so a token FOLLOWS the app theme.
    //
    // It is a SUPERSET of SEMANTIC_COLOR_TOKENS by exactly one entry: `muted`
    // (→ --wa-color-text-muted). `muted` is deliberately NOT added to the bare-word
    // map above: doing so would change what an existing bare `color: "muted"`
    // renders on the ~30 base-colour nodes (today: nothing). Reachable only via the
    // new token path → strictly additive (P238 acceptance: "Additiv auf den
    // übrigen ~30 Knoten").
    var COLOR_TOKEN_PREFIX = "token:";
    var COLOR_TOKEN_VARS = {
        primary: "var(--wa-color-primary)",
        success: "var(--wa-color-success)",
        warning: "var(--wa-color-warning)",
        danger:  "var(--wa-color-danger)",
        neutral: "var(--wa-color-neutral)",
        info:    "var(--wa-color-primary)",  // info → primary (no separate --wa-color-info token)
        muted:   "var(--wa-color-text-muted)"
    };

    // A small set of always-safe CSS colour keywords. Extended keywords (rebeccapurple
    // etc.) are intentionally not listed — we do not need to be exhaustive; a hex/rgb
    // value covers any custom colour. This list handles common names so that e.g.
    // color="red" works for quick testing.
    var CSS_COLOR_KEYWORDS = {
        red: 1, green: 1, blue: 1, yellow: 1, orange: 1, purple: 1, pink: 1,
        brown: 1, black: 1, white: 1, gray: 1, grey: 1, cyan: 1, magenta: 1,
        transparent: 1, currentcolor: 1, inherit: 1, initial: 1, unset: 1
    };

    function resolveColorValue(raw) {
        if (raw === undefined || raw === null || raw === "") {
            return undefined;
        }
        var s = String(raw).trim();
        if (s === "") {
            return undefined;
        }
        var lower = s.toLowerCase();
        // 0. P238: the EXPLICIT `token:<name>` form. Authoritative — an unknown
        // token yields NO style (never `color:token:foo`, never a raw bare word).
        if (lower.indexOf(COLOR_TOKEN_PREFIX) === 0) {
            var tokenName = lower.slice(COLOR_TOKEN_PREFIX.length).trim();
            return COLOR_TOKEN_VARS[tokenName] || undefined;
        }
        // 1. Semantic token?
        if (SEMANTIC_COLOR_TOKENS[lower]) {
            return SEMANTIC_COLOR_TOKENS[lower];
        }
        // 2. CSS function or hash (#hex / rgb() / hsl() / var())?
        if (s[0] === "#" || /^(rgb|rgba|hsl|hsla|var|color)\s*\(/i.test(s)) {
            return s;
        }
        // 3. Known CSS colour keyword (case-insensitive)?
        if (CSS_COLOR_KEYWORDS[lower]) {
            return s;
        }
        // 4. Unknown / bare word → IGNORE (no broken inline style).
        return undefined;
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

    // P111: ui-text typographic role → semantic HTML element. The `style` field
    // maps 1:1 onto a tag; an unknown/absent style falls back to <p> (body).
    const TEXT_STYLE_TAG = {
        "heading-1": "h1",
        "heading-2": "h2",
        "heading-3": "h3",
        "body": "p",
        "caption": "small",
        "label": "span",
        "code": "code"
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
        return ["horizontal", "vertical", "app", "grid", "absolute", "dialog", "breadcrumb"].indexOf(layoutId) !== -1 ? layoutId : "custom";
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
            // P168/P169 (ADR 0018): `tabs` and `accordion` components nest their
            // per-section content in `regions` (like a container), so recurse too.
            if ((component.kind === "container" || component.kind === "tabs" || component.kind === "accordion") && Array.isArray(component.regions)) {
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

        // ADR 0025 (KISS markup): the per-item `<div class="webapp-item">` wrapper is
        // pure nesting for a plain DISPLAY LEAF with no placement — e.g. a ui-repeat of
        // ui-text emitted `div.webapp-item > p` per item, a stack of wrapper divs. For
        // those leaf kinds, drop the wrapper and stamp the hook attributes
        // (`data-webapp-node`) directly onto the leaf's own element — the keyed morph
        // keys on `[data-webapp-node]` wherever it sits, and the action overlay already
        // resolves `closest("[data-webapp-node]")`. Scoped to display leaves only:
        // containers/tabs/accordion/table keep their wrapper (they ARE a box, and their
        // structural markup is matched elsewhere), and change-controls keep it (their
        // `data-webapp-source` change plumbing reads the wrapper). Placement (grid/
        // absolute) always keeps the wrapper — it carries the placement style.
        const LEAF_DISPLAY_KINDS = ["text", "badge", "icon", "image", "divider", "avatar", "progress", "skeleton"];
        const isLeafDisplay = component && LEAF_DISPLAY_KINDS.indexOf(component.kind) !== -1;
        if (styles.length === 0 && isLeafDisplay && nodeAttribute && !sourceAttribute) {
            const injected = injectLeafHookAttributes(innerHtml, nodeAttribute);
            if (injected !== null) {
                return injected;
            }
        }

        return "<div class=\"webapp-item webapp-item--" + escapeAttribute(layoutVariant) + "\"" + nodeAttribute + sourceAttribute + styleAttribute + ">" + innerHtml + "</div>";
    }

    // ADR 0025: insert hook attributes (already space-prefixed) at the END of the
    // leaf's opening tag (before the closing `>`, or before `/` for a self-closing
    // tag), so the leaf carries `data-webapp-node` instead of a wrapper div WHILE
    // keeping the natural `<tag class="…"` prefix intact (no attribute-order churn for
    // markup matchers). Returns null (→ caller keeps the wrapper) when the html does
    // not begin with a single element open tag.
    function injectLeafHookAttributes(html, attrs) {
        const open = /^\s*<[a-zA-Z][a-zA-Z0-9-]*/.exec(html);
        if (!open) {
            return null;
        }
        const gt = html.indexOf(">", open.index + open[0].length);
        if (gt === -1) {
            return null;
        }
        const insertAt = html.charAt(gt - 1) === "/" ? gt - 1 : gt;
        return html.slice(0, insertAt) + attrs + html.slice(insertAt);
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
            const props = component.props || {};

            // P221 (ADR 0035): read-only FORM-FIELD presentation. When
            // `display === "formField"`, render the SAME bound value as a
            // labelled, read-only row using the very same <sl-input> element as
            // ui-input (readonly) — so the label column and value baseline line
            // up pixel-for-pixel with an adjacent ui-input. `component.text` is
            // the already-normalised display value (ADR 0032: a missing store
            // key resolves to "" and stays empty here, never "?"). Read-only:
            // no name (no form value), no event/source attrs → no emission.
            if (props.display === "formField") {
                const fieldLabel = (props.label === undefined || props.label === null)
                    ? ""
                    : String(props.label);
                const fieldValue = (component.text === undefined || component.text === null)
                    ? ""
                    : String(component.text);
                return wrapRenderedComponentHtml(
                    component,
                    layoutId,
                    "<sl-input class=\"webapp-text-field\" label=\"" + escapeAttribute(fieldLabel)
                        + "\" value=\"" + escapeAttribute(fieldValue) + "\" readonly"
                        + " data-webapp-text-field=\"true\"></sl-input>"
                );
            }

            // P111: two orthogonal axes. `style` (typographic role) selects a
            // semantic HTML element AND a webapp-text--<role> class; `variant`
            // (semantic colour) adds a webapp-text--color-<c> class. Defaults:
            // style → "body" (<p>); colour → "default" (inherit, no colour class).
            const textStyle = (typeof props.style === "string" && props.style) ? props.style : "body";
            const tag = TEXT_STYLE_TAG[textStyle] || "p";
            let classes = "webapp-text webapp-text--" + sanitizeClassSuffix(textStyle);
            const colour = (typeof props.variant === "string" && props.variant && props.variant !== "default")
                ? props.variant
                : "";
            if (colour) {
                classes += " webapp-text--color-" + sanitizeClassSuffix(colour);
            }
            return wrapRenderedComponentHtml(component, layoutId, "<" + tag + " class=\"" + classes + "\">" + escapeHtml(component.text) + "</" + tag + ">");
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
            const placeholder = component.props.placeholder
                ? " placeholder=\"" + escapeAttribute(String(component.props.placeholder)) + "\""
                : "";
            const attrs = shoelaceAttrs(mapComponentToShoelace("input", component.props || {}).attributes);
            return wrapRenderedComponentHtml(component, layoutId, "<sl-input" + attrs + " label=\"" + escapeAttribute(label)
                + "\" type=\"" + escapeAttribute(inputType) + "\" name=\"" + escapeAttribute(name) + "\" value=\"" + escapeAttribute(value) + "\"" + placeholder + disabled + "></sl-input>");
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
            // P198: container's semantic Ebene-2 variant (card/panel/section/
            // transparent) drives BOTH the element choice AND styling.
            // card → <sl-card> (Shoelace chrome: border + padding + elevation).
            // panel/section/transparent → plain <div> + webapp-container--<v> class
            // (no sl-card chrome; CSS in the page shell provides the distinction).
            // P199: span → <span> + webapp-container--span (inline flow; CSS
            // overrides the base display:grid and forces all children inline too).
            // This is the single rendering source for ui-container AND ui-repeat
            // wrapper (P197). Default "card" when absent.
            const containerVariant = (component.props && typeof component.props.variant === "string" && component.props.variant)
                ? component.props.variant
                : "card";
            const containerVariantClass = " webapp-container--" + sanitizeClassSuffix(containerVariant);
            const isCardVariant = containerVariant === "card";
            const isSpanVariant = containerVariant === "span";
            const tag = isCardVariant ? "sl-card" : (isSpanVariant ? "span" : "div");
            const inner = "<" + tag + " class=\"webapp-container" + containerVariantClass + "\">"
                + body + "</" + tag + ">";
            return wrapRenderedComponentHtml(component, layoutId, inner);
        }

        if (component.kind === "select") {
            const label = String(component.props.label || component.id);
            const name = String(component.props.path || component.id);
            const value = component.value === undefined || component.value === null ? "" : String(component.value);
            const disabled = component.disabled ? " disabled" : "";
            const attrs = shoelaceAttrs(mapComponentToShoelace("select", component.props || {}).attributes);
            const options = Array.isArray(component.props.options) ? component.props.options : [];
            // P133: placeholder is a bindable value — render it as the sl-select
            // `placeholder` attribute when present (empty/undefined → omitted).
            const placeholderValue = component.props.placeholder;
            const placeholder = placeholderValue !== undefined && placeholderValue !== null && String(placeholderValue).length > 0
                ? " placeholder=\"" + escapeAttribute(String(placeholderValue)) + "\""
                : "";
            const optionHtml = options.map(function (opt) {
                const val = escapeAttribute(String(opt.value !== undefined ? opt.value : opt));
                const lbl = escapeHtml(String(opt.label !== undefined ? opt.label : (opt.value !== undefined ? opt.value : opt)));
                const selected = val === escapeAttribute(value) ? " selected" : "";
                return "<sl-option value=\"" + val + "\"" + selected + ">" + lbl + "</sl-option>";
            }).join("");
            return wrapRenderedComponentHtml(component, layoutId, "<sl-select" + attrs + " label=\"" + escapeAttribute(label)
                + "\" name=\"" + escapeAttribute(name) + "\" value=\"" + escapeAttribute(value) + "\"" + placeholder + disabled + ">" + optionHtml + "</sl-select>");
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
            // P127: disabled binding — mirror pattern from other input nodes.
            const disabled = component.disabled ? " disabled" : "";
            const attrs = shoelaceAttrs(mapComponentToShoelace("radio", component.props || {}).attributes);
            return wrapRenderedComponentHtml(component, layoutId, "<sl-radio-group" + attrs + " label=\"" + escapeAttribute(label)
                + "\" name=\"" + escapeAttribute(name) + "\" value=\"" + escapeAttribute(value) + "\"" + disabled + ">" + radioHtml + "</sl-radio-group>");
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
            // P149/P237 (ADR 0012): `placeholder` is a bindable value — the renderer
            // resolves a state/store binding into component.props.placeholder. Emit it
            // as the sl-input `placeholder` attribute when present (empty/undefined →
            // omitted), mirroring ui-input / ui-select.
            const placeholderValue = component.props.placeholder;
            const placeholder = placeholderValue !== undefined && placeholderValue !== null && String(placeholderValue).length > 0
                ? " placeholder=\"" + escapeAttribute(String(placeholderValue)) + "\""
                : "";
            const attrs = shoelaceAttrs(mapComponentToShoelace("datepicker", component.props || {}).attributes);
            return wrapRenderedComponentHtml(component, layoutId, "<sl-input" + attrs + " type=\"" + inputType + "\" label=\"" + escapeAttribute(label)
                + "\" name=\"" + escapeAttribute(name) + "\" value=\"" + escapeAttribute(value) + "\"" + placeholder + disabled + "></sl-input>");
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
            // P126: disabled binding — mirror pattern from other input nodes.
            const disabled = component.disabled ? " disabled" : "";
            const attrs = shoelaceAttrs(mapComponentToShoelace("slider", component.props || {}).attributes);
            return wrapRenderedComponentHtml(component, layoutId, "<sl-range" + attrs + " label=\"" + escapeAttribute(label)
                + "\" name=\"" + escapeAttribute(name) + "\"" + min + max + step + " value=\"" + escapeAttribute(value) + "\"" + tooltip + disabled + "></sl-range>");
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
            // P91: duration + countdown — Shoelace native attributes.
            // duration: emitted as `duration="<ms>"` (Shoelace auto-hides after ms).
            // countdown: emitted as `countdown="ltr"` (Shoelace progress bar).
            // For backends without native support, the client-side JS fallback in
            // webapp-client.js handles auto-hide (timeout) and countdown (CSS animation).
            const durationAttr = component.props.duration ? " duration=\"" + escapeAttribute(String(Number(component.props.duration))) + "\"" : "";
            // P100 regression workaround: emit countdown as data-webapp-countdown instead of the
            // Shoelace attribute. Shoelace's @watch("countdown") fires before the shadow DOM
            // is ready, causing animate() to throw on a null reference. webapp-client.js
            // sets el.countdown = "ltr" after the element upgrades. See bug fix notes.
            const countdownAttr = component.props.countdown ? " data-webapp-countdown=\"ltr\"" : "";
            return wrapRenderedComponentHtml(component, layoutId, "<sl-alert" + attrs + " variant=\"" + escapeAttribute(shoelaceVariant) + "\" open" + dismissible + durationAttr + countdownAttr + ">" + iconHtml + title + escapeHtml(message) + "</sl-alert>");
        }

        if (component.kind === "badge") {
            const value = component.value === undefined || component.value === null ? "" : String(component.value);
            // P92: badge uses `variant` for its semantic colour role (renamed from
            // `severity`). Back-compat: also accept `severity` on the component props
            // in case old snapshot data is still in flight.
            const badgeVariant = component.props.variant
                ? String(component.props.variant)
                : (component.props.severity ? String(component.props.severity) : undefined);
            const shoelaceVariant = mapVariant("badge", badgeVariant);
            // P92: displayType maps to Shoelace `pill` attribute.
            //   "pill"    → pill attribute present
            //   "square"  → data-display-type="square" (custom CSS required)
            //   "rounded" → default (no extra attribute)
            const displayType = component.props.displayType ? String(component.props.displayType) : undefined;
            const pillAttr = displayType === "pill" ? " pill" : "";
            const squareAttr = displayType === "square" ? " data-display-type=\"square\"" : "";
            // P92: pulsating → Shoelace `pulse` boolean attribute.
            const pulseAttr = component.props.pulsating === true ? " pulse" : "";
            // P103: size field removed — no data-size attribute emitted any more.
            const attrs = shoelaceAttrs(mapComponentToShoelace("badge", component.props || {}).attributes);
            return wrapRenderedComponentHtml(component, layoutId, "<sl-badge" + attrs + " variant=\"" + escapeAttribute(shoelaceVariant) + "\"" + pillAttr + squareAttr + pulseAttr + ">" + escapeHtml(value) + "</sl-badge>");
        }

        if (component.kind === "progress") {
            // P234: ui-progress conformance. Three display forms + indeterminate +
            // showValue + max scaling. Everything derives from the resolved props:
            //   displayType  "bar" (Default) | "spinner" | "circular"
            //   value        resolved binding (number). Missing/null/NaN → indeterminate
            //   max          upper bound of the range (Default 100; non-positive → 100)
            //   showValue    render the percentage (relative to max) as visible text
            //   label        a11y label + visible fallback text (when showValue off)
            //   color        base-field colour → Shoelace `--indicator-color` (fill)
            const props = component.props || {};
            const displayType = props.displayType ? String(props.displayType) : "bar";

            // Base-field `color` colours the fill/indicator. All three Shoelace
            // progress elements (sl-progress-bar / sl-progress-ring / sl-spinner)
            // expose the indicator colour as the `--indicator-color` custom property.
            const progressColor = resolveColorValue(props.color);
            const colorStyle = progressColor ? " style=\"--indicator-color:" + escapeAttribute(progressColor) + "\"" : "";

            // `label` is the a11y label (attribute) and, when showValue is off, the
            // visible slot text (P137: resolved value, literal or bound).
            const labelText = (props.label === undefined || props.label === null) ? "" : String(props.label);
            const labelAttr = labelText ? " label=\"" + escapeAttribute(labelText) + "\"" : "";

            // Determinate value + max scaling. hasValue is false for undefined/null/
            // empty-string/NaN → indeterminate (NOT value 0).
            const rawValue = component.value;
            const hasValue = !(rawValue === undefined || rawValue === null
                || (typeof rawValue === "string" && rawValue.trim() === "")
                || Number.isNaN(Number(rawValue)));
            const maxNum = (props.max === undefined || props.max === null
                || Number.isNaN(Number(props.max)) || Number(props.max) <= 0)
                ? 100 : Number(props.max);
            let percent = 0;
            if (hasValue) {
                percent = (Number(rawValue) / maxNum) * 100;
                if (percent < 0) { percent = 0; }
                if (percent > 100) { percent = 100; }
            }
            const percentValue = Math.round(percent);
            const showValue = props.showValue === true;

            // displayType "spinner" → always the indeterminate Shoelace spinner
            // (no value bar, showValue ignored — a spinner has no percentage).
            if (displayType === "spinner") {
                return wrapRenderedComponentHtml(component, layoutId, "<sl-spinner" + labelAttr + colorStyle + "></sl-spinner>");
            }

            // No value → indeterminate. A bar animates endlessly (Shoelace
            // `indeterminate` attribute); a circular has no indeterminate mode, so
            // the indeterminate circular loader IS a spinner. showValue is ignored.
            if (!hasValue) {
                if (displayType === "circular") {
                    return wrapRenderedComponentHtml(component, layoutId, "<sl-spinner" + labelAttr + colorStyle + "></sl-spinner>");
                }
                return wrapRenderedComponentHtml(component, layoutId, "<sl-progress-bar indeterminate" + labelAttr + colorStyle + "></sl-progress-bar>");
            }

            // Determinate: slot text is the percentage when showValue is on, else the
            // resolved label (visible), else empty.
            const slotText = showValue ? (percentValue + "%") : escapeHtml(labelText);
            const valueAttr = " value=\"" + escapeAttribute(String(percentValue)) + "\"";
            if (displayType === "circular") {
                return wrapRenderedComponentHtml(component, layoutId, "<sl-progress-ring" + valueAttr + labelAttr + colorStyle + ">" + slotText + "</sl-progress-ring>");
            }
            return wrapRenderedComponentHtml(component, layoutId, "<sl-progress-bar" + valueAttr + labelAttr + colorStyle + ">" + slotText + "</sl-progress-bar>");
        }

        if (component.kind === "breadcrumb") {
            const src = escapeAttribute(component.id);

            // P95: mode (c) — layout="breadcrumb" with child nodes in "default" slot.
            // Each child in the "default" region becomes a <sl-breadcrumb-item>;
            // clicking it emits a `click` event with params.action = child node id.
            // The "separator" region's content is slotted into the breadcrumb separator.
            if (component.layoutId === "breadcrumb" && Array.isArray(component.regions)) {
                const defaultRegion = component.regions.find(function (r) { return r.name === "default"; });
                const separatorRegion = component.regions.find(function (r) { return r.name === "separator"; });

                const separatorHtml = separatorRegion && separatorRegion.components && separatorRegion.components.length > 0
                    ? "<span slot=\"separator\">" + separatorRegion.components.map(function (c) {
                        return renderComponentHtml(c, "breadcrumb", ctx);
                    }).join("") + "</span>"
                    : "";

                const itemHtml = defaultRegion && defaultRegion.components ? defaultRegion.components.map(function (child) {
                    const childSrc = escapeAttribute(component.id);
                    const action = escapeAttribute(String(child.id));
                    const clickAttr = " data-webapp-source=\"" + childSrc + "\" data-webapp-breadcrumb-action=\"" + action + "\"";
                    return "<sl-breadcrumb-item" + clickAttr + ">" + renderComponentHtml(child, "breadcrumb", ctx) + "</sl-breadcrumb-item>";
                }).join("") : "";

                return wrapRenderedComponentHtml(component, layoutId, "<sl-breadcrumb>" + separatorHtml + itemHtml + "</sl-breadcrumb>");
            }

            // P95: modes (a) & (b) — static items array.
            // (a) string item  → label = string, action = string
            // (b) object item  → { label, action?, active? }
            //   active=true: item marks the current page (Shoelace renders it
            //   differently); item remains clickable.
            //   ALL items emit a `click` event via data-webapp-breadcrumb-action.
            const rawItems = Array.isArray(component.props.items) ? component.props.items : (Array.isArray(component.value) ? component.value : []);
            const itemHtml = rawItems.map(function (item) {
                // Normalise to { label, action, active }
                const isStr = typeof item === "string";
                const label = escapeHtml(isStr ? item : String(item.label !== undefined ? item.label : ""));
                const action = isStr ? item : (item.action !== undefined ? item.action : item.label);
                const active = !isStr && item.active === true;

                // All items: click emits { event:"click", params:{ action } }
                const clickAttr = " data-webapp-source=\"" + src + "\" data-webapp-breadcrumb-action=\"" + escapeAttribute(String(action)) + "\"";
                // Shoelace renders an active breadcrumb item differently (last-segment style);
                // we pass aria-current="page" which Shoelace honours for the active state.
                const activeAttr = active ? " aria-current=\"page\"" : "";
                return "<sl-breadcrumb-item" + clickAttr + activeAttr + ">" + label + "</sl-breadcrumb-item>";
            }).join("");
            return wrapRenderedComponentHtml(component, layoutId, "<sl-breadcrumb>" + itemHtml + "</sl-breadcrumb>");
        }

        if (component.kind === "tabs") {
            // P168 (ADR 0018, Model 1a): tabs are DERIVED from the ui-tab children.
            // `component.props.tabs` carries the per-child metadata { id, label,
            // icon, active } (the renderer resolved each tab's label binding), and
            // `component.regions` carries one region per child (region.name = the
            // child/tab id) holding that tab's content subtree. We render one
            // <sl-tab> (nav) + one <sl-tab-panel> (body) per child; the active tab
            // is component.value (resolved activeTab, default = first child).
            const tabs = Array.isArray(component.props.tabs) ? component.props.tabs : [];
            const regions = Array.isArray(component.regions) ? component.regions : [];
            const activeTab = component.value !== undefined && component.value !== null ? String(component.value) : "";
            const tabHtml = tabs.map(function (tab) {
                const panelId = escapeAttribute(String(tab.id));
                const iconHtml = tab.icon ? "<sl-icon slot=\"prefix\" name=\"" + escapeAttribute(String(tab.icon)) + "\"></sl-icon>" : "";
                const label = escapeHtml(String(tab.label !== undefined ? tab.label : tab.id));
                const active = (activeTab && String(tab.id) === activeTab) || tab.active ? " active" : "";
                return "<sl-tab slot=\"nav\" panel=\"" + panelId + "\"" + active + ">" + iconHtml + label + "</sl-tab>";
            }).join("");
            const panelHtml = tabs.map(function (tab) {
                const region = regions.find(function (r) { return String(r.name) === String(tab.id); });
                const body = region
                    ? region.components.map(function (c) { return renderComponentHtml(c, layoutId, ctx); }).join("")
                    : "";
                return "<sl-tab-panel name=\"" + escapeAttribute(String(tab.id)) + "\">" + body + "</sl-tab-panel>";
            }).join("");
            // P38: sl-tab-group fires sl-tab-show (Shoelace custom event) when a tab is
            // selected. The client listens for sl-tab-show on the root element, finds the
            // closest [data-webapp-source][data-webapp-event="sl-tab-show"] ancestor, and
            // dispatches a `change` event with params.value = the newly-active tab id.
            const tabSourceAttr = " data-webapp-source=\"" + escapeAttribute(component.id) + "\" data-webapp-event=\"sl-tab-show\"";
            return wrapRenderedComponentHtml(component, layoutId, "<sl-tab-group" + tabSourceAttr + ">" + tabHtml + panelHtml + "</sl-tab-group>");
        }

        if (component.kind === "accordion") {
            // P169 (ADR 0018, Model 1a): sections are DERIVED from the
            // ui-accordion-section children. `component.props.sections` carries the
            // per-child metadata { id, label, icon, open } (the renderer resolved
            // each section's label binding), and `component.regions` carries one
            // region per child (region.name = the child/section id) holding that
            // section's content subtree. We render one <sl-details> per child; the
            // open section is component.value (resolved openSection, default = first
            // child). Mirrors the tabs branch above.
            const items = Array.isArray(component.props.sections) ? component.props.sections : [];
            const regions = Array.isArray(component.regions) ? component.regions : [];
            const openSection = component.value !== undefined && component.value !== null ? String(component.value) : "";
            const detailsHtml = items.map(function (item) {
                // P53: each section carries a stable data-webapp-part hook (its id)
                // so a ui-action open/close command can disclose one section by
                // `part` (ADR 0005). `name` mirrors the tab-panel name for E2E.
                const partId = String(item.id !== undefined ? item.id : (item.label !== undefined ? item.label : item));
                const summary = escapeAttribute(String(item.label !== undefined ? item.label : partId));
                const iconHtml = item.icon ? "<sl-icon slot=\"icon\" name=\"" + escapeAttribute(String(item.icon)) + "\"></sl-icon>" : "";
                const open = (openSection && partId === openSection) || item.open ? " open" : "";
                const region = regions.find(function (r) { return String(r.name) === partId; });
                const body = region
                    ? region.components.map(function (c) { return renderComponentHtml(c, layoutId, ctx); }).join("")
                    : "";
                return "<sl-details name=\"" + escapeAttribute(partId) + "\" data-webapp-part=\"" + escapeAttribute(partId) + "\" summary=\"" + summary + "\"" + open + ">" + iconHtml + body + "</sl-details>";
            }).join("");
            return wrapRenderedComponentHtml(component, layoutId, "<div class=\"webapp-accordion\">" + detailsHtml + "</div>");
        }

        if (component.kind === "menu") {
            const appId = ctx.appId;
            const items = Array.isArray(component.props.items) ? component.props.items : (Array.isArray(component.value) ? component.value : []);
            const src = escapeAttribute(component.id);
            // P157 (ADR 0012): `activeItem` is the resolved active route/path
            // (read-only display value). The matching item is marked active so the
            // current route is visually highlighted in the menu.
            const activeRoute = (component.props.activeItem !== undefined && component.props.activeItem !== null)
                ? String(component.props.activeItem)
                : undefined;
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
                // P157: an item whose route/path matches the resolved activeItem
                // carries data-webapp-active + aria-current for the active highlight.
                const itemRoute = item.route !== undefined ? item.route : item.path;
                const isActive = activeRoute !== undefined && itemRoute !== undefined && String(itemRoute) === activeRoute;
                const activeAttr = isActive ? " data-webapp-active=\"true\" aria-current=\"page\"" : "";
                return "<sl-menu-item" + href + navAttr + activeAttr + ">" + label + "</sl-menu-item>";
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
            // P94: initials binding is routed through bind.initials → resolvedProps.initials
            // → component.props.initials. Guard against non-strings (binding objects
            // resolve to the bound value; if unresolved, props.initials is the binding
            // object itself — reject those to avoid "[object Object]" in the DOM).
            const rawInitials = component.props.initials;
            const initials = typeof rawInitials === "string" ? rawInitials : "";
            const srcAttr = src ? " image=\"" + escapeAttribute(String(src)) + "\"" : "";
            const initialsAttr = !src && initials ? " initials=\"" + escapeAttribute(initials) + "\"" : "";
            // P93: shape → native sl-avatar shape attribute (circle|square|rounded).
            // Only emit when explicitly set (circle is sl-avatar default, omitting is fine).
            const shapeAttr = component.props.shape ? " shape=\"" + escapeAttribute(String(component.props.shape)) + "\"" : "";
            // P93: size → data-size attribute (sl-avatar has no native size attr;
            // it uses the --size CSS custom property instead). The adapter generic
            // path would emit size="small/medium/large" which sl-avatar ignores;
            // we bypass the adapter and emit data-size so CSS can target it.
            const sizeAttr = component.props.size ? " data-size=\"" + escapeAttribute(String(component.props.size)) + "\"" : "";
            // P94: variant → data-variant attribute. Shoelace sl-avatar has no native
            // variant support; Bootstrap adapters and custom CSS read data-variant.
            const variantAttr = component.props.variant ? " data-variant=\"" + escapeAttribute(String(component.props.variant)) + "\"" : "";
            // P93: do NOT pass avatar through the shoelace adapter for size — the
            // adapter maps "sm" → "small" which sl-avatar ignores. We emit size via
            // data-size above. Pass an empty props so attrs contains only fallback
            // data-wa-kind when no native tag is found (none expected here).
            // P69: icon fallback — only when no src and no initials resolve.
            const iconHtml = (!src && !initials)
                ? renderIconHtml(component.props && component.props.icon, { slot: "icon" })
                : "";
            return wrapRenderedComponentHtml(component, layoutId, "<sl-avatar" + srcAttr + initialsAttr + shapeAttr + sizeAttr + variantAttr + " label=\"" + escapeAttribute(label) + "\">" + iconHtml + "</sl-avatar>");
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

        // P171: list — renders a <ul> with <li> items per the FIXED item schema.
        // Each element is a String (shorthand → {label}) or an object
        // {id?,label,value?,icon?}. `label` is required (object form); a missing
        // label renders "?" for THAT row only (no implicit mapping, extra fields
        // ignored). A non-array root → empty list (no crash). `value` is ALWAYS
        // carried in the itemClick event (row.value); the node-wide `displayValue`
        // (none/secondary/badge) controls DISPLAY only; at `badge` the value renders
        // as a badge in `badgeVariant`.
        if (component.kind === "list") {
            const rawItems = Array.isArray(component.props.items) ? component.props.items
                : (Array.isArray(component.value) ? component.value : []);
            const displayValue = component.props.displayValue ? String(component.props.displayValue) : "none";
            const badgeVariant = component.props.badgeVariant ? String(component.props.badgeVariant) : "neutral";
            // P208: item-field mapping — WHICH raw-entity field is the label/value/id/
            // icon. Absent ⇒ the historical hard-coded names, so shaped-item lists render
            // unchanged. FLAT field names only (no dot-path) in this stage. Only the
            // DERIVED label/id/value/icon read through the mapping; the row payload
            // (data-webapp-row → itemClick.row) stays the FULL raw entity.
            const labelField = component.props.labelField ? String(component.props.labelField) : "label";
            const valueField = component.props.valueField ? String(component.props.valueField) : "value";
            const idField = component.props.idField ? String(component.props.idField) : "id";
            const iconField = component.props.iconField ? String(component.props.iconField) : "icon";
            const src = " data-webapp-source=\"" + escapeAttribute(component.id) + "\"";
            // Events are stored in props.componentEvents (to avoid Zod uiEventName validation).
            const allEvents = Array.isArray(component.props.componentEvents) ? component.props.componentEvents
                : (Array.isArray(component.events) ? component.events : []);
            const declaresClick = allEvents.some(function (ev) {
                return (typeof ev === "string" ? ev : (ev && ev.event)) === "itemClick";
            });
            // P173: itemSelect fires only in selectable mode on a selection change.
            const declaresSelect = allEvents.some(function (ev) {
                return (typeof ev === "string" ? ev : (ev && ev.event)) === "itemSelect";
            });
            // P173: single-select. `selectable` turns on selection state; `selectedId`
            // is the resolved two-way selected row id (bind.selectedId → props.selectedId,
            // analogous to ui-tabs activeTab → component.value). An absent/empty id marks
            // no row; an id matching no row marks no row.
            const selectable = component.props.selectable === true;
            const selectedId = (component.props.selectedId !== undefined && component.props.selectedId !== null)
                ? String(component.props.selectedId)
                : "";
            // A row is interactive (carries the click hook) when itemClick is declared OR
            // the list is selectable (a click then drives the selection + itemSelect).
            const interactive = declaresClick || selectable;
            // P180 (ADR 0021): displayType is a semantic intent enum — mapped HERE
            // (single adapter mapping, no backend branch in the editor). Migration:
            // old "default" → "plain"; "compact" → "plain" (compact was density, not
            // a look; density is a future modifier). Intents:
            //   plain      — bare ul/li, no extra chrome (today's default look)
            //   divided    — horizontal dividers between rows (webapp-list--divided)
            //   grouped    — bordered, card-like rows (list-group box look).
            //                Shoelace mapping: webapp-list--grouped class triggers
            //                CSS border on each item + container border-radius.
            //   actionable — hover/focus affordance for click/select rows.
            //                webapp-list--actionable: CSS hover highlight, pairs with
            //                itemClick/selectable.
            // A 2nd backend will map the same intents differently; the vocabulary
            // lives in the schema, the mapping lives only here.
            const rawDisplayType = component.props.displayType ? String(component.props.displayType) : "plain";
            // Migration shim: gracefully handle old values that may come from stored
            // flows before P180 (old "default" → "plain", "compact" → "plain").
            const displayType = rawDisplayType === "default" ? "plain"
                : rawDisplayType === "compact" ? "plain"
                : rawDisplayType;
            // P180: ordered (boolean, default false) — switches ul↔ol. Backend-neutral.
            const ordered = component.props.ordered === true;
            const listTag = ordered ? "ol" : "ul";
            // P172 (ADR 0015): disabled and color base fields for ui-list.
            // disabled: when true, adds aria-disabled + webapp-list--disabled class
            // to lock row interaction visually (the client checks disabled before
            // emitting itemClick/itemSelect events).
            // color: resolved into resolvedProps.color by the renderer; applied as an
            // inline CSS custom property on the <ul> so CSS can style list items.
            const displayTypeClass = (displayType === "divided" ? " webapp-list--divided"
                : displayType === "grouped" ? " webapp-list--grouped"
                : displayType === "actionable" ? " webapp-list--actionable"
                : "");
            const listDisabled = component.disabled
                ? " aria-disabled=\"true\" class=\"webapp-list" + displayTypeClass + " webapp-list--disabled\""
                : " class=\"webapp-list" + displayTypeClass + "\"";
            // P183: resolve color via the shared helper — semantic tokens map to
            // --wa-color-* CSS vars; CSS values pass through; unknown bare words
            // (e.g. "primary" before P183) are ignored (no broken inline style).
            const resolvedColor = resolveColorValue(component.props.color);
            const colorStyle = resolvedColor ? " style=\"color:" + escapeAttribute(resolvedColor) + "\"" : "";
            const itemHtml = rawItems.map(function (item, index) {
                // String shorthand → {label:<string>}. Anything else is read as an
                // object; the whole element (incl. value) is the event row payload.
                const row = (typeof item === "string") ? { label: item } : item;
                // P208: the DERIVED label/id/value/icon read through the configured
                // field mapping (labelField/idField/valueField/iconField). `row` itself
                // is untouched — data-webapp-row below carries the FULL raw entity.
                const rawLabel = (row && typeof row === "object") ? row[labelField] : undefined;
                const hasLabel = typeof rawLabel === "string" && rawLabel.length > 0;
                // Missing label → "?" for THAT row only (P104 non-displayable hint).
                const label = hasLabel ? escapeHtml(String(rawLabel)) : "?";
                const rowId = (row && typeof row === "object" && row[idField] !== undefined) ? String(row[idField]) : String(index);
                // `value` is ALWAYS in the event payload (row.value). Its DISPLAY is
                // node-wide via displayValue.
                const value = (row && typeof row === "object") ? row[valueField] : undefined;
                let valueHtml = "";
                if (value !== undefined && value !== null) {
                    if (displayValue === "secondary") {
                        valueHtml = "<span class=\"webapp-list-value\">" + escapeHtml(String(value)) + "</span>";
                    }
                    else if (displayValue === "badge") {
                        const shoelaceVariant = mapVariant("badge", badgeVariant);
                        valueHtml = "<sl-badge class=\"webapp-list-value\" variant=\"" + escapeAttribute(shoelaceVariant) + "\">"
                            + escapeHtml(String(value)) + "</sl-badge>";
                    }
                }
                // P176: per-item leading icon. renderIconHtml normalises bare string
                // OR {library?,name} → <sl-icon …>; missing/falsy icon → "".
                // Inject webapp-list-item-icon CSS class for spacing by replacing the
                // first occurrence of class=" in the returned tag (which always starts
                // with `<sl-icon class="webapp-icon…"`).
                const rawIconHtml = (row && typeof row === "object" && row[iconField] !== undefined)
                    ? renderIconHtml(row[iconField], {})
                    : "";
                const leadingIcon = rawIconHtml
                    ? rawIconHtml.replace("class=\"webapp-icon", "class=\"webapp-list-item-icon webapp-icon")
                    : "";
                const rowAttr = " data-webapp-row=\"" + escapeAttribute(JSON.stringify(row)) + "\"";
                // P173: the row whose id matches the resolved selectedId is marked
                // selected (aria-selected + webapp-list-item--selected). Only meaningful
                // when selectable; an empty/invalid id marks no row.
                const isSelected = selectable && selectedId !== "" && rowId === selectedId;
                const liClass = isSelected ? "webapp-list-item webapp-list-item--selected" : "webapp-list-item";
                const liAttr = selectable ? " aria-selected=\"" + (isSelected ? "true" : "false") + "\"" : "";
                if (interactive) {
                    // P173: data-webapp-selectable marks that a click drives selection +
                    // itemSelect (the client checks it before emitting itemSelect).
                    const selectableAttr = selectable ? " data-webapp-selectable=\"true\"" : "";
                    return "<li class=\"" + liClass + "\"" + liAttr + "><a class=\"webapp-link\" href=\"#\""
                        + src + " data-webapp-event=\"click\" data-webapp-item=\"" + escapeAttribute(rowId) + "\""
                        + selectableAttr + rowAttr + ">" + leadingIcon + label + valueHtml + "</a></li>";
                }
                return "<li class=\"" + liClass + "\"" + liAttr + ">" + leadingIcon + label + valueHtml + "</li>";
            }).join("");
            return wrapRenderedComponentHtml(component, layoutId, "<" + listTag + listDisabled + colorStyle + ">" + itemHtml + "</" + listTag + ">");
        }

        // P83: ui-divider — static horizontal/vertical separator (sl-divider or webapp-divider fallback).
        if (component.kind === "divider") {
            const orientation = (component.props && component.props.orientation) ? String(component.props.orientation) : "horizontal";
            const label = (component.props && component.props.label) ? String(component.props.label) : "";
            const orientationAttr = orientation === "vertical" ? " vertical" : "";
            // P231 (ADR 0015): the base-field `color` colours the line. sl-divider
            // exposes its line colour as the `--color` custom property, so a resolved
            // colour is applied as an inline `--color` style (semantic tokens map to
            // --wa-color-* vars via resolveColorValue; a bare CSS colour passes
            // through). Absent/unknown → no style attr (unchanged markup).
            const dividerColor = resolveColorValue(component.props && component.props.color);
            const colorStyle = dividerColor ? " style=\"--color:" + escapeAttribute(dividerColor) + "\"" : "";
            const inner = label
                ? "<sl-divider" + orientationAttr + colorStyle + ">" + escapeHtml(label) + "</sl-divider>"
                : "<sl-divider" + orientationAttr + colorStyle + "></sl-divider>";
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
        serializeSnapshot: serializeSnapshot,
        resolveColorValue: resolveColorValue
    };
}));

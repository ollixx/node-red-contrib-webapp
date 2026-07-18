import type { RenderSnapshot } from "./renderer";

/**
 * Default Web Component adapter — Shoelace (MIT) — see ADR 0002.
 *
 * This module is the architectural layer *below* the snapshot seam. It knows
 * nothing about Node-RED; it only maps the semantic component vocabulary
 * (`RenderSnapshot` kinds + semantic props) onto Shoelace custom elements and
 * their attributes. Everything above (schema, runtime, renderer) stays
 * framework-neutral; this adapter is the single place where "a button" becomes
 * "an `<sl-button>`".
 *
 * The mapping is data, not HTML: callers (server-side serializer in
 * `nodes/webapp.js`, or a client runtime) turn the descriptors into markup.
 * Kinds without a 1:1 Shoelace element fall back to a defined plain element so
 * an unknown kind never renders as nothing.
 */

export interface AdapterElementDescriptor {
    /** Custom element / tag name to render, e.g. "sl-button". */
    tag: string;
    /** Attribute name → value map derived from semantic props. */
    attributes: Record<string, string>;
    /** True when no native Shoelace element exists and a fallback was used. */
    fallback: boolean;
}

/**
 * Semantic component kind → Shoelace custom element.
 *
 * Kinds omitted from this map have no appropriate Shoelace 2.x element and
 * fall back to semantic HTML (handled by the caller, not by this adapter):
 *   - text   → rendered as a <p> / <div> by the server-side serializer
 *   - table  → rendered as a real <table> element by the server-side serializer
 *
 * Every entry here must be a real, shipping Shoelace 2.x custom element.
 * Do NOT add non-existent elements such as sl-format-text or sl-table.
 */
const KIND_TO_SHOELACE: Record<string, string> = {
    // text: no Shoelace 2.x equivalent — serializer emits semantic <p>/<div>
    button: "sl-button",
    // table: no Shoelace 2.x equivalent — serializer emits a real <table>
    card: "sl-card",
    container: "sl-card",
    input: "sl-input",
    select: "sl-select",
    checkbox: "sl-checkbox",
    radio: "sl-radio-group",
    switch: "sl-switch",
    textarea: "sl-textarea",
    datepicker: "sl-input",   // Shoelace 2.x has no date-picker; sl-input type="date" is the closest
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
    // P241: skeleton — the loading placeholder is built from <sl-skeleton>.
    // The four displayType forms (text/avatar/card/table) are a COMPOSITION of
    // one or more sl-skeleton, assembled by the server-side serializer; this
    // entry is the base element and ends the data-wa-fallback path.
    skeleton: "sl-skeleton"
};

/**
 * Kinds that have no native Shoelace equivalent and must degrade gracefully.
 * They render as a marked `<div>` fallback so the node is always visible.
 */
const FALLBACK_TAG = "div";

/**
 * Semantic button variant → Shoelace `variant` attribute. Variants stay
 * semantic in the schema (`primary`, `danger`, …); the framework token
 * (`contained`/`outlined`) never leaks upward — it is produced only here.
 */
const BUTTON_VARIANT_TO_SHOELACE: Record<string, string> = {
    primary: "primary",
    secondary: "neutral",
    success: "success",
    danger: "danger",
    warning: "warning",
    neutral: "neutral",
    ghost: "default",
    // text/link are textual buttons → Shoelace "text" (many-to-one, P49)
    text: "text",
    link: "text"
};

/** Semantic size token → Shoelace `size` attribute (Shoelace has only 3). */
const SIZE_TO_SHOELACE: Record<string, string> = {
    xs: "small",
    sm: "small",
    md: "medium",
    lg: "large",
    xl: "large"
};

export function mapButtonVariant(variant: string | undefined): string {
    if (!variant) {
        return "default";
    }

    return BUTTON_VARIANT_TO_SHOELACE[variant] ?? "default";
}

export function mapSize(size: string | undefined): string | undefined {
    if (!size) {
        return undefined;
    }

    return SIZE_TO_SHOELACE[size];
}

/**
 * Map a semantic component (kind + props) to a Shoelace element descriptor.
 * Returns a defined fallback descriptor for any kind without a native element.
 */
export function mapComponentToShoelace(
    kind: string,
    props: Record<string, unknown> = {}
): AdapterElementDescriptor {
    const tag = KIND_TO_SHOELACE[kind];
    const attributes: Record<string, string> = {};

    if (kind === "button") {
        attributes.variant = mapButtonVariant(typeof props.variant === "string" ? props.variant : undefined);

        const size = mapSize(typeof props.size === "string" ? props.size : undefined);

        if (size) {
            attributes.size = size;
        }

        // P71: explicit outline flag → Shoelace boolean `outline` attribute.
        // sl-button accepts it on any variant; the variant-derived look is
        // unaffected (no double-apply — the adapter never derives outline itself).
        if (props.outline === true) {
            attributes.outline = "";
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
            tag: FALLBACK_TAG,
            attributes: { ...attributes, "data-wa-kind": kind, "data-wa-fallback": "true" },
            fallback: true
        };
    }

    return {
        tag,
        attributes,
        fallback: false
    };
}

/**
 * Bridge the webapp design-token CSS custom properties (`--wa-*`) onto the
 * Shoelace custom properties (`--sl-*`) that its components consume natively.
 *
 * Each entry is `[slVar, waVar, shoelaceDefault]`: the Shoelace property is set
 * to `var(--wa-*, <literal Shoelace default>)`. When the `--wa-*` token is set
 * it wins; when it is unset the bridge restores the *literal* Shoelace default
 * value — it must NOT fall back to `var(--sl-*)` (its own property), as that
 * self-reference forms a CSS dependency cycle that renders the property
 * guaranteed-invalid (P62: this collapsed sl-button's label padding to 0).
 *
 * The literal defaults below are copied verbatim from the Shoelace 2.20.1 light
 * theme (`themes/light.css`). Color defaults that themselves reference a palette
 * scale (e.g. `var(--sl-color-sky-600)`) are safe: they point at a *different*
 * property, not the one being defined, so no cycle is created.
 *
 * `--sl-spacing-medium` is intentionally NOT bridged: `--wa-spacing-unit` is a
 * base unit (0.25rem) whereas `--sl-spacing-medium` is an absolute medium value
 * (1rem); aliasing them is semantically wrong. Shoelace keeps its own spacing
 * scale.
 */
const WA_TO_SHOELACE_VARS: Array<[string, string, string]> = [
    ["--sl-color-primary-600", "--wa-color-primary", "var(--sl-color-sky-600)"],
    ["--sl-color-primary-500", "--wa-color-primary", "var(--sl-color-sky-500)"],
    ["--sl-color-danger-600", "--wa-color-danger", "var(--sl-color-red-600)"],
    ["--sl-color-success-600", "--wa-color-success", "var(--sl-color-green-600)"],
    ["--sl-color-warning-600", "--wa-color-warning", "var(--sl-color-amber-600)"],
    ["--sl-color-neutral-600", "--wa-color-neutral", "var(--sl-color-gray-600)"],
    ["--sl-color-neutral-0", "--wa-color-background", "hsl(0, 0%, 100%)"],
    ["--sl-panel-background-color", "--wa-color-surface", "var(--sl-color-neutral-0)"],
    ["--sl-panel-border-color", "--wa-color-border", "var(--sl-color-neutral-200)"],
    ["--sl-color-neutral-1000", "--wa-color-text", "hsl(0, 0%, 0%)"],
    ["--sl-font-sans", "--wa-font-family", "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif, \"Apple Color Emoji\", \"Segoe UI Emoji\", \"Segoe UI Symbol\""],
    ["--sl-font-size-medium", "--wa-font-size-base", "1rem"],
    ["--sl-font-weight-normal", "--wa-font-weight-normal", "400"],
    ["--sl-font-weight-bold", "--wa-font-weight-bold", "700"],
    ["--sl-line-height-normal", "--wa-line-height-base", "1.8"],
    ["--sl-border-radius-small", "--wa-radius-sm", "0.1875rem"],
    ["--sl-border-radius-medium", "--wa-radius-md", "0.25rem"],
    ["--sl-border-radius-large", "--wa-radius-lg", "0.5rem"],
    ["--sl-border-radius-circle", "--wa-radius-full", "50%"]
];

/**
 * Produce a `:root { … }` CSS block that aliases Shoelace's custom properties
 * to the webapp tokens. Each `--sl-*` falls back to its *literal* Shoelace
 * default (never to `var(--sl-*)` itself) when the matching `--wa-*` token is
 * unset, so partial token sets are safe and never trigger a self-reference cycle.
 */
export function buildShoelaceTokenBridgeCss(): string {
    const declarations = WA_TO_SHOELACE_VARS.map(
        ([slVar, waVar, slDefault]) => `  ${slVar}: var(${waVar}, ${slDefault});`
    );
    return `:root {\n${declarations.join("\n")}\n}`;
}

/**
 * Collect every distinct component kind present in a snapshot (including nested
 * regions, containers and dialogs). Used to assert adapter coverage in tests.
 */
export function collectSnapshotKinds(snapshot: RenderSnapshot): Set<string> {
    const kinds = new Set<string>();

    const walkRegions = (regions: RenderSnapshot["regions"]): void => {
        for (const region of regions) {
            for (const component of region.components) {
                kinds.add(component.kind);

                if (component.kind === "container") {
                    walkRegions(component.regions);
                }
            }
        }
    };

    walkRegions(snapshot.regions);

    for (const dialog of snapshot.dialogs) {
        walkRegions(dialog.regions);
    }

    return kinds;
}

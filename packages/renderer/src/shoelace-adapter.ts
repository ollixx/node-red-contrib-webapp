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
    pagination: "sl-button-group"
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
 * No per-token *translation* happens here — the `--wa-*` values produced by
 * `buildDesignTokenCss` are simply aliased to the Shoelace property names via
 * `var()`. A theme is therefore "tokens + adapter", with the adapter choosing
 * how the tokens reach the components.
 */
const WA_TO_SHOELACE_VARS: Array<[string, string]> = [
    ["--sl-color-primary-600", "--wa-color-primary"],
    ["--sl-color-primary-500", "--wa-color-primary"],
    ["--sl-color-danger-600", "--wa-color-danger"],
    ["--sl-color-success-600", "--wa-color-success"],
    ["--sl-color-warning-600", "--wa-color-warning"],
    ["--sl-color-neutral-600", "--wa-color-neutral"],
    ["--sl-color-neutral-0", "--wa-color-background"],
    ["--sl-panel-background-color", "--wa-color-surface"],
    ["--sl-panel-border-color", "--wa-color-border"],
    ["--sl-color-neutral-1000", "--wa-color-text"],
    ["--sl-font-sans", "--wa-font-family"],
    ["--sl-font-size-medium", "--wa-font-size-base"],
    ["--sl-font-weight-normal", "--wa-font-weight-normal"],
    ["--sl-font-weight-bold", "--wa-font-weight-bold"],
    ["--sl-line-height-normal", "--wa-line-height-base"],
    ["--sl-spacing-medium", "--wa-spacing-unit"],
    ["--sl-border-radius-small", "--wa-radius-sm"],
    ["--sl-border-radius-medium", "--wa-radius-md"],
    ["--sl-border-radius-large", "--wa-radius-lg"],
    ["--sl-border-radius-circle", "--wa-radius-full"]
];

/**
 * Produce a `:root { … }` CSS block that aliases Shoelace's custom properties
 * to the webapp tokens. Each `--sl-*` falls back to its own default when the
 * matching `--wa-*` token is unset, so partial token sets are safe.
 */
export function buildShoelaceTokenBridgeCss(): string {
    const declarations = WA_TO_SHOELACE_VARS.map(([slVar, waVar]) => `  ${slVar}: var(${waVar}, var(${slVar}));`);
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

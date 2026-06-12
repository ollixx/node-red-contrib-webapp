import {
    REPEAT_SLOT,
    TAB_SLOT,
    defaultActiveTabId,
    defaultOpenSectionId,
    resolveMountReference,
    uiEventMessageSchema,
    type AppModel,
    type BindingDefinition,
    type ComponentDefinition,
    type LayoutDefinition,
    type NavigationDefinition,
    type QueryDefinition,
    type RouteDefinition,
    type RuntimeIntegrationModel,
    type SlotDefinition,
    type UiEventMessage
} from "@node-red-contrib-webapp/schema";

import { buildStoreNamePaths, evaluateReactiveExpression, type ReactiveError } from "./reactive-expression";

export { evaluateReactiveExpression, buildStoreNamePaths } from "./reactive-expression";

/**
 * P115 (ADR 0010): a sink the host can supply to receive distinct reactive-
 * expression failures, so they flow into the existing error-forwarding/logging
 * pipeline (webapp.js `reportRuntimeError`). Called at most once per distinct
 * error (deduped by source+message) across the app instance's lifetime.
 */
export type ReactiveErrorReporter = (error: ReactiveError) => void;

type UiEventName = UiEventMessage["ui"]["event"];

export interface RendererAppOptions {
    integration?: RuntimeIntegrationModel;
    location?: string;
    state?: Record<string, unknown>;
    queries?: Record<string, unknown>;
    // P160: per-query lifecycle envelopes (queryPath → { loading, error,
    // updatedAt, status }). Drives `query:<path>.loading|error|updatedAt`
    // bindings. Optional — absent/partial entries simply resolve undefined.
    queryLifecycle?: Record<string, Record<string, unknown>>;
    // P115: optional sink for distinct `reactive` expression failures. Deduped
    // per app instance so a broken expression is reported once, not on every
    // re-render. The host wires this to the error-forwarding pipeline.
    onReactiveError?: ReactiveErrorReporter;
}

export interface RenderedEventBinding {
    event: UiEventName;
    // action is optional since P20a — click events on buttons are routed via wiring,
    // not by a string action reference.
    action?: string;
}

interface RenderedComponentBase {
    id: string;
    kind: ComponentDefinition["kind"];
    mount: string;
    props: Record<string, unknown>;
    events: RenderedEventBinding[];
    disabled: boolean;
}

export interface RenderedTextComponent extends RenderedComponentBase {
    kind: "text";
    text: string;
}

export interface RenderedButtonComponent extends RenderedComponentBase {
    kind: "button";
    label: string;
}

export interface RenderedTableComponent extends RenderedComponentBase {
    kind: "table";
    columns: string[];
    rows: Record<string, unknown>[];
}

export interface RenderedCardComponent extends RenderedComponentBase {
    kind: "card";
    title?: string;
    data: unknown;
}

export interface RenderedContainerComponent extends RenderedComponentBase {
    kind: "container";
    layoutId: string;
    title?: string;
    regions: RenderedRegion[];
}

export interface RenderedInputComponent extends RenderedComponentBase {
    kind: "input";
    value: unknown;
}

/** Generic rendered component for P16x kinds (select, checkbox, radio, etc.). */
export interface RenderedGenericComponent extends RenderedComponentBase {
    kind: "select" | "checkbox" | "radio" | "switch" | "textarea" | "datepicker" | "slider" | "alert" | "badge" | "progress" | "breadcrumb" | "menu" | "avatar" | "image" | "list" | "pagination" | "stepper" | "log" | "icon" | "divider";
    value: unknown;
}

/**
 * P168 (ADR 0018, Model 1a): ui-tabs renders ONE panel per `ui-tab` child. The
 * tabs are DERIVED from the mounted children (not a config array) — `props.tabs`
 * carries the per-child metadata `{ id, label, active }` (id = child id = slot
 * key = the `activeTab` token), and `regions` carries one region per child
 * (region name = child id) holding that tab's content subtree. The active tab is
 * `component.value` (resolved from the two-way `activeTab` binding); an invalid /
 * absent value falls back to the first child by `order` (defaultActiveTabId).
 */
export interface RenderedTabsComponent extends RenderedComponentBase {
    kind: "tabs";
    value: unknown;
    regions: RenderedRegion[];
}

/**
 * P169 (ADR 0018, Model 1a): ui-accordion renders ONE collapsible panel per
 * `ui-accordion-section` child. The sections are DERIVED from the mounted children
 * (not a config array) — `props.sections` carries the per-child metadata
 * `{ id, label, icon, open }` (id = child id = slot key = the open-state token),
 * and `regions` carries one region per child (region name = child id) holding that
 * section's content subtree. The open section is `component.value` (resolved from
 * the two-way `openSection` binding); an invalid / absent value falls back to the
 * first child by `order` (defaultOpenSectionId). Mirrors RenderedTabsComponent.
 */
export interface RenderedAccordionComponent extends RenderedComponentBase {
    kind: "accordion";
    value: unknown;
    regions: RenderedRegion[];
}

export type RenderedComponent =
    | RenderedButtonComponent
    | RenderedCardComponent
    | RenderedContainerComponent
    | RenderedGenericComponent
    | RenderedInputComponent
    | RenderedTableComponent
    | RenderedTabsComponent
    | RenderedAccordionComponent
    | RenderedTextComponent;

export interface RenderedRegion {
    kind: "region";
    name: string;
    title?: string;
    components: RenderedComponent[];
    regions: RenderedRegion[];
}

export interface RenderedDialog {
    id: string;
    title?: string;
    modal: boolean;
    // P64: false → the native <sl-dialog> renders no-header (no X / title).
    closable: boolean;
    open: boolean;
    layoutId: string;
    regions: RenderedRegion[];
}

export interface RouteMatch {
    route: RouteDefinition;
    params: Record<string, string>;
}

export interface RenderSnapshot {
    appId: string;
    // P109: renamed from `title` to `name` to match AppModel.name.
    name: string;
    location: string;
    route: RouteDefinition;
    params: Record<string, string>;
    layout: LayoutDefinition;
    regions: RenderedRegion[];
    dialogs: RenderedDialog[];
}

export interface DispatchResult {
    message: UiEventMessage;
    snapshot: RenderSnapshot;
}

export interface RendererApp {
    render(): RenderSnapshot;
    navigate(location: string): RenderSnapshot;
    replaceState(nextState: Record<string, unknown>): RenderSnapshot;
    replaceQueries(nextQueries: Record<string, unknown>, nextQueryLifecycle?: Record<string, Record<string, unknown>>): RenderSnapshot;
    dispatchEvent(componentId: string, event: UiEventName, payload?: Record<string, unknown>): DispatchResult;
}

// P115: a unique marker returned for a reactive expression that failed to
// compile/evaluate. It is distinct from `undefined` (which means "no value,
// apply fallback"), so a failed reactive value renders the invalid-value marker
// per P104 and is NOT replaced by binding.fallback.
const REACTIVE_INVALID = Symbol("reactive-invalid");

// P131 (ADR 0013): the same invalid-value marker is returned when a store
// sub-path is unresolvable, when an object/array slice is bound without a
// sub-path, or when the depth guard trips. It is a Symbol, so the central
// normalization (normalizeDisplayValue) renders it as the "?" marker (P104) and
// it is NOT replaced by a binding fallback.
const STORE_SUBPATH_INVALID = REACTIVE_INVALID;

// P131 (ADR 0013): expected sub-path resolution depth is 1 (the store binding's
// single leaf sub-path). The schema forbids `subPath.subPath`, so a chain/cycle
// is impossible by construction — this runtime depth guard is a backstop that
// returns the invalid-value marker instead of overflowing the stack.
const STORE_SUBPATH_MAX_DEPTH = 4;

/** Short human description of a slice's runtime type, for speaking errors. */
function describeSliceType(slice: unknown): string {
    if (slice === null) {
        return "null";
    }

    if (Array.isArray(slice)) {
        return "Array";
    }

    if (typeof slice === "object") {
        return "Objekt";
    }

    if (typeof slice === "string") {
        return `der String "${slice}"`;
    }

    return String(slice);
}

interface BindingSources {
    state: Record<string, unknown>;
    queries: Record<string, unknown>;
    // P160: per-query LIFECYCLE envelope, keyed by the EXACT queryPath →
    // `{ loading, error, updatedAt, status }`. Separate from `queries` (the DATA
    // tree) so the read convention is unambiguous: `query:<path>` resolves the
    // DATA; `query:<path>.loading` / `.error` / `.updatedAt` resolve the
    // lifecycle field. The set of keys here is exactly the app's query paths, so
    // the resolver can tell a lifecycle sub-path from a data sub-field.
    queryLifecycle: Record<string, Record<string, unknown>>;
    params: Record<string, string>;
    // P67: store id → statePath, so a `store` binding resolves to the store's
    // current value via state. Referencing by id (not statePath) stays robust
    // against later statePath renames.
    storePaths: Record<string, string>;
    // P115: store NAME → statePath, the lookup `store("<name>")` uses inside a
    // reactive expression. Built alongside storePaths.
    storeNamePaths: Record<string, string>;
    // P131 (ADR 0013): store id → display NAME, for the speaking sub-path errors
    // (`Store "<name>": …`). Falls back to the id when a store has no name.
    storeNames: Record<string, string>;
    // P115: invoked with a distinct reactive failure (already deduped upstream).
    // P131: also the sink for store sub-path speaking errors — same dedup/pipeline.
    reportReactiveError?: ReactiveErrorReporter;
    // P164 (ADR 0017): the render-time ITEM SCOPE — a STACK of `{item, index}`
    // frames the renderer pushes as it clones a `ui-repeat` template per element.
    // `item` / `item.<path>` / `index` bindings resolve against the TOP (innermost)
    // frame; nested repeats stack, innermost wins. Empty/absent outside any repeat
    // → an `item`/`index` binding resolves to `undefined` (no throw). This scope is
    // render-time only — never persisted, never written back to a store (cf.
    // routeParam). The stack is rebuilt immutably per clone (no mutate/restore).
    itemScope?: ItemScopeFrame[];
}

/**
 * P164 (ADR 0017): one frame of the render-time item scope — the current element
 * of a `ui-repeat` iteration and its zero-based position. For an OBJECT source the
 * element is the `{key, value}` entry; for an ARRAY source it is the element value.
 */
interface ItemScopeFrame {
    item: unknown;
    index: number;
}

interface ComponentRenderContext {
    sources: BindingSources;
}

function getObjectRecord(input: unknown): Record<string, unknown> {
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
        return {};
    }

    return input as Record<string, unknown>;
}

/**
 * Split a path string into segments, honouring both dot and bracket notation:
 * `items.0`, `items[0]`, `b.label` → `["items", "0"]`, `["items", "0"]`,
 * `["b", "label"]`. Bracket segments are normalised to bare segments so a numeric
 * index and a numeric key are handled identically downstream (data-driven, not a
 * typed choice — ADR 0013).
 */
function splitPathSegments(path: string): string[] {
    return path
        .replace(/\[(\d+)\]/g, ".$1")
        .split(".")
        .filter((segment) => segment.length > 0);
}

function getValueAtPath(source: unknown, path: string | undefined): unknown {
    if (!path) {
        return undefined;
    }

    return splitPathSegments(path).reduce<unknown>((currentValue, segment) => {
        if (currentValue === null || currentValue === undefined) {
            return undefined;
        }

        // P131 (ADR 0013): a numeric segment indexes an array; a string segment
        // keys an object. "Index vs key" is data-driven, not a typed choice.
        if (Array.isArray(currentValue)) {
            const index = Number(segment);
            return Number.isInteger(index) ? currentValue[index] : undefined;
        }

        if (typeof currentValue !== "object") {
            return undefined;
        }

        return (currentValue as Record<string, unknown>)[segment];
    }, source);
}

function setValueAtPath(source: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
    const segments = path.split(".").filter(Boolean);

    if (segments.length === 0) {
        return source;
    }

    const cloneRoot = { ...source };
    let currentTarget: Record<string, unknown> = cloneRoot;

    segments.forEach((segment, index) => {
        const isLeaf = index === segments.length - 1;

        if (isLeaf) {
            currentTarget[segment] = value;
            return;
        }

        const nextTarget = getObjectRecord(currentTarget[segment]);
        currentTarget[segment] = { ...nextTarget };
        currentTarget = currentTarget[segment] as Record<string, unknown>;
    });

    return cloneRoot;
}

function applyStatePatch(currentState: Record<string, unknown>, statePatch: Record<string, unknown>): Record<string, unknown> {
    return Object.entries(statePatch).reduce<Record<string, unknown>>((nextState, [path, value]) => setValueAtPath(nextState, path, value), currentState);
}

/**
 * P131 (ADR 0013): resolve a `store` binding, honouring an optional `subPath`.
 *
 * 1. Resolve the slice (store id → statePath → live value) as before.
 * 2. No `subPath` (or it resolves empty): a scalar slice is returned as-is; a
 *    non-renderable object/array slice yields the invalid-value marker + a
 *    speaking error.
 * 3. With a `subPath`: resolve the (leaf) sub-path binding through the normal
 *    `resolveBinding` mechanics (msg/jsonata message-driven; reactive/routeParam/
 *    query/store reactive; flow/global/env server-once) to a path string/index,
 *    then `getValueAtPath(slice, path)`. A missing key / scalar slice yields the
 *    invalid-value marker + a speaking error.
 *
 * `depth` is the runtime backstop for the (schema-forbidden) nested case: if a
 * sub-path binding is itself a store binding carrying its own sub-path (only
 * reachable by bypassing the schema), the guard trips and returns the marker
 * instead of recursing without bound.
 */
function resolveStoreBinding(binding: BindingDefinition, sources: BindingSources, depth: number): unknown {
    const storeId = binding.path;
    const storeName = (storeId && sources.storeNames[storeId]) || storeId || "?";

    if (depth > STORE_SUBPATH_MAX_DEPTH) {
        reportStoreSubPathError(
            sources,
            `store binding "${storeName}": sub-path nesting too deep / cycle`
        );
        return STORE_SUBPATH_INVALID;
    }

    const statePath = storeId ? sources.storePaths[storeId] : undefined;
    const slice = getValueAtPath(sources.state, statePath);

    let pathValue: unknown;
    if (binding.subPath !== undefined) {
        pathValue = resolveBinding(binding.subPath as BindingDefinition, sources, depth + 1);
    }

    const isObjectSlice = typeof slice === "object" && slice !== null;

    // No (or empty) sub-path: a scalar slice renders directly. A non-renderable
    // object/array slice is a configuration error → marker + speaking message.
    if (pathValue === undefined || pathValue === null || pathValue === "") {
        if (isObjectSlice) {
            reportStoreSubPathError(
                sources,
                `Store "${storeName}": Wert ist ein Objekt — gib einen Pfad zu einer anzeigbaren Property an`
            );
            return STORE_SUBPATH_INVALID;
        }

        return slice;
    }

    // A sub-path is set. It resolves to a path string / numeric index; coerce to
    // a path string (a numeric index becomes its decimal string, e.g. 0 → "0").
    const pathString = String(pathValue);
    const resolved = getValueAtPath(slice, pathString);

    if (resolved === undefined) {
        reportStoreSubPathError(
            sources,
            `Store "${storeName}": Pfad "${pathString}" nicht gefunden (Slice ist ${describeSliceType(slice)})`
        );
        return STORE_SUBPATH_INVALID;
    }

    return resolved;
}

/**
 * P131 (ADR 0013): emit a speaking store sub-path error through the SAME
 * app-scoped reactive-error sink/dedup (webapp.js `runtimeState.reactiveErrorKeys`,
 * cleared on flows:started). The message is the dedup key — a given misconfigured
 * binding reports once per app lifetime, not per render.
 */
function reportStoreSubPathError(sources: BindingSources, message: string): void {
    sources.reportReactiveError?.({
        source: "store-subpath",
        message,
        key: `store-subpath ${message}`
    });
}

/**
 * P160: reserved lifecycle sub-paths a `query:<path>.<field>` binding may read.
 * `query:<path>` itself resolves the DATA; these suffixes resolve the load-state
 * envelope built alongside the data.
 *
 * P161: `totalCount`/`pageCount` join the reserved set so a ui-pagination can
 * bind `total ← query:<path>.totalCount` (read) — the paging metadata the wired
 * fetch reports alongside the page of data.
 */
const QUERY_LIFECYCLE_FIELDS = new Set(["loading", "error", "updatedAt", "status", "totalCount", "pageCount"]);

/**
 * P160: resolve a `query` binding honouring the read convention:
 *   - `query:<queryPath>`                         → the loaded DATA
 *   - `query:<queryPath>.<loading|error|updatedAt|status>` → the lifecycle field
 *   - `query:<queryPath>.<deeper.path>`           → a field INSIDE the data
 * The lifecycle branch only fires when the prefix is a KNOWN query path and the
 * suffix is exactly one reserved field — so a data object that happens to carry
 * an `error`/`status` key of its own is never shadowed for an unknown path.
 */
function resolveQueryBinding(path: string | undefined, sources: BindingSources): unknown {
    if (path) {
        const lastDot = path.lastIndexOf(".");
        if (lastDot > 0) {
            const prefix = path.slice(0, lastDot);
            const suffix = path.slice(lastDot + 1);
            if (QUERY_LIFECYCLE_FIELDS.has(suffix) && Object.prototype.hasOwnProperty.call(sources.queryLifecycle, prefix)) {
                return sources.queryLifecycle[prefix][suffix];
            }
        }
    }

    return getValueAtPath(sources.queries, path);
}

function resolveBinding(binding: BindingDefinition | undefined, sources: BindingSources, depth = 0): unknown {
    if (!binding) {
        return undefined;
    }

    let resolvedValue: unknown;

    switch (binding.kind) {
        case "literal":
            resolvedValue = binding.value;
            break;
        case "query":
            resolvedValue = resolveQueryBinding(binding.path, sources);
            break;
        case "routeParam":
            resolvedValue = binding.path ? sources.params[binding.path] : undefined;
            break;
        case "state":
            resolvedValue = getValueAtPath(sources.state, binding.path);
            break;
        case "store": {
            // P67: binding.path holds the referenced ui-store node id → statePath
            // → live slice. P131 (ADR 0013): an optional `subPath` reaches one
            // level into the slice (and reports speaking errors / the invalid-value
            // marker when unresolvable). The marker is a Symbol, so it bypasses the
            // fallback substitution below (an explicit invalid, not an absent value).
            const storeValue = resolveStoreBinding(binding, sources, depth);
            if (storeValue === STORE_SUBPATH_INVALID) {
                return STORE_SUBPATH_INVALID;
            }

            resolvedValue = storeValue;
            break;
        }
        case "msg":
            // P111: Message mode. The value is pushed at runtime via msg.payload
            // and held backend-side in the live definition (where it becomes a
            // literal). There is no message context at render time, so until a
            // payload arrives the field renders EMPTY — never "?".
            resolvedValue = binding.fallback ?? "";
            break;
        case "jsonata":
            // P113: JSONata mode is message-driven — the expression is evaluated
            // against the incoming msg in the input-handler, which overwrites the
            // live binding with a literal. There is no message context at render
            // time, so until a message arrives the field renders EMPTY (like msg).
            resolvedValue = binding.fallback ?? "";
            break;
        case "reactive": {
            // P115 (ADR 0010): compile-once/evaluate-often client expression.
            // value carries the source. A failure (compile, throw, or thenable
            // return) never breaks the snapshot: it resolves to the invalid-value
            // marker (P104) and is reported once per distinct error.
            const source = typeof binding.value === "string" ? binding.value : "";
            const result = evaluateReactiveExpression(source, {
                state: sources.state,
                queries: sources.queries,
                params: sources.params,
                storeNamePaths: sources.storeNamePaths
            });

            if (result.error) {
                sources.reportReactiveError?.(result.error);
                // Bypass the fallback substitution below — a failed reactive value
                // is an explicit invalid-value, not an absent one.
                return REACTIVE_INVALID;
            }

            resolvedValue = result.value;
            break;
        }
        case "item": {
            // P164 (ADR 0017): the FIRST scope-local binding kind. `item` resolves
            // the whole current element of the innermost active repeat; an optional
            // `path` (e.g. `name`, `address.city`) selects a one-or-more-level field
            // of it. OUTSIDE any repeat (empty scope stack) → `undefined`, NOT a
            // throw — a defined "no value" so the editor-validateable misuse renders
            // cleanly rather than crashing the snapshot.
            const frame = sources.itemScope?.[sources.itemScope.length - 1];
            resolvedValue = frame === undefined
                ? undefined
                : binding.path
                    ? getValueAtPath(frame.item, binding.path)
                    : frame.item;
            break;
        }
        case "index": {
            // P164 (ADR 0017): the zero-based position of the current element in the
            // innermost active repeat. Path-free (schema-enforced). Outside any
            // repeat → `undefined` (no throw), mirroring `item`.
            const frame = sources.itemScope?.[sources.itemScope.length - 1];
            resolvedValue = frame === undefined ? undefined : frame.index;
            break;
        }
    }

    return resolvedValue === undefined ? binding.fallback : resolvedValue;
}

/**
 * P133 (ADR 0012) — resolve a STRUCTURAL binding (a value that is itself an
 * array/object, e.g. ui-select `options`). It mirrors {@link resolveBinding}
 * for the non-store kinds, but for a `store` binding it returns the raw slice
 * (honouring an optional one-level `subPath`) instead of routing through the
 * display-scalar resolver, which deliberately rejects object/array slices.
 */
function resolveStructuralBinding(binding: BindingDefinition | undefined, sources: BindingSources): unknown {
    if (!binding) {
        return undefined;
    }

    if (binding.kind === "store") {
        const storeId = binding.path;
        const statePath = storeId ? sources.storePaths[storeId] : undefined;
        const slice = getValueAtPath(sources.state, statePath);
        if (binding.subPath !== undefined) {
            const pathValue = resolveBinding(binding.subPath as BindingDefinition, sources, 1);
            if (pathValue === undefined || pathValue === null || pathValue === "") {
                return slice;
            }
            return getValueAtPath(slice, String(pathValue));
        }
        return slice;
    }

    return resolveBinding(binding, sources);
}

/**
 * P104 — the single, central normalization of a bound display value.
 *
 * Every node that binds a *display* value (ui-text `value`, ui-badge `value`,
 * the resolved value of ui-avatar's initials fallback chain, …) routes its raw
 * resolved value through here exactly once, so the empty/null/non-scalar
 * behaviour lives in one place instead of being re-derived per node.
 *
 * Contract (see docs/nodes/concepts/value-rendering.md §1):
 * - non-empty string → unchanged
 * - number / boolean / bigint → `String(value)` (so 0 → "0", false → "false";
 *   0 and false are VALID values, never treated as empty)
 * - "" (a real empty string) → "" (rendered, but no content)
 * - null / undefined / object / array / function / symbol → "?" (a visible
 *   "cannot be displayed" signal — never `[object Object]`, a JSON dump, or a crash)
 */
export function normalizeDisplayValue(raw: unknown): string {
    switch (typeof raw) {
        case "string":
            return raw;
        case "number":
        case "boolean":
        case "bigint":
            return String(raw);
        default:
            // null, undefined, object, array, function, symbol → not displayable.
            return "?";
    }
}

function matchesCondition(binding: BindingDefinition | undefined, sources: BindingSources, defaultValue: boolean): boolean {
    const resolvedValue = resolveBinding(binding, sources);

    if (resolvedValue === undefined) {
        return defaultValue;
    }

    return Boolean(resolvedValue);
}

function asStringArray(input: unknown): string[] {
    return Array.isArray(input) ? input.filter((value): value is string => typeof value === "string") : [];
}

function asRecordArray(input: unknown): Record<string, unknown>[] {
    return Array.isArray(input)
        ? input
            .map((entry) => getObjectRecord(entry))
            .filter((entry) => Object.keys(entry).length > 0)
        : [];
}

function findLayout(appModel: AppModel, layoutId: string): LayoutDefinition {
    const layout = appModel.layouts.find((candidate) => candidate.id === layoutId);

    if (!layout) {
        throw new Error(`Renderer cannot find layout '${layoutId}'.`);
    }

    return layout;
}

function escapeRegExp(input: string): string {
    return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchRoute(location: string, routes: RouteDefinition[]): RouteMatch {
    const normalizedLocation = location.startsWith("/") ? location : `/${location}`;

    const matches = routes
        .map((route) => {
            const paramNames: string[] = [];
            const pattern = route.path
                .split("/")
                .map((segment) => {
                    if (segment.startsWith(":")) {
                        paramNames.push(segment.slice(1));
                        return "([^/]+)";
                    }

                    return escapeRegExp(segment);
                })
                .join("/");
            const matcher = new RegExp(`^${pattern}$`);
            const result = matcher.exec(normalizedLocation);

            if (!result) {
                return undefined;
            }

            const params = paramNames.reduce<Record<string, string>>((accumulator, paramName, index) => {
                accumulator[paramName] = result[index + 1] ?? "";
                return accumulator;
            }, {});

            return {
                route,
                params
            };
        })
        .filter((value): value is RouteMatch => value !== undefined)
        .sort((left, right) => right.route.path.length - left.route.path.length);

    const bestMatch = matches[0];

    if (!bestMatch) {
        throw new Error(`Renderer cannot match location '${location}' to any route.`);
    }

    return bestMatch;
}

function isDialogOpen(state: Record<string, unknown>, dialogId: string): boolean {
    return getValueAtPath(state, `ui.dialogs.${dialogId}.open`) === true;
}

function normalizeIntegration(integration: RuntimeIntegrationModel | undefined): RuntimeIntegrationModel {
    return {
        stores: integration?.stores ?? [],
        queries: integration?.queries ?? [],
        actions: integration?.actions ?? [],
        navigations: integration?.navigations ?? []
    };
}

function initializeState(
    baseState: Record<string, unknown>,
    queryState: Record<string, unknown>,
    integration: RuntimeIntegrationModel
): Record<string, unknown> {
    let nextState = { ...baseState };

    for (const store of integration.stores) {
        if (store.initialValue === undefined || getValueAtPath(nextState, store.statePath) !== undefined) {
            continue;
        }

        nextState = setValueAtPath(nextState, store.statePath, store.initialValue);
    }

    for (const query of integration.queries) {
        const hasData = getValueAtPath(queryState, query.queryPath) !== undefined;
        const loadingPath = `ui.queries.${query.id}.loading`;
        const statusPath = `ui.queries.${query.id}.status`;

        if (getValueAtPath(nextState, loadingPath) === undefined) {
            nextState = setValueAtPath(nextState, loadingPath, false);
        }

        if (getValueAtPath(nextState, statusPath) === undefined) {
            nextState = setValueAtPath(nextState, statusPath, hasData ? "success" : "idle");
        }
    }

    return nextState;
}

function syncQueryState(currentState: Record<string, unknown>, queryState: Record<string, unknown>, integration: RuntimeIntegrationModel): Record<string, unknown> {
    let nextState = currentState;

    for (const query of integration.queries) {
        const hasData = getValueAtPath(queryState, query.queryPath) !== undefined;
        nextState = setValueAtPath(nextState, `ui.queries.${query.id}.loading`, false);
        nextState = setValueAtPath(nextState, `ui.queries.${query.id}.status`, hasData ? "success" : "idle");
    }

    return nextState;
}

function findTriggeredQueries(action: string | undefined, integration: RuntimeIntegrationModel): QueryDefinition[] {
    if (!action) {
        return [];
    }

    return integration.queries.filter((query) => query.refreshAction === action);
}

function findNavigation(action: string | undefined, integration: RuntimeIntegrationModel): NavigationDefinition | undefined {
    if (!action) {
        return undefined;
    }

    return integration.navigations.find((navigation) => navigation.id === action);
}

function resolveNavigationTarget(
    navigation: NavigationDefinition,
    payload: Record<string, unknown>,
    currentParams: Record<string, string>
): string {
    return navigation.to
        .split("/")
        .map((segment) => {
            if (!segment.startsWith(":")) {
                return segment;
            }

            const paramName = segment.slice(1);
            const payloadParams = getObjectRecord(payload.params);
            const payloadRow = getObjectRecord(payload.row);
            const payloadValues = getObjectRecord(payload.values);
            const resolvedValue = payloadParams[paramName] ?? payloadRow[paramName] ?? payloadValues[paramName] ?? payload[paramName] ?? currentParams[paramName];

            if (resolvedValue === undefined) {
                throw new Error(`Renderer cannot resolve navigation parameter '${paramName}' for '${navigation.id}'.`);
            }

            return encodeURIComponent(String(resolvedValue));
        })
        .join("/");
}

function toRenderedComponent(component: ComponentDefinition, context: ComponentRenderContext, appModel: AppModel): RenderedComponent | undefined {
    const visible = matchesCondition(component.visibleIf, context.sources, true);

    if (!visible) {
        return undefined;
    }

    const disabledBinding = resolveBinding(component.bind.disabled, context.sources);
    const enabled = matchesCondition(component.enabledIf, context.sources, true);
    const resolvedProps: Record<string, unknown> = { ...component.props };

    for (const [key, binding] of Object.entries(component.bind)) {
        resolvedProps[key] = resolveBinding(binding, context.sources);
    }

    // P133/P136 (ADR 0012): a ui-select / ui-radio `options` binding is STRUCTURAL
    // — its store slice is legitimately an array (or object map), not a scalar
    // display value. The generic store resolver rejects object/array slices
    // (display-only), so resolve options through the structural path that keeps
    // the array intact. Both nodes share the same options model.
    if ((component.kind === "select" || component.kind === "radio") && component.bind.options) {
        resolvedProps.options = resolveStructuralBinding(component.bind.options, context.sources);
    }

    // P157 (ADR 0012): ui-menu `items` is the SAME structural-array case as
    // ui-select `options` — the menu renders its entries ITSELF (no slot-per-item),
    // so a bound store/query slice that is legitimately an array of menu items must
    // keep its shape, not be coerced by the display-scalar resolver. Resolve it
    // through the SHARED structural path (reused from P133). `activeItem` is a plain
    // READ-ONLY display value (the active route/path) — resolved through the normal
    // scalar path into resolvedProps.activeItem so the serializer can mark the match.
    if (component.kind === "menu") {
        if (component.bind.items) {
            resolvedProps.items = resolveStructuralBinding(component.bind.items, context.sources);
        }
        if (component.bind.activeItem) {
            resolvedProps.activeItem = resolveBinding(component.bind.activeItem, context.sources);
        }
    }

    // P158 (ADR 0012): ui-table `rows` is the SAME structural-array case as
    // ui-select `options` (P133) / ui-menu `items` (P157) — the table renders its
    // rows ITSELF from this DATA SOURCE (NOT a repeats case). A bound store slice
    // is legitimately an array of row records, which the display-scalar resolver
    // rejects; resolve `rows` through the SHARED structural path (reused from
    // P133) so store/query/reactive/literal arrays keep their shape. `columns`
    // stays a plain prop (schema, not a data source).
    if (component.kind === "table" && component.bind.rows) {
        resolvedProps.rows = resolveStructuralBinding(component.bind.rows, context.sources);
    }

    const baseComponent: RenderedComponentBase = {
        id: component.id,
        kind: component.kind,
        mount: component.mount,
        props: resolvedProps,
        events: component.events,
        disabled: !enabled || Boolean(disabledBinding)
    };

    switch (component.kind) {
        case "text":
            return {
                ...baseComponent,
                kind: "text",
                // P104: the display value runs through the one central normalization.
                // `value` is the bound display value; `text` is the static fallback
                // when no value is bound (value undefined). null/non-scalar → "?".
                text: normalizeDisplayValue(resolvedProps.value ?? resolvedProps.text)
            };
        case "button":
            return {
                ...baseComponent,
                kind: "button",
                label: String(resolvedProps.label ?? component.id)
            };
        case "table":
            return {
                ...baseComponent,
                kind: "table",
                columns: asStringArray(resolvedProps.columns),
                rows: asRecordArray(resolvedProps.rows)
            };
        case "card":
            return {
                ...baseComponent,
                kind: "card",
                title: typeof resolvedProps.title === "string" ? resolvedProps.title : undefined,
                data: resolvedProps.customer ?? resolvedProps.data
            };
        case "container": {
            const layoutId = typeof resolvedProps.layoutId === "string" ? resolvedProps.layoutId : undefined;

            if (!layoutId) {
                return undefined;
            }

            const layout = findLayout(appModel, layoutId);

            return {
                ...baseComponent,
                kind: "container",
                layoutId,
                title: typeof resolvedProps.title === "string" ? resolvedProps.title : undefined,
                regions: renderRegions(
                    layout.slots,
                    createContainerMountMatcher(appModel, component.id, layoutId),
                    appModel,
                    context
                )
            };
        }
        case "input":
            return {
                ...baseComponent,
                kind: "input",
                value: resolvedProps.value
            };
        // P104: ui-badge binds a pure display value — always route it through the
        // one central normalization (0 → "0", "" → empty, null/undefined/object/
        // array → "?"). Split out of the generic fall-through below because the
        // other generic kinds carry structural values (image/avatar src URLs, the
        // pagination page object, breadcrumb/tabs/menu item arrays) that must NOT
        // be coerced to "?".
        case "badge":
            return {
                ...baseComponent,
                kind: "badge",
                value: normalizeDisplayValue(resolvedProps.value)
            } as RenderedGenericComponent;
        // P104: ui-alert's message is also a display value. It is normalized when
        // actually bound; an unbound message (resolvedProps.value === undefined) is
        // left undefined so the serializer applies its static props.message fallback.
        case "alert":
            return {
                ...baseComponent,
                kind: "alert",
                value: resolvedProps.value === undefined ? undefined : normalizeDisplayValue(resolvedProps.value)
            } as RenderedGenericComponent;
        // P25: P16x interactive kinds — rendered generically with value + all props.
        // P155 (ADR 0012): ui-tabs `activeTab` is the TWO-WAY input value — it
        // resolves through bind.value into resolvedProps.value (read source); the
        // serializer reads component.value to mark the matching sl-tab active. The
        // existing tab-change event carries the new tab id on the out-port, which a
        // wired flow writes back to the bound store (declarative roundtrip).
        // P156 (ADR 0012): ui-stepper `activeStep` mirrors the same TWO-WAY path —
        // it resolves through bind.value into resolvedProps.value (read source); the
        // serializer reads component.value to mark the active step. The existing
        // step-change event carries the chosen step id, which a wired flow writes
        // back to the bound store (declarative roundtrip).
        // P168 (ADR 0018, Model 1a): ui-tabs derives one panel per `ui-tab` child.
        // It is NOT a plain generic value component — it carries `regions` (one per
        // child) and `props.tabs` metadata. Handled by its own path below.
        case "tabs":
            return renderTabs(component, baseComponent, resolvedProps, context, appModel);
        // P168: a `ui-tab` renders NO standalone chrome — its parent `tabs`
        // component enumerates it and renders its panel. A `tab` reached here
        // directly (not via its tabs parent) is dropped from the region.
        case "tab":
            return undefined;
        // P169 (ADR 0018, Model 1a): ui-accordion derives one collapsible panel per
        // `ui-accordion-section` child. Like tabs, it carries `regions` (one per
        // child) + `props.sections` metadata. Handled by its own path below.
        case "accordion":
            return renderAccordion(component, baseComponent, resolvedProps, context, appModel);
        // P169: a `ui-accordion-section` renders NO standalone chrome — its parent
        // `accordion` enumerates it and renders its panel. A section reached here
        // directly (not via its accordion parent) is dropped from the region.
        case "accordion-section":
            return undefined;
        case "select":
        case "checkbox":
        case "radio":
        case "switch":
        case "textarea":
        case "datepicker":
        case "slider":
        case "progress":
        case "breadcrumb":
        case "menu":
        case "avatar":
        // P70: image — src binding resolved into resolvedProps.value (routed
        // through bind.value like avatar); the serializer reads component.value.
        // falls through
        case "image":
        // P154 (ADR 0012): ui-pagination `currentPage` is the TWO-WAY input value —
        // it resolves through bind.value into resolvedProps.value (read source); the
        // serializer emits a `change` event carrying the new page on click, which the
        // wired flow writes back to the bound store. `total` (read-only) resolves
        // through bind.totalPages into resolvedProps.totalPages (page-count label /
        // last-page guard). Both ride in baseComponent.props (= resolvedProps).
        // falls through — P45: composite and layout nodes
        case "list":
        case "pagination":
        case "stepper":
            return {
                ...baseComponent,
                kind: component.kind,
                value: resolvedProps.value
            } as RenderedGenericComponent;
        // P57: ui-log — persistent error/log display panel. No value binding;
        // config props (minSeverity, maxEntries, collapsed) are passed through
        // via baseComponent.props.
        case "log":
            return {
                ...baseComponent,
                kind: "log",
                value: undefined
            } as RenderedGenericComponent;
        // P69: icon — the icon value (literal or resolved binding) is carried in
        // resolvedProps.icon; the serializer renders it as <sl-icon>.
        case "icon":
            return {
                ...baseComponent,
                kind: "icon",
                value: resolvedProps.icon
            } as RenderedGenericComponent;
        // P83: divider — static separator, no value binding. Props (orientation,
        // label) pass through via baseComponent.props.
        case "divider":
            return {
                ...baseComponent,
                kind: "divider",
                value: undefined
            } as RenderedGenericComponent;
    }
}

function componentSort(left: ComponentDefinition, right: ComponentDefinition): number {
    const leftOrder = left.order ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.order ?? Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
    }

    return left.id.localeCompare(right.id);
}

function renderRegions(
    slotDefinitions: SlotDefinition[],
    shouldIncludeMount: (component: ComponentDefinition, regionPath: string[]) => boolean,
    appModel: AppModel,
    context: ComponentRenderContext
): RenderedRegion[] {
    return slotDefinitions.map((slotDefinition) => {
        const regionPath = [slotDefinition.name];
        const mountedComponents = appModel.components
            .filter((component) => shouldIncludeMount(component, regionPath))
            .sort(componentSort)
            // P164 (ADR 0017): a `repeat` component carries no rendered chrome — it
            // EXPANDS in place into n× cloned subtrees, which flatten into THIS
            // region (flatMap). Every other kind maps to at most one component.
            .flatMap((component) => component.kind === "repeat"
                ? expandRepeat(component, context, appModel)
                : [toRenderedComponent(component, context, appModel)])
            .filter((component): component is RenderedComponent => component !== undefined);

        return {
            kind: "region",
            name: slotDefinition.name,
            title: slotDefinition.title,
            components: mountedComponents,
            regions: []
        };
    });
}

/**
 * P164 (ADR 0017): match a `ui-repeat`'s default-slot children. A repeat is a
 * template container with a single fixed `content` slot (REPEAT_SLOT), so its
 * children address it exactly as any container child does — `container:<repeatId>/
 * content`. (A repeat carries no layout, so the `layout:` fallback of the generic
 * container matcher does not apply.)
 */
function createRepeatChildMatcher(
    repeatId: string
): (component: ComponentDefinition, regionPath: string[]) => boolean {
    return (component, regionPath) => {
        const rawMount = component.mount.trim();

        if (!rawMount.startsWith("container:")) {
            return false;
        }

        const separatorIndex = rawMount.indexOf("/");

        if (separatorIndex < 0) {
            return false;
        }

        const targetContainerId = rawMount.slice("container:".length, separatorIndex);
        const regionKey = rawMount.slice(separatorIndex + 1);

        return targetContainerId === repeatId && regionKey === regionPath.join("/");
    };
}

/**
 * P168 (ADR 0018, Model 1a): match children mounted into a `ui-tabs` / `ui-tab`
 * host. The CANONICAL mount shape is `<prefix>:<hostId>/<slot>` (e.g.
 * `ui-tabs:t1/content`, `ui-tab:overview/content` — what the schema's
 * `uiTabContentMount` / migration emit). The editor's mount-tree picker surfaces
 * these hosts via the shared container machinery, which emits the generic
 * `container:<hostId>/<slot>` form — so BOTH are accepted here (the `container:`
 * alias lets the existing two-column picker drive tabs with no special-casing).
 */
function createTabMountMatcher(
    prefix: string,
    hostId: string
): (component: ComponentDefinition, regionPath: string[]) => boolean {
    const heads = [`${prefix}:`, "container:"];
    return (component, regionPath) => {
        const rawMount = component.mount.trim();
        const head = heads.find((candidate) => rawMount.startsWith(candidate));

        if (!head) {
            return false;
        }

        const separatorIndex = rawMount.indexOf("/");

        if (separatorIndex < 0) {
            return false;
        }

        const targetId = rawMount.slice(head.length, separatorIndex);
        const regionKey = rawMount.slice(separatorIndex + 1);

        return targetId === hostId && regionKey === regionPath.join("/");
    };
}

/**
 * P170 (ADR 0017 × 0018, capstone): one resolved tab/section child of a
 * `ui-tabs`/`ui-accordion`, after the DYNAMIC case has been folded in. There is
 * NO bespoke dynamic-slot mechanism — a data-driven section is simply a `ui-tab`
 * (or `ui-accordion-section`) TEMPLATE inside a `ui-repeat` mounted into the
 * container. This struct is the unification point: a static child and a
 * repeat-cloned child are both reduced to the same shape.
 *
 * - `def` — the section definition. For a static child this is the node itself.
 *   For a repeat clone it is the template with a composed per-instance id
 *   (`<itemKey>#<templateId>`), exactly as `expandRepeat` keys its clones, so the
 *   visible tab id is stable/keyed and `activeTab`/open-state survives data change.
 * - `templateId` — the ORIGINAL section-node id (== `def.id` for a static child).
 *   The content subtree mounts at `ui-tab:<templateId>/content`, so content
 *   enumeration must address the template, not the composed clone id.
 * - `context` — the render-time scope the section resolves against. For a repeat
 *   clone this carries the `{item,index}` frame pushed by the repeat, so the
 *   child's `label` AND its content's `item.*` bindings resolve to that row.
 */
interface ResolvedSectionChild {
    def: ComponentDefinition;
    templateId: string;
    context: ComponentRenderContext;
}

/**
 * P170 (ADR 0017 × 0018): enumerate the tab/section children of a container,
 * COMPOSING the static and dynamic cases. A child mounted directly into the
 * container of the matching `kind` is one static section. A `ui-repeat` mounted
 * into the container is EXPANDED: each item clones the repeat's section-kind
 * template into one keyed section, scoped to that item's frame. No new
 * mechanism — this is `expandRepeat`'s frame/key logic (ADR 0017) reused so the
 * container's child enumeration (ADR 0018) sees repeat-expanded children.
 */
function resolveSectionChildren(
    hostPrefix: "ui-tabs" | "ui-accordion",
    sectionKind: "tab" | "accordion-section",
    hostId: string,
    context: ComponentRenderContext,
    appModel: AppModel
): ResolvedSectionChild[] {
    const directMatcher = createTabMountMatcher(hostPrefix, hostId);
    const directChildren = appModel.components
        .filter((candidate) =>
            (candidate.kind === sectionKind || candidate.kind === "repeat") &&
            directMatcher(candidate, [TAB_SLOT]))
        .sort(componentSort);

    return directChildren.flatMap((child) => {
        // Static case: a section node mounted straight into the container.
        if (child.kind === sectionKind) {
            return [{ def: child, templateId: child.id, context }];
        }

        // Dynamic case: a `ui-repeat` whose template is a section node. Reuse the
        // repeat's own item resolution + per-instance keying so the visible tab
        // set is data-driven and keyed exactly like every other repeat clone.
        const repeat = child;
        const items = resolveStructuralBinding(repeat.bind.items, context.sources);
        const frames = resolveRepeatItems(items);
        const keyField = typeof repeat.props.keyField === "string" ? repeat.props.keyField : undefined;
        const sectionTemplates = appModel.components
            .filter((candidate) =>
                candidate.kind === sectionKind &&
                createRepeatChildMatcher(repeat.id)(candidate, [REPEAT_SLOT]))
            .sort(componentSort);

        return frames.flatMap((frame) => {
            const itemKey = repeatItemKey(frame, keyField);
            const scopedContext: ComponentRenderContext = {
                sources: {
                    ...context.sources,
                    itemScope: [...(context.sources.itemScope ?? []), frame]
                }
            };
            return sectionTemplates.map((template) => ({
                def: { ...template, id: `${itemKey}#${template.id}` },
                templateId: template.id,
                context: scopedContext
            }));
        });
    });
}

/**
 * P170 (ADR 0017 × 0018): resolve a section's CONTENT subtree against the
 * section's scope. Content mounts at `<contentPrefix>:<templateId>/content` — the
 * TEMPLATE id, never the composed clone id — so a single static template mount
 * fans out to every item instance. The content resolves against the section's
 * (possibly item-scoped) context, so `item.*` bindings inside a dynamic tab's
 * content resolve to that row; a nested `ui-repeat` inside the content still
 * expands normally.
 */
function renderSectionContent(
    contentPrefix: "ui-tab" | "ui-accordion-section",
    section: ResolvedSectionChild,
    appModel: AppModel
): RenderedComponent[] {
    const contentMatcher = createTabMountMatcher(contentPrefix, section.templateId);
    return appModel.components
        .filter((candidate) => contentMatcher(candidate, [TAB_SLOT]))
        .sort(componentSort)
        .flatMap((candidate) => candidate.kind === "repeat"
            ? expandRepeat(candidate, section.context, appModel)
            : [toRenderedComponent(candidate, section.context, appModel)])
        .filter((rendered): rendered is RenderedComponent => rendered !== undefined);
}

/**
 * P168 (ADR 0018, Model 1a): render a `ui-tabs` from its mounted `ui-tab`
 * children. Each child becomes exactly one panel/region (region name = child
 * id); the child's `label` is resolved (literal/state/store/query binding); the
 * active tab is `component.value` (the two-way `activeTab` binding) and falls
 * back to the first child by `order` (`defaultActiveTabId`) when absent/invalid.
 * The child's content subtree mounts into `ui-tab:<childId>/content`.
 *
 * P170 (ADR 0017 × 0018): the child enumeration is COMPOSED via
 * `resolveSectionChildren`, so a `ui-repeat` of `ui-tab` mounted into the
 * container produces one keyed tab per data item — the dynamic case with no new
 * mechanism.
 */
function renderTabs(
    component: ComponentDefinition,
    baseComponent: RenderedComponentBase,
    resolvedProps: Record<string, unknown>,
    context: ComponentRenderContext,
    appModel: AppModel
): RenderedTabsComponent {
    // P170: COMPOSED enumeration — static `ui-tab` children AND repeat-expanded
    // `ui-tab` clones, each reduced to a `ResolvedSectionChild` (keyed clone id +
    // template id + item scope). The dynamic case is just a `ui-repeat` here.
    const tabChildren = resolveSectionChildren("ui-tabs", "tab", component.id, context, appModel);

    // Default active = first child by order; an absent/invalid bound value falls
    // back to it (ADR 0018 §4). `component.value` is the resolved activeTab.
    const defaultId = defaultActiveTabId(
        tabChildren.map((child) => ({ id: child.def.id, order: child.def.order }))
    );
    const boundValue = resolvedProps.value;
    const boundId = boundValue === undefined || boundValue === null ? undefined : String(boundValue);
    const activeId = boundId !== undefined && tabChildren.some((child) => child.def.id === boundId)
        ? boundId
        : defaultId;

    const tabsMeta = tabChildren.map((child) => {
        // Label resolves against the SECTION's scope, so a dynamic tab's
        // `label = item.<field>` resolves to that row.
        const resolvedLabel = resolveBinding(child.def.bind.label, child.context.sources);
        const label = resolvedLabel !== undefined && resolvedLabel !== null
            ? String(resolvedLabel)
            : child.def.id;
        const icon = typeof child.def.props.icon === "string" ? child.def.props.icon : undefined;
        return {
            id: child.def.id,
            label,
            ...(icon ? { icon } : {}),
            active: child.def.id === activeId
        };
    });

    // One region per child (region name = child id) holding the child's content
    // subtree (mounted at `ui-tab:<templateId>/content`, resolved in scope).
    const regions: RenderedRegion[] = tabChildren.map((child) => ({
        kind: "region",
        name: child.def.id,
        components: renderSectionContent("ui-tab", child, appModel),
        regions: []
    }));

    return {
        ...baseComponent,
        kind: "tabs",
        value: activeId,
        props: {
            ...resolvedProps,
            tabs: tabsMeta
        },
        regions
    };
}

/**
 * P169 (ADR 0018, Model 1a): render a `ui-accordion` from its mounted
 * `ui-accordion-section` children. Each child becomes exactly one collapsible
 * panel/region (region name = child id); the child's `label` is resolved
 * (literal/state/store/query binding); the open section is `component.value` (the
 * two-way `openSection` binding) and falls back to the first child by `order`
 * (`defaultOpenSectionId`) when absent/invalid. The child's content subtree mounts
 * into `ui-accordion-section:<childId>/content`. Mirrors `renderTabs` (P168).
 */
function renderAccordion(
    component: ComponentDefinition,
    baseComponent: RenderedComponentBase,
    resolvedProps: Record<string, unknown>,
    context: ComponentRenderContext,
    appModel: AppModel
): RenderedAccordionComponent {
    // P170: COMPOSED enumeration — static `ui-accordion-section` children AND
    // repeat-expanded section clones (keyed clone id + template id + item scope).
    // The dynamic case is just a `ui-repeat` of `ui-accordion-section` here.
    const sectionChildren = resolveSectionChildren("ui-accordion", "accordion-section", component.id, context, appModel);

    // Default open = first child by order; an absent/invalid bound value falls
    // back to it (ADR 0018 §4). `component.value` is the resolved openSection.
    const defaultId = defaultOpenSectionId(
        sectionChildren.map((child) => ({ id: child.def.id, order: child.def.order }))
    );
    const boundValue = resolvedProps.value;
    const boundId = boundValue === undefined || boundValue === null ? undefined : String(boundValue);
    const openId = boundId !== undefined && sectionChildren.some((child) => child.def.id === boundId)
        ? boundId
        : defaultId;

    const sectionsMeta = sectionChildren.map((child) => {
        const resolvedLabel = resolveBinding(child.def.bind.label, child.context.sources);
        const label = resolvedLabel !== undefined && resolvedLabel !== null
            ? String(resolvedLabel)
            : child.def.id;
        const icon = typeof child.def.props.icon === "string" ? child.def.props.icon : undefined;
        return {
            id: child.def.id,
            label,
            ...(icon ? { icon } : {}),
            open: child.def.id === openId
        };
    });

    // One region per child (region name = child id) holding the child's content
    // subtree (mounted at `ui-accordion-section:<templateId>/content`, in scope).
    const regions: RenderedRegion[] = sectionChildren.map((child) => ({
        kind: "region",
        name: child.def.id,
        components: renderSectionContent("ui-accordion-section", child, appModel),
        regions: []
    }));

    return {
        ...baseComponent,
        kind: "accordion",
        value: openId,
        props: {
            ...resolvedProps,
            sections: sectionsMeta
        },
        regions
    };
}

/**
 * P164 (ADR 0017): resolve a repeat's `items` collection into an ordered list of
 * `{item, index}` scope frames.
 *  - an ARRAY → one frame per element (`item` = the element).
 *  - an OBJECT → one frame per OWN entry, in insertion order, with
 *    `item = { key, value }` (the documented object-iteration shape).
 *  - anything else (scalar / null / undefined) → no frames (zero clones).
 * The structural resolver is reused so a store/query slice that is legitimately an
 * array/object keeps its shape (the display-scalar resolver would reject it).
 */
function resolveRepeatItems(items: unknown): ItemScopeFrame[] {
    if (Array.isArray(items)) {
        return items.map((item, index) => ({ item, index }));
    }

    if (items !== null && typeof items === "object") {
        return Object.entries(items as Record<string, unknown>).map(([key, value], index) => ({
            item: { key, value },
            index
        }));
    }

    return [];
}

/**
 * P164 (ADR 0017): per-instance key field for a repeated element. Stable identity
 * = the `keyField` value of the element (preferred) else the array index. For an
 * object source (`item = {key, value}`) the entry `key` is the natural stable key.
 * The result is stringified — it composes the cloned child id (`<itemKey>#<childId>`)
 * the serializer stamps as `data-webapp-node`, which feeds the existing keyed morph
 * so focus/scroll/DOM of unchanged instances survive reorder/insert/delete.
 */
function repeatItemKey(frame: ItemScopeFrame, keyField: string | undefined): string {
    if (keyField) {
        const fieldValue = getValueAtPath(frame.item, keyField);
        if (fieldValue !== undefined && fieldValue !== null && fieldValue !== "") {
            return String(fieldValue);
        }
    }

    // Object-source convention: the entry key is the stable identity when present
    // and no explicit keyField resolved.
    const record = frame.item;
    if (!keyField && record !== null && typeof record === "object" && "key" in (record as Record<string, unknown>)) {
        const entryKey = (record as Record<string, unknown>).key;
        if (typeof entryKey === "string" && entryKey.length > 0) {
            return entryKey;
        }
    }

    return String(frame.index);
}

/**
 * P164 (ADR 0017): EXPAND a `ui-repeat` into its per-item cloned subtrees.
 *
 * 1. Resolve `items` (structural — array/object/store/query/reactive slice).
 * 2. Build one `{item, index}` frame per element (object → `{key,value}` entries).
 * 3. For each frame, PUSH the frame onto the render-time item-scope stack, render
 *    the default-slot child subtree against the extended scope, then move on (the
 *    stack is rebuilt immutably, so there is nothing to pop). Children's `item` /
 *    `item.<path>` / `index` bindings resolve against the top frame.
 * 4. RE-ID each cloned component to a stable per-instance id `<itemKey>#<childId>`
 *    so the serializer stamps a unique `data-webapp-node` and the keyed morph can
 *    preserve unchanged instances across reorder/insert/delete.
 *
 * The repeat itself emits NO wrapper component — its clones flatten into the host
 * region (the caller flatMaps). Zero items → zero components.
 */
function expandRepeat(
    repeat: ComponentDefinition,
    context: ComponentRenderContext,
    appModel: AppModel
): RenderedComponent[] {
    // `items` is a structural source (array/object), not a display scalar — resolve
    // it through the shared structural path so store/query slices keep their shape.
    const items = resolveStructuralBinding(repeat.bind.items, context.sources);
    const frames = resolveRepeatItems(items);
    const keyField = typeof repeat.props.keyField === "string" ? repeat.props.keyField : undefined;

    const childMatcher = createRepeatChildMatcher(repeat.id);
    const templateChildren = appModel.components
        .filter((component) => childMatcher(component, [REPEAT_SLOT]))
        .sort(componentSort);

    return frames.flatMap((frame) => {
        const itemKey = repeatItemKey(frame, keyField);
        // Immutable scope extension — the new frame is the innermost (top) one.
        const scopedContext: ComponentRenderContext = {
            sources: {
                ...context.sources,
                itemScope: [...(context.sources.itemScope ?? []), frame]
            }
        };

        return templateChildren
            .flatMap((child) => {
                // Stable per-instance identity = itemKey × childId. The clone carries
                // this composed id so each instance has a unique data-webapp-node.
                const clone: ComponentDefinition = { ...child, id: `${itemKey}#${child.id}` };

                // P164: NESTED repeats — a repeat inside a repeat's template expands
                // recursively against the EXTENDED scope (the inner frame becomes the
                // new innermost = top; `item`/`index` resolve to the innermost, so
                // the inner level wins). The cloned (re-id'd) inner repeat keeps its
                // child mounts pointing at the ORIGINAL inner-repeat id, so resolve
                // the inner template against the original node, not the clone.
                if (child.kind === "repeat") {
                    return expandRepeat(child, scopedContext, appModel).map((rendered) => ({
                        ...rendered,
                        id: `${itemKey}#${rendered.id}`
                    }));
                }

                const rendered = toRenderedComponent(clone, scopedContext, appModel);
                return rendered === undefined ? [] : [rendered];
            })
            .filter((component): component is RenderedComponent => component !== undefined);
    });
}

function createMountMatcher(
    appModel: AppModel,
    targets: Array<{
        scope: "route" | "dialog" | "layout";
        targetId: string;
    }>
): (component: ComponentDefinition, regionPath: string[]) => boolean {
    return (component, regionPath) => {
        const resolvedMount = resolveMountReference(component.mount, appModel);

        if (!resolvedMount.success) {
            return false;
        }

        const regionKey = regionPath.join("/");

        return targets.some(
            (target) =>
                resolvedMount.data.scope === target.scope &&
                resolvedMount.data.targetId === target.targetId &&
                resolvedMount.data.regionPath.join("/") === regionKey
        );
    };
}

// Container children are addressed either by the container's own id
// (`container:<id>/<region>`, the form the editor emits) or by the container's
// layout id (`layout:<layoutId>/<region>`, the form the typed fixture uses).
// Both resolve to the same rendered region; mount resolution lives only here.
function createContainerMountMatcher(
    appModel: AppModel,
    containerId: string,
    layoutId: string
): (component: ComponentDefinition, regionPath: string[]) => boolean {
    const layoutMatcher = createMountMatcher(appModel, [{ scope: "layout", targetId: layoutId }]);

    return (component, regionPath) => {
        const rawMount = component.mount.trim();

        if (rawMount.startsWith("container:")) {
            const separatorIndex = rawMount.indexOf("/");

            if (separatorIndex < 0) {
                return false;
            }

            const targetContainerId = rawMount.slice("container:".length, separatorIndex);
            const regionKey = rawMount.slice(separatorIndex + 1);

            return targetContainerId === containerId && regionKey === regionPath.join("/");
        }

        return layoutMatcher(component, regionPath);
    };
}

function flattenRegions(regions: RenderedRegion[]): RenderedComponent[] {
    return regions.flatMap((region) => region.components.flatMap((component) => {
        // P168 (ADR 0018): a `tabs` component nests its per-child panels in
        // `regions` (like a container), so flatten into them to surface the
        // content of every tab (for event/wire resolution and snapshot lookups).
        if (component.kind === "container" || component.kind === "tabs") {
            return [component, ...flattenRegions(component.regions)];
        }

        return [component];
    }));
}

function inferDialogTransition(action: string | undefined, appModel: AppModel): { dialogId: string; open: boolean } | undefined {
    if (!action) {
        return undefined;
    }

    const lowerAction = action.toLowerCase();
    const transition = lowerAction.startsWith("open") ? true : lowerAction.startsWith("close") ? false : undefined;

    if (transition === undefined) {
        return undefined;
    }

    const suffix = action.slice(transition ? 4 : 5);

    if (!suffix) {
        return undefined;
    }

    const dialogId = `${suffix.slice(0, 1).toLowerCase()}${suffix.slice(1)}`;

    return appModel.dialogs.some((dialog) => dialog.id === dialogId)
        ? {
            dialogId,
            open: transition
        }
        : undefined;
}

function findRenderedComponent(snapshot: RenderSnapshot, componentId: string): RenderedComponent | undefined {
    return [...flattenRegions(snapshot.regions), ...snapshot.dialogs.flatMap((dialog) => flattenRegions(dialog.regions))].find(
        (component) => component.id === componentId
    );
}

export function createRendererApp(appModel: AppModel, options: RendererAppOptions = {}): RendererApp {
    const integration = normalizeIntegration(options.integration);
    // P67: store id → statePath lookup for `store` bindings. Built once; stores
    // do not change between renders within an app instance.
    const storePaths = integration.stores.reduce<Record<string, string>>((paths, store) => {
        paths[store.id] = store.statePath;
        return paths;
    }, {});
    // P115: store NAME → statePath, the lookup `store("<name>")` uses inside a
    // reactive expression. Duplicate names are marked ambiguous (not last-wins).
    const storeNamePaths = buildStoreNamePaths(integration.stores);
    // P131 (ADR 0013): store id → display NAME, for the speaking sub-path errors.
    const storeNames = integration.stores.reduce<Record<string, string>>((names, store) => {
        if (typeof store.name === "string" && store.name.trim().length > 0) {
            names[store.id] = store.name;
        }
        return names;
    }, {});
    // P115: dedup distinct reactive failures per app instance, so a broken
    // expression is reported once — not on every re-render. The set persists
    // across render()/navigate()/replaceState()/replaceQueries() calls.
    const reportedReactiveErrors = new Set<string>();
    const reportReactiveError: ReactiveErrorReporter | undefined = options.onReactiveError
        ? (error) => {
            if (reportedReactiveErrors.has(error.key)) {
                return;
            }

            reportedReactiveErrors.add(error.key);
            options.onReactiveError?.(error);
        }
        : undefined;
    let location = options.location ?? appModel.routes[0]?.path ?? "/";
    let queries = options.queries ?? {};
    let queryLifecycle = options.queryLifecycle ?? {};
    let state = initializeState(options.state ?? {}, queries, integration);

    function render(): RenderSnapshot {
        const routeMatch = matchRoute(location, appModel.routes);
        const layout = findLayout(appModel, routeMatch.route.layoutId);
        const context: ComponentRenderContext = {
            sources: {
                state,
                queries,
                queryLifecycle,
                params: routeMatch.params,
                storePaths,
                storeNamePaths,
                storeNames,
                reportReactiveError
            }
        };
        const dialogs = appModel.dialogs
            .filter((dialog) => !dialog.routeId || dialog.routeId === routeMatch.route.id)
            .filter((dialog) => isDialogOpen(state, dialog.id))
            .map<RenderedDialog>((dialog) => ({
                id: dialog.id,
                title: dialog.title,
                modal: dialog.modal,
                closable: dialog.closable,
                open: true,
                layoutId: dialog.layoutId,
                regions: renderRegions(
                    findLayout(appModel, dialog.layoutId).slots,
                    createMountMatcher(appModel, [
                        { scope: "dialog", targetId: dialog.id },
                        { scope: "layout", targetId: dialog.layoutId }
                    ]),
                    appModel,
                    context
                )
            }));

        return {
            appId: appModel.id,
            name: appModel.name,
            location,
            route: routeMatch.route,
            params: routeMatch.params,
            layout,
            regions: renderRegions(
                layout.slots,
                createMountMatcher(appModel, [
                    { scope: "route", targetId: routeMatch.route.id },
                    { scope: "layout", targetId: layout.id }
                ]),
                appModel,
                context
            ),
            dialogs
        };
    }

    function replaceState(nextState: Record<string, unknown>): RenderSnapshot {
        state = initializeState(nextState, queries, integration);
        return render();
    }

    function replaceQueries(nextQueries: Record<string, unknown>, nextQueryLifecycle?: Record<string, Record<string, unknown>>): RenderSnapshot {
        queries = nextQueries;
        if (nextQueryLifecycle !== undefined) {
            queryLifecycle = nextQueryLifecycle;
        }
        state = syncQueryState(state, queries, integration);
        return render();
    }

    function navigate(nextLocation: string): RenderSnapshot {
        location = nextLocation;
        return render();
    }

    function dispatchEvent(componentId: string, event: UiEventName, payload: Record<string, unknown> = {}): DispatchResult {
        const snapshotBeforeDispatch = render();
        const renderedComponent = findRenderedComponent(snapshotBeforeDispatch, componentId);

        if (!renderedComponent) {
            throw new Error(`Renderer cannot dispatch '${event}' for missing component '${componentId}'.`);
        }

        if (renderedComponent.disabled) {
            throw new Error(`Renderer cannot dispatch '${event}' for disabled component '${componentId}'.`);
        }

        const sourceComponent = appModel.components.find((component) => component.id === componentId);
        const eventBinding = sourceComponent?.events.find((candidate) => candidate.event === event);
        const action = eventBinding?.action;
        const triggeredQueries = findTriggeredQueries(action, integration);
        const navigation = findNavigation(action, integration);
        const statePatch: Record<string, unknown> = getObjectRecord(payload.statePatch);
        const nextPayload: Record<string, unknown> = {
            ...payload
        };

        if (action) {
            nextPayload.action = action;
        }

        if (
            sourceComponent?.kind === "input" &&
            event === "change" &&
            sourceComponent.bind.value?.kind === "state" &&
            sourceComponent.bind.value.path &&
            payload.value !== undefined
        ) {
            statePatch[sourceComponent.bind.value.path] = payload.value;
        }

        const dialogTransition = inferDialogTransition(action, appModel);

        if (dialogTransition) {
            statePatch[`ui.dialogs.${dialogTransition.dialogId}.open`] = dialogTransition.open;
        }

        for (const triggeredQuery of triggeredQueries) {
            const hasCachedData = getValueAtPath(queries, triggeredQuery.queryPath) !== undefined;
            statePatch[`ui.queries.${triggeredQuery.id}.loading`] = true;
            statePatch[`ui.queries.${triggeredQuery.id}.status`] = hasCachedData ? "refreshing" : "loading";
        }

        state = applyStatePatch(state, statePatch);

        const navigationTarget = navigation ? resolveNavigationTarget(navigation, payload, snapshotBeforeDispatch.params) : undefined;

        if (navigationTarget) {
            location = navigationTarget;
        }

        const message = uiEventMessageSchema.parse({
            ui: {
                event,
                componentId,
                action,
                route: snapshotBeforeDispatch.location,
                params: snapshotBeforeDispatch.params,
                statePatch,
                payload: nextPayload,
                dialog: dialogTransition
                    ? {
                        id: dialogTransition.dialogId,
                        open: dialogTransition.open
                    }
                    : undefined,
                navigation: navigation && navigationTarget
                    ? {
                        id: navigation.id,
                        to: navigationTarget
                    }
                    : undefined,
                queries: triggeredQueries.map((query) => ({
                    id: query.id,
                    queryPath: query.queryPath,
                    mode: getValueAtPath(queries, query.queryPath) !== undefined ? "refresh" : "load"
                }))
            }
        });

        return {
            message,
            snapshot: render()
        };
    }

    return {
        render,
        navigate,
        replaceQueries,
        replaceState,
        dispatchEvent
    };
}

export function findComponentInSnapshot(snapshot: RenderSnapshot, componentId: string): RenderedComponent | undefined {
    return findRenderedComponent(snapshot, componentId);
}

export function matchRouteLocation(location: string, appModel: AppModel): RouteMatch {
    return matchRoute(location, appModel.routes);
}
/**
 * P115 (ADR 0010) — `reactive` binding evaluation.
 *
 * A `reactive` binding carries a single synchronous JavaScript expression as its
 * `value`. The renderer compiles it ONCE (cached by source string) and evaluates
 * it on every snapshot, so reactivity falls out of the renderer's per-snapshot
 * re-resolution with no dependency tracking or subscriptions.
 *
 * The expression sees exactly the client-known binding sources as globals:
 *   - `routeParam` — the resolved route params object (same source as the
 *     `routeParam` binding kind).
 *   - `store(name)` — live value of the parent app's ui-store whose NAME equals
 *     `name` (trimmed, exact match) → its statePath → live state value.
 *   - `query(path)` — value at `path` inside the query results (same lookup as
 *     the `query` binding kind).
 *   - `item` / `index` — P185 (ADR 0017): the render-time scope-local element and
 *     its zero-based position of the INNERMOST active `ui-repeat`. Injected by the
 *     renderer per-instance (one compiled fn, distinct bound values per clone).
 *     OUTSIDE any repeat both are `undefined` (no throw), mirroring the
 *     `item`/`index` binding kinds.
 *   - `prop` — P185 (ADR 0020): the resolved props of the INNERMOST active
 *     `ui-component-instance` (whole frame object; `prop.<name>` reaches a prop).
 *     OUTSIDE any instance it is `undefined`.
 *   - `scope(name)` — P196 (ADR 0023): the item of the ENCLOSING `ui-repeat`
 *     NAMED `name` (`ui-repeat.itemName`), so `scope("customer").name` reads an
 *     OUTER repeat's element past inner ones. A namespaced FUNCTION (not a bare
 *     global) so it never collides with `store`/`query`/`routeParam`/`item`/
 *     `index`. Outside any matching named scope it returns `undefined` (no throw).
 *   - `user` — P262 (ADR 0041 §3/§4): the requesting client's identity object
 *     ({ id, name?, email?, groups }) — the same source as the `user` binding
 *     kind. `undefined` when there is no identity (auth mode "none"), so guard
 *     against it: `(user?.groups ?? []).includes("admins")`. This is the
 *     documented visibleIf pattern for group-based UI hiding (UX — the security
 *     is the server-side `requiresGroup` guard).
 * Nothing else is exposed (no `msg`, no flow/global/env, no host objects).
 *
 * Error containment is by contract: a compile error, an evaluation throw, or a
 * Promise/thenable return NEVER breaks the snapshot. The caller substitutes the
 * invalid-value marker and reports the error once per distinct error.
 */

export type ReactiveCompiledFn = (
    routeParam: Record<string, string>,
    store: (name: unknown) => unknown,
    query: (path: unknown) => unknown,
    item: unknown,
    index: number | undefined,
    prop: unknown,
    scope: (name: unknown) => unknown,
    user: unknown
) => unknown;

/** Sources the reactive evaluator reads. */
export interface ReactiveSources {
    state: Record<string, unknown>;
    queries: Record<string, unknown>;
    params: Record<string, string>;
    /** Store NAME → statePath. Built alongside the id→statePath map. */
    storeNamePaths: Record<string, string>;
    /**
     * P185 (ADR 0017): the render-time `item` of the innermost active `ui-repeat`,
     * injected per-instance. `undefined` outside any repeat.
     */
    item?: unknown;
    /**
     * P185 (ADR 0017): the zero-based position of the current element in the
     * innermost active repeat. `undefined` outside any repeat.
     */
    index?: number;
    /**
     * P185 (ADR 0020): the resolved prop frame of the innermost active
     * `ui-component-instance`. `undefined` outside any instance.
     */
    prop?: unknown;
    /**
     * P196 (ADR 0023): the item of each ENCLOSING NAMED `ui-repeat`, keyed by
     * its `itemName` alias — the source for the reactive `scope(name)` accessor.
     * An inner same-named repeat shadows an outer one (innermost wins), mirroring
     * `selectItemFrame`. `scope("x")` for an absent name returns `undefined`
     * (no throw). Absent/empty outside any named repeat.
     */
    scopeItems?: Record<string, unknown>;
    /**
     * P262 (ADR 0041 §3/§4): the requesting client's identity object — the same
     * source the `user` binding kind resolves against. `undefined` when there is
     * no identity (auth mode "none").
     */
    user?: unknown;
}

/** A distinct evaluation failure, surfaced to the caller for containment + logging. */
export interface ReactiveError {
    /** The expression source that failed. */
    source: string;
    /** Human-readable failure message. */
    message: string;
    /** A stable dedup key (source + message). */
    key: string;
    /**
     * ADR 0032: the id of the node whose binding produced this error, so the host
     * can surface it ON that node (status badge) and attribute the log line, rather
     * than emitting an anonymous app-level error. Optional — absent when the render
     * context has no owning node (e.g. a synthetic/cloned component).
     */
    nodeId?: string;
    /**
     * ADR 0032: severity hint. Store sub-path config problems are `warn` (non-fatal:
     * the snapshot still renders, the node shows a yellow status). A general reactive
     * expression failure is left unset and the host treats it as `error`.
     */
    severity?: "warn" | "error";
}

export interface ReactiveEvalResult {
    /** The resolved value, or `undefined` when the expression failed. */
    value: unknown;
    /** Present only on failure; the caller substitutes the invalid-value marker. */
    error?: ReactiveError;
}

/**
 * Module-wide compile cache. Key = expression source string. A sentinel `null`
 * marks a source whose COMPILATION already failed, so we neither recompile nor
 * re-report a syntax error on every render.
 */
const compileCache = new Map<string, ReactiveCompiledFn | null>();

/**
 * Test-only hooks. `__compileCount` lets tests assert compile-once behaviour;
 * `__resetReactiveCache` clears state between tests.
 */
let compileCount = 0;

export function __getReactiveCompileCount(): number {
    return compileCount;
}

export function __resetReactiveCache(): void {
    compileCache.clear();
    compileCount = 0;
}

function compile(source: string): ReactiveCompiledFn | null {
    if (compileCache.has(source)) {
        return compileCache.get(source) ?? null;
    }

    let compiled: ReactiveCompiledFn | null;

    try {
        compileCount += 1;
        compiled = new Function(
            "routeParam",
            "store",
            "query",
            "item",
            "index",
            "prop",
            "scope",
            "user",
            '"use strict"; return ( ' + source + " );"
        ) as ReactiveCompiledFn;
    } catch {
        // Syntax error: cache the failure so we don't recompile/respam.
        compiled = null;
    }

    compileCache.set(source, compiled);
    return compiled;
}

function isThenable(value: unknown): boolean {
    return (
        (typeof value === "object" || typeof value === "function") &&
        value !== null &&
        typeof (value as { then?: unknown }).then === "function"
    );
}

function getValueAtPath(source: unknown, path: string | undefined): unknown {
    if (!path) {
        return undefined;
    }

    return path.split(".").reduce<unknown>((currentValue, segment) => {
        if (typeof currentValue !== "object" || currentValue === null || Array.isArray(currentValue)) {
            return undefined;
        }

        return (currentValue as Record<string, unknown>)[segment];
    }, source);
}

function makeError(source: string, message: string): ReactiveError {
    return { source, message, key: `${source}\u0000${message}` };
}

/**
 * Evaluate a `reactive` expression against the given sources. Never throws:
 * any compile/eval failure (including a thenable return) is returned as
 * `{ value: undefined, error }` for the caller to contain.
 */
export function evaluateReactiveExpression(source: string, sources: ReactiveSources): ReactiveEvalResult {
    const compiled = compile(source);

    if (!compiled) {
        return {
            value: undefined,
            error: makeError(source, "reactive expression failed to compile (syntax error)")
        };
    }

    const storeFn = (name: unknown): unknown => {
        const storeName = typeof name === "string" ? name.trim() : String(name).trim();
        // The map is built with duplicate names marked as a sentinel so the same
        // name resolving to two stores is an explicit ambiguity error, not a
        // silent last-wins.
        if (!(storeName in sources.storeNamePaths)) {
            throw new Error(`Unknown store "${storeName}"`);
        }

        const statePath = sources.storeNamePaths[storeName];

        if (statePath === AMBIGUOUS_STORE) {
            throw new Error(`Ambiguous store name "${storeName}"`);
        }

        return getValueAtPath(sources.state, statePath);
    };

    const queryFn = (path: unknown): unknown => getValueAtPath(sources.queries, typeof path === "string" ? path : String(path));

    // P196 (ADR 0023): `scope(name)` returns the item of the enclosing named
    // repeat. Unlike `store(...)`, an unknown/non-enclosing name is NOT an error —
    // it returns `undefined` (symmetric with addressing item/index outside a
    // repeat). A non-string name coerces to its string form before lookup.
    const scopeFn = (name: unknown): unknown => {
        const scopeName = typeof name === "string" ? name.trim() : String(name).trim();
        const items = sources.scopeItems;
        if (!items || !(scopeName in items)) {
            return undefined;
        }
        return items[scopeName];
    };

    let result: unknown;

    try {
        result = compiled(sources.params, storeFn, queryFn, sources.item, sources.index, sources.prop, scopeFn, sources.user);
    } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught);
        return { value: undefined, error: makeError(source, message) };
    }

    if (isThenable(result)) {
        return {
            value: undefined,
            error: makeError(source, "reactive expression must be synchronous")
        };
    }

    return { value: result };
}

/**
 * Sentinel statePath marking a store NAME that is ambiguous within its app
 * (two stores share the name). Resolving it throws an "Ambiguous store name"
 * error caught by the containment layer.
 */
export const AMBIGUOUS_STORE = "\u0000ambiguous";

/**
 * Build the store NAME → statePath map from the integration's stores. Names are
 * trimmed. A name that appears on more than one store is marked
 * {@link AMBIGUOUS_STORE} rather than silently last-wins.
 *
 * Per spec (ADR 0010 / P115): an EMPTY name (`""`, e.g. an unnamed store the
 * editor labels "Store N") is a valid name and is mapped — it is not special-
 * cased. Only a store with NO `name` field at all (undefined) is skipped, since
 * it carries no authoring name to resolve `store("…")` against.
 */
export function buildStoreNamePaths(stores: Array<{ name?: string; statePath: string }>): Record<string, string> {
    const map: Record<string, string> = {};

    for (const store of stores) {
        if (typeof store.name !== "string") {
            continue;
        }

        const name = store.name.trim();

        if (name in map) {
            map[name] = AMBIGUOUS_STORE;
            continue;
        }

        map[name] = store.statePath;
    }

    return map;
}

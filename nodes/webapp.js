"use strict";

const fs = require("fs");
const path = require("path");
const {
    appModelSchema,
    collectMissingStandardLayouts,
    createAppRootRoute,
    normalizeSelectOptions,
    storeOperationSchema,
    uiEventMessageSchema,
    validateUiNodeDefinition,
    // P224 (ADR 0037): the dynamic-state field class + neutral values + the
    // bound-kind set drive the one-value model (bound source vs internal
    // per-client slot) and the unified setDynamicStateField write API.
    DYNAMIC_STATE_FIELDS,
    DYNAMIC_STATE_FIELD_NEUTRAL,
    DYNAMIC_STATE_BOUND_KINDS
} = require("../packages/schema/dist/index.js");
const { createRendererApp, mapComponentToShoelace, buildShoelaceTokenBridgeCss } = require("../packages/renderer/dist/index.js");
const { buildDesignTokenCss } = require("../packages/schema/dist/index.js");
// P26: the snapshot → Shoelace markup serializer is shared with the thin client
// (resources/lib/webapp-serializer.js) so server and browser cannot drift apart.
const sharedSerializer = require("../resources/lib/webapp-serializer.js");
// P69: icon library registry + manifest (backend-neutral { library, name }).
const iconLibrary = require("./icon-library.js");

// P22: the thin client runtime is served statically from resources/. Node-RED
// exposes a plugin's resources/ dir under resources/<module-name>/.
const CLIENT_RUNTIME_PATH = "/resources/node-red-contrib-webapp/lib/webapp-client.js";
// P26: shared snapshot serializer, served statically and consumed by the thin
// client (window.WebappSerializer) so the browser emits the same markup as the
// server. Loaded before the client runtime.
const CLIENT_SERIALIZER_PATH = "/resources/node-red-contrib-webapp/lib/webapp-serializer.js";

// Cache-busting: the static resource handler serves these with only a weak ETag
// (no Cache-Control), so a browser can keep an OLD client after a runtime update
// until a hard-refresh. We append a CONTENT-hash query (`?v=<hash>`) computed once
// at load; when a file's bytes change the URL changes → a normal reload re-fetches,
// while an unchanged file keeps its URL (stays cached). Query strings are ignored
// by the static file server, so the same file is served either way.
const crypto = require("crypto");
function assetContentVersion(relFromModule) {
    try {
        const buf = fs.readFileSync(path.join(__dirname, relFromModule));
        return crypto.createHash("sha1").update(buf).digest("hex").slice(0, 12);
    }
    catch (_e) {
        return "0";
    }
}
const CLIENT_RUNTIME_SRC = CLIENT_RUNTIME_PATH + "?v=" + assetContentVersion("../resources/lib/webapp-client.js");
const CLIENT_SERIALIZER_SRC = CLIENT_SERIALIZER_PATH + "?v=" + assetContentVersion("../resources/lib/webapp-serializer.js");

// P106: snapshot/transport contract version. Baked into the shell signature so a
// client whose code-contract predates a server upgrade falls back to a full
// reload rather than an in-place apply that its serializer may not understand.
// Bump this only when the snapshot shape or serializer markup changes (a package
// upgrade), never for an ordinary flow deploy.
const SNAPSHOT_SERIALIZER_VERSION = "1";

// P23: the default rendering target is Web Components (Shoelace, MIT) — see
// ADR 0002. Shoelace is loaded as an ES module / static resource (no bundler);
// the autoloader registers each custom element on first use. Components are
// themed natively through CSS custom properties, so the design tokens plug in
// without per-token translation.
//
// P63 / ADR 0008: Shoelace is self-hosted (vendored), strictly local — NO CDN.
// scripts/vendor-shoelace.js copies the package's `cdn` build into
// resources/shoelace/, which Node-RED serves via the module-resource mechanism
// (same path webapp-client.js rides on — no new HTTP route). SHOELACE_VERSION
// pins the @shoelace-style/shoelace devDependency and drives the vendor copy;
// the vendor script asserts the installed version matches it (drift guard).
// The autoloader auto-detects its own base path from its script URL, so lazy
// component chunks and sl-icon assets resolve under the same local path — no
// setBasePath() call needed.
const SHOELACE_VERSION = "2.20.1";
const SHOELACE_LOCAL_BASE = "/resources/node-red-contrib-webapp/shoelace";
const SHOELACE_THEME_HREF = `${SHOELACE_LOCAL_BASE}/themes/light.css`;
const SHOELACE_AUTOLOADER_SRC = `${SHOELACE_LOCAL_BASE}/shoelace-autoloader.js`;
// P69: on-disk path of the vendored default (Bootstrap-Icons) SVG set, used to
// enumerate icon names for the picker manifest. The matching URL base is
// `${SHOELACE_LOCAL_BASE}/assets/icons`.
const SHOELACE_ICONS_DIR = path.join(__dirname, "..", "resources", "shoelace", "assets", "icons");

const runtimeState = {
    definitions: new Map(),
    queryEtags: new Map(),
    // P161: per-query debounce timers (keyed by query node id) for the
    // params-observed out-port refresh, so search-as-you-type coalesces.
    queryDebounceTimers: new Map(),
    // liveState: appId → merged store state for broadcast (no clientId) updates.
    // Per-client state (clientStateMap) takes precedence when a clientId is present.
    liveState: new Map(),
    // clientStateMap: appId → Map<clientId, { state, timestamp }>
    clientStateMap: new Map(),
    // P31: live Server→Client SSE subscribers.
    // streamClients: appId → Map<clientId, { res, location }>
    // Each connected EventSource registers here; flow-driven store/action updates
    // are pushed to the targeted client (msg.ui.clientId) or broadcast to all.
    streamClients: new Map(),
    // P112: per-client arrival tracking for the connect-based route lifecycle.
    // clientArrival: appId → Map<clientId, { loadId, location, leaveTimer }>
    // A fresh page load carries a new loadId; the connect handler compares it to
    // the previous one to tell a real arrival (→ onEnter/onLeave) from a transient
    // EventSource reconnect (same loadId → no event). leaveTimer holds a pending,
    // grace-debounced onLeave when a client disconnects.
    clientArrival: new Map(),
    endpointsRegistered: false,
    // P106: guard so the flows:started deploy hook is wired exactly once across
    // all node-type registrations (each node calls registerNodeType, which calls
    // registerEndpoints; the hook must not stack one listener per node type).
    deployHookRegistered: false,
    // Reactive-expression error dedup, keyed per appId. webapp.js builds a fresh
    // renderer app per snapshot (page render, /snapshot pull, SSE push, …), so the
    // renderer's per-instance dedup resets each build and a broken expression
    // would be reported on every build. This app-scoped set dedups ACROSS builds;
    // it is cleared on deploy so a fixed expression is no longer suppressed and a
    // newly-broken one reports again. appId → Set<errorKey>.
    reactiveErrorKeys: new Map()
};

const WEBAPP_NODE_TYPES = new Set([
    "ui-app",
    "ui-route",
    "ui-dialog",
    "ui-text",
    "ui-button",
    "ui-table",
    "ui-container",
    "ui-input",
    "ui-select",
    "ui-checkbox",
    "ui-radio",
    "ui-switch",
    "ui-textarea",
    "ui-datepicker",
    "ui-slider",
    "ui-store",
    "ui-query",
    // P209 (ADR 0028): reference-based, on-demand, non-mutating store reader.
    "ui-store-read",
    // P211 (ADR 0029): reference-based, typed store MUTATION (hybrid wire|reference).
    "ui-store-action",
    // P212 (ADR 0029): reference-based, typed query TRIGGER (hybrid wire|reference).
    "ui-query-action",
    "ui-action",
    "ui-alert",
    "ui-toast",
    "ui-progress",
    "ui-skeleton",
    "ui-badge",
    "ui-empty-state",
    "ui-tabs",
    // P168 (ADR 0018, Model 1a): ui-tab — thin container child of ui-tabs.
    "ui-tab",
    "ui-accordion",
    // P169 (ADR 0018, Model 1a): ui-accordion-section — thin container child of ui-accordion.
    "ui-accordion-section",
    "ui-breadcrumb",
    "ui-menu",
    "ui-pagination",
    "ui-stepper",
    "ui-image",
    "ui-icon",
    "ui-list",
    "ui-avatar",
    "ui-divider",
    "ui-log",
    "ui-repeat",
    // P179 (ADR 0020): the component node pair. The DEFINITION is an off-canvas
    // template container (children mount via `def:<id>/content`); the INSTANCE is a
    // leaf that EXPANDS that subtree at its own outer mount with a `propScope` frame.
    "ui-component-definition",
    "ui-component-instance"
]);

function parseList(value) {
    if (Array.isArray(value)) {
        return value.filter(Boolean).map((entry) => String(entry).trim()).filter(Boolean);
    }

    if (typeof value !== "string") {
        return [];
    }

    return value
        .split(/\r?\n|,/)
        .map((entry) => entry.trim())
        .filter(Boolean);
}

function parseJsonList(value) {
    if (Array.isArray(value)) {
        return value;
    }

    if (typeof value !== "string" || value.trim().length === 0) {
        return [];
    }

    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch (_e) {
        return parseList(value);
    }
}

// P60 / ADR 0007 §3: the ui-action node picker stores a LIST of target node ids.
// The value arrives as a JSON-string array (editor field) or an array (fixture /
// gen-example). Returns a de-duplicated array of non-empty strings, or undefined
// when empty (keeps the definition clean).
function parseTargetIds(value) {
    const list = parseJsonList(value)
        .filter((id) => typeof id === "string" && id.trim().length > 0);
    const deduped = list.filter((id, index) => list.indexOf(id) === index);
    return deduped.length > 0 ? deduped : undefined;
}

// P66 (ADR 0007): a navigate action's named URL params. Arrives as an object
// (typed fixture / gen-example) or a JSON-object string (editor key/value rows).
// Returns a string→string record (non-string values are coerced to String so a
// param taken from a number still fills its URL segment), or undefined when empty.
function parseParamsObject(value) {
    let raw;
    if (value && typeof value === "object" && !Array.isArray(value)) {
        raw = value;
    }
    else if (typeof value === "string" && value.trim().length > 0) {
        try {
            const parsed = JSON.parse(value);
            raw = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : undefined;
        }
        catch (_e) {
            raw = undefined;
        }
    }
    if (!raw) {
        return undefined;
    }
    const out = {};
    for (const key of Object.keys(raw)) {
        const v = raw[key];
        if (v !== undefined && v !== null) {
            out[key] = String(v);
        }
    }
    return Object.keys(out).length > 0 ? out : undefined;
}

// P118 (ADR 0011 §1): the typed navigate param value-types.
const ACTION_PARAM_VALUE_TYPES = new Set(["str", "msg", "jsonata", "flow", "global", "env"]);

// P118 (ADR 0011 §1 + Migration): normalise a ui-action `params` config into the
// canonical LIST of typed entries `[{ name, value, valueType }]`.
//   • Already a list (new editor / typed fixture) → validated + passed through.
//   • Legacy object `{k: "v"}` (P66) or a JSON-object string → migrated to a list
//     of `str`-typed rows (lossless: literal key/value becomes name/value/str).
// Returns undefined when empty (keeps the definition clean).
function parseActionParamList(value) {
    let list;
    if (Array.isArray(value)) {
        list = value;
    }
    else if (typeof value === "string" && value.trim().startsWith("[")) {
        try {
            const parsed = JSON.parse(value);
            list = Array.isArray(parsed) ? parsed : undefined;
        }
        catch (_e) {
            list = undefined;
        }
    }
    if (list) {
        const out = [];
        for (const entry of list) {
            if (!entry || typeof entry !== "object") {
                continue;
            }
            const name = typeof entry.name === "string" ? entry.name.trim() : "";
            if (!name) {
                continue;
            }
            const valueType = ACTION_PARAM_VALUE_TYPES.has(entry.valueType) ? entry.valueType : "str";
            const v = entry.value === undefined || entry.value === null ? "" : String(entry.value);
            out.push({ name, value: v, valueType });
        }
        return out.length > 0 ? out : undefined;
    }
    // Legacy object form → migrate to str-typed rows.
    const obj = parseParamsObject(value);
    if (!obj) {
        return undefined;
    }
    const migrated = Object.keys(obj).map((name) => ({ name, value: obj[name], valueType: "str" }));
    return migrated.length > 0 ? migrated : undefined;
}

// P118 (ADR 0011 §1 + Migration): derive the navigate target-source MODE for a
// ui-action config. An explicit stored `targetMode` (wire | route | url) wins.
// Legacy configs without one are migrated: a `routeId` → "route"; a `to` →
// "url"; otherwise → "wire" (the wired route supplies the path). Returns
// undefined for non-navigate actions (the mode is navigate-only).
function deriveNavigateTargetMode(config) {
    if (blankToUndefined(config.actionType) !== "navigate") {
        return undefined;
    }
    const stored = blankToUndefined(config.targetMode);
    if (stored === "wire" || stored === "route" || stored === "url") {
        return stored;
    }
    if (blankToUndefined(config.routeId)) {
        return "route";
    }
    if (blankToUndefined(config.to)) {
        return "url";
    }
    return "wire";
}

// P23: design tokens may arrive as an object (typed fixture / gen-example) or a
// JSON string (editor field). Returns a plain object or undefined.
function parseTokens(value) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
        return value;
    }

    if (typeof value !== "string" || value.trim().length === 0) {
        return undefined;
    }

    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : undefined;
    }
    catch (_e) {
        return undefined;
    }
}

function parseColumns(value) {
    // Prefer parseJsonList for JSON array strings; fall back to parseList for
    // newline/comma-separated plain-text column names.
    const raw = Array.isArray(value) ? value : (parseJsonList(value).length > 0 ? parseJsonList(value) : parseList(value));
    return raw.map((entry) => {
        if (typeof entry === "string") {
            return { key: entry, label: entry };
        }
        if (entry && typeof entry === "object" && entry.key) {
            return {
                key: String(entry.key),
                label: entry.label !== undefined ? String(entry.label) : String(entry.key),
                type: entry.type || undefined,
                sortable: entry.sortable !== undefined ? Boolean(entry.sortable) : undefined,
                filterable: entry.filterable !== undefined ? Boolean(entry.filterable) : undefined,
                width: entry.width !== undefined ? Number(entry.width) : undefined
            };
        }
        return null;
    }).filter(Boolean);
}

// P249: `rowSelect` is the only ui-table event with an observable end-to-end
// effect. The former `rowAction`/`checkboxChange`/`cellSelect` values had no DOM
// source and were removed from the schema; filter them out of legacy flow configs
// so an old flow that still carries them keeps deploying (it just loses the inert
// events) instead of failing schema validation.
const SUPPORTED_TABLE_EVENTS = new Set(["rowSelect"]);

function filterSupportedTableEvents(list) {
    return (Array.isArray(list) ? list : []).filter((event) => SUPPORTED_TABLE_EVENTS.has(event));
}

// P251: `complete` was a dead ui-stepper event — no DOM source emits it (the step
// buttons only dispatch `change` with params.value). It was removed from the schema
// enum; filter it out of legacy flow configs so an old flow that still carries
// `complete` keeps deploying (it just loses the inert event). `stepChange` is the
// documented event name; `change` is the actual DOM-dispatched event that real flows
// wire — both are kept so existing flows/E2E remain green.
const SUPPORTED_STEPPER_EVENTS = new Set(["stepChange", "change"]);

function filterSupportedStepperEvents(list) {
    return (Array.isArray(list) ? list : []).filter((event) => SUPPORTED_STEPPER_EVENTS.has(event));
}

function parseJson(value) {
    if (value === undefined || value === null || value === "") {
        return undefined;
    }

    if (typeof value !== "string") {
        return value;
    }

    try {
        return JSON.parse(value);
    }
    catch {
        return value;
    }
}

function literalBinding(value) {
    return {
        kind: "literal",
        value
    };
}

function stateBinding(path) {
    return {
        kind: "state",
        path
    };
}

// ---------------------------------------------------------------------------
// P224 (ADR 0037): dynamic-state fields — ONE resolved value per component.
// ---------------------------------------------------------------------------
// A dynamic-state field (`visible`/`disabled`, see DYNAMIC_STATE_FIELDS) has a
// single source rule: BOUND (state/store/query/routeParam/reactive) → the bound
// source is the truth; UNBOUND (literal/none/msg/…) → the node holds the value
// in an INTERNAL per-client slot. The slot lives at a reserved path in the SAME
// per-client state tree as ui-store (P201), keyed by component id + field, so the
// renderer reads it through an ordinary `state` binding (with the configured
// literal, or the field's neutral value, as the fallback when the slot is empty).
//
// Slot lifecycle (eviction/TTL) is intentionally left minimal here — a slot is a
// key in the per-client state map and shares that map's lifecycle; the per-client
// scale concern is tracked as tech-debt [P210].
const DYNAMIC_STATE_STATE_ROOT = "__dynamicState";

// P226 (ADR 0037): the interactive-control component kinds that own the
// enable/disable verbs. These get a `disabled` per-client slot binding even when
// the editor configured no `disabled` binding, so the imperative enable/disable
// verbs (and a future declarative disabled) can drive their ONE `disabled` value.
// The neutral slot value is `false` (enabled) → the serialized markup is unchanged
// until a writer sets it, so non-disabled controls render exactly as before.
const DYNAMIC_STATE_DISABLED_KINDS = new Set([
    "button", "input", "select", "textarea", "checkbox", "radio", "switch", "slider", "datepicker"
]);

function isDynamicStateFieldName(field) {
    return DYNAMIC_STATE_FIELDS.indexOf(field) !== -1;
}

// The reserved per-client state path holding a node's unbound dynamic-state slot
// for one field, e.g. `__dynamicState.<nodeId>.visible`.
function dynamicStateSlotPath(nodeId, field) {
    return `${DYNAMIC_STATE_STATE_ROOT}.${nodeId}.${field}`;
}

// A binding is BOUND (reactive from its source) when its kind is in the
// dynamic-state bound set; everything else (literal / msg / jsonata / flow /
// global / env) — and an absent binding — is UNBOUND for the WRITE rule
// (setDynamicStateField).
function isBoundDynamicStateBinding(binding) {
    return Boolean(binding && typeof binding === "object"
        && DYNAMIC_STATE_BOUND_KINDS.indexOf(binding.kind) !== -1);
}

// A dynamic-state field is SLOT-BACKED at RENDER time only when it is a plain
// literal or absent ("unbound" per ADR 0037: literal/none). The message-driven
// (`msg`/`jsonata`) and server-resolved (`flow`/`global`/`env`) kinds keep their
// existing render semantics — they are handled by their own writer slices (msg →
// P223) and must NOT default to the neutral slot value (a `msg`-bound `visible`
// renders EMPTY/hidden until a message arrives — see the P223 ui-alert E2E).
function isSlotBackedDynamicStateBinding(binding) {
    return binding === undefined || binding === null
        || (typeof binding === "object" && binding.kind === "literal");
}

// Coerce any stored value to the boolean a dynamic-state field represents.
// Accepts real booleans and the "true"/"false" strings (editor typedInput / an
// inject node's string payload); otherwise JS truthiness. Mirrors P223's
// coerceViewBoolean (kept separate so the schema-facing helper has no P223 dep).
function coerceDynamicStateBoolean(value) {
    if (value === true) { return true; }
    if (value === false) { return false; }
    if (typeof value === "string") {
        const trimmed = value.trim().toLowerCase();
        if (trimmed === "true") { return true; }
        if (trimmed === "false") { return false; }
    }
    return Boolean(value);
}

// Build the render binding for an UNBOUND dynamic-state field: a `state` binding
// pointing at the reserved per-client slot, whose `fallback` is the configured
// literal (when one was set) or the field's neutral value. The renderer then
// reads exactly ONE value — the per-client slot when a writer set it, else the
// fallback — so back-compat (no writer) is byte-equivalent to today.
function unboundDynamicStateBinding(nodeId, field, configuredBinding) {
    const neutral = DYNAMIC_STATE_FIELD_NEUTRAL[field];
    const fallback = configuredBinding && configuredBinding.kind === "literal"
        ? coerceDynamicStateBoolean(configuredBinding.value)
        : neutral;
    return { kind: "state", path: dynamicStateSlotPath(nodeId, field), fallback };
}

// Rewrite a compiled ComponentDefinition so every UNBOUND dynamic-state field
// reads from its internal per-client slot. Bound fields (a live source) are left
// untouched — they stay reactive from that source. `visible` lives on
// `visibleIf`; `disabled` lives on `bind.disabled`.
//
//   - `visible`: always normalised (absent → a slot binding with neutral `true`),
//     so ANY view component's visibility is settable per-client via the write API.
//   - `disabled`: normalised only when a `bind.disabled` binding is already
//     present (a node that opted into a disabled binding). An absent disabled is
//     left absent (neutral not-disabled) to keep the serialized markup unchanged
//     for the many nodes that never carry one; the imperative enable/disable
//     verbs (P226) address those later.
function applyDynamicStateSlots(componentDefinition) {
    if (!componentDefinition || typeof componentDefinition !== "object" || !componentDefinition.id) {
        return componentDefinition;
    }
    const nodeId = componentDefinition.id;

    // visible → visibleIf. Only a literal / absent (truly unbound) field is
    // routed to the slot; bound and msg/jsonata/server-resolved bindings keep
    // their own semantics.
    const visibleIf = componentDefinition.visibleIf;
    if (isSlotBackedDynamicStateBinding(visibleIf)) {
        componentDefinition.visibleIf = unboundDynamicStateBinding(nodeId, "visible", visibleIf);
    }

    // disabled → bind.disabled.
    //   - A node that ALREADY carries a `disabled` binding: a literal/absent one is
    //     routed to the slot; a bound one stays reactive from its source.
    //   - P226 (ADR 0037): an interactive control (DYNAMIC_STATE_DISABLED_KINDS)
    //     with NO disabled binding also gets a neutral (false) slot binding, so the
    //     enable/disable verbs write its ONE `disabled` value. Neutral false keeps
    //     the serialized markup unchanged until a writer flips it.
    const bind = componentDefinition.bind && typeof componentDefinition.bind === "object"
        ? componentDefinition.bind
        : undefined;
    if (bind && bind.disabled !== undefined) {
        if (isSlotBackedDynamicStateBinding(bind.disabled)) {
            bind.disabled = unboundDynamicStateBinding(nodeId, "disabled", bind.disabled);
        }
    }
    else if (DYNAMIC_STATE_DISABLED_KINDS.has(componentDefinition.kind)) {
        if (!componentDefinition.bind || typeof componentDefinition.bind !== "object") {
            componentDefinition.bind = {};
        }
        componentDefinition.bind.disabled = unboundDynamicStateBinding(nodeId, "disabled", undefined);
    }

    return componentDefinition;
}

// P203 (ADR 0027): migrate a legacy ui-input write-target pair (storeId + path)
// into the new `writeTo` store binding. Returns undefined when no storeId is set.
function legacyStoreWriteTo(storeId, path) {
    const id = typeof storeId === "string" ? storeId.trim() : "";
    if (!id) {
        return undefined;
    }
    const rel = typeof path === "string" ? path.trim() : "";
    return {
        kind: "store",
        path: id,
        ...(rel ? { subPath: { kind: "literal", value: rel } } : {})
    };
}

function queryBinding(path) {
    return {
        kind: "query",
        path
    };
}

function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeDeep(base, override) {
    if (!isPlainObject(base) || !isPlainObject(override)) {
        return override === undefined ? base : override;
    }

    const result = { ...base };

    Object.entries(override).forEach(([key, value]) => {
        result[key] = key in base ? mergeDeep(base[key], value) : clone(value);
    });

    return result;
}

function toOptionalNumber(value) {
    return value === "" || value === undefined || value === null ? undefined : Number(value);
}

// P207: a node with an empty `order` field falls back to its raw Node-RED
// canvas y-position, so the visual arrangement on the canvas becomes the
// rendered order in the slot. Explicit `order` always wins. `config.y` is the
// raw canvas y (NOT `layoutY`, which is the absolute-layout field and stays
// separate/untouched).
function resolveOrder(config) {
    const o = toOptionalNumber(config.order);
    return o !== undefined ? o : toOptionalNumber(config.y);
}

function collectNodeConfigLayoutProps(source) {
    const row = toOptionalNumber(source.row);
    const col = toOptionalNumber(source.col);
    const colSize = toOptionalNumber(source.colSize !== undefined ? source.colSize : source.col_size);
    const rowSize = toOptionalNumber(source.rowSize !== undefined ? source.rowSize : source.row_size);
    const x = toOptionalNumber(source.layoutX !== undefined ? source.layoutX : source.layout_x);
    const y = toOptionalNumber(source.layoutY !== undefined ? source.layoutY : source.layout_y);

    return {
        ...(row !== undefined ? { row } : {}),
        ...(col !== undefined ? { col } : {}),
        ...(colSize !== undefined ? { colSize } : {}),
        ...(rowSize !== undefined ? { rowSize } : {}),
        ...(x !== undefined ? { x } : {}),
        ...(y !== undefined ? { y } : {})
    };
}

function collectNormalizedLayoutProps(source) {
    const row = toOptionalNumber(source.row);
    const col = toOptionalNumber(source.col);
    const colSize = toOptionalNumber(source.colSize);
    const rowSize = toOptionalNumber(source.rowSize);
    const x = toOptionalNumber(source.x);
    const y = toOptionalNumber(source.y);

    return {
        ...(row !== undefined ? { row } : {}),
        ...(col !== undefined ? { col } : {}),
        ...(colSize !== undefined ? { colSize } : {}),
        ...(rowSize !== undefined ? { rowSize } : {}),
        ...(x !== undefined ? { x } : {}),
        ...(y !== undefined ? { y } : {})
    };
}

// P52 / ADR 0004: grid placement props that must stay positive integers (>= 1)
// at RUNTIME, not just at deploy time (P51 enforced the schema side). layoutX /
// layoutY are intentionally excluded — 0 is the legitimate absolute-layout origin.
const PLACEMENT_INTEGER_FIELDS = ["row", "col", "colSize", "rowSize"];

function isPositiveInteger(value) {
    return typeof value === "number" && Number.isInteger(value) && value > 0;
}

// Sanitize a runtime patch's grid placement props. Any of row/col/colSize/rowSize
// present in the patch must resolve to a positive integer; an invalid one is
// dropped from the patch (other keys still apply) and a clear error is raised on
// the node. Returns the cleaned patch (a fresh object; the input is not mutated).
function sanitizePlacementPatch(patch, node) {
    if (!isPlainObject(patch)) {
        return patch;
    }

    const cleaned = { ...patch };
    PLACEMENT_INTEGER_FIELDS.forEach((field) => {
        if (!(field in cleaned)) {
            return;
        }

        const raw = cleaned[field];
        const numeric = typeof raw === "string" ? toOptionalNumber(raw) : raw;
        if (isPositiveInteger(numeric)) {
            cleaned[field] = numeric;
            return;
        }

        delete cleaned[field];
        reportRuntimeError(node, {
            severity: "error",
            code: "client.placement.invalid",
            message: `Grid placement '${field}' must be a positive integer (>= 1); got ${JSON.stringify(raw)} — update ignored.`,
            context: { appId: findAppIdForNode(node), nodeId: node && node.id, op: "viewNodePatchInputHandler" }
        });
    });

    return cleaned;
}

function blankToUndefined(value) {
    if (value === undefined || value === null) {
        return undefined;
    }

    return typeof value === "string" && value.trim() === "" ? undefined : value;
}

function getValueAtPath(source, path) {
    if (!path) {
        return undefined;
    }

    return String(path).split(".").reduce((currentValue, segment) => {
        if (typeof currentValue !== "object" || currentValue === null || Array.isArray(currentValue)) {
            return undefined;
        }

        return currentValue[segment];
    }, source);
}

function setValueAtPath(source, path, value) {
    const segments = String(path).split(".").filter(Boolean);

    if (segments.length === 0) {
        return source;
    }

    const cloneRoot = { ...source };
    let currentTarget = cloneRoot;

    segments.forEach((segment, index) => {
        if (index === segments.length - 1) {
            currentTarget[segment] = value;
            return;
        }

        const nextTarget = currentTarget[segment] && typeof currentTarget[segment] === "object" && !Array.isArray(currentTarget[segment])
            ? currentTarget[segment]
            : {};
        currentTarget[segment] = { ...nextTarget };
        currentTarget = currentTarget[segment];
    });

    return cloneRoot;
}

function deleteValueAtPath(source, path) {
    const segments = String(path).split(".").filter(Boolean);

    if (segments.length === 0) {
        return source;
    }

    const cloneRoot = { ...source };
    let currentTarget = cloneRoot;

    for (let index = 0; index < segments.length - 1; index += 1) {
        const segment = segments[index];

        if (typeof currentTarget[segment] !== "object" || currentTarget[segment] === null || Array.isArray(currentTarget[segment])) {
            return cloneRoot;
        }

        currentTarget[segment] = { ...currentTarget[segment] };
        currentTarget = currentTarget[segment];
    }

    delete currentTarget[segments[segments.length - 1]];

    return cloneRoot;
}

function joinStatePath(rootPath, relativePath) {
    const normalizedRoot = blankToUndefined(rootPath);
    const normalizedRelative = blankToUndefined(relativePath);

    if (!normalizedRoot) {
        return normalizedRelative || "";
    }

    if (!normalizedRelative) {
        return normalizedRoot;
    }

    return `${normalizedRoot}.${normalizedRelative}`;
}

// P218 (ADR 0033): after a node SUCCESSFULLY consumes a `msg.ui.<command>`
// envelope, strip exactly that sub-key so the spent command cannot be
// double-processed by a downstream consumer. Returns a shallow COPY — the
// caller's `msg` is never mutated (the P175/P214 pass-through contracts rely on
// byte-identity for messages we DON'T touch, so only touched messages are cloned).
// Context keys are preserved: `msg.ui.clientId` and an outgoing `msg.ui.event`
// stay. The whole `msg.ui` is NEVER deleted; an emptied `msg.ui` is left as `{}`
// (documented choice — see docs/nodes/concepts/events.md).
function stripConsumedUiEnvelope(msg, key) {
    if (!msg || typeof msg !== "object" || !msg.ui || typeof msg.ui !== "object") {
        return msg;
    }
    if (!Object.prototype.hasOwnProperty.call(msg.ui, key)) {
        return msg;
    }
    const nextUi = { ...msg.ui };
    delete nextUi[key];
    return { ...msg, ui: nextUi };
}

function normalizeStoreOperationMessage(msg, storeDefinition) {
    const candidate = msg && msg.ui && msg.ui.store && typeof msg.ui.store === "object"
        ? msg.ui.store
        : undefined;

    if (!candidate || candidate.id !== storeDefinition.id || typeof candidate.op !== "string") {
        return undefined;
    }

    // P218 (ADR 0033): a store envelope that carries an `event` field is a spent
    // NOTIFICATION (`changed` / `read`) that a consuming node already emitted — NOT
    // a fresh command. Refuse to re-apply it, so a chain of ui-store consumers
    // applies a command EXACTLY ONCE (the notification passes through untouched).
    if (typeof candidate.event === "string" && candidate.event) {
        return undefined;
    }

    return {
        id: candidate.id,
        op: candidate.op,
        path: blankToUndefined(candidate.path),
        value: candidate.value
    };
}

function applyStoreOperation(currentState, storeDefinition, operation) {
    const storeRootPath = storeDefinition.statePath;
    const fullPath = joinStatePath(storeRootPath, operation.path);
    const previousValue = clone(getValueAtPath(currentState, fullPath || storeRootPath));
    let nextState = currentState;
    let nextValue;

    if (operation.op === "reset") {
        nextState = setValueAtPath(currentState, storeRootPath, clone(storeDefinition.initialValue));
        nextValue = clone(storeDefinition.initialValue);
    }
    else if (operation.op === "replace") {
        nextState = setValueAtPath(currentState, storeRootPath, clone(operation.value));
        nextValue = clone(operation.value);
    }
    else if (operation.op === "set") {
        nextState = setValueAtPath(currentState, fullPath, clone(operation.value));
        nextValue = clone(operation.value);
    }
    else if (operation.op === "patch") {
        const currentValue = getValueAtPath(currentState, fullPath);
        nextValue = mergeDeep(isPlainObject(currentValue) ? currentValue : {}, operation.value);
        nextState = setValueAtPath(currentState, fullPath, nextValue);
    }
    else if (operation.op === "delete") {
        nextState = deleteValueAtPath(currentState, fullPath);
        nextValue = undefined;
    }
    else {
        throw new Error(`Unknown store operation '${operation.op}'.`);
    }

    return {
        nextState,
        notification: {
            ui: {
                store: {
                    id: storeDefinition.id,
                    event: "changed",
                    op: operation.op,
                    path: operation.path,
                    fullPath: fullPath || storeRootPath,
                    value: nextValue,
                    previousValue,
                    origin: "node-red"
                }
            }
        }
    };
}

// ---------------------------------------------------------------------------
// P15: clientId routing and reconnect sync helpers
// ---------------------------------------------------------------------------

/**
 * Returns the per-client state for a given appId and clientId.
 * Creates the client sub-map lazily if needed.
 */
function getClientState(appId, clientId) {
    let appClients = runtimeState.clientStateMap.get(appId);
    if (!appClients) {
        appClients = new Map();
        runtimeState.clientStateMap.set(appId, appClients);
    }
    return appClients.get(clientId) || null;
}

/**
 * Sets the per-client state for a given appId and clientId.
 */
function setClientState(appId, clientId, state, timestamp) {
    let appClients = runtimeState.clientStateMap.get(appId);
    if (!appClients) {
        appClients = new Map();
        runtimeState.clientStateMap.set(appId, appClients);
    }
    appClients.set(clientId, { state: clone(state), timestamp });
}

/**
 * Resolves which state wins after a reconnect.
 * Returns { winner: "server"|"client", state, timestamp }.
 *
 * Rules:
 *   - If client timestamp is newer than server timestamp → client wins.
 *   - Otherwise (server newer or equal, or missing timestamp) → server wins.
 */
function resolveReconnectState(serverEntry, clientSnapshot) {
    if (!serverEntry) {
        // No server state recorded yet — accept client state.
        return { winner: "client", state: clientSnapshot.state, timestamp: clientSnapshot.timestamp };
    }
    if (clientSnapshot.timestamp > serverEntry.timestamp) {
        return { winner: "client", state: clientSnapshot.state, timestamp: clientSnapshot.timestamp };
    }
    return { winner: "server", state: serverEntry.state, timestamp: serverEntry.timestamp };
}

function escapeHtml(input) {
    return String(input)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function escapeAttribute(input) {
    return escapeHtml(input);
}

function escapeJson(input) {
    return JSON.stringify(input).replace(/</g, "\\u003c");
}

function getBinding(bindingCandidate, fallbackBinding) {
    if (bindingCandidate && typeof bindingCandidate === "object" && typeof bindingCandidate.kind === "string") {
        return bindingCandidate;
    }

    return fallbackBinding;
}

// P238 (ADR 0039 §4) — BACK-COMPAT for a base-field `color`.
//
// Until P238 ui-icon overrode the base `color` with a plain `z.string()`, so
// DEPLOYED ui-icon nodes carry a bare string (`"#ff0000"`, `"red"`). The override
// is gone and the base schema is `bindingSchema.optional()` — a bare string would
// now FAIL validation and the node would drop out of the app. This normalises a
// legacy plain string into the equivalent `{kind:"literal"}` binding BEFORE the
// schema sees it, so a deployed flow keeps rendering EXACTLY the same colour
// without being re-opened (the editor performs the same migration on open; this is
// the runtime half). Mirrors P146/P149/P151.
//
// A binding object passes through untouched; empty/absent → undefined (no colour).
function normalizeColorField(rawColor) {
    const binding = getBinding(rawColor, undefined);
    if (binding) {
        return binding;
    }
    if (typeof rawColor === "string" && rawColor.trim().length > 0) {
        return { kind: "literal", value: rawColor };
    }
    return undefined;
}

// P171: migrate a legacy ui-list `itemsPath` (a plain state path) into a `state`
// binding on `items` (mirrors ui-tabs `activeTabPath`→`activeTab`). PRECISE
// mapping: a leading `state.` prefix is stripped (`state.foo.bar` → path
// `foo.bar`), otherwise the whole string is the state path — never `state.state.…`.
// An empty/absent path yields no binding (undefined).
function migrateStatePath(rawPath) {
    if (typeof rawPath !== "string") {
        return undefined;
    }
    const trimmed = rawPath.trim();
    if (trimmed.length === 0) {
        return undefined;
    }
    const path = trimmed.startsWith("state.") ? trimmed.slice("state.".length) : trimmed;
    return stateBinding(path);
}

// P157 (ADR 0012): resolve a ui-menu `items` config into the node-definition
// `items` value — a static array (the menu renders entries itself, a STRUCTURAL
// array like ui-select `options`, NOT a repeats case) OR a binding object
// (store/query/reactive) resolved structurally by the renderer. A json-literal
// binding's raw array is unwrapped to the static array; every dynamic binding
// kind passes through; a legacy `itemsPath` migrates to a state binding; a bare
// JSON string / array (flow.json/tests) is parsed/kept as an array.
function resolveMenuItems(config) {
    const candidate = config.items;
    if (candidate && typeof candidate === "object" && typeof candidate.kind === "string") {
        if (candidate.kind === "literal") {
            return Array.isArray(candidate.value) ? candidate.value : candidate;
        }
        return candidate;
    }
    if (Array.isArray(candidate)) {
        return candidate;
    }
    if (config.itemsPath) {
        return stateBinding(config.itemsPath);
    }
    return parseJsonList(config.items);
}

// P158 (ADR 0012): resolve a ui-table `rows` config into the schema `rows`
// binding — the canonical STRUCTURAL array DATA SOURCE (the table renders its
// rows ITSELF; a data source, NOT a repeats case). Mirrors `resolveMenuItems`:
// a binding object (store/query/reactive/json-literal) passes through for the
// renderer's structural resolution; a bare array (flow.json/tests) is wrapped as
// a json-literal binding; a legacy `rowsPath` plain path migrates to a state
// binding (P137 shim). The schema's `rows` is `bindingSchema`, so the result is
// always a binding object. `columns` stays separate (Collections).
function resolveTableRows(config) {
    const candidate = config.rows;
    if (candidate && typeof candidate === "object" && typeof candidate.kind === "string") {
        return candidate;
    }
    if (Array.isArray(candidate)) {
        return { kind: "literal", value: candidate };
    }
    if (config.rowsPath) {
        return stateBinding(config.rowsPath);
    }
    return stateBinding("");
}

// P133 (ADR 0012): resolve a ui-select / ui-radio `options` config into the
// node-definition `options` value — either a normalised `{label,value}[]` array
// (the `json` type) or a binding object (the `store` type), with legacy migration:
//   - new `options` binding object:
//       · { kind:"literal", value:<raw JSON> } → normalise the JSON (3 forms)
//       · { kind:"store"/… }                   → pass the binding through
//   - legacy `optionsJson` string  → JSON.parse → normalise to an array
//   - legacy `optionsBinding` string → stateBinding(path)
// `fallback` is returned when nothing is configured (undefined for ui-select,
// [] for ui-radio which requires options).
function mapSelectOptions(config, fallback) {
    const candidate = config.options;

    // New single binding object.
    if (candidate && typeof candidate === "object" && typeof candidate.kind === "string") {
        if (candidate.kind === "literal") {
            const normalised = normalizeSelectOptions(candidate.value);
            return normalised.ok ? normalised.options : fallback;
        }
        return candidate;
    }

    // New `options` carrying a raw JSON value (object/array) directly.
    if (candidate && typeof candidate === "object") {
        const normalised = normalizeSelectOptions(candidate);
        return normalised.ok ? normalised.options : fallback;
    }
    if (typeof candidate === "string" && candidate.trim().length > 0) {
        try {
            const normalised = normalizeSelectOptions(JSON.parse(candidate));
            return normalised.ok ? normalised.options : fallback;
        }
        catch (_err) {
            return fallback;
        }
    }

    // Legacy `optionsJson` static JSON string.
    if (typeof config.optionsJson === "string" && config.optionsJson.trim().length > 0) {
        try {
            const normalised = normalizeSelectOptions(JSON.parse(config.optionsJson));
            return normalised.ok ? normalised.options : fallback;
        }
        catch (_err) {
            return fallback;
        }
    }

    // Legacy `optionsBinding` store-path string → state binding.
    if (typeof config.optionsBinding === "string" && config.optionsBinding.trim().length > 0) {
        return stateBinding(config.optionsBinding);
    }

    return fallback;
}

// P69: normalise an icon field config value into the schema-accepted shape.
//  - a dynamic binding ({ kind, … }) → passed through unchanged
//  - a literal { library, name } object → passed through unchanged
//  - a string "name" or "library:name" → parsed into { library, name } (the
//    default library stays implicit: a bare "name" is returned as-is so the
//    renderer/normalizer applies the default)
//  - empty/blank → undefined
function mapIconField(value) {
    if (value === undefined || value === null) {
        return undefined;
    }
    if (typeof value === "object") {
        if (typeof value.kind === "string") {
            return value; // dynamic binding
        }
        if (typeof value.name === "string" && value.name.length > 0) {
            return value; // literal { library, name }
        }
        return undefined;
    }
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed.length === 0) {
            return undefined;
        }
        const sep = trimmed.indexOf(":");
        if (sep > 0 && sep < trimmed.length - 1) {
            return { library: trimmed.slice(0, sep), name: trimmed.slice(sep + 1) };
        }
        return trimmed; // bare name → default library applied downstream
    }
    return undefined;
}

// P111: ui-text split the old `variant` field into two orthogonal axes:
//   • `style`   — typographic ROLE (heading-1/…/code), maps to an HTML element
//   • `variant` — semantic COLOUR (default/muted/primary/…), like ui-button
// Legacy flows stored the typographic role in `variant`; this migrates them so
// the node still validates and renders. `muted` was a role pre-P111 but is a
// colour, so it crosses over to the colour axis.
const TEXT_ROLE_VALUES = new Set(["heading-1", "heading-2", "heading-3", "body", "caption", "label", "code"]);
function mapTextStyleAndVariant(config) {
    const styleCfg = blankToUndefined(config.style);
    const variantCfg = blankToUndefined(config.variant);
    // New-schema config: `style` is present → trust both fields as authored.
    if (styleCfg) {
        return { style: styleCfg, variant: variantCfg };
    }
    // Legacy config: only `variant` existed and held the typographic role.
    if (variantCfg && TEXT_ROLE_VALUES.has(variantCfg)) {
        return { style: variantCfg, variant: undefined };
    }
    // Legacy `muted` role → colour "muted"; any other value is already a colour
    // (or undefined). `style` falls back to its "body" default downstream.
    return { style: undefined, variant: variantCfg };
}

function initializeState(stores, queries, appId) {
    let state = {
        ui: {
            appId,
            dialogs: {},
            queries: {}
        }
    };

    for (const store of stores) {
        if (store.initialValue !== undefined) {
            state = setValueAtPath(state, store.statePath, clone(store.initialValue));
        }
    }

    // P160: a query's live state lives under `ui.queries.<queryPath>` as a
    // lifecycle envelope `{ data, loading, error, updatedAt, status }`. The
    // bound view reads the DATA via `query:<queryPath>` and the lifecycle via
    // the reserved sub-paths `query:<queryPath>.loading|error|updatedAt`. We seed
    // the idle envelope (no data yet) keyed by queryPath — NOT node id — so the
    // key a `query` binding references and the key the push writes agree.
    for (const query of queries) {
        if (!query.queryPath) {
            continue;
        }
        state = setValueAtPath(state, `ui.queries.${query.queryPath}`, {
            data: undefined,
            loading: false,
            error: undefined,
            updatedAt: undefined,
            status: "idle"
        });
    }

    return state;
}

// P160: split the live `ui.queries.<queryPath>` envelopes into the two sources
// the renderer reads — `queries` (the DATA tree, so `query:<queryPath>` resolves
// the data) and `queryLifecycle` (queryPath → {loading,error,updatedAt,status},
// so `query:<queryPath>.loading|error|updatedAt` resolve the load state). Keyed
// by queryPath; dotted paths nest in the data tree exactly as the binding reads.
function buildQuerySources(state, queries) {
    let dataTree = {};
    const lifecycle = {};
    for (const query of queries) {
        if (!query.queryPath) {
            continue;
        }
        const envelope = getValueAtPath(state, `ui.queries.${query.queryPath}`);
        const env = isPlainObject(envelope) ? envelope : {};
        if (env.data !== undefined) {
            dataTree = setValueAtPath(dataTree, query.queryPath, env.data);
        }
        lifecycle[query.queryPath] = {
            loading: env.loading === true,
            error: env.error,
            updatedAt: env.updatedAt,
            status: env.status || "idle",
            // P161: paging metadata surfaced via the lifecycle read convention so
            // `query:<path>.totalCount` / `.pageCount` resolve like `.loading`.
            totalCount: env.totalCount,
            pageCount: env.pageCount
        };
    }
    return { queries: dataTree, queryLifecycle: lifecycle };
}

// P160: fold an incoming `msg.ui.query` push into the live query envelope at
// `ui.queries.<queryPath>`. A `data` push records the data + success status +
// updatedAt and clears any prior error; an `error` push records the error +
// error status; a bare `refresh`/`loading` push flips `loading`/status without
// touching the last good data. Returns the next state (immutably via
// setValueAtPath) or null when the message carries no recognised query path.
function applyQueryMessage(currentState, queryMsg) {
    if (!queryMsg || typeof queryMsg !== "object" || !queryMsg.queryPath) {
        return null;
    }
    const path = `ui.queries.${queryMsg.queryPath}`;
    const prev = getValueAtPath(currentState, path);
    const envelope = isPlainObject(prev) ? { ...prev } : { status: "idle" };

    if (Object.prototype.hasOwnProperty.call(queryMsg, "data")) {
        envelope.data = clone(queryMsg.data);
        envelope.error = undefined;
        envelope.loading = false;
        envelope.status = "success";
        envelope.updatedAt = Date.now();
        // P161: paging metadata travels alongside the data push. A wired fetch
        // that knows the full result size reports `totalCount` (and optionally
        // `pageCount`); they live in the SAME envelope so `query:<path>.totalCount`
        // resolves them via the lifecycle read convention. Absent keys leave the
        // previous values untouched (a data-only push keeps the last known total).
        if (Object.prototype.hasOwnProperty.call(queryMsg, "totalCount")) {
            envelope.totalCount = queryMsg.totalCount;
        }
        if (Object.prototype.hasOwnProperty.call(queryMsg, "pageCount")) {
            envelope.pageCount = queryMsg.pageCount;
        }
    }
    else if (Object.prototype.hasOwnProperty.call(queryMsg, "error")) {
        envelope.error = queryMsg.error;
        envelope.loading = false;
        envelope.status = "error";
    }
    else if (queryMsg.refresh === true || queryMsg.loading === true) {
        envelope.loading = true;
        envelope.status = "loading";
    }
    else {
        return null;
    }

    return setValueAtPath(currentState, path, envelope);
}

function resolveNavigationTarget(navigationPath, parameters, routeParams) {
    return navigationPath
        .split("/")
        .map((segment) => {
            if (!segment.startsWith(":")) {
                return segment;
            }

            const paramName = segment.slice(1);
            const resolvedValue = parameters[paramName] || routeParams[paramName] || parameters.rowId;
            return encodeURIComponent(String(resolvedValue || ""));
        })
        .join("/");
}

function findTypedAction(actions, actionId) {
    return actions.find((entry) => entry.id === actionId && entry.actionType);
}

function buildUiMessage({ componentId, eventName, actionId, location, routeParams, statePatch, payload, dialog, navigation, queries }) {
    return uiEventMessageSchema.parse({
        ui: {
            event: eventName,
            componentId,
            action: actionId,
            route: location,
            params: routeParams,
            statePatch,
            payload,
            dialog,
            navigation,
            queries
        }
    });
}

function emitMessageToRuntimeNodes(RED, actionId, queries, navigationId, message) {
    const candidateIds = new Set([actionId, navigationId, ...queries.map((query) => query.id)].filter(Boolean));

    candidateIds.forEach((nodeId) => {
        const node = RED.nodes.getNode(nodeId);
        if (node && typeof node.send === "function") {
            node.send(clone(message));
        }
    });
}

function getRouteMatch(location, routes) {
    const normalizedLocation = location.startsWith("/") ? location : `/${location}`;
    const matches = routes
        .map((route) => {
            const paramNames = [];
            const pattern = route.path
                .split("/")
                .map((segment) => {
                    if (segment.startsWith(":")) {
                        paramNames.push(segment.slice(1));
                        return "([^/]+)";
                    }

                    return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                })
                .join("/");
            const result = new RegExp(`^${pattern}$`).exec(normalizedLocation);

            if (!result) {
                return undefined;
            }

            const params = {};
            paramNames.forEach((paramName, index) => {
                params[paramName] = decodeURIComponent(result[index + 1] || "");
            });

            return {
                route,
                params
            };
        })
        .filter(Boolean)
        .sort((left, right) => right.route.path.length - left.route.path.length);

    return matches[0];
}

// P168 (ADR 0018 §5): in-editor migration of LEGACY `ui-tabs` flows (pre-P167)
// so old flows do not break under the children model. A legacy `ui-tabs` carries
// a `tabs:[{id,label}]` array and its content children mount via the derived
// slot `tab:<tabId>`. This pre-pass rewrites such a node to the Model-1a shape:
//   - drop the legacy `tabs` array from the ui-tabs node,
//   - synthesize one `ui-tab` child per legacy entry (id/label preserved,
//     mounting into `ui-tabs:<tabsId>/content`),
//   - re-point each `tab:<tabId>` content child onto `ui-tab:<tabId>/content`.
// A flow already on the children model (no `tabs` array) passes through
// untouched. Pure — operates on a shallow copy.
function migrateLegacyTabComponents(components) {
    // Accept BOTH the raw `tabs` array (when migration runs on un-mapped configs)
    // and the `legacyTabs` carrier that ui-tabs mapConfig preserves.
    const legacyTabsOf = (c) => {
        if (Array.isArray(c.legacyTabs) && c.legacyTabs.length > 0) { return c.legacyTabs; }
        if (Array.isArray(c.tabs) && c.tabs.length > 0) { return c.tabs; }
        return null;
    };
    const legacyTabsNodes = components.filter((c) => c && c.type === "ui-tabs" && legacyTabsOf(c));

    if (legacyTabsNodes.length === 0) {
        return components;
    }

    // Map a legacy tab slot mount (`tab:<tabId>`) → the owning ui-tabs id, so a
    // content child can be re-pointed. Each legacy tab id is globally unique
    // enough here (tab ids are the slot keys); collisions across ui-tabs are a
    // pre-existing authoring error and fall back to a best-effort remap.
    const tabIdToTabsId = new Map();
    const syntheticChildren = [];
    const migratedTabsIds = new Set();

    for (const tabsNode of legacyTabsNodes) {
        migratedTabsIds.add(tabsNode.id || tabsNode.uiId);
        const tabsId = tabsNode.id || tabsNode.uiId;
        (legacyTabsOf(tabsNode) || []).forEach((entry, index) => {
            const tabId = (entry && (entry.id !== undefined ? String(entry.id) : String(entry))) || String(index);
            const label = entry && entry.label !== undefined ? String(entry.label) : tabId;
            tabIdToTabsId.set(tabId, tabsId);
            syntheticChildren.push({
                type: "ui-tab",
                id: tabId,
                uiId: tabId,
                mount: `ui-tabs:${tabsId}/${"content"}`,
                label: { kind: "literal", value: label },
                order: index
            });
        });
    }

    const remapped = components.map((c) => {
        if (!c) { return c; }
        // Strip the legacy `tabs` / `legacyTabs` carriers from migrated ui-tabs.
        if (c.type === "ui-tabs" && migratedTabsIds.has(c.id || c.uiId)) {
            const { tabs, legacyTabs, ...rest } = c;
            return rest;
        }
        // Re-point legacy content children mounted at `tab:<tabId>`.
        const rawMount = typeof c.mount === "string" ? c.mount.trim() : "";
        if (rawMount.startsWith("tab:")) {
            const tabId = rawMount.slice("tab:".length).split("/")[0];
            if (tabIdToTabsId.has(tabId)) {
                return { ...c, mount: `ui-tab:${tabId}/content` };
            }
        }
        return c;
    });

    return [...remapped, ...syntheticChildren];
}

// P169 (ADR 0018, Model 1a): mirror of migrateLegacyTabComponents for
// ui-accordion. Synthesizes `ui-accordion-section` children from a legacy
// `sections` config array and re-points legacy `section:<id>` content mounts onto
// the new section content slots.
function migrateLegacyAccordionComponents(components) {
    // Accept BOTH the raw `sections` array (when migration runs on un-mapped
    // configs) and the `legacySections` carrier that ui-accordion mapConfig keeps.
    const legacySectionsOf = (c) => {
        if (Array.isArray(c.legacySections) && c.legacySections.length > 0) { return c.legacySections; }
        if (Array.isArray(c.sections) && c.sections.length > 0) { return c.sections; }
        return null;
    };
    const legacyAccordionNodes = components.filter((c) => c && c.type === "ui-accordion" && legacySectionsOf(c));

    if (legacyAccordionNodes.length === 0) {
        return components;
    }

    const sectionIdToAccordionId = new Map();
    const syntheticChildren = [];
    const migratedAccordionIds = new Set();

    for (const accNode of legacyAccordionNodes) {
        migratedAccordionIds.add(accNode.id || accNode.uiId);
        const accId = accNode.id || accNode.uiId;
        (legacySectionsOf(accNode) || []).forEach((entry, index) => {
            const sectionId = (entry && (entry.id !== undefined ? String(entry.id) : String(entry))) || String(index);
            const label = entry && entry.label !== undefined ? String(entry.label) : sectionId;
            sectionIdToAccordionId.set(sectionId, accId);
            syntheticChildren.push({
                type: "ui-accordion-section",
                id: sectionId,
                uiId: sectionId,
                mount: `ui-accordion:${accId}/${"content"}`,
                label: { kind: "literal", value: label },
                order: index
            });
        });
    }

    const remapped = components.map((c) => {
        if (!c) { return c; }
        // Strip the legacy `sections` / `legacySections` carriers from migrated ui-accordion.
        if (c.type === "ui-accordion" && migratedAccordionIds.has(c.id || c.uiId)) {
            const { sections, legacySections, ...rest } = c;
            return rest;
        }
        // Re-point legacy content children mounted at `section:<sectionId>`.
        const rawMount = typeof c.mount === "string" ? c.mount.trim() : "";
        if (rawMount.startsWith("section:")) {
            const sectionId = rawMount.slice("section:".length).split("/")[0];
            if (sectionIdToAccordionId.has(sectionId)) {
                return { ...c, mount: `ui-accordion-section:${sectionId}/content` };
            }
        }
        return c;
    });

    return [...remapped, ...syntheticChildren];
}

function toComponentDefinitions(components) {
    return components.map((component) => {
        if (component.type === "ui-text") {
            const layoutProps = collectNormalizedLayoutProps(component);
            return {
                id: component.id,
                kind: "text",
                mount: component.mount || component.parent,
                order: resolveOrder(component),
                bind: {
                    value: getBinding(component.value, literalBinding(component.text || ""))
                },
                props: {
                    // P111: `style` (typographic role → HTML tag) and `variant`
                    // (semantic colour) are distinct axes. `size` was removed.
                    ...(blankToUndefined(component.style) ? { style: component.style } : {}),
                    ...(blankToUndefined(component.variant) ? { variant: component.variant } : {}),
                    // P221 (ADR 0035): form-field presentation mode + its label.
                    // Only carried when active so the default free-text path is
                    // byte-for-byte unchanged.
                    ...(component.display === "formField" ? { display: "formField" } : {}),
                    ...(component.display === "formField" && blankToUndefined(component.label)
                        ? { label: component.label }
                        : {}),
                    ...(Object.keys(layoutProps).length > 0 ? { layout: layoutProps } : {})
                },
                events: []
            };
        }

        if (component.type === "ui-button") {
            const layoutProps = collectNormalizedLayoutProps(component);
            // P20a: click events are emitted on the button's own output port.
            // The button node's id is used as the action target for the /event endpoint.
            const clickAction = component.action || component.id;
            // P69: icon is binding-capable. A binding (has .kind) is routed via
            // bind.icon so the renderer resolves it into resolvedProps.icon; a
            // literal value ({library,name} or bare string) stays in props.icon.
            const iconBinding = getBinding(component.icon, undefined);
            const buttonBind = component.disabled || component.disabledPath
                ? { disabled: getBinding(component.disabled, stateBinding(component.disabledPath || "")) }
                : {};
            if (iconBinding) {
                buttonBind.icon = iconBinding;
            }
            // P144 (ADR 0012): `label` may now be a binding object or a plain
            // string (legacy). When it is a dynamic binding (non-literal), route
            // it through bind.label; a literal binding unwraps to props.label; a
            // plain string stays in props.label unchanged.
            const labelDef = component.label;
            const labelBinding = getBinding(labelDef, undefined);
            const labelLiteral = (labelBinding && labelBinding.kind === "literal")
                ? (labelBinding.value !== undefined && labelBinding.value !== null ? String(labelBinding.value) : undefined)
                : undefined;
            const labelProp = labelLiteral !== undefined
                ? labelLiteral
                : (typeof labelDef === "string" ? labelDef : undefined);
            if (labelBinding && labelBinding.kind !== "literal") {
                buttonBind.label = labelBinding;
            }
            // P71: href is a binding (mapConfig already normalised a literal string
            // into a literal binding). A dynamic binding routes through bind.href so
            // the renderer resolves it into resolvedProps.href; a literal binding's
            // value goes straight into props.href. Only used in url/navigate modes.
            const hrefDef = component.href;
            const hrefIsBinding = hrefDef && typeof hrefDef === "object" && typeof hrefDef.kind === "string";
            const hrefLiteral = (hrefIsBinding && hrefDef.kind === "literal" && hrefDef.value !== undefined && hrefDef.value !== null && hrefDef.value !== "")
                ? hrefDef.value
                : undefined;
            if (hrefIsBinding && hrefDef.kind !== "literal") {
                buttonBind.href = hrefDef;
            }
            return {
                id: component.id,
                kind: "button",
                mount: component.mount || component.parent,
                order: resolveOrder(component),
                bind: buttonBind,
                props: {
                    label: labelProp,
                    ...(component.icon !== undefined && !iconBinding ? { icon: component.icon } : {}),
                    ...(blankToUndefined(component.variant) ? { variant: component.variant } : {}),
                    // P71: size (sm/md/lg), explicit outline flag, link mode + href.
                    ...(blankToUndefined(component.size) ? { size: component.size } : {}),
                    ...(component.outline === true ? { outline: true } : {}),
                    ...(blankToUndefined(component.linkMode) && component.linkMode !== "button" ? { linkMode: component.linkMode } : {}),
                    ...(hrefLiteral !== undefined ? { href: hrefLiteral } : {}),
                    ...(Object.keys(layoutProps).length > 0 ? { layout: layoutProps } : {})
                },
                events: [{ event: "click", action: clickAction }]
            };
        }

        if (component.type === "ui-table") {
            const layoutProps = collectNormalizedLayoutProps(component);
            const tableEvents = filterSupportedTableEvents(parseJsonList(component.events));
            return {
                id: component.id,
                kind: "table",
                mount: component.mount || component.parent,
                order: resolveOrder(component),
                bind: {
                    rows: resolveTableRows(component)
                },
                props: {
                    columns: parseColumns(component.columns),
                    events: tableEvents.length > 0 ? tableEvents : (component.selectAction ? ["rowSelect"] : []),
                    selectAction: component.selectAction || null,
                    ...(Object.keys(layoutProps).length > 0 ? { layout: layoutProps } : {})
                },
                events: component.selectAction ? [{ event: "select", action: component.selectAction }] : []
            };
        }

        if (component.type === "ui-container") {
            const layoutProps = collectNormalizedLayoutProps(component);
            // P255: onShow/onHide are VISIBILITY-LIFECYCLE events, not DOM handlers.
            // A hidden container is gated OUT of the render tree server-side (the
            // renderer returns undefined for visible=false), so there is no server
            // hook that observes the hide. The CLIENT detects the container
            // appearing/disappearing across snapshot morphs and POSTs the matching
            // /event. Carry the enabled lifecycle events in props (free record — no
            // schema change; they are not part of the closed interaction-event enum)
            // so the serializer can stamp them onto the wrapper for the client to read.
            const lifecycleEvents = Array.isArray(component.events)
                ? component.events.filter((event) => event === "onShow" || event === "onHide")
                : [];
            // P255: wire the `visible` base field (installBaseFields/applyBaseFields,
            // possibly store/state-bound) into visibleIf so a store toggle actually
            // shows/hides the container — the render-gate the lifecycle events hook
            // into. An unbound `visible` is normalised to the per-client slot by the
            // applyDynamicStateSlots post-pass (so the imperative show/hide op works),
            // exactly as for the generic p16Kind display path above.
            const visibleBinding = getBinding(component.visible, undefined);
            return {
                id: component.id,
                kind: "container",
                mount: component.mount || component.parent,
                order: resolveOrder(component),
                bind: {},
                ...(visibleBinding ? { visibleIf: visibleBinding } : {}),
                props: {
                    layoutId: component.layout || component.layoutId,
                    ...(blankToUndefined(component.variant) ? { variant: component.variant } : {}),
                    ...(lifecycleEvents.length > 0 ? { lifecycleEvents } : {}),
                    ...(Object.keys(layoutProps).length > 0 ? { layout: layoutProps } : {})
                },
                events: []
            };
        }

        if (component.type === "ui-input") {
            const layoutProps = collectNormalizedLayoutProps(component);
            const disabledBinding = getBinding(component.disabled, component.disabledPath ? stateBinding(component.disabledPath) : undefined);
            const bind = {
                value: getBinding(component.value, stateBinding(joinStatePath(component.storeId ? undefined : "", component.path || "")))
            };
            if (disabledBinding) {
                bind.disabled = disabledBinding;
            }
            // P145 (ADR 0012): `label` may now be a binding object or a plain
            // string (legacy). When it is a dynamic binding (non-literal), route
            // it through bind.label; a literal binding unwraps to props.label; a
            // plain string stays in props.label unchanged.
            const inputLabelDef = component.label;
            const inputLabelBinding = getBinding(inputLabelDef, undefined);
            const inputLabelLiteral = (inputLabelBinding && inputLabelBinding.kind === "literal")
                ? (inputLabelBinding.value !== undefined && inputLabelBinding.value !== null ? String(inputLabelBinding.value) : undefined)
                : undefined;
            const inputLabelProp = inputLabelLiteral !== undefined
                ? inputLabelLiteral
                : (typeof inputLabelDef === "string" ? inputLabelDef : undefined);
            if (inputLabelBinding && inputLabelBinding.kind !== "literal") {
                bind.label = inputLabelBinding;
            }
            return {
                id: component.id,
                kind: "input",
                mount: component.mount || component.parent,
                order: resolveOrder(component),
                bind,
                props: {
                    label: inputLabelProp,
                    storeId: component.storeId,
                    path: component.path,
                    inputType: component.inputType,
                    ...(blankToUndefined(component.placeholder) ? { placeholder: component.placeholder } : {}),
                    ...(blankToUndefined(component.variant) ? { variant: component.variant } : {}),
                    ...(blankToUndefined(component.size) ? { size: component.size } : {}),
                    ...(Object.keys(layoutProps).length > 0 ? { layout: layoutProps } : {})
                },
                events: []
            };
        }

        // P165 (ADR 0017): ui-repeat — a TEMPLATE CONTAINER. It maps to the
        // renderer kind "repeat" (like ui-container maps to "container"). It emits
        // no rendered chrome: the renderer EXPANDS it, cloning its default-slot
        // ("content"/REPEAT_SLOT) child subtree once per resolved `items` element
        // and pushing a render-time item scope. `items` is a REQUIRED structural
        // binding resolved by the renderer into the iteration list; `keyField` is
        // the optional stable per-instance key for the keyed morph. Back-compat
        // fallbacks (itemsPath / json-literal) mirror ui-list.
        if (component.type === "ui-repeat") {
            const layoutProps = collectNormalizedLayoutProps(component);
            const itemsBinding = getBinding(component.items, component.itemsPath ? stateBinding(component.itemsPath) : undefined);
            return {
                id: component.id,
                kind: "repeat",
                mount: component.mount || component.parent,
                order: resolveOrder(component),
                bind: itemsBinding ? { items: itemsBinding } : {},
                props: {
                    // ADR 0025: ui-repeat is TRANSPARENT — NO layoutId, NO variant.
                    // The renderer flattens the cloned template children into the host
                    // region with no wrapper. Layout/chrome = an explicit ui-container.
                    ...(blankToUndefined(component.keyField) ? { keyField: component.keyField } : {}),
                    // P193 (ADR 0023): the optional alias naming this repeat's item
                    // scope, so a descendant can address THIS level by name.
                    ...(blankToUndefined(component.itemName) ? { itemName: component.itemName } : {}),
                    ...(Object.keys(layoutProps).length > 0 ? { layout: layoutProps } : {})
                },
                events: []
            };
        }

        // P168 (ADR 0018, Model 1a): ui-tab — a thin CONTAINER child of ui-tabs.
        // It maps to the renderer kind "tab"; it emits no standalone chrome (its
        // parent `tabs` enumerates it and renders its panel). `label` is a value
        // binding routed through bind.label so the renderer resolves it to the tab
        // title; `icon` is a static prop. Content children mount via
        // `ui-tab:<id>/content` (= TAB_SLOT) and render into the tab's panel.
        if (component.type === "ui-tab") {
            const layoutProps = collectNormalizedLayoutProps(component);
            const labelBinding = getBinding(component.label, undefined);
            return {
                id: component.id,
                kind: "tab",
                mount: component.mount || component.parent,
                order: resolveOrder(component),
                bind: labelBinding ? { label: labelBinding } : {},
                props: {
                    ...(blankToUndefined(component.icon) ? { icon: component.icon } : {}),
                    ...(Object.keys(layoutProps).length > 0 ? { layout: layoutProps } : {})
                },
                events: []
            };
        }

        // P179 (ADR 0020): ui-component-definition — an OFF-CANVAS template
        // container. It maps to the renderer kind "component-definition". It carries
        // NO rendered chrome: `renderRegions` never emits it (its outer mount never
        // resolves to a real region); only `expandComponent` consumes it, via an
        // instance. Its children mount via `def:<id>/content` (= COMPONENT_DEF_SLOT)
        // and bucket into the app by their real `.z` like any ui-node.
        if (component.type === "ui-component-definition") {
            return {
                id: component.id,
                kind: "component-definition",
                // Off-canvas self-anchor: `def:<id>` is non-empty (the schema requires
                // a non-empty mount) but never resolves to a real region — the
                // renderer finds the definition by id, never by mount. The definition
                // therefore never renders on its own.
                mount: `def:${component.id}`,
                order: resolveOrder(component),
                bind: {},
                props: {
                    ...(blankToUndefined(component.name) ? { name: component.name } : {})
                },
                events: []
            };
        }

        // P179 (ADR 0020): ui-component-instance — a LEAF-shaped node that EXPANDS
        // its definition's `def:` subtree at its real outer mount. It maps to the
        // renderer kind "component-instance" (like a repeat, it carries no chrome of
        // its own). `bind` is the prop map (name → value-binding, any binding kind);
        // the renderer resolves each into a `propScope` frame. `definitionId` lives
        // in `props` (never `bind`, so it is not treated as a prop).
        if (component.type === "ui-component-instance") {
            const propMap = (component.props && typeof component.props === "object") ? component.props : {};
            const bind = {};
            for (const [name, raw] of Object.entries(propMap)) {
                const binding = getBinding(raw, undefined);
                if (binding) {
                    bind[name] = binding;
                }
            }
            return {
                id: component.id,
                kind: "component-instance",
                mount: component.mount || component.parent,
                order: resolveOrder(component),
                bind,
                props: {
                    definitionId: component.definitionId
                },
                events: []
            };
        }

        // P169 (ADR 0018, Model 1a): ui-accordion-section — a thin CONTAINER child
        // of ui-accordion (mirror of ui-tab). It maps to the renderer kind
        // "accordion-section"; it emits no standalone chrome (its parent
        // `accordion` enumerates it and renders its panel). `label` is a value
        // binding routed through bind.label so the renderer resolves it to the
        // section title; `icon` is a static prop. Content children mount via
        // `ui-accordion-section:<id>/content` (= ACCORDION_SECTION_SLOT).
        if (component.type === "ui-accordion-section") {
            const layoutProps = collectNormalizedLayoutProps(component);
            const labelBinding = getBinding(component.label, undefined);
            return {
                id: component.id,
                kind: "accordion-section",
                mount: component.mount || component.parent,
                order: resolveOrder(component),
                bind: labelBinding ? { label: labelBinding } : {},
                props: {
                    ...(blankToUndefined(component.icon) ? { icon: component.icon } : {}),
                    ...(Object.keys(layoutProps).length > 0 ? { layout: layoutProps } : {})
                },
                events: []
            };
        }

        // P25: P16x interactive kinds — each maps to its semantic kind so the
        // renderer snapshot carries the correct kind and renderComponentHtml can
        // produce the right Shoelace element (or semantic-HTML fallback).
        const P16X_KIND_MAP = {
            "ui-select": "select",
            "ui-checkbox": "checkbox",
            "ui-radio": "radio",
            "ui-switch": "switch",
            "ui-textarea": "textarea",
            "ui-datepicker": "datepicker",
            "ui-slider": "slider",
            "ui-alert": "alert",
            "ui-badge": "badge",
            "ui-progress": "progress",
            "ui-breadcrumb": "breadcrumb",
            "ui-tabs": "tabs",
            "ui-accordion": "accordion",
            "ui-menu": "menu",
            "ui-avatar": "avatar",
            // P70: ui-image renders as a native <img> (kind "image").
            "ui-image": "image",
            // P69: ui-icon is a rendered component (kind "icon").
            "ui-icon": "icon",
            // P45: composite and layout nodes
            "ui-list": "list",
            "ui-pagination": "pagination",
            "ui-stepper": "stepper",
            // P57: log display node
            "ui-log": "log",
            // P83: ui-divider — static separator; renders as sl-divider.
            "ui-divider": "divider",
            // P241: ui-skeleton — animated loading placeholder (kind "skeleton").
            // Rides the generic display path so `visible` (visibleIf), `color`
            // (base field → bind.color/props.color) and displayType/lines flow
            // through to the serializer's skeleton branch.
            "ui-skeleton": "skeleton"
        };
        const p16Kind = P16X_KIND_MAP[component.type];

        if (p16Kind) {
            const valueBinding = getBinding(component.value, component.valuePath ? stateBinding(component.valuePath) : undefined);
            const disabledBinding = getBinding(component.disabled, component.disabledPath ? stateBinding(component.disabledPath) : undefined);
            // P172 (ADR 0015): `visible` base field — extracted generically so any
            // p16Kind node that stores a `visible` binding (from installBaseFields/
            // applyBaseFields) has it wired into visibleIf on the ComponentDefinition
            // (the renderer checks component.visibleIf to decide whether to render).
            const visibleBinding = getBinding(component.visible, undefined);
            // P172 (ADR 0015) + P231: `color` as a binding — for non-variant nodes
            // the color is a bindable active-value (literal colour string or a
            // dynamic binding). Routed GENERICALLY (P231, no longer list-only): any
            // p16Kind node that stores a `color` BINDING object (installBaseFields /
            // applyBaseFields on the color-applicable nodes — ui-divider, ui-avatar,
            // ui-progress, ui-list, …) has it wired through bind.color so the renderer
            // resolves it into resolvedProps.color. `getBinding` only returns a
            // binding OBJECT, so a plain-string `color` (ui-icon's dedicated field)
            // stays in props untouched — no behaviour change for those.
            const colorBinding = getBinding(component.color, undefined);
            // For alert/badge nodes that use `message`/`value` as primary binding fields
            // (not `value`), fall back to those fields as the value binding so the
            // renderer resolves them and the serializer can read the string from
            // component.value rather than the raw binding object in component.props.
            const messageBinding = !valueBinding && p16Kind === "alert" ? getBinding(component.message, undefined) : undefined;
            // P67: ui-alert `title` is a binding (literal/state/.../store) routed
            // through bind.title so the renderer resolves it to a string in
            // resolvedProps.title (the serializer reads component.props.title).
            const titleBinding = p16Kind === "alert" ? getBinding(component.title, undefined) : undefined;
            const srcBinding = !valueBinding && (p16Kind === "avatar" || p16Kind === "image") ? getBinding(component.src, undefined) : undefined;
            // P94: initials binding for ui-avatar — routed through bind.initials so the
            // renderer resolves it to a string in resolvedProps.initials → component.props.initials.
            const initialsBinding = p16Kind === "avatar" ? getBinding(component.initials, undefined) : undefined;
            // P45: pagination uses `page` as its primary binding; stepper uses `activeStep`; list uses `items`.
            // P154 (ADR 0012): `currentPage` (canonical two-way value typedInput) is
            // the page source — it becomes bind.value (read source); the change-event
            // carries the new page for the wired write-back loop. Legacy order:
            // `currentPage` → `page` → `currentPagePath` plain state path.
            const pageBinding = !valueBinding && p16Kind === "pagination" ? getBinding(component.currentPage, getBinding(component.page, component.currentPagePath ? stateBinding(component.currentPagePath) : undefined)) : undefined;
            // P154 (ADR 0012): `total` (canonical read-only value typedInput) → the
            // total-page count. Routed through bind.totalPages so the renderer
            // RESOLVES it (state/query/store) into resolvedProps.totalPages — the
            // serializer reads component.props.totalPages. Legacy order:
            // `total` → `totalPages` → `totalPath` plain state path.
            const totalPagesBinding = p16Kind === "pagination" ? getBinding(component.total, getBinding(component.totalPages, component.totalPath ? stateBinding(component.totalPath) : undefined)) : undefined;
            const activeStepBinding = !valueBinding && p16Kind === "stepper" ? getBinding(component.activeStep, component.activeStepPath ? stateBinding(component.activeStepPath) : undefined) : undefined;
            // P155 (ADR 0012): ui-tabs `activeTab` is the TWO-WAY input value — it
            // becomes bind.value so the renderer RESOLVES the active tab id from the
            // bound store/state (read source) into resolvedProps.value → component.value
            // (the serializer marks the matching sl-tab active). The existing tab
            // change event (params.value = the clicked tab id) is unchanged; a wired
            // flow writes that id back to the bound store and the activeTab binding
            // reads it back reactively. Legacy: `activeTabPath` plain state path.
            const activeTabBinding = !valueBinding && p16Kind === "tabs" ? getBinding(component.activeTab, component.activeTabPath ? stateBinding(component.activeTabPath) : undefined) : undefined;
            // P169 (ADR 0018 §4): ui-accordion `openSection` mirrors the ui-tabs
            // `activeTab` TWO-WAY path — it resolves through bind.value into
            // resolvedProps.value (read source), which the renderer uses to mark the
            // open section (default = first child by order). Legacy `openSectionPath`
            // plain state path migrates here.
            const openSectionBinding = !valueBinding && p16Kind === "accordion" ? getBinding(component.openSection, component.openSectionPath ? stateBinding(component.openSectionPath) : undefined) : undefined;
            // P171: ui-list `items` is a STRUCTURAL array source (the list renders
            // its rows ITSELF — NOT a repeats case), exactly like ui-menu `items` /
            // ui-table `rows`. A binding object routes through bind.items so the
            // renderer resolves it structurally (shared P133 path); a plain static
            // array stays in props.items. Legacy `itemsPath` migrates to a state
            // binding (leading `state.` stripped).
            const listItemsBinding = p16Kind === "list" ? getBinding(component.items, migrateStatePath(component.itemsPath)) : undefined;
            // P173: ui-list `selectedId` is the TWO-WAY selected-row binding (mirror of
            // ui-tabs `activeTab`, P155). It cannot ride bind.value (the list reuses
            // component.value as the legacy items-array fallback), so it routes through
            // a dedicated bind.selectedId → resolvedProps.selectedId (read source). The
            // itemSelect change-event carries the new rowId for the wired write-back
            // loop. Only meaningful when `selectable`.
            const selectedIdBinding = p16Kind === "list" ? getBinding(component.selectedId, undefined) : undefined;
            // P157 (ADR 0012): ui-menu `items` is a STRUCTURAL array binding (the
            // menu renders its entries itself — NOT a repeats/slot case, vgl. P140).
            // When it is a binding object (store/query/reactive/json-literal) route
            // it through bind.items so the renderer resolves it structurally (shared
            // P133 path) — a plain static array stays in props.items. `activeItem`
            // (the active route/path, read-only display value) routes through
            // bind.activeItem so the renderer resolves it into resolvedProps.activeItem.
            const menuItemsBinding = p16Kind === "menu" ? getBinding(component.items, undefined) : undefined;
            const menuActiveBinding = p16Kind === "menu" ? getBinding(component.activeItem, undefined) : undefined;
            const bind = {};
            if (valueBinding) {
                bind.value = valueBinding;
            }
            else if (messageBinding) {
                bind.value = messageBinding;
            }
            else if (srcBinding) {
                bind.value = srcBinding;
            }
            else if (pageBinding) {
                bind.value = pageBinding;
            }
            else if (activeStepBinding) {
                bind.value = activeStepBinding;
            }
            else if (activeTabBinding) {
                bind.value = activeTabBinding;
            }
            else if (openSectionBinding) {
                bind.value = openSectionBinding;
            }
            if (disabledBinding) {
                bind.disabled = disabledBinding;
            }
            // P172 (ADR 0015): color binding for non-variant p16Kind nodes (list).
            if (colorBinding) {
                bind.color = colorBinding;
            }
            // P154 (ADR 0012): pagination `total` (read-only) resolves through
            // bind.totalPages → resolvedProps.totalPages → props.totalPages, which
            // the serializer reads for the "n / total" label and last-page guard.
            if (totalPagesBinding) {
                bind.totalPages = totalPagesBinding;
            }
            if (titleBinding) {
                bind.title = titleBinding;
            }
            // P94: initials binding for ui-avatar — resolved by renderer into
            // resolvedProps.initials → component.props.initials (used by serializer).
            if (initialsBinding) {
                bind.initials = initialsBinding;
            }
            // P69: icon field on ui-icon / ui-avatar (and any p16 kind that
            // carries one). A binding (has .kind) is resolved by the renderer
            // into resolvedProps.icon; a literal value stays in props.icon.
            const iconBinding = getBinding(component.icon, undefined);
            if (iconBinding) {
                bind.icon = iconBinding;
            }
            // P97/P98: label binding for ui-checkbox and ui-datepicker — when label is a
            // binding object, route it through bind.label so the renderer resolves it to a
            // string in resolvedProps.label → component.props.label (used by serializer).
            // P136: ui-radio joins ui-select/checkbox/datepicker — a binding-object
            // label routes through bind.label so the renderer resolves it.
            // P137: ui-progress label is now a full binding — add "progress" to the set.
            // P146: ui-slider label is now a full binding — add "slider" to the set.
            // P147: ui-switch label is now a full binding — add "switch" to the set.
            // P148: ui-textarea label is now a full binding — add "textarea" to the set.
            // P150: ui-divider label is now a full binding — add "divider" to the set.
            const labelBinding = (p16Kind === "checkbox" || p16Kind === "datepicker" || p16Kind === "select" || p16Kind === "radio" || p16Kind === "progress" || p16Kind === "slider" || p16Kind === "switch" || p16Kind === "textarea" || p16Kind === "divider") ? getBinding(component.label, undefined) : undefined;
            if (labelBinding) {
                bind.label = labelBinding;
            }
            // P147: ui-switch labelOn/labelOff are now full bindings — route through
            // bind.labelOn / bind.labelOff so the renderer resolves them. A plain
            // string (legacy) stays in props. Only applies to the "switch" kind.
            const labelOnBinding = p16Kind === "switch" ? getBinding(component.labelOn, undefined) : undefined;
            if (labelOnBinding) {
                bind.labelOn = labelOnBinding;
            }
            const labelOffBinding = p16Kind === "switch" ? getBinding(component.labelOff, undefined) : undefined;
            if (labelOffBinding) {
                bind.labelOff = labelOffBinding;
            }
            // P133: ui-select `placeholder` and `options` may be binding objects
            // (canonical value set / store binding). Route them through `bind` so
            // the renderer resolves them into resolvedProps.{placeholder,options}.
            // P148: ui-textarea placeholder is now a full binding — add "textarea" to the set.
            // P149: ui-datepicker placeholder is now a full binding — add "datepicker" to the set.
            const placeholderBinding = (p16Kind === "select" || p16Kind === "textarea" || p16Kind === "datepicker") ? getBinding(component.placeholder, undefined) : undefined;
            if (placeholderBinding) {
                bind.placeholder = placeholderBinding;
            }
            // P133/P136: ui-select AND ui-radio share the `options` binding model —
            // a literal-json or store binding object routes through bind.options.
            const optionsBinding = (p16Kind === "select" || p16Kind === "radio") ? getBinding(component.options, undefined) : undefined;
            if (optionsBinding) {
                bind.options = optionsBinding;
            }
            // P157: ui-menu items (structural array) and activeItem (read-only value)
            // route through bind so the renderer resolves them (items structurally,
            // activeItem via the scalar path).
            if (menuItemsBinding) {
                bind.items = menuItemsBinding;
            }
            if (menuActiveBinding) {
                bind.activeItem = menuActiveBinding;
            }
            // P171: ui-list `items` binding routes through bind.items (resolved
            // structurally by the renderer into resolvedProps.items); a plain static
            // array stays in props.items (handled in the props block below).
            if (listItemsBinding) {
                bind.items = listItemsBinding;
            }
            // P173: route the two-way selectedId binding so the renderer resolves it
            // into resolvedProps.selectedId (the serializer marks the matching row).
            if (selectedIdBinding) {
                bind.selectedId = selectedIdBinding;
            }
            // P151 (ADR 0012): ui-image alt and fallbackSrc are binding-capable.
            // When either is a binding object, route it through bind so the
            // renderer resolves it into resolvedProps.alt / resolvedProps.fallbackSrc
            // (the serializer reads component.props.alt / component.props.fallbackSrc).
            const altBinding = p16Kind === "image" ? getBinding(component.alt, undefined) : undefined;
            if (altBinding) {
                bind.alt = altBinding;
            }
            const fallbackSrcBinding = p16Kind === "image" ? getBinding(component.fallbackSrc, undefined) : undefined;
            if (fallbackSrcBinding) {
                bind.fallbackSrc = fallbackSrcBinding;
            }

            return {
                id: component.id,
                kind: p16Kind,
                mount: component.mount || component.parent,
                order: resolveOrder(component),
                // P172 (ADR 0015): `visible` base field — when a binding object is
                // stored, it becomes the ComponentDefinition's `visibleIf` field so
                // the renderer's matchesCondition() can gate rendering on it.
                ...(visibleBinding ? { visibleIf: visibleBinding } : {}),
                bind,
                props: {
                    // P97/P98: For checkbox and datepicker, label may be a binding object — when so
                    // it goes through bind.label; only put it in props when it is a plain string
                    // (or for other nodes that don't support label bindings).
                    ...(component.label !== undefined && !(labelBinding) ? { label: component.label } : {}),
                    // P133: placeholder/options bound objects go through bind (above);
                    // only a plain/literal value stays in props.
                    ...(component.placeholder !== undefined && !(placeholderBinding) ? { placeholder: component.placeholder } : {}),
                    ...(component.options !== undefined && !(optionsBinding) ? { options: component.options } : {}),
                    ...(component.multiple !== undefined ? { multiple: component.multiple } : {}),
                    ...(component.rows !== undefined ? { rows: component.rows } : {}),
                    // P229 (ADR 0038): ui-textarea `lines` (renamed from the
                    // overloaded `rows`) still rides as props.rows — that is the
                    // component-prop/serializer surface backing the native
                    // sl-textarea `rows` attribute (the measured height).
                    ...(component.lines !== undefined ? { rows: component.lines } : {}),
                    ...(component.maxLength !== undefined ? { maxLength: component.maxLength } : {}),
                    ...(component.min !== undefined ? { min: component.min } : {}),
                    ...(component.max !== undefined ? { max: component.max } : {}),
                    ...(component.step !== undefined ? { step: component.step } : {}),
                    ...(component.showValue !== undefined ? { showValue: component.showValue } : {}),
                    // P73: ui-switch labelOn/labelOff and ui-datepicker mode were in mapConfig
                    // but omitted from the props block, so the serializer never received them.
                    // P147: labelOn/labelOff are now binding-capable — only pass plain strings
                    // through props; binding objects route through bind.labelOn/labelOff above.
                    ...(component.labelOn !== undefined && !labelOnBinding ? { labelOn: component.labelOn } : {}),
                    ...(component.labelOff !== undefined && !labelOffBinding ? { labelOff: component.labelOff } : {}),
                    ...(component.mode !== undefined ? { mode: component.mode } : {}),
                    ...(component.severity !== undefined ? { severity: component.severity } : {}),
                    // P67: ui-alert title is a binding routed through bind.title;
                    // other nodes may still carry a plain-string title prop.
                    ...(component.title !== undefined && !(component.title && typeof component.title === "object" && typeof component.title.kind === "string") ? { title: component.title } : {}),
                    ...(component.dismissible !== undefined ? { dismissible: component.dismissible } : {}),
                    ...(component.message !== undefined ? { message: component.message } : {}),
                    ...(component.variant !== undefined ? { variant: component.variant } : {}),
                    // P92: pulsating → Shoelace `pulse` boolean attribute on sl-badge.
                    ...(component.pulsating !== undefined ? { pulsating: component.pulsating } : {}),
                    // P49: display type (progress/skeleton/badge/menu/list render mode).
                    ...(component.displayType !== undefined ? { displayType: component.displayType } : {}),
                    // P241: ui-skeleton line/row count — drives the number of
                    // placeholder text lines (displayType text) and table rows
                    // (displayType table, `lines` rows × 3 columns).
                    ...(component.lines !== undefined ? { lines: component.lines } : {}),
                    // P180: ui-list ordered flag (ul↔ol). Mirrors displayType: copied
                    // into component.props so the serializer can read props.ordered.
                    ...(component.ordered !== undefined ? { ordered: component.ordered } : {}),
                    // P171: ui-list node-wide value display + badge colour role.
                    ...(component.displayValue !== undefined ? { displayValue: component.displayValue } : {}),
                    ...(component.badgeVariant !== undefined ? { badgeVariant: component.badgeVariant } : {}),
                    // P208: ui-list item-field mapping → props so the serializer reads
                    // row[labelField]/row[idField]/row[valueField]/row[iconField]. Absent
                    // → the serializer's own defaults (label/value/id/icon) apply.
                    ...(component.labelField !== undefined ? { labelField: component.labelField } : {}),
                    ...(component.valueField !== undefined ? { valueField: component.valueField } : {}),
                    ...(component.idField !== undefined ? { idField: component.idField } : {}),
                    ...(component.iconField !== undefined ? { iconField: component.iconField } : {}),
                    // P173: single-select switch (plain boolean). `selectedId` only goes
                    // into props as a STATIC fallback when no binding resolved (a binding
                    // routes through bind.selectedId → resolvedProps.selectedId above).
                    ...(component.selectable !== undefined ? { selectable: component.selectable } : {}),
                    ...(component.selectedId !== undefined && !selectedIdBinding ? { selectedId: component.selectedId } : {}),
                    // P157/P171: a menu/list `items` BINDING object routes through
                    // bind.items (resolved structurally by the renderer); only a plain
                    // static array stays in props.items. Other kinds (breadcrumb) keep
                    // their existing items-in-props behaviour.
                    ...(component.items !== undefined && !menuItemsBinding && !listItemsBinding ? { items: component.items } : {}),
                    // P248: ui-breadcrumb `separator` string — a non-empty value is
                    // slotted into slot="separator" by the serializer (static-items
                    // modes a & b), overriding Shoelace's native "/". Previously this
                    // field reached the definition but was dropped here, so it was
                    // inert. In layout="breadcrumb" mode the separator comes from a
                    // child node in the "separator" region instead (mutually exclusive).
                    ...(component.separator !== undefined ? { separator: component.separator } : {}),
                    ...(component.sections !== undefined ? { sections: component.sections } : {}),
                    ...(component.tabs !== undefined ? { tabs: component.tabs } : {}),
                    ...(component.orientation !== undefined ? { orientation: component.orientation } : {}),
                    // P45: composite and layout node props
                    ...(component.steps !== undefined ? { steps: component.steps } : {}),
                    ...(component.page !== undefined ? { page: component.page } : {}),
                    // P252: ui-pagination `showInfo` boolean → props.showInfo; the
                    // serializer emits the `.webapp-pagination-info` region when true.
                    ...(component.showInfo !== undefined ? { showInfo: component.showInfo } : {}),
                    // P154: when `total`/`totalPages` is a binding it routes through
                    // bind.totalPages (resolved by the renderer); only a plain literal
                    // value stays in props as a static fallback.
                    ...(component.totalPages !== undefined && !totalPagesBinding ? { totalPages: component.totalPages } : {}),
                    // P156 (ADR 0012): when `activeStep` is a binding it routes through
                    // bind.value (resolved by the renderer into component.value); only a
                    // plain literal index stays in props as a static fallback so the
                    // serializer's Number(activeStep) does not see a binding object.
                    ...(component.activeStep !== undefined && !activeStepBinding ? { activeStep: component.activeStep } : {}),
                    // Store domain-specific events (itemClick, change, etc.) in props
                    // so they reach the serializer without failing Zod event-name validation.
                    ...(Array.isArray(component.events) && component.events.length > 0 ? { componentEvents: component.events } : {}),
                    // P57: ui-log config props
                    ...(component.minSeverity !== undefined ? { minSeverity: component.minSeverity } : {}),
                    ...(component.maxEntries !== undefined ? { maxEntries: component.maxEntries } : {}),
                    ...(component.collapsed !== undefined ? { collapsed: component.collapsed } : {}),
                    // P69: icon literal + ui-icon display props (size/color).
                    ...(component.icon !== undefined && !iconBinding ? { icon: component.icon } : {}),
                    ...(component.size !== undefined ? { size: component.size } : {}),
                    // P172: when color is a binding it routes through bind.color (resolved by
                    // the renderer into resolvedProps.color); only a plain literal value stays
                    // in props. For nodes without colorBinding (not list), pass through as before.
                    ...(component.color !== undefined && !colorBinding ? { color: component.color } : {}),
                    // P93: ui-avatar shape and initials props.
                    // P94: initials is now a binding — routed through bind.initials so the
                    // renderer resolves it. A plain string (back-compat pre-P94) is passed
                    // directly only when no binding was found (initialsBinding would be falsy).
                    // shape is passed directly (circle|square).
                    ...(component.shape !== undefined ? { shape: component.shape } : {}),
                    ...(!initialsBinding && typeof component.initials === "string" && component.initials ? { initials: component.initials } : {}),
                    // P70: ui-image display props. A raw (unresolved) src binding
                    // is kept in props.src so the serializer can fall back to it
                    // when no value binding resolved (mirrors avatar).
                    ...(component.src !== undefined && !srcBinding ? { src: component.src } : {}),
                    // alt is used by ui-image; for ui-avatar it was removed in P93
                    // (sl-avatar uses `label` for a11y). The avatar serializer block
                    // never emits alt= even when this prop is set.
                    // P151: when alt is a binding object it routes through bind.alt;
                    // only a plain string stays in props as a static literal.
                    ...(component.alt !== undefined && !altBinding ? { alt: component.alt } : {}),
                    ...(component.fit !== undefined ? { fit: component.fit } : {}),
                    ...(component.width !== undefined ? { width: component.width } : {}),
                    ...(component.height !== undefined ? { height: component.height } : {}),
                    // P151: when fallbackSrc is a binding it routes through bind.fallbackSrc;
                    // only a plain string stays in props as a static literal.
                    ...(component.fallbackSrc !== undefined && !fallbackSrcBinding ? { fallbackSrc: component.fallbackSrc } : {}),
                    // P91: ui-alert duration + countdown — auto-hide and countdown
                    // progress bar. These are mapped by mapConfig but were missing from
                    // the props block, so the serializer never received them.
                    ...(component.duration !== undefined ? { duration: component.duration } : {}),
                    ...(component.countdown !== undefined ? { countdown: component.countdown } : {})
                },
                events: []
            };
        }

        return {
            id: component.id,
            kind: "text",
            mount: component.mount || component.parent,
            order: resolveOrder(component),
            bind: {
                value: literalBinding(component.id)
            },
            props: {},
            events: []
        };
    })
    // P224 (ADR 0037): normalise every compiled component's dynamic-state fields
    // so an UNBOUND `visible`/`disabled` reads from its internal per-client slot
    // (bound fields stay reactive from their source). Applied as a single
    // post-pass so every per-type branch above is covered uniformly.
    .map(applyDynamicStateSlots);
}

function getAppModelResult(appId, definitions) {
    const buckets = getDefinitionBuckets(appId, definitions);

    if (!buckets.app) {
        return {
            success: false,
            status: 404,
            message: `Unknown app '${appId}'.`
        };
    }

    const referencedLayoutIds = new Set([
        buckets.app.layout,
        ...buckets.routes.map((route) => route.layout || route.layoutId),
        ...buckets.dialogs.map((dialog) => dialog.layout || dialog.layoutId),
        ...buckets.components.filter((component) => component.type === "ui-container").map((component) => component.layout || component.layoutId)
        // ADR 0025: ui-repeat no longer registers a layout — it is transparent.
    ]);
    const standardLayouts = collectMissingStandardLayouts(
        referencedLayoutIds,
        []
    );
    const routes = buckets.routes.slice();

    if (!routes.some((route) => route.path === "/") && !routes.some((route) => route.id === buckets.app.id)) {
        // P109: use `name` (was `title`) for the implicit root route's title.
        routes.push(createAppRootRoute(buckets.app.id, blankToUndefined(buckets.app.name), buckets.app.layout));
    }

    const modelCandidate = {
        id: buckets.app.id,
        // P109: `name` replaces `title` in the AppModel.
        name: buckets.app.name,
        layouts: [...standardLayouts]
            .map((layout) => ({
                id: layout.id,
                title: blankToUndefined(layout.title),
                slots: layout.slots
            }))
            .sort((left, right) => left.id.localeCompare(right.id)),
        routes: routes
            .map((route) => ({
                id: route.id,
                path: route.path,
                title: blankToUndefined(route.title),
                layoutId: route.layout || route.layoutId
            }))
            .sort((left, right) => left.path.localeCompare(right.path)),
        dialogs: buckets.dialogs
            .map((dialog) => ({
                id: dialog.id,
                title: blankToUndefined(dialog.title),
                layoutId: dialog.layout || dialog.layoutId,
                routeId: blankToUndefined(dialog.routeId),
                modal: dialog.modal !== false,
                // P64: closable defaults to true (only false when explicitly set).
                closable: dialog.closable !== false
            }))
            .sort((left, right) => left.id.localeCompare(right.id)),
        components: toComponentDefinitions(migrateLegacyAccordionComponents(migrateLegacyTabComponents(buckets.components)))
    };

    const validation = appModelSchema.safeParse(modelCandidate);

    if (!validation.success) {
        const messages = validation.error.issues.map((issue) => issue.message).join("; ");
        return {
            success: false,
            status: 409,
            message: messages || `App '${appId}' is incomplete.`
        };
    }

    return {
        success: true,
        model: validation.data
    };
}

function getLayout(model, layoutId) {
    return model.layouts.find((layout) => layout.id === layoutId);
}

function resolveBinding(binding, sources) {
    if (!binding) {
        return undefined;
    }

    let resolved;

    if (binding.kind === "literal") {
        resolved = binding.value;
    }
    else if (binding.kind === "state") {
        resolved = getValueAtPath(sources.state, binding.path);
    }
    else if (binding.kind === "query") {
        resolved = getValueAtPath(sources.queries, binding.path);
    }
    else if (binding.kind === "routeParam") {
        resolved = sources.params[binding.path];
    }
    else if (binding.kind === "msg") {
        resolved = getValueAtPath(sources.msg, binding.path);
    }
    else if (binding.kind === "flow") {
        resolved = sources.flowContext ? sources.flowContext.get(binding.path) : undefined;
    }
    else if (binding.kind === "global") {
        resolved = sources.globalContext ? sources.globalContext.get(binding.path) : undefined;
    }
    else if (binding.kind === "env") {
        resolved = sources.env ? sources.env[binding.path] : undefined;
    }
    else if (binding.kind === "jsonata") {
        // JSONata expressions are evaluated at render time when a JSONata evaluator is provided.
        resolved = sources.jsonata ? sources.jsonata(binding.path, sources) : undefined;
    }

    return resolved === undefined ? binding.fallback : resolved;
}

// P26: snapshot → Shoelace markup serialization is delegated to the shared
// module (resources/lib/webapp-serializer.js) so the server and the thin client
// emit byte-identical markup. The local wrappers preserve the existing call
// sites / __test__ exports while the single source of truth lives in one file.
const sanitizeClassSuffix = sharedSerializer.sanitizeClassSuffix;
const getLayoutVariant = sharedSerializer.getLayoutVariant;
const regionContainsInput = sharedSerializer.regionContainsInput;

function renderLayoutHtml(layoutId, regions, serializerContext) {
    return sharedSerializer.renderLayoutHtml(layoutId, regions, serializerContext);
}

function renderRegionHtml(region, layoutId, serializerContext) {
    return sharedSerializer.renderRegionHtml(region, layoutId, serializerContext);
}

function renderComponentHtml(component, layoutId, serializerContext) {
    return sharedSerializer.renderComponentHtml(component, layoutId, serializerContext);
}

function defaultRouteLocation(model) {
    const firstRoute = model.routes.find((route) => route.path && route.path !== "*");
    return firstRoute ? firstRoute.path : "/";
}

// P30: walk a rendered snapshot's region tree for a table component by id so a
// rowSelect / rowAction event can carry the full `row` object (events.md params),
// resolved read-only from the current render — never from a runtime data store.
function findSnapshotComponent(regions, componentId) {
    if (!Array.isArray(regions)) {
        return undefined;
    }
    for (const region of regions) {
        for (const component of region.components || []) {
            if (component.id === componentId) {
                return component;
            }
            if (component.kind === "container") {
                const nested = findSnapshotComponent(component.regions, componentId);
                if (nested) {
                    return nested;
                }
            }
        }
    }
    return undefined;
}

function resolveTableRow(appId, location, tableId, rowId, definitions) {
    const built = buildAppSnapshot(appId, location || "/", undefined, definitions);
    if (!built.success || !built.snapshot) {
        return undefined;
    }
    const table = findSnapshotComponent(built.snapshot.regions, tableId);
    const rows = table && Array.isArray(table.rows) ? table.rows : [];
    return rows.find((row) => row && row.id !== undefined && String(row.id) === String(rowId));
}

// P30: ingest a RAW client event and emit it on the ORIGINATING node's output
// port. The browser reports WHAT HAPPENED ({appId, clientId, event, sourceId,
// params}); it never names or runs an action. There is no automatic event→action
// link — the runtime takes NO domain action here. The wired Node-RED flow is the
// only place that may react. See docs/nodes/concepts/events.md.
// P203/P204 (ADR 0027): the input controls that carry a `writeTo` write-back.
// Text-like controls (ui-input, ui-textarea, and ui-datepicker in text mode)
// honour the `writeTrigger` (submit=Enter/blur | change); the non-text controls
// (checkbox/switch/select/radio/slider) have no submit gesture and persist on
// `change` regardless of the trigger setting.
const WRITE_BACK_INPUT_TYPES = new Set([
    "ui-input",
    "ui-textarea",
    "ui-datepicker",
    "ui-select",
    "ui-checkbox",
    "ui-switch",
    "ui-radio",
    "ui-slider"
]);

// The controls that DO offer a submit gesture — the only ones for which a
// `writeTrigger=submit` means "write on submit, not on change". Every other
// control has no submit gesture, so a `submit` setting effectively falls back to
// writing on `change` (never "never writes").
const WRITE_BACK_TEXT_LIKE_TYPES = new Set(["ui-input", "ui-textarea", "ui-datepicker"]);

// P203 (ADR 0027): the runtime WRITE-BACK. On an input's writeTrigger event
// (change|submit, default submit) persist the field's current value into the
// node's `writeTo` target. This is ADDITIVE — it runs alongside the normal
// output-port event emission and never replaces it.
//   - store  → a per-client op:set at the store's statePath + optional literal
//     subPath, carrying clientId, then a fresh SSE snapshot push (real two-way).
//   - flow / global → Node-RED flow/global context, server-side, no per-client
//     scope and no auto re-render (documented ADR 0027 boundary).
// Returns silently on any misconfiguration (unknown store, non-writable kind);
// the write-back must never break the primary event path.
function applyInputWriteBack(RED, appId, node, params, clientId, definitions) {
    const def = node && node.webappDefinition;
    // P203/P204 (ADR 0027): write-back is uniform across all input controls.
    if (!def || !WRITE_BACK_INPUT_TYPES.has(def.type)) {
        return;
    }
    // P206 (ADR 0027 amendment): `writeTrigger="none"` disables the automatic
    // write-back ENTIRELY. Return BEFORE the submit-fallback mapping below — the
    // fallback (`=== "change" ? "change" : "submit"`) would otherwise subsume
    // `none` under `submit` and WRONGLY persist on submit. This is the P181/P202
    // "a new enum value falls into the default branch" trap, avoided explicitly.
    // Applies to text AND non-text controls alike: `none` means "never write".
    // The `change`/`submit` OUTPUT events still fire (emitted by the caller).
    if (def.writeTrigger === "none") {
        return;
    }

    const writeTo = def.writeTo;
    if (!writeTo || typeof writeTo !== "object" || typeof writeTo.kind !== "string") {
        return;
    }

    // The trigger gate: default submit. A `change`-triggered input writes on every
    // change event; a `submit`-triggered one only on submit. (Text controls emit
    // both change and submit; gating here keeps submit-mode from writing on change.)
    const trigger = def.writeTrigger === "change" ? "change" : "submit";
    // The value the user just entered — the same value the change/submit event
    // carried (params.value), or a boolean toggle (params.checked).
    const value = params && Object.prototype.hasOwnProperty.call(params, "value")
        ? params.value
        : (params && Object.prototype.hasOwnProperty.call(params, "checked") ? params.checked : undefined);

    if (writeTo.kind === "store") {
        const storeId = typeof writeTo.path === "string" ? writeTo.path : "";
        if (!storeId) {
            return;
        }
        const storeDefinition = Array.isArray(definitions)
            ? definitions.find((entry) => entry && entry.type === "ui-store" && entry.id === storeId)
            : undefined;
        if (!storeDefinition) {
            return;
        }
        // The optional one-level subPath. Only a LITERAL subPath is a stable write
        // key; a dynamic subPath cannot be resolved at write time here.
        let relPath;
        if (writeTo.subPath && typeof writeTo.subPath === "object" && writeTo.subPath.kind === "literal") {
            relPath = writeTo.subPath.value !== undefined && writeTo.subPath.value !== null
                ? String(writeTo.subPath.value)
                : "";
        }
        const operation = relPath
            ? { id: storeId, op: "set", path: relPath, value }
            : { id: storeId, op: "replace", value };

        const baseState = clientId
            ? (getClientState(appId, clientId)?.state
                || clone(runtimeState.liveState.get(appId) || initializeState([storeDefinition], [], appId)))
            : clone(runtimeState.liveState.get(appId) || initializeState([storeDefinition], [], appId));

        let applied;
        try {
            applied = applyStoreOperation(baseState, storeDefinition, operation);
        }
        catch (error) {
            if (RED && RED.log && RED.log.warn) {
                RED.log.warn(`[webapp] ${def.type} writeTo store failed (op=applyInputWriteBack): ${error instanceof Error ? error.message : String(error)}`);
            }
            return;
        }
        const now = Date.now();
        if (clientId) {
            setClientState(appId, clientId, applied.nextState, now);
        }
        else {
            runtimeState.liveState.set(appId, applied.nextState);
        }
        // P31: live push — the bound view(s) re-render from the mutated state.
        pushSnapshotToClients(appId, clientId, definitions);
        return;
    }

    if (writeTo.kind === "flow" || writeTo.kind === "global") {
        const key = typeof writeTo.path === "string" ? writeTo.path.trim() : "";
        if (!key || !node || typeof node.context !== "function") {
            return;
        }
        try {
            const ctx = node.context();
            const scoped = writeTo.kind === "flow" ? ctx.flow : ctx.global;
            if (scoped && typeof scoped.set === "function") {
                // Documented boundary: server-side context, no per-client scope and
                // no automatic SSE re-render.
                scoped.set(key, value);
            }
        }
        catch (error) {
            if (RED && RED.log && RED.log.warn) {
                RED.log.warn(`[webapp] ${def.type} writeTo ${writeTo.kind} failed (op=applyInputWriteBack): ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }
}

// P224 (ADR 0037): the UNIFIED write API for dynamic-state fields. Every writer
// (msg → P223, duration → P225, show/hide verbs → P226) converges here so a
// component's visibility/enabled is ONE value, however it is changed.
//
//   - BOUND to a store → write THROUGH into the bound store slice (scope-correct:
//     per-client when a clientId is present, else broadcast), keeping the store
//     the single source of truth; the change re-renders every store-bound view.
//   - BOUND to a bare state path → write that path in the same per-client /
//     broadcast state tree (the renderer reads it back via the `state` binding).
//   - BOUND to a read-only source (query/routeParam/reactive) → refused; that
//     value is computed, not settable.
//   - UNBOUND (literal/none/msg/…) → write the node's INTERNAL per-client slot
//     (`__dynamicState.<nodeId>.<field>`); a clientId scopes it to that client,
//     otherwise it is a broadcast default. Two clients are isolated because the
//     slot lives in each client's own per-client state entry.
//
// After the write a snapshot is pushed so the re-render shows the new value.
// Returns a small result (chiefly for tests): { ok, mode, clientId } or
// { ok:false, reason }.
function setDynamicStateField(nodeId, field, value, clientId) {
    if (!isDynamicStateFieldName(field)) {
        return { ok: false, reason: "not-a-dynamic-state-field" };
    }
    const registration = runtimeState.definitions.get(nodeId);
    if (!registration || !registration.definition) {
        return { ok: false, reason: "unknown-node" };
    }
    const RED = runtimeState.RED;
    const node = RED && RED.nodes && typeof RED.nodes.getNode === "function"
        ? RED.nodes.getNode(nodeId)
        : undefined;
    const appId = node ? findAppIdForNode(node) : getActiveRuntimeAppId();
    if (!appId) {
        return { ok: false, reason: "no-active-app" };
    }

    const binding = registration.definition[field];
    const coerced = coerceDynamicStateBoolean(value);
    const scopedClientId = clientId ? String(clientId) : undefined;

    // --- BOUND to a store: write THROUGH, scope-correct. ---
    if (binding && binding.kind === "store") {
        const storeDefinition = resolveStoreReferenceById(binding.path);
        if (!storeDefinition) {
            return { ok: false, reason: "unknown-store" };
        }
        // Scope guard mirrors the ui-store write path ("any" (default) never rejects).
        const scope = storeDefinition.scope;
        if (scope === "broadcast-only" && scopedClientId) {
            return { ok: false, reason: "scope-violation" };
        }
        if (scope === "client-only" && !scopedClientId) {
            return { ok: false, reason: "scope-violation" };
        }

        let relPath;
        if (binding.subPath && typeof binding.subPath === "object" && binding.subPath.kind === "literal") {
            relPath = binding.subPath.value !== undefined && binding.subPath.value !== null
                ? String(binding.subPath.value)
                : "";
        }
        const operation = relPath
            ? { id: storeDefinition.id, op: "set", path: relPath, value: coerced }
            : { id: storeDefinition.id, op: "replace", value: coerced };

        const baseState = scopedClientId
            ? (getClientState(appId, scopedClientId)?.state || clone(runtimeState.liveState.get(appId) || initializeState([storeDefinition], [], appId)))
            : clone(runtimeState.liveState.get(appId) || initializeState([storeDefinition], [], appId));
        let applied;
        try {
            applied = applyStoreOperation(baseState, storeDefinition, operation);
        }
        catch (error) {
            return { ok: false, reason: "store-op-failed", error };
        }
        const now = Date.now();
        if (scopedClientId) {
            setClientState(appId, scopedClientId, applied.nextState, now);
        }
        else {
            runtimeState.liveState.set(appId, applied.nextState);
        }
        if (RED) {
            pushSnapshotToClients(appId, scopedClientId, readDeployDefinitions(RED));
        }
        return { ok: true, mode: "store", clientId: scopedClientId };
    }

    // --- BOUND to a read-only computed source: cannot be set. ---
    if (isBoundDynamicStateBinding(binding) && binding.kind !== "state") {
        return { ok: false, reason: "read-only-bound" };
    }

    // --- BOUND to a bare state path (write it) OR UNBOUND (write the slot). ---
    const isStatePath = binding && binding.kind === "state" && typeof binding.path === "string" && binding.path;
    const targetPath = isStatePath ? binding.path : dynamicStateSlotPath(nodeId, field);
    const mode = isStatePath ? "state" : "slot";

    const baseState = scopedClientId
        ? (getClientState(appId, scopedClientId)?.state || clone(runtimeState.liveState.get(appId) || {}) || {})
        : (clone(runtimeState.liveState.get(appId) || {}) || {});
    const nextState = setValueAtPath(baseState, targetPath, coerced);
    const now = Date.now();
    if (scopedClientId) {
        setClientState(appId, scopedClientId, nextState, now);
    }
    else {
        runtimeState.liveState.set(appId, nextState);
    }
    if (RED) {
        pushSnapshotToClients(appId, scopedClientId, readDeployDefinitions(RED));
    }
    return { ok: true, mode, clientId: scopedClientId };
}

// P225 (ADR 0037): the browser-reachable dynamic-state write. A duration-driven
// auto-hide (and any other client-initiated dynamic-state change) POSTs
// `{ clientId, id, field, value }` to `/webapp/:appId/dynamic-state`; this routes
// it through the ONE unified write API (`setDynamicStateField`), so the value
// transition is identical whether it is driven by a flow message
// (`msg.ui.dynamicState`), a binding, or the browser. Bound → write-through to the
// store; unbound → the internal per-client slot (scoped by the reported clientId).
// The write already pushes a fresh snapshot; the alert is hidden because its
// visibility VALUE is now false — no client-side overlay, no `autoDismissed`.
function dispatchDynamicStateWrite(body) {
    const nodeId = body && body.id ? String(body.id) : undefined;
    const field = body && body.field ? String(body.field) : undefined;
    const clientId = body && body.clientId ? String(body.clientId) : undefined;

    if (!nodeId) {
        return { success: false, status: 400, body: "Missing id." };
    }
    if (!field) {
        return { success: false, status: 400, body: "Missing field." };
    }

    const result = setDynamicStateField(nodeId, field, body ? body.value : undefined, clientId);
    if (!result.ok) {
        // An unknown node / non-dynamic-state field is a bad request; a read-only
        // bound source or a scope violation is a conflict.
        const status = (result.reason === "unknown-node" || result.reason === "not-a-dynamic-state-field")
            ? 400
            : 409;
        return { success: false, status, body: result.reason, result };
    }
    return { success: true, result };
}

function dispatchClientEvent(RED, appId, body, definitions) {
    const sourceId = body && body.sourceId ? String(body.sourceId) : undefined;
    const event = body && body.event ? String(body.event) : undefined;

    if (!sourceId) {
        return { success: false, status: 400, body: "Missing sourceId." };
    }

    if (!event) {
        return { success: false, status: 400, body: "Missing event." };
    }

    const clientId = body && body.clientId ? String(body.clientId) : undefined;
    const location = body && body.location ? String(body.location) : "/";
    const params = body && body.params && typeof body.params === "object" ? { ...body.params } : {};

    // Enrich the documented table event with the full row object when only a
    // rowId was reported. This is a read-only render lookup, not a data action.
    if (event === "rowSelect" && params.rowId !== undefined && params.row === undefined) {
        const row = resolveTableRow(appId, location, sourceId, params.rowId, definitions);
        if (row !== undefined) {
            params.row = clone(row);
        }
    }

    const message = {
        ui: {
            appId,
            clientId,
            event,
            sourceId,
            params
        }
    };

    const node = RED && RED.nodes && typeof RED.nodes.getNode === "function"
        ? RED.nodes.getNode(sourceId)
        : undefined;

    if (!node || typeof node.send !== "function") {
        return { success: false, status: 404, body: `Unknown source node '${sourceId}'.` };
    }

    // P64: a ui-dialog dismissed natively (X / ESC / overlay → onClose) is the
    // authoritative close. Set ui.dialogs.<id>.open = false on the server and push
    // a fresh snapshot, so every client (incl. ones that did not click) reconciles
    // — there is NO wired close action any more. The client already removed its own
    // dialog optimistically; this makes the server state agree.
    const definitionType = node.webappDefinition ? node.webappDefinition.type : undefined;
    if (definitionType === "ui-dialog" && event === "onClose") {
        const subscribers = runtimeState.streamClients.get(appId);
        if (subscribers && subscribers.size > 0) {
            const targets = clientId
                ? (subscribers.has(clientId) ? [[clientId, subscribers.get(clientId)]] : [])
                : Array.from(subscribers.entries());
            writeDialogOpenState(appId, clientId, sourceId, false);
            pushSnapshotToTargets(appId, targets);
        }
    }

    // P203/P204 (ADR 0027): runtime write-back. Before (and independently of) the
    // output-port emission, if this is an input control with a `writeTo` target and
    // the event matches its trigger semantics, persist the current value into the
    // target. ADDITIVE — the output event below still fires.
    if (WRITE_BACK_INPUT_TYPES.has(definitionType)) {
        const isTextLike = WRITE_BACK_TEXT_LIKE_TYPES.has(definitionType);
        // P206 (ADR 0027 amendment): `none` disables auto write-back for EVERY
        // control (text and non-text). Skip the trigger mapping entirely so the
        // non-text `change` branch below cannot re-introduce a write. The output
        // events still fire further down — this only suppresses the write-back.
        const noWriteBack = node.webappDefinition && node.webappDefinition.writeTrigger === "none";
        const writeTrigger = node.webappDefinition && node.webappDefinition.writeTrigger === "change"
            ? "change"
            : "submit";
        let triggers;
        if (noWriteBack) {
            triggers = false;
        }
        else if (!isTextLike) {
            // P204: toggles/selects/slider/radio have NO submit gesture. A
            // `writeTrigger=submit` there must NOT mean "never writes" — they
            // persist on `change` regardless of the setting. (They only emit
            // `change`, never `submit`.)
            triggers = event === "change";
        }
        else {
            // Text-like (ui-input/ui-textarea/ui-datepicker): change-mode writes on
            // every change; submit-mode only on submit. (A text input emits both
            // `change` and `submit`; the submit-mode gate keeps it from also writing
            // on the intermediate change events.)
            triggers = writeTrigger === "change"
                ? (event === "change" || event === "submit")
                : event === "submit";
        }
        if (triggers) {
            applyInputWriteBack(RED, appId, node, params, clientId, definitions);
        }
    }

    // Emit on the originating node's OUTPUT port — into the wired flow. The
    // runtime does nothing else: no state mutation, no action dispatch.
    //
    // P64: positional out-port routing. A node with multiple configured events
    // exposes one output port per event (port index === events.indexOf(event)).
    // node.send was previously a bare object → ALWAYS port 0, so e.g. a ui-dialog
    // with events ["onOpen","onClose"] mis-emitted onClose on the onOpen port.
    // Build a sparse output array so the message lands on the matching port.
    const events = node.webappDefinition && Array.isArray(node.webappDefinition.events)
        ? node.webappDefinition.events
        : undefined;
    const portIndex = events ? events.indexOf(event) : -1;

    if (portIndex > 0) {
        const outputs = new Array(portIndex + 1).fill(null);
        outputs[portIndex] = clone(message);
        node.send(outputs);
    }
    else {
        // portIndex 0 (or no per-event ports / event not found) → port 0.
        node.send(clone(message));
    }

    return { success: true, message };
}

// Builds the RenderSnapshot for an app + location + open dialog.
// The HTML route, the SSE stream initial sync, and the /event response all use this.
function buildAppSnapshot(appId, location, dialogId, definitions, clientId) {
    const modelResult = getAppModelResult(appId, definitions);

    if (!modelResult.success) {
        return { success: false, status: modelResult.status, message: modelResult.message };
    }

    const { model } = modelResult;
    const routeMatch = getRouteMatch(location, model.routes);

    if (!routeMatch) {
        return { success: false, status: 404, message: `No route matched '${location}'.` };
    }

    const layout = getLayout(model, routeMatch.route.layoutId);

    if (!layout) {
        return { success: false, status: 500, message: "Missing layout." };
    }

    const buckets = getDefinitionBuckets(appId, definitions);
    const integration = {
        navigations: buckets.navigations.map((entry) => ({ id: entry.id, to: entry.to })),
        queries: buckets.queries,
        actions: buckets.actions,
        stores: buckets.stores
    };
    const state = initializeState(integration.stores, integration.queries, appId);
    // State layering (P15 multi-user model + P226 / ADR 0037):
    //   defaults ← broadcast (shared) ← per-client (override).
    // A per-client value still WINS (two-client isolation preserved), but a client
    // that has its own per-client state now also SEES a shared/broadcast value it
    // has NOT overridden. This is essential for ADR 0037's "Msg von außen": a
    // SERVER-triggered (client-less) dynamic-state / store write is a BROADCAST — it
    // lands in the shared state, and every client must observe it unless it holds
    // its own override for that exact key. Resolution is therefore
    // per-client-slot ?? broadcast-slot ?? default. (Previously a client WITH a
    // per-client entry saw ONLY that entry and never the broadcast layer, so a
    // broadcast write made after the entry was created stayed invisible to it.)
    const clientStateEntry = clientId ? getClientState(appId, clientId) : null;
    const broadcastState = runtimeState.liveState.get(appId);
    let hydratedState = state;
    if (broadcastState) {
        hydratedState = mergeDeep(hydratedState, broadcastState);
    }
    if (clientStateEntry) {
        hydratedState = mergeDeep(hydratedState, clientStateEntry.state);
    }
    const effectiveState = dialogId ? setValueAtPath(hydratedState, `ui.dialogs.${dialogId}.open`, true) : hydratedState;

    // P160: derive the renderer's `queries` (DATA tree keyed by queryPath) and
    // `queryLifecycle` ({ queryPath → {loading,error,updatedAt,status} }) from the
    // live `ui.queries.<queryPath>` envelopes held in state. This is the fix
    // behind "everything empty": before, `queries` was passed as `{}` and the
    // wired `msg.ui.query.data` push never reached a `query:`-bound view.
    const { queries, queryLifecycle } = buildQuerySources(effectiveState, integration.queries);

    // P21: a single RenderSnapshot from packages/renderer is the source of truth.
    // webapp.js no longer re-walks the AppModel — it only serializes this snapshot.
    const rendererApp = createRendererApp(model, {
        integration,
        location,
        state: effectiveState,
        queries,
        queryLifecycle,
        // P115 (ADR 0010): a failed `reactive` expression never breaks the
        // snapshot; it is reported once per distinct error through the existing
        // error-forwarding/logging pipeline (ADR 0006 / P55–P56). The renderer
        // dedups within its (per-build) instance; webapp.js dedups ACROSS builds
        // per appId (runtimeState.reactiveErrorKeys) so a broken expression is
        // reported once per page, not once per snapshot build.
        onReactiveError: (error) => {
            let reportedKeys = runtimeState.reactiveErrorKeys.get(appId);
            if (!reportedKeys) {
                reportedKeys = new Set();
                runtimeState.reactiveErrorKeys.set(appId, reportedKeys);
            }
            const dedupKey = error.key || `${error.source} ${error.message}`;
            if (reportedKeys.has(dedupKey)) {
                return;
            }
            reportedKeys.add(dedupKey);
            // ADR 0032: attribute the failure to the offending node. If the renderer
            // supplied a nodeId, resolve the live node so the error is logged/warned
            // ON it (and, later, a Catch node can react — deferred) and its status
            // badge shows the problem. Store sub-path config problems are `warn`
            // (non-fatal); a general reactive-expression failure stays `error`.
            const RED = runtimeState.RED;
            const offendingNode = error.nodeId && RED && RED.nodes && typeof RED.nodes.getNode === "function"
                ? RED.nodes.getNode(error.nodeId)
                : undefined;
            const severity = error.severity === "warn" ? "warn" : "error";
            if (offendingNode && typeof offendingNode.status === "function") {
                offendingNode.status({
                    fill: severity === "warn" ? "yellow" : "red",
                    shape: severity === "warn" ? "ring" : "dot",
                    text: reactiveStatusText(error.message)
                });
            }
            reportRuntimeError(offendingNode, {
                severity,
                code: "reactive_expression_failed",
                message: `Reactive expression failed: ${error.message}`,
                context: { appId, nodeId: error.nodeId, expression: error.source },
                clientId
            });
        }
    });

    return {
        success: true,
        status: 200,
        model,
        routeMatch,
        layout,
        appLayout: buckets.app ? buckets.app.layout : undefined,
        tokens: parseTokens(buckets.app && buckets.app.tokens),
        // P70: app-level media store URL (used only to gate asset:<id> rewriting;
        // the URL itself stays server-side).
        mediaStoreUrl: buckets.app ? buckets.app.mediaStoreUrl : undefined,
        snapshot: rendererApp.render()
    };
}

function renderAppPage(appId, location, dialogId, definitions) {
    const built = buildAppSnapshot(appId, location, dialogId, definitions);

    if (!built.success) {
        const heading = built.status === 404 ? "Unknown route" : built.status === 500 ? "Missing layout" : "Incomplete app";
        return {
            status: built.status,
            body: `<!doctype html><html><body><h1>${heading}</h1><p>${escapeHtml(built.message)}</p></body></html>`
        };
    }

    const { model, routeMatch, snapshot, tokens, appLayout } = built;
    // P106: bake the shell/topology signature + deploy mode into the page so the
    // hydrated client knows its baseline. On a later deploy push (or a /snapshot
    // re-focus pull) the client compares the incoming signature against this one
    // to decide in-place apply vs full reload, and reads the mode to decide
    // auto-update (development) vs version-alert (production).
    const shellSignature = computeShellSignature(appId, definitions);
    const deployMode = resolveAppMode(appId, definitions);
    // P23: design tokens → CSS custom properties (consumed natively by the Web
    // Components) plus the --wa-* → --sl-* bridge so Shoelace is themed without
    // per-token translation. Unset tokens fall back to the defaults below.
    const tokenCss = buildDesignTokenCss(tokens);
    const shoelaceBridgeCss = buildShoelaceTokenBridgeCss();
    // P69: register any additional (non-default) icon libraries on the client via
    // Shoelace's registerIconLibrary(). The %AUTOLOADER_DIR% placeholder resolves
    // to the vendored Shoelace utilities path so registerIconLibrary imports
    // locally (no CDN — ADR 0008). Empty when only the default library exists.
    const iconLibraryRegistrationHtml = iconLibrary
        .buildIconLibraryRegistrationScript()
        .replace(/%AUTOLOADER_DIR%/g, SHOELACE_LOCAL_BASE);
    const serializerContext = {
        appId: model.id,
        location: snapshot.location,
        params: snapshot.params,
        formId: undefined,
        // P70: presence of a media store enables `asset:<id>` src rewriting to the
        // app-scoped backend proxy URL. The real store URL is never exposed here.
        mediaStoreUrl: built.mediaStoreUrl
    };

    // P26: dialogs are serialized through the shared module so the server and the
    // thin client emit identical markup. P64: each dialog renders as a native
    // <sl-dialog> whose X / ESC / overlay dismissal is handled client-side — no
    // hard-coded or wired close action.
    const dialogHtml = snapshot.dialogs
        .map((dialog) => sharedSerializer.renderDialogHtml(dialog, serializerContext))
        .join("");
    // The app-bar is a GLOBAL chrome element — it follows the ui-app node's
    // layout field, not the current route's layoutId. This means the app-bar
    // persists across all routes in the same app, regardless of their individual
    // layout presets.
    const isAppLayout = appLayout === "app";
    const pageBody = renderLayoutHtml(snapshot.layout.id, snapshot.regions, serializerContext);

    // P36: for the `app` layout preset, prepend a branded top app bar.
    // P109: Header-Slot semantics — if the `header` slot has ≥1 mounted component,
    // the slot content (already in pageBody) takes precedence and no `name` title
    // is shown in the app-bar. If the header slot is empty, the app's `name` is
    // rendered as the title inside the app-bar.
    const headerRegion = isAppLayout
        ? snapshot.regions.find((region) => region.name === "header")
        : undefined;
    const headerHasChildren = headerRegion && headerRegion.components.length > 0;
    const appBarHtml = isAppLayout
        ? headerHasChildren
            ? `<header class="webapp-app-bar"></header>`
            : `<header class="webapp-app-bar"><span class="webapp-app-bar-title">${escapeHtml(model.name || model.id)}</span></header>`
        : "";

    return {
        status: 200,
        body: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(model.name)} - ${escapeHtml(routeMatch.route.title || routeMatch.route.id)}</title>
  <link rel="stylesheet" href="${SHOELACE_THEME_HREF}">
  <script type="module" src="${SHOELACE_AUTOLOADER_SRC}"></script>
${iconLibraryRegistrationHtml}
  <style>
    /* P24: webapp-default design tokens. User tokens on ui-app (below) override
       these; the Web Components consume them natively as CSS custom properties. */
    :root {
      color-scheme: light;
      --wa-color-primary:#3b82f6; --wa-color-primary-fg:#ffffff;
      --wa-color-danger:#ef4444; --wa-color-danger-fg:#ffffff;
      --wa-color-success:#22c55e; --wa-color-warning:#f59e0b;
      --wa-color-neutral:#6b7280; --wa-color-background:#ffffff;
      --wa-color-surface:#f9fafb; --wa-color-border:#e5e7eb;
      --wa-color-text:#111827; --wa-color-text-muted:#6b7280;
      --wa-font-family:system-ui, sans-serif; --wa-font-size-base:16px;
      --wa-radius-md:6px;
    }
    /* P23: --wa-* → --sl-* bridge (Shoelace themed via the same tokens).
       P62: the bridge falls back to literal Shoelace defaults when a --wa-*
       token is unset, so the :root above need NOT define every --wa-* token
       (e.g. --wa-spacing-unit, --wa-font-weight-*, --wa-line-height-base,
       --wa-radius-sm/lg/full). They are intentionally omitted — correctness no
       longer depends on them, and the bridge restores the real Shoelace value. */
${shoelaceBridgeCss.split("\n").map((line) => `    ${line}`).join("\n")}
    /* P24: user-defined ui-app tokens (highest precedence). */
${tokenCss ? tokenCss.split("\n").map((line) => `    ${line}`).join("\n") : "    /* (no app tokens set) */"}
    * { box-sizing:border-box; }
    body { margin:0; font-family:var(--wa-font-family); font-size:var(--wa-font-size-base); color:var(--wa-color-text); background:var(--wa-color-background); }
    a { color:inherit; text-decoration:none; }
    /* P36: non-app layouts are constrained; the app-layout shell fills the viewport */
    #webapp-client-root { max-width:1100px; margin:0 auto; padding:24px 20px 60px; }
    #webapp-client-root.webapp-is-app-layout { max-width:none; padding:0; display:flex; flex-direction:column; min-height:100vh; }
    .webapp-grid { display:grid; gap:16px; }
    /* P36: for app layout the grid wrapper is a pass-through flex container */
    .webapp-is-app-layout .webapp-grid { display:contents; }
    .webapp-layout { display:grid; gap:16px; }
    /* P36: app-layout shell — mobile-first stacked; desktop: sidebar + content */
    .webapp-layout--app { display:flex; flex-direction:column; gap:0; min-height:0; flex:1; }
    /* P36: app bar — themed via --wa-color-primary token, no hard-coded color */
    .webapp-app-bar { display:flex; align-items:center; gap:12px; padding:0 20px; height:56px; background:var(--wa-color-primary); color:var(--wa-color-primary-fg); flex-shrink:0; }
    .webapp-app-bar-title { font-size:1.1rem; font-weight:600; letter-spacing:0.01em; flex:1; }
    /* P36: slot regions — frameless; structure from whitespace and type hierarchy */
    .webapp-slot { padding:0; }
    .webapp-slot--header { padding:16px 20px; }
    .webapp-slot--navbar { padding:12px 0; }
    .webapp-slot--content { flex:1; padding:20px; min-width:0; }
    .webapp-slot--footer { padding:12px 20px; border-top:1px solid var(--wa-color-border); }
    .webapp-slot-body { gap:12px; }
    .webapp-slot-body--vertical, .webapp-slot-body--app, .webapp-slot-body--custom { display:flex; flex-direction:column; }
    .webapp-slot-body--horizontal { display:flex; flex-direction:row; align-items:flex-start; flex-wrap:wrap; }
    .webapp-slot-body--horizontal > * { flex:1 1 220px; min-width:0; }
    .webapp-slot-body--grid { display:grid; grid-template-columns:repeat(12, minmax(0, 1fr)); gap:12px; }
    .webapp-slot-body--absolute { position:relative; min-height:320px; }
    .webapp-item--absolute { position:absolute; }
    /* P251: ui-stepper orientation — the variant (horizontal/vertical) renders the
       webapp-stepper--orientation class; give it an observable layout effect so the
       step buttons lay out along the matching axis (row vs column). */
    .webapp-stepper { display:flex; gap:8px; }
    .webapp-stepper--horizontal { flex-direction:row; align-items:center; flex-wrap:wrap; }
    .webapp-stepper--vertical { flex-direction:column; align-items:stretch; }
    /* P36: navbar — frameless stacked nav links; active state via color */
    .webapp-nav-list { display:flex; flex-direction:column; gap:0; list-style:none; margin:0; padding:0; }
    .webapp-nav-item a, .webapp-nav-link { display:block; padding:10px 20px; font-size:0.95rem; font-weight:500; color:var(--wa-color-text); text-decoration:none; transition:color 0.15s, background 0.15s; }
    .webapp-nav-item a:hover, .webapp-nav-link:hover { color:var(--wa-color-primary); background:color-mix(in srgb, var(--wa-color-primary) 8%, transparent); }
    .webapp-nav-item[aria-current="page"] a, .webapp-nav-link[aria-current="page"] { color:var(--wa-color-primary); font-weight:600; border-left:3px solid var(--wa-color-primary); padding-left:17px; }
    /* P36: buttons inside the navbar slot render as plain nav-style links, not pill buttons */
    .webapp-slot--navbar sl-button::part(base) { border:none; background:transparent; border-radius:0; width:100%; justify-content:flex-start; padding:10px 20px; font-size:0.95rem; font-weight:500; color:var(--wa-color-text); box-shadow:none; }
    .webapp-slot--navbar sl-button::part(base):hover { color:var(--wa-color-primary); background:color-mix(in srgb, var(--wa-color-primary) 8%, transparent); }
    /* ADR 0025: navbar items span full width — match both the placement wrapper
       (.webapp-item) and a now-unwrapped plain leaf (direct child of the slot body). */
    .webapp-slot--navbar .webapp-item,
    .webapp-slot--navbar .webapp-slot-body > [data-webapp-node] { width:100%; }
    /* P111: ui-text typography. The 'style' (role) drives size/weight/family via
       the webapp-text--<role> class; 'variant' (colour) via webapp-text--color-<c>.
       Margins are reset so headings don't disturb the slot layout. */
    .webapp-text { margin:0; font-size:1rem; line-height:1.5; }
    .webapp-text--heading-1 { font-size:1.875rem; font-weight:700; line-height:1.2; }
    .webapp-text--heading-2 { font-size:1.5rem; font-weight:600; line-height:1.25; }
    .webapp-text--heading-3 { font-size:1.25rem; font-weight:600; line-height:1.3; }
    .webapp-text--body { font-size:1rem; }
    .webapp-text--caption { font-size:0.8125rem; color:var(--wa-color-text-muted); }
    .webapp-text--label { font-size:0.875rem; font-weight:600; }
    .webapp-text--code { font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size:0.875rem; background:var(--wa-color-surface); padding:0.1em 0.35em; border-radius:var(--wa-radius-sm, 4px); }
    /* P111: semantic colour variants (default inherits --wa-color-text) */
    .webapp-text--color-muted { color:var(--wa-color-text-muted); }
    .webapp-text--color-primary { color:var(--wa-color-primary); }
    .webapp-text--color-success { color:var(--wa-color-success); }
    .webapp-text--color-warning { color:var(--wa-color-warning); }
    .webapp-text--color-danger { color:var(--wa-color-danger); }
    .webapp-text--color-neutral { color:var(--wa-color-neutral); }
    .webapp-table { width:100%; border-collapse:collapse; background:var(--wa-color-surface); border-radius:var(--wa-radius-md); overflow:hidden; }
    .webapp-table th, .webapp-table td { padding:10px 12px; border-bottom:1px solid var(--wa-color-border); text-align:left; }
    .webapp-form { display:grid; gap:10px; }
    .webapp-field { display:grid; gap:6px; color:var(--wa-color-text-muted); font-size:0.95rem; }
    .webapp-container { display:grid; gap:12px; }
    /* P198: semantic container variants. card=sl-card (default, unchanged).
       panel/section/transparent are plain <div>s — CSS provides the distinction.
       Uses --wa-color-* tokens so both light and dark themes are covered. */
    /* panel: lightweight bordered block, moderate padding, NO card elevation */
    .webapp-container--panel {
      border:1px solid var(--wa-color-border);
      border-radius:var(--wa-radius-md);
      padding:16px;
      background:var(--wa-color-surface);
    }
    /* section: no border/background, vertical breathing room only */
    .webapp-container--section {
      padding:16px 0;
    }
    /* transparent: pure layout grouping — no box chrome whatsoever */
    .webapp-container--transparent {
      padding:0;
      background:none;
      border:none;
    }
    /* P199: span — inline text composition; ALL descendants (wrapper divs, layout,
       slot, and text block elements) must be inline so content flows in one text run. */
    .webapp-container--span { display:inline; }
    .webapp-container--span .webapp-layout,
    .webapp-container--span .webapp-slot,
    .webapp-container--span .webapp-slot-body,
    .webapp-container--span .webapp-item,
    .webapp-container--span .webapp-text { display:inline; margin:0; padding:0; gap:0; }
    /* P64: dialogs are native <sl-dialog> (own overlay, backdrop, focus-trap).
       Only the slotted region wrappers need light layout; the footer lays its
       actions out in a row. */
    .webapp-dialog-region { display:grid; gap:10px; }
    .webapp-dialog-region--footer { display:flex; justify-content:flex-end; gap:8px; }
    .webapp-link { color:var(--wa-color-primary); font-weight:700; }
    /* P183: ui-list visual design — row anatomy, displayType intents, color resolution.
       Scoped to .webapp-list / .webapp-list-item so it never leaks to nav or other lists.
       Works in both light and dark modes via --wa-color-* tokens. */
    /* Base list reset */
    .webapp-list { list-style:none; margin:0; padding:0; }
    /* Row anatomy: flex row — [icon] [label…] [value right] */
    .webapp-list-item {
      display:flex; align-items:center; gap:8px;
      padding:10px 14px; min-width:0;
    }
    /* Interactive rows: the whole row is the click target — move the row padding
       onto the anchor so it fills the ENTIRE <li> (icon+label+value stay inside).
       Otherwise the <li> padding ring is a dead zone (the click hook lives on the
       inner <a data-webapp-source>), so only the text reacted. */
    .webapp-list-item:has(> a.webapp-link) { padding:0; }
    /* Anchor wrapper (interactive rows) inherits the item layout */
    .webapp-list-item > a.webapp-link {
      display:flex; align-items:center; gap:8px;
      flex:1; min-width:0;
      padding:10px 14px;
      font-weight:inherit; color:inherit; text-decoration:none;
    }
    /* Leading icon: fixed 18 px, muted colour, no shrink */
    .webapp-list-item-icon {
      flex-shrink:0; font-size:18px; width:18px; height:18px;
      color:var(--wa-color-text-muted);
    }
    /* Label: primary, flex-grows, truncates on overflow */
    .webapp-list-item > a.webapp-link > :not(.webapp-list-item-icon):not(.webapp-list-value),
    .webapp-list-item > :not(.webapp-list-item-icon):not(.webapp-list-value):not(a) {
      flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
    }
    /* When item is a bare <a> with mixed children the label text node is the flex child */
    /* Value: trailing, muted (secondary) or badge, separated by auto margin from label */
    .webapp-list-value {
      flex-shrink:0; margin-left:auto; padding-left:10px;
    }
    span.webapp-list-value { color:var(--wa-color-text-muted); font-size:0.875rem; }
    /* displayType: plain (DEFAULT) — clean rows, no divider */
    /* (no extra CSS needed — the anatomy above is the plain look) */
    /* displayType: divided — 0.5px separators between rows */
    .webapp-list--divided .webapp-list-item + .webapp-list-item {
      border-top:0.5px solid var(--wa-color-border);
    }
    /* displayType: grouped — bordered card / list-group look */
    .webapp-list--grouped {
      border:1px solid var(--wa-color-border);
      border-radius:var(--wa-radius-md);
      overflow:hidden;
    }
    .webapp-list--grouped .webapp-list-item + .webapp-list-item {
      border-top:1px solid var(--wa-color-border);
    }
    /* displayType: actionable — hover highlight + active/pressed feedback, NO chevron */
    .webapp-list--actionable .webapp-list-item {
      cursor:pointer; transition:background 0.1s;
    }
    .webapp-list--actionable .webapp-list-item:hover,
    .webapp-list--actionable .webapp-list-item > a.webapp-link:hover {
      background:color-mix(in srgb, var(--wa-color-primary) 8%, transparent);
    }
    .webapp-list--actionable .webapp-list-item:active,
    .webapp-list--actionable .webapp-list-item > a.webapp-link:active {
      background:color-mix(in srgb, var(--wa-color-primary) 15%, transparent);
    }
    /* Selected row (P173 selectable) */
    .webapp-list-item--selected {
      background:color-mix(in srgb, var(--wa-color-primary) 10%, transparent);
      font-weight:500;
    }
    /* Disabled list — visual lock (P172) */
    .webapp-list--disabled { opacity:0.5; pointer-events:none; }
    /* P36: desktop — sidebar layout; navbar collapses over content on narrow viewports */
    @media (min-width:900px) {
      .webapp-layout--app { flex-direction:row; flex-wrap:wrap; }
      .webapp-slot--header { flex:0 0 100%; }
      .webapp-slot--navbar { width:220px; flex-shrink:0; border-right:1px solid var(--wa-color-border); min-height:calc(100vh - 56px); padding-top:16px; }
      .webapp-slot--content { flex:1; }
      .webapp-slot--footer { flex:0 0 100%; }
    }
  </style>
</head>
<body>
  ${appBarHtml}
  <div id="webapp-client-root"${isAppLayout ? " class=\"webapp-is-app-layout\"" : ""}
       data-webapp-app-id="${escapeAttribute(model.id)}"
       data-webapp-location="${escapeAttribute(snapshot.location)}"
       data-webapp-signature="${escapeAttribute(shellSignature)}"
       data-webapp-mode="${escapeAttribute(deployMode)}"${dialogId ? ` data-webapp-dialog="${escapeAttribute(dialogId)}"` : ""}>
    <div class="webapp-grid">${pageBody}</div>
    ${dialogHtml}
  </div>
  <script src="${CLIENT_SERIALIZER_SRC}" defer></script>
  <script src="${CLIENT_RUNTIME_SRC}" defer></script>
</body>
</html>`
    };
}

function getFlowFilePath(RED) {
    const configuredFlowFile = RED.settings.flowFile || "flows.json";
    return path.isAbsolute(configuredFlowFile)
        ? configuredFlowFile
        : path.join(RED.settings.userDir || process.cwd(), configuredFlowFile);
}

function readDeployDefinitions(RED) {
    try {
        const flowFilePath = getFlowFilePath(RED);

        if (!fs.existsSync(flowFilePath)) {
            return [];
        }

        const parsed = JSON.parse(fs.readFileSync(flowFilePath, "utf8"));
        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed
            .filter((entry) => entry && WEBAPP_NODE_TYPES.has(entry.type))
            .map((entry) => {
                const registration = runtimeNodeRegistry[entry.type];

                if (!registration || typeof registration.mapConfig !== "function") {
                    return {
                        ...entry,
                        id: entry.uiId || entry.id
                    };
                }

                const baseDefinition = {
                    // P231: source the common base fields (visible/disabled/color) from
                    // the flow config GENERICALLY, so every applicable node carries them
                    // into the component even when its own mapConfig does not list them.
                    // Spread FIRST so a node-specific mapConfig (e.g. ui-list emits its
                    // own visible/color) wins. The editor only emits these on applicable
                    // nodes and the schema mixin matches, so non-applicable nodes never
                    // carry them. Downstream: visible→visibleIf, color→bind.color (generic).
                    ...(entry.visible !== undefined && entry.visible !== null ? { visible: entry.visible } : {}),
                    ...(entry.disabled !== undefined && entry.disabled !== null ? { disabled: entry.disabled } : {}),
                    ...(entry.color !== undefined && entry.color !== null ? { color: entry.color } : {}),
                    ...registration.mapConfig(entry),
                    z: entry.z
                };

                // P39: merge the in-memory `value` patch from viewNodePatchInputHandler
                // into the flow-file-derived definition so SSE snapshots and
                // re-renders reflect msg.payload updates. Only applied to view nodes
                // that carry a `value` binding (structural nodes like ui-app do not).
                // P45: also merge `rows` (ui-table) and `items` (ui-list) which are
                // the primary binding fields for those node types.
                const liveRegistration = runtimeState.definitions.get(entry.id);
                if (liveRegistration && liveRegistration.definition
                        && liveRegistration.definition.type === entry.type) {
                    const patch = computeLiveViewPatch(baseDefinition, liveRegistration.definition);
                    if (Object.keys(patch).length > 0) {
                        return Object.assign({}, baseDefinition, patch);
                    }
                }

                return baseDefinition;
            })
            // P111: resolve flow/global/env value bindings server-side into
            // literals (non-reactive, one-shot at render). The renderer is
            // backend-neutral and cannot read Node-RED context; this is the only
            // place with RED + the live node, so it happens here.
            .map((def) => resolveContextBindingsForDef(def, RED));
    }
    catch {
        return [];
    }
}

// P111: binding kinds that are resolved SERVER-SIDE (from the Node-RED node's
// flow/global context or the environment) into a literal at render time. They
// are intentionally NOT reactive — the value is read once per render. `msg`
// (Message mode) is deliberately excluded: it is driven by the input handler.
const CONTEXT_BINDING_KINDS = new Set(["flow", "global", "env"]);

function resolveContextValue(node, kind, path, RED) {
    try {
        if (kind === "flow") {
            return node ? node.context().flow.get(path) : undefined;
        }
        if (kind === "global") {
            return node ? node.context().global.get(path) : undefined;
        }
        if (kind === "env") {
            // env is resolved relative to the node's environment (flow/group/global).
            return RED && RED.util && typeof RED.util.evaluateNodeProperty === "function"
                ? RED.util.evaluateNodeProperty(path, "env", node || {}, undefined)
                : undefined;
        }
    }
    catch (_e) {
        return undefined;
    }
    return undefined;
}

// Replace any flow/global/env binding on a definition's binding fields with a
// literal carrying the resolved value. Returns a fresh object only when a field
// was rewritten; otherwise the input is returned unchanged.
function resolveContextBindingsForDef(def, RED) {
    if (!def || !RED) {
        return def;
    }
    let node;
    let out = def;
    VIEW_NODE_BINDING_FIELDS.forEach((field) => {
        const binding = def[field];
        if (!binding || typeof binding !== "object" || !CONTEXT_BINDING_KINDS.has(binding.kind) || typeof binding.path !== "string") {
            return;
        }
        if (node === undefined) {
            node = (RED.nodes && typeof RED.nodes.getNode === "function" ? RED.nodes.getNode(def.id) : undefined) || null;
        }
        const resolved = resolveContextValue(node, binding.kind, binding.path, RED);
        const value = resolved === undefined ? binding.fallback : resolved;
        if (out === def) {
            out = Object.assign({}, def);
        }
        out[field] = literalBinding(value);
    });
    return out;
}

// P108: cross-validate that no two ui-app nodes share the same root path.
// Two apps with the same root collide on the URL and cause non-deterministic
// routing — surface this as a structured error at deploy time.
// Returns a list of { nodeId, appId, root, message }.
function validateAppRootUniqueness(RED) {
    const issues = [];
    let nodes;
    try {
        const flowFilePath = getFlowFilePath(RED);
        if (!fs.existsSync(flowFilePath)) { return issues; }
        const parsed = JSON.parse(fs.readFileSync(flowFilePath, 'utf8'));
        nodes = Array.isArray(parsed) ? parsed : [];
    }
    catch { return issues; }

    const appNodes = nodes.filter((n) => n && n.type === 'ui-app');
    const byRoot = new Map();
    for (const n of appNodes) {
        const root = (n.root || '').trim();
        if (!root) { continue; }
        const existing = byRoot.get(root);
        if (existing) { existing.push(n); }
        else { byRoot.set(root, [n]); }
    }

    for (const [root, group] of byRoot.entries()) {
        if (group.length < 2) { continue; }
        const appIds = group.map((n) => n.uiId || n.id).join(', ');
        for (const n of group) {
            issues.push({
                nodeId: n.id,
                appId: n.uiId || n.id,
                root,
                message: `ui-app root '${root}' is shared by multiple apps (${appIds}). Each app must have a unique root path.`
            });
        }
    }
    return issues;
}

// P205 (Owner 2026-07-06): an app-scoped node (store/query/action/navigation/
// dialog/route) belongs to a ui-app via its `parent` field. Deploy groups nodes
// into an app by flow tab (`z`), NOT by `parent`, so a node with an empty / own-id
// / non-app `parent` renders silently and its editor reference-pickers (which match
// `parent === appId`) drop it — with no error. This surfaces the misconfiguration
// as a deploy error: `parent` must be the id of a real ui-app in the flow and never
// the node's own id. Pure over a nodes array (unit-testable); the RED wrapper reads
// the deployed flow file (mirrors validateAppRootUniqueness). Returns a list of
// { nodeId, parent, message }.
const APP_SCOPED_PARENT_TYPES = ["ui-store", "ui-store-read", "ui-store-action", "ui-query", "ui-query-action", "ui-action", "ui-dialog", "ui-route"];

function collectAppScopedParentIssues(nodes) {
    const issues = [];
    if (!Array.isArray(nodes)) { return issues; }
    const appIds = new Set();
    for (const n of nodes) {
        if (n && n.type === "ui-app") {
            if (n.id) { appIds.add(n.id); }
            if (n.uiId) { appIds.add(n.uiId); }
            if (n.root) { appIds.add(n.root); }
        }
    }
    for (const n of nodes) {
        if (!n || APP_SCOPED_PARENT_TYPES.indexOf(n.type) === -1) { continue; }
        // P228 (ADR 0038): canonical owning-app field is `app`; legacy `parent`
        // stays readable for pre-rename flows.
        const appField = typeof n.app === "string" ? n.app.trim() : "";
        const legacyParent = typeof n.parent === "string" ? n.parent.trim() : "";
        const parent = appField || legacyParent;
        let reason;
        if (!parent) { reason = "has no App parent — open it and pick the owning ui-app"; }
        else if (parent === n.id) { reason = "has its own id as App parent (not a valid app) — pick the owning ui-app"; }
        else if (!appIds.has(parent)) { reason = `App parent '${parent}' is not a ui-app in this flow`; }
        if (reason) {
            issues.push({ nodeId: n.id, parent, message: `${n.type} '${n.name || n.id}' ${reason}.` });
        }
    }
    return issues;
}

function validateAppScopedNodeParent(RED) {
    let nodes;
    try {
        const flowFilePath = getFlowFilePath(RED);
        if (!fs.existsSync(flowFilePath)) { return []; }
        const parsed = JSON.parse(fs.readFileSync(flowFilePath, 'utf8'));
        nodes = Array.isArray(parsed) ? parsed : [];
    }
    catch { return []; }
    return collectAppScopedParentIssues(nodes);
}

// P168 (ADR 0018 §1): cross-validate that the `ui-tab` children mounted into one
// `ui-tabs` carry UNIQUE ids — the id is the slot key AND the `activeTab` token,
// so a collision aliases two tabs onto one panel. Reads the flow file (like
// validateAppRootUniqueness) and groups ui-tab nodes by the ui-tabs id parsed
// from their mount (`container:<tabsId>/...` or `ui-tabs:<tabsId>/...`). Returns
// one issue per offending node so each gets a visible red status + error.
function parseTabsHostFromMount(mount) {
    const raw = typeof mount === "string" ? mount.trim() : "";
    const heads = ["ui-tabs:", "container:"];
    for (const head of heads) {
        if (raw.startsWith(head)) {
            const sep = raw.indexOf("/");
            if (sep < 0) { return ""; }
            return raw.slice(head.length, sep);
        }
    }
    return "";
}

function validateUiTabChildrenUniqueness(RED) {
    const issues = [];
    let nodes;
    try {
        const flowFilePath = getFlowFilePath(RED);
        if (!fs.existsSync(flowFilePath)) { return issues; }
        const parsed = JSON.parse(fs.readFileSync(flowFilePath, 'utf8'));
        nodes = Array.isArray(parsed) ? parsed : [];
    }
    catch { return issues; }

    const tabNodes = nodes.filter((n) => n && n.type === 'ui-tab');
    // host (ui-tabs id) → Map<tabId, node[]>
    const byHost = new Map();
    for (const n of tabNodes) {
        const host = parseTabsHostFromMount(n.mount);
        if (!host) { continue; }
        // The tab id is the node id (getUiId = config.id); the slot key derives
        // from it. uiId is only a fallback for nodes that lack an id.
        const tabId = (n.id || n.uiId || '').trim();
        if (!tabId) { continue; }
        if (!byHost.has(host)) { byHost.set(host, new Map()); }
        const byTabId = byHost.get(host);
        if (byTabId.has(tabId)) { byTabId.get(tabId).push(n); }
        else { byTabId.set(tabId, [n]); }
    }

    for (const [host, byTabId] of byHost.entries()) {
        for (const [tabId, group] of byTabId.entries()) {
            if (group.length < 2) { continue; }
            for (const n of group) {
                issues.push({
                    nodeId: n.id,
                    host,
                    tabId,
                    message: `Duplicate ui-tab id '${tabId}' within ui-tabs '${host}' — tab ids must be unique (the id is the slot key and the activeTab value).`
                });
            }
        }
    }
    return issues;
}

// P169 (ADR 0018 §1): mirror of parseTabsHostFromMount/validateUiTabChildrenUniqueness
// for ui-accordion-section. Parses the owning ui-accordion id from a section's
// mount (`ui-accordion:<id>/...` or `container:<id>/...`) and flags a duplicate
// section id within one ui-accordion (a collision aliases two sections onto one
// panel). Returns one issue per offending node for a visible red status + error.
function parseAccordionHostFromMount(mount) {
    const raw = typeof mount === "string" ? mount.trim() : "";
    const heads = ["ui-accordion:", "container:"];
    for (const head of heads) {
        if (raw.startsWith(head)) {
            const sep = raw.indexOf("/");
            if (sep < 0) { return ""; }
            return raw.slice(head.length, sep);
        }
    }
    return "";
}

function validateUiAccordionSectionChildrenUniqueness(RED) {
    const issues = [];
    let nodes;
    try {
        const flowFilePath = getFlowFilePath(RED);
        if (!fs.existsSync(flowFilePath)) { return issues; }
        const parsed = JSON.parse(fs.readFileSync(flowFilePath, 'utf8'));
        nodes = Array.isArray(parsed) ? parsed : [];
    }
    catch { return issues; }

    const sectionNodes = nodes.filter((n) => n && n.type === 'ui-accordion-section');
    // host (ui-accordion id) → Map<sectionId, node[]>
    const byHost = new Map();
    for (const n of sectionNodes) {
        const host = parseAccordionHostFromMount(n.mount);
        if (!host) { continue; }
        const sectionId = (n.id || n.uiId || '').trim();
        if (!sectionId) { continue; }
        if (!byHost.has(host)) { byHost.set(host, new Map()); }
        const bySectionId = byHost.get(host);
        if (bySectionId.has(sectionId)) { bySectionId.get(sectionId).push(n); }
        else { bySectionId.set(sectionId, [n]); }
    }

    for (const [host, bySectionId] of byHost.entries()) {
        for (const [sectionId, group] of bySectionId.entries()) {
            if (group.length < 2) { continue; }
            for (const n of group) {
                issues.push({
                    nodeId: n.id,
                    host,
                    sectionId,
                    message: `Duplicate ui-accordion-section id '${sectionId}' within ui-accordion '${host}' — section ids must be unique (the id is the slot key and the open-state value).`
                });
            }
        }
    }
    return issues;
}

// P201: the runtime keys per-client state AND SSE subscribers by the appId in the
// request URL — which may be the app's `root` OR its node id (both route to the
// same app via getDefinitionBuckets). A ui-store update, however, is keyed by the
// OWNING app's node id (findAppIdForNode). When root !== id these disagree, so a
// store-bound view never live-updates for a client that reached the app by root.
// Normalise every request boundary to the canonical node id so writer and reader
// always key the same app.
function resolveCanonicalAppId(appId, definitions) {
    const buckets = getDefinitionBuckets(appId, definitions);
    return buckets && buckets.app ? buckets.app.id : appId;
}

function getDefinitionBuckets(appId, definitions) {
    const matchingApp = definitions.find((entry) => entry.type === "ui-app" && (entry.id === appId || entry.root === appId));

    if (!matchingApp) {
        return {
            app: undefined,
            routes: [],
            dialogs: [],
            components: [],
            stores: [],
            queries: [],
            actions: [],
            navigations: []
        };
    }

    const appFlowId = matchingApp.z;
    const matchingDefinitions = definitions.filter(
        (entry) => entry.type !== "ui-app" && (appFlowId === undefined || entry.z === appFlowId || entry.z === undefined)
    );

    return {
        app: matchingApp,
        routes: matchingDefinitions.filter((entry) => entry.type === "ui-route"),
        dialogs: matchingDefinitions.filter((entry) => entry.type === "ui-dialog"),
        components: matchingDefinitions.filter((entry) => ["ui-text", "ui-button", "ui-table", "ui-container", "ui-input", "ui-select", "ui-checkbox", "ui-radio", "ui-switch", "ui-textarea", "ui-datepicker", "ui-slider", "ui-alert", "ui-toast", "ui-progress", "ui-skeleton", "ui-badge", "ui-empty-state", "ui-tabs", "ui-tab", "ui-accordion", "ui-accordion-section", "ui-breadcrumb", "ui-menu", "ui-pagination", "ui-stepper", "ui-avatar", "ui-image", "ui-icon", "ui-list", "ui-log", "ui-divider", "ui-repeat", "ui-component-definition", "ui-component-instance"].includes(entry.type)),
        stores: matchingDefinitions.filter((entry) => entry.type === "ui-store"),
        queries: matchingDefinitions.filter((entry) => entry.type === "ui-query"),
        actions: matchingDefinitions.filter((entry) => entry.type === "ui-action"),
        // P243 (ADR 0040): ui-navigation retired — a url-target navigation is now a
        // ui-action navigate carrying a concrete `to` (mirrors packages/runtime
        // node-set.ts). Route-mode navigate (no `to`) is excluded from this list.
        navigations: matchingDefinitions.filter((entry) =>
            entry.type === "ui-action" && entry.actionType === "navigate" && typeof entry.to === "string")
    };
}

function getActiveRuntimeAppId() {
    for (const registration of runtimeState.definitions.values()) {
        if (registration.definition.type === "ui-app") {
            return registration.definition.id;
        }
    }

    return undefined;
}

// P59-fix: resolve the registered node type for an id. Used to tell a dialog
// open/close command (which needs a snapshot re-render so snapshot.dialogs is
// populated) apart from sub-part disclosure commands the client renders locally.
function getDefinitionTypeById(id) {
    if (!id) {
        return undefined;
    }
    for (const registration of runtimeState.definitions.values()) {
        const def = registration.definition;
        if (def && def.id === id) {
            return def.type;
        }
    }
    return undefined;
}

// P22: a self-contained JSON body reader so the event endpoint does not depend on
// Node-RED's optional httpNode body-parser configuration. If a body parser already
// ran (req.body present), it is reused.
// P70 Ebene 3: collect a raw binary request body (image upload). Capped to guard
// against unbounded memory use; the cap is generous for typical UI imagery.
function readRawBody(req, res, next) {
    if (Buffer.isBuffer(req.rawBody)) {
        next();
        return;
    }
    const chunks = [];
    let size = 0;
    const MAX = 10 * 1024 * 1024; // 10 MB
    req.on("data", (chunk) => {
        size += chunk.length;
        if (size > MAX) {
            req.destroy();
            return;
        }
        chunks.push(chunk);
    });
    req.on("end", () => {
        req.rawBody = Buffer.concat(chunks);
        next();
    });
    req.on("error", () => {
        req.rawBody = Buffer.alloc(0);
        next();
    });
}

function readJsonBody(req, res, next) {
    if (req.body && typeof req.body === "object") {
        next();
        return;
    }

    let raw = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
        raw += chunk;
        if (raw.length > 1_000_000) {
            req.destroy();
        }
    });
    req.on("end", () => {
        try {
            req.body = raw ? JSON.parse(raw) : {};
        }
        catch {
            req.body = {};
        }
        next();
    });
    req.on("error", () => {
        req.body = {};
        next();
    });
}

// ════════════════════════════════════════════════════════════════════════
// P31: live Server→Client push transport (SSE).
//
// Decision recorded in docs/adr/0003: a one-directional Server-Sent Events
// stream on the existing httpNode router. Client→Server is already the
// POST /event path (P30); this supplies the only missing direction. Each
// connected EventSource registers under appId + clientId so a flow-driven
// store/action update addressed to msg.ui.clientId reaches exactly that client,
// and a broadcast (no clientId) fans out to every subscriber of the app.
// ════════════════════════════════════════════════════════════════════════

function getStreamSubscribers(appId) {
    let subscribers = runtimeState.streamClients.get(appId);
    if (!subscribers) {
        subscribers = new Map();
        runtimeState.streamClients.set(appId, subscribers);
    }
    return subscribers;
}

function addStreamClient(appId, clientId, res, location, loadId) {
    // P37: record the connect time so the redeploy broadcast can skip clients
    // that just connected (the deploy that triggered flows:started fired BEFORE
    // this client connected — reloading them immediately would be a false positive).
    // Suppress write errors on the response and its socket so that EPIPE errors
    // (browser disconnects) do not crash the server when the redeploy broadcast
    // writes to stale handles.
    const noop = function () { /* suppress */ };
    if (typeof res.on === "function") {
        res.on("error", noop);
    }
    if (res.socket && typeof res.socket.on === "function") {
        res.socket.on("error", noop);
    }
    const resolvedLocation = location || "/";
    getStreamSubscribers(appId).set(clientId, { res, location: resolvedLocation, connectedAt: Date.now() });
    // P86: emit clientConnected on the ui-app node if the event is declared.
    emitAppClientEvent(appId, "clientConnected", clientId);
    // P112: connect-based route lifecycle. Every arrival (deep-link, refresh,
    // navigate) ends in a fresh page-load + SSE connect carrying a new loadId.
    handleClientArrival(appId, clientId, resolvedLocation, loadId);
}

function removeStreamClient(appId, clientId) {
    const subscribers = runtimeState.streamClients.get(appId);
    if (subscribers) {
        subscribers.delete(clientId);
        if (subscribers.size === 0) {
            runtimeState.streamClients.delete(appId);
        }
    }
    // P86: emit clientDisconnected on the ui-app node if the event is declared.
    emitAppClientEvent(appId, "clientDisconnected", clientId);
    // P112: schedule a grace-debounced onLeave on the route the client was on.
    // A reconnect of the same clientId within the grace cancels it (transient
    // network blip / reload). Without a reconnect it fires onLeave on expiry.
    scheduleArrivalLeave(appId, clientId);
}

// P112: grace period (ms) before a disconnect is treated as a real route leave.
// A transient EventSource drop reconnects well within this window; a closed tab
// does not. Tunable — long enough to survive a reload/network blip, short enough
// that a genuine leave is observed promptly.
const ARRIVAL_LEAVE_GRACE_MS = 3000;

function getClientArrivalMap(appId) {
    let map = runtimeState.clientArrival.get(appId);
    if (!map) {
        map = new Map();
        runtimeState.clientArrival.set(appId, map);
    }
    return map;
}

// P112: emit onLeave / onEnter on the route node owning a location, if it
// declares the event. Resolves the node via findRouteNodeForLocation (shared
// with the navigate path) so deep-link, refresh and navigate all route alike.
function emitArrivalLifecycle(appId, clientId, eventName, location) {
    const RED = runtimeState.RED;
    // Need a RED runtime with a node registry to resolve and send on the route
    // node. Absent (minimal test doubles, pre-init) → nothing to emit on.
    if (!RED || !RED.nodes || typeof RED.nodes.getNode !== "function" || !location) {
        return;
    }
    const target = findRouteNodeForLocation(RED, appId, location);
    if (target && target.node) {
        emitRouteLifecycleEvent(target.node, eventName, appId, clientId, location, target.params);
    }
}

// P112: process a fresh SSE connect for a client. Compares the page-load nonce
// (loadId) to the previously recorded one:
//   • same loadId  → transient EventSource reconnect → no lifecycle event.
//   • new loadId   → real page-load arrival:
//       - prev location differs → onLeave(prev) then onEnter(new) (A→B switch).
//       - prev location equal   → onEnter only (refresh, no spurious leave).
//       - no prev                → onEnter only (deep-link / first arrival).
// Always cancels any pending grace-debounced leave (the reconnect proves the
// client is still alive) and records the new {loadId, location}.
function handleClientArrival(appId, clientId, location, loadId) {
    const arrivals = getClientArrivalMap(appId);
    const prev = arrivals.get(clientId);

    // A reconnect (any connect) cancels a pending leave from a prior disconnect.
    if (prev && prev.leaveTimer) {
        clearTimeout(prev.leaveTimer);
        prev.leaveTimer = undefined;
    }

    const sameLoad = prev && loadId !== undefined && loadId !== null && prev.loadId === loadId;
    if (sameLoad) {
        // Transient reconnect of the same document — keep the record current but
        // emit nothing. (Location can only change via a new page-load, so it is
        // unchanged here; refresh the entry defensively.)
        prev.location = location;
        return;
    }

    // New page-load (or first arrival): emit the lifecycle.
    if (prev && prev.location && prev.location !== location) {
        emitArrivalLifecycle(appId, clientId, "onLeave", prev.location);
    }
    emitArrivalLifecycle(appId, clientId, "onEnter", location);
    arrivals.set(clientId, { loadId, location, leaveTimer: undefined });
}

// P112: schedule a grace-debounced onLeave for a disconnecting client. If no
// reconnect arrives within ARRIVAL_LEAVE_GRACE_MS the client is considered gone
// for good: emit onLeave on its current route and forget it. A reconnect clears
// this timer in handleClientArrival.
function scheduleArrivalLeave(appId, clientId) {
    const arrivals = runtimeState.clientArrival.get(appId);
    const entry = arrivals && arrivals.get(clientId);
    if (!entry) {
        return;
    }
    if (entry.leaveTimer) {
        clearTimeout(entry.leaveTimer);
    }
    const location = entry.location;
    entry.leaveTimer = setTimeout(() => {
        emitArrivalLifecycle(appId, clientId, "onLeave", location);
        const map = runtimeState.clientArrival.get(appId);
        if (map) {
            map.delete(clientId);
            if (map.size === 0) {
                runtimeState.clientArrival.delete(appId);
            }
        }
    }, ARRIVAL_LEAVE_GRACE_MS);
    // Do not keep the Node process alive solely for a pending leave timer.
    if (entry.leaveTimer && typeof entry.leaveTimer.unref === "function") {
        entry.leaveTimer.unref();
    }
}

// Serialise a single SSE message frame. A named event lets the browser
// distinguish a full snapshot re-render from an interaction command.
function writeStreamEvent(res, eventName, payload) {
    if (!res || typeof res.write !== "function") {
        return false;
    }
    try {
        res.write(`event: ${eventName}\n`);
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
        return true;
    }
    catch (error) {
        // P56: an SSE write failure (broken pipe, closed socket) is logged with
        // context instead of crashing the push loop. Not forwarded to clients —
        // the failing transport is the very channel forwarding would use.
        const RED = runtimeState.RED;
        if (RED && RED.log && RED.log.warn) {
            RED.log.warn(`[webapp] SSE write failed for '${eventName}' frame (op=writeStreamEvent): ${error instanceof Error ? error.message : String(error)}`);
        }
        return false;
    }
}

// Push the current snapshot (built from the live node state) to one client, or
// to every subscriber of the app when clientId is undefined (broadcast). Each
// client is rendered at ITS OWN current location, with ITS OWN per-client state.
function pushSnapshotToClients(appId, clientId, definitions) {
    const subscribers = runtimeState.streamClients.get(appId);
    if (!subscribers || subscribers.size === 0) {
        return;
    }

    const targets = clientId
        ? (subscribers.has(clientId) ? [[clientId, subscribers.get(clientId)]] : [])
        : Array.from(subscribers.entries());

    for (const [targetClientId, entry] of targets) {
        const built = buildAppSnapshot(appId, entry.location || "/", undefined, definitions, targetClientId);
        if (built.success) {
            writeStreamEvent(entry.res, "snapshot", { snapshot: built.snapshot });
        }
        else {
            // P56: a failed snapshot build is no longer silently dropped — log it
            // with context and (when forwarding is on) surface it to the client.
            reportRuntimeError(undefined, {
                severity: "warn",
                code: "server.snapshot.build-failed",
                message: `Snapshot build failed for '${entry.location || "/"}' (status ${built.status}): ${built.message || "unknown error"}`,
                context: { appId, op: "buildAppSnapshot" },
                clientId: targetClientId
            });
        }
    }
}

// P106: normalise the ui-app `status` config field onto the deploy-mode enum.
// The editor offers Entwicklung / Produktion; accept the German labels, the
// English tokens, and the already-normalised enum. Anything else (incl. absent)
// falls back to "development" so existing apps keep the convenient auto-update.
function normalizeAppMode(status) {
    const raw = String(status === undefined || status === null ? "" : status).trim().toLowerCase();
    if (raw === "production" || raw === "produktion" || raw === "prod") {
        return "production";
    }
    return "development";
}

// P106: resolve an app's deploy mode from a set of definitions (the ui-app's
// `mode`, already normalised by mapConfig, with a defensive re-normalise so a
// raw `status` on the definition is honoured too).
function resolveAppMode(appId, definitions) {
    const buckets = getDefinitionBuckets(appId, definitions);
    const app = buckets.app;
    if (!app) {
        return "development";
    }
    if (app.mode === "production" || app.mode === "development") {
        return app.mode;
    }
    return normalizeAppMode(app.status);
}

// P106: a small, stable, non-cryptographic string hash (FNV-1a, 32-bit). The
// signature only needs to be deterministic and collision-resistant enough to
// tell "same shell/topology" from "different" — never a security boundary, so a
// crypto digest would be overkill.
function fnv1aHash(input) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
    }
    return ("0000000" + hash.toString(16)).slice(-8);
}

// P106: compute the shell/topology signature (live-deploy-update.md). It captures
// exactly the parts a client-side in-place `applySnapshot` CANNOT express — so a
// change here forces a full reload, while a pure content change leaves it stable:
//   1. App-shell — the ui-app layout preset + theme tokens (baked into the
//      server-rendered page hull).
//   2. Routen-Topologie — the SET of route paths (sorted; param structure rides
//      along in the path string).
//   3. Serializer/transport version — the client code-contract itself.
// Returns a short hex digest. Deterministic for equal inputs.
function computeShellSignature(appId, definitions) {
    const buckets = getDefinitionBuckets(appId, definitions);
    const app = buckets.app;

    const appLayout = app ? (app.layout || "") : "";
    // Tokens are an object on the compiled definition; serialise with sorted keys
    // so key order in the flow file never perturbs the signature.
    const tokens = app && app.tokens && typeof app.tokens === "object" ? app.tokens : {};
    const tokenKeys = Object.keys(tokens).sort();
    const tokenSig = tokenKeys.map((k) => `${k}=${tokens[k]}`).join("&");

    // The route-path SET (incl. the implicit app-root "/"). Sorted + de-duped so
    // a reorder in the flow file is NOT a topology change.
    const routePaths = new Set(["/"]);
    for (const route of buckets.routes) {
        if (route && route.path) {
            routePaths.add(String(route.path));
        }
    }
    const routeSig = Array.from(routePaths).sort().join(",");

    const material = [
        `v=${SNAPSHOT_SERIALIZER_VERSION}`,
        `layout=${appLayout}`,
        `tokens=${tokenSig}`,
        `routes=${routeSig}`
    ].join("|");

    return fnv1aHash(material);
}

// P106: on deploy, push the freshly-compiled model to every subscriber of the app
// as a `deploy` SSE frame carrying { snapshot, signature, mode }. The client
// decides what to do (live-deploy-update.md):
//   development → signature unchanged + route still present ? in-place applySnapshot
//                 : full reload.
//   production  → never auto-update; show a version alert; the user's manual
//                 reload adopts the new model.
// Always a BROADCAST (no clientId) — each subscriber is rendered at ITS OWN
// location with ITS OWN per-client state (P15), so per-client state survives.
//
// `options.connectedBefore` (a timestamp): skip clients that connected at/after
// it — they are already loading the fresh flow (the P37 connect-race guard).
// `options.requireLiveSocket`: only write to a connection whose socket is still
// fully writable (avoids EPIPE to a browser tab that closed mid-deploy).
function pushDeployToClients(appId, definitions, options) {
    const subscribers = runtimeState.streamClients.get(appId);
    if (!subscribers || subscribers.size === 0) {
        return;
    }

    const opts = options || {};
    const signature = computeShellSignature(appId, definitions);
    const mode = resolveAppMode(appId, definitions);

    for (const [targetClientId, entry] of subscribers.entries()) {
        // P37 connect-race guard: a client that connected at/after the deploy is
        // already loading the new flow — sending it a deploy push would cause a
        // spurious extra in-place apply / reload.
        if (typeof opts.connectedBefore === "number"
                && typeof entry.connectedAt === "number"
                && !(entry.connectedAt < opts.connectedBefore)) {
            continue;
        }

        // Live-socket guard: skip half-closed / destroyed connections.
        if (opts.requireLiveSocket) {
            const res = entry.res;
            const socket = res && res.socket;
            const isLive = res && !res.writableEnded && !res.destroyed
                && socket && !socket.destroyed && !socket.writableEnded && socket.readable;
            if (!isLive) {
                continue;
            }
        }

        const built = buildAppSnapshot(appId, entry.location || "/", undefined, definitions, targetClientId);
        if (built.success) {
            writeStreamEvent(entry.res, "deploy", {
                snapshot: built.snapshot,
                signature,
                mode
            });
        }
        else {
            // A failed build still emits a deploy frame WITHOUT a snapshot so the
            // client can fall back to a reload (it cannot stay on a stale page).
            writeStreamEvent(entry.res, "deploy", { snapshot: null, signature, mode });
            reportRuntimeError(undefined, {
                severity: "warn",
                code: "server.deploy.snapshot-build-failed",
                message: `Deploy snapshot build failed for '${entry.location || "/"}' (status ${built.status}): ${built.message || "unknown error"}`,
                context: { appId, op: "pushDeployToClients" },
                clientId: targetClientId
            });
        }
    }
}

// P45: push a toast notification to connected SSE clients. Toasts are transient
// notifications that appear in the browser and disappear after `duration` ms.
// They are pushed as "toast" SSE events (distinct from "snapshot" and "command").
function pushToastToClients(appId, clientId, toast) {
    const subscribers = runtimeState.streamClients.get(appId);
    if (!subscribers || subscribers.size === 0) {
        return;
    }

    const targets = clientId
        ? (subscribers.has(clientId) ? [[clientId, subscribers.get(clientId)]] : [])
        : Array.from(subscribers.entries());

    for (const [, entry] of targets) {
        writeStreamEvent(entry.res, "toast", { toast });
    }
}

// P64: authoritatively write a dialog's open state into the SAME state channel a
// ui-store uses. Mirrors ui-store's per-client vs broadcast rule, keyed on the
// given clientId: a broadcast write (no clientId) updates the shared state so a
// later broadcast store update can override it; a per-client write shadows it for
// just that client. Factored out of pushActionCommandToClients so the dialog
// open (ui-action) path and the dialog close (native dismissal) path share it.
function writeDialogOpenState(appId, clientId, dialogId, open) {
    const dialogStatePath = `ui.dialogs.${String(dialogId)}.open`;

    if (clientId) {
        const current = getClientState(appId, clientId);
        const base = current && current.state
            ? current.state
            : clone(runtimeState.liveState.get(appId) || {});
        setClientState(appId, clientId, setValueAtPath(base, dialogStatePath, open), Date.now());
    }
    else {
        const base = clone(runtimeState.liveState.get(appId) || {});
        runtimeState.liveState.set(appId, setValueAtPath(base, dialogStatePath, open));
    }
}

// P64: rebuild and push a fresh snapshot to each target client at its current
// location. Used after a server-side interaction-state write (e.g. a dialog open
// or close) so every affected client re-renders from the authoritative state.
function pushSnapshotToTargets(appId, targets, definitions) {
    const defs = definitions || readDeployDefinitions(runtimeState.RED);

    for (const [targetClientId, entry] of targets) {
        const built = buildAppSnapshot(appId, entry.location || "/", undefined, defs, targetClientId);
        if (built.success) {
            writeStreamEvent(entry.res, "snapshot", { snapshot: built.snapshot });
        }
    }
}

// Push an interaction command (navigate / openDialog / show / hide / …) produced
// by a ui-action in the flow to the targeted client(s). Interaction commands change
// INTERACTION state only (actions.md) — never business data. When the command moves
// the client to a new route, the server remembers the new location so subsequent
// snapshot pushes render the right page.
function pushActionCommandToClients(appId, clientId, command) {
    const subscribers = runtimeState.streamClients.get(appId);
    if (!subscribers || subscribers.size === 0) {
        return;
    }

    const targets = clientId
        ? (subscribers.has(clientId) ? [[clientId, subscribers.get(clientId)]] : [])
        : Array.from(subscribers.entries());

    // P59-fix: a bare open/close on a ui-dialog target (no `part`) cannot be
    // rendered by the client from its stale snapshot — `snapshot.dialogs` only
    // contains dialogs the server built as open. So for those we write the dialog
    // open state into the SAME state channel a ui-store uses, then push a fresh
    // SNAPSHOT — mirroring the store-driven open path. This keeps the dialog state
    // unified: a later store update to ui.dialogs.<id>.open overrides it naturally.
    // Every other command (navigate, show/hide, sub-part open/close, …) stays a
    // `command` the client applies locally.
    const verb = command && typeof command.type === "string" ? command.type : undefined;
    const isDialogVerb = (verb === "open" || verb === "openDialog" || verb === "close" || verb === "closeDialog");
    const isBareDialogTarget = isDialogVerb
        && !command.part
        && command.target
        && getDefinitionTypeById(String(command.target)) === "ui-dialog";

    if (isBareDialogTarget) {
        const opening = verb === "open" || verb === "openDialog";

        // Mirror ui-store's per-client vs broadcast rule, keyed on the COMMAND's
        // clientId (the function arg) — NOT the loop's target (see writeDialogOpenState).
        writeDialogOpenState(appId, clientId, String(command.target), opening);
        pushSnapshotToTargets(appId, targets);
        return;
    }

    for (const [, entry] of targets) {
        if (command && command.type === "navigate" && command.to) {
            entry.location = String(command.to);
        }
        writeStreamEvent(entry.res, "command", { command });
    }
}

// ─── P56 / ADR 0006: structured runtime logging + opt-in error forwarding ───
//
// Every framework failure in the runtime is logged WITH CONTEXT via node.error /
// node.warn (never bare), shaped after the ADR 0006 structured-error contract
// ({ severity, code, message, context:{appId,nodeId,op}, timestamp, origin }).
// When the owning ui-app opts in (forwardErrorsToClient), errors at or above its
// severity threshold are ALSO forwarded to connected clients over a new SSE
// "error" event — redacted, default OFF (security). The browser logs them via
// the P55 receiving-end handler.

// severity → ordinal, for the forwarding threshold comparison (ADR 0006 §4).
const ERROR_SEVERITY_RANK = { debug: 0, info: 1, warn: 2, error: 3 };

function nowIso() {
    return new Date().toISOString();
}

// Resolve the forwarding config for an app from its registered ui-app definition.
// Absent fields fall back to the SECURE default: no forwarding, "error" threshold.
function resolveAppForwardConfig(appId) {
    if (!appId) {
        return { enabled: false, minSeverity: "error" };
    }
    for (const registration of runtimeState.definitions.values()) {
        const def = registration.definition;
        if (def && def.type === "ui-app" && def.id === appId) {
            return {
                enabled: def.forwardErrorsToClient === true,
                minSeverity: def.forwardErrorMinSeverity || "error"
            };
        }
    }
    return { enabled: false, minSeverity: "error" };
}

// Redact a message before forwarding it to anonymous clients (ADR 0006 §4):
// strip absolute file paths and any stack-trace tail so server internals do not
// leak. The structured `code` + `context` ids still travel; only the free-text
// message is sanitised.
function redactErrorMessage(message) {
    let text = message === undefined || message === null ? "" : String(message);
    // Drop everything from the first stack frame marker onwards.
    const stackAt = text.search(/\n?\s*at\s+/);
    if (stackAt !== -1) {
        text = text.slice(0, stackAt);
    }
    // Replace absolute filesystem paths (POSIX or Windows) with a placeholder.
    text = text.replace(/(?:\/[^\s:]+)+\.[a-zA-Z]+(?::\d+(?::\d+)?)?/g, "<path>");
    text = text.replace(/[A-Za-z]:\\[^\s]+/g, "<path>");
    return text.trim() || "An internal error occurred.";
}

// Build the structured-error wire object (ADR 0006 decision 1).
function makeStructuredError(severity, code, message, context) {
    return {
        severity,
        code,
        message,
        context: context && typeof context === "object" ? context : {},
        timestamp: nowIso(),
        origin: "server"
    };
}

// Push a structured server error to the targeted client(s) over the SSE "error"
// channel — gated by the owning app's forwarding config + severity threshold,
// with the message redacted. The frame shape matches the P55 receiving handler:
//   event: error\n data: { "error": { … } }
// clientId targeting honours the P15 multi-user model (broadcast when absent).
function pushErrorToClients(appId, clientId, structuredError) {
    const config = resolveAppForwardConfig(appId);
    if (!config.enabled) {
        return false;
    }
    const rank = ERROR_SEVERITY_RANK[structuredError.severity];
    const threshold = ERROR_SEVERITY_RANK[config.minSeverity];
    if (rank === undefined || threshold === undefined || rank < threshold) {
        return false;
    }

    const subscribers = runtimeState.streamClients.get(appId);
    if (!subscribers || subscribers.size === 0) {
        return false;
    }

    const forwarded = {
        severity: structuredError.severity,
        code: structuredError.code,
        message: redactErrorMessage(structuredError.message),
        // Only framework ids travel — never arbitrary payload (ADR 0006 §4).
        context: {
            ...(structuredError.context && structuredError.context.appId ? { appId: structuredError.context.appId } : {}),
            ...(structuredError.context && structuredError.context.nodeId ? { nodeId: structuredError.context.nodeId } : {}),
            ...(structuredError.context && structuredError.context.op ? { op: structuredError.context.op } : {})
        },
        timestamp: structuredError.timestamp || nowIso(),
        origin: "server"
    };

    const targets = clientId
        ? (subscribers.has(clientId) ? [[clientId, subscribers.get(clientId)]] : [])
        : Array.from(subscribers.entries());

    let delivered = false;
    for (const [, entry] of targets) {
        writeStreamEvent(entry.res, "error", { error: forwarded });
        delivered = true;
    }
    return delivered;
}

// ADR 0032: a compact one-line status text for the offending node's status badge.
// The full message goes to the log/forwarding; the badge only needs a short hint,
// so it is trimmed (Node-RED renders a node status inline, long text is unusable).
function reactiveStatusText(message) {
    const text = String(message == null ? "" : message).replace(/\s+/g, " ").trim();
    const MAX = 48;
    return text.length > MAX ? `${text.slice(0, MAX - 1)}…` : text;
}

// Central runtime error reporter (ADR 0006). Logs the failure WITH CONTEXT via
// the matching Node-RED logger (warn→node.warn, everything else→node.error) and,
// when the owning app opts in, forwards it to clients via pushErrorToClients.
// `node` may be a real Node-RED node (preferred — keeps the error on the node)
// or undefined (falls back to the runtime logger). Returns the structured error.
function reportRuntimeError(node, { severity, code, message, context, clientId }) {
    const sev = ERROR_SEVERITY_RANK[severity] !== undefined ? severity : "error";
    const ctx = context && typeof context === "object" ? context : {};
    const structured = makeStructuredError(sev, code, message, ctx);

    // Human-readable line: message + a compact rendering of the context + code.
    const ctxBits = [];
    if (ctx.appId) { ctxBits.push(`appId=${ctx.appId}`); }
    if (ctx.nodeId) { ctxBits.push(`nodeId=${ctx.nodeId}`); }
    if (ctx.op) { ctxBits.push(`op=${ctx.op}`); }
    const suffix = `${ctxBits.length ? ` [${ctxBits.join(" ")}]` : ""} (${code})`;
    const line = `${message}${suffix}`;

    if (node && typeof node[sev === "warn" ? "warn" : "error"] === "function") {
        node[sev === "warn" ? "warn" : "error"](line);
    }
    else {
        const RED = runtimeState.RED;
        const logger = RED && RED.log;
        if (logger) {
            (sev === "warn" ? logger.warn : logger.error).call(logger, `[webapp] ${line}`);
        }
    }

    const appId = ctx.appId;
    if (appId) {
        pushErrorToClients(appId, clientId, structured);
    }
    return structured;
}

// P66 (ADR 0007): resolve a ui-action's navigate `to` typedInput into a concrete
// path string. `str` is a literal; `msg` / `flow` / `global` read from the
// respective context via RED.util.evaluateNodeProperty; `jsonata` evaluates the
// expression against the incoming message. The JSONata context is the full `msg`
// (so an expression can compute the path from payload, route params, etc.). All
// paths here are synchronous; a no-match / runtime error is surfaced to the node
// and the result is undefined (the navigate is then treated as "no destination").
function resolveActionTo(node, toValue, toType, msg) {
    if (toValue === undefined || toValue === null || toValue === "") {
        return undefined;
    }
    const type = toType || "str";
    if (type === "str") {
        return String(toValue);
    }
    const RED = runtimeState.RED;
    if (!RED || !RED.util) {
        return type === "str" ? String(toValue) : undefined;
    }
    try {
        if (type === "jsonata") {
            const expr = RED.util.prepareJSONataExpression(String(toValue), node);
            const result = RED.util.evaluateJSONataExpression(expr, msg);
            return result === undefined || result === null ? undefined : String(result);
        }
        // msg / flow / global
        const result = RED.util.evaluateNodeProperty(String(toValue), type, node, msg);
        return result === undefined || result === null ? undefined : String(result);
    }
    catch (err) {
        reportRuntimeError(node, {
            severity: "error",
            code: "navigate-to-eval-failed",
            message: `Could not resolve navigate destination (${type}): ${err && err.message ? err.message : err}`,
            context: { nodeId: node && node.id, op: "navigate" }
        });
        return undefined;
    }
}

// P118 (ADR 0011 §1): resolve a single typed navigate-param value against the
// triggering msg. str = literal; msg/flow/global/env via evaluateNodeProperty;
// jsonata against the full msg. Mirrors resolveActionTo's mechanics. A no-match
// yields "" so the URL segment is still well-formed (an empty placeholder).
function resolveActionParamValue(node, entry, msg) {
    const type = entry && ACTION_PARAM_VALUE_TYPES.has(entry.valueType) ? entry.valueType : "str";
    const raw = entry && entry.value !== undefined && entry.value !== null ? String(entry.value) : "";
    if (type === "str") {
        return raw;
    }
    const RED = runtimeState.RED;
    if (!RED || !RED.util) {
        return "";
    }
    try {
        if (type === "jsonata") {
            const expr = RED.util.prepareJSONataExpression(raw, node);
            const result = RED.util.evaluateJSONataExpression(expr, msg);
            return result === undefined || result === null ? "" : String(result);
        }
        // msg / flow / global / env
        const result = RED.util.evaluateNodeProperty(raw, type, node, msg);
        return result === undefined || result === null ? "" : String(result);
    }
    catch (err) {
        reportRuntimeError(node, {
            severity: "error",
            code: "navigate-param-eval-failed",
            message: `Could not resolve navigate param '${entry && entry.name}' (${type}): ${err && err.message ? err.message : err}`,
            context: { nodeId: node && node.id, op: "navigate" }
        });
        return "";
    }
}

// P118: resolve a navigate param LIST into a string→string record, evaluating
// each typed entry against the triggering msg.
function resolveActionParamRecord(node, paramList, msg) {
    if (!Array.isArray(paramList) || paramList.length === 0) {
        return undefined;
    }
    const out = {};
    for (const entry of paramList) {
        if (entry && typeof entry.name === "string" && entry.name) {
            out[entry.name] = resolveActionParamValue(node, entry, msg);
        }
    }
    return Object.keys(out).length > 0 ? out : undefined;
}

// P118 (ADR 0011 §1): resolve a referenced ui-route id (route mode) to its
// declared `path` template, app-globally over the live definitions. Returns
// undefined when the id matches no ui-route/ui-app (caller treats as no target).
function resolveRouteIdToPath(routeId) {
    if (!routeId) {
        return undefined;
    }
    const defs = collectLiveDefinitions();
    for (const def of defs) {
        if (!def || def.id !== routeId) {
            continue;
        }
        if (def.type === "ui-route") {
            return typeof def.path === "string" && def.path ? def.path : "/";
        }
        if (def.type === "ui-app") {
            return "/";
        }
    }
    return undefined;
}

// Map a ui-action definition + incoming msg into the interaction command the
// client applies. Domain-agnostic: only the documented interaction verbs.
// `node` (optional) is the ui-action runtime node — needed to resolve typedInputs.
//
// P118 (ADR 0011 §1/§3): navigate carries an EXPLICIT target in route/url mode —
// the resolved `to` location — which a receiving ui-route must pass through (it
// never imposes its own path on an addressed navigation). In wire mode the
// command carries NO `to`; the route that receives the message builds the
// location from its own path (today's behaviour).
function buildActionCommand(actionDefinition, msg, node) {
    const uiMsg = msg && msg.ui && typeof msg.ui === "object" ? msg.ui : {};
    const override = uiMsg.action && typeof uiMsg.action === "object" ? uiMsg.action : {};
    const type = override.type || (actionDefinition && actionDefinition.actionType);
    if (!type) {
        return null;
    }

    const def = actionDefinition || {};
    const isNavigate = String(type) === "navigate";
    const targetMode = isNavigate
        ? (def.targetMode || (def.to ? "url" : (def.routeId ? "route" : "wire")))
        : undefined;

    // P118: typed config params (route/wire mode) resolved against the msg →
    // a string→string record. url mode ignores them (the URL is built whole).
    const configParamRecord = (isNavigate && targetMode !== "url")
        ? resolveActionParamRecord(node, def.params, msg)
        : undefined;
    const overrideParams = override.params && typeof override.params === "object" ? override.params : undefined;
    const mergedParams = (configParamRecord || overrideParams)
        ? Object.assign({}, configParamRecord, overrideParams)
        : undefined;

    // P118: resolve the explicit destination by mode.
    //   • url   → the `to` typedInput (msg/flow/global/jsonata/str), as P66.
    //   • route → the referenced route's path, with its :placeholders filled from
    //             the resolved params → an explicit, addressed location.
    //   • wire  → no explicit `to`; the receiving route supplies the path.
    // A msg.ui.action.to override (already a literal path) always wins.
    let resolvedTo;
    if (isNavigate && targetMode === "url") {
        resolvedTo = node
            ? resolveActionTo(node, def.to, def.toType, msg)
            : (def.to ? String(def.to) : undefined);
    }
    else if (isNavigate && targetMode === "route") {
        const template = resolveRouteIdToPath(def.routeId);
        resolvedTo = template
            ? resolveNavigationTarget(template, mergedParams || {}, {})
            : undefined;
    }
    else if (!isNavigate) {
        // Non-navigate verbs keep the legacy `to` passthrough (rarely set).
        resolvedTo = node
            ? resolveActionTo(node, def.to, def.toType, msg)
            : (def.to ? String(def.to) : undefined);
    }
    const to = override.to || resolvedTo || undefined;

    // P53 (ADR 0005): the command carries `target` (a rendered node id) and an
    // optional `part` (a sub-id within that element — accordion section, tree
    // branch, tab) for open/close/select granularity. msg.ui.action overrides win.
    return {
        type: String(type),
        to,
        params: mergedParams && Object.keys(mergedParams).length > 0 ? mergedParams : undefined,
        target: override.target || def.target || undefined,
        part: override.part || def.part || undefined
    };
}

// P70 Ebene 3: validate an asset id and resolve the absolute store URL to fetch.
// The real media-store URL is taken from the app's mediaStoreUrl config and NEVER
// leaves the server — the client only ever sees /webapp/<appId>/asset/<id>.
// Returns { ok:true, url } or { ok:false, status, error }. The id is constrained
// to a safe charset so it cannot traverse out of the store base path.
const ASSET_ID_PATTERN = /^[A-Za-z0-9._-]+$/;

function resolveAssetStoreUrl(appId, id, definitions) {
    if (typeof id !== "string" || !ASSET_ID_PATTERN.test(id) || id === "." || id === "..") {
        return { ok: false, status: 400, error: "Invalid asset id." };
    }
    const buckets = getDefinitionBuckets(appId, definitions);
    if (!buckets.app) {
        return { ok: false, status: 404, error: `Unknown app '${appId}'.` };
    }
    const storeUrl = buckets.app.mediaStoreUrl;
    if (!storeUrl || typeof storeUrl !== "string" || storeUrl.trim() === "") {
        return { ok: false, status: 404, error: "No media store is configured for this app." };
    }
    const base = storeUrl.replace(/\/+$/, "");
    return { ok: true, url: `${base}/${encodeURIComponent(id)}` };
}

function registerEndpoints(RED) {
    if (runtimeState.endpointsRegistered) {
        return;
    }

    // P69: seed additional icon libraries from RED settings (global / module
    // level) once, before any page render or manifest request.
    iconLibrary.seedFromSettings(RED.settings || {});

    // P69: icon manifest for the editor picker — the default (vendored Bootstrap)
    // set plus any registered libraries, each with its icon names. Served on the
    // admin endpoint because the picker runs in the Node-RED editor.
    RED.httpAdmin.get("/webapp/icons/manifest", (req, res) => {
        res.json(iconLibrary.buildIconManifest({ iconsDir: SHOELACE_ICONS_DIR }));
    });

    RED.httpAdmin.get("/webapp/apps", (req, res) => {
        const apps = readDeployDefinitions(RED)
            .filter((entry) => entry.type === "ui-app")
            .map((entry) => ({
                id: entry.id,
                // P109: `name` replaces `title`. Keep both for back-compat with
                // external callers that may still read `title`.
                name: entry.name,
                title: entry.name
            }))
            .sort((left, right) => left.id.localeCompare(right.id));

        res.json({ apps });
    });

    RED.httpAdmin.get("/webapp/:appId/model", (req, res) => {
        const { appId } = req.params;
        const buckets = getDefinitionBuckets(appId, readDeployDefinitions(RED));

        if (!buckets.app) {
            res.status(404).json({ error: `Unknown app '${appId}'.` });
            return;
        }

        res.json({
            appId,
            ...buckets
        });
    });

    RED.httpNode.get("/webapp/:appId", (req, res) => {
        const location = req.query.location ? String(req.query.location) : "/";
        const dialogId = req.query.dialog ? String(req.query.dialog) : undefined;
        const page = renderAppPage(req.params.appId, location, dialogId, readDeployDefinitions(RED));

        if (!page) {
            res.status(404).send("Unknown app.");
            return;
        }

        res.status(page.status).type("html").send(page.body);
    });

    // P31: live Server→Client SSE stream. The browser opens an EventSource here
    // with its clientId and current location; the runtime registers it and pushes
    // an initial snapshot immediately (which subsumes the P15 reconnect sync).
    // Thereafter, flow-driven ui-store updates push `snapshot` events and ui-action
    // interaction commands push `command` events to the relevant client(s).
    RED.httpNode.get("/webapp/:appId/stream", (req, res) => {
        const appId = resolveCanonicalAppId(req.params.appId, readDeployDefinitions(RED));
        const clientId = req.query.clientId ? String(req.query.clientId) : undefined;
        const location = req.query.location ? String(req.query.location) : "/";
        // The client passes the initial dialogId so the first snapshot mirrors the
        // server-rendered page (e.g. when ?dialog=<id> was in the page URL).
        const initialDialogId = req.query.dialog ? String(req.query.dialog) : undefined;
        // P112: per-page-load nonce — distinguishes a real arrival (new loadId →
        // onEnter/onLeave) from a transient EventSource reconnect (same loadId).
        const loadId = req.query.load ? String(req.query.load) : undefined;

        if (!clientId) {
            res.status(400).json({ error: "A clientId query parameter is required to subscribe." });
            return;
        }

        const buckets = getDefinitionBuckets(appId, readDeployDefinitions(RED));
        if (!buckets.app) {
            res.status(404).json({ error: `Unknown app '${appId}'.` });
            return;
        }

        res.status(200);
        res.set({
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive"
        });
        if (typeof res.flushHeaders === "function") {
            res.flushHeaders();
        }
        // Open the SSE comment line so proxies do not buffer the stream.
        res.write(":ok\n\n");

        addStreamClient(appId, clientId, res, location, loadId);

        // Initial sync: push the current live snapshot for this client immediately.
        // Pass the initialDialogId so the first push matches the server-rendered HTML
        // (prevents the SSE hydration from closing a dialog opened via ?dialog=<id>).
        const built = buildAppSnapshot(appId, location, initialDialogId, readDeployDefinitions(RED), clientId);
        if (built.success) {
            writeStreamEvent(res, "snapshot", { snapshot: built.snapshot });
        }

        req.on("close", () => {
            removeStreamClient(appId, clientId);
        });
    });

    // P30: client→server event ingest. The browser reports WHAT HAPPENED — a raw
    // event { clientId, event, sourceId, params } (events.md) — and the runtime
    // routes it to the originating node, emitting msg.ui on that node's OUTPUT
    // port into the wired flow. The runtime takes NO domain action. The wired flow
    // is the only place that may react; live push is via the SSE stream (P31).
    // The response echoes the emitted message and the CURRENT snapshot (unchanged —
    // a read-only re-render) so the thin client keeps a consistent view between pushes.
    RED.httpNode.post("/webapp/:appId/event", readJsonBody, (req, res) => {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const definitions = readDeployDefinitions(RED);
        const appId = resolveCanonicalAppId(req.params.appId, definitions);

        const dispatched = dispatchClientEvent(RED, appId, body, definitions);

        if (!dispatched.success) {
            res.status(dispatched.status).json({ error: dispatched.body });
            return;
        }

        const location = body.location ? String(body.location) : "/";
        const built = buildAppSnapshot(appId, location, undefined, definitions);

        if (!built.success) {
            res.status(built.status).json({ error: built.message });
            return;
        }

        res.json({
            message: dispatched.message,
            location,
            snapshot: built.snapshot
        });
    });

    // P225 (ADR 0037): browser-initiated dynamic-state write. A ui-alert whose
    // `duration` elapsed (and, in future, any client-side dynamic-state change)
    // POSTs `{ clientId, id, field, value }` here; we route it through the unified
    // `setDynamicStateField` write API so the hide is a real value transition
    // (bound → store write-through, unbound → per-client slot), not a DOM close.
    // MUST be registered before the catch-all `/webapp/:appId/*` page route.
    RED.httpNode.post("/webapp/:appId/dynamic-state", readJsonBody, (req, res) => {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const written = dispatchDynamicStateWrite(body);
        if (!written.success) {
            res.status(written.status).json({ error: written.body });
            return;
        }
        // setDynamicStateField already pushed a fresh snapshot to the affected
        // client(s); the response is a fire-and-report ack (the SSE stream is the
        // single source of re-renders — mirrors the /event contract).
        res.json({ ok: true, mode: written.result.mode });
    });

    // P70 Ebene 3: app-scoped media proxy. A ui-image src of `asset:<id>` is
    // rendered as /webapp/<appId>/asset/<id>; this endpoint resolves the app's
    // configured mediaStoreUrl server-side, fetches the asset, and streams it back
    // with the upstream content-type. The store URL is never disclosed to the
    // client (obfuscation), and the id is charset-validated (no path traversal).
    // MUST be registered before the catch-all `/webapp/:appId/*` page route.
    RED.httpNode.get("/webapp/:appId/asset/:id", (req, res) => {
        const { appId, id } = req.params;
        const resolved = resolveAssetStoreUrl(appId, id, readDeployDefinitions(RED));
        if (!resolved.ok) {
            res.status(resolved.status).json({ error: resolved.error });
            return;
        }
        fetch(resolved.url)
            .then((upstream) => {
                if (!upstream.ok) {
                    // Do not leak the upstream URL or body — only the status class.
                    res.status(upstream.status === 404 ? 404 : 502).json({ error: "Asset not available." });
                    return;
                }
                const contentType = upstream.headers.get("content-type") || "application/octet-stream";
                res.set("Content-Type", contentType);
                res.set("Cache-Control", "public, max-age=300");
                return upstream.arrayBuffer().then((buf) => {
                    res.status(200).send(Buffer.from(buf));
                });
            })
            .catch(() => {
                res.status(502).json({ error: "Asset fetch failed." });
            });
    });

    // P70 Ebene 3: editor media picker — list assets available in the store.
    // Proxies the store's listing endpoint (the store owns the catalogue); the
    // store URL stays server-side. Returns { assets: [{ id, name?, contentType? }] }.
    RED.httpAdmin.get("/webapp/:appId/assets", (req, res) => {
        const { appId } = req.params;
        const buckets = getDefinitionBuckets(appId, readDeployDefinitions(RED));
        if (!buckets.app) {
            res.status(404).json({ error: `Unknown app '${appId}'.` });
            return;
        }
        const storeUrl = buckets.app.mediaStoreUrl;
        if (!storeUrl || String(storeUrl).trim() === "") {
            res.json({ assets: [], mediaStoreConfigured: false });
            return;
        }
        const base = String(storeUrl).replace(/\/+$/, "");
        fetch(`${base}/`)
            .then((upstream) => upstream.ok ? upstream.json() : { assets: [] })
            .then((data) => {
                const assets = Array.isArray(data) ? data : (Array.isArray(data && data.assets) ? data.assets : []);
                res.json({ assets, mediaStoreConfigured: true });
            })
            .catch(() => {
                res.json({ assets: [], mediaStoreConfigured: true, error: "store-unreachable" });
            });
    });

    // P70 Ebene 3: editor media upload. The store owns persistence (open design
    // point: folder vs. service) — Node-RED stays a thin proxy. The editor sends
    // the raw image bytes (Content-Type = the image type, X-Asset-Name = filename);
    // the server POSTs them to the store and returns the assigned id. Requires a
    // configured mediaStoreUrl.
    RED.httpAdmin.post("/webapp/:appId/assets", readRawBody, (req, res) => {
        const { appId } = req.params;
        const buckets = getDefinitionBuckets(appId, readDeployDefinitions(RED));
        if (!buckets.app) {
            res.status(404).json({ error: `Unknown app '${appId}'.` });
            return;
        }
        const storeUrl = buckets.app.mediaStoreUrl;
        if (!storeUrl || String(storeUrl).trim() === "") {
            res.status(409).json({ error: "No media store is configured for this app." });
            return;
        }
        const body = Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.alloc(0);
        if (body.length === 0) {
            res.status(400).json({ error: "Empty upload." });
            return;
        }
        const base = String(storeUrl).replace(/\/+$/, "");
        const contentType = req.headers["content-type"] || "application/octet-stream";
        const name = req.headers["x-asset-name"] ? String(req.headers["x-asset-name"]) : undefined;
        fetch(base + "/", {
            method: "POST",
            headers: name
                ? { "Content-Type": contentType, "X-Asset-Name": name }
                : { "Content-Type": contentType },
            body
        })
            .then((upstream) => upstream.ok ? upstream.json().catch(() => ({})) : Promise.reject(new Error("store rejected")))
            .then((data) => {
                const id = data && (data.id || data.assetId);
                if (!id) {
                    res.status(502).json({ error: "Store did not return an asset id." });
                    return;
                }
                res.json({ id: String(id), name: name });
            })
            .catch(() => {
                res.status(502).json({ error: "Upload to media store failed." });
            });
    });

    // P106: JSON snapshot endpoint. The client polls this on tab re-focus
    // (visibilitychange) to pull the CURRENT model after a deploy it may have
    // missed while the tab was frozen/backgrounded, and on initial hydration.
    // Returns { snapshot, signature, mode } so the client can apply the same
    // in-place-vs-reload rule used for a live deploy push. MUST be registered
    // before the catch-all `/webapp/:appId/*` page route.
    RED.httpNode.get("/webapp/:appId/snapshot", (req, res) => {
        const location = req.query.location ? String(req.query.location) : "/";
        const dialogId = req.query.dialog ? String(req.query.dialog) : undefined;
        const clientId = req.query.clientId ? String(req.query.clientId) : undefined;
        const definitions = readDeployDefinitions(RED);
        const appId = resolveCanonicalAppId(req.params.appId, definitions);

        const built = buildAppSnapshot(appId, location, dialogId, definitions, clientId);
        if (!built.success) {
            res.status(built.status).json({ error: built.message });
            return;
        }

        res.json({
            snapshot: built.snapshot,
            signature: computeShellSignature(appId, definitions),
            mode: resolveAppMode(appId, definitions)
        });
    });

    RED.httpNode.get("/webapp/:appId/*", (req, res) => {
        const suffix = req.params[0] ? `/${req.params[0]}` : "/";
        const dialogId = req.query.dialog ? String(req.query.dialog) : undefined;
        const page = renderAppPage(req.params.appId, suffix, dialogId, readDeployDefinitions(RED));

        if (!page) {
            res.status(404).send("Unknown app.");
            return;
        }

        res.status(page.status).type("html").send(page.body);
    });

    runtimeState.endpointsRegistered = true;

    // P106: wire the deploy hook here (the path Node-RED actually runs). Each
    // node self-registers via registerNodeType → registerEndpoints; the legacy
    // registerWebappNodes() factory (which also called this) is NOT invoked by
    // Node-RED, so the old P37 flows:started listener never fired — the latent
    // "deploy delivers nothing to connected clients" bug. Wiring it once here
    // (guarded) is the fix.
    registerDeployHook(RED);
}

// P106: on every flow deploy, push the freshly-compiled model to every connected
// client so the UI auto-updates. The push carries a shell/topology signature +
// the app's deploy mode; the client decides in-place vs full reload (development)
// or shows a version alert (production) — see live-deploy-update.md. This
// SUBSUMES the old P37 `redeploy`-only broadcast (which reloaded unconditionally
// and pushed NO fresh model). Registered exactly once across all node-type
// registrations via the deployHookRegistered guard.
function registerDeployHook(RED) {
    if (runtimeState.deployHookRegistered) {
        return;
    }
    runtimeState.deployHookRegistered = true;

    RED.events.on("flows:started", function () {
        // Reset the per-app reactive-error dedup on every deploy: a fixed
        // expression should no longer be suppressed, and a newly-introduced
        // failure should report again.
        runtimeState.reactiveErrorKeys.clear();

        // P118 (ADR 0011 §3): the old P66 navigate cross-validation (wired +
        // `to` = ambiguous; no-destination; dead-link) is REMOVED. The explicit
        // target-source mode now stores the intent, so the wire-scan-based
        // ambiguity check is gegenstandslos; a nonsensical wiring is the user's
        // responsibility (owner decision) — there is no scan-based deploy check.

        // P108: cross-validate that all ui-app nodes have unique root paths.
        try {
            const rootIssues = validateAppRootUniqueness(RED);
            for (const issue of rootIssues) {
                const issueNode = RED.nodes.getNode(issue.nodeId);
                if (issueNode) {
                    issueNode.status({ fill: "red", shape: "ring", text: "duplicate root" });
                }
                reportRuntimeError(issueNode || undefined, {
                    severity: 'error',
                    code: 'duplicate-app-root',
                    message: issue.message,
                    context: { nodeId: issue.nodeId, appId: issue.appId, root: issue.root, op: 'deploy' }
                });
            }
        }
        catch (_e2) {
            // Never let validation crash the deploy.
        }

        // P168 (ADR 0018 §1): cross-validate ui-tab id uniqueness within each
        // ui-tabs — a duplicate aliases two tabs onto one panel.
        try {
            const tabIssues = validateUiTabChildrenUniqueness(RED);
            for (const issue of tabIssues) {
                const issueNode = RED.nodes.getNode(issue.nodeId);
                if (issueNode) {
                    issueNode.status({ fill: "red", shape: "ring", text: "duplicate tab id" });
                }
                reportRuntimeError(issueNode || undefined, {
                    severity: 'error',
                    code: 'duplicate-ui-tab-id',
                    message: issue.message,
                    context: { nodeId: issue.nodeId, tabsId: issue.host, tabId: issue.tabId, op: 'deploy' }
                });
            }
        }
        catch (_e3) {
            // Never let validation crash the deploy.
        }

        // P169 (ADR 0018 §1): cross-validate ui-accordion-section id uniqueness
        // within each ui-accordion — a duplicate aliases two sections onto one panel.
        try {
            const sectionIssues = validateUiAccordionSectionChildrenUniqueness(RED);
            for (const issue of sectionIssues) {
                const issueNode = RED.nodes.getNode(issue.nodeId);
                if (issueNode) {
                    issueNode.status({ fill: "red", shape: "ring", text: "duplicate section id" });
                }
                reportRuntimeError(issueNode || undefined, {
                    severity: 'error',
                    code: 'duplicate-ui-accordion-section-id',
                    message: issue.message,
                    context: { nodeId: issue.nodeId, accordionId: issue.host, sectionId: issue.sectionId, op: 'deploy' }
                });
            }
        }
        catch (_e4) {
            // Never let validation crash the deploy.
        }

        // P205 (Owner 2026-07-06): an app-scoped node (store/query/action/navigation/
        // dialog/route) must reference a real ui-app via `parent` — an empty / own-id
        // / non-app parent is a misconfiguration that otherwise renders silently.
        try {
            const parentIssues = validateAppScopedNodeParent(RED);
            for (const issue of parentIssues) {
                const issueNode = RED.nodes.getNode(issue.nodeId);
                if (issueNode) {
                    issueNode.status({ fill: "red", shape: "ring", text: "no app parent" });
                }
                reportRuntimeError(issueNode || undefined, {
                    severity: 'error',
                    code: 'app-scoped-node-no-app-parent',
                    message: issue.message,
                    context: { nodeId: issue.nodeId, parent: issue.parent, op: 'deploy' }
                });
            }
        }
        catch (_e5) {
            // Never let validation crash the deploy.
        }

        const deployedAt = Date.now();
        // Defer by one event-loop tick so pending connection-close callbacks
        // (req.on("close") → removeStreamClient) fire first. This avoids writing
        // the deploy frame to connections already closed by the browser.
        setImmediate(function () {
            let definitions;
            try {
                definitions = readDeployDefinitions(RED);
            }
            catch (_e) {
                // If the fresh definitions cannot be read, there is nothing safe to
                // push — leave connected clients on their current page.
                return;
            }

            // One deploy push per app: each app has its own signature, mode, and
            // its subscribers render at their own location with their own state.
            const appIds = new Set();
            for (const def of definitions) {
                if (def && def.type === "ui-app") {
                    if (def.root) { appIds.add(def.root); }
                    if (def.id) { appIds.add(def.id); }
                }
            }

            for (const appId of appIds) {
                try {
                    pushDeployToClients(appId, definitions, {
                        connectedBefore: deployedAt - 500,
                        requireLiveSocket: true
                    });
                }
                catch (_) {
                    // Never let one app's push failure abort the others.
                }
            }
        });
    });
}

function createNodeConstructor(RED, type, mapConfig, options = {}) {
    function WebappNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        let definition;

        try {
            definition = mapConfig(config);
        }
        catch (error) {
            node.status({ fill: "red", shape: "ring", text: "config error" });
            reportRuntimeError(node, {
                severity: "error",
                code: "server.mapConfig.failed",
                message: `Failed to map ${type} config: ${error instanceof Error ? error.message : String(error)}`,
                context: { appId: findAppIdForNode(node), nodeId: node.id, op: "mapConfig" }
            });
            return;
        }

        const validation = validateUiNodeDefinition(definition);

        // P59 / ADR 0007 §2: the input handler is attached even when the definition
        // fails schema validation. The runtime still RENDERS the node from its
        // mapConfig output (readDeployDefinitions bypasses validation), so an
        // interaction verb (open/close/select/show/…) targeting it must still push.
        // Before P59 the push lived centrally in ui-action and did not depend on the
        // target node carrying a handler; moving the push onto the target node would
        // otherwise silently drop verbs for any node whose definition is invalid.
        // The interaction handler only ever pushes for OWNED verbs; every other
        // message falls through to `next`, which no-ops gracefully when the node has
        // no registered definition (it reads runtimeState.definitions.get(node.id)).
        if (options.inputHandler) {
            node.on("input", function onInput(msg, send, done) {
                options.inputHandler(node, msg, send, done);
            });
        }

        if (!validation.success) {
            node.status({ fill: "red", shape: "ring", text: validation.error });
            reportRuntimeError(node, {
                severity: "error",
                code: "server.validation.failed",
                message: `Invalid ${type} definition: ${validation.error}`,
                context: { appId: findAppIdForNode(node), nodeId: node.id, op: "validateUiNodeDefinition" }
            });
            return;
        }

        const validDefinition = validation.data;
        node.webappDefinition = validDefinition;
        runtimeState.definitions.set(node.id, {
            nodeId: node.id,
            appId: validDefinition.type === "ui-app" ? validDefinition.id : undefined,
            definition: validDefinition
        });

        node.status({ fill: "green", shape: "dot", text: type });

        node.on("close", () => {
            runtimeState.definitions.delete(node.id);
        });
    }

    RED.nodes.registerType(type, WebappNode);
}

function getUiId(config) {
    return config.id;
}

function passThroughInputHandler(node, msg, send, done) {
    send(msg);
    if (done) {
        done();
    }
}

// P45: ui-toast input handler — push a toast command to connected SSE clients
// and forward the message on the output port so flows can chain further.
function toastInputHandler(node, msg, send, done) {
    const toastDefinition = node.webappDefinition;
    const activeAppId = getActiveRuntimeAppId();
    const uiMsg = msg && msg.ui && typeof msg.ui === "object" ? msg.ui : {};
    const clientId = uiMsg.clientId ? String(uiMsg.clientId) : undefined;

    if (activeAppId) {
        // Build the toast payload from the node definition + optional msg overrides.
        const toastPayload = {
            id: toastDefinition ? toastDefinition.id : node.id,
            message: uiMsg.toast && uiMsg.toast.message !== undefined ? String(uiMsg.toast.message)
                : (msg.payload !== undefined && msg.payload !== null ? String(msg.payload) : ""),
            severity: (uiMsg.toast && uiMsg.toast.severity) || (toastDefinition && toastDefinition.severity) || "info",
            // P254: duration is the auto-dismiss timeout (ms). msg overrides the
            // node default; an absent node default means 0 = no auto-dismiss (the
            // toast stays until the user closes it), matching the client timer.
            duration: (uiMsg.toast && uiMsg.toast.duration !== undefined ? Number(uiMsg.toast.duration)
                : (toastDefinition && toastDefinition.duration !== undefined ? toastDefinition.duration : 0)),
            position: (uiMsg.toast && uiMsg.toast.position) || (toastDefinition && toastDefinition.position) || "bottom-right"
        };
        pushToastToClients(activeAppId, clientId, toastPayload);
    }

    send(msg);
    if (done) {
        done();
    }
}

// Fire one query's refresh: flip its lifecycle to `loading`, push a snapshot so
// the spinner shows, and emit the refresh on its OUT-PORT carrying the current
// params. Split out of triggerParamQueryRefresh so the debounce branch can defer
// exactly this work per query.
function fireQueryRefresh(nodeId, queryPath, params, appId, clientId) {
    const RED = runtimeState.RED;
    if (!RED) {
        return;
    }
    let pushedLoading = false;
    if (appId) {
        const base = clientId
            ? (getClientState(appId, clientId)?.state || clone(runtimeState.liveState.get(appId)))
            : clone(runtimeState.liveState.get(appId));
        if (base) {
            const nextState = applyQueryMessage(base, { queryPath, refresh: true });
            if (nextState) {
                if (clientId) {
                    setClientState(appId, clientId, nextState, Date.now());
                }
                else {
                    runtimeState.liveState.set(appId, nextState);
                }
                pushedLoading = true;
            }
        }
    }
    const queryNode = RED.nodes.getNode(nodeId);
    if (queryNode && typeof queryNode.send === "function") {
        const query = { queryPath, refresh: true };
        if (params !== undefined) {
            query.params = clone(params);
        }
        const refreshMsg = { ui: { query } };
        // Carry clientId so the wired fetch can target the same client on its
        // data return (P15 per-client model).
        if (clientId) {
            refreshMsg.ui.clientId = clientId;
        }
        queryNode.send(refreshMsg);
    }
    // Push the loading state so it reaches the client(s) immediately, before the
    // wired fetch returns.
    if (pushedLoading && appId) {
        pushSnapshotToClients(appId, clientId, readDeployDefinitions(RED));
    }
}

// P212 (ADR 0029): resolve a referenced ui-query by its definition id to the
// runtime node id (needed by fireQueryRefresh / RED.nodes.getNode) and its
// declared queryPath (needed for the wire-mode envelope). Returns undefined when
// no ui-query with that id is registered.
function findQueryRegistrationById(queryId) {
    if (!queryId) {
        return undefined;
    }
    for (const registration of runtimeState.definitions.values()) {
        const def = registration.definition;
        if (def && def.type === "ui-query" && def.id === queryId) {
            return { nodeId: registration.nodeId, queryPath: def.queryPath };
        }
    }
    return undefined;
}

// P213 (ADR 0029): reference-mode `replace` — write a query's data DIRECTLY into
// the live envelope at `ui.queries.<queryPath>`, per-client via clientId (else the
// broadcast state), then push a fresh snapshot so every `query:`-bound view shows
// the new rows live. Reuses applyQueryMessage (the P160 fold) — the SAME apply path
// as the wired data return in queryInputHandler, so `replace` is the typed form of
// `msg.ui.query.data`. data absorption stays terminal (no loop). `queryMsg` is a
// { queryPath, data, totalCount?, pageCount? } envelope.
function applyQueryDataDirect(queryMsg, appId, clientId) {
    const RED = runtimeState.RED;
    if (!RED || !appId) {
        return;
    }
    const definitions = readDeployDefinitions(RED);
    const queryDefs = getDefinitionBuckets(appId, definitions).queries;
    const seed = () => initializeState([], queryDefs, appId);
    const base = clientId
        ? (getClientState(appId, clientId)?.state || clone(runtimeState.liveState.get(appId) || seed()))
        : clone(runtimeState.liveState.get(appId) || seed());
    const nextState = applyQueryMessage(base, queryMsg);
    if (nextState) {
        if (clientId) {
            setClientState(appId, clientId, nextState, Date.now());
        }
        else {
            runtimeState.liveState.set(appId, nextState);
        }
        pushSnapshotToClients(appId, clientId, definitions);
    }
}

// P212/P213 (ADR 0029): typed, reference-based node for a ui-query (hybrid
// wire|reference). The `action` selector picks the direction:
//   - `refresh` (P212, trigger-out): every input fires the referenced query's
//     refresh. reference → fireQueryRefresh DIRECTLY (server-side, per-client via
//     msg.ui.clientId) so the query's out-port emits its retrieval; wire → emit
//     msg.ui.query = { queryPath, refresh:true, params }. Params source:
//     msg.ui.query.params › msg.payload; absent → NO `params` key.
//   - `replace` (P213, data-in): msg.payload becomes the query's data. reference →
//     write ui.queries.<queryPath>.data DIRECTLY (per-client, SSE re-render);
//     wire → emit msg.ui.query = { queryPath, data, totalCount?, pageCount? }. Data
//     source: msg.payload; NO payload (undefined/null) → data is [] (an explicit
//     replace-to-empty; replace always writes a data envelope). Optional
//     totalCount/pageCount ride along when present on msg.ui.query.*.
function queryActionInputHandler(node, msg, send, done) {
    const actionDefinition = node.webappDefinition;
    const mode = actionDefinition && actionDefinition.mode === "wire" ? "wire" : "reference";
    const action = actionDefinition && actionDefinition.action === "replace" ? "replace" : "refresh";
    const queryId = actionDefinition && actionDefinition.query;

    const uiQuery = msg && msg.ui && typeof msg.ui === "object" ? msg.ui.query : undefined;
    const activeAppId = findAppIdForNode(node);
    const clientId = msg && msg.ui && msg.ui.clientId ? String(msg.ui.clientId) : undefined;

    const queryRegistration = findQueryRegistrationById(queryId);
    if (!queryRegistration) {
        const errMsg = `ui-query-action references an unknown query '${queryId}'.`;
        reportRuntimeError(node, {
            severity: "error",
            code: "server.query.action-missing-query",
            message: errMsg,
            context: {
                appId: activeAppId || undefined,
                nodeId: node.id,
                op: action === "replace" ? "query:replace" : "query:refresh"
            },
            clientId
        });
        if (done) {
            done(new Error(errMsg));
        }
        return;
    }

    // -- action=replace: the DATA-IN side. msg.payload becomes the query's data. --
    if (action === "replace") {
        // Data source: msg.payload. No payload (undefined/null) → replace with an
        // empty list ([]); replace always writes a data envelope (documented P213).
        const payload = msg ? msg.payload : undefined;
        const data = payload !== undefined && payload !== null ? payload : [];
        const query = { queryPath: queryRegistration.queryPath, data };
        // Optional paging metadata rides along when present on msg.ui.query.*.
        if (uiQuery && typeof uiQuery === "object") {
            if (Object.prototype.hasOwnProperty.call(uiQuery, "totalCount")) {
                query.totalCount = uiQuery.totalCount;
            }
            if (Object.prototype.hasOwnProperty.call(uiQuery, "pageCount")) {
                query.pageCount = uiQuery.pageCount;
            }
        }
        if (mode === "wire") {
            // wire: EMIT the data envelope; do NOT mutate the query state.
            const outMsg = {
                ...msg,
                ui: {
                    ...(msg && msg.ui && typeof msg.ui === "object" ? msg.ui : {}),
                    query
                }
            };
            send(outMsg);
            if (done) {
                done();
            }
            return;
        }
        // reference: write the query's data DIRECTLY (per-client, SSE re-render).
        // The action node itself does not emit in reference mode.
        applyQueryDataDirect(query, activeAppId, clientId);
        if (done) {
            done();
        }
        return;
    }

    // -- action=refresh (P212): trigger the referenced query. --
    // Params source: msg.ui.query.params › msg.payload; absent → omit the key.
    const uiQueryParams = uiQuery && typeof uiQuery === "object" ? uiQuery.params : undefined;
    let params = uiQueryParams !== undefined
        ? uiQueryParams
        : (msg ? msg.payload : undefined);
    // P214 (ADR 0030): a ui-query-action refresh must ALSO carry the query's
    // CURRENT params (from its resolved params store — implicit slice or explicit
    // ui-store — for this clientId) when the message supplied none, so every refresh
    // route pages/sorts/searches. When no params exist yet the key stays omitted
    // (P212 contract), because resolveCurrentQueryParams returns undefined.
    if (params === undefined) {
        const queryDef = findQueryDefinitionById(queryId);
        params = resolveCurrentQueryParams(queryDef, activeAppId, clientId);
    }

    // -- wire mode: emit the refresh envelope; do NOT trigger. --
    if (mode === "wire") {
        const query = { queryPath: queryRegistration.queryPath, refresh: true };
        if (params !== undefined) {
            query.params = params;
        }
        const outMsg = {
            ...msg,
            ui: {
                ...(msg && msg.ui && typeof msg.ui === "object" ? msg.ui : {}),
                query
            }
        };
        send(outMsg);
        if (done) {
            done();
        }
        return;
    }

    // -- reference mode: fire the referenced query's refresh directly. --
    fireQueryRefresh(queryRegistration.nodeId, queryRegistration.queryPath, params, activeAppId, clientId);
    if (done) {
        done();
    }
}

// P161 (ADR 0016 §3): a ui-query OBSERVES its declared `params`-store reference.
// When that store changes, every query whose `params` points at it emits a
// REFRESH on its OUT-PORT — carrying the store's CURRENT value as
// `msg.ui.query.params` so the wired fetch can page/sort/search by it — and its
// lifecycle flips to `loading` (pushed to the same target the store write hit:
// the per-client state when `clientId` is given, else the broadcast state). The
// data return is NOT here: it arrives later on the IN-PORT (queryInputHandler),
// so there is no loop. `paramsValue`/`appId`/`clientId` are optional: callers
// that don't carry them (legacy) still get the bare refresh + out-port emit.
// Optional per-query `debounceMs` coalesces rapid changes (search-as-you-type).
function triggerParamQueryRefresh(storeId, paramsValue, appId, clientId) {
    const RED = runtimeState.RED;
    if (!RED) {
        return;
    }
    const params = paramsValue !== undefined ? clone(paramsValue) : undefined;
    for (const registration of runtimeState.definitions.values()) {
        const def = registration.definition;
        if (def.type !== "ui-query") {
            continue;
        }
        // P161 (ADR 0016 §3): the query OBSERVES an explicit external params-store.
        // P214 (ADR 0030): with NO explicit params store, the query observes its OWN
        // implicit per-query params store — addressed by the query's own node id. A
        // write to either fires this query's out-port refresh identically.
        const explicitParams = blankToUndefined(def.params);
        const observesExplicit = explicitParams !== undefined && explicitParams === storeId;
        const observesImplicit = explicitParams === undefined && def.id === storeId;
        if (!observesExplicit && !observesImplicit) {
            continue;
        }
        const debounceMs = typeof def.debounceMs === "number" && def.debounceMs > 0 ? def.debounceMs : 0;
        if (debounceMs === 0) {
            fireQueryRefresh(registration.nodeId, def.queryPath, params, appId, clientId);
            continue;
        }
        // Debounced: coalesce rapid changes (search-as-you-type). Keep the LATEST
        // params; reset the timer on each change. Keyed by node id so concurrent
        // queries don't clobber each other.
        const existing = runtimeState.queryDebounceTimers.get(registration.nodeId);
        if (existing) {
            clearTimeout(existing);
        }
        const nodeId = registration.nodeId;
        const queryPath = def.queryPath;
        const timer = setTimeout(() => {
            runtimeState.queryDebounceTimers.delete(nodeId);
            fireQueryRefresh(nodeId, queryPath, params, appId, clientId);
        }, debounceMs);
        if (typeof timer.unref === "function") {
            timer.unref();
        }
        runtimeState.queryDebounceTimers.set(nodeId, timer);
    }
}

function queryInputHandler(node, msg, send, done) {
    const queryMsg = msg && msg.ui && typeof msg.ui === "object" ? msg.ui.query : undefined;
    if (queryMsg && typeof queryMsg === "object" && typeof queryMsg.etag === "string") {
        const cacheKey = `${node.id}::${queryMsg.queryPath || ""}`;
        const lastEtag = runtimeState.queryEtags.get(cacheKey);
        if (lastEtag === queryMsg.etag) {
            if (done) {
                done();
            }
            return;
        }
        runtimeState.queryEtags.set(cacheKey, queryMsg.etag);
    }

    // P160: persist a recognised query push (data / error / refresh) into the
    // live query envelope at `ui.queries.<queryPath>`, then push a fresh snapshot
    // so every `query:`-bound view updates live. This is the wired data path:
    //   onEnter/trigger → ui-query (pass-through) → data source → back to in-port
    //   with msg.ui.query.data → here it lands in state → query:<path> binds it.
    // Targeted (msg.ui.clientId) pushes update only that client's state; an
    // unaddressed push updates the shared broadcast state.
    // P175: data/error returns are TERMINAL — they are absorbed here and NOT
    // forwarded to the out-port (would cause out→source→in→out→… infinite loop).
    // Only triggers / refresh / loading / foreign messages pass through (send).
    let isTerminalReturn = false;
    // P218 (ADR 0033): true when a refresh/loading COMMAND was recognised and
    // applied here (lifecycle → loading). That command is now consumed, so the
    // trigger we forward to the datasource must be a CLEAN re-emit — see below.
    let appliedTrigger = false;
    if (queryMsg && typeof queryMsg === "object" && queryMsg.queryPath) {
        const appId = findAppIdForNode(node);
        if (appId) {
            const clientId = msg && msg.ui && msg.ui.clientId ? String(msg.ui.clientId) : undefined;
            const RED = runtimeState.RED;
            const definitions = RED ? readDeployDefinitions(RED) : [];
            const queryDefs = getDefinitionBuckets(appId, definitions).queries;
            const seed = () => initializeState([], queryDefs, appId);
            const base = clientId
                ? (getClientState(appId, clientId)?.state || clone(runtimeState.liveState.get(appId) || seed()))
                : clone(runtimeState.liveState.get(appId) || seed());

            const nextState = applyQueryMessage(base, queryMsg);
            if (nextState) {
                if (clientId) {
                    setClientState(appId, clientId, nextState, Date.now());
                }
                else {
                    runtimeState.liveState.set(appId, nextState);
                }
                if (RED) {
                    pushSnapshotToClients(appId, clientId, definitions);
                }
                // data/error are terminal returns from the data source — absorb.
                if (
                    Object.prototype.hasOwnProperty.call(queryMsg, "data") ||
                    Object.prototype.hasOwnProperty.call(queryMsg, "error")
                ) {
                    isTerminalReturn = true;
                }
                else {
                    // A recognised refresh / loading command was applied (consumed).
                    appliedTrigger = true;
                }
            }
        }
    }

    if (!isTerminalReturn) {
        // P214 (ADR 0030): every trigger heading to the datasource carries the
        // query's CURRENT params (implicit slice or explicit store, per clientId),
        // so a plain refresh / onEnter that arrived WITHOUT params still pages/
        // sorts/searches correctly. A foreign pass-through is returned unchanged
        // (same object) so the P175 contract holds; the data/error terminal path
        // above is never reached here.
        let outMsg = enrichTriggerWithCurrentParams(node, msg);
        // P218 (ADR 0033): when the incoming message was a CONSUMED refresh/loading
        // command, re-emit a CLEAN fetch trigger. `enrichTriggerWithCurrentParams`
        // already builds a fresh `msg.ui.query` = { queryPath, refresh, params };
        // additionally DROP the incoming `msg.payload` so the stale trigger payload
        // is NOT re-consumed downstream as query DATA (a `replace`) — the owner's
        // refresh→replace double-processing bug. Foreign / unrecognised pass-throughs
        // are NOT consumed commands and keep their payload untouched (byte-identical).
        if (appliedTrigger && outMsg && typeof outMsg === "object"
            && Object.prototype.hasOwnProperty.call(outMsg, "payload")) {
            if (outMsg === msg) {
                outMsg = { ...msg, ui: { ...(msg.ui && typeof msg.ui === "object" ? msg.ui : {}) } };
            }
            delete outMsg.payload;
        }
        send(outMsg);
    }
    if (done) {
        done();
    }
}

// P209 (ADR 0028): resolve the referenced ui-store DEFINITION (statePath, scope,
// initialValue) by node id from the live registry.
function findStoreDefinitionById(storeId) {
    if (!storeId) {
        return undefined;
    }
    for (const registration of runtimeState.definitions.values()) {
        const def = registration.definition;
        if (def && def.type === "ui-store" && def.id === storeId) {
            return def;
        }
    }
    return undefined;
}

// P214 (ADR 0030): every ui-query implicitly owns a per-client params store slice
// at `ui.queries.<queryPath>.params` — no separate node. Resolve a store reference
// id that points at a ui-query into a SYNTHETIC store definition targeting that
// slice, so ui-store-action (write), ui-store-read (read) and applyStoreOperation
// treat it exactly like a real ui-store (id + one-level sub-path, ADR 0013). The
// synthetic def carries no `scope` (⇒ "any", never rejects) and an empty-object
// initialValue so `reset` clears the params. `__queryParamsStore` marks it so the
// action handler can fire the query's reactive refresh after a write.
function findQueryParamsStoreDefinitionById(storeId) {
    if (!storeId) {
        return undefined;
    }
    for (const registration of runtimeState.definitions.values()) {
        const def = registration.definition;
        if (def && def.type === "ui-query" && def.id === storeId && def.queryPath) {
            return {
                type: "ui-store",
                id: def.id,
                name: def.name || undefined,
                statePath: `ui.queries.${def.queryPath}.params`,
                initialValue: {},
                __queryParamsStore: true,
                queryPath: def.queryPath,
                queryNodeId: registration.nodeId
            };
        }
    }
    return undefined;
}

// P214 (ADR 0030): resolve a `store` reference id to its definition — a real
// ui-store first (unchanged), else a ui-query's implicit params-store slice. A real
// ui-store and a ui-query can never share an id, so the order only matters for the
// (impossible) collision; real stores win by construction.
function resolveStoreReferenceById(storeId) {
    return findStoreDefinitionById(storeId) || findQueryParamsStoreDefinitionById(storeId);
}

// P214: fetch a ui-query DEFINITION by its definition id (params field, queryPath).
function findQueryDefinitionById(queryId) {
    if (!queryId) {
        return undefined;
    }
    for (const registration of runtimeState.definitions.values()) {
        const def = registration.definition;
        if (def && def.type === "ui-query" && def.id === queryId) {
            return def;
        }
    }
    return undefined;
}

// P214: fetch a ui-query DEFINITION by its runtime node id (the queryInputHandler
// receives a `node`, whose webappDefinition is the def when present, but test
// doubles register the def only in the definitions map).
function findQueryDefinitionByNodeId(nodeId) {
    if (!nodeId) {
        return undefined;
    }
    for (const registration of runtimeState.definitions.values()) {
        if (registration.nodeId === nodeId && registration.definition && registration.definition.type === "ui-query") {
            return registration.definition;
        }
    }
    return undefined;
}

// P214 (ADR 0030, acceptance „Params bei JEDEM Out-Port-Refresh"): resolve a
// query's CURRENT params value from its RESOLVED params store — the explicit
// `ui-store` when the `params` field is set, else the implicit per-query slice at
// `ui.queries.<queryPath>.params` — read for the given `clientId` (per-client) or
// the broadcast state. Returns a clone, or undefined when no params exist yet (so
// callers can OMIT the key rather than attach an empty object). This is the single
// lookup every out-port refresh route uses to enrich `msg.ui.query.params`.
function resolveCurrentQueryParams(queryDef, appId, clientId) {
    if (!queryDef || !appId) {
        return undefined;
    }
    const explicitStoreId = blankToUndefined(queryDef.params);
    let statePath;
    if (explicitStoreId) {
        const storeDef = findStoreDefinitionById(explicitStoreId);
        if (!storeDef) {
            return undefined;
        }
        statePath = storeDef.statePath;
    }
    else if (queryDef.queryPath) {
        statePath = `ui.queries.${queryDef.queryPath}.params`;
    }
    else {
        return undefined;
    }
    const base = clientId
        ? (getClientState(appId, clientId)?.state || runtimeState.liveState.get(appId))
        : runtimeState.liveState.get(appId);
    if (!base) {
        return undefined;
    }
    const value = getValueAtPath(base, statePath);
    return value !== undefined ? clone(value) : undefined;
}

// P214 (ADR 0030): enrich a query TRIGGER heading to the datasource with the
// query's CURRENT params, so EVERY out-port refresh (onEnter, plain refresh
// message, unrecognised pass-through trigger) carries paging/sort/search — not
// only the reactive params-store path. Rules that keep the P175 pass-through
// contract intact:
//   • a truly FOREIGN message (no `msg.ui`, or `msg.ui` without a `query` object
//     and not an `onEnter` lifecycle) is returned BYTE-IDENTICAL (same ref);
//   • params a caller ALREADY supplied on `msg.ui.query.params` are never
//     clobbered (explicit incoming wins over stored);
//   • when no params exist yet, the message is returned unchanged (nothing to
//     attach). Only when there ARE params AND the message is a recognised trigger
//     is an enriched COPY returned (the caller's object is not mutated).
function enrichTriggerWithCurrentParams(node, msg) {
    if (!msg || typeof msg !== "object" || !msg.ui || typeof msg.ui !== "object") {
        return msg;
    }
    const ui = msg.ui;
    const hasQuery = ui.query && typeof ui.query === "object";
    const isOnEnter = ui.event === "onEnter";
    if (!hasQuery && !isOnEnter) {
        return msg;
    }
    if (hasQuery && Object.prototype.hasOwnProperty.call(ui.query, "params") && ui.query.params !== undefined) {
        return msg;
    }
    const queryDef = node && node.webappDefinition && node.webappDefinition.type === "ui-query"
        ? node.webappDefinition
        : findQueryDefinitionByNodeId(node && node.id);
    if (!queryDef || !queryDef.queryPath) {
        return msg;
    }
    const appId = findAppIdForNode(node);
    const clientId = ui.clientId ? String(ui.clientId) : undefined;
    const params = resolveCurrentQueryParams(queryDef, appId, clientId);
    if (params === undefined) {
        return msg;
    }
    const nextQuery = hasQuery
        ? { ...ui.query, params }
        : { queryPath: queryDef.queryPath, params };
    return { ...msg, ui: { ...ui, query: nextQuery } };
}

// P209 (ADR 0028): the on-demand store reader. Every incoming message triggers a
// read; the node is NON-mutating (no setClientState / liveState write, no
// pushSnapshotToClients). Path precedence: msg.ui.store.path › msg.path › config
// path › whole slice. Per-client via msg.ui.clientId; a client-only store read
// without a clientId is a structured scope error (mirrors the write path).
function storeReadInputHandler(node, msg, send, done) {
    const readDefinition = node.webappDefinition;
    const activeAppId = findAppIdForNode(node);
    const clientId = msg && msg.ui && msg.ui.clientId ? String(msg.ui.clientId) : undefined;

    const storeDefinition = resolveStoreReferenceById(readDefinition && readDefinition.store);
    if (!storeDefinition) {
        const errMsg = `ui-store-read references an unknown store '${readDefinition && readDefinition.store}'.`;
        reportRuntimeError(node, {
            severity: "error",
            code: "server.store.read-missing-store",
            message: errMsg,
            context: { appId: activeAppId || undefined, nodeId: node.id, op: "store:read" },
            clientId
        });
        if (done) {
            done(new Error(errMsg));
        }
        return;
    }

    // Scope guard — mirror the ui-store write path. "any" (default) never rejects.
    const scope = storeDefinition.scope;
    if (scope === "broadcast-only" && clientId) {
        const errMsg = "ClientID auf Broadcast-Only-Store nicht erlaubt. Broadcast Only store does not accept per-client reads.";
        reportRuntimeError(node, {
            severity: "error",
            code: "server.store.scope-violation",
            message: errMsg,
            context: { appId: activeAppId || undefined, nodeId: node.id, op: "store:read" },
            clientId
        });
        if (done) {
            done(new Error(errMsg));
        }
        return;
    }
    if (scope === "client-only" && !clientId) {
        const errMsg = "Broadcast nicht erlaubt: Store ist Client Only. Client Only store requires a clientId.";
        reportRuntimeError(node, {
            severity: "error",
            code: "server.store.scope-violation",
            message: errMsg,
            context: { appId: activeAppId || undefined, nodeId: node.id, op: "store:read" },
            clientId: undefined
        });
        if (done) {
            done(new Error(errMsg));
        }
        return;
    }

    if (!activeAppId) {
        reportRuntimeError(node, {
            severity: "error",
            code: "server.store.no-active-app",
            message: "No active ui-app is registered for ui-store-read reads.",
            context: { nodeId: node.id, op: "store:read" },
            clientId
        });
        if (done) {
            done(new Error("No active ui-app is registered for ui-store-read reads."));
        }
        return;
    }

    // Path precedence: msg.ui.store.path › msg.path › config path › (none).
    const msgStorePath = msg && msg.ui && msg.ui.store && typeof msg.ui.store === "object"
        ? blankToUndefined(msg.ui.store.path)
        : undefined;
    const msgPath = msg ? blankToUndefined(msg.path) : undefined;
    const configPath = blankToUndefined(readDefinition.path);
    const subPath = msgStorePath !== undefined
        ? msgStorePath
        : (msgPath !== undefined ? msgPath : configPath);

    const rootPath = storeDefinition.statePath;
    const fullPath = joinStatePath(rootPath, subPath) || rootPath;

    // Read the CURRENT state — per-client when addressed, else broadcast. Falls
    // back to the initial slice if the client/app has no state yet. NON-mutating.
    const baseState = clientId
        ? (getClientState(activeAppId, clientId)?.state || clone(runtimeState.liveState.get(activeAppId) || initializeState([storeDefinition], [], activeAppId)))
        : clone(runtimeState.liveState.get(activeAppId) || initializeState([storeDefinition], [], activeAppId));

    const value = clone(getValueAtPath(baseState, fullPath));

    const outMsg = {
        ...msg,
        payload: value,
        ui: {
            ...(msg && msg.ui && typeof msg.ui === "object" ? msg.ui : {}),
            store: {
                id: storeDefinition.id,
                event: "read",
                path: subPath,
                fullPath,
                value,
                clientId: clientId || undefined
            }
        }
    };
    send(outMsg);
    if (done) {
        done();
    }
}

// P211 (ADR 0029): typed, reference-based store MUTATION. Two modes mirror
// ui-action.targetMode:
//   - reference: apply the op DIRECTLY to the referenced store, server-side
//     (per-client via msg.ui.clientId, same scope rule as writing), persist the
//     new state, push a fresh snapshot so a store-bound view updates live, and
//     emit the store `changed` notification on the out-port. No wire needed.
//   - wire: do NOT mutate; emit msg.ui.store = { id, op, path, value } on the
//     out-port for the flow to wire to the ui-store (or a dispatcher).
// Value comes from msg.payload (set/patch/replace); `reset` ignores it. Path
// precedence: msg.ui.store.path › msg.path › config path › whole slice.
function storeActionInputHandler(node, msg, send, done) {
    const actionDefinition = node.webappDefinition;
    const op = (actionDefinition && actionDefinition.op) || "set";
    const mode = actionDefinition && actionDefinition.mode === "wire" ? "wire" : "reference";
    const storeId = actionDefinition && actionDefinition.store;

    // Path precedence: msg.ui.store.path › msg.path › config path › (none).
    const msgStorePath = msg && msg.ui && msg.ui.store && typeof msg.ui.store === "object"
        ? blankToUndefined(msg.ui.store.path)
        : undefined;
    const msgPath = msg ? blankToUndefined(msg.path) : undefined;
    const configPath = blankToUndefined(actionDefinition && actionDefinition.path);
    const subPath = msgStorePath !== undefined
        ? msgStorePath
        : (msgPath !== undefined ? msgPath : configPath);

    // Value from payload; `reset` ignores it.
    const value = op === "reset" ? undefined : (msg ? msg.payload : undefined);

    // -- wire mode: emit the command envelope; do NOT mutate. --
    if (mode === "wire") {
        const outMsg = {
            ...msg,
            ui: {
                ...(msg && msg.ui && typeof msg.ui === "object" ? msg.ui : {}),
                store: {
                    id: storeId,
                    op,
                    path: subPath,
                    value
                }
            }
        };
        send(outMsg);
        if (done) {
            done();
        }
        return;
    }

    // -- reference mode: apply directly, server-side. --
    const activeAppId = findAppIdForNode(node);
    const clientId = msg && msg.ui && msg.ui.clientId ? String(msg.ui.clientId) : undefined;

    const storeDefinition = resolveStoreReferenceById(storeId);
    if (!storeDefinition) {
        const errMsg = `ui-store-action references an unknown store '${storeId}'.`;
        reportRuntimeError(node, {
            severity: "error",
            code: "server.store.action-missing-store",
            message: errMsg,
            context: { appId: activeAppId || undefined, nodeId: node.id, op: `store:${op}` },
            clientId
        });
        if (done) {
            done(new Error(errMsg));
        }
        return;
    }

    // Scope guard — mirror the ui-store write path. "any" (default) never rejects.
    const scope = storeDefinition.scope;
    if (scope === "broadcast-only" && clientId) {
        const errMsg = "ClientID auf Broadcast-Only-Store nicht erlaubt. Broadcast Only store does not accept per-client messages.";
        reportRuntimeError(node, {
            severity: "error",
            code: "server.store.scope-violation",
            message: errMsg,
            context: { appId: activeAppId || undefined, nodeId: node.id, op: `store:${op}` },
            clientId
        });
        if (done) {
            done(new Error(errMsg));
        }
        return;
    }
    if (scope === "client-only" && !clientId) {
        const errMsg = "Broadcast nicht erlaubt: Store ist Client Only. Client Only store requires a clientId.";
        reportRuntimeError(node, {
            severity: "error",
            code: "server.store.scope-violation",
            message: errMsg,
            context: { appId: activeAppId || undefined, nodeId: node.id, op: `store:${op}` },
            clientId: undefined
        });
        if (done) {
            done(new Error(errMsg));
        }
        return;
    }

    // Value presence — set/patch/replace require a value (from payload).
    // delete/reset do not. (Path is NOT required: an empty path targets the
    // whole slice at statePath, per the P211 precedence rule.)
    if (["set", "patch", "replace"].includes(op) && value === undefined) {
        const errMsg = `Store operation '${op}' requires a value (msg.payload).`;
        reportRuntimeError(node, {
            severity: "error",
            code: "server.store.invalid-operation",
            message: errMsg,
            context: { appId: activeAppId || undefined, nodeId: node.id, op: `store:${op}` },
            clientId
        });
        if (done) {
            done(new Error(errMsg));
        }
        return;
    }

    if (!activeAppId) {
        reportRuntimeError(node, {
            severity: "error",
            code: "server.store.no-active-app",
            message: "No active ui-app is registered for ui-store-action writes.",
            context: { nodeId: node.id, op: `store:${op}` },
            clientId
        });
        if (done) {
            done(new Error("No active ui-app is registered for ui-store-action writes."));
        }
        return;
    }

    const operation = { id: storeDefinition.id, op, path: subPath, value };

    const baseState = clientId
        ? (getClientState(activeAppId, clientId)?.state || clone(runtimeState.liveState.get(activeAppId) || initializeState([storeDefinition], [], activeAppId)))
        : clone(runtimeState.liveState.get(activeAppId) || initializeState([storeDefinition], [], activeAppId));

    let applied;
    try {
        applied = applyStoreOperation(baseState, storeDefinition, operation);
    }
    catch (error) {
        reportRuntimeError(node, {
            severity: "error",
            code: "server.store.operation-failed",
            message: `ui-store-action operation failed: ${error instanceof Error ? error.message : String(error)}`,
            context: { appId: activeAppId, nodeId: node.id, op: `store:${op}` },
            clientId
        });
        if (done) {
            done(error instanceof Error ? error : new Error(String(error)));
        }
        return;
    }

    const now = Date.now();
    if (clientId) {
        setClientState(activeAppId, clientId, applied.nextState, now);
    }
    else {
        runtimeState.liveState.set(activeAppId, applied.nextState);
    }

    const notificationMsg = {
        ...msg,
        ui: {
            ...(msg && msg.ui && typeof msg.ui === "object" ? msg.ui : {}),
            store: {
                ...applied.notification.ui.store,
                clientId: clientId || undefined
            }
        }
    };
    send(notificationMsg);

    // P161 (ADR 0016 §3): a query observing THIS store re-fetches via its out-port.
    const paramsValue = getValueAtPath(applied.nextState, storeDefinition.statePath);
    triggerParamQueryRefresh(storeDefinition.id, paramsValue, activeAppId, clientId);

    // Live push — the state changed; push a fresh snapshot to the targeted client
    // (per-client) or every subscriber (broadcast).
    const RED = runtimeState.RED;
    if (RED) {
        pushSnapshotToClients(activeAppId, clientId, readDeployDefinitions(RED));
    }

    if (done) {
        done();
    }
}

function componentStateInputHandler(node, msg, send, done) {
    const componentMsg = msg && msg.ui && typeof msg.ui === "object" ? msg.ui.component : undefined;

    if (componentMsg && typeof componentMsg === "object" && typeof componentMsg.op === "string") {
        const op = componentMsg.op;
        const validOps = ["show", "hide", "enable", "disable", "focus", "reset"];

        if (!validOps.includes(op)) {
            if (done) {
                done();
            }
            return;
        }

        if (!componentMsg.id) {
            if (done) {
                done();
            }
            return;
        }

        send(msg);
        if (done) {
            done();
        }
        return;
    }

    send(msg);
    if (done) {
        done();
    }
}

function dialogInputHandler(node, msg, send, done) {
    const dialogMsg = msg && msg.ui && typeof msg.ui === "object" ? msg.ui.dialog : undefined;

    if (dialogMsg && typeof dialogMsg === "object" && typeof dialogMsg.op === "string") {
        const op = dialogMsg.op;
        const validOps = ["open", "close", "toggle"];

        if (!validOps.includes(op)) {
            // Unknown op → NOT successful processing → discard (no send); the
            // envelope is irrelevant (nothing forwarded).
            if (done) {
                done();
            }
            return;
        }

        // P218 (ADR 0033): the dialog op was successfully consumed — strip
        // `msg.ui.dialog` before forwarding so a downstream ui-dialog cannot
        // re-open/close from the spent command. `clientId` / `event` are preserved.
        send(stripConsumedUiEnvelope(msg, "dialog"));
        if (done) {
            done();
        }
        return;
    }

    send(msg);
    if (done) {
        done();
    }
}

// P20a: ui-button emits click events on its output port.
// Incoming component-state messages (show/hide/enable/disable etc.) are still handled.
// Click events arrive as msg.ui.event = "click" from the /event endpoint.
function buttonInputHandler(node, msg, send, done) {
    const uiMsg = msg && msg.ui && typeof msg.ui === "object" ? msg.ui : undefined;

    // If this is a component-state op, delegate to componentStateInputHandler behaviour
    if (uiMsg && uiMsg.component && typeof uiMsg.component.op === "string") {
        return componentStateInputHandler(node, msg, send, done);
    }

    // P39: msg.ui.patch or msg.payload updates the button label (and pushes snapshot).
    if ((uiMsg && uiMsg.patch && typeof uiMsg.patch === "object") ||
        (msg.payload !== undefined && msg.payload !== null && !(uiMsg && uiMsg.event))) {
        return viewNodePatchInputHandler(node, msg, send, done);
    }

    // Emit click event on the output port
    const clickMsg = {
        ui: {
            event: "click",
            sourceId: node.id,
            clientId: uiMsg && uiMsg.clientId ? uiMsg.clientId : undefined
        }
    };
    send(clickMsg);
    if (done) {
        done();
    }
}

// P39: locate the ui-app that owns a view node by matching their flow tab (z).
// Falls back to getActiveRuntimeAppId() when the flow tab cannot be determined.
function findAppIdForNode(node) {
    const flowId = node.z;
    if (flowId) {
        for (const registration of runtimeState.definitions.values()) {
            const def = registration.definition;
            if (def.type === "ui-app" && registration.nodeId) {
                // The app node's own Node-RED node also has .z matching the flow
                const appNode = runtimeState.RED ? runtimeState.RED.nodes.getNode(registration.nodeId) : null;
                if (appNode && appNode.z === flowId) {
                    return def.id;
                }
            }
        }
    }
    return getActiveRuntimeAppId();
}

// P59 / ADR 0007 §4: find the Node-RED node id of the ui-app that owns `node`.
// Used to route an app-global interaction verb (navigate / reset) emitted by a
// ui-action that has no explicit target and no output wire to the app node that
// owns those verbs — the app then performs the SSE push from its own handler.
function findOwningAppNodeId(node) {
    const appId = findAppIdForNode(node);
    if (!appId) {
        return undefined;
    }
    for (const registration of runtimeState.definitions.values()) {
        const def = registration.definition;
        if (def && def.type === "ui-app" && def.id === appId && registration.nodeId) {
            return registration.nodeId;
        }
    }
    return undefined;
}

// P39: primary mutable field for each view-node type when msg.payload is used.
const VIEW_NODE_PRIMARY_FIELD = {
    "ui-text": "value",
    "ui-button": "label",
    "ui-badge": "value",
    "ui-checkbox": "value",
    "ui-switch": "value",
    "ui-radio": "value",
    "ui-select": "value",
    "ui-input": "value",
    "ui-textarea": "value",
    "ui-slider": "value",
    "ui-datepicker": "value",
    "ui-progress": "value",
    "ui-image": "src",
    "ui-avatar": "src",
    "ui-alert": "message",
    "ui-table": "rows",
    "ui-list": "items",
    // P165 (ADR 0017): ui-repeat — the wire path mirrors ui-list. An inbound
    // `msg.payload` array SETS the repeat's `items` collection; the renderer then
    // does the n× template expansion. items is binding-wrapped (see below).
    "ui-repeat": "items"
};

// Binding-wrapped fields — msg.payload is wrapped in a literalBinding so
// the renderer can resolve them like any other binding.
const VIEW_NODE_BINDING_FIELDS = new Set([
    "value", "src", "message", "rows", "items"
]);

// P223 (ADR 0036): the base fields `visible`/`disabled` are stored as binding
// objects and wired to `visibleIf`/`enabledIf` by toComponentDefinitions. When a
// message drives one of them, the value must be re-wrapped as a literal binding
// (like the VIEW_NODE_BINDING_FIELDS) so the merge + renderer carry it.
const VIEW_NODE_BOOLEAN_FIELDS = new Set(["visible", "disabled"]);

// P223: the full set of fields whose message-driven value must be wrapped in a
// literalBinding (the serializer/renderer read these as binding objects). This
// is the existing primary/binding set plus the boolean base fields. Any other
// message-driven field (e.g. ui-button `label`) is stored raw, exactly as before.
const VIEW_NODE_LITERAL_WRAP_FIELDS = new Set([
    ...VIEW_NODE_BINDING_FIELDS,
    ...VIEW_NODE_BOOLEAN_FIELDS
]);

// P223 (ADR 0036): coerce a message value for a boolean base field
// (`visible`/`disabled`). Accepts real booleans and the "true"/"false" strings
// (the editor's boolean-state typedInput / an inject node's string payload);
// everything else falls back to JS truthiness.
function coerceViewBoolean(value) {
    if (value === true) { return true; }
    if (value === false) { return false; }
    if (typeof value === "string") {
        const trimmed = value.trim().toLowerCase();
        if (trimmed === "true") { return true; }
        if (trimmed === "false") { return false; }
    }
    return Boolean(value);
}

// P223: coerce a raw message value to the shape the field expects before it is
// wrapped/stored — boolean coercion for visible/disabled, image-src conversion
// for ui-image `src`, otherwise pass-through.
function coerceViewFieldValue(field, rawValue, nodeType, msg) {
    if (VIEW_NODE_BOOLEAN_FIELDS.has(field)) {
        return coerceViewBoolean(rawValue);
    }
    if (nodeType === "ui-image" && field === "src") {
        return payloadToImageSrc(rawValue, msg);
    }
    return rawValue;
}

// P223: wrap a message-driven field value as a literalBinding when the field is
// binding-shaped (VIEW_NODE_LITERAL_WRAP_FIELDS); otherwise store it raw.
function wrapViewFieldValue(field, value) {
    return VIEW_NODE_LITERAL_WRAP_FIELDS.has(field) ? literalBinding(value) : value;
}

// P223 (ADR 0036): scan a stored view-node definition for EVERY field whose
// saved binding is `{ kind, path }` (msg or jsonata) — not only the primary
// field. Returns `[{ field, path }]`. A msg binding with no path defaults to
// `payload` (standard Node-RED typedInput default); a jsonata binding needs a
// non-empty expression to be usable.
function collectBoundViewFields(definition, kind) {
    const out = [];
    if (!definition || typeof definition !== "object") {
        return out;
    }
    for (const field of Object.keys(definition)) {
        const binding = definition[field];
        if (!binding || typeof binding !== "object" || binding.kind !== kind) {
            continue;
        }
        const rawPath = typeof binding.path === "string" ? binding.path : "";
        if (kind === "msg") {
            out.push({ field, path: rawPath || "payload" });
        }
        else if (kind === "jsonata" && rawPath) {
            out.push({ field, path: rawPath });
        }
    }
    return out;
}

// P39 / P45 / P52 / P223: compute the live-patch that carries a view node's
// runtime-updated fields from the in-memory definition (`liveDef`) into the
// flow-file-derived `baseDefinition`, so an SSE snapshot reflects msg.payload /
// msg-bound-field updates. Returns a (possibly empty) patch object.
//
//   - value / rows / items — primary binding fields (P39/P45).
//   - src (ui-image, ui-avatar) / message (ui-alert) — binding fields (P70/P67).
//   - visible / disabled — base fields wired to visibleIf/enabledIf (P223,
//     ADR 0036): a msg-bound `visible` toggle must reach the client.
//   - row/col/colSize/rowSize/layoutX/layoutY — live grid placement (P52).
function computeLiveViewPatch(baseDefinition, liveDef) {
    const patch = {};
    if (!liveDef || !baseDefinition) {
        return patch;
    }
    ["value", "rows", "items", "src", "message", "visible", "disabled",
        "row", "col", "colSize", "rowSize", "layoutX", "layoutY"].forEach((field) => {
        if (liveDef[field] !== undefined && liveDef[field] !== baseDefinition[field]) {
            patch[field] = liveDef[field];
        }
    });
    return patch;
}

// P70 Ebene 2 (wiring-first): sniff the image content-type from the leading
// magic bytes of a Buffer. Returns a MIME type, or undefined when unrecognised.
function sniffImageContentType(buffer) {
    if (!buffer || buffer.length < 4) {
        return undefined;
    }
    // PNG: 89 50 4E 47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
        return "image/png";
    }
    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return "image/jpeg";
    }
    // GIF: "GIF8"
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
        return "image/gif";
    }
    // WEBP: "RIFF"...."WEBP"
    if (buffer.length >= 12 && buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46
        && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
        return "image/webp";
    }
    // SVG (text): leading "<?xml" or "<svg"
    const head = buffer.slice(0, 5).toString("utf8").toLowerCase();
    if (head.startsWith("<?xml") || head.startsWith("<svg")) {
        return "image/svg+xml";
    }
    return undefined;
}

// P70 Ebene 2: turn a ui-image msg.payload into a usable src string.
//   - Buffer            → data:<type>;base64,<…>  (type from msg hint or sniff)
//   - string            → passed through (URL, asset:<id>, or existing data: URL)
//   - anything else     → String(payload)
// CAVEAT (documented): a data:/Base64 src lands in the snapshot/state and is
// re-sent on every render — fine for small/rare images; prefer URL/asset for
// large or frequently-updated images.
function payloadToImageSrc(payload, msg) {
    if (Buffer.isBuffer(payload)) {
        const hint = msg && (msg.contentType || (msg.headers && msg.headers["content-type"]));
        const contentType = (typeof hint === "string" && hint.trim()) ? hint.split(";")[0].trim()
            : (sniffImageContentType(payload) || "image/png");
        return `data:${contentType};base64,${payload.toString("base64")}`;
    }
    if (typeof payload === "string") {
        return payload;
    }
    return String(payload);
}

// P113: evaluate a JSONata-bound view field against the incoming msg, write the
// result as a literal into the live definition, push a snapshot, then forward.
//
// JSONata is message-driven: each expression (captured once on registration) is
// prepared and evaluated against `msg`. On Node-RED v3+ the runtime's
// evaluateJSONataExpression is ASYNC-ONLY — a synchronous call returns undefined
// — so the async callback form is mandatory. The patch + snapshot push +
// send/done all happen inside the callback; the caller returns immediately after
// invoking this so the synchronous tail does not double-fire.
//
// P223 (ADR 0036): generalised to evaluate EVERY jsonata-bound field of a node
// (`jsonFields = [{ field, path }]`), each against the same incoming `msg`. The
// snapshot push + send/done fire exactly ONCE, after all expressions settle.
// `alreadyPatched` carries whether the synchronous (msg-bound) pass already
// mutated the definition, so the single push still happens even if no jsonata
// field resolves.
function applyJsonataViewFields(node, registration, jsonFields, msg, send, done, alreadyPatched) {
    const RED = runtimeState.RED;
    const nodeType = registration.definition.type;

    let remaining = jsonFields.length;
    let anyPatched = Boolean(alreadyPatched);
    let finished = false;

    const finish = () => {
        if (finished) { return; }
        finished = true;
        if (anyPatched) {
            const appId = findAppIdForNode(node);
            if (RED && appId) {
                pushSnapshotToClients(appId, undefined, readDeployDefinitions(RED));
            }
        }
        send(msg);
        if (done) { done(); }
    };

    const settle = () => {
        remaining -= 1;
        if (remaining <= 0) { finish(); }
    };

    if (!RED || !RED.util || typeof RED.util.prepareJSONataExpression !== "function"
        || typeof RED.util.evaluateJSONataExpression !== "function") {
        // No JSONata engine available — forward unchanged (never crash the flow).
        finish();
        return;
    }

    jsonFields.forEach(({ field, path }) => {
        let expr;
        try {
            expr = RED.util.prepareJSONataExpression(path, node);
        }
        catch (err) {
            node.error(err, msg);
            settle();
            return;
        }
        // Async callback form (Node-RED v3+: evaluateJSONataExpression is async-only).
        try {
            RED.util.evaluateJSONataExpression(expr, msg, (err, result) => {
                if (err) {
                    // A bad expression must not crash the flow; report once and skip.
                    node.error(err, msg);
                }
                else if (result !== undefined && result !== null) {
                    const resolved = coerceViewFieldValue(field, result, nodeType, msg);
                    registration.definition = Object.assign({}, registration.definition, {
                        [field]: wrapViewFieldValue(field, resolved)
                    });
                    node.webappDefinition = registration.definition;
                    anyPatched = true;
                }
                settle();
            });
        }
        catch (err) {
            node.error(err, msg);
            settle();
        }
    });
}

// P39: handle incoming msg.payload / msg.ui.patch on view nodes.
// Patches the in-memory definition and pushes a fresh snapshot to all
// connected clients of the parent app.
function viewNodePatchInputHandler(node, msg, send, done) {
    const uiMsg = msg && msg.ui && typeof msg.ui === "object" ? msg.ui : undefined;

    // Delegate component-op messages (show/hide/enable/disable/…) as before.
    if (uiMsg && uiMsg.component && typeof uiMsg.component.op === "string") {
        return componentStateInputHandler(node, msg, send, done);
    }

    // P224 (ADR 0037): the flow-reachable seam onto the unified dynamic-state
    // write API. `msg.ui.dynamicState = { field, value, id? }` invokes
    // setDynamicStateField on the addressed node (default: this node), honouring
    // `msg.ui.clientId` (per-client) vs a broadcast write. This is the foundation
    // surface the later writer slices (duration → P225, verbs → P226) build on.
    if (uiMsg && uiMsg.dynamicState && typeof uiMsg.dynamicState === "object"
        && typeof uiMsg.dynamicState.field === "string") {
        const ds = uiMsg.dynamicState;
        const targetId = typeof ds.id === "string" && ds.id ? ds.id : node.id;
        const clientId = uiMsg.clientId ? String(uiMsg.clientId) : undefined;
        setDynamicStateField(targetId, ds.field, ds.value, clientId);
        // ADR 0033: strip the spent command so a downstream consumer can't reapply it.
        send(stripConsumedUiEnvelope(msg, "dynamicState"));
        if (done) { done(); }
        return;
    }

    const registration = runtimeState.definitions.get(node.id);
    if (!registration) {
        send(msg);
        if (done) { done(); }
        return;
    }

    let patched = false;

    // msg.ui.patch — arbitrary field overrides supplied by the flow author.
    if (uiMsg && uiMsg.patch && typeof uiMsg.patch === "object") {
        // P52 / ADR 0004: enforce the P51 positive-integer rule on grid placement
        // props on this runtime path too — an invalid row/col/colSize/rowSize is
        // dropped (other keys still apply) and a clear node error is raised.
        const cleanPatch = sanitizePlacementPatch(uiMsg.patch, node);
        registration.definition = Object.assign({}, registration.definition, cleanPatch);
        node.webappDefinition = registration.definition;
        patched = true;
    } else {
        // P223 (ADR 0036): Message mode drives EVERY msg-bound field, not only the
        // node's primary field. On the first message we capture (once) the set of
        // msg-bound and jsonata-bound fields — the first update overwrites each
        // binding with a literal, so the source paths/expressions must be captured
        // up front.
        const nodeType = registration.definition.type;
        const primaryField = VIEW_NODE_PRIMARY_FIELD[nodeType];

        if (registration.msgBoundFields === undefined) {
            registration.msgBoundFields = collectBoundViewFields(registration.definition, "msg");
            registration.jsonataBoundFields = collectBoundViewFields(registration.definition, "jsonata");
        }
        const msgFields = registration.msgBoundFields;
        const jsonFields = registration.jsonataBoundFields;

        const RED = runtimeState.RED;

        // Each msg-bound field is updated from its OWN configured message property
        // (P111's capture-once, generalised to every field). visible/disabled are
        // coerced to a boolean; ui-image src is converted; binding-shaped fields are
        // wrapped in a literal binding.
        for (const { field, path } of msgFields) {
            let rawValue;
            try {
                rawValue = RED && RED.util && typeof RED.util.evaluateNodeProperty === "function"
                    ? RED.util.evaluateNodeProperty(path, "msg", node, msg)
                    : getValueAtPath(msg, path);
            }
            catch (_e) {
                rawValue = undefined;
            }
            if (rawValue === undefined || rawValue === null) {
                continue;
            }
            const resolved = coerceViewFieldValue(field, rawValue, nodeType, msg);
            registration.definition = Object.assign({}, registration.definition, {
                [field]: wrapViewFieldValue(field, resolved)
            });
            node.webappDefinition = registration.definition;
            patched = true;
        }

        // Back-compat: when the PRIMARY field is NOT msg/jsonata-bound, a bare
        // msg.payload updates it (pre-P223 behaviour). Skipped when the primary
        // field is itself msg/jsonata-bound (it was handled above / below from its
        // own configured source). ALSO skipped when the node has ANY explicit
        // msg-bound field: the author has opted into explicit per-field routing, so
        // the incoming payload is feeding one of those fields (e.g. a literal
        // `message` next to `visible = msg.payload`) — the legacy magic must not
        // also clobber the primary with that same payload.
        const primaryBound = primaryField && (
            msgFields.some((f) => f.field === primaryField)
            || jsonFields.some((f) => f.field === primaryField)
        );
        if (primaryField && !primaryBound && msgFields.length === 0
            && msg.payload !== undefined && msg.payload !== null) {
            // P70 Ebene 2: ui-image accepts a Buffer / Base64 / data: payload —
            // convert it to a usable src string before it is wrapped in a binding.
            const resolved = coerceViewFieldValue(primaryField, msg.payload, nodeType, msg);
            registration.definition = Object.assign({}, registration.definition, {
                [primaryField]: wrapViewFieldValue(primaryField, resolved)
            });
            node.webappDefinition = registration.definition;
            patched = true;
        }

        // P113/P223: jsonata-bound fields. Each prepared expression is evaluated
        // against the incoming msg, then patch + push from the async callback. On
        // the E2E Node-RED (v3+) evaluateJSONataExpression is async-only — calling
        // it synchronously returns undefined — so the callback form is used. We
        // return early so the synchronous tail below does not double-fire
        // send()/done(); the single push there carries the msg-bound patches too.
        if (jsonFields.length > 0) {
            return applyJsonataViewFields(node, registration, jsonFields, msg, send, done, patched);
        }
    }

    if (patched) {
        const RED = runtimeState.RED;
        if (RED) {
            const appId = findAppIdForNode(node);
            if (appId) {
                pushSnapshotToClients(appId, undefined, readDeployDefinitions(RED));
            }
        }
    }

    send(msg);
    if (done) { done(); }
}

// ─── P59 / ADR 0007 §2: per-node interaction handlers ───
//
// The SSE push moved OUT of ui-action and INTO the target node. Each
// interaction-capable node owns a set of verbs (open/close, show/hide, …) and
// uses the shared `interactionInputHandler(ownedVerbs[, next])` factory. This
// generalises the ui-toast pattern (input → push own SSE command → pass msg
// through). When a wire (ui-action → ui-dialog) or a bare inject carries
// `msg.ui.action`, the target node — not ui-action — performs the push.
//
// Resolution rules (ADR 0007 §2):
//   - command.target resolves to THE NODE'S OWN id (the wire/selection is the
//     addressing). An explicit msg.ui.action.target OVERRIDES it.
//   - `to` / `part` ride along from msg.ui.action.
//   - A verb the node does NOT own → pure pass-through (no push, no swallow),
//     so a chain of wired targets each handle the verbs they own (ADR 0007 §2,
//     ADR 0006 "no silent drops" spirit).
//   - With no msg.ui.action at all → delegate to `next` (the node's existing
//     patch / component / click / dialog handler), preserving prior behaviour.

// Verb ownership per node type (ADR 0007 §2). A node pushes only for verbs it
// owns; every other verb is passed through untouched.
const INTERACTION_VERBS_BY_TYPE = {
    "ui-dialog": ["open", "close", "openDialog", "closeDialog", "toggle"],
    "ui-app": ["navigate", "reset"],
    "ui-route": ["navigate", "reset"],
    // presence (show/hide) for view nodes; interactive controls add enable/disable;
    // input controls add focus/reset; single-active containers add select.
    "ui-button": ["show", "hide", "enable", "disable"],
    "ui-input": ["show", "hide", "enable", "disable", "focus", "reset"],
    "ui-text": ["show", "hide"],
    "ui-table": ["show", "hide", "select"],
    "ui-container": ["show", "hide"],
    // P258: the full form-control set owns `reset` (value → initial). Text controls
    // (input/textarea/datepicker) also own `focus`; non-text controls do not.
    "ui-select": ["show", "hide", "enable", "disable", "reset"],
    "ui-textarea": ["show", "hide", "enable", "disable", "focus", "reset"],
    "ui-checkbox": ["show", "hide", "enable", "disable", "reset"],
    "ui-radio": ["show", "hide", "enable", "disable", "reset"],
    "ui-switch": ["show", "hide", "enable", "disable", "reset"],
    "ui-slider": ["show", "hide", "enable", "disable", "reset"],
    "ui-datepicker": ["show", "hide", "enable", "disable", "focus", "reset"],
    // single-active containers (tabs / stepper / menu) own `select`
    "ui-tabs": ["show", "hide", "select"],
    "ui-stepper": ["show", "hide", "select"],
    "ui-menu": ["show", "hide", "select"],
    "ui-accordion": ["show", "hide", "open", "close"],
    // P95: breadcrumb supports show/hide visibility control
    "ui-breadcrumb": ["show", "hide"],
    // P226 (ADR 0037): ui-alert joins the visibility verbs — show/hide now write
    // the alert's ONE `visible` dynamic-state value (bound → store, unbound → the
    // per-client slot), so a flow can imperatively re-show / hide an alert the same
    // way its declarative `visible` value or a duration transition does.
    "ui-alert": ["show", "hide"]
};

// P226 (ADR 0037): the visibility / enabled verbs are WRITERS on a component's ONE
// dynamic-state value — NOT a separate client overlay. `show`/`hide` set `visible`;
// `enable`/`disable` set `disabled`. Each routes through `setDynamicStateField`
// (bound → store write-through, unbound → per-client slot), and the resulting
// snapshot re-render reflects the new value. No `.webapp-hidden` overlay command is
// pushed for these verbs. Every other verb (navigate / open / close / select /
// focus / reset) keeps its client command.
const DYNAMIC_STATE_VERB_WRITES = {
    show: { field: "visible", value: true },
    hide: { field: "visible", value: false },
    enable: { field: "disabled", value: false },
    disable: { field: "disabled", value: true }
};

// Build the interaction command for a target node from msg.ui.action. The target
// defaults to the node's own id; an explicit msg.ui.action.target wins.
function buildInteractionCommand(node, uiAction) {
    const type = String(uiAction.type);
    const explicitTarget = typeof uiAction.target === "string" && uiAction.target
        ? uiAction.target
        : undefined;
    return {
        type,
        target: explicitTarget || node.id,
        to: typeof uiAction.to === "string" && uiAction.to ? uiAction.to : undefined,
        part: typeof uiAction.part === "string" && uiAction.part ? uiAction.part : undefined
    };
}

// ─── P66 (ADR 0007): navigate handling for ui-route / ui-app ───
//
// Two usage scenarios for actionType "navigate", both ending in the SAME push:
//   • SCENARIO 1 — the navigate action is wired (or picked) to a ui-route (or to
//     the ui-app for its implicit root "/"). The route/app builds the location
//     from ITS OWN path + the action's params. NO `to` is needed on the action.
//   • SCENARIO 2 — the navigate action is NOT wired to a route. It carries a `to`
//     (a path template, possibly with params) and is delivered app-global to the
//     ui-app, which resolves the location and navigates.
// onEnter/onLeave are emitted in BOTH scenarios as a consequence of ARRIVING at
// the new route — decoupled from the navigation mechanism (P66 owner decision).

// Collect the live in-memory node definitions (from registrations). Preferred
// over the flow file for runtime route resolution: it reflects the deployed
// nodes without a disk read and works in unit tests that populate registrations.
function collectLiveDefinitions() {
    const defs = [];
    for (const registration of runtimeState.definitions.values()) {
        if (registration && registration.definition) {
            defs.push(registration.definition);
        }
    }
    return defs;
}

// Find the route definition (and its runtime node) whose path matches a location
// for an app. The implicit app-root route has id === appId and path "/".
function findRouteNodeForLocation(RED, appId, location) {
    const live = collectLiveDefinitions();
    const definitions = live.length > 0 ? live : readDeployDefinitions(RED);
    const modelResult = getAppModelResult(appId, definitions);
    if (!modelResult.success) {
        return undefined;
    }
    const match = getRouteMatch(location || "/", modelResult.model.routes);
    if (!match) {
        return undefined;
    }
    const routeId = match.route.id;
    // The route definition id (uiId) equals the matched route id. Find its node.
    for (const registration of runtimeState.definitions.values()) {
        const def = registration.definition;
        if (def && (def.type === "ui-route" || def.type === "ui-app") && def.id === routeId && registration.nodeId) {
            return { routeId, node: RED.nodes.getNode(registration.nodeId), params: match.params || {} };
        }
    }
    return { routeId, node: undefined, params: match.params || {} };
}

// P86: Emit a clientConnected / clientDisconnected event on the ui-app node
// when a browser client connects or disconnects. The ui-app must declare the
// event (events array in its definition); absent → no-op. Positional out-port
// routing mirrors the generic dispatchClientEvent logic.
function emitAppClientEvent(appId, eventName, clientId) {
    const RED = runtimeState.RED;
    if (!RED) {
        return;
    }
    // Find the ui-app definition and its Node-RED node id.
    let appNodeId;
    let appDefinition;
    for (const registration of runtimeState.definitions.values()) {
        const def = registration.definition;
        if (def && def.type === "ui-app" && def.id === appId && registration.nodeId) {
            appNodeId = registration.nodeId;
            appDefinition = def;
            break;
        }
    }
    if (!appNodeId || !appDefinition) {
        return;
    }
    const events = Array.isArray(appDefinition.events) ? appDefinition.events : undefined;
    if (!events || events.indexOf(eventName) === -1) {
        return;
    }
    const appNode = RED.nodes.getNode(appNodeId);
    if (!appNode || typeof appNode.send !== "function") {
        return;
    }
    const message = {
        ui: {
            appId,
            clientId,
            event: eventName,
            sourceId: appId
        }
    };
    const portIndex = events.indexOf(eventName);
    if (portIndex > 0) {
        const outputs = new Array(portIndex + 1).fill(null);
        outputs[portIndex] = message;
        appNode.send(outputs);
    }
    else {
        appNode.send(message);
    }
}

// Emit an onEnter / onLeave event on a route/app node IF that node declares the
// event (positional out-port routing, mirroring dispatchClientEvent). This is how
// a wired flow reacts to a route being entered or left.
function emitRouteLifecycleEvent(node, eventName, appId, clientId, location, params) {
    if (!node || typeof node.send !== "function") {
        return;
    }
    const events = node.webappDefinition && Array.isArray(node.webappDefinition.events)
        ? node.webappDefinition.events
        : undefined;
    if (!events || events.indexOf(eventName) === -1) {
        return;
    }
    const message = {
        ui: {
            appId,
            clientId,
            event: eventName,
            sourceId: node.webappDefinition ? node.webappDefinition.id : node.id,
            route: location,
            params: params || {}
        }
    };
    const portIndex = events.indexOf(eventName);
    if (portIndex > 0) {
        const outputs = new Array(portIndex + 1).fill(null);
        outputs[portIndex] = message;
        node.send(outputs);
    }
    else {
        node.send(message);
    }
}

// Resolve the navigate destination location for a ui-route / ui-app target.
//
// P118 (ADR 0011 §3) — ADDRESSING PRECEDENCE: an explicitly addressed navigation
// wins; a wired ui-route never hijacks a message that already carries a target.
//   • If the incoming action ALREADY carries an explicit `to` (route/url mode, or
//     a msg.ui.action.to override) the route treats it as ADDRESSED navigation and
//     PASSES IT THROUGH unchanged — it does NOT impose its own path.
//   • Only a target-LESS navigate (wire mode, no `to`) falls back to today's
//     behaviour: the receiving ui-route builds the location from its OWN path
//     (its :placeholders filled from action.params); a ui-app uses the implicit
//     root "/". This also makes wire-mode branching well-defined (the route the
//     message reaches, wins).
// Returns the concrete location string (params already substituted).
function resolveNavigateLocation(node, uiAction) {
    const def = node && node.webappDefinition ? node.webappDefinition : {};
    const params = uiAction && uiAction.params && typeof uiAction.params === "object" ? uiAction.params : {};
    const explicitTo = typeof uiAction.to === "string" && uiAction.to ? uiAction.to : undefined;

    // P118 §3: addressed navigation — pass the explicit target through unchanged.
    if (explicitTo) {
        // The `to` carries any :placeholders already filled by the emitter (route/
        // url mode). Re-substituting with params is a no-op for a concrete path and
        // harmlessly fills any remaining placeholder from params.
        return resolveNavigationTarget(explicitTo, params, {});
    }

    // Target-less navigate (wire mode): the receiving node supplies the path.
    if (def.type === "ui-route") {
        const template = typeof def.path === "string" && def.path ? def.path : "/";
        return resolveNavigationTarget(template, params, {});
    }
    // ui-app: the implicit root route.
    return resolveNavigationTarget("/", params, {});
}

// Perform a navigate for a ui-route / ui-app target: resolve the new location
// and push the navigate command (which moves the client via a full reload).
//
// P112: this NO LONGER emits onEnter/onLeave. The client navigates by full
// page-reload (window.location.assign), so every navigate ends in a fresh SSE
// connect at the destination carrying a new loadId — the connect-based lifecycle
// (handleClientArrival) owns onEnter/onLeave for ALL arrival paths (deep-link,
// refresh, navigate) uniformly. Emitting here as well would double-fire onEnter.
function performTargetNavigate(node, msg, send, done) {
    const RED = runtimeState.RED;
    const uiMsg = msg && msg.ui && typeof msg.ui === "object" ? msg.ui : undefined;
    const uiAction = uiMsg && uiMsg.action && typeof uiMsg.action === "object" ? uiMsg.action : {};
    const appId = findAppIdForNode(node);
    const clientId = uiMsg && uiMsg.clientId ? String(uiMsg.clientId) : undefined;

    const newLocation = resolveNavigateLocation(node, uiAction);

    if (RED && appId && newLocation) {
        const command = {
            type: "navigate",
            target: node.id,
            to: newLocation
        };
        pushActionCommandToClients(appId, clientId, command);
    }

    send(msg);
    if (done) {
        done();
    }
}

// P59 / ADR 0007 §2: shared per-node interaction handler factory.
// `ownedVerbs` — the verb set this node type owns. `next` — the node's existing
// input handler, invoked when the message is NOT an owned interaction command.
function interactionInputHandler(ownedVerbs, next) {
    const owned = new Set(ownedVerbs || []);
    const fallback = next || passThroughInputHandler;
    return function onInteractionInput(node, msg, send, done) {
        const uiMsg = msg && msg.ui && typeof msg.ui === "object" ? msg.ui : undefined;
        const uiAction = uiMsg && uiMsg.action && typeof uiMsg.action === "object" ? uiMsg.action : undefined;

        if (uiAction && typeof uiAction.type === "string" && owned.has(uiAction.type)) {
            // P66: a navigate verb owned by a ui-route / ui-app is handled by the
            // shared navigate path — it resolves the location from the route's own
            // path (Scenario 1) or the action's `to` template (Scenario 2) and
            // emits onEnter/onLeave around the push. (DRY: route and app share it.)
            const ownerType = node && node.webappDefinition ? node.webappDefinition.type : undefined;
            if (uiAction.type === "navigate" && (ownerType === "ui-route" || ownerType === "ui-app")) {
                performTargetNavigate(node, msg, send, done);
                return;
            }

            // Owned verb → this node performs the SSE push, then passes msg through.
            const RED = runtimeState.RED;
            const appId = findAppIdForNode(node);
            const clientId = uiMsg && uiMsg.clientId ? String(uiMsg.clientId) : undefined;

            // P226 (ADR 0037): show/hide (+ enable/disable) are dynamic-state
            // WRITERS — they set the target's ONE visible/disabled value through the
            // unified write API (bound → store write-through, unbound → per-client
            // slot) rather than pushing a client-side `.webapp-hidden` overlay. The
            // write itself pushes the fresh snapshot, so visibility follows the value
            // (a re-render), not a separate CSS layer.
            const stateWrite = DYNAMIC_STATE_VERB_WRITES[uiAction.type];
            if (stateWrite) {
                const targetId = (typeof uiAction.target === "string" && uiAction.target)
                    ? uiAction.target
                    : node.id;
                setDynamicStateField(targetId, stateWrite.field, stateWrite.value, clientId);
                send(msg);
                if (done) {
                    done();
                }
                return;
            }

            const command = buildInteractionCommand(node, uiAction);
            if (RED && appId) {
                pushActionCommandToClients(appId, clientId, command);
            }
            send(msg);
            if (done) {
                done();
            }
            return;
        }

        // Not an owned interaction command: defer to the node's existing handler.
        // A foreign action verb falls through here too → pure pass-through.
        fallback(node, msg, send, done);
    };
}

// Collect the configured wireless target node ids from a ui-action definition.
// P60 / ADR 0007 §3: the editor's node picker (RED.view.selectNodes) stores a
// LIST of target node ids in `targets`. The legacy singular `target` config
// field (pre-P60 free-text) is still honoured for backward-compat. Returns a
// de-duplicated, order-preserving array.
function collectConfiguredTargetIds(definition) {
    const ids = [];
    if (definition) {
        if (Array.isArray(definition.targets)) {
            for (const id of definition.targets) {
                if (typeof id === "string" && id) {
                    ids.push(id);
                }
            }
        }
        if (typeof definition.target === "string" && definition.target) {
            ids.push(definition.target);
        }
    }
    return ids.filter((id, index) => ids.indexOf(id) === index);
}

// P59 / ADR 0007 §3: ui-action is a pure typed EMITTER. On input it builds a
// schema-valid msg.ui.action from its config (msg.ui.action overrides win, ADR
// 0005) and SENDS IT OUT its output port — the wired target node performs the
// SSE push. ui-action no longer pushes centrally.
//
// P60 / ADR 0007 §3: addressing has two equivalent paths, both delivering via
// the SAME input path a wire uses (targetNode.receive(), NOT send() — fixing the
// ADR 0007 §Context-3 bug):
//   - Wiring (primary, visible): the output port is wired to the target node(s);
//     Node-RED carries the message into their input.
//   - Node picker (optional, "wireless"): the editor's RED.view.selectNodes()
//     picker stores a LIST of target ids in `targets`; on input ui-action
//     delivers the enriched message to EACH selected target via receive().
//
// An explicit msg.ui.action.target override is unified with the
// picker path: it too is delivered via receive() to exactly that node id.
//
// Backward-compat: old flows relying on the singular `target` config field with
// an UNWIRED output still work — `target` is treated as a single picked target.
function actionInputHandler(node, msg, send, done) {
    const RED = runtimeState.RED;
    const uiMsg = msg && msg.ui && typeof msg.ui === "object" ? msg.ui : undefined;

    // Build the typed action command from config + msg overrides (ADR 0005).
    const command = buildActionCommand(node.webappDefinition, msg, node);

    // Enrich the incoming message with msg.ui.action (ADR 0007 §1: enrich, don't
    // replace) — every other msg / msg.ui field rides along untouched.
    const outMsg = command
        ? Object.assign({}, msg, {
            ui: Object.assign({}, uiMsg, {
                action: Object.assign(
                    {},
                    uiMsg && uiMsg.action && typeof uiMsg.action === "object" ? uiMsg.action : {},
                    pruneUndefined(command)
                )
            })
        })
        : msg;

    // Explicit msg-level override (ADR 0007 §3, unified): msg.ui.action.target
    // names a single node id and is delivered via receive() to exactly
    // that node — NOT via send() (the ADR 0007 §Context-3 bug).
    const override = uiMsg && uiMsg.action && typeof uiMsg.action === "object" ? uiMsg.action : undefined;
    const overrideTargetId = override
        ? (typeof override.target === "string" && override.target ? override.target : undefined)
        : undefined;

    // Wireless picker (+ legacy singular `target`) → deliver to each selected
    // target's INPUT via receive(). The override, when present, takes precedence
    // and addresses exactly that node.
    const deliverTargetIds = overrideTargetId
        ? [overrideTargetId]
        : collectConfiguredTargetIds(node.webappDefinition);

    if (deliverTargetIds.length > 0 && RED) {
        let deliveredAny = false;
        for (const targetId of deliverTargetIds) {
            const targetNode = RED.nodes.getNode(targetId);
            if (targetNode && typeof targetNode.receive === "function") {
                targetNode.receive(clone(outMsg));
                deliveredAny = true;
            }
        }
        if (deliveredAny) {
            if (done) {
                done();
            }
            return;
        }
    }

    // P59 / ADR 0007 §4: app-global verbs (navigate / reset) have no per-element
    // target — their owner is the ui-app. A ui-action(navigate) with no explicit
    // target and no output wire (the common navbar-button case) is delivered to
    // the owning ui-app node's INPUT, which owns the verb and performs the push.
    const verb = command && command.type ? String(command.type) : undefined;
    const isAppGlobalVerb = verb && (INTERACTION_VERBS_BY_TYPE["ui-app"] || []).indexOf(verb) !== -1;
    if (isAppGlobalVerb && deliverTargetIds.length === 0 && RED && !nodeHasOutputWire(node)) {
        const appNodeId = findOwningAppNodeId(node);
        const appNode = appNodeId ? RED.nodes.getNode(appNodeId) : undefined;
        if (appNode && typeof appNode.receive === "function") {
            appNode.receive(clone(outMsg));
            if (done) {
                done();
            }
            return;
        }
    }

    // Primary path: emit the action message on the output port; the wired target
    // node performs the push.
    send(outMsg);
    if (done) {
        done();
    }
}

// Strip undefined values so Object.assign merges cleanly without clobbering
// existing fields with `undefined`.
function pruneUndefined(obj) {
    const out = {};
    for (const key of Object.keys(obj)) {
        if (obj[key] !== undefined) {
            out[key] = obj[key];
        }
    }
    return out;
}

// Does this ui-action node have at least one output wire? Reads the flow
// topology via the node's own `wires` array (populated by Node-RED on the
// runtime node). Used for the backward-compat unwired-target path.
function nodeHasOutputWire(node) {
    const wires = node && node.wires;
    if (!Array.isArray(wires)) {
        return false;
    }
    return wires.some((port) => Array.isArray(port) && port.length > 0);
}

const runtimeNodeRegistry = {
    "ui-app": {
        mapConfig: (config) => ({
            type: "ui-app",
            id: getUiId(config) || "",
            // P109: `root` is now an explicit schema field.
            root: config.root || "",
            // P109: `name` replaces `title`. Back-compat shim: old configs that
            // only have `title` (no `name`) are migrated transparently here.
            name: config.name || config.title || config.root || getUiId(config) || "App",
            layout: config.layout || "vertical",
            events: parseJsonList(config.events).length > 0 ? parseJsonList(config.events) : undefined,
            // P23: design tokens drive the Web Component theme via CSS custom
            // properties. Carried through unchanged so the page can inject them.
            tokens: parseTokens(config.tokens),
            // P56 / ADR 0006 §4: opt-in backend→frontend error forwarding.
            // Absent/false = OFF (secure default). minSeverity gates which errors
            // are forwarded; absent falls back to "error" at the read site.
            forwardErrorsToClient: config.forwardErrorsToClient === true || config.forwardErrorsToClient === "true",
            forwardErrorMinSeverity: blankToUndefined(config.forwardErrorMinSeverity),
            // P70: optional media-store base URL for asset:<id> resolution.
            mediaStoreUrl: blankToUndefined(config.mediaStoreUrl),
            // P106: deploy mode. The editor stores `deployMode` (config key — NOT
            // `status`, which is a reserved Node-RED node property). Accept the
            // Entwicklung / Produktion labels and the normalised development /
            // production tokens; default to "development" so existing apps keep the
            // convenient auto-update. `config.status` is honoured as a legacy alias.
            mode: normalizeAppMode(config.deployMode !== undefined ? config.deployMode : config.status)
        }),
        options: {
            // P59 / ADR 0007 §4: ui-app owns the app-global verbs navigate / reset.
            inputHandler: interactionInputHandler(INTERACTION_VERBS_BY_TYPE["ui-app"], passThroughInputHandler)
        }
    },
    "ui-route": {
        mapConfig: (config) => {
            // P89: title is a bindable field. A plain string or a literal binding
            // resolves to a string; dynamic bindings (state/store/msg/…) resolve to
            // undefined at compile time — the <title> element is server-rendered once
            // and cannot be updated at runtime for now.
            let resolvedTitle;
            if (config.title && typeof config.title === "object") {
                if (config.title.kind === "literal") {
                    // Literal binding → extract the value string.
                    resolvedTitle = typeof config.title.value === "string" && config.title.value.trim()
                        ? config.title.value
                        : undefined;
                } else if (typeof config.title.kind === "string") {
                    // Any other binding kind (state/store/msg/…) → not resolvable at
                    // compile time; fall back to undefined.
                    resolvedTitle = undefined;
                } else {
                    resolvedTitle = undefined;
                }
            } else {
                resolvedTitle = blankToUndefined(config.title);
            }
            return {
                type: "ui-route",
                id: getUiId(config),
                parent: config.app || config.parent || undefined,
                path: config.path,
                title: resolvedTitle,
                layout: config.layoutId,
                events: parseJsonList(config.events).length > 0 ? parseJsonList(config.events) : undefined
            };
        },
        options: {
            // P59 / ADR 0007 §4: ui-route gains an input handler (and inputs:1 in
            // its HTML) for the app-global verbs navigate / reset.
            inputHandler: interactionInputHandler(INTERACTION_VERBS_BY_TYPE["ui-route"], passThroughInputHandler)
        }
    },
    "ui-dialog": {
        mapConfig: (config) => ({
            type: "ui-dialog",
            id: getUiId(config),
            parent: config.app || config.parent || undefined,
            title: config.title || undefined,
            layout: config.layoutId,
            routeId: config.routeId || undefined,
            modal: config.modal !== false && config.modal !== "false",
            // P64: closable defaults to true; only an explicit false disables it.
            closable: config.closable !== false && config.closable !== "false",
            events: parseJsonList(config.events).length > 0 ? parseJsonList(config.events) : undefined
        }),
        options: {
            inputHandler: interactionInputHandler(INTERACTION_VERBS_BY_TYPE["ui-dialog"], dialogInputHandler)
        }
    },
    "ui-text": {
        mapConfig: (config) => {
            // P111: `style` (typographic role) + `variant` (semantic colour),
            // with transparent migration of legacy role-in-variant configs.
            const text = mapTextStyleAndVariant(config);
            return {
                type: "ui-text",
                id: getUiId(config),
                parent: config.app || config.parent || undefined,
                mount: config.mount || config.app || config.parent,
                order: resolveOrder(config),
                value: getBinding(config.value, literalBinding(config.text || "")),
                style: text.style,
                variant: text.variant,
                // P221 (ADR 0035): presentation mode + the form-field row label.
                // Default "text" (free display text); "formField" renders a
                // read-only labelled row styled like the input controls.
                display: config.display === "formField" ? "formField" : "text",
                label: blankToUndefined(config.label),
                ...collectNodeConfigLayoutProps(config)
            };
        },
        options: {
            inputHandler: interactionInputHandler(INTERACTION_VERBS_BY_TYPE["ui-text"], viewNodePatchInputHandler)
        }
    },
    "ui-button": {
        mapConfig: (config) => ({
            type: "ui-button",
            id: getUiId(config),
            parent: config.app || config.parent || undefined,
            mount: config.mount || config.app || config.parent,
            order: resolveOrder(config),
            label: config.label,
            variant: config.variant || undefined,
            action: blankToUndefined(config.action),
            icon: mapIconField(config.icon),
            size: blankToUndefined(config.size),
            outline: config.outline === true || config.outline === "true" ? true : undefined,
            linkMode: blankToUndefined(config.linkMode),
            // P71: href is binding-capable. A dynamic binding object passes through;
            // a non-blank literal string becomes a literal binding; blank → undefined.
            href: getBinding(
                config.href,
                blankToUndefined(config.href) ? literalBinding(config.href) : undefined
            ),
            disabled: getBinding(config.disabled, config.disabledPath ? stateBinding(config.disabledPath) : undefined),
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: interactionInputHandler(INTERACTION_VERBS_BY_TYPE["ui-button"], buttonInputHandler)
        }
    },
    "ui-table": {
        mapConfig: (config) => ({
            type: "ui-table",
            id: getUiId(config),
            parent: config.app || config.parent || undefined,
            mount: config.mount || config.app || config.parent,
            order: resolveOrder(config),
            columns: parseColumns(config.columns),
            rows: resolveTableRows(config),
            events: filterSupportedTableEvents(parseJsonList(config.events)),
            selectAction: config.selectAction || undefined,
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: interactionInputHandler(INTERACTION_VERBS_BY_TYPE["ui-table"], viewNodePatchInputHandler)
        }
    },
    "ui-container": {
        mapConfig: (config) => ({
            type: "ui-container",
            id: getUiId(config),
            parent: config.app || config.parent || undefined,
            mount: config.mount || config.app || config.parent,
            order: resolveOrder(config),
            layout: config.layoutId,
            variant: config.variant || undefined,
            events: parseJsonList(config.events).length > 0 ? parseJsonList(config.events) : undefined,
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: interactionInputHandler(INTERACTION_VERBS_BY_TYPE["ui-container"], componentStateInputHandler)
        }
    },
    "ui-input": {
        mapConfig: (config) => ({
            type: "ui-input",
            id: getUiId(config),
            parent: config.app || config.parent || undefined,
            mount: config.mount || config.app || config.parent,
            order: resolveOrder(config),
            label: config.label,
            value: getBinding(config.value, config.valuePath ? stateBinding(config.valuePath) : undefined),
            placeholder: config.placeholder || undefined,
            // P203 (ADR 0027): the writeTo WRITE target + writeTrigger. Falls back
            // to a migrated writeTo=store binding when only the legacy
            // storeId(+path) pair is present on a pre-P203 deployed config.
            writeTo: getBinding(config.writeTo, legacyStoreWriteTo(config.storeId, config.path)),
            writeTrigger: config.writeTrigger || undefined,
            inputType: config.inputType || undefined,
            variant: config.variant || undefined,
            size: blankToUndefined(config.size),
            disabled: getBinding(config.disabled, config.disabledPath ? stateBinding(config.disabledPath) : undefined),
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: interactionInputHandler(INTERACTION_VERBS_BY_TYPE["ui-input"], viewNodePatchInputHandler)
        }
    },
    "ui-select": {
        mapConfig: (config) => ({
            type: "ui-select",
            id: getUiId(config),
            parent: config.app || config.parent || undefined,
            mount: config.mount || config.app || config.parent,
            order: resolveOrder(config),
            // P133: label is now a binding (literal string or dynamic binding).
            label: getBinding(config.label, undefined) || config.label,
            value: getBinding(config.value, config.valuePath ? stateBinding(config.valuePath) : undefined),
            // P204 (ADR 0027): writeTo WRITE target + writeTrigger. Legacy
            // storeId/path migrate to a writeTo=store binding.
            writeTo: getBinding(config.writeTo, legacyStoreWriteTo(config.storeId, config.path)),
            writeTrigger: config.writeTrigger || undefined,
            // P133: single Options field — json (literal array) | store binding,
            // with legacy optionsJson / optionsBinding migration.
            options: mapSelectOptions(config, undefined),
            // P133: placeholder is now a binding (literal string or dynamic binding).
            placeholder: getBinding(config.placeholder, undefined) || (config.placeholder || undefined),
            multiple: config.multiple === true || config.multiple === "true" || undefined,
            // P133: `searchable` removed.
            size: blankToUndefined(config.size),
            disabled: getBinding(config.disabled, undefined),
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: interactionInputHandler(INTERACTION_VERBS_BY_TYPE["ui-select"], viewNodePatchInputHandler)
        }
    },
    "ui-checkbox": {
        mapConfig: (config) => ({
            type: "ui-checkbox",
            id: getUiId(config),
            parent: config.app || config.parent || undefined,
            mount: config.mount || config.app || config.parent,
            order: resolveOrder(config),
            // P97: label is now a binding object when set via typedInput; legacy plain string is preserved.
            label: config.label,
            value: getBinding(config.value, config.valuePath ? stateBinding(config.valuePath) : undefined),
            // P204 (ADR 0027): writeTo WRITE target + writeTrigger. Legacy
            // storeId/path migrate to a writeTo=store binding.
            writeTo: getBinding(config.writeTo, legacyStoreWriteTo(config.storeId, config.path)),
            writeTrigger: config.writeTrigger || undefined,
            // P97: size field (xs/sm/md/lg/xl).
            size: config.size || undefined,
            disabled: getBinding(config.disabled, undefined),
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: interactionInputHandler(INTERACTION_VERBS_BY_TYPE["ui-checkbox"], viewNodePatchInputHandler)
        }
    },
    "ui-radio": {
        mapConfig: (config) => ({
            type: "ui-radio",
            id: getUiId(config),
            parent: config.app || config.parent || undefined,
            mount: config.mount || config.app || config.parent,
            order: resolveOrder(config),
            // P136: label is now a binding (literal string or dynamic binding),
            // mirroring ui-select.
            label: getBinding(config.label, undefined) || config.label,
            value: getBinding(config.value, config.valuePath ? stateBinding(config.valuePath) : undefined),
            // P204 (ADR 0027): writeTo WRITE target + writeTrigger. Legacy
            // storeId/path migrate to a writeTo=store binding.
            writeTo: getBinding(config.writeTo, legacyStoreWriteTo(config.storeId, config.path)),
            writeTrigger: config.writeTrigger || undefined,
            // P136: single Options field — json (literal array) | store binding,
            // via the SAME shared resolver as ui-select, with legacy
            // optionsJson / optionsBinding migration.
            options: mapSelectOptions(config, undefined),
            orientation: config.orientation || undefined,
            disabled: getBinding(config.disabled, undefined),
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: interactionInputHandler(INTERACTION_VERBS_BY_TYPE["ui-radio"], viewNodePatchInputHandler)
        }
    },
    "ui-switch": {
        mapConfig: (config) => ({
            type: "ui-switch",
            id: getUiId(config),
            parent: config.app || config.parent || undefined,
            mount: config.mount || config.app || config.parent,
            order: resolveOrder(config),
            value: getBinding(config.value, config.valuePath ? stateBinding(config.valuePath) : undefined),
            // P204 (ADR 0027): writeTo WRITE target + writeTrigger. Legacy
            // storeId/path migrate to a writeTo=store binding.
            writeTo: getBinding(config.writeTo, legacyStoreWriteTo(config.storeId, config.path)),
            writeTrigger: config.writeTrigger || undefined,
            // P147 (ADR 0012): label/labelOn/labelOff may now be binding objects
            // or plain strings (legacy). Use the same pattern as ui-radio: try
            // getBinding first (returns the object when it has .kind), then fall
            // back to the plain-string value so legacy flows keep working.
            label: getBinding(config.label, undefined) || config.label || undefined,
            labelOn: getBinding(config.labelOn, undefined) || config.labelOn || undefined,
            labelOff: getBinding(config.labelOff, undefined) || config.labelOff || undefined,
            disabled: getBinding(config.disabled, undefined),
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: interactionInputHandler(INTERACTION_VERBS_BY_TYPE["ui-switch"], viewNodePatchInputHandler)
        }
    },
    "ui-textarea": {
        mapConfig: (config) => ({
            type: "ui-textarea",
            id: getUiId(config),
            parent: config.app || config.parent || undefined,
            mount: config.mount || config.app || config.parent,
            order: resolveOrder(config),
            // P148 (ADR 0012): label may be a binding object or a legacy plain string.
            // getBinding passes a binding object through; for a plain string, we keep it
            // as-is via the fallback: a non-object label stays as a string.
            label: getBinding(config.label, typeof config.label === "string" && config.label ? config.label : undefined),
            value: getBinding(config.value, config.valuePath ? stateBinding(config.valuePath) : undefined),
            // P204 (ADR 0027): writeTo WRITE target + writeTrigger. Legacy
            // storeId/path migrate to a writeTo=store binding.
            writeTo: getBinding(config.writeTo, legacyStoreWriteTo(config.storeId, config.path)),
            writeTrigger: config.writeTrigger || undefined,
            // P148 (ADR 0012): placeholder may be a binding object or a legacy plain string.
            placeholder: getBinding(config.placeholder, typeof config.placeholder === "string" && config.placeholder ? config.placeholder : undefined),
            // P229 (ADR 0038): canonical `lines` (visible line count / height);
            // a legacy `rows` config migrates here — `rows` now means only the
            // ui-table data binding.
            lines: toOptionalNumber(config.lines) !== undefined
                ? toOptionalNumber(config.lines)
                : toOptionalNumber(config.rows),
            maxLength: toOptionalNumber(config.maxLength),
            size: blankToUndefined(config.size),
            disabled: getBinding(config.disabled, undefined),
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: interactionInputHandler(INTERACTION_VERBS_BY_TYPE["ui-textarea"], viewNodePatchInputHandler)
        }
    },
    "ui-datepicker": {
        mapConfig: (config) => ({
            type: "ui-datepicker",
            id: getUiId(config),
            parent: config.app || config.parent || undefined,
            mount: config.mount || config.app || config.parent,
            order: resolveOrder(config),
            // P98: label is now a full binding (literal/state/store/…) or a plain string (legacy).
            // getBinding handles both: if config.label is a binding object it is returned as-is;
            // if it is a plain string a literal binding is NOT needed — the P16X handler already
            // puts plain strings into props.label directly and the renderer reads props.label.
            label: config.label,
            value: getBinding(config.value, config.valuePath ? stateBinding(config.valuePath) : undefined),
            // P204 (ADR 0027): writeTo WRITE target + writeTrigger. Legacy
            // storeId/path migrate to a writeTo=store binding.
            writeTo: getBinding(config.writeTo, legacyStoreWriteTo(config.storeId, config.path)),
            writeTrigger: config.writeTrigger || undefined,
            mode: config.mode || undefined,
            min: config.min || undefined,
            max: config.max || undefined,
            // P149 (ADR 0012): placeholder may be a binding object or a legacy plain string.
            placeholder: getBinding(config.placeholder, typeof config.placeholder === "string" && config.placeholder ? config.placeholder : undefined),
            disabled: getBinding(config.disabled, undefined),
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: interactionInputHandler(INTERACTION_VERBS_BY_TYPE["ui-datepicker"], viewNodePatchInputHandler)
        }
    },
    "ui-slider": {
        mapConfig: (config) => ({
            type: "ui-slider",
            id: getUiId(config),
            parent: config.app || config.parent || undefined,
            mount: config.mount || config.app || config.parent,
            order: resolveOrder(config),
            value: getBinding(config.value, config.valuePath ? stateBinding(config.valuePath) : undefined),
            // P204 (ADR 0027): writeTo WRITE target + writeTrigger. A slider value
            // is numeric-as-string from the client; the store gets it as-is (same as
            // ui-input number). Legacy storeId/path migrate to a writeTo=store binding.
            writeTo: getBinding(config.writeTo, legacyStoreWriteTo(config.storeId, config.path)),
            writeTrigger: config.writeTrigger || undefined,
            // P146 (ADR 0012): label may be a binding object or a legacy plain string.
            // getBinding passes a binding object through; for a plain string, we keep it
            // as-is via the fallback: a non-object label stays as a string.
            label: getBinding(config.label, typeof config.label === "string" && config.label ? config.label : undefined),
            min: toOptionalNumber(config.min),
            max: toOptionalNumber(config.max),
            step: toOptionalNumber(config.step),
            showValue: config.showValue === true || config.showValue === "true" || undefined,
            disabled: getBinding(config.disabled, undefined),
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: interactionInputHandler(INTERACTION_VERBS_BY_TYPE["ui-slider"], viewNodePatchInputHandler)
        }
    },
    "ui-store": {
        mapConfig: (config) => {
            const VALID_SCOPES = ["any", "broadcast-only", "client-only"];
            const rawScope = config.scope;
            const scope = typeof rawScope === "string" && VALID_SCOPES.includes(rawScope) && rawScope !== "any"
                ? rawScope
                : undefined;
            return {
                type: "ui-store",
                id: getUiId(config),
                parent: config.app || config.parent || undefined,
                // P115 (ADR 0010): carry the store's authoring name through so a
                // `reactive` expression can resolve store("<name>") → statePath.
                name: typeof config.name === "string" ? config.name : undefined,
                statePath: config.statePath,
                initialValue: parseJson(config.initialValue),
                persist: config.persist === true || config.persist === "true",
                ...(scope ? { scope } : {})
            };
        },
        options: {
            inputHandler(node, msg, send, done) {
                const storeDefinition = node.webappDefinition;
                // P201: route the update to the app that OWNS this store node
                // (matched by flow tab), NOT getActiveRuntimeAppId() — which
                // blindly returns the first-registered ui-app. In a multi-app
                // deploy that misfiled per-client state + the live push under the
                // wrong appId, so a store-bound view in any app other than the
                // first never updated (stuck at its initial value).
                const activeAppId = findAppIdForNode(node);
                const operation = normalizeStoreOperationMessage(msg, storeDefinition);

                if (!operation) {
                    send(msg);
                    if (done) {
                        done();
                    }
                    return;
                }

                // P15: clientId routing — per-client state when clientId is present
                const clientId = msg && msg.ui && msg.ui.clientId ? String(msg.ui.clientId) : undefined;

                // P110: scope guard — enforce the declared write-target policy before
                // any state mutation. "any" (default / undefined) never rejects.
                const scope = storeDefinition.scope;
                if (scope === "broadcast-only" && clientId) {
                    const errMsg = "ClientID auf Broadcast-Only-Store nicht erlaubt. Broadcast Only store does not accept per-client messages.";
                    reportRuntimeError(node, {
                        severity: "error",
                        code: "server.store.scope-violation",
                        message: errMsg,
                        context: { appId: activeAppId || undefined, nodeId: node.id, op: `store:${operation.op}` },
                        clientId
                    });
                    if (done) {
                        done(new Error(errMsg));
                    }
                    return;
                }
                if (scope === "client-only" && !clientId) {
                    const errMsg = "Broadcast nicht erlaubt: Store ist Client Only. Client Only store requires a clientId.";
                    reportRuntimeError(node, {
                        severity: "error",
                        code: "server.store.scope-violation",
                        message: errMsg,
                        context: { appId: activeAppId || undefined, nodeId: node.id, op: `store:${operation.op}` },
                        clientId: undefined
                    });
                    if (done) {
                        done(new Error(errMsg));
                    }
                    return;
                }

                // P80: validate the operation against storeOperationSchema before
                // attempting to apply it. This surfaces the schema's descriptive
                // per-operation messages (e.g. "Store operation 'set' requires a value.")
                // as structured runtime errors instead of silently running with undefined
                // path/value — or worse, having applyStoreOperation throw a generic error.
                const parseResult = storeOperationSchema.safeParse(operation);
                if (!parseResult.success) {
                    const firstMessage = parseResult.error.issues[0]?.message || "Invalid store operation.";
                    reportRuntimeError(node, {
                        severity: "error",
                        code: "server.store.invalid-operation",
                        message: firstMessage,
                        context: { appId: activeAppId || undefined, nodeId: node.id, op: `store:${operation.op}` },
                        clientId
                    });
                    if (done) {
                        done(new Error(firstMessage));
                    }
                    return;
                }

                if (!activeAppId) {
                    reportRuntimeError(node, {
                        severity: "error",
                        code: "server.store.no-active-app",
                        message: "No active ui-app is registered for ui-store updates.",
                        context: { nodeId: node.id, op: "storeUpdate" },
                        clientId
                    });
                    if (done) {
                        done(new Error("No active ui-app is registered for ui-store updates."));
                    }
                    return;
                }

                const baseState = clientId
                    ? (getClientState(activeAppId, clientId)?.state || clone(runtimeState.liveState.get(activeAppId) || initializeState([storeDefinition], [], activeAppId)))
                    : clone(runtimeState.liveState.get(activeAppId) || initializeState([storeDefinition], [], activeAppId));

                let applied;
                try {
                    applied = applyStoreOperation(baseState, storeDefinition, operation);
                }
                catch (error) {
                    reportRuntimeError(node, {
                        severity: "error",
                        code: "server.store.operation-failed",
                        message: `ui-store operation failed: ${error instanceof Error ? error.message : String(error)}`,
                        context: { appId: activeAppId, nodeId: node.id, op: `store:${operation && operation.op ? operation.op : "?"}` },
                        clientId
                    });
                    if (done) {
                        done(error instanceof Error ? error : new Error(String(error)));
                    }
                    return;
                }
                const now = Date.now();

                if (clientId) {
                    // Update only the per-client state, not the shared broadcast state.
                    setClientState(activeAppId, clientId, applied.nextState, now);
                }
                else {
                    // Broadcast: update the shared live state so all clients and
                    // future page loads render the current value.
                    runtimeState.liveState.set(activeAppId, applied.nextState);
                }

                const notificationMsg = {
                    ...msg,
                    ui: {
                        ...(msg.ui && typeof msg.ui === "object" ? msg.ui : {}),
                        store: {
                            ...applied.notification.ui.store,
                            // Preserve clientId in the outgoing notification so downstream
                            // nodes know which client the update targets (or undefined = broadcast).
                            clientId: clientId || undefined
                        }
                    }
                };
                send(notificationMsg);
                // P161 (ADR 0016 §3): a query observing THIS store re-fetches via
                // its out-port, carrying the store's current value as params. Read
                // it from the just-applied state at the store's statePath.
                const paramsValue = getValueAtPath(applied.nextState, storeDefinition.statePath);
                triggerParamQueryRefresh(storeDefinition.id, paramsValue, activeAppId, clientId);

                // P31: live push. The node state has changed; push a fresh snapshot
                // to the targeted client (per-client update) or to every subscriber
                // (broadcast). No client POST is involved — the flow drove this.
                const RED = runtimeState.RED;
                if (RED) {
                    pushSnapshotToClients(activeAppId, clientId, readDeployDefinitions(RED));
                }

                if (done) {
                    done();
                }
            }
        }
    },
    // P209 (ADR 0028): on-demand, NON-mutating reader of a ui-store. References a
    // store by id; every incoming message triggers a read of the CURRENT server
    // state at that store's statePath (+ optional sub-path). Emits the value on
    // msg.payload and mirrors the store-notification shape on msg.ui.store with
    // event:"read". No state change, no snapshot push.
    "ui-store-read": {
        mapConfig: (config) => ({
            type: "ui-store-read",
            id: getUiId(config),
            parent: config.app || config.parent || undefined,
            store: config.store || undefined,
            path: blankToUndefined(config.path)
        }),
        options: {
            inputHandler: storeReadInputHandler
        }
    },
    // P211 (ADR 0029): typed, reference-based store MUTATION node (hybrid
    // wire|reference). Op set/patch/delete/replace/reset; value from msg.payload;
    // path override precedence like ui-store-read.
    "ui-store-action": {
        mapConfig: (config) => ({
            type: "ui-store-action",
            id: getUiId(config),
            parent: config.app || config.parent || undefined,
            store: config.store || undefined,
            op: typeof config.op === "string" && config.op ? config.op : "set",
            path: blankToUndefined(config.path),
            mode: config.mode === "wire" ? "wire" : "reference"
        }),
        options: {
            inputHandler: storeActionInputHandler
        }
    },
    // P212 (ADR 0029): typed, reference-based query TRIGGER node (hybrid
    // wire|reference). Action refresh (extensible); reference mode fires the
    // referenced query's refresh directly (fireQueryRefresh), wire mode emits the
    // { queryPath, refresh:true, params } envelope. Params from msg.payload.
    "ui-query-action": {
        mapConfig: (config) => ({
            type: "ui-query-action",
            id: getUiId(config),
            parent: config.app || config.parent || undefined,
            query: config.query || undefined,
            action: typeof config.action === "string" && config.action ? config.action : "refresh",
            mode: config.mode === "wire" ? "wire" : "reference"
        }),
        options: {
            inputHandler: queryActionInputHandler
        }
    },
    "ui-query": {
        mapConfig: (config) => ({
            type: "ui-query",
            id: getUiId(config),
            parent: config.app || config.parent || undefined,
            queryPath: config.queryPath,
            params: config.params || undefined,
            refreshAction: config.refreshAction || undefined,
            // P161 (ADR 0016 §3): optional debounce for the params-observed refresh.
            debounceMs: config.debounceMs !== undefined && config.debounceMs !== "" && config.debounceMs !== null
                ? Number(config.debounceMs)
                : undefined
        }),
        options: {
            inputHandler: queryInputHandler
        }
    },
    "ui-action": {
        mapConfig: (config) => {
            // P118 (ADR 0011 §1 + Migration): derive the explicit navigate target
            // mode (wire | route | url), then keep ONLY the fields the mode owns so
            // the definition can never carry a double configuration (route ⇒ routeId,
            // no `to`; url ⇒ `to`, no routeId; wire ⇒ neither). Legacy configs are
            // migrated here: `to` → url, `routeId` → route, otherwise wire; legacy
            // params object → str-typed list.
            const targetMode = deriveNavigateTargetMode(config);
            const routeId = targetMode === "route" ? blankToUndefined(config.routeId) : undefined;
            const to = targetMode === "url" ? blankToUndefined(config.to) : undefined;
            const toType = targetMode === "url"
                ? (blankToUndefined(config.toType) || (to ? "str" : undefined))
                : undefined;
            // P118: typed param list applies in route mode (and wire mode where the
            // editor prefills it); ignored in url mode (the URL is built whole).
            const params = targetMode === "url" ? undefined : parseActionParamList(config.params);
            return {
                type: "ui-action",
                id: getUiId(config),
                parent: config.app || config.parent || undefined,
                actionType: blankToUndefined(config.actionType),
                // P118 (ADR 0011 §1): the stored navigate target SOURCE.
                targetMode,
                // P118: referenced ui-route id (route mode).
                routeId,
                // P118: url-mode destination typedInput (value + type).
                to,
                toType,
                // P118: typed navigate params (route mode).
                params,
                // P60 / ADR 0007 §3: the node picker stores a LIST of target node ids
                // (the optional "wireless" path). Legacy singular `target` (pre-P60
                // free-text) is still honoured for backward-compat.
                targets: parseTargetIds(config.targets),
                target: blankToUndefined(config.target),
                part: blankToUndefined(config.part),
                description: config.description || undefined
            };
        },
        options: {
            inputHandler: actionInputHandler
        }
    },
    // P243 (ADR 0040): ui-navigation retired — navigation is solely a ui-action
    // with actionType:"navigate". No mapConfig entry for ui-navigation any more.
    "ui-alert": {
        mapConfig: (config) => ({
            type: "ui-alert",
            id: getUiId(config),
            parent: config.app || config.parent || undefined,
            mount: config.mount || config.app || config.parent,
            order: resolveOrder(config),
            message: getBinding(config.message, config.messagePath ? stateBinding(config.messagePath) : undefined),
            severity: config.severity || undefined,
            // P67: title is a binding. Back-compat: a plain-string title (legacy
            // flows / programmatic configs) is wrapped as a literal binding.
            title: getBinding(config.title, typeof config.title === "string" && config.title.length > 0 ? literalBinding(config.title) : undefined),
            dismissible: config.dismissible === true || config.dismissible === "true" || undefined,
            visible: getBinding(config.visible, undefined),
            // P90: icon field — "auto" / "none" / icon name / binding.
            // Absent (undefined) means no icon (default when not configured).
            ...(config.icon !== undefined && config.icon !== null && config.icon !== "" ? { icon: config.icon } : {}),
            // P91: duration (positive integer, ms) + countdown (boolean).
            // duration: auto-hide the alert after this many ms; absent = never.
            // countdown: show a progress bar for remaining time (Shoelace native).
            ...(config.duration ? { duration: toOptionalNumber(config.duration) } : {}),
            ...(config.countdown === true || config.countdown === "true" ? { countdown: true } : {}),
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            // P226 (ADR 0037): ui-alert joins the interaction-verb system. show/hide
            // route through interactionInputHandler → setDynamicStateField (writing
            // the alert's ONE `visible` value); everything else falls back to the
            // view-node patch handler (message / title binding updates).
            inputHandler: interactionInputHandler(INTERACTION_VERBS_BY_TYPE["ui-alert"], viewNodePatchInputHandler)
        }
    },
    "ui-toast": {
        mapConfig: (config) => ({
            type: "ui-toast",
            id: getUiId(config),
            parent: config.app || config.parent || undefined,
            severity: config.severity || undefined,
            duration: toOptionalNumber(config.duration),
            position: config.position || undefined
        }),
        options: {
            inputHandler: toastInputHandler
        }
    },
    "ui-progress": {
        mapConfig: (config) => ({
            type: "ui-progress",
            id: getUiId(config),
            parent: config.app || config.parent || undefined,
            mount: config.mount || config.app || config.parent,
            order: resolveOrder(config),
            displayType: config.displayType || config.variant || undefined,
            value: getBinding(config.value, config.valuePath ? stateBinding(config.valuePath) : undefined),
            // P137 (ADR 0012): label is now a full binding (literal string or dynamic binding).
            // getBinding returns the binding object if config.label is a binding object; falls
            // back to the raw label value (plain string, back-compat for pre-P137 flows).
            label: getBinding(config.label, undefined) || config.label || undefined,
            showValue: config.showValue === true || config.showValue === "true" || undefined,
            // P234: upper bound of the progress range (Default 100 applied by the
            // serializer when absent/invalid). Carried into props.max via the generic
            // props block so the serializer scales value/max.
            max: toOptionalNumber(config.max),
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: viewNodePatchInputHandler
        }
    },
    "ui-skeleton": {
        mapConfig: (config) => ({
            type: "ui-skeleton",
            id: getUiId(config),
            parent: config.app || config.parent || undefined,
            mount: config.mount || config.app || config.parent,
            order: resolveOrder(config),
            visible: getBinding(config.visible, config.visiblePath ? stateBinding(config.visiblePath) : undefined),
            // P241: displayType is the ONLY placeholder-shape field. The prior
            // `|| config.variant` legacy twin was dead code — ui-skeleton has never
            // had a `variant` field in its schema or editor, so no authored flow
            // ever set it. Removed (no migration needed) so the shape source is
            // singular and documented (findings E).
            displayType: config.displayType || undefined,
            lines: toOptionalNumber(config.lines),
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: componentStateInputHandler
        }
    },
    "ui-badge": {
        mapConfig: (config) => ({
            type: "ui-badge",
            id: getUiId(config),
            parent: config.app || config.parent || undefined,
            mount: config.mount || config.app || config.parent,
            order: resolveOrder(config),
            value: getBinding(config.value, config.valuePath ? stateBinding(config.valuePath) : undefined),
            // P92: displayType is now shape (square/rounded/pill). Back-compat:
            // map old count/dot/status display type values to new shape values.
            displayType: (() => {
                const dt = config.displayType || config.variant || undefined;
                if (!dt) return undefined;
                // Legacy count/dot/status → map to new shape vocabulary
                if (dt === "count" || dt === "status") return "rounded";
                if (dt === "dot") return "rounded";
                return dt;
            })(),
            // P92: variant (renamed from severity). Back-compat: accept legacy
            // `severity` field too.
            variant: config.variant && !["count", "dot", "status", "square", "rounded", "pill"].includes(config.variant)
                ? config.variant
                : config.severity || undefined,
            // P92: pulsating maps to Shoelace `pulse` attribute.
            pulsating: config.pulsating === true || config.pulsating === "true" ? true : undefined,
            // P103: size field removed — not passed through any more.
            // P92: max field removed — not passed through any more.
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: viewNodePatchInputHandler
        }
    },
    "ui-empty-state": {
        mapConfig: (config) => ({
            type: "ui-empty-state",
            id: getUiId(config),
            parent: config.app || config.parent || undefined,
            mount: config.mount || config.app || config.parent,
            order: resolveOrder(config),
            visible: getBinding(config.visible, config.visiblePath ? stateBinding(config.visiblePath) : undefined),
            icon: config.icon || undefined,
            title: config.title || undefined,
            message: config.message || undefined,
            action: config.action || undefined,
            actionLabel: config.actionLabel || undefined,
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: componentStateInputHandler
        }
    },
    "ui-tabs": {
        // P168 (ADR 0018, Model 1a): the `tabs` config-array is REMOVED. Tabs are
        // DERIVED from the mounted `ui-tab` children (one panel per child); the
        // renderer enumerates them. Only `activeTab` (two-way) + events remain.
        mapConfig: (config) => {
            // P168 (ADR 0018 §5): preserve a LEGACY `tabs` config-array (pre-P167)
            // under `legacyTabs` so the in-editor migration pre-pass
            // (migrateLegacyTabComponents) can synthesize ui-tab children. New flows
            // have no `tabs` field and `legacyTabs` stays undefined.
            const legacyTabs = (parseJsonList(config.tabs).length > 0 ? parseJsonList(config.tabs) : parseList(config.tabs))
                .map((t) => {
                    if (typeof t === "string") {
                        try { return JSON.parse(t); } catch { return { id: t, label: t }; }
                    }
                    return t;
                })
                .filter(Boolean);
            return {
                type: "ui-tabs",
                id: getUiId(config),
                parent: config.app || config.parent || undefined,
                mount: config.mount || config.app || config.parent,
                order: resolveOrder(config),
                activeTab: getBinding(config.activeTab, config.activeTabPath ? stateBinding(config.activeTabPath) : undefined),
                variant: config.variant || undefined,
                events: parseJsonList(config.events),
                ...(legacyTabs.length > 0 ? { legacyTabs } : {}),
                ...collectNodeConfigLayoutProps(config)
            };
        },
        options: {
            inputHandler: interactionInputHandler(INTERACTION_VERBS_BY_TYPE["ui-tabs"], componentStateInputHandler)
        }
    },
    // P168 (ADR 0018, Model 1a): ui-tab — a thin CONTAINER child of ui-tabs. It
    // carries the section's `label` (value binding), optional `icon`, and `order`,
    // plus a single default `content` slot for the tab's body. The MOUNT into a
    // ui-tabs is the declaration of the tab; its own id is the slot key / the
    // `activeTab` token.
    "ui-tab": {
        mapConfig: (config) => ({
            type: "ui-tab",
            id: getUiId(config),
            parent: config.app || config.parent || undefined,
            mount: config.mount || config.app || config.parent,
            order: resolveOrder(config),
            label: getBinding(config.label, config.labelPath ? stateBinding(config.labelPath) : literalBinding(config.labelPath || "")),
            icon: config.icon || undefined,
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: passThroughInputHandler
        }
    },
    "ui-accordion": {
        // P169 (ADR 0018, Model 1a): the `sections` config-array is REMOVED.
        // Sections are DERIVED from the mounted `ui-accordion-section` children (one
        // panel per child); the renderer enumerates them. Only `openSection`
        // (two-way), `multiple`, and events remain. Mirror of ui-tabs.
        mapConfig: (config) => {
            // P169 (ADR 0018 §5): preserve a LEGACY `sections` config-array under
            // `legacySections` so the in-editor migration pre-pass
            // (migrateLegacyAccordionComponents) can synthesize section children.
            // New flows have no `sections` field and `legacySections` stays unset.
            const legacySections = (parseJsonList(config.sections).length > 0 ? parseJsonList(config.sections) : parseList(config.sections))
                .map((t) => {
                    if (typeof t === "string") {
                        try { return JSON.parse(t); } catch { return { id: t, label: t }; }
                    }
                    return t;
                })
                .filter(Boolean);
            return {
                type: "ui-accordion",
                id: getUiId(config),
                parent: config.app || config.parent || undefined,
                mount: config.mount || config.app || config.parent,
                order: resolveOrder(config),
                openSection: getBinding(config.openSection, config.openSectionPath ? stateBinding(config.openSectionPath) : undefined),
                multiple: config.multiple === true || config.multiple === "true" || undefined,
                events: parseJsonList(config.events),
                ...(legacySections.length > 0 ? { legacySections } : {}),
                ...collectNodeConfigLayoutProps(config)
            };
        },
        options: {
            inputHandler: interactionInputHandler(INTERACTION_VERBS_BY_TYPE["ui-accordion"], componentStateInputHandler)
        }
    },
    // P169 (ADR 0018, Model 1a): ui-accordion-section — a thin CONTAINER child of
    // ui-accordion (mirror of ui-tab). It carries the section's `label` (value
    // binding), optional `icon`, and `order`, plus a single default `content` slot
    // for the section body. The MOUNT into a ui-accordion is the declaration of the
    // section; its own id is the slot key / the `openSection` token.
    "ui-accordion-section": {
        mapConfig: (config) => ({
            type: "ui-accordion-section",
            id: getUiId(config),
            parent: config.app || config.parent || undefined,
            mount: config.mount || config.app || config.parent,
            order: resolveOrder(config),
            label: getBinding(config.label, config.labelPath ? stateBinding(config.labelPath) : literalBinding(config.labelPath || "")),
            icon: config.icon || undefined,
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: passThroughInputHandler
        }
    },
    "ui-breadcrumb": {
        mapConfig: (config) => {
            // P95: normalise static breadcrumb items from the editor.
            // Priority resolution:
            //   1. config.items is a binding object ({kind,...}) → use directly
            //   2. config.items is an already-parsed array → use directly
            //   3. config.itemsJson is a JSON string (new editor format) → parse
            //   4. config.items is a JSON string (legacy) → parse
            //   5. config.itemsPath (legacy P75 state-path shorthand) → stateBinding
            function normaliseItems() {
                const rawItems = config.items;
                // Dynamic binding object
                const binding = getBinding(rawItems, undefined);
                if (binding) return binding;
                // Already an array (from flow.json or tests)
                if (Array.isArray(rawItems)) return rawItems;
                // New editor format: itemsJson holds the JSON literal
                if (config.itemsJson && typeof config.itemsJson === "string" && config.itemsJson.trim()) {
                    try {
                        const parsed = JSON.parse(config.itemsJson);
                        if (Array.isArray(parsed)) return parsed;
                    } catch (_) { /* fall through */ }
                }
                // Legacy: items as JSON string
                if (rawItems && typeof rawItems === "string" && rawItems.trim()) {
                    try {
                        const parsed = JSON.parse(rawItems);
                        if (Array.isArray(parsed)) return parsed;
                    } catch (_) { /* fall through */ }
                }
                return undefined;
            }
            const resolvedItems = normaliseItems()
                || (config.itemsPath ? stateBinding(config.itemsPath) : undefined);

            return {
                type: "ui-breadcrumb",
                id: getUiId(config),
                parent: config.app || config.parent || undefined,
                mount: config.mount || config.app || config.parent,
                order: resolveOrder(config),
                // P95: layout="breadcrumb" activates child-node slot mode (c & d).
                layout: config.layout === "breadcrumb" ? "breadcrumb" : undefined,
                items: resolvedItems,
                separator: config.separator || undefined,
                // P95: ALL items emit a `click` event (sourceId = breadcrumb node id,
                // params.action = item's action value or label).
                // `navigate` kept as back-compat alias for consumers pinned to P75.
                events: ["click"],
                ...collectNodeConfigLayoutProps(config)
            };
        },
        options: {
            inputHandler: interactionInputHandler(INTERACTION_VERBS_BY_TYPE["ui-breadcrumb"], componentStateInputHandler)
        }
    },
    "ui-menu": {
        mapConfig: (config) => ({
            type: "ui-menu",
            id: getUiId(config),
            parent: config.app || config.parent || undefined,
            mount: config.mount || config.app || config.parent,
            order: resolveOrder(config),
            // P244: the prior `|| config.variant` legacy twin was dead code — ui-menu
            // has never had a `variant` field in its schema or editor, so no authored
            // flow ever set it. Removed (no migration needed) so the display-type
            // source is singular and documented (same pattern as ui-skeleton P241).
            displayType: config.displayType || undefined,
            // P157 (ADR 0012): `items` is a STRUCTURAL array source (store/query/
            // reactive/json-literal) — the menu renders its entries itself (NOT a
            // repeats case). A json-literal binding's raw array is unwrapped to a
            // static array (props.items); a dynamic binding passes through (resolved
            // structurally by the renderer); a legacy `itemsPath` migrates to a state
            // binding; a bare JSON/array stays an array. `activeRoute` /
            // `activeRoutePath` (read-only active route) → `activeItem` binding.
            items: resolveMenuItems(config),
            activeItem: getBinding(config.activeRoute, config.activeRoutePath ? stateBinding(config.activeRoutePath) : undefined),
            // P75: ui-menu always exposes a single navigate output port; a click on
            // a navigable item (route/path, not external href) emits a `navigate`
            // event. See the ui-breadcrumb note above.
            events: ["navigate"],
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: interactionInputHandler(INTERACTION_VERBS_BY_TYPE["ui-menu"], componentStateInputHandler)
        }
    },
    "ui-pagination": {
        mapConfig: (config) => ({
            type: "ui-pagination",
            id: getUiId(config),
            parent: config.app || config.parent || undefined,
            mount: config.mount || config.app || config.parent,
            order: resolveOrder(config),
            // P154 (ADR 0012): `currentPage` (canonical, two-way value typedInput)
            // is the page source; it maps to the schema `page` binding. Legacy
            // order: canonical `currentPage` binding object → legacy `page` →
            // legacy `currentPagePath` plain state path (migrated to a state binding).
            page: getBinding(config.currentPage, getBinding(config.page, config.currentPagePath ? stateBinding(config.currentPagePath) : undefined)),
            pageSize: config.pageSize ? stateBinding(config.pageSize) : undefined,
            // P154 (ADR 0012): `total` (canonical, read-only value typedInput) maps
            // to the schema `totalPages` binding. Legacy order: canonical `total`
            // → legacy `totalPages` → legacy `totalPath` plain state path.
            totalPages: getBinding(config.total, getBinding(config.totalPages, config.totalPath ? stateBinding(config.totalPath) : undefined)),
            // P252: `showInfo` (editor checkbox) toggles the measured info-text
            // region rendered by the serializer. A plain boolean; passed straight
            // through so props.showInfo drives `.webapp-pagination-info`.
            showInfo: config.showInfo === true || config.showInfo === "true" || undefined,
            events: parseJsonList(config.events),
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: componentStateInputHandler
        }
    },
    "ui-stepper": {
        mapConfig: (config) => ({
            type: "ui-stepper",
            id: getUiId(config),
            parent: config.app || config.parent || undefined,
            mount: config.mount || config.app || config.parent,
            order: resolveOrder(config),
            steps: (parseJsonList(config.steps).length > 0 ? parseJsonList(config.steps) : parseList(config.steps)).map((t) => {
                if (typeof t === "string") {
                    try { return JSON.parse(t); } catch { return { id: t, label: t }; }
                }
                return t;
            }).filter(Boolean),
            activeStep: getBinding(config.activeStep, config.activeStepPath ? stateBinding(config.activeStepPath) : undefined),
            variant: config.orientation || undefined,
            events: filterSupportedStepperEvents(parseJsonList(config.events)),
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: interactionInputHandler(INTERACTION_VERBS_BY_TYPE["ui-stepper"], componentStateInputHandler)
        }
    },
    "ui-image": {
        mapConfig: (config) => ({
            type: "ui-image",
            id: getUiId(config),
            parent: config.app || config.parent || undefined,
            mount: config.mount || config.app || config.parent,
            order: resolveOrder(config),
            src: getBinding(config.src, config.srcPath ? stateBinding(config.srcPath) : undefined),
            // P151 (ADR 0012): alt and fallback are binding-capable. getBinding
            // returns the object when it has .kind; a plain string is kept as-is
            // so the legacy string path (E2E FlowBuilder tests) keeps working.
            alt: getBinding(config.alt, typeof config.alt === "string" && config.alt ? { kind: "literal", value: config.alt } : undefined),
            fallbackSrc: getBinding(config.fallback, typeof config.fallback === "string" && config.fallback ? { kind: "literal", value: config.fallback } : undefined),
            width: config.width || undefined,
            height: config.height || undefined,
            // P70: object-fit mode (contain/cover/fill/none).
            fit: config.fit || undefined,
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: viewNodePatchInputHandler
        }
    },
    "ui-icon": {
        mapConfig: (config) => ({
            type: "ui-icon",
            id: getUiId(config),
            parent: config.app || config.parent || undefined,
            mount: config.mount || config.app || config.parent,
            order: resolveOrder(config),
            icon: mapIconField(config.icon) || "",
            size: config.size || undefined,
            // P238 (ADR 0039 §4): `color` is the BASE bindable field now (the
            // plain-string override is gone). A legacy deployed plain string is
            // migrated to a literal binding here, before validation.
            color: normalizeColorField(config.color),
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: componentStateInputHandler
        }
    },
    "ui-list": {
        mapConfig: (config) => ({
            type: "ui-list",
            id: getUiId(config),
            parent: config.app || config.parent || undefined,
            mount: config.mount || config.app || config.parent,
            order: resolveOrder(config),
            // P171: `items` is a STRUCTURAL value-binding (typedInput). A stored
            // binding object wins; a legacy `itemsPath` plain path migrates to a
            // `state` binding (leading `state.` stripped); a bare JSON array literal
            // (flow.json/tests) is kept as a static array.
            items: getBinding(config.items, migrateStatePath(config.itemsPath)) || parseJsonList(config.items),
            // P202 (ADR 0026): the `visible` base-field binding — carried into the
            // component so toComponentDefinitions wires it to `visibleIf` and the
            // renderer OMITS the list when it resolves false (DOM-absent, not
            // CSS-hidden). Was missing here → a deliberate visible=false never hid
            // the list (the owner's 2026-07-05 bug). Mirrors ui-alert/ui-skeleton.
            visible: getBinding(config.visible, config.visiblePath ? stateBinding(config.visiblePath) : undefined),
            displayType: config.displayType || config.variant || undefined,
            // P180: ordered (boolean, default false) — switches ul↔ol. Mirrors how
            // displayType is carried into the definition; absent/false → undefined.
            ordered: config.ordered === true || config.ordered === "true" ? true : undefined,
            // P171: node-wide value display + badge colour role.
            displayValue: config.displayValue || undefined,
            badgeVariant: config.badgeVariant || undefined,
            // P208: item-field mapping — WHICH raw-entity field is the label/value/id/
            // icon of a row. Absent ⇒ the serializer's defaults (label/value/id/icon),
            // so shaped-item lists are unaffected. Flat field names only in this stage.
            labelField: config.labelField || undefined,
            valueField: config.valueField || undefined,
            idField: config.idField || undefined,
            iconField: config.iconField || undefined,
            // P173: single-select switch + two-way selectedId binding (analogous to
            // ui-tabs `activeTab`). `selectable` is a plain boolean; `selectedId` is a
            // binding object (a stored binding wins, else a legacy `selectedIdPath`
            // plain state path migrates to a state binding). Only relevant when
            // `selectable`; an absent/invalid id marks no row.
            selectable: config.selectable === true || config.selectable === "true" ? true : undefined,
            selectedId: getBinding(config.selectedId, config.selectedIdPath ? stateBinding(config.selectedIdPath) : undefined),
            events: parseJsonList(config.events).length > 0 ? parseJsonList(config.events) : undefined,
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: viewNodePatchInputHandler
        }
    },
    // P165 (ADR 0017): ui-repeat — a template CONTAINER. It carries no rendered
    // leaf field of its own; its children mount into the fixed default slot
    // (container:<id>/content) and the renderer clones that subtree per item of
    // the bound `items` collection. `items` is a REQUIRED value-binding; the wire
    // path (msg.payload → items) is handled by viewNodePatchInputHandler exactly
    // like ui-list. `keyField` is the optional stable per-instance key.
    "ui-repeat": {
        mapConfig: (config) => ({
            type: "ui-repeat",
            id: getUiId(config),
            parent: config.app || config.parent || undefined,
            mount: config.mount || config.app || config.parent,
            order: resolveOrder(config),
            // items: full value-binding (typedInput). Back-compat fallbacks mirror
            // ui-list: a plain itemsPath state path, or a JSON literal array.
            items: getBinding(config.items, config.itemsPath ? stateBinding(config.itemsPath) : undefined)
                || (parseJsonList(config.items).length > 0 ? { kind: "literal", value: parseJsonList(config.items) } : undefined),
            keyField: config.keyField || undefined,
            // P193 (ADR 0023): the optional alias naming this repeat's item scope,
            // so a descendant can address THIS level by name (scope-qualified
            // item/index). Empty/absent → only the generic innermost item/index.
            itemName: config.itemName || undefined,
            // P191: ui-repeat's OWN content-slot layout preset — carried through
            // exactly like ui-container's `layout: config.layoutId`. The editor
            // stores the preset id in `#node-input-layoutId`; the generated fixtures
            // set `layout` directly. Without this the definition lost the preset and
            // the bucket logic default-migrated every repeat to "vertical", so a
            // chosen grid layout never reached the renderer's per-item container.
            layout: config.layoutId || config.layout,
            // P197: ui-repeat is a full container after P191, so it carries the
            // semantic container `variant` (CONTAINER_VARIANTS) just like
            // ui-container (`variant: config.variant`). toComponentDefinitions
            // applies the chrome-less default (`transparent`, ADR 0017) when absent,
            // and expandRepeat spreads it onto the per-item container so it renders
            // through the shared container-variant source (P198). Without this the
            // chosen variant never reached the renderer (every repeat defaulted to
            // transparent).
            variant: config.variant || undefined,
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: viewNodePatchInputHandler
        }
    },
    "ui-avatar": {
        mapConfig: (config) => ({
            type: "ui-avatar",
            id: getUiId(config),
            parent: config.app || config.parent || undefined,
            mount: config.mount || config.app || config.parent,
            order: resolveOrder(config),
            // P94: `src` is now a full binding (image typedInput). Back-compat: old
            // `srcPath` (plain state path, pre-P94) is still accepted.
            src: getBinding(config.src, config.srcPath ? stateBinding(config.srcPath) : undefined),
            // P94: initials is now a full binding. Back-compat: plain string from
            // pre-P94 flows is accepted by passing it as a literal binding.
            initials: (config.initials && typeof config.initials === "object" && typeof config.initials.kind === "string")
                ? getBinding(config.initials, undefined)
                : (typeof config.initials === "string" && config.initials ? { kind: "literal", value: config.initials } : undefined),
            icon: mapIconField(config.icon),
            // P93: alt attribute removed — sl-avatar uses the `label` attr for a11y.
            size: config.size || undefined,
            shape: config.shape || undefined,
            // P94: variant (semantic colour role). Shoelace emits data-variant instead.
            variant: config.variant || undefined,
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: viewNodePatchInputHandler
        }
    },
    "ui-divider": {
        mapConfig: (config) => ({
            type: "ui-divider",
            id: getUiId(config),
            parent: config.app || config.parent || undefined,
            mount: config.mount || config.app || config.parent,
            order: resolveOrder(config),
            orientation: config.orientation || undefined,
            label: config.label || undefined,
            ...collectNodeConfigLayoutProps(config)
        }),
        // P76: ui-divider is a static display node with no input port (inputs:0 in
        // the editor). The previous componentStateInputHandler was unreachable dead
        // code. Removing it makes the runtime consistent with the spec and the editor.
        options: {}
    },
    // P57: ui-log — persistent error/log display, subscribes to SSE "error" channel
    "ui-log": {
        mapConfig: (config) => ({
            type: "ui-log",
            id: getUiId(config),
            parent: config.app || config.parent || undefined,
            mount: config.mount || config.app || config.parent,
            order: resolveOrder(config),
            minSeverity: config.minSeverity || undefined,
            maxEntries: toOptionalNumber(config.maxEntries),
            collapsed: config.collapsed === true || config.collapsed === "true" || undefined,
            ...collectNodeConfigLayoutProps(config)
        }),
        options: {
            inputHandler: passThroughInputHandler
        }
    },
    // P179 (ADR 0020): ui-component-definition — off-canvas template container.
    // It is never mounted into a real region; its only role is to be expanded by
    // instances. Its children mount via `def:<id>/content`. No input handling.
    "ui-component-definition": {
        mapConfig: (config) => ({
            type: "ui-component-definition",
            id: getUiId(config),
            // Off-canvas: an outer mount/parent is NOT required. If one happens to be
            // set it is harmless — the def: subtree is matched by id, not by mount.
            parent: config.app || config.parent || undefined,
            mount: config.mount || config.app || config.parent || undefined,
            name: blankToUndefined(config.name)
        }),
        options: {}
    },
    // P179 (ADR 0020): ui-component-instance — a leaf that EXPANDS a definition's
    // def: subtree at its outer mount, resolving its `props` into a propScope frame.
    "ui-component-instance": {
        mapConfig: (config) => ({
            type: "ui-component-instance",
            id: getUiId(config),
            parent: config.app || config.parent || undefined,
            mount: config.mount || config.app || config.parent,
            order: resolveOrder(config),
            definitionId: config.definitionId || "",
            // `props` is a map name → value-binding (any binding kind). The editor
            // persists it as a JSON string or an object; normalise to an object of
            // binding objects so toComponentDefinitions can route each into bind.
            props: parsePropsMap(config.props)
        }),
        options: {
            inputHandler: passThroughInputHandler
        }
    }
};

// P179 (ADR 0020): parse a ui-component-instance `props` map. Accepts an object
// (already a map name → value-binding) or a JSON string (the editor's typedInput
// map control persists a stringified object). Returns a plain object; a malformed
// value yields {} (a defined "no props", not a crash).
function parsePropsMap(value) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
        return value;
    }
    if (typeof value === "string" && value.trim()) {
        try {
            const parsed = JSON.parse(value);
            return (parsed && typeof parsed === "object" && !Array.isArray(parsed)) ? parsed : {};
        } catch {
            return {};
        }
    }
    return {};
}

function registerNodeType(RED, type) {
    // P31: the live push (and dynamic action targeting) needs the RED runtime to
    // resolve nodes and read deploy definitions. Each node self-registers through
    // this path (not the legacy registerWebappNodes factory), so capture RED here.
    runtimeState.RED = RED;
    registerEndpoints(RED);
    const registration = runtimeNodeRegistry[type];

    if (!registration) {
        throw new Error(`Unknown webapp node type '${type}'.`);
    }

    createNodeConstructor(RED, type, registration.mapConfig, registration.options);
}

function registerWebappNodes(RED) {
    runtimeState.RED = RED;
    Object.keys(runtimeNodeRegistry).forEach((type) => {
        registerNodeType(RED, type);
    });
    registerDeployHook(RED);
}

registerWebappNodes.__test__ = {
    // P30: raw client→server event ingest — routes to the originating node and
    // emits msg.ui on its output port; takes no domain action.
    dispatchClientEvent,
    applyStoreOperation,
    // P203 (ADR 0027): ui-input runtime write-back (store/flow/global) + legacy
    // storeId/path → writeTo store migration.
    applyInputWriteBack,
    legacyStoreWriteTo,
    // P160: query live-state — push folding + snapshot source derivation.
    applyQueryMessage,
    buildQuerySources,
    initializeState,
    getDefinitionBuckets,
    getAppModelResult,
    migrateLegacyTabComponents,
    validateUiTabChildrenUniqueness,
    // P205: app-scoped node → valid ui-app parent required (deploy error)
    collectAppScopedParentIssues,
    validateAppScopedNodeParent,
    migrateLegacyAccordionComponents,
    validateUiAccordionSectionChildrenUniqueness,
    renderAppPage,
    buildAppSnapshot,
    renderLayoutHtml,
    renderComponentHtml,
    componentStateInputHandler,
    dialogInputHandler,
    // P218 (ADR 0033): strip a consumed msg.ui.<command> sub-key after success.
    stripConsumedUiEnvelope,
    normalizeStoreOperationMessage,
    queryInputHandler,
    queryActionInputHandler,
    triggerParamQueryRefresh,
    // P209/P211/P214: reference-based store nodes + store-reference resolution
    // (real ui-store first, else a ui-query's implicit per-query params store).
    storeActionInputHandler,
    storeReadInputHandler,
    findStoreDefinitionById,
    findQueryParamsStoreDefinitionById,
    resolveStoreReferenceById,
    findQueryRegistrationById,
    findQueryDefinitionById,
    fireQueryRefresh,
    // P214 (ADR 0030, „Params bei JEDEM Out-Port-Refresh"): current-params
    // resolution + trigger enrichment used across all out-port refresh routes.
    resolveCurrentQueryParams,
    enrichTriggerWithCurrentParams,
    // P20a
    buttonInputHandler,
    actionInputHandler,
    // P60 / ADR 0007 §3: ui-action node-picker target list helpers
    parseTargetIds,
    collectConfiguredTargetIds,
    // P59 / ADR 0007 §2: per-node interaction handler factory + verb ownership
    interactionInputHandler,
    INTERACTION_VERBS_BY_TYPE,
    // P66 (ADR 0007) / P118 (ADR 0011): navigate scenarios + typed resolution
    resolveActionTo,
    resolveActionParamRecord,
    resolveRouteIdToPath,
    deriveNavigateTargetMode,
    parseActionParamList,
    resolveNavigateLocation,
    performTargetNavigate,
    validateAppRootUniqueness,
    parseParamsObject,
    runtimeNodeRegistry,
    runtimeState,
    // P207: order default = canvas y when order is empty
    toOptionalNumber,
    resolveOrder,
    // P39 / P52: view-node input patch handler + deploy-definition reader
    viewNodePatchInputHandler,
    readDeployDefinitions,
    // P224 (ADR 0037): dynamic-state field foundation — the unified write API,
    // the compiled-component slot normaliser, and the reserved slot-path helper.
    setDynamicStateField,
    applyDynamicStateSlots,
    dynamicStateSlotPath,
    toComponentDefinitions,
    // P225 (ADR 0037): browser-reachable dynamic-state write dispatch (duration
    // auto-hide routes through this to setDynamicStateField).
    dispatchDynamicStateWrite,
    // P223 (ADR 0036): Message mode drives every msg-bound field — bound-field
    // scan, boolean coercion, literal-wrap, and the live-patch merge helper.
    collectBoundViewFields,
    coerceViewBoolean,
    coerceViewFieldValue,
    wrapViewFieldValue,
    computeLiveViewPatch,
    // P111: server-side resolution of flow/global/env value bindings → literal
    resolveContextBindingsForDef,
    // P70 Ebene 2: ui-image msg.payload → src (Buffer/Base64 → data:)
    payloadToImageSrc,
    sniffImageContentType,
    // P70 Ebene 3: media-store asset proxy resolution + path-traversal guard
    resolveAssetStoreUrl,
    // P15
    getClientState,
    setClientState,
    resolveReconnectState,
    // P106: live model delivery on deploy — shell signature + deploy push + mode
    computeShellSignature,
    pushDeployToClients,
    resolveAppMode,
    normalizeAppMode,
    // P31: live Server→Client push transport (SSE)
    addStreamClient,
    removeStreamClient,
    getStreamSubscribers,
    // P112: connect-based route lifecycle (onEnter/onLeave on every arrival)
    handleClientArrival,
    scheduleArrivalLeave,
    emitArrivalLifecycle,
    ARRIVAL_LEAVE_GRACE_MS,
    pushSnapshotToClients,
    pushActionCommandToClients,
    buildActionCommand,
    writeStreamEvent,
    // P56: structured runtime logging + opt-in error forwarding (ADR 0006)
    pushErrorToClients,
    reportRuntimeError,
    resolveAppForwardConfig,
    redactErrorMessage,
    makeStructuredError,
    // P86: ui-app clientConnected/clientDisconnected emission
    emitAppClientEvent
};

registerWebappNodes.registerNodeType = registerNodeType;

module.exports = registerWebappNodes;
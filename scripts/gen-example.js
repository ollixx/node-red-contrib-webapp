#!/usr/bin/env node
/**
 * gen-example.js
 *
 * Generates examples/customers-crud/flow.json in Node-RED editor format.
 *
 * The nodes use the editor-layer field names that the node HTML defaults expect
 * (e.g. `root`, `uiId`, `mount`, `text`, `valuePath`, `rowsPath`).  At runtime
 * webapp.js maps these editor fields to the schema representation via mapConfig.
 *
 * Usage:
 *   node scripts/gen-example.js
 *   pnpm gen:example
 */

"use strict";

const { writeFileSync, existsSync } = require("node:fs");
const { resolve } = require("node:path");

const rootDir = resolve(__dirname, "..");
const FLOW_TAB_ID = "flow1";
const Z = FLOW_TAB_ID;

// ── Mount-to-Layout Mapping ──────────────────────────────────────────────────
// Each route/dialog specifies a layoutId. This map lets us determine which
// placement props are valid for a node based on its mount point.
// Grid layouts use row/col/colSize/rowSize; absolute layouts use layoutX/layoutY;
// vertical/horizontal/app layouts use none.

const mountTargetLayouts = {
    // Routes with their layout presets. P48: home content mounts to the app's
    // implicit root route (customersApp), which uses the "app" layout preset.
    "customersApp": "app",
    "customers": "vertical",
    "customerDetail": "vertical",
    "customerEditor": "vertical"
};

// Helper to determine which placement props should be emitted for a given mount
function getPlacementProps(mount, placementData = {}) {
    if (!mount) {
        return {};
    }

    // Determine the target layout from the mount reference
    let layoutId;

    if (mount.startsWith("layout:")) {
        // Direct layout reference: "layout:grid/content" → "grid"
        const match = mount.match(/^layout:(\w+)\//);
        layoutId = match ? match[1] : null;
    } else if (mount.includes("/")) {
        // Route reference: "route:/customers/content" → look up route
        // or "customerEditor/content" → named reference, look up by name
        const parts = mount.split("/");
        const target = parts[0];
        layoutId = mountTargetLayouts[target];
    } else {
        // Other formats - assume no placement
        layoutId = null;
    }

    // Emit only the placement props that match the layout
    const result = {};
    if (layoutId === "grid") {
        // Grid layout: emit row, col, colSize, rowSize
        if ("row" in placementData) result.row = placementData.row;
        if ("col" in placementData) result.col = placementData.col;
        if ("colSize" in placementData) result.colSize = placementData.colSize;
        if ("rowSize" in placementData) result.rowSize = placementData.rowSize;
    } else if (layoutId === "absolute") {
        // Absolute layout: emit layoutX, layoutY
        if ("layoutX" in placementData) result.layoutX = placementData.layoutX;
        if ("layoutY" in placementData) result.layoutY = placementData.layoutY;
    }
    // For vertical/horizontal/app/other, emit no placement props

    return result;
}

// ── Layout ────────────────────────────────────────────────────────────────────
// Nodes are placed in named rows; each row gets a Y coordinate.
// Within a row, nodes are placed left-to-right with X_STEP spacing.

const X_START = 120;
const X_STEP = 240;
const Y_START = 60;
const Y_STEP = 100;

const rows = {
    structure:   0,
    state:       1,
    actions:     2,
    viewApp:     3,
    viewHome:    4,
    viewCustomers: 5,
    viewDetail:  6,
    viewDialog:  7,
    logic:       8,
    logic2:      9
};

function pos(row, col) {
    return {
        x: X_START + col * X_STEP,
        y: Y_START + rows[row] * Y_STEP
    };
}

function node(type, id, rowName, col, fields) {
    // Extract placement data before filtering by layout
    const { row, col: gridCol, colSize, rowSize, layoutX, layoutY, ...restFields } = fields;
    const placementData = {};
    if (row !== undefined) placementData.row = row;
    if (gridCol !== undefined) placementData.col = gridCol;
    if (colSize !== undefined) placementData.colSize = colSize;
    if (rowSize !== undefined) placementData.rowSize = rowSize;
    if (layoutX !== undefined) placementData.layoutX = layoutX;
    if (layoutY !== undefined) placementData.layoutY = layoutY;

    // Filter placement props based on the mount target's layout
    const layoutAwarePlacement = getPlacementProps(fields.mount, placementData);

    return { type, id, ...restFields, ...layoutAwarePlacement, z: Z, ...pos(rowName, col), wires: [[]] };
}

// A plain Node-RED `function` node. ALL domain logic for the CRUD lives in these.
// `outputs` controls the number of output ports; `wires` is the per-port wiring.
function fn(id, rowName, col, name, func, outputs, wires) {
    return {
        type: "function",
        id,
        name,
        func,
        outputs,
        noerr: 0,
        initialize: "",
        finalize: "",
        libs: [],
        z: Z,
        ...pos(rowName, col),
        wires
    };
}

// ── Nodes ─────────────────────────────────────────────────────────────────────

const APP = "customersApp";

const flowNodes = [

    // ── Structure ────────────────────────────────────────────────────────────
    node("ui-app", APP, "structure", 0, {
        name:   "Customers CRM",
        title:  "Customers CRM",   // schema field used directly when bypassing mapConfig
        root:   APP,               // required: app ID used in /webapp/:appId routes
        layout: "app",
        // P23: design tokens drive the Web Component theme via CSS custom
        // properties. A distinct primary color so the theme is visibly applied.
        tokens: {
            colorPrimary: "rgb(124, 58, 237)",
            colorPrimaryFg: "rgb(255, 255, 255)"
        }
    }),
    // P48: the ui-app is the implicit root route ("/"). Home content mounts
    // directly into the app's content slot (customersApp.content) — there is no
    // ui-route with path "/" (that path is reserved for the app root).
    node("ui-route", "customers", "structure", 2, {
        name:    "Customers",
        uiId:    "customers",
        app:  APP,
        path:    "/customers",
        title:   "Customers",
        layoutId: "app"
    }),
    node("ui-route", "customerDetail", "structure", 3, {
        name:    "Customer detail",
        uiId:    "customerDetail",
        app:  APP,
        path:    "/customers/:id",
        title:   "Customer detail",
        layoutId: "app"
    }),
    node("ui-dialog", "customerEditor", "structure", 4, {
        name:    "Edit customer",
        uiId:    "customerEditor",
        app:  APP,
        title:   "Edit customer",
        // P64: native <sl-dialog> with the dialog layout preset (header / content /
        // footer slots). closable → native X / ESC / overlay dismissal emits
        // onClose; no wired close action needed.
        layoutId: "dialog",
        modal:   true,
        closable: true
    }),

    // ── State ────────────────────────────────────────────────────────────────
    // The customer LIST + the currently-selected customer live in this store.
    // It is the single source the table and the detail page bind to (via `state`
    // bindings). The flow's function nodes own every mutation of this store — the
    // runtime never writes customer data. The seed below is declarative DATA, not
    // logic: the create/update/delete behaviour lives entirely in function nodes.
    node("ui-store", "customersStore", "state", 0, {
        name:         "Customers store",
        uiId:         "customersStore",  // required
        app:       APP,
        statePath:    "customers",       // required
        initialValue: JSON.stringify({
            list: [
                { id: "c-100", name: "Ada Lovelace", email: "ada@example.com", status: "active" },
                { id: "c-200", name: "Grace Hopper", email: "grace@example.com", status: "inactive" },
                { id: "c-300", name: "Radia Perlman", email: "radia@example.com", status: "trial" }
            ],
            current: { id: "c-100", name: "Ada Lovelace", email: "ada@example.com", status: "active" }
        })
    }),
    node("ui-store", "draftStore", "state", 1, {
        name:         "Draft store",
        uiId:         "draftStore",     // required
        app:       APP,
        statePath:    "draft.customer", // required
        initialValue: JSON.stringify({ name: "", email: "", status: "draft" })
    }),
    // The editor dialog's open/closed state is plain UI state. A function node
    // flips it (per-client, so only the acting user sees the dialog) and the live
    // snapshot push opens/closes it. No dialog logic lives in the runtime.
    node("ui-store", "dialogStore", "state", 4, {
        name:         "Dialog store",
        uiId:         "dialogStore",
        app:       APP,
        statePath:    "ui.dialogs.customerEditor",
        initialValue: JSON.stringify({ open: false })
    }),
    node("ui-query", "customersQuery", "state", 2, {
        name:          "Customers query",
        uiId:          "customersQuery", // required
        app:        APP,
        queryPath:     "customers.list", // required
        refreshAction: "refreshCustomers",
        // Declarative seed data — the runtime no longer hard-codes demo data.
        previewData:   JSON.stringify({
            list: [
                { id: "c-100", name: "Ada Lovelace", email: "ada@example.com", status: "active" },
                { id: "c-200", name: "Grace Hopper", email: "grace@example.com", status: "inactive" },
                { id: "c-300", name: "Radia Perlman", email: "radia@example.com", status: "trial" }
            ],
            current: { id: "c-100", name: "Ada Lovelace", email: "ada@example.com", status: "active" }
        })
    }),
    node("ui-query", "customerDetailQuery", "state", 3, {
        name:      "Customer detail query",
        uiId:      "customerDetailQuery",
        app:    APP,
        queryPath: "customers.current"   // required
    }),

    // ── Actions ──────────────────────────────────────────────────────────────
    // Orphaned ui-action nodes from earlier iterations are removed:
    //   • openCustomerEditor  — dialog opens via dialogStore; no feeder, unused.
    //   • saveCustomer        — dialog closes via dialogStore after save; no feeder.
    //   • refreshCustomers    — refresh goes through fnRefreshCustomers→customersStore; no feeder.
    //   • closeCustomerEditor — P64 removed the hard-coded dialog Close link. The
    //     native <sl-dialog> X / ESC / overlay dismissal emits onClose and the
    //     server flips ui.dialogs.customerEditor.open=false; Cancel is flow-wired.
    node("ui-action", "openCustomerDetail", "actions", 1, {
        name:       "Open detail",
        uiId:       "openCustomerDetail",
        app:     APP,
        actionType: "navigate",
        targetMode: "path",
        target:     "app",
        to:         "/customers/:id"
    }),
    node("ui-action", "goToCustomers", "actions", 2, {
        name:       "Go to customers",
        uiId:       "goToCustomers",
        app:     APP,
        actionType: "navigate",
        targetMode: "path",
        target:     "app",
        to:         "/customers"
    }),
    node("ui-action", "deleteCustomer", "actions", 3, {
        name:       "Delete customer",
        uiId:       "deleteCustomer",
        app:     APP,
        actionType: "navigate",
        targetMode: "path",
        target:     "app",
        to:         "/customers"
    }),
    node("ui-navigation", "navToCustomers", "actions", 4, {
        name:   "Nav to customers",
        uiId:   "navToCustomers",  // required
        app: APP,
        to:     "/customers"       // required
    }),

    // ── View – App shell (navbar) ─────────────────────────────────────────────
    // P36: mount a navigation affordance in the app-level navbar slot so the
    // shell has a coherent sidebar nav. The button triggers the goToCustomers
    // ui-action; its visual is overridden by navbar-slot CSS to render as a
    // plain stacked nav link (no pill/border — pure whitespace + type hierarchy).
    node("ui-button", "navCustomersButton", "viewApp", 0, {
        name:   "Customers nav link",
        uiId:   "navCustomersButton",
        app: APP,
        mount:  "layout:app/navbar",
        order:  0,
        label:  "Customers",
        action: "goToCustomers"
    }),

    // ── View – / (home) ──────────────────────────────────────────────────────
    node("ui-text", "pageTitle", "viewHome", 0, {
        name:    "Page title",
        uiId:    "pageTitle",              // required
        app:  APP,
        mount:   "customersApp.content",      // home route heading
        order:   -1,
        text:    "Customers CRM",          // required (editor field for literal text)
        value:   { kind: "literal", value: "Customers CRM" },
        variant: "headline"
    }),
    node("ui-text", "homeWelcomeHeading", "viewHome", 0, {
        name:    "Welcome heading",
        uiId:    "homeWelcomeHeading",
        app:  APP,
        mount:   "customersApp.content",
        order:   0,
        text:    "Welcome to Customers CRM",
        value:   { kind: "literal", value: "Welcome to Customers CRM" },
        variant: "headline"
    }),
    node("ui-text", "homeWelcomeBody", "viewHome", 1, {
        name:    "Welcome body",
        uiId:    "homeWelcomeBody",
        app:  APP,
        mount:   "customersApp.content",
        order:   1,
        text:    "Manage your customer relationships in one place.",
        value:   { kind: "literal", value: "Manage your customer relationships in one place." }
    }),
    node("ui-button", "homeGoToCustomersButton", "viewHome", 2, {
        name:   "Go to customers",
        uiId:   "homeGoToCustomersButton",
        app: APP,
        mount:   "customersApp.content",
        order:  2,
        label:  "Go to customers",
        action: "goToCustomers"
    }),
    node("ui-alert", "homeTipAlert", "viewHome", 3, {
        name:     "Home tip",
        uiId:     "homeTipAlert",
        app:   APP,
        mount:    "customersApp.content",
        order:    3,
        // P67: message and title are bindings (typedInput). Pass binding objects
        // so mapConfig's getBinding resolves them directly.
        message:  { kind: "literal", value: "Use the Customers section to create, view and edit customer records." },
        severity: "info",
        title:    { kind: "literal", value: "Tip" }
    }),

    // ── View – /customers ────────────────────────────────────────────────────
    node("ui-button", "newCustomerButton", "viewCustomers", 0, {
        name:   "New customer",
        uiId:   "newCustomerButton",        // required
        app: APP,
        mount:  "route:/customers/content", // required
        order:  0,
        label:  "New customer"              // required; wired → fnNewCustomer which opens dialog via dialogStore
    }),
    node("ui-button", "refreshCustomersButton", "viewCustomers", 1, {
        name:         "Refresh",
        uiId:         "refreshCustomersButton",
        app:       APP,
        mount:        "route:/customers/content",
        order:        1,
        label:        "Refresh",
        // no action ref — wired directly to fnRefreshCustomers which re-pushes the list
        disabledPath: "ui.queries.customersQuery.loading",
        disabled:     { kind: "state", path: "ui.queries.customersQuery.loading", fallback: false }
    }),
    node("ui-text", "editorStatus", "viewCustomers", 2, {
        name:   "Editor status",
        uiId:   "editorStatus",
        app: APP,
        mount:  "route:/customers/content",
        order:  2,
        text:   "Editing customer",
        value:  { kind: "literal", value: "Editing customer" }
    }),
    node("ui-table", "customersTable", "viewCustomers", 3, {
        name:         "Customers table",
        uiId:         "customersTable",
        app:       APP,
        mount:        "route:/customers/content",
        order:        3,
        columns:      "name,email,status",       // required (comma-separated)
        // P33: the table binds to the customers STORE (state), not a query.
        // The flow's function nodes push list updates into this store; the live
        // SSE transport re-renders the table. selectAction makes the rows
        // clickable and emits a `rowSelect` event on this table's OUTPUT port —
        // a wired function node (not the runtime) decides what happens next.
        rowsPath:     "customers.list",
        rows:         { kind: "state", path: "customers.list" },
        selectAction: "openCustomerDetail"
    }),

    // ── View – /customers/:id ────────────────────────────────────────────────
    node("ui-text", "detailRouteTitle", "viewDetail", 0, {
        name:    "Detail title",
        uiId:    "detailRouteTitle",
        app:  APP,
        mount:   "route:/customers/:id/content",
        order:   0,
        text:    "Customer detail",
        value:   { kind: "literal", value: "Customer detail" },
        variant: "headline"
    }),
    node("ui-button", "backToCustomersButton", "viewDetail", 1, {
        name:   "Back",
        uiId:   "backToCustomersButton",
        app: APP,
        mount:  "route:/customers/:id/content",
        order:  1,
        label:  "Back to customers",
        action: "goToCustomers"
    }),
    node("ui-button", "editCustomerButton", "viewDetail", 2, {
        name:   "Edit",
        uiId:   "editCustomerButton",
        app: APP,
        mount:  "route:/customers/:id/content",
        order:  2,
        label:  "Edit customer"
        // no action ref — wired to fnEditCustomer which opens dialog via dialogStore
    }),
    node("ui-button", "deleteCustomerButton", "viewDetail", 3, {
        name:         "Delete",
        uiId:         "deleteCustomerButton",
        app:       APP,
        mount:        "route:/customers/:id/content",
        order:        3,
        label:        "Delete customer",
        action:       "deleteCustomer",
        disabledPath: "draft.isDeleting",
        disabled:     { kind: "state", path: "draft.isDeleting", fallback: false }
    }),
    node("ui-text", "detailCustomerId", "viewDetail", 4, {
        name:   "Customer ID",
        uiId:   "detailCustomerId",
        app: APP,
        mount:  "route:/customers/:id/content",
        order:  4,
        // editor text field must be non-empty to pass validation;
        // value overrides it at runtime with the actual route param
        text:   ":id",
        value:  { kind: "routeParam", path: "id" }
    }),
    node("ui-badge", "customerStatusBadge", "viewDetail", 5, {
        name:        "Status badge",
        uiId:        "customerStatusBadge",
        app:      APP,
        mount:       "route:/customers/:id/content",
        order:       5,
        valuePath:   "customers.current.status",
        value:       { kind: "state", path: "customers.current.status" },
        // P92: displayType is now shape (rounded/pill/square), not count/dot/status.
        // variant replaces severity.
        displayType: "rounded",
        variant:     "info"
    }),

    // ── View – dialog ────────────────────────────────────────────────────────
    node("ui-container", "customerEditorContainer", "viewDialog", 0, {
        name:     "Editor container",
        uiId:     "customerEditorContainer",
        app:   APP,
        mount:    "dialog:customerEditor/content", // required
        layoutId: "grid"                           // required
    }),
    node("ui-input", "customerNameInput", "viewDialog", 1, {
        name:      "Name input",
        uiId:      "customerNameInput",
        app:    APP,
        mount:     "layout:grid/content", // required
        label:     "Name",               // required
        valuePath: "draft.customer.name", // required (editor field for state binding)
        value:     { kind: "state", path: "draft.customer.name" },
        storeId:   "draftStore",
        path:      "name",
        inputType: "text",               // required
        row: 1, col: 1, colSize: 12
    }),
    node("ui-input", "customerEmailInput", "viewDialog", 2, {
        name:      "Email input",
        uiId:      "customerEmailInput",
        app:    APP,
        mount:     "layout:grid/content",
        label:     "Email",
        valuePath: "draft.customer.email",
        value:     { kind: "state", path: "draft.customer.email" },
        storeId:   "draftStore",
        path:      "email",
        inputType: "email",
        row: 2, col: 1, colSize: 12
    }),
    node("ui-input", "customerStatusInput", "viewDialog", 3, {
        name:      "Status input",
        uiId:      "customerStatusInput",
        app:    APP,
        mount:     "layout:grid/content",
        label:     "Status",
        valuePath: "draft.customer.status",
        value:     { kind: "state", path: "draft.customer.status" },
        storeId:   "draftStore",
        path:      "status",
        inputType: "text",
        row: 3, col: 1, colSize: 12
    }),
    // P64: Cancel / Save live in the dialog FOOTER slot (native sl-dialog footer),
    // not inside the grid content container. Cancel no longer references a wired
    // close action — it is flow-wired (fnCancelEditor) to flip the dialogStore,
    // exactly like Save. The native X / ESC / overlay also close the dialog.
    node("ui-button", "cancelCustomerButton", "viewDialog", 4, {
        name:   "Cancel",
        uiId:   "cancelCustomerButton",
        app: APP,
        mount:  "dialog:customerEditor/footer",
        label:  "Cancel"
    }),
    node("ui-button", "saveCustomerButton", "viewDialog", 5, {
        name:         "Save",
        uiId:         "saveCustomerButton",
        app:       APP,
        mount:        "dialog:customerEditor/footer",
        label:        "Save",
        // no action ref — wired to fnSaveCustomer which closes dialog via dialogStore
        disabledPath: "draft.isSaving",
        disabled:     { kind: "state", path: "draft.isSaving", fallback: false }
    }),

    // ══════════════════════════════════════════════════════════════════════════
    // DOMAIN LOGIC — plain Node-RED function nodes.
    //
    // This is the whole point of the example: every create / read / update /
    // delete decision lives HERE, in stock function nodes wired into the flow.
    // None of it lives in any ui-* node or in nodes/webapp.js. Delete these
    // function nodes and the CRUD stops working — proving the behaviour is the
    // flow's, not the framework's.
    //
    // The customer list is the authoritative copy kept in flow context
    // (`flow.get("customers")`). Each mutation writes the new list back to flow
    // context AND emits a ui-store `set` operation. This single-owner CRM demo
    // uses the app's SHARED (broadcast) state throughout — store ops and navigate
    // commands carry no clientId — so every change persists across page
    // navigations (which start a fresh browser clientId) and reaches every
    // connected client over the live SSE transport. (Per-client targeting exists
    // for multi-user apps; see docs/nodes/concepts/events.md — it is intentionally
    // not used here so the demo's data survives reloads.)
    // ══════════════════════════════════════════════════════════════════════════

    // ui-table rowSelect → make the picked row the current customer (broadcast
    // data) and navigate THIS client to the detail route.
    fn("fnSelectCustomer", "logic", 0, "Select customer",
        [
            "// The runtime took NO action on the rowSelect — we decide here.",
            "const ui = msg.ui || {};",
            "const row = (ui.params && ui.params.row) || {};",
            "flow.set('editingId', row.id);",
            "const setCurrent = { ui: { store: { id: 'customersStore', op: 'set', path: 'current', value: row } } };",
            "const navigate = { ui: { action: { type: 'navigate', to: '/customers/' + row.id } } };",
            "return [setCurrent, navigate];"
        ].join("\n"),
        2,
        [["customersStore"], ["openCustomerDetail"]]
    ),

    // ui-button (New) → clear the draft (broadcast) and open the editor for THIS
    // client (per-client dialog state).
    fn("fnNewCustomer", "logic", 1, "New customer",
        [
            "flow.set('editingId', null);",
            "const blank = { name: '', email: '', status: 'trial' };",
            "const resetDraft = { ui: { store: { id: 'draftStore', op: 'replace', value: blank } } };",
            "const openDialog = { ui: { store: { id: 'dialogStore', op: 'set', path: 'open', value: true } } };",
            "return [resetDraft, openDialog];"
        ].join("\n"),
        2,
        [["draftStore"], ["dialogStore"]]
    ),

    // ui-button (Edit) → load the current customer into the draft (broadcast),
    // open the editor for THIS client.
    fn("fnEditCustomer", "logic", 2, "Edit customer",
        [
            "const list = flow.get('customers') || [];",
            "const editingId = flow.get('editingId');",
            "const current = list.find(c => c.id === editingId) || {};",
            "const draft = { name: current.name || '', email: current.email || '', status: current.status || 'trial' };",
            "const loadDraft = { ui: { store: { id: 'draftStore', op: 'replace', value: draft } } };",
            "const openDialog = { ui: { store: { id: 'dialogStore', op: 'set', path: 'open', value: true } } };",
            "return [loadDraft, openDialog];"
        ].join("\n"),
        2,
        [["draftStore"], ["dialogStore"]]
    ),

    // ui-button (Save) → CREATE or UPDATE the customer from the submitted form
    // values, write the new list back (broadcast), and close the editor dialog
    // for THIS client.
    fn("fnSaveCustomer", "logic2", 0, "Save customer (create/update)",
        [
            "// The Save button sits inside the editor form, so the click POST",
            "// carries the field values in msg.ui.params (name, email, status).",
            "const ui = msg.ui || {};",
            "const p = ui.params || {};",
            "const list = (flow.get('customers') || []).slice();",
            "const editingId = flow.get('editingId');",
            "const record = { name: p.name || '', email: p.email || '', status: p.status || 'trial' };",
            "let saved;",
            "if (editingId) {",
            "    saved = Object.assign({}, list.find(c => c.id === editingId), record, { id: editingId });",
            "    const idx = list.findIndex(c => c.id === editingId);",
            "    if (idx >= 0) { list[idx] = saved; } else { list.push(saved); }",
            "} else {",
            "    saved = Object.assign({ id: 'c-' + Date.now() }, record);",
            "    list.push(saved);",
            "}",
            "flow.set('customers', list);",
            "flow.set('editingId', null);",
            "const setList = { ui: { store: { id: 'customersStore', op: 'set', path: 'list', value: list } } };",
            "const setCurrent = { ui: { store: { id: 'customersStore', op: 'set', path: 'current', value: saved } } };",
            "const closeDialog = { ui: { store: { id: 'dialogStore', op: 'set', path: 'open', value: false } } };",
            "return [setList, setCurrent, closeDialog];"
        ].join("\n"),
        3,
        [["customersStore"], ["customersStore"], ["dialogStore"]]
    ),

    // ui-button (Cancel) → close the editor for THIS client, discard the draft.
    fn("fnCancelEditor", "logic2", 3, "Cancel editor",
        [
            "return { ui: { store: { id: 'dialogStore', op: 'set', path: 'open', value: false } } };"
        ].join("\n"),
        1,
        [["dialogStore"]]
    ),

    // ui-button (Delete) → DELETE the current customer, write the new list back
    // (broadcast), and navigate THIS client back to the list route.
    fn("fnDeleteCustomer", "logic2", 1, "Delete customer",
        [
            "const editingId = flow.get('editingId');",
            "const list = (flow.get('customers') || []).filter(c => c.id !== editingId);",
            "flow.set('customers', list);",
            "flow.set('editingId', null);",
            "const setList = { ui: { store: { id: 'customersStore', op: 'set', path: 'list', value: list } } };",
            "const clearCurrent = { ui: { store: { id: 'customersStore', op: 'set', path: 'current', value: null } } };",
            "const goBack = { ui: { action: { type: 'navigate', to: '/customers' } } };",
            "return [setList, clearCurrent, goBack];"
        ].join("\n"),
        3,
        [["customersStore"], ["customersStore"], ["deleteCustomer"]]
    ),

    // ui-button (Refresh) → re-push the authoritative list from flow context
    // (broadcast) to every connected client.
    fn("fnRefreshCustomers", "logic2", 2, "Refresh customers",
        [
            "const list = flow.get('customers') || [];",
            "return { ui: { store: { id: 'customersStore', op: 'set', path: 'list', value: list } } };"
        ].join("\n"),
        1,
        [["customersStore"]]
    ),

    // Seed flow context with the initial list when the flow starts, so the
    // function nodes have an authoritative copy that survives store re-renders.
    {
        type: "inject",
        id: "seedCustomers",
        z: Z,
        name: "Seed customers (startup)",
        props: [{ p: "payload" }],
        repeat: "",
        crontab: "",
        once: true,
        onceDelay: "0.1",
        topic: "",
        payload: "",
        payloadType: "date",
        ...pos("logic", 4),
        wires: [["fnSeedCustomers"]]
    },
    fn("fnSeedCustomers", "logic", 5, "Seed flow context",
        [
            "// Populate the working list in flow context from the seed data and",
            "// push it into the customers store so the table renders it. This is",
            "// DATA seeding, not domain logic — create/update/delete all live in",
            "// the other function nodes. Re-injecting resets the demo to a known",
            "// state (used by the E2E suite for test isolation).",
            "const seed = [",
            "    { id: 'c-100', name: 'Ada Lovelace', email: 'ada@example.com', status: 'active' },",
            "    { id: 'c-200', name: 'Grace Hopper', email: 'grace@example.com', status: 'inactive' },",
            "    { id: 'c-300', name: 'Radia Perlman', email: 'radia@example.com', status: 'trial' }",
            "];",
            "flow.set('customers', seed);",
            "flow.set('editingId', null);",
            "const setList = { ui: { store: { id: 'customersStore', op: 'set', path: 'list', value: seed } } };",
            "const setCurrent = { ui: { store: { id: 'customersStore', op: 'set', path: 'current', value: seed[0] } } };",
            "const closeDialog = { ui: { store: { id: 'dialogStore', op: 'set', path: 'open', value: false } } };",
            "return [setList, setCurrent, closeDialog];"
        ].join("\n"),
        3,
        [["customersStore"], ["customersStore"], ["dialogStore"]]
    )
];

// ── Wiring: UI node outputs → function nodes / ui-action nodes ───────────────
// The UI nodes emit events on their OUTPUT ports (P30); these wires carry those
// events into the function nodes (domain logic) or directly into ui-action nodes
// (pure navigation with no domain work needed). This is the only place the
// example "connects" behaviour — and it is plain Node-RED wiring.
//
// Navigation buttons wire DIRECTLY to the goToCustomers ui-action node — no
// intermediate function node is needed because there is no domain work to do:
// the action node just pushes a navigate command to the client over SSE.
const uiToLogicWires = {
    // Domain-logic buttons → function nodes
    customersTable:         "fnSelectCustomer",
    newCustomerButton:      "fnNewCustomer",
    editCustomerButton:     "fnEditCustomer",
    saveCustomerButton:     "fnSaveCustomer",
    cancelCustomerButton:   "fnCancelEditor",
    deleteCustomerButton:   "fnDeleteCustomer",
    refreshCustomersButton: "fnRefreshCustomers",
    // Pure-navigation buttons → ui-action node directly (P30: no domain work)
    navCustomersButton:       "goToCustomers",
    homeGoToCustomersButton:  "goToCustomers",
    backToCustomersButton:    "goToCustomers"
};

for (const [sourceId, targetId] of Object.entries(uiToLogicWires)) {
    const source = flowNodes.find((n) => n.id === sourceId);
    if (source) {
        source.wires = [[targetId]];
    }
}

// ── Assemble flow ─────────────────────────────────────────────────────────────

const flow = [
    { id: FLOW_TAB_ID, type: "tab", label: "Customers CRUD", disabled: false, info: "" },
    ...flowNodes
];

const json = JSON.stringify(flow, null, 4);

const examplePath = resolve(rootDir, "examples/customers-crud/flow.json");
writeFileSync(examplePath, json + "\n", "utf8");
console.log(`Wrote ${flow.length} nodes to ${examplePath}`);

// The dev workspace flows.json is the owner's personal environment and is
// off-limits to agents (AGENTS.md rule 5). The copy is therefore OPT-IN: only
// when WEBAPP_GEN_DEV=1 is set will the example be copied into .node-red-dev.
// This lets `pnpm gen:example` regenerate the example flow without ever
// clobbering the dev environment by default.
const devDir = resolve(rootDir, ".node-red-dev");
if (process.env.WEBAPP_GEN_DEV === "1") {
    if (existsSync(devDir)) {
        const devFlowsPath = resolve(devDir, "flows.json");
        writeFileSync(devFlowsPath, json + "\n", "utf8");
        console.log(`Copied to ${devFlowsPath}`);
    } else {
        console.log(`Skipped .node-red-dev/flows.json (directory does not exist)`);
    }
} else {
    console.log("Skipped .node-red-dev/flows.json (set WEBAPP_GEN_DEV=1 to copy)");
}

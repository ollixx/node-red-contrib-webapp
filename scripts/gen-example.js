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
    return { type, id, ...fields, z: Z, ...pos(rowName, col), wires: [[]] };
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
    node("ui-route", "routeHome", "structure", 1, {
        name:     "Home",
        uiId:     "routeHome",      // required: semantic ID
        parent:   APP,
        path:     "/",
        title:    "Home",
        layoutId: "vertical"
    }),
    node("ui-route", "customers", "structure", 2, {
        name:    "Customers",
        uiId:    "customers",
        parent:  APP,
        path:    "/customers",
        title:   "Customers",
        layoutId: "vertical"
    }),
    node("ui-route", "customerDetail", "structure", 3, {
        name:    "Customer detail",
        uiId:    "customerDetail",
        parent:  APP,
        path:    "/customers/:id",
        title:   "Customer detail",
        layoutId: "vertical"
    }),
    node("ui-dialog", "customerEditor", "structure", 4, {
        name:    "Edit customer",
        uiId:    "customerEditor",
        parent:  APP,
        title:   "Edit customer",
        layoutId: "vertical",
        modal:   true
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
        parent:       APP,
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
        parent:       APP,
        statePath:    "draft.customer", // required
        initialValue: JSON.stringify({ name: "", email: "", status: "draft" })
    }),
    // The editor dialog's open/closed state is plain UI state. A function node
    // flips it (per-client, so only the acting user sees the dialog) and the live
    // snapshot push opens/closes it. No dialog logic lives in the runtime.
    node("ui-store", "dialogStore", "state", 4, {
        name:         "Dialog store",
        uiId:         "dialogStore",
        parent:       APP,
        statePath:    "ui.dialogs.customerEditor",
        initialValue: JSON.stringify({ open: false })
    }),
    node("ui-query", "customersQuery", "state", 2, {
        name:          "Customers query",
        uiId:          "customersQuery", // required
        parent:        APP,
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
        parent:    APP,
        queryPath: "customers.current"   // required
    }),

    // ── Actions ──────────────────────────────────────────────────────────────
    node("ui-action", "openCustomerEditor", "actions", 0, {
        name:        "Open editor",
        uiId:        "openCustomerEditor", // required
        parent:      APP,
        actionType:  "show",
        targetMode:  "path",
        target:      "dialog:customerEditor",
        description: "Open the customer editor dialog."
    }),
    node("ui-action", "closeCustomerEditor", "actions", 1, {
        name:        "Close editor",
        uiId:        "closeCustomerEditor",
        parent:      APP,
        actionType:  "hide",
        targetMode:  "path",
        target:      "dialog:customerEditor",
        description: "Close the customer editor dialog."
    }),
    node("ui-action", "saveCustomer", "actions", 2, {
        name:        "Save customer",
        uiId:        "saveCustomer",
        parent:      APP,
        actionType:  "hide",
        targetMode:  "path",
        target:      "dialog:customerEditor",
        description: "Close the editor dialog after the wired flow has persisted the customer."
    }),
    node("ui-action", "refreshCustomers", "actions", 3, {
        name:        "Refresh customers",
        uiId:        "refreshCustomers",
        parent:      APP,
        actionType:  "trigger",
        targetMode:  "out-port",
        description: "Refresh the customer list query."
    }),
    node("ui-action", "openCustomerDetail", "actions", 4, {
        name:       "Open detail",
        uiId:       "openCustomerDetail",
        parent:     APP,
        actionType: "navigate",
        targetMode: "path",
        target:     "app",
        to:         "/customers/:id"
    }),
    node("ui-action", "goToCustomers", "actions", 5, {
        name:       "Go to customers",
        uiId:       "goToCustomers",
        parent:     APP,
        actionType: "navigate",
        targetMode: "path",
        target:     "app",
        to:         "/customers"
    }),
    node("ui-action", "deleteCustomer", "actions", 6, {
        name:       "Delete customer",
        uiId:       "deleteCustomer",
        parent:     APP,
        actionType: "navigate",
        targetMode: "path",
        target:     "app",
        to:         "/customers"
    }),
    node("ui-navigation", "navToCustomers", "actions", 7, {
        name:   "Nav to customers",
        uiId:   "navToCustomers",  // required
        parent: APP,
        to:     "/customers"       // required
    }),

    // ── View – / (home) ──────────────────────────────────────────────────────
    node("ui-text", "pageTitle", "viewHome", 0, {
        name:    "Page title",
        uiId:    "pageTitle",              // required
        parent:  APP,
        mount:   "routeHome.content",      // home route heading
        order:   -1,
        text:    "Customers CRM",          // required (editor field for literal text)
        value:   { kind: "literal", value: "Customers CRM" },
        variant: "headline"
    }),
    node("ui-text", "homeWelcomeHeading", "viewHome", 0, {
        name:    "Welcome heading",
        uiId:    "homeWelcomeHeading",
        parent:  APP,
        mount:   "routeHome.content",
        order:   0,
        text:    "Welcome to Customers CRM",
        value:   { kind: "literal", value: "Welcome to Customers CRM" },
        variant: "headline"
    }),
    node("ui-text", "homeWelcomeBody", "viewHome", 1, {
        name:    "Welcome body",
        uiId:    "homeWelcomeBody",
        parent:  APP,
        mount:   "routeHome.content",
        order:   1,
        text:    "Manage your customer relationships in one place.",
        value:   { kind: "literal", value: "Manage your customer relationships in one place." }
    }),
    node("ui-button", "homeGoToCustomersButton", "viewHome", 2, {
        name:   "Go to customers",
        uiId:   "homeGoToCustomersButton",
        parent: APP,
        mount:   "routeHome.content",
        order:  2,
        label:  "Go to customers",
        action: "goToCustomers"
    }),
    node("ui-alert", "homeTipAlert", "viewHome", 3, {
        name:     "Home tip",
        uiId:     "homeTipAlert",
        parent:   APP,
        mount:    "routeHome.content",
        order:    3,
        // Pass message as a binding object so mapConfig's getBinding resolves it correctly
        message:  { kind: "literal", value: "Use the Customers section to create, view and edit customer records." },
        severity: "info",
        title:    "Tip"
    }),

    // ── View – /customers ────────────────────────────────────────────────────
    node("ui-button", "newCustomerButton", "viewCustomers", 0, {
        name:   "New customer",
        uiId:   "newCustomerButton",        // required
        parent: APP,
        mount:  "route:/customers/content", // required
        order:  0,
        label:  "New customer",             // required
        action: "openCustomerEditor"        // required
    }),
    node("ui-button", "refreshCustomersButton", "viewCustomers", 1, {
        name:         "Refresh",
        uiId:         "refreshCustomersButton",
        parent:       APP,
        mount:        "route:/customers/content",
        order:        1,
        label:        "Refresh",
        action:       "refreshCustomers",
        disabledPath: "ui.queries.customersQuery.loading",
        disabled:     { kind: "state", path: "ui.queries.customersQuery.loading", fallback: false }
    }),
    node("ui-text", "editorStatus", "viewCustomers", 2, {
        name:   "Editor status",
        uiId:   "editorStatus",
        parent: APP,
        mount:  "route:/customers/content",
        order:  2,
        text:   "Editing customer",
        value:  { kind: "literal", value: "Editing customer" }
    }),
    node("ui-table", "customersTable", "viewCustomers", 3, {
        name:         "Customers table",
        uiId:         "customersTable",
        parent:       APP,
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
        parent:  APP,
        mount:   "route:/customers/:id/content",
        order:   0,
        text:    "Customer detail",
        value:   { kind: "literal", value: "Customer detail" },
        variant: "headline"
    }),
    node("ui-button", "backToCustomersButton", "viewDetail", 1, {
        name:   "Back",
        uiId:   "backToCustomersButton",
        parent: APP,
        mount:  "route:/customers/:id/content",
        order:  1,
        label:  "Back to customers",
        action: "goToCustomers"
    }),
    node("ui-button", "editCustomerButton", "viewDetail", 2, {
        name:   "Edit",
        uiId:   "editCustomerButton",
        parent: APP,
        mount:  "route:/customers/:id/content",
        order:  2,
        label:  "Edit customer",
        action: "openCustomerEditor"
    }),
    node("ui-button", "deleteCustomerButton", "viewDetail", 3, {
        name:         "Delete",
        uiId:         "deleteCustomerButton",
        parent:       APP,
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
        parent: APP,
        mount:  "route:/customers/:id/content",
        order:  4,
        // editor text field must be non-empty to pass validation;
        // value overrides it at runtime with the actual route param
        text:   ":id",
        value:  { kind: "routeParam", path: "id" }
    }),
    node("ui-badge", "customerStatusBadge", "viewDetail", 5, {
        name:      "Status badge",
        uiId:      "customerStatusBadge",
        parent:    APP,
        mount:     "route:/customers/:id/content",
        order:     5,
        valuePath: "customers.current.status",
        value:     { kind: "state", path: "customers.current.status" },
        variant:   "status",
        severity:  "info"
    }),

    // ── View – dialog ────────────────────────────────────────────────────────
    node("ui-container", "customerEditorContainer", "viewDialog", 0, {
        name:     "Editor container",
        uiId:     "customerEditorContainer",
        parent:   APP,
        mount:    "dialog:customerEditor/content", // required
        layoutId: "grid"                           // required
    }),
    node("ui-input", "customerNameInput", "viewDialog", 1, {
        name:      "Name input",
        uiId:      "customerNameInput",
        parent:    APP,
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
        parent:    APP,
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
        parent:    APP,
        mount:     "layout:grid/content",
        label:     "Status",
        valuePath: "draft.customer.status",
        value:     { kind: "state", path: "draft.customer.status" },
        storeId:   "draftStore",
        path:      "status",
        inputType: "text",
        row: 3, col: 1, colSize: 12
    }),
    node("ui-button", "cancelCustomerButton", "viewDialog", 4, {
        name:   "Cancel",
        uiId:   "cancelCustomerButton",
        parent: APP,
        mount:  "layout:grid/content",
        label:  "Cancel",
        action: "closeCustomerEditor",
        row: 4, col: 1, colSize: 6
    }),
    node("ui-button", "saveCustomerButton", "viewDialog", 5, {
        name:         "Save",
        uiId:         "saveCustomerButton",
        parent:       APP,
        mount:        "layout:grid/content",
        label:        "Save",
        action:       "saveCustomer",
        disabledPath: "draft.isSaving",
        disabled:     { kind: "state", path: "draft.isSaving", fallback: false },
        row: 4, col: 7, colSize: 6
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

// ── Wiring: UI node outputs → function nodes ──────────────────────────────────
// The UI nodes emit events on their OUTPUT ports (P30); these wires carry those
// events into the function nodes that hold the domain logic. This is the only
// place the example "connects" behaviour — and it is plain Node-RED wiring.
const uiToLogicWires = {
    customersTable:       "fnSelectCustomer",
    newCustomerButton:    "fnNewCustomer",
    editCustomerButton:   "fnEditCustomer",
    saveCustomerButton:   "fnSaveCustomer",
    cancelCustomerButton: "fnCancelEditor",
    deleteCustomerButton: "fnDeleteCustomer",
    refreshCustomersButton: "fnRefreshCustomers"
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

const devDir = resolve(rootDir, ".node-red-dev");
if (existsSync(devDir)) {
    const devFlowsPath = resolve(devDir, "flows.json");
    writeFileSync(devFlowsPath, json + "\n", "utf8");
    console.log(`Copied to ${devFlowsPath}`);
} else {
    console.log(`Skipped .node-red-dev/flows.json (directory does not exist)`);
}

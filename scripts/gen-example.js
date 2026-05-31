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
    viewCustomers: 4,
    viewDetail:  5,
    viewDialog:  6
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
        name:    "Home",
        uiId:    "routeHome",      // required: semantic ID
        parent:  APP,
        path:    "/",
        title:   "Home",
        layoutId: "app"
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
    node("ui-store", "draftStore", "state", 0, {
        name:         "Draft store",
        uiId:         "draftStore",     // required
        parent:       APP,
        statePath:    "draft.customer", // required
        initialValue: JSON.stringify({ name: "", email: "", status: "draft" })
    }),
    node("ui-query", "customersQuery", "state", 1, {
        name:          "Customers query",
        uiId:          "customersQuery", // required
        parent:        APP,
        queryPath:     "customers.list", // required
        refreshAction: "refreshCustomers"
    }),
    node("ui-query", "customerDetailQuery", "state", 2, {
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
        actionType:  "trigger",
        targetMode:  "out-port",
        description: "Open the customer editor dialog."
    }),
    node("ui-action", "closeCustomerEditor", "actions", 1, {
        name:        "Close editor",
        uiId:        "closeCustomerEditor",
        parent:      APP,
        actionType:  "trigger",
        targetMode:  "out-port",
        description: "Close the customer editor dialog."
    }),
    node("ui-action", "saveCustomer", "actions", 2, {
        name:        "Save customer",
        uiId:        "saveCustomer",
        parent:      APP,
        actionType:  "trigger",
        targetMode:  "out-port",
        description: "Persist the current customer draft."
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

    // ── View – App level ─────────────────────────────────────────────────────
    node("ui-text", "pageTitle", "viewApp", 0, {
        name:    "Page title",
        uiId:    "pageTitle",          // required
        parent:  APP,
        mount:   "customersApp.header", // required
        text:    "Customers",           // required (editor field for literal text)
        value:   { kind: "literal", value: "Customers" },
        variant: "headline"
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
        rowsPath:     "customers.list",          // required (editor field for query binding)
        rows:         { kind: "query", path: "customers.list" },
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
    })
];

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

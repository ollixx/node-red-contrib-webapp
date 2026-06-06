import type { AppModel, RuntimeIntegrationModel } from "./contracts";
import type { UiNodeDefinition } from "./node-definitions";

export const customersCrudAppModelFixture: AppModel = {
    id: "customersApp",
    title: "Customers CRM",
    layouts: [
        {
            id: "app",
            title: "App",
            slots: [{ name: "header" }, { name: "navbar" }, { name: "content" }, { name: "footer" }]
        },
        {
            id: "vertical",
            title: "Vertical",
            slots: [{ name: "content" }]
        },
        {
            id: "grid",
            title: "Grid",
            slots: [{ name: "content" }]
        }
    ],
    routes: [
        {
            id: "customersApp",
            path: "/",
            title: "Customers CRM",
            layoutId: "app"
        },
        {
            id: "customers",
            path: "/customers",
            title: "Customers",
            layoutId: "vertical"
        },
        {
            id: "customerDetail",
            path: "/customers/:id",
            title: "Customer detail",
            layoutId: "vertical"
        }
    ],
    dialogs: [
        {
            id: "customerEditor",
            title: "Edit customer",
            layoutId: "vertical",
            modal: true
        }
    ],
    components: [
        {
            id: "pageTitle",
            kind: "text",
            mount: "customersApp.header",
            bind: {
                text: {
                    kind: "literal",
                    value: "Customers"
                }
            },
            props: {
                variant: "headline"
            },
            events: []
        },
        {
            id: "newCustomerButton",
            kind: "button",
            mount: "route:/customers/content",
            order: 0,
            bind: {
                label: {
                    kind: "literal",
                    value: "New customer"
                }
            },
            props: {},
            events: [{ event: "click", action: "openCustomerEditor" }]
        },
        {
            id: "refreshCustomersButton",
            kind: "button",
            mount: "route:/customers/content",
            order: 1,
            bind: {
                label: {
                    kind: "literal",
                    value: "Refresh"
                },
                disabled: {
                    kind: "state",
                    path: "ui.queries.customersQuery.loading",
                    fallback: false
                }
            },
            props: {},
            events: [{ event: "click", action: "refreshCustomers" }]
        },
        {
            id: "editorStatus",
            kind: "text",
            mount: "route:/customers/content",
            order: 2,
            bind: {
                text: {
                    kind: "literal",
                    value: "Editing customer"
                }
            },
            props: {},
            events: []
        },
        {
            id: "customersTable",
            kind: "table",
            mount: "route:/customers/content",
            order: 3,
            bind: {
                rows: {
                    kind: "query",
                    path: "customers.list"
                }
            },
            props: {
                columns: ["name", "email", "status"]
            },
            events: [{ event: "select", action: "openCustomerDetail" }]
        },
        {
            id: "detailRouteTitle",
            kind: "text",
            mount: "route:/customers/:id/content",
            order: 0,
            bind: {
                text: {
                    kind: "literal",
                    value: "Customer detail"
                }
            },
            props: {
                variant: "headline"
            },
            events: []
        },
        {
            id: "backToCustomersButton",
            kind: "button",
            mount: "route:/customers/:id/content",
            order: 1,
            bind: {
                label: {
                    kind: "literal",
                    value: "Back to customers"
                }
            },
            props: {},
            events: [{ event: "click", action: "goToCustomers" }]
        },
        {
            id: "editCustomerButton",
            kind: "button",
            mount: "route:/customers/:id/content",
            order: 2,
            bind: {
                label: {
                    kind: "literal",
                    value: "Edit customer"
                }
            },
            props: {},
            events: [{ event: "click", action: "openCustomerEditor" }]
        },
        {
            id: "deleteCustomerButton",
            kind: "button",
            mount: "route:/customers/:id/content",
            order: 3,
            bind: {
                label: {
                    kind: "literal",
                    value: "Delete customer"
                },
                disabled: {
                    kind: "state",
                    path: "draft.isDeleting",
                    fallback: false
                }
            },
            props: {},
            events: [{ event: "click", action: "deleteCustomer" }]
        },
        {
            id: "detailCustomerId",
            kind: "text",
            mount: "route:/customers/:id/content",
            order: 4,
            bind: {
                text: {
                    kind: "routeParam",
                    path: "id"
                }
            },
            props: {},
            events: []
        },
        {
            id: "customerEditorContainer",
            kind: "container",
            mount: "dialog:customerEditor/content",
            bind: {},
            props: {
                layoutId: "grid"
            },
            events: []
        },
        {
            id: "customerNameInput",
            kind: "input",
            mount: "layout:grid/content",
            bind: {
                value: {
                    kind: "state",
                    path: "draft.customer.name"
                }
            },
            props: {
                label: "Name",
                storeId: "draftStore",
                path: "name",
                row: 1,
                col: 1,
                colSize: 12
            },
            events: [{ event: "change", action: "saveCustomer" }]
        },
        {
            id: "customerEmailInput",
            kind: "input",
            mount: "layout:grid/content",
            bind: {
                value: {
                    kind: "state",
                    path: "draft.customer.email"
                }
            },
            props: {
                label: "Email",
                storeId: "draftStore",
                path: "email",
                inputType: "email",
                row: 2,
                col: 1,
                colSize: 12
            },
            events: [{ event: "change", action: "saveCustomer" }]
        },
        {
            id: "customerStatusInput",
            kind: "input",
            mount: "layout:grid/content",
            bind: {
                value: {
                    kind: "state",
                    path: "draft.customer.status"
                }
            },
            props: {
                label: "Status",
                storeId: "draftStore",
                path: "status",
                row: 3,
                col: 1,
                colSize: 12
            },
            events: [{ event: "change", action: "saveCustomer" }]
        },
        {
            id: "cancelCustomerButton",
            kind: "button",
            mount: "layout:grid/content",
            bind: {
                label: {
                    kind: "literal",
                    value: "Cancel"
                }
            },
            props: {
                row: 4,
                col: 1,
                colSize: 6
            },
            events: [{ event: "click", action: "closeCustomerEditor" }]
        },
        {
            id: "saveCustomerButton",
            kind: "button",
            mount: "layout:grid/content",
            bind: {
                label: {
                    kind: "literal",
                    value: "Save"
                },
                disabled: {
                    kind: "state",
                    path: "draft.isSaving",
                    fallback: false
                }
            },
            props: {
                row: 4,
                col: 7,
                colSize: 6
            },
            events: [{ event: "click", action: "saveCustomer" }]
        }
    ]
};

export const operationsConsoleAppModelFixture: AppModel = {
    id: "operationsConsole",
    title: "Operations Console",
    layouts: [
        {
            id: "consoleShell",
            title: "Console shell",
            slots: [{ name: "header" }, { name: "sidebar" }, { name: "content" }]
        },
        {
            id: "alertsContentLayout",
            title: "Alerts content",
            slots: [{ name: "details" }]
        }
    ],
    routes: [
        {
            id: "alerts",
            path: "/alerts",
            title: "Alerts",
            layoutId: "consoleShell"
        }
    ],
    dialogs: [],
    components: [
        {
            id: "alertsHeader",
            kind: "text",
            mount: "alerts.header",
            bind: {
                text: {
                    kind: "literal",
                    value: "Alerts"
                }
            },
            props: {
                variant: "headline"
            },
            events: []
        },
        {
            id: "navCard",
            kind: "card",
            mount: "route:/alerts/sidebar",
            bind: {},
            props: {
                title: "Navigation"
            },
            events: []
        },
        {
            id: "alertsContentContainer",
            kind: "container",
            mount: "route:/alerts/content",
            bind: {},
            props: {
                layoutId: "alertsContentLayout"
            },
            events: []
        },
        {
            id: "alertTable",
            kind: "table",
            mount: "layout:alertsContentLayout/details",
            bind: {
                rows: {
                    kind: "query",
                    path: "alerts.list"
                }
            },
            props: {
                columns: ["severity", "summary", "owner"]
            },
            events: []
        }
    ]
};

export const customersCrudRuntimeIntegrationFixture: RuntimeIntegrationModel = {
    stores: [
        {
            id: "draftStore",
            statePath: "draft.customer",
            initialValue: {
                name: "",
                email: "",
                status: "draft"
            }
        }
    ],
    queries: [
        {
            id: "customersQuery",
            queryPath: "customers.list",
            source: "customers.list",
            refreshAction: "refreshCustomers"
        },
        {
            id: "customerDetailQuery",
            queryPath: "customers.current",
            source: "customers.current"
        }
    ],
    actions: [
        {
            id: "openCustomerEditor",
            actionType: "trigger",
            targetMode: "out-port",
            description: "Open the shared customer editor dialog."
        },
        {
            id: "closeCustomerEditor",
            actionType: "trigger",
            targetMode: "out-port",
            description: "Close the shared customer editor dialog."
        },
        {
            id: "saveCustomer",
            actionType: "trigger",
            targetMode: "out-port",
            description: "Persist the current customer draft."
        },
        {
            id: "refreshCustomers",
            actionType: "trigger",
            targetMode: "out-port",
            description: "Refresh the customer list query."
        },
        {
            id: "openCustomerDetail",
            actionType: "navigate",
            targetMode: "path",
            target: "app",
            to: "/customers/:id"
        },
        {
            id: "goToCustomers",
            actionType: "navigate",
            targetMode: "path",
            target: "app",
            to: "/customers"
        },
        {
            id: "deleteCustomer",
            actionType: "navigate",
            targetMode: "path",
            target: "app",
            to: "/customers"
        }
    ],
    navigations: [
        {
            id: "openCustomerDetail",
            to: "/customers/:id"
        },
        {
            id: "goToCustomers",
            to: "/customers"
        },
        {
            id: "deleteCustomer",
            to: "/customers"
        }
    ]
};

export const customersCrudNodeSetFixture: UiNodeDefinition[] = [
    {
        type: "ui-app",
        id: "customersApp",
        title: "Customers CRM",
        layout: "app"
    },
    {
        type: "ui-route",
        id: "customers",
        parent: "customersApp",
        path: "/customers",
        title: "Customers",
        layout: "vertical"
    },
    {
        type: "ui-route",
        id: "customerDetail",
        parent: "customersApp",
        path: "/customers/:id",
        title: "Customer detail",
        layout: "vertical"
    },
    {
        type: "ui-dialog",
        id: "customerEditor",
        parent: "customersApp",
        title: "Edit customer",
        layout: "vertical",
        modal: true
    },
    {
        type: "ui-text",
        id: "pageTitle",
        mount: "customersApp.content", order: -1,
        value: {
            kind: "literal",
            value: "Customers"
        },
        variant: "headline"
    },
    // ── Home route content ────────────────────────────────────────────────────
    {
        type: "ui-text",
        id: "homeWelcomeHeading",
        mount: "customersApp.content",
        order: 0,
        value: {
            kind: "literal",
            value: "Welcome to Customers CRM"
        },
        variant: "headline"
    },
    {
        type: "ui-text",
        id: "homeWelcomeBody",
        mount: "customersApp.content",
        order: 1,
        value: {
            kind: "literal",
            value: "Manage your customer relationships in one place."
        }
    },
    {
        type: "ui-button",
        id: "homeGoToCustomersButton",
        mount: "customersApp.content",
        order: 2,
        label: "Go to customers",
        action: "goToCustomers"
    },
    {
        type: "ui-alert",
        id: "homeTipAlert",
        mount: "customersApp.content",
        order: 3,
        message: {
            kind: "literal",
            value: "Use the Customers section to create, view and edit customer records."
        },
        severity: "info",
        title: "Tip"
    },
    {
        type: "ui-button",
        id: "newCustomerButton",
        parent: "route:/customers/content",
        order: 0,
        label: "New customer",
        action: "openCustomerEditor"
    },
    {
        type: "ui-button",
        id: "refreshCustomersButton",
        parent: "route:/customers/content",
        order: 1,
        label: "Refresh",
        action: "refreshCustomers",
        disabled: {
            kind: "state",
            path: "ui.queries.customersQuery.loading",
            fallback: false
        }
    },
    {
        type: "ui-text",
        id: "editorStatus",
        mount: "route:/customers/content",
        order: 2,
        value: {
            kind: "literal",
            value: "Editing customer"
        }
    },
    {
        type: "ui-table",
        id: "customersTable",
        mount: "route:/customers/content",
        order: 3,
        columns: ["name", "email", "status"],
        rows: {
            kind: "query",
            path: "customers.list"
        },
        selectAction: "openCustomerDetail"
    },
    {
        type: "ui-text",
        id: "detailRouteTitle",
        mount: "route:/customers/:id/content",
        order: 0,
        value: {
            kind: "literal",
            value: "Customer detail"
        },
        variant: "headline"
    },
    {
        type: "ui-button",
        id: "backToCustomersButton",
        mount: "route:/customers/:id/content",
        order: 1,
        label: "Back to customers",
        action: "goToCustomers"
    },
    {
        type: "ui-button",
        id: "editCustomerButton",
        mount: "route:/customers/:id/content",
        order: 2,
        label: "Edit customer",
        action: "openCustomerEditor"
    },
    {
        type: "ui-button",
        id: "deleteCustomerButton",
        mount: "route:/customers/:id/content",
        order: 3,
        label: "Delete customer",
        action: "deleteCustomer",
        disabled: {
            kind: "state",
            path: "draft.isDeleting",
            fallback: false
        }
    },
    {
        type: "ui-text",
        id: "detailCustomerId",
        mount: "route:/customers/:id/content",
        order: 4,
        value: {
            kind: "routeParam",
            path: "id"
        }
    },
    {
        type: "ui-badge",
        id: "customerStatusBadge",
        mount: "route:/customers/:id/content",
        order: 5,
        value: {
            kind: "query",
            path: "customers.current.status"
        },
        variant: "status",
        severity: "info"
    },
    {
        type: "ui-container",
        id: "customerEditorContainer",
        mount: "dialog:customerEditor/content",
        layout: "grid"
    },
    {
        type: "ui-input",
        id: "customerNameInput",
        mount: "layout:grid/content",
        label: "Name",
        value: {
            kind: "state",
            path: "draft.customer.name"
        },
        storeId: "draftStore",
        path: "name",
        row: 1,
        col: 1,
        colSize: 12,
        inputType: "text"
    },
    {
        type: "ui-input",
        id: "customerEmailInput",
        mount: "layout:grid/content",
        label: "Email",
        value: {
            kind: "state",
            path: "draft.customer.email"
        },
        storeId: "draftStore",
        path: "email",
        row: 2,
        col: 1,
        colSize: 12,
        inputType: "email"
    },
    {
        type: "ui-input",
        id: "customerStatusInput",
        mount: "layout:grid/content",
        label: "Status",
        value: {
            kind: "state",
            path: "draft.customer.status"
        },
        storeId: "draftStore",
        path: "status",
        row: 3,
        col: 1,
        colSize: 12,
        inputType: "text"
    },
    {
        type: "ui-button",
        id: "cancelCustomerButton",
        mount: "layout:grid/content",
        label: "Cancel",
        action: "closeCustomerEditor",
        row: 4,
        col: 1,
        colSize: 6
    },
    {
        type: "ui-button",
        id: "saveCustomerButton",
        mount: "layout:grid/content",
        label: "Save",
        action: "saveCustomer",
        row: 4,
        col: 7,
        colSize: 6,
        disabled: {
            kind: "state",
            path: "draft.isSaving",
            fallback: false
        }
    },
    {
        type: "ui-store",
        id: "draftStore",
        statePath: "draft.customer",
        initialValue: {
            name: "",
            email: "",
            status: "draft"
        }
    },
    {
        type: "ui-query",
        id: "customersQuery",
        queryPath: "customers.list",
        refreshAction: "refreshCustomers"
    },
    {
        type: "ui-query",
        id: "customerDetailQuery",
        queryPath: "customers.current"
    },
    {
        type: "ui-action",
        id: "openCustomerEditor",
        actionType: "show",
        targetMode: "path",
        target: "dialog:customerEditor",
        description: "Open the shared customer editor dialog."
    },
    {
        type: "ui-action",
        id: "closeCustomerEditor",
        actionType: "hide",
        targetMode: "path",
        target: "dialog:customerEditor",
        description: "Close the shared customer editor dialog."
    },
    {
        type: "ui-action",
        id: "saveCustomer",
        actionType: "hide",
        targetMode: "path",
        target: "dialog:customerEditor",
        description: "Close the editor dialog after the wired flow has persisted the customer."
    },
    {
        type: "ui-action",
        id: "refreshCustomers",
        actionType: "trigger",
        targetMode: "out-port",
        description: "Refresh the customer list query."
    },
    {
        type: "ui-action",
        id: "openCustomerDetail",
        actionType: "navigate",
        targetMode: "path",
        target: "app",
        to: "/customers/:id"
    },
    {
        type: "ui-action",
        id: "goToCustomers",
        actionType: "navigate",
        targetMode: "path",
        target: "app",
        to: "/customers"
    },
    {
        type: "ui-action",
        id: "deleteCustomer",
        actionType: "navigate",
        targetMode: "path",
        target: "app",
        to: "/customers"
    },
    {
        type: "ui-navigation",
        id: "navToCustomers",
        parent: "customersApp",
        to: "/customers"
    }
];

/** Flow tab id used in both the in-memory fixture and the generated flow.json. */
const EXAMPLE_FLOW_TAB_ID = "flow1";

export const customersCrudExampleFlowFixture: unknown[] = customersCrudNodeSetFixture.map((node, index) => ({
    ...node,
    z: EXAMPLE_FLOW_TAB_ID,
    x: 160 + (index % 6) * 220,
    y: 40 + Math.floor(index / 6) * 60,
    wires: [[]]
}));

export const fixtureAppModels: AppModel[] = [customersCrudAppModelFixture, operationsConsoleAppModelFixture];

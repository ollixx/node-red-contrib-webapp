import type { AppModel, RuntimeIntegrationModel } from "./contracts";
import type { UiNodeDefinition } from "./node-definitions";

export const customersCrudAppModelFixture: AppModel = {
    id: "customersApp",
    title: "Customers CRM",
    layouts: [
        {
            id: "customerShell",
            title: "Customer shell",
            regions: [
                { name: "header" },
                {
                    name: "content",
                    regions: [
                        { name: "toolbar" },
                        { name: "body" }
                    ]
                },
                { name: "footer" }
            ]
        },
        {
            id: "dialogShell",
            title: "Dialog shell",
            regions: [
                { name: "header" },
                {
                    name: "content",
                    regions: [
                        {
                            name: "form",
                            regions: [
                                { name: "fields" },
                                { name: "actions" }
                            ]
                        }
                    ]
                }
            ]
        }
    ],
    routes: [
        {
            id: "customers",
            path: "/customers",
            title: "Customers",
            layoutId: "customerShell"
        },
        {
            id: "customerDetail",
            path: "/customers/:id",
            title: "Customer detail",
            layoutId: "customerShell"
        }
    ],
    dialogs: [
        {
            id: "customerEditor",
            title: "Edit customer",
            layoutId: "dialogShell",
            modal: true
        }
    ],
    components: [
        {
            id: "pageTitle",
            kind: "text",
            mount: "customers.header",
            bind: {
                value: {
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
            mount: "route:/customers/content/toolbar",
            order: 0,
            props: {
                label: "New customer"
            },
            events: [
                {
                    event: "click",
                    action: "openCustomerEditor"
                }
            ],
            bind: {}
        },
        {
            id: "refreshCustomersButton",
            kind: "button",
            mount: "route:/customers/content/toolbar",
            order: 1,
            props: {
                label: "Refresh"
            },
            bind: {
                disabled: {
                    kind: "state",
                    path: "ui.queries.customersQuery.loading",
                    fallback: false
                }
            },
            events: [
                {
                    event: "click",
                    action: "refreshCustomers"
                }
            ]
        },
        {
            id: "editorStatus",
            kind: "text",
            mount: "route:/customers/content/toolbar",
            order: 2,
            bind: {
                value: {
                    kind: "literal",
                    value: "Editing customer"
                }
            },
            visibleIf: {
                kind: "state",
                path: "ui.dialogs.customerEditor.open",
                fallback: false
            },
            props: {},
            events: []
        },
        {
            id: "customersTable",
            kind: "table",
            mount: "route:/customers/content/body",
            bind: {
                rows: {
                    kind: "query",
                    path: "customers.list"
                }
            },
            props: {
                columns: ["name", "email", "status"]
            },
            events: [
                {
                    event: "select",
                    action: "openCustomerDetail"
                }
            ]
        },
        {
            id: "detailSummary",
            kind: "card",
            mount: "route:/customers/:id/content/body",
            bind: {
                customer: {
                    kind: "query",
                    path: "customers.current"
                }
            },
            props: {
                title: "Customer summary"
            },
            events: []
        },
        {
            id: "backToCustomersButton",
            kind: "button",
            mount: "route:/customers/:id/content/toolbar",
            order: 0,
            props: {
                label: "Back to customers"
            },
            bind: {},
            events: [
                {
                    event: "click",
                    action: "goToCustomers"
                }
            ]
        },
        {
            id: "editCustomerButton",
            kind: "button",
            mount: "route:/customers/:id/content/toolbar",
            order: 1,
            props: {
                label: "Edit customer"
            },
            bind: {},
            events: [
                {
                    event: "click",
                    action: "openCustomerEditor"
                }
            ]
        },
        {
            id: "deleteCustomerButton",
            kind: "button",
            mount: "route:/customers/:id/content/toolbar",
            order: 2,
            props: {
                label: "Delete customer"
            },
            bind: {
                disabled: {
                    kind: "state",
                    path: "draft.isDeleting",
                    fallback: false
                }
            },
            events: [
                {
                    event: "click",
                    action: "deleteCustomer"
                }
            ]
        },
        {
            id: "customerForm",
            kind: "form",
            mount: "dialog:customerEditor/content/form/fields",
            order: 0,
            bind: {
                model: {
                    kind: "state",
                    path: "draft.customer"
                }
            },
            props: {
                fields: ["name", "email", "status"]
            },
            events: [
                {
                    event: "submit",
                    action: "saveCustomer"
                }
            ]
        },
        {
            id: "cancelCustomerButton",
            kind: "button",
            mount: "dialog:customerEditor/content/form/actions",
            order: 0,
            props: {
                label: "Cancel"
            },
            bind: {},
            events: [
                {
                    event: "click",
                    action: "closeCustomerEditor"
                }
            ]
        },
        {
            id: "saveCustomerButton",
            kind: "button",
            mount: "dialog:customerEditor/content/form/actions",
            order: 1,
            props: {
                label: "Save"
            },
            bind: {
                disabled: {
                    kind: "state",
                    path: "draft.isSaving",
                    fallback: false
                }
            },
            events: [
                {
                    event: "click",
                    action: "saveCustomer"
                }
            ]
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
            regions: [
                { name: "header" },
                { name: "sidebar" },
                {
                    name: "content",
                    regions: [
                        { name: "toolbar" },
                        {
                            name: "body",
                            regions: [
                                { name: "summary" },
                                { name: "details" }
                            ]
                        }
                    ]
                }
            ]
        }
    ],
    routes: [
        {
            id: "overview",
            path: "/overview",
            title: "Overview",
            layoutId: "consoleShell"
        },
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
            id: "overviewHeadline",
            kind: "text",
            mount: "overview.header",
            props: {
                variant: "headline"
            },
            bind: {
                value: {
                    kind: "literal",
                    value: "System health"
                }
            },
            events: []
        },
        {
            id: "alertTable",
            kind: "table",
            mount: "route:/alerts/content/body/details",
            bind: {
                rows: {
                    kind: "query",
                    path: "alerts.items"
                }
            },
            props: {
                columns: ["severity", "service", "message"]
            },
            events: [
                {
                    event: "select",
                    action: "focusAlert"
                }
            ]
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
            description: "Open the customer editor dialog."
        },
        {
            id: "closeCustomerEditor",
            description: "Close the customer editor dialog."
        },
        {
            id: "saveCustomer",
            description: "Submit the customer form."
        },
        {
            id: "refreshCustomers",
            description: "Refresh the customer list query."
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
        title: "Customers CRM"
    },
    {
        type: "ui-layout",
        appId: "customersApp",
        id: "customerShell",
        title: "Customer shell"
    },
    {
        type: "ui-region",
        appId: "customersApp",
        id: "customerHeader",
        layoutId: "customerShell",
        name: "header",
        order: 0
    },
    {
        type: "ui-region",
        appId: "customersApp",
        id: "customerContent",
        layoutId: "customerShell",
        name: "content",
        order: 1
    },
    {
        type: "ui-region",
        appId: "customersApp",
        id: "customerToolbar",
        layoutId: "customerShell",
        name: "toolbar",
        parentRegionId: "customerContent",
        order: 0
    },
    {
        type: "ui-region",
        appId: "customersApp",
        id: "customerBody",
        layoutId: "customerShell",
        name: "body",
        parentRegionId: "customerContent",
        order: 1
    },
    {
        type: "ui-region",
        appId: "customersApp",
        id: "customerFooter",
        layoutId: "customerShell",
        name: "footer",
        order: 2
    },
    {
        type: "ui-layout",
        appId: "customersApp",
        id: "dialogShell",
        title: "Dialog shell"
    },
    {
        type: "ui-region",
        appId: "customersApp",
        id: "dialogHeader",
        layoutId: "dialogShell",
        name: "header",
        order: 0
    },
    {
        type: "ui-region",
        appId: "customersApp",
        id: "dialogContent",
        layoutId: "dialogShell",
        name: "content",
        order: 1
    },
    {
        type: "ui-region",
        appId: "customersApp",
        id: "dialogForm",
        layoutId: "dialogShell",
        name: "form",
        parentRegionId: "dialogContent",
        order: 0
    },
    {
        type: "ui-region",
        appId: "customersApp",
        id: "dialogFields",
        layoutId: "dialogShell",
        name: "fields",
        parentRegionId: "dialogForm",
        order: 0
    },
    {
        type: "ui-region",
        appId: "customersApp",
        id: "dialogActions",
        layoutId: "dialogShell",
        name: "actions",
        parentRegionId: "dialogForm",
        order: 1
    },
    {
        type: "ui-route",
        appId: "customersApp",
        id: "customers",
        path: "/customers",
        title: "Customers",
        layoutId: "customerShell"
    },
    {
        type: "ui-route",
        appId: "customersApp",
        id: "customerDetail",
        path: "/customers/:id",
        title: "Customer detail",
        layoutId: "customerShell"
    },
    {
        type: "ui-dialog",
        appId: "customersApp",
        id: "customerEditor",
        title: "Edit customer",
        layoutId: "dialogShell",
        modal: true
    },
    {
        type: "ui-text",
        appId: "customersApp",
        id: "pageTitle",
        mount: "customers.header",
        value: {
            kind: "literal",
            value: "Customers"
        },
        variant: "headline"
    },
    {
        type: "ui-button",
        appId: "customersApp",
        id: "newCustomerButton",
        mount: "route:/customers/content/toolbar",
        order: 0,
        label: "New customer",
        action: "openCustomerEditor"
    },
    {
        type: "ui-button",
        appId: "customersApp",
        id: "refreshCustomersButton",
        mount: "route:/customers/content/toolbar",
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
        type: "ui-table",
        appId: "customersApp",
        id: "customersTable",
        mount: "route:/customers/content/body",
        columns: ["name", "email", "status"],
        rows: {
            kind: "query",
            path: "customers.list"
        },
        selectAction: "openCustomerDetail"
    },
    {
        type: "ui-text",
        appId: "customersApp",
        id: "editorStatus",
        mount: "route:/customers/content/toolbar",
        order: 2,
        value: {
            kind: "literal",
            value: "Editing customer"
        }
    },
    {
        type: "ui-button",
        appId: "customersApp",
        id: "backToCustomersButton",
        mount: "route:/customers/:id/content/toolbar",
        order: 0,
        label: "Back to customers",
        action: "goToCustomers"
    },
    {
        type: "ui-button",
        appId: "customersApp",
        id: "editCustomerButton",
        mount: "route:/customers/:id/content/toolbar",
        order: 1,
        label: "Edit customer",
        action: "openCustomerEditor"
    },
    {
        type: "ui-button",
        appId: "customersApp",
        id: "deleteCustomerButton",
        mount: "route:/customers/:id/content/toolbar",
        order: 2,
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
        appId: "customersApp",
        id: "detailRouteTitle",
        mount: "customerDetail.header",
        value: {
            kind: "literal",
            value: "Customer detail"
        },
        variant: "headline"
    },
    {
        type: "ui-text",
        appId: "customersApp",
        id: "detailCustomerId",
        mount: "route:/customers/:id/content/body",
        order: 0,
        value: {
            kind: "routeParam",
            path: "id"
        }
    },
    {
        type: "ui-form",
        appId: "customersApp",
        id: "customerForm",
        mount: "dialog:customerEditor/content/form/fields",
        order: 0,
        fields: ["name", "email", "status"],
        model: {
            kind: "state",
            path: "draft.customer"
        },
        submitAction: "saveCustomer"
    },
    {
        type: "ui-button",
        appId: "customersApp",
        id: "cancelCustomerButton",
        mount: "dialog:customerEditor/content/form/actions",
        order: 0,
        label: "Cancel",
        action: "closeCustomerEditor"
    },
    {
        type: "ui-button",
        appId: "customersApp",
        id: "saveCustomerButton",
        mount: "dialog:customerEditor/content/form/actions",
        order: 1,
        label: "Save",
        action: "saveCustomer",
        disabled: {
            kind: "state",
            path: "draft.isSaving",
            fallback: false
        }
    },
    {
        type: "ui-store",
        appId: "customersApp",
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
        appId: "customersApp",
        id: "customersQuery",
        queryPath: "customers.list",
        source: "customers.list",
        refreshAction: "refreshCustomers"
    },
    {
        type: "ui-query",
        appId: "customersApp",
        id: "customerDetailQuery",
        queryPath: "customers.current",
        source: "customers.current"
    },
    {
        type: "ui-action",
        appId: "customersApp",
        id: "openCustomerEditor",
        description: "Open the shared customer editor dialog."
    },
    {
        type: "ui-action",
        appId: "customersApp",
        id: "closeCustomerEditor",
        description: "Close the shared customer editor dialog."
    },
    {
        type: "ui-action",
        appId: "customersApp",
        id: "saveCustomer",
        description: "Persist the current customer draft."
    },
    {
        type: "ui-action",
        appId: "customersApp",
        id: "refreshCustomers",
        description: "Refresh the customer list query."
    },
    {
        type: "ui-navigation",
        appId: "customersApp",
        id: "openCustomerDetail",
        to: "/customers/:id"
    },
    {
        type: "ui-navigation",
        appId: "customersApp",
        id: "goToCustomers",
        to: "/customers"
    },
    {
        type: "ui-navigation",
        appId: "customersApp",
        id: "deleteCustomer",
        to: "/customers"
    }
];

export const customersCrudExampleFlowFixture: unknown[] = [
    {
        id: "customersApp",
        type: "ui-app",
        name: "Customers CRM",
        title: "Customers CRM",
        x: 160,
        y: 60,
        wires: [[]]
    },
    {
        id: "customerShell",
        type: "ui-layout",
        appId: "customersApp",
        title: "Customer shell",
        x: 360,
        y: 40,
        wires: [[]]
    },
    {
        id: "customerHeader",
        type: "ui-region",
        appId: "customersApp",
        layoutId: "customerShell",
        name: "header",
        order: 0,
        x: 560,
        y: 20,
        wires: [[]]
    },
    {
        id: "customerContent",
        type: "ui-region",
        appId: "customersApp",
        layoutId: "customerShell",
        name: "content",
        order: 1,
        x: 560,
        y: 60,
        wires: [[]]
    },
    {
        id: "customerToolbar",
        type: "ui-region",
        appId: "customersApp",
        layoutId: "customerShell",
        name: "toolbar",
        parentRegionId: "customerContent",
        order: 0,
        x: 760,
        y: 40,
        wires: [[]]
    },
    {
        id: "customerBody",
        type: "ui-region",
        appId: "customersApp",
        layoutId: "customerShell",
        name: "body",
        parentRegionId: "customerContent",
        order: 1,
        x: 760,
        y: 80,
        wires: [[]]
    },
    {
        id: "customerFooter",
        type: "ui-region",
        appId: "customersApp",
        layoutId: "customerShell",
        name: "footer",
        order: 2,
        x: 560,
        y: 100,
        wires: [[]]
    },
    {
        id: "dialogShell",
        type: "ui-layout",
        appId: "customersApp",
        title: "Dialog shell",
        x: 360,
        y: 160,
        wires: [[]]
    },
    {
        id: "dialogHeader",
        type: "ui-region",
        appId: "customersApp",
        layoutId: "dialogShell",
        name: "header",
        order: 0,
        x: 560,
        y: 140,
        wires: [[]]
    },
    {
        id: "dialogContent",
        type: "ui-region",
        appId: "customersApp",
        layoutId: "dialogShell",
        name: "content",
        order: 1,
        x: 560,
        y: 180,
        wires: [[]]
    },
    {
        id: "dialogForm",
        type: "ui-region",
        appId: "customersApp",
        layoutId: "dialogShell",
        name: "form",
        parentRegionId: "dialogContent",
        order: 0,
        x: 760,
        y: 160,
        wires: [[]]
    },
    {
        id: "dialogFields",
        type: "ui-region",
        appId: "customersApp",
        layoutId: "dialogShell",
        name: "fields",
        parentRegionId: "dialogForm",
        order: 0,
        x: 960,
        y: 140,
        wires: [[]]
    },
    {
        id: "dialogActions",
        type: "ui-region",
        appId: "customersApp",
        layoutId: "dialogShell",
        name: "actions",
        parentRegionId: "dialogForm",
        order: 1,
        x: 960,
        y: 180,
        wires: [[]]
    },
    {
        id: "customers",
        type: "ui-route",
        appId: "customersApp",
        path: "/customers",
        title: "Customers",
        layoutId: "customerShell",
        x: 360,
        y: 260,
        wires: [[]]
    },
    {
        id: "customerDetail",
        type: "ui-route",
        appId: "customersApp",
        path: "/customers/:id",
        title: "Customer detail",
        layoutId: "customerShell",
        x: 360,
        y: 300,
        wires: [[]]
    },
    {
        id: "customerEditor",
        type: "ui-dialog",
        appId: "customersApp",
        title: "Edit customer",
        layoutId: "dialogShell",
        modal: true,
        x: 360,
        y: 340,
        wires: [[]]
    },
    {
        id: "pageTitle",
        type: "ui-text",
        appId: "customersApp",
        mount: "customers.header",
        value: {
            kind: "literal",
            value: "Customers"
        },
        variant: "headline",
        x: 1160,
        y: 20,
        wires: [[]]
    },
    {
        id: "newCustomerButton",
        type: "ui-button",
        appId: "customersApp",
        mount: "route:/customers/content/toolbar",
        order: 0,
        label: "New customer",
        action: "openCustomerEditor",
        x: 1160,
        y: 60,
        wires: [["openCustomerEditor"]]
    },
    {
        id: "refreshCustomersButton",
        type: "ui-button",
        appId: "customersApp",
        mount: "route:/customers/content/toolbar",
        order: 1,
        label: "Refresh",
        action: "refreshCustomers",
        disabled: {
            kind: "state",
            path: "ui.queries.customersQuery.loading",
            fallback: false
        },
        x: 1160,
        y: 100,
        wires: [["refreshCustomers"]]
    },
    {
        id: "customersTable",
        type: "ui-table",
        appId: "customersApp",
        mount: "route:/customers/content/body",
        columns: ["name", "email", "status"],
        rows: {
            kind: "query",
            path: "customers.list"
        },
        selectAction: "openCustomerDetail",
        x: 1160,
        y: 140,
        wires: [["openCustomerDetail"]]
    },
    {
        id: "editorStatus",
        type: "ui-text",
        appId: "customersApp",
        mount: "route:/customers/content/toolbar",
        order: 2,
        value: {
            kind: "literal",
            value: "Editing customer"
        },
        x: 1160,
        y: 180,
        wires: [[]]
    },
    {
        id: "backToCustomersButton",
        type: "ui-button",
        appId: "customersApp",
        mount: "route:/customers/:id/content/toolbar",
        order: 0,
        label: "Back to customers",
        action: "goToCustomers",
        x: 1160,
        y: 220,
        wires: [["goToCustomers"]]
    },
    {
        id: "editCustomerButton",
        type: "ui-button",
        appId: "customersApp",
        mount: "route:/customers/:id/content/toolbar",
        order: 1,
        label: "Edit customer",
        action: "openCustomerEditor",
        x: 1160,
        y: 260,
        wires: [["openCustomerEditor"]]
    },
    {
        id: "deleteCustomerButton",
        type: "ui-button",
        appId: "customersApp",
        mount: "route:/customers/:id/content/toolbar",
        order: 2,
        label: "Delete customer",
        action: "deleteCustomer",
        disabled: {
            kind: "state",
            path: "draft.isDeleting",
            fallback: false
        },
        x: 1160,
        y: 300,
        wires: [["deleteCustomer"]]
    },
    {
        id: "customerForm",
        type: "ui-form",
        appId: "customersApp",
        mount: "dialog:customerEditor/content/form/fields",
        order: 0,
        fields: ["name", "email", "status"],
        model: {
            kind: "state",
            path: "draft.customer"
        },
        submitAction: "saveCustomer",
        x: 1160,
        y: 340,
        wires: [["saveCustomer"]]
    },
    {
        id: "cancelCustomerButton",
        type: "ui-button",
        appId: "customersApp",
        mount: "dialog:customerEditor/content/form/actions",
        order: 0,
        label: "Cancel",
        action: "closeCustomerEditor",
        x: 1160,
        y: 380,
        wires: [["closeCustomerEditor"]]
    },
    {
        id: "saveCustomerButton",
        type: "ui-button",
        appId: "customersApp",
        mount: "dialog:customerEditor/content/form/actions",
        order: 1,
        label: "Save",
        action: "saveCustomer",
        disabled: {
            kind: "state",
            path: "draft.isSaving",
            fallback: false
        },
        x: 1160,
        y: 420,
        wires: [["saveCustomer"]]
    },
    {
        id: "detailRouteTitle",
        type: "ui-text",
        appId: "customersApp",
        mount: "customerDetail.header",
        value: {
            kind: "literal",
            value: "Customer detail"
        },
        variant: "headline",
        x: 1160,
        y: 460,
        wires: [[]]
    },
    {
        id: "detailCustomerId",
        type: "ui-text",
        appId: "customersApp",
        mount: "route:/customers/:id/content/body",
        order: 0,
        value: {
            kind: "routeParam",
            path: "id"
        },
        x: 1160,
        y: 500,
        wires: [[]]
    },
    {
        id: "draftStore",
        type: "ui-store",
        appId: "customersApp",
        statePath: "draft.customer",
        initialValue: {
            name: "",
            email: "",
            status: "draft"
        },
        x: 1360,
        y: 80,
        wires: [[]]
    },
    {
        id: "customersQuery",
        type: "ui-query",
        appId: "customersApp",
        queryPath: "customers.list",
        source: "customers.list",
        refreshAction: "refreshCustomers",
        x: 1360,
        y: 120,
        wires: [[]]
    },
    {
        id: "customerDetailQuery",
        type: "ui-query",
        appId: "customersApp",
        queryPath: "customers.current",
        source: "customers.current",
        x: 1360,
        y: 160,
        wires: [[]]
    },
    {
        id: "openCustomerEditor",
        type: "ui-action",
        appId: "customersApp",
        description: "Open the shared customer editor dialog.",
        x: 1360,
        y: 220,
        wires: [[]]
    },
    {
        id: "closeCustomerEditor",
        type: "ui-action",
        appId: "customersApp",
        description: "Close the shared customer editor dialog.",
        x: 1360,
        y: 260,
        wires: [[]]
    },
    {
        id: "saveCustomer",
        type: "ui-action",
        appId: "customersApp",
        description: "Persist the current customer draft.",
        x: 1360,
        y: 300,
        wires: [[]]
    },
    {
        id: "refreshCustomers",
        type: "ui-action",
        appId: "customersApp",
        description: "Refresh the customer list query.",
        x: 1360,
        y: 340,
        wires: [["customersQuery"]]
    },
    {
        id: "openCustomerDetail",
        type: "ui-navigation",
        appId: "customersApp",
        to: "/customers/:id",
        x: 1360,
        y: 380,
        wires: [[]]
    },
    {
        id: "goToCustomers",
        type: "ui-navigation",
        appId: "customersApp",
        to: "/customers",
        x: 1360,
        y: 420,
        wires: [[]]
    },
    {
        id: "deleteCustomer",
        type: "ui-navigation",
        appId: "customersApp",
        to: "/customers",
        x: 1360,
        y: 460,
        wires: [[]]
    }
];

export const fixtureAppModels: AppModel[] = [customersCrudAppModelFixture, operationsConsoleAppModelFixture];
import type { AppModel, RuntimeIntegrationModel } from "./contracts";
import type { UiNodeDefinition } from "./node-definitions";

export const customersCrudAppModelFixture: AppModel = {
    id: "customersApp",
    title: "Customers CRM",
    layouts: [
        {
            id: "customerShell",
            title: "Customer shell",
            slots: [{ name: "header" }, { name: "content" }, { name: "footer" }]
        },
        {
            id: "customersListLayout",
            title: "Customers list content",
            slots: [{ name: "toolbar" }, { name: "body" }]
        },
        {
            id: "customerDetailLayout",
            title: "Customer detail content",
            slots: [{ name: "toolbar" }, { name: "body" }]
        },
        {
            id: "dialogShell",
            title: "Dialog shell",
            slots: [{ name: "header" }, { name: "content" }]
        },
        {
            id: "dialogFormLayout",
            title: "Dialog form layout",
            slots: [{ name: "fields" }, { name: "actions" }]
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
            id: "customersContentContainer",
            kind: "container",
            mount: "route:/customers/content",
            bind: {},
            props: {
                layoutId: "customersListLayout"
            },
            events: []
        },
        {
            id: "newCustomerButton",
            kind: "button",
            mount: "layout:customersListLayout/toolbar",
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
            mount: "layout:customersListLayout/toolbar",
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
            mount: "layout:customersListLayout/toolbar",
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
            mount: "layout:customersListLayout/body",
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
            mount: "customerDetail.header",
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
            id: "detailContentContainer",
            kind: "container",
            mount: "route:/customers/:id/content",
            bind: {},
            props: {
                layoutId: "customerDetailLayout"
            },
            events: []
        },
        {
            id: "backToCustomersButton",
            kind: "button",
            mount: "layout:customerDetailLayout/toolbar",
            order: 0,
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
            mount: "layout:customerDetailLayout/toolbar",
            order: 1,
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
            mount: "layout:customerDetailLayout/toolbar",
            order: 2,
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
            mount: "layout:customerDetailLayout/body",
            order: 0,
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
                layoutId: "dialogFormLayout"
            },
            events: []
        },
        {
            id: "customerNameInput",
            kind: "input",
            mount: "layout:dialogFormLayout/fields",
            order: 0,
            bind: {
                value: {
                    kind: "state",
                    path: "draft.customer.name"
                }
            },
            props: {
                label: "Name",
                storeId: "draftStore",
                path: "name"
            },
            events: [{ event: "change", action: "saveCustomer" }]
        },
        {
            id: "customerEmailInput",
            kind: "input",
            mount: "layout:dialogFormLayout/fields",
            order: 1,
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
                inputType: "email"
            },
            events: [{ event: "change", action: "saveCustomer" }]
        },
        {
            id: "customerStatusInput",
            kind: "input",
            mount: "layout:dialogFormLayout/fields",
            order: 2,
            bind: {
                value: {
                    kind: "state",
                    path: "draft.customer.status"
                }
            },
            props: {
                label: "Status",
                storeId: "draftStore",
                path: "status"
            },
            events: [{ event: "change", action: "saveCustomer" }]
        },
        {
            id: "cancelCustomerButton",
            kind: "button",
            mount: "layout:dialogFormLayout/actions",
            order: 0,
            bind: {
                label: {
                    kind: "literal",
                    value: "Cancel"
                }
            },
            props: {},
            events: [{ event: "click", action: "closeCustomerEditor" }]
        },
        {
            id: "saveCustomerButton",
            kind: "button",
            mount: "layout:dialogFormLayout/actions",
            order: 1,
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
            props: {},
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
        title: "Customers CRM"
    },
    {
        type: "ui-layout",
        id: "customerShell",
        title: "Customer shell"
    },
    {
        type: "ui-slot",
        id: "customerHeader",
        layoutId: "customerShell",
        name: "header",
        order: 0
    },
    {
        type: "ui-slot",
        id: "customerContent",
        layoutId: "customerShell",
        name: "content",
        order: 1
    },
    {
        type: "ui-slot",
        id: "customerFooter",
        layoutId: "customerShell",
        name: "footer",
        order: 2
    },
    {
        type: "ui-layout",
        id: "customersListLayout",
        title: "Customers list content"
    },
    {
        type: "ui-slot",
        id: "customerToolbar",
        layoutId: "customersListLayout",
        name: "toolbar",
        order: 0
    },
    {
        type: "ui-slot",
        id: "customerBody",
        layoutId: "customersListLayout",
        name: "body",
        order: 1
    },
    {
        type: "ui-layout",
        id: "customerDetailLayout",
        title: "Customer detail content"
    },
    {
        type: "ui-slot",
        id: "detailToolbar",
        layoutId: "customerDetailLayout",
        name: "toolbar",
        order: 0
    },
    {
        type: "ui-slot",
        id: "detailBody",
        layoutId: "customerDetailLayout",
        name: "body",
        order: 1
    },
    {
        type: "ui-layout",
        id: "dialogShell",
        title: "Dialog shell"
    },
    {
        type: "ui-slot",
        id: "dialogHeader",
        layoutId: "dialogShell",
        name: "header",
        order: 0
    },
    {
        type: "ui-slot",
        id: "dialogContent",
        layoutId: "dialogShell",
        name: "content",
        order: 1
    },
    {
        type: "ui-layout",
        id: "dialogFormLayout",
        title: "Dialog form layout"
    },
    {
        type: "ui-slot",
        id: "dialogFields",
        layoutId: "dialogFormLayout",
        name: "fields",
        order: 0
    },
    {
        type: "ui-slot",
        id: "dialogActions",
        layoutId: "dialogFormLayout",
        name: "actions",
        order: 1
    },
    {
        type: "ui-route",
        id: "customers",
        path: "/customers",
        title: "Customers",
        layoutId: "customerShell"
    },
    {
        type: "ui-route",
        id: "customerDetail",
        path: "/customers/:id",
        title: "Customer detail",
        layoutId: "customerShell"
    },
    {
        type: "ui-dialog",
        id: "customerEditor",
        title: "Edit customer",
        layoutId: "dialogShell",
        modal: true
    },
    {
        type: "ui-text",
        id: "pageTitle",
        mount: "customers.header",
        value: {
            kind: "literal",
            value: "Customers"
        },
        variant: "headline"
    },
    {
        type: "ui-container",
        id: "customersContentContainer",
        mount: "route:/customers/content",
        layoutId: "customersListLayout"
    },
    {
        type: "ui-button",
        id: "newCustomerButton",
        mount: "layout:customersListLayout/toolbar",
        order: 0,
        label: "New customer",
        action: "openCustomerEditor"
    },
    {
        type: "ui-button",
        id: "refreshCustomersButton",
        mount: "layout:customersListLayout/toolbar",
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
        mount: "layout:customersListLayout/toolbar",
        order: 2,
        value: {
            kind: "literal",
            value: "Editing customer"
        }
    },
    {
        type: "ui-table",
        id: "customersTable",
        mount: "layout:customersListLayout/body",
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
        mount: "customerDetail.header",
        value: {
            kind: "literal",
            value: "Customer detail"
        },
        variant: "headline"
    },
    {
        type: "ui-container",
        id: "detailContentContainer",
        mount: "route:/customers/:id/content",
        layoutId: "customerDetailLayout"
    },
    {
        type: "ui-button",
        id: "backToCustomersButton",
        mount: "layout:customerDetailLayout/toolbar",
        order: 0,
        label: "Back to customers",
        action: "goToCustomers"
    },
    {
        type: "ui-button",
        id: "editCustomerButton",
        mount: "layout:customerDetailLayout/toolbar",
        order: 1,
        label: "Edit customer",
        action: "openCustomerEditor"
    },
    {
        type: "ui-button",
        id: "deleteCustomerButton",
        mount: "layout:customerDetailLayout/toolbar",
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
        id: "detailCustomerId",
        mount: "layout:customerDetailLayout/body",
        order: 0,
        value: {
            kind: "routeParam",
            path: "id"
        }
    },
    {
        type: "ui-container",
        id: "customerEditorContainer",
        mount: "dialog:customerEditor/content",
        layoutId: "dialogFormLayout"
    },
    {
        type: "ui-input",
        id: "customerNameInput",
        mount: "layout:dialogFormLayout/fields",
        order: 0,
        label: "Name",
        value: {
            kind: "state",
            path: "draft.customer.name"
        },
        storeId: "draftStore",
        path: "name",
        inputType: "text"
    },
    {
        type: "ui-input",
        id: "customerEmailInput",
        mount: "layout:dialogFormLayout/fields",
        order: 1,
        label: "Email",
        value: {
            kind: "state",
            path: "draft.customer.email"
        },
        storeId: "draftStore",
        path: "email",
        inputType: "email"
    },
    {
        type: "ui-input",
        id: "customerStatusInput",
        mount: "layout:dialogFormLayout/fields",
        order: 2,
        label: "Status",
        value: {
            kind: "state",
            path: "draft.customer.status"
        },
        storeId: "draftStore",
        path: "status",
        inputType: "text"
    },
    {
        type: "ui-button",
        id: "cancelCustomerButton",
        mount: "layout:dialogFormLayout/actions",
        order: 0,
        label: "Cancel",
        action: "closeCustomerEditor"
    },
    {
        type: "ui-button",
        id: "saveCustomerButton",
        mount: "layout:dialogFormLayout/actions",
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
        source: "customers.list",
        refreshAction: "refreshCustomers"
    },
    {
        type: "ui-query",
        id: "customerDetailQuery",
        queryPath: "customers.current",
        source: "customers.current"
    },
    {
        type: "ui-action",
        id: "openCustomerEditor",
        actionType: "trigger",
        targetMode: "out-port",
        description: "Open the shared customer editor dialog."
    },
    {
        type: "ui-action",
        id: "closeCustomerEditor",
        actionType: "trigger",
        targetMode: "out-port",
        description: "Close the shared customer editor dialog."
    },
    {
        type: "ui-action",
        id: "saveCustomer",
        actionType: "trigger",
        targetMode: "out-port",
        description: "Persist the current customer draft."
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
    }
];

export const customersCrudExampleFlowFixture: unknown[] = customersCrudNodeSetFixture.map((node, index) => ({
    ...node,
    x: 160 + (index % 6) * 220,
    y: 40 + Math.floor(index / 6) * 40,
    wires: [[]]
}));

export const fixtureAppModels: AppModel[] = [customersCrudAppModelFixture, operationsConsoleAppModelFixture];

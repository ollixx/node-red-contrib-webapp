import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
    actionMessageSchema,
    actionMessageCommandSchema,
    actionTypeSchema,
    BUTTON_LINK_MODES,
    COMPONENT_SIZES,
    componentKindSchema,
    uiActionNodeDefinitionSchema,
    uiAppNodeDefinitionSchema,
    bindingSchema,
    dialogDefinitionSchema,
    errorContextSchema,
    errorOriginSchema,
    errorSeveritySchema,
    getStandardLayoutPresetDefinition,
    standardLayoutPresetIds,
    structuredErrorSchema,
    customersCrudAppModelFixture,
    customersCrudExampleFlowFixture,
    customersCrudNodeSetFixture,
    customersCrudRuntimeIntegrationFixture,
    fixtureAppModels,
    iconValueSchema,
    iconFieldSchema,
    normalizeIconValue,
    DEFAULT_ICON_LIBRARY,
    navigationDefinitionSchema,
    parseMountReference,
    resolveMountReference,
    routeNodePathSchema,
    runtimeIntegrationModelSchema,
    storeOperationSchema,
    uiDialogNodeDefinitionSchema,
    validateUiNodeDefinition,
    validateAppModel
} from "../src";

describe("mount parsing", () => {
    it("parses explicit route mounts", () => {
        const result = parseMountReference("route:/customers/content/toolbar");

        expect(result.success).toBe(true);

        if (!result.success) {
            return;
        }

        expect(result.data.scope).toBe("route");
        expect(result.data.raw).toBe("route:/customers/content/toolbar");
    });

    it("parses named mounts", () => {
        const result = parseMountReference("customers.header");

        expect(result.success).toBe(true);

        if (!result.success) {
            return;
        }

        expect(result.data.scope).toBe("named");

        if (result.data.scope === "named") {
            expect(result.data.target).toBe("customers");
            expect(result.data.regionPath).toEqual(["header"]);
        }
    });

    it("rejects malformed route mounts with readable errors", () => {
        const result = parseMountReference("route:/customers");

        expect(result).toEqual({
            success: false,
            error: "Route mounts must include a route path and at least one region, for example 'route:/customers/content'."
        });
    });
});

describe("P48: ui-route path '/' is reserved for the implicit app root", () => {
    it("rejects a ui-route node whose path is '/'", () => {
        const result = validateUiNodeDefinition({
            type: "ui-route",
            id: "homeRoute",
            uiId: "homeRoute",
            parent: "myApp",
            path: "/",
            layout: "vertical"
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toContain("implicit app root");
        }
    });

    it("accepts a ui-route node with a non-'/' path", () => {
        const result = validateUiNodeDefinition({
            type: "ui-route",
            id: "customersRoute",
            uiId: "customersRoute",
            parent: "myApp",
            path: "/customers",
            layout: "vertical"
        });

        expect(result.success).toBe(true);
    });

    it("routeNodePathSchema rejects '/' but accepts sub-paths", () => {
        expect(routeNodePathSchema.safeParse("/").success).toBe(false);
        expect(routeNodePathSchema.safeParse("/customers").success).toBe(true);
        expect(routeNodePathSchema.safeParse("/item/:id").success).toBe(true);
    });

    it("navigation destinations may still target '/' (the app root)", () => {
        // Navigating TO "/" is valid — only declaring a ui-route with path "/" is forbidden.
        expect(navigationDefinitionSchema.safeParse({ id: "nav1", to: "/" }).success).toBe(true);
    });
});

describe("app validation", () => {
    it("accepts the shipped fixtures", () => {
        for (const fixture of fixtureAppModels) {
            const validationResult = validateAppModel(fixture);
            expect(validationResult.success, fixture.id).toBe(true);
        }

        expect(runtimeIntegrationModelSchema.safeParse(customersCrudRuntimeIntegrationFixture).success).toBe(true);
    });

    it("accepts every node from the shipped customer CRUD example flow", () => {
        for (const node of customersCrudNodeSetFixture) {
            expect(validateUiNodeDefinition(node).success, node.id).toBe(true);
        }

        for (const node of customersCrudExampleFlowFixture) {
            expect(validateUiNodeDefinition(node).success, String((node as { id?: string }).id)).toBe(true);
        }
    });

    it("resolves route, dialog, and child-layout mounts from the realistic fixture", () => {
        const routeMountResult = resolveMountReference("route:/customers/:id/content", customersCrudAppModelFixture);
        const dialogMountResult = resolveMountReference("dialog:customerEditor/content", customersCrudAppModelFixture);
        const layoutMountResult = resolveMountReference("layout:grid/content", customersCrudAppModelFixture);

        expect(routeMountResult.success).toBe(true);
        expect(dialogMountResult.success).toBe(true);
        expect(layoutMountResult.success).toBe(true);

        if (routeMountResult.success) {
            expect(routeMountResult.data.targetId).toBe("customerDetail");
            expect(routeMountResult.data.regionPath).toEqual(["content"]);
        }

        if (dialogMountResult.success) {
            expect(dialogMountResult.data.targetId).toBe("customerEditor");
            expect(dialogMountResult.data.regionPath).toEqual(["content"]);
        }

        if (layoutMountResult.success) {
            expect(layoutMountResult.data.targetId).toBe("grid");
            expect(layoutMountResult.data.regionPath).toEqual(["content"]);
        }
    });

    it("reports invalid mounts predictably", () => {
        const validationResult = validateAppModel({
            ...customersCrudAppModelFixture,
            components: [
                ...customersCrudAppModelFixture.components,
                {
                    id: "brokenButton",
                    kind: "button",
                    mount: "dialog:missingDialog/content/actions",
                    props: {
                        label: "Broken"
                    },
                    bind: {},
                    events: []
                }
            ]
        });

        expect(validationResult.success).toBe(false);

        if (validationResult.success) {
            return;
        }

        expect(validationResult.error).toContain("mount");
        expect(validationResult.error).toContain("references unknown dialog 'missingDialog'");
    });

    it("reports missing slots predictably", () => {
        const validationResult = validateAppModel({
            ...customersCrudAppModelFixture,
            components: [
                ...customersCrudAppModelFixture.components,
                {
                    id: "orphanText",
                    kind: "text",
                    mount: "customers.sidebar",
                    props: {},
                    bind: {
                        value: {
                            kind: "literal",
                            value: "Sidebar"
                        }
                    },
                    events: []
                }
            ]
        });

        expect(validationResult.success).toBe(false);

        if (validationResult.success) {
            return;
        }

        expect(validationResult.error).toContain("missing slot path 'sidebar'");
    });

    it("accepts legacy ui-action definitions without typed fields", () => {
        expect(validateUiNodeDefinition({
            type: "ui-action",
            id: "saveCustomer"
        }).success).toBe(true);
    });

    it("P60: preserves the ui-action `targets` picker list through validation", () => {
        // Regression: validateUiNodeDefinition strips unknown keys by default, so a
        // missing `targets` field in the schema silently dropped the wireless
        // picker target list at runtime (node.webappDefinition.targets === undefined),
        // breaking targetNode.receive() delivery. The list must survive validation.
        const result = validateUiNodeDefinition({
            type: "ui-action",
            id: "openDialog",
            actionType: "open",
            targets: ["dialogA", "dialogB"]
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect((result.data as { targets?: string[] }).targets).toEqual(["dialogA", "dialogB"]);
        }
    });

    it("requires layout on ui-app definitions", () => {
        const missingLayout = validateUiNodeDefinition({
            type: "ui-app",
            id: "customersApp",
            title: "Customers"
        });

        expect(missingLayout.success).toBe(false);

        expect(validateUiNodeDefinition({
            type: "ui-app",
            id: "customersApp",
            title: "Customers",
            layout: "vertical"
        }).success).toBe(true);
    });

    it("rejects ui-app definitions with invalid layout identifiers", () => {
        const invalidLayout = validateUiNodeDefinition({
            type: "ui-app",
            id: "customersApp",
            title: "Customers",
            layout: "vertical layout"
        });

        expect(invalidLayout.success).toBe(false);

        if (invalidLayout.success) {
            return;
        }

        expect(invalidLayout.error).toBeTruthy();
    });

    it("validates ui-route required fields and path format", () => {
        expect(validateUiNodeDefinition({
            type: "ui-route",
            id: "customerDetail",
            path: "/customers/:id",
            layout: "vertical",
            title: "Customer detail"
        }).success).toBe(true);

        const missingLayout = validateUiNodeDefinition({
            type: "ui-route",
            id: "customers",
            path: "/customers"
        });

        expect(missingLayout.success).toBe(false);

        const invalidPath = validateUiNodeDefinition({
            type: "ui-route",
            id: "customers",
            path: "customers",
            layout: "vertical"
        });

        expect(invalidPath.success).toBe(false);

        if (invalidPath.success) {
            return;
        }

        expect(invalidPath.error).toContain("start with '/'");
    });

    it("validates ui-container required fields and optional metadata", () => {
        expect(validateUiNodeDefinition({
            type: "ui-container",
            id: "customersContentContainer",
            mount: "route:/customers/content",
            layout: "grid",
            order: 2
        }).success).toBe(true);

        const missingMount = validateUiNodeDefinition({
            type: "ui-container",
            id: "customersContentContainer",
            layout: "grid"
        });

        expect(missingMount.success).toBe(false);

        const missingLayout = validateUiNodeDefinition({
            type: "ui-container",
            id: "customersContentContainer",
            mount: "route:/customers/content"
        });

        expect(missingLayout.success).toBe(false);
    });

    // P20a: wiring model — targetMode/target are deprecated but still accepted for backward compat.
    it("accepts ui-action with wiring model (no targetMode/target)", () => {
        // Primary new model: actionType only, target is the wired output port
        expect(validateUiNodeDefinition({
            type: "ui-action",
            id: "hideToolbar",
            actionType: "hide"
        }).success).toBe(true);

        expect(validateUiNodeDefinition({
            type: "ui-action",
            id: "openDialog",
            actionType: "trigger"
        }).success).toBe(true);

        expect(validateUiNodeDefinition({
            type: "ui-action",
            id: "goToCustomers",
            actionType: "navigate",
            to: "/customers"
        }).success).toBe(true);
    });

    it("accepts ui-action with deprecated targetMode/target fields (backward compat)", () => {
        expect(validateUiNodeDefinition({
            type: "ui-action",
            id: "hideToolbar",
            actionType: "hide",
            targetMode: "path",
            target: "route:/customers/content/toolbar"
        }).success).toBe(true);

        expect(validateUiNodeDefinition({
            type: "ui-action",
            id: "triggerRefresh",
            actionType: "trigger",
            targetMode: "out-port"
        }).success).toBe(true);

        expect(validateUiNodeDefinition({
            type: "ui-action",
            id: "goToCustomers",
            actionType: "navigate",
            targetMode: "out-port",
            to: "/customers"
        }).success).toBe(true);
    });

    it("accepts generic ui-store operations for set, patch, delete, replace and reset", () => {
        expect(storeOperationSchema.safeParse({
            id: "draftStore",
            op: "set",
            path: "customer.name",
            value: "Ada"
        }).success).toBe(true);

        expect(storeOperationSchema.safeParse({
            id: "draftStore",
            op: "patch",
            path: "customer",
            value: { name: "Ada" }
        }).success).toBe(true);

        expect(storeOperationSchema.safeParse({
            id: "draftStore",
            op: "delete",
            path: "customer.status"
        }).success).toBe(true);

        expect(storeOperationSchema.safeParse({
            id: "draftStore",
            op: "replace",
            value: { customer: { name: "Ada" } }
        }).success).toBe(true);

        expect(storeOperationSchema.safeParse({
            id: "draftStore",
            op: "reset"
        }).success).toBe(true);
    });

    it("rejects invalid ui-store operations without required path or value data", () => {
        expect(storeOperationSchema.safeParse({
            id: "draftStore",
            op: "set",
            value: "Ada"
        }).success).toBe(false);

        expect(storeOperationSchema.safeParse({
            id: "draftStore",
            op: "patch",
            path: "customer"
        }).success).toBe(false);

        expect(storeOperationSchema.safeParse({
            id: "draftStore",
            op: "delete"
        }).success).toBe(false);
    });
});

// ── P16b: feedback and status nodes ─────────────────────────────────────────

describe("P16b feedback and status nodes", () => {
    it("compiles ui-alert to a valid definition", () => {
        const result = validateUiNodeDefinition({
            type: "ui-alert",
            id: "alert1",
            mount: "route:/dashboard/content",
            message: { kind: "state", path:"alerts.current" },
            severity: "warning",
            title: { kind: "literal", value: "Achtung" },
            dismissible: true
        });

        expect(result.success).toBe(true);
    });

    // P67: title is a binding, not a plain string.
    it("rejects a ui-alert with a plain-string title", () => {
        const result = validateUiNodeDefinition({
            type: "ui-alert",
            id: "alert1",
            mount: "route:/dashboard/content",
            message: { kind: "state", path: "alerts.current" },
            title: "Achtung"
        });

        expect(result.success).toBe(false);
    });

    // P67: message (and title) accept the new `store` binding kind.
    it("compiles a ui-alert whose message is a store binding", () => {
        const result = validateUiNodeDefinition({
            type: "ui-alert",
            id: "alert1",
            mount: "route:/dashboard/content",
            message: { kind: "store", path: "draftStore" },
            title: { kind: "store", path: "draftStore" }
        });

        expect(result.success).toBe(true);
    });

    // P67: a store binding still requires a path (the referenced store id).
    it("rejects a store binding without a path", () => {
        expect(bindingSchema.safeParse({ kind: "store" }).success).toBe(false);
        expect(bindingSchema.safeParse({ kind: "store", path: "draftStore" }).success).toBe(true);
    });

    it("rejects ui-alert without mount or parent", () => {
        const result = validateUiNodeDefinition({
            type: "ui-alert",
            id: "alert1",
            message: { kind: "state", path:"alerts.current" }
        });

        expect(result.success).toBe(false);
    });

    // P91: duration + countdown fields
    it("compiles ui-alert with duration and countdown", () => {
        const result = validateUiNodeDefinition({
            type: "ui-alert",
            id: "alert1",
            mount: "route:/dashboard/content",
            message: { kind: "literal", value: "Hinweis" },
            duration: 5000,
            countdown: true
        });

        expect(result.success).toBe(true);
    });

    it("rejects ui-alert with duration=0 (must be positive)", () => {
        const result = validateUiNodeDefinition({
            type: "ui-alert",
            id: "alert1",
            mount: "route:/dashboard/content",
            message: { kind: "literal", value: "Hinweis" },
            duration: 0
        });

        expect(result.success).toBe(false);
    });

    it("rejects ui-alert with negative duration", () => {
        const result = validateUiNodeDefinition({
            type: "ui-alert",
            id: "alert1",
            mount: "route:/dashboard/content",
            message: { kind: "literal", value: "Hinweis" },
            duration: -500
        });

        expect(result.success).toBe(false);
    });

    it("compiles ui-toast to a valid definition", () => {
        const result = validateUiNodeDefinition({
            type: "ui-toast",
            id: "toast1",
            severity: "success",
            duration: 3000,
            position: "top-right"
        });

        expect(result.success).toBe(true);
    });

    it("rejects ui-toast with negative duration", () => {
        const result = validateUiNodeDefinition({
            type: "ui-toast",
            id: "toast1",
            duration: -1
        });

        expect(result.success).toBe(false);
    });

    it("compiles ui-progress with value binding", () => {
        const result = validateUiNodeDefinition({
            type: "ui-progress",
            id: "progress1",
            mount: "route:/dashboard/content",
            variant: "bar",
            value: { kind: "state", path:"upload.percent" },
            showValue: true
        });

        expect(result.success).toBe(true);
        if (result.success && result.data.type === "ui-progress") {
            expect(result.data.value).toEqual({ kind: "state", path:"upload.percent" });
        }
    });

    it("compiles ui-progress without value (indeterminate)", () => {
        const result = validateUiNodeDefinition({
            type: "ui-progress",
            id: "progress1",
            mount: "route:/dashboard/content",
            variant: "spinner"
        });

        expect(result.success).toBe(true);
    });

    it("compiles ui-skeleton to a valid definition", () => {
        const result = validateUiNodeDefinition({
            type: "ui-skeleton",
            id: "skel1",
            mount: "route:/customers/content",
            visible: { kind: "state", path:"customers.loading" },
            variant: "table",
            lines: 5
        });

        expect(result.success).toBe(true);
    });

    it("rejects ui-skeleton without visible binding", () => {
        const result = validateUiNodeDefinition({
            type: "ui-skeleton",
            id: "skel1",
            mount: "route:/customers/content"
        });

        expect(result.success).toBe(false);
    });

    it("compiles ui-badge to a valid definition", () => {
        // P92: displayType is now shape (rounded/pill/square); variant replaces severity;
        // max field removed; pulsating + size fields added.
        const result = validateUiNodeDefinition({
            type: "ui-badge",
            id: "badge1",
            mount: "route:/customers/content",
            value: { kind: "state", path:"notifications.count" },
            displayType: "pill",
            variant: "danger",
            pulsating: true,
            size: "md"
        });

        expect(result.success).toBe(true);
    });

    it("compiles ui-empty-state to a valid definition", () => {
        const result = validateUiNodeDefinition({
            type: "ui-empty-state",
            id: "empty1",
            mount: "route:/customers/content",
            visible: { kind: "state", path:"customers.isEmpty" },
            title: "Keine Einträge",
            message: "Noch keine Kunden angelegt.",
            icon: "inbox"
        });

        expect(result.success).toBe(true);
    });

    it("rejects ui-empty-state without visible binding", () => {
        const result = validateUiNodeDefinition({
            type: "ui-empty-state",
            id: "empty1",
            mount: "route:/customers/content"
        });

        expect(result.success).toBe(false);
    });
});

// ── P16c: navigation and structure nodes ────────────────────────────────────

describe("P16c navigation and structure nodes", () => {
    it("compiles ui-tabs with 3 tabs to a valid definition", () => {
        const result = validateUiNodeDefinition({
            type: "ui-tabs",
            id: "tabs1",
            mount: "route:/dashboard/content",
            tabs: [
                { id: "tab1", label: "Overview" },
                { id: "tab2", label: "Details" },
                { id: "tab3", label: "Settings" }
            ]
        });

        expect(result.success).toBe(true);
        if (result.success && result.data.type === "ui-tabs") {
            expect(result.data.tabs).toHaveLength(3);
        }
    });

    it("rejects ui-tabs with empty tabs array", () => {
        const result = validateUiNodeDefinition({
            type: "ui-tabs",
            id: "tabs1",
            mount: "route:/dashboard/content",
            tabs: []
        });

        expect(result.success).toBe(false);
    });

    it("rejects ui-tabs without mount or parent", () => {
        const result = validateUiNodeDefinition({
            type: "ui-tabs",
            id: "tabs1",
            tabs: [{ id: "tab1", label: "Tab 1" }]
        });

        expect(result.success).toBe(false);
    });

    it("compiles ui-accordion to a valid definition", () => {
        const result = validateUiNodeDefinition({
            type: "ui-accordion",
            id: "acc1",
            mount: "route:/dashboard/content",
            sections: [
                { id: "s1", label: "Section 1" },
                { id: "s2", label: "Section 2" }
            ],
            multiple: true
        });

        expect(result.success).toBe(true);
    });

    it("rejects ui-accordion without mount or parent", () => {
        const result = validateUiNodeDefinition({
            type: "ui-accordion",
            id: "acc1",
            sections: [{ id: "s1", label: "Section 1" }]
        });

        expect(result.success).toBe(false);
    });

    // P95: breadcrumb item model redesign — {label, action?, active?} + string arrays.
    it("compiles ui-breadcrumb with static object items (P95 model)", () => {
        const result = validateUiNodeDefinition({
            type: "ui-breadcrumb",
            id: "bc1",
            mount: "route:/customers/header",
            items: [
                { label: "Home", action: "/", active: false },
                { label: "Customers", action: "/customers" },
                { label: "Details", active: true }
            ]
        });

        expect(result.success).toBe(true);
    });

    it("compiles ui-breadcrumb with static string items (P95 model)", () => {
        const result = validateUiNodeDefinition({
            type: "ui-breadcrumb",
            id: "bc2",
            mount: "route:/customers/header",
            items: ["Home", "Customers", "Details"]
        });

        expect(result.success).toBe(true);
    });

    it("compiles ui-breadcrumb with binding", () => {
        const result = validateUiNodeDefinition({
            type: "ui-breadcrumb",
            id: "bc3",
            mount: "route:/customers/header",
            items: { kind: "state", path: "nav.breadcrumb" }
        });

        expect(result.success).toBe(true);
    });

    it("compiles ui-breadcrumb with breadcrumb layout (child slots mode)", () => {
        const result = validateUiNodeDefinition({
            type: "ui-breadcrumb",
            id: "bc4",
            mount: "route:/customers/header",
            layout: "breadcrumb"
        });

        expect(result.success).toBe(true);
    });

    it("compiles ui-menu to a valid definition", () => {
        const result = validateUiNodeDefinition({
            type: "ui-menu",
            id: "menu1",
            mount: "app:myapp/sidebar",
            variant: "sidebar",
            items: [
                { label: "Dashboard", route: "/dashboard" },
                { label: "Customers", route: "/customers" }
            ]
        });

        expect(result.success).toBe(true);
    });

    // P95: ui-breadcrumb emits 'click' events (all items clickable).
    // P75 legacy: 'navigate' is also accepted for back-compat.
    it("accepts ui-breadcrumb with events: ['click'] (P95)", () => {
        const result = validateUiNodeDefinition({
            type: "ui-breadcrumb",
            id: "bcNav",
            mount: "route:/customers/header",
            items: [{ label: "Home", action: "/" }, { label: "Customers" }],
            events: ["click"]
        });

        expect(result.success).toBe(true);
        if (result.success && result.data.type === "ui-breadcrumb") {
            expect(result.data.events).toEqual(["click"]);
        }
    });

    it("accepts ui-breadcrumb with events: ['navigate'] (P75 back-compat)", () => {
        const result = validateUiNodeDefinition({
            type: "ui-breadcrumb",
            id: "bcNav2",
            mount: "route:/customers/header",
            items: [{ label: "Home", action: "/" }],
            events: ["navigate"]
        });

        expect(result.success).toBe(true);
    });

    it("rejects a truly unknown event name on ui-breadcrumb", () => {
        const result = validateUiNodeDefinition({
            type: "ui-breadcrumb",
            id: "bcBad",
            mount: "route:/customers/header",
            items: [{ label: "Home" }],
            events: ["unknownEvent"]
        });

        expect(result.success).toBe(false);
    });

    it("accepts ui-menu with events: ['navigate']", () => {
        const result = validateUiNodeDefinition({
            type: "ui-menu",
            id: "menuNav",
            mount: "app:myapp/sidebar",
            items: [{ label: "Dashboard", route: "/dashboard" }],
            events: ["navigate"]
        });

        expect(result.success).toBe(true);
        if (result.success && result.data.type === "ui-menu") {
            expect(result.data.events).toEqual(["navigate"]);
        }
    });

    it("compiles ui-pagination with page and totalPages bindings", () => {
        const result = validateUiNodeDefinition({
            type: "ui-pagination",
            id: "pag1",
            mount: "route:/customers/footer",
            page: { kind: "state", path: "filter.page" },
            totalPages: { kind: "state", path: "customers.totalPages" },
            events: ["pageChange"]
        });

        expect(result.success).toBe(true);
        if (result.success && result.data.type === "ui-pagination") {
            expect(result.data.page).toEqual({ kind: "state", path: "filter.page" });
            expect(result.data.totalPages).toEqual({ kind: "state", path: "customers.totalPages" });
        }
    });

    it("rejects ui-pagination without required bindings", () => {
        const result = validateUiNodeDefinition({
            type: "ui-pagination",
            id: "pag1",
            mount: "route:/customers/footer"
        });

        expect(result.success).toBe(false);
    });

    it("compiles ui-stepper with 3 steps", () => {
        const result = validateUiNodeDefinition({
            type: "ui-stepper",
            id: "step1",
            mount: "route:/wizard/content",
            steps: [
                { id: "s1", label: "Step 1" },
                { id: "s2", label: "Step 2" },
                { id: "s3", label: "Step 3" }
            ],
            activeStep: { kind: "state", path: "wizard.step" },
            variant: "horizontal",
            events: ["stepChange"]
        });

        expect(result.success).toBe(true);
    });

    it("rejects ui-stepper with fewer than 2 steps", () => {
        const result = validateUiNodeDefinition({
            type: "ui-stepper",
            id: "step1",
            mount: "route:/wizard/content",
            steps: [{ id: "s1", label: "Step 1" }]
        });

        expect(result.success).toBe(false);
    });

    // ── P16d: display nodes ──────────────────────────────────────────────────

    it("compiles ui-image with src binding", () => {
        const result = validateUiNodeDefinition({
            type: "ui-image",
            id: "img1",
            mount: "route:/customers/content",
            src: { kind: "state", path: "customer.avatarUrl" },
            alt: "Customer photo",
            fallbackSrc: "https://example.com/placeholder.png"
        });

        expect(result.success).toBe(true);
    });

    it("compiles ui-image with fallbackSrc", () => {
        const result = validateUiNodeDefinition({
            type: "ui-image",
            id: "img2",
            mount: "route:/customers/content",
            src: { kind: "state", path: "item.imageUrl" },
            fallbackSrc: "https://example.com/placeholder.png"
        });

        expect(result.success).toBe(true);
        if (result.success && result.data.type === "ui-image") {
            expect(result.data.fallbackSrc).toBe("https://example.com/placeholder.png");
        }
    });

    it("compiles ui-icon with name", () => {
        const result = validateUiNodeDefinition({
            type: "ui-icon",
            id: "icon1",
            mount: "route:/customers/content",
            icon: "home",
            size: "md",
            color: "#333"
        });

        expect(result.success).toBe(true);
    });

    it("rejects ui-icon without icon name", () => {
        const result = validateUiNodeDefinition({
            type: "ui-icon",
            id: "icon2",
            mount: "route:/customers/content",
            icon: ""
        });

        expect(result.success).toBe(false);
    });

    it("compiles ui-list with static items", () => {
        const result = validateUiNodeDefinition({
            type: "ui-list",
            id: "list1",
            mount: "route:/customers/content",
            items: [{ label: "Item A" }, { label: "Item B", value: "b" }],
            variant: "default"
        });

        expect(result.success).toBe(true);
    });

    it("compiles ui-list with binding", () => {
        const result = validateUiNodeDefinition({
            type: "ui-list",
            id: "list2",
            mount: "route:/customers/content",
            items: { kind: "state", path: "menu.items" },
            variant: "compact"
        });

        expect(result.success).toBe(true);
    });

    it("compiles ui-avatar with src binding and initials fallback", () => {
        const result = validateUiNodeDefinition({
            type: "ui-avatar",
            id: "avatar1",
            mount: "route:/customers/content",
            src: { kind: "state", path: "user.avatarUrl" },
            initials: { kind: "literal", value: "JD" },
            size: "md",
            shape: "circle"
        });

        expect(result.success).toBe(true);
    });

    it("compiles ui-avatar without src (initials only)", () => {
        const result = validateUiNodeDefinition({
            type: "ui-avatar",
            id: "avatar2",
            mount: "route:/customers/content",
            initials: { kind: "literal", value: "AB" }
        });

        expect(result.success).toBe(true);
    });

    it("compiles ui-divider horizontal", () => {
        const result = validateUiNodeDefinition({
            type: "ui-divider",
            id: "div1",
            mount: "route:/customers/content",
            orientation: "horizontal"
        });

        expect(result.success).toBe(true);
    });

    it("compiles ui-divider vertical with label", () => {
        const result = validateUiNodeDefinition({
            type: "ui-divider",
            id: "div2",
            mount: "route:/customers/content",
            orientation: "vertical",
            label: "Or"
        });

        expect(result.success).toBe(true);
    });
});

describe("generated example flow (gen:example)", () => {
    // Load the generated flow.json from disk — this is the artefact produced by
    // `pnpm gen:example` and committed to the repo.
    const flowPath = resolve(__dirname, "../../../examples/customers-crud/flow.json");
    const rawFlow: unknown[] = JSON.parse(readFileSync(flowPath, "utf8"));

    it("flow.json is parseable and contains at least one tab node", () => {
        expect(Array.isArray(rawFlow)).toBe(true);
        const tabs = rawFlow.filter((n) => (n as Record<string, unknown>).type === "tab");
        expect(tabs.length).toBeGreaterThanOrEqual(1);
    });

    it("every non-tab node has an id and a z reference to an existing flow tab", () => {
        const tabIds = new Set(
            rawFlow
                .filter((n) => (n as Record<string, unknown>).type === "tab")
                .map((n) => (n as Record<string, unknown>).id as string)
        );

        const nonTabNodes = rawFlow.filter((n) => (n as Record<string, unknown>).type !== "tab");
        for (const node of nonTabNodes) {
            const n = node as Record<string, unknown>;
            expect(n.id, "node must have an id").toBeTruthy();
            expect(n.z, `node ${n.id} must have a z field`).toBeTruthy();
            expect(tabIds.has(n.z as string), `node ${n.id} z='${n.z}' must reference an existing tab`).toBe(true);
        }
    });

    it("every non-tab node has type, id, and z", () => {
        // flow.json uses Node-RED editor-layer fields (root, name, uiId, mount, etc.)
        // Schema validation runs after mapConfig translation in webapp.js.
        // This test verifies structural completeness of the flow file only.
        const nonTabNodes = rawFlow.filter((n) => (n as Record<string, unknown>).type !== "tab");
        for (const node of nonTabNodes) {
            const n = node as Record<string, unknown>;
            expect(typeof n.type, `node ${n.id} must have a type`).toBe("string");
            expect(typeof n.id, `node ${n.type} must have an id`).toBe("string");
            expect(typeof n.z, `node ${n.id} must have a z`).toBe("string");
        }
    });

    it("generated flow covers the same node types as customersCrudNodeSetFixture", () => {
        const fixtureTypes = new Set(customersCrudNodeSetFixture.map((n) => n.type));
        const generatedTypes = new Set(
            rawFlow
                .filter((n) => (n as Record<string, unknown>).type !== "tab")
                .map((n) => (n as Record<string, unknown>).type as string)
        );

        for (const t of fixtureTypes) {
            expect(generatedTypes.has(t), `generated flow must include node type '${t}'`).toBe(true);
        }
    });

    // P33: the example proves the whole thesis — ALL CRUD domain logic lives in
    // plain Node-RED `function` nodes wired into the flow; the UI nodes only emit
    // events out and receive store/action updates back. So the flow must contain
    // real wires connecting UI node outputs to function nodes, and function nodes
    // back to ui-store / ui-action nodes.
    describe("P33: real wiring carries the CRUD (zero framework logic)", () => {
        const nodesById = new Map<string, Record<string, unknown>>();
        for (const n of rawFlow) {
            const node = n as Record<string, unknown>;
            if (node.id) {
                nodesById.set(node.id as string, node);
            }
        }

        const wiresOf = (node: Record<string, unknown> | undefined): string[] => {
            if (!node || !Array.isArray(node.wires)) {
                return [];
            }
            return (node.wires as unknown[][]).flat().filter((id): id is string => typeof id === "string");
        };

        const typeOf = (id: string): string | undefined =>
            nodesById.get(id)?.type as string | undefined;

        it("includes plain Node-RED function nodes that hold the domain logic", () => {
            const fns = rawFlow.filter((n) => (n as Record<string, unknown>).type === "function");
            expect(fns.length).toBeGreaterThan(0);
        });

        it("has non-empty wires from UI node outputs (button/table) into function nodes", () => {
            const uiTriggerTypes = new Set(["ui-button", "ui-table"]);
            const wiredFromUiToFn = rawFlow.filter((n) => {
                const node = n as Record<string, unknown>;
                if (!uiTriggerTypes.has(node.type as string)) {
                    return false;
                }
                return wiresOf(node).some((targetId) => typeOf(targetId) === "function");
            });
            expect(wiredFromUiToFn.length).toBeGreaterThan(0);
        });

        it("has function nodes wired into ui-store and ui-action nodes", () => {
            const fns = rawFlow.filter((n) => (n as Record<string, unknown>).type === "function");
            const downstreamTypes = new Set<string>();
            for (const fn of fns) {
                for (const targetId of wiresOf(fn as Record<string, unknown>)) {
                    const t = typeOf(targetId);
                    if (t) {
                        downstreamTypes.add(t);
                    }
                }
            }
            expect(downstreamTypes.has("ui-store")).toBe(true);
            expect(downstreamTypes.has("ui-action")).toBe(true);
        });
    });
});

// P20b: ui-text binding enhancements
describe("P20b: bindingSchema extended kinds", () => {
    it("accepts msg binding with a path", () => {
        const result = bindingSchema.safeParse({ kind: "msg", path: "payload" });
        expect(result.success).toBe(true);
    });

    it("accepts flow binding with a path", () => {
        const result = bindingSchema.safeParse({ kind: "flow", path: "myVar" });
        expect(result.success).toBe(true);
    });

    it("accepts global binding with a path", () => {
        const result = bindingSchema.safeParse({ kind: "global", path: "settings.title" });
        expect(result.success).toBe(true);
    });

    it("accepts jsonata binding with a path", () => {
        const result = bindingSchema.safeParse({ kind: "jsonata", path: "payload.items[0].name" });
        expect(result.success).toBe(true);
    });

    it("accepts env binding with a path", () => {
        const result = bindingSchema.safeParse({ kind: "env", path: "APP_TITLE" });
        expect(result.success).toBe(true);
    });

    it("rejects msg binding without a path", () => {
        const result = bindingSchema.safeParse({ kind: "msg" });
        expect(result.success).toBe(false);
    });

    it("rejects env binding without a path", () => {
        const result = bindingSchema.safeParse({ kind: "env" });
        expect(result.success).toBe(false);
    });

    it("accepts msg binding nested path", () => {
        const result = bindingSchema.safeParse({ kind: "msg", path: "payload.user.name" });
        expect(result.success).toBe(true);
    });
});

describe("P54: structured error/log contract (ADR 0006)", () => {
    const validError = {
        severity: "error" as const,
        code: "client.snapshot.malformed",
        message: "Snapshot frame could not be parsed (appId=app1).",
        context: { appId: "app1", nodeId: "comp1", op: "applySnapshot" },
        timestamp: "2026-06-06T12:00:00.000Z",
        origin: "client" as const
    };

    it("accepts a fully-populated structured error", () => {
        const result = structuredErrorSchema.safeParse(validError);
        expect(result.success).toBe(true);
    });

    it("accepts a server-origin error with an empty context", () => {
        const result = structuredErrorSchema.safeParse({
            ...validError,
            origin: "server",
            context: {}
        });
        expect(result.success).toBe(true);
    });

    it("accepts every documented severity level", () => {
        for (const severity of ["debug", "info", "warn", "error"]) {
            expect(errorSeveritySchema.safeParse(severity).success).toBe(true);
            expect(structuredErrorSchema.safeParse({ ...validError, severity }).success).toBe(true);
        }
    });

    it("rejects a severity outside the enum", () => {
        expect(errorSeveritySchema.safeParse("fatal").success).toBe(false);
        expect(structuredErrorSchema.safeParse({ ...validError, severity: "fatal" }).success).toBe(false);
    });

    it("accepts both documented origins and rejects others", () => {
        expect(errorOriginSchema.safeParse("client").success).toBe(true);
        expect(errorOriginSchema.safeParse("server").success).toBe(true);
        expect(errorOriginSchema.safeParse("flow").success).toBe(false);
        expect(structuredErrorSchema.safeParse({ ...validError, origin: "flow" }).success).toBe(false);
    });

    it("requires severity, code, message, timestamp and origin", () => {
        for (const field of ["severity", "code", "message", "timestamp", "origin"]) {
            const incomplete: Record<string, unknown> = { ...validError };
            delete incomplete[field];
            expect(structuredErrorSchema.safeParse(incomplete).success).toBe(false);
        }
    });

    it("rejects an empty code, message or timestamp", () => {
        expect(structuredErrorSchema.safeParse({ ...validError, code: "" }).success).toBe(false);
        expect(structuredErrorSchema.safeParse({ ...validError, message: "" }).success).toBe(false);
        expect(structuredErrorSchema.safeParse({ ...validError, timestamp: "" }).success).toBe(false);
    });

    it("treats every context field as optional", () => {
        const result = errorContextSchema.safeParse({});
        expect(result.success).toBe(true);
        expect(errorContextSchema.safeParse({ appId: "app1" }).success).toBe(true);
        expect(errorContextSchema.safeParse({ nodeId: "n1" }).success).toBe(true);
        expect(errorContextSchema.safeParse({ op: "mapConfig" }).success).toBe(true);
    });

    it("defaults context to an empty object when omitted", () => {
        const result = structuredErrorSchema.safeParse({
            severity: "warn",
            code: "client.event.post-failed",
            message: "Event POST failed.",
            timestamp: "2026-06-06T12:00:00.000Z",
            origin: "client"
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.context).toEqual({});
        }
    });
});

describe("P56: ui-app backend→frontend error forwarding config (ADR 0006 §4)", () => {
    const baseApp = {
        type: "ui-app" as const,
        id: "app1",
        title: "App One",
        layout: "vertical" as const
    };

    it("validates an app with forwarding fields absent (runtime defaults OFF)", () => {
        const result = validateUiNodeDefinition(baseApp);
        expect(result.success).toBe(true);
        if (result.success) {
            const data = result.data as Record<string, unknown>;
            // Absent → undefined in the validated definition; the runtime treats
            // absent as the secure default (no forwarding). The schema must never
            // require these fields (back-compat with pre-P56 configs/fixtures).
            expect(data.forwardErrorsToClient).toBeUndefined();
            expect(data.forwardErrorMinSeverity).toBeUndefined();
        }
    });

    it("accepts forwarding enabled with a valid severity threshold", () => {
        for (const minSeverity of ["debug", "info", "warn", "error"]) {
            const result = validateUiNodeDefinition({
                ...baseApp,
                forwardErrorsToClient: true,
                forwardErrorMinSeverity: minSeverity
            });
            expect(result.success, minSeverity).toBe(true);
        }
    });

    it("rejects a threshold outside the severity enum", () => {
        const result = validateUiNodeDefinition({
            ...baseApp,
            forwardErrorsToClient: true,
            forwardErrorMinSeverity: "fatal"
        });
        expect(result.success).toBe(false);
    });
});

describe("P58: action message contract (ADR 0007 §1)", () => {
    it("accepts a valid msg.ui.action for every verb in the verb set", () => {
        for (const type of actionTypeSchema.options) {
            const result = actionMessageSchema.safeParse({ ui: { action: { type } } });
            expect(result.success, type).toBe(true);
        }
    });

    it("accepts the optional to / part / target / clientId fields", () => {
        const result = actionMessageSchema.safeParse({
            ui: {
                clientId: "client-abc123",
                action: { type: "navigate", to: "/customers/42", target: "node1", part: "tab-2" }
            }
        });
        expect(result.success).toBe(true);
    });

    it("passes foreign msg.* fields (payload/topic/_msgid) through untouched", () => {
        const message = {
            payload: { customerId: 42 },
            topic: "customers/save",
            _msgid: "abc.def",
            ui: { action: { type: "open", target: "dialog1" } }
        };
        const result = actionMessageSchema.safeParse(message);
        expect(result.success).toBe(true);
        if (result.success) {
            const data = result.data as Record<string, unknown>;
            // Foreign top-level fields survive validation — the contract enriches
            // the message, it does not replace it (no .strict() on msg).
            expect(data.payload).toEqual({ customerId: 42 });
            expect(data.topic).toBe("customers/save");
            expect(data._msgid).toBe("abc.def");
        }
    });

    it("passes foreign msg.ui.* fields (e.g. appId) through untouched", () => {
        const result = actionMessageSchema.safeParse({
            ui: { appId: "app1", action: { type: "hide", target: "panel1" } }
        });
        expect(result.success).toBe(true);
        if (result.success) {
            const ui = (result.data as { ui: Record<string, unknown> }).ui;
            expect(ui.appId).toBe("app1");
        }
    });

    it("rejects an unknown verb", () => {
        const result = actionMessageSchema.safeParse({ ui: { action: { type: "explode" } } });
        expect(result.success).toBe(false);
    });

    it("rejects a missing action type", () => {
        const result = actionMessageSchema.safeParse({ ui: { action: { target: "node1" } } });
        expect(result.success).toBe(false);
    });

    it("rejects an unknown field inside msg.ui.action (action is strict)", () => {
        const result = actionMessageSchema.safeParse({
            ui: { action: { type: "navigate", targetId: "node1" } }
        });
        expect(result.success).toBe(false);
    });

    it("rejects empty-string to / part / target values", () => {
        for (const field of ["to", "part", "target"]) {
            const result = actionMessageSchema.safeParse({
                ui: { action: { type: "navigate", [field]: "" } }
            });
            expect(result.success, field).toBe(false);
        }
    });
});

describe("P66: ui-action navigation — typedInput `to` + params; ui-app onEnter/onLeave", () => {
    it("accepts a navigate action message carrying params (Scenario 1: wired-route URL params)", () => {
        const result = actionMessageSchema.safeParse({
            ui: { action: { type: "navigate", params: { id: "42", tab: "orders" } } }
        });
        expect(result.success).toBe(true);
        if (result.success) {
            const action = (result.data as { ui: { action: Record<string, unknown> } }).ui.action;
            expect(action.params).toEqual({ id: "42", tab: "orders" });
        }
    });

    it("accepts a navigate action message with both `to` and params (Scenario 2: path template + extra params)", () => {
        const result = actionMessageCommandSchema.safeParse({ type: "navigate", to: "/customers/42", params: { tab: "orders" } });
        expect(result.success).toBe(true);
    });

    it("rejects non-string param values (params are URL params → string-only)", () => {
        const result = actionMessageCommandSchema.safeParse({ type: "navigate", params: { id: 42 } });
        expect(result.success).toBe(false);
    });

    it("ui-action node accepts `to` + `toType` (typedInput) + params (Scenario 1)", () => {
        const result = uiActionNodeDefinitionSchema.safeParse({
            type: "ui-action",
            id: "goCustomer",
            actionType: "navigate",
            to: "msg.dest",
            toType: "msg",
            params: { id: "rowId" }
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.toType).toBe("msg");
            expect(result.data.params).toEqual({ id: "rowId" });
        }
    });

    it("ui-action node accepts a navigate action with NO `to` (Scenario 1: wired to a ui-route)", () => {
        const result = uiActionNodeDefinitionSchema.safeParse({
            type: "ui-action",
            id: "goWired",
            actionType: "navigate"
        });
        // The schema no longer forces a `to`; ambiguity/dead-link checks are
        // runtime cross-checks (the wire is invisible to per-node validation).
        expect(result.success).toBe(true);
    });

    it("ui-action node rejects an unknown `toType`", () => {
        const result = uiActionNodeDefinitionSchema.safeParse({
            type: "ui-action",
            id: "badType",
            actionType: "navigate",
            to: "x",
            toType: "bogus"
        });
        expect(result.success).toBe(false);
    });

    it("ui-app events accept onEnter / onLeave (implicit root route entry/leave)", () => {
        const result = uiAppNodeDefinitionSchema.safeParse({
            type: "ui-app",
            id: "app1",
            title: "App",
            layout: "vertical",
            events: ["clientConnected", "onEnter", "onLeave"]
        });
        expect(result.success).toBe(true);
    });
});

describe("P70: ui-image media + ui-app media store", () => {
    it("ui-app accepts an optional mediaStoreUrl", () => {
        const result = uiAppNodeDefinitionSchema.safeParse({
            type: "ui-app",
            id: "app1",
            title: "App",
            layout: "vertical",
            mediaStoreUrl: "https://cdn.example.com/assets"
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.mediaStoreUrl).toBe("https://cdn.example.com/assets");
        }
    });

    it("ui-app stays valid with no mediaStoreUrl (optional)", () => {
        const result = uiAppNodeDefinitionSchema.safeParse({
            type: "ui-app",
            id: "app1",
            title: "App",
            layout: "vertical"
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.mediaStoreUrl).toBeUndefined();
        }
    });

    it("ui-image accepts a literal URL src and fit/width/height", () => {
        const result = validateUiNodeDefinition({
            type: "ui-image",
            id: "img1",
            mount: "route:/customers/content",
            src: { kind: "literal", value: "https://example.com/p.png" },
            fit: "cover",
            width: "100%",
            height: 150
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.type === "ui-image") {
            expect(result.data.fit).toBe("cover");
            expect(result.data.width).toBe("100%");
            expect(result.data.height).toBe(150);
        }
    });

    it("ui-image accepts an asset:<id> literal src (managed asset reference)", () => {
        const result = validateUiNodeDefinition({
            type: "ui-image",
            id: "img1",
            mount: "route:/customers/content",
            src: { kind: "literal", value: "asset:logo-2024" }
        });
        expect(result.success).toBe(true);
    });

    it("image is a recognised component kind", () => {
        expect(componentKindSchema.safeParse("image").success).toBe(true);
    });
});

describe("P64: ui-dialog closable + dialog layout preset", () => {
    it("ui-dialog closable defaults to true", () => {
        const result = uiDialogNodeDefinitionSchema.safeParse({
            type: "ui-dialog",
            id: "d1",
            layout: "dialog"
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.closable).toBe(true);
        }
    });

    it("ui-dialog closable can be set to false", () => {
        const result = uiDialogNodeDefinitionSchema.safeParse({
            type: "ui-dialog",
            id: "d1",
            layout: "dialog",
            closable: false
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.closable).toBe(false);
        }
    });

    it("dialogDefinitionSchema closable defaults to true", () => {
        const result = dialogDefinitionSchema.safeParse({
            id: "d1",
            layoutId: "dialog"
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.closable).toBe(true);
        }
    });

    it("'dialog' is a standard layout preset", () => {
        expect(standardLayoutPresetIds).toContain("dialog");
    });

    it("the dialog preset declares header / header-actions / content / footer slots", () => {
        const preset = getStandardLayoutPresetDefinition("dialog");
        expect(preset).toBeDefined();
        expect(preset?.slots.map((slot) => slot.name)).toEqual([
            "header",
            "header-actions",
            "content",
            "footer"
        ]);
    });

    it("'header-actions' is a valid region name (no schema change needed)", () => {
        const preset = getStandardLayoutPresetDefinition("dialog");
        expect(preset?.slots.some((slot) => slot.name === "header-actions")).toBe(true);
    });

    it("ui-dialog can use the dialog layout preset", () => {
        const result = uiDialogNodeDefinitionSchema.safeParse({
            type: "ui-dialog",
            id: "d1",
            layout: "dialog"
        });
        expect(result.success).toBe(true);
    });
});

describe("P64: generated example uses a native closable dialog (no closeCustomerEditor action)", () => {
    const flowPath = resolve(__dirname, "../../../examples/customers-crud/flow.json");
    const rawFlow: unknown[] = JSON.parse(readFileSync(flowPath, "utf8"));

    it("the customerEditor ui-dialog node is closable and uses the dialog layout", () => {
        const dialogNode = rawFlow.find(
            (n): n is Record<string, unknown> =>
                typeof n === "object" && n !== null && (n as Record<string, unknown>).type === "ui-dialog"
        );
        expect(dialogNode).toBeDefined();
        expect(dialogNode?.layoutId).toBe("dialog");
        expect(dialogNode?.closable).not.toBe(false);
    });

    it("the closeCustomerEditor action node is gone (native dismissal replaces it)", () => {
        const hasCloseAction = rawFlow.some(
            (n) => typeof n === "object" && n !== null && (n as Record<string, unknown>).uiId === "closeCustomerEditor"
        );
        expect(hasCloseAction).toBe(false);
    });
});

describe("P69: backend-neutral icon value { library, name }", () => {
    it("accepts a { name } object without a library (default library applies)", () => {
        const result = iconValueSchema.safeParse({ name: "home" });
        expect(result.success).toBe(true);
    });

    it("accepts a { library, name } object", () => {
        const result = iconValueSchema.safeParse({ library: "lucide", name: "user" });
        expect(result.success).toBe(true);
    });

    it("rejects an icon value with an empty name", () => {
        const result = iconValueSchema.safeParse({ name: "" });
        expect(result.success).toBe(false);
    });

    it("exposes a default icon library constant (the vendored bootstrap set)", () => {
        expect(typeof DEFAULT_ICON_LIBRARY).toBe("string");
        expect(DEFAULT_ICON_LIBRARY.length).toBeGreaterThan(0);
    });

    describe("normalizeIconValue (back-compat)", () => {
        it("maps a bare string to { library: default, name }", () => {
            expect(normalizeIconValue("home")).toEqual({ library: DEFAULT_ICON_LIBRARY, name: "home" });
        });

        it("supports the 'library:name' shorthand string", () => {
            expect(normalizeIconValue("lucide:user")).toEqual({ library: "lucide", name: "user" });
        });

        it("fills the default library when an object omits it", () => {
            expect(normalizeIconValue({ name: "check" })).toEqual({ library: DEFAULT_ICON_LIBRARY, name: "check" });
        });

        it("preserves an explicit library on an object", () => {
            expect(normalizeIconValue({ library: "lucide", name: "x" })).toEqual({ library: "lucide", name: "x" });
        });

        it("returns undefined for empty / nullish input", () => {
            expect(normalizeIconValue("")).toBeUndefined();
            expect(normalizeIconValue(undefined)).toBeUndefined();
            expect(normalizeIconValue(null)).toBeUndefined();
        });
    });

    describe("iconFieldSchema (binding-capable)", () => {
        it("accepts a bare string (literal back-compat)", () => {
            expect(iconFieldSchema.safeParse("home").success).toBe(true);
        });

        it("accepts a literal { library, name } object", () => {
            expect(iconFieldSchema.safeParse({ library: "lucide", name: "user" }).success).toBe(true);
        });

        it("accepts a dynamic binding object", () => {
            expect(iconFieldSchema.safeParse({ kind: "state", path: "ui.icon" }).success).toBe(true);
        });

        it("rejects an object that is neither an icon value nor a binding", () => {
            expect(iconFieldSchema.safeParse({ foo: "bar" }).success).toBe(false);
        });
    });

    describe("icon fields on nodes", () => {
        it("ui-button accepts an icon field ({library,name})", () => {
            const result = validateUiNodeDefinition({
                type: "ui-button",
                id: "btn1",
                mount: "route:/customers/content",
                label: "Add",
                icon: { library: "default", name: "plus" }
            });
            expect(result.success).toBe(true);
        });

        it("ui-button accepts a bare-string icon (back-compat)", () => {
            const result = validateUiNodeDefinition({
                type: "ui-button",
                id: "btn2",
                mount: "route:/customers/content",
                label: "Add",
                icon: "plus"
            });
            expect(result.success).toBe(true);
        });

        it("ui-button accepts a dynamic icon binding", () => {
            const result = validateUiNodeDefinition({
                type: "ui-button",
                id: "btn3",
                mount: "route:/customers/content",
                label: "Add",
                icon: { kind: "state", path: "ui.btnIcon" }
            });
            expect(result.success).toBe(true);
        });

        it("ui-avatar accepts an icon fallback field", () => {
            const result = validateUiNodeDefinition({
                type: "ui-avatar",
                id: "av1",
                mount: "route:/customers/content",
                icon: { library: "default", name: "person" }
            });
            expect(result.success).toBe(true);
        });

        it("ui-icon accepts an { library, name } icon value", () => {
            const result = validateUiNodeDefinition({
                type: "ui-icon",
                id: "icon3",
                mount: "route:/customers/content",
                icon: { library: "lucide", name: "home" }
            });
            expect(result.success).toBe(true);
        });

        it("ui-icon still accepts a bare-string icon name (back-compat)", () => {
            const result = validateUiNodeDefinition({
                type: "ui-icon",
                id: "icon4",
                mount: "route:/customers/content",
                icon: "home"
            });
            expect(result.success).toBe(true);
        });

        it("ui-icon rejects an empty icon name in object form", () => {
            const result = validateUiNodeDefinition({
                type: "ui-icon",
                id: "icon5",
                mount: "route:/customers/content",
                icon: { library: "lucide", name: "" }
            });
            expect(result.success).toBe(false);
        });
    });
});

describe("P71: component fields — size, outline, button link mode + slots", () => {
    const mount = "route:/customers/content";

    describe("size (sm/md/lg) on the three-size nodes", () => {
        const sizedCases: Array<[string, Record<string, unknown>]> = [
            ["ui-button", { type: "ui-button", id: "b", mount, label: "Save" }],
            ["ui-text", { type: "ui-text", id: "t", mount, value: { kind: "literal", value: "Hi" } }],
            ["ui-input", { type: "ui-input", id: "i", mount, label: "Name", value: { kind: "literal", value: "" } }],
            ["ui-select", { type: "ui-select", id: "s", mount, label: "Pick", value: { kind: "literal", value: "" } }],
            ["ui-textarea", { type: "ui-textarea", id: "ta", mount, label: "Notes", value: { kind: "literal", value: "" } }]
        ];

        for (const [type, base] of sizedCases) {
            it(`${type} accepts size "md"`, () => {
                expect(validateUiNodeDefinition({ ...base, size: "md" }).success).toBe(true);
            });
            it(`${type} rejects an out-of-vocabulary size ("xl")`, () => {
                expect(validateUiNodeDefinition({ ...base, size: "xl" }).success).toBe(false);
            });
            it(`${type} is valid without a size (optional)`, () => {
                expect(validateUiNodeDefinition(base).success).toBe(true);
            });
        }

        it("ui-avatar keeps the richer xs..xl scale", () => {
            expect(validateUiNodeDefinition({
                type: "ui-avatar", id: "av", mount, size: "xl"
            }).success).toBe(true);
        });

        it("exposes the three-size vocabulary as a constant", () => {
            expect(COMPONENT_SIZES).toEqual(["sm", "md", "lg"]);
        });
    });

    describe("outline flag on ui-button", () => {
        it("accepts outline: true", () => {
            expect(validateUiNodeDefinition({
                type: "ui-button", id: "b1", mount, label: "Save", outline: true
            }).success).toBe(true);
        });
        it("accepts outline: false", () => {
            expect(validateUiNodeDefinition({
                type: "ui-button", id: "b2", mount, label: "Save", outline: false
            }).success).toBe(true);
        });
        it("rejects a non-boolean outline", () => {
            expect(validateUiNodeDefinition({
                type: "ui-button", id: "b3", mount, label: "Save", outline: "yes"
            }).success).toBe(false);
        });
    });

    describe("button link mode + href", () => {
        it("exposes the link-mode vocabulary as a constant", () => {
            expect(BUTTON_LINK_MODES).toEqual(["button", "url", "navigate"]);
        });
        it('accepts linkMode "button" with no href (default behaviour)', () => {
            expect(validateUiNodeDefinition({
                type: "ui-button", id: "lb1", mount, label: "Go", linkMode: "button"
            }).success).toBe(true);
        });
        it('accepts linkMode "url" with an href binding', () => {
            expect(validateUiNodeDefinition({
                type: "ui-button", id: "lb2", mount, label: "Docs",
                linkMode: "url", href: { kind: "literal", value: "https://example.com" }
            }).success).toBe(true);
        });
        it('accepts linkMode "navigate" with a route href', () => {
            expect(validateUiNodeDefinition({
                type: "ui-button", id: "lb3", mount, label: "Home",
                linkMode: "navigate", href: { kind: "literal", value: "/customers" }
            }).success).toBe(true);
        });
        it("rejects an unknown link mode", () => {
            expect(validateUiNodeDefinition({
                type: "ui-button", id: "lb4", mount, label: "Go", linkMode: "popup"
            }).success).toBe(false);
        });
    });
});

describe("P89: ui-route title as bindable field", () => {
    it("accepts a plain string title (back-compat)", () => {
        const result = validateUiNodeDefinition({
            type: "ui-route",
            id: "r1",
            uiId: "r1",
            path: "/customers",
            layout: "vertical",
            title: "Customers"
        });
        expect(result.success).toBe(true);
    });

    it("accepts a literal binding for title", () => {
        const result = validateUiNodeDefinition({
            type: "ui-route",
            id: "r2",
            uiId: "r2",
            path: "/customers",
            layout: "vertical",
            title: { kind: "literal", value: "Customers" }
        });
        expect(result.success).toBe(true);
    });

    it("accepts a state binding for title", () => {
        const result = validateUiNodeDefinition({
            type: "ui-route",
            id: "r3",
            uiId: "r3",
            path: "/customers",
            layout: "vertical",
            title: { kind: "state", path: "app.title" }
        });
        expect(result.success).toBe(true);
    });

    it("accepts a store binding for title", () => {
        const result = validateUiNodeDefinition({
            type: "ui-route",
            id: "r4",
            uiId: "r4",
            path: "/customers",
            layout: "vertical",
            title: { kind: "store", path: "myStoreId" }
        });
        expect(result.success).toBe(true);
    });

    it("accepts a routeParam binding for title", () => {
        const result = validateUiNodeDefinition({
            type: "ui-route",
            id: "r5",
            uiId: "r5",
            path: "/items/:id",
            layout: "vertical",
            title: { kind: "routeParam", path: "id" }
        });
        expect(result.success).toBe(true);
    });

    it("accepts a msg binding for title", () => {
        const result = validateUiNodeDefinition({
            type: "ui-route",
            id: "r6",
            uiId: "r6",
            path: "/customers",
            layout: "vertical",
            title: { kind: "msg", path: "payload.title" }
        });
        expect(result.success).toBe(true);
    });

    it("accepts no title (optional)", () => {
        const result = validateUiNodeDefinition({
            type: "ui-route",
            id: "r7",
            uiId: "r7",
            path: "/customers",
            layout: "vertical"
        });
        expect(result.success).toBe(true);
    });

    it("rejects a binding with no path (dynamic kind without path)", () => {
        const result = validateUiNodeDefinition({
            type: "ui-route",
            id: "r8",
            uiId: "r8",
            path: "/customers",
            layout: "vertical",
            title: { kind: "state" }
        });
        expect(result.success).toBe(false);
    });
});

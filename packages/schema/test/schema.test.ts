import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
    bindingSchema,
    errorContextSchema,
    errorOriginSchema,
    errorSeveritySchema,
    structuredErrorSchema,
    customersCrudAppModelFixture,
    customersCrudExampleFlowFixture,
    customersCrudNodeSetFixture,
    customersCrudRuntimeIntegrationFixture,
    fixtureAppModels,
    navigationDefinitionSchema,
    parseMountReference,
    resolveMountReference,
    routeNodePathSchema,
    runtimeIntegrationModelSchema,
    storeOperationSchema,
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
            title: "Achtung",
            dismissible: true
        });

        expect(result.success).toBe(true);
    });

    it("rejects ui-alert without mount or parent", () => {
        const result = validateUiNodeDefinition({
            type: "ui-alert",
            id: "alert1",
            message: { kind: "state", path:"alerts.current" }
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
        const result = validateUiNodeDefinition({
            type: "ui-badge",
            id: "badge1",
            mount: "route:/customers/content",
            value: { kind: "state", path:"notifications.count" },
            variant: "count",
            // P49b: "error" was a legacy value removed from the severity enum;
            // the canonical value is "danger" (maps to the same Shoelace output).
            severity: "danger",
            max: 99
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

    it("compiles ui-breadcrumb with static items", () => {
        const result = validateUiNodeDefinition({
            type: "ui-breadcrumb",
            id: "bc1",
            mount: "route:/customers/header",
            items: [
                { label: "Home", path: "/" },
                { label: "Customers", path: "/customers" }
            ]
        });

        expect(result.success).toBe(true);
    });

    it("compiles ui-breadcrumb with binding", () => {
        const result = validateUiNodeDefinition({
            type: "ui-breadcrumb",
            id: "bc1",
            mount: "route:/customers/header",
            items: { kind: "state", path: "nav.breadcrumb" }
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
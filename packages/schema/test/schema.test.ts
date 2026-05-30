import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
    customersCrudAppModelFixture,
    customersCrudExampleFlowFixture,
    customersCrudNodeSetFixture,
    customersCrudRuntimeIntegrationFixture,
    fixtureAppModels,
    parseMountReference,
    resolveMountReference,
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

        expect(invalidLayout.error).toContain("Invalid input");
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

    it("accepts typed ui-actions for path and out-port targets", () => {
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

    it("rejects typed ui-actions without a target mode", () => {
        const validation = validateUiNodeDefinition({
            type: "ui-action",
            id: "hideToolbar",
            actionType: "hide"
        });

        expect(validation.success).toBe(false);

        if (validation.success) {
            return;
        }

        expect(validation.error).toContain("target mode");
    });

    it("rejects path-targeted ui-actions without a target", () => {
        const validation = validateUiNodeDefinition({
            type: "ui-action",
            id: "hideToolbar",
            actionType: "hide",
            targetMode: "path"
        });

        expect(validation.success).toBe(false);

        if (validation.success) {
            return;
        }

        expect(validation.error).toContain("must declare a target");
    });

    it("rejects out-port ui-actions with direct targets", () => {
        const validation = validateUiNodeDefinition({
            type: "ui-action",
            id: "triggerRefresh",
            actionType: "trigger",
            targetMode: "out-port",
            target: "route:/customers/content/toolbar"
        });

        expect(validation.success).toBe(false);

        if (validation.success) {
            return;
        }

        expect(validation.error).toContain("must not declare a direct target");
    });

    it("rejects target modes without typed actions", () => {
        const validation = validateUiNodeDefinition({
            type: "ui-action",
            id: "orphanTargetMode",
            targetMode: "path",
            target: "route:/customers/content/toolbar"
        });

        expect(validation.success).toBe(false);

        if (validation.success) {
            return;
        }

        expect(validation.error).toContain("require an action type");
    });

    it("rejects navigate ui-actions without a destination", () => {
        const validation = validateUiNodeDefinition({
            type: "ui-action",
            id: "goToCustomers",
            actionType: "navigate",
            targetMode: "out-port"
        });

        expect(validation.success).toBe(false);

        if (validation.success) {
            return;
        }

        expect(validation.error).toContain("must declare a destination");
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
            severity: "error",
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
});
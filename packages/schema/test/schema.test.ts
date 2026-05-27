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
        const layoutMountResult = resolveMountReference("layout:dialogFormLayout/actions", customersCrudAppModelFixture);

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
            expect(layoutMountResult.data.targetId).toBe("dialogFormLayout");
            expect(layoutMountResult.data.regionPath).toEqual(["actions"]);
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
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test.describe("P35: Generator prop hygiene — layout-aware placement props", () => {
    test("examples/customers-crud/flow.json: no stray placement props on non-grid nodes", async () => {
        // Load the generated example flow
        const flowPath = resolve(
            __dirname,
            "../../examples/customers-crud/flow.json"
        );
        const flow = JSON.parse(readFileSync(flowPath, "utf8"));

        const expectedLayouts: Record<string, string> = {
            routeHome: "vertical",
            customers: "vertical",
            customerDetail: "vertical",
            customerEditor: "vertical"
        };

        const placementPropNames = ["row", "col", "colSize", "rowSize", "layoutX", "layoutY"];
        let gridPropsCount = 0;
        let violations: string[] = [];

        for (const node of flow) {
            if (node.type.startsWith("ui-") && node.mount) {
                // Determine expected layout
                let expectedLayout: string | undefined;

                if (node.mount.startsWith("layout:")) {
                    const match = node.mount.match(/^layout:(\w+)\//);
                    expectedLayout = match ? match[1] : undefined;
                } else if (node.mount.includes("/")) {
                    const parts = node.mount.split("/");
                    const target = parts[0];
                    expectedLayout = expectedLayouts[target];
                } else {
                    expectedLayout = expectedLayouts[node.mount];
                }

                // Check for stray placement props
                const hasGridProps = placementPropNames
                    .filter(p => p in node && ["row", "col", "colSize", "rowSize"].includes(p))
                    .length > 0;
                const hasAbsoluteProps = ["layoutX", "layoutY"].some(p => p in node);

                if (expectedLayout === "grid") {
                    if (hasGridProps) gridPropsCount++;
                    if (hasAbsoluteProps) {
                        violations.push(
                            `${node.id} (grid): has stray absolute props`
                        );
                    }
                } else if (expectedLayout === "absolute") {
                    if (hasAbsoluteProps) {
                        violations.push(
                            `${node.id} (absolute): has stray absolute props`
                        );
                    }
                    if (hasGridProps) {
                        violations.push(
                            `${node.id} (absolute): has stray grid props`
                        );
                    }
                } else {
                    // vertical/horizontal/app should have NO placement props
                    if (hasGridProps) {
                        violations.push(
                            `${node.id} (${expectedLayout}): has stray grid props`
                        );
                    }
                    if (hasAbsoluteProps) {
                        violations.push(
                            `${node.id} (${expectedLayout}): has stray absolute props`
                        );
                    }
                }
            }
        }

        expect(violations).toEqual([]);
        expect(gridPropsCount).toBe(5); // Verify grid nodes still have their props
    });
});

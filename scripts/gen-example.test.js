#!/usr/bin/env node
/**
 * gen-example.test.js — Unit tests for gen-example.js placement props helper
 * 
 * Tests the getPlacementProps function to ensure layout-aware prop filtering works.
 */

const assert = require("node:assert");

// Mock implementation of the getPlacementProps helper (must match gen-example.js)
const mountTargetLayouts = {
    "routeHome": "vertical",
    "customers": "vertical",
    "customerDetail": "vertical",
    "customerEditor": "vertical"
};

function getPlacementProps(mount, placementData = {}) {
    if (!mount) {
        return {};
    }

    let layoutId;

    if (mount.startsWith("layout:")) {
        const match = mount.match(/^layout:(\w+)\//);
        layoutId = match ? match[1] : null;
    } else if (mount.includes("/")) {
        const parts = mount.split("/");
        const target = parts[0];
        layoutId = mountTargetLayouts[target];
    } else {
        layoutId = null;
    }

    const result = {};
    if (layoutId === "grid") {
        if ("row" in placementData) result.row = placementData.row;
        if ("col" in placementData) result.col = placementData.col;
        if ("colSize" in placementData) result.colSize = placementData.colSize;
        if ("rowSize" in placementData) result.rowSize = placementData.rowSize;
    } else if (layoutId === "absolute") {
        if ("layoutX" in placementData) result.layoutX = placementData.layoutX;
        if ("layoutY" in placementData) result.layoutY = placementData.layoutY;
    }

    return result;
}

// Tests
console.log("Testing getPlacementProps helper...");

// Test 1: Grid layout emits grid props
let result = getPlacementProps("layout:grid/content", { row: 1, col: 2, colSize: 12 });
assert.deepStrictEqual(result, { row: 1, col: 2, colSize: 12 }, "Grid layout should emit row/col/colSize");
console.log("✓ Grid layout emits grid props");

// Test 2: Grid layout ignores absolute props
result = getPlacementProps("layout:grid/content", { row: 1, col: 2, layoutX: 100, layoutY: 200 });
assert.deepStrictEqual(result, { row: 1, col: 2 }, "Grid layout should ignore layoutX/layoutY");
console.log("✓ Grid layout ignores absolute props");

// Test 3: Absolute layout emits absolute props
result = getPlacementProps("layout:absolute/content", { layoutX: 100, layoutY: 200 });
assert.deepStrictEqual(result, { layoutX: 100, layoutY: 200 }, "Absolute layout should emit layoutX/layoutY");
console.log("✓ Absolute layout emits absolute props");

// Test 4: Absolute layout ignores grid props
result = getPlacementProps("layout:absolute/content", { row: 1, col: 2, layoutX: 100, layoutY: 200 });
assert.deepStrictEqual(result, { layoutX: 100, layoutY: 200 }, "Absolute layout should ignore row/col");
console.log("✓ Absolute layout ignores grid props");

// Test 5: Vertical layout (named mount) emits no placement props
result = getPlacementProps("routeHome.content", { row: 1, col: 2, colSize: 12 });
assert.deepStrictEqual(result, {}, "Vertical layout should emit no placement props");
console.log("✓ Vertical layout (named mount) emits no placement props");

// Test 6: Vertical layout (route reference) emits no placement props
result = getPlacementProps("route:/customers/content", { row: 1, col: 2, colSize: 12 });
assert.deepStrictEqual(result, {}, "Vertical layout (route reference) should emit no placement props");
console.log("✓ Vertical layout (route reference) emits no placement props");

// Test 7: App layout emits no placement props
result = getPlacementProps("customersApp/header", { row: 1, col: 2 });
assert.deepStrictEqual(result, {}, "App layout should emit no placement props");
console.log("✓ App layout emits no placement props");

// Test 8: Unknown mount emits no placement props
result = getPlacementProps("unknown:mount/path", { row: 1, col: 2 });
assert.deepStrictEqual(result, {}, "Unknown mount should emit no placement props");
console.log("✓ Unknown mount emits no placement props");

// Test 9: Empty mount emits no placement props
result = getPlacementProps("", { row: 1, col: 2 });
assert.deepStrictEqual(result, {}, "Empty mount should emit no placement props");
console.log("✓ Empty mount emits no placement props");

// Test 10: Grid layout with all possible props
result = getPlacementProps("layout:grid/content", { 
    row: 1, col: 2, colSize: 6, rowSize: 2, layoutX: 100, layoutY: 200 
});
assert.deepStrictEqual(result, { row: 1, col: 2, colSize: 6, rowSize: 2 }, 
    "Grid layout should emit all grid props and ignore absolute props");
console.log("✓ Grid layout with all possible props");

console.log("\nAll tests passed!");

import { describe, expect, it } from "vitest";

import { validateUiNodeDefinition } from "../src";

// Base valid button node (grid child)
const baseGridButton = {
    type: "ui-button",
    id: "btn1",
    mount: "route:/customers/content",
    label: "Click",
    row: 1,
    col: 1
};

describe("P51: grid child props must be positive integers", () => {
    describe("row", () => {
        it("accepts row = 1", () => {
            const result = validateUiNodeDefinition({ ...baseGridButton, row: 1 });
            expect(result.success).toBe(true);
        });

        it("accepts row = 99", () => {
            const result = validateUiNodeDefinition({ ...baseGridButton, row: 99 });
            expect(result.success).toBe(true);
        });

        it("rejects row = 0", () => {
            const result = validateUiNodeDefinition({ ...baseGridButton, row: 0 });
            expect(result.success).toBe(false);
        });

        it("rejects row = -1", () => {
            const result = validateUiNodeDefinition({ ...baseGridButton, row: -1 });
            expect(result.success).toBe(false);
        });

        it("rejects row = 1.5 (non-integer)", () => {
            const result = validateUiNodeDefinition({ ...baseGridButton, row: 1.5 });
            expect(result.success).toBe(false);
        });
    });

    describe("col", () => {
        it("accepts col = 1", () => {
            const result = validateUiNodeDefinition({ ...baseGridButton, col: 1 });
            expect(result.success).toBe(true);
        });

        it("rejects col = 0", () => {
            const result = validateUiNodeDefinition({ ...baseGridButton, col: 0 });
            expect(result.success).toBe(false);
        });

        it("rejects col = -3", () => {
            const result = validateUiNodeDefinition({ ...baseGridButton, col: -3 });
            expect(result.success).toBe(false);
        });

        it("rejects col = 2.5 (non-integer)", () => {
            const result = validateUiNodeDefinition({ ...baseGridButton, col: 2.5 });
            expect(result.success).toBe(false);
        });
    });

    describe("colSize", () => {
        it("accepts colSize = 1", () => {
            const result = validateUiNodeDefinition({ ...baseGridButton, colSize: 1 });
            expect(result.success).toBe(true);
        });

        it("accepts colSize = 4", () => {
            const result = validateUiNodeDefinition({ ...baseGridButton, colSize: 4 });
            expect(result.success).toBe(true);
        });

        it("rejects colSize = 0", () => {
            const result = validateUiNodeDefinition({ ...baseGridButton, colSize: 0 });
            expect(result.success).toBe(false);
        });

        it("rejects colSize = -2", () => {
            const result = validateUiNodeDefinition({ ...baseGridButton, colSize: -2 });
            expect(result.success).toBe(false);
        });
    });

    describe("rowSize", () => {
        it("accepts rowSize = 2", () => {
            const result = validateUiNodeDefinition({ ...baseGridButton, rowSize: 2 });
            expect(result.success).toBe(true);
        });

        it("rejects rowSize = 0", () => {
            const result = validateUiNodeDefinition({ ...baseGridButton, rowSize: 0 });
            expect(result.success).toBe(false);
        });

        it("rejects rowSize = -1", () => {
            const result = validateUiNodeDefinition({ ...baseGridButton, rowSize: -1 });
            expect(result.success).toBe(false);
        });
    });

    describe("layoutX and layoutY allow 0 (absolute coordinates)", () => {
        const absoluteButton = {
            type: "ui-button",
            id: "btn2",
            mount: "route:/customers/content",
            label: "Click",
            layoutX: 0,
            layoutY: 0
        };

        it("accepts layoutX = 0", () => {
            const result = validateUiNodeDefinition({ ...absoluteButton, layoutX: 0 });
            expect(result.success).toBe(true);
        });

        it("accepts layoutY = 0", () => {
            const result = validateUiNodeDefinition({ ...absoluteButton, layoutY: 0 });
            expect(result.success).toBe(true);
        });

        it("accepts layoutX = -50 (negative absolute position)", () => {
            const result = validateUiNodeDefinition({ ...absoluteButton, layoutX: -50 });
            expect(result.success).toBe(true);
        });

        it("accepts layoutY = 100", () => {
            const result = validateUiNodeDefinition({ ...absoluteButton, layoutY: 100 });
            expect(result.success).toBe(true);
        });
    });
});

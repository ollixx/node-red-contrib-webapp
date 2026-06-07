import { describe, expect, it } from "vitest";

import { customersCrudAppModelFixture, customersCrudRuntimeIntegrationFixture } from "@node-red-contrib-webapp/schema";

import { createRendererApp } from "../src";

/**
 * P64 — the renderer carries the dialog's `closable` flag through to the
 * RenderedDialog so the serializer / client can render a native <sl-dialog>
 * with (or without) the native header/X.
 */
describe("P64: renderer dialog closable passthrough", () => {
    function renderWithDialogOpen() {
        const app = createRendererApp(customersCrudAppModelFixture, {
            integration: customersCrudRuntimeIntegrationFixture,
            location: "/customers",
            state: { ui: { dialogs: { customerEditor: { open: true } } } },
            queries: {}
        });
        return app.render();
    }

    it("includes closable on the rendered dialog (fixture dialog is closable)", () => {
        const snapshot = renderWithDialogOpen();
        const dialog = snapshot.dialogs.find((entry) => entry.id === "customerEditor");

        expect(dialog).toBeDefined();
        expect(dialog?.closable).toBe(true);
    });

    it("uses the dialog layout preset for the fixture dialog", () => {
        const snapshot = renderWithDialogOpen();
        const dialog = snapshot.dialogs.find((entry) => entry.id === "customerEditor");
        expect(dialog?.layoutId).toBe("dialog");
    });
});

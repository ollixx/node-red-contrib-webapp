import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

function workspacePath(relativePath: string): string {
    return fileURLToPath(new URL(relativePath, import.meta.url));
}

export default defineConfig({
    resolve: {
        alias: {
            "@node-red-contrib-webapp/schema": workspacePath("./packages/schema/src/index.ts"),
            "@node-red-contrib-webapp/runtime": workspacePath("./packages/runtime/src/index.ts"),
            "@node-red-contrib-webapp/renderer": workspacePath("./packages/renderer/src/index.ts"),
            "@node-red-contrib-webapp/editor": workspacePath("./packages/editor/src/index.ts")
        }
    },
    test: {
        environment: "node",
        passWithNoTests: true
    }
});

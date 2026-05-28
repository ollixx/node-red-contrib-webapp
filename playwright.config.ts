import { defineConfig } from "@playwright/test";

export default defineConfig({
    testDir: "./tests/e2e",
    fullyParallel: false,
    workers: 1,
    use: {
        baseURL: "http://127.0.0.1:1882"
    },
    webServer: {
        command: "rm -rf .node-red-e2e && mkdir -p .node-red-e2e/node_modules && cp .node-red-dev/settings.js .node-red-e2e/settings.js && cp examples/customers-crud/flow.json .node-red-e2e/flows.json && ln -sfn ../.. .node-red-e2e/node_modules/node-red-contrib-webapp && node-red --userDir .node-red-e2e --port 1882 >/tmp/node-red-webapp-playwright.log 2>&1",
        url: "http://127.0.0.1:1882",
        reuseExistingServer: false,
        timeout: 120000
    },
    projects: [
        {
            name: "chromium",
            use: {
                browserName: "chromium"
            }
        }
    ]
});
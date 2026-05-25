import { defineConfig } from "@playwright/test";

export default defineConfig({
    testDir: "./tests/e2e",
    fullyParallel: false,
    use: {
        baseURL: "http://127.0.0.1:1881"
    },
    webServer: {
        command: "cp examples/customers-crud/flow.json .node-red-dev/flows.json && node-red --userDir .node-red-dev --port 1881 >/tmp/node-red-webapp-playwright.log 2>&1",
        url: "http://127.0.0.1:1881",
        reuseExistingServer: true,
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
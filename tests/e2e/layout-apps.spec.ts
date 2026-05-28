import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

type FlowNode = Record<string, unknown>;

async function loadCustomersFlowFixture(): Promise<FlowNode[]> {
    const fixturePath = path.resolve(process.cwd(), "examples/customers-crud/flow.json");
    const fixtureContent = await readFile(fixturePath, "utf8");
    return JSON.parse(fixtureContent) as FlowNode[];
}

function createLayoutDemoNodes(): FlowNode[] {
    return [
        {
            id: "flowLayoutDemos",
            type: "tab",
            label: "Layout demos",
            disabled: false,
            info: ""
        },
        {
            id: "layoutVerticalApp",
            type: "ui-app",
            name: "Vertical Layout Demo",
            title: "Vertical Layout Demo",
            root: "layoutVerticalApp",
            layout: "vertical",
            z: "flowLayoutDemos",
            wires: [[]]
        },
        {
            id: "layoutVerticalTextOne",
            type: "ui-text",
            mount: "layoutVerticalApp.content",
            order: 0,
            value: {
                kind: "literal",
                value: "Vertical item 1"
            },
            z: "flowLayoutDemos",
            wires: [[]]
        },
        {
            id: "layoutVerticalTextTwo",
            type: "ui-text",
            mount: "layoutVerticalApp.content",
            order: 1,
            value: {
                kind: "literal",
                value: "Vertical item 2"
            },
            z: "flowLayoutDemos",
            wires: [[]]
        },
        {
            id: "layoutVerticalTextThree",
            type: "ui-text",
            mount: "layoutVerticalApp.content",
            order: 2,
            value: {
                kind: "literal",
                value: "Vertical item 3"
            },
            z: "flowLayoutDemos",
            wires: [[]]
        },
        {
            id: "layoutHorizontalApp",
            type: "ui-app",
            name: "Horizontal Layout Demo",
            title: "Horizontal Layout Demo",
            root: "layoutHorizontalApp",
            layout: "horizontal",
            z: "flowLayoutDemos",
            wires: [[]]
        },
        {
            id: "layoutHorizontalTextOne",
            type: "ui-text",
            mount: "layoutHorizontalApp.content",
            order: 0,
            value: {
                kind: "literal",
                value: "Horizontal item 1"
            },
            z: "flowLayoutDemos",
            wires: [[]]
        },
        {
            id: "layoutHorizontalTextTwo",
            type: "ui-text",
            mount: "layoutHorizontalApp.content",
            order: 1,
            value: {
                kind: "literal",
                value: "Horizontal item 2"
            },
            z: "flowLayoutDemos",
            wires: [[]]
        },
        {
            id: "layoutHorizontalTextThree",
            type: "ui-text",
            mount: "layoutHorizontalApp.content",
            order: 2,
            value: {
                kind: "literal",
                value: "Horizontal item 3"
            },
            z: "flowLayoutDemos",
            wires: [[]]
        },
        {
            id: "layoutAppShellDemo",
            type: "ui-app",
            name: "App Layout Demo",
            title: "App Layout Demo",
            root: "layoutAppShellDemo",
            layout: "app",
            z: "flowLayoutDemos",
            wires: [[]]
        },
        {
            id: "layoutAppHeaderText",
            type: "ui-text",
            mount: "layoutAppShellDemo.header",
            order: 0,
            value: {
                kind: "literal",
                value: "App header"
            },
            z: "flowLayoutDemos",
            wires: [[]]
        },
        {
            id: "layoutAppNavbarText",
            type: "ui-text",
            mount: "layoutAppShellDemo.navbar",
            order: 0,
            value: {
                kind: "literal",
                value: "App navigation"
            },
            z: "flowLayoutDemos",
            wires: [[]]
        },
        {
            id: "layoutAppContentText",
            type: "ui-text",
            mount: "layoutAppShellDemo.content",
            order: 0,
            value: {
                kind: "literal",
                value: "App content"
            },
            z: "flowLayoutDemos",
            wires: [[]]
        }
    ];
}

async function deployFlow(request: Parameters<typeof test>[0]["request"], flow: FlowNode[]): Promise<void> {
    const response = await request.post("/flows", {
        data: flow
    });
    expect(response.ok()).toBeTruthy();
}

test.describe("layout preset rendering", () => {
    let baselineFlow: FlowNode[];
    let demoFlow: FlowNode[];

    test.beforeAll(async () => {
        baselineFlow = await loadCustomersFlowFixture();
        demoFlow = [...baselineFlow, ...createLayoutDemoNodes()];
    });

    test.beforeEach(async ({ request }) => {
        await deployFlow(request, demoFlow);
    });

    test.afterEach(async ({ request }) => {
        await deployFlow(request, baselineFlow);
    });

    test("renders vertical, horizontal and app layouts as modeled", async ({ page }) => {
        await page.goto("/webapp/layoutVerticalApp");
        await expect(page.locator(".webapp-slot-body.webapp-slot-body--vertical")).toHaveCount(1);
        await expect(page.locator("text=Vertical item 1")).toBeVisible();
        await expect(page.locator("text=Vertical item 2")).toBeVisible();
        await expect(page.locator("text=Vertical item 3")).toBeVisible();

        await page.goto("/webapp/layoutHorizontalApp");
        await expect(page.locator(".webapp-slot-body.webapp-slot-body--horizontal")).toHaveCount(1);
        await expect(page.locator("text=Horizontal item 1")).toBeVisible();
        await expect(page.locator("text=Horizontal item 2")).toBeVisible();
        await expect(page.locator("text=Horizontal item 3")).toBeVisible();

        await page.goto("/webapp/layoutAppShellDemo");
        await expect(page.locator(".webapp-layout.webapp-layout--app")).toHaveCount(1);
        await expect(page.locator(".webapp-slot--header .webapp-text")).toHaveText("App header");
        await expect(page.locator(".webapp-slot--navbar .webapp-text")).toHaveText("App navigation");
        await expect(page.locator(".webapp-slot--content .webapp-text")).toHaveText("App content");
    });
});
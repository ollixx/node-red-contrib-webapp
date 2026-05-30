import { expect, test } from "@playwright/test";

test.describe("P15: Multi-user and client persistence — editor", () => {
    test("ui-store registered type has persist default set to false", async ({ page }) => {
        await page.goto("/");
        await page.waitForLoadState("networkidle");

        const result = await page.evaluate(() => {
            const typeDef = (RED.nodes as unknown as {
                getType: (type: string) => {
                    defaults?: Record<string, { value: unknown }>;
                } | undefined
            }).getType?.("ui-store");

            if (!typeDef?.defaults) return { error: "no type def" };

            return {
                hasPersist: "persist" in typeDef.defaults,
                persistDefault: typeDef.defaults.persist?.value
            };
        });

        expect(result.hasPersist).toBe(true);
        expect(result.persistDefault).toBe(false);
    });

    test("ui-store editor HTML contains persist checkbox", async ({ page }) => {
        await page.goto("/");
        await page.waitForLoadState("networkidle");

        const html = await page.evaluate(() => {
            const template = document.querySelector("script[data-template-name='ui-store']");
            return template ? template.innerHTML : null;
        });

        expect(html).not.toBeNull();
        expect(html).toContain("node-input-persist");
        expect(html).toContain('type="checkbox"');
    });
});

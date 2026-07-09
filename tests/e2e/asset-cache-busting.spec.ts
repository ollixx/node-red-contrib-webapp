import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../helpers/admin-api";
import { FlowBuilder } from "../helpers/flow-builder";

/**
 * The thin-client assets (webapp-client.js / webapp-serializer.js) are served by
 * the static resource handler with only a weak ETag and no Cache-Control, so a
 * browser could keep an OLD client after a runtime update until a hard-refresh
 * (the owner hit exactly this). The app page must reference them with a
 * content-hash cache-busting query (`?v=<hash>`) so a normal reload re-fetches
 * when the bytes change.
 */

test.describe("client assets are cache-busted with a content-hash query", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("the app page references webapp-client.js and webapp-serializer.js with ?v=<hash>", async ({ request }) => {
        await deployFlow(request, new FlowBuilder().app({ id: "cbApp", root: "cbApp" }).build());

        const res = await request.get("/webapp/cbApp/");
        expect(res.ok()).toBeTruthy();
        const html = await res.text();

        // A non-empty hex hash query on both client assets.
        expect(html).toMatch(/webapp-client\.js\?v=[0-9a-f]{6,}/);
        expect(html).toMatch(/webapp-serializer\.js\?v=[0-9a-f]{6,}/);
    });
});

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow, type NodeDef } from "../helpers/admin-api";
import { WebappPage } from "../helpers/webapp-page";

/**
 * P265 (ADR 0042 §4) — guide-example smoke harness.
 *
 * Every importable user-guide example under `examples/guide/**.json` must
 * DEPLOY cleanly and RENDER: the flow is pushed via the admin API (the same
 * endpoint the editor's Deploy uses) and the app root must show content in a
 * real browser. The batches P267–P271 add one or more examples per node; each
 * lands in this harness automatically — no per-example test code needed.
 *
 * NOTE: `examples/guide/**` is HAND-AUTHORED (unlike `examples/<cat>/**`,
 * which `pnpm gen:node-examples` generates, and `examples/customers-crud/`,
 * which `pnpm gen:example` owns). This harness is what keeps the hand-authored
 * tree honest.
 *
 * Contract per example file:
 *   - it is a full Node-RED import flow (array incl. its `tab` node),
 *   - it contains at least one `ui-app`; EVERY app in the file must render
 *     non-empty root content at /webapp/<appId>/.
 */

const GUIDE_DIR = path.resolve(__dirname, "../../examples/guide");

function guideExamples(): string[] {
    const out: string[] = [];
    const walk = (dir: string) => {
        for (const e of readdirSync(dir, { withFileTypes: true })) {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) walk(p);
            else if (e.name.endsWith(".json")) out.push(p);
        }
    };
    walk(GUIDE_DIR);
    return out.sort();
}

const files = guideExamples();

test.describe("guide examples — every examples/guide/**.json deploys + renders (P265)", () => {
    test("the harness sees at least the pilot example", () => {
        expect(files.length).toBeGreaterThan(0);
    });

    for (const file of files) {
        const rel = path.relative(path.resolve(__dirname, "../.."), file);

        test(`${rel} deploys and renders`, async ({ page, request }) => {
            const flow = JSON.parse(readFileSync(file, "utf8")) as NodeDef[];
            expect(Array.isArray(flow), `${rel}: not a flow array`).toBe(true);

            const apps = flow.filter((n) => n.type === "ui-app");
            expect(apps.length, `${rel}: contains no ui-app`).toBeGreaterThan(0);

            await deployFlow(request, flow);
            try {
                for (const app of apps) {
                    const appId = String(app.uiId ?? app.id);
                    const webapp = new WebappPage(page, appId);
                    await webapp.navigate("/");
                    // Root content rendered: the client root holds at least one
                    // element and non-blank text/markup.
                    const root = webapp.root();
                    await expect(root, `${rel}: app ${appId} root empty`).not.toBeEmpty();
                    const children = await root.evaluate((el) => el.childElementCount);
                    expect(children, `${rel}: app ${appId} rendered no elements`).toBeGreaterThan(0);
                }
            } finally {
                await resetFlow(request);
            }
        });
    }
});

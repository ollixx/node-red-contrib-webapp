import { describe, expect, it } from "vitest";

import { customersCrudAppModelFixture, customersCrudRuntimeIntegrationFixture } from "@node-red-contrib-webapp/schema";

import { createRendererApp, findComponentInSnapshot } from "../src";

/**
 * P261 (ADR 0041 §3) — the `user` binding kind.
 *
 * The renderer resolves `user.id/name/email/groups` against the identity of the
 * REQUESTING client, supplied per snapshot build via `RendererAppOptions.user`
 * (webapp.js passes the auth guard's request identity, or the identity bound to
 * the SSE connection for re-renders). Without an identity (auth mode "none")
 * every `user` binding resolves undefined → fallback. Pattern mirrors the
 * routeParam binding-source tests.
 */

const ada = {
    id: "ada",
    name: "Ada Lovelace",
    email: "ada@example.com",
    groups: ["admin", "engineering"]
};

// A ui-text on /customers/:id whose `value` is a user binding.
function textWithUserBinding(path: string, fallback?: unknown) {
    return {
        ...customersCrudAppModelFixture,
        components: [
            ...customersCrudAppModelFixture.components,
            {
                id: "userText",
                kind: "text" as const,
                mount: "route:/customers/:id/content",
                bind: {
                    value: { kind: "user" as const, path, ...(fallback === undefined ? {} : { fallback }) }
                },
                props: {},
                events: []
            }
        ]
    };
}

function userText(app: ReturnType<typeof createRendererApp>) {
    const text = findComponentInSnapshot(app.render(), "userText");
    return text && "text" in text ? text.text : undefined;
}

describe("P261 user binding — resolution from the request identity", () => {
    it("user.name resolves the identity's display name", () => {
        const app = createRendererApp(textWithUserBinding("name"), {
            integration: customersCrudRuntimeIntegrationFixture,
            location: "/customers/42",
            user: ada
        });

        expect(userText(app)).toBe("Ada Lovelace");
    });

    it("user.id and user.email resolve their fields", () => {
        const idApp = createRendererApp(textWithUserBinding("id"), {
            integration: customersCrudRuntimeIntegrationFixture,
            location: "/customers/42",
            user: ada
        });
        const emailApp = createRendererApp(textWithUserBinding("email"), {
            integration: customersCrudRuntimeIntegrationFixture,
            location: "/customers/42",
            user: ada
        });

        expect(userText(idApp)).toBe("ada");
        expect(userText(emailApp)).toBe("ada@example.com");
    });

    it("user.groups resolves the raw string[] (structural access) — a single entry is addressable", () => {
        // groups as a whole is an array → the display normalizer would render
        // "?"; an indexed path proves the array is really there and walkable.
        const app = createRendererApp(textWithUserBinding("groups.0"), {
            integration: customersCrudRuntimeIntegrationFixture,
            location: "/customers/42",
            user: ada
        });

        expect(userText(app)).toBe("admin");
    });

    it("no identity (auth mode none) → undefined → fallback applies", () => {
        const app = createRendererApp(textWithUserBinding("name", "Gast"), {
            integration: customersCrudRuntimeIntegrationFixture,
            location: "/customers/42"
        });

        expect(userText(app)).toBe("Gast");
    });

    it("no identity and no fallback → the '?' invalid-display marker, never a throw", () => {
        const app = createRendererApp(textWithUserBinding("name"), {
            integration: customersCrudRuntimeIntegrationFixture,
            location: "/customers/42"
        });

        expect(userText(app)).toBe("?");
    });

    it("two renderer apps with different users resolve their OWN identity (no leak)", () => {
        const grace = { id: "grace", name: "Grace Hopper", groups: [] };
        const adaApp = createRendererApp(textWithUserBinding("name"), {
            integration: customersCrudRuntimeIntegrationFixture,
            location: "/customers/42",
            user: ada
        });
        const graceApp = createRendererApp(textWithUserBinding("name"), {
            integration: customersCrudRuntimeIntegrationFixture,
            location: "/customers/42",
            user: grace
        });

        expect(userText(adaApp)).toBe("Ada Lovelace");
        expect(userText(graceApp)).toBe("Grace Hopper");
    });
});

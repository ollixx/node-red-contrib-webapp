import { describe, expect, it } from "vitest";

import { userIdentitySchema, type UserIdentity } from "../src/index";

/**
 * P260 (ADR 0041 §1) — the ONE internal user-identity contract.
 *
 * Every auth source (trusted proxy headers today, OIDC later) maps into this
 * object; flows/bindings/guards only ever see `user`. Inert until P261 — no
 * runtime code produces or enforces a UserIdentity yet.
 */
describe("P260: userIdentitySchema", () => {
    it("accepts a full identity", () => {
        const parsed = userIdentitySchema.parse({
            id: "alice",
            name: "Alice Adams",
            email: "alice@example.com",
            groups: ["admin", "sales"]
        });
        expect(parsed).toEqual({
            id: "alice",
            name: "Alice Adams",
            email: "alice@example.com",
            groups: ["admin", "sales"]
        });
    });

    it("accepts the minimal identity (id only) and defaults groups to []", () => {
        const parsed = userIdentitySchema.parse({ id: "u1" });
        expect(parsed.id).toBe("u1");
        expect(parsed.name).toBeUndefined();
        expect(parsed.email).toBeUndefined();
        // groups always iterable without a presence check (ADR 0041 §1)
        expect(parsed.groups).toEqual([]);
    });

    it("rejects an empty id", () => {
        const result = userIdentitySchema.safeParse({ id: "" });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0].message).toMatch(/must not be empty/);
        }
    });

    it("rejects a missing id", () => {
        expect(userIdentitySchema.safeParse({}).success).toBe(false);
        expect(userIdentitySchema.safeParse({ name: "No Id" }).success).toBe(false);
    });

    it("rejects non-string group members", () => {
        expect(userIdentitySchema.safeParse({ id: "u1", groups: [42] }).success).toBe(false);
        expect(userIdentitySchema.safeParse({ id: "u1", groups: "admin" }).success).toBe(false);
    });

    it("rejects non-string id/name/email", () => {
        expect(userIdentitySchema.safeParse({ id: 7 }).success).toBe(false);
        expect(userIdentitySchema.safeParse({ id: "u1", name: 7 }).success).toBe(false);
        expect(userIdentitySchema.safeParse({ id: "u1", email: 7 }).success).toBe(false);
    });

    it("exports the UserIdentity type (groups is non-optional after parse)", () => {
        const u: UserIdentity = userIdentitySchema.parse({ id: "u1" });
        // type-level check: groups is a plain string[] on the parsed output
        const groups: string[] = u.groups;
        expect(groups).toEqual([]);
    });
});

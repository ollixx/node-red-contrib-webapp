import { describe, expect, it } from "vitest";

/**
 * P63 / ADR 0008 — self-hosted (vendored) Shoelace, strictly local, no CDN.
 *
 * Covers the vendor script's drift guard: SHOELACE_VERSION is the single source
 * of truth, and the script must FAIL HARD when the installed @shoelace-style/
 * shoelace version does not match it — so the pinned devDependency and the
 * version the runtime references (nodes/webapp.js) can never silently drift.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const vendor = require("../../../scripts/vendor-shoelace.js") as {
    SHOELACE_VERSION: string;
    assertVersionMatches: (installed: string, expected?: string) => void;
    readInstalledVersion: () => string;
};

describe("vendor-shoelace drift guard", () => {
    it("pins SHOELACE_VERSION to 2.20.1", () => {
        expect(vendor.SHOELACE_VERSION).toBe("2.20.1");
    });

    it("passes when the installed version matches SHOELACE_VERSION", () => {
        expect(() => vendor.assertVersionMatches("2.20.1", "2.20.1")).not.toThrow();
    });

    it("FAILS HARD when the installed Shoelace version != SHOELACE_VERSION", () => {
        expect(() => vendor.assertVersionMatches("2.19.0", "2.20.1")).toThrow(
            /version drift/i
        );
    });

    it("uses SHOELACE_VERSION as the default expected version", () => {
        expect(() => vendor.assertVersionMatches("9.9.9")).toThrow(/version drift/i);
    });

    it("the actually installed devDependency matches SHOELACE_VERSION", () => {
        // Guards against a future bump of the devDependency without updating the
        // constant (or vice versa).
        expect(vendor.readInstalledVersion()).toBe(vendor.SHOELACE_VERSION);
    });
});

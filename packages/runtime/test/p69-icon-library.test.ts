import { createRequire } from "node:module";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

/**
 * P69 — server-side icon library registry + manifest.
 *
 * Additional icon libraries can be registered globally (module level), shipped
 * locally, and exposed to the editor picker via a manifest. The default library
 * (the vendored Bootstrap-Icons set) is enumerated from the on-disk SVG dir.
 */

const require = createRequire(import.meta.url);

const iconLibrary = require("../../../nodes/icon-library.js") as {
    DEFAULT_ICON_LIBRARY: string;
    registerIconLibrary: (d: unknown) => unknown;
    getIconLibraries: () => Array<{ name: string; basePath: string; icons: string[] }>;
    clearIconLibraries: () => void;
    seedFromSettings: (s: unknown) => unknown[];
    listDefaultIconNames: (dir: string) => string[];
    buildIconManifest: (o?: unknown) => { libraries: Array<{ name: string; icons: string[] }> };
    buildIconLibraryRegistrationScript: () => string;
};

const ICONS_DIR = resolve(__dirname, "../../../resources/shoelace/assets/icons");

afterEach(() => {
    iconLibrary.clearIconLibraries();
});

describe("P69: icon library registry", () => {
    it("registers and lists a custom library", () => {
        iconLibrary.registerIconLibrary({ name: "lucide", basePath: "/icons/lucide", icons: ["home", "user"] });
        const libs = iconLibrary.getIconLibraries();
        expect(libs).toHaveLength(1);
        expect(libs[0].name).toBe("lucide");
        expect(libs[0].icons).toEqual(["home", "user"]);
    });

    it("rejects registering the reserved default library", () => {
        expect(() => iconLibrary.registerIconLibrary({ name: "default", basePath: "/x" })).toThrow();
    });

    it("rejects a descriptor without a name or basePath", () => {
        expect(() => iconLibrary.registerIconLibrary({ basePath: "/x" })).toThrow();
        expect(() => iconLibrary.registerIconLibrary({ name: "x" })).toThrow();
    });

    it("seeds the registry from RED settings", () => {
        iconLibrary.seedFromSettings({ webappIconLibraries: [{ name: "lucide", basePath: "/icons/lucide" }] });
        expect(iconLibrary.getIconLibraries().map((l) => l.name)).toContain("lucide");
    });
});

describe("P69: default library enumeration", () => {
    it("lists the vendored Bootstrap icon names from the SVG dir", () => {
        const names = iconLibrary.listDefaultIconNames(ICONS_DIR);
        expect(names.length).toBeGreaterThan(1000);
        // a couple of well-known Bootstrap-Icons names
        expect(names).toContain("house");
        expect(names).toContain("trash");
        // sorted + no .svg extension
        expect(names.every((n) => !n.endsWith(".svg"))).toBe(true);
    });

    it("returns [] for a missing directory (no throw)", () => {
        expect(iconLibrary.listDefaultIconNames("/no/such/dir")).toEqual([]);
    });
});

describe("P69: icon manifest", () => {
    it("always lists the default library first, populated from the SVG dir", () => {
        const manifest = iconLibrary.buildIconManifest({ iconsDir: ICONS_DIR });
        expect(manifest.libraries[0].name).toBe("default");
        expect(manifest.libraries[0].icons.length).toBeGreaterThan(1000);
    });

    it("includes registered libraries with their icon names", () => {
        iconLibrary.registerIconLibrary({ name: "lucide", basePath: "/icons/lucide", icons: ["home"] });
        const manifest = iconLibrary.buildIconManifest({ iconsDir: ICONS_DIR });
        const lucide = manifest.libraries.find((l) => l.name === "lucide");
        expect(lucide).toBeDefined();
        expect(lucide?.icons).toEqual(["home"]);
    });
});

describe("P69: client registration script", () => {
    it("is empty when only the default library exists", () => {
        expect(iconLibrary.buildIconLibraryRegistrationScript()).toBe("");
    });

    it("emits a registerIconLibrary call per custom library", () => {
        iconLibrary.registerIconLibrary({ name: "lucide", basePath: "/icons/lucide" });
        const script = iconLibrary.buildIconLibraryRegistrationScript();
        expect(script).toContain("registerIconLibrary");
        expect(script).toContain("lucide");
        expect(script).toContain("/icons/lucide");
    });
});

"use strict";

/**
 * P69 — Icon library registry + manifest (server side).
 *
 * The icon system is backend-neutral: a node stores an icon as { library, name }.
 * The DEFAULT library is the Bootstrap-Icons set vendored with Shoelace
 * (ADR 0008) and served as the autoloader's built-in / default-registered set —
 * it needs no client registration.
 *
 * Additional libraries are registered at MODULE level (once, globally):
 *  - on the server via {@link registerIconLibrary} (seedable from
 *    RED.settings.webappIconLibraries), and
 *  - on the client via Shoelace's registerIconLibrary() emitted into the page
 *    <head> by {@link buildIconLibraryRegistrationScript}.
 *
 * The picker dialog in the editor reads {@link buildIconManifest} (icon names
 * per library) via an HTTP endpoint.
 *
 * Library descriptor shape: { name, basePath, icons? }
 *  - name:     the library identifier used in { library, name } values.
 *  - basePath: the URL prefix under which "<basePath>/<icon>.svg" resolves.
 *  - icons:    optional explicit list of icon names (for the manifest). When
 *              omitted the manifest lists no names for that library (the picker
 *              still shows the library; names come from the client at render).
 */

const fs = require("fs");
const path = require("path");

const DEFAULT_ICON_LIBRARY = "default";

// Module-level registry. Keyed by library name; the default library is implicit
// (served by the autoloader) and is NOT stored here.
const registry = new Map();

function registerIconLibrary(descriptor) {
    if (!descriptor || typeof descriptor.name !== "string" || descriptor.name.length === 0) {
        throw new Error("registerIconLibrary requires a non-empty { name }.");
    }
    if (descriptor.name === DEFAULT_ICON_LIBRARY) {
        throw new Error(`The "${DEFAULT_ICON_LIBRARY}" icon library is reserved (the built-in set).`);
    }
    if (typeof descriptor.basePath !== "string" || descriptor.basePath.length === 0) {
        throw new Error("registerIconLibrary requires a non-empty { basePath }.");
    }
    const entry = {
        name: descriptor.name,
        basePath: descriptor.basePath.replace(/\/+$/, ""),
        icons: Array.isArray(descriptor.icons) ? descriptor.icons.slice() : []
    };
    registry.set(entry.name, entry);
    return entry;
}

function getIconLibraries() {
    return Array.from(registry.values()).map((entry) => ({
        name: entry.name,
        basePath: entry.basePath,
        icons: entry.icons.slice()
    }));
}

function clearIconLibraries() {
    registry.clear();
}

// Seed the registry from RED.settings.webappIconLibraries (an array of
// descriptors). Invalid entries are skipped (logged by the caller if desired).
function seedFromSettings(settings) {
    const libs = settings && Array.isArray(settings.webappIconLibraries)
        ? settings.webappIconLibraries
        : [];
    const seeded = [];
    for (const lib of libs) {
        try {
            seeded.push(registerIconLibrary(lib));
        }
        catch (error) {
            // Skip invalid descriptors; surface via the returned errors list.
            seeded.push({ error: String(error && error.message ? error.message : error) });
        }
    }
    return seeded;
}

// Enumerate the icon names of the vendored default (Bootstrap-Icons) set by
// reading the *.svg files in the given directory. Returns a sorted name list.
function listDefaultIconNames(iconsDir) {
    let files = [];
    try {
        files = fs.readdirSync(iconsDir);
    }
    catch (error) {
        return [];
    }
    return files
        .filter((file) => file.endsWith(".svg"))
        .map((file) => file.slice(0, -".svg".length))
        .sort();
}

/**
 * Build the icon manifest consumed by the editor picker:
 *   { libraries: [ { name, icons: [name, …] }, … ] }
 * The default library is always first, populated from the vendored SVG dir.
 */
function buildIconManifest(options) {
    const opts = options || {};
    const defaultIcons = opts.iconsDir ? listDefaultIconNames(opts.iconsDir) : [];
    const libraries = [
        { name: DEFAULT_ICON_LIBRARY, icons: defaultIcons }
    ];
    for (const entry of registry.values()) {
        libraries.push({ name: entry.name, icons: entry.icons.slice() });
    }
    return { libraries: libraries };
}

/**
 * Build the <script type="module"> that registers each non-default library on
 * the client via Shoelace's registerIconLibrary(). The default library is not
 * registered (the autoloader serves it). Returns "" when no libraries are
 * registered, so the page stays minimal.
 */
function buildIconLibraryRegistrationScript() {
    const libs = getIconLibraries();
    if (libs.length === 0) {
        return "";
    }
    const registrations = libs.map((lib) => {
        const name = JSON.stringify(lib.name);
        const base = JSON.stringify(lib.basePath);
        return `  registerIconLibrary(${name}, { resolver: function (n) { return ${base} + "/" + n + ".svg"; } });`;
    }).join("\n");
    return `<script type="module">\n`
        + `  import { registerIconLibrary } from "${"%AUTOLOADER_DIR%"}/utilities/icon-library.js";\n`
        + registrations
        + `\n</script>`;
}

module.exports = {
    DEFAULT_ICON_LIBRARY: DEFAULT_ICON_LIBRARY,
    registerIconLibrary: registerIconLibrary,
    getIconLibraries: getIconLibraries,
    clearIconLibraries: clearIconLibraries,
    seedFromSettings: seedFromSettings,
    listDefaultIconNames: listDefaultIconNames,
    buildIconManifest: buildIconManifest,
    buildIconLibraryRegistrationScript: buildIconLibraryRegistrationScript
};

#!/usr/bin/env node
/*
 * vendor-shoelace.js — copy Shoelace's `cdn` build into resources/shoelace/.
 *
 * ADR 0008: Shoelace is served strictly locally (no CDN). This script vendors
 * the `cdn` build (autoloader bundle + self-contained lazy chunks + sl-icon
 * assets + themes) from the installed @shoelace-style/shoelace devDependency
 * into resources/shoelace/, which Node-RED serves via the module-resource
 * mechanism at /resources/node-red-contrib-webapp/shoelace/… (the same path
 * webapp-client.js rides on — no new HTTP route needed).
 *
 * The directory is generated (.gitignore'd) and produced before publish so the
 * npm tarball ships it. It runs as part of `pnpm build` and npm `prepare`.
 *
 * Drift guard: SHOELACE_VERSION is the single source of truth. The script
 * asserts the *installed* package version equals SHOELACE_VERSION and FAILS
 * HARD on mismatch, so package.json's pinned devDependency and the version the
 * runtime references (nodes/webapp.js) can never silently drift apart.
 *
 * Exposes its core via module.exports for the unit test (drift guard) without
 * executing the copy on require.
 */
"use strict";

const fs = require("fs");
const path = require("path");

// Single source of truth — must match SHOELACE_VERSION in nodes/webapp.js and
// the pinned @shoelace-style/shoelace devDependency in package.json.
const SHOELACE_VERSION = "2.20.1";

const REPO_ROOT = path.resolve(__dirname, "..");
const PACKAGE_DIR = path.join(REPO_ROOT, "node_modules", "@shoelace-style", "shoelace");
const SOURCE_DIR = path.join(PACKAGE_DIR, "cdn");
const DEST_DIR = path.join(REPO_ROOT, "resources", "shoelace");

/**
 * Read the installed Shoelace package version. The package's `exports` map does
 * not expose ./package.json, so we read the file directly rather than require()
 * the subpath (which throws ERR_PACKAGE_PATH_NOT_EXPORTED).
 */
function readInstalledVersion(packageDir = PACKAGE_DIR) {
    const pkgPath = path.join(packageDir, "package.json");
    if (!fs.existsSync(pkgPath)) {
        throw new Error(
            `Shoelace is not installed at ${packageDir}. Run \`corepack pnpm install\` first.`
        );
    }
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    return pkg.version;
}

/**
 * Drift guard. Throws if the installed version does not match the expected
 * SHOELACE_VERSION. Pure (no I/O beyond the version read), so it is unit-test
 * friendly.
 */
function assertVersionMatches(installedVersion, expectedVersion = SHOELACE_VERSION) {
    if (installedVersion !== expectedVersion) {
        throw new Error(
            `Shoelace version drift: installed ${installedVersion} but ` +
                `SHOELACE_VERSION is ${expectedVersion}. Update the pinned ` +
                `@shoelace-style/shoelace devDependency and SHOELACE_VERSION ` +
                `(scripts/vendor-shoelace.js + nodes/webapp.js) together.`
        );
    }
}

function vendor({
    sourceDir = SOURCE_DIR,
    destDir = DEST_DIR,
    packageDir = PACKAGE_DIR,
    expectedVersion = SHOELACE_VERSION,
    log = true
} = {}) {
    const installedVersion = readInstalledVersion(packageDir);
    assertVersionMatches(installedVersion, expectedVersion);

    if (!fs.existsSync(sourceDir)) {
        throw new Error(
            `Shoelace cdn build not found at ${sourceDir}. The installed ` +
                `package is missing its cdn/ directory.`
        );
    }

    // Replace any prior vendored copy so removed files don't linger.
    fs.rmSync(destDir, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(destDir), { recursive: true });
    fs.cpSync(sourceDir, destDir, { recursive: true });

    if (log) {
        // P274: emit progress on STDERR, never stdout. As the `prepare` hook this
        // runs during `npm pack`/`npm publish`; anything on stdout pollutes
        // `npm pack --json` (breaks the install-smoke-test's tarball parse).
        // eslint-disable-next-line no-console
        console.error(
            `vendor-shoelace: copied Shoelace ${installedVersion} cdn build → ` +
                `${path.relative(REPO_ROOT, destDir)}/`
        );
    }
    return { installedVersion, destDir };
}

module.exports = {
    SHOELACE_VERSION,
    SOURCE_DIR,
    DEST_DIR,
    PACKAGE_DIR,
    readInstalledVersion,
    assertVersionMatches,
    vendor
};

// Run only when invoked directly (not when require()d by the test).
if (require.main === module) {
    try {
        vendor();
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`vendor-shoelace: ${err.message}`);
        process.exit(1);
    }
}

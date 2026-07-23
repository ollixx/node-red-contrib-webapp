"use strict";

/*
 * P272 (ADR 0042 §3): the `webapp-common` node set registers NO node types —
 * it exists solely to carry the SHARED editor i18n catalog for
 * resources/lib/editor-common.js (the single canonical copy of the shared
 * editor helpers, which is served statically and therefore has no node set —
 * and thus no i18n namespace — of its own).
 *
 * Mechanic (measured, node-red 4.0.5): @node-red/registry `loadNodeLocales`
 * registers `<dir>/locales/<lang>/<basename>.json` — here
 * `nodes/locales/<lang>/webapp-common.json` — under the node SET id
 * `node-red-contrib-webapp/webapp-common` as its i18next namespace. The editor
 * serves every set's catalog via `GET /nodes/messages?lng=…` regardless of
 * whether the set registers types, so editor-common resolves shared strings
 * with `RED._("node-red-contrib-webapp/webapp-common:common.<key>")`
 * (see `sharedI18n` in editor-common.js). A set with zero types loads cleanly
 * (loader.js `loadNodeSet` has no minimum-type check).
 */
module.exports = function registerWebappCommon() {
    // Intentionally empty — catalog carrier only.
};

#!/usr/bin/env node
/*
 * Validates that the roadmap files parse and stay internally consistent.
 *
 * This exists because archive entries were repeatedly appended at the wrong
 * indentation (column 0 instead of two spaces under `phases:`), leaving
 * docs/agent-roadmap-archive.yaml unparseable — and nothing caught it. Run this
 * after editing either roadmap file (it is also part of `pnpm validate`).
 *
 * Checks:
 *   1. both YAML files parse
 *   2. every done phase in the main roadmap carries an `archive:` reference
 *   3. every referenced archive id actually exists in the archive
 *   4. every archive entry has a summary
 *
 * Self-contained: resolves js-yaml from the pnpm store without it being a
 * direct dependency, so no install step is required.
 */
"use strict";

const fs = require("fs");
const path = require("path");

function loadJsYaml() {
    try {
        return require("js-yaml");
    } catch {
        const store = path.resolve(__dirname, "..", "node_modules", ".pnpm");
        const dir = fs.readdirSync(store).find((d) => d.startsWith("js-yaml@"));
        if (!dir) {
            throw new Error("js-yaml not found in node_modules/.pnpm — run `corepack pnpm install`");
        }
        return require(path.join(store, dir, "node_modules", "js-yaml"));
    }
}

function main() {
    const yaml = loadJsYaml();
    const root = path.resolve(__dirname, "..");
    const mainPath = path.join(root, "docs", "agent-roadmap.yaml");
    const archivePath = path.join(root, "docs", "agent-roadmap-archive.yaml");

    const errors = [];
    let main;
    let archive;

    try {
        main = yaml.load(fs.readFileSync(mainPath, "utf8"));
    } catch (e) {
        errors.push(`docs/agent-roadmap.yaml does not parse: ${e.message.split("\n")[0]}`);
    }
    try {
        archive = yaml.load(fs.readFileSync(archivePath, "utf8"));
    } catch (e) {
        errors.push(`docs/agent-roadmap-archive.yaml does not parse: ${e.message.split("\n")[0]}`);
    }

    if (main && archive) {
        const archiveIds = new Set((archive.phases || []).map((p) => p.id));

        for (const p of main.phases || []) {
            if (p.status === "done" && !p.archive) {
                errors.push(`main: done phase ${p.id} has no archive reference`);
            }
            if (p.archive && !archiveIds.has(p.id)) {
                errors.push(`main: ${p.id} references the archive but has no entry there`);
            }
        }
        for (const p of archive.phases || []) {
            if (!p.summary) {
                errors.push(`archive: ${p.id} has no summary block`);
            }
        }
    }

    if (errors.length > 0) {
        console.error("roadmap check FAILED:");
        for (const e of errors) {
            console.error("  - " + e);
        }
        process.exit(1);
    }

    console.log(
        `roadmap check OK — main: ${main.phases.length} phases, archive: ${archive.phases.length} entries, all consistent`
    );
}

main();

#!/usr/bin/env node
/*
 * Read-only roadmap tripwire. WRITES NOTHING. Exits non-zero on inconsistency.
 *
 * The work packages under docs/roadmap/<epic>/*.md are the source of truth;
 * docs/roadmap/INDEX.md is a hand-maintained slim view of OPEN work. This check
 * exists for the same reason the old check-roadmap-yaml.js did: these files are
 * edited by agents and drift silently. It does not fix drift — repairing the
 * index is the orchestrator's job (see AGENTS.md). It only refuses to let an
 * inconsistent roadmap pass `pnpm validate` or an orchestrator phase pick.
 *
 * Checks:
 *   1. every package frontmatter parses and has id/status/epic/dependencies
 *   2. ids are unique
 *   3. every dependency id resolves to an existing package
 *   4. every open (pending/in_progress) package is listed in INDEX.md
 *   5. every id listed under INDEX "Open work" exists and is actually open
 *   6. (warn only) node packages: spec/tests paths exist on disk
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
        if (!dir) throw new Error("js-yaml not found — run `corepack pnpm install`");
        return require(path.join(store, dir, "node_modules", "js-yaml"));
    }
}

const ROOT = path.resolve(__dirname, "..");
const ROADMAP = path.join(ROOT, "docs", "roadmap");

function walk(dir, acc) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, acc);
        else if (e.name.endsWith(".md") && e.name !== "INDEX.md" && e.name !== "epic.md") acc.push(p);
    }
    return acc;
}

function parseFrontmatter(yaml, text) {
    const m = text.match(/^---\n([\s\S]*?)\n---/);
    if (!m) return null;
    return yaml.load(m[1]);
}

function main() {
    if (!fs.existsSync(ROADMAP)) {
        console.error("roadmap check FAILED: docs/roadmap/ does not exist");
        process.exit(1);
    }
    const yaml = loadJsYaml();
    const errors = [];
    const warnings = [];

    const files = walk(ROADMAP, []);
    const byId = new Map();

    for (const file of files) {
        const rel = path.relative(ROOT, file);
        const fm = parseFrontmatter(yaml, fs.readFileSync(file, "utf8"));
        if (!fm) {
            errors.push(`${rel}: no parseable frontmatter`);
            continue;
        }
        for (const k of ["id", "status", "epic", "dependencies"]) {
            if (fm[k] === undefined) errors.push(`${rel}: missing frontmatter field '${k}'`);
        }
        if (!fm.id) continue;
        if (byId.has(fm.id)) errors.push(`${rel}: duplicate id ${fm.id} (also ${path.relative(ROOT, byId.get(fm.id).file)})`);
        else byId.set(fm.id, { file, fm });

        if (fm.node) {
            if (fm.spec && !fs.existsSync(path.join(ROOT, fm.spec))) warnings.push(`${rel}: spec path not found: ${fm.spec}`);
            if (fm.tests && !fs.existsSync(path.join(ROOT, fm.tests))) warnings.push(`${rel}: tests path not found: ${fm.tests}`);
        }
    }

    // dependency references resolve
    for (const { file, fm } of byId.values()) {
        for (const dep of fm.dependencies || []) {
            if (!byId.has(dep)) errors.push(`${path.relative(ROOT, file)}: dependency ${dep} has no package file`);
        }
    }

    // index sync. Open statuses are listed under "## Open work"; "deferred" and
    // "done" are NOT open. A package with an unknown status is an error.
    const KNOWN_STATUSES = new Set(["pending", "in_progress", "deferred", "done"]);
    for (const { file, fm } of byId.values()) {
        if (!KNOWN_STATUSES.has(fm.status)) errors.push(`${path.relative(ROOT, file)}: unknown status '${fm.status}'`);
        if (fm.status === "deferred" && !fm.deferred_reason) errors.push(`${path.relative(ROOT, file)}: status 'deferred' requires a deferred_reason`);
    }
    const openStatuses = new Set(["pending", "in_progress"]);
    const openIds = [...byId.values()].filter((p) => openStatuses.has(p.fm.status)).map((p) => p.fm.id);

    const indexPath = path.join(ROADMAP, "INDEX.md");
    if (!fs.existsSync(indexPath)) {
        errors.push("docs/roadmap/INDEX.md missing");
    } else {
        const idx = fs.readFileSync(indexPath, "utf8");
        // The "## Open work" section runs until the next "## " heading.
        const m = idx.match(/^##\s+Open work\b([\s\S]*?)(?=^##\s)/m);
        const openSection = m ? m[1] : "";
        const listed = new Set([...openSection.matchAll(/\*\*(P\d+[a-z]*)\*\*/g)].map((mm) => mm[1]));

        for (const id of openIds) {
            if (!listed.has(id)) errors.push(`INDEX.md: open package ${id} is not listed under "Open work"`);
        }
        for (const id of listed) {
            const p = byId.get(id);
            if (!p) errors.push(`INDEX.md: lists ${id} but no package file exists`);
            else if (!openStatuses.has(p.fm.status)) errors.push(`INDEX.md: lists ${id} as open but its file status is '${p.fm.status}'`);
        }
    }

    // link hygiene: every relative markdown link in any docs/roadmap/**.md must
    // resolve. This is what makes moving a package (open → done/ → deferred/)
    // safe: a move that breaks a body link turns the tripwire red before commit.
    const allMd = [];
    (function walkAll(dir) {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) walkAll(p);
            else if (e.name.endsWith(".md")) allMd.push(p);
        }
    })(ROADMAP);
    const linkRe = /\]\(([^)]+)\)/g;
    for (const file of allMd) {
        const text = fs.readFileSync(file, "utf8");
        let lm;
        while ((lm = linkRe.exec(text)) !== null) {
            const raw = lm[1].trim();
            if (/^(https?:|mailto:|tel:|#)/i.test(raw)) continue; // external / anchor-only
            const target = raw.split("#")[0].trim();
            if (!target) continue;
            const resolved = path.resolve(path.dirname(file), target);
            if (!fs.existsSync(resolved)) errors.push(`${path.relative(ROOT, file)}: broken relative link → ${raw}`);
        }
    }

    for (const w of warnings) console.warn("  warn: " + w);

    if (errors.length > 0) {
        console.error("roadmap check FAILED:");
        for (const e of errors) console.error("  - " + e);
        process.exit(1);
    }

    console.log(`roadmap check OK — ${byId.size} packages, ${openIds.length} open, index in sync` + (warnings.length ? `, ${warnings.length} warning(s)` : ""));
}

main();

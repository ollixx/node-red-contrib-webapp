#!/usr/bin/env node
/*
 * Read-only documentation link tripwire. WRITES NOTHING. Exits non-zero on a
 * dangling reference. Companion to check-roadmap.js (which owns docs/roadmap/
 * semantics + its own links); this one covers everything else:
 *
 *   Tier 1 — every relative markdown link `](path)` in docs/** (excluding
 *            docs/roadmap, owned by check-roadmap.js), .ai/**, and the root
 *            AGENTS.md / CLAUDE.md / README.md must resolve on disk.
 *   Tier 2 — every `docs/...md` / `.ai/...md` path mentioned in source comments
 *            (js/ts/json under nodes, packages/<pkg>/src, resources, scripts,
 *            tests) must exist — so a doc move can't silently orphan a code
 *            reference (e.g. contracts.ts -> ui-route.md, tests -> node-testing.md).
 *
 * Run via `pnpm check:links`; part of `pnpm validate`.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const errors = [];

function walk(dir, filter, acc) {
    if (!fs.existsSync(dir)) return acc;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === "node_modules" || e.name === "dist" || e.name === ".git") continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, filter, acc);
        else if (filter(p)) acc.push(p);
    }
    return acc;
}

// --- Tier 1: markdown links --------------------------------------------------
const mdRoots = [
    { dir: path.join(ROOT, "docs"), skip: (p) => p.includes(path.join("docs", "roadmap")) },
    { dir: path.join(ROOT, ".ai"), skip: () => false },
];
const mdFiles = [];
for (const { dir, skip } of mdRoots) {
    walk(dir, (p) => p.endsWith(".md") && !skip(p), mdFiles);
}
for (const root of ["AGENTS.md", "CLAUDE.md", "README.md"]) {
    const p = path.join(ROOT, root);
    if (fs.existsSync(p)) mdFiles.push(p);
}

const linkRe = /\]\(([^)]+)\)/g;
for (const file of mdFiles) {
    const text = fs.readFileSync(file, "utf8");
    let m;
    while ((m = linkRe.exec(text)) !== null) {
        const raw = m[1].trim();
        if (/^(https?:|mailto:|tel:|#)/i.test(raw)) continue;
        const target = raw.split("#")[0].trim();
        if (!target) continue;
        const resolved = path.resolve(path.dirname(file), target);
        if (!fs.existsSync(resolved)) errors.push(`${path.relative(ROOT, file)}: broken markdown link -> ${raw}`);
    }
}

// --- Tier 2: code/command -> doc path references ----------------------------
// Source comments AND .claude/commands launchers reference docs/prompts by path;
// a rename/removal must not orphan them (e.g. a command pointing at a deleted prompt).
const codeRoots = ["nodes", "packages", "resources", "scripts", "tests"];
const codeFiles = [];
for (const r of codeRoots) {
    walk(path.join(ROOT, r), (p) => /\.(js|ts|json)$/.test(p), codeFiles);
}
walk(path.join(ROOT, ".claude", "commands"), (p) => p.endsWith(".md"), codeFiles);
// concrete repo-doc paths only (no globs/templates): docs/...md or .ai/...md
const docRefRe = /(?:docs|\.ai)\/[A-Za-z0-9/_.-]+\.md/g;
const seen = new Set();
for (const file of codeFiles) {
    const text = fs.readFileSync(file, "utf8");
    let m;
    while ((m = docRefRe.exec(text)) !== null) {
        const ref = m[0];
        if (ref.includes("*") || ref.includes("<") || ref.includes("..")) continue; // template / glob / ellipsis placeholder
        const key = file + "::" + ref;
        if (seen.has(key)) continue;
        seen.add(key);
        if (!fs.existsSync(path.join(ROOT, ref))) {
            errors.push(`${path.relative(ROOT, file)}: references missing doc -> ${ref}`);
        }
    }
}

// --- report ------------------------------------------------------------------
if (errors.length > 0) {
    console.error("doc-link check FAILED:");
    for (const e of errors) console.error("  - " + e);
    process.exit(1);
}
console.log(`doc-link check OK — ${mdFiles.length} md files, ${codeFiles.length} source files scanned, all references resolve`);

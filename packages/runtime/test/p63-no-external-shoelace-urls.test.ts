import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * P63 / ADR 0008 — strictly local Shoelace, no CDN.
 *
 * Static guard: no source file under nodes/, resources/, or packages/ may
 * reference jsdelivr or any external Shoelace CDN URL. Docs/ADRs may mention
 * them (history/rationale) and are intentionally NOT scanned. The vendored
 * resources/shoelace/ tree is excluded — it is generated upstream output.
 */

const REPO_ROOT = resolve(__dirname, "..", "..", "..");

const SCAN_DIRS = ["nodes", "resources", "packages"];
const SCAN_EXTENSIONS = [".js", ".ts", ".mjs", ".cjs", ".html", ".css"];
const EXCLUDED_DIRS = new Set(["node_modules", "dist", "shoelace", "coverage"]);

const FORBIDDEN_PATTERNS: RegExp[] = [
    /jsdelivr/i,
    /cdn\.jsdelivr\.net/i,
    /unpkg\.com/i,
    // any absolute http(s) URL that points at a shoelace asset
    /https?:\/\/[^\s"'`]*shoelace/i
];

function collectFiles(dir: string, out: string[]): void {
    let entries: string[];
    try {
        entries = readdirSync(dir);
    } catch {
        return;
    }
    for (const entry of entries) {
        const full = join(dir, entry);
        const stat = statSync(full);
        if (stat.isDirectory()) {
            if (EXCLUDED_DIRS.has(entry)) continue;
            collectFiles(full, out);
        } else if (
            SCAN_EXTENSIONS.some((ext) => entry.endsWith(ext)) &&
            // Test/spec files legitimately name the forbidden strings to assert
            // their ABSENCE (negative assertions) — exclude them.
            !/\.(test|spec)\.[cm]?[jt]s$/.test(entry)
        ) {
            out.push(full);
        }
    }
}

describe("no external Shoelace / CDN URLs in source", () => {
    const files: string[] = [];
    for (const d of SCAN_DIRS) collectFiles(join(REPO_ROOT, d), files);

    it("scans a non-trivial set of source files", () => {
        expect(files.length).toBeGreaterThan(10);
    });

    it("contains no jsdelivr / unpkg / external Shoelace URL", () => {
        const offenders: string[] = [];
        for (const file of files) {
            const content = readFileSync(file, "utf8");
            for (const pattern of FORBIDDEN_PATTERNS) {
                if (pattern.test(content)) {
                    offenders.push(`${file} :: ${pattern}`);
                    break;
                }
            }
        }
        expect(offenders).toEqual([]);
    });
});

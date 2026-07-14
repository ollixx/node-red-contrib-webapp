#!/usr/bin/env node
"use strict";
/*
 * gen-field-matrix — generate the cross-node field usage matrix as a self-contained
 * HTML doc (docs/nodes/field-matrix.html).
 *
 * Columns = every ui-node (from nodes/ ** / *.html), coloured in its real Node-RED
 * palette colour. Rows = every field (from each node's `defaults` block), grouped
 * and with binding carriers (`<base>Binding` / `<base>Path`) folded into their base.
 *
 * The consistency FINDINGS (ADR 0038) are derived from the SAME rules the
 * `check:fields` guardrail enforces, read off the LIVE defaults — so the overlay
 * cleans itself up as P228 (renames) and P229 (legacy sweep) land. It shows:
 *   - `×`  a field used by the node,
 *   - rename / legacy / collision badges for a field with a planned change,
 *   - `×ᴾ` a node still carrying a residual `<base>Path` legacy twin.
 *
 * Run: `pnpm gen:field-matrix`. The output is generated — do not hand-edit it.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "docs/nodes/field-matrix.html");

function walk(dir) {
    let out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) out = out.concat(walk(p));
        else if (entry.name.endsWith(".html")) out.push(p);
    }
    return out;
}

function nodeType(src) {
    const m = src.match(/register(?:NodeType(?:WithEvents)?|Type)\(\s*["']([a-z0-9-]+)["']/i);
    return m ? m[1] : null;
}

// Top-level keys of the `defaults: { ... }` object literal (comment- and string-safe).
function defaultsKeys(src) {
    const i = src.indexOf("defaults:");
    if (i < 0) return [];
    let j = src.indexOf("{", i);
    if (j < 0) return [];
    let depth = 0;
    let str = null;
    const keys = [];
    for (let k = j; k < src.length; k++) {
        const c = src[k];
        const c2 = src[k + 1];
        if (str) { if (c === str && src[k - 1] !== "\\") str = null; continue; }
        if (c === '"' || c === "'" || c === "`") { str = c; continue; }
        if (c === "/" && c2 === "/") { const nl = src.indexOf("\n", k); k = nl < 0 ? src.length : nl; continue; }
        if (c === "/" && c2 === "*") { const e = src.indexOf("*/", k); k = e < 0 ? src.length : e + 1; continue; }
        if (c === "{") { depth++; continue; }
        if (c === "}") { depth--; if (depth === 0) break; continue; }
        if (depth === 1) {
            const m = src.slice(k).match(/^\s*([A-Za-z_$][\w$]*)\s*:/);
            if (m) { keys.push(m[1]); k += m[0].length - 1; }
        }
    }
    return [...new Set(keys)];
}

const nodes = {};
const fam = {};
const baseWired = {};
const colors = {};
for (const file of walk(path.join(ROOT, "nodes"))) {
    const src = fs.readFileSync(file, "utf8");
    const type = nodeType(src);
    if (!type) continue;
    nodes[type] = defaultsKeys(src);
    const fm = file.match(/nodes\/([a-z]+)\//);
    fam[type] = fm ? fm[1] : "root";
    baseWired[type] = /common\.installBaseFields\(/.test(src);
    const cm = src.match(/color:\s*"(#[0-9a-fA-F]{3,8})"/);
    colors[type] = cm ? cm[1] : "#cccccc";
}

// Fold carriers: `<base>Binding` → base; `<base>Path` → base only when the base (or
// its Binding twin) is present on the same node (else it is a standalone field).
function canon(field, set) {
    if (field.endsWith("Binding")) return field.slice(0, -7);
    if (field.endsWith("Path")) {
        const b = field.slice(0, -4);
        if (set.has(b) || set.has(b + "Binding")) return b;
        return field;
    }
    return field;
}
const cn = {};
for (const [n, fl] of Object.entries(nodes)) {
    const set = new Set(fl);
    const c = new Set();
    for (const f of fl) c.add(canon(f, set));
    cn[n] = c;
}

// FINDINGS derived from the check:fields rules on the live defaults (ADR 0038).
// Residual `<base>Path` twin per base → the specific nodes still carrying it.
const pathLegacy = {};
for (const [n, fl] of Object.entries(nodes)) {
    for (const f of fl) {
        if (f.endsWith("Path")) {
            const b = f.slice(0, -4);
            if (fl.includes(b) || fl.includes(b + "Binding")) (pathLegacy[b] = pathLegacy[b] || new Set()).add(n);
        }
    }
}
// Field-level status. Rename targets follow the bare-reference-name rule; legacy
// fields are the removal set; `rows` is the ui-textarea height/data collision.
const RENAME = { parent: "app", layoutId: "layout", routeId: "route", definitionId: "definition" };
const LEGACY = new Set(["storeId", "itemsJson", "optionsJson", "page", "currentPagePath"]);
function fieldStatus(f) {
    if (RENAME[f]) return { k: "rename", to: RENAME[f], pkg: "P228" };
    if (LEGACY.has(f)) return { k: "legacy", pkg: "P229" };
    if (f === "rows") return { k: "collision", pkg: "P229", note: "ui-textarea → lines" };
    return null;
}

const GROUPS = [
    ["Allgemein", ["name", "uiId"]],
    ["Struktur & Mount", ["parent", "app", "mount", "root", "path", "layout", "layoutId", "definitionId", "definition"]],
    ["Platzierung (Grid)", ["order", "row", "col", "colSize", "rowSize", "layoutX", "layoutY"]],
    ["Base-Fields (ADR 0015)", ["visible", "disabled", "color", "size", "variant"]],
    ["Wert & Inhalt", ["value", "text", "message", "title", "label", "placeholder", "src", "alt", "icon", "href", "items", "rows", "columns", "options", "itemsJson", "optionsJson", "initials", "image", "fallback", "badgeVariant", "displayValue", "footer", "description", "lines", "separator", "steps", "step", "countdown"]],
    ["Aktiver Zustand · Auswahl", ["activeTab", "activeStep", "activeRoute", "openSection", "selectedId", "currentPage", "page", "collapsed", "selectable", "selectAction"]],
    ["State · Query · Action", ["store", "storeId", "statePath", "initialValue", "persist", "scope", "query", "queryPath", "params", "refreshAction", "debounceMs", "op", "mode", "action", "actionType", "actionLabel", "targetMode", "to", "toType", "target", "targets", "routeId", "route", "writeTo", "writeTrigger", "deployMode", "linkMode", "each", "config", "part"]],
    ["Feld-Mapping (Listen · Tabellen)", ["iconField", "idField", "labelField", "valueField", "optionsField", "keyField", "itemName", "displayType", "pageSize", "total", "ordered", "maxEntries", "minSeverity", "maxLength", "multiple", "inputType"]],
    ["Präsentation & Optionen", ["orientation", "position", "closable", "modal", "dismissible", "duration", "severity", "style", "display", "shape", "outline", "pulsating", "fit", "showValue", "height", "width", "min", "max", "tokens", "events", "outputs", "forwardErrorsToClient", "forwardErrorMinSeverity", "mediaStoreUrl"]]
];
const known = new Set(GROUPS.flatMap((g) => g[1]));
const allCanon = new Set();
for (const c of Object.values(cn)) for (const f of c) allCanon.add(f);
GROUPS.push(["Knoten-spezifisch", [...allCanon].filter((f) => !known.has(f)).sort()]);

const FAM_ORDER = { structure: 0, view: 1, state: 2, behavior: 3, root: 4 };
const cols = Object.keys(nodes).sort((a, b) => (FAM_ORDER[fam[a]] - FAM_ORDER[fam[b]]) || a.localeCompare(b));
const usage = (f) => cols.filter((n) => cn[n].has(f)).length;

function textColor(hex) {
    let h = hex.replace("#", "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? "#1c2330" : "#f2f4f8";
}
const stClass = { rename: "st-rename", legacy: "st-legacy", collision: "st-collision" };

let rows = "";
for (const [g, fields] of GROUPS) {
    const present = fields.filter((f) => usage(f) > 0);
    if (!present.length) continue;
    rows += `<tr class="grp"><th class="rh gh">${g}</th>${cols.map(() => '<td class="gf"></td>').join("")}</tr>`;
    for (const f of present) {
        const st = fieldStatus(f);
        const rc = st ? stClass[st.k] : "";
        const cells = cols.map((n) => {
            if (!cn[n].has(f)) return `<td class="${rc}"></td>`;
            const pl = pathLegacy[f] && pathLegacy[f].has(n);
            const coll = f === "rows" && n === "ui-textarea";
            let mark = "×", cls = "x " + rc, tt = `${n}: ${f} — genutzt`;
            if (coll) { mark = "!"; cls = "x st-collision-cell"; tt = `${n}: rows = Höhe (Number) — kollidiert mit ui-table rows (Daten); geplant → lines (P229)`; }
            else if (st && st.k === "legacy") { cls = "x st-legacy-cell"; tt = `${n}: ${f} — Legacy, geplant zu entfernen (${st.pkg})`; }
            else if (st && st.k === "rename") { cls = "x st-rename-cell"; tt = `${n}: ${f} → ${st.to} (${st.pkg})`; }
            else if (pl) { cls = "x st-path-cell"; tt = `${n}: trägt noch Legacy-${f}Path-Zwilling — geplant zu entfernen (P229)`; }
            return `<td class="${cls}" title="${tt}">${mark}${pl && !coll ? '<sup class="pl">P</sup>' : ""}</td>`;
        }).join("");
        let badge = "";
        if (st) {
            const lbl = st.k === "rename" ? `→ ${st.to} · ${st.pkg}` : st.k === "collision" ? `Kollision · ${st.pkg}` : `Legacy · ${st.pkg}`;
            badge = `<span class="badge ${stClass[st.k]}">${lbl}</span>`;
        }
        rows += `<tr class="${rc}"><th class="rh fn">${f}<span class="cnt">${usage(f)}</span>${badge}</th>${cells}</tr>`;
    }
}
const head = cols.map((n) => {
    const c = colors[n] || "#ccc";
    return `<th class="ch" style="background:${c}"><span style="color:${textColor(c)}">${n}</span></th>`;
}).join("");
const FAM_LABEL = { structure: "structure", view: "view", state: "state", behavior: "behavior", root: "app" };
const byColor = {};
for (const n of cols) { const c = colors[n] || "#ccc"; (byColor[c] = byColor[c] || { fam: fam[n], n: 0 }).n++; }
const legendColors = Object.entries(byColor).map(([c, v]) => `<span class="lg"><i class="sw" style="background:${c}"></i>${FAM_LABEL[v.fam] || v.fam} <span class="muted">(${v.n})</span></span>`).join("");
const flagged = Object.keys(nodes).length;
const totalFields = allCanon.size;

const STYLE = `<style>
:root{--bg:#f7f8fa;--surface:#ffffff;--line:#c9cfd8;--line-soft:#e7eaef;--text:#1c2330;--muted:#6b7486;--faint:#a3abbb;--accent:#4f46e5;--grp-bg:#eef0f6;--hover:#eef1ff;--st-rename-fg:#3056b5;--st-rename-bg:#e7edfb;--st-legacy-fg:#8a5a10;--st-legacy-bg:#f6ecd6;--st-collision-fg:#b5352f;--st-collision-bg:#f8e2e0;--st-path-fg:#9a6b12;}
@media (prefers-color-scheme:dark){:root{--bg:#12151b;--surface:#171b22;--line:#38404d;--line-soft:#242a33;--text:#e4e8ef;--muted:#98a1b2;--faint:#606b7d;--accent:#a5b4fc;--grp-bg:#1e232c;--hover:#20263a;--st-rename-fg:#9db4f5;--st-rename-bg:#1c2740;--st-legacy-fg:#e0b968;--st-legacy-bg:#332a12;--st-collision-fg:#ee9a93;--st-collision-bg:#3a1f1d;--st-path-fg:#d7ad5e;}}
:root[data-theme="light"]{--bg:#f7f8fa;--surface:#ffffff;--line:#c9cfd8;--line-soft:#e7eaef;--text:#1c2330;--muted:#6b7486;--faint:#a3abbb;--accent:#4f46e5;--grp-bg:#eef0f6;--hover:#eef1ff;--st-rename-fg:#3056b5;--st-rename-bg:#e7edfb;--st-legacy-fg:#8a5a10;--st-legacy-bg:#f6ecd6;--st-collision-fg:#b5352f;--st-collision-bg:#f8e2e0;--st-path-fg:#9a6b12;}
:root[data-theme="dark"]{--bg:#12151b;--surface:#171b22;--line:#38404d;--line-soft:#242a33;--text:#e4e8ef;--muted:#98a1b2;--faint:#606b7d;--accent:#a5b4fc;--grp-bg:#1e232c;--hover:#20263a;--st-rename-fg:#9db4f5;--st-rename-bg:#1c2740;--st-legacy-fg:#e0b968;--st-legacy-bg:#332a12;--st-collision-fg:#ee9a93;--st-collision-bg:#3a1f1d;--st-path-fg:#d7ad5e;}
*{box-sizing:border-box;}body{margin:0;background:var(--bg);}
.page{padding:20px 16px 12px;color:var(--text);font-family:system-ui,-apple-system,sans-serif;}
h1{font-size:20px;font-weight:500;margin:0 0 4px;letter-spacing:-.01em;}
.sub{color:var(--muted);font-size:13px;margin:0 0 14px;max-width:78ch;line-height:1.5;}
.sub code{font-family:ui-monospace,monospace;font-size:12px;}
.legend{display:flex;flex-wrap:wrap;align-items:center;gap:7px 15px;font-size:12px;color:var(--text);margin-bottom:10px;}
.lg{display:inline-flex;align-items:center;gap:6px;}.lg b{font-family:ui-monospace,monospace;font-size:14px;}.lg .x{color:var(--accent);}
.sw{width:13px;height:13px;border-radius:3px;display:inline-block;border:1px solid rgba(0,0,0,.18);}
.sep{width:1px;height:14px;background:var(--line);}.muted{color:var(--muted);}
.badge{display:inline-block;font-family:system-ui,sans-serif;font-size:9.5px;font-weight:500;line-height:1.4;padding:1px 6px;border-radius:9px;margin-left:8px;white-space:nowrap;vertical-align:middle;}
.st-rename{background:var(--st-rename-bg);color:var(--st-rename-fg);}.st-legacy{background:var(--st-legacy-bg);color:var(--st-legacy-fg);}.st-collision{background:var(--st-collision-bg);color:var(--st-collision-fg);}
.scroll{overflow:auto;max-height:80vh;border:1px solid var(--line);border-radius:10px;background:var(--surface);}
table{border-collapse:separate;border-spacing:0;}th,td{border-right:1px solid var(--line-soft);border-bottom:1px solid var(--line-soft);}
td{width:25px;min-width:25px;max-width:25px;height:23px;text-align:center;font-family:ui-monospace,monospace;font-size:13px;color:var(--accent);position:relative;}
td.st-rename-cell{background:var(--st-rename-bg);color:var(--st-rename-fg);}td.st-legacy-cell{background:var(--st-legacy-bg);color:var(--st-legacy-fg);}td.st-collision-cell{background:var(--st-collision-bg);color:var(--st-collision-fg);font-weight:500;}
.pl{font-size:8px;color:var(--st-path-fg);vertical-align:super;margin-left:1px;font-family:system-ui,sans-serif;}
tbody tr:hover td{background:var(--hover);}
.rh{position:sticky;left:0;background:var(--surface);text-align:left;white-space:nowrap;z-index:2;border-right:1px solid var(--line);padding:3px 12px;}
.fn{font-family:ui-monospace,monospace;font-size:12px;padding-left:22px;color:var(--text);}.cnt{color:var(--faint);margin-left:9px;font-size:10px;}
.grp .gh{font-family:system-ui,sans-serif;font-weight:500;font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);background:var(--grp-bg);padding:5px 12px;}.grp .gf{background:var(--grp-bg);}
thead th{position:sticky;top:0;z-index:3;background:var(--surface);}
.corner{left:0;z-index:5;background:var(--surface);vertical-align:bottom;font-family:system-ui,sans-serif;font-weight:500;font-size:11px;color:var(--muted);padding:0 12px 8px;}
.ch{height:170px;vertical-align:bottom;padding:6px 0;text-align:center;border-right:1px solid rgba(0,0,0,.12);}
.ch span{writing-mode:vertical-rl;transform:rotate(180deg);font-family:ui-monospace,monospace;font-size:11.5px;white-space:nowrap;line-height:25px;display:inline-block;font-weight:500;}
</style>`;

const html = `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ui-Knoten × Felder Matrix</title>
${STYLE}</head><body>
<!-- GENERATED by \`pnpm gen:field-matrix\` (scripts/gen-field-matrix.js). Do not hand-edit. -->
<div class="page">
<h1>ui-Knoten × Felder — Nutzungsmatrix + Konsistenz-Findings</h1>
<p class="sub">${flagged} ui-Knoten (Spalten, echte Node-RED-Palette-Farbe) × ihre Felder (${totalFields} Zeilen, gruppiert; Binding-Carrier gefaltet). <code>×</code> = Feld aktuell genutzt. Farbige Badges = <b>geplante</b> Änderungen aus dem Konsistenz-Audit (ADR 0038): Umbenennung (P228), Legacy-Entfernung / Kollision (P229). <code>×ᴾ</code> = Knoten trägt noch einen Rest-Legacy-<code>*Path</code>-Zwilling. Die Findings werden aus denselben Regeln wie <code>pnpm check:fields</code> auf den Live-Defaults abgeleitet — sie räumen sich mit P228/P229 selbst auf. <b>Generiert</b> via <code>pnpm gen:field-matrix</code>.</p>
<div class="legend">
<span class="lg"><b class="x">×</b> aktuell / umgesetzt</span>
<span class="lg"><span class="badge st-rename">→ umbenennen · P228</span></span>
<span class="lg"><span class="badge st-legacy">Legacy entfernen · P229</span></span>
<span class="lg"><span class="badge st-collision">Kollision · P229</span></span>
<span class="lg"><b class="x st-path-cell">×<sup class="pl">P</sup></b> Rest-Legacy-<code>*Path</code>-Zwilling</span>
</div>
<div class="legend">${legendColors}<span class="sep"></span><span class="muted">Findings: ADR 0038 · Wächter: pnpm check:fields (P227)</span></div>
<div class="scroll"><table><thead><tr><th class="rh corner">feld \\ knoten</th>${head}</tr></thead><tbody>${rows}</tbody></table></div>
</div></body></html>`;

fs.writeFileSync(OUT, html);
const flaggedFields = [...allCanon].filter((f) => fieldStatus(f)).sort();
process.stderr.write(`gen-field-matrix: ${cols.length} nodes × ${totalFields} fields → ${path.relative(ROOT, OUT)}\n`);
process.stderr.write(`  planned-change fields: ${flaggedFields.join(", ") || "(none)"}\n`);
process.stderr.write(`  residual *Path twins on: ${Object.keys(pathLegacy).sort().join(", ") || "(none)"}\n`);

---
id: P274
title: "Release-Engineering 1.0: self-contained Publish-Artefakt (Packaging-Blocker!) + Install-Smoke-Test + CHANGELOG/Migrations-Notiz + README + repository/engines + CI (validate+E2E) + Version-Bump"
epic: aspects/misc
status: done
dependencies: []
verify: browser
spec: README.md
tests: tests/e2e/nodes/structure/ui-app.tests.md
---
# P274 — Release-Engineering 1.0

> Der letzte 1.0-Zug: das Paket **publizierbar und vertrauenswürdig** machen.
> Kern ist ein **belegter Packaging-Blocker** — das Paket wäre heute beim
> `npm install` sofort kaputt.

## findings (verifiziert 2026-07-22)

### A. 🔴 Packaging-Blocker: das publizierte Paket lädt nicht
- `nodes/webapp.js` (der `main`/Runtime-Entry) require't **per relativem Pfad**
  `../packages/schema/dist/index.js` UND `../packages/renderer/dist/index.js`.
- Das `files`-Feld shippt aber nur `packages/schema/dist` — **`packages/renderer/dist`
  fehlt** → `Cannot find module` beim Laden des Node-Sets.
- Tiefer: `packages/renderer/dist` require't intern **`@node-red-contrib-webapp/schema`
  per Paket-NAME** (`"workspace:*"`). Das löst nur über pnpm-Workspace-Symlinks auf;
  im publizierten Einzelpaket existiert dieser Name nicht als installierte
  Dependency. **Selbst mit ergänztem `files` bliebe es kaputt.** Nie aufgefallen,
  weil nie publiziert (Version `0.0.0`, immer aus dem Monorepo geladen).
- **Root-Deps:** nur `zod` — die vier Workspace-Pakete sind KEINE npm-Deps.

### B. Metadaten unvollständig
- `version: 0.0.0` · `repository`-Feld **fehlt** · `engines` **fehlt** ·
  `README.md` 30 Zeilen (zu dünn für npm/flows.nodered.org). `license` MIT ✓,
  `keywords` ✓, `node-red.version >=4.0.0` ✓.
- `prepare: vendor-shoelace` verschmutzt `npm pack --json` (stdout) — der
  Publish-Build braucht einen sauberen Hook.

### C. Kein Changelog / keine Migrations-Notiz
- Pre-1.0 Breaking Changes für Externe undokumentiert: **ui-navigation hart
  entfernt** (ADR 0040), **parent→app** + Id-Renames + `rows→lines` (ADR 0038,
  alle mit Auto-Migration — aber zu erklären).

### D. Keine CI für Korrektheit
- Nur `.github/workflows/deploy-demo.yml`; **kein** Workflow, der `validate` + E2E
  fährt. Für 1.0-Vertrauensniveau Pflicht.

## acceptance

### 1. Self-contained Publish-Artefakt (der Blocker)
- Ein **Publish-Build** erzeugt ein **eigenständiges** Runtime-Artefakt, das ohne
  die Workspace-Pakete lädt — Richtung: `nodes/webapp.js` + seine
  `packages/*`-Abhängigkeiten zu **einem gebündelten** Runtime-Modul zusammenfassen
  (esbuild/tsup, `zod` als einzige externe Dependency; die internen
  `@node-red-contrib-webapp/*`-Requires werden eingebunden, nicht extern). Alternativ
  akzeptabel: alle vier `packages/*/dist` shippen **und** die internen
  Paket-Namen-Requires per Build auf relative Pfade umschreiben — aber das Bundle
  ist robuster und kleiner.
- `files`/`main` zeigen auf das Artefakt; die Workspace-Pakete sind kein
  Laufzeit-Dependency des publizierten Pakets mehr.
- `zod` steht in `dependencies` (nicht nur devDependency).

### 2. Install-Smoke-Test (der HARTE Beweis — das ist der Punkt)
- Ein Skript/Test: `npm pack` → das Tarball in ein **frisches, workspace-fremdes**
  temp-Verzeichnis `npm install`en → ein minimales Node-RED (Port frei) mit dem
  installierten Paket starten → eine ui-app deployen → die App-URL rendert den
  erwarteten Inhalt (gemessen, Muster wie `examples/customers-crud`). Dieser Test
  fängt exakt die „im Monorepo grün, installiert kaputt"-Klasse und ist das
  Abnahme-Kriterium für Punkt 1. Läuft in CI.

### 3. Metadaten
- `version` → `1.0.0`; `repository` (github-URL) + `bugs` + `homepage` +
  `engines.node` (an node-red `>=4` orientiert) ergänzt.
- **README** ausgebaut: Was/Warum, Screenshot/GIF, Install (Palette + npm), 60-Sek-
  Beispiel, Link auf `docs/guide/` (P265/P266), Auth-Kurzhinweis, Lizenz. Verweise
  konsistent mit dem Doku-Programm.

### 4. Changelog + Migrations-Notiz
- `CHANGELOG.md` (Keep-a-Changelog) mit dem 1.0-Eintrag; ein
  **Migrations-Abschnitt** (im CHANGELOG oder `docs/guide/migration-1.0.md`):
  - `ui-navigation` entfernt → `ui-action` navigate (mechanischer Ersatz, ADR 0040),
  - `parent→app`, `layoutId→layout`, `routeId→route`, `definitionId→definition`,
    `rows→lines` — **Auto-Migration beim Öffnen/Speichern**, kein Handeingriff nötig
    (ADR 0038); nur erklärt.

### 5. CI
- Ein GitHub-Actions-Workflow `ci.yml`: `corepack pnpm install` → `pnpm validate`
  → E2E (Playwright, Node-RED auf Testport) → der Install-Smoke-Test (Punkt 2).
  Läuft auf PR + main.

### Gesamt
- `npm pack` sauber (Hook-Verschmutzung behoben); der Install-Smoke-Test grün;
  `pnpm validate` + volle E2E + alle Tripwires grün; die 14 MB vendored Shoelace
  sind eine **bewusste, dokumentierte** Entscheidung (Owner-Hinweis im Paket, s.u.).

## verify

`browser` — der Install-Smoke-Test rendert die App aus dem **gepackten** Paket
(nicht aus dem Monorepo); CI-Lauf grün.

## spec

`README.md`, `CHANGELOG.md`, ggf. `docs/guide/migration-1.0.md`, `package.json`.

## tests

Install-Smoke-Test (`scripts/smoke-pack.*` + CI-Schritt); bestehende Suite unverändert.

## notes for the implementer

- **Reihenfolge:** zuerst Bundle + Install-Smoke-Test rot→grün (der Blocker),
  dann Metadaten/README/CHANGELOG/CI. Ohne den Smoke-Test ist „gefixt" nicht beweisbar.
- Der Bundle darf **Node-RED nicht** einbündeln (es ist Peer/Runtime-Umgebung) —
  nur die eigenen `packages/*` + `zod`.
- `resources/` (inkl. 14 MB vendored Shoelace, ADR 0008) bleibt separat geshippt
  (statisch von Node-RED serviert); NICHT in den JS-Bundle ziehen. **Owner-Entscheid
  offen:** die 14 MB im Tarball akzeptieren (einfachste, offline-feste Variante) ODER
  Shoelace zur Install-Zeit vendoren (kleineres Tarball, aber `postinstall` +
  Netz/devDep-Abhängigkeit) — Empfehlung: **im Tarball belassen** (offline, robust,
  ADR-0008-Geist „strikt lokal, kein CDN").
- `examples/**` bleiben mitgeliefert (Import-Beispiele + die Guide-Beispiele aus
  P266) — sie sind Teil des Nutzererlebnisses.
- Version-Bump als **letzten** Schritt, nachdem alles grün ist.

## Owner-Entscheid (vor/bei Umsetzung)

1. **Shoelace-Shipping:** 14 MB im Tarball (Empfehlung) oder install-time vendoren?
2. **Bundle-Werkzeug:** esbuild (Empfehlung, schnell, im Node-RED-Ökosystem üblich)
   oder tsup — freie Implementer-Wahl, solange der Install-Smoke-Test grün ist.

## Result

**Done 2026-07-24.** Das Paket ist **publizierbar und bewiesen tragfähig** — der
Packaging-Blocker ist behoben, mit einem Install-Smoke-Test als hartem Beweis.
Version **1.0.0**. **Nichts publiziert** (der `npm publish`-Knopf bleibt beim Owner).

### Der Blocker: bewiesen rot → grün

`nodes/webapp.js` lud `packages/*/dist` per relativem Pfad, `renderer/dist`
require'te intern `@node-red-contrib-webapp/schema` per Paket-NAME → im publizierten
Einzelpaket `Cannot find module`. **Fix (`7c6f0a6`):** esbuild-Publish-Bundle
(`scripts/build-publish.mjs`) inlined die internen Pakete zu je einem
self-contained CJS-Modul (schema 182 KB, renderer 261 KB), `zod` als **einzige**
externe Runtime-Dependency (in `dependencies`); Node-RED nie gebündelt.
Via `prepack`-Hook (`build:publish >&2`, damit `npm pack --json` sauber bleibt).

### Install-Smoke-Test (der harte Beweis — `ac76286` + Härtung `2495f85`)

`scripts/smoke-pack.mjs` (`pnpm smoke:pack`): `npm pack` → Tarball in ein frisches,
**workspace-fremdes** temp-Verzeichnis mit echtem `npm install` → Node-RED auf
freiem Zufallsport → ui-app + ui-text **+ ui-button** deployen → gerendertes HTML
messen. **Rot vorher** (`Cannot find module renderer/dist`, captured). **Grün
nachher aus dem gepackten 1.0.0-Tarball, im Haupt-Checkout verifiziert:** Text-Marker
(16 602 B) + `sl-button` gerendert + Shoelace-Asset `shoelace-autoloader.js` HTTP 200.
Die Härtung (Orchestrator-Fund) schließt die Lücke „Beweis berührte Shoelace nicht":
der Test würde jetzt einen künftigen Shoelace-Ausschluss fangen.

### Shoelace shippt (Owner-Entscheid umgesetzt)

`resources/shoelace` (2938 Dateien) ist im Tarball (`files: ["resources", …]`;
gitignored, aber via `prepare`→vendor auf der Platte zur Pack-Zeit). Tarball:
**1,4 MB gepackt / ~8 MB entpackt / 3342 Dateien**. Offline-fest, ADR-0008-Geist.

### Metadaten + Doku + CI

`8b43744` repository/bugs/homepage/engines.node · `7f14b24` README (npm-tauglich,
Guide-Verweise) · `cc5b527` CHANGELOG (Keep-a-Changelog) + `docs/guide/migration-1.0.md`
EN+DE (ui-navigation→ui-action, parent→app + Id-Renames + rows→lines, alle
auto-migriert — nur erklärt) · `85f9717` `.github/workflows/ci.yml` (pnpm install →
validate → E2E → smoke:pack, auf PR + main) · `899196d` Version → 1.0.0.

### Verifikation

Install-Smoke-Test grün aus dem Haupt-Checkout; `npm pack --json` sauber;
**Voll-Suite 959 passed, 0 failed, `--retries=0`, 17,1 min**; `pnpm validate` + alle
Tripwires grün. **Owner-Hinweise für den Publish:** (1) `npm publish` ist dein
Knopfdruck — dieses Paket macht nur release-fertig. (2) Nach frischem Checkout vor
Publish `pnpm install` (esbuild ist Build-Abhängigkeit; die CI macht das mit
`--frozen-lockfile`). (3) Die E2E brauchen die `node-red`-CLI auf dem PATH (kein
Paket-Dependency; CI installiert sie global).

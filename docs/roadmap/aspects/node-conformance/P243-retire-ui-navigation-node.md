---
id: P243
node: ui-navigation
title: "ui-navigation stilllegen — Knoten entfernen, Flows zu ui-action navigate migrieren (ADR 0040)"
epic: aspects/node-conformance
status: pending
dependencies: []
verify: browser
spec: docs/nodes/behavior/ui-action.md
tests: tests/e2e/nodes/behavior/ui-navigation.tests.md
---
# P243 — ui-navigation stilllegen (ADR 0040)

> Rationale: **[ADR 0040](../../../adr/0040-retire-ui-navigation-node-navigate-is-a-ui-action.md)**.
> Aus dem ui-navigation-Konformitäts-Audit (2026-07-17): der abgekündigte Knoten
> ist eine **Falle** — sein Editor bietet (P119) einen validierten route/wire/
> params-Umschalter an, den die Laufzeit (P118 node-set) **bewusst verwirft**.
> Owner-Entscheid: Knoten entfernen, Navigation ist allein `ui-action` navigate.

## findings

- **Laufzeit verwirft alles außer `to`.** `packages/runtime/src/node-set.ts`
  schreibt jede `ui-navigation` zu `ui-action` navigate um und erzwingt
  `targetMode:"url"`, `routeId:undefined`, `target:undefined`, `params:undefined`.
  `mapConfig` (`nodes/webapp.js`) trägt nur `parent`+`to`. Schema
  (`uiNavigationNodeDefinitionSchema`) validiert nur `parent`+`to`.
- **Editor bietet den vollen Umschalter (P119)** inkl. Route-Picker + `params` +
  `validateNavigateConfig` (validiert route-Modus grün) → **stille kaputte
  Navigation** bei route/wire/params.
- **Kein Test schützt den Knoten** — einziger direkter E2E ist ein verbotener
  No-Crash-Test; `p66-navigation`/`ui-navigation.spec` prüfen den Navigate-**Message-
  Vertrag** (via `inject`) bzw. `ui-action`/`ui-button`, nicht den Knoten.
- **Nutzung im Repo (nur generiert):** `examples/customers-crud/flow.json`
  (`navToCustomers`, **url-Modus**, `to:"/customers"`) via `scripts/gen-example.js:293`;
  `examples/behavior/ui-navigation.json` via `scripts/gen-node-examples.js`. Keine
  Fixtures, kein Hand-Flow.
- **Erste Knoten-Stilllegung im Projekt** — kein Präzedenzfall; das Verfahren wird
  hier etabliert (ADR 0040 §3).

## acceptance

- **Der Knoten ist entfernt.** `ui-navigation` ist **nicht** mehr registriert
  (Palette-Eintrag weg), und keiner der folgenden Orte kennt ihn noch:
  - `nodes/webapp.js` — aus der Knoten-Typ-Liste **und** der `mapConfig`-Registry
    entfernt; der `components`-Filter (Zeile ~3546) enthält `ui-navigation` nicht mehr.
  - `packages/runtime/src/node-set.ts` — der `ui-navigation`-Zweig der Navigate-Map
    (`type === "ui-navigation" ? … : …`) **kollabiert auf `ui-action`-only**; der
    Filter akzeptiert nur noch `ui-action`.
  - `packages/schema/src/node-definitions.ts` — `uiNavigationNodeDefinitionSchema`,
    der Union-Member im Node-Definition-Discriminated-Union und der Type-Export sind weg.
  - `packages/editor/src/nodes.ts` — die `"ui-navigation"`-Definition ist weg.
  - `nodes/behavior/ui-navigation.js` + `nodes/behavior/ui-navigation.html` gelöscht.
- **Verhaltens-Äquivalenz belegt (Browser, gemessen).** Nach Migration navigiert
  die customers-crud-Navbar **unverändert**: Klick auf „Customers nav link" führt zu
  `/customers` und rendert den Customers-Inhalt (dieselbe beobachtbare Wirkung wie
  vor der Migration — [[verify-rendering-by-measurement-not-tags]]). Der
  migrierte Knoten ist ein `ui-action` `actionType:"navigate"`, `targetMode:"url"`,
  `to:"/customers"`, gleicher `parent`.
- **Generatoren migriert (Beispiele generiert, nie handgepflegt):**
  - `scripts/gen-example.js` emittiert `navToCustomers` als `ui-action` navigate
    (url, `to:"/customers"`) statt `ui-navigation`; `examples/customers-crud/flow.json`
    ist per `pnpm gen:example` **neu generiert** (nur dieser Knoten ändert sich —
    keine Positions-Normalisierung, keine Fremd-Flow-Berührung, CLAUDE.md-Regel).
  - `scripts/gen-node-examples.js` erzeugt **kein** `ui-navigation`-Beispiel mehr;
    `examples/behavior/ui-navigation.json` ist **gelöscht**.
- **Doku + Tests aufgeräumt:**
  - `docs/nodes/behavior/ui-navigation.md` gelöscht; jede Referenz darauf (z. B.
    aus `ui-action.md`, `actions.md`, INDEX/Kataloge) entfernt oder auf `ui-action`
    umgebogen — `pnpm check:links` grün.
  - `tests/e2e/nodes/behavior/ui-navigation.spec.ts` (inkl. des No-Crash-Tests) +
    `ui-navigation.tests.md` gelöscht. **`p66-navigation.spec.ts` bleibt** (testet
    den Message-Vertrag, nicht den Knoten).
  - `ui-action.md` hält weiterhin (oder neu) den vollständigen Navigate-Vertrag —
    es ist ab jetzt die **einzige** Navigations-Doku.
- **Migrations-Notiz** für externe Flows: ein Changelog-/Migrations-Eintrag
  beschreibt den mechanischen Ersatz `type:"ui-navigation"` →
  `type:"ui-action"` + `actionType:"navigate"` + `targetMode:"url"` (`to`/`parent`/
  `name` behalten). **Kein** Laufzeit-Shim (ADR 0040 §3).
- **Tripwires + Build grün:** `check:fields`/`check:specs`/`check:help`/
  `check:roundtrip`/`check:links`/`check:roadmap` + `pnpm validate` + volle E2E
  (Haupt-Checkout) grün. Insbesondere kein `check:links`-Bruch durch die gelöschte Spec.

## verify

`browser` — die customers-crud-Navbar-Navigation nach der Migration im echten App
gemessen (URL wechselt zu `/customers`, Customers-Inhalt rendert); der Palette-
Eintrag `ui-navigation` ist weg; Deploy eines Alt-Flows mit `ui-navigation`
scheitert erwartungsgemäß (Unknown-Type) — die Migrations-Notiz deckt das ab.
Alle Tripwires + `pnpm validate` grün.

## spec

- **Löschen:** `docs/nodes/behavior/ui-navigation.md`.
- **Sicherstellen/aktualisieren:** `docs/nodes/behavior/ui-action.md` ist die
  alleinige Navigations-Spec (Drei-Modus-Modell + `params` vollständig, ADR 0011).
- Referenzen in `docs/nodes/concepts/actions.md` u. a. auf ui-action umbiegen.

## tests

- **Löschen:** `tests/e2e/nodes/behavior/ui-navigation.spec.ts`,
  `tests/e2e/nodes/behavior/ui-navigation.tests.md`.
- **Behalten:** `tests/e2e/nodes/behavior/p66-navigation.spec.ts` (Message-Vertrag).
- Der customers-crud-E2E-Pfad beweist die migrierte Navbar-Navigation weiterhin.

## notes for the implementer

- **Reihenfolge:** erst Generatoren + Migration (Flows zeigen dann `ui-action`
  navigate), dann Registrierung/Schema/Editor/node-set/Dateien entfernen, dann volle
  E2E. So läuft die App zu keinem Zeitpunkt auf einen unbekannten Knotentyp.
- **`node-set.ts` sorgfältig:** der Navigate-Map-Block behandelt HEUTE
  `ui-action` **und** `ui-navigation` gemeinsam (`packages/runtime/src/node-set.ts:342`).
  Nach dem Entfernen bleibt nur der `ui-action`-Pfad; die `type === "ui-navigation"
  ? undefined : …`-Ternäre kollabieren auf den else-Zweig. Bestehende
  ui-action-Navigate-Tests müssen grün bleiben.
- **`.node-red-dev/flows.json` NICHT anfassen** (owner-only). Falls der Owner dort
  eine `ui-navigation` hat, ist das seine Migration — nur hinweisen.
- **`.node-red-e2e/`** wird vor jedem Playwright-Lauf aus `examples/customers-crud/flow.json`
  neu gebaut — nach der Regenerierung trägt es automatisch den `ui-action`-Knoten;
  `.config.nodes.json` wird ebenfalls neu erzeugt.
- **Detail-Bar für die Migrations-Notiz:** exakt die Feld-Abbildung angeben, damit
  ein Nutzer sie ohne Raten anwenden kann (siehe acceptance).

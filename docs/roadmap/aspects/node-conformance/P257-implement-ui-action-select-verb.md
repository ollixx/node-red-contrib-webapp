---
id: P257
node: ui-action
title: "ui-action `select`-Verb implementieren — cross-node Item-Aktivierung (tabs/stepper/menu/table)"
epic: aspects/node-conformance
status: in_progress
dependencies: []
verify: browser
spec: docs/nodes/behavior/ui-action.md
tests: tests/e2e/nodes/behavior/ui-action.tests.md
---
# P257 — ui-action `select`-Verb real machen

> Ausgekoppelt aus **P256** (2026-07-20). Der Konformitäts-Pass maß `select` als
> **inert** und der Owner entschied **implementieren** (statt aus dem `actionType`-
> Enum entfernen). Weil echtes `select` mehrere Knoten mit je eigener Aktivierungs-
> Semantik + Serializer-Hooks berührt, ist es ein eigenes Feature-Paket, kein
> „leichter" Rest.

## findings (gemessen in P256)

- Das `select`-Command **wird gepusht**, aber der Client löst den `part` via
  `[name="<part>"]` auf — das trifft bei ui-tabs den **`sl-tab-panel[name]`-Body**,
  **nicht** das aktivierende **`sl-tab[slot="nav"][panel="<id>"]`-Nav-Element**
  (bestätigt in `webapp-serializer.js`: tabs rendern `sl-tab slot="nav" panel="<id>"`
  **+** `sl-tab-panel name="<id>"`). Ein Klick/Aktivieren des Panel-Bodys wechselt
  den aktiven Tab nie ⇒ `select` ist wirkungslos.
- Anders als ui-accordion (dessen `sl-details` einen `data-webapp-part`-Hook tragen,
  P247) exponieren **tab/stepper/menu/table-Items keinen auflösbaren Aktivierungs-
  Hook**. Das ist die Lücke.
- Der P256-Test `select(part) → der Ziel-Tab wird aktiv` liegt als lauffähiger
  `test.fixme` in `tests/e2e/nodes/behavior/p256-verbs-focus-reset-select.spec.ts`
  vor — Ausgangspunkt.

## acceptance

- **Aktivierungs-Hook je aktivierbarem Knoten.** Der Serializer emittiert auf dem
  **aktivierenden** Element (nicht dem Inhalt) einen auflösbaren Part-Hook
  (Muster: ui-accordions `data-webapp-part`, P247):
  - **ui-tabs** → auf `sl-tab[slot="nav"]` (das Nav-Tab, nicht das Panel).
  - **ui-stepper** → auf dem Step-Button.
  - **ui-menu** → auf dem Menü-Item.
  - **ui-table** → auf der Zeile (Row-Select-Semantik; ggf. Abgleich mit dem
    bestehenden `rowSelect`-Pfad — kein Doppel-Mechanismus).
- **Client-`select` aktiviert das per `part` benannte Item** am richtigen Element
  (nicht am Body). Für jeden Knotentyp die native Aktivierung auslösen (Tab
  aktiv-setzen, Step aktivieren, Menü-Item markieren, Zeile selektieren).
- **Beobachtbar gemessen (Browser)** je Knoten: `ui-action(select, target=<node>,
  part=<id>)` → das benannte Item ist **aktiv** (gemessener DOM-Zustand: `active`-
  Attribut / aktive Klasse / Selektion), abgrenzbar vom Vorzustand
  ([[verify-rendering-by-measurement-not-tags]]). Der P256-`fixme` wird zu grün.
- **Kein Regress** an den soliden Item-/Event-Pfaden (tabs tabChange, stepper change,
  menu navigate, table rowSelect) — die bestehenden E2E bleiben grün.
- **Spec** `docs/nodes/behavior/ui-action.md`: `select` mit beobachtbarer Wirkung je
  Ziel-Typ dokumentiert; Katalog `ui-action.tests.md` gespiegelt.
- **E2E grün** (Haupt-Checkout); Tripwires + `pnpm validate` grün.

## verify

`browser` — je Knotentyp die Aktivierung per gemessenem DOM-Zustand belegt; der
Serializer-Hook sitzt auf dem aktivierenden Element; keine Regression der
bestehenden Item-Event-Tests.

## spec

`docs/nodes/behavior/ui-action.md` — `select`-Verb: pro aktivierbarem Ziel-Typ die
Aktivierungs-Semantik + beobachtbare Wirkung.

## tests

`tests/e2e/nodes/behavior/p256-verbs-focus-reset-select.spec.ts` (den `select`-
`fixme` zu einem echten Test je Knotentyp ausbauen) + `ui-action.tests.md`.

## notes for the implementer

- **Präzedenz ist ui-accordions `data-webapp-part`** (P247) — nicht neu erfinden.
- **ui-table:** prüfen, ob `select` den bestehenden `rowSelect`-Pfad
  (`webapp.js:2647`) nutzen soll statt eines zweiten Mechanismus.
- Umfang groß genug für inkrementelle Commits (ein Knotentyp pro Commit) —
  Ausfallsicherheit.

---
id: P262
node: ui-route
title: "Deklarative Authz: `requiresGroup[]` an ui-route + ui-dialog — server-erzwungen bei Render, Snapshot, Navigation und Event-Dispatch; „visibleIf ist UX, Guard ist Sicherheit\""
epic: aspects/auth
status: in_progress
dependencies: [P261]
verify: browser
spec: docs/nodes/concepts/auth.md
tests: tests/e2e/nodes/structure/ui-route.tests.md
---
# P262 — Route-/Dialog-Guards (Authz)

> Rationale: **[ADR 0041](../../../adr/0041-auth-model-idp-agnostic-identity-trusted-header-first.md)** §4.

## findings

- Nach P261 existiert `user` (inkl. `groups[]`) im Request-/Render-Kontext — aber
  jede authentifizierte Person sieht **alle** Routen/Dialoge.
- UI-seitiges Ausblenden (`visibleIf` auf `user.groups`) wäre möglich, ist aber
  **keine** Sicherheit: `/snapshot` + direkte URL liefern die Inhalte trotzdem.

## acceptance

- **Feld `requiresGroup`** (string[], optional) an `ui-route` und `ui-dialog`:
  Schema + Editor (editableList oder kommasepariertes Feld — Editor-Konvention
  folgen) + Roundtrip (`check:roundtrip`); leer/absent ⇒ nur Authentifizierung
  nötig (P261-Verhalten), gesetzt ⇒ User braucht **mindestens eine** der Gruppen.
- **Server-seitig an allen vier Wirkstellen erzwungen:**
  1. **Page-Render** einer geschützten Route ⇒ 403-Verhalten (definierte
     403-Seite; kein Inhalts-Leak im HTML),
  2. **`/snapshot`** enthält geschützte Routen/Dialoge **nicht** (weder Struktur
     noch Daten),
  3. **Navigation** (ui-action navigate) auf eine geschützte Route ⇒ abgewiesen
     (definiertes Verhalten, kein stiller Erfolg),
  4. **Event-Dispatch** (`/event`) an Komponenten einer geschützten Route/eines
     geschützten Dialogs ⇒ abgelehnt (strukturierter Fehler nach logs-errors.md).
- **Menü-Konsistenz dokumentiert + belegt:** ein ui-menu-Item auf eine geschützte
  Route wird via `visibleIf`-Empfehlung ausgeblendet (UX); der Beweis der
  Sicherheit ist der **direkte URL-Zugriff → 403** trotz verstecktem Menüpunkt.
- **Browser-Beweise (gemessen):** User mit Gruppe sieht Route + Inhalt; User ohne
  Gruppe: 403-Seite bei direkter URL, kein Routen-Inhalt im Snapshot-JSON, Event
  an geschützte Komponente abgelehnt, Dialog mit `requiresGroup` erscheint nicht
  via `?dialog=`.
- **Spec-Regel** „visibleIf ist UX, Guard ist Sicherheit" in `auth.md` + den
  Route-/Dialog-Specs; Feldtabellen Detail-Bar-vollständig (Werte, Default,
  Semantik „mindestens eine Gruppe", 403-Verhalten).
- Volle E2E + `pnpm validate` + Tripwires grün.

## verify

`browser` — alle vier Wirkstellen je mit/ohne Gruppe gemessen (Header-Fake-Muster
aus P261); Snapshot-JSON inspiziert (kein Leak).

## spec

`docs/nodes/concepts/auth.md`, `docs/nodes/structure/ui-route.md`,
`docs/nodes/structure/ui-dialog.md`.

## tests

`tests/e2e/auth/guards.spec.ts` (+ Katalog) + Route-/Dialog-Kataloge.

## notes for the implementer

- Enforcement gehört in die **zentralen** Pfade (Render/Snapshot-Filter,
  Navigations-Handler, Event-Dispatch) — nicht in einzelne Knoten.
- Semantik bewusst einfach (ANY-of-groups); Rollen-Ausdrücke/Policies sind
  Nicht-Ziel (kein Policy-DSL vor 1.0).
- Der Dialog-Fall nutzt das P245-Route-Scoping-Wissen (`renderer.ts` Dialog-Filter)
  als Ansatzpunkt.

---
id: P262
node: ui-route
title: "Deklarative Authz: `requiresGroup[]` an ui-route + ui-dialog — server-erzwungen bei Render, Snapshot, Navigation und Event-Dispatch; „visibleIf ist UX, Guard ist Sicherheit\""
epic: aspects/auth
status: done
dependencies: [P261]
verify: browser
spec: docs/nodes/concepts/auth.md
tests: tests/e2e/nodes/structure/ui-route.tests.md
---
# P262 — Route-/Dialog-Guards (Authz)

> Rationale: **[ADR 0041](../../../../adr/0041-auth-model-idp-agnostic-identity-trusted-header-first.md)** §4.

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

## Result

**Done 2026-07-23.** Deklarative Authz steht — `requiresGroup[]` (ANY-of) an
ui-route + ui-dialog, server-erzwungen an allen vier zentralen Wirkstellen.
**Damit ist das 1.0-kritische Auth-Epic (P260→P261→P262) vollständig.**

### Die 5 Einheiten (je sofort committet)

1. `9e13f3e` — **`requiresGroup`-Feld** (string[], ANY-of) an ui-route + ui-dialog:
   Schema, Model-Durchreiche, Editor (kommasepariert, Haus-Konvention);
   leer/absent ⇒ nur Authentifizierung (P261-Verhalten).
2. `92f6344` — **Enforcement an den vier zentralen Punkten** (zentrale Pfade,
   kein per-Knoten-Code): (a) Page-Render geschützter Route ⇒ **403-Seite ohne
   Inhalts-Leak**; (b) `/snapshot` ⇒ Route-403 + **Dialog-Exklusion** (weder
   Struktur noch Daten); (c) **per-Connection-Navigations-Abweisung** (ui-action
   navigate auf geschützte Route, kein stiller Erfolg); (d) Event-Dispatch an
   geschützte Komponenten ⇒ **403 strukturierter Fehler** (logs-errors.md).
3. `d2dd98c` — **Reaktives Global `user`**: Identität in reactive-Expressions für
   das dokumentierte visibleIf-Ausblende-Muster (Renderer + Editor-Completion).
4. `132a464` — **10 E2E** (`guards.spec.ts`, Header-Fake-Muster inkl. Groups) +
   Kataloge; dabei ein echter Fix: `requiresGroup` wurde ins kompilierte Modell
   von webapp.js durchgereicht (Routes + Dialoge). Beweise: mit Gruppe Route+Inhalt;
   ohne Gruppe 403 bei direkter URL, **kein geschützter Inhalt im Snapshot-JSON**
   (inspiziert), Event abgelehnt, Dialog erscheint nicht via `?dialog=`, und die
   **Menü-Konsistenz**: via visibleIf verstecktes Menü-Item (UX) + direkter
   URL-Zugriff → 403 (Sicherheit).
5. `bbc773e` — **Doku**: Feldtabellen Detail-Bar-vollständig (ANY-of, Default,
   403-Verhalten), auth.md-Guard-Abschnitt + die Regel **„visibleIf ist UX, Guard
   ist Sicherheit"**, reaktives user-Global, Fehler-Codes.

### Verifikation

**Voll-Suite (Worktree-Gate): 891 passed, 0 failed, `--retries=0`, 16,6 min** (+10
Guards-E2E). **Orchestrator-Merge-Gate:** Build grün, Unit **2260** (schema 510 /
editor 196 / renderer 169 / runtime 1385), Guards-Spec im Haupt-Checkout **10
passed**, alle Tripwires grün — **diesmal keine Pin-Zwillinge** (die P261-Lektion
war im Brief; der Agent hat Vokabular-Erweiterungen gegen Unit- UND E2E-Pins
gegrept). Semantik bewusst einfach (ANY-of, kein Policy-DSL vor 1.0);
Session-/Cookie-Code bleibt P264.

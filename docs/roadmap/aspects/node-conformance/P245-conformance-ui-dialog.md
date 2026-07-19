---
id: P245
node: ui-dialog
title: "Konformitäts-Pass ui-dialog — `modal` ist inert (Serializer ignoriert es), `routeId` funktioniert aber ist unterdokumentiert+ungetestet, Inline-Hilfe zu dünn"
epic: aspects/node-conformance
status: pending
dependencies: []
verify: browser
spec: docs/nodes/structure/ui-dialog.md
tests: tests/e2e/nodes/structure/ui-dialog.tests.md
---
# P245 — Konformitäts-Pass ui-dialog

> Audit 2026-07-17 (node-conformance). ui-dialog ist im **Kern solide** — Spec
> detailliert, 6 outcome-E2E (`?dialog=`-Sichtbarkeit, Kind im `.webapp-dialog`,
> `sl-dialog`+Titel, `closable:false`→no-header) + Roundtrip + Unit-Events. Zwei
> echte Feld-Befunde und eine dünne Inline-Hilfe.

## findings

### A. `modal` ist inert — der Serializer ignoriert es
Die Spec: *„`modal` … Legt fest, ob der Rest der App während der Anzeige geblockt
wird (Light-Box) oder nicht. Default: `true`."* **Gemessener Ist-Zustand:**
- `mapConfig` (webapp.js:6994) und das AppModel (renderer.ts:159) tragen `modal`
  brav durch — aber der **HTML-Serializer** `renderDialogHtml`
  (`resources/lib/webapp-serializer.js:1605`) baut das `sl-dialog` **nur** mit
  `open`, `label` und (bei `!closable`) `no-header`. **`modal` wird nirgends
  emittiert**; ein `no-modal`/Overlay-Toggle existiert im ganzen Repo nicht.
- `sl-dialog` ist **nativ immer modal** (eigenes Overlay/Backdrop). ⇒ `modal:false`
  erzeugt **identisches** HTML wie `modal:true`.
- **Ungetestet:** `p64-dialog-serializer.test.ts` nutzt nur `modal:true`.
⇒ Ein dokumentierter Light-Box-Schalter ohne jede Wirkung.

### B. `routeId` funktioniert — die Spec untertreibt
Die Spec-„Offene Punkte" sagt: *„Die explizite Modellierung der Route-/Dialog-
Kopplung (`routeId`-Lebenszyklus) ist noch nicht ausspezifiziert."* **Ist-Zustand:
es ist implementiert.** `packages/renderer/src/renderer.ts:2244` filtert Dialoge
nach Route: `.filter(d => !d.routeId || d.routeId === routeMatch.route.id)` — ein
Dialog mit `routeId` erscheint **nur bei aktiver passender Route**. Das ist reales,
beobachtbares Verhalten.
- **Aber:** die Felder-Tabelle beschreibt nur vage „Kopplung … Routing-Kontext",
  die „Offene Punkte" nennt es unfertig, und **kein E2E** prüft das Route-Scoping
  (nur der Roundtrip-Test deckt den Editor-Persist ab).
⇒ Funktionierendes Verhalten, das die Spec fälschlich als offen führt und kein Test belegt.

### C. Inline-Hilfe zu dünn (Dimension 3)
`data-help-name="ui-dialog"` ist nur: *„Definiert einen Dialog mit eigenem
Layout."* + Doku-Link. Die Spec selbst schreibt vor, die Hilfe solle Zweck +
`open`/`close`, `closable`, `modal` und die `onOpen`/`onClose`-Events nennen — der
tatsächliche Text nennt **nichts** davon.

### D. Kleinere / nicht hier
- **Feldname-Drift `layout` (Schema) vs `layoutId` (Editor + mapConfig
  `layout: config.layoutId`).** Das ist die bekannte Referenz-Feld-Normalisierung
  **P228/ADR 0038** (deferred) — **nicht hier duplizieren**, nur vermerken.
- **Keine Base-Fields** (`visible`/`disabled`/`color`) — für einen Dialog korrekt
  (*„Offenlegung statt Sichtbarkeit"*, open/close statt show/hide). Als bewusste
  N/A in der Spec festhalten.

### E. Was solide ist (nicht neu aufbauen)
`title` (als `sl-dialog label`), `closable:false`→`no-header`, `?dialog=<id>`-
Server-Render-Sichtbarkeit, Kind-Mounting in `.webapp-dialog`, `onOpen`/`onClose`
(inkl. impliziter Close bei X/ESC/Overlay), Roundtrip `routeId`.

## acceptance

- **`modal` aufgelöst** (Owner-Entscheid, s. u.) — nach dem Paket stimmen Spec und
  Verhalten überein:
  - *dokumentieren:* die Spec sagt, dass Dialoge **heute immer modal** sind
    (backend-nativ), und `modal` ist entweder als **noch nicht umgesetzt** markiert
    oder aus Schema+Editor+Spec **entfernt** — kein dokumentierter Schalter ohne Wirkung.
  - *implementieren:* `modal:false` erzeugt einen **gemessenen** Unterschied (z. B.
    kein Backdrop / Klick hinter dem Dialog bleibt möglich) + Test.
- **`routeId` wahrheitsgemäß dokumentiert + getestet.** Die Felder-Tabelle
  beschreibt das reale Route-Scoping (Dialog nur bei passender aktiver Route
  darstellbar); die falsche „Offene Punkte"-Zeile ist entfernt/korrigiert. **Neuer
  E2E (gemessen):** ein Dialog mit `routeId=R` ist unter `?dialog=<id>` bei aktiver
  Route R sichtbar, bei anderer Route **nicht** vorhanden.
- **Inline-Hilfe** nennt Zweck + `open`/`close`, `closable`, `modal`-Status und
  `onOpen`/`onClose` (wie die Spec es vorschreibt); Doku-Link bleibt.
- **Base-Fields-N/A** in der Spec vermerkt (kein visible/disabled/color; open/close-Modell).
- **Katalog** `ui-dialog.tests.md` spiegelt den neuen routeId-Test (+ modal, falls implementiert).
- **E2E grün** (Haupt-Checkout); `check:specs`/`check:fields`/`check:help`/
  `check:roundtrip`/`check:links` + `pnpm validate` grün.

## verify

`browser` — das routeId-Route-Scoping und (falls implementiert) `modal:false` per
gemessenem DOM belegt; die bestehenden 6 Dialog-Tests bleiben grün.

## spec

`docs/nodes/structure/ui-dialog.md` — `modal`-Wahrheit, `routeId`-Verhalten
dokumentiert (Offene-Punkte-Zeile korrigiert), Base-Fields-N/A vermerkt.

## tests

`tests/e2e/nodes/structure/ui-dialog.spec.ts` + `ui-dialog.tests.md`. Neu:
routeId-Route-Scoping (sichtbar bei R, weg bei R'); modal (falls implementiert).

## notes for the implementer

- **`layout`/`layoutId`-Drift NICHT hier anfassen** — gehört zu P228 (deferred).
- **`modal`-Entscheid ist substanziell:** ein echt nicht-modaler Dialog braucht ein
  anderes Primitive als `sl-dialog` (immer modal) — im Zweifel dokumentieren, nicht
  implementieren.
- `routeId`-Test: der Renderer-Filter sitzt in `renderer.ts:2244`; die
  `?dialog=`-Sichtbarkeits-Tests (bestehend) sind das Muster für den neuen Test.

## Owner-Entscheid (vor Umsetzung zu bestätigen)

1. **`modal`:** dokumentieren „Dialoge sind heute immer modal" (Feld als
   Zukunft markieren **oder entfernen**) — oder einen echt nicht-modalen Dialog
   **implementieren** (anderes Primitive/Overlay-Handling)? Empfehlung:
   dokumentieren/entfernen (sl-dialog ist nativ immer modal; nicht-modal ist ein
   neues Feature, kein Bugfix).

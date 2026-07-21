---
id: P258
node: ui-action
title: "ui-action `reset`-Verb implementieren — Wert-Reset auf Initialzustand je Form-Control"
epic: aspects/node-conformance
status: pending
dependencies: []
verify: browser
spec: docs/nodes/behavior/ui-action.md
tests: tests/e2e/nodes/behavior/ui-action.tests.md
---
# P258 — ui-action `reset`-Verb real machen

> Ausgekoppelt aus **P256** (2026-07-20). Der Konformitäts-Pass maß `reset` als
> **inert** und der Owner entschied **implementieren**. „Reset auf Initialwert" hat
> eine nicht-triviale, pro-Ziel-Typ verschiedene Semantik ⇒ eigenes Paket.

## findings (gemessen in P256)

- Das `reset`-Command **wird gepusht**, aber der Client-Handler löscht nur die
  `open`/`selected`-Interaktions-Overlay-Flags des Ziels und re-rendert — er setzt
  **nie einen Feld-Wert zurück**. Gemessen: ein getippter `ui-input` behielt seinen
  Wert („scratch" überlebte den Reset).
- **Offene Semantik-Frage (Owner-Richtung nötig vor Umsetzung, s. u.):** „Initialwert"
  bedeutet pro Ziel-Typ Verschiedenes — der beim Deploy/Render gerenderte Wert
  (`value`-Attribut) vs. eine gebundene Store-Quelle vs. leer. Und für Nicht-Form-
  Ziele (`ui-app`/`ui-route`) ist `reset` womöglich N/A.
- Der P256-Test `reset → der ui-input-Wert kehrt in den Initialzustand zurück` liegt
  als lauffähiger `test.fixme` vor.

## acceptance

- **`reset` setzt den Live-Wert eines Form-Control-Ziels auf seinen Initialzustand**
  — beobachtbar gemessen: in einen `ui-input` „scratch" tippen → `ui-action(reset,
  target=<input>)` → der gemessene Control-Wert ist wieder der initial gerenderte
  ([[verify-rendering-by-measurement-not-tags]]). Der P256-`fixme` wird grün.
- **Anwendbare Ziel-Typen** definiert und je einer gemessen: mindestens
  `ui-input`/`ui-textarea` (Text zurück auf initial), und — je nach Owner-Entscheid
  (s. u.) — `ui-datepicker`/`ui-select`/`ui-slider`/`ui-checkbox`/`ui-radio`/
  `ui-switch`. Für **nicht** unterstützte Ziel-Typen: dokumentierter No-op (kein Crash).
- **„Initialwert"-Definition dokumentiert** (welche Quelle: gerenderter `value` /
  gebundener Store-Initialwert / leer) — konsistent über die unterstützten Controls.
- **Kein Regress** an Write-Back/Binding-Pfaden der Form-Controls; bestehende E2E grün.
- **Spec** `docs/nodes/behavior/ui-action.md`: `reset` mit Ziel-Typen + Initialwert-
  Semantik; Katalog gespiegelt.
- **E2E grün** (Haupt-Checkout); Tripwires + `pnpm validate` grün.

## verify

`browser` — der Wert-Reset per gemessenem Control-Wert (vorher getippt, nachher
initial) belegt; No-op für nicht unterstützte Ziele; keine Write-Back-Regression.

## spec

`docs/nodes/behavior/ui-action.md` — `reset`-Verb: unterstützte Ziel-Typen +
Initialwert-Definition + beobachtbare Wirkung.

## tests

`tests/e2e/nodes/behavior/p256-verbs-focus-reset-select.spec.ts` (den `reset`-`fixme`
zu echten Tests je unterstütztem Control ausbauen) + `ui-action.tests.md`.

## notes for the implementer

- **Vor der Umsetzung die Initialwert-Quelle mit dem Owner klären** (der P256-Befund
  nennt sie ausdrücklich als offen) — nicht raten. Empfehlung als Startpunkt: der
  initial gerenderte `value` (das im Erst-HTML servierte Attribut), da deterministisch
  und pro Control einheitlich; Store-gebundene Controls ggf. auf den Store-Initialwert.
- Ein einheitlicher Client-Mechanismus (Ziel auflösen → Control-Wert auf Initial
  zurücksetzen → Change-Event feuern, damit Write-Back/Bindings konsistent bleiben)
  ist wahrscheinlich sauberer als pro-Knoten-Zweige.
- Inkrementelle Commits je Control-Typ.

## Owner-Entscheid (vor Umsetzung zu bestätigen)

1. **Initialwert-Quelle:** gerenderter `value` (Deploy-Zeit) — oder gebundener
   Store-Initialwert bei store-gebundenen Controls — oder schlicht leer?
2. **Umfang der Ziel-Typen:** nur Text (`ui-input`/`ui-textarea`) — oder der volle
   Form-Control-Satz (datepicker/select/slider/checkbox/radio/switch)?

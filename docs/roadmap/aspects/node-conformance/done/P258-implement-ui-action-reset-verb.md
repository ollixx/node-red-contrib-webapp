---
id: P258
node: ui-action
title: "ui-action `reset`-Verb implementieren — Wert-Reset auf Initialzustand je Form-Control"
epic: aspects/node-conformance
status: done
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

## Owner-Entscheid (2026-07-21 bestätigt)

1. **Initialwert-Quelle = Store-Initialwert bei Binding.** Store-gebundene Controls
   werden auf den **Store-Initialwert** zurückgesetzt; ungebundene Controls auf den
   **gerenderten `value`** (Deploy-Zeit). Zwei Pfade, aber die mächtigere Semantik.
2. **Umfang = voller Form-Control-Satz:** `ui-input`/`ui-textarea`/`ui-datepicker`/
   `ui-select`/`ui-slider`/`ui-checkbox`/`ui-radio`/`ui-switch` — ein einheitlicher
   Client-Mechanismus (Wert auf initial zurück + Change-Event feuern, damit
   Write-Back/Bindings konsistent bleiben).

## Result

**Done 2026-07-21.** Das `reset`-Verb setzt jetzt real den Wert zurück — über **alle
acht** Form-Controls, mit der Owner-Semantik (Store-Initial bei Binding, sonst
gerenderter Wert). **Letztes offenes Paket der P244–P258-Welle.**

### Zwei-Schichten-Bug diagnostiziert + gefixt

- **Server (`nodes/webapp.js`):** `INTERACTION_VERBS_BY_TYPE` gewährte `reset` nur
  input/textarea/datepicker → für die anderen fünf wurde das Command **nie gepusht**
  (`applyCommand` feuerte nie). `reset` zu `ui-select`/`ui-checkbox`/`ui-radio`/
  `ui-switch`/`ui-slider` ergänzt (Owner-Scope = voller Satz).
- **Client (`webapp-client.js`):** der alte Handler löschte nur open/selected-Overlay-
  Flags, setzte nie einen Wert zurück.

### Einheitlicher Mechanismus (ein Pfad, zwei Bedeutungen)

- **`captureInitialControlState()`** friert den erst-servierten `value`/`checked` je
  Control (keyed by node id) ein und **überschreibt ihn nie** — bei Boot + nach jedem
  `applySnapshot`. Das Einfrieren garantiert, dass der gemerkte Initialwert der
  Deploy-Zeit-Wert bleibt, auch wenn ein Store-Wechsel das Control später neu rendert.
- **Bound vs. unbound = ein Pfad:** der eingefrorene erst-servierte Wert **ist** der
  Store-Initial bei gebundenen und der gerenderte `value` bei ungebundenen Controls
  (zur Deploy-Zeit fallen sie zusammen) — kein per-Knoten-Branching.
- **`resetControlToInitial()`** setzt value/`checked` auf initial + dispatcht
  `input`/`change`/`sl-input`/`sl-change`, sodass ein gebundener Store re-synct
  (Change → `/event` → Store-Write-Through → SSE-Re-Render). Nicht-Form-Ziele:
  Overlay-Clear + Re-Render wie bisher (No-op, kein Crash).

### Gemessener Beleg (echtes DOM, Wert → initial) — alle 8 + mehr

11 grüne Tests im gewachsenen P256-`fixme`: ui-input unbound-empty→`""`,
unbound-seeded→`"seed"` (beweist den Rendered-Value-Pfad, nicht nur „leer");
ui-input **store-bound**→Store-Initial `"Alice"` **und** eine zweite gebundene View
re-synct (beweist Bound-Pfad + gefeuerten Change); ui-textarea→`"start"`,
ui-checkbox→`false`, ui-switch→`false`, ui-select→`"a"`, ui-radio→`"a"`,
ui-slider→`10`, ui-datepicker→`"2026-01-01"`; Nicht-Form-No-op auf ui-text (kein
Command, kein pageerror). **Alle 8 sauber gemessen, keiner offen.**

### Verifikation (Haupt-Checkout, autoritativ)

**E2E 831 passed, 0 failed, `--retries=0`, 15,2 min** (E01 stabil — der P257-Fix hält).
Shared Client+Server geändert → Voll-Suite. `pnpm build` + `pnpm validate` + Tripwires
grün. Agent committete inkrementell (3 Commits) VOR der Verifikation, stoppte alle
Prozesse (Port 1882 frei), Haupt-Checkout unberührt. Spec `ui-action.md` + Katalog
spiegeln die reset-Semantik (Initialwert-Quelle, unterstützte Controls, No-op-Ziele).

### Damit ist die ui-action-Verb-Arbeit vollständig

`focus` (P256, getestet), `select` (P257, cross-node), `reset` (P258, 8 Controls) —
alle drei zuvor ungetesteten/inerten Verben sind real und gemessen. Kein `test.fixme`
mehr in der ui-action-Verb-Suite.

---
id: P237
title: "Node-Konformität (Sweep): bindbares Feld als „statischer String / kein Binding\" fehl-dokumentiert — datepicker/slider/image (Muster 4) + Guardrail"
epic: aspects/node-conformance
status: done
dependencies: [P234, P236]
verify: browser
spec: docs/nodes/concepts/field-conventions.md
tests: tests/e2e/nodes/view/ui-image.tests.md
---
# P237 — Sweep: bindbares Feld als „statischer String" fehl-dokumentiert (Muster 4)

> Aus dem Audit-Sweep (node-conformance, 2026-07-16). Cross-Cutting-Cleanup —
> das per-Knoten-Audit fand **dasselbe** wiederholt: ein Feld, das laut Schema
> **und Editor** bindbar ist (`z.union([bindingSchema, z.string()])`, typedInput
> mit `valueBindingTypes`), wird in der Spec noch als reines „Textfeld" bzw.
> ausdrücklich „kein Binding" beschrieben. Das verletzt **[ADR 0012](../../../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md)**
> (Binding-Ubiquität) und die [Feld-Konventionen](../../../../nodes/concepts/field-conventions.md).
> Gebündelt fixen, **nicht** pro Knoten. Kein neuer ADR — Muster 4 setzt eine
> bereits getroffene Entscheidung durch (ADR 0012), analog zu P232/P233.

## findings

Das per-Knoten-Audit stellte fest: mehrere Felder sind **end-to-end bindbar**
(Schema-Union mit `bindingSchema`; Editor-typedInput mit Binding-Typen, geliefert
durch P146/P149/P151 unter ADR 0012), doch ihre Spec (`docs/nodes/**`) behauptet
weiterhin einen statischen String. Ein Flow-Autor kann im Editor eine Bindung
setzen; die Doku sagt ihm fälschlich, das ginge nicht. **Bestätigte Offender
(Schema ↔ Spec):**

| Knoten | Feld | Schema (Wahrheit) | Editor (Wahrheit) | Spec (falsch) |
|---|---|---|---|---|
| `ui-datepicker` | `placeholder` | `z.union([bindingSchema, z.string()]).optional()` (P149) | typedInput, Binding-Typen (P149) | „Editor-Typ: Textfeld" |
| `ui-slider` | `label` | `z.union([bindingSchema, z.string()]).optional()` (P146) | typedInput, `valueBindingTypes({category:"value"})` (P146) | „Editor-Typ: Textfeld" |
| `ui-image` | `alt` | `z.union([bindingSchema, z.string()]).optional()` (P151) | typedInput, Display-Binding (P151) | „Editor-Typ: Textfeld" |
| `ui-image` | `fallbackSrc` | `z.union([bindingSchema, z.string()]).optional()` (P151) | typedInput, Display-Binding (P151) | „Editor-Typ: Textfeld" **+ „Statische URL … Kein Binding — muss eine zur Deploy-Zeit bekannte URL sein."** |

`ui-image.fallbackSrc` ist der schärfste Fall: die Spec **behauptet aktiv** „Kein
Binding", während Schema und Editor eine Bindung akzeptieren.

**Audit-Abgrenzung (die Heuristik-Liste war größer als die echten Findings):**
- `ui-checkbox` — **sauber**, kein Offender: `label`/`value`/`disabled` sind in
  der Spec bereits korrekt als „typedInput (alle Binding-Arten), bindbar"
  dokumentiert. Nicht in P237.
- `ui-button` — dessen Label-Binding-Drift wird im laufenden **P236** (voller
  ui-button-Konformitäts-Pass) behandelt. Nicht in P237 (Doppelarbeit vermeiden).
- `ui-divider`/`ui-progress` — bereits gefixt (P230 bzw. laufendes P234).

## acceptance

- **Spec-Korrektur (Dimension 2, Detail-Bar).** Für jedes der vier Offender-Felder
  beschreibt die Spec das Feld als **bindbar** — Editor-Typ „typedInput" mit der
  passenden Binding-Kind-Liste, im kanonischen Wortlaut der bereits korrekten
  Felder desselben Programms (Vorbild: `ui-datepicker.label`,
  `docs/nodes/input/ui-datepicker.md`):
  - `ui-datepicker.placeholder` — Editor-Typ „typedInput (alle Binding-Arten)"
    statt „Textfeld"; Binding-Kinds gelistet.
  - `ui-slider.label` — „typedInput (alle Binding-Arten)" statt „Textfeld";
    Verhalten „leer ⇒ kein Label" bleibt dokumentiert.
  - `ui-image.alt` — „typedInput (Binding)" statt „Textfeld"; Binding-Kinds gelistet.
  - `ui-image.fallbackSrc` — „typedInput (Binding)" statt „Textfeld"; der Satz
    **„Kein Binding — muss eine zur Deploy-Zeit bekannte URL sein." ist entfernt**
    und durch die korrekte Aussage ersetzt (bindbar; `literal` = statische URL als
    ein Fall unter mehreren).
- **Beobachtbarer Beleg pro Feld (Dimension 4/5 — Test-Lock).** Für **jedes** der
  vier Felder existiert eine outcome-basierte Assertion, die beweist, dass ein
  **dynamisch gebundener** Wert zur Laufzeit aufgelöst **und gerendert** wird (rot,
  wenn die Bindung nicht mehr aufgelöst wird):
  - `ui-datepicker.placeholder` — ein `state`/`store`-gebundener Placeholder
    erscheint als `placeholder`-Attribut des `sl-input` mit dem aufgelösten Wert
    (nicht dem Pfad-String).
  - `ui-slider.label` — ein `state`/`store`-gebundenes `label` erscheint als
    `label`-Attribut des `sl-range` mit dem aufgelösten Wert.
  - `ui-image.alt` — ein `state`/`store`-gebundenes `alt` erscheint als
    `alt`-Attribut des `<img>` mit dem aufgelösten Wert.
  - `ui-image.fallbackSrc` — ein `state`/`store`-gebundenes `fallbackSrc` erscheint
    im `onerror`-Fallback mit der aufgelösten URL.
  - Löst der Renderer eine dieser Bindungen heute **nicht** auf (nur Literale gehen
    durch), ist deren Auflösung **Teil dieses Pakets** — der Editor lässt den Autor
    bereits binden, also ist eine gesetzte-aber-nicht-aufgelöste Bindung ein *live*
    Bug (Autor setzt `alt = state.foo`, gerendert wird der Literal-String
    „state.foo"). Vorbild, dass die Mechanik existiert: `ui-datepicker.label` (bereits
    aufgelöst + getestet).
- **Kataloge aktuell.** Die `.tests.md` von `ui-datepicker`/`ui-slider`/`ui-image`
  listen die neuen Binding-Auflösungs-Tests mit Testziel.
- **Guardrail (Muster-4-Rückkehr verhindern, alle Knoten).** Ein read-only Check
  (Kern-Logik pure + unit-getestet, non-zero-Exit mit `node:field`, verdrahtet in
  `validate` + `test:specs`), der über **alle** `ui-*` meldet, wenn ein Feld im
  Schema binding-capable ist (Union mit `bindingSchema` bzw. direktes
  `bindingSchema`) **und** seine Spec-Feldzeile es als nicht-bindbar dokumentiert
  (Editor-Typ „Textfeld" / Formulierung „kein Binding" / „nicht bindbar"). Landet
  mit **leerer Allowlist** (die vier Offender oben sind dann gefixt; button/progress
  über P236/P234 — daher die Dependencies). Muster wie `scripts/check-no-crash.js`
  (P233) / `scripts/check-fields.js` (P227): Allowlist nur mit ADR-Begründung,
  schrumpfend.
- **E2E grün** (Haupt-Checkout).

## verify

`browser` — die vier Binding-Auflösungs-Assertions laufen im echten App/Editor
(gebundener Wert im gerenderten Attribut gemessen); der Guardrail-Check grün mit
leerer Allowlist; `check:specs`/`check:fields`/`check:help`/`check:roundtrip`/
`check:links`/`check:roadmap` + `pnpm validate` grün.

## spec

- `docs/nodes/concepts/field-conventions.md` — falls nötig einen Satz, dass ein
  binding-capables Feld in der Spec als bindbar dokumentiert wird (Guardrail-Bezug).
- Betroffene Node-Specs: `docs/nodes/input/ui-datepicker.md`,
  `docs/nodes/input/ui-slider.md`, `docs/nodes/display/ui-image.md`.

## tests

Die betroffenen `tests/e2e/nodes/view/ui-datepicker.spec.ts`,
`…/ui-slider.spec.ts`, `…/ui-image.spec.ts` (+ Unit im jeweiligen Paket, wo die
Auflösung serverseitig passiert) und deren `.tests.md`. Für den Guardrail: eine
Unit-Testdatei analog `scripts/check-no-crash.test.ts`.

## notes for the implementer

- **Reihenfolge & Umfang.** Zuerst prüfen, ob der Renderer/Serializer eine
  `state`/`store`-Bindung dieser vier Felder heute schon auflöst (P149/P146/P151
  waren echte Feature-Phasen — sehr wahrscheinlich ja; dann ist der Fix
  **Spec + Test-Lock + Guardrail**, ein reiner Doku-/Test-Batch wie P232/P233).
  Falls **nein** für ein Feld: die Auflösung ergänzen (Mechanik von
  `ui-datepicker.label` / `ui-image.src` spiegeln) — das ist der einzige mögliche
  Code-Anteil.
- **Nicht** die volle Testabdeckung dieser Knoten neu aufbauen — das bleibt dem
  jeweiligen per-Knoten-Konformitäts-Pass. Hier nur: die vier bindbaren Felder als
  bindbar dokumentieren + je eine echte Binding-Auflösungs-Assertion + Guardrail.
- **Guardrail-Parsing.** `check-fields.js` parst bereits die HTML-`defaults`-Blöcke,
  `check-specs.js` die Spec-Feldtabellen — den Guardrail an eines von beiden
  anlehnen (Schema-Binding-Fähigkeit aus `node-definitions.ts` bzw. den
  HTML-typedInput-Carriern ableiten, gegen die „Editor-Typ"-Spalte der Spec).
- **Abgrenzung Dependencies.** `P234` (ui-progress) und `P236` (ui-button) fixen
  ihre eigenen binding-doc-Drifts; P237 wartet darauf, damit der Guardrail mit
  leerer Allowlist grün landet (kein Cross-Package-Flag). Sollten P234/P236 ihre
  Felder doch nicht abdecken, seed die Allowlist minimal + schrumpfend statt zu
  blockieren.

## Result

**Delivered.** Muster-4-Sweep: 4 bindbare Felder als bindbar dokumentiert + je eine gemessene Auflösungs-Assertion + Schema-Wahrheits-Guardrail. Jedes Feld empirisch geprüft (bound flow → renderer→serializer, nicht angenommen).
- **`ui-datepicker.placeholder` — CODE-FIX:** der Renderer löste die Bindung nach `props.placeholder` auf, aber der datepicker-Serializer emittierte das `placeholder`-Attribut nie (anders als ui-input/select). Emit ergänzt (`resources/lib/webapp-serializer.js`) → rendert jetzt `placeholder="<aufgelöst>"`. Ein *live* Bug (Autor konnte binden, wurde nie gerendert).
- **`ui-slider.label` / `ui-image.alt` / `ui-image.fallbackSrc` — bereits aufgelöst** (nur Doku + Test-Lock). `ui-image.fallbackSrc`: der falsche „Kein Binding"-Satz entfernt + durch die bindbare Aussage ersetzt; Carrier-Relabel `fallback`↔`fallbackSrc` in der Spec benannt + stale check-specs-Allowlist-Grund korrigiert.
- **Tests** `packages/runtime/test/p237-{datepicker-placeholder,slider-label,image-alt-fallback}-binding.test.ts` (8 Assertions): `state`-gebundener Wert → renderer→serializer → aufgelöster Wert im Attribut, Pfad-String leakt nie. Kataloge aktualisiert.
- **Guardrail** `scripts/check-binding-docs.js` (+ `.test.ts`, 12 Unit-Tests; Comment-Stripping-Bug beim Entwickeln selbst gefangen + gelockt): Schema als Wahrheit — flaggt jedes `bindingSchema`-fähige Feld, dessen Spec-Zeile „Textfeld"/„kein Binding" sagt. In `check:binding-docs`+`validate`+`test:specs`.

**Guardrail-Ertrag (Schema-Wahrheit fand mehr als das manuelle Audit):** dieselbe Muster-4-Drift auf **3 weiteren Knoten** — `ui-input.label`, `ui-switch.label/labelOn/labelOff`, `ui-textarea.label/placeholder` (alle per Probe bestätigt: Bindung löst auf; **Ausnahme `ui-textarea.placeholder`**: löst auf, aber `sl-textarea`-Serializer omittiert das Attribut → braucht denselben datepicker-artigen Fix). Per Escape-Hatch mit 6 Einträgen allowlisted (Grund = je eigener Konformitäts-Pass), NICHT Scope-Creep. **Empfohlene Follow-ups:** Muster-4-Doku-Fix für ui-input/ui-switch/ui-textarea + ui-textarea.placeholder Serializer-Emit + Test → Allowlist auf leer. Als Task-Chip herausgelöst.

**Verify (browser + unit, gemessen — Haupt-Checkout).** `check:binding-docs` grün (31 Knoten, 6 allowlisted); p237-Unit-Tests grün; E2E `ui-datepicker`/`ui-slider`/`ui-image` **34 passed** (datepicker-placeholder-Fix im Browser bestätigt). `check:specs`/`check:fields`/`check:help`/`check:no-crash`/`check:roundtrip`/`check:links`/`pnpm validate` grün.

**Cost.** Sub-Agent `phase/P237` (worktree), ~17 min (empirisch verifiziert; ein Anlauf am Rate-Limit ohne Commits gestorben, neu gestartet). Token-Zeile in `.ai/agent-runs.jsonl`.

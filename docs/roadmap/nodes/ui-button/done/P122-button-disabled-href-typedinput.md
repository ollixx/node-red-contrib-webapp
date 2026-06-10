---
id: P122
node: ui-button
epic: nodes/ui-button
title: "ui-button: disabledPath→Boolean-Zustand-typedInput (inkl. Store) + href→URL/Pfad-typedInput"
findings:
  - "ui-button hat noch keine typed inputs. (Anm.: label ist via P113 abgedeckt; disabled und href waren die Lücke.)"
  - "alle values möglichst immer auch alle Bindings bekommen. Gerade bei Disabled ist ein Store-Binding unbedingt nötig. Das gilt für alle values in allen Knoten. Reduzieren wollen wir nur da, wo es zwingend oder sinnvoll ist."
verify: browser
spec: docs/nodes/display/ui-button.md
tests: tests/e2e/nodes/view/ui-button.tests.md
dependencies: [P113]
status: done
---
# P122 — ui-button: bindbares disabled + href

> Prinzip & Matrix: [ADR 0012](../../../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md).
> Fundament (Kategorie-Typsätze im Helfer): **P113** (vorausgesetzt). Reines
> Editor-Paket — Runtime kann beides bereits (Renderer löst `bind.disabled`,
> webapp.js/Renderer lösen `bind.href` seit P71). `label` ist via P113 erledigt.

## Befund (heute)

- `disabledPath` ist ein nacktes Textfeld (roher state-Pfad); kein typedInput,
  kein Store-Picker. `disabled` (Wert) wird daraus abgeleitet.
- `href` (nur `linkMode: link`) ist statischer Text; obwohl die Runtime `href`
  bereits als Binding auflösen kann (P71), bietet der Editor keine Binding-Wahl.

## Zielmodell (Editor)

- **`disabled`** wird ein **Boolean-Zustand**-typedInput aus dem P113-Helfer:
  Store, Query, Route-Param, Reactive, msg, JSONata, **boolean**, Flow, Global,
  Env (kein string/number/json/timestamp). Persistiert als Binding-Objekt
  `{kind,…}` in `disabled`. **Migration:** ein bestehender `disabledPath` wird
  beim ersten Öffnen in `{kind:"state", path:<disabledPath>}` überführt
  (Muster wie P97/P98 für valuePath), `disabledPath` danach geleert.
- **`href`** wird ein **URL/Pfad**-typedInput: str, msg, JSONata, Store,
  Reactive, Flow, Global, Env (kein number/boolean/json/timestamp). Persistiert
  als Binding-Objekt; ein bestehender literaler `href`-String migriert zu
  `{kind:"literal", value:<href>}`. Nur sichtbar/relevant bei `linkMode: link`.

## acceptance (observierbar, browser)

- `disabled`-typedInput bietet genau den Boolean-Zustand-Satz (mit **Store**);
  Auswahl `Store → <ui-store>` graut den Button aus, sobald der Store truthy ist
  (Live, ohne Reload). Round-Trip: Binding-Objekt überlebt Schließen/Öffnen.
- Migration: ein vor-P122-Knoten mit gesetztem `disabledPath` öffnet als
  `state`-Binding mit demselben Pfad; Verhalten unverändert.
- `href`-typedInput bietet den URL/Pfad-Satz; jsonata-`href` baut die URL zur
  Laufzeit; literaler `href` migriert verlustfrei.
- Deploy der Beispiel-App + bestehende ui-button-E2E bleiben grün.

## spec / tests

- `docs/nodes/display/ui-button.md`: Felder `disabled`/`href` auf typedInput
  (Kategorie + Sätze + Migration) umschreiben; auf ADR 0012 verweisen.
- `tests/e2e/nodes/view/ui-button.tests.md`: Fälle disabled-Store-Binding,
  disabledPath-Migration, href-Binding ergänzen.

## Result

- **delivered:** ui-button `disabled`→Boolean-Zustand-typedInput und `href`→URL/Pfad-typedInput (ADR 0012), beide über den kanonischen P113-Helfer. `nodes/view/ui-button.html`: `disabledBinding`/`hrefBinding` Dummy-Defaults; `disabled` als `valueBindingTypes({category:"boolean"})`, `href` als `valueBindingTypes({category:"url"})`; `oneditprepare` initialisiert beide typedInputs mit Migration aus Legacy `disabledPath`/Literal-`href`; `oneditsave` persistiert als Binding-Objekte und löscht `disabledPath`. `editor-common.js`: href-Feld-Injection aus `installButtonLinkFields` entfernt (href ist jetzt typedInput), Sichtbarkeits-Attribut `data-button-href-row="hrefBinding"`. **Helfer aus P113 konsumiert, nicht neu definiert** (editor-common-Delta +5/−9).
- **stats:** Merge (+84/−15); 12 neue Unit-Tests (Binding-Round-Trips + Legacy-Migration). Maßgebliche volle E2E auf gebautem develop: 433 passed + der eine veraltete P71-Cross-Cutting-Spec (href-Feld) auf den typedInput-Kontrakt nachgezogen und grün (16/16 p71+ui-button) → effektiv alle grün. Unit 871.
- **notes:** Runtime/Schema unverändert nötig (webapp.js `mapConfig` war seit P71/P97 binding-objekt-fähig für href + disabled) — reine Editor-Änderung. **Muster für P123–P130.** Erster Spawn musste verworfen werden (Worktree von stale develop pre-P113 → Helfer reimplementiert); Neuversuch mit gepinnter SHA + Ancestry-Gate sauber.
- **cost:** Re-Spawn session ca7d046, ~8m, Modell sonnet (erster Versuch verworfen).

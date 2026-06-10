---
id: P132
title: "store-Binding-Editor: Button-erst (Store-Icon) + Name statt ID + Pfad-typedInput (string/number/routeParam/query/store/reactive/jsonata/msg/flow/global/env) mit Default-Slice-Autocomplete"
epic: aspects/editor
status: pending
dependencies: [P113, P131]
spec: docs/nodes/concepts/editor.md
tests: tests/e2e/nodes/state/ui-store.tests.md
---
# P132 — store-Binding-Editor: Name-erst + Pfad-typedInput

> Entscheidung & Begründung: [ADR 0013](../../../adr/0013-store-binding-subpath.md).
> Unterbau (Schema/Renderer/Guard): **P131** (vorausgesetzt). Kanonischer Helfer:
> **P113**. Reines Editor-Paket in `resources/lib/editor-common.js`.
> Korrigiertes UI: siehe die Skizzen zu ADR 0013 (Label links, Store-UI rechts,
> Button-erst, Store-Icon, Name statt ID).

## findings (Nutzer-Wortlaut, 2026-06-10)

- "warum wird nach Auswahl des Stores im Input eine ID angezeigt?"
- "in dem input feld beschreibe ich den Pfad innerhalb des Slices, … hier 'c'."
- Korrekturen aus dem Skizzen-Review: Label des Feldes **immer links** (Spalte 1);
  das Store-UI in Spalte 2. Bild 1 = **nur ein Button** „Store auswählen", der
  Dialog öffnet; **erst danach** erscheint das typedInput. Der Button bleibt oben
  und wird zu „Store ändern". Der Button trägt **dasselbe Store-Icon wie der
  typedInput** (`fa fa-database`). Kein zweites/dekoratives Glyph neben dem Namen.

## Befund (heute)

- `storeTypedInputType` (`editor-common.js`): das Feld zeigt **roh die Store-ID**
  (`that.value()`); Expand-Button öffnet den Picker. Kein Name, kein Pfad-Feld.

## Zielmodell (Editor)

### 1. Darstellung (Button-erst, Name statt ID)

- **Vor Auswahl:** nur ein Button **„Store auswählen"** mit Store-Icon
  (`fa fa-database`), öffnet den P68-Picker (app-gescoped, P117). **Kein**
  Pfad-typedInput sichtbar.
- **Nach Auswahl:** Button bleibt oben, wird **„Store ändern"** (gleiches Icon);
  daneben der **Name** des Stores (aus der ID aufgelöst via `collectReferenceNodes`),
  **nicht** die ID; kein weiteres Glyph. Gespeichert wird weiterhin die **ID**.
- Das Feld-Label (z. B. „Wert") bleibt in der **linken** Panel-Label-Spalte; das
  gesamte Store-UI sitzt in der Wert-Spalte.

### 2. Pfad-typedInput (erscheint nach Store-Auswahl)

- Unter dem Button ein typedInput für den **`subPath`** — **immer optional**
  (leer = ganzer Slice). Quellen (neue Helfer-Kategorie, Vorschlag
  `valueBindingTypes({ category: "storePath" })`):
  `string, number, routeParam, query, store, reactive, jsonata, msg, flow,
  global, env`. **Default `string`.**
- **Autocomplete aus dem Default-Slice** (weich): Beim Typ `string` werden die
  Keys/Indizes des Default-Slice-Werts des gewählten Stores als Vorschläge
  angeboten (aus dem `ui-store`-Default gelesen). **Kein Zwang, kein Verstecken,
  keine Typ-Einschränkung** aus dem Default (Owner-Entscheid: Editor permissiv,
  Runtime validiert — P131).
- Der `subPath` ist ein **Blatt-Binding**: im Pfad-typedInput wird der Typ
  „Store" zwar als Quelle angeboten, aber **ohne** eigenes Sub-Pfad-Feld
  (Ein-Level-Regel, ADR 0013 §3) — der innere Store liefert seinen ganzen Slice
  als Pfad-String.
- `reactive`/`jsonata` öffnen ihren jeweiligen Ausdrucks-Editor (Reactive: P116;
  JSONata: Node-RED-Standard) über den Expand-Button.

### 3. Serialisierung

- `{ kind:"store", path:<id>, subPath:<Blatt-Binding | weggelassen> }` über den
  P113-Helfer (`readValueBinding`/`applyValueBinding` erweitert um `subPath`).

## Explizit OUT of scope

- Schema/Renderer/Guard/sprechende Laufzeitfehler → **P131**.
- Der Reactive-Ausdrucks-Editor selbst → **P116** (hier nur als Pfad-Quelle
  angeboten).

## acceptance (observierbar, browser)

- **Vor Auswahl:** nur der Button „Store auswählen" (mit DB-Icon); **kein**
  Pfad-Feld; Label „Wert" steht links.
- **Auswahl:** Klick öffnet den app-gescopten Picker; nach Wahl von „monster"
  wird der Button zu „Store ändern", **„monster"** (Name, nicht die ID) erscheint
  daneben, und der Pfad-typedInput taucht auf.
- **Pfad-Satz:** der Pfad-typedInput bietet exakt die 11 Quellen (string default);
  `string`-Autocomplete zeigt `a`/`b`/`c` aus dem Default-Slice; Auswahl „c"
  speichert `subPath:{kind:"literal", value:"c"}`.
- **Dynamisch:** Typ `msg` → Pfad-Feld `payload.selectedKey`; Typ `JSONata` →
  Expand öffnet den Ausdrucks-Editor; Typ `reactive` → P116-Dialog.
- **Round-Trip:** `{kind:"store", path:<id>, subPath}` überlebt Schließen/Öffnen;
  angezeigt wird stets der **Name**, nie die ID.
- **Permissiv:** kein Verstecken/Einschränken des Pfad-Felds aus dem Default-Shape;
  leerer Pfad ist erlaubt (ganzer Slice).
- **Layout:** Label in Spalte 1, Store-UI komplett in Spalte 2 (Editor-Screenshot).

verify: browser

## spec / tests

- spec: `docs/nodes/concepts/editor.md` — Store-typedInput-Abschnitt auf
  „Button-erst + Name + Pfad-typedInput" heben; `docs/nodes/concepts/stores.md`
  (Sub-Pfad) wird von P131 ergänzt, hier referenzieren.
- tests: E2E neu `tests/e2e/nodes/editor/store-binding-subpath.spec.ts`
  (Button-erst, Name statt ID, Pfad-Satz, Autocomplete, Round-Trip); Katalog
  `tests/e2e/nodes/state/ui-store.tests.md` erweitern. Unit: die
  Default-Slice-Autocomplete-Ableitung (Keys/Indizes aus einem Default-Wert) als
  reine Funktion testbar.

## Risiken / Hinweise

- Der Pfad-typedInput nutzt den P113-Helfer mit neuer Kategorie `storePath`; die
  Kategorie-Mechanik kommt aus P113/ADR 0012 — hier nur die neue Quellenliste +
  Default-Slice-Autocomplete ergänzen.
- Name-Auflösung ID→Name über `collectReferenceNodes` (app-gescoped, P117);
  nicht auflösbare ID (gelöschter Store) → `<id> (bestehend)`-Fallback wie bei
  den anderen Referenzfeldern.

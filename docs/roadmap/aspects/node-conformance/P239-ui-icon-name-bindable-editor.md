---
id: P239
node: ui-icon
title: "ui-icon: Icon-Name im Editor bindbar (typedInput) — Auswahl-Dialog bleibt"
epic: aspects/node-conformance
status: pending
dependencies: [P238]
verify: browser
spec: docs/nodes/display/ui-icon.md
tests: tests/e2e/nodes/view/ui-icon.tests.md
---
# P239 — ui-icon: Icon-Name bindbar im Editor (Picker bleibt)

> Rationale: **[ADR 0039](../../../adr/0039-colour-field-model-color-is-tokens-plus-any-colour-variant-is-the-reduction.md)**
> §5 unter [ADR 0012](../../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md)
> (Binding-Ubiquität). Schließt einen **Editor-Exposure-Gap**, keinen Runtime-Gap.

## findings

Der Owner (2026-07-17), ausgehend vom ui-icon-Konformitäts-Pass (P235):

> „vor allem für den icon namen. der ist auch nur statisch über den Selector
> einzustellen. Wieso fällt das nicht auf? Oder ist das so definiert?"

> „icon-name sollte auch bindbar sein. Auswahl Dialog soll trotzdem bestehen."

**Gemessener Ist-Zustand (Audit 2026-07-17):**
- **Schema kann es:** `iconFieldSchema = z.union([z.string().min(1), iconValueSchema, bindingSchema])`
  — `bindingSchema` ist in der Union; `ui-icon.icon: iconFieldSchema`. Der
  Schema-Kommentar sagt ausdrücklich „*binding-capable*".
- **Renderer kann es:** P235 hat ein **state-gebundenes Icon live** bewiesen
  (state-Binding + Store-`replace` via SSE, gemessen im Haupt-Checkout).
- **Der Editor kann es NICHT:** `installIconField` (`resources/lib/editor-common.js`)
  hängt an ein **reines Text-Input** eine Vorschau + einen Button „Icon wählen…",
  der den Picker-Dialog öffnet und ein **Literal** zurückschreibt. Es ist **kein
  typedInput** — es gibt **keinen UI-Weg**, eine state/store/query-Bindung für den
  Icon-Namen zu setzen. Schema und Runtime sind dem Editor voraus; eine
  unterstützte Fähigkeit ist für den Autor **unerreichbar**.
- **Warum kein Wächter das fand:** `check:fields` prüft Feld-Namensmodell (ADR 0038),
  `check:specs` Defaults↔Spec pro Knoten. **Nichts** prüft „deckt das Editor-Control
  die Binding-Fähigkeit des Schemas ab?".

## acceptance

- **Icon-Name bindbar im Editor.** `#node-input-icon` ist ein **typedInput** mit
  dem kanonischen Binding-Satz (ADR 0012: literal/state/store/query/routeParam/
  msg/flow/global/jsonata/env). Browser/Editor: der Autor kann Typ `state` wählen
  und einen Pfad eintragen; nach Deploy zeigt das gerenderte Icon den **aufgelösten**
  Namen, und eine Store-Änderung tauscht das Icon **live** (SSE) — der bereits in
  P235 belegte Laufzeitpfad, jetzt **ohne Handarbeit am Flow-JSON** erreichbar.
- **Der Auswahl-Dialog bleibt.** Im literalen Modus ist der Button „Icon wählen…"
  weiterhin da, öffnet den Icon-Picker und übernimmt die Auswahl als Literal; die
  Icon-**Vorschau** bleibt erhalten. Präzedenz: `ui-image.src` kombiniert Picker
  (`asset` → Media-Dialog) und vollen Binding-Typ-Satz **in einem** Control.
- **Round-trip verlustfrei.** Öffnen→Speichern ohne Änderung erzeugt **keinen**
  Feld-Drift (`check:roundtrip` grün) — weder für ein literales `{library,name}`,
  einen Bare-String (Back-Compat) noch für ein Binding-Objekt.
- **Back-Compat.** Ein deployter Bare-String-Icon-Name (`"home"`) und ein
  `{library,name}`-Wert öffnen unverändert im literalen Modus und rendern wie
  bisher; kein Flow verliert sein Icon.
- **Spec + Inline-Hilfe** dokumentieren `icon` als bindbar (Binding-Kinds gelistet)
  **und** den Picker als literalen Weg — Detail-Bar.
- **E2E grün** (Haupt-Checkout).

## verify

`browser` — der gebundene Icon-Name wird im Editor gesetzt (typedInput-Typ `state`/
`store`), nach Deploy am echten `sl-icon` das aufgelöste `name`-Attribut gemessen +
Live-Tausch via Store/SSE; der Picker-Dialog im literalen Modus real geöffnet und
die Übernahme geprüft; `check:roundtrip`/`check:specs`/`check:help` + `pnpm validate`
grün.

## spec

`docs/nodes/display/ui-icon.md` — `icon` als bindbar dokumentieren (Binding-Kinds,
Picker als literaler Weg, beobachtbare Render-Wirkung).

## tests

`tests/e2e/nodes/view/ui-icon.spec.ts` + `ui-icon.tests.md`. Die 7 gemessenen
P235-Tests (inkl. icon-state-Binding + Store-`replace`) sind der Ausgangspunkt —
neu ist der **Editor-Weg** (typedInput setzen → Deploy → gerendertes Icon) und der
Picker-im-literalen-Modus.

## notes for the implementer

- **`installIconField` ist geteilt** (`resources/lib/editor-common.js`, einzige
  kanonische Kopie). Prüfen, welche Knoten es sonst nutzen (z. B. Icon-Felder auf
  ui-button/ui-list) — die Erweiterung soll dort **additiv** wirken, nicht brechen.
  Ist ein Aufrufer nicht binding-fähig im Schema, dort den literalen Modus behalten.
- **Muster ist `ui-image.src`** (`ui-image.html`): typedInput mit Binding-Typen +
  ein Picker-Typ, der ein Literal zurückschreibt. Nicht neu erfinden.
- `dependencies: [P238]` ist **Kollisionsvermeidung**, keine fachliche Abhängigkeit:
  P238 fasst `ui-icon.html`/`editor-common.js` bereits an; zwei Agenten gleichzeitig
  auf denselben Dateien sind der Konflikt, den wir nicht wollen.
- **Kein** Umbau der `size`-SelectBox (ADR 0039: `size` bleibt statischer Token).

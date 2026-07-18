---
id: P239
node: ui-icon
title: "ui-icon: Icon-Name im Editor bindbar (typedInput) — Auswahl-Dialog bleibt"
epic: aspects/node-conformance
status: done
dependencies: [P238]
verify: browser
spec: docs/nodes/display/ui-icon.md
tests: tests/e2e/nodes/view/ui-icon.tests.md
---
# P239 — ui-icon: Icon-Name bindbar im Editor (Picker bleibt)

> Rationale: **[ADR 0039](../../../../adr/0039-colour-field-model-color-is-tokens-plus-any-colour-variant-is-the-reduction.md)**
> §5 unter [ADR 0012](../../../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md)
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

## Result

**Done 2026-07-17.** Editor-Exposure-Gap geschlossen: der Icon-Name ist im Editor
bindbar, der Picker bleibt. Alles **gemessen**, nicht geraten.

### Was landete

- **`resources/lib/editor-common.js`** — `installIconField` bekommt einen **opt-in**
  `binding: true`-Modus: typedInput über den kanonischen Satz via neues
  `valueBindingTypes({category:"icon"})` — dasselbe *Delta*-Muster wie P238 für
  `color` (`str` → Icon-Literal-Typ ersetzt; nichts hinzu, nichts entfernt). Neues
  reines Paar `readIconBinding`/`applyIconBinding` (+ `readIconField`,
  `iconLiteralStringForm`). P69-Picker + Vorschau bleiben, auf den Literal-Typ
  gescopet; der Icon-Typ trägt den Picker zusätzlich auf seinem `expand`-Button —
  das `ui-image.src`/asset-Muster, kein neues.
- **`nodes/view/ui-icon.html`** — `icon` persistiert über einen
  **`iconBinding`-Carrier**; Spec + Inline-Hilfe nachgezogen.

### Bewusste Abweichung von der Akzeptanz (gemeldet, nicht kaschiert) — akzeptiert

Die Akzeptanz oben fordert wörtlich „**`#node-input-icon` ist ein typedInput**".
Der Implementer hat Node-REDs Editor-Client **gemessen** statt zu folgen:
`handleEditSave` (→ `oneditsave`) läuft **zuerst**, danach überschreibt das
Edit-Pane `apply()` `node[d]` aus `$("#node-input-<d>").val()`
(red.js:36438→38401). Ein typedInput auf `#node-input-icon` würde das
Binding-Objekt bei **jedem** Speichern zurück auf einen Bare-String clobbern —
exakt die Bug-Klasse aus **ADR 0031**. Das in `notes` vorgeschriebene Muster
(`ui-image.src`) nutzt **selbst** einen Carrier (`srcBinding`), ebenso P238s
`color` (`colorBinding`). Der Implementer folgte damit `notes` + Hausmuster:
`#node-input-iconBinding`. `required: true` greift weiterhin
(`validateNodeProperty` liest die Property, nicht das DOM). **Die Akzeptanz-Prosa
war zu wörtlich formuliert; das Muster ist richtig.**

Zweite Abweichung: die Akzeptanz nennt Typ **`state`** — der kanonische Editor-Satz
lässt `state` **bewusst** weg (Owner-Entscheidung, `editor-common.js:3836`, durch
einen bestehenden p113-Test gepinnt). Gemessen wurde mit `store` (identischer
Laufzeitpfad); `state` bleibt durch P235-B01 abgedeckt.

### Gemessene Werte

- Typ-Menü live gemessen: `store, query, routeParam, reactive, msg, jsonata, icon,
  num, bool, json, date, flow, global, env` — **kein `str`**.
- **Kern-Akzeptanz:** Autor wählt im Editor „Store" → gespeichert
  `{kind:"store",path:"iconEdStore"}` → Deploy → `sl-icon[name]` == **`house`**
  (aufgelöst), **nicht** das deployte Literal `gear`; Inject → **live auf `star`**
  via SSE.
- Picker real geöffnet: Auswahl → Typ bleibt `icon`, Wert `house` → als Bare-String
  `"house"` gespeichert → rendert `name="house"`. Vorschau-`src` gemessen ==
  `…/shoelace/assets/icons/house.svg`.
- 5 Round-trip-Fälle unverändert durch open→save.

### Tests

- **Unit +18** (`packages/editor/test/p239-icon-binding.test.ts`, vm-Harness wie
  p113): `applyIconBinding` verlustfrei — `{library:"default",name:"house"}`
  round-trippt **identisch** (`toBe`), obwohl seine String-Form `"house"` die
  Library fallen ließe; Literal→Binding und Binding→Literal ohne
  `{kind:"literal"}`-Wrapper.
- **E2E +9** in `ui-icon.spec.ts`; `p69-icon-picker.spec.ts` auf den Carrier gezogen.
- Der erste Menü-Test war **rot**: der Selektor fing *jedes* typedInput-Menü (jedes
  hängt sein eigenes an `<body>`) — mit `:visible` gescopet und **neu gemessen**.

### `installIconField`-Aufrufer geprüft (additiv)

`ui-icon` opted in; **ui-button** und **ui-avatar** **nicht** → unverändertes
Plain-Text-Literal-Control, `icon: {value:""}`-Defaults unangetastet; der
p69-ui-button-Test läuft **unverändert** grün (der Beleg für Additivität).
`ui-tab`/`ui-accordion-section` haben `icon` im Schema, rufen den Helper aber nie.

### Verifikation (Haupt-Checkout, autoritativ)

**E2E 785 passed, 0 failed, `--retries=0`** (bewusst ohne Retries, damit eine Race
sich nicht dahinter versteckt), `pnpm build` vorab. `pnpm validate` exit 0, alle
Tripwires inkl. `check:roundtrip`/`check:binding-docs` grün. `pnpm gen:example` →
kein Drift (`iconBinding` ist rein editor-seitig) und hat `.node-red-dev/flows.json`
korrekt übersprungen.

### Drive-by-Fix in separatem Commit: ui-tabs E01 war **keine** Flake

`ui-tabs` E01 lief auf **clean develop** identisch rot (8/1) — also **nicht** von
P239 verursacht. Der Implementer hat sie **diagnostiziert statt weggerannt**:
beim Upgrade emittiert `sl-tab-group` sein **eigenes** echtes `sl-tab-show`
(live geprobt als `POST /event {event:"change",params:{value:"overview"}}`); E01
armte `interceptNextEvent()` direkt nach `navigate()` und rannte dagegen. Fix
drainiert dieses Event zuerst und lässt die Assertion ehrlich (kein Filtern auf
den geprüften Wert): ui-tabs 8/1 → **9/9**, dreimal in Folge. **Orchestrator-Beleg:**
mein autoritativer Lauf mit `--retries=0` ist grün — vorher brauchte E01 einen
Retry. Siehe die Korrektur in P170s Result.

### Findings (unfixed, out of scope) → Folgearbeit

1. **`check:binding-docs`-Blindstelle — der Grund, warum kein Wächter P239s Gap
   fand.** Der Tripwire erkennt Binding-Fähigkeit per `/\bbindingSchema\b/` auf dem
   Feld-Ausdruck; `icon: iconFieldSchema` matcht **nie**, weil der Alias sie
   verdeckt. `iconFieldSchema` ist der einzige solche Feld-Alias und deckt **5**
   Felder. ui-icon ist jetzt gefixt, aber **ui-button, ui-avatar, ui-tab,
   ui-accordion-section dokumentieren `icon` weiter als „Textfeld"**, obwohl
   binding-fähig — latente Muster-4-Drift, die der Wächter **nicht sehen kann**.
   Empfehlung: eine Alias-Ebene auflösen (oder sichtbar allowlisten).
2. **`--repeat-each` auf ui-tabs** lässt A03/A04 fallen (dieselben App/Node-ids
   mehrfach in eine Runtime deployt) — vorbestehend, keine Real-Suite-Bedingung.

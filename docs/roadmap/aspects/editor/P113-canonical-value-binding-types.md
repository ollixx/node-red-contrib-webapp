---
id: P113
title: "EIN kanonischer Value-Binding-Typ-Satz (Reihenfolge + Semantik) für alle Display-Wert-Inputs"
epic: aspects/editor
status: pending
dependencies: [P111]
---
# P113 — Kanonischer Value-Binding-Typ-Satz

> **Einordnung (ADR 0012) — dieses Paket ist das Fundament der Binding-Ubiquität.**
> P113 baut den kanonischen Helfer **kategorie-fähig** und liefert **alle drei
> Feld-Kategorie-Typsätze** (nicht nur den Display-Satz):
> 1. **Wert/Anzeige** — der volle 14er-Satz (Default; auch der Input-Control-`value`),
> 2. **Boolean-Zustand** — für `disabled`: Store, Query, Route-Param, Reactive, msg,
>    JSONata, **boolean**, Flow, Global, Env (ohne string/number/json/timestamp),
> 3. **URL/Pfad** — für `href`/`to`: str, msg, JSONata, Store, Reactive, Flow,
>    Global, Env.
>
> Ein Feld ohne deklarierte Kategorie → Wert/Anzeige-Vollsatz (sicherer Default).
> **Kein** Schema/Runtime-Fundament nötig: der Renderer löst `disabled` und `href`
> bereits als Bindings auf (P71 für href), die Binding-Shape ist generisch (P97).
> Die **Anwendung pro Knoten** (value/disabled/href auf typedInput heben) sind
> eigene, parallele Editor-Pakete je Knoten (siehe ADR 0012 „Decomposition").

## findings (Nutzer-Wortlaut)

- "ui-text braucht zusätzlich noch den Type 'Jsonata' im input. eigentlich brauchen
  wir immer die selben types, wenn es um values geht."
- Gewünschte vollständige Liste **in dieser Reihenfolge** (an der richtigen Stelle auch
  in die Docs):
  `Store, Query, Route-Param, msg, JSONata, string, number, boolean, json, timestamp,
  Flow, Global, Env`
- jsonata-Semantik: **message-getrieben** (gegen die eingehende `msg` ausgewertet).
- `state` bleibt **draußen** (frühere Owner-Entscheidung: zu mächtig / nicht klar
  abgegrenzt).

## Befund (heute)

- **Zwei divergierende Quellen:** der geteilte Helfer `bindingTypedInputTypes`
  (`resources/lib/editor-common.js`, genutzt von ui-datepicker/-checkbox/-alert/
  -avatar/-image/-route) **und** hartcodierte Listen (ui-text, ui-breadcrumb, …).
  Zudem liegt die **Save-Logik** (Typ+Wert → `{kind,…}`) je Knoten dupliziert
  (`oneditsave`/`readBinding`).
- Der alte Satz bot `state`/`msg`(Pfad)/`jsonata`/`flow`/`global`/`env` an, von denen
  der Renderer nur 5 auflöste — Quelle der `"?"`-Probleme (siehe P111).

## Zielmodell — EIN Satz, EINE Stelle

Ein neuer Helfer (Vorschlag `valueBindingTypes()` + `readValueBinding()` /
`applyValueBinding()`) ist die **einzige** Quelle für Typen **und** Serialisierung.
Jeder Display-Wert-Input ruft nur noch diese Helfer. Reihenfolge + Mapping:

| # | Editor-Typ | kind | Kategorie / Auflösung |
|---|---|---|---|
| 1 | Store | `store` | reaktiv (ui-store-Picker) |
| 2 | Query | `query` | reaktiv (Query-Ergebnis) |
| 3 | Route-Param | `routeParam` | aus der URL |
| 4 | msg | `msg` | message-getrieben (Pfad, Standard-Node-RED) |
| 5 | JSONata | `jsonata` | message-getrieben (Ausdruck gegen `msg`) |
| 6 | string | `literal` (string) | statisch |
| 7 | number | `literal` (number) | statisch |
| 8 | boolean | `literal` (boolean) | statisch |
| 9 | json | `literal` (JSON-Wert) | statisch |
| 10 | timestamp | `literal` (Epoch-ms) | statisch |
| 11 | Flow | `flow` | serverseitig einmalig pro Render |
| 12 | Global | `global` | serverseitig einmalig pro Render |
| 13 | Env | `env` | serverseitig einmalig pro Render |

> **Amendment (ADR 0010, 2026-06-10):** Der Satz wächst auf **14 Typen** — nach
> Route-Param (Position 4) kommt **`Reactive`** (`kind: "reactive"`, `value` =
> JS-Expression-Quelltext, client-state-getrieben; Vertrag in
> `docs/nodes/concepts/reactive-expressions.md`). Der Typsatz-Helfer wird also
> von Anfang an mit `Reactive` an Position 4 gebaut: Store, Query, Route-Param,
> **Reactive**, msg, JSONata, string, number, boolean, json, timestamp, Flow,
> Global, Env. Die Editor-UI des Typs (Expression-Dialog, Completion,
> Validierung) liefert **P116** — P113 muss nur den Slot im Satz und die
> Serialisierung `{kind:"reactive", value}` vorsehen (Renderer-Seite: P115).

- **Default-Typ:** `string` (ersetzt das frühere einzelne „Text"/literal).
- Die fünf Literaltypen sind Node-REDs Primitive (`str`/`num`/`bool`/`json`/`date`).
  Alle serialisieren als `{kind:"literal", value:<typisierter Wert>}`. Anzeige folgt
  `value-rendering.md`: number/boolean → `String(…)`; `json` (Objekt/Array) → `"?"`;
  `timestamp` → Epoch-ms-String (Formatierung ist separates Thema).
- **`state` ist NICHT im Satz** (bleibt schema-/renderer-seitig für interne/Alt-Nutzung
  bestehen, ist nur kein Editor-Angebot mehr).

## jsonata — message-getrieben (Runtime)

- **Input-Handler** (`viewNodePatchInputHandler`, P111 bereits pfad-bewusst):
  zusätzlich `kind:"jsonata"` behandeln — Ausdruck einmalig captured, beim
  Nachrichteneingang via `RED.util.prepareJSONataExpression` +
  `evaluateJSONataExpression` gegen die `msg` auswerten, Ergebnis als Literal in die
  Live-Definition (backend-gehalten), Snapshot-Push.
- **Renderer:** `kind:"jsonata"` rendert **leer** bis zur ersten Message (analog `msg`,
  P111 — gemeinsamer Case).

## Scope — welche Knoten

- **In Scope (Display-Wert):** ui-text (`value`), ui-alert (`message`/`title`),
  ui-badge (`value`), ui-breadcrumb, ui-image (`src`), ui-avatar (`src`/`initials`),
  ui-button (`label`) — alle, die einen anzuzeigenden Wert binden.
- **NICHT in Scope:** Input-Controls (ui-input/-select/-checkbox/-switch/-slider/
  -datepicker/-textarea) — deren `value` ist eine **zweiseitige** Bindung an
  State/Store (der Control schreibt zurück). `msg`/`jsonata`/`flow`/`env` ergeben dort
  als Ziel keinen Sinn. Eigene Behandlung; hier nur erwähnt, nicht geändert.

## acceptance (observierbar, browser/unit)

- Jeder In-Scope-Knoten bietet **exakt** die 13 Typen in der obigen Reihenfolge;
  Default `string`. Kein `state`, kein altes pfadloses „Message".
- **JSONata (browser):** ui-text mit `JSONata`-Ausdruck `payload.user.name` → leer bis
  Message; nach `msg={payload:{user:{name:"Ada"}}}` zeigt „Ada".
- **Literaltypen:** `number 42` → „42"; `boolean false` → „false"; `json {a:1}` → `"?"`;
  `timestamp` → Epoch-ms-String.
- **Konsistenz:** Editor-Typsatz kommt aus EINEM Helfer; ein neuer Typ/Reihenfolge-
  Wechsel ist genau eine Änderung an einer Stelle (Test, der die Knoten gegen den
  Helfer prüft).
- **Beispiel-Migration:** `examples/customers-crud/flow.json` enthält keine
  `state`-Bindings mehr auf Display-Knoten (auf store/query umgestellt); E2E grün.

## Migration / Risiken

- **Beispiel:** state-Bindings liegen auf ui-button(3)/ui-table(1)/ui-badge(1)/
  ui-input(3). Display-Knoten (ui-button label, ui-badge value, ggf. ui-table) auf
  store/query migrieren; ui-input bleibt (Input-Control, out of scope). Danach
  `pnpm gen:example` bzw. Owner-Regenerierung — `flow.json` ist generiert.
- **Save-Logik zentralisieren** (`applyValueBinding`) ist der größere Teil — pro
  Knoten `oneditsave` auf den Helfer umstellen, sonst bleibt die Duplikation.
- **ui-text (P111 ist `done`):** dessen Wert-Typen werden von diesem Satz
  **abgelöst**. Konkret (Owner-bestätigt 2026-06-10): P111 Tranche 2 hatte
  `jsonata` aus dem ui-text-Editor entfernt (damals nicht auflösbar) — mit P113
  **kehrt `jsonata` zurück** (message-getrieben) und **`reactive` kommt neu
  hinzu**; `state` bleibt draußen. Diese Umkehr ist bewusst; P111 wurde mit
  diesem Hinweis geschlossen.

## Docs (an der richtigen Stelle)

- `docs/nodes/concepts/stores.md` — Binding-Arten: kanonische Liste + Reihenfolge +
  je-Typ-Semantik (reaktiv / statisch / message-getrieben / server-resolved).
- `docs/nodes/concepts/editor.md` — der gemeinsame Value-typedInput.
- Je Knoten die `value`-Feldzeile auf „nutzt den kanonischen Satz" verweisen lassen.

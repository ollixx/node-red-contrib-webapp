---
id: P196
node: ui-repeat
epic: nodes/ui-repeat
title: "P193-Korrektur: Typ-Explosion raus (keine 'Item (alias)'-Typen) → ein validierter Scope-Picker neben item/index + scope('name')-Accessor in Reactive"
findings:
  - "Owner (2026-06-20): 'Für jeden named repeat mit scope name werden jetzt nochmal zwei types in die liste des typedInput gepackt? Das ist doch unsinn. Wie groß soll diese Liste denn werden bei einer ausgewachsenen Anwendung. Der custom name muss entweder als Variable oder extra in einem feld abgefragt werden.'"
  - "Owner (2026-06-20): Entscheidung — B (validiertes Scope-Feld) PLUS scope()-Funktion für Reactive."
  - "Owner-Bedenken (korrekt): bare Reactive-Globals würden mit store/query/routeParam/item/index kollidieren → scope('name') nötig; und in BEIDEN Fällen muss geprüft sein, dass der Knoten wirklich im gewählten Scope hängt — die Liste darf nur aus echten Eltern-Repeats bestehen."
  - "Befund: ADR 0023 §3 (Typ pro Alias) war falsch. Vorhanden+wiederverwendbar: collectEnclosingRepeatAliases (Eltern-Aliase), das store('…')-Autocomplete+Referenz-Validierungs-Muster, der P193-Renderer (scope-qualifizierte Frame-Auflösung) + das Schema-`scope`-Feld."
acceptance:
  - "KEINE per-Alias-Typen mehr: valueBindingTypes liefert als Repeat-Einträge GENAU 'Item (Repeat)' + 'Index (Repeat)' (innerstes) — unabhängig davon, wie viele benannte Eltern-Repeats existieren. Die alte 'Item (<alias>)'/'Index (<alias>)'-Erzeugung ist entfernt."
  - "Scope-Picker (geführt): bei gewähltem Typ Item/Index erscheint NEBEN dem Pfadfeld ein kleines Scope-Auswahlfeld; Optionen = 'innerstes' (Default) + die Aliase aus collectEnclosingRepeatAliases (= NUR die tatsächlichen Eltern-Repeats). Auswahl eines Alias setzt binding.scope=<alias>; 'innerstes' lässt scope leer. Gibt es kein benanntes Eltern-Repeat → nur 'innerstes' (kein Picker nötig). By construction kann kein Nicht-Eltern-Scope gewählt werden."
  - "Reactive scope('name'): in einer Reactive-Expression INNERHALB eines Repeats liefert scope('customer') das Item des mit 'customer' benannten Eltern-Repeats (scope('customer').name); außerhalb jedes passenden Scopes → undefined (kein Wurf). Eigene Funktion (namespaced) → kein Clash mit store/query/routeParam/item/index."
  - "Reactive-Autocomplete + Validierung: Tippen von scope(\" bietet die Eltern-Aliase an (wie store(\")); ein statisches scope(\"x\"), dessen x KEIN Eltern-Alias ist, löst die weiche Referenz-Warnung aus (wie die store(\"…\")-Validierung)."
  - "Schema + Renderer unverändert aus P193: das `scope`-Feld am item/index-Binding und die Named-Frame-Auflösung im Renderer bleiben; NUR die Editor-Fläche (Picker statt Typen) + der Reactive-scope()-Accessor (Eval-Scope + Autocomplete + Warnung) kommen hinzu/ändern sich."
  - "Round-trip: ein gespeichertes {kind:item, scope:'customer', path:'name'} öffnet mit Scope-Picker='customer', Pfad='name'."
verify: browser
spec: docs/nodes/display/ui-repeat.md
tests: tests/e2e/nodes/view/ui-repeat.tests.md
dependencies: []
status: in_progress
---
# P196 — Named-Scope: Picker statt Typ-Explosion + scope() in Reactive

> **Korrektur zu P193 / ADR 0023 §3** (am 2026-06-20 dort berichtigt). Die
> „ein Typ pro Alias"-Idee blähte die Typ-Liste und vermischt Namen mit Typen.
> Ersetzt durch **einen validierten Scope-Picker** (geführt) **+ `scope('name')`**
> (Reactive/Komposition) — beide aus **derselben** Eltern-Alias-Liste, die der
> Editor schon kennt.

## Umfang (nutzt Vorhandenes, kein neues Gerüst)

1. **Entfernen:** die per-Alias-Typ-Erzeugung in `valueBindingTypes`
   (`resources/lib/editor-common.js`). Repeat-Typen = nur Item/Index (innerstes).
2. **Scope-Picker:** neben dem item/index-Pfadfeld ein Select aus
   `collectEnclosingRepeatAliases` (+ „innerstes" als Default); setzt/liest
   `binding.scope`. Nur sichtbar, wenn ≥1 benanntes Eltern-Repeat existiert.
3. **Reactive `scope(name)`:** neuer Eintrag in `REACTIVE_GLOBALS` + Eval-Scope
   (Renderer injiziert je Instanz die benannten Frames); Monaco-Autocomplete für
   `scope("…")` aus den Eltern-Aliasen (Muster: `store("…")`); statische
   `scope("x")`-Referenzvalidierung (Muster: store-Literal-Scan).
4. **Renderer:** `scope(name)` in der Reactive-Auswertung gegen den benannten
   Frame auflösen (die item/index-`scope`-Auflösung aus P193 bleibt).
5. **Tests:** der p193-Editor-Test (per-Alias-Typen) wird durch den Scope-Picker-
   Test ersetzt; Schema-/Renderer-p193-Tests bleiben grün; ein Reactive-`scope()`-
   Test (Per-Instanz-Auflösung + Warnung bei Nicht-Eltern-Name).

## acceptance / verify

- `verify: browser` — outer `itemName="customer"`, inner `itemName="order"`: ein
  tief verschachteltes Kind liest (a) via Scope-Picker `customer` + Pfad `name`
  das **äußere** und (b) via Reactive `scope("order").total` das **innere** Item —
  je Instanz korrekt. E2E im Haupt-Checkout durch den Orchestrator
  ([[orchestrator-must-verify-e2e-in-main-checkout]]).

## Risiken / Hinweise

- **Keine** Rückkehr der Typ-Bloat — Aliase erscheinen NUR im Scope-Picker /
  scope()-Autocomplete, nie als Typen.
- `scope('name')` ist eine **Funktion** (namespaced) → kein Global-Clash.
- Schema-`scope` + P193-Renderer bleiben; das ist reine Editor-/Reactive-Fläche.

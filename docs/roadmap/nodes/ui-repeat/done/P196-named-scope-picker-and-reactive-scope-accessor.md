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
status: done
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

## Result

- **delivered:** P193 correction (ADR 0023 §3 berichtigt) — the per-alias typedInput **type explosion is
  gone**. `valueBindingTypes` (`resources/lib/editor-common.js`) now yields exactly `Item (Repeat)` +
  `Index (Repeat)` (innermost) regardless of how many named enclosing repeats exist. In its place: a
  **guided scope-picker** (`valueBindingScopeOptions` = innermost + the real enclosing aliases from
  `collectEnclosingRepeatAliases`; `installValueBindingScopePicker`/`valueBindingScopePicked`;
  `applyValueBinding` gains a 4th `scope` arg, `readValueBinding` surfaces the alias) wired next to the
  item/index path field — shown only when ≥1 named enclosing repeat exists, and by construction only an
  actual enclosing scope is selectable. A namespaced **reactive `scope(name)` accessor** —
  `scope('customer').name` returns the enclosing `customer` repeat's item per instance, `undefined`
  outside any matching scope (no throw, no clash with store/query/routeParam/item/index); injected via
  `reactive-expression.ts` + `renderer.ts buildScopeItems`, with Monaco `scope("` autocomplete +
  static `scope("x")` reference warning (both mirroring the `store("…")` pattern). **Schema `scope`
  field + the P193 renderer named-frame resolution are untouched** — this is purely editor + reactive
  surface.
- **stats:** 11 files (10 changed, 1 new test `p196-reactive-scope-accessor.test.ts`). Develop
  verification: build exit 0; full unit green (schema 377, editor 176, renderer 153, runtime 1049);
  **E2E 26/26 green** — ui-repeat (incl. the P193+P196 nested proof: a deep child reads the OUTER
  `customer` via the scope-picker binding and the INNER `order.total` via reactive `scope("order")`,
  per instance), reactive-expression 7/7, p182 gating 4/4, p67 canonical-set, p189 — confirming the
  `valueBindingTypes`/reactive changes regressed none of the type-list- or reactive-sensitive specs;
  check:specs + check:links + check:roadmap + lint green.
- **notes:** Replaced the P193 per-alias-TYPE editor test with scope-picker/option-set/4th-arg
  round-trip tests; the P193 schema + renderer tests stay green (unchanged). The sub-agent **ran its
  E2E green in-worktree** (10/10) before returning. Consumed `collectEnclosingRepeatAliases`, the
  `store("…")` autocomplete+validation pattern, the P193 renderer + schema `scope` field — all
  confirmed present.
- **cost:** session agent-a9bdc10d13bc340a6, ~28m.

---
id: P131
title: "store-Binding: optionaler subPath (Ein-Level-Value-Binding) — Schema + Renderer-Auflösung + Rekursions-Guard + sprechende Fehler"
epic: aspects/rendering
status: pending
dependencies: []
spec: docs/nodes/concepts/stores.md
tests: tests/e2e/nodes/state/ui-store.tests.md
---
# P131 — store-Binding mit subPath: Schema + Renderer

> Entscheidung & Begründung: [ADR 0013](../../../adr/0013-store-binding-subpath.md).
> Editor-Seite (Name-Chip + Pfad-typedInput + Autocomplete): **P132**.
> Dieses Paket ist der Unterbau (Schema, Renderer, Runtime-Guard) — keine Editor-UI.

## findings (Nutzer-Wortlaut, 2026-06-10)

- "warum wird nach Auswahl des Stores im Input eine ID angezeigt?" (→ P132)
- "wenn ich ein 'c' eingebe, wird nicht 'eins' angezeigt, sondern ein ?"
- "Ich wähle einen Store … in dem input feld beschreibe ich den Pfad innerhalb
  des Slices, auf den ich binden will, also hier 'c'."
- Geklärt: der Pfad ist selbst ein **gebundener Wert** (Ein-Level), drei
  Stabilitätsklassen; Rekursion strukturell ausgeschlossen + Laufzeit-Guard.

## Befund (heute)

- `store`-Binding = `{kind:"store", path:<ui-store-id>}`; der Renderer liest den
  **ganzen Slice** (`getValueAtPath(state, statePath)`) — kein Unterpfad. Ein
  Objekt-Slice → nicht darstellbar → `"?"`.

## Zielmodell

### 1. Schema (`packages/schema/src/contracts.ts`)

- `store`-Binding erhält optionalen **`subPath`** = ein **Blatt-Value-Binding**
  (`{kind, path?/value?}` aus dem kanonischen Satz, **ohne** eigenes `subPath`).
  Erlaubte `subPath.kind`: `literal`(string/number) · `routeParam` · `query` ·
  `store` · `reactive` · `jsonata` · `msg` · `flow` · `global` · `env`.
- **Strukturelle Rekursionssperre:** ein `subPath`-Binding darf **selbst kein
  `subPath`** tragen (Schema lehnt `subPath.subPath` ab). Damit ist keine Kette/
  kein Zyklus möglich.
- `subPath` nur auf `kind:"store"` zulässig (superRefine: auf anderen Kinds Fehler).
- Fixtures: ein Store-Binding mit `subPath:{kind:"literal", value:"c"}` ergänzen.

### 2. Renderer (`packages/renderer/src/renderer.ts`, `case "store"`)

- Slice wie bisher auflösen (id → statePath → Live-Wert).
- Ist `subPath` gesetzt: das `subPath`-Binding über `resolveBinding` zu einem
  **Pfad-String/Index** auflösen (msg/jsonata folgen dem bestehenden
  message-getriebenen Verhalten; reactive/routeParam/query/store reaktiv;
  flow/global/env server-einmalig — bereits vorhandene Mechaniken
  wiederverwenden), dann `getValueAtPath(slice, pfad)`.
- Leerer/fehlender `subPath` ⇒ ganzer Slice (unverändert).
- **Laufzeit-Tiefen-Guard (Backstop):** Auflösungstiefe zählen (erwartet 1 +
  Marge) bzw. Visited-Set; bei Überschreitung **kein** Stack-Overflow, sondern
  Invalid-Value-Marker (P104) + **einmaliger sprechender** Fehler über die
  bestehende Pipeline (Dedup wie [[reactive-error-dedup]] in webapp.js):
  `store binding: sub-path nesting too deep / cycle`.

### 3. Sprechende Laufzeitfehler (Owner-Entscheid: Editor permissiv, Runtime validiert)

- `subPath` gesetzt, aber unauflösbar (Key fehlt / Slice ist Skalar) →
  Invalid-Value + Meldung `Store "<name>": Pfad "<p>" nicht gefunden (Slice ist <typ/wert>)`.
- kein `subPath`, aber Slice ist nicht-darstellbares Objekt/Array →
  `Store "<name>": Wert ist ein Objekt — gib einen Pfad zu einer anzeigbaren Property an`.
- Affordanz/Familie: P104 (Invalid-Value) / P105 (Achtung-Icon + Alert).

## acceptance (observierbar; unit + browser via Fixture)

- **Schema (unit):** `{kind:"store", path:"s1", subPath:{kind:"literal", value:"c"}}`
  validiert; `subPath` mit eigenem `subPath` wird **abgelehnt**; `subPath` auf
  einem Nicht-Store-Binding wird abgelehnt.
- **Renderer happy path (unit):** Slice `{a:false,b:false,c:"eins"}`,
  `subPath` literal `"c"` → `"eins"`; literal number `0` auf Array-Slice → Element 0.
- **Dynamischer Pfad (unit):** `subPath` routeParam `key` mit `params.key="c"` →
  `"eins"`; `subPath` reactive `` `c` `` → `"eins"`.
- **Leerer subPath:** Skalar-Slice ohne subPath → der Skalar; Objekt-Slice ohne
  subPath → Invalid-Value + sprechende Meldung (einmalig).
- **Unauflösbar:** subPath `"x"` nicht im Slice → Invalid-Value + sprechende
  Meldung; Snapshot bleibt intakt.
- **Rekursions-Guard (unit):** ein künstlich tief verschachteltes/zyklisches
  Konstrukt (z. B. via direktes Schema-Bypass im Test) → Guard greift, Marker +
  ein sprechender Fehler, kein Crash.
- **Browser (Fixture):** ui-text mit Store-Binding `subPath:"c"` zeigt „eins";
  ändert der Flow den Store-Wert von `c`, aktualisiert sich der Text.

verify: browser

## spec / tests

- spec: `docs/nodes/concepts/stores.md` — Abschnitt „Unterpfad" (subPath,
  Auflösung, drei Stabilitätsklassen, Ein-Level-Regel) ergänzen; ADR 0013 verlinken.
- tests: Unit in `packages/schema/test/` + `packages/renderer/test/`; E2E-Fixture
  neu (Store-subPath). Katalog `tests/e2e/nodes/state/ui-store.tests.md` erweitern.

## Risiken / Hinweise

- `getValueAtPath` muss numerische Segmente als Index behandeln (prüfen; sonst
  ergänzen) — „Index vs. Key" ist datengetrieben, kein Typ.
- Invalid-Value/Logging-Pipeline (P104/P55-56) wiederverwenden; Dedup wie beim
  reactive-Fehler (pro appId, nicht pro Build).

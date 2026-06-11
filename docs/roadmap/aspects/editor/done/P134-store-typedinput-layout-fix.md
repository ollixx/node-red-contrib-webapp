---
id: P134
title: "store-typedInput-Layout korrigieren: Name im Wert-Bereich + zweites eingerücktes Pfad-typedInput (nicht Ein-Zeilen-Quetschung)"
epic: aspects/editor
status: done
dependencies: [P132]
spec: docs/nodes/concepts/editor.md
tests: tests/e2e/nodes/state/ui-store.tests.md
---
# P134 — Store-typedInput-Layout korrigieren

> Korrektur zu [ADR 0013](../../../../adr/0013-store-binding-subpath.md) §4
> (dort am 2026-06-11 berichtigt). **P132 hat das Layout falsch gebaut** —
> dieses Paket zieht es auf den korrigierten Stand. Reines Editor-Layout, **kein**
> Modell-/Schema-/Renderer-Wechsel (Serialisierung `{kind:"store", path, subPath}`
> bleibt wie in P131/P132).

## findings (Nutzer-Wortlaut, 2026-06-11)

- "Der Typ 'Store' wurde nicht wie besprochen umgesetzt, sondern alles in einem
  TypedInput zusammengepackt. Es gibt zwei Stellen … mal ein Pfad, mal ein
  Storename." (Screenshot zeigt `[▾🗄][Store ändern][c (bestehend)][…]` in einer Zeile)
- "Das TypedInput mit ausgewähltem Type 'Store' zeigt nach Auswahl des Stores mit
  '…' den Slice-Namen, also 'monster'. Es erscheint darunter ein zweites
  TypedInput für den Binding-Pfad (eingerückt, nur Label des Feldes bleibt links).
  Dort wird alles angeboten … und da werfen wir erstmal nichts raus."

## Befund (heute, nach P132)

- Der Store-typedInput quetscht in **eine** Wert-Zeile: einen „Store ändern"-Button
  **und** den Sub-Pfad (als `<id> (bestehend)`-Anzeige). Das zweite,
  eingerückte Pfad-typedInput fehlt; statt des **Namens** erscheint teils die ID.

## Zielmodell (korrigiertes Layout — ADR 0013 §4)

`store` ist **ein Typ unter vielen** im Wert-typedInput (über ▾ gewählt). Bei
Typ = Store:

1. **Wert-Bereich = Store-Name.** Nach Auswahl über die typedInput-**„…"**-
   (Expand-)Taste zeigt der Wert-Bereich den **Namen** des Stores („monster")
   — **nicht** die ID, **kein** „Store ändern"-Button, **kein** `(bestehend)`.
   „…" öffnet den app-gescopten P68-Picker erneut zum Wechseln. Icon = der
   typedInput-Typ-Icon `fa fa-database`.
2. **Zweites, eingerücktes Pfad-typedInput darunter.** In der Wert-Spalte (das
   Feld-Label bleibt in Spalte 1) erscheint ein **zweites** typedInput für den
   `subPath` mit dem **vollen `storePath`-Satz** (string/number/routeParam/query/
   store/reactive/jsonata/msg/flow/global/env — **nichts entfernt**). Default
   `string` mit Default-Slice-Autocomplete (weich). Leer = ganzer Slice.
3. **Serialisierung unverändert:** `{kind:"store", path:<id>, subPath:<Blatt|—>}`.
4. Gilt **zentral** für jeden Store-typedInput (alle Knoten), da der Helfer
   geteilt ist.

Referenz-Skizze: die überarbeitete Store-Skizze zu ADR 0013 (Name im Wert +
zweites eingerücktes Pfad-typedInput, drei Pfad-Typ-Varianten string/msg/JSONata).

## acceptance (observierbar, browser)

- Wert-typedInput, Typ `Store`, nach Auswahl: Wert-Bereich zeigt **„monster"**
  (Name), **„…"** wechselt; **keine** ID, **kein** „Store ändern"-Button,
  **kein** `(bestehend)`-Text in der Zeile.
- **Darunter** ein zweites, **eingerücktes** Pfad-typedInput; Feld-Label bleibt
  in Spalte 1. Der Pfad-typedInput bietet alle 11 `storePath`-Typen; Default
  `string` mit Autocomplete `a/b/c` aus dem Default-Slice.
- Pfad-Typ `msg`/`JSONata`/`reactive` zeigen ihr jeweiliges Wert-/Editor-Feld.
- Round-Trip `{kind:"store", path, subPath}` unverändert; Renderer-Verhalten
  (P131) unverändert; bestehende Store-Binding-E2E grün.
- Screenshot-Beleg: zwei Zeilen (Name-Zeile + eingerückte Pfad-Zeile), nicht die
  alte Ein-Zeilen-Quetschung.

verify: browser

## spec / tests

- spec: `docs/nodes/concepts/editor.md` — Store-typedInput-Abschnitt auf das
  korrigierte Zwei-Zeilen-Layout heben (Name im Wert + eingerücktes Pfad-typedInput).
- tests: `tests/e2e/nodes/state/ui-store.tests.md` + die Store-Binding-Editor-Spec
  aus P132 auf das korrigierte Layout umschreiben (Name statt ID, zweites
  eingerücktes Pfad-Feld, Pfad-Typen).

## Result

- **delivered:** Corrected the shared store typedInput layout (`resources/lib/editor-common.js`,
  `storeTypedInputType`) to ADR 0013 §4 — name in the value area (no "Store ändern" button, no
  raw id, no "(bestehend)" for a live store), the typedInput's native "…" expand re-opens the
  app-scoped picker, and a second, indented sub-path typedInput below the name (field label
  stays in column 1). Pure editor-layout fix; `{kind:"store", path, subPath}` serialization and
  renderer (P131) untouched. Updated the store-binding E2E spec
  (`tests/e2e/nodes/editor/store-binding-subpath.spec.ts`), the test catalogue
  (`tests/e2e/nodes/state/ui-store.tests.md`), and the editor concepts doc
  (`docs/nodes/concepts/editor.md`).
- **stats:** 4 files changed, +89/−67. Develop verification: `pnpm build` exit 0, full
  Playwright suite **502 passed / 0 failed** (8.1m); `pnpm validate` (1285 unit tests across
  schema/runtime/renderer/editor) + check:roadmap + check:links all OK. Browser-verified: 6
  store-binding editor E2E (name-in-value, native "…" expand, second indented path row,
  round-trip) and 6 ui-store renderer E2E (P131, unchanged) pass; two-row layout screenshot
  captured.
- **notes:** Worktree-sanity all passed — local develop ref was stale (`ef22eb6`) as warned;
  branched from explicit SHA `01b1cf6`; P132 ancestry OK; the P132 store typedInput helper was
  present (not reimplemented). The P132 editor unit test is pure logic (no DOM/button refs) so
  it needed no change. No model/schema/renderer change.
- **cost:** session adbed81b4c721d925, ~9m (orchestrator-measured wall-clock incl. develop E2E).

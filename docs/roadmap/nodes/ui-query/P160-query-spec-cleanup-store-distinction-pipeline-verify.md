---
id: P160
node: ui-query
epic: nodes/ui-query
title: "ui-query: Spec entrümpeln (previewData raus, Wiring-Pflicht + Beispiel), Store-vs-Query-Trennung schärfen, Daten-Pipeline test-first verifizieren"
findings:
  - "ui-query: Wie soll das denn funktionieren? Auch alles leer."
  - "ui-query ist die Schnittstelle zum Frontend, um dort Daten zu hinterlegen. Wenn ich in ui-query was ändere, werden alle, die sich darauf binden, aktualisiert. Warum machen wir das nicht mit einem Store?"
  - "Owner-Entscheidung 2026-06-11: getrennt lassen, Trennung schärfen (store = eigener, veränderbarer Zustand; query = server-geladene, read-only Daten mit Ladezustand)."
verify: browser
spec: docs/nodes/state/ui-query.md
tests: tests/e2e/nodes/state/ui-query.tests.md
dependencies: []
status: pending
---
# P160 — ui-query: Spec-Cleanup + Store-Abgrenzung + Pipeline-Verifikation

## findings / Kontext

- „Alles leer" ist **by design** (ui-query = Deklaration + Zustands-Halter, kein
  Lader) — aber die Doku führt in die Irre: sie listet noch **`previewData`**, das
  in **P32 entfernt** wurde (kein Editor-Feld mehr). Es gibt also **keinen**
  Demo-Shortcut aus der Knoten-Config; der **verdrahtete** Weg ist der einzige.
- Owner: ui-query und ui-store bleiben **getrennt**; die **Abgrenzung wird
  geschärft**.
- Offen (vor diesem Paket nicht verifiziert, Tooling): ob der verdrahtete
  Datenfluss `msg.ui.query.data → ui.queries.<path> → query:`-Binding end-to-end
  sauber in die gerenderte View kommt.

## Zielmodell

### 1. Spec entrümpeln (`docs/nodes/state/ui-query.md`)

- **`previewData` streichen** (Feld + „Preview Data"-Zeile + ETag/Seed-Hinweise,
  soweit auf previewData bezogen) — es ist seit P32 weg.
- Die **Verdrahtungs-Pflicht** prominent dokumentieren + ein **vollständiges
  Wiring-Beispiel**: `ui-route onEnter → ui-query (Pass-Through) → Datenquelle →
  zurück an In-Port mit msg.ui.query.data → ui-table bindet query:<path>`.
- **Lifecycle-Lese-Konvention festnageln (heute widersprüchlich):** eindeutig
  definieren, was `query:<path>` liefert — die **Daten** oder die **Hülle**
  `{loading,data,error,updatedAt}` — und wie man die Teile bindet. Vorschlag:
  `query:<path>` = die **Daten** (häufigster Fall); Lifecycle über reservierte
  Unterpfade `query:<path>.loading` / `.error` / `.updatedAt`. Renderer-Auflösung
  entsprechend prüfen/anpassen und in `stores.md` (query-Binding) dokumentieren.
- Inline-Hilfe (`data-help-name="ui-query"`) entsprechend schärfen, damit der
  „leere" Erstkontakt verständlich ist.

### 2. Store-vs-Query-Trennung schärfen (`ui-query.md` + `ui-store.md` + `stores.md`)

Glasklare, gegenseitig verlinkte Abgrenzung:
- **`ui-store`** = **eigener, veränderbarer** Client-Zustand; **Input-Controls
  schreiben in Stores** (zweiseitig); via `store`-Binding gelesen.
- **`ui-query`** = **server-geladene, im UI read-only** Daten mit **Ladezustand**
  (`loading/data/error/updatedAt`); via `query`-Binding gelesen; geladen über das
  Fetch-Wiring (+ `params`-Store, `refreshAction`, ETag).
- Mechanik-Duplikate vermeiden (kein zweiter Schreibpfad in Queries).

### 3. Daten-Pipeline test-first verifizieren (und fixen, falls Lücke)

- E2E/Integration: ein Flow pusht `msg.ui.query.data` an einen ui-query-Knoten →
  die Daten landen unter `ui.queries.<queryPath>` → eine gebundene `ui-table`
  (`rows = query:<path>`) zeigt sie; ein zweiter Push aktualisiert live; ein
  `error`-Push zeigt sich an einem `query:<path>.error`-gebundenen `ui-text`.
- **Falls der Snapshot `queries` leer erhält** (Verdacht aus der Code-Sichtung):
  die Befüllung von `sources.queries` in `buildAppSnapshot` aus dem
  Query-Live-State herstellen — der eigentliche Bugfix hinter „alles leer".

## acceptance (observierbar, browser)

- Die ui-query-Spec enthält **kein** `previewData` mehr; das Wiring-Beispiel +
  die Verdrahtungs-Pflicht sind dokumentiert; Inline-Hilfe geschärft.
- `ui-store.md`/`ui-query.md`/`stores.md` tragen die geschärfte Abgrenzung
  (owned/mutable vs. loaded/read-only + Ladezustand), gegenseitig verlinkt.
- **Browser:** der verdrahtete Datenfluss füllt eine gebundene ui-table; ein
  zweiter Push aktualisiert live; `loading`/`error` lassen sich an `ui-text`
  binden und zeigen sich. (Falls Bugfix nötig: vorher rot, nachher grün.)

## spec / tests

- spec: `docs/nodes/state/ui-query.md` (Cleanup + Beispiel + Abgrenzung),
  `docs/nodes/state/ui-store.md` + `docs/nodes/concepts/stores.md` (Abgrenzung).
- tests: `tests/e2e/nodes/state/ui-query.tests.md` (Pipeline-Beweis) + ggf.
  Renderer-/Runtime-Unit für die `queries`-Befüllung.

## Risiken / Hinweise

- Punkt 3 kann ein **reiner Verifikations**-Job sein (Pipeline ok) **oder** einen
  echten Fix enthalten (queries kommt leer im Snapshot an). Erst test-first
  reproduzieren, dann entscheiden. (Tooling-bedingt in der Planung nicht
  abschließend verifiziert.)
- ui-query bleibt eigenständig (Owner-Entscheid) — **kein** Merge in ui-store.

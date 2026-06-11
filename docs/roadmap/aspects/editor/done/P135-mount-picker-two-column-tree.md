---
id: P135
title: "Mount-Picker als Zwei-Spalten-Tree (Tree links / Slots rechts, Suche → flache Pfadliste links) + Dialog resizable, Größe gemerkt, Ellipsis"
epic: aspects/editor
status: done
dependencies: [P114]
spec: docs/nodes/concepts/editor.md
tests: tests/e2e/nodes/editor/node-picker.spec.ts
---
# P135 — Mount-Picker: Zwei-Spalten-Tree + resizable Dialog

> Entscheidung & Begründung: [ADR 0014](../../../../adr/0014-mount-picker-two-column-tree.md).
> Betrifft **nur** das `mounts`-Preset; die flachen Referenz-Presets
> (apps/routes/actions/stores/layouts) bleiben flache Listen. Kein
> Daten-Vertragswechsel (Mount-Strings unverändert).

## findings (Nutzer-Wortlaut, 2026-06-11)

- "Der Dialog 'Parent Auswählen' ist nicht optimal. Das sollte ein scrollbarer
  Treeview sein. Die Ebenen: App -> Routes / Container > rekursiv Kind-Container."
- "Idee: Wir machen zwei Spalten. Links der Tree. Rechts daneben eine flache
  Liste von Slots für den links gewählten Zweig. Suche bleibt oben."
- Korrektur Suche: "Die Suche sollte im Tree laufen und links eine Liste von
  gefundenen Pfaden zeigen (ohne Slots). Rechts bleiben die Slots."
- "Kriegen wir den Dialog resizable hin? Bei einer großen App muss man in der
  Suchliste sonst horizontal scrollen."

## Zielmodell

### 1. Zwei-Spalten-Browser (nur `mounts`)

- **Links — Struktur-Tree:** App → (Routes / Dialoge) → Container → **rekursiv**
  Kind-Container. **Nur Struktur-Knoten sind Branches;** ein Kind-Container hängt
  direkt unter seinem **Parent-Knoten** (nicht unter einer Slot-Ebene — sonst
  tauchen Slots doppelt auf, links *und* rechts).
- **Rechts — Slots des links gewählten Knotens:** flache Liste; **Slots sind die
  einzigen selektierbaren Leaves** (der Pick). Links = reine Navigation.
- **Nicht app-gescoped** (P117): alle Apps als oberste Ebene (cross-app bleibt
  möglich).
- **Zyklus-Schutz:** beim Editieren des eigenen Mounts eines Containers wird
  dessen eigener Teilbaum aus dem Tree ausgeschlossen (`visitedContainers`-Guard
  in den Tree-Builder übernehmen).
- **Leere Zweige:** Knoten ohne eigene Slots → rechts „keine Slots"; kinderlose
  Branches sichtbar, nicht aufklappbar.
- **Vorauswahl:** aktueller Mount-Pfad aufgeklappt + markiert, Slot rechts gewählt.
- **Footer:** voller Breadcrumb der aktuellen Auswahl; gespeichert wird der
  unveränderte Mount-String (`<type>:<id>/<slot>` bzw. `<appId>.<slot>`).

### 2. Suche (oben, immer sichtbar)

- Läuft **über den Tree**. Bei Suchbegriff wird **links** zur **flachen Liste der
  gefundenen Pfade** (Branches/Pfade, **ohne** Slots); **rechts** bleibt
  **invariant** = die **Slots** des links gewählten Treffers. Leere Suche → der
  Zwei-Spalten-Browser.

### 3. Dialog resizable + gemerkt + overflow-sicher (geteilt für ALLE Picker)

- **Resizable:** CSS `resize: both; overflow: auto;` am Dialog-Container, mit
  `min-width`/`min-height`, `max-width: 95vw`, `max-height: 90vh` (nativer
  Eck-Anfasser, kein JS).
- **Größe gemerkt:** Breite/Höhe in `localStorage`, beim nächsten Öffnen
  wiederhergestellt.
- **Lange Labels:** `text-overflow: ellipsis` (oder Umbruch) statt Horizontal-
  Scroll. Gilt über die geteilten `webapp-node-picker-*`-Klassen für Node-/
  Mount-/Icon-/Media-Picker.

## Explizit OUT of scope

- Flache Referenz-Presets (apps/routes/actions/stores/layouts) — bleiben flach.
- Mount-Datenformat/Schema/Renderer — unverändert.

## acceptance (observierbar, browser)

- **Tree:** Der Mount-Picker zeigt links den Struktur-Tree (App → Routes/Dialoge
  → Container rekursiv), rechts die Slots des links gewählten Knotens; ein Klick
  auf einen Slot rechts setzt den Mount (Footer-Breadcrumb passend), Mount-String
  unverändert.
- **Cross-app:** mehrere Apps als oberste Ebenen; ein Knoten kann in einen Slot
  einer anderen App gemountet werden.
- **Suche:** Eingabe „customers" → links flache Trefferpfade (ohne Slots), rechts
  die Slots des gewählten Treffers; leeren der Suche → Zwei-Spalten-Browser.
- **Zyklus:** Beim Editieren eines Containers fehlt dessen eigener Teilbaum im Tree.
- **Resizable:** der Dialog hat einen Resize-Anfasser; vergrößert man ihn,
  verschwindet der Horizontal-Scroll; die Größe ist nach Schließen/Öffnen erhalten.
- **Geteilt:** Icon-/Media-Picker sind ebenfalls resizable + merken die Größe
  (Smoke).
- Bestehende Mount-Auswahl-E2E grün (nur über den Tree statt der flachen Liste).

verify: browser

## spec / tests

- spec: `docs/nodes/concepts/editor.md` — Picker-Dialog-Abschnitt: Zwei-Spalten-
  Tree für `mounts`, Suchverhalten, resizable/gemerkt/Ellipsis.
- tests: `tests/e2e/nodes/editor/node-picker.spec.ts` (+ `editor-mount-options`)
  auf den Tree umschreiben: Tree-Navigation, Slot-Pick, Suche→Pfadliste,
  Cross-app, Resize/Persistenz. Unit: Tree-Aufbau + Suchfilter (Pfade ohne Slots)
  aus `buildMountOptionsTree` als reine Funktionen.

## Risiken / Hinweise

- `buildMountOptionsTree` modelliert die Hierarchie bereits — daraus den Tree
  rendern statt neu zu erheben. `flattenMountOptionTree` bleibt für den
  Suchmodus (flache Pfadliste) nutzbar.
- Der Mount-Picker bleibt **nicht app-gescoped** (P117-Begründung beibehalten).

## Result

- **delivered:** The `mounts` preset picker is now a two-column master-detail tree (ADR 0014),
  editor-only — no mount data-format/schema/renderer change (mount strings stay
  `<type>:<id>/<slot>` and `<appId>.<slot>`). LEFT structural tree (App → Routes/Dialoge →
  Container → rekursiv) built by a new pure `buildMountPickerTree`; only structural nodes are
  branches, child containers nest under their parent node (not a slot level); not app-scoped
  (P117 retained); cycle guard excludes a `ui-container`'s own subtree when editing its own
  mount. RIGHT = the selected node's slots (the only selectable leaves). Search runs over the
  tree: left → flat matching-path list (no slots), right → the selected path's slots; empty
  query → browse view. `buildMountOptionsTree`/`flattenMountOptionTree` consumed/retained for
  label resolution + flat fallback; added pure `findMountInTree` for pre-select + footer
  breadcrumb. Shared `webapp-node-picker-*` dialog (node/mount/icon/media): resizable via native
  CSS `resize: both` (min/max 95vw/90vh), size persisted to localStorage and restored on
  re-open, long labels ellipsised. Spec `docs/nodes/concepts/editor.md` updated.
- **stats:** 7 files, +910/−37. Unit: +4 cases in `packages/editor/test/picker-mounts-preset.test.ts`.
  E2E: +5 P135 cases in `tests/e2e/nodes/editor/node-picker.spec.ts` and a new `pickMountInTree`
  helper; ported `editor-mount-options.spec.ts` and `p51-grid-child-props.spec.ts` from the flat
  list to the tree. Develop verification: `pnpm build` exit 0, full Playwright suite **506 passed
  / 0 failed** (8.4m, was 502 + 4 net new); check:roadmap + check:links + lint + all unit green.
- **notes:** Worktree sanity passed — local develop tip was stale (`f09e6cf` vs expected
  `8bb9705`); branched from the explicit SHA as instructed; P114 ancestry OK; helpers
  buildMountOptionsTree/flattenMountOptionTree present and consumed (not reimplemented).
  Unmounted nodes open with collapsed branches (only the current mount's path pre-expands, per
  ADR); the E2E helper expands via the twisty when needed.
- **cost:** session a09643fbdd39a877e, ~40m (orchestrator-measured wall-clock incl. develop E2E).

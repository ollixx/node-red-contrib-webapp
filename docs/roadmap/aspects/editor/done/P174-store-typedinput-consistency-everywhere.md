---
id: P174
title: "Store-typedInput überall an ADR 0013 §4 angleichen: zweizeiliges Soll-Layout (Name + eingerückter Sub-Pfad) konsistent auf allen 26 Wertfeldern; Live-Abweichung beheben"
epic: aspects/editor
findings:
  - "Owner (2026-06-13, mit Screenshot ui-pagination): 'die Controls für die beiden Felder machen NULL Sinn und haben keine Funktion.' Die Store-Felder wirken einzeilig/gequetscht — also wie die von P134 zu korrigierende P132-Variante, nicht wie das zweizeilige Soll."
  - "Owner (2026-06-13): 'Ich möchte, dass wir das Store Binding überall gleich realisieren wie dokumentiert.'"
acceptance:
  - "Das Store-typedInput rendert das ADR-0013-§4-Soll-Layout (Skizze docs/adr/assets/0013-store-field-states.svg): Zeile 1 = Store-NAME im Wertbereich + native '…'-Expand (öffnet app-scoped Picker); Zeile 2 = ZWEITE, eingerückte typedInput für den Sub-Pfad (storePath-Quellensatz). Kein einzeiliges Quetschen, keine rohe Node-id, kein 'Store ändern'-Button."
  - "Konsistenz: identisches Layout/Verhalten auf ALLEN Wertfeldern, die valueBindingTypes nutzen (26 Node-Editoren) — Stichproben-Beweis an mind. ui-pagination, ui-list, ui-button, ui-text (gleiche zwei Zeilen, gleicher Picker, gleiche Autocomplete)."
  - "Vor Store-Auswahl: nur Zeile 1 mit Soft-Hinweis 'Store über ... auswählen', KEINE Sub-Pfad-Zeile."
  - "Leaf-Form (Sub-Pfad-Quelle = Store) zeigt NUR den Namen, keine verschachtelte Sub-Pfad-Zeile (Ein-Ebenen-Regel ADR 0013 §3)."
  - "Roundtrip: Store + Literal-Sub-Pfad 'c' speichert/lädt unverändert als {kind:store, path, subPath}; msg/JSONata-Sub-Pfad ebenso."
verify: browser
spec: docs/nodes/concepts/editor.md
tests: tests/e2e/nodes/editor/store-binding-subpath.spec.ts
dependencies: []
status: done
---
# P174 — Store-typedInput überall konsistent (ADR 0013 §4)

> Repariert die **Live-Abweichung** vom dokumentierten Store-Layout. ADR 0013 §4
> (Korrektur 2026-06-11) + die Skizze
> [0013-store-field-states.svg](../../../../adr/assets/0013-store-field-states.svg)
> sind der **Soll-Zustand**. P134 sollte das schon liefern; der Owner sieht live
> aber die einzeilige/gequetschte Variante → hier konsistent für **alle** Felder
> sicherstellen. **Reines Editor-Layout** — kein Schema-/Renderer-/Modellwechsel
> (`{kind:"store", path, subPath}` bleibt).

## Worum es geht

Das Store-Control kommt aus **einer** geteilten Stelle — `storeTypedInputType` in
`resources/lib/editor-common.js` — und steckt im kanonischen `valueBindingTypes`-
Satz. Es erscheint damit auf **26 Node-Editoren** (jedes bindbare Wertfeld). Der
Fix ist deshalb **zentral**, nicht 26×.

## Umfang

1. **Soll-Layout verifizieren/erzwingen** im `storeTypedInputType.valueLabel`:
   - Zeile 1: Store-**Name** (resolveStoreName) im Wertbereich; vor Auswahl der
     Soft-Hinweis; das DB-Icon ist das Typ-Icon; die native **„…"**-Expand öffnet
     den app-scoped Picker (P68/P117). **Keine** rohe id, **kein** Button in der
     Zeile.
   - Zeile 2: die **zweite, eingerückte** Sub-Pfad-typedInput (`category:
     "storePath"`), **unter** dem Namen, in der Wertspalte (Feld-Label bleibt in
     Spalte 1). Nur wenn ein Store gewählt **und** nicht `leaf`.
2. **Render-Abweichung finden:** warum wirkt es live einzeilig? (z. B. fehlende
   `flex-direction: column`-Wirkung, Breiten-/Höhen-Clipping der typedInput-
   Wertzelle, CSS-Konflikt, oder ein Pfad, der noch die Alt-P132-Variante zieht).
   Den konkreten Defekt beheben — **kein** paralleler zweiter Code-Pfad.
3. **Konsistenz-Sweep:** sicherstellen, dass jedes Wertfeld dasselbe rendert
   (alle gehen über `valueBindingTypes` → `storeTypedInputType`; kein Knoten baut
   ein abweichendes Store-Control). Abweichler angleichen.

## acceptance / verify

- `verify: browser` — Stichproben an mehreren Knoten (ui-pagination, ui-list,
  ui-button, ui-text) beweisen das identische Zwei-Zeilen-Layout; E2E im
  Haupt-Checkout durch den Orchestrator
  ([[orchestrator-must-verify-e2e-in-main-checkout]]).
- Bestehende `tests/e2e/nodes/editor/store-binding-subpath.spec.ts` erweitern:
  die Zwei-Zeilen-Struktur (Name-Zeile + eingerückte Sub-Pfad-Zeile) explizit
  assertieren, plus Cross-Node-Konsistenz an ≥2 Knoten.

## Risiken / Hinweise

- `resources/lib/editor-common.js` ist die **einzige kanonische Kopie** der
  Editor-Helfer — Fix nur dort.
- **Kein** Modell-/Schema-/Renderer-Wechsel; reine Editor-Darstellung. Falls der
  Defekt doch im Schema/Serialisieren läge, zurückmelden statt Vertrag ändern.

## Result

- **delivered:** Fixed the live deviation of the shared store typedInput from its ADR 0013 §4
  two-row layout, centrally in `storeTypedInputType` (`resources/lib/editor-common.js`, single
  canonical copy) — so it lands on all ~26 value fields at once; no schema/renderer/model change
  (`{kind:"store", path, subPath}` unchanged). **Concrete defect:** Node-RED's typedInput framework
  locks both the outer `.red-ui-typedInput-container` (34px, overflow:hidden, row flex) and the
  value-label cell (32px, overflow:hidden) to a single fixed-height row, so P134's correct
  `flex-direction:column` wrap was sheared off — the owner's single-line/squeezed report. **Fix:**
  in `valueLabel`, only in the two-row case (store picked AND not leaf), relax the container + value
  cell to `height:auto`/`overflow:visible` (tagged `webapp-store-field-tworow`); restore the
  standard 34px row in the leaf/pre-pick branch + a namespaced one-shot `change` handler that resets
  the container the moment the field's type leaves `store`. Consistency sweep confirmed every value
  field routes through `valueBindingTypes`→`storeTypedInputType` (only ui-route overrides
  `pickerTitle`, not the control) — no outlier. Spec `docs/nodes/concepts/editor.md` updated.
- **stats:** editor-common.js (+~76 over the phase + fix) + spec + `store-binding-subpath.spec.ts`
  (+~242, 5 new cross-node two-row tests). Develop verification: `pnpm build` exit 0; unit **1528**
  green (schema 316 / renderer 103 / editor 117 / runtime 992); **store-binding-subpath.spec
  12/12 green** (7 pre-existing P134 + 5 new P174: two-row geometry on ui-pagination/ui-text/
  ui-button, both pagination fields, pre-pick row-1-only, leaf-form name-only). check:roadmap +
  check:links + lint OK.
- **notes:** **Orchestrator follow-up fix (`fix/P174-twrow-tests`):** the new cross-node tests
  failed in the authoritative run — 4 were **test-assertion bugs** (asserted `.toBeVisible()` on the
  typedInput's hidden backing `<input>`; unscoped `.red-ui-typedInput-container` matched both outer
  + nested containers → strict-mode violation; the picker-expand `.first()` hit a `display:none`
  button on ui-button → 30s timeout) and **1 was a real UX defect** in the editor-common fix: the
  **leaf form** (sub-path source = Store, ADR 0013 §3) was unreachable live — selecting Store
  snapped back to string because an empty leaf store binding `{kind:"store",path:""}` was dropped
  before the re-render. Fixed by preserving an explicitly store-typed sub-path in the LIVE envelope
  while the SAVE path still drops an unfinished leaf (no contract change). Good catch — the
  orchestrator's authoritative E2E surfaced both a real defect and the test flaws the worktree run
  had missed.
- **cost:** session ac38865e6409223fd (~14m) + fix session a789e586692a3f6bd (~23m); + orchestrator
  develop E2E.

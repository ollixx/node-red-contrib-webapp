---
id: P199
node: ui-container
epic: nodes/ui-container
title: "Container-Variant 'span': rendert NUR ein <span> (kein div/sl-card), inline — Kinder fließen inline; pro Repeat-Item kein umschließendes div → mehrere ui-text zu EINER Textzeile komponieren"
findings:
  - "Owner (2026-06-20): 'ergänzen wir noch variant span und dann wird nur und ausschließlich ein span gerendert. Also pro item bitte kein umschließendes DIV. Ich möchte mir Container horizontal einen Text erzeugen können mit mehreren ui-text und auch per repeat.'"
  - "Befund: CONTAINER_VARIANTS steht doppelt (packages/schema/src/contracts.ts:793 UND resources/lib/editor-common.js:45-48 als SelectBox-Optionen) — beide brauchen 'span'. ui-text rendert als BLOCK (style=body → <p>, TEXT_STYLE_TAG), also macht ein <span>-Wrapper allein die Kinder NICHT inline — die span-Variante muss ihre direkten Kinder inline stellen."
acceptance:
  - "CONTAINER_VARIANTS = [card, panel, section, transparent, span] — in contracts.ts UND der editor-common-SelectBox-Liste (container/card/repeat) ergänzt; die Variant-SelectBox bietet 'span' an."
  - "Serializer: variant='span' → tag = <span> (NICHT sl-card, NICHT div), class webapp-container--span; sonst unverändert (card→sl-card, panel/section/transparent→div)."
  - "CSS (Page-Shell): .webapp-container--span { display:inline; } UND die DIREKTEN Kinder inline + ohne Block-Marge: .webapp-container--span > * { display:inline; margin:0; } — überschreibt das Basis-display:grid/gap der .webapp-container."
  - "ui-container variant=span mit mehreren ui-text rendert sie auf EINER Zeile (inline), Wrapper = <span>, KEIN div/sl-card. Beobachtbar: die Texte stehen nebeneinander, nicht untereinander."
  - "ui-repeat variant=span: der per-Item-Wrapper ist ein <span> (kein div pro Item) über die GEMEINSAME Container-Variant-Quelle (P197/P198); ein Repeat über ['a','b','c'] mit einem ui-text(item) ergibt 'abc' inline."
  - "Round-trip + Migration: bestehende Container/Repeats unverändert; span speichert/lädt; Default-Varianten (ui-container=card, ui-repeat=transparent) unberührt."
verify: browser
spec: docs/nodes/display/ui-container.md
tests: tests/e2e/nodes/composite/ui-container.spec.ts
dependencies: []
status: done
---
# P199 — Container-Variant `span` (inline Textkomposition)

> Fünfte Variante, nutzt die **eine** Container-Variant-Quelle aus P198 (+ P197
> für ui-repeat). Ziel: aus mehreren `ui-text` (statisch ODER per Repeat) eine
> **Inline-Textzeile** bauen — kein Block-Wrapper, kein div pro Item.

## Umfang

1. **Schema:** `span` an `CONTAINER_VARIANTS` (`contracts.ts:793`).
2. **Editor:** `span` in die SelectBox-Optionslisten (`editor-common.js:45-48`:
   container/card/repeat). (Anmerkung: die Doppelung der Liste ist bekannt — hier
   beide Stellen pflegen; Entdopplung ist separat.)
3. **Serializer (Container-Block):** Element-Wahl erweitern — `span` → `<span>`.
4. **CSS (Page-Shell, `nodes/webapp.js`):** `.webapp-container--span { display:inline }`
   **plus** `.webapp-container--span > * { display:inline; margin:0; }` damit die
   Block-Kinder (ui-text `<p>`) inline fließen. Überschreibt das Basis-`grid`.
5. **ui-repeat:** kein Extra-Code — der per-Item-Wrapper läuft schon über die
   gemeinsame Quelle (P197); mit `span` wird er ein `<span>` ohne div. Verifizieren.
6. **Doku/Tests:** ui-container-Theming um `span` (inline) ergänzen; E2E für beide
   Fälle (statischer span-Container + Repeat mit span).

## acceptance / verify

- `verify: browser` — (a) ui-container variant=span + 3× ui-text → eine Zeile,
  Wrapper `<span>`, kein div; (b) ui-repeat variant=span über ein String-Array →
  Werte inline aneinander. E2E im Haupt-Checkout durch den Orchestrator
  ([[orchestrator-must-verify-e2e-in-main-checkout]]).

## Risiken / Hinweise

- **Kern ist die Kinder-inline-Regel** — ohne `> * { display:inline }` bleiben die
  ui-text-`<p>` Blöcke und brechen um (Ziel verfehlt). Das ist der eigentliche
  Trick, nicht nur der `<span>`-Wrapper.
- Span ist **inline** → Layout-Presets (grid/horizontal) sind hier irrelevant;
  der Inline-Fluss IST das horizontale Verhalten.
- `<span>` darf keine Block-Kinder erzwingen, die HTML-invalid wären — `<p>` in
  `<span>` ist technisch unsauber; falls der Validator/Browser zickt, ui-text in
  der span-Variante auf ein inline-Tag (`<span>`) abbilden (Folge-Detail; zuerst
  via CSS lösen, sonst Tag-Wahl).

## Result

- **delivered:** Fifth container variant **`span`** — composes multiple `ui-text` (static OR per
  ui-repeat item) into ONE inline text line via the shared P198 variant path (no second renderer).
  Schema: `span` added to `CONTAINER_VARIANTS` (`contracts.ts`). Editor: `span` added to all three
  variant SelectBox option lists in `editor-common.js` (the known contracts/editor duplication — both
  kept honest). Serializer (`webapp-serializer.js` container block): `span` → `<span class="webapp-
  container webapp-container--span">` (NOT sl-card, NOT div; the other 4 variants unchanged). CSS
  (`nodes/webapp.js` page-shell `<style>`): `.webapp-container--span { display:inline }` **plus the
  actual trick — forced-inline DESCENDANT rules** (`margin:0; display:inline`) on the intermediate
  layout/slot/item wrappers, not just `> *`, because the P191/P197 per-item layout-wrapper divs sit
  between the span container and the ui-text — overriding the base `.webapp-container` grid/gap. Doc
  theming table extended 4→5. ui-repeat needed **no extra code**: with `variant=span` its per-item
  wrapper goes through the shared source and becomes a `<span>` (no per-item div).
- **stats:** 9 files (+198/−7; new fixture `ui-repeat-span.flow.json`); unit **1054** (+span serializer
  assertion). Develop verification: build exit 0; full unit green; **E2E 24/24 green** — ui-container
  10/10 (incl. 2 new P199: span renders a `<span>` not sl-card/div; 3 ui-text children flow inline on
  one row ±4px) + ui-repeat (incl. the new P199: `variant=span` over `['a','b','c']` → per-item
  `<span class="…--span">` wrappers, no divs, values inline); check:specs (39/3) + check:links +
  check:roadmap + lint green.
- **notes:** The **`<p>`-in-`<span>` inline-tag fallback was NOT needed** — the CSS forced-inline
  overrides on all intermediate wrappers are sufficient; `<p>` inside `<span>` renders correctly inline.
  **Orchestration:** the first agent stopped early (mid step 2, schema + partial editor uncommitted);
  recovered from its worktree by a second agent that finished deliverables 3–6, ran the E2E green
  in-worktree, and committed — no work lost.
- **cost:** session agent-a8ce39d4901b71fb6 (partial) + recovery agent-a2becc01470a00178.

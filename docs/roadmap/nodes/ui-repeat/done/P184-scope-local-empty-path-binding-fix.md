---
id: P184
node: ui-repeat
epic: nodes/ui-repeat
title: "Scope-lokale Bindings mit leerem Pfad reparieren: whole-`item` (z. B. String-Element) und `index` werden mit path:'' serialisiert/validiert → 'Binding paths must not be empty' + 'must not carry a path'"
findings:
  - "Owner (2026-06-14): 'Wie binde ich ein ui-text an das item, wenn es nur ein String ist?' — der vorgesehene Weg (Typ 'Item (Repeat)', Pfad leer = ganzes Element) schlägt fehl."
  - "Owner (2026-06-14): Binding-Typ 'index' liefert einen Fehler: 'Invalid ui-text definition: value.path: Binding paths must not be empty. value: An index binding is the bare item position — it must not carry a path.'"
  - "Code-Befund: bindingSchema (packages/schema/src/contracts.ts:198) hat path: z.string().min(1).optional() — .optional() greift nur bei undefined, NICHT bei ''. Der Editor serialisiert aber index als {kind:'index', path:''} (und whole-item als path:'') → die .min(1)-Regel UND die index/item-Refines feuern beide. Whole-item (String-Element) bricht identisch."
acceptance:
  - "Ein ui-text mit Binding {kind:'item'} (ganzes Element, KEIN Pfad) auf ein String-Element rendert den String — keine Validierungsfehler."
  - "Ein ui-text mit Binding {kind:'index'} (KEIN Pfad) rendert die nullbasierte Position — kein 'must not be empty' / 'must not carry a path'."
  - "Editor-Serialisierung: whole-item und index werden OHNE path-Schlüssel gespeichert (leerer Pfad wird weggelassen, nicht als '' gesetzt); item MIT Feldpfad speichert den Pfad weiterhin."
  - "Schema-Toleranz/Migration: ein bestehend gespeichertes path:'' auf item/index/prop wird wie 'kein Pfad' behandelt (normalisiert), sodass Altflows validieren statt rot zu werden."
  - "Negativ bleibt rot: ein index MIT echtem (nicht-leerem) Pfad; ein item-Pfad, der dem dotted-field-Muster nicht entspricht."
  - "prop (whole, kein Pfad) verhält sich analog (gleiche Leerpfad-Behandlung)."
verify: browser
spec: docs/nodes/display/ui-repeat.md
tests: tests/e2e/nodes/view/ui-repeat.tests.md
dependencies: []
status: done
---
# P184 — Scope-lokale Bindings mit leerem Pfad reparieren

> **Bug, blockiert ui-repeat-Grundnutzung.** Man kann derzeit weder an ein
> **String-Element** (whole `item`) noch an **`index`** binden — beide tragen
> `path:''`, und das Schema lehnt leere Pfade ab. Frage 1 + 2 des Owners sind
> dieselbe Ursache.

## Kern des Fixes (zwei Seiten)

1. **Editor (Serialisierung):** `index` als `{kind:'index'}` und whole-`item`/
   whole-`prop` als `{kind:'item'}`/`{kind:'prop'}` speichern — **leeren Pfad
   weglassen**, nicht `path:''` setzen (`applyValueBinding`, `resources/lib/
   editor-common.js`).
2. **Schema (Toleranz):** in `contracts.ts` `path` für die scope-lokalen Kinds so
   behandeln, dass `''` ≡ „kein Pfad" ist — z. B. `path` vor der `.min(1)`-Prüfung
   auf `undefined` normalisieren, wenn leer, **bevor** die index/item/prop-Refines
   laufen. So validieren auch Altflows mit `path:''` (Migration ohne Re-Save).

Damit löst sich **Frage 1** (String-Element binden = Typ „Item (Repeat)", Pfad
leer) **und Frage 2** (index) zugleich.

## acceptance / verify

- `verify: browser` — im laufenden Repeat: String-Items via whole-`item`,
  Positionen via `index`; E2E im Haupt-Checkout durch den Orchestrator
  ([[orchestrator-must-verify-e2e-in-main-checkout]]).
- Schema-Unit: `{kind:'item'}`/`{kind:'index'}`/`{kind:'prop'}` ohne Pfad gültig;
  `path:''` toleriert; `index` mit Pfad + malformierter item-Pfad rot.

## Risiken / Hinweise

- **Invariante:** `packages/schema` importiert aus keinem anderen Repo-Paket.
- Sofort-Workaround für den Owner bis zum Fix: Items als Objekte `{label:"A"}`
  modellieren und `item.label` binden (item-MIT-Pfad ist nicht betroffen).
- Reine Form-Validierung + Editor-Serialisierung — **kein** Renderer-/Scope-
  Auflösungs-Wechsel (P164 bleibt).

## Result

- **delivered:** Fixed the empty-path rejection that blocked basic repeat usage over primitive arrays.
  Schema (`packages/schema/src/contracts.ts`): removed the field-level `path: z.string().min(1)` from
  both `bindingSchema` and `leafBindingSchema`, moving empty-path enforcement into
  `refineBindingKindShape` — it now **normalises `path:''` to "no path" for `item`/`index`/`prop`** (so
  a whole-item binding over a string element, and a bare `index`, validate like the path-free form, and
  old flows saved with `path:''` keep validating) while data-binding kinds (`state`/`query`/…) still
  **reject** empty paths via the existing `!binding.path` guard. Editor
  (`resources/lib/editor-common.js` `applyValueBinding`): omits the `path` key entirely for
  `item`/`index`/`prop` when empty. The **renderer needed no change** — it already resolved a falsy
  path as the whole item (P164 stands).
- **stats:** 8 files (1 new fixture `tests/e2e/fixtures/ui-repeat-primitive.flow.json`). Unit suite
  green (schema +8: accepts item/index/prop with empty path & tolerates `path:''`, data kinds stay
  red; renderer +3: resolves whole-item + index over a string array; editor serialisation drops the
  empty key). Develop verification (with P182 already merged): `pnpm build` exit 0; full unit **1651
  passed**; lint + validate + both tripwires green; **ui-repeat E2E proof green** (`ui-repeat.spec.ts`
  — a string-array repeat renders `alpha,0 / beta,1 / gamma,2`, whole item + zero-based index); the
  P182 gating spec re-verified green after the shared-file (`editor-common.js`) merge.
- **notes:** Spec `docs/nodes/display/ui-repeat.md` already documented `item` as the whole element and
  `index` as path-free — the fix brought the implementation in line with the doc (no doc change).
  Updated two pre-existing `p113-value-binding-types.test.ts` cases that asserted the OLD buggy
  `path:''` serialisation to the corrected contract (empty path omitted) + added a `prop` case; these
  merged cleanly with P182's gated-set update to the same file (combined unit suite green). The
  supplementary full-suite final gate was interrupted twice (re-drive); the targeted ui-repeat +
  gating E2E and the schema/renderer unit coverage are the authoritative gate for this narrowly-scoped
  contract change. The only known full-suite red remains the pre-existing accordion-open defect
  (predates this wave, filed separately).
- **cost:** session agent-a1171413958fa144a, ~28m.

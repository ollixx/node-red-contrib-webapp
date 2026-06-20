---
id: P197
node: ui-repeat
epic: nodes/ui-repeat
title: "ui-repeat bekommt das variant-Feld (CONTAINER_VARIANTS) wie ui-container — konform; Default transparent (Repeat ist chrome-los, ADR 0017)"
findings:
  - "Owner (2026-06-20): 'Die Variant aus ui-container fehlt im repeat.'"
  - "Befund: ui-container hat variant: { value: 'card' } (CONTAINER_VARIANTS). ui-repeat hat KEIN variant-Feld (im HTML nur variant:false = Base-Field-N/A). Nach P191 (eigenes content-Layout) ist ui-repeat ein vollwertiger Container — variant fehlt zur Konformität."
acceptance:
  - "ui-repeat-Schema/HTML: ein variant-Feld (Variant-SelectBox, CONTAINER_VARIANTS = card/panel/section/transparent) — exakt wie ui-container, an derselben Editor-Stelle."
  - "Default = transparent (nicht card): ein ui-repeat ist strukturell/chrome-los (ADR 0017) → standardmäßig KEIN Card-Chrome um die geklonten Kinder (kein verschwendeter Platz)."
  - "Der Wrapper der content-Layout-Region des Repeats (P191) honoriert den Variant über DIESELBE Rendering-Quelle wie ui-container (P198) — card/panel/section/transparent sehen gleich aus wie beim ui-container."
  - "Round-trip + Migration: bestehender ui-repeat ohne variant öffnet als transparent (kein Pflichtfeld-Bruch); gewählter Variant speichert/lädt."
  - "Folge: man kann die Kinder direkt in den ui-repeat mounten und den Look am Repeat wählen — ein Zwischen-ui-container nur fürs Aussehen ist nicht mehr nötig."
verify: browser
spec: docs/nodes/display/ui-repeat.md
tests: tests/e2e/nodes/view/ui-repeat.tests.md
dependencies: [P198]
status: done
---
# P197 — ui-repeat: variant-Feld (Container-Konformität)

> Vervollständigt die Container-Konformität (nach P191 = eigenes Layout): wie
> `ui-container` trägt `ui-repeat` jetzt auch `variant`. **Default `transparent`**,
> weil ein Repeat per ADR 0017 keine eigene Chrome hat — so gibt es standardmäßig
> keine verschwenderische Card um die Klone. Nutzt das Variant-Rendering aus
> **P198** (eine Quelle).

## Umfang

1. **Feld:** `variant` (Variant-SelectBox, `CONTAINER_VARIANTS`) im ui-repeat-HTML
   + Schema; Editor-Stelle identisch zu ui-container.
2. **Default `transparent`** (Schema-Default); Migration: kein variant → transparent.
3. **Wrapper:** der content-Layout-Region-Wrapper des Repeats (P191) wird über die
   **gemeinsame** Container-Variant-Rendering-Quelle (P198) ausgegeben — kein
   eigener Pfad.
4. **Spec:** ui-repeat-Felder + Einordnung um `variant` ergänzen; Hinweis, dass
   ein reiner Optik-Zwischencontainer dadurch entfällt.

## acceptance / verify

- `verify: browser` — ein ui-repeat mit variant=transparent fügt KEIN Card-Chrome
  hinzu; variant=card umrahmt die Klon-Region als Karte; Round-trip. E2E im
  Haupt-Checkout durch den Orchestrator
  ([[orchestrator-must-verify-e2e-in-main-checkout]]).

## Risiken / Hinweise

- **Hängt an P198** (das eigentliche Variant-Rendering) — sonst hätte ui-repeat
  zwar das Feld, aber dieselbe „alles sieht aus wie Card"-Schwäche.
- Default bewusst **transparent** (anders als ui-container=card), passend zur
  chrome-losen Repeat-Natur — falls du card bevorzugst, ist es eine Owner-Sub-
  Entscheidung.

## Result

- **delivered:** ui-repeat completes its container conformance — it now carries a `variant` field
  (`CONTAINER_VARIANTS` = card/panel/section/transparent), **default `transparent`** (chrome-less per
  ADR 0017, so no wasted card around the clones), rendered through the **same** variant source P198
  built (no second path). Schema: optional `variant` on `uiRepeatNodeDefinitionSchema`
  (`node-definitions.ts`); `COMPONENT_VARIANT_VOCABULARY.repeat` = CONTAINER_VARIANTS +
  `COMPONENT_VARIANT_DEFAULT.repeat` = `transparent` (`contracts.ts`, mirrored in editor-common.js).
  Editor: `variant:{value:"transparent"}` default + `installVariantSelectBox("repeat")` at the
  ui-container location pattern (`ui-repeat.html`). Runtime: both `nodes/webapp.js` mapConfig stages
  carry `variant` (the registry stage + `toComponentDefinitions`, transparent default like `layoutId`);
  `expandRepeat` already spreads `repeat.props` onto the per-item container, so the shared serializer
  renders card→`<sl-card>`, transparent→plain `<div>`+`webapp-container--transparent`. Spec updated
  (variant row + note that a look-only intermediate ui-container is no longer needed).
- **stats:** 11 files (8 changed, 3 new — schema test, renderer wrapper test, fixture). Develop
  verification: build exit 0; full unit green (schema 381, renderer 156, runtime); **E2E 21/21 green** —
  ui-repeat 13/13 incl. 3 new P197 proofs (variant=card frames each per-item region as sl-card,
  transparent adds no chrome, round-trip of distinct variants on one page) + ui-container 8/8 (the
  shared P198 path serves both); check:specs (39/3) + check:links + check:roadmap + lint green.
- **notes:** Builds on P191 (per-item container wrapper) + P198 (variant rendering) — both confirmed
  present. The sub-agent **ran its E2E green in-worktree** and self-caught the recurring mapConfig-drop
  bug class (the registry-stage `mapConfig` initially dropped `variant`, so every repeat defaulted to
  transparent regardless of choice — the first E2E run caught card→div; fixed by carrying `variant` in
  both stages). check:specs reconciled fine under the existing ui-repeat allowlist (no `check-specs.js`
  edit). With P190/P191/P193/P196/P197 all landed, the P195 follow-up (drop ui-repeat from the
  check:specs allowlist + make its spec field-table fully conformant) is now actionable.
- **cost:** session agent-a78c181b2ea6c8b62, ~14m.

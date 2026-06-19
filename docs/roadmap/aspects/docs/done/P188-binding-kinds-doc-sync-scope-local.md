---
id: P188
title: "Doc-Sync scope-lokale Binding-Arten: stores.md-Überblick + Per-Node-Value-Felder um item/index/prop ergänzen (auf editor.md §Scope-lokal verweisen statt 26× neu listen)"
epic: aspects/docs
findings:
  - "Owner (2026-06-19): 'Ich schaue mir ui-text an und sehe, dass die docs immer noch nicht mit dem code zusammenpassen. Die Types Item und Index tauchen dort nicht auf. Wir haben das lange diskutiert. Wo stehen die Ergebnisse? Wieso klappt das nicht?'"
  - "Befund: editor.md §198 dokumentiert die scope-lokalen Arten (item/index/prop, P182) vollständig. ABER stores.md 'Binding-Arten im Überblick' (§289) listet nur den globalen 14er-Satz, und die Per-Node-value-Felder (ui-text Z.45 + ~26 weitere) zählen den Satz INLINE auf — beide ohne item/index/prop und ohne Verweis auf editor.md §198. P182 hat editor.md aktualisiert, aber nie einen Sweep über stores.md + die Node-Specs gemacht."
acceptance:
  - "stores.md 'Die Binding-Arten im Überblick' führt item/index/prop als SCOPE-LOKALE Arten (liest aus / aufgelöst von / nur im jeweiligen Scope sichtbar) und verweist auf editor.md §'Scope-lokale Binding-Arten' (P182)."
  - "Die Per-Node-Value-Feld-Beschreibungen (ui-text + alle Wert-Binding-Knoten) erwähnen die scope-lokalen Arten NICHT mehr durch erneutes Inline-Auflisten, sondern verweisen auf den kanonischen Abschnitt (stores.md/editor.md) — eine Quelle, keine 26 driftenden Listen. Mindestens ui-text wird beispielhaft umgestellt; das Muster ist dokumentiert."
  - "Klargestellt (gegen den Owner-Eindruck): item/index erscheinen im Editor NUR, wenn der Knoten (transitiv) unter einem ui-repeat hängt (prop: in einer Component-Definition) — auf einem freien ui-text sind sie by design ausgeblendet (P182). Dieser Satz steht in der ui-text-Spec bzw. im kanonischen Abschnitt."
  - "check:links bleibt grün (alle neuen Querverweise lösen auf)."
verify: unit
spec: docs/nodes/concepts/stores.md
tests: tests/e2e/nodes/view/ui-text.tests.md
dependencies: []
status: done
---
# P188 — Doc-Sync: scope-lokale Binding-Arten

> **Reine Doku.** Die scope-lokalen Arten sind in `editor.md` §198 sauber
> dokumentiert; der Sweep über `stores.md` + die Per-Node-Specs fehlt. Ergebnis
> für den Owner: „docs passen nicht zum code". Dieses Paket schließt die Lücke —
> **eine kanonische Quelle**, keine 26 Inline-Listen.

## Umfang

1. **stores.md „Binding-Arten im Überblick" (§289):** item/index/prop als
   **scope-lokale** Arten ergänzen (eigene Mini-Tabelle oder Zeilen mit Scope-
   Spalte); Querverweis auf editor.md §„Scope-lokale Binding-Arten" (P182) +
   ADR 0017/0020.
2. **Per-Node-Value-Felder entdoppeln:** wo eine Spec den kanonischen Satz
   **inline** auflistet (ui-text Z.45 u. a.), den scope-lokalen Zusatz **nicht**
   neu auflisten, sondern auf den kanonischen Abschnitt verweisen — damit die
   Listen nicht wieder driften. ui-text exemplarisch umstellen; das Muster (Verweis
   statt Wiederholung) in `.ai/agents/node-testing.md`/Spec-Konvention notieren.
3. **Editor-Gating erklären:** ein Satz in der ui-text-Spec (bzw. kanonisch), dass
   item/index/prop **kontextabhängig** sind (nur im Repeat/Component sichtbar,
   P182) — damit „taucht nicht auf" als *Absicht* erkennbar ist.

## acceptance / verify

- `verify: unit` — Doku; `pnpm check:links` muss grün bleiben (Querverweise).
  Kein Browser-Beweis nötig (keine Verhaltens-/Render-Änderung).

## Risiken / Hinweise

- **Kein** Code-/Editor-/Schema-Wechsel — editor.md §198 + P182 sind bereits
  korrekt; hier wird nur der Rest der Docs darauf ausgerichtet.
- Den 26-Specs-Sweep schlank halten: Ziel ist **Verweis auf eine Quelle**, nicht
  26× dieselbe erweiterte Liste (die nächste Drift ist sonst vorprogrammiert).
- Folge-Kandidat (separat): prüfen, ob weitere Per-Node-Specs den Binding-Satz
  inline duplizieren und generell auf den kanonischen Abschnitt umstellen.

## Result

- **delivered:** Doc-sync for the scope-local binding kinds (pure docs). `docs/nodes/concepts/stores.md`
  gained a "Scope-lokale Binding-Arten (P182, ADR 0017/0020)" sub-section — a table of `item`/`index`/
  `prop`, the context-gating rule, and a canonical link to `editor.md`; the canonical-value-set
  paragraph now mentions the scope-local kinds. Four per-node specs that **explicitly re-enumerated**
  the binding kinds were de-duplicated to reference the canonical section: `ui-text.md` (exemplary
  node — added the 5th "Scope-lokal" category with the gating note), `ui-alert.md` (message/title/icon),
  `ui-avatar.md` (initials), `ui-select.md` (label/value/disabled).
- **stats:** 5 files (+46/−13); 4 per-node specs de-duplicated. check:links green (103 md files, all
  refs resolve), check:roadmap green, `pnpm validate` green.
- **notes:** The other ~22 per-node specs use looser phrasing ("alle Binding-Arten", "voller
  Binding-Satz") without enumerating the kinds — they were NOT duplicating the full list, so per the
  package's "only de-duplicate the generic enumeration" guidance they were left unchanged (the
  follow-up candidate noted in the package remains open if the owner wants a fuller sweep). Gate =
  the doc-link tripwire (docs-only, no code/test impact).
- **cost:** session agent-a7ed034cc400c2519, ~8m.

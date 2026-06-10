---
id: P130
node: ui-datepicker
epic: nodes/ui-datepicker
title: "ui-datepicker: bindbares disabled (Boolean-Zustand-typedInput, inkl. Store)"
findings:
  - "alle values möglichst immer auch alle Bindings bekommen. Gerade bei Disabled ist ein Store-Binding unbedingt nötig. Das gilt für alle values in allen Knoten."
verify: browser
spec: docs/nodes/input/ui-datepicker.md
tests: tests/e2e/nodes/view/ui-datepicker.tests.md
dependencies: [P113]
status: done
---
# P130 — ui-datepicker: bindbares disabled

> Prinzip & Matrix: [ADR 0012](../../../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md).
> Fundament: **P113**. `value`/`label` sind bereits typedInput (P98) — dieses
> Paket ergänzt **nur** ein bindbares `disabled`. Reines Editor-Paket (Runtime
> löst `bind.disabled` bereits auf).

## Zielmodell (Editor)

- Neues Feld **`disabled`** als **Boolean-Zustand**-typedInput aus dem
  P113-Helfer: Store, Query, Route-Param, Reactive, msg, JSONata, **boolean**,
  Flow, Global, Env. Persistiert als Binding-Objekt. Default: kein Binding.
  Kein Legacy-Feld zu migrieren.

## acceptance (observierbar, browser)

- `disabled`-typedInput bietet genau den Boolean-Zustand-Satz inkl. **Store**;
  `Store → <ui-store>` deaktiviert den Datepicker live, sobald truthy;
  Round-Trip des Binding-Objekts über Schließen/Öffnen.
- Bestehende ui-datepicker-E2E bleiben grün.

## spec / tests

- `docs/nodes/input/ui-datepicker.md`: Feld `disabled` (typedInput, Boolean-
  Zustand) dokumentieren; ADR 0012 referenzieren.
- `tests/e2e/nodes/view/ui-datepicker.tests.md`: disabled-Store-Binding-Fall.

## Result

- **delivered:** ui-datepicker: bindbares `disabled` über den kanonischen P113-Helfer (`valueBindingTypes('boolean')` + `readValueBinding`/`applyValueBinding`). Die Knoten-`disabled`-Behandlung (bei ui-datepicker auch label/value) vom Legacy-`bindingTypedInputTypes` auf den kanonischen Satz migriert. Keine Helfer-Redefinition (editor-common.js-Delta 0). Muster = ui-checkbox (P129).
- **stats:** Reine Editor-Phase (Serializer emittierte `disabled` bereits). Eigene E2E-Spec im Worktree verifiziert (self-verified). Batch-3-Cross-Check auf gebautem develop: **479 passed, exit=0, 0 failed**. Unit 871.
- **notes:** P113-Ancestor + In-Scope-Commit (1) bei Merge verifiziert; `view.spec.ts` geprüft. Teil von Batch 3 (sequenziell self-verified) — Abschluss der ADR-0012-Knotenwelle P122–P130.
- **cost:** Batch 3 (sonnet, ~4m je).

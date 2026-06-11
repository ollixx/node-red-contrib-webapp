---
id: P138
node: ui-skeleton
epic: nodes/ui-skeleton
title: "ui-skeleton: visiblePath→Standard-visible-typedInput; lines disablen, wenn displayType es nicht trägt (mit Hinweis)"
findings:
  - "warum hat nur dieser knoten einen visible path? Der sollte das standard typedinput haben"
  - "'lines' sollte disabled werden, wenn der ausgewählte typ das nicht unterstützt (avatar)"
verify: browser
spec: docs/nodes/feedback/ui-skeleton.md
tests: tests/e2e/nodes/view/ui-skeleton.tests.md
dependencies: [P113]
status: pending
---
# P138 — ui-skeleton: visible standardisieren + lines kontextabhängig

> Prinzip: [ADR 0012](../../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md)
> (Boolean-Zustand). Der „N/A-Feld disablen + Hinweis"-Teil ist hier **node-lokal**
> umgesetzt; das **allgemeine** Basis-Felder-Konzept (visible/enabled/color/size,
> Gruppierung, N/A-Disable) ist separat geparkt (siehe [[P139]] — ADR ausstehend).

## Befund (heute)

- `ui-skeleton` ist der **einzige** Knoten mit einem eigenen `visiblePath`-Textfeld
  (required) — ein Sonderweg statt des Standard-Bindings.
- `lines` (Zahl) gilt nur für textartige `displayType`s; bei `displayType` ohne
  Linien (z. B. avatar/image) ist das Feld bedeutungslos, aber aktiv.

## Zielmodell (Editor)

1. **`visiblePath` → Standard-`visible`-typedInput** (Boolean-Zustand-Satz nach
   ADR 0012: Store, Query, Route-Param, Reactive, msg, JSONata, boolean, Flow,
   Global, Env). Migration `visiblePath`→`{kind:"state", path:<visiblePath>}`.
   Default: sichtbar (kein Binding ⇒ true).
2. **`lines` disablen**, wenn der gewählte `displayType` keine Linien rendert
   (z. B. avatar/image) — Feld ausgegraut **mit Hinweis** („Lines gilt nur für
   den Text-Typ"). Welche displayType-Werte Linien tragen: aus der ui-skeleton-
   Spec ableiten.

## acceptance (observierbar, browser)

- Es gibt **kein** `visiblePath`-Textfeld mehr; stattdessen ein `visible`-
  typedInput (Boolean-Zustand-Satz, inkl. Store). Store-Binding (truthy/falsy)
  blendet das Skeleton live ein/aus. Migration verlustfrei.
- Bei `displayType` ohne Linien ist `lines` **disabled** mit sichtbarem Hinweis;
  bei Text-Typ wieder aktiv.
- Bestehende ui-skeleton-E2E grün.

## spec / tests

- spec: `docs/nodes/feedback/ui-skeleton.md` — `visible` (Standard-typedInput,
  Migration) + `lines`-Anwendbarkeit dokumentieren.
- tests: `tests/e2e/nodes/view/ui-skeleton.tests.md` (neu/erweitern):
  visible-Binding, visiblePath-Migration, lines-Disable je displayType.

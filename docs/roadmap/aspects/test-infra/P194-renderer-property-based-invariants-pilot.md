---
id: P194
title: "PBT-Pilot am Renderer: fast-check-Baum-Generator + Kern-Invarianten (Scope-Auflösung, Mount-eindeutig, Id-Eindeutigkeit, Totalität/Determinismus/Idempotenz) + Wrap-Invarianz (P192-Gesetz)"
epic: aspects/test-infra
findings:
  - "Owner (2026-06-19): 'ich sehe ein großes problem darin, die permutationen der vielen knoten sinnvoll zu testen. Wie machen das andere Projekte? Wie kann man durch clevere tests prüfen, dass die vielen features in den verschiedenen kombinationen und schachtelungen wirklich laufen?' → Entscheidung: ADR 0024 (Naht-Invarianten + PBT) und dieser Pilot."
acceptance:
  - "fast-check ist als devDependency drin; ein Renderer-Property-Test (packages/renderer/test/p194-invariants.property.test.ts) läuft in der Unit-Suite (schnell, deterministischer Seed in CI)."
  - "Ein Baum-Generator erzeugt GÜLTIGE AppModels über einen repräsentativen Knoten-/Container-Satz (ui-app/route + ui-container, ui-repeat, ui-tabs/ui-tab, ui-accordion/-section, Blatt-Views), beschränkte Tiefe/Breite, mit item/index-Bindings in Repeats."
  - "Kern-Invarianten gelten für JEDES generierte Modell: (a) jedes item/index in einem Repeat löst auf (nie scope-loss-'?'); (b) jeder Mount löst auf GENAU eine Region (kein Orphan/keine Kollision); (c) data-webapp-node-Ids sind eindeutig; (d) Render ist total (wirft nie), deterministisch und idempotent (zweimal rendern = identisch)."
  - "Metamorphe Wrap-Invarianz (das P192-Gesetz): einen beliebigen Subtree in einen Pass-Through-ui-container zu wickeln ändert die aufgelösten Blattwerte NICHT — als Property über generierte Bäume."
  - "Ein Fehlschlag schrumpft auf einen minimalen Repro (fast-check shrinking) und ist reproduzierbar (Seed im Output)."
  - "Doku: ein Querschnitts-Katalog tests/.../composition.tests.md (o. ä.) hält die Naht-Invarianten fest, parametrisiert über die Container-Arten; .ai/agents/node-testing.md verweist darauf."
verify: unit
spec: docs/adr/0024-compositional-testing-seam-invariants-property-based.md
tests: tests/e2e/nodes/view/ui-repeat.tests.md
dependencies: [P192]
status: pending
---
# P194 — PBT-Pilot am Renderer

> Stufe 1 aus [ADR 0024](../../../adr/0024-compositional-testing-seam-invariants-property-based.md).
> Beweist den Ansatz **am realen Code**: der Generator + die Invarianten hätten
> P190/P192 von selbst gemeldet. Setzt auf P192 auf, damit die Wrap-Invarianz grün
> ist (vorher ist sie der rote Test, der P192 erzwingt — test-first).

## Umfang

1. **`fast-check`** als devDependency; ein Property-Test im `packages/renderer`.
2. **Baum-Generator** (Arbitrary) für gültige AppModels: repräsentativer
   Knoten-/Container-Satz, beschränkte Tiefe/Breite, Repeats mit item/index-
   Kindern; produziert nur **schema-gültige** Modelle (über die Fixtures/Builder).
3. **Kern-Invarianten** (ADR 0024 §2) als Properties.
4. **Wrap-Invarianz** (ADR 0024 §3 / P192) als metamorphe Property.
5. **Doku/Katalog:** die Naht-Invarianten als Querschnitts-`composition`-Katalog,
   parametrisiert über die Container-Arten; Verweis aus node-testing.md.

## acceptance / verify

- `verify: unit` — die Property-Suite läuft grün in `pnpm test`; ein bewusst
  eingebauter Fehler (z. B. Scope-Propagation aus) macht die passende Invariante
  rot + zeigt einen minimalen Repro (kurz im Paket-Abschluss demonstrieren).

## Risiken / Hinweise

- **Generator = die eigentliche Arbeit:** er muss **gültige** Modelle bauen
  (sonst testet man Müll). An den bestehenden Fixtures/Buildern (`packages/schema`
  `fixtures.ts`) orientieren; ungültige Kombinationen ausschließen, nicht prüfen.
- **Invarianten präzise halten** — eine zu strenge Invariante erzeugt
  False-Positives. Lieber mit den 4 robusten Kern-Invarianten starten, dann
  erweitern.
- **Determinismus in CI:** fixer Seed + ausreichende `numRuns`; Repro-Seed im
  Fehlerfall loggen.
- Folgearbeit (separat): Pairwise-Matrizen, Editor-Round-trip-Property (P190-Klasse),
  Kitchen-Sink-Galerie an die Showcase-Videos (P187) koppeln.

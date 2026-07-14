# Epic: node-conformance

Systematischer **Konformitäts-Pass pro `ui-*`-Knoten**: Knoten für Knoten werden
alle Felder geprüft/korrigiert, die Doku angepasst, die Inline-User-Hilfe
optimiert, **beobachtbare Akzeptanzkriterien für jedes Feature** erfasst und die
**Testabdeckung frisch** dagegen aufgebaut. Owner-getrieben (2026-07-14),
step-by-step reviewt.

## Die 5 Dimensionen pro Knoten

Jedes Paket (`PNNN-conformance-ui-<node>.md`) prüft denselben Satz und hält die
Findings + die Akzeptanzkriterien fest:

1. **Felder** — je Feld Typ/Default/Pflicht/Binding-Arten korrekt; keine toten/
   Legacy-Reste; node-lokale Fehler fixen. Cross-cutting Renames/Legacy-Sweep
   bleiben bei **P228/P229** (nicht duplizieren). Wächter: `check:fields`,
   `check:specs`.
2. **Spec** (`docs/nodes/<cat>/<node>.md`) — Detail-Bar (AGENTS.md R11): je Feld
   Typ/Werte/Default/Binding-Kinds/per-Backend/Validierung+Fehlertext/
   Abhängigkeiten/**beobachtbare Render-Wirkung**; Input/Output/Events/Theming.
   Stale Aussagen korrigieren. Wächter: `check:specs`.
3. **User-Doku** (Inline-HTML `data-help-name`) — knapp, korrekt, Zweck +
   wichtigste Felder + Link zur Voll-Doku.
4. **Akzeptanzkriterien** — für **jedes** Feature/Feld ein **beobachtbares**
   Kriterium (Roadmap-`acceptance`-Format). Der Test-Vertrag.
5. **Tests neu** — frisch nach `.ai/agents/node-testing.md` (Unit + Playwright,
   outcome-based, per Feature, `.tests.md`-Katalog aktuell, ggf. Showcase). Alte
   Presence-/„renders without crashing"-Tests **verworfen**.

## Ablauf (pro Knoten)

Audit (alle 5 Dimensionen, mit Belegen) → **Findings + vorgeschlagene
Akzeptanzkriterien im Paket** → Owner reviewt/bestätigt → Umsetzung (Felder/Spec/
Hilfe fixen + Tests neu) → E2E grün → `## Result` + `done`.

## Reihenfolge

Pilot **ui-divider** (Base-Field-Referenzknoten, minimal) zum Kalibrieren von
Template + Aufwand; danach Reihenfolge festlegen (voraussichtlich nach Familie:
display → input → feedback → navigation → structure → state → behavior).

> Goal: jeder `ui-*`-Knoten hat ein bestätigtes Feld-Set, eine detail-vollständige
> Spec, eine gute Inline-Hilfe, beobachtbare Akzeptanzkriterien und eine frische,
> outcome-basierte Testabdeckung.

# Testkatalog: ui-accordion

> Format gemäß `.ai/agents/node-testing.md`. Erweitert mit P169 (ADR 0018 —
> Kinder definieren Sektionen) und dort zu befüllen. Bestehende E2E:
> `tests/e2e/nodes/composite/ui-accordion.spec.ts`.

## Geplante Testziele (P169, ADR 0018)

- Neues `ui-accordion-section`-Kind (label/icon/order + Default-Slot); eindeutige
  id/Namen je `ui-accordion` (Validierung).
- `ui-accordion` leitet einen Slot pro Sektions-Kind ab; Sektions-Config entfällt.
- Mount-Tree zeigt `ui-accordion` als Drop-Ziel + jede Sektion als Container.
- Open/Closed-Zustand per Kind-id; Migration alter Sektions-Config.
- End-to-End: zwei `ui-accordion-section`-Kinder → zwei aufklappbare Sektionen.

## Dynamisch (P170)

- `ui-repeat` (Template = `ui-accordion-section`, `label = item.<feld>`) → N
  Sektionen aus Daten; keyed, stabil über Datenänderungen.

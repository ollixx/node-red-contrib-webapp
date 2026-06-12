---
id: P169
node: ui-accordion
epic: nodes/ui-accordion
title: "ui-accordion: Kinder definieren Sektionen — neues ui-accordion-section-Kind (Schema+Renderer+Editor), sections-Config entfällt; Browser-Beweis"
findings:
  - "Owner-Entscheidung (2026-06-12): Modell 1a (Kinder definieren die Sektionen) gilt analog für ui-accordion."
acceptance:
  - "Neues Knoten-Schema ui-accordion-section: Container-Kind mit label/icon/order + Default-Slot; eindeutige id/Namen je ui-accordion (Validierung)."
  - "ui-accordion: Config-/JSON-Sektionsfeld entfernt; akzeptiert ui-accordion-section-Kinder, ein Slot pro Kind; Open/Closed-Zustand per Kind-id."
  - "Mount-Tree zeigt ui-accordion als Drop-Ziel + jede Sektion als Container mit Slot."
  - "Migration: bestehende Sektions-Config → ui-accordion-section-Kinder (id/label erhalten), bestehende Mounts re-pointed."
  - "End-to-End (browser): ein ui-accordion mit zwei ui-accordion-section-Kindern rendert zwei aufklappbare Sektionen mit ihrem jeweiligen Inhalt."
verify: browser
spec: docs/nodes/navigation/ui-accordion.md
tests: tests/e2e/nodes/view/ui-accordion.tests.md
dependencies: [P168]
status: pending
---
# P169 — ui-accordion: Kinder definieren Sektionen (Spiegel zu ui-tabs)

> Dritte Schicht von ADR 0018 — spiegelt das ui-tabs-Modell (P167/P168) auf
> `ui-accordion`. Setzt darauf auf, um das etablierte Muster (Schema → Renderer →
> Editor → Validierung → Migration) wiederzuverwenden.

## Umfang

1. **Neuer Knoten `ui-accordion-section`** (Schema + Registrierung): Container-
   Kind mit `label`/`icon`/`order` + Default-Slot.
2. **`ui-accordion`-Umbau:** Sektions-Config **raus**; ein Slot pro Kind; Open/
   Closed-Zustand per Kind-id (analog `activeTab`).
3. **Renderer/Editor/Mount-Tree/Validierung/Migration** analog P167/P168.
4. **Spec/Doku:** `docs/nodes/navigation/ui-accordion.md` umschreiben; neues
   `docs/nodes/navigation/ui-accordion-section.md`; Testkatalog befüllen.

## acceptance / verify

- `verify: browser` — wie P168; E2E im Haupt-Checkout durch den Orchestrator.

## Risiken / Hinweise

- Soviel wie möglich aus dem ui-tabs-Muster wiederverwenden (gemeinsame Editor-
  Helfer in `resources/lib/editor-common.js` — **einzige kanonische Kopie**).
- Dynamische Sektionen (ui-repeat → ui-accordion-section) sind P170.

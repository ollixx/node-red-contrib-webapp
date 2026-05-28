# `ui-button`

## Zusammenfassung

Rendert einen klickbaren Button, der eine Action referenziert.

Aktuelles MVP-Verhalten:
- Rendert einen Link bzw. Trigger auf `/webapp/:appId/action/:actionId`.
- Emittiert standardisierte `msg.ui`-Ereignisse.
- Kann einen deaktivierten Zustand aus einem Binding beziehen.

## Abhängigkeiten

**Parent-Knoten:**
- Mount-Ziel (Route-, Dialog- oder Layout-Slot)

**Gemeinsam genutzte Services und Komponenten:**
- Referenziert `ui-action` über `action`
- Binding-Modell: `disabled`-Zustand über State-Binding

## Editor

**Pflichtfelder:**
- `id`
- `mount`
- `label`: aktuell ein einfacher String, kein Binding-Ausdruck
- `action`: Action-ID

**Optionale Felder:**
- `disabled`
- `order`

## Input

## Output

Emittiert standardisierte `msg.ui`-Ereignisse bei Klick.

## Besonderheiten

- Der Knoten kennt nur die Action-ID, aber keine deklarative Aussage über Variant, Intent, Busy-Zustand oder Bestätigungslogik.
- Für produktive Nutzung braucht es wahrscheinlich ein reichhaltigeres Action- oder Command-Modell.

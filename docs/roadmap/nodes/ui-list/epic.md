# Epic: ui-list

Work packages for the `ui-list` node. `ui-list` wurde in P16d (Sammel-Erweiterung
Display) angelegt und seither nur querschnittlich berührt — es hängt hinter seiner
Spec. Dieses Epic gleicht es an.

## References
- Spec: [docs/nodes/display/ui-list.md](../../../nodes/display/ui-list.md)
- ADR: [0015 — Basis-Felder](../../../adr/0015-common-base-fields-and-editor-structure.md),
  [0012 — Binding-Ubiquität](../../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md)

> Goal: `items` als kanonischer Wert-typedInput mit **klarem Item-Schema**
> (`{id?,label,value?,icon?}`, kein implizites Mapping), Basis-Felder, Events im
> Editor — den Datenmodell-Schwachpunkt beseitigen.

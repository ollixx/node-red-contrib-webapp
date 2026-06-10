# Testkatalog: ui-action

> Format gemäß `.ai/agents/node-testing.md`. Dieser Katalog wurde mit der
> Planung von P118/P119 (ADR 0011, Navigate-Zielquellen) angelegt und wird von
> diesen Phasen befüllt; die bestehenden Specs (`ui-action.spec.ts`,
> `ui-action-verbs.spec.ts`, `p66-navigation.spec.ts`, `p59-…`, `p60-…`)
> sind noch nicht katalogisiert.

## Geplante Testziele (P118/P119 — werden bei Umsetzung konkretisiert)

- Navigate Modus `route`: Referenz-Ziel + typisierte Parameter → Browser-URL.
- Adressierungs-Vorrang: verdrahtete Route kapert keine adressierte Navigation.
- Navigate Modus `wire` mit Verzweigung: Ziel = empfangende Route, beide Zweige.
- Navigate Modus `url` (jsonata-gebaute URL); params-Liste im url-Modus inaktiv.
- Editor: Modus-Umschalter, Wire-Scan-Badges (1/n/0 Treffer), Mapping-Tabelle,
  Validierung fehlender Platzhalter-Werte, Migration von Legacy-Configs.

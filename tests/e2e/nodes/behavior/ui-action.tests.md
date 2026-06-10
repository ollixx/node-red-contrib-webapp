# Testkatalog: ui-action

> Format gemäß `.ai/agents/node-testing.md`. Dieser Katalog wurde mit der
> Planung von P118/P119 (ADR 0011, Navigate-Zielquellen) angelegt und wird von
> diesen Phasen befüllt; die bestehenden Specs (`ui-action.spec.ts`,
> `ui-action-verbs.spec.ts`, `p66-navigation.spec.ts`, `p59-…`, `p60-…`)
> sind noch nicht katalogisiert.

## P118 — Navigate-Zielquelle: Schema + Laufzeit (ADR 0011)

Browser-E2E: `p118-navigate-target-modes.spec.ts`.

| Ziel | Spec / Test | Beobachtung |
|---|---|---|
| Modus `route`: Referenz-Ziel + typisierte `params` (msg) | `p118-…spec.ts` → „route mode" | Inject `{id:42}` → Browser-URL `/customers/42`, Zielroute-Inhalt sichtbar. |
| Adressierungs-Vorrang | `p118-…spec.ts` → „precedence" | Action adressiert `/customers/:id`, aber an `/other` verdrahtet → landet auf `/customers/42`, NICHT `/other`. |
| Modus `wire` mit Verzweigung | `p118-…spec.ts` → „wire mode with branching" | switch → zwei `wire`-Actions an zwei Routen; je nach Zweig landet der Client auf der empfangenden Route (beide Zweige belegt). |
| Modus `url` (jsonata-gebaute URL) | `p118-…spec.ts` → „url mode" | `toType: jsonata` baut `/customers/42` aus der msg → Browser navigiert. |

Unit-Belege (nicht-Browser):
- Doppel-Konfig-Ausschluss, typisierte param-`valueType`s, Modus-Exklusivität:
  `packages/schema/test/schema.test.ts` (Block „P118 (ADR 0011)…").
- Migration (Legacy `to`→url, kein `to`→wire, params-Objekt→str-Liste),
  typisierte param-Auswertung (str/msg/jsonata/flow/global/env), routeId→path,
  Adressierungs-Vorrang in `resolveNavigateLocation`:
  `packages/runtime/test/p118-navigate-target-modes.test.ts`.

## Geplante Testziele (P119 — Editor-UX)

- Editor: Modus-Umschalter, Wire-Scan-Badges (1/n/0 Treffer), Mapping-Tabelle,
  Validierung fehlender Platzhalter-Werte, Migration von Legacy-Configs.

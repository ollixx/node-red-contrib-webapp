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

## P119 — Navigate-Editor: Modus-UI, Wire-Scan, Mapping-Tabelle (ADR 0011)

Browser-E2E: `tests/e2e/nodes/editor/navigate-target-modes.spec.ts`.

| Ziel | Spec / Test | Beobachtung |
|---|---|---|
| Transitiver Wire-Scan (1 Treffer) | „scanWiredNavigationTargets finds a transitively-wired route…" | Action → function → `ui-route` `/customers/:id`: Scan liefert genau 1 Ziel, Platzhalter `["id"]`. |
| Wire-Scan-Menge bei Verzweigung | „returns a SET for a branching flow…" | Action → switch → zwei Routen: Scan liefert `["/alpha/:a", "/beta/:b"]`. |
| Initialer Modus = Wire (Scan ≥1) | „opens in WIRE mode with the route path" | Frische Action öffnet im `wire`-Modus; Panel zeigt „via Wire → /customers/:id", `:id`-Zeile, blaue Panel-Klasse `webapp-path-panel--wire`. |
| Verzweigung = Badge n + Laufzeit-Hinweis, KEIN Fehler | „branching wire opens with the multi-target badge…" | Badge „2 mögliche Ziele", Laufzeit-Hinweis sichtbar, `node.valid === true`. |
| Modus-Wechsel auf Route bleibt nach Speichern | „switching to ROUTE mode shows the transport info, persists across reopen" | Lila Panel `--ref`, Info „dient als Transport"; nach Deploy+Reopen `targetMode === "route"` (kein Zurückspringen trotz Wire). |
| Route-Modus: Pflicht-Platzhalter | „route mode: empty :placeholder value makes the node invalid…" | Leerer `:id`-Wert → Knoten ungültig (Deploy blockiert); gefüllt → gültig. |
| Route-Wechsel baut Tabelle neu | „route mode: changing the route rebuilds the table…" | `/customers/:id` → `/orders/:id/:tab`: Zeilen `[:id, :tab]`, `:id`-Wert bleibt erhalten. |
| URL-Modus: keine Parameter-Sektion + sanfte Warnung | „url mode shows the `to` typedInput and NO parameter section…" | `to`-Zeile sichtbar, 0 Mapping-Zeilen, `:platzhalter`-Warnung sichtbar, `node.valid === true`. |
| ui-navigation angeglichen | (in `navigate-target-modes.spec.ts`) „ui-navigation shows the same three-mode switcher" | Drei Segmente sichtbar; Legacy-`to`-Config öffnet im `url`-Modus. |
| Legacy `to`-Round-Trip im URL-Modus | `behavior-state.spec.ts` → „ui-action — actionType selector…" | Segment URL → `to` = `/customers/:id` → Speichern/Reopen behält `targetMode==="url"` + `to`. |

Unit-Belege (nicht-Browser):
- Route-Modus-`ui-navigation` ohne `to` assembliert + bleibt aus der `to`-Liste:
  `packages/runtime/test/node-set-runtime.test.ts` („P119: a route-mode
  ui-navigation (no `to`)…").
- Zentrale Editor-Helfer (`parseRoutePlaceholders`, `scanWiredNavigationTargets`)
  sind browser-only und werden über `page.evaluate` in der Editor-Spec geprüft.

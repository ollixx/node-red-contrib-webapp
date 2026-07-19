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
| Legacy `to`-Round-Trip im URL-Modus | `behavior-state.spec.ts` → „ui-action — actionType selector…" | Segment URL → `to` = `/customers/:id` → Speichern/Reopen behält `targetMode==="url"` + `to`. |

> P243 (ADR 0040): `ui-navigation` wurde stillgelegt — Navigation ist allein ein
> `ui-action` navigate. Der frühere „ui-navigation angeglichen"-Fall entfällt.

Unit-Belege (nicht-Browser):
- Route-Modus-`ui-action` navigate ohne `to` assembliert + bleibt aus der `to`-Liste:
  `packages/runtime/test/node-set-runtime.test.ts` („P243: a route-mode
  ui-action navigate (no `to`)…").
- Zentrale Editor-Helfer (`parseRoutePlaceholders`, `scanWiredNavigationTargets`)
  sind browser-only und werden über `page.evaluate` in der Editor-Spec geprüft.

## P226 — Interaktions-Verben schreiben den dynamic-state-Wert (ADR 0037)

Browser-E2E: `p226-verbs-write-dynamic-state.spec.ts` (+ die bestehenden
Sicht-/Enabled-Verben in `ui-action-verbs.spec.ts`, jetzt wertbasiert).

| Ziel | Spec / Test | Beobachtung |
|---|---|---|
| show/hide auf UNGEBUNDENER Alert = per-Client `visible`-Wert | `p226-…spec.ts` → „hide → unbound alert disappears; show → it reappears" | hide → Alert-Element verschwindet aus dem Snapshot (detached), show → Element wieder da. Kein `.webapp-hidden`-Overlay. |
| hide auf STORE-gebundener Alert schreibt DURCH den Store | `p226-…spec.ts` → „hide on a store-bound alert changes the STORE value…" | Ein an dieselbe Store-Slice gebundener ui-text kippt „true"→„false"; der Alert verschwindet gleichzeitig; show setzt beides zurück. |
| show/hide (Element-Präsenz), wertbasiert | `ui-action-verbs.spec.ts` → „hide → target element disappears; show → it reappears" | hide → `visible=false` → Element aus dem Snapshot entfernt; show → wieder sichtbar. |
| enable/disable schreiben `disabled` | `ui-action-verbs.spec.ts` → „disable → target control gets [disabled]; enable → it loses it" | disable → `disabled=true` → `[disabled]` am `sl-button`; enable → Attribut weg (der interaktive Control erhält einen `disabled`-Slot). |
| Hidden-Wert überlebt eine ui-store-Snapshot-Neuberechnung | `ui-action-verbs.spec.ts` → „a hide stays applied after a later ui-store snapshot push…" | Nach hide bleibt das Element auch nach einem ui-store-Update ausgeblendet — die Sichtbarkeit ist der per-Client-Wert, kein neu zu stempelndes Overlay. |

Unit-Belege (nicht-Browser):
- `show`/`hide`→`visible`, `enable`/`disable`→`disabled` über `setDynamicStateField`
  (ungebunden → per-Client-Slot; gebunden → Store-Durchschreiben, scope-korrekt);
  ui-alert als gültiges Verb-Ziel; per-Client-Scoping; msg-Durchreichung:
  `packages/runtime/test/p226-interaction-verbs-write-state.test.ts`.
- Sicht-/Enabled-Verben schreiben den Wert statt eines Command-Frames (kein
  `command`-Push), übrige Verben (select/focus/reset) weiter als Command:
  `packages/runtime/test/p82-…`, `p83-…`, `p85-navigation-nodes-behaviour.test.ts`.

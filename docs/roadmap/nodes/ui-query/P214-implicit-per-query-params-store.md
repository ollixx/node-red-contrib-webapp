---
id: P214
node: ui-query
title: "ui-query: impliziter per-client Params-Store pro Query (kein extra Knoten), adressierbar wie jeder Store — via ui-store-action/ui-store-read/store-Binding; explizites params-Feld bleibt optionaler Override"
epic: nodes/ui-query
findings:
  - "Owner (2026-07-13): 'Im Moment speichert query alle parameter in einem store, den man auswählt. Eine Variante das über wires zu machen gibt es nicht. Also warum legen wir für ein ui-query nicht automatisch einen gleichlautenden store für params mit an? Das Interface von ui-store könnte man trotzdem anbieten und zwar über die ui-store actions.'"
  - "Owner-Entscheidung: impliziter Slice (kein Auto-Knoten). Kontext + Vertrag: ADR 0030."
  - "Owner (2026-07-13): 'warum sendet ui-query die parameter nicht beim Read im out port?' — Befund: heute hängt NUR fireQueryRefresh (P161, ausgelöst durch Params-STORE-Änderung) die Params ans Out-Port-Envelope (webapp.js:4674). Ein plain refresh (msg.ui.query={queryPath,refresh:true}, onEnter, ui-query-action refresh) geht durch queryInputHandler als unveränderter Pass-Through (send(msg)) → OHNE Params. Die Query liest ihren Params-Store beim Refresh nicht und hängt ihn nicht an."
acceptance:
  - "Params bei JEDEM Out-Port-Refresh: löst irgendetwas einen Refresh-Emit der Query aus (Params-Store-Änderung, onEnter, plain refresh-Message, ui-query-action refresh), hängt die Query die AKTUELLEN Params (aus ihrem Params-Store — implizit ODER explizit — für diesen `clientId`) an `msg.ui.query.params`, sodass der wired Fetch immer paging/sort/search kennt. Gilt auch für den EXPLIZITEN params-Store (heutige Lücke). E2E: ein plain refresh (ohne vorherige Params-Store-Änderung) trägt am Out-Port die aktuellen `params`."
  - "Impliziter Params-Store: jede ui-query hält ihre Params in einem per-client-Slice unter `ui.queries.<queryPath>.params` (kein neuer Knoten). Scope per-client (`clientId`)."
  - "Adressierung: ein `store`-Referenzwert, der auf eine `ui-query`-Knoten-ID zeigt, löst in `ui-store-action`, `ui-store-read` und `store`-Value-Bindings auf den Params-Slice DIESER Query auf (id = Query-Node-ID; Sub-Pfad relativ zu `params`). Unit/E2E deckt: store(<queryId>).page schreibt/liest `ui.queries.<queryPath>.params.page`."
  - "Store-Picker: das `stores`-Preset (Node-Picker in ui-store-action/ui-store-read/store-typedInput) listet die impliziten Query-Params-Ziele NEBEN echten ui-store-Knoten, sichtbar unterscheidbar (Label z. B. 'Query X · Params'). Auswahl speichert die Query-ID als Referenz."
  - "Reaktiver Refresh unverändert: eine Änderung am impliziten Params-Slice (z. B. via ui-store-action set page=2 auf die Query) feuert den Out-Port-Refresh der Query (P161-Mechanismus), genau wie ein expliziter params-Store heute."
  - "Back-compat/Override: das explizite `params`-Feld bleibt optional — gesetzt ⇒ externer ui-store (geteilt) wie bisher; LEER ⇒ impliziter per-Query-Store (neuer Default). Bestehende Flows mit explizitem params brechen nicht."
  - "Browser (E2E, gemessen): eine paged ui-list an `query:entities` + ein Button → ui-store-action(store=<queryId>, set page) → die Query re-fetcht mit den neuen Params (der Retrieval-Flow trägt `params.page`), die Liste aktualisiert; KEIN manuell angelegter/verdrahteter params-Store nötig."
  - "Doku docs/nodes/state/ui-query.md: impliziter Params-Store, Adressierung über Query-ID, Picker-Listung, explizites params als Override, per-client. Node-Test-Katalog aktualisiert."
verify: browser
spec: docs/nodes/state/ui-query.md
tests: tests/e2e/nodes/state/ui-query.tests.md
dependencies: [P209, P211]
status: pending
---
# P214 — ui-query: impliziter per-Query Params-Store

> Entscheidung: [ADR 0030](../../../adr/0030-ui-query-implicit-per-query-params-store.md).

## Kern

Jede `ui-query` besitzt implizit ihren Params-Store (`ui.queries.<queryPath>.params`,
per-client) — **kein extra Knoten**. Adressierbar wie jeder Store: ein `store`-Bezug
auf die **Query-ID** löst auf diesen Params-Slice auf. So bedienst du Params über
`ui-store-action` (schreiben), `ui-store-read` (lesen) und `store`-Bindings — ohne
einen Params-Store manuell anzulegen/zu verdrahten.

```
[Button] → [ui-store-action • store=<queryId>, set path=page value=2] → Query re-fetcht
```

Explizites `params`-Feld bleibt Override (externer, geteilter Store); leer ⇒ implizit.

## acceptance / verify

- `verify: browser` — Orchestrator im Haupt-Checkout ([[orchestrator-must-verify-e2e-in-main-checkout]]):
  Params via ui-store-action auf die Query setzen → Refresh feuert → Liste aktualisiert;
  gemessen am Retrieval + Render, ohne manuellen params-Store.

## Risiken / Hinweise

- **Bulk der Arbeit** = Picker-Listung + Auflösung (store-Bezug auf ui-query → Params-Slice)
  in ui-store-action/ui-store-read/store-Binding, konsistent.
- Kollisionsfrei zu ADR 0013 (id + Sub-Pfad): die Query-ID ist der „Store", `params.*`
  der Sub-Pfad.
- Nicht mit `ui-query-action` (Trigger/replace) verwechseln — das hier ist der Params-Speicher.

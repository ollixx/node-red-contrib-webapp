# Testkatalog: ui-container

> Format gemäß `.ai/agents/node-testing.md`. Angelegt im Konformitäts-Pass P255
> (Audit 2026-07-17). `ui-container` ist ein Layout-Container: er montiert sich in
> einen Parent-Slot und stellt selbst ein Kind-Layout (Preset) bereit. Er trägt
> eine echte Flächen-Variante (`card`/`panel`/`section`/`transparent`/`span`) und
> ist die einzige Struktur-Ebene unter Route/Dialog, die
> **Sichtbarkeits-Events** (`onShow`/`onHide`) emittieren kann.

Browser-E2E: `ui-container.spec.ts`.

## P45 — Basis: Wrapper, Kind-Mount, Layout-Preset

| Ziel | Spec / Test | Beobachtung |
|---|---|---|
| `card`-Container rendert `sl-card`-Wrapper | „renders sl-card wrapper" | Nach Render ist `sl-card` sichtbar. |
| Kind-View mountet in den Container | „child ui-text mounted inside container → text visible in card" | `ui-text` mit `mount: container:<id>/content` erscheint als Text **innerhalb** der `sl-card`. |
| Mehrere Kinder in Reihenfolge | „multiple children render inside the container" | Zwei `ui-text` erscheinen beide in der `sl-card`. |
| Layout-Preset `grid` wird angewandt | „layout preset 'grid' → container renders the grid layout wrapper" | `sl-card .webapp-layout--grid` existiert genau 1× (ein `vertical`-Container erzeugte `--vertical`). |

## P198 — Variant: vier distinkte Flächen-Rollen

Jede Variante wählt Element **und** Styling; alle vier rendern messbar unterschiedlich.

| Ziel | Spec / Test | Beobachtung |
|---|---|---|
| `card` → `sl-card` (Shoelace-Chrome) | „card variant renders as sl-card element" | `sl-card.webapp-container--card` sichtbar; **kein** `div.webapp-container--card`. |
| `panel` → `div` mit Rand, ohne Elevation | „panel variant renders as plain div (no sl-card)" | `div.webapp-container--panel` sichtbar, `border-top-width: 1px`; **kein** `sl-card`. |
| `section` → `div`, nur Abstand (kein Rand) | „section variant renders as plain div with spacing only (no border)" | `div.webapp-container--section`, `border-top-width: 0px`; **kein** `sl-card`. |
| `transparent` → `div`, kein Chrome | „transparent variant renders as plain div with no box chrome" | `div.webapp-container--transparent`: `border 0px`, `padding-top 0px`, Hintergrund transparent; **kein** `sl-card`. |

## P199 — Variant `span`: Inline-Textkomposition

| Ziel | Spec / Test | Beobachtung |
|---|---|---|
| `span` → `<span>`-Wrapper (kein Card/Div) | „span variant renders a `<span>` wrapper (not sl-card, not div)" | `span.webapp-container--span` vorhanden, enthält den Text; **kein** `sl-card`/`div` mit der Klasse. |
| `span` mit 3 Kindern → inline (nicht gestapelt) | „span container with 3 ui-text children renders them inline (not stacked)" | Drei `.webapp-text` auf **einer** Zeile (top-Delta < 4 px). |

## P255 — Sichtbarkeits-Events onShow/onHide

Ein ausgeblendeter Container wird server-seitig **komplett aus dem Render-Baum
gegated** (`toRenderedComponent` liefert `undefined` bei `visible=false`) — es gibt
also keinen Server-Hook, der das Ausblenden beobachtet. Stattdessen erkennt der
**Client** das Erscheinen/Verschwinden des Containers über die
Snapshot-Morphs und POSTet das passende `/event`. Der Serializer stempelt dazu
`data-webapp-lifecycle="onShow onHide"` auf den Container-Wrapper (dieselbe
Element wie `data-webapp-node`); der Client diffed die Präsenz dieser Elemente
nach jedem `applySnapshot` (Initial-Hydrate **und** jeder SSE-Push) und feuert
onShow (neu präsent) / onHide (neu abwesend). Der Server routet das Event über
`events.indexOf(event)` auf den passenden Output-Port und baut das
Standard-`msg.ui`-Envelope (`event`, `sourceId` = Container-Node-Id, `appId`,
`clientId`). Getriggert wird über ein **store-gebundenes `visible`**, live per
Inject → SSE umgeschaltet.

**Gemessen wird das reale Client→Server POST /event** (`webapp.interceptNextEvent`),
d. h. das Envelope, das die Flow-Seite empfängt — nicht Tags/Klassen.

| Ziel | Spec / Test | Beobachtung |
|---|---|---|
| Lifecycle-Marker im Markup | „the container wrapper is stamped with data-webapp-lifecycle for the enabled events" | `[data-webapp-node="…"][data-webapp-lifecycle]` existiert 1× und trägt `data-webapp-lifecycle="onShow onHide"`. |
| `visible` false→true feuert onShow | „visible false→true fires onShow with the container's sourceId (POST /event)" | Store startet `false` → Container gegated (count 0, **kein** onShow beim Laden). Inject `true` → Container erscheint; das nächste POST /event trägt `event: "onShow"`, `sourceId: "ctnShow1"`. |
| `visible` true→false feuert onHide | „visible true→false fires onHide with the container's sourceId (POST /event)" | Nur `onHide` aktiv (kein onShow-Rauschen beim Laden). Store startet `true` (Container präsent). Inject `false` → Container verschwindet; POST /event trägt `event: "onHide"`, `sourceId: "ctnHide1"`. |
| Kein Event ohne aktivierte Events | „a container with NO events enabled emits no /event on a show toggle" | Ohne `events` fehlt der Lifecycle-Marker (`[data-webapp-lifecycle]` count 0); ein Show-Toggle blendet den Container ein, aber es fällt **kein** POST /event an. |

## Unit-/Nicht-Browser-Belege

- Schema: `events: z.array(z.enum(["onShow","onHide"])).optional()` +
  `variant`-Enum (`CONTAINER_VARIANTS`): `packages/schema/src/node-definitions.ts`.
- `mapConfig` reicht `events`/`variant`/Layout durch; `toComponentDefinitions`
  wiret das Base-Feld `visible` in `visibleIf` (Store/State-gebunden echt) und
  legt die aktivierten Lifecycle-Events als `props.lifecycleEvents` ab (freies
  Record, kein Schema-Eingriff): `nodes/webapp.js`.
- `wrapRenderedComponentHtml` stempelt `data-webapp-lifecycle` aus
  `props.lifecycleEvents` auf den Wrapper: `resources/lib/webapp-serializer.js`.
- `detectLifecycleTransitions` (Präsenz-Diff nach jedem `applySnapshot`) + POST
  `/event`: `resources/lib/webapp-client.js`. Server-Envelope + Port-Routing:
  `dispatchClientEvent` in `nodes/webapp.js`.

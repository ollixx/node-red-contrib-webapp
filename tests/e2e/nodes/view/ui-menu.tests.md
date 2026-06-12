# Testkatalog: ui-menu

> Format gemäß `.ai/agents/node-testing.md`. Angelegt mit P157 (Field-Typing Welle 2).

## P157 — items (strukturelle Array-Quelle) + activeRoute (read-only) (ADR 0012)

> `items` ist die kanonische STRUKTURELLE Array-Quelle (Store/Query/Reactive/
> JSON-Literal) — das Menü rendert seine Einträge selbst (kein Slot-pro-Item, KEIN
> Repeats-Fall). Auflösung über denselben strukturellen Pfad wie ui-select
> `options` (P133), damit ein legitimer Array-Slice nicht vom Display-Scalar-Guard
> abgelehnt wird. `activeRoute` ist ein read-only Wert-typedInput, der den aktiven
> Eintrag hervorhebt. Legacy `itemsPath` / `activeRoutePath` migrieren zu
> `{kind:"state", path}`.

### E2E (`tests/e2e/nodes/view/ui-menu.spec.ts`)

| Test | Ziel |
|---|---|
| json-literal items array renders the sl-menu entries | JSON-Literal-Array rendert die Menü-Einträge |
| store-array items render the menu entries reactively | Store-Array wird strukturell aufgelöst und gerendert |
| activeRoute from a store marks the matching item active | activeRoute-Binding hebt das passende Item hervor (aria-current) |
| legacy itemsPath migrates to a state binding and renders from the store | Alt-`itemsPath` lädt verlustfrei als state-Binding |
| click on a route item POSTs /event { event:'navigate', params:{ path } } | P75-Navigate-Event bleibt funktional |
| external href item carries no navigate hook | Externe href-Items lösen keinen navigate-Event aus |

### Editor-Panel (`tests/e2e/nodes/editor/navigation-nodes.spec.ts`)

| Test | Ziel |
|---|---|
| menu: opens without crash and has expected fields | Panel öffnet ohne Crash, name+mount vorhanden |
| menu: items + activeRoute typedInputs present; legacy paths migrate | `itemsBinding`/`activeRouteBinding` typedInputs vorhanden; Pfad-Migration |

### Unit

| Test | Ziel |
|---|---|
| runtime `p157-...` mapConfig: json-literal unwrap, store/query pass-through, bare JSON parse, itemsPath/activeRoutePath migration | webapp.js-Mapper-Vertrag |
| runtime `p157-...` render: store/literal items rendern, activeRoute markiert aktiv, kein activeRoute → keine Marker, legacy itemsPath rendert | End-to-End-Auflösung (renderAppPage) |
| editor `p157-...` emitNodeDefinition: items-Auflösung + activeRoute-Migration durch das Schema | Editor-Mapper-Vertrag |

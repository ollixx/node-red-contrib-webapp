# ui-dialog — test catalogue

Location: `tests/e2e/nodes/structure/ui-dialog.spec.ts`

## E2E — server-render outcomes (`ui-dialog.spec.ts`)

Outcome-based, measured against the server-rendered DOM. Pattern: the server
opens a dialog when `?dialog=<id>` is present in the URL.

| Test | Ziel |
|---|---|
| dialog not visible on initial load | Ohne `?dialog`-Param ist kein `.webapp-dialog` im DOM. |
| `?dialog=<id>` → dialog visible | Mit `?dialog=<id>` rendert der Server das Overlay (`.webapp-dialog` sichtbar). |
| navigating without `?dialog` → absent | Nach Wegnavigieren des Params ist der Dialog wieder weg. |
| child renders inside `.webapp-dialog` | Ein gemounteter View-Knoten erscheint im Dialog-Overlay. |
| native `<sl-dialog>` + `label` | Dialog rendert als `sl-dialog` mit `title` als `label`; `closable`(default) → kein `no-header`. |
| `closable:false` → `no-header` | Kein Header (X/Titel) bei `closable:false`. |
| **`route` route-scoping (P245)** | Ein Dialog mit `route=Route A` ist unter `?dialog=<id>` **bei aktiver Route A vorhanden** (`sl-dialog.webapp-dialog` sichtbar + Kind-Inhalt), unter der **anderen Route B** (`/other?dialog=<id>`) **nicht vorhanden** (`.webapp-dialog` count 0). Belegt den Renderer-Route-Filter (`dialog.routeId === aktive Route-Id` im kompilierten Modell; Konfig-Feld `route`, P259) am gemessenen DOM. |
| **`requiresGroup` Authz-Guard (P262)** | Siehe `tests/e2e/auth/guards.spec.ts` + `tests/e2e/auth/guards.tests.md`: ein geschützter Dialog fehlt im Snapshot-JSON **vollständig** (auch via `?dialog=` erzwungen), erscheint im Browser nicht (`.webapp-dialog` count 0, kein Inhalt im HTML), und `/event` an seine Kinder wird mit strukturiertem 403 abgelehnt — jeweils gemessen mit/ohne Gruppe (Header-Fake-Muster P261). |

## E2E — Editor open→save round-trip (`tests/e2e/nodes/structure/ui-dialog.roundtrip.spec.ts`)

Standard: `.ai/agents/node-testing.md` „Editor open→save round-trip", [ADR 0031](../../../../docs/adr/0031-editor-open-save-round-trip-test-standard.md).
`assertEditorRoundTrip`-Aufruf für das `route`-Parent-Route-Referenz-Picker-Feld (P217; P259: kanonischer bare Name, Legacy-`routeId`-Fixture beweist Back-Compat + Migrate-on-Save).

| Test | Ziel |
|---|---|
| `route` open→Done Round-Trip | Der Route-Reference-Picker (hidden `#node-input-route`, `installReferenceSelectors({ route: true })`) ist beim Öffnen aus dem migrierten Legacy-`routeId` **geseedet** (nicht leer), **überlebt** Done unverändert (`RED.nodes.node().route` wird `dlgRouteA`, kein Clobber zu `""`), und ein **Wertwechsel** auf `dlgRouteB` persistiert und re-seedet beim Wiederöffnen. Entfernen des `self.route`-Seeds in `installReferenceSelectors` macht den Test rot. |

# ui-dialog — test catalogue

Location: `tests/e2e/nodes/structure/ui-dialog.spec.ts`

## E2E — Editor open→save round-trip (`tests/e2e/nodes/structure/ui-dialog.roundtrip.spec.ts`)

Standard: `.ai/agents/node-testing.md` „Editor open→save round-trip", [ADR 0031](../../../../docs/adr/0031-editor-open-save-round-trip-test-standard.md).
`assertEditorRoundTrip`-Aufruf für das `routeId`-Parent-Route-Referenz-Picker-Feld (P217).

| Test | Ziel |
|---|---|
| `routeId` open→Done Round-Trip | Der Route-Reference-Picker (hidden `#node-input-routeId`, `installReferenceSelectors({ route: true })`) ist beim Öffnen aus `routeId` **geseedet** (nicht leer), **überlebt** Done unverändert (`RED.nodes.node().routeId` bleibt `dlgRouteA`, kein Clobber zu `""`), und ein **Wertwechsel** auf `dlgRouteB` persistiert und re-seedet beim Wiederöffnen. Entfernen des `self.routeId`-Seeds in `installReferenceSelectors` macht den Test rot. |

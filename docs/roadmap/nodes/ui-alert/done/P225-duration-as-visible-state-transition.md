---
id: P225
node: ui-alert
title: "ui-alert: Duration als deklarativer visible=false-Übergang (schreibt den EINEN Sichtbarkeits-Wert) statt Client-Einweg-Close"
epic: nodes/ui-alert
status: done
dependencies: [P224]
verify: browser
spec: docs/nodes/feedback/ui-alert.md
tests: tests/e2e/nodes/view/ui-alert.tests.md
---
# P225 — Duration als visible-Zustandsübergang

> Rationale: [ADR 0037](../../../../adr/0037-unified-dynamic-state-fields-one-value-many-writers.md).
> Löst den in [ADR 0032](../../../../adr/0032-store-subpath-missing-key-is-transient-not-an-error.md)/
> ui-alert-Doku vermerkten Duration↔visible-Redesign auf.

## findings

Owner (2026-07-14): „Duration ändert das genauso intern." — Duration ist ein
**Schreiber** auf den einen Sichtbarkeits-Wert (ADR 0037), kein Sonderweg.

Heute (getrackt): Duration ist ein **client-seitiger Einweg-Close** — der Serializer
rendert die Alert immer `open`, Shoelace schließt sie einmalig, und ein
`autoDismissed`-Flag verhindert das Wiedereinblenden. Entkoppelt von `visible`, nicht
re-triggerbar.

## acceptance

- **Duration setzt `visible=false` über die Schreib-API (P224).** Nach Ablauf der
  Duration wird der EINE Sichtbarkeits-Wert der Alert auf `false` gesetzt (gebunden →
  in den Store durch; ungebunden → interner per-Client-Slot) — ein echter
  Zustandsübergang, kein DOM-Hack.
- **`autoDismissed`-Hack entfällt.** Der client-seitige Sonder-Merker + das „immer
  open"-Emittieren werden entfernt; die Alert ist ausgeblendet, weil ihr
  Sichtbarkeits-Wert `false` ist — konsistent über Snapshots.
- **Re-triggerbar.** Den Wert wieder auf `true` schreiben (msg/Verb/Store) zeigt die
  Alert erneut — ohne Reload.
- **Countdown bleibt.** Der Fortschrittsbalken (P100) läuft weiter über die Duration;
  nur das Ausblenden ist jetzt ein Wert-Übergang.
- **Browser-Beweis.** Alert mit `duration=3000` verschwindet nach ~3s (Wert=false);
  ein anschließendes `visible=true` (msg/Store) zeigt sie wieder.

## verify

`browser` — Duration-Ablauf blendet aus (Wert-Übergang), erneutes Setzen zeigt
wieder; kein `autoDismissed`-Pfad mehr.

## spec

`docs/nodes/feedback/ui-alert.md` — Duration als visible-Schreiber dokumentieren
(die „bekannte offene Frage" auflösen).

## tests

`tests/e2e/nodes/view/ui-alert.tests.md` — Auto-Hide via Wert-Übergang + Re-Show.

## notes for the implementer

- Nutzt `setDynamicStateField` aus P224. Entfernt den client-seitigen
  `autoDismissed`-Pfad in `resources/lib/webapp-client.js` und das „immer open"-
  Verhalten im Serializer/Renderer für Duration.

## Result

**Delivered.** `ui-alert`-Duration ist jetzt ein deklarativer `visible=false`-Zustandsübergang über die P224-Schreib-API (ADR 0037) — kein Client-Einweg-Close mehr.
- **`nodes/webapp.js`**: `dispatchDynamicStateWrite(body)` (validiert `{clientId,id,field,value}`, routet auf `setDynamicStateField`, Reason→400/409) + `POST /webapp/:appId/dynamic-state` (vor der Catch-all-Page-Route); `__test__`-Export.
- **`resources/lib/webapp-client.js`**: `writeDynamicState(nodeId,field,value)` (POSTet mit der Tab-clientId); der duration-getriebene `sl-after-hide` ruft jetzt `writeDynamicState(id,"visible",false)` statt `autoDismissed` zu setzen. **Entfernt:** das `interaction.autoDismissed`-Feld + der „immer-open"-Overlay-Block in `applyInteractionOverlay`.
- **Doku** `docs/nodes/feedback/ui-alert.md`: Duration als `visible`-Schreiber; die „bekannte offene Frage" aufgelöst.

**Routing.** `sl-after-hide (duration)` → Client `writeDynamicState`-POST → `dispatchDynamicStateWrite` → `setDynamicStateField(id,"visible",false,clientId)` → Snapshot-Push → Morph entfernt die Alert (`toRenderedComponent` gibt `undefined` bei `visibleIf=false`). Gebunden→Store durch, ungebunden→per-Client-Slot. Re-triggerbar: `visible=true` (msg/Verb/Store) zeigt sie wieder, ohne Reload. Der P100-Countdown-Balken läuft unverändert.

**Verify (browser, gemessen — Haupt-Checkout).** `tests/e2e/nodes/view/ui-alert.spec.ts` (D1/D2/D3) + `dynamic-state-field.spec.ts` — **24 passed** (32s): D1 Alert nach `duration=3000` DETACHED (`toHaveCount(0)` — mutations-rot gegen einen DOM-only-Close), D2 Countdown-Balken läuft dann Wert-Übergang entfernt, D3 per-client Re-Show via Button→function ohne Reload. P223 (`visible=msg`) + P100 + P224 grün mitgelaufen.

**Stats.** Unit grün: runtime 1266 (+8 P225). Cross-cutting grün: P223/P224/P100/P84. `pnpm build`/`lint`/`check:specs`/`check:roundtrip`/`check:links`/`check:roadmap` grün.

**Cost.** Sub-Agent `phase/P225` (worktree), ~10 min (10:33Z→10:43Z); Token-Zeile in `.ai/agent-runs.jsonl`.

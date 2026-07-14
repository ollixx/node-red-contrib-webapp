---
id: P226
node: ui-action
title: "ui-action: show/hide (+ enable/disable) schreiben den EINEN dynamic-state-Wert statt Client-Overlay; ui-alert einbinden"
epic: nodes/ui-action
status: done
dependencies: [P224]
verify: browser
spec: docs/nodes/behavior/ui-action.md
tests: tests/e2e/nodes/behavior/ui-action.tests.md
---
# P226 — Interaktions-Verben schreiben den dynamic-state-Wert

> Rationale: [ADR 0037](../../../../adr/0037-unified-dynamic-state-fields-one-value-many-writers.md).
> Vereinheitlicht den imperativen show/hide-Pfad mit dem deklarativen Wert.

## findings

Owner (2026-07-14): show/hide ist nur ein weiterer „von außen"-Schreiber auf den
EINEN Sichtbarkeits-Wert (ADR 0037), kein separates System.

Heute (getrackt): `ui-action` show/hide pusht ein **client-seitiges Overlay**
(`interaction.hidden` → CSS `.webapp-hidden`) via `interactionInputHandler`,
getrennt vom deklarativen `visible`. `ui-alert` ist gar nicht eingebunden
(fehlt in `INTERACTION_VERBS_BY_TYPE`).

## acceptance

- **show/hide schreiben den Wert.** `show`/`hide` setzen den EINEN
  Sichtbarkeits-Wert des Zielknotens über die Schreib-API (P224) — gebunden → in den
  Store durch; ungebunden → interner per-Client-Slot. **enable/disable** setzen analog
  `disabled`.
- **Client-Overlay entfällt (für Sichtbarkeit).** Der `interaction.hidden`-Overlay-Pfad
  wird für Sichtbarkeit zurückgebaut/ersetzt: die Sichtbarkeit folgt dem Wert (ein
  Snapshot-Re-Render), nicht einer separaten CSS-Schicht.
- **ui-alert einbinden.** `ui-alert` erhält die Sicht-Verben (in
  `INTERACTION_VERBS_BY_TYPE`), sodass show/hide auf Alerts wirkt.
- **Konsistenz mit Binding.** Ist `visible` an einen Store gebunden, ändert `hide`
  den **Store** (durchgeschrieben) — dieselbe Wahrheit wie ein direkter Store-Write.
- **Browser-Beweis.** Ein `ui-action` hide auf eine (gebundene und eine ungebundene)
  Alert blendet sie aus; show wieder ein; bei Binding ändert sich der Store-Wert.

## verify

`browser` — show/hide/enable/disable an gebundenen + ungebundenen Zielen im laufenden
Flow; Store-Durchschreiben geprüft.

## spec

`docs/nodes/behavior/ui-action.md` — Verben als dynamic-state-Schreiber dokumentieren
(nicht mehr als reines Client-Overlay).

## tests

`tests/e2e/nodes/behavior/ui-action.tests.md` — Verben schalten den Wert (gebunden +
ungebunden), ui-alert eingebunden.

## notes for the implementer

- Nutzt `setDynamicStateField` aus P224. Betrifft `interactionInputHandler` /
  `buildInteractionCommand` (nodes/webapp.js) und den `interaction.hidden`-Pfad in
  `resources/lib/webapp-client.js`. `INTERACTION_VERBS_BY_TYPE` um `ui-alert` (und
  ggf. weitere fehlende Knoten) ergänzen.

## Result

**Delivered.** `ui-action`-Verben `show`/`hide` (+ `enable`/`disable`) schreiben den EINEN dynamic-state-Wert über die P224-API (ADR 0037) statt eines Client-Overlays; `ui-alert` ist in das Verben-System eingebunden.
- **`nodes/webapp.js`**: `DYNAMIC_STATE_VERB_WRITES`-Map in `interactionInputHandler` routet `show/hide`→`visible`, `enable/disable`→`disabled` durch `setDynamicStateField(target, field, value, clientId)` (gebunden→Store durch, ungebunden→Slot; die Schreib-API pusht den Snapshot). `ui-alert` in `INTERACTION_VERBS_BY_TYPE` (`["show","hide"]`) UND seine Registrierung mit `interactionInputHandler(..., viewNodePatchInputHandler)` umschlossen (vorher bare handler → Verben erreichten es nie). `applyDynamicStateSlots` erweitert: interaktive Controls (`DYNAMIC_STATE_DISABLED_KINDS`) bekommen auch ohne Config einen neutralen `disabled`-Slot (Markup byte-unverändert bis ein Writer kippt).
- **Broadcast-Fix (Runtime, aus der E2E-Verifikation).** `buildAppSnapshot`-Read-Seite schichtete vorher `clientStateEntry ? entry : broadcast` — ein per-Client-Entry ist ein Voll-Clone bei Erstellung, sodass ein SPÄTERER Broadcast-Write unsichtbar blieb. Behoben: `defaults ← broadcast ← per-client` (per-Client gewinnt am Blatt → Isolation bleibt; ein nicht überschriebener Broadcast-Wert wird jetzt gesehen). Ein server-getriggertes (clientId-loses) Verb wirkt so als Broadcast.
- **Client** `resources/lib/webapp-client.js`: der `interaction.hidden`/`interaction.disabled`-Overlay (`.webapp-hidden`, `applyDisabledState`, die show/hide/enable/disable-Cases in `applyCommand`) entfernt — Sichtbarkeit folgt dem Wert (Re-Render). **Behalten:** `open`/`close`/`select`/`focus`/`navigate` (echte Client-Pfade).
- **Doku** `docs/nodes/behavior/ui-action.md` + Katalog.

**Verify (browser, gemessen — Haupt-Checkout).** `p226-verbs-write-dynamic-state.spec.ts` (2) + `ui-action-verbs.spec.ts` + `ui-alert.spec.ts` + `dynamic-state-field.spec.ts` — **31 passed**: ungebundene Alert hide→detached/show→sichtbar; store-gebundene Alert hide→Store-Wert flippt `true`→`false` (ein an dieselbe Slice gebundener Text ändert sich) + Alert weg; Zwei-Client-Isolation (P224) grün; Navigations-/open/close/select-Verben unberührt.

**Orchestrator-Diagnose (unit-grün, browser-rot).** Der erste E2E-Lauf war rot; ich habe die Kette per End-to-End-Tracing im laufenden Server verfolgt: `setDynamicStateField`→`unknown-node`, weil die beiden Test-Alerts ihr `message` als ROHEN STRING (statt `{kind:"literal"}`-Binding) trugen → Schema-Validierung schlug fehl → der Knoten kam nie in `runtimeState.definitions` (rendert dennoch via `readDeployDefinitions`) → Verb-Target nicht auffindbar. **Die Implementierung war korrekt; die Test-Fixtures waren fehlerhaft** — behoben (Literal-Binding), danach grün. (Kein Papern über: der Bug lag im Test, bewiesen per Trace.)

**Stats.** Unit grün: runtime 1311 (+45 P226 inkl. aktualisierte p82/p83/p85 auf Wert-Verhalten). Cross-cutting grün: P223/P224/P225 + Navigation. `pnpm validate` (build+lint+4 Tripwires+alle Tests) grün.

**Cost.** Sub-Agent `phase/P226` (worktree), 3 Runden (Impl ~8 min + Broadcast/Accordion-Fix ~45 min + Orchestrator-Trace-Diagnose & Test-Fix); Token-Zeilen in `.ai/agent-runs.jsonl`.

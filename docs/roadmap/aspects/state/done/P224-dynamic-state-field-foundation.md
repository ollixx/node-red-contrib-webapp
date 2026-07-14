---
id: P224
title: "State: Foundation für dynamische Zustandsfelder (visible/disabled) — EIN Wert pro Komponente: gebunden→Store, ungebunden→interner per-Client-Slot; Renderer liest den aufgelösten Wert"
epic: aspects/state
status: done
dependencies: [P201]
verify: browser
spec: docs/nodes/concepts/stores.md
tests: tests/e2e/nodes/state/dynamic-state-field.spec.ts
---
# P224 — Dynamic-State-Field Foundation

> Rationale: [ADR 0037](../../../../adr/0037-unified-dynamic-state-fields-one-value-many-writers.md).
> Foundation-Slice: der EINE Wert + Quelle/Schreib-Regel. Die Schreiber (msg,
> Duration, Verben) folgen als eigene Slices (P223 msg, P225 Duration, P226 Verben).

## findings

Owner (2026-07-14, verbatim, zum Zielmodell):

> „Wenn ich binde, ändere ich implizit den gebundenen Wert im Store. Ohne Binding
> muss die Visibility-Value in der Komponente (dem Knoten) gehalten werden. Duration
> ändert das genauso intern. Msg von außen." … „Es sollte für alle Felder gelten,
> die gebunden werden können und die einen dynamischen Zustand des Knotens abbilden
> wie Visible, Disabled, etc. Statische Felder brauchen das erstmal nicht (Color,
> Size, etc.)."

Heute: `visibleIf`/`enabledIf` werden nur aus dem **Binding** aufgelöst; ein
**ungebundenes** `visible`/`disabled` hat keinen lebenden Laufzeitwert, den etwas
setzen könnte. Es gibt keinen gemeinsamen „einen Wert", auf den msg/Duration/Verben
schreiben.

## acceptance

- **Feld-Klasse „dynamic-state".** Eine autoritative Liste der bindbaren Felder, die
  einen dynamischen Knoten-Zustand abbilden — zunächst `visible`, `disabled` —
  gegenüber statischen (color/size, ausgeschlossen). In `packages/schema`/Doku
  festgehalten, erweiterbar.
- **Ein aufgelöster Wert pro Komponente.** Der Renderer liest für jedes
  dynamic-state-Feld genau EINEN Wert (`visibleIf`/`enabledIf`):
  - **Gebunden** (store/state/reactive/query/routeParam): unverändert reaktiv aus der
    Quelle.
  - **Ungebunden** (literal/none): aus einem **internen per-Client-Slot** am Knoten
    (dieselbe per-Client-State-Maschinerie wie ui-store, P201), Key = Komponenten-id
    + Feld. Default = neutraler Wert (`visible`→true, `disabled`→false).
- **Einheitliche Schreib-API.** Eine interne Funktion `setDynamicStateField(nodeId,
  field, value, clientId)`: **gebunden → schreibt durch in den gebundenen Store**
  (dessen Scope respektierend, per-Client oder shared); **ungebunden → schreibt den
  internen Slot**. Danach Snapshot-Push, sodass der Re-Render den neuen Wert zeigt.
  (Diese API nutzen später P223/P225/P226.)
- **Browser-Beweis.** Ein ungebundenes `ui-alert.visible` wird über die neue API auf
  `false` gesetzt → Alert verschwindet im laufenden App; auf `true` → erscheint. Ein
  **gebundenes** `visible` (Store) wird über die API gesetzt → der **Store-Wert**
  ändert sich (durchgeschrieben), und der Re-Render folgt.
- **Per-Client isoliert.** Zwei Clients haben unabhängige ungebundene
  Sichtbarkeit (der interne Slot ist per-Client, nicht global).
- **Default/Bestand unverändert.** Ohne jeden Schreiber verhält sich alles wie heute
  (visible=true). Bestehende Tests bleiben grün.

## verify

`browser` — Sicht-Toggle (gebunden + ungebunden) über die neue API im laufenden App
(Playwright), inkl. per-Client-Isolation.

## spec

`docs/nodes/concepts/stores.md` (bzw. ein neues `dynamic-state.md`) — die Feld-Klasse
+ das Ein-Wert-Modell + interner per-Client-Slot vs. Store-Durchschreiben.

## tests

`tests/e2e/nodes/state/dynamic-state-field.spec.ts` — gebunden/ungebunden Toggle +
per-Client-Isolation + Default.

## notes for the implementer

- Kernstellen: per-Client-State (`getClientState`/`setClientState`) in
  `nodes/webapp.js`; `visibleIf`/`enabledIf`-Auflösung im Renderer (`matchesCondition`);
  das `visible→visibleIf`/`disabled→enabledIf`-Mapping in mapConfig.
- Nur die **Foundation** (der Wert + Quelle/Schreib-Regel). Schreiber sind eigene
  Slices: P223 (msg), P225 (Duration), P226 (show/hide-Verben).
- Slot-Lifecycle (Eviction/TTL) bewusst minimal halten; verweist auf die
  per-Client-Scale-Tech-Debt [P210](../deferred/P210-per-client-state-production-scale.md).

## Result

**Delivered.** Foundation für dynamische Zustandsfelder (ADR 0037): EIN aufgelöster Wert pro Komponente für `visible`/`disabled` — gebunden→Store-Durchschreiben, ungebunden→interner per-Client-Slot; einheitliche `setDynamicStateField`-API. Die Schreiber (msg/Duration/Verben) bleiben eigene Slices (P223/P225/P226).
- **Schema** `packages/schema/src/contracts.ts` + `index.ts`: Feld-Klasse `DYNAMIC_STATE_FIELDS` (`visible`/`disabled`), `DYNAMIC_STATE_FIELD_NEUTRAL` (visible→true, disabled→false), `DYNAMIC_STATE_BOUND_KINDS`, `isDynamicStateField`, `DynamicStateField`-Typ — autoritativ + erweiterbar, statische Felder (color/size) ausgeschlossen.
- **Runtime** `nodes/webapp.js`: `applyDynamicStateSlots` (Post-Pass in `toComponentDefinitions`) schreibt ein UNGEBUNDENES `visible`/`disabled` auf ein `state`-Binding am reservierten per-Client-Pfad `__dynamicState.<id>.<field>` um, mit dem konfigurierten Literal (oder Neutralwert) als `fallback` → ein leerer Slot ist byte-äquivalent zu heute (P202 gewahrt). `setDynamicStateField(nodeId, field, value, clientId)`: gebundener Store → Durchschreiben (scope-korrekt), gebundener State → State-Pfad, read-only gebunden (query/routeParam/reactive) → verweigert, ungebunden → per-Client-Slot; danach Snapshot-Push. `msg.ui.dynamicState = {field, value, id?}`-Seam in `viewNodePatchInputHandler` (honoriert `msg.ui.clientId`) als flow-erreichbarer Einstieg.
- **Doku** `docs/nodes/concepts/stores.md` (Feld-Klasse + Ein-Wert-Modell + Slot-vs-Store-Durchschreiben).

**P223-Entscheidung: parallel gelassen** (nicht auf `setDynamicStateField` umverdrahtet). P223s Unit-Tests + die `visible=msg`-E2E verlangen, dass ein msg-gebundenes `visible` bis zur Message VERSTECKT rendert — das widerspricht dem neutral-sichtbaren Slot-Default. Daher sind `msg`/`jsonata`/`flow`/`global`/`env` NICHT slot-backed beim Render (nur `literal`/absent routen in den Slot); P223 bleibt intakt, die API steht für P225/P226 bereit.

**Verify (browser, gemessen — Haupt-Checkout).** `tests/e2e/nodes/state/dynamic-state-field.spec.ts` grün (Teil von 23 passed inkl. ui-alert-Regression): ui-button→function→`msg.ui.dynamicState` (clientId-tragend) → ungebundener `ui-alert.visible`-Toggle (DOM-Sichtbarkeit), gebundenes `visible` (Store) Durchschreiben (Store-Wert ändert sich + Re-Render), Zwei-Client-Isolation.

**Stats.** Unit grün: schema 501 (+?), editor 178, renderer 163 (+5), runtime 1258 (+18, 27 neue P224-Unit-Tests gesamt). Cross-cutting explizit grün: P223 (20)/P110 (13)/P175 (9)/P214. `pnpm build`/`lint`/`check:specs` (42)/`check:roundtrip` (0 allowlisted)/`check:links`/`check:roadmap` grün.

**Cost.** Sub-Agent `phase/P224` (worktree), ~32 min (09:47:57Z→10:20:08Z); Token-Zeile in `.ai/agent-runs.jsonl`.

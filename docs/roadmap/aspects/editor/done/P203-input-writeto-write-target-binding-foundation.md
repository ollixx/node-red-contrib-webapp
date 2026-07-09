---
id: P203
title: "Input-Write-Back-Fundament: neues `writeTo`-Binding (Store/Flow/Global) + `writeTrigger` (change|submit, Default submit) symmetrisch zum `value`-Binding; Runtime persistiert die Nutzeränderung; ersetzt totes storeId/path/valuePath — bewiesen an ui-input"
epic: aspects/editor
findings:
  - "Owner (2026-07-08): 'macht es nicht sinn, value und \"write out\" gleich aufzubauen? Nur für das Schreiben machen die anderen Types keinen Sinn. Aber so würde es einheitlich aussehen und dem Benutzer einfacher machen.'"
  - "Owner-Entscheidungen (2026-07-08): writeTo-Kind-Satz = Store + Flow + Global; writeTrigger konfigurierbar (change|submit), Default submit."
  - "Befund (verifiziert 2026-07-05): ui-input hat DREI überlappende Wert-Felder — `value` (P123/ADR 0012 typedInput, voller Satz, Label 'Value Path', LESE-Quelle, funktioniert), `storeId`+`path` (Node-Picker + Text, als Write-Back dokumentiert, aber die Runtime schreibt darüber NICHTS zurück — toter Vertrag), und Legacy `valuePath` (Pre-P123 State-Pfad, nur in defaults für Migration). Der Nutzer muss heute change→function→ui-store händisch verdrahten."
acceptance:
  - "Schema (packages/schema): der Input-Kontrakt erhält `writeTo` (bindingSchema, aber nur die schreibbaren Kinds: store [Node + optional ein-Ebenen-subPath], flow, global) und `writeTrigger` (enum 'change'|'submit', Default 'submit'). Die nicht-schreibbaren Kinds (query/routeParam/reactive/literal/msg/jsonata/env/timestamp) sind für `writeTo` NICHT zulässig (Zod lehnt sie ab). Unit-Test deckt zulässige/abgelehnte Kinds + Default ab."
  - "Editor (ui-input.html + resources/lib/editor-common.js): ein `writeTo`-typedInput, gebaut wie das `value`-Feld, aber mit dem reduzierten Kind-Satz (Store-Picker + subPath, Flow, Global). Label 'Value Path' am value-Feld → 'Value'. Die alten Felder `Store ID`/`Store Path` und das Legacy `valuePath` verschwinden aus dem Editor-UI. Ein kleines `writeTrigger`-Select (change/submit, Default submit)."
  - "Migration (beim Öffnen im Editor, verlustfrei): ein Knoten mit Legacy `storeId`+`path` öffnet mit `writeTo = {kind:'store', path:<storeId>, subPath:{kind:'literal', value:<path>}}`; Legacy `valuePath` (ohne value-Binding) öffnet als `value = {kind:'state', path:<valuePath>}`. Speichern schreibt die neue Form; die alten Felder werden nicht neu erzeugt."
  - "Runtime Write-Back Store (browser, rot→grün an ui-input): ui-input mit `value=store(x).name` UND `writeTo=store(x).name`, `writeTrigger=submit`. Tippen + Enter/Blur ⇒ der Store-Slice `x.name` wird per-client aktualisiert (op set, trägt clientId), ein ZWEITER an `store(x).name` gebundener ui-text zeigt den neuen Wert live (SSE-Re-Render, gemessen), OHNE function-Verdrahtung. Mit `writeTrigger=change` schreibt jede Änderung."
  - "Runtime Write-Back Flow/Global: `writeTo=flow(k)` bzw. `global(k)` schreibt den Feldwert beim Trigger server-seitig in den Node-RED-Flow-/Global-Kontext (per E2E oder Unit am Input-Change-Pfad belegt). Bewusst OHNE per-client-Scope und OHNE automatischen Re-Render (dokumentierte Grenze)."
  - "Kein Auto-Wiring-Bruch: der bestehende `change`/`submit`-Output-Event feuert weiterhin (Nutzer kann zusätzlich verdrahten); der Write-Back ist additiv."
  - "Doku (docs/nodes/input/ui-input.md): value = Lese-Binding (voller Satz), writeTo = Schreib-Ziel (Store/Flow/Global), writeTrigger; storeId/path/valuePath als entfernt/migriert dokumentiert. Der falsche 'storeId/path speichert zurück'-Text ist weg bzw. korrekt auf writeTo bezogen."
verify: browser
spec: docs/nodes/input/ui-input.md
tests: tests/e2e/nodes/view/ui-input.tests.md
dependencies: []
status: done
---
# P203 — Input-Write-Back-Fundament (`writeTo` + `writeTrigger`), bewiesen an ui-input

> Entscheidung & Begründung: [ADR 0027](../../../../adr/0027-input-value-binding-is-bidirectional-value-read-writeto-write.md).
> Dieses Paket baut die **geteilte Mechanik** (Schema + Editor-Helfer + Runtime-
> Write-Back + Migration) und beweist sie an **ui-input**; der Rollout auf die
> übrigen sieben Input-Knoten folgt in **P204**.

## Kern

`value` (lesen, voller Satz) und `writeTo` (schreiben, nur Store/Flow/Global) sind
zwei **symmetrische** typedInputs. Die Runtime persistiert den Feldwert beim
`writeTrigger`-Event (Default `submit`) ins Ziel:

- **Store** → per-client Store-Op (`op:set` an `statePath`+subPath, mit clientId,
  SSE-Re-Render) — echtes Two-Way ohne function-Knoten.
- **Flow/Global** → Node-RED-Kontext, server-seitig, ohne per-client/Re-Render.

## acceptance / verify

- `verify: browser` — der Store-Write-Back an ui-input (tippen→submit→zweiter
  gebundener View aktualisiert live) wird im Haupt-Checkout durch den Orchestrator
  bewiesen ([[orchestrator-must-verify-e2e-in-main-checkout]]), per **Messung**
  (Textinhalt des zweiten Views ändert sich), nicht per Feld-Existenz.
- Migration + Schema-Kinds per Unit; Editor-UI per E2E (writeTo-typedInput da,
  storeId/path/valuePath weg).

## Risiken / Hinweise

- **Trigger pro Kontroll-Typ:** Text nutzt submit; Toggles/Selects/Slider haben
  kein submit → effektiv `change` (in P203 nur ui-input relevant; für die anderen
  in P204 explizit festhalten).
- **Cursor/Re-Render:** bei `writeTrigger=change` an Textfeldern kann ein
  SSE-Re-Render den Cursor bewegen — Default `submit` vermeidet das; der Morph
  keyt auf `data-webapp-node`, Wert bleibt konsistent.
- Nicht mit dem reinen **Lese**-Binding `value` verwechseln — `writeTo` ist die
  neue **Schreib**-Hälfte; beide gemeinsam = Two-Way.

## Result

- **delivered:** The shared write-back mechanism (ADR 0027), proven on **ui-input**. `value` (read, full
  binding set) and `writeTo` (write, only Store/Flow/Global) are symmetric typedInputs; the runtime
  persists the field value into the target on the `writeTrigger` event (default `submit`).
  - **Schema** (`packages/schema`): `writeToBindingSchema` (Zod **rejects** non-writable kinds —
    query/routeParam/reactive/literal/msg/jsonata/env/timestamp; `store` carries node + optional
    one-level literal `subPath`) + `writeTriggerSchema` (`change`|`submit`, default `submit`); the
    ui-input contract drops the dead `storeId`/`path`. Exports wired in `index.ts`.
  - **Editor** (`ui-input.html` + `editor-common.js`): a `writeTo` typedInput with a new `writable`
    category (store picker + subPath / flow / global) + a `writeTrigger` select; value label
    'Value Path'→'Value'; the old Store ID / Store Path rows and legacy `valuePath` removed from the UI.
    **Lossless on-open migration:** legacy `storeId`+`path` → `writeTo=store{subPath:literal}`,
    legacy `valuePath` → `value=state`; save writes the new form and drops the old fields. The editor
    package's pre-deploy validator (`nodes.ts`) updated too.
  - **Runtime** (`nodes/webapp.js` `dispatchClientEvent` → `applyInputWriteBack`): **additive** — the
    existing change/submit output event still fires; `store` → a per-client `op:set` at
    statePath+subPath carrying clientId + SSE snapshot push (real two-way, NO function node);
    `flow`/`global` → Node-RED context server-side (documented no-per-client-scope / no-auto-rerender
    boundary). `mapConfig` migrates legacy storeId/path via `legacyStoreWriteTo`.
  - **Docs** (`docs/nodes/input/ui-input.md`): rewritten — value=read, writeTo=write (Store/Flow/Global),
    writeTrigger; storeId/path/valuePath documented as removed/migrated; the wrong "storeId/path writes
    back" text is gone.
- **stats:** 17 files (+893/−82; 2 new test files). Develop verification: build 0; full unit **1074
  runtime / 401 schema / 176 editor**; **ui-input two-way E2E measured green** — W01: writeTo store +
  submit → a second bound `ui-text`'s content changes `start`→`Ada Lovelace` live via SSE, **no function
  wiring**; W02: submit-mode does NOT write on an intermediate change (stays `seed`); W03: change-mode
  writes every change; the editor legacy-migration E2E (storeId/path → writeTo store, old pair cleared)
  green. Full suite **652 passed** (only the pre-existing accordion red). check:specs/links/roadmap + lint green.
- **notes:** **Orchestrator recovery** — the first sub-agent died silently after only the schema layer
  (uncommitted, ~40 min inactive, no completion signal); detected via the frozen worktree + stale output
  file; a recovery agent finished deliverables 2–5 from the partial schema and ran the E2E green
  in-worktree before returning. Incidental: the input's form-field `name` attr (was `props.path`) now
  falls back to the node id — one p21 render test updated to match. Other 7 input controls untouched
  (that is **P204**, now unblocked).
- **cost:** dead agent a9750f88223316c24 (schema only) → recovery agent ac06c18f1089589e7 (~34m) +
  orchestrator merge/full-suite gate.

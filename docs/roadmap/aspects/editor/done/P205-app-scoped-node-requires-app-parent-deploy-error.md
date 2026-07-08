---
id: P205
epic: aspects/editor
title: "Deploy-Validierung: app-gebundener Knoten ohne gültigen App-Parent (leer / eigene ID / kein ui-app) → roter Fehler am Deploy (ui-store/query/action/navigation/dialog/route)"
findings:
  - "Owner (2026-07-06): 'ein neuer store kein parent hat und beim deployment einen fehler erzeugt. Die eigene ID soll da gar nicht auftauchen. Macht NULL Sinn.'"
  - "Befund: Deploy gruppiert Knoten per Flow-Tab (`z`) in eine App (getDefinitionBuckets filtert nach `z`), NICHT über `parent`. Ein Store ohne/mit Müll-Parent auf der App-Registerkarte rendert daher trotzdem — es gibt KEINE Deploy-Prüfung, dass ein app-gebundener Knoten eine echte ui-app als `parent` hat. `parent` nutzt nur der Editor (Referenz-Picker filtern `parent === appId`)."
  - "Befund: der Editor-Selektor wurde in 22c604b (5. Juli) korrigiert (setzt nie mehr die eigene ID, self-heilt `parent===self.id`→''), aber nur beim ÖFFNEN. Ein alter Knoten, der nur deployt wird, trägt die kaputte `parent===self.id` weiter — und fällt mangels Deploy-Prüfung nicht auf."
  - "Sicher: customers-crud + FlowBuilder (defaultsFor) setzen `parent` überall auf die App-ID → die neue Regel bricht keine bestehenden Flows/Tests; sie markiert NUR echte Fehlkonfigurationen (leer / eigene ID / Nicht-App)."
acceptance:
  - "Neue Deploy-Validierung (wie validateAppRootUniqueness): für JEDEN app-gebundenen Knoten (ui-store, ui-query, ui-action, ui-navigation, ui-dialog, ui-route) wird `parent` geprüft — leer/fehlt ODER === eigene ID ODER zeigt nicht auf eine im Flow vorhandene ui-app → ein Issue { nodeId, parent, message }."
  - "Am Deploy: jeder Issue-Knoten bekommt roten Status (fill:red) + reportRuntimeError (wie root-uniqueness / tab-children). Kein Render-Block — konsistent mit den bestehenden Validatoren."
  - "Pure, testbare Kernfunktion (nimmt ein Knoten-Array) — Unit-Test: Store ohne parent → Issue; Store mit parent===eigene ID → Issue; Store/query/action/navigation/dialog/route mit gültiger App → KEIN Issue; parent zeigt auf Nicht-App → Issue."
  - "Voller E2E-Lauf grün (FlowBuilder/customers-crud setzen parent → keine neuen Reds); der Owner-Fall (neuer Store ohne App) erzeugt am Deploy einen roten Fehler."
verify: unit
spec: docs/nodes/concepts/editor.md
tests: packages/runtime/test/
dependencies: []
status: done
---
# P205 — Deploy-Fehler bei app-gebundenem Knoten ohne gültigen App-Parent

> Owner 2026-07-06: ein neuer `ui-store` ohne gewählte App soll am Deploy einen
> Fehler werfen — heute rendert er still (Gruppierung per Flow-Tab, keine
> Parent-Prüfung). Gilt für ALLE app-gebundenen Knoten (Owner: „alle").

## Result

- **delivered:** New deploy-time validation `collectAppScopedParentIssues(nodes)` (pure, unit-testable)
  + `validateAppScopedNodeParent(RED)` (reads the deployed flow file) in `nodes/webapp.js`, mirroring
  `validateAppRootUniqueness`/`validateUiTabChildrenUniqueness`. For every app-scoped node —
  `ui-store`, `ui-query`, `ui-action`, `ui-navigation`, `ui-dialog`, `ui-route` — it checks `parent`:
  **empty/missing**, **=== the node's own id**, or **not a ui-app present in the flow** → an issue
  `{nodeId, parent, message}`. Wired into the deploy validation runner (next to the root/tab/section
  checks): each offending node gets a **red status** (`no app parent`) + a structured
  `reportRuntimeError('app-scoped-node-no-app-parent')`. Both functions exported on `__test__`.
- **why (root cause):** deploy groups nodes into an app by **flow tab (`z`)**, NOT by `parent`
  (`getDefinitionBuckets`), so a store with an empty / own-id / bogus `parent` rendered silently while
  its editor reference-pickers (which match `parent === appId`) dropped it — with no error. The editor
  self-heal from `22c604b` only runs on *open*; this catches the same corruption class at **deploy**.
- **verification (measured):** `packages/runtime/test/p205-app-scoped-parent-validation.test.ts` — 7/7:
  valid parent → no issue; **no parent (the owner's exact case) → issue**; own-id → issue; non-app
  parent → issue; all 6 app-scoped types flagged when parentless; a `ui-text` display node never
  flagged; all-valid (mirrors FlowBuilder / customers-crud) → no issues. Develop: build 0; full unit
  **1061**; lint + check:specs/links/roadmap green; **full E2E 648 passed** (only the pre-existing,
  chipped accordion red — no existing flow trips the new error, since FlowBuilder's `defaultsFor` and
  customers-crud set `parent` to the app id everywhere).
- **notes:** Deliberately a **red status + error**, not a hard render block (consistent with the other
  deploy validators) — the misconfigured node is surfaced, the rest of the app still renders. Renumbered
  from the initially-drafted P203 to **P205** after discovering the owner had concurrently authored
  P203/P204 (input write-back, ADR 0027) — those are untouched.
- **cost:** direct implementation by the orchestrator (owner asked "alle"); ~investigation + ~40 LOC + test.

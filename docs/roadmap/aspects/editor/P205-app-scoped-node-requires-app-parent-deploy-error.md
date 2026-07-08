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
status: in_progress
---
# P205 — Deploy-Fehler bei app-gebundenem Knoten ohne gültigen App-Parent

> Owner 2026-07-06: ein neuer `ui-store` ohne gewählte App soll am Deploy einen
> Fehler werfen — heute rendert er still (Gruppierung per Flow-Tab, keine
> Parent-Prüfung). Gilt für ALLE app-gebundenen Knoten (Owner: „alle").

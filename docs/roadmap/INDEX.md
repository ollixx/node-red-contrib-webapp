<!-- The ONLY "Always-read" roadmap file. Keep it slim.
     Lists open work only (pending / in_progress). Done packages live in their
     epic's done/ subfolder (deferred ones in deferred/) and are NOT listed here
     individually — that is the whole point of the split: the open surface stays
     small, and `ls <epic>/` shows open work at the root, archived work in done/.

     This file is MAINTAINED BY THE ORCHESTRATOR, not by a generator script.
     - At phase close-out: drop the just-finished package from "Open work" and
       bump the done count for its epic.
     - When a new package is authored: add one line under its epic.
     The read-only tripwire `pnpm check:roadmap` verifies this file stays in sync
     with the package files (every open package listed; every id resolvable). It
     writes nothing — fixing drift is the orchestrator's job. -->

# Roadmap index

Source of truth = the per-package files under `docs/roadmap/<epic>/`. Each package
follows `.ai/agents/roadmap-phase-schema.md`. This index is a slim view of **open
work only**.

## How to pick the next phase

The next phase is the first **pending** package below whose `dependencies` are all
`done`. Open its file for the full contract (`findings` / `acceptance` / `verify`).
**Deferred** packages are parked (see their `deferred_reason`) — skip them until
their blocker clears.

## Open work (pending / in_progress)

### nodes/ui-alert
- **P100** — pending — Duration/Countdown im Frontend, Icon-Custom-Option, Editor-Reihenfolge + Validierung — deps: [P90, P91] ✅ ready — [P100](nodes/ui-alert/P100-duration-countdown-icon-editor.md)

### nodes/ui-badge
- **P103** — pending — size-Feld komplett entfernen (Schema, mapConfig, Serializer, Editor, Fixtures, Tests, Docs) — deps: [P92] ✅ ready — [P103](nodes/ui-badge/P103-remove-size-field.md)

### aspects/rendering
- **P104** — pending — Wert-Rendering zentralisieren: Normalisierung (`""`→leer, `null`/Nicht-Skalar→`"?"`), alle wertbindenden Knoten scannen + Doc-Rollout — deps: [P3, P67] ✅ ready — [P104](aspects/rendering/P104-central-value-rendering.md)

### aspects/state
- **P106** — pending — Live-Modell-Auslieferung beim Deploy: In-Place via SSE-Snapshot, Reload nur als Shell-/Topologie-Fallback (+ Bugfix: Deploy liefert aktuell nichts) — deps: [P15, P31, P37] ✅ ready — [P106](aspects/state/P106-live-model-delivery-on-deploy.md)

### nodes/ui-app
- **P109** — pending — name + root ins Schema, title raus; Render-Semantik (HTML-title=name; Header-Slot leer→name, sonst nur Slot) — deps: [P1, P3] ✅ ready — [P109](nodes/ui-app/P109-name-root-title-rework.md)
- **P108** — pending — root-Eindeutigkeit beim Deploy validieren (heute nur id, nicht root) — deps: [P109] ⛔ blocked on P109 — [P108](nodes/ui-app/P108-root-uniqueness-validation.md)


## Deferred (parked, not abandoned)

Reason in each package's `deferred_reason`. Picked up once the blocker clears.

- **P102** — aspects/editor — Backend-Support-Helfer + Capability-Map + Rollout — *braucht ein zweites, real renderndes Backend (eigenes Epic)* — [P102](aspects/editor/deferred/P102-backend-support-helper-and-rollout.md)
- **P101** — nodes/ui-avatar — size/variant Backend-Warnung + Render-Garantie — *hängt an P102 + zweitem Backend* — [P101](nodes/ui-avatar/deferred/P101-size-variant-backend-warning.md)
- **P105** — aspects/rendering — nicht-darstellbarer Wert: Achtung-Icon + Alert/Dialog statt nacktem `"?"` — *Stufe 2 über P104* — [P105](aspects/rendering/deferred/P105-invalid-value-warning-affordance.md)
- **P107** — nodes/ui-app — App-weite Auth/Authz (OAuth2/OIDC) modellieren — *eigenes Epic, ADR + Owner-Entscheidung nötig* — [P107](nodes/ui-app/deferred/P107-auth-authz.md)

## Done (rollup — history lives in the epic folders)

Counts of completed packages per epic. Not individually listed here by design;
open the folder for the full history.

| Epic | done |
|---|---|
| nodes/ui-action | 4 |
| nodes/ui-app | 4 |
| nodes/ui-alert | 3 |
| nodes/ui-avatar | 2 |
| nodes/ui-log | 2 |
| nodes/ui-query | 2 |
| nodes/ui-store | 2 |
| nodes/ui-accordion · ui-badge · ui-breadcrumb · ui-button · ui-checkbox · ui-datepicker · ui-dialog · ui-divider · ui-icon · ui-image · ui-pagination · ui-route · ui-table · ui-text | 1 each |
| aspects/test-infra | 21 |
| aspects/misc | 16 |
| aspects/runtime · state | 7 each |
| aspects/editor · rendering · schema | 5 each |
| aspects/foundation | 5 |
| aspects/layout | 3 |
| aspects/app-model | 1 |

**Total: 108 done, 6 open, 4 deferred.**

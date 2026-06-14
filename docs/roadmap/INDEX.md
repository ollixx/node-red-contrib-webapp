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

_No open work — the roadmap is drained. New work is added here as packages are authored._


## Deferred (parked, not abandoned)

Reason in each package's `deferred_reason`. Picked up once the blocker clears.

- **P102** — aspects/editor — Backend-Support-Helfer + Capability-Map + Rollout — *braucht ein zweites, real renderndes Backend (eigenes Epic)* — [P102](aspects/editor/deferred/P102-backend-support-helper-and-rollout.md)
- **P101** — nodes/ui-avatar — size/variant Backend-Warnung + Render-Garantie — *hängt an P102 + zweitem Backend* — [P101](nodes/ui-avatar/deferred/P101-size-variant-backend-warning.md)
- **P105** — aspects/rendering — nicht-darstellbarer Wert: Achtung-Icon + Alert/Dialog statt nacktem `"?"` — *Stufe 2 über P104* — [P105](aspects/rendering/deferred/P105-invalid-value-warning-affordance.md)
- **P107** — nodes/ui-app — App-weite Auth/Authz (OAuth2/OIDC) modellieren — *eigenes Epic, ADR + Owner-Entscheidung nötig* — [P107](nodes/ui-app/deferred/P107-auth-authz.md)
- **P121** — aspects/docs — Konzept Nutzer-Doku: Wo/Wie die zwei Wege (Wire vs. Referenz) mit Beispielen dokumentieren — *Owner-Entscheidung zu Ort + Form nötig* — [P121](aspects/docs/deferred/P121-user-docs-concept-two-ways.md)
- **P143** — aspects/editor — Konzept: Enums dynamisch bindbar (Pro-Feld-typedInput mit Enum-Default statt globalem Advanced-Mode) — *ADR + Owner-Entscheidung nötig; Empfehlung steht* — [P143](aspects/editor/deferred/P143-enums-dynamic-binding-vs-advanced-mode.md)
- **P152** — nodes/ui-empty-state — Redesign: Container mit Slot(s) + visible-Binding (statt fester icon/title/message/action-Felder) — *Vertragswechsel; ADR + Restfragen nötig; Richtung steht* — [P152](nodes/ui-empty-state/deferred/P152-empty-state-as-container-with-visible-binding.md)
- **P162** — nodes/ui-event — Konzept: referenzbasierter lokaler Tap der App/Route-Lifecycle-Events (onEnter/onLeave) neben dem Consumer — *neuer Knoten + Vertrag; ADR-würdig (Scope/Events/Output-Form); löst Lange-Leitung aus ADR 0016* — [P162](nodes/ui-event/deferred/P162-ui-event-local-lifecycle-tap.md)

## Done (rollup — history lives in the epic folders)

Counts of completed packages per epic. Not individually listed here by design;
open the folder for the full history.

| Epic | done |
|---|---|
| nodes/ui-action | 6 |
| nodes/ui-app | 6 |
| nodes/ui-alert | 4 |
| nodes/ui-avatar | 2 |
| nodes/ui-log | 2 |
| nodes/ui-query | 5 |
| nodes/ui-store | 2 |
| nodes/ui-badge | 3 |
| nodes/ui-route | 2 |
| nodes/ui-text | 2 |
| nodes/ui-button | 3 |
| nodes/ui-input | 3 |
| nodes/ui-select | 3 |
| nodes/ui-switch | 3 |
| nodes/ui-slider | 3 |
| nodes/ui-radio | 3 |
| nodes/ui-textarea | 3 |
| nodes/ui-checkbox | 2 |
| nodes/ui-datepicker | 3 |
| nodes/ui-divider | 2 |
| nodes/ui-image | 2 |
| nodes/ui-pagination | 2 |
| nodes/ui-tabs | 3 |
| nodes/ui-repeat | 3 |
| nodes/ui-stepper | 1 |
| nodes/ui-menu | 1 |
| nodes/ui-list | 5 |
| nodes/ui-component | 3 |
| nodes/ui-table | 2 |
| nodes/ui-icon | 2 |
| nodes/ui-accordion | 2 |
| nodes/ui-breadcrumb · ui-dialog · ui-progress · ui-skeleton | 1 each |
| aspects/test-infra | 21 |
| aspects/misc | 16 |
| aspects/runtime | 7 |
| aspects/state | 8 |
| aspects/editor | 15 |
| schema | 5 |
| aspects/rendering | 13 |
| aspects/foundation | 5 |
| aspects/layout | 3 |
| aspects/app-model | 1 |

**Total: 180 done, 0 open, 8 deferred.**

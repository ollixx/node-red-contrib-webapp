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

- **P136** — nodes/ui-radio — Options als EIN typedInput {JSON+Validierung | Store} (geteilter Helfer mit ui-select) + label auf Wert-Satz — *geplant; braucht P113 + P133* — [P136](nodes/ui-radio/P136-radio-options-label-shared-helper.md)
- **P137** — nodes/ui-progress — `valuePath`→`value` (kanonischer typedInput) + `label` auf Wert-Satz — *geplant; braucht P113* — [P137](nodes/ui-progress/P137-progress-value-label-typedinput.md)
- **P138** — nodes/ui-skeleton — `visiblePath`→Standard-`visible`-typedInput; `lines` kontextabhängig disablen (Hinweis) — *geplant; braucht P113* — [P138](nodes/ui-skeleton/P138-skeleton-visible-typedinput-lines-disable.md)
- **P139** — aspects/editor — Fundament: Basis-Felder (visible/disabled/color/size) + Editor-Struktur („Layout"-Überschrift, Einklappen, N/A-Disable mit Hinweis) (ADR 0015) — *geplant; braucht P113* — [P139](aspects/editor/P139-common-base-fields-foundation.md)
- **P144** — nodes/ui-button — `label` auf kanonischen Wert-typedInput (P113-Lücke) — *Field-Typing Welle 1; braucht P113* — [P144](nodes/ui-button/P144-button-label-value-typedinput.md)
- **P145** — nodes/ui-input — `label` auf Wert-typedInput — *Field-Typing Welle 1; braucht P113* — [P145](nodes/ui-input/P145-input-label-value-typedinput.md)
- **P146** — nodes/ui-slider — `label` auf Wert-typedInput — *Field-Typing Welle 1; braucht P113* — [P146](nodes/ui-slider/P146-slider-label-value-typedinput.md)
- **P147** — nodes/ui-switch — `label`/`labelOn`/`labelOff` auf Wert-typedInput — *Field-Typing Welle 1; braucht P113* — [P147](nodes/ui-switch/P147-switch-labels-value-typedinput.md)
- **P148** — nodes/ui-textarea — `label`+`placeholder` auf Wert-typedInput — *Field-Typing Welle 1; braucht P113* — [P148](nodes/ui-textarea/P148-textarea-label-placeholder-value-typedinput.md)
- **P149** — nodes/ui-datepicker — `placeholder` auf Wert-typedInput — *Field-Typing Welle 1; braucht P113* — [P149](nodes/ui-datepicker/P149-datepicker-placeholder-value-typedinput.md)
- **P150** — nodes/ui-divider — `label` auf Wert-typedInput — *Field-Typing Welle 1; braucht P113* — [P150](nodes/ui-divider/P150-divider-label-value-typedinput.md)
- **P151** — nodes/ui-image — `alt`+`fallback` auf Wert-typedInput — *Field-Typing Welle 1; braucht P113* — [P151](nodes/ui-image/P151-image-alt-fallback-value-typedinput.md)


## Deferred (parked, not abandoned)

Reason in each package's `deferred_reason`. Picked up once the blocker clears.

- **P102** — aspects/editor — Backend-Support-Helfer + Capability-Map + Rollout — *braucht ein zweites, real renderndes Backend (eigenes Epic)* — [P102](aspects/editor/deferred/P102-backend-support-helper-and-rollout.md)
- **P101** — nodes/ui-avatar — size/variant Backend-Warnung + Render-Garantie — *hängt an P102 + zweitem Backend* — [P101](nodes/ui-avatar/deferred/P101-size-variant-backend-warning.md)
- **P105** — aspects/rendering — nicht-darstellbarer Wert: Achtung-Icon + Alert/Dialog statt nacktem `"?"` — *Stufe 2 über P104* — [P105](aspects/rendering/deferred/P105-invalid-value-warning-affordance.md)
- **P107** — nodes/ui-app — App-weite Auth/Authz (OAuth2/OIDC) modellieren — *eigenes Epic, ADR + Owner-Entscheidung nötig* — [P107](nodes/ui-app/deferred/P107-auth-authz.md)
- **P121** — aspects/docs — Konzept Nutzer-Doku: Wo/Wie die zwei Wege (Wire vs. Referenz) mit Beispielen dokumentieren — *Owner-Entscheidung zu Ort + Form nötig* — [P121](aspects/docs/deferred/P121-user-docs-concept-two-ways.md)
- **P140** — aspects/rendering — Konzept: Repeats (dynamische Element-Listen, n×) — *foundational; ADR + Owner-Entscheidung nötig* — [P140](aspects/rendering/deferred/P140-repeats-dynamic-element-lists.md)
- **P141** — aspects/rendering — Konzept: Components (wiederverwendbare Knoten-Sets, Definition/Instanz) — *großes Feature; ADR nötig* — [P141](aspects/rendering/deferred/P141-components-reusable-node-sets.md)
- **P142** — aspects/rendering — Konzept: ui-tabs/ui-accordion dynamische Slots — *hängt an Repeats/Components* — [P142](aspects/rendering/deferred/P142-tabs-accordion-dynamic-slots.md)
- **P143** — aspects/editor — Konzept: Enums dynamisch bindbar (Pro-Feld-typedInput mit Enum-Default statt globalem Advanced-Mode) — *ADR + Owner-Entscheidung nötig; Empfehlung steht* — [P143](aspects/editor/deferred/P143-enums-dynamic-binding-vs-advanced-mode.md)
- **P152** — nodes/ui-empty-state — Redesign: Container mit Slot(s) + visible-Binding (statt fester icon/title/message/action-Felder) — *Vertragswechsel; ADR + Restfragen nötig; Richtung steht* — [P152](nodes/ui-empty-state/deferred/P152-empty-state-as-container-with-visible-binding.md)

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
| nodes/ui-query | 2 |
| nodes/ui-store | 2 |
| nodes/ui-badge | 2 |
| nodes/ui-route | 2 |
| nodes/ui-text | 2 |
| nodes/ui-button | 2 |
| nodes/ui-input | 2 |
| nodes/ui-select | 3 |
| nodes/ui-switch | 2 |
| nodes/ui-slider | 2 |
| nodes/ui-radio | 2 |
| nodes/ui-textarea | 2 |
| nodes/ui-checkbox | 2 |
| nodes/ui-datepicker | 2 |
| nodes/ui-accordion · ui-breadcrumb · ui-dialog · ui-divider · ui-icon · ui-image · ui-pagination · ui-table | 1 each |
| aspects/test-infra | 21 |
| aspects/misc | 16 |
| aspects/runtime | 7 |
| aspects/state | 8 |
| aspects/editor | 13 |
| schema | 5 |
| aspects/rendering | 8 |
| aspects/foundation | 5 |
| aspects/layout | 3 |
| aspects/app-model | 1 |

**Total: 138 done, 12 open, 9 deferred.**

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

- **P111** — nodes/ui-text — `variant`→`style` (typografische Rolle) + neue Farb-`variant`, `size` entfernen — *erste Tranche geliefert; Sammelpaket aus dem ui-text-Review, weitere Findings folgen* — [P111](nodes/ui-text/P111-text-style-color-axes.md)
- **P113** — aspects/editor — EIN kanonischer Value-Binding-Typ-Satz (Reihenfolge + Semantik, jsonata message-getrieben, ohne state) für alle Display-Wert-Inputs — *geplant, nicht umgesetzt* — [P113](aspects/editor/P113-canonical-value-binding-types.md)
- **P116** — aspects/editor — `Reactive`-typedInput: Expression-Editor-Dialog mit Completion, zweistufiger Validierung + Doku-Panel; Typ #4 im kanonischen Satz (ADR 0010) — *geplant; braucht P113 + P115* — [P116](aspects/editor/P116-reactive-typedinput-expression-editor.md)
- **P119** — nodes/ui-action — Navigate-Editor: Modus-Umschalter mit Zwei-Wege-Badges, transitiver Wire-Scan (Assistenz), Parameter-Mapping-Tabelle (ADR 0011) — *geplant; braucht P118 + P120* — [P119](nodes/ui-action/P119-navigate-editor-modes-wire-scan.md)
- **P120** — aspects/editor — Zwei-Wege-Farbcodierung: Tokens (Blau=Wire, Lila=Referenz) + Badge-Helfer + Editor-User-Setting (ADR 0011) — *Code + Aktivierungs-Fix gemerged, 5 dual-path-E2E grün; Close-out blockiert bis Suite gesamt grün* — [P120](aspects/editor/P120-dual-path-coding-tokens-user-setting.md)
- **P118** — nodes/ui-action — Navigate-Zielquelle (wire \| route \| url) im Schema + Laufzeit-Adressierungs-Vorrang (ADR 0011) — *REOPENED: Code gemerged, aber 6 Navigate-Runtime-E2E rot (Navigate erreicht Route nicht, landet auf App-Wurzel) — Fix nötig* — [P118](nodes/ui-action/P118-navigate-target-modes-runtime.md)
- **P114** — aspects/editor — Picker-Dialog als EINZIGE Auswahl für alle Referenzfelder (parent, route, action, store, mount) + `mounts`-Preset (ADR 0009) — *REOPENED: Code gemerged, aber Mount-Picker-E2E rot (`.webapp-node-picker-row` erscheint nicht im Mount-Dialog) — Fix nötig* — [P114](aspects/editor/P114-picker-dialog-sole-reference-selection.md)
- **P117** — aspects/editor — Node-Picker-Dialog: Kandidaten auf die App des editierten Knotens scopen + Optik an die NR-Admin-Dialoge angleichen (ADR 0009) — *REOPENED: zusammen mit P114; Mount-Picker-E2E rot — Fix nötig* — [P117](aspects/editor/P117-node-picker-app-scope-and-styling.md)
- **P122** — nodes/ui-button — `disabledPath`→Boolean-Zustand-typedInput (inkl. Store) + `href`→URL/Pfad-typedInput (ADR 0012) — *geplant; braucht P113* — [P122](nodes/ui-button/P122-button-disabled-href-typedinput.md)
- **P123** — nodes/ui-input — `value`→kanonischer typedInput + valuePath-Migration; bindbares `disabled` (ADR 0012) — *geplant; braucht P113* — [P123](nodes/ui-input/P123-input-value-disabled-typedinput.md)
- **P124** — nodes/ui-select — `value`→kanonischer typedInput + valuePath-Migration; bindbares `disabled` (ADR 0012) — *geplant; braucht P113* — [P124](nodes/ui-select/P124-select-value-disabled-typedinput.md)
- **P125** — nodes/ui-switch — `value`→kanonischer typedInput + valuePath-Migration; bindbares `disabled` (ADR 0012) — *geplant; braucht P113* — [P125](nodes/ui-switch/P125-switch-value-disabled-typedinput.md)
- **P126** — nodes/ui-slider — `value`→kanonischer typedInput + valuePath-Migration; bindbares `disabled` (ADR 0012) — *geplant; braucht P113* — [P126](nodes/ui-slider/P126-slider-value-disabled-typedinput.md)
- **P127** — nodes/ui-radio — `value`→kanonischer typedInput + valuePath-Migration; bindbares `disabled` (ADR 0012) — *geplant; braucht P113* — [P127](nodes/ui-radio/P127-radio-value-disabled-typedinput.md)
- **P128** — nodes/ui-textarea — `value`→kanonischer typedInput + valuePath-Migration; bindbares `disabled` (ADR 0012) — *geplant; braucht P113* — [P128](nodes/ui-textarea/P128-textarea-value-disabled-typedinput.md)
- **P129** — nodes/ui-checkbox — bindbares `disabled` (Boolean-Zustand, inkl. Store) (ADR 0012) — *geplant; braucht P113* — [P129](nodes/ui-checkbox/P129-checkbox-disabled-typedinput.md)
- **P130** — nodes/ui-datepicker — bindbares `disabled` (Boolean-Zustand, inkl. Store) (ADR 0012) — *geplant; braucht P113* — [P130](nodes/ui-datepicker/P130-datepicker-disabled-typedinput.md)


## Deferred (parked, not abandoned)

Reason in each package's `deferred_reason`. Picked up once the blocker clears.

- **P102** — aspects/editor — Backend-Support-Helfer + Capability-Map + Rollout — *braucht ein zweites, real renderndes Backend (eigenes Epic)* — [P102](aspects/editor/deferred/P102-backend-support-helper-and-rollout.md)
- **P101** — nodes/ui-avatar — size/variant Backend-Warnung + Render-Garantie — *hängt an P102 + zweitem Backend* — [P101](nodes/ui-avatar/deferred/P101-size-variant-backend-warning.md)
- **P105** — aspects/rendering — nicht-darstellbarer Wert: Achtung-Icon + Alert/Dialog statt nacktem `"?"` — *Stufe 2 über P104* — [P105](aspects/rendering/deferred/P105-invalid-value-warning-affordance.md)
- **P107** — nodes/ui-app — App-weite Auth/Authz (OAuth2/OIDC) modellieren — *eigenes Epic, ADR + Owner-Entscheidung nötig* — [P107](nodes/ui-app/deferred/P107-auth-authz.md)
- **P121** — aspects/docs — Konzept Nutzer-Doku: Wo/Wie die zwei Wege (Wire vs. Referenz) mit Beispielen dokumentieren — *Owner-Entscheidung zu Ort + Form nötig* — [P121](aspects/docs/deferred/P121-user-docs-concept-two-ways.md)

## Done (rollup — history lives in the epic folders)

Counts of completed packages per epic. Not individually listed here by design;
open the folder for the full history.

| Epic | done |
|---|---|
| nodes/ui-action | 4 |
| nodes/ui-app | 6 |
| nodes/ui-alert | 4 |
| nodes/ui-avatar | 2 |
| nodes/ui-log | 2 |
| nodes/ui-query | 2 |
| nodes/ui-store | 2 |
| nodes/ui-badge | 2 |
| nodes/ui-route | 2 |
| nodes/ui-accordion · ui-breadcrumb · ui-button · ui-checkbox · ui-datepicker · ui-dialog · ui-divider · ui-icon · ui-image · ui-pagination · ui-table · ui-text | 1 each |
| aspects/test-infra | 21 |
| aspects/misc | 16 |
| aspects/runtime | 7 |
| aspects/state | 8 |
| aspects/editor | 5 |
| schema | 5 |
| aspects/rendering | 7 |
| aspects/foundation | 5 |
| aspects/layout | 3 |
| aspects/app-model | 1 |

**Total: 116 done, 17 open, 5 deferred.**

# Roadmap phase schema (agent-os)

Mandatory for every phase that changes **observable behaviour** of a `ui-*`
node (rendering, editor UI, validation, events). It exists because terse,
semicolon-packed `title` strings let detailed user findings slip through: an
agent could make `pnpm validate` green and still miss what was actually asked
for, because the target was never written down in a verifiable form.

A phase is a **contract**, not a hint. The contract has three jobs:
1. preserve the user's report **verbatim** so it cannot be re-interpreted away,
2. state **observable acceptance criteria** so "done" is checkable, not guessed,
3. name the **durable spec** and the **test catalogue** the change must update.

## Fields

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | `P<n>` phase id. |
| `node` | for node phases | The `ui-*` node this phase touches (e.g. `ui-alert`). |
| `title` | yes | One short line — *what* changes, not the full detail. Detail lives in `findings`/`acceptance`. |
| `findings` | for bug/UX phases | **The user's report, verbatim.** A list of symptoms/requests in the user's own words. Never paraphrased into the fix — the symptom and the fix are different things and must stay separate. This is the part the agent may not silently drop. |
| `acceptance` | for node phases | A list of **observable** done-criteria. Each entry names a concrete, checkable outcome (a rendered attribute, a DOM state after N seconds, a red validation error, an editor screenshot). One `findings` item maps to one or more `acceptance` lines. If you cannot phrase a finding as an observable outcome, the finding is under-specified — clarify it before writing the phase, do not paper over it. |
| `verify` | for node phases | `browser` \| `unit`. `browser` means the phase is **not done** until each `acceptance` line was proven in the real running app via `preview_*` / Playwright — unit tests passing is necessary but not sufficient. UI/render/editor findings are always `browser`. |
| `spec` | for node phases | Path to the node's requirement doc under `docs/nodes/<category>/<node>.md` — the durable contract that must be updated to match what was built. |
| `tests` | for node phases | **Path to the node's test catalogue `.md`** under `tests/e2e/nodes/<category>/<node>.tests.md`. **Mandatory reference.** The phase is not done until this catalogue lists the new tests with their test goals, kept current per `.ai/agents/node-testing.md`. A phase that changes a node without updating its `.tests.md` is incomplete. |
| `dependencies` | yes | List of phase ids that must be `done` first. |
| `status` | yes | `pending` \| `in_progress` \| `done` \| `deferred` \| `blocked`. `deferred` = consciously parked (not abandoned); requires a `deferred_reason` and is listed under INDEX "Deferred", not "Open work". |
| `deferred_reason` | if `deferred` | One line: why it is parked and what unblocks it. |

## Folder layout — status maps to location

A package's **status determines where its file lives** inside its epic folder, so
a human can scan an epic at a glance (`ls`) without opening anything:

```
docs/roadmap/<epic>/
  epic.md
  P###-<slug>.md          ← pending / in_progress  (open work, at the epic root)
  deferred/
    P###-<slug>.md        ← deferred  (only created when the epic has any)
  done/
    P###-<slug>.md        ← done  (archived history; stays in its epic)
```

**On every status transition, `git mv` the file to its new location** and fix the
two things a move can break:
1. the package's own **relative body links** (the directory depth changes by one
   between the epic root and a `done/` / `deferred/` subfolder — bump `../` by one
   level), and
2. the **INDEX link** to it (orchestrator).

`pnpm check:roadmap` **validates every relative link** in `docs/roadmap/**.md` and
fails on a broken one — so a move that leaves a dangling link cannot be committed.
You never have to trust that links are clean; the tripwire proves it. Prefer the
frontmatter `spec:`/`tests:` fields (repo-root paths, move-invariant) over body
links where you can.

## Detail bar (AGENTS.md rule 11)

A package must be **buildable from its own text without interpretation**. If you
cannot meet that bar from the owner's input — a field's allowed values, a
validation rule, an icon flow, a backend's support — **stop and ask**, then write
the detailed package. A terse package is the single most common reason a feature
is half-built or built wrong. The matching durable contract — the node's
`docs/nodes/**` requirement doc — is held to the same bar: every field documented
with type, options, default, binding kinds, per-backend support, validation +
error text, field dependencies, and the observable rendered effect.

## Rules

- **`findings` is the user's words.** Copy the report in. Do not compress it into
  the fix and do not resolve ambiguity by inventing a target — an ambiguous
  finding is clarified with the user, not guessed.
- **`acceptance` and `findings` must not contradict.** A finding describes the
  *bug* ("countdown bar runs backwards"); acceptance describes the *fixed target*
  ("bar depletes over the duration"). State the target once, unambiguously, so a
  coding agent reading both never has to reconcile two different directions.
- **`verify: browser` ⇒ proof in the running app.** The orchestrator (or the
  implementing agent in the main checkout) drives `preview_*` / Playwright and
  confirms every `acceptance` line. Worktree sub-agents that cannot run the app
  report that the browser proof is outstanding; the orchestrator closes it.
  (See [[orchestrator-must-verify-e2e-in-main-checkout]].)
- **Two mandatory references per node phase:** the `spec` (what the node must do)
  and the `tests` catalogue (how it is proven). Both must be updated; the
  archive `summary` names both.

## Example — a correctly specified node phase

```yaml
- id: P100
  node: ui-alert
  title: "ui-alert: Duration/Countdown im Frontend, Icon-Custom-Option, Editor-Reihenfolge + Validierung"
  findings:                       # the user's report, verbatim
    - "Duration führt im Frontend nicht zu einem Timeout und Ausblenden des Alerts"
    - "Countdown führt nicht zu einem Countdown im Frontend (Shoelace rendert die Progressbar rückwärts)"
    - "Validierung fehlt: Countdown 'on' ohne Duration ist nicht valide"
    - "Editor: Feld 'Title' soll über 'Message' stehen"
    - "Editor: unter 'Message' eine Trennlinie"
    - "Icon: 'kein Icon' und 'kein Icon explizit' ergibt keinen Sinn. Stattdessen eine Option 'Custom', die den Button 'Icon auswählen' anzeigt; ein Klick auf den Button öffnet den Icon-Auswahl-Dialog."
  acceptance:                     # observable, must be proven in the browser
    - "Browser: ein Alert mit duration=3000 blendet sich nach ~3s selbst aus (im DOM entfernt/geschlossen)."
    - "Browser: bei aktivem Countdown nimmt der Fortschrittsbalken über die Duration sichtbar ab (leert sich) und erreicht 0 genau wenn der Alert ausgeblendet wird — Richtung 'läuft ab', nicht 'füllt sich'."
    - "Editor: Countdown aktiviert ohne gesetzte Duration ⇒ Validierungsfehler vor Deploy (Knoten rot markiert, Deploy blockiert)."
    - "Editor-Screenshot: Feld 'Title' steht über 'Message'; direkt unter 'Message' ist eine Trennlinie sichtbar."
    - "Editor: Icon-Auswahl bietet die Option 'Custom'. Ist 'Custom' gewählt, erscheint der Button 'Icon auswählen'; Klick darauf öffnet den Icon-Auswahl-Dialog und die getroffene Auswahl wird übernommen."
  verify: browser
  spec: docs/nodes/feedback/ui-alert.md
  tests: tests/e2e/nodes/view/ui-alert.tests.md
  dependencies: [P90, P91]
  status: pending
```

Note how each `findings` line has a matching `acceptance` line, and how the
countdown is stated **once** as a single unambiguous target (the bar *depletes*)
instead of leaving "backwards" and "forwards" for the agent to reconcile.
```

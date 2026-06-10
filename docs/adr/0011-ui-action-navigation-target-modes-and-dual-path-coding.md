# ADR 0011: ui-action navigation — explicit target modes, wire-scan as assistance, dual-path visual coding

- Status: accepted
- Date: 2026-06-10
- Builds on: [ADR 0005](0005-ui-action-interaction-vocabulary.md) (verb set),
  [ADR 0007](0007-action-message-and-per-node-interaction-handlers.md)
  (enrich-don't-replace, P66 navigation scenarios), [ADR 0009](0009-picker-dialog-as-sole-reference-selection.md)
  (picker as sole reference selection).
- Amends: the P66 navigation contract in `docs/nodes/behavior/ui-action.md`
  (the "wired XOR `to`, ambiguity = deploy error" rule is replaced).

## Context

`ui-action`'s navigation configuration grew in layers (P66 `to`+`params`, P60
canvas targets, ADR 0007 scenarios) and is, in the owner's words, "beliebig
unverständlich": three ways to configure a navigation target (wired to a
`ui-route`; a `to` URL; runtime `msg` overrides), a free-text key/value
"Parameter" section whose direction (it fills the **target** route's
`:placeholders`) is not discoverable, and an ambiguity rule that is neither
fully implemented nor implementable — the editor cannot reliably know the
wired target.

A first proposal (drop the wire path, references only) was **rejected by the
owner** on principle: *"Wir haben immer noch die Prämisse node-red first —
wiring muss immer auch ein Weg sein."* Users start with wires; graduating to
references is a journey, not a prerequisite. Both ways are first-class,
permanently.

Two hard problems were worked through in discussion:

1. **Transitive wires.** The wire to the target route may pass through other
   nodes (function, switch). A static wire scan (the owner has built one in
   node-red-contrib-components) can find downstream routes, but branching
   makes the result a *set*, and foreign nodes make it a *heuristic* — it can
   be wrong in both directions.
2. **Conflicts.** A node wired to route A while the user selects route B by
   reference; or a user who is wired but wants the other way. Resolving this
   by heuristic precedence or deploy errors is fragile.

Owner decisions (2026-06-10, verbatim where it matters):

- Colors for the two conceptual ways: *"Ich finde die Idee mit Farben gut.
  Nehmen wir erstmal Blau und Lila."* Configurable, *"vielleicht sogar vom
  User"*; whether settings live in `ui-app` or globally was posed as an open
  question (answered below).
- *"Wir brauchen da ein Modus-Konzept, das eine Doppel-Konfig technisch
  ausschließt. Wenn der User dann eine unsinnige Verdrahtung baut, dann ist
  das seine Verantwortung."* Compensated by good documentation with examples
  for each way — *where/how* that documentation is delivered is itself an
  open concept (parked, see Consequences).

## Decision

### 1. An explicit target-source mode — intent lives in the config

`ui-action` (and `ui-navigation`, which must follow the same model) gets a
stored, explicit **target source** for `navigate`:

| Mode | Target | Parameter section |
|---|---|---|
| **`wire`** | whatever `ui-route`/`ui-app` the emitted message reaches over wires | assist-only: placeholders of the scan-detected route(s), free entry when undetectable |
| **`route`** | a `ui-route` chosen **by reference** (P68 picker, `routes` preset, app-scoped per P117) | mapping table: the target route's `:placeholders` fixed as rows, one value each |
| **`url`** | `to` as typedInput (`str` \| `msg` \| `flow` \| `global` \| `jsonata`) — the URL is built whole | none (a built URL carries its values; the separate params list is removed in this mode) |

The mode **technically excludes double configuration**: only the active
mode's fields are editable and serialized; switching modes clears/ignores the
others. The old "wired XOR `to`" deploy-time ambiguity error is **dropped** —
it existed only because intent was never stored. Parameter *values* (route
mode, and wire mode where detected) are entered per typedInput with the
standard action-time types (`str` | `msg` | `jsonata` | `flow` | `global` |
`env`), evaluated against the triggering message server-side — replacing the
literal-only free-text key/value list. `msg.ui.action.to` / `.params` remain
runtime overrides (ADR 0007 enrichment is unchanged).

### 2. Wire scan — assistance only, set-valued, never validation

The editor panel detects wired targets via a transitive scan (BFS over
outgoing wires from the edited node, cycle guard, depth limit, collecting
`ui-route`/`ui-app`). Principles, learned from the owner's
node-red-contrib-components experience:

- **Branching is a feature, not a corner case** — action → switch → two
  routes is conditional navigation. The scan therefore reports a **set**:
  exactly one hit → full assistance (badge "via Wire → `/customers/:id`" +
  placeholder mapping); several hits → badge "via Wire → n mögliche Ziele"
  with placeholders listed per target; none → plain wire mode with free
  parameter entry.
- **A heuristic must never block a deploy.** Scan results produce badges,
  prefills and hints — never validation errors. A nonsensical wiring is the
  user's responsibility (owner decision); the compensation is documentation
  with worked examples per way, not enforcement.

### 3. Runtime addressing precedence — both ways coexist deterministically

*An explicitly addressed navigation wins; a wired `ui-route` never hijacks a
message that already carries a different target.* Concretely: in `route`/`url`
mode the action's emitted `msg.ui.action` carries the resolved target; any
`ui-route` receiving that message treats it as addressed navigation and passes
it through instead of imposing its own `path`. Only in `wire` mode (no
explicit target in the message) does today's behavior apply: the route that
*receives* the message builds the location from its own `path` — which also
makes branching well-defined (the route the message reaches, wins). No editor
guessing, no heuristic precedence.

Known residual gap, accepted and documented: in wire mode with branching, a
static parameter table cannot guarantee every branch route receives all its
placeholders — that remains runtime responsibility (`msg.ui.action.params`),
and the panel says so.

### 4. Dual-path visual coding — blue wire, purple reference

The two conceptual ways get a consistent visual coding across all editor
panels: **blue = Node-RED wiring, purple ("Lila") = inline/internal
reference** — always as color **plus icon plus label** (red was rejected: it
reads as validation error in the admin UI; color alone fails accessibility).
First consumer is the ui-action target-mode badge; the tokens are central so
later consumers (structure sidebar, other panels with both ways) reuse them.

**Where the color configuration lives — decided: editor-global, per user, NOT
`ui-app`.** The coding is pure editor presentation (like theme or grid), not
an app property; per-app colors would show the same person different codings
in different apps and defeat the teaching purpose. Implementation target: a
webapp section in Node-RED's editor user settings (`RED.userSettings` pane)
with the two colors, defaults blue/purple. A broader "settings concept"
(what else becomes user-configurable, persistence details) is its own
follow-up package.

### 5. Why this and not the alternatives

- *Drop the wire path:* rejected — violates the node-red-first premise.
- *Heuristic precedence (wire wins / reference wins silently):* rejected —
  scan is heuristic; silent precedence makes flows behave differently from
  what the panel shows.
- *Deploy error on wired+referenced:* rejected — hard errors from heuristic
  detection block legitimate flows; the mode field removes the ambiguity at
  the source.
- *Red for references:* rejected — collides with error semantics.
- *Colors per `ui-app`:* rejected — editor UX is not app state.

## Consequences

- `ui-action`/`ui-navigation` configs gain a target-source mode and a typed
  params mapping; legacy flows are migrated on load (existing `to` → `url`
  mode; otherwise `wire` mode; legacy params object → literal-typed rows).
  Spec docs (`docs/nodes/behavior/ui-action.md`, `ui-navigation.md`,
  `ui-route.md` pass-through rule, `messages.md`) must be updated by the
  implementing packages.
- The runtime gains the addressing-precedence rule (route pass-through for
  addressed navigations) — a behavioral change for flows that relied on a
  wired route overriding an explicit `to` (judged unlikely and previously
  declared invalid anyway).
- The editor gains the wire-scan helper, the mode UI with the param mapping
  table, and the central dual-path tokens + user-settings pane.
- Implemented by **P118** (runtime/schema semantics), **P119** (ui-action
  editor UX), **P120** (dual-path coding tokens + editor user setting).
- **Parked as open concepts (owner decision needed):** the user-facing
  documentation concept — where and how "the two ways" documentation with
  examples is delivered (in-editor help, docs site, examples gallery) —
  **P121**, deferred. The broader settings concept may grow out of P120 if
  more user preferences appear.

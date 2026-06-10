# ADR 0010: `reactive` binding — client-state-driven, read-only JavaScript expressions

- Status: accepted
- Date: 2026-06-10
- Builds on: [ADR 0007](0007-action-message-and-per-node-interaction-handlers.md)
  (interaction model), P67 (`store` binding by node id), P112 (route lifecycle),
  and amends the canonical value-binding type set planned in **P113**
  (`docs/roadmap/aspects/editor/P113-canonical-value-binding-types.md`).

## Context

A recurring authoring need cannot be expressed with any single existing binding
kind: **composing a displayed text from client-known values.** The motivating
case (owner, 2026-06-10): a route `/customers/:id` whose parameter should appear
*as part of* a text — "Kunde 42", not just "42".

Today the options are all unsatisfying:

- A `routeParam` binding shows only the **raw** value (`42`). A bound value is
  exactly *one* binding; there is no composition with static text.
- The backend route (`ui-route` `onEnter` → `function` builds the text →
  `ui-store` → `store` binding on `ui-text`) works — P112 made `onEnter` fire on
  every arrival including deep links — but it is heavy machinery for pure
  string composition: three extra nodes, a `clientId` to thread through
  (forgetting it broadcasts one client's page title to every client), and the
  composed value is stored as if it were owned state when it is really a
  *derived view* of state.
- Having a reactive function **write into a store** was considered and
  rejected: a store is owned state, written through operations with a clear
  source. A derived value that writes into a real store creates ownership
  problems (who wins against concurrent backend writes? when is it
  invalidated?). The result of a derivation is not state — it is a **view on
  state**.

`docs/nodes/state/ui-store.md` has long listed "should `ui-store` encapsulate
derived state?" as an open question. This ADR answers the *value-composition*
part of that question with a dedicated binding kind instead of overloading the
store node.

The owner's direction (verbatim, 2026-06-10): *"hier wäre ja eine reaktive
Funktion cool, die am Page Parameter ‚hängt'"* … *"Ein neuer Type ‚Reactive'
vielleicht? Und den Code, den man da eingibt, … am liebsten gleich mit
Codecompletion und Validierung etc. inline eingeben als User. Da würden dann
alle globalen Variablen, wie ‚routeParam' auftauchen. Natürlich auch mit einer
coolen Doku dazu."*

## Decision

### 1. A new binding kind: `reactive`

The canonical value-binding type set (P113) gains a fourteenth member,
**`Reactive`**, serialized as:

```json
{ "kind": "reactive", "value": "<JavaScript expression source>" }
```

Note `value`, not `path` — the payload is **source code**, not a reference.
It is inserted at **position 4** of the canonical order, directly after
`Route-Param` and before `msg`, because it belongs to the *reactive* category
(Store, Query, Route-Param, **Reactive**) and must not be confused with the
*message-driven* category (`msg`, `JSONata`):

> Store, Query, Route-Param, **Reactive**, msg, JSONata, string, number,
> boolean, json, timestamp, Flow, Global, Env

### 2. The expression: one synchronous, read-only JavaScript expression

- **A single JavaScript expression** (ES2020), not a function body: no
  statements, no assignments, no `async`/`await`. It must parse when wrapped as
  `return ( <source> );`. Template literals are the expected idiom and may span
  multiple lines.
- **Strict mode, read-only contract.** The expression reads the exposed globals
  and returns the value to display. No write API of any form is exposed —
  purity by construction is what makes the kind safe to re-evaluate at any
  time. (Hard sandboxing is a non-goal: the expression author is the flow
  author, the same trust level as a `function` node.)
- The expression result is rendered through the normal value-rendering rules
  (strings as-is, number/boolean stringified, non-renderable objects per the
  invalid-value convention).

### 3. The globals: exactly the client-known binding sources

The expression sees precisely the sources the renderer already resolves for the
declarative binding kinds — nothing more:

| Global | Type | Meaning |
|---|---|---|
| `routeParam` | object | The resolved parameters of the **currently active route** (the same source as the `routeParam` binding kind). `routeParam.id` for `/customers/:id`. Missing param → `undefined`. |
| `store(name)` | function | Live value of the parent app's `ui-store` whose **`name`** equals `name` (trimmed, exact match). Resolved name → `statePath` → live client state. |
| `query(path)` | function | Value at `path` inside the query results (same lookup as the `query` binding kind). |

Deliberately **not** exposed: `msg` (no message context exists at render time —
message-driven composition is what the `msg`/`JSONata` kinds are for), flow/
global/env context (server-side, non-reactive), any DOM or host object.

**Stores are referenced by `name`, not node id — a deliberate trade-off.** The
`store` *binding kind* (P67) references by node id for rename-robustness. An
expression, however, is written and read by humans; `store("customer")` is
self-explanatory where `store("a3f1c2…")` is not, and the editor's completion
can only meaningfully offer names. The robustness loss (renaming a store breaks
expressions that reference it) is mitigated in the editor: deploy-time
validation flags unknown or ambiguous store names as errors. Store names used
in expressions must be unique within their app.

### 4. Evaluation lives in the renderer's binding resolution

`resolveBinding` (`packages/renderer/src/renderer.ts`) gets a `case
"reactive"`. This is the load-bearing placement decision: the renderer
re-resolves every binding whenever it produces a snapshot — on state change, on
route change, on query update. A reactive expression therefore **re-evaluates
automatically with no dependency tracking, no subscription machinery, and no
lifecycle events**. Correct on deep link, refresh, and navigation; correct per
client (each client has its own route/state context); no `clientId` routing to
get wrong.

- Expressions are **compiled once and cached** (keyed by source string); only
  evaluation runs per render.
- **An evaluation error must never break rendering.** Throwing expressions
  (including unknown store names at runtime) resolve to the invalid-value
  convention (P104) and the error is reported once per distinct error through
  the existing client-logging/error-forwarding pipeline — not spammed on every
  re-render.

### 5. First-class editor experience

The editor side (separate package) provides a typedInput type `reactive` whose
expand button opens a **code editor dialog** modeled on Node-RED's own JSONata
expression editor: Node-RED's bundled code editor (Monaco in NR ≥ 2.x via
`RED.editor.createEditor`), with

- **completion** fed from the real editor graph: the actual store names of the
  app, the actual `:param` names of the route the node is mounted under,
  and the `routeParam`/`store(`/`query(` API itself;
- **validation** while typing (expression parse) and at deploy (unknown store
  name → node invalid);
- an **inline docs panel** documenting the globals with examples, sourced from
  the durable doc (`docs/nodes/concepts/reactive-expressions.md`) so editor
  help and documentation cannot diverge. Where only the ace fallback editor is
  available, completion degrades gracefully (editor still works, no popup).

### 6. Why this and not the alternatives

- *Template mini-language* (`"Kunde {routeParam.id}"`): subsumed — a JS
  template literal does the same and more; a second syntax would be pure
  redundancy in the type set, the docs, and the validation story.
- *Derived store* (a `ui-store` mode computing itself from other sources):
  heavier concept, still open for the multi-consumer case (several nodes
  reading the same derivation); explicitly **not** decided here. `reactive`
  covers the per-field case and stays out of `ui-store`'s contract.
- *Backend composition via onEnter→function→store*: remains the correct
  pattern **when server-side data is needed** (DB lookups, permissions).
  `reactive` deliberately covers only client-known sources.
- *JSONata against client state*: would avoid JS evaluation, but the owner
  asked for code entry with completion and globals; JSONata-against-state would
  also blur the established semantics of the `jsonata` kind (message-driven,
  P113).

## Consequences

- String/value composition from route params, stores and queries needs **zero
  backend nodes** and is always correct (deep link, refresh, multi-user) —
  the Gedankenspiel "Kunde 42" becomes a one-liner on `ui-text`.
- The canonical type set of P113 grows to **14 types**; P113 carries an
  amendment note and the implementing agent builds the set including
  `Reactive` from the start. The full editor rollout of `reactive` rides on
  P113's canonical helper.
- `packages/schema` gains the `reactive` kind (enum + value shape);
  `packages/renderer` gains compiled-expression evaluation with error
  containment; `resources/lib/editor-common.js` gains the typedInput type +
  editor dialog. Implemented by **P115** (rendering) and **P116** (editor).
- The renderer evaluates flow-author JavaScript per snapshot. Accepted: same
  trust level as a `function` node; compiled-once caching bounds the cost;
  errors are contained by contract (never crash a snapshot).
- Store **names** become part of an app's authoring contract where expressions
  use them (rename = breaking, caught by editor validation). Documented in the
  new concept doc.
- The "derived state in `ui-store`?" open question narrows: per-field derivation
  is solved; only the multi-consumer derived-store case remains open.

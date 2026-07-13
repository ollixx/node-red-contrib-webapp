# ADR 0036: Message mode drives every `msg`-bound field, not only the node's primary field

- Status: accepted
- Date: 2026-07-13
- Refines: P111 (Message mode — the runtime `msg`-binding push). Relates to
  [ADR 0012](0012-binding-ubiquity-every-value-field-offers-bindings.md) (binding
  ubiquity — every value field offers the full type set) and
  [ADR 0015](0015-common-base-fields-and-editor-structure.md) (the `visible`/
  `disabled` base fields).

## Context

The value typedInput offers a **`msg`** type ("Message mode") on **every** field —
including the base fields `visible`/`disabled` (the boolean category). The editor
therefore lets an author set `ui-alert.visible = msg.<prop>` and expect an incoming
message to toggle the alert.

It does not work. Owner-reported (2026-07-13): *"ui-alert und der typedInput für
'Visible': … Ich schicke eine `msg.visible = true` und `msg.visibility = true` und
nix passiert."*

Root cause (traced in `nodes/webapp.js`): the Message-mode runtime push updates
**only the node's single PRIMARY field** — `VIEW_NODE_PRIMARY_FIELD[type]`
(ui-alert → `message`, ui-text → `value`, ui-image → `src`, …).
`viewNodePatchInputHandler` reads *that one field's* `{kind:"msg", path}` source and
overwrites it; it never inspects any other `msg`-bound field. So a `msg`-bound
`visible`:

1. is **never read** at runtime (only `message` is, for ui-alert);
2. the live-patch merge that carries runtime updates into the snapshot lists only
   `value/src/message/rows/items` — **not** `visible`/`visibleIf`;
3. renders **hidden**: at render time a `msg` binding has no message context →
   resolves to `""` → `Boolean("")` = `false` → the alert is not shown.

So `msg` (and, by the same capture-once mechanism, `JSONata`) is a **footgun** on
`visible`/`disabled` and on any non-primary field: offered, but inert (and it
actively hides the element). The `visible` field currently only works with the
**reactive** kinds (Store / Reactive / RouteParam / Query), which the renderer
re-resolves per snapshot.

(Related finding, tracked separately: the imperative `show`/`hide` verbs are a
client-side interaction overlay applied via `interactionInputHandler` when a node
owns the verb — and **ui-alert is not wired into that system at all**
(`INTERACTION_VERBS_BY_TYPE` has no `ui-alert`), so imperative show/hide does not
work on alerts either.)

## Decision

**Message mode applies to every `msg`-bound field of a node, not only the primary
field.** When a message arrives at a view node's input, the runtime updates **each**
field whose saved binding is `{kind:"msg", path}` — reading that field's own
configured message property — and carries the update into the pushed snapshot.

- The per-field `msg` source path is already stored on the binding
  (`{kind:"msg", path:"visible"|"payload"|…}`); the handler iterates the node's
  `msg`-bound fields instead of only `VIEW_NODE_PRIMARY_FIELD`.
- **`visible`/`disabled` are included.** A `msg`-bound `visible` updates the live
  `visible` → `visibleIf`, and the snapshot re-render shows/hides the element. The
  live-patch merge is generalised to carry `visible`/`disabled` (→ `visibleIf`/
  `enabledIf`) alongside the existing binding fields.
- **Boolean coercion for visible/disabled:** the incoming value is coerced to a
  boolean (the field is a boolean-state field), so `msg.visible = true|false`
  toggles correctly; `"true"/"false"` strings are handled.
- The primary-field legacy behaviour (a bare `msg.payload` with no explicit
  `msg`-binding updates the primary field) is preserved for back-compat.
- JSONata-bound non-primary fields follow the same generalisation (evaluated
  against the incoming `msg`), consistent with the primary-field JSONata path.

## Consequences

- **`ui-alert.visible = msg.<prop>` works:** sending `msg.<prop> = true/false`
  toggles the alert live — the behaviour the editor already promises.
- **Consistent Message mode:** any field the editor lets you bind to `msg` actually
  responds to a message, removing the "offered but inert" footgun on every
  non-primary field (not just `visible`).
- **No editor change needed** — the type is already offered; this makes it real.
- Build: `nodes/webapp.js` — generalise `viewNodePatchInputHandler` to iterate all
  `msg`-bound fields (capture each field's source path once), and generalise the
  live-patch merge (`VIEW_NODE_BINDING_FIELDS` / the buildDefinitions patch) to
  carry `visible`/`disabled` and other msg-updated fields. Renderer unchanged
  (reactive resolution already exists; the value now arrives as a literal via the
  push). Tests: an incoming `msg.<prop>` toggles `ui-alert` visibility end-to-end.
- **Alternative rejected:** routing visibility only through the imperative
  `show`/`hide` overlay was rejected — it is client-only interaction state,
  separate from the declarative `visible` model, and would still leave the
  editor's `msg`-on-`visible` promise broken. (Wiring ui-alert into the
  `show`/`hide` verb system is a separate, optional follow-up.)

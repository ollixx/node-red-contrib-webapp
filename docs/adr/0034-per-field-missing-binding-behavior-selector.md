# ADR 0034: per-field selectable behavior when a binding value is missing/unresolvable

- Status: accepted
- Date: 2026-07-13
- Refines / builds on: [ADR 0032](0032-store-subpath-missing-key-is-transient-not-an-error.md)
  (missing key in an object slice → transient empty), the invalid-value marker
  `"?"` (P104) and its planned affordance **P105** (deferred), and the deferred
  Catch-node follow-up (session task “Make framework warnings Catch-node
  catchable”). Relates to [ADR 0006](0006-error-handling-and-logging.md).

## Context

When a bound value cannot be resolved — a `reactive` expression fails, a store
sub-path hits a scalar, a `query:` path is absent — the renderer today has **one**
fixed behavior: emit the invalid-value marker `"?"` and (for real errors) report
once. ADR 0032 already carved out the common *transient* case (missing key in an
object/array slice → empty, silent). But the owner wants the remaining
"not found / unresolvable" outcome to be **the flow author's choice, per field**,
not a single hard-coded policy (owner, 2026-07-13):

> „Vielleicht bieten wir an, dass der user wählen kann, was passiert:
> Default-Ausgabe für ‚nicht gefunden' (das jetzige ‚?', das könnte ein Slot
> sein); error out-port; error werfen und per catch abfangen; ignorieren."

Different fields want different things: a display label may want to silently
ignore (render empty); a critical value may want to raise an error a Catch node
can act on; a dashboard tile may want a visible `"?"` or a custom fallback slot.

## Decision

**Every bindable value field gains an optional `onMissing` behavior selector**
(name TBD in the schema package; e.g. `onMissing` / `missingBehavior`) choosing
what happens when that field's binding is missing/unresolvable:

| Value | Behavior | Notes |
|---|---|---|
| `marker` (**default**) | render the invalid-value marker `"?"` | today's behavior — the zero-config default, so nothing changes for existing flows. Its visual affordance is **P105** (icon/alert instead of a bare `"?"`); a **fallback slot** — a slot the author fills with custom "no value" content — is the richer form of this option. |
| `ignore` | render **empty** (`""`), report nothing | the "absent value" semantics ADR 0032 gives the transient object-slice case, now selectable for any field. |
| `errorPort` | route to the node's **error out-port** | the node gains a dedicated error output carrying the structured error (ADR 0006 shape); the flow wires it to react. |
| `throw` | **throw** so a Node-RED **Catch** node catches it | emit via `node.error(text, msg)` (the catchable 2-arg form) — the delivery mechanism the deferred Catch follow-up defines. |

- **Default is `marker`** (the current `"?"`), so this is purely additive and no
  existing flow changes behavior.
- The selector lives **per field** (finest control — owner-chosen), offered on the
  field's editor row next to its binding. A node-wide or app-wide default is **not**
  part of this decision (rejected: too coarse for the mixed needs above); it can be
  layered later without changing the per-field contract.
- `errorPort` and `throw` reuse the **structured error** (ADR 0006:
  severity/code/message/context{appId,nodeId,op}); the `nodeId` plumbing from ADR
  0032 already carries the origin.
- The **fallback slot** variant of `marker` and the **P105** affordance are the
  richer rendering forms; they are staged after the core selector (see roadmap).

## Consequences

- **The flow author owns the missing-value policy per field** — silent, visible,
  or reactable — instead of a single framework default.
- **Backwards compatible:** default `marker` = today. Existing specs/tests stay
  green; the new behaviors are opt-in.
- **Cross-cutting build, staged:** schema (the `onMissing` enum on the value-field
  contract), renderer (branch on the selector at the invalid-value point in
  `resolveBinding`/`resolveStoreBinding`), editor (the per-field selector control),
  and the node runtime (an error out-port for `errorPort`; the catchable emit for
  `throw`, absorbing the deferred Catch follow-up). The **fallback slot** + **P105**
  affordance are later stages.
- **Supersedes the ad-hoc parts:** the deferred "make warnings catchable" item is
  folded in as the `throw` behavior; P105 becomes the affordance for the `marker`
  default and is re-scoped under this ADR.
- This is a **large** feature: the roadmap splits it into a foundation package
  (schema + renderer core: `marker`/`ignore`) and follow-ups (`errorPort`,
  `throw`/Catch, fallback slot, P105 affordance, editor), sequenced so the
  non-visual core lands first and the richer surfaces are deferred until needed.

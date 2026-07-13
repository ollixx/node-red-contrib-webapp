# ADR 0032: a missing key in an object/array store slice is a transient empty value, not an error

- Status: accepted
- Date: 2026-07-13
- Refines: [ADR 0013](0013-store-binding-subpath.md) (the `store` binding `subPath`).
  Builds on [ADR 0006](0006-error-handling-and-logging.md) (structured error/log
  shape, `context.nodeId`).

## Context

ADR 0013 gave the `store` binding an optional `subPath` and specified that an
**unresolvable** sub-path yields the invalid-value marker `"?"` plus a single
speaking runtime error. It deliberately lumped two cases together as
"unresolvable": (a) the slice is a **scalar** but a sub-path was given, and (b) a
**key is missing** from an object/array slice.

An owner-reported case (2026-07-13, dev app "Entity Editor") exposed that (b) is
wrong. A `ui-store` "Entity Editor" holds an entity being edited, initialised to
`{"name": "Eine Entität"}`. A `ui-text` binds `store:EntityEditor.subPath=_id`.
At startup the entity has **no `_id` yet** (it is assigned only after the entity
is saved), so the renderer logged, on every page load and **without naming the
offending node**:

```
[webapp] Reactive expression failed: Store "Entity Editor": Pfad "_id" nicht
gefunden (Slice ist Objekt) [appId=…] (reactive_expression_failed)
```

This contradicts ADR 0013's own premise (§Context): *"the runtime shape is
mutable — the flow can replace it, or populate it entirely."* A field that will
be populated later is a **normal lifecycle state**, not a misconfiguration. The
general renderer convention for absent values elsewhere is also "resolve empty /
`undefined`, never throw" (item/index/prop scopes, msg/jsonata bindings). The
store sub-path was the over-strict exception.

## Decision

1. **Missing key/index in an OBJECT or ARRAY slice → resolve EMPTY, report
   nothing.** `getValueAtPath(slice, path) === undefined` while the slice is a
   non-null object/array is treated as "no value yet": the binding resolves to the
   empty string `""` (which the display normalizer renders as no content — not the
   `"?"` marker that `undefined` would produce), and **no** reactive error is
   emitted.

2. **A sub-path against a SCALAR slice stays a real error.** A string/number/
   boolean has no addressable property, so `store:x.subPath=foo` on a scalar `x`
   remains a genuine type error → invalid-value marker `"?"` + a speaking message.
   The "no `subPath` but the slice is a whole object/array" case (bound a
   non-displayable value to a text field) likewise stays an error.

3. **Speaking store sub-path errors carry their node + are warnings.** The
   remaining (real) store sub-path errors now:
   - carry the **`nodeId`** of the binding's node (ADR 0006 already reserves
     `context.nodeId`), so the log line and forwarding name the offender instead
     of being anonymous;
   - are surfaced **on that node's status** (yellow ring + a short text) so the
     problem is visible on the canvas;
   - are emitted at **`warn`** severity via the node (`node.warn`) — non-fatal, the
     snapshot still renders.

   General `reactive`-expression failures keep `error` severity but now also carry
   the `nodeId` (red status).

**Deferred:** making these warnings **catchable by a Node-RED Catch node** (which
requires `node.error(text, msg)`, since `node.warn` is not catchable) is left for
a later error-handling refinement (owner, 2026-07-13: *"Das error handling müssen
wir später verfeinern"*).

## Consequences

- The Entity-Editor `_id`-before-save case (and every "field populated later"
  case) renders **empty and silent** — no log spam, no `"?"`.
- Real misconfigurations (scalar + sub-path; whole object bound to a text field;
  sub-path nesting/cycle) still fail loudly — now **on the node** (yellow status +
  `node.warn` with the node id) rather than as an anonymous app-level line.
- Renderer change: `resolveStoreBinding` distinguishes object/array vs scalar on
  the missing-value branch; `ReactiveError` gains optional `nodeId` + `severity`;
  the render loop tags the current node id. Host change: `webapp.js`
  `onReactiveError` resolves the node, sets its status, and reports at the carried
  severity.
- Contract docs updated: `docs/nodes/concepts/stores.md` (§Sprechende
  Laufzeitfehler). The P131 renderer test is updated to the new contract (object/
  array missing key → empty + no error; scalar → error; error carries nodeId +
  warn).
- **Incidental fix:** a stray NUL byte in each of `renderer.ts` and `webapp.js`
  (both inside a reactive-error dedup-key template literal, where a space belonged)
  was removed — it had been making `grep` treat those files as binary.

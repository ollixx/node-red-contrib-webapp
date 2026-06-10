# ADR 0013: store binding gains an optional sub-path (a one-level value binding)

- Status: accepted
- Date: 2026-06-10
- Builds on: P67 (`store` binding by node id), [ADR 0010](0010-reactive-binding-client-expressions.md)
  (`reactive`), [ADR 0012](0012-binding-ubiquity-every-value-field-offers-bindings.md)
  (binding ubiquity). Relates to P104/P105 (invalid-value affordance).

## Context

The `store` binding (`{kind:"store", path:"<ui-store node id>"}`) today reads the
**whole store slice** and the editor shows the **raw node id**. Two owner-reported
problems with a store `monster` whose default is `{"a":false,"b":false,"c":"eins"}`:

1. After picking the store, the field shows the ui-store **node id** — unreadable;
   it should show the store **name**.
2. Reading property `c` is impossible: the binding returns the whole object
   `{a,b,c}` → not renderable → `"?"`. There is **no sub-path**. (Note: the
   `query` binding already supports a path into its result — `store` is the
   inconsistent one.)

The owner's expected model: pick the store (slice fixed, id stored, **name**
shown), then a **path into the slice** (`c`). Refined through discussion into a
richer idea: the path is itself a **bound value** (literal, or derived from a
source), with these decisions locked in:

- The editor must **not** decide anything from the slice's *default* shape — the
  runtime shape is mutable (the flow can replace it, or populate it entirely).
  The default shape is used for **autocomplete suggestions only**; the path field
  is always present and always optional. Correctness is enforced at **runtime**
  with **speaking** errors (caught earlier as the inconsistency: hiding the field
  for a "scalar" slice would rely on the same untrustworthy default shape).
- A dynamic path may be **message-driven** (msg/JSONata → ephemeral, the
  ADR-0012 deploy caveat applies) or **reactive/stable** (routeParam/query/store/
  reactive) or **server-once** (flow/global/env). All three are allowed; the
  stability class is documented, not hidden.
- Infinite recursion is prevented **structurally** (one level), with a runtime
  guard as a backstop (owner: "catch the endless loop").

## Decision

### 1. `store` binding gains an optional `subPath`

```json
{ "kind": "store", "path": "<ui-store node id>", "subPath": <leaf value binding | omitted> }
```

- `path` — the ui-store **node id** (unchanged; chosen via the picker).
- `subPath` — **optional**. A **one-level (leaf) value binding** that resolves to
  a **path string or numeric index** into the slice. Omitted/empty ⇒ the whole
  slice (correct when the slice is a scalar).
- Resolution: resolve the slice (id → statePath → live value), resolve `subPath`
  to a path, then `getValueAtPath(slice, path)`. A path string uses
  dot/bracket notation (`b.label`, `items.0`, `items[0]`) — `getValueAtPath`
  already treats a numeric segment as an index, so "index vs key" is data-driven,
  not a typed choice.

### 2. The `subPath` source set (a value binding resolving to a path)

`subPath` is itself bound, with this source set (owner-chosen):
`string`, `number`, `routeParam`, `query`, `store`, `Reactive`, `JSONata`, `msg`,
`flow`, `global`, `env`. Three **stability classes**, documented in the UI/docs:

| Class | Sources | Behaviour |
|---|---|---|
| reactive / stable | routeParam, query, store, **Reactive** | re-resolves per render; survives deploy |
| server-resolved once | flow, global, env | resolved once per render (server context) |
| message-driven / **ephemeral** | msg, **JSONata** | path comes from a message → the value is lost on deploy/restart, empty until the next message (ADR 0012 caveat — now on the *path*) |

`Reactive` and `JSONata` are both offered: Reactive for **stable** computed paths
(against client sources), JSONata for **message-driven** ones (against the `msg`).

### 3. One level only — recursion impossible by construction

The `subPath` binding is a **leaf**: it may **not** itself carry a `subPath`. So
`subPath:{kind:"store", path:<id2>}` is allowed (reads store 2's whole slice as
the path string — must be scalar), but there is no `subPath` *inside* a
`subPath`. No chain, no cycle. The editor does not offer a sub-path within the
sub-path slot. A path-of-a-path-of-a-path has no real use; one level covers every
listed source.

**Runtime backstop:** the resolver carries a small depth guard (expected depth 1
+ margin) / visited check. If it ever trips, it does **not** overflow the stack —
it resolves to the invalid-value marker and reports a **speaking** error
(`store binding: sub-path nesting too deep / cycle`) through the P104/P105
affordance.

### 4. Editor: button-first, name-first, permissive, runtime-validated

- **Before a store is chosen:** the field shows only a button **"Store
  auswählen"** (opens the app-scoped P68 picker, P117). The button carries the
  **same store icon as the store typedInput** (`fa fa-database`), for visual
  consistency. **No path typedInput yet** — it appears only after a store is
  selected.
- **After selection:** the button stays at the top and becomes **"Store
  ändern"** (same store icon); next to it the store **name** is shown (resolved
  from the id; the raw node id is **not** shown, and no second/decorative glyph —
  the store icon lives on the button, the name beside it). The id is what's
  stored. The field's own label (e.g. "Wert") stays in the panel's left label
  column; the whole store UI lives in the value column.
- **Then a path typedInput** appears — itself a typedInput over the §2 source
  set — **always present once a store is chosen, always optional**. Default type
  `string` with **autocomplete from the slice's default shape** (soft
  suggestions: keys/indices; never a restriction, never hidden).
- The editor makes **no** shape-dependent decisions. Shape correctness is a
  **runtime** concern with speaking errors:
  - `subPath` set but unresolvable (missing key; or slice is scalar) →
    `Store "monster": path "c" not found (slice is the string "eins")`.
  - no `subPath` but slice is a non-renderable object/array →
    `Store "monster": value is an object — add a path to a displayable property`.

### 5. Why not just Reactive

The plain `reactive` binding (`store("monster")[routeParam.key]`) can express most
of this. The store+subPath path is kept because it is **more discoverable** (pick
store → bind a path) and makes `store` **consistent with `query`** (which already
paths). It is a deliberate second composition surface; the overlap is accepted.

## Consequences

- `packages/schema`: `store` binding accepts an optional `subPath` (a leaf binding;
  not allowed on non-store kinds; a leaf may not carry its own `subPath`).
- `packages/renderer`: resolve `subPath` → path → `getValueAtPath(slice, path)`;
  depth guard + speaking invalid-value errors. msg/JSONata sub-paths follow the
  existing message-driven/ephemeral handling.
- `resources/lib/editor-common.js`: store typedInput shows the name + a path
  typedInput (the §2 set) with default-shape autocomplete; permissive.
- Implemented by **P131** (schema + renderer + runtime guard) and **P132**
  (editor: name chip + path typedInput + autocomplete). The store-name display
  (problem 1) and the sub-path (problem 2) are both delivered across these two.
- Docs: `docs/nodes/concepts/stores.md` (sub-path + stability classes),
  `docs/nodes/concepts/editor.md` (the store path typedInput).

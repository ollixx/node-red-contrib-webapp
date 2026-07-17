# ADR 0039: colour field model — `color` = tokens + any colour + binding; `variant` = the token reduction; the per-node choice is backend-driven

- Status: accepted
- Date: 2026-07-17
- Builds on: [ADR 0015](0015-common-base-fields-and-editor-structure.md) (common
  base fields; `color` general, `variant` node-specific, the two **mutually
  exclusive**), [ADR 0012](0012-binding-ubiquity-every-value-field-offers-bindings.md)
  (binding ubiquity), [ADR 0021](0021-display-intents-semantic-backend-mapped.md)
  (semantic intent, backend-mapped).
- Relates to: **P102** (schema-driven capability/backend-support map — `deferred`
  until a second rendering backend exists). Audit source: the ui-icon conformance
  pass (P235, done) + the owner's follow-up questions (session 2026-07-17).

## Context

ADR 0015 established `color` as a **general** base field on every node and kept
`variant` (semantic colour) node-specific, with the two **mutually exclusive**:
a node with `variant` shows `color` as N/A ("uses semantic Variant"). What ADR
0015 never specified is **what the `color` control actually offers**. Left
unspecified, it degenerated:

- The shared base-field control (`installBaseFields`) renders `color` as the
  *generic* value typedInput on `#node-input-colorBinding` — the full canonical
  binding set (ADR 0012), so `color` **is** bindable on ~30 nodes. But it offers
  **no theme tokens** and **no colour selector**: the author types a raw literal
  string (`#ff0000`, `red`) or binds it.
- **`ui-icon` opted out entirely.** It sets `omit: ["color","size"]` +
  `variant: false` in `installBaseFields` and **overrides the schema** —
  `color: z.string().optional()` instead of the base `color: bindingSchema.optional()`
  (JS last-key-wins inside the single `.extend()`; the schema comment names this
  explicitly: *"ui-icon's plain-string `color`"*). Its editor is a bare text input
  (`placeholder="e.g. #ff0000 or red"`). So on ui-icon the colour is **not
  bindable at all** — a deliberate downgrade against ADR 0012/0015, and an
  anomaly rather than the norm.
- Separately, `ui-icon`'s **icon name** is binding-capable in the *schema*
  (`iconFieldSchema = union([string, iconValueSchema, bindingSchema])`) and the
  renderer resolves a bound icon live (measured in P235: state binding + store
  `replace` via SSE). But the editor helper `installIconField` is a **text input +
  "Icon wählen…" dialog**, not a typedInput — the dialog writes a *literal*. There
  is **no UI path to bind the icon name**. The schema and runtime are ahead of the
  editor, so a supported capability is unreachable for the author.

The owner (2026-07-17) named the intended semantics: **`variant` is the reduction
to the usual theme tokens; `color` offers those same tokens *and, beyond them,
any colour*.** `color` is therefore a **superset** of `variant`. The owner further
observed that it is **not verified** whether this separation is cleanly held
across the nodes — and that the question is **especially backend-relevant**: with
other backends, an element may not support both.

Two things are explicitly **not** in question:

- **`size`** is deliberately not a value-binding. The schema says so in place:
  *"`size` is intentionally NOT here: it is a static enum token (COMPONENT_SIZES /
  per-node scale) declared per-node where applicable, not a value-binding."* It
  stays a static per-node token.
- **Mutual exclusivity** (ADR 0015 §1) is not reversed — a node offers `variant`
  **or** `color`, never both.

Also noted, because it bounds the model: a `variant` vocabulary is **not purely
colour** on every node. `BUTTON_VARIANTS` carries `ghost`/`link`, ui-tabs carries
`line`/`contained`/`pills` — appearances a colour cannot express.

## Decision

### 1. `color` is the superset control: tokens + any colour + binding

Wherever a node's colour is served by `color`, the field offers **three** author
paths in **one** standard, shared control:

1. **Theme token** — the semantic vocabulary (`primary`, `success`, `warning`,
   `danger`, `neutral`, …), resolved against the app's design tokens.
2. **Any colour** — the usual colour selector (HSB / RGB / web values).
3. **Any binding kind** — the full canonical set per ADR 0012 (state/store/query/
   routeParam/msg/flow/global/jsonata/env), as today.

**Representation.** The token is its own typedInput **type**, persisted as a
**prefixed literal** — `token:<name>` — mirroring the proven `asset` type on
`ui-image.src` (a distinct type that persists as `literal` `asset:<id>` and is
resolved at runtime). The renderer maps a `token:*` value to the design-token CSS
custom property; a free colour is emitted as-is. This keeps the persisted shape a
plain binding object (no new schema kind) and keeps token-vs-colour
**unambiguous** — a bare literal `primary` is *not* a valid CSS colour and must
never be emitted raw.

### 2. `variant` is the reduction — kept where the backend needs it

`variant` remains the node-specific reduction to the usual theme tokens. It is
justified where **either**:

- the backend element has a **native variant concept** (e.g. a Shoelace button's
  `variant` attribute) that a free colour cannot drive, **or**
- the node's vocabulary carries **non-colour appearances** (`ghost`/`link`,
  `line`/`contained`/`pills`) that a colour cannot express.

### 3. The per-node choice (`variant` vs `color`) is backend-driven and must be reviewed

Per node, the colour is served by `variant` **or** by `color` — and the choice
must be **justified by what the backend element actually supports**. A node must
not offer a control the backend cannot honour. Whether today's assignment is
clean is **unverified**; it is reviewed as its own package, which records the
per-node choice **and its rationale** node-locally (the ADR 0015 §3 form), in a
shape the central capability map can absorb later. The review does **not** wait
for **P102** (deferred — a capability map is single-column until a second
rendering backend exists); it produces exactly the per-node evidence P102 would
later consume.

### 4. `ui-icon` drops its override

`ui-icon` stops omitting/overriding the base colour: the `color: z.string()`
schema override and the `omit: ["color"]` opt-out are removed, so the base
`color: bindingSchema.optional()` and the standard control apply. **Back-compat:**
a deployed plain-string `color` is accepted and migrated to a literal binding on
open, exactly as P146/P149/P151 did for their fields — no deployed flow loses its
colour.

### 5. The icon name is bindable in the editor; the picker stays

`ui-icon.icon` becomes a **typedInput** carrying the canonical binding kinds, and
the **"Icon wählen…" dialog remains** as one input path (it writes a literal, as
today). Precedent: `ui-image.src` already combines a picker (`asset` → media
dialog) with the full binding-type set in one control. Schema and renderer already
support this (measured in P235) — this closes an **editor-exposure gap**, not a
runtime gap.

## Consequences

- **ADR 0015 is refined, not reversed.** Its §1 mutual exclusivity and its N/A
  hint ("uses semantic Variant") stand. What changes: `color` is no longer "a
  general colour" left to interpretation — it is specified as tokens + any colour
  + binding, delivered by one shared control.
- **The control upgrade is additive and lands wherever the base colour renders**
  (~30 nodes) — it adds two new author paths (token, colour selector) to an
  existing bindable typedInput. Existing literal and bound values keep working
  untouched. That breadth is inherent to a shared helper and is the point of
  "standardised"; it is *not* a licence to reclassify variant-vs-color on those
  nodes — that is §3's review.
- **`ui-icon` gains a bindable colour** — a real behaviour change on that node
  (colour can now be driven by state/store/query), plus tokens and a colour picker.
- **`ui-icon` authors can bind the icon name** — the capability the runtime already
  had becomes reachable.
- **The variant/color assignment may be wrong on some nodes today.** §3's review
  can reclassify nodes; a reclassification is a breaking field change and gets its
  own package with a migration — this ADR does not pre-approve any specific move.
- **A drift guardrail is warranted.** Nothing today prevents a node from
  re-introducing a non-bindable colour override — that is precisely how ui-icon
  drifted from ADR 0012/0015 without any check noticing. The existing tripwires
  catch *documentation* drift (`check:specs`) and cross-node *naming* drift
  (`check:fields`, ADR 0038), but not "a node downgrades a base field's type".
- **`size` is untouched** and stays a static per-node token.

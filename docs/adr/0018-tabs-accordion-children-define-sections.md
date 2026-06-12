# ADR 0018: ui-tabs / ui-accordion — children define the sections (no config array)

- Status: accepted
- Date: 2026-06-12
- Builds on: [ADR 0017](0017-ui-repeat-template-container-render-time-scope.md)
  (render-time scope / ui-repeat — the dynamic case rides on this),
  [ADR 0014](0014-mount-picker-two-column-tree.md) (mount picker two-column
  tree), the mount-not-wires invariant. Resolves concept P142.

## Context

`ui-tabs` (and `ui-accordion`) today define their sections via a **config array**
(`tabs` JSON: `[{id,label}]`); a child mounts into the derived slot `tab:<id>`.
Two problems (P142):

1. **Static:** the derived tab slots do not appear in the mount picker.
2. **Dynamic:** if the sections come from store/query data, the slot count is
   only known at runtime — the static picker can't offer them.

The owner proposed (2026-06-12) inverting the source of truth: the **mounted
children define the tabs**, not an editor option. A reversed-link alternative
(parent picks a target container per tab) and a keep-the-config alternative were
also on the table.

Key correction surfaced in the discussion: for **static** tabs the slots are
**not** runtime — they are fully known at edit time (they're in the config). That
half is a mere picker gap. The genuinely dynamic case is **data-driven** sections.

## Decision

### 1. Children define the sections (Model 1a)

`ui-tabs`/`ui-accordion` **derive one section per child**, not from a config
array. The `tabs` (and accordion `sections`) JSON field is **removed**.

- A new thin container child carries the section's own metadata: **`ui-tab`**
  (for `ui-tabs`) and **`ui-accordion-section`** (for `ui-accordion`), each with
  `label`, optional `icon`, `order`, plus a **default slot** for its content.
- `ui-tabs` accepts `ui-tab` children; `ui-accordion` accepts
  `ui-accordion-section` children. The **mount is the declaration** — no second
  source of truth, **no orphan problem** (a child cannot point at a deleted tab
  because the child *is* the tab).
- Child **names/ids must be unique** within the parent (validation); the id is
  the slot key and the token `activeTab` carries.

### 2. Dynamic sections dissolve into ui-repeat

Data-driven tabs/sections are **not** a bespoke "dynamic slot" mechanism. They
are a **`ui-repeat` that emits `ui-tab` children** (one per data item, label from
`item.<field>`, keyed by the repeat key). The dynamic-slots problem **falls out
of ADR 0017** — no new runtime-slot binding is introduced.

### 3. Rejected alternatives

- **Reversed link (1b)** — parent configures a target container per tab. Rejected:
  breaks the uniform mount direction (everywhere else the *child* declares its
  mount); two sources, confusing special case.
- **Keep config array (2)** — cheaper short-term but keeps the dual source of
  truth, the orphan-validation burden, and still needs a *separate* dynamic
  mechanism. Rejected in favour of the unification in §2.

### 4. activeTab / active section

`activeTab` (two-sided binding, P155/ADR 0012) now carries the **child id**.
Default = first child by `order`. An invalid value falls back to the first child.
Accordion's open/closed section state is analogous.

### 5. Migration

Existing flows with a `tabs` array are migrated to `ui-tab` children: one child
per array entry (id/label preserved), existing `tab:<id>` child mounts re-pointed
to the new child's slot. The migration is a one-shot mapping, specified in the
implementation packages.

## Consequences

- **Resolves P142.** Implementation wave: P167 (schema: `ui-tab` + ui-tabs
  derives slots from children, drop `tabs` JSON, migration) → P168 (renderer +
  ui-tabs/ui-tab editor + validation + browser proof) → P169 (mirror for
  ui-accordion + `ui-accordion-section`) → P170 (dynamic via ui-repeat — capstone,
  needs the ui-repeat wave P165).
- **Breaking change** to two already-built nodes + two new child nodes; the spec
  docs (`ui-tabs.md`, `ui-accordion.md`) are rewritten to the children-define
  model and gain `ui-tab.md`/`ui-accordion-section.md`.
- The static **mount-picker gap** dissolves: under 1a, mounting into `ui-tabs`
  means "drop a `ui-tab` (become a tab)"; the picker shows the new containers via
  the normal slot enumeration (P135) — no special tab-slot logic needed.
- Reinforces the mount-not-wires invariant and the structure-first model; aligns
  tabs/accordion with how `ui-repeat` already treats children as a template.

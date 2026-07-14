# ADR 0038: field-model consistency — reference naming, legacy-carrier cleanup, and a drift guardrail

- Status: accepted
- Date: 2026-07-14
- Relates to: [ADR 0012](0012-binding-ubiquity-every-value-field-offers-bindings.md)
  (binding carriers), [ADR 0013](0013-store-binding-subpath.md),
  [ADR 0027](0027-input-value-binding-is-bidirectional-value-read-writeto-write.md)
  (`writeTo` supersedes the input `storeId`/`path` pair). The audit source is the
  cross-node field matrix (session 2026-07-14).

## Context

A cross-node audit of all 45 ui-nodes × their fields (built from the `defaults`
blocks, verified: 127/128 fields are consumed in schema/runtime/renderer — the
one exception, `optionsField`, is a legitimate editor helper) surfaced that the
field model is internally **inconsistent** in ways that make it hard to tell
whether a node has the "right" set of fields. `check:specs` enforces
defaults↔spec per node, but nothing enforces **cross-node coherence**. The
verified findings:

1. **`parent` is misnamed.** It holds the **owning app id** (`parent:"customersApp"`
   on every non-app node — view and logic alike), not a slot-parent. The render
   slot is the separate `mount` field. `parent` reads as hierarchy but means
   "belongs to app".
2. **Dead legacy field on 8 input nodes.** `storeId` + `path` are the pre-ADR-0027
   write target; the code calls them the *"dead storeId/path pair"* — the live
   mechanism is `writeTo`. They persist only for open-time migration.
3. **`rows` is overloaded.** `ui-textarea.rows` = a number (line count / height);
   `ui-table.rows` = a data binding. Same name, unrelated concepts.
4. **Reference-by-id naming is inconsistent:** `store` (state nodes) vs `storeId`
   (input legacy); `layout` (ui-app / ui-breadcrumb) vs `layoutId` (ui-route /
   ui-dialog / ui-container) — both reference a layout; plus `routeId`,
   `definitionId`, `selectedId`. Some references carry the `Id` suffix, some the
   bare concept name.
5. **The legacy `<base>Path` carrier was cleaned unevenly.** After the ADR-0012
   binding migration, the old `<base>Path` twin was removed from most nodes but
   left on a few: `visiblePath` on 2/31, `disabledPath` on 1, `labelPath` on 2/14,
   `valuePath` on 10/11, etc. Plus legacy `itemsJson`/`optionsJson` and pagination's
   `page`/`currentPagePath` aliases linger on some nodes only.

(The per-widget "active selection" names — `activeTab`/`activeStep`/`currentPage`/
`openSection`/… — are **role-distinct** (a tab is not a page) and are **kept**;
only their legacy aliases are in scope.)

## Decision

Adopt a **consistent field-model contract** and enforce it, then normalise toward
it. All renames/removals are **back-compatible**: the runtime keeps reading the
legacy field (open-time migration) while the canonical field becomes the default.

1. **`parent` → `app`** on all non-app nodes — the field names the owning app.
   `mount` stays the render slot. (A node still declares *either* `mount` or
   `app`; logic nodes carry `app`, rendering nodes carry `mount` and, if needed,
   `app` for O(1) scoping.)
2. **One store-reference name: `store`.** State nodes already use it; the input
   nodes' dead `storeId`/`path` are removed from `defaults` (open-time migration to
   `writeTo` stays).
3. **Reference-by-id fields use the bare concept name** (the value *is* the id),
   matching `store`/`mount`: `layout` (not `layoutId`), `route` (not `routeId`),
   `definition` (not `definitionId`). `selectedId` stays (it is a *selected value*,
   not a node reference).
4. **Resolve the `rows` collision:** rename `ui-textarea.rows` (height) to an
   unambiguous name (e.g. `lines`), so `rows` means only "data rows".
5. **Sweep the legacy carriers uniformly:** remove the residual `<base>Path` twins,
   `itemsJson`/`optionsJson`, and the pagination `page`/`currentPagePath` aliases
   across **all** nodes — the binding path (ADR 0012) is canonical; open-time
   migration remains the bridge.
6. **Guardrail:** a read-only tripwire (`pnpm check:fields`) that enforces
   cross-node conventions — carrier-twin consistency (`<base>Binding` present ⇒ no
   `<base>Path` default), no re-introduction of a removed legacy field, reference
   fields follow the bare-name rule — with a curated allowlist during rollout,
   plus a documented **field-naming convention** in `docs/nodes/concepts/`.

## Consequences

- **The model becomes legible:** a field's name tells its role (`app` = ownership,
  `mount` = slot, `store` = a store ref), and the same concept has one name.
- **Back-compatible:** legacy flows keep loading (open-time migration); only the
  canonical field is written going forward. `check:specs` stays green as specs are
  updated in lockstep.
- **Big, staged migration.** Renames touch many nodes + their specs + the runtime
  migration paths. Sequenced into packages: a **guardrail + convention** foundation
  first (documents the target, stops new drift), then the **rename normalisation**
  (`parent`→`app`, id-suffix) and the **legacy sweep** (`*Path`/`*Json`/dead
  `storeId`/aliases + the `rows` collision) as deliberate, back-compat migrations.
- **The audit itself** (the 45×128 matrix + findings) is the reference for what
  "consistent" means and is linked from the convention doc.

# ADR 0003: Live Node-RED app, no preview backend

- Status: accepted
- Date: 2026-05-31
- Supersedes: the **transport/preview slice only** of [ADR 0002](0002-web-component-rendering-and-theming.md) — the snapshot transport, the thin-client preview, and runtime-executed actions. ADR 0002's rendering and theming decisions (the framework-agnostic `RenderSnapshot`, the Shoelace Web Component adapter, design tokens, and the P26 shared serializer) stay valid and are reused.

## Context

After P23–P28 the running app exposed a fundamental design error: the runtime had
been turned into a **fake backend**. The browser POSTed an `actionId`, and the
runtime executed that action — including create/update/delete of records — against
an in-memory `previewState` / `previewQueries` simulation, with **no flow and no
wiring involved**. P20a even invented `submit` and `remove` action types with a
`collection` field; `applySubmitAction` / `applyRemoveAction` in `nodes/webapp.js`
inserted, updated and deleted business records inside the framework. P27
"de-hardcoded" by generalising that CRUD engine rather than removing it, and P28
produced an example flow with **zero wires** — only possible because the CRUD was
faked in the runtime.

All of this contradicts principles that were written down before the drift:

- `docs/nodes/concepts/events.md` — "Der Flow ist der einzige Ort für Logik." The
  flow is the **only** place for logic. There is no automatic event→action link;
  the flow decides.
- `docs/nodes/concepts/actions.md` — actions change **interaction state only**
  (navigate / openDialog / show / enable / focus / reset). A `ui-action` never
  writes a store or a collection. Business data lives in `ui-store`, fed by the flow.

## Decision

1. **Zero business logic in nodes or in the runtime.** The UI nodes and
   `nodes/webapp.js` are 100% domain-agnostic. You assemble *any* app — not just a
   customer CRM — out of generic nodes. All domain logic (create/update/delete,
   validation, persistence) lives in the wired Node-RED flow (function / db / http
   nodes). **The app is its wiring.**

2. **The action vocabulary is interaction-only.** The invented data actions
   `submit` and `remove`, and their `collection` / `keyField` / `draftPath` /
   `dialog` config fields, are removed from the schema, the `ui-action` node config,
   and the editor. The remaining action types are exactly the documented
   interaction set in `actions.md`: `navigate`, `show` / `hide`, `enable` /
   `disable`, plus the output-port `trigger`. (`openDialog` / `closeDialog`,
   `focus`, `reset` from the doc are expressed today via `show` / `hide` on the
   dialog target and remain on the roadmap; nothing in this set touches business
   data.)

3. **Client → Server is an event, not an action.** The browser reports *what
   happened* (a raw event `{appId, clientId, event, sourceId, params}`); it never
   names or runs an action. The runtime emits that event as `msg.ui` out of the
   originating node's output port into the flow. (Implemented in P30.)

4. **Server → Client is a live push, not a request/response preview.** Real node
   state (`ui-store` / `ui-query`), mutated only by flow messages, is the single
   source of truth and is pushed to connected clients. (Transport choice and
   implementation in P31; the preview simulation is deleted in P32.)

This ADR (P29) records the reversal and removes the domain-bearing action types
and their runtime handlers. The transport rebuild (P30–P31) and the deletion of the
preview apparatus (P32) follow as their own phases; the live push transport choice
will be recorded here when P31 makes it.

## Consequences

- The renderer, the Shoelace adapter + design tokens, and the shared serializer are
  kept unchanged — only the **state source** and the **transport** were wrong.
- `applySubmitAction` / `applyRemoveAction` and all record insert/update/delete
  logic are gone from the runtime; a `ui-action` can no longer mutate query or
  collection data.
- The `examples/customers-crud` example must be rebuilt as a real wired flow whose
  CRUD lives in plain function nodes (P33). Until then its `saveCustomer` /
  `deleteCustomer` actions are interaction-only stubs (close dialog / navigate).
- Phases P20a (the submit/remove slice), P22, P27 and P28 are kept as historical
  `done` but are corrected by P29–P33.

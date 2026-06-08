# Test conventions: behaviour = classic, E2E = editor + render

Owner policy (audit 2026-06-08, roadmap P81–P86). This is the contract the
per-category behaviour phases (P82–P86) build on.

## The split

| Layer | Covers | Tooling |
|---|---|---|
| **Classic behaviour test** | Every node *feature*: input-message handling, validation, output/event emission, store/query/action/navigation, interaction verbs, pass-through. | `vitest` in `packages/*/test/*` |
| **E2E** | ONLY the editor property panel and correct client rendering. | Playwright in `tests/e2e/*` |

A node's runtime behaviour belongs in **fast classic tests**, not E2E. E2E is
expensive and flaky; reserve it for what genuinely needs a browser (the editor
config UI) or a real render (DOM output). When a behaviour is fully covered by a
classic test, the corresponding E2E should be slimmed to editor+render only.

## How classic behaviour tests work

They drive the **real** registered handlers from `nodes/webapp.js` (via the
`runtimeNodeRegistry`) and observe the two observable effects of a handler:

1. **Output messages** on the node's port — the `send(msg)` callback.
2. **SSE pushes** to connected clients — frames written to the client's `res`.

No HTTP server, no browser. Use the shared harness so every phase asserts the
same way.

## The shared harness — `node-behaviour-harness.ts`

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NodeBehaviourHarness } from "./helpers/node-behaviour-harness";

const h = new NodeBehaviourHarness();          // defaults appId = "harnessApp"
beforeEach(() => h.reset());                    // clears state, registers a bare ui-app
afterEach(() => h.teardown());                  // restores RED to undefined
```

### Driving an input handler (msg-in → effects)

```ts
it("ui-input msg.payload sets value and pushes a patch", () => {
  const client = h.connectClient("c1");                  // fake SSE client
  const node = h.makeNode("ui-input", "nameField");      // fake node
  const { sent, done } = h.drive("ui-input", node, {
    payload: "Acme",
    ui: { clientId: "c1" }
  });

  // SSE pushes:
  expect(client.eventsOfType("snapshot")).not.toHaveLength(0);
  // Output port:
  expect(sent[0]).toBeDefined();
  expect(done).toHaveBeenCalledTimes(1);
});
```

`drive(type, nodeOrId, msg)` returns `{ send, done, sent }`:
- `send` / `done` are the vitest mocks passed to the handler.
- `sent` is the list of output messages, in order (`send.mock.calls[i][0]`).
- `nodeOrId` may be a node object (from `makeNode`) or an id string (a default
  node is built for you).

### Inspecting SSE pushes

`connectClient(clientId)` returns a `FakeSseRes`:
- `.events()` — all parsed `{ event, data }` frames.
- `.eventsOfType("command")` — frames of one event name
  (`"snapshot"`, `"command"`, `"error"`, …).

### Interaction verbs

The shared `interactionInputHandler(ownedVerbs)` factory means a node pushes an
SSE `command` only for verbs it OWNS, and passes through otherwise:

```ts
const client = h.connectClient("c1");
h.drive("ui-dialog", "editDialog", { ui: { clientId: "c1", action: { type: "open" } } });
expect(client.eventsOfType("command")[0].data)
  .toMatchObject({ command: { type: "open", target: "editDialog" } });
```

The verb-ownership table is re-exported as `INTERACTION_VERBS_BY_TYPE` and the
factory as `interactionInputHandler` for ownership/delegation assertions.

### Nodes that need a compiled definition

Store/query and similar handlers read a `mapConfig` output. Build it and attach
it to the node:

```ts
const def = h.mapConfig("ui-store", { id: "store1", parent: h.appId, statePath: "x" });
const node = h.makeNode("ui-store", "store1", def);
h.drive("ui-store", node, { ui: { store: { id: "store1", op: "set", path: "x", value: 1 } } });
```

### App-level config (error forwarding, etc.)

Pass config to `reset` / `registerApp` to register the app through the real
`ui-app` `mapConfig`:

```ts
beforeEach(() => h.reset({ forwardErrorsToClient: true, forwardErrorMinSeverity: "warn" }));
```

### Client → server event ingest (P30 path)

For the raw browser-event path (`{ clientId, event, sourceId, params }` →
`msg.ui` on the originating node's output port):

```ts
const defs = h.buildDefinitions([
  { type: "ui-app", id: "evtApp", root: "evtApp", layout: "app", z: "f1" },
  { type: "ui-button", id: "saveBtn", mount: "evtApp.content", label: "Save", z: "f1" }
]);
const { result, emitted } = h.dispatchClientEvent(
  ["saveBtn"],
  { clientId: "c1", event: "click", sourceId: "saveBtn", params: {} },
  defs
);
expect(emitted.get("saveBtn")![0]).toMatchObject({ event: "click", sourceId: "saveBtn" });
```

## Escape hatch

`webappTest` re-exports the raw `webapp.__test__` surface for the rare export the
harness does not wrap. Prefer the harness methods; if you find yourself reaching
for `webappTest` repeatedly, add a method to the harness instead so the next
phase benefits.

## Reference

`p81-node-behaviour-harness.test.ts` is the canonical worked example. The
patterns it generalises live in `p59-interaction-handlers.test.ts`,
`p56-error-forwarding.test.ts`, and `p30-client-events.test.ts`.

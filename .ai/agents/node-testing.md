# Node-RED node testing standard (agent-os)

Mandatory for every `ui-*` node we build. Coding agents implementing a
node-specific phase **must** follow this. It is the test counterpart to the
node **requirement docs** under `docs/nodes/**` (those define WHAT the node must
do; this defines HOW it is proven).

## Scope and the "fresh tests" rule

- **Per node-specific phase: write the node's tests COMPLETELY NEW from this
  standard, and DISCARD the node's existing tests.** The old per-node specs are
  presence/"no-crash" tests and are not trustworthy — do not extend or trust
  them, replace them.
- This rule applies **only** to a node's own tests. **Cross-cutting / feature
  tests** (e.g. `pXX-*.test.ts`, shared transport/render-parity/error-model
  tests) are **out of scope** here — do not throw those away.
- A test must assert an **observable outcome** (rendered attribute / DOM
  structure / emitted message / store value), never mere DOM presence or "did
  not crash". Mutation rule: a test must turn **red** if the feature is removed.
  Comments that document a known bug as acceptable ("imperfect", "deferred",
  "renders without crashing") are **forbidden** — a known bug gets a failing
  test or a bug phase, never a green pass.

## Test kinds

- **Unit tests** for interfaces, classes, and code functions (schema, mapConfig,
  serializer, handlers) — fast, in `packages/*/test/*`.
- **Functional tests via Playwright.** We do **not** use
  `node-red-node-test-helper`; functional/editor/rendering behaviour is driven
  through the real editor + running app with Playwright.

## Per-node test flow construction

Build a dedicated test flow per node:

- At minimum **`ui-app` + the node itself**; add further `ui-*` nodes where it
  makes the test meaningful.
- If the node has **any** typedInput field that offers type **"Store"** → the
  flow must include a **`ui-store`**.
- Likewise for **"Query"** → include a **`ui-query`**.
- Likewise for **"PageParams"** → include at least one **`ui-route` with a URL
  parameter**, so the param path can be exercised.
- For testing **incoming and outgoing messages**, wire **`inject`/trigger** and
  **`debug`** nodes to the node's input/output ports.

**Flow hygiene (check after creating OR changing a test flow):**
- No wrong or unnecessary properties in `flows.json`.
- The flow must start with **zero validation errors**.
- Generate sensible **defaults for every field** the node does not set itself.

## What to test

### Node-level
- The node produces **no errors at Node-RED startup**.
- The node **appears in the editor** and is **not reported as "missing"** by
  Node-RED.

### Per field of the node
- **Default value** is verified (where a default is defined).
- All **options / types** appear; the **correct editor controls** are visible.
- All controls for the field can be **opened and operated**.
- **typedInput fields:**
  - Exercise **every type**.
  - For each type, test **sensible boundary values**.
  - **"Store"**: exercise **CRUD** on the field's values; verify the values in
    the store **actually match** (CRUD-correct).
  - **"Query"**: verify the value **matches the query**.
  - **"PageParams"**: test with **at least two different URLs**; boundary cases
    (empty param, wrong-type param, …).
- Set **every valid value** (for enums etc.) once and test the resulting effect.
- For each such variant, verify **in the frontend**:
  - the elements are **rendered correctly** (not merely present in the DOM);
  - **size and colour differences are tested** (the `size` and `variant`
    properties);
  - frontend values **match** those in the editor (or incoming messages);
  - **events are emitted and arrive in the backend**;
  - **actions from the backend arrive in the frontend**, raise no errors, are
    processed as expected, and the **result is verified**.
- Exercise **all sensible incoming messages**; test boundary values where useful.
- Verify **all validations** on invalid input.
- Verify the **emitted messages for every event**.
- Exercise **all possible actions** and test them in the frontend (see above).
- Check whether fields have **dependencies on other fields**; add meaningful
  tests to guarantee that behaviour.

### Layout nodes
- Verify child elements are **positioned and laid out correctly** and still
  render correctly (test with **one** variant only).

## Keep the suite from exploding

Despite the breadth above, **keep permutations minimal** for expensive fields
with many options. Pick representative values + boundaries; do **not**
combinatorially explode types × options × variants. Favour a few high-signal
cases over exhaustive matrices.

## Per-node test catalogue (`.md`)

For every node, maintain a **`.md` file** that briefly lists the node's tests and
their **test goal(s)**. It is for **human review** and **must be kept current**
whenever the tests change.

> Location convention: alongside the node's tests (e.g.
> `tests/e2e/nodes/<category>/<node>.tests.md`), linked from the node's
> requirement doc.

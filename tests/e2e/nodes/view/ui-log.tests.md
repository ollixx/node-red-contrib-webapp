# ui-log — Test Catalogue

Phase: **P246** (conformance light pass — added test catalogue, removed the anomalous
editable `uiId` editor field, added the `collapsed=true` measured E2E, enriched inline
help with the `forwardErrorsToClient` prerequisite). Node origin: **P57**.

Spec: `docs/nodes/feedback/ui-log.md`.

`ui-log` has **no input/output ports** and renders as an `sl-details` panel
(`[data-webapp-log]`). It subscribes to the parent app's SSE `error` channel — visible
entries require the parent `ui-app` to set `forwardErrorsToClient: true` (plus a
matching `forwardErrorMinSeverity`). All E2E flows use the inject → function →
`ui-store` (unknown op) pipeline to provoke a backend runtime error that is forwarded
over SSE.

## E2E tests (`ui-log.spec.ts`)

| Test | Goal |
|---|---|
| renders sl-details panel with data-webapp-log attribute | The node renders as an `sl-details` panel carrying `data-webapp-log="<uiId>"` (proves render pipeline + stable uiId from runtime `getUiId`, no editor field). |
| is open (expanded) by default when collapsed=false | `collapsed:false` ⇒ the `sl-details` panel has the `open` attribute (starts expanded). |
| starts collapsed (no open attribute) when collapsed=true | `collapsed:true` ⇒ the `sl-details` panel starts **collapsed** — no `open` attribute and its measured `.open` state is `false`. Distinguishable from the collapsed=false case. |
| a backend error appears as a log entry in the panel | An error pushed over the SSE `error` channel is appended as one `.webapp-log-entry` and its text names the failed store operation (backend→frontend forwarding works). |
| minSeverity filter suppresses entries below the threshold | With `minSeverity:"error"`, an `error`-level entry meets the threshold and is shown (severity filter honours the configured floor). |
| maxEntries caps the number of displayed entries (oldest dropped) | With `maxEntries:2`, firing three errors leaves exactly two entries (FIFO cap drops the oldest). |

---
id: P30
title: "Real Client→Server events — UI nodes emit msg out their output port"
epic: aspects/state
status: done
dependencies: [P29]
---
# P30 — Real Client→Server events — UI nodes emit msg out their output port

## Result

**Delivered:** User interaction now emits a real Node-RED event on the originating UI node's OUTPUT port, per docs/nodes/concepts/events.md — the browser reports WHAT HAPPENED and never names or runs an action. Added dispatchClientEvent to nodes/webapp.js: it ingests a raw event {clientId, event, sourceId, params}, routes it to the originating node via RED.nodes.getNode(sourceId), and emits msg.ui {appId, clientId, event, sourceId, params} on that node's output port — the runtime takes no domain action (no preview mutation, no event→action link). For rowSelect/rowAction it enriches params.row from a read-only snapshot render. POST /webapp/:appId/event was repurposed from action-dispatch to event-ingest (the old applyPreviewAction call and actionId requirement are gone; it now echoes the emitted message + the current unchanged snapshot). The shared serializer now tags every enabled button with click reporting independent of any action, table rows with rowSelect, and every value control wrapper with data-webapp-source + data-webapp-event=change; the thin client sends the raw event shape with a per-tab clientId and has both a click and a change listener.

**Stats:** 5 src/asset files (webapp.js, webapp-serializer.js, webapp-client.js + 2 e2e specs rewritten), 1 new unit suite (p30-client-events, 6 tests). Unit suite: 178 tests across 19 files, 0 failures. pnpm validate (build+lint+test+roadmap) green.

**Notes:** dispatchClientEvent is event-type agnostic — it emits whatever event the browser reports for any node with a send(), so the full documented catalogue (click/rowSelect/rowAction/change/onEnter/onLeave/onOpen/onClose) is supported by construction; a unit case locks change/onEnter/onLeave routing. Browser-side onEnter/onLeave/onOpen/onClose are NOT yet emitted because the thin client has no SPA router (navigation is still full-page, dialogs open via ?dialog=); wiring those lifecycle emitters belongs with the live channel in P31. data-webapp-action is still emitted on buttons/rows for the legacy no-JS GET fallback (removed in P32); the preview endpoints (/snapshot, /events, /reset, /action/:actionId) and applyPreviewAction also remain for P31/P32 to dismantle. The P22 + customers-crud E2E specs encoded the now-removed preview-action round-trip (click→runtime opens dialog) and were rewritten to assert the P30 contract at the network level: a click POSTs {clientId,event,sourceId} with no actionId and mutates no runtime state. 8 unrelated E2E failures (p16d/parent-selector/editor-mount-options editor-registration timing + p21 detail-route content) remain — confirmed present on the clean pre-P30 baseline via stash+rebuild, out of this phase's scope (see friction-log).

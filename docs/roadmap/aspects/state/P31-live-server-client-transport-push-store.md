---
id: P31
title: "Live Server→Client transport — push store/action updates to clients"
epic: aspects/state
status: done
dependencies: [P30]
---
# P31 — Live Server→Client transport — push store/action updates to clients

## Result

**Delivered:** A one-directional Server-Sent Events channel (GET /webapp/:appId/stream) pushes flow-driven ui-store snapshot updates and ui-action interaction commands to connected browsers in real time, honouring msg.ui.clientId targeting and the P15 per-client state model. The served page renders from real node state via the P26 serializer and re-renders on pushes via the keyed morph — no client poll. The browser subscribes with a native EventSource (auto-reconnect; the server re-pushes the snapshot on every (re)connect, subsuming P15 reconnect-sync).

**Stats:** 1 SSE endpoint + push apparatus in nodes/webapp.js, EventSource client in webapp-client.js, ADR 0003 transport decision, 8 runtime integration tests + 3 active e2e specs, 1 wired fixture flow

**Notes:** Transport decision (ADR 0003 #5): SSE chosen over Node-RED's RED.comms (rides the editor/admin websocket — only reaches authenticated editor sessions, not anonymous deployed-app pages, and has no per-recipient addressing for clientId targeting) and over a dedicated raw ws channel (new dependency + bidirectional plumbing we do not need — client→server is already POST /event from P30). Two bugs found during manual verification: (1) runtimeState.RED was only set by the legacy registerWebappNodes factory, but nodes self-register via registerNodeType, so RED was undefined when the ui-store handler ran and the push silently no-opped — RED is now captured in registerNodeType; (2) the thin client still applied the /event response snapshot, which raced and clobbered the live push with stale pre-reaction state — the event POST is now fire-and-report only, the SSE stream is the single source of re-renders. previewState remains the live shared state mutated by flow messages — removing it as an independent simulation is P32. A navigate command updates the subscriber's stored stream location so later snapshot pushes render the right page. Pre-existing unrelated E2E failures (p12/p13/p15/p16d/parent-selector/editor-mount-options editor-registration timing, p21/p23 detail-route content) persist from the P30 baseline and are out of this phase's scope (confirmed by checking out the P30 runtime and re-running).

---
id: P11a
title: "Parent field — schema and runtime"
epic: aspects/schema
status: done
dependencies: [P10]
---
# P11a — Parent field — schema and runtime

## Result

**Delivered:** parent field added to node schemas for app- and slot-scoped nodes; runtime mapConfig derives app/slot scoping from parent, with uiId kept as a backward-compatible fallback

**Stats:** ~11 node schemas touched, unit tests for parent-based compilation per node type

**Notes:** Summary reconstructed at archival time — this phase predates the archive convention. uiId fallback retained so pre-existing flows still compile.

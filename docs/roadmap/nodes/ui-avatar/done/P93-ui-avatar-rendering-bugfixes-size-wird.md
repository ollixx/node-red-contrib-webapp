---
id: P93
title: "ui-avatar Rendering-Bugfixes — size wird nicht gerendert (+ Default „small\" ergänzen); square/round wird nicht gerendert; Fallback-Initials werden nicht gerendert (statt „Objekt erwartet\"-Fehler); „Alt Text\" wird nicht unterstützt → entfernen"
epic: nodes/ui-avatar
status: done
dependencies: [P16d]
node: ui-avatar
spec: docs/nodes/display/ui-avatar.md
tests: tests/e2e/nodes/view/ui-avatar.tests.md
---
# P93 — ui-avatar Rendering-Bugfixes — size wird nicht gerendert (+ Default „small" ergänzen); square/round wird nicht gerendert; Fallback-Initials werden nicht gerendert (statt „Objekt erwartet"-Fehler); „Alt Text" wird nicht unterstützt → entfernen

## Result

**Delivered:** Fixed 4 rendering bugs in ui-avatar: size now emitted as data-size attr (sl-avatar has no native size attr), shape now emitted as shape='circle|square', plain-string initials now reach the serializer and are emitted as initials attr (were lost in toComponentDefinitions props block), alt field removed from schema/mapConfig/editor/nodes.ts (sl-avatar uses label for a11y).

**Stats:** 8 files changed; 2 new files (unit test + E2E test catalogue); 20 unit tests + 12 E2E tests; 649 unit tests total pass

**Notes:** initials was missing from the p16Kind props block in toComponentDefinitions so it never reached the serializer. sl-avatar size requires CSS --size custom property not a native size attr; data-size approach mirrors P92 badge.

**Cost:** session a1b9d5c6-8aba-419a-92c5-2a9a194639c4, 13m

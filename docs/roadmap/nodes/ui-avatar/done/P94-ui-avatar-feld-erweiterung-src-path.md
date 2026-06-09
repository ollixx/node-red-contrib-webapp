---
id: P94
title: "ui-avatar Feld-Erweiterung — „src path\" → „image\" als typedInput mit Typen „Media\" (Pfad auf Media-Server, wenn mediaStoreUrl gesetzt) und „Store\" (Bildpfad aus Store-Pfad); „Fallback Initials\" als typedInput mit allen sinnvollen Typen; „variant\" (Bootstrap) mit Shoelace-Warnung; Docs anpassen"
epic: nodes/ui-avatar
status: done
dependencies: [P67, P70]
node: ui-avatar
spec: docs/nodes/display/ui-avatar.md
tests: tests/e2e/nodes/view/ui-avatar.tests.md
---
# P94 — ui-avatar Feld-Erweiterung — „src path" → „image" als typedInput mit Typen „Media" (Pfad auf Media-Server, wenn mediaStoreUrl gesetzt) und „Store" (Bildpfad aus Store-Pfad); „Fallback Initials" als typedInput mit allen sinnvollen Typen; „variant" (Bootstrap) mit Shoelace-Warnung; Docs anpassen

## Result

**Delivered:** ui-avatar field extension: `image` typedInput (all binding kinds incl. Asset + Store, back-compat srcPath), `initials` as full typedInput binding (literal/store/state/…, back-compat plain string), `variant` → `data-variant` attribute (Shoelace warning in editor), docs updated.

**Stats:** 10 files changed; 665 unit tests; 20 new E2E avatar tests; 342 E2E total green

**Notes:** Variant is emitted as data-variant (not native variant=) because sl-avatar has no native variant support in Shoelace; editor shows info tooltip. Back-compat: old srcPath (plain state path) migrated to state binding; plain-string initials promoted to literal binding. Also fixed pre-existing: pulsating prop was assembled in mapConfig but never added to props block in toComponentDefinitions.

**Cost:** session claude-sonnet-4-6, 39m

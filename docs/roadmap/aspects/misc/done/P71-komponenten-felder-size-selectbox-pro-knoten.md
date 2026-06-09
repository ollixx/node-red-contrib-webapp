---
id: P71
title: "Komponenten-Felder — size (SelectBox, pro Knoten), outline (Flag wo unterstützt), Button-Link-Modus (Button/URL/Navigate) + Button-Slots (default=Label, prefix, suffix)"
epic: aspects/misc
status: done
dependencies: [P66]
---
# P71 — Komponenten-Felder — size (SelectBox, pro Knoten), outline (Flag wo unterstützt), Button-Link-Modus (Button/URL/Navigate) + Button-Slots (default=Label, prefix, suffix)

## Result

**Delivered:** ui-button gains size (sm/md/lg), an explicit outline flag, and a link mode (button/url/navigate) with a binding-capable href; the three-step size token is also added to ui-text/ui-input/ui-select/ui-textarea. Rendering: adapter+serializer emit the Shoelace size + boolean outline; url-mode renders a real hyperlink (sl-button[href] → <a>), navigate-mode marks data-webapp-navigate and the client navigates in-app while still reporting the click. Editor: a Size SelectBox plus button Outline checkbox + Link-Mode select with a conditionally-shown href field, and detailed button help text.

**Stats:** 13 files changed (~9 source + 2 docs/friction + 2 new test files); +25 schema tests, +3 adapter tests, +9 serializer tests, +4 E2E tests (all suites green: 295 unit, 284 E2E); 0 new node types; 5 nodes gained fields.

**Notes:** Outline scoped to ui-button only — sl-badge has no native outline (roadmap's 'ggf. badge/tag' was conditional). The 'Button-Slots as arbitrary child-mount targets' deliverable was explicitly an open design point ('feste Slots vs. Layout-Preset'); making ui-button a layout-host crosses mount-path/region structure (stop-condition-adjacent), so the common case is delivered (icon in prefix, label as default slot) and the full mini-container subsystem is deferred and documented in ui-button.md 'Offene Punkte'. href is binding-capable: literal → props.href, dynamic → bind.href → renderer resolvedProps.href; both webapp.js pipelines (AppModel + schema-definition) wired. ui-button.md spec updated. pnpm gen:example was a no-op (fixture unchanged). RECURRING FRICTION: the worktree was provisioned at an ancient commit on a worktree-agent-* branch; the sub-agent had to `git checkout -b phase/P71 develop` to materialise current source (logged in friction-log; affects every phase this run).


**Cost:** session a020f99daa40a90d6, 31m

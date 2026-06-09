---
id: P70
title: "ui-image / Bildverwaltung — Rendering aktivieren + src-URL (typedInput, bindbar) + wiring-first msg/Buffer→data: + Media-Store (mediaStoreUrl in ui-app, asset:<id>, Backend-Proxy/Obfuskation) + Editor-Media-Picker"
epic: aspects/test-infra
status: done
dependencies: [P20b, P68]
---
# P70 — ui-image / Bildverwaltung — Rendering aktivieren + src-URL (typedInput, bindbar) + wiring-first msg/Buffer→data: + Media-Store (mediaStoreUrl in ui-app, asset:<id>, Backend-Proxy/Obfuskation) + Editor-Media-Picker

## Result

**Delivered:** ui-image now renders as a native <img> (URL/state/query/store/msg bindings + new asset type); wiring-first msg.payload Buffer/Base64→data: conversion with content-type sniffing; app-level mediaStoreUrl with an obfuscating backend proxy (/webapp/:appId/asset/:id) plus admin asset list/upload endpoints; editor media-picker dialog and src typedInput.

**Stats:** 11 files changed (schema contracts+node-definitions+index, renderer.ts, resources/lib/webapp-serializer.js, resources/lib/editor-common.js, nodes/webapp.js, nodes/view/ui-image.html, nodes/structure/ui-app.html, 2 docs); 3 new unit test files (16 tests) + 2 E2E specs (7 tests); unit 358 pass, E2E 280 pass.

**Notes:** Three levels delivered. Level 1: ui-image added to component filter + P16X_KIND_MAP (kind image), renderer/serializer emit <img> with alt/object-fit/width/height + onerror fallbackSrc. Level 2: payloadToImageSrc (Buffer→data:, magic-byte sniff PNG/JPEG/GIF/WEBP/SVG, msg.contentType hint, image/png fallback) wired into viewNodePatchInputHandler. Level 3: asset:<id> rewritten server-side to /webapp/<appId>/asset/<id> (real store URL never reaches client); proxy validates id charset (no path traversal), streams upstream with content-type, hides upstream URL/body on error; admin GET/POST assets proxy listing + raw-binary upload (store owns persistence — chosen over inventing a local filesystem write contract, which the roadmap flagged as an open design point); editor Asset typedInput type + openMediaPickerDialog (browse/upload/preview). Back-compat: legacy ui-image srcPath maps to a state binding in oneditprepare. Example flow regenerated (no diff — customers-crud has no ui-image and mediaStoreUrl is optional). Spec docs (ui-image.md, ui-app.md) updated for asset/Buffer/mediaStoreUrl.


**Cost:** session b2433ac3-9381-402b-a0f9-6df3c7a507e4, 38m

# ui-image test catalogue

Per `.ai/agents/node-testing.md`. Written fresh for P99.

## Unit tests (`packages/runtime/test/p99-image-render-pipeline.test.ts`)

| Test | Goal |
|---|---|
| kind='image' → renders `<img>` | Regression guard: removing image from serializer turns this red |
| value is used as src attribute | Correct src attribute emitted from component.value |
| component.value as resolved src | Dynamic binding resolved by renderer → correct src |
| image without src → `<img>` no src | No crash when src is absent; no spurious src= attribute |
| alt text appears as alt attribute | Alt text correctly escaped and emitted |
| alt text HTML-escaped (XSS guard) | No raw `<script>` tag via alt field |
| missing alt → alt='' | Always present for accessibility |
| fit='cover' → object-fit: cover | Object-fit style value correctly emitted |
| fit='contain' → object-fit: contain | Second fit value tested |
| width as CSS string → width in style | String width (e.g. '100%') emitted without 'px' suffix |
| height as integer → height in style as px | Integer height converted to 150px correctly |
| width as integer → width in style as px | Integer width converted to 200px correctly |
| no fit/width/height → no style attribute | No empty style attribute when no dimensions given |
| fallbackSrc → onerror attribute | onerror handler present with fallback URL |
| no fallbackSrc → no onerror | No spurious onerror when not configured |
| asset:<id> with mediaStoreUrl → proxy URL | Asset src rewritten; real store URL hidden |
| asset:<id> without mediaStoreUrl → img present | No crash when asset used without store |
| renderAppPage status 200 | Full pipeline integration — page renders |
| renderAppPage contains `<img>` | Full pipeline integration — img in page |
| renderAppPage contains literal src URL | Full pipeline integration — src correct |
| renderAppPage contains alt/fit/width/height | Full pipeline integration — all attributes present |

## E2E tests (`tests/e2e/nodes/view/ui-image.spec.ts`)

| Test | Goal |
|---|---|
| renders `<img>` with src — regression guard | Browser DOM contains img with correct src |
| HTML source contains `<img>` with src | Server-side HTML rendering verified |
| alt text → alt attribute | Alt text present in rendered HTML |
| width, height and fit → style attribute | All dimension/fit fields appear in HTML style |
| integer width → px value in style | Integer width converted to px suffix |
| fallback field → onerror attribute | onerror with fallback URL rendered |
| msg.payload string → src updated after inject | Input port update reflected in browser DOM |
| asset src → backend proxy; store URL hidden | Proxy obfuscation works end-to-end |
| asset proxy 404 without media store | Security: no store configured → 404 |
| asset proxy rejects path-traversal | Security: path traversal blocked |

## Cross-cutting tests (preserved, not replaced)

- `packages/runtime/test/p70-image-payload.test.ts` — `payloadToImageSrc()` function:
  Buffer→data: conversion, JPEG/PNG/WEBP sniffing, contentType hint, fallback image/png.

## P237 — alt / fallbackSrc Binding-Auflösung (Muster 4, ADR 0012)

Unit (`packages/runtime/test/p237-image-alt-fallback-binding.test.ts`):

| Test | Goal |
|---|---|
| state-bound `alt` → `<img alt>` = resolved value | A `state` binding on `alt` is resolved (renderer→serializer) and rendered as the `alt` attribute; red if resolution breaks. |
| alt path string never leaks | Raw binding path (`form.altText`) absent from markup; no `[object Object]`. |
| state-bound `fallbackSrc` → `onerror` fallback URL = resolved value | A `state` binding on `fallbackSrc` is resolved and carried into the `<img>` `onerror` handler. |
| fallbackSrc path string never leaks | Raw binding path (`form.fb`) absent from the `onerror` handler. |

# ui-store-action — Test-Katalog

Tests für den typisierten Store-Mutations-Knoten [`ui-store-action`](../../../../docs/nodes/state/ui-store-action.md)
(P211, [ADR 0029](../../../../docs/adr/0029-state-action-nodes-store-action-query-action-hybrid.md)).
Outcome-basiert nach `.ai/agents/node-testing.md`: Op-Semantik, Pfad-Präzedenz,
beide Modi und die Scope-Regel werden gegen den echten Runtime-Handler bzw. im
Browser über den **gemessenen gerenderten Effekt** geprüft — nie über
DOM-Präsenz/Tags.

## Unit — Schema (`packages/schema/test/p211-store-action-schema.test.ts`)

| Test | Ziel |
|---|---|
| minimal + Defaults | `op` default `set`, `mode` default `reference` |
| op=set/patch/delete/replace/reset | jeder gültige Op-Wert wird akzeptiert |
| mode=reference/wire | beide Modi werden akzeptiert |
| unbekannte op / mode | werden abgelehnt |
| fehlende / leere `store`-Referenz | wird abgelehnt (Pflichtfeld) |
| leerer `path` | wird abgelehnt (optional, aber nicht leer) |
| Dispatch | über die diskriminierte Union als `ui-store-action` erreichbar |

## Unit — Runtime-Handler (`packages/runtime/test/p211-store-action-node.test.ts`)

| Test | Ziel |
|---|---|
| mapConfig Defaults / Werte | `op`/`mode`/`path` werden korrekt gemappt; blank path → undefined; unbekanntes mode → reference |
| **wire**: Envelope | emittiert `{ id, op, path, value }` (Wert aus payload), **mutiert nicht** |
| **wire**: reset ohne Wert | Envelope-`value` ist `undefined` |
| **wire**: Pfad-Präzedenz | `msg.ui.store.path` gewinnt im emittierten Envelope |
| **reference set** | mutiert den Sub-Wert an `path`, emittiert `changed`-Notification |
| **reference patch** | Deep-Merge am `path` (leer = ganzes Slice) |
| **reference replace** | ersetzt das ganze Slice unabhängig vom `path` |
| **reference delete** | entfernt den Sub-Wert; braucht keinen payload-Wert |
| **reference reset** | stellt `initialValue` her, **ignoriert** den payload |
| Pfad-Präzedenz (reference) | config › msg.path › msg.ui.store.path; leerer Pfad = Root |
| per-client | client-only op mit clientId mutiert nur den client-Slice, nicht broadcast |
| Scope: client-only ohne clientId | `server.store.scope-violation`, keine Mutation, kein send |
| Scope: broadcast-only mit clientId | `server.store.scope-violation` |
| unbekannter Store | `server.store.action-missing-store`, kein send |
| set ohne Wert | `server.store.invalid-operation`, keine Mutation |
| delete ohne Wert | erlaubt (kein Wert nötig) |

## Unit — App-Scope-Parent (`packages/runtime/test/p205-app-scoped-parent-validation.test.ts`)

| Test | Ziel |
|---|---|
| ui-store-action ohne App | Deploy-Fehler (P205), `no App` |
| ui-store-action mit gültigem App-Feld | kein Issue |
| „applies to ALL app-scoped types" | ui-store-action ist Teil der app-gebundenen Typen |

## E2E — Playwright (`tests/e2e/nodes/state/ui-store-action.spec.ts`)

Fixture: `tests/e2e/fixtures/p211-store-action.flow.json`.

| Test | Ziel (gemessener Effekt) |
|---|---|
| **reference mode** mutiert live | nach REFSET zeigt der an `store(entity).name` gebundene View live `B` (op direkt angewandt, **kein** Wire zum Store) |
| **wire mode** Envelope | nach WIRESET zeigt der Ergebnis-View das korrekte Envelope `{"id":"p211Store","op":"set","path":"name","value":"C"}` |
| **wire mode** mutiert nicht | nach WIRESET bleibt der entity-View bei `B` (wire mutiert nicht) |

## E2E — Editor open→save round-trip (`tests/e2e/nodes/state/ui-store-action.roundtrip.spec.ts`)

Standard: `.ai/agents/node-testing.md` „Editor open→save round-trip", [ADR 0031](../../../../docs/adr/0031-editor-open-save-round-trip-test-standard.md).
Ersetzt den bespoke `ui-store-action-store-save.spec.ts` durch einen einzigen
`assertEditorRoundTrip`-Aufruf für das `store`-Referenz-Picker-Feld.

| Test | Ziel |
|---|---|
| `store` open→Done Round-Trip | Der Store-Reference-Picker (hidden `#node-input-store`) ist beim Öffnen aus `store` **geseedet** (nicht leer), **überlebt** Done unverändert (`RED.nodes.node().store` bleibt `saStore`, kein Clobber zu `""`), und ein **Wertwechsel** auf `saStore2` persistiert und re-seedet beim Wiederöffnen. Entfernen des `store`-Seeds in `installReferenceSelectors` macht den Test rot. |

## P218 (ADR 0033) — consumed store command is not double-processed

Handler-level unit tests: `packages/runtime/test/p218-consumed-envelope-cleanup.test.ts`.

| Test | Ziel (gemessener Effekt) |
|---|---|
| notification is not a command | `normalizeStoreOperationMessage` lehnt ein `msg.ui.store` mit gesetztem `event` (`changed`/`read`) ab — eine verbrauchte Notification wird nie erneut angewendet |
| apply-once | die `changed`-Notification eines `ui-store`-Writes wird von einem zweiten `ui-store`-Hop NICHT erneut angewendet (State unverändert, Pass-Through) |
| real command still applies | ein echtes Kommando (ohne `event`) wird weiterhin angewendet (Guard greift nicht zu weit) |

Anmerkung: `ui-store-action` (reference) emittiert weiterhin seine `changed`-Notification
und `ui-store-read` seine `read`-Notification auf `msg.ui.store` — das sind AUSGEHENDE
Ereignisse, keine verbrauchten Kommandos; der Guard verhindert nur deren Re-Konsum.

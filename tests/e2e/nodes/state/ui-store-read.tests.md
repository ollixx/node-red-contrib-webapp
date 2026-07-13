# Testkatalog: ui-store-read

> Format gemäß `.ai/agents/node-testing.md`. Angelegt mit P209
> ([ADR 0028](../../../../docs/adr/0028-store-reads-are-a-separate-reference-node.md)).

Ein referenz-basierter, on-demand, NICHT-mutierender Leser eines `ui-store`.
Jeder Input triggert einen Read des aktuellen Server-Zustands am `statePath` des
referenzierten Stores (+ optionaler Sub-Pfad). Emittiert `msg.payload` +
`msg.ui.store = {id,event:"read",path,fullPath,value,clientId}`.

## Unit-Tests

### Schema — `packages/schema/test/p209-store-read-schema.test.ts`

| Test | Ziel |
|---|---|
| minimaler Reader (store + parent, kein path) | Pflichtfelder genügen |
| optionaler Default-`path` | `path` ist optional |
| fehlende `store`-Referenz → ungültig | `store` ist Pflicht |
| leere `store`-Referenz → ungültig | `min(1)` greift |
| leerer `path` (wenn gesetzt) → ungültig | optional, aber nicht-leer |
| erreichbar über `validateUiNodeDefinition` | discriminated dispatch |

### Runtime — `packages/runtime/test/p209-store-read-node.test.ts`

**mapConfig**

| Test | Ziel |
|---|---|
| store + path + parent; leerer path → undefined | `blankToUndefined` |
| nicht-leerer Config-path wird durchgereicht | Feld-Mapping |

**Pfad-Präzedenz** (`msg.ui.store.path` › `msg.path` › Config-`path` › ganzes Slice)

| Test | Ziel |
|---|---|
| kein Pfad → ganzes Slice am statePath | `payload` = volles Slice, `path` undefined |
| Config-`path` gewinnt ohne msg-Override | `payload` = Teilwert, `fullPath` = statePath.path |
| `msg.path` überschreibt Config-`path` | Runtime-Override Ebene 2 |
| `msg.ui.store.path` gewinnt über `msg.path` + Config | Runtime-Override Ebene 1 (höchste) |

**Per-Client**

| Test | Ziel |
|---|---|
| liest per-client-Slice zu `msg.ui.clientId` (nicht broadcast) | `getClientState`-Pfad |
| `msg.path='name'` per-client → Teilwert `'B'` | Override + per-client kombiniert |

**Scope-Guard & Nicht-Mutation**

| Test | Ziel |
|---|---|
| `client-only`-Read OHNE clientId → `server.store.scope-violation`, kein send | Scope-Regel wie Schreiben |
| `broadcast-only`-Read MIT clientId → scope-violation | Scope-Regel spiegeln |
| unbekannter referenzierter Store → `server.store.read-missing-store` | strukturierter Fehler |
| kein Schreiben in broadcast/per-client State | Nicht-mutierend (State unverändert) |

### Parent-Validierung — `packages/runtime/test/p205-app-scoped-parent-validation.test.ts`

| Test | Ziel |
|---|---|
| `ui-store-read` in ALLE app-scoped Typen aufgenommen | Teil von `APP_SCOPED_PARENT_TYPES` |
| `ui-store-read` ohne parent → ein Deploy-Issue | `parent` required (P205) |

## E2E (gemessen) — `tests/e2e/nodes/state/ui-store-read.spec.ts`

Flow: `ui-store` (client-only, initial `{name:'A', city:'X'}`) + `ui-store-read`.
Ein `ui-input` schreibt per-client `name='B'`; ein Trigger feuert den Reader; die
emittierte Message wird über einen HTTP-Rück-Kanal beobachtet.

| Test | Ziel |
|---|---|
| Read nach per-client Edit → `msg.payload` = `{name:'B', city:'X'}` | aktueller per-client-Zustand, gemessen an der Message |
| Trigger mit `msg.path='name'` → `payload = 'B'` | Path-Override greift live |

Beweis über den EMITTIERTEN Message-Inhalt (verdrahtet an einen Rück-Kanal),
nicht über bloße Knoten-Registrierung.

## E2E — Editor open→save round-trip (`tests/e2e/nodes/state/ui-store-read.roundtrip.spec.ts`)

Standard: `.ai/agents/node-testing.md` „Editor open→save round-trip", [ADR 0031](../../../../docs/adr/0031-editor-open-save-round-trip-test-standard.md).
`assertEditorRoundTrip`-Aufruf für das `store`-Referenz-Picker-Feld (P217).

| Test | Ziel |
|---|---|
| `store` open→Done Round-Trip | Der Store-Reference-Picker (hidden `#node-input-store`) ist beim Öffnen aus `store` **geseedet** (nicht leer), **überlebt** Done unverändert (`RED.nodes.node().store` bleibt `srStore`, kein Clobber zu `""`), und ein **Wertwechsel** auf `srStore2` persistiert und re-seedet beim Wiederöffnen. Entfernen des `store`-Seeds in `installReferenceSelectors` macht den Test rot. |

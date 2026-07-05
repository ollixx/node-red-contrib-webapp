---
id: P201
node: ui-store
epic: nodes/ui-store
title: "Multi-App: ui-store-Update wird unter der FALSCHEN App verbucht (getActiveRuntimeAppId liefert die erst-registrierte App) — store-gebundener View in jeder App außer der ersten bleibt beim Initialwert"
findings:
  - "Owner (2026-06-20, Dev-Flow Entity Editor, mit Erlaubnis gelesen): ui-list-itemClick → function setzt msg.ui.store={id:'3a9484aa9ec7aa4b', op:'replace', value:{name: params.row.label}} mit msg.ui.clientId; ein ui-text bindet store(entity).name (subPath). Symptom: der Text zeigt IMMER den Initialwert, der neue per-client-Wert erscheint nie."
  - "Fehldiagnose zuerst: 'client-only Store'. Der Store ist real scope='any'. Drei getreue Single-App-E2E-Reproduktionen (client-only UND any; subPath-Text im ui-container; echter ui-list-itemClick → params.row.label) waren alle GRÜN — der allgemeine Pfad funktioniert."
  - "Reproduziert an der ECHTEN Dev-Runtime (curl gegen :1881): Snapshot(clientId) vor Event = Initial; itemClick-Event gefeuert; Snapshot(clientId) danach = IMMER NOCH Initial. Unterschied zum Single-App-E2E: der Dev-Flow hat 5 ui-app-Knoten."
  - "ROOT CAUSE: der ui-store-inputHandler (webapp.js:5706) leitete die App via getActiveRuntimeAppId() ab — die gibt stur die ERST-registrierte ui-app zurück (webapp.js:2887), nicht die App, die den Store besitzt. In einem Multi-App-Deploy landeten setClientState + pushSnapshotToClients unter der falschen appId; buildAppSnapshot(appId aus URL) fand den per-client-State nie → Fallback auf Broadcast-Initialwert. Single-App funktioniert nur zufällig (eine App = erst-registrierte App)."
acceptance:
  - "Reproduktion (test-first, E2E): Fixture mit einer DECOY-ui-app registriert ZUERST (eigener Tab) + der eigentlichen App (Store + store-gebundener ui-text + ui-list-itemClick → per-client replace). Ohne Fix ist der Test ROT (Text bleibt beim Initialwert 'Alpha') — verifiziert: locator resolved to 'Alpha', unexpected. Mit Fix GRÜN ('Banana')."
  - "Fix an der Wurzel: getActiveRuntimeAppId() → findAppIdForNode(node) (webapp.js:4578, matcht node.z → besitzende ui-app, Fallback getActiveRuntimeAppId). Kein Symptom-Patch."
  - "Regression: Broadcast-Fall (scope='any', ohne clientId) aktualisiert store-gebundene Views weiterhin; Scope-Guard bleibt (client-only ohne clientId → scope-violation). Store-subPath- und whole-slice-Binding beide abgedeckt."
  - "Folgefund geflaggt: toastInputHandler (webapp.js:4299) hat denselben getActiveRuntimeAppId()-Multi-App-Misrouting-Bug — separat als Task ausgelagert (nicht in diesem Fix gebündelt)."
verify: browser
spec: docs/nodes/state/ui-store.md
tests: tests/e2e/nodes/state/ui-store.tests.md
dependencies: []
status: done
---
# P201 — Multi-App: ui-store-Update unter falscher App verbucht (Fix)

> **Bug (Owner, reproduziert an der echten Dev-Runtime).** Ein store-gebundener
> `ui-text` bleibt beim **Initialwert**, obwohl der Store-Op greift. Ursache ist
> **nicht** der Scope, sondern **Multi-App-Misrouting**: der Store-Handler
> verbuchte den Update über `getActiveRuntimeAppId()` — die *erst-registrierte*
> ui-app — statt über die App, die den Store besitzt. Bei 5 ui-apps im Dev-Flow
> landete der per-client-State unter der falschen `appId`; `buildAppSnapshot` für
> die betrachtete App fand ihn nie → Fallback auf den Broadcast-Initialwert.

## Was den Bug verschleiert hat

Single-App-Reproduktionen sind alle grün — bei **einer** App *ist*
`getActiveRuntimeAppId()` zufällig die richtige. Der Bug zeigt sich nur mit
**mehreren** ui-apps, wo die betroffene App nicht die erste ist.

## Fix

`nodes/webapp.js` — im `ui-store`-inputHandler:

```js
// vorher: const activeAppId = getActiveRuntimeAppId();  // erste App — falsch
const activeAppId = findAppIdForNode(node);              // besitzende App
```

`findAppIdForNode` (webapp.js:4578) matcht `node.z` (Flow-Tab) → die ui-app auf
demselben Tab, mit `getActiveRuntimeAppId()` als Fallback — dieselbe Auflösung,
die die Button/View-Handler bereits nutzen.

## Regressionstest

`tests/e2e/nodes/state/p201-client-only-store-live-update.spec.ts` +
`tests/e2e/fixtures/p201-client-only-store.flow.json`: eine **Decoy-App zuerst**,
dann die eigentliche App (Store + store-gebundener Text im Container +
ui-list-itemClick → per-client `replace`). Ohne Fix rot (Text bleibt „Alpha"),
mit Fix grün („Banana"). Behalten als dauerhafter Wächter.

## Folgefund (ausgelagert)

`toastInputHandler` (webapp.js:4299) hat denselben `getActiveRuntimeAppId()`-Bug
— Toast aus App B erreicht App-A-Clients. Als eigener Task ausgelagert, nicht in
diesen fokussierten Store-Fix gebündelt.

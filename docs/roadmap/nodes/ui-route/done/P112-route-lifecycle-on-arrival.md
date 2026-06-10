---
id: P112
title: "ui-route/ui-app: onEnter/onLeave bei JEDER Ankunft (Deep-Link, Refresh, Navigate) — Connect-basiert"
epic: nodes/ui-route
node: ui-route
status: done
dependencies: [P38, P66, P86]
verify: browser
spec: docs/nodes/structure/ui-route.md
tests: tests/e2e/nodes/structure/ui-route.tests.md
---
# P112 — Route-Lifecycle bei Ankunft (Deep-Link/Refresh/Navigate)

## findings (Nutzer-Wortlaut)

- "ich habe gerade probiert, einen deep link aufzurufen und das kommt nicht im
  backend an. ich würde erwarten, dass der event am richtigen route oder der app
  rauskommt."

## Befund (technisch)

- `onEnter`/`onLeave` werden **nur** über `performTargetNavigate` gefeuert — also
  ausschließlich bei einer programmatischen `navigate`-Action. Der Deep-Link-Pfad
  (`GET /webapp/<app>/customers/123` → `renderAppPage` → SSE-Connect →
  `addStreamClient`) feuert **nur** `clientConnected` auf der App (P86), **kein
  `onEnter`** auf der Route. Der Code-Kommentar bei `webapp.js` behauptet zwar
  „emitted … as a consequence of ARRIVING", deckt aber nur den Navigate-Weg ab.
- **Schlüssel:** Der Client navigiert **immer per Full-Reload**
  (`window.location.assign`, `resources/lib/webapp-client.js`) — kein SPA/pushState.
  Jede Ankunft (Deep-Link, In-App-Klick, programmatischer Navigate) endet in einem
  neuen Page-Load + neuem SSE-Connect an der Ziel-Location. ⇒ `onEnter` **am Connect**
  zu feuern deckt alle Ankunftswege einheitlich ab.
- **Knacknuss:** Die native `EventSource` reconnectet bei Netz-Hiccups automatisch
  (gleiche `clientId`+`location`). Naives „onEnter bei Connect" würde dann bei jedem
  Reconnect feuern. Außerdem kann der Server beim Verbindungs-Close nicht zwischen
  „Tab geschlossen" und „transienter Netz-Drop" unterscheiden.

## Entscheidungen (Owner)

- **Mechanismus:** Server-on-Connect + **Load-Nonce**. Der Client erzeugt pro
  Page-Load eine frische, **nicht persistierte** Nonce (`loadId`) und schickt sie am
  Stream-Connect mit. Server merkt sich die letzte Nonce je `clientId`: neue Nonce =
  echter Page-Load → Lifecycle; gleiche Nonce = transienter Reconnect → **kein** Event.
- **Umfang:** `onEnter` **und** `onLeave` symmetrisch; `onEnter` wird vollständig an
  den Ankunfts-Punkt verlegt, `performTargetNavigate` feuert sie **nicht mehr**.

## Zielmodell

- Eine Route gilt als **betreten**, sobald ein Client per Page-Load (neue `loadId`) an
  ihrer Location ankommt — egal ob Deep-Link, Refresh oder (Reload-basierter) Navigate.
- Eine Route gilt als **verlassen**, wenn der Client zu einer **anderen** Location
  wechselt (neue `loadId` an anderer Location → `onLeave` alt + `onEnter` neu) oder den
  Client endgültig schließt (Disconnect ohne Reconnect innerhalb der Grace-Periode).
- `onEnter`/`onLeave` tragen die **Route-Params** (z. B. `{id:"123"}`) und feuern auf
  der Route-Node — bzw. auf der `ui-app`-Node für die implizite Wurzel `/` (falls
  diese das Event deklariert). Wiederverwendung von `findRouteNodeForLocation` +
  `emitRouteLifecycleEvent`.

## Ansatz (Detail — buildable)

**Client (`resources/lib/webapp-client.js`):**
- Beim Boot eine `loadId` erzeugen (Zufallswert, **module-const**, pro Dokument neu;
  NICHT in localStorage). An die Stream-URL anhängen: `…&clientId=…&location=…&load=<loadId>`.
- Auto-Reconnect der `EventSource` verwendet dieselbe `loadId` (gleiches Dokument) →
  Server erkennt Reconnect.

**Server (`nodes/webapp.js`):**
- Stream-GET-Endpoint liest zusätzlich `load`. `addStreamClient(appId, clientId, res,
  location, loadId)`.
- Neue Tracking-Map (z. B. `runtimeState.clientArrival`: appId → Map<clientId,
  {loadId, location}>).
- **Connect:** `prev = clientArrival.get(clientId)`.
  - `prev?.loadId === loadId` → transienter Reconnect → **kein** Event.
  - sonst (neue `loadId`): wenn `prev` existiert und `prev.location !== location` →
    `onLeave` auf Route für `prev.location`; dann `onEnter` auf Route für `location`.
    (Refresh: `prev.location === location` → nur `onEnter`, kein `onLeave`.)
  - `clientArrival.set(clientId, {loadId, location})`.
- **Disconnect (`removeStreamClient`):** **entprellt** mit Grace-Periode (z. B. 3 s).
  Ein Reconnect desselben `clientId` innerhalb der Grace **canceled** den pending Leave
  (Navigation/Blip); der Connect-Handler entscheidet dann via `loadId`+`location` über
  `onLeave(alt)`+`onEnter(neu)`. Kein Reconnect bis Ablauf → `onLeave` auf aktuelle
  Route + `clientDisconnected` (wie heute). `clientArrival` löschen.
- **`performTargetNavigate`:** `onEnter`/`onLeave`-Emission **entfernen** — der Reload
  → Disconnect/Connect-Pfad besitzt jetzt den Lifecycle. Es bleibt nur der Navigate-Push.
- `clientConnected`/`clientDisconnected` (App, P86) optional ebenfalls auf echte
  Page-Loads dedupen (per `loadId`) für Konsistenz — im Impl entscheiden.

## acceptance (observierbar, `verify: browser`)

- **Deep-Link:** Direktaufruf/Refresh/geteilter Link auf `/customers/123` → `onEnter`
  feuert auf der **customers-Route-Node** mit `params {id:"123"}`.
- **Wurzel:** Deep-Link auf `/` → `onEnter` auf der **ui-app**-Node (falls deklariert).
- **Reconnect-sicher:** Ein simulierter transienter `EventSource`-Reconnect (gleiche
  `loadId`) feuert **kein** weiteres `onEnter`.
- **Refresh:** Neuladen derselben Route (neue `loadId`) feuert `onEnter` erneut.
- **Wechsel A→B:** (Full-Reload) feuert `onLeave(A)` **genau einmal**, dann
  `onEnter(B)` genau einmal — **kein** Doppel-`onEnter` mehr aus `performTargetNavigate`.
- **Verlassen:** Tab schließen → `onLeave` auf der aktuellen Route nach Ablauf der
  Grace-Periode (plus `clientDisconnected` wie bisher).

## Offene Risiken / Out-of-scope

- **Multi-Tab:** `clientId` liegt **pro App** in localStorage (`webapp:clientId:<appId>`)
  und wird über alle Tabs derselben App **geteilt**; zudem überschreibt der zweite Tab
  den `streamClients`-Eintrag des ersten (`subscribers.set(clientId, …)`). Per-Client-
  Location-Tracking kollidiert dann zwischen Tabs. **Bestehende Limitierung** — hier
  nicht gelöst; im Paket dokumentieren (ggf. eigenes Paket: per-Tab-Id).
- **Grace-Periode** tunen (zu kurz → falsche Leaves bei langsamem Reconnect; zu lang →
  verzögerte Leave-Erkennung).
- Spec `docs/nodes/structure/ui-route.md` + Tests-Katalog
  `tests/e2e/nodes/structure/ui-route.tests.md` mit dem Connect-basierten Lifecycle-
  Modell aktualisieren.

## Result

- **delivered:** Connect-basierter Route-Lifecycle — `onEnter`/`onLeave` feuern bei JEDER Ankunft (Deep-Link, Refresh, Reload-basierter Navigate) am SSE-Connect, dedupliziert über eine pro-Page-Load-Nonce (`loadId`); `performTargetNavigate` emittiert den Lifecycle nicht mehr (Doppel-`onEnter` beseitigt), Disconnect ist grace-entprellt (3 s) mit Reconnect-Cancel, der Client sendet eine frische, nicht persistierte `loadId` auf der Stream-URL.
- **stats:** 11 Dateien geändert (3 Commits, Merge 6875a9a). Impl: `nodes/webapp.js` (clientArrival-Map + `handleClientArrival`/`scheduleArrivalLeave`/`emitArrivalLifecycle`; `addStreamClient`/`removeStreamClient` + `/stream`-Endpoint mit `loadId`; Lifecycle aus `performTargetNavigate` entfernt), `resources/lib/webapp-client.js` (module-const `loadId` → `&load=`). Tests: 1 neue Unit-Spec (8 Tests) + 1 neue E2E-Spec (2 Tests), P66-Unit (2 Tests) + P31/Harness an den neuen Kontrakt angepasst; Unit-Suite 1151 grün, Lint/Build/check:links OK. Docs: `ui-route.md` Output-Sektion + Test-Katalog um das Load-Nonce-Modell und die dokumentierte Multi-Tab-Limitierung ergänzt.
- **notes:** P66s Navigate-Lifecycle-Assertions auf den neuen Kontrakt umgezogen (Navigate = nur Push; onEnter kommt aus dem Reload→Connect-Pfad). Gezielte E2E im Worktree grün (P112 ×2, P66-Navigation ×3, ui-route ×9, ui-app ×11, p12-events ×5); volle Suite vom Orchestrator auf develop nach dem Merge verifiziert. Multi-Tab (geteilte `clientId` pro App) bleibt bekannte Limitierung — ggf. eigenes Paket (per-Tab-Id).
- **cost:** session 7f4bf0e0-bc28-455e-b94f-44a1d9c633ca (SubagentStop 2026-06-10T10:00:25Z, `.ai/agent-runs.jsonl`), 16m wall-clock (09:45Z–10:01Z), Modell opus.

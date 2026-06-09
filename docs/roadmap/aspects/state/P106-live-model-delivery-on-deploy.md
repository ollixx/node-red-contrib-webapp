---
id: P106
title: "Live-Modell-Auslieferung beim Deploy: In-Place-Update via SSE-Snapshot-Push, Reload nur als Shell-/Topologie-Fallback (+ Bugfix: Deploy liefert aktuell gar nichts an verbundene Clients)"
epic: aspects/state
status: pending
dependencies: [P15, P31, P37]
verify: browser
spec: docs/nodes/concepts/live-deploy-update.md
---
# P106 — Live-Modell-Auslieferung beim Deploy

> Setzt das Konzept [live-deploy-update.md](../../../nodes/concepts/live-deploy-update.md)
> um. Mechanismus = Option 2 (In-Place, Reload als Fallback). Owner-Entscheidung 2026-06-09.

## Findings
> Owner-Vorgabe.

- Das Ändern von Knoten im Editor wird mit einem Deploy in Node-RED bestätigt. Danach sollen die Modell-Änderungen **direkt an alle Clients** ausgeliefert werden, so dass sich die UI **automatisch aktualisiert**.
- **Beobachteter Ist-Zustand: beim Deploy passiert bei verbundenen Clients gar nichts** — der vorhandene P37-`redeploy`-Reload feuert nicht. Das ist ein latenter Bug, der unabhängig vom Zielmechanismus zuerst zu finden/fixen ist.
- **Hinweis Owner: tritt bei einem *verdeckten* (nicht fokussierten) Browser-Tab auf.** Code-Analyse bestätigt die Ursachenkette: (a) der Deploy-Pfab sendet nur `redeploy`, keinen Snapshot ([webapp.js:4408](../../../../nodes/webapp.js)); (b) der SSE-Endpoint hängt an `RED.httpNode` und überlebt den Deploy → **kein Reconnect** → der `/stream`-Reconnect-Snapshot ([webapp.js:2460](../../../../nodes/webapp.js)) greift nicht; (c) Chrome **friert verdeckte Tabs ein** → der `redeploy`-Handler ([webapp-client.js:1031](../../../../resources/lib/webapp-client.js)) läuft nicht; (d) es gibt **kein `visibilitychange`-Handling** im Client → beim Zurückkehren zum Tab wird nichts nachgezogen. Ergebnis: stehende Seite bis zum manuellen Reload.
- Gewählter Mechanismus: **In-Place-Update** über den vorhandenen SSE-Snapshot-Kanal; **voller Reload nur als Fallback**, wenn sich die App-Shell oder die Routen-Topologie ändert (Kriterium = Shell-/Topologie-Signatur, nicht Snapshot-Größe).

## Acceptance
> `verify: browser` — im laufenden Dev-Node-RED zu beweisen (Editor → Deploy → verbundener Browser).

- **Bugfix zuerst:** Im laufenden Dev-Node-RED reproduzieren und die Ursache bestätigen (Code-Analyse-Hypothese: verdeckter/eingefrorener Tab verarbeitet das `redeploy`-Event nicht, und mangels Reconnect + `visibilitychange`-Pull gibt es keine Erholung). Belegt: ein verbundener Client erhält beim Deploy nachweislich ein Update.
- **Verdeckter Tab (der eigentliche Fix):** Ein `visibilitychange`-Handler im Client zieht beim **Sichtbarwerden** des Tabs das aktuelle Modell von `/snapshot` und übernimmt es per `applySnapshot` (bzw. Reload, falls die Signatur sich geändert hat). Beweis: App-Tab verdecken → im Editor deployen → Tab wieder in den Vordergrund → UI zeigt das neue Modell, ohne manuellen Reload. (Dies ist robust gegen verpasste Events im Hintergrund.)
- **In-Place bei reiner Inhaltsänderung:** Editor ändert ein Label/Variant/fügt einen Button auf der aktuell angezeigten Route hinzu → Deploy → der verbundene Browser zeigt die Änderung **ohne Page-Reload** (kein `location.reload`; `applySnapshot` greift). Beweis: ein vor dem Deploy gesetzter Client-Zustand (z. B. ein per `show/hide` umgeschaltetes Element oder eine laufende Texteingabe in einem ungebundenen Feld) **überlebt** das Update.
- **Reload-Fallback bei Struktur-/Shell-Änderung:** Editor wechselt das Layout-Preset/Theme-Token am `ui-app`, ODER entfernt die Route, auf der der Client steht, ODER baut die Routen-Menge um → Deploy → der Browser macht einen **vollen Reload** und zeigt das neue Modell korrekt.
- **Signatur:** Server berechnet eine Shell-/Topologie-Signatur (App-Shell-Layout + Theme-Tokens + Routen-Pfad-Menge + Serializer-Version) und sendet sie mit dem Deploy-Push; der Client vergleicht gegen seine hydrierte Signatur und entscheidet In-Place vs. Reload nach der Tabelle im Konzept. Unit-Test: gleiche Struktur → gleiche Signatur; geänderte Route-Menge/Shell → andere Signatur.
- **Multi-Client:** mehrere verbundene Browser derselben App erhalten den Deploy-Push alle (Broadcast); per-Client-State (P15) bleibt erhalten.

## Notes
- Baut auf P31 (`applySnapshot`/`snapshot`-Event), P37 (Deploy-Hook `flows:started` + `redeploy`-Broadcast) und P15 (per-Client vs. Broadcast) auf — keine neue Transport-Schicht, sondern die vorhandene nutzen/erweitern.
- Der `redeploy`-Reload aus P37 wird zum **Fallback-Zweig**; der Default-Pfad wird der Snapshot-Push.
- Server-Pfad: `flows:started` → frisches `readDeployDefinitions(RED)` kompilieren → `pushSnapshotToClients(appId, undefined, …)` (Broadcast) inkl. Signatur. Client-Pfad: `snapshot`-Handler bzw. ein neuer Deploy-Push-Handler entscheidet In-Place vs. Reload.

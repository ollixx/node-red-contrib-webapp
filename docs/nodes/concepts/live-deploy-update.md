# Live-Modell-Auslieferung beim Deploy

> **Anforderungs-Dokument.** Beschreibt den *gewünschten* Vertrag, nicht den
> aktuellen Implementierungsstand. Teile sind noch **nicht implementiert** und
> unten markiert.

## Ziel

Wird eine Webapp im Node-RED-Editor geändert und **deployed**, soll das neu
kompilierte Modell **direkt an alle verbundenen Clients** ausgeliefert werden, so
dass sich die UI **automatisch aktualisiert** — ohne dass der Anwender die Seite
manuell neu lädt.

## Bestehende Bausteine

- **P31** — Live Server→Client-Transport (SSE): `snapshot`-Event + clientseitiges
  `applySnapshot()`, das den Region-/Layout-Baum **in-place** re-rendert (inkl.
  Interaktions-Overlay und Formular-Status-Erhalt).
- **P37** — beim Deploy (`flows:started`) broadcastet der Server ein
  `redeploy`-Event; der Client macht heute `window.location.reload()` (voller
  Reload).

## Mechanismus (gewünscht): In-Place, Reload nur als Fallback

Beim Deploy wird der **frisch kompilierte Snapshot** über den bestehenden
SSE-`snapshot`-Kanal an alle Clients gepusht und per `applySnapshot()` in-place
übernommen — **kein** Reload. Client-State (aktuelle Route, Scroll,
Interaktions-Overlay `show/hide/enable/disable`, laufende Formulareingaben) bleibt
erhalten.

Ein voller Reload ist nur der **Fallback** für Änderungen, die ein In-Place-
Re-Render strukturell nicht ausdrücken kann (siehe Signatur unten).

## Wann Reload statt In-Place? — die Shell-/Topologie-Signatur

> **Nicht die Größe des Snapshots entscheidet, sondern *was* sich geändert hat.**

`applySnapshot` re-rendert den Baum der **aktuellen Route**. Sicher in-place:
Props/Werte, Komponenten innerhalb der sichtbaren Route hinzufügen/entfernen,
Layout-Inhalt. Außerhalb dieses Baums liegt die App-Shell und die Routen-Topologie
— die braucht einen Reload.

Dafür trägt jeder Deploy-Push eine **Signatur** aus genau den nicht-in-place-
fähigen Teilen:

1. **App-Shell** — Layout-Preset des `ui-app` + Theme-Tokens (alles, was in die
   server-gerenderte Seiten-Hülle gebacken ist).
2. **Routen-Topologie** — die Menge der Routen-Pfade (+ Param-Struktur).
3. **Transport-/Serializer-Version** — falls der Client-Code-Vertrag selbst sich
   ändert (Paket-Upgrade, nicht Flow-Deploy).

**Entscheidungsregel auf dem Client** bei jedem Deploy-Push:

| Bedingung | Aktion |
|---|---|
| Signatur **gleich** UND aktuelle Route existiert noch | **In-Place** `applySnapshot` |
| Signatur **ungleich** ODER aktuelle Route ist weg | **voller Reload** |

Beispiele: Label ändern / Button auf der aktuellen Seite hinzufügen / Variant
wechseln → in-place. Navigation umbauen / Theme- oder Layout-Preset wechseln /
Route entfernen, auf der man steht → Reload.

> **Implementiert (P106).** Der Deploy-Push sendet ein `deploy`-SSE-Frame mit
> `{ snapshot, signature, mode }`; der Server berechnet die Signatur aus
> App-Layout-Preset + Theme-Tokens + Routen-Pfad-Menge + Serializer-Version
> (`computeShellSignature`), der Client vergleicht sie gegen die in die Seite
> gebackene `data-webapp-signature` und entscheidet In-Place vs. Reload.

## Verdeckte / inaktive Tabs

Ein auf SSE-Events getriggerter Reload (oder In-Place-Push) ist **fragil für
verdeckte Tabs**: Browser drosseln Hintergrund-Tabs, und Chrome **friert** sie
ein (Tab Freezing) → der Event-Handler läuft nicht. Da der SSE-Endpoint den
Deploy überlebt (kein Reconnect → kein Reconnect-Snapshot), gibt es ohne weitere
Maßnahme **keine Erholung**: der Tab bleibt stehen, bis manuell neu geladen wird.

**Robustheits-Regel:** ein **`visibilitychange`-Handler** zieht beim
**Sichtbarwerden** des Tabs das aktuelle Modell aktiv von `/snapshot` und wendet
die In-Place-vs-Reload-Regel (Signatur) an. Damit ist das Update unabhängig davon,
ob im Hintergrund ein Push verpasst wurde — beim Refokus gilt immer der Server-
Zustand.

> **Implementiert (P106).** Der Client registriert einen
> `visibilitychange`-Handler, der beim Sichtbarwerden des Tabs `/snapshot`
> (jetzt ein echter JSON-Endpoint mit `{ snapshot, signature, mode }`) zieht und
> dieselbe In-Place-vs-Reload-Regel anwendet — robust gegen verpasste Pushes.

## Mehr-Client / Mehr-Nutzer

Der Push geht als **Broadcast** an alle Subscriber der App (kein `clientId`).
Per-Client-State (P15) bleibt dabei erhalten — der Snapshot trägt nur die
Modell-Struktur, nicht den per-Client-Zustand. Siehe [multi-user.md](multi-user.md).

## Entwicklung vs. Produktion (Deploy-Mode)

Das `ui-app` trägt ein Feld **Status** (config-Key `deployMode` — `status` ist ein
reservierter Node-RED-Knotenname) mit zwei Werten:

- **Entwicklung** (Default): Verhalten wie oben — In-Place via Snapshot, Reload
  nur bei Shell-/Topologie-Änderung. Bequem beim Bauen.
- **Produktion**: beim Deploy wird **nicht** automatisch aktualisiert oder neu
  geladen. Der Client zeigt stattdessen einen **Versions-Alert** („Die Anwendung
  hat eine neue Version. Speichern Sie alle Daten und laden Sie diese Website
  neu."). Erst der **manuelle Reload** des Users übernimmt das neue Modell — so
  geht kein laufender Nutzer-Zustand ungefragt verloren.

Das `mode`-Feld reist im `deploy`-Frame mit; der Client liest es (bzw. die in die
Seite gebackene `data-webapp-mode`) und wählt den Produktions-Zweig.

## Flüchtige Werte (`msg`/`jsonata`) beim Deploy

Message-getriebene **Anzeige**-Werte (`msg`/`jsonata`, z. B. ein per Navigation
gesetzter `ui-text`) leben nur in der **Live-Definition** (Backend), nicht im
Flow-File. Ein Deploy baut das Modell frisch aus dem Flow → diese Werte werden
**zurückgesetzt** (Owner-Entscheid 2026-06-10: bewusst flüchtig, nicht
„repariert"):

- **Development** (In-Place-Apply): das Feld rendert **leer**, bis die nächste
  passende Message kommt. `onEnter` feuert beim In-Place-Apply **nicht** (kein
  neuer `loadId` — der Lifecycle hängt am Page-Load, siehe
  [`ui-route`](../structure/ui-route.md)).
- **Production** (Versions-Alert): der manuelle Reload erzeugt einen neuen
  `loadId` → `onEnter` feuert → der Flow kann den Wert neu setzen.

Wer einen über Deploys **stabilen** Wert braucht, bindet ihn an eine reaktive
Quelle (Store/Query/Route-Param/Reactive) statt an `msg`/`jsonata` — siehe die
Binding-Kategorien in [editor.md](editor.md).

## Siehe auch

- [multi-user.md](multi-user.md) — per-Client vs. Broadcast, clientId-Modell
- [messages.md](messages.md) — `msg.ui`-Event-Format / Snapshot-Inhalt

## Offene Punkte

- Genaue Felder der Shell-Signatur (welche Token-Teilmenge zählt als „Shell"?).
- Verhalten, wenn die aktuelle Route entfernt wurde: harter Reload vs. Navigation
  auf eine Fallback-Route.

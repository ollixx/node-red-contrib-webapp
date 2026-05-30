# Multi-User-Fähigkeit und Client-Persistenz

## Client-ID

Jeder Browser-Tab, der eine App öffnet, erhält beim Verbindungsaufbau eine eindeutige `clientId`. Diese ID wird mit jeder Message vom Client an den Server mitgesendet und steht im Flow als `msg.ui.clientId` zur Verfügung.

### Broadcast vs. gezieltes Update

Nachrichten an `ui-store`, `ui-query` und andere zustandstragende Knoten verhalten sich je nach `clientId` unterschiedlich:

- **Ohne `msg.ui.clientId`**: Der neue State wird server-seitig gesetzt und als Notification an **alle** verbundenen Clients der App gebroadcastet. Geeignet für geteilten Zustand wie Listen, Zähler oder gemeinsame Daten.
- **Mit `msg.ui.clientId`**: Das Update wird nur im State des angegebenen Clients angewendet. Die Notification geht ausschließlich an diesen Client. Geeignet für nutzerspezifischen Zustand wie Formular-Drafts, Auswahl-Zustände oder Sitzungsdaten.

### Typische Patterns

| Anwendungsfall | clientId setzen? |
|---|---|
| Geteilte Kundenliste aktualisieren | Nein — Broadcast |
| Formular-Draft eines Nutzers befüllen | Ja — gezieltes Update |
| Fehlermeldung für einen bestimmten Nutzer | Ja — gezieltes Update |
| Globalen Ladezustand setzen | Nein — Broadcast |

Die `clientId` einer eingehenden Client-Aktion steht immer in `msg.ui.clientId` und kann direkt für das Antwort-Routing verwendet werden — kein manuelles Mapping nötig.

---

## LocalStorage und Offline-Resilienz

### Grundidee

Der Client-State eines Stores kann optional im `localStorage` des Browsers persistiert werden. Das erlaubt es, bei einem kurzen Netzwerkausfall oder Server-Neustart den letzten bekannten State zu halten und nach Wiederverbindung automatisch zu synchronisieren — ohne dass der Nutzer Datenverlust bemerkt.

Die Entscheidung, ob ein Store persistiert wird, liegt beim Knoten: `ui-store` trägt ein optionales `persist`-Flag.

### Sync-Verhalten bei Wiederverbindung

Nach einem Verbindungsabbruch gilt folgende Strategie:

1. **Client reconnectet**: sendet seinen lokalen State-Snapshot mit Timestamp an den Server.
2. **Server vergleicht**: prüft, ob der Client-State neuer ist als der server-seitig gespeicherte State.
   - Client-State ist neuer → Server übernimmt den Client-State und broadcastet ihn.
   - Server-State ist neuer oder gleich → Server sendet seinen State an den Client, Client überschreibt localStorage.
3. **Konfliktfall** (beide Seiten wurden gleichzeitig verändert): Server-State gewinnt. Der Client-State wird verworfen und überschrieben.

Diese Strategie ist bewusst einfach gehalten (Server gewinnt im Konflikt) und vermeidet komplexe Merge-Logik.

### Offline-Verhalten

Solange keine Verbindung besteht:
- Der Client arbeitet weiter mit dem zuletzt bekannten State aus dem localStorage.
- Nutzer-Eingaben werden lokal gespeichert, aber nicht an den Server gesendet.
- Aktionen, die eine Server-Antwort erfordern (z.B. Daten speichern), werden geblockt oder als "pending" markiert — abhängig von der App-Logik.

Eine Offline-Queue für ausgehende Aktionen ist **nicht** Teil des Kernmodells und muss ggf. auf Flow-Ebene implementiert werden.

### Konfiguration am `ui-store`-Knoten

**Optionales Feld** (noch nicht implementiert):
- `persist`: `true | false` — ob der Store-Slice im localStorage persistiert wird.
  - Default: `false`
  - Wenn `true`: Der Slice wird unter dem Schlüssel `webapp:<appRoot>:<statePath>` im localStorage gespeichert.

### Scope von `persist` im MVP

`persist` ist primär für **Read-State** gedacht: Listen, Auswahlen, UI-Zustand, zuletzt besuchte Route. Der Client sieht nach einem Aussetzer sofort wieder seinen letzten Stand, ohne auf den Server warten zu müssen.

Offline-Write — also das Erfassen neuer Daten ohne Verbindung und das spätere Zurückschreiben in eine Datenbank — ist **nicht** Teil des MVP. Das Problem ist lösbar, aber die Konfliktbehandlung bei fehlgeschlagenem DB-Schreiben ist anwendungsspezifisch und gehört nicht in den Framework-Kern.

---

## Idee für spätere Versionen: Sync-Controller-Knoten

Offline-Write erfordert eine bewusste Strategie für den Fall, dass das Zurückschreiben in die Datenbank fehlschlägt. Es gibt drei sinnvolle Ansätze, die sich als dedizierte Knoten modellieren lassen:

### `ui-sync-optimistic`

Der Client schreibt sofort lokal, der Store zeigt die Daten direkt an. Nach Reconnect sendet `ui-store` den lokalen State an den Flow. `ui-sync-optimistic` leitet ihn an die DB weiter und wartet auf Erfolg oder Fehler:
- **Erfolg**: nichts weiter nötig, der Client-State war bereits korrekt.
- **Fehler**: sendet den korrigierten State zurück an den Client, überschreibt localStorage.

Der Nutzer sieht kurz die "optimistische" Version, bei Fehler die korrigierte. Geeignet für Szenarien mit geringer Konfliktwahrscheinlichkeit.

### `ui-sync-pending`

Offline-Änderungen werden im State als `pending` markiert und im UI entsprechend angezeigt ("nicht gespeichert"). Nach Reconnect schreibt der Flow in die DB:
- **Erfolg**: Knoten sendet eine Bestätigung, `pending`-Markierung wird aufgehoben.
- **Fehler**: `pending` bleibt mit Fehlerstatus, Nutzer kann manuell erneut versuchen.

Ehrlicher gegenüber dem Nutzer, aber erfordert UI-Unterstützung für den Pending-Zustand.

### `ui-sync-readonly`

Offline-Writes werden geblockt. Der Client kann im Offline-Zustand nur lesen, nicht schreiben. `persist` bewahrt den letzten bekannten Server-State, wird aber bei Reconnect immer vom Server überschrieben.

Einfachste Lösung, deckt die meisten realen Anwendungsfälle ab.

---

### Schnittstellenidee

Alle drei Knoten würden denselben Out-Port von `ui-store` konsumieren — die Reconnect-Message mit dem lokalen Client-State — und die DB-Logik dahinter bleibt vollständig beim App-Autor:

```
[ui-store] → [ui-sync-optimistic] → [eigene DB-Logik] → [ui-sync-optimistic]
```

`ui-store` liefert das Signal, der Sync-Knoten implementiert die Strategie, der App-Autor verdrahtet nur noch die Datenbank. Kein manuelles Reconnect-Protokoll nötig.

---

### Offene Punkte

- Wie wird mit sehr großen State-Objekten umgegangen (localStorage-Limit ~5 MB)?
- Soll der Nutzer im UI sichtbar informiert werden, wenn er offline arbeitet?
- Verschlüsselung sensibler Daten im localStorage ist nicht vorgesehen — `persist` sollte nicht für Auth-Tokens oder Passwörter verwendet werden.
- Wie verhält sich Persistence bei mehreren Tabs derselben App im selben Browser? (Jeder Tab hat eine eigene `clientId`, aber denselben localStorage.)

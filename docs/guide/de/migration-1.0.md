# Migration auf 1.0

> English (canonical): [../migration-1.0.md](../migration-1.0.md)

Wenn du Flows mit einem Vor-1.0-Build dieser Nodes gebaut hast, erklärt diese
Seite jede Breaking Change und was du (falls überhaupt) tun musst.

**Kurzfassung: Du musst nichts von Hand ändern.** Alle Umbenennungen und die eine
Node-Entfernung unten werden **automatisch migriert, sobald Node-RED deinen Flow
lädt und neu speichert**. Öffne die betroffene Node (oder deploye einfach) und die
kanonischen Felder werden geschrieben; die Runtime liest die alten Felder in der
Zwischenzeit weiter. Diese Seite *erklärt* die Änderungen — sie ist keine
manuelle Checkliste.

## `ui-navigation` entfällt — Navigation ist eine `ui-action`

Die Node `ui-navigation` wurde entfernt. Navigation ist jetzt ausschließlich eine
**`ui-action`** mit `actionType: "navigate"`
([ADR 0040](../../adr/0040-retire-ui-navigation-node-navigate-is-a-ui-action.md)).

Grund: `ui-navigation` war ein veralteter Alias, dessen Editor Route-/URL-/Wire-
Modi und typisierte Parameter anbot, dessen Runtime aber nur das schlichte
`to`-Ziel auswertete — eine Route-Modus-Node konnte grün validieren und dann
stillschweigend nichts tun. `ui-action` navigate ist das einzige, vollständig
verdrahtete Modell (mit den drei Zielmodi: wire / route / url).

**Migration:** jede funktionierende `ui-navigation` war eine `url`-Modus-Node mit
einem `to`-Wert; ihr exaktes Äquivalent ist eine `ui-action` mit
`actionType: "navigate"`, `targetMode: "url"`, demselben `to` und derselben
`app`. Die Node-Set-Transformation nimmt diese Umschreibung automatisch vor,
bestehende Flows laufen also weiter. Verwende bei der nächsten Bearbeitung der
Navigation eine `ui-action`-Node.

## Feld-Umbenennungen (Auto-Migration beim Öffnen/Speichern)

Eine node-übergreifende Feldmodell-Bereinigung
([ADR 0038](../../adr/0038-field-model-consistency-naming-and-carrier-normalization.md))
hat die Referenzfeld-Namen vereinheitlicht. Die Runtime liest den alten
Feldnamen und schreibt beim Speichern den kanonischen — **kein Flow bricht, keine
manuelle Änderung nötig**:

| Altes Feld     | Kanonisches Feld | Wo                                       |
|----------------|------------------|------------------------------------------|
| `parent`       | `app`            | jede Nicht-App-Node (benennt die zugehörige App; `mount` bleibt der Render-Slot) |
| `layoutId`     | `layout`         | `ui-route`, `ui-dialog`, `ui-container`  |
| `routeId`      | `route`          | Route-Referenzen (z. B. `ui-action` navigate Route-Modus) |
| `definitionId` | `definition`     | `ui-component-instance`                   |
| `rows`         | `lines`          | `ui-textarea` (Zeilenanzahl/Höhe; `rows` bedeutet jetzt nur noch „Datenzeilen", z. B. bei `ui-table`) |

Die Regel hinter den Umbenennungen: ein Referenz-per-Id-Feld verwendet den
**blanken Konzeptnamen** (der Wert *ist* die Id) — analog zu `store`/`mount` —
statt eines `Id`-Suffixes. `parent` war irreführend (es hielt die zugehörige
App-Id, nicht einen Slot-Parent) und wurde deshalb zu `app`.

## Was du konkret tun solltest

1. Öffne deinen Flow in Node-RED 4.x mit installiertem 1.0.
2. **Einmal deployen.** Die Auto-Migration schreibt die kanonischen Felder.
3. Falls du `ui-navigation`-Nodes verwendet hast, ersetze sie bei Gelegenheit
   durch `ui-action`-navigate-Nodes (die Transformation hält sie bis dahin am
   Laufen).

Das war's. Das vollständige Feldmodell findest du unter
[Layout & Slots](guides/layout-slots.md) und
[Bindings & State](guides/bindings-state.md); zur Navigation siehe
[Navigation & Dialoge](guides/navigation-dialogs.md).

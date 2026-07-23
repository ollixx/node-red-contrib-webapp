# Bindings & State

Wie Komponenten-Felder zu Live-Werten kommen: die Binding-Arten, Stores als
veränderbarer Client-State und die typischen Muster.

> English (canonical): [../../guides/bindings-state.md](../../guides/bindings-state.md)

## Ziel

Einen Text an ein Store-Slice binden, den Store aus dem Flow ändern und
wissen, welche Binding-Art in welcher Situation die richtige ist.

## Voraussetzungen

- Eine laufende erste App — [Erste Schritte](../getting-started.md).
- Die Struktur-Regel aus [Layout & Slots](layout-slots.md).

## Was ist ein Binding?

Fast jedes Wert-Feld im Editor (der **Value** eines Texts, die **Rows**
einer Tabelle, das **Src** eines Bildes, aber auch **Visible**,
**Disabled**, **Color**) ist ein **typedInput**: neben dem Feld wählst du,
*woher der Wert kommt*. Ein einfach getippter Wert ist ein **Literal**;
jede andere Art verbindet das Feld mit einer Live-Quelle, die die Seite
automatisch aktualisiert.

## Die Binding-Arten, nutzerorientiert

| Art | Liest aus | Typischer Einsatz |
|---|---|---|
| **Literal** (String/Zahl/Boolean/JSON/Timestamp) | dem konfigurierten Wert selbst | feste Labels, Defaults |
| **Store** | einem `ui-store` derselben App (per Knoten-Picker, optionaler Sub-Pfad) | Formular-Entwürfe, Auswahlen, Toggles — alles, was der Nutzer besitzt |
| **Query** | den geladenen Daten einer `ui-query` (`query:<pfad>`) oder ihrem Ladezustand via `.loading` / `.error` / `.status` / `.updatedAt` | Server-Daten: Listen, Detail-Datensätze — siehe [Daten anzeigen](displaying-data.md) |
| **Route-Param** | einem Parameter der aktiven Route (z. B. `id` aus `/customers/:id`) | Detailseiten |
| **User** | dem angemeldeten Benutzer (`id` / `name` / `email` / `groups`) — siehe [Auth](auth.md) | „Angemeldet als …", gruppenabhängige UI |
| **Reactive** | einem clientseitigen Ausdruck über `store(…)`, `query(…)`, Routen-Parameter und `user` | berechnete Werte, Bedingungen (`(user?.groups ?? []).includes("admins")`) |
| **msg** | einer Property der nächsten eingehenden Node-RED-Message am Input-Port des Knotens | flow-getriebene Updates; leer bis zur ersten Message |
| **JSONata** | einem JSONata-Ausdruck gegen die eingehende Message | Message-Daten umformen |
| **Flow / Global** | dem Node-RED-Flow-/Global-Context (server-seitig aufgelöst, einmal pro Render) | Instanz-weite Konfigurationswerte |
| **Env** | einer Umgebungsvariablen | Deployment-Konfiguration |

Jedes Binding kann einen **Fallback** tragen, der greift, solange die
Quelle nichts liefert (z. B. ein `user`-Binding ohne Identitätsquelle oder
ein `msg`-Binding vor der ersten Message).

Zwei Arten sind **scope-lokal** und erscheinen nur dort, wo sie Sinn
ergeben: **item**/**index** innerhalb eines `ui-repeat`-Templates und
**prop** innerhalb einer Komponenten-Definition — siehe
[Daten anzeigen](displaying-data.md) und
[Theming & Komponenten](theming-components.md).

## Stores: der veränderbare Client-State

Ein `ui-store` deklariert ein benanntes Slice des Client-States der App:

- **State Path** (`statePath`) — der Name des Slice, eindeutig pro App
  (z. B. `greeting`, `draft`). Ein Store kann beliebig verschachtelte Werte
  halten — mehr als eine Handvoll Stores braucht man selten.
- **Initial Value** — der Startwert des Slice; die `reset`-Operation stellt
  genau ihn wieder her.
- **Scope** — wer schreiben darf: `any` (Default), `broadcast-only`
  (geteilter Zustand: nur Schreibzugriffe ohne Client-Id) oder
  `client-only` (per-Client-Zustand: jeder Schreibzugriff braucht eine
  `msg.ui.clientId`). Verstöße werden mit einem strukturierten Fehler
  abgelehnt.

Komponenten **lesen** einen Store über das Store-Binding (Store-Knoten
wählen, optionaler Sub-Pfad wie `name` für eine Property). Komponenten
schreiben State nie direkt — geschrieben wird über Store-Operationen:

```js
// in einem function-Knoten, verdrahtet an den Input-Port des ui-store:
msg.ui = { store: { id: "gbsStore", op: "set", path: "name", value: "Ada" } };
return msg;
```

Die Operationen sind `set`, `patch` (Objekt-Merge), `delete`, `replace`
(ganzes Slice) und `reset`. Wer die Message nicht von Hand bauen will,
nimmt `ui-store-action` — derselbe Effekt, Store per Picker referenziert;
zu seinen zwei Modi siehe [Actions & Events](actions-events.md).

Ändert sich ein Store, aktualisiert sich jedes Binding darauf live in allen
verbundenen Browsern (per-Client, wenn die Operation eine `clientId` trug),
und der Store-Knoten emittiert eine `changed`-Notification am Output-Port,
auf die dein Flow reagieren kann (in eine Datenbank persistieren,
neu berechnen, …).

**Store oder Query?** Besitzt der Nutzer/das Formular den Wert (Entwurf,
Auswahl, Toggle) → Store. Lädt ihn der Server und die UI zeigt ihn nur an →
[`ui-query`](displaying-data.md) — mit Lade-Lebenszyklus, im UI read-only.

## Schritte

1. Erstelle eine App mit einem `ui-store` (State Path `greeting`,
   Initial Value `{"name":"World"}`).
2. Mounte einen `ui-text` und binde seinen **Value** an den Store mit
   Sub-Pfad `name`. Deploye und öffne — du siehst `World`.
3. Füge einen `ui-button` „Greet Ada" hinzu, verdrahtet an einen
   `function`-Knoten, der
   `msg.ui.store = { id: <store>, op: "set", path: "name", value: "Ada" }`
   an den Input des Stores schickt. Klick — der Text springt live auf
   `Ada`, in jedem offenen Tab.
4. Füge genauso einen „Reset"-Button mit `op: "reset"` hinzu — der Text
   kehrt zu `World` zurück.
5. Mounte einen weiteren `ui-text` mit einem **User**-Binding (Pfad
   `name`) und einem Fallback. Ohne Identitätsquelle zeigt er den
   Fallback — mit aktiviertem [Auth](auth.md) den angemeldeten Benutzer.

## Beispiel-Flow

Das fertige Ergebnis der Schritte:
[`examples/guide/bindings-state.json`](../../../../examples/guide/bindings-state.json)

1. In Node-RED das Menü (☰) → **Import** öffnen.
2. Die Datei `examples/guide/bindings-state.json` auswählen (oder ihr JSON
   einfügen) → **Import**.
3. **Deploy** klicken.
4. `http://<dein-node-red>:1880/webapp/bindingsApp/` öffnen — **Greet Ada**
   und **Reset** klicken und zusehen, wie sich der gebundene Text live
   aktualisiert.

## Wie weiter

- [Formulare](forms.md) — Inputs, die einen Store *lesen und schreiben*,
  ganz ohne Wiring.
- [Daten anzeigen](displaying-data.md) — Queries, Tabellen, Listen, Repeat.
- [Auth](auth.md) — die `user`-Quelle im Detail.

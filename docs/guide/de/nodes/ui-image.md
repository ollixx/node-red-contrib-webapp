# ui-image

Rendert ein Bild aus einer bindbaren Quelle — eine URL, ein verwaltetes Asset oder ein gepushter Buffer.

> English (canonical): [nodes/ui-image.md](../../nodes/ui-image.md)

## Zweck

`ui-image` rendert ein **Bild** an einem Mount-Ziel. Die Quelle (`src`) ist
bindbar — eine statische URL, ein Wert aus State/Query/Route-Param, ein
verwaltetes **Asset** aus dem Media-Store der App oder ein per Message
hereingereichter Buffer. Alt-Text, eine Fallback-URL für Ladefehler sowie
Breite/Höhe/Fit steuern Barrierefreiheit und Darstellung.

## Wann einsetzen

- Ein Logo, Produktfoto oder beliebiges Bild zeigen.
- Die Quelle an Daten binden (ein `state`/`query`-Feld mit einer URL).
- Ein hochgeladenes/verwaltetes Bild über den Media-Proxy der App ausliefern
  (`asset:`-Quelle).
- Einen Bild-Buffer aus einem Flow (HTTP-Request, Datei-Read) ins UI pushen.

## Das `src`-Quellenmodell

`src` nutzt den kanonischen Value-Binding-Satz **plus** einen `asset`-Typ:

- **URL** (`literal`) — eine statische oder dynamisch gebundene Bild-URL. `state`,
  `query`, `routeParam`, `store`, `reactive`, `msg`, `flow`, `global`, `jsonata`,
  `env` lösen alle zu einem URL-String auf.
- **Asset** — ein **verwaltetes Medium** aus dem Media-Store der App (in
  `ui-app.mediaStoreUrl` konfiguriert). Der Asset-Typ öffnet den Media-Picker
  (Durchsuchen/Upload) und speichert die Auswahl als `literal` `asset:<id>`; zur
  Laufzeit wird sie über den **Backend-Proxy** der App aufgelöst, sodass die echte
  Store-URL verborgen bleibt.
- **msg** (wiring-first) — `msg.payload` setzt die Quelle: ein **String** (URL,
  `asset:<id>` oder fertige `data:`-URL) wird unverändert übernommen; ein
  **Buffer** wird zu einer `data:`-URL konvertiert (Content-Type via
  `msg.contentType`/`msg.headers` oder Magic-Bytes). Hinweis: eine `data:`-/Base64-
  Quelle landet im Snapshot und wird bei jedem Render mitgeschickt — für
  kleine/seltene Bilder geeignet, große/häufige besser via URL/Asset.

## Felder

| Feld | Was es tut | Werte / Varianten | Default |
|---|---|---|---|
| **Name** | Anzeigename im Editor/in Pickern. | Freitext | `Image N` |
| **Parent Slot** (`mount`) | Slot, in den das Bild mountet. Pflicht. | Mount-Pfad | — |
| **Src** (`src`) | Die Bildquelle. Pflicht. | URL-Binding, `asset`, `msg`, … (siehe oben) | leeres Literal |
| **Alt Text** (`alt`) | Barrierefreiheits-Alt-Text (bindbar). Für rein dekorative Bilder leer lassen. | Binding | leer |
| **Fallback URL** (`fallbackSrc`) | Wird gezeigt, wenn `src` nicht lädt (bindbar). | Binding | leer |
| **Width** (`width`) | Komponentenbreite — Ganzzahl px oder CSS-String (`100%`, `12rem`). | Zahl / CSS | Parent-Layout |
| **Height** (`height`) | Komponentenhöhe — Ganzzahl px oder CSS-String. | Zahl / CSS | natürliches Verhältnis |
| **Fit** (`fit`) | object-fit-Modus. | `contain`, `cover`, `fill`, `none` oder Browser-Default | Browser-Default |
| **Visible** (`visible`) | Render-Gate (bindbar). | Binding | sichtbar |
| **Reihenfolge / Zeile / Spalte / Spannen / X·Y** | Platzierung im Parent-Slot. | Zahlen | Canvas-y |

`Disabled`, `Color` und `Size` sind N/A (ein Bild hat keinen interaktiven
Zustand, keine Farbe und keine Größen-Stufen).

## Eingang

`ui-image` **hat einen Eingangs-Port**:

- **`msg.payload`** (nicht-`null`) setzt `src` (String unverändert; Buffer →
  `data:`-URL) und pusht einen Snapshot an alle Clients.
- **`msg.ui.patch`** überschreibt Felder (`src`, `alt`, `fit`, `width`, `height`);
  Binding-Felder (`src`) als Binding-Objekt.
- **Component-State-Ops** (`msg.ui.component.op`): `show` / `hide`.
- Nicht erkannte / fachfremde Messages werden **unverändert durchgereicht**.

## Ausgänge / Events

Keine — `ui-image` hat keinen Output-Port und emittiert keine Events.

## Beispiele

### 1. Statisches Bild mit Alt und Fallback

Ein Bild mit gebundenem `src`, Alt-Text, Fallback-URL und `fit = contain`.

Flow-Datei: [`examples/guide/ui-image.json`](../../../../examples/guide/ui-image.json)

Import-Anleitung:

1. In Node-RED Menü (☰) → **Import**.
2. `examples/guide/ui-image.json` wählen (oder JSON einfügen) → **Import**.
3. **Deploy** klicken.
4. `http://<dein-node-red>:1880/webapp/guideImage/` öffnen — das Bild rendert in
   der konfigurierten Größe.

## Verwandt

- [Bindings & State](../guides/bindings-state.md) — die Binding-Arten
- `ui-icon` — ein Vektor-Icon (kein Rasterbild); `ui-avatar` — ein Personenbild
- Contract-Doc (intern, deutsch): `docs/nodes/display/ui-image.md`

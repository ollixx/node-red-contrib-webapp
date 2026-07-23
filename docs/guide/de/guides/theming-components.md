# Theming & Komponenten

Ein Token-Set themet alles; Varianten wählen semantische Rollen;
Komponenten-Definitionen machen Teilbäume wiederverwendbar.

> English (canonical): [../../guides/theming-components.md](../../guides/theming-components.md)

## Ziel

Einer App über Design-Tokens ihren eigenen Look geben, das
Variant-vs.-Color-Modell verstehen und eine wiederverwendbare
Karten-Komponente bauen, die zweimal mit unterschiedlichen Props
gerendert wird.

## Voraussetzungen

- [Layout & Slots](layout-slots.md) und
  [Bindings & State](bindings-state.md).

## Design-Tokens: das Theme

Ein Theme ist ein flacher Satz benannter Werte, konfiguriert am
`ui-app`-Knoten (**Design Tokens**-Dialog). Jedes Token mappt auf eine
CSS Custom Property (`--wa-*`), die jede Komponente konsumiert:

| Token-Gruppe | Beispiele | CSS-Variablen |
|---|---|---|
| Semantische Farben | `colorPrimary`/`colorPrimaryFg`, `colorSuccess`, `colorWarning`, `colorDanger`, `colorNeutral` | `--wa-color-primary`, `--wa-color-primary-fg`, … |
| Flächen & Text | `colorBackground`, `colorSurface`, `colorBorder`, `colorText`, `colorTextMuted` | `--wa-color-background`, … |
| Typografie | `fontFamily`, `fontSizeBase`, `fontWeightNormal`/`Bold`, `lineHeightBase` | `--wa-font-family`, … |
| Abstände & Radien | `spacingUnit`, `radiusSm`/`Md`/`Lg`/`Full` | `--wa-spacing-unit`, `--wa-radius-md`, … |

Das Theme ist additiv: setze nur, was du ändern willst; alles andere
fällt auf die System-Defaults zurück. Eine Token-Änderung stylt die
ganze App um — eigene wie zugrundeliegende Web-Components.

## Varianten und Farben

Zwei Felder steuern das Aussehen einer Komponente, und ein Knoten bietet
**eines davon, nie beide**:

- **Variant** — eine semantische *Rolle* aus dem festen Vokabular des
  Knotens: `ui-button` hat `primary`, `secondary`, `success`, `danger`,
  `warning`, `neutral`, `ghost`, `link`; `ui-text` hat `heading-1..3`,
  `body`, `caption`, `label`, `code`, `muted`; und so weiter. Das Theme
  entscheidet, wie eine Rolle aussieht — ein `primary`-Button folgt
  `colorPrimary`, wohin die App auch geht.
- **Color** — die Obermenge für Knoten ohne Variant: dieselben
  Theme-Tokens **plus jede beliebige Farbe**. Das Feld bietet drei
  Autoren-Wege: ein **Theme-Token** wählen (gespeichert als
  `token:primary` usw. — es folgt weiter dem Theme), eine **beliebige
  CSS-Farbe** wählen oder tippen (fix, theme-unabhängig), oder die Farbe
  an eine Live-Quelle **binden**.

Faustregel: bevorzuge Varianten/Tokens — sie halten die App konsistent
und re-themebar. Greife nur zur freien Farbe, wenn das Design wirklich
genau diesen Wert verlangt.

## Wiederverwendbare Komponenten

Ein wiederkehrender Teilbaum (eine Karte, eine beschriftete Kennzahl,
eine Listenzeile) wird zur **Komponente**:

- **`ui-component-definition`** — ein Off-Canvas-Template. Mounte seine
  Kinder in den Template-Slot der Definition; innen liest die
  Binding-Art **prop** einen benannten Parameter (`prop.title`,
  `prop.body`). Die Definition selbst rendert nie.
- **`ui-component-instance`** — mountet wie ein normaler View-Knoten
  irgendwohin, referenziert eine Definition und setzt eine
  **Props**-Map (Name → Wert; jede Binding-Art — ein Prop kann Literal,
  Store-Binding, … sein). Jede Instanz rendert das Template mit ihren
  eigenen Prop-Werten; ein store-gebundenes Prop aktualisiert diese
  Instanz live.

Komponenten sind Props-rein/Events-raus: Events von Knoten innerhalb
einer Instanz tragen die Identität der Instanz, sodass dein Flow die
Klone auseinanderhalten kann.

## Schritte

1. Erstelle eine App und öffne ihre **Design Tokens**: setze
   `colorPrimary` auf `#7c3aed` (und z. B. `radiusMd` auf `12px`).
   Deploy — alles Primäre in der App ist jetzt violett.
2. Mounte einen `ui-text` mit Variant `heading-2` und zwei `ui-button`
   mit den Varianten `primary` und `danger`. Der Primary-Button trägt
   die Theme-Farbe; der Danger-Button das Danger-Token.
3. Mounte zwei `ui-divider` mit Label: gib einem das **Color**-Token
   `primary` (es folgt dem Theme), dem anderen eine feste Farbe wie
   `#e91e63` (sie ändert sich nie). Färbe das Theme um und beobachte
   den Unterschied.
4. Erstelle eine `ui-component-definition` „Card" mit zwei
   `ui-text`-Kindern, gebunden an `prop.title` und `prop.body`. Mounte
   zwei `ui-component-instance` mit unterschiedlichen Title/Body-Props
   in den App-Content. Deploy: dasselbe Template rendert zweimal mit
   unterschiedlichem Inhalt.

## Beispiel-Flow

Das fertige Ergebnis der Schritte:
[`examples/guide/theming-components.json`](../../../../examples/guide/theming-components.json)

1. In Node-RED das Menü (☰) → **Import** öffnen.
2. Die Datei `examples/guide/theming-components.json` auswählen (oder
   ihr JSON einfügen) → **Import**.
3. **Deploy** klicken.
4. `http://<dein-node-red>:1880/webapp/themeApp/` öffnen — violettes
   Primary-Styling, die zwei Divider und die zweimal gerenderte Karte.

## Wie weiter

- [Daten anzeigen](displaying-data.md) — Komponenten mit `ui-repeat` zu
  datengetriebenen Karten kombinieren.
- Knoten-Referenz: siehe die Knoten-Liste im
  [Guide-Zuhause](../README.md#inhalt).

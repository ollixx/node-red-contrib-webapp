# ui-avatar

Zeigt ein Benutzer-Bild oder — als Fallback — Initialen, dann ein generisches Icon.

> English (canonical): [nodes/ui-avatar.md](../../nodes/ui-avatar.md)

## Zweck

`ui-avatar` zeigt ein **Benutzer-Bild** oder — als Fallback — **Initialen**, und
wenn keines auflöst, ein generisches Nutzer-Icon. Sowohl Bildquelle als auch
Initialen sind bindbar, sodass der Avatar dem aktuellen Nutzer oder den Daten
einer Zeile folgen kann. Rein präsentational, emittiert keine Events.

## Wann einsetzen

- Das Bild des angemeldeten Nutzers zeigen (`image` an einen `user`/Store-Wert binden).
- Initialen rendern, wenn kein Bild verfügbar ist (Kontaktliste, Kommentar-Autor).
- Jeder Zeile eines `ui-repeat` einen eigenen Avatar aus Item-Daten geben.

## Felder

| Feld | Was es tut | Werte / Varianten | Default |
|---|---|---|---|
| **Name** | Anzeigename im Editor/in Pickern. | Freitext | `Avatar N` |
| **Parent Slot** (`mount`) | Slot, in den der Avatar mountet. Pflicht. | Mount-Pfad | — |
| **Image** (`src`) | Die Avatar-Bildquelle (bindbar). | `URL` (literal), `Asset` (verwaltetes Medium, wenn `ui-app.mediaStoreUrl` gesetzt), `store`, und jede andere Binding-Art | leer |
| **Fallback Initials** (`initials`) | Initialen, wenn kein Bild auflöst (bindbar, z. B. `JD`). | kanonisches Value-Binding | leer |
| **Fallback Icon** (`icon`) | Backend-neutrales Icon, wenn weder Bild noch Initialen auflösen. | `library:name` (bindbar) | leer (generisches Icon) |
| **Size** (`size`) | Avatar-Größe. | `xs`, `sm`, `md`, `lg`, `xl` | `md` |
| **Shape** (`shape`) | Avatar-Form. | `circle`, `square` | `circle` |
| **Variant** (`variant`) | Semantische Farbrolle. Hinweis: `sl-avatar` hat kein natives Variant — als `data-variant` ausgegeben (ein Bootstrap-Adapter oder eigenes CSS liest es). | keine, `primary`, `neutral`, `success`, `info`, `warning`, `danger` | keine |
| **Visible / Color** | Basis-Felder (bindbar). | Binding / Wert | sichtbar / Theme |
| **Reihenfolge / Zeile / Spalte / Spannen / X·Y** | Platzierung im Parent-Slot. | Zahlen | Canvas-y |

`Disabled` ist N/A (ein Avatar hat keinen interaktiven Zustand).

## Die Fallback-Reihenfolge

1. `image` ist gesetzt und lädt → Bild anzeigen.
2. `image` fehlt oder schlägt fehl → `initials` anzeigen (falls gesetzt).
3. Keine Initialen → `icon`-Fallback anzeigen (falls gesetzt), sonst das
   generische Nutzer-Icon des Backends.

## Eingang

`ui-avatar` **hat einen Eingangs-Port**:

- **`msg.payload`** (nicht-`null`) überschreibt `src` (die primäre Bild-URL) und
  pusht einen Snapshot an alle Clients.
- **`msg.ui.component.op`** (`show` / `hide`) — blendet den Avatar ein/aus.
- **`msg.ui.patch`** — überschreibt Felder (Binding-Felder als Binding-Objekt).
- Nicht erkannte / fachfremde Messages werden **unverändert durchgereicht**.

## Ausgänge / Events

Keine — `ui-avatar` hat keinen Output-Port und emittiert keine Events.

## Beispiele

### 1. Ein Initialen-Avatar

Ein Avatar ohne Bild, der Initialen `AD` als Kreis in Größe `lg` mit Variant
`primary` zeigt; ein Fallback-Icon deckt den Fall ohne Initialen ab.

Flow-Datei: [`examples/guide/ui-avatar.json`](../../../../examples/guide/ui-avatar.json)

Import-Anleitung:

1. In Node-RED Menü (☰) → **Import**.
2. `examples/guide/ui-avatar.json` wählen (oder JSON einfügen) → **Import**.
3. **Deploy** klicken.
4. `http://<dein-node-red>:1880/webapp/guideAvatar/` öffnen — der Avatar zeigt die
   Initialen.

## Verwandt

- [`ui-image`](ui-image.md) — ein einfaches Bild; [`ui-icon`](ui-icon.md) — ein Vektor-Icon
- [Bindings & State](../guides/bindings-state.md) — das `user`-Binding, Stores
- Contract-Doc (intern, deutsch): `docs/nodes/display/ui-avatar.md`

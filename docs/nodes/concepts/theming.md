# Theming und Komponenten-Architektur

## Grundprinzip: Drei Ebenen

Theming und Komponenten sind zwei separate Konzepte, die oft vermischt werden.
Diese Lib trennt sie in drei Ebenen:

```
Ebene 1: Design-Tokens        ← Farben, Abstände, Typographie, Radii (als CSS Custom Properties)
Ebene 2: Komponenten-Variants ← semantische Varianten (primary, danger, ghost, …)
Ebene 3: Renderer-Adapter     ← Web-Component-Adapter (Shoelace) — backend-agnostisches Modell
```

---

## Ebene 1: Design-Tokens

Ein Theme ist ein Satz benannter Variablen — keine festen CSS-Klassen, keine
hart codierten Farben. Die Tokens werden als **CSS Custom Properties** (`--wa-*`)
in ein `:root { }`-Block injiziert (`buildDesignTokenCss`). Alle Komponenten
konsumieren ausschließlich diese Tokens.

Das Token-Set ist ein **flaches** Objekt (`designTokensSchema` in
`packages/schema/src/node-definitions.ts`); jeder Schlüssel mappt 1:1 auf eine
CSS-Variable (`DESIGN_TOKEN_CSS_VARS`):

| Token-Feld | CSS-Variable |
|---|---|
| `colorPrimary` / `colorPrimaryFg` | `--wa-color-primary` / `--wa-color-primary-fg` |
| `colorSuccess` / `colorSuccessFg` | `--wa-color-success` / `--wa-color-success-fg` |
| `colorWarning` / `colorWarningFg` | `--wa-color-warning` / `--wa-color-warning-fg` |
| `colorDanger` / `colorDangerFg` | `--wa-color-danger` / `--wa-color-danger-fg` |
| `colorNeutral` / `colorNeutralFg` | `--wa-color-neutral` / `--wa-color-neutral-fg` |
| `colorBackground`, `colorSurface`, `colorBorder` | `--wa-color-background`, `--wa-color-surface`, `--wa-color-border` |
| `colorText`, `colorTextMuted` | `--wa-color-text`, `--wa-color-text-muted` |
| `fontFamily`, `fontSizeBase` | `--wa-font-family`, `--wa-font-size-base` |
| `fontWeightNormal`, `fontWeightBold`, `lineHeightBase` | `--wa-font-weight-normal`, `--wa-font-weight-bold`, `--wa-line-height-base` |
| `spacingUnit` | `--wa-spacing-unit` |
| `radiusSm`, `radiusMd`, `radiusLg`, `radiusFull` | `--wa-radius-sm`, `--wa-radius-md`, `--wa-radius-lg`, `--wa-radius-full` |

Der App-Autor konfiguriert die Tokens am `ui-app`-Knoten im Feld `tokens`
(visueller Token-Editor-Dialog, P40). Nicht gesetzte Tokens fallen auf die
System-Defaults zurück; das Theme ist additiv — man überschreibt nur, was man
ändern will.

---

## Ebene 2: Komponenten-Variants

Variants sind semantische Rollen, die ein Component einnimmt. Sie sind vom Theme
unabhängig — das Theme entscheidet, *wie* `primary` aussieht; der Variant
entscheidet, welche *Rolle* ein Element spielt.

**Single Source of Truth.** Das Vokabular pro Knoten ist im Schema als
exportierte Konstante festgeschrieben (`BUTTON_VARIANTS`, `TEXT_VARIANTS`,
`CONTAINER_VARIANTS`, `INPUT_VARIANTS`, `SEVERITY_VARIANTS` in
`packages/schema/src/contracts.ts`, gebündelt in `COMPONENT_VARIANT_VOCABULARY`).
Editor-SelectBox und Serializer importieren dieselben Konstanten — die folgenden
Listen spiegeln sie nur wider.

**`ui-button`** (`BUTTON_VARIANTS`, Default `neutral`):
- `primary`, `secondary`, `success`, `danger`, `warning`, `neutral`, `ghost`, `link`

**`ui-text`** (`TEXT_VARIANTS`, Default `body`):
- `heading-1`, `heading-2`, `heading-3`, `body`, `caption`, `label`, `code`, `muted`

**`ui-container`** (`CONTAINER_VARIANTS`, Default `card`):
- `card`, `panel`, `section`, `transparent`

**`ui-input`** (`INPUT_VARIANTS`, Default `default`):
- `default`, `filled`, `outlined`

**`ui-badge`** (`BADGE_VARIANTS = SEVERITY_VARIANTS`; Default `neutral`):
- `primary`, `success`, `warning`, `danger`, `neutral`, `info` — im Feld **`variant`**.

**`ui-alert`** (`ALERT_VARIANTS = SEVERITY_VARIANTS`; Default `primary`):
- `primary`, `success`, `warning`, `danger`, `neutral`, `info` — im Feld **`severity`**.

> `info` ist in beiden Fällen ein **eigenständiger** Wert (kein Alias von `primary`).
> `ui-badge` trägt die semantische Farbrolle seit P92 im Feld `variant` (früher `severity`).

### `variant` vs. `color` — die Reduktion und die Obermenge (P238, ADR 0039)

`variant` ist die **Reduktion** auf die üblichen Theme-Tokens. Das Basis-Feld
`color` bietet **dieselben Tokens und darüber hinaus jede Farbe** — es ist damit
die **Obermenge** von `variant`. Beide sind **wechselseitig exklusiv**
([ADR 0015](../../adr/0015-common-base-fields-and-editor-structure.md) §1): ein
Knoten bietet `variant` **oder** `color`, nie beides. Trägt ein Knoten `variant`,
zeigt der Editor `color` als N/A („Nutzt die semantische Variant").

**Das `color`-Standard-Control — ein Control, drei Autoren-Wege**
([ADR 0039](../../adr/0039-colour-field-model-color-is-tokens-plus-any-colour-variant-is-the-reduction.md)
§1). Überall, wo `color` gilt (~30 Knoten, gemeinsamer Helper
`installBaseFields`), bietet das Feld:

1. **Theme-Token** — das semantische Farb-Vokabular (`COLOR_TOKENS` in
   `packages/schema/src/contracts.ts`), aufgelöst gegen die Design-Tokens der App.
2. **Farbe** — beliebige Farbe über den Color-Selector (HSB/RGB/Web) oder als
   getippter CSS-Wert.
3. **Binding** — der volle kanonische Satz
   ([ADR 0012](../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md)).
   Eine gebundene Farbe ändert sich **live** (SSE-Re-Render).

**Repräsentation.** Ein Token wird als **präfixiertes Literal** `token:<name>`
persistiert — ein gewöhnliches `{kind:"literal"}`-Binding, keine neue Schema-Art
(Präzedenz: `asset:<id>` auf `ui-image.src`). Das Präfix hält Token und Farbe
**eindeutig** auseinander: ein nacktes `primary` ist **kein** gültiger CSS-Wert
und darf nie roh ins DOM gelangen.

**Auflösung** (`resolveColorValue`, `resources/lib/webapp-serializer.js` — der
gemeinsame Helper für alle Knoten):

| `color`-Wert | gerendert als |
|---|---|
| `token:primary` / `token:success` / `token:warning` / `token:danger` / `token:neutral` | `var(--wa-color-<token>)` |
| `token:info` | `var(--wa-color-primary)` (Alias — es gibt kein `--wa-color-info`) |
| `token:muted` | `var(--wa-color-text-muted)` |
| `#ff0000`, `rgb(…)`, `hsl(…)`, `red`, `var(…)` | unverändert durchgereicht |
| leer / unbekannt | **kein** Style-Attribut (nie ungültiges CSS) |

Ein Token folgt damit dem Theme: `designTokens` am `ui-app` überschreiben
`--wa-color-*` (Ebene 1 oben), also ändert sich die Token-Farbe mit dem Theme —
eine freie Farbe ist fix.

**Vokabular.** `COLOR_TOKENS` = `primary`, `success`, `warning`, `danger`,
`neutral`, `info`, `muted` — **nur Farben**. Die Nicht-Farb-Ausprägungen der
Variant-Vokabulare (`ghost`/`link` bei `ui-button`, `line`/`contained`/`pills`
bei `ui-tabs`) gehören **nicht** dazu: eine Farbe kann sie nicht ausdrücken, sie
sind `variant`-Sache (ADR 0039 §2). `default` aus `TEXT_COLOR_VARIANTS` fehlt
bewusst — „erbt die umgebende Farbe" ist genau das, was ein **leeres** `color`
bereits bedeutet.

### Variant vs. displayType

Einige Knoten haben ein Feld, das in Wahrheit ein **Darstellungstyp** ist, keine
Ebene-2-Rolle. Diese gehören **nicht** ins Variant-Vokabular und liegen im Feld
`displayType`:

| Knoten | `displayType`-Werte |
|---|---|
| `ui-progress` | `bar`, `spinner`, `circular` |
| `ui-skeleton` | `text`, `avatar`, `card`, `table` |
| `ui-badge` (Form) | `rounded` (Default), `pill`, `square` |
| `ui-menu` | `sidebar`, `topbar`, `dropdown` |
| `ui-list` | `plain` (Default), `divided`, `grouped`, `actionable` — semantic intents (P180 / ADR 0021); migration: `default`→`plain`, `compact`→`plain` |

### Regeln für den Adapter (Ebene 3)

Das Vokabular ist **fest und portabel** — es gehört zum Komponenten-Contract,
nicht zum Adapter. Daraus folgen drei harte Regeln:

1. **Many-to-one ist erlaubt.** Der Adapter darf mehrere Varianten auf dasselbe Ausgabe-Token abbilden (z. B. Shoelace: `ghost` → `default`, `link` → `text`; `secondary` + `neutral` → `neutral`).
2. **Graceful degradation, kein Pass-through.** Ein unbekannter Wert fällt auf den dokumentierten Default des Knotens zurück — nie ein Crash, nie rohes Durchreichen.
3. **Der Adapter erweitert das Vokabular NIE.** Fehlt eine Rolle, gehört sie ins Schema-Vokabular, nicht in den Adapter.

---

## Ebene 3: Renderer-Adapter (Shoelace)

Der Adapter übersetzt das interne, backend-agnostische Komponenten-Modell in
konkrete Web-Components. Aktuell gibt es **einen** Adapter: **Shoelace**
(`packages/renderer/src/shoelace-adapter.ts`, ADR 0002). Die Shoelace-Assets sind
lokal vendored — kein CDN (ADR 0008).

```
ui-button { variant: "primary", label: "Speichern" }
  ↓ Shoelace-Adapter
<sl-button variant="primary">Speichern</sl-button>
```

**Token-Bridge.** Damit das in Ebene 1 konfigurierte Theme auch die
Shoelace-Komponenten erreicht, mappt eine Bridge die `--wa-*`-Tokens auf die
`--sl-*`-Custom-Properties von Shoelace (P62). So steuert ein einziges
Token-Set sowohl die eigenen als auch die Shoelace-Stile.

> Hinweis: Das Modell ist bewusst backend-agnostisch gehalten (semantische Props
> + Varianten), damit ein anderer Adapter prinzipiell möglich bleibt. Ein
> austauschbares Backend (Material/Bootstrap/…) ist heute aber **nicht**
> implementiert — Shoelace ist der einzige Adapter, und es gibt kein
> `adapter`/`backend`-Konfigurationsfeld.
>
> **Achsen-Abgrenzung.** „Theme" meint im engen Sinn **Ebene 1 (Tokens)** —
> Farbe/Typografie/Radii. Der **Adapter/Backend** (Ebene 3, das GUI-*Framework*)
> ist eine eigene Achse; seine Fähigkeits-Unterschiede und das Verhalten bei nicht
> nativ unterstützten Feldern sind in [backend-support.md](backend-support.md)
> beschrieben. Ein Framework-Wechsel ist **kein** Theme.

---

## Konfiguration am `ui-app`-Knoten

```yaml
ui-app:
  root: myapp
  layout: app
  tokens:
    colorPrimary: "#7c3aed"
    colorPrimaryFg: "#ffffff"
    colorDanger: "#dc2626"
    fontFamily: "Geist, system-ui, sans-serif"
    radiusMd: "12px"
```

Nicht angegebene Tokens fallen auf die System-Defaults zurück.

---

## `ui-style` als Escape-Hatch (geplant)

Für den Ausnahmefall, dass ein einzelnes Element vom Theme abweichen muss, ohne
dass ein neues Variant sinnvoll ist, ist ein `ui-style`-Knoten angedacht
(spätere Version, **noch nicht implementiert**). **Faustregel:** Wer ihn häufig
bräuchte, hat wahrscheinlich ein fehlendes Variant oder einen fehlenden Token.

---

## Offene Punkte

- Dark Mode: eigenes Token-Set oder automatische Invertierung?
- Animationen/Transitions als eigene Token-Kategorie?
- Token-Vererbung: kann eine Route ein Teil-Theme nur für ihre Kinder überschreiben?

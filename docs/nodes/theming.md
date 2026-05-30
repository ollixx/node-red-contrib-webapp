# Theming und Komponenten-Architektur

## Grundprinzip: Drei Ebenen

Theming und Komponenten sind zwei separate Konzepte die oft vermischt werden. Diese Lib trennt sie sauber in drei unabhängige Ebenen:

```
Ebene 1: Design-Tokens        ← Farben, Abstände, Typographie, Radii
Ebene 2: Komponenten-Variants ← semantische Varianten (primary, danger, ghost...)
Ebene 3: Renderer-Backend     ← optional: Material / Bootstrap / eigenes CSS
```

---

## Ebene 1: Design-Tokens

Ein Theme ist zunächst ein Satz benannter Variablen — keine festen CSS-Klassen, keine hart codierten Farben. Die Tokens werden als CSS Custom Properties ins Dokument injiziert.

Beispiel-Token-Set:

```yaml
colors:
  primary:    "#2563eb"
  secondary:  "#64748b"
  danger:     "#dc2626"
  success:    "#16a34a"
  surface:    "#ffffff"
  background: "#f8fafc"
  text:       "#0f172a"
  textMuted:  "#64748b"
  border:     "#e2e8f0"

typography:
  fontFamily: "Inter, system-ui, sans-serif"
  fontSize:   "14px"
  lineHeight: "1.5"

spacing:
  base: "4px"   # alle Abstände sind Vielfache davon

radii:
  sm: "4px"
  md: "8px"
  lg: "16px"
```

Der App-Autor konfiguriert das Theme am `ui-app`-Knoten. Alle Komponenten konsumieren ausschließlich diese Tokens — keine direkten Farbwerte.

---

## Ebene 2: Komponenten-Variants

Variants sind semantische Rollen die ein Component einnehmen kann. Sie sind vom Theme unabhängig — das Theme entscheidet wie `primary` aussieht, der Variant entscheidet welche Rolle ein Element spielt.

**`ui-button` Variants:**
- `primary` — Hauptaktion (Submit, Speichern)
- `secondary` — Nebenaction (Abbrechen, Zurück)
- `danger` — destruktive Aktion (Löschen)
- `ghost` — dezente Aktion (Icons, Links)
- `link` — rein textuelle Aktion

**`ui-text` Variants:**
- `heading-1`, `heading-2`, `heading-3`
- `body`, `caption`, `label`
- `code`, `muted`

**`ui-container` Variants:**
- `card` — erhöhte Fläche mit Shadow
- `panel` — flache abgegrenzte Fläche
- `section` — Seitenabschnitt mit Padding
- `transparent` — kein visueller Rahmen

**`ui-input` Variants:**
- `default`, `filled`, `outlined`

Das Variant-System verhindert direkte Style-Overrides — wenn ein Element vom Theme abweichen muss, ist das meistens ein Signal dass ein neues Variant fehlt.

---

## Ebene 3: Renderer-Backend (optional)

Das Renderer-Backend bestimmt welche HTML-Strukturen und CSS-Klassen für Komponenten erzeugt werden. Es ist der einzige Punkt wo externe Frameworks eingehängt werden können.

### Eingebautes Backend: `webapp-default`

Die Lib liefert ein eigenes schlankes Backend mit. Es implementiert alle Komponenten gegen die Design-Tokens aus Ebene 1. Kein externes Framework, keine Abhängigkeit.

### Austauschbare Backends (Community / später)

Ein Backend ist ein npm-Paket das das Backend-Interface implementiert. Beispiele:

| Backend-Paket | Basis | Status |
|---|---|---|
| `webapp-backend-default` | eigenes CSS | eingebaut |
| `webapp-backend-material` | Material Design | geplant |
| `webapp-backend-bootstrap` | Bootstrap 5 | geplant |
| `webapp-backend-ant` | Ant Design | Community |
| `webapp-backend-shadcn` | shadcn/ui | Community |

Das Backend wird am `ui-app`-Knoten konfiguriert:

```
ui-app:
  theme: { ... }         ← Ebene 1: Tokens
  backend: "material"    ← Ebene 3: Renderer-Backend
```

Wenn kein Backend angegeben ist, greift `webapp-default`.

### Was ein Backend implementiert

Ein Backend übersetzt das interne Komponenten-Modell in konkrete HTML-Strukturen:

```
ui-button { variant: "primary", label: "Speichern" }
  ↓ webapp-default
<button class="wb-btn wb-btn--primary">Speichern</button>

  ↓ webapp-backend-material
<button class="mdc-button mdc-button--raised"><span>Speichern</span></button>

  ↓ webapp-backend-bootstrap
<button class="btn btn-primary">Speichern</button>
```

Design-Tokens aus Ebene 1 fließen immer ein — auch Material- und Bootstrap-Backends nutzen die konfigurierten Primärfarben.

---

## Konfiguration am `ui-app`-Knoten

```yaml
ui-app:
  root: myapp
  layout: app
  theme:
    colors:
      primary: "#7c3aed"
      danger:  "#dc2626"
    typography:
      fontFamily: "Geist, sans-serif"
    radii:
      md: "12px"
  backend: webapp-default   # optional, default wenn weggelassen
```

Nicht angegebene Tokens fallen auf die System-Defaults zurück. Das Theme ist additiv — man überschreibt nur was man ändern will.

---

## `ui-style` als Escape-Hatch

Wenn ein einzelnes Element vom Theme abweichen muss ohne dass dafür ein neues Variant sinnvoll ist, gibt es den `ui-style`-Knoten (spätere Version). Er erlaubt direkte Token-Overrides oder zusätzliche CSS-Klassen für ein einzelnes Element.

**Faustregel:** Wer `ui-style` häufig braucht, hat wahrscheinlich ein fehlendes Variant oder einen fehlenden Token. `ui-style` ist der Ausnahmefall, nicht der Normalweg.

---

## Offene Punkte

- Wie werden Tokens an das Node-RED-Editor-UI weitergegeben, damit die Vorschau im Editor das richtige Theme zeigt?
- Dark Mode: eigenes Token-Set oder automatische Invertierung?
- Animationen und Transitions als eigene Token-Kategorie?
- Backend-Interface-Spezifikation: was muss ein Community-Backend implementieren?
- Token-Vererbung: kann eine Route ein Teil-Theme überschreiben das nur für ihre Kinder gilt?

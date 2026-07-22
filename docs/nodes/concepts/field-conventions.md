# Feld-Konventionen (Namen + Carrier)

Diese Datei hält den **knotenübergreifenden** Feld-Modell-Vertrag fest: wie ein
Feld heißt und welches Carrier-Muster es verwendet. Sie ergänzt
[editor.md](editor.md) (Editor-Helfer) und [layout.md](layout.md)
(Platzierungs-Boilerplate) um die Regeln, die **über alle Knoten hinweg** gelten.

> Rationale: [ADR 0038](../../adr/0038-field-model-consistency-naming-and-carrier-normalization.md).
> Ein Cross-Node-Audit (Session 2026-07-14, 45 Knoten × 128 Felder, 127/128
> Felder verifiziert konsumiert) zeigte, dass die Felder inkonsistent benannt
> sind, ohne dass etwas die **knotenübergreifende Kohärenz** prüft:
> [`check:specs`](editor.md) erzwingt nur `defaults`↔Spec **pro Knoten**. Diese
> Konvention macht den Zielzustand explizit; der Tripwire `pnpm check:fields`
> (`scripts/check-fields.js`) erzwingt ihn.

> **Migrations-Reihenfolge.** Dieses Dokument beschreibt den **Zielzustand**. Der
> **Legacy-Sweep ist abgeschlossen (P229, 2026-07-22)**: `*Path`/`*Json`/totes
> `storeId`/`path`/Pagination-Aliase sind aus allen `defaults` entfernt und
> `ui-textarea.rows` heißt `lines` (Migration bleibt, siehe unten). Die
> **`parent` → `app`-Welle ist abgeschlossen (P228, 2026-07-22)**: das
> Besitz-Feld heißt in allen 42 Nicht-App-`defaults` `app`; Laufzeit und Editor
> lesen das Legacy-`parent` weiter (Migration beim Öffnen/Speichern), und
> `check:fields` Regel (c) verbietet ein neues `parent`-Referenzfeld. Es fehlen
> nur noch die `*Id`-Umbenennungen (`layoutId`/`routeId`/`definitionId` → bloßer
> Name) aus **P259**; deren Einträge trägt die **kuratierte Allowlist** in
> `scripts/check-fields.js` noch (je eine Ein-Zeilen-Begründung), damit
> `pnpm validate` grün bleibt; P259 schrumpft die Liste auf leer.

---

## Namensregeln

### Referenz-Felder tragen den **bloßen** Konzeptnamen

Ein Feld, dessen Wert die **Id eines anderen Knotens** ist, heißt wie das
Konzept — **ohne** `Id`-Suffix; der Wert *ist* die Id, wie bei `store` und
`mount`:

| Zielzustand | statt (Legacy) | referenziert |
|---|---|---|
| `store`     | `storeId`      | einen `ui-store` |
| `layout`    | `layoutId`     | ein Layout-Preset |
| `route`     | `routeId`      | eine `ui-route` |
| `definition`| `definitionId` | eine `ui-component-definition` |

**Ausnahmen (kein Referenz-Feld, `Id`-Suffix bleibt):**

- `uiId` — die **eigene** stabile Instanz-Id eines Knotens, keine Referenz.
- `selectedId` — ein **ausgewählter Wert** (die Id des selektierten Datensatzes),
  keine Knoten-Referenz.

### `app` = besitzende App, `mount` = Render-Slot

- **`app`** benennt die **besitzende App-Id** (auf jedem Nicht-App-Knoten). Das
  frühere `parent` war irreführend benannt — es hielt nie einen Slot-Parent,
  sondern die App-Id. (Umbenannt in P228; das Legacy-`parent` bleibt überall
  **lesbar** — Laufzeit-Fallback + Editor-Migration beim Öffnen/Speichern —
  wird aber nirgendwo mehr geschrieben.)
- **`mount`** ist der **Render-Slot** (`<typ>:<id>/<slot>`), siehe
  [layout.md](layout.md). Ein Knoten deklariert entweder `mount` (Render-Knoten)
  oder trägt `app` (Logik-Knoten); Render-Knoten dürfen zusätzlich `app` für
  O(1)-Scoping tragen.

---

## Carrier-Regel: genau **ein** Binding-Muster

Ein bindbares Feld `<base>` besteht aus **zwei** Feldern und nur diesen:

- **`<base>`** — das Binding-**Objekt** (der aufgelöste Wert / die Literale).
- **`<base>Binding`** — der **Editor-typedInput-Carrier**, der das Binding über
  `oneditsave` treibt (siehe [editor.md](editor.md), ADR 0012).

Der frühere `<base>Path`-Zwilling ist **entfernt** — der Binding-Pfad (ADR 0012)
ist kanonisch. Es darf **kein** `<base>Path`-Default mehr geben, wenn
`<base>Binding` existiert. Ebenso entfernt sind die rohen JSON-Authoring-Carrier
`<base>Json` (`optionsJson`, `itemsJson`).

> **Status: abgeschlossen (P229, 2026-07-22).** Der Legacy-Sweep ist gelaufen:
> kein `ui-*`-Knoten trägt mehr einen `<base>Path`-, `*Json`-, `storeId`/`path`-
> oder Pagination-Alias-Default. Die `check:fields`-Allowlist enthält nur noch
> die P228-Rename-Einträge.

### Migration-only Felder (`migrationFields`, P229)

Ein entferntes Legacy-Feld braucht weiterhin einen **Migrations-Leser**: Alt-Flows
dürfen nie brechen. Der Node-RED-Editor importiert und re-exportiert aber **nur**
Felder, die in `_def.defaults` stehen — ohne Eintrag ginge der Legacy-Wert beim
ersten Deploy verloren, bevor die Open-Time-Migration je liefe. Deshalb listet
ein Knoten seine migration-only Felder in **`migrationFields: ["storeId", …]`**
NEBEN (nicht in) seinem `defaults`-Block; die Registrierung
(`withMigrationDefaults` in `resources/lib/editor-common.js`) injiziert dafür
versteckte `{ value: undefined }`-Defaults:

- ein Alt-Flow importiert seine Legacy-Werte weiter in den Editor (die
  `oneditprepare`-Migration liest sie und hebt sie ins kanonische Feld);
- ein Palette-neuer Knoten bekommt das Feld **nie** (Node-RED seedet nur
  Defaults mit `value !== undefined`);
- `oneditsave` **löscht** das migrierte Feld (`dropLegacyFields`) statt es zu
  leeren — der gespeicherte Knoten exportiert ohne Legacy-Felder.

Der Text-parsende Tripwire `check:fields` sieht die Injektion nicht — absichtlich:
er prüft genau die Oberfläche, die der Editor **neu schreibt**.

---

## Das Basis-Feld `color`: Tokens + jede Farbe + Binding (P238, ADR 0039)

`color` ist ein **Basis-Feld** ([ADR 0015](../../adr/0015-common-base-fields-and-editor-structure.md))
und folgt der Carrier-Regel oben: `color` (Binding-Objekt) + `colorBinding`
(typedInput-Carrier). Es hat darüber hinaus eine **feste Ausprägung** — ein
**Standard-Control** aus dem gemeinsamen Helper `installBaseFields`
(`resources/lib/editor-common.js`), das auf **allen** Knoten mit `color` identisch
ist ([ADR 0039](../../adr/0039-colour-field-model-color-is-tokens-plus-any-colour-variant-is-the-reduction.md) §1):

| Weg | typedInput-Typ | persistiert als |
|---|---|---|
| **Theme-Token** | `token` (SelectBox über `COLOR_TOKENS`) | `{kind:"literal", value:"token:<name>"}` |
| **Farbe** | `str` (Textfeld + Color-Selector auf dem Expand-Button) | `{kind:"literal", value:"<css>"}` |
| **Binding** | der volle kanonische Satz (ADR 0012) | das jeweilige Binding-Objekt |

**Konventionen, die daraus folgen:**

- **`color` ist überall bindbar, wo es gilt.** Ein Knoten darf das Basis-Feld
  **nicht** auf einen Plain-String herunterstufen — genau das hatte `ui-icon` bis
  P238 getan (`color: z.string()`-Override + `omit:["color"]`), womit die Farbe
  dort gar nicht bindbar war. Solche Overrides sind unzulässig.
- **`variant` und `color` schließen einander aus.** `variant` ist die Reduktion
  auf die Tokens, `color` die Obermenge (Tokens **und** jede Farbe). Welcher der
  beiden ein Knoten führt, ist **Backend-getrieben** und wird node-lokal begründet
  (ADR 0039 §3). Vokabular + Auflösung: [theming.md](theming.md).
- **Ein Token wird nie roh ausgegeben.** Das `token:`-Präfix hält Token und Farbe
  eindeutig auseinander; aufgelöst wird zentral in `resolveColorValue`
  (`resources/lib/webapp-serializer.js`), nie im einzelnen Knoten.
- **Plain-String-Back-Compat.** Ein deployter Plain-String-`color` wird verlustfrei
  als `literal`-Binding übernommen — im Editor beim Öffnen und zur Laufzeit in
  `mapConfig` (`normalizeColorField`), damit auch ein nie wieder geöffneter Flow
  unverändert rendert.

---

## `variant` vs. `color` — die Entscheidungstabelle pro Knoten (P240, ADR 0039 §3)

> **Status: Evidenz, nicht Zielzustand.** Diese Tabelle hält fest, *welche Seite*
> ein Knoten **tragen sollte** und **warum** — begründet aus dem, was das
> Backend-Element real unterstützt. Die **Soll**-Spalte ist eine
> **Produkt-Entscheidung** und steht unter Owner-Review; sie ist **kein**
> Auftrag. Wo Soll ≠ Ist, steht der Befund in der letzten Spalte — eine
> Umklassifizierung ist ein **Breaking Field Change** und bekommt je Knoten ein
> eigenes Paket mit Migration ([ADR 0039](../../adr/0039-colour-field-model-color-is-tokens-plus-any-colour-variant-is-the-reduction.md),
> Consequences). Vokabular + Auflösung: [theming.md](theming.md).

### Die Entscheidungsregel

Ein Knoten trägt seine Farbe in **`variant`**, wenn **eine** der beiden Klauseln
aus ADR 0039 §2 greift:

- **(a) natives Variant-Konzept** — das Backend-Element hat ein eigenes
  `variant`-artiges Attribut, das eine freie Farbe **nicht** ansteuern kann
  (Shoelace: `sl-button`, `sl-badge`, `sl-alert`), **oder**
- **(b) Nicht-Farb-Ausprägungen im Vokabular** — Werte, die eine Farbe nicht
  ausdrücken kann (`ghost`/`link`, `line`/`contained`/`pills`, `card`/`panel`).

Greift **keine** Klausel und hat das Element einen **freien Farb-Hook** (eine
setzbare CSS-Custom-Property, ein `color:`), trägt der Knoten **`color`** — die
Obermenge. Hat das Element **gar keine** Farb-Oberfläche, ist Farbe **N/A**.

**Wichtig — zwei Achsen, nicht eine.** Ein Feld namens `variant` ist nicht
automatisch die Farbachse. Auf `ui-container`/`ui-tabs`/`ui-pagination`/
`ui-stepper` ist `variant` reine **Erscheinung** (Element-Wahl, Füllung,
Orientierung) und beantwortet die Farbfrage **gar nicht**. Diese Knoten stehen
unten deshalb doppelt: `variant` = Erscheinung **und** eine eigene Farb-Zeile.

### Backend-Minimum (die P102-Spalte)

Die letzte Spalte benennt, was ein **zweites Backend** mindestens können muss,
um die gewählte Seite zu bedienen. Vier Fähigkeits-Token — genau die Form, die
[P102](backend-support.md) später als **Spalte pro Backend** (✓/✗) übernimmt:

| Token | Bedeutung | Shoelace heute |
|---|---|---|
| `native-variant` | Element hat ein eigenes semantisches Variant-/Farbrollen-Attribut | `sl-button`, `sl-badge`, `sl-alert` |
| `appearance-switch` | Element kann eine **Nicht-Farb**-Erscheinung umschalten (Füllung/Form/Element-Wahl) | `sl-input[filled]`, `sl-card` vs. `div` |
| `color-hook` | Element hat einen **setzbaren freien Farbwert** (CSS-Custom-Property / `color:` / part) | `sl-divider --color`, `sl-progress-* --indicator-color`, `sl-icon color:` |
| `—` | keine Farb-Oberfläche — nichts zu tragen | — |

### A — Soll: `variant`

| Knoten | Backend-Element | Was das Element real kann | Nicht-Farb-Werte? | Ist | Befund |
|---|---|---|---|---|---|
| `ui-button` | `sl-button` | natives `variant`-Attribut (`primary`/`success`/`neutral`/`warning`/`danger`/`text`/`default`) + `outline`; eine freie Farbe erreicht es nur über `::part(base)` | **ja** — `ghost`, `link` (`BUTTON_VARIANTS`) | `variant` (`color` N/A) | ✅ konform — beide Klauseln greifen |
| `ui-badge` | `sl-badge` | natives `variant`-Attribut (`SEVERITY_VARIANTS` 1:1) | nein — reine Farbe | `variant` (`color` N/A) | ✅ konform — Klausel (a) |
| `ui-alert` | `sl-alert` | natives `variant`-Attribut | nein — reine Farbe | Feld **`severity`**; `BASE_FIELDS.variant:false` + hand-gesetztes `color:false` | ⚠️ **F-1** — inhaltlich richtig, **Mechanik umgangen** |
| `ui-toast` | `sl-alert` (Toast-Stack) | wie `ui-alert` | nein — reine Farbe | Feld **`severity`**; wie oben | ⚠️ **F-1** |

**Backend-Minimum: `native-variant`** für alle vier. Ein Backend ohne natives
Variant-Konzept muss die sechs bis acht Rollen selbst auf Klassen/CSS abbilden —
das ist zulässig (many-to-one, [theming.md](theming.md) Ebene-3-Regeln), aber es
darf das Vokabular nie erweitern.

### B — `variant` = **Erscheinung** (beantwortet die Farbfrage nicht)

| Knoten | Backend-Element | Vokabular | Was das Element real kann | Ist | Befund |
|---|---|---|---|---|---|
| `ui-container` | `sl-card` / `div` / `span` (variant **wählt das Element**) | `card`, `panel`, `section`, `transparent`, `span` | Element-Wahl + `webapp-container--<v>`-Klasse — real gerendert | `variant` gerendert; Editor-SelectBox vorhanden | ✅ Erscheinung korrekt bei `variant` |
| `ui-input` | `sl-input` | `default`, `filled`, `outlined` | `sl-input` hat ein natives `filled` (+ `pill`) — die **Fähigkeit existiert**, der Serializer emittiert sie **nie** | `variant` im Schema + `defaults`, **kein** Rendering | ❌ **F-5** — Feld tot |
| `ui-tabs` | `sl-tab-group` | `line`, `contained`, `pills` | `sl-tab-group` hat **kein** Variant-Attribut (nur `placement`/`activation`); der Serializer emittiert nichts | `variant` **nur im Schema** — kein `defaults`-Eintrag, kein Editor-Control | ❌ **F-8** — Feld tot **und** unerreichbar |
| `ui-pagination` | `sl-button-group` | `numbered`, `simple` | kein Variant-Attribut; der Serializer emittiert nichts | `variant` **nur im Schema** | ❌ **F-8** |
| `ui-stepper` | eigenes Markup | `horizontal`, `vertical` | — | `variant` **nur im Schema** | ❌ **F-8** + ⚠️ **F-14** (das ist eine **Orientierung**; `ui-divider` nennt dasselbe Konzept `orientation`) |

**Backend-Minimum: `appearance-switch`.** Ein zweites Backend muss die
Erscheinung selbst umschalten können (eigenes Element, eigene Klasse). Fehlt
ihm die Ausprägung, degradiert es auf den dokumentierten Default — es ersetzt
sie **nie** durch eine Farbe.

### C — Soll: `color`

| Knoten | Backend-Element | Der Farb-Hook, den es real hat | Ist | Befund |
|---|---|---|---|---|
| `ui-divider` | `sl-divider` | `--color`-Custom-Property — **angewandt** (`webapp-serializer.js:1435`) | `color` | ✅ konform — die Referenz-Implementierung |
| `ui-progress` | `sl-progress-bar` / `-ring` / `sl-spinner` | `--indicator-color` — **angewandt** (`:966`) | `color` | ✅ konform |
| `ui-list` | eigenes `<div class="webapp-list">` | inline `color:` — **angewandt** (`:1366`) | `color` | ✅ konform |
| `ui-icon` | `sl-icon` | inline `color:` (`currentColor`) — **angewandt** (`:114`) | `color` | ✅ konform (seit P238) |
| `ui-avatar` | `sl-avatar` | **kein** natives Variant (Schema sagt es selbst, `node-definitions.ts:1826`); der Hook ist CSS/`::part(base)` → freie Farbe | **`variant` (`SEVERITY_VARIANTS`) UND `color: true`** — beides aktiv, beides Farbe | ❌ **F-6 — echter Exklusivitäts-Verstoß.** `variant` rendert nur ein ungestyltes `data-variant`; `color` rendert **gar nichts** |
| `ui-container` (Farbachse) | `sl-card` / `div` | `sl-card` hat Farb-Hooks (`--border-color`, Hintergrund via `::part(base)`) → Fähigkeit vorhanden | `color: true`, **nie emittiert** | ❌ **F-3** — inertes Control |
| `ui-table` | eigenes `<table>` | `color:` trivial setzbar → Fähigkeit vorhanden | `color: true`, **nie emittiert** | ❌ **F-3** |
| `ui-menu` | `sl-menu` | `color:` / `::part` → Fähigkeit vorhanden | `color: true`, **nie emittiert** | ❌ **F-3** |
| `ui-breadcrumb` | `sl-breadcrumb` | `color:` → Fähigkeit vorhanden | `color: true`, **nie emittiert** | ❌ **F-3** |
| `ui-stepper` (Farbachse) | eigenes Markup | `color:` → Fähigkeit vorhanden | `color: true`, **nie emittiert** | ❌ **F-3** |
| `ui-empty-state` | eigenes Markup | `color:` → Fähigkeit vorhanden | `color: true`, **nie emittiert** | ❌ **F-3** |

**Backend-Minimum: `color-hook`.** Ein zweites Backend muss **einen** setzbaren
freien Farbwert am Element anbieten. Das ist die **schwächste** Anforderung der
Tabelle — jedes DOM-basierte Backend erfüllt sie; genau deshalb ist `color` die
**backend-neutralere** Seite und `variant` die, die eine Backend-Fähigkeit
**voraussetzt**.

### D — Soll: Farbe **N/A**

| Knoten | Warum keine Farbachse | Ist | Befund |
|---|---|---|---|
| `ui-text` | — **siehe Owner-Frage 2**: das Vokabular ist **reine Farbe**, das Element (`<p>`/`<h1>`/…) hat einen freien `color:`-Hook → nach der Regel wäre **`color`** richtig | `variant` (`TEXT_COLOR_VARIANTS`), `color` N/A | ⚠️ **F-2** — der stärkste Reklassifizierungs-Kandidat |
| `ui-select`, `ui-checkbox`, `ui-radio`, `ui-switch`, `ui-textarea`, `ui-datepicker`, `ui-slider` | Formularfeld — die Farbe ist Shoelace-Theming (`--sl-input-*`), keine Autoren-Achse; Zustandsfarben kommen aus der **Validierung** | `color: false` | ✅ Ergebnis korrekt — ⚠️ **F-4** (Hinweistext falsch) |
| `ui-input` (Farbachse) | wie oben | `color: false` | ✅ / ⚠️ **F-4** |
| `ui-tabs` (Farbachse) | `sl-tab-group` hat **keinen** Farb-Hook — die Tab-Farbe folgt der Token-Bridge (`--sl-color-primary`) | `color: true` | ❌ **F-7** — inertes Control; die gemessene Antwort auf „fehlt dem Knoten ein `color`?" ist **nein** |
| `ui-accordion` | `sl-details` hat keinen `--color`-artigen Hook (nur `::part(base)`) | `color: true` | ❌ **F-9** — inertes Control; **Owner-Frage 4** |
| `ui-pagination` (Farbachse) | `sl-button-group` delegiert die Farbe an die enthaltenen `sl-button` (dort = `variant`) | `color: true` | ❌ **F-7** |
| `ui-image` | ein `<img>` hat keine Farbe | `color: false` | ✅ konform |
| `ui-log` | die Farbe ist **pro Eintrag** aus der Severity abgeleitet — intern, keine Autoren-Achse | `color: false` | ✅ konform |
| `ui-skeleton` | neutraler Platzhalter-Shimmer | **gar kein Basis-Feld-Block** (kein `BASE_FIELDS`, kein `installBaseFields`) — obwohl das Schema `...baseFieldsSchema` spreadet | ❌ **F-15** — der ADR-0015-Rollout hat diesen Knoten nie erreicht |
| `ui-repeat`, `ui-tab`, `ui-accordion-section` | rendern **keine eigene Chrome** (ADR 0025: `ui-repeat` ist transparent) | `color: false` + Hinweis | ✅ konform |
| `ui-app` | die App-Farbe **sind** die Design-Tokens (Ebene 1) — keine Element-Farbe | keine Basis-Felder | ✅ konform |
| `ui-route`, `ui-dialog`, `ui-component-definition`, `ui-component-instance` | Struktur ohne eigene Farb-Oberfläche | keine Basis-Felder | ✅ konform |
| `ui-store`, `ui-query`, `ui-store-read`, `ui-store-action`, `ui-query-action`, `ui-action` | rendern **kein DOM** | keine Basis-Felder | ✅ konform |

**Backend-Minimum: `—`.** Kein Backend muss hier etwas können.

### Exklusivität (ADR 0015 §1) — der gemessene Stand

Die Exklusivität ist im Helper implementiert: `variant: true` in `BASE_FIELDS`
schaltet `color` auf N/A („Nutzt die semantische Variant",
`resolveBaseFieldApplicability` in `resources/lib/editor-common.js`). Gesetzt ist
das Flag auf **genau drei** Knoten: `ui-button`, `ui-badge`, `ui-text`.

Damit ist die Durchsetzung **hand-gepflegt**, nicht abgeleitet — und der Baum
weicht an zwei Stellen ab:

- **`ui-avatar` trägt beides wirksam** (`variant: SEVERITY_VARIANTS` **und**
  `color: true`) — beides ist die **Farbachse**. Das ist der **einzige echte**
  Verstoß gegen ADR 0015 §1 (**F-6**).
- **`ui-container`, `ui-tabs`, `ui-pagination`, `ui-stepper`** tragen ein
  `variant`-Feld **und** `color: true`. Dem **Buchstaben** nach ein Verstoß, dem
  **Sinn** nach keiner: ihr `variant` ist Erscheinung, nicht Farbe → **Owner-Frage 1**.
- **`ui-alert`/`ui-toast`** sind nur deshalb konform, weil ihr `color: false`
  **von Hand** gesetzt ist — ihr Farbfeld heißt `severity`, das Flag `variant`
  steht auf `false`. Die Exklusivität ist hier **Zufall, keine Garantie** (**F-1**).

### Offene Owner-Fragen (Produkt-Entscheidungen, keine Ableitungen)

1. **Meint „exklusiv" die Felder oder die Farbachse?** ADR 0015 §1 sagt „nie
   beides". Gemessen tragen vier Knoten ein `variant`-Feld **und** `color` —
   ohne Konflikt, weil ihr `variant` Erscheinung ist. Präzisiert man §1 auf *„nie
   zwei **Farb**-Achsen"*, sind diese vier konform und nur `ui-avatar` bleibt
   Verstoß. Belässt man §1 wörtlich, brauchen vier Knoten eine Umbenennung
   (`variant` → `displayType`/`orientation`, wie P49 es schon einmal getan hat).
2. **`ui-text`: `variant` → `color`?** Die Regel sagt eindeutig `color`
   (reine Farbe, kein natives Variant, freier `color:`-Hook). Die Migration wäre
   **verlustfrei**: `COLOR_TOKENS` deckt `TEXT_COLOR_VARIANTS` exakt ab
   (`muted` → `token:muted`, `default` → leeres `color`, Rest → `token:*`), und
   der Autor gewönne freie Farben + Bindings. **Dagegen** spricht nur die
   Konsistenz mit `ui-button`/`ui-badge` („Variant heißt überall Farbe") — und
   `ui-text` rendert seine Farbe heute als **Klasse** (`webapp-text--color-<c>`),
   was ein Theme-Wechsel mitnimmt, eine freie Farbe nicht.
3. **`ui-avatar`: welche Seite gewinnt?** Beides ist heute wirkungslos —
   `variant` erzeugt ein ungestyltes `data-variant`, `color` gar nichts. Nach der
   Regel: `color` (kein natives Variant vorhanden). Nach der Absicht des
   Schema-Kommentars (P94: „Bootstrap unterstützt das nativ per CSS-Klassen"):
   `variant` — dort ist die Wahl bewusst **auf ein zweites Backend hin** getroffen
   worden, das es noch nicht gibt. Das ist die einzige Stelle im Baum, wo P102s
   Argument heute schon zieht.
4. **Ist ein inertes `color` ein Bug oder ein Platzhalter?** Auf **acht** Knoten
   (`ui-container`, `ui-table`, `ui-menu`, `ui-breadcrumb`, `ui-stepper`,
   `ui-empty-state`, `ui-tabs`, `ui-accordion`) zeigt der Editor ein `color`, das
   nie im DOM landet. ADR 0039 §3 sagt: *„Ein Knoten darf kein Control anbieten,
   das das Backend nicht honorieren kann."* Entweder implementieren (sechs davon
   **könnten**) oder auf N/A stellen (zwei **können** nicht) — beides sind
   Folge-Pakete.

### Findings-Register

| Id | Knoten | Feld | Warum die heutige Zuordnung der Tabelle widerspricht |
|---|---|---|---|
| **F-1** | `ui-alert`, `ui-toast` | `severity` | Farbachse heißt nicht `variant`; `BASE_FIELDS.variant:false` + hand-gesetztes `color:false` → die Exklusivität ist nicht durchgesetzt, nur nachgebaut |
| **F-2** | `ui-text` | `variant` | reine Farb-Vokabel + freier `color:`-Hook + kein natives Variant → nach ADR 0039 §2 gehört die Farbe in `color` |
| **F-3** | `ui-container`, `ui-table`, `ui-menu`, `ui-breadcrumb`, `ui-stepper`, `ui-empty-state` | `color` | Control angeboten, Serializer emittiert es nie → inert. Fähigkeit **vorhanden**, Umsetzung fehlt (ADR 0039 §3) |
| **F-4** | `ui-input`, `ui-select`, `ui-checkbox`, `ui-radio`, `ui-switch`, `ui-textarea`, `ui-datepicker`, `ui-slider` | `color` (N/A-Hinweis) | Hinweis „Zustandsfarben kommen aus Validierung/**Variant**" ist falsch: `INPUT_VARIANTS` enthält **keine** Farbe, und sechs der acht Knoten haben gar kein `variant`-Feld |
| **F-5** | `ui-input` | `variant` | `INPUT_VARIANTS` (`filled`/`outlined`) wird nie gerendert — `sl-input[filled]` existiert, wird aber nicht emittiert |
| **F-6** | `ui-avatar` | `variant` + `color` | **beides aktiv, beides Farbe** → Exklusivitäts-Verstoß (ADR 0015 §1). Zusätzlich: `variant` rendert nur `data-variant` (ungestylt), `color` rendert nichts |
| **F-7** | `ui-tabs`, `ui-pagination` | `color` | Control angeboten, Element hat **keinen** Farb-Hook → nicht implementierbar, gehört auf N/A |
| **F-8** | `ui-tabs`, `ui-pagination`, `ui-stepper` | `variant` | im Schema deklariert, aber **kein** `defaults`-Eintrag, **kein** Editor-Control, **kein** Rendering → totes Feld |
| **F-9** | `ui-accordion` | `color` | `sl-details` hat keinen Farb-Hook; Control ist inert |
| **F-14** | `ui-stepper` | `variant` | Werte `horizontal`/`vertical` sind eine **Orientierung** — `ui-divider` nennt dasselbe Konzept `orientation` (Cross-Node-Drift, ADR 0038) |
| **F-15** | `ui-skeleton` | Basis-Felder | kein `BASE_FIELDS`/`installBaseFields` — der ADR-0015-Rollout hat den Knoten nie erreicht, obwohl sein Schema `...baseFieldsSchema` spreadet |

Gemessen am 2026-07-17 gegen `packages/schema/src/contracts.ts`,
`packages/schema/src/node-definitions.ts`, die `BASE_FIELDS`-Blöcke aller
`nodes/**/*.html`, `resources/lib/editor-common.js` und
`resources/lib/webapp-serializer.js`.

---

## Der Tripwire `pnpm check:fields`

`scripts/check-fields.js` ist **read-only** (schreibt nichts) und in
`pnpm validate` eingehängt. Er parst die `defaults`-Blöcke aller `ui-*`-Knoten-
`.html` (kommentar-robust, wie `check:specs` / `check:roundtrip`) und prüft
knotenübergreifend drei Regeln — jeder Verstoß nennt **Knoten + Feld**:

- **(a) Carrier-Zwilling-Konsistenz.** Hat ein Knoten `<base>Binding`, darf **kein**
  `<base>Path`-Default existieren.
- **(b) Kein wiedereingeführtes Legacy-Feld.** Keine `*Json`-Carrier; kein totes
  `storeId` und dessen `path`-Partner (das ADR-0027-Input-Paar — `path` **allein**
  auf `ui-store-read`/`-action` ist der lebende Store-Subpfad und `ui-route.path`
  der URL-Pfad, beide bleiben); keine Pagination-Aliase `page`/`currentPagePath`.
- **(c) Bare-Name-Referenzen.** Referenz-Felder folgen der Bare-Name-Regel; jedes
  `*Id`-Feld ist ein Verstoß außer der Keep-Liste (`uiId`, `selectedId`).

**Allowlist-Semantik.** Jeder Eintrag `{ <knoten>: { <feld>: "Begründung" } }`
**schwächt** die Prüfung für genau dieses `(Knoten, Feld)`-Paar (unterdrückt alle
Regeln dafür). Die Liste ist kuratiert und schrumpfend: sie trägt nur die heute
existierenden ADR-0038-Verstöße (Ziel: P228/P229 → leer). Ein **neuer** Eintrag
ist ausschließlich durch einen ADR-Grund gerechtfertigt, nie durch „noch nicht
migriert".

Der Vertrag ist Regel-für-Regel durch `scripts/check-fields.test.ts` bewiesen
(konform → grün, je Regel ein Verstoß → rot, allowlisted → grün).

## Der Tripwire `pnpm check:binding-docs`

Ein **bindbares Feld wird in seiner Spec als bindbar dokumentiert** — nie als
statisches „Textfeld" bzw. mit „kein Binding" / „nicht bindbar" (ADR 0012,
Binding-Ubiquität). `scripts/check-binding-docs.js` (P237) ist **read-only** und
in `pnpm validate` + `pnpm test:specs` eingehängt. Er liest die **Schema-Wahrheit**
(`packages/schema/src/node-definitions.ts`): ist ein Feld binding-fähig (Union mit
`bindingSchema` bzw. direktes `bindingSchema`; das `writeToBindingSchema` der
Schreib-Hälfte zählt bewusst **nicht**) und hat es eine Zeile in der
kanonischen „Felder"-Tabelle der Spec, deren „Editor-Typ"-Spalte „Textfeld" sagt
(oder deren Text „kein Binding"/„nicht bindbar" behauptet), meldet er
**Knoten + Feld**. Felder ohne eigene Feldzeile (die zentral dokumentierten
Basis-Felder `visible`/`disabled`/`color`) werden nicht geprüft.

**Allowlist-Semantik.** Wie bei `check:fields`: jeder Eintrag schwächt genau ein
`(Knoten, Feld)`-Paar und braucht eine ADR-Begründung; die Liste ist schrumpfend.
P237 fixte seine vier Ziel-Felder (nie allowlisted); die vom Guardrail zusätzlich
entdeckte Muster-4-Drift anderer Knoten ist an deren eigene Konformitäts-Pässe
delegiert (kein Doppelfix). Der Vertrag ist durch `scripts/check-binding-docs.test.ts`
bewiesen.

---

## Audit-Referenz

Die vollständige Befundliste (was „konsistent" bedeutet und warum) steht in
[ADR 0038](../../adr/0038-field-model-consistency-naming-and-carrier-normalization.md)
(§Context, fünf verifizierte Befunde). Die zugrunde liegende Matrix (45 Knoten ×
128 Felder) ist die Audit-Quelle der Session 2026-07-14; ADR 0038 ist ihr
kanonischer Auszug.

---

## Feld-Matrix (generiert)

Eine knotenübergreifende Übersicht aller ui-Knoten × ihrer Felder — mit den
Konsistenz-Findings (geplante Umbenennungen P228 / Legacy-Entfernungen P229) als
Overlay — wird generiert nach [`field-matrix.html`](../field-matrix.html):

```bash
pnpm gen:field-matrix
```

Die Findings werden aus denselben Regeln wie `pnpm check:fields` auf den
Live-`defaults` abgeleitet, räumen sich also mit P228/P229 selbst auf. Die HTML-Datei
ist **generiert** — nicht von Hand bearbeiten, sondern neu generieren.

## Siehe auch

- [editor.md](editor.md) — Editor-Helfer, Node-Picker, Binding-typedInputs
- [layout.md](layout.md) — Platzierungs-Boilerplate (`mount`, `order`, `row`/`col` …)
- [stores.md](stores.md) — Semantik des `store`-Bindings
- [ADR 0038](../../adr/0038-field-model-consistency-naming-and-carrier-normalization.md) — der Feld-Modell-Vertrag
- [ADR 0012](../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md) — Binding-Carrier (`<base>` + `<base>Binding`)
- [ADR 0027](../../adr/0027-input-value-binding-is-bidirectional-value-read-writeto-write.md) — `writeTo` löst das Input-`storeId`/`path`-Paar ab

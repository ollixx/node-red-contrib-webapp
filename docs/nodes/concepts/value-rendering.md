# Wert-Rendering: leere, null/undefined und nicht-skalare Werte

> **Anforderungs-Dokument.** §1 (zentrale Normalisierung) ist seit P104
> implementiert; §2a (elegantere Signalisierung) ist noch **deferred** (P105).
> Der Implementierungsstand ist unten zusammengefasst.

Dieses Konzept gilt für **alle** Knoten mit einem gebundenen Anzeige-Wert
(`ui-badge` `value`, `ui-text` `value`, `ui-avatar` `initials`, …). Es legt
**einmal zentral** fest, was passiert, wenn der aufgelöste Wert leer, `null`,
`undefined` oder **kein Skalar** (Objekt/Array) ist. Node-Docs **referenzieren**
dieses Konzept, statt das Verhalten je Knoten neu zu beschreiben.

> **Warum zentral.** Wertauflösung läuft für alle wertbindenden Knoten durch
> **dieselbe** Stelle (die Binding-Auflösung im Renderer → `resolvedProps.value`,
> gespeist aus den typedInput-Binding-Arten, siehe [editor.md](editor.md)).
> Genau dort gehört die Normalisierung hin — nicht in jeden Knoten kopiert.
> Frühere Bugs („Objekt erwartet", `[object Object]` im DOM) entstanden, weil das
> pro Knoten unterschiedlich (oder gar nicht) gehandhabt wurde.

---

## 1. Normalisierung (universell, keine Konfiguration)

Der aufgelöste Rohwert wird **immer** nach dieser Tabelle in entweder einen
**nicht-leeren Anzeige-String** oder das Sentinel **„leer"** überführt:

| Rohwert | Ergebnis |
|---|---|
| String, nicht leer | unverändert |
| `number` / `boolean` / `bigint` | `String(wert)` (z. B. `0` → `"0"`, `false` → `"false"`) |
| `""` (echter leerer String) | **leer** — die Komponente wird gerendert, zeigt aber keinen Inhalt |
| `null` / `undefined` | **`"?"`** — der Wert ist nicht sinnvoll darstellbar |
| Objekt / Array / Funktion / Symbol | **`"?"`** (nie `[object Object]`, nie roher JSON-Dump, nie Fehler) |

> **Wichtig:** `0` und `false` sind **gültige Werte**, nicht „leer" — eine
> naive Falsy-Prüfung (`if (!value)`) ist hier ein Bug.
>
> **Die zwei „nichts"-Fälle sind bewusst getrennt:**
> - **`""` = echtes Leer** (jemand hat absichtlich „nichts" gesetzt) → leer anzeigen.
> - **`null`/`undefined`/Nicht-Skalar = „kann nicht dargestellt werden"** (Pfad
>   fehlt, falscher Typ, ein Objekt gelandet) → **`"?"`** als sichtbares Signal,
>   dass hier etwas nicht stimmt — statt still leer zu sein und den Fehler zu
>   verstecken.

---

## 2. Einheitlich, nicht pro Knoten

Diese Regel gilt **einheitlich für alle** wertbindenden Knoten — es gibt **keine**
Pro-Knoten-Konfiguration des Leer-Verhaltens. `""` → leer, `null`/`undefined`/
Nicht-Skalar → `"?"`. Damit ist das Verhalten an genau einer Stelle (der zentralen
Normalisierung, §1) festgelegt und überall vorhersagbar.

> **Ausnahme `ui-avatar`:** Die `initials` durchlaufen zuerst die bestehende
> Fallback-Kette (Bild → Initialen → Icon, siehe [ui-avatar](../display/ui-avatar.md)).
> Erst der daraus resultierende Wert geht durch die Normalisierung oben.

## 2a. Geplante elegantere Lösung (deferred)

Das `"?"` ist die **erste, einfache** Stufe. Später soll der „kann nicht
dargestellt werden"-Fall **eleganter** signalisiert werden: ein **Achtung-Icon**
neben der Komponente, optional mit Link auf einen Alert/Dialog, der erklärt, dass
der gebundene Wert nicht sinnvoll angezeigt werden kann (welcher Pfad, welcher
Typ kam an). Das ersetzt dann das nackte `"?"`.

> **Deferred** — eigenes Paket, zurückgestellt. Bis dahin gilt `"?"` (§1).

## 2b. `onMissing` — pro Feld wählbares Verhalten bei **nicht auflösbarem** Wert (P219, ADR 0034)

Die zentrale Normalisierung (§1) bleibt konfigurationsfrei. Davon **getrennt** ist
der Fall, dass ein Binding **gar nicht auflösbar** ist (eine `reactive`-Expression
scheitert, ein `store`-Sub-Pfad trifft einen Skalar / wird nicht gefunden). Für
genau diesen „missing/unresolvable"-Fall trägt jedes bindbare Wert-Feld ein
**optionales** `onMissing`:

- `marker` (**Default**, fehlt → dies) → der Invalid-Value-Marker `"?"` (§1) plus
  der bestehende einmalige Report — unverändertes heutiges Verhalten.
- `ignore` → **leer** (`""`), **kein** Report — dasselbe „leer statt `?`" wie beim
  transienten Objekt-Slice-Fall ([ADR 0032](../../adr/0032-store-subpath-missing-key-is-transient-not-an-error.md)),
  jetzt pro Feld wählbar.

Foundation-Paket (nur `marker`/`ignore`); `errorPort`/`throw`/Fallback-Slot folgen
(P220). Details: [reactive-expressions.md](reactive-expressions.md) §`onMissing`.

---

## 3. Referenzierungs-Regel

Eine Node-Doc mit gebundenem Anzeige-Wert **verlinkt dieses Konzept** an der
Wert-Feldzeile, statt Normalisierung/Leer-Verhalten selbst auszuformulieren.
Beispiel: „Leer-/Non-Skalar-Verhalten: siehe
[value-rendering.md](../concepts/value-rendering.md)."

---

## Siehe auch

- [editor.md](editor.md) — typedInput-Binding-Arten (Quelle des Rohwerts)
- [inputs.md](inputs.md) — `msg.payload` Push-Updates auf den Wert
- [backend-support.md](backend-support.md) — orthogonal: native Backend-Fähigkeiten

## Implementierungsstand

- **§1 zentrale Normalisierung — implementiert (P104).** Die eine kanonische Funktion
  ist `normalizeDisplayValue` in `packages/renderer/src/renderer.ts`; sie wird auf den
  aufgelösten Anzeige-Wert von `ui-text`, `ui-badge` und `ui-alert` (Message) angewandt.
  `ui-avatar`-Initialen durchlaufen erst die serializer-seitige Fallback-Kette, der
  Ergebniswert dann dieselbe Regel.
- **§2a elegantere Signalisierung** (Achtung-Icon + Alert/Dialog statt nacktem `"?"`) —
  **deferred**, eigenes Paket (P105).
- **§2b `onMissing` (`marker`/`ignore`) — implementiert (P219, ADR 0034).** Der
  Renderer verzweigt an beiden Invalid-Value-Punkten (`reactive`-Fehler,
  `store`-Sub-Pfad) auf `binding.onMissing`; der Editor zeigt den Selektor an der
  Wert-Feldzeile (ui-text). `errorPort`/`throw` folgen (P220).

## Offene Punkte

- Elegantere Signalisierung des „kann nicht dargestellt werden"-Falls (§2a) — deferred, eigenes Paket (P105).

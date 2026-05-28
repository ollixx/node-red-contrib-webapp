# `ui-route`

## Zusammenfassung

Definiert eine URL-Route und bindet sie an ein Layout. Aka "Page".

Aktuelles MVP-Verhalten:
- Pfade mit Parametern wie `/customers/:id` werden aufgelöst.
- Der Renderer ermittelt daraus die aktive Route und Route-Parameter.

## Abhängigkeiten

**Parent-Knoten:**
- `ui-app`

**Gemeinsam genutzte Services und Komponenten:**
- Referenziert `ui-layout` über `layoutId`
- Route-Parameter werden im Binding-Modell als `routeParam`-Bindings verfügbar gemacht

## Editor

**Pflichtfelder:**
- `parent`: Auswahl gültiger Parents, d.h. hier einer App (ui-app). Wenn es mehr als X (20?) mögliche Einträge gibt, wird stattdessen ein kleiner Dialog angezeigt, der eine scrollbare Liste von Apps zeigt und gefiltert werden kann.
- `path`: Das URL-Element, das die Route definiert (Beispiel: /webapp/appName/<path>)
  - Validierung: innerhalb einer App (selbes Parent) muss der path eindeutig sein
- `layout`: Referenz auf ein bekanntes Layout
  - Default: `vertical` (kinder werden untereinander dargestellt)


**Optionale Felder:**
- `name`: node-red Standard zur lesbaren Identifikation des Knotens.
  - default ist "", Für die Anzeige wird als erstes auf den path zurückgegriffen

## Input
```
noch nicht definiert. 
Ideen:
- ui-action (navigateTo)
- message zum dynamischen Erzeugen/Ändern/Löschen eines Kind-Elementes (wie bei ui-container)
```

## Output
```
noch nicht definiert. 
Ideen:
- ui-events (onLoad, ...) durchreichen, evtl. auch events der Kinder?
- event-message nach dem dynamischen Erzeugen/Ändern/Löschen eines Kind-Elementes (wie bei ui-container). Frage: Sind das auch ui-events (DOM wurde verändert)?
```

## Besonderheiten

- Die App braucht kein ui-route Knoten für den root, den ui-app selbst darstellt. Kinder können direkt in die Slots von ui-app gehängt werden. In dieser Hinsicht sollte ui-app auch alles supporten, was ui-route bietet (ui-action, ui-events etc.). Hier sollte ggf. gemeinsamer code genutzt werden

Siehe für das mehrfach genutzte Layout-Konzept auch [layout.md](layout.md).

- Knoten, die ein Layout referenzieren, sollten künftig nicht nur `layoutId` kennen, sondern zwischen Layout-Preset und `custom` unterscheiden.
- Wenn `custom` gewählt ist, wird wie heute auf ein explizites `ui-layout` verwiesen.
- Route Guards, Loader, Titelauflösung und verschachtelte Routen fehlen.
- Die Beziehung zwischen Route und Query-Lebenszyklus ist noch nicht explizit modelliert.

# ADR 0043: optionaler Root-Mount `/<root>` — Page-only, mit Deploy-Zeit-Kollisionsvalidierung in beide Richtungen

- Status: accepted — **implementation deferred** (Owner-Entscheidung 2026-07-23:
  bewusst geparkt, Paket [P273](../roadmap/nodes/ui-app/deferred/P273-optional-root-mount-page-only-with-collision-validation.md))
- Date: 2026-07-23
- Anlass: Doku-Fehler-Report des Owners (ui-app.md behauptete Auslieferung unter
  `/<root>`; tatsächlich ist es `/webapp/<root>` — Doku am 2026-07-23 korrigiert)
  mit der Anschlussfrage, ob `/<root>` nicht auch *möglich* sein sollte. Baut auf
  [ADR 0041](0041-auth-model-idp-agnostic-identity-trusted-header-first.md)
  (die sieben Runtime-Endpoints als eine Enforcement-Fläche) und **P108**
  (root-Eindeutigkeit als Deploy-Diagnostic — dieselbe Validierungs-Gattung).

## Context

Apps werden heute unter dem festen Präfix `/webapp/<root>` ausgeliefert (Page,
`/stream`, `/snapshot`, `/event`, `/dynamic-state`, `/asset/:id`, SPA-Fallback
`/*`). Das Präfix trennt den App-Namensraum sauber vom übrigen HTTP-Namensraum
der Node-RED-Instanz. Für produktionsnahe Deployments sind URLs ohne technisches
Präfix (`/shop` statt `/webapp/shop`) wünschenswert.

Ein Root-Mount kollidiert aber mit **drei fremden Namensräumen auf `/`**:

1. **Admin-Routen** (`httpAdminRoot`, default `/`): `/flows`, `/nodes`,
   `/settings`, `/red/*`, `/icons/*`, der Editor selbst — und diese Liste
   **wächst mit Node-RED-Versionen**: ein heute freier Name kann nach einem
   Upgrade kollidieren.
2. **`RED.httpNode`**: alle `http in`-Endpoints anderer Flows, Dashboard
   (`/ui`), andere Contrib-Nodes — und `/webapp` selbst.
3. **Statisches**: `httpStatic`, `/resources/<module>` (Resources-Plugin).

Verschärfend: der **SPA-Fallback `/<root>/*`** ist ein Wildcard — er verschluckt
jeden gleich-präfixten Endpoint, und Express-Routing ist
registrierungs-reihenfolgeabhängig über Deploys hinweg (das nichtdeterministische
„first match wins"-Problem ist aus P108 bekannt).

## Decision

1. **Opt-in pro App** (neues `ui-app`-Feld, z. B. `mountAtRoot`), Default bleibt
   unverändert `/webapp/<root>`.
2. **Page-only am Root:** unter `/<root>` liegen nur der HTML-Einstieg und die
   SPA-Routen (`/<root>/*` für client-seitige Locations). Die **technischen
   Endpoints bleiben unter `/webapp/<root>/…`** (`/stream`, `/event`,
   `/snapshot`, `/dynamic-state`, `/asset/:id`) — der Client wechselt nur seine
   API-Base-URL. Damit schrumpft die Kollisionsfläche auf genau ein Pfadsegment
   statt eines Wildcard-Baums voller API-Routen.
3. **Deploy-Zeit-Kollisionsvalidierung, in beide Richtungen, bei jedem Deploy:**
   - statische **Deny-List** (bekannte Admin-Pfade, `webapp`, `ui`, `resources`,
     `red`, `icons`, `vendor`, …) **plus** dynamische Inspektion des
     `RED.httpNode`-Routers gegen bereits registrierte Routen;
   - Kollision ⇒ **App wird nicht am Root gemountet** (bleibt unter
     `/webapp/<root>` erreichbar) + strukturierter Diagnostic mit dem
     kollidierenden Pfad (Gattung wie P108 `duplicate-app-root`);
   - auch die **Gegenrichtung**: registriert ein späterer Deploy einen
     `http in`-Endpoint unter einem belegten App-Root, wird DAS als Konflikt
     diagnostiziert (nicht still verschattet).
4. **Reverse-Proxy bleibt die dokumentierte Produktions-Alternative** (Mapping
   `/ → /webapp/<root>` in nginx & Co.) — sie umgeht alle Kollisionsfragen und
   funktioniert heute schon; die Doku (deployment/auth) nennt sie explizit.

Verworfen: Root-Mount *aller* Endpoints (Wildcard-Kollisionsfläche + fragile
Reihenfolge-Semantik); globales Umkonfigurieren des Präfixes (bricht
Mehr-App-Betrieb und `/webapp`-Verträge von Editor/Client/Tests).

## Consequences

- `ui-app` erhält ein Opt-in-Feld + Editor-URL-Vorschau für beide Formen; die
  Client-Bootstrap-Konfiguration muss die API-Base tragen (Page-URL ≠ API-Base).
- Die Validierung wird ein eigener Diagnostic-Komplex (Deny-List pflegen,
  Router-Inspektion, beidseitige Prüfung je Deploy) — Kern des Pakets P273.
- Node-RED-Upgrades können neue Admin-Routen bringen: die Deny-List ist
  versionsabhängig und braucht einen Wartungshinweis; die dynamische Inspektion
  fängt den Rest zur Laufzeit.
- **Deferred:** bewusst geparkt (nicht 1.0-kritisch; Reverse-Proxy deckt den
  Bedarf heute). Wird aufgenommen, wenn die Produktionsreife-Strecke (ADR-0041-
  Umfeld / onetool-Chronik #118) es zieht oder ein realer Deployment-Bedarf
  entsteht.

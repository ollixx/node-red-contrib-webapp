# Auth

Wer benutzt die App: Trusted-Header-Betrieb hinter einem
authentifizierenden Proxy, das `user`-Binding und server-erzwungene
`requiresGroup`-Guards.

> English (canonical): [../../guides/auth.md](../../guides/auth.md)

## Ziel

Eine App hinter einem authentifizierenden Reverse-Proxy betreiben, den
angemeldeten Benutzer in der UI anzeigen und eine Route so schützen, dass
nur Mitglieder einer Gruppe sie erreichen — mit einem Guard, der auf dem
Server erzwungen wird, nicht nur in der UI versteckt.

## Voraussetzungen

- [Bindings & State](bindings-state.md) (die `user`-Binding-Quelle) und
  [Navigation & Dialoge](navigation-dialogs.md) (Routen).

## Das Modell in einem Absatz

Das Framework speichert und prüft niemals Passwörter. Stattdessen
erzwingt ein **authentifizierender Reverse-Proxy** (oauth2-proxy,
Authelia + Traefik, …) vor Node-RED das Login und reicht die Identität
als HTTP-Header an die App weiter. Die App liest diese Header in **ein**
internes User-Objekt — `user.id`, `user.name`, `user.email`,
`user.groups` — und alles Weitere (Bindings, Guards) arbeitet gegen
dieses Objekt, egal welcher Identity-Provider hinter dem Proxy sitzt.

## Aktivieren: `auth` an der App

Der `ui-app`-Knoten trägt eine **Auth**-Konfiguration:

| Einstellung | Default | Bedeutung |
|---|---|---|
| Mode | `none` | `none` = offene App (keine Identität); `trusted-header` = Identität aus Proxy-Headern, erzwungen |
| User-Header | `X-Forwarded-User` | Header, der `user.id` trägt |
| Email-Header | `X-Forwarded-Email` | Header für `user.email` |
| Groups-Header | `X-Forwarded-Groups` | Header für `user.groups` (kommasepariert) |
| Redirect | — (401) | URL, auf die unauthentifizierte Requests umgeleitet werden (z. B. `/oauth2/sign_in`), statt einer nackten 401 |

Mit aktivem `trusted-header` läuft **jeder** App-Endpoint (Seite,
Live-Stream, Events, Snapshot, Assets) durch eine Auth-Guard: Requests
ohne den User-Header bekommen 401 (bzw. den Redirect); Requests mit ihm
tragen die User-Identität durch Rendering und Events.

> **Warnung — Header sind nur hinter dem Proxy vertrauenswürdig.** Jeder
> Client kann `X-Forwarded-*`-Header selbst setzen. Der
> Trusted-Header-Modus ist nur sicher, wenn die App **ausschließlich**
> durch den Proxy erreichbar ist (der Node-RED-Port ist nicht direkt
> exponiert) und der Proxy einkommende Identitäts-Header von außen
> verwirft/überschreibt. Die Guard prüft die *Anwesenheit* des Headers —
> seine *Vertrauenswürdigkeit* ist eine Eigenschaft deines Deployments.

### Proxy-Beispiel (oauth2-proxy)

```yaml
# oauth2-proxy.cfg — vor Node-RED, beliebiger OIDC-Provider
http_address = "0.0.0.0:4180"
upstreams = [ "http://127.0.0.1:1880/" ]
provider = "oidc"
oidc_issuer_url = "https://idp.example.com/realms/main"
client_id = "webapp"
client_secret = "…"
cookie_secret = "…"
email_domains = [ "*" ]
pass_user_headers = true      # X-Forwarded-User / X-Forwarded-Email
set_xauthrequest = true
oidc_groups_claim = "groups"  # Gruppen als Header (Provider-abhängig)
```

Nutzt dein Proxy andere Header-Namen (Authelia setzt `Remote-User` /
`Remote-Email` / `Remote-Groups`), konfiguriere sie in den
Auth-Einstellungen der App. Alle Betriebs-Details (inklusive eines
Traefik/Authelia-Beispiels und der Endpoint-Enforcement-Matrix) stehen im
Contract-Dokument
[`docs/nodes/concepts/auth.md`](../../../nodes/concepts/auth.md).

## Den Benutzer anzeigen: das `user`-Binding

Binde ein beliebiges Wert-Feld an die **User**-Quelle: `user.id`,
`user.name`, `user.email` oder `user.groups` (ein String-Array —
`user.groups.0` liest einen Eintrag). Ohne Identität (`mode: none`) löst
das Binding zu seinem **Fallback** auf. In Reactive-Ausdrücken steht
dieselbe Identität als Global `user` bereit — defensiv lesen:

```js
(user?.groups ?? []).includes("admins")
```

## Seiten schützen: `requiresGroup`

Routen und Dialoge tragen eine optionale **Requires Group**-Liste
(im Editor kommasepariert):

- **leer** — angemeldete Benutzer dürfen hinein (mit `trusted-header`
  genügt die Authentifizierung).
- **gesetzt** — der Benutzer braucht **mindestens eine** der gelisteten
  Gruppen (ANY-of gegen `user.groups`).
- mit `mode: none` erfüllt niemand einen gesetzten Guard — geschützte
  Seiten setzen eine Identitätsquelle voraus.

Der Guard wird **auf dem Server** erzwungen, an jeder Fläche: direkter
URL-Zugriff antwortet mit 403 und einer neutralen Access-denied-Seite
(kein Inhalt leakt), der Snapshot lässt geschützte Routen/Dialoge
komplett weg, Navigations-Kommandos auf eine geschützte Route werden
nicht zugestellt, und Events von Komponenten einer geschützten Seite
werden abgelehnt, bevor sie deinen Flow erreichen.

**„visibleIf ist UX, Guard ist Sicherheit."** Einen Menüpunkt oder
Button über das Reactive-`user`-Muster auszublenden ist Komfort für den
Benutzer — es ist *kein* Schutz. Mach beides: den Eintrag ausblenden
(`visibleIf` mit dem Ausdruck oben) *und* `requiresGroup` an der Route
setzen. Auch wer die URL errät, bekommt dann 403 und einen leeren
Snapshot.

## Schritte

1. Importiere das Beispiel unten. Es kommt mit Auth-Modus `none`: die
   Home-Seite rendert für alle, der „signed in as"-Text zeigt seinen
   Fallback, und der Admin-Button ist versteckt (keine Identität → keine
   `admins`-Gruppe).
2. Öffne die `ui-app`, stelle den Auth-Modus auf `trusted-header`,
   deploye — jetzt brauchen Requests den User-Header. Prüfe: ein
   normaler Browser-Request bekommt `401`; mit einem Header-setzenden
   Proxy (oder einem curl mit
   `-H "X-Forwarded-User: alice" -H "X-Forwarded-Groups: admins"`)
   rendert die Seite und zeigt `alice`.
3. Rufe `/webapp/authApp/admin` ohne die `admins`-Gruppe auf: **403**
   mit der Access-denied-Seite. Mit der Gruppe: der Admin-Inhalt rendert
   und der Admin-Button erscheint auf der Home-Seite.

## Beispiel-Flow

[`examples/guide/auth.json`](../../../../examples/guide/auth.json)

1. In Node-RED das Menü (☰) → **Import** öffnen.
2. Die Datei `examples/guide/auth.json` auswählen (oder ihr JSON
   einfügen) → **Import**.
3. **Deploy** klicken.
4. `http://<dein-node-red>:1880/webapp/authApp/` öffnen — dann den
   Schritten oben folgen, um den Trusted-Header-Modus zu aktivieren.

## Wie weiter

- Contract-Dokument mit vollständiger Enforcement-Matrix und
  Proxy-Rezepten:
  [`docs/nodes/concepts/auth.md`](../../../nodes/concepts/auth.md)
- [Bindings & State](bindings-state.md) — die `user`-Quelle unter den
  anderen Binding-Arten.

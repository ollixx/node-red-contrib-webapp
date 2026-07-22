---
id: P260
node: ui-app
title: "Auth-Fundament: `user`-Contract im Schema, `ui-app.auth`-Feld (none|trusted-header), Konzept-Doku mit Endpoint-Enforcement-Matrix + Tier-0-Betriebsanleitung — KEIN Enforcement-Code"
epic: aspects/auth
status: in_progress
dependencies: []
verify: unit
spec: docs/nodes/concepts/auth.md
tests: tests/e2e/nodes/structure/ui-app.tests.md
---
# P260 — Auth-Fundament (Contract + Konzept)

> Rationale: **[ADR 0041](../../../adr/0041-auth-model-idp-agnostic-identity-trusted-header-first.md)**
> §1/§2/§5. Erster Zug des auth-Epics; bewusst **ohne** Laufzeit-Enforcement
> (das ist P261), damit dieses Paket kollisionsfrei zur laufenden Feld-Modell-
> Einfrierung (P229/P228/P259) umsetzbar ist — es fasst `webapp.js` nicht an.

## findings

- **Kein Identitätsmodell im System:** `clientId` (P87) ist Geräte-/Browser-Scope,
  keine User-Identität. ui-app.md führt Auth als „Offenen Punkt" (P107, deferred).
- **7 Runtime-Endpoints** (`RED.httpNode`, webapp.js:4579–4830): Page, `/stream`,
  `/event`, `/dynamic-state`, `/asset/:id`, `/snapshot`, `/*` — künftige
  Enforcement-Fläche. Admin-Endpoints (`RED.httpAdmin`) sind via Node-RED
  `adminAuth` abgedeckt (nur zu dokumentieren).
- Owner-Entscheid 2026-07-22 (ADR 0041): IdP-agnostisch, trusted-header zuerst,
  keine eigenen Credentials, Identität als Binding-Quelle, Guards deklarativ.

## acceptance

- **Schema-Contract:** `userIdentitySchema` in `packages/schema`
  (`{ id: string(min 1), name?: string, email?: string, groups: string[] default [] }`)
  + Type-Export; unit-getestet (gültig/ungültig/Defaults).
- **`ui-app.auth`-Feld:** Schema `auth: z.object({ mode: z.enum(["none","trusted-header"]), headerUser?: string, headerEmail?: string, headerGroups?: string, redirect?: string }).optional()`
  (Defaults dokumentiert: mode `none`; Header-Defaults `X-Forwarded-User`/`-Email`/`-Groups`);
  Editor-Feld am ui-app (SelectBox `none`/`trusted-header` + die Header-/Redirect-
  Felder, nur sichtbar bei `trusted-header`); Roundtrip open→save verlustfrei
  (`check:roundtrip`); mapConfig trägt `auth` durch. **Ohne Wirkung zur Laufzeit**
  — die Spec sagt das explizit („Enforcement kommt mit P261"); kein stilles
  Verhalten-Versprechen (Inert-Feld-Regel!): die ui-app-Inline-Hilfe kennzeichnet
  den Modus bis P261 als „konfiguriert, noch nicht erzwungen".
- **Konzept-Doku `docs/nodes/concepts/auth.md`:**
  - der `user`-Contract + Herkunft-Abstraktion (Quelle egal, ein Objekt),
  - die **Enforcement-Matrix**: alle 7 Endpoints mit Datei:Zeile, je „muss Guard
    tragen (P261)"; Regel: *jeder künftige Endpoint registriert durch die
    Auth-Middleware*,
  - **Tier-0-Betriebsanleitung** (sofort nutzbar): Betrieb hinter oauth2-proxy/
    Authelia/Traefik-ForwardAuth inkl. Beispiel-Konfig + Node-RED
    `httpNodeMiddleware`-Hinweis; deutliche Warnung „Header nur hinter dem Proxy
    vertrauenswürdig",
  - Abgrenzungen: `adminAuth` (Editor), `clientId` (Gerät, bleibt), „visibleIf ist
    UX, Guard ist Sicherheit" (Vorgriff auf P262), Nicht-Ziele (Passwörter/
    Passkeys/API-Token).
- **ui-app-Spec:** `auth`-Feld in der Feldtabelle (Detail-Bar), „Offene Punkte"-
  Eintrag Auth durch ADR-0041-Verweis ersetzt.
- **P107 geschlossen:** `nodes/ui-app/deferred/P107` → `done/` mit Result-Verweis
  auf ADR 0041 + dieses Epic.
- `check:specs`/`check:fields`/`check:help`/`check:roundtrip`/`check:links` +
  `pnpm validate` grün.

## verify

`unit` — Contract-Schema + ui-app-Feld-Roundtrip (Editor-E2E für den Roundtrip
zulässig); bewusst kein Browser-Verhaltens-Beweis (es gibt kein Verhalten).

## spec

`docs/nodes/concepts/auth.md` (neu) + `docs/nodes/structure/ui-app.md`.

## tests

Schema-Unit (`packages/schema/test`), ui-app-Roundtrip; Katalog ui-app ergänzt.

## notes for the implementer

- **`webapp.js` nicht anfassen** (außer mapConfig-Durchreiche des `auth`-Objekts) —
  Kollisionsvermeidung mit P228/P259, die dort massiv arbeiten.
- Das Feld bewusst als EIN `auth`-Objekt (nicht fünf flache Felder) — ein
  künftiges `mode:"oidc"` (P264) erweitert das Objekt, ohne die ui-app-Feldliste
  zu fluten.
- Inert-Feld-Disziplin ernst nehmen: bis P261 ist `auth` konfigurierbar, aber
  wirkungslos — das MUSS in Spec + Hilfe stehen (die Konformitäts-Sweeps haben
  genau solche stillen Versprechen als Bug-Klasse etabliert).

---
id: P210
node: aspects/state
epic: aspects/state
title: "Tech-Debt: per-client-State produktionsreif skalieren — externer geteilter Store (Redis) und/oder Multi-Instanz Node-RED mit Sticky-Sessions; TTL/Eviction gegen unbegrenztes Wachstum"
status: deferred
deferred_reason: "Großer Architektur-Umbau (State-Substrat + Deployment-Topologie); ADR + Owner-Entscheidung nötig, um Redis-externalisierung vs. Sticky-Session-Multi-Instanz (vs. beides) abzuwägen. Erst relevant, wenn Skalierung/Durability real gebraucht wird — Node-RED ist Single-Prozess, für interne Tools/Dashboards ist der In-Memory-State ok. Richtung steht."
dependencies: []
spec: docs/nodes/concepts/multi-user.md
---
# P210 — per-client-State produktionsreif skalieren (geparkt)

## findings (Nutzer-Wortlaut, 2026-07-10)

- "Das ist aber eine nicht so coole architektur. Skaliert ja nicht wirklich."
- "Ich würde das gerne später auf saubere füße stellen. Externes REDIS klingt gut. Multi node-red mit sticky session klingt auch gut. Aber das packe bitte an die richtige Stelle als technical debts."

## Problem

Der per-client-Zustand aller Clients liegt im **Server-RAM eines einzelnen
Node-RED-Prozesses** (`runtimeState.clientStateMap: Map<appId, Map<clientId,
{state, timestamp}>>`, webapp.js:89) plus der Broadcast-`liveState`. Drei Grenzen:

1. **Kein Eviction** — beim Client-Disconnect wird nur der SSE-Subscriber entfernt
   (+ grace-`onLeave`, P112); der State-Eintrag bleibt. Über viele *unterschiedliche*
   clientIds wächst der Speicher unbegrenzt bis zum Prozess-Neustart.
2. **Keine Durability** — rein in-memory; Node-RED-Neustart verliert allen
   per-client-State. Das `persist`-Flag am ui-store hat (Stand heute) kein
   State-Datei-I/O.
3. **Keine Horizontalskalierung** — die Map lebt in *einem* Prozess; mehrere
   Node-RED-Instanzen hinter einem LB teilen den State nicht.

## Kandidaten-Richtungen (die ein ADR bei Aufnahme abwägt)

- **Externer geteilter Store (Redis o. ä.):** `clientStateMap` hinter eine
  pluggable Schnittstelle; Redis-Adapter liefert Durability + TTL/Eviction +
  über-Instanzen-geteilt in einem Aufwasch. Die „saubere Füße"-Lösung.
- **Multi-Instanz + Sticky-Sessions:** einfachere Topologie — Client per LB an
  *eine* Instanz gepinnt, jede Instanz hält ihre eigene In-Memory-Map. Kein
  geteilter Store nötig, aber keine echte Redundanz/Failover für den State.
- **TTL/Eviction als Zwischenschritt (Single-Instance):** idle Clients nach N Min
  aus der Map werfen (Rehydrierung aus der DB beim Wiederkommen). Begrenzt den
  Speicher sofort, ohne die große Umstellung — guter erster Trittstein.

## Hinweise

- Koppelt an die **DB-Write-Through-Idee** (ADR 0028 / ui-store-read): sobald die
  DB die Wahrheit hält, ist RAM nur noch der heiße Cache aktiver Sessions →
  Eviction/Rehydrierung wird natürlich.
- Nicht „prügeln": für den Node-RED-Zielkontext (Single-Prozess, interne Apps) ist
  der Ist-Zustand tragbar. Dieses Paket ist bewusst geparkt, bis realer
  Skalierungs-/Durability-Bedarf besteht.

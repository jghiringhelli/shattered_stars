# Multiplayer

Online play no longer needs a player-run server or typed addresses. The game connects to
one hosted relay (URL baked in at build time); players pick a mode and use **QUICK MATCH**,
or **CREATE ROOM** and share the 5-letter room code (**JOIN BY CODE**).

- Players: ONLINE in the main menu.
- Deploying the relay (Fly.io / Render), configuration and operations: [docs/ONLINE.md](docs/ONLINE.md).
- Netcode design and measurements: [docs/adr/ADR-0005-online-netcode.md](docs/adr/ADR-0005-online-netcode.md).
- Local development: `npm run start:server` + `npm run dev` (dev builds use `ws://localhost:8080/ws`).
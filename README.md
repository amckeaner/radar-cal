# Radar Cal

A personal productivity app where your calendar is a radar. Events and tasks appear as blips — the sooner they are, the closer to center. The bigger the blip, the more important.

## Views

- **Radar** — Live radar with category wedge sectors. Blips sized by importance, distanced by time.
- **Notes** — Daily note editor with `@Event` and `#Task` tag linking.
- **Universe** — Force-directed mindmap of all your events, tasks, notes, and days. Zoomable and pannable.

## Setup

```bash
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173).

## Deploy to GitHub Pages

1. In `vite.config.js`, make sure `base` matches your repo name (currently `/radar-cal/`)
2. Run:

```bash
npm run deploy
```

This builds the app and pushes to the `gh-pages` branch automatically.

## Tech Stack

- React 18 + Vite
- Tailwind CSS
- React Router v6
- D3.js (coming in Stage 3)
- Dexie.js / IndexedDB (coming in Stage 2)

## Stages

- [x] Stage 1 — Project foundation & app shell
- [ ] Stage 2 — Data layer (Dexie.js, CRUD, Google Calendar sync)
- [ ] Stage 3 — Full Radar View with D3
- [ ] Stage 4 — Event & Task management UI
- [ ] Stage 5 — Notes with tag linking
- [ ] Stage 6 — Universe view with D3 force simulation
- [ ] Stage 7 — Reminders & browser notifications
- [ ] Stage 8 — Polish & GitHub Pages deploy

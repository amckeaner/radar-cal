# Radar Cal

A web-based calendar that displays events and tasks as a radar visualization. Today is at the center — events radiate outward based on how far away they are in time. More important or longer events appear as larger blips. The radar is divided into category sectors (Work, Family, Health, etc.).

![Radar Calendar concept](https://img.shields.io/badge/status-alpha-orange) ![License](https://img.shields.io/badge/license-MIT-blue)

## Features

- **Radar visualization** — Time radiates outward from center (today) with logarithmic scaling
- **Category sectors** — The circle is divided into colored wedges per category
- **Events vs Tasks** — Events are circles, tasks are rounded squares on the radar
- **Smart To-Do List** — Tasks auto-sorted by urgency (due date + importance + effort)
- **Duration learning** — When completing tasks, log actual time; the app learns and suggests better estimates next time
- **Configurable time ranges** — 1 Day, 1 Week, 2 Weeks, 1 Month, 3 Months, 6 Months, 1 Year
- **Custom categories** — Add your own categories with colors and auto-categorization keywords
- **Google Calendar integration** — OAuth sign-in to import events from your Google Calendars
- **Animated sweep line** — Classic radar aesthetic with dark theme and glowing dots
- **Hover tooltips** — Full event details on hover
- **Fully client-side** — No backend required, runs as a single HTML file

## Quick Start

Just open `index.html` in any modern browser. That's it — no build step, no dependencies, no server required.

Or visit the live site: **[https://YOUR_USERNAME.github.io/radar-cal](https://YOUR_USERNAME.github.io/radar-cal)**

## Google Calendar Setup

To connect your Google Calendar:

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a project and enable the **Google Calendar API**
3. Create an **OAuth 2.0 Client ID** (Web application type)
4. Add your origin to **Authorized JavaScript origins**:
   - For GitHub Pages: `https://YOUR_USERNAME.github.io`
   - For local dev: `http://localhost:8080` (or whichever port you use)
5. Paste the Client ID into the app's sidebar setup panel

## Development

Since this is a single HTML file, development is straightforward:

```bash
# Serve locally
python3 -m http.server 8080

# Then open http://localhost:8080
```

## Roadmap

- [ ] Drag-and-drop events on the radar to reschedule
- [ ] ICS file import/export
- [ ] Recurring events
- [ ] Mobile responsive layout
- [ ] Dark/light theme toggle
- [ ] Data persistence (IndexedDB)
- [ ] Multi-calendar sync (Outlook, Apple Calendar)
- [ ] Collaborative shared radars

## License

MIT

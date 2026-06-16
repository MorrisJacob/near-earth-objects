# https://morrisprogramming.com/NearEarth/

# NEO Tracker

A real-time dashboard for tracking Near-Earth Objects (asteroids) using NASA's NeoWS API. Because apparently keeping tabs on giant space rocks hurtling toward our planet is something humans now do for fun.

Live: **[Frontend on Bluehost](https://morrisprogramming.com/NearEarth/)** · **[Backend on Railway](https://get-going-production.up.railway.app)**

---

## Architecture Overview

```
NASA NeoWS API
      │
      ▼
┌─────────────────────┐
│   Go Backend        │  ← stateless proxy on Railway (Docker)
│   (port 7777)       │
└─────────┬───────────┘
          │ JSON over HTTP
          ▼
┌─────────────────────┐
│   React Frontend    │  ← static site on Bluehost
│   (Vite + Three.js) │
└─────────────────────┘
```

No database. No auth. No drama. Just Go fetching rocks and React drawing them.

---

## Backend

**Stack:** Go 1.26 · zero external dependencies · multi-stage Docker build

The backend is a thin HTTP proxy that sits between the browser and NASA's API. It exists for two reasons: CORS (browsers are picky) and JSON normalization (NASA's feed nests objects by date, which nobody wants).

### Endpoints

| Method | Path | What it does |
|--------|------|--------------|
| `GET` | `/api/neo/feed` | Fetches a 7-day window of NEOs, flattens + sorts them |
| `GET` | `/api/neo/{id}` | Proxies the raw NASA JPL detail record for one asteroid |
| `GET` | `/health` | Returns `{"status":"ok"}` so Railway doesn't panic |

### Key details

- **Port:** Reads the `PORT` env var at runtime (Railway injects this); falls back to `7777` locally.
- **Sorting:** NEOs come back ordered by close-approach date ascending, then miss distance ascending — closest threats first, because priorities.
- **No external packages:** The entire backend is stdlib. `net/http`, `encoding/json`, `sort`, done.
- **Data transformation:** `transformNEOs()` flattens NASA's date-keyed nested map into a flat `[]NEO` slice, parsing both quoted-string and numeric float variants that NASA sends inconsistently.
- **Tests:** 18 tests in `main_test.go` using `httptest` to mock NASA responses. Runs in CI on every push.

### Local dev

```bash
cd backend
go run main.go        # starts on :7777
```

---

## Frontend

**Stack:** React 19 · Vite 8 · Three.js 0.184 · no UI framework

A single-page app with two view modes: a filterable grid and a 3D interactive scene. The goal was "useful asteroid dashboard"; the result also became "surprisingly good Three.js demo."

### Component tree

```
App.jsx                        ← state, data fetching, orchestration
├── StarField.jsx              ← canvas background (800 procedural stars)
├── StatsBar.jsx               ← summary numbers (total, hazardous, closest)
├── FilterBar.jsx              ← view toggle, filter buttons, sort dropdown
├── [Grid view]
│   └── AsteroidCard.jsx       ← per-asteroid card with distance progress bar
├── [3D view]
│   └── SpaceView3D.jsx        ← Three.js scene (it's a lot in here)
└── AsteroidModal.jsx          ← detail modal with orbital SVG diagram
```

### State (in `App.jsx`)

| State | Purpose |
|-------|---------|
| `neos` | Full list returned from the API |
| `filtered` | After filter + sort applied client-side |
| `loading` / `error` | Fetch lifecycle |
| `selected` | Asteroid open in the detail modal |
| `filter` | `all` · `hazardous` · `safe` |
| `sortBy` | `date` · `distance` · `size` · `speed` |
| `view` | `grid` · `3d` |

### 3D Scene (`SpaceView3D.jsx`)

The most involved part of the codebase. Highlights:

- **Earth:** Procedural shader with noise-based landmasses and polar ice caps. It doesn't look like a real globe. It looks like a globe a programmer made, which is almost the same thing.
- **Asteroid placement:** Positions are derived deterministically from the asteroid's ID hash (Archimedes sphere sampling), so re-renders don't shuffle everything around.
- **Distance encoding:** `radius = 5 + log(lunarDistance + 1) × 22` — log scale so objects at 0.01 LD and 70 LD are both visible rather than one being a dot and the other being off-screen.
- **Visual extras:** Velocity arrows, glow spheres, fading trails, connection lines to Earth, pulsing red glow on hazardous objects.
- **Interaction:** Raycasting on every frame for hover detection; click opens the detail modal.

### Build & deploy

```bash
cd frontend
npm run dev       # Vite dev server on :5174
npm run build     # outputs to dist/ with base path /NearEarth/
npm test          # Vitest + React Testing Library
```

The `VITE_API_BASE` env var sets the backend URL at build time:

```
VITE_API_BASE=https://get-going-production.up.railway.app/api npm run build
```

---

## Deployment

| Piece | Where | How |
|-------|-------|-----|
| Backend | [Railway](https://railway.app) | Docker (multi-stage, Alpine) via `railway.toml` |
| Frontend | Bluehost | Static files FTP'd to `/public_html/NearEarth/` |

Both are wired up in `.github/workflows/deploy.yml`. Push to `main` → tests run → frontend builds with the Railway URL injected → FTP deploy to Bluehost. Backend deploys to Railway separately via its own webhook.

---

## Local Development

```bash
./start.sh
```

Starts the Go backend on `:7777` and the Vite dev server on `:5174`, then opens the browser. Kill with `Ctrl+C` and both processes clean up. Vite proxies `/api` calls to the local backend so you don't have to think about CORS.

---

## Project Structure

```
.
├── backend/
│   ├── main.go          # entire backend (~350 lines)
│   ├── main_test.go     # 18 tests
│   ├── Dockerfile       # multi-stage Go → Alpine
│   └── go.mod
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── components/
│   │       ├── AsteroidCard.jsx
│   │       ├── AsteroidModal.jsx
│   │       ├── FilterBar.jsx
│   │       ├── SpaceView3D.jsx   # the big one
│   │       ├── StarField.jsx
│   │       └── StatsBar.jsx
│   ├── vite.config.js
│   └── package.json
├── .github/workflows/deploy.yml
├── railway.toml
└── start.sh
```

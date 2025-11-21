# Time Deduction Calculator

This is a small web app that takes an input duration (days/hours/minutes/seconds) and a percentage (e.g. `280.7`) and returns a new duration computed as:

newDuration = originalDuration / (1 + percentage/100)

and the saved time (original - new).

Features:
- Simple, accessible frontend UI in `public/`
- Secure Express backend with `helmet` and rate limiting
- Input validation and friendly results

Security notes:
- Server uses `helmet` to add secure headers and a rate limiter to mitigate abuse.
- Frontend avoids inserting untrusted HTML and uses `textContent` for outputs.

Getting started
--------------

Requirements: Node.js 18+ recommended.

Install dependencies:

```
cd /workspaces/TimeDeductionCalculator
npm install
```

Run:

```
npm start
```

Open `http://localhost:3000` in your browser.

Development:

```
npm run dev
```

API
---
POST `/api/calc` accepts JSON:

```
{
	"percentage": 280.7,
	"duration": { "days": 47, "hours": 21, "minutes": 38, "seconds": 52 }
}
```

Response:

```
{
	"original": { "totalSeconds": 4138732, "breakdown": {"days":47,...} },
	"new": { "totalSeconds": 1087137, "breakdown": {...} },
	"saved": { "totalSeconds": 3051595, "breakdown": {...} }
}
```

Deploying a demo (Docker + GitHub Actions)
-----------------------------------------

This repo includes artifacts to publish a containerized demo:

- `Dockerfile` — builds a production image (Node 20, non-root user).
- `docker-compose.yml` — runs the app locally on `:3000`.
- `.github/workflows/docker-publish.yml` — GitHub Actions workflow that builds and pushes an image to GitHub Container Registry (`ghcr.io`) when you push to `main`.

Local Docker demo

1. Build and run with Docker Compose:

```bash
docker compose up --build
```

2. Open `http://localhost:3000`.

Publish via GitHub Actions

1. Push this repo to GitHub and ensure Actions are enabled for the repository.
2. The workflow will build and push to `ghcr.io/${{ github.repository_owner }}/time-deduction-calculator:latest` on each push to `main`.
3. You can then deploy that image to any container host (Render, Fly, DigitalOcean, etc.).

Deploy to Render (example)

1. Create a new service on Render and choose "Docker" or "Web Service" using your GitHub repo.
2. Render will use the `Dockerfile` to build and run the app; set the port to `3000`.

If you'd like, I can add a `render.yaml` manifest, a Docker Hub publish workflow, or create a one-click Render/Cloud run button. Tell me which target you prefer and I will add the necessary files.


# Hack-Man X

`Hack-Man X` is a browser-based fan-game prototype inspired by the feel of Mega Man X5.

This rebuild focuses on a polished one-player vertical slice that is stable, local-first, and presentable as a portfolio project.

## Live Demo

- GitHub Pages: `https://ricardosalas17.github.io/Hack-Man-x/`

## Stack

- HTML
- CSS
- JavaScript
- Canvas API

## Current Slice

- Responsive presentation shell around the game canvas
- Title screen and restart flow
- One-player movement, jump, and shooting
- Bat enemy spawning and hit detection
- Mission score target and game-over / mission-clear states
- Local asset loading and best-score persistence

## Controls

- Move: `A` / `D` or `Left` / `Right`
- Jump: `W`, `Up`, or `Space`
- Shoot: `J`
- Start / Restart: `Enter` or click the game frame

## Run Locally

Serve the repository with any static server from the project root.

Example:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173` in your browser.

## Deployment

This repository includes a GitHub Actions workflow at `.github/workflows/deploy-pages.yml` that deploys the static site to GitHub Pages on pushes to `master` or `main`.

To enable it in GitHub:

1. Open the repository settings.
2. Go to `Pages`.
3. Set `Source` to `GitHub Actions`.
4. Push to `master` or `main` and wait for the workflow to finish.

## Project Goal

The short-term goal is to keep the original fan-game essence while rebuilding the core loop with cleaner structure so it can grow into a stronger portfolio piece.

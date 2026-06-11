# TIC TAC TOC Agent Guide

## Scope

This file governs the entire repository.

## Product Contract

- Keep the app usable without login, database, or application server.
- Preserve all game modes: classic, 3D cube, limited marks, and 0.8-second speed.
- Preserve practice mode and share-link P2P multiplayer.
- Multiplayer state is host-authoritative. Guests send intents; only the host publishes accepted state.
- A third peer is a spectator and must never mutate game state.
- The 3D board must remain directly selectable and rotatable by mouse and touch.

## Architecture

- `src/domain/`: pure game rules. No React, DOM, storage, or network imports.
- `src/store/`: Zustand application state.
- `src/hooks/useMultiplayer.ts`: Trystero protocol and room lifecycle.
- `src/components/`: React UI and Three.js presentation.
- `src/lib/`: small browser helpers.
- `src/styles.css`: global visual system and responsive layout.

Keep game-rule changes in `src/domain/game.ts` and cover them with Vitest tests. Keep transport details out of components.

## Development

- Required Node version: 22.x.
- Install dependencies with `npm ci`.
- Start locally with `npm run dev`.
- Do not commit `node_modules/`, `dist/`, Playwright artifacts, or TypeScript build info.
- Use strict TypeScript. Avoid `any`; exceptions around untyped transport boundaries must remain localized.
- Keep the app statically deployable.

## Required Verification

Run this before considering work complete:

```bash
npm run check
```

For UI, 3D, or multiplayer changes, also run the manual smoke checklist in `docs/SMOKE_TEST.md`.

## Change-Specific Tests

- Game rules: add or update `src/domain/*.test.ts`.
- Multiplayer: verify two browser tabs can exchange X and O moves; verify a third tab only spectates.
- 3D: verify rotate, zoom, and direct cube selection on desktop and mobile-sized viewports.
- Speed mode: verify the timer reaches `0.0` and the host publishes the timeout result.

## Pull Requests

- Complete `.github/pull_request_template.md`.
- State which automated checks and manual smoke tests were run.
- Call out changes to the P2P protocol, storage format, or share-link parameters.

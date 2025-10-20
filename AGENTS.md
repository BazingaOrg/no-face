# Repository Guidelines

## Project Structure & Module Organization
Source code follows the Next.js App Router layout: `app/page.tsx` drives the masking workflow and `app/layout.tsx` loads shared UI and `globals.css`. Interactive UI lives in `components/`, grouped by feature (uploader, canvas, settings, overlays). Face-detection helpers and emoji utilities sit in `lib/`, cross-cutting helpers in `utils/`, and shared types in `types/`. Drop face model weights under `public/models/` when working offline and review `CLAUDE.md` plus `ROADMAP.md` before larger changes.

## Build, Test, and Development Commands
Install dependencies with `npm install` (or `bun install`), then run `npm run dev` for `http://localhost:3000`. Build with `npm run build`, smoke-test production via `npm run start`, and enforce lint rules with `npm run lint` (bun equivalents are fine). Preload models per `MODELS_SETUP.md` before starting development when working offline.

## Coding Style & Naming Conventions
TypeScript is strict (`tsconfig.json`), so favour explicit interfaces and narrow unions. Use React function components with hooks and place `'use client'` at the top of client-only files. Match the existing formatting: two-space indentation, single quotes, trailing semicolons, and Tailwind classes ordered from layout → color → state. Components stay PascalCase, hooks use `useX`, utilities are camelCase, and prefer the `@/` alias over deep relative paths.

## Testing Guidelines
There is no automated test harness yet; at minimum, run `npm run lint` and manually verify the emoji masking loop (upload → detect → swap → export) on desktop and mobile breakpoints. When adding tests, colocate `*.test.ts(x)` files next to the code under test, note required scripts in `package.json`, and document expected scenarios in the pull request.

## Commit & Pull Request Guidelines
Commit history follows Conventional Commits, e.g. `feat(ui): add transparent overlay`; a brief bilingual suffix is fine. Keep scopes short and prefer English first. Pull requests should describe the change, list manual checks, link roadmap issues when relevant, and include before/after screenshots or screen recordings for UI tweaks. Call out model or asset updates so reviewers can reproduce results.

## Privacy & Model Handling
Models run entirely in-browser; avoid logging sensitive image data or uploading assets to third-party services. Treat `public/models/` as optional and never commit large binaries—point contributors to the download instructions instead. If new configuration is required, add sample env variables in `.env.example` and document them here.

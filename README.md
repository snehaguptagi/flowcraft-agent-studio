# Flowcraft

Flowcraft is a visual AI workflow studio for building, configuring, validating, and testing generative AI workflows without writing orchestration code.

The current MVP includes an interactive canvas and deterministic sandbox execution, so it runs without API keys or external AI services.

## Product definition

Read the [Product Requirements Document](./PRD.md) before changing product scope or behavior. It defines the goals, non-goals, requirements, data model, acceptance criteria, and release plan.

## Features

- Searchable Input, AI, Logic, and Output node library
- Drag-and-drop canvas with movable nodes and visible connections
- Node configuration for prompts, models, variables, and input values
- Graph validation for missing configuration, disconnected nodes, and cycles
- Dependency-ordered sandbox execution with live node status
- Execution logs, intermediate outputs, errors, latency, and run duration
- Undo/redo, zoom, pan, fit, minimap, templates, and dark mode
- Browser autosave plus JSON import and export

## Run locally

### Requirements

- Node.js 22.13 or newer
- npm

### Setup

```bash
git clone <repository-url>
cd flowcraft-ai-workflow-studio
npm ci
npm run dev
```

Open the local URL printed by the development server, normally [http://localhost:3000](http://localhost:3000).

No environment variables are required for the MVP.

## Verification

```bash
npm run build
npm run lint
npm test
```

## Useful commands

- `npm run dev` — start the local development server
- `npm run build` — create the production build
- `npm run lint` — run static code checks
- `npm test` — build and run the server-rendered smoke test

## Project structure

```text
app/
  page.tsx          Main interactive workflow builder
  globals.css       Product design system and responsive layout
  layout.tsx        Document shell and social metadata
public/
  og.png            Social sharing artwork
tests/
  rendered-html.test.mjs
.openai/
  hosting.json      Sites project configuration
PRD.md              Product source of truth
```

## Current architecture

- React 19 and TypeScript
- vinext and Vite
- Client-side workflow engine
- Browser local storage for device-local drafts
- Cloudflare-compatible deployment output

This repository does not yet contain live provider integrations. Production LLM calls, secrets, durable storage, authentication, and multi-user collaboration are intentionally deferred in the PRD.

## Deployed MVP

[Open the private Flowcraft deployment](https://flowcraft-ai-workflow-studio.pwc-genai-la-3031.chatgpt.site)

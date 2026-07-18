# Flowcraft AI Workflow Builder

Flowcraft is a visual builder for creating, connecting, running, and inspecting reusable AI workflows without writing orchestration code.

The core product is workflow-first:

`Input → Prompt → AI model → Output`

Retrieval, classification, translation, logic, and structured-output nodes can be added as explicit steps. Research, Document, and Data Analyst agents remain available as optional advanced nodes only when a task genuinely needs dynamic tool selection over multiple steps.

## What is built

- Visual drag-and-connect workflow canvas
- Input, AI, Logic, optional Agent, and Output node libraries
- Node configuration, validation, run states, logs, outputs, and error inspection
- Local autosave plus versioned JSON import/export
- Standard workflow-first starter template
- Optional Research, Document, and Data Analyst nodes
- Safe browser demonstrations for the three advanced nodes
- Optional local FastAPI and LangGraph service for those Agent nodes
- Optional LangSmith engineering tracing

LangGraph is not required for normal workflows. LangMem is not included in the MVP because no governed long-term-memory use case currently requires it.

## Run locally

### Frontend only

Requirements: Node.js 22.13 or newer and npm.

```powershell
git clone https://github.com/snehaguptagi/flowcraft-agent-studio.git
cd flowcraft-agent-studio
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The canvas and browser-safe workflow demonstrations work without environment variables.

### Optional Agent-node service

Run this only when you want the Research, Document, or Data Analyst node to use the Python LangGraph runtime instead of its safe browser fallback.

In a second terminal:

```powershell
cd services/agent-runtime
python -m venv .venv
.\.venv\Scripts\python -m pip install -e ".[dev]"
.\.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

Copy the root `.env.example` to `.env.local`, then restart `npm run dev`. The frontend will connect to `http://localhost:8000`.

## Why agents are optional

An Agent node is useful when the next action depends on evidence discovered during the run. A standard workflow is the better choice when the steps are already known.

Use normal nodes for prompting, summarization, classification, translation, extraction, formatting, and fixed sequences. Use an Agent node only for bounded multi-step tasks that must choose among approved tools. This keeps most workflows simpler, faster, cheaper, and easier to test.

## Technology

- React 19, TypeScript, vinext, and Vite
- Custom visual graph canvas
- Browser local storage for device-local drafts
- Optional Python, FastAPI, and LangGraph service for Agent nodes
- Optional LangSmith traces for engineering diagnostics
- Cloudflare-compatible frontend output

## Documentation

- [Product requirements](./PRD.md)
- [Product design](./docs/PRODUCT-DESIGN.md)
- [Workflow-first architecture decision](./docs/architecture/ADR-002-workflow-first-product.md)
- [Optional Agent runtime decision](./docs/architecture/ADR-001-agent-platform.md)
- [Agent runtime setup](./services/agent-runtime/README.md)

## Verify

```powershell
npm run build
npm run lint
npm test
cd services/agent-runtime
.\.venv\Scripts\python -m ruff check .
.\.venv\Scripts\python -m pytest
```

## Hosting

Localhost is the primary development experience. An OpenAI Sites deployment may be used as an optional private demo, but it is not the local runtime and does not host the Python Agent-node service.

GitHub repository: [snehaguptagi/flowcraft-agent-studio](https://github.com/snehaguptagi/flowcraft-agent-studio)

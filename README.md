# Flowcraft Agent Studio

Flowcraft is a visual studio for building, running, inspecting, and controlling AI agents and deterministic workflows without writing orchestration code.

It supports three product patterns:

- **Workflow mode:** fixed, predictable steps
- **Agent mode:** goal-driven planning and tool use
- **Hybrid mode:** controlled workflows containing agentic steps

The agentic product contract and delivery sequence are defined in [PRD.md](./PRD.md).

## Current milestone

**Agents 1–2: Research Agent and Document Agent**

The current implementation includes:

- Shared agent configuration and runtime states
- Research Agent with a goal, role, instructions, and completion condition
- Explicit tool allowlist for search, page reading, and evidence notes
- Working-memory, maximum-step, timeout, and approval settings
- Plan → action → observation → decision execution loop
- Structured Agent Trace panel
- Hybrid execution with deterministic upstream and downstream nodes
- Validation of agent goals, tools, models, and limits
- Local autosave and versioned JSON import/export
- A versioned Python API that runs the Research Agent as a typed LangGraph graph
- Opt-in LangSmith tracing for engineering observability
- A memory boundary prepared for evaluated LangMem use cases later
- Document Agent with approved text ingestion, section extraction, evidence ranking, and citations
- TXT, Markdown, CSV, and JSON document inputs up to 100 KB in the current milestone
- Shared permissions, limits, traces, API behavior, and safe browser fallback across both agents

Data Analyst, Writer, and Supervisor agents remain planned and will be implemented one at a time.

## Important MVP boundary

The Research and Document agents use deterministic sandbox tools so they can demonstrate interaction, safety, configuration, and trace behavior without sending data to external AI services. When the Python service is configured, LangGraph orchestrates these tools on the server. Otherwise the same experience falls back safely to the browser sandbox.

The Document Agent currently accepts text-based TXT, Markdown, CSV, and JSON files. PDF and DOCX extraction will be added as a controlled server-side parser increment rather than processing opaque binary files in the browser.

Production model calls, web access, credentials, durable memory, approvals, and privileged tools must run through a secure server-side agent runtime.

## Run locally

### Requirements

- Node.js 22.13 or newer
- npm

### Setup

```bash
git clone https://github.com/snehaguptagi/flowcraft-agent-studio.git
cd flowcraft-agent-studio
npm ci
npm run dev
```

Open the local URL printed by the development server, normally [http://localhost:3000](http://localhost:3000).

No environment variables are required for the browser sandbox.

### Run the LangGraph agent service

In a second terminal:

```powershell
cd services/agent-runtime
python -m venv .venv
.\.venv\Scripts\python -m pip install -e ".[dev]"
.\.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

Copy `.env.example` to `.env.local`, then restart `npm run dev`. The frontend will use `NEXT_PUBLIC_AGENT_API_URL=http://localhost:8000`. LangSmith is optional and configured only in the server environment; LangMem is intentionally deferred until long-term memory is needed and governed.

## Verification

```bash
npm run build
npm run lint
npm test
cd services/agent-runtime
.\.venv\Scripts\python -m ruff check .
.\.venv\Scripts\python -m pytest
```

## Project structure

```text
app/
  page.tsx                  Visual builder, validation and workflow orchestration
  lib/agent-runtime.ts      API client and safe browser fallback
  globals.css               Product design system and responsive layout
  layout.tsx                Document shell and social metadata
public/
  og.png                    Social sharing artwork
tests/
  rendered-html.test.mjs    Server-rendered smoke test
.openai/
  hosting.json              Sites deployment configuration
PRD.md                      Agentic product source of truth
docs/architecture/          Accepted technical decisions
services/agent-runtime/     FastAPI and LangGraph specialist-agent service
```

## Technology

- React 19 and TypeScript
- vinext and Vite
- Custom visual graph canvas
- Browser local storage for device-local drafts
- Python, FastAPI, and LangGraph for server-side agent execution
- Optional LangSmith engineering traces; LangMem-ready memory boundary
- Cloudflare-compatible deployment output
- GitHub repository: [snehaguptagi/flowcraft-agent-studio](https://github.com/snehaguptagi/flowcraft-agent-studio)

## Deployed application

[Open Flowcraft](https://flowcraft-ai-workflow-studio.pwc-genai-la-3031.chatgpt.site)

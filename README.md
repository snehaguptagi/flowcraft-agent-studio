# Flowcraft AI Workflow Builder

Flowcraft is a visual builder for creating, connecting, running, and inspecting reusable AI workflows without writing orchestration code.

The core product is workflow-first:

`Input → Prompt → AI model → Output`

Retrieval, classification, translation, logic, and structured-output nodes can be added as explicit steps. Research, Document, and Data Analyst agents remain available as optional advanced nodes only when a task genuinely needs dynamic tool selection over multiple steps.

## What is built

- Flagship **Inbox triage & draft reply** workflow: new email → triage → policy context → drafted reply → reviewable draft
- Five complete local templates: Email drafting, Customer support, Meeting notes, Lead qualification, and Document Q&A
- Template gallery with outcomes, categories, connected-step counts, and one-click loading
- Guided outcome card that explains what the current template does and how to run it
- Visual drag-and-connect workflow canvas
- Contextual Input, AI, Logic, optional Agent, and Output node picker
- Side-by-side input data, parameters, and output data for every selected node
- Single-step testing, pinned test data, validation, run states, logs, outputs, and errors
- In-session execution history for workflow and manual step tests
- Local autosave plus versioned JSON import/export
- Standard workflow-first starter template
- Ready-to-run customer-support demo workflow
- Port dragging, port clicking, and source-to-target node connection controls
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

Open [http://localhost:3000](http://localhost:3000). The canvas and deterministic local workflow demonstration work without environment variables.

The default workflow turns a realistic customer email into a grounded reply and saves it to a clearly labeled **Demo mailbox** for human review. Press **Run this demo** or **Test workflow**, then select **Save draft** to inspect the exact subject, body, recipient, and “Not sent” status.

Open **Templates** to switch between five complete examples. To build manually, drag the right port of a source node onto the left port of a target node, or click the small **+** after a node to choose and auto-connect the next step. Select a connection to delete it.

The editor is canvas-first: the node picker opens only when needed, and selecting a node opens one focused editor with its **Input**, **Parameters**, and **Output** together. Use **Test step** to run a normal node independently, **Pin data** to reuse known output while iterating, and **Runs** to review workflow or step executions. Agent nodes are kept under **All nodes → Advanced agent nodes** because they are optional rather than the default workflow model.

The included **Demo runtime** produces a clearly labeled deterministic AI sample. Selecting OpenAI, Gemini, or Claude intentionally blocks local execution until a secure backend provider connection is configured; the UI does not pretend that a live model call happened.

The email nodes follow the same rule. **Demo mailbox** runs locally. Selecting Gmail or Outlook visibly blocks execution until secure OAuth is configured. The intended live permission boundary is inbox reading plus draft creation only; Flowcraft must never send an email automatically.

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
- [Email connector safety decision](./docs/architecture/ADR-003-email-connectors.md)
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
